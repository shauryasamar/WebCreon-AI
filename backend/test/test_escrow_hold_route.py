from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from db.database import engine, get_session
from main import app
from models import (
    Admin,
    AdminSite,
    Order,
    OrderItem,
    Product,
    ReturnItem,
    ReturnRequest,
    Site,
    TenantBankAccount,
    TenantLedgerEntry,
    User,
)
from routers.payments import unhold_tenant_escrow_transfer


@pytest.fixture
def session_fixture():
    with Session(engine) as session:
        yield session


def test_escrow_hold_and_48hr_return_window(session_fixture: Session):
    admin_id = uuid4()
    site_id = uuid4()
    user_id = uuid4()
    order_id = uuid4()
    now = datetime.now(timezone.utc)

    # 1. Setup Admin, Site, User
    admin = Admin(id=admin_id, email=f"merchant_{admin_id.hex[:6]}@example.com", password_hash="hash")
    session_fixture.add(admin)

    site = Site(
        id=site_id,
        slug=f"shop-{site_id.hex[:6]}",
        site_definition={"site": {"brand_name": "Escrow Shop"}},
    )
    session_fixture.add(site)

    user = User(
        id=user_id,
        site_id=site_id,
        phone="9876543210",
        full_name="Alice Customer",
    )
    session_fixture.add(user)
    session_fixture.commit()

    # 2. Setup Bank Account
    bank_acc = TenantBankAccount(
        admin_id=admin_id,
        site_id=site_id,
        account_holder_name="Alice Seller",
        account_number_encrypted="enc_dummy",
        account_number_last4="8821",
        ifsc_code="HDFC0001234",
        bank_name="HDFC Bank",
        is_verified=True,
        razorpay_account_id=f"acc_{uuid4().hex[:12]}",
        route_status="active",
    )
    session_fixture.add(bank_acc)
    session_fixture.commit()

    # 3. Create Order in Escrow Hold
    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=user_id,
        items=[{"product_name": "Test Linen Shirt", "quantity": 1, "unit_price": 2000.0}],
        payment_method="razorpay",
        payment_status="paid",
        razorpay_order_id=f"order_{uuid4().hex[:12]}",
        razorpay_payment_id=f"pay_{uuid4().hex[:12]}",
        total=Decimal("2000.00"),
        platform_fee=Decimal("60.00"),
        tenant_share=Decimal("1940.00"),
        status="shipped",
        escrow_status="held",
        created_at=now,
    )
    session_fixture.add(order)

    ledger = TenantLedgerEntry(
        admin_id=admin_id,
        site_id=site_id,
        order_id=order_id,
        gross_amount=Decimal("2000.00"),
        platform_fee_percent=Decimal("3.00"),
        platform_fee=Decimal("60.00"),
        tenant_share=Decimal("1940.00"),
        currency="INR",
        status="in_escrow",
        escrow_status="held",
        razorpay_transfer_id=f"trf_mock_{uuid4().hex[:10]}",
        transfer_status="held",
        created_at=now,
    )
    session_fixture.add(ledger)
    session_fixture.commit()

    # 4. Simulate Delivery -> 48h return window opens
    order.status = "delivered"
    order.delivered_at = now
    order.return_window_closes_at = now + timedelta(days=2)
    ledger.escrow_release_due_at = order.return_window_closes_at
    session_fixture.add(order)
    session_fixture.add(ledger)
    session_fixture.commit()

    assert order.return_window_closes_at > now
    assert (order.return_window_closes_at - order.delivered_at).total_seconds() == 48 * 3600

    # 5. Test Unhold Functionality (When return rejected or after 48h)
    success, err = unhold_tenant_escrow_transfer(order=order, session=session_fixture, client=None)
    assert success is True
    assert order.escrow_status == "unheld"
    assert ledger.status == "paid"
    assert ledger.transfer_status == "processed"
    assert ledger.settled_at is not None
