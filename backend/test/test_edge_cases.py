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
        "target_scope": None,
        "target_component": None,
        "design_element": None,
        "color_descriptors": [],
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
    assert result["target_component"] == "reviews"


def test_semantic_router_disambiguation():
    import asyncio
    from agents.copilot_orchestrator import router_node, CoPilotGraphState

    def run_router(msg: str):
        state: CoPilotGraphState = {
            "user_message": msg,
            "site_id": "test-site",
            "site_definition": {},
            "history_str": "",
            "intent": "",
            "target_scope": None,
            "target_component": None,
            "design_element": None,
            "color_descriptors": [],
            "days_filter": None,
            "status_filter": None,
            "target_order_id": None,
            "new_order_status": None,
            "wants_palette_suggestions": False,
            "active_agent": "",
            "agent_payload": {},
            "final_output": {},
        }
        return asyncio.run(router_node(state))

    # 1. Product Grid background styling
    res1 = run_router("change product grid background to dark slate")
    assert res1["intent"] == "DESIGN"
    assert res1["target_component"] in ["product_grid", "grid"]

    # 2. Database query with 'reviews'
    res2 = run_router("how many reviews were submitted this week?")
    assert res2["intent"] == "DB_QUERY"

    # 3. Order mutation
    res3 = run_router("mark order 81b3b794 as delivered")
    assert res3["intent"] == "MUTATION"
    assert res3["target_order_id"] == "81b3b794"
    assert res3["new_order_status"] == "delivered"


def test_tonal_harmonizer_contrast():
    from agents.color_design_agent import generate_tonal_harmony, calculate_contrast_ratio

    for color in ["#ec4899", "#0f172a", "#10b981", "#f59e0b", "#6366f1"]:
        # Light mode tonal scale
        light_palette = generate_tonal_harmony(color, is_dark=False)
        ratio_light_text = calculate_contrast_ratio(light_palette["primary_bg"], light_palette["text_color"])
        ratio_light_accent = calculate_contrast_ratio(light_palette["accent_color"], light_palette["accent_text"])
        assert ratio_light_text >= 4.5, f"Text contrast failed for {color}: {ratio_light_text}"
        assert ratio_light_accent >= 4.0, f"Accent text contrast failed for {color}: {ratio_light_accent}"

        # Dark mode tonal scale
        dark_palette = generate_tonal_harmony(color, is_dark=True)
        ratio_dark_text = calculate_contrast_ratio(dark_palette["primary_bg"], dark_palette["text_color"])
        ratio_dark_accent = calculate_contrast_ratio(dark_palette["accent_color"], dark_palette["accent_text"])
        assert ratio_dark_text >= 4.5, f"Dark text contrast failed for {color}: {ratio_dark_text}"
        assert ratio_dark_accent >= 4.0, f"Dark accent text contrast failed for {color}: {ratio_dark_accent}"


def test_product_grid_isolated_background():
    from agents.color_design_agent import apply_theme_to_blocks

    pages = [
        {
            "id": "home",
            "blocks": [
                {"type": "navbar", "props": {}},
                {"type": "product_grid", "props": {}},
                {"type": "footer", "props": {}},
            ],
        }
    ]

    # Apply product grid background patch
    apply_theme_to_blocks(
        pages,
        {"grid_bg": "#1e293b", "card_bg": "#0f172a"},
        target_type="product_grid",
    )

    grid_block = pages[0]["blocks"][1]
    navbar_block = pages[0]["blocks"][0]
    footer_block = pages[0]["blocks"][2]

    # Grid block props should have outer_bg_color and card_bg_color
    assert grid_block["props"].get("outer_bg_color") == "#1e293b"
    assert grid_block["props"].get("card_bg_color") == "#0f172a"

    # Navbar and footer must not be affected
    assert "outer_bg_color" not in navbar_block["props"]
    assert "outer_bg_color" not in footer_block["props"]


def test_grid_bg_vs_card_bg_isolation():
    import asyncio
    from agents.color_design_agent import generate_component_color_patch

    theme = {"primary_bg": "#ffffff", "card_bg": "#ffffff", "text_color": "#000000"}

    # 1. Product Grid background request
    grid_patch_res = asyncio.run(
        generate_component_color_patch(
            current_theme=theme,
            color_request="can you please change the product grid background color to pink",
            target_component="product_grid",
        )
    )
    grid_patch = grid_patch_res.get("color_patch", {})
    # Must populate grid_bg / outer_bg_color, NOT card_bg
    assert "grid_bg" in grid_patch or "outer_bg_color" in grid_patch
    assert "card_bg" not in grid_patch

    # 2. Product Card color request
    card_patch_res = asyncio.run(
        generate_component_color_patch(
            current_theme=theme,
            color_request="can you make the product card color to yellow",
            target_component="card",
        )
    )
    card_patch = card_patch_res.get("color_patch", {})
    # Must populate card_bg, NOT grid_bg
    assert "card_bg" in card_patch
    assert "grid_bg" not in card_patch
    assert "outer_bg_color" not in card_patch


