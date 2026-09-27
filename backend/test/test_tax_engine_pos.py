"""
Automated Unit Tests for Tax Engine & Place of Supply (PoS)
Statutory Standard: CGST Act 2017 & IGST Act 2017
"""
from decimal import Decimal
import pytest

from services.tax_engine import (
    LineItemTaxInput,
    calculate_line_item_tax,
    calculate_cart_taxes,
    money,
)


def test_pos_intra_state_split():
    """Origin 27 (MH) to Dest 27 (MH) -> Exactly 50/50 CGST and SGST, 0 IGST."""
    item = LineItemTaxInput(
        item_id="item-1",
        product_name="Cotton Shirt",
        hsn_code="61091000",
        unit_price=Decimal("1000.00"),
        quantity=1,
        is_inclusive=False,
        gst_rate=Decimal("18.00"),
    )

    res = calculate_line_item_tax(
        item=item,
        origin_state_code="27",
        destination_state_code="27",
    )

    assert not res.is_interstate
    assert res.taxable_amount == Decimal("1000.00")
    assert res.cgst_rate == Decimal("9.00")
    assert res.sgst_rate == Decimal("9.00")
    assert res.igst_rate == Decimal("0.00")
    assert res.cgst_amount == Decimal("90.00")
    assert res.sgst_amount == Decimal("90.00")
    assert res.igst_amount == Decimal("0.00")
    assert res.total_tax == Decimal("180.00")
    assert res.final_line_total == Decimal("1180.00")


def test_pos_inter_state_split():
    """Origin 27 (MH) to Dest 29 (KA) -> 100% IGST, 0 CGST and SGST."""
    item = LineItemTaxInput(
        item_id="item-2",
        product_name="Leather Bag",
        hsn_code="42022210",
        unit_price=Decimal("2360.00"),
        quantity=1,
        is_inclusive=True,  # MRP inclusive
        gst_rate=Decimal("18.00"),
    )

    res = calculate_line_item_tax(
        item=item,
        origin_state_code="27",
        destination_state_code="29",
    )

    assert res.is_interstate
    # 2360 / 1.18 = 2000.00
    assert res.taxable_amount == Decimal("2000.00")
    assert res.total_tax == Decimal("360.00")
    assert res.igst_rate == Decimal("18.00")
    assert res.igst_amount == Decimal("360.00")
    assert res.cgst_amount == Decimal("0.00")
    assert res.sgst_amount == Decimal("0.00")
    assert res.final_line_total == Decimal("2360.00")


def test_inclusive_mrp_extraction_precision():
    """Validates penny-perfect rounding: Rs 105 at 5% GST -> Rs 100.00 taxable, Rs 5.00 tax."""
    item = LineItemTaxInput(
        item_id="item-3",
        product_name="Cotton Hanky",
        hsn_code="61091000",
        unit_price=Decimal("105.00"),
        quantity=1,
        is_inclusive=True,
        gst_rate=Decimal("5.00"),
    )

    res = calculate_line_item_tax(
        item=item,
        origin_state_code="27",
        destination_state_code="27",
    )

    assert res.taxable_amount == Decimal("100.00")
    assert res.total_tax == Decimal("5.00")
    assert res.cgst_amount == Decimal("2.50")
    assert res.sgst_amount == Decimal("2.50")
    assert res.final_line_total == Decimal("105.00")


def test_composition_and_unregistered_zero_tax():
    """Composition and unregistered sellers cannot charge tax (Bill of Supply)."""
    item = LineItemTaxInput(
        item_id="item-4",
        product_name="Handicraft Toy",
        hsn_code="95030010",
        unit_price=Decimal("500.00"),
        quantity=2,
        is_inclusive=True,
        gst_rate=Decimal("12.00"),
    )

    res = calculate_line_item_tax(
        item=item,
        origin_state_code="27",
        destination_state_code="27",
        is_composition=True,
    )

    assert res.taxable_amount == Decimal("1000.00")
    assert res.total_tax == Decimal("0.00")
    assert res.cgst_amount == Decimal("0.00")
    assert res.sgst_amount == Decimal("0.00")
    assert res.final_line_total == Decimal("1000.00")


def test_composite_cart_with_shipping():
    """Cart with 2 items and composite shipping tax."""
    items = [
        LineItemTaxInput(
            item_id="item-a",
            product_name="Shirt",
            hsn_code="61091000",
            unit_price=Decimal("1000.00"),
            quantity=2,
            is_inclusive=False,
            gst_rate=Decimal("18.00"),
        ),
        LineItemTaxInput(
            item_id="item-b",
            product_name="Book",
            hsn_code="49011010",
            unit_price=Decimal("300.00"),
            quantity=1,
            is_inclusive=True,
            gst_rate=Decimal("0.00"),  # Nil rated
        ),
    ]

    cart_res = calculate_cart_taxes(
        items=items,
        origin_state_code="27",
        destination_state_code="27",
        shipping_charge=Decimal("118.00"),
        shipping_inclusive=True,
    )

    assert not cart_res.is_interstate
    # Item A: 2000 taxable + 360 tax (180 CGST, 180 SGST)
    # Item B: 300 taxable + 0 tax
    assert cart_res.taxable_subtotal == Decimal("2300.00")
    assert cart_res.cgst_total == Decimal("180.00")
    assert cart_res.sgst_total == Decimal("180.00")
    assert cart_res.igst_total == Decimal("0.00")

    # Shipping composite: Rs 118 inclusive at 18% -> Rs 100 taxable, Rs 18 tax (9 CGST, 9 SGST)
    assert cart_res.shipping_taxable == Decimal("100.00")
    assert cart_res.shipping_cgst == Decimal("9.00")
    assert cart_res.shipping_sgst == Decimal("9.00")
    assert cart_res.shipping_gross == Decimal("118.00")

    # Grand total: (2000 + 360) + 300 + 118 = 2778.00
    assert cart_res.grand_total == Decimal("2778.00")
