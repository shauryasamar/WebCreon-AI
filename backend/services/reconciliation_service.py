"""
Stale & Orphaned Order Reconciliation Background Service for WebCreon.

Runs periodically to query orders stuck in 'pending' or 'placed' with pending payment
past a configurable timeout (default 15 minutes).
Reconciles real payment state with Razorpay API:
- If captured: atomically fulfills order & decrements stock.
- If failed / created past timeout: marks failed/cancelled and releases any holds.
- Tracks and alerts if stuck order threshold is exceeded (indicating webhook outage).
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlmodel import Session, select
from db.database import engine
from models import Order, Product, Site
from routers.orders import utc_now

logger = logging.getLogger("payment_reconciliation")


class OrderReconciliationResult:
    def __init__(self):
        self.scanned_count: int = 0
        self.healed_paid_count: int = 0
        self.healed_failed_count: int = 0
        self.error_count: int = 0
        self.errors: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scanned_count": self.scanned_count,
            "healed_paid_count": self.healed_paid_count,
            "healed_failed_count": self.healed_failed_count,
            "error_count": self.error_count,
            "errors": self.errors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def reconcile_stale_orders(
    session: Optional[Session] = None,
    timeout_minutes: int = 15,
    max_stuck_threshold_per_run: int = 10,
    razorpay_client_override: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Scans and reconciles stale pending orders.
    Accepts an optional active SQLModel session; opens a new engine session if omitted.
    """
    if session is None:
        with Session(engine) as new_session:
            return _execute_reconciliation(
                session=new_session,
                timeout_minutes=timeout_minutes,
                max_stuck_threshold_per_run=max_stuck_threshold_per_run,
                razorpay_client_override=razorpay_client_override,
            )
    else:
        return _execute_reconciliation(
            session=session,
            timeout_minutes=timeout_minutes,
            max_stuck_threshold_per_run=max_stuck_threshold_per_run,
            razorpay_client_override=razorpay_client_override,
        )


def _execute_reconciliation(
    session: Session,
    timeout_minutes: int = 15,
    max_stuck_threshold_per_run: int = 10,
    razorpay_client_override: Optional[Any] = None,
) -> Dict[str, Any]:
    from routers.payments import finalize_order_fulfillment, get_razorpay_client

    result: Dict[str, Any] = {
        "total_scanned": 0,
        "scanned_count": 0,
        "healed_count": 0,
        "healed_paid_count": 0,
        "healed_failed_count": 0,
        "error_count": 0,
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    cutoff = utc_now() - timedelta(minutes=timeout_minutes)

    # Find orders in pending payment state created before the cutoff timeout
    stale_orders = session.exec(
        select(Order).where(
            Order.payment_method == "razorpay",
            Order.payment_status == "pending",
            Order.created_at < cutoff,
        )
    ).all()

    result["total_scanned"] = len(stale_orders)
    result["scanned_count"] = len(stale_orders)

    if len(stale_orders) >= max_stuck_threshold_per_run:
        logger.critical(
            "UPSTREAM_WEBHOOK_ALERT: %d orders are stuck in pending payment state! "
            "Possible Razorpay webhook delivery failure or network partition.",
            len(stale_orders),
        )

    rz_client = razorpay_client_override or get_razorpay_client()

    for order in stale_orders:
        order_id_str = str(order.id)
        rzp_order_id = getattr(order, "razorpay_order_id", None) or getattr(order, "payment_gateway_order_id", None)
        if not rzp_order_id:
            # No Razorpay order ID generated; mark as abandoned/failed
            order.payment_status = "failed"
            order.status = "cancelled"
            order.cancel_reason = "Payment session expired without initiation."
            order.updated_at = utc_now()
            session.add(order)
            result["healed_failed_count"] += 1
            result["healed_count"] += 1
            continue

        try:
            # If mock or no live client, evaluate status safely
            if not rz_client or rzp_order_id.startswith("order_mock_"):
                continue

            rzp_order = rz_client.order.fetch(rzp_order_id)
            rzp_status = rzp_order.get("status")

            if rzp_status == "paid":
                # Fetch payments for this order
                payments = rz_client.order.payments(rzp_order_id)
                captured_payment = None
                if payments and isinstance(payments.get("items"), list):
                    for p in payments["items"]:
                        if p.get("status") == "captured":
                            captured_payment = p
                            break

                payment_id = captured_payment.get("id") if captured_payment else None
                method = captured_payment.get("method") if captured_payment else "online"

                success, msg = finalize_order_fulfillment(
                    order=order,
                    session=session,
                    payment_id=payment_id,
                    payment_method=method,
                )
                if success:
                    result["healed_paid_count"] += 1
                    result["healed_count"] += 1
                    logger.info("Reconciliation self-healed paid order %s (Payment ID: %s)", order_id_str, payment_id)
                else:
                    result["error_count"] += 1
                    result["errors"].append(f"Order {order_id_str}: {msg}")

            elif rzp_status in ("created", "attempted"):
                # Past the 15-minute checkout window without completion -> Mark failed
                order.payment_status = "failed"
                order.status = "cancelled"
                order.cancel_reason = "Payment expired/abandoned past 15-minute checkout window."
                order.updated_at = utc_now()
                session.add(order)
                result["healed_failed_count"] += 1
                result["healed_count"] += 1
                logger.info("Reconciliation expired abandoned order %s", order_id_str)

            session.commit()

        except Exception as ex:
            session.rollback()
            result["error_count"] += 1
            err_msg = f"Failed to reconcile order {order_id_str}: {str(ex)}"
            result["errors"].append(err_msg)
            logger.error(err_msg)

    return result
