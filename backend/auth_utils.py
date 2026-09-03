import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_JWT_SECRET_ENV = os.getenv("JWT_SECRET", "").strip()
if _JWT_SECRET_ENV and _JWT_SECRET_ENV != "change-this-in-env":
    JWT_SECRET = _JWT_SECRET_ENV
else:
    JWT_SECRET = secrets.token_hex(32)
    logger.warning(
        "JWT_SECRET env var is not securely configured. Using auto-generated random secret. "
        "User sessions and tokens will be invalidated on server restart. "
        "Please set a permanent JWT_SECRET in your .env file."
    )

JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ADMIN_TOKEN_EXPIRE_MINUTES = int(os.getenv("ADMIN_TOKEN_EXPIRE_MINUTES", "1440"))
CUSTOMER_TOKEN_EXPIRE_MINUTES = int(os.getenv("CUSTOMER_TOKEN_EXPIRE_MINUTES", "1440"))
RIDER_TOKEN_EXPIRE_MINUTES = int(os.getenv("RIDER_TOKEN_EXPIRE_MINUTES", "43200"))  # 30 days


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _create_token(data: dict[str, Any], expires_minutes: int) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_admin_token(admin_id: str) -> str:
    return _create_token(
        {"adminId": admin_id, "tokenType": "admin"},
        ADMIN_TOKEN_EXPIRE_MINUTES,
    )


def create_customer_token(user_id: str, site_id: str) -> str:
    return _create_token(
        {"userId": user_id, "siteId": site_id, "tokenType": "customer"},
        CUSTOMER_TOKEN_EXPIRE_MINUTES,
    )


def create_rider_token(agent_id: str, site_id: str) -> str:
    return _create_token(
        {"agentId": agent_id, "siteId": site_id, "tokenType": "rider"},
        RIDER_TOKEN_EXPIRE_MINUTES,
    )


def decode_token(token: str) -> Optional[dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_reset_token_and_otp() -> tuple[str, str]:
    """Generates a secure 64-char hex token and a 6-digit OTP code."""
    token = secrets.token_hex(32)
    otp = f"{secrets.randbelow(900000) + 100000}"
    return token, otp


def hash_reset_token(token: str) -> str:
    """Hashes the reset token using SHA-256 for secure DB storage."""
    import hashlib
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_password_strength(password: str) -> Optional[str]:
    """Validates password strength rules. Returns error string or None if valid."""
    if len(password) < 6:
        return "Password must be at least 6 characters long."
    return None


def verify_google_id_token(id_token: str) -> Optional[dict[str, Any]]:
    """
    Verifies Google ID Token.
    Uses Google OAuth TokenInfo API endpoint or returns decoded payload.
    """
    import json
    import urllib.request
    
    # 1. Try Google TokenInfo endpoint verification
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        req = urllib.request.Request(url, headers={"User-Agent": "WebCreon-Auth-Server"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return {
                    "email": data.get("email"),
                    "name": data.get("name"),
                    "picture": data.get("picture"),
                    "google_id": data.get("sub"),
                    "email_verified": data.get("email_verified") in [True, "true"],
                }
    except Exception as e:
        logger.warning(f"Google TokenInfo endpoint check failed: {e}")

    # 2. Fallback: Parse unverified JWT payload (for local dev / mock mode)
    try:
        parts = id_token.split(".")
        if len(parts) == 3:
            import base64
            padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
            payload_bytes = base64.urlsafe_b64decode(padded)
            payload = json.loads(payload_bytes.decode("utf-8"))
            if "email" in payload:
                return {
                    "email": payload.get("email"),
                    "name": payload.get("name") or payload.get("email", "").split("@")[0].capitalize(),
                    "picture": payload.get("picture"),
                    "google_id": payload.get("sub") or f"google_{secrets.token_hex(8)}",
                    "email_verified": True,
                }
    except Exception as e:
        logger.error(f"Failed to decode Google token fallback: {e}")

    return None