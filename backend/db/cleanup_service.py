"""
Database Garbage Collection & TTL Retention Service for WebCreon AI
-------------------------------------------------------------------
Prevents unbounded table bloat, orphaned records, and stale cache/history
accumulation across high-write PostgreSQL tables.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from uuid import UUID

from sqlalchemy import func, text
from sqlmodel import Session, select, delete

from db.database import engine
from models import (
    Cart,
    CartItem,
    SiteDefinitionHistory,
    SiteTrafficEvent,
    ProcessedProviderEvent,
    ProcessedBillingWebhookEvent,
    BillingIdempotencyKey,
    NotificationDeliveryLog,
    AuditLog,
    DomainOperation,
)

logger = logging.getLogger("db.cleanup_service")


def purge_abandoned_carts(session: Session, max_age_days: int = 180) -> int:
    """Permanently purges carts and line items that have not been modified in > max_age_days (default 180 days / 6 months)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    
    # 1. Find abandoned cart IDs
    abandoned_cart_ids = list(session.exec(
        select(Cart.id).where(Cart.updated_at < cutoff)
    ).all())
    
    if not abandoned_cart_ids:
        return 0

    # Process in batches of 500 to avoid locking
    deleted_items_count = 0
    batch_size = 500
    for i in range(0, len(abandoned_cart_ids), batch_size):
        chunk = abandoned_cart_ids[i : i + batch_size]
        
        # Delete items first
        item_del_stmt = delete(CartItem).where(CartItem.cart_id.in_(chunk))
        res_items = session.exec(item_del_stmt)
        deleted_items_count += res_items.rowcount if hasattr(res_items, "rowcount") else len(chunk)
        
        # Delete parent carts
        cart_del_stmt = delete(Cart).where(Cart.id.in_(chunk))
        session.exec(cart_del_stmt)

    session.commit()
    logger.info("Purged %d abandoned carts and associated line items (older than %d days)", len(abandoned_cart_ids), max_age_days)
    return len(abandoned_cart_ids)


def prune_site_definition_history(session: Session, max_versions_per_site: int = 15) -> int:
    """
    Caps the snapshot revisions in site_definition_history to max_versions_per_site per site.
    Prevents megabytes of duplicate JSON site definition snapshots from accumulating.
    """
    # Find all sites with history
    site_ids = list(session.exec(
        select(SiteDefinitionHistory.site_id).distinct()
    ).all())

    total_pruned = 0
    for site_id in site_ids:
        # Get IDs ordered by saved_at DESC
        history_records = list(session.exec(
            select(SiteDefinitionHistory.id)
            .where(SiteDefinitionHistory.site_id == site_id)
            .order_by(SiteDefinitionHistory.saved_at.desc())
        ).all())

        # If more than max_versions_per_site, delete the excess older ones
        if len(history_records) > max_versions_per_site:
            excess_ids = history_records[max_versions_per_site:]
            session.exec(
                delete(SiteDefinitionHistory).where(SiteDefinitionHistory.id.in_(excess_ids))
            )
            total_pruned += len(excess_ids)

    if total_pruned > 0:
        session.commit()
        logger.info("Pruned %d excess site definition historical snapshots (capped at %d versions/site)", total_pruned, max_versions_per_site)
    return total_pruned


def purge_stale_webhooks_and_idempotency(
    session: Session,
    webhook_retention_days: int = 14,
    idempotency_retention_days: int = 3,
) -> Dict[str, int]:
    """Purges processed billing/carrier webhooks and transient idempotency records."""
    webhook_cutoff = datetime.now(timezone.utc) - timedelta(days=webhook_retention_days)
    idempotency_cutoff = datetime.now(timezone.utc) - timedelta(days=idempotency_retention_days)

    # 1. Billing webhooks
    del_billing_wh = session.exec(
        delete(ProcessedBillingWebhookEvent).where(ProcessedBillingWebhookEvent.received_at < webhook_cutoff)
    )
    wh_billing_count = del_billing_wh.rowcount if hasattr(del_billing_wh, "rowcount") else 0

    # 2. Provider events (Razorpay, Shiprocket, Cashfree)
    del_provider = session.exec(
        delete(ProcessedProviderEvent).where(ProcessedProviderEvent.received_at < webhook_cutoff)
    )
    provider_count = del_provider.rowcount if hasattr(del_provider, "rowcount") else 0

    # 3. Transient Billing Idempotency Keys
    del_idemp = session.exec(
        delete(BillingIdempotencyKey).where(BillingIdempotencyKey.created_at < idempotency_cutoff)
    )
    idemp_count = del_idemp.rowcount if hasattr(del_idemp, "rowcount") else 0

    # 4. Completed / Failed Domain Operations older than 14 days
    del_dom_ops = session.exec(
        delete(DomainOperation).where(
            DomainOperation.status.in_(["completed", "failed"]),
            DomainOperation.updated_at < webhook_cutoff,
        )
    )
    dom_ops_count = del_dom_ops.rowcount if hasattr(del_dom_ops, "rowcount") else 0

    session.commit()
    result = {
        "billing_webhooks_purged": wh_billing_count,
        "provider_events_purged": provider_count,
        "idempotency_keys_purged": idemp_count,
        "domain_ops_purged": dom_ops_count,
    }
    logger.info("Stale webhooks & idempotency keys purged: %s", result)
    return result


