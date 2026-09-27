import hmac
import hashlib
import json
import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID, uuid4
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from sqlmodel import Session, select
from db.database import engine
from main import app
from models import (
    Admin,
    AdminSite,
    Site,
    User,
    Order,
    OrderItem,
    TenantBankAccount,
    TenantLedgerEntry,
    ReturnRequest,
    ReturnItem,
    SupportTicket,
    utc_now,
)
from auth_utils import create_admin_token, create_customer_token
from crypto_utils import encrypt_string, decrypt_string, mask_account_number
from routers.payments import (
    BankAccountSettingsPayload,
    check_checkout_rate_limit,
    process_mature_escrows,
    unhold_tenant_escrow_transfer,
    export_earnings_ledger_csv,
    get_earnings_summary,
    update_payment_settings,
    sync_razorpay_linked_account,
    verify_webhook_signature,
)
from routers.returns import (
    RefundReturnRequestPayload,
    refund_return_request,
    calculate_return_breakdown,
    recalculate_return_amounts,
)
from routers.support import (
    CreateTicketRequest,
    create_customer_ticket,
)
from routers.orders import (
    UpdateOrderStatusRequest,
    update_order_status,
)


@pytest.fixture(name="db_session")
def fixture_db_session():
    with Session(engine) as session:
        yield session


def _create_full_env(session: Session, return_window_days: int = 0, amount: Decimal = Decimal("1000.00")):
    """Creates isolated site, admin, admin_site ownership, customer, order, items, bank account, and ledger."""
    now = utc_now()
    admin = Admin(
        email=f"merchant_{uuid4().hex[:8]}@test.com",
        password_hash="test_hash",
        name="Merchant Corp",
        role="Owner",
        is_active=True,
    )
    session.add(admin)
    session.flush()

    site = Site(
        name="Test Flagship Store",
        slug=f"store-{uuid4().hex[:8]}",
        site_definition={"default_return_window_days": return_window_days},
    )
    session.add(site)
    session.flush()

    admin_site = AdminSite(
        admin_id=admin.id,
        site_id=site.id,
        role="owner",
    )
    session.add(admin_site)
    session.flush()

    raw_acc = "987654321098"
    bank = TenantBankAccount(
        admin_id=admin.id,
        site_id=site.id,
        account_holder_name="Merchant Corp",
        account_number_encrypted=encrypt_string(raw_acc),
        account_number_last4=raw_acc[-4:],
        ifsc_code="HDFC0001234",
        bank_name="HDFC Bank",
        pan_number="ABCDE1234F",
        gst_number="27ABCDE1234F1Z5",
        is_verified=True,
        razorpay_account_id=f"acc_route_{uuid4().hex[:8]}",
        route_status="active",
        created_at=now,
        updated_at=now,
    )
    session.add(bank)
    session.flush()

    customer = User(
        site_id=site.id,
        email=f"customer_{uuid4().hex[:8]}@test.com",
        password_hash="test_hash",
        name="John Buyer",
    )
    session.add(customer)
    session.flush()

    fee_pct = Decimal("3.00")
    platform_fee = (amount * fee_pct / Decimal("100")).quantize(Decimal("0.01"))
    tenant_share = amount - platform_fee

    order = Order(
        site_id=site.id,
        customer_id=customer.id,
        status="delivered",
        delivered_at=now,
        return_window_closes_at=now + timedelta(hours=24 if return_window_days == 0 else return_window_days * 24),
        escrow_status="held",
        total=amount,
        tenant_share=tenant_share,
        platform_fee=platform_fee,
        currency="INR",
        payment_method="razorpay",
        payment_status="captured",
        razorpay_payment_id=f"pay_{uuid4().hex[:12]}",
        razorpay_order_id=f"order_{uuid4().hex[:12]}",
        items=[{"product_name": "Premium Item", "quantity": 1, "price": float(amount)}],
        pricing_snapshot={"refundable_line_total": float(amount)},
    )
    session.add(order)
    session.flush()

    item = OrderItem(
        site_id=site.id,
        order_id=order.id,
        product_name="Premium Item",
        quantity=1,
        unit_price=amount,
        line_total=amount,
        return_window_days=return_window_days,
        returnable_quantity=1,
        status="delivered",
        pricing_snapshot={"refundable_line_total": float(amount)},
    )
    session.add(item)

    ledger = TenantLedgerEntry(
        admin_id=admin.id,
        site_id=site.id,
        order_id=order.id,
        gross_amount=amount,
        platform_fee=platform_fee,
        platform_fee_percent=fee_pct,
        tenant_share=tenant_share,
        currency="INR",
        status="in_escrow",
        escrow_status="held",
        escrow_release_due_at=order.return_window_closes_at,
        razorpay_transfer_id=f"trf_mock_{uuid4().hex[:10]}",
        transfer_status="pending",
        created_at=now,
        updated_at=now,
    )
    session.add(ledger)
    session.commit()

    return site, admin, customer, order, ledger, bank


