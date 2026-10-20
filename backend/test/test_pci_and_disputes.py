import pytest
import hmac
import hashlib
import json
from uuid import uuid4
from datetime import datetime, timezone
from sqlmodel import Session, select

from db.database import engine
from models import Admin, Site, Product, Order, OrderItem, User, UserAddress
from services.pci_security import (
    get_pci_checkout_security_headers,
    verify_checkout_script_inventory,
    record_dom_tamper_event,
    DOMTamperReport,
)


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


def test_pci_csp_headers_scope_lockdown():
    headers = get_pci_checkout_security_headers()
    assert "Content-Security-Policy" in headers
    csp = headers["Content-Security-Policy"]
    assert "checkout.razorpay.com" in csp
    assert "api.razorpay.com" in csp
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["X-Content-Type-Options"] == "nosniff"


def test_script_inventory_allowlist_auditor():
    allowed_scripts = [
        "https://checkout.razorpay.com/v1/checkout.js",
        "https://maps.googleapis.com/maps/api/js",
    ]
    is_valid, violations = verify_checkout_script_inventory(allowed_scripts)
    assert is_valid is True
    assert len(violations) == 0

    unauthorized_scripts = [
        "https://checkout.razorpay.com/v1/checkout.js",
        "https://malicious-cdn.com/evil-keylogger.js",
    ]
    is_valid_bad, violations_bad = verify_checkout_script_inventory(unauthorized_scripts)
    assert is_valid_bad is False
    assert "https://malicious-cdn.com/evil-keylogger.js" in violations_bad


def test_dom_tamper_event_recording():
    report = DOMTamperReport(
        site_id="site_123",
        url="https://store.webcreon.com/checkout",
        tamper_type="script_injection",
        node_name="script",
        node_src="https://unknown-tracker.com/track.js",
        details="Unexpected script injected into checkout page form",
    )
    result = record_dom_tamper_event(report)
    assert result["status"] == "recorded"
    assert result["alert_dispatched"] is True
