import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlmodel import Session, select
from db.database import engine
from models import (
    Admin,
    Site,
    User,
    Order,
    OrderItem,
    TenantLedgerEntry,
    ReturnRequest,
    SupportTicket,
    utc_now,
)
from routers.payments import process_mature_escrows, unhold_tenant_escrow_transfer


@pytest.fixture(name="db_session")
def fixture_db_session():
    with Session(engine) as session:
        yield session


def _create_test_environment(session: Session, return_window_days: int = 0):
    """Creates isolated test site, admin, customer, order, and ledger entry."""
    now = utc_now()
    admin = Admin(
        email=f"admin_{uuid4().hex[:8]}@test.com",
        password_hash="test_hash",
        name="Test Merchant",
    )
    session.add(admin)
    session.flush()

    site = Site(
        name="Test Store",
        slug=f"store-{uuid4().hex[:8]}",
        site_definition={"default_return_window_days": return_window_days},
    )
    session.add(site)
    session.flush()

    customer = User(
        site_id=site.id,
        email=f"customer_{uuid4().hex[:8]}@test.com",
        password_hash="test_hash",
        name="Test Buyer",
    )
    session.add(customer)
    session.flush()

    order = Order(
        site_id=site.id,
        customer_id=customer.id,
        status="delivered",
        delivered_at=now,
        return_window_closes_at=now + timedelta(hours=24 if return_window_days == 0 else return_window_days * 24),
        escrow_status="held",
        total=Decimal("1000.00"),
        tenant_share=Decimal("980.00"),
        platform_fee=Decimal("20.00"),
        currency="INR",
        payment_method="razorpay",
        payment_status="captured",
        items=[{"product_name": "Sample Item", "quantity": 1, "price": 1000.00}],
        pricing_snapshot={},
    )
    session.add(order)
    session.flush()

    item = OrderItem(
        site_id=site.id,
        order_id=order.id,
        product_name="Sample Item",
        quantity=1,
        unit_price=Decimal("1000.00"),
        line_total=Decimal("1000.00"),
        return_window_days=return_window_days,
        returnable_quantity=1,
        status="delivered",
    )
    session.add(item)

    ledger = TenantLedgerEntry(
        admin_id=admin.id,
        site_id=site.id,
        order_id=order.id,
        gross_amount=Decimal("1000.00"),
        platform_fee=Decimal("20.00"),
        tenant_share=Decimal("980.00"),
        currency="INR",
        status="in_escrow",
        escrow_status="held",
        escrow_release_due_at=order.return_window_closes_at,
        created_at=now,
        updated_at=now,
    )
    session.add(ledger)
    session.commit()

    return site, admin, customer, order, ledger


def test_edge_case_1_non_returnable_locked_for_24h(db_session: Session):
    """
    Scenario: Non-returnable item (return_days=0).
    Expected: Escrow is locked for 24h. Calling cron before 24h does NOT release.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=0)

    # 1. Immediate call (0 hours passed) -> Must NOT release
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"

    # 2. Advance time past 24 hours -> Must release cleanly
    order.return_window_closes_at = utc_now() - timedelta(minutes=5)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1
    assert amount == Decimal("980.00")
    db_session.refresh(order)
    assert order.escrow_status == "unheld"


def test_edge_case_2_active_return_blocks_escrow(db_session: Session):
    """
    Scenario: Order return window expired, but customer filed a ReturnRequest.
    Expected: Escrow payout is FROZEN and cron REFUSES to release.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=2)

    # Past return window time
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)

    # Customer filed ReturnRequest
    ret = ReturnRequest(
        site_id=site.id,
        order_id=order.id,
        customer_id=customer.id,
        status="requested",
        refund_status="pending",
        suggested_refund_amount=Decimal("1000.00"),
        final_refund_amount=Decimal("1000.00"),
    )
    db_session.add(ret)
    db_session.commit()

    # Payout must be frozen!
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"


def test_edge_case_3_support_ticket_blocks_escrow_on_non_returnable(db_session: Session):
    """
    Scenario: Non-returnable item. 24h passed, but buyer filed a SupportTicket ("Empty Box / Fraud").
    Expected: Escrow payout is STRICTLY FROZEN and cron REFUSES to release.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=0)

    # Past 24h window
    order.return_window_closes_at = utc_now() - timedelta(hours=2)
    db_session.add(order)

    # Customer opened a Support Ticket for fraud / empty box
    ticket = SupportTicket(
        ticket_number="TCK-99999",
        site_id=site.id,
        customer_id=customer.id,
        order_id=order.id,
        category="fraud_complaint",
        priority="high",
        status="open",
        subject="Received an empty package!",
    )
    db_session.add(ticket)
    db_session.commit()

    # Payout MUST be blocked by the open support ticket!
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"

    # When ticket is resolved / closed -> Payout unfreezes!
    ticket.status = "closed"
    ticket.resolved_at = utc_now()
    db_session.add(ticket)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1
    assert amount == Decimal("980.00")
    db_session.refresh(order)
    assert order.escrow_status == "unheld"


def test_edge_case_4_in_transit_return_blocks_escrow(db_session: Session):
    """
    Scenario: Return was approved and courier is picking up (status in_transit).
    Expected: Escrow remains locked throughout pickup and inspection.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=7)
    order.return_window_closes_at = utc_now() - timedelta(days=1)
    db_session.add(order)

    ret = ReturnRequest(
        site_id=site.id,
        order_id=order.id,
        customer_id=customer.id,
        status="in_transit",
        refund_status="pending",
    )
    db_session.add(ret)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"


