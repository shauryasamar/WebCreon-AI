import logging
import os
from typing import Optional
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

_EPHEMERAL_KEY: Optional[bytes] = None


def _get_fernet() -> Fernet:
    global _EPHEMERAL_KEY
    key_str = os.getenv("BANK_ENCRYPTION_KEY", "").strip()
    if key_str:
        try:
            return Fernet(key_str.encode("utf-8"))
        except Exception as e:
            logger.error("Invalid BANK_ENCRYPTION_KEY provided in env: %s", e)

    if _EPHEMERAL_KEY is None:
        _EPHEMERAL_KEY = Fernet.generate_key()
        logger.warning(
            "BANK_ENCRYPTION_KEY env var is not set. Using auto-generated ephemeral key. "
            "Encrypted bank records will not decrypt after server restart. "
            "Please set a 32-byte url-safe base64 BANK_ENCRYPTION_KEY in your .env file."
        )
    return Fernet(_EPHEMERAL_KEY)


def encrypt_string(value: str) -> str:
    if not value:
        return ""
    f = _get_fernet()
    return f.encrypt(value.strip().encode("utf-8")).decode("utf-8")


def decrypt_string(encrypted_value: str) -> str:
    if not encrypted_value:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_value.strip().encode("utf-8")).decode("utf-8")
    except Exception:
        return ""


def mask_account_number(account_number: Optional[str]) -> str:
    if not account_number:
        return ""
    cleaned = account_number.strip()
    if len(cleaned) <= 4:
        return cleaned
    return f"{'•' * (len(cleaned) - 4)}{cleaned[-4:]}"
