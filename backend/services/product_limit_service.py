from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session, select, func, update
from models import (
    AdminSite,
    Product,
    ProductDraftReason,
    Site,
    SubscriptionPlan,
    WebsiteSubscription,
    utc_now,
)

FREE_POOL_TOTAL_LIMIT = 200
STARTER_DEDICATED_LIMIT = 1000


def get_website_admin_id(session: Session, website_id: UUID) -> Optional[UUID]:
    """Retrieves the owning Admin ID for a given website."""
    sub = session.exec(
        select(WebsiteSubscription).where(WebsiteSubscription.website_id == website_id)
    ).first()
    if sub:
        return sub.admin_id

    # Fallback to AdminSite owner
    link = session.exec(
        select(AdminSite).where(
            AdminSite.site_id == website_id,
            AdminSite.role_on_site == "owner",
        )
    ).first()
    if link:
        return link.admin_id

    any_link = session.exec(
        select(AdminSite).where(AdminSite.site_id == website_id)
    ).first()
    return any_link.admin_id if any_link else None


def acquire_admin_free_pool_lock(session: Session, admin_id: UUID) -> None:
    """
    Serializes Free product pool checks per Admin using PostgreSQL advisory locks.
    Gracefully no-ops in SQLite / local mock environments.
    """
    try:
        bind = session.get_bind()
        dialect_name = bind.dialect.name if bind else ""
        if "postgres" in dialect_name:
            # Use advisory transaction lock by hashing admin UUID string
            session.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:aid))"),
                {"aid": str(admin_id)},
            )
    except Exception as e:
        # Fallback for mock/test environments
        pass


def get_free_pool_status(session: Session, admin_id: UUID) -> Dict[str, Any]:
    """
    Calculates the dynamic Free product pool status across all Free websites owned by this Admin.
    """
    # 1. Find all Free websites owned by this Admin
    free_subs = session.exec(
        select(WebsiteSubscription).where(
            WebsiteSubscription.admin_id == admin_id,
            WebsiteSubscription.plan == SubscriptionPlan.FREE.value,
            WebsiteSubscription.status != "CANCELLED",
        )
    ).all()
    free_site_ids = [sub.website_id for sub in free_subs]

    # Include any sites linked via AdminSite without an explicit subscription record
    all_owned_sites = session.exec(
        select(AdminSite.site_id).where(
            AdminSite.admin_id == admin_id,
            AdminSite.role_on_site == "owner",
        )
    ).all()
    for s_id in all_owned_sites:
        if s_id not in free_site_ids:
            sub = session.exec(
                select(WebsiteSubscription).where(WebsiteSubscription.website_id == s_id)
            ).first()
            if not sub or sub.plan == SubscriptionPlan.FREE.value:
                if s_id not in free_site_ids:
                    free_site_ids.append(s_id)

    if not free_site_ids:
        return {
            "total_limit": FREE_POOL_TOTAL_LIMIT,
            "total_used": 0,
            "available": FREE_POOL_TOTAL_LIMIT,
            "is_pooled": True,
            "sibling_breakdown": [],
        }

    # Count active products per Free website
    sibling_breakdown = []
    total_active_count = 0

    for s_id in free_site_ids:
        site_obj = session.get(Site, s_id)
        site_name = site_obj.name if site_obj else str(s_id)
        active_count = session.exec(
            select(func.count(Product.id)).where(
                Product.site_id == s_id,
                Product.is_active == True,
            )
        ).one()
        total_active_count += active_count
        sibling_breakdown.append({
            "website_id": str(s_id),
            "website_name": site_name,
            "active_products_count": active_count,
        })

    available = max(0, FREE_POOL_TOTAL_LIMIT - total_active_count)
    return {
        "total_limit": FREE_POOL_TOTAL_LIMIT,
        "total_used": total_active_count,
        "available": available,
        "is_pooled": True,
        "sibling_breakdown": sibling_breakdown,
    }


def can_activate_product(
    session: Session,
    website_id: UUID,
    product_id: Optional[UUID] = None,
) -> Tuple[bool, str]:
    """
    Enforces product limit entitlement:
    - Free: Shared pool capped at 200 products across all Free sites of this Admin.
    - Starter: Dedicated 1,000 products for this site.
    - Pro: Unlimited products.
    """
    admin_id = get_website_admin_id(session, website_id)
    if not admin_id:
        return False, "Website owner not found"

    sub = session.exec(
        select(WebsiteSubscription).where(WebsiteSubscription.website_id == website_id)
    ).first()
    current_plan = (sub.plan if sub else SubscriptionPlan.FREE.value).upper()

    if current_plan == SubscriptionPlan.PRO.value:
        return True, "Pro plan permits unlimited products"

    if current_plan == SubscriptionPlan.STARTER.value:
        active_count = session.exec(
            select(func.count(Product.id)).where(
                Product.site_id == website_id,
                Product.is_active == True,
            )
        ).one()
        if active_count >= STARTER_DEDICATED_LIMIT:
            return False, f"Starter plan product limit reached ({STARTER_DEDICATED_LIMIT} products dedicated to this website). Upgrade to Pro for unlimited products."
        return True, "Product activation allowed under Starter plan allowance"

    # Free tier: Serialize via advisory lock and calculate pool
    acquire_admin_free_pool_lock(session, admin_id)
    pool_status = get_free_pool_status(session, admin_id)

    if pool_status["total_used"] >= FREE_POOL_TOTAL_LIMIT:
        return False, (
            f"Free shared product pool limit reached ({pool_status['total_used']} / {FREE_POOL_TOTAL_LIMIT} products used). "
            f"Upgrade this website to Starter or Pro to unlock a dedicated limit."
        )

    return True, "Product activation allowed within Free shared pool"


