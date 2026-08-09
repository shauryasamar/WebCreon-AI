from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate


class PaletteOption(BaseModel):
    id: str = Field(description="Unique ID for palette option, e.g. palette_1, palette_2")
    name: str = Field(description="Descriptive palette name, e.g. Rose Gold Velvet, Midnight Emerald")
    description: str = Field(description="Explanation of why this color combination suits the brand")
    
    # Page background & text
    primary_bg: str = Field(description="Main page background hex, e.g. #ffffff, #fafafa, or #0f172a")
    secondary_bg: str = Field(description="Secondary container/sidebar background hex")
    text_color: str = Field(description="Primary text hex code (must contrast well with primary_bg)")
    muted_text: str = Field(description="Muted/secondary text hex code")
    
    # Accent & Actions
    accent_color: str = Field(description="Primary brand action/CTA button hex code")
    accent_hover: str = Field(description="Hover state hex code for primary accent")
    accent_text: str = Field(description="Text color inside accent buttons, e.g. #ffffff")
    
    # Borders
    border_color: str = Field(description="Divider and input border hex code")
    soft_border: str = Field(description="Subtle card border hex code")
    
    # Navbar Specifics
    navbar_bg: str = Field(description="Navbar background hex")
    navbar_text_color: str = Field(description="Navbar text color hex")
    navbar_border_color: str = Field(description="Navbar border color hex")
    
    # Footer Specifics
    footer_bg: str = Field(description="Footer background hex")
    footer_text_color: str = Field(description="Footer text color hex")
    footer_muted_color: str = Field(description="Footer muted text color hex")
    
    # Hero Banner
    hero_bg: str = Field(description="Hero background hex or CSS linear-gradient string")
    hero_text_color: str = Field(description="Hero text color hex")
    hero_accent: str = Field(description="Hero CTA button accent hex")
    
    # Product Cards
    card_bg: str = Field(description="Product card background hex")
    card_shadow: str = Field(description="Product card shadow CSS string, e.g. 0 4px 16px rgba(0,0,0,0.06)")


class PaletteResponse(BaseModel):
    palettes: List[PaletteOption] = Field(description="List of 4-5 distinct color palette options")


system_prompt = """
You are an expert color theory designer for high-end e-commerce websites.

Your task is to generate 4 to 5 distinct, highly harmonious, and WCAG AA compliant color palette options based on the user's brand description, domain, and desired theme.

CRITICAL COLOR RULES:
1. NO CAMOUFLAGE / ILL-MATCHED COMBINATIONS:
   - Never put black text on a dark background or white text on a light background.
   - Text color must strictly contrast with primary_bg and card_bg.
   - Never pair clashing colors like neon green with bright red unless explicitly asked.
2. HARMONY & RICHNESS:
   - Calculate complementary, triadic, or monochromatic color palettes that elevate the brand's aesthetic.
   - For a luxury brand: use deep tones, champagne golds, rich emeralds, or soft nude blush tones.
   - For a pink theme: generate 4-5 different shades of pink palettes (e.g., Dusty Rose Gold, Pastel Coral & Cream, Magenta Midnight, Blush & Slate Gray, Soft Rose Velvet).
   - For electronics: use sleek dark modes, electric blue accents, metallic slates, or clean Apple white with cyan/violet accents.
3. COMPONENT LEVEL HARMONY:
   - navbar_bg and footer_bg should complement primary_bg (either soft tint, distinct solid contrast, or clean glass tint).
   - hero_bg can be a rich linear-gradient string like `linear-gradient(135deg, #fdf2f8, #fce7f3)` or `linear-gradient(135deg, #0f172a, #1e293b)`.
   - card_bg should be crisp and clean against primary_bg.

Generate 4 to 5 options that give the user real visual diversity while remaining professional.
"""

prompt_tmpl = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("user", "Brand Name: {brand_name}\nDomain: {domain}\nTheme Wish/Description: {color_description}\nTarget Audience: {target_audience}\nBrand Tone: {brand_tone}"),
])


