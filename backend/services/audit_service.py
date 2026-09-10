from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from fastapi import Request
from sqlmodel import Session, col, delete, func, select

from db.database import engine
from models import AuditLog, Admin, Role

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CONSTANTS & TAXONOMY
# ---------------------------------------------------------------------------

class ActorType:
    USER = "USER"
    OWNER = "OWNER"
    TEAM_MEMBER = "TEAM_MEMBER"
    RIDER = "RIDER"
    SHIPROCKET = "SHIPROCKET"
    PAYMENT_PROVIDER = "PAYMENT_PROVIDER"
    OTHER_INTEGRATION = "OTHER_INTEGRATION"
    WEBHOOK = "WEBHOOK"
    SYSTEM = "SYSTEM"
    BACKGROUND_JOB = "BACKGROUND_JOB"
    CRON_JOB = "CRON_JOB"
    SCHEDULED_TASK = "SCHEDULED_TASK"
    AI = "AI"
    AUTOMATION = "AUTOMATION"


class SourceType:
    WEB_APP = "web_app"
    WEB_ADMIN = "web_app"   # alias — routers use WEB_ADMIN, stored as "web_app"
    RIDER_APP = "rider_app"
    WEBHOOK_RAZORPAY = "webhook_razorpay"
    WEBHOOK_SHIPROCKET = "webhook_shiprocket"
    BACKGROUND_WORKER = "background_worker"
    CRON = "cron"
    AI_AGENT = "ai_agent"
    API = "api"


class AuditCategory:
    USERS_ACCESS = "users_access"
    PRODUCTS = "products"
    ORDERS_FULFILLMENT = "orders_fulfillment"
    DISCOUNTS_PROMO = "discounts_promo"
    SUPPORT_CRM = "support_crm"
    WEBSITE_STORE = "website_store"
    DELIVERY_SHIPPING = "delivery_shipping"
    CHECKOUT_CHARGES = "checkout_charges"
    EARNINGS_LEDGER = "earnings_ledger"
    PAYOUTS = "payouts"
    AI_COPILOT = "ai_copilot"
    BILLING = "billing"
    AUTH = "auth"
    SYSTEM = "system"
    SETTINGS = "settings"
    ORDERS = "orders"
    DELIVERY = "delivery"
    WEBSITE = "website"
    DISCOUNTS = "discounts"
    SUPPORT = "support"


# Sensitive keys that must NEVER be written to audit logs
SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_secret",
    "razorpay_signature",
    "key_secret",
    "card_number",
    "cvv",
    "private_key",
    "auth",
    "authorization",
}


def sanitize_audit_payload(obj: Any) -> Any:
    """Recursively sanitizes sensitive credentials and masks payment/bank numbers."""
    if isinstance(obj, dict):
        sanitized = {}
        for k, v in obj.items():
            lower_k = str(k).lower()
            if any(s in lower_k for s in SENSITIVE_KEYS):
                sanitized[k] = "[REDACTED]"
            elif "account_number" in lower_k or "bank_account" in lower_k:
                s_val = str(v) if v else ""
                sanitized[k] = f"••••{s_val[-4:]}" if len(s_val) >= 4 else "••••"
            elif "card" in lower_k and "number" in lower_k:
                s_val = str(v) if v else ""
                sanitized[k] = f"••••••••••••{s_val[-4:]}" if len(s_val) >= 4 else "••••"
            else:
                sanitized[k] = sanitize_audit_payload(v)
        return sanitized
    elif isinstance(obj, list):
        return [sanitize_audit_payload(item) for item in obj]
    return obj


def extract_client_metadata(request: Optional[Request]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Extracts sanitized client IP, User-Agent, and Request ID from FastAPI request."""
    if not request:
        return None, None, None

    ip_address = None
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    elif request.client:
        ip_address = request.client.host

    user_agent = request.headers.get("user-agent")
    request_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id")

    return ip_address, user_agent, request_id


def format_default_summary(
    actor_name: str,
    actor_type: str,
    action: str,
    resource_name: Optional[str] = None,
    resource_type: Optional[str] = None,
    description: Optional[str] = None,
) -> str:
    """Produces clear, natural, human-oriented summaries distinguishing human vs automated activity."""
    if description and description.strip():
        return description.strip()

    action_clean = action.replace(".", " ").replace("_", " ").title()
    resource_label = f" '{resource_name}'" if resource_name else (f" {resource_type}" if resource_type else "")

    if actor_type in (ActorType.SHIPROCKET, "SHIPROCKET"):
        return f"Shiprocket updated{resource_label}: {action_clean}"
    elif actor_type in (ActorType.PAYMENT_PROVIDER, "PAYMENT_PROVIDER"):
        return f"Payment Provider processed{resource_label}: {action_clean}"
    elif actor_type in (ActorType.RIDER, "RIDER"):
        return f"Rider {actor_name}: {action_clean}{resource_label}"
    elif actor_type in (ActorType.SYSTEM, ActorType.CRON_JOB, ActorType.BACKGROUND_JOB, "SYSTEM"):
        return f"System executed {action_clean}{resource_label}"
    elif actor_type in (ActorType.AI, "AI"):
        return f"AI Copilot completed {action_clean}{resource_label}"

    # Human actions - generate natural English sentences without robotic "performed"
    if action == "product.updated":
        return f"Updated product{resource_label}".strip()
    elif action == "product.price_changed":
        return f"Updated price of product{resource_label}".strip()
    elif action == "product.stock_changed":
        return f"Updated stock of product{resource_label}".strip()
    elif action == "product.status_changed":
        return f"Changed status of product{resource_label}".strip()
    elif action == "product.created":
        return f"Created product{resource_label}".strip()
    elif action == "product.deleted":
        return f"Deleted product{resource_label}".strip()
    elif action.startswith("user.") or action.startswith("role."):
        return f"{action_clean}{resource_label}".strip()
    elif action.startswith("order."):
        return f"{action_clean}{resource_label}".strip()

    return f"{action_clean}{resource_label}".strip()


# ---------------------------------------------------------------------------
# CENTRAL AUDIT SERVICE CLASS
# ---------------------------------------------------------------------------

class AuditService:
    """
    Centralized, production-grade event logging service for all WebCreon SaaS modules.
    Supports human, rider, shipping partner, payment webhook, background, and cron events.
    """

    @staticmethod
    def log_event(
        *,
        action: str,
        category: str,
        actor_type: str = ActorType.USER,
        actor_id: Optional[Union[UUID, str]] = None,
        actor_name: Optional[str] = None,
        actor_email: Optional[str] = None,
        actor_role: Optional[str] = None,
        source: str = SourceType.WEB_APP,
        site_id: Optional[Union[UUID, str]] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[Union[UUID, str]] = None,
        resource_name: Optional[str] = None,
        summary: Optional[str] = None,
        description: Optional[str] = None,
        previous_state: Optional[Dict[str, Any]] = None,
        new_state: Optional[Dict[str, Any]] = None,
        details: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        status: str = "success",
        correlation_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request: Optional[Request] = None,
        session: Optional[Session] = None,
    ) -> Optional[AuditLog]:
        """
        Emits a centralized audit event.
        - Deduplicates using idempotency_key for webhooks/crons.
        - Sanitizes all secrets and masks payment identifiers.
        - Supports caller's session or creates an isolated transaction.
        """
        # Extract HTTP metadata if request provided
        req_ip, req_ua, req_rid = extract_client_metadata(request)
        final_ip = ip_address or req_ip
        final_ua = user_agent or req_ua
        final_req_id = request_id or req_rid

        # Convert UUIDs safely
        parsed_site_id = UUID(str(site_id)) if site_id else None
        parsed_admin_id = None
        if actor_id:
            try:
                parsed_admin_id = UUID(str(actor_id))
            except (ValueError, TypeError):
                parsed_admin_id = None

        # Normalize actor identification
        final_actor_name = (actor_name or "").strip()
        final_actor_email = (actor_email or "").strip()
        final_actor_role = (actor_role or "").strip()

        # If actor_id is present, resolve name, email, and role from the Admin table
        if parsed_admin_id and (not final_actor_name or final_actor_name.lower() == "staff" or not final_actor_role or final_actor_role.lower() == "staff"):
            def _resolve_admin_record(s: Session):
                nonlocal final_actor_name, final_actor_email, final_actor_role
                try:
                    admin_rec = s.get(Admin, parsed_admin_id)
                    if admin_rec:
                        if not final_actor_name or final_actor_name.lower() == "staff":
                            final_actor_name = (admin_rec.name or "").strip() or (admin_rec.email.split("@")[0].title() if admin_rec.email else "Admin")
                        if not final_actor_email and admin_rec.email:
                            final_actor_email = admin_rec.email
                        if not final_actor_role or final_actor_role.lower() == "staff":
                            if admin_rec.role in ("super_admin", "Owner", "owner"):
                                final_actor_role = "Owner"
                            elif admin_rec.role_id:
                                try:
                                    r_rec = s.get(Role, UUID(str(admin_rec.role_id)))
                                    final_actor_role = r_rec.name if r_rec else (admin_rec.role or "Staff")
                                except Exception:
                                    final_actor_role = admin_rec.role or "Staff"
                            else:
                                final_actor_role = admin_rec.role or "Staff"
                except Exception as ex:
                    logger.debug("Failed to resolve admin actor %s: %s", parsed_admin_id, ex)

            if session:
                _resolve_admin_record(session)
            else:
                try:
                    with Session(engine) as tmp_sess:
                        _resolve_admin_record(tmp_sess)
                except Exception:
                    pass

        # Final fallbacks if still empty
        if not final_actor_name:
            if actor_type in (ActorType.SYSTEM, ActorType.CRON_JOB, ActorType.BACKGROUND_JOB):
                final_actor_name = "System"
            elif actor_type == ActorType.SHIPROCKET:
                final_actor_name = "Shiprocket"
            elif actor_type == ActorType.PAYMENT_PROVIDER:
                final_actor_name = "Razorpay"
            elif actor_type == ActorType.AI:
                final_actor_name = "AI Copilot"
            elif final_actor_email:
                final_actor_name = final_actor_email.split("@")[0].title()
            else:
                final_actor_name = "Staff"

        if not final_actor_role:
            final_actor_role = "System Service" if actor_type in (ActorType.SYSTEM, ActorType.CRON_JOB) else ("Rider" if actor_type == ActorType.RIDER else "Staff")

        # Consolidate payload details with before/after diffs
        consolidated_details: Dict[str, Any] = {}
        if details and isinstance(details, dict):
            consolidated_details.update(details)
        if metadata and isinstance(metadata, dict):
            consolidated_details["metadata"] = metadata
        if previous_state is not None:
            consolidated_details["before"] = previous_state
        if new_state is not None:
            consolidated_details["after"] = new_state
        if correlation_id:
            consolidated_details["correlation_id"] = correlation_id

        # Sanitize sensitive fields
        sanitized_details = sanitize_audit_payload(consolidated_details)

        # Generate readable summary if not explicitly provided (preferring clean description if given)
        final_summary = summary or description or format_default_summary(
            actor_name=final_actor_name,
            actor_type=actor_type,
            action=action,
            resource_name=resource_name,
            resource_type=resource_type,
            description=description,
        )
        final_desc = description or final_summary

        def _execute_insert(s: Session) -> Optional[AuditLog]:
            # Idempotency check: if key already exists, return existing event to avoid duplication
            if idempotency_key:
                existing = s.exec(
                    select(AuditLog).where(AuditLog.idempotency_key == idempotency_key)
                ).first()
                if existing:
                    logger.info(f"Audit event with idempotency_key '{idempotency_key}' already recorded. Skipping duplicate.")
                    return existing

            audit_entry = AuditLog(
                id=uuid4(),
                site_id=parsed_site_id,
                admin_id=parsed_admin_id,
                actor_type=actor_type,
                source=source,
                actor_email=final_actor_email or actor_email,
                actor_name=final_actor_name,
                actor_role=final_actor_role,
                action=action,
                category=category,
                description=final_desc,
                summary=final_summary,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id else None,
                resource_name=resource_name,
                ip_address=final_ip,
                user_agent=final_ua,
                request_id=final_req_id,
                correlation_id=correlation_id,
                idempotency_key=idempotency_key,
                status=status.lower(),
                details=sanitized_details,
                created_at=datetime.now(timezone.utc),
            )
            s.add(audit_entry)
            s.commit()
            return audit_entry

        try:
            if session:
                return _execute_insert(session)
            else:
                with Session(engine) as isolated_session:
                    return _execute_insert(isolated_session)
        except Exception as err:
            logger.error(f"Failed to record centralized audit event '{action}': {err}", exc_info=True)
            return None

    @staticmethod
    def cleanup_expired_events(days: int = 90, session: Optional[Session] = None) -> int:
        """
        Permanently purges customer-facing audit events older than retention period (default: 90 days).
        Returns number of deleted rows.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        def _do_cleanup(s: Session) -> int:
            stmt = delete(AuditLog).where(AuditLog.created_at < cutoff)
            result = s.exec(stmt)
            s.commit()
            deleted_count = getattr(result, "rowcount", 0) or 0
            logger.info(f"Purged {deleted_count} expired audit logs older than {days} days (cutoff: {cutoff.isoformat()}).")
            return deleted_count

        try:
            if session:
                return _do_cleanup(session)
            else:
                with Session(engine) as s:
                    return _do_cleanup(s)
        except Exception as err:
            logger.error(f"Failed to execute 90-day audit retention cleanup: {err}", exc_info=True)
            return 0


# Central singleton instance
audit_service = AuditService()
