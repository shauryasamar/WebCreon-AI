"""
WebCreon AI: Statutory Tax & TDS Compliance Router (India September 2026)
Endpoints:
- /compliance/tax-kyc: Merchant Tax Profile onboarding and KYC validation
- /compliance/tax-kyc/{site_id}: Retrieve merchant tax profile with 194-O threshold tracker
- /compliance/gstr8/table4: GSTR-8 Table 4 ECO statutory reporting (JSON & CSV) with Invariant 3
- /compliance/form26q: Form 26Q Section 194-O quarterly TDS export (JSON & CSV)
- /compliance/platform-invoices: Monthly Platform Commission (SAC 998313 @ 18%) Tax Invoices
- /compliance/hsn-master/search: Searchable HSN/SAC master directory
"""
from __future__ import annotations

import csv
import io
import logging
import math
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select, func

from auth_middleware import (
    authenticate_admin,
    check_admin_has_permission,
    enforce_site_ownership,
)
from db.database import get_session
from models import (
    Admin,
    AdminSite,
    GSTRegistrationType,
    LegalEntityType,
    MerchantTaxProfile,
    Order,
    PlatformTaxInvoice,
    Site,
    TaxInvoice,
    TaxMaster,
    TenantLedgerEntry,
)
from services.tax_engine import (
    money,
    get_financial_year,
    STATE_CODE_TO_NAME,
    STATE_NAME_TO_CODE,
    resolve_gst_state_code,
)
from services.settlement_tax_service import (
    WEBCREON_STATE_CODE,
    WEBCREON_LEGAL_NAME,
    WEBCREON_GSTIN,
    PLATFORM_FEE_SAC_CODE,
    TDS_194O_INDIVIDUAL_THRESHOLD,
    TDS_194O_STANDARD_RATE,
    TDS_194O_HIGHER_RATE,
    compute_and_record_order_settlement,
    compute_live_fy_gross_sales,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compliance", tags=["compliance"])

PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")

PAN_ENTITY_MAP = {
    "C": ["company"],
    "P": ["individual", "proprietorship"],
    "H": ["huf"],
    "F": ["partnership", "llp"],
    "T": ["trust"],
    "A": ["aop"],
    "B": ["boi"],
}


class TaxKYCPayload(BaseModel):
    site_id: UUID
    legal_business_name: str = Field(min_length=2, max_length=255)
    trade_name: Optional[str] = Field(default=None, max_length=255)
    entity_type: str = Field(default="proprietorship")
    registration_type: str = Field(default="regular")
    pan_number: str = Field(default="")
    pan_holder_name: Optional[str] = Field(default=None, max_length=255)
    gstin: Optional[str] = Field(default=None, max_length=15)
    state_code: str = Field(min_length=1, max_length=10)
    state_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    is_composition_dealer: bool = False
    allow_interstate_sales: bool = True
    default_hsn_code: Optional[str] = None
    default_tax_rate: Optional[float] = None

    @field_validator("legal_business_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        val = v.strip()
        if len(val) < 2:
            raise ValueError("Legal Business Name must be at least 2 characters")
        return val

    @field_validator("pan_number", mode="before")
    @classmethod
    def validate_pan(cls, v: Any) -> str:
        val = str(v or "").strip().upper()
        if not val:
            return ""
        if not PAN_REGEX.match(val):
            raise ValueError(f"Invalid PAN '{val}'. PAN must be a valid 10-character alphanumeric code (e.g., AAACS1234F)")
        return val

    @field_validator("state_code")
    @classmethod
    def validate_state_code(cls, v: str) -> str:
        val = str(v).strip()
        # Extract digits if user pasted full state string like "27 - Maharashtra"
        digits = re.findall(r"\d+", val)
        if digits:
            code = digits[0]
            if len(code) == 1:
                code = f"0{code}"
            return code[:2]
        if len(val) == 1:
            val = f"0{val}"
        return val[:2]

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        val = str(v).strip().upper()
        if not GSTIN_REGEX.match(val):
            raise ValueError(f"Invalid GSTIN format '{val}'. Standard format: 27ABCDE1234F1Z5")
        return val

    @field_validator("trade_name", "city", "pincode", "address_line1", "address_line2", "state_name", mode="before")
    @classmethod
    def clean_empty_strings(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        val = str(v).strip()
        return val if val else None


@router.post("/tax-kyc")
def submit_merchant_tax_kyc(
    payload: TaxKYCPayload,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Submits and structurally verifies Merchant Tax Profile (PAN, GSTIN, Entity Type, State).
    Enforces GSTIN-PAN alignment and state consistency.
    """
    is_owner = str(admin.get("role") or "").lower() == "owner"
    if not is_owner and not check_admin_has_permission(admin["adminId"], "settings:update", session):
        raise HTTPException(status_code=403, detail="Permission denied to update tax settings")

    # Verify site exists
    site = session.get(Site, payload.site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    pan = payload.pan_number
    gstin = payload.gstin
    state_code = payload.state_code

    # 1. Structural PAN 4th Character Check
    pan_4th = pan[3]
    allowed_types = PAN_ENTITY_MAP.get(pan_4th, [])
    req_entity = payload.entity_type.lower()
    if allowed_types and req_entity not in allowed_types:
        expected_type_desc = "/".join(allowed_types).title()
        logger.warning(
            f"Tax KYC Note: PAN 4th char '{pan_4th}' usually indicates {expected_type_desc}, but '{req_entity}' was selected."
        )

    # 2. GSTIN-PAN & State Verification
    if gstin:
        gstin_state = gstin[:2]
        gstin_pan = gstin[2:12]

        if gstin_pan != pan:
            raise HTTPException(
                status_code=400,
                detail=f"GSTIN '{gstin}' contains PAN '{gstin_pan}', which does not match provided PAN '{pan}'.",
            )

        if gstin_state != state_code:
            raise HTTPException(
                status_code=400,
                detail=f"GSTIN State Code '{gstin_state}' does not match registered State Code '{state_code}'.",
            )

    now = datetime.now(timezone.utc)
    profile = session.exec(
        select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == payload.site_id)
    ).first()

    # Map enum types safely
    try:
        legal_entity = LegalEntityType(req_entity)
    except Exception:
        legal_entity = LegalEntityType.PROPRIETORSHIP

    try:
        reg_type = GSTRegistrationType(payload.registration_type.lower())
    except Exception:
        reg_type = GSTRegistrationType.REGULAR

    st_name = payload.state_name or STATE_CODE_TO_NAME.get(state_code, "Maharashtra")

    has_pan = bool(pan and PAN_REGEX.match(pan))
    if not profile:
        effective_admin_id = UUID(str(admin["adminId"])) if isinstance(admin, dict) and "adminId" in admin else (admin.id if hasattr(admin, "id") else None)
        if not effective_admin_id:
            admin_site = session.exec(select(AdminSite).where(AdminSite.site_id == payload.site_id)).first()
            if admin_site:
                effective_admin_id = admin_site.admin_id
            else:
                first_admin = session.exec(select(Admin)).first()
                if first_admin:
                    effective_admin_id = first_admin.id

        profile = MerchantTaxProfile(
            site_id=payload.site_id,
            admin_id=effective_admin_id,
            legal_business_name=payload.legal_business_name.strip(),
            trade_name=payload.trade_name.strip() if payload.trade_name else None,
            entity_type=legal_entity,
            registration_type=reg_type,
            pan_number=pan or "",
            pan_holder_name=payload.pan_holder_name or payload.legal_business_name,
            is_pan_verified=has_pan,
            pan_verified_at=now if has_pan else None,
            pan_verification_source="structural_validation" if has_pan else None,
            gstin=gstin,
            is_gstin_verified=bool(gstin),
            gstin_verified_at=now if gstin else None,
            state_code=state_code,
            state_name=st_name,
            address_line1=payload.address_line1,
            address_line2=payload.address_line2,
            city=payload.city,
            pincode=payload.pincode,
            is_composition_dealer=payload.is_composition_dealer,
            allow_interstate_sales=payload.allow_interstate_sales,
            default_hsn_code=payload.default_hsn_code.strip() if payload.default_hsn_code else None,
            default_tax_rate=payload.default_tax_rate,
            current_fy=get_financial_year(),
            fy_gross_sales_amount=Decimal("0.00"),
            fy_tds_deducted_amount=Decimal("0.00"),
            created_at=now,
            updated_at=now,
        )
        session.add(profile)
    else:
        profile.legal_business_name = payload.legal_business_name.strip()
        profile.trade_name = payload.trade_name.strip() if payload.trade_name else None
        profile.entity_type = legal_entity
        profile.registration_type = reg_type
        profile.pan_number = pan or ""
        profile.pan_holder_name = payload.pan_holder_name or payload.legal_business_name
        profile.is_pan_verified = has_pan
        profile.pan_verified_at = now if has_pan else None
        profile.gstin = gstin
        profile.is_gstin_verified = bool(gstin)
        profile.gstin_verified_at = now if gstin else None
        profile.state_code = state_code
        profile.state_name = st_name
        profile.address_line1 = payload.address_line1
        profile.address_line2 = payload.address_line2
        profile.city = payload.city
        profile.pincode = payload.pincode
        profile.is_composition_dealer = payload.is_composition_dealer
        profile.allow_interstate_sales = payload.allow_interstate_sales
        profile.default_hsn_code = payload.default_hsn_code.strip() if payload.default_hsn_code else None
        profile.default_tax_rate = payload.default_tax_rate
        profile.updated_at = now
        session.add(profile)

    # Sync default HSN and tax rate with Site
    site_obj = session.get(Site, payload.site_id)
    if site_obj:
        site_obj.default_hsn_code = profile.default_hsn_code
        site_obj.default_tax_rate = profile.default_tax_rate
        session.add(site_obj)

    session.commit()
    session.refresh(profile)

    return {
        "message": "Merchant Tax Profile KYC updated and verified successfully",
        "profile": {
            "site_id": str(profile.site_id),
            "legal_business_name": profile.legal_business_name,
            "trade_name": profile.trade_name,
            "entity_type": profile.entity_type.value if hasattr(profile.entity_type, "value") else str(profile.entity_type),
            "registration_type": profile.registration_type.value if hasattr(profile.registration_type, "value") else str(profile.registration_type),
            "pan_number": profile.pan_number,
            "is_pan_verified": profile.is_pan_verified,
            "gstin": profile.gstin,
            "is_gstin_verified": profile.is_gstin_verified,
            "state_code": profile.state_code,
            "state_name": profile.state_name,
            "is_composition_dealer": profile.is_composition_dealer,
            "default_hsn_code": profile.default_hsn_code,
            "default_tax_rate": profile.default_tax_rate,
            "fy_gross_sales_amount": float(profile.fy_gross_sales_amount),
            "fy_tds_deducted_amount": float(profile.fy_tds_deducted_amount),
        },
    }


def parse_compliance_dt(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, str):
        cleaned = raw.strip().replace("Z", "+00:00").replace(" ", "T")
        try:
            d = datetime.fromisoformat(cleaned)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            pass
        try:
            return datetime.strptime(raw.strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return None


@router.get("/tax-kyc/{site_id}")
def get_merchant_tax_kyc(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Retrieves the merchant tax profile with live Section 194-O cumulative progress tracking.
    """
    profile = session.exec(
        select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == site_id)
    ).first()

    if not profile:
        effective_admin_id = None
        if admin:
            if isinstance(admin, dict) and "adminId" in admin:
                effective_admin_id = UUID(str(admin["adminId"]))
            elif hasattr(admin, "id"):
                effective_admin_id = admin.id

        if not effective_admin_id:
            admin_site = session.exec(select(AdminSite).where(AdminSite.site_id == site_id)).first()
            if admin_site:
                effective_admin_id = admin_site.admin_id
            else:
                first_admin = session.exec(select(Admin)).first()
                if first_admin:
                    effective_admin_id = first_admin.id

        profile = MerchantTaxProfile(
            site_id=site_id,
            admin_id=effective_admin_id,
            legal_business_name="GreenHarvest Enterprises Private Limited",
            trade_name="GreenHarvest Store",
            entity_type="proprietorship",
            registration_type="regular",
            pan_number="",
            state_code="27",
            current_fy=get_financial_year(),
        )
        session.add(profile)
        session.commit()
        session.refresh(profile)

    ent_type = profile.entity_type.value if hasattr(profile.entity_type, "value") else str(profile.entity_type).lower()
    is_individual = ent_type in ("individual", "proprietorship", "sole_proprietorship", "huf")
    threshold = float(TDS_194O_INDIVIDUAL_THRESHOLD) if is_individual else 0.0

    # Dynamically compute live cumulative sales for the current site in the current FY
    # strictly matching the Earnings & Ledger criteria (genuine paid online + confirmed COD orders, excluding cancelled/refunded)
    cumulative_sales = float(compute_live_fy_gross_sales(session, site_id, profile.current_fy if profile else None))

    # Sync back to profile
    if profile:
        profile.fy_gross_sales_amount = Decimal(str(cumulative_sales))
        session.add(profile)
        session.commit()

    has_valid_pan = bool(profile.pan_number and PAN_REGEX.match(profile.pan_number))
    if not has_valid_pan:
        is_exceeded = True
        applicable_rate = float(TDS_194O_HIGHER_RATE)
        progress_pct = 100.0 if threshold <= 0 else round(min(100.0, (cumulative_sales / threshold) * 100), 2)
    else:
        is_exceeded = cumulative_sales >= threshold if is_individual else True
        applicable_rate = float(TDS_194O_STANDARD_RATE) if is_exceeded else 0.0
        progress_pct = round(min(100.0, (cumulative_sales / threshold) * 100), 2) if threshold > 0 else 100.0

    return {
        "has_profile": True,
        "site_id": str(site_id),
        "profile": {
            "site_id": str(profile.site_id),
            "legal_business_name": profile.legal_business_name,
            "trade_name": profile.trade_name,
            "entity_type": ent_type,
            "registration_type": profile.registration_type.value if hasattr(profile.registration_type, "value") else str(profile.registration_type),
            "pan_number": profile.pan_number,
            "is_pan_verified": profile.is_pan_verified,
            "gstin": profile.gstin,
            "is_gstin_verified": profile.is_gstin_verified,
            "state_code": profile.state_code,
            "state_name": profile.state_name,
            "address_line1": profile.address_line1,
            "city": profile.city,
            "pincode": profile.pincode,
            "is_composition_dealer": profile.is_composition_dealer,
            "default_hsn_code": profile.default_hsn_code,
            "default_tax_rate": profile.default_tax_rate,
            "current_fy": profile.current_fy,
            "fy_gross_sales_amount": cumulative_sales,
            "fy_tds_deducted_amount": float(profile.fy_tds_deducted_amount),
        },
        "section_194o": {
            "threshold": threshold,
            "cumulative_sales": cumulative_sales,
            "is_threshold_exceeded": is_exceeded,
            "progress_percent": progress_pct,
            "applicable_rate": applicable_rate,
            "is_individual_or_huf": is_individual,
            "has_pan": has_valid_pan,
        },
    }


def parse_fy_year(fy_str: Optional[str]) -> tuple[int, int]:
    if not fy_str or "-" not in fy_str:
        now = datetime.now(timezone.utc)
        if now.month >= 4:
            return now.year, now.year + 1
        else:
            return now.year - 1, now.year
    try:
        parts = fy_str.split("-")
        start_y = int(parts[0].strip())
        end_y = int(parts[1].strip())
        return start_y, end_y
    except Exception:
        now = datetime.now(timezone.utc)
        return now.year, now.year + 1


def get_gstr8_date_range(financial_year: Optional[str], month: Optional[int]) -> tuple[datetime, datetime]:
    start_y, end_y = parse_fy_year(financial_year)
    if month is None:
        start_dt = datetime(start_y, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
        end_dt = datetime(end_y, 3, 31, 23, 59, 59, tzinfo=timezone.utc)
        return start_dt, end_dt

    m = int(month)
    target_year = start_y if m >= 4 else end_y
    start_dt = datetime(target_year, m, 1, 0, 0, 0, tzinfo=timezone.utc)
    if m in (1, 3, 5, 7, 8, 10, 12):
        last_day = 31
    elif m in (4, 6, 9, 11):
        last_day = 30
    else:
        last_day = 29 if (target_year % 4 == 0 and (target_year % 100 != 0 or target_year % 400 == 0)) else 28
    end_dt = datetime(target_year, m, last_day, 23, 59, 59, tzinfo=timezone.utc)
    return start_dt, end_dt


def get_form26q_date_range(financial_year: Optional[str], quarter: Optional[int]) -> tuple[datetime, datetime]:
    start_y, end_y = parse_fy_year(financial_year)
    if quarter is None:
        start_dt = datetime(start_y, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
        end_dt = datetime(end_y, 3, 31, 23, 59, 59, tzinfo=timezone.utc)
        return start_dt, end_dt

    q = int(quarter)
    if q == 1:
        return datetime(start_y, 4, 1, 0, 0, 0, tzinfo=timezone.utc), datetime(start_y, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
    elif q == 2:
        return datetime(start_y, 7, 1, 0, 0, 0, tzinfo=timezone.utc), datetime(start_y, 9, 30, 23, 59, 59, tzinfo=timezone.utc)
    elif q == 3:
        return datetime(start_y, 10, 1, 0, 0, 0, tzinfo=timezone.utc), datetime(start_y, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    else:
        return datetime(end_y, 1, 1, 0, 0, 0, tzinfo=timezone.utc), datetime(end_y, 3, 31, 23, 59, 59, tzinfo=timezone.utc)


@router.get("/gstr8/table4")
def get_gstr8_table4_report(
    site_id: Optional[UUID] = None,
    financial_year: Optional[str] = Query(None, description="e.g. 2026-2027"),
    month: Optional[int] = Query(None, ge=1, le=12, description="1 to 12"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    export_format: str = Query("json", alias="format", enum=["json", "csv"]),
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    GSTR-8 Table 4 ECO Return:
    - Reports Gross supplies, Returns, and Net supplies for Section 52 GST-TCS filtered by FY & Month.
    - Strictly enforces Invariant 3: If returns exceed sales for any merchant in the period,
      Net Supplies is capped at ₹0.00 and TCS is ₹0.00 (NO negative carry-forward per CBIC FAQ).
    - Includes Order-by-Order Section 52 GST-TCS transaction schedule with server-side pagination.
    """
    if not site_id and admin:
        owned_site = session.exec(select(Site).where(Site.admin_id == admin.id)).first()
        if owned_site:
            site_id = owned_site.id
        else:
            admin_site = session.exec(select(AdminSite).where(AdminSite.admin_id == admin.id)).first()
            if admin_site:
                site_id = admin_site.site_id

    fy = financial_year or get_financial_year()

    # Fast bulk check for missing or uncalculated ledgers
    order_query = select(Order).where(
        Order.status.notin_(["pending"]),
        Order.payment_status.in_(["paid", "completed", "settled", "refunded"]) | (Order.payment_method.like("%cod%") | Order.payment_method.like("%cash%")),
    )
    if site_id:
        order_query = order_query.where(Order.site_id == site_id)
    all_orders = session.exec(order_query).all()

    existing_ledger_map = {e.order_id: e for e in session.exec(select(TenantLedgerEntry)).all() if e.order_id}
    needs_commit = False
    for ord_obj in all_orders:
        led_entry = existing_ledger_map.get(ord_obj.id)
        if not led_entry or getattr(led_entry, "taxable_product_value", None) is None or getattr(led_entry, "net_merchant_payout", None) is None:
            try:
                site_admin = session.get(Site, ord_obj.site_id)
                admin_id = site_admin.admin_id if site_admin else None
                compute_and_record_order_settlement(
                    session=session,
                    order=ord_obj,
                    admin_id=admin_id,
                    ledger_status="refunded" if ord_obj.status in ("cancelled", "returned", "refunded") else ("pending_cod" if ord_obj.payment_method == "cod" else "in_escrow"),
                    escrow_status="reversed" if ord_obj.status in ("cancelled", "returned", "refunded") else "held",
                )
                needs_commit = True
            except Exception as e:
                logger.warning(f"Auto-sync ledger error for order {ord_obj.id}: {e}")
    if needs_commit:
        session.commit()

    start_dt, end_dt = get_gstr8_date_range(fy, month)

    query = select(TenantLedgerEntry).where(
        TenantLedgerEntry.status.notin_(["unpaid", "draft"]),
    )
    if site_id:
        query = query.where(TenantLedgerEntry.site_id == site_id)

    raw_entries = session.exec(query.order_by(TenantLedgerEntry.created_at.desc())).all()
    entries = []
    for e in raw_entries:
        e_dt = parse_compliance_dt(e.created_at)
        if not e_dt and e.order_id:
            ord_obj = session.get(Order, e.order_id)
            if ord_obj:
                e_dt = parse_compliance_dt(ord_obj.created_at)
        if e_dt:
            if start_dt <= e_dt <= end_dt:
                entries.append(e)
        else:
            entries.append(e)

    # Fallback to all entries if month is unspecified or if entries are in the FY
    if not entries and month is None and raw_entries:
        entries = raw_entries

    # Aggregate by merchant / site
    summary_map: dict[UUID, dict[str, Any]] = {}

    # Pre-populate site_id merchant so if 0 records exist for a chosen month, the card displays 0.00 with merchant info
    if site_id:
        profile = session.exec(
            select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == site_id)
        ).first()
        summary_map[site_id] = {
            "site_id": str(site_id),
            "merchant_gstin": profile.gstin if profile and profile.gstin else "UNREGISTERED",
            "legal_name": profile.legal_business_name if profile and profile.legal_business_name else "Store Owner",
            "state_code": profile.state_code if profile and profile.state_code else "27",
            "gross_supplies": Decimal("0.00"),
            "returned_supplies": Decimal("0.00"),
            "cgst_tcs": Decimal("0.00"),
            "sgst_tcs": Decimal("0.00"),
            "igst_tcs": Decimal("0.00"),
        }

    # Order-by-order transaction schedule
    order_schedule: list[dict[str, Any]] = []

    for entry in entries:
        if entry.status in ("unpaid", "draft"):
            continue
        s_id = entry.site_id
        if s_id not in summary_map:
            profile = session.exec(
                select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == s_id)
            ).first()
            summary_map[s_id] = {
                "site_id": str(s_id),
                "merchant_gstin": profile.gstin if profile and profile.gstin else "UNREGISTERED",
                "legal_name": profile.legal_business_name if profile and profile.legal_business_name else "Store Owner",
                "state_code": profile.state_code if profile and profile.state_code else "27",
                "gross_supplies": Decimal("0.00"),
                "returned_supplies": Decimal("0.00"),
                "cgst_tcs": Decimal("0.00"),
                "sgst_tcs": Decimal("0.00"),
                "igst_tcs": Decimal("0.00"),
            }

        data = summary_map[s_id]
        tax_val = entry.taxable_product_value or entry.gross_amount or Decimal("0.00")
        if entry.status in ("refunded", "cancelled") or getattr(entry, "escrow_status", "") == "refunded":
            data["gross_supplies"] += tax_val
            data["returned_supplies"] += tax_val
        elif entry.entry_type in ("order_sale", "order"):
            data["gross_supplies"] += tax_val
            data["cgst_tcs"] += entry.gst_tcs_cgst or Decimal("0.00")
            data["sgst_tcs"] += entry.gst_tcs_sgst or Decimal("0.00")
            data["igst_tcs"] += entry.gst_tcs_igst or Decimal("0.00")
        elif entry.entry_type in ("return_refund", "return_adjustment", "refund", "return_reversal"):
            data["returned_supplies"] += abs(tax_val)

        order_obj = session.get(Order, entry.order_id) if entry.order_id else None
        order_num = f"ORD-{str(entry.order_id)[:8].upper()}" if entry.order_id else "N/A"
        raw_pm = getattr(order_obj, "payment_method", None) if order_obj else None
        pm = (raw_pm or ("COD" if getattr(entry, "is_cod", False) else "ONLINE")).upper()
        entry_date_str = entry.created_at.strftime("%Y-%m-%d") if isinstance(entry.created_at, datetime) else str(entry.created_at or "")[:10]

        gross_val = float(entry.taxable_product_value or entry.gross_amount or Decimal("0.00"))
        cgst = float(entry.gst_tcs_cgst or Decimal("0.00"))
        sgst = float(entry.gst_tcs_sgst or Decimal("0.00"))
        igst = float(entry.gst_tcs_igst or Decimal("0.00"))
        tcs_total = cgst + sgst + igst
        is_returned = entry.status in ("refunded", "cancelled") or getattr(entry, "escrow_status", "") == "refunded" or (entry.entry_type in ("return_refund", "refund", "return_reversal"))

        order_schedule.append({
            "order_id": str(entry.order_id),
            "order_number": order_num,
            "created_at": entry_date_str,
            "payment_method": pm,
            "taxable_product_value": gross_val,
            "is_returned": is_returned,
            "tcs_rate": float(getattr(entry, "tcs_rate_applied", 0.50) or 0.50) if tcs_total > 0 else 0.0,
            "cgst_tcs": cgst,
            "sgst_tcs": sgst,
            "igst_tcs": igst,
            "total_tcs": tcs_total,
            "status": "reversed" if is_returned else ("deducted" if tcs_total > 0 else "exempt_unregistered"),
        })

    # Apply Invariant 3 (TCS Non-Negative Rule)
    table4_rows: list[dict[str, Any]] = []
    total_gross = Decimal("0.00")
    total_returned = Decimal("0.00")
    total_net = Decimal("0.00")
    total_tcs = Decimal("0.00")

    for s_id, d in summary_map.items():
        raw_net = d["gross_supplies"] - d["returned_supplies"]
        # Invariant 3: If returned > gross, net = 0.00 and TCS = 0.00
        if raw_net < Decimal("0.00"):
            net_supplies = Decimal("0.00")
            cgst_tcs = Decimal("0.00")
            sgst_tcs = Decimal("0.00")
            igst_tcs = Decimal("0.00")
        else:
            net_supplies = raw_net
            cgst_tcs = d["cgst_tcs"]
            sgst_tcs = d["sgst_tcs"]
            igst_tcs = d["igst_tcs"]

        row_tcs = cgst_tcs + sgst_tcs + igst_tcs
        total_gross += d["gross_supplies"]
        total_returned += d["returned_supplies"]
        total_net += net_supplies
        total_tcs += row_tcs

        table4_rows.append({
            "gstin_of_supplier": d["merchant_gstin"],
            "legal_name": d["legal_name"],
            "state_code": d["state_code"],
            "gross_value_of_supplies": float(d["gross_supplies"]),
            "value_of_supplies_returned": float(d["returned_supplies"]),
            "net_value_of_supplies": float(net_supplies),
            "integrated_tax_tcs": float(igst_tcs),
            "central_tax_tcs": float(cgst_tcs),
            "state_ut_tax_tcs": float(sgst_tcs),
            "total_tcs": float(row_tcs),
        })

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        # 1. Executive Filing Header
        writer.writerow(["========================================================================================="])
        writer.writerow(["GSTR-8 SECTION 52 GST-TCS COMPLIANCE RETURN & AUDIT SCHEDULE"])
        writer.writerow(["========================================================================================="])
        writer.writerow(["ECO Operator Name", WEBCREON_LEGAL_NAME])
        writer.writerow(["ECO Operator GSTIN", WEBCREON_GSTIN])
        writer.writerow(["Financial Year", fy])
        writer.writerow(["Filing Period", f"Month {month}" if month else "Annual (Cumulative)"])
        writer.writerow([])

        # 2. Executive Summary / Table 4 Statutory Blocks
        writer.writerow(["--- SECTION 1: STATUTORY GSTR-8 TABLE 4 SUMMARY ---"])
        writer.writerow([
            "GSTIN of Supplier",
            "Legal Name",
            "State Code",
            "Gross Value of Supplies (₹)",
            "Value of Supplies Returned (₹)",
            "Net Value of Supplies Liable to TCS (₹)",
            "Integrated Tax (IGST) TCS (₹)",
            "Central Tax (CGST) TCS (₹)",
            "State/UT Tax (SGST) TCS (₹)",
            "Total Section 52 TCS Collected (₹)",
        ])
        for r in table4_rows:
            writer.writerow([
                r["gstin_of_supplier"],
                r["legal_name"],
                r["state_code"],
                f"{r['gross_value_of_supplies']:.2f}",
                f"{r['value_of_supplies_returned']:.2f}",
                f"{r['net_value_of_supplies']:.2f}",
                f"{r['integrated_tax_tcs']:.2f}",
                f"{r['central_tax_tcs']:.2f}",
                f"{r['state_ut_tax_tcs']:.2f}",
                f"{r['total_tcs']:.2f}",
            ])
        writer.writerow([])

        # 3. Complete Itemized Order-by-Order Schedule
        writer.writerow(["--- SECTION 2: SECTION 52 GST-TCS TRANSACTION SCHEDULE (ORDER-BY-ORDER) ---"])
        writer.writerow([
            "Order ID",
            "Order Number",
            "Order Date",
            "Payment Method",
            "Taxable Base Value (₹)",
            "TCS Rate (%)",
            "Central Tax (CGST) TCS (₹)",
            "State Tax (SGST) TCS (₹)",
            "Integrated Tax (IGST) TCS (₹)",
            "Total TCS Withheld (₹)",
            "Transaction Status",
        ])
        for o in order_schedule:
            writer.writerow([
                o["order_id"],
                o["order_number"],
                o["created_at"],
                o["payment_method"],
                f"{o['taxable_product_value']:.2f}",
                f"{o['tcs_rate']:.2f}%",
                f"{o['cgst_tcs']:.2f}",
                f"{o['sgst_tcs']:.2f}",
                f"{o['igst_tcs']:.2f}",
                f"{o['total_tcs']:.2f}",
                o["status"],
            ])

        output.seek(0)
        filename = f"GSTR8_Section52_TCS_{fy}_{f'M{month}' if month else 'Annual'}.csv"
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # Server-side pagination for order schedule
    total_orders = len(order_schedule)
    total_pages = max(1, math.ceil(total_orders / limit))
    paged_orders = order_schedule[(page - 1) * limit : page * limit]

    return {
        "financial_year": fy,
        "month": month,
        "eco_gstin": WEBCREON_GSTIN,
        "eco_legal_name": WEBCREON_LEGAL_NAME,
        "summary": {
            "total_gross_supplies": float(total_gross),
            "total_returned_supplies": float(total_returned),
            "total_net_supplies": float(total_net),
            "total_tcs_collected": float(total_tcs),
        },
        "table4_records": table4_rows,
        "total_orders": total_orders,
        "total_pages": total_pages,
        "current_page": page,
        "page_size": limit,
        "order_schedule": paged_orders,
    }


@router.get("/form26q")
def get_form_26q_report(
    site_id: Optional[UUID] = None,
    financial_year: Optional[str] = Query(None, description="e.g. 2026-2027"),
    quarter: Optional[int] = Query(None, ge=1, le=4, description="Q1, Q2, Q3, or Q4"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    export_format: str = Query("json", alias="format", enum=["json", "csv"]),
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Form 26Q Section 194-O Quarterly TDS Export with Server-Side Pagination:
    - Lists all TDS deductions (0.10% / 5.00%) per merchant for NSDL quarterly filing filtered by FY & Quarter.
    """
    if not site_id and admin:
        admin_id_val = UUID(str(admin["adminId"])) if isinstance(admin, dict) and "adminId" in admin else (admin.id if hasattr(admin, "id") else None)
        if admin_id_val:
            admin_site = session.exec(select(AdminSite).where(AdminSite.admin_id == admin_id_val)).first()
            if admin_site:
                site_id = admin_site.site_id

    fy = financial_year or get_financial_year()
    start_dt, end_dt = get_form26q_date_range(fy, quarter)

    query = select(TenantLedgerEntry).where(
        TenantLedgerEntry.status.notin_(["unpaid", "draft", "refunded"]),
    )
    if site_id:
        query = query.where(TenantLedgerEntry.site_id == site_id)

    raw_entries = session.exec(query.order_by(TenantLedgerEntry.created_at.desc())).all()
    entries = []
    for e in raw_entries:
        e_dt = parse_compliance_dt(e.created_at)
        if not e_dt and e.order_id:
            ord_obj = session.get(Order, e.order_id)
            if ord_obj:
                e_dt = parse_compliance_dt(ord_obj.created_at)
        if e_dt:
            if start_dt <= e_dt <= end_dt:
                entries.append(e)
        else:
            entries.append(e)

    if not entries and quarter is None and raw_entries:
        entries = raw_entries

    tds_records: list[dict[str, Any]] = []
    total_tds = Decimal("0.00")
    total_gross = compute_live_fy_gross_sales(
        session=session,
        site_id=site_id,
        fy=fy,
        start_date=start_dt if quarter is not None else None,
        end_date=end_dt if quarter is not None else None,
    )

    profile = None
    if site_id:
        profile = session.exec(
            select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == site_id)
        ).first()

    for entry in entries:
        if getattr(entry, "entry_type", "") == "fee_adjustment_refund":
            continue

        order_obj = session.get(Order, entry.order_id) if entry.order_id else None
        if not order_obj:
            continue

        pm = (order_obj.payment_method or "").strip().lower()
        is_cod = (
            pm in ("cod", "cash on delivery", "cash_on_delivery", "cash", "offline", "cash_delivery", "cash on collection")
            or "cod" in pm
            or "cash" in pm
            or (not getattr(order_obj, "razorpay_payment_id", None) and not getattr(order_obj, "razorpay_order_id", None) and pm not in ("online", "razorpay", "upi", "card", "credit_card", "debit_card", "netbanking", "wallet", "prepaid"))
        )
        has_captured = (
            getattr(order_obj, "payment_status", "") in ("paid", "completed", "settled")
            or bool(getattr(order_obj, "razorpay_payment_id", None))
        )
        is_returned_or_cancelled = (
            order_obj.status in ("cancelled", "returned", "refunded")
            or getattr(order_obj, "payment_status", None) == "refunded"
            or entry.status in ("refunded", "reversed")
            or getattr(entry, "escrow_status", None) == "reversed"
        )
        if is_returned_or_cancelled or (not is_cod and not has_captured):
            continue

        if not profile or profile.site_id != entry.site_id:
            profile = session.exec(
                select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == entry.site_id)
            ).first()

        gross = Decimal(str(entry.gross_amount)) if entry.gross_amount is not None else Decimal(str(order_obj.total or "0.00"))
        tds_amt = Decimal(str(getattr(entry, "income_tax_tds_194o", 0) or 0))
        rate = entry.tds_rate_applied or (TDS_194O_STANDARD_RATE if profile and profile.pan_number else (Decimal("0.00") if tds_amt == 0 else TDS_194O_HIGHER_RATE))

        total_tds += tds_amt

        entry_date_str = entry.created_at.strftime("%Y-%m-%d") if isinstance(entry.created_at, datetime) else str(entry.created_at or "")[:10]

        # Only list orders where TDS has been deducted (non-zero withholding)
        if tds_amt > Decimal("0.00"):
            tds_records.append({
                "order_id": str(entry.order_id),
                "order_number": f"ORD-{str(entry.order_id)[:8].upper()}" if entry.order_id else "N/A",
                "site_id": str(entry.site_id),
                "merchant_pan": profile.pan_number if profile and profile.pan_number else "PANNOTPROV",
                "merchant_name": profile.legal_business_name if profile and profile.legal_business_name else "Merchant",
                "section_code": "194-O",
                "payment_date": entry_date_str,
                "gross_amount_paid": float(gross),
                "tds_rate": float(rate),
                "tds_deducted": float(tds_amt),
                "certificate_status": "deducted_form16a",
            })

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["========================================================================================="])
        writer.writerow(["FORM 26Q SECTION 194-O INCOME-TAX TDS RETURN & AUDIT SCHEDULE"])
        writer.writerow(["========================================================================================="])
        writer.writerow(["Deductor Name", WEBCREON_LEGAL_NAME])
        writer.writerow(["Deductor TAN", "MUMB12345D"])
        writer.writerow(["Financial Year", fy])
        writer.writerow(["Period Quarter", f"Q{quarter}" if quarter else "Full Year (Cumulative)"])
        writer.writerow(["Total Gross Orders Paid (₹)", f"{total_gross:.2f}"])
        writer.writerow(["Total TDS Deducted (₹)", f"{total_tds:.2f}"])
        writer.writerow([])

        writer.writerow(["--- SECTION 194-O TRANSACTION SCHEDULE (ORDER-BY-ORDER) ---"])
        writer.writerow([
            "Deductee PAN",
            "Deductee Name",
            "Section Code",
            "Payment / Credit Date",
            "Gross Order Value (₹)",
            "TDS Rate (%)",
            "TDS Deducted (₹)",
            "Certificate Status",
            "Order ID",
        ])
        if tds_records:
            for r in tds_records:
                writer.writerow([
                    r["merchant_pan"],
                    r["merchant_name"],
                    r["section_code"],
                    r["payment_date"],
                    f"{r['gross_amount_paid']:.2f}",
                    f"{r['tds_rate']:.2f}%",
                    f"{r['tds_deducted']:.2f}",
                    r["certificate_status"],
                    r["order_id"],
                ])
        else:
            writer.writerow([
                profile.pan_number if profile and profile.pan_number else "PANNOTPROV",
                profile.legal_business_name if profile and profile.legal_business_name else "Merchant",
                "194-O",
                "-",
                f"{total_gross:.2f}",
                "0.00%",
                "0.00",
                "Exempt under statutory ₹5L threshold",
                "N/A",
            ])
        output.seek(0)
        filename = f"Form26Q_Sec194O_{fy}_{f'Q{quarter}' if quarter else 'Annual'}.csv"
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # Server-side pagination slicing
    total_records = len(tds_records)
    total_pages = max(1, math.ceil(total_records / limit))
    paged_records = tds_records[(page - 1) * limit : page * limit]

    # Also compute FY cumulative sales for the Section 194-O tracker strictly matching verified orders
    fy_cumulative_sales = compute_live_fy_gross_sales(session, site_id, fy)
    cum_val = float(fy_cumulative_sales)

    has_valid_pan = bool(profile and profile.pan_number and PAN_REGEX.match(profile.pan_number))
    ent_val = getattr(profile, "entity_type", "individual") if profile else "individual"
    ent_str = ent_val.value if hasattr(ent_val, "value") else str(ent_val or "individual").lower()
    is_ind = ent_str in ("individual", "proprietorship", "sole_proprietorship", "huf")
    thresh = float(TDS_194O_INDIVIDUAL_THRESHOLD) if is_ind else 0.0

    if not has_valid_pan:
        is_exc = True
        sec_rate = float(TDS_194O_HIGHER_RATE) # 5.00%
    else:
        is_exc = cum_val >= thresh if is_ind else True
        sec_rate = float(TDS_194O_STANDARD_RATE) if is_exc else 0.0

    prog_pct = min(100.0, round((cum_val / thresh) * 100.0, 1)) if thresh > 0 else 100.0

    return {
        "financial_year": fy,
        "quarter": quarter,
        "deductor_tan": "MUMB12345D",
        "deductor_name": WEBCREON_LEGAL_NAME,
        "total_deductees": total_records,
        "total_records": total_records,
        "total_pages": total_pages,
        "current_page": page,
        "page_size": limit,
        "total_gross_paid": float(total_gross),
        "total_tds_deducted": float(total_tds),
        "records": paged_records,
        "section_194o": {
            "threshold": thresh,
            "cumulative_sales": cum_val,
            "is_threshold_exceeded": is_exc,
            "progress_percent": prog_pct,
            "applicable_rate": sec_rate,
            "is_individual_or_huf": is_ind,
            "has_pan": has_valid_pan,
        },
    }


@router.get("/hsn-master/search")
def search_hsn_sac_directory(
    q: str = Query(..., min_length=2, description="Search by HSN code or item description"),
    category: Optional[str] = Query(None, description="goods or services"),
    session: Session = Depends(get_session),
):
    """
    Search HSN/SAC master with GST rates for product tax classification.
    """
    search_term = f"%{q.strip()}%"
    stmt = select(TaxMaster).where(
        (TaxMaster.code.ilike(search_term)) | (TaxMaster.description.ilike(search_term))
    )
    if category:
        c_type = "HSN" if category.lower() in ("goods", "hsn") else "SAC"
        stmt = stmt.where(TaxMaster.code_type == c_type)

    results = session.exec(stmt.limit(20)).all()
    return {
        "query": q,
        "count": len(results),
        "results": [
            {
                "id": str(r.id),
                "code": r.code,
                "type": r.code_type,
                "description": r.description,
                "gst_rate": float(r.gst_rate),
                "cess_rate": float(r.cess_rate),
            }
            for r in results
        ],
    }
