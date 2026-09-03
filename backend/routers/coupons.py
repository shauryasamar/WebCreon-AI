from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from auth_middleware import enforce_site_ownership
from db.database import get_session
from models import Coupon, CouponUsage, Order, Site, User


router = APIRouter(prefix="/coupons", tags=["coupons"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def resolve_site(site_identifier: str, session: Session) -> Site:
    site = None
    try:
        site_uuid = UUID(site_identifier)
        site = session.get(Site, site_uuid)
    except Exception:
        pass

    if not site:
        site = session.exec(
            select(Site).where(Site.slug == site_identifier.lower().strip())
        ).first()

    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found",
        )
    return site


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateCouponRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = ""
    discount_type: str = Field("percentage", pattern="^(percentage|fixed_amount|free_shipping)$")
    discount_value: Decimal = Field(default=Decimal("0.00"), ge=0)
    max_discount_amount: Optional[Decimal] = Field(default=None, ge=0)
    min_order_value: Decimal = Field(default=Decimal("0.00"), ge=0)
    is_first_order_only: bool = False
    total_usage_limit: Optional[int] = Field(default=None, ge=1)
    per_customer_limit: int = Field(default=1, ge=1)
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    is_public: bool = True


class UpdateCouponRequest(BaseModel):
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    max_discount_amount: Optional[Decimal] = None
    min_order_value: Optional[Decimal] = None
    is_first_order_only: Optional[bool] = None
    total_usage_limit: Optional[int] = None
    per_customer_limit: Optional[int] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None


class ValidateCouponRequest(BaseModel):
    code: str
    subtotal: Decimal = Field(..., ge=0)
    delivery_fee: Decimal = Field(default=Decimal("0.00"), ge=0)
    customer_email: Optional[str] = None


def serialize_coupon(coupon: Coupon, total_savings: Decimal = Decimal("0.00")) -> dict[str, Any]:
    return {
        "id": str(coupon.id),
        "siteId": str(coupon.site_id),
        "code": coupon.code,
        "description": coupon.description,
        "discountType": coupon.discount_type,
        "discountValue": float(coupon.discount_value),
        "maxDiscountAmount": float(coupon.max_discount_amount) if coupon.max_discount_amount is not None else None,
        "minOrderValue": float(coupon.min_order_value),
        "isFirstOrderOnly": coupon.is_first_order_only,
        "totalUsageLimit": coupon.total_usage_limit,
        "timesUsed": coupon.times_used,
        "perCustomerLimit": coupon.per_customer_limit,
        "startsAt": coupon.starts_at.isoformat() if coupon.starts_at else None,
        "expiresAt": coupon.expires_at.isoformat() if coupon.expires_at else None,
        "isActive": coupon.is_active,
        "isPublic": getattr(coupon, "is_public", True),
        "totalSavings": float(total_savings),
        "createdAt": coupon.created_at.isoformat(),
        "updatedAt": coupon.updated_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Admin Endpoints
# ---------------------------------------------------------------------------

@router.get("/admin/{site_id}")
def admin_list_coupons(
    site_id: str,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = resolve_site(site_id, session)
    coupons = session.exec(
        select(Coupon)
        .where(Coupon.site_id == site.id)
        .order_by(Coupon.created_at.desc())
    ).all()

    # Aggregate savings per coupon from coupon_usages
    usages = session.exec(
        select(
            CouponUsage.coupon_id,
            func.sum(CouponUsage.discount_amount).label("total_savings"),
        )
        .where(CouponUsage.site_id == site.id)
        .group_by(CouponUsage.coupon_id)
    ).all()
    savings_map = {u[0]: Decimal(str(u[1] or 0)) for u in usages}

    total_active = sum(1 for c in coupons if c.is_active)
    total_redemptions = sum(c.times_used for c in coupons)
    total_store_savings = sum(savings_map.values(), Decimal("0.00"))

    return {
        "coupons": [serialize_coupon(c, savings_map.get(c.id, Decimal("0.00"))) for c in coupons],
        "stats": {
            "totalCoupons": len(coupons),
            "activeCoupons": total_active,
            "totalRedemptions": total_redemptions,
            "totalSavings": float(total_store_savings),
        },
    }


@router.post("/admin/{site_id}")
def admin_create_coupon(
    site_id: str,
    payload: CreateCouponRequest,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = resolve_site(site_id, session)
    clean_code = payload.code.strip().upper()

    # Check if coupon code already exists for this site
    existing = session.exec(
        select(Coupon).where(
            Coupon.site_id == site.id,
            Coupon.code == clean_code,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{clean_code}' already exists for this store.",
        )

    coupon = Coupon(
        site_id=site.id,
        code=clean_code,
        description=payload.description or "",
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        max_discount_amount=payload.max_discount_amount,
        min_order_value=payload.min_order_value,
        is_first_order_only=payload.is_first_order_only,
        total_usage_limit=payload.total_usage_limit,
        per_customer_limit=payload.per_customer_limit,
        starts_at=payload.starts_at or utc_now(),
        expires_at=payload.expires_at,
        is_active=payload.is_active,
        is_public=payload.is_public,
    )
    session.add(coupon)
    session.commit()
    session.refresh(coupon)

    return {
        "message": f"Promo code '{coupon.code}' created successfully.",
        "coupon": serialize_coupon(coupon),
    }


@router.put("/admin/{site_id}/{coupon_id}")
def admin_update_coupon(
    site_id: str,
    coupon_id: str,
    payload: UpdateCouponRequest,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = resolve_site(site_id, session)
    coupon_uuid = UUID(coupon_id)
    coupon = session.get(Coupon, coupon_uuid)
    if not coupon or coupon.site_id != site.id:
        raise HTTPException(status_code=404, detail="Coupon not found")

    if payload.description is not None:
        coupon.description = payload.description
    if payload.discount_type is not None:
        coupon.discount_type = payload.discount_type
    if payload.discount_value is not None:
        coupon.discount_value = payload.discount_value
    if payload.max_discount_amount is not None:
        coupon.max_discount_amount = payload.max_discount_amount
    if payload.min_order_value is not None:
        coupon.min_order_value = payload.min_order_value
    if payload.is_first_order_only is not None:
        coupon.is_first_order_only = payload.is_first_order_only
    if payload.total_usage_limit is not None:
        coupon.total_usage_limit = payload.total_usage_limit
    if payload.per_customer_limit is not None:
        coupon.per_customer_limit = payload.per_customer_limit
    if payload.starts_at is not None:
        coupon.starts_at = payload.starts_at
    if payload.expires_at is not None:
        coupon.expires_at = payload.expires_at
    if payload.is_active is not None:
        coupon.is_active = payload.is_active
    if payload.is_public is not None:
        coupon.is_public = payload.is_public

    coupon.updated_at = utc_now()
    session.add(coupon)
    session.commit()
    session.refresh(coupon)

    return {
        "message": "Coupon updated successfully",
        "coupon": serialize_coupon(coupon),
    }


@router.patch("/admin/{site_id}/{coupon_id}/toggle")
def admin_toggle_coupon(
    site_id: str,
    coupon_id: str,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = resolve_site(site_id, session)
    coupon_uuid = UUID(coupon_id)
    coupon = session.get(Coupon, coupon_uuid)
    if not coupon or coupon.site_id != site.id:
        raise HTTPException(status_code=404, detail="Coupon not found")

    coupon.is_active = not coupon.is_active
    coupon.updated_at = utc_now()
    session.add(coupon)
    session.commit()
    session.refresh(coupon)

    return {
        "message": f"Coupon '{coupon.code}' is now {'active' if coupon.is_active else 'paused'}.",
        "coupon": serialize_coupon(coupon),
    }


@router.delete("/admin/{site_id}/{coupon_id}")
def admin_delete_coupon(
    site_id: str,
    coupon_id: str,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = resolve_site(site_id, session)
    coupon_uuid = UUID(coupon_id)
    coupon = session.get(Coupon, coupon_uuid)
    if not coupon or coupon.site_id != site.id:
        raise HTTPException(status_code=404, detail="Coupon not found")

    session.delete(coupon)
    session.commit()

    return {"message": f"Coupon '{coupon.code}' deleted successfully."}


# ---------------------------------------------------------------------------
# Storefront Public Available Coupons Endpoint
# ---------------------------------------------------------------------------

@router.get("/available/{site_id}")
def get_available_storefront_coupons(
    site_id: str,
    session: Session = Depends(get_session),
):
    site = resolve_site(site_id, session)
    now = utc_now()

    coupons = session.exec(
        select(Coupon)
        .where(
            Coupon.site_id == site.id,
            Coupon.is_active == True,
            Coupon.is_public == True,
        )
        .order_by(Coupon.created_at.desc())
    ).all()

    valid_available = []
    for c in coupons:
        if c.starts_at and now < c.starts_at:
            continue
        if c.expires_at and now > c.expires_at:
            continue
        if c.total_usage_limit is not None and c.times_used >= c.total_usage_limit:
            continue
        valid_available.append({
            "id": str(c.id),
            "code": c.code,
            "description": c.description,
            "discountType": c.discount_type,
            "discountValue": float(c.discount_value),
            "maxDiscountAmount": float(c.max_discount_amount) if c.max_discount_amount is not None else None,
            "minOrderValue": float(c.min_order_value),
            "isFirstOrderOnly": c.is_first_order_only,
            "expiresAt": c.expires_at.isoformat() if c.expires_at else None,
        })

    return {"coupons": valid_available}


# ---------------------------------------------------------------------------
# Storefront Customer Validation Endpoint
# ---------------------------------------------------------------------------

@router.post("/validate/{site_id}")
def validate_storefront_coupon(
    site_id: str,
    payload: ValidateCouponRequest,
    session: Session = Depends(get_session),
):
    site = resolve_site(site_id, session)
    clean_code = payload.code.strip().upper()

    if not clean_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a promo code.",
        )

    coupon = session.exec(
        select(Coupon).where(
            Coupon.site_id == site.id,
            Coupon.code == clean_code,
        )
    ).first()

    if not coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promo code '{clean_code}' is invalid.",
        )

    if not coupon.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{clean_code}' is currently inactive.",
        )

    now = utc_now()
    if coupon.starts_at and now < coupon.starts_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{clean_code}' is not active yet.",
        )

    if coupon.expires_at and now > coupon.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{clean_code}' has expired.",
        )

    if coupon.total_usage_limit is not None and coupon.times_used >= coupon.total_usage_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promo code '{clean_code}' has reached its maximum total usage limit.",
        )

    subtotal = payload.subtotal
    if subtotal < coupon.min_order_value:
        diff = coupon.min_order_value - subtotal
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum order amount of ₹{coupon.min_order_value:,.2f} required for this code. Add ₹{diff:,.2f} more to apply.",
        )

    customer_email = (payload.customer_email or "").strip().lower()

    if customer_email:
        # First order only rule
        if coupon.is_first_order_only:
            past_order = session.exec(
                select(Order)
                .join(User, Order.customer_id == User.id)
                .where(
                    Order.site_id == site.id,
                    User.email == customer_email,
                    Order.status != "cancelled",
                )
            ).first()
            if past_order:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Promo code '{clean_code}' is only valid for your first order.",
                )

        # Per-customer limit
        if coupon.per_customer_limit:
            usage_count = session.exec(
                select(func.count(CouponUsage.id)).where(
                    CouponUsage.site_id == site.id,
                    CouponUsage.coupon_id == coupon.id,
                    CouponUsage.customer_email == customer_email,
                )
            ).one()
            if usage_count >= coupon.per_customer_limit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"You have already used promo code '{clean_code}' the maximum allowed number of times ({coupon.per_customer_limit}).",
                )

    # Compute discount amount
    discount_amount = Decimal("0.00")
    if coupon.discount_type == "percentage":
        computed = (subtotal * coupon.discount_value) / Decimal("100.00")
        if coupon.max_discount_amount is not None and coupon.max_discount_amount > 0:
            computed = min(computed, coupon.max_discount_amount)
        discount_amount = min(computed, subtotal)
    elif coupon.discount_type == "fixed_amount":
        discount_amount = min(coupon.discount_value, subtotal)
    elif coupon.discount_type == "free_shipping":
        discount_amount = payload.delivery_fee

    discount_amount = round(discount_amount, 2)
    final_subtotal = max(Decimal("0.00"), subtotal - discount_amount)
    final_total = max(Decimal("0.00"), final_subtotal + payload.delivery_fee)

    return {
        "valid": True,
        "coupon": {
            "id": str(coupon.id),
            "code": coupon.code,
            "discountType": coupon.discount_type,
            "discountValue": float(coupon.discount_value),
            "discountAmount": float(discount_amount),
            "description": coupon.description,
        },
        "discountAmount": float(discount_amount),
        "finalSubtotal": float(final_subtotal),
        "finalTotal": float(final_total),
        "message": f"Promo code '{coupon.code}' applied successfully! You saved ₹{discount_amount:,.2f}.",
    }
