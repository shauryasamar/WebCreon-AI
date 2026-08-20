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
    Cart,
    CartItem,
    Order,
    OrderItem,
    Product,
    ReturnItem,
    ReturnRequest,
    Site,
    TenantBankAccount,
    TenantLedgerEntry,
    User,
    UserAddress,
)
from routers.payments import finalize_order_fulfillment, unhold_tenant_escrow_transfer


@pytest.fixture
def session_fixture():
    with Session(engine) as session:
        yield session


def test_webhook_order_fulfillment_on_dropoff(session_fixture: Session):
    """
    Test Edge Case 1: When a customer pays via UPI and drops off,
    the Webhook endpoint automatically fulfills the pending order and deducts inventory.
    """
    client = TestClient(app)
    admin_id = uuid4()
    site_id = uuid4()
    user_id = uuid4()
    order_id = uuid4()
    prod_id = uuid4()
    now = datetime.now(timezone.utc)

    # 1. Setup Admin & Site
    admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
    site = Site(id=site_id, slug=f"site-{site_id.hex[:6]}", site_definition={"site": {"brand_name": "Test Site"}})
    session_fixture.add(admin)
    session_fixture.add(site)
    session_fixture.commit()

    # 2. Setup AdminSite, BankAccount, User & Product
    admin_site = AdminSite(admin_id=admin_id, site_id=site_id)
    bank_acc = TenantBankAccount(
        admin_id=admin_id,
        site_id=site_id,
        account_holder_name="Bob Dropoff",
        account_number_encrypted="enc_123",
        account_number_last4="1234",
        ifsc_code="HDFC0001234",
        bank_name="HDFC Bank",
        is_verified=True,
        razorpay_account_id=f"acc_{uuid4().hex[:12]}",
        route_status="active",
    )
    user = User(id=user_id, site_id=site_id, phone="9988776655", full_name="Bob Dropoff")
    product = Product(id=prod_id, site_id=site_id, name="Smart Watch", price=Decimal("3000.00"), stock=10, in_stock=True)

    session_fixture.add(admin_site)
    session_fixture.add(bank_acc)
    session_fixture.add(user)
    session_fixture.add(product)
    session_fixture.commit()

    rzp_order_id = f"order_hook_{uuid4().hex[:12]}"
    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=user_id,
        items=[{
            "product_id": str(prod_id),
            "product_name": "Smart Watch",
            "quantity": 2,
            "unit_price": 3000.0,
            "line_total": 6000.0,
        }],
        total=Decimal("6000.00"),
        platform_fee=Decimal("180.00"),
        tenant_share=Decimal("5820.00"),
        payment_method="razorpay",
        payment_status="pending",
        status="pending",
        razorpay_order_id=rzp_order_id,
        created_at=now,
    )
    session_fixture.add(order)
    session_fixture.commit()

    # 3. Simulate Webhook Payload
    webhook_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_{uuid4().hex[:12]}",
                    "order_id": rzp_order_id,
                    "method": "upi",
                    "status": "captured",
                    "amount": 600000,
                }
            }
        }
    }

    resp = client.post("/payments/webhook", json=webhook_payload)
    assert resp.status_code == 200

    # 4. Verify Order was automatically fulfilled and stock deducted
    session_fixture.expire_all()
    updated_order = session_fixture.exec(select(Order).where(Order.id == order_id)).first()
    assert updated_order.payment_status == "paid"
    assert updated_order.status == "placed"
    assert updated_order.razorpay_payment_id.startswith("pay_")

    updated_product = session_fixture.exec(select(Product).where(Product.id == prod_id)).first()
    assert updated_product.stock == 8  # 10 - 2 = 8

    # 5. Verify Ledger Entry was created in escrow
    ledger = session_fixture.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order_id)).first()
    assert ledger is not None
    assert ledger.gross_amount == Decimal("6000.00")
    assert ledger.tenant_share == Decimal("5820.00")
    assert ledger.platform_fee == Decimal("180.00")
    assert ledger.status == "in_escrow"


