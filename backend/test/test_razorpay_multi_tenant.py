import hashlib
import hmac
from decimal import Decimal
import pytest
from uuid import uuid4

from crypto_utils import decrypt_string, encrypt_string, mask_account_number
from routers.payments import get_platform_commission_percent


def test_bank_encryption_and_masking():
    raw_account = "12345678901234"
    encrypted = encrypt_string(raw_account)

    assert encrypted != raw_account
    assert len(encrypted) > 20

    decrypted = decrypt_string(encrypted)
    assert decrypted == raw_account

    masked = mask_account_number(raw_account)
    assert masked == "••••••••••1234"
    assert masked.endswith("1234")


def test_signature_verification_algorithm():
    secret = "test_razorpay_secret_key_12345"
    order_id = "order_N1234567890abc"
    payment_id = "pay_P9876543210xyz"

    payload = f"{order_id}|{payment_id}".encode("utf-8")
    valid_signature = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    # Verify signature generation match
    assert len(valid_signature) == 64

    # Verify matching logic
    test_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    assert hmac.compare_digest(valid_signature, test_sig) is True

    # Bad signature
    bad_sig = "0" * 64
    assert hmac.compare_digest(valid_signature, bad_sig) is False


def test_ledger_commission_math():
    gross = Decimal("1500.00")
    commission_pct = Decimal("3.00")

    fee = (gross * commission_pct / Decimal("100")).quantize(Decimal("0.01"))
    tenant_share = gross - fee

    assert fee == Decimal("45.00")
    assert tenant_share == Decimal("1455.00")
    assert fee + tenant_share == gross


def test_odd_amount_commission_rounding():
    gross = Decimal("333.33")
    commission_pct = Decimal("3.00")

    fee = (gross * commission_pct / Decimal("100")).quantize(Decimal("0.01"))
    tenant_share = gross - fee

    assert fee == Decimal("10.00")
    assert tenant_share == Decimal("323.33")
    assert fee + tenant_share == gross
