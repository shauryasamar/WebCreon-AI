from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set
from uuid import UUID, uuid4
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select, func
from sqlalchemy.orm.attributes import flag_modified

from auth_middleware import authenticate_admin, check_admin_has_permission
from auth_utils import hash_password, validate_password_strength, create_admin_token
from db.database import get_session, engine
from models import Admin, AdminSite, Role, Site, utc_now

router = APIRouter(
    prefix="/users-roles",
    tags=["users-roles"],
)

# ---------------------------------------------------------------------------
# PERMISSION CATALOG DEFINITION
# ---------------------------------------------------------------------------

PERMISSION_CATALOG = [
    {
        "category": "Workspace",
        "key": "workspace",
        "modules": [
            {
                "module": "Saved Sites",
                "key": "saved_sites",
                "permissions": [
                    {"id": "saved_sites:view", "name": "View", "description": "View saved website projects and metadata"},
                    {"id": "saved_sites:delete", "name": "Delete", "description": "Permanently delete website projects", "sensitive": True},
                ],
            },
            {
                "module": "AI Copilot",
                "key": "copilot",
                "permissions": [
                    {"id": "chat:access", "name": "Access", "description": "Access AI Copilot assistant and chat capabilities"},
                ],
            },
            {
                "module": "Customize",
                "key": "customize",
                "permissions": [
                    {"id": "customize:edit", "name": "Customize", "description": "Customize layout, styling and sections"},
                    {"id": "customize:publish", "name": "Publish", "description": "Publish theme and design changes live"},
                ],
            },
            {
                "module": "Assets",
                "key": "assets",
                "permissions": [
                    {"id": "assets:view", "name": "View & Apply", "description": "Browse and apply component assets and themes"},
                ],
            },
            {
                "module": "QR & Link",
                "key": "qr_link",
                "permissions": [
                    {"id": "qr_link:view", "name": "View", "description": "View store QR code and share links"},
                ],
            },
        ],
    },
    {
        "category": "Store Control",
        "key": "store_control",
        "modules": [
            {
                "module": "Analytics",
                "key": "analytics",
                "permissions": [
                    {"id": "analytics:view", "name": "View", "description": "View sales metrics, visitors, and performance reports"},
                ],
            },
            {
                "module": "Products",
                "key": "products",
                "permissions": [
                    {"id": "products:view", "name": "View", "description": "View product inventory and catalog"},
                    {"id": "products:create", "name": "Create", "description": "Add new products and variants"},
                    {"id": "products:edit", "name": "Edit", "description": "Update prices, images, stock and details"},
                    {"id": "products:delete", "name": "Delete", "description": "Delete products from store", "sensitive": True},
                ],
            },
            {
                "module": "Orders & Returns",
                "key": "orders",
                "permissions": [
                    {"id": "orders:view", "name": "View", "description": "View customer orders and return requests"},
                    {"id": "orders:update", "name": "Update", "description": "Update order status, fulfillment and tracking"},
                    {"id": "orders:cancel", "name": "Cancel", "description": "Cancel customer orders"},
                    {"id": "orders:refund", "name": "Refund", "description": "Approve and process return refunds"},
                ],
            },
            {
                "module": "Discounts & Promo",
                "key": "discounts",
                "permissions": [
                    {"id": "discounts:view", "name": "View", "description": "View coupon codes and active promotions"},
                    {"id": "discounts:create", "name": "Create", "description": "Create discount codes and promotions"},
                    {"id": "discounts:edit", "name": "Edit", "description": "Modify coupon terms, limits and expiry"},
                    {"id": "discounts:delete", "name": "Delete", "description": "Delete promo codes"},
                ],
            },
            {
                "module": "Help & Support",
                "key": "support",
                "permissions": [
                    {"id": "support:view", "name": "View", "description": "View customer inquiries, support tickets and helpdesk"},
                    {"id": "support:respond", "name": "Respond", "description": "Reply to tickets and customer messages"},
                    {"id": "support:edit", "name": "Edit", "description": "Manage ticket assignments, priorities and notes"},
                ],
            },
            {
                "module": "Home Sections",
                "key": "home_sections",
                "permissions": [
                    {"id": "home_sections:view", "name": "View", "description": "View homepage sections configuration"},
                    {"id": "home_sections:edit", "name": "Edit", "description": "Reorder, edit banners, grids and carousel sections"},
                    {"id": "home_sections:publish", "name": "Publish", "description": "Publish homepage layout changes"},
                ],
            },
            {
                "module": "Pages & Policies",
                "key": "pages",
                "permissions": [
                    {"id": "pages:view", "name": "View", "description": "View custom store pages and legal policies"},
                    {"id": "pages:create", "name": "Create", "description": "Create new store pages or policies"},
                    {"id": "pages:edit", "name": "Edit", "description": "Edit page content, markdown and SEO meta"},
                    {"id": "pages:delete", "name": "Delete", "description": "Delete custom pages"},
                    {"id": "pages:publish", "name": "Publish", "description": "Publish pages to live storefront"},
                ],
            },
            {
                "module": "Delivery & Shipping",
                "key": "delivery",
                "permissions": [
                    {"id": "delivery:view", "name": "View", "description": "View delivery settings, riders, and shipping zones"},
                    {"id": "delivery:edit", "name": "Edit", "description": "Configure courier partners and delivery fees"},
                ],
            },
            {
                "module": "Checkout Charges",
                "key": "checkout_charges",
                "permissions": [
                    {"id": "checkout_charges:view", "name": "View", "description": "View checkout fees and tax settings"},
                    {"id": "checkout_charges:edit", "name": "Edit", "description": "Configure handling charges, platform fees and taxes"},
                ],
            },
            {
                "module": "Earnings & Ledger",
                "key": "earnings",
                "permissions": [
                    {"id": "earnings:view", "name": "View", "description": "View platform revenue, escrow records and payout ledger"},
                ],
            },
            {
                "module": "Payout Settings",
                "key": "payout_settings",
                "permissions": [
                    {"id": "payout_settings:view", "name": "View", "description": "View linked bank accounts and settlement schedule", "sensitive": True},
                    {"id": "payout_settings:edit", "name": "Edit", "description": "Change bank details and payout preferences", "sensitive": True},
                ],
            },
        ],
    },
    {
        "category": "Account & Settings",
        "key": "account_settings",
        "modules": [
            {
                "module": "Profile",
                "key": "profile",
                "permissions": [
                    {"id": "profile:view", "name": "View", "description": "View personal profile details and preferences"},
                    {"id": "profile:edit", "name": "Edit", "description": "Update personal profile, avatar, gender, timezone and theme"},
                ],
            },
            {
                "module": "Domain Settings",
                "key": "domain_settings",
                "permissions": [
                    {"id": "domain_settings:view", "name": "View", "description": "View custom domain bindings and SSL status"},
                    {"id": "domain_settings:edit", "name": "Edit", "description": "Connect custom domains and manage DNS"},
                ],
            },
            {
                "module": "Users & Roles",
                "key": "users_roles",
                "permissions": [
                    {"id": "users_roles:view", "name": "View", "description": "View team members and role configurations", "sensitive": True},
                    {"id": "users_roles:edit", "name": "Edit", "description": "Manage user invitations, roles and permissions", "sensitive": True},
                ],
            },
            {
                "module": "Billing",
                "key": "billing",
                "permissions": [
                    {"id": "billing:view", "name": "View", "description": "View subscription plan, invoices and payment methods", "sensitive": True},
                    {"id": "billing:edit", "name": "Edit", "description": "Upgrade plan and manage payment method", "sensitive": True},
                ],
            },
            {
                "module": "Activity & Audit Logs",
                "key": "audit_logs",
                "permissions": [
                    {"id": "audit_logs:view", "name": "View", "description": "View system activity, admin login history and audit events", "sensitive": True},
                ],
            },
        ],
    },
]

