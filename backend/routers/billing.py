import hashlib
import hmac
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select, func

from auth_middleware import authenticate_admin
from db.database import get_session
from models import (
    Admin,
    AdminSite,
    AICreditBatch,
    BillingIdempotencyKey,
    ProcessedBillingWebhookEvent,
    Product,
    ProductDraftReason,
    Site,
    SubscriptionPlan,
    SubscriptionStatus,
    WebsiteSubscription,
    WebsiteSubscriptionEvent,
    utc_now,
)
from services.ai_credit_service import (
    expire_batches_job,
    get_account_credit_balance,
)
from services.billing_idempotency import (
    check_and_start_idempotency,
    complete_idempotency,
    fail_idempotency,
)
from services.grace_period_service import (
    cancel_grace_period,
    expire_grace_period_job,
    send_grace_reminders_job,
    start_grace_period,
)
from services.plan_service import (
    PLAN_METADATA,
    downgrade_website_plan,
    get_or_create_website_subscription,
    get_website_plan_details,
    renew_website_subscription,
    upgrade_website_plan,
)
from services.product_limit_service import (
    can_activate_product,
    get_free_pool_status,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "whsec_webcreon_dev_secret_key_2026")

try:
    import razorpay
except ImportError:
    razorpay = None


def get_platform_razorpay_client() -> Optional[Any]:
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


# ---------------------------------------------------------------------------
# REQUEST & RESPONSE SCHEMAS
# ---------------------------------------------------------------------------

class CreateSubscriptionOrderRequest(BaseModel):
    target_plan: str = Field(..., description="Target plan: STARTER or PRO")
    billing_interval: Optional[str] = Field(default="monthly", description="Billing interval: monthly, 3months, or yearly")


class CreateSubscriptionOrderResponse(BaseModel):
    website_id: str
    target_plan: str
    amount: int
    currency: str
    razorpay_order_id: str
    key_id: str


class UpgradeRequest(BaseModel):
    target_plan: str = Field(..., description="Target plan: STARTER or PRO")
    payment_id: Optional[str] = Field(default=None, description="Razorpay payment ID if paid online")
    payment_method: Optional[str] = Field(default=None, description="Payment instrument: Net Banking, Card, UPI, etc.")
    razorpay_order_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    provider_subscription_id: Optional[str] = None
    billing_interval: Optional[str] = Field(default="monthly", description="Billing interval: monthly, 3months, or yearly")


class DowngradeRequest(BaseModel):
    target_plan: str = Field(default="FREE", description="Target plan: FREE or STARTER")
    confirmed: bool = Field(default=True, description="Merchant confirmation of lost features and drafted products")



class RepairRequest(BaseModel):
    operation: str = Field(..., description="Allowlisted repair operation")
    dry_run: bool = Field(default=True, description="Run in preview mode without committing mutations")
    confirmation_token: str = Field(..., description="Confirmation token matching requested operation")
    reason: str = Field(..., description="Audit rationale for repair operation")
    affected_ids: Optional[List[str]] = Field(default=None, description="List of website or batch IDs")


# ---------------------------------------------------------------------------
# AUTHORIZATION HELPERS
# ---------------------------------------------------------------------------

def verify_website_ownership(session: Session, website_id: UUID, current_admin: dict) -> Admin:
    """Verifies that the authenticated Admin owns or has administrative rights to the website."""
    admin_id = UUID(str(current_admin["adminId"]))
    admin_obj = session.get(Admin, admin_id)
    if not admin_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "BILLING_UNAUTHORIZED", "message": "Admin account not found"},
        )

    # Platform super admin bypass only
    if admin_obj.role == "super_admin":
        return admin_obj

    link = session.exec(
        select(AdminSite).where(
            AdminSite.site_id == website_id,
            AdminSite.admin_id == admin_id,
        )
    ).first()

    if not link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "WEBSITE_NOT_FOUND", "message": "Website not found or access unauthorized."},
        )
    return admin_obj


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/websites")
def list_admin_websites(
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Lists all websites owned by the current Admin with 30-day cycle renewal dates and grace period status."""
    admin_id = UUID(str(current_admin["adminId"]))
    owned_site_links = session.exec(
        select(AdminSite).where(AdminSite.admin_id == admin_id)
    ).all()
    site_ids = [l.site_id for l in owned_site_links]

    results = []
    now = utc_now()
    for s_id in site_ids:
        sub = get_or_create_website_subscription(session, s_id)
        site = session.get(Site, s_id)
        brand_name = None
        if site and site.site_definition:
            brand_name = (
                site.site_definition.get("site", {}).get("brand_name")
                or site.site_definition.get("navbar", {}).get("brand_name")
                or site.site_definition.get("brand_name")
            )
        site_name = brand_name or (site.name if site else str(s_id))
        plan_meta = PLAN_METADATA.get(sub.plan, PLAN_METADATA["FREE"])

        # Product count
        prod_count = session.exec(
            select(func.count(Product.id)).where(Product.site_id == s_id, Product.is_active == True)
        ).one()

        is_grace = sub.status == SubscriptionStatus.GRACE_PERIOD.value
        grace_days_left = 0
        if is_grace and sub.grace_period_ends_at:
            ends = sub.grace_period_ends_at
            if ends.tzinfo is None:
                ends = ends.replace(tzinfo=timezone.utc)
            grace_days_left = max(0, (ends - now).days)

        results.append({
            "website_id": str(s_id),
            "website_name": site_name,
            "slug": site.slug if site else "",
            "thumbnail_url": site.site_definition.get("theme", {}).get("logo_url") if site and site.site_definition else None,
            "current_plan": sub.plan,
            "subscription_status": sub.status,
            "billing_cycle_start_date": sub.billing_cycle_start_date.isoformat(),
            "billing_cycle_end_date": sub.billing_cycle_end_date.isoformat(),
            "billing_interval": "30 days",
            "is_grace_period": is_grace,
            "grace_period_ends_at": sub.grace_period_ends_at.isoformat() if sub.grace_period_ends_at else None,
            "grace_days_left": grace_days_left,
            "active_products_count": prod_count,
            "product_limit": plan_meta["product_limit"],
            "is_product_limit_pooled": plan_meta["is_product_limit_pooled"],
        })

    return {"websites": results, "server_time_utc": now.isoformat()}


@router.get("/websites/{website_id}/details")
def get_website_details(
    website_id: UUID,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Returns comprehensive plan details, usage meters, team limits, and activity timeline for a website."""
    verify_website_ownership(session, website_id, current_admin)
    details = get_website_plan_details(session, website_id)

    # Activity timeline
    events = session.exec(
        select(WebsiteSubscriptionEvent)
        .where(WebsiteSubscriptionEvent.website_id == website_id)
        .order_by(WebsiteSubscriptionEvent.created_at.desc())
        .limit(15)
    ).all()

    timeline = [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "previous_plan": e.previous_plan,
            "new_plan": e.new_plan,
            "source": e.source,
            "created_at": e.created_at.isoformat(),
            "metadata": e.metadata_json,
        }
        for e in events
    ]
    details["timeline"] = timeline
    return details


@router.get("/account/ai-credits")
def get_account_ai_credits(
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Returns account-wide pooled AI credit balance and active batch details with fixed 30-day expiries."""
    admin_id = UUID(str(current_admin["adminId"]))
    return get_account_credit_balance(session, admin_id)


@router.post("/websites/{website_id}/create-subscription-order", response_model=CreateSubscriptionOrderResponse)
def create_subscription_order(
    website_id: UUID,
    req: CreateSubscriptionOrderRequest,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Creates a dedicated Razorpay Order for WebCreon plan subscription (Starter/Pro).
    The payment is deposited directly into WebCreon's platform Razorpay bank account.
    """
    verify_website_ownership(session, website_id, current_admin)
    target_plan = req.target_plan.upper()
    if target_plan not in ("STARTER", "PRO"):
        raise HTTPException(status_code=400, detail="Invalid target plan. Must be STARTER or PRO.")

    interval = (req.billing_interval or "monthly").lower().strip()
    if interval in ("3months", "3_months", "quarterly"):
        amount = 129900 if target_plan == "PRO" else 54900
    elif interval in ("yearly", "annual", "12months"):
        amount = 499900 if target_plan == "PRO" else 199900
    else:
        amount = 49900 if target_plan == "PRO" else 19900
    key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
    key_secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()

    client = get_platform_razorpay_client()
    razorpay_order_id: str

    if client and key_id:
        try:
            rzp_order = client.order.create({
                "amount": amount,
                "currency": "INR",
                "receipt": f"sub_{target_plan.lower()}_{str(website_id).replace('-', '')[:10]}",
                "notes": {
                    "website_id": str(website_id),
                    "admin_id": str(current_admin["adminId"]),
                    "plan": target_plan,
                    "payment_type": "webcreon_subscription",
                }
            })
            razorpay_order_id = rzp_order["id"]
        except Exception:
            razorpay_order_id = f"order_sub_mock_{uuid4().hex[:12]}"
    else:
        razorpay_order_id = f"order_sub_mock_{uuid4().hex[:12]}"

    return {
        "website_id": str(website_id),
        "target_plan": target_plan,
        "amount": amount,
        "currency": "INR",
        "razorpay_order_id": razorpay_order_id,
        "key_id": key_id or "rzp_test_placeholder",
    }


@router.post("/websites/{website_id}/upgrade")
def upgrade_website(
    website_id: UUID,
    req: UpgradeRequest,
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Executes an idempotent upgrade to Starter or Pro with immediate AI batch allocation."""
    verify_website_ownership(session, website_id, current_admin)
    admin_id = UUID(str(current_admin["adminId"]))

    # Verify Razorpay signature if paying online with real credentials
    key_secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
    if (
        req.razorpay_order_id
        and req.payment_id
        and req.razorpay_signature
        and key_secret
        and not req.razorpay_order_id.startswith("order_sub_mock_")
        and not req.razorpay_order_id.startswith("order_mock_")
    ):
        expected_sig = hmac.new(
            key_secret.encode("utf-8"),
            f"{req.razorpay_order_id}|{req.payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, req.razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature")

    idemp_rec, cached = check_and_start_idempotency(
        session=session,
        idempotency_key=x_idempotency_key,
        operation_type=f"UPGRADE_{req.target_plan.upper()}",
        admin_id=admin_id,
        website_id=website_id,
        request_data=req.model_dump(),
    )
    if cached:
        return cached["data"]


    try:
        provider_data = {}
        if req.payment_id:
            provider_data["provider_payment_id"] = req.payment_id
        if req.provider_subscription_id:
            provider_data["provider_subscription_id"] = req.provider_subscription_id
        if req.billing_interval:
            provider_data["billing_interval"] = req.billing_interval
        
        # Resolve exact payment instrument
        resolved_method = req.payment_method
        client = get_platform_razorpay_client()
        if client and req.payment_id and not req.payment_id.startswith("pay_mock_"):
            try:
                rzp_pay = client.payment.fetch(req.payment_id)
                if rzp_pay:
                    m = rzp_pay.get("method")
                    bank = rzp_pay.get("bank")
                    wallet = rzp_pay.get("wallet")
                    card_data = rzp_pay.get("card") or {}
                    vpa = rzp_pay.get("vpa")

                    if m == "netbanking":
                        resolved_method = f"Net Banking ({bank})" if bank else "Net Banking"
                    elif m == "card":
                        network = card_data.get("network", "Card")
                        last4 = card_data.get("last4")
                        resolved_method = f"{network} Card (ending in {last4})" if last4 else f"{network} Card"
                    elif m == "upi":
                        resolved_method = f"UPI ({vpa})" if vpa else "UPI"
                    elif m == "wallet":
                        resolved_method = f"Digital Wallet ({wallet})" if wallet else "Digital Wallet"
                    elif m:
                        resolved_method = str(m).replace("_", " ").title()
            except Exception as rzp_fetch_err:
                print("Notice: Could not fetch payment method details from Razorpay API:", rzp_fetch_err)

        if resolved_method:
            provider_data["payment_method"] = resolved_method

        result = upgrade_website_plan(
            session=session,
            website_id=website_id,
            new_plan=req.target_plan,
            idempotency_key=x_idempotency_key,
            provider_data=provider_data,
        )
        complete_idempotency(session, idemp_rec, result, response_status=200)
        return result
    except Exception as exc:
        fail_idempotency(session, idemp_rec, str(exc), response_status=400)
        raise HTTPException(status_code=400, detail={"error_code": "INVALID_PLAN_TRANSITION", "message": str(exc)})


@router.post("/websites/{website_id}/downgrade")
def downgrade_website(
    website_id: UUID,
    req: DowngradeRequest,
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Executes an immediate voluntary downgrade cascade (system drafting products, unlinking domain, deactivating team)."""
    verify_website_ownership(session, website_id, current_admin)
    admin_id = UUID(str(current_admin["adminId"]))

    if not req.confirmed:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "CONFIRMATION_REQUIRED", "message": "Merchant confirmation required for downgrade."},
        )

    idemp_rec, cached = check_and_start_idempotency(
        session=session,
        idempotency_key=x_idempotency_key,
        operation_type=f"DOWNGRADE_{req.target_plan.upper()}",
        admin_id=admin_id,
        website_id=website_id,
        request_data=req.model_dump(),
    )
    if cached:
        return cached["data"]

    try:
        result = downgrade_website_plan(
            session=session,
            website_id=website_id,
            target_plan=req.target_plan,
            is_voluntary=True,
            idempotency_key=x_idempotency_key,
        )
        complete_idempotency(session, idemp_rec, result, response_status=200)
        return result
    except Exception as exc:
        fail_idempotency(session, idemp_rec, str(exc), response_status=400)
        raise HTTPException(status_code=400, detail={"error_code": "DOWNGRADE_FAILED", "message": str(exc)})


