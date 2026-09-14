import os
import sys
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from services.domain_service import (
    PLATFORM_BASE_DOMAIN,
    normalize_custom_domain,
    validate_and_normalize_slug,
    DomainValidationError,
)


def test_domain_normalization_and_validation():
    # 1. Valid subdomain
    norm, dtype = normalize_custom_domain("https://Shop.Brand.com/products?ref=123")
    assert norm == "shop.brand.com"
    assert dtype == "custom_subdomain"

    # 2. Valid www subdomain
    norm_www, dtype_www = normalize_custom_domain("WWW.myStore.org")
    assert norm_www == "www.mystore.org"
    assert dtype_www == "custom_www"

    # 3. Bare apex domain rejection in V1
    with pytest.raises(DomainValidationError) as exc:
        normalize_custom_domain("brand.com")
    assert "Bare apex domains" in str(exc.value)

    # Bare ccTLD apex domain rejection in V1
    with pytest.raises(DomainValidationError) as exc:
        normalize_custom_domain("store.co.uk")
    assert "Bare apex domains" in str(exc.value)

    # 4. IP address rejection
    with pytest.raises(DomainValidationError) as exc:
        normalize_custom_domain("192.168.1.1")
    assert "IP addresses cannot be used" in str(exc.value)

    # 5. Invalid reserved TLD rejection
    with pytest.raises(DomainValidationError) as exc:
        normalize_custom_domain("store.internal")
    assert "reserved or invalid" in str(exc.value)


def test_slug_validation():
    # Valid slugs
    assert validate_and_normalize_slug("cool-store") == "cool-store"
    assert validate_and_normalize_slug("Store-123") == "store-123"

    # Reserved keywords
    with pytest.raises(DomainValidationError) as exc:
        validate_and_normalize_slug("admin")
    assert "reserved" in str(exc.value)

    with pytest.raises(DomainValidationError) as exc:
        validate_and_normalize_slug("api")
    assert "reserved" in str(exc.value)

    # Invalid formatting (consecutive hyphens)
    with pytest.raises(DomainValidationError) as exc:
        validate_and_normalize_slug("store--name")
    assert "single hyphens" in str(exc.value)

    # Too short
    with pytest.raises(DomainValidationError) as exc:
        validate_and_normalize_slug("ab")
    assert "between 3 and 63" in str(exc.value)


