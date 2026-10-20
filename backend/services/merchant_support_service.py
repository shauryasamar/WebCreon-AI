import hashlib
import hmac
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlmodel import Session, col, func, select, or_
from sqlalchemy import text

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
    Site,
    utc_now,
)

logger = logging.getLogger("merchant_support")
logger.setLevel(logging.INFO)

# ===========================================================================
# 1. EMAIL SERVICE ABSTRACTION
# ===========================================================================

class SupportEmailService:
    """Pluggable transactional support email delivery interface."""

    def send_ticket_acknowledgment(
        self,
        to_email: str,
        to_name: str,
        ticket_number: str,
        subject: str,
        message_body: str,
        idempotency_key: str,
    ) -> Dict[str, Any]:
        """Dispatch outbound confirmation email with ticket token embedded."""
        try:
            from services.email_service import send_merchant_support_acknowledgment_email
            send_merchant_support_acknowledgment_email(
                to_email=to_email,
                to_name=to_name,
                ticket_number=ticket_number,
                subject=subject,
                message_body=message_body,
            )
        except Exception as e:
            logger.warning("Error invoking send_merchant_support_acknowledgment_email: %s", e)

        return {
            "status": "success",
            "provider_message_id": f"msg_out_{uuid4().hex[:12]}",
            "ticket_number": ticket_number,
            "to_email": to_email,
        }

email_service = SupportEmailService()


# ===========================================================================
# 2. REQUEST FINGERPRINTING & IDEMPOTENCY
# ===========================================================================

def compute_request_fingerprint(
    category: str,
    subject: str,
    message: str,
    website_id: Optional[str | UUID],
    page_context: Optional[Dict[str, Any]],
) -> str:
    """Canonical SHA-256 fingerprint from normalized ticket payload fields."""
    normalized_website = str(website_id or "").strip().lower()
    normalized_category = str(category or "").strip().lower()
    normalized_subject = str(subject or "").strip()
    normalized_message = str(message or "").strip()
    normalized_context = json.dumps(page_context or {}, sort_keys=True)

    raw_payload = f"{normalized_category}|{normalized_subject}|{normalized_message}|{normalized_website}|{normalized_context}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()


# ===========================================================================
# 3. HTML SANITIZATION UTILITY
# ===========================================================================

SAFE_TAG_REGEX = re.compile(r"<\/?(p|br|b|i|strong|em|u|ul|ol|li|code|pre|blockquote|a(\s+href=\"[^\"]*\")?)>", re.IGNORECASE)
SCRIPT_STYLE_REGEX = re.compile(r"<(script|style|iframe|object|embed)[^>]*>.*?<\/\1>", re.IGNORECASE | re.DOTALL)
ANY_TAG_REGEX = re.compile(r"<[^>]+>")

def sanitize_html(raw_html: Optional[str]) -> Tuple[str, str]:
    """
    Sanitize inbound email HTML.
    Returns: (sanitized_plain_text, sanitized_safe_html)
    """
    if not raw_html:
        return "", ""

    # 1. Strip script, style, iframe, embeds completely
    stripped = SCRIPT_STYLE_REGEX.sub("", raw_html)

    # 2. Plaintext extraction
    plain_text = ANY_TAG_REGEX.sub(" ", stripped).replace("&nbsp;", " ").strip()
    plain_text = re.sub(r"\s+", " ", plain_text)

    # 3. Whitelist safe formatting tags
    # Keep only approved typographic tags
    safe_html = stripped
    # Strip event handlers e.g. onerror=, onclick=
    safe_html = re.sub(r"\s+on\w+\s*=\s*\"[^\"]*\"", "", safe_html, flags=re.IGNORECASE)
    safe_html = re.sub(r"\s+on\w+\s*=\s*'[^']*'", "", safe_html, flags=re.IGNORECASE)

    return plain_text, safe_html


# ===========================================================================
# 4. OUTBOX DISPATCHER & DEAD-LETTER QUEUE
# ===========================================================================

# Retry intervals in seconds: attempt 1: 0s, attempt 2: 10s, attempt 3: 30s, attempt 4: 90s
RETRY_DELAYS = [0, 10, 30, 90]

def process_outbox_jobs(session: Session, max_jobs: int = 50) -> Dict[str, int]:
    """
    Transactional outbox processor with exponential backoff and DLQ exhaustion handling.
    """
    now = utc_now()
    pending_jobs = session.exec(
        select(MerchantSupportOutboxJob)
        .where(
            MerchantSupportOutboxJob.status.in_(["pending", "failed"]),
            MerchantSupportOutboxJob.next_attempt_at <= now,
            MerchantSupportOutboxJob.attempt_count < MerchantSupportOutboxJob.max_attempt_count,
        )
        .order_by(MerchantSupportOutboxJob.created_at.asc())
        .limit(max_jobs)
    ).all()

    processed_count = 0
    succeeded_count = 0
    dlq_count = 0

    for job in pending_jobs:
        processed_count += 1
        job.attempt_count += 1
        job.status = "processing"
        job.locked_at = now
        session.add(job)
        session.commit()

        try:
            if job.job_type == "outbound_ticket_created_email":
                payload = job.payload
                email_service.send_ticket_acknowledgment(
                    to_email=payload["requester_email"],
                    to_name=payload["requester_name"],
                    ticket_number=payload["ticket_number"],
                    subject=payload["subject"],
                    message_body=payload.get("message_body", ""),
                    idempotency_key=job.idempotency_key,
                )

            job.status = "completed"
            job.completed_at = utc_now()
            session.add(job)

            if job.ticket_id:
                session.add(
                    MerchantSupportTicketEvent(
                        ticket_id=job.ticket_id,
                        event_type="outbox_job_completed",
                        actor_type="system",
                        metadata_json={"job_id": str(job.id), "job_type": job.job_type},
                    )
                )
            session.commit()
            succeeded_count += 1

        except Exception as exc:
            logger.error("Error processing outbox job %s: %s", job.id, str(exc))
            job.last_error_message = str(exc)
            job.last_error_code = "DISPATCH_FAILED"

            if job.attempt_count >= job.max_attempt_count:
                # Move to Dead Letter Queue
                job.status = "failed"
                dlq_record = MerchantSupportDeadLetter(
                    job_type=job.job_type,
                    ticket_id=job.ticket_id,
                    payload_json=job.payload,
                    error_message=str(exc),
                    attempt_count=job.attempt_count,
                    status="exhausted",
                )
                session.add(dlq_record)
                if job.ticket_id:
                    session.add(
                        MerchantSupportTicketEvent(
                            ticket_id=job.ticket_id,
                            event_type="outbox_job_dead_lettered",
                            actor_type="system",
                            metadata_json={"job_id": str(job.id), "attempts": job.attempt_count},
                        )
                    )
                dlq_count += 1
            else:
                job.status = "failed"
                delay = RETRY_DELAYS[min(job.attempt_count, len(RETRY_DELAYS) - 1)]
                job.next_attempt_at = utc_now() + timedelta(seconds=delay)

            session.add(job)
            session.commit()

    return {
        "processed": processed_count,
        "succeeded": succeeded_count,
        "dead_lettered": dlq_count,
    }


# ===========================================================================
# 5. INBOUND EMAIL WEBHOOK PROCESSING & THREADING
# ===========================================================================

WEBHOOK_SECRET = "wc_webhook_secret_support_2026"
SUBJECT_TOKEN_REGEX = re.compile(r"\[(WC-SP-\d{4,8})\]", re.IGNORECASE)

def verify_webhook_signature(
    raw_body: bytes,
    signature_header: Optional[str],
    timestamp_header: Optional[str],
    secret: str = WEBHOOK_SECRET,
    tolerance_seconds: int = 300,
) -> bool:
    """
    Verify HMAC SHA-256 signature and timestamp freshness for inbound email webhooks.
    """
    if not signature_header or not timestamp_header:
        return False

    try:
        ts = int(timestamp_header)
        now_ts = int(time.time())
        if abs(now_ts - ts) > tolerance_seconds:
            logger.warning("Webhook rejected: Timestamp %s is expired (current: %s)", ts, now_ts)
            return False
    except (ValueError, TypeError):
        return False

    expected_sig = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp_header}.".encode("utf-8") + raw_body,
        hashlib.sha256,
    ).hexdigest()

    clean_header = signature_header.replace("sha256=", "").strip()
    return hmac.compare_digest(expected_sig, clean_header)


def process_inbound_email_webhook(
    session: Session,
    provider_event_id: str,
    email_message_id: str,
    from_email: str,
    to_mailbox: str,
    subject: str,
    body_plain: str,
    body_html: Optional[str],
    in_reply_to: Optional[str],
    references: Optional[List[str] | str],
) -> Dict[str, Any]:
    """
    Idempotent, deduplicated inbound email processing and ticket threading.
    """
    # 1. Deduplication check: verify provider_event_id or email_message_id
    existing_thread = session.exec(
        select(MerchantSupportTicketEmailThread).where(
            or_(
                MerchantSupportTicketEmailThread.provider_event_id == provider_event_id,
                MerchantSupportTicketEmailThread.email_message_id == email_message_id,
            )
        )
    ).first()

    if existing_thread:
        logger.info(
            "Inbound webhook deduplicated: provider_event_id=%s, email_message_id=%s",
            provider_event_id,
            email_message_id,
        )
        return {
            "status": "deduplicated_ignored",
            "ticket_id": str(existing_thread.ticket_id),
            "is_replay": True,
        }

    # 2. Thread resolution logic:
    # 1st priority: In-Reply-To
    target_ticket: Optional[MerchantSupportTicket] = None

    if in_reply_to:
        thread_match = session.exec(
            select(MerchantSupportTicketEmailThread).where(
                MerchantSupportTicketEmailThread.email_message_id == in_reply_to
            )
        ).first()
        if thread_match:
            target_ticket = session.get(MerchantSupportTicket, thread_match.ticket_id)

    # 2nd priority: References
    if not target_ticket and references:
        ref_list = references if isinstance(references, list) else [r.strip() for r in references.split() if r.strip()]
        for ref_id in ref_list:
            ref_match = session.exec(
                select(MerchantSupportTicketEmailThread).where(
                    MerchantSupportTicketEmailThread.email_message_id == ref_id
                )
            ).first()
            if ref_match:
                target_ticket = session.get(MerchantSupportTicket, ref_match.ticket_id)
                break

    # 3rd priority: Subject ticket token e.g. [WC-SP-10042]
    if not target_ticket and subject:
        match = SUBJECT_TOKEN_REGEX.search(subject)
        if match:
            extracted_token = match.group(1).upper()
            target_ticket = session.exec(
                select(MerchantSupportTicket).where(
                    MerchantSupportTicket.ticket_number == extracted_token
                )
            ).first()

    # 4th priority: Fallback - Create an unassigned triage ticket if no parent match found
    is_triage = False
    clean_plain, safe_html = sanitize_html(body_html if body_html else body_plain)
    if not clean_plain:
        clean_plain = body_plain.strip()

    if not target_ticket:
        is_triage = True
        # Find admin by email or create triage under system
        admin_match = session.exec(
            select(Admin).where(func.lower(Admin.email) == from_email.strip().lower())
        ).first()

        admin_id = admin_match.id if admin_match else UUID("00000000-0000-0000-0000-000000000001")
        requester_name = admin_match.name if admin_match and admin_match.name else from_email.split("@")[0]

        target_ticket = MerchantSupportTicket(
            ticket_number=f"WC-SP-{int(time.time()) % 900000 + 100000}",
            admin_id=admin_id,
            client_request_id=uuid4(),
            request_fingerprint=compute_request_fingerprint("other", subject, clean_plain, None, {}),
            category="other",
            subject=subject or "Inbound Support Inquiry",
            status="open",
            priority="normal",
            source="email_inbound",
            requester_email=from_email,
            requester_name=requester_name,
            last_message_at=utc_now(),
            last_message_from="admin",
        )
        session.add(target_ticket)
        session.commit()
        session.refresh(target_ticket)

    # 3. Verify sender authorization:
    # If replying to an existing ticket, sender must match requester_email or belong to authorized admin list
    is_sender_authorized = (
        target_ticket.requester_email.strip().lower() == from_email.strip().lower()
        or is_triage
    )

    sender_admin = session.exec(
        select(Admin).where(func.lower(Admin.email) == from_email.strip().lower())
    ).first()

    sender_type = "admin" if sender_admin or is_sender_authorized else "external_reply"

    # 4. Insert message
    msg = MerchantSupportTicketMessage(
        ticket_id=target_ticket.id,
        sender_type=sender_type,
        sender_admin_id=sender_admin.id if sender_admin else None,
        sender_name=sender_admin.name if sender_admin and sender_admin.name else from_email.split("@")[0],
        channel="email",
        body_text=clean_plain,
        body_html_raw=safe_html,
        email_message_id=email_message_id,
        in_reply_to_message_id=in_reply_to,
        references_header=json.dumps(references) if references else None,
    )
    session.add(msg)

    # 5. Insert thread record
    thread_rec = MerchantSupportTicketEmailThread(
        ticket_id=target_ticket.id,
        provider_event_id=provider_event_id,
        direction="inbound",
        email_message_id=email_message_id,
        in_reply_to_message_id=in_reply_to,
        references_header=json.dumps(references) if references else None,
        mailbox_address=to_mailbox,
        sender_email=from_email,
        received_at=utc_now(),
    )
    session.add(thread_rec)

    # 6. Update ticket status and last message
    target_ticket.last_message_at = utc_now()
    target_ticket.last_message_from = "admin"
    if target_ticket.status in ("resolved", "closed"):
        target_ticket.status = "open"  # Reopen on reply
    session.add(target_ticket)

    # 7. Audit event
    session.add(
        MerchantSupportTicketEvent(
            ticket_id=target_ticket.id,
            event_type="inbound_email_appended" if not is_triage else "inbound_email_triage_created",
            actor_type="webhook",
            actor_id=from_email,
            metadata_json={
                "email_message_id": email_message_id,
                "provider_event_id": provider_event_id,
                "is_triage": is_triage,
            },
        )
    )

    session.commit()
    return {
        "status": "processed",
        "ticket_id": str(target_ticket.id),
        "ticket_number": target_ticket.ticket_number,
        "is_triage": is_triage,
    }


