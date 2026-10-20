"""
Multi-Tenant Email Provider Adapter & Delivery Engine for WebCreon.
Handles Tenant Custom SMTP, Fernet Decryption, DNS Checks, and Verified Platform Fallback.
"""

from __future__ import annotations

import logging
import os
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from dotenv import find_dotenv, load_dotenv
from sqlmodel import Session, select

from crypto_utils import decrypt_string
from models import Site, StoreEmailSettings
from services.email_templates import clean_store_display_name

load_dotenv(find_dotenv(usecwd=True))

logger = logging.getLogger("email_adapter")

TEST_EMAIL_DOMAINS = {"test.com", "example.com", "test.org", "localhost", "fake.com", "invalid", "example.org", "example.net"}
_smtp_cooldown_until: Optional[float] = None


def is_test_email(email_str: str) -> bool:
    if not email_str or "@" not in email_str:
        return True
    domain = email_str.split("@")[-1].strip().lower()
    return domain in TEST_EMAIL_DOMAINS or domain.endswith(".test") or domain.endswith(".local")


class EmailDeliveryResult:
    def __init__(self, success: bool, message: str, provider_used: str = "unknown", error: Optional[str] = None):
        self.success = success
        self.message = message
        self.provider_used = provider_used
        self.error = error


def get_platform_smtp_config() -> Dict[str, Any]:
    """Returns the global platform SMTP configuration from environment variables."""
    return {
        "host": os.getenv("SMTP_HOST", "").strip(),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", "").strip(),
        "password": os.getenv("SMTP_PASSWORD", "").strip(),
        "from_email": os.getenv("SMTP_FROM_EMAIL", "noreply@webcreon.ai").strip(),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes"),
        "use_ssl": os.getenv("SMTP_USE_SSL", "false").lower() in ("true", "1", "yes"),
    }


def send_smtp_message(
    host: str,
    port: int,
    user: str,
    password: str,
    from_header: str,
    to_email: str,
    subject: str,
    html_content: str,
    reply_to: Optional[str] = None,
    use_tls: bool = True,
    use_ssl: bool = False,
    timeout: int = 3,
) -> EmailDeliveryResult:
    """Dispatches a single email message over SMTP with standard TLS/SSL negotiation."""
    global _smtp_cooldown_until

    # Check circuit-breaker for provider daily limits (e.g. Gmail 550 rate limit)
    if _smtp_cooldown_until and time.time() < _smtp_cooldown_until:
        logger.info(f"SMTP provider in cooldown due to provider limits. Bypassing network call for {to_email}.")
        return EmailDeliveryResult(success=False, message="SMTP in cooldown", provider_used="smtp_cooldown", error="Daily limit exceeded cooldown")

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.attach(MIMEText(html_content, "html", "utf-8"))

        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=timeout) as server:
                server.login(user, password)
                server.sendmail(from_header, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=timeout) as server:
                server.ehlo()
                if use_tls:
                    server.starttls()
                    server.ehlo()
                server.login(user, password)
                server.sendmail(from_header, [to_email], msg.as_string())

        logger.info(f"Email successfully dispatched to {to_email} via SMTP ({host})")
        return EmailDeliveryResult(success=True, message="Email dispatched successfully", provider_used="smtp")
    except Exception as ex:
        err_msg = str(ex)
        if "550" in err_msg or "daily" in err_msg.lower() or "limit exceeded" in err_msg.lower():
            # Activate 30-minute circuit breaker so other requests don't hang
            _smtp_cooldown_until = time.time() + 1800
            logger.warning(f"SMTP provider rate limit encountered (550). Activating 30min cooldown: {err_msg}")
        else:
            logger.warning(f"SMTP dispatch to {to_email} failed via {host}: {err_msg}")
        return EmailDeliveryResult(success=False, message="SMTP dispatch failed", provider_used="smtp", error=err_msg)