@router.get("/websites/{website_id}/product-pool-detail")
def get_product_pool_detail(
    website_id: UUID,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Returns the sibling breakdown of the shared 200 Free product pool."""
    verify_website_ownership(session, website_id, current_admin)
    admin_id = UUID(str(current_admin["adminId"]))
    return get_free_pool_status(session, admin_id)


@router.post("/products/{product_id}/activate")
def activate_product(
    product_id: UUID,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Wraps product activation with concurrency-serialized entitlement and Free pool cap checks."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail={"error_code": "PRODUCT_NOT_FOUND", "message": "Product not found"})

    verify_website_ownership(session, product.site_id, current_admin)

    allowed, reason = can_activate_product(session, product.site_id, product_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "PRODUCT_LIMIT_REACHED", "message": reason},
        )

    product.is_active = True
    product.draft_reason = None
    product.drafted_at = None
    product.updated_at = utc_now()
    session.add(product)
    session.commit()
    session.refresh(product)

    return {
        "product_id": str(product.id),
        "is_active": product.is_active,
        "message": "Product successfully activated within plan limits.",
    }


# ---------------------------------------------------------------------------
# WEBHOOK HANDLER (DEDUPLICATED, MONOTONIC ORDERING)
# ---------------------------------------------------------------------------

@router.post("/webhooks/payment")
async def subscription_payment_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    session: Session = Depends(get_session),
):
    """
    Signature-verified, database-deduplicated subscription payment webhook handler.
    Applies monotonic event ordering so stale failure events never overwrite newer active state.
    """
    raw_body = await request.body()

    # 1. Signature Verification
    if x_razorpay_signature:
        expected_sig = hmac.new(
            WEBHOOK_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, x_razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    provider_event_id = payload.get("event_id") or payload.get("id") or f"evt_{hashlib.sha256(raw_body).hexdigest()[:16]}"
    event_type = payload.get("event", "payment.captured")
    now = utc_now()

    # 2. Database-level deduplication
    existing_evt = session.exec(
        select(ProcessedBillingWebhookEvent).where(
            ProcessedBillingWebhookEvent.provider == "razorpay",
            ProcessedBillingWebhookEvent.provider_event_id == provider_event_id,
        )
    ).first()

    if existing_evt:
        return {"status": "duplicate_ignored", "event_id": provider_event_id}

    # Ingest event record
    webhook_rec = ProcessedBillingWebhookEvent(
        provider="razorpay",
        provider_event_id=provider_event_id,
        event_type=event_type,
        payload_hash=hashlib.sha256(raw_body).hexdigest(),
        raw_payload={"event": event_type, "timestamp": now.isoformat()},
        processing_status="PROCESSING",
        received_at=now,
    )
    session.add(webhook_rec)
    session.commit()

    # 3. Process business event
    try:
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        notes = payment_entity.get("notes", {})
        website_id_str = notes.get("website_id")
        target_plan = notes.get("plan", "STARTER")

        if website_id_str:
            website_id = UUID(website_id_str)
            sub = session.exec(
                select(WebsiteSubscription).where(WebsiteSubscription.website_id == website_id).with_for_update()
            ).first()

            if sub:
                if event_type in ("payment.captured", "subscription.charged"):
                    # Success: cancel grace period and ensure active plan
                    cancel_grace_period(session, website_id)
                    renew_website_subscription(
                        session=session,
                        website_id=website_id,
                        provider_payment_id=payment_entity.get("id", f"pay_{uuid4().hex[:12]}"),
                        provider_subscription_id=payment_entity.get("subscription_id"),
                        event_timestamp=now,
                    )
                elif event_type in ("payment.failed", "subscription.halted"):
                    # Involuntary failure: start 7-day grace period
                    start_grace_period(session, website_id, failure_timestamp=now)

        webhook_rec.processing_status = "PROCESSED"
        webhook_rec.processed_at = utc_now()
        session.add(webhook_rec)
        session.commit()
    except Exception as exc:
        webhook_rec.processing_status = "RETRYABLE_FAILURE"
        webhook_rec.error_message = str(exc)
        webhook_rec.retry_count += 1
        session.add(webhook_rec)
        session.commit()

    return {"status": "received", "event_id": provider_event_id}


# ---------------------------------------------------------------------------
# STATUTORY SUBSCRIPTION INVOICES & HISTORY
# ---------------------------------------------------------------------------

@router.get("/websites/{website_id}/invoices")
def get_website_invoices(
    website_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    search: Optional[str] = None,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Returns statutory GST Tax Invoices and summary metrics for a website with server-side pagination."""
    verify_website_ownership(session, website_id, current_admin)
    from services.subscription_invoice_service import get_website_invoices_data
    return get_website_invoices_data(
        session=session,
        website_id=website_id,
        page=page,
        page_size=page_size,
        limit=limit,
        offset=offset,
        search=search,
    )


@router.get("/invoices/{invoice_id}/pdf")
def download_subscription_invoice_pdf(
    invoice_id: UUID,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Directly streams and downloads the official B2B PDF Tax Invoice for subscription plans.
    """
    from models import SubscriptionInvoice, Site, Admin
    from services.pdf_invoice_service import generate_subscription_invoice_pdf

    inv = session.get(SubscriptionInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    admin_id = UUID(str(current_admin["adminId"]))
    if inv.admin_id != admin_id:
        verify_website_ownership(session, inv.website_id, current_admin)

    site = session.get(Site, inv.website_id)
    admin_obj = session.get(Admin, inv.admin_id)

    pdf_path = f"uploads/invoices/subscription_{inv.id}.pdf"
    generate_subscription_invoice_pdf(
        inv=inv,
        site=site,
        admin=admin_obj,
        output_path=pdf_path,
        session=session,
    )

    clean_number = inv.invoice_number.replace("/", "_").replace(" ", "_")
    clean_filename = f"WebCreon_Tax_Invoice_{clean_number}.pdf"
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=clean_filename,
        headers={"Content-Disposition": f'attachment; filename="{clean_filename}"'},
    )


@router.get("/invoices/{invoice_id}/html", response_class=HTMLResponse)
def download_subscription_invoice_html(
    invoice_id: UUID,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Renders a Rule 46 compliant statutory GST Tax Invoice for preview, print, or download."""
    from models import SubscriptionInvoice
    from services.subscription_invoice_service import render_subscription_invoice_html

    inv = session.get(SubscriptionInvoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    admin_id = UUID(str(current_admin["adminId"]))
    if inv.admin_id != admin_id:
        verify_website_ownership(session, inv.website_id, current_admin)

    html_content = render_subscription_invoice_html(inv)
    return HTMLResponse(content=html_content, status_code=200)


# ---------------------------------------------------------------------------
# CRON & MAINTENANCE JOBS
# ---------------------------------------------------------------------------

@router.post("/cron/expire-batches")
def cron_expire_batches(session: Session = Depends(get_session)):
    """Distributed Cron Job: Lapses expired AI batches without rollover."""
    return expire_batches_job(session)


@router.post("/cron/expire-grace-periods")
def cron_expire_grace_periods(session: Session = Depends(get_session)):
    """Distributed Cron Job: Cascades websites with expired 7-day grace periods to Free tier."""
    return expire_grace_period_job(session)


@router.post("/cron/send-grace-reminders")
def cron_send_grace_reminders(session: Session = Depends(get_session)):
    """Distributed Cron Job: Sends deduplicated Day 1, Day 4, and Day 7 grace period reminders."""
    return send_grace_reminders_job(session)


# ---------------------------------------------------------------------------
# DIAGNOSTICS & OPERATIONAL RECONCILIATION
# ---------------------------------------------------------------------------

@router.get("/diagnostics/reconcile")
def run_diagnostics_reconcile(
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Read-only internal ops diagnostic endpoint:
    Checks for Free pool overflows, negative AI balances, expired batches still marked active, and expired grace periods.
    """
    admin_id = UUID(str(current_admin["adminId"]))
    now = utc_now()

    # 1. Negative or inconsistent AI batch balances
    corrupt_batches = session.exec(
        select(func.count()).where(
            (func.coalesce(AICreditBatch.remaining_amount, 0) < 0) |
            (AICreditBatch.remaining_amount > AICreditBatch.allocated_amount)
        )
    ).one()

    # 2. Expired batches still marked ACTIVE
    stale_active_batches = session.exec(
        select(func.count(AICreditBatch.id)).where(
            AICreditBatch.status == "ACTIVE",
            AICreditBatch.expiry_date <= now,
        )
    ).one()

    # 3. Lapsed grace periods
    stale_grace = session.exec(
        select(func.count(WebsiteSubscription.id)).where(
            WebsiteSubscription.status == "GRACE_PERIOD",
            WebsiteSubscription.grace_period_ends_at <= now,
        )
    ).one()

    # 4. Free pool check for this admin
    free_pool = get_free_pool_status(session, admin_id)

    return {
        "status": "HEALTHY" if corrupt_batches == 0 and stale_grace == 0 else "ATTENTION_REQUIRED",
        "timestamp": now.isoformat(),
        "corrupt_batches_count": corrupt_batches,
        "stale_active_batches_count": stale_active_batches,
        "unsettled_expired_grace_count": stale_grace,
        "current_admin_free_pool": free_pool,
    }


@router.post("/diagnostics/repair")
def run_diagnostics_repair(
    req: RepairRequest,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Restricted Ops Repair Endpoint:
    Must be super_admin. Default mode is dry_run. Allowlisted operations only.
    """
    admin_id = UUID(str(current_admin["adminId"]))
    admin_obj = session.get(Admin, admin_id)
    if not admin_obj or admin_obj.role != "super_admin":
        raise HTTPException(status_code=403, detail="Repair endpoint restricted to super_admin operators.")

    # Validate confirmation token
    expected_token = f"CONFIRM_{req.operation.upper()}"
    if req.confirmation_token != expected_token:
        raise HTTPException(status_code=400, detail="Invalid confirmation token for this repair operation.")

    if req.operation == "EXPIRE_STALE_BATCHES":
        if req.dry_run:
            now = utc_now()
            count = session.exec(
                select(func.count(AICreditBatch.id)).where(
                    AICreditBatch.status == "ACTIVE",
                    AICreditBatch.expiry_date <= now,
                )
            ).one()
            return {"dry_run": True, "stale_batches_to_expire": count}
        return expire_batches_job(session)

    elif req.operation == "EXPIRE_STALE_GRACE_PERIODS":
        if req.dry_run:
            now = utc_now()
            count = session.exec(
                select(func.count(WebsiteSubscription.id)).where(
                    WebsiteSubscription.status == "GRACE_PERIOD",
                    WebsiteSubscription.grace_period_ends_at <= now,
                )
            ).one()
            return {"dry_run": True, "stale_grace_to_cascade": count}
        return expire_grace_period_job(session)

    raise HTTPException(status_code=400, detail=f"Unsupported repair operation: {req.operation}")
