from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    resolve_site_by_slug_or_404,
)
from auth_utils import (
    create_admin_token,
    create_customer_token,
    hash_password,
    verify_password,
)
from db.database import get_session
from models import Admin, AdminSite, Site, User


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


COOKIE_SECURE = False
COOKIE_SAMESITE = "lax"
ADMIN_COOKIE_NAME = "admin_token"
CUSTOMER_COOKIE_NAME = "customer_token"


class AdminSignupRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class CustomerSignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class CustomerLoginRequest(BaseModel):
    email: EmailStr
    password: str


def set_auth_cookie(
    response: Response,
    key: str,
    token: str,
    max_age_seconds: int = 86400,
):
    response.set_cookie(
        key=key,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        max_age=max_age_seconds,
    )


def clear_auth_cookie(response: Response, key: str):
    response.delete_cookie(
        key=key,
        path="/",
        samesite=COOKIE_SAMESITE,
    )


def validate_password_or_400(password: str):
    if not password or not password.strip():
        raise HTTPException(status_code=400, detail="Password is required")


def validate_name_or_400(name: str):
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Name is required")


def serialize_customer(user: User, site: Site) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "isActive": user.is_active,
        "siteId": str(site.id),
        "siteSlug": site.slug,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
        "updatedAt": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.post("/admin/signup")
def admin_signup(
    payload: AdminSignupRequest,
    session: Session = Depends(get_session),
):
    validate_password_or_400(payload.password)

    existing_admin = session.exec(
        select(Admin).where(Admin.email == payload.email)
    ).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin email already registered")

    admin = Admin(
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    session.add(admin)
    session.commit()
    session.refresh(admin)

    token = create_admin_token(str(admin.id))

    response = JSONResponse(
        content={
            "admin": {
                "id": str(admin.id),
                "email": admin.email,
            }
        }
    )
    set_auth_cookie(response, ADMIN_COOKIE_NAME, token)
    return response


@router.post("/admin/login")
def admin_login(
    payload: AdminLoginRequest,
    session: Session = Depends(get_session),
):
    validate_password_or_400(payload.password)

    admin = session.exec(
        select(Admin).where(Admin.email == payload.email)
    ).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_admin_token(str(admin.id))

    owned_sites = session.exec(
        select(Site)
        .join(AdminSite, AdminSite.site_id == Site.id)
        .where(AdminSite.admin_id == admin.id)
    ).all()

    response = JSONResponse(
        content={
            "admin": {
                "id": str(admin.id),
                "email": admin.email,
            },
            "sites": [
                {
                    "id": str(site.id),
                    "slug": site.slug,
                    "version": site.version,
                }
                for site in owned_sites
            ],
        }
    )
    set_auth_cookie(response, ADMIN_COOKIE_NAME, token)
    return response


@router.get("/admin/sites")
def get_admin_sites(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]

    sites = session.exec(
        select(Site)
        .join(AdminSite, AdminSite.site_id == Site.id)
        .where(AdminSite.admin_id == admin_id)
        .order_by(Site.created_at.desc())
    ).all()

    return sites


@router.post("/admin/logout")
def admin_logout(response: Response):
    clear_auth_cookie(response, ADMIN_COOKIE_NAME)
    return {"message": "Admin logged out"}


@router.post("/customer/signup/{website_name}")
def customer_signup(
    website_name: str,
    payload: CustomerSignupRequest,
    session: Session = Depends(get_session),
):
    validate_name_or_400(payload.name)
    validate_password_or_400(payload.password)

    site = resolve_site_by_slug_or_404(website_name, session)

    existing_user = session.exec(
        select(User).where(
            User.site_id == site.id,
            User.email == payload.email,
        )
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered for this site")

    user = User(
        site_id=site.id,
        name=payload.name.strip(),
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_customer_token(str(user.id), str(site.id))

    response = JSONResponse(
        content={
            "user": serialize_customer(user, site)
        }
    )
    set_auth_cookie(response, CUSTOMER_COOKIE_NAME, token)
    return response


@router.post("/customer/login/{website_name}")
def customer_login(
    website_name: str,
    payload: CustomerLoginRequest,
    session: Session = Depends(get_session),
):
    validate_password_or_400(payload.password)

    site = resolve_site_by_slug_or_404(website_name, session)

    user = session.exec(
        select(User).where(
            User.site_id == site.id,
            User.email == payload.email,
        )
    ).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer account is inactive",
        )

    token = create_customer_token(str(user.id), str(site.id))

    response = JSONResponse(
        content={
            "user": serialize_customer(user, site)
        }
    )
    set_auth_cookie(response, CUSTOMER_COOKIE_NAME, token)
    return response


@router.get("/customer/me/{website_name}")
def customer_me(
    website_name: str,
    auth_user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    site = resolve_site_by_slug_or_404(website_name, session)

    if str(site.id) != auth_user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    user = session.get(User, auth_user["userId"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer account is inactive",
        )

    return {
        "user": serialize_customer(user, site)
    }


@router.post("/customer/logout")
def customer_logout(response: Response):
    clear_auth_cookie(response, CUSTOMER_COOKIE_NAME)
    return {"message": "Customer logged out"}