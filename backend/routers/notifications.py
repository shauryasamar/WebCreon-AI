"""
Multi-Tenant Customer Notifications & Store Email Configuration API Endpoints.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, col, func, select

from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    check_admin_has_permission,
    enforce_site_ownership,
    resolve_site_by_slug_or_404,
)
from crypto_utils import decrypt_string, encrypt_string
from db.database import get_session
from models import Admin, CustomerNotification, NotificationDeliveryLog, Site, StoreEmailSettings, User, utc_now
from routers.audit_logs import log_activity
from services.email_adapter import verify_smtp_connection
from services.notification_service import purge_expired_customer_notifications

logger = logging.getLogger("notifications_router")

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
)


# ---------------------------------------------------------------------------
# Request & Response Models
# ---------------------------------------------------------------------------

class UpdateEmailSettingsRequest(BaseModel):
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    reply_to_email: Optional[str] = None
    provider_type: Optional[str] = "smtp"
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = True
    smtp_use_ssl: Optional[bool] = False
    is_enabled: Optional[bool] = True


class TestEmailRequest(BaseModel):
    recipient_email: Optional[str] = None



def serialize_notification(n: CustomerNotification) -> Dict[str, Any]:
    return {
        "id": str(n.id),
        "site_id": str(n.site_id),
        "siteId": str(n.site_id),
        "customer_id": str(n.customer_id),
        "customerId": str(n.customer_id),
        "event_type": n.event_type,
        "eventType": n.event_type,
        "category": n.category,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "isRead": n.is_read,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "readAt": n.read_at.isoformat() if n.read_at else None,
        "related_entity_type": n.related_entity_type,
        "relatedEntityType": n.related_entity_type,
        "related_entity_id": n.related_entity_id,
        "relatedEntityId": n.related_entity_id,
        "action_url": n.action_url,
        "actionUrl": n.action_url,
        "metadata": n.metadata_,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "createdAt": n.created_at.isoformat() if n.created_at else None,
    }


def serialize_email_settings(s: StoreEmailSettings) -> Dict[str, Any]:
    return {
        "id": str(s.id),
        "site_id": str(s.site_id),
        "siteId": str(s.site_id),
        "sender_name": s.sender_name,
        "senderName": s.sender_name,
        "sender_email": s.sender_email,
        "senderEmail": s.sender_email,
        "reply_to_email": s.reply_to_email,
        "replyToEmail": s.reply_to_email,
        "provider_type": s.provider_type,
        "providerType": s.provider_type,
        "smtp_host": s.smtp_host,
        "smtpHost": s.smtp_host,
        "smtp_port": s.smtp_port,
        "smtpPort": s.smtp_port,
        "smtp_user": s.smtp_user,
        "smtpUser": s.smtp_user,
        "has_smtp_password": bool(s.smtp_password_encrypted),
        "smtpPasswordSet": bool(s.smtp_password_encrypted),
        "smtp_use_tls": s.smtp_use_tls,
        "smtpUseTls": s.smtp_use_tls,
        "smtp_use_ssl": s.smtp_use_ssl,
        "smtpUseSsl": s.smtp_use_ssl,
        "verification_status": s.verification_status,
        "verificationStatus": s.verification_status,
        "verification_error": s.verification_error,
        "verificationError": s.verification_error,
        "last_verified_at": s.last_verified_at.isoformat() if s.last_verified_at else None,
        "lastVerifiedAt": s.last_verified_at.isoformat() if s.last_verified_at else None,
        "is_enabled": s.is_enabled,
        "isEnabled": s.is_enabled,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Customer Endpoints
# ---------------------------------------------------------------------------

@router.get("/customer/{website_name}")
def get_customer_notifications(
    website_name: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    filter: str = Query("all", regex="^(all|unread)$"),
    category: Optional[str] = Query(None),
    auth_user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    site = resolve_site_by_slug_or_404(website_name, session)

    if str(site.id) != auth_user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer_uuid = UUID(auth_user["userId"])

    # Base query strictly scoped by site_id and customer_id
    conditions = [
        CustomerNotification.site_id == site.id,
        CustomerNotification.customer_id == customer_uuid,
    ]

    if filter == "unread":
        conditions.append(CustomerNotification.is_read == False)

    if category and category != "all":
        if category == "order":
            conditions.append(CustomerNotification.category.in_(["order", "delivery"]))
        elif category == "return":
            conditions.append(CustomerNotification.category.in_(["return", "refund"]))
        elif category == "support":
            conditions.append(CustomerNotification.category == "support")
        else:
            conditions.append(CustomerNotification.category == category)

    query = select(CustomerNotification).where(*conditions)

    # Count unread total (independent of active filter so badge stays accurate)
    unread_count_query = select(func.count(CustomerNotification.id)).where(
        CustomerNotification.site_id == site.id,
        CustomerNotification.customer_id == customer_uuid,
        CustomerNotification.is_read == False,
    )
    total_unread = session.exec(unread_count_query).one()

    # Total count for pagination under current conditions
    total_query = select(func.count(CustomerNotification.id)).where(*conditions)
    total_count = session.exec(total_query).one()

    # Paginated results
    offset = (page - 1) * limit
    results = session.exec(
        query.order_by(col(CustomerNotification.created_at).desc()).offset(offset).limit(limit)
    ).all()

    total_pages = max(1, (total_count + limit - 1) // limit)
    has_more = page < total_pages

    return {
        "notifications": [serialize_notification(n) for n in results],
        "totalUnread": total_unread,
        "total_unread": total_unread,
        "unread_count": total_unread,
        "unreadCount": total_unread,
        "totalCount": total_count,
        "total_count": total_count,
        "page": page,
        "totalPages": total_pages,
        "hasMore": has_more,
        "has_more": has_more,
    }


@router.get("/customer/{website_name}/unread-count")
def get_customer_unread_count(
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

    customer_uuid = UUID(auth_user["userId"])
    unread_count = session.exec(
        select(func.count(CustomerNotification.id)).where(
            CustomerNotification.site_id == site.id,
            CustomerNotification.customer_id == customer_uuid,
            CustomerNotification.is_read == False,
        )
    ).one()

    return {
        "unreadCount": unread_count,
        "unread_count": unread_count,
    }


@router.patch("/customer/{website_name}/{notification_id}/read")
def mark_notification_read(
    website_name: str,
    notification_id: UUID,
    auth_user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    site = resolve_site_by_slug_or_404(website_name, session)

    if str(site.id) != auth_user["siteId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer token does not match requested site",
        )

    customer_uuid = UUID(auth_user["userId"])

    notif = session.exec(
        select(CustomerNotification).where(
            CustomerNotification.id == notification_id,
            CustomerNotification.site_id == site.id,
            CustomerNotification.customer_id == customer_uuid,
        )
    ).first()

    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    if not notif.is_read:
        notif.is_read = True
        notif.read_at = utc_now()
        session.add(notif)
        session.commit()
        session.refresh(notif)

    return {"message": "Notification marked as read", "notification": serialize_notification(notif)}


@router.patch("/customer/{website_name}/mark-all-read")
def mark_all_notifications_read(
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

    customer_uuid = UUID(auth_user["userId"])
    now = utc_now()

    unread_notifs = session.exec(
        select(CustomerNotification).where(
            CustomerNotification.site_id == site.id,
            CustomerNotification.customer_id == customer_uuid,
            CustomerNotification.is_read == False,
        )
    ).all()

    for n in unread_notifs:
        n.is_read = True
        n.read_at = now
        session.add(n)

    session.commit()

    return {"message": "All notifications marked as read", "updatedCount": len(unread_notifs)}


# ---------------------------------------------------------------------------
# Admin Store Control Endpoints
# ---------------------------------------------------------------------------

@router.get("/admin/{site_id}/email-settings")
def get_store_email_settings(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not (check_admin_has_permission(admin["adminId"], "notifications:view", session) or check_admin_has_permission(admin["adminId"], "notifications:edit", session)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission notifications:view required")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    settings = session.exec(
        select(StoreEmailSettings).where(StoreEmailSettings.site_id == site_id)
    ).first()

    if not settings:
        settings = StoreEmailSettings(
            site_id=site_id,
            sender_name=site.name,
            verification_status="not_configured",
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)

    return serialize_email_settings(settings)


@router.put("/admin/{site_id}/email-settings")
def update_store_email_settings(
    site_id: UUID,
    payload: UpdateEmailSettingsRequest,
    request: Request,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not check_admin_has_permission(admin["adminId"], "notifications:edit", session):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission notifications:edit required")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    settings = session.exec(
        select(StoreEmailSettings).where(StoreEmailSettings.site_id == site_id)
    ).first()

    if not settings:
        settings = StoreEmailSettings(site_id=site_id)

    if payload.sender_name is not None:
        settings.sender_name = payload.sender_name.strip() if payload.sender_name and payload.sender_name.strip() else None
    if payload.sender_email is not None:
        settings.sender_email = payload.sender_email.strip().lower() if payload.sender_email and payload.sender_email.strip() else None
    if payload.reply_to_email is not None:
        settings.reply_to_email = payload.reply_to_email.strip().lower() if payload.reply_to_email and payload.reply_to_email.strip() else None
    if payload.provider_type is not None:
        settings.provider_type = payload.provider_type
    if payload.smtp_host is not None:
        settings.smtp_host = payload.smtp_host.strip() if payload.smtp_host and payload.smtp_host.strip() else None
    if payload.smtp_port is not None:
        settings.smtp_port = payload.smtp_port or 587
    if payload.smtp_user is not None:
        settings.smtp_user = payload.smtp_user.strip() if payload.smtp_user and payload.smtp_user.strip() else None
    if payload.smtp_password is not None:
        if payload.smtp_password.strip():
            settings.smtp_password_encrypted = encrypt_string(payload.smtp_password.strip())
        else:
            settings.smtp_password_encrypted = None
    if payload.smtp_use_tls is not None:
        settings.smtp_use_tls = payload.smtp_use_tls
    if payload.smtp_use_ssl is not None:
        settings.smtp_use_ssl = payload.smtp_use_ssl
    if payload.is_enabled is not None:
        settings.is_enabled = payload.is_enabled

    session.add(settings)
    session.commit()
    session.refresh(settings)

    state_str = "Enabled" if settings.is_enabled else "Disabled"
    try:
        admin_record = session.get(Admin, UUID(str(admin["adminId"]))) if admin.get("adminId") else None
        admin_name = (admin_record.name.strip() if admin_record and admin_record.name else None) or (admin_record.email.split("@")[0].title() if admin_record and admin_record.email else None)
        
        log_activity(
            session=session,
            action="notifications.email_settings.updated",
            description=f"Updated email notification settings (Delivery {state_str})",
            category="notifications",
            site_id=site_id,
            admin_id=admin.get("adminId"),
            actor_email=admin.get("email"),
            actor_name=admin_name,
            resource_type="email_settings",
            resource_id=str(site_id),
            resource_name=site.name,
            summary=f"Email notifications {state_str.lower()}",
            details={
                "is_enabled": settings.is_enabled,
                "sender_name": settings.sender_name,
                "sender_email": settings.sender_email,
                "reply_to_email": settings.reply_to_email,
                "provider_type": settings.provider_type,
                "smtp_host": settings.smtp_host,
                "smtp_port": settings.smtp_port,
                "smtp_use_tls": settings.smtp_use_tls,
                "smtp_use_ssl": settings.smtp_use_ssl,
                "has_smtp_password": bool(settings.smtp_password_encrypted),
            },
            request=request,
            status="success",
        )
    except Exception as log_err:
        logger.warning(f"Failed to log email settings update activity: {log_err}")

    return {
        "message": "Store email settings updated successfully",
        "settings": serialize_email_settings(settings),
    }


@router.post("/admin/{site_id}/email-settings/test")
def test_and_verify_email_settings(
    site_id: UUID,
    payload: TestEmailRequest,
    request: Request,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not check_admin_has_permission(admin["adminId"], "notifications:edit", session):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission notifications:edit required")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    settings = session.exec(
        select(StoreEmailSettings).where(StoreEmailSettings.site_id == site_id)
    ).first()

    admin_record = session.get(Admin, UUID(str(admin["adminId"]))) if admin.get("adminId") else None
    admin_name = (admin_record.name.strip() if admin_record and admin_record.name else None) or (admin_record.email.split("@")[0].title() if admin_record and admin_record.email else None)

    if not settings or not settings.smtp_host or not settings.smtp_user or not settings.smtp_password_encrypted:
        err_msg = "Please provide SMTP host, username, and password before testing"
        try:
            log_activity(
                session=session,
                action="notifications.smtp_test.failed",
                description=f"SMTP test connection attempt failed: {err_msg}",
                category="notifications",
                site_id=site_id,
                admin_id=admin.get("adminId"),
                actor_email=admin.get("email"),
                actor_name=admin_name,
                resource_type="email_settings",
                resource_id=str(site_id),
                resource_name=site.name,
                summary="Incomplete SMTP credentials for testing",
                details={"error": err_msg},
                request=request,
                status="failure",
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )

    raw_recipient = (payload.recipient_email or "").strip()
    test_recipient = raw_recipient if raw_recipient else (admin_record.email if admin_record else None)

    if not test_recipient:
        raise HTTPException(status_code=400, detail="No recipient email available for test")

    raw_password = decrypt_string(settings.smtp_password_encrypted)
    store_name = settings.sender_name or site.name

    success, error_msg = verify_smtp_connection(
        host=settings.smtp_host,
        port=settings.smtp_port,
        user=settings.smtp_user,
        password=raw_password,
        test_to_email=test_recipient,
        store_name=store_name,
        sender_email=settings.sender_email,
        use_tls=settings.smtp_use_tls,
        use_ssl=settings.smtp_use_ssl,
    )

    if success:
        settings.verification_status = "verified"
        settings.verification_error = None
        settings.last_verified_at = utc_now()
    else:
        settings.verification_status = "failed"
        settings.verification_error = error_msg

    session.add(settings)
    session.commit()
    session.refresh(settings)

    try:
        log_activity(
            session=session,
            action="notifications.smtp_test.success" if success else "notifications.smtp_test.failed",
            description=f"SMTP test verification email sent to {test_recipient}" if success else f"SMTP test connection failed for {test_recipient}: {error_msg}",
            category="notifications",
            site_id=site_id,
            admin_id=admin.get("adminId"),
            actor_email=admin.get("email"),
            actor_name=admin_name,
            resource_type="email_settings",
            resource_id=str(site_id),
            resource_name=site.name,
            summary=f"Verified SMTP connection to {settings.smtp_host}:{settings.smtp_port}" if success else f"Failed SMTP test: {error_msg}",
            details={
                "recipient": test_recipient,
                "smtp_host": settings.smtp_host,
                "smtp_port": settings.smtp_port,
                "error": error_msg if not success else None,
            },
            request=request,
            status="success" if success else "failure",
        )
    except Exception as log_err:
        logger.warning(f"Failed to log smtp test activity: {log_err}")


    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMTP verification failed: {error_msg}",
        )

    return {
        "message": f"Verification email sent to {test_recipient} and connection verified successfully!",
        "settings": serialize_email_settings(settings),
    }



@router.get("/admin/{site_id}/delivery-logs")
def get_store_delivery_logs(
    site_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    channel_filter: Optional[str] = Query(None, alias="channel"),
    limit: int = 50,
    offset: int = 0,
    admin=Depends(authenticate_admin),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not (check_admin_has_permission(admin["adminId"], "notifications:view", session) or check_admin_has_permission(admin["adminId"], "notifications:edit", session)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission notifications:view required")

    stmt = select(NotificationDeliveryLog).where(NotificationDeliveryLog.site_id == site_id)
    if status_filter:
        stmt = stmt.where(NotificationDeliveryLog.status == status_filter)
    if channel_filter:
        stmt = stmt.where(NotificationDeliveryLog.channel == channel_filter)
    stmt = stmt.order_by(NotificationDeliveryLog.created_at.desc()).offset(offset).limit(limit)

    logs = session.exec(stmt).all()
    count_stmt = select(func.count(NotificationDeliveryLog.id)).where(NotificationDeliveryLog.site_id == site_id)
    if status_filter:
        count_stmt = count_stmt.where(NotificationDeliveryLog.status == status_filter)
    if channel_filter:
        count_stmt = count_stmt.where(NotificationDeliveryLog.channel == channel_filter)
    total = session.exec(count_stmt).one() or 0

    return {
        "items": [
            {
                "id": str(log.id),
                "channel": log.channel,
                "recipient": log.recipient,
                "event_type": log.event_type,
                "subject": log.subject,
                "status": log.status,
                "attempts": log.attempts,
                "last_error": log.last_error,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            }
            for log in logs
        ],
        "total": total,
    }


@router.post("/admin/{site_id}/cleanup")
def run_retention_cleanup(
    site_id: UUID,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    if admin.get("role") not in ("super_admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin / Owner only")

    purged_notifs, _ = purge_expired_customer_notifications(session, retention_days=90)
    return {"message": f"Purged {purged_notifs} customer notifications older than 90 days."}
