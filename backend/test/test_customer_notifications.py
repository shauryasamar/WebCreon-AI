import os
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from auth_utils import create_access_token, create_customer_token, hash_password
from db.database import engine, get_session
from main import app
from models import (
    Admin,
    AdminSite,
    CustomerNotification,
    NotificationDeliveryLog,
    Site,
    StoreEmailSettings,
    User,
    UserAddress,
    utc_now,
)
from crypto_utils import decrypt_string, encrypt_string
from services.email_adapter import send_tenant_email, verify_store_smtp_connection
from services.notification_service import (
    dispatch_customer_event,
    purge_expired_customer_notifications,
)


@pytest.fixture
def session_fixture():
    with Session(engine) as session:
        yield session


def test_multi_tenant_notification_isolation(session_fixture: Session):
    """
    Verify strict multi-tenant isolation across API and DB layers:
    - Customer A1 in Store A only sees Customer A1's notifications for Store A.
    - Customer A2 in Store A only sees Customer A2's notifications for Store A.
    - Customer B1 in Store B only sees Customer B1's notifications for Store B.
    - Cross-tenant lookups return empty / 403.
    """
    client = TestClient(app)

    # 1. Setup Store A and Store B
    site_a_id = uuid4()
    site_b_id = uuid4()
    site_a = Site(id=site_a_id, slug=f"store-a-{site_a_id.hex[:6]}", name="Store Alpha", site_definition={"site": {"brand_name": "Store Alpha"}})
    site_b = Site(id=site_b_id, slug=f"store-b-{site_b_id.hex[:6]}", name="Store Beta", site_definition={"site": {"brand_name": "Store Beta"}})
    session_fixture.add(site_a)
    session_fixture.add(site_b)

    # 2. Setup Customers: Customer A1, Customer A2 (Store A), Customer B1 (Store B)
    user_a1_id = uuid4()
    user_a2_id = uuid4()
    user_b1_id = uuid4()

    user_a1 = User(id=user_a1_id, email=f"a1_{user_a1_id.hex[:6]}@example.com", name="Customer A1", password_hash=hash_password("Pass123!"), site_id=site_a_id)
    user_a2 = User(id=user_a2_id, email=f"a2_{user_a2_id.hex[:6]}@example.com", name="Customer A2", password_hash=hash_password("Pass123!"), site_id=site_a_id)
    user_b1 = User(id=user_b1_id, email=f"b1_{user_b1_id.hex[:6]}@example.com", name="Customer B1", password_hash=hash_password("Pass123!"), site_id=site_b_id)

    session_fixture.add(user_a1)
    session_fixture.add(user_a2)
    session_fixture.add(user_b1)
    session_fixture.commit()

    # 3. Dispatch events for each customer
    notif_a1 = dispatch_customer_event(
        session=session_fixture,
        site_id=site_a_id,
        customer_id=user_a1_id,
        event_type="order.placed",
        category="order",
        title="Order Placed #A101",
        message="Your order #A101 has been placed at Store Alpha.",
        send_email=False,
    )

    notif_a2 = dispatch_customer_event(
        session=session_fixture,
        site_id=site_a_id,
        customer_id=user_a2_id,
        event_type="order.placed",
        category="order",
        title="Order Placed #A201",
        message="Your order #A201 has been placed at Store Alpha.",
        send_email=False,
    )

    notif_b1 = dispatch_customer_event(
        session=session_fixture,
        site_id=site_b_id,
        customer_id=user_b1_id,
        event_type="order.placed",
        category="order",
        title="Order Placed #B101",
        message="Your order #B101 has been placed at Store Beta.",
        send_email=False,
    )
    session_fixture.commit()

    assert notif_a1 is not None
    assert notif_a2 is not None
    assert notif_b1 is not None

    token_a1 = create_customer_token(str(user_a1_id), user_a1.email, str(site_a_id))
    token_a2 = create_customer_token(str(user_a2_id), user_a2.email, str(site_a_id))
    token_b1 = create_customer_token(str(user_b1_id), user_b1.email, str(site_b_id))

    # 4. Customer A1 queries Store A -> should only see notif_a1
    resp_a1 = client.get(
        f"/api/notifications/customer/{site_a.slug}",
        headers={"Authorization": f"Bearer {token_a1}"},
    )
    assert resp_a1.status_code == 200
    data_a1 = resp_a1.json()
    assert data_a1["total"] == 1
    assert data_a1["notifications"][0]["id"] == str(notif_a1.id)
    assert data_a1["notifications"][0]["title"] == "Order Placed #A101"

    # 5. Customer A2 queries Store A -> should only see notif_a2
    resp_a2 = client.get(
        f"/api/notifications/customer/{site_a.slug}",
        headers={"Authorization": f"Bearer {token_a2}"},
    )
    assert resp_a2.status_code == 200
    data_a2 = resp_a2.json()
    assert data_a2["total"] == 1
    assert data_a2["notifications"][0]["id"] == str(notif_a2.id)
    assert data_a2["notifications"][0]["title"] == "Order Placed #A201"

    # 6. Customer B1 queries Store B -> should only see notif_b1
    resp_b1 = client.get(
        f"/api/notifications/customer/{site_b.slug}",
        headers={"Authorization": f"Bearer {token_b1}"},
    )
    assert resp_b1.status_code == 200
    data_b1 = resp_b1.json()
    assert data_b1["total"] == 1
    assert data_b1["notifications"][0]["id"] == str(notif_b1.id)

    # 7. Cross-tenant attack: Customer A1 tries to query Store B
    resp_cross = client.get(
        f"/api/notifications/customer/{site_b.slug}",
        headers={"Authorization": f"Bearer {token_a1}"},
    )
    assert resp_cross.status_code == 403

    # 8. Cross-tenant mutation: Customer A1 tries to mark Customer B1's notification as read
    resp_mark_cross = client.patch(
        f"/api/notifications/customer/{site_a.slug}/{notif_b1.id}/read",
        headers={"Authorization": f"Bearer {token_a1}"},
    )
    assert resp_mark_cross.status_code == 404

    # Verify notif_b1 remains unread in database
    session_fixture.refresh(notif_b1)
    assert notif_b1.is_read is False