async def generate_color_palettes(
    brand_name: str,
    domain: str,
    color_description: str,
    target_audience: str = "general",
    brand_tone: str = "modern"
) -> List[dict]:
    try:
        llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0.7)
        structured_llm = llm.with_structured_output(PaletteResponse)
        color_chain = prompt_tmpl | structured_llm

        response: PaletteResponse = await color_chain.ainvoke({
            "brand_name": brand_name or "Store",
            "domain": domain or "general",
            "color_description": color_description or "modern clean palette",
            "target_audience": target_audience or "general",
            "brand_tone": brand_tone or "modern"
        })
        return [p.model_dump() for p in response.palettes]
    except Exception as e:
        print("Using fallbacks for color palettes:", e)
        return _get_fallback_palettes(color_description)


def _get_fallback_palettes(color_desc: str) -> List[dict]:
    desc_lower = color_desc.lower()
    is_pink = "pink" in desc_lower or "rose" in desc_lower or "blush" in desc_lower
    is_dark = "dark" in desc_lower or "black" in desc_lower or "obsidian" in desc_lower

    if is_pink:
        return PaletteOption(
            id="palette_1",
            name="Rose Gold Velvet",
            description="Soft blush rose background with elegant dark text and deep rose accent",
            primary_bg="#fdf2f8",
            secondary_bg="#fbcfe8",
            text_color="#1f2937",
            muted_text="#6b7280",
            accent_color="#db2777",
            accent_hover="#be185d",
            accent_text="#ffffff",
            border_color="#f472b6",
            soft_border="#fbcfe8",
            navbar_bg="#ffffff",
            navbar_text_color="#1f2937",
            navbar_border_color="rgba(219,39,119,0.15)",
            footer_bg="#fdf2f8",
            footer_text_color="#1f2937",
            footer_muted_color="#6b7280",
            hero_bg="linear-gradient(135deg, #fdf2f8, #fbcfe8)",
            hero_text_color="#831843",
            hero_accent="#db2777",
            card_bg="#ffffff",
            card_shadow="0 4px 16px rgba(219,39,119,0.08)"
        ).model_dump()
    elif is_dark:
        return PaletteOption(
            id="palette_1",
            name="Midnight Obsidian",
            description="Sleek dark obsidian mode with electric indigo accents",
            primary_bg="#0f172a",
            secondary_bg="#1e293b",
            text_color="#f8fafc",
            muted_text="#94a3b8",
            accent_color="#6366f1",
            accent_hover="#4f46e5",
            accent_text="#ffffff",
            border_color="rgba(255,255,255,0.12)",
            soft_border="rgba(255,255,255,0.06)",
            navbar_bg="#0f172a",
            navbar_text_color="#f8fafc",
            navbar_border_color="rgba(255,255,255,0.1)",
            footer_bg="#090d16",
            footer_text_color="#f8fafc",
            footer_muted_color="#94a3b8",
            hero_bg="linear-gradient(135deg, #0f172a, #1e293b)",
            hero_text_color="#ffffff",
            hero_accent="#6366f1",
            card_bg="#1e293b",
            card_shadow="0 8px 24px rgba(0,0,0,0.3)"
        ).model_dump()
    else:
        return PaletteOption(
            id="palette_1",
            name="Modern Minimalist White",
            description="Clean crisp white layout with deep slate typography and vibrant blue action buttons",
            primary_bg="#ffffff",
            secondary_bg="#f8fafc",
            text_color="#0f172a",
            muted_text="#64748b",
            accent_color="#2563eb",
            accent_hover="#1d4ed8",
            accent_text="#ffffff",
            border_color="#e2e8f0",
            soft_border="#f1f5f9",
            navbar_bg="#ffffff",
            navbar_text_color="#0f172a",
            navbar_border_color="rgba(15,23,42,0.08)",
            footer_bg="#f8fafc",
            footer_text_color="#0f172a",
            footer_muted_color="#64748b",
            hero_bg="linear-gradient(135deg, #f8fafc, #e2e8f0)",
            hero_text_color="#0f172a",
            hero_accent="#2563eb",
            card_bg="#ffffff",
            card_shadow="0 4px 16px rgba(15,23,42,0.06)"
        ).model_dump()
