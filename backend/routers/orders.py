from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, delete, func, select

from auth_middleware import authenticate_admin, authenticate_customer, enforce_site_ownership
from db.database import get_session
from models import (
    Cart,
    CartItem,
    InventoryMovement,
    Order,
    OrderItem,
    OrderStatusHistory,
    Product,
    Shipment,
    Site,
    User,
    UserAddress,
)

router = APIRouter(
    prefix="/orders",
    tags=["orders"],
)

ORDER_STATUSES = {
    "placed",
    "confirmed",
    "shipped",
    "out_for_delivery",
    "delivered",
    "partially_cancelled",
    "cancelled",
}

PAYMENT_NORMALIZATION = {
    "cod": "cod",
    "cash_on_delivery": "cod",
    "upi": "upi",
    "card": "card",
    "razorpay": "razorpay",
    "online": "online",
}

ALLOWED_STATUS_TRANSITIONS = {
    "placed": {"confirmed", "cancelled"},
    "confirmed": {"shipped", "cancelled"},
    "shipped": {"out_for_delivery"},
    "out_for_delivery": {"delivered"},
    "delivered": set(),
    "partially_cancelled": set(),
    "cancelled": set(),
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def money(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_site_or_404(session: Session, site_id: UUID) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


def get_user_for_site_or_404(session: Session, site_id: UUID, user_id: UUID) -> User:
    user = session.get(User, user_id)
    if not user or user.site_id != site_id:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_cart_for_user_or_404(session: Session, site_id: UUID, user_id: UUID) -> Cart:
    cart = session.exec(
        select(Cart).where(Cart.site_id == site_id, Cart.user_id == user_id)
    ).first()
    if not cart:
        raise HTTPException(status_code=400, detail="Cart not found")
    return cart


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


def normalize_payment_method(value: str) -> str:
    key = str(value or "").strip().lower().replace(" ", "_")
    if not key:
        raise HTTPException(status_code=400, detail="Payment method is required")
    return PAYMENT_NORMALIZATION.get(key, key)


def to_number(value: Any) -> Decimal:
    try:
        return money(value or 0)
    except Exception:
        return Decimal("0.00")


def serialize_address_snapshot(address: UserAddress) -> dict[str, Any]:
    return {
        "id": str(address.id),
        "fullName": address.full_name,
        "mobileNumber": address.mobile_number,
        "addressLine1": address.address_line1,
        "city": address.city,
        "postalCode": address.postal_code,
        "email": address.email,
        "addressType": address.address_type,
    }


def serialize_shipment(shipment: Optional[Shipment]) -> Optional[dict[str, Any]]:
    if not shipment:
        return None
    return {
        "id": str(shipment.id),
        "status": shipment.status,
        "delivery_partner_name": shipment.delivery_partner_name,
        "delivery_partner_phone": shipment.delivery_partner_phone,
        "estimated_delivery_at": shipment.estimated_delivery_at.isoformat() if shipment.estimated_delivery_at else None,
        "shipped_at": shipment.shipped_at.isoformat() if shipment.shipped_at else None,
        "out_for_delivery_at": shipment.out_for_delivery_at.isoformat() if shipment.out_for_delivery_at else None,
        "delivered_at": shipment.delivered_at.isoformat() if shipment.delivered_at else None,
    }


def can_transition_order_status(current_status: str, next_status: str) -> bool:
    if current_status == next_status:
        return True
    return next_status in ALLOWED_STATUS_TRANSITIONS.get(current_status, set())


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


def matches_apply_condition(
    charge: dict[str, Any],
    subtotal_after_discount: Decimal,
    payment_method: str,
) -> bool:
    condition_type = charge.get("applyConditionType", "none")
    condition_value = str(charge.get("applyConditionValue", "") or "").strip()

    if condition_type == "none":
        return True
    if condition_type == "subtotal_lt":
        return subtotal_after_discount < to_number(condition_value)
    if condition_type == "subtotal_gte":
        return subtotal_after_discount >= to_number(condition_value)
    if condition_type == "payment_method":
        return normalize_payment_method(condition_value) == normalize_payment_method(payment_method)
    return True


def is_charge_waived(charge: dict[str, Any], subtotal_after_discount: Decimal) -> bool:
    waive_condition_type = charge.get("waiveConditionType", "none")
    waive_condition_value = str(charge.get("waiveConditionValue", "") or "").strip()

    if waive_condition_type == "subtotal_gte":
        return subtotal_after_discount >= to_number(waive_condition_value)
    return False


def calculate_charge_amount(charge: dict[str, Any], base_amount: Decimal) -> Decimal:
    raw = to_number(charge.get("amountValue"))
    if charge.get("amountType") == "percent":
        return money((base_amount * raw) / Decimal("100"))
    return raw


def evaluate_promo_discount(
    subtotal: Decimal,
    promo_code: Optional[str],
) -> tuple[Optional[str], Decimal]:
    normalized = str(promo_code or "").strip()
    if normalized.lower() == "save10":
        return normalized, money(subtotal * Decimal("0.10"))
    return normalized or None, Decimal("0.00")


def extract_variant_details(
    product: Product,
    selected_variant_value: Optional[str],
) -> tuple[Decimal, Optional[Decimal], Optional[str], Optional[int]]:
    variant_option = product.variant_option or {}
    option_name = variant_option.get("optionName")
    option_values = variant_option.get("optionValues") or []

    if not selected_variant_value:
        return (
            money(product.price),
            money(product.compare_price) if product.compare_price is not None else None,
            option_name,
            product.stock,
        )

    for option in option_values:
        if option.get("value") == selected_variant_value:
            price = (
                money(option["price"])
                if option.get("price") is not None
                else money(product.price)
            )
            compare_price = (
                money(option["comparePrice"])
                if option.get("comparePrice") is not None
                else (money(product.compare_price) if product.compare_price is not None else None)
            )
            stock_qty = option.get("stockQty")
            variant_stock_qty = int(stock_qty) if stock_qty is not None else product.stock
            option_in_stock = option.get("inStock")

            if option_in_stock is False or variant_stock_qty <= 0:
                raise HTTPException(status_code=400, detail="Selected variant is out of stock")

            return (
                price,
                compare_price,
                option_name,
                variant_stock_qty,
            )

    raise HTTPException(status_code=400, detail="Invalid selected variant")


def decrement_product_stock(
    product: Product,
    quantity: int,
    selected_variant_value: Optional[str],
) -> None:
    if product.stock < quantity:
        raise HTTPException(status_code=409, detail=f"Insufficient stock for {product.name}")

    product.stock -= quantity
    product.in_stock = product.stock > 0

    if selected_variant_value:
        variant_option = deepcopy(product.variant_option or {})
        option_values = variant_option.get("optionValues") or []
        found = False

        for option in option_values:
            if option.get("value") == selected_variant_value:
                stock_qty = int(option.get("stockQty") or 0)
                if stock_qty < quantity:
                    raise HTTPException(status_code=409, detail=f"Insufficient variant stock for {product.name}")
                stock_qty -= quantity
                option["stockQty"] = stock_qty
                option["inStock"] = stock_qty > 0
                found = True
                break

        if not found:
            raise HTTPException(status_code=400, detail=f"Invalid variant for {product.name}")

        product.variant_option = variant_option

    product.updated_at = utc_now()


def increment_product_stock(
    product: Product,
    quantity: int,
    selected_variant_value: Optional[str],
) -> None:
    product.stock = int(product.stock or 0) + int(quantity)
    product.in_stock = product.stock > 0

    variant_payload = product.variant_option
    if not variant_payload or not selected_variant_value:
        product.updated_at = utc_now()
        return

    if not isinstance(variant_payload, dict):
        product.updated_at = utc_now()
        return

    variant_option = deepcopy(variant_payload)
    option_values = variant_option.get("optionValues")

    if option_values is None:
        option_values = variant_option.get("option_values")

    if not isinstance(option_values, list):
        product.updated_at = utc_now()
        return

    normalized_selected = str(selected_variant_value).strip().lower()
    found = False

    for option in option_values:
        if not isinstance(option, dict):
            continue

        raw_value = option.get("value")
        raw_label = option.get("label")
        raw_name = option.get("name")

        candidates = {
            str(raw_value).strip().lower() if raw_value is not None else "",
            str(raw_label).strip().lower() if raw_label is not None else "",
            str(raw_name).strip().lower() if raw_name is not None else "",
        }

        if normalized_selected in candidates:
            current_stock = option.get("stockQty")
            if current_stock is None:
                current_stock = option.get("stock_qty")

            try:
                stock_qty = int(current_stock or 0) + int(quantity)
            except (TypeError, ValueError):
                stock_qty = int(quantity)

            option["stockQty"] = stock_qty
            option["inStock"] = stock_qty > 0

            if "stock_qty" in option:
                option["stock_qty"] = stock_qty
            if "in_stock" in option:
                option["in_stock"] = stock_qty > 0

            found = True
            break

    if found:
        if "optionValues" in variant_option:
            variant_option["optionValues"] = option_values
        elif "option_values" in variant_option:
            variant_option["option_values"] = option_values
        else:
            variant_option["optionValues"] = option_values

        product.variant_option = variant_option

    product.updated_at = utc_now()


def evaluate_pricing(
    cart_items: list[dict[str, Any]],
    checkout_settings: dict[str, Any],
    payment_method: str,
    selected_optional_charge_ids: list[str],
    promo_code: Optional[str],
) -> dict[str, Any]:
    subtotal = sum((item["line_total"] for item in cart_items), Decimal("0.00"))
    applied_promo_code, promo_discount = evaluate_promo_discount(subtotal, promo_code)
    subtotal_after_discount = max(subtotal - promo_discount, Decimal("0.00"))

    charges = checkout_settings.get("charges") or []
    enabled_charges = [charge for charge in charges if charge.get("enabled")]
    auto_applied = [
        charge
        for charge in enabled_charges
        if not (charge.get("customerSelectable") and charge.get("optional"))
    ]
    selected_optional = [
        charge
        for charge in enabled_charges
        if charge.get("customerSelectable")
        and charge.get("optional")
        and charge.get("id") in selected_optional_charge_ids
    ]

    applied_charges: list[dict[str, Any]] = []
    waived_charges: list[dict[str, Any]] = []

    for charge in [*auto_applied, *selected_optional]:
        if not matches_apply_condition(charge, subtotal_after_discount, payment_method):
            continue

        base_amount = calculate_charge_amount(charge, subtotal_after_discount)
        waived = is_charge_waived(charge, subtotal_after_discount)
        final_amount = Decimal("0.00") if waived else base_amount

        charge_snapshot = {
            "id": charge.get("id"),
            "code": charge.get("code"),
            "label": charge.get("label"),
            "amountType": charge.get("amountType"),
            "amountValue": str(charge.get("amountValue")),
            "amount": float(base_amount),
            "finalAmount": float(final_amount),
            "applied": True,
            "waived": waived,
            "applyConditionType": charge.get("applyConditionType"),
            "applyConditionValue": charge.get("applyConditionValue"),
            "waiveConditionType": charge.get("waiveConditionType"),
            "waiveConditionValue": charge.get("waiveConditionValue"),
            "customerSelectable": bool(charge.get("customerSelectable")),
            "optional": bool(charge.get("optional")),
        }

        if waived:
            waived_charges.append(charge_snapshot)

        if final_amount > 0:
            applied_charges.append(charge_snapshot)

    charges_total = sum(
        (Decimal(str(charge["finalAmount"])) for charge in applied_charges),
        Decimal("0.00"),
    )

    tax_settings = checkout_settings.get("taxSettings") or {}
    tax_enabled = bool(tax_settings.get("enabled"))
    tax_rate = to_number(tax_settings.get("rate"))
    apply_on_shipping = bool(tax_settings.get("applyOnShipping"))
    tax_base = subtotal_after_discount + charges_total if apply_on_shipping else subtotal_after_discount
    tax_amount = money((tax_base * tax_rate) / Decimal("100")) if tax_enabled else Decimal("0.00")

    total = max(subtotal_after_discount + charges_total + tax_amount, Decimal("0.00"))

    return {
        "currency": "INR",
        "subtotal": float(subtotal),
        "promoCode": applied_promo_code,
        "promoDiscount": float(promo_discount),
        "subtotalAfterDiscount": float(subtotal_after_discount),
        "selectedOptionalChargeIds": selected_optional_charge_ids,
        "charges": applied_charges,
        "waivedCharges": waived_charges,
        "tax": {
            "enabled": tax_enabled,
            "label": tax_settings.get("label") or "Tax",
            "rate": float(tax_rate),
            "applyOnShipping": apply_on_shipping,
            "amount": float(tax_amount),
        },
        "discounts": (
            [{
                "code": "promo_code",
                "label": applied_promo_code,
                "amount": float(promo_discount),
            }]
            if promo_discount > 0 and applied_promo_code
            else []
        ),
        "total": float(total),
        "paymentMethod": payment_method,
    }


def build_order_item_pricing_snapshot(
    line_total: Decimal,
    quantity: int,
    order_subtotal: Decimal,
    pricing_snapshot: dict[str, Any],
) -> dict[str, Any]:
    ratio = Decimal("0.00")
    if order_subtotal > 0:
        ratio = line_total / order_subtotal

    tax_amount = money(Decimal(str(pricing_snapshot["tax"]["amount"])) * ratio)
    promo_discount = money(Decimal(str(pricing_snapshot.get("promoDiscount", 0))) * ratio)

    shipping_allocated = Decimal("0.00")
    cod_fee_allocated = Decimal("0.00")
    other_charges_allocated = Decimal("0.00")

    for charge in pricing_snapshot.get("charges", []):
        code = charge.get("code")
        final_amount = money(charge.get("finalAmount") or 0)
        allocated = money(final_amount * ratio)

        if code == "shipping_fee":
            shipping_allocated += allocated
        elif code == "cod_fee":
            cod_fee_allocated += allocated
        else:
            other_charges_allocated += allocated

    final_paid_for_line = money(
        line_total - promo_discount + tax_amount + shipping_allocated + cod_fee_allocated + other_charges_allocated
    )

    return {
        "unit_price": float(money(line_total / quantity)),
        "quantity": quantity,
        "gross_line_total": float(line_total),
        "discount_allocated": float(promo_discount),
        "tax_amount": float(tax_amount),
        "shipping_allocated": float(shipping_allocated),
        "cod_fee_allocated": float(cod_fee_allocated),
        "other_charges_allocated": float(other_charges_allocated),
        "final_paid_for_line": float(final_paid_for_line),
    }


def serialize_customer_order_item(item: OrderItem) -> dict[str, Any]:
    returnable_quantity = max(int(item.returnable_quantity or 0), 0)
    is_returnable = item.status == "delivered" and returnable_quantity > 0

    return {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "product_name": item.product_name,
        "product_slug": item.product_slug,
        "product_image": item.product_image,
        "selected_variant_label": item.selected_variant_label,
        "selected_variant_value": item.selected_variant_value,
        "unit_price": float(item.unit_price),
        "compare_price": float(item.compare_price) if item.compare_price is not None else None,
        "quantity": item.quantity,
        "line_total": float(item.line_total),
        "status": item.status,
        "returnable_quantity": returnable_quantity,
        "is_returnable": is_returnable,
        "max_returnable_quantity": returnable_quantity,
        "pricing_snapshot": item.pricing_snapshot,
    }


class PlaceOrderRequest(BaseModel):
    address_id: UUID
    payment_method: str = Field(min_length=1, max_length=30)
    selected_optional_charge_ids: list[str] = Field(default_factory=list)
    promo_code: Optional[str] = None
    payment_meta: dict[str, Any] = Field(default_factory=dict)

    @field_validator("payment_method")
    @classmethod
    def clean_payment_method(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Payment method is required")
        return value

    @field_validator("promo_code")
    @classmethod
    def clean_promo_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class UpdateOrderStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=40)
    delivery_partner_name: Optional[str] = Field(default=None, max_length=255)
    delivery_partner_phone: Optional[str] = Field(default=None, max_length=30)
    estimated_delivery_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        value = value.strip()
        if value not in ORDER_STATUSES:
            raise ValueError("Invalid order status")
        return value


class CancelOrderRequest(BaseModel):
    cancel_reason: Optional[str] = None


# =========================
# ADMIN ROUTES FIRST
# =========================


@router.get("/admin/{site_id}/pending-counts")
def get_admin_pending_counts(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Returns the count of orders needing attention (placed) and
    returns needing attention (requested). Used for sidebar badge.
    """
    from models import ReturnRequest

    new_orders = session.exec(
        select(func.count()).select_from(Order).where(
            Order.site_id == site_id,
            Order.status == "placed",
        )
    ).one()

    new_returns = session.exec(
        select(func.count()).select_from(ReturnRequest).where(
            ReturnRequest.site_id == site_id,
            ReturnRequest.status == "requested",
        )
    ).one()

    return {
        "new_orders": new_orders,
        "new_returns": new_returns,
        "total": new_orders + new_returns,
    }


@router.get("/admin/{site_id}")
def get_admin_orders(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    orders = session.exec(
        select(Order)
        .where(Order.site_id == site_id)
        .order_by(Order.created_at.desc())
    ).all()

    order_ids = [order.id for order in orders]
    shipment_map: dict[UUID, Shipment] = {}
    order_items_map: dict[UUID, list[OrderItem]] = {}

    if order_ids:
        shipments = session.exec(
            select(Shipment).where(Shipment.order_id.in_(order_ids))
        ).all()
        shipment_map = {shipment.order_id: shipment for shipment in shipments}

        order_items = session.exec(
            select(OrderItem)
            .where(OrderItem.order_id.in_(order_ids))
            .order_by(OrderItem.id.asc())
        ).all()
        for item in order_items:
            order_items_map.setdefault(item.order_id, []).append(item)

    return [
        {
            "id": str(order.id),
            "customer_id": str(order.customer_id),
            "status": order.status,
            "total": float(order.total),
            "payment_method": order.payment_method,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "confirmed_at": order.confirmed_at.isoformat() if order.confirmed_at else None,
            "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
            "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
            "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
            "cancel_reason": order.cancel_reason,
            "customer_name": (order.shipping_address or {}).get("fullName"),
            "customer_phone": (order.shipping_address or {}).get("mobileNumber"),
            "customer_email": (order.shipping_address or {}).get("email"),
            "shipping_address": order.shipping_address,
            "shipment": serialize_shipment(shipment_map.get(order.id)),
            "items": [
                {
                    "id": str(item.id),
                    "product_id": str(item.product_id),
                    "product_name": item.product_name,
                    "product_slug": item.product_slug,
                    "product_image": item.product_image,
                    "selected_variant_label": item.selected_variant_label,
                    "selected_variant_value": item.selected_variant_value,
                    "unit_price": float(item.unit_price),
                    "compare_price": float(item.compare_price) if item.compare_price is not None else None,
                    "quantity": item.quantity,
                    "line_total": float(item.line_total),
                    "status": item.status,
                    "returnable_quantity": item.returnable_quantity,
                    "pricing_snapshot": item.pricing_snapshot,
                }
                for item in order_items_map.get(order.id, [])
            ],
            "item_count": len(order_items_map.get(order.id, [])),
            "pricing_snapshot": order.pricing_snapshot,
        }
        for order in orders
    ]


@router.get("/admin/{site_id}/{order_id}")
def get_admin_order_detail(
    site_id: UUID,
    order_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    order = session.get(Order, order_id)
    if not order or order.site_id != site_id:
        raise HTTPException(status_code=404, detail="Order not found")

    items = session.exec(
        select(OrderItem)
        .where(OrderItem.order_id == order.id)
        .order_by(OrderItem.id.asc())
    ).all()

    shipment = session.exec(
        select(Shipment).where(Shipment.order_id == order.id)
    ).first()

    history = session.exec(
        select(OrderStatusHistory)
        .where(OrderStatusHistory.order_id == order.id)
        .order_by(OrderStatusHistory.id.asc())
    ).all()

    return {
        "id": str(order.id),
        "customer_id": str(order.customer_id),
        "customer_name": (order.shipping_address or {}).get("fullName"),
        "customer_phone": (order.shipping_address or {}).get("mobileNumber"),
        "customer_email": (order.shipping_address or {}).get("email"),
        "status": order.status,
        "total": float(order.total),
        "payment_method": order.payment_method,
        "shipping_address": order.shipping_address,
        "pricing_snapshot": order.pricing_snapshot,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "confirmed_at": order.confirmed_at.isoformat() if order.confirmed_at else None,
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
        "cancel_reason": order.cancel_reason,
        "items": [
            {
                "id": str(item.id),
                "product_id": str(item.product_id),
                "product_name": item.product_name,
                "product_slug": item.product_slug,
                "product_image": item.product_image,
                "selected_variant_label": item.selected_variant_label,
                "selected_variant_value": item.selected_variant_value,
                "unit_price": float(item.unit_price),
                "compare_price": float(item.compare_price) if item.compare_price is not None else None,
                "quantity": item.quantity,
                "line_total": float(item.line_total),
                "status": item.status,
                "returnable_quantity": item.returnable_quantity,
                "pricing_snapshot": item.pricing_snapshot,
            }
            for item in items
        ],
        "shipment": serialize_shipment(shipment),
        "status_history": [
            {
                "id": str(entry.id),
                "status": entry.status,
                "changed_by": str(entry.changed_by) if entry.changed_by else None,
                "changed_by_type": entry.changed_by_type,
                "created_at": (
                    entry.created_at.isoformat()
                    if hasattr(entry, "created_at") and getattr(entry, "created_at", None)
                    else None
                ),
            }
            for entry in history
        ],
    }


@router.patch("/admin/{site_id}/{order_id}/status")
def update_order_status(
    site_id: UUID,
    order_id: UUID,
    payload: UpdateOrderStatusRequest,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    order = session.get(Order, order_id)
    if not order or order.site_id != site_id:
        raise HTTPException(status_code=404, detail="Order not found")

    if not can_transition_order_status(order.status, payload.status):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {order.status} to {payload.status}",
        )

    items = session.exec(
        select(OrderItem).where(OrderItem.order_id == order.id)
    ).all()

    shipment = session.exec(
        select(Shipment).where(Shipment.order_id == order.id)
    ).first()

    now = utc_now()
    previous_status = order.status
    order.status = payload.status

    try:
        if payload.status == "confirmed":
            order.confirmed_at = now

        elif payload.status == "shipped":
            order.shipped_at = now
            if not shipment:
                shipment = Shipment(
                    order_id=order.id,
                    site_id=site_id,
                    status="shipped",
                    delivery_partner_name=payload.delivery_partner_name,
                    delivery_partner_phone=payload.delivery_partner_phone,
                    estimated_delivery_at=payload.estimated_delivery_at,
                    shipped_at=now,
                )
            else:
                shipment.status = "shipped"
                if payload.delivery_partner_name is not None:
                    shipment.delivery_partner_name = payload.delivery_partner_name
                if payload.delivery_partner_phone is not None:
                    shipment.delivery_partner_phone = payload.delivery_partner_phone
                if payload.estimated_delivery_at is not None:
                    shipment.estimated_delivery_at = payload.estimated_delivery_at
                shipment.shipped_at = now
            session.add(shipment)

        elif payload.status == "out_for_delivery":
            order.shipped_at = order.shipped_at or now
            if not shipment:
                shipment = Shipment(
                    order_id=order.id,
                    site_id=site_id,
                    status="out_for_delivery",
                    delivery_partner_name=payload.delivery_partner_name,
                    delivery_partner_phone=payload.delivery_partner_phone,
                    estimated_delivery_at=payload.estimated_delivery_at,
                    out_for_delivery_at=now,
                )
            else:
                shipment.status = "out_for_delivery"
                if payload.delivery_partner_name is not None:
                    shipment.delivery_partner_name = payload.delivery_partner_name
                if payload.delivery_partner_phone is not None:
                    shipment.delivery_partner_phone = payload.delivery_partner_phone
                if payload.estimated_delivery_at is not None:
                    shipment.estimated_delivery_at = payload.estimated_delivery_at
                shipment.out_for_delivery_at = now
            session.add(shipment)

        elif payload.status == "delivered":
            order.delivered_at = now
            if not shipment:
                shipment = Shipment(
                    order_id=order.id,
                    site_id=site_id,
                    status="delivered",
                    delivered_at=now,
                )
            else:
                shipment.status = "delivered"
                shipment.delivered_at = now
            session.add(shipment)

            for item in items:
                if item.status != "cancelled":
                    item.status = "delivered"
                    item.returnable_quantity = item.quantity
                    item.updated_at = now
                    session.add(item)

        elif payload.status == "cancelled":
            if previous_status == "delivered":
                raise HTTPException(status_code=400, detail="Delivered order cannot be cancelled from this endpoint")

            order.cancelled_at = now
            order.cancel_reason = payload.cancel_reason

            for item in items:
                if item.status == "cancelled":
                    continue

                product = session.exec(
                    select(Product)
                    .where(Product.id == item.product_id, Product.site_id == site_id)
                    .with_for_update()
                ).first()

                if not product:
                    raise HTTPException(status_code=404, detail=f"Product not found for order item {item.id}")

                increment_product_stock(product, item.quantity, item.selected_variant_value)
                session.add(product)

                item.status = "cancelled"
                item.updated_at = now
                session.add(item)

                movement = InventoryMovement(
                    site_id=site_id,
                    product_id=item.product_id,
                    order_id=order.id,
                    order_item_id=item.id,
                    movement_type="cancel_restock",
                    quantity_delta=item.quantity,
                    note=f"Stock restored for cancelled order {order.id}",
                )
                session.add(movement)

        if payload.status in {"confirmed", "shipped", "out_for_delivery"}:
            for item in items:
                if item.status != "cancelled":
                    item.status = payload.status
                    item.updated_at = now
                    session.add(item)

        order.updated_at = now
        session.add(order)

        session.add(
            OrderStatusHistory(
                order_id=order.id,
                status=payload.status,
                changed_by=UUID(admin["adminId"]),
                changed_by_type="admin",
            )
        )

        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise

    return {
        "message": "Order status updated successfully",
        "order_id": str(order.id),
        "status": order.status,
    }


# =========================
# CUSTOMER ROUTES AFTER ADMIN ROUTES
# =========================


@router.post("/{site_id}/place")
def place_order(
    site_id: UUID,
    payload: PlaceOrderRequest,
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
    cart = get_cart_for_user_or_404(session, site_id, customer.id)
    address = get_address_for_user_or_404(session, site_id, customer.id, payload.address_id)

    cart_items = session.exec(
        select(CartItem).where(CartItem.cart_id == cart.id)
    ).all()

    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    payment_method = normalize_payment_method(payload.payment_method)
    checkout_settings = get_site_or_404(session, site_id).checkout_settings or build_default_checkout_settings()

    order_line_items: list[dict[str, Any]] = []
    product_map: dict[UUID, Product] = {}

    try:
        for cart_item in cart_items:
            product = session.exec(
                select(Product)
                .where(Product.id == cart_item.product_id, Product.site_id == site_id)
                .with_for_update()
            ).first()

            if not product:
                raise HTTPException(status_code=404, detail=f"Product not found for cart item {cart_item.id}")

            if not product.in_stock or product.stock <= 0:
                raise HTTPException(status_code=409, detail=f"{product.name} is out of stock")

            unit_price, compare_price, selected_variant_label, available_stock = extract_variant_details(
                product,
                cart_item.selected_variant_value,
            )

            if cart_item.quantity > available_stock:
                raise HTTPException(
                    status_code=409,
                    detail=f"Requested quantity exceeds available stock for {product.name}",
                )

            product_image = None
            if product.images and len(product.images) > 0:
                product_image = product.images[0]

            line_total = money(unit_price * cart_item.quantity)

            order_line_items.append(
                {
                    "cart_item_id": cart_item.id,
                    "product_id": product.id,
                    "product_name": cart_item.product_name or product.name,
                    "product_slug": cart_item.product_slug or product.slug,
                    "product_image": cart_item.product_image or product_image,
                    "selected_variant_label": cart_item.selected_variant_label or selected_variant_label,
                    "selected_variant_value": cart_item.selected_variant_value,
                    "unit_price": unit_price,
                    "compare_price": compare_price,
                    "quantity": cart_item.quantity,
                    "line_total": line_total,
                }
            )
            product_map[product.id] = product

        pricing_snapshot = evaluate_pricing(
            cart_items=order_line_items,
            checkout_settings=checkout_settings,
            payment_method=payment_method,
            selected_optional_charge_ids=payload.selected_optional_charge_ids,
            promo_code=payload.promo_code,
        )

        order = Order(
            site_id=site_id,
            customer_id=customer.id,
            shipping_address_id=address.id,
            shipping_address=serialize_address_snapshot(address),
            items=[
                {
                    "product_id": str(item["product_id"]),
                    "product_name": item["product_name"],
                    "product_slug": item["product_slug"],
                    "product_image": item["product_image"],
                    "selected_variant_label": item["selected_variant_label"],
                    "selected_variant_value": item["selected_variant_value"],
                    "unit_price": float(item["unit_price"]),
                    "compare_price": float(item["compare_price"]) if item["compare_price"] is not None else None,
                    "quantity": item["quantity"],
                    "line_total": float(item["line_total"]),
                }
                for item in order_line_items
            ],
            pricing_snapshot=pricing_snapshot,
            payment_method=payment_method,
            status="placed",
            total=money(pricing_snapshot["total"]),
        )
        session.add(order)
        session.flush()

        order_subtotal = sum((item["line_total"] for item in order_line_items), Decimal("0.00"))

        for item in order_line_items:
            product = product_map[item["product_id"]]
            decrement_product_stock(product, item["quantity"], item["selected_variant_value"])
            session.add(product)

            order_item = OrderItem(
                order_id=order.id,
                site_id=site_id,
                product_id=item["product_id"],
                product_name=item["product_name"],
                product_slug=item["product_slug"],
                product_image=item["product_image"],
                selected_variant_label=item["selected_variant_label"],
                selected_variant_value=item["selected_variant_value"],
                unit_price=item["unit_price"],
                compare_price=item["compare_price"],
                quantity=item["quantity"],
                line_total=item["line_total"],
                status="placed",
                returnable_quantity=0,
                pricing_snapshot=build_order_item_pricing_snapshot(
                    line_total=item["line_total"],
                    quantity=item["quantity"],
                    order_subtotal=order_subtotal,
                    pricing_snapshot=pricing_snapshot,
                ),
            )
            session.add(order_item)
            session.flush()

            movement = InventoryMovement(
                site_id=site_id,
                product_id=item["product_id"],
                order_id=order.id,
                order_item_id=order_item.id,
                movement_type="sale",
                quantity_delta=-item["quantity"],
                note=f"Stock deducted for order {order.id}",
            )
            session.add(movement)

        status_history = OrderStatusHistory(
            order_id=order.id,
            status="placed",
            changed_by=customer.id,
            changed_by_type="customer",
        )
        session.add(status_history)

        session.exec(delete(CartItem).where(CartItem.cart_id == cart.id))
        cart.updated_at = utc_now()
        session.add(cart)

        session.commit()
        session.refresh(order)

        return {
            "message": "Order placed successfully",
            "order_id": str(order.id),
            "status": order.status,
            "total": float(order.total),
            "pricing_snapshot": order.pricing_snapshot,
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise


@router.get("/{site_id}/my-orders")
def get_my_orders(
    site_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))

    orders = session.exec(
        select(Order)
        .where(Order.site_id == site_id, Order.customer_id == customer.id)
        .order_by(Order.created_at.desc())
    ).all()

    order_ids = [order.id for order in orders]
    items_map: dict[UUID, list[OrderItem]] = {}

    if order_ids:
        order_items = session.exec(
            select(OrderItem)
            .where(OrderItem.order_id.in_(order_ids))
            .order_by(OrderItem.id.asc())
        ).all()
        for item in order_items:
            items_map.setdefault(item.order_id, []).append(item)

    response = []
    for order in orders:
        serialized_items = [
            serialize_customer_order_item(item)
            for item in items_map.get(order.id, [])
        ]
        has_returnable_items = any(item["is_returnable"] for item in serialized_items)

        response.append(
            {
                "id": str(order.id),
                "status": order.status,
                "total": float(order.total),
                "payment_method": order.payment_method,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "items": serialized_items,
                "pricing_snapshot": order.pricing_snapshot,
                "has_returnable_items": has_returnable_items,
                "can_request_return": order.status == "delivered" and has_returnable_items,
            }
        )

    return response


@router.get("/{site_id}/my-orders/{order_id}")
def get_my_order_detail(
    site_id: UUID,
    order_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))

    order = session.get(Order, order_id)
    if not order or order.site_id != site_id or order.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Order not found")

    items = session.exec(
        select(OrderItem).where(OrderItem.order_id == order.id).order_by(OrderItem.id.asc())
    ).all()

    shipment = session.exec(
        select(Shipment).where(Shipment.order_id == order.id)
    ).first()

    serialized_items = [serialize_customer_order_item(item) for item in items]
    has_returnable_items = any(item["is_returnable"] for item in serialized_items)

    return {
        "id": str(order.id),
        "status": order.status,
        "total": float(order.total),
        "payment_method": order.payment_method,
        "shipping_address": order.shipping_address,
        "pricing_snapshot": order.pricing_snapshot,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "confirmed_at": order.confirmed_at.isoformat() if order.confirmed_at else None,
        "shipped_at": order.shipped_at.isoformat() if order.shipped_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
        "items": serialized_items,
        "shipment": serialize_shipment(shipment),
        "has_returnable_items": has_returnable_items,
        "can_request_return": order.status == "delivered" and has_returnable_items,
    }


@router.post("/{site_id}/{order_id}/cancel")
def cancel_my_order(
    site_id: UUID,
    order_id: UUID,
    payload: CancelOrderRequest,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))

    order = session.get(Order, order_id)
    if not order or order.site_id != site_id or order.customer_id != customer.id:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in {"placed", "confirmed"}:
        raise HTTPException(status_code=400, detail="This order cannot be cancelled now")

    items = session.exec(
        select(OrderItem).where(OrderItem.order_id == order.id)
    ).all()

    now = utc_now()

    try:
        for item in items:
            if item.status == "cancelled":
                continue

            product = session.exec(
                select(Product)
                .where(Product.id == item.product_id, Product.site_id == site_id)
                .with_for_update()
            ).first()

            if not product:
                raise HTTPException(status_code=404, detail=f"Product not found for order item {item.id}")

            increment_product_stock(product, item.quantity, item.selected_variant_value)
            session.add(product)

            item.status = "cancelled"
            item.updated_at = now
            session.add(item)

            session.add(
                InventoryMovement(
                    site_id=site_id,
                    product_id=item.product_id,
                    order_id=order.id,
                    order_item_id=item.id,
                    movement_type="cancel_restock",
                    quantity_delta=item.quantity,
                    note=f"Customer cancelled order {order.id}",
                )
            )

        order.status = "cancelled"
        order.cancel_reason = payload.cancel_reason
        order.cancelled_at = now
        order.updated_at = now
        session.add(order)

        session.add(
            OrderStatusHistory(
                order_id=order.id,
                status="cancelled",
                changed_by=customer.id,
                changed_by_type="customer",
            )
        )

        session.commit()
        return {
            "message": "Order cancelled successfully",
            "order_id": str(order.id),
            "status": order.status,
            "refund_amount": float(order.total),
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise