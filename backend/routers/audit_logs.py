from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlmodel import Session, select, col, or_, and_, desc, func, distinct
from auth_middleware import authenticate_admin, check_admin_has_permission
from db.database import get_session
from models import Admin, AuditLog, Site, AdminSite, Role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Audit Logs"])


def log_audit_event(
    session: Session,
    action: str,
    description: str,
    category: str = "general",
    site_id: Optional[UUID | str] = None,
    admin_id: Optional[UUID | str] = None,
    actor_email: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_role: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
    details: Optional[dict[str, Any]] = None,
) -> Optional[AuditLog]:
    """Helper to record an audit log event safely without failing the main transaction."""
    try:
        parsed_site_id = UUID(str(site_id)) if site_id else None
        parsed_admin_id = UUID(str(admin_id)) if admin_id else None

        # If actor details are missing but admin_id is provided, look up admin
        if parsed_admin_id and (not actor_email or not actor_role):
            admin_obj = session.get(Admin, parsed_admin_id)
            if admin_obj:
                actor_email = actor_email or admin_obj.email
                actor_name = actor_name or admin_obj.name or admin_obj.email.split("@")[0]
                actor_role = actor_role or admin_obj.role

        log_entry = AuditLog(
            site_id=parsed_site_id,
            admin_id=parsed_admin_id,
            actor_email=actor_email,
            actor_name=actor_name,
            actor_role=actor_role or "admin",
            action=action,
            category=category,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            details=details,
            created_at=datetime.now(timezone.utc),
        )
        session.add(log_entry)
        session.commit()
        return log_entry
    except Exception as e:
        logger.warning(f"Failed to record audit log event ({action}): {e}")
        try:
            session.rollback()
        except Exception:
            pass
        return None


def verify_audit_access(
    admin: dict,
    session: Session,
    site_id: Optional[str] = None,
):
    admin_id = admin.get("adminId")
    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
        )

    try:
        a_uuid = UUID(str(admin_id))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    admin_obj = session.get(Admin, a_uuid)
    if not admin_obj or not admin_obj.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is inactive or not found",
        )

    # Owner or super_admin
    if admin_obj.role in ("Owner", "super_admin", "owner") and not admin_obj.role_id:
        return True

    role_obj = None
    if admin_obj.role_id:
        try:
            role_obj = session.get(Role, UUID(str(admin_obj.role_id)))
        except Exception:
            role_obj = None

    if role_obj and role_obj.name == "Owner":
        return True

    # Check permission audit_logs:view
    if not check_admin_has_permission(admin_id, "audit_logs:view", session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to view activity & audit logs.",
        )
    return True