# Flattened list of all valid permission IDs
ALL_PERMISSION_IDS = [
    perm["id"]
    for cat in PERMISSION_CATALOG
    for mod in cat["modules"]
    for perm in mod["permissions"]
]

# Sensitive permissions restricted by default for non-owner roles
SENSITIVE_PERMISSION_IDS = [
    perm["id"]
    for cat in PERMISSION_CATALOG
    for mod in cat["modules"]
    for perm in mod["permissions"]
    if perm.get("sensitive")
]


# Default System Roles definition
DEFAULT_SYSTEM_ROLES = [
    {
        "name": "Owner",
        "description": "Full access to all features, settings and workspace permissions.",
        "is_system": True,
        "permissions": ALL_PERMISSION_IDS,
    },
    {
        "name": "Store Manager",
        "description": "Manages products, orders, promotions and day-to-day store operations.",
        "is_system": True,
        "permissions": [
            "saved_sites:view", "chat:access",
            "assets:view", "qr_link:view",
            "analytics:view",
            "products:view", "products:create", "products:edit", "products:delete",
            "orders:view", "orders:update", "orders:cancel", "orders:refund",
            "discounts:view", "discounts:create", "discounts:edit", "discounts:delete",
            "support:view", "support:respond",
            "home_sections:view", "home_sections:edit", "home_sections:publish",
            "pages:view", "pages:create", "pages:edit", "pages:publish",
            "delivery:view", "delivery:edit",
            "checkout_charges:view", "checkout_charges:edit",
            "earnings:view",
            "audit_logs:view",
            "profile:view", "profile:edit",
        ],
    },
    {
        "name": "Content Manager",
        "description": "Manages storefront content, pages, assets and visual sections.",
        "is_system": True,
        "permissions": [
            "chat:access",
            "customize:edit", "customize:publish",
            "assets:view",
            "home_sections:view", "home_sections:edit", "home_sections:publish",
            "pages:view", "pages:create", "pages:edit", "pages:delete", "pages:publish",
            "discounts:view",
            "profile:view", "profile:edit",
        ],
    },
    {
        "name": "Order Manager",
        "description": "Handles customer orders, fulfillments, returns and delivery tracking.",
        "is_system": True,
        "permissions": [
            "orders:view", "orders:update", "orders:cancel", "orders:refund",
            "delivery:view", "delivery:edit",
            "support:view",
            "qr_link:view",
            "profile:view", "profile:edit",
        ],
    },
    {
        "name": "Support Agent",
        "description": "Handles customer inquiries, support tickets and CRM messaging.",
        "is_system": True,
        "permissions": [
            "chat:access",
            "support:view", "support:respond", "support:edit",
            "orders:view",
            "profile:view", "profile:edit",
        ],
    },
]