def test_delivery_form_and_order_history_isolation():
    import asyncio
    from agents.color_design_agent import detect_target_component, generate_component_color_patch, apply_theme_to_blocks

    # 1. Component Detection
    assert detect_target_component("change delivery address text color it's getting camofladge") == "delivery_form"
    assert detect_target_component("change delivery form background to white") == "delivery_form"
    assert detect_target_component("change order history page color") == "order_history"
    assert detect_target_component("change product history card color") == "order_history"
    assert detect_target_component("change order card color") == "order_history"

    # 2. Patch generation isolation
    theme = {"primary_bg": "#0f172a", "card_bg": "#1e293b", "text_color": "#ffffff"}

    delivery_patch_res = asyncio.run(
        generate_component_color_patch(
            current_theme=theme,
            color_request="change the delivery address text color to black and background to white",
            target_component="delivery_form",
        )
    )
    d_patch = delivery_patch_res.get("color_patch", {})
    assert "delivery_form_bg" in d_patch or "delivery_form_text" in d_patch
    assert "card_bg" not in d_patch

    order_patch_res = asyncio.run(
        generate_component_color_patch(
            current_theme=theme,
            color_request="change order history card color to dark purple",
            target_component="order_history",
        )
    )
    o_patch = order_patch_res.get("color_patch", {})
    assert "order_history_card_bg" in o_patch or "order_history_bg" in o_patch
    assert "card_bg" not in o_patch

    # 3. Block synchronization isolation
    pages = [
        {
            "id": "checkout",
            "blocks": [
                {"type": "delivery_form", "props": {}},
                {"type": "product_grid", "props": {}},
            ],
        },
        {
            "id": "orders",
            "blocks": [
                {"type": "customer_orders", "props": {}},
            ],
        },
    ]

    apply_theme_to_blocks(
        pages,
        {"delivery_form_bg": "#ffffff", "delivery_form_text": "#000000"},
        target_type="delivery_form",
    )
    del_block = pages[0]["blocks"][0]
    grid_block = pages[0]["blocks"][1]
    assert del_block["props"].get("background_color") == "#ffffff"
    assert del_block["props"].get("text_color") == "#000000"
    assert "background_color" not in grid_block["props"]

    apply_theme_to_blocks(
        pages,
        {"order_history_card_bg": "#330066", "order_history_text": "#ffffff"},
        target_type="order_history",
    )
    order_block = pages[1]["blocks"][0]
    assert order_block["props"].get("card_bg_color") == "#330066"
    assert order_block["props"].get("text_color") == "#ffffff"
    assert "card_bg_color" not in grid_block["props"]


