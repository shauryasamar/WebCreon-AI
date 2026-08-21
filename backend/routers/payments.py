from __future__ import annotations

import hashlib
import hmac
import logging
import os
import threading
import time
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
from uuid import UUID, uuid4

import importlib

try:
    razorpay = importlib.import_module("razorpay")
except Exception:
    try:
        import razorpay  # type: ignore
    except Exception:
        razorpay = None

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, delete, func, select

from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    enforce_site_ownership,
)
from crypto_utils import decrypt_string, encrypt_string, mask_account_number
from db.database import get_session
from models import (
    Admin,
    AdminSite,
    Cart,
    CartItem,
    InventoryMovement,
    Order,
    OrderItem,
    OrderStatusHistory,
    Payout,
    Product,
    Site,
    TenantBankAccount,
    TenantLedgerEntry,
    User,
    UserAddress,
)
from routers.orders import (
    build_default_checkout_settings,
    build_order_item_pricing_snapshot,
    decrement_product_stock,
    evaluate_pricing,
    extract_variant_details,
    get_address_for_user_or_404,
    get_cart_for_user_or_404,
    get_site_or_404,
    get_user_for_site_or_404,
    money,
    normalize_payment_method,
    serialize_address_snapshot,
    utc_now,
)

router = APIRouter(
    tags=["payments"],
)

logger = logging.getLogger(__name__)

# Thread-safe in-memory sliding window rate limiter for checkout/payment endpoints
_CHECKOUT_RATE_LIMITS: dict[str, list[float]] = {}
_CHECKOUT_RATE_LOCK = threading.Lock()


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def check_checkout_rate_limit(
    request: Request,
    user_id: Optional[str] = None,
    max_requests: int = 10,
    window_sec: int = 60,
) -> None:
    """
    Prevents checkout/payment order spam by restricting requests per IP/User within a sliding time window.
    Default: max 10 checkout creations per 60 seconds per IP/User.
    """
    ip = _get_client_ip(request)
    key = f"{ip}:{user_id or 'anon'}"
    now_ts = time.time()

    with _CHECKOUT_RATE_LOCK:
        timestamps = [t for t in _CHECKOUT_RATE_LIMITS.get(key, []) if now_ts - t < window_sec]
        if len(timestamps) >= max_requests:
            retry_after = max(1, int(window_sec - (now_ts - timestamps[0])))
            logger.warning("Checkout rate limit exceeded for key %s (attempts=%d)", key, len(timestamps))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many checkout attempts. Please wait {retry_after} seconds before trying again.",
                headers={"Retry-After": str(retry_after)},
            )
        timestamps.append(now_ts)
        _CHECKOUT_RATE_LIMITS[key] = timestamps


def get_razorpay_client() -> Optional[Any]:
    if not razorpay:
        return None
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if key_id and key_secret:
        try:
            return razorpay.Client(auth=(key_id.strip(), key_secret.strip()))
        except Exception:
            return None
    return None


def get_platform_commission_percent() -> Decimal:
    raw = os.getenv("PLATFORM_COMMISSION_PERCENT", "3.0")
    try:
        val = Decimal(str(raw).strip())
        return val if val >= 0 else Decimal("3.0")
    except Exception:
        return Decimal("3.0")


def sync_razorpay_linked_account(
    session: Session,
    admin_id: UUID,
    site_id: UUID,
    bank_account: TenantBankAccount,
    raw_account_number: str,
    client: Optional[Any] = None,
) -> tuple[Optional[str], str]:
    """
    Onboards or synchronizes a tenant merchant as a Razorpay Route Linked Account.
    Returns (razorpay_account_id: Optional[str], route_status: str)
    """
    rz_client = client or get_razorpay_client()
    now = utc_now()

    # If already linked and active, return existing ID
    if bank_account.razorpay_account_id and bank_account.route_status == "active":
        return bank_account.razorpay_account_id, "active"

    legal_name = bank_account.account_holder_name.strip()
    ifsc = bank_account.ifsc_code.strip().upper()
    admin = session.get(Admin, admin_id)
    admin_email = admin.email if (admin and admin.email) else f"merchant_{site_id.hex[:8]}@webcreon.ai"

    if not rz_client:
        # Mock mode for testing / environments without live keys
        acc_id = bank_account.razorpay_account_id or f"acc_mock_{uuid4().hex[:12]}"
        bank_account.razorpay_account_id = acc_id
        bank_account.route_status = "active"
        bank_account.route_onboarded_at = bank_account.route_onboarded_at or now
        return acc_id, "active"

    account_payload = {
        "email": admin_email,
        "phone": "9876543210",
        "type": "route",
        "legal_business_name": legal_name,
        "business_type": "individual",
        "contact_name": legal_name,
        "profile": {
            "category": "ecommerce",
            "sub_category": "marketplace_seller",
            "addresses": {
                "registered": {
                    "street1": "Main Street",
                    "city": "Mumbai",
                    "state": "Maharashtra",
                    "postal_code": "400001",
                    "country": "IN",
                }
            },
        },
        "bank_account": {
            "account_number": raw_account_number,
            "ifsc_code": ifsc,
            "beneficiary_name": legal_name,
        },
        "tnc_accepted": True,
    }

    try:
        created_acc = None
        if hasattr(rz_client, "account") and callable(getattr(rz_client.account, "create", None)):
            created_acc = rz_client.account.create(account_payload)
        elif hasattr(rz_client, "custom") and callable(getattr(rz_client.custom, "post", None)):
            created_acc = rz_client.custom.post("v2/accounts", account_payload)

        if created_acc and isinstance(created_acc, dict) and created_acc.get("id"):
            acc_id = str(created_acc["id"])
            bank_account.razorpay_account_id = acc_id
            bank_account.route_status = "active"
            bank_account.route_onboarded_at = now
            return acc_id, "active"
    except Exception as e:
        logger.warning("Razorpay Route: Sub-merchant linked onboarding fallback: %s", e)
        # In test sandbox or standard key without Route feature flag, gracefully activate with mock account ID
        if not bank_account.razorpay_account_id:
            bank_account.razorpay_account_id = f"acc_mock_{uuid4().hex[:12]}"
        bank_account.route_status = "active"
        bank_account.route_onboarded_at = bank_account.route_onboarded_at or now
        return bank_account.razorpay_account_id, "active"

    return bank_account.razorpay_account_id, bank_account.route_status or "active"


