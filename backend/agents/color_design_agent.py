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
    name: str = Field(description="Crisp 2-3 word name, e.g. Rose Gold Velvet, Midnight Emerald")
    description: str = Field(description="Strictly ultra-short 1-sentence design note (MAX 6-10 words, e.g. 'Warm organic yellows with fresh vibrant accents.'). NEVER write multi-sentence marketing paragraphs.")
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
    palettes: List[PaletteOption] = Field(description="List of distinct, WCAG AA compliant color palette options")


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
    return rgb_to_hex(int(round(r * 255)), int(round(g * 255)), int(round(b * 255)))


def get_relative_luminance(hex_str: str) -> float:
    r, g, b = hex_to_rgb(hex_str)
    def srgb_channel(c: int) -> float:
        val = c / 255.0
        return val / 12.92 if val <= 0.03928 else ((val + 0.055) / 1.055) ** 2.4
    return 0.2126 * srgb_channel(r) + 0.7152 * srgb_channel(g) + 0.0722 * srgb_channel(b)


def is_color_dark(hex_str: str) -> bool:
    """Returns True if the hex color has relative luminance < 0.35 (dark background)."""
    try:
        return get_relative_luminance(hex_str) < 0.35
    except Exception:
        return False


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


def ensure_accessible_contrast(text_hex: Optional[str], bg_hex: str, min_ratio: float = 4.5) -> str:
    """
    Guarantees WCAG AA readability with zero camouflage:
    - If the provided text_hex passes the contrast threshold (>= min_ratio:1), keeps the rich designer shade (e.g. warm charcoal, rich slate, espresso).
    - If it fails (< min_ratio:1), automatically selects a guaranteed high-contrast tone (#0f172a or #ffffff) to prevent any camouflage.
    """
    if not text_hex or not isinstance(text_hex, str) or not text_hex.strip():
        return calculate_contrast_color(bg_hex)

    t_clean = text_hex.strip()
    b_clean = str(bg_hex or "").strip()

    try:
        if re.search(r"#[0-9a-fA-F]{3,6}", t_clean) and re.search(r"#[0-9a-fA-F]{3,6}", b_clean):
            t_hex = re.search(r"#[0-9a-fA-F]{3,6}", t_clean).group(0)
            b_hex = re.search(r"#[0-9a-fA-F]{3,6}", b_clean).group(0)
            ratio = calculate_contrast_ratio(t_hex, b_hex)
            if ratio >= min_ratio:
                return t_clean
    except Exception:
        pass
    return calculate_contrast_color(bg_hex)


def sanitize_accent_color(accent_hex: Optional[str], is_dark: bool = False) -> str:
    """Guarantees the accent color is a vibrant, distinct brand color and never stark black/dark charcoal."""
    if not accent_hex or not isinstance(accent_hex, str) or not accent_hex.strip():
        return "#3b82f6" if is_dark else "#2563eb"
    
    clean = accent_hex.strip().lower()
    banned_blacks = {"#000000", "#0f172a", "#09090b", "#020617", "#111827", "#18181b", "#1c1917", "#0a0a0a"}
    if clean in banned_blacks:
        return "#3b82f6" if is_dark else "#2563eb"
    
    try:
        if re.search(r"#[0-9a-fA-F]{3,6}", clean):
            h, s, l = hex_to_hsl(re.search(r"#[0-9a-fA-F]{3,6}", clean).group(0))
            # If saturation is nearly zero on very dark lightness, it's an unstyled monochrome dark neutral
            if s < 0.15 and l < 0.25:
                return "#3b82f6" if is_dark else "#2563eb"
    except Exception:
        pass

    return accent_hex.strip()


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
creative_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.85, request_timeout=20, max_retries=2)


async def generate_color_palettes(
    brand_name: str = "Store",
    domain: str = "E-Commerce",
    color_description: Optional[str] = None,
    session_id: Optional[str] = None,
    count: int = 3,
) -> List[Dict[str, Any]]:
    """Generates 3 (default) or more WCAG AA compliant, highly creative color palettes based on brand description and domain."""
    from agents.token_tracker import TokenCostCallback

    # Determine target count: default is 3 to save tokens; boost to 5 if user asks for more/all
    desc_lower = str(color_description or "").lower()
    more_keywords = ["more", "5", "five", "all", "extra", "many", "refresh", "different options", "more options"]
    target_count = 5 if any(k in desc_lower for k in more_keywords) else count

    option_lines = [
        "1. OPTION 1 (Light Studio Minimal): Crisp alabaster/white primary_bg (#ffffff, #fffbf7), floating navbar, vivid action accent buttons.",
        "2. OPTION 2 (Deep Dark Luxury): Rich obsidian/midnight primary_bg (e.g. #0c0a14, #0f172a), elevated card_bg container, dark navbar.",
        "3. OPTION 3 (Warm Tinted / Earthy Editorial): Soft organic linen/oat/blush primary_bg (e.g. #faf7f2, #fdf4f4), natural toned navbar.",
    ]
    if target_count > 3:
        option_lines.append("4. OPTION 4 (Bold High-Contrast Neo-Modern): Striking contrast header with saturated CTA accents.")
    if target_count > 4:
        option_lines.append("5. OPTION 5 (Vibrant Gradient / Atmospheric): Dynamic gradient hero_bg and luminous accents.")

    options_text = "\n  ".join(option_lines)

    palette_prompt = ChatPromptTemplate.from_messages([
        ("system", f"""You are a world-class color theory director for luxury, boutique, and modern e-commerce brands (inspired by Stripe, Apple, Aesop, Nike, Linear, and high-end design systems).
Your job is to craft exactly {target_count} DISTINCT, SOPHISTICATED, and WCAG AA compliant color palettes tailored specifically to the user's brand name, niche/domain, and aesthetic preference.

CREATIVE DESIGN & SHADE HARMONY GUIDELINES:
- Generate exactly {target_count} diverse, distinct design directions:
  {options_text}

- TONAL SOPHISTICATION & RICH SHADES:
  - Avoid crude stark #000000 or generic primary colors. Use refined, designer-grade tones (e.g. rich warm charcoals #1c1917, deep slate #0f172a, midnight navy #0a0f1d, espresso #1c1411, soft warm ivory #fdfbf7, crisp zinc #fafafa).
  - Secondary containers & subtle borders: Use harmonizing tints (e.g. #f4f4f5, #f5f3ef, #18181b) that elevate product cards and give natural visual depth.
  - Buttons & CTAs: Provide vibrant, premium action accents with coordinated hover states and crisp high-contrast text.
  - ZERO CAMOUFLAGE: Ensure text_color, muted_text, navbar_text_color, footer_text_color, and card_text_color all maintain strong contrast (WCAG AA 4.5:1+) against their respective background surfaces.
- PRODUCT CARDS: Always give `card_bg` an elevated, distinctive surface hex that harmonizes with the brand palette.
- STRICT BREVITY: Every palette `description` MUST be strictly under 10 words (e.g. 'Warm earthy hues with fresh organic vibrancy.'). Never write lengthy multi-sentence marketing paragraphs."""),
        ("user", "Brand: {brand_name}\nDomain/Niche: {domain}\nSpecific Vibe/Request: {color_description}\nTarget Count: {target_count}"),
    ])

    try:
        structured_llm = palette_prompt | creative_llm.with_structured_output(PaletteResponse, method="function_calling")
        res: PaletteResponse = await structured_llm.ainvoke(
            {
                "brand_name": brand_name,
                "domain": domain,
                "color_description": color_description or "Modern clean minimalist",
                "target_count": target_count,
            },
            config={"callbacks": [TokenCostCallback("ColorAgent.PaletteGenerator", session_id=session_id)]}
        )
        output_palettes = []
        for p in res.palettes:
            p_dict = p.model_dump()
            is_dark_palette = is_color_dark(p_dict.get("primary_bg", "#ffffff"))

            # Guard against black / stark dark neutrals becoming the interactive accent
            p_dict["accent_color"] = sanitize_accent_color(p_dict.get("accent_color"), is_dark=is_dark_palette)
            if not p_dict.get("accent_hover"):
                try:
                    ah, as_, al = hex_to_hsl(p_dict["accent_color"])
                    p_dict["accent_hover"] = hsl_to_hex(ah, as_, max(0.2, al - 0.08 if not is_dark_palette else al + 0.08))
                except Exception:
                    p_dict["accent_hover"] = p_dict["accent_color"]

            # Smart WCAG AA contrast preservation: keeps designer shades, eliminates camouflage
            if "primary_bg" in p_dict:
                p_dict["text_color"] = ensure_accessible_contrast(p_dict.get("text_color"), p_dict["primary_bg"], min_ratio=4.5)
                if p_dict.get("muted_text"):
                    p_dict["muted_text"] = ensure_accessible_contrast(p_dict.get("muted_text"), p_dict["primary_bg"], min_ratio=3.0)
            if "navbar_bg" in p_dict:
                p_dict["navbar_text_color"] = ensure_accessible_contrast(p_dict.get("navbar_text_color"), p_dict["navbar_bg"], min_ratio=4.5)
                if not p_dict.get("navbar_outer_bg"):
                    p_dict["navbar_outer_bg"] = p_dict["navbar_bg"]
            if "footer_bg" in p_dict:
                p_dict["footer_text_color"] = ensure_accessible_contrast(p_dict.get("footer_text_color"), p_dict["footer_bg"], min_ratio=4.5)
                if p_dict.get("footer_muted_color"):
                    p_dict["footer_muted_color"] = ensure_accessible_contrast(p_dict.get("footer_muted_color"), p_dict["footer_bg"], min_ratio=3.0)
            if "hero_bg" in p_dict:
                p_dict["hero_text_color"] = ensure_accessible_contrast(p_dict.get("hero_text_color"), p_dict["hero_bg"], min_ratio=4.5)
            if "card_bg" in p_dict:
                p_dict["card_text_color"] = ensure_accessible_contrast(p_dict.get("card_text_color"), p_dict["card_bg"], min_ratio=4.5)
            if "accent_color" in p_dict:
                p_dict["accent_text"] = ensure_accessible_contrast(p_dict.get("accent_text"), p_dict["accent_color"], min_ratio=4.5)
            
            # Ensure borders are never missing or invisible
            if not p_dict.get("border_color"):
                p_dict["border_color"] = "rgba(255, 255, 255, 0.14)" if is_dark_palette else "#e2e8f0"
            if not p_dict.get("soft_border"):
                p_dict["soft_border"] = "rgba(255, 255, 255, 0.08)" if is_dark_palette else "#f1f5f9"

            output_palettes.append(p_dict)
        return output_palettes
    except Exception as e:
        print("Error generating palettes:", e)
        return []


class CustomToken(BaseModel):
    key: str = Field(description="Token key name e.g. 'cart_card_bg'")
    value: str = Field(description="Token value hex or string e.g. '#1e293b'")


class ColorPatchOutput(BaseModel):
    """Structured high-efficiency output for universal component styling and design patches."""
    # Global
    primary_bg: Optional[str] = Field(default=None, description="Primary store background hex")
    secondary_bg: Optional[str] = Field(default=None, description="Secondary container background hex")
    text_color: Optional[str] = Field(default=None, description="Primary text hex")
    muted_text: Optional[str] = Field(default=None, description="Muted or secondary text hex")
    border_color: Optional[str] = Field(default=None, description="Border divider hex or rgba")
    accent_color: Optional[str] = Field(default=None, description="CTA or active button accent hex")

    # Navbar
    navbar_bg: Optional[str] = Field(default=None, description="Navbar background hex")
    navbar_text_color: Optional[str] = Field(default=None, description="Navbar text hex")
    navbar_border_color: Optional[str] = Field(default=None, description="Navbar border hex")

    # Footer
    footer_bg: Optional[str] = Field(default=None, description="Footer background hex")
    footer_text_color: Optional[str] = Field(default=None, description="Footer text hex")
    footer_muted_color: Optional[str] = Field(default=None, description="Footer muted text hex")
    footer_border_color: Optional[str] = Field(default=None, description="Footer border hex")

    # Hero / Banner
    hero_bg: Optional[str] = Field(default=None, description="Hero background hex")
    hero_text_color: Optional[str] = Field(default=None, description="Hero text hex")
    hero_accent: Optional[str] = Field(default=None, description="Hero button accent hex")

    # Sections / Carousels / Product Grid
    outer_bg_color: Optional[str] = Field(default=None, description="Section backdrop background hex")
    grid_bg: Optional[str] = Field(default=None, description="Grid / Carousel container background hex")
    title_color: Optional[str] = Field(default=None, description="Section header / title text hex")
    subtitle_color: Optional[str] = Field(default=None, description="Section subtitle text hex")
    grid_text_color: Optional[str] = Field(default=None, description="Grid section title / header text hex")

    # Cards / Tiles / Product Boxes
    card_bg: Optional[str] = Field(default=None, description="Inner card, box, or tile background hex")
    card_bg_color: Optional[str] = Field(default=None, description="Inner card or tile background hex")
    card_text_color: Optional[str] = Field(default=None, description="Inner card or item title text hex")
    card_border_color: Optional[str] = Field(default=None, description="Inner card, box, or tile border hex")
    product_name_color: Optional[str] = Field(default=None, description="Product title text hex")
    price_color: Optional[str] = Field(default=None, description="Product price text hex")
    rating_star_color: Optional[str] = Field(default=None, description="Rating star icon hex")
    badge_bg_color: Optional[str] = Field(default=None, description="Tile badge background hex")
    badge_text_color: Optional[str] = Field(default=None, description="Tile badge text hex")

    # Cart / Checkout / Forms
    cart_bg: Optional[str] = Field(default=None, description="Cart sidebar background hex")
    cart_card_bg: Optional[str] = Field(default=None, description="Cart item card background hex")
    cart_text_color: Optional[str] = Field(default=None, description="Cart text hex")
    cart_accent_color: Optional[str] = Field(default=None, description="Cart checkout button hex")
    cart_border_color: Optional[str] = Field(default=None, description="Cart border hex")
    summary_bg: Optional[str] = Field(default=None, description="Order summary card background hex")
    summary_card_bg: Optional[str] = Field(default=None, description="Order summary item card background hex")
    delivery_form_bg: Optional[str] = Field(default=None, description="Delivery form background hex")
    delivery_form_input_bg: Optional[str] = Field(default=None, description="Delivery form input field background hex")
    payment_bg: Optional[str] = Field(default=None, description="Payment options card background hex")
    payment_card_bg: Optional[str] = Field(default=None, description="Payment option pill background hex")
    filter_bg: Optional[str] = Field(default=None, description="Filter toolbar background hex")
    filter_card_bg: Optional[str] = Field(default=None, description="Filter modal/drawer background hex")
    pagination_bg: Optional[str] = Field(default=None, description="Pagination container background hex")
    pagination_active_bg: Optional[str] = Field(default=None, description="Active page pill accent hex")
    pagination_text_color: Optional[str] = Field(default=None, description="Pagination text hex")
    pagination_border_color: Optional[str] = Field(default=None, description="Pagination border hex")

    # Materiality & Styling
    surface_materiality: Optional[str] = Field(default=None, description="'full_glass', 'glass_navbar', or 'solid'")
    visual_style: Optional[str] = Field(default=None, description="'glassmorphic', 'solid_clean', etc.")

    # Dimensions (Populate ONLY if user explicitly asked for radius/padding/spacing changes)
    border_radius: Optional[int] = Field(default=None, description="Corner radius in px")
    card_radius: Optional[int] = Field(default=None, description="Card corner radius in px (0 for boxy/sharp)")
    card_padding: Optional[int] = Field(default=None, description="Card padding in px")
    card_shadow: Optional[str] = Field(default=None, description="Card elevation shadow ('none' for flat)")
    grid_gap: Optional[int] = Field(default=None, description="Grid gap spacing in px")

    # Generic fallbacks
    bg_color: Optional[str] = Field(default=None, description="General background hex")
    custom_tokens: Optional[List[CustomToken]] = Field(default=None, description="Any specific component tokens")


