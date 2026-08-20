import os
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from routers.payments import get_razorpay_client

def test_live_razorpay_connection():
    print("\n" + "=" * 80)
    print("🌐 TESTING DIRECT LIVE NETWORK CALL TO RAZORPAY API (api.razorpay.com)")
    print("=" * 80)

    client = get_razorpay_client()
    if not client:
        print("❌ Razorpay client could not be initialized. Check RAZORPAY_KEY_ID in .env.")
        return

    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    print(f"🔑 Using Live Test Key ID: {key_id[:10]}********")

    try:
        # Create a real test order on Razorpay's live servers
        order_payload = {
            "amount": 49900,  # ₹499.00 in paise
            "currency": "INR",
            "receipt": "rcpt_live_verification_101",
            "notes": {
                "purpose": "Live Payment Engine Verification",
                "system": "WebNirmaan AI Production Core",
            }
        }
        print("📡 Sending POST request to https://api.razorpay.com/v1/orders ...")
        real_rzp_order = client.order.create(order_payload)

        print("\n✅ RECEIVED REAL RESPONSE FROM RAZORPAY SERVERS:")
        print(f"   - Razorpay Order ID: {real_rzp_order.get('id')}")
        print(f"   - Entity: {real_rzp_order.get('entity')}")
        print(f"   - Amount: ₹{real_rzp_order.get('amount') / 100:.2f} ({real_rzp_order.get('currency')})")
        print(f"   - Status on Razorpay: {real_rzp_order.get('status')}")
        print(f"   - Created Timestamp: {real_rzp_order.get('created_at')}")
        print(f"   - Receipt: {real_rzp_order.get('receipt')}")
        print(f"   - Notes: {real_rzp_order.get('notes')}")

        # Now fetch it back from Razorpay's live server
        print(f"\n📡 Fetching Order {real_rzp_order.get('id')} from https://api.razorpay.com/v1/orders/{real_rzp_order.get('id')} ...")
        fetched_order = client.order.fetch(real_rzp_order.get('id'))
        print(f"✅ Fetched successfully! Status: {fetched_order.get('status')}, Amount Paid: ₹{fetched_order.get('amount_paid') / 100:.2f}")

        print("\n" + "=" * 80)
        print(f"🎉 100% REAL LIVE CONNECTION TO RAZORPAY CONFIRMED (Order: {real_rzp_order.get('id')})")
        print("=" * 80 + "\n")

    except Exception as e:
        print(f"❌ Error communicating with Razorpay: {e}")

if __name__ == "__main__":
    test_live_razorpay_connection()