def test_idempotency_deduplication(session_fixture: Session):
    """
    Verify that duplicate events with the same idempotency_key are rejected
    and do not generate duplicate database rows or duplicate notifications.
    """
    site_id = uuid4()
    site = Site(id=site_id, slug=f"idem-{site_id.hex[:6]}", name="Idem Store")
    user_id = uuid4()
    user = User(id=user_id, email=f"idem_{user_id.hex[:6]}@example.com", name="Idem User", site_id=site_id)
    session_fixture.add(site)
    session_fixture.add(user)
    session_fixture.commit()

    idempotency_key = f"{site_id}:order.placed:ORD-12345"

    # 1. First dispatch -> creates notification
    notif_1 = dispatch_customer_event(
        session=session_fixture,
        site_id=site_id,
        customer_id=user_id,
        event_type="order.placed",
        category="order",
        title="Order Placed #12345",
        message="Thank you for your order.",
        idempotency_key=idempotency_key,
        send_email=False,
    )
    session_fixture.commit()
    assert notif_1 is not None

    # 2. Duplicate dispatch with same idempotency key -> suppressed
    notif_2 = dispatch_customer_event(
        session=session_fixture,
        site_id=site_id,
        customer_id=user_id,
        event_type="order.placed",
        category="order",
        title="Order Placed #12345",
        message="Thank you for your order.",
        idempotency_key=idempotency_key,
        send_email=False,
    )
    assert notif_2 is None

    # Verify count in database is exactly 1
    total = session_fixture.exec(
        select(CustomerNotification).where(
            CustomerNotification.site_id == site_id,
            CustomerNotification.customer_id == user_id,
        )
    ).all()
    assert len(total) == 1


