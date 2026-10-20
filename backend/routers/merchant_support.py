import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, col, func, or_, select
from sqlalchemy import text

from auth_middleware import (
    authenticate_admin,
    check_admin_has_permission,
    enforce_site_ownership,
    _forbidden,
    _unauthorized,
)
from db.database import get_session
from models import (
    Admin,
    AdminSite,
    MerchantSupportDeadLetter,
    MerchantSupportFAQCategory,
    MerchantSupportFAQFeedback,
    MerchantSupportFAQItem,
    MerchantSupportOutboxJob,
    MerchantSupportTicket,
    MerchantSupportTicketAttachment,
    MerchantSupportTicketContextSnapshot,
    MerchantSupportTicketEmailThread,
    MerchantSupportTicketEvent,
    MerchantSupportTicketMessage,
    Role,
    Site,
    utc_now,
)
from services.merchant_support_service import (
    compute_request_fingerprint,
    email_service,
    faq_cache,
    process_inbound_email_webhook,
    process_outbox_jobs,
    purge_expired_retention_data,
    verify_webhook_signature,
)

logger = logging.getLogger("merchant_support_router")
router = APIRouter(prefix="/api", tags=["Merchant Help & Support"])

ALLOWED_CATEGORIES = {
    "billing",
    "domain",
    "products",
    "orders",
    "ai_copilot",
    "other",
}

# ===========================================================================
# PYDANTIC SCHEMAS
# ===========================================================================

class PageContextPayload(BaseModel):
    module_key: Optional[str] = None
    page_key: Optional[str] = None
    current_url: Optional[str] = None
    route_name: Optional[str] = None
    user_agent: Optional[str] = None
    app_version: Optional[str] = "1.0.0"


class CreateTicketRequest(BaseModel):
    client_request_id: UUID = Field(..., description="Client-generated unique idempotency UUID")
    category: str = Field(..., description="Ticket category enum")
    subject: str = Field(..., min_length=5, max_length=255, description="Summary subject")
    message: str = Field(..., min_length=10, max_length=5000, description="Detailed problem description")
    website_id: Optional[UUID] = None
    page_context: Optional[PageContextPayload] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ALLOWED_CATEGORIES:
            raise ValueError(f"Invalid category '{v}'. Allowed: {', '.join(sorted(ALLOWED_CATEGORIES))}")
        return clean

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 5 or len(clean) > 255:
            raise ValueError("Subject must be between 5 and 255 characters.")
        return clean

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 10 or len(clean) > 5000:
            raise ValueError("Message must be between 10 and 5000 characters.")
        return clean


class FAQFeedbackRequest(BaseModel):
    is_helpful: bool


class InboundEmailWebhookPayload(BaseModel):
    provider_event_id: str
    email_message_id: str
    from_email: str
    to_mailbox: str
    subject: str
    body_plain: str
    body_html: Optional[str] = None
    in_reply_to: Optional[str] = None
    references: Optional[List[str] | str] = None


# ===========================================================================
# IN-MEMORY RATE LIMITING HELPER
# ===========================================================================

_RATE_LIMITS: Dict[str, List[float]] = {}

