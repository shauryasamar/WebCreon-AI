from typing import List, Literal, Optional

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

Extraction rules:
1. site_type:
   - Usually set to "ecommerce" unless the prompt clearly asks for another kind of site.

2. domain:
   - Infer the business domain as specifically as possible.
   - Examples: clothing, grocery, electronics, beauty, furniture, bookstore, jewelry, pharmacy, bakery.
   - Never return null. Always make a reasonable guess.

3. brand_name:
   - Only set a brand name if the user explicitly gives one.
   - If the user says "my store", "my brand", "my clothing brand", keep it as null.

4. region:
   - Only set region if explicitly mentioned.

5. products:
   - Extract concrete products or product categories from the prompt.

6. payment_preferences:
   - Extract explicitly mentioned payment methods only.

7. theme:
   - Use only if clearly mentioned, such as light, dark, minimal, luxury, pastel, neutral.

8. needs_admin_panel:
   - Default to true for ecommerce unless the user explicitly says otherwise.

9. target_audience:
   - Extract if directly stated or strongly implied.

10. brand_tone:
   - Infer from the prompt where reasonable.
   - Examples: premium, playful, minimalist, bold, elegant, fresh, local, modern.

11. visual_style:
   - Infer the intended design direction if possible.
   - Examples: clean minimal, editorial, premium luxury, modern storefront, colorful marketplace.

12. hero_focus:
   - Capture the main core business message or hero proposition.

13. catalog_type:
   - Usually same as domain, but normalized for frontend rendering.
   - Examples: clothing, grocery, electronics, beauty, furniture, general.

14. must_have_sections:
   - Extract explicitly requested sections and also include obvious ecommerce essentials if strongly implied.
   - Examples: hero, featured_products, categories, offers, testimonials, newsletter.

15. admin_scope:
   - For ecommerce, include practical admin scopes such as products, orders, inventory.
   - Add customers if user mentions user/customer management.

Important:
- Do not invent a specific brand name.
- Do not output explanations.
- Be concise but complete.
"""

prompt_tmpl = ChatPromptTemplate.from_messages([
    ("system", system_text),
    ("user", "{user_prompt}"),
])

structured_llm = llm.with_structured_output(WebsiteRequirements)
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