def ensure_default_roles_and_users(session: Session):
    """Seed default system roles and ensure system role metadata and permissions are up-to-date."""
    existing_roles = {r.name: r for r in session.exec(select(Role)).all()}
    valid_perm_set = set(ALL_PERMISSION_IDS)

    # 1. Create or update system default roles
    for r_def in DEFAULT_SYSTEM_ROLES:
        if r_def["name"] not in existing_roles:
            role_obj = Role(
                name=r_def["name"],
                description=r_def["description"],
                is_system=True,
                permissions=r_def["permissions"],
            )
            session.add(role_obj)
            session.commit()
            session.refresh(role_obj)
            existing_roles[role_obj.name] = role_obj
        else:
            role_obj = existing_roles[r_def["name"]]
            if role_obj.is_system:
                role_obj.permissions = r_def["permissions"]
                session.add(role_obj)
                session.commit()

    # 2. Migrate permissions on any custom roles
    for r in session.exec(select(Role)).all():
        if not r.is_system:
            cur_perms = list(r.permissions or [])
            migrated = set()
            for p in cur_perms:
                if p in ("chat:view", "chat:send", "chat:clear", "chat:access"):
                    migrated.add("chat:access")
                elif p in ("customize:view", "customize:edit"):
                    migrated.add("customize:edit")
                elif p == "customize:publish":
                    migrated.add("customize:publish")
                elif p == "saved_sites:delete":
                    migrated.add("saved_sites:delete")
                elif p in ("saved_sites:view", "saved_sites:create", "saved_sites:edit"):
                    migrated.add("saved_sites:view")
                elif p in ("assets:view", "assets:upload", "assets:delete"):
                    migrated.add("assets:view")
                elif p in ("qr_link:view", "qr_link:generate"):
                    migrated.add("qr_link:view")
                elif p in valid_perm_set:
                    migrated.add(p)
            r.permissions = [p for p in ALL_PERMISSION_IDS if p in migrated]
            session.add(r)
    session.commit()

    owner_role = existing_roles.get("Owner")
    all_roles = {r.id: r for r in session.exec(select(Role)).all()}
    all_roles_by_name = {r.name.lower(): r for r in all_roles.values()}

    for a in session.exec(select(Admin)).all():
        if a.role_id and a.role_id in all_roles:
            target_r = all_roles[a.role_id]
            if a.role != target_r.name:
                a.role = target_r.name
                session.add(a)
        elif not a.role_id:
            matched_r = all_roles_by_name.get((a.role or "").strip().lower())
            if matched_r:
                a.role_id = matched_r.id
                a.role = matched_r.name
                session.add(a)
            elif a.role in ("super_admin", "Owner") and owner_role:
                a.role_id = owner_role.id
                a.role = "Owner"
                session.add(a)
    session.commit()


# ---------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# ---------------------------------------------------------------------------

class CreateRoleRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default="", max_length=500)
    permissions: List[str] = Field(default_factory=list)


class UpdateRoleRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    permissions: Optional[List[str]] = None


class InviteUserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role_id: UUID
    website_access_type: str = Field(default="all")  # "all" | "specific"
    site_ids: Optional[List[UUID]] = Field(default_factory=list)
    additional_permissions: Optional[List[str]] = Field(default_factory=list)


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role_id: Optional[UUID] = None
    website_access_type: Optional[str] = None
    site_ids: Optional[List[UUID]] = None
    additional_permissions: Optional[List[str]] = None
    status: Optional[str] = None


class AcceptInviteRequest(BaseModel):
    token: str
    password: str


# ---------------------------------------------------------------------------
# SERIALIZATION HELPERS
# ---------------------------------------------------------------------------

def serialize_role(role: Role, user_count: int = 0) -> Dict[str, Any]:
    return {
        "id": str(role.id),
        "name": role.name,
        "description": role.description or "",
        "is_system": role.is_system,
        "type": "Default" if role.is_system else "Custom",
        "permissions": role.permissions or [],
        "permissions_count": len(role.permissions or []),
        "users_count": user_count,
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }


def format_last_active(dt: Optional[datetime]) -> str:
    if not dt:
        return "Never"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "Just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "Yesterday"
    if days < 7:
        return f"{days} days ago"
    return dt.strftime("%b %d, %Y")


