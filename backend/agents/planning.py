import json
from typing import Dict, List, Literal

from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate


CANONICAL_SECTION_ALIASES = {
    "hero": "hero",
    "featured_products": "featured_products",
    "featuredproducts": "featured_products",
    "featured_books": "featured_books",
    "featuredboooks": "featured_books",
    "bestsellers": "bestsellers",
    "categories": "categories",
    "top_categories": "top_categories",
    "topcategories": "top_categories",
    "category_strip": "category_strip",
    "categorystrip": "category_strip",
    "collections": "collections",
    "featured_collections": "featured_collections",
    "featuredcollections": "featured_collections",
    "genres": "categories",
    "offers": "offers",
    "gift_banner": "gift_banner",
    "giftbanner": "gift_banner",
    "delivery_trust": "delivery_trust",
    "deliverytrust": "delivery_trust",
    "trust_badges": "trust_badges",
    "trustbadges": "trust_badges",
    "spec_highlights": "spec_highlights",
    "spechighlights": "spec_highlights",
    "editorial_pick": "editorial_pick",
    "editorialpick": "editorial_pick",
    "recommendations": "recommendations",
    "page_header": "page_header",
    "pageheader": "page_header",
    "filters": "filters",
    "filter_sidebar": "filters",
    "filtersidebar": "filters",
    "sort_bar": "sort_bar",
    "sortbar": "sort_bar",
    "results_grid": "results_grid",
    "resultsgrid": "results_grid",
    "product_grid": "results_grid",
    "productgrid": "results_grid",
    "pagination": "pagination",
    "breadcrumbs": "breadcrumbs",
    "product_gallery": "product_gallery",
    "productgallery": "product_gallery",
    "gallery": "product_gallery",
    "product_info": "product_info",
    "productinfo": "product_info",
    "purchase_cta": "purchase_cta",
    "purchasecta": "purchase_cta",
    "cta": "purchase_cta",
    "related_products": "related_products",
    "relatedproducts": "related_products",
    "related_items": "related_products",
    "relateditems": "related_products",
    "cart_items": "cart_items",
    "cartitems": "cart_items",
    "cart_summary": "cart_summary",
    "cartsummary": "cart_summary",
    "summary": "cart_summary",
    "promo_code": "promo_code",
    "promocode": "promo_code",
    "checkout_cta": "checkout_cta",
    "checkoutcta": "checkout_cta",
    "delivery_form": "delivery_form",
    "deliveryform": "delivery_form",
    "delivery": "delivery_form",
    "payment_methods": "payment_methods",
    "paymentmethods": "payment_methods",
    "payment": "payment_methods",
    "order_summary": "order_summary",
    "ordersummary": "order_summary",
    "place_order_cta": "place_order_cta",
    "placeordercta": "place_order_cta",
    "confirmation_message": "confirmation_message",
    "confirmationmessage": "confirmation_message",
    "next_steps": "next_steps",
    "nextsteps": "next_steps",
    "next_actions": "next_steps",
    "nextactions": "next_steps",
    "continue_shopping_cta": "continue_shopping_cta",
    "continueshoppingcta": "continue_shopping_cta",
    "metrics_overview": "metrics_overview",
    "metricsoverview": "metrics_overview",
    "overviewstats": "metrics_overview",
    "recent_orders": "recent_orders",
    "recentorders": "recent_orders",
    "inventory_alerts": "inventory_alerts",
    "inventoryalerts": "inventory_alerts",
    "quick_actions": "quick_actions",
    "quickactions": "quick_actions",
    "quicklinks": "quick_actions",
    "toolbar": "toolbar",
    "product_table": "product_table",
    "producttable": "product_table",
    "product_list": "product_table",
    "productlist": "product_table",
    "edit_drawer": "edit_drawer",
    "editdrawer": "edit_drawer",
    "addeditproduct": "edit_drawer",
    "order_table": "order_table",
    "ordertable": "order_table",
    "order_list": "order_table",
    "orderlist": "order_table",
    "status_filters": "status_filters",
    "statusfilters": "status_filters",
    "statusupdate": "status_filters",
    "order_detail_panel": "order_detail_panel",
    "orderdetailpanel": "order_detail_panel",
    "orderdetails": "order_detail_panel",
    "search": "filters",
}


class BackendPlan(BaseModel):
    data_models: List[str] = Field(default_factory=list)
    services: List[str] = Field(default_factory=list)
    integrations: List[str] = Field(default_factory=list)
    admin_features: List[str] = Field(default_factory=list)


