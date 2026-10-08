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


class DesignAction(BaseModel):
    target_component: str = Field(
        description="The component being modified: 'hero', 'product_carousel', 'section_group_carousel', 'category_grid', 'product_grid', 'card', 'navbar', 'footer', 'cart', 'order_summary', 'delivery_form', 'payment', 'place_order', 'filter', 'pagination', 'review', 'support', 'notification', 'profile', 'background', 'global'"
    )
    target_element: str = Field(
        description="Sub-element: 'section_background', 'card_background', 'card_radius', 'card_text', 'card_border', 'button', 'text', 'border', 'padding', 'height', 'shadow', 'icon'"
    )
    property_name: str = Field(
        description="The exact theme/block prop key: 'outer_bg_color', 'grid_bg', 'card_bg', 'card_radius', 'accent_color', 'hero_accent', 'navbar_bg', 'footer_bg', 'title_color', 'card_text_color', 'border_radius', 'banner_height', 'navbar_height', etc."
    )
    value: Any = Field(
        description="The target value (hex code e.g. '#0000ff', integer e.g. 0 or 24, or style keyword)"
    )
    reasoning: Optional[str] = Field(default=None, description="Short design rationale")


class DesignPlanOutput(BaseModel):
    actions: List[DesignAction] = Field(description="Ordered list of atomic design mutations")
    summary: str = Field(description="Crisp 1-2 sentence human-friendly summary of the design changes made")


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


async def generate_agentic_design_plan(
    current_theme: Dict[str, Any],
    user_message: str,
    target_component: str = "overall",
    session_id: Optional[str] = None,
) -> DesignPlanOutput:
    """Agentic design reasoner: decomposes user visual instructions into precise atomic DesignActions."""
    from agents.token_tracker import TokenCostCallback

    # Filter theme to keep tokens ultra-compact (<600 tokens)
    target_lower = (target_component or "overall").lower().strip()
    allowed_keys_for_target = set(COMPONENT_ALLOWED_KEYS.get(target_lower, set()))
    if target_lower.startswith("multi:"):
        sub_targets = [t.strip() for t in target_lower.split("multi:")[1].split(",") if t.strip()]
        for st in sub_targets:
            allowed_keys_for_target.update(COMPONENT_ALLOWED_KEYS.get(st, set()))

    filtered_theme: Dict[str, Any] = {}
    for k in ["primary_bg", "text_color", "accent_color", "border_color", "mode", "visual_style", "surface_materiality", "card_radius", "navbar_height", "hero_bg", "hero_accent"]:
        if k in current_theme:
            filtered_theme[k] = current_theme[k]
    for k in allowed_keys_for_target:
        if k in current_theme:
            filtered_theme[k] = current_theme[k]

    agent_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are WebCreon AI's Expert Design Systems & Color Theory Agent.
Your job is to translate the user's design instructions into a clean, precise list of atomic DesignActions.

COMPONENT PROPERTY REFERENCE:
- Carousels & Grids ('product_carousel', 'section_group_carousel', 'product_grid', 'category_grid'):
  - Section backdrop / container background: outer_bg_color, grid_bg
  - Inner card background: card_bg, card_bg_color
  - Inner card geometry: card_radius (0 for boxy/sharp, 8-16 for rounded, 24 for pill), card_padding, card_border_color
  - Section header text: title_color, grid_text_color, subtitle_color
  - Card text & price: card_text_color, product_name_color, price_color
- Hero Banner ('hero'):
  - Banner background: hero_bg
  - Banner headline / text: hero_text_color
  - Banner CTA button: hero_accent (and accent_color)
  - Dimensions: banner_height (240-800), border_radius
- Navbar ('navbar'):
  - Background: navbar_bg, navbar_outer_bg
  - Text: navbar_text_color
  - Border: navbar_border_color
  - Dimensions: navbar_height (44-120), navbar_padding_x (8-48)
  - Variants: navbar_variant ('floating', 'soft', 'solid')
- Footer ('footer'):
  - Background: footer_bg
  - Text: footer_text_color, footer_muted_color
  - Border: footer_border_color
  - Dimensions: footer_padding_y (16-96)
- Global Canvas ('background' or 'global'):
  - primary_bg, secondary_bg, text_color, muted_text, accent_color, border_color
- Other Components:
  - cart: cart_bg, cart_card_bg, cart_text_color, cart_accent_color, cart_radius
  - delivery_form: delivery_form_bg, delivery_form_text, delivery_form_btn_bg, delivery_form_radius
  - payment: payment_bg, payment_card_bg, payment_text_color, payment_radius
  - place_order: place_order_bg, place_order_btn_bg, place_order_btn_text, place_order_radius
  - pagination: pagination_bg, pagination_text_color, pagination_active_bg, pagination_radius
  - review: review_card_bg, review_text_color, review_border_color, review_card_radius
  - filter: filter_bg, filter_card_bg, filter_text_color, filter_radius
  - support: support_bg, support_card_bg, support_text_color, support_accent_color