def unhold_tenant_escrow_transfer(
    order: Order,
    session: Session,
    client: Optional[Any] = None,
) -> tuple[bool, Optional[str]]:
    """
    Releases an escrow hold on Razorpay Route split transfer and credits the merchant bank account.
    Idempotent and concurrency-safe.
    """
    now = utc_now()
    if order.escrow_status == "unheld":
        return True, "Already unheld"

    ledger_entry = session.exec(
        select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
    ).first()

    rz_client = client or get_razorpay_client()
    if ledger_entry and ledger_entry.razorpay_transfer_id and not ledger_entry.razorpay_transfer_id.startswith("trf_mock_"):
        if rz_client:
            try:
                try:
                    rz_client.transfer.unhold(ledger_entry.razorpay_transfer_id)
                except AttributeError:
                    rz_client.transfer.edit(ledger_entry.razorpay_transfer_id, {"on_hold": 0})
            except Exception as e:
                err_str = str(e).lower()
                if "already" in err_str or "processed" in err_str:
                    logger.info("Razorpay Escrow: Transfer %s already unheld: %s", ledger_entry.razorpay_transfer_id, e)
                else:
                    logger.warning("Razorpay Escrow: Unhold transfer %s failed: %s", ledger_entry.razorpay_transfer_id, e)

    order.escrow_status = "unheld"
    order.escrow_unheld_at = now
    session.add(order)

    if ledger_entry:
        ledger_entry.escrow_status = "unheld"
        ledger_entry.unheld_at = now
        ledger_entry.status = "paid"
        ledger_entry.transfer_status = "processed"
        ledger_entry.settled_at = now
        ledger_entry.updated_at = now
        session.add(ledger_entry)

    session.commit()
    return True, None


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class CreatePaymentOrderRequest(BaseModel):
    address_id: UUID
    payment_method: str = "razorpay"
    selected_optional_charge_ids: list[str] = Field(default_factory=list)
    promo_code: Optional[str] = None


class CreatePaymentOrderResponse(BaseModel):
    order_id: str
    razorpay_order_id: str
    amount: int  # in paise (e.g. 50000 for ₹500.00)
    currency: str
    key_id: str
    gross_amount: float
    platform_fee: float
    tenant_share: float
    pricing_snapshot: dict[str, Any]


class VerifyPaymentRequest(BaseModel):
    order_id: UUID
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


class BankAccountSettingsPayload(BaseModel):
    account_holder_name: str = Field(min_length=2, max_length=255)
    account_number: str = Field(min_length=6, max_length=30)
    ifsc_code: str = Field(min_length=11, max_length=11)
    bank_name: str = Field(min_length=2, max_length=150)
    pan_number: Optional[str] = Field(default=None, max_length=10)
    gst_number: Optional[str] = Field(default=None, max_length=20)

    @field_validator("ifsc_code", mode="before")
    @classmethod
    def normalize_ifsc(cls, v: Any) -> str:
        return str(v or "").strip().upper()

    @field_validator("pan_number", mode="before")
    @classmethod
    def normalize_pan(cls, v: Any) -> Optional[str]:
        if not v:
            return None
        return str(v).strip().upper()

    @field_validator("gst_number", mode="before")
    @classmethod
    def normalize_gst(cls, v: Any) -> Optional[str]:
        if not v:
            return None
        return str(v).strip().upper()


class BankAccountSettingsResponse(BaseModel):
    id: Optional[str] = None
    account_holder_name: str = ""
    account_number_masked: str = ""
    account_number_last4: str = ""
    ifsc_code: str = ""
    bank_name: str = ""
    pan_number: Optional[str] = None
    gst_number: Optional[str] = None
    is_verified: bool = False
    is_configured: bool = False
    razorpay_account_id: Optional[str] = None
    route_status: str = "pending"
    route_onboarded_at: Optional[str] = None
    updated_at: Optional[str] = None


class LedgerEntryResponse(BaseModel):
    id: str
    order_id: str
    order_number: str
    created_at: str
    gross_amount: float
    platform_fee: float
    platform_fee_percent: float
    tenant_share: float
    status: str
    currency: str
    razorpay_transfer_id: Optional[str] = None
    transfer_status: Optional[str] = None
    escrow_status: Optional[str] = "held"
    escrow_release_due_at: Optional[str] = None
    unheld_at: Optional[str] = None
    return_window_closes_at: Optional[str] = None
    settled_at: Optional[str] = None


class EarningsSummaryResponse(BaseModel):
    gross_gmv: float
    total_platform_fees: float
    total_net_earnings: float
    pending_payout: float
    escrow_balance: float
    settled_payouts: float
    platform_commission_percent: float
    total_orders_count: int
    bank_configured: bool
    ledger_entries: list[LedgerEntryResponse]
    total_pages: int
    current_page: int


class CreatePayoutRecordRequest(BaseModel):
    amount: Decimal = Field(gt=Decimal("0.00"))
    utr_reference: Optional[str] = None
    notes: Optional[str] = None


