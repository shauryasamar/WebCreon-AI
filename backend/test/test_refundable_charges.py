import pytest
from uuid import uuid4
from decimal import Decimal
from fastapi.testclient import TestClient

from main import app

def test_refundable_and_non_refundable_checkout_charges():
    admin_client = TestClient(app)
    cust_client = TestClient(app)

    uid = str(uuid4())[:8]
    admin_email = f"admin_charge_{uid}@example.com"
    site_slug = f"store-charges-{uid}"

    # 1. Admin Signup
    res = admin_client.post("/auth/admin/signup", json={"email": admin_email, "password": "Password123!", "name": "Admin"})
    assert res.status_code == 200

    # 2. Create Site
    res = admin_client.post("/sites", json={"slug": site_slug, "site_definition": {"theme": {}, "pages": []}})
    assert res.status_code == 200
    site_id = res.json()["id"]

    # 3. Configure Checkout Charges:
    # - Shipping fee: ₹100, non-refundable (refundable=False)
    # - Gift wrap: ₹50, refundable (refundable=True)
    # - Handling fee: ₹20, non-refundable (refundable=False)
    charges_payload = {
        "charges": [
            {
                "id": "shipping_fee",
                "code": "shipping_fee",
                "label": "Standard Shipping",
                "enabled": True,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "100",
                "applyConditionType": "none",
                "applyConditionValue": "0",
                "waiveConditionType": "none",
                "waiveConditionValue": "0",
                "description": "Standard ground shipping (Non-Refundable)",
            },
            {
                "id": "gift_wrap",
                "code": "gift_wrap",
                "label": "Gift Packaging",
                "enabled": True,
                "optional": True,
                "customerSelectable": True,
                "refundable": True,
                "amountType": "fixed",
                "amountValue": "50",
                "applyConditionType": "none",
                "applyConditionValue": "0",
                "waiveConditionType": "none",
                "waiveConditionValue": "0",
                "description": "Premium gift wrapping (Refundable)",
            },
            {
                "id": "handling_fee",
                "code": "handling_fee",
                "label": "Warehouse Handling",
                "enabled": True,
                "optional": False,
                "customerSelectable": False,
                "refundable": False,
                "amountType": "fixed",
                "amountValue": "20",
                "applyConditionType": "none",
                "applyConditionValue": "0",
                "waiveConditionType": "none",
                "waiveConditionValue": "0",
                "description": "Processing fee (Non-Refundable)",
            }
        ],
        "taxSettings": {
            "enabled": False,
            "label": "GST",
            "rate": "0",
            "applyOnShipping": False,
        }
    }

    res_settings = admin_client.put(f"/sites/{site_id}/checkout-settings", json=charges_payload)
    assert res_settings.status_code == 200
    saved_charges = res_settings.json()["charges"]
    assert any(c["code"] == "shipping_fee" and c["refundable"] is False for c in saved_charges)
    assert any(c["code"] == "gift_wrap" and c["refundable"] is True for c in saved_charges)
    assert any(c["code"] == "handling_fee" and c["refundable"] is False for c in saved_charges)

    # 4. Create 2 Products:
    # Product 1: ₹500 (Qty 10 in stock)
    # Product 2: ₹1500 (Qty 10 in stock)
    res_p1 = admin_client.post(
        f"/sites/{site_id}/products",
        json={
            "name": "Item A - Wireless Mouse",
            "category": "Electronics",
            "description": "Ergonomic mouse",
            "price": 500,
            "stock": 10,
            "images": ["https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800"],
            "return_window_days": 15,
        }
    )
    assert res_p1.status_code == 200
    p1 = res_p1.json()

    res_p2 = admin_client.post(
        f"/sites/{site_id}/products",
        json={
            "name": "Item B - Mechanical Keyboard",
            "category": "Electronics",
            "description": "RGB mechanical keyboard",
            "price": 1500,
            "stock": 10,
            "images": ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800"],
            "return_window_days": 15,
        }
    )
    assert res_p2.status_code == 200
    p2 = res_p2.json()

    # 5. Customer Signup & Place Multi-Item Order
    # Cart: 1x Item A (₹500), 1x Item B (₹1500). Subtotal = ₹2000.
    # Selected optional charge: gift_wrap (₹50)
    # Automatic charges: shipping_fee (₹100), handling_fee (₹20).
    # Total charges: ₹170. Total order: ₹2170.
    cust_email = f"cust_charge_{uid}@example.com"
    res_cust = cust_client.post(f"/auth/customer/signup/{site_slug}", json={"email": cust_email, "password": "Password123!", "name": "Customer Charge"})
    assert res_cust.status_code == 200

    # Add items to cart
    res_cart1 = cust_client.post(f"/cart/{site_id}/items", json={"product_id": p1["id"], "quantity": 1})
    assert res_cart1.status_code == 200
    res_cart2 = cust_client.post(f"/cart/{site_id}/items", json={"product_id": p2["id"], "quantity": 1})
    assert res_cart2.status_code == 200

    # Create address
    res_addr = cust_client.post(f"/checkout/addresses/{site_id}", json={
        "full_name": "Test Customer",
        "mobile_number": "9876543210",
        "address_line1": "123 Main St",
        "city": "Mumbai",
        "postal_code": "400001",
        "email": cust_email,
        "address_type": "Home",
        "is_default": True
    })
    assert res_addr.status_code == 200, f"Address creation failed: {res_addr.text}"
    address_id = res_addr.json()["id"]

    # Place order
    order_payload = {
        "address_id": address_id,
        "payment_method": "cod",
        "selected_optional_charge_ids": ["gift_wrap"],
    }

    res_order = cust_client.post(f"/orders/{site_id}/place", json=order_payload)
    assert res_order.status_code in (200, 201)
    order_data = res_order.json()
    order_id = order_data["order_id"]
    assert order_data["total"] == 2170.0

    # Get admin order details to inspect pricing snapshot
    res_admin_orders = admin_client.get(f"/orders/admin/{site_id}")
    assert res_admin_orders.status_code == 200
    orders_list = res_admin_orders.json()
    found_order = next((o for o in orders_list if str(o["id"]) == str(order_id)), None)
    assert found_order is not None

    # Verify Pricing Snapshot on Order Items:
    # Total Subtotal = 2000.
    # Item A weight = 500 / 2000 = 25%.
    # Item B weight = 1500 / 2000 = 75%.
    # Refundable charges total = 50 (gift wrap).
    # Non-refundable charges total = 120 (100 shipping + 20 handling).
    # Item A:
    # - refundable_charges_allocated = 25% of 50 = 12.50
    # - non_refundable_charges_allocated = 25% of 120 = 30.00
    # - refundable_line_total = 500 + 12.50 = 512.50
    # - final_paid_for_line = 500 + 12.50 + 30.00 = 542.50
    item_a = next(i for i in found_order["items"] if i["product_id"] == p1["id"])
    snap_a = item_a["pricing_snapshot"]
    assert snap_a is not None
    assert snap_a["refundable_charges_allocated"] == 12.5
    assert snap_a["non_refundable_charges_allocated"] == 30.0
    assert snap_a["refundable_line_total"] == 512.5
    assert snap_a["final_paid_for_line"] == 542.5

    # 6. Admin Delivers the Order
    admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={"status": "confirmed"})
    admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={
        "status": "shipped",
        "delivery_partner_name": "Express Rider",
        "delivery_partner_phone": "9876543210"
    })
    admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={
        "status": "out_for_delivery",
        "delivery_partner_name": "Express Rider"
    })
    res_del = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={
        "status": "delivered",
        "delivery_partner_name": "Express Rider"
    })
    assert res_del.status_code == 200

    # 7. Customer Requests Return for ONLY Item A (1 unit)
    return_payload = {
        "order_id": order_id,
        "request_note": "Defective mouse wheel",
        "customer_refund_account": {
            "type": "upi",
            "upi_id": "customer@okhdfcbank",
        },
        "items": [
            {
                "order_item_id": item_a["id"],
                "quantity": 1,
                "reason_code": "defective",
                "reason_note": "Wheel not clicking",
            }
        ],
    }
    res_ret = cust_client.post(f"/returns/{site_id}/request", json=return_payload)
    assert res_ret.status_code == 200, f"Return creation failed: {res_ret.text}"
    ret_data = res_ret.json()["return_request"]
    return_id = ret_data["id"]
    # Suggested refund should be strictly refundable_line_total = 512.50
    assert ret_data["suggested_refund_amount"] == 512.50

    # 8. Check Admin Return Request Detail & Refund Breakdown
    res_detail = admin_client.get(f"/returns/admin/{site_id}/{return_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    breakdown = detail.get("refund_breakdown")
    assert breakdown is not None
    assert breakdown["items_subtotal"] == 500.0
    assert breakdown["refundable_charges_added"] == 12.50
    assert breakdown["non_refundable_charges_retained"] == 30.00
    assert breakdown["suggested_refund_amount"] == 512.50
    assert breakdown["max_refundable_amount"] == 542.50
    assert len(breakdown["charge_allocations"]) == 3

    # 9. Admin Processes Return Lifecycle (Approve -> Assign Courier -> Receive -> Inspect)
    return_item_id = detail["items"][0]["id"]
    res_app = admin_client.patch(f"/returns/admin/{site_id}/{return_id}/review", json={
        "action": "approve",
        "items": [{"return_item_id": return_item_id, "quantity_approved": 1}],
        "admin_note": "Approved for return pickup",
    })
    assert res_app.status_code == 200

    # Dispatch Pickup
    res_disp = admin_client.post(f"/returns/admin/{site_id}/{return_id}/dispatch-pickup", json={
        "mode": "manual",
        "courier_name": "In-house Rider",
        "pickup_notes": "Pickup scheduled from customer address",
    })
    assert res_disp.status_code == 200

    # Receive
    res_rec = admin_client.patch(f"/returns/admin/{site_id}/{return_id}/receive", json={
        "items": [{"return_item_id": return_item_id, "quantity_received": 1}],
        "admin_note": "Received at warehouse",
    })
    assert res_rec.status_code == 200

    # Inspect
    res_ins = admin_client.patch(f"/returns/admin/{site_id}/{return_id}/inspect", json={
        "items": [{"return_item_id": return_item_id, "restock_decision": "discard", "restock_quantity": 0}],
        "admin_note": "Verified defective hardware",
    })
    assert res_ins.status_code == 200

    # 10. Admin Refund:
    # a. Test Over-Refund Rejection (trying to refund ₹600 when max allowed is ₹542.50)
    res_over = admin_client.patch(f"/returns/admin/{site_id}/{return_id}/refund", json={
        "refund_method": "cod_refund",
        "final_refund_amount": 600.00,
        "refund_override_reason": "Trying to refund too much",
    })
    assert res_over.status_code == 400
    assert "cannot exceed maximum allowed amount" in res_over.json()["detail"]

    # b. Test Exception Full Refund (waiving non-refundable charges because item was defective: ₹542.50)
    res_ref = admin_client.patch(f"/returns/admin/{site_id}/{return_id}/refund", json={
        "refund_method": "cod_refund",
        "final_refund_amount": 542.50,
        "refund_override_reason": "Defective item exception: Refunded shipping and handling fees",
        "admin_note": "Paid via UPI UTR 998877665544",
    })
    assert res_ref.status_code == 200
    refunded_ret = res_ref.json()["return_request"]
    assert refunded_ret["status"] == "refunded"
    assert refunded_ret["final_refund_amount"] == 542.50
    assert refunded_ret["refund_override_reason"] == "Defective item exception: Refunded shipping and handling fees"
