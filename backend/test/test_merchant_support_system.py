import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select, func

from db.database import engine, create_db_and_tables
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
from routers.merchant_support import (
    CreateTicketRequest,
    FAQFeedbackRequest,
    create_merchant_support_ticket,
    get_merchant_faqs,
    get_merchant_support_ticket,
    submit_faq_feedback,
)
from services.merchant_support_service import (
    WEBHOOK_SECRET,
    anonymize_admin_support_data_gdpr,
    compute_request_fingerprint,
    faq_cache,
    process_inbound_email_webhook,
    process_outbox_jobs,
    purge_expired_retention_data,
    sanitize_html,
    verify_webhook_signature,
)

@pytest.fixture(autouse=True)
def init_database():
    create_db_and_tables()

@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session

@pytest.fixture
def test_admin_owner(db_session: Session) -> Admin:
    admin = Admin(
        id=uuid4(),
        email=f"owner_{uuid4().hex[:6]}@merchant.com",
        name="Workspace Owner",
        role="super_admin",
        is_owner=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin

@pytest.fixture
def test_admin_staff(db_session: Session) -> Admin:
    admin = Admin(
        id=uuid4(),
        email=f"staff_{uuid4().hex[:6]}@merchant.com",
        name="Store Staff",
        role="Staff",
        is_owner=False,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin

@pytest.fixture
def test_site(db_session: Session, test_admin_owner: Admin) -> Site:
    site = Site(
        id=uuid4(),
        name="Flagship Test Store",
        slug=f"store-{uuid4().hex[:6]}",
        admin_id=test_admin_owner.id,
    )
    db_session.add(site)
    db_session.commit()
    db_session.refresh(site)

    admin_site = AdminSite(admin_id=test_admin_owner.id, site_id=site.id)
    db_session.add(admin_site)
    db_session.commit()
    return site


# ===========================================================================
# 1. DATABASE & NAMING INVARIANT TESTS
# ===========================================================================

def test_all_models_use_merchant_support_table_names():
    """Verify strict naming rule across all entities."""
    models_to_check = [
        MerchantSupportTicket,
        MerchantSupportTicketMessage,
        MerchantSupportTicketContextSnapshot,
        MerchantSupportTicketEmailThread,
        MerchantSupportTicketAttachment,
        MerchantSupportTicketEvent,
        MerchantSupportOutboxJob,
        MerchantSupportDeadLetter,
        MerchantSupportFAQCategory,
        MerchantSupportFAQItem,
        MerchantSupportFAQFeedback,
    ]
    for m in models_to_check:
        assert m.__tablename__.startswith("merchant_support_"), f"{m.__name__} does not use merchant_support_ prefix!"


# ===========================================================================
# 2. IDEMPOTENCY & TICKET CREATION TESTS
# ===========================================================================

def test_ticket_creation_and_idempotent_replay(db_session: Session, test_admin_owner: Admin, test_site: Site):
    req_id = uuid4()
    payload = CreateTicketRequest(
        client_request_id=req_id,
        category="billing",
        subject="Invoice CGST tax mismatch on Starter Plan",
        message="When downloading invoice #INV-2026-004, the CGST tax rate shows 9% instead of 0%.",
        website_id=test_site.id,
    )

    admin_ctx = {
        "adminId": str(test_admin_owner.id),
        "email": test_admin_owner.email,
        "name": test_admin_owner.name,
        "is_owner": True,
    }

    # 1. First Submission -> 201 Created
    res1 = create_merchant_support_ticket(payload=payload, admin=admin_ctx, session=db_session)
    assert res1["success"] is True
    assert res1["is_replay"] is False
    assert res1["ticket"]["ticket_number"].startswith("WC-SP-")

    ticket_number = res1["ticket"]["ticket_number"]

    # 2. Exact Duplicate Submission -> 200 OK Replay
    res2 = create_merchant_support_ticket(payload=payload, admin=admin_ctx, session=db_session)
    # JSONResponse content parse
    import json
    data2 = json.loads(res2.body.decode("utf-8"))
    assert res2.status_code == 200
    assert data2["success"] is True
    assert data2["is_replay"] is True
    assert data2["ticket"]["ticket_number"] == ticket_number

    # 3. Mismatched Payload with same client_request_id -> 409 Conflict
    payload_modified = CreateTicketRequest(
        client_request_id=req_id,
        category="domain",  # modified category
        subject="Different subject entirely",
        message="Different message body entirely.",
        website_id=test_site.id,
    )

    with pytest.raises(HTTPException) as exc_info:
        create_merchant_support_ticket(payload=payload_modified, admin=admin_ctx, session=db_session)
    assert exc_info.value.status_code == 409


# ===========================================================================
# 3. RBAC & TENANT ISOLATION TESTS
# ===========================================================================

def test_rbac_ticket_view_boundaries(db_session: Session, test_admin_owner: Admin, test_admin_staff: Admin, test_site: Site):
    # Owner creates ticket
    ticket = MerchantSupportTicket(
        ticket_number="WC-SP-99901",
        admin_id=test_admin_owner.id,
        website_id=test_site.id,
        client_request_id=uuid4(),
        request_fingerprint="test_fp_1",
        category="billing",
        subject="Test Owner Ticket",
        status="open",
        requester_email=test_admin_owner.email,
        requester_name="Owner",
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    # Owner can view
    owner_ctx = {"adminId": str(test_admin_owner.id), "is_owner": True}
    res_owner = get_merchant_support_ticket(ticket_id=ticket.id, admin=owner_ctx, session=db_session)
    assert res_owner["ticket_number"] == "WC-SP-99901"

    # Unassigned staff cannot view owner's ticket -> 403 Forbidden
    staff_ctx = {"adminId": str(test_admin_staff.id), "is_owner": False}
    with pytest.raises(HTTPException) as exc_info:
        get_merchant_support_ticket(ticket_id=ticket.id, admin=staff_ctx, session=db_session)
    assert exc_info.value.status_code == 403

    # Staff creates own ticket
    staff_ticket = MerchantSupportTicket(
        ticket_number="WC-SP-99902",
        admin_id=test_admin_staff.id,
        website_id=test_site.id,
        client_request_id=uuid4(),
        request_fingerprint="test_fp_2",
        category="orders",
        subject="Test Staff Ticket",
        status="open",
        requester_email=test_admin_staff.email,
        requester_name="Staff",
    )
    db_session.add(staff_ticket)
    db_session.commit()
    db_session.refresh(staff_ticket)

    # Staff can view own ticket
    res_staff = get_merchant_support_ticket(ticket_id=staff_ticket.id, admin=staff_ctx, session=db_session)
    assert res_staff["ticket_number"] == "WC-SP-99902"


# ===========================================================================
# 4. FAQ CATALOG & FEEDBACK DEDUPLICATION TESTS
# ===========================================================================

def test_faq_catalog_and_feedback(db_session: Session):
    faq_cache.invalidate_all()

    # Get FAQs
    faqs = get_merchant_faqs(featured_only=True, page=1, page_size=10, session=db_session)
    assert faqs["total_count"] >= 6
    assert len(faqs["items"]) >= 6

    target_faq = faqs["items"][0]
    faq_id = UUID(target_faq["id"])

    # Create dummy Request mock
    class DummyRequest:
        class Client:
            host = "192.168.1.50"
        client = Client()

    # 1. Vote Helpful
    fb_res1 = submit_faq_feedback(faq_id=faq_id, payload=FAQFeedbackRequest(is_helpful=True), request=DummyRequest(), session=db_session)
    assert fb_res1["success"] is True

    # 2. Duplicate vote from same IP
    fb_res2 = submit_faq_feedback(faq_id=faq_id, payload=FAQFeedbackRequest(is_helpful=True), request=DummyRequest(), session=db_session)
    assert fb_res2["message"] == "Feedback already recorded."


# ===========================================================================
# 5. INBOUND WEBHOOK & THREADING TESTS
# ===========================================================================

def test_inbound_email_threading_and_deduplication(db_session: Session, test_admin_owner: Admin, test_site: Site):
    # Create ticket
    ticket = MerchantSupportTicket(
        ticket_number="WC-SP-77701",
        admin_id=test_admin_owner.id,
        website_id=test_site.id,
        client_request_id=uuid4(),
        request_fingerprint="test_thread_fp",
        category="domain",
        subject="Domain Setup Issue",
        status="open",
        requester_email=test_admin_owner.email,
        requester_name="Owner",
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    # Initial outbound thread record
    outbound_thread = MerchantSupportTicketEmailThread(
        ticket_id=ticket.id,
        provider_event_id="evt_out_101",
        direction="outbound",
        email_message_id="<outbound_msg_101@webcreon.com>",
        mailbox_address="support@webcreon.com",
        sender_email="support@webcreon.com",
    )
    db_session.add(outbound_thread)
    db_session.commit()

    # 1. Process valid inbound reply matching In-Reply-To
    res1 = process_inbound_email_webhook(
        session=db_session,
        provider_event_id="evt_in_201",
        email_message_id="<inbound_reply_201@gmail.com>",
        from_email=test_admin_owner.email,
        to_mailbox="support@webcreon.com",
        subject="Re: [WC-SP-77701] Domain Setup Issue",
        body_plain="Here is my DNS record screenshot.",
        body_html="<p>Here is my DNS record screenshot.</p><script>alert('XSS')</script>",
        in_reply_to="<outbound_msg_101@webcreon.com>",
        references="<outbound_msg_101@webcreon.com>",
    )
    assert res1["status"] == "processed"
    assert res1["ticket_id"] == str(ticket.id)

    # Verify HTML sanitization stripped script
    latest_msg = db_session.exec(
        select(MerchantSupportTicketMessage).where(MerchantSupportTicketMessage.ticket_id == ticket.id)
    ).all()[-1]
    assert "<script>" not in (latest_msg.body_html_raw or "")

    # 2. Duplicate webhook event -> deduplicated_ignored
    res2 = process_inbound_email_webhook(
        session=db_session,
        provider_event_id="evt_in_201",
        email_message_id="<inbound_reply_201@gmail.com>",
        from_email=test_admin_owner.email,
        to_mailbox="support@webcreon.com",
        subject="Re: [WC-SP-77701] Domain Setup Issue",
        body_plain="Here is my DNS record screenshot.",
        body_html=None,
        in_reply_to="<outbound_msg_101@webcreon.com>",
        references=None,
    )
    assert res2["status"] == "deduplicated_ignored"
    assert res2["is_replay"] is True


def test_webhook_signature_verification():
    raw_payload = b'{"provider_event_id":"evt_999","email_message_id":"msg_999"}'
    ts = str(int(time.time()))

    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        f"{ts}.".encode("utf-8") + raw_payload,
        hashlib.sha256,
    ).hexdigest()

    # Valid
    assert verify_webhook_signature(raw_payload, f"sha256={expected_sig}", ts) is True
    # Tampered body
    assert verify_webhook_signature(b'tampered', f"sha256={expected_sig}", ts) is False
    # Expired timestamp (600s ago)
    old_ts = str(int(time.time()) - 600)
    assert verify_webhook_signature(raw_payload, f"sha256={expected_sig}", old_ts) is False


# ===========================================================================
# 6. OUTBOX & DEAD-LETTER QUEUE (DLQ) TESTS
# ===========================================================================

def test_outbox_processing_and_dlq(db_session: Session, test_admin_owner: Admin):
    # Insert failing outbox job
    job = MerchantSupportOutboxJob(
        job_type="outbound_ticket_created_email",
        idempotency_key=f"test_job_{uuid4().hex}",
        payload={
            "requester_email": "invalid_format",
            "requester_name": "Test",
            "ticket_number": "WC-SP-88888",
            "subject": "Test",
        },
        attempt_count=3,  # already attempted 3 times
        max_attempt_count=4,
        status="pending",
    )
    db_session.add(job)
    db_session.commit()

    # Run outbox processor
    result = process_outbox_jobs(db_session)
    assert result["processed"] >= 1


# ===========================================================================
# 7. GDPR RETENTION & ANONYMIZATION TESTS
# ===========================================================================

def test_gdpr_retention_purge_and_anonymization(db_session: Session, test_admin_owner: Admin, test_site: Site):
    # 1. Create closed ticket from 100 days ago
    closed_old = utc_now() - timedelta(days=100)
    ticket = MerchantSupportTicket(
        ticket_number="WC-SP-55501",
        admin_id=test_admin_owner.id,
        website_id=test_site.id,
        client_request_id=uuid4(),
        request_fingerprint="test_retention_fp",
        category="billing",
        subject="Old Closed Ticket",
        status="closed",
        closed_at=closed_old,
        requester_email=test_admin_owner.email,
        requester_name=test_admin_owner.name,
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    # Add attachment
    attachment = MerchantSupportTicketAttachment(
        ticket_id=ticket.id,
        file_name="old_log.txt",
        content_type="text/plain",
        file_size_bytes=1024,
        storage_key=f"support_att_{uuid4().hex}.txt",
        checksum_sha256="abc123hash",
        is_purged=False,
    )
    db_session.add(attachment)

    # Add message with HTML older than 190 days
    old_msg = MerchantSupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="admin",
        channel="email",
        body_text="Plain text body",
        body_html_raw="<p>Raw HTML to scrub</p>",
        created_at=utc_now() - timedelta(days=190),
    )
    db_session.add(old_msg)
    db_session.commit()

    # Execute purge worker
    purge_results = purge_expired_retention_data(db_session)
    assert purge_results["attachments_purged"] >= 1
    assert purge_results["html_scrubbed"] >= 1

    # Verify attachment is purged
    db_session.refresh(attachment)
    assert attachment.is_purged is True

    # 2. Test GDPR Anonymization
    anon_count = anonymize_admin_support_data_gdpr(db_session, test_admin_owner.id)
    assert anon_count >= 1

    db_session.refresh(ticket)
    assert ticket.requester_name == "Anonymized Merchant"
    assert "@privacy.webcreon.local" in ticket.requester_email
