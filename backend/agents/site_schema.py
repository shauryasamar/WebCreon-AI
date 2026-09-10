from typing import Any, Dict, List


PAGE_META = {
    "home": {
        "name": "Home",
        "role": "home",
        "flow": "storefront",
        "show_in_nav": True,
        "default_route": "/",
    },
    "product_list": {
        "name": "Shop",
        "role": "shop",
        "flow": "storefront",
        "show_in_nav": True,
        "default_route": "/products",
    },
    "product_detail": {
        "name": "Product Detail",
        "role": "product_detail",
        "flow": "storefront",
        "show_in_nav": False,
        "default_route": "/products/:slug",
    },
    "cart": {
        "name": "Cart",
        "role": "cart",
        "flow": "storefront",
        "show_in_nav": True,
        "default_route": "/cart",
    },
    "checkout": {
        "name": "Checkout",
        "role": "checkout",
        "flow": "storefront",
        "show_in_nav": False,
        "default_route": "/checkout",
    },
    "order_confirmation": {
        "name": "Order Confirmation",
        "role": "order_confirmation",
        "flow": "storefront",
        "show_in_nav": False,
        "default_route": "/order-confirmation",
    },
    "admin_dashboard": {
        "name": "Admin Dashboard",
        "role": "admin_dashboard",
        "flow": "admin",
        "show_in_nav": True,
        "default_route": "/admin",
    },
    "admin_products": {
        "name": "Admin Products",
        "role": "admin_products",
        "flow": "admin",
        "show_in_nav": True,
        "default_route": "/admin/products",
    },
    "admin_orders": {
        "name": "Admin Orders",
        "role": "admin_orders",
        "flow": "admin",
        "show_in_nav": True,
        "default_route": "/admin/orders",
    },
    "admin_inventory": {
        "name": "Admin Inventory",
        "role": "admin_inventory",
        "flow": "admin",
        "show_in_nav": True,
        "default_route": "/admin/inventory",
    },
}


SECTION_ALIASES = {
    "featuredproducts": "featured_products",
    "featured_products": "featured_products",
    "featuredbooks": "featured_books",
    "featured_books": "featured_books",
    "topcategories": "top_categories",
    "top_categories": "top_categories",
    "categorystrip": "category_strip",
    "category_strip": "category_strip",
    "featuredcollections": "featured_collections",
    "featured_collections": "featured_collections",
    "giftbanner": "gift_banner",
    "gift_banner": "gift_banner",
    "deliverytrust": "delivery_trust",
    "delivery_trust": "delivery_trust",
    "trustbadges": "trust_badges",
    "trust_badges": "trust_badges",
    "spechighlights": "spec_highlights",
    "spec_highlights": "spec_highlights",
    "editorialpick": "editorial_pick",
    "editorial_pick": "editorial_pick",
    "pageheader": "page_header",
    "page_header": "page_header",
    "filtersidebar": "filters",
    "filter_sidebar": "filters",
    "filters": "filters",
    "sortbar": "sort_bar",
    "sort_bar": "sort_bar",
    "resultsgrid": "results_grid",
    "results_grid": "results_grid",
    "productgrid": "results_grid",
    "product_grid": "results_grid",
    "gallery": "product_gallery",
    "productgallery": "product_gallery",
    "product_gallery": "product_gallery",
    "productinfo": "product_info",
    "product_info": "product_info",
    "cta": "purchase_cta",
    "purchasecta": "purchase_cta",
    "purchase_cta": "purchase_cta",
    "relateditems": "related_products",
    "related_items": "related_products",
    "relatedproducts": "related_products",
    "related_products": "related_products",
    "cartitems": "cart_items",
    "cart_items": "cart_items",
    "summary": "cart_summary",
    "cartsummary": "cart_summary",
    "cart_summary": "cart_summary",
    "promocode": "promo_code",
    "promo_code": "promo_code",
    "checkoutcta": "checkout_cta",
    "checkout_cta": "checkout_cta",
    "delivery": "delivery_form",
    "deliveryform": "delivery_form",
    "delivery_form": "delivery_form",
    "payment": "payment_methods",
    "paymentmethods": "payment_methods",
    "payment_methods": "payment_methods",
    "ordersummary": "order_summary",
    "order_summary": "order_summary",
    "placeordercta": "place_order_cta",
    "place_order_cta": "place_order_cta",
    "confirmationmessage": "confirmation_message",
    "confirmation_message": "confirmation_message",
    "nextactions": "next_steps",
    "next_actions": "next_steps",
    "nextsteps": "next_steps",
    "next_steps": "next_steps",
    "continueshoppingcta": "continue_shopping_cta",
    "continue_shopping_cta": "continue_shopping_cta",
    "overviewstats": "metrics_overview",
    "metricsoverview": "metrics_overview",
    "metrics_overview": "metrics_overview",
    "recentorders": "recent_orders",
    "recent_orders": "recent_orders",
    "inventoryalerts": "inventory_alerts",
    "inventory_alerts": "inventory_alerts",
    "quicklinks": "quick_actions",
    "quickactions": "quick_actions",
    "quick_actions": "quick_actions",
    "producttable": "product_table",
    "product_table": "product_table",
    "productlist": "product_table",
    "product_list": "product_table",
    "addeditproduct": "edit_drawer",
    "editdrawer": "edit_drawer",
    "edit_drawer": "edit_drawer",
    "ordertable": "order_table",
    "order_table": "order_table",
    "orderlist": "order_table",
    "order_list": "order_table",
    "statusupdate": "status_filters",
    "statusfilters": "status_filters",
    "status_filters": "status_filters",
    "orderdetails": "order_detail_panel",
    "orderdetailpanel": "order_detail_panel",
    "order_detail_panel": "order_detail_panel",
}


