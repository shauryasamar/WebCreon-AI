from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlmodel import Session, select

from auth_middleware import authenticate_customer
from db.database import get_session
from models import DeliverySettings, Site, User, UserAddress


router = APIRouter(
    prefix="/checkout",
    tags=["checkout"],
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_site_or_404(session: Session, site_id: UUID) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


def get_user_for_site_or_404(session: Session, site_id: UUID, user_id: UUID) -> User:
    user = session.get(User, user_id)
    if not user or user.site_id != site_id or user.is_guest:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_address_for_user_or_404(
    session: Session,
    site_id: UUID,
    user_id: UUID,
    address_id: UUID,
) -> UserAddress:
    address = session.get(UserAddress, address_id)
    if (
        not address
        or address.site_id != site_id
        or address.user_id != user_id
        or not address.is_active
    ):
        raise HTTPException(status_code=404, detail="Address not found")
    return address


def serialize_address(address: UserAddress) -> dict:
    return {
        "id": str(address.id),
        "siteId": str(address.site_id),
        "userId": str(address.user_id),
        "fullName": address.full_name,
        "mobileNumber": address.mobile_number,
        "addressLine1": address.address_line1,
        "city": address.city,
        "postalCode": address.postal_code,
        "email": address.email,
        "addressType": address.address_type,
        "isDefault": address.is_default,
        "latitude": getattr(address, "latitude", None),
        "longitude": getattr(address, "longitude", None),
        "geoAccuracy": getattr(address, "geo_accuracy", None),
        "createdAt": address.created_at.isoformat() if address.created_at else None,
        "updatedAt": address.updated_at.isoformat() if address.updated_at else None,
    }


def fetch_user_addresses(session: Session, site_id: UUID, user_id: UUID) -> list[UserAddress]:
    return session.exec(
        select(UserAddress)
        .where(
            UserAddress.site_id == site_id,
            UserAddress.user_id == user_id,
            UserAddress.is_active == True,
        )
        .order_by(UserAddress.is_default.desc(), UserAddress.updated_at.desc())
    ).all()


def unset_existing_default(
    session: Session,
    site_id: UUID,
    user_id: UUID,
    exclude_id: Optional[UUID] = None,
) -> None:
    addresses = session.exec(
        select(UserAddress).where(
            UserAddress.site_id == site_id,
            UserAddress.user_id == user_id,
            UserAddress.is_default == True,
            UserAddress.is_active == True,
        )
    ).all()

    for address in addresses:
        if exclude_id and address.id == exclude_id:
            continue
        address.is_default = False
        address.updated_at = utc_now()
        session.add(address)


class AddressBasePayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    mobile_number: str = Field(min_length=10, max_length=15)
    address_line1: str = Field(min_length=2, max_length=255)
    city: str = Field(min_length=2, max_length=120)
    postal_code: str = Field(min_length=6, max_length=10)
    email: Optional[EmailStr] = None
    address_type: str = Field(default="Home", max_length=30)
    is_default: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geo_accuracy: Optional[str] = None  # 'pinned' | 'geocoded'

    @field_validator(
        "full_name",
        "mobile_number",
        "address_line1",
        "city",
        "postal_code",
        "address_type",
        mode="before",
    )
    @classmethod
    def strip_required_string(cls, value: str) -> str:
        if value is None:
            return value
        value = str(value).strip()
        if not value:
            raise ValueError("Field cannot be empty")
        return value

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, value: str) -> str:
        import re
        digits = re.sub(r"\D", "", value or "")
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]
        if len(digits) != 10 or not digits[0] in "6789":
            raise ValueError("Please provide a valid 10-digit mobile phone number starting with 6-9.")
        return digits

    @field_validator("postal_code")
    @classmethod
    def validate_postal_code(cls, value: str) -> str:
        import re
        digits = re.sub(r"\D", "", value or "")
        if len(digits) != 6:
            raise ValueError("Please provide a valid 6-digit postal code (pincode).")
        return digits


class CreateAddressRequest(AddressBasePayload):
    pass


class UpdateAddressRequest(AddressBasePayload):
    pass


class AddressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    siteId: str
    userId: str
    fullName: str
    mobileNumber: str
    addressLine1: str
    city: str
    postalCode: str
    email: Optional[str] = None
    addressType: str
    isDefault: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geoAccuracy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class AddressListResponse(BaseModel):
    addresses: list[AddressResponse]


@router.get("/addresses/{site_id}", response_model=AddressListResponse)
def get_addresses(
    site_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    addresses = fetch_user_addresses(session, site_id, customer.id)

    return {"addresses": [serialize_address(address) for address in addresses]}


@router.post("/addresses/{site_id}", response_model=AddressResponse)
def create_address(
    site_id: UUID,
    payload: CreateAddressRequest,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))

    existing_addresses = fetch_user_addresses(session, site_id, customer.id)
    should_be_default = payload.is_default or len(existing_addresses) == 0

    if should_be_default:
        unset_existing_default(session, site_id, customer.id)

    address = UserAddress(
        site_id=site_id,
        user_id=customer.id,
        full_name=payload.full_name,
        mobile_number=payload.mobile_number,
        address_line1=payload.address_line1,
        city=payload.city,
        postal_code=payload.postal_code,
        email=payload.email,
        address_type=payload.address_type,
        is_default=should_be_default,
        is_active=True,
        latitude=payload.latitude,
        longitude=payload.longitude,
        geo_accuracy=payload.geo_accuracy,
    )
    session.add(address)
    session.commit()
    session.refresh(address)

    return serialize_address(address)