def get_available_active_product_slots(
    session: Session,
    website_id: UUID,
) -> Optional[int]:
    """
    Returns the number of remaining active product slots allowed for this website:
    - Pro: None (Unlimited)
    - Starter: max(0, 1000 - current_active_on_site)
    - Free: max(0, 200 - total_active_across_admin_free_sites)
    """
    sub = session.exec(
        select(WebsiteSubscription).where(WebsiteSubscription.website_id == website_id)
    ).first()
    current_plan = (sub.plan if sub else SubscriptionPlan.FREE.value).upper()

    if current_plan == SubscriptionPlan.PRO.value:
        return None  # Unlimited

    if current_plan == SubscriptionPlan.STARTER.value:
        current_active = session.exec(
            select(func.count(Product.id)).where(
                Product.site_id == website_id,
                Product.is_active == True,
            )
        ).one()
        return max(0, STARTER_DEDICATED_LIMIT - current_active)

    # Free tier
    admin_id = get_website_admin_id(session, website_id)
    if not admin_id:
        return 0
    pool = get_free_pool_status(session, admin_id)
    return pool.get("available", 0)


def draft_all_products_for_website(
    session: Session,
    website_id: UUID,
    reason: str = ProductDraftReason.SYSTEM_LIMIT_EXCEEDED.value,
) -> int:
    """
    Moves all active products on a website to Draft status on plan downgrade.
    High-performance set-based SQL operation capable of handling 100k+ products instantly
    without loading full ORM models into memory.
    """
    now = utc_now()
    stmt = (
        update(Product)
        .where(
            Product.site_id == website_id,
            Product.is_active == True,
        )
        .values(
            is_active=False,
            draft_reason=reason,
            drafted_at=now,
        )
    )
    result = session.exec(stmt)
    session.commit()
    return getattr(result, "rowcount", 0)


def restore_system_drafted_products(
    session: Session,
    website_id: UUID,
    up_to_limit: Optional[int] = None,
) -> int:
    """
    Re-upgrade restoration:
    Auto-reactivates products tagged SYSTEM_LIMIT_EXCEEDED up to plan limit.
    Never auto-reactivates MERCHANT_MANUAL drafts.
    Uses set-based SQL UPDATE for instant high-throughput execution.
    """
    if up_to_limit is not None:
        # 1. Check current active count
        current_active = session.exec(
            select(func.count(Product.id)).where(
                Product.site_id == website_id,
                Product.is_active == True,
            )
        ).one()
        remaining_slots = max(0, up_to_limit - current_active)
        if remaining_slots <= 0:
            return 0

        # Query only lightweight IDs up to remaining limit
        target_ids = session.exec(
            select(Product.id)
            .where(
                Product.site_id == website_id,
                Product.is_active == False,
                Product.draft_reason == ProductDraftReason.SYSTEM_LIMIT_EXCEEDED.value,
            )
            .order_by(Product.created_at.asc())
            .limit(remaining_slots)
        ).all()

        if not target_ids:
            return 0

        stmt = (
            update(Product)
            .where(Product.site_id == website_id, Product.id.in_(target_ids))
            .values(
                is_active=True,
                draft_reason=None,
                drafted_at=None,
            )
        )
        result = session.exec(stmt)
        session.commit()
        return getattr(result, "rowcount", len(target_ids))
    else:
        # Unlimited restoration (Pro upgrade)
        stmt = (
            update(Product)
            .where(
                Product.site_id == website_id,
                Product.is_active == False,
                Product.draft_reason == ProductDraftReason.SYSTEM_LIMIT_EXCEEDED.value,
            )
            .values(
                is_active=True,
                draft_reason=None,
                drafted_at=None,
            )
        )
        result = session.exec(stmt)
        session.commit()
        return getattr(result, "rowcount", 0)


def cap_active_products_for_website(
    session: Session,
    website_id: UUID,
    max_active_limit: int,
    reason: str = ProductDraftReason.SYSTEM_LIMIT_EXCEEDED.value,
) -> int:
    """
    On plan downgrade (e.g. Pro -> Starter with 1,000 product limit):
    Keeps the first `max_active_limit` active products and drafts the excess ones.
    Uses high-speed set-based chunking without loading large product rows into memory.
    """
    active_count = session.exec(
        select(func.count(Product.id)).where(
            Product.site_id == website_id,
            Product.is_active == True,
        )
    ).one()

    if active_count <= max_active_limit:
        return 0

    excess_count = active_count - max_active_limit
    now = utc_now()

    # Select IDs of excess active products beyond the first max_active_limit
    excess_ids = session.exec(
        select(Product.id)
        .where(
            Product.site_id == website_id,
            Product.is_active == True,
        )
        .order_by(Product.created_at.asc())
        .offset(max_active_limit)
        .limit(excess_count)
    ).all()

    if not excess_ids:
        return 0

    # Chunked set-based update in batches of 5,000
    CHUNK_SIZE = 5000
    drafted_count = 0
    for i in range(0, len(excess_ids), CHUNK_SIZE):
        chunk = excess_ids[i : i + CHUNK_SIZE]
        stmt = (
            update(Product)
            .where(Product.site_id == website_id, Product.id.in_(chunk))
            .values(
                is_active=False,
                draft_reason=reason,
                drafted_at=now,
            )
        )
        result = session.exec(stmt)
        drafted_count += getattr(result, "rowcount", len(chunk))

    session.commit()
    return drafted_count

