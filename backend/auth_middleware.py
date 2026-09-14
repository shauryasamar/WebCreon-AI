from typing import Optional
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Path, Request, status
from sqlmodel import Session, select, func

from auth_utils import decode_token
from db.database import get_session
from models import Admin, AdminSite, Role, Site


def _unauthorized(detail: str = "Unauthorized") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
    )


def _forbidden(detail: str = "Forbidden") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


def authenticate_admin(
    request: Request,
    admin_token: Optional[str] = Cookie(default=None, alias="admin_token"),
    session: Session = Depends(get_session),
):
    if not admin_token:
        raise _unauthorized("Admin authentication required")

    payload = decode_token(admin_token)
    if not payload:
        raise _unauthorized("Invalid or expired admin token")

    if payload.get("tokenType") != "admin":
        raise _unauthorized("Invalid admin token")

    admin_id = payload.get("adminId")
    if not admin_id:
        raise _unauthorized("Invalid admin token payload")

    # Verify admin still exists and is active in DB
    try:
        admin_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        raise _unauthorized("Invalid admin token payload")

    admin_obj = session.get(Admin, admin_uuid)
    if not admin_obj:
        raise _unauthorized("Admin account not found")
    if not admin_obj.is_active:
        raise _unauthorized("Admin account has been deactivated")

    role_obj = None
    if admin_obj.role_id:
        try:
            r_uuid = UUID(str(admin_obj.role_id))
            role_obj = session.get(Role, r_uuid)
        except Exception:
            role_obj = None

    if not role_obj and admin_obj.role:
        role_obj = session.exec(select(Role).where(func.lower(Role.name) == admin_obj.role.strip().lower())).first()

    if role_obj:
        is_owner = (role_obj.name == "Owner")
    else:
        is_owner = bool(admin_obj.role in ("Owner", "super_admin") and not admin_obj.role_id)

    role_display = role_obj.name if role_obj else (admin_obj.role or "Staff")

    request.state.admin = {
        "adminId": admin_id,
        "name": admin_obj.name,
        "email": admin_obj.email,
        "role": role_display,
        "is_owner": is_owner,
    }
    return request.state.admin


def enforce_owner_role(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]
    try:
        admin_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        raise _unauthorized("Invalid admin token payload")

    admin_obj = session.get(Admin, admin_uuid)
    if not admin_obj or not admin_obj.is_active:
        raise _forbidden("Admin account is inactive or not found")

    role_obj = None
    if admin_obj.role_id:
        try:
            r_uuid = UUID(str(admin_obj.role_id))
            role_obj = session.get(Role, r_uuid)
        except Exception:
            role_obj = None

    if not role_obj and admin_obj.role:
        role_obj = session.exec(select(Role).where(func.lower(Role.name) == admin_obj.role.strip().lower())).first()

    if role_obj:
        is_owner = (role_obj.name == "Owner")
    else:
        is_owner = bool(admin_obj.role in ("Owner", "super_admin") and not admin_obj.role_id)

    if not is_owner:
        raise _forbidden("Access restricted: Only the workspace owner can access the onboarding agent or create new stores.")

    return admin


