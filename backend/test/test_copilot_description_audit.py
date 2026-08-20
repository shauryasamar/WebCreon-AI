import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from uuid import uuid4
from decimal import Decimal
from sqlmodel import Session

from db.database import engine
from models import Site, Product
from agents.seo_health_agent import audit_store_health
from agents.copilot_agent import process_copilot_request

async def test_description_audit():
    site_id = uuid4()
    with Session(engine) as db:
        # Create test site
        site = Site(
            id=site_id,
            slug=f"bakery-{site_id.hex[:6]}",
            site_definition={
                "site": {"brand_name": "Sweet Delights Bakery"},
                "theme": {"mode": "light", "primary_bg": "#ffffff", "text_color": "#0f172a"},
                "pages": []
            },
        )
        db.add(site)
        db.commit()

        # Product 1: Has description
        p1 = Product(
            id=uuid4(),
            site_id=site_id,
            name="Vanilla Cupcake",
            description="Fresh vanilla cupcake with buttercream frosting",
            price=Decimal("120.00"),
            stock=20
        )
        # Product 2: Missing description
        p2 = Product(
            id=uuid4(),
            site_id=site_id,
            name="Chocolate Cake",
            description="",
            price=Decimal("450.00"),
            stock=10
        )
        db.add(p1)
        db.add(p2)
        db.commit()

    print("--- TEST 1: Direct Audit Health Check ---")
    audit = audit_store_health(str(site_id), {"theme": {"primary_bg": "#ffffff", "text_color": "#0f172a"}})
    print("Audit Missing Description Count:", audit.get("missing_description_count"))
    print("Audit Missing Description Products:", audit.get("missing_description_products"))

    assert audit.get("missing_description_count") == 1, "Should find 1 product missing description"
    assert audit.get("missing_description_products")[0]["name"] == "Chocolate Cake"

    print("\n--- TEST 2: Copilot Flow for Missing Descriptions ---")
    res = await process_copilot_request(
        message="can you please check if we have any product with missing description?",
        site_id=str(site_id),
        site_definition={"site": {"brand_name": "Sweet Delights Bakery"}, "theme": {"primary_bg": "#ffffff", "text_color": "#0f172a"}, "pages": []}
    )
    reply_text = res.get("assistant_reply") or res.get("response") or res.get("message") or ""
    print("Copilot Response:")
    print(reply_text)
    assert "Chocolate Cake" in reply_text, "Response must accurately identify Chocolate Cake as missing description!"

    print("\n--- TEST 3: Copilot Query for Specific Product Description ---")
    res_cupcake = await process_copilot_request(
        message="what's the description for Vanilla Cupcake?",
        site_id=str(site_id),
        site_definition={"site": {"brand_name": "Sweet Delights Bakery"}, "theme": {"primary_bg": "#ffffff", "text_color": "#0f172a"}, "pages": []}
    )
    reply_cupcake = res_cupcake.get("assistant_reply") or res_cupcake.get("response") or ""
    print("Vanilla Cupcake Description Response:")
    print(reply_cupcake)
    assert "buttercream" in reply_cupcake.lower() or "vanilla" in reply_cupcake.lower(), "Must return real description from database!"

    print("\n✅ All Product Description Audit tests PASSED cleanly!")

if __name__ == "__main__":
    asyncio.run(test_description_audit())
