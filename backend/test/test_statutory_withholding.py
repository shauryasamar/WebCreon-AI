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
    Site,
    TenantLedgerEntry,
    User,
)
from services.settlement_tax_service import (
    calculate_settlement_split,
    compute_and_record_order_settlement,
    WEBCREON_STATE_CODE,
)


@pytest.fixture(name="db_session")
def session_fixture():
    with Session(engine) as session:
        yield session



def test_invariant_1_settlement_reconciliation():
    """
    Invariant 1: Gross = Net Merchant Payout + Total Platform Fee With GST + Total GST-TCS + 194-O TDS + Gateway MDR With GST
    Must hold to the exact paisa (0.00 discrepancy) across various amounts.
    """
    test_amounts = [
        Decimal("1180.00"),
        Decimal("2360.00"),
        Decimal("5900.00"),
        Decimal("123.45"),
        Decimal("999.99"),
        Decimal("50000.00"),
    ]

    profile_mh = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="MH Merchant Pvt Ltd",
        entity_type="company",
        pan_number="AAACM1111K",
        gstin="27AAACM1111K1Z1",
        state_code="27",
    )

    for gross in test_amounts:
        taxable = (gross / Decimal("1.18")).quantize(Decimal("0.01"))
        tax = gross - taxable
        cgst = (tax / Decimal("2.0")).quantize(Decimal("0.01"))
        sgst = tax - cgst

        breakdown = calculate_settlement_split(
            gross_order_value=gross,
            taxable_product_value=taxable,
            product_cgst=cgst,
            product_sgst=sgst,
            product_igst=Decimal("0.00"),
            product_cess=Decimal("0.00"),
            merchant_profile=profile_mh,
            customer_state_code="27",
            commission_percent=Decimal("3.00"),
            estimate_gateway_fee=True,
        )

        reconciled_sum = (
            breakdown.net_merchant_payout
            + breakdown.total_platform_fee_with_gst
            + breakdown.total_gst_tcs
            + breakdown.income_tax_tds_194o
            + breakdown.total_gateway_charges
        )

        assert reconciled_sum == gross, f"Invariant 1 failed for gross {gross}: sum={reconciled_sum}"


