from typing import List, Literal, Optional, Dict, Any

from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate


class WebsiteRequirements(BaseModel):
    site_type: str = Field(
        default="ecommerce",
        description="Type of website to build, usually ecommerce."
    )
    domain: str = Field(
        default="general",
        description="High-level business domain like clothing, grocery, electronics, beauty, furniture, bookstore."
    )
    brand_name: Optional[str] = Field(
        default=None,
        description="Explicit brand name only if clearly mentioned by the user."
    )
    tagline: Optional[str] = Field(
        default=None,
        description="Tagline or slogan for the brand."
    )
    region: Optional[str] = Field(
        default=None,
        description="Country or region if explicitly mentioned."
    )
    products: List[str] = Field(
        default_factory=list,
        description="Main product categories or items the store sells."
    )
    payment_preferences: List[str] = Field(
        default_factory=list,
        description="Preferred payment methods such as Razorpay, Stripe, COD, UPI, PayPal."
    )
    theme: Optional[Literal["light", "dark", "neutral", "pastel", "luxury", "minimal"]] = Field(
        default=None,
        description="Requested theme if clearly specified."
    )
    chosen_palette: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full computed color palette dictionary from color_agent."
    )
    navbar_layout: Optional[Literal["apple_minimal", "glassmorphism_premium", "modern_marketplace", "luxury_fashion", "neo_modern"]] = Field(
        default=None,
        description="Selected navbar layout style."
    )
    navbar_position: Optional[Literal["static", "sticky", "fixed"]] = Field(
        default="fixed",
        description="Navbar position behavior."
    )
    navbar_variant: Optional[Literal["solid", "soft", "floating", "transparent"]] = Field(
        default=None,
        description="Navbar variant visual depth style."
    )
    footer_layout: Optional[Literal["apple_minimal", "glassmorphism_premium", "modern_marketplace", "luxury_fashion", "neo_modern"]] = Field(
        default=None,
        description="Selected footer layout style."
    )
    card_style: Optional[Literal["fashion", "electronics", "beauty", "grocery", "books"]] = Field(
        default=None,
        description="Product grid card style matching business domain."
    )
    needs_admin_panel: bool = Field(
        default=True,
        description="Whether admin panel is needed."
    )
    target_audience: Optional[str] = Field(
        default=None,
        description="Who the site is for, if mentioned or strongly implied."
    )
    brand_tone: Optional[str] = Field(
        default=None,
        description="Tone such as premium, playful, modern, minimalist, local, bold, elegant."
    )
    visual_style: Optional[str] = Field(
        default=None,
        description="Visual direction such as clean minimal, editorial, modern card-based, luxury storefront."
    )
    hero_focus: Optional[str] = Field(
        default=None,
        description="Main hero message or business focus."
    )
    catalog_type: str = Field(
        default="general",
        description="Catalog classification used by frontend variants, e.g. clothing, grocery, electronics."
    )
    must_have_sections: List[str] = Field(
        default_factory=list,
        description="Important requested sections like hero, featured_products, testimonials, categories, offers."
    )
    admin_scope: List[str] = Field(
        default_factory=list,
        description="Admin areas needed, e.g. products, orders, inventory, customers."
    )


llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0)

system_text = """
You are an expert requirements extraction assistant for an AI ecommerce website builder.

Your task is to read a user prompt and extract structured website requirements.

Return a structured object matching the schema exactly.
"""

prompt_tmpl = ChatPromptTemplate.from_messages([
    ("system", system_text),
    ("user", "{user_prompt}"),
])

structured_llm = llm.with_structured_output(WebsiteRequirements, method="function_calling")
understanding_chain = prompt_tmpl | structured_llm


def _normalize_requirements(data: WebsiteRequirements) -> WebsiteRequirements:
    normalized = data.model_copy(deep=True)

    if not normalized.domain:
        normalized.domain = "general"

    if not normalized.catalog_type or normalized.catalog_type == "general":
        normalized.catalog_type = normalized.domain

    if not normalized.admin_scope and normalized.needs_admin_panel:
        normalized.admin_scope = ["products", "orders", "inventory"]

    if not normalized.must_have_sections:
        normalized.must_have_sections = ["hero", "featured_products"]

    # Auto-infer card_style from domain if not explicitly provided
    if not normalized.card_style:
        domain_lower = normalized.domain.lower()
        if any(w in domain_lower for w in ["cloth", "fashion", "apparel", "wear"]):
            normalized.card_style = "fashion"
        elif any(w in domain_lower for w in ["tech", "electron", "gadget", "mobile"]):
            normalized.card_style = "electronics"
        elif any(w in domain_lower for w in ["beauty", "cosmetic", "skin", "makeup"]):
            normalized.card_style = "beauty"
        elif any(w in domain_lower for w in ["groc", "food", "fruit", "supermarket"]):
            normalized.card_style = "grocery"
        elif any(w in domain_lower for w in ["book", "stationery", "paper"]):
            normalized.card_style = "books"
        else:
            normalized.card_style = "fashion"

    # Auto-infer navbar_layout & footer_layout if not provided
    if not normalized.navbar_layout:
        if normalized.card_style == "beauty" or "luxury" in str(normalized.brand_tone):
            normalized.navbar_layout = "luxury_fashion"
            normalized.footer_layout = normalized.footer_layout or "luxury_fashion"
        elif normalized.card_style == "electronics":
            normalized.navbar_layout = "neo_modern"
            normalized.footer_layout = normalized.footer_layout or "neo_modern"
        elif normalized.card_style == "grocery":
            normalized.navbar_layout = "modern_marketplace"
            normalized.footer_layout = normalized.footer_layout or "modern_marketplace"
        else:
            normalized.navbar_layout = "apple_minimal"
            normalized.footer_layout = normalized.footer_layout or "apple_minimal"

    if not normalized.visual_style:
        if normalized.theme in {"luxury"}:
            normalized.visual_style = "premium luxury storefront"
        elif normalized.theme in {"minimal", "light", "neutral"}:
            normalized.visual_style = "clean minimal storefront"
        elif normalized.theme == "dark":
            normalized.visual_style = "modern dark storefront"
        else:
            normalized.visual_style = "modern ecommerce storefront"

    if not normalized.brand_tone:
        domain_tone_map = {
            "clothing": "modern stylish",
            "grocery": "fresh local friendly",
            "electronics": "modern reliable",
            "beauty": "premium elegant",
            "furniture": "warm refined",
            "bookstore": "thoughtful editorial",
        }
        normalized.brand_tone = domain_tone_map.get(normalized.domain, "modern approachable")

    return normalized


async def extract_requirements(user_prompt: str) -> dict:
    result: WebsiteRequirements = await understanding_chain.ainvoke(
        {"user_prompt": user_prompt}
    )
    normalized = _normalize_requirements(result)
    return normalized.model_dump()