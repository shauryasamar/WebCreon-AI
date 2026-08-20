import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from db.database import engine
from models import Order, TenantLedgerEntry
from sqlmodel import Session, select

def inspect_order_bd3a1b05():
    with Session(engine) as session:
        orders = session.exec(select(Order)).all()
        target = [o for o in orders if str(o.id).startswith("bd3a1b05")]
        if not target:
            print("Order bd3a1b05 not found")
            return
        order = target[0]
        print(f"📦 Order {order.id}: Status={order.status}, PayStatus={order.payment_status}, EscrowStatus={order.escrow_status}, EscrowUnheldAt={order.escrow_unheld_at}")

        ledger = session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)).first()
        if ledger:
            print(f"📊 Ledger {ledger.id}: Status={ledger.status}, EscrowStatus={ledger.escrow_status}, SettledAt={ledger.settled_at}, TransferId={ledger.razorpay_transfer_id}")
        else:
            print("No ledger entry for order")

if __name__ == "__main__":
    inspect_order_bd3a1b05()
