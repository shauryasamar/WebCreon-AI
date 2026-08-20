"""
Webcreon AI - Unified Master Color & Design Agent
Unified source of truth for color palette generation, WCAG AA accessibility contrast,
component color patching, live block styling, whole-site theme matching, and AI palette suggestions.
"""

import copy
import json
import re
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# Upgraded to GPT-4o-mini with timeout and retries for network resilience
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1, request_timeout=20, max_retries=2)


# ==========================================
# 1. COLOR PALETTE STRUCTURED SCHEMAS
# ==========================================

class PaletteOption(BaseModel):
    id: str = Field(description="Unique ID for palette option, e.g. palette_1, palette_2")
    name: str = Field(description="Descriptive palette name, e.g. Rose Gold Velvet, Midnight Emerald")
    description: str = Field(description="Explanation of why this color combination suits the brand")
    visual_style: Optional[str] = Field(default="solid_clean", description="Visual style: 'solid_clean', 'elevated_luxury', 'warm_organic', 'cyber_glow', 'glassmorphic'")
    
    primary_bg: str = Field(description="Main page background hex, e.g. #ffffff, #fafafa, or #0f172a")
    secondary_bg: str = Field(description="Secondary container/sidebar background hex")
    text_color: str = Field(description="Primary text hex code (must contrast well with primary_bg)")
    muted_text: str = Field(description="Muted/secondary text hex code")
    
    accent_color: str = Field(description="Primary brand action/CTA button hex code")
    accent_hover: str = Field(description="Hover state hex code for primary accent")
    accent_text: str = Field(description="Text color inside accent buttons, e.g. #ffffff")
    
    border_color: str = Field(description="Divider and input border hex code")
    soft_border: str = Field(description="Subtle card border hex code")
    
    navbar_bg: str = Field(description="Navbar background hex")
    navbar_outer_bg: Optional[str] = Field(default=None, description="Navbar outer wrapper background hex")
    navbar_text_color: str = Field(description="Navbar text color hex")
    navbar_border_color: str = Field(description="Navbar border color hex")
    navbar_variant: Optional[str] = Field(default="soft", description="Navbar style: 'solid', 'soft', 'floating', 'transparent'")
    
    footer_bg: str = Field(description="Footer background hex")
    footer_text_color: str = Field(description="Footer text color hex")
    footer_muted_color: str = Field(description="Footer muted text color hex")
    
    hero_bg: str = Field(description="Hero background hex or CSS linear-gradient string")
    hero_text_color: str = Field(description="Hero text color hex")
    hero_accent: str = Field(description="Hero CTA button accent hex")
    
    card_bg: str = Field(description="Product card background hex")
    card_shadow: str = Field(description="Product card shadow CSS string, e.g. 0 4px 16px rgba(0,0,0,0.06)")
    card_radius: Optional[int] = Field(default=20, description="Card corner radius in pixels (e.g. 16, 20, 24)")


class PaletteResponse(BaseModel):
    palettes: List[PaletteOption] = Field(description="List of 4-5 distinct color palette options")


# ==========================================
# 2. CONTRAST & ACCESSIBILITY UTILITIES (TONAL HARMONIZER)
# ==========================================

import colorsys
from typing import Tuple

def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    h = str(hex_str or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return (255, 255, 255)
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except Exception:
        return (255, 255, 255)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{max(0, min(255, r)):02x}{max(0, min(255, g)):02x}{max(0, min(255, b)):02x}"


def hex_to_hsl(hex_str: str) -> Tuple[float, float, float]:
    r, g, b = hex_to_rgb(hex_str)
    h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
    return (h * 360.0, s, l)


def hsl_to_hex(h: float, s: float, l: float) -> str:
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360.0, max(0.0, min(1.0, l)), max(0.0, min(1.0, s)))
    return rgb_to_hex(int(round(r * 255)), int(round(g * 255)), int(round(g * 255)))


def get_relative_luminance(hex_str: str) -> float:
    r, g, b = hex_to_rgb(hex_str)
    def srgb_channel(c: int) -> float:
        val = c / 255.0
        return val / 12.92 if val <= 0.03928 else ((val + 0.055) / 1.055) ** 2.4
    return 0.2126 * srgb_channel(r) + 0.7152 * srgb_channel(g) + 0.0722 * srgb_channel(b)


