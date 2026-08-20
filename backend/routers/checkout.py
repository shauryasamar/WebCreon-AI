from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlmodel import Session, select

from auth_middleware import authenticate_customer
from db.database import get_session
from models import Site, User, UserAddress


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
    full_name: str = Field(min_length=1, max_length=255)
    mobile_number: str = Field(min_length=1, max_length=30)
    address_line1: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=120)
    postal_code: str = Field(min_length=1, max_length=20)
    email: Optional[EmailStr] = None
    address_type: str = Field(min_length=1, max_length=30)
    is_default: bool = False

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
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty")
        return value


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