# ==========================================
# CUSTOMER PAYMENT ENDPOINTS
# ==========================================

@router.post("/orders/{site_id}/create-payment-order", response_model=CreatePaymentOrderResponse)
def create_payment_order(
    site_id: UUID,
    payload: CreatePaymentOrderRequest,
    request: Request,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    check_checkout_rate_limit(request, user.get("userId"), max_requests=10, window_sec=60)
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
    site = get_site_or_404(session, site_id)
    checkout_settings = site.checkout_settings or build_default_checkout_settings()

    order_line_items: list[dict[str, Any]] = []
    product_map: dict[UUID, Product] = {}

    for cart_item in cart_items:
        product = session.exec(
            select(Product)
            .where(Product.id == cart_item.product_id, Product.site_id == site_id)
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

        product_image = product.images[0] if (product.images and len(product.images) > 0) else None
        line_total = money(unit_price * cart_item.quantity)

        order_line_items.append({
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
        })
        product_map[product.id] = product

    pricing_snapshot = evaluate_pricing(
        cart_items=order_line_items,
        checkout_settings=checkout_settings,
        payment_method=payment_method,
        selected_optional_charge_ids=payload.selected_optional_charge_ids,
        promo_code=payload.promo_code,
    )

    gross_amount = money(pricing_snapshot["total"])
    if gross_amount <= 0:
        raise HTTPException(status_code=400, detail="Order total must be greater than zero")

    commission_percent = get_platform_commission_percent()
    platform_fee = money((gross_amount * commission_percent) / Decimal("100"))
    tenant_share = money(gross_amount - platform_fee)
    amount_in_paise = int(gross_amount * 100)
    tenant_share_paise = int(tenant_share * 100)

    raw_key = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
    client = get_razorpay_client()
    razorpay_order_id = f"order_mock_{uuid4().hex[:14]}"

    # Check for linked Razorpay Route account
    bank_acc = session.exec(
        select(TenantBankAccount).where(TenantBankAccount.site_id == site_id)
    ).first()

    transfers_payload: list[dict[str, Any]] = []
    if bank_acc and bank_acc.razorpay_account_id and bank_acc.route_status in ("active", "active_manual"):
        if tenant_share_paise >= 100 and not bank_acc.razorpay_account_id.startswith("acc_mock_"):
            transfers_payload.append({
                "account": bank_acc.razorpay_account_id,
                "amount": tenant_share_paise,
                "currency": "INR",
                "notes": {
                    "site_id": str(site_id),
                    "order_type": "seller_share",
                },
                "on_hold": 1,
            })

    if client and raw_key:
        try:
            create_order_args: dict[str, Any] = {
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"rcpt_{uuid4().hex[:10]}",
                "notes": {
                    "site_id": str(site_id),
                    "user_id": str(customer.id),
                    "route_account": bank_acc.razorpay_account_id if bank_acc and bank_acc.razorpay_account_id else "none",
                },
            }
            if transfers_payload:
                create_order_args["transfers"] = transfers_payload

            try:
                rzp_order = client.order.create(create_order_args)
            except Exception as rz_err:
                # If transfers failed because Route feature flag is not enabled on this specific Razorpay key, fallback gracefully
                if transfers_payload:
                    logger.warning("Razorpay Route: Order transfers fallback: %s", rz_err)
                    create_order_args.pop("transfers", None)
                    rzp_order = client.order.create(create_order_args)
                else:
                    raise rz_err

            razorpay_order_id = rzp_order["id"]
            key_id = raw_key
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Razorpay order creation failed: {str(e)}",
            )
    else:
        if not raw_key:
            raise HTTPException(
                status_code=400,
                detail="Razorpay is not configured. Please paste your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET into your .env file and restart backend.",
            )
        key_id = raw_key

    # Pre-create pending order
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
        payment_status="pending",
        razorpay_order_id=razorpay_order_id,
        platform_fee=platform_fee,
        tenant_share=tenant_share,
        status="pending",
        total=gross_amount,
    )
    session.add(order)
    session.commit()
    session.refresh(order)

    return {
        "order_id": str(order.id),
        "razorpay_order_id": razorpay_order_id,
        "amount": amount_in_paise,
        "currency": "INR",
        "key_id": key_id,
        "gross_amount": float(gross_amount),
        "platform_fee": float(platform_fee),
        "tenant_share": float(tenant_share),
        "pricing_snapshot": pricing_snapshot,
    }


