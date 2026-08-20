from typing import Optional
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Path, Request, status
from sqlmodel import Session, select

from auth_utils import decode_token
from db.database import get_session
from models import AdminSite, Site


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

    request.state.admin = {"adminId": admin_id}
    return request.state.admin


def authenticate_customer(
    request: Request,
    customer_token: Optional[str] = Cookie(default=None, alias="customer_token"),
):
    if not customer_token:
        raise _unauthorized("Customer authentication required")

    payload = decode_token(customer_token)
    if not payload:
        raise _unauthorized("Invalid or expired customer token")

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


def enforce_site_ownership(
    site_id: UUID = Path(...),
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]

    try:
        admin_uuid = UUID(admin_id)
    except ValueError:
        raise _unauthorized("Invalid admin token payload")

    ownership = session.exec(
        select(AdminSite).where(
            AdminSite.admin_id == admin_uuid,
            AdminSite.site_id == site_id,
        )
    ).first()

    if not ownership:
        raise _forbidden("Admin does not have access to this site")

    return {
        "adminId": admin_id,
        "siteId": str(site_id),
        "roleOnSite": ownership.role_on_site,
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
    site = session.exec(
        select(Site).where(Site.slug == website_name)
    ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    return site