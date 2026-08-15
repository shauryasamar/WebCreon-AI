import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from agents.color_design_agent import handle_color_and_design_request

async def test_copilot_glass():
    mock_site_def = {
        "theme": {
            "name": "Original Light",
            "mode": "light",
            "primary_bg": "#ffffff",
            "secondary_bg": "#f8fafc",
            "text_color": "#0f172a",
            "navbar_bg": "#ffffff",
            "navbar_text_color": "#0f172a",
            "card_bg": "#ffffff",
            "card_text_color": "#0f172a",
        },
        "pages": [
            {
                "page_key": "home",
                "blocks": [
                    {"id": "b1", "type": "navbar", "props": {}},
                    {"id": "b2", "type": "product_grid", "props": {}},
                    {"id": "b3", "type": "footer", "props": {}},
                ]
            }
        ]
    }

    print("--- TEST 1: Copilot 'generate glass theme for whole website' ---")
    res = await handle_color_and_design_request(
        user_message="generate glass theme for whole website",
        site_definition=mock_site_def,
    )

    assert res["design_modified"] is True, "Glass theme intent must modify design!"
    theme = res["next_draft_definition"]["theme"]
    print("Generated Glass Theme:")
    print(f" - Surface Materiality: {theme.get('surface_materiality')}")
    print(f" - Visual Style: {theme.get('visual_style')}")
    print(f" - Navbar Layout: {theme.get('navbar_layout')}")
    print(f" - Navbar BG: {theme.get('navbar_bg')}")
    print(f" - Navbar Text Color: {theme.get('navbar_text_color')}")
    print(f" - Card BG: {theme.get('card_bg')}")
    print(f" - Card Text Color: {theme.get('card_text_color')}")
    print(f" - Text Color: {theme.get('text_color')}")
    print(f" - Primary BG: {theme.get('primary_bg')[:50]}...")

    assert theme.get("surface_materiality") == "full_glass", "Must be full_glass"
    assert theme.get("navbar_text_color") == "#0f172a", "Must be high-contrast dark text on light glass"
    assert theme.get("card_text_color") == "#0f172a", "Must be high-contrast dark text on light glass cards"
    assert "rgba" in theme.get("navbar_bg"), "Navbar must be translucent rgba"
    assert "rgba" in theme.get("card_bg"), "Card must be translucent rgba"

    print("\n--- TEST 2: Copilot 'make navbar glass only' ---")
    res_nav = await handle_color_and_design_request(
        user_message="make navbar glass only",
        site_definition=mock_site_def,
    )
    theme_nav = res_nav["next_draft_definition"]["theme"]
    print(f" - Navbar-only Surface Materiality: {theme_nav.get('surface_materiality')}")
    print(f" - Navbar BG: {theme_nav.get('navbar_bg')}")
    assert theme_nav.get("surface_materiality") == "glass_navbar", "Must be glass_navbar"

    print("\n✅ All Copilot Glass Theme tests PASSED cleanly with high-contrast text!")

if __name__ == "__main__":
    asyncio.run(test_copilot_glass())