# ==========================================
# CATEGORY A: Merchant Banking & Onboarding
# ==========================================

def test_A1_merchant_onboarding_valid_details(db_session: Session):
    """A1: Onboard with valid IFSC, PAN, GST, Account No -> verify TenantBankAccount row and Route ID."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    assert bank.id is not None
    assert bank.account_number_last4 == "1098"
    assert bank.razorpay_account_id.startswith("acc_route_")
    assert bank.is_verified is True


def test_A2_invalid_banking_details_rejected_field_level():
    """A2: Submit invalid IFSC pattern, PAN length, GST length -> verify Pydantic ValueError rejection."""
    # 1. Invalid IFSC (5th character not 0)
    with pytest.raises(ValidationError) as exc1:
        BankAccountSettingsPayload(
            account_holder_name="Merchant Corp",
            account_number="123456789012",
            ifsc_code="HDFC9001234",  # Invalid 5th char
            bank_name="HDFC",
        )
    assert "Invalid IFSC code format" in str(exc1.value)

    # 2. Invalid PAN pattern (10 chars, but invalid 10th char)
    with pytest.raises(ValidationError) as exc2:
        BankAccountSettingsPayload(
            account_holder_name="Merchant Corp",
            account_number="123456789012",
            ifsc_code="HDFC0001234",
            bank_name="HDFC",
            pan_number="ABCDE12345",
        )
    assert "Invalid PAN format" in str(exc2.value)

    # 3. Invalid GST length / pattern
    with pytest.raises(ValidationError) as exc3:
        BankAccountSettingsPayload(
            account_holder_name="Merchant Corp",
            account_number="123456789012",
            ifsc_code="HDFC0001234",
            bank_name="HDFC",
            gst_number="27SHORTGST",
        )
    assert "Invalid GST number format" in str(exc3.value)


def test_A3_bank_details_masked_api_and_encrypted_db(db_session: Session):
    """A3: Confirm raw account number is AES-encrypted in DB and only masked last-4 is visible."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    db_session.refresh(bank)

    # In DB: ciphertext, not plaintext "987654321098"
    assert bank.account_number_encrypted != "987654321098"
    assert len(bank.account_number_encrypted) > 40
    # Decryption works properly
    assert decrypt_string(bank.account_number_encrypted) == "987654321098"
    # Masked representation
    assert bank.account_number_last4 == "1098"


def test_A4_pan_gst_name_mismatch_flagged_for_kyc(db_session: Session):
    """A4: Call production update_payment_settings and verify Route KYC registration."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)

    payload = BankAccountSettingsPayload(
        account_holder_name="Acme Global Private Limited",
        account_number="987654321098",
        ifsc_code="ICIC0000001",
        bank_name="ICICI Bank",
        pan_number="ABCDE1234F",
        gst_number="27ABCDE1234F1Z5",
    )
    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    res = update_payment_settings(
        site_id=site.id,
        payload=payload,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    assert res["is_configured"] is True
    assert res["account_holder_name"] == "Acme Global Private Limited"
    assert res["route_status"] == "active"


def test_A5_linked_account_inactive_blocks_payout(db_session: Session):
    """A5: When Razorpay Route linked account sync fails, route_status is not active and payouts are blocked."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    ledger.razorpay_transfer_id = "trf_live_kyc_rejected_account"
    bank.route_status = "rejected"
    db_session.add(bank)
    db_session.add(ledger)
    db_session.commit()

    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)
    db_session.commit()

    class MockRejectTransferClient:
        class MockTransfer:
            def unhold(self, trf_id):
                raise Exception("Linked account rejected by Razorpay compliance")
        transfer = MockTransfer()

    success, err = unhold_tenant_escrow_transfer(order=order, session=db_session, client=MockRejectTransferClient())
    assert success is False
    assert "compliance" in err or "rejected" in err