def test_platform_fee_gst_place_of_supply():
    """
    Platform fee SAC 998313 @ 18% GST:
    - WebCreon is in MH (27).
    - If Merchant in MH (27) -> CGST 9% + SGST 9%.
    - If Merchant outside MH (e.g. KA, 29) -> IGST 18%.
    """
    gross = Decimal("10000.00")
    comm_pct = Decimal("3.00")
    # Base fee = 300.00

    profile_mh = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="MH Seller",
        entity_type="company",
        pan_number="AABCM1111K",
        gstin="27AABCM1111K1Z1",
        state_code="27",
    )

    res_intra = calculate_settlement_split(
        gross_order_value=gross,
        taxable_product_value=Decimal("8474.58"),
        product_cgst=Decimal("762.71"),
        product_sgst=Decimal("762.71"),
        product_igst=Decimal("0.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_mh,
        customer_state_code="27",
        commission_percent=comm_pct,
    )

    assert res_intra.platform_commission_base == Decimal("300.00")
    assert res_intra.platform_fee_gst_cgst == Decimal("27.00")  # 9%
    assert res_intra.platform_fee_gst_sgst == Decimal("27.00")  # 9%
    assert res_intra.platform_fee_gst_igst == Decimal("0.00")
    assert res_intra.total_platform_fee_with_gst == Decimal("354.00")

    profile_ka = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="KA Seller",
        entity_type="company",
        pan_number="AABCK2222K",
        gstin="29AABCK2222K1Z2",
        state_code="29",
    )

    res_inter = calculate_settlement_split(
        gross_order_value=gross,
        taxable_product_value=Decimal("8474.58"),
        product_cgst=Decimal("0.00"),
        product_sgst=Decimal("0.00"),
        product_igst=Decimal("1525.42"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_ka,
        customer_state_code="29",
        commission_percent=comm_pct,
    )

    assert res_inter.platform_commission_base == Decimal("300.00")
    assert res_inter.platform_fee_gst_cgst == Decimal("0.00")
    assert res_inter.platform_fee_gst_sgst == Decimal("0.00")
    assert res_inter.platform_fee_gst_igst == Decimal("54.00")  # 18%
    assert res_inter.total_platform_fee_with_gst == Decimal("354.00")


def test_section_52_gst_tcs():
    """
    Section 52 GST-TCS (0.50% of net taxable supplies):
    - Intra-state sale (Merchant MH, Customer MH): 0.25% CGST + 0.25% SGST.
    - Inter-state sale (Merchant MH, Customer KA): 0.50% IGST.
    - Unregistered / Composition merchant: ₹0.00 TCS.
    """
    taxable = Decimal("10000.00")
    gross = Decimal("11800.00")

    profile_reg = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="Registered Seller",
        entity_type="company",
        pan_number="AABCR3333K",
        gstin="27AABCR3333K1Z3",
        state_code="27",
    )

    # Intra-state sale
    res_intra = calculate_settlement_split(
        gross_order_value=gross,
        taxable_product_value=taxable,
        product_cgst=Decimal("900.00"),
        product_sgst=Decimal("900.00"),
        product_igst=Decimal("0.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_reg,
        customer_state_code="27",
    )
    assert res_intra.gst_tcs_cgst == Decimal("25.00")  # 0.25%
    assert res_intra.gst_tcs_sgst == Decimal("25.00")  # 0.25%
    assert res_intra.gst_tcs_igst == Decimal("0.00")
    assert res_intra.total_gst_tcs == Decimal("50.00")  # 0.50% total

    # Inter-state sale
    res_inter = calculate_settlement_split(
        gross_order_value=gross,
        taxable_product_value=taxable,
        product_cgst=Decimal("0.00"),
        product_sgst=Decimal("0.00"),
        product_igst=Decimal("1800.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_reg,
        customer_state_code="29",
    )
    assert res_inter.gst_tcs_cgst == Decimal("0.00")
    assert res_inter.gst_tcs_sgst == Decimal("0.00")
    assert res_inter.gst_tcs_igst == Decimal("50.00")  # 0.50%
    assert res_inter.total_gst_tcs == Decimal("50.00")

    # Composition dealer: Exempt from Section 52 TCS
    profile_comp = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="Composition Seller",
        entity_type="individual",
        pan_number="AABCC4444K",
        gstin="27AABCC4444K1Z4",
        state_code="27",
        is_composition_dealer=True,
    )
    res_comp = calculate_settlement_split(
        gross_order_value=gross,
        taxable_product_value=taxable,
        product_cgst=Decimal("0.00"),
        product_sgst=Decimal("0.00"),
        product_igst=Decimal("0.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_comp,
        customer_state_code="27",
    )
    assert res_comp.total_gst_tcs == Decimal("0.00")


def test_section_194o_income_tax_tds():
    """
    Section 194-O TDS rules:
    - Base: Gross amount of sales (inclusive of GST).
    - Individual / HUF below ₹5,00,000 FY sales threshold: ₹0.00 (exempt).
    - Individual / HUF exceeding ₹5,00,000 threshold: 0.10% TDS.
    - Company / LLP: 0.10% TDS with NO threshold exemption (from Re 1).
    - Missing / invalid PAN: 5.00% TDS (Section 206AA).
    """
    order_gross = Decimal("10000.00")

    # 1. Individual below 5 Lakhs -> Exempt
    profile_ind_under = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="Ramesh Sharma",
        entity_type="individual",
        pan_number="ABCPR1111K",
        fy_gross_sales_amount=Decimal("100000.00"),  # Cumulative sales 1 Lakh
    )
    res1 = calculate_settlement_split(
        gross_order_value=order_gross,
        taxable_product_value=Decimal("8474.58"),
        product_cgst=Decimal("762.71"),
        product_sgst=Decimal("762.71"),
        product_igst=Decimal("0.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_ind_under,
        customer_state_code="27",
    )
    assert res1.tds_threshold_exempt is True
    assert res1.income_tax_tds_194o == Decimal("0.00")

    # 2. Individual above 5 Lakhs -> 0.10% TDS
    profile_ind_over = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="Ramesh Sharma",
        entity_type="individual",
        pan_number="ABCPR1111K",
        fy_gross_sales_amount=Decimal("550000.00"),  # Cumulative sales 5.5 Lakhs
    )
    res2 = calculate_settlement_split(
        gross_order_value=order_gross,
        taxable_product_value=Decimal("8474.58"),
        product_cgst=Decimal("762.71"),
        product_sgst=Decimal("762.71"),
        product_igst=Decimal("0.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_ind_over,
        customer_state_code="27",
    )
    assert res2.tds_threshold_exempt is False
    assert res2.tds_rate_applied == Decimal("0.10")
    assert res2.income_tax_tds_194o == Decimal("10.00")  # 0.10% of 10,000

    # 3. Company with only ₹10,000 FY sales -> 0.10% TDS from Re 1
    profile_corp = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="Tech Retail Pvt Ltd",
        entity_type="company",
        pan_number="AABCT9999K",
        fy_gross_sales_amount=Decimal("0.00"),
    )
    res3 = calculate_settlement_split(
        gross_order_value=order_gross,
        taxable_product_value=Decimal("8474.58"),
        product_cgst=Decimal("762.71"),
        product_sgst=Decimal("762.71"),
        product_igst=Decimal("0.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_corp,
        customer_state_code="27",
    )
    assert res3.tds_threshold_exempt is False
    assert res3.tds_rate_applied == Decimal("0.10")
    assert res3.income_tax_tds_194o == Decimal("10.00")

    # 4. Missing PAN -> 5.00% TDS (Section 206AA)
    profile_no_pan = MerchantTaxProfile(
        site_id=uuid4(),
        admin_id=uuid4(),
        legal_business_name="Unregistered Merchant",
        entity_type="company",
        pan_number=None,  # No PAN provided
        fy_gross_sales_amount=Decimal("0.00"),
    )
    res4 = calculate_settlement_split(
        gross_order_value=order_gross,
        taxable_product_value=Decimal("8474.58"),
        product_cgst=Decimal("762.71"),
        product_sgst=Decimal("762.71"),
        product_igst=Decimal("0.00"),
        product_cess=Decimal("0.00"),
        merchant_profile=profile_no_pan,
        customer_state_code="27",
    )
    assert res4.tds_rate_applied == Decimal("5.00")
    assert res4.income_tax_tds_194o == Decimal("500.00")  # 5% of 10,000


def test_compute_and_record_order_settlement_db(db_session: Session):
    """
    Test persistence of multi-component TenantLedgerEntry and FY sales counter update.
    """
    site_id = uuid4()
    admin_id = uuid4()
    customer_id = uuid4()

    admin = Admin(
        id=admin_id,
        email=f"merchant_{uuid4().hex[:8]}@test.com",
        name="Merchant Admin",
        role="Owner",
        is_active=True,
    )
    db_session.add(admin)

    site = Site(
        id=site_id,
        name="Test Merchant Store",
        slug=f"test-merchant-{uuid4().hex[:8]}",
        site_definition={},
    )
    db_session.add(site)

    customer = User(
        id=customer_id,
        site_id=site_id,
        email=f"customer_{uuid4().hex[:8]}@test.com",
        name="Karan Singhania",
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Mumbai Gadgets LLP",
        entity_type="llp",
        pan_number="AABCM8888K",
        gstin="27AABCM8888K1Z8",
        state_code="27",
        fy_gross_sales_amount=Decimal("50000.00"),
    )
    db_session.add(profile)
    db_session.flush()

    order_id = uuid4()
    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=customer_id,
        total=Decimal("2360.00"),
        subtotal=Decimal("2000.00"),
        tax_amount=Decimal("360.00"),
        shipping_fee=Decimal("0.00"),
        status="placed",
        payment_status="paid",
        items=[],
        shipping_address={
            "full_name": "Karan Singhania",
            "state_code": "27",
            "state": "Maharashtra",
        },
        pricing_snapshot={
            "tax": {
                "taxableAmount": 2000.0,
                "cgst": 180.0,
                "sgst": 180.0,
                "igst": 0.0,
                "cess": 0.0,
                "amount": 360.0,
            }
        },
    )
    db_session.add(order)
    db_session.commit()

    ledger = compute_and_record_order_settlement(
        session=db_session,
        order=order,
        admin_id=admin_id,
        commission_percent=Decimal("3.00"),
        razorpay_transfer_id="trf_test123",
        transfer_status="held",
        ledger_status="in_escrow",
        escrow_status="held",
    )
    db_session.commit()

    # Query from DB to verify persisted fields
    persisted_ledger = db_session.exec(
        select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order_id)
    ).first()

    assert persisted_ledger is not None
    assert persisted_ledger.entry_type == "order_sale"
    assert persisted_ledger.gross_order_value == Decimal("2360.00")
    assert persisted_ledger.taxable_product_value == Decimal("2000.00")
    assert persisted_ledger.product_cgst == Decimal("180.00")
    assert persisted_ledger.product_sgst == Decimal("180.00")
    assert persisted_ledger.platform_commission_base == Decimal("70.80")  # 3% of 2360
    assert persisted_ledger.platform_fee_gst_cgst == Decimal("6.37")      # 9% of 70.80
    assert persisted_ledger.platform_fee_gst_sgst == Decimal("6.37")      # 9% of 70.80
    assert persisted_ledger.total_platform_fee_with_gst == Decimal("83.54")
    assert persisted_ledger.gst_tcs_cgst == Decimal("5.00")               # 0.25% of 2000
    assert persisted_ledger.gst_tcs_sgst == Decimal("5.00")               # 0.25% of 2000
    assert persisted_ledger.total_gst_tcs == Decimal("10.00")
    assert persisted_ledger.tds_rate_applied == Decimal("0.10")           # LLP -> 0.1%
    assert persisted_ledger.income_tax_tds_194o == Decimal("2.36")        # 0.10% of 2360
    assert persisted_ledger.gateway_fee == Decimal("47.20")               # 2% of 2360
    assert persisted_ledger.gateway_fee_gst == Decimal("8.50")            # 18% of 47.20

    # Invariant 1 check on persisted row
    total_deductions = (
        persisted_ledger.total_platform_fee_with_gst
        + persisted_ledger.total_gst_tcs
        + persisted_ledger.income_tax_tds_194o
        + persisted_ledger.gateway_fee
        + persisted_ledger.gateway_fee_gst
    )
    assert persisted_ledger.net_merchant_payout + total_deductions == persisted_ledger.gross_order_value

    # Verify profile FY gross sales was incremented
    db_session.refresh(profile)
    assert profile.fy_gross_sales_amount == Decimal("52360.00")  # 50,000 + 2,360
