"""
WebCreon AI: Pure Deterministic Indian GST Tax Engine
Governing Statutory Standards: CGST Act 2017, IGST Act 2017, September 2026 CBIC Rules.
Stateless, side-effect-free Decimal arithmetic with ROUND_HALF_UP precision.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


def money(val: Any) -> Decimal:
    """Coerces any numerical value to Decimal rounded to two decimal places (paise precision)."""
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    try:
        return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def extract_tax_from_mrp(
    mrp: Decimal | float | int | str,
    gst_rate: Decimal | float | int | str,
    cess_rate: Decimal | float | int | str = Decimal("0.00"),
) -> tuple[Decimal, Decimal]:
    """
    Extracts taxable base and tax amount from an inclusive MRP price.
    Formula: Base = Round(MRP / (1 + (Rate + Cess) / 100))
             Tax = MRP - Base
    """
    mrp_dec = Decimal(str(mrp))
    rate_dec = Decimal(str(gst_rate))
    cess_dec = Decimal(str(cess_rate))
    total_rate = rate_dec + cess_dec
    factor = Decimal("1.00") + (total_rate / Decimal("100.00"))
    base = money(mrp_dec / factor)
    tax = money(mrp_dec - base)
    return base, tax


class LineItemTaxInput(BaseModel):
    item_id: str
    product_name: str
    hsn_code: Optional[str] = None
    unit_price: Decimal
    quantity: int
    is_inclusive: bool = True
    gst_rate: Decimal = Decimal("18.00")
    cess_rate: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")


class LineItemTaxResult(BaseModel):
    item_id: str
    product_name: str
    hsn_code: str
    unit_price: Decimal
    quantity: int
    gross_line_total: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    gst_rate: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    cess_rate: Decimal
    cess_amount: Decimal
    total_tax: Decimal
    final_line_total: Decimal
    is_interstate: bool


class CartTaxCalculationResult(BaseModel):
    origin_state_code: str
    destination_state_code: str
    is_interstate: bool
    is_composition: bool
    is_unregistered: bool
    line_items: List[LineItemTaxResult]
    gross_items_total: Decimal
    total_discount: Decimal
    taxable_subtotal: Decimal
    cgst_total: Decimal
    sgst_total: Decimal
    igst_total: Decimal
    cess_total: Decimal
    total_tax_amount: Decimal
    shipping_taxable: Decimal
    shipping_cgst: Decimal
    shipping_sgst: Decimal
    shipping_igst: Decimal
    shipping_total_tax: Decimal
    shipping_gross: Decimal
    grand_total: Decimal
    warnings: List[str] = Field(default_factory=list)


def calculate_line_item_tax(
    item: LineItemTaxInput,
    origin_state_code: str,
    destination_state_code: str,
    is_composition: bool = False,
    is_unregistered: bool = False,
) -> LineItemTaxResult:
    """
    Computes statutory line item tax breakdown adhering to Indian GST rules.
    - If composition or unregistered: 0% tax charged to buyer (Bill of Supply).
    - If inclusive (MRP): Taxable = round((Gross - Discount) / (1 + (Rate+Cess)/100), 2).
    - Intra-state: 50% CGST + 50% SGST.
    - Inter-state: 100% IGST.
    """
    qty = max(1, item.quantity)
    unit_p = money(item.unit_price)
    raw_gross = money(unit_p * qty)
    discount = money(min(item.discount_amount, raw_gross))
    effective_gross = money(raw_gross - discount)

    clean_origin = str(origin_state_code or "").strip().zfill(2)
    clean_dest = str(destination_state_code or "").strip().zfill(2)
    is_interstate = (clean_origin != clean_dest)

    hsn = str(item.hsn_code or "999999").strip()
    rate = money(item.gst_rate)
    cess_r = money(item.cess_rate)

    # 1. Composition / Unregistered Small Seller Exception (0% Tax)
    if is_composition or is_unregistered or rate <= Decimal("0.00"):
        return LineItemTaxResult(
            item_id=item.item_id,
            product_name=item.product_name,
            hsn_code=hsn,
            unit_price=unit_p,
            quantity=qty,
            gross_line_total=raw_gross,
            discount_amount=discount,
            taxable_amount=effective_gross,
            gst_rate=Decimal("0.00"),
            cgst_rate=Decimal("0.00"),
            cgst_amount=Decimal("0.00"),
            sgst_rate=Decimal("0.00"),
            sgst_amount=Decimal("0.00"),
            igst_rate=Decimal("0.00"),
            igst_amount=Decimal("0.00"),
            cess_rate=Decimal("0.00"),
            cess_amount=Decimal("0.00"),
            total_tax=Decimal("0.00"),
            final_line_total=effective_gross,
            is_interstate=is_interstate,
        )

    # 2. Base & Tax Extraction
    total_rate_pct = rate + cess_r
    if item.is_inclusive:
        factor = Decimal("1.00") + (total_rate_pct / Decimal("100.00"))
        taxable_amount = money(effective_gross / factor)
        total_tax = money(effective_gross - taxable_amount)
        final_line_total = effective_gross
    else:
        taxable_amount = effective_gross
        total_tax = money((taxable_amount * total_rate_pct) / Decimal("100.00"))
        final_line_total = money(taxable_amount + total_tax)

    # 3. Jurisdictional Split (Intra vs Inter)
    if is_interstate:
        cgst_rate = Decimal("0.00")
        sgst_rate = Decimal("0.00")
        igst_rate = rate
        cgst_amount = Decimal("0.00")
        sgst_amount = Decimal("0.00")
        igst_amount = total_tax if cess_r <= Decimal("0.00") else money((taxable_amount * igst_rate) / Decimal("100.00"))
    else:
        cgst_rate = money(rate / Decimal("2.00"))
        sgst_rate = money(rate / Decimal("2.00"))
        igst_rate = Decimal("0.00")
        igst_amount = Decimal("0.00")

        if cess_r > Decimal("0.00"):
            base_gst_tax = money((taxable_amount * rate) / Decimal("100.00"))
            cgst_amount = money(base_gst_tax / Decimal("2.00"))
            sgst_amount = money(base_gst_tax - cgst_amount)
        else:
            cgst_amount = money(total_tax / Decimal("2.00"))
            sgst_amount = money(total_tax - cgst_amount)

    cess_amount = money(total_tax - (cgst_amount + sgst_amount + igst_amount)) if cess_r > Decimal("0.00") else Decimal("0.00")

    return LineItemTaxResult(
        item_id=item.item_id,
        product_name=item.product_name,
        hsn_code=hsn,
        unit_price=unit_p,
        quantity=qty,
        gross_line_total=raw_gross,
        discount_amount=discount,
        taxable_amount=taxable_amount,
        gst_rate=rate,
        cgst_rate=cgst_rate,
        cgst_amount=cgst_amount,
        sgst_rate=sgst_rate,
        sgst_amount=sgst_amount,
        igst_rate=igst_rate,
        igst_amount=igst_amount,
        cess_rate=cess_r,
        cess_amount=cess_amount,
        total_tax=total_tax,
        final_line_total=final_line_total,
        is_interstate=is_interstate,
    )


def calculate_cart_taxes(
    items: List[LineItemTaxInput],
    origin_state_code: str,
    destination_state_code: str,
    shipping_charge: Decimal = Decimal("0.00"),
    shipping_inclusive: bool = True,
    is_composition: bool = False,
    is_unregistered: bool = False,
) -> CartTaxCalculationResult:
    """
    Evaluates complete cart tax breakdown adhering to composite supply principles.
    Shipping attracts the GST rate of the highest-value taxable line in the order.
    """
    clean_origin = str(origin_state_code or "27").strip().zfill(2)
    clean_dest = str(destination_state_code or "27").strip().zfill(2)
    is_interstate = (clean_origin != clean_dest)

    warnings: List[str] = []
    if (is_composition or is_unregistered) and is_interstate:
        warnings.append("Inter-state supply is restricted for composition and unregistered sellers under GST.")

    line_results: List[LineItemTaxResult] = []
    highest_rate_item: Optional[LineItemTaxInput] = None
    highest_taxable_val = Decimal("-1.00")

    for itm in items:
        res = calculate_line_item_tax(
            item=itm,
            origin_state_code=clean_origin,
            destination_state_code=clean_dest,
            is_composition=is_composition,
            is_unregistered=is_unregistered,
        )
        line_results.append(res)
        if res.taxable_amount > highest_taxable_val and res.gst_rate > Decimal("0.00"):
            highest_taxable_val = res.taxable_amount
            highest_rate_item = itm

    # Aggregate item sums
    gross_items = sum((r.gross_line_total for r in line_results), Decimal("0.00"))
    total_disc = sum((r.discount_amount for r in line_results), Decimal("0.00"))
    taxable_subtotal = sum((r.taxable_amount for r in line_results), Decimal("0.00"))
    cgst_tot = sum((r.cgst_amount for r in line_results), Decimal("0.00"))
    sgst_tot = sum((r.sgst_amount for r in line_results), Decimal("0.00"))
    igst_tot = sum((r.igst_amount for r in line_results), Decimal("0.00"))
    cess_tot = sum((r.cess_amount for r in line_results), Decimal("0.00"))
    item_tax_tot = cgst_tot + sgst_tot + igst_tot + cess_tot

    # 4. Composite Shipping Tax Treatment
    ship_fee = money(shipping_charge)
    shipping_taxable = Decimal("0.00")
    ship_cgst = Decimal("0.00")
    ship_sgst = Decimal("0.00")
    ship_igst = Decimal("0.00")
    ship_tax_tot = Decimal("0.00")
    ship_gross = Decimal("0.00")

    if ship_fee > Decimal("0.00"):
        ship_rate = highest_rate_item.gst_rate if highest_rate_item else Decimal("18.00")
        if is_composition or is_unregistered or ship_rate <= Decimal("0.00"):
            shipping_taxable = ship_fee
            ship_gross = ship_fee
        else:
            if shipping_inclusive:
                ship_factor = Decimal("1.00") + (ship_rate / Decimal("100.00"))
                shipping_taxable = money(ship_fee / ship_factor)
                ship_tax_tot = money(ship_fee - shipping_taxable)
                ship_gross = ship_fee
            else:
                shipping_taxable = ship_fee
                ship_tax_tot = money((shipping_taxable * ship_rate) / Decimal("100.00"))
                ship_gross = money(shipping_taxable + ship_tax_tot)

            if is_interstate:
                ship_igst = ship_tax_tot
            else:
                ship_cgst = money(ship_tax_tot / Decimal("2.00"))
                ship_sgst = money(ship_tax_tot - ship_cgst)

    grand_total = money(sum((r.final_line_total for r in line_results), Decimal("0.00")) + ship_gross)

    return CartTaxCalculationResult(
        origin_state_code=clean_origin,
        destination_state_code=clean_dest,
        is_interstate=is_interstate,
        is_composition=is_composition,
        is_unregistered=is_unregistered,
        line_items=line_results,
        gross_items_total=money(gross_items),
        total_discount=money(total_disc),
        taxable_subtotal=money(taxable_subtotal),
        cgst_total=money(cgst_tot),
        sgst_total=money(sgst_tot),
        igst_total=money(igst_tot),
        cess_total=money(cess_tot),
        total_tax_amount=money(item_tax_tot),
        shipping_taxable=money(shipping_taxable),
        shipping_cgst=money(ship_cgst),
        shipping_sgst=money(ship_sgst),
        shipping_igst=money(ship_igst),
        shipping_total_tax=money(ship_tax_tot),
        shipping_gross=money(ship_gross),
        grand_total=money(grand_total),
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Indian GST State Code & Postal Mapping Helpers
# ---------------------------------------------------------------------------

STATE_NAME_TO_CODE: Dict[str, str] = {
    "JAMMU AND KASHMIR": "01", "JAMMU & KASHMIR": "01", "J&K": "01",
    "HIMACHAL PRADESH": "02",
    "PUNJAB": "03",
    "CHANDIGARH": "04",
    "UTTARAKHAND": "05",
    "HARYANA": "06",
    "DELHI": "07", "NEW DELHI": "07",
    "RAJASTHAN": "08",
    "UTTAR PRADESH": "09", "UP": "09",
    "BIHAR": "10",
    "SIKKIM": "11",
    "ARUNACHAL PRADESH": "12",
    "NAGALAND": "13",
    "MANIPUR": "14",
    "MIZORAM": "15",
    "TRIPURA": "16",
    "MEGHALAYA": "17",
    "ASSAM": "18",
    "WEST BENGAL": "19", "WB": "19",
    "JHARKHAND": "20",
    "ODISHA": "21", "ORISSA": "21",
    "CHHATTISGARH": "22",
    "MADHYA PRADESH": "23", "MP": "23",
    "GUJARAT": "24",
    "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "26",
    "MAHARASHTRA": "27", "MH": "27",
    "ANDHRA PRADESH": "37", "AP": "37",
    "KARNATAKA": "29",
    "GOA": "30",
    "LAKSHADWEEP": "31",
    "KERALA": "32",
    "TAMIL NADU": "33", "TN": "33",
    "PUDUCHERRY": "34", "PONDICHERRY": "34",
    "ANDAMAN AND NICOBAR ISLANDS": "35",
    "TELANGANA": "36",
    "LADAKH": "38",
    "OTHER TERRITORY": "97",
}

STATE_CODE_TO_NAME: Dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
}

PIN_PREFIX_TO_STATE_CODE: Dict[str, str] = {
    "11": "07",  # Delhi
    "12": "06",  # Haryana
    "13": "06",  # Haryana
    "14": "03",  # Punjab
    "15": "03",  # Punjab
    "16": "04",  # Chandigarh
    "17": "02",  # Himachal Pradesh
    "18": "01",  # Jammu & Kashmir
    "19": "01",  # Jammu & Kashmir / Ladakh
    "20": "09",  # UP
    "21": "09",  # UP
    "22": "09",  # UP
    "23": "09",  # UP
    "24": "05",  # Uttarakhand / UP
    "25": "09",  # UP
    "26": "05",  # Uttarakhand / UP
    "27": "09",  # UP
    "28": "09",  # UP
    "30": "08",  # Rajasthan
    "31": "08",  # Rajasthan
    "32": "08",  # Rajasthan
    "33": "08",  # Rajasthan
    "34": "08",  # Rajasthan
    "36": "24",  # Gujarat
    "37": "24",  # Gujarat
    "38": "24",  # Gujarat
    "39": "24",  # Gujarat
    "40": "27",  # Maharashtra (403 -> Goa handled below)
    "41": "27",  # Maharashtra
    "42": "27",  # Maharashtra
    "43": "27",  # Maharashtra
    "44": "27",  # Maharashtra
    "45": "23",  # Madhya Pradesh
    "46": "23",  # Madhya Pradesh
    "47": "23",  # Madhya Pradesh
    "48": "23",  # Madhya Pradesh
    "49": "22",  # Chhattisgarh
    "50": "36",  # Telangana
    "51": "37",  # Andhra Pradesh
    "52": "37",  # Andhra Pradesh
    "53": "37",  # Andhra Pradesh
    "56": "29",  # Karnataka
    "57": "29",  # Karnataka
    "58": "29",  # Karnataka
    "59": "29",  # Karnataka
    "60": "33",  # Tamil Nadu
    "61": "33",  # Tamil Nadu
    "62": "33",  # Tamil Nadu
    "63": "33",  # Tamil Nadu
    "64": "33",  # Tamil Nadu
    "67": "32",  # Kerala
    "68": "32",  # Kerala
    "69": "32",  # Kerala
    "70": "19",  # West Bengal
    "71": "19",  # West Bengal
    "72": "19",  # West Bengal
    "73": "19",  # West Bengal
    "74": "19",  # West Bengal
    "75": "21",  # Odisha
    "76": "21",  # Odisha
    "77": "21",  # Odisha
    "78": "18",  # Assam
    "79": "12",  # North-East (Arunachal, Meghalaya, etc.)
    "80": "10",  # Bihar
    "81": "10",  # Bihar
    "82": "20",  # Jharkhand
    "83": "20",  # Jharkhand
    "84": "10",  # Bihar
    "85": "10",  # Bihar
}


def resolve_gst_state_code(
    state_code: Optional[str] = None,
    state_name: Optional[str] = None,
    postal_code: Optional[str] = None,
    default: str = "27",
) -> str:
    """
    Robustly resolves a 2-digit Indian GST state code from available inputs.
    Tries in priority order:
    1. Direct 2-digit state code (01-38, 97)
    2. Normalized state name lookup
    3. Indian 6-digit PIN code prefix
    4. Safe default (Maharashtra '27')
    """
    if state_code:
        clean = str(state_code).strip().zfill(2)
        if clean.isdigit() and 1 <= int(clean) <= 97:
            return clean

    if state_name:
        clean_name = str(state_name).strip().upper()
        if clean_name in STATE_NAME_TO_CODE:
            return STATE_NAME_TO_CODE[clean_name]
        # Partial match
        for k, v in STATE_NAME_TO_CODE.items():
            if k in clean_name or clean_name in k:
                return v

    if postal_code:
        clean_pin = "".join(c for c in str(postal_code) if c.isdigit())
        if len(clean_pin) >= 3 and clean_pin.startswith("403"):
            return "30"  # Goa PINs 403xxx
        if len(clean_pin) >= 2:
            prefix = clean_pin[:2]
            if prefix in PIN_PREFIX_TO_STATE_CODE:
                return PIN_PREFIX_TO_STATE_CODE[prefix]

    return str(default).strip().zfill(2)


def get_financial_year(dt: Optional[Any] = None) -> str:
    """
    Returns standard Indian Financial Year code (e.g. '2026-27' or '26-27').
    Indian FY starts on April 1 and ends on March 31.
    """
    from datetime import datetime, timezone
    if dt is None:
        target = datetime.now(timezone.utc)
    elif isinstance(dt, datetime):
        target = dt
    else:
        target = datetime.now(timezone.utc)

    year = target.year
    month = target.month

    if month >= 4:
        start_year = year
        end_year = year + 1
    else:
        start_year = year - 1
        end_year = year

    return f"{start_year}-{str(end_year)[-2:]}"

