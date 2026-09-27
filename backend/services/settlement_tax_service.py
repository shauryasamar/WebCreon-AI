"""
WebCreon AI: Statutory Settlement Tax & Withholding Service (India September 2026)
Enforces:
- Invariant 1: Gross = Net Merchant Payout + Platform Fee with GST (18% SAC 998313) + GST-TCS (0.5% Sec 52) + TDS (0.1%/5% Sec 194-O) + Gateway MDR with GST
- Invariant 2: Product GST collected belongs to the merchant, never platform revenue
- Invariant 3: TCS Ignore-Negative Rule (no negative TCS carried forward)
- Section 194-O TDS: 0.10% standard (with ₹5 Lakh threshold for Individual/HUF, Re 1 for Companies/LLPs), 5% for missing PAN
- Section 52 GST-TCS: 0.50% total net taxable supplies (0.25% CGST + 0.25% SGST intra, or 0.50% IGST inter)
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from sqlmodel import Session, select

from models import (
    MerchantTaxProfile,
    Order,
    TenantBankAccount,
    TenantLedgerEntry,
)
from services.tax_engine import (
    money,
    resolve_gst_state_code,
    get_financial_year,
)

logger = logging.getLogger(__name__)

# Statutory Constants
WEBCREON_STATE_CODE = "27"  # Maharashtra
WEBCREON_LEGAL_NAME = "WebCreon Technologies Private Limited"
WEBCREON_GSTIN = "27AAACW1234F1Z1"
PLATFORM_FEE_SAC_CODE = "998313"
PLATFORM_FEE_GST_RATE = Decimal("18.00")

# Section 52 GST-TCS total rate (September 2026: 0.50%)
GST_TCS_RATE_TOTAL = Decimal("0.50")
GST_TCS_RATE_HALF = Decimal("0.25")

# Section 194-O TDS rates
TDS_194O_STANDARD_RATE = Decimal("0.10")  # Oct 2024 / Sept 2026 standard
TDS_194O_HIGHER_RATE = Decimal("5.00")    # Section 206AA missing/inoperative PAN
TDS_194O_INDIVIDUAL_THRESHOLD = Decimal("500000.00")  # ₹5,00,000 for Ind/HUF

# Gateway MDR estimation (~2% + 18% GST dual 9% CGST + 9% SGST)
GATEWAY_MDR_RATE = Decimal("0.02")
GATEWAY_CGST_RATE = Decimal("0.09")
GATEWAY_SGST_RATE = Decimal("0.09")
GATEWAY_GST_RATE = Decimal("0.18")

# Config flag
ENABLE_COMPLIANT_SETTLEMENT_SPLIT = os.getenv("ENABLE_COMPLIANT_SETTLEMENT_SPLIT", "true").strip().lower() in ("true", "1", "yes")

PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")


@dataclass(frozen=True)
class SettlementBreakdown:
    gross_order_value: Decimal
    taxable_product_value: Decimal
    product_cgst: Decimal
    product_sgst: Decimal
    product_igst: Decimal
    product_cess: Decimal

    # Platform Commission & GST (SAC 998313 @ 18%)
    commission_percent: Decimal
    platform_commission_base: Decimal
    platform_fee_gst_cgst: Decimal
    platform_fee_gst_sgst: Decimal
    platform_fee_gst_igst: Decimal
    total_platform_fee_with_gst: Decimal

    # Section 52 GST-TCS (0.50% net taxable supplies)
    gst_tcs_cgst: Decimal
    gst_tcs_sgst: Decimal
    gst_tcs_igst: Decimal
    total_gst_tcs: Decimal

    # Section 194-O Income-Tax TDS (0.10% or 5.00% on gross)
    tds_rate_applied: Decimal
    income_tax_tds_194o: Decimal
    tds_threshold_exempt: bool

    # Gateway MDR (~2% + 18% GST)
    gateway_fee: Decimal
    gateway_fee_gst: Decimal
    total_gateway_charges: Decimal

    # Final Net Payout to Merchant
    net_merchant_payout: Decimal
    net_merchant_payout_paise: int


def calculate_settlement_split(
    gross_order_value: Decimal,
    taxable_product_value: Decimal,
    product_cgst: Decimal,
    product_sgst: Decimal,
    product_igst: Decimal,
    product_cess: Decimal,
    merchant_profile: Optional[MerchantTaxProfile],
    customer_state_code: str,
    commission_percent: Decimal = Decimal("3.00"),
    estimate_gateway_fee: bool = True,
) -> SettlementBreakdown:
    """
    Deterministically computes all statutory settlement withholding components
    under Indian GST and Income-tax law.
    """
    gross = money(gross_order_value)
    taxable = money(taxable_product_value)

    merchant_state = "27"
    is_composition = False
    is_unregistered = True
    is_gst_registered = False
    entity_type = "individual"
    pan_number = ""
    fy_gross_sales = Decimal("0.00")

    if merchant_profile:
        merchant_state = merchant_profile.state_code or (
            merchant_profile.gstin[:2] if merchant_profile.gstin else "27"
        )
        reg_type_str = str(getattr(merchant_profile, "registration_type", "regular") or "regular").lower()
        if hasattr(getattr(merchant_profile, "registration_type", None), "value"):
            reg_type_str = str(merchant_profile.registration_type.value).lower()

        is_composition = bool(
            getattr(merchant_profile, "is_composition_dealer", False)
            or reg_type_str == "composition"
        )
        is_unregistered = bool(reg_type_str in ("unregistered", "enrolled_eco"))
        is_gst_registered = bool(
            getattr(merchant_profile, "is_gst_registered", None)
            if getattr(merchant_profile, "is_gst_registered", None) is not None
            else (bool(merchant_profile.gstin) and not is_unregistered)
        )
        entity_type_val = getattr(merchant_profile, "entity_type", "individual")
        entity_type = (entity_type_val.value if hasattr(entity_type_val, "value") else str(entity_type_val or "individual")).lower()
        pan_number = (merchant_profile.pan_number or "").strip().upper()
        fy_gross_sales = Decimal(str(merchant_profile.fy_gross_sales_amount or "0.00"))

    # -------------------------------------------------------------
    # 1. PLATFORM COMMISSION + 18% GST (SAC 998313)
    # -------------------------------------------------------------
    comm_pct = money(commission_percent)
    platform_base = money((gross * comm_pct) / Decimal("100.00"))

    # Place of supply for Platform Fee (WebCreon MH -> Merchant State)
    is_platform_fee_intra = (merchant_state == WEBCREON_STATE_CODE)
    if is_platform_fee_intra:
        # CGST 9% + SGST 9%
        plat_cgst = money(platform_base * Decimal("0.09"))
        plat_sgst = money(platform_base * Decimal("0.09"))
        plat_igst = Decimal("0.00")
    else:
        # IGST 18%
        plat_cgst = Decimal("0.00")
        plat_sgst = Decimal("0.00")
        plat_igst = money(platform_base * Decimal("0.18"))

    total_platform_fee = money(platform_base + plat_cgst + plat_sgst + plat_igst)

    # -------------------------------------------------------------
    # 2. SECTION 52 GST-TCS (0.50% ON NET TAXABLE PRODUCT VALUE)
    # -------------------------------------------------------------
    # Does not apply to unregistered sellers or composition dealers
    tcs_applicable = is_gst_registered and not is_composition and not is_unregistered
    tcs_cgst = Decimal("0.00")
    tcs_sgst = Decimal("0.00")
    tcs_igst = Decimal("0.00")
    total_tcs = Decimal("0.00")

    if tcs_applicable and taxable > Decimal("0.00"):
        # POS between Merchant and Customer
        is_product_intra = (merchant_state == customer_state_code)
        if is_product_intra:
            # 0.25% CGST + 0.25% SGST
            tcs_cgst = money((taxable * GST_TCS_RATE_HALF) / Decimal("100.00"))
            tcs_sgst = money((taxable * GST_TCS_RATE_HALF) / Decimal("100.00"))
            total_tcs = money(tcs_cgst + tcs_sgst)
        else:
            # 0.50% IGST
            tcs_igst = money((taxable * GST_TCS_RATE_TOTAL) / Decimal("100.00"))
            total_tcs = tcs_igst

    # -------------------------------------------------------------
    # 3. SECTION 194-O INCOME-TAX TDS (ON GROSS ORDER VALUE)
    # -------------------------------------------------------------
    # CBDT Circular No. 17/2020: Base is gross amount of sales inclusive of GST
    has_valid_pan = bool(PAN_REGEX.match(pan_number))
    tds_rate = TDS_194O_STANDARD_RATE if has_valid_pan else TDS_194O_HIGHER_RATE

    is_individual_or_huf = entity_type in ("individual", "huf", "proprietorship", "sole_proprietorship")
    cumulative_sales_after_order = fy_gross_sales + gross

    tds_exempt = False
    if has_valid_pan and is_individual_or_huf and cumulative_sales_after_order <= TDS_194O_INDIVIDUAL_THRESHOLD:
        tds_exempt = True
        tds_amount = Decimal("0.00")
    else:
        tds_amount = money((gross * tds_rate) / Decimal("100.00"))

    # -------------------------------------------------------------
    # 4. PAYMENT GATEWAY MDR (~2% + 18% GST dual 9% CGST + 9% SGST)
    # -------------------------------------------------------------
    if estimate_gateway_fee:
        gw_fee = money(gross * GATEWAY_MDR_RATE)
        # Razorpay in India bills dual 9% CGST + 9% SGST with component-level paisa rounding
        # (e.g. ₹243.00 => Base=₹4.86, CGST 9%=₹0.44, SGST 9%=₹0.44 => Total GST=₹0.88 => Total GW Fee=₹5.74)
        gw_cgst = money(gw_fee * GATEWAY_CGST_RATE)
        gw_sgst = money(gw_fee * GATEWAY_SGST_RATE)
        gw_fee_gst = money(gw_cgst + gw_sgst)
        total_gw = money(gw_fee + gw_fee_gst)
    else:
        gw_fee = Decimal("0.00")
        gw_fee_gst = Decimal("0.00")
        total_gw = Decimal("0.00")

    # -------------------------------------------------------------
    # 5. NET MERCHANT PAYOUT & INVARIANT 1 ENFORCEMENT
    # -------------------------------------------------------------
    total_deductions = total_platform_fee + total_tcs + tds_amount + total_gw
    net_payout = max(Decimal("0.00"), money(gross - total_deductions))

    # Exact penny reconciliation for Invariant 1: Gross == Net Payout + Deductions
    sum_components = net_payout + total_platform_fee + total_tcs + tds_amount + total_gw
    diff = money(gross - sum_components)
    if diff != Decimal("0.00") and net_payout > Decimal("0.00"):
        # Absorb 1-2 paise rounding diff into merchant payout
        net_payout = money(net_payout + diff)

    net_paise = int(net_payout * 100)

    return SettlementBreakdown(
        gross_order_value=gross,
        taxable_product_value=taxable,
        product_cgst=product_cgst,
        product_sgst=product_sgst,
        product_igst=product_igst,
        product_cess=product_cess,
        commission_percent=comm_pct,
        platform_commission_base=platform_base,
        platform_fee_gst_cgst=plat_cgst,
        platform_fee_gst_sgst=plat_sgst,
        platform_fee_gst_igst=plat_igst,
        total_platform_fee_with_gst=total_platform_fee,
        gst_tcs_cgst=tcs_cgst,
        gst_tcs_sgst=tcs_sgst,
        gst_tcs_igst=tcs_igst,
        total_gst_tcs=total_tcs,
        tds_rate_applied=Decimal("0.00") if tds_exempt else tds_rate,
        income_tax_tds_194o=tds_amount,
        tds_threshold_exempt=tds_exempt,
        gateway_fee=gw_fee,
        gateway_fee_gst=gw_fee_gst,
        total_gateway_charges=total_gw,
        net_merchant_payout=net_payout,
        net_merchant_payout_paise=net_paise,
    )


def compute_and_record_order_settlement(
    session: Session,
    order: Order,
    admin_id: UUID,
    commission_percent: Optional[Decimal] = None,
    razorpay_transfer_id: Optional[str] = None,
    transfer_status: Optional[str] = "held",
    ledger_status: str = "in_escrow",
    escrow_status: str = "held",
    settled_at: Optional[datetime] = None,
    customer_state_code: Optional[str] = None,
) -> TenantLedgerEntry:
    """
    Atomically calculates the statutory settlement split and creates or updates
    the multi-component TenantLedgerEntry. Also updates FY gross sales counter.
    """
    now = datetime.now(timezone.utc)
    profile = session.exec(
        select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == order.site_id)
    ).first()

    if customer_state_code:
        dest_state = str(customer_state_code).strip()
    else:
        shipping_addr = order.shipping_address if isinstance(order.shipping_address, dict) else {}
        dest_state = resolve_gst_state_code(
            state_code=shipping_addr.get("state_code") or shipping_addr.get("stateCode"),
            state_name=shipping_addr.get("state") or shipping_addr.get("state_name"),
            postal_code=shipping_addr.get("postal_code") or shipping_addr.get("postalCode"),
            default=profile.state_code if profile else "27",
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

    comm_pct = commission_percent or Decimal("3.00")

    breakdown = calculate_settlement_split(
        gross_order_value=Decimal(str(order.total)),
        taxable_product_value=taxable_val,
        product_cgst=cgst_val,
        product_sgst=sgst_val,
        product_igst=igst_val,
        product_cess=cess_val,
        merchant_profile=profile,
        customer_state_code=dest_state,
        commission_percent=comm_pct,
        estimate_gateway_fee=True,
    )

    ledger_entry = session.exec(
        select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
    ).first()

    if not ENABLE_COMPLIANT_SETTLEMENT_SPLIT and order.tenant_share is not None and order.platform_fee is not None:
        p_fee = order.platform_fee
        t_share = order.tenant_share
    else:
        p_fee = breakdown.total_platform_fee_with_gst
        t_share = breakdown.net_merchant_payout

    if not ledger_entry:
        ledger_entry = TenantLedgerEntry(
            admin_id=admin_id,
            site_id=order.site_id,
            order_id=order.id,
            gross_amount=order.total,
            platform_fee_percent=breakdown.commission_percent,
            platform_fee=p_fee,
            tenant_share=t_share,
            currency="INR",
            status=ledger_status,
            escrow_status=escrow_status,
            razorpay_transfer_id=razorpay_transfer_id,
            transfer_status=transfer_status,
            settled_at=settled_at,
            created_at=order.created_at or now,
            updated_at=now,
        )
    else:
        ledger_entry.platform_fee = p_fee
        ledger_entry.tenant_share = t_share
        if order.created_at and ledger_entry.created_at != order.created_at:
            ledger_entry.created_at = order.created_at

    # Populate all multi-component statutory fields
    ledger_entry.entry_type = "order_sale"
    ledger_entry.gross_order_value = breakdown.gross_order_value
    ledger_entry.taxable_product_value = breakdown.taxable_product_value
    ledger_entry.product_cgst = breakdown.product_cgst
    ledger_entry.product_sgst = breakdown.product_sgst
    ledger_entry.product_igst = breakdown.product_igst
    ledger_entry.product_cess = breakdown.product_cess
    ledger_entry.platform_commission_base = breakdown.platform_commission_base
    ledger_entry.platform_fee_gst_cgst = breakdown.platform_fee_gst_cgst
    ledger_entry.platform_fee_gst_sgst = breakdown.platform_fee_gst_sgst
    ledger_entry.platform_fee_gst_igst = breakdown.platform_fee_gst_igst
    ledger_entry.total_platform_fee_with_gst = breakdown.total_platform_fee_with_gst
    ledger_entry.gst_tcs_cgst = breakdown.gst_tcs_cgst
    ledger_entry.gst_tcs_sgst = breakdown.gst_tcs_sgst
    ledger_entry.gst_tcs_igst = breakdown.gst_tcs_igst
    ledger_entry.total_gst_tcs = breakdown.total_gst_tcs
    ledger_entry.tds_rate_applied = breakdown.tds_rate_applied
    ledger_entry.income_tax_tds_194o = breakdown.income_tax_tds_194o
    ledger_entry.gateway_fee = breakdown.gateway_fee
    ledger_entry.gateway_fee_gst = breakdown.gateway_fee_gst
    ledger_entry.net_merchant_payout = breakdown.net_merchant_payout
    ledger_entry.updated_at = now

    session.add(ledger_entry)

    # Atomically synchronize authoritative FY gross sales amount for Section 194-O tracking
    if profile:
        profile.fy_gross_sales_amount = compute_live_fy_gross_sales(
            session=session,
            site_id=order.site_id,
            fy=profile.current_fy,
        )
        profile.updated_at = now
        session.add(profile)

    return ledger_entry


def compute_live_fy_gross_sales(
    session: Session,
    site_id: Optional[UUID] = None,
    fy: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Decimal:
    """
    Authoritative single source of truth for cumulative Gross Sales (GMV) across
    Tenant Earnings, Form 26Q TDS Tracker, and Merchant Tax KYC Profile.

    Strictly aligns with Earnings & Ledger accounting rules:
    - Counts only genuine orders (Paid/settled online orders and active COD orders).
    - Excludes cancelled, returned, refunded, and draft checkouts.
    - Filters by start_date/end_date or Financial Year (1 April - 31 March) when provided.
    """
    order_stmt = select(Order)
    if site_id:
        order_stmt = order_stmt.where(Order.site_id == site_id)
    orders = session.exec(order_stmt).all()
    if not orders:
        return Decimal("0.00")

    ledger_stmt = select(TenantLedgerEntry).where(
        TenantLedgerEntry.status != "unpaid"
    )
    if site_id:
        ledger_stmt = ledger_stmt.where(TenantLedgerEntry.site_id == site_id)
    ledger_entries = session.exec(ledger_stmt).all()
    ledger_by_order = {l.order_id: l for l in ledger_entries}

    start_fy, end_fy = start_date, end_date
    if not start_fy and not end_fy and fy:
        try:
            if "-" in fy:
                sy, ey = int(fy.split("-")[0].strip()), int(fy.split("-")[1].strip())
            else:
                sy = int(fy)
                ey = sy + 1
            start_fy = datetime(sy, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
            end_fy = datetime(ey, 3, 31, 23, 59, 59, tzinfo=timezone.utc)
        except Exception:
            start_fy, end_fy = None, None

    total_gross = Decimal("0.00")
    for order in orders:
        # Check cancellation/return status
        is_cancelled_or_refunded = (
            order.status in ("cancelled", "returned", "refunded")
            or getattr(order, "payment_status", None) == "refunded"
        )
        ledger = ledger_by_order.get(order.id)
        if ledger and (ledger.status in ("refunded", "reversed") or getattr(ledger, "escrow_status", None) == "reversed"):
            is_cancelled_or_refunded = True

        if is_cancelled_or_refunded:
            continue

        # Check payment classification
        pm = (order.payment_method or "").strip().lower()
        is_cod = (
            pm in ("cod", "cash on delivery", "cash_on_delivery", "cash", "offline", "cash_delivery", "cash on collection")
            or "cod" in pm
            or "cash" in pm
            or (not getattr(order, "razorpay_payment_id", None) and not getattr(order, "razorpay_order_id", None) and pm not in ("online", "razorpay", "upi", "card", "credit_card", "debit_card", "netbanking", "wallet", "prepaid"))
        )
        has_captured = (
            getattr(order, "payment_status", "") in ("paid", "completed", "settled")
            or bool(getattr(order, "razorpay_payment_id", None))
        )

        if not is_cod and not has_captured:
            continue

        # Check FY date
        o_date = order.created_at
        if o_date:
            if o_date.tzinfo is None:
                o_date = o_date.replace(tzinfo=timezone.utc)
            if start_fy and end_fy and not (start_fy <= o_date <= end_fy):
                continue

        # Gross value: strictly match ledger gross_amount or order total
        gross = Decimal(str(ledger.gross_amount)) if (ledger and ledger.gross_amount is not None) else Decimal(str(order.total or "0.00"))
        total_gross += gross

    return money(total_gross)

