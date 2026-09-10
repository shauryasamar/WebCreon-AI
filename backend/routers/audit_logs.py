from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Dict, List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlmodel import Session, select, col, or_, and_, desc, func, distinct, delete
from auth_middleware import authenticate_admin, check_admin_has_permission
from db.database import get_session
from models import Admin, AuditLog, Site, AdminSite, Role
from services.audit_service import audit_service, ActorType, SourceType, AuditCategory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Activity & Audit Logs"])

# Friendly category labels and mapping
CATEGORY_DEFINITIONS = {
    "user_access": {
        "label": "User & Access",
        "prefixes": ["user.", "role.", "auth.", "security.", "user_", "role_"],
        "legacy": ["auth", "security", "users_access"],
    },
    "products": {
        "label": "Products",
        "prefixes": ["product.", "product_"],
        "legacy": ["products"],
    },
    "orders": {
        "label": "Orders & Returns",
        "prefixes": ["order.", "return.", "shipment.", "order_", "return_"],
        "legacy": ["orders", "order", "returns", "orders_fulfillment"],
    },
    "delivery": {
        "label": "Delivery & Shipping",
        "prefixes": ["rider.", "delivery.", "shipment.", "shiprocket.", "rider_"],
        "legacy": ["delivery", "shipping", "delivery_shipping", "riders"],
    },
    "website": {
        "label": "Home Sections & Pages",
        "prefixes": ["website.", "page.", "section."],
        "legacy": ["website", "pages", "sections", "website_store", "home_sections", "pages_policies"],
    },
    "ai": {
        "label": "AI / Copilot",
        "prefixes": ["ai."],
        "legacy": ["ai", "ai_copilot"],
    },
    "settings": {
        "label": "Checkout Charges & Policies",
        "prefixes": ["discount.", "coupon.", "delivery.", "checkout.", "checkout_settings.", "store.", "integration."],
        "legacy": ["settings", "checkout_charges", "checkout_settings", "policies"],
    },
    "discounts": {
        "label": "Discounts & Promo",
        "prefixes": ["coupon.", "discount.", "coupon_"],
        "legacy": ["discounts", "coupons", "promo", "discounts_promo"],
    },
    "financial": {
        "label": "Earnings & Ledger / Payouts",
        "prefixes": ["payout.", "payout_", "payout_account.", "payment.", "billing.", "subscription.", "escrow.", "rider.cash_settled", "ledger."],
        "legacy": ["financial", "earnings_ledger", "payouts", "ledger", "payout_settings", "earnings"],
    },
    "support": {
        "label": "Support & CRM",
        "prefixes": ["ticket.", "support."],
        "legacy": ["support", "tickets", "support_crm", "crm"],
    },
    "order": {
        "label": "Orders & Returns",
        "prefixes": ["order.", "return.", "shipment.", "order_", "return_"],
        "legacy": ["orders", "order", "returns", "orders_fulfillment"],
    },
}