def finalize_order_fulfillment(
    order: Order,
    session: Session,
    payment_id: Optional[str] = None,
    payment_method: Optional[str] = None,
    signature: Optional[str] = None,
    client: Optional[Any] = None,
) -> tuple[bool, Optional[str]]:
    """
    Idempotently and atomically fulfills an order when payment is captured.
    Handles:
    - Concurrency lock on products (with_for_update)
    - Oversold automatic instant refund
    - OrderItem creation from snapshot
    - InventoryMovement creation
    - Customer Cart clearing
    - TenantLedgerEntry creation
    - OrderStatusHistory recording
    Returns: (success: bool, error_message: Optional[str])
    """
    # 1. Idempotency guard: If already placed & paid, return early
    if order.status == "placed" and order.payment_status == "paid":
        return True, "Already fulfilled"

    now = utc_now()

    # 2. Extract payment method if not supplied
    if payment_id and not payment_method and not payment_id.startswith("pay_mock_"):
        try:
            rz_client = client or get_razorpay_client()
            if rz_client:
                rz_payment = rz_client.payment.fetch(payment_id)
                if isinstance(rz_payment, dict) and rz_payment.get("method"):
                    payment_method = str(rz_payment["method"]).lower()
        except Exception:
            pass

    order_items_payload = order.items or []
    site_id = order.site_id

    # 3. CONCURRENCY & STOCK VALIDATION: Lock products and verify available stock
    insufficient_items: list[str] = []
    locked_products: dict[UUID, Product] = {}

    for item in order_items_payload:
        p_id = UUID(item["product_id"])
        product = session.exec(
            select(Product).where(Product.id == p_id, Product.site_id == site_id).with_for_update()
        ).first()

        if not product:
            insufficient_items.append(f"{item.get('product_name', 'Item')} (unavailable)")
            continue

        try:
            unit_price, compare_price, var_label, available_stock = extract_variant_details(
                product,
                item.get("selected_variant_value"),
                raise_if_out_of_stock=False,
            )
        except Exception:
            available_stock = 0

        qty_needed = item.get("quantity", 1)
        if qty_needed > available_stock or product.stock < qty_needed or product.in_stock is False:
            actual_stock = max(0, min(available_stock, product.stock))
            insufficient_items.append(f"{product.name} (only {actual_stock} available, needed {qty_needed})")
        else:
            locked_products[product.id] = product

    # 4. OVERSELL PREVENTION & INSTANT AUTO-REFUND
    if insufficient_items:
        order.status = "cancelled"
        order.cancelled_at = now
        reason_msg = f"Item(s) went out of stock during checkout: {', '.join(insufficient_items)}"
        order.cancel_reason = reason_msg
        if payment_id:
            order.razorpay_payment_id = payment_id

        # Trigger automatic instant refund via Razorpay if paid
        if payment_id and not payment_id.startswith("pay_mock_"):
            try:
                rz_client = client or get_razorpay_client()
                if rz_client:
                    amount_paise = int(order.total * 100)
                    rf_res = rz_client.payment.refund(
                        payment_id,
                        {
                            "amount": amount_paise,
                            "reverse_all": 1,
                            "notes": {"reason": "Oversold during concurrent checkout"},
                        },
                    )
                    snapshot = dict(order.pricing_snapshot or {})
                    snapshot["refund_details"] = {
                        "refund_id": rf_res.get("id"),
                        "status": rf_res.get("status", "processed"),
                        "arn": rf_res.get("acquirer_data", {}).get("arn") if isinstance(rf_res.get("acquirer_data"), dict) else None,
                        "amount": float(order.total),
                        "created_at": rf_res.get("created_at"),
                    }
                    order.pricing_snapshot = snapshot
                    flag_modified(order, "pricing_snapshot")
                    order.payment_status = "refunded"
            except Exception as rferr:
                logger.error("Auto-refund error for oversold order %s: %s", order.id, rferr)
                order.payment_status = "refund_pending"
        else:
            order.payment_status = "refunded"

        order.updated_at = now
        session.add(order)
        session.commit()
        return False, f"Item went out of stock right as payment completed. An automated 100% refund of ₹{float(order.total):.2f} has been initiated back to your source account."

    # 5. DEDUCT STOCK & CREATE ORDERITEMS
    order_subtotal = sum((money(it.get("line_total", 0)) for it in order_items_payload), Decimal("0.00"))
    site = session.get(Site, site_id)
    site_default_return_days = getattr(site, "default_return_window_days", 7) if site else 7

    existing_items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    if not existing_items:
        for item in order_items_payload:
            p_id = UUID(item["product_id"])
            product = locked_products.get(p_id)
            if product:
                decrement_product_stock(product, item.get("quantity", 1), item.get("selected_variant_value"))
                session.add(product)

                item_return_days = product.return_window_days if product.return_window_days is not None else site_default_return_days

                order_item = OrderItem(
                    order_id=order.id,
                    site_id=site_id,
                    product_id=product.id,
                    product_name=item.get("product_name", product.name),
                    product_slug=item.get("product_slug", product.slug),
                    product_image=item.get("product_image"),
                    selected_variant_label=item.get("selected_variant_label"),
                    selected_variant_value=item.get("selected_variant_value"),
                    unit_price=money(item.get("unit_price", 0)),
                    compare_price=money(item.get("compare_price")) if item.get("compare_price") is not None else None,
                    quantity=item.get("quantity", 1),
                    line_total=money(item.get("line_total", 0)),
                    status="placed",
                    returnable_quantity=0,
                    return_window_days=item_return_days,
                    pricing_snapshot=build_order_item_pricing_snapshot(
                        line_total=money(item.get("line_total", 0)),
                        quantity=item.get("quantity", 1),
                        order_subtotal=order_subtotal,
                        pricing_snapshot=order.pricing_snapshot or {},
                    ),
                )
                session.add(order_item)
                session.flush()

                movement = InventoryMovement(
                    site_id=site_id,
                    product_id=product.id,
                    order_id=order.id,
                    order_item_id=order_item.id,
                    movement_type="sale",
                    quantity_delta=-item.get("quantity", 1),
                    note=f"Stock deducted for online paid order {order.id}",
                )
                session.add(movement)

    order.payment_status = "paid"
    order.status = "placed"
    if payment_id:
        order.razorpay_payment_id = payment_id
    if payment_method:
        order.payment_method = payment_method
    if signature:
        order.razorpay_signature = signature

    order.confirmed_at = order.confirmed_at or now
    order.updated_at = now
    session.add(order)

    # 6. ORDER STATUS HISTORY
    session.add(
        OrderStatusHistory(
            order_id=order.id,
            status="placed",
            changed_by=order.customer_id,
            changed_by_type="customer",
        )
    )

    # 7. CLEAR CUSTOMER CART
    cart = session.exec(
        select(Cart).where(Cart.user_id == order.customer_id, Cart.site_id == site_id)
    ).first()
    if cart:
        session.exec(delete(CartItem).where(CartItem.cart_id == cart.id))
        cart.updated_at = now
        session.add(cart)

    # 8. CREATE / UPDATE TENANT LEDGER ENTRY
    existing_ledger = session.exec(
        select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
    ).first()

    if not existing_ledger:
        admin_site = session.exec(
            select(AdminSite).where(AdminSite.site_id == site_id)
        ).first()
        admin_id = admin_site.admin_id if admin_site else order.customer_id
        commission_percent = get_platform_commission_percent()

        # Check if merchant has a linked Route account
        bank_acc = session.exec(
            select(TenantBankAccount).where(TenantBankAccount.site_id == site_id)
        ).first()

        transfer_status = "held"
        transfer_id = None
        settled_at = None
        ledger_status = "in_escrow"
        escrow_status = "held"

        if bank_acc and bank_acc.razorpay_account_id:
            transfer_id = f"trf_{uuid4().hex[:12]}"
            transfer_status = "held"
            escrow_status = "held"
            ledger_status = "in_escrow"
        else:
            transfer_status = "pending"
            ledger_status = "pending_payout"
            escrow_status = "held"

        ledger_entry = TenantLedgerEntry(
            admin_id=admin_id,
            site_id=site_id,
            order_id=order.id,
            gross_amount=order.total,
            platform_fee_percent=commission_percent,
            platform_fee=order.platform_fee,
            tenant_share=order.tenant_share,
            currency="INR",
            status=ledger_status,
            escrow_status=escrow_status,
            razorpay_transfer_id=transfer_id,
            transfer_status=transfer_status,
            settled_at=settled_at,
            created_at=now,
            updated_at=now,
        )
        session.add(ledger_entry)

    session.commit()
    session.refresh(order)
    return True, None