def dispatch_tenant_email(
    session: Session,
    site_id: UUID,
    to_email: str,
    subject: str,
    html_content: str,
    store_name: Optional[str] = None,
) -> EmailDeliveryResult:
    """
    Late-Binding Tenant Email Dispatch:
    1. Queries StoreEmailSettings for site_id.
    2. If verified and enabled, attempts dispatch with store SMTP.
    3. If unverified, disabled, or SMTP fails, automatically falls back to Platform Sender with dynamic display branding.
    """
    site = session.get(Site, site_id)
    settings = session.exec(
        select(StoreEmailSettings).where(StoreEmailSettings.site_id == site_id)
    ).first()

    raw_store = store_name or (settings.sender_name if settings and settings.sender_name else (site.name if site else "WebCreon Store"))
    resolved_store_name = clean_store_display_name(raw_store)

    # Case -1: If recipient is a test or dummy domain, simulate delivery instantly without hitting external SMTP
    if is_test_email(to_email):
        logger.info(f"Dev test email simulated for {to_email} [{subject}] (site: {site_id})")
        return EmailDeliveryResult(success=True, message="Test email simulated locally", provider_used="dev_logger")

    # Case 0: If Email Notifications are disabled by the merchant, skip external dispatch
    if settings is not None and settings.is_enabled is False:
        logger.info(f"Email notifications muted for site {site_id} (in-house notifications only).")
        return EmailDeliveryResult(
            success=True,
            message="Email notifications disabled by merchant (in-house notifications only)",
            provider_used="disabled_by_merchant",
            error=None,
        )

    # Case 1: Try Custom Merchant SMTP if configured and verified
    if settings and settings.is_enabled and settings.verification_status == "verified" and settings.smtp_host:
        raw_password = decrypt_string(settings.smtp_password_encrypted or "")
        sender_email = settings.sender_email or settings.smtp_user or "orders@webcreon.ai"
        display_name = clean_store_display_name(settings.sender_name or resolved_store_name)
        from_header = f'"{display_name}" <{sender_email}>'

        result = send_smtp_message(
            host=settings.smtp_host,
            port=settings.smtp_port,
            user=settings.smtp_user or "",
            password=raw_password,
            from_header=from_header,
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            reply_to=settings.reply_to_email or sender_email,
            use_tls=settings.smtp_use_tls,
            use_ssl=settings.smtp_use_ssl,
        )
        if result.success:
            return result
        logger.warning(
            f"Tenant custom SMTP for site {site_id} failed ({result.error}). Falling back to platform sender."
        )

    # Case 2: Platform Mailer Fallback
    platform_cfg = get_platform_smtp_config()
    from_display = f'"{resolved_store_name}" <{platform_cfg["from_email"]}>'
    reply_to = settings.reply_to_email if settings and settings.reply_to_email else (settings.sender_email if settings else None)

    if platform_cfg["host"] and platform_cfg["user"] and platform_cfg["password"]:
        res = send_smtp_message(
            host=platform_cfg["host"],
            port=platform_cfg["port"],
            user=platform_cfg["user"],
            password=platform_cfg["password"],
            from_header=from_display,
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            reply_to=reply_to,
        )
        res.provider_used = "platform_fallback"
        return res

    # Case 3: Dev Fallback Logger (No live SMTP configured)
    dev_box = f"""
================================================================================
 [DEV FALLBACK EMAIL DISPATCHER]
 TO: {to_email}
 FROM: {from_display}
 SUBJECT: {subject}
 STORE ID: {site_id}
 (Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env for live email delivery)
================================================================================
"""
    print(dev_box)
    logger.info(f"Dev email logged for {to_email} [{subject}]")
    return EmailDeliveryResult(success=True, message="Dev email logged to console", provider_used="dev_logger")


def verify_smtp_connection(
    host: str,
    port: int,
    user: str,
    password: str,
    test_to_email: str,
    store_name: str,
    sender_email: Optional[str] = None,
    use_tls: bool = True,
    use_ssl: bool = False,
) -> Tuple[bool, Optional[str]]:
    """
    Tests SMTP connection handshake and dispatches a test email.
    Returns (is_verified, error_message).
    """
    from services.email_templates import render_email_template

    subject, html_body = render_email_template("test_email", {"store_name": store_name})
    from_header = f'"{store_name}" <{sender_email or user}>'

    res = send_smtp_message(
        host=host,
        port=port,
        user=user,
        password=password,
        from_header=from_header,
        to_email=test_to_email,
        subject=subject,
        html_content=html_body,
        use_tls=use_tls,
        use_ssl=use_ssl,
        timeout=15,
    )
    if res.success:
        return True, None
    return False, res.error or "Could not connect to SMTP server"


# Backwards compatibility aliases for tests
send_tenant_email = dispatch_tenant_email
verify_store_smtp_connection = verify_smtp_connection
