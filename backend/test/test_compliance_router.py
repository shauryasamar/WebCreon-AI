import pytest
from decimal import Decimal
from uuid import uuid4
from sqlmodel import Session, select
from fastapi.testclient import TestClient

from main import app
from db.database import engine, get_session
from auth_middleware import authenticate_admin
from models import (
    Admin,
    MerchantTaxProfile,
    Order,
    Site,
    TaxMaster,
    TenantLedgerEntry,
    User,
)


@pytest.fixture(name="db_session")
def session_fixture():
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(db_session: Session):
    admin_id = uuid4()
    admin_obj = Admin(
        id=admin_id,
        email=f"compliance_admin_{uuid4().hex[:8]}@webcreon.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    db_session.add(admin_obj)
    db_session.commit()


    mock_admin = {
        "adminId": str(admin_id),
        "email": "compliance_admin@webcreon.com",
        "role": "Owner",
        "permissions": ["*"],
    }

    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[authenticate_admin] = lambda: mock_admin

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_tax_kyc_pan_and_gstin_validation(client: TestClient, db_session: Session):
    """
    Validates structural checks:
    - Invalid PAN rejected
    - GSTIN mismatching PAN rejected
    - GSTIN mismatching state rejected
    - Valid submission successfully verified
    """
    site_id = uuid4()
    site = Site(id=site_id, name="KYC Test Store", slug=f"kyc-store-{uuid4().hex[:8]}", site_definition={})
    db_session.add(site)
    db_session.commit()

    # 1. Invalid PAN
    resp1 = client.post(
        "/compliance/tax-kyc",
        json={
            "site_id": str(site_id),
            "legal_business_name": "Test Entity",
            "pan_number": "INVALID123",
            "state_code": "27",
        },
    )
    assert resp1.status_code == 422

    # 2. GSTIN with mismatched PAN
    resp2 = client.post(
        "/compliance/tax-kyc",
        json={
            "site_id": str(site_id),
            "legal_business_name": "Test Entity",
            "pan_number": "AABCT1234K",
            "gstin": "27XYZAB9999K1Z5",  # Different PAN in GSTIN
            "state_code": "27",
        },
    )
    assert resp2.status_code == 400
    assert "does not match provided PAN" in resp2.json()["detail"]

    # 3. GSTIN with mismatched State Code
    resp3 = client.post(
        "/compliance/tax-kyc",
        json={
            "site_id": str(site_id),
            "legal_business_name": "Test Entity",
            "pan_number": "AABCT1234K",
            "gstin": "29AABCT1234K1Z5",  # State 29 (KA)
            "state_code": "27",          # Registered State 27 (MH)
        },
    )
    assert resp3.status_code == 400
    assert "does not match registered State Code" in resp3.json()["detail"]

    # 4. Valid Submission
    resp4 = client.post(
        "/compliance/tax-kyc",
        json={
            "site_id": str(site_id),
            "legal_business_name": "Omkar Retails Pvt Ltd",
            "entity_type": "company",
            "registration_type": "regular",
            "pan_number": "AABCO1234K",
            "gstin": "27AABCO1234K1Z1",
            "state_code": "27",
            "state_name": "Maharashtra",
            "city": "Pune",
            "pincode": "411001",
        },
    )
    assert resp4.status_code == 200
    data = resp4.json()
    assert data["profile"]["is_pan_verified"] is True
    assert data["profile"]["is_gstin_verified"] is True
    assert data["profile"]["pan_number"] == "AABCO1234K"
    assert data["profile"]["gstin"] == "27AABCO1234K1Z1"


def test_get_merchant_tax_kyc_progress(client: TestClient, db_session: Session):
    """
    Tests Section 194-O threshold calculation:
    - Individual with ₹2 Lakhs sales -> 40% progress towards ₹5 Lakh threshold.
    """
    site_id = uuid4()
    admin_id = uuid4()
    admin = Admin(
        id=admin_id,
        email=f"sharma_{uuid4().hex[:8]}@example.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    db_session.add(admin)
    site = Site(id=site_id, name="Sharma Handicrafts", slug=f"sharma-crafts-{uuid4().hex[:8]}", site_definition={})
    db_session.add(site)
    db_session.flush()

    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Rajesh Sharma",
        entity_type="individual",
        pan_number="ABCPR9999K",
        state_code="27",
        fy_gross_sales_amount=Decimal("200000.00"),  # 2 Lakhs
    )
    db_session.add(profile)
    db_session.commit()

    resp = client.get(f"/compliance/tax-kyc/{site_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_profile"] is True
    sec = data["section_194o"]
    assert sec["threshold"] == 500000.0
    assert sec["cumulative_sales"] == 200000.0
    assert sec["progress_percent"] == 40.0
    assert sec["is_threshold_exceeded"] is False
    assert sec["applicable_rate"] == 0.10


def test_gstr8_table4_invariant_3(client: TestClient, db_session: Session):
    """
    GSTR-8 Table 4 ECO Return:
    Verifies Invariant 3: If a merchant's returns exceed gross supplies,
    net supplies is capped at ₹0.00 and TCS is ₹0.00 (not negative).
    """
    site_id = uuid4()
    admin_id = uuid4()
    customer_id = uuid4()

    admin = Admin(
        id=admin_id,
        email=f"return_admin_{uuid4().hex[:8]}@example.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    db_session.add(admin)
    site = Site(id=site_id, name="Return Heavy Store", slug=f"return-store-{uuid4().hex[:8]}", site_definition={})
    db_session.add(site)
    customer = User(
        id=customer_id,
        site_id=site_id,
        email=f"cust_{uuid4().hex[:8]}@example.com",
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Fashion Returns Ltd",
        entity_type="COMPANY",
        pan_number="AABCF7777K",
        gstin="27AABCF7777K1Z7",
        state_code="27",
    )
    db_session.add(profile)

    order_sale_id = uuid4()
    order_sale = Order(
        id=order_sale_id,
        site_id=site_id,
        customer_id=customer_id,
        total=Decimal("5000.00"),
        subtotal=Decimal("5000.00"),
        items=[],
    )
    db_session.add(order_sale)

    order_return_id = uuid4()
    order_return = Order(
        id=order_return_id,
        site_id=site_id,
        customer_id=customer_id,
        total=Decimal("8000.00"),
        subtotal=Decimal("8000.00"),
        items=[],
    )
    db_session.add(order_return)
    db_session.flush()

    # Order sale of ₹5,000
    sale_entry = TenantLedgerEntry(
        admin_id=admin_id,
        site_id=site_id,
        order_id=order_sale_id,
        gross_amount=Decimal("5000.00"),
        platform_fee_percent=Decimal("3.00"),
        platform_fee=Decimal("177.00"),
        tenant_share=Decimal("4823.00"),
        entry_type="order_sale",
        taxable_product_value=Decimal("5000.00"),
        gst_tcs_cgst=Decimal("12.50"),
        gst_tcs_sgst=Decimal("12.50"),
        total_gst_tcs=Decimal("25.00"),
        status="in_escrow",
    )
    db_session.add(sale_entry)

    # Return adjustment of ₹8,000 (exceeds monthly sales)
    return_entry = TenantLedgerEntry(
        admin_id=admin_id,
        site_id=site_id,
        order_id=order_return_id,
        gross_amount=Decimal("-8000.00"),
        platform_fee_percent=Decimal("3.00"),
        platform_fee=Decimal("0.00"),
        tenant_share=Decimal("-8000.00"),
        entry_type="return_adjustment",
        status="refunded",
    )
    db_session.add(return_entry)
    db_session.commit()

    # JSON report
    resp = client.get(f"/compliance/gstr8/table4?site_id={site_id}")
    assert resp.status_code == 200
    data = resp.json()
    row = data["table4_records"][0]
    assert row["gross_value_of_supplies"] == 5000.0
    assert row["value_of_supplies_returned"] == 8000.0
    # Invariant 3: net supplies capped at 0.00, TCS 0.00
    assert row["net_value_of_supplies"] == 0.0
    assert row["total_tcs"] == 0.0

    # CSV report
    resp_csv = client.get(f"/compliance/gstr8/table4?site_id={site_id}&format=csv")
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    assert "Net Value of Supplies Liable to TCS" in resp_csv.text


def test_form_26q_report(client: TestClient, db_session: Session):
    """
    Form 26Q Section 194-O quarterly TDS report.
    """
    site_id = uuid4()
    admin_id = uuid4()
    customer_id = uuid4()

    admin = Admin(
        id=admin_id,
        email=f"audio_admin_{uuid4().hex[:8]}@example.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    db_session.add(admin)
    site = Site(id=site_id, name="Audio Store", slug=f"audio-store-{uuid4().hex[:8]}", site_definition={})
    db_session.add(site)
    customer = User(
        id=customer_id,
        site_id=site_id,
        email=f"cust_{uuid4().hex[:8]}@example.com",
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Audio World",
        entity_type="COMPANY",
        pan_number="AABCA1111K",
        state_code="27",
    )
    db_session.add(profile)

    order_id = uuid4()
    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=customer_id,
        total=Decimal("10000.00"),
        subtotal=Decimal("10000.00"),
        items=[],
    )
    db_session.add(order)
    db_session.flush()

    entry = TenantLedgerEntry(
        admin_id=admin_id,
        site_id=site_id,
        order_id=order_id,
        gross_amount=Decimal("10000.00"),
        gross_order_value=Decimal("10000.00"),
        platform_fee_percent=Decimal("3.00"),
        platform_fee=Decimal("354.00"),
        tenant_share=Decimal("9600.00"),
        income_tax_tds_194o=Decimal("10.00"),
        tds_rate_applied=Decimal("0.10"),
        status="in_escrow",
    )
    db_session.add(entry)
    db_session.commit()

    resp = client.get(f"/compliance/form26q?site_id={site_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_deductees"] == 1
    assert data["total_tds_deducted"] == 10.0
    rec = data["records"][0]
    assert rec["merchant_pan"] == "AABCA1111K"
    assert rec["section_code"] == "194-O"
    assert rec["tds_rate"] == 0.10
    assert rec["tds_deducted"] == 10.0

    # CSV export
    resp_csv = client.get(f"/compliance/form26q?site_id={site_id}&format=csv")
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    assert "Deductee PAN" in resp_csv.text


def test_hsn_master_search(client: TestClient, db_session: Session):
    """
    Search TaxMaster directory by code and description.
    """
    existing_8518 = db_session.exec(select(TaxMaster).where(TaxMaster.code == "8518")).first()
    if not existing_8518:
        db_session.add(
            TaxMaster(
                code="8518",
                code_type="HSN",
                description="Microphones and stands therefor; loudspeakers; headphones",
                gst_rate=Decimal("18.00"),
                cgst_rate=Decimal("9.00"),
                sgst_rate=Decimal("9.00"),
                igst_rate=Decimal("18.00"),
                cess_rate=Decimal("0.00"),
            )
        )
    existing_6109 = db_session.exec(select(TaxMaster).where(TaxMaster.code == "6109")).first()
    if not existing_6109:
        db_session.add(
            TaxMaster(
                code="6109",
                code_type="HSN",
                description="T-shirts, singlets and other vests, knitted or crocheted",
                gst_rate=Decimal("5.00"),
                cgst_rate=Decimal("2.50"),
                sgst_rate=Decimal("2.50"),
                igst_rate=Decimal("5.00"),
                cess_rate=Decimal("0.00"),
            )
        )
    db_session.commit()

    resp = client.get("/compliance/hsn-master/search?q=headphones")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["results"][0]["code"] == "8518"
    assert data["results"][0]["gst_rate"] == 18.0