def test_all_17_components_isolation_matrix():
    from agents.color_design_agent import detect_target_component, COMPONENT_ALLOWED_KEYS, apply_theme_to_blocks

    # 1. Verify all 17 components are present in COMPONENT_ALLOWED_KEYS
    expected_components = {
        "navbar", "footer", "hero", "product_grid", "card", "product_detail",
        "cart", "order_summary", "delivery_form", "payment", "place_order",
        "filter", "pagination", "order_history", "checkout", "review", "background"
    }
    assert set(COMPONENT_ALLOWED_KEYS.keys()) == expected_components

    # 2. Verify component detection across realistic natural language user queries
    test_queries = {
        "make navbar emerald green": "navbar",
        "change footer background to black": "footer",
        "update hero banner slider": "hero",
        "change product grid background to pink": "product_grid",
        "make product card yellow": "card",
        "change product detail add to cart button to cyan": "product_detail",
        "make cart drawer dark navy": "cart",
        "change order summary box to white": "order_summary",
        "change delivery address text color": "delivery_form",
        "make payment options bright blue": "payment",
        "change place order button color to green": "place_order",
        "change filter toolbar background": "filter",
        "change pagination buttons color": "pagination",
        "change order history card color": "order_history",
        "change reviews card background": "review",
        "change review & pay step background": "checkout",
        "make review and pay background navy": "checkout",
        "make complete webpage dark theme": "overall",
    }

    for query, expected in test_queries.items():
        detected = detect_target_component(query)
        assert detected == expected, f"Failed for query '{query}': expected '{expected}', got '{detected}'"

    # 3. Block synchronization isolation check across all component types
    pages = [
        {
            "id": "full_store",
            "blocks": [
                {"type": "navbar", "props": {}},
                {"type": "hero", "props": {}},
                {"type": "filter_sidebar", "props": {}},
                {"type": "product_grid", "props": {}},
                {"type": "pagination", "props": {}},
                {"type": "product_detail", "props": {}},
                {"type": "cart_sidebar", "props": {}},
                {"type": "order_summary", "props": {}},
                {"type": "delivery_form", "props": {}},
                {"type": "payment_methods", "props": {}},
                {"type": "place_order_cta", "props": {}},
                {"type": "review", "props": {}},
                {"type": "customer_orders", "props": {}},
                {"type": "footer", "props": {}},
            ]
        }
    ]

    # Test updating Payment Methods only
    apply_theme_to_blocks(
        pages,
        {"payment_bg": "#10b981", "payment_text_color": "#ffffff"},
        target_type="payment"
    )
    payment_b = next(b for b in pages[0]["blocks"] if b["type"] == "payment_methods")
    navbar_b = next(b for b in pages[0]["blocks"] if b["type"] == "navbar")
    grid_b = next(b for b in pages[0]["blocks"] if b["type"] == "product_grid")

    assert payment_b["props"].get("background_color") == "#10b981"
    assert payment_b["props"].get("text_color") == "#ffffff"
    assert "background_color" not in navbar_b["props"]
    assert "background_color" not in grid_b["props"]

    # Test updating Place Order CTA only
    apply_theme_to_blocks(
        pages,
        {"place_order_btn_bg": "#8b5cf6", "place_order_btn_text": "#ffffff"},
        target_type="place_order"
    )
    place_order_b = next(b for b in pages[0]["blocks"] if b["type"] == "place_order_cta")
    assert place_order_b["props"].get("accentColor") == "#8b5cf6"
    assert place_order_b["props"].get("button_text_color") == "#ffffff"
    assert "accentColor" not in navbar_b["props"]

    # Test updating Filter only
    apply_theme_to_blocks(
        pages,
        {"filter_bg": "#0f172a", "filter_text_color": "#f8fafc"},
        target_type="filter"
    )
    filter_b = next(b for b in pages[0]["blocks"] if b["type"] == "filter_sidebar")
    assert filter_b["props"].get("background_color") == "#0f172a"
    assert filter_b["props"].get("text_color") == "#f8fafc"

    # Test updating Pagination only
    apply_theme_to_blocks(
        pages,
        {"pagination_active_bg": "#f59e0b", "pagination_text_color": "#ffffff"},
        target_type="pagination"
    )
    pag_b = next(b for b in pages[0]["blocks"] if b["type"] == "pagination")
    assert pag_b["props"].get("active_bg_color") == "#f59e0b"
    assert pag_b["props"].get("text_color") == "#ffffff"


def test_overall_theme_purges_stale_component_overrides():
    import asyncio
    from agents.color_design_agent import handle_color_and_design_request, ALL_COMPONENT_OVERRIDE_KEYS

    # Simulate a site definition that previously accumulated component-specific overrides
    site_def = {
        "theme": {
            "primary_bg": "#ffffff",
            "secondary_bg": "#f8fafc",
            "text_color": "#000000",
            "product_detail_btn_bg": "#00ffff",
            "order_history_card_bg": "#551a8b",
            "delivery_form_bg": "#ffffff",
            "cart_bg": "#000080",
            "payment_bg": "#123456",
        },
        "pages": [
            {
                "id": "home",
                "blocks": [
                    {"type": "delivery_form", "props": {"background_color": "#ffffff", "delivery_form_bg": "#ffffff"}},
                    {"type": "customer_orders", "props": {"card_bg_color": "#551a8b", "order_history_card_bg": "#551a8b"}},
                    {"type": "product_detail", "props": {"button_bg_color": "#00ffff", "product_detail_btn_bg": "#00ffff"}},
                ]
            }
        ]
    }

    # Now apply a NEW overall dark theme via Co-Pilot request
    result = asyncio.run(
        handle_color_and_design_request(
            user_message="make the entire webpage luxury dark gold theme",
            site_definition=site_def,
            target_component="overall"
        )
    )

    next_draft = result["next_draft_definition"]
    updated_theme = next_draft["theme"]
    updated_pages = next_draft["pages"]

    # Verify that stale component overrides were purged from the global theme
    for key in ["product_detail_btn_bg", "order_history_card_bg", "delivery_form_bg", "cart_bg", "payment_bg"]:
        assert key not in updated_theme, f"Stale key '{key}' was not purged from updated theme"

    # Verify that all hardcoded block overrides were purged so components cleanly inherit the new global theme
    for block in updated_pages[0]["blocks"]:
        for key in ["background_color", "card_bg_color", "button_bg_color", "delivery_form_bg", "order_history_card_bg", "product_detail_btn_bg"]:
            assert key not in block["props"], f"Stale prop '{key}' remained on block type '{block['type']}'"