class PagePlan(BaseModel):
    page_key: str
    page_type: Literal[
        "landing",
        "catalog",
        "product_detail",
        "cart",
        "checkout",
        "confirmation",
        "admin",
        "informational",
    ]
    title: str
    goal: str
    sections: List[str] = Field(default_factory=list)
    generation_prompt: str


class FrontendPlan(BaseModel):
    pages: List[str] = Field(default_factory=list)
    required_components: List[str] = Field(default_factory=list)
    theme: str = "light"
    page_plans: List[PagePlan] = Field(default_factory=list)
    design_direction: str = "modern ecommerce storefront"


class SitePlan(BaseModel):
    backend_plan: BackendPlan
    frontend_plan: FrontendPlan


llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0)

system_text = """
You are a planning assistant for an AI website builder.

You receive structured ecommerce website requirements and must return a complete site plan.
Return a structured object matching the output schema exactly.

Planning goals:
1. Build a backend plan with practical ecommerce models and services.
2. Build a frontend plan with user-facing pages, admin pages, components, and page-level generation prompts.
3. Make the output suitable for fully automatic webpage generation without manual prompt writing later.

Backend:
- Always include these data models:
  Product, Inventory, Order, User, PaymentConfig
- Add domain-relevant models if needed, such as:
  Offer, Category, Banner, Review, Address, Shipment
- Always include these services:
  CatalogService, CartService, CheckoutService, PaymentService
- Add OrderService and InventoryService by default for ecommerce
- If needs_admin_panel is true, include AdminService
- integrations must equal payment_preferences if provided, else []
- admin_features should reflect admin_scope when present

Frontend:
- Always include these core pages:
  home, product_list, product_detail, cart, checkout, order_confirmation
- If needs_admin_panel is true, also include:
  admin_dashboard, admin_products, admin_orders
- required_components must include at least:
  navbar, footer, product_grid, product_card, cart_sidebar, checkout_form
- Add domain-aware components if useful:
  category_strip, hero_banner, offer_cards, testimonial_cards, filter_sidebar, search_bar, trust_badges

Important section vocabulary:
Use ONLY these canonical section keys in page_plans.sections:
hero, featured_products, featured_books, bestsellers, categories, top_categories,
category_strip, collections, featured_collections, offers, gift_banner,
delivery_trust, trust_badges, spec_highlights, editorial_pick, recommendations,
page_header, filters, sort_bar, results_grid, pagination, breadcrumbs,
product_gallery, product_info, purchase_cta, related_products,
cart_items, cart_summary, promo_code, checkout_cta,
delivery_form, payment_methods, order_summary, place_order_cta,
confirmation_message, next_steps, continue_shopping_cta,
metrics_overview, recent_orders, inventory_alerts, quick_actions,
toolbar, product_table, edit_drawer, order_table, status_filters, order_detail_panel

Never use variants like:
gallery, CTA, relateditems, summary, payment, delivery, filtersidebar, productgrid, quicklinks, overviewstats.

Page planning:
- For every page in frontend_plan.pages, create a matching page_plans entry.
- Each page_plan must include:
  page_key, page_type, title, goal, sections, generation_prompt
- generation_prompt must be clear enough that a renderer/content generator can build the page automatically.
- generation_prompt should mention:
  domain, brand tone, visual style, theme, target audience when available, and the page's purpose.
- Keep generation_prompt concise but actionable.

Domain behavior examples:
- grocery: emphasize categories, freshness, offers, delivery trust, daily essentials
- jewelry: emphasize premium branding, craftsmanship, featured collections, trust, giftable presentation
- bookstore: emphasize categories, discovery, editorial feel, featured books, recommendations
- clothing: emphasize collections, fit, new arrivals, category-led browsing
- electronics: emphasize specs, featured products, trust, performance, comparison cues

Theme:
- Use requirements.theme if present, else "light"

Output constraints:
- Return only structured output
- No explanations
- No markdown
"""

prompt_tmpl = ChatPromptTemplate.from_messages(
    [
        ("system", system_text),
        ("user", "Requirements:\n{requirements_json}"),
    ]
)

structured_llm = llm.with_structured_output(SitePlan)
planning_chain = prompt_tmpl | structured_llm


def _unique_keep_order(items: List[str]) -> List[str]:
    seen = set()
    result = []
    for item in items:
        if not item:
            continue
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def _normalize_section_key(section: str) -> str:
    key = (section or "").strip().lower().replace(" ", "_")
    compact = key.replace("_", "")
    return CANONICAL_SECTION_ALIASES.get(key) or CANONICAL_SECTION_ALIASES.get(compact) or key


