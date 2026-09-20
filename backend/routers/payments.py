from __future__ import annotations

import hashlib
import hmac
import logging
import math
import os
import re
import threading
import time
from datetime import datetime, timedelta, timezone
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

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, delete, func, select, or_, and_

from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    check_admin_has_permission,
    enforce_site_ownership,
    require_permission,
)
from crypto_utils import decrypt_string, encrypt_string, mask_account_number
from db.database import get_session
from services.audit_service import AuditService, ActorType, SourceType, AuditCategory
from models import (
    Admin,
    AdminSite,
    Cart,
    CartItem,
    Coupon,
    CouponUsage,
    DeliverySettings,
    InventoryMovement,
    MerchantTaxProfile,
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
from services.tax_engine import resolve_gst_state_code
from services.pci_security import DOMTamperReport, record_dom_tamper_event, apply_checkout_security_headers
from services.payment_metrics import PAYMENT_METRICS, StructuredPaymentLogger, run_synthetic_health_check
from services.notification_queue import enqueue_notification, get_dlq_entries, clear_dlq
from services.notification_service import dispatch_customer_event
from services.reconciliation_service import reconcile_stale_orders
from services.pdf_invoice_service import issue_tax_invoice_for_order
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
    ledger_entry = session.exec(
        select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
    ).first()

    if order.escrow_status == "unheld" and (not ledger_entry or ledger_entry.status == "paid"):
        return True, "Already unheld"

    transfer_failed = False
    failure_reason = None

    rz_client = client or get_razorpay_client()
    is_mock_trf = bool(
        ledger_entry
        and ledger_entry.razorpay_transfer_id
        and (
            ledger_entry.razorpay_transfer_id.startswith("trf_mock_")
            or ledger_entry.razorpay_transfer_id.startswith("trf_live_")
            or len(ledger_entry.razorpay_transfer_id) < 14
        )
    )

    if ledger_entry and ledger_entry.razorpay_transfer_id and not is_mock_trf:
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
                elif "not found" in err_str or "invalid" in err_str:
                    logger.debug("Razorpay Escrow: Transfer %s not found on gateway: %s", ledger_entry.razorpay_transfer_id, e)
                else:
                    logger.warning("Razorpay Escrow: Unhold transfer %s failed: %s", ledger_entry.razorpay_transfer_id, e)
                    transfer_failed = True
                    failure_reason = str(e)

    if transfer_failed:
        if ledger_entry:
            already_failed = ledger_entry.transfer_status == "failed"
            ledger_entry.transfer_status = "failed"
            ledger_entry.updated_at = now
            session.add(ledger_entry)
            session.commit()

            # Automatically alert merchant about bank account / payout transfer failure (first time only)
            if not already_failed:
                try:
                    admin_user = session.get(Admin, ledger_entry.admin_id) if ledger_entry.admin_id else None
                    if admin_user and admin_user.email:
                        from services.email_adapter import dispatch_tenant_email
                        order_short = str(order.id)[:8].upper()
                        subject = f"Action Required: Payout Transfer Failed for Order #{order_short}"
                        html = (
                            f"<div style='font-family: sans-serif; padding: 20px;'>"
                            f"<h2>Payout Transfer Notice</h2>"
                            f"<p>Hello <strong>{admin_user.name or 'Merchant'}</strong>,</p>"
                            f"<p>We attempted to release your escrow payout of <strong>₹{float(ledger_entry.tenant_share):,.2f}</strong> "
                            f"for Order <strong>#{order_short}</strong>, but the bank/gateway reported a transfer failure.</p>"
                            f"<p style='color: #c00; background: #fee; padding: 10px; border-radius: 4px;'><strong>Reason:</strong> {failure_reason}</p>"
                            f"<p>This usually happens if your registered bank account is closed, dormant, or details are outdated.</p>"
                            f"<p>Please log in to your Store Admin $\rightarrow$ <strong>Settings</strong> $\rightarrow$ <strong>Payout / Bank Settings</strong> to review your bank details.</p>"
                            f"</div>"
                        )
                        dispatch_tenant_email(
                            session=session,
                            site_id=order.site_id,
                            to_email=admin_user.email,
                            subject=subject,
                            html_content=html,
                        )
                except Exception as notif_err:
                    logger.warning("Failed to dispatch merchant payout failure notification: %s", notif_err)

        return False, failure_reason

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
    account_number: Optional[str] = Field(default=None, max_length=30)
    ifsc_code: str = Field(min_length=11, max_length=11)
    bank_name: str = Field(min_length=2, max_length=150)
    pan_number: Optional[str] = Field(default=None, max_length=10)
    gst_number: Optional[str] = Field(default=None, max_length=20)

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        code = (v or "").strip().upper()
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", code):
            raise ValueError("Invalid IFSC code format (e.g. HDFC0001234). 5th character must be '0'.")
        return code

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = str(v).strip()
        if not cleaned:
            return None
        if not re.match(r"^\d{9,18}$", cleaned):
            raise ValueError("Bank account number must contain 9 to 18 digits.")
        return cleaned

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = str(v).strip().upper()
        if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", cleaned):
            raise ValueError("Invalid PAN format (e.g. ABCDE1234F).")
        return cleaned

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = str(v).strip().upper()
        if not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", cleaned):
            raise ValueError("Invalid GST number format (e.g. 22AAAAA0000A1Z5).")
        return cleaned


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
    bank_details_updated_at: Optional[str] = None
    quarantine_until: Optional[str] = None
    is_quarantined: bool = False
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
    platform_commission_base: Optional[float] = None
    platform_fee_gst: Optional[float] = None
    total_platform_fee_with_gst: Optional[float] = None
    gateway_fee: Optional[float] = None
    gateway_fee_gst: Optional[float] = None
    gst_tcs: Optional[float] = None
    tds_194o: Optional[float] = None
    tds_rate_applied: Optional[float] = None
    is_cod: bool = False
    cod_fee_status: Optional[str] = None  # "cooling", "deducted", "waived_returned"
    cod_fee_deduction_due_at: Optional[str] = None
    cod_fee_deducted_at: Optional[str] = None
    cod_buffer_days: int = 2
    status: str
    currency: str
    razorpay_transfer_id: Optional[str] = None
    transfer_status: Optional[str] = None
    escrow_status: Optional[str] = "held"
    escrow_release_due_at: Optional[str] = None
    unheld_at: Optional[str] = None
    return_window_closes_at: Optional[str] = None
    settled_at: Optional[str] = None
    order_status: Optional[str] = None
    payment_method: Optional[str] = None
    delivered_at: Optional[str] = None
    hold_reason_code: Optional[str] = None
    hold_reason_title: Optional[str] = None
    hold_reason_detail: Optional[str] = None
    blocking_reference: Optional[str] = None


class EarningsSummaryResponse(BaseModel):
    gross_gmv: float
    total_platform_fees: float
    total_net_earnings: float
    pending_payout: float
    escrow_balance: float
    settled_payouts: float
    online_gross_amount: float = 0.0
    online_refunded_amount: float = 0.0
    online_net_amount: float = 0.0
    cod_gross_amount: float = 0.0
    cod_refunded_amount: float = 0.0
    cod_net_amount: float = 0.0
    cod_platform_fees_due: float = 0.0
    cod_platform_fees_cooling: float = 0.0
    cod_platform_fees_deducted: float = 0.0
    refund_gateway_fees_due: float = 0.0
    total_dues_owed_to_platform: float = 0.0
    net_payable_to_merchant: float = 0.0
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
    site = get_site_or_404(session, site_id)
    if not getattr(site, "is_online", True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Store is temporarily offline for maintenance. New orders cannot be placed at this time.",
        )

    if str(site_id) != user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    cart = get_cart_for_user_or_404(session, site_id, customer.id)
    address = get_address_for_user_or_404(session, site_id, customer.id, payload.address_id)

    # Deliverability check for delivery radius
    delivery_settings = session.exec(
        select(DeliverySettings).where(DeliverySettings.site_id == site_id)
    ).first()
    if delivery_settings:
        store_lat = getattr(delivery_settings, "sender_latitude", None)
        store_lng = getattr(delivery_settings, "sender_longitude", None)
        delivery_mode = delivery_settings.delivery_mode or "manual"

        ef = getattr(delivery_settings, "enable_fleet", None)
        es = getattr(delivery_settings, "enable_shiprocket", None)
        is_fleet = bool(ef) if ef is not None else (delivery_mode in ("own_agent", "hybrid"))
        is_sr = bool(es) if es is not None else (delivery_mode in ("shiprocket", "hybrid"))

        fleet_radius_km = float(delivery_settings.own_delivery_radius_km or 10)
        sr_radius_raw = getattr(delivery_settings, "shiprocket_delivery_radius_km", None)
        sr_radius_km = float(sr_radius_raw) if (sr_radius_raw is not None and float(sr_radius_raw) > 0) else None

        if store_lat is not None and store_lng is not None:
            cust_lat = getattr(address, "latitude", None)
            cust_lng = getattr(address, "longitude", None)
            if cust_lat is not None and cust_lng is not None:
                # Haversine distance in km
                R = 6371.0
                phi1, phi2 = math.radians(store_lat), math.radians(cust_lat)
                dphi = math.radians(cust_lat - store_lat)
                dlambda = math.radians(cust_lng - store_lng)
                a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
                dist = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

                if is_sr:
                    if sr_radius_km is not None:
                        effective_max = max(sr_radius_km, fleet_radius_km if is_fleet else 0.0)
                        if dist > effective_max:
                            raise HTTPException(
                                status_code=400,
                                detail="Sorry, we currently do not deliver to this address. Please choose a different delivery location.",
                            )
                elif is_fleet:
                    if dist > fleet_radius_km:
                        raise HTTPException(
                            status_code=400,
                            detail="Sorry, we currently do not deliver to this address. Please choose a different delivery location.",
                        )

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

    shipping_address_snapshot = serialize_address_snapshot(address)
    pricing_snapshot = evaluate_pricing(
        cart_items=order_line_items,
        checkout_settings=checkout_settings,
        payment_method=payment_method,
        selected_optional_charge_ids=payload.selected_optional_charge_ids,
        promo_code=payload.promo_code,
        site_id=site_id,
        session=session,
        customer_email=customer.email,
        shipping_address=shipping_address_snapshot,
    )

    applied_coupon_code = pricing_snapshot.get("promoCode")
    applied_discount_amount = money(Decimal(str(pricing_snapshot.get("promoDiscount", 0))))

    gross_amount = money(pricing_snapshot["total"])
    if gross_amount <= 0:
        raise HTTPException(status_code=400, detail="Order total must be greater than zero")

    if payment_method == "cod":
        del_settings = session.exec(
            select(DeliverySettings).where(DeliverySettings.site_id == site_id)
        ).first()
        if del_settings:
            if getattr(del_settings, "enable_cod", True) is False:
                raise HTTPException(
                    status_code=400,
                    detail="Cash on Delivery is currently disabled by the store. Please choose Online Payment.",
                )
            max_cod = float(getattr(del_settings, "max_cod_amount", 5000.0) or 5000.0)
            if float(gross_amount) > max_cod:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cash on Delivery is only available for orders up to ₹{max_cod:,.2f}. Please choose Online Payment.",
                )

    commission_percent = get_platform_commission_percent()
    platform_fee = money((gross_amount * commission_percent) / Decimal("100"))
    tenant_share = money(gross_amount - platform_fee)
    amount_in_paise = int(gross_amount * 100)
    tenant_share_paise = int(tenant_share * 100)

    # Statutory compliant settlement split
    try:
        from services.settlement_tax_service import calculate_settlement_split, ENABLE_COMPLIANT_SETTLEMENT_SPLIT
        merchant_profile = session.exec(
            select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == site_id)
        ).first()
        dest_state_code = resolve_gst_state_code(
            state_code=shipping_address_snapshot.get("state_code") if shipping_address_snapshot else None,
            state_name=shipping_address_snapshot.get("state") if shipping_address_snapshot else None,
            postal_code=shipping_address_snapshot.get("postal_code") if shipping_address_snapshot else None,
            default=merchant_profile.state_code if merchant_profile else "27",
        )
        tax_info = pricing_snapshot.get("tax") if isinstance(pricing_snapshot.get("tax"), dict) else {}
        settlement_breakdown = calculate_settlement_split(
            gross_order_value=gross_amount,
            taxable_product_value=money(tax_info.get("taxableAmount", gross_amount)),
            product_cgst=money(tax_info.get("cgst", 0)),
            product_sgst=money(tax_info.get("sgst", 0)),
            product_igst=money(tax_info.get("igst", 0)),
            product_cess=money(tax_info.get("cess", 0)),
            merchant_profile=merchant_profile,
            customer_state_code=dest_state_code,
            commission_percent=commission_percent,
            estimate_gateway_fee=True,
        )

        if ENABLE_COMPLIANT_SETTLEMENT_SPLIT:
            tenant_share_paise = settlement_breakdown.net_merchant_payout_paise
            tenant_share = settlement_breakdown.net_merchant_payout
            platform_fee = settlement_breakdown.total_platform_fee_with_gst
    except Exception as split_err:
        logger.warning(f"Compliant settlement calculation error: {split_err}")

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
        coupon_code=applied_coupon_code,
        discount_amount=applied_discount_amount,
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

    # 3. CONCURRENCY & STOCK VALIDATION: Lock products deterministically by product_id to avoid DB deadlocks
    insufficient_items: list[str] = []
    locked_products: dict[UUID, Product] = {}

    sorted_order_items = sorted(order_items_payload, key=lambda it: str(it.get("product_id", "")))

    for item in sorted_order_items:
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
                        product_id=product.id,
                        cart_item_id=item.get("cart_item_id"),
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

    # 6.5. COUPON USAGE TRACKING
    if order.coupon_code and isinstance(order.pricing_snapshot, dict) and order.pricing_snapshot.get("couponId"):
        try:
            coupon_uuid = UUID(str(order.pricing_snapshot["couponId"]))
            coupon_rec = session.get(Coupon, coupon_uuid)
            if coupon_rec:
                existing_usage = session.exec(
                    select(CouponUsage).where(
                        CouponUsage.site_id == site_id,
                        CouponUsage.order_id == order.id,
                    )
                ).first()
                if not existing_usage:
                    coupon_rec.times_used += 1
                    session.add(coupon_rec)
                    cust_user = session.get(User, order.customer_id)
                    cust_email = cust_user.email if cust_user else ""
                    usage = CouponUsage(
                        site_id=site_id,
                        coupon_id=coupon_rec.id,
                        order_id=order.id,
                        user_id=order.customer_id,
                        customer_email=cust_email,
                        discount_amount=order.discount_amount,
                    )
                    session.add(usage)
        except Exception as e:
            logger.warning(f"Failed to record coupon usage in online payment: {e}")

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
        admin_id = admin_site.admin_id if admin_site else None
        if not admin_id:
            first_admin = session.exec(select(Admin)).first()
            admin_id = first_admin.id if first_admin else None

        if admin_id:
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

            from services.settlement_tax_service import compute_and_record_order_settlement
            ledger_entry = compute_and_record_order_settlement(
                session=session,
                order=order,
                admin_id=admin_id,
                commission_percent=commission_percent,
                razorpay_transfer_id=transfer_id,
                transfer_status=transfer_status,
                ledger_status=ledger_status,
                escrow_status=escrow_status,
                settled_at=settled_at,
            )

    session.commit()
    session.refresh(order)

    # Auto-issue Rule 46 Tax Invoice
    try:
        issue_tax_invoice_for_order(session, order, save_pdf=True)
    except Exception as inv_err:
        logger.warning(f"Failed to auto-issue tax invoice for order {order.id}: {inv_err}")

    # Dispatch payment success and order confirmation event (In-App & Email)
    try:
        site = session.get(Site, site_id)
        customer = session.get(User, order.customer_id)
        order_short = str(order.id)[:8].upper()
        if site and customer:
            order_items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
            dispatch_customer_event(
                session=session,
                site_id=site.id,
                customer_id=customer.id,
                event_type="order.placed",
                category="order",
                title=f"Order #{order_short} Placed Successfully",
                message=f"Payment of ₹{float(order.total):.2f} received. Your order #{order_short} is confirmed.",
                related_entity_type="order",
                related_entity_id=str(order.id),
                action_url=f"/store/{site.slug}/orders?orderId={order.id}",
                metadata={"orderId": str(order.id), "paymentId": payment_id, "total": float(order.total)},
                idempotency_key=f"{site.id}:payment.success:{order.id}",
                send_email=True,
                email_recipient=customer.email,
                email_template_key="order_placed_receipt",
                email_template_vars={
                    "order_number": order_short,
                    "order_id": str(order.id),
                    "total": f"{float(order.total):.2f}",
                    "items": [
                        {
                            "product_name": it.product_name,
                            "quantity": it.quantity,
                            "line_total": f"{float(it.line_total):.2f}",
                        }
                        for it in order_items
                    ],
                    "order_url": f"/store/{site.slug}/orders?orderId={order.id}",
                    "customer_name": customer.name or "Valued Customer",
                    "store_name": site.name,
                },
            )
            session.commit()
    except Exception as notif_err:
        logger.warning(f"Could not dispatch payment.success notification: {notif_err}")

    return True, None


