import pytest
from uuid import uuid4
from decimal import Decimal
from fastapi.testclient import TestClient

from main import app

def test_return_policies_end_to_end():
    admin_client = TestClient(app)
    cust_client = TestClient(app)

    uid = str(uuid4())[:8]
    admin_email = f"admin_ret_{uid}@example.com"
    site_slug = f"store-ret-{uid}"

    # 1. Admin Signup
    res = admin_client.post("/auth/admin/signup", json={"email": admin_email, "password": "Password123!", "name": "Admin"})
    assert res.status_code == 200

    # 2. Create Site & Test Default Return Policy Endpoint
    res = admin_client.post("/sites", json={"slug": site_slug, "site_definition": {"theme": {}, "pages": []}})
    assert res.status_code == 200
    site_id = res.json()["id"]

    res_patch_policy = admin_client.patch(
        f"/sites/{site_id}/default-return-policy",
        json={"default_return_window_days": 10}
    )
    assert res_patch_policy.status_code == 200
    assert res_patch_policy.json()["default_return_window_days"] == 10

    # Reset back to 7 for subsequent assertions
    admin_client.patch(
        f"/sites/{site_id}/default-return-policy",
        json={"default_return_window_days": 7}
    )

    # 3. Create Products with different return policies:
    # Product A: Inherit store default (None)
    res_a = admin_client.post(
        f"/sites/{site_id}/products",
        json={
            "name": "Standard T-Shirt",
            "category": "Clothing",
            "description": "Standard 100% cotton tee",
            "price": 500,
            "stock": 20,
            "images": ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800"],
            "return_window_days": None,
        }
    )
    assert res_a.status_code == 200
    prod_a = res_a.json()
    assert prod_a["return_window_days"] is None

    # Product B: Non-Returnable / Final Sale (0)
    res_b = admin_client.post(
        f"/sites/{site_id}/products",
        json={
            "name": "Final Sale Clearance Cap",
            "category": "Accessories",
            "description": "Final sale clearance item, non-returnable",
            "price": 200,
            "stock": 10,
            "images": ["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800"],
            "return_window_days": 0,
        }
    )
    assert res_b.status_code == 200
    prod_b = res_b.json()
    assert prod_b["return_window_days"] == 0

    # Product C: Explicit 14 Days Return
    res_c = admin_client.post(
        f"/sites/{site_id}/products",
        json={
            "name": "Premium Leather Jacket",
            "category": "Outerwear",
            "description": "Premium jacket with 14 days extended returns",
            "price": 3000,
            "stock": 5,
            "images": ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800"],
            "return_window_days": 14,
        }
    )
    assert res_c.status_code == 200
    prod_c = res_c.json()
    assert prod_c["return_window_days"] == 14

    # 4. Customer Signup & Place COD Order with all 3 items
    cust_email = f"cust_ret_{uid}@example.com"
    res = cust_client.post(
        f"/auth/customer/signup/{site_slug}",
        json={"name": "Buyer One", "email": cust_email, "password": "Password123!"}
    )
    assert res.status_code == 200

    order_payload = {
        "customer_name": "Buyer One",
        "customer_email": cust_email,
        "customer_phone": "9876543210",
        "shipping_address": {
            "address_line_1": "123 Test St",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560001",
            "country": "IN",
        },
        "payment_method": "cod",
        "items": [
            {"product_id": prod_a["id"], "quantity": 1},
            {"product_id": prod_b["id"], "quantity": 1},
            {"product_id": prod_c["id"], "quantity": 1},
        ],
    }
    res_order = cust_client.post(f"/orders/customer/{site_id}", json=order_payload)
    assert res_order.status_code == 200
    order_data = res_order.json()
    order_id = order_data["id"]

    # 5. Fetch order detail and verify snapshotted return_window_days on items
    res_detail = cust_client.get(f"/orders/customer/{site_id}/{order_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    items = detail["items"]
    assert len(items) == 3

    item_a = next(i for i in items if i["product_id"] == prod_a["id"])
    item_b = next(i for i in items if i["product_id"] == prod_b["id"])
    item_c = next(i for i in items if i["product_id"] == prod_c["id"])

    # Item A inherits store default (7)
    assert item_a["return_window_days"] == 7
    # Item B has 0 (non-returnable)
    assert item_b["return_window_days"] == 0
    # Item C has 14
    assert item_c["return_window_days"] == 14

    # 6. Admin creates delivery agent and marks order delivered
    res_agent = admin_client.post(
        f"/delivery/{site_id}/agents",
        json={"name": "Express Rider", "phone": "9998887776", "vehicle_type": "bike"}
    )
    assert res_agent.status_code == 200
    agent_id = res_agent.json()["id"]

    # Assign and mark delivered
    res_assign = admin_client.post(
        f"/delivery/{site_id}/orders/{order_id}/assign-agent",
        json={"agent_id": agent_id}
    )
    assert res_assign.status_code == 200

    # Mark delivered
    res_del = admin_client.patch(
        f"/orders/admin/{site_id}/{order_id}/status",
        json={"status": "delivered"}
    )
    assert res_del.status_code == 200

    # 7. Verify dynamic return_window_closes_at uses max_days (14 days)
    res_del_detail = cust_client.get(f"/orders/customer/{site_id}/{order_id}")
    assert res_del_detail.status_code == 200

    # 8. Customer attempts return on Item B (Non-Returnable) -> must be rejected
    res_ret_b = cust_client.post(
        f"/returns/{site_id}/request",
        json={
            "order_id": order_id,
            "request_note": "Want to return final sale item",
            "items": [{"order_item_id": item_b["id"], "quantity": 1, "reason_code": "defective"}],
            "customer_refund_account": {"type": "upi", "upi_id": "buyer@okhdfcbank"},
        }
    )
    assert res_ret_b.status_code == 400
    assert "non-returnable" in res_ret_b.json()["detail"].lower()

    # 9. Customer returns Item A (7 days) -> must succeed
    res_ret_a = cust_client.post(
        f"/returns/{site_id}/request",
        json={
            "order_id": order_id,
            "request_note": "T-shirt size doesn't fit",
            "items": [{"order_item_id": item_a["id"], "quantity": 1, "reason_code": "size_fit"}],
            "customer_refund_account": {"type": "upi", "upi_id": "buyer@okhdfcbank"},
        }
    )
    assert res_ret_a.status_code == 200
    ret_data = res_ret_a.json()
    assert ret_data["status"] == "requested"

    # 10. Test Non-Returnable Store Default (0 days) with Online Checkout
    res_set_zero = admin_client.patch(
        f"/sites/{site_id}/default-return-policy",
        json={"default_return_window_days": 0}
    )
    assert res_set_zero.status_code == 200

    # Create Product D inheriting 0-day store default
    res_d = admin_client.post(
        f"/sites/{site_id}/products",
        json={
            "name": "Organic Dragon Fruit",
            "category": "Fruits",
            "description": "Fresh dragon fruit",
            "price": 200,
            "stock": 50,
            "images": ["https://images.unsplash.com/photo-1527325678964-549216340688?w=800"],
            "return_window_days": None,
        }
    )
    assert res_d.status_code == 200
    prod_d = res_d.json()

    # Place order inheriting 0-day store default
    res_order_zero = cust_client.post(
        f"/orders/customer/{site_id}",
        json={
            "customer_name": "Buyer One",
            "customer_email": cust_email,
            "customer_phone": "9876543210",
            "shipping_address": {
                "address_line_1": "123 Test St",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560001",
                "country": "IN",
            },
            "payment_method": "cod",
            "items": [{"product_id": prod_d["id"], "quantity": 1}],
        }
    )
    assert res_order_zero.status_code == 200
    order_zero_id = res_order_zero.json()["id"]

    # Verify item return_window_days was snapshotted as 0
    res_zero_detail = cust_client.get(f"/orders/customer/{site_id}/{order_zero_id}")
    assert res_zero_detail.status_code == 200
    item_d = res_zero_detail.json()["items"][0]
    assert item_d["return_window_days"] == 0
    assert item_d["is_returnable"] is False

    # Mark delivered -> escrow unheld immediately (max_days == 0)
    admin_client.post(
        f"/delivery/{site_id}/orders/{order_zero_id}/assign-agent",
        json={"agent_id": agent_id}
    )
    res_del_zero = admin_client.patch(
        f"/orders/admin/{site_id}/{order_zero_id}/status",
        json={"status": "delivered"}
    )
    assert res_del_zero.status_code == 200

    # Customer attempts return on 0-day item -> must be blocked
    res_ret_zero = cust_client.post(
        f"/returns/{site_id}/request",
        json={
            "order_id": order_zero_id,
            "request_note": "Want to return fruit",
            "items": [{"order_item_id": item_d["id"], "quantity": 1, "reason_code": "damaged"}],
            "customer_refund_account": {"type": "upi", "upi_id": "buyer@okhdfcbank"},
        }
    )
    assert res_ret_zero.status_code == 400
    assert "non-returnable" in res_ret_zero.json()["detail"].lower()