def authenticate_customer(
    request: Request,
    customer_token: Optional[str] = Cookie(default=None, alias="customer_token"),
):
    token = None
    payload = None

    # Determine target site identifier from path parameters or headers
    raw_target = (
        request.path_params.get("website_name")
        or request.path_params.get("site_id")
        or request.headers.get("X-Site-Id")
    )
    target_site_str = str(raw_target).strip().lower() if raw_target else None

    # 1. First priority: Authorization header (Bearer <token>)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        candidate = auth_header.replace("Bearer ", "").strip()
        p = decode_token(candidate)
        if p and p.get("tokenType") == "customer":
            token = candidate
            payload = p

    # 2. Second priority: Custom X-Customer-Token header
    if not payload:
        header_token = request.headers.get("X-Customer-Token")
        if header_token:
            p = decode_token(header_token)
            if p and p.get("tokenType") == "customer":
                token = header_token
                payload = p

    # 3. Third priority: Direct tenant-scoped cookie match
    if not payload and request.cookies and target_site_str:
        clean_base = target_site_str.split("-")[0]
        cookie_keys_to_try = [
            f"customer_token_{target_site_str}",
            f"customer_token_{clean_base}",
        ]
        if raw_target:
            cookie_keys_to_try.append(f"customer_token_{raw_target}")

        for k in cookie_keys_to_try:
            cand = request.cookies.get(k)
            if cand:
                p = decode_token(cand)
                if p and p.get("tokenType") == "customer":
                    token = cand
                    payload = p
                    break

    # 4. Fourth priority: Scan all tenant cookies in cookie jar for matching siteId
    if not payload and request.cookies and target_site_str:
        clean_base = target_site_str.split("-")[0]
        for c_name, c_val in request.cookies.items():
            if c_name.startswith("customer_token_") and c_val:
                p = decode_token(c_val)
                if p and p.get("tokenType") == "customer":
                    p_site = str(p.get("siteId", "")).lower()
                    if p_site == target_site_str or c_name.endswith(f"_{target_site_str}") or c_name.endswith(f"_{clean_base}"):
                        token = c_val
                        payload = p
                        break

    # 5. Fifth priority: Generic customer_token cookie ONLY IF it matches target site (or target site unknown)
    if not payload and customer_token:
        p = decode_token(customer_token)
        if p and p.get("tokenType") == "customer":
            p_site = str(p.get("siteId", "")).lower()
            if not target_site_str or p_site == target_site_str:
                token = customer_token
                payload = p

    if not token or not payload:
        raise _unauthorized("Customer authentication required")

    if payload.get("tokenType") != "customer":
        raise _unauthorized("Invalid customer token")

    user_id = payload.get("userId")
    site_id = payload.get("siteId")
    if not user_id or not site_id:
        raise _unauthorized("Invalid customer token payload")

    request.state.user = {
        "userId": user_id,
        "siteId": site_id,
        "isGuest": False,
    }
    return request.state.user


def authenticate_rider(
    request: Request,
    rider_token: Optional[str] = Cookie(default=None, alias="rider_token"),
):
    token = rider_token
    auth_header = request.headers.get("Authorization")
    if not token and auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()

    if not token:
        raise _unauthorized("Rider authentication required")

    payload = decode_token(token)
    if not payload:
        raise _unauthorized("Invalid or expired rider session")

    if payload.get("tokenType") != "rider":
        raise _unauthorized("Invalid rider token")

    agent_id = payload.get("agentId")
    site_id = payload.get("siteId")
    if not agent_id or not site_id:
        raise _unauthorized("Invalid rider token payload")

    request.state.rider = {
        "agentId": agent_id,
        "siteId": site_id,
    }
    return request.state.rider


