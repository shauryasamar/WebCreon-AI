import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app

def test_full_ecommerce_backend_lifecycle():
    admin_client = TestClient(app)
    customer_client = TestClient(app)

    test_id = str(uuid4())[:8]
    admin_email = f"admin_{test_id}@example.com"
    customer_email = f"customer_{test_id}@example.com"
    site_slug = f"test-store-{test_id}"
    admin_password = "SecureAdminPass123!"
    customer_password = "CustomerPass123!"

    # 1. Admin Signup
    res = admin_client.post("/auth/admin/signup", json={
        "email": admin_email,
        "password": admin_password,
        "name": "Test Merchant"
    })
    assert res.status_code == 200, f"Admin signup failed: {res.text}"
    admin_data = res.json()["admin"]
    admin_id = admin_data["id"]

    # 2. Admin Login
    res = admin_client.post("/auth/admin/login", json={
        "email": admin_email,
        "password": admin_password
    })
    assert res.status_code == 200

    # 3. Admin Me
    res = admin_client.get("/auth/admin/me")
    assert res.status_code == 200
    assert res.json()["admin"]["email"] == admin_email

    # 4. Create Site (Admin)
    site_def = {
        "theme": {"primaryColor": "#ff6b00"},
        "pages": [{"id": "home", "blocks": []}]
    }
    res = admin_client.post("/sites", json={
        "slug": site_slug,
        "site_definition": site_def
    })
    assert res.status_code == 200, f"Site creation failed: {res.text}"
    saved_site = res.json()
    site_id = saved_site["id"]

    # 5. Customer Signup on Site
    res = customer_client.post(f"/auth/customer/signup/{site_slug}", json={
        "name": "John Doe",
        "email": customer_email,
        "password": customer_password
    })
    assert res.status_code == 200, f"Customer signup failed: {res.text}"
    cust_data = res.json()["user"]
    customer_id = cust_data["id"]

    # 6. Customer Login
    res = customer_client.post(f"/auth/customer/login/{site_slug}", json={
        "email": customer_email,
        "password": customer_password
    })
    assert res.status_code == 200

    # 7. Customer Me
    res = customer_client.get(f"/auth/customer/me/{site_slug}")
    assert res.status_code == 200
    assert res.json()["user"]["email"] == customer_email

    # 8. Create Category & Collection (Admin)
    res = admin_client.post(f"/sites/{site_id}/categories", json={
        "name": f"Apparel {test_id}",
        "description": "Clothing items"
    })
    assert res.status_code == 200
    category_id = res.json()["id"]

    res = admin_client.post(f"/sites/{site_id}/collections", json={
        "name": f"Summer Essentials {test_id}",
        "description": "Hot summer deals"
    })
    assert res.status_code == 200
    collection_id = res.json()["id"]

    # 9. Create Product (Admin)
    product_payload = {
        "name": "Premium Cotton T-Shirt",
        "slug": f"cotton-tshirt-{test_id}",
        "category": "Clothing",
        "category_id": category_id,
        "collection_ids": [collection_id],
        "description": "100% organic cotton breathable t-shirt",
        "price": 499.00,
        "compare_price": 799.00,
        "stock": 50,
        "in_stock": True,
        "images": ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500"],
        "variant_option": {
            "optionType": "size",
            "optionName": "Size",
            "optionValues": [
                {"value": "M", "price": 499.0, "comparePrice": 799.0, "stockQty": 20, "inStock": True},
                {"value": "L", "price": 549.0, "comparePrice": 849.0, "stockQty": 30, "inStock": True}
            ]
        }
    }
    res = admin_client.post(f"/sites/{site_id}/products", json=product_payload)
    assert res.status_code in (200, 201), f"Product creation failed: {res.text}"
    product_data = res.json()
    product_id = product_data["id"]

    # 10. List & Filter Products (Public Storefront)
    res = customer_client.get(f"/sites/{site_id}/products/public?search=cotton&min_price=100&max_price=1000")
    assert res.status_code == 200
    res_json = res.json()
    products_list = res_json.get("items", res_json) if isinstance(res_json, dict) else res_json
    assert len(products_list) >= 1

    # 11. Add to Cart (Customer)
    res = customer_client.post(f"/cart/{site_id}/items", json={
        "product_id": product_id,
        "quantity": 2,
        "selected_variant_value": "M"
    })
    assert res.status_code == 200, f"Add to cart failed: {res.text}"
    cart_data = res.json()
    assert len(cart_data["items"]) == 1
    cart_item_id = cart_data["items"][0]["id"]
    assert cart_data["items"][0]["quantity"] == 2

    # 12. Update Cart Item Quantity (PUT)
    res = customer_client.put(f"/cart/{site_id}/items/{cart_item_id}", json={
        "quantity": 3
    })
    assert res.status_code == 200
    assert res.json()["items"][0]["quantity"] == 3

    # 13. Customer Adds Delivery Address
    address_payload = {
        "full_name": "John Doe",
        "mobile_number": "9876543210",
        "address_line1": "123 Green Avenue, Sector 4",
        "city": "Bengaluru",
        "postal_code": "560001",
        "email": customer_email,
        "address_type": "Home",
        "is_default": True
    }
    res = customer_client.post(f"/checkout/addresses/{site_id}", json=address_payload)
    assert res.status_code == 200, f"Address creation failed: {res.text}"
    address_id = res.json()["id"]

    # 14. Place Order from Cart
    order_payload = {
        "address_id": address_id,
        "payment_method": "cod"
    }
    res = customer_client.post(f"/orders/{site_id}/place", json=order_payload)
    assert res.status_code in (200, 201), f"Place order failed: {res.text}"
    order_data = res.json()
    order_id = order_data["order_id"]
    assert order_data["status"] == "placed"

    # Verify Cart is now empty
    res = customer_client.get(f"/cart/{site_id}")
    assert res.status_code == 200
    assert len(res.json()["items"]) == 0

    # 15. Admin View Orders & Update Status
    res = admin_client.get(f"/orders/admin/{site_id}")
    assert res.status_code == 200
    orders_list = res.json()
    found_order = next((o for o in orders_list if str(o["id"]) == str(order_id)), None)
    assert found_order is not None
    order_item_id = found_order["items"][0]["id"]

    # Status transition: placed -> confirmed
    res = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={
        "status": "confirmed"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"

    # Status transition: confirmed -> shipped
    res = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={
        "status": "shipped"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "shipped"

    # Status transition: shipped -> out_for_delivery
    res = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={
        "status": "out_for_delivery"
    })
    assert res.status_code == 200

    # Status transition: out_for_delivery -> delivered
    res = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={
        "status": "delivered"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "delivered"

    # 16. Customer Product Review on Delivered Order
    res = customer_client.post(f"/sites/{site_id}/products/reviews", json={
        "product_id": product_id,
        "order_item_id": order_item_id,
        "rating": 5,
        "review_text": "Superb fabric quality! Fits nicely."
    })
    assert res.status_code in (200, 201), f"Review submission failed: {res.text}"

    # 17. Customer Submits Return Request
    res = customer_client.post(f"/returns/{site_id}/request", json={
        "order_id": order_id,
        "request_note": "Slightly tight around shoulders",
        "items": [
            {
                "order_item_id": order_item_id,
                "quantity": 1,
                "reason_code": "size_issue",
                "reason_note": "Size M is smaller than standard"
            }
        ]
    })
    assert res.status_code in (200, 201), f"Return request failed: {res.text}"
    return_req = res.json()
    return_id = return_req["return_request"]["id"]
    return_item_id = return_req["return_request"]["items"][0]["id"]
    assert return_req["return_request"]["status"] == "requested"

    # 18. Admin Reviews Return Request (Approve via PATCH)
    res = admin_client.patch(f"/returns/admin/{site_id}/{return_id}/review", json={
        "action": "approve",
        "admin_note": "Approved for pickup",
        "items": [
            {
                "return_item_id": return_item_id,
                "quantity_approved": 1
            }
        ]
    })
    assert res.status_code == 200, f"Return review failed: {res.text}"
    assert res.json()["return_request"]["status"] == "approved"

    # 19. Checkout Settings (Public & Admin)
    res = customer_client.get(f"/store/{site_slug}/checkout-settings")
    assert res.status_code == 200

    res = admin_client.get(f"/sites/{site_id}/checkout-settings")
    assert res.status_code == 200