class HeroSlideGeneratorOutput(BaseModel):
    """Structured output for generating rich promotional hero banner slides."""
    variant: str = Field(default="standard", description="One of: 'standard' (classic hero banner), 'product_launch' (showcase banner with product preview card), 'minimal_brand' (luxury clean branding with trust badges), or 'flash_sale' (high-urgency sale with live countdown timer)")
    headline: str = Field(description="High-converting headline copy for this banner (clean, professional, no emoji spam)")
    subheadline: Optional[str] = Field(default=None, description="Clear, engaging subheadline copy")
    badge: Optional[str] = Field(default=None, description="Promotional pill badge text (e.g. 'DIWALI FESTIVE OFFER', 'PRE-ORDER EXCLUSIVE', 'FEATURED ARRIVAL')")
    coupon_code: Optional[str] = Field(default=None, description="Coupon/promo code if requested e.g. 'DIWALI25'")
    has_countdown_timer: bool = Field(default=False, description="True ONLY IF the user explicitly asked for a timer, countdown clock, or starts/ends in deadline")
    sale_countdown_type: Optional[str] = Field(default="ends_in", description="'ends_in' for active sale deadline, or 'starts_in' for upcoming launch")
    product_card_title: Optional[str] = Field(default=None, description="Featured product name for product_launch showcase card")
    product_card_price: Optional[str] = Field(default=None, description="Featured product price (e.g. '₹1,999')")
    product_card_original_price: Optional[str] = Field(default=None, description="Featured product original strikethrough price")
    trust_badges: Optional[List[str]] = Field(default=None, description="List of trust badges for minimal_brand e.g. ['Free Express Delivery', '100% Genuine', 'Easy 30-Day Returns']")
    primary_cta_label: str = Field(default="Shop Now", description="Primary action button text (e.g. 'Pre-Order Now', 'Claim 25% Off', 'Explore Collection')")
    primary_cta_href: str = Field(default="/#products", description="Button target link e.g. '/product/slug' or '/#products'")
    secondary_cta_label: Optional[str] = Field(default=None, description="Secondary button text e.g. 'View Catalog'")
    secondary_cta_href: Optional[str] = Field(default=None, description="Secondary button link e.g. '/#categories'")
    background_color: Optional[str] = Field(default=None, description="Slide background color or gradient hex")
    background_overlay: Optional[str] = Field(default="rgba(0,0,0,0.35)", description="CSS overlay shade for text readability")
    text_color: Optional[str] = Field(default="#ffffff", description="Headline and subtext color hex")
    accent_color: Optional[str] = Field(default="#f59e0b", description="CTA button accent color hex")