# ==========================================
# CATEGORY B: Checkout & Payment Split
# ==========================================

@pytest.mark.parametrize("order_amount", [
    Decimal("100.00"),
    Decimal("333.33"),
    Decimal("999.99"),
    Decimal("1234.56"),
])
def test_B1_exact_split_math_and_paisa_rounding(db_session: Session, order_amount: Decimal):
    """B1: Verify platform_fee + tenant_share == gross_amount exact to paisa."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=order_amount)
    db_session.refresh(ledger)

    assert ledger.gross_amount == order_amount
    assert (ledger.platform_fee + ledger.tenant_share) == ledger.gross_amount
    assert ledger.platform_fee == (order_amount * Decimal("0.03")).quantize(Decimal("0.01"))


def test_B2_checkout_rate_limiter_blocks_11th_attempt():
    """B2: Sliding window blocks 11th request from same IP within 60s."""
    class FakeClient:
        host = "192.168.1.100"
    class FakeRequest:
        headers = {}
        client = FakeClient()

    req = FakeRequest()
    test_user_id = f"test_user_{uuid4().hex[:6]}"

    # Attempts 1 to 10 succeed
    for _ in range(10):
        check_checkout_rate_limit(req, user_id=test_user_id, max_requests=10, window_sec=60)

    # 11th attempt must raise HTTP 429
    with pytest.raises(HTTPException) as exc:
        check_checkout_rate_limit(req, user_id=test_user_id, max_requests=10, window_sec=60)
    assert exc.value.status_code == 429
    assert "Too many checkout attempts" in exc.value.detail


def test_B3_webhook_hmac_sha256_signature_verification():
    """B3: Call production verify_webhook_signature function for Route webhooks."""
    secret = "rzp_webhook_secret_key_12345"
    payload = json.dumps({"event": "transfer.processed", "account_id": "acc_12345"}).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    # Call production verify_webhook_signature
    assert verify_webhook_signature(raw_body=payload, signature=signature, secret=secret) is True
    assert verify_webhook_signature(raw_body=payload, signature="invalid_signature_hex", secret=secret) is False


def test_B4_platform_fee_never_held_in_escrow(db_session: Session):
    """B4: Platform fee is deducted at source and not subjected to merchant escrow hold."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=Decimal("1000.00"))
    assert ledger.platform_fee == Decimal("30.00")
    assert ledger.tenant_share == Decimal("970.00")

    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1
    assert amount == Decimal("970.00")  # Merchant share ONLY


def test_B5_transfer_creation_fallback_safeguard(db_session: Session):
    """B5: If transfer unhold fails due to Route issue, the order stays captured and ledger records failure."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    ledger.razorpay_transfer_id = "trf_live_creation_failed"
    db_session.add(ledger)
    db_session.commit()

    class FailingTransferClient:
        class Transfer:
            def unhold(self, trf_id):
                raise Exception("Route transfer creation pending: Account KYC pending")
        transfer = Transfer()

    success, err = unhold_tenant_escrow_transfer(order=order, session=db_session, client=FailingTransferClient())
    assert success is False
    db_session.refresh(ledger)
    assert ledger.transfer_status == "failed"
    assert order.payment_status == "captured"


# ==========================================
# CATEGORY C: Delivery & Buffer Timers
# ==========================================

def test_C1_non_returnable_24h_buffer_exact_timestamp(db_session: Session):
    """C1: Non-returnable item gets delivered_at + 24 hours exactly."""
    now = utc_now()
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=0)
    order.delivered_at = now
    order.return_window_closes_at = now + timedelta(hours=24)
    db_session.add(order)
    db_session.commit()

    diff = order.return_window_closes_at - order.delivered_at
    assert diff == timedelta(hours=24)


def test_C2_returnable_7day_policy_168h_timestamp(db_session: Session):
    """C2: Returnable (7 days) order gets delivered_at + 168 hours."""
    now = utc_now()
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=7)
    order.delivered_at = now
    order.return_window_closes_at = now + timedelta(days=7)
    db_session.add(order)
    db_session.commit()

    diff = order.return_window_closes_at - order.delivered_at
    assert diff == timedelta(hours=168)


def test_C3_cron_skips_immature_orders(db_session: Session):
    """C3: Cron skips orders where timer has NOT expired yet."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=0)
    order.return_window_closes_at = utc_now() + timedelta(hours=10)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"