ACTION_TITLE_MAP = {
    # User & Access
    "user.invited": "User Invited",
    "user.invitation_accepted": "Invitation Accepted",
    "user.activated": "User Activated",
    "user.deactivated": "User Deactivated",
    "user.removed": "User Removed",
    "user.details_changed": "User Details Changed",
    "user.role_changed": "Changed User Role",
    "user.website_access_changed": "Website Access Changed",
    "user.permission_added": "Additional Permission Added",
    "user.permission_removed": "Additional Permission Removed",
    "role.created": "Role Created",
    "role.updated": "Role Updated",
    "role.deleted": "Role Deleted",
    "auth.login": "Admin Logged In",
    "auth.logout": "Admin Logged Out",
    "auth.password_reset": "Password Reset",
    # Products
    "product.created": "Created Product",
    "product.updated": "Updated Product",
    "product.deleted": "Deleted Product",
    "product.price_changed": "Product Price Changed",
    "product.stock_changed": "Product Stock Changed",
    "product.status_changed": "Product Status Changed",
    # Orders & Returns
    "order.status_changed": "Order Status Changed",
    "order.cancelled": "Order Cancelled",
    "order.refund_issued": "Refund Issued",
    "return.approved": "Return Approved",
    "return.rejected": "Return Rejected",
    "return.pickup_dispatched": "Return Pickup Dispatched",
    "return.received": "Return Package Received",
    "return.inspected": "Return Quality Inspected",
    "return.refund_issued": "Return Refund Processed",
    "order.manually_modified": "Order Manually Modified",
    # Delivery & Riders
    "rider.created": "Delivery Rider Created",
    "rider.updated": "Delivery Rider Updated",
    "rider.deleted": "Delivery Rider Deleted",
    "rider.cash_settled": "Rider COD Cash Settled",
    "order.dispatched": "Order Dispatched",
    "order.assigned_to_rider": "Order Assigned to Rider",
    "order.rider_claimed": "Rider Claimed Order",
    "order.rider_delivered": "Rider Delivered Order",
    "order.rider_failed": "Rider Delivery Failed",
    "shiprocket.status_synced": "Shiprocket Status Synced",
    # Website
    "website.created": "Website Created",
    "website.renamed": "Website Renamed",
    "website.published": "Website Published",
    "website.unpublished": "Website Unpublished",
    "website.section_created": "Home Section Created",
    "website.section_updated": "Home Sections Updated",
    "website.home_sections_updated": "Home Sections Updated",
    "website.section_deleted": "Home Section Deleted",
    "website.page_created": "Page Created",
    "website.page_updated": "Page Updated",
    "website.page_deleted": "Page Deleted",
    "website.domain_connected": "Domain Connected",
    "website.domain_removed": "Domain Removed",
    # AI / Copilot
    "ai.page_generated": "AI Generated Page",
    "ai.section_generated": "AI Generated Section",
    "ai.section_updated": "AI Updated Section",
    "ai.product_content_updated": "AI Updated Product Content",
    "ai.store_analysis_completed": "AI Store Analysis Completed",
    "ai.website_change": "AI Copilot Website Change",
    # Settings & Coupons
    "discount.created": "Discount Created",
    "discount.updated": "Discount Updated",
    "discount.deleted": "Discount Deleted",
    "coupon.created": "Coupon Created",
    "coupon.updated": "Coupon Updated",
    "coupon.toggled": "Coupon Status Toggled",
    "coupon.deleted": "Coupon Deleted",
    "delivery.settings_changed": "Updated Delivery Settings",
    "checkout.settings_changed": "Checkout Settings Changed",
    "checkout_settings.updated": "Checkout Charges Updated",
    "store.settings_changed": "Store Settings Changed",
    "integration.connected": "Integration Connected",
    "integration.disconnected": "Integration Disconnected",
    # Financial & Payments
    "payment.captured": "Payment Captured",
    "payment.failed": "Payment Failed",
    "payment.refunded": "Payment Refunded",
    "escrow.released": "Escrow Payout Released",
    "escrow.auto_released": "Automated Escrow Released",
    "payout.initiated": "Payout Initiated",
    "payout_account.updated": "Payout Account Updated",
    "payout.settings_changed": "Payout Settings Changed",
    "payment.settings_changed": "Payment Settings Changed",
    "billing.plan_changed": "Billing Plan Changed",
    "subscription.upgraded": "Subscription Upgraded",
    "subscription.downgraded": "Subscription Downgraded",
    "subscription.cancelled": "Subscription Cancelled",
    # Support
    "ticket.assigned": "Support Ticket Assigned",
    "ticket.status_updated": "Ticket Status Updated",
    "ticket.closed": "Support Ticket Closed",
    "ticket.refund_issued": "Support Refund Issued",
    "ticket.replacement_sent": "Support Replacement Authorized",
    "ticket.action_taken": "Support Ticket Action Taken",
    "support.settings_updated": "Support Settings Updated",
    "support.agent_created": "Support Agent Created",
    "support.agent_updated": "Support Agent Updated",
    "support.agent_deleted": "Support Agent Removed",
    "ticket.reopened": "Support Ticket Re-Opened",
}


def sanitize_sensitive_data(val: Any) -> Any:
    """Recursively strip out passwords, tokens, auth keys, and card details."""
    sensitive_keys = {
        "password", "token", "secret", "authorization", "auth", "jwt",
        "api_key", "card_number", "cvv", "expiry", "access_token",
        "refresh_token", "private_key"
    }
    if isinstance(val, dict):
        sanitized = {}
        for k, v in val.items():
            k_lower = str(k).lower()
            if any(s in k_lower for s in sensitive_keys):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_sensitive_data(v)
        return sanitized
    elif isinstance(val, list):
        return [sanitize_sensitive_data(x) for x in val]
    return val