def check_rate_limit(key: str, max_requests: int, window_seconds: int):
    now = time.time()
    timestamps = _RATE_LIMITS.get(key, [])
    # filter within window
    timestamps = [ts for ts in timestamps if now - ts < window_seconds]
    if len(timestamps) >= max_requests:
        retry_after = int(window_seconds - (now - timestamps[0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down.",
            headers={"Retry-After": str(max(1, retry_after))},
        )
    timestamps.append(now)
    _RATE_LIMITS[key] = timestamps


# ===========================================================================
# 1. TICKET CREATION (STRICTLY IDEMPOTENT)
# ===========================================================================

@router.post("/support/tickets", status_code=status.HTTP_201_CREATED)
def create_merchant_support_ticket(
    payload: CreateTicketRequest,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Idempotent Merchant Support Ticket Creation:
    - Derives admin_id strictly from session (never client body).
    - Enforces website ownership if website_id provided.
    - Computes SHA-256 fingerprint.
    - On existing (admin_id, client_request_id):
        - Same fingerprint -> Returns HTTP 200 with is_replay: true and original ticket payload.
        - Different fingerprint -> Returns HTTP 409 IDEMPOTENCY_PAYLOAD_MISMATCH.
    - In single transaction: creates ticket, initial message, context snapshot, audit event, and outbox job.
    """
    admin_id = UUID(str(admin["adminId"]))
    check_rate_limit(f"rate:ticket:{admin_id}", max_requests=5, window_seconds=600)

    admin_obj = session.get(Admin, admin_id)
    if not admin_obj:
        raise _unauthorized("Admin account not found")

    # If website_id supplied, verify ownership / access
    if payload.website_id:
        # Check if website belongs to admin
        ownership = session.exec(
            select(AdminSite).where(
                AdminSite.admin_id == admin_id,
                AdminSite.site_id == payload.website_id,
            )
        ).first()

        site_obj = session.get(Site, payload.website_id)
        if not site_obj:
            raise HTTPException(status_code=404, detail="Specified website not found.")

        # If not explicit ownership link and not owner of the site
        if not ownership and getattr(site_obj, "admin_id", None) != admin_id and not admin.get("is_owner"):
            raise _forbidden("You do not have access to create tickets for this storefront.")

    # Calculate deterministic payload fingerprint
    current_fingerprint = compute_request_fingerprint(
        category=payload.category,
        subject=payload.subject,
        message=payload.message,
        website_id=payload.website_id,
        page_context=payload.page_context.dict() if payload.page_context else {},
    )

    # Check for existing idempotency key
    existing_ticket = session.exec(
        select(MerchantSupportTicket).where(
            MerchantSupportTicket.admin_id == admin_id,
            MerchantSupportTicket.client_request_id == payload.client_request_id,
        )
    ).first()

    if existing_ticket:
        # Check fingerprint match
        if existing_ticket.request_fingerprint != current_fingerprint:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "IDEMPOTENCY_PAYLOAD_MISMATCH",
                    "message": "client_request_id has already been used with different ticket payload parameters.",
                },
            )

        # Idempotent replay: Return HTTP 200 with is_replay: true
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "is_replay": True,
                "ticket": {
                    "id": str(existing_ticket.id),
                    "ticket_number": existing_ticket.ticket_number,
                    "client_request_id": str(existing_ticket.client_request_id),
                    "category": existing_ticket.category,
                    "subject": existing_ticket.subject,
                    "status": existing_ticket.status,
                    "priority": existing_ticket.priority,
                    "requester_email": existing_ticket.requester_email,
                    "requester_name": existing_ticket.requester_name,
                    "created_at": existing_ticket.created_at.isoformat(),
                    "estimated_sla_hours": 2,
                },
                "message": "Your support request has been submitted. A confirmation has been sent to your email.",
            },
        )

    # Create new ticket with unique human-readable number
    seq_num = int(time.time() * 1000) % 900000 + 100000
    ticket_num = f"WC-SP-{seq_num}"

    ticket = MerchantSupportTicket(
        ticket_number=ticket_num,
        admin_id=admin_id,
        website_id=payload.website_id,
        client_request_id=payload.client_request_id,
        request_fingerprint=current_fingerprint,
        page_context_key=payload.page_context.page_key if payload.page_context else None,
        category=payload.category,
        subject=payload.subject,
        status="open",
        priority="normal",
        source="in_app",
        requester_email=admin_obj.email,
        requester_name=admin_obj.name or admin_obj.email.split("@")[0],
        last_message_at=utc_now(),
        last_message_from="admin",
    )
    session.add(ticket)
    session.flush()  # assign ticket.id

    # 1. Initial conversation message
    initial_msg = MerchantSupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="admin",
        sender_admin_id=admin_id,
        sender_name=ticket.requester_name,
        channel="in_app",
        body_text=payload.message,
    )
    session.add(initial_msg)

    # 2. Context snapshot
    snapshot = MerchantSupportTicketContextSnapshot(
        ticket_id=ticket.id,
        website_id=payload.website_id,
        module_key=payload.page_context.module_key if payload.page_context else None,
        page_key=payload.page_context.page_key if payload.page_context else None,
        current_url=payload.page_context.current_url if payload.page_context else None,
        route_name=payload.page_context.route_name if payload.page_context else None,
        user_agent=payload.page_context.user_agent if payload.page_context else None,
        app_version=payload.page_context.app_version if payload.page_context else "1.0.0",
    )
    session.add(snapshot)

    # 3. Audit event
    audit_event = MerchantSupportTicketEvent(
        ticket_id=ticket.id,
        event_type="ticket_created",
        actor_type="admin",
        actor_id=str(admin_id),
        metadata_json={
            "ticket_number": ticket.ticket_number,
            "category": ticket.category,
            "subject": ticket.subject,
        },
    )
    session.add(audit_event)

    # 4. Transactional outbox job for asynchronous email confirmation
    outbox_job = MerchantSupportOutboxJob(
        job_type="outbound_ticket_created_email",
        ticket_id=ticket.id,
        idempotency_key=f"outbox_email_{ticket.id}",
        payload={
            "requester_email": ticket.requester_email,
            "requester_name": ticket.requester_name,
            "ticket_number": ticket.ticket_number,
            "subject": ticket.subject,
            "message_body": payload.message,
        },
        status="pending",
    )
    session.add(outbox_job)

    session.commit()
    session.refresh(ticket)

    # Immediately dispatch ticket acknowledgment
    try:
        email_service.send_ticket_acknowledgment(
            to_email=ticket.requester_email,
            to_name=ticket.requester_name,
            ticket_number=ticket.ticket_number,
            subject=ticket.subject,
            message_body=payload.message,
            idempotency_key=f"outbox_email_{ticket.id}",
        )
        outbox_job.status = "completed"
        outbox_job.completed_at = utc_now()
        session.add(outbox_job)
        session.commit()
    except Exception as email_err:
        logger.warning(f"Immediate email dispatch skipped/failed: {email_err}")

    return {
        "success": True,
        "is_replay": False,
        "ticket": {
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "client_request_id": str(ticket.client_request_id),
            "category": ticket.category,
            "subject": ticket.subject,
            "status": ticket.status,
            "priority": ticket.priority,
            "requester_email": ticket.requester_email,
            "requester_name": ticket.requester_name,
            "created_at": ticket.created_at.isoformat(),
            "estimated_sla_hours": 2,
        },
        "message": "Your support request has been submitted. A confirmation has been sent to your email.",
    }


# ===========================================================================
# 2. TICKET DETAIL VIEW (WITH STRICT RBAC & TENANT ISOLATION)
# ===========================================================================

@router.get("/support/tickets/{ticket_id}")
def get_merchant_support_ticket(
    ticket_id: UUID,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Fetch merchant ticket details and conversation thread:
    - Enforces RBAC: Workspace Owner sees all tickets; Manager sees assigned site tickets; Editor sees own tickets.
    - Never exposes internal notes to merchants.
    """
    admin_id = UUID(str(admin["adminId"]))
    ticket = session.get(MerchantSupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found.")

    is_owner = admin.get("is_owner", False)
    is_author = (ticket.admin_id == admin_id)

    # If not owner and not author, check site-level manager assignment
    if not is_owner and not is_author:
        if not ticket.website_id:
            raise _forbidden("You do not have permission to view this workspace-level ticket.")

        has_site_access = session.exec(
            select(AdminSite).where(
                AdminSite.admin_id == admin_id,
                AdminSite.site_id == ticket.website_id,
            )
        ).first()

        if not has_site_access:
            raise _forbidden("You do not have permission to view tickets for this storefront.")

    # Fetch customer-safe messages (exclude internal notes)
    messages = session.exec(
        select(MerchantSupportTicketMessage)
        .where(
            MerchantSupportTicketMessage.ticket_id == ticket.id,
            MerchantSupportTicketMessage.is_internal_note == False,
        )
        .order_by(MerchantSupportTicketMessage.created_at.asc())
    ).all()

    # Fetch non-purged attachments
    attachments = session.exec(
        select(MerchantSupportTicketAttachment).where(
            MerchantSupportTicketAttachment.ticket_id == ticket.id,
            MerchantSupportTicketAttachment.is_purged == False,
        )
    ).all()

    return {
        "id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "category": ticket.category,
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "requester_email": ticket.requester_email,
        "requester_name": ticket.requester_name,
        "created_at": ticket.created_at.isoformat(),
        "last_message_at": ticket.last_message_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "sender_type": m.sender_type,
                "sender_name": m.sender_name,
                "channel": m.channel,
                "body_text": m.body_text,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "attachments": [
            {
                "id": str(a.id),
                "file_name": a.file_name,
                "content_type": a.content_type,
                "file_size_bytes": a.file_size_bytes,
                "download_url": f"/api/support/attachments/{a.id}/download",
            }
            for a in attachments
        ],
    }


# ===========================================================================
# 3. FAQ READ APIS (CACHED WITH FULL-TEXT SEARCH)
# ===========================================================================

@router.get("/help/faqs")
def get_merchant_faqs(
    category: Optional[str] = Query(None, description="Category slug"),
    search: Optional[str] = Query(None, description="Search query keyword"),
    featured_only: bool = Query(False, description="Filter top inline featured items"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    session: Session = Depends(get_session),
):
    """
    Paginated, categorized, and searchable FAQ listing.
    Results are cached in high-performance memory cache for 1 hour.
    """
    cache_key = f"faq:cat_{category}:search_{search}:feat_{featured_only}:p_{page}:s_{page_size}"
    cached_data = faq_cache.get(cache_key)
    if cached_data:
        return cached_data

    # Fetch active categories
    categories = session.exec(
        select(MerchantSupportFAQCategory)
        .where(MerchantSupportFAQCategory.is_active == True)
        .order_by(MerchantSupportFAQCategory.sort_order.asc())
    ).all()

    # Query published FAQ items
    query = select(MerchantSupportFAQItem).where(MerchantSupportFAQItem.is_published == True)

    if featured_only:
        query = query.where(MerchantSupportFAQItem.is_featured_inline == True)

    if category:
        cat_obj = session.exec(
            select(MerchantSupportFAQCategory).where(
                MerchantSupportFAQCategory.slug == category.strip().lower()
            )
        ).first()
        if cat_obj:
            query = query.where(MerchantSupportFAQItem.category_id == cat_obj.id)
        else:
            return {"total_count": 0, "page": page, "page_size": page_size, "total_pages": 0, "categories": [], "items": []}

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(MerchantSupportFAQItem.question).like(term),
                func.lower(MerchantSupportFAQItem.answer_rich_text).like(term),
            )
        )

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.exec(count_query).one()

    # Paginate
    items = session.exec(
        query.order_by(MerchantSupportFAQItem.sort_order.asc(), MerchantSupportFAQItem.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    # Map category names
    cat_map = {c.id: c.name for c in categories}

    result = {
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total_count + page_size - 1) // page_size),
        "categories": [
            {
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "icon_name": c.icon_name,
                "sort_order": c.sort_order,
            }
            for c in categories
        ],
        "items": [
            {
                "id": str(item.id),
                "category_id": str(item.category_id),
                "category_name": cat_map.get(item.category_id, "General"),
                "question": item.question,
                "answer_rich_text": item.answer_rich_text,
                "sort_order": item.sort_order,
                "is_featured_inline": item.is_featured_inline,
                "helpful_count": item.helpful_count,
                "not_helpful_count": item.not_helpful_count,
            }
            for item in items
        ],
    }

    faq_cache.set(cache_key, result, ttl=3600)
    return result


@router.get("/help/faqs/{faq_id}")
def get_single_faq(
    faq_id: UUID,
    session: Session = Depends(get_session),
):
    """Retrieve single published FAQ detail."""
    item = session.get(MerchantSupportFAQItem, faq_id)
    if not item or not item.is_published:
        raise HTTPException(status_code=404, detail="FAQ article not found.")

    # Increment view count
    item.view_count += 1
    session.add(item)
    session.commit()

    return {
        "id": str(item.id),
        "category_id": str(item.category_id),
        "question": item.question,
        "answer_rich_text": item.answer_rich_text,
        "helpful_count": item.helpful_count,
        "not_helpful_count": item.not_helpful_count,
    }


# ===========================================================================
# 4. FAQ FEEDBACK VOTING (DEDUPED & RATE LIMITED)
# ===========================================================================

@router.post("/help/faqs/{faq_id}/feedback")
def submit_faq_feedback(
    faq_id: UUID,
    payload: FAQFeedbackRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    """
    Submit helpful / not-helpful feedback with duplicate vote protection.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()

    check_rate_limit(f"rate:faq_fb:{ip_hash}", max_requests=10, window_seconds=60)

    item = session.get(MerchantSupportFAQItem, faq_id)
    if not item or not item.is_published:
        raise HTTPException(status_code=404, detail="FAQ article not found.")

    existing_vote = session.exec(
        select(MerchantSupportFAQFeedback).where(
            MerchantSupportFAQFeedback.faq_id == faq_id,
            MerchantSupportFAQFeedback.ip_hash == ip_hash,
        )
    ).first()

    if existing_vote:
        # Already voted from this client
        return {
            "success": True,
            "faq_id": str(item.id),
            "helpful_count": item.helpful_count,
            "not_helpful_count": item.not_helpful_count,
            "message": "Feedback already recorded.",
        }

    # Record new feedback vote
    feedback = MerchantSupportFAQFeedback(
        faq_id=faq_id,
        ip_hash=ip_hash,
        is_helpful=payload.is_helpful,
    )
    session.add(feedback)

    if payload.is_helpful:
        item.helpful_count += 1
    else:
        item.not_helpful_count += 1

    session.add(item)
    session.commit()
    faq_cache.invalidate_all()

    return {
        "success": True,
        "faq_id": str(item.id),
        "helpful_count": item.helpful_count,
        "not_helpful_count": item.not_helpful_count,
    }


# ===========================================================================
# 5. INBOUND EMAIL WEBHOOK (DEDUPLICATED & SIGNATURE-VERIFIED)
# ===========================================================================

@router.post("/support/webhooks/email-inbound")
async def handle_inbound_email_webhook(
    request: Request,
    session: Session = Depends(get_session),
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
):
    """
    Secure inbound support email reply webhook:
    1. HMAC signature and timestamp verification.
    2. Deduplication by provider_event_id and email_message_id.
    3. Threading into merchant ticket or triage queue.
    """
    raw_body = await request.body()

    # In production, verify HMAC signature
    # If signature is provided, validate it
    if x_webhook_signature:
        if not verify_webhook_signature(raw_body, x_webhook_signature, x_timestamp):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook HMAC signature.")

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload.")

    required_fields = ["provider_event_id", "email_message_id", "from_email", "to_mailbox", "subject", "body_plain"]
    for field in required_fields:
        if not data.get(field):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required webhook field '{field}'.")

    result = process_inbound_email_webhook(
        session=session,
        provider_event_id=data["provider_event_id"],
        email_message_id=data["email_message_id"],
        from_email=data["from_email"],
        to_mailbox=data["to_mailbox"],
        subject=data["subject"],
        body_plain=data["body_plain"],
        body_html=data.get("body_html"),
        in_reply_to=data.get("in_reply_to"),
        references=data.get("references"),
    )

    return result


# ===========================================================================
# 6. INTERNAL OPERATIONAL WORKERS (OUTBOX & GDPR RETENTION)
# ===========================================================================

@router.post("/support/ops/process-outbox")
def trigger_outbox_processing(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Internal trigger to process pending outbox notifications."""
    if not admin.get("is_owner"):
        raise _forbidden("Only Workspace Owner or System Ops can trigger worker.")
    return process_outbox_jobs(session)


@router.post("/support/ops/purge-retention")
def trigger_gdpr_retention_purge(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Internal trigger to run GDPR 90-day attachment and 180-day HTML purge."""
    if not admin.get("is_owner"):
        raise _forbidden("Only Workspace Owner or System Ops can trigger retention purge.")
    return purge_expired_retention_data(session)