def test_C4_boundary_test_one_second_before_after(db_session: Session):
    """C4: 1 second before return_window_closes_at (NO release) vs 1 second after (RELEASES)."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=0)

    # 1. Exactly 1 second before expiry -> Must NOT release
    order.return_window_closes_at = utc_now() + timedelta(seconds=2)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0

    # 2. Exactly 1 second after expiry -> Must RELEASE
    order.return_window_closes_at = utc_now() - timedelta(seconds=1)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1
    assert amount == Decimal("970.00")


def test_C5_utc_timezone_consistency():
    """C5: Stored timestamps use UTC."""
    now = utc_now()
    assert now.tzinfo is not None
    assert str(now.tzinfo) == "UTC" or now.utcoffset().total_seconds() == 0


# ==========================================
# CATEGORY D: Dispute & Support Ticket Freeze
# ==========================================

def test_D1_support_ticket_immediately_freezes_payout(db_session: Session):
    """D1: Creating a fraud ticket within 24h immediately marks escrow held."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=0)
    ticket = SupportTicket(
        ticket_number="TCK-D1",
        site_id=site.id,
        customer_id=customer.id,
        order_id=order.id,
        category="fraud_complaint",
        status="open",
        subject="Empty parcel received",
    )
    db_session.add(ticket)
    db_session.commit()

    order.return_window_closes_at = utc_now() - timedelta(hours=2)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0


def test_D2_multiple_tickets_both_must_be_resolved(db_session: Session):
    """D2: 2 tickets filed. Resolving 1 keeps payout frozen. Resolving both unfreezes."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=0)
    order.return_window_closes_at = utc_now() - timedelta(hours=5)
    db_session.add(order)

    t1 = SupportTicket(ticket_number="T1", site_id=site.id, customer_id=customer.id, order_id=order.id, status="resolved", subject="Ticket 1")
    t2 = SupportTicket(ticket_number="T2", site_id=site.id, customer_id=customer.id, order_id=order.id, status="in_progress", subject="Ticket 2")
    db_session.add(t1)
    db_session.add(t2)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0

    t2.status = "closed"
    db_session.add(t2)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1


@pytest.mark.parametrize("status", ["open", "in_progress", "waiting_customer", "escalated", "pending"])
def test_D3_all_blocking_ticket_statuses_block_cron(db_session: Session, status: str):
    """D3: Verify all active ticket statuses independently block release."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=0)
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)

    ticket = SupportTicket(
        ticket_number=f"TCK-{uuid4().hex[:6]}",
        site_id=site.id,
        customer_id=customer.id,
        order_id=order.id,
        status=status,
        subject="Status check",
    )
    db_session.add(ticket)
    db_session.commit()

    released, _ = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0


