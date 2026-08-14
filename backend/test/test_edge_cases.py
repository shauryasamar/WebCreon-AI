import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

from main import app

def test_auth_and_security_edge_cases():
    client1 = TestClient(app)
    client2 = TestClient(app)

    test_id = str(uuid4())[:8]
    admin_email = f"sec_admin_{test_id}@example.com"
    site_slug = f"sec-store-{test_id}"

    # 1. Reject empty password
    res = client1.post("/auth/admin/signup", json={"email": admin_email, "password": "   ", "name": "Admin"})
    assert res.status_code == 400

    # 2. Reject invalid email
    res = client1.post("/auth/admin/signup", json={"email": "invalid-email-format", "password": "Pass12345678!", "name": "Admin"})
    assert res.status_code == 422

    # 3. Create real admin
    res = client1.post("/auth/admin/signup", json={"email": admin_email, "password": "Pass12345678!", "name": "Admin"})
    assert res.status_code == 200

    # 4. Duplicate Admin Signup
    res = client1.post("/auth/admin/signup", json={"email": admin_email, "password": "Pass12345678!", "name": "Admin"})
    assert res.status_code == 400

    # 5. Wrong Password Login
    res = client1.post("/auth/admin/login", json={"email": admin_email, "password": "WrongPassword!"})
    assert res.status_code == 401

    # 6. Save site
    res = client1.post("/sites", json={"slug": site_slug, "site_definition": {"theme": {}, "pages": []}})
    assert res.status_code == 200
    site_id = res.json()["id"]

    # 7. Customer signup with empty name
    res = client2.post(f"/auth/customer/signup/{site_slug}", json={"name": "  ", "email": f"cust_{test_id}@example.com", "password": "Pass12345678!"})
    assert res.status_code == 400

    # 8. Customer signup
    cust_email = f"cust_{test_id}@example.com"
    res = client2.post(f"/auth/customer/signup/{site_slug}", json={"name": "Customer One", "email": cust_email, "password": "Pass12345678!"})
    assert res.status_code == 200

    # 9. Customer trying to access Admin endpoints should fail (401)
    res = client2.get("/auth/admin/me")
    assert res.status_code in (401, 403)

    res = client2.get(f"/orders/admin/{site_id}")
    assert res.status_code in (401, 403)

def test_cart_and_inventory_edge_cases():
    admin_client = TestClient(app)
    customer_client = TestClient(app)

    test_id = str(uuid4())[:8]
    admin_email = f"inv_admin_{test_id}@example.com"
    site_slug = f"inv-store-{test_id}"
    cust_email = f"inv_cust_{test_id}@example.com"

    # Setup admin & site
    res = admin_client.post("/auth/admin/signup", json={"email": admin_email, "password": "Pass12345678!", "name": "Admin"})
    res = admin_client.post("/sites", json={"slug": site_slug, "site_definition": {"theme": {}, "pages": []}})
    site_id = res.json()["id"]

    # Setup customer
    res = customer_client.post(f"/auth/customer/signup/{site_slug}", json={"name": "Shopper", "email": cust_email, "password": "Pass12345678!"})

    # Create Out-of-Stock Product
    res = admin_client.post(f"/sites/{site_id}/products", json={
        "name": "Out of Stock Gadget",
        "slug": f"oos-gadget-{test_id}",
        "category": "Electronics",
        "description": "Zero stock item",
        "price": 999.00,
        "stock": 0,
        "in_stock": False,
        "images": ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500"]
    })
    assert res.status_code in (200, 201), f"Create OOS product failed: {res.text}"
    oos_product_id = res.json()["id"]

    # Adding 0 or negative quantity to cart should be rejected
    res = customer_client.post(f"/cart/{site_id}/items", json={
        "product_id": oos_product_id,
        "quantity": 0
    })
    assert res.status_code == 422 # Pydantic validation ge=1

    # Adding Out-of-Stock product to cart should fail
    res = customer_client.post(f"/cart/{site_id}/items", json={
        "product_id": oos_product_id,
        "quantity": 1
    })
    assert res.status_code in (400, 404, 409)

    # Placing order with empty cart should fail
    # First create address
    res = customer_client.post(f"/checkout/addresses/{site_id}", json={
        "full_name": "Shopper",
        "mobile_number": "9876543210",
        "address_line1": "123 Street",
        "city": "Mumbai",
        "postal_code": "400001",
        "address_type": "Home"
    })
    assert res.status_code == 200
    addr_id = res.json()["id"]

    res = customer_client.post(f"/orders/{site_id}/place", json={
        "address_id": addr_id,
        "payment_method": "cod"
    })
    assert res.status_code in (400, 422)