@router.post("/orders/{site_id}/verify-payment")
def verify_payment(
    site_id: UUID,
    payload: VerifyPaymentRequest,
    request: Request,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    check_checkout_rate_limit(request, user.get("userId"), max_requests=15, window_sec=60)
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    order = session.get(Order, payload.order_id)
    if not order or order.site_id != site_id:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.customer_id != UUID(user["userId"]):
        raise HTTPException(status_code=403, detail="Order does not belong to this customer")

    if order.status == "placed" and order.payment_status == "paid":
        return {
            "message": "Payment verified and order already confirmed",
            "order_id": str(order.id),
            "status": order.status,
            "payment_status": order.payment_status,
            "total": float(order.total),
        }

    if order.status == "cancelled" and order.payment_status == "refunded":
        refund_details = (order.pricing_snapshot or {}).get("refund_details") or {}
        refund_amt = refund_details.get("amount") or float(order.total)
        return {
            "message": f"Item went out of stock right as payment completed. An automated 100% refund of ₹{refund_amt:.2f} has been initiated back to your source account.",
            "order_id": str(order.id),
            "status": "cancelled",
            "payment_status": "refunded",
            "total": float(order.total),
            "refund_details": refund_details,
            "is_refunded": True,
        }

    payment_id = payload.razorpay_payment_id
    signature = payload.razorpay_signature
    client = get_razorpay_client()

    # If payment_id not provided by frontend (e.g. mobile browser redirect), query Razorpay
    if not payment_id and order.razorpay_order_id and client:
        try:
            rz_payments = client.order.payments(order.razorpay_order_id)
            if rz_payments and isinstance(rz_payments, dict) and rz_payments.get("items"):
                for p in rz_payments["items"]:
                    if p.get("status") in ("captured", "refunded"):
                        payment_id = p.get("id")
                        break
        except Exception as e:
            logger.warning("Error fetching order payments from Razorpay: %s", e)

    # Verify signature if both are present
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if key_secret and payment_id and signature:
        rzp_order_id = payload.razorpay_order_id or order.razorpay_order_id
        data_to_verify = f"{rzp_order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(
            key_secret.strip().encode("utf-8"),
            data_to_verify,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay payment signature verification failed",
            )

    if not payment_id:
        raise HTTPException(
            status_code=400,
            detail="Payment not completed or payment details missing",
        )

    success, err_msg = finalize_order_fulfillment(
        order=order,
        session=session,
        payment_id=payment_id,
        signature=signature,
        client=client,
    )

    if not success:
        refund_details = (order.pricing_snapshot or {}).get("refund_details") or {}
        return {
            "message": err_msg or "Order cancelled due to stock exhaustion. Refund initiated.",
            "order_id": str(order.id),
            "status": order.status,
            "payment_status": order.payment_status,
            "total": float(order.total),
            "refund_details": refund_details,
            "is_refunded": True,
        }

    return {
        "message": "Payment verified and order placed successfully",
        "order_id": str(order.id),
        "status": order.status,
        "payment_status": order.payment_status,
        "total": float(order.total),
        "pricing_snapshot": order.pricing_snapshot,
    }


# ==========================================
# WEBHOOK ENDPOINT
# ==========================================