def purge_old_traffic_events(session: Session, max_age_days: int = 90) -> int:
    """Purges raw clickstream/visitor hits older than 90 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    del_stmt = delete(SiteTrafficEvent).where(SiteTrafficEvent.created_at < cutoff)
    res = session.exec(del_stmt)
    count = res.rowcount if hasattr(res, "rowcount") else 0
    session.commit()
    if count > 0:
        logger.info("Purged %d raw site traffic events older than %d days", count, max_age_days)
    return count


def purge_old_notification_logs(session: Session, max_age_days: int = 90) -> int:
    """Purges email/SMS delivery logs older than 90 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    del_stmt = delete(NotificationDeliveryLog).where(NotificationDeliveryLog.created_at < cutoff)
    res = session.exec(del_stmt)
    count = res.rowcount if hasattr(res, "rowcount") else 0
    session.commit()
    if count > 0:
        logger.info("Purged %d notification delivery logs older than %d days", count, max_age_days)
    return count


def purge_old_audit_logs(session: Session, max_age_days: int = 90) -> int:
    """Purges non-critical general audit activity logs older than 90 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    del_stmt = delete(AuditLog).where(
        AuditLog.created_at < cutoff,
        AuditLog.category.notin_(["financial", "security", "tax_compliance", "payout"]),
    )
    res = session.exec(del_stmt)
    count = res.rowcount if hasattr(res, "rowcount") else 0
    session.commit()
    if count > 0:
        logger.info("Purged %d general audit logs older than %d days", count, max_age_days)
    return count


def purge_old_ai_usage_and_reservations(session: Session, usage_retention_days: int = 180, reservation_retention_days: int = 30) -> Dict[str, int]:
    """Purges expired temporary AI credit reservations and historical usage logs older than retention periods."""
    from models import AICreditReservation, AICreditUsageEvent
    
    usage_cutoff = datetime.now(timezone.utc) - timedelta(days=usage_retention_days)
    reservation_cutoff = datetime.now(timezone.utc) - timedelta(days=reservation_retention_days)

    # 1. Purge expired / released temporary reservations older than 30 days
    del_res = session.exec(
        delete(AICreditReservation).where(
            AICreditReservation.status.in_(["EXPIRED", "RELEASED", "COMMITTED"]),
            AICreditReservation.created_at < reservation_cutoff,
        )
    )
    res_count = del_res.rowcount if hasattr(del_res, "rowcount") else 0

    # 2. Purge historical usage events older than 180 days (settled billing cycles)
    del_usage = session.exec(
        delete(AICreditUsageEvent).where(AICreditUsageEvent.created_at < usage_cutoff)
    )
    usage_count = del_usage.rowcount if hasattr(del_usage, "rowcount") else 0

    session.commit()
    result = {
        "ai_reservations_purged": res_count,
        "ai_usage_events_purged": usage_count,
    }
    if res_count > 0 or usage_count > 0:
        logger.info("Purged stale AI reservations & usage logs: %s", result)
    return result


def run_full_database_retention_sweep() -> Dict[str, Any]:
    """
    Master runner executing all database garbage collection and TTL retention routines.
    Safe to run via cron, startup lifespan, or admin maintenance trigger.
    """
    logger.info("Starting Full Database Retention & Garbage Collection Sweep...")
    summary: Dict[str, Any] = {}
    try:
        with Session(engine) as session:
            summary["abandoned_carts_purged"] = purge_abandoned_carts(session, max_age_days=180)
            summary["site_definitions_pruned"] = prune_site_definition_history(session, max_versions_per_site=15)
            summary["webhooks_and_idempotency"] = purge_stale_webhooks_and_idempotency(session, webhook_retention_days=14, idempotency_retention_days=3)
            summary["ai_credits_purged"] = purge_old_ai_usage_and_reservations(session, usage_retention_days=180, reservation_retention_days=30)
            summary["traffic_events_purged"] = purge_old_traffic_events(session, max_age_days=90)
            summary["notification_logs_purged"] = purge_old_notification_logs(session, max_age_days=90)
            summary["audit_logs_purged"] = purge_old_audit_logs(session, max_age_days=90)
            summary["status"] = "success"
            summary["timestamp"] = datetime.now(timezone.utc).isoformat()
            logger.info("Full Database Retention Sweep completed successfully: %s", summary)
    except Exception as err:
        logger.error("Error during Full Database Retention Sweep: %s", err, exc_info=True)
        summary["status"] = "error"
        summary["error"] = str(err)

    return summary
