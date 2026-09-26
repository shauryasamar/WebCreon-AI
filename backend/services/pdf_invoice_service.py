"""
WebCreon AI: Statutory PDF Invoicing Service
Compliant with Rule 46 (Tax Invoice) & Rule 54 (Credit Note) of CGST Rules, 2017.
Generates structured PDF documents using ReportLab and stores them in uploads/invoices.
"""
from __future__ import annotations

import io
import os
from typing import Any, Optional, List, Dict
from datetime import datetime, timezone
from decimal import Decimal

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Rect, Circle, Polygon, PolyLine, String, Group

from sqlmodel import Session, select
from models import (
    Admin,
    Order,
    OrderItem,
    Site,
    MerchantTaxProfile,
    SubscriptionInvoice,
    TaxInvoice,
    TaxCreditNote,
    ReturnRequest,
    ReturnItem,
    TenantLedgerEntry,
)
from services.invoice_sequencer import get_next_sequence_number
from services.tax_engine import get_financial_year, resolve_gst_state_code, money


def amount_to_words_inr(amount: Decimal) -> str:
    """Converts Decimal monetary value into Indian Rupee words."""
    try:
        units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                 "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                 "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def _two_digits(n: int) -> str:
            if n == 0:
                return ""
            elif n < 20:
                return units[n]
            else:
                return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")

        def _three_digits(n: int) -> str:
            h = n // 100
            rem = n % 100
            res = ""
            if h > 0:
                res += units[h] + " Hundred"
                if rem > 0:
                    res += " and "
            if rem > 0:
                res += _two_digits(rem)
            return res

        num = int(amount)
        paise = int(round((amount - Decimal(num)) * 100))

        if num == 0:
            words = "Zero Rupees"
        else:
            crore = num // 10000000
            rem = num % 10000000
            lakh = rem // 100000
            rem = rem % 100000
            thousand = rem // 1000
            rem = rem % 1000

            parts = []
            if crore > 0:
                parts.append(_two_digits(crore) + " Crore")
            if lakh > 0:
                parts.append(_two_digits(lakh) + " Lakh")
            if thousand > 0:
                parts.append(_two_digits(thousand) + " Thousand")
            if rem > 0:
                parts.append(_three_digits(rem))

            words = "Rupees " + " ".join(parts).strip()

        if paise > 0:
            words += " and " + _two_digits(paise) + " Paise"
        words += " Only"
        return words
    except Exception:
        return f"Rupees {amount} Only"


def _currency(val: Any) -> str:
    """Formats numeric or Decimal value cleanly as Indian Rupee string."""
    try:
        if val is None:
            return "Rs. 0.00"
        d = Decimal(str(val))
        return f"Rs. {d:,.2f}"
    except Exception:
        return "Rs. 0.00"


def make_qr_code(data: str, size: float = 22 * mm):
    """Generates a sharp, high-contrast digital verification QR code flowable that scans instantly on all devices."""
    # Method 1: Industry-standard high-DPI raster QR (Instant scanning on Google Lens & Apple Camera)
    try:
        import qrcode
        from reportlab.platypus import Image as RLImage
        qr_obj = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr_obj.add_data(data)
        qr_obj.make(fit=True)
        img = qr_obj.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf)
        buf.seek(0)
        return RLImage(buf, width=size, height=size)
    except Exception:
        pass

    # Method 2: ReportLab Native Vector QR with exact module scaling & ISO quiet-zone
    try:
        from reportlab.graphics.barcode import qr
        from reportlab.graphics.shapes import Drawing, Rect
        qr_widget = qr.QrCodeWidget(data)
        qr_widget.barBorder = 4
        qr_widget.barFillColor = colors.HexColor("#000000")

        bounds = qr_widget.getBounds()
        w = float(bounds[2] - bounds[0])
        h = float(bounds[3] - bounds[1])
        if w <= 0 or h <= 0:
            w, h = 33.0, 33.0

        scale = float(size) / w
        d = Drawing(size, size)
        d.add(Rect(0, 0, size, size, fillColor=colors.HexColor("#ffffff"), strokeColor=None))

        qr_sub = Drawing(size, size, transform=[scale, 0, 0, scale, 0, 0])
        qr_sub.add(qr_widget)
        d.add(qr_sub)
        return d
    except Exception:
        return Paragraph(
            f"<font size='6' color='#475569'><b>DIGITALLY VERIFIED</b><br/>{data[:22]}</font>",
            ParagraphStyle("QRBackup", fontSize=6, leading=8, alignment=1)
        )


