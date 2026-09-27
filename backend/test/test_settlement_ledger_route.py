import pytest
from decimal import Decimal
from uuid import uuid4
from datetime import datetime, timezone
from sqlmodel import Session, select

from db.database import engine
from models import (
    Admin,
    MerchantTaxProfile,
    Order,
    OrderItem,
    Product,
    Site,
    TenantBankAccount,
    TenantLedgerEntry,
    User,
)
from services.settlement_tax_service import (
    calculate_settlement_split,
    compute_and_record_order_settlement,
)


@pytest.fixture(name="db_session")
def session_fixture():
    with Session(engine) as session:
        yield session


def test_settlement_split_on_payment_fulfillment(db_session: Session):
    """
    Tests end-to-end statutory split on order fulfillment:
    - Verifies TenantLedgerEntry has all multi-component statutory withholding columns populated.
    - Verifies Invariant 1 holds: Gross = Net Merchant Payout + Deductions.
    - Verifies Invariant 2: Product GST is credited towards merchant gross, not platform revenue.
    """
    site_id = uuid4()
    admin_id = uuid4()
    customer_id = uuid4()

    admin = Admin(
        id=admin_id,
        email=f"merchant_{uuid4().hex[:8]}@example.com",
        hashed_password="pw",
        name="Admin Seller",
        role="Owner",
        is_active=True,
    )
    db_session.add(admin)

    site = Site(
        id=site_id,
        name="Electronics Hub",
        slug=f"electronics-hub-{uuid4().hex[:8]}",
        site_definition={},
    )
    db_session.add(site)

    customer = User(
        id=customer_id,
        site_id=site_id,
        email=f"customer_{uuid4().hex[:8]}@example.com",
        name="Sameer Joshi",
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Electronics Hub Pvt Ltd",
        entity_type="company",
        pan_number="AABCE5555K",
        gstin="27AABCE5555K1Z5",
        state_code="27",
        state_name="Maharashtra",
        is_gst_registered=True,
        fy_gross_sales_amount=Decimal("1200000.00"),  # > 5 Lakhs
    )
    db_session.add(profile)
    db_session.flush()

    order_id = uuid4()
    gross_val = Decimal("11800.00")
    taxable_val = Decimal("10000.00")
    product_gst = Decimal("1800.00")  # 18% GST (CGST 900 + SGST 900)

    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=customer_id,
        total=gross_val,
        subtotal=taxable_val,
        tax_amount=product_gst,
        shipping_fee=Decimal("0.00"),
        status="placed",
        payment_status="paid",
        items=[
            {
                "product_id": str(uuid4()),
                "product_name": "Pro Monitor",
                "quantity": 1,
                "unit_price": 10000.0,
                "line_total": 11800.0,
                "hsn_code": "8528",
            }
        ],
        shipping_address={
            "full_name": "Sameer Joshi",
            "state_code": "27",
            "state": "Maharashtra",
        },
        pricing_snapshot={
            "tax": {
                "taxableAmount": 10000.0,
                "cgst": 900.0,
                "sgst": 900.0,
                "igst": 0.0,
                "cess": 0.0,
                "amount": 1800.0,
            }
        },
    )
    db_session.add(order)
    db_session.commit()

    # Trigger statutory settlement recording
    ledger = compute_and_record_order_settlement(
        session=db_session,
        order=order,
        admin_id=admin_id,
        commission_percent=Decimal("3.00"),
        razorpay_transfer_id="trf_route_001",
        transfer_status="held",
        ledger_status="in_escrow",
        escrow_status="held",
    )
    db_session.commit()

    assert ledger is not None
    # 1. Gross Order Value
    assert ledger.gross_order_value == Decimal("11800.00")
    assert ledger.taxable_product_value == Decimal("10000.00")
    assert ledger.product_cgst == Decimal("900.00")
    assert ledger.product_sgst == Decimal("900.00")

    # 2. Platform Commission (3% of 11,800 = 354.00) + 18% GST (31.86 CGST + 31.86 SGST = 63.72)
    assert ledger.platform_commission_base == Decimal("354.00")
    assert ledger.platform_fee_gst_cgst == Decimal("31.86")
    assert ledger.platform_fee_gst_sgst == Decimal("31.86")
    assert ledger.platform_fee_gst_igst == Decimal("0.00")
    assert ledger.total_platform_fee_with_gst == Decimal("417.72")

    # 3. Section 52 GST-TCS (0.50% of 10,000 = 50.00 -> 25 CGST + 25 SGST)
    assert ledger.gst_tcs_cgst == Decimal("25.00")
    assert ledger.gst_tcs_sgst == Decimal("25.00")
    assert ledger.total_gst_tcs == Decimal("50.00")

    # 4. Section 194-O Income-Tax TDS (0.10% of 11,800 = 11.80)
    assert ledger.tds_rate_applied == Decimal("0.10")
    assert ledger.income_tax_tds_194o == Decimal("11.80")

    # 5. Gateway MDR (2% of 11,800 = 236.00 + 18% GST = 42.48 -> 278.48)
    assert ledger.gateway_fee == Decimal("236.00")
    assert ledger.gateway_fee_gst == Decimal("42.48")

    # 6. Invariant 1 Verification
    total_deductions = (
        ledger.total_platform_fee_with_gst
        + ledger.total_gst_tcs
        + ledger.income_tax_tds_194o
        + ledger.gateway_fee
        + ledger.gateway_fee_gst
    )
    assert ledger.net_merchant_payout + total_deductions == ledger.gross_order_value

    # 7. Invariant 2 Verification (Merchant Payout is calculated from full Gross including product tax)
    # The platform commission is only 417.72, product tax of 1,800 is not retained by the platform
    assert ledger.platform_fee < product_gst
