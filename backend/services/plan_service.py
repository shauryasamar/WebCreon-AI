import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlmodel import Session, select, col, func
from models import (
    Admin,
    AdminSite,
    Product,
    Site,
    SiteDomain,
    SubscriptionPlan,
    SubscriptionStatus,
    WebsiteSubscription,
    WebsiteSubscriptionEvent,
    WebsiteTeamMember,
    ProductDraftReason,
    utc_now,
)
from services.ai_credit_service import (
    create_batch_on_upgrade_or_renewal,
    ensure_free_base_batch,
)
from services.product_limit_service import (
    draft_all_products_for_website,
    restore_system_drafted_products,
    cap_active_products_for_website,
    get_website_admin_id,
    get_free_pool_status,
    FREE_POOL_TOTAL_LIMIT,
    STARTER_DEDICATED_LIMIT,
)
from services.team_access_service import (
    deactivate_all_team_members,
    reactivate_team_members,
)


PLAN_METADATA: Dict[str, Dict[str, Any]] = {
    "FREE": {
        "plan_name": "Free Tier",
        "monthly_price_inr": 0,
        "product_limit": 200,
        "is_product_limit_pooled": True,
        "ai_credits_monthly": 20,
        "custom_domain_allowed": False,
        "max_team_members": 1,
        "features": [
            "Up to 200 Products (Shared pool across free stores)",
            "WebCreon Subdomain (yourbrand.webcreon.in)",
            "20 AI Copilot Requests / month",
            "Standard Checkout & Storefront",
        ],
    },
    "STARTER": {
        "plan_name": "WebCreon Starter",
        "monthly_price_inr": 199,
        "product_limit": 1000,
        "is_product_limit_pooled": False,
        "ai_credits_monthly": 100,
        "custom_domain_allowed": True,
        "max_team_members": 1,
        "features": [
            "Up to 1,000 Products (Dedicated per store)",
            "Custom Domain Support (shop.yourbrand.com / www.yourbrand.com)",
            "Free Automated SSL Certificate",
            "100 AI Copilot Requests / month",
            "Standard Checkout & Storefront",
        ],
    },
    "PRO": {
        "plan_name": "WebCreon Growth Pro",
        "monthly_price_inr": 499,
        "product_limit": None,
        "is_product_limit_pooled": False,
        "ai_credits_monthly": 500,
        "custom_domain_allowed": True,
        "max_team_members": 10,
        "features": [
            "Unlimited Products (Full capacity catalog)",
            "Custom Domain Support + Automatic Free SSL",
            "Multi-User Team Roles & Access Control (Up to 10 members)",
            "500 AI Copilot Requests / month",
            "Priority CDN & Zero Platform Watermark",
            "Advanced Analytics & CSV Reports",
        ],
    },
}


def calculate_cycle_duration_days(interval: Optional[str] = "monthly") -> int:
    """Calculates billing cycle duration in days based on interval."""
    inter = (interval or "monthly").lower().strip()
    if inter in ("yearly", "annual", "12months", "365days", "1year"):
        return 365
    elif inter in ("3months", "3_months", "quarterly", "90days"):
        return 90
    elif inter in ("6months", "6_months", "semi_annual", "180days"):
        return 180
    else:
        return 30


def compute_subscription_event_hash(
    website_id: UUID,
    admin_id: UUID,
    event_type: str,
    previous_plan: Optional[str],
    new_plan: Optional[str],
    previous_event_hash: Optional[str],
    created_at: datetime,
    metadata_json: Dict[str, Any],
) -> str:
    """Computes a tamper-evident SHA-256 hash for subscription audit trail."""
    payload = {
        "website_id": str(website_id),
        "admin_id": str(admin_id),
        "event_type": event_type,
        "previous_plan": previous_plan,
        "new_plan": new_plan,
        "previous_event_hash": previous_event_hash or "GENESIS",
        "created_at": created_at.isoformat() if created_at else "",
        "metadata": metadata_json,
    }
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def get_or_create_website_subscription(
    session: Session,
    website_id: UUID,
) -> WebsiteSubscription:
    """
    Retrieves the existing subscription for a website or provisions a default FREE subscription.
    """
    sub = session.exec(
        select(WebsiteSubscription).where(WebsiteSubscription.website_id == website_id)
    ).first()

    if sub:
        return sub

    # Find owner admin
    admin_id = get_website_admin_id(session, website_id)
    if not admin_id:
        # Fallback to any super_admin or first admin in db
        first_admin = session.exec(select(Admin)).first()
        if not first_admin:
            raise ValueError("No admin accounts exist in database to own website subscription")
        admin_id = first_admin.id

    now = utc_now()
    cycle_start = now
    cycle_end = now + timedelta(days=30)

    sub = WebsiteSubscription(
        id=uuid4(),
        website_id=website_id,
        admin_id=admin_id,
        plan=SubscriptionPlan.FREE.value,
        status=SubscriptionStatus.ACTIVE.value,
        billing_cycle_start_date=cycle_start,
        billing_cycle_end_date=cycle_end,
        is_auto_renew=True,
        provider_name="webcreon_internal",
        created_at=now,
        updated_at=now,
    )
    session.add(sub)
    session.commit()
    session.refresh(sub)

    # Provision Free base AI credit batch
    ensure_free_base_batch(session, admin_id, cycle_start)

    return sub