def serialize_user(
    admin: Admin,
    role: Optional[Role],
    sites: List[Site],
    request_origin: str = "http://localhost:5173",
    is_owner_override: Optional[bool] = None,
) -> Dict[str, Any]:
    inherited_permissions = role.permissions if role else []
    additional_perms = admin.additional_permissions or []
    effective_permissions = list(set(inherited_permissions + additional_perms))

    if is_owner_override is not None:
        is_owner = is_owner_override
    else:
        if role:
            is_owner = (role.name == "Owner")
        else:
            is_owner = (admin.role in ("Owner", "super_admin"))

    # Role display name
    if is_owner:
        role_display = "Owner"
    else:
        role_display = role.name if (role and role.name != "Owner") else (admin.role if admin.role not in ("Owner", "super_admin") else "Team Member")

    # Website access detail
    website_access_type = getattr(admin, "website_access_type", "all") or "all"
    if website_access_type == "all" or is_owner:
        website_access_display = "All Websites"
    elif not sites:
        website_access_display = "None"
    elif len(sites) == 1:
        brand = (sites[0].site_definition or {}).get("site", {}).get("brand_name") or sites[0].slug
        website_access_display = brand
    else:
        website_access_display = f"{len(sites)} Websites"

    # Status handling
    raw_status = getattr(admin, "status", None)
    if not raw_status:
        raw_status = "active" if admin.is_active else "inactive"

    invite_url = None
    if getattr(admin, "invitation_token", None):
        invite_url = f"{request_origin}/admin/accept-invite?token={admin.invitation_token}"

    return {
        "id": str(admin.id),
        "name": admin.name or (admin.email.split("@")[0] if admin.email else "User"),
        "email": admin.email,
        "role": role_display,
        "role_id": str(role.id) if role else (str(admin.role_id) if getattr(admin, "role_id", None) else None),
        "is_owner": is_owner,
        "is_system_role": role.is_system if role else False,
        "status": raw_status,
        "is_active": admin.is_active,
        "website_access_type": website_access_type,
        "website_access_display": website_access_display,
        "accessible_sites": [
            {
                "id": str(s.id),
                "slug": s.slug,
                "brand_name": (s.site_definition or {}).get("site", {}).get("brand_name") or s.slug,
            }
            for s in sites
        ],
        "last_active": format_last_active(admin.last_login_at),
        "last_login_at": admin.last_login_at.isoformat() if admin.last_login_at else None,
        "created_at": admin.created_at.isoformat() if admin.created_at else None,
        "inherited_permissions": inherited_permissions,
        "additional_permissions": additional_perms,
        "effective_permissions": effective_permissions,
        "invitation_pending": bool(getattr(admin, "invitation_token", None) and raw_status == "pending"),
        "invitation_url": invite_url,
    }


# ---------------------------------------------------------------------------
# PERMISSIONS CATALOG ENDPOINT
# ---------------------------------------------------------------------------

@router.get("/permissions-catalog")
def get_permissions_catalog():
    """Return the structured permission hierarchy grouped by category and module."""
    return {
        "catalog": PERMISSION_CATALOG,
        "total_permissions": len(ALL_PERMISSION_IDS),
        "all_permission_ids": ALL_PERMISSION_IDS,
        "sensitive_permission_ids": SENSITIVE_PERMISSION_IDS,
    }


