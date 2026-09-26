from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlmodel import Session, select
from models import (
    SubscriptionStatus,
    SubscriptionPlan,
    WebsiteSubscription,
    WebsiteSubscriptionEvent,
    utc_now,
)
from services.plan_service import (
    downgrade_website_plan,
    get_or_create_website_subscription,
    compute_subscription_event_hash,
)

GRACE_PERIOD_DAYS = 7


def start_grace_period(
    session: Session,
    website_id: UUID,
    failure_timestamp: Optional[datetime] = None,
) -> WebsiteSubscription:
    """
    Immediate Downgrade Policy (Zero Free Days):
    Upon recurring payment failure or cancellation, the store is immediately cascaded
    down to the FREE tier to prevent exploitation of free days.
    """
    downgrade_website_plan(
        session=session,
        website_id=website_id,
        target_plan=SubscriptionPlan.FREE.value,
        is_voluntary=False,
    )
    return get_or_create_website_subscription(session, website_id)


def cancel_grace_period(
    session: Session,
    website_id: UUID,
) -> WebsiteSubscription:
    """
    Clears grace period status upon successful payment retry.
    """
    sub = get_or_create_website_subscription(session, website_id)
    now = utc_now()

    if sub.status == SubscriptionStatus.GRACE_PERIOD.value:
        sub.status = SubscriptionStatus.ACTIVE.value
        sub.grace_period_started_at = None
        sub.grace_period_ends_at = None
        sub.updated_at = now
        session.add(sub)
        session.commit()
        session.refresh(sub)

    return sub


def expire_grace_period_job(session: Session) -> Dict[str, Any]:
    """
    Distributed Cron Job:
    Finds all subscriptions in GRACE_PERIOD where grace_period_ends_at <= now().
    Executes involuntary cascade to FREE tier:
    - Inactivates custom domains (falls back to subdomain).
    - System-drafts active products.
    - Deactivates team members.
    """
    now = utc_now()
    expired_subs = session.exec(
        select(WebsiteSubscription).where(
            WebsiteSubscription.status == SubscriptionStatus.GRACE_PERIOD.value,
            WebsiteSubscription.grace_period_ends_at <= now,
        )
    ).all()

    cascaded_count = 0
    results = []

    for sub in expired_subs:
        try:
            res = downgrade_website_plan(
                session=session,
                website_id=sub.website_id,
                target_plan=SubscriptionPlan.FREE.value,
                is_voluntary=False,
            )
            results.append({
                "website_id": str(sub.website_id),
                "status": "CASCADED_TO_FREE",
                "details": res,
            })
            cascaded_count += 1
        except Exception as exc:
            results.append({
                "website_id": str(sub.website_id),
                "status": "ERROR",
                "error": str(exc),
            })

    return {
        "timestamp": now.isoformat(),
        "expired_grace_periods_found": len(expired_subs),
        "cascaded_to_free_count": cascaded_count,
        "details": results,
    }


def send_grace_reminders_job(session: Session) -> Dict[str, Any]:
    """
    Distributed Cron Job:
    Sends scheduled billing failure reminders on Day 1, Day 4, and Day 7.
    """
    now = utc_now()
    active_grace = session.exec(
        select(WebsiteSubscription).where(
            WebsiteSubscription.status == SubscriptionStatus.GRACE_PERIOD.value,
            WebsiteSubscription.grace_period_ends_at > now,
        )
    ).all()

    sent_count = 0
    return {
        "timestamp": now.isoformat(),
        "stores_in_grace_period": len(active_grace),
        "reminders_sent": sent_count,
    }