def _normalize_sections(sections: List[str]) -> List[str]:
    normalized = [_normalize_section_key(section) for section in sections]
    return _unique_keep_order(normalized)


def _domain_home_sections(domain: str, must_have_sections: List[str]) -> List[str]:
    domain_map = {
        "grocery": ["hero", "categories", "featured_products", "offers", "delivery_trust"],
        "jewelry": ["hero", "featured_collections", "bestsellers", "trust_badges", "gift_banner"],
        "bookstore": ["hero", "categories", "featured_books", "editorial_pick", "recommendations"],
        "clothing": ["hero", "collections", "featured_products", "category_strip"],
        "electronics": ["hero", "featured_products", "top_categories", "spec_highlights", "trust_badges"],
    }
    defaults = domain_map.get(domain, ["hero", "featured_products", "categories", "trust_badges"])
    return _normalize_sections(defaults + (must_have_sections or []))


def _default_admin_features(admin_scope: List[str]) -> List[str]:
    mapping = {
        "products": "Product Management",
        "orders": "Order Management",
        "inventory": "Inventory Management",
        "customers": "Customer Management",
        "users": "User Management",
        "offers": "Offer Management",
    }
    features = [mapping[item] for item in admin_scope if item in mapping]
    if not features:
        features = ["Product Management", "Order Management", "Inventory Management"]
    return _unique_keep_order(features)


def _normalize_page_plans(page_plans: List[Dict]) -> List[Dict]:
    normalized_plans = []
    for page_plan in page_plans:
        updated = dict(page_plan)
        updated["sections"] = _normalize_sections(page_plan.get("sections", []))
        normalized_plans.append(updated)
    return normalized_plans