def log_activity(
    session: Session,
    action: str,
    description: str = "",
    category: Optional[str] = None,
    site_id: Optional[UUID | str] = None,
    admin_id: Optional[UUID | str] = None,
    user_id: Optional[UUID | str] = None,
    actor_email: Optional[str] = None,
    user_email: Optional[str] = None,
    actor_name: Optional[str] = None,
    user_name: Optional[str] = None,
    actor_role: Optional[str] = None,
    actor_type: Optional[str] = None,
    source: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    summary: Optional[str] = None,
    changes: Optional[dict[str, Any]] = None,
    details: Optional[dict[str, Any]] = None,
    metadata: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
    correlation_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Optional[AuditLog]:
    """
    Primary server-side helper to record high-value business actions and audit trail entries.
    Delegates to centralized audit_service.
    """
    final_admin_id = admin_id or user_id
    final_email = actor_email or user_email
    final_name = actor_name or user_name

    merged_details = dict(details or {})
    if changes:
        merged_details["changes"] = changes

    return audit_service.log_event(
        action=action,
        category=category or "general",
        actor_type=actor_type or ActorType.USER,
        actor_id=final_admin_id,
        actor_name=final_name,
        actor_email=final_email,
        actor_role=actor_role,
        source=source or SourceType.WEB_APP,
        site_id=site_id,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
        summary=summary or description,
        description=description,
        details=merged_details,
        metadata=metadata,
        status=status,
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        ip_address=ip_address,
        user_agent=user_agent,
        request=request,
        session=session,
    )


# Backward-compatible wrapper
def log_audit_event(
    session: Session,
    action: str,
    description: str,
    category: str = "general",
    site_id: Optional[UUID | str] = None,
    admin_id: Optional[UUID | str] = None,
    actor_email: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_role: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
    details: Optional[dict[str, Any]] = None,
) -> Optional[AuditLog]:
    return log_activity(
        session=session,
        action=action,
        description=description,
        category=category,
        site_id=site_id,
        admin_id=admin_id,
        actor_email=actor_email,
        actor_name=actor_name,
        actor_role=actor_role,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        details=details,
    )


def cleanup_expired_activity_logs(session: Session, retention_days: int = 90) -> int:
    """
    Permanently deletes activity records older than retention_days (90 days).
    Runs as an automated background cleanup job.
    """
    return audit_service.cleanup_expired_events(days=retention_days, session=session)


def verify_activity_access(
    admin: dict,
    session: Session,
    target_site_id: Optional[str] = None,
) -> tuple[Admin, bool, List[UUID], List[UUID]]:
    """
    Verifies authentication, active user status, View Activity permission,
    and returns (admin_obj, is_owner_or_all_access, list_of_accessible_site_ids, list_of_workspace_member_ids).
    Raises HTTP 401/403 if unauthorized.
    """
    admin_id = admin.get("adminId")
    if not admin_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required")

    try:
        a_uuid = UUID(str(admin_id))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    admin_obj = session.get(Admin, a_uuid)
    if not admin_obj or not admin_obj.is_active or admin_obj.status == "inactive":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin account is inactive or not found")

    is_owner = False
    if admin_obj.role in ("Owner", "super_admin", "owner") and not admin_obj.role_id:
        is_owner = True
    elif admin_obj.role_id:
        try:
            role_obj = session.get(Role, UUID(str(admin_obj.role_id)))
            if role_obj and role_obj.name == "Owner":
                is_owner = True
        except Exception:
            pass

    # If not owner, must have audit_logs:view or activity:view
    if not is_owner:
        has_perm = (
            check_admin_has_permission(admin_id, "audit_logs:view", session) or
            check_admin_has_permission(admin_id, "activity:view", session)
        )
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to view workspace activity.",
            )

    # 1. Identify Workspace Owner:
    if admin_obj.invited_by_admin_id:
        owner_obj = session.get(Admin, admin_obj.invited_by_admin_id)
        site_owner = owner_obj or admin_obj
    else:
        site_owner = admin_obj

    # 2. Collect workspace sites belonging to this workspace owner:
    owner_site_links = session.exec(
        select(AdminSite.site_id).where(AdminSite.admin_id == site_owner.id)
    ).all()
    owner_site_ids = set(owner_site_links)

    # Also include any direct site links for this admin
    admin_site_links = session.exec(
        select(AdminSite.site_id).where(AdminSite.admin_id == a_uuid)
    ).all()
    admin_site_ids = set(admin_site_links)

    website_access_type = getattr(admin_obj, "website_access_type", "all") or "all"
    is_all_access = is_owner or (website_access_type == "all")

    if is_all_access:
        accessible_site_ids = list(owner_site_ids | admin_site_ids)
    else:
        accessible_site_ids = list(admin_site_ids)

    # 3. Collect only team members belonging to this workspace owner/team:
    workspace_members = {site_owner.id, a_uuid}
    invited_admins = session.exec(
        select(Admin.id).where(Admin.invited_by_admin_id == site_owner.id)
    ).all()
    for mid in invited_admins:
        workspace_members.add(mid)

    if accessible_site_ids:
        linked_admins = session.exec(
            select(AdminSite.admin_id).where(AdminSite.site_id.in_(accessible_site_ids))
        ).all()
        for mid in linked_admins:
            workspace_members.add(mid)

    workspace_member_ids = list(workspace_members)

    # If a specific site was requested in the URL, verify access
    if target_site_id:
        try:
            parsed_target_uuid = UUID(str(target_site_id))
        except ValueError:
            site_by_slug = session.exec(select(Site.id).where(Site.slug == target_site_id)).first()
            parsed_target_uuid = site_by_slug if site_by_slug else None

        if parsed_target_uuid and parsed_target_uuid not in accessible_site_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have access to activity logs for this website.",
            )

    return admin_obj, is_all_access, accessible_site_ids, workspace_member_ids


