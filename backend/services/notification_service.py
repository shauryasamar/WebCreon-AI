"""
Central Multi-Tenant Notification Dispatcher & Service Layer for WebCreon.
Handles in-app notification persistence, adaptive link resolution, template rendering, and async email queueing.
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from uuid import UUID, uuid4

from sqlmodel import Session, col, delete, select

from models import CustomerNotification, NotificationDeliveryLog, Site, SiteDomain, StoreEmailSettings, User, utc_now
from services.email_templates import clean_store_display_name, render_email_template
from services.notification_queue import enqueue_email_job

logger = logging.getLogger("notification_service")


def resolve_storefront_base_url(session: Session, site: Optional[Site]) -> str:
    """
    Dynamically resolves the fully-qualified storefront base URL:
    1. Checks if site has a verified custom primary domain in `site_domains`.
    2. Checks environment variables: FRONTEND_URL, APP_URL, PLATFORM_URL.
    3. Falls back to http://localhost:5173 for local dev.
    """
    if site:
        try:
            primary_domain = session.exec(
                select(SiteDomain).where(
                    SiteDomain.site_id == site.id,
                    SiteDomain.is_primary == True,
                    SiteDomain.status.in_(["active", "verified", "connected"]),
                )
            ).first()
            if primary_domain and primary_domain.domain:
                d = primary_domain.domain.strip()
                if not d.startswith("http://") and not d.startswith("https://"):
                    return f"https://{d}"
                return d
        except Exception as domain_err:
            logger.debug(f"Domain lookup note: {domain_err}")

    env_url = (
        os.getenv("FRONTEND_URL")
        or os.getenv("APP_URL")
        or os.getenv("VITE_PUBLIC_URL")
        or os.getenv("BASE_URL")
        or os.getenv("WEBCREON_BASE_URL")
    )
    if env_url:
        return env_url.strip().rstrip("/")

    return "http://localhost:5173"


def resolve_store_display_name(session: Session, site_id: UUID, site: Optional[Site]) -> str:
    """
    Resolves clean store display name:
    Prioritizes StoreEmailSettings.sender_name -> cleaned site.name -> "WebCreon Store".
    """
    try:
        settings = session.exec(
            select(StoreEmailSettings).where(StoreEmailSettings.site_id == site_id)
        ).first()
        if settings and settings.sender_name and settings.sender_name.strip():
            return settings.sender_name.strip()
    except Exception:
        pass

    if site and site.name:
        return clean_store_display_name(site.name)
    return "WebCreon Store"


def dispatch_customer_event(
    session: Session,
    site_id: UUID,
    customer_id: UUID,
    event_type: str,
    category: str,
    title: str,
    message: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    action_url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    send_email: bool = True,
    email_recipient: Optional[str] = None,
    email_template_key: Optional[str] = None,
    email_template_vars: Optional[Dict[str, Any]] = None,
) -> Optional[CustomerNotification]:
    """
    Central dispatcher for customer-facing events:
    1. Idempotency Check: Avoids duplicate in-app records and duplicate emails.
    2. Writes in-app CustomerNotification to DB within active session.
    3. Resolves adaptive domain URLs and clean branding.
    4. Triggers asynchronous email dispatch via NotificationQueue if enabled.
    """
    key = idempotency_key or f"{site_id}:{event_type}:{customer_id}:{related_entity_id or uuid4()}"

    # Check for existing idempotency record
    existing = session.exec(
        select(CustomerNotification).where(
            CustomerNotification.site_id == site_id,
            CustomerNotification.idempotency_key == key,
        )
    ).first()

    if existing:
        logger.info(f"Duplicate notification event suppressed via idempotency key: {key}")
        return existing

    # 1. Create In-App Notification Record
    notif = CustomerNotification(
        site_id=site_id,
        customer_id=customer_id,
        event_type=event_type,
        category=category,
        title=title,
        message=message,
        is_read=False,
        related_entity_type=related_entity_type,
        related_entity_id=str(related_entity_id) if related_entity_id else None,
        action_url=action_url,
        metadata_=metadata,
        idempotency_key=key,
    )
    session.add(notif)
    # Note: caller or session commit will flush this

    # 2. Async Email Dispatch
    if send_email:
        recipient = email_recipient
        customer_name = "Customer"
        if not recipient:
            user = session.get(User, customer_id)
            if user:
                recipient = user.email
                customer_name = user.name or "Customer"

        if recipient:
            site = session.get(Site, site_id)
            store_name = resolve_store_display_name(session, site_id, site)
            base_url = resolve_storefront_base_url(session, site)

            tpl_vars = dict(email_template_vars or {})
            tpl_vars.setdefault("store_name", store_name)
            tpl_vars.setdefault("customer_name", customer_name)
            tpl_vars.setdefault("title", title)
            tpl_vars.setdefault("message", message)

            # Resolve fully-qualified adaptive action URLs
            raw_action = tpl_vars.get("action_url") or action_url
            if raw_action:
                if raw_action.startswith("http://") or raw_action.startswith("https://"):
                    full_action_url = raw_action
                else:
                    full_action_url = f"{base_url.rstrip('/')}/{raw_action.lstrip('/')}"
            else:
                slug = site.slug if site else ""
                full_action_url = f"{base_url.rstrip('/')}/store/{slug}" if slug else base_url

            tpl_vars["action_url"] = full_action_url

            # Also resolve order_url, store_url, reset_link if passed as relative
            for link_key in ("order_url", "store_url", "reset_link"):
                if tpl_vars.get(link_key):
                    val = tpl_vars[link_key]
                    if not (val.startswith("http://") or val.startswith("https://") or val == "#"):
                        tpl_vars[link_key] = f"{base_url.rstrip('/')}/{val.lstrip('/')}"

            tpl_key = email_template_key or "generic"
            subject, html_body = render_email_template(tpl_key, tpl_vars)

            enqueue_email_job(
                site_id=site_id,
                recipient=recipient,
                event_type=event_type,
                subject=subject,
                html_content=html_body,
                customer_id=customer_id,
                store_name=store_name,
                idempotency_key=f"email:{key}",
            )

    return notif


def purge_expired_customer_notifications(
    session: Session,
    retention_days: int = 90,
    delivery_log_retention_days: Optional[int] = None,
    days: Optional[int] = None,
) -> Tuple[int, int]:
    """
    Purges customer in-app notifications older than `retention_days` (default 90).
    Optionally purges delivery logs older than `delivery_log_retention_days` if specified.
    Strictly isolated: does NOT touch audit logs, orders, or user accounts.
    Returns (purged_notifications_count, purged_delivery_logs_count).
    """
    notif_days = days if days is not None else retention_days
    cutoff = datetime.now(timezone.utc) - timedelta(days=notif_days)
    statement = delete(CustomerNotification).where(
        col(CustomerNotification.created_at) < cutoff
    )
    result = session.exec(statement)
    purged_notifs = result.rowcount if hasattr(result, "rowcount") and result.rowcount is not None else 0

    purged_logs = 0
    if delivery_log_retention_days is not None:
        log_cutoff = datetime.now(timezone.utc) - timedelta(days=delivery_log_retention_days)
        log_stmt = delete(NotificationDeliveryLog).where(
            col(NotificationDeliveryLog.created_at) < log_cutoff
        )
        log_result = session.exec(log_stmt)
        purged_logs = log_result.rowcount if hasattr(log_result, "rowcount") and log_result.rowcount is not None else 0

    session.commit()
    logger.info(f"Purged {purged_notifs} customer notifications (>{notif_days}d) and {purged_logs} delivery logs.")
    return purged_notifs, purged_logs
