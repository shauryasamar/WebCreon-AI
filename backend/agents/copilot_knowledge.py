"""
Webcreon AI Platform Knowledge Base & Guidance System
Contains structured documentation and feature maps for guiding admin users.
"""

from typing import Dict, Any, List

WEBNIRMAAN_KNOWLEDGE_BASE: Dict[str, Any] = {
    "platform_overview": {
        "name": "WebCreon AI",
        "description": "An autonomous AI website builder & e-commerce operating platform that constructs custom, high-conversion online stores with full database integration, live editing, and admin management.",
    },
    "customization_tools": {
        "visual_builder": {
            "title": "Visual Builder Canvas",
            "description": "Live preview of your storefront. Click any element on the page to highlight and edit its text, colors, images, and layout props in real time.",
            "how_to_use": "Navigate to /builder/:slug. Toggle 'Edit Mode' in the top bar to select blocks directly on the preview canvas.",
        },
        "theme_customizer": {
            "title": "Theme & Style Controls",
            "description": "Customize global color schemes, page backgrounds, text colors, action accent colors, and component card styles.",
            "how_to_use": "Open the left sidebar 'Customize' panel or ask the AI Co-Pilot (e.g., 'Change accent color to emerald green' or 'Fix dark mode footer contrast').",
        },
        "assets_drawer": {
            "title": "Assets & Layout Presets Drawer",
            "description": "Browse pre-designed component variations for Navbars, Hero Banners, Product Grids, and Footers.",
            "presets_available": [
                "Navbar: Apple Minimal, Glassmorphism, Modern Marketplace, Luxury Fashion, Neo Modern 2026",
                "Hero Banners: Flash Sale, Product Launch, Minimal Brand Hero",
                "Product Cards: Fashion & Apparel, Electronics, Beauty & Cosmetics, Grocery, Books & Stationery",
                "Footers: Apple Minimal, Glassmorphism, Modern Marketplace, Luxury Fashion, Neo Modern 2026",
            ],
            "how_to_use": "Click the 'Assets' icon (layout blocks icon) in the left builder control bar, select a category, and click 'Apply Layout'.",
        },
        "section_manager": {
            "title": "Section & Block Manager",
            "description": "Add, remove, or reorder page sections like Hero Banners, Product Grids, Category Strips, Offer Cards, and Trust Badges.",
            "how_to_use": "In the left control sidebar, use the Section Manager list to drag and reorder sections or toggle section visibility.",
        },
    },
    "store_management": {
        "products": {
            "title": "Product Catalog Management",
            "how_to_add": "Go to Admin Panel -> Products -> click 'Add Product', or ask the AI Co-Pilot: 'Add a new product called Silk Robe for $49 with 20 stock'.",
            "fields": ["Title", "Price", "Original/Compare Price", "Category", "Stock Quantity", "Image URL", "Description"],
        },
        "orders": {
            "title": "Order Management & Fulfillment",
            "how_to_manage": "Go to Admin Panel -> Orders, or ask the AI Co-Pilot to list, accept, or cancel pending orders.",
            "item_level_control": "You can accept or reject specific items within a customer order or update delivery driver tracking details.",
        },
        "returns": {
            "title": "Returns & Refund Requests",
            "how_to_manage": "Go to Admin Panel -> Returns, or ask the AI Co-Pilot: 'Show pending return requests' to approve or reject customer returns with specific reasons.",
        },
    },
    "manual_guides": [
        {
            "question": "How do I change the website theme manually?",
            "answer": "Click the 'Customize' tab in the left builder control bar. You can select color palettes, switch between light and dark modes, or customize individual background, text, and accent colors.",
        },
        {
            "question": "How do I add a new product manually?",
            "answer": "Open the Admin Panel drawer from the left bar -> click 'Products' -> click the '+ Add Product' button. Enter the product title, price, stock, category, and image URL.",
        },
        {
            "question": "How do I publish my site live?",
            "answer": "Whenever you make changes in the builder, a green bottom bar appears showing 'Unpublished Draft Edits'. Click 'Publish Now' to save live updates to PostgreSQL.",
        },
        {
            "question": "What assets are available in WebCreon?",
            "answer": "WebCreon offers pre-built layout presets for Navbars (Apple Minimal, Glassmorphism, Marketplace, Luxury, Neo Modern), Hero Banners (Flash Sale, Product Launch), Product Cards (Fashion, Electronics, Beauty, Grocery, Books), and Footers.",
        },
    ],
}


def search_knowledge_base(query: str) -> str:
    """Retrieves relevant Webcreon platform guidance for the user's question."""
    q = query.lower().strip()

    # Search manual guides
    for guide in WEBNIRMAAN_KNOWLEDGE_BASE["manual_guides"]:
        if any(w in q for w in guide["question"].lower().split()):
            return f"**{guide['question']}**\n{guide['answer']}"

    if "theme" in q or "color" in q or "dark mode" in q:
        t = WEBNIRMAAN_KNOWLEDGE_BASE["customization_tools"]["theme_customizer"]
        return f"**{t['title']}**\n{t['description']}\n\n*How to use:* {t['how_to_use']}"

    if "asset" in q or "preset" in q or "layout" in q:
        a = WEBNIRMAAN_KNOWLEDGE_BASE["customization_tools"]["assets_drawer"]
        presets = "\n- ".join(a["presets_available"])
        return f"**{a['title']}**\n{a['description']}\n\n*Available Presets:*\n- {presets}\n\n*How to use:* {a['how_to_use']}"

    if "product" in q or "add item" in q:
        p = WEBNIRMAAN_KNOWLEDGE_BASE["store_management"]["products"]
        return f"**{p['title']}**\n{p['how_to_add']}"

    if "order" in q or "delivery" in q:
        o = WEBNIRMAAN_KNOWLEDGE_BASE["store_management"]["orders"]
        return f"**{o['title']}**\n{o['how_to_manage']}\n\n*Item-level control:* {o['item_level_control']}"

    if "return" in q or "refund" in q:
        r = WEBNIRMAAN_KNOWLEDGE_BASE["store_management"]["returns"]
        return f"**{r['title']}**\n{r['how_to_manage']}"

    # Default overview guidance
    return (
        "WebCreon AI allows you to customize every aspect of your site live:\n"
        "- **Live Visual Builder**: Edit colors, text, and block props in real time.\n"
        "- **Assets Drawer**: Apply pre-designed Navbar, Hero, Product Card, and Footer layouts.\n"
        "- **Admin Panel**: Manage products, orders, returns, and checkout settings.\n"
        "- **AI Co-Pilot**: Simply ask me in chat to tweak design, manage orders, approve returns, or analyze sales data!"
    )