def get_website_plan_details(session: Session, website_id: UUID) -> Dict[str, Any]:
    """Returns full plan information, limits, usage, and custom domain capability."""
    sub = get_or_create_website_subscription(session, website_id)
    plan_meta = PLAN_METADATA.get(sub.plan, PLAN_METADATA["FREE"])

    site = session.get(Site, website_id)
    domains = session.exec(
        select(SiteDomain).where(SiteDomain.site_id == website_id)
    ).all()

    now = utc_now()
    is_grace = sub.status == SubscriptionStatus.GRACE_PERIOD.value
    grace_days_left = 0
    if is_grace and sub.grace_period_ends_at:
        ends = sub.grace_period_ends_at
        if ends.tzinfo is None:
            ends = ends.replace(tzinfo=timezone.utc)
        grace_days_left = max(0, (ends - now).days)

    # Active products count
    prod_count = session.exec(
        select(func.count(Product.id)).where(
            Product.site_id == website_id,
            Product.is_active == True,
        )
    ).one()

    # Product pool detail for Free plan
    pool_detail = None
    if sub.plan == SubscriptionPlan.FREE.value:
        try:
            pool_detail = get_free_pool_status(session, sub.admin_id)
        except Exception:
            pool_detail = None

    # Team usage calculation
    team_members_count = 1
    try:
        team_members_count = session.exec(
            select(func.count(WebsiteTeamMember.id)).where(
                WebsiteTeamMember.website_id == website_id,
                WebsiteTeamMember.is_active == True,
            )
        ).one()
    except Exception:
        team_members_count = 1

    used_team = max(1, team_members_count)
    max_team = plan_meta.get("max_team_members", 1)

    # Connected custom domain
    primary_domain = None
    for d in domains:
        if getattr(d, "is_primary", False):
            primary_domain = d.domain
            break
    if not primary_domain and domains:
        primary_domain = domains[0].domain

    commission_rates = {
        "FREE": (0.05, "5%"),
        "STARTER": (0.035, "3.5%"),
        "PRO": (0.02, "2%"),
    }
    comm_rate, comm_str = commission_rates.get(sub.plan, (0.05, "5%"))
    cycle_total_days = max(1, (sub.billing_cycle_end_date - sub.billing_cycle_start_date).days)
    days_left = max(0, (sub.billing_cycle_end_date - now).days)
    
    if cycle_total_days >= 360:
        interval_display = "1 Year (Annual)"
    elif cycle_total_days >= 85:
        interval_display = "3 Months (Quarterly)"
    elif cycle_total_days >= 170:
        interval_display = "6 Months (Semi-Annual)"
    else:
        interval_display = "30 Days (Monthly)"

    return {
        "website_id": str(website_id),
        "website_name": site.name if site else str(website_id),
        "admin_id": str(sub.admin_id),
        "slug": site.slug if site else "",
        "current_plan": sub.plan,
        "subscription_status": sub.status,
        "billing_cycle_start_date": sub.billing_cycle_start_date.isoformat(),
        "billing_cycle_end_date": sub.billing_cycle_end_date.isoformat(),
        "billing_interval": interval_display,
        "billing_cycle_total_days": cycle_total_days,
        "days_left": days_left,
        "monthly_fee_inr": plan_meta.get("monthly_price_inr", 0),
        "commission_rate": comm_rate,
        "commission_percentage": comm_str,
        "is_auto_renew": sub.is_auto_renew,
        "is_grace_period": is_grace,
        "grace_period_ends_at": sub.grace_period_ends_at.isoformat() if sub.grace_period_ends_at else None,
        "grace_days_left": grace_days_left,
        "product_usage": {
            "used": prod_count,
            "limit": plan_meta.get("product_limit"),
            "is_pooled": plan_meta.get("is_product_limit_pooled", False),
            "pool_detail": pool_detail,
        },
        "team_usage": {
            "used": used_team,
            "limit": max_team,
            "available": max(0, max_team - used_team),
        },
        "custom_domain": {
            "enabled": plan_meta.get("custom_domain_allowed", False),
            "connected_domain": primary_domain,
        },
        "ai_credits_cycle_allocation": plan_meta.get("ai_credits_monthly", 20),
        "branding_removal_allowed": sub.plan in ("STARTER", "PRO"),
        "last_updated_at": sub.updated_at.isoformat() if sub.updated_at else now.isoformat(),
        "plan_metadata": plan_meta,
        "custom_domain_allowed": plan_meta.get("custom_domain_allowed", False),
        "connected_custom_domains_count": len(domains),
    }


