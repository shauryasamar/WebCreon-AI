from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlmodel import Session, select

from auth_middleware import enforce_site_ownership
from db.database import get_session
from models import Site

router = APIRouter(
    tags=["checkout-settings"],
)


def get_site_or_404(session: Session, site_id: UUID) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


class ChargeRulePayload(BaseModel):
    id: str
    code: str
    label: str
    enabled: bool
    optional: bool
    customerSelectable: bool
    refundable: bool = True
    amountType: Literal["fixed", "percent"]
    amountValue: str
    applyConditionType: Literal["none", "subtotal_lt", "subtotal_gte", "payment_method"]
    applyConditionValue: str
    waiveConditionType: Literal["none", "subtotal_gte"]
    waiveConditionValue: str
    description: str

    @field_validator(
        "id",
        "code",
        "label",
        "amountValue",
        "applyConditionValue",
        "waiveConditionValue",
        "description",
        mode="before",
    )
    @classmethod
    def normalize_strings(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @model_validator(mode="after")
    def validate_charge(self):
        if not self.id:
            raise ValueError("Charge id is required")
        if not self.code:
            raise ValueError("Charge code is required")
        if not self.label:
            raise ValueError("Charge label is required")
        if self.amountValue == "":
            raise ValueError("Amount value is required")

        try:
            amount = float(self.amountValue)
        except ValueError:
            raise ValueError("Amount value must be a valid number")

        if amount < 0:
            raise ValueError("Amount value cannot be negative")

        if self.amountType == "percent" and amount > 100:
            raise ValueError("Percentage charge cannot be greater than 100")

        if self.applyConditionType in {"subtotal_lt", "subtotal_gte"}:
            if self.applyConditionValue == "":
                raise ValueError("Apply condition value is required")
            try:
                condition_amount = float(self.applyConditionValue)
            except ValueError:
                raise ValueError("Apply condition value must be a valid number")
            if condition_amount < 0:
                raise ValueError("Apply condition value cannot be negative")

        if self.waiveConditionType == "subtotal_gte":
            if self.waiveConditionValue == "":
                raise ValueError("Waive condition value is required")
            try:
                waive_amount = float(self.waiveConditionValue)
            except ValueError:
                raise ValueError("Waive condition value must be a valid number")
            if waive_amount < 0:
                raise ValueError("Waive condition value cannot be negative")

        if self.applyConditionType == "payment_method" and not self.applyConditionValue:
            raise ValueError("Payment method condition value is required")

        return self


class TaxSettingsPayload(BaseModel):
    enabled: bool
    label: str
    rate: str
    applyOnShipping: bool

    @field_validator("label", "rate", mode="before")
    @classmethod
    def normalize_strings(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @model_validator(mode="after")
    def validate_tax(self):
        if not self.label:
            raise ValueError("Tax label is required")
        if self.rate == "":
            raise ValueError("Tax rate is required")

        try:
            rate_value = float(self.rate)
        except ValueError:
            raise ValueError("Tax rate must be a valid number")

        if rate_value < 0:
            raise ValueError("Tax rate cannot be negative")

        if rate_value > 100:
            raise ValueError("Tax rate cannot be greater than 100")

        return self


class CheckoutSettingsPayload(BaseModel):
    taxSettings: TaxSettingsPayload
    charges: list[ChargeRulePayload] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_unique_charge_ids(self):
        ids = [charge.id for charge in self.charges]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate charge ids are not allowed")

        codes = [charge.code for charge in self.charges if charge.code != "custom"]
        if len(codes) != len(set(codes)):
            raise ValueError("Duplicate standard charge codes are not allowed")

        return self


class CheckoutSettingsResponse(BaseModel):
    taxSettings: TaxSettingsPayload
    charges: list[ChargeRulePayload]


def build_default_checkout_settings() -> dict[str, Any]:
    return {
        "taxSettings": {
            "enabled": True,
            "label": "GST",
            "rate": "5",
            "applyOnShipping": False,
        },
        "charges": [
            {
                "id": "shipping_fee",
                "code": "shipping_fee",
                "label": "Shipping fee",
                "enabled": True,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "99",
                "applyConditionType": "none",
                "applyConditionValue": "",
                "waiveConditionType": "subtotal_gte",
                "waiveConditionValue": "999",
                "description": "Standard shipping charge for all eligible orders.",
            },
            {
                "id": "handling_fee",
                "code": "handling_fee",
                "label": "Handling fee",
                "enabled": False,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "29",
                "applyConditionType": "none",
                "applyConditionValue": "",
                "waiveConditionType": "none",
                "waiveConditionValue": "",
                "description": "Store handling or order processing fee.",
            },
            {
                "id": "packaging_fee",
                "code": "packaging_fee",
                "label": "Packaging fee",
                "enabled": False,
                "optional": False,
                "customerSelectable": False,
                "refundable": True,
                "amountType": "fixed",
                "amountValue": "19",
                "applyConditionType": "none",
                "applyConditionValue": "",
                "waiveConditionType": "none",
                "waiveConditionValue": "",
                "description": "Extra packaging or premium packing charge.",
            },
            {
                "id": "service_fee",
                "code": "service_fee",
                "label": "Service fee",
                "enabled": False,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "15",
                "applyConditionType": "none",
                "applyConditionValue": "",
                "waiveConditionType": "none",
                "waiveConditionValue": "",
                "description": "Store service or convenience charge.",
            },
            {
                "id": "platform_fee",
                "code": "platform_fee",
                "label": "Platform fee",
                "enabled": False,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "9",
                "applyConditionType": "none",
                "applyConditionValue": "",
                "waiveConditionType": "subtotal_gte",
                "waiveConditionValue": "799",
                "description": "Platform or service support charge.",
            },
            {
                "id": "small_order_fee",
                "code": "small_order_fee",
                "label": "Small order fee",
                "enabled": False,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "49",
                "applyConditionType": "subtotal_lt",
                "applyConditionValue": "499",
                "waiveConditionType": "none",
                "waiveConditionValue": "",
                "description": "Applies only when the order value is below a threshold.",
            },
            {
                "id": "cod_fee",
                "code": "cod_fee",
                "label": "COD fee",
                "enabled": False,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "39",
                "applyConditionType": "payment_method",
                "applyConditionValue": "cod",
                "waiveConditionType": "none",
                "waiveConditionValue": "",
                "description": "Applies when customer chooses cash on delivery.",
            },
            {
                "id": "gift_wrap",
                "code": "gift_wrap",
                "label": "Gift wrap",
                "enabled": False,
                "optional": True,
                "customerSelectable": True,
                "refundable": True,
                "amountType": "fixed",
                "amountValue": "49",
                "applyConditionType": "none",
                "applyConditionValue": "",
                "waiveConditionType": "none",
                "waiveConditionValue": "",
                "description": "Optional checkout add-on selected by customer.",
            },
        ],
    }


@router.get("/sites/{site_id}/checkout-settings", response_model=CheckoutSettingsResponse)
def get_checkout_settings(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = get_site_or_404(session, site_id)
    stored_settings = site.checkout_settings or build_default_checkout_settings()
    return CheckoutSettingsResponse(**stored_settings)


@router.put("/sites/{site_id}/checkout-settings", response_model=CheckoutSettingsResponse)
def update_checkout_settings(
    site_id: UUID,
    payload: CheckoutSettingsPayload,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = get_site_or_404(session, site_id)

    site.checkout_settings = payload.model_dump()

    session.add(site)
    session.commit()
    session.refresh(site)

    return CheckoutSettingsResponse(**site.checkout_settings)


@router.get("/store/{slug}/checkout-settings", response_model=CheckoutSettingsResponse)
def get_public_checkout_settings(
    slug: str,
    session: Session = Depends(get_session),
):
    site = session.exec(
        select(Site).where(Site.slug == slug)
    ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    stored_settings = site.checkout_settings or build_default_checkout_settings()
    return CheckoutSettingsResponse(**stored_settings)