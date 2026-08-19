import re
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from auth_middleware import authenticate_admin, authenticate_customer, enforce_site_ownership
from db.database import get_session
from models import (
    DeliveryAgent,
    InventoryMovement,
    Order,
    OrderItem,
    Product,
    ReturnItem,
    ReturnRequest,
    ReturnStatusHistory,
    TenantLedgerEntry,
    User,
)

router = APIRouter(prefix="/returns", tags=["returns"])

RETURN_REASON_CODES = {
    "damaged",
    "defective",
    "wrong_item",
    "size_issue",
    "quality_not_as_expected",
    "changed_mind",
    "other",
}

RESTOCK_DECISIONS = {
    "restock",
    "quarantine",
    "discard",
}

UPI_ID_REGEX = re.compile(r"^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,30}$")
EMAIL_DOMAIN_REGEX = re.compile(r"\.(com|in|co|org|net|io|edu|gov|co\.in|org\.in|ac\.in)$", re.IGNORECASE)
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
ACCOUNT_NUMBER_REGEX = re.compile(r"^\d{9,18}$")
ACCOUNT_HOLDER_REGEX = re.compile(r"^[a-zA-Z\s.]{2,70}$")


def validate_customer_refund_account(rf_acc: Any, is_cod: bool) -> Optional[dict[str, Any]]:
    if not rf_acc:
        if is_cod:
            raise HTTPException(
                status_code=400,
                detail="For Cash on Delivery (COD) orders, please provide your UPI ID or Bank Account details to receive your refund.",
            )
        return None

    if not isinstance(rf_acc, dict):
        raise HTTPException(status_code=400, detail="Invalid refund account payload format")

    acc_type = (rf_acc.get("type") or "").strip().lower()
    if acc_type == "upi":
        upi_id = (rf_acc.get("upi_id") or "").strip()
        if not upi_id or "@" not in upi_id:
            raise HTTPException(
                status_code=400,
                detail="Please provide a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm).",
            )
        parts = upi_id.split("@", 1)
        if len(parts) == 2 and EMAIL_DOMAIN_REGEX.search(parts[1]):
            raise HTTPException(
                status_code=400,
                detail=f"'{upi_id}' appears to be an email address. A valid UPI ID uses a bank handle (e.g. @okhdfcbank, @paytm, @ybl, @okaxis, @upi) without '.com' or '.in'.",
            )
        if not UPI_ID_REGEX.match(upi_id):
            raise HTTPException(
                status_code=400,
                detail=f"'{upi_id}' is not a valid UPI ID format (e.g. yourname@okhdfcbank or 9876543210@paytm).",
            )
        return {
            "type": "upi",
            "upi_id": upi_id,
        }
    elif acc_type == "bank":
        holder = (rf_acc.get("account_holder") or "").strip()
        acc_num = (rf_acc.get("account_number") or "").strip()
        ifsc = (rf_acc.get("ifsc_code") or "").strip().upper()
        bank_name = (rf_acc.get("bank_name") or "").strip() or None

        if not holder or not ACCOUNT_HOLDER_REGEX.match(holder):
            raise HTTPException(
                status_code=400,
                detail="Please provide a valid Account Holder Full Name (letters and spaces only, at least 2 characters).",
            )
        if not acc_num or not ACCOUNT_NUMBER_REGEX.match(acc_num):
            raise HTTPException(
                status_code=400,
                detail="Please provide a valid 9 to 18-digit Bank Account Number (numeric digits only).",
            )
        if not ifsc or not IFSC_REGEX.match(ifsc):
            raise HTTPException(
                status_code=400,
                detail=f"'{ifsc}' is not a valid 11-character Indian Bank IFSC Code (e.g. HDFC0001234, SBIN0000456, ICIC0000001). 5th character must be '0'.",
            )
        return {
            "type": "bank",
            "account_holder": holder,
            "account_number": acc_num,
            "ifsc_code": ifsc,
            "bank_name": bank_name,
        }
    else:
        raise HTTPException(
            status_code=400,
            detail="Please specify a valid refund account type ('upi' or 'bank').",
        )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def money(value: Decimal | float | int | str | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def to_float(value: Decimal | float | int | str | None) -> float:
    return float(money(value))


def get_user_for_site_or_404(session: Session, site_id: UUID, user_id: UUID) -> User:
    user = session.get(User, user_id)
    if not user or user.site_id != site_id:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_return_request_or_404(session: Session, site_id: UUID, return_id: UUID) -> ReturnRequest:
    return_request = session.get(ReturnRequest, return_id)
    if not return_request or return_request.site_id != site_id:
        raise HTTPException(status_code=404, detail="Return request not found")
    return return_request


def get_order_or_404(session: Session, site_id: UUID, order_id: UUID) -> Order:
    order = session.get(Order, order_id)
    if not order or order.site_id != site_id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def add_return_status_history(
    session: Session,
    return_request_id: UUID,
    status: str,
    changed_by: Optional[UUID],
    changed_by_type: str,
    note: Optional[str] = None,
) -> None:
    session.add(
        ReturnStatusHistory(
            return_request_id=return_request_id,
            status=status,
            changed_by=changed_by,
            changed_by_type=changed_by_type,
            note=note,
            changed_at=utc_now(),
        )
    )


def get_prorated_refund_for_quantity(order_item: OrderItem, quantity: int) -> Decimal:
    if quantity <= 0:
        return Decimal("0.00")

    line_total_paid = None
    if getattr(order_item, "pricing_snapshot", None):
        line_total_paid = order_item.pricing_snapshot.get("final_paid_for_line")

    if line_total_paid is None:
        line_total_paid = getattr(order_item, "line_total", 0)

    quantity_base = int(getattr(order_item, "quantity", 0) or 0)
    if quantity_base <= 0:
        return Decimal("0.00")

    per_unit = money(line_total_paid) / Decimal(quantity_base)
    return money(per_unit * quantity)


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

    for option in option_values:
        if not isinstance(option, dict):
            continue

        possible_values = {
            str(option.get("value", "")).strip().lower(),
            str(option.get("label", "")).strip().lower(),
            str(option.get("name", "")).strip().lower(),
        }

        if normalized_selected in possible_values:
            current_stock = option.get("stockQty")
            if current_stock is None:
                current_stock = option.get("stock_qty")

            stock_qty = int(current_stock or 0) + int(quantity)
            option["stockQty"] = stock_qty
            option["inStock"] = stock_qty > 0

            if "stock_qty" in option:
                option["stock_qty"] = stock_qty
            if "in_stock" in option:
                option["in_stock"] = stock_qty > 0
            break

    if "optionValues" in variant_option:
        variant_option["optionValues"] = option_values
    elif "option_values" in variant_option:
        variant_option["option_values"] = option_values
    else:
        variant_option["optionValues"] = option_values

    product.variant_option = variant_option
    product.updated_at = utc_now()


def has_remaining_returnable_items(session: Session, order_id: UUID) -> bool:
    order = session.get(Order, order_id)
    if not order or order.status != "delivered":
        return False
    order_items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()
    return any(
        item.status != "cancelled" and (
            int(item.returnable_quantity or 0) > 0 or 
            (item.returnable_quantity is None and item.status != "returned") or
            (item.returnable_quantity == 0 and item.status in ("placed", "confirmed", "delivered"))
        )
        for item in order_items
    )


def get_effective_refund_quantity(return_request: ReturnRequest, item: ReturnItem) -> int:
    status = (return_request.status or "").lower()

    requested = int(item.quantity_requested or 0)
    approved = int(item.quantity_approved or 0)
    received = int(item.quantity_received or 0)

    if status == "requested":
        return requested
    if status in {"approved", "rejected"}:
        return approved
    if status in {"received", "inspected", "refunded", "closed"}:
        return min(approved, received)

    return min(approved, received)


def recalculate_item_refund(session: Session, return_request: ReturnRequest, item: ReturnItem) -> Decimal:
    with session.no_autoflush:
        source_order_item = session.get(OrderItem, item.order_item_id)
    if not source_order_item:
        raise HTTPException(status_code=404, detail=f"Order item {item.order_item_id} not found")

    effective_qty = get_effective_refund_quantity(return_request, item)
    return get_prorated_refund_for_quantity(source_order_item, effective_qty)


def recalculate_return_amounts(
    session: Session,
    return_request: ReturnRequest,
    items: list[ReturnItem],
    *,
    persist_final: bool = False,
) -> Decimal:
    total = Decimal("0.00")

    for item in items:
        current_amount = recalculate_item_refund(session, return_request, item)
        item.line_refund_final = money(current_amount)
        item.updated_at = utc_now()
        session.add(item)
        total += current_amount

    total = money(total)
    return_request.suggested_refund_amount = total

    if persist_final:
        current_final = money(return_request.final_refund_amount)
        if current_final > total:
            return_request.final_refund_amount = total
    else:
        return_request.final_refund_amount = total

    return_request.updated_at = utc_now()
    session.add(return_request)

    return total


def calculate_display_return_amounts(
    session: Session,
    return_request: ReturnRequest,
    items: list[ReturnItem],
) -> tuple[Decimal, dict[UUID, Decimal]]:
    item_amounts: dict[UUID, Decimal] = {}
    total = Decimal("0.00")

    with session.no_autoflush:
        for item in items:
            amount = money(recalculate_item_refund(session, return_request, item))
            item_amounts[item.id] = amount
            total += amount

    return money(total), item_amounts


def restore_order_item_returnable_quantity(
    session: Session,
    order_item_id: UUID,
    restore_qty: int,
    now: datetime,
) -> None:
    if restore_qty <= 0:
        return

    order_item = session.get(OrderItem, order_item_id)
    if not order_item:
        raise HTTPException(status_code=404, detail=f"Order item {order_item_id} not found")

    order_item.returnable_quantity = int(order_item.returnable_quantity or 0) + int(restore_qty)
    order_item.updated_at = now
    session.add(order_item)


def serialize_return_item(
    return_request: ReturnRequest,
    item: ReturnItem,
    display_amount: Optional[Decimal] = None,
) -> dict[str, Any]:
    effective_qty = get_effective_refund_quantity(return_request, item)
    final_amount = money(display_amount if display_amount is not None else item.line_refund_final)

    return {
        "id": str(item.id),
        "return_request_id": str(item.return_request_id),
        "site_id": str(item.site_id),
        "order_id": str(item.order_id),
        "order_item_id": str(item.order_item_id),
        "product_id": str(item.product_id),
        "product_name": item.product_name,
        "product_slug": item.product_slug,
        "product_image": item.product_image,
        "selected_variant_label": item.selected_variant_label,
        "selected_variant_value": item.selected_variant_value,
        "quantity_requested": int(item.quantity_requested or 0),
        "quantity_approved": int(item.quantity_approved or 0),
        "quantity_received": int(item.quantity_received or 0),
        "effective_refund_quantity": int(effective_qty),
        "reason_code": item.reason_code,
        "reason_note": item.reason_note,
        "unit_price_paid": to_float(item.unit_price_paid),
        "line_refund_suggested": to_float(item.line_refund_suggested),
        "line_refund_final": to_float(final_amount),
        "restock_decision": item.restock_decision,
        "restocked_quantity": int(item.restocked_quantity or 0),
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_return_request_summary(return_request: ReturnRequest, items: list[ReturnItem]) -> dict[str, Any]:
    return {
        "id": str(return_request.id),
        "site_id": str(return_request.site_id),
        "order_id": str(return_request.order_id),
        "customer_id": str(return_request.customer_id),
        "status": return_request.status,
        "refund_status": return_request.refund_status,
        "pickup_status": getattr(return_request, "pickup_status", None),
        "pickup_details": getattr(return_request, "pickup_details", None),
        "request_note": return_request.request_note,
        "admin_note": return_request.admin_note,
        "rejection_reason": return_request.rejection_reason,
        "refund_override_reason": return_request.refund_override_reason,
        "suggested_refund_amount": to_float(return_request.suggested_refund_amount),
        "final_refund_amount": to_float(return_request.final_refund_amount),
        "refund_method": return_request.refund_method,
        "customer_refund_account": getattr(return_request, "customer_refund_account", None),
        "item_count": len(items),
        "total_quantity_requested": sum(int(item.quantity_requested or 0) for item in items),
        "total_quantity_approved": sum(int(item.quantity_approved or 0) for item in items),
        "total_quantity_received": sum(int(item.quantity_received or 0) for item in items),
        "created_at": return_request.created_at.isoformat() if return_request.created_at else None,
        "updated_at": return_request.updated_at.isoformat() if return_request.updated_at else None,
    }


def serialize_return_request_detail(
    return_request: ReturnRequest,
    order: Order,
    items: list[ReturnItem],
    history: list[ReturnStatusHistory],
    session: Session,
) -> dict[str, Any]:
    display_total, item_amounts = calculate_display_return_amounts(session, return_request, items)
    displayed_final_total = min(money(return_request.final_refund_amount), display_total)

    serialized_items = [
        serialize_return_item(return_request, item, item_amounts.get(item.id))
        for item in items
    ]

    return {
        "id": str(return_request.id),
        "site_id": str(return_request.site_id),
        "order_id": str(return_request.order_id),
        "customer_id": str(return_request.customer_id),
        "status": return_request.status,
        "refund_status": return_request.refund_status,
        "pickup_status": getattr(return_request, "pickup_status", None),
        "pickup_details": getattr(return_request, "pickup_details", None),
        "request_note": return_request.request_note,
        "admin_note": return_request.admin_note,
        "rejection_reason": return_request.rejection_reason,
        "refund_override_reason": return_request.refund_override_reason,
        "suggested_refund_amount": to_float(display_total),
        "final_refund_amount": to_float(displayed_final_total),
        "refund_method": return_request.refund_method,
        "customer_refund_account": getattr(return_request, "customer_refund_account", None),
        "approved_at": return_request.approved_at.isoformat() if return_request.approved_at else None,
        "rejected_at": return_request.rejected_at.isoformat() if return_request.rejected_at else None,
        "received_at": return_request.received_at.isoformat() if return_request.received_at else None,
        "inspected_at": return_request.inspected_at.isoformat() if return_request.inspected_at else None,
        "refunded_at": return_request.refunded_at.isoformat() if return_request.refunded_at else None,
        "closed_at": return_request.closed_at.isoformat() if return_request.closed_at else None,
        "created_at": return_request.created_at.isoformat() if return_request.created_at else None,
        "updated_at": return_request.updated_at.isoformat() if return_request.updated_at else None,
        "has_remaining_returnable_items": has_remaining_returnable_items(session, order.id),
        "summary": {
            "total_quantity_requested": sum(int(item.quantity_requested or 0) for item in items),
            "total_quantity_approved": sum(int(item.quantity_approved or 0) for item in items),
            "total_quantity_received": sum(int(item.quantity_received or 0) for item in items),
            "effective_refund_quantity": sum(get_effective_refund_quantity(return_request, item) for item in items),
        },
        "order": {
            "id": str(order.id),
            "status": order.status,
            "payment_method": getattr(order, "payment_method", None),
            "payment_status": getattr(order, "payment_status", None),
            "razorpay_payment_id": getattr(order, "razorpay_payment_id", None),
            "razorpay_order_id": getattr(order, "razorpay_order_id", None),
            "total": to_float(getattr(order, "total", 0)),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "delivered_at": order.delivered_at.isoformat() if getattr(order, "delivered_at", None) else None,
            "shipping_address": getattr(order, "shipping_address", None),
            "pricing_snapshot": getattr(order, "pricing_snapshot", None),
        },
        "items": serialized_items,
        "status_history": [
            {
                "id": str(entry.id),
                "status": entry.status,
                "changed_by": str(entry.changed_by) if entry.changed_by else None,
                "changed_by_type": entry.changed_by_type,
                "note": entry.note,
                "changed_at": entry.changed_at.isoformat() if entry.changed_at else None,
            }
            for entry in history
        ],
    }


class ReturnItemRequest(BaseModel):
    order_item_id: UUID
    quantity: int = Field(gt=0)
    reason_code: str = Field(min_length=1, max_length=60)
    reason_note: Optional[str] = None

    @field_validator("reason_code")
    @classmethod
    def validate_reason_code(cls, value: str) -> str:
        value = value.strip()
        if value not in RETURN_REASON_CODES:
            raise ValueError("Invalid return reason code")
        return value


class CreateReturnRequestPayload(BaseModel):
    order_id: UUID
    request_note: Optional[str] = None
    customer_refund_account: Optional[dict[str, Any]] = None
    items: list[ReturnItemRequest]

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: list[ReturnItemRequest]) -> list[ReturnItemRequest]:
        if not value:
            raise ValueError("At least one return item is required")
        return value


class ReviewReturnItemPayload(BaseModel):
    return_item_id: UUID
    quantity_approved: int = Field(ge=0)


class ReviewReturnRequestPayload(BaseModel):
    action: str = Field(min_length=1, max_length=20)
    admin_note: Optional[str] = None
    rejection_reason: Optional[str] = None
    items: list[ReviewReturnItemPayload] = Field(default_factory=list)

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"approve", "reject"}:
            raise ValueError("Action must be approve or reject")
        return value