def test_domain_api_full_lifecycle():
    # Enable mock DNS verification for tests
    os.environ["DNS_VERIFY_MOCK"] = "true"

    client = TestClient(app)

    test_id = str(uuid4())[:8]
    admin_email = f"merchant_{test_id}@example.com"
    admin_password = "SecureAdminPass123!"
    slug = f"domtest-{test_id}"

    # 1. Admin Signup & Login
    signup_res = client.post("/auth/admin/signup", json={
        "email": admin_email,
        "password": admin_password,
        "name": "Domain Merchant",
    })
    assert signup_res.status_code == 200

    login_res = client.post("/auth/admin/login", json={
        "email": admin_email,
        "password": admin_password,
    })
    assert login_res.status_code == 200

    # 2. Create Site
    site_res = client.post("/sites", json={
        "slug": slug,
        "site_definition": {"theme": {"primaryColor": "#0066cc"}, "pages": []}
    })
    assert site_res.status_code == 200
    site = site_res.json()
    site_id = site["id"]

    # 3. Overview Endpoint
    overview_res = client.get("/api/domains/overview")
    assert overview_res.status_code == 200
    overview_data = overview_res.json()
    assert "stores" in overview_data
    store_entry = next((s for s in overview_data["stores"] if s["site_id"] == site_id), None)
    assert store_entry is not None
    assert store_entry["health_status"] == "subdomain_only"

    # 4. Get Site Domains
    site_doms_res = client.get(f"/api/sites/{site_id}/domains")
    assert site_doms_res.status_code == 200
    site_doms_data = site_doms_res.json()
    assert site_doms_data["slug"] == slug
    assert len(site_doms_data["custom_domains"]) == 0

    # 5. Add Custom Domain (shop.brand<test_id>.com)
    custom_dom = f"shop.testbrand{test_id}.com"
    add_res = client.post(f"/api/sites/{site_id}/domains", json={"domain": custom_dom})
    assert add_res.status_code == 201
    added_data = add_res.json()
    domain_id = added_data["id"]
    assert added_data["domain"] == custom_dom
    assert added_data["status"] == "dns_required"
    assert added_data["is_primary"] is False  # Invariant: not primary initially
    assert "dns_instructions" in added_data
    assert len(added_data["dns_instructions"]["records"]) == 2  # CNAME and TXT

    # 6. Verify DNS and Connect
    verify_res = client.post(f"/api/sites/{site_id}/domains/{domain_id}/verify")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["verified"] is True
    assert verify_data["domain"]["status"] == "connected"
    assert verify_data["domain"]["is_primary"] is True  # Auto-promoted as only connected domain

    # 7. Add second domain (www.testbrand<test_id>.com)
    second_dom = f"www.testbrand{test_id}.com"
    add2_res = client.post(f"/api/sites/{site_id}/domains", json={"domain": second_dom})
    assert add2_res.status_code == 201
    second_domain_id = add2_res.json()["id"]

    # Verify second domain
    verify2_res = client.post(f"/api/sites/{site_id}/domains/{second_domain_id}/verify")
    assert verify2_res.status_code == 200
    assert verify2_res.json()["verified"] is True
    # First domain is already primary, so second domain remains non-primary until explicit toggle
    assert verify2_res.json()["domain"]["is_primary"] is False

    # 8. Explicit Primary Toggle
    primary_res = client.patch(f"/api/sites/{site_id}/domains/{second_domain_id}/primary")
    assert primary_res.status_code == 200
    assert primary_res.json()["is_primary"] is True

    # Ensure first domain was demoted
    doms_check = client.get(f"/api/sites/{site_id}/domains").json()
    first_in_list = next(d for d in doms_check["custom_domains"] if d["id"] == domain_id)
    second_in_list = next(d for d in doms_check["custom_domains"] if d["id"] == second_domain_id)
    assert first_in_list["is_primary"] is False
    assert second_in_list["is_primary"] is True

    # 9. Public Edge Resolver
    # Subdomain lookup
    pub_sub_res = client.get(f"/api/public/domains/resolve?hostname={slug}.{PLATFORM_BASE_DOMAIN}")
    assert pub_sub_res.status_code == 200
    assert pub_sub_res.json()["matched"] is True
    assert pub_sub_res.json()["site_id"] == site_id

    # Custom domain lookup
    pub_cust_res = client.get(f"/api/public/domains/resolve?hostname={second_dom}")
    assert pub_cust_res.status_code == 200
    assert pub_cust_res.json()["matched"] is True
    assert pub_cust_res.json()["custom_domain"] == second_dom

    # 10. Change Webcreon Subdomain Slug
    new_slug = f"newslug-{test_id}"
    slug_res = client.post(f"/api/sites/{site_id}/change-slug", json={"new_slug": new_slug})
    assert slug_res.status_code == 200
    assert slug_res.json()["slug"] == new_slug
    assert slug_res.json()["old_slug"] == slug

    # Try taking old slug from another site (should be rejected under 90-day hold)
    other_site_res = client.post("/sites", json={
        "slug": f"othersite-{test_id}",
        "site_definition": {"pages": []}
    })
    assert other_site_res.status_code == 200
    other_site_id = other_site_res.json()["id"]

    takeover_res = client.post(f"/api/sites/{other_site_id}/change-slug", json={"new_slug": slug})
    assert takeover_res.status_code == 409  # Conflict! Anti-squatting hold active
    assert "security cooldown hold" in takeover_res.json()["detail"]

    # 11. Disconnect Domain
    del_res = client.delete(f"/api/sites/{site_id}/domains/{domain_id}")
    assert del_res.status_code == 200

    # 12. Idempotent Webhook
    webhook_payload = {
        "event_id": f"evt_{test_id}",
        "provider": "mock_edge",
        "domain": second_dom,
        "routing_status": "active",
        "ssl_status": "ssl_active",
    }
    wh1 = client.post("/api/webhooks/domain-edge", json=webhook_payload)
    assert wh1.status_code == 200
    assert wh1.json()["status"] == "processed"

    # Duplicate submission
    wh2 = client.post("/api/webhooks/domain-edge", json=webhook_payload)
    assert wh2.status_code == 200
    assert wh2.json()["status"] == "already_processed"