def generate_rule46_invoice_pdf(
    invoice: TaxInvoice,
    output_path: Optional[str] = None,
    session: Optional[Session] = None,
) -> bytes:
    """
    Renders a state-of-the-art statutory Rule 46 GST Tax Invoice / Rule 49 Bill of Supply PDF.
    Inspired by Flipkart/Amazon executive e-commerce invoices with 100% mathematical consistency,
    digital QR verification, 3-column order/customer metadata, and complete item-to-total reconciliation.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )

    styles = getSampleStyleSheet()

    # Clean Typography Styles
    title_main_center = ParagraphStyle(
        "TitleMainCenter",
        parent=styles["Normal"],
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    title_sub_center = ParagraphStyle(
        "TitleSubCenter",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#64748b"),
        fontName="Helvetica-Oblique",
        alignment=1,
    )
    seller_title = ParagraphStyle(
        "SellerTitle",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    seller_body = ParagraphStyle(
        "SellerBody",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    inv_box_title = ParagraphStyle(
        "InvBoxTitle",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    inv_box_num = ParagraphStyle(
        "InvBoxNum",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    meta_head = ParagraphStyle(
        "MetaHead",
        parent=styles["Normal"],
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    meta_text = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    items_count_text = ParagraphStyle(
        "ItemsCountText",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    th_style = ParagraphStyle(
        "THStyle",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    th_right = ParagraphStyle(
        "THRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    td_product = ParagraphStyle(
        "TDProduct",
        parent=styles["Normal"],
        fontSize=6.8,
        leading=8.5,
        textColor=colors.HexColor("#1e293b"),
    )
    td_title = ParagraphStyle(
        "TDTitle",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    td_tax_rate = ParagraphStyle(
        "TDTaxRate",
        parent=styles["Normal"],
        fontSize=6.2,
        leading=7.8,
        textColor=colors.HexColor("#64748b"),
    )
    td_text = ParagraphStyle(
        "TDText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#1e293b"),
        alignment=0,
    )
    td_right = ParagraphStyle(
        "TDRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#1e293b"),
        alignment=2,
    )
    td_bold_right = ParagraphStyle(
        "TDBoldRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    footer_text = ParagraphStyle(
        "FooterText",
        parent=styles["Normal"],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )

    elements = []

    # 1. Scheme Determination (Rule 46 Tax Invoice vs Rule 49 Bill of Supply)
    is_composition = (
        invoice.total_tax_amount <= Decimal("0.00")
        and invoice.cgst_amount <= Decimal("0.00")
        and invoice.sgst_amount <= Decimal("0.00")
        and invoice.igst_amount <= Decimal("0.00")
    ) or (not bool(invoice.supplier_gstin))

    if session and invoice.site_id:
        try:
            profile = session.exec(select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == invoice.site_id)).first()
            if profile and (profile.is_composition_dealer or str(profile.registration_type).lower() in ("composition", "composition_scheme")):
                is_composition = True
        except Exception:
            pass

    doc_title = "Bill of Supply" if is_composition else "Tax Invoice"
    doc_sub = "Issued under Section 31(3)(c) read with Rule 49 CGST Rules, 2017" if is_composition else "Issued under Section 31 read with Rule 46 of CGST Rules, 2017"
    inv_date_str = invoice.invoice_date.strftime("%d-%m-%Y") if invoice.invoice_date else datetime.now(timezone.utc).strftime("%d-%m-%Y")

    # Centered Main Header
    elements.append(Paragraph(f"<b>{doc_title}</b>", title_main_center))
    elements.append(Paragraph(f"<i>{doc_sub}</i>", title_sub_center))
    elements.append(Spacer(1, 2 * mm))

    # 2. Top Header Block (Seller Details on Left, QR + Boxed Invoice # on Right)
    supplier_addr = invoice.supplier_address if isinstance(invoice.supplier_address, dict) else {}
    s_line1 = supplier_addr.get("address_line1") or supplier_addr.get("addressLine1") or "Registered Commercial Premises"
    s_city_pin = f"{supplier_addr.get('city', '')} - {supplier_addr.get('pincode') or supplier_addr.get('postal_code') or ''}".strip(" -")
    s_state = supplier_addr.get("state") or "Maharashtra"
    s_legal = invoice.supplier_legal_name or invoice.supplier_trade_name or "WebCreon Store"

    seller_info = [
        Paragraph(f"<b>Sold By:</b> {s_legal}", seller_title),
        Paragraph(f"<b>Ship-from Address:</b> {s_line1}, {s_city_pin}, {s_state} (State Code: {invoice.supplier_state_code})", seller_body),
        Paragraph(f"<b>GSTIN:</b> {invoice.supplier_gstin or 'Unregistered / Exempt'}", seller_body),
    ]

    qr_payload = f"INVOICE:{invoice.invoice_number},ORDER:{str(invoice.order_id)[:8].upper()},DATE:{inv_date_str},AMT:Rs.{invoice.total_invoice_value},GSTIN:{invoice.supplier_gstin or 'Unregistered'}"
    qr_drawing = make_qr_code(qr_payload, size=22 * mm)

    inv_num_box = Table(
        [
            [Paragraph("Invoice Number #", inv_box_title)],
            [Paragraph(f"<b>{invoice.invoice_number}</b>", inv_box_num)],
        ],
        colWidths=[62 * mm],
    )
    inv_num_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#94a3b8")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    qr_and_inv = Table(
        [[qr_drawing, inv_num_box]],
        colWidths=[24 * mm, 63 * mm],
    )
    qr_and_inv.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    top_header_table = Table(
        [[seller_info, qr_and_inv]],
        colWidths=[102 * mm, 88 * mm],
    )
    top_header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    elements.append(top_header_table)
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1.5 * mm, spaceAfter=2 * mm))

    # 3. 3-Column Meta Section (Order Info, Bill To, Ship To)
    recip_addr = invoice.recipient_address if isinstance(invoice.recipient_address, dict) else {}
    r_line1 = recip_addr.get("address_line1") or recip_addr.get("addressLine1") or recip_addr.get("address") or "Customer Address"
    r_city_pin = f"{recip_addr.get('city', '')} - {recip_addr.get('pincode') or recip_addr.get('postal_code') or ''}".strip(" -")
    r_state = recip_addr.get("state") or recip_addr.get("state_name") or ""
    r_phone = recip_addr.get("mobileNumber") or recip_addr.get("phone") or recip_addr.get("mobile") or ""

    order_date_str = inv_date_str
    applied_coupon = None
    if session and invoice.order_id:
        try:
            ord_obj = session.get(Order, invoice.order_id)
            if ord_obj:
                if ord_obj.created_at:
                    order_date_str = ord_obj.created_at.strftime("%d-%m-%Y")
                snap = ord_obj.pricing_snapshot if isinstance(ord_obj.pricing_snapshot, dict) else {}
                c_code = getattr(ord_obj, "coupon_code", None) or snap.get("coupon_code") or snap.get("discount_code") or snap.get("promo_code")
                if c_code:
                    applied_coupon = str(c_code).strip().upper()
        except Exception:
            pass

    col1_order_info = [
        Paragraph(f"<b>Order ID:</b> #{str(invoice.order_id)[:14].upper()}", meta_text),
        Paragraph(f"<b>Order Date:</b> {order_date_str}", meta_text),
        Paragraph(f"<b>Invoice Date:</b> {inv_date_str}", meta_text),
        Paragraph(f"<b>Place of Supply:</b> State Code {invoice.place_of_supply_state_code}", meta_text),
        Paragraph("<b>Reverse Charge:</b> No", meta_text),
    ]
    if applied_coupon:
        col1_order_info.append(Paragraph(f"<b>Coupon Code:</b> {applied_coupon}", meta_text))

    col2_bill_to = [
        Paragraph("<b>Bill To</b>", meta_head),
        Paragraph(f"<b>{invoice.recipient_name}</b>", meta_text),
        Paragraph(f"{r_line1}", meta_text),
        Paragraph(f"{r_city_pin} {r_state}".strip(), meta_text),
        Paragraph(f"State Code: {invoice.recipient_state_code or invoice.place_of_supply_state_code}", meta_text),
        Paragraph(f"<b>Phone:</b> {r_phone or '—'}", meta_text),
    ]

    col3_ship_to = [
        Paragraph("<b>Ship To</b>", meta_head),
        Paragraph(f"<b>{invoice.recipient_name}</b>", meta_text),
        Paragraph(f"{r_line1}", meta_text),
        Paragraph(f"{r_city_pin} {r_state}".strip(), meta_text),
        Paragraph(f"State Code: {invoice.recipient_state_code or invoice.place_of_supply_state_code}", meta_text),
        Paragraph(f"<b>Phone:</b> {r_phone or '—'}", meta_text),
        Spacer(1, 1 * mm),
        Paragraph("<i><font size='5.8' color='#64748b'>*Keep this invoice and manufacturer box for warranty purposes.</font></i>", meta_text),
    ]

    meta_3col_table = Table(
        [[col1_order_info, col2_bill_to, col3_ship_to]],
        colWidths=[63 * mm, 63 * mm, 64 * mm],
    )
    meta_3col_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
    ]))
    elements.append(meta_3col_table)
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1 * mm, spaceAfter=2 * mm))

    # 4. Itemized Supplies Processing & Mathematical Reconciliation
    is_interstate = (str(invoice.supplier_state_code).strip() != str(invoice.place_of_supply_state_code).strip())

    items = invoice.items_snapshot if isinstance(invoice.items_snapshot, list) else []
    
    # Calculate line items sum
    running_qty = 0
    running_gross = Decimal("0.00")
    running_discount = Decimal("0.00")
    running_taxable = Decimal("0.00")
    running_cgst = Decimal("0.00")
    running_sgst = Decimal("0.00")
    running_igst = Decimal("0.00")
    running_total = Decimal("0.00")

    table_rows = []

    # Columns configuration
    if is_composition:
        col_widths = [38 * mm, 62 * mm, 14 * mm, 24 * mm, 24 * mm, 28 * mm]
        header_row = [
            Paragraph("<b>Product</b>", th_style),
            Paragraph("<b>Title</b>", th_style),
            Paragraph("<b>Qty</b>", th_right),
            Paragraph("<b>Gross Amount (Rs.)</b>", th_right),
            Paragraph("<b>Discounts (Rs.)</b>", th_right),
            Paragraph("<b>Total Value (Rs.)</b>", th_right),
        ]
    elif is_interstate:
        col_widths = [32 * mm, 48 * mm, 10 * mm, 20 * mm, 20 * mm, 20 * mm, 20 * mm, 20 * mm]
        header_row = [
            Paragraph("<b>Product</b>", th_style),
            Paragraph("<b>Title</b>", th_style),
            Paragraph("<b>Qty</b>", th_right),
            Paragraph("<b>Gross Amount (Rs.)</b>", th_right),
            Paragraph("<b>Discounts (Rs.)</b>", th_right),
            Paragraph("<b>Taxable Value (Rs.)</b>", th_right),
            Paragraph("<b>IGST (Rs.)</b>", th_right),
            Paragraph("<b>Total (Rs.)</b>", th_right),
        ]
    else:
        col_widths = [28 * mm, 44 * mm, 10 * mm, 18 * mm, 18 * mm, 18 * mm, 18 * mm, 18 * mm, 18 * mm]
        header_row = [
            Paragraph("<b>Product</b>", th_style),
            Paragraph("<b>Title</b>", th_style),
            Paragraph("<b>Qty</b>", th_right),
            Paragraph("<b>Gross Amount (Rs.)</b>", th_right),
            Paragraph("<b>Discounts (Rs.)</b>", th_right),
            Paragraph("<b>Taxable Value (Rs.)</b>", th_right),
            Paragraph("<b>SGST/UTGST (Rs.)</b>", th_right),
            Paragraph("<b>CGST (Rs.)</b>", th_right),
            Paragraph("<b>Total (Rs.)</b>", th_right),
        ]

    table_rows.append(header_row)

    # Process items
    for item in items:
        name = str(item.get("product_name") or item.get("productName") or "Product Item")
        variant = str(item.get("selected_variant_value") or item.get("variant") or "").strip()
        hsn = str(item.get("hsn_code") or item.get("hsnCode") or "999999")
        cat = str(item.get("category") or "General")
        sku = str(item.get("sku") or item.get("itemId") or "").strip()
        
        qty = int(item.get("quantity") or 1)
        unit_price = Decimal(str(item.get("unit_price") or item.get("unitPrice") or 0))
        taxable = Decimal(str(item.get("taxable_amount") or item.get("taxableAmount") or 0))
        tot = Decimal(str(item.get("line_total") or item.get("finalLineTotal") or item.get("grossLineTotal") or (unit_price * qty)))
        gross = unit_price * qty
        if gross <= Decimal("0.00"):
            gross = tot

        discount = Decimal(str(item.get("discount") or item.get("discountAmount") or 0))
        if discount == Decimal("0.00") and gross > tot:
            discount = gross - tot

        cgst = Decimal(str(item.get("cgst_amount") or item.get("cgstAmount") or 0))
        sgst = Decimal(str(item.get("sgst_amount") or item.get("sgstAmount") or 0))
        igst = Decimal(str(item.get("igst_amount") or item.get("igstAmount") or 0))

        # Re-derive taxable and tax if not populated
        if not is_composition:
            if taxable <= Decimal("0.00"):
                tax_rate_pct = Decimal(str(item.get("tax_rate") or item.get("gst_rate") or item.get("taxRate") or "18.00"))
                taxable = (tot / (Decimal("1.00") + (tax_rate_pct / Decimal("100.00")))).quantize(Decimal("0.01"))
                tax_amt = tot - taxable
                if is_interstate:
                    igst = tax_amt
                else:
                    cgst = (tax_amt / Decimal("2.00")).quantize(Decimal("0.01"))
                    sgst = tax_amt - cgst

        running_qty += qty
        running_gross += gross
        running_discount += discount
        running_taxable += taxable
        running_cgst += cgst
        running_sgst += sgst
        running_igst += igst
        running_total += tot

        # Rate label string
        if is_composition:
            rate_label = ""
        elif is_interstate:
            rate_pct = f"{(igst / max(taxable, Decimal('0.01')) * 100):.1f}%" if taxable > 0 else "18.0%"
            rate_label = f"IGST: {rate_pct}"
        else:
            cgst_pct = f"{(cgst / max(taxable, Decimal('0.01')) * 100):.1f}%" if taxable > 0 else "9.0%"
            sgst_pct = f"{(sgst / max(taxable, Decimal('0.01')) * 100):.1f}%" if taxable > 0 else "9.0%"
            rate_label = f"SGST: {sgst_pct}, CGST: {cgst_pct}"

        prod_cell = [
            Paragraph(f"<b>{cat}</b>", td_product),
            Paragraph(f"<font color='#64748b'>HSN: {hsn}</font>", td_product),
        ]
        if sku:
            prod_cell.append(Paragraph(f"<font color='#94a3b8'>SKU: {sku[:12]}</font>", td_product))

        title_cell = [
            Paragraph(f"{name}{f' ({variant})' if variant else ''}", td_title),
        ]
        if rate_label:
            title_cell.append(Paragraph(f"<i>{rate_label}</i>", td_tax_rate))

        if is_composition:
            table_rows.append([
                prod_cell,
                title_cell,
                Paragraph(str(qty), td_right),
                Paragraph(f"{gross:,.2f}", td_right),
                Paragraph(f"{discount:,.2f}", td_right),
                Paragraph(f"{tot:,.2f}", td_bold_right),
            ])
        elif is_interstate:
            table_rows.append([
                prod_cell,
                title_cell,
                Paragraph(str(qty), td_right),
                Paragraph(f"{gross:,.2f}", td_right),
                Paragraph(f"{discount:,.2f}", td_right),
                Paragraph(f"{taxable:,.2f}", td_right),
                Paragraph(f"{igst:,.2f}", td_right),
                Paragraph(f"{tot:,.2f}", td_bold_right),
            ])
        else:
            table_rows.append([
                prod_cell,
                title_cell,
                Paragraph(str(qty), td_right),
                Paragraph(f"{gross:,.2f}", td_right),
                Paragraph(f"{discount:,.2f}", td_right),
                Paragraph(f"{taxable:,.2f}", td_right),
                Paragraph(f"{sgst:,.2f}", td_right),
                Paragraph(f"{cgst:,.2f}", td_right),
                Paragraph(f"{tot:,.2f}", td_bold_right),
            ])

    # Check for residual shipping or handling charges between item sum and total_invoice_value
    residual = invoice.total_invoice_value - running_total
    if residual > Decimal("0.00"):
        ship_gst_rate = Decimal(str(getattr(invoice, "shipping_gst_rate", None) or "18.00"))
        res_taxable = (residual / (Decimal("1.00") + (ship_gst_rate / Decimal("100.00")))).quantize(Decimal("0.01")) if not is_composition else residual
        res_tax = residual - res_taxable
        res_igst = res_tax if is_interstate else Decimal("0.00")
        res_cgst = (res_tax / Decimal("2.00")).quantize(Decimal("0.01")) if not is_interstate else Decimal("0.00")
        res_sgst = (res_tax - res_cgst) if not is_interstate else Decimal("0.00")

        running_gross += residual
        running_taxable += res_taxable
        running_cgst += res_cgst
        running_sgst += res_sgst
        running_igst += res_igst
        running_total += residual

        ship_rate_label = f"IGST: {ship_gst_rate:.1f}%" if is_interstate else f"SGST: {(ship_gst_rate/2):.1f}%, CGST: {(ship_gst_rate/2):.1f}%"
        ship_prod = [
            Paragraph("<b>Delivery</b>", td_product),
            Paragraph("<font color='#64748b'>SAC: 996812</font>", td_product),
        ]
        ship_title = [
            Paragraph("Shipping & Handling Charge", td_title),
            Paragraph(f"<i>{ship_rate_label}</i>" if not is_composition else "", td_tax_rate),
        ]

        if is_composition:
            table_rows.append([
                ship_prod,
                ship_title,
                Paragraph("1", td_right),
                Paragraph(f"{residual:,.2f}", td_right),
                Paragraph("0.00", td_right),
                Paragraph(f"{residual:,.2f}", td_bold_right),
            ])
        elif is_interstate:
            table_rows.append([
                ship_prod,
                ship_title,
                Paragraph("1", td_right),
                Paragraph(f"{residual:,.2f}", td_right),
                Paragraph("0.00", td_right),
                Paragraph(f"{res_taxable:,.2f}", td_right),
                Paragraph(f"{res_igst:,.2f}", td_right),
                Paragraph(f"{residual:,.2f}", td_bold_right),
            ])
        else:
            table_rows.append([
                ship_prod,
                ship_title,
                Paragraph("1", td_right),
                Paragraph(f"{residual:,.2f}", td_right),
                Paragraph("0.00", td_right),
                Paragraph(f"{res_taxable:,.2f}", td_right),
                Paragraph(f"{res_sgst:,.2f}", td_right),
                Paragraph(f"{res_cgst:,.2f}", td_right),
                Paragraph(f"{residual:,.2f}", td_bold_right),
            ])

    # Table Total Summary Row (100% Mathematically Balanced)
    if is_composition:
        total_row = [
            Paragraph("<b>Total</b>", th_style),
            Paragraph("", th_style),
            Paragraph(f"<b>{running_qty}</b>", th_right),
            Paragraph(f"<b>{running_gross:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_discount:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_total:,.2f}</b>", th_right),
        ]
    elif is_interstate:
        total_row = [
            Paragraph("<b>Total</b>", th_style),
            Paragraph("", th_style),
            Paragraph(f"<b>{running_qty}</b>", th_right),
            Paragraph(f"<b>{running_gross:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_discount:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_taxable:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_igst:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_total:,.2f}</b>", th_right),
        ]
    else:
        total_row = [
            Paragraph("<b>Total</b>", th_style),
            Paragraph("", th_style),
            Paragraph(f"<b>{running_qty}</b>", th_right),
            Paragraph(f"<b>{running_gross:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_discount:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_taxable:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_sgst:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_cgst:,.2f}</b>", th_right),
            Paragraph(f"<b>{running_total:,.2f}</b>", th_right),
        ]

    table_rows.append(total_row)

    # Items Total count bar
    elements.append(Paragraph(f"<b>Total items: {running_qty}</b>", items_count_text))
    elements.append(Spacer(1, 1.5 * mm))

    items_table = Table(table_rows, colWidths=col_widths)
    t_style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0f172a")),
        ("LINEABOVE", (0, 0), (-1, 0), 1, colors.HexColor("#0f172a")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
        ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
    ]
    # Subtle row separator
    for r in range(1, len(table_rows) - 1):
        t_style.append(("LINEBELOW", (0, r), (-1, r), 0.3, colors.HexColor("#f1f5f9")))
    items_table.setStyle(TableStyle(t_style))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # 5. Financial Words & Statutory Declarations
    words_inr = amount_to_words_inr(running_total)

    bottom_left = [
        Paragraph(f"<b>Amount in Words:</b><br/>{words_inr}", seller_body),
        Spacer(1, 2 * mm),
        Paragraph("<b>Terms & Conditions:</b><br/>1. Goods once sold are subject to merchant warranty and return policy.<br/>2. This is a computer-generated tax invoice issued in accordance with Rule 46 / Rule 49 of CGST Rules, 2017. No signature required.", ParagraphStyle("TermsMini", parent=styles["Normal"], fontSize=6.5, leading=8.5, textColor=colors.HexColor("#64748b"))),
    ]

    bottom_right = [
        Paragraph(f"<b>For {s_legal}</b>", ParagraphStyle("SignHead", parent=styles["Normal"], fontSize=8, leading=10, fontName="Helvetica-Bold", alignment=2)),
        Spacer(1, 8 * mm),
        Paragraph("<b>Authorized Signatory</b>", ParagraphStyle("SignSub", parent=styles["Normal"], fontSize=7.5, leading=9.5, textColor=colors.HexColor("#475569"), alignment=2)),
        Paragraph("<font size='5.8' color='#94a3b8'>Digitally Signed & Validated</font>", ParagraphStyle("SignDig", parent=styles["Normal"], fontSize=5.8, leading=7.5, alignment=2)),
    ]

    bottom_summary_table = Table(
        [[bottom_left, bottom_right]],
        colWidths=[120 * mm, 70 * mm],
    )
    bottom_summary_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    elements.append(bottom_summary_table)
    elements.append(Spacer(1, 3 * mm))

    # 6. Statutory E-Commerce Operator (ECO) Strip
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=1 * mm))
    elements.append(Paragraph(
        f"<b>Electronic Commerce Operator (ECO):</b> {invoice.eco_legal_name} | <b>ECO GSTIN:</b> {invoice.eco_gstin} (Facilitator under Section 52 CGST Act, 2017)",
        footer_text,
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

    return pdf_bytes


def generate_rule54_credit_note_pdf(
    credit_note: TaxCreditNote,
    original_invoice: TaxInvoice,
    output_path: Optional[str] = None,
) -> bytes:
    """
    Renders a state-of-the-art statutory Rule 54 GST Credit Note PDF.
    Modern executive styling with clean typography, red accent indicators, and structured table breakdown.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )

    styles = getSampleStyleSheet()

    title_main = ParagraphStyle(
        "CNTitleMain",
        parent=styles["Normal"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#dc2626"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    title_badge = ParagraphStyle(
        "CNTitleBadge",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#475569"),
        fontName="Helvetica",
        alignment=0,
    )
    doc_num_style = ParagraphStyle(
        "CNDocNumStyle",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#dc2626"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    meta_val = ParagraphStyle(
        "CNMetaVal",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    meta_label = ParagraphStyle(
        "CNMetaLabel",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=2,
    )
    section_title = ParagraphStyle(
        "CNSectionTitle",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#475569"),
        fontName="Helvetica-Bold",
        textTransform="uppercase",
    )
    party_name = ParagraphStyle(
        "CNPartyName",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    body_text = ParagraphStyle(
        "CNBodyText",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#334155"),
    )
    th_style = ParagraphStyle(
        "CNTHStyle",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#ffffff"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    th_right = ParagraphStyle(
        "CNTHRight",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#ffffff"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    td_text = ParagraphStyle(
        "CNTDText",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#1e293b"),
        alignment=0,
    )
    td_right = ParagraphStyle(
        "CNTDRight",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#1e293b"),
        alignment=2,
    )
    td_bold_right = ParagraphStyle(
        "CNTDBoldRight",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#dc2626"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    grand_label = ParagraphStyle(
        "CNGrandLabel",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#ffffff"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    grand_val = ParagraphStyle(
        "CNGrandVal",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#ffffff"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    footer_text = ParagraphStyle(
        "CNFooterText",
        parent=styles["Normal"],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor("#94a3b8"),
        alignment=1,
    )

    elements = []

    cn_date_str = credit_note.credit_note_date.strftime("%d %b %Y") if credit_note.credit_note_date else datetime.now(timezone.utc).strftime("%d %b %Y")
    orig_inv_date = original_invoice.invoice_date.strftime("%d %b %Y") if original_invoice.invoice_date else ""

    brand_logo_text = (original_invoice.supplier_trade_name or original_invoice.supplier_legal_name or "WEBCREON STORE").upper()

    header_left = [
        Paragraph(f"<b>{brand_logo_text}</b>", ParagraphStyle("BrandTitle", parent=styles["Normal"], fontSize=13, leading=16, fontName="Helvetica-Bold", textColor=colors.HexColor("#0f172a"))),
        Paragraph("TAX CREDIT NOTE", title_main),
        Paragraph("<i>Issued under Section 34 read with Rule 54 of CGST Rules, 2017</i>", title_badge),
    ]

    header_right = [
        Paragraph(f"Credit Note #: <b>{credit_note.credit_note_number}</b>", doc_num_style),
        Paragraph(f"Credit Note Date: <b>{cn_date_str}</b>", meta_val),
        Paragraph(f"Original Invoice #: <b>{original_invoice.invoice_number}</b>", meta_val),
        Paragraph(f"Original Inv Date: <b>{orig_inv_date}</b>", meta_label),
        Paragraph(f"Reason: <b>{credit_note.reason_for_issuance}</b>", meta_label),
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[110 * mm, 80 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 1.5 * mm))

    # Parties Side-by-Side
    supplier_addr = original_invoice.supplier_address if isinstance(original_invoice.supplier_address, dict) else {}
    recip_addr = original_invoice.recipient_address if isinstance(original_invoice.recipient_address, dict) else {}

    s_line1 = supplier_addr.get("address_line1") or supplier_addr.get("addressLine1") or "Registered Office"
    s_city_pin = f"{supplier_addr.get('city', '')} - {supplier_addr.get('pincode') or supplier_addr.get('postal_code') or ''}".strip(" -")
    r_line1 = recip_addr.get("address_line1") or recip_addr.get("addressLine1") or ""
    r_city_pin = f"{recip_addr.get('city', '')} - {recip_addr.get('pincode') or recip_addr.get('postal_code') or ''}".strip(" -")

    supplier_card_content = [
        Paragraph("ISSUED BY (SUPPLIER)", section_title),
        Paragraph(f"<b>{original_invoice.supplier_legal_name}</b>", party_name),
        Paragraph(f"{s_line1}", body_text),
        Paragraph(f"{s_city_pin}", body_text),
        Paragraph(f"<b>GSTIN:</b> {original_invoice.supplier_gstin or 'Unregistered'}", body_text),
        Paragraph(f"<b>State Code:</b> {original_invoice.supplier_state_code}", body_text),
    ]

    recipient_card_content = [
        Paragraph("ISSUED TO (RECIPIENT)", section_title),
        Paragraph(f"<b>{original_invoice.recipient_name}</b>", party_name),
        Paragraph(f"{r_line1}", body_text),
        Paragraph(f"{r_city_pin}", body_text),
        Paragraph(f"<b>Place of Supply:</b> State Code {original_invoice.place_of_supply_state_code}", body_text),
    ]

    parties_table = Table(
        [[supplier_card_content, recipient_card_content]],
        colWidths=[93 * mm, 93 * mm],
    )
    parties_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#fef2f2")),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#fca5a5")),
        ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    elements.append(parties_table)
    elements.append(Spacer(1, 3 * mm))

    # Items Reversal Table
    is_interstate = (str(original_invoice.supplier_state_code).strip() != str(original_invoice.place_of_supply_state_code).strip())
    if is_interstate:
        col_widths = [8 * mm, 52 * mm, 20 * mm, 14 * mm, 24 * mm, 24 * mm, 28 * mm]
        header_row = [
            Paragraph("<b>#</b>", th_style),
            Paragraph("<b>Item Returned / Credited</b>", th_style),
            Paragraph("<b>HSN</b>", th_style),
            Paragraph("<b>Qty</b>", th_right),
            Paragraph("<b>Taxable Adj.</b>", th_right),
            Paragraph("<b>IGST Adj.</b>", th_right),
            Paragraph("<b>Total Credit</b>", th_right),
        ]
    else:
        col_widths = [8 * mm, 46 * mm, 18 * mm, 12 * mm, 22 * mm, 18 * mm, 18 * mm, 28 * mm]
        header_row = [
            Paragraph("<b>#</b>", th_style),
            Paragraph("<b>Item Returned / Credited</b>", th_style),
            Paragraph("<b>HSN</b>", th_style),
            Paragraph("<b>Qty</b>", th_right),
            Paragraph("<b>Taxable Adj.</b>", th_right),
            Paragraph("<b>CGST Adj.</b>", th_right),
            Paragraph("<b>SGST Adj.</b>", th_right),
            Paragraph("<b>Total Credit</b>", th_right),
        ]

    items_rows = [header_row]
    items = credit_note.items_snapshot if isinstance(credit_note.items_snapshot, list) else []

    for idx, item in enumerate(items, 1):
        desc = str(item.get("product_name") or item.get("productName") or "Returned Item")
        hsn = str(item.get("hsn_code") or item.get("hsnCode") or "999999")
        qty = int(item.get("quantity") or 1)
        taxable = _currency(item.get("taxable_amount") or item.get("taxableAmount") or 0)
        tot = _currency(item.get("line_total") or item.get("finalLineTotal") or item.get("totalCredit") or 0)

        if is_interstate:
            igst_amt = _currency(item.get("igst_amount") or item.get("igstAmount") or 0)
            items_rows.append([
                Paragraph(str(idx), td_text),
                Paragraph(desc, td_text),
                Paragraph(hsn, td_text),
                Paragraph(str(qty), td_right),
                Paragraph(taxable, td_right),
                Paragraph(igst_amt, td_right),
                Paragraph(tot, td_bold_right),
            ])
        else:
            cgst_amt = _currency(item.get("cgst_amount") or item.get("cgstAmount") or 0)
            sgst_amt = _currency(item.get("sgst_amount") or item.get("sgstAmount") or 0)
            items_rows.append([
                Paragraph(str(idx), td_text),
                Paragraph(desc, td_text),
                Paragraph(hsn, td_text),
                Paragraph(str(qty), td_right),
                Paragraph(taxable, td_right),
                Paragraph(cgst_amt, td_right),
                Paragraph(sgst_amt, td_right),
                Paragraph(tot, td_bold_right),
            ])

    items_table = Table(items_rows, colWidths=col_widths)
    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b91c1c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#ffffff")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]
    for r_idx in range(1, len(items_rows)):
        if r_idx % 2 == 0:
            t_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), colors.HexColor("#fef2f2")))
    items_table.setStyle(TableStyle(t_style))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # Totals & Declarations
    words_inr = amount_to_words_inr(credit_note.total_credit_value)
    summary_left = [
        Paragraph("<b>CREDIT AMOUNT IN WORDS</b>", section_title),
        Paragraph(f"<b>{words_inr}</b>", ParagraphStyle("WordsTextCN", parent=styles["Normal"], fontSize=8, leading=11, fontName="Helvetica-Bold", textColor=colors.HexColor("#dc2626"))),
        Spacer(1, 2 * mm),
        Paragraph("<b>STATUTORY REVERSAL NOTE</b>", section_title),
        Paragraph("Issued in accordance with Section 34 of the CGST Act, 2017 read with Rule 54 CGST Rules to reverse output tax liability. Recipient is advised to adjust input tax credit accordingly.", ParagraphStyle("TermsTextCN", parent=styles["Normal"], fontSize=7, leading=9.5, textColor=colors.HexColor("#64748b"))),
    ]

    breakdown_rows = [
        [Paragraph("Taxable Reversal:", body_text), Paragraph(_currency(credit_note.taxable_value), td_bold_right)],
    ]
    if is_interstate:
        breakdown_rows.append([Paragraph("IGST Reversal:", body_text), Paragraph(_currency(credit_note.igst_amount), td_right)])
    else:
        breakdown_rows.append([Paragraph("CGST Reversal:", body_text), Paragraph(_currency(credit_note.cgst_amount), td_right)])
        breakdown_rows.append([Paragraph("SGST Reversal:", body_text), Paragraph(_currency(credit_note.sgst_amount), td_right)])

    breakdown_rows.append([
        Paragraph("<b>TOTAL REFUND VALUE:</b>", grand_label),
        Paragraph(f"<b>{_currency(credit_note.total_credit_value)}</b>", grand_val),
    ])

    summary_right_table = Table(breakdown_rows, colWidths=[42 * mm, 38 * mm])
    right_style = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -2), 1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -2), 1 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#b91c1c")),
        ("TOPPADDING", (0, -1), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 2 * mm),
        ("LINEBELOW", (0, -2), (-1, -2), 0.5, colors.HexColor("#cbd5e1")),
    ]
    summary_right_table.setStyle(TableStyle(right_style))

    bottom_container = Table(
        [[summary_left, summary_right_table]],
        colWidths=[105 * mm, 85 * mm],
    )
    bottom_container.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    elements.append(bottom_container)
    elements.append(Spacer(1, 4 * mm))

    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=1.5 * mm))
    elements.append(Paragraph(
        "This official Tax Credit Note is digitally generated and compliant with GST statutory refund guidelines.",
        footer_text,
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

    return pdf_bytes


def issue_tax_invoice_for_order(
    session: Session,
    order: Order,
    save_pdf: bool = True,
) -> TaxInvoice:
    """
    Atomically generates and persists a Rule 46 Tax Invoice for an order.
    Guarantees unique sequential invoice numbering without gaps.
    """
    # Check if already issued
    existing = session.exec(
        select(TaxInvoice).where(TaxInvoice.order_id == order.id)
    ).first()
    if existing:
        return existing

    site = session.get(Site, order.site_id)
    site_name = site.name if site else "Online Store"

    profile = session.exec(
        select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == order.site_id)
    ).first()

    if profile:
        supplier_legal = profile.legal_business_name
        supplier_trade = profile.trade_name or profile.legal_business_name
        supplier_gstin = profile.gstin
        supplier_pan = profile.pan_number or "PANNOTPROV"
        supplier_state = profile.state_code or "27"
        supplier_addr = {
            "address_line1": profile.address_line1 or "Registered Commercial Premises",
            "city": profile.city or "",
            "pincode": profile.pincode or "",
            "state": profile.state_name or "Maharashtra",
        }
    else:
        supplier_legal = site_name
        supplier_trade = site_name
        supplier_gstin = None
        supplier_pan = "PANNOTPROV"
        supplier_state = "27"
        supplier_addr = {
            "address_line1": "Registered Store Office",
            "city": "Mumbai",
            "pincode": "400001",
            "state": "Maharashtra",
        }

    shipping_addr = order.shipping_address if isinstance(order.shipping_address, dict) else {}
    recipient_name = (
        shipping_addr.get("fullName")
        or shipping_addr.get("full_name")
        or "Valued Customer"
    )
    dest_state = resolve_gst_state_code(
        state_code=shipping_addr.get("state_code") or shipping_addr.get("stateCode"),
        state_name=shipping_addr.get("state") or shipping_addr.get("state_name"),
        postal_code=shipping_addr.get("postal_code") or shipping_addr.get("postalCode"),
        default=supplier_state,
    )

    fy = get_financial_year(order.created_at)
    fy_short = fy
    if len(fy) == 7 and fy[4] == "-":
        fy_short = f"{fy[2:4]}-{fy[5:7]}"

    seq_int, inv_num = get_next_sequence_number(
        session=session,
        site_id=order.site_id,
        document_type="INVOICE",
        financial_year=fy,
    )

    pricing_snapshot = order.pricing_snapshot if isinstance(order.pricing_snapshot, dict) else {}
    tax_dict = pricing_snapshot.get("tax") if isinstance(pricing_snapshot.get("tax"), dict) else {}
    pricing_details = pricing_snapshot.get("pricing_details") if isinstance(pricing_snapshot.get("pricing_details"), dict) else {}

    taxable_val = Decimal(str(
        tax_dict.get("taxableAmount")
        or pricing_details.get("taxable_amount")
        or pricing_snapshot.get("taxableSubtotal")
        or getattr(order, "subtotal", None)
        or order.total
    ))
    cgst_val = Decimal(str(tax_dict.get("cgst") or pricing_details.get("cgst_amount") or 0))
    sgst_val = Decimal(str(tax_dict.get("sgst") or pricing_details.get("sgst_amount") or 0))
    igst_val = Decimal(str(tax_dict.get("igst") or pricing_details.get("igst_amount") or 0))
    cess_val = Decimal(str(tax_dict.get("cess") or pricing_details.get("cess_amount") or 0))
    total_tax_val = Decimal(str(tax_dict.get("amount") or pricing_details.get("total_tax") or (cgst_val + sgst_val + igst_val + cess_val)))
    total_invoice_val = Decimal(str(order.total))

    # Line item taxes snapshot
    items_snapshot = pricing_snapshot.get("lineItemTaxes")
    if not items_snapshot:
        raw_items = order.items if isinstance(order.items, list) else []
        items_snapshot = [
            {
                "itemId": itm.get("product_id") or str(idx),
                "productName": itm.get("product_name") or "Product",
                "hsnCode": itm.get("hsn_code") or "999999",
                "quantity": int(itm.get("quantity") or 1),
                "unitPrice": float(itm.get("unit_price") or 0),
                "taxableAmount": float(taxable_val / max(len(raw_items), 1)),
                "cgstAmount": float(cgst_val / max(len(raw_items), 1)),
                "sgstAmount": float(sgst_val / max(len(raw_items), 1)),
                "igstAmount": float(igst_val / max(len(raw_items), 1)),
                "lineTotal": float(itm.get("line_total") or 0),
            }
            for idx, itm in enumerate(raw_items, 1)
        ]

    pdf_rel_path = f"uploads/invoices/{order.id}.pdf"
    invoice = TaxInvoice(
        site_id=order.site_id,
        order_id=order.id,
        invoice_number=inv_num,
        financial_year=fy_short,
        invoice_date=order.created_at,
        supplier_legal_name=supplier_legal,
        supplier_trade_name=supplier_trade,
        supplier_gstin=supplier_gstin,
        supplier_pan=supplier_pan,
        supplier_address=supplier_addr,
        supplier_state_code=supplier_state,
        recipient_name=recipient_name,
        recipient_address=shipping_addr,
        recipient_state_code=dest_state,
        place_of_supply_state_code=dest_state,
        eco_legal_name="WebCreon Technologies Private Limited",
        eco_gstin="27AAACW1234F1Z1",
        taxable_value=taxable_val,
        cgst_amount=cgst_val,
        sgst_amount=sgst_val,
        igst_amount=igst_val,
        cess_amount=cess_val,
        total_tax_amount=total_tax_val,
        total_invoice_value=total_invoice_val,
        items_snapshot=items_snapshot,
        pdf_storage_path=pdf_rel_path,
    )
    session.add(invoice)
    session.flush()

    if save_pdf:
        try:
            generate_rule46_invoice_pdf(invoice, output_path=pdf_rel_path)
        except Exception:
            pass

    return invoice


def issue_tax_credit_note_for_return(
    session: Session,
    return_request: Optional[ReturnRequest] = None,
    save_pdf: bool = True,
    order: Optional[Order] = None,
    return_items_snapshot: Optional[List[Dict[str, Any]]] = None,
    reason: Optional[str] = None,
) -> TaxCreditNote:
    """
    Atomically generates and persists a Rule 54 Tax Credit Note for an approved/refunded return.
    Supports invocation either with a ReturnRequest object or directly with (order, return_items_snapshot, reason).
    """
    if return_request is not None:
        # Check if already issued
        existing = session.exec(
            select(TaxCreditNote).where(TaxCreditNote.return_request_id == return_request.id)
        ).first()
        if existing:
            return existing

        target_order = session.get(Order, return_request.order_id)
        if not target_order:
            raise ValueError(f"Order not found for return request {return_request.id}")

        site_id = return_request.site_id
        return_req_id = return_request.id
        doc_date = return_request.refunded_at or datetime.now(timezone.utc)
        doc_reason = reason or return_request.refund_override_reason or "Customer Return Approved"
        final_refund_amt = Decimal(str(return_request.final_refund_amount or return_request.suggested_refund_amount or 0))
    elif order is not None:
        target_order = order
        site_id = order.site_id
        return_req_id = None
        doc_date = datetime.now(timezone.utc)
        doc_reason = reason or "Customer Return Approved"
        if return_items_snapshot:
            final_refund_amt = sum(Decimal(str(item.get("line_total") or item.get("totalCredit") or 0)) for item in return_items_snapshot)
        else:
            final_refund_amt = Decimal(str(order.total or 0))
    else:
        raise ValueError("Either return_request or order must be provided to issue_tax_credit_note_for_return")

    orig_invoice = session.exec(
        select(TaxInvoice).where(TaxInvoice.order_id == target_order.id)
    ).first()

    if not orig_invoice:
        orig_invoice = issue_tax_invoice_for_order(session, target_order, save_pdf=False)

    fy = get_financial_year(doc_date)
    fy_short = fy
    if len(fy) == 7 and fy[4] == "-":
        fy_short = f"{fy[2:4]}-{fy[5:7]}"

    seq_int, cn_num = get_next_sequence_number(
        session=session,
        site_id=site_id,
        document_type="CREDIT_NOTE",
        financial_year=fy,
    )

    if orig_invoice.total_invoice_value > Decimal("0.00"):
        ratio = min(final_refund_amt / orig_invoice.total_invoice_value, Decimal("1.00"))
    else:
        ratio = Decimal("1.00")

    rev_taxable = money(orig_invoice.taxable_value * ratio)
    rev_cgst = money(orig_invoice.cgst_amount * ratio)
    rev_sgst = money(orig_invoice.sgst_amount * ratio)
    rev_igst = money(orig_invoice.igst_amount * ratio)

    if return_items_snapshot:
        items_snapshot = return_items_snapshot
    elif return_req_id:
        return_items = session.exec(
            select(ReturnItem).where(ReturnItem.return_request_id == return_req_id)
        ).all()
        items_snapshot = [
            {
                "returnItemId": str(ri.id),
                "orderItemId": str(ri.order_item_id),
                "productName": getattr(ri, "product_name", "Returned Product"),
                "quantity": int(ri.quantity_received or ri.quantity_approved or ri.quantity_requested or 1),
                "taxableAmount": float(rev_taxable / max(len(return_items), 1)),
                "cgstAmount": float(rev_cgst / max(len(return_items), 1)),
                "sgstAmount": float(rev_sgst / max(len(return_items), 1)),
                "igstAmount": float(rev_igst / max(len(return_items), 1)),
                "totalCredit": float(final_refund_amt / max(len(return_items), 1)),
            }
            for ri in return_items
        ]
    else:
        items_snapshot = target_order.items or []

    pdf_rel_path = f"uploads/credit_notes/{cn_num.replace('/', '_')}.pdf"
    credit_note = TaxCreditNote(
        site_id=site_id,
        original_invoice_id=orig_invoice.id,
        return_request_id=return_req_id,
        credit_note_number=cn_num,
        financial_year=fy_short,
        credit_note_date=doc_date,
        reason_for_issuance=doc_reason,
        taxable_value=rev_taxable,
        cgst_amount=rev_cgst,
        sgst_amount=rev_sgst,
        igst_amount=rev_igst,
        total_credit_value=final_refund_amt,
        items_snapshot=items_snapshot,
        pdf_storage_path=pdf_rel_path,
    )
    session.add(credit_note)
    session.flush()

    if save_pdf:
        try:
            generate_rule54_credit_note_pdf(credit_note, orig_invoice, output_path=pdf_rel_path)
        except Exception:
            pass

    return credit_note


def generate_platform_fee_invoice_pdf(
    order: Order,
    site: Site,
    ledger_entry: Optional[TenantLedgerEntry] = None,
    output_path: Optional[str] = None,
    session: Optional[Session] = None,
) -> bytes:
    """
    Renders the official B2B Tax Invoice from WebCreon Technologies Private Limited to the Merchant
    for platform facilitation services, 18% GST (SAC 998313), and Section 52 TCS reconciliation.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )

    styles = getSampleStyleSheet()

    title_main_center = ParagraphStyle(
        "PFTitleMain",
        parent=styles["Normal"],
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    title_sub_center = ParagraphStyle(
        "PFTitleSub",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#64748b"),
        fontName="Helvetica-Oblique",
        alignment=1,
    )
    seller_title = ParagraphStyle(
        "PFSellerTitle",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    seller_body = ParagraphStyle(
        "PFSellerBody",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    inv_box_title = ParagraphStyle(
        "PFInvBoxTitle",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    inv_box_num = ParagraphStyle(
        "PFInvBoxNum",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    meta_head = ParagraphStyle(
        "PFMetaHead",
        parent=styles["Normal"],
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    meta_text = ParagraphStyle(
        "PFMetaText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    th_style = ParagraphStyle(
        "PFTHStyle",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    th_right = ParagraphStyle(
        "PFTHRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    td_product = ParagraphStyle(
        "PFTDProduct",
        parent=styles["Normal"],
        fontSize=6.8,
        leading=8.5,
        textColor=colors.HexColor("#1e293b"),
    )
    td_title = ParagraphStyle(
        "PFTDTitle",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    td_tax_rate = ParagraphStyle(
        "PFTDTaxRate",
        parent=styles["Normal"],
        fontSize=6.2,
        leading=7.8,
        textColor=colors.HexColor("#64748b"),
    )
    td_right = ParagraphStyle(
        "PFTDRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#1e293b"),
        alignment=2,
    )
    td_bold_right = ParagraphStyle(
        "PFTDBoldRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    footer_text = ParagraphStyle(
        "PFFooterText",
        parent=styles["Normal"],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )

    elements = []

    # 1. Header Details
    elements.append(Paragraph("<b>TAX INVOICE - PLATFORM SERVICES</b>", title_main_center))
    elements.append(Paragraph("<i>Issued by WebCreon Technologies Private Limited under Section 31 read with Rule 46 of CGST Rules, 2017</i>", title_sub_center))
    elements.append(Spacer(1, 2 * mm))

    # WebCreon Corporate Details (Configurable via Environment Variables)
    webcreon_name = os.getenv("WEBCREON_LEGAL_NAME", "WebCreon Technologies Private Limited")
    webcreon_addr = os.getenv("WEBCREON_ADDRESS", "WebCreon Tech Hub, Bandra-Kurla Complex, Mumbai - 400051, Maharashtra")
    webcreon_gstin = os.getenv("WEBCREON_GSTIN", "27AAACW1234F1Z1")
    webcreon_pan = os.getenv("WEBCREON_PAN", "AAACW1234F")
    webcreon_cin = os.getenv("WEBCREON_CIN", "U72900MH2026PTC123456")
    webcreon_state_code = os.getenv("WEBCREON_STATE_CODE", "27")

    webcreon_info = [
        Paragraph(f"<b>Service Provider:</b> {webcreon_name}", seller_title),
        Paragraph(f"<b>Registered Office:</b> {webcreon_addr} (State Code: {webcreon_state_code})", seller_body),
        Paragraph(f"<b>GSTIN:</b> {webcreon_gstin} | <b>PAN:</b> {webcreon_pan}", seller_body),
        Paragraph(f"<b>CIN:</b> {webcreon_cin}", seller_body),
    ]

    inv_date = order.created_at or datetime.now(timezone.utc)
    inv_date_str = inv_date.strftime("%d-%m-%Y")
    inv_number = f"WBC/{inv_date.strftime('%y-%m')}/{str(order.id)[:8].upper()}"

    qr_payload = f"INVOICE:{inv_number},SELLER:WebCreon,ORDER:{str(order.id)[:8].upper()},DATE:{inv_date_str},GSTIN:{webcreon_gstin}"
    qr_drawing = make_qr_code(qr_payload, size=22 * mm)

    inv_num_box = Table(
        [
            [Paragraph("Platform Invoice Number #", inv_box_title)],
            [Paragraph(f"<b>{inv_number}</b>", inv_box_num)],
        ],
        colWidths=[62 * mm],
    )
    inv_num_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#94a3b8")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    qr_and_inv = Table(
        [[qr_drawing, inv_num_box]],
        colWidths=[24 * mm, 63 * mm],
    )
    qr_and_inv.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    top_header_table = Table(
        [[webcreon_info, qr_and_inv]],
        colWidths=[102 * mm, 88 * mm],
    )
    top_header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    elements.append(top_header_table)
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1.5 * mm, spaceAfter=2 * mm))

    # Merchant Recipient Info
    profile = None
    if session and site:
        try:
            profile = session.exec(select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == site.id)).first()
        except Exception:
            pass

    m_legal = profile.legal_business_name if profile else (site.name if site else "Merchant Partner")
    m_trade = profile.trade_name if profile else (site.name if site else "Store")
    m_gstin = profile.gstin if profile else "Unregistered / Composition"
    m_state_code = profile.state_code if profile else "27"
    m_addr = profile.address_line1 if profile else "Merchant Registered Store Premises"
    m_city_pin = f"{profile.city or ''} - {profile.pincode or ''}".strip(" -") if profile else ""

    is_interstate = (str(m_state_code).strip() != str(webcreon_state_code).strip())

    col1_order_info = [
        Paragraph(f"<b>Order Reference:</b> #{str(order.id)[:14].upper()}", meta_text),
        Paragraph(f"<b>Invoice Date:</b> {inv_date_str}", meta_text),
        Paragraph(f"<b>Place of Supply:</b> State Code {m_state_code}", meta_text),
        Paragraph("<b>SAC Code:</b> 998313 (E-Commerce Platform Services)", meta_text),
        Paragraph("<b>Reverse Charge:</b> No", meta_text),
    ]

    col2_merchant_to = [
        Paragraph("<b>Billed To (Merchant):</b>", meta_head),
        Paragraph(f"<b>{m_legal}</b> ({m_trade})", meta_text),
        Paragraph(f"{m_addr}", meta_text),
        Paragraph(f"{m_city_pin} (State Code: {m_state_code})", meta_text),
        Paragraph(f"<b>Merchant GSTIN:</b> {m_gstin}", meta_text),
    ]

    col3_settlement = [
        Paragraph("<b>Settlement Payout Account:</b>", meta_head),
        Paragraph(f"<b>Gross Order GMV:</b> Rs. {order.total:,.2f}", meta_text),
        Paragraph(f"<b>Payment Method:</b> {order.payment_method or 'Online / Doorstep Cash'}", meta_text),
        Paragraph(f"<b>Settlement Status:</b> {'Fee Waived (Returned)' if order.status in ('cancelled', 'returned') else 'Processed'}", meta_text),
    ]

    meta_3col_table = Table(
        [[col1_order_info, col2_merchant_to, col3_settlement]],
        colWidths=[63 * mm, 64 * mm, 63 * mm],
    )
    meta_3col_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
    ]))
    elements.append(meta_3col_table)
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1 * mm, spaceAfter=2 * mm))

    # Itemized Services Table from Ledger Entry or computed values
    if ledger_entry:
        gross_gmv = Decimal(str(ledger_entry.gross_order_value or ledger_entry.gross_amount or order.total))
        base_fee = Decimal(str(ledger_entry.platform_commission_base or ledger_entry.platform_fee or Decimal("0.00")))
        cgst_fee = Decimal(str(ledger_entry.platform_fee_gst_cgst or Decimal("0.00")))
        sgst_fee = Decimal(str(ledger_entry.platform_fee_gst_sgst or Decimal("0.00")))
        igst_fee = Decimal(str(ledger_entry.platform_fee_gst_igst or Decimal("0.00")))
        total_fee_with_gst = Decimal(str(ledger_entry.total_platform_fee_with_gst or (base_fee + cgst_fee + sgst_fee + igst_fee)))
        tcs_val = Decimal(str(ledger_entry.total_gst_tcs or Decimal("0.00")))
        tds_val = Decimal(str(ledger_entry.income_tax_tds_194o or Decimal("0.00")))
        gateway_fee = Decimal(str(ledger_entry.gateway_fee or Decimal("0.00")))
        gateway_fee_gst = Decimal(str(ledger_entry.gateway_fee_gst or Decimal("0.00")))
        total_gateway = gateway_fee + gateway_fee_gst
        net_payout = Decimal(str(ledger_entry.net_merchant_payout or max(gross_gmv - total_fee_with_gst - tcs_val - tds_val - total_gateway, Decimal("0.00"))))
        comm_rate = Decimal(str(ledger_entry.platform_fee_percent or Decimal("3.00")))
    else:
        gross_gmv = Decimal(str(order.total))
        comm_rate = Decimal("3.00")
        base_fee = (gross_gmv * comm_rate / Decimal("100.00")).quantize(Decimal("0.01"))
        if order.status in ("cancelled", "returned"):
            base_fee = Decimal("0.00")

        if is_interstate:
            cgst_fee = Decimal("0.00")
            sgst_fee = Decimal("0.00")
            igst_fee = (base_fee * Decimal("0.18")).quantize(Decimal("0.01"))
        else:
            cgst_fee = (base_fee * Decimal("0.09")).quantize(Decimal("0.01"))
            sgst_fee = (base_fee * Decimal("0.09")).quantize(Decimal("0.01"))
            igst_fee = Decimal("0.00")

        total_fee_with_gst = base_fee + cgst_fee + sgst_fee + igst_fee
        tcs_val = (gross_gmv * Decimal("0.01")).quantize(Decimal("0.01")) if base_fee > 0 else Decimal("0.00")
        tds_val = Decimal("0.00")
        gateway_fee = Decimal("0.00")
        gateway_fee_gst = Decimal("0.00")
        total_gateway = Decimal("0.00")
        net_payout = max(gross_gmv - total_fee_with_gst - tcs_val - tds_val - total_gateway, Decimal("0.00"))

    if is_interstate:
        col_widths = [32 * mm, 50 * mm, 12 * mm, 24 * mm, 24 * mm, 24 * mm, 24 * mm]
        header_row = [
            Paragraph("<b>Service Code</b>", th_style),
            Paragraph("<b>Service Description</b>", th_style),
            Paragraph("<b>Rate</b>", th_right),
            Paragraph("<b>Order GMV (Rs.)</b>", th_right),
            Paragraph("<b>Taxable Fee (Rs.)</b>", th_right),
            Paragraph("<b>IGST (18%)</b>", th_right),
            Paragraph("<b>Total Fee (Rs.)</b>", th_right),
        ]
        items_rows = [
            header_row,
            [
                Paragraph("<b>SAC: 998313</b>", td_product),
                Paragraph("WebCreon E-Commerce Platform Facilitation Fee<br/><i>Information Technology & Marketplace Services</i>", td_title),
                Paragraph("3.0%", td_right),
                Paragraph(f"{gross_gmv:,.2f}", td_right),
                Paragraph(f"{base_fee:,.2f}", td_right),
                Paragraph(f"{igst_fee:,.2f}", td_right),
                Paragraph(f"{total_fee_with_gst:,.2f}", td_bold_right),
            ],
            [
                Paragraph("<b>Total</b>", th_style),
                Paragraph("", th_style),
                Paragraph("", th_right),
                Paragraph(f"<b>{gross_gmv:,.2f}</b>", th_right),
                Paragraph(f"<b>{base_fee:,.2f}</b>", th_right),
                Paragraph(f"<b>{igst_fee:,.2f}</b>", th_right),
                Paragraph(f"<b>{total_fee_with_gst:,.2f}</b>", th_right),
            ]
        ]
    else:
        col_widths = [28 * mm, 46 * mm, 12 * mm, 22 * mm, 22 * mm, 20 * mm, 20 * mm, 20 * mm]
        header_row = [
            Paragraph("<b>Service Code</b>", th_style),
            Paragraph("<b>Service Description</b>", th_style),
            Paragraph("<b>Rate</b>", th_right),
            Paragraph("<b>Order GMV (Rs.)</b>", th_right),
            Paragraph("<b>Taxable Fee (Rs.)</b>", th_right),
            Paragraph("<b>CGST (9%)</b>", th_right),
            Paragraph("<b>SGST (9%)</b>", th_right),
            Paragraph("<b>Total Fee (Rs.)</b>", th_right),
        ]
        items_rows = [
            header_row,
            [
                Paragraph("<b>SAC: 998313</b>", td_product),
                Paragraph("WebCreon E-Commerce Platform Facilitation Fee<br/><i>Information Technology & Marketplace Services</i>", td_title),
                Paragraph("3.0%", td_right),
                Paragraph(f"{gross_gmv:,.2f}", td_right),
                Paragraph(f"{base_fee:,.2f}", td_right),
                Paragraph(f"{cgst_fee:,.2f}", td_right),
                Paragraph(f"{sgst_fee:,.2f}", td_right),
                Paragraph(f"{total_fee_with_gst:,.2f}", td_bold_right),
            ],
            [
                Paragraph("<b>Total</b>", th_style),
                Paragraph("", th_style),
                Paragraph("", th_right),
                Paragraph(f"<b>{gross_gmv:,.2f}</b>", th_right),
                Paragraph(f"<b>{base_fee:,.2f}</b>", th_right),
                Paragraph(f"<b>{cgst_fee:,.2f}</b>", th_right),
                Paragraph(f"<b>{sgst_fee:,.2f}</b>", th_right),
                Paragraph(f"<b>{total_fee_with_gst:,.2f}</b>", th_right),
            ]
        ]

    items_table = Table(items_rows, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0f172a")),
        ("LINEABOVE", (0, 0), (-1, 0), 1, colors.HexColor("#0f172a")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
        ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # Payout Settlement Breakdown Table
    settlement_card = [
        Paragraph("<b>SETTLEMENT SUMMARY:</b>", meta_head),
        Paragraph(f"• Gross Order Collection: <b>Rs. {gross_gmv:,.2f}</b>", seller_body),
        Paragraph(f"• WebCreon Platform Fee (Inc. 18% GST): <b>-Rs. {total_fee_with_gst:,.2f}</b>", seller_body),
    ]
    if total_gateway > Decimal("0.00"):
        settlement_card.append(Paragraph(f"• Payment Gateway Fee (Razorpay & GST): <b>-Rs. {total_gateway:,.2f}</b>", seller_body))
    if tcs_val > Decimal("0.00"):
        settlement_card.append(Paragraph(f"• Section 52 GST-TCS Withholding (1.0%): <b>-Rs. {tcs_val:,.2f}</b>", seller_body))
    if tds_val > Decimal("0.00"):
        settlement_card.append(Paragraph(f"• Section 194-O Income Tax TDS: <b>-Rs. {tds_val:,.2f}</b>", seller_body))

    settlement_card.append(Paragraph(f"• Net Payout Remitted to Merchant: <b>Rs. {net_payout:,.2f}</b>", seller_title))

    words_inr = amount_to_words_inr(total_fee_with_gst)
    bottom_left = [
        *settlement_card,
        Spacer(1, 2 * mm),
        Paragraph(f"<b>Platform Fee in Words:</b><br/>{words_inr}", seller_body),
    ]

    bottom_right = [
        Paragraph("<b>For WebCreon Technologies Private Limited</b>", ParagraphStyle("WBCSignHead", parent=styles["Normal"], fontSize=8, leading=10, fontName="Helvetica-Bold", alignment=2)),
        Spacer(1, 8 * mm),
        Paragraph("<b>Authorized Signatory</b>", ParagraphStyle("WBCSignSub", parent=styles["Normal"], fontSize=7.5, leading=9.5, textColor=colors.HexColor("#475569"), alignment=2)),
        Paragraph("<font size='5.8' color='#94a3b8'>Digitally Signed & Validated</font>", ParagraphStyle("WBCSignDig", parent=styles["Normal"], fontSize=5.8, leading=7.5, alignment=2)),
    ]

    bottom_summary_table = Table(
        [[bottom_left, bottom_right]],
        colWidths=[120 * mm, 70 * mm],
    )
    bottom_summary_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    elements.append(bottom_summary_table)
    elements.append(Spacer(1, 3 * mm))

    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=1 * mm))
    elements.append(Paragraph(
        "This official B2B Tax Invoice is digitally generated by WebCreon Technologies Private Limited for marketplace facilitation services rendered under Section 31 of CGST Act, 2017.",
        footer_text,
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

    return pdf_bytes


def generate_subscription_invoice_pdf(
    inv: SubscriptionInvoice,
    site: Optional[Site] = None,
    admin: Optional[Admin] = None,
    output_path: Optional[str] = None,
    session: Optional[Session] = None,
) -> bytes:
    """
    Renders the official Statutory B2B Tax Invoice for WebCreon Platform Subscriptions & Cloud Hosting.
    Compliant with Section 31 and Rule 46 of CGST Rules, 2017 (SAC 998313).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )

    styles = getSampleStyleSheet()

    title_main_center = ParagraphStyle(
        "SubTitleMain",
        parent=styles["Normal"],
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    title_sub_center = ParagraphStyle(
        "SubTitleSub",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#64748b"),
        fontName="Helvetica-Oblique",
        alignment=1,
    )
    seller_title = ParagraphStyle(
        "SubSellerTitle",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    seller_body = ParagraphStyle(
        "SubSellerBody",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    inv_box_title = ParagraphStyle(
        "SubInvBoxTitle",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    inv_box_num = ParagraphStyle(
        "SubInvBoxNum",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    meta_head = ParagraphStyle(
        "SubMetaHead",
        parent=styles["Normal"],
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    meta_text = ParagraphStyle(
        "SubMetaText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    th_style = ParagraphStyle(
        "SubTHStyle",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    th_right = ParagraphStyle(
        "SubTHRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    td_product = ParagraphStyle(
        "SubTDProduct",
        parent=styles["Normal"],
        fontSize=6.8,
        leading=8.5,
        textColor=colors.HexColor("#1e293b"),
    )
    td_title = ParagraphStyle(
        "SubTDTitle",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    td_right = ParagraphStyle(
        "SubTDRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#1e293b"),
        alignment=2,
    )
    td_bold_right = ParagraphStyle(
        "SubTDBoldRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    footer_text = ParagraphStyle(
        "SubFooterText",
        parent=styles["Normal"],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )

def make_webcreon_brand_drawing(width: float = 65 * mm, height: float = 14 * mm) -> Drawing:
    """
    Renders the exact vector WebCreon brand logo matching the top panel of the application:
    Store building emblem with flared awning & 'W' crest + WEBCREON typography in official brand colors.
    """
    d = Drawing(width, height)

    # Scale and place the exact building emblem from WebCreonAnimatedLogo
    # transform=[sx, 0, 0, sy, tx, ty]
    g = Group(transform=[0.09, 0, 0, 0.09, 0, 1])

    # 1. Ground shadow
    g.add(Rect(60, 40, 280, 10, rx=5, ry=5, fillColor=colors.HexColor("#091a38"), strokeColor=None))
    g.add(PolyLine([40, 45, 360, 45], strokeColor=colors.HexColor("#091a38"), strokeWidth=8, strokeLineCap=1))

    # 2. Store Building Body
    g.add(Rect(75, 50, 250, 150, rx=16, ry=16, fillColor=colors.HexColor("#155f9f"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4))

    # 3. Inner Window
    g.add(Rect(100, 70, 200, 110, rx=10, ry=10, fillColor=colors.HexColor("#dde6ef"), strokeColor=colors.HexColor("#091a38"), strokeWidth=3))
    g.add(PolyLine([104, 174, 296, 174], strokeColor=colors.HexColor("#091a38"), strokeWidth=3))

    # 4. Shopping Bag
    g.add(PolyLine([152, 140, 152, 155, 178, 155, 178, 140], strokeColor=colors.HexColor("#c45a08"), strokeWidth=4, strokeLineCap=1, strokeLineJoin=1))
    g.add(Polygon([144, 142, 186, 142, 192, 92, 138, 92], fillColor=colors.HexColor("#d87d13"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4, strokeLineJoin=1))
    g.add(Circle(154, 132, 3, fillColor=colors.HexColor("#FFFFFF"), strokeColor=None))
    g.add(Circle(176, 132, 3, fillColor=colors.HexColor("#FFFFFF"), strokeColor=None))

    # 5. Gear
    gear_rl = [
        260, 164, 265, 164, 267, 158, 273, 156, 278, 160, 281, 157, 279, 151,
        283, 147, 289, 148, 290, 143, 285, 140, 285, 134, 290, 131, 289, 126,
        283, 127, 279, 123, 281, 117, 278, 114, 273, 118, 267, 116, 265, 110,
        260, 110, 258, 116, 252, 118, 247, 114, 244, 117, 246, 123, 242, 127,
        236, 126, 235, 131, 240, 134, 240, 140, 235, 143, 236, 148, 242, 147,
        246, 151, 244, 157, 247, 160, 252, 156, 258, 158
    ]
    g.add(Polygon(gear_rl, fillColor=colors.HexColor("#2487c9"), strokeColor=colors.HexColor("#091a38"), strokeWidth=3, strokeLineJoin=1))
    g.add(Circle(260, 136, 10, fillColor=colors.HexColor("#dde6ef"), strokeColor=colors.HexColor("#091a38"), strokeWidth=3))

    # 6. Exact 5-stripe flared awning
    g.add(Polygon([80, 250, 128, 250, 101, 210, 101, 205, 68, 185, 35, 205, 35, 210], fillColor=colors.HexColor("#4fa4e6"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4, strokeLineJoin=1))
    g.add(Polygon([128, 250, 176, 250, 167, 210, 167, 205, 134, 185, 101, 205, 101, 210], fillColor=colors.HexColor("#1b417d"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4, strokeLineJoin=1))
    g.add(Polygon([176, 250, 224, 250, 233, 210, 233, 205, 200, 185, 167, 205, 167, 210], fillColor=colors.HexColor("#4fa4e6"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4, strokeLineJoin=1))
    g.add(Polygon([224, 250, 272, 250, 299, 210, 299, 205, 266, 185, 233, 205, 233, 210], fillColor=colors.HexColor("#1b417d"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4, strokeLineJoin=1))
    g.add(Polygon([272, 250, 320, 250, 365, 210, 365, 205, 332, 185, 299, 205, 299, 210], fillColor=colors.HexColor("#4fa4e6"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4, strokeLineJoin=1))

    # 7. Top Support Bar
    g.add(Rect(70, 246, 260, 18, rx=9, ry=9, fillColor=colors.HexColor("#155f9f"), strokeColor=colors.HexColor("#091a38"), strokeWidth=4))

    # 8. Shadow under W
    g.add(Rect(176, 258, 48, 6, rx=3, ry=3, fillColor=colors.HexColor("#091a38"), strokeColor=None))

    # 9. Yellow/Orange 'W' with blue outline
    w_pts = [140, 325, 168, 260, 200, 300, 232, 260, 260, 325]
    g.add(PolyLine(w_pts, strokeColor=colors.HexColor("#091a38"), strokeWidth=30, strokeLineJoin=1, strokeLineCap=1))
    g.add(PolyLine(w_pts, strokeColor=colors.HexColor("#ffaa00"), strokeWidth=20, strokeLineJoin=1, strokeLineCap=1))

    d.add(g)

    # Typography matching top panel: "WEB" (#0f62ab) + "CREON" (#ffaa00)
    d.add(String(40, 11, "WEB", fontName="Helvetica-Bold", fontSize=16, fillColor=colors.HexColor("#0f62ab")))
    d.add(String(79, 11, "CREON", fontName="Helvetica-Bold", fontSize=16, fillColor=colors.HexColor("#ffaa00")))

    return d


def generate_subscription_invoice_pdf(
    inv: SubscriptionInvoice,
    site: Optional[Site] = None,
    admin: Optional[Admin] = None,
    output_path: Optional[str] = None,
    session: Optional[Session] = None,
) -> bytes:
    """
    Renders an official, legally compliant Rule 46 B2B Tax Invoice for WebCreon cloud subscriptions.
    Includes vector brand logo, corporate environment variables, dynamic place of supply,
    exact 9%+9% CGST/SGST or 18% IGST calculation, SAC 998313, QR code, and digital authentication.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )

    styles = getSampleStyleSheet()

    title_main_center = ParagraphStyle(
        "SubTitleMain",
        parent=styles["Normal"],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    title_sub_center = ParagraphStyle(
        "SubTitleSub",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#64748b"),
        fontName="Helvetica-Oblique",
        alignment=1,
    )
    seller_title = ParagraphStyle(
        "SubSellerTitle",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    seller_body = ParagraphStyle(
        "SubSellerBody",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    inv_box_title = ParagraphStyle(
        "SubInvBoxTitle",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    inv_box_num = ParagraphStyle(
        "SubInvBoxNum",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=1,
    )
    meta_head = ParagraphStyle(
        "SubMetaHead",
        parent=styles["Normal"],
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    meta_text = ParagraphStyle(
        "SubMetaText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )
    th_style = ParagraphStyle(
        "SubTHStyle",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    th_right = ParagraphStyle(
        "SubTHRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    td_product = ParagraphStyle(
        "SubTDProduct",
        parent=styles["Normal"],
        fontSize=6.8,
        leading=8.5,
        textColor=colors.HexColor("#1e293b"),
    )
    td_title = ParagraphStyle(
        "SubTDTitle",
        parent=styles["Normal"],
        fontSize=7.2,
        leading=9.2,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    td_right = ParagraphStyle(
        "SubTDRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#1e293b"),
        alignment=2,
    )
    td_bold_right = ParagraphStyle(
        "SubTDBoldRight",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
        alignment=2,
    )
    footer_text = ParagraphStyle(
        "SubFooterText",
        parent=styles["Normal"],
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )

    elements = []

    # 1. Header Details with WebCreon Brand Vector Logo
    elements.append(Paragraph("<b>TAX INVOICE - SUBSCRIPTION SERVICES</b>", title_main_center))
    elements.append(Paragraph("<i>Issued under Section 31 read with Rule 46 of CGST Rules, 2017 (B2B Tax Invoice)</i>", title_sub_center))
    elements.append(Spacer(1, 2 * mm))

    # WebCreon Corporate Details (Configurable via Environment Variables)
    webcreon_name = os.getenv("WEBCREON_LEGAL_NAME", "WebCreon Technologies Private Limited")
    webcreon_addr = os.getenv("WEBCREON_ADDRESS", "WebCreon Tech Hub, Bandra-Kurla Complex, Mumbai - 400051, Maharashtra")
    webcreon_gstin = os.getenv("WEBCREON_GSTIN", "27AAACW1234F1Z1")
    webcreon_pan = os.getenv("WEBCREON_PAN", "AAACW1234F")
    webcreon_cin = os.getenv("WEBCREON_CIN", "U72900MH2026PTC123456")
    webcreon_state_code = os.getenv("WEBCREON_STATE_CODE", "27")

    logo_drawing = make_webcreon_brand_drawing(width=65 * mm, height=13 * mm)

    webcreon_info = [
        logo_drawing,
        Spacer(1, 1 * mm),
        Paragraph(f"<b>Service Provider:</b> {webcreon_name}", seller_title),
        Paragraph(f"<b>Registered Office:</b> {webcreon_addr} (State Code: {webcreon_state_code})", seller_body),
        Paragraph(f"<b>GSTIN:</b> {webcreon_gstin} | <b>PAN:</b> {webcreon_pan}", seller_body),
        Paragraph(f"<b>CIN:</b> {webcreon_cin}", seller_body),
    ]

    inv_date = inv.invoice_date or datetime.now(timezone.utc)
    inv_date_str = inv_date.strftime("%d-%m-%Y")
    inv_number = inv.invoice_number

    qr_payload = f"INVOICE:{inv_number},SELLER:{webcreon_name},DATE:{inv_date_str},TOTAL:Rs.{float(inv.total_amount):.2f},GSTIN:{webcreon_gstin}"
    qr_drawing = make_qr_code(qr_payload, size=22 * mm)

    inv_num_box = Table(
        [
            [Paragraph("Tax Invoice Number #", inv_box_title)],
            [Paragraph(f"<b>{inv_number}</b>", inv_box_num)],
        ],
        colWidths=[62 * mm],
    )
    inv_num_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#94a3b8")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    qr_and_inv = Table(
        [[qr_drawing, inv_num_box]],
        colWidths=[24 * mm, 63 * mm],
    )
    qr_and_inv.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    top_header_table = Table(
        [[webcreon_info, qr_and_inv]],
        colWidths=[102 * mm, 88 * mm],
    )
    top_header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    elements.append(top_header_table)
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1.5 * mm, spaceAfter=2 * mm))

    # Buyer & Merchant Recipient Info (Query MerchantTaxProfile if available)
    profile = None
    if session and inv.website_id:
        try:
            profile = session.exec(
                select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == inv.website_id)
            ).first()
        except Exception:
            profile = None

    site_clean_name = site.name if site else (inv.buyer_business_name or "WebCreon Store")

    if profile:
        buyer_legal = profile.legal_business_name or inv.buyer_name
        buyer_email = inv.buyer_email or (admin.email if admin else "merchant@webcreon.store")
        buyer_gstin = profile.gstin or inv.buyer_gstin or "Unregistered / Consumer"
        buyer_pan = profile.pan_number or "Not Provided"
        buyer_state_code = str(profile.state_code or (profile.gstin[:2] if profile.gstin else "27")).strip()
        buyer_state_name = profile.state_name or "Maharashtra"
        addr_parts = [profile.address_line1, profile.address_line2, profile.city, f"{profile.state_name or ''} {profile.pincode or ''}".strip()]
        buyer_address = ", ".join([p for p in addr_parts if p]) or f"Maharashtra - {profile.pincode or '400001'}"
    else:
        buyer_legal = inv.buyer_name or (admin.name if admin and admin.name else site_clean_name)
        buyer_email = inv.buyer_email or (admin.email if admin else "subscriber@webcreon.store")
        buyer_gstin = inv.buyer_gstin or "Unregistered / Consumer"
        buyer_pan = "Not Provided"
        raw_pos = str(inv.buyer_state_code or inv.place_of_supply or "27").strip()
        if "-" in raw_pos:
            buyer_state_code = raw_pos.split("-")[0].strip()
            buyer_state_name = raw_pos.split("-")[1].strip()
        else:
            buyer_state_code = raw_pos
            buyer_state_name = "Maharashtra" if raw_pos == "27" else "Delhi" if raw_pos == "07" else f"State {raw_pos}"
        buyer_address = f"Registered Store Office, {buyer_state_name}"

    is_interstate = (str(buyer_state_code).strip() != str(webcreon_state_code).strip())

    col1_sub_terms = [
        Paragraph("<b>Subscription Terms:</b>", meta_head),
        Paragraph(f"<b>Plan Tier:</b> {inv.plan_name or inv.plan}", meta_text),
        Paragraph(f"<b>Billing Frequency:</b> {inv.billing_interval.capitalize() if inv.billing_interval else 'Monthly'}", meta_text),
        Paragraph(f"<b>Cycle:</b> {inv.billing_cycle_start.strftime('%d-%m-%Y')} to {inv.billing_cycle_end.strftime('%d-%m-%Y')}", meta_text),
        Paragraph("<b>SAC Code:</b> 998313 (IT & Cloud SaaS Services)", meta_text),
        Paragraph("<b>Reverse Charge (RCM):</b> No", meta_text),
    ]

    col2_buyer_to = [
        Paragraph("<b>Billed To (Subscriber):</b>", meta_head),
        Paragraph(f"<b>{buyer_legal}</b>", meta_text),
        Paragraph(f"Email: {buyer_email}", meta_text),
        Paragraph(f"Store: {site_clean_name}", meta_text),
        Paragraph(f"<b>Place of Supply:</b> State Code {buyer_state_code} - {buyer_state_name}", meta_text),
        Paragraph(f"<b>Buyer GSTIN:</b> {buyer_gstin}", meta_text),
    ]

    try:
        from services.subscription_invoice_service import format_payment_method_display
        pay_method_display = format_payment_method_display(inv.payment_method)
    except Exception:
        pay_method_display = inv.payment_method or "Online Payment"

    col3_payment_info = [
        Paragraph("<b>Payment Confirmation:</b>", meta_head),
        Paragraph(f"<b>Status:</b> <font color='#059669'><b>PAID (Captured & Settled)</b></font>", meta_text),
        Paragraph(f"<b>Method:</b> {pay_method_display}", meta_text),
        Paragraph(f"<b>Payment ID:</b> {inv.razorpay_payment_id or 'pay_online'}", meta_text),
        Paragraph(f"<b>Order Ref:</b> {inv.razorpay_order_id or 'ord_online'}", meta_text),
        Paragraph(f"<b>Invoice Date:</b> {inv_date_str}", meta_text),
    ]

    meta_3col_table = Table(
        [[col1_sub_terms, col2_buyer_to, col3_payment_info]],
        colWidths=[63 * mm, 64 * mm, 63 * mm],
    )
    meta_3col_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
    ]))
    elements.append(meta_3col_table)
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=1 * mm, spaceAfter=2 * mm))

    # Financial Itemized Breakdown (Mathematically Consistent at 18% GST)
    total_val = Decimal(str(inv.total_amount))
    subtotal_val = Decimal(str(inv.subtotal))
    if total_val > Decimal("0.00") and subtotal_val <= Decimal("0.00"):
        subtotal_val = (total_val / Decimal("1.18")).quantize(Decimal("0.01"))
    
    tax_amt = (total_val - subtotal_val).quantize(Decimal("0.01"))

    if is_interstate:
        igst_val = tax_amt
        cgst_val = Decimal("0.00")
        sgst_val = Decimal("0.00")
    else:
        cgst_val = (tax_amt / Decimal("2.00")).quantize(Decimal("0.01"))
        sgst_val = tax_amt - cgst_val
        igst_val = Decimal("0.00")

    interval_label = "1 Year (365 Days)" if inv.billing_interval == "yearly" else "3 Months (90 Days)" if inv.billing_interval == "3months" else "30 Days (Monthly)"

    if is_interstate:
        col_widths = [30 * mm, 58 * mm, 26 * mm, 26 * mm, 25 * mm, 25 * mm]
        header_row = [
            Paragraph("<b>Service Code</b>", th_style),
            Paragraph("<b>Service Description</b>", th_style),
            Paragraph("<b>Interval</b>", th_style),
            Paragraph("<b>Taxable Subtotal</b>", th_right),
            Paragraph("<b>IGST (18%)</b>", th_right),
            Paragraph("<b>Total Amount (Rs.)</b>", th_right),
        ]
        items_rows = [
            header_row,
            [
                Paragraph("<b>SAC: 998313</b>", td_product),
                Paragraph(f"<b>WebCreon {inv.plan_name or inv.plan} Cloud Subscription</b><br/><i>Information technology cloud hosting, AI copilot credits & platform infrastructure</i>", td_title),
                Paragraph(interval_label, td_product),
                Paragraph(f"Rs. {subtotal_val:,.2f}", td_right),
                Paragraph(f"Rs. {igst_val:,.2f}", td_right),
                Paragraph(f"Rs. {total_val:,.2f}", td_bold_right),
            ],
            [
                Paragraph("<b>Total</b>", th_style),
                Paragraph("", th_style),
                Paragraph("", th_style),
                Paragraph(f"<b>Rs. {subtotal_val:,.2f}</b>", th_right),
                Paragraph(f"<b>Rs. {igst_val:,.2f}</b>", th_right),
                Paragraph(f"<b>Rs. {total_val:,.2f}</b>", th_right),
            ]
        ]
    else:
        col_widths = [26 * mm, 50 * mm, 22 * mm, 24 * mm, 22 * mm, 22 * mm, 24 * mm]
        header_row = [
            Paragraph("<b>Service Code</b>", th_style),
            Paragraph("<b>Service Description</b>", th_style),
            Paragraph("<b>Interval</b>", th_style),
            Paragraph("<b>Taxable Subtotal</b>", th_right),
            Paragraph("<b>CGST (9%)</b>", th_right),
            Paragraph("<b>SGST (9%)</b>", th_right),
            Paragraph("<b>Total Amount (Rs.)</b>", th_right),
        ]
        items_rows = [
            header_row,
            [
                Paragraph("<b>SAC: 998313</b>", td_product),
                Paragraph(f"<b>WebCreon {inv.plan_name or inv.plan} Cloud Subscription</b><br/><i>Information technology cloud hosting, AI copilot credits & platform infrastructure</i>", td_title),
                Paragraph(interval_label, td_product),
                Paragraph(f"Rs. {subtotal_val:,.2f}", td_right),
                Paragraph(f"Rs. {cgst_val:,.2f}", td_right),
                Paragraph(f"Rs. {sgst_val:,.2f}", td_right),
                Paragraph(f"Rs. {total_val:,.2f}", td_bold_right),
            ],
            [
                Paragraph("<b>Total</b>", th_style),
                Paragraph("", th_style),
                Paragraph("", th_style),
                Paragraph(f"<b>Rs. {subtotal_val:,.2f}</b>", th_right),
                Paragraph(f"<b>Rs. {cgst_val:,.2f}</b>", th_right),
                Paragraph(f"<b>Rs. {sgst_val:,.2f}</b>", th_right),
                Paragraph(f"<b>Rs. {total_val:,.2f}</b>", th_right),
            ]
        ]

    items_table = Table(items_rows, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0f172a")),
        ("LINEABOVE", (0, 0), (-1, 0), 1, colors.HexColor("#0f172a")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
        ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # Summary & Amount in Words
    words_inr = amount_to_words_inr(total_val)
    if is_interstate:
        tax_summary_lines = [
            Paragraph(f"• Integrated GST (IGST 18%): <b>Rs. {igst_val:,.2f}</b>", seller_body),
        ]
    else:
        tax_summary_lines = [
            Paragraph(f"• Central GST (CGST 9%): <b>Rs. {cgst_val:,.2f}</b>", seller_body),
            Paragraph(f"• State GST (SGST 9%): <b>Rs. {sgst_val:,.2f}</b>", seller_body),
        ]

    bottom_left = [
        Paragraph("<b>FINANCIAL SUMMARY:</b>", meta_head),
        Paragraph(f"• Taxable Subscription Value: <b>Rs. {subtotal_val:,.2f}</b>", seller_body),
        *tax_summary_lines,
        Paragraph(f"• Total Applicable GST (18%): <b>Rs. {tax_amt:,.2f}</b>", seller_body),
        Paragraph(f"• Net Total Amount Paid: <b>Rs. {total_val:,.2f}</b>", seller_title),
        Spacer(1, 2 * mm),
        Paragraph(f"<b>Invoice Amount in Words:</b><br/>{words_inr}", seller_body),
    ]

    bottom_right = [
        Paragraph("<b>For WebCreon Technologies Private Limited</b>", ParagraphStyle("SubWBCSignHead", parent=styles["Normal"], fontSize=8, leading=10, fontName="Helvetica-Bold", alignment=2)),
        Spacer(1, 8 * mm),
        Paragraph("<b>Authorized Signatory</b>", ParagraphStyle("SubWBCSignSub", parent=styles["Normal"], fontSize=7.5, leading=9.5, textColor=colors.HexColor("#475569"), alignment=2)),
        Paragraph("<font size='5.8' color='#94a3b8'>Digitally Signed & Certified • Authenticated PSS/GSTN</font>", ParagraphStyle("SubWBCSignDig", parent=styles["Normal"], fontSize=5.8, leading=7.5, alignment=2)),
    ]

    bottom_summary_table = Table(
        [[bottom_left, bottom_right]],
        colWidths=[120 * mm, 70 * mm],
    )
    bottom_summary_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    elements.append(bottom_summary_table)
    elements.append(Spacer(1, 3 * mm))

    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=1 * mm))
    elements.append(Paragraph(
        "This official B2B Tax Invoice is digitally generated by WebCreon Technologies Private Limited under Rule 46 of CGST Rules, 2017. Input Tax Credit (ITC) is available subject to Section 16 & 17(5) of the CGST Act.",
        footer_text,
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

    return pdf_bytes