@router.put("/addresses/{site_id}/{address_id}", response_model=AddressResponse)
def update_address(
    site_id: UUID,
    address_id: UUID,
    payload: UpdateAddressRequest,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    address = get_address_for_user_or_404(session, site_id, customer.id, address_id)

    if payload.is_default:
        unset_existing_default(session, site_id, customer.id, exclude_id=address.id)

    address.full_name = payload.full_name
    address.mobile_number = payload.mobile_number
    address.address_line1 = payload.address_line1
    address.city = payload.city
    address.postal_code = payload.postal_code
    address.email = payload.email
    address.address_type = payload.address_type
    address.is_default = payload.is_default
    # Update geo fields if provided; preserve existing if not re-pinned
    if payload.latitude is not None:
        address.latitude = payload.latitude
        address.longitude = payload.longitude
        address.geo_accuracy = payload.geo_accuracy
    address.updated_at = utc_now()

    session.add(address)
    session.commit()
    session.refresh(address)

    return serialize_address(address)


@router.delete("/addresses/{site_id}/{address_id}")
def delete_address(
    site_id: UUID,
    address_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    address = get_address_for_user_or_404(session, site_id, customer.id, address_id)
    was_default = address.is_default

    address.is_active = False
    address.is_default = False
    address.updated_at = utc_now()

    session.add(address)
    session.commit()

    if was_default:
        next_address = session.exec(
            select(UserAddress)
            .where(
                UserAddress.site_id == site_id,
                UserAddress.user_id == customer.id,
                UserAddress.is_active == True,
            )
            .order_by(UserAddress.updated_at.desc())
        ).first()

        if next_address:
            next_address.is_default = True
            next_address.updated_at = utc_now()
            session.add(next_address)
            session.commit()

    return {"message": "Address deleted successfully"}


@router.post("/addresses/{site_id}/{address_id}/default", response_model=AddressResponse)
def set_default_address(
    site_id: UUID,
    address_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    address = get_address_for_user_or_404(session, site_id, customer.id, address_id)

    unset_existing_default(session, site_id, customer.id, exclude_id=address.id)

    address.is_default = True
    address.updated_at = utc_now()

    session.add(address)
    session.commit()
    session.refresh(address)

    return serialize_address(address)


# ──────────────────────────────────────────────────────────────────────────────
# Deliverability check (public — no auth needed)
# ──────────────────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in km between two geo-coordinates."""
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/deliverability/{site_id}")
def check_deliverability(
    site_id: UUID,
    lat: float = Query(..., description="Customer latitude"),
    lng: float = Query(..., description="Customer longitude"),
    session: Session = Depends(get_session),
):
    """Public endpoint: check if a customer's pinned geo-location is within
    the admin-configured delivery radius. Calculates Haversine distance
    from the store's pinned location for own fleet and/or Shiprocket courier."""

    get_site_or_404(session, site_id)

    settings = session.exec(
        select(DeliverySettings).where(DeliverySettings.site_id == site_id)
    ).first()

    if not settings:
        return {"deliverable": True, "check_required": False, "reason": "no_settings"}

    delivery_mode = settings.delivery_mode or "manual"
    ef = getattr(settings, "enable_fleet", None)
    es = getattr(settings, "enable_shiprocket", None)
    
    is_fleet = bool(ef) if ef is not None else (delivery_mode in ("own_agent", "hybrid"))
    is_sr = bool(es) if es is not None else (delivery_mode in ("shiprocket", "hybrid"))

    store_lat = getattr(settings, "sender_latitude", None)
    store_lng = getattr(settings, "sender_longitude", None)

    fleet_radius_km = float(settings.own_delivery_radius_km or 10)
    sr_radius_raw = getattr(settings, "shiprocket_delivery_radius_km", None)
    sr_radius_km = float(sr_radius_raw) if (sr_radius_raw is not None and float(sr_radius_raw) > 0) else None

    # If store coordinates are not set
    if store_lat is None or store_lng is None:
        return {
            "deliverable": True,
            "check_required": False,
            "delivery_mode": delivery_mode,
            "reason": "store_location_not_configured",
        }

    distance_km = _haversine_km(store_lat, store_lng, lat, lng)

    # Edge Case 1: Shiprocket is enabled
    if is_sr:
        # If Shiprocket has no distance limit (None or <= 0), it delivers nationwide!
        if sr_radius_km is None:
            return {
                "deliverable": True,
                "check_required": True,
                "delivery_mode": delivery_mode,
                "fulfillment": "own_fleet" if (is_fleet and distance_km <= fleet_radius_km) else "shiprocket",
                "distance_km": round(distance_km, 2),
                "reason": "within_fleet_radius" if (is_fleet and distance_km <= fleet_radius_km) else "shiprocket_nationwide",
            }
        else:
            # Shiprocket has a max delivery radius configured by admin
            effective_max_radius = max(sr_radius_km, fleet_radius_km if is_fleet else 0.0)
            deliverable = distance_km <= effective_max_radius
            return {
                "deliverable": deliverable,
                "check_required": True,
                "delivery_mode": delivery_mode,
                "distance_km": round(distance_km, 2),
                "radius_km": effective_max_radius,
                "reason": "within_radius" if deliverable else "outside_radius",
            }

    # Edge Case 2: Own Fleet is enabled (and Shiprocket is disabled)
    if is_fleet:
        deliverable = distance_km <= fleet_radius_km
        return {
            "deliverable": deliverable,
            "check_required": True,
            "delivery_mode": delivery_mode,
            "distance_km": round(distance_km, 2),
            "radius_km": fleet_radius_km,
            "reason": "within_radius" if deliverable else "outside_radius",
        }

    # Edge Case 3: Manual delivery only
    return {
        "deliverable": True,
        "check_required": False,
        "delivery_mode": delivery_mode,
        "reason": "manual_delivery",
    }