SECTION_TO_BLOCK_TYPE = {
    "hero": "hero_banner",
    "categories": "category_grid",
    "top_categories": "category_grid",
    "category_strip": "category_strip",
    "collections": "collection_grid",
    "featured_collections": "collection_grid",
    "featured_products": "product_grid",
    "featured_books": "product_grid",
    "bestsellers": "product_grid",
    "recommendations": "recommendation_carousel",
    "editorial_pick": "editorial_highlight",
    "offers": "offer_cards",
    "gift_banner": "promo_banner",
    "delivery_trust": "trust_badges",
    "trust_badges": "trust_badges",
    "spec_highlights": "feature_highlights",
    "page_header": "page_header",
    "filters": "filter_sidebar",
    "sort_bar": "sort_toolbar",
    "results_grid": "product_grid",
    "pagination": "pagination",
    "breadcrumbs": "breadcrumbs",
    "product_gallery": "product_gallery",
    "product_info": "product_info",
    "purchase_cta": "purchase_panel",
    "related_products": "related_products",
    "cart_items": "cart_items",
    "cart_summary": "order_summary",
    "promo_code": "promo_code_input",
    "checkout_cta": "checkout_cta",
    "delivery_form": "delivery_form",
    "payment_methods": "payment_methods",
    "order_summary": "order_summary",
    "place_order_cta": "place_order_cta",
    "confirmation_message": "confirmation_banner",
    "next_steps": "next_steps",
    "continue_shopping_cta": "continue_shopping_cta",
    "metrics_overview": "stats_cards",
    "recent_orders": "admin_orders_table",
    "inventory_alerts": "inventory_alerts",
    "quick_actions": "admin_quick_actions",
    "toolbar": "admin_toolbar",
    "product_table": "admin_products_table",
    "edit_drawer": "edit_drawer",
    "order_table": "admin_orders_table",
    "status_filters": "status_filters",
    "order_detail_panel": "order_detail_panel",
}


def _normalize_section_key(section_key: str) -> str:
    key = (section_key or "").strip().lower().replace(" ", "_")
    compact = key.replace("_", "")
    return SECTION_ALIASES.get(key) or SECTION_ALIASES.get(compact) or key


def _safe_brand_name(requirements: Dict[str, Any]) -> str:
    return requirements.get("brand_name") or "Your Brand"


