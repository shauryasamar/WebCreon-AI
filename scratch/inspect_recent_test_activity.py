import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from db.database import engine
from models import Order, ReturnRequest, TenantBankAccount, TenantLedgerEntry
from sqlmodel import Session, desc, select

def inspect_recent_test_activity():
    with Session(engine) as session:
        print("\n" + "=" * 80)
        print("🔍 RECENT TEST ACTIVITY DIAGNOSTIC REPORT")
        print("=" * 80)

        # 1. Check Bank Account
        bank_accounts = session.exec(select(TenantBankAccount).order_by(desc(TenantBankAccount.created_at))).all()
        print(f"\n1. 🏦 LINKED MERCHANT BANK ACCOUNTS ({len(bank_accounts)}):")
        for b in bank_accounts:
            print(f"   - Name: {b.account_holder_name} | Bank: {b.bank_name} | Last4: {b.account_number_last4} | Verified: {b.is_verified} | Route Acc ID: {b.razorpay_account_id} | Status: {b.route_status}")

        # 2. Check Recent Orders
        orders = session.exec(select(Order).order_by(desc(Order.created_at)).limit(5)).all()
        print(f"\n2. 📦 RECENT ORDERS ({len(orders)}):")
        for o in orders:
            print(f"   - Order ID: #{str(o.id)[:8]} | Status: {o.status} | Pay Status: {o.payment_status} | Escrow: {o.escrow_status} | Total: ₹{o.total} | Delivered At: {o.delivered_at} | Return Closes: {o.return_window_closes_at}")

        # 3. Check Return Requests
        returns = session.exec(select(ReturnRequest).order_by(desc(ReturnRequest.created_at)).limit(5)).all()
        print(f"\n3. ↩ RECENT RETURN REQUESTS ({len(returns)}):")
        for r in returns:
            print(f"   - Return ID: #{str(r.id)[:8]} | Order ID: #{str(r.order_id)[:8]} | Status: {r.status} | Refund Suggested: ₹{r.suggested_refund_amount} | Final Refund: ₹{r.final_refund_amount} | Rejection Reason: '{r.rejection_reason}'")

        # 4. Check Ledger Entries
        ledgers = session.exec(select(TenantLedgerEntry).order_by(desc(TenantLedgerEntry.created_at)).limit(5)).all()
        print(f"\n4. 📊 TENANT SETTLEMENT LEDGER ENTRIES ({len(ledgers)}):")
        for l in ledgers:
            print(f"   - Ledger ID: #{str(l.id)[:8]} | Order: #{str(l.order_id)[:8]} | Gross: ₹{l.gross_amount} | Fee (3%): ₹{l.platform_fee} | Tenant Net (97%): ₹{l.tenant_share} | Status: {l.status} | Escrow: {l.escrow_status} | Transfer ID: {l.razorpay_transfer_id} | Settled At: {l.settled_at}")

        print("=" * 80 + "\n")

if __name__ == "__main__":
    inspect_recent_test_activity()
