import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from db.database import engine
from models import Admin, Order, Site, TenantBankAccount, TenantLedgerEntry, User
from sqlmodel import Session, select

def simulate_delivered_order_older_than_48_hours():
    with Session(engine) as session:
        # 1. Find or pick the first active site
        site = session.exec(select(Site)).first()
        if not site:
            print("❌ No site found. Please create a store first.")
            return

        admin = session.exec(select(Admin)).first()
        user = session.exec(select(User).where(User.site_id == site.id)).first()
        if not user:
            user = User(id=uuid4(), site_id=site.id, phone="9876543210", full_name="Test Customer")
            session.add(user)
            session.commit()

        now = datetime.now(timezone.utc)
        delivered_time = now - timedelta(days=3)  # Delivered 3 days ago!
        return_window_closes = delivered_time + timedelta(days=2)  # Closed 1 day ago!

        order_id = uuid4()
        total_amount = Decimal("2500.00")
        platform_fee = Decimal("75.00")
        tenant_share = Decimal("2425.00")

        order = Order(
            id=order_id,
            site_id=site.id,
            customer_id=user.id,
            items=[{"product_name": "Silk Linen Shirt", "quantity": 1, "unit_price": 2500.0}],
            payment_method="razorpay",
            payment_status="paid",
            razorpay_order_id=f"order_{uuid4().hex[:12]}",
            razorpay_payment_id=f"pay_{uuid4().hex[:12]}",
            total=total_amount,
            platform_fee=platform_fee,
            tenant_share=tenant_share,
            status="delivered",
            delivered_at=delivered_time,
            return_window_closes_at=return_window_closes,
            escrow_status="held",
            created_at=delivered_time,
        )
        session.add(order)

        ledger = TenantLedgerEntry(
            admin_id=admin.id if admin else user.id,
            site_id=site.id,
            order_id=order_id,
            gross_amount=total_amount,
            platform_fee_percent=Decimal("3.00"),
            platform_fee=platform_fee,
            tenant_share=tenant_share,
            currency="INR",
            status="in_escrow",
            escrow_status="held",
            escrow_release_due_at=return_window_closes,
            razorpay_transfer_id=f"trf_{uuid4().hex[:10]}",
            transfer_status="held",
            created_at=delivered_time,
        )
        session.add(ledger)
        session.commit()

        print("=" * 60)
        print(f"✅ Created Order #{str(order_id)[:8].upper()} for Site ID: {site.id}")
        print(f"📦 Delivered: 3 days ago ({delivered_time.strftime('%d %b %Y, %I:%M %p')})")
        print(f"⏳ 48-Hour Return Window: Closed on {return_window_closes.strftime('%d %b %Y, %I:%M %p')}")
        print(f"🔒 Current Status: IN ESCROW HOLD (₹{tenant_share})")
        print("=" * 60)
        print(f"\n👉 NOW OPEN: http://localhost:5173/builder/{site.id}/admin/earnings")
        print("👉 You will see the ₹2,425 in 'In Escrow Hold'.")
        print("👉 Click '↻ Release Matured Escrows' button on the UI, and watch it settle to bank!")
        print("=" * 60)

if __name__ == "__main__":
    simulate_delivered_order_older_than_48_hours()
