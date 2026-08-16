import sys, os
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.abspath("backend"))

from sqlmodel import Session, select
from db.database import engine
from models import Order
from routers.payments import get_razorpay_client, finalize_order_fulfillment

client = get_razorpay_client()
print("Razorpay client loaded:", client is not None)

with Session(engine) as session:
    order = session.exec(
        select(Order).where(Order.razorpay_order_id == "order_TQOGHJEy1FfaFw")
    ).first()
    print("Found Order:", order.id if order else None)
    if order:
        success, err = finalize_order_fulfillment(
            order=order,
            session=session,
            payment_id="pay_TQOGUbm7U3i50Z",
            client=client,
        )
        print("Fulfillment result:", success)
        print("Error message:", err)
        print("Order status:", order.status, order.payment_status)
        print("Refund Details in DB:", order.pricing_snapshot.get("refund_details") if isinstance(order.pricing_snapshot, dict) else None)

if client:
    p = client.payment.fetch("pay_TQOGUbm7U3i50Z")
    print(
        "Live Razorpay Payment Status:",
        p.get("id"),
        p.get("status"),
        "amount_refunded:",
        p.get("amount_refunded"),
        "refund_status:",
        p.get("refund_status"),
    )