# Comprehensive Component Scoping Map covering all storefront sections
COMPONENT_ALLOWED_KEYS = {
    "navbar": {"navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color", "border_color", "background_color", "text_color", "accent_color", "navbar_variant", "navbar_height", "navbar_padding_x", "cart_badge_bg", "cart_badge_text", "surface_materiality", "navbar_layout", "visual_style"},
    "footer": {"footer_bg", "footer_text_color", "footer_muted_color", "footer_border_color", "border_color", "background_color", "text_color", "muted_text", "footer_padding_y", "footer_max_width", "footer_layout"},
    "hero": {"hero_bg", "hero_text_color", "hero_accent", "hero_headline", "hero_subheadline", "hero_badge", "hero_cta_text", "hero_cta_href", "hero_image_fit", "banner_height", "border_radius", "size", "border_color", "background_color", "text_color", "accent_color"},
    "hero_banner": {"hero_bg", "hero_text_color", "hero_accent", "hero_headline", "hero_subheadline", "hero_badge", "hero_cta_text", "hero_cta_href", "hero_image_fit", "banner_height", "border_radius", "size", "border_color", "background_color", "text_color", "accent_color"},
    "banner": {"hero_bg", "hero_text_color", "hero_accent", "hero_headline", "hero_subheadline", "hero_badge", "hero_cta_text", "hero_cta_href", "hero_image_fit", "banner_height", "border_radius", "size", "border_color", "background_color", "text_color", "accent_color"},
    "product_grid": {"grid_bg", "grid_text_color", "title_color", "text_color", "muted_text", "outer_bg_color", "border_color", "background_color", "accent_color", "grid_gap", "image_aspect_ratio", "image_fit", "image_bg", "card_bg", "card_bg_color", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "image_radius", "product_name_color", "price_color", "original_price_color", "rating_star_color"},
    "carousel": {"grid_bg", "grid_text_color", "title_color", "text_color", "muted_text", "outer_bg_color", "border_color", "background_color", "accent_color", "grid_gap", "image_aspect_ratio", "image_fit", "image_bg", "card_bg", "card_bg_color", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "image_radius", "product_name_color", "price_color", "original_price_color", "rating_star_color"},
    "product_carousel": {"grid_bg", "grid_text_color", "title_color", "text_color", "muted_text", "outer_bg_color", "border_color", "background_color", "accent_color", "grid_gap", "image_aspect_ratio", "image_fit", "image_bg", "card_bg", "card_bg_color", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "image_radius", "product_name_color", "price_color", "original_price_color", "rating_star_color"},
    "category": {"outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_border_color", "border_color", "background_color", "card_radius", "card_shadow", "title_color", "subtitle_color", "card_text_color", "grid_text_color", "text_color", "muted_text", "accent_color", "badge_bg_color", "badge_text_color"},
    "category_grid": {"outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_border_color", "border_color", "background_color", "card_radius", "card_shadow", "title_color", "subtitle_color", "card_text_color", "grid_text_color", "text_color", "muted_text", "accent_color", "badge_bg_color", "badge_text_color", "grid_gap"},
    "section_group_carousel": {"outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_border_color", "border_color", "background_color", "card_radius", "card_shadow", "card_padding", "title_color", "subtitle_color", "card_title_color", "card_text_color", "grid_text_color", "text_color", "muted_text", "accent_color", "badge_bg_color", "badge_text_color"},
    "card": {"card_bg", "card_bg_color", "card_text_color", "card_border_color", "border_color", "background_color", "card_shadow", "card_radius", "card_padding", "image_aspect_ratio", "image_fit", "image_bg", "image_radius", "product_name_color", "price_color", "original_price_color", "rating_star_color", "text_color", "muted_text", "accent_color"},
    "product_card": {"card_bg", "card_bg_color", "card_text_color", "card_border_color", "border_color", "background_color", "card_shadow", "card_radius", "card_padding", "image_aspect_ratio", "image_fit", "image_bg", "image_radius", "product_name_color", "price_color", "original_price_color", "rating_star_color", "text_color", "muted_text", "accent_color"},
    "product_detail": {"product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text", "product_detail_padding", "product_detail_radius", "border_color", "background_color", "text_color", "secondary_bg", "accent_color", "image_aspect_ratio", "image_fit"},
    "cart": {"cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color", "cart_radius", "cart_padding"},
    "order_summary": {"summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color", "summary_radius", "summary_padding"},
    "delivery_form": {"delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text", "delivery_form_radius", "delivery_form_padding", "border_color", "background_color", "text_color", "accent_color"},
    "payment": {"payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color", "payment_radius", "payment_padding"},
    "place_order": {"place_order_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text", "border_color", "background_color", "text_color", "accent_color", "place_order_radius", "place_order_btn_height"},
    "filter": {"filter_modal_bg", "filter_modal_text", "filter_btn_bg", "filter_btn_text", "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color", "filter_radius", "filter_padding"},
    "sort": {"sort_btn_bg", "sort_btn_text", "pagination_bg", "pagination_text_color", "border_color", "background_color", "text_color", "accent_color"},
    "sort_by": {"sort_btn_bg", "sort_btn_text", "border_color", "background_color", "text_color", "accent_color"},
    "pagination": {"pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color", "pagination_radius", "pagination_padding", "background_color", "text_color", "border_color", "accent_color"},
    "order_history": {"order_history_bg", "order_history_card_bg", "order_history_text", "order_history_muted_text", "order_history_border", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "muted_text", "order_history_radius"},
    "checkout": {"checkout_bg", "checkout_card_bg", "checkout_text_color", "checkout_accent_color", "delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text", "delivery_form_radius", "delivery_form_padding", "place_order_btn_bg", "place_order_btn_text", "place_order_radius", "place_order_btn_height", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color"},
    "review": {"review_card_bg", "review_text_color", "review_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "review_card_radius", "review_padding"},
    "support": {"support_bg", "support_card_bg", "support_chat_bg", "support_accent_color", "support_customer_bubble_bg", "support_customer_bubble_text", "support_agent_bubble_bg", "support_agent_bubble_text", "support_text_color", "support_muted_text", "support_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "muted_text", "accent_color"},
    "customer_support": {"support_bg", "support_card_bg", "support_chat_bg", "support_accent_color", "support_customer_bubble_bg", "support_customer_bubble_text", "support_agent_bubble_bg", "support_agent_bubble_text", "support_text_color", "support_muted_text", "support_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "muted_text", "accent_color"},
    "notification": {"notification_drawer_bg", "notification_drawer_text", "navbar_notification_icon_variant", "visual_style", "border_color", "background_color", "text_color", "accent_color"},
    "profile": {"profile_dropdown_bg", "profile_dropdown_text", "navbar_account_icon_variant", "visual_style", "border_color", "background_color", "text_color", "accent_color"},
    "background": {"primary_bg", "secondary_bg", "text_color", "muted_text"},
}

COMPONENT_ALIASES = {
    # Navbar
    "navbar": "navbar", "nav": "navbar", "nav bar": "navbar", "navigation": "navbar",
    "navigation bar": "navbar", "top navigation": "navbar", "top navigation bar": "navbar",
    "top bar": "navbar", "topbar": "navbar", "header": "navbar", "brand bar": "navbar",
    "header menu": "navbar", "cart badge": "navbar", "brand title": "navbar",

    # Footer
    "footer": "footer", "foot": "footer", "bottom bar": "footer", "footer bar": "footer",
    "copyright": "footer", "copyright bar": "footer",

    # Hero Banner
    "hero": "hero", "banner": "hero", "hero banner": "hero", "hero slider": "hero",
    "slideshow": "hero", "billboard": "hero", "slider": "hero", "slide": "hero",

    # Product Grid
    "product_grid": "product_grid", "product grid": "product_grid", "products grid": "product_grid",
    "catalog grid": "product_grid", "collection grid": "product_grid", "products section": "product_grid",
    "grid background": "product_grid",

    # Product Carousel
    "product_carousel": "product_carousel", "product carousel": "product_carousel",
    "product slider": "product_carousel", "product row": "product_carousel", "products carousel": "product_carousel",

    # Generic Carousel (covers both product carousel and section group carousel)
    "carousel": "multi:product_carousel,section_group_carousel",
    "carousels": "multi:product_carousel,section_group_carousel",
    "crowsel": "multi:product_carousel,section_group_carousel",
    "crowser": "multi:product_carousel,section_group_carousel",
    "carosel": "multi:product_carousel,section_group_carousel",
    "carousal": "multi:product_carousel,section_group_carousel",
    "caoursel": "multi:product_carousel,section_group_carousel",
    "coursel": "multi:product_carousel,section_group_carousel",

    # Section Group Carousel
    "section_group_carousel": "section_group_carousel", "section group carousel": "section_group_carousel",
    "section carousel": "section_group_carousel", "category carousel": "section_group_carousel",
    "category slider": "section_group_carousel", "group carousel": "section_group_carousel",

    # Category Grid
    "category_grid": "category_grid", "category grid": "category_grid", "categories grid": "category_grid",
    "category": "category_grid", "categories": "category_grid", "category showcase": "category_grid",
    "category boxes": "category_grid", "category tiles": "category_grid", "category icons": "category_grid",

    # Card
    "card": "card", "cards": "card", "product card": "card", "product cards": "card",
    "catalog card": "card", "item card": "card", "product box": "card", "product boxes": "card",

    # Product Detail
    "product_detail": "product_detail", "product detail": "product_detail",
    "product page": "product_detail", "detail page": "product_detail", "details page": "product_detail",
    "pdp": "product_detail", "product details": "product_detail",

    # Cart
    "cart": "cart", "shopping cart": "cart", "cart drawer": "cart", "cart sidebar": "cart",
    "cart modal": "cart", "basket": "cart", "bag": "cart", "slideout cart": "cart",

    # Order Summary
    "order_summary": "order_summary", "order summary": "order_summary",
    "checkout summary": "order_summary", "cart summary": "order_summary",
    "bill card": "order_summary", "price breakdown": "order_summary",

    # Delivery Form
    "delivery_form": "delivery_form", "delivery form": "delivery_form",
    "shipping form": "delivery_form", "shipping details": "delivery_form",
    "delivery address": "delivery_form", "address form": "delivery_form",

    # Payment
    "payment": "payment", "payment method": "payment", "payment methods": "payment",
    "payment options": "payment", "payment pills": "payment", "payment selector": "payment",

    # Place Order
    "place_order": "place_order", "place order": "place_order",
    "place order button": "place_order", "checkout button": "place_order", "place order cta": "place_order",

    # Filter
    "filter": "filter", "filters": "filter", "filter bar": "filter", "filter toolbar": "filter",
    "filter modal": "filter", "filter sidebar": "filter", "filter drawer": "filter", "filter theme": "filter",

    # Sort
    "sort": "sort", "sort by": "sort", "sorting": "sort", "sort dropdown": "sort",

    # Pagination
    "pagination": "pagination", "page numbers": "pagination", "pagination bar": "pagination",
    "pager": "pagination", "paging": "pagination", "pagination buttons": "pagination",
    "pagination pills": "pagination", "page selector": "pagination", "page controls": "pagination",
    "page switcher": "pagination", "pagination controls": "pagination", "pagination theme": "pagination",

    # Order History
    "order_history": "order_history", "order history": "order_history", "orders page": "order_history",
    "my orders": "order_history", "orders list": "order_history", "order card": "order_history",

    # Support
    "support": "support", "help and support": "support", "customer support": "support",
    "help desk": "support", "support desk": "support", "support chat": "support", "ticket": "support",

    # Notification
    "notification": "notification", "notifications": "notification", "notification drawer": "notification",
    "notification dropdown": "notification", "notification bell": "notification", "bell icon": "notification",

    # Profile
    "profile": "profile", "account": "profile", "profile dropdown": "profile", "account dropdown": "profile",
    "profile menu": "profile", "account menu": "profile", "customer profile": "profile",

    # Background (explicit page canvas targets only)
    "page background": "background", "canvas": "background",
    "body bg": "background", "page bg": "background",
    "store background": "background", "website background": "background",
    "site background": "background", "body background": "background",
    "whole background": "background", "entire background": "background",
}

# Exact storefront block types each block-scoped component renders as.
# Values are normalized (lowercase, no underscores/dashes/spaces). Block-scoped
# components are styled ONLY through their own block props, never through the
# shared global theme, so one section can never bleed into another.
BLOCK_SCOPED_TARGETS = {
    "product_grid": {"productgrid"},
    "product_carousel": {"productcarousel"},
    "carousel": {"productcarousel"},
    "section_group_carousel": {"sectiongroupcarousel", "categorystorycarousel"},
    "category_grid": {"categorygrid"},
    "category": {"categorygrid"},
    "card": {"productgrid", "productcarousel"},
    "product_card": {"productgrid", "productcarousel"},
}

# Phrases that genuinely mean the full-page canvas (vs. "carousel background").
PAGE_BACKGROUND_PHRASES = [
    "page background", "site background", "store background", "body background",
    "website background", "whole background", "entire background", "page bg", "body bg", "canvas",
]


def _norm_block_type(block_type: Any) -> str:
    return str(block_type or "").lower().replace("_", "").replace("-", "").replace(" ", "")

GLOBAL_THEME_ALLOWED_KEYS = {
    "primary_bg", "secondary_bg", "text_color", "muted_text", "muted_text_color", "soft_text_color",
    "accent_color", "accent_hover", "accent_text",
    "border_color", "soft_border", "dialog_bg",
    "profile_dropdown_bg", "profile_dropdown_text", "notification_drawer_bg", "notification_drawer_text",
    "filter_modal_bg", "filter_modal_text", "filter_btn_bg", "filter_btn_text", "sort_btn_bg", "sort_btn_text",
    "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color", "navbar_variant", "navbar_height", "navbar_padding_x",
    "navbar_notification_icon_variant", "navbar_account_icon_variant",
    "footer_bg", "footer_text_color", "footer_muted_color", "footer_border_color", "footer_padding_y", "footer_max_width",
    "hero_bg", "hero_text_color", "hero_accent", "banner_height", "border_radius", "size",
    "card_bg", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "grid_gap",
    "image_aspect_ratio", "image_fit", "image_bg", "image_radius",
    "festival_theme", "mode"
}


async def generate_hero_banner_slide(
    user_message: str,
    brand_name: str,
    current_theme: Dict[str, Any],
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a structured HeroSlide dictionary based on natural language user prompts."""
    import datetime
    from agents.token_tracker import TokenCostCallback
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an elite e-commerce creative director creating high-end, premium storefront banners.
Choose the BEST layout variant for the user's goal:
1. 'flash_sale': ONLY when user explicitly asks for a timer, countdown, deadline, or flash sale.
2. 'product_launch': When user asks to feature a pre-order, new product, or upcoming arrival with a showcase product card.
3. 'minimal_brand': For clean luxury branding, brand values, or trust guarantees.
4. 'standard': For general promotions, festive sales, coupons, and seasonal offers without a countdown clock.

Style Guidelines: Keep copy clean, polished, and professional without emoji spam."""),
        ("user", "Brand: {brand_name}\nCurrent Theme: {current_theme}\nUser Request: {user_message}"),
    ])
    try:
        chain = prompt | creative_llm.with_structured_output(HeroSlideGeneratorOutput, method="function_calling")
        res: HeroSlideGeneratorOutput = await chain.ainvoke(
            {
                "brand_name": brand_name,
                "current_theme": json.dumps(current_theme),
                "user_message": user_message,
            },
            config={"callbacks": [TokenCostCallback("HeroBanner.SlideGenerator", session_id=session_id)]}
        )
        import re
        import uuid
        slide_id = f"slide-{uuid.uuid4().hex[:8]}"
        user_msg_clean = user_message.lower()

        # Fallback coupon extraction if LLM missed it
        coupon_code = (res.coupon_code or "").strip()
        if not coupon_code:
            coupon_match = re.search(r'(?:coupon|code|promo|voucher)\s*[:=]?\s*([A-Za-z0-9_\-]+)', user_message, re.IGNORECASE)
            if coupon_match:
                coupon_code = coupon_match.group(1).upper()

        # Check explicit user intents
        user_wants_minimal = any(w in user_msg_clean for w in [
            "minimal", "minimalist", "brand identity", "brand values", "trust badge", "guarantee", "guarantees", "authentic", 
            "shipping", "delivery", "lifestyle", "story", "about us"
        ])
        user_wants_product_launch = any(w in user_msg_clean for w in [
            "launch", "pre-order", "preorder", "showcase", "new product", "new arrival", "featured product"
        ])
        explicit_timer_requested = any(w in user_msg_clean for w in [
            "timer", "countdown", "ends in", "starts in", "ending in", "starting in", 
            "expires in", "hours left", "days left", "clock", "begins in", "launching in"
        ])
        user_wants_flash_sale = any(w in user_msg_clean for w in [
            "flash sale", "flash-sale", "lightning deal", "urgent sale", "limited time deal"
        ])

        # Resolve variant and timer strictly based on intent & LLM classification
        if user_wants_flash_sale or explicit_timer_requested:
            resolved_variant = "flash_sale"
            has_timer = True
        elif user_wants_product_launch:
            resolved_variant = "product_launch"
            has_timer = False
        elif user_wants_minimal:
            resolved_variant = "minimal_brand"
            has_timer = False
        else:
            resolved_variant = res.variant if res.variant in ["standard", "minimal_brand", "product_launch", "flash_sale"] else "standard"
            if resolved_variant == "flash_sale" and not explicit_timer_requested:
                resolved_variant = "standard"
            has_timer = bool(explicit_timer_requested)
        
        now = datetime.datetime.now(datetime.timezone.utc)
        
        # Parse custom durations (e.g. "3 days", "24 hours", "2 days", etc.)
        duration_days = 3
        duration_hours = 0
        days_match = re.search(r'(\d+)\s*day', user_msg_clean)
        hours_match = re.search(r'(\d+)\s*hour', user_msg_clean)
        if days_match:
            try:
                duration_days = int(days_match.group(1))
            except Exception:
                pass
        elif hours_match:
            try:
                duration_hours = int(hours_match.group(1))
                duration_days = 0
            except Exception:
                pass

        is_starts_in = any(w in user_msg_clean for w in ["starts in", "starting in", "begins in", "launching in", "countdown to start", "starts on", "live in"])
        countdown_type = "starts_in" if is_starts_in else (res.sale_countdown_type or "ends_in")

        target_delta = datetime.timedelta(days=duration_days, hours=duration_hours) if (duration_days > 0 or duration_hours > 0) else datetime.timedelta(days=3)

        if countdown_type == "starts_in":
            sale_start_iso = (now + target_delta).isoformat()
            sale_end_iso = (now + target_delta + datetime.timedelta(days=3)).isoformat()
        else:
            sale_start_iso = now.isoformat()
            sale_end_iso = (now + target_delta).isoformat()

        slide_dict: Dict[str, Any] = {
            "id": slide_id,
            "variant": resolved_variant,
            "headline": res.headline,
            "subheadline": res.subheadline or "",
            "badge": res.badge or "",
            "coupon_code": coupon_code,
            "sale_countdown_type": countdown_type if has_timer else None,
            "sale_start_time": sale_start_iso if has_timer else None,
            "sale_end_time": sale_end_iso if has_timer else None,
            "show_countdown": has_timer,
            "primary_cta": {
                "label": res.primary_cta_label or "Shop Now",
                "href": res.primary_cta_href or "/#products",
                "show": True,
                "style": "solid",
            },
            "show_primary_cta": True,
            "background_color": res.background_color or current_theme.get("hero_bg") or "#0f172a",
            "background_overlay": res.background_overlay or "rgba(0,0,0,0.3)",
            "text_color": res.text_color or "#ffffff",
            "accent_color": res.accent_color or current_theme.get("accent_color") or "#3b82f6",
            "image_fit": "cover",
            "image_zoom": 1.0,
            "text_alignment": "left",
        }

        # Populate secondary CTA if present
        if res.secondary_cta_label:
            slide_dict["secondary_cta"] = {
                "label": res.secondary_cta_label,
                "href": res.secondary_cta_href or "/#categories",
                "show": True,
            }
            slide_dict["show_secondary_cta"] = True

        # Populate product_card for product_launch variant
        if resolved_variant == "product_launch":
            slide_dict["product_card"] = {
                "title": res.product_card_title or res.headline,
                "price": res.product_card_price or "Featured",
                "original_price": res.product_card_original_price or "",
                "rating": "5.0 ⭐",
                "product_href": res.primary_cta_href or "/#products",
            }

        # Populate trust_badges for minimal_brand variant
        if resolved_variant == "minimal_brand":
            slide_dict["trust_badges"] = res.trust_badges or ["Free Express Delivery", "100% Authentic Guarantee", "24/7 VIP Support"]

        return slide_dict
    except Exception as e:
        print("Error in generate_hero_banner_slide:", e)
        return {
            "id": f"slide-fallback",
            "variant": "standard",
            "headline": "Special Promotional Offer",
            "subheadline": "Explore our curated collection of premium essentials.",
            "badge": "EXCLUSIVE OFFER",
            "coupon_code": "",
            "show_countdown": False,
            "primary_cta": {"label": "Shop Now", "href": "/#products", "show": True, "style": "solid"},
            "show_primary_cta": True,
            "background_color": "#0f172a",
            "text_color": "#ffffff",
            "accent_color": "#3b82f6",
            "image_fit": "cover",
        }


async def generate_component_color_patch(
    current_theme: Dict[str, Any],
    color_request: str,
    target_component: str = "overall",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a component color patch matching user color requests using structured output."""
    from agents.token_tracker import TokenCostCallback
    
    # Filter current_theme to only relevant keys to minimize token footprint
    target_lower = (target_component or "overall").lower().strip()
    allowed_keys_for_target = set(COMPONENT_ALLOWED_KEYS.get(target_lower, set()))
    if target_lower.startswith("multi:"):
        sub_targets = [t.strip() for t in target_lower.split("multi:")[1].split(",") if t.strip()]
        for st in sub_targets:
            allowed_keys_for_target.update(COMPONENT_ALLOWED_KEYS.get(st, set()))

    filtered_theme: Dict[str, Any] = {}
    for k in ["primary_bg", "text_color", "accent_color", "border_color", "mode", "visual_style", "surface_materiality"]:
        if k in current_theme:
            filtered_theme[k] = current_theme[k]
    for k in allowed_keys_for_target:
        if k in current_theme:
            filtered_theme[k] = current_theme[k]

    patch_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert design systems engineer and color theory specialist for modern e-commerce.
Generate a WCAG AA compliant design patch for the target component based strictly on the user's request.

RULES:
1. REQUEST FIDELITY: Populate ONLY the attributes the user explicitly asked for.
   - For carousels/grids/sections: "background" means the section background (outer_bg_color / grid_bg). "card/box/tile background" means card_bg / card_bg_color.
   - For cards: "background" means card_bg.
2. DIMENSION SAFETY: NEVER modify card_radius, border_radius, padding, or gap unless the user explicitly requested size/radius/padding changes.
3. THEME HARMONY: If a full theme is requested (e.g. "dark charcoal theme"), ensure all elements belong to the same requested color family.
4. CONTRAST: Always pair dark backgrounds with light text (#ffffff) and light backgrounds with dark text (#0f172a).
5. GLASSMORPHISM: If user asks for glass, frosted glass, or glassmorphism, set visual_style='glassmorphic' and surface_materiality='full_glass'."""),
        ("user", "Target Component: {target_component}\nCurrent Theme: {current_theme}\nRequest: {color_request}"),
    ])

    try:
        structured_chain = patch_prompt | llm.with_structured_output(ColorPatchOutput, method="function_calling")
        result: ColorPatchOutput = await structured_chain.ainvoke(
            {
                "current_theme": json.dumps(filtered_theme),
                "target_component": target_component,
                "color_request": color_request,
            },
            config={"callbacks": [TokenCostCallback("ColorAgent.ComponentPatch", session_id=session_id)]}
        )
        raw_patch = {k: v for k, v in result.model_dump().items() if v is not None}
        if "custom_tokens" in raw_patch and isinstance(raw_patch["custom_tokens"], list):
            for item in raw_patch["custom_tokens"]:
                if isinstance(item, dict) and item.get("key") and item.get("value"):
                    raw_patch.setdefault(item["key"], item["value"])
                elif hasattr(item, "key") and hasattr(item, "value"):
                    raw_patch.setdefault(item.key, item.value)
            del raw_patch["custom_tokens"]
        target_lower = target_component.lower().strip()

        # Intelligent remapping for specific components if LLM emitted generalized keys
        has_text_color = raw_patch.get("text_color")
        if has_text_color:
            if "product_carousel" in target_lower or "carousel" in target_lower:
                raw_patch.setdefault("grid_text_color", has_text_color)
                raw_patch.setdefault("title_color", has_text_color)
                raw_patch.setdefault("product_name_color", has_text_color)
                raw_patch.setdefault("card_text_color", has_text_color)
            if "section_group_carousel" in target_lower:
                raw_patch.setdefault("title_color", has_text_color)
                raw_patch.setdefault("grid_text_color", has_text_color)
                raw_patch.setdefault("card_text_color", has_text_color)
                raw_patch.setdefault("card_title_color", has_text_color)
            if "category_grid" in target_lower or "category" in target_lower:
                raw_patch.setdefault("title_color", has_text_color)
                raw_patch.setdefault("card_text_color", has_text_color)
            if "card" in target_lower:
                raw_patch.setdefault("card_text_color", has_text_color)
                raw_patch.setdefault("product_name_color", has_text_color)
            if "product_grid" in target_lower:
                raw_patch.setdefault("grid_text_color", has_text_color)
                raw_patch.setdefault("title_color", has_text_color)
                raw_patch.setdefault("card_text_color", has_text_color)
                raw_patch.setdefault("product_name_color", has_text_color)
            if target_lower in ["navbar", "nav"]:
                raw_patch.setdefault("navbar_text_color", has_text_color)
            if target_lower in ["footer", "foot"]:
                raw_patch.setdefault("footer_text_color", has_text_color)

        has_border_color = raw_patch.get("border_color")
        if has_border_color:
            if "navbar" in target_lower or "nav" in target_lower:
                raw_patch.setdefault("navbar_border_color", has_border_color)
            if "footer" in target_lower or "foot" in target_lower:
                raw_patch.setdefault("footer_border_color", has_border_color)
            if any(t in target_lower for t in ["product_carousel", "section_group_carousel", "category_grid", "card", "product_card", "product_grid", "carousel"]):
                raw_patch.setdefault("card_border_color", has_border_color)
            if "cart" in target_lower:
                raw_patch.setdefault("cart_border_color", has_border_color)
            if "filter" in target_lower:
                raw_patch.setdefault("filter_border_color", has_border_color)
            if "pagination" in target_lower:
                raw_patch.setdefault("pagination_border_color", has_border_color)
            if "order_summary" in target_lower or "summary" in target_lower:
                raw_patch.setdefault("summary_border_color", has_border_color)
            if "payment" in target_lower:
                raw_patch.setdefault("payment_border_color", has_border_color)
            if "review" in target_lower:
                raw_patch.setdefault("review_border_color", has_border_color)
            if "support" in target_lower:
                raw_patch.setdefault("support_border_color", has_border_color)

        has_bg_color = raw_patch.get("bg_color") or raw_patch.get("background_color") or raw_patch.get("bg")
        if has_bg_color:
            if "navbar" in target_lower or "nav" in target_lower:
                raw_patch.setdefault("navbar_bg", has_bg_color)
            if "footer" in target_lower or "foot" in target_lower:
                raw_patch.setdefault("footer_bg", has_bg_color)
            if "hero" in target_lower or "banner" in target_lower:
                raw_patch.setdefault("hero_bg", has_bg_color)
            if any(t in target_lower for t in ["product_carousel", "section_group_carousel", "category_grid", "product_grid", "carousel", "category"]):
                raw_patch.setdefault("outer_bg_color", has_bg_color)
                raw_patch.setdefault("grid_bg", has_bg_color)
            if "card" in target_lower or "product_card" in target_lower:
                raw_patch.setdefault("card_bg", has_bg_color)
                raw_patch.setdefault("card_bg_color", has_bg_color)
            if "cart" in target_lower:
                raw_patch.setdefault("cart_bg", has_bg_color)
            if "filter" in target_lower:
                raw_patch.setdefault("filter_bg", has_bg_color)
            if "pagination" in target_lower:
                raw_patch.setdefault("pagination_bg", has_bg_color)
            if "order_summary" in target_lower or "summary" in target_lower:
                raw_patch.setdefault("summary_bg", has_bg_color)
            if "payment" in target_lower:
                raw_patch.setdefault("payment_bg", has_bg_color)

        has_muted_text = raw_patch.get("muted_text") or raw_patch.get("secondary_text") or raw_patch.get("footer_muted_color") or raw_patch.get("order_history_muted_text") or raw_patch.get("support_muted_text")
        if has_muted_text:
            if "footer" in target_lower or "foot" in target_lower:
                raw_patch.setdefault("footer_muted_color", has_muted_text)
            if "support" in target_lower:
                raw_patch.setdefault("support_muted_text", has_muted_text)
            if "order_history" in target_lower:
                raw_patch.setdefault("order_history_muted_text", has_muted_text)
            if any(t in target_lower for t in ["category", "category_grid", "section_group_carousel"]):
                raw_patch.setdefault("subtitle_color", has_muted_text)
            if target_lower in ["overall", "webpage", "website", "site", "background"]:
                raw_patch.setdefault("muted_text", has_muted_text)

        has_card_bg = raw_patch.get("card_bg") or raw_patch.get("card_bg_color")
        if has_card_bg:
            if any(t in target_lower for t in ["product_carousel", "section_group_carousel", "category_grid", "card", "product_card", "product_grid", "carousel", "category"]):
                raw_patch.setdefault("card_bg", has_card_bg)
                raw_patch.setdefault("card_bg_color", has_card_bg)
            if "cart" in target_lower:
                raw_patch.setdefault("cart_card_bg", has_card_bg)
            if "order_summary" in target_lower or "summary" in target_lower:
                raw_patch.setdefault("summary_card_bg", has_card_bg)
            if "payment" in target_lower:
                raw_patch.setdefault("payment_card_bg", has_card_bg)
            if "review" in target_lower:
                raw_patch.setdefault("review_card_bg", has_card_bg)
            if "support" in target_lower:
                raw_patch.setdefault("support_card_bg", has_card_bg)
            if "order_history" in target_lower:
                raw_patch.setdefault("order_history_card_bg", has_card_bg)

        has_accent = raw_patch.get("accent_color") or raw_patch.get("btn_bg") or raw_patch.get("button_bg")
        if has_accent:
            if "hero" in target_lower or "banner" in target_lower:
                raw_patch.setdefault("hero_accent", has_accent)
            if "cart" in target_lower:
                raw_patch.setdefault("cart_accent_color", has_accent)
            if "order_summary" in target_lower or "summary" in target_lower:
                raw_patch.setdefault("summary_accent_color", has_accent)
            if "payment" in target_lower:
                raw_patch.setdefault("payment_accent_color", has_accent)
            if "place_order" in target_lower:
                raw_patch.setdefault("place_order_btn_bg", has_accent)
            if "filter" in target_lower:
                raw_patch.setdefault("filter_accent_color", has_accent)
                raw_patch.setdefault("filter_btn_bg", has_accent)
            if "product_detail" in target_lower:
                raw_patch.setdefault("product_detail_btn_bg", has_accent)
            if "support" in target_lower:
                raw_patch.setdefault("support_accent_color", has_accent)
            if "pagination" in target_lower:
                raw_patch.setdefault("pagination_active_bg", has_accent)

        if "section_group_carousel" in target_lower:
            if raw_patch.get("title_color"):
                raw_patch.setdefault("card_text_color", raw_patch["title_color"])
                raw_patch.setdefault("card_title_color", raw_patch["title_color"])
            elif raw_patch.get("card_text_color"):
                raw_patch.setdefault("title_color", raw_patch["card_text_color"])
                raw_patch.setdefault("card_title_color", raw_patch["card_text_color"])
            elif raw_patch.get("grid_text_color"):
                raw_patch.setdefault("title_color", raw_patch["grid_text_color"])
                raw_patch.setdefault("card_text_color", raw_patch["grid_text_color"])

        if "product_carousel" in target_lower or "carousel" in target_lower:
            if raw_patch.get("grid_text_color"):
                raw_patch.setdefault("title_color", raw_patch["grid_text_color"])
                raw_patch.setdefault("product_name_color", raw_patch["grid_text_color"])
                raw_patch.setdefault("card_text_color", raw_patch["grid_text_color"])
            elif raw_patch.get("title_color"):
                raw_patch.setdefault("grid_text_color", raw_patch["title_color"])
                raw_patch.setdefault("product_name_color", raw_patch["title_color"])
                raw_patch.setdefault("card_text_color", raw_patch["title_color"])
            elif raw_patch.get("product_name_color"):
                raw_patch.setdefault("grid_text_color", raw_patch["product_name_color"])
                raw_patch.setdefault("title_color", raw_patch["product_name_color"])
                raw_patch.setdefault("card_text_color", raw_patch["product_name_color"])
            elif raw_patch.get("card_text_color"):
                raw_patch.setdefault("grid_text_color", raw_patch["card_text_color"])
                raw_patch.setdefault("title_color", raw_patch["card_text_color"])
                raw_patch.setdefault("product_name_color", raw_patch["card_text_color"])

        if target_lower in ["profile", "account"]:
            if not raw_patch.get("profile_dropdown_bg"):
                for k in ["dialog_bg", "card_bg", "secondary_bg", "primary_bg", "navbar_bg"]:
                    if raw_patch.get(k):
                        raw_patch["profile_dropdown_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("profile_dropdown_text"):
                for k in ["text_color", "card_text_color", "accent_text", "navbar_text_color", "accent_color"]:
                    if raw_patch.get(k):
                        raw_patch["profile_dropdown_text"] = raw_patch[k]
                        break

        elif target_lower in ["notification", "notifications"]:
            if not raw_patch.get("notification_drawer_bg"):
                for k in ["dialog_bg", "card_bg", "secondary_bg", "primary_bg", "navbar_bg"]:
                    if raw_patch.get(k):
                        raw_patch["notification_drawer_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("notification_drawer_text"):
                for k in ["text_color", "card_text_color", "accent_text", "navbar_text_color", "accent_color"]:
                    if raw_patch.get(k):
                        raw_patch["notification_drawer_text"] = raw_patch[k]
                        break

        elif target_lower in ["filter", "filters"]:
            if not raw_patch.get("filter_modal_bg"):
                for k in ["filter_bg", "dialog_bg", "secondary_bg", "card_bg"]:
                    if raw_patch.get(k):
                        raw_patch["filter_modal_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("filter_modal_text"):
                for k in ["filter_text_color", "text_color", "card_text_color"]:
                    if raw_patch.get(k):
                        raw_patch["filter_modal_text"] = raw_patch[k]
                        break

        elif target_lower in ["sort", "sort_by"]:
            if not raw_patch.get("sort_btn_bg"):
                for k in ["filter_btn_bg", "accent_color", "secondary_bg", "card_bg"]:
                    if raw_patch.get(k):
                        raw_patch["sort_btn_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("sort_btn_text"):
                for k in ["filter_btn_text", "accent_text", "text_color"]:
                    if raw_patch.get(k):
                        raw_patch["sort_btn_text"] = raw_patch[k]
                        break

        elif target_lower in ["card", "product_card"]:
            if not raw_patch.get("card_text_color"):
                for k in ["product_name_color", "text_color", "accent_text"]:
                    if raw_patch.get(k):
                        raw_patch["card_text_color"] = raw_patch[k]
                        break
            if not raw_patch.get("card_bg"):
                for k in ["secondary_bg", "primary_bg"]:
                    if raw_patch.get(k):
                        raw_patch["card_bg"] = raw_patch[k]
                        break

        elif target_lower in ["product_detail"]:
            if not raw_patch.get("product_detail_bg"):
                for k in ["secondary_bg", "card_bg", "primary_bg"]:
                    if raw_patch.get(k):
                        raw_patch["product_detail_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("product_detail_text"):
                for k in ["text_color", "card_text_color"]:
                    if raw_patch.get(k):
                        raw_patch["product_detail_text"] = raw_patch[k]
                        break

        elif target_lower in ["cart"]:
            if not raw_patch.get("cart_bg"):
                for k in ["secondary_bg", "dialog_bg", "primary_bg"]:
                    if raw_patch.get(k):
                        raw_patch["cart_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("cart_text_color"):
                for k in ["text_color", "card_text_color"]:
                    if raw_patch.get(k):
                        raw_patch["cart_text_color"] = raw_patch[k]
                        break

        elif target_lower in ["pagination", "pager", "paging"]:
            if not raw_patch.get("pagination_bg"):
                for k in ["primary_bg", "secondary_bg", "card_bg", "background_color"]:
                    if raw_patch.get(k):
                        raw_patch["pagination_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("pagination_active_bg"):
                for k in ["accent_color", "primary_bg", "secondary_bg"]:
                    if raw_patch.get(k):
                        raw_patch["pagination_active_bg"] = raw_patch[k]
                        break
            if not raw_patch.get("pagination_text_color"):
                for k in ["text_color", "card_text_color", "accent_text"]:
                    if raw_patch.get(k):
                        raw_patch["pagination_text_color"] = raw_patch[k]
                        break
            if not raw_patch.get("pagination_border_color"):
                for k in ["border_color", "card_border_color"]:
                    if raw_patch.get(k):
                        raw_patch["pagination_border_color"] = raw_patch[k]
                        break
            if raw_patch.get("pagination_bg") and not raw_patch.get("background_color"):
                raw_patch["background_color"] = raw_patch["pagination_bg"]
            if raw_patch.get("pagination_text_color") and not raw_patch.get("text_color"):
                raw_patch["text_color"] = raw_patch["pagination_text_color"]

        if target_lower.startswith("multi:"):
            comps = target_lower.replace("multi:", "").split(",")
            allowed = set()
            for c in comps:
                allowed.update(COMPONENT_ALLOWED_KEYS.get(c, set()))
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
    "delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text", "delivery_form_radius", "delivery_form_padding",
    # order_history
    "order_history_bg", "order_history_card_bg", "order_history_text", "order_history_muted_text", "order_history_border", "order_history_radius",
    # product_detail
    "product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text", "product_detail_padding", "product_detail_radius",
    # cart
    "cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color", "cart_panel_bg", "cart_radius", "cart_padding",
    # order_summary
    "summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color", "summary_radius", "summary_padding",
    # payment
    "payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color", "payment_radius", "payment_padding",
    # place_order
    "place_order_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text", "place_order_radius", "place_order_btn_height",
    # filter
    "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color", "filter_radius", "filter_padding",
    # pagination
    "pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color", "pagination_radius", "pagination_padding",
    # review
    "review_card_bg", "review_text_color", "review_border_color", "review_card_radius", "review_padding",
    # support
    "support_bg", "support_card_bg", "support_chat_bg", "support_accent_color", "support_customer_bubble_bg", "support_customer_bubble_text", "support_agent_bubble_bg", "support_agent_bubble_text", "support_text_color", "support_muted_text", "support_border_color",
    # product_grid & card
    "grid_bg", "grid_text_color", "outer_bg_color", "card_bg", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "grid_gap",
    "image_aspect_ratio", "image_fit", "image_bg", "image_radius", "product_name_color", "price_color", "original_price_color", "rating_star_color",
    # navbar
    "navbar_variant", "navbar_height", "navbar_padding_x", "cart_badge_bg", "cart_badge_text",
    # footer
    "footer_padding_y", "footer_max_width", "footer_layout",
    # hero
    "banner_height", "border_radius", "size"
}

# Theme-level component override keys that MUST be persisted directly into theme
# so that global storefront drawers, forms, pagination bars, and panels re-render immediately.
THEME_COMPONENT_OVERRIDE_KEYS = {
    # delivery_form
    "delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text", "delivery_form_radius", "delivery_form_padding",
    # order_history
    "order_history_bg", "order_history_card_bg", "order_history_text", "order_history_muted_text", "order_history_border", "order_history_radius",
    # product_detail
    "product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text", "product_detail_padding", "product_detail_radius",
    # cart
    "cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color", "cart_panel_bg", "cart_radius", "cart_padding",
    # order_summary
    "summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color", "summary_radius", "summary_padding",
    # payment
    "payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color", "payment_radius", "payment_padding",
    # place_order
    "place_order_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text", "place_order_radius", "place_order_btn_height",
    # filter
    "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color", "filter_radius", "filter_padding", "filter_modal_bg", "filter_modal_text", "filter_btn_bg", "filter_btn_text",
    # pagination
    "pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color", "pagination_radius", "pagination_padding",
    # review
    "review_card_bg", "review_text_color", "review_border_color", "review_card_radius", "review_padding",
    # support
    "support_bg", "support_card_bg", "support_chat_bg", "support_accent_color", "support_customer_bubble_bg", "support_customer_bubble_text", "support_agent_bubble_bg", "support_agent_bubble_text", "support_text_color", "support_muted_text", "support_border_color",
    # navbar
    "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color", "navbar_variant", "navbar_height", "navbar_padding_x", "cart_badge_bg", "cart_badge_text", "surface_materiality", "navbar_layout", "visual_style",
    # footer
    "footer_bg", "footer_text_color", "footer_muted_color", "footer_border_color", "footer_padding_y", "footer_max_width", "footer_layout",
    # notification & profile
    "notification_drawer_bg", "notification_drawer_text", "profile_dropdown_bg", "profile_dropdown_text",
}


# ==========================================
# 4. STORE BLOCK STYLING UTILITIES
# ==========================================

def apply_theme_to_blocks(pages: List[Dict[str, Any]], patch_dict: Dict[str, Any], target_type: Optional[str] = None) -> List[str]:
    """Updates block props across all page definitions in-place with isolated component scoping.
    Returns a list of block types that were modified."""
    is_overall = not target_type or target_type.lower() in ["overall", "webpage", "website", "site", "all", "entire"]
    target_clean = (target_type or "").lower().strip()

    if target_clean.startswith("multi:"):
        active_targets = {t.strip() for t in target_clean[6:].split(",") if t.strip()}
    else:
        active_targets = {target_clean} if target_clean else set()

    modified_blocks: List[str] = []

    for page in pages:
        blocks = page.get("blocks") or []
        for block in blocks:
            btype = str(block.get("type") or "").lower()
            norm_btype = _norm_block_type(btype)
            bprops = block.setdefault("props", {})
            props_changed = False

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
                    if key in bprops:
                        bprops.pop(key, None)
                        props_changed = True
            else:
                # 1. Navbar, Notification, & Profile Dropdown Block Prop Sync
                if any(t in active_targets for t in ["navbar", "header", "notification", "profile"]) and ("navbar" in norm_btype or "header" in norm_btype):
                    if "navbar_bg" in patch_dict:
                        bprops["navbar_bg"] = patch_dict["navbar_bg"]
                        bprops["background_color"] = patch_dict["navbar_bg"]
                        props_changed = True
                    if "navbar_text_color" in patch_dict:
                        bprops["navbar_text_color"] = patch_dict["navbar_text_color"]
                        bprops["text_color"] = patch_dict["navbar_text_color"]
                        props_changed = True
                    if "navbar_border_color" in patch_dict:
                        bprops["navbar_border_color"] = patch_dict["navbar_border_color"]
                        props_changed = True
                    elif "border_color" in patch_dict:
                        bprops["navbar_border_color"] = patch_dict["border_color"]
                        props_changed = True
                    if "navbar_height" in patch_dict:
                        bprops["navbar_height"] = patch_dict["navbar_height"]
                        props_changed = True
                    if "navbar_padding_x" in patch_dict:
                        bprops["navbar_padding_x"] = patch_dict["navbar_padding_x"]
                        props_changed = True
                    if "navbar_variant" in patch_dict:
                        bprops["variant"] = patch_dict["navbar_variant"]
                        bprops["navbar_variant"] = patch_dict["navbar_variant"]
                        props_changed = True
                    if "cart_badge_bg" in patch_dict:
                        bprops["cart_badge_bg"] = patch_dict["cart_badge_bg"]
                        props_changed = True
                    if "cart_badge_text" in patch_dict:
                        bprops["cart_badge_text"] = patch_dict["cart_badge_text"]
                        props_changed = True
                    if "dialog_bg" in patch_dict:
                        bprops["dialog_bg"] = patch_dict["dialog_bg"]
                        props_changed = True
                    if "navbar_notification_icon_variant" in patch_dict:
                        bprops["navbar_notification_icon_variant"] = patch_dict["navbar_notification_icon_variant"]
                        props_changed = True
                    if "navbar_account_icon_variant" in patch_dict:
                        bprops["navbar_account_icon_variant"] = patch_dict["navbar_account_icon_variant"]
                        props_changed = True

                # 2. Footer Block Prop Sync
                elif "footer" in active_targets and "footer" in norm_btype:
                    if "footer_bg" in patch_dict:
                        bprops["footer_bg"] = patch_dict["footer_bg"]
                        bprops["background_color"] = patch_dict["footer_bg"]
                        props_changed = True
                    if "footer_text_color" in patch_dict:
                        bprops["footer_text_color"] = patch_dict["footer_text_color"]
                        bprops["text_color"] = patch_dict["footer_text_color"]
                        props_changed = True
                    if "footer_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["footer_border_color"]
                        props_changed = True
                    elif "border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["border_color"]
                        props_changed = True
                    if "footer_muted_color" in patch_dict:
                        bprops["footer_muted_color"] = patch_dict["footer_muted_color"]
                        props_changed = True
                    elif "muted_text" in patch_dict:
                        bprops["footer_muted_color"] = patch_dict["muted_text"]
                        props_changed = True
                    if "footer_padding_y" in patch_dict:
                        bprops["padding_y"] = patch_dict["footer_padding_y"]
                        bprops["footer_padding_y"] = patch_dict["footer_padding_y"]
                        props_changed = True
                    if "footer_max_width" in patch_dict:
                        bprops["max_width"] = patch_dict["footer_max_width"]
                        bprops["footer_max_width"] = patch_dict["footer_max_width"]
                        props_changed = True
                    if "footer_layout" in patch_dict:
                        bprops["footer_layout"] = patch_dict["footer_layout"]
                        props_changed = True

                # 2B. Hero Banner Block Prop Sync (updates existing banner slides and CTA button colors)
                elif any(t in active_targets for t in ["hero", "banner", "hero_banner"]) and ("hero" in norm_btype or "banner" in norm_btype):
                    if "hero_accent" in patch_dict or "accent_color" in patch_dict:
                        btn_color = patch_dict.get("hero_accent") or patch_dict.get("accent_color")
                        bprops["hero_accent"] = btn_color
                        bprops["accent_color"] = btn_color
                        bprops["button_bg_color"] = btn_color
                        for slide in bprops.get("slides", []):
                            if isinstance(slide, dict):
                                slide["accent_color"] = btn_color
                                if "primary_cta" in slide and isinstance(slide["primary_cta"], dict):
                                    slide["primary_cta"]["bg_color"] = btn_color
                        props_changed = True
                    if "hero_bg" in patch_dict or "background_color" in patch_dict or "bg_color" in patch_dict:
                        bg_val = patch_dict.get("hero_bg") or patch_dict.get("background_color") or patch_dict.get("bg_color")
                        bprops["hero_bg"] = bg_val
                        bprops["background_color"] = bg_val
                        for slide in bprops.get("slides", []):
                            if isinstance(slide, dict):
                                slide["background_color"] = bg_val
                        props_changed = True
                    if "hero_text_color" in patch_dict or "text_color" in patch_dict:
                        txt_val = patch_dict.get("hero_text_color") or patch_dict.get("text_color")
                        bprops["hero_text_color"] = txt_val
                        bprops["text_color"] = txt_val
                        for slide in bprops.get("slides", []):
                            if isinstance(slide, dict):
                                slide["text_color"] = txt_val
                        props_changed = True
                    if "banner_height" in patch_dict:
                        bprops["banner_height"] = patch_dict["banner_height"]
                        bprops["height"] = patch_dict["banner_height"]
                        props_changed = True
                    if "border_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["border_radius"]
                        props_changed = True

                # 3. Product Detail Page Block Prop Sync
                elif "product_detail" in active_targets and any(d in norm_btype for d in ["productdetail", "productinfo", "productgallery", "purchasepanel"]):
                    if "product_detail_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["product_detail_bg"]
                        bprops["panel_color"] = patch_dict["product_detail_bg"]
                        props_changed = True
                    if "product_detail_text" in patch_dict:
                        bprops["text_color"] = patch_dict["product_detail_text"]
                        props_changed = True
                    if "product_detail_btn_bg" in patch_dict:
                        bprops["button_bg_color"] = patch_dict["product_detail_btn_bg"]
                        props_changed = True
                    if "product_detail_btn_text" in patch_dict:
                        bprops["button_text_color"] = patch_dict["product_detail_btn_text"]
                        props_changed = True
                    if "product_detail_padding" in patch_dict:
                        bprops["padding_y"] = patch_dict["product_detail_padding"]
                        bprops["padding_x"] = patch_dict["product_detail_padding"]
                        bprops["product_detail_padding"] = patch_dict["product_detail_padding"]
                        props_changed = True
                    if "product_detail_radius" in patch_dict:
                        bprops["card_border_radius"] = patch_dict["product_detail_radius"]
                        bprops["image_border_radius"] = patch_dict["product_detail_radius"]
                        bprops["product_detail_radius"] = patch_dict["product_detail_radius"]
                        props_changed = True
                    if "image_aspect_ratio" in patch_dict:
                        bprops["image_aspect_ratio"] = patch_dict["image_aspect_ratio"]
                        props_changed = True
                    if "image_fit" in patch_dict:
                        bprops["image_fit"] = patch_dict["image_fit"]
                        props_changed = True

                # 4. Product Carousel Block Prop Sync (strictly scoped to productcarousel)
                elif norm_btype == "productcarousel" and any(t in active_targets for t in ["product_carousel", "carousel", "card", "product_card"]):
                    is_carousel_target = any(t in active_targets for t in ["product_carousel", "carousel"])
                    if is_carousel_target:
                        if "outer_bg_color" in patch_dict:
                            bprops["outer_bg_color"] = patch_dict["outer_bg_color"]
                            bprops["background_color"] = patch_dict["outer_bg_color"]
                            props_changed = True
                        elif "grid_bg" in patch_dict:
                            bprops["outer_bg_color"] = patch_dict["grid_bg"]
                            bprops["background_color"] = patch_dict["grid_bg"]
                            props_changed = True
                        if "title_color" in patch_dict:
                            bprops["title_color"] = patch_dict["title_color"]
                            props_changed = True
                        elif "grid_text_color" in patch_dict:
                            bprops["title_color"] = patch_dict["grid_text_color"]
                            props_changed = True
                        elif "text_color" in patch_dict:
                            bprops["title_color"] = patch_dict["text_color"]
                            props_changed = True
                        if "subtitle_color" in patch_dict:
                            bprops["subtitle_color"] = patch_dict["subtitle_color"]
                            props_changed = True
                        if "grid_gap" in patch_dict:
                            bprops["grid_gap"] = patch_dict["grid_gap"]
                            bprops["gap"] = patch_dict["grid_gap"]
                            props_changed = True

                    # Card tokens on product carousel
                    if "card_bg_color" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg_color"]
                        props_changed = True
                    elif "card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg"]
                        props_changed = True
                    if "card_border_color" in patch_dict:
                        bprops["card_border_color"] = patch_dict["card_border_color"]
                        props_changed = True
                    if "card_radius" in patch_dict:
                        bprops["card_radius"] = patch_dict["card_radius"]
                        props_changed = True
                    if "card_padding" in patch_dict:
                        bprops["card_padding"] = patch_dict["card_padding"]
                        bprops["padding_y"] = patch_dict["card_padding"]
                        bprops["padding_x"] = patch_dict["card_padding"]
                        props_changed = True
                    if "card_shadow" in patch_dict:
                        bprops["card_shadow"] = patch_dict["card_shadow"]
                        props_changed = True
                    if "product_name_color" in patch_dict:
                        bprops["product_name_color"] = patch_dict["product_name_color"]
                        bprops["product_title_color"] = patch_dict["product_name_color"]
                        props_changed = True
                    elif "card_text_color" in patch_dict:
                        bprops["card_text_color"] = patch_dict["card_text_color"]
                        bprops["product_name_color"] = patch_dict["card_text_color"]
                        bprops["product_title_color"] = patch_dict["card_text_color"]
                        props_changed = True
                    elif "text_color" in patch_dict:
                        bprops["card_text_color"] = patch_dict["text_color"]
                        bprops["product_name_color"] = patch_dict["text_color"]
                        bprops["product_title_color"] = patch_dict["text_color"]
                        props_changed = True
                    if "price_color" in patch_dict:
                        bprops["price_color"] = patch_dict["price_color"]
                        props_changed = True
                    if "original_price_color" in patch_dict:
                        bprops["original_price_color"] = patch_dict["original_price_color"]
                        props_changed = True
                    if "rating_star_color" in patch_dict:
                        bprops["rating_star_color"] = patch_dict["rating_star_color"]
                        props_changed = True
                    if "image_aspect_ratio" in patch_dict:
                        bprops["image_aspect_ratio"] = patch_dict["image_aspect_ratio"]
                        props_changed = True
                    if "image_fit" in patch_dict:
                        bprops["image_fit"] = patch_dict["image_fit"]
                        props_changed = True
                    if "image_bg" in patch_dict:
                        bprops["image_bg"] = patch_dict["image_bg"]
                        props_changed = True
                    if "image_radius" in patch_dict:
                        bprops["image_radius"] = patch_dict["image_radius"]
                        bprops["image_corner_radius"] = patch_dict["image_radius"]
                        props_changed = True

                # 5. Product Grid Block Prop Sync (strictly scoped to productgrid)
                elif norm_btype == "productgrid" and any(t in active_targets for t in ["product_grid", "card", "product_card"]):
                    is_grid_target = "product_grid" in active_targets
                    if is_grid_target:
                        if "outer_bg_color" in patch_dict:
                            bprops["outer_bg_color"] = patch_dict["outer_bg_color"]
                            bprops["background_color"] = patch_dict["outer_bg_color"]
                            props_changed = True
                        elif "grid_bg" in patch_dict:
                            bprops["outer_bg_color"] = patch_dict["grid_bg"]
                            bprops["background_color"] = patch_dict["grid_bg"]
                            props_changed = True
                        if "title_color" in patch_dict:
                            bprops["title_color"] = patch_dict["title_color"]
                            props_changed = True
                        elif "grid_text_color" in patch_dict:
                            bprops["title_color"] = patch_dict["grid_text_color"]
                            props_changed = True
                        elif "text_color" in patch_dict:
                            bprops["title_color"] = patch_dict["text_color"]
                            props_changed = True
                        if "subtitle_color" in patch_dict:
                            bprops["subtitle_color"] = patch_dict["subtitle_color"]
                            props_changed = True
                        if "grid_gap" in patch_dict:
                            bprops["grid_gap"] = patch_dict["grid_gap"]
                            bprops["gap"] = patch_dict["grid_gap"]
                            props_changed = True

                    # Card tokens on product grid
                    if "card_bg_color" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg_color"]
                        props_changed = True
                    elif "card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg"]
                        props_changed = True
                    if "card_border_color" in patch_dict:
                        bprops["card_border_color"] = patch_dict["card_border_color"]
                        props_changed = True
                    if "card_radius" in patch_dict:
                        bprops["card_radius"] = patch_dict["card_radius"]
                        props_changed = True
                    if "card_padding" in patch_dict:
                        bprops["card_padding"] = patch_dict["card_padding"]
                        bprops["padding_y"] = patch_dict["card_padding"]
                        bprops["padding_x"] = patch_dict["card_padding"]
                        props_changed = True
                    if "card_shadow" in patch_dict:
                        bprops["card_shadow"] = patch_dict["card_shadow"]
                        props_changed = True
                    if "product_name_color" in patch_dict:
                        bprops["product_name_color"] = patch_dict["product_name_color"]
                        bprops["product_title_color"] = patch_dict["product_name_color"]
                        props_changed = True
                    elif "card_text_color" in patch_dict:
                        bprops["card_text_color"] = patch_dict["card_text_color"]
                        bprops["product_name_color"] = patch_dict["card_text_color"]
                        bprops["product_title_color"] = patch_dict["card_text_color"]
                        props_changed = True
                    elif "text_color" in patch_dict:
                        bprops["card_text_color"] = patch_dict["text_color"]
                        bprops["product_name_color"] = patch_dict["text_color"]
                        bprops["product_title_color"] = patch_dict["text_color"]
                        props_changed = True
                    if "price_color" in patch_dict:
                        bprops["price_color"] = patch_dict["price_color"]
                        props_changed = True
                    if "original_price_color" in patch_dict:
                        bprops["original_price_color"] = patch_dict["original_price_color"]
                        props_changed = True
                    if "rating_star_color" in patch_dict:
                        bprops["rating_star_color"] = patch_dict["rating_star_color"]
                        props_changed = True
                    if "image_aspect_ratio" in patch_dict:
                        bprops["image_aspect_ratio"] = patch_dict["image_aspect_ratio"]
                        props_changed = True
                    if "image_fit" in patch_dict:
                        bprops["image_fit"] = patch_dict["image_fit"]
                        props_changed = True
                    if "image_bg" in patch_dict:
                        bprops["image_bg"] = patch_dict["image_bg"]
                        props_changed = True
                    if "image_radius" in patch_dict:
                        bprops["image_radius"] = patch_dict["image_radius"]
                        bprops["image_corner_radius"] = patch_dict["image_radius"]
                        props_changed = True

                # 6. Section Group Carousel Block Prop Sync (strictly scoped to sectiongroupcarousel)
                elif norm_btype in {"sectiongroupcarousel", "categorystorycarousel"} and any(t in active_targets for t in ["section_group_carousel", "carousel"]):
                    if "outer_bg_color" in patch_dict:
                        bprops["outer_bg_color"] = patch_dict["outer_bg_color"]
                        bprops["background_color"] = patch_dict["outer_bg_color"]
                        props_changed = True
                    elif "grid_bg" in patch_dict:
                        bprops["outer_bg_color"] = patch_dict["grid_bg"]
                        bprops["background_color"] = patch_dict["grid_bg"]
                        props_changed = True
                    if "card_bg_color" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg_color"]
                        props_changed = True
                    elif "card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg"]
                        props_changed = True
                    if "card_border_color" in patch_dict:
                        bprops["card_border_color"] = patch_dict["card_border_color"]
                        props_changed = True
                    if "card_radius" in patch_dict:
                        bprops["card_radius"] = patch_dict["card_radius"]
                        props_changed = True
                    if "card_shadow" in patch_dict:
                        bprops["card_shadow"] = patch_dict["card_shadow"]
                        props_changed = True
                    if "card_padding" in patch_dict:
                        bprops["card_padding"] = patch_dict["card_padding"]
                        props_changed = True
                    if "title_color" in patch_dict:
                        bprops["title_color"] = patch_dict["title_color"]
                        props_changed = True
                    elif "grid_text_color" in patch_dict:
                        bprops["title_color"] = patch_dict["grid_text_color"]
                        props_changed = True
                    elif "text_color" in patch_dict:
                        bprops["title_color"] = patch_dict["text_color"]
                        props_changed = True
                    if "subtitle_color" in patch_dict:
                        bprops["subtitle_color"] = patch_dict["subtitle_color"]
                        props_changed = True
                    if "card_title_color" in patch_dict:
                        bprops["card_title_color"] = patch_dict["card_title_color"]
                        props_changed = True
                    elif "card_text_color" in patch_dict:
                        bprops["card_title_color"] = patch_dict["card_text_color"]
                        props_changed = True
                    elif "text_color" in patch_dict:
                        bprops["card_title_color"] = patch_dict["text_color"]
                        props_changed = True
                    if "accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["accent_color"]
                        props_changed = True
                    if "badge_bg_color" in patch_dict:
                        bprops["badge_bg_color"] = patch_dict["badge_bg_color"]
                        props_changed = True
                    if "badge_text_color" in patch_dict:
                        bprops["badge_text_color"] = patch_dict["badge_text_color"]
                        props_changed = True
                    if "grid_gap" in patch_dict:
                        bprops["grid_gap"] = patch_dict["grid_gap"]
                        bprops["gap"] = patch_dict["grid_gap"]
                        props_changed = True
                    if "image_fit" in patch_dict:
                        bprops["image_fit"] = patch_dict["image_fit"]
                        props_changed = True
                    if "image_bg" in patch_dict:
                        bprops["image_bg"] = patch_dict["image_bg"]
                        props_changed = True

                # 7. Category Grid Block Prop Sync (strictly scoped to categorygrid)
                elif norm_btype == "categorygrid" and any(t in active_targets for t in ["category_grid", "category"]):
                    if "outer_bg_color" in patch_dict:
                        bprops["outer_bg_color"] = patch_dict["outer_bg_color"]
                        bprops["background_color"] = patch_dict["outer_bg_color"]
                        props_changed = True
                    elif "grid_bg" in patch_dict:
                        bprops["outer_bg_color"] = patch_dict["grid_bg"]
                        bprops["background_color"] = patch_dict["grid_bg"]
                        props_changed = True
                    if "card_bg_color" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg_color"]
                        props_changed = True
                    elif "card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg"]
                        props_changed = True
                    if "card_border_color" in patch_dict:
                        bprops["card_border_color"] = patch_dict["card_border_color"]
                        props_changed = True
                    if "card_radius" in patch_dict:
                        bprops["card_radius"] = patch_dict["card_radius"]
                        props_changed = True
                    if "card_shadow" in patch_dict:
                        bprops["card_shadow"] = patch_dict["card_shadow"]
                        props_changed = True
                    if "title_color" in patch_dict:
                        bprops["title_color"] = patch_dict["title_color"]
                        props_changed = True
                    elif "grid_text_color" in patch_dict:
                        bprops["title_color"] = patch_dict["grid_text_color"]
                        props_changed = True
                    elif "text_color" in patch_dict:
                        bprops["title_color"] = patch_dict["text_color"]
                        props_changed = True
                    if "card_text_color" in patch_dict:
                        bprops["card_text_color"] = patch_dict["card_text_color"]
                        props_changed = True
                    elif "text_color" in patch_dict:
                        bprops["card_text_color"] = patch_dict["text_color"]
                        props_changed = True
                    if "subtitle_color" in patch_dict:
                        bprops["subtitle_color"] = patch_dict["subtitle_color"]
                        props_changed = True
                    if "accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["accent_color"]
                        props_changed = True
                    if "border_color" in patch_dict:
                        bprops["card_border_color"] = patch_dict["border_color"]
                        props_changed = True
                    if "grid_gap" in patch_dict:
                        bprops["grid_gap"] = patch_dict["grid_gap"]
                        props_changed = True
                    if "badge_bg_color" in patch_dict:
                        bprops["badge_bg_color"] = patch_dict["badge_bg_color"]
                        props_changed = True
                    if "badge_text_color" in patch_dict:
                        bprops["badge_text_color"] = patch_dict["badge_text_color"]
                        props_changed = True

                # 8. Brand Store Grid Block Prop Sync
                elif norm_btype == "brandstoregrid" and any(t in active_targets for t in ["brand_store", "brand_store_grid"]):
                    if "outer_bg_color" in patch_dict:
                        bprops["outer_bg_color"] = patch_dict["outer_bg_color"]
                        props_changed = True
                    if "card_bg_color" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg_color"]
                        props_changed = True
                    if "card_border_color" in patch_dict:
                        bprops["card_border_color"] = patch_dict["card_border_color"]
                        props_changed = True
                    if "title_color" in patch_dict:
                        bprops["title_color"] = patch_dict["title_color"]
                        props_changed = True

                # 9. Cart / Cart Drawer Block Prop Sync
                elif "cart" in active_targets and any(k in norm_btype for k in ["cartsidebar", "cartitems", "cartview", "cart"]):
                    if "cart_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["cart_bg"]
                        bprops["panel_color"] = patch_dict["cart_bg"]
                        props_changed = True
                    if "cart_card_bg" in patch_dict:
                        bprops["card_color"] = patch_dict["cart_card_bg"]
                        props_changed = True
                    if "cart_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["cart_text_color"]
                        props_changed = True
                    if "cart_accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["cart_accent_color"]
                        props_changed = True
                    if "cart_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["cart_border_color"]
                        props_changed = True
                    if "cart_radius" in patch_dict:
                        bprops["cart_radius"] = patch_dict["cart_radius"]
                        bprops["border_radius"] = patch_dict["cart_radius"]
                        props_changed = True
                    if "cart_padding" in patch_dict:
                        bprops["cart_padding"] = patch_dict["cart_padding"]
                        bprops["padding_y"] = patch_dict["cart_padding"]
                        bprops["padding_x"] = patch_dict["cart_padding"]
                        props_changed = True

                # 10. Hero Banner / Slider Block Prop Sync
                elif any(h in norm_btype for h in ["hero", "banner", "slider"]) and any(h in active_targets for h in ["hero", "banner", "slider", "hero_banner"]):
                    if "hero_bg" in patch_dict:
                        bprops["hero_bg"] = patch_dict["hero_bg"]
                        bprops["background_color"] = patch_dict["hero_bg"]
                        props_changed = True
                    if "hero_text_color" in patch_dict:
                        bprops["hero_text_color"] = patch_dict["hero_text_color"]
                        bprops["text_color"] = patch_dict["hero_text_color"]
                        props_changed = True
                    if "hero_accent" in patch_dict:
                        bprops["hero_accent"] = patch_dict["hero_accent"]
                        bprops["accent_color"] = patch_dict["hero_accent"]
                        props_changed = True
                    if "hero_headline" in patch_dict:
                        bprops["headline"] = patch_dict["hero_headline"]
                        props_changed = True
                    if "hero_subheadline" in patch_dict:
                        bprops["subheadline"] = patch_dict["hero_subheadline"]
                        props_changed = True
                    if "hero_badge" in patch_dict:
                        bprops["badge"] = patch_dict["hero_badge"]
                        props_changed = True
                    if "hero_image_fit" in patch_dict:
                        bprops["image_fit"] = patch_dict["hero_image_fit"]
                        props_changed = True
                    if "banner_height" in patch_dict:
                        bprops["banner_height"] = patch_dict["banner_height"]
                        props_changed = True
                    if "border_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["border_radius"]
                        props_changed = True
                    if "size" in patch_dict:
                        bprops["size"] = patch_dict["size"]
                        props_changed = True

                    if isinstance(bprops.get("slides"), list) and bprops["slides"]:
                        for slide in bprops["slides"]:
                            if isinstance(slide, dict):
                                if "hero_bg" in patch_dict:
                                    slide["background_color"] = patch_dict["hero_bg"]
                                    slide["hero_bg"] = patch_dict["hero_bg"]
                                    props_changed = True
                                if "hero_text_color" in patch_dict:
                                    slide["text_color"] = patch_dict["hero_text_color"]
                                    slide["hero_text_color"] = patch_dict["hero_text_color"]
                                    props_changed = True
                                if "hero_accent" in patch_dict:
                                    slide["accent_color"] = patch_dict["hero_accent"]
                                    slide["hero_accent"] = patch_dict["hero_accent"]
                                    props_changed = True
                                if "banner_height" in patch_dict:
                                    slide["banner_height"] = patch_dict["banner_height"]
                                    props_changed = True
                                if "border_radius" in patch_dict:
                                    slide["border_radius"] = patch_dict["border_radius"]
                                    props_changed = True
                        first_slide = bprops["slides"][0]
                        if isinstance(first_slide, dict):
                            if "hero_headline" in patch_dict:
                                first_slide["headline"] = patch_dict["hero_headline"]
                                props_changed = True
                            if "hero_subheadline" in patch_dict:
                                first_slide["subheadline"] = patch_dict["hero_subheadline"]
                                props_changed = True
                            if "hero_badge" in patch_dict:
                                first_slide["badge"] = patch_dict["hero_badge"]
                                props_changed = True
                            if "hero_cta_text" in patch_dict and "primary_cta" in first_slide:
                                if isinstance(first_slide["primary_cta"], dict):
                                    first_slide["primary_cta"]["label"] = patch_dict["hero_cta_text"]
                                    props_changed = True
                            if "hero_cta_href" in patch_dict and "primary_cta" in first_slide:
                                if isinstance(first_slide["primary_cta"], dict):
                                    first_slide["primary_cta"]["href"] = patch_dict["hero_cta_href"]
                                    props_changed = True

                # 11. Review Section Block Prop Sync
                elif "review" in active_targets and any(r in norm_btype for r in ["review", "reviews", "ratings"]):
                    if "review_card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["review_card_bg"]
                        bprops["background_color"] = patch_dict["review_card_bg"]
                        props_changed = True
                    if "review_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["review_text_color"]
                        props_changed = True
                    if "review_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["review_border_color"]
                        props_changed = True
                    if "review_card_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["review_card_radius"]
                        bprops["review_card_radius"] = patch_dict["review_card_radius"]
                        props_changed = True
                    if "review_padding" in patch_dict:
                        bprops["padding_y"] = patch_dict["review_padding"]
                        bprops["padding_x"] = patch_dict["review_padding"]
                        bprops["review_padding"] = patch_dict["review_padding"]
                        props_changed = True

                # 12. Delivery Form Block Prop Sync
                elif any(d in active_targets for d in ["delivery", "delivery_form", "shipping", "address"]) and any(b in norm_btype for b in ["deliveryform", "checkoutform", "addressform"]):
                    if "delivery_form_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["delivery_form_bg"]
                        props_changed = True
                    if "delivery_form_text" in patch_dict:
                        bprops["text_color"] = patch_dict["delivery_form_text"]
                        props_changed = True
                    if "delivery_form_input_bg" in patch_dict:
                        bprops["input_color"] = patch_dict["delivery_form_input_bg"]
                        props_changed = True
                    if "delivery_form_border" in patch_dict:
                        bprops["border_color"] = patch_dict["delivery_form_border"]
                        props_changed = True
                    if "delivery_form_btn_bg" in patch_dict:
                        bprops["accentColor"] = patch_dict["delivery_form_btn_bg"]
                        props_changed = True
                    if "delivery_form_btn_text" in patch_dict:
                        bprops["button_text_color"] = patch_dict["delivery_form_btn_text"]
                        props_changed = True
                    if "delivery_form_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["delivery_form_radius"]
                        bprops["delivery_form_radius"] = patch_dict["delivery_form_radius"]
                        props_changed = True
                    if "delivery_form_padding" in patch_dict:
                        bprops["padding_y"] = patch_dict["delivery_form_padding"]
                        bprops["padding_x"] = patch_dict["delivery_form_padding"]
                        bprops["delivery_form_padding"] = patch_dict["delivery_form_padding"]
                        props_changed = True

                # 13. Order History Block Prop Sync
                elif any(o in active_targets for o in ["order_history", "orders", "my_orders", "order_card"]) and any(b in norm_btype for b in ["orderhistory", "orders", "customerorders", "orderslist"]):
                    if "order_history_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["order_history_bg"]
                        props_changed = True
                    if "order_history_card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["order_history_card_bg"]
                        props_changed = True
                    if "order_history_text" in patch_dict:
                        bprops["text_color"] = patch_dict["order_history_text"]
                        props_changed = True
                    if "order_history_border" in patch_dict:
                        bprops["border_color"] = patch_dict["order_history_border"]
                        props_changed = True
                    if "order_history_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["order_history_radius"]
                        bprops["order_history_radius"] = patch_dict["order_history_radius"]
                        props_changed = True

                # 14. Order Summary Block Prop Sync
                elif "order_summary" in active_targets and any(s in norm_btype for s in ["ordersummary", "checkoutsummary"]):
                    if "summary_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["summary_bg"]
                        bprops["panel_color"] = patch_dict["summary_bg"]
                        props_changed = True
                    if "summary_card_bg" in patch_dict:
                        bprops["card_color"] = patch_dict["summary_card_bg"]
                        props_changed = True
                    if "summary_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["summary_text_color"]
                        props_changed = True
                    if "summary_accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["summary_accent_color"]
                        props_changed = True
                    if "summary_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["summary_border_color"]
                        props_changed = True
                    if "summary_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["summary_radius"]
                        bprops["summary_radius"] = patch_dict["summary_radius"]
                        props_changed = True
                    if "summary_padding" in patch_dict:
                        bprops["padding_y"] = patch_dict["summary_padding"]
                        bprops["padding_x"] = patch_dict["summary_padding"]
                        bprops["summary_padding"] = patch_dict["summary_padding"]
                        props_changed = True

                # 15. Payment Methods Block Prop Sync
                elif "payment" in active_targets and any(p in norm_btype for p in ["paymentmethods", "payment"]):
                    if "payment_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["payment_bg"]
                        props_changed = True
                    if "payment_card_bg" in patch_dict:
                        bprops["panel_color"] = patch_dict["payment_card_bg"]
                        props_changed = True
                    if "payment_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["payment_text_color"]
                        props_changed = True
                    if "payment_accent_color" in patch_dict:
                        bprops["accentColor"] = patch_dict["payment_accent_color"]
                        props_changed = True
                    if "payment_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["payment_border_color"]
                        props_changed = True
                    if "payment_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["payment_radius"]
                        bprops["payment_radius"] = patch_dict["payment_radius"]
                        props_changed = True
                    if "payment_padding" in patch_dict:
                        bprops["padding_y"] = patch_dict["payment_padding"]
                        bprops["padding_x"] = patch_dict["payment_padding"]
                        bprops["payment_padding"] = patch_dict["payment_padding"]
                        props_changed = True

                # 16. Place Order CTA Block Prop Sync
                elif any(p in active_targets for p in ["place_order", "checkout_cta"]) and any(p in norm_btype for p in ["placeordercta", "checkoutcta"]):
                    if "place_order_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["place_order_bg"]
                        props_changed = True
                    if "place_order_btn_bg" in patch_dict:
                        bprops["accentColor"] = patch_dict["place_order_btn_bg"]
                        bprops["button_bg_color"] = patch_dict["place_order_btn_bg"]
                        props_changed = True
                    if "place_order_btn_text" in patch_dict:
                        bprops["button_text_color"] = patch_dict["place_order_btn_text"]
                        props_changed = True
                    if "place_order_text" in patch_dict:
                        bprops["text_color"] = patch_dict["place_order_text"]
                        props_changed = True
                    if "place_order_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["place_order_radius"]
                        bprops["place_order_radius"] = patch_dict["place_order_radius"]
                        props_changed = True
                    if "place_order_btn_height" in patch_dict:
                        bprops["button_height"] = patch_dict["place_order_btn_height"]
                        bprops["place_order_btn_height"] = patch_dict["place_order_btn_height"]
                        props_changed = True

                # 17. Filter Toolbar Block Prop Sync
                elif "filter" in active_targets and any(f in norm_btype for f in ["filtersidebar", "filter"]):
                    if "filter_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["filter_bg"]
                        props_changed = True
                    if "filter_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["filter_text_color"]
                        props_changed = True
                    if "filter_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["filter_border_color"]
                        props_changed = True
                    if "filter_accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["filter_accent_color"]
                        props_changed = True
                    if "filter_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["filter_radius"]
                        bprops["filter_radius"] = patch_dict["filter_radius"]
                        props_changed = True
                    if "filter_padding" in patch_dict:
                        bprops["padding_y"] = patch_dict["filter_padding"]
                        bprops["padding_x"] = patch_dict["filter_padding"]
                        bprops["filter_padding"] = patch_dict["filter_padding"]
                        props_changed = True

                # 18. Pagination Block Prop Sync
                elif "pagination" in active_targets and "pagination" in norm_btype:
                    if "pagination_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["pagination_bg"]
                        props_changed = True
                    if "pagination_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["pagination_text_color"]
                        props_changed = True
                    if "pagination_active_bg" in patch_dict:
                        bprops["active_bg_color"] = patch_dict["pagination_active_bg"]
                        props_changed = True
                    if "pagination_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["pagination_border_color"]
                        props_changed = True
                    if "pagination_radius" in patch_dict:
                        bprops["border_radius"] = patch_dict["pagination_radius"]
                        bprops["pagination_radius"] = patch_dict["pagination_radius"]
                        props_changed = True
                    if "pagination_padding" in patch_dict:
                        bprops["padding_y"] = patch_dict["pagination_padding"]
                        bprops["padding_x"] = patch_dict["pagination_padding"]
                        bprops["pagination_padding"] = patch_dict["pagination_padding"]
                        props_changed = True

                # 19. Customer Support / Help Desk Block Prop Sync
                elif any(s in active_targets for s in ["support", "customer_support", "help", "helpdesk", "chat"]) and any(b in norm_btype for b in ["support", "customersupport", "supportpage", "supportdesk", "helpdesk"]):
                    if "support_bg" in patch_dict:
                        bprops["background_color"] = patch_dict["support_bg"]
                        bprops["primary_bg"] = patch_dict["support_bg"]
                        props_changed = True
                    if "support_card_bg" in patch_dict:
                        bprops["card_bg"] = patch_dict["support_card_bg"]
                        props_changed = True
                    if "support_chat_bg" in patch_dict:
                        bprops["chat_bg"] = patch_dict["support_chat_bg"]
                        props_changed = True
                    if "support_accent_color" in patch_dict:
                        bprops["accent_color"] = patch_dict["support_accent_color"]
                        props_changed = True
                    if "support_text_color" in patch_dict:
                        bprops["text_color"] = patch_dict["support_text_color"]
                        props_changed = True
                    if "support_muted_text" in patch_dict:
                        bprops["subtext_color"] = patch_dict["support_muted_text"]
                        props_changed = True
                    if "support_border_color" in patch_dict:
                        bprops["border_color"] = patch_dict["support_border_color"]
                        props_changed = True
                    if "support_customer_bubble_bg" in patch_dict:
                        bprops["customer_bubble_bg"] = patch_dict["support_customer_bubble_bg"]
                        props_changed = True
                    if "support_customer_bubble_text" in patch_dict:
                        bprops["customer_bubble_text"] = patch_dict["support_customer_bubble_text"]
                        props_changed = True
                    if "support_agent_bubble_bg" in patch_dict:
                        bprops["agent_bubble_bg"] = patch_dict["support_agent_bubble_bg"]
                        props_changed = True
                    if "support_agent_bubble_text" in patch_dict:
                        bprops["agent_bubble_text"] = patch_dict["support_agent_bubble_text"]
                        props_changed = True

            if props_changed:
                modified_blocks.append(btype)

    return modified_blocks


# ==========================================
# 5. LANGGRAPH SUB-AGENT CHAT HANDLER
# ==========================================

def detect_target_component(user_message: str, target_component: Optional[str] = None) -> str:
    """Resolves target component with semantic-first priority from the Router LLM and strict unsupported guardrails."""
    msg_lower = user_message.lower().strip()

    unmapped_words = [
        "admin bar", "audit logs", "audit", "settings", "rider app", "rider tracking", "tax configuration", "admin panel"
    ]
    supported_words = [
        "navbar", "nav bar", "header", "footer", "hero", "banner", "slider",
        "card", "cards", "product", "products", "cart", "review", "reviews",
        "checkout", "payment", "delivery", "support", "background", "canvas", "grid",
        "notification", "notifications", "bell", "profile", "account", "navigation", "top bar"
    ]

    # 0. If user specifically asked about an unsupported dashboard element, strictly block it
    if any(u in msg_lower for u in unmapped_words) and not any(s in msg_lower for s in supported_words):
        return "unsupported"

    if target_component:
        t_clean = target_component.lower().strip()
        if t_clean == "unsupported":
            return "unsupported"
        if t_clean in ["revert", "undo"]:
            return "revert"
        if t_clean in ["banner_create", "create_banner", "add_banner"]:
            # Check if user is actually styling existing banner elements rather than creating a new one
            is_styling_existing = any(w in msg_lower for w in [
                "button color", "btn color", "button", "background", "bg", "text color", "height", "border",
                "color of banner", "color for the banner", "banner to red", "banner to blue", "banner to black",
                "existing banner", "existing banners", "style the banner", "make the button", "turn the button",
                "change the button", "modify the banner", "color of the banner"
            ]) and not any(w in msg_lower for w in ["add banner", "create banner", "new banner", "add a banner", "create a banner", "add slide", "create slide", "insert banner"])
            if is_styling_existing:
                return "hero"
            return "banner_create"
        if t_clean in ["overall", "webpage", "website", "site", "all", "entire", "full"]:
            return "overall"
        if t_clean in COMPONENT_ALIASES:
            return COMPONENT_ALIASES[t_clean]
        if t_clean in COMPONENT_ALLOWED_KEYS:
            return t_clean
        if t_clean.startswith("multi:"):
            return t_clean

    # Fallback when target_component was not provided or was generic:
    # 1. Pure Revert / Undo
    if any(w in msg_lower for w in ["undo", "revert", "restore previous", "go back", "take back"]) and not any(w in msg_lower for w in ["change", "make", "set", "color", "background", "navbar"]):
        return "revert"

    # 2. Banner Creation (ONLY when explicit creation keywords are present)
    is_explicit_banner_create = any(w in msg_lower for w in ["add banner", "create banner", "new banner", "add slide", "create slide", "add a banner", "create a banner", "insert banner", "generate banner", "add promotional slide"])
    if is_explicit_banner_create and not any(w in msg_lower for w in ["change button", "button color", "existing banner", "color of banner"]):
        return "banner_create"

    # 3. Comprehensive multi-word scan using sorted aliases (consuming matched tokens to avoid substring collisions)
    found_components = set()
    # Sort aliases longest phrase first to match specific multi-word components (e.g. "section group carousel" before "carousel")
    sorted_phrases = sorted(COMPONENT_ALIASES.keys(), key=len, reverse=True)
    consumed_text = msg_lower
    for phrase in sorted_phrases:
        pattern = r'(?:\b|^)' + re.escape(phrase) + r'(?:\b|$)'
        if re.search(pattern, consumed_text):
            found_components.add(COMPONENT_ALIASES[phrase])
            consumed_text = re.sub(pattern, " " * len(phrase), consumed_text, count=1)

    if len(found_components) > 1:
        # Only collapse 'card' if it was used as a qualifier (e.g. "category cards"), not when user explicitly targets product cards
        has_explicit_product_card = any(w in msg_lower for w in ["product card", "product cards", "catalog card", "item card"])
        if not has_explicit_product_card:
            if "category_grid" in found_components and "card" in found_components and "category card" in msg_lower:
                found_components.remove("card")
            if "product_carousel" in found_components and "card" in found_components and "carousel card" in msg_lower:
                found_components.remove("card")
        if len(found_components) == 1:
            return list(found_components)[0]
        return "multi:" + ",".join(sorted(list(found_components)))
    elif len(found_components) == 1:
        return list(found_components)[0]

    # 4. Canvas page background fallback (only when no other component was referenced)
    if any(p in msg_lower for p in PAGE_BACKGROUND_PHRASES):
        return "background"
    if "background" in msg_lower and not any(w in msg_lower for w in [
        "carousel", "card", "cards", "grid", "navbar", "footer", "hero", "header", "banner",
        "cart", "modal", "dialog", "drawer", "slider", "section", "box", "boxes", "tile", "tiles",
        "button", "input", "form", "item", "product", "category"
    ]):
        return "background"

    return "overall"


async def handle_color_and_design_request(
    user_message: str,
    site_definition: Dict[str, Any],
    target_component: Optional[str] = None,
    wants_palette_suggestions: bool = False,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Master LangGraph sub-agent handler for color, palette, banners, image settings, and component patching."""
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

    # 1. Revert / Undo Handler
    if target_comp == "revert":
        return {
            "design_modified": False,
            "next_draft_definition": None,
            "data_cards": [],
            "applied_patch": {},
            "target_component": "revert",
            "action": "revert_snapshot",
            "assistant_reply": "Reverted your design back to the previous snapshot.",
        }

    # 2. Unsupported Area Guardrail
    if target_comp == "unsupported":
        return {
            "design_modified": False,
            "next_draft_definition": None,
            "data_cards": [],
            "applied_patch": {},
            "target_component": "unsupported",
            "unsupported_scope": True,
            "unmatched_component": True,
        }

    # 3. Banner & Slide Creation Handler
    if target_comp == "banner_create":
        new_slide = await generate_hero_banner_slide(
            user_message=user_message,
            brand_name=brand_name,
            current_theme=theme,
            session_id=session_id,
        )
        
        # Locate or create hero block
        home_page = next((p for p in pages if p.get("route") == "/" or "home" in str(p.get("name", "")).lower()), pages[0] if pages else None)
        if home_page:
            blocks = home_page.setdefault("blocks", [])
            hero_block = next((b for b in blocks if "hero" in str(b.get("type", "")).lower()), None)
            if not hero_block:
                hero_block = {
                    "id": "hero-block-main",
                    "type": "hero_banner",
                    "props": {"slides": [new_slide]},
                }
                blocks.insert(0, hero_block)
            else:
                hprops = hero_block.setdefault("props", {})
                slides = hprops.setdefault("slides", [])
                slides.insert(0, new_slide)
            
            next_draft["pages"] = pages
            design_modified = True

            headline_text = new_slide.get('headline') or 'Promotional Offer'
            badge_text = f" [{new_slide.get('badge')}]" if new_slide.get('badge') else ""
            coupon_text = f" Use coupon code **{new_slide.get('coupon_code')}**." if new_slide.get('coupon_code') else ""

            return {
                "design_modified": True,
                "next_draft_definition": next_draft,
                "data_cards": [],
                "applied_patch": {"banner_created": headline_text},
                "target_component": "hero",
                "assistant_reply": f"Added a new **{new_slide.get('badge') or 'Promotional'}** banner to your homepage! ✨ Headline: *'{headline_text}'*.{coupon_text}",
            }

    # 4. Palette Suggestions Handler
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
                "title": "Suggested Themes",
                "palettes": palettes,
            })

        return {
            "design_modified": False,
            "next_draft_definition": None,
            "data_cards": data_cards,
            "applied_patch": {},
            "target_component": target_comp,
        }

    # 5. Glass Theme Direct Synthesis Handler
    is_glass_query = any(w in msg_lower for w in [
        "glass theme", "glass style", "glassmorphic", "frosted glass", "make it glass",
        "glassmorphism", "glass effect", "translucent", "glass navbar", "navbar glass",
        "glass look", "glassy", "frosted"
    ])
    
    if is_glass_query:
        is_overall = target_comp in ["overall", "webpage", "website", "site", "all", "entire", "full"] or any(w in msg_lower for w in ["whole", "all", "entire", "site", "website", "everywhere", "body", "cards", "full", "storefront"])
        is_current_dark = (
            theme.get("mode") == "dark"
            or any(d in msg_lower for d in ["dark", "black", "luxury", "obsidian", "night", "cyber"])
            or any(d in str(theme.get("primary_bg", "")).lower() for d in ["#0f172a", "#1e293b", "#000000", "#090d16"])
        )

        if target_comp == "notification":
            glass_patch = {
                "notification_drawer_bg": "rgba(15, 23, 42, 0.75)" if is_current_dark else "rgba(255, 255, 255, 0.75)",
                "notification_drawer_text": "#f8fafc" if is_current_dark else "#0f172a",
                "dialog_bg": "rgba(15, 23, 42, 0.75)" if is_current_dark else "rgba(255, 255, 255, 0.75)",
                "border_color": "rgba(255, 255, 255, 0.18)" if is_current_dark else "rgba(255, 255, 255, 0.55)",
            }
            target_scope = "notification"
        elif target_comp == "profile":
            glass_patch = {
                "profile_dropdown_bg": "rgba(15, 23, 42, 0.75)" if is_current_dark else "rgba(255, 255, 255, 0.75)",
                "profile_dropdown_text": "#f8fafc" if is_current_dark else "#0f172a",
                "dialog_bg": "rgba(15, 23, 42, 0.75)" if is_current_dark else "rgba(255, 255, 255, 0.75)",
                "border_color": "rgba(255, 255, 255, 0.18)" if is_current_dark else "rgba(255, 255, 255, 0.55)",
            }
            target_scope = "profile"
        elif "navbar" in target_comp:
            glass_patch = {
                "surface_materiality": "glass_navbar",
                "navbar_layout": "glassmorphism_premium",
                "navbar_variant": "floating",
                "navbar_bg": "rgba(15, 23, 42, 0.72)" if is_current_dark else "rgba(255, 255, 255, 0.72)",
                "navbar_text_color": "#f8fafc" if is_current_dark else "#0f172a",
                "navbar_border_color": "rgba(255, 255, 255, 0.14)" if is_current_dark else "rgba(255, 255, 255, 0.45)",
            }
            target_scope = "navbar"
        elif is_overall:
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
        else:
            glass_patch = None

        if glass_patch:
            theme.update(glass_patch)
            apply_theme_to_blocks(pages, glass_patch, target_scope)
            next_draft["theme"] = theme
            next_draft["pages"] = pages
            design_modified = True
            patch_applied = glass_patch

            target_name = "entire storefront" if target_scope == "overall" else target_scope.replace("_", " ").title()
            return {
                "design_modified": True,
                "next_draft_definition": next_draft,
                "data_cards": data_cards,
                "applied_patch": patch_applied,
                "target_component": target_scope,
                "assistant_reply": f"Applied a premium glassmorphic visual style to your **{target_name}**.",
            }

    # 6. Dynamic Color & Theme Modification Handler via Color Theory Agent
    color_res = await generate_component_color_patch(
        current_theme=theme,
        color_request=user_message,
        target_component=target_comp,
        session_id=session_id,
    )
    ai_color_patch = color_res.get("color_patch") or {}
    raw_keys = color_res.get("raw_patch") or {}

    # Relative & Explicit Sizing / Dimension Heuristics across ALL Components
    is_reduce = any(w in msg_lower for w in ["less", "small", "smaller", "compact", "short", "shorter", "reduce", "decrease", "thin", "thinner", "lower", "little less", "tiny", "tight", "tighter"])
    is_increase = any(w in msg_lower for w in ["more", "big", "bigger", "large", "larger", "tall", "taller", "increase", "higher", "expand", "thick", "thicker", "wide", "wider", "spacious", "round", "rounded", "more rounded"])
    px_match = re.search(r'(\d+)\s*(?:px|pixels)?', msg_lower)
    explicit_num = int(px_match.group(1)) if px_match and 0 <= int(px_match.group(1)) <= 1200 else None

    # 1. Navbar
    if "navbar" in target_comp:
        if is_glass_query:
            ai_color_patch["surface_materiality"] = "glass_navbar"
            ai_color_patch["navbar_layout"] = "glassmorphism_premium"
            ai_color_patch["navbar_variant"] = "floating"
            is_current_dark = theme.get("mode") == "dark" or any(d in str(theme.get("primary_bg", "")).lower() for d in ["#0f172a", "#1e293b", "#000000", "#090d16"])
            if "navbar_bg" not in ai_color_patch:
                ai_color_patch["navbar_bg"] = "rgba(15, 23, 42, 0.72)" if is_current_dark else "rgba(255, 255, 255, 0.72)"
            if "navbar_border_color" not in ai_color_patch and not any(w in msg_lower for w in ["border", "stroke"]):
                ai_color_patch["navbar_border_color"] = "rgba(255, 255, 255, 0.14)" if is_current_dark else "rgba(255, 255, 255, 0.45)"
            if "navbar_text_color" not in ai_color_patch and not any(w in msg_lower for w in ["text", "color", "tex"]):
                ai_color_patch["navbar_text_color"] = "#f8fafc" if is_current_dark else "#0f172a"
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["height", "size", "tall", "thick"]):
            current_h = int(theme.get("navbar_height") or 64)
            if explicit_num and 40 <= explicit_num <= 140:
                ai_color_patch["navbar_height"] = explicit_num
            elif is_reduce:
                ai_color_patch["navbar_height"] = max(44, current_h - 12)
            elif is_increase:
                ai_color_patch["navbar_height"] = min(110, current_h + 12)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "spacing", "pad"]):
            current_p = int(theme.get("navbar_padding_x") or 16)
            if explicit_num and 4 <= explicit_num <= 64:
                ai_color_patch["navbar_padding_x"] = explicit_num
            elif is_reduce:
                ai_color_patch["navbar_padding_x"] = max(8, current_p - 6)
            elif is_increase:
                ai_color_patch["navbar_padding_x"] = min(48, current_p + 6)

    # 2. Hero Banner
    if any(h in target_comp for h in ["hero", "banner"]):
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["height", "tall", "size", "thickness", "vertical"]):
            current_h = int(theme.get("banner_height") or 400)
            if explicit_num and 200 <= explicit_num <= 900:
                ai_color_patch["banner_height"] = explicit_num
            elif is_reduce:
                ai_color_patch["banner_height"] = max(240, current_h - 80)
            elif is_increase:
                ai_color_patch["banner_height"] = min(750, current_h + 80)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "corner", "round", "rounded", "curve", "curved"]):
            current_r = int(theme.get("border_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["border_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["border_radius"] = max(0, current_r - 8)
            elif is_increase:
                ai_color_patch["border_radius"] = min(36, current_r + 8)

    # 3. Footer
    if "footer" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "height", "spacing", "tall", "compact"]):
            current_p = int(theme.get("footer_padding_y") or 44)
            if explicit_num and 8 <= explicit_num <= 120:
                ai_color_patch["footer_padding_y"] = explicit_num
            elif is_reduce:
                ai_color_patch["footer_padding_y"] = max(16, current_p - 14)
            elif is_increase:
                ai_color_patch["footer_padding_y"] = min(96, current_p + 14)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["width", "max width", "max_width"]):
            if explicit_num and 600 <= explicit_num <= 1800:
                ai_color_patch["footer_max_width"] = explicit_num

    # 4. Product Card & Product Grid
    if any(c in target_comp for c in ["card", "product_grid", "grid"]):
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "corner", "round", "rounded", "curve", "curved"]):
            current_r = int(theme.get("card_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["card_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["card_radius"] = max(0, current_r - 6)
            elif is_increase:
                ai_color_patch["card_radius"] = min(36, current_r + 6)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["gap", "spacing", "space between", "grid gap", "distance"]):
            current_g = int(theme.get("grid_gap") or 20)
            if explicit_num and 4 <= explicit_num <= 64:
                ai_color_patch["grid_gap"] = explicit_num
            elif is_reduce:
                ai_color_patch["grid_gap"] = max(8, current_g - 6)
            elif is_increase:
                ai_color_patch["grid_gap"] = min(48, current_g + 6)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["card padding", "padding in card", "padding inside", "card pad"]):
            current_p = int(theme.get("card_padding") or 16)
            if explicit_num and 4 <= explicit_num <= 40:
                ai_color_patch["card_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["card_padding"] = max(6, current_p - 4)
            elif is_increase:
                ai_color_patch["card_padding"] = min(32, current_p + 4)

    # 5. Product Detail
    if "product_detail" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("product_detail_padding") or 24)
            if explicit_num and 8 <= explicit_num <= 80:
                ai_color_patch["product_detail_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["product_detail_padding"] = max(10, current_p - 8)
            elif is_increase:
                ai_color_patch["product_detail_padding"] = min(56, current_p + 8)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("product_detail_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["product_detail_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["product_detail_radius"] = max(0, current_r - 6)
            elif is_increase:
                ai_color_patch["product_detail_radius"] = min(36, current_r + 6)

    # 6. Cart Drawer
    if "cart" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("cart_padding") or 20)
            if explicit_num and 8 <= explicit_num <= 60:
                ai_color_patch["cart_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["cart_padding"] = max(8, current_p - 6)
            elif is_increase:
                ai_color_patch["cart_padding"] = min(40, current_p + 6)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("cart_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["cart_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["cart_radius"] = max(0, current_r - 6)
            elif is_increase:
                ai_color_patch["cart_radius"] = min(36, current_r + 6)

    # 7. Order Summary
    if "order_summary" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("summary_padding") or 20)
            if explicit_num and 8 <= explicit_num <= 60:
                ai_color_patch["summary_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["summary_padding"] = max(8, current_p - 6)
            elif is_increase:
                ai_color_patch["summary_padding"] = min(40, current_p + 6)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("summary_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["summary_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["summary_radius"] = max(0, current_r - 6)
            elif is_increase:
                ai_color_patch["summary_radius"] = min(36, current_r + 6)

    # 8. Delivery Form
    if "delivery_form" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("delivery_form_padding") or 24)
            if explicit_num and 8 <= explicit_num <= 60:
                ai_color_patch["delivery_form_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["delivery_form_padding"] = max(8, current_p - 6)
            elif is_increase:
                ai_color_patch["delivery_form_padding"] = min(44, current_p + 6)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("delivery_form_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["delivery_form_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["delivery_form_radius"] = max(0, current_r - 6)
            elif is_increase:
                ai_color_patch["delivery_form_radius"] = min(36, current_r + 6)

    # 9. Payment Methods
    if "payment" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("payment_padding") or 20)
            if explicit_num and 8 <= explicit_num <= 60:
                ai_color_patch["payment_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["payment_padding"] = max(8, current_p - 6)
            elif is_increase:
                ai_color_patch["payment_padding"] = min(40, current_p + 6)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("payment_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["payment_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["payment_radius"] = max(0, current_r - 6)
            elif is_increase:
                ai_color_patch["payment_radius"] = min(36, current_r + 6)

    # 10. Place Order
    if "place_order" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["height", "tall", "button height", "size"]):
            current_h = int(theme.get("place_order_btn_height") or 48)
            if explicit_num and 32 <= explicit_num <= 80:
                ai_color_patch["place_order_btn_height"] = explicit_num
            elif is_reduce:
                ai_color_patch["place_order_btn_height"] = max(36, current_h - 8)
            elif is_increase:
                ai_color_patch["place_order_btn_height"] = min(72, current_h + 8)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("place_order_radius") or 12)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["place_order_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["place_order_radius"] = max(0, current_r - 4)
            elif is_increase:
                ai_color_patch["place_order_radius"] = min(32, current_r + 4)

    # 11. Filter Toolbar
    if "filter" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("filter_padding") or 16)
            if explicit_num and 4 <= explicit_num <= 50:
                ai_color_patch["filter_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["filter_padding"] = max(6, current_p - 4)
            elif is_increase:
                ai_color_patch["filter_padding"] = min(36, current_p + 4)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("filter_radius") or 12)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["filter_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["filter_radius"] = max(0, current_r - 4)
            elif is_increase:
                ai_color_patch["filter_radius"] = min(32, current_r + 4)

    # 12. Pagination
    if "pagination" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("pagination_padding") or 16)
            if explicit_num and 4 <= explicit_num <= 50:
                ai_color_patch["pagination_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["pagination_padding"] = max(6, current_p - 4)
            elif is_increase:
                ai_color_patch["pagination_padding"] = min(36, current_p + 4)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("pagination_radius") or 8)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["pagination_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["pagination_radius"] = max(0, current_r - 4)
            elif is_increase:
                ai_color_patch["pagination_radius"] = min(28, current_r + 4)

    # 13. Reviews
    if "review" in target_comp:
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["padding", "pad", "spacing"]):
            current_p = int(theme.get("review_padding") or 20)
            if explicit_num and 4 <= explicit_num <= 60:
                ai_color_patch["review_padding"] = explicit_num
            elif is_reduce:
                ai_color_patch["review_padding"] = max(8, current_p - 6)
            elif is_increase:
                ai_color_patch["review_padding"] = min(44, current_p + 6)
        if (is_reduce or is_increase or explicit_num is not None) and any(w in msg_lower for w in ["radius", "round", "corner", "curve"]):
            current_r = int(theme.get("review_card_radius") or 16)
            if explicit_num is not None and 0 <= explicit_num <= 48:
                ai_color_patch["review_card_radius"] = explicit_num
            elif is_reduce:
                ai_color_patch["review_card_radius"] = max(0, current_r - 6)
            elif is_increase:
                ai_color_patch["review_card_radius"] = min(36, current_r + 6)

    if ai_color_patch:
        # Guarantee High-Contrast Accessibility without camouflage!
        if "navbar_bg" in ai_color_patch:
            if "navbar_outer_bg" not in raw_keys:
                ai_color_patch["navbar_outer_bg"] = ai_color_patch["navbar_bg"]
            if "navbar_text_color" not in raw_keys:
                ai_color_patch["navbar_text_color"] = ensure_accessible_contrast(ai_color_patch.get("navbar_text_color"), ai_color_patch["navbar_bg"])
        elif "navbar_outer_bg" in ai_color_patch:
            if "navbar_bg" not in raw_keys:
                ai_color_patch["navbar_bg"] = ai_color_patch["navbar_outer_bg"]
            if "navbar_text_color" not in raw_keys:
                ai_color_patch["navbar_text_color"] = ensure_accessible_contrast(ai_color_patch.get("navbar_text_color"), ai_color_patch["navbar_outer_bg"])

        if "footer_bg" in ai_color_patch and "footer_text_color" not in raw_keys:
            ai_color_patch["footer_text_color"] = ensure_accessible_contrast(ai_color_patch.get("footer_text_color"), ai_color_patch["footer_bg"])
        if "card_bg" in ai_color_patch and "card_text_color" not in raw_keys:
            ai_color_patch["card_text_color"] = ensure_accessible_contrast(ai_color_patch.get("card_text_color"), ai_color_patch["card_bg"])
        if "hero_bg" in ai_color_patch and "hero_text_color" not in raw_keys:
            ai_color_patch["hero_text_color"] = ensure_accessible_contrast(ai_color_patch.get("hero_text_color"), ai_color_patch["hero_bg"])
        if "primary_bg" in ai_color_patch and "text_color" not in raw_keys:
            ai_color_patch["text_color"] = ensure_accessible_contrast(ai_color_patch.get("text_color"), ai_color_patch["primary_bg"])
        if "grid_bg" in ai_color_patch and "grid_text_color" not in raw_keys:
            ai_color_patch["grid_text_color"] = ensure_accessible_contrast(ai_color_patch.get("grid_text_color"), ai_color_patch["grid_bg"])
        if "product_detail_bg" in ai_color_patch and "product_detail_text" not in raw_keys:
            ai_color_patch["product_detail_text"] = ensure_accessible_contrast(ai_color_patch.get("product_detail_text"), ai_color_patch["product_detail_bg"])
        if "cart_bg" in ai_color_patch and "cart_text_color" not in raw_keys:
            ai_color_patch["cart_text_color"] = ensure_accessible_contrast(ai_color_patch.get("cart_text_color"), ai_color_patch["cart_bg"])
        if "summary_bg" in ai_color_patch and "summary_text_color" not in raw_keys:
            ai_color_patch["summary_text_color"] = ensure_accessible_contrast(ai_color_patch.get("summary_text_color"), ai_color_patch["summary_bg"])
        if "delivery_form_bg" in ai_color_patch and "delivery_form_text" not in raw_keys:
            ai_color_patch["delivery_form_text"] = ensure_accessible_contrast(ai_color_patch.get("delivery_form_text"), ai_color_patch["delivery_form_bg"])
        if "payment_bg" in ai_color_patch and "payment_text_color" not in raw_keys:
            ai_color_patch["payment_text_color"] = ensure_accessible_contrast(ai_color_patch.get("payment_text_color"), ai_color_patch["payment_bg"])
        if "order_history_card_bg" in ai_color_patch and "order_history_text" not in raw_keys:
            ai_color_patch["order_history_text"] = ensure_accessible_contrast(ai_color_patch.get("order_history_text"), ai_color_patch["order_history_card_bg"])
        if "order_history_bg" in ai_color_patch and "order_history_text" not in raw_keys:
            ai_color_patch["order_history_text"] = ensure_accessible_contrast(ai_color_patch.get("order_history_text"), ai_color_patch["order_history_bg"])
        if "filter_bg" in ai_color_patch and "filter_text_color" not in raw_keys:
            ai_color_patch["filter_text_color"] = ensure_accessible_contrast(ai_color_patch.get("filter_text_color"), ai_color_patch["filter_bg"])
        if "pagination_bg" in ai_color_patch and "pagination_text_color" not in raw_keys:
            ai_color_patch["pagination_text_color"] = ensure_accessible_contrast(ai_color_patch.get("pagination_text_color"), ai_color_patch["pagination_bg"])
        if "review_card_bg" in ai_color_patch and "review_text_color" not in raw_keys:
            ai_color_patch["review_text_color"] = ensure_accessible_contrast(ai_color_patch.get("review_text_color"), ai_color_patch["review_card_bg"])
        if "support_card_bg" in ai_color_patch and "support_text_color" not in raw_keys:
            ai_color_patch["support_text_color"] = ensure_accessible_contrast(ai_color_patch.get("support_text_color"), ai_color_patch["support_card_bg"])
        if "support_bg" in ai_color_patch and "support_text_color" not in raw_keys:
            ai_color_patch["support_text_color"] = ensure_accessible_contrast(ai_color_patch.get("support_text_color"), ai_color_patch["support_bg"])
        if "support_customer_bubble_bg" in ai_color_patch and "support_customer_bubble_text" not in raw_keys:
            ai_color_patch["support_customer_bubble_text"] = ensure_accessible_contrast(ai_color_patch.get("support_customer_bubble_text"), ai_color_patch["support_customer_bubble_bg"])
        if "support_agent_bubble_bg" in ai_color_patch and "support_agent_bubble_text" not in raw_keys:
            ai_color_patch["support_agent_bubble_text"] = ensure_accessible_contrast(ai_color_patch.get("support_agent_bubble_text"), ai_color_patch["support_agent_bubble_bg"])

        is_overall_target = target_comp in ["overall", "webpage", "website", "site", "all", "entire", "full"]
        theme_keys_changed = []
        if is_overall_target:
            for k in ALL_COMPONENT_OVERRIDE_KEYS:
                theme.pop(k, None)
            for k, v in ai_color_patch.items():
                if theme.get(k) != v:
                    theme[k] = v
                    theme_keys_changed.append(k)
        elif target_comp == "background":
            for k in ["primary_bg", "secondary_bg", "text_color", "muted_text"]:
                if k in ai_color_patch and theme.get(k) != ai_color_patch[k]:
                    theme[k] = ai_color_patch[k]
                    theme_keys_changed.append(k)
        elif target_comp == "navbar":
            if "border_color" in ai_color_patch:
                ai_color_patch.setdefault("navbar_border_color", ai_color_patch["border_color"])
            if "background_color" in ai_color_patch:
                ai_color_patch.setdefault("navbar_bg", ai_color_patch["background_color"])
            if "text_color" in ai_color_patch:
                ai_color_patch.setdefault("navbar_text_color", ai_color_patch["text_color"])
            for k, v in ai_color_patch.items():
                if (k.startswith("navbar_") or k in {"cart_badge_bg", "cart_badge_text", "dialog_bg"}) and theme.get(k) != v:
                    theme[k] = v
                    theme_keys_changed.append(k)
        elif target_comp == "footer":
            if "border_color" in ai_color_patch:
                ai_color_patch.setdefault("footer_border_color", ai_color_patch["border_color"])
            if "background_color" in ai_color_patch:
                ai_color_patch.setdefault("footer_bg", ai_color_patch["background_color"])
            if "text_color" in ai_color_patch:
                ai_color_patch.setdefault("footer_text_color", ai_color_patch["text_color"])
            if "muted_text" in ai_color_patch:
                ai_color_patch.setdefault("footer_muted_color", ai_color_patch["muted_text"])
            for k, v in ai_color_patch.items():
                if k.startswith("footer_") and theme.get(k) != v:
                    theme[k] = v
                    theme_keys_changed.append(k)
        else:
            # Sync theme-level component overrides (pagination, cart, filter, summary, delivery_form, payment, place_order, support, review, etc.) into theme
            for k, v in ai_color_patch.items():
                if k in THEME_COMPONENT_OVERRIDE_KEYS and theme.get(k) != v:
                    theme[k] = v
                    theme_keys_changed.append(k)

        modified_blocks = apply_theme_to_blocks(pages, ai_color_patch, target_comp)
        next_draft["theme"] = theme
        next_draft["pages"] = pages
        design_modified = bool(theme_keys_changed or modified_blocks)
        patch_applied = ai_color_patch if design_modified else {}

    return {
        "design_modified": design_modified,
        "next_draft_definition": next_draft if design_modified else None,
        "data_cards": data_cards,
        "applied_patch": patch_applied,
        "target_component": target_comp,
        "modified_blocks": modified_blocks if 'modified_blocks' in locals() else [],
        "theme_keys_changed": theme_keys_changed if 'theme_keys_changed' in locals() else [],
        "unmatched_component": not design_modified,
    }
