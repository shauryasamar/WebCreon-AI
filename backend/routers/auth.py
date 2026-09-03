from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
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
    generate_reset_token_and_otp,
    hash_password,
    hash_reset_token,
    validate_password_strength,
    verify_google_id_token,
    verify_password,
)
from db.database import get_session
from models import Admin, AdminSite, Site, User
from services.email_service import (
    send_admin_password_reset_email,
    send_customer_password_reset_email,
)


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
    role: Optional[str] = None
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


def serialize_admin(admin: Admin) -> dict:
    name = getattr(admin, "name", None)
    if not name and admin.email:
        prefix = admin.email.split("@")[0]
        parts = [p.capitalize() for p in prefix.replace(".", " ").replace("_", " ").split()]
        name = " ".join(parts) if parts else "Admin"
    return {
        "id": str(admin.id),
        "email": admin.email,
        "name": name or "Admin",
        "gender": getattr(admin, "gender", None),
        "phone": getattr(admin, "phone", None),
        "avatarUrl": getattr(admin, "avatar_url", None),
        "role": getattr(admin, "role", "super_admin"),
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
    session: Session = Depends(get_session),
):
    validate_password_or_400(payload.password)

    email = payload.email.lower().strip()

    admin = session.exec(
        select(Admin).where(Admin.email == email)
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not getattr(admin, "is_active", True):
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    admin.last_login_at = datetime.now(timezone.utc)
    session.add(admin)
    session.commit()

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


@router.post("/admin/google")
def admin_google_auth(
    payload: GoogleAuthRequest,
    session: Session = Depends(get_session),
):
    google_user = verify_google_id_token(payload.id_token)
    if not google_user or not google_user.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credentials or token",
        )

    email = google_user["email"].lower().strip()
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
    if payload.role is not None:
        admin_obj.role = payload.role.strip()
    if payload.timezone is not None:
        admin_obj.timezone = payload.timezone.strip()

    session.add(admin_obj)
    session.commit()
    session.refresh(admin_obj)

    return {"admin": serialize_admin(admin_obj)}


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
    admin_obj = session.get(Admin, admin_id)
    if not admin_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )
    return {
        "admin": serialize_admin(admin_obj)
    }


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

    send_customer_password_reset_email(email, store_name, reset_link, otp_code)

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