def format_activity_title(action: str) -> str:
    """Convert action code into readable title."""
    if action in ACTION_TITLE_MAP:
        return ACTION_TITLE_MAP[action]
    return action.replace(".", " ").replace("_", " ").title()


def get_category_label(category: str) -> str:
    cat_lower = str(category).lower()
    if cat_lower in CATEGORY_DEFINITIONS:
        return CATEGORY_DEFINITIONS[cat_lower]["label"]
    for k, v in CATEGORY_DEFINITIONS.items():
        if cat_lower in v["legacy"]:
            return v["label"]
    return category.replace("_", " ").title()


@router.get("/admin/activity")
@router.get("/admin/sites/{site_id}/activity")
@router.get("/admin/audit-logs")
@router.get("/admin/sites/{site_id}/audit-logs")
def get_activity_feed(
    site_id: Optional[str] = None,
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    user: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_range: Optional[str] = Query("30d"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    admin: dict = Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Returns server-side paginated and filtered activity records respecting user permissions
    and strict workspace / store scoping.
    """
    admin_obj, is_all_access, accessible_site_ids, workspace_member_ids = verify_activity_access(admin, session, site_id)

    query = select(AuditLog)

    # 1. Store Authorization & Scoping
    has_specific_site = bool(site_id and site_id.strip() and site_id.lower() not in ("all", "all_sites", "null", "none"))
    if has_specific_site:
        try:
            target_uuid = UUID(str(site_id))
            query = query.where(AuditLog.site_id == target_uuid)
        except ValueError:
            site_obj = session.exec(select(Site).where(Site.slug == site_id)).first()
            if site_obj:
                query = query.where(AuditLog.site_id == site_obj.id)
            else:
                return {"items": [], "logs": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}
    else:
        if not accessible_site_ids:
            return {
                "items": [], "logs": [], "total": 0, "page": page, "page_size": page_size,
                "total_pages": 1, "available_users": [], "available_sites": [], "available_sources": []
            }
        query = query.where(
            or_(
                AuditLog.site_id.in_(accessible_site_ids),
                and_(AuditLog.site_id.is_(None), AuditLog.admin_id.in_(workspace_member_ids)),
            )
        )

    # 2. Date Filtering (Default: Last 30 Days)
    now_utc = datetime.now(timezone.utc)
    if date_range == "today":
        cutoff = now_utc - timedelta(hours=24)
        query = query.where(AuditLog.created_at >= cutoff)
    elif date_range == "7d":
        cutoff = now_utc - timedelta(days=7)
        query = query.where(AuditLog.created_at >= cutoff)
    elif date_range == "30d":
        cutoff = now_utc - timedelta(days=30)
        query = query.where(AuditLog.created_at >= cutoff)
    elif date_range == "90d":
        cutoff = now_utc - timedelta(days=90)
        query = query.where(AuditLog.created_at >= cutoff)
    elif date_range == "custom":
        if from_date:
            try:
                dt_from = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
                query = query.where(AuditLog.created_at >= dt_from)
            except Exception:
                pass
        if to_date:
            try:
                dt_to = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
                query = query.where(AuditLog.created_at <= dt_to)
            except Exception:
                pass
    elif from_date or to_date:
        if from_date:
            try:
                dt_from = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
                query = query.where(AuditLog.created_at >= dt_from)
            except Exception:
                pass
        if to_date:
            try:
                dt_to = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
                query = query.where(AuditLog.created_at <= dt_to)
            except Exception:
                pass

    # 3. Category Filtering
    if category and category != "all":
        cat_lower = category.lower()
        if cat_lower in CATEGORY_DEFINITIONS:
            prefixes = CATEGORY_DEFINITIONS[cat_lower]["prefixes"]
            prefix_clauses = [AuditLog.action.startswith(p) for p in prefixes]
            legacy_keys = CATEGORY_DEFINITIONS[cat_lower]["legacy"] + [cat_lower]
            query = query.where(or_(AuditLog.category.in_(legacy_keys), *prefix_clauses))
        else:
            query = query.where(AuditLog.category == category)

    # 4. Source / Origin Filtering
    if source and source != "all":
        src_lower = source.lower()
        if src_lower in ("users", "user", "owner", "team_member", "dashboard", "admin"):
            query = query.where(or_(
                AuditLog.actor_type.in_(["USER", "OWNER", "TEAM_MEMBER"]),
                AuditLog.source.in_(["web_app", "WEB_ADMIN"]),
            ))
        elif src_lower in ("riders", "rider"):
            query = query.where(or_(
                AuditLog.actor_type == "RIDER",
                AuditLog.source == "RIDER_PWA",
            ))
        elif src_lower in ("shiprocket", "shipping"):
            query = query.where(or_(
                AuditLog.actor_type == "SHIPROCKET",
                AuditLog.source.ilike("%shiprocket%"),
            ))
        elif src_lower in ("payments", "razorpay"):
            query = query.where(or_(
                AuditLog.actor_type == "PAYMENT_PROVIDER",
                AuditLog.source.ilike("%razorpay%"),
            ))
        elif src_lower in ("ai", "copilot"):
            query = query.where(or_(
                AuditLog.actor_type == "AI",
                AuditLog.source.ilike("%ai%"),
            ))
        elif src_lower in ("cron", "scheduled", "system", "background"):
            query = query.where(or_(
                AuditLog.actor_type.in_(["CRON_JOB", "BACKGROUND_JOB", "SCHEDULED_TASK", "SYSTEM", "AUTOMATION"]),
                AuditLog.source.ilike("%cron%"),
                AuditLog.source.ilike("%system%"),
                AuditLog.source.ilike("%background%"),
            ))
        else:
            query = query.where(or_(
                AuditLog.source == source,
                AuditLog.actor_type == source,
            ))

    # 5. User / Actor Filter
    target_user = user or user_id or actor
    if target_user and target_user != "all":
        try:
            target_admin_uuid = UUID(str(target_user))
            query = query.where(or_(
                AuditLog.admin_id == target_admin_uuid,
                AuditLog.actor_email.ilike(f"%{target_user}%"),
                AuditLog.actor_name.ilike(f"%{target_user}%"),
            ))
        except ValueError:
            query = query.where(or_(
                AuditLog.actor_email.ilike(f"%{target_user}%"),
                AuditLog.actor_name.ilike(f"%{target_user}%"),
            ))

    # 6. Status Filter
    if status_filter and status_filter != "all":
        query = query.where(AuditLog.status == status_filter)

    # 7. Search Query (user name, email, description, action code, resource name, summary)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                AuditLog.description.ilike(term),
                AuditLog.action.ilike(term),
                AuditLog.actor_name.ilike(term),
                AuditLog.actor_email.ilike(term),
                AuditLog.resource_name.ilike(term),
                AuditLog.resource_type.ilike(term),
                AuditLog.summary.ilike(term),
            )
        )

    # Count total for server-side pagination
    try:
        count_q = select(func.count()).select_from(query.subquery())
        total_count = session.exec(count_q).one() or 0
    except Exception:
        total_count = 0

    # Paginated results
    query = query.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size)
    try:
        results = session.exec(query).all()
    except Exception as err:
        logger.error("Error executing activity query: %s", err)
        results = []

    # Pre-fetch site brand names for display
    site_ids_to_lookup = {r.site_id for r in results if r.site_id}
    sites_map = {}
    if site_ids_to_lookup:
        site_records = session.exec(select(Site).where(Site.id.in_(site_ids_to_lookup))).all()
        for s in site_records:
            brand_name = (
                (s.site_definition or {}).get("site", {}).get("brand_name")
                or (s.site_definition or {}).get("site", {}).get("title")
                or (s.site_definition or {}).get("brand_name")
                or s.slug
            )
            sites_map[s.id] = {"id": str(s.id), "name": brand_name, "slug": s.slug}

    # Fetch available sites for dropdown
    available_sites = []
    if accessible_site_ids:
        user_sites = session.exec(select(Site).where(Site.id.in_(accessible_site_ids))).all()
        available_sites = [
            {
                "id": str(s.id),
                "name": (
                    (s.site_definition or {}).get("site", {}).get("brand_name")
                    or (s.site_definition or {}).get("site", {}).get("title")
                    or (s.site_definition or {}).get("brand_name")
                    or s.slug
                ),
                "slug": s.slug,
            }
            for s in user_sites
        ]

    # Fetch available unique users for dropdown and map admin details (strictly scoped to workspace)
    available_users = []
    admins_by_id = {}
    if workspace_member_ids:
        try:
            team_admins = session.exec(
                select(Admin.id, Admin.name, Admin.email, Admin.role)
                .where(Admin.id.in_(workspace_member_ids))
            ).all()
            for a in team_admins:
                a_id_str = str(a[0])
                r_label = "Owner" if a[3] in ("super_admin", "Owner", "owner") else (a[3] or "Admin")
                name_val = (a[1] or "").strip() or a[2].split("@")[0].title()
                admins_by_id[a_id_str] = {
                    "id": a_id_str,
                    "name": name_val,
                    "email": a[2],
                    "role": r_label,
                }
                available_users.append({
                    "id": a_id_str,
                    "name": name_val,
                    "email": a[2],
                    "role": r_label,
                })
        except Exception:
            pass

    available_sources = [
        {"id": "all", "name": "All Sources"},
        {"id": "users", "name": "Team & Store Owners"},
        {"id": "riders", "name": "Delivery Riders"},
        {"id": "shiprocket", "name": "Shiprocket"},
        {"id": "payments", "name": "Razorpay Gateway"},
        {"id": "ai", "name": "AI Copilot"},
        {"id": "cron", "name": "Automated Cron / Background"},
    ]

    formatted_items = []
    for log in results:
        site_info = sites_map.get(log.site_id) if log.site_id else None
        details_obj = log.details or {}

        changes = details_obj.get("changes") if isinstance(details_obj, dict) else None
        res_type = log.resource_type or details_obj.get("resource_type")
        res_id = log.resource_id or details_obj.get("resource_id")
        res_name = log.resource_name or details_obj.get("resource_name")

        human_activity = format_activity_title(log.action)
        cat_label = get_category_label(log.category)
        created_iso = log.created_at.isoformat() if log.created_at else None

        # Resolve actor dynamically from admins map if admin_id is known
        admin_info = admins_by_id.get(str(log.admin_id)) if log.admin_id else None
        display_actor_name = log.actor_name
        if not display_actor_name or display_actor_name.strip().lower() == "staff":
            if admin_info:
                display_actor_name = admin_info["name"]
            elif log.actor_email:
                display_actor_name = log.actor_email.split("@")[0].title()
            else:
                display_actor_name = "Staff"

        display_actor_role = log.actor_role
        if not display_actor_role or display_actor_role.strip().lower() == "staff":
            if admin_info:
                display_actor_role = admin_info["role"]
            else:
                display_actor_role = "Staff"

        display_actor_email = log.actor_email or (admin_info["email"] if admin_info else None)

        # Clean up formulaic/robotic summary texts (e.g. "Staff performed Product Updated Green Linen Shirt")
        clean_summary = log.summary or log.description
        if clean_summary:
            if "performed Product Updated" in clean_summary or "Staff performed" in clean_summary:
                clean_summary = log.description or (f"Updated product '{res_name}'" if res_name else human_activity)

        formatted_items.append({
            "id": str(log.id),
            "created_at": created_iso,
            "timestamp": created_iso,
            "activity": human_activity,
            "action": log.action,
            "category": log.category,
            "category_label": cat_label,
            "actor_type": log.actor_type or "USER",
            "source": log.source or "web_app",
            "correlation_id": log.correlation_id,
            "idempotency_key": log.idempotency_key,
            "description": log.description,
            "summary": clean_summary or human_activity,
            "site_id": str(log.site_id) if log.site_id else None,
            "site_name": site_info["name"] if site_info else None,
            "website": site_info,
            "website_name": site_info["name"] if site_info else "Account-wide",
            "actor": {
                "id": str(log.admin_id) if log.admin_id else None,
                "name": display_actor_name,
                "email": display_actor_email,
                "role": display_actor_role,
            },
            "actor_name": display_actor_name,
            "actor_email": display_actor_email,
            "actor_role": display_actor_role,
            "resource": {
                "type": res_type,
                "id": res_id,
                "name": res_name,
            } if (res_type or res_name) else None,
            "resource_type": res_type,
            "resource_id": res_id,
            "resource_name": res_name,
            "changes": changes,
            "status": log.status or "success",
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "details": details_obj,
        })

    return {
        "items": formatted_items,
        "logs": formatted_items,  # compatibility alias
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total_count + page_size - 1) // page_size),
        "available_users": available_users,
        "available_sites": available_sites,
        "available_sources": available_sources,
    }


@router.get("/admin/activity/export-csv")
@router.get("/admin/sites/{site_id}/activity/export-csv")
@router.get("/admin/audit-logs/export-csv")
@router.get("/admin/sites/{site_id}/audit-logs/export-csv")
def export_activity_csv(
    site_id: Optional[str] = None,
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    user: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    date_range: Optional[str] = Query("30d"),
    admin: dict = Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_obj, is_all_access, accessible_site_ids, workspace_member_ids = verify_activity_access(admin, session, site_id)

    query = select(AuditLog)
    has_specific_site = bool(site_id and site_id.strip() and site_id.lower() not in ("all", "all_sites", "null", "none"))
    if has_specific_site:
        try:
            target_uuid = UUID(str(site_id))
            query = query.where(AuditLog.site_id == target_uuid)
        except ValueError:
            site_obj = session.exec(select(Site).where(Site.slug == site_id)).first()
            if site_obj:
                query = query.where(AuditLog.site_id == site_obj.id)
            else:
                return Response(content="", media_type="text/csv")
    else:
        if not accessible_site_ids:
            return Response(content="", media_type="text/csv")
        query = query.where(
            or_(
                AuditLog.site_id.in_(accessible_site_ids),
                and_(AuditLog.site_id.is_(None), AuditLog.admin_id.in_(workspace_member_ids)),
            )
        )

    if category and category != "all":
        query = query.where(AuditLog.category == category)

    if source and source != "all":
        src_lower = source.lower()
        if src_lower in ("users", "user", "owner", "team_member", "dashboard", "admin"):
            query = query.where(or_(
                AuditLog.actor_type.in_(["USER", "OWNER", "TEAM_MEMBER"]),
                AuditLog.source.in_(["web_app", "WEB_ADMIN"]),
            ))
        elif src_lower in ("riders", "rider"):
            query = query.where(or_(
                AuditLog.actor_type == "RIDER",
                AuditLog.source == "RIDER_PWA",
            ))
        elif src_lower in ("shiprocket", "shipping"):
            query = query.where(or_(
                AuditLog.actor_type == "SHIPROCKET",
                AuditLog.source.ilike("%shiprocket%"),
            ))
        elif src_lower in ("payments", "razorpay"):
            query = query.where(or_(
                AuditLog.actor_type == "PAYMENT_PROVIDER",
                AuditLog.source.ilike("%razorpay%"),
            ))
        elif src_lower in ("cron", "system", "scheduled", "background"):
            query = query.where(or_(
                AuditLog.actor_type.in_(["CRON_JOB", "BACKGROUND_JOB", "SCHEDULED_TASK", "SYSTEM"]),
                AuditLog.source.ilike("%cron%"),
                AuditLog.source.ilike("%system%"),
            ))

    target_user = user or actor
    if target_user and target_user != "all":
        query = query.where(or_(
            AuditLog.actor_email.ilike(f"%{target_user}%"),
            AuditLog.actor_name.ilike(f"%{target_user}%"),
        ))

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(or_(
            AuditLog.description.ilike(term),
            AuditLog.action.ilike(term),
            AuditLog.actor_name.ilike(term),
            AuditLog.resource_name.ilike(term),
            AuditLog.summary.ilike(term),
        ))

    logs = session.exec(query.order_by(desc(AuditLog.created_at)).limit(2000)).all()

    # Pre-fetch site brand names for display
    site_ids_to_lookup = {r.site_id for r in logs if r.site_id}
    sites_map = {}
    if site_ids_to_lookup:
        site_records = session.exec(select(Site).where(Site.id.in_(site_ids_to_lookup))).all()
        for s in site_records:
            brand_name = (
                (s.site_definition or {}).get("site", {}).get("brand_name")
                or (s.site_definition or {}).get("site", {}).get("title")
                or (s.site_definition or {}).get("brand_name")
                or s.slug
            )
            sites_map[s.id] = brand_name

    admins_by_id = {}
    if workspace_member_ids:
        try:
            team_admins = session.exec(
                select(Admin.id, Admin.name, Admin.email, Admin.role)
                .where(Admin.id.in_(workspace_member_ids))
            ).all()
            for a in team_admins:
                a_id_str = str(a[0])
                r_label = "Owner" if a[3] in ("super_admin", "Owner", "owner") else (a[3] or "Admin")
                name_val = (a[1] or "").strip() or a[2].split("@")[0].title()
                admins_by_id[a_id_str] = {
                    "name": name_val,
                    "email": a[2],
                    "role": r_label,
                }
        except Exception:
            pass

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp (UTC)", "Website", "Activity", "Action Code", "Source", "Actor Type",
        "Category", "Performed By", "Role", "Email", "Resource", "Summary", "Status", "IP Address"
    ])

    for log in logs:
        site_name_display = sites_map.get(log.site_id, "Account-wide") if log.site_id else "Account-wide"
        admin_info = admins_by_id.get(str(log.admin_id)) if log.admin_id else None
        display_actor_name = log.actor_name
        if not display_actor_name or display_actor_name.strip().lower() == "staff":
            if admin_info:
                display_actor_name = admin_info["name"]
            elif log.actor_email:
                display_actor_name = log.actor_email.split("@")[0].title()
            else:
                display_actor_name = "Staff"

        display_actor_role = log.actor_role
        if not display_actor_role or display_actor_role.strip().lower() == "staff":
            if admin_info:
                display_actor_role = admin_info["role"]
            else:
                display_actor_role = "Staff"

        display_actor_email = log.actor_email or (admin_info["email"] if admin_info else "")

        clean_summary = log.summary or log.description
        if clean_summary:
            if "performed Product Updated" in clean_summary or "Staff performed" in clean_summary:
                clean_summary = log.description or (f"Updated product '{log.resource_name}'" if log.resource_name else format_activity_title(log.action))

        writer.writerow([
            log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "",
            site_name_display,
            format_activity_title(log.action),
            log.action,
            log.source or "web_app",
            log.actor_type or "USER",
            get_category_label(log.category),
            display_actor_name,
            display_actor_role,
            display_actor_email,
            log.resource_name or "",
            clean_summary or "",
            log.status or "success",
            log.ip_address or "",
        ])

    csv_data = output.getvalue()
    filename = f"activity_log_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