def upgrade_website_plan(
    session: Session,
    website_id: UUID,
    new_plan: str,
    idempotency_key: Optional[str] = None,
    provider_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Executes a plan upgrade to Starter or Pro.
    - Transitions subscription plan and extends/sets 30-day billing cycle.
    - Allocates AI credit batch.
    - Restores system drafted products.
    - Re-activates any previously deactivated custom domains and restores custom domain capabilities.
    - Reactivates team members if upgrading to Pro.
    - Emits cryptographic audit log.
    """
    target = (new_plan or "").upper().strip()
    if target not in (SubscriptionPlan.STARTER.value, SubscriptionPlan.PRO.value):
        raise ValueError(f"Invalid target upgrade plan: {new_plan}. Must be STARTER or PRO.")

    sub = get_or_create_website_subscription(session, website_id)
    prev_plan = sub.plan
    prev_status = sub.status
    now = utc_now()

    # Update subscription record
    pdata = provider_data or {}
    interval_req = pdata.get("billing_interval")
    cycle_days = calculate_cycle_duration_days(interval_req)

    sub.plan = target
    sub.status = SubscriptionStatus.ACTIVE.value
    sub.billing_cycle_start_date = now
    sub.billing_cycle_end_date = now + timedelta(days=cycle_days)
    sub.grace_period_started_at = None
    sub.grace_period_ends_at = None
    sub.updated_at = now

    if pdata.get("provider_payment_id"):
        sub.provider_payment_method_id = pdata["provider_payment_id"]
    if pdata.get("provider_subscription_id"):
        sub.provider_subscription_id = pdata["provider_subscription_id"]

    session.add(sub)
    session.commit()
    session.refresh(sub)

    # 1. Allocate AI credit batch
    create_batch_on_upgrade_or_renewal(
        session=session,
        admin_id=sub.admin_id,
        source_website_id=website_id,
        plan=target,
        cycle_start_at=now,
    )

    # 2. Restore system-drafted products
    product_limit = None if target == SubscriptionPlan.PRO.value else STARTER_DEDICATED_LIMIT
    restored_products = restore_system_drafted_products(session, website_id, up_to_limit=product_limit)

    # 3. Re-activate custom domains that were deactivated due to Free tier fallback
    domains = session.exec(
        select(SiteDomain).where(SiteDomain.site_id == website_id)
    ).all()

    reactivated_domains = 0
    for dom in domains:
        if dom.status in ("deactivated", "inactive", "disconnected"):
            # Restore to connected if DNS was previously verified or dns_required
            dom.status = "connected" if dom.last_verified_at else "dns_required"
            dom.ssl_status = "ssl_active" if dom.last_verified_at else "ssl_pending"
            dom.error_message = None
            dom.updated_at = now
            session.add(dom)
            reactivated_domains += 1

    # Ensure a connected primary domain is designated if one exists
    has_primary = any(d.is_primary and d.status == "connected" for d in domains)
    if not has_primary:
        connected_dom = next((d for d in domains if d.status == "connected"), None)
        if connected_dom:
            connected_dom.is_primary = True
            session.add(connected_dom)

    session.commit()

    # 4. Reactivate team members if Pro
    reactivated_team = 0
    if target == SubscriptionPlan.PRO.value:
        reactivated_team = reactivate_team_members(session, website_id)

    # 5. Cryptographic subscription event log
    last_event = session.exec(
        select(WebsiteSubscriptionEvent)
        .where(WebsiteSubscriptionEvent.website_id == website_id)
        .order_by(WebsiteSubscriptionEvent.created_at.desc())
    ).first()
    prev_hash = last_event.event_hash if last_event else None

    meta = {
        "restored_products_count": restored_products,
        "reactivated_domains_count": reactivated_domains,
        "reactivated_team_members_count": reactivated_team,
        "provider_data": pdata,
    }
    evt_hash = compute_subscription_event_hash(
        website_id=website_id,
        admin_id=sub.admin_id,
        event_type="UPGRADE",
        previous_plan=prev_plan,
        new_plan=target,
        previous_event_hash=prev_hash,
        created_at=now,
        metadata_json=meta,
    )
    event_rec = WebsiteSubscriptionEvent(
        id=uuid4(),
        website_id=website_id,
        admin_id=sub.admin_id,
        event_type="UPGRADE",
        previous_plan=prev_plan,
        new_plan=target,
        previous_status=prev_status,
        new_status=sub.status,
        source="USER" if not pdata.get("webhook") else "PAYMENT_WEBHOOK",
        idempotency_key=idempotency_key,
        metadata_json=meta,
        previous_event_hash=prev_hash,
        event_hash=evt_hash,
        created_at=now,
    )
    session.add(event_rec)
    session.commit()

    try:
        from routers.products import catalog_cache
        catalog_cache.invalidate_site(website_id)
    except Exception:
        pass

    # 6. Generate Statutory Rule 46 Tax Invoice for paid upgrade
    if target in (SubscriptionPlan.STARTER.value, SubscriptionPlan.PRO.value):
        try:
            from services.subscription_invoice_service import create_subscription_invoice
            interval_str = pdata.get("billing_interval") or "monthly"
            if interval_str in ("yearly", "annual", "12months"):
                amt = 4999.0 if target == "PRO" else 1999.0
            elif interval_str in ("3months", "quarterly"):
                amt = 1299.0 if target == "PRO" else 549.0
            else:
                amt = 499.0 if target == "PRO" else 199.0

            create_subscription_invoice(
                session=session,
                website_id=website_id,
                admin_id=sub.admin_id,
                plan=target,
                billing_interval=interval_str,
                start_date=sub.billing_cycle_start_date,
                end_date=sub.billing_cycle_end_date,
                total_amount_inr=amt,
                provider_payment_id=pdata.get("provider_payment_id"),
                provider_order_id=pdata.get("provider_subscription_id"),
                payment_method=pdata.get("payment_method") or pdata.get("method"),
            )
        except Exception as inv_err:
            print("Notice: Automatic invoice generation deferred:", inv_err)

    return {
        "website_id": str(website_id),
        "previous_plan": prev_plan,
        "current_plan": target,
        "status": sub.status,
        "billing_cycle_end_date": sub.billing_cycle_end_date.isoformat(),
        "custom_domain_allowed": True,
        "restored_products": restored_products,
        "reactivated_domains": reactivated_domains,
        "message": f"Successfully upgraded website to {PLAN_METADATA[target]['plan_name']}.",
    }


def downgrade_website_plan(
    session: Session,
    website_id: UUID,
    target_plan: str = "FREE",
    is_voluntary: bool = True,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes a plan downgrade to Free (or Starter if coming from Pro).
    - If target_plan is FREE:
      - Inactivates custom domains (sets status='deactivated', is_primary=False).
      - Drafts active products exceeding limit.
      - Deactivates team members.
    - Logs immutable cryptographic audit event.
    """
    target = (target_plan or "FREE").upper().strip()
    if target not in (SubscriptionPlan.FREE.value, SubscriptionPlan.STARTER.value):
        raise ValueError(f"Invalid downgrade target plan: {target_plan}")

    sub = get_or_create_website_subscription(session, website_id)
    prev_plan = sub.plan
    prev_status = sub.status
    now = utc_now()

    sub.plan = target
    sub.status = SubscriptionStatus.ACTIVE.value
    sub.grace_period_started_at = None
    sub.grace_period_ends_at = None
    sub.updated_at = now
    session.add(sub)
    session.commit()
    session.refresh(sub)

    drafted_products = 0
    restored_products = 0
    deactivated_domains = 0
    deactivated_team = 0

    if target == SubscriptionPlan.FREE.value:
        # 1. Inactivate custom domains - custom domains are NOT available on Free tier
        domains = session.exec(
            select(SiteDomain).where(SiteDomain.site_id == website_id)
        ).all()
        for dom in domains:
            dom.status = "deactivated"
            dom.is_primary = False
            dom.error_message = "Deactivated: Custom domain connection requires an active Starter or Pro subscription."
            dom.updated_at = now
            session.add(dom)
            deactivated_domains += 1

        # 2. Deactivate team members (Free tier is single owner only)
        deactivated_team = deactivate_all_team_members(session, website_id)

        # 3. Dynamic Free Product Pool Capping:
        # Calculate available slots in the Admin's shared 200 Free pool.
        # If the site already has <= available slots, 0 products are drafted.
        # If it exceeds available slots, ONLY the excess products are drafted.
        admin_id = sub.admin_id
        other_free_active_count = 0
        if admin_id:
            other_free_subs = session.exec(
                select(WebsiteSubscription.website_id).where(
                    WebsiteSubscription.admin_id == admin_id,
                    WebsiteSubscription.website_id != website_id,
                    WebsiteSubscription.plan == SubscriptionPlan.FREE.value,
                    WebsiteSubscription.status != "CANCELLED",
                )
            ).all()
            if other_free_subs:
                other_free_active_count = session.exec(
                    select(func.count(Product.id)).where(
                        Product.site_id.in_(other_free_subs),
                        Product.is_active == True,
                    )
                ).one()

        available_free_slots_for_this_site = max(0, FREE_POOL_TOTAL_LIMIT - other_free_active_count)

        # Draft any excess active products above the available Free limit
        drafted_products = cap_active_products_for_website(
            session=session,
            website_id=website_id,
            max_active_limit=available_free_slots_for_this_site,
            reason=ProductDraftReason.SYSTEM_LIMIT_EXCEEDED.value,
        )

        # Restore any system-drafted products if slots are available
        restored_products = restore_system_drafted_products(
            session=session,
            website_id=website_id,
            up_to_limit=available_free_slots_for_this_site,
        )
    elif target == SubscriptionPlan.STARTER.value and prev_plan == SubscriptionPlan.PRO.value:
        # 1. Team access is Pro exclusive; deactivate team members on downgrade to Starter
        deactivated_team = deactivate_all_team_members(session, website_id)

        # 2. Enforce Starter dedicated limit of 1,000 active products (draft excess products)
        drafted_products = cap_active_products_for_website(
            session=session,
            website_id=website_id,
            max_active_limit=STARTER_DEDICATED_LIMIT,
            reason=ProductDraftReason.SYSTEM_LIMIT_EXCEEDED.value,
        )

    session.commit()

    # Cryptographic subscription event log
    last_event = session.exec(
        select(WebsiteSubscriptionEvent)
        .where(WebsiteSubscriptionEvent.website_id == website_id)
        .order_by(WebsiteSubscriptionEvent.created_at.desc())
    ).first()
    prev_hash = last_event.event_hash if last_event else None

    meta = {
        "is_voluntary": is_voluntary,
        "drafted_products_count": drafted_products,
        "deactivated_domains_count": deactivated_domains,
        "deactivated_team_members_count": deactivated_team,
    }
    evt_hash = compute_subscription_event_hash(
        website_id=website_id,
        admin_id=sub.admin_id,
        event_type="DOWNGRADE",
        previous_plan=prev_plan,
        new_plan=target,
        previous_event_hash=prev_hash,
        created_at=now,
        metadata_json=meta,
    )
    event_rec = WebsiteSubscriptionEvent(
        id=uuid4(),
        website_id=website_id,
        admin_id=sub.admin_id,
        event_type="DOWNGRADE",
        previous_plan=prev_plan,
        new_plan=target,
        previous_status=prev_status,
        new_status=sub.status,
        source="USER" if is_voluntary else "CRON",
        idempotency_key=idempotency_key,
        metadata_json=meta,
        previous_event_hash=prev_hash,
        event_hash=evt_hash,
        created_at=now,
    )
    session.add(event_rec)
    session.commit()

    try:
        from routers.products import catalog_cache
        catalog_cache.invalidate_site(website_id)
    except Exception:
        pass

    return {
        "website_id": str(website_id),
        "previous_plan": prev_plan,
        "current_plan": target,
        "status": sub.status,
        "custom_domain_allowed": False if target == "FREE" else True,
        "drafted_products": drafted_products,
        "restored_products": restored_products,
        "deactivated_domains": deactivated_domains,
        "message": f"Website downgraded to {PLAN_METADATA[target]['plan_name']}.",
    }


def renew_website_subscription(
    session: Session,
    website_id: UUID,
    provider_payment_id: Optional[str] = None,
    provider_subscription_id: Optional[str] = None,
    billing_interval: Optional[str] = "monthly",
    event_timestamp: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Renews an active subscription for the given interval and grants a new AI credit batch."""
    sub = get_or_create_website_subscription(session, website_id)
    now = event_timestamp or utc_now()
    cycle_days = calculate_cycle_duration_days(billing_interval)

    sub.status = SubscriptionStatus.ACTIVE.value
    sub.billing_cycle_start_date = now
    sub.billing_cycle_end_date = now + timedelta(days=cycle_days)
    sub.grace_period_started_at = None
    sub.grace_period_ends_at = None
    sub.updated_at = now
    if provider_payment_id:
        sub.provider_payment_method_id = provider_payment_id
    if provider_subscription_id:
        sub.provider_subscription_id = provider_subscription_id

    session.add(sub)
    session.commit()
    session.refresh(sub)

    # Allocate new AI credit batch
    create_batch_on_upgrade_or_renewal(
        session=session,
        admin_id=sub.admin_id,
        source_website_id=website_id,
        plan=sub.plan,
        cycle_start_at=now,
    )

    # Re-verify and ensure custom domains remain connected
    if sub.plan in (SubscriptionPlan.STARTER.value, SubscriptionPlan.PRO.value):
        domains = session.exec(
            select(SiteDomain).where(SiteDomain.site_id == website_id)
        ).all()
        for dom in domains:
            if dom.status in ("deactivated", "inactive"):
                dom.status = "connected" if dom.last_verified_at else "dns_required"
                dom.ssl_status = "ssl_active" if dom.last_verified_at else "ssl_pending"
                session.add(dom)
        session.commit()

    return {
        "website_id": str(website_id),
        "plan": sub.plan,
        "status": sub.status,
        "billing_cycle_end_date": sub.billing_cycle_end_date.isoformat(),
        "message": "Subscription successfully renewed for 30 days.",
    }


def verify_subscription_audit_chain(session: Session, website_id: UUID) -> Dict[str, Any]:
    """Verifies SHA-256 chain integrity of all subscription events for a website."""
    events = session.exec(
        select(WebsiteSubscriptionEvent)
        .where(WebsiteSubscriptionEvent.website_id == website_id)
        .order_by(WebsiteSubscriptionEvent.created_at.asc())
    ).all()

    if not events:
        return {"website_id": str(website_id), "valid": True, "event_count": 0}

    expected_prev = None
    for idx, evt in enumerate(events):
        if evt.previous_event_hash != expected_prev:
            return {
                "website_id": str(website_id),
                "valid": False,
                "broken_at_index": idx,
                "broken_event_id": str(evt.id),
                "reason": "Previous event hash mismatch",
            }
        recomputed = compute_subscription_event_hash(
            website_id=evt.website_id,
            admin_id=evt.admin_id,
            event_type=evt.event_type,
            previous_plan=evt.previous_plan,
            new_plan=evt.new_plan,
            previous_event_hash=evt.previous_event_hash,
            created_at=evt.created_at,
            metadata_json=evt.metadata_json,
        )
        if recomputed != evt.event_hash:
            return {
                "website_id": str(website_id),
                "valid": False,
                "broken_at_index": idx,
                "broken_event_id": str(evt.id),
                "reason": "Event content hash mismatch",
            }
        expected_prev = evt.event_hash

    return {"website_id": str(website_id), "valid": True, "event_count": len(events)}