def test_90_day_retention_purge(session_fixture: Session):
    """
    Verify retention separation:
    - Customer notifications older than 90 days are purged.
    - Customer notifications younger than 90 days are preserved.
    - Delivery logs older than 180 days are purged.
    """
    site_id = uuid4()
    site = Site(id=site_id, slug=f"ret-{site_id.hex[:6]}", name="Retention Store")
    user_id = uuid4()
    user = User(id=user_id, email=f"ret_{user_id.hex[:6]}@example.com", name="Retention User", site_id=site_id)
    session_fixture.add(site)
    session_fixture.add(user)
    session_fixture.commit()

    now = utc_now()
    old_date = now - timedelta(days=95)
    recent_date = now - timedelta(days=10)

    # 1. Insert old notification (95 days old)
    old_notif = CustomerNotification(
        site_id=site_id,
        customer_id=user_id,
        event_type="order.placed",
        category="order",
        title="Old Notification",
        message="Old message",
        created_at=old_date,
    )
    # 2. Insert recent notification (10 days old)
    recent_notif = CustomerNotification(
        site_id=site_id,
        customer_id=user_id,
        event_type="order.placed",
        category="order",
        title="Recent Notification",
        message="Recent message",
        created_at=recent_date,
    )
    # 3. Insert delivery log (200 days old)
    old_log = NotificationDeliveryLog(
        site_id=site_id,
        channel="email",
        event_type="order.placed",
        recipient="test@example.com",
        status="sent",
        created_at=now - timedelta(days=200),
    )
    # 4. Insert recent delivery log (30 days old)
    recent_log = NotificationDeliveryLog(
        site_id=site_id,
        channel="email",
        event_type="order.placed",
        recipient="test@example.com",
        status="sent",
        created_at=now - timedelta(days=30),
    )

    session_fixture.add(old_notif)
    session_fixture.add(recent_notif)
    session_fixture.add(old_log)
    session_fixture.add(recent_log)
    session_fixture.commit()

    # Run retention purge
    purged_notifs, purged_logs = purge_expired_customer_notifications(
        session=session_fixture,
        retention_days=90,
        delivery_log_retention_days=180,
    )

    assert purged_notifs >= 1
    assert purged_logs >= 1

    # Verify recent records still exist
    assert session_fixture.get(CustomerNotification, recent_notif.id) is not None
    assert session_fixture.get(CustomerNotification, old_notif.id) is None
    assert session_fixture.get(NotificationDeliveryLog, recent_log.id) is not None
    assert session_fixture.get(NotificationDeliveryLog, old_log.id) is None


def test_admin_email_settings_encryption_and_late_binding(session_fixture: Session):
    """
    Verify that:
    1. SMTP password is encrypted at rest with Fernet and never returned in plaintext.
    2. Late-binding sender resolution dynamically reads store settings.
    """
    client = TestClient(app)
    admin_id = uuid4()
    site_id = uuid4()

    admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
    site = Site(id=site_id, slug=f"smtp-site-{site_id.hex[:6]}", name="Custom SMTP Store")
    admin_site = AdminSite(admin_id=admin_id, site_id=site_id)

    session_fixture.add(admin)
    session_fixture.add(site)
    session_fixture.add(admin_site)
    session_fixture.commit()

    admin_token = create_access_token(
        data={"adminId": str(admin_id), "email": admin.email, "role": "owner"},
        expires_delta=timedelta(hours=2),
    )

    # 1. Update email settings with custom SMTP and password
    raw_secret = "SuperSecretSmtpPass!123"
    update_resp = client.put(
        f"/api/notifications/admin/{site_id}/email-settings",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "sender_name": "Custom Store Support",
            "sender_email": "support@customstore.com",
            "smtp_host": "smtp.customstore.com",
            "smtp_port": 587,
            "smtp_username": "smtp_user",
            "smtp_password": raw_secret,
            "smtp_use_tls": True,
            "smtp_use_ssl": False,
        },
    )
    assert update_resp.status_code == 200
    res_data = update_resp.json()
    assert res_data["settings"]["sender_name"] == "Custom Store Support"
    # Plaintext password MUST NOT be returned in API response
    assert "smtp_password" not in res_data["settings"] or res_data["settings"]["smtp_password"] is None
    assert res_data["settings"]["has_smtp_password"] is True

    # 2. Verify encrypted representation in DB
    db_settings = session_fixture.exec(
        select(StoreEmailSettings).where(StoreEmailSettings.site_id == site_id)
    ).first()
    assert db_settings is not None
    assert db_settings.smtp_password_encrypted is not None
    assert db_settings.smtp_password_encrypted != raw_secret
    # Decrypt to ensure reversible encryption
    decrypted_pw = decrypt_string(db_settings.smtp_password_encrypted)
    assert decrypted_pw == raw_secret