# ---------------------------------------------------------------------------
# ROLES ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/roles")
def list_roles(
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """List all available system and custom roles."""
    ensure_default_roles_and_users(session)
    check_admin_has_permission(current_admin["adminId"], "users_roles:view", session)

    roles = session.exec(select(Role).order_by(Role.created_at.asc())).all()

    # Pre-calculate assigned users count for each role
    result = []
    for r in roles:
        count = session.exec(
            select(func.count(Admin.id)).where(Admin.role_id == r.id)
        ).one()
        result.append(serialize_role(r, user_count=count))

    return {"roles": result}


@router.post("/roles")
def create_role(
    payload: CreateRoleRequest,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Create a new custom role."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    name = payload.name.strip()

    # Ensure role name is unique
    existing = session.exec(select(Role).where(func.lower(Role.name) == name.lower())).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A role named '{name}' already exists")

    # Validate permission IDs against catalog
    valid_perms = [p for p in payload.permissions if p in ALL_PERMISSION_IDS]

    new_role = Role(
        name=name,
        description=payload.description.strip() if payload.description else "",
        is_system=False,
        permissions=valid_perms,
    )
    session.add(new_role)
    session.commit()
    session.refresh(new_role)

    return {"role": serialize_role(new_role, user_count=0), "message": f"Role '{name}' created successfully"}


@router.put("/roles/{role_id}")
def update_role(
    role_id: UUID,
    payload: UpdateRoleRequest,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Update a custom role or edit non-protected properties of a system role."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Owner role is fully protected from modification
    if role.name == "Owner":
        raise HTTPException(status_code=400, detail="The Owner role is protected and cannot be modified")

    if payload.name is not None and not role.is_system:
        trimmed_name = payload.name.strip()
        existing = session.exec(
            select(Role).where(func.lower(Role.name) == trimmed_name.lower(), Role.id != role_id)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"A role named '{trimmed_name}' already exists")
        role.name = trimmed_name

    if payload.description is not None:
        role.description = payload.description.strip()

    if payload.permissions is not None:
        # Validate permissions
        role.permissions = [p for p in payload.permissions if p in ALL_PERMISSION_IDS]
        flag_modified(role, "permissions")

    role.updated_at = utc_now()
    session.add(role)
    session.commit()
    session.refresh(role)

    # Count assigned users
    count = session.exec(select(func.count(Admin.id)).where(Admin.role_id == role.id)).one()

    return {"role": serialize_role(role, user_count=count), "message": f"Role '{role.name}' updated successfully"}


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: UUID,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Delete a custom role. Disallowed if system role or assigned to users."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system:
        raise HTTPException(status_code=400, detail="System default roles cannot be deleted")

    user_count = session.exec(select(func.count(Admin.id)).where(Admin.role_id == role.id)).one()
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"This role is currently assigned to {user_count} user(s). Reassign these users before deleting the role.",
        )

    session.delete(role)
    session.commit()

    return {"message": f"Role '{role.name}' deleted successfully"}


# ---------------------------------------------------------------------------
# USERS ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    request: Request,
    site_id: Optional[str] = None,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """List workspace users and team members scoped to the current site/workspace."""
    ensure_default_roles_and_users(session)
    check_admin_has_permission(current_admin["adminId"], "users_roles:view", session)

    curr_admin_id = UUID(current_admin["adminId"])
    curr_admin_obj = session.get(Admin, curr_admin_id)
    if not curr_admin_obj:
        raise HTTPException(status_code=401, detail="Current admin user not found")

    roles_by_id = {r.id: r for r in session.exec(select(Role)).all()}
    roles_by_name = {r.name: r for r in roles_by_id.values()}
    origin = request.headers.get("origin", "http://localhost:5173")

    target_site_id: Optional[UUID] = None
    if site_id:
        try:
            target_site_id = UUID(site_id)
        except Exception:
            target_site_id = None

    site_obj = session.get(Site, target_site_id) if target_site_id else None

    # Determine Site Owner & Workspace Sites
    curr_is_owner = (
        getattr(curr_admin_obj, "is_owner", False)
        or curr_admin_obj.role in ("Owner", "super_admin")
        or not curr_admin_obj.invited_by_admin_id
    )

    if curr_is_owner:
        site_owner = curr_admin_obj
    elif curr_admin_obj.invited_by_admin_id:
        site_owner = session.get(Admin, curr_admin_obj.invited_by_admin_id) or curr_admin_obj
    else:
        site_owner = curr_admin_obj

    workspace_sites: Dict[UUID, Site] = {}

    # Collect all workspace sites owned by this owner
    owner_links = session.exec(
        select(AdminSite).where(AdminSite.admin_id == site_owner.id)
    ).all()
    for ol in owner_links:
        s = session.get(Site, ol.site_id)
        if s:
            workspace_sites[s.id] = s

    if site_obj:
        workspace_sites[site_obj.id] = site_obj

    if not workspace_sites:
        for s in session.exec(select(Site)).all():
            workspace_sites[s.id] = s

    # Collect ALL team members belonging to this owner's workspace / team,
    # irrespective of which storefront is currently open in the admin builder!
    member_ids: Set[UUID] = set()

    # 1. Any admin invited by this workspace owner
    invited = session.exec(
        select(Admin).where(
            Admin.invited_by_admin_id == site_owner.id,
            Admin.id != site_owner.id
        )
    ).all()
    for u in invited:
        member_ids.add(u.id)

    # 2. Any admin linked via AdminSite to ANY of the owner's workspace sites
    if workspace_sites:
        site_members = session.exec(
            select(AdminSite).where(
                AdminSite.site_id.in_(list(workspace_sites.keys())),
                AdminSite.admin_id != site_owner.id
            )
        ).all()
        for sm in site_members:
            member_ids.add(sm.admin_id)

    # 3. If curr_admin is the owner, ensure ALL non-owner team members are always visible
    if curr_is_owner:
        all_admins = session.exec(
            select(Admin).where(
                Admin.id != site_owner.id
            )
        ).all()
        for u in all_admins:
            if not getattr(u, "is_owner", False) and u.role != "Owner":
                member_ids.add(u.id)

    # Heal any invited user who has no AdminSite records at all
    for mid in list(member_ids):
        has_any_link = session.exec(select(AdminSite).where(AdminSite.admin_id == mid)).first()
        if not has_any_link and workspace_sites:
            target_site_for_orphan = site_obj or list(workspace_sites.values())[0]
            u_obj = session.get(Admin, mid)
            if u_obj:
                role_str = (u_obj.role or "store_manager").lower().replace(" ", "_")
                session.add(AdminSite(admin_id=mid, site_id=target_site_for_orphan.id, role_on_site=role_str))
                session.commit()

    team_members: List[Admin] = []
    for mid in member_ids:
        adm = session.get(Admin, mid)
        if adm and adm.id != site_owner.id:
            team_members.append(adm)

    # Sort team members by created_at
    team_members.sort(key=lambda m: m.created_at or datetime.min)

    # Build response:
    serialized = []

    # 1. Add Site Owner (Single Owner for this site / workspace)
    if site_owner:
        owner_role = roles_by_name.get("Owner")
        owner_sites = list(workspace_sites.values())
        serialized.append(
            serialize_user(
                site_owner,
                owner_role,
                owner_sites,
                request_origin=origin,
                is_owner_override=True,
            )
        )

    # 2. Add Team Members (Guaranteed to NOT be Workspace Owner)
    for mem in team_members:
        mem_role = None
        # Check role on specific site first if site context exists
        if site_id and site_obj:
            s_link = session.exec(
                select(AdminSite).where(
                    AdminSite.admin_id == mem.id,
                    AdminSite.site_id == site_obj.id,
                )
            ).first()
            if s_link and s_link.role_on_site and s_link.role_on_site.lower() != "owner":
                matched_role = next(
                    (r for r in roles_by_id.values() if r.name.lower().replace(" ", "_") == s_link.role_on_site.lower()),
                    None
                )
                if matched_role:
                    mem_role = matched_role

        if not mem_role and mem.role_id and mem.role_id in roles_by_id:
            role_cand = roles_by_id[mem.role_id]
            if role_cand.name != "Owner":
                mem_role = role_cand

        if not mem_role and mem.role and mem.role in roles_by_name and mem.role != "Owner":
            mem_role = roles_by_name[mem.role]

        if not mem_role:
            mem_role = roles_by_name.get("Store Manager") or roles_by_name.get("Support Agent")

        # Determine accessible sites for this team member
        if getattr(mem, "website_access_type", "all") == "specific":
            mem_links = session.exec(select(AdminSite).where(AdminSite.admin_id == mem.id)).all()
            assigned_dict: Dict[UUID, Site] = {}
            for link in mem_links:
                s_mem = workspace_sites.get(link.site_id) or session.get(Site, link.site_id)
                if s_mem:
                    assigned_dict[s_mem.id] = s_mem
            assigned = list(assigned_dict.values())
        else:
            assigned = list(workspace_sites.values())

        serialized.append(
            serialize_user(
                mem,
                mem_role,
                assigned,
                request_origin=origin,
                is_owner_override=False,
            )
        )

    return {"users": serialized}


@router.post("/users/invite")
def invite_user(
    payload: InviteUserRequest,
    request: Request,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Invite a new team member or add an existing Webcreon user to this store team."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    email = payload.email.lower().strip()
    curr_adm_id = UUID(current_admin["adminId"])

    # 1. Verify role exists
    role = session.get(Role, payload.role_id)
    if not role:
        raise HTTPException(status_code=400, detail="Selected role does not exist")
    if role.name == "Owner":
        raise HTTPException(status_code=400, detail="Cannot assign Owner role to team members. Each store has only one Workspace Owner.")

    # 2. Determine workspace sites belonging to current admin
    owner_site_links = session.exec(select(AdminSite).where(AdminSite.admin_id == curr_adm_id)).all()
    owner_site_ids = {l.site_id for l in owner_site_links}
    workspace_sites = {s.id: s for s in session.exec(select(Site).where(Site.id.in_(list(owner_site_ids)))).all()}
    if not workspace_sites:
        workspace_sites = {s.id: s for s in session.exec(select(Site)).all()}
    if not owner_site_ids:
        owner_site_ids = set(workspace_sites.keys())

    # 3. Check if user already exists
    existing = session.exec(select(Admin).where(func.lower(Admin.email) == email)).first()

    if existing:
        # Check if attempting to invite themselves
        if existing.id == curr_adm_id:
            raise HTTPException(
                status_code=400,
                detail="You cannot invite yourself to your own store team.",
            )

        # Check if already a member of this workspace team
        is_already_member = False
        if existing.invited_by_admin_id == curr_adm_id:
            is_already_member = True
        elif owner_site_ids:
            existing_site_link = session.exec(
                select(AdminSite).where(
                    AdminSite.admin_id == existing.id,
                    AdminSite.site_id.in_(list(owner_site_ids)),
                )
            ).first()
            if existing_site_link:
                is_already_member = True

        if is_already_member:
            raise HTTPException(
                status_code=400,
                detail=f"'{email}' is already a member of your store team. You can edit their role and website access directly in the table.",
            )

    # 4. Prepare permissions and tokens
    valid_additional = [p for p in (payload.additional_permissions or []) if p in ALL_PERMISSION_IDS]
    invite_token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(days=7)

    if existing:
        # User already exists on Webcreon -> Add them to this store team!
        target_admin = existing
        target_admin.role = role.name
        target_admin.role_id = role.id
        target_admin.website_access_type = payload.website_access_type
        target_admin.additional_permissions = valid_additional
        if not target_admin.invited_by_admin_id:
            target_admin.invited_by_admin_id = curr_adm_id
        if payload.name and (not target_admin.name or not target_admin.name.strip()):
            target_admin.name = payload.name.strip()

        # If they already have a password set, keep active; otherwise set pending invite token
        if not target_admin.password_hash:
            target_admin.invitation_token = invite_token
            target_admin.invitation_expires_at = expires_at
            target_admin.status = "pending"
        else:
            target_admin.status = "active"
            target_admin.is_active = True

        session.add(target_admin)
        session.commit()
        session.refresh(target_admin)
    else:
        # Brand new user
        new_admin = Admin(
            email=email,
            name=payload.name.strip(),
            role=role.name,
            role_id=role.id,
            website_access_type=payload.website_access_type,
            status="pending",
            is_active=True,
            is_verified=True,
            invitation_token=invite_token,
            invitation_expires_at=expires_at,
            invited_by_admin_id=curr_adm_id,
            additional_permissions=valid_additional,
            password_hash=None,
        )
        session.add(new_admin)
        session.commit()
        session.refresh(new_admin)
        target_admin = new_admin

    # 5. Link AdminSite for target_admin
    accessible_sites = []
    role_site_str = role.name.lower().replace(" ", "_")

    if payload.website_access_type == "specific" and payload.site_ids:
        for sid in payload.site_ids:
            site_record = session.get(Site, sid)
            if site_record:
                link = session.exec(
                    select(AdminSite).where(
                        AdminSite.admin_id == target_admin.id,
                        AdminSite.site_id == sid,
                    )
                ).first()
                if not link:
                    session.add(AdminSite(admin_id=target_admin.id, site_id=sid, role_on_site=role_site_str))
                else:
                    link.role_on_site = role_site_str
                    session.add(link)
                accessible_sites.append(site_record)
        session.commit()
    else:
        # All workspace sites belonging to the inviting owner
        for sid, site_obj in workspace_sites.items():
            link = session.exec(
                select(AdminSite).where(
                    AdminSite.admin_id == target_admin.id,
                    AdminSite.site_id == sid,
                )
            ).first()
            if not link:
                session.add(AdminSite(admin_id=target_admin.id, site_id=sid, role_on_site=role_site_str))
            else:
                link.role_on_site = role_site_str
                session.add(link)
            accessible_sites.append(site_obj)
        session.commit()

    origin = request.headers.get("origin", "http://localhost:5173")
    invite_url = f"{origin}/admin/accept-invite?token={invite_token}"

    if existing and existing.password_hash:
        message = f"User {target_admin.name or email} has an existing Webcreon account and has been added to your store team as {role.name}!"
    else:
        message = f"Invitation created for {target_admin.name or email}. Share the invitation link to complete setup."

    return {
        "user": serialize_user(target_admin, role, accessible_sites, request_origin=origin, is_owner_override=False),
        "invite_url": invite_url,
        "message": message,
    }


@router.put("/users/{user_id}")
def update_user(
    user_id: UUID,
    payload: UpdateUserRequest,
    request: Request,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Update team member role, website access, or additional permissions."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    admin = session.get(Admin, user_id)
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")

    roles_by_id = {r.id: r for r in session.exec(select(Role)).all()}
    current_role = roles_by_id.get(admin.role_id)
    is_owner = (current_role and current_role.name == "Owner") or admin.role == "Owner"

    if payload.name is not None:
        admin.name = payload.name.strip()

    # If changing role
    if payload.role_id is not None:
        new_role = session.get(Role, payload.role_id)
        if not new_role:
            raise HTTPException(status_code=400, detail="Selected role does not exist")
        # Do not allow demoting primary owner
        if is_owner and new_role.name != "Owner":
            raise HTTPException(status_code=400, detail="The Owner account role cannot be changed")
        admin.role_id = new_role.id
        admin.role = new_role.name
        current_role = new_role

    # Update website access
    if payload.website_access_type is not None:
        if is_owner and payload.website_access_type != "all":
            raise HTTPException(status_code=400, detail="The Owner must have access to all websites")
        admin.website_access_type = payload.website_access_type

    # Determine workspace sites belonging to current admin
    curr_adm_id = UUID(current_admin["adminId"])
    owner_site_links = session.exec(select(AdminSite).where(AdminSite.admin_id == curr_adm_id)).all()
    owner_site_ids = {l.site_id for l in owner_site_links}
    workspace_sites = {s.id: s for s in session.exec(select(Site).where(Site.id.in_(list(owner_site_ids)))).all()}
    if not workspace_sites:
        workspace_sites = {s.id: s for s in session.exec(select(Site)).all()}

    # Update specific site links
    if payload.site_ids is not None and admin.website_access_type == "specific":
        # Remove existing links for this user
        existing_links = session.exec(
            select(AdminSite).where(
                AdminSite.admin_id == admin.id,
            )
        ).all()
        for link in existing_links:
            session.delete(link)
        # Add new
        for sid in payload.site_ids:
            site_record = session.get(Site, sid)
            if site_record:
                session.add(AdminSite(admin_id=admin.id, site_id=sid, role_on_site=admin.role.lower().replace(" ", "_")))
        session.commit()

    # Update additional permissions
    if payload.additional_permissions is not None:
        admin.additional_permissions = [p for p in payload.additional_permissions if p in ALL_PERMISSION_IDS]
        flag_modified(admin, "additional_permissions")

    # Update status if provided
    if payload.status is not None:
        if is_owner and payload.status != "active":
            raise HTTPException(status_code=400, detail="The Owner account cannot be deactivated")
        admin.status = payload.status
        admin.is_active = (payload.status == "active")

    session.add(admin)
    session.commit()
    session.refresh(admin)

    # Gather assigned sites in current workspace
    if admin.website_access_type == "specific":
        site_links = session.exec(
            select(AdminSite).where(
                AdminSite.admin_id == admin.id,
            )
        ).all()
        assigned_sites = []
        for link in site_links:
            s_rec = workspace_sites.get(link.site_id) or session.get(Site, link.site_id)
            if s_rec and s_rec not in assigned_sites:
                assigned_sites.append(s_rec)
    else:
        assigned_sites = list(workspace_sites.values())

    origin = request.headers.get("origin", "http://localhost:5173")
    return {
        "user": serialize_user(admin, current_role, assigned_sites, request_origin=origin, is_owner_override=is_owner),
        "message": f"User '{admin.name}' updated successfully",
    }


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: UUID,
    request: Request,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Deactivate user. Prevents login, preserves configuration."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    admin = session.get(Admin, user_id)
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")

    if admin.role == "Owner" or (admin.role_id and session.get(Role, admin.role_id) and session.get(Role, admin.role_id).name == "Owner"):
        raise HTTPException(status_code=400, detail="The Owner account cannot be deactivated")

    admin.is_active = False
    admin.status = "inactive"
    session.add(admin)
    session.commit()
    session.refresh(admin)

    role = session.get(Role, admin.role_id) if admin.role_id else None
    all_sites = {s.id: s for s in session.exec(select(Site)).all()}
    origin = request.headers.get("origin", "http://localhost:5173")

    return {
        "user": serialize_user(admin, role, list(all_sites.values()), request_origin=origin),
        "message": f"User '{admin.name}' has been deactivated",
    }


@router.post("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: UUID,
    request: Request,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Reactivate a deactivated user."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    admin = session.get(Admin, user_id)
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")

    admin.is_active = True
    admin.status = "active"
    session.add(admin)
    session.commit()
    session.refresh(admin)

    role = session.get(Role, admin.role_id) if admin.role_id else None
    all_sites = {s.id: s for s in session.exec(select(Site)).all()}
    origin = request.headers.get("origin", "http://localhost:5173")

    return {
        "user": serialize_user(admin, role, list(all_sites.values()), request_origin=origin),
        "message": f"User '{admin.name}' has been reactivated",
    }


@router.post("/users/{user_id}/resend-invite")
def resend_invite(
    user_id: UUID,
    request: Request,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Generate fresh invitation token and return updated invitation link."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    admin = session.get(Admin, user_id)
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")

    new_token = secrets.token_urlsafe(32)
    admin.invitation_token = new_token
    admin.invitation_expires_at = utc_now() + timedelta(days=7)
    admin.status = "pending"
    session.add(admin)
    session.commit()
    session.refresh(admin)

    origin = request.headers.get("origin", "http://localhost:5173")
    invite_url = f"{origin}/admin/accept-invite?token={new_token}"

    role = session.get(Role, admin.role_id) if admin.role_id else None
    all_sites = {s.id: s for s in session.exec(select(Site)).all()}

    return {
        "user": serialize_user(admin, role, list(all_sites.values()), request_origin=origin),
        "invite_url": invite_url,
        "message": f"Fresh invitation link generated for {admin.name}",
    }


@router.delete("/users/{user_id}")
def remove_user(
    user_id: UUID,
    current_admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Permanently remove a team member from this workspace. Owner cannot be removed."""
    check_admin_has_permission(current_admin["adminId"], "users_roles:edit", session)
    admin = session.get(Admin, user_id)
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")

    curr_adm_id = UUID(current_admin["adminId"])
    if admin.id == curr_adm_id:
        raise HTTPException(status_code=400, detail="The Owner account cannot be removed")

    if admin.role == "Owner" or (admin.role_id and session.get(Role, admin.role_id) and session.get(Role, admin.role_id).name == "Owner"):
        if admin.id == curr_adm_id:
            raise HTTPException(status_code=400, detail="The Owner account cannot be removed")

    # Determine workspace sites belonging to current admin
    owner_site_links = session.exec(select(AdminSite).where(AdminSite.admin_id == curr_adm_id)).all()
    owner_site_ids = {l.site_id for l in owner_site_links}
    if not owner_site_ids:
        owner_site_ids = {s.id for s in session.exec(select(Site)).all()}

    # Remove site links for this workspace only
    member_site_links = session.exec(select(AdminSite).where(AdminSite.admin_id == admin.id)).all()
    for link in member_site_links:
        if link.site_id in owner_site_ids:
            session.delete(link)

    name = admin.name or admin.email

    # Check remaining site links outside this workspace
    remaining_links = [l for l in member_site_links if l.site_id not in owner_site_ids]
    if admin.invited_by_admin_id == curr_adm_id and not remaining_links:
        try:
            session.delete(admin)
            session.commit()
        except Exception:
            session.rollback()
            admin.invited_by_admin_id = None
            admin.is_active = False
            session.add(admin)
            session.commit()
    else:
        if admin.invited_by_admin_id == curr_adm_id:
            admin.invited_by_admin_id = None
            session.add(admin)
        session.commit()

    return {"message": f"Team member '{name}' has been removed from workspace"}


# ---------------------------------------------------------------------------
# INVITATION ACCEPTANCE ENDPOINTS (PUBLIC)
# ---------------------------------------------------------------------------

@router.get("/invitation/{token}")
def get_invitation_details(
    token: str,
    session: Session = Depends(get_session),
):
    """Retrieve invitation details to render the Accept Invitation page."""
    admin = session.exec(select(Admin).where(Admin.invitation_token == token)).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Invitation link is invalid or has already been used")

    if admin.invitation_expires_at and admin.invitation_expires_at < utc_now():
        raise HTTPException(status_code=400, detail="This invitation link has expired. Please request a new invitation.")

    role = session.get(Role, admin.role_id) if admin.role_id else None

    return {
        "name": admin.name,
        "email": admin.email,
        "role": role.name if role else admin.role,
        "valid": True,
    }


@router.post("/accept-invite")
def accept_invitation(
    payload: AcceptInviteRequest,
    response: Response,
    session: Session = Depends(get_session),
):
    """Invited team member sets their password, activates their account and logs in."""
    err = validate_password_strength(payload.password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    admin = session.exec(select(Admin).where(Admin.invitation_token == payload.token)).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Invitation link is invalid or expired")

    if admin.invitation_expires_at and admin.invitation_expires_at < utc_now():
        raise HTTPException(status_code=400, detail="Invitation link has expired")

    admin.password_hash = hash_password(payload.password)
    admin.invitation_token = None
    admin.invitation_expires_at = None
    admin.status = "active"
    admin.is_active = True
    admin.is_verified = True
    admin.last_login_at = utc_now()
    session.add(admin)
    session.commit()
    session.refresh(admin)

    # Set auth cookie for seamless instant login
    token = create_admin_token(str(admin.id))
    response.set_cookie(
        key="admin_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
        max_age=86400,
    )

    from routers.auth import serialize_admin
    return {
        "message": "Account setup complete! You are now logged into Webcreon.",
        "admin": serialize_admin(admin, session),
    }