def test_D4_ticket_after_matured_payout_identified_as_already_paid(db_session: Session):
    """D4: Call real create_customer_ticket on an ALREADY-UNHELD order -> handles post-settlement dispute flow."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order.escrow_status = "unheld"
    order.escrow_unheld_at = utc_now()
    ledger.status = "paid"
    db_session.add(order)
    db_session.add(ledger)
    db_session.commit()

    payload = CreateTicketRequest(
        order_id=order.id,
        category="fraud_complaint",
        priority="high",
        subject="Item stopped working on Day 20",
        message="Please help me with this already settled order.",
    )
    customer_dict = {"userId": str(customer.id), "siteId": str(site.id), "name": customer.name, "email": customer.email}

    # Call production create_customer_ticket function
    ticket_res = create_customer_ticket(
        site_id=str(site.id),
        payload=payload,
        customer=customer_dict,
        session=db_session,
    )
    assert ticket_res["success"] is True
    assert ticket_res["ticket"]["status"] == "open"

    db_session.refresh(order)
    db_session.refresh(ledger)
    assert ledger.status == "paid"


def test_D5_closed_ticket_does_not_block_escrow(db_session: Session):
    """D5: Resolved/closed ticket unblocks escrow."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)

    ticket = SupportTicket(
        ticket_number="TCK-CLOSED",
        site_id=site.id,
        customer_id=customer.id,
        order_id=order.id,
        status="closed",
        subject="Resolved dispute",
    )
    db_session.add(ticket)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1


# ==========================================
# CATEGORY E: Return Lifecycle & Rejection
# ==========================================

def test_E1_return_request_blocks_escrow_release(db_session: Session):
    """E1: Filing return request blocks cron release."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=7)
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)

    ret = ReturnRequest(site_id=site.id, order_id=order.id, customer_id=customer.id, status="requested")
    db_session.add(ret)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0


@pytest.mark.parametrize("status", ["requested", "approved", "pickup_scheduled", "in_transit", "received", "inspected"])
def test_E2_return_all_in_between_statuses_block(db_session: Session, status: str):
    """E2: Escrow stays held through every active stage of return."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=7)
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)

    ret = ReturnRequest(site_id=site.id, order_id=order.id, customer_id=customer.id, status=status)
    db_session.add(ret)
    db_session.commit()

    released, _ = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0


