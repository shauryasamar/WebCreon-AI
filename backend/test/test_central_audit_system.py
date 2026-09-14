import sys
import os
from datetime import datetime, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from db.database import engine
from models import AuditLog, Admin, Site
from services.audit_service import (
    AuditService,
    ActorType,
    SourceType,
    AuditCategory,
    sanitize_audit_payload,
)

def test_secret_sanitization_and_masking():
    print("\n--- 1. Testing Secret Sanitization & Account Masking ---")
    dirty_payload = {
        "user_id": "usr_123",
        "password": "SuperSecretPassword123!",
        "password_hash": "$2b$12$e874987214981729837128937129873",
        "token": "bearer_jwt_secret_token_abc",
        "api_key": "sec_live_9999999999",
        "nested": {
            "secret": "hide_this",
            "bank_account_number": "123456789012",
            "account_number": "987654321098",
        },
        "safe_field": "Everything is normal",
    }

    clean = sanitize_audit_payload(dirty_payload)
    assert clean["password"] == "[REDACTED]"
    assert clean["password_hash"] == "[REDACTED]"
    assert clean["token"] == "[REDACTED]"
    assert clean["nested"]["secret"] == "[REDACTED]"
    assert clean["nested"]["bank_account_number"] == "••••9012"
    assert clean["nested"]["account_number"] == "••••1098"
    assert clean["safe_field"] == "Everything is normal"
    print("✓ Secret sanitization & account masking passed!")

def test_audit_service_event_logging():
    print("\n--- 2. Testing Centralized Event Logging across Sources ---")
    db = Session(engine)
    try:
        # Create a rider event
        log1 = AuditService.log_event(
            session=db,
            actor_type=ActorType.RIDER,
            source=SourceType.RIDER_APP,
            category=AuditCategory.ORDERS_FULFILLMENT,
            action="order.rider_delivered",
            site_id=None,
            actor_id=None,
            actor_email="rider.bob@fleet.internal",
            actor_name="Bob Courier",
            actor_role="Rider",
            resource_type="order",
            resource_id="ord_9901",
            resource_name="Order #9901",
            summary="Rider Bob marked Order #9901 as Delivered with OTP",
            details={
                "otp_verified": True,
                "cash_collected": 450.0,
                "customer_phone": "9876543210"
            },
            status="success"
        )
        assert log1 is not None
        assert log1.actor_type == "RIDER"
        assert log1.source == "rider_app"
        assert log1.details.get("cash_collected") == 450.0

        # Create a payment webhook event with idempotency key
        idem_key = f"razorpay_pay_captured_test_{datetime.utcnow().timestamp()}"
        log2 = AuditService.log_event(
            session=db,
            actor_type=ActorType.PAYMENT_PROVIDER,
            source=SourceType.WEBHOOK_RAZORPAY,
            category=AuditCategory.PAYOUTS,
            action="payment.captured",
            actor_name="Razorpay Webhook",
            actor_role="Payment Gateway",
            resource_type="payment",
            resource_id="pay_rzp_12345",
            resource_name="Payment pay_rzp_12345",
            summary="Payment of ₹1,200.00 captured via UPI",
            idempotency_key=idem_key,
            correlation_id="corr_rzp_8877",
            details={
                "amount": 1200.0,
                "method": "upi",
                "vpa": "customer@okhdfcbank"
            }
        )
        assert log2 is not None
        assert log2.idempotency_key == idem_key
        assert log2.correlation_id == "corr_rzp_8877"

        # Test Idempotency: re-logging with same idempotency_key must return existing log and not duplicate
        log2_dup = AuditService.log_event(
            session=db,
            actor_type=ActorType.PAYMENT_PROVIDER,
            source=SourceType.WEBHOOK_RAZORPAY,
            category=AuditCategory.PAYOUTS,
            action="payment.captured",
            idempotency_key=idem_key,
            summary="Duplicate payload",
        )
        assert log2_dup is not None
        assert log2_dup.id == log2.id
        print("✓ Centralized event logging & idempotency deduplication passed!")

        # Clean up test records
        db.delete(log1)
        db.delete(log2)
        db.commit()
    finally:
        db.close()

def test_retention_cleanup():
    print("\n--- 3. Testing 90-Day Retention Cleanup ---")
    from datetime import timezone
    db = Session(engine)
    try:
        # Create an expired event (105 days old)
        expired_log = AuditLog(
            actor_type=ActorType.SYSTEM,
            source=SourceType.CRON,
            category="system",
            action="test.old_event",
            description="Ancient log event",
            created_at=datetime.now(timezone.utc) - timedelta(days=105)
        )
        db.add(expired_log)
        db.commit()
        db.refresh(expired_log)
        expired_id = expired_log.id

        # Run retention cleanup
        deleted_count = AuditService.cleanup_expired_events(days=90, session=db)
        assert deleted_count >= 1

        # Check it is gone
        found = db.exec(select(AuditLog).where(AuditLog.id == expired_id)).first()
        assert found is None
        print(f"✓ Retention cleanup deleted {deleted_count} expired event(s) successfully!")
    finally:
        db.close()

def test_activity_feed_api_and_scoping():
    print("\n--- 4. Testing Activity Feed API & Store Scoping ---")
    from fastapi.testclient import TestClient
    from main import app
    from auth_utils import create_admin_token
    
    db = Session(engine)
    try:
        # Find or create an admin for testing
        from sqlmodel import select
        admin_user = db.exec(select(Admin).where(Admin.email == "admin.test@webcreon.internal")).first()
        if not admin_user:
            admin_user = db.exec(select(Admin).where(Admin.role == "super_admin")).first()
        if not admin_user:
            admin_user = Admin(email="admin.test@webcreon.internal", name="Super Admin", role="super_admin")
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        token = create_admin_token(str(admin_user.id))
        client = TestClient(app, cookies={"admin_token": token})

        # Query all activity
        res = client.get("/api/admin/activity?page=1&page_size=10")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "logs" in data
        assert "available_sources" in data
        assert "available_users" in data
        assert "available_sites" in data
        print(f"✓ Activity Feed returned {len(data['logs'])} items and available_sources: {data['available_sources']}")

        # Query by source
        res_source = client.get("/api/admin/activity?source=web_app&page=1&page_size=10")
        assert res_source.status_code == 200
        data_source = res_source.json()
        for item in data_source.get("logs", []):
            if item.get("source"):
                assert item["source"] == "web_app"
        print("✓ Source filtering on API verified!")
        if admin_user.email == "admin.test@webcreon.internal":
            db.delete(admin_user)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    test_secret_sanitization_and_masking()
    test_audit_service_event_logging()
    test_retention_cleanup()
    test_activity_feed_api_and_scoping()
    print("\n🎉 ALL AUDIT LOG SYSTEM TESTS PASSED SUCCESSFULLY!")