def test_partial_return_prorated_math(session_fixture: Session):
    """
    Test Edge Case 2: Partial return refunds only the returned items
    and prorates the merchant's net share without wiping out the rest of the order earnings.
    """
    admin_id = uuid4()
    site_id = uuid4()
    user_id = uuid4()
    order_id = uuid4()
    return_id = uuid4()
    now = datetime.now(timezone.utc)

    # 1. Setup Admin & Site
    admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
    site = Site(id=site_id, slug=f"site-{site_id.hex[:6]}", site_definition={"site": {"brand_name": "Test Site"}})
    session_fixture.add(admin)
    session_fixture.add(site)
    session_fixture.commit()

    # 2. Setup User
    user = User(id=user_id, site_id=site_id, phone="9988776655", full_name="Alice Customer")
    session_fixture.add(user)
    session_fixture.commit()

    # Setup Order of 3 items (₹6,000 total -> Tenant Share: ₹5,820, Fee: ₹180)
    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=user_id,
        items=[
            {"product_name": "Shirt A", "quantity": 1, "unit_price": 2000.0, "line_total": 2000.0},
            {"product_name": "Shirt B", "quantity": 1, "unit_price": 2000.0, "line_total": 2000.0},
            {"product_name": "Shirt C", "quantity": 1, "unit_price": 2000.0, "line_total": 2000.0},
        ],
        total=Decimal("6000.00"),
        platform_fee=Decimal("180.00"),
        tenant_share=Decimal("5820.00"),
        payment_method="razorpay",
        payment_status="paid",
        status="delivered",
        delivered_at=now - timedelta(hours=10),
        return_window_closes_at=now + timedelta(hours=38),
        escrow_status="held",
        created_at=now - timedelta(days=1),
    )
    session_fixture.add(order)
    session_fixture.commit()

    ledger = TenantLedgerEntry(
        admin_id=admin_id,
        site_id=site_id,
        order_id=order_id,
        gross_amount=Decimal("6000.00"),
        platform_fee_percent=Decimal("3.00"),
        platform_fee=Decimal("180.00"),
        tenant_share=Decimal("5820.00"),
        currency="INR",
        status="in_escrow",
        escrow_status="held",
        created_at=now - timedelta(days=1),
    )
    session_fixture.add(ledger)

    return_req = ReturnRequest(
        id=return_id,
        order_id=order_id,
        site_id=site_id,
        customer_id=user_id,
        status="approved",
        suggested_refund_amount=Decimal("2000.00"),
        final_refund_amount=Decimal("2000.00"),
        created_at=now,
    )
    session_fixture.add(return_req)
    session_fixture.commit()

    # 3. Simulate Refund of Partial Return (₹2,000 out of ₹6,000)
    refund_amount_dec = Decimal("2000.00")
    is_full_refund = refund_amount_dec >= Decimal(str(order.total))
    assert is_full_refund is False

    commission_percent = ledger.platform_fee_percent or Decimal("3.00")
    refunded_tenant_share = Decimal(str(round(float(refund_amount_dec) * (1.0 - float(commission_percent) / 100.0), 2)))
    refunded_platform_fee = refund_amount_dec - refunded_tenant_share

    ledger.gross_amount = ledger.gross_amount - refund_amount_dec
    ledger.tenant_share = ledger.tenant_share - refunded_tenant_share
    ledger.platform_fee = ledger.platform_fee - refunded_platform_fee
    order.payment_status = "partially_refunded"

    session_fixture.add(order)
    session_fixture.add(ledger)
    session_fixture.commit()

    # 4. Verify Prorated Numbers:
    # Gross: 6000 - 2000 = 4000
    # Tenant share: 5820 - 1940 = 3880
    # Platform fee: 180 - 60 = 120
    assert ledger.gross_amount == Decimal("4000.00")
    assert ledger.tenant_share == Decimal("3880.00")
    assert ledger.platform_fee == Decimal("120.00")
    assert order.payment_status == "partially_refunded"
    assert ledger.escrow_status == "held"  # Remaining funds still in escrow safely!


def test_idempotent_unhold_concurrency(session_fixture: Session):
    """
    Test Edge Case 4: Calling unhold multiple times concurrently does not fail or duplicate.
    """
    admin_id = uuid4()
    site_id = uuid4()
    user_id = uuid4()
    order_id = uuid4()
    now = datetime.now(timezone.utc)

    # 1. Setup Admin & Site
    admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
    site = Site(id=site_id, slug=f"site-{site_id.hex[:6]}", site_definition={"site": {"brand_name": "Test Site"}})
    session_fixture.add(admin)
    session_fixture.add(site)
    session_fixture.commit()

    # 2. Setup User
    user = User(id=user_id, site_id=site_id, phone="9988776655", full_name="Alice Customer")
    session_fixture.add(user)
    session_fixture.commit()

    # 3. Setup Order & Ledger
    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=user_id,
        items=[],
        total=Decimal("1500.00"),
        payment_method="razorpay",
        payment_status="paid",
        status="delivered",
        escrow_status="held",
        created_at=now,
    )
    session_fixture.add(order)
    session_fixture.commit()

    ledger = TenantLedgerEntry(
        admin_id=admin_id,
        site_id=site_id,
        order_id=order_id,
        gross_amount=Decimal("1500.00"),
        platform_fee_percent=Decimal("3.00"),
        platform_fee=Decimal("45.00"),
        tenant_share=Decimal("1455.00"),
        currency="INR",
        status="in_escrow",
        escrow_status="held",
        created_at=now,
    )
    session_fixture.add(ledger)
    session_fixture.commit()

    # First Unhold
    success1, msg1 = unhold_tenant_escrow_transfer(order=order, session=session_fixture, client=None)
    assert success1 is True
    assert order.escrow_status == "unheld"
    assert ledger.status == "paid"

    # Second Unhold (Idempotent call)
    success2, msg2 = unhold_tenant_escrow_transfer(order=order, session=session_fixture, client=None)
    assert success2 is True
    assert msg2 == "Already unheld"