RULES:
1. STRICT ELEMENT FIDELITY:
   - When user says "carousel background", target section_background (outer_bg_color and grid_bg).
   - When user says "card background", target card_background (card_bg).
   - When user says "boxy card" or "sharp corners", target card_radius with value 0.
   - When user says "banner button color to red" or "change button color on banner", target 'hero' button with hero_accent.
2. Only emit actions for properties explicitly mentioned or directly implied by the request. Never modify unrequested attributes.
3. If user specifies a relative change (e.g. "make navbar taller"), compute the new value from Current Theme (e.g. current 64 -> 80).
4. If glassmorphism/frosted glass requested, set visual_style='glassmorphic' and surface_materiality='glass_navbar' (or 'full_glass').
"""),
        ("user", "Target Component Hint: {target_hint}\nCurrent Theme: {current_theme}\nUser Request: {user_message}"),
    ])

    try:
        chain = agent_prompt | llm.with_structured_output(DesignPlanOutput, method="function_calling")
        res: DesignPlanOutput = await chain.ainvoke(
            {
                "target_hint": target_component,
                "current_theme": json.dumps(filtered_theme),
                "user_message": user_message,
            },
            config={"callbacks": [TokenCostCallback("ColorAgent.DesignPlan", session_id=session_id)]}
        )
        return res
    except Exception as e:
        print("Error generating agentic design plan:", e)
        return DesignPlanOutput(actions=[], summary="Unable to generate design updates.")


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
# 4. STORE BLOCK STYLING UTILITIES & EXECUTOR
# ==========================================

COMPONENT_BLOCK_TARGETS: Dict[str, List[str]] = {
    "hero": ["hero", "herobanner", "banner", "slider"],
    "hero_banner": ["hero", "herobanner", "banner", "slider"],
    "product_carousel": ["productcarousel", "productslider", "productsrow"],
    "section_group_carousel": ["sectiongroupcarousel", "categorycarousel", "categoryslider"],
    "product_grid": ["productgrid", "productsgrid", "cataloggrid"],
    "category_grid": ["categorygrid", "categoryshowcase", "categories"],
    "card": ["productgrid", "productcarousel"],
    "product_card": ["productgrid", "productcarousel"],
    "navbar": ["navbar", "header"],
    "footer": ["footer"],
    "cart": ["cart", "cartdrawer"],
    "order_summary": ["ordersummary", "checkoutsummary"],
    "delivery_form": ["deliveryform", "checkoutform", "addressform"],
    "payment": ["payment", "paymentmethods"],
    "place_order": ["placeorder"],
    "filter": ["filter", "filtertoolbar"],
    "pagination": ["pagination", "pager"],
    "review": ["review", "reviews", "ratings"],
    "support": ["support", "customersupport", "helpdesk"],
    "order_history": ["orderhistory", "customerorders"],
}

BG_TO_TEXT_MAP: Dict[str, Tuple[str, str]] = {
    "navbar_bg": ("navbar", "navbar_text_color"),
    "navbar_outer_bg": ("navbar", "navbar_text_color"),
    "footer_bg": ("footer", "footer_text_color"),
    "hero_bg": ("hero", "hero_text_color"),
    "card_bg": ("card", "card_text_color"),
    "card_bg_color": ("card", "card_text_color"),
    "outer_bg_color": ("section", "title_color"),
    "grid_bg": ("section", "title_color"),
    "primary_bg": ("global", "text_color"),
    "secondary_bg": ("global", "text_color"),
    "cart_bg": ("cart", "cart_text_color"),
    "delivery_form_bg": ("delivery_form", "delivery_form_text"),
    "payment_bg": ("payment", "payment_text_color"),
    "filter_bg": ("filter", "filter_text_color"),
    "pagination_bg": ("pagination", "pagination_text_color"),
    "review_card_bg": ("review", "review_text_color"),
    "support_bg": ("support", "support_text_color"),
}


def execute_design_actions(
    site_definition: Dict[str, Any],
    actions: List[DesignAction],
) -> Tuple[bool, List[str], Dict[str, Any], List[str]]:
    """Deterministically applies DesignActions to theme and block trees with zero bleed across components."""
    theme = site_definition.setdefault("theme", {})
    pages = site_definition.get("pages") or []
    modified_blocks: List[str] = []
    applied_patch: Dict[str, Any] = {}
    theme_keys_changed: List[str] = []

    for action in actions:
        comp = action.target_component.lower().strip()
        prop = action.property_name.strip()
        val = action.value

        # Update theme for global targets or theme-level component properties
        is_global_target = comp in ("global", "overall", "background")
        is_theme_level_prop = (
            prop in THEME_COMPONENT_OVERRIDE_KEYS
            or prop.startswith(("navbar_", "footer_", "hero_", "cart_", "delivery_form_", "payment_", "place_order_", "pagination_", "filter_", "review_", "support_", "notification_", "profile_"))
            or comp in ("navbar", "footer", "hero", "cart", "order_summary", "delivery_form", "payment", "place_order", "filter", "pagination", "review", "support", "notification", "profile")
        )

        if is_global_target or is_theme_level_prop:
            if theme.get(prop) != val:
                theme[prop] = val
                theme_keys_changed.append(prop)
            applied_patch[prop] = val

        # Resolve block targets
        if is_global_target:
            target_norm_types = None
        elif comp in COMPONENT_BLOCK_TARGETS:
            target_norm_types = set(COMPONENT_BLOCK_TARGETS[comp])
        else:
            target_norm_types = {_norm_block_type(comp)}

        for page in pages:
            for block in page.get("blocks", []):
                btype = str(block.get("type", "")).lower()
                norm_btype = _norm_block_type(btype)
                bprops = block.setdefault("props", {})

                # Check block match
                matches = is_global_target or (target_norm_types and any(t in norm_btype for t in target_norm_types))
                if not matches:
                    continue

                # Apply property
                if prop == "card_bg":
                    bprops["card_bg_color"] = val
                    bprops["card_bg"] = val
                elif prop in ("outer_bg_color", "grid_bg"):
                    bprops["outer_bg_color"] = val
                    bprops["grid_bg"] = val
                elif prop in ("card_radius", "border_radius"):
                    bprops["card_radius"] = val
                    bprops["border_radius"] = val
                elif prop in ("card_text_color", "product_name_color"):
                    bprops["card_text_color"] = val
                    bprops["product_name_color"] = val
                elif prop in ("title_color", "grid_text_color"):
                    bprops["title_color"] = val
                    bprops["grid_text_color"] = val
                else:
                    bprops[prop] = val

                # Synchronize Hero Slides & CTAs
                if "hero" in norm_btype or "banner" in norm_btype:
                    if prop in ("hero_accent", "accent_color", "button_bg_color"):
                        bprops["hero_accent"] = val
                        bprops["accent_color"] = val
                        bprops["button_bg_color"] = val
                        for slide in bprops.get("slides", []):
                            if isinstance(slide, dict):
                                slide["accent_color"] = val
                                if "primary_cta" in slide and isinstance(slide["primary_cta"], dict):
                                    slide["primary_cta"]["bg_color"] = val
                    elif prop in ("hero_bg", "background_color"):
                        for slide in bprops.get("slides", []):
                            if isinstance(slide, dict):
                                slide["background_color"] = val
                    elif prop in ("hero_text_color", "text_color"):
                        for slide in bprops.get("slides", []):
                            if isinstance(slide, dict):
                                slide["text_color"] = val

                applied_patch[prop] = val
                if btype not in modified_blocks:
                    modified_blocks.append(btype)

    return bool(applied_patch or modified_blocks), modified_blocks, applied_patch, theme_keys_changed


def apply_theme_to_blocks(pages: List[Dict[str, Any]], patch_dict: Dict[str, Any], target_type: Optional[str] = None) -> List[str]:
    """Compatibility wrapper that translates patch_dict into DesignActions and applies them cleanly."""
    target_clean = (target_type or "overall").lower().strip()
    actions = []

    if target_clean.startswith("multi:"):
        targets = [t.strip() for t in target_clean[6:].split(",") if t.strip()]
    else:
        targets = [target_clean]

    for comp in targets:
        for prop, val in patch_dict.items():
            actions.append(DesignAction(
                target_component=comp,
                target_element="property",
                property_name=prop,
                value=val,
                reasoning=f"Applying {prop} to {comp}"
            ))

    dummy_site = {"theme": {}, "pages": pages}
    _, modified_blocks, _, _ = execute_design_actions(dummy_site, actions)
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

    # 3. Banner & Slide Creation Handler (ONLY when user explicitly requests creating a new banner slide)
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
            headline_text = new_slide.get('headline') or 'Promotional Offer'
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

    # 5. Agentic Design Execution Pipeline
    design_plan = await generate_agentic_design_plan(
        current_theme=theme,
        user_message=user_message,
        target_component=target_comp,
        session_id=session_id,
    )

    actions = list(design_plan.actions)

    # 5B. Contrast & Accessibility Safety Harmonizer
    # If an action sets a background, verify that a readable text color exists or synthesize one
    for a in list(actions):
        if a.property_name in BG_TO_TEXT_MAP and isinstance(a.value, str):
            comp_name, text_prop = BG_TO_TEXT_MAP[a.property_name]
            has_user_text_action = any(
                other.property_name == text_prop or "text" in other.property_name
                for other in actions
            )
            if not has_user_text_action:
                safe_text = ensure_accessible_contrast(None, a.value)
                actions.append(DesignAction(
                    target_component=comp_name,
                    target_element="text",
                    property_name=text_prop,
                    value=safe_text,
                    reasoning=f"Automatic WCAG AA contrast for {a.property_name}"
                ))

    # 5C. Execute Actions onto Draft Definition
    design_modified, modified_blocks, applied_patch, theme_keys_changed = execute_design_actions(
        next_draft,
        actions,
    )

    return {
        "design_modified": design_modified,
        "next_draft_definition": next_draft if design_modified else None,
        "data_cards": data_cards,
        "applied_patch": applied_patch,
        "target_component": target_comp,
        "modified_blocks": modified_blocks,
        "theme_keys_changed": theme_keys_changed,
        "assistant_reply": design_plan.summary if design_modified else "No visual design modifications were required.",
        "unmatched_component": not design_modified,
    }