def _normalize_perms(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            import json
            val = json.loads(raw)
            if isinstance(val, list):
                return [str(p).strip() for p in val if p]
        except Exception:
            return [p.strip() for p in raw.split(",") if p.strip()]
    if isinstance(raw, (list, set, tuple)):
        return [str(p).strip() for p in raw if p]
    return []


def check_admin_has_permission(admin_id: str | UUID, permission_key: str, session: Session) -> bool:
    try:
        a_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        return False

    admin_obj = session.get(Admin, a_uuid)
    if not admin_obj or not admin_obj.is_active:
        return False

    role_obj = None
    if admin_obj.role_id:
        try:
            r_uuid = UUID(str(admin_obj.role_id))
            role_obj = session.get(Role, r_uuid)
        except Exception:
            role_obj = None

    if not role_obj and admin_obj.role:
        role_obj = session.exec(select(Role).where(func.lower(Role.name) == admin_obj.role.strip().lower())).first()

    if role_obj:
        if role_obj.name == "Owner":
            return True
        role_perms = _normalize_perms(role_obj.permissions)
        user_perms = _normalize_perms(admin_obj.additional_permissions)
        all_perms = set(role_perms + user_perms)
        return permission_key in all_perms

    if admin_obj.role in ("Owner", "super_admin") and not admin_obj.role_id:
        return True

    user_perms = _normalize_perms(admin_obj.additional_permissions)
    return permission_key in set(user_perms)


def require_permission(permission_key: str):
    def _dependency(
        admin=Depends(authenticate_admin),
        session: Session = Depends(get_session),
    ):
        if not check_admin_has_permission(admin["adminId"], permission_key, session):
            raise _forbidden(f"You do not have permission to perform '{permission_key}'")
        return admin
    return _dependency


def enforce_site_ownership(
    site_id: UUID = Path(...),
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]

    try:
        admin_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        raise _unauthorized("Invalid admin token payload")

    admin_obj = session.get(Admin, admin_uuid)
    if not admin_obj or not admin_obj.is_active:
        raise _forbidden("Admin account is inactive or not found")

    role_obj = None
    if admin_obj.role_id:
        try:
            r_uuid = UUID(str(admin_obj.role_id))
            role_obj = session.get(Role, r_uuid)
        except Exception:
            role_obj = None

    if not role_obj and admin_obj.role:
        role_obj = session.exec(select(Role).where(func.lower(Role.name) == admin_obj.role.strip().lower())).first()

    if role_obj:
        is_owner = (role_obj.name == "Owner")
    else:
        is_owner = bool(admin_obj.role in ("Owner", "super_admin") and not admin_obj.role_id)

    website_access_type = getattr(admin_obj, "website_access_type", "all") or "all"
    role_display = role_obj.name if role_obj else (admin_obj.role or "Staff")

    # Check explicit AdminSite link:
    # Every admin (whether Workspace Owner or Team Member) MUST have an AdminSite record linking them to this site_id
    ownership = session.exec(
        select(AdminSite).where(
            AdminSite.admin_id == admin_uuid,
            AdminSite.site_id == site_id,
        )
    ).first()

    if not ownership:
        site_obj = session.get(Site, site_id)
        if not site_obj:
            raise HTTPException(status_code=404, detail="Website not found")
        raise _forbidden("You do not have access to this website")

    return {
        "adminId": admin_id,
        "siteId": str(site_id),
        "roleOnSite": ownership.role_on_site or ("owner" if is_owner else "staff"),
        "name": admin_obj.name,
        "email": admin_obj.email,
        "role": role_display,
        "is_owner": is_owner,
    }


def enforce_customer_site_scope(
    site_id: UUID = Path(...),
    user=Depends(authenticate_customer),
):
    token_site_id = user["siteId"]

    if str(site_id) != token_site_id:
        raise _forbidden("Customer token does not match requested site")

    return user


def resolve_site_by_slug_or_404(
    website_name: str,
    session: Session,
) -> Site:
    if not website_name or not str(website_name).strip():
        raise HTTPException(status_code=404, detail="Site not found")

    target = str(website_name).strip()
    clean_target = target.lower()

    # 1. Try direct UUID lookup
    try:
        site_uuid = UUID(target)
        site = session.get(Site, site_uuid)
        if site:
            return site
    except (ValueError, TypeError):
        pass

    # 2. Try exact slug match
    site = session.exec(
        select(Site).where((Site.slug == target) | (Site.slug == clean_target))
    ).first()
    if site:
        return site

    # 3. Try timestamped/hyphenated slug match (e.g. greenharvest matching greenharvest-178692567758)
    site = session.exec(
        select(Site)
        .where(Site.slug.startswith(f"{clean_target}-"))
        .order_by(Site.created_at.desc())
    ).first()
    if site:
        return site

    # Fallback to general slug prefix
    site = session.exec(
        select(Site)
        .where(Site.slug.startswith(clean_target))
        .order_by(Site.created_at.desc())
    ).first()
    if site:
        return site

    # 4. Try short UUID prefix match (e.g. 30bcf7ca matching 30bcf7ca-cd8a-4938-8779-10aab5e95907)
    if len(clean_target) >= 8 and all(c in "0123456789abcdef-" for c in clean_target):
        all_sites = session.exec(select(Site)).all()
        for s in all_sites:
            if str(s.id).lower().startswith(clean_target):
                return s

    raise HTTPException(status_code=404, detail=f"Site '{website_name}' not found")