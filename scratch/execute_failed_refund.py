import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
root_path = Path(__file__).resolve().parent.parent
backend_path = root_path / "backend"

for p in [str(root_path), str(backend_path)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from sqlmodel import Session, select

try:
    from backend.db.database import engine
    from backend.models import Order
    from backend.routers.payments import get_razorpay_client, finalize_order_fulfillment
except ImportError:
    from db.database import engine  # type: ignore
    from models import Order  # type: ignore
    from routers.payments import get_razorpay_client, finalize_order_fulfillment  # type: ignore

client = get_razorpay_client()
print("Razorpay client loaded:", client is not None)

with Session(engine) as session:
    order2 = session.exec(
        select(Order).where(Order.razorpay_order_id == "order_TQNr3nZkRzDFMf")
    ).first()
    print("Found Order 2:", order2.id if order2 else None)
    if order2:
        success, err = finalize_order_fulfillment(
            order=order2,
            session=session,
            payment_id="pay_TQNrJFN1cBD5Ck",
            client=client,
        )
        print("Fulfillment result:", success, err)
        print("Order status:", order2.status, order2.payment_status)
        if isinstance(order2.pricing_snapshot, dict):
            print("Refund Details in Snapshot:", order2.pricing_snapshot.get("refund_details"))

if client:
    p = client.payment.fetch("pay_TQNrJFN1cBD5Ck")
    print(
        "Live Razorpay Payment Status:",
        p.get("id"),
        p.get("status"),
        "amount_refunded:",
        p.get("amount_refunded"),
        "refund_status:",
        p.get("refund_status"),
    )