def _default_theme_config(requirements: Dict[str, Any], frontend_config: Dict[str, Any]) -> Dict[str, Any]:
    theme_name = frontend_config.get("theme") or requirements.get("theme") or "light"
    brand_tone = requirements.get("brand_tone") or "modern approachable"
    visual_style = requirements.get("visual_style") or frontend_config.get("design_direction") or "modern ecommerce storefront"
    raw_palette = requirements.get("chosen_palette")
    palette = raw_palette if isinstance(raw_palette, dict) else {}

    is_dark = theme_name == "dark" or palette.get("primary_bg") in {"#0f172a", "#1e293b", "#000000", "#111827"}
    is_glass = (
        requirements.get("surface_materiality") in ["glass_navbar", "full_glass", "glassmorphic"] or
        palette.get("visual_style") == "glassmorphic" or
        "glass" in (palette.get("name") or "").lower()
    )

    glass_primary_bg = (
        "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.18) 0%, transparent 45%), radial-gradient(circle at 90% 60%, rgba(139, 92, 246, 0.18) 0%, transparent 50%), radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.12) 0%, transparent 45%), #090d16"
        if is_dark
        else "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.14) 0%, transparent 45%), radial-gradient(circle at 90% 60%, rgba(139, 92, 246, 0.12) 0%, transparent 50%), radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.08) 0%, transparent 45%), #f8fafc"
    )

    return {
        "name": palette.get("name") or theme_name,
        "mode": "dark" if is_dark else "light",
        "brand_tone": brand_tone,
        "visual_style": "glassmorphic" if is_glass else visual_style,
        "design_direction": frontend_config.get("design_direction") or visual_style,
        
        # Color Token Palette
        "primary_bg": palette.get("primary_bg") if (palette.get("primary_bg") and "gradient" in str(palette.get("primary_bg"))) else (glass_primary_bg if is_glass else (palette.get("primary_bg") or ("#0f172a" if is_dark else "#ffffff"))),
        "secondary_bg": palette.get("secondary_bg") or ("rgba(15,23,42,0.65)" if (is_dark and is_glass) else ("rgba(255,255,255,0.65)" if is_glass else ("#1e293b" if is_dark else "#f8fafc"))),
        "text_color": palette.get("text_color") or ("#f8fafc" if is_dark else "#0f172a"),
        "muted_text": palette.get("muted_text") or ("#94a3b8" if is_dark else "#64748b"),
        "accent_color": palette.get("accent_color") or ("#6366f1" if is_dark else "#2563eb"),
        "accent_hover": palette.get("accent_hover") or ("#4f46e5" if is_dark else "#1d4ed8"),
        "accent_text": palette.get("accent_text") or "#ffffff",
        "border_color": palette.get("border_color") or ("rgba(255,255,255,0.14)" if is_dark else ("rgba(255,255,255,0.55)" if is_glass else "#e2e8f0")),
        "soft_border": palette.get("soft_border") or ("rgba(255,255,255,0.08)" if is_dark else ("rgba(255,255,255,0.30)" if is_glass else "#f1f5f9")),
        
        # Surface Materiality & Glass Tokens
        "surface_materiality": "full_glass" if is_glass else (requirements.get("surface_materiality") or "solid"),
        
        # Navbar Config
        "navbar_layout": "glassmorphism_premium" if is_glass else (requirements.get("navbar_layout") or "apple_minimal"),
        "navbar_variant": "floating" if is_glass else (requirements.get("navbar_variant") or "soft"),
        "navbar_position": requirements.get("navbar_position") or "fixed",
        "navbar_bg": palette.get("navbar_bg") or ("rgba(15,23,42,0.72)" if is_dark else "rgba(255,255,255,0.72)"),
        "navbar_text_color": palette.get("navbar_text_color") or ("#f8fafc" if is_dark else "#0f172a"),
        "navbar_border_color": palette.get("navbar_border_color") or ("rgba(255,255,255,0.14)" if is_dark else "rgba(255,255,255,0.45)"),
        
        # Footer Config
        "footer_layout": "glassmorphism_premium" if is_glass else (requirements.get("footer_layout") or "apple_minimal"),
        "footer_bg": palette.get("footer_bg") or ("#090d16" if is_dark else "#f8fafc"),
        "footer_text_color": palette.get("footer_text_color") or ("#f8fafc" if is_dark else "#0f172a"),
        "footer_muted_color": palette.get("footer_muted_color") or ("#94a3b8" if is_dark else "#64748b"),
        
        # Hero Config
        "hero_bg": palette.get("hero_bg") or (glass_primary_bg if is_glass else ("linear-gradient(135deg, #0f172a, #1e293b)" if is_dark else "linear-gradient(135deg, #f8fafc, #e2e8f0)")),
        "hero_text_color": palette.get("hero_text_color") or ("#ffffff" if is_dark else "#0f172a"),
        "hero_accent": palette.get("hero_accent") or ("#6366f1" if is_dark else "#2563eb"),
        
        # Product Card Config
        "card_style": requirements.get("card_style") or "fashion",
        "card_bg": palette.get("card_bg") or ("rgba(15,23,42,0.70)" if (is_dark and is_glass) else ("rgba(255,255,255,0.70)" if is_glass else ("#1e293b" if is_dark else "#ffffff"))),
        "card_shadow": palette.get("card_shadow") or ("0 8px 32px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.16)" if is_dark else ("0 8px 32px rgba(31,38,135,0.08), inset 0 1px 1px rgba(255,255,255,0.75)" if is_glass else "0 4px 16px rgba(15,23,42,0.06)")),
    }


def _resource_name(model_name: str) -> str:
    return model_name.lower()


def _table_name(model_name: str) -> str:
    return f"{model_name.lower()}s"


def _infer_data_source(block_type: str, section_key: str) -> str | None:
    mapping = {
        "product_grid": "products",
        "product_gallery": "product",
        "product_info": "product",
        "related_products": "related_products",
        "category_grid": "categories",
        "category_strip": "categories",
        "collection_grid": "collections",
        "offer_cards": "offers",
        "recommendation_carousel": "recommendations",
        "cart_items": "cart",
        "order_summary": "cart_summary",
        "payment_methods": "payment_options",
        "admin_products_table": "products",
        "admin_orders_table": "orders",
        "inventory_alerts": "inventory_alerts",
        "stats_cards": "dashboard_metrics",
    }
    return mapping.get(block_type) or mapping.get(section_key)


def _infer_actions(block_type: str, page_id: str) -> Dict[str, Any]:
    actions: Dict[str, Any] = {}

    if block_type in {"product_grid", "related_products", "recommendation_carousel"}:
        actions["item_click"] = {"type": "navigate", "target": "/products/:slug"}

    if block_type == "purchase_panel":
        actions["primary"] = {"type": "add_to_cart"}

    if block_type == "checkout_cta":
        actions["primary"] = {"type": "navigate", "target": "/checkout"}

    if block_type == "continue_shopping_cta":
        actions["primary"] = {"type": "navigate", "target": "/products"}

    if block_type == "place_order_cta":
        actions["primary"] = {"type": "submit_order"}

    if page_id.startswith("admin_") and block_type in {"admin_products_table", "admin_orders_table"}:
        actions["row_click"] = {"type": "open_detail_panel"}

    return actions


def _build_block_props(
    section_key: str,
    block_type: str,
    requirements: Dict[str, Any],
    page_plan: Dict[str, Any],
    frontend_config: Dict[str, Any],
) -> Dict[str, Any]:
    brand_name = _safe_brand_name(requirements)
    domain = requirements.get("domain") or "general"
    theme = frontend_config.get("theme") or requirements.get("theme") or "light"
    raw_palette = requirements.get("chosen_palette")
    palette = raw_palette if isinstance(raw_palette, dict) else {}

    props: Dict[str, Any] = {
        "section_key": section_key,
        "theme": theme,
        "domain": domain,
        "brand_name": brand_name,
        "title": section_key.replace("_", " ").title(),
        "generation_hint": page_plan.get("generation_prompt"),
    }

    if section_key == "hero":
        hero_tagline = requirements.get("tagline") or page_plan.get("goal") or f"Discover high quality {domain} products."
        props.update(
            {
                "headline": f"{brand_name}",
                "subheadline": hero_tagline,
                "primary_cta": {"label": "Shop Collection", "href": "/products"},
                "secondary_cta": {"label": "Explore Store", "href": "/categories"},
                "background_color": palette.get("hero_bg"),
                "text_color": palette.get("hero_text_color"),
                "auto_play": True,
                "auto_play_interval": 4,
                "slides": [
                    {
                        "id": "slide_1",
                        "headline": f"Welcome to {brand_name}",
                        "subheadline": hero_tagline,
                        "badge": "NEW ARRIVAL",
                        "primary_cta": {"label": "Shop Now", "href": "/products"},
                        "secondary_cta": {"label": "Browse Catalog", "href": "/products"},
                        "background_color": palette.get("hero_bg"),
                        "text_color": palette.get("hero_text_color"),
                        "trust_badges": ["Free Shipping", "30-Day Money Back", "24/7 VIP Support"],
                    }
                ]
            }
        )
    elif section_key in {"featured_products", "featured_books", "bestsellers", "results_grid"}:
        props.update(
            {
                "title": "Browse Products" if section_key == "results_grid" else "Featured Products",
                "layout": "grid",
                "limit": 8,
                "card_style": requirements.get("card_style") or "fashion",
                "card_bg_color": palette.get("card_bg"),
                "card_shadow": palette.get("card_shadow"),
            }
        )
    elif section_key == "related_products":
        props.update(
            {
                "title": "Related Products",
                "layout": "grid",
                "limit": 4,
            }
        )
    elif section_key in {"categories", "top_categories", "category_strip", "collections", "featured_collections"}:
        props.update(
            {
                "title": "Shop by Category",
                "layout": "grid" if block_type != "category_strip" else "horizontal",
            }
        )
    elif section_key == "offers":
        props.update(
            {
                "title": "Latest Offers",
                "style": "highlight-cards",
            }
        )
    elif section_key in {"delivery_trust", "trust_badges"}:
        props.update(
            {
                "title": "Why Shop With Us",
                "items": ["Quality products", "Secure checkout", "Reliable fulfillment"],
            }
        )
    elif section_key == "product_info":
        props.update(
            {
                "show_price": True,
                "show_description": True,
                "show_attributes": True,
            }
        )
    elif section_key == "purchase_cta":
        props.update(
            {
                "primary_cta": "Add to Cart",
                "secondary_cta": "Buy Now",
            }
        )
    elif section_key == "filters":
        props.update(
            {
                "filter_groups": ["category", "price", "availability"],
            }
        )
    elif section_key == "sort_bar":
        props.update(
            {
                "sort_options": ["featured", "price_low_to_high", "price_high_to_low", "newest"],
            }
        )
    elif section_key == "delivery_form":
        props.update(
            {
                "fields": ["full_name", "phone", "address", "city", "postal_code"],
            }
        )
    elif section_key == "payment_methods":
        props.update(
            {
                "methods": requirements.get("payment_preferences", []),
            }
        )
    elif section_key == "metrics_overview":
        props.update({"cards": ["revenue", "orders", "customers", "inventory_status"]})
    elif section_key in {"product_table", "order_table"}:
        props.update({"view": "table"})
    elif section_key == "confirmation_message":
        props.update(
            {
                "title": "Order Confirmed",
                "message": f"Your order with {brand_name} has been placed successfully.",
            }
        )
    elif block_type == "generic_section":
        props.update(
            {
                "variant": "placeholder",
                "body": page_plan.get("goal"),
            }
        )

    return props


