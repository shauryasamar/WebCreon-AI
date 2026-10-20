import os
import pytest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
from sqlmodel import Session

from db.database import engine
from models import (
    Admin,
    InvoiceSequence,
    MerchantTaxProfile,
    Order,
    OrderItem,
    ReturnItem,
    ReturnRequest,
    Site,
    TaxCreditNote,
    TaxInvoice,
    User,
)
from services.invoice_sequencer import get_next_sequence_number
from services.pdf_invoice_service import (
    generate_rule46_invoice_pdf,
    generate_rule54_credit_note_pdf,
    issue_tax_credit_note_for_return,
    issue_tax_invoice_for_order,
)


@pytest.fixture(name="db_session")
def session_fixture():
    with Session(engine) as session:
        yield session



def test_rule46_sequential_numbering(db_session: Session):
    """
    Test Rule 46(b) sequential number generation:
    - Max 16 characters
    - Monotonically incrementing without gaps
    - Independent sequences for different doc types and FYs
    """
    site_id = uuid4()

    seq1, num1 = get_next_sequence_number(db_session, site_id, "TAX_INVOICE", "2026-2027")
    assert seq1 == 1
    assert num1 == "INV/26-27/000001"
    assert len(num1) <= 16

    seq2, num2 = get_next_sequence_number(db_session, site_id, "TAX_INVOICE", "2026-2027")
    assert seq2 == 2
    assert num2 == "INV/26-27/000002"
    assert len(num2) <= 16

    # Credit note should have its own independent sequence
    seq_cn1, num_cn1 = get_next_sequence_number(db_session, site_id, "CREDIT_NOTE", "2026-2027")
    assert seq_cn1 == 1
    assert num_cn1 == "CN/26-27/000001"
    assert len(num_cn1) <= 16

    # Different site should have independent sequence
    site_id_2 = uuid4()
    seq_other, num_other = get_next_sequence_number(db_session, site_id_2, "TAX_INVOICE", "2026-2027")
    assert seq_other == 1
    assert num_other == "INV/26-27/000001"


def test_issue_tax_invoice_and_pdf(db_session: Session, tmp_path):
    """
    Test issuing a complete Rule 46 Tax Invoice and generating its PDF.
    """
    site_id = uuid4()
    admin_id = uuid4()
    customer_id = uuid4()

    admin = Admin(
        id=admin_id,
        email=f"artisan_{uuid4().hex[:8]}@example.com",
        name="Artisan Admin",
        role="Owner",
        is_active=True,
    )
    db_session.add(admin)

    site = Site(
        id=site_id,
        name="Artisan Crafts",
        slug=f"artisan-crafts-{uuid4().hex[:8]}",
        site_definition={},
    )
    db_session.add(site)

    customer = User(
        id=customer_id,
        site_id=site_id,
        email=f"customer_{uuid4().hex[:8]}@example.com",
        name="Rohan Sharma",
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Artisan Crafts LLP",
        entity_type="llp",
        pan_number="AAACL1111K",
        gstin="27AAACL1111K1Z1",
        state_code="27",
        state_name="Maharashtra",
        address_line1="101 Kala Ghoda",
        city="Mumbai",
        pincode="400001",
        is_gst_registered=True,
    )
    db_session.add(profile)
    db_session.flush()

    order_id = uuid4()
    order = Order(
        id=order_id,
        site_id=site_id,
        customer_id=customer_id,
        total=Decimal("1180.00"),
        subtotal=Decimal("1000.00"),
        tax_amount=Decimal("180.00"),
        shipping_fee=Decimal("0.00"),
        status="placed",
        payment_status="paid",
        shipping_address={
            "full_name": "Rohan Sharma",
            "address_line1": "45 Brigade Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
        },
        items=[
            {
                "product_id": str(uuid4()),
                "product_name": "Handmade Silk Scarf",
                "quantity": 1,
                "unit_price": 1000.0,
                "line_total": 1180.0,
                "hsn_code": "5007",
            }
        ],
        pricing_snapshot={
            "pricing_details": {
                "taxable_amount": 1000.0,
                "cgst_amount": 0.0,
                "sgst_amount": 0.0,
                "igst_amount": 180.0,
                "cess_amount": 0.0,
                "total_tax": 180.0,
                "is_interstate": True,
                "customer_state_code": "29",
                "merchant_state_code": "27",
            }
        },
    )
    db_session.add(order)
    db_session.commit()

    # Issue Tax Invoice
    invoice = issue_tax_invoice_for_order(db_session, order, save_pdf=False)
    assert invoice is not None
    assert invoice.invoice_number == "INV/26-27/000001"
    assert invoice.supplier_gstin == "27AAACL1111K1Z1"
    assert invoice.supplier_legal_name == "Artisan Crafts LLP"
    assert invoice.recipient_name == "Rohan Sharma"
    assert invoice.place_of_supply_state_code == "29"
    assert invoice.taxable_value == Decimal("1000.00")
    assert invoice.igst_amount == Decimal("180.00")
    assert invoice.cgst_amount == Decimal("0.00")
    assert invoice.sgst_amount == Decimal("0.00")
    assert invoice.total_invoice_value == Decimal("1180.00")

    # Generate PDF
    pdf_out = str(tmp_path / "test_rule46_invoice.pdf")
    generate_rule46_invoice_pdf(invoice, output_path=pdf_out)
    assert os.path.exists(pdf_out)
    assert os.path.getsize(pdf_out) > 1000  # valid non-empty PDF


