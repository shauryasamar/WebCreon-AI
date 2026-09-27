import pytest
from decimal import Decimal
from uuid import uuid4
from sqlmodel import Session, select

from db.database import engine
from models import (
    Admin,
    MerchantTaxProfile,
    Product,
    Site,
    TaxMaster,
)
from routers.orders import build_order_item_pricing_snapshot, evaluate_pricing


@pytest.fixture(name="mem_session")
def session_fixture():
    with Session(engine) as session:
        yield session



def test_evaluate_pricing_intra_state(mem_session: Session):
    site_id = uuid4()
    admin_id = uuid4()
    admin = Admin(
        id=admin_id,
        email=f"mh_admin_{uuid4().hex[:8]}@example.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    mem_session.add(admin)
    site = Site(id=site_id, name="Test MH Store", slug=f"test-mh-store-{uuid4().hex[:8]}", site_definition={})
    mem_session.add(site)
    mem_session.flush()

    # Merchant registered in Maharashtra (State 27)
    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="MH Fashion Private Limited",
        entity_type="COMPANY",
        pan_number="AABCM1234F",
        gstin="27AABCM1234F1Z5",
        state_code="27",
        state_name="Maharashtra",
        address_line1="123 Nariman Point",
        city="Mumbai",
        pincode="400021",
    )
    mem_session.add(profile)

    # HSN 6109_12 (12% GST)
    tax_master = mem_session.exec(select(TaxMaster).where(TaxMaster.code == "6109_12")).first()
    if not tax_master:
        tax_master = TaxMaster(
            code="6109_12",
            code_type="HSN",
            description="Apparel T-Shirt > 1000",
            gst_rate=Decimal("12.00"),
            cgst_rate=Decimal("6.00"),
            sgst_rate=Decimal("6.00"),
            igst_rate=Decimal("12.00"),
        )
        mem_session.add(tax_master)
        mem_session.flush()

    product = Product(
        site_id=site_id,
        name="Cotton Tee",
        slug=f"cotton-tee-{uuid4().hex[:8]}",
        price=Decimal("1120.00"),
        stock=50,
        in_stock=True,
        hsn_sac_id=tax_master.id,
        price_inclusive_of_gst=True,
    )
    mem_session.add(product)
    mem_session.commit()

    cart_items = [
        {
            "cart_item_id": "item-1",
            "product_id": product.id,
            "product_name": product.name,
            "unit_price": Decimal("1120.00"),
            "quantity": 1,
            "line_total": Decimal("1120.00"),
        }
    ]

    checkout_settings = {
        "charges": [
            {
                "id": "chg-ship",
                "code": "shipping_fee",
                "label": "Delivery",
                "enabled": True,
                "amountType": "fixed",
                "amountValue": 100.0,
                "refundable": True,
            }
        ],
        "taxSettings": {"enabled": True, "rate": 18.0, "applyOnShipping": True},
    }

    # Customer delivering to Pune, Maharashtra (PIN 411001) -> Intra-state
    shipping_addr = {
        "state_code": "27",
        "state": "Maharashtra",
        "postal_code": "411001",
    }

    snapshot = evaluate_pricing(
        cart_items=cart_items,
        checkout_settings=checkout_settings,
        payment_method="online",
        selected_optional_charge_ids=[],
        promo_code=None,
        site_id=site_id,
        session=mem_session,
        customer_email="buyer@example.com",
        shipping_address=shipping_addr,
    )

    tax = snapshot["tax"]
    assert tax["isInterstate"] is False
    assert tax["originState"] == "27"
    assert tax["destinationState"] == "27"
    assert tax["cgst"] > 0
    assert tax["sgst"] > 0
    assert tax["igst"] == 0.0
    assert round(abs(tax["cgst"] - tax["sgst"]), 2) <= 0.01
    assert round(tax["cgst"] + tax["sgst"], 2) == round(tax["amount"], 2)

    # Grand total check: 1120 (inclusive) + 100 shipping (inclusive) = 1220.00
    assert snapshot["total"] == 1220.00

    # Build order item snapshot check
    item_snap = build_order_item_pricing_snapshot(
        line_total=Decimal("1120.00"),
        quantity=1,
        order_subtotal=Decimal("1120.00"),
        pricing_snapshot=snapshot,
        product_id=product.id,
        cart_item_id="item-1",
    )
    assert item_snap["hsn_code"] == "6109_12"
    assert item_snap["gst_rate"] == 12.0
    assert item_snap["taxable_amount"] == 1000.00  # 1120 / 1.12 = 1000
    assert item_snap["cgst_amount"] == 60.00
    assert item_snap["sgst_amount"] == 60.00
    assert item_snap["igst_amount"] == 0.0
    assert item_snap["total_tax"] == 120.00


def test_evaluate_pricing_inter_state(mem_session: Session):
    site_id = uuid4()
    admin_id = uuid4()
    admin = Admin(
        id=admin_id,
        email=f"mhtech_{uuid4().hex[:8]}@example.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    mem_session.add(admin)
    site = Site(id=site_id, name="Test MH Store 2", slug=f"test-mh-store-2-{uuid4().hex[:8]}", site_definition={})
    mem_session.add(site)
    mem_session.flush()

    # Merchant in Maharashtra (27)
    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="MH Tech LLP",
        entity_type="llp",
        pan_number="AAFLM9999K",
        gstin="27AAFLM9999K1Z2",
        state_code="27",
    )
    mem_session.add(profile)

    # HSN 8517 (18% GST)
    tax_master = mem_session.exec(select(TaxMaster).where(TaxMaster.code == "8517")).first()
    if not tax_master:
        tax_master = TaxMaster(
            code="8517",
            code_type="HSN",
            description="Electronics Phone",
            gst_rate=Decimal("18.00"),
            cgst_rate=Decimal("9.00"),
            sgst_rate=Decimal("9.00"),
            igst_rate=Decimal("18.00"),
        )
        mem_session.add(tax_master)
        mem_session.flush()

    product = Product(
        site_id=site_id,
        name="Smartphone Model X",
        slug=f"smartphone-x-{uuid4().hex[:8]}",
        price=Decimal("11800.00"),
        stock=10,
        in_stock=True,
        hsn_sac_id=tax_master.id,
        price_inclusive_of_gst=True,
    )
    mem_session.add(product)
    mem_session.commit()

    cart_items = [
        {
            "cart_item_id": "item-2",
            "product_id": product.id,
            "product_name": product.name,
            "unit_price": Decimal("11800.00"),
            "quantity": 1,
            "line_total": Decimal("11800.00"),
        }
    ]

    checkout_settings = {"charges": [], "taxSettings": {"enabled": True, "rate": 18.0}}

    # Customer in Delhi (PIN 110001 -> State 07)
    shipping_addr = {
        "state_code": "07",
        "state": "Delhi",
        "postal_code": "110001",
    }

    snapshot = evaluate_pricing(
        cart_items=cart_items,
        checkout_settings=checkout_settings,
        payment_method="online",
        selected_optional_charge_ids=[],
        promo_code=None,
        site_id=site_id,
        session=mem_session,
        customer_email="delhi_buyer@example.com",
        shipping_address=shipping_addr,
    )

    tax = snapshot["tax"]
    assert tax["isInterstate"] is True
    assert tax["originState"] == "27"
    assert tax["destinationState"] == "07"
    assert tax["cgst"] == 0.0
    assert tax["sgst"] == 0.0
    assert tax["igst"] == 1800.00  # 11800 - (11800 / 1.18 = 10000) = 1800
    assert tax["amount"] == 1800.00


def test_evaluate_pricing_composition_dealer(mem_session: Session):
    site_id = uuid4()
    admin_id = uuid4()
    admin = Admin(
        id=admin_id,
        email=f"baker_{uuid4().hex[:8]}@example.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    mem_session.add(admin)
    site = Site(id=site_id, name="Small Baker", slug=f"small-baker-{uuid4().hex[:8]}", site_definition={})
    mem_session.add(site)
    mem_session.flush()

    # Composition dealer (0% tax to customer)
    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Baker Joe",
        entity_type="individual",
        pan_number="ABCDE1234F",
        state_code="27",
        is_composition_dealer=True,
        registration_type="composition",
    )
    mem_session.add(profile)
    mem_session.commit()

    product = Product(
        site_id=site_id,
        name="Chocolate Cake",
        slug=f"choco-cake-{uuid4().hex[:8]}",
        price=Decimal("500.00"),
        stock=20,
        in_stock=True,
    )
    mem_session.add(product)
    mem_session.commit()

    cart_items = [
        {
            "cart_item_id": "cake-1",
            "product_id": product.id,
            "product_name": product.name,
            "unit_price": Decimal("500.00"),
            "quantity": 1,
            "line_total": Decimal("500.00"),
        }
    ]

    snapshot = evaluate_pricing(
        cart_items=cart_items,
        checkout_settings={"charges": [], "taxSettings": {"enabled": True, "rate": 18.0}},
        payment_method="online",
        selected_optional_charge_ids=[],
        promo_code=None,
        site_id=site_id,
        session=mem_session,
        shipping_address={"state_code": "27"},
    )

    tax = snapshot["tax"]
    assert tax["isComposition"] is True
    assert tax["amount"] == 0.0
    assert snapshot["total"] == 500.00