class ReceiveReturnItemPayload(BaseModel):
    return_item_id: UUID
    quantity_received: int = Field(ge=0)


class ReceiveReturnRequestPayload(BaseModel):
    admin_note: Optional[str] = None
    items: list[ReceiveReturnItemPayload]

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: list[ReceiveReturnItemPayload]) -> list[ReceiveReturnItemPayload]:
        if not value:
            raise ValueError("At least one received item entry is required")
        return value


class InspectReturnItemPayload(BaseModel):
    return_item_id: UUID
    restock_decision: str = Field(min_length=1, max_length=30)
    restock_quantity: int = Field(ge=0)

    @field_validator("restock_decision")
    @classmethod
    def validate_restock_decision(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in RESTOCK_DECISIONS:
            raise ValueError("Invalid restock decision")
        return value


class InspectReturnRequestPayload(BaseModel):
    admin_note: Optional[str] = None
    items: list[InspectReturnItemPayload]

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: list[InspectReturnItemPayload]) -> list[InspectReturnItemPayload]:
        if not value:
            raise ValueError("At least one inspected item entry is required")
        return value


class RefundReturnRequestPayload(BaseModel):
    refund_method: str = Field(min_length=1, max_length=40)
    final_refund_amount: Optional[Decimal] = None
    refund_override_reason: Optional[str] = None
    admin_note: Optional[str] = None

    @field_validator("refund_method")
    @classmethod
    def validate_refund_method(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Refund method is required")
        return value

    @field_validator("final_refund_amount")
    @classmethod
    def validate_final_refund_amount(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is None:
            return value
        if Decimal(value) < Decimal("0.00"):
            raise ValueError("Refund amount cannot be negative")
        return money(value)


class DispatchReturnPickupPayload(BaseModel):
    mode: str = Field(default="own_agent")  # own_agent | shiprocket | manual
    agent_id: Optional[UUID] = None
    courier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    pickup_notes: Optional[str] = None
    package_weight_grams: Optional[int] = None


@router.post("/{site_id}/request")
def create_return_request(
    site_id: UUID,
    payload: CreateReturnRequestPayload,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer_id = UUID(user["userId"])
    get_user_for_site_or_404(session, site_id, customer_id)

    order = get_order_or_404(session, site_id, payload.order_id)

    if order.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Order not found")

    now = utc_now()
    if order.status != "delivered":
        raise HTTPException(status_code=400, detail="Only delivered orders can be returned")

    if order.return_window_closes_at and now > order.return_window_closes_at:
        closes_str = order.return_window_closes_at.strftime("%d %b %Y, %I:%M %p")
        raise HTTPException(
            status_code=400,
            detail=f"The 48-hour return window for this order closed on {closes_str}.",
        )

    is_cod = (order.payment_method or "").lower() in {"cod", "cash_on_delivery"}
    validated_refund_account = validate_customer_refund_account(payload.customer_refund_account, is_cod)

    order_items = session.exec(
        select(OrderItem).where(OrderItem.order_id == order.id).order_by(OrderItem.created_at.asc())
    ).all()

    order_item_map = {item.id: item for item in order_items}

    requested_ids = [entry.order_item_id for entry in payload.items]
    if len(requested_ids) != len(set(requested_ids)):
        raise HTTPException(status_code=400, detail="Duplicate order items in return request")

    prepared_items: list[dict[str, Any]] = []
    suggested_total = Decimal("0.00")

    for entry in payload.items:
        order_item = order_item_map.get(entry.order_item_id)
        if not order_item:
            raise HTTPException(status_code=404, detail=f"Order item {entry.order_item_id} not found")

        # Auto-heal: if order is delivered but item was never updated from its original status,
        # initialize it now so the return can proceed.
        # IMPORTANT: Only touch items that have NEVER been delivered (status not in delivered/returned).
        # Never reset returnable_quantity if the item is already in delivered/returned state
        # as it may already have valid partial-return deductions.
        if order.status == "delivered" and order_item.status not in ("delivered", "returned", "cancelled"):
            order_item.status = "delivered"
            if order_item.returnable_quantity is None:
                order_item.returnable_quantity = order_item.quantity
            session.add(order_item)

        if order_item.status not in ("delivered",):
            raise HTTPException(status_code=400, detail=f"Order item {order_item.id} is not eligible for return")

        if int(order_item.returnable_quantity or 0) <= 0:
            raise HTTPException(status_code=400, detail=f"Order item {order_item.id} has no returnable quantity left")

        if entry.quantity > int(order_item.returnable_quantity or 0):
            raise HTTPException(
                status_code=400,
                detail=f"Requested return quantity exceeds returnable quantity for item {order_item.id}",
            )

        suggested_refund = get_prorated_refund_for_quantity(order_item, entry.quantity)
        suggested_total += suggested_refund

        prepared_items.append(
            {
                "order_item": order_item,
                "quantity_requested": entry.quantity,
                "reason_code": entry.reason_code,
                "reason_note": entry.reason_note,
                "line_refund_suggested": suggested_refund,
            }
        )

    try:
        now = utc_now()

        return_request = ReturnRequest(
            site_id=site_id,
            order_id=order.id,
            customer_id=customer_id,
            status="requested",
            refund_status="pending",
            request_note=payload.request_note,
            customer_refund_account=validated_refund_account,
            suggested_refund_amount=money(suggested_total),
            final_refund_amount=money(suggested_total),
            created_at=now,
            updated_at=now,
        )
        session.add(return_request)
        session.flush()

        for prepared in prepared_items:
            order_item = prepared["order_item"]

            return_item = ReturnItem(
                return_request_id=return_request.id,
                site_id=site_id,
                order_id=order.id,
                order_item_id=order_item.id,
                product_id=order_item.product_id,
                product_name=order_item.product_name,
                product_slug=order_item.product_slug,
                product_image=order_item.product_image,
                selected_variant_label=order_item.selected_variant_label,
                selected_variant_value=order_item.selected_variant_value,
                quantity_requested=prepared["quantity_requested"],
                quantity_approved=0,
                quantity_received=0,
                reason_code=prepared["reason_code"],
                reason_note=prepared["reason_note"],
                unit_price_paid=money(getattr(order_item, "unit_price", 0)),
                line_refund_suggested=money(prepared["line_refund_suggested"]),
                line_refund_final=money(prepared["line_refund_suggested"]),
                created_at=now,
                updated_at=now,
            )
            session.add(return_item)

            order_item.returnable_quantity = int(order_item.returnable_quantity or 0) - int(prepared["quantity_requested"])
            order_item.updated_at = now
            session.add(order_item)

        add_return_status_history(
            session=session,
            return_request_id=return_request.id,
            status="requested",
            changed_by=customer_id,
            changed_by_type="customer",
            note=payload.request_note,
        )

        session.commit()
        session.refresh(return_request)

        items = session.exec(
            select(ReturnItem)
            .where(ReturnItem.return_request_id == return_request.id)
            .order_by(ReturnItem.created_at.asc())
        ).all()
        history = session.exec(
            select(ReturnStatusHistory)
            .where(ReturnStatusHistory.return_request_id == return_request.id)
            .order_by(ReturnStatusHistory.changed_at.asc())
        ).all()

        return {
            "message": "Return request created successfully",
            "return_request": serialize_return_request_detail(
                return_request=return_request,
                order=order,
                items=items,
                history=history,
                session=session,
            ),
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise


@router.get("/{site_id}/my-returns")
def get_my_returns(
    site_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    customer_id = UUID(user["userId"])
    customer = session.get(User, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer account not found")

    return_requests = session.exec(
        select(ReturnRequest)
        .where(ReturnRequest.site_id == site_id, ReturnRequest.customer_id == customer_id)
        .order_by(ReturnRequest.created_at.desc())
    ).all()

    if not return_requests:
        return []

    return_ids = [item.id for item in return_requests]
    return_items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id.in_(return_ids))
        .order_by(ReturnItem.created_at.asc())
    ).all()

    items_by_return_id: dict[UUID, list[ReturnItem]] = {}
    for item in return_items:
        items_by_return_id.setdefault(item.return_request_id, []).append(item)

    return [
        serialize_return_request_summary(req, items_by_return_id.get(req.id, []))
        for req in return_requests
    ]


@router.get("/{site_id}/my-returns/{return_id}")
def get_my_return_detail(
    site_id: UUID,
    return_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    customer_id = UUID(user["userId"])
    customer = session.get(User, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer account not found")

    return_request = session.get(ReturnRequest, return_id)
    if not return_request or return_request.site_id != site_id or return_request.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Return request not found")

    order = get_order_or_404(session, site_id, return_request.order_id)

    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()

    history = session.exec(
        select(ReturnStatusHistory)
        .where(ReturnStatusHistory.return_request_id == return_request.id)
        .order_by(ReturnStatusHistory.changed_at.asc())
    ).all()

    return serialize_return_request_detail(
        return_request=return_request,
        order=order,
        items=items,
        history=history,
        session=session,
    )


@router.get("/admin/{site_id}")
def get_admin_returns(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_requests = session.exec(
        select(ReturnRequest)
        .where(ReturnRequest.site_id == site_id)
        .order_by(ReturnRequest.created_at.desc())
    ).all()

    if not return_requests:
        return []

    return_ids = [item.id for item in return_requests]
    return_items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id.in_(return_ids))
        .order_by(ReturnItem.created_at.asc())
    ).all()

    items_by_return_id: dict[UUID, list[ReturnItem]] = {}
    for item in return_items:
        items_by_return_id.setdefault(item.return_request_id, []).append(item)

    return [
        serialize_return_request_summary(req, items_by_return_id.get(req.id, []))
        for req in return_requests
    ]


@router.get("/admin/{site_id}/{return_id}")
def get_admin_return_detail(
    site_id: UUID,
    return_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_request = get_return_request_or_404(session, site_id, return_id)
    order = get_order_or_404(session, site_id, return_request.order_id)

    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()

    history = session.exec(
        select(ReturnStatusHistory)
        .where(ReturnStatusHistory.return_request_id == return_request.id)
        .order_by(ReturnStatusHistory.changed_at.asc())
    ).all()

    return serialize_return_request_detail(
        return_request=return_request,
        order=order,
        items=items,
        history=history,
        session=session,
    )


@router.patch("/admin/{site_id}/{return_id}/review")
def review_return_request(
    site_id: UUID,
    return_id: UUID,
    payload: ReviewReturnRequestPayload,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_request = get_return_request_or_404(session, site_id, return_id)

    if return_request.status != "requested":
        raise HTTPException(status_code=400, detail="Only requested returns can be reviewed")

    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()

    items_map = {item.id: item for item in items}
    now = utc_now()

    try:
        if payload.action == "reject":
            if not payload.rejection_reason or not payload.rejection_reason.strip():
                raise HTTPException(status_code=400, detail="Rejection reason is required")

            for item in items:
                restore_order_item_returnable_quantity(
                    session=session,
                    order_item_id=item.order_item_id,
                    restore_qty=int(item.quantity_requested or 0),
                    now=now,
                )
                item.quantity_approved = 0
                item.quantity_received = 0
                item.line_refund_final = Decimal("0.00")
                item.updated_at = now
                session.add(item)

            return_request.status = "rejected"
            return_request.rejected_at = now
            return_request.rejection_reason = payload.rejection_reason.strip()
            return_request.admin_note = payload.admin_note
            return_request.suggested_refund_amount = Decimal("0.00")
            return_request.final_refund_amount = Decimal("0.00")
            return_request.updated_at = now
            session.add(return_request)

            add_return_status_history(
                session=session,
                return_request_id=return_request.id,
                status="rejected",
                changed_by=UUID(admin["adminId"]),
                changed_by_type="admin",
                note=payload.rejection_reason.strip(),
            )

            # Unfreeze / release escrow hold immediately so merchant gets paid
            order_obj = get_order_or_404(session, site_id, return_request.order_id)
            if order_obj and order_obj.escrow_status == "held":
                from routers.payments import unhold_tenant_escrow_transfer
                unhold_tenant_escrow_transfer(order=order_obj, session=session)
        else:
            if not payload.items:
                raise HTTPException(status_code=400, detail="Approved quantities are required")

            reviewed_item_ids: set[UUID] = set()

            for line in payload.items:
                return_item = items_map.get(line.return_item_id)
                if not return_item:
                    raise HTTPException(status_code=404, detail=f"Return item {line.return_item_id} not found")

                approved_qty = int(line.quantity_approved or 0)
                requested_qty = int(return_item.quantity_requested or 0)

                if approved_qty > requested_qty:
                    raise HTTPException(status_code=400, detail="Approved quantity cannot exceed requested quantity")

                unapproved_qty = requested_qty - approved_qty
                if unapproved_qty > 0:
                    restore_order_item_returnable_quantity(
                        session=session,
                        order_item_id=return_item.order_item_id,
                        restore_qty=unapproved_qty,
                        now=now,
                    )

                return_item.quantity_approved = approved_qty
                if int(return_item.quantity_received or 0) > approved_qty:
                    return_item.quantity_received = approved_qty
                return_item.updated_at = now
                session.add(return_item)
                reviewed_item_ids.add(return_item.id)

            for item in items:
                if item.id not in reviewed_item_ids:
                    restore_order_item_returnable_quantity(
                        session=session,
                        order_item_id=item.order_item_id,
                        restore_qty=int(item.quantity_requested or 0),
                        now=now,
                    )
                    item.quantity_approved = 0
                    item.quantity_received = 0
                    item.updated_at = now
                    session.add(item)

            return_request.status = "approved"
            return_request.approved_at = now
            return_request.admin_note = payload.admin_note
            return_request.rejection_reason = None
            return_request.updated_at = now
            session.add(return_request)

            total = recalculate_return_amounts(session, return_request, items, persist_final=False)
            if total <= Decimal("0.00"):
                raise HTTPException(status_code=400, detail="At least one item must be approved")

            add_return_status_history(
                session=session,
                return_request_id=return_request.id,
                status="approved",
                changed_by=UUID(admin["adminId"]),
                changed_by_type="admin",
                note=payload.admin_note,
            )

        session.commit()
        session.refresh(return_request)

        order = get_order_or_404(session, site_id, return_request.order_id)
        latest_items = session.exec(
            select(ReturnItem)
            .where(ReturnItem.return_request_id == return_request.id)
            .order_by(ReturnItem.created_at.asc())
        ).all()
        history = session.exec(
            select(ReturnStatusHistory)
            .where(ReturnStatusHistory.return_request_id == return_request.id)
            .order_by(ReturnStatusHistory.changed_at.asc())
        ).all()

        return {
            "message": f"Return request {payload.action}d successfully",
            "return_request": serialize_return_request_detail(
                return_request=return_request,
                order=order,
                items=latest_items,
                history=history,
                session=session,
            ),
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise


@router.post("/admin/{site_id}/{return_id}/dispatch-pickup")
def dispatch_return_pickup(
    site_id: UUID,
    return_id: UUID,
    payload: DispatchReturnPickupPayload,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_request = get_return_request_or_404(session, site_id, return_id)
    if return_request.status in {"rejected"}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot dispatch pickup for rejected return request.",
        )

    now = utc_now()
    pickup_details = dict(return_request.pickup_details or {})
    mode = (payload.mode or "own_agent").strip().lower()

    if mode == "own_agent":
        if not payload.agent_id:
            raise HTTPException(status_code=400, detail="agent_id is required for in-house rider assignment")
        agent = session.get(DeliveryAgent, payload.agent_id)
        if not agent or agent.site_id != site_id or not agent.is_active:
            raise HTTPException(status_code=404, detail="Active delivery rider not found")

        pickup_details.update({
            "mode": "own_agent",
            "agent_id": str(agent.id),
            "agent_name": agent.name,
            "agent_phone": agent.phone,
            "pickup_status": "assigned",
            "pickup_notes": payload.pickup_notes,
            "assigned_at": now.isoformat(),
        })
        return_request.pickup_status = "assigned"
        agent.current_order_count = (agent.current_order_count or 0) + 1
        session.add(agent)

        history_note = f"Assigned return pickup to rider {agent.name} ({agent.phone})"

    elif mode == "shiprocket":
        courier_name = payload.courier_name or "Shiprocket Auto Courier"
        tracking_num = payload.tracking_number or f"SR-RET-{str(uuid4())[:8].upper()}"
        pickup_details.update({
            "mode": "shiprocket",
            "courier_name": courier_name,
            "tracking_number": tracking_num,
            "pickup_status": "booked",
            "pickup_notes": payload.pickup_notes,
            "weight_grams": payload.package_weight_grams or 500,
            "assigned_at": now.isoformat(),
        })
        return_request.pickup_status = "booked"
        history_note = f"Booked automated reverse courier pickup via {courier_name} (AWB: {tracking_num})"

    elif mode == "manual":
        courier_name = payload.courier_name or "Manual Courier / Self Ship"
        pickup_details.update({
            "mode": "manual",
            "courier_name": courier_name,
            "tracking_number": payload.tracking_number,
            "pickup_status": "dispatched",
            "pickup_notes": payload.pickup_notes,
            "assigned_at": now.isoformat(),
        })
        return_request.pickup_status = "dispatched"
        history_note = f"Configured return courier/partner: {courier_name}"
        if payload.tracking_number:
            history_note += f" (Tracking: {payload.tracking_number})"
    else:
        raise HTTPException(status_code=400, detail="Invalid dispatch mode")

    return_request.pickup_details = pickup_details
    return_request.updated_at = now
    session.add(return_request)

    history = ReturnStatusHistory(
        return_request_id=return_request.id,
        status=return_request.status,
        changed_by=UUID(admin["adminId"]),
        changed_by_type="admin",
        note=history_note,
        changed_at=now,
    )
    session.add(history)
    session.commit()
    session.refresh(return_request)

    order = get_order_or_404(session, site_id, return_request.order_id)
    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()
    all_history = session.exec(
        select(ReturnStatusHistory)
        .where(ReturnStatusHistory.return_request_id == return_request.id)
        .order_by(ReturnStatusHistory.changed_at.asc())
    ).all()

    return {
        "message": "Return pickup assigned successfully",
        "return_request": serialize_return_request_detail(
            return_request=return_request,
            order=order,
            items=items,
            history=all_history,
            session=session,
        ),
    }


@router.patch("/admin/{site_id}/{return_id}/receive")
def receive_return_request(
    site_id: UUID,
    return_id: UUID,
    payload: ReceiveReturnRequestPayload,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_request = get_return_request_or_404(session, site_id, return_id)

    if return_request.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved returns can be received")

    # Strict rule: Reverse pickup rider/courier must be assigned before receiving
    pickup_details = return_request.pickup_details or {}
    has_pickup_partner = bool(
        return_request.pickup_status in {"assigned", "booked", "dispatched", "picked_up"}
        or pickup_details.get("agent_name")
        or pickup_details.get("courier_name")
    )
    if not has_pickup_partner:
        raise HTTPException(
            status_code=400,
            detail="A reverse pickup rider or courier partner must be assigned before receiving returned items. Please assign an in-house rider or courier in the reverse logistics panel first.",
        )

    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()
    items_map = {item.id: item for item in items}
    now = utc_now()

    try:
        total_received = 0

        for line in payload.items:
            return_item = items_map.get(line.return_item_id)
            if not return_item:
                raise HTTPException(status_code=404, detail=f"Return item {line.return_item_id} not found")

            approved_qty = int(return_item.quantity_approved or 0)
            received_qty = int(line.quantity_received or 0)

            if received_qty > approved_qty:
                raise HTTPException(status_code=400, detail="Received quantity cannot exceed approved quantity")

            previous_received = int(return_item.quantity_received or 0)

            if received_qty < approved_qty and previous_received == 0:
                restore_order_item_returnable_quantity(
                    session=session,
                    order_item_id=return_item.order_item_id,
                    restore_qty=approved_qty - received_qty,
                    now=now,
                )

            return_item.quantity_received = received_qty
            return_item.updated_at = now
            session.add(return_item)

            total_received += received_qty

        if total_received <= 0:
            raise HTTPException(status_code=400, detail="At least one item must be received")

        return_request.status = "received"
        return_request.received_at = now
        return_request.admin_note = payload.admin_note
        return_request.updated_at = now
        session.add(return_request)

        recalculate_return_amounts(session, return_request, items, persist_final=False)

        add_return_status_history(
            session=session,
            return_request_id=return_request.id,
            status="received",
            changed_by=UUID(admin["adminId"]),
            changed_by_type="admin",
            note=payload.admin_note,
        )

        session.commit()
        session.refresh(return_request)

        order = get_order_or_404(session, site_id, return_request.order_id)
        latest_items = session.exec(
            select(ReturnItem)
            .where(ReturnItem.return_request_id == return_request.id)
            .order_by(ReturnItem.created_at.asc())
        ).all()
        history = session.exec(
            select(ReturnStatusHistory)
            .where(ReturnStatusHistory.return_request_id == return_request.id)
            .order_by(ReturnStatusHistory.changed_at.asc())
        ).all()

        return {
            "message": "Return request marked as received",
            "return_request": serialize_return_request_detail(
                return_request=return_request,
                order=order,
                items=latest_items,
                history=history,
                session=session,
            ),
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise


@router.patch("/admin/{site_id}/{return_id}/inspect")
def inspect_return_request(
    site_id: UUID,
    return_id: UUID,
    payload: InspectReturnRequestPayload,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_request = get_return_request_or_404(session, site_id, return_id)

    if return_request.status != "received":
        raise HTTPException(status_code=400, detail="Only received returns can be inspected")

    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()
    items_map = {item.id: item for item in items}
    now = utc_now()

    try:
        for line in payload.items:
            return_item = items_map.get(line.return_item_id)
            if not return_item:
                raise HTTPException(status_code=404, detail=f"Return item {line.return_item_id} not found")

            if int(line.restock_quantity or 0) > int(return_item.quantity_received or 0):
                raise HTTPException(status_code=400, detail="Restock quantity cannot exceed received quantity")

            return_item.restock_decision = line.restock_decision
            return_item.restocked_quantity = 0

            if line.restock_decision == "restock" and int(line.restock_quantity or 0) > 0:
                product = session.exec(
                    select(Product)
                    .where(Product.id == return_item.product_id, Product.site_id == site_id)
                    .with_for_update()
                ).first()

                if not product:
                    raise HTTPException(status_code=404, detail=f"Product not found for return item {return_item.id}")

                increment_product_stock(
                    product=product,
                    quantity=int(line.restock_quantity or 0),
                    selected_variant_value=return_item.selected_variant_value,
                )
                session.add(product)

                session.add(
                    InventoryMovement(
                        site_id=site_id,
                        product_id=return_item.product_id,
                        order_id=return_item.order_id,
                        order_item_id=return_item.order_item_id,
                        movement_type="return_restock",
                        quantity_delta=int(line.restock_quantity or 0),
                        note=f"Stock restored after return inspection for return request {return_request.id}",
                    )
                )

                return_item.restocked_quantity = int(line.restock_quantity or 0)

            return_item.updated_at = now
            session.add(return_item)

        return_request.status = "inspected"
        return_request.inspected_at = now
        return_request.admin_note = payload.admin_note
        return_request.updated_at = now
        session.add(return_request)

        recalculate_return_amounts(session, return_request, items, persist_final=True)

        add_return_status_history(
            session=session,
            return_request_id=return_request.id,
            status="inspected",
            changed_by=UUID(admin["adminId"]),
            changed_by_type="admin",
            note=payload.admin_note,
        )

        session.commit()
        session.refresh(return_request)

        order = get_order_or_404(session, site_id, return_request.order_id)
        latest_items = session.exec(
            select(ReturnItem)
            .where(ReturnItem.return_request_id == return_request.id)
            .order_by(ReturnItem.created_at.asc())
        ).all()
        history = session.exec(
            select(ReturnStatusHistory)
            .where(ReturnStatusHistory.return_request_id == return_request.id)
            .order_by(ReturnStatusHistory.changed_at.asc())
        ).all()

        return {
            "message": "Return inspection completed",
            "return_request": serialize_return_request_detail(
                return_request=return_request,
                order=order,
                items=latest_items,
                history=history,
                session=session,
            ),
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise


@router.patch("/admin/{site_id}/{return_id}/refund")
def refund_return_request(
    site_id: UUID,
    return_id: UUID,
    payload: RefundReturnRequestPayload,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_request = get_return_request_or_404(session, site_id, return_id)
    order = get_order_or_404(session, site_id, return_request.order_id)

    if return_request.status != "inspected":
        raise HTTPException(status_code=400, detail="Only inspected returns can be refunded")

    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()

    allowed_amount = recalculate_return_amounts(session, return_request, items, persist_final=True)
    suggested_amount = money(allowed_amount)
    final_amount = money(payload.final_refund_amount) if payload.final_refund_amount is not None else suggested_amount

    if final_amount > suggested_amount:
        raise HTTPException(status_code=400, detail="Final refund amount cannot exceed the allowed refund amount")

    if final_amount != suggested_amount:
        if not payload.refund_override_reason or not payload.refund_override_reason.strip():
            raise HTTPException(status_code=400, detail="Refund override reason is required when refund amount is changed")

    now = utc_now()

    try:
        return_request.suggested_refund_amount = suggested_amount
        return_request.final_refund_amount = final_amount
        return_request.refund_method = payload.refund_method
        return_request.refund_override_reason = (
            payload.refund_override_reason.strip()
            if payload.refund_override_reason and payload.refund_override_reason.strip()
            else None
        )
        return_request.refund_status = "processed"
        return_request.status = "refunded"
        return_request.refunded_at = now
        return_request.admin_note = payload.admin_note
        return_request.updated_at = now
        session.add(return_request)

        # Check if this is a Full Refund vs Partial Refund
        refund_amount_dec = Decimal(str(final_amount))
        is_full_refund = refund_amount_dec >= Decimal(str(order.total))

        # Update order item statuses for items in this return request
        for ret_item in items:
            order_item = session.get(OrderItem, ret_item.order_item_id)
            if order_item:
                if (order_item.returnable_quantity or 0) == 0:
                    order_item.status = "returned"
                else:
                    order_item.status = "delivered"
                order_item.updated_at = now
                session.add(order_item)

        # Check total returned items across the entire order
        order_items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
        total_order_qty = sum(item.quantity for item in order_items)
        all_order_returns = session.exec(select(ReturnRequest).where(ReturnRequest.order_id == order.id)).all()
        returned_request_ids = [r.id for r in all_order_returns if r.status in ("refunded", "closed") or r.id == return_request.id]
        all_returned_items = session.exec(select(ReturnItem).where(ReturnItem.return_request_id.in_(returned_request_ids))).all() if returned_request_ids else []
        total_returned_qty = sum((item.quantity_received if item.quantity_received is not None else (item.quantity_approved or item.quantity_requested or 0)) for item in all_returned_items)

        is_all_returned = is_full_refund or (total_returned_qty >= total_order_qty) or all(getattr(oi, "returnable_quantity", 0) == 0 for oi in order_items)

        # If online payment via Razorpay, trigger gateway refund
        if order.razorpay_payment_id and not order.razorpay_payment_id.startswith("pay_mock_"):
            try:
                from routers.payments import get_razorpay_client
                client = get_razorpay_client()
                if client:
                    refund_amount_paise = int(refund_amount_dec * 100)
                    refund_resp = client.payment.refund(
                        order.razorpay_payment_id,
                        {
                            "amount": refund_amount_paise,
                            "reverse_all": 1 if is_full_refund else 0,
                            "notes": {
                                "reason": "Customer return approved",
                                "site_id": str(site_id),
                                "return_id": str(return_request.id),
                                "is_full_refund": str(is_full_refund),
                            },
                        },
                    )
                    if isinstance(refund_resp, dict):
                        snapshot = dict(order.pricing_snapshot or {})
                        snapshot["refund_details"] = {
                            "refund_id": refund_resp.get("id"),
                            "status": refund_resp.get("status", "processed"),
                            "amount": (refund_resp.get("amount") or refund_amount_paise) / 100,
                            "arn": refund_resp.get("acquirer_data", {}).get("arn") if isinstance(refund_resp.get("acquirer_data"), dict) else None,
                            "created_at": refund_resp.get("created_at"),
                        }
                        order.pricing_snapshot = snapshot
            except Exception as rerr:
                print(f"Razorpay refund warning on return refund: {rerr}")

        ledger_entry = session.exec(
            select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
        ).first()

        if is_all_returned:
            order.status = "returned"
            order.payment_status = "refunded"
            order.escrow_status = "reversed"
            if ledger_entry:
                ledger_entry.status = "refunded"
                ledger_entry.escrow_status = "reversed"
                ledger_entry.updated_at = now
                session.add(ledger_entry)
        else:
            order.payment_status = "partially_refunded"
            if ledger_entry:
                commission_percent = ledger_entry.platform_fee_percent or Decimal("3.00")
                refunded_tenant_share = money(refund_amount_dec * (Decimal("1") - commission_percent / Decimal("100")))
                refunded_platform_fee = money(refund_amount_dec - refunded_tenant_share)

                new_gross = max(Decimal("0.00"), money(ledger_entry.gross_amount - refund_amount_dec))
                new_tenant_share = max(Decimal("0.00"), money(ledger_entry.tenant_share - refunded_tenant_share))
                new_fee = max(Decimal("0.00"), money(ledger_entry.platform_fee - refunded_platform_fee))

                ledger_entry.gross_amount = new_gross
                ledger_entry.tenant_share = new_tenant_share
                ledger_entry.platform_fee = new_fee
                ledger_entry.updated_at = now
                session.add(ledger_entry)

        order.updated_at = now
        session.add(order)

        add_return_status_history(
            session=session,
            return_request_id=return_request.id,
            status="refunded",
            changed_by=UUID(admin["adminId"]),
            changed_by_type="admin",
            note=payload.admin_note or return_request.refund_override_reason,
        )

        session.commit()
        session.refresh(return_request)

        order = get_order_or_404(session, site_id, return_request.order_id)
        latest_items = session.exec(
            select(ReturnItem)
            .where(ReturnItem.return_request_id == return_request.id)
            .order_by(ReturnItem.created_at.asc())
        ).all()
        history = session.exec(
            select(ReturnStatusHistory)
            .where(ReturnStatusHistory.return_request_id == return_request.id)
            .order_by(ReturnStatusHistory.changed_at.asc())
        ).all()

        return {
            "message": "Refund processed successfully",
            "return_request": serialize_return_request_detail(
                return_request=return_request,
                order=order,
                items=latest_items,
                history=history,
                session=session,
            ),
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise


@router.patch("/admin/{site_id}/{return_id}/close")
def close_return_request(
    site_id: UUID,
    return_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    return_request = get_return_request_or_404(session, site_id, return_id)

    if return_request.status not in {"refunded", "rejected"}:
        raise HTTPException(status_code=400, detail="Only refunded or rejected returns can be closed")

    items = session.exec(
        select(ReturnItem)
        .where(ReturnItem.return_request_id == return_request.id)
        .order_by(ReturnItem.created_at.asc())
    ).all()

    now = utc_now()

    try:
        recalculate_return_amounts(session, return_request, items, persist_final=True)

        return_request.status = "closed"
        return_request.closed_at = now
        return_request.updated_at = now
        session.add(return_request)

        add_return_status_history(
            session=session,
            return_request_id=return_request.id,
            status="closed",
            changed_by=UUID(admin["adminId"]),
            changed_by_type="admin",
            note="Return request closed",
        )

        session.commit()
        session.refresh(return_request)

        order = get_order_or_404(session, site_id, return_request.order_id)
        latest_items = session.exec(
            select(ReturnItem)
            .where(ReturnItem.return_request_id == return_request.id)
            .order_by(ReturnItem.created_at.asc())
        ).all()
        history = session.exec(
            select(ReturnStatusHistory)
            .where(ReturnStatusHistory.return_request_id == return_request.id)
            .order_by(ReturnStatusHistory.changed_at.asc())
        ).all()

        return {
            "message": "Return request closed successfully",
            "return_request": serialize_return_request_detail(
                return_request=return_request,
                order=order,
                items=latest_items,
                history=history,
                session=session,
            ),
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise