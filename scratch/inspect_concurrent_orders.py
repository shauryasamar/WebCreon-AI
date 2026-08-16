import sys
from pathlib import Path

# Add project root and backend directory to sys.path for IDE and terminal support
root_path = Path(__file__).resolve().parent.parent
backend_path = root_path / "backend"

for p in [str(root_path), str(backend_path)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from sqlmodel import Session, select

try:
    from backend.db.database import engine
    from backend.models import Order
except ImportError:
    from db.database import engine  # type: ignore
    from models import Order  # type: ignore

with Session(engine) as session:
    orders = session.exec(
        select(Order).order_by(Order.created_at.desc()).limit(10)
    ).all()
    print("=== RECENT 10 ORDERS ===")
    for o in orders:
        snapshot_refund = (
            o.pricing_snapshot.get("refund_details")
            if isinstance(o.pricing_snapshot, dict)
            else None
        )
        print(
            f"ID: {o.id}, Status: {o.status}, PaymentStatus: {o.payment_status}, "
            f"RzpOrderId: {o.razorpay_order_id}, RzpPayId: {o.razorpay_payment_id}, "
            f"Total: {o.total}, CancelReason: {o.cancel_reason}, Snapshot: {snapshot_refund}"
        )