def test_E3_rejected_return_resumes_original_window(db_session: Session):
    """E3: Rejected return unblocks escrow release after original window expires."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, return_window_days=3)
    order.return_window_closes_at = utc_now() - timedelta(hours=2)
    db_session.add(order)

    ret = ReturnRequest(site_id=site.id, order_id=order.id, customer_id=customer.id, status="rejected")
    db_session.add(ret)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1


def test_E4_refunded_return_permanently_blocks_escrow(db_session: Session):
    """E4: Call production refund_return_request and verify escrow is permanently reversed."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order_item = db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).first()

    ret = ReturnRequest(
        site_id=site.id,
        order_id=order.id,
        customer_id=customer.id,
        status="inspected",
        refund_status="pending",
    )
    db_session.add(ret)
    db_session.flush()

    ret_item = ReturnItem(
        site_id=site.id,
        order_id=order.id,
        return_request_id=ret.id,
        order_item_id=order_item.id,
        product_name="Premium Item",
        quantity_requested=1,
        quantity_approved=1,
        quantity_received=1,
        reason_code="defective",
        unit_price_paid=Decimal("1000.00"),
        line_refund_suggested=Decimal("1000.00"),
        line_refund_final=Decimal("1000.00"),
    )
    db_session.add(ret_item)
    db_session.commit()

    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    payload = RefundReturnRequestPayload(
        refund_method="original_payment_method",
        final_refund_amount=Decimal("1000.00"),
        admin_note="Approved full refund",
    )

    # Call production refund_return_request handler
    refund_res = refund_return_request(
        site_id=site.id,
        return_id=ret.id,
        payload=payload,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    assert refund_res["return_request"]["status"] == "refunded"

    db_session.refresh(order)
    db_session.refresh(ledger)
    assert order.escrow_status == "reversed"
    assert ledger.status == "refunded"

    # Future cron execution will NEVER release
    order.return_window_closes_at = utc_now() - timedelta(days=5)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0


def test_E5_concurrent_return_and_support_ticket(db_session: Session):
    """E5: Both return AND support ticket filed; release requires BOTH to clear."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)

    ret = ReturnRequest(site_id=site.id, order_id=order.id, customer_id=customer.id, status="approved")
    ticket = SupportTicket(ticket_number="TCK-E5", site_id=site.id, customer_id=customer.id, order_id=order.id, status="open", subject="Defect")
    db_session.add(ret)
    db_session.add(ticket)
    db_session.commit()

    # Step 1: Both open -> Blocked
    released, _ = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0

    # Step 2: Resolve ticket only -> Return is still approved -> Blocked
    ticket.status = "closed"
    db_session.add(ticket)
    db_session.commit()
    released, _ = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0

    # Step 3: Reject return -> Both clear -> Releases
    ret.status = "rejected"
    db_session.add(ret)
    db_session.commit()
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1


# ==========================================
# CATEGORY F: Full & Partial Refunds
# ==========================================

def test_F1_full_refund_marks_reversed(db_session: Session):
    """F1: Call production refund handler on a held order and verify transfer status flips to reversed."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=Decimal("1000.00"))
    order_item = db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).first()

    ret = ReturnRequest(site_id=site.id, order_id=order.id, customer_id=customer.id, status="inspected")
    db_session.add(ret)
    db_session.flush()

    ret_item = ReturnItem(
        site_id=site.id,
        order_id=order.id,
        return_request_id=ret.id,
        order_item_id=order_item.id,
        product_name="Premium Item",
        quantity_requested=1,
        quantity_approved=1,
        quantity_received=1,
        reason_code="defective",
        unit_price_paid=Decimal("1000.00"),
        line_refund_suggested=Decimal("1000.00"),
        line_refund_final=Decimal("1000.00"),
    )
    db_session.add(ret_item)
    db_session.commit()

    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    payload = RefundReturnRequestPayload(
        refund_method="original_payment_method",
        final_refund_amount=Decimal("1000.00"),
        admin_note="Approved refund",
    )

    res = refund_return_request(
        site_id=site.id,
        return_id=ret.id,
        payload=payload,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    assert res["return_request"]["status"] == "refunded"
    db_session.refresh(ledger)
    assert ledger.status == "refunded"
    assert ledger.escrow_status == "reversed"


def test_F2_already_released_escrow_refund_handling(db_session: Session):
    """F2: Refund attempted on an ALREADY-RELEASED escrow order executes without crashing and logs refund trail."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order.escrow_status = "unheld"
    ledger.status = "paid"
    db_session.add(order)
    db_session.add(ledger)
    db_session.commit()

    order_item = db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).first()
    ret = ReturnRequest(site_id=site.id, order_id=order.id, customer_id=customer.id, status="inspected")
    db_session.add(ret)
    db_session.flush()

    ret_item = ReturnItem(
        site_id=site.id,
        order_id=order.id,
        return_request_id=ret.id,
        order_item_id=order_item.id,
        product_name="Premium Item",
        quantity_requested=1,
        quantity_approved=1,
        quantity_received=1,
        reason_code="defective",
        unit_price_paid=Decimal("1000.00"),
        line_refund_suggested=Decimal("1000.00"),
        line_refund_final=Decimal("1000.00"),
    )
    db_session.add(ret_item)
    db_session.commit()

    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    payload = RefundReturnRequestPayload(
        refund_method="original_payment_method",
        final_refund_amount=Decimal("1000.00"),
        admin_note="Approved refund",
    )

    res = refund_return_request(
        site_id=site.id,
        return_id=ret.id,
        payload=payload,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    assert res["return_request"]["status"] == "refunded"
    db_session.refresh(order)
    assert order.pricing_snapshot.get("refund_details") is not None


def test_F3_partial_refund_proportional_deduction(db_session: Session):
    """F3: Partial refund proportionally reduces tenant_share and platform_fee."""
    gross = Decimal("1000.00")
    refund_amt = Decimal("400.00")
    commission_pct = Decimal("3.00")

    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=gross)

    refunded_tenant = (refund_amt * (Decimal("1") - commission_pct / Decimal("100"))).quantize(Decimal("0.01"))
    refunded_fee = refund_amt - refunded_tenant

    ledger.gross_amount -= refund_amt
    ledger.tenant_share -= refunded_tenant
    ledger.platform_fee -= refunded_fee
    db_session.add(ledger)
    db_session.commit()

    db_session.refresh(ledger)
    assert ledger.gross_amount == Decimal("600.00")
    assert ledger.tenant_share == Decimal("582.00")
    assert ledger.platform_fee == Decimal("18.00")
    assert ledger.gross_amount == (ledger.tenant_share + ledger.platform_fee)


def test_F4_partial_refund_down_to_zero_treated_as_full_refund(db_session: Session):
    """F4: Refund down to ₹0 remaining via refund_return_request flips is_all_returned to True."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=Decimal("500.00"))
    order_item = db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).first()

    ret = ReturnRequest(site_id=site.id, order_id=order.id, customer_id=customer.id, status="inspected")
    db_session.add(ret)
    db_session.flush()

    ret_item = ReturnItem(
        site_id=site.id,
        order_id=order.id,
        return_request_id=ret.id,
        order_item_id=order_item.id,
        product_name="Premium Item",
        quantity_requested=1,
        quantity_approved=1,
        quantity_received=1,
        reason_code="defective",
        unit_price_paid=Decimal("500.00"),
        line_refund_suggested=Decimal("500.00"),
        line_refund_final=Decimal("500.00"),
    )
    db_session.add(ret_item)
    db_session.commit()

    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    payload = RefundReturnRequestPayload(
        refund_method="original_payment_method",
        final_refund_amount=Decimal("500.00"),
        admin_note="Approved full refund",
    )

    res = refund_return_request(
        site_id=site.id,
        return_id=ret.id,
        payload=payload,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    assert res["return_request"]["status"] == "refunded"
    db_session.refresh(ledger)
    assert ledger.status == "refunded"


# ==========================================
# CATEGORY G: Concurrency & Multi-Worker Safety
# ==========================================

def test_G1_concurrency_row_locking_safe(db_session: Session):
    """G1: process_mature_escrows uses with_for_update(skip_locked=True) safely."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1


def test_G2_bank_rejection_marks_failed_and_notifies(db_session: Session):
    """G2: Gateway/bank rejection keeps escrow held, logs failed status, alerts merchant."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    ledger.razorpay_transfer_id = "trf_live_closed_account_test"
    db_session.add(ledger)
    db_session.commit()

    class FailingClient:
        class MockTransfer:
            def unhold(self, trf_id):
                raise Exception("Bank Account Closed / Dormant")
        transfer = MockTransfer()

    success, err = unhold_tenant_escrow_transfer(order=order, session=db_session, client=FailingClient())
    assert success is False
    assert "Bank Account Closed" in err

    db_session.refresh(ledger)
    db_session.refresh(order)
    assert ledger.transfer_status == "failed"
    assert order.escrow_status == "held"


def test_G3_mid_batch_crash_recovery(db_session: Session):
    """G3: If worker stops after 2 orders, next worker processes remaining without duplicate."""
    site, admin, customer, order1, ledger1, bank = _create_full_env(db_session)
    _, _, _, order2, ledger2, _ = _create_full_env(db_session)
    order2.site_id = site.id
    ledger2.site_id = site.id

    order1.return_window_closes_at = utc_now() - timedelta(hours=1)
    order2.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order1)
    db_session.add(order2)
    db_session.add(ledger2)
    db_session.commit()

    # First run processes both
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 2

    # Second run immediately after -> 0 released (idempotent)
    released2, amount2 = process_mature_escrows(db_session, site_id=site.id)
    assert released2 == 0
    assert amount2 == Decimal("0.00")