def test_edge_case_5_multiple_tickets_one_resolved_one_open(db_session: Session):
    """
    Scenario: Buyer files 2 tickets (e.g., Ticket 1: wrong color, Ticket 2: damaged charger).
    Ticket 1 is resolved, but Ticket 2 is still 'in_progress'.
    Expected: Escrow remains FROZEN until ALL tickets on the order are resolved/closed.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=0)
    order.return_window_closes_at = utc_now() - timedelta(hours=5)
    db_session.add(order)

    ticket1 = SupportTicket(
        ticket_number="TCK-101",
        site_id=site.id,
        customer_id=customer.id,
        order_id=order.id,
        category="order_inquiry",
        status="resolved",  # Resolved
        subject="Ticket 1 - Resolved",
    )
    ticket2 = SupportTicket(
        ticket_number="TCK-102",
        site_id=site.id,
        customer_id=customer.id,
        order_id=order.id,
        category="product_defect",
        status="in_progress",  # Still open!
        subject="Ticket 2 - In progress",
    )
    db_session.add(ticket1)
    db_session.add(ticket2)
    db_session.commit()

    # Must NOT release because ticket2 is still active
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"

    # Close ticket 2 as well
    ticket2.status = "closed"
    db_session.add(ticket2)
    db_session.commit()

    # Now both tickets are resolved/closed -> Payout unfreezes!
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1
    assert amount == Decimal("980.00")
    db_session.refresh(order)
    assert order.escrow_status == "unheld"


def test_edge_case_6_return_rejected_unfreezes_escrow(db_session: Session):
    """
    Scenario: Customer requests a return, but merchant/admin inspects and rejects it (status='rejected').
    Expected: Once rejected, the dispute is over. Since return window passed, funds release to merchant.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=3)
    order.return_window_closes_at = utc_now() - timedelta(hours=10)
    db_session.add(order)

    ret = ReturnRequest(
        site_id=site.id,
        order_id=order.id,
        customer_id=customer.id,
        status="rejected",  # Rejected by merchant
        refund_status="rejected",
    )
    db_session.add(ret)
    db_session.commit()

    # No open dispute exists -> Escrow unholds and releases
    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 1
    assert amount == Decimal("980.00")
    db_session.refresh(order)
    assert order.escrow_status == "unheld"


def test_edge_case_7_cancelled_refunded_order_never_unholds(db_session: Session):
    """
    Scenario: Order was cancelled or refunded before/after delivery.
    Expected: Escrow transfer must NEVER release to merchant.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=0)
    order.status = "cancelled"
    order.payment_status = "refunded"
    order.return_window_closes_at = utc_now() - timedelta(days=2)
    db_session.add(order)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"


@pytest.mark.parametrize("blocking_status", ["open", "in_progress", "waiting_customer", "escalated", "pending"])
def test_edge_case_8_all_support_ticket_blocking_statuses(db_session: Session, blocking_status: str):
    """
    Scenario: Verify that every single active support status ('open', 'in_progress', 'waiting_customer', 'escalated', 'pending')
    strictly blocks escrow release.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=0)
    order.return_window_closes_at = utc_now() - timedelta(hours=1)
    db_session.add(order)

    ticket = SupportTicket(
        ticket_number=f"TCK-{uuid4().hex[:6]}",
        site_id=site.id,
        customer_id=customer.id,
        order_id=order.id,
        category="dispute",
        status=blocking_status,
        subject=f"Testing status {blocking_status}",
    )
    db_session.add(ticket)
    db_session.commit()

    released, amount = process_mature_escrows(db_session, site_id=site.id)
    assert released == 0, f"Status {blocking_status} should have blocked escrow release but allowed it!"
    assert amount == Decimal("0.00")
    db_session.refresh(order)
    assert order.escrow_status == "held"


def test_edge_case_9_bank_rejection_marks_failure_and_notifies(db_session: Session):
    """
    Scenario: Order matures past window, but merchant's bank account rejects the transfer
    or Razorpay throws an API error.
    Expected: Escrow is NOT marked unheld, ledger entry transfer_status is updated to 'failed',
    and cron gracefully returns without crashing.
    """
    site, admin, customer, order, ledger = _create_test_environment(db_session, return_window_days=0)
    order.return_window_closes_at = utc_now() - timedelta(hours=2)
    ledger.razorpay_transfer_id = "trf_live_real_account_fail"
    db_session.add(order)
    db_session.add(ledger)
    db_session.commit()

    # Mock a failing Razorpay client
    class MockFailingRazorpayClient:
        class MockTransfer:
            def unhold(self, transfer_id):
                raise Exception("Bank Account Closed: Beneficiary bank rejected transfer")
        transfer = MockTransfer()

    mock_client = MockFailingRazorpayClient()
    success, err = unhold_tenant_escrow_transfer(order=order, session=db_session, client=mock_client)
    assert success is False
    assert "Beneficiary bank rejected transfer" in err

    db_session.refresh(order)
    db_session.refresh(ledger)
    assert order.escrow_status == "held"
    assert ledger.transfer_status == "failed"