def test_order_status_transitions_edge_cases():
    admin_client = TestClient(app)
    customer_client = TestClient(app)

    test_id = str(uuid4())[:8]
    admin_email = f"stat_admin_{test_id}@example.com"
    site_slug = f"stat-store-{test_id}"
    cust_email = f"stat_cust_{test_id}@example.com"

    # Setup admin, site, product with stock 10
    res = admin_client.post("/auth/admin/signup", json={"email": admin_email, "password": "Pass12345678!", "name": "Admin"})
    res = admin_client.post("/sites", json={"slug": site_slug, "site_definition": {"theme": {}, "pages": []}})
    site_id = res.json()["id"]

    res = admin_client.post(f"/sites/{site_id}/products", json={
        "name": "Widget",
        "slug": f"widget-{test_id}",
        "category": "Tools",
        "description": "A very useful widget",
        "price": 100.00,
        "stock": 10,
        "in_stock": True,
        "images": ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500"]
    })
    assert res.status_code in (200, 201), f"Create widget failed: {res.text}"
    prod_id = res.json()["id"]

    # Setup customer, address, cart, place order
    res = customer_client.post(f"/auth/customer/signup/{site_slug}", json={"name": "Tester", "email": cust_email, "password": "Pass12345678!"})
    res = customer_client.post(f"/cart/{site_id}/items", json={"product_id": prod_id, "quantity": 1})
    assert res.status_code == 200

    res = customer_client.post(f"/checkout/addresses/{site_id}", json={
        "full_name": "Tester",
        "mobile_number": "9999999999",
        "address_line1": "Street 1",
        "city": "Delhi",
        "postal_code": "110001",
        "address_type": "Home"
    })
    assert res.status_code == 200
    addr_id = res.json()["id"]

    res = customer_client.post(f"/orders/{site_id}/place", json={"address_id": addr_id, "payment_method": "cod"})
    assert res.status_code in (200, 201), f"Place order failed: {res.text}"
    order_id = res.json()["order_id"]

    # Try invalid status transition: placed -> delivered directly (should fail because placed must transition to confirmed or cancelled)
    res = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={"status": "delivered"})
    assert res.status_code in (400, 422)

    # Cancel order
    res = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={"status": "cancelled"})
    assert res.status_code == 200

    # Try transition cancelled -> shipped (should fail)
    res = admin_client.patch(f"/orders/admin/{site_id}/{order_id}/status", json={"status": "shipped"})
    assert res.status_code in (400, 422)


def test_color_design_component_isolation():
    from agents.color_design_agent import detect_target_component, apply_theme_to_blocks

    # 1. Component detection accuracy
    assert detect_target_component("update the color for product detail page") == "product_detail"
    assert detect_target_component("change cart color") == "cart"
    assert detect_target_component("change product card color") == "card"
    assert detect_target_component("make website dark blue") == "overall"

    # 2. Block scoping isolation
    pages = [
        {
            "id": "home",
            "blocks": [
                {"type": "navbar", "props": {}},
                {"type": "product_grid", "props": {}},
            ],
        },
        {
            "id": "product_detail",
            "blocks": [
                {"type": "product_detail", "props": {}},
            ],
        },
        {
            "id": "cart",
            "blocks": [
                {"type": "cart_sidebar", "props": {}},
            ],
        },
    ]

    # Apply product_detail patch
    apply_theme_to_blocks(
        pages,
        {"product_detail_bg": "#123456", "product_detail_btn_bg": "#ff0055"},
        target_type="product_detail",
    )

    home_grid = next(b for b in pages[0]["blocks"] if b["type"] == "product_grid")
    detail_block = next(b for b in pages[1]["blocks"] if b["type"] == "product_detail")
    cart_block = next(b for b in pages[2]["blocks"] if b["type"] == "cart_sidebar")

    # product_detail should be updated
    assert detail_block["props"].get("background_color") == "#123456"
    assert detail_block["props"].get("button_bg_color") == "#ff0055"

    # product_grid and cart MUST NOT be affected!
    assert "background_color" not in home_grid["props"]
    assert "button_bg_color" not in home_grid["props"]
    assert "background_color" not in cart_block["props"]

    # Apply cart patch
    apply_theme_to_blocks(
        pages,
        {"cart_bg": "#002244", "cart_accent_color": "#00ffcc"},
        target_type="cart",
    )
    assert cart_block["props"].get("background_color") == "#002244"
    assert cart_block["props"].get("accent_color") == "#00ffcc"
    # product_grid still untouched
    assert "background_color" not in home_grid["props"]


def test_review_color_request_routes_to_design():
    import asyncio
    from agents.copilot_orchestrator import router_node, CoPilotGraphState

    state: CoPilotGraphState = {
        "user_message": "can you please update the review and theme component color to pink please",
        "site_id": "test-site",
        "site_definition": {},
        "history_str": "",
        "intent": "",
        "target_component": None,
        "days_filter": None,
        "status_filter": None,
        "target_order_id": None,
        "new_order_status": None,
        "wants_palette_suggestions": False,
        "active_agent": "",
        "agent_payload": {},
        "final_output": {},
    }

    result = asyncio.run(router_node(state))
    assert result["intent"] == "DESIGN"
    assert result["active_agent"] == "DESIGN Agent"