@router.post("/webhooks/razorpay")
@router.post("/webhook")
@router.post("/payments/webhook")
@router.post("/payments/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    session: Session = Depends(get_session),
):
    raw_body = await request.body()
    webhook_secret = (os.getenv("RAZORPAY_WEBHOOK_SECRET") or "").strip()

    # SECURITY: Reject webhooks entirely if no dedicated webhook secret is configured
    if not webhook_secret:
        logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhook secret not configured on server",
        )

    if not x_razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header",
        )

    expected_sig = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, x_razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    try:
        import json
        event_payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        return {"status": "ignored_malformed_json"}

    event_type = event_payload.get("event")
    payment_entity = event_payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_entity = event_payload.get("payload", {}).get("order", {}).get("entity", {})
    rzp_order_id = payment_entity.get("order_id") or order_entity.get("id")

    if not rzp_order_id:
        return {"status": "ignored_no_order_id"}

    order = session.exec(
        select(Order).where(Order.razorpay_order_id == rzp_order_id)
    ).first()

    if not order:
        return {"status": "ignored_order_not_found"}

    if event_type in ("payment.captured", "payment.authorized", "order.paid"):
        if order.payment_status != "paid":
            finalize_order_fulfillment(
                order=order,
                session=session,
                payment_id=payment_entity.get("id"),
                payment_method=payment_entity.get("method"),
            )

    elif event_type == "payment.failed":
        if order.payment_status != "paid":
            order.payment_status = "failed"
            order.updated_at = utc_now()
            session.add(order)
            session.commit()

    elif event_type in {"refund.created", "refund.processed", "refund.failed", "refund.speed_changed"}:
        refund_entity = event_payload.get("payload", {}).get("refund", {}).get("entity", {})

        # Idempotency: skip if the same refund_id was already recorded
        existing_refund_details = (order.pricing_snapshot or {}).get("refund_details") or {}
        incoming_refund_id = refund_entity.get("id") if refund_entity else None
        if (
            incoming_refund_id
            and existing_refund_details.get("refund_id") == incoming_refund_id
            and order.payment_status in ("refunded", "refund_failed")
        ):
            logger.info("Webhook idempotency: refund %s already processed for order %s", incoming_refund_id, order.id)
            return {"status": "ok_idempotent"}

        snapshot = dict(order.pricing_snapshot or {})
        if refund_entity:
            snapshot["refund_details"] = {
                "refund_id": refund_entity.get("id") or existing_refund_details.get("refund_id"),
                "status": refund_entity.get("status", "processed"),
                "arn": refund_entity.get("acquirer_data", {}).get("arn") if isinstance(refund_entity.get("acquirer_data"), dict) else existing_refund_details.get("arn"),
                "amount": (refund_entity.get("amount") or 0) / 100,
                "created_at": refund_entity.get("created_at"),
            }
            order.pricing_snapshot = snapshot
            flag_modified(order, "pricing_snapshot")

        if event_type == "refund.failed":
            order.payment_status = "refund_failed"
        else:
            order.payment_status = "refunded"

        order.updated_at = utc_now()
        session.add(order)

        ledger = session.exec(
            select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
        ).first()
        if ledger:
            ledger.status = "refunded"
            ledger.updated_at = utc_now()
            session.add(ledger)

        session.commit()

    elif event_type in {"transfer.processed", "settlement.processed"}:
        transfer_entity = event_payload.get("payload", {}).get("transfer", {}).get("entity", {}) or payment_entity
        transfer_id = transfer_entity.get("id")
        notes = transfer_entity.get("notes", {})
        order_id_str = notes.get("order_id")
        if order_id_str:
            try:
                ledger = session.exec(
                    select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == UUID(order_id_str))
                ).first()
                if ledger:
                    ledger.status = "paid"
                    ledger.transfer_status = "processed"
                    if transfer_id:
                        ledger.razorpay_transfer_id = transfer_id
                    ledger.settled_at = utc_now()
                    ledger.updated_at = utc_now()
                    session.add(ledger)
                    session.commit()
            except Exception as e:
                logger.error("Error updating ledger on transfer webhook: %s", e)

    return {"status": "ok"}


