"""
WebCreon AI Store Co-Pilot - Canonical Request Context & Authorization Service
Provides immutable, server-verified request context and site-scoped authorization.
"""

from dataclasses import dataclass
from typing import Optional, Any
from uuid import UUID, uuid4
from sqlmodel import Session, select
from models import Admin, AdminSite, Site, Role


@dataclass(frozen=True)
class CopilotRequestContext:
    """Immutable server-verified request context for Copilot operations."""
    request_id: UUID
    run_id: UUID
    authenticated_user_id: UUID
    site_id: UUID
    site_name: str
    site_slug: str
    thread_id: UUID
    role: str
    permissions: frozenset[str]
    is_owner: bool
    site_version: int = 1
    operation_id: Optional[UUID] = None
    idempotency_key: Optional[str] = None
    organization_id: Optional[UUID] = None


@dataclass
class AuthorizationDecision:
    """Result of an authorization check."""
    allowed: bool
    reason: str
    canonical_site: Optional[Site] = None
    context: Optional[CopilotRequestContext] = None


def authorize_site_action(
    admin_id: str | UUID,
    requested_site_id: str | UUID,
    action: str,
    session: Session,
    thread_id: Optional[str | UUID] = None,
    operation_id: Optional[str | UUID] = None,
    idempotency_key: Optional[str] = None,
    resource: Optional[Any] = None,
) -> AuthorizationDecision:
    """
    Centrally authorizes an admin to perform an action on a specific site.
    Never trusts client-supplied tenant/org IDs.
    Returns canonical site record and verified CopilotRequestContext.
    """
    try:
        a_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        return AuthorizationDecision(allowed=False, reason="Invalid admin identifier")

    try:
        s_uuid = UUID(str(requested_site_id))
    except (ValueError, TypeError):
        return AuthorizationDecision(allowed=False, reason="Invalid site identifier")

    # 1. Verify admin exists and is active
    admin_obj = session.get(Admin, a_uuid)
    if not admin_obj or not admin_obj.is_active:
        return AuthorizationDecision(allowed=False, reason="Admin account inactive or not found")

    # 2. Determine role & permissions
    role_obj = None
    if admin_obj.role_id:
        try:
            r_uuid = UUID(str(admin_obj.role_id))
            role_obj = session.get(Role, r_uuid)
        except Exception:
            role_obj = None

    if not role_obj and admin_obj.role:
        from sqlmodel import func
        role_obj = session.exec(select(Role).where(func.lower(Role.name) == admin_obj.role.strip().lower())).first()

    is_owner = bool(role_obj.name == "Owner" if role_obj else (admin_obj.role in ("Owner", "super_admin") and not admin_obj.role_id))
    role_display = role_obj.name if role_obj else (admin_obj.role or "Staff")

    # 3. Load canonical site
    site_obj = session.get(Site, s_uuid)
    if not site_obj:
        return AuthorizationDecision(allowed=False, reason="Site not found")

    # 4. Check site association (AdminSite)
    ownership = session.exec(
        select(AdminSite).where(
            AdminSite.admin_id == a_uuid,
            AdminSite.site_id == s_uuid,
        )
    ).first()

    if not ownership:
        return AuthorizationDecision(allowed=False, reason="Admin does not have access to this site")

    # 5. Check action permission
    from auth_middleware import _normalize_perms
    role_perms = _normalize_perms(role_obj.permissions) if role_obj else []
    user_perms = _normalize_perms(admin_obj.additional_permissions)
    all_perms = set(role_perms + user_perms)

    # Permission matrix by action type
    permission_map = {
        "chat:access": ["chat:access", "chat:send"],
        "chat:send": ["chat:send", "chat:access"],
        "theme:modify": ["theme:modify", "site:edit", "site:update"],
        "banner:create": ["theme:modify", "site:edit", "site:update"],
        "order:status_change": ["orders:update", "orders:manage", "orders:edit"],
        "analytics:query": ["analytics:view", "chat:access"],
        "seo:audit": ["seo:audit", "site:view", "chat:access"],
        "knowledge:query": ["chat:access", "chat:send"],
    }

    if not is_owner:
        required_keys = permission_map.get(action, [action])
        if not any(k in all_perms for k in required_keys) and not ("all" in all_perms or "*" in all_perms):
            return AuthorizationDecision(
                allowed=False,
                reason=f"Insufficient permissions for action '{action}'. Required one of: {required_keys}"
            )

    # 6. Parse / assign thread_id and operation_id
    t_uuid = UUID(str(thread_id)) if thread_id else uuid4()
    op_uuid = UUID(str(operation_id)) if operation_id else uuid4()
    req_uuid = uuid4()
    run_uuid = uuid4()

    # Determine site version
    site_version = getattr(site_obj, "version", 1) or 1
    if not isinstance(site_version, int) or site_version < 1:
        site_version = 1

    context = CopilotRequestContext(
        request_id=req_uuid,
        run_id=run_uuid,
        authenticated_user_id=a_uuid,
        site_id=s_uuid,
        site_name=getattr(site_obj, "name", "") or site_obj.slug or "Store",
        site_slug=site_obj.slug or "",
        thread_id=t_uuid,
        role=role_display,
        permissions=frozenset(all_perms),
        is_owner=is_owner,
        site_version=site_version,
        operation_id=op_uuid,
        idempotency_key=idempotency_key,
        organization_id=getattr(admin_obj, "organization_id", None),
    )

    return AuthorizationDecision(
        allowed=True,
        reason="Authorized",
        canonical_site=site_obj,
        context=context,
    )
