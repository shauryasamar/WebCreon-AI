# import sys
# from pathlib import Path

# sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from main import app
from agents.planning import _build_default_site_plan
from agents.site_schema import build_site_definition


@pytest.fixture()
def client():
    return TestClient(app)


def fresh_basket_requirements():
    return {
        "site_type": "ecommerce",
        "domain": "grocery",
        "brand_name": "Fresh Basket",
        "region": "India",
        "products": [],
        "payment_preferences": ["COD", "UPI"],
        "theme": "light",
        "needs_admin_panel": True,
        "target_audience": None,
        "brand_tone": "fresh local friendly",
        "visual_style": "modern ecommerce storefront",
        "hero_focus": None,
        "catalog_type": "grocery",
        "must_have_sections": ["hero", "featuredproducts"],
        "admin_scope": ["products", "orders", "inventory"],
    }


def test_default_plan_normalizes_sections():
    plan = _build_default_site_plan(fresh_basket_requirements())
    home = next(p for p in plan["frontend_plan"]["page_plans"] if p["page_key"] == "home")
    assert "hero" in home["sections"]
    assert "featured_products" in home["sections"]
    assert "delivery_trust" in home["sections"]
    assert "featuredproducts" not in home["sections"]


def test_site_definition_maps_core_blocks():
    req = fresh_basket_requirements()
    plan = _build_default_site_plan(req)
    site_definition = build_site_definition(req, plan, plan["backend_plan"], plan["frontend_plan"])
    pages = {p["id"]: p for p in site_definition["pages"]}

    assert pages["home"]["blocks"][0]["type"] == "hero_banner"
    assert pages["product_list"]["blocks"][0]["section"] == "page_header"
    assert any(b["type"] == "filter_sidebar" for b in pages["product_list"]["blocks"]) or any(b["section"] == "filters" for b in pages["product_list"]["blocks"])
    assert any(b["type"] == "product_gallery" for b in pages["product_detail"]["blocks"])
    assert any(b["type"] == "purchase_panel" for b in pages["product_detail"]["blocks"])
    assert any(b["type"] == "admin_quick_actions" for b in pages["admin_dashboard"]["blocks"])
    assert any(b["type"] == "stats_cards" for b in pages["admin_dashboard"]["blocks"])


def test_navigation_uses_expected_routes():
    req = fresh_basket_requirements()
    plan = _build_default_site_plan(req)
    site_definition = build_site_definition(req, plan, plan["backend_plan"], plan["frontend_plan"])
    storefront = site_definition["navigation"]["storefront"]
    assert any(item["route"] == "/products" for item in storefront)
    assert any(item["route"] == "/cart" for item in storefront)

# def test_generate_site_endpoint_smoke(client):
#     response = client.post("/generate-site", json={
#     "prompt": "Build a grocery ecommerce website for Fresh Basket in India with COD and UPI and admin panel."
# })
#     print(response.status_code, response.json())
#     assert response.status_code in (200, 201)

# def test_generate_site_endpoint_smoke(client):
#     response = client.post("/generate-site", json={
#         "requirements": fresh_basket_requirements()
#     })
#     assert response.status_code in (200, 201)
#     data = response.json()
#     assert "site_definition" in data
#     assert "frontend_config" in data
#     assert "backend_config" in data

def test_generate_site_endpoint_smoke(client):
    response = client.post("/generate-site", json={
        "prompt": "Build a grocery ecommerce website for Fresh Basket in India with COD and UPI and admin panel."
    })
    assert response.status_code in (200, 201)

    data = response.json()
    assert "requirements" in data
    assert "site_plan" in data
    assert "backend_config" in data
    assert "frontend_config" in data
    assert "site_definition" in data