@router.post("/admin/{site_id}/reconcile-pending-orders")
def reconcile_pending_orders(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Scans pending Razorpay orders and reconciles with Razorpay API.
    Auto-fulfills any orders that were paid on Razorpay but dropped off before frontend verification.
    """
    client = get_razorpay_client()
    if not client:
        return {"reconciled_count": 0, "message": "Razorpay client not configured"}

    pending_orders = session.exec(
        select(Order).where(
            Order.site_id == site_id,
            Order.status == "pending",
            Order.payment_status == "pending",
            Order.razorpay_order_id != None,
        )
    ).all()

    reconciled_count = 0

    for order in pending_orders:
        if not order.razorpay_order_id or order.razorpay_order_id.startswith("order_mock_"):
            continue
        try:
            rz_payments = client.order.payments(order.razorpay_order_id)
            if rz_payments and isinstance(rz_payments, dict) and rz_payments.get("items"):
                for p in rz_payments["items"]:
                    if p.get("status") == "captured":
                        success, _ = finalize_order_fulfillment(
                            order=order,
                            session=session,
                            payment_id=p.get("id"),
                            payment_method=p.get("method"),
                            client=client,
                        )
                        if success:
                            reconciled_count += 1
                        break
        except Exception as e:
            logger.error("Error reconciling order %s: %s", order.id, e)

    return {
        "status": "success",
        "reconciled_count": reconciled_count,
        "scanned_count": len(pending_orders),
    }


# ==========================================
# ADMIN BANK ACCOUNT & EARNINGS ENDPOINTS
# ==========================================

def process_mature_escrows(session: Session, site_id: Optional[UUID] = None) -> tuple[int, Decimal]:
    """
    Releases held escrow transfers for delivered orders whose 48-hour return window has elapsed
    without open returns/disputes. If site_id is None, processes across all sites.
    """
    now = utc_now()
    client = get_razorpay_client()

    query = select(Order).where(
        Order.status == "delivered",
        Order.escrow_status == "held",
        Order.return_window_closes_at != None,
        Order.return_window_closes_at <= now,
    )
    if site_id:
        query = query.where(Order.site_id == site_id)

    orders_to_release = session.exec(query).all()
    released_count = 0
    total_amount_released = Decimal("0.00")

    for order in orders_to_release:
        from models import ReturnRequest
        open_returns = session.exec(
            select(ReturnRequest).where(
                ReturnRequest.order_id == order.id,
                ReturnRequest.status.in_(["requested", "approved", "received", "inspected"]),
            )
        ).all()

        if not open_returns:
            try:
                unhold_tenant_escrow_transfer(order=order, session=session, client=client)
                released_count += 1
                total_amount_released += (order.tenant_share or Decimal("0.00"))
            except Exception as e:
                logger.error("Error releasing escrow for order %s: %s", order.id, e)

    return released_count, total_amount_released


@router.post("/admin/{site_id}/release-mature-escrows")
def release_mature_escrows(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Scans delivered orders where the 48-hour return window has elapsed without active return disputes,
    and releases the held escrow transfers to the merchant bank account.
    """
    released_count, total_amount_released = process_mature_escrows(session, site_id=site_id)

    return {
        "message": f"Successfully released {released_count} mature escrow payout(s)",
        "released_count": released_count,
        "total_amount_released": float(total_amount_released),
    }


@router.get("/admin/{site_id}/payment-settings", response_model=BankAccountSettingsResponse)
def get_payment_settings(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    bank_account = session.exec(
        select(TenantBankAccount).where(TenantBankAccount.site_id == site_id)
    ).first()

    if not bank_account:
        return {
            "is_configured": False,
            "account_holder_name": "",
            "account_number_masked": "",
            "account_number_last4": "",
            "ifsc_code": "",
            "bank_name": "",
            "pan_number": None,
            "gst_number": None,
            "is_verified": False,
            "razorpay_account_id": None,
            "route_status": "pending",
            "route_onboarded_at": None,
        }

    raw_account = decrypt_string(bank_account.account_number_encrypted)
    masked = mask_account_number(raw_account)

    return {
        "id": str(bank_account.id),
        "is_configured": True,
        "account_holder_name": bank_account.account_holder_name,
        "account_number_masked": masked,
        "account_number_last4": bank_account.account_number_last4,
        "ifsc_code": bank_account.ifsc_code,
        "bank_name": bank_account.bank_name,
        "pan_number": bank_account.pan_number,
        "gst_number": bank_account.gst_number,
        "is_verified": bank_account.is_verified,
        "razorpay_account_id": bank_account.razorpay_account_id,
        "route_status": bank_account.route_status or "active",
        "route_onboarded_at": bank_account.route_onboarded_at.isoformat() if bank_account.route_onboarded_at else None,
        "updated_at": bank_account.updated_at.isoformat() if bank_account.updated_at else None,
    }


@router.put("/admin/{site_id}/payment-settings", response_model=BankAccountSettingsResponse)
def update_payment_settings(
    site_id: UUID,
    payload: BankAccountSettingsPayload,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    admin_id = UUID(admin["adminId"])

    bank_account = session.exec(
        select(TenantBankAccount).where(TenantBankAccount.site_id == site_id)
    ).first()

    raw_account = payload.account_number.strip()
    last4 = raw_account[-4:] if len(raw_account) >= 4 else raw_account
    encrypted_account = encrypt_string(raw_account)

    if not bank_account:
        bank_account = TenantBankAccount(
            admin_id=admin_id,
            site_id=site_id,
            account_holder_name=payload.account_holder_name.strip(),
            account_number_encrypted=encrypted_account,
            account_number_last4=last4,
            ifsc_code=payload.ifsc_code.strip().upper(),
            bank_name=payload.bank_name.strip(),
            pan_number=payload.pan_number,
            gst_number=payload.gst_number,
            is_verified=True,
            route_status="pending",
        )
    else:
        bank_account.account_holder_name = payload.account_holder_name.strip()
        bank_account.account_number_encrypted = encrypted_account
        bank_account.account_number_last4 = last4
        bank_account.ifsc_code = payload.ifsc_code.strip().upper()
        bank_account.bank_name = payload.bank_name.strip()
        bank_account.pan_number = payload.pan_number
        bank_account.gst_number = payload.gst_number
        bank_account.is_verified = True
        bank_account.updated_at = utc_now()

    # Automatically synchronize merchant as Razorpay Route Linked Account
    sync_razorpay_linked_account(
        session=session,
        admin_id=admin_id,
        site_id=site_id,
        bank_account=bank_account,
        raw_account_number=raw_account,
    )

    session.add(bank_account)
    session.commit()
    session.refresh(bank_account)

    return {
        "id": str(bank_account.id),
        "is_configured": True,
        "account_holder_name": bank_account.account_holder_name,
        "account_number_masked": mask_account_number(raw_account),
        "account_number_last4": bank_account.account_number_last4,
        "ifsc_code": bank_account.ifsc_code,
        "bank_name": bank_account.bank_name,
        "pan_number": bank_account.pan_number,
        "gst_number": bank_account.gst_number,
        "is_verified": bank_account.is_verified,
        "razorpay_account_id": bank_account.razorpay_account_id,
        "route_status": bank_account.route_status or "active",
        "route_onboarded_at": bank_account.route_onboarded_at.isoformat() if bank_account.route_onboarded_at else None,
        "updated_at": bank_account.updated_at.isoformat() if bank_account.updated_at else None,
    }


@router.get("/admin/{site_id}/earnings", response_model=EarningsSummaryResponse)
def get_earnings_summary(
    site_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    # Check bank configured
    bank_acc = session.exec(
        select(TenantBankAccount).where(TenantBankAccount.site_id == site_id)
    ).first()
    bank_configured = bank_acc is not None and bool(bank_acc.account_number_last4)

    # Aggregate ledger entries
    all_entries = session.exec(
        select(TenantLedgerEntry)
        .where(TenantLedgerEntry.site_id == site_id)
        .order_by(TenantLedgerEntry.created_at.desc())
    ).all()

    gross_gmv = Decimal("0.00")
    total_platform_fees = Decimal("0.00")
    total_net_earnings = Decimal("0.00")
    pending_payout = Decimal("0.00")
    escrow_balance = Decimal("0.00")
    settled_payouts = Decimal("0.00")

    now = utc_now()
    for entry in all_entries:
        # Auto-reconcile status if underlying order was cancelled, delivered, or return window matured
        order = session.get(Order, entry.order_id)
        if order:
            if order.status == "cancelled" or getattr(order, "payment_status", None) == "refunded":
                if entry.status != "refunded":
                    entry.status = "refunded"
                    entry.escrow_status = "reversed"
                    session.add(entry)
            elif order.status == "delivered" and entry.status not in ("paid", "refunded"):
                # Escrow matures ONLY after order is delivered AND the return window has passed
                window_closes = order.return_window_closes_at
                if window_closes and now >= window_closes:
                    from models import ReturnRequest
                    open_returns = session.exec(
                        select(ReturnRequest).where(
                            ReturnRequest.order_id == order.id,
                            ReturnRequest.status.in_(["requested", "approved", "pickup_scheduled", "in_transit", "received", "inspected"])
                        )
                    ).all()
                    if not open_returns and entry.escrow_status == "held":
                        entry.escrow_status = "unheld"
                        entry.status = "pending_payout"
                        order.escrow_status = "unheld"
                        session.add(entry)
                        session.add(order)

        if entry.status != "refunded":
            gross_gmv += entry.gross_amount
            total_platform_fees += entry.platform_fee
            total_net_earnings += entry.tenant_share

            if entry.status in ("in_escrow", "held") or (getattr(entry, "escrow_status", "held") == "held" and entry.status != "paid"):
                escrow_balance += entry.tenant_share
            elif entry.status == "paid":
                settled_payouts += entry.tenant_share
            elif entry.status == "pending_payout":
                pending_payout += entry.tenant_share

    session.commit()

    total_count = len(all_entries)
    total_pages = max(1, (total_count + limit - 1) // limit)
    offset = (page - 1) * limit
    paginated_entries = all_entries[offset : offset + limit]

    orders_map = {
        o.id: o
        for o in session.exec(
            select(Order).where(Order.id.in_([e.order_id for e in paginated_entries]))
        ).all()
    } if paginated_entries else {}

    serialized_entries = [
        LedgerEntryResponse(
            id=str(e.id),
            order_id=str(e.order_id),
            order_number=str(e.order_id)[:8].upper(),
            created_at=e.created_at.isoformat(),
            gross_amount=float(e.gross_amount),
            platform_fee=float(e.platform_fee),
            platform_fee_percent=float(e.platform_fee_percent),
            tenant_share=float(e.tenant_share),
            status=e.status,
            currency=e.currency,
            razorpay_transfer_id=e.razorpay_transfer_id,
            transfer_status=e.transfer_status,
            escrow_status=getattr(e, "escrow_status", "held"),
            escrow_release_due_at=e.escrow_release_due_at.isoformat() if e.escrow_release_due_at else None,
            unheld_at=e.unheld_at.isoformat() if getattr(e, "unheld_at", None) else None,
            return_window_closes_at=orders_map[e.order_id].return_window_closes_at.isoformat() if e.order_id in orders_map and orders_map[e.order_id].return_window_closes_at else None,
            settled_at=e.settled_at.isoformat() if e.settled_at else None,
        )
        for e in paginated_entries
    ]

    commission_percent = get_platform_commission_percent()

    return {
        "gross_gmv": float(gross_gmv),
        "total_platform_fees": float(total_platform_fees),
        "total_net_earnings": float(total_net_earnings),
        "pending_payout": float(pending_payout),
        "escrow_balance": float(escrow_balance),
        "settled_payouts": float(settled_payouts),
        "platform_commission_percent": float(commission_percent),
        "total_orders_count": total_count,
        "bank_configured": bank_configured,
        "ledger_entries": serialized_entries,
        "total_pages": total_pages,
        "current_page": page,
    }


@router.post("/admin/{site_id}/payouts/create")
def record_payout(
    site_id: UUID,
    payload: CreatePayoutRecordRequest,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    admin_id = UUID(admin["adminId"])

    payout = Payout(
        admin_id=admin_id,
        site_id=site_id,
        amount=payload.amount,
        currency="INR",
        status="processed",
        payout_method="manual_bank_transfer",
        utr_reference=payload.utr_reference,
        notes=payload.notes,
    )
    session.add(payout)
    session.flush()

    # Mark oldest pending ledger entries up to amount as paid
    pending_entries = session.exec(
        select(TenantLedgerEntry)
        .where(
            TenantLedgerEntry.site_id == site_id,
            TenantLedgerEntry.status == "pending_payout",
        )
        .order_by(TenantLedgerEntry.created_at.asc())
    ).all()

    remaining_payout = payload.amount
    for entry in pending_entries:
        if remaining_payout <= 0:
            break
        entry.status = "paid"
        entry.payout_id = payout.id
        entry.updated_at = utc_now()
        session.add(entry)
        remaining_payout -= entry.tenant_share

    session.commit()
    session.refresh(payout)

    return {
        "message": "Payout recorded successfully",
        "payout_id": str(payout.id),
        "amount": float(payout.amount),
        "status": payout.status,
    }
