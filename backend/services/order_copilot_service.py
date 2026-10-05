"""
WebCreon AI Store Co-Pilot - Safe Order Mutation Service
Enforces deterministic transition matrix, tenant isolation, atomic transaction boundaries, and audit logging.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple, List
from uuid import UUID, uuid4
from sqlmodel import Session, select
from models import Order, OrderStatusHistory, AuditLog


# Deterministic State Transition Matrix
ALLOWED_ORDER_TRANSITIONS: Dict[str, List[str]] = {
    "placed": ["accepted", "cancelled"],
    "new": ["accepted", "cancelled"],
    "pending": ["accepted", "cancelled"],
    "accepted": ["shipped", "cancelled"],
    "shipped": ["out_for_delivery", "delivered"],
    "out_for_delivery": ["delivered"],
    "delivered": [],    # Terminal state
    "cancelled": [],    # Terminal state
}


def get_order_for_site(
    session: Session,
    site_id: str | UUID,
    order_id_or_ref: str,
) -> Optional[Order]:
    """Retrieves an order strictly isolated to the specified site_id."""
    s_uuid = UUID(str(site_id))
    order_ref = str(order_id_or_ref).strip()

    # 1. Try full UUID
    try:
        o_uuid = UUID(order_ref)
        return session.exec(
            select(Order).where(Order.id == o_uuid, Order.site_id == s_uuid)
        ).first()
    except (ValueError, TypeError):
        pass

    # 2. Try matching order ID prefix or clean reference
    clean_ref = order_ref.replace("#", "").replace("order-", "").replace("ord_", "").lower()
    orders = session.exec(select(Order).where(Order.site_id == s_uuid)).all()
    for o in orders:
        if str(o.id).lower().startswith(clean_ref) or (hasattr(o, "order_number") and str(getattr(o, "order_number", "")).lower() == clean_ref):
            return o

    return None


def mutate_order_status_safe(
    session: Session,
    site_id: str | UUID,
    order_id_or_ref: str,
    new_status: str,
    actor_id: str | UUID,
    actor_email: str = "copilot@webcreon.in",
    notes: Optional[str] = None,
    operation_id: Optional[str | UUID] = None,
) -> Tuple[bool, Optional[Order], Optional[str]]:
    """
    Safely executes an order status transition with validation and audit trail.
    """
    s_uuid = UUID(str(site_id))
    a_uuid = UUID(str(actor_id))
    target_status = new_status.strip().lower()

    # Normalize status terms
    if target_status in ("cancel", "canceled", "cancelled"):
        target_status = "cancelled"
    elif target_status in ("accept", "accepted"):
        target_status = "accepted"
    elif target_status in ("ship", "shipped"):
        target_status = "shipped"
    elif target_status in ("deliver", "delivered"):
        target_status = "delivered"

    order = get_order_for_site(session, s_uuid, order_id_or_ref)
    if not order:
        return False, None, f"Order '{order_id_or_ref}' not found in this store."

    current_status = (order.status or "placed").lower()
    allowed_next = ALLOWED_ORDER_TRANSITIONS.get(current_status, [])

    if target_status not in allowed_next:
        return (
            False,
            order,
            f"Invalid status transition: Order is currently '{current_status}' and cannot transition to '{target_status}'. Allowed: {allowed_next}",
        )

    # Apply mutation
    order.status = target_status
    if target_status == "cancelled":
        order.cancelled_at = datetime.now(timezone.utc)
        if notes:
            order.cancel_reason = notes
    elif target_status == "delivered":
        order.delivered_at = datetime.now(timezone.utc)
    elif target_status == "shipped":
        order.shipped_at = datetime.now(timezone.utc)
    elif target_status == "accepted":
        order.confirmed_at = datetime.now(timezone.utc)

    session.add(order)

    # Add order status history record
    history_entry = OrderStatusHistory(
        id=uuid4(),
        order_id=order.id,
        site_id=s_uuid,
        status=target_status,
        changed_by_admin_id=a_uuid,
        notes=notes or f"Updated to {target_status} via AI Store Co-Pilot",
        created_at=datetime.now(timezone.utc),
    )
    session.add(history_entry)

    # Write audit log
    audit_log = AuditLog(
        id=uuid4(),
        site_id=s_uuid,
        admin_id=a_uuid,
        actor_email=actor_email,
        action="order:update_status",
        category="orders",
        description=f"Changed order #{str(order.id)[:8]} status from {current_status} to {target_status}",
        resource_type="order",
        resource_id=str(order.id),
        status="success",
        details={
            "old_status": current_status,
            "new_status": target_status,
            "operation_id": str(operation_id) if operation_id else None,
        },
        created_at=datetime.now(timezone.utc),
    )
    session.add(audit_log)

    session.commit()
    session.refresh(order)
    return True, order, None