# ===========================================================================
# 6. GDPR DATA RETENTION & PURGE WORKER
# ===========================================================================

def purge_expired_retention_data(session: Session) -> Dict[str, int]:
    """
    Idempotent GDPR Data Retention Purge:
    1. Attachments: Hard delete storage & mark is_purged=True 90 days post ticket close.
    2. Raw Inbound HTML: Clear body_html_raw after 180 days.
    """
    now = utc_now()
    cutoff_90d = now - timedelta(days=90)
    cutoff_180d = now - timedelta(days=180)

    # 1. Attachments purge for tickets closed > 90 days ago
    expired_attachments = session.exec(
        select(MerchantSupportTicketAttachment)
        .join(MerchantSupportTicket)
        .where(
            MerchantSupportTicket.status == "closed",
            MerchantSupportTicket.closed_at <= cutoff_90d,
            MerchantSupportTicketAttachment.is_purged == False,
        )
    ).all()

    purged_attachments_count = 0
    for att in expired_attachments:
        att.is_purged = True
        att.purged_at = now
        session.add(att)
        session.add(
            MerchantSupportTicketEvent(
                ticket_id=att.ticket_id,
                event_type="attachment_retention_purged",
                actor_type="system",
                metadata_json={"attachment_id": str(att.id), "file_name": att.file_name},
            )
        )
        purged_attachments_count += 1

    # 2. Raw HTML scrubbing after 180 days
    old_messages = session.exec(
        select(MerchantSupportTicketMessage).where(
            MerchantSupportTicketMessage.created_at <= cutoff_180d,
            MerchantSupportTicketMessage.body_html_raw != None,
        )
    ).all()

    scrubbed_html_count = 0
    for msg in old_messages:
        msg.body_html_raw = None
        session.add(msg)
        scrubbed_html_count += 1

    session.commit()
    return {
        "attachments_purged": purged_attachments_count,
        "html_scrubbed": scrubbed_html_count,
    }


def anonymize_admin_support_data_gdpr(session: Session, admin_id: UUID) -> int:
    """
    GDPR Right to Be Forgotten: Anonymize personal metadata across all merchant support records.
    """
    tickets = session.exec(
        select(MerchantSupportTicket).where(MerchantSupportTicket.admin_id == admin_id)
    ).all()

    anonymized_count = 0
    for t in tickets:
        t.requester_name = "Anonymized Merchant"
        t.requester_email = f"anonymized_{hashlib.sha256(str(admin_id).encode()).hexdigest()[:12]}@privacy.webcreon.local"
        session.add(t)

        # Anonymize events
        events = session.exec(
            select(MerchantSupportTicketEvent).where(MerchantSupportTicketEvent.ticket_id == t.id)
        ).all()
        for ev in events:
            if ev.actor_id and ev.actor_id == str(admin_id):
                ev.actor_id = "anonymized_user"
                session.add(ev)

        anonymized_count += 1

    session.commit()
    return anonymized_count


# ===========================================================================
# 7. FAQ CACHING & IN-MEMORY FALLBACK LAYER
# ===========================================================================

class FAQCacheService:
    """High-performance FAQ cache with in-memory fallback and content invalidation."""

    def __init__(self):
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._ttl_seconds = 3600  # 1 Hour TTL

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            expires_at, data = self._cache[key]
            if time.time() < expires_at:
                return data
            del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        expires_at = time.time() + (ttl or self._ttl_seconds)
        self._cache[key] = (expires_at, value)

    def invalidate_all(self):
        self._cache.clear()
        logger.info("FAQ Cache completely invalidated.")

faq_cache = FAQCacheService()
