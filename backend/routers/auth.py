import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select, func

logger = logging.getLogger("auth_router")

from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    check_admin_has_permission,
    resolve_site_by_slug_or_404,
)
from auth_utils import (
    create_admin_token,
    create_customer_token,
    generate_reset_token_and_otp,
    hash_password,
    hash_reset_token,
    validate_password_strength,
    verify_google_id_token,
    verify_password,
)
from db.database import get_session
from models import Admin, AdminSite, CustomerNotification, Order, ReturnRequest, Site, User, UserAddress
from services.email_service import (
    send_admin_password_reset_email,
    send_customer_password_reset_email,
)
from services.notification_service import dispatch_customer_event
from services.email_adapter import dispatch_tenant_email
from services.email_templates import render_email_template
from routers.audit_logs import log_audit_event


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
    name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = "super_admin"


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str
    gender: Optional[str] = None
    phone: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token_or_otp: str
    new_password: str


class UpdateAdminProfileRequest(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None


class CustomerSignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class CustomerLoginRequest(BaseModel):
    email: EmailStr
    password: str


class CustomerProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None


class CustomerChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str


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


def set_customer_tenant_cookies(
    response: Response,
    site: Site,
    website_name: str,
    token: str,
):
    set_auth_cookie(response, CUSTOMER_COOKIE_NAME, token)
    targets = {
        str(site.id).lower(),
        site.slug.lower(),
        website_name.lower().strip(),
        website_name.lower().strip().replace("-", ""),
        site.slug.lower().split("-")[0],
    }
    for t in targets:
        if t:
            set_auth_cookie(response, f"customer_token_{t}", token)


def validate_password_or_400(password: str):
    if not password or not password.strip():
        raise HTTPException(status_code=400, detail="Password is required")


def validate_name_or_400(name: str):
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Name is required")


def serialize_admin(admin: Admin, session: Optional[Session] = None) -> dict:
    name = getattr(admin, "name", None)
    if not name and admin.email:
        prefix = admin.email.split("@")[0]
        parts = [p.capitalize() for p in prefix.replace(".", " ").replace("_", " ").split()]
        name = " ".join(parts) if parts else "Admin"

    role_name = getattr(admin, "role", "Owner")
    permissions = []
    is_owner = False
    role_obj = None

    try:
        from routers.users_roles import ALL_PERMISSION_IDS
        from models import Role

        # 1. Resolve role object by role_id if present
        role_uuid = getattr(admin, "role_id", None)
        if role_uuid:
            try:
                role_uuid = UUID(str(role_uuid))
            except Exception:
                role_uuid = None

        if role_uuid:
            if session:
                role_obj = session.get(Role, role_uuid)
            else:
                from db.database import engine
                from sqlmodel import Session as SQLSession
                with SQLSession(engine) as s:
                    role_obj = s.get(Role, role_uuid)

        # 2. If no role_obj found by role_id, try finding by role name in Role table
        if not role_obj and getattr(admin, "role", None):
            raw_role = admin.role.strip()
            if session:
                role_obj = session.exec(select(Role).where(func.lower(Role.name) == raw_role.lower())).first()
            else:
                from db.database import engine
                from sqlmodel import Session as SQLSession
                with SQLSession(engine) as s:
                    role_obj = s.exec(select(Role).where(func.lower(Role.name) == raw_role.lower())).first()

        if role_obj:
            role_name = role_obj.name
            is_owner = (role_obj.name == "Owner")
            if is_owner:
                permissions = ALL_PERMISSION_IDS
                role_name = "Owner"
            else:
                role_perms = role_obj.permissions if role_obj.permissions else []
                user_perms = admin.additional_permissions or []
                permissions = list(set(role_perms + user_perms))
        else:
            # Fallback for accounts with neither role_id nor matching role in DB
            is_owner = bool(admin.role in ("Owner", "super_admin") and not admin.role_id)
            if is_owner:
                role_name = "Owner"
                permissions = ALL_PERMISSION_IDS
            else:
                role_name = admin.role or "Team Member"
                permissions = admin.additional_permissions or []
    except Exception:
        is_owner = bool(getattr(admin, "role", None) in ("Owner", "super_admin") and not getattr(admin, "role_id", None))
        role_name = "Owner" if is_owner else (getattr(admin, "role", None) or "Team Member")
        permissions = ALL_PERMISSION_IDS if is_owner else (getattr(admin, "additional_permissions", None) or [])

    return {
        "id": str(admin.id),
        "email": admin.email,
        "name": name or "Admin",
        "gender": getattr(admin, "gender", None),
        "phone": getattr(admin, "phone", None),
        "avatarUrl": getattr(admin, "avatar_url", None),
        "role": role_name,
        "roleId": str(admin.role_id) if getattr(admin, "role_id", None) else (str(role_obj.id) if role_obj else None),
        "isOwner": is_owner,
        "permissions": permissions,
        "websiteAccessType": getattr(admin, "website_access_type", "all") or "all",
        "status": getattr(admin, "status", "active") or "active",
        "isActive": admin.is_active,
        "authProvider": getattr(admin, "auth_provider", "email"),
        "googleId": getattr(admin, "google_id", None),
        "timezone": getattr(admin, "timezone", "Asia/Kolkata"),
        "hasPassword": bool(getattr(admin, "password_hash", None)),
        "createdAt": admin.created_at.isoformat() if getattr(admin, "created_at", None) else None,
    }



def serialize_customer(user: User, site: Site) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "gender": getattr(user, "gender", None),
        "dateOfBirth": getattr(user, "date_of_birth", None),
        "authProvider": getattr(user, "auth_provider", "local"),
        "avatarUrl": getattr(user, "avatar_url", None),
        "hasPassword": bool(getattr(user, "password_hash", None)),
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
    err = validate_password_strength(payload.password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    email = payload.email.lower().strip()

    existing_admin = session.exec(
        select(Admin).where(Admin.email == email)
    ).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin email already registered")

    admin = Admin(
        email=email,
        name=payload.name.strip() if payload.name and payload.name.strip() else None,
        gender=payload.gender,
        phone=payload.phone,
        avatar_url=payload.avatar_url,
        role=payload.role or "super_admin",
        auth_provider="email",
        password_hash=hash_password(payload.password),
        last_login_at=datetime.now(timezone.utc),
    )
    session.add(admin)
    session.commit()
    session.refresh(admin)

    token = create_admin_token(str(admin.id))

    response = JSONResponse(
        content={
            "admin": serialize_admin(admin)
        }
    )
    set_auth_cookie(response, ADMIN_COOKIE_NAME, token)
    return response


@router.post("/admin/login")
def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    validate_password_or_400(payload.password)

    email = payload.email.lower().strip()
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    admin = session.exec(
        select(Admin).where(Admin.email == email)
    ).first()
    
    if not admin:
        log_audit_event(
            session=session,
            action="auth.login_failed",
            category="security",
            status="failure",
            description=f"Failed login attempt for unknown email '{email}'",
            actor_email=email,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not getattr(admin, "is_active", True):
        log_audit_event(
            session=session,
            action="auth.login_blocked",
            category="security",
            status="warning",
            description=f"Blocked login attempt for inactive admin account '{email}'",
            admin_id=admin.id,
            actor_email=admin.email,
            actor_name=admin.name,
            actor_role=admin.role,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is inactive. Please contact support.",
        )

    if admin.auth_provider == "google" and not admin.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account was created with Google Sign-In. Please sign in with Google.",
        )

    if not verify_password(payload.password, admin.password_hash or ""):
        log_audit_event(
            session=session,
            action="auth.login_failed",
            category="security",
            status="failure",
            description=f"Failed password login attempt for admin '{email}'",
            admin_id=admin.id,
            actor_email=admin.email,
            actor_name=admin.name,
            actor_role=admin.role,
            ip_address=client_ip,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    admin.last_login_at = datetime.now(timezone.utc)
    session.add(admin)
    session.commit()

    log_audit_event(
        session=session,
        action="auth.login",
        category="auth",
        status="success",
        description=f"Admin {admin.name or admin.email} logged in successfully",
        admin_id=admin.id,
        actor_email=admin.email,
        actor_name=admin.name,
        actor_role=admin.role,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    token = create_admin_token(str(admin.id))

    owned_sites = session.exec(
        select(Site.id, Site.slug, Site.version)
        .join(AdminSite, AdminSite.site_id == Site.id)
        .where(AdminSite.admin_id == admin.id)
    ).all()

    response = JSONResponse(
        content={
            "admin": serialize_admin(admin, session),
            "sites": [
                {
                    "id": str(s[0]),
                    "slug": s[1],
                    "version": s[2],
                }
                for s in owned_sites
            ],
        }
    )
    set_auth_cookie(response, ADMIN_COOKIE_NAME, token)
    return response


@router.post("/admin/google")
def admin_google_auth(
    payload: GoogleAuthRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    google_user = verify_google_id_token(payload.id_token)
    if not google_user or not google_user.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credentials or token",
        )

    email = google_user["email"].lower().strip()
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    admin = session.exec(
        select(Admin).where(Admin.email == email)
    ).first()

    if admin:
        # Update existing account with Google info if missing
        if not admin.google_id:
            admin.google_id = google_user.get("google_id")
        if not admin.avatar_url and google_user.get("picture"):
            admin.avatar_url = google_user.get("picture")
        if payload.gender and not admin.gender:
            admin.gender = payload.gender
        if payload.phone and not admin.phone:
            admin.phone = payload.phone
        admin.last_login_at = datetime.now(timezone.utc)
        session.add(admin)
        session.commit()
        session.refresh(admin)
    else:
        # Create new admin via Google
        admin = Admin(
            email=email,
            name=google_user.get("name") or email.split("@")[0].capitalize(),
            avatar_url=google_user.get("picture"),
            google_id=google_user.get("google_id"),
            gender=payload.gender,
            phone=payload.phone,
            auth_provider="google",
            role="super_admin",
            password_hash=None,
            last_login_at=datetime.now(timezone.utc),
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)

    log_audit_event(
        session=session,
        action="auth.google_login",
        category="auth",
        status="success",
        description=f"Admin {admin.name or admin.email} signed in via Google OAuth",
        admin_id=admin.id,
        actor_email=admin.email,
        actor_name=admin.name,
        actor_role=admin.role,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    token = create_admin_token(str(admin.id))

    owned_sites = session.exec(
        select(Site.id, Site.slug, Site.version)
        .join(AdminSite, AdminSite.site_id == Site.id)
        .where(AdminSite.admin_id == admin.id)
    ).all()

    response = JSONResponse(
        content={
            "admin": serialize_admin(admin),
            "sites": [
                {
                    "id": str(s[0]),
                    "slug": s[1],
                    "version": s[2],
                }
                for s in owned_sites
            ],
        }
    )
    set_auth_cookie(response, ADMIN_COOKIE_NAME, token)
    return response


@router.post("/admin/forgot-password")
def admin_forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    email = payload.email.lower().strip()
    admin = session.exec(
        select(Admin).where(Admin.email == email)
    ).first()

    if not admin:
        # For security, return success even if email is not found to prevent user enumeration
        return {"message": "If an account exists with that email, a password reset link has been dispatched."}

    raw_token, otp_code = generate_reset_token_and_otp()
    hashed_token = hash_reset_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    admin.reset_token = f"{hashed_token}:{otp_code}"
    admin.reset_token_expires_at = expires_at
    session.add(admin)
    session.commit()

    # Build reset link using request origin header or frontend fallback
    origin = request.headers.get("origin", "http://localhost:5173")
    reset_link = f"{origin}/admin/reset-password?email={email}&token={raw_token}"

    send_admin_password_reset_email(email, reset_link, otp_code)

    return {"message": "If an account exists with that email, a password reset link has been dispatched."}


@router.post("/admin/reset-password")
def admin_reset_password(
    payload: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    email = payload.email.lower().strip()
    admin = session.exec(
        select(Admin).where(Admin.email == email)
    ).first()

    if not admin or not admin.reset_token or not admin.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Check expiration
    if datetime.now(timezone.utc) > admin.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

    parts = admin.reset_token.split(":")
    stored_hash = parts[0]
    stored_otp = parts[1] if len(parts) > 1 else ""

    provided_input = payload.token_or_otp.strip()
    is_valid_token = hash_reset_token(provided_input) == stored_hash
    is_valid_otp = provided_input == stored_otp

    if not (is_valid_token or is_valid_otp):
        raise HTTPException(status_code=400, detail="Invalid reset token or 6-digit OTP code")

    err = validate_password_strength(payload.new_password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    admin.password_hash = hash_password(payload.new_password)
    admin.reset_token = None
    admin.reset_token_expires_at = None
    session.add(admin)
    session.commit()

    return {"message": "Password successfully updated! You can now log in with your new password."}


@router.put("/admin/profile")
def update_admin_profile(
    payload: UpdateAdminProfileRequest,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]
    if not check_admin_has_permission(admin_id, "profile:edit", session):
        raise HTTPException(status_code=403, detail="You do not have permission to edit profile information")

    admin_obj = session.get(Admin, admin_id)
    if not admin_obj:
        raise HTTPException(status_code=404, detail="Admin not found")

    if payload.name is not None:
        admin_obj.name = payload.name.strip()
    if payload.gender is not None:
        admin_obj.gender = payload.gender
    if payload.phone is not None:
        admin_obj.phone = payload.phone.strip()
    if payload.avatar_url is not None:
        admin_obj.avatar_url = payload.avatar_url.strip()
    if payload.timezone is not None:
        admin_obj.timezone = payload.timezone.strip()

    session.add(admin_obj)
    session.commit()
    session.refresh(admin_obj)

    return {"admin": serialize_admin(admin_obj, session)}


from uuid import uuid4
from pathlib import Path
from fastapi import File, UploadFile

AVATARS_DIR = Path("uploads/avatars")
AVATARS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/admin/avatar")
async def upload_admin_avatar(
    file: UploadFile = File(...),
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]
    if not check_admin_has_permission(admin_id, "profile:edit", session):
        raise HTTPException(status_code=403, detail="You do not have permission to update avatar")

    admin_obj = session.get(Admin, admin_id)
    if not admin_obj:
        raise HTTPException(status_code=404, detail="Admin not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    ext = Path(file.filename or "avatar.png").suffix.lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".svg"]:
        ext = ".png"

    content = await file.read()
    filename = f"{admin_id}_{uuid4().hex[:8]}.webp"
    target_path = AVATARS_DIR / filename

    try:
        from PIL import Image, ImageOps
        import io

        img = Image.open(io.BytesIO(content))
        img = ImageOps.exif_transpose(img)

        # Convert palette/RGBA modes appropriately for WebP
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")

        # Resize to max 400x400 while preserving aspect ratio
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        img.save(target_path, "WEBP", quality=85, optimize=True)
    except Exception:
        # Fallback to direct write if PIL processing fails
        filename = f"{admin_id}_{uuid4().hex[:8]}{ext}"
        target_path = AVATARS_DIR / filename
        with open(target_path, "wb") as f:
            f.write(content)

    avatar_url = f"/uploads/avatars/{filename}"
    admin_obj.avatar_url = avatar_url
    session.add(admin_obj)
    session.commit()
    session.refresh(admin_obj)

    return {"avatarUrl": avatar_url, "admin": serialize_admin(admin_obj)}


@router.get("/admin/me")
def get_admin_me(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]
    try:
        a_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid admin ID in token",
        )
    admin_obj = session.get(Admin, a_uuid)
    if not admin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )
    return {
        "admin": serialize_admin(admin_obj, session)
    }


@router.get("/admin/sites")
def get_admin_sites(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    try:
        admin_uuid = UUID(str(admin["adminId"]))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid admin token")

    admin_obj = session.get(Admin, admin_uuid)
    if not admin_obj or not admin_obj.is_active:
        raise HTTPException(status_code=401, detail="Admin not found or inactive")

    # Determine role
    from models import Role
    role_obj = None
    if admin_obj.role_id:
        try:
            role_obj = session.get(Role, UUID(str(admin_obj.role_id)))
        except Exception:
            pass
    if not role_obj and admin_obj.role:
        role_obj = session.exec(select(Role).where(func.lower(Role.name) == admin_obj.role.strip().lower())).first()

    is_owner = (
        (role_obj and role_obj.name == "Owner")
        or (admin_obj.role in ("Owner", "super_admin") and not admin_obj.role_id)
    )

    if is_owner:
        # Owner: return only their own sites, excluding any leftover test sites
        sites = session.exec(
            select(Site)
            .join(AdminSite, AdminSite.site_id == Site.id)
            .where(
                AdminSite.admin_id == admin_uuid,
                ~Site.slug.like("store-ret-%"),
                ~Site.slug.like("store-charges-%"),
                ~Site.slug.like("stat-store-%"),
                ~Site.slug.like("inv-store-%"),
                ~Site.slug.like("sec-store-%"),
                ~Site.slug.like("test-store-%"),
            )
            .order_by(Site.created_at.desc())
        ).all()
        return sites

    # Team member: scope strictly to the workspace owner's storefronts
    owner_id = getattr(admin_obj, "invited_by_admin_id", None)
    owner_uuid = None
    if owner_id:
        try:
            owner_uuid = UUID(str(owner_id))
        except Exception:
            owner_uuid = None

    owner_sites = []
    if owner_uuid:
        owner_sites = session.exec(
            select(Site)
            .join(AdminSite, AdminSite.site_id == Site.id)
            .where(
                AdminSite.admin_id == owner_uuid,
                ~Site.slug.like("store-ret-%"),
                ~Site.slug.like("store-charges-%"),
                ~Site.slug.like("stat-store-%"),
                ~Site.slug.like("inv-store-%"),
                ~Site.slug.like("sec-store-%"),
                ~Site.slug.like("test-store-%"),
            )
            .order_by(Site.created_at.desc())
        ).all()

    owner_site_ids = [s.id for s in owner_sites]
    # Team member: scope strictly to assigned Pro storefronts
    from services.team_access_service import is_team_feature_available
    if owner_site_ids:
        member_sites = session.exec(
            select(Site)
            .join(AdminSite, AdminSite.site_id == Site.id)
            .where(
                AdminSite.admin_id == admin_uuid,
                Site.id.in_(owner_site_ids),
                ~Site.slug.like("store-ret-%"),
                ~Site.slug.like("store-charges-%"),
                ~Site.slug.like("stat-store-%"),
                ~Site.slug.like("inv-store-%"),
                ~Site.slug.like("sec-store-%"),
                ~Site.slug.like("test-store-%"),
            )
            .order_by(Site.created_at.desc())
        ).all()
        return [s for s in member_sites if is_team_feature_available(session, s.id)]

    return []


@router.post("/admin/logout")
def admin_logout(response: Response):
    clear_auth_cookie(response, ADMIN_COOKIE_NAME)
    return {"message": "Admin logged out"}


@router.delete("/admin/account")
def admin_delete_account(
    response: Response,
    request: Request,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = admin["adminId"]
    try:
        a_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid admin ID in token",
        )

    admin_obj = session.get(Admin, a_uuid)
    if not admin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    # Log audit event before deletion
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    try:
        log_audit_event(
            session=session,
            site_id=None,
            action="admin.account_deleted",
            category="user_access",
            description=f"Admin {admin_obj.name or admin_obj.email} deleted their account",
            admin_id=admin_obj.id,
            actor_email=admin_obj.email,
            actor_name=admin_obj.name,
            actor_role=admin_obj.role,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"target_type": "admin", "target_id": str(admin_obj.id)},
        )
    except Exception as e:
        logger.warning(f"Could not log audit event for admin deletion: {e}")

    # If invited staff/team member: only workspace owner can remove team members
    if admin_obj.invited_by_admin_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff and team accounts created by an administrator cannot self-delete. Only the workspace owner can manage team members.",
        )

    # 1. Find all sites owned by this admin
    admin_sites = session.exec(select(AdminSite).where(AdminSite.admin_id == a_uuid)).all()
    owned_site_ids = [as_link.site_id for as_link in admin_sites]

    # 2. Fraud & Scam Prevention: Block deletion if any owned store has active, unfulfilled orders or pending returns
    if owned_site_ids:
        terminal_order_statuses = ["delivered", "cancelled", "partially_cancelled", "refunded"]
        active_orders = session.exec(
            select(Order).where(
                Order.site_id.in_(owned_site_ids),
                Order.status.notin_(terminal_order_statuses),
            )
        ).all()

        terminal_return_statuses = ["resolved", "rejected", "refund_issued", "replacement_delivered", "cancelled"]
        active_returns = session.exec(
            select(ReturnRequest).where(
                ReturnRequest.site_id.in_(owned_site_ids),
                ReturnRequest.status.notin_(terminal_return_statuses),
            )
        ).all()

        if active_orders or active_returns:
            issues = []
            if active_orders:
                issues.append(f"{len(active_orders)} active/unfulfilled order(s)")
            if active_returns:
                issues.append(f"{len(active_returns)} pending return request(s)")
            issues_text = " and ".join(issues)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete account with active customer orders or pending returns. You have {issues_text} across your store(s). Please fulfill, deliver, cancel, or resolve all open orders and returns before deleting your account.",
            )

    # 3. Take all owned storefronts offline and remove all staff associations
    for s_id in owned_site_ids:
        site_obj = session.get(Site, s_id)
        if site_obj:
            site_obj.is_online = False
            session.add(site_obj)
        other_site_links = session.exec(select(AdminSite).where(AdminSite.site_id == s_id)).all()
        for link in other_site_links:
            session.delete(link)

    # 3. Purge sensitive merchant bank account records (PAN, GST, bank account numbers)
    try:
        from models import TenantBankAccount
        banks = session.exec(select(TenantBankAccount).where(TenantBankAccount.admin_id == a_uuid)).all()
        for b in banks:
            session.delete(b)
    except Exception as e:
        logger.warning(f"Error purging tenant bank accounts: {e}")

    # 4. Release custom domains so they are not permanently locked in DB
    try:
        from models import SiteDomain
        for s_id in owned_site_ids:
            domains = session.exec(select(SiteDomain).where(SiteDomain.site_id == s_id)).all()
            for d in domains:
                session.delete(d)
    except Exception as e:
        logger.warning(f"Error releasing site domains: {e}")

    # 5. Cancel active paid subscriptions and expire unconsumed AI credits
    try:
        from models import WebsiteSubscription, AICreditBatch, WebsiteTeamMember, StoreEmailSettings
        subs = session.exec(select(WebsiteSubscription).where(WebsiteSubscription.admin_id == a_uuid)).all()
        for sub in subs:
            sub.status = "CANCELLED"
            sub.is_auto_renew = False
            session.add(sub)
        batches = session.exec(select(AICreditBatch).where(AICreditBatch.admin_id == a_uuid)).all()
        for batch in batches:
            batch.status = "EXPIRED_LAPSED"
            batch.remaining_amount = 0
            session.add(batch)
        for s_id in owned_site_ids:
            members = session.exec(select(WebsiteTeamMember).where(WebsiteTeamMember.website_id == s_id)).all()
            for mem in members:
                session.delete(mem)
            email_configs = session.exec(select(StoreEmailSettings).where(StoreEmailSettings.site_id == s_id)).all()
            for ec in email_configs:
                session.delete(ec)
    except Exception as e:
        logger.warning(f"Error cleaning subscriptions and merchant settings: {e}")

    # 6. For workspace owner / merchant: clean credentials and anonymize PII cleanly
    admin_obj.name = "Deleted Merchant"
    admin_obj.email = f"deleted_{admin_obj.id}@deleted.webcreon.local"
    admin_obj.phone = None
    admin_obj.gender = None
    admin_obj.avatar_url = None
    admin_obj.password_hash = None
    admin_obj.google_id = None
    admin_obj.reset_token = None
    admin_obj.reset_token_expires_at = None
    admin_obj.status = "deleted"
    admin_obj.is_active = False
    session.add(admin_obj)

    session.commit()

    # Clear auth cookie
    clear_auth_cookie(response, ADMIN_COOKIE_NAME)
    return {"message": "Admin account successfully deleted"}


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

    # Dispatch welcome in-app notification & welcome email
    try:
        dispatch_customer_event(
            session=session,
            site_id=site.id,
            customer_id=user.id,
            event_type="account.created",
            category="account",
            title="Welcome to Our Store!",
            message=f"Welcome to {site.name}! Your account has been created successfully.",
            action_url=f"/store/{site.slug}/profile",
            send_email=True,
            email_recipient=user.email,
            email_template_key="welcome_email",
            email_template_vars={"customer_name": user.name, "store_name": site.name, "store_url": f"/store/{site.slug}"},
        )
        session.commit()
    except Exception as e:
        logger.warning(f"Could not dispatch signup welcome notification: {e}")

    token = create_customer_token(str(user.id), str(site.id))

    response = JSONResponse(
        content={
            "user": serialize_customer(user, site),
            "token": token,
        }
    )
    set_customer_tenant_cookies(response, site, website_name, token)
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
            "user": serialize_customer(user, site),
            "token": token,
        }
    )
    set_customer_tenant_cookies(response, site, website_name, token)
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
def customer_logout(
    response: Response,
    request: Request,
    website_name: Optional[str] = None,
):
    clear_auth_cookie(response, CUSTOMER_COOKIE_NAME)
    target = website_name or request.headers.get("X-Site-Id")
    if target:
        clean_target = str(target).strip().lower()
        clean_base = clean_target.split("-")[0]
        clear_auth_cookie(response, f"customer_token_{clean_target}")
        clear_auth_cookie(response, f"customer_token_{clean_base}")
        clear_auth_cookie(response, f"customer_token_{target}")
    return {"message": "Customer logged out"}


@router.delete("/customer/account/{website_name}")
def customer_delete_account(
    website_name: str,
    response: Response,
    request: Request,
    auth_user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    site = resolve_site_by_slug_or_404(website_name, session)

    if str(site.id) != auth_user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    try:
        user_uuid = UUID(str(auth_user["userId"]))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid customer ID in token",
        )

    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    # 1. Delete associated customer addresses
    addresses = session.exec(select(UserAddress).where(UserAddress.user_id == user_uuid)).all()
    for addr in addresses:
        session.delete(addr)

    # 2. Delete customer notifications
    try:
        notifs = session.exec(select(CustomerNotification).where(CustomerNotification.customer_id == user_uuid)).all()
        for n in notifs:
            session.delete(n)
    except Exception as e:
        logger.warning(f"Error cleaning customer notifications: {e}")

    # 3. Check if user has orders
    orders = session.exec(select(Order).where(Order.customer_id == user_uuid)).all()
    if not orders:
        # Clean hard delete if user has no orders
        session.delete(user)
    else:
        # Anonymize PII for accounting / regulatory compliance
        user.name = "Deleted Customer"
        user.email = f"deleted_{user.id}@anonymized.local"
        user.phone = None
        user.gender = None
        user.date_of_birth = None
        user.avatar_url = None
        user.password_hash = None
        user.google_id = None
        user.reset_token = None
        user.reset_token_expires_at = None
        user.is_active = False
        user.auth_provider = "deleted"
        session.add(user)

    session.commit()

    # 4. Clear auth cookies
    clear_auth_cookie(response, CUSTOMER_COOKIE_NAME)
    target = website_name or request.headers.get("X-Site-Id")
    if target:
        clean_target = str(target).strip().lower()
        clean_base = clean_target.split("-")[0]
        clear_auth_cookie(response, f"customer_token_{clean_target}")
        clear_auth_cookie(response, f"customer_token_{clean_base}")
        clear_auth_cookie(response, f"customer_token_{target}")

    return {"message": "Account deleted successfully"}


@router.put("/customer/profile/{website_name}")
def customer_update_profile(
    website_name: str,
    payload: CustomerProfileUpdateRequest,
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
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.gender is not None:
        user.gender = payload.gender.strip()
    if payload.date_of_birth is not None:
        user.date_of_birth = payload.date_of_birth.strip()

    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "message": "Profile updated successfully",
        "user": serialize_customer(user, site),
    }


@router.post("/customer/change-password/{website_name}")
def customer_change_password(
    website_name: str,
    payload: CustomerChangePasswordRequest,
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
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    # If user currently has a password, verify current_password
    if user.password_hash:
        if not payload.current_password or not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password does not match",
            )

    validate_password_or_400(payload.new_password)
    err = validate_password_strength(payload.new_password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    user.password_hash = hash_password(payload.new_password)
    session.add(user)
    session.commit()
    session.refresh(user)

    return {
        "message": "Password updated successfully",
        "user": serialize_customer(user, site),
    }


@router.post("/customer/google/{website_name}")
def customer_google_auth(
    website_name: str,
    payload: GoogleAuthRequest,
    session: Session = Depends(get_session),
):
    google_user = verify_google_id_token(payload.id_token)
    if not google_user or not google_user.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credentials or token",
        )

    site = resolve_site_by_slug_or_404(website_name, session)
    email = google_user["email"].lower().strip()

    user = session.exec(
        select(User).where(
            User.site_id == site.id,
            User.email == email,
        )
    ).first()

    if user:
        # Update existing user profile with Google metadata
        if not user.google_id:
            user.google_id = google_user.get("google_id")
        if not user.avatar_url and google_user.get("picture"):
            user.avatar_url = google_user.get("picture")
        if payload.phone and not user.phone:
            user.phone = payload.phone
        user.is_active = True
        session.add(user)
        session.commit()
        session.refresh(user)
    else:
        # Create new customer via Google
        user = User(
            site_id=site.id,
            email=email,
            name=google_user.get("name") or email.split("@")[0].capitalize(),
            phone=payload.phone,
            avatar_url=google_user.get("picture"),
            google_id=google_user.get("google_id"),
            auth_provider="google",
            is_active=True,
            password_hash=None,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    token = create_customer_token(str(user.id), str(site.id))

    response = JSONResponse(
        content={
            "user": serialize_customer(user, site),
            "token": token,
        }
    )
    set_customer_tenant_cookies(response, site, website_name, token)
    return response


@router.post("/customer/forgot-password/{website_name}")
def customer_forgot_password(
    website_name: str,
    payload: ForgotPasswordRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    site = resolve_site_by_slug_or_404(website_name, session)
    email = payload.email.lower().strip()

    user = session.exec(
        select(User).where(
            User.site_id == site.id,
            User.email == email,
        )
    ).first()

    if not user:
        return {
            "message": "If an account exists with that email, a 6-digit verification code has been dispatched."
        }

    raw_token, otp_code = generate_reset_token_and_otp()
    hashed_token = hash_reset_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    user.reset_token = f"{hashed_token}:{otp_code}"
    user.reset_token_expires_at = expires_at
    session.add(user)
    session.commit()

    origin = request.headers.get("origin", "http://localhost:5173")
    store_slug = site.slug or website_name
    store_definition = getattr(site, "site_definition", None) or {}
    store_name = store_definition.get("siteName") or store_slug.replace("-", " ").title()
    reset_link = f"{origin}/store/{store_slug}/login?reset_email={email}&token={raw_token}"

    # Render store branded email and dispatch with store sender identity
    subject, html_body = render_email_template(
        "customer_password_reset",
        {
            "store_name": store_name,
            "customer_name": user.name or "Valued Customer",
            "otp_code": otp_code,
            "reset_link": reset_link,
        },
    )
    dispatch_tenant_email(
        session=session,
        site_id=site.id,
        to_email=email,
        subject=subject,
        html_content=html_body,
        store_name=store_name,
    )

    # Also log in-app security notice
    try:
        dispatch_customer_event(
            session=session,
            site_id=site.id,
            customer_id=user.id,
            event_type="account.password_reset",
            category="account",
            title="Password Reset Code Requested",
            message=f"A 6-digit password reset verification code was requested for your account.",
            action_url=f"/store/{store_slug}/login",
            send_email=False,
        )
        session.commit()
    except Exception as notif_err:
        logger.warning(f"Could not dispatch in-app reset notice: {notif_err}")

    return {
        "message": f"A 6-digit verification code has been dispatched to {email}.",
        "dev_otp": otp_code,
    }


@router.post("/customer/reset-password/{website_name}")
def customer_reset_password(
    website_name: str,
    payload: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    site = resolve_site_by_slug_or_404(website_name, session)
    email = payload.email.lower().strip()

    user = session.exec(
        select(User).where(
            User.site_id == site.id,
            User.email == email,
        )
    ).first()

    if not user or not user.reset_token or not user.reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code",
        )

    if datetime.now(timezone.utc) > user.reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    parts = user.reset_token.split(":")
    stored_hash = parts[0]
    stored_otp = parts[1] if len(parts) > 1 else ""

    provided_input = payload.token_or_otp.strip()
    is_valid_token = hash_reset_token(provided_input) == stored_hash
    is_valid_otp = provided_input == stored_otp

    if not (is_valid_token or is_valid_otp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit verification code",
        )

    err = validate_password_strength(payload.new_password)
    if err:
        raise HTTPException(status_code=400, detail=err)

    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    session.add(user)
    session.commit()
    session.refresh(user)

    # In-app and email security confirmation
    try:
        dispatch_customer_event(
            session=session,
            site_id=site.id,
            customer_id=user.id,
            event_type="account.password_changed",
            category="account",
            title="Password Changed Successfully",
            message="Your account password was successfully updated.",
            action_url=f"/store/{site.slug}/profile",
            send_email=True,
            email_recipient=user.email,
            email_template_key="password_changed_security",
            email_template_vars={"customer_name": user.name or "Valued Customer", "store_name": site.name},
        )
        session.commit()
    except Exception as notif_err:
        logger.warning(f"Could not dispatch password change confirmation: {notif_err}")

    # Auto log the customer in
    token = create_customer_token(str(user.id), str(site.id))

    response = JSONResponse(
        content={
            "message": "Password successfully updated!",
            "user": serialize_customer(user, site),
            "token": token,
        }
    )
    set_customer_tenant_cookies(response, site, website_name, token)
    return response