def test_issue_tax_credit_note_and_pdf(db_session: Session, tmp_path):
    """
    Test issuing a Rule 54 Tax Credit Note linked to an original invoice.
    """
    site_id = uuid4()
    admin_id = uuid4()
    customer_id = uuid4()

    admin = Admin(
        id=admin_id,
        email=f"tech_{uuid4().hex[:8]}@example.com",
        name="Tech Admin",
        role="Owner",
        is_active=True,
    )
    db_session.add(admin)

    site = Site(
        id=site_id,
        name="Tech Store",
        slug=f"tech-store-{uuid4().hex[:8]}",
        site_definition={},
    )
    db_session.add(site)

    customer = User(
        id=customer_id,
        site_id=site_id,
        email=f"customer_{uuid4().hex[:8]}@example.com",
        name="Pooja Mehta",
        is_active=True,
    )
    db_session.add(customer)
    db_session.flush()

    profile = MerchantTaxProfile(
        site_id=site_id,
        admin_id=admin_id,
        legal_business_name="Tech Solutions Ltd",
        entity_type="COMPANY",
        pan_number="AABCT9999P",
        gstin="27AABCT9999P1Z9",
        state_code="27",
        state_name="Maharashtra",
        address_line1="Tech Park, Bandra",
        city="Mumbai",
        pincode="400051",
        is_gst_registered=True,
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
        shipping_address={
            "full_name": "Pooja Mehta",
            "address_line1": "Marine Drive",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400020",
        },
        items=[
            {
                "product_id": str(uuid4()),
                "product_name": "Wireless Headphones",
                "quantity": 2,
                "unit_price": 1000.0,
                "line_total": 2360.0,
                "hsn_code": "8518",
            }
        ],
        pricing_snapshot={
            "pricing_details": {
                "taxable_amount": 2000.0,
                "cgst_amount": 180.0,
                "sgst_amount": 180.0,
                "igst_amount": 0.0,
                "cess_amount": 0.0,
                "total_tax": 360.0,
                "is_interstate": False,
                "customer_state_code": "27",
                "merchant_state_code": "27",
            }
        },
    )
    db_session.add(order)
    db_session.commit()

    # Create OrderItem
    order_item_id = uuid4()
    order_item = OrderItem(
        id=order_item_id,
        order_id=order_id,
        site_id=site_id,
        product_name="Wireless Headphones",
        unit_price=Decimal("1000.00"),
        quantity=2,
        line_total=Decimal("2000.00"),
        status="placed",
    )
    db_session.add(order_item)
    db_session.flush()

    # Pre-create invoice
    orig_invoice = issue_tax_invoice_for_order(db_session, order, save_pdf=False)
    assert orig_invoice.invoice_number == "INV/26-27/000001"

    # Create partial return request (1 of 2 units returned -> ₹1,180 refund)
    return_req_id = uuid4()
    return_req = ReturnRequest(
        id=return_req_id,
        site_id=site_id,
        order_id=order_id,
        customer_id=order.customer_id,
        status="refunded",
        refund_status="processed",
        suggested_refund_amount=Decimal("1180.00"),
        final_refund_amount=Decimal("1180.00"),
        refund_override_reason="Customer returned 1 defective item",
        created_at=datetime.now(timezone.utc),
        refunded_at=datetime.now(timezone.utc),
    )
    db_session.add(return_req)
    db_session.flush()

    return_item = ReturnItem(
        return_request_id=return_req_id,
        site_id=site_id,
        order_id=order_id,
        order_item_id=order_item_id,
        product_id=None,
        product_name="Wireless Headphones",
        quantity_requested=1,
        quantity_approved=1,
        quantity_received=1,
        reason_code="damaged",
        unit_price_paid=Decimal("1000.00"),
        line_refund_suggested=Decimal("1180.00"),
        line_refund_final=Decimal("1180.00"),
    )
    db_session.add(return_item)
    db_session.commit()

    # Issue Tax Credit Note
    credit_note = issue_tax_credit_note_for_return(db_session, return_req, save_pdf=False)
    assert credit_note is not None
    assert credit_note.credit_note_number == "CN/26-27/000001"
    assert credit_note.original_invoice_id == orig_invoice.id
    assert credit_note.total_credit_value == Decimal("1180.00")
    # 50% refund -> 50% reversed tax
    assert credit_note.taxable_value == Decimal("1000.00")
    assert credit_note.cgst_amount == Decimal("90.00")
    assert credit_note.sgst_amount == Decimal("90.00")
    assert credit_note.igst_amount == Decimal("0.00")

    # Generate Credit Note PDF
    pdf_out = str(tmp_path / "test_rule54_credit_note.pdf")
    generate_rule54_credit_note_pdf(credit_note, orig_invoice, output_path=pdf_out)
    assert os.path.exists(pdf_out)
    assert os.path.getsize(pdf_out) > 1000


def test_invoice_sequence_real_postgres_concurrency():
    """
    Directly tests SELECT ... FOR UPDATE row-locking against the real PostgreSQL database.
    Spawns 20 concurrent threads all requesting next sequence number for the same site & FY.
    Verifies 20 unique numbers generated from 1 to 20 with zero duplicates and zero gaps.
    """
    concurrency_site_id = uuid4()
    results = []

    def get_num():
        with Session(engine) as session:
            val, formatted = get_next_sequence_number(session, concurrency_site_id, "TAX_INVOICE", "2026-2027")
            session.commit()
            return val, formatted

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(get_num) for _ in range(20)]
        for f in futures:
            results.append(f.result())

    generated_values = [r[0] for r in results]
    assert len(generated_values) == 20
    assert len(set(generated_values)) == 20, f"Duplicates found in PostgreSQL concurrency: {generated_values}"
    assert sorted(generated_values) == list(range(1, 21))