@router.get("/admin/sites/{site_id}/audit-logs")
@router.get("/admin/audit-logs")
def get_audit_logs(
    site_id: Optional[str] = None,
    category: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=100),
    admin: dict = Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    verify_audit_access(admin, session, site_id)

    query = select(AuditLog)

    # Filter by site if site_id provided
    if site_id:
        try:
            parsed_site_uuid = UUID(str(site_id))
            query = query.where(or_(AuditLog.site_id == parsed_site_uuid, AuditLog.site_id == None))
        except ValueError:
            # site_id might be a slug
            site_obj = session.exec(select(Site).where(Site.slug == site_id)).first()
            if site_obj:
                query = query.where(or_(AuditLog.site_id == site_obj.id, AuditLog.site_id == None))

    if category and category != "all":
        query = query.where(AuditLog.category == category)

    if status_filter and status_filter != "all":
        query = query.where(AuditLog.status == status_filter)

    if actor and actor != "all":
        query = query.where(or_(
            AuditLog.actor_email.ilike(f"%{actor}%"),
            AuditLog.actor_name.ilike(f"%{actor}%")
        ))

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.where(
            or_(
                AuditLog.description.ilike(search_term),
                AuditLog.action.ilike(search_term),
                AuditLog.actor_email.ilike(search_term),
                AuditLog.actor_name.ilike(search_term),
                AuditLog.ip_address.ilike(search_term),
            )
        )

    if from_date:
        try:
            dt_from = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            query = query.where(AuditLog.created_at >= dt_from)
        except Exception:
            pass

    if to_date:
        try:
            dt_to = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            query = query.where(AuditLog.created_at <= dt_to)
        except Exception:
            pass

    # Total count for pagination
    try:
        count_query = select(func.count()).select_from(query.subquery())
        total_count = session.exec(count_query).one() or 0
    except Exception:
        total_count = 0

    # Get paginated results
    query = query.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size)
    try:
        results = session.exec(query).all()
    except Exception:
        results = []

    # Calculate high-level summary metrics safely
    now_utc = datetime.now(timezone.utc)
    today_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)

    today_logins = 0
    security_events = 0
    active_actors_count = 0

    try:
        today_logins = session.exec(
            select(func.count(AuditLog.id))
            .where(
                and_(
                    AuditLog.action.ilike("%login%"),
                    AuditLog.created_at >= today_start,
                    AuditLog.status == "success",
                )
            )
        ).one() or 0
    except Exception:
        today_logins = 0

    try:
        security_events = session.exec(
            select(func.count(AuditLog.id))
            .where(
                or_(
                    AuditLog.category == "security",
                    AuditLog.status == "failure",
                    AuditLog.action.ilike("%failed%"),
                )
            )
        ).one() or 0
    except Exception:
        security_events = 0

    try:
        active_actors_count = session.exec(
            select(func.count(distinct(AuditLog.actor_email)))
            .where(AuditLog.created_at >= (now_utc - timedelta(days=7)))
        ).one() or 0
    except Exception:
        active_actors_count = 0

    return {
        "logs": [
            {
                "id": str(log.id),
                "site_id": str(log.site_id) if log.site_id else None,
                "admin_id": str(log.admin_id) if log.admin_id else None,
                "actor_email": log.actor_email,
                "actor_name": log.actor_name or (log.actor_email.split("@")[0] if log.actor_email else "System"),
                "actor_role": log.actor_role or "Admin",
                "action": log.action,
                "category": log.category,
                "description": log.description,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "status": log.status,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in results
        ],
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total_count + page_size - 1) // page_size),
        "stats": {
            "total_events": total_count,
            "today_logins": today_logins,
            "security_events": security_events,
            "active_actors": active_actors_count,
        },
    }


@router.get("/admin/sites/{site_id}/audit-logs/export-csv")
@router.get("/admin/audit-logs/export-csv")
def export_audit_logs_csv(
    site_id: Optional[str] = None,
    category: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    admin: dict = Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    verify_audit_access(admin, session, site_id)

    query = select(AuditLog)
    if site_id:
        try:
            parsed_site_uuid = UUID(str(site_id))
            query = query.where(or_(AuditLog.site_id == parsed_site_uuid, AuditLog.site_id == None))
        except ValueError:
            site_obj = session.exec(select(Site).where(Site.slug == site_id)).first()
            if site_obj:
                query = query.where(or_(AuditLog.site_id == site_obj.id, AuditLog.site_id == None))

    if category and category != "all":
        query = query.where(AuditLog.category == category)

    if actor and actor != "all":
        query = query.where(or_(
            AuditLog.actor_email.ilike(f"%{actor}%"),
            AuditLog.actor_name.ilike(f"%{actor}%")
        ))

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        query = query.where(
            or_(
                AuditLog.description.ilike(search_term),
                AuditLog.action.ilike(search_term),
                AuditLog.actor_email.ilike(search_term),
            )
        )

    logs = session.exec(query.order_by(desc(AuditLog.created_at)).limit(1000)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp (UTC)", "Action", "Category", "Description", "Actor Name", "Actor Email", "Actor Role", "Status", "IP Address"])

    for log in logs:
        writer.writerow([
            log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            log.action,
            log.category,
            log.description,
            log.actor_name or "",
            log.actor_email or "",
            log.actor_role or "",
            log.status,
            log.ip_address or "",
        ])

    csv_data = output.getvalue()
    filename = f"audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
