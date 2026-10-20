import pytest
import hmac
import hashlib
import json
import os
from unittest.mock import patch, MagicMock
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlmodel import Session, select

from db.database import engine
from models import Admin, Site, Product, Order, User, UserAddress
from routers.payments import verify_webhook_signature
from services.reconciliation_service import reconcile_stale_orders
from services.notification_queue import (
    enqueue_notification,
    NotificationMessage,
    _dispatch_worker,
    NOTIFICATION_DLQ,
    clear_dlq,
)
from main import validate_production_environment_keys


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


def test_dual_secret_rotation_verification():
    raw_body = b'{"event": "payment.captured", "id": "evt_test123"}'
    primary_secret = "primary_secret_key_2026"
    previous_secret = "old_secret_key_2025"

    sig_primary = hmac.new(primary_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    sig_previous = hmac.new(previous_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    sig_wrong = hmac.new(b"attacker_fake_secret", raw_body, hashlib.sha256).hexdigest()

    # Primary secret validates
    assert verify_webhook_signature(raw_body, sig_primary, secret=primary_secret, secret_prev=previous_secret) is True
    # Previous secret (overlap window) validates
    assert verify_webhook_signature(raw_body, sig_previous, secret=primary_secret, secret_prev=previous_secret) is True
    # Wrong secret fails
    assert verify_webhook_signature(raw_body, sig_wrong, secret=primary_secret, secret_prev=previous_secret) is False


def test_production_environment_boot_guard():
    # 1. Staging / Dev environment allows test keys
    with patch.dict(os.environ, {"ENV": "development", "RAZORPAY_MODE": "test", "RAZORPAY_KEY_ID": "rzp_test_123456"}):
        validate_production_environment_keys()

    # 2. Production environment with live keys passes
    with patch.dict(os.environ, {"ENV": "production", "RAZORPAY_MODE": "live", "RAZORPAY_KEY_ID": "rzp_live_987654"}):
        validate_production_environment_keys()

    # 3. Production environment with test keys raises RuntimeError
    with patch.dict(os.environ, {"ENV": "production", "RAZORPAY_MODE": "test", "RAZORPAY_KEY_ID": "rzp_test_123456"}):
        with pytest.raises(RuntimeError) as exc_info:
            validate_production_environment_keys()
        assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)


def test_stale_order_reconciliation_healing_flow(db_session: Session):
    site = Site(
        name="Recon Test Store",
        slug=f"recon-store-{uuid4().hex[:6]}",
        site_definition={"theme": {"primaryColor": "#000"}},
        is_online=True,
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)

    prod = Product(
        name="Recon Prod",
        description="Desc",
        price=Decimal("100.00"),
        stock=10,
        in_stock=True,
        site_id=site.id,
    )
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)

    user = User(
        email=f"recon_{uuid4().hex[:6]}@example.com",
        first_name="Recon",
        last_name="User",
        password_hash="fakehash",
        site_id=site.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    addr = UserAddress(
        site_id=site.id,
        user_id=user.id,
        full_name="Recon User",
        mobile_number="9999999999",
        address_line1="123 Test St",
        city="Mumbai",
        state="Maharashtra",
        postal_code="400001",
        country="India",
        phone_number="9999999999",
        address_type="Home",
    )
    db_session.add(addr)
    db_session.commit()
    db_session.refresh(addr)

    # Stuck order (created 25 mins ago)
    past_time = datetime.now(timezone.utc) - timedelta(minutes=25)
    stuck_order_1 = Order(
        customer_id=user.id,
        site_id=site.id,
        shipping_address_id=addr.id,
        status="pending",
        payment_status="pending",
        payment_method="razorpay",
        razorpay_order_id=f"order_cap_{uuid4().hex[:8]}",
        total=Decimal("100.00"),
        items=[{
            "product_id": str(prod.id),
            "quantity": 2,
            "price": "100.00",
            "name": prod.name,
        }],
        created_at=past_time,
    )
    db_session.add(stuck_order_1)
    db_session.commit()
    db_session.refresh(stuck_order_1)

    # Mock Razorpay Client to return captured
    mock_rzp = MagicMock()
    mock_rzp.order.fetch.return_value = {
        "id": stuck_order_1.razorpay_order_id,
        "status": "paid",
        "amount_paid": 10000,
    }
    mock_rzp.order.payments.return_value = {
        "items": [{
            "id": f"pay_captured_{uuid4().hex[:8]}",
            "status": "captured",
            "amount": 10000,
            "method": "upi",
        }]
    }

    summary = reconcile_stale_orders(
        session=db_session,
        timeout_minutes=15,
        razorpay_client_override=mock_rzp,
    )
    assert summary["healed_count"] >= 1

    db_session.refresh(stuck_order_1)
    db_session.refresh(prod)
    assert stuck_order_1.payment_status == "paid"
    assert stuck_order_1.status == "placed"
    # Stock should be deducted from 10 to 8
    assert prod.stock == 8

    # Cleanup child records
    from models import OrderStatusHistory, TenantLedgerEntry, InventoryMovement
    histories = db_session.exec(select(OrderStatusHistory).where(OrderStatusHistory.order_id == stuck_order_1.id)).all()
    for h in histories:
        db_session.delete(h)
    ledgers = db_session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == stuck_order_1.id)).all()
    for l in ledgers:
        db_session.delete(l)
    movements = db_session.exec(select(InventoryMovement).where(InventoryMovement.order_id == stuck_order_1.id)).all()
    for m in movements:
        db_session.delete(m)

    db_session.delete(stuck_order_1)
    db_session.delete(addr)
    db_session.commit()
    db_session.delete(user)
    db_session.delete(prod)
    db_session.commit()
    db_session.delete(site)
    db_session.commit()


def test_notification_queue_retry_and_dead_letter():
    clear_dlq()

    def failing_sender(msg):
        raise ConnectionError("Upstream SMTP connection timed out")

    failing_msg = NotificationMessage(
        order_id="ord_fail_test",
        site_id="site_fail_test",
        channel="email",
        recipient="fail@example.com",
        payload={"order_number": "ORD-FAIL-1"},
        max_retries=2,
    )

    # Dispatch directly with failing sender and mocked sleep
    with patch("time.sleep", return_value=None):
        _dispatch_worker(failing_msg, send_fn=failing_sender)

    # Should be in DLQ
    assert len(NOTIFICATION_DLQ) >= 1
    dlq_item = NOTIFICATION_DLQ[-1]
    assert dlq_item["order_id"] == "ord_fail_test"
    assert dlq_item["attempts"] == 2
    assert "Upstream SMTP connection timed out" in dlq_item["last_error"]