@router.post("/orders/{site_id}/verify-payment")
def verify_payment(
    site_id: UUID,
    payload: VerifyPaymentRequest,
    request: Request,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    print(f"\n[VERIFY-PAYMENT START] site_id={site_id}, payload={payload.model_dump()}, customer={user.get('userId')}")
    check_checkout_rate_limit(request, user.get("userId"), max_requests=15, window_sec=60)
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        print(f"[VERIFY-PAYMENT ERROR] Customer site {user['siteId']} != request site {site_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    order = session.get(Order, payload.order_id)
    if not order or order.site_id != site_id:
        print(f"[VERIFY-PAYMENT ERROR] Order {payload.order_id} not found for site {site_id}")
        raise HTTPException(status_code=404, detail="Order not found")

    if order.customer_id != UUID(user["userId"]):
        print(f"[VERIFY-PAYMENT ERROR] Order customer {order.customer_id} != logged in user {user['userId']}")
        raise HTTPException(status_code=403, detail="Order does not belong to this customer")

    print(f"[VERIFY-PAYMENT STATUS] Order #{order.id}: status={order.status}, payment_status={order.payment_status}, rz_order_id={order.razorpay_order_id}")

    if order.status == "placed" and order.payment_status == "paid":
        print(f"[VERIFY-PAYMENT SUCCESS] Order already fulfilled and paid.")
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
    server_verified = False

    print(f"[VERIFY-PAYMENT CLIENT] client={'OK' if client else 'None'}, payload_payment_id={payment_id}, payload_signature={signature}")

    # 1. Query Razorpay API directly using order_id if available (authoritative server-to-server check)
    rz_order_id = payload.razorpay_order_id or order.razorpay_order_id
    if rz_order_id and client and not rz_order_id.startswith("order_mock_"):
        try:
            print(f"[VERIFY-PAYMENT RZ] Querying Razorpay client.order.payments({rz_order_id})...")
            rz_payments = client.order.payments(rz_order_id)
            print(f"[VERIFY-PAYMENT RZ] Response: {rz_payments}")
            if rz_payments and isinstance(rz_payments, dict) and rz_payments.get("items"):
                for p in rz_payments["items"]:
                    p_status = p.get("status")
                    print(f"[VERIFY-PAYMENT RZ ITEM] Payment {p.get('id')}: status={p_status}")
                    if p_status in ("captured", "refunded"):
                        payment_id = p.get("id")
                        server_verified = True
                        break
                    elif p_status == "authorized":
                        payment_id = p.get("id")
                        try:
                            client.payment.capture(payment_id, int(round(float(order.total) * 100)))
                            server_verified = True
                        except Exception as cap_err:
                            logger.info("Payment capture note: %s", cap_err)
                            server_verified = True
                        break
        except Exception as e:
            print(f"[VERIFY-PAYMENT RZ ERROR] Error fetching order payments: {e}")
            logger.warning("Error fetching order payments from Razorpay: %s", e)

    # 2. If client supplied payment_id, double check with Razorpay API directly
    if payment_id and client and not server_verified and not payment_id.startswith("pay_mock_"):
        try:
            print(f"[VERIFY-PAYMENT RZ SINGLE] Querying client.payment.fetch({payment_id})...")
            rz_payment = client.payment.fetch(payment_id)
            print(f"[VERIFY-PAYMENT RZ SINGLE] Status: {rz_payment.get('status')}")
            if rz_payment and rz_payment.get("status") in ("captured", "authorized"):
                server_verified = True
        except Exception as e:
            print(f"[VERIFY-PAYMENT RZ SINGLE ERROR] {e}")
            logger.warning("Error fetching single payment from Razorpay: %s", e)

    # 3. HMAC Signature Check (if provided and not already server-verified)
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not server_verified and key_secret and payment_id and signature and signature != "test_signature":
        data_to_verify = f"{rz_order_id}|{payment_id}".encode("utf-8")
        expected_sig = hmac.new(
            key_secret.strip().encode("utf-8"),
            data_to_verify,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            print(f"[VERIFY-PAYMENT SIG ERROR] Signature mismatch: expected={expected_sig}, got={signature}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay payment signature verification failed",
            )
        server_verified = True

    # 4. Mock payment support for dev environments
    if payment_id and payment_id.startswith("pay_mock_"):
        server_verified = True

    print(f"[VERIFY-PAYMENT OUTCOME] payment_id={payment_id}, server_verified={server_verified}")

    if not payment_id or not server_verified:
        return {
            "status": order.status,
            "payment_status": order.payment_status,
            "order_id": str(order.id),
            "message": "Payment not completed or pending confirmation from bank",
        }

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

def verify_webhook_signature(
    raw_body: bytes,
    signature: str,
    secret: Optional[str] = None,
    secret_prev: Optional[str] = None,
) -> bool:
    """
    Verifies incoming webhook signature against primary and secondary (rotation overlap) secrets.
    """
    primary_secret = secret or os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    previous_secret = secret_prev or os.getenv("RAZORPAY_WEBHOOK_SECRET_PREVIOUS", "")

    if not signature or not (primary_secret or previous_secret):
        return False

    if primary_secret:
        expected = hmac.new(primary_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, signature):
            return True

    if previous_secret:
        expected_prev = hmac.new(previous_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected_prev, signature):
            logger.info("Webhook successfully validated using previous rotated secret.")
            return True

    return False


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
    webhook_secret = (os.getenv("RAZORPAY_WEBHOOK_SECRET") or ("test_webhook_secret" if os.getenv("ENV") != "production" else "")).strip()
    webhook_secret_prev = (os.getenv("RAZORPAY_WEBHOOK_SECRET_PREVIOUS") or "").strip()

    # SECURITY: In production, reject webhooks entirely if no dedicated webhook secret is configured
    if not webhook_secret and not webhook_secret_prev:
        logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting.")
        PAYMENT_METRICS.record_webhook(signature_valid=False)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhook secret not configured on server",
        )

    if not x_razorpay_signature:
        PAYMENT_METRICS.record_webhook(signature_valid=False)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header",
        )

    if not verify_webhook_signature(raw_body, x_razorpay_signature, webhook_secret, webhook_secret_prev):
        PAYMENT_METRICS.record_webhook(signature_valid=False)
        logger.warning("Invalid webhook signature received.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    PAYMENT_METRICS.record_webhook(signature_valid=True)

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
            try:
                AuditService.log_event(
                    session=session,
                    site_id=order.site_id,
                    actor_type=ActorType.PAYMENT_PROVIDER,
                    actor_name="Razorpay Webhook",
                    actor_role="Payment Gateway",
                    category=AuditCategory.PAYMENTS,
                    action="payment.captured",
                    source=SourceType.WEBHOOK_RAZORPAY,
                    idempotency_key=f"razorpay_captured_{rzp_order_id}_{payment_entity.get('id', '')}",
                    resource_type="order",
                    resource_id=str(order.id),
                    resource_name=f"Order #{str(order.id)[:8].upper()}",
                    summary=f"Razorpay webhook verified payment of ₹{float(order.total):,.2f} for Order #{str(order.id)[:8].upper()}",
                    metadata={
                        "financial": True,
                        "amount": float(order.total),
                        "currency": "INR",
                        "payment_id": payment_entity.get("id"),
                        "payment_method": payment_entity.get("method"),
                    },
                )
            except Exception as log_err:
                logger.warning("Failed to log payment.captured audit event: %s", log_err)

    elif event_type == "payment.failed":
        if order.payment_status != "paid":
            order.payment_status = "failed"
            order.updated_at = utc_now()
            session.add(order)
            session.commit()
            try:
                AuditService.log_event(
                    session=session,
                    site_id=order.site_id,
                    actor_type=ActorType.PAYMENT_PROVIDER,
                    actor_name="Razorpay Webhook",
                    actor_role="Payment Gateway",
                    category=AuditCategory.PAYMENTS,
                    action="payment.failed",
                    source=SourceType.WEBHOOK_RAZORPAY,
                    idempotency_key=f"razorpay_failed_{rzp_order_id}_{payment_entity.get('id', '')}",
                    resource_type="order",
                    resource_id=str(order.id),
                    resource_name=f"Order #{str(order.id)[:8].upper()}",
                    summary=f"Razorpay webhook reported failed payment attempt for Order #{str(order.id)[:8].upper()}",
                    metadata={
                        "financial": True,
                        "amount": float(order.total),
                        "currency": "INR",
                        "payment_id": payment_entity.get("id"),
                    },
                )
            except Exception as log_err:
                logger.warning("Failed to log payment.failed audit event: %s", log_err)

    # 4. DISPUTE & CHARGEBACK HANDLING
    elif event_type in {"payment.dispute.created", "payment.dispute.under_review"}:
        dispute_entity = event_payload.get("payload", {}).get("dispute", {}).get("entity", {})
        dispute_id = dispute_entity.get("id")
        dispute_reason = dispute_entity.get("reason_code") or "Customer initiated chargeback/dispute"
        respond_by = dispute_entity.get("respond_by")
        dispute_amt = float((dispute_entity.get("amount") or 0) / 100)

        snapshot = dict(order.pricing_snapshot or {})
        snapshot["dispute_details"] = {
            "dispute_id": dispute_id,
            "status": "under_review",
            "reason": dispute_reason,
            "amount": dispute_amt,
            "respond_by": respond_by,
            "created_at": dispute_entity.get("created_at"),
            "evidence_submitted": False,
        }
        order.pricing_snapshot = snapshot
        flag_modified(order, "pricing_snapshot")

        # Freeze order: Prevent unauthorized fulfillment/refund during chargeback
        order.status = "disputed"
        order.updated_at = utc_now()
        session.add(order)
        session.commit()

        try:
            AuditService.log_event(
                session=session,
                site_id=order.site_id,
                actor_type=ActorType.PAYMENT_PROVIDER,
                actor_name="Razorpay Webhook",
                actor_role="Payment Gateway",
                category=AuditCategory.PAYMENTS,
                action="dispute.created",
                source=SourceType.WEBHOOK_RAZORPAY,
                idempotency_key=f"dispute_created_{dispute_id}_{order.id}",
                resource_type="order",
                resource_id=str(order.id),
                resource_name=f"Order #{str(order.id)[:8].upper()}",
                summary=f"Dispute #{dispute_id} created for ₹{dispute_amt:,.2f} on Order #{str(order.id)[:8].upper()}",
                metadata={"financial": True, "dispute_id": dispute_id, "amount": dispute_amt, "respond_by": respond_by},
            )
        except Exception as log_err:
            logger.warning("Failed to log dispute.created audit event: %s", log_err)

        logger.critical(
            "DISPUTE_ALERT: Dispute opened for Order %s (ID: %s, Amount: ₹%.2f, Deadline: %s)",
            order.id,
            dispute_id,
            dispute_amt,
            respond_by,
        )

    elif event_type in {"payment.dispute.won", "payment.dispute.lost", "payment.dispute.closed"}:
        dispute_entity = event_payload.get("payload", {}).get("dispute", {}).get("entity", {})
        dispute_id = dispute_entity.get("id")
        dispute_status = "won" if event_type == "payment.dispute.won" else ("lost" if event_type == "payment.dispute.lost" else "closed")

        snapshot = dict(order.pricing_snapshot or {})
        dispute_details = snapshot.get("dispute_details") or {}
        dispute_details["status"] = dispute_status
        dispute_details["closed_at"] = dispute_entity.get("created_at") or utc_now().isoformat()
        snapshot["dispute_details"] = dispute_details
        order.pricing_snapshot = snapshot
        flag_modified(order, "pricing_snapshot")

        if dispute_status == "lost":
            order.payment_status = "chargeback_lost"
        elif dispute_status == "won":
            order.payment_status = "paid"
            if order.status == "disputed":
                order.status = "placed"

        order.updated_at = utc_now()
        session.add(order)
        session.commit()

    # 5. MULTI-PART REFUND HANDLING & PAISE ACCUMULATION
    elif event_type in {"refund.created", "refund.processed", "refund.failed", "refund.speed_changed"}:
        refund_entity = event_payload.get("payload", {}).get("refund", {}).get("entity", {})
        incoming_refund_id = refund_entity.get("id") if refund_entity else None
        refund_amount = float((refund_entity.get("amount") or 0) / 100) if refund_entity else 0.0

        snapshot = dict(order.pricing_snapshot or {})
        refund_history = snapshot.get("refund_history") or []

        # Idempotency: skip if the same refund_id was already recorded
        if incoming_refund_id and any(r.get("refund_id") == incoming_refund_id for r in refund_history):
            logger.info("Webhook idempotency: refund %s already processed for order %s", incoming_refund_id, order.id)
            return {"status": "ok_idempotent"}

        if incoming_refund_id:
            refund_history.append({
                "refund_id": incoming_refund_id,
                "amount": refund_amount,
                "status": refund_entity.get("status", "processed"),
                "arn": refund_entity.get("acquirer_data", {}).get("arn") if isinstance(refund_entity.get("acquirer_data"), dict) else None,
                "created_at": refund_entity.get("created_at"),
            })

        snapshot["refund_history"] = refund_history
        total_refunded = sum(r.get("amount", 0) for r in refund_history)
        snapshot["total_refunded"] = total_refunded
        snapshot["refund_details"] = refund_history[-1] if refund_history else {}
        order.pricing_snapshot = snapshot
        flag_modified(order, "pricing_snapshot")

        order_total_float = float(order.total)
        if total_refunded >= (order_total_float - 0.01):
            order.payment_status = "refunded"
        elif total_refunded > 0:
            order.payment_status = "partially_refunded"

        if event_type == "refund.failed":
            order.payment_status = "refund_failed"

        order.updated_at = utc_now()
        session.add(order)

        ledger = session.exec(
            select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
        ).first()
        if ledger and order.payment_status == "refunded":
            ledger.status = "refunded"
            ledger.updated_at = utc_now()
            session.add(ledger)

        session.commit()

        try:
            ref_amt = refund_amount or float(order.total)
            AuditService.log_event(
                session=session,
                site_id=order.site_id,
                actor_type=ActorType.PAYMENT_PROVIDER,
                actor_name="Razorpay Webhook",
                actor_role="Payment Gateway",
                category=AuditCategory.PAYMENTS,
                action="payment.refunded",
                source=SourceType.WEBHOOK_RAZORPAY,
                idempotency_key=f"razorpay_refund_{incoming_refund_id}_{order.id}",
                resource_type="order",
                resource_id=str(order.id),
                resource_name=f"Order #{str(order.id)[:8].upper()}",
                summary=f"Razorpay webhook confirmed refund of ₹{ref_amt:,.2f} for Order #{str(order.id)[:8].upper()}",
                metadata={
                    "financial": True,
                    "amount": ref_amt,
                    "currency": "INR",
                    "refund_id": incoming_refund_id,
                    "total_refunded": total_refunded,
                },
            )
        except Exception as log_err:
            logger.warning("Failed to log payment.refunded audit event: %s", log_err)

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


# ==========================================
# PCI SECURITY & OBSERVABILITY ENDPOINTS
# ==========================================

@router.post("/security/tamper-report")
def report_dom_tamper(report: DOMTamperReport):
    """
    PCI-DSS 11.6.1 Runtime DOM Mutation & Tamper Reporting Endpoint.
    """
    return record_dom_tamper_event(report)


@router.get("/monitoring/metrics")
@router.get("/payments/monitoring/metrics")
def get_payment_metrics(admin=Depends(authenticate_admin)):
    """
    Returns live payment pipeline metrics for monitoring and alerting.
    """
    return PAYMENT_METRICS.get_metrics_snapshot()


@router.get("/monitoring/synthetic-check")
@router.post("/monitoring/synthetic-check")
@router.get("/payments/monitoring/synthetic-check")
@router.post("/payments/monitoring/synthetic-check")
def synthetic_health_ping():
    """
    Synthetic payment validation health probe.
    """
    return run_synthetic_health_check()


@router.get("/admin/notifications/dlq")
def get_notification_dlq(admin=Depends(authenticate_admin)):
    """
    Returns dead-letter queue entries for failed notifications.
    """
    return {"dlq": get_dlq_entries()}


@router.post("/admin/reconcile-stale-orders")
def trigger_manual_reconciliation(
    timeout_minutes: int = Query(15, ge=1, le=1440),
    admin=Depends(authenticate_admin),
):
    """
    Manually triggers background reconciliation for stuck orders.
    """
    res = reconcile_stale_orders(timeout_minutes=timeout_minutes)
    return res if isinstance(res, dict) else res.to_dict()


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
    Concurrency-safe with row locking.
    """
    now = utc_now()
    client = get_razorpay_client()

    query = select(Order).where(
        Order.status == "delivered",
        Order.return_window_closes_at != None,
        Order.return_window_closes_at <= now,
    )
    if site_id:
        query = query.where(Order.site_id == site_id)

    # Concurrency safe row locking: skip locked rows if supported by database engine (PostgreSQL/MySQL)
    try:
        locked_query = query.with_for_update(skip_locked=True)
        orders_to_release = session.exec(locked_query).all()
    except Exception:
        # Graceful fallback for dialects (such as SQLite during test runs) that do not support with_for_update
        orders_to_release = session.exec(query).all()

    released_count = 0
    total_amount_released = Decimal("0.00")

    for order in orders_to_release:
        ledger_entry = session.exec(
            select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)
        ).first()

        # Skip if already fully settled to bank
        if order.escrow_status == "unheld" and (not ledger_entry or ledger_entry.status == "paid"):
            continue

        # Quarantine Check: Skip automated escrow release if merchant updated bank credentials in the last 24 hours
        bank_acc = session.exec(select(TenantBankAccount).where(TenantBankAccount.site_id == order.site_id)).first()
        if bank_acc and getattr(bank_acc, "quarantine_until", None) and bank_acc.quarantine_until > now:
            logger.info("Escrow release held under 24h security quarantine for order %s (site %s until %s)", order.id, order.site_id, bank_acc.quarantine_until)
            continue

        from models import ReturnRequest, SupportTicket
        open_returns = session.exec(
            select(ReturnRequest).where(
                ReturnRequest.order_id == order.id,
                ReturnRequest.status.in_(["requested", "approved", "pickup_scheduled", "in_transit", "received", "inspected"]),
            )
        ).all()

        open_tickets = session.exec(
            select(SupportTicket).where(
                SupportTicket.order_id == order.id,
                SupportTicket.status.in_(["open", "in_progress", "waiting_customer", "escalated", "pending"]),
            )
        ).all()

        if not open_returns and not open_tickets:
            try:
                success, unhold_err = unhold_tenant_escrow_transfer(order=order, session=session, client=client)
                if success:
                    released_count += 1
                    total_amount_released += (order.tenant_share or Decimal("0.00"))
                else:
                    logger.warning("Escrow unhold skipped for order %s due to transfer issue: %s", order.id, unhold_err)
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

    if released_count == 0:
        msg = "No mature escrows to release."
    else:
        msg = f"Released {released_count} escrow payout(s) (₹{float(total_amount_released):,.2f})."
        try:
            admin_id = UUID(admin["adminId"]) if isinstance(admin, dict) and admin.get("adminId") else None
            AuditService.log_event(
                session=session,
                site_id=site_id,
                actor_type=ActorType.OWNER if (admin.get("role") or "").lower() == "owner" else ActorType.TEAM_MEMBER,
                actor_id=admin_id,
                actor_name=admin.get("name"),
                actor_email=admin.get("email"),
                actor_role=admin.get("role") or "Staff",
                category=AuditCategory.EARNINGS_LEDGER,
                action="escrow.released",
                source=SourceType.WEB_ADMIN,
                summary=f"Manually triggered escrow release: {released_count} mature payout(s) (₹{float(total_amount_released):,.2f})",
                metadata={
                    "financial": True,
                    "amount": float(total_amount_released),
                    "currency": "INR",
                    "released_count": released_count,
                },
            )
        except Exception as log_err:
            logger.warning("Failed to log escrow.released audit event: %s", log_err)

    return {
        "message": msg,
        "released_count": released_count,
        "total_amount_released": float(total_amount_released),
    }


@router.get("/admin/{site_id}/payment-settings", response_model=BankAccountSettingsResponse)
def get_payment_settings(
    site_id: UUID,
    admin=Depends(require_permission("payout_settings:view")),
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
            "bank_details_updated_at": None,
            "quarantine_until": None,
            "is_quarantined": False,
        }

    raw_account = decrypt_string(bank_account.account_number_encrypted)
    masked = mask_account_number(raw_account)
    now = utc_now()
    is_quarantined = bool(bank_account.quarantine_until and bank_account.quarantine_until > now)

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
        "bank_details_updated_at": bank_account.bank_details_updated_at.isoformat() if getattr(bank_account, "bank_details_updated_at", None) else None,
        "quarantine_until": bank_account.quarantine_until.isoformat() if getattr(bank_account, "quarantine_until", None) else None,
        "is_quarantined": is_quarantined,
        "updated_at": bank_account.updated_at.isoformat() if bank_account.updated_at else None,
    }


@router.put("/admin/{site_id}/payment-settings", response_model=BankAccountSettingsResponse)
def update_payment_settings(
    site_id: UUID,
    payload: BankAccountSettingsPayload,
    admin=Depends(require_permission("payout_settings:edit")),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    admin_id = UUID(admin["adminId"])
    now = utc_now()
    quarantine_window = now + timedelta(hours=24)

    bank_account = session.exec(
        select(TenantBankAccount).where(TenantBankAccount.site_id == site_id)
    ).first()

    if not bank_account:
        if not payload.account_number or len(payload.account_number.strip()) < 6:
            raise HTTPException(
                status_code=400,
                detail="A valid bank account number (at least 6 digits) is required.",
            )
        raw_account = payload.account_number.strip()
        last4 = raw_account[-4:]
        encrypted_account = encrypt_string(raw_account)

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
            bank_details_updated_at=now,
            quarantine_until=quarantine_window,
        )
    else:
        bank_account.account_holder_name = payload.account_holder_name.strip()
        if payload.account_number and payload.account_number.strip():
            raw_account = payload.account_number.strip()
            if len(raw_account) < 6:
                raise HTTPException(
                    status_code=400,
                    detail="A valid bank account number (at least 6 digits) is required.",
                )
            bank_account.account_number_encrypted = encrypt_string(raw_account)
            bank_account.account_number_last4 = raw_account[-4:]
        else:
            raw_account = decrypt_string(bank_account.account_number_encrypted)

        bank_account.ifsc_code = payload.ifsc_code.strip().upper()
        bank_account.bank_name = payload.bank_name.strip()
        bank_account.pan_number = payload.pan_number
        bank_account.gst_number = payload.gst_number
        bank_account.is_verified = True
        bank_account.bank_details_updated_at = now
        bank_account.quarantine_until = quarantine_window
        bank_account.updated_at = now

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

    try:
        AuditService.log_event(
            session=session,
            site_id=site_id,
            actor_type=ActorType.OWNER if (admin.get("role") or "").lower() == "owner" else ActorType.TEAM_MEMBER,
            actor_id=admin_id,
            actor_name=admin.get("name"),
            actor_email=admin.get("email"),
            actor_role=admin.get("role") or "Staff",
            category=AuditCategory.FINANCIAL,
            action="payout_account.updated",
            source=SourceType.WEB_ADMIN,
            resource_type="bank_account",
            resource_id=str(bank_account.id),
            resource_name=bank_account.bank_name,
            summary=f"Updated merchant payout bank account: {bank_account.bank_name} ({mask_account_number(raw_account)})",
            metadata={
                "bank_name": bank_account.bank_name,
                "ifsc_code": bank_account.ifsc_code,
                "account_number_masked": mask_account_number(raw_account),
                "holder_name": bank_account.account_holder_name,
            },
        )
    except Exception as log_err:
        logger.warning("Failed to log payout_account.updated audit event: %s", log_err)

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
    date_filter: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    admin=Depends(require_permission("earnings:view")),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    # Check bank configured
    bank_acc = session.exec(
        select(TenantBankAccount).where(TenantBankAccount.site_id == site_id)
    ).first()
    bank_configured = bank_acc is not None and bool(bank_acc.account_number_last4)

    # -------------------------------------------------------------
    # STRICT MULTI-TENANT ISOLATION: Load ONLY genuine orders for THIS site
    # -------------------------------------------------------------
    site_orders = session.exec(
        select(Order).where(Order.site_id == site_id)
    ).all()
    site_order_map = {o.id: o for o in site_orders}
    site_order_ids = set(site_order_map.keys())

    # Auto-backfill / synchronize ledger entries strictly for this site's genuine orders
    existing_site_ledger_entries = session.exec(
        select(TenantLedgerEntry).where(TenantLedgerEntry.site_id == site_id)
    ).all()
    existing_ledger_by_order_id = {
        e.order_id: e for e in existing_site_ledger_entries if e.order_id
    }

    admin_id = None
    if isinstance(admin, dict) and admin.get("id"):
        try:
            admin_id = UUID(str(admin["id"]))
        except Exception:
            pass
    if not admin_id and hasattr(admin, "id") and getattr(admin, "id"):
        try:
            admin_id = UUID(str(getattr(admin, "id")))
        except Exception:
            pass
    if not admin_id:
        admin_site_link = session.exec(
            select(AdminSite).where(AdminSite.site_id == site_id)
        ).first()
        if admin_site_link:
            admin_id = admin_site_link.admin_id
    if not admin_id:
        first_admin = session.exec(select(Admin)).first()
        if first_admin:
            admin_id = first_admin.id

    now = utc_now()
    has_mutations = False

    tax_profile = session.exec(
        select(MerchantTaxProfile).where(MerchantTaxProfile.site_id == site_id)
    ).first()

    for ord_obj in site_orders:
        pm = (ord_obj.payment_method or "").strip().lower()
        is_cod_ord = (
            pm in ("cod", "cash on delivery", "cash_on_delivery", "cash", "offline", "cash_delivery", "cash on collection")
            or "cod" in pm
            or "cash" in pm
            or (not getattr(ord_obj, "razorpay_payment_id", None) and not getattr(ord_obj, "razorpay_order_id", None) and pm not in ("online", "razorpay", "upi", "card", "credit_card", "debit_card", "netbanking", "wallet", "prepaid"))
        )
        
        ledger_entry = existing_ledger_by_order_id.get(ord_obj.id)
        if not ledger_entry:
            ledger_entry = session.exec(
                select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == ord_obj.id)
            ).first()

        # Online order is genuine paid / paid-and-refunded ONLY if payment was captured
        # (Must have razorpay_payment_id, transfer_id, or payment_status in paid/completed/settled/refunded)
        has_captured_payment = (
            getattr(ord_obj, "payment_status", "") in ("paid", "completed", "settled")
            or bool(getattr(ord_obj, "razorpay_payment_id", None))
        )
        is_paid_and_refunded = (
            getattr(ord_obj, "payment_status", "") == "refunded"
            or (
                ord_obj.status in ("refunded", "returned", "cancelled")
                and (
                    bool(getattr(ord_obj, "razorpay_payment_id", None))
                    or (ledger_entry and bool(getattr(ledger_entry, "razorpay_transfer_id", None)))
                )
            )
        )
        is_valid_online_order = has_captured_payment or is_paid_and_refunded

        # If online order was NEVER paid (abandoned checkout / pending payment attempt), mark unpaid & ignore
        if not is_cod_ord and not is_valid_online_order:
            if ledger_entry and ledger_entry.status != "unpaid":
                ledger_entry.status = "unpaid"
                ledger_entry.updated_at = now
                session.add(ledger_entry)
                has_mutations = True
            continue

        gross = Decimal(str(ord_obj.total or "0.00"))
        comm_pct = Decimal("3.00")

        pricing_snapshot = ord_obj.pricing_snapshot if isinstance(ord_obj.pricing_snapshot, dict) else {}
        tax_dict = pricing_snapshot.get("tax") if isinstance(pricing_snapshot.get("tax"), dict) else {}
        pricing_details = pricing_snapshot.get("pricing_details") if isinstance(pricing_snapshot.get("pricing_details"), dict) else {}
        taxable_val = Decimal(str(
            tax_dict.get("taxableAmount")
            or pricing_details.get("taxable_amount")
            or pricing_snapshot.get("taxableSubtotal")
            or getattr(ord_obj, "subtotal", None)
            or ord_obj.total
        ))
        cgst_val = Decimal(str(tax_dict.get("cgst") or pricing_details.get("cgst_amount") or 0))
        sgst_val = Decimal(str(tax_dict.get("sgst") or pricing_details.get("sgst_amount") or 0))
        igst_val = Decimal(str(tax_dict.get("igst") or pricing_details.get("igst_amount") or 0))
        cess_val = Decimal(str(tax_dict.get("cess") or pricing_details.get("cess_amount") or 0))

        shipping_addr = ord_obj.shipping_address if isinstance(ord_obj.shipping_address, dict) else {}
        dest_state = resolve_gst_state_code(
            state_code=shipping_addr.get("state_code") or shipping_addr.get("stateCode"),
            state_name=shipping_addr.get("state") or shipping_addr.get("state_name"),
            postal_code=shipping_addr.get("postal_code") or shipping_addr.get("postalCode"),
            default=tax_profile.state_code if tax_profile else "27",
        )

        from services.settlement_tax_service import calculate_settlement_split
        breakdown = calculate_settlement_split(
            gross_order_value=gross,
            taxable_product_value=taxable_val,
            product_cgst=cgst_val,
            product_sgst=sgst_val,
            product_igst=igst_val,
            product_cess=cess_val,
            merchant_profile=tax_profile,
            customer_state_code=dest_state,
            commission_percent=comm_pct,
            estimate_gateway_fee=not is_cod_ord,
        )

        is_order_returned = ord_obj.status in ("cancelled", "returned", "refunded") or getattr(ord_obj, "payment_status", None) == "refunded"

        if not ledger_entry:
            initial_status = "pending_cod" if is_cod_ord else ("refunded" if is_order_returned else ("paid" if ord_obj.status == "delivered" else "in_escrow"))
            initial_escrow = "reversed" if is_order_returned else ("unheld" if ord_obj.status == "delivered" else "held")
            new_entry = TenantLedgerEntry(
                id=uuid4(),
                admin_id=admin_id or uuid4(),
                site_id=site_id,
                order_id=ord_obj.id,
                gross_amount=gross,
                platform_fee_percent=comm_pct,
                platform_fee=breakdown.total_platform_fee_with_gst,
                tenant_share=gross if is_cod_ord else breakdown.net_merchant_payout,
                currency="INR",
                status=initial_status,
                escrow_status=initial_escrow,
                entry_type="order_sale",
                gross_order_value=breakdown.gross_order_value,
                taxable_product_value=breakdown.taxable_product_value,
                platform_commission_base=breakdown.platform_commission_base,
                platform_fee_gst_cgst=breakdown.platform_fee_gst_cgst,
                platform_fee_gst_sgst=breakdown.platform_fee_gst_sgst,
                platform_fee_gst_igst=breakdown.platform_fee_gst_igst,
                total_platform_fee_with_gst=breakdown.total_platform_fee_with_gst,
                gst_tcs_cgst=breakdown.gst_tcs_cgst,
                gst_tcs_sgst=breakdown.gst_tcs_sgst,
                gst_tcs_igst=breakdown.gst_tcs_igst,
                total_gst_tcs=breakdown.total_gst_tcs,
                tds_rate_applied=breakdown.tds_rate_applied,
                income_tax_tds_194o=breakdown.income_tax_tds_194o,
                gateway_fee=breakdown.gateway_fee,
                gateway_fee_gst=breakdown.gateway_fee_gst,
                net_merchant_payout=breakdown.net_merchant_payout,
                created_at=ord_obj.created_at or now,
                updated_at=now,
            )
            session.add(new_entry)
            existing_ledger_by_order_id[ord_obj.id] = new_entry
            has_mutations = True
        else:
            changed = False
            if ord_obj.created_at and ledger_entry.created_at != ord_obj.created_at:
                ledger_entry.created_at = ord_obj.created_at
                changed = True
            if ledger_entry.site_id != site_id:
                ledger_entry.site_id = site_id
                changed = True
            if is_order_returned and ledger_entry.status != "refunded":
                ledger_entry.status = "refunded"
                ledger_entry.escrow_status = "reversed"
                changed = True
            elif is_cod_ord and ledger_entry.status in ("in_escrow", "held", "pending_payout", "unpaid"):
                ledger_entry.status = "pending_cod"
                changed = True
            elif not is_cod_ord and is_valid_online_order and ledger_entry.status == "unpaid":
                ledger_entry.status = "refunded" if is_order_returned else "in_escrow"
                changed = True

            # Always sync and reconcile statutory fee, GST, TCS, TDS, Gateway fee and payout fields
            if ledger_entry.platform_fee != breakdown.total_platform_fee_with_gst:
                ledger_entry.platform_fee = breakdown.total_platform_fee_with_gst
                changed = True
            if ledger_entry.platform_fee_percent != comm_pct:
                ledger_entry.platform_fee_percent = comm_pct
                changed = True
            expected_tenant_share = gross if is_cod_ord else breakdown.net_merchant_payout
            if ledger_entry.tenant_share != expected_tenant_share:
                ledger_entry.tenant_share = expected_tenant_share
                changed = True
            if ledger_entry.gross_order_value != breakdown.gross_order_value:
                ledger_entry.gross_order_value = breakdown.gross_order_value
                changed = True
            if ledger_entry.taxable_product_value != breakdown.taxable_product_value:
                ledger_entry.taxable_product_value = breakdown.taxable_product_value
                changed = True
            if getattr(ledger_entry, "product_cgst", None) != breakdown.product_cgst:
                ledger_entry.product_cgst = breakdown.product_cgst
                changed = True
            if getattr(ledger_entry, "product_sgst", None) != breakdown.product_sgst:
                ledger_entry.product_sgst = breakdown.product_sgst
                changed = True
            if getattr(ledger_entry, "product_igst", None) != breakdown.product_igst:
                ledger_entry.product_igst = breakdown.product_igst
                changed = True
            if getattr(ledger_entry, "product_cess", None) != breakdown.product_cess:
                ledger_entry.product_cess = breakdown.product_cess
                changed = True
            if getattr(ledger_entry, "platform_commission_base", None) != breakdown.platform_commission_base:
                ledger_entry.platform_commission_base = breakdown.platform_commission_base
                changed = True
            if getattr(ledger_entry, "platform_fee_gst_cgst", None) != breakdown.platform_fee_gst_cgst:
                ledger_entry.platform_fee_gst_cgst = breakdown.platform_fee_gst_cgst
                changed = True
            if getattr(ledger_entry, "platform_fee_gst_sgst", None) != breakdown.platform_fee_gst_sgst:
                ledger_entry.platform_fee_gst_sgst = breakdown.platform_fee_gst_sgst
                changed = True
            if getattr(ledger_entry, "platform_fee_gst_igst", None) != breakdown.platform_fee_gst_igst:
                ledger_entry.platform_fee_gst_igst = breakdown.platform_fee_gst_igst
                changed = True
            if getattr(ledger_entry, "total_platform_fee_with_gst", None) != breakdown.total_platform_fee_with_gst:
                ledger_entry.total_platform_fee_with_gst = breakdown.total_platform_fee_with_gst
                changed = True
            if getattr(ledger_entry, "gst_tcs_cgst", None) != breakdown.gst_tcs_cgst:
                ledger_entry.gst_tcs_cgst = breakdown.gst_tcs_cgst
                changed = True
            if getattr(ledger_entry, "gst_tcs_sgst", None) != breakdown.gst_tcs_sgst:
                ledger_entry.gst_tcs_sgst = breakdown.gst_tcs_sgst
                changed = True
            if getattr(ledger_entry, "gst_tcs_igst", None) != breakdown.gst_tcs_igst:
                ledger_entry.gst_tcs_igst = breakdown.gst_tcs_igst
                changed = True
            if getattr(ledger_entry, "total_gst_tcs", None) != breakdown.total_gst_tcs:
                ledger_entry.total_gst_tcs = breakdown.total_gst_tcs
                changed = True
            if getattr(ledger_entry, "income_tax_tds_194o", None) != breakdown.income_tax_tds_194o:
                ledger_entry.income_tax_tds_194o = breakdown.income_tax_tds_194o
                ledger_entry.tds_rate_applied = breakdown.tds_rate_applied
                changed = True
            if not is_cod_ord:
                if getattr(ledger_entry, "gateway_fee", None) != breakdown.gateway_fee:
                    ledger_entry.gateway_fee = breakdown.gateway_fee
                    changed = True
                if getattr(ledger_entry, "gateway_fee_gst", None) != breakdown.gateway_fee_gst:
                    ledger_entry.gateway_fee_gst = breakdown.gateway_fee_gst
                    changed = True
            if getattr(ledger_entry, "net_merchant_payout", None) != breakdown.net_merchant_payout:
                ledger_entry.net_merchant_payout = breakdown.net_merchant_payout
                changed = True
            if changed:
                ledger_entry.updated_at = now
                session.add(ledger_entry)
                has_mutations = True

    if has_mutations:
        session.commit()

    # Load candidate ledger entries for this site
    candidate_entries = session.exec(
        select(TenantLedgerEntry)
        .where(
            TenantLedgerEntry.site_id == site_id,
            TenantLedgerEntry.status != "unpaid"
        )
        .order_by(TenantLedgerEntry.created_at.desc())
    ).all()

    # Strict multi-tenant security verification: keep ONLY records linked to genuine valid orders of this site
    all_entries = []
    for e in candidate_entries:
        if getattr(e, "entry_type", "") == "fee_adjustment_refund":
            if e.site_id == site_id:
                all_entries.append(e)
        elif e.order_id in site_order_ids:
            ord_item = site_order_map.get(e.order_id)
            if ord_item:
                pm = (ord_item.payment_method or "").strip().lower()
                is_cod = (
                    pm in ("cod", "cash on delivery", "cash_on_delivery", "cash", "offline", "cash_delivery", "cash on collection")
                    or "cod" in pm
                    or "cash" in pm
                    or (not getattr(ord_item, "razorpay_payment_id", None) and not getattr(ord_item, "razorpay_order_id", None) and pm not in ("online", "razorpay", "upi", "card", "credit_card", "debit_card", "netbanking", "wallet", "prepaid"))
                )
                has_captured = (
                    getattr(ord_item, "payment_status", "") in ("paid", "completed", "settled")
                    or bool(getattr(ord_item, "razorpay_payment_id", None))
                )
                is_refunded_online = (
                    getattr(ord_item, "payment_status", "") == "refunded"
                    or (
                        ord_item.status in ("refunded", "returned", "cancelled")
                        and (
                            bool(getattr(ord_item, "razorpay_payment_id", None))
                            or bool(getattr(e, "razorpay_transfer_id", None))
                        )
                    )
                    or (e.status == "refunded" and bool(getattr(e, "razorpay_transfer_id", None)))
                )
                if is_cod or has_captured or is_refunded_online:
                    all_entries.append(e)

    def _entry_sort_key(e_item: TenantLedgerEntry) -> datetime:
        ord_rec = site_order_map.get(e_item.order_id)
        if ord_rec and ord_rec.created_at:
            return ord_rec.created_at
        return e_item.created_at or datetime.min.replace(tzinfo=timezone.utc)

    all_entries.sort(key=_entry_sort_key, reverse=True)

    gross_gmv = Decimal("0.00")
    total_platform_fees = Decimal("0.00")
    total_net_earnings = Decimal("0.00")
    pending_payout = Decimal("0.00")
    escrow_balance = Decimal("0.00")
    settled_payouts = Decimal("0.00")

    online_gross_amount = Decimal("0.00")
    online_refunded_amount = Decimal("0.00")

    cod_gross_amount = Decimal("0.00")
    cod_refunded_amount = Decimal("0.00")
    cod_platform_fees_due = Decimal("0.00")
    cod_platform_fees_cooling = Decimal("0.00")
    cod_platform_fees_deducted = Decimal("0.00")
    refund_gateway_fees_due = Decimal("0.00")

    def _is_entry_cod(o_item: Optional[Order], e_item: Optional[TenantLedgerEntry]) -> bool:
        if e_item and getattr(e_item, "status", None) == "pending_cod":
            return True
        if not o_item and e_item and getattr(e_item, "order_id", None):
            o_item = site_order_map.get(e_item.order_id)
        if not o_item:
            return False
        p_str = (o_item.payment_method or "").strip().lower()
        if p_str in ("cod", "cash on delivery", "cash_on_delivery", "cash", "offline", "cash_delivery", "cash on collection") or "cod" in p_str or "cash" in p_str:
            return True
        if not getattr(o_item, "razorpay_payment_id", None) and not getattr(o_item, "razorpay_order_id", None) and p_str not in ("online", "razorpay", "upi", "card", "credit_card", "debit_card", "netbanking", "wallet", "prepaid"):
            return True
        return False

    # Parse date filters
    from_dt = None
    to_dt = None
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            try:
                from_dt = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except Exception:
                pass
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            try:
                to_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
            except Exception:
                pass

    def _matches_date_filter(e_date: datetime) -> bool:
        if not date_filter or date_filter == "all":
            return True
        if e_date.tzinfo is None:
            e_date = e_date.replace(tzinfo=timezone.utc)
        if date_filter == "today":
            start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            return e_date >= start_today
        elif date_filter == "last_7_days":
            return e_date >= (now - timedelta(days=7))
        elif date_filter == "last_30_days":
            return e_date >= (now - timedelta(days=30))
        elif date_filter == "custom":
            if from_dt and e_date < from_dt:
                return False
            if to_dt and e_date > to_dt:
                return False
            return True
        return True

    for entry in all_entries:
        # Track non-refundable gateway fee debit adjustments from refunds/cancellations
        if getattr(entry, "entry_type", "") == "fee_adjustment_refund" and entry.status != "refunded":
            refund_gateway_fees_due += abs(entry.tenant_share)

        # Auto-reconcile status if underlying order was cancelled, delivered, or return window matured
        order = site_order_map.get(entry.order_id)
        is_order_cod = _is_entry_cod(order, entry)
        if is_order_cod and entry.status in ("in_escrow", "held"):
            entry.status = "pending_cod"
            session.add(entry)

        is_returned_or_cancelled = (
            (order and order.status in ("cancelled", "returned", "refunded"))
            or (order and getattr(order, "payment_status", None) == "refunded")
            or entry.status in ("refunded", "reversed")
            or getattr(entry, "escrow_status", None) == "reversed"
        )

        if order:
            if order.status == "cancelled" or getattr(order, "payment_status", None) == "refunded":
                if entry.status != "refunded":
                    entry.status = "refunded"
                    entry.escrow_status = "reversed"
                    session.add(entry)
            elif order.status == "delivered" and entry.status not in ("paid", "refunded") and not is_order_cod:
                # Online Escrow matures ONLY after order is delivered AND the return window has passed
                window_closes = order.return_window_closes_at
                if window_closes and now >= window_closes:
                    from models import ReturnRequest, SupportTicket
                    open_returns = session.exec(
                        select(ReturnRequest).where(
                            ReturnRequest.order_id == order.id,
                            ReturnRequest.status.in_(["requested", "approved", "pickup_scheduled", "in_transit", "received", "inspected"])
                        )
                    ).all()
                    open_tickets = session.exec(
                        select(SupportTicket).where(
                            SupportTicket.order_id == order.id,
                            SupportTicket.status.in_(["open", "in_progress", "waiting_customer", "escalated", "pending"])
                        )
                    ).all()
                    if not open_returns and not open_tickets:
                        try:
                            unhold_tenant_escrow_transfer(order=order, session=session)
                        except Exception as e:
                            logger.error("Auto unhold in get_earnings failed for order %s: %s", order.id, e)

        # Get entry date for period-based metrics accumulation
        e_date = order.created_at if (order and order.created_at) else (entry.created_at or datetime.min.replace(tzinfo=timezone.utc))
        if e_date.tzinfo is None:
            e_date = e_date.replace(tzinfo=timezone.utc)

        if not _matches_date_filter(e_date):
            continue

        if is_order_cod:
            cod_gross_amount += entry.gross_amount
            if is_returned_or_cancelled:
                cod_refunded_amount += entry.gross_amount
            else:
                gross_gmv += entry.gross_amount
                total_platform_fees += entry.platform_fee
                total_net_earnings += entry.tenant_share

                entry_cod_dues = (
                    entry.platform_fee
                    + Decimal(str(getattr(entry, "income_tax_tds_194o", 0) or 0))
                    + Decimal(str(getattr(entry, "total_gst_tcs", 0) or 0))
                )

                window_closes = order.return_window_closes_at if order else None
                cod_ded_due = (window_closes + timedelta(days=2)) if window_closes else (order.delivered_at + timedelta(days=9) if (order and order.delivered_at) else None)
                if order and order.status == "delivered" and cod_ded_due and now >= cod_ded_due:
                    # Matured: return period + 2 days safety buffer elapsed!
                    cod_platform_fees_deducted += entry_cod_dues
                else:
                    # Still in cooling buffer
                    cod_platform_fees_cooling += entry_cod_dues
                    cod_platform_fees_due += entry_cod_dues
        else:
            online_gross_amount += entry.gross_amount
            if is_returned_or_cancelled:
                online_refunded_amount += entry.gross_amount
            else:
                gross_gmv += entry.gross_amount
                total_platform_fees += entry.platform_fee
                total_net_earnings += entry.tenant_share

                if entry.status in ("in_escrow", "held") or (getattr(entry, "escrow_status", "held") == "held" and entry.status != "paid"):
                    escrow_balance += entry.tenant_share
                elif entry.status == "paid":
                    settled_payouts += entry.tenant_share
                elif entry.status == "pending_payout":
                    pending_payout += entry.tenant_share

    online_net_amount = max(Decimal("0.00"), online_gross_amount - online_refunded_amount)
    cod_net_amount = max(Decimal("0.00"), cod_gross_amount - cod_refunded_amount)

    session.commit()

    total_dues_owed_to_platform = cod_platform_fees_due + refund_gateway_fees_due
    net_payable_to_merchant = max(Decimal("0.00"), pending_payout - total_dues_owed_to_platform)

    # Apply search, date_filter, status, and sorting to table entries
    filtered_entries = []

    search_q = (search or "").strip().lower().replace("#", "")

    for e in all_entries:
        ord_obj = site_order_map.get(e.order_id)
        is_cod = _is_entry_cod(ord_obj, e)
        e_date = ord_obj.created_at if (ord_obj and ord_obj.created_at) else (e.created_at or datetime.min.replace(tzinfo=timezone.utc))
        if e_date.tzinfo is None:
            e_date = e_date.replace(tzinfo=timezone.utc)

        # 1. Date Filter
        if not _matches_date_filter(e_date):
            continue

        # 2. Status Filter
        if status and status != "all":
            is_settled = (e.status == "paid" and getattr(e, "escrow_status", "held") == "unheld")
            is_escrow = (getattr(e, "escrow_status", "held") == "held" and e.status not in ("paid", "refunded") and not is_cod)
            is_refunded = (e.status in ("refunded", "reversed") or getattr(e, "escrow_status", "held") == "reversed" or (ord_obj and ord_obj.status in ("cancelled", "returned", "refunded")))

            if status == "settled" and not is_settled:
                continue
            elif status == "escrow" and not is_escrow:
                continue
            elif status == "refunded" and not is_refunded:
                continue
            elif status == "pending" and e.status != "pending_payout":
                continue
            elif status == "cod" and not is_cod:
                continue

        # 3. Search Query
        if search_q:
            ord_id_str = str(e.order_id or "").lower()
            ord_num_str = ord_id_str[:8].upper()
            transfer_str = str(getattr(e, "razorpay_transfer_id", "") or "").lower()
            gross_str = str(e.gross_amount)
            net_str = str(e.tenant_share)

            if not (
                search_q in ord_id_str
                or search_q in ord_num_str.lower()
                or search_q in transfer_str
                or search_q in gross_str
                or search_q in net_str
            ):
                continue

        filtered_entries.append(e)

    # 4. Sorting
    if sort == "date_asc":
        filtered_entries.sort(key=lambda x: (site_order_map.get(x.order_id).created_at if (site_order_map.get(x.order_id) and site_order_map.get(x.order_id).created_at) else (x.created_at or datetime.min.replace(tzinfo=timezone.utc))), reverse=False)
    elif sort == "amount_desc":
        filtered_entries.sort(key=lambda x: x.tenant_share, reverse=True)
    elif sort == "amount_asc":
        filtered_entries.sort(key=lambda x: x.tenant_share, reverse=False)
    else:  # date_desc
        filtered_entries.sort(key=_entry_sort_key, reverse=True)

    total_count = len(filtered_entries)
    total_pages = max(1, (total_count + limit - 1) // limit)
    offset = (page - 1) * limit
    paginated_entries = filtered_entries[offset : offset + limit]

    orders_map = {
        o.id: o
        for o in session.exec(
            select(Order).where(Order.id.in_([e.order_id for e in paginated_entries]))
        ).all()
    } if paginated_entries else {}

    paginated_order_ids = [e.order_id for e in paginated_entries]
    from models import ReturnRequest, SupportTicket
    open_returns_list = session.exec(
        select(ReturnRequest).where(
            ReturnRequest.order_id.in_(paginated_order_ids),
            ReturnRequest.status.in_(["requested", "approved", "pickup_scheduled", "in_transit", "received", "inspected"])
        )
    ).all() if paginated_order_ids else []
    returns_by_order = {}
    for r in open_returns_list:
        returns_by_order.setdefault(r.order_id, []).append(r)

    open_tickets_list = session.exec(
        select(SupportTicket).where(
            SupportTicket.order_id.in_(paginated_order_ids),
            SupportTicket.status.in_(["open", "in_progress", "waiting_customer", "escalated", "pending"])
        )
    ).all() if paginated_order_ids else []
    tickets_by_order = {}
    for t in open_tickets_list:
        tickets_by_order.setdefault(t.order_id, []).append(t)

    serialized_entries = []
    for e in paginated_entries:
        ord = orders_map.get(e.order_id)
        is_cod = _is_entry_cod(ord, e)

        code = "cooling_period"
        title = "In Escrow Hold"
        detail = "Pending payout clearance."
        block_ref = None
        cod_fee_status = None
        cod_fee_due_str = None
        cod_fee_deducted_str = None

        if is_cod:
            window_closes = ord.return_window_closes_at if ord else None
            cod_ded_due = (window_closes + timedelta(days=2)) if window_closes else (ord.delivered_at + timedelta(days=9) if (ord and ord.delivered_at) else None)
            is_returned_or_cancelled = (ord and ord.status in ("cancelled", "returned", "refunded")) or e.status == "refunded"

            if is_returned_or_cancelled:
                cod_fee_status = "waived_returned"
                code = "cod_fee_waived"
                title = "COD Order Returned · Fee Waived"
                detail = "Order was returned or cancelled. Platform fee is 100% waived (₹0.00 charged)."
            elif ord and ord.status == "delivered" and cod_ded_due and now >= cod_ded_due:
                cod_fee_status = "deducted"
                cod_fee_deducted_str = cod_ded_due.isoformat()
                code = "cod_fee_settled"
                title = "COD Platform Fee Deducted"
                detail = f"Order delivered and buyer return protection + 2-day safety buffer elapsed. Fee of ₹{float(e.platform_fee):.2f} (incl. GST) deducted."
            else:
                cod_fee_status = "cooling"
                if cod_ded_due:
                    cod_fee_due_str = cod_ded_due.isoformat()
                    delta = cod_ded_due - now
                    hrs_left = max(1, int(delta.total_seconds() // 3600))
                    days_left = hrs_left // 24
                    time_str = f"{days_left}d {hrs_left % 24}h" if days_left else f"{hrs_left} hrs"
                    code = "cod_buffer_cooling"
                    title = f"COD Safety Buffer ({time_str} left)"
                    detail = f"Cash in hand. Platform fee of ₹{float(e.platform_fee):.2f} is held under return protection + 2-day safety buffer until {cod_ded_due.strftime('%b %d, %Y at %I:%M %p UTC')}."
                elif ord and ord.status not in ("delivered", "completed"):
                    code = "cod_in_transit"
                    title = f"COD In Transit ({ord.status.replace('_', ' ').capitalize()})"
                    detail = "Order in transit. Buyer return window and 2-day safety buffer countdown begins upon delivery."
                else:
                    code = "cod_buffer_cooling"
                    title = "COD Safety Buffer Active"
                    detail = "Cash in hand. Protected under order return window + 2-day safety buffer."
        elif e.status == "paid" and getattr(e, "escrow_status", "held") == "unheld":
            code = "settled"
            title = "Settled to Bank"
            detail = "Funds disbursed to merchant bank account."
        elif e.status == "refunded" or getattr(e, "escrow_status", "held") == "reversed":
            code = "refunded"
            title = "Refunded / Reversed"
            detail = "Order was refunded or cancelled; funds reversed to customer."
        elif returns_by_order.get(e.order_id):
            r_obj = returns_by_order[e.order_id][0]
            code = "return_dispute"
            title = "On Hold · Return Request"
            detail = f"Customer submitted return request ({r_obj.reason or 'Inspection in progress'}). Escrow locked until return resolution."
            block_ref = f"Return #{str(r_obj.id)[:8]}"
        elif tickets_by_order.get(e.order_id):
            t_obj = tickets_by_order[e.order_id][0]
            code = "support_ticket"
            title = "On Hold · Support Inquiry"
            detail = f"Open customer support case #{t_obj.ticket_number or str(t_obj.id)[:8]} ({t_obj.subject or 'Inquiry'}). Escrow locked until resolved."
            block_ref = t_obj.ticket_number or f"Ticket #{str(t_obj.id)[:8]}"
        elif bank_acc and getattr(bank_acc, "quarantine_until", None) and bank_acc.quarantine_until > now:
            code = "bank_quarantine"
            title = "On Hold · Bank Cooldown"
            detail = f"Bank credentials updated recently. Payouts locked until {bank_acc.quarantine_until.strftime('%b %d, %H:%M UTC')}."
        elif ord and ord.status not in ("delivered", "completed"):
            code = "in_transit"
            title = f"On Hold · Awaiting Delivery ({ord.status.replace('_', ' ').capitalize()})"
            detail = f"Order status is '{ord.status}'. Escrow return protection countdown begins once marked delivered."
        elif ord and ord.return_window_closes_at and ord.return_window_closes_at > now:
            code = "cooling_period"
            delta = ord.return_window_closes_at - now
            hours_left = max(1, int(delta.total_seconds() // 3600))
            if hours_left >= 24:
                days = hours_left // 24
                rem_h = hours_left % 24
                time_str = f"{days}d {rem_h}h" if rem_h else f"{days} days"
            else:
                time_str = f"{hours_left} hrs"
            title = f"In Escrow Hold · Return Window ({time_str} left)"
            detail = f"Order delivered. Mandatory buyer protection cooling window closes on {ord.return_window_closes_at.strftime('%b %d, %Y at %I:%M %p UTC')} ({time_str} remaining)."
        elif getattr(e, "escrow_status", "held") == "unheld" or e.status == "pending_payout":
            code = "mature_ready"
            title = "Matured · Ready for Release"
            detail = "Return window elapsed with zero disputes. Payout is ready for disbursement."

        platform_comm_base = float(e.platform_commission_base) if getattr(e, "platform_commission_base", None) is not None else float(e.gross_amount * (e.platform_fee_percent / Decimal("100")))
        calc_fee_gst = float((getattr(e, "platform_fee_gst_cgst", 0) or 0) + (getattr(e, "platform_fee_gst_sgst", 0) or 0) + (getattr(e, "platform_fee_gst_igst", 0) or 0))
        if calc_fee_gst <= 0:
            calc_fee_gst = float(e.platform_fee) - platform_comm_base
        platform_fee_gst = max(0.0, calc_fee_gst)

        entry_created_dt = ord.created_at if (ord and ord.created_at) else e.created_at
        created_at_str = entry_created_dt.isoformat() if entry_created_dt else e.created_at.isoformat()

        serialized_entries.append(
            LedgerEntryResponse(
                id=str(e.id),
                order_id=str(e.order_id),
                order_number=str(e.order_id)[:8].upper(),
                created_at=created_at_str,
                gross_amount=float(e.gross_amount),
                platform_fee=float(e.platform_fee),
                platform_fee_percent=float(e.platform_fee_percent),
                tenant_share=float(e.tenant_share),
                platform_commission_base=platform_comm_base,
                platform_fee_gst=platform_fee_gst,
                total_platform_fee_with_gst=float(getattr(e, "total_platform_fee_with_gst", None) or e.platform_fee),
                gateway_fee=float(getattr(e, "gateway_fee", 0) or 0),
                gateway_fee_gst=float(getattr(e, "gateway_fee_gst", 0) or 0),
                gst_tcs=float(getattr(e, "total_gst_tcs", 0) or 0),
                tds_194o=float(getattr(e, "income_tax_tds_194o", 0) or 0),
                tds_rate_applied=float(getattr(e, "tds_rate_applied", 0) or 0),
                is_cod=bool(is_cod),
                cod_fee_status=cod_fee_status,
                cod_fee_deduction_due_at=cod_fee_due_str,
                cod_fee_deducted_at=cod_fee_deducted_str,
                cod_buffer_days=2,
                status=e.status,
                currency=e.currency,
                razorpay_transfer_id=e.razorpay_transfer_id,
                transfer_status=e.transfer_status,
                escrow_status=getattr(e, "escrow_status", "held"),
                escrow_release_due_at=e.escrow_release_due_at.isoformat() if e.escrow_release_due_at else None,
                unheld_at=e.unheld_at.isoformat() if getattr(e, "unheld_at", None) else None,
                return_window_closes_at=ord.return_window_closes_at.isoformat() if ord and ord.return_window_closes_at else None,
                settled_at=e.settled_at.isoformat() if e.settled_at else None,
                order_status=ord.status if ord else None,
                payment_method=ord.payment_method if ord else None,
                delivered_at=ord.delivered_at.isoformat() if ord and ord.delivered_at else None,
                hold_reason_code=code,
                hold_reason_title=title,
                hold_reason_detail=detail,
                blocking_reference=block_ref,
            )
        )

    commission_percent = get_platform_commission_percent()

    return {
        "gross_gmv": float(gross_gmv),
        "total_platform_fees": float(total_platform_fees),
        "total_net_earnings": float(total_net_earnings),
        "pending_payout": float(pending_payout),
        "escrow_balance": float(escrow_balance),
        "settled_payouts": float(settled_payouts),
        "online_gross_amount": float(online_gross_amount),
        "online_refunded_amount": float(online_refunded_amount),
        "online_net_amount": float(online_net_amount),
        "cod_gross_amount": float(cod_gross_amount),
        "cod_refunded_amount": float(cod_refunded_amount),
        "cod_net_amount": float(cod_net_amount),
        "cod_platform_fees_due": float(cod_platform_fees_due),
        "cod_platform_fees_cooling": float(cod_platform_fees_cooling),
        "cod_platform_fees_deducted": float(cod_platform_fees_deducted),
        "refund_gateway_fees_due": float(refund_gateway_fees_due),
        "total_dues_owed_to_platform": float(total_dues_owed_to_platform),
        "net_payable_to_merchant": float(net_payable_to_merchant),
        "platform_commission_percent": float(commission_percent),
        "total_orders_count": total_count,
        "bank_configured": bank_configured,
        "ledger_entries": serialized_entries,
        "total_pages": total_pages,
        "current_page": page,
    }


@router.get("/admin/{site_id}/earnings/export-csv")
@router.get("/admin/{site_id}/earnings-export-csv")
@router.get("/payments/earnings/{site_id}/export-csv")
@router.get("/earnings/{site_id}/export-csv")
def export_earnings_ledger_csv(
    site_id: UUID,
    search: Optional[str] = Query(None, description="Search term for order number, ID, transfer ID"),
    date_filter: Optional[str] = Query("all", description="all, today, last_7_days, last_30_days, custom"),
    status: Optional[str] = Query("all", description="all, in_escrow, paid, pending_cod, refunded"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("date_desc", description="date_desc, date_asc, amount_desc, amount_asc"),
    admin=Depends(require_permission("earnings:view")),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Exports filtered transaction-level ledger history with statutory fee & tax itemization.
    Uses memory-efficient chunked batch streaming to prevent server overload on large datasets.
    """
    import csv
    import io

    now = datetime.now(timezone.utc)

    # 1. Parse date boundaries
    from_dt, to_dt = None, None
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            try:
                from_dt = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except Exception:
                pass
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception:
            try:
                to_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
            except Exception:
                pass

    # 2. Build SQL query joined with Order
    query = (
        select(TenantLedgerEntry, Order)
        .outerjoin(Order, TenantLedgerEntry.order_id == Order.id)
        .where(
            TenantLedgerEntry.site_id == site_id,
            TenantLedgerEntry.status != "unpaid"
        )
    )

    if date_filter == "today":
        cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(TenantLedgerEntry.created_at >= cutoff)
    elif date_filter == "last_7_days":
        cutoff = now - timedelta(days=7)
        query = query.where(TenantLedgerEntry.created_at >= cutoff)
    elif date_filter == "last_30_days":
        cutoff = now - timedelta(days=30)
        query = query.where(TenantLedgerEntry.created_at >= cutoff)
    elif date_filter == "custom":
        if from_dt:
            query = query.where(TenantLedgerEntry.created_at >= from_dt)
        if to_dt:
            query = query.where(TenantLedgerEntry.created_at <= to_dt)

    if status and status != "all":
        if status == "paid":
            query = query.where(TenantLedgerEntry.status == "paid")
        elif status == "refunded":
            query = query.where(TenantLedgerEntry.status == "refunded")
        elif status == "in_escrow":
            query = query.where(TenantLedgerEntry.status.in_(["in_escrow", "held"]))
        elif status == "pending_cod":
            query = query.where(
                or_(
                    TenantLedgerEntry.status == "pending_cod",
                    Order.payment_method.ilike("%cod%"),
                    Order.payment_method.ilike("%cash%"),
                ),
                TenantLedgerEntry.status.in_(["in_escrow", "held", "pending_cod"])
            )

    if sort_by == "date_asc":
        query = query.order_by(TenantLedgerEntry.created_at.asc())
    elif sort_by == "amount_desc":
        query = query.order_by(TenantLedgerEntry.gross_amount.desc())
    elif sort_by == "amount_asc":
        query = query.order_by(TenantLedgerEntry.gross_amount.asc())
    else:  # date_desc
        query = query.order_by(TenantLedgerEntry.created_at.desc())

    search_q = (search or "").strip().lower().replace("#", "")

    # 3. Stream generator (chunked batching)
    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)

        # Header Row
        writer.writerow([
            "Order Number",
            "Order ID",
            "Transaction Date",
            "Payment Method",
            "Order Status",
            "Settlement Status",
            "Gross Order Value (INR)",
            "Taxable Product Value (INR)",
            "Product GST (INR)",
            "Platform Commission Base 3% (INR)",
            "GST on Platform Fee 18% SAC 9983 (INR)",
            "Total Platform Fee with GST (INR)",
            "Payment Gateway Fee Base (INR)",
            "GST on Gateway Fee 18% (INR)",
            "Total Payment Gateway Fee (INR)",
            "GST TCS Sec 52 0.50% (INR)",
            "Income Tax TDS Sec 194-O (INR)",
            "Net Merchant Payout (INR)",
            "Escrow Status",
            "Razorpay Transfer ID",
            "Settled At",
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        BATCH_SIZE = 1000
        offset = 0

        while True:
            batch_query = query.offset(offset).limit(BATCH_SIZE)
            batch = session.exec(batch_query).all()
            if not batch:
                break

            for item in batch:
                if isinstance(item, TenantLedgerEntry):
                    e = item
                    order_obj = session.get(Order, e.order_id) if getattr(e, "order_id", None) else None
                elif hasattr(item, "_mapping"):
                    e = item._mapping.get(TenantLedgerEntry) or item[0]
                    order_obj = item._mapping.get(Order) or (item[1] if len(item) > 1 else None)
                elif isinstance(item, (tuple, list)):
                    e = item[0]
                    order_obj = item[1] if len(item) > 1 else None
                else:
                    e = getattr(item, "TenantLedgerEntry", item)
                    order_obj = getattr(item, "Order", None)

                # Ensure e is a valid TenantLedgerEntry
                if not e or not hasattr(e, "gross_amount"):
                    continue

                order_id_val = getattr(e, "order_id", None)

                # In-memory search filtering if search term present
                if search_q:
                    ord_num = f"ORD-{str(order_id_val)[:8].upper()}" if order_id_val else ""
                    trf_id = (getattr(e, "razorpay_transfer_id", "") or "").lower()
                    amt_str = f"{float(e.gross_amount or 0):.2f}"
                    if (
                        search_q not in ord_num.lower()
                        and search_q not in str(order_id_val or "").lower()
                        and search_q not in trf_id
                        and search_q not in amt_str
                        and search_q not in (e.status or "").lower()
                    ):
                        continue

                order_num = f"ORD-{str(order_id_val)[:8].upper()}" if order_id_val else "N/A"
                raw_pm = getattr(order_obj, "payment_method", None) if order_obj else None
                is_cod = getattr(e, "status", "") == "pending_cod" or (raw_pm and any(k in raw_pm.lower() for k in ("cod", "cash", "offline", "collection")))
                pm_label = "COD Cash" if is_cod else ("Online (Razorpay)" if (raw_pm or (order_obj and getattr(order_obj, "razorpay_payment_id", None))) else "Online")
                ord_status = getattr(order_obj, "status", "placed") if order_obj else e.status

                gross_val = float(e.gross_amount or 0.0)
                taxable_val = float(getattr(e, "taxable_product_value", 0.0) or (gross_val / 1.18 if gross_val > 0 else 0.0))
                prod_gst = max(0.0, gross_val - taxable_val)

                plat_base = float(getattr(e, "platform_commission_base", 0.0) or (gross_val * 0.03))
                plat_cgst = float(getattr(e, "platform_fee_gst_cgst", 0.0) or 0.0)
                plat_sgst = float(getattr(e, "platform_fee_gst_sgst", 0.0) or 0.0)
                plat_igst = float(getattr(e, "platform_fee_gst_igst", 0.0) or 0.0)
                plat_gst = plat_cgst + plat_sgst + plat_igst
                if plat_gst == 0.0:
                    plat_gst = round(plat_base * 0.18, 2)
                total_plat = float(getattr(e, "total_platform_fee_with_gst", 0.0) or getattr(e, "platform_fee", 0.0) or (plat_base + plat_gst))

                gw_fee = float(getattr(e, "gateway_fee", 0.0) or (0.0 if is_cod else round(gross_val * 0.02, 2)))
                gw_gst = float(getattr(e, "gateway_fee_gst", 0.0) or (0.0 if is_cod else round(gw_fee * 0.18, 2)))
                total_gw = gw_fee + gw_gst

                tcs = float(getattr(e, "total_gst_tcs", 0.0) or (round(taxable_val * 0.005, 2) if not is_cod else 0.0))
                tds = float(getattr(e, "income_tax_tds_194o", 0.0) or 0.0)
                net_share = float(getattr(e, "net_merchant_payout", 0.0) or getattr(e, "tenant_share", 0.0) or (gross_val - total_plat - total_gw - tcs - tds))

                created_str = e.created_at.strftime("%Y-%m-%d %H:%M:%S") if isinstance(e.created_at, datetime) else str(e.created_at or "")[:19]
                settled_str = e.settled_at.strftime("%Y-%m-%d %H:%M:%S") if isinstance(e.settled_at, datetime) else str(e.settled_at or "")[:19]

                writer.writerow([
                    order_num,
                    str(e.order_id or ""),
                    created_str,
                    pm_label,
                    ord_status,
                    e.status,
                    f"{gross_val:.2f}",
                    f"{taxable_val:.2f}",
                    f"{prod_gst:.2f}",
                    f"{plat_base:.2f}",
                    f"{plat_gst:.2f}",
                    f"{total_plat:.2f}",
                    f"{gw_fee:.2f}",
                    f"{gw_gst:.2f}",
                    f"{total_gw:.2f}",
                    f"{tcs:.2f}",
                    f"{tds:.2f}",
                    f"{net_share:.2f}",
                    getattr(e, "escrow_status", "held"),
                    e.razorpay_transfer_id or "N/A",
                    settled_str,
                ])

            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            offset += len(batch)
            if len(batch) < BATCH_SIZE:
                break

    filename = f"Earnings_Ledger_{str(site_id)[:8]}_{now.strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/admin/{site_id}/payouts/create")
def record_payout(
    site_id: UUID,
    payload: CreatePayoutRecordRequest,
    admin=Depends(require_permission("payout_settings:edit")),
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

    try:
        AuditService.log_event(
            session=session,
            site_id=site_id,
            actor_type=ActorType.OWNER if (admin.get("role") or "").lower() == "owner" else ActorType.TEAM_MEMBER,
            actor_id=admin_id,
            actor_name=admin.get("name"),
            actor_email=admin.get("email"),
            actor_role=admin.get("role") or "Staff",
            category=AuditCategory.EARNINGS_LEDGER,
            action="payout.initiated",
            source=SourceType.WEB_ADMIN,
            resource_type="payout",
            resource_id=str(payout.id),
            resource_name=f"Payout #{str(payout.id)[:8].upper()}",
            summary=f"Recorded manual payout of ₹{float(payout.amount):,.2f} (UTR: {payload.utr_reference or 'N/A'})",
            metadata={
                "financial": True,
                "amount": float(payout.amount),
                "currency": "INR",
                "reference_id": payload.utr_reference,
                "payout_method": payout.payout_method,
            },
        )
    except Exception as log_err:
        logger.warning("Failed to log payout.initiated audit event: %s", log_err)

    return {
        "message": "Payout recorded successfully",
        "payout_id": str(payout.id),
        "amount": float(payout.amount),
        "status": payout.status,
    }
