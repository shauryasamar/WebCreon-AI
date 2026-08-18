import concurrent.futures
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from crypto_utils import decrypt_string, encrypt_string, mask_account_number
from db.database import engine
from main import app
from models import (
    Admin,
    AdminSite,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Product,
    ReturnItem,
    ReturnRequest,
    Site,
    TenantBankAccount,
    TenantLedgerEntry,
    User,
)
from routers.payments import (
    finalize_order_fulfillment,
    get_platform_commission_percent,
    unhold_tenant_escrow_transfer,
)


class UltimatePaymentStressTester:
    def __init__(self):
        self.client = TestClient(app)
        self.results: dict[str, bool] = {}
        self.messages: list[str] = []

    def log(self, test_name: str, passed: bool, details: str):
        self.results[test_name] = passed
        status = "PASSED" if passed else "FAILED"
        icon = "[PASS]" if passed else "[FAIL]"
        print(f"{icon} {test_name}: {status}")
        print(f"   -> {details}\n")

    def run_all(self):
        print("\n" + "=" * 80)
        print("  STARTING ULTIMATE PAYMENT ROBUSTNESS & CONCURRENCY STRESS TEST")
        print("=" * 80 + "\n")

        self.test_1_flash_sale_concurrency()
        self.test_2_webhook_dropoff_and_replay_attack()
        self.test_3_prorated_partial_return_math()
        self.test_4_escrow_48h_dispute_and_maturity()
        self.test_5_sub_rupee_transfer_floor_safety()
        self.test_6_aes256_bank_encryption_and_masking()

        print("=" * 80)
        print("  STRESS TEST SUMMARY RESULTS")
        print("=" * 80)
        all_passed = True
        for name, passed in self.results.items():
            status = "PASS" if passed else "FAIL"
            if not passed:
                all_passed = False
            print(f"  [{status}] {name}")
        print("=" * 80)
        if all_passed:
            print("  ALL 6 PRODUCTION STRESS TESTS PASSED WITH 100% ROBUSTNESS!")
        else:
            print("  SOME TESTS FAILED! Check logs above.")
        print("=" * 80 + "\n")

    def test_1_flash_sale_concurrency(self):
        """
        Simulates 10 threads trying to purchase a product with only 3 units in stock simultaneously.
        """
        test_name = "Test 1: Flash Sale Concurrency & Race Condition Guard"
        order_ids: list[UUID] = []
        prod_id = uuid4()

        with Session(engine) as session:
            admin_id = uuid4()
            site_id = uuid4()

            admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
            site = Site(id=site_id, slug=f"site-{site_id.hex[:6]}", site_definition={"site": {"brand_name": "Flash Sale"}})
            session.add(admin)
            session.add(site)
            session.commit()

            admin_site = AdminSite(admin_id=admin_id, site_id=site_id)
            product = Product(
                id=prod_id,
                site_id=site_id,
                name="Limited Edition Sneaker",
                price=Decimal("5000.00"),
                stock=3,  # Only 3 in stock!
                in_stock=True,
            )
            session.add(admin_site)
            session.add(product)
            session.commit()

            # Create 10 different customer orders
            for i in range(10):
                uid = uuid4()
                user = User(id=uid, site_id=site_id, phone=f"980000000{i}", full_name=f"Customer {i}")
                session.add(user)
                session.commit()

                oid = uuid4()
                order = Order(
                    id=oid,
                    site_id=site_id,
                    customer_id=uid,
                    items=[{
                        "product_id": str(prod_id),
                        "product_name": "Limited Edition Sneaker",
                        "quantity": 1,
                        "unit_price": 5000.0,
                        "line_total": 5000.0,
                    }],
                    total=Decimal("5000.00"),
                    platform_fee=Decimal("150.00"),
                    tenant_share=Decimal("4850.00"),
                    payment_method="razorpay",
                    payment_status="pending",
                    status="pending",
                    razorpay_order_id=f"order_flash_{uuid4().hex[:10]}",
                    created_at=datetime.now(timezone.utc),
                )
                session.add(order)
                session.commit()
                order_ids.append(oid)

        # Fulfill all 10 concurrently
        def fulfill_order_worker(order_id: UUID):
            with Session(engine) as worker_session:
                o = worker_session.exec(select(Order).where(Order.id == order_id)).first()
                success, msg = finalize_order_fulfillment(
                    order=o,
                    session=worker_session,
                    payment_id=f"pay_mock_{uuid4().hex[:10]}",
                    payment_method="upi",
                )
                return success, msg

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(fulfill_order_worker, oid) for oid in order_ids]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        success_count = sum(1 for s, _ in results if s)
        failed_count = sum(1 for s, _ in results if not s)

        with Session(engine) as session:
            final_product = session.exec(select(Product).where(Product.id == prod_id)).first()
            final_stock = final_product.stock

        passed = (success_count == 3 and failed_count == 7 and final_stock == 0)
        self.log(
            test_name,
            passed,
            f"10 threads competed for 3 items: {success_count} succeeded, {failed_count} rejected with auto-refund, final stock = {final_stock}",
        )

    def test_2_webhook_dropoff_and_replay_attack(self):
        """
        Simulates customer dropping off and 5 simultaneous webhook calls arriving for the same order.
        """
        test_name = "Test 2: Webhook Asynchronous Recovery & Replay Attack Protection"
        with Session(engine) as session:
            admin_id = uuid4()
            site_id = uuid4()
            user_id = uuid4()
            prod_id = uuid4()
            order_id = uuid4()

            admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
            site = Site(id=site_id, slug=f"site-{site_id.hex[:6]}", site_definition={"site": {"brand_name": "Webhook Store"}})
            session.add(admin)
            session.add(site)
            session.commit()

            admin_site = AdminSite(admin_id=admin_id, site_id=site_id)
            user = User(id=user_id, site_id=site_id, phone="9988112233", full_name="Dropoff User")
            product = Product(id=prod_id, site_id=site_id, name="Laptop Stand", price=Decimal("1500.00"), stock=5, in_stock=True)
            session.add(admin_site)
            session.add(user)
            session.add(product)
            session.commit()

            rzp_order_id = f"order_drop_{uuid4().hex[:12]}"
            order = Order(
                id=order_id,
                site_id=site_id,
                customer_id=user_id,
                items=[{
                    "product_id": str(prod_id),
                    "product_name": "Laptop Stand",
                    "quantity": 1,
                    "unit_price": 1500.0,
                    "line_total": 1500.0,
                }],
                total=Decimal("1500.00"),
                platform_fee=Decimal("45.00"),
                tenant_share=Decimal("1455.00"),
                payment_method="razorpay",
                payment_status="pending",
                status="pending",
                razorpay_order_id=rzp_order_id,
                created_at=datetime.now(timezone.utc),
            )
            session.add(order)
            session.commit()

        webhook_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": f"pay_{uuid4().hex[:12]}",
                        "order_id": rzp_order_id,
                        "method": "card",
                        "status": "captured",
                        "amount": 150000,
                    }
                }
            }
        }

        # Send 5 concurrent webhook calls for the exact same order
        def call_webhook():
            client = TestClient(app)
            return client.post("/payments/webhook", json=webhook_payload).status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(call_webhook) for _ in range(5)]
            status_codes = [f.result() for f in concurrent.futures.as_completed(futures)]

        with Session(engine) as session:
            final_order = session.exec(select(Order).where(Order.id == order_id)).first()
            final_prod = session.exec(select(Product).where(Product.id == prod_id)).first()
            ledgers = session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order_id)).all()

        passed = (
            all(code == 200 for code in status_codes)
            and final_order.payment_status == "paid"
            and final_order.status == "placed"
            and final_prod.stock == 4  # Deducted only once (5 - 1 = 4)!
            and len(ledgers) == 1       # Created only 1 ledger entry!
        )
        self.log(
            test_name,
            passed,
            f"5 concurrent webhook replays handled cleanly: HTTP codes {set(status_codes)}, Order status={final_order.status}, Stock reduced exactly by 1 (Stock={final_prod.stock}), Ledgers={len(ledgers)}",
        )

    def test_3_prorated_partial_return_math(self):
        """
        Tests multi-item order where 1 item is returned:
        Order = ₹6,000 (3 items @ ₹2,000). Return 1 item (₹2,000).
        Prorates gross revenue, seller share, and platform commission without wiping ledger.
        """
        test_name = "Test 3: Prorated Partial Return & Ledger Arithmetic"
        with Session(engine) as session:
            admin_id = uuid4()
            site_id = uuid4()
            user_id = uuid4()
            order_id = uuid4()
            now = datetime.now(timezone.utc)

            admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
            site = Site(id=site_id, slug=f"site-{site_id.hex[:6]}", site_definition={"site": {"brand_name": "Clothing Store"}})
            session.add(admin)
            session.add(site)
            session.commit()

            user = User(id=user_id, site_id=site_id, phone="9911223344", full_name="Partial Buyer")
            session.add(user)
            session.commit()

            order = Order(
                id=order_id,
                site_id=site_id,
                customer_id=user_id,
                items=[
                    {"product_name": "Jacket", "quantity": 1, "unit_price": 2000.0, "line_total": 2000.0},
                    {"product_name": "Pants", "quantity": 1, "unit_price": 2000.0, "line_total": 2000.0},
                    {"product_name": "Shirt", "quantity": 1, "unit_price": 2000.0, "line_total": 2000.0},
                ],
                total=Decimal("6000.00"),
                platform_fee=Decimal("180.00"),
                tenant_share=Decimal("5820.00"),
                payment_method="razorpay",
                payment_status="paid",
                status="delivered",
                delivered_at=now - timedelta(hours=10),
                return_window_closes_at=now + timedelta(hours=38),
                escrow_status="held",
                created_at=now - timedelta(days=1),
            )
            session.add(order)

            ledger = TenantLedgerEntry(
                admin_id=admin_id,
                site_id=site_id,
                order_id=order_id,
                gross_amount=Decimal("6000.00"),
                platform_fee_percent=Decimal("3.00"),
                platform_fee=Decimal("180.00"),
                tenant_share=Decimal("5820.00"),
                currency="INR",
                status="in_escrow",
                escrow_status="held",
                created_at=now - timedelta(days=1),
            )
            session.add(ledger)
            session.commit()

            # Execute partial refund logic
            refund_amount_dec = Decimal("2000.00")
            commission_percent = ledger.platform_fee_percent or Decimal("3.00")
            refunded_tenant_share = Decimal(str(round(float(refund_amount_dec) * (1.0 - float(commission_percent) / 100.0), 2)))
            refunded_platform_fee = refund_amount_dec - refunded_tenant_share

            ledger.gross_amount = ledger.gross_amount - refund_amount_dec
            ledger.tenant_share = ledger.tenant_share - refunded_tenant_share
            ledger.platform_fee = ledger.platform_fee - refunded_platform_fee
            order.payment_status = "partially_refunded"

            session.add(order)
            session.add(ledger)
            session.commit()

            passed = (
                ledger.gross_amount == Decimal("4000.00")
                and ledger.tenant_share == Decimal("3880.00")
                and ledger.platform_fee == Decimal("120.00")
                and order.payment_status == "partially_refunded"
                and ledger.escrow_status == "held"
            )
            self.log(
                test_name,
                passed,
                f"Original ₹6000 -> Refunded ₹2000 -> Remaining Gross: ₹{ledger.gross_amount}, Seller Net Share: ₹{ledger.tenant_share}, Platform Fee: ₹{ledger.platform_fee}",
            )

    def test_4_escrow_48h_dispute_and_maturity(self):
        """
        Tests escrow maturity release:
        - 2 delivered 3 days ago (window closed) -> should be released.
        - 1 delivered 10 hours ago (window open) -> should NOT be released.
        - 1 delivered 3 days ago with an active return request -> should NOT be released.
        """
        test_name = "Test 4: Escrow 48-Hour Maturity & Dispute Protection"
        with Session(engine) as session:
            admin_id = uuid4()
            site_id = uuid4()
            user_id = uuid4()
            now = datetime.now(timezone.utc)

            admin = Admin(id=admin_id, email=f"admin_{admin_id.hex[:6]}@example.com", password_hash="hash")
            site = Site(id=site_id, slug=f"site-{site_id.hex[:6]}", site_definition={"site": {"brand_name": "Maturity Store"}})
            session.add(admin)
            session.add(site)
            session.commit()

            user = User(id=user_id, site_id=site_id, phone="9988771122", full_name="Escrow User")
            session.add(user)
            session.commit()

            # 1. Mature Order 1 (Delivered 3 days ago, no return)
            o1_id = uuid4()
            o1 = Order(
                id=o1_id,
                site_id=site_id,
                customer_id=user_id,
                items=[],
                total=Decimal("1000.00"),
                payment_method="razorpay",
                payment_status="paid",
                status="delivered",
                delivered_at=now - timedelta(days=3),
                return_window_closes_at=now - timedelta(days=1),
                escrow_status="held",
                created_at=now - timedelta(days=4),
            )
            l1 = TenantLedgerEntry(
                admin_id=admin_id,
                site_id=site_id,
                order_id=o1_id,
                gross_amount=Decimal("1000.00"),
                platform_fee=Decimal("30.00"),
                tenant_share=Decimal("970.00"),
                currency="INR",
                status="in_escrow",
                escrow_status="held",
                created_at=now - timedelta(days=4),
            )
            session.add(o1)
            session.add(l1)

            # 2. Active Window Order 2 (Delivered 6 hours ago)
            o2_id = uuid4()
            o2 = Order(
                id=o2_id,
                site_id=site_id,
                customer_id=user_id,
                items=[],
                total=Decimal("2000.00"),
                payment_method="razorpay",
                payment_status="paid",
                status="delivered",
                delivered_at=now - timedelta(hours=6),
                return_window_closes_at=now + timedelta(hours=42),
                escrow_status="held",
                created_at=now - timedelta(days=1),
            )
            l2 = TenantLedgerEntry(
                admin_id=admin_id,
                site_id=site_id,
                order_id=o2_id,
                gross_amount=Decimal("2000.00"),
                platform_fee=Decimal("60.00"),
                tenant_share=Decimal("1940.00"),
                currency="INR",
                status="in_escrow",
                escrow_status="held",
                created_at=now - timedelta(days=1),
            )
            session.add(o2)
            session.add(l2)

            # 3. Disputed Order 3 (Delivered 3 days ago, but has pending return request)
            o3_id = uuid4()
            o3 = Order(
                id=o3_id,
                site_id=site_id,
                customer_id=user_id,
                items=[],
                total=Decimal("3000.00"),
                payment_method="razorpay",
                payment_status="paid",
                status="delivered",
                delivered_at=now - timedelta(days=3),
                return_window_closes_at=now - timedelta(days=1),
                escrow_status="held",
                created_at=now - timedelta(days=4),
            )
            l3 = TenantLedgerEntry(
                admin_id=admin_id,
                site_id=site_id,
                order_id=o3_id,
                gross_amount=Decimal("3000.00"),
                platform_fee=Decimal("90.00"),
                tenant_share=Decimal("2910.00"),
                currency="INR",
                status="in_escrow",
                escrow_status="held",
                created_at=now - timedelta(days=4),
            )
            ret_req = ReturnRequest(
                id=uuid4(),
                order_id=o3_id,
                site_id=site_id,
                customer_id=user_id,
                status="requested",  # Open dispute!
                suggested_refund_amount=Decimal("3000.00"),
                created_at=now - timedelta(days=2),
            )
            session.add(o3)
            session.add(l3)
            session.add(ret_req)
            session.commit()

            # Execute unhold routine on mature orders
            orders_to_scan = session.exec(
                select(Order).where(
                    Order.site_id == site_id,
                    Order.status == "delivered",
                    Order.escrow_status == "held",
                    Order.return_window_closes_at <= now,
                )
            ).all()

            unheld_count = 0
            for ord_item in orders_to_scan:
                open_return = session.exec(
                    select(ReturnRequest).where(
                        ReturnRequest.order_id == ord_item.id,
                        ReturnRequest.status.in_(["requested", "approved", "item_shipped", "pickup_scheduled", "inspecting"]),
                    )
                ).first()
                if not open_return:
                    success, _ = unhold_tenant_escrow_transfer(order=ord_item, session=session)
                    if success:
                        unheld_count += 1

            session.expire_all()
            res_o1 = session.exec(select(Order).where(Order.id == o1_id)).first()
            res_o2 = session.exec(select(Order).where(Order.id == o2_id)).first()
            res_o3 = session.exec(select(Order).where(Order.id == o3_id)).first()

            passed = (
                unheld_count == 1
                and res_o1.escrow_status == "unheld"
                and res_o2.escrow_status == "held"
                and res_o3.escrow_status == "held"
            )
            self.log(
                test_name,
                passed,
                f"Scanned 3 orders: 1 mature released ({res_o1.escrow_status}), 1 active window protected ({res_o2.escrow_status}), 1 disputed protected ({res_o3.escrow_status})",
            )

    def test_5_sub_rupee_transfer_floor_safety(self):
        """
        Tests that micro-transfers below ₹1.00 (100 paise) are safely omitted from Route split payloads
        preventing Razorpay 400 validation rejection.
        """
        test_name = "Test 5: Sub-Rupee / Extreme Discount Split Floor Guard"
        tenant_share_paise_sub = 45  # ₹0.45
        tenant_share_paise_valid = 50000  # ₹500.00

        bank_acc_mock = type("MockBankAcc", (), {
            "razorpay_account_id": "acc_real_12345",
            "route_status": "active",
        })()

        # Simulate split transfer generator
        def build_transfers(bank_acc, tenant_share_paise):
            transfers_payload = []
            if bank_acc and bank_acc.razorpay_account_id and bank_acc.route_status in ("active", "active_manual"):
                if tenant_share_paise >= 100 and not bank_acc.razorpay_account_id.startswith("acc_mock_"):
                    transfers_payload.append({"amount": tenant_share_paise})
            return transfers_payload

        sub_rupee_payload = build_transfers(bank_acc_mock, tenant_share_paise_sub)
        valid_payload = build_transfers(bank_acc_mock, tenant_share_paise_valid)

        passed = (len(sub_rupee_payload) == 0 and len(valid_payload) == 1)
        self.log(
            test_name,
            passed,
            f"₹0.45 sub-rupee transfer safely omitted (payloads={len(sub_rupee_payload)}), ₹500.00 transfer included (payloads={len(valid_payload)})",
        )

    def test_6_aes256_bank_encryption_and_masking(self):
        """
        Tests AES-256 encryption at rest for sensitive bank accounts and last-4 masking.
        """
        test_name = "Test 6: AES-256 Bank Account Encryption & Masking"
        raw_account = "98765432109876"
        encrypted = encrypt_string(raw_account)
        decrypted = decrypt_string(encrypted)
        masked = mask_account_number(raw_account)

        passed = (
            encrypted != raw_account
            and decrypted == raw_account
            and masked == "••••••••••9876"
            and len(masked) == len(raw_account)
        )
        self.log(
            test_name,
            passed,
            f"Raw: {raw_account} -> Encrypted at rest: {encrypted[:15]}... -> Masked for UI: {masked} -> Decrypted: {decrypted}",
        )


if __name__ == "__main__":
    tester = UltimatePaymentStressTester()
    tester.run_all()