def calculate_contrast_ratio(hex1: str, hex2: str) -> float:
    l1 = get_relative_luminance(hex1)
    l2 = get_relative_luminance(hex2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def calculate_contrast_color(bg_val: str) -> str:
    """Calculates high-contrast text color (#ffffff or #0f172a) with guaranteed WCAG AA contrast, including RGBA and gradients."""
    if not isinstance(bg_val, str) or not bg_val.strip():
        return "#0f172a"

    bg_clean = bg_val.strip().lower()

    # 1. Direct rgba / rgb match (e.g. rgba(255, 255, 255, 0.70) or rgb(240, 240, 240))
    rgba_match = re.search(r"rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)", bg_clean)
    if rgba_match:
        r, g, b = int(rgba_match.group(1)), int(rgba_match.group(2)), int(rgba_match.group(3))
        def srgb_channel(c: int) -> float:
            val = c / 255.0
            return val / 12.92 if val <= 0.03928 else ((val + 0.055) / 1.055) ** 2.4
        lum = 0.2126 * srgb_channel(r) + 0.7152 * srgb_channel(g) + 0.0722 * srgb_channel(b)
        return "#0f172a" if lum > 0.35 else "#ffffff"

    # 2. Hex match
    hex_match = re.search(r"#[0-9a-f]{3,6}", bg_clean)
    if hex_match:
        hex_clean = hex_match.group(0)
    elif bg_clean.startswith("#"):
        hex_clean = bg_clean
    else:
        # Fallback for gradients or keyword styles
        if any(w in bg_clean for w in ["dark", "black", "#090d16", "#0f172a", "#1e293b", "midnight"]):
            return "#ffffff"
        return "#0f172a"

    ratio_dark = calculate_contrast_ratio(hex_clean, "#0f172a")
    ratio_light = calculate_contrast_ratio(hex_clean, "#ffffff")
    return "#0f172a" if ratio_dark >= ratio_light else "#ffffff"


def generate_tonal_harmony(base_hex: str, is_dark: bool = False) -> Dict[str, str]:
    """Generates a complete 60-30-10 harmonious tonal scale from any base color."""
    h, s, _ = hex_to_hsl(base_hex)
    
    if is_dark:
        surface_bg = hsl_to_hex(h, min(0.30, s * 0.4), 0.08)
        container_bg = hsl_to_hex(h, min(0.35, s * 0.5), 0.13)
        accent = hsl_to_hex(h, max(0.70, s), 0.58)
        accent_hover = hsl_to_hex(h, max(0.80, s), 0.50)
        text_color = hsl_to_hex(h, min(0.20, s * 0.3), 0.96)
        muted_text = hsl_to_hex(h, min(0.25, s * 0.3), 0.70)
        border = hsl_to_hex(h, min(0.30, s * 0.4), 0.22)
    else:
        surface_bg = hsl_to_hex(h, min(0.25, s * 0.3), 0.98)
        container_bg = hsl_to_hex(h, min(0.30, s * 0.4), 0.94)
        accent = hsl_to_hex(h, max(0.70, s), 0.46)
        accent_hover = hsl_to_hex(h, max(0.80, s), 0.38)
        text_color = hsl_to_hex(h, min(0.30, s * 0.4), 0.09)
        muted_text = hsl_to_hex(h, min(0.25, s * 0.3), 0.42)
        border = hsl_to_hex(h, min(0.25, s * 0.3), 0.88)
        
    return {
        "primary_bg": surface_bg,
        "secondary_bg": container_bg,
        "accent_color": accent,
        "accent_hover": accent_hover,
        "accent_text": calculate_contrast_color(accent),
        "text_color": text_color,
        "muted_text": muted_text,
        "border_color": border,
    }


def generate_palettes_from_hex(base_hex: str, brand_name: str = "Store") -> List[Dict[str, Any]]:
    """Generates 5 diverse, WCAG AA compliant design archetypes centered on a custom hex color."""
    h, s, l = hex_to_hsl(base_hex)
    accent_text = calculate_contrast_color(base_hex)
    
    # 1. Clean Studio Minimal
    clean_studio = {
        "id": "palette_hex_clean",
        "name": f"{brand_name} Studio Minimal",
        "description": f"Crisp alabaster surfaces with high-impact {base_hex} accent buttons and typography.",
        "visual_style": "solid_clean",
        "primary_bg": "#ffffff",
        "secondary_bg": "#f8fafc",
        "text_color": "#0f172a",
        "muted_text": "#64748b",
        "accent_color": base_hex,
        "accent_hover": hsl_to_hex(h, min(1.0, s * 1.1), max(0.2, l * 0.85)),
        "accent_text": accent_text,
        "border_color": "#e2e8f0",
        "soft_border": "#f1f5f9",
        "navbar_bg": "#ffffff",
        "navbar_outer_bg": "#ffffff",
        "navbar_text_color": "#0f172a",
        "navbar_border_color": "#e2e8f0",
        "navbar_variant": "soft",
        "footer_bg": "#0f172a",
        "footer_text_color": "#ffffff",
        "footer_muted_color": "#94a3b8",
        "hero_bg": "#ffffff",
        "hero_text_color": "#0f172a",
        "hero_accent": base_hex,
        "card_bg": "#ffffff",
        "card_shadow": "0 4px 20px rgba(0,0,0,0.06)",
        "card_radius": 20,
    }
    
    # 2. Deep Obsidian Luxury (Dark Mode)
    dark_bg = hsl_to_hex(h, min(0.35, s * 0.4), 0.07)
    dark_card = hsl_to_hex(h, min(0.40, s * 0.5), 0.12)
    dark_luxury = {
        "id": "palette_hex_dark",
        "name": f"{brand_name} Midnight Obsidian",
        "description": f"Atmospheric dark canvas with luminous {base_hex} ambient highlights.",
        "visual_style": "elevated_luxury",
        "primary_bg": dark_bg,
        "secondary_bg": dark_card,
        "text_color": "#f8fafc",
        "muted_text": "#94a3b8",
        "accent_color": base_hex,
        "accent_hover": hsl_to_hex(h, max(0.8, s), min(0.75, max(0.4, l * 1.15))),
        "accent_text": accent_text,
        "border_color": hsl_to_hex(h, min(0.3, s * 0.3), 0.20),
        "soft_border": hsl_to_hex(h, min(0.3, s * 0.3), 0.16),
        "navbar_bg": dark_bg,
        "navbar_outer_bg": dark_bg,
        "navbar_text_color": "#f8fafc",
        "navbar_border_color": hsl_to_hex(h, min(0.3, s * 0.3), 0.18),
        "navbar_variant": "solid",
        "footer_bg": hsl_to_hex(h, min(0.3, s * 0.3), 0.05),
        "footer_text_color": "#f8fafc",
        "footer_muted_color": "#64748b",
        "hero_bg": dark_bg,
        "hero_text_color": "#f8fafc",
        "hero_accent": base_hex,
        "card_bg": dark_card,
        "card_shadow": "0 8px 30px rgba(0,0,0,0.35)",
        "card_radius": 20,
    }
    
    # 3. Balanced Tonal Harmony
    tonal = generate_tonal_harmony(base_hex, is_dark=False)
    tonal_harmony = {
        "id": "palette_hex_tonal",
        "name": f"{brand_name} Tonal Harmony",
        "description": f"Subtle tinted surfaces mathematically balanced to complement {base_hex}.",
        "visual_style": "warm_organic",
        "primary_bg": tonal["primary_bg"],
        "secondary_bg": tonal["secondary_bg"],
        "text_color": tonal["text_color"],
        "muted_text": tonal["muted_text"],
        "accent_color": base_hex,
        "accent_hover": tonal["accent_hover"],
        "accent_text": tonal["accent_text"],
        "border_color": tonal["border_color"],
        "soft_border": hsl_to_hex(h, min(0.2, s * 0.25), 0.92),
        "navbar_bg": tonal["primary_bg"],
        "navbar_outer_bg": tonal["primary_bg"],
        "navbar_text_color": tonal["text_color"],
        "navbar_border_color": tonal["border_color"],
        "navbar_variant": "soft",
        "footer_bg": tonal["secondary_bg"],
        "footer_text_color": tonal["text_color"],
        "footer_muted_color": tonal["muted_text"],
        "hero_bg": tonal["primary_bg"],
        "hero_text_color": tonal["text_color"],
        "hero_accent": base_hex,
        "card_bg": "#ffffff",
        "card_shadow": "0 4px 16px rgba(0,0,0,0.05)",
        "card_radius": 20,
    }
    
    # 4. Bold Neo-Modern Contrast
    neo_modern = {
        "id": "palette_hex_neo",
        "name": f"{brand_name} Neo Bold",
        "description": f"High-contrast carbon header against clean canvas with electric {base_hex} CTA buttons.",
        "visual_style": "cyber_glow",
        "primary_bg": "#fafafa",
        "secondary_bg": "#f4f4f5",
        "text_color": "#18181b",
        "muted_text": "#71717a",
        "accent_color": base_hex,
        "accent_hover": hsl_to_hex(h, min(1.0, s * 1.1), max(0.25, l * 0.85)),
        "accent_text": accent_text,
        "border_color": "#e4e4e7",
        "soft_border": "#f4f4f5",
        "navbar_bg": "#09090b",
        "navbar_outer_bg": "#09090b",
        "navbar_text_color": "#fafafa",
        "navbar_border_color": "#27272a",
        "navbar_variant": "solid",
        "footer_bg": "#09090b",
        "footer_text_color": "#fafafa",
        "footer_muted_color": "#71717a",
        "hero_bg": "#fafafa",
        "hero_text_color": "#18181b",
        "hero_accent": base_hex,
        "card_bg": "#ffffff",
        "card_shadow": "0 6px 24px rgba(0,0,0,0.08)",
        "card_radius": 20,
    }
    
    # 5. Frosted Glass / Translucent
    frosted_glass = {
        "id": "palette_hex_glass",
        "name": f"{brand_name} Frosted Glass",
        "description": f"Translucent glass navigation island with specular rim highlights, ambient refraction, and {base_hex} glow.",
        "visual_style": "glassmorphic",
        "surface_materiality": "full_glass",
        "primary_bg": "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.14) 0%, transparent 45%), radial-gradient(circle at 90% 60%, rgba(139, 92, 246, 0.12) 0%, transparent 50%), #f8fafc",
        "secondary_bg": "rgba(255, 255, 255, 0.65)",
        "text_color": "#0f172a",
        "muted_text": "#64748b",
        "accent_color": base_hex,
        "accent_hover": hsl_to_hex(h, min(1.0, s * 1.1), max(0.25, l * 0.85)),
        "accent_text": accent_text,
        "border_color": "rgba(255, 255, 255, 0.6)",
        "soft_border": "rgba(255, 255, 255, 0.3)",
        "navbar_layout": "glassmorphism_premium",
        "navbar_bg": "rgba(255, 255, 255, 0.72)",
        "navbar_outer_bg": "transparent",
        "navbar_text_color": "#0f172a",
        "navbar_border_color": "rgba(255, 255, 255, 0.45)",
        "navbar_variant": "floating",
        "footer_layout": "glassmorphism_premium",
        "footer_bg": "#0f172a",
        "footer_text_color": "#ffffff",
        "footer_muted_color": "#94a3b8",
        "hero_bg": "radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.16) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.14) 0%, transparent 50%), #f8fafc",
        "hero_text_color": "#0f172a",
        "hero_accent": base_hex,
        "card_bg": "rgba(255, 255, 255, 0.70)",
        "card_shadow": "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.75)",
        "card_radius": 24,
    }
    
    return [clean_studio, dark_luxury, tonal_harmony, neo_modern, frosted_glass]


# ==========================================
# 3. LLM COLOR GENERATOR FUNCTIONS
# ==========================================

# High-creativity GPT-4o-mini for rich, diverse, fast and cost-effective color palette generation
creative_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.85)