def _build_page_blocks(
    page_id: str,
    page_plan: Dict[str, Any],
    requirements: Dict[str, Any],
    frontend_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    sections = page_plan.get("sections", [])
    blocks: List[Dict[str, Any]] = []

    for index, raw_section_key in enumerate(sections):
        section_key = _normalize_section_key(raw_section_key)
        block_type = SECTION_TO_BLOCK_TYPE.get(section_key, "generic_section")
        blocks.append(
            {
                "id": f"{page_id}_{section_key}_{index}",
                "section": section_key,
                "type": block_type,
                "props": _build_block_props(
                    section_key=section_key,
                    block_type=block_type,
                    requirements=requirements,
                    page_plan=page_plan,
                    frontend_config=frontend_config,
                ),
                "data_source": _infer_data_source(block_type, section_key),
                "actions": _infer_actions(block_type, page_id),
            }
        )

    return blocks


def _build_pages(
    requirements: Dict[str, Any],
    site_plan: Dict[str, Any],
    frontend_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    frontend_plan = site_plan.get("frontend_plan", {})
    page_plans = frontend_plan.get("page_plans", [])

    pages: List[Dict[str, Any]] = []

    for page_plan in page_plans:
        page_id = page_plan["page_key"]
        meta = PAGE_META.get(
            page_id,
            {
                "name": page_id.replace("_", " ").title(),
                "role": page_id,
                "flow": "storefront",
                "show_in_nav": True,
                "default_route": f"/{page_id}",
            },
        )

        blocks = _build_page_blocks(
            page_id=page_id,
            page_plan=page_plan,
            requirements=requirements,
            frontend_config=frontend_config,
        )

        if meta.get("role") == "checkout" or page_id == "checkout":
            blocks = [
                b for b in blocks
                if not any(token in str(b.get("type", "")).lower() for token in ["banner", "hero", "carousel", "grid", "navbar", "footer"])
            ]

        pages.append(
            {
                "id": page_id,
                "name": meta["name"],
                "route": meta["default_route"],
                "role": meta["role"],
                "flow": meta["flow"],
                "show_in_nav": meta["show_in_nav"],
                "page_type": page_plan.get("page_type"),
                "goal": page_plan.get("goal"),
                "generation_prompt": page_plan.get("generation_prompt"),
                "blocks": blocks,
            }
        )

    return pages


def _build_resources(backend_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    resources: List[Dict[str, Any]] = []

    data_models = backend_config.get("data_models", [])
    if isinstance(data_models, dict):
        for model_name, model_config in data_models.items():
            resources.append(
                {
                    "name": _resource_name(model_name),
                    "model": model_name,
                    "table_name": model_config.get("table") or _table_name(model_name),
                }
            )
        return resources

    for model_name in data_models:
        resources.append(
            {
                "name": _resource_name(model_name),
                "model": model_name,
                "table_name": _table_name(model_name),
            }
        )

    return resources


def _build_navigation(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    storefront_nav = []
    admin_nav = []

    for page in pages:
        if not page.get("show_in_nav"):
            continue

        item = {
            "label": page["name"],
            "route": page["route"],
            "role": page["role"],
        }

        if page["flow"] == "admin":
            admin_nav.append(item)
        else:
            storefront_nav.append(item)

    return {
        "storefront": storefront_nav,
        "admin": admin_nav,
    }


def build_site_definition(
    requirements: Dict[str, Any],
    site_plan: Dict[str, Any],
    backend_config: Dict[str, Any],
    frontend_config: Dict[str, Any],
) -> Dict[str, Any]:
    brand_name = _safe_brand_name(requirements)

    site_info = {
        "site_type": requirements.get("site_type", "website"),
        "domain": requirements.get("domain") or "general",
        "region": requirements.get("region"),
        "brand_name": brand_name,
        "catalog_type": requirements.get("catalog_type") or requirements.get("domain") or "general",
        "target_audience": requirements.get("target_audience"),
    }

    theme = _default_theme_config(requirements, frontend_config)
    pages = _build_pages(requirements, site_plan, frontend_config)
    resources = _build_resources(backend_config)
    navigation = _build_navigation(pages)

    return {
        "site": site_info,
        "theme": theme,
        "navigation": navigation,
        "pages": pages,
        "resources": resources,
        "admin": {
            "enabled": requirements.get("needs_admin_panel", True),
            "features": backend_config.get("admin", {}).get("features", []),
        },
    }