def _build_default_site_plan(requirements: Dict) -> Dict:
    domain = requirements.get("domain") or "general"
    brand_name = requirements.get("brand_name") or "Your Brand"
    theme = requirements.get("theme") or "light"
    brand_tone = requirements.get("brand_tone") or "modern approachable"
    visual_style = requirements.get("visual_style") or "modern ecommerce storefront"
    target_audience = requirements.get("target_audience") or "general shoppers"
    payment_preferences = requirements.get("payment_preferences", [])
    admin_scope = requirements.get("admin_scope", [])
    needs_admin_panel = requirements.get("needs_admin_panel", True)
    must_have_sections = requirements.get("must_have_sections", [])

    backend_models = [
        "Product",
        "Inventory",
        "Order",
        "User",
        "PaymentConfig",
        "Category",
        "Address",
        "Banner",
        "Shipment",
    ]
    if domain in {"grocery", "clothing", "electronics", "bookstore", "jewelry"}:
        backend_models.append("Offer")
    if domain in {"jewelry", "electronics", "bookstore", "clothing"}:
        backend_models.append("Review")

    backend_services = [
        "CatalogService",
        "CartService",
        "CheckoutService",
        "PaymentService",
        "OrderService",
        "InventoryService",
    ]
    if needs_admin_panel:
        backend_services.append("AdminService")

    admin_features = _default_admin_features(admin_scope) if needs_admin_panel else []

    pages = [
        "home",
        "product_list",
        "product_detail",
        "cart",
        "checkout",
        "order_confirmation",
    ]
    if needs_admin_panel:
        pages += ["admin_dashboard", "admin_products", "admin_orders"]

    required_components = [
        "navbar",
        "footer",
        "product_grid",
        "product_card",
        "cart_sidebar",
        "checkout_form",
        "hero_banner",
        "search_bar",
        "filter_sidebar",
        "trust_badges",
    ]

    if domain in {"grocery", "clothing", "bookstore"}:
        required_components.append("category_strip")
    if domain in {"grocery", "jewelry"}:
        required_components.append("offer_cards")
    if domain in {"jewelry", "electronics"}:
        required_components.append("testimonial_cards")

    home_sections = _domain_home_sections(domain, must_have_sections)

    page_plans = [
        {
            "page_key": "home",
            "page_type": "landing",
            "title": f"{brand_name} Home",
            "goal": "Introduce the brand and drive shoppers into the catalog.",
            "sections": home_sections,
            "generation_prompt": (
                f"Create a {theme}-themed {domain} ecommerce homepage for {brand_name} "
                f"with a {brand_tone} tone and {visual_style} visual style. "
                f"Target audience: {target_audience}. "
                f"Include sections: {', '.join(home_sections)}. "
                f"Prioritize conversion, category discovery, and trust."
            ),
        },
        {
            "page_key": "product_list",
            "page_type": "catalog",
            "title": f"{brand_name} Catalog",
            "goal": "Help users browse and filter products efficiently.",
            "sections": ["page_header", "filters", "sort_bar", "results_grid", "pagination"],
            "generation_prompt": (
                f"Create a {domain} catalog page for {brand_name} using a {brand_tone} tone, "
                f"{visual_style} styling, and {theme} theme. Include filters, sorting, and a strong product grid."
            ),
        },
        {
            "page_key": "product_detail",
            "page_type": "product_detail",
            "title": "Product Details",
            "goal": "Explain product value and drive add-to-cart action.",
            "sections": ["breadcrumbs", "product_gallery", "product_info", "purchase_cta", "related_products"],
            "generation_prompt": (
                f"Create a {domain} product detail page for {brand_name} with clear product information, "
                f"trust cues, purchase CTA, and related product suggestions in a {visual_style} style."
            ),
        },
        {
            "page_key": "cart",
            "page_type": "cart",
            "title": "Your Cart",
            "goal": "Review selected items and continue to checkout.",
            "sections": ["cart_items", "cart_summary", "promo_code", "checkout_cta"],
            "generation_prompt": (
                f"Create a cart page for {brand_name} that feels simple, clear, and conversion-focused. "
                f"Use {theme} theme and {brand_tone} tone."
            ),
        },
        {
            "page_key": "checkout",
            "page_type": "checkout",
            "title": "Checkout",
            "goal": "Collect delivery and payment information with minimal friction.",
            "sections": ["delivery_form", "payment_methods", "order_summary", "place_order_cta"],
            "generation_prompt": (
                f"Create a checkout page for {brand_name} optimized for fast completion. "
                f"Supported payments: {', '.join(payment_preferences) if payment_preferences else 'standard online payments'}. "
                f"Use a {visual_style} style and {theme} theme."
            ),
        },
        {
            "page_key": "order_confirmation",
            "page_type": "confirmation",
            "title": "Order Confirmed",
            "goal": "Confirm success and guide the customer to next actions.",
            "sections": ["confirmation_message", "next_steps", "continue_shopping_cta"],
            "generation_prompt": (
                f"Create an order confirmation page for {brand_name} with a reassuring tone, clear next steps, "
                f"and continued shopping options."
            ),
        },
    ]

    if needs_admin_panel:
        page_plans.extend(
            [
                {
                    "page_key": "admin_dashboard",
                    "page_type": "admin",
                    "title": "Admin Dashboard",
                    "goal": "Give operators a summary of store activity.",
                    "sections": ["metrics_overview", "recent_orders", "inventory_alerts", "quick_actions"],
                    "generation_prompt": (
                        f"Create an admin dashboard for a {domain} ecommerce business with quick operational visibility, "
                        f"using a clean {theme} dashboard UI."
                    ),
                },
                {
                    "page_key": "admin_products",
                    "page_type": "admin",
                    "title": "Manage Products",
                    "goal": "Create, edit, categorize, and publish products.",
                    "sections": ["toolbar", "product_table", "filters", "edit_drawer"],
                    "generation_prompt": (
                        f"Create an admin product management page for {brand_name} with efficient CRUD workflows, "
                        f"search, filtering, and inventory visibility."
                    ),
                },
                {
                    "page_key": "admin_orders",
                    "page_type": "admin",
                    "title": "Manage Orders",
                    "goal": "Track and update order lifecycle efficiently.",
                    "sections": ["toolbar", "order_table", "status_filters", "order_detail_panel"],
                    "generation_prompt": (
                        f"Create an admin orders page for {brand_name} focused on fulfillment visibility, "
                        f"status management, and operational clarity."
                    ),
                },
            ]
        )

    page_plans = _normalize_page_plans(page_plans)

    site_plan = {
        "backend_plan": {
            "data_models": _unique_keep_order(backend_models),
            "services": _unique_keep_order(backend_services),
            "integrations": payment_preferences,
            "admin_features": admin_features,
        },
        "frontend_plan": {
            "pages": pages,
            "required_components": _unique_keep_order(required_components),
            "theme": theme,
            "page_plans": page_plans,
            "design_direction": visual_style,
        },
    }

    return site_plan


async def plan_site(requirements: Dict) -> Dict:
    requirements_json = json.dumps(requirements)
    try:
        result: SitePlan = await planning_chain.ainvoke({"requirements_json": requirements_json})
        site_plan = result.model_dump()
        site_plan["frontend_plan"]["page_plans"] = _normalize_page_plans(
            site_plan.get("frontend_plan", {}).get("page_plans", [])
        )
    except Exception:
        site_plan = _build_default_site_plan(requirements)

    return site_plan