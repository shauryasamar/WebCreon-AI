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