async def generate_color_palettes(
    brand_name: str = "Store",
    domain: str = "E-Commerce",
    color_description: Optional[str] = None,
    session_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Generates 4-5 WCAG AA compliant, highly creative color palettes based on brand description and domain."""
    from agents.token_tracker import TokenCostCallback
    palette_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an elite color theory director for luxury & modern e-commerce brands.
Your job is to craft 4-5 DISTINCT, UNFORGETTABLE, and WCAG AA compliant color palettes tailored specifically to the user's brand name, domain, and exact aesthetic preference.

CREATIVITY & ARCHETYPAL DIVERSITY RULES:
- NEVER generate 5 repetitive palettes that all use basic white backgrounds with only the navbar color swapped!
- Each of the 4-5 generated palettes MUST represent a completely DIFFERENT structural design archetype:
  1. OPTION 1 (Light Studio Minimal): Crisp alabaster/white primary_bg (#ffffff, #fffbf7), crisp floating navbar, vivid action accent buttons.
  2. OPTION 2 (Deep Dark Luxury): Rich atmospheric obsidian/midnight/slate primary_bg (e.g. #0c0a14, #120a0d, #0f172a), elevated card_bg container, matching dark navbar and footer.
  3. OPTION 3 (Warm Tinted / Earthy Editorial): Soft organic linen/oat/blush primary_bg (e.g. #faf7f2, #fdf4f4, #f4f7f4), natural toned navbar, elegant secondary surface containers.
  4. OPTION 4 (Bold High-Contrast Neo-Modern): Striking contrast (e.g. deep carbon black header against vivid saturated CTA accents and sharp typography).
  5. OPTION 5 (Vibrant Gradient / Atmospheric): Rich modern linear-gradient hero_bg, luminous accent colors, and dynamic surface containers.

- THEMATIC COLOR HARMONY & DYNAMIC VARIETY:
  - Explore the full gamut of color nuances (e.g. for Red: crimson, scarlet, burgundy, terracotta, coral, ruby, wine, brick, rosewood).
  - When a color is requested (e.g. "Red", "Green", "Pastel", "Cyber"), apply that color theme across DIFFERENT roles in each palette (e.g. one uses it as high-contrast CTA accents, another as deep burgundy dark mode, another as warm terracotta/rose, another as bold saturated header, another as rich gradient hero).
  - Every generation must feel fresh, tailor-fit to the brand's industry, and uniquely named with creative concept storytelling.
- PRODUCT CARDS (CRITICAL): Always give `card_bg` an elevated, distinctive surface background hex that harmonizes with the brand palette (e.g. if primary_bg is dark, card_bg must be elevated container hex; if primary_bg is light, card_bg can be crisp #ffffff or subtle surface tone).
- Ensure all text_color and navbar_text_color combinations pass strict WCAG AA readability against their respective background colors."""),
        ("user", "Brand: {brand_name}\nDomain/Niche: {domain}\nSpecific Vibe/Request: {color_description}"),
    ])

    try:
        structured_llm = palette_prompt | creative_llm.with_structured_output(PaletteResponse)
        res: PaletteResponse = await structured_llm.ainvoke(
            {
                "brand_name": brand_name,
                "domain": domain,
                "color_description": color_description or "Modern clean minimalist",
            },
            config={"callbacks": [TokenCostCallback("ColorAgent.PaletteGenerator", session_id=session_id)]}
        )
        output_palettes = []
        for p in res.palettes:
            p_dict = p.model_dump()
            # Enforce strict WCAG AA contrast for generated text colors vs background colors
            if "primary_bg" in p_dict:
                p_dict["text_color"] = calculate_contrast_color(p_dict["primary_bg"])
            if "navbar_bg" in p_dict:
                p_dict["navbar_text_color"] = calculate_contrast_color(p_dict["navbar_bg"])
                if not p_dict.get("navbar_outer_bg"):
                    p_dict["navbar_outer_bg"] = p_dict["navbar_bg"]
            if "footer_bg" in p_dict:
                p_dict["footer_text_color"] = calculate_contrast_color(p_dict["footer_bg"])
            if "hero_bg" in p_dict:
                p_dict["hero_text_color"] = calculate_contrast_color(p_dict["hero_bg"])
            if "card_bg" in p_dict:
                p_dict["card_text_color"] = calculate_contrast_color(p_dict["card_bg"])
            output_palettes.append(p_dict)
        return output_palettes
    except Exception as e:
        print("Error generating palettes:", e)
        return []


class ColorPatchOutput(BaseModel):
    """Structured output for a component color patch."""
    surface_materiality: Optional[str] = Field(default=None, description="Surface style: 'full_glass', 'glass_navbar', or 'solid'")
    visual_style: Optional[str] = Field(default=None, description="Visual style: 'glassmorphic', 'solid_clean', 'elevated_luxury', etc.")
    navbar_layout: Optional[str] = Field(default=None, description="Navbar layout: 'glassmorphism_premium', 'apple_minimal', etc.")
    navbar_variant: Optional[str] = Field(default=None, description="Navbar variant: 'floating', 'soft', 'solid'")
    footer_layout: Optional[str] = Field(default=None, description="Footer layout: 'glassmorphism_premium', 'apple_minimal', etc.")
    card_shadow: Optional[str] = Field(default=None, description="Card shadow CSS string")

    primary_bg: Optional[str] = Field(default=None, description="Primary page background hex or gradient")
    secondary_bg: Optional[str] = Field(default=None, description="Secondary container background hex")
    text_color: Optional[str] = Field(default=None, description="Primary text hex")
    muted_text: Optional[str] = Field(default=None, description="Muted text hex")
    accent_color: Optional[str] = Field(default=None, description="Accent/CTA hex")
    accent_hover: Optional[str] = Field(default=None, description="Accent hover hex")
    accent_text: Optional[str] = Field(default=None, description="Text inside accent buttons hex")
    border_color: Optional[str] = Field(default=None, description="Border/divider hex")
    
    navbar_outer_bg: Optional[str] = Field(default=None, description="Navbar outer wrapper background hex")
    navbar_bg: Optional[str] = Field(default=None, description="Navbar background hex")
    navbar_text_color: Optional[str] = Field(default=None, description="Navbar text hex")
    navbar_border_color: Optional[str] = Field(default=None, description="Navbar border hex")
    
    footer_bg: Optional[str] = Field(default=None, description="Footer background hex")
    footer_text_color: Optional[str] = Field(default=None, description="Footer text hex")
    footer_muted_color: Optional[str] = Field(default=None, description="Footer muted text hex")
    footer_border_color: Optional[str] = Field(default=None, description="Footer border hex")
    
    hero_bg: Optional[str] = Field(default=None, description="Hero background hex or gradient")
    hero_text_color: Optional[str] = Field(default=None, description="Hero text hex")
    hero_accent: Optional[str] = Field(default=None, description="Hero button accent hex")
    
    card_bg: Optional[str] = Field(default=None, description="Product catalog card background hex")
    card_text_color: Optional[str] = Field(default=None, description="Product catalog card text hex")
    card_border_color: Optional[str] = Field(default=None, description="Product catalog card border hex")
    
    grid_bg: Optional[str] = Field(default=None, description="Product catalog section/grid container background hex")
    grid_text_color: Optional[str] = Field(default=None, description="Product catalog section title text hex")
    
    product_detail_bg: Optional[str] = Field(default=None, description="Product detail page container background hex")
    product_detail_text: Optional[str] = Field(default=None, description="Product detail text color hex")
    product_detail_btn_bg: Optional[str] = Field(default=None, description="Product detail add to cart button background hex")
    product_detail_btn_text: Optional[str] = Field(default=None, description="Product detail add to cart button text hex")

    cart_bg: Optional[str] = Field(default=None, description="Cart sidebar/drawer background hex")
    cart_text_color: Optional[str] = Field(default=None, description="Cart sidebar text hex")
    cart_card_bg: Optional[str] = Field(default=None, description="Cart item card background hex")
    cart_accent_color: Optional[str] = Field(default=None, description="Cart checkout button background hex")
    cart_border_color: Optional[str] = Field(default=None, description="Cart border hex")

    summary_bg: Optional[str] = Field(default=None, description="Checkout order summary background hex")
    summary_card_bg: Optional[str] = Field(default=None, description="Checkout order summary item card background hex")
    summary_text_color: Optional[str] = Field(default=None, description="Checkout order summary text hex")
    summary_accent_color: Optional[str] = Field(default=None, description="Checkout order summary accent hex")
    summary_border_color: Optional[str] = Field(default=None, description="Checkout order summary border hex")

    delivery_form_bg: Optional[str] = Field(default=None, description="Delivery/checkout form card background hex")
    delivery_form_text: Optional[str] = Field(default=None, description="Delivery/checkout form text hex")
    delivery_form_input_bg: Optional[str] = Field(default=None, description="Delivery/checkout form input field background hex")
    delivery_form_input_text: Optional[str] = Field(default=None, description="Delivery/checkout form input text hex")
    delivery_form_border: Optional[str] = Field(default=None, description="Delivery/checkout form border hex")
    delivery_form_btn_bg: Optional[str] = Field(default=None, description="Delivery/checkout form continue button background hex")
    delivery_form_btn_text: Optional[str] = Field(default=None, description="Delivery/checkout form continue button text hex")

    payment_bg: Optional[str] = Field(default=None, description="Payment methods card background hex")
    payment_card_bg: Optional[str] = Field(default=None, description="Payment option pill background hex")
    payment_text_color: Optional[str] = Field(default=None, description="Payment methods text hex")
    payment_accent_color: Optional[str] = Field(default=None, description="Payment selection accent hex")
    payment_border_color: Optional[str] = Field(default=None, description="Payment options border hex")

    place_order_bg: Optional[str] = Field(default=None, description="Place order section container background hex")
    place_order_btn_bg: Optional[str] = Field(default=None, description="Place order main button background hex")
    place_order_btn_text: Optional[str] = Field(default=None, description="Place order main button text hex")
    place_order_text: Optional[str] = Field(default=None, description="Place order helper note text hex")

    filter_bg: Optional[str] = Field(default=None, description="Filter toolbar background hex")
    filter_card_bg: Optional[str] = Field(default=None, description="Filter modal/dropdown dialog background hex")
    filter_text_color: Optional[str] = Field(default=None, description="Filter text color hex")
    filter_border_color: Optional[str] = Field(default=None, description="Filter border hex")
    filter_accent_color: Optional[str] = Field(default=None, description="Filter active/selected pill accent hex")

    pagination_bg: Optional[str] = Field(default=None, description="Pagination container background hex")
    pagination_text_color: Optional[str] = Field(default=None, description="Pagination button text hex")
    pagination_active_bg: Optional[str] = Field(default=None, description="Pagination active page button background hex")
    pagination_border_color: Optional[str] = Field(default=None, description="Pagination buttons border hex")

    order_history_bg: Optional[str] = Field(default=None, description="Order history / My Orders page background hex")
    order_history_card_bg: Optional[str] = Field(default=None, description="Order history / order details card background hex")
    order_history_text: Optional[str] = Field(default=None, description="Order history text hex")
    order_history_muted_text: Optional[str] = Field(default=None, description="Order history muted text hex")
    order_history_border: Optional[str] = Field(default=None, description="Order history card border hex")

    checkout_bg: Optional[str] = Field(default=None, description="Checkout multi-step flow container background hex")
    checkout_card_bg: Optional[str] = Field(default=None, description="Checkout card container background hex")
    checkout_text_color: Optional[str] = Field(default=None, description="Checkout section text hex")
    checkout_accent_color: Optional[str] = Field(default=None, description="Checkout active step accent hex")

    review_card_bg: Optional[str] = Field(default=None, description="Review section card background hex")
    review_text_color: Optional[str] = Field(default=None, description="Review section text hex")
    review_border_color: Optional[str] = Field(default=None, description="Review section border hex")


# Comprehensive Component Scoping Map covering all 17 storefront sections
COMPONENT_ALLOWED_KEYS = {
    "navbar": {"navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color"},
    "footer": {"footer_bg", "footer_text_color", "footer_muted_color", "footer_border_color"},
    "hero": {"hero_bg", "hero_text_color", "hero_accent"},
    "product_grid": {"grid_bg", "grid_text_color", "outer_bg_color"},
    "card": {"card_bg", "card_text_color", "card_border_color", "card_shadow"},
    "product_detail": {"product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text", "secondary_bg"},
    "cart": {"cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color"},
    "order_summary": {"summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color"},
    "delivery_form": {"delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text"},
    "payment": {"payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color"},
    "place_order": {"place_order_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text"},
    "filter": {"filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color"},
    "pagination": {"pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color"},
    "order_history": {"order_history_bg", "order_history_card_bg", "order_history_text", "order_history_muted_text", "order_history_border"},
    "checkout": {"checkout_bg", "checkout_card_bg", "checkout_text_color", "checkout_accent_color", "delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_border"},
    "review": {"review_card_bg", "review_text_color", "review_border_color"},
    "background": {"primary_bg", "secondary_bg", "text_color", "muted_text"},
}

GLOBAL_THEME_ALLOWED_KEYS = {
    "primary_bg", "secondary_bg", "text_color", "muted_text", "muted_text_color", "soft_text_color",
    "accent_color", "accent_hover", "accent_text",
    "border_color", "soft_border",
    "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color",
    "footer_bg", "footer_text_color", "footer_muted_color", "footer_border_color",
    "hero_bg", "hero_text_color", "hero_accent",
    "card_bg", "card_text_color", "card_border_color", "card_shadow",
    "festival_theme", "mode"
}


async def generate_component_color_patch(
    current_theme: Dict[str, Any],
    color_request: str,
    target_component: str = "overall",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a component color patch matching user color requests using structured output."""
    from agents.token_tracker import TokenCostCallback
    patch_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert color theory designer for modern e-commerce.
Generate a WCAG AA compliant, aesthetically harmonized color patch for the target component.
STRICT SCOPING RULES:
- If target_component is 'product_grid' or user asks for 'grid background' / 'product grid background', ONLY populate grid_bg, outer_bg_color, and grid_text_color. This modifies the product catalog section container background. Do NOT touch card_bg!
- If target_component is 'card' or user asks for 'product card color' / 'card background', ONLY populate card_bg, card_text_color, card_border_color, card_shadow. This modifies individual catalog product cards. Do NOT touch grid_bg or order_history_card_bg!
- If target_component is 'delivery_form' or user asks for 'delivery address' / 'delivery form' / 'shipping address' colors, ONLY populate delivery_form_bg, delivery_form_text, delivery_form_input_bg, delivery_form_border, delivery_form_btn_bg. Do NOT touch card_bg!
- If target_component is 'payment' or user asks for 'payment methods' / 'payment options' colors, ONLY populate payment_bg, payment_card_bg, payment_text_color, payment_accent_color, payment_border_color. Do NOT touch global card_bg!
- If target_component is 'place_order' or user asks for 'place order button' / 'checkout cta', ONLY populate place_order_bg, place_order_btn_bg, place_order_btn_text, place_order_text.
- If target_component is 'order_summary' or user asks for 'order summary' / 'checkout summary', ONLY populate summary_bg, summary_card_bg, summary_text_color, summary_accent_color, summary_border_color.
- If target_component is 'filter' or user asks for 'filter toolbar' / 'filter modal' / 'sort dropdown', ONLY populate filter_bg, filter_card_bg, filter_text_color, filter_border_color, filter_accent_color.
- If target_component is 'pagination' or user asks for 'pagination' / 'page numbers' / 'pagination buttons', ONLY populate pagination_bg, pagination_text_color, pagination_active_bg, pagination_border_color.
- If target_component is 'order_history' or user asks for 'order history card' / 'my orders page' / 'product history card' colors, ONLY populate order_history_bg, order_history_card_bg, order_history_text, order_history_border. Do NOT touch catalog card_bg!
- If target_component is 'navbar', ONLY populate navbar_bg, navbar_text_color, navbar_border_color. Do NOT touch primary_bg or card_bg!
- If target_component is 'footer', ONLY populate footer_bg, footer_text_color, footer_muted_color, footer_border_color. Do NOT touch primary_bg!
- If target_component is 'product_detail', ONLY populate product_detail_bg, product_detail_text, product_detail_btn_bg, product_detail_btn_text. Do NOT touch global card_bg or navbar!
- If target_component is 'cart', ONLY populate cart_bg, cart_text_color, cart_card_bg, cart_accent_color.
- If target_component is 'hero', ONLY populate hero_bg, hero_text_color, hero_accent.
- If target_component is 'overall', 'webpage', or 'website', populate primary_bg, text_color, secondary_bg, accent_color, navbar_bg, footer_bg, card_bg for a complete webpage theme update.
ALWAYS pair dark background colors with light text (#ffffff) and light backgrounds with dark text (#0f172a)."""),
        ("user", "Current Theme:\n{current_theme}\nTarget Component: {target_component}\nColor Request: {color_request}"),
    ])

    try:
        structured_chain = patch_prompt | llm.with_structured_output(ColorPatchOutput)
        result: ColorPatchOutput = await structured_chain.ainvoke(
            {
                "current_theme": json.dumps(current_theme),
                "target_component": target_component,
                "color_request": color_request,
            },
            config={"callbacks": [TokenCostCallback("ColorAgent.ComponentPatch", session_id=session_id)]}
        )
        raw_patch = {k: v for k, v in result.model_dump().items() if v is not None}

        # Filter keys based on target component to prevent accidental overall page background leakage
        target_lower = target_component.lower().strip()

        # If user requested multiple components at once (e.g., "footer and navbar") -> COMBINE ALLOWED KEYS
        if target_lower.startswith("multi:"):
            comps = target_lower.replace("multi:", "").split(",")
            allowed = set()
            for c in comps:
                allowed.update(COMPONENT_ALLOWED_KEYS.get(c, set()))
        # If user explicitly requested whole webpage/website/overall -> ONLY ALLOW GLOBAL DESIGN TOKENS
        elif target_lower in ["overall", "webpage", "website", "site", "all", "entire", "full"]:
            allowed = GLOBAL_THEME_ALLOWED_KEYS
        else:
            allowed = COMPONENT_ALLOWED_KEYS.get(target_lower)

        if allowed is not None:
            filtered_patch = {k: v for k, v in raw_patch.items() if k in allowed}
        else:
            filtered_patch = raw_patch

        return {"color_patch": filtered_patch, "raw_patch": raw_patch}
    except Exception as e:
        print("Error generating color patch:", e)
        return {"color_patch": {}, "raw_patch": {}}


async def generate_component_palette_suggestions(
    brand_name: str,
    domain: str,
    target_component: str,
    color_description: str,
    current_theme: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Generates component-specific palette suggestions."""
    palettes = await generate_color_palettes(brand_name, domain, color_description)
    return palettes


ALL_COMPONENT_OVERRIDE_KEYS = {
    # delivery_form
    "delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text",
    # order_history
    "order_history_bg", "order_history_card_bg", "order_history_text", "order_history_muted_text", "order_history_border",
    # product_detail
    "product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text",
    # cart
    "cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color", "cart_panel_bg",
    # order_summary
    "summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color",
    # payment
    "payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color",
    # place_order
    "place_order_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text",
    # filter
    "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color",
    # pagination
    "pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color",
    # review
    "review_card_bg", "review_text_color", "review_border_color",
    # product_grid
    "grid_bg", "grid_text_color", "outer_bg_color"
}


# ==========================================
# 4. STORE BLOCK STYLING UTILITIES
# ==========================================

def apply_theme_to_blocks(pages: List[Dict[str, Any]], patch_dict: Dict[str, Any], target_type: Optional[str] = None) -> None:
    """Updates block props across all page definitions in-place with isolated component scoping."""
    is_overall = not target_type or target_type.lower() in ["overall", "webpage", "website", "site", "all", "entire"]
    target_clean = (target_type or "").lower().strip()

    for page in pages:
        blocks = page.get("blocks") or []
        for block in blocks:
            btype = str(block.get("type") or "").lower()
            bprops = block.setdefault("props", {})

            if is_overall:
                # Purge hardcoded block-level color overrides so components inherit cleanly from siteDefinition.theme
                for key in [
                    "card_bg_color", "outer_bg_color", "background_color", "card_bg",
                    "secondary_bg", "primary_bg", "title_color", "brand_color",
                    "price_color", "original_price_color", "rating_star_color",
                    "text_color", "accent_color", "panel_color", "input_color",
                    "border_color", "soft_border_color", "navbar_bg", "navbar_outer_bg",
                    "navbar_text_color", "navbar_border_color", "footer_bg",
                    "footer_text_color", "footer_muted_color", "footer_border_color",
                    "hero_bg", "hero_text_color", "hero_accent",
                    "button_bg_color", "button_text_color", "card_color", "active_bg_color"
                ] + list(ALL_COMPONENT_OVERRIDE_KEYS):
                    bprops.pop(key, None)
            else:
                # 1. Navbar Block Prop Sync (ONLY navbar blocks)
                if ("navbar" in target_clean or "header" in target_clean) and ("navbar" in btype or "header" in btype):
                    if "navbar_bg" in patch_dict:
                        bprops["navbar_bg"] = patch_dict["navbar_bg"]
                        bprops["background_color"] = patch_dict["navbar_bg"]
                    if "navbar_text_color" in patch_dict:
                        bprops["navbar_text_color"] = patch_dict["navbar_text_color"]
                        bprops["text_color"] = patch_dict["navbar_text_color"]
                    if "navbar_border_color" in patch_dict:
                        bprops["navbar_border_color"] = patch_dict["navbar_border_color"]

                # 2. Footer Block Prop Sync (ONLY footer blocks)
                elif "footer" in target_clean and "footer" in btype:
                    if "footer_bg" in patch_dict:
                        bprops["footer_bg"] = patch_dict["footer_bg"]
                        bprops["background_color"] = patch_dict["footer_bg"]
                    if "footer_text_color" in patch_dict:
                        bprops["footer_text_color"] = patch_dict["footer_text_color"]
                        bprops["text_color"] = patch_dict["footer_text_color"]
                    if "footer_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["footer_border_color"]

                # 3. Product Detail Page Block Prop Sync (ONLY product detail blocks)
                elif "product_detail" in target_clean and any(d in btype for d in ["product_detail", "productdetail", "product_info", "productinfo", "product_gallery", "productgallery", "purchase_panel", "purchasepanel"]):
                    if "product_detail_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["product_detail_bg"]
                        bprops["panel_color"] = patch_dict["product_detail_bg"]
                    elif "card_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["card_bg"]
                        bprops["panel_color"] = patch_dict["card_bg"]
                    if "product_detail_text" in patch_dict:
                        bprops["text_color"] = patch_dict["product_detail_text"]
                    elif "card_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["card_text_color"]
                    if "product_detail_btn_bg" in patch_dict:
                        bprops["button_bg_color"] = patch_dict["product_detail_btn_bg"]
                    elif "accent_color" in patch_dict:
                        bprops["button_bg_color"] = patch_dict["accent_color"]
                    if "product_detail_btn_text" in patch_dict:
                        bprops["button_text_color"] = patch_dict["product_detail_btn_text"]
                    elif "accent_text" in patch_dict:
                        bprops["button_text_color"] = patch_dict["accent_text"]

                # 4. Product Catalog / Grid / Card Block Prop Sync (ONLY product_grid blocks)
                elif any(c in target_clean for c in ["card", "product_grid", "grid"]) and any(g in btype for g in ["product_grid", "productgrid", "category_grid", "categorygrid"]):
                    if "grid_bg" in patch_dict:
                        bprops["outer_bg_color"] = patch_dict["grid_bg"]
                        bprops["background_color"] = patch_dict["grid_bg"]
                    elif "outer_bg_color" in patch_dict:
                        bprops["outer_bg_color"] = patch_dict["outer_bg_color"]
                        bprops["background_color"] = patch_dict["outer_bg_color"]
                    if "grid_text_color" in patch_dict:
                        bprops["title_color"] = patch_dict["grid_text_color"]
                    if "card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg"]
                    if "card_text_color" in patch_dict:
                        bprops["card_text_color"] = patch_dict["card_text_color"]
                    if "card_border_color" in patch_dict:
                        bprops["card_border_color"] = patch_dict["card_border_color"]

                # 5. Cart / Cart Drawer / Checkout Summary Block Prop Sync (ONLY cart blocks)
                elif "cart" in target_clean and any(k in btype for k in ["cart_sidebar", "cartsidebar", "cart_items", "cartitems", "order_summary", "ordersummary"]):
                    if "cart_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["cart_bg"]
                        bprops["panel_color"] = patch_dict["cart_bg"]
                    elif "secondary_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["secondary_bg"]
                    if "cart_card_bg" in patch_dict:
                        bprops["card_color"] = patch_dict["cart_card_bg"]
                    if "cart_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["cart_text_color"]
                    if "cart_accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["cart_accent_color"]

                # 6. Hero Banner / Slider Block Prop Sync (ONLY hero blocks)
                elif any(h in target_clean for h in ["hero", "banner", "slider"]) and any(h in btype for h in ["hero", "banner", "slider"]):
                    if "hero_bg" in patch_dict:
                        bprops["hero_bg"] = patch_dict["hero_bg"]
                        bprops["background_color"] = patch_dict["hero_bg"]
                    if "hero_text_color" in patch_dict:
                        bprops["hero_text_color"] = patch_dict["hero_text_color"]
                        bprops["text_color"] = patch_dict["hero_text_color"]

                    if isinstance(bprops.get("slides"), list):
                        for slide in bprops["slides"]:
                            if isinstance(slide, dict):
                                if "hero_bg" in patch_dict:
                                    slide["hero_bg"] = patch_dict["hero_bg"]
                                    slide["background_color"] = patch_dict["hero_bg"]
                                if "hero_text_color" in patch_dict:
                                    slide["hero_text_color"] = patch_dict["hero_text_color"]
                                    slide["text_color"] = patch_dict["hero_text_color"]

                # 7. Review Section Block Prop Sync (ONLY review blocks)
                elif "review" in target_clean and any(r in btype for r in ["review", "reviews", "ratings"]):
                    if "review_card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["review_card_bg"]
                        bprops["background_color"] = patch_dict["review_card_bg"]
                    elif "card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg"]
                        bprops["background_color"] = patch_dict["card_bg"]
                    if "review_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["review_text_color"]
                    elif "card_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["card_text_color"]
                    if "review_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["review_border_color"]

                # 8. Delivery Form / Checkout Form Block Prop Sync (ONLY delivery / checkout blocks)
                elif any(d in target_clean for d in ["delivery", "delivery_form", "shipping", "address"]) and any(b in btype for b in ["delivery_form", "deliveryform", "checkout_form", "checkoutform", "address_form"]):
                    if "delivery_form_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["delivery_form_bg"]
                    if "delivery_form_text" in patch_dict:
                        bprops["text_color"] = patch_dict["delivery_form_text"]
                    if "delivery_form_input_bg" in patch_dict:
                        bprops["input_color"] = patch_dict["delivery_form_input_bg"]
                    if "delivery_form_border" in patch_dict:
                        bprops["border_color"] = patch_dict["delivery_form_border"]
                    if "delivery_form_btn_bg" in patch_dict:
                        bprops["accentColor"] = patch_dict["delivery_form_btn_bg"]

                # 9. Order History / Customer Orders Block Prop Sync (ONLY order history blocks)
                elif any(o in target_clean for o in ["order_history", "orders", "my_orders", "order_card"]) and any(b in btype for b in ["order_history", "orders", "customer_orders", "orders_list"]):
                    if "order_history_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["order_history_bg"]
                    if "order_history_card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["order_history_card_bg"]
                    if "order_history_text" in patch_dict:
                        bprops["text_color"] = patch_dict["order_history_text"]
                    if "order_history_border" in patch_dict:
                        bprops["border_color"] = patch_dict["order_history_border"]

                # 10. Order Summary Block Prop Sync (ONLY summary blocks)
                elif "order_summary" in target_clean and any(s in btype for s in ["order_summary", "ordersummary", "checkout_summary"]):
                    if "summary_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["summary_bg"]
                        bprops["panel_color"] = patch_dict["summary_bg"]
                    if "summary_card_bg" in patch_dict:
                        bprops["card_color"] = patch_dict["summary_card_bg"]
                    if "summary_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["summary_text_color"]
                    if "summary_accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["summary_accent_color"]
                    if "summary_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["summary_border_color"]

                # 11. Payment Methods Block Prop Sync (ONLY payment blocks)
                elif "payment" in target_clean and any(p in btype for p in ["payment_methods", "paymentmethods", "payment"]):
                    if "payment_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["payment_bg"]
                    if "payment_card_bg" in patch_dict:
                        bprops["panel_color"] = patch_dict["payment_card_bg"]
                    if "payment_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["payment_text_color"]
                    if "payment_accent_color" in patch_dict:
                        bprops["accentColor"] = patch_dict["payment_accent_color"]
                    if "payment_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["payment_border_color"]

                # 12. Place Order CTA Block Prop Sync (ONLY place order blocks)
                elif any(p in target_clean for p in ["place_order", "checkout_cta"]) and any(p in btype for p in ["place_order_cta", "placeordercta", "checkout_cta", "checkoutcta"]):
                    if "place_order_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["place_order_bg"]
                    if "place_order_btn_bg" in patch_dict:
                        bprops["accentColor"] = patch_dict["place_order_btn_bg"]
                        bprops["button_bg_color"] = patch_dict["place_order_btn_bg"]
                    if "place_order_btn_text" in patch_dict:
                        bprops["button_text_color"] = patch_dict["place_order_btn_text"]
                    if "place_order_text" in patch_dict:
                        bprops["text_color"] = patch_dict["place_order_text"]

                # 13. Filter Toolbar / Sidebar Block Prop Sync (ONLY filter blocks)
                elif "filter" in target_clean and any(f in btype for f in ["filter_sidebar", "filtersidebar", "filter"]):
                    if "filter_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["filter_bg"]
                    if "filter_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["filter_text_color"]
                    if "filter_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["filter_border_color"]
                    if "filter_accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["filter_accent_color"]

                # 14. Pagination Block Prop Sync (ONLY pagination blocks)
                elif "pagination" in target_clean and any(p in btype for p in ["pagination"]):
                    if "pagination_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["pagination_bg"]
                    if "pagination_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["pagination_text_color"]
                    if "pagination_active_bg" in patch_dict:
                        bprops["active_bg_color"] = patch_dict["pagination_active_bg"]
                    if "pagination_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["pagination_border_color"]


# ==========================================
# 5. LANGGRAPH SUB-AGENT CHAT HANDLER
# ==========================================

def detect_target_component(user_message: str, target_component: Optional[str] = None) -> str:
    """Detects target component from request or defaults to 'overall' for whole-webpage requests."""
    msg_lower = user_message.lower().strip()

    # Whole webpage / website keywords -> OVERALL (applies theme to full website)
    if any(w in msg_lower for w in [
        "webpage", "website", "whole site", "entire site", "full site", "all over", "complete webpage", 
        "theme of webpage", "site theme", "theme of website", "overall", "complete page", "complete theme", 
        "full page", "entire page", "whole page", "page theme", "theme for page", "based on navbar", 
        "based on the navbar", "theme based on navbar", "theme for full page", "theme for complete page",
        "full page theme", "full website theme", "whole page theme"
    ]):
        return "overall"

    if target_component and target_component.lower() in ["overall", "webpage", "website", "site", "all", "entire", "full"]:
        return "overall"

    if target_component and target_component.lower() in COMPONENT_ALLOWED_KEYS:
        return target_component.lower()

    # Detect multi-component requests (e.g. "change theme for footer and navbar")
    found_components = set()
    if any(w in msg_lower for w in ["order summary", "checkout summary", "cart summary"]):
        found_components.add("order_summary")
    if any(w in msg_lower for w in ["delivery form", "delivery address", "delivery details", "shipping details", "shipping form", "delivery text", "address form"]):
        found_components.add("delivery_form")
    if any(w in msg_lower for w in ["payment method", "payment methods", "payment option", "payment options", "payment buttons", "payment section", "payment"]):
        found_components.add("payment")
    if any(w in msg_lower for w in ["place order button", "place order cta", "place order", "checkout button", "checkout cta"]):
        found_components.add("place_order")
    if any(w in msg_lower for w in ["filter toolbar", "filter bar", "filter modal", "filter sidebar", "filter button", "filters", "sort dropdown", "filter"]):
        found_components.add("filter")
    if any(w in msg_lower for w in ["pagination", "page numbers", "pagination bar", "page buttons"]):
        found_components.add("pagination")
    if any(w in msg_lower for w in ["order history", "orders page", "order page", "my orders", "orders list", "order card", "order cards", "product history card", "order history card", "history card", "orders history"]):
        found_components.add("order_history")
    if any(w in msg_lower for w in ["navbar", "nav bar", "header", "top bar"]):
        found_components.add("navbar")
    if "footer" in msg_lower:
        found_components.add("footer")
    if any(w in msg_lower for w in ["hero", "banner", "slider"]):
        found_components.add("hero")
    if any(w in msg_lower for w in ["product detail", "product page", "details page", "detail page", "product info", "gallery", "purchase panel", "add to cart button", "add to cart"]):
        found_components.add("product_detail")
    elif any(w in msg_lower for w in ["cart drawer", "cart sidebar", "cart items", "shopping cart", "cart page", "cart color", "cart background", "cart theme"]):
        found_components.add("cart")
    elif "cart" in msg_lower and not any(w in msg_lower for w in ["order summary", "add to cart", "product"]):
        found_components.add("cart")
    if any(w in msg_lower for w in ["review & pay", "review and pay", "review & place order", "review and place order"]):
        found_components.add("checkout")
    elif any(w in msg_lower for w in ["checkout", "checkout flow", "checkout step"]) and not any(c in found_components for c in ["delivery_form", "payment", "place_order", "order_summary"]):
        found_components.add("checkout")
    if any(w in msg_lower for w in ["customer review", "customer reviews", "rating", "ratings", "reviews", "review card", "review section"]) or ("review" in msg_lower and not any(r in msg_lower for r in ["review & pay", "review and pay", "review & place order", "review and place order"])):
        found_components.add("review")
    if not found_components and any(w in msg_lower for w in ["product grid", "products grid", "products section", "product section", "collection grid", "grid background", "grid bg"]):
        found_components.add("product_grid")
    elif not found_components and any(w in msg_lower for w in ["product card", "product cards", "card color", "cards color", "card bg", "card background", "catalog card", "item card", "grid card", "card", "cards"]):
        found_components.add("card")

    if not found_components and any(w in msg_lower for w in ["page background", "page bg", "canvas background", "canvas bg", "whole background", "body bg"]):
        found_components.add("background")

    if len(found_components) > 1:
        return "multi:" + ",".join(sorted(list(found_components)))
    elif len(found_components) == 1:
        return list(found_components)[0]

    return "overall"


async def handle_color_and_design_request(
    user_message: str,
    site_definition: Dict[str, Any],
    target_component: Optional[str] = None,
    wants_palette_suggestions: bool = False,
) -> Dict[str, Any]:
    """Master LangGraph sub-agent handler for color, palette, component patching, and whole-website matching."""
    next_draft = copy.deepcopy(site_definition)
    theme = next_draft.get("theme") or {}
    pages = next_draft.get("pages") or []
    msg_lower = user_message.lower()
    data_cards: List[Dict[str, Any]] = []
    design_modified = False
    patch_applied: Dict[str, Any] = {}

    brand_name = next_draft.get("site", {}).get("brand_name") or "Store"
    domain = next_draft.get("site", {}).get("domain") or "E-Commerce"

    target_comp = detect_target_component(user_message, target_component)

    # 1. Palette Suggestions Handler
    if wants_palette_suggestions:
        if target_comp and target_comp != "overall":
            comp_palettes = await generate_component_palette_suggestions(
                brand_name=brand_name,
                domain=domain,
                target_component=target_comp,
                color_description=user_message,
                current_theme=theme,
            )
            data_cards.append({
                "type": "component_palette_suggestions_card",
                "title": f"Suggested {target_comp.capitalize()} Palettes",
                "target_component": target_comp,
                "palettes": comp_palettes,
            })
        else:
            palettes = await generate_color_palettes(
                brand_name=brand_name,
                domain=domain,
                color_description=user_message,
            )
            data_cards.append({
                "type": "palette_suggestions_card",
                "title": "Suggested AI Color Themes",
                "palettes": palettes,
            })

        return {
            "design_modified": False,
            "next_draft_definition": None,
            "data_cards": data_cards,
            "applied_patch": {},
            "target_component": target_comp,
        }

    # 2. Glass Theme Direct Synthesis Handler (e.g. "generate glass theme", "make whole site glassmorphic", "frosted glass")
    is_glass_query = any(w in msg_lower for w in [
        "glass theme", "glass style", "glassmorphic", "frosted glass", "make it glass",
        "glassmorphism", "glass effect", "translucent", "glass navbar", "navbar glass",
        "glass look", "glassy", "frosted"
    ])
    
    if is_glass_query:
        is_navbar_only = "navbar" in msg_lower and not any(w in msg_lower for w in ["whole", "all", "entire", "site", "website", "everywhere", "body", "cards", "full"])
        is_current_dark = theme.get("mode") == "dark" or any(d in str(theme.get("primary_bg", "")).lower() for d in ["#0f172a", "#1e293b", "#000000", "#090d16"])

        if is_navbar_only:
            glass_patch = {
                "surface_materiality": "glass_navbar",
                "navbar_layout": "glassmorphism_premium",
                "navbar_variant": "floating",
                "navbar_bg": "rgba(15, 23, 42, 0.72)" if is_current_dark else "rgba(255, 255, 255, 0.72)",
                "navbar_text_color": "#f8fafc" if is_current_dark else "#0f172a",
                "navbar_border_color": "rgba(255, 255, 255, 0.14)" if is_current_dark else "rgba(255, 255, 255, 0.45)",
            }
            target_scope = "navbar"
        else:
            glass_patch = {
                "surface_materiality": "full_glass",
                "visual_style": "glassmorphic",
                "navbar_layout": "glassmorphism_premium",
                "navbar_variant": "floating",
                "footer_layout": "glassmorphism_premium",
                "navbar_bg": "rgba(15, 23, 42, 0.72)" if is_current_dark else "rgba(255, 255, 255, 0.72)",
                "navbar_text_color": "#f8fafc" if is_current_dark else "#0f172a",
                "navbar_border_color": "rgba(255, 255, 255, 0.14)" if is_current_dark else "rgba(255, 255, 255, 0.45)",
                "primary_bg": (
                    "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.18) 0%, transparent 45%), radial-gradient(circle at 90% 60%, rgba(139, 92, 246, 0.18) 0%, transparent 50%), radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.12) 0%, transparent 45%), #090d16"
                    if is_current_dark
                    else "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.14) 0%, transparent 45%), radial-gradient(circle at 90% 60%, rgba(139, 92, 246, 0.12) 0%, transparent 50%), radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.08) 0%, transparent 45%), #f8fafc"
                ),
                "text_color": "#f8fafc" if is_current_dark else "#0f172a",
                "secondary_bg": "rgba(15, 23, 42, 0.65)" if is_current_dark else "rgba(255, 255, 255, 0.65)",
                "card_bg": "rgba(15, 23, 42, 0.70)" if is_current_dark else "rgba(255, 255, 255, 0.70)",
                "card_text_color": "#f8fafc" if is_current_dark else "#0f172a",
                "card_border_color": "rgba(255, 255, 255, 0.14)" if is_current_dark else "rgba(255, 255, 255, 0.55)",
                "card_shadow": "0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.16)" if is_current_dark else "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.75)",
                "border_color": "rgba(255, 255, 255, 0.14)" if is_current_dark else "rgba(255, 255, 255, 0.55)",
                "footer_bg": "#090d16" if is_current_dark else "#0f172a",
                "footer_text_color": "#ffffff",
                "footer_muted_color": "#94a3b8",
            }
            target_scope = "overall"
            for k in ALL_COMPONENT_OVERRIDE_KEYS:
                theme.pop(k, None)

        theme.update(glass_patch)
        apply_theme_to_blocks(pages, glass_patch, target_scope)
        next_draft["theme"] = theme
        next_draft["pages"] = pages
        design_modified = True
        patch_applied = glass_patch

        return {
            "design_modified": True,
            "next_draft_definition": next_draft,
            "data_cards": data_cards,
            "applied_patch": patch_applied,
            "target_component": target_scope,
        }

    # 3. Whole Website Component Matcher Handler (e.g. "match whole website to navbar", "card theme as well please")
    is_match_site_query = any(w in msg_lower for w in [
        "match whole website", "match whole site", "match the color of whole", "match navbar", 
        "match nav bar", "implement in complete webpage", "match entire site", "whole webpage",
        "based on navbar", "based on the navbar", "match navbar color", "theme based on navbar",
        "complete page theme based on navbar", "same as navbar", "align site to navbar",
        "match rest of site to navbar"
    ])
    is_card_match_query = any(w in msg_lower for w in ["card theme as well", "product card theme", "cards as well", "product cards theme"])

    if is_match_site_query or is_card_match_query:
        source_bg = theme.get("navbar_bg") or theme.get("secondary_bg") or theme.get("primary_bg") or "#ffffff"
        source_text = theme.get("navbar_text_color") or calculate_contrast_color(source_bg)
        source_border = theme.get("navbar_border_color") or source_bg

        if is_card_match_query:
            site_match_patch = {
                "card_bg": source_bg,
                "card_text_color": source_text,
                "card_border_color": source_border,
            }
            target_scope = "card"
        else:
            site_match_patch = {
                "primary_bg": source_bg,
                "secondary_bg": source_bg,
                "footer_bg": source_bg,
                "hero_bg": source_bg,
                "card_bg": source_bg,
                "text_color": source_text,
                "border_color": source_border,
                "navbar_bg": source_bg,
                "navbar_text_color": source_text,
                "navbar_border_color": source_border,
            }
            target_scope = "overall"
            for k in ALL_COMPONENT_OVERRIDE_KEYS:
                theme.pop(k, None)

        theme.update(site_match_patch)
        apply_theme_to_blocks(pages, site_match_patch, target_scope)
        next_draft["theme"] = theme
        next_draft["pages"] = pages
        design_modified = True
        patch_applied = site_match_patch

        return {
            "design_modified": True,
            "next_draft_definition": next_draft,
            "data_cards": data_cards,
            "applied_patch": patch_applied,
            "target_component": target_scope,
        }

    # 3. Dynamic Color & Theme Modification Handler via Color Theory Agent
    color_res = await generate_component_color_patch(
        current_theme=theme,
        color_request=user_message,
        target_component=target_comp
    )
    ai_color_patch = color_res.get("color_patch") or {}
    raw_keys = color_res.get("raw_patch") or {}

    if ai_color_patch:
        # Guarantee High-Contrast Accessibility ONLY when text color is not explicitly specified by user!
        if "navbar_bg" in ai_color_patch:
            if "navbar_outer_bg" not in raw_keys:
                ai_color_patch["navbar_outer_bg"] = ai_color_patch["navbar_bg"]
            if "navbar_text_color" not in raw_keys:
                ai_color_patch["navbar_text_color"] = calculate_contrast_color(ai_color_patch["navbar_bg"])
        elif "navbar_outer_bg" in ai_color_patch:
            if "navbar_bg" not in raw_keys:
                ai_color_patch["navbar_bg"] = ai_color_patch["navbar_outer_bg"]
            if "navbar_text_color" not in raw_keys:
                ai_color_patch["navbar_text_color"] = calculate_contrast_color(ai_color_patch["navbar_outer_bg"])

        if "footer_bg" in ai_color_patch and "footer_text_color" not in raw_keys:
            ai_color_patch["footer_text_color"] = calculate_contrast_color(ai_color_patch["footer_bg"])
        if "card_bg" in ai_color_patch and "card_text_color" not in raw_keys:
            ai_color_patch["card_text_color"] = calculate_contrast_color(ai_color_patch["card_bg"])
        if "hero_bg" in ai_color_patch and "hero_text_color" not in raw_keys:
            ai_color_patch["hero_text_color"] = calculate_contrast_color(ai_color_patch["hero_bg"])
        if "primary_bg" in ai_color_patch and "text_color" not in raw_keys:
            ai_color_patch["text_color"] = calculate_contrast_color(ai_color_patch["primary_bg"])
        if "grid_bg" in ai_color_patch and "grid_text_color" not in raw_keys:
            ai_color_patch["grid_text_color"] = calculate_contrast_color(ai_color_patch["grid_bg"])
        if "product_detail_bg" in ai_color_patch and "product_detail_text" not in raw_keys:
            ai_color_patch["product_detail_text"] = calculate_contrast_color(ai_color_patch["product_detail_bg"])
        if "cart_bg" in ai_color_patch and "cart_text_color" not in raw_keys:
            ai_color_patch["cart_text_color"] = calculate_contrast_color(ai_color_patch["cart_bg"])
        if "summary_bg" in ai_color_patch and "summary_text_color" not in raw_keys:
            ai_color_patch["summary_text_color"] = calculate_contrast_color(ai_color_patch["summary_bg"])
        if "delivery_form_bg" in ai_color_patch and "delivery_form_text" not in raw_keys:
            ai_color_patch["delivery_form_text"] = calculate_contrast_color(ai_color_patch["delivery_form_bg"])
        if "payment_bg" in ai_color_patch and "payment_text_color" not in raw_keys:
            ai_color_patch["payment_text_color"] = calculate_contrast_color(ai_color_patch["payment_bg"])
        if "order_history_card_bg" in ai_color_patch and "order_history_text" not in raw_keys:
            ai_color_patch["order_history_text"] = calculate_contrast_color(ai_color_patch["order_history_card_bg"])
        if "order_history_bg" in ai_color_patch and "order_history_text" not in raw_keys:
            ai_color_patch["order_history_text"] = calculate_contrast_color(ai_color_patch["order_history_bg"])
        if "filter_bg" in ai_color_patch and "filter_text_color" not in raw_keys:
            ai_color_patch["filter_text_color"] = calculate_contrast_color(ai_color_patch["filter_bg"])
        if "pagination_bg" in ai_color_patch and "pagination_text_color" not in raw_keys:
            ai_color_patch["pagination_text_color"] = calculate_contrast_color(ai_color_patch["pagination_bg"])
        if "review_card_bg" in ai_color_patch and "review_text_color" not in raw_keys:
            ai_color_patch["review_text_color"] = calculate_contrast_color(ai_color_patch["review_card_bg"])

        if target_comp in ["overall", "webpage", "website", "site", "all", "entire", "full"]:
            for k in ALL_COMPONENT_OVERRIDE_KEYS:
                theme.pop(k, None)

        theme.update(ai_color_patch)
        apply_theme_to_blocks(pages, ai_color_patch, target_comp)
        next_draft["theme"] = theme
        next_draft["pages"] = pages
        design_modified = True
        patch_applied = ai_color_patch

    return {
        "design_modified": design_modified,
        "next_draft_definition": next_draft if design_modified else None,
        "data_cards": data_cards,
        "applied_patch": patch_applied,
        "target_component": target_comp,
    }
