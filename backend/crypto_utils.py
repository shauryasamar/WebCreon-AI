import os
from typing import Optional
from cryptography.fernet import Fernet


_FALLBACK_KEY = b"EODNWPD0V22Ggp2A8b8dV6nFFFD5y5wWML3dmBW_FXE="


def _get_fernet() -> Fernet:
    key_str = os.getenv("BANK_ENCRYPTION_KEY")
    if key_str:
        try:
            return Fernet(key_str.strip().encode())
        except Exception:
            pass
    return Fernet(_FALLBACK_KEY)


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