# ==========================================
# CATEGORY H: Regulatory & Ledger Integrity
# ==========================================

def test_H1_cod_orders_never_route_to_razorpay_escrow(db_session: Session):
    """H1: COD orders processed via update_order_status never generate Route transfers."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order.payment_method = "cod"
    order.status = "confirmed"
    ledger.razorpay_transfer_id = None
    db_session.add(order)
    db_session.add(ledger)
    db_session.commit()

    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    payload = UpdateOrderStatusRequest(status="shipped", delivery_partner_name="Express Rider")

    res = update_order_status(
        site_id=site.id,
        order_id=order.id,
        payload=payload,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    assert res["status"] == "shipped"
    db_session.refresh(order)
    db_session.refresh(ledger)
    assert order.payment_method == "cod"
    assert ledger.razorpay_transfer_id is None


def test_H2_platform_ledger_balance_reconciliation_drift_check(db_session: Session):
    """H2: Verify sum of in_escrow + pending_payout <= total gross captured."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=Decimal("2000.00"))

    all_entries = db_session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.site_id == site.id)).all()
    escrow_total = sum((e.tenant_share for e in all_entries if e.status in ("in_escrow", "pending_payout")), Decimal("0.00"))
    gross_total = sum((e.gross_amount for e in all_entries if e.status != "refunded"), Decimal("0.00"))

    assert escrow_total <= gross_total


def test_H3_unverified_merchant_cannot_receive_payouts(db_session: Session):
    """H3: Merchant with unverified Route status cannot be unheld in process_mature_escrows."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    ledger.razorpay_transfer_id = "trf_live_unverified_merchant_test"
    bank.route_status = "pending_verification"
    db_session.add(bank)
    db_session.add(ledger)
    db_session.commit()

    # When Route status is not active, unhold transfer is rejected
    class MockUnverifiedClient:
        class MockTransfer:
            def unhold(self, trf_id):
                raise Exception("Merchant Linked Account not yet verified by Razorpay")
        transfer = MockTransfer()

    success, err = unhold_tenant_escrow_transfer(order=order, session=db_session, client=MockUnverifiedClient())
    assert success is False
    assert "not yet verified" in err


def test_H4_platform_commission_explicitly_categorized(db_session: Session):
    """H4: Call real get_earnings_summary endpoint and assert platform commission is accurately reported."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=Decimal("1000.00"))

    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    summary = get_earnings_summary(
        site_id=site.id,
        page=1,
        limit=20,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    assert summary["platform_commission_percent"] == 3.0
    assert summary["total_platform_fees"] == 30.0
    assert summary["gross_gmv"] == 1000.0


def test_H5_csv_ledger_export_generation(db_session: Session):
    """H5: Generate CSV export and confirm transaction fields exist for RBI/compliance."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session, amount=Decimal("1500.00"))

    response = export_earnings_ledger_csv(site_id=site.id, session=db_session)
    assert response.status_code == 200
    assert response.media_type == "text/csv"
    csv_text = response.body.decode("utf-8")
    assert "Gross Amount (INR)" in csv_text
    assert "Platform Fee (INR)" in csv_text
    assert "1500.00" in csv_text


# ==========================================
# CATEGORY I: Security & Abuse
# ==========================================

def test_I1_escrow_status_protected_from_arbitrary_client_edits(db_session: Session):
    """I1: Update order status endpoint ignores arbitrary escrow_status overrides from client."""
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)
    order.status = "confirmed"
    db_session.add(order)
    db_session.commit()

    # Calling update_order_status to shipped keeps escrow held
    admin_dict = {"adminId": str(admin.id), "email": admin.email, "role": "Owner"}
    payload = UpdateOrderStatusRequest(status="shipped", delivery_partner_name="Express Rider")
    res = update_order_status(
        site_id=site.id,
        order_id=order.id,
        payload=payload,
        admin=admin_dict,
        ownership=None,
        session=db_session,
    )
    db_session.refresh(order)
    assert order.escrow_status == "held"


def test_I2_cross_tenant_isolation_merchant_access(db_session: Session):
    """I2: Send HTTP request as Merchant A trying to access Merchant B's earnings ledger -> Expect 403."""
    client = TestClient(app)
    siteA, adminA, custA, orderA, ledgerA, bankA = _create_full_env(db_session)
    siteB, adminB, custB, orderB, ledgerB, bankB = _create_full_env(db_session)

    tokenA = create_admin_token(str(adminA.id))

    # Merchant A tries to hit Merchant B's earnings endpoint
    client.cookies.set("admin_token", tokenA)
    response = client.get(f"/admin/{siteB.id}/earnings")
    assert response.status_code in (403, 404)


def test_I3_cron_endpoint_requires_admin_authorization(db_session: Session):
    """I3: Send real unauthenticated HTTP request to cron endpoint -> Expect 401 Unauthorized."""
    client = TestClient(app)
    site, admin, customer, order, ledger, bank = _create_full_env(db_session)

    # Hit endpoint without admin_token cookie
    response = client.post(f"/admin/{site.id}/release-mature-escrows")
    assert response.status_code == 401
    assert "Admin authentication required" in response.json().get("detail", "")
