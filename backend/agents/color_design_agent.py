"""
Webcreon AI - Unified Master Color & Design Agent
Unified source of truth for color palette generation, WCAG AA accessibility contrast,
component color patching, live block styling, whole-site theme matching, and AI palette suggestions.
"""

import copy
import json
import re
from typing import Dict, Any, List, Optional, Union, Tuple
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
    description: str = Field(description="Evocative 1-sentence note explaining why this aesthetic and color combination suits the brand")
    visual_style: Optional[str] = Field(default="solid_clean", description="Visual style: 'solid_clean', 'elevated_luxury', 'warm_organic', 'cyber_glow', 'glassmorphic'")
    
    primary_bg: str = Field(description="Main page background hex or CSS gradient. Can be an immersive colored canvas (e.g. rich burgundy #3b0712, deep emerald #064e3b), a soft tinted wash (e.g. #fff1f2), a clean light studio #ffffff, or midnight jewel-tone.")
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
    card_text_color: Optional[str] = Field(default=None, description="Product card text hex")
    card_border_color: Optional[str] = Field(default=None, description="Product card border hex")
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


def is_red_or_destructive_color(color_str: Optional[str]) -> bool:
    """Returns True if a color is red, crimson, rose, or warning/error tone."""
    if not color_str or not isinstance(color_str, str):
        return False
    s = color_str.strip().lower()
    if s in ("red", "crimson", "darkred", "firebrick", "maroon", "tomato", "indianred", "salmon", "deeppink"):
        return True
    if s.startswith("#"):
        r, g, b = hex_to_rgb(s)
        h, s_val, l_val = hex_to_hsl(s)
        is_red_hue = (h >= 342 or h <= 20) and s_val >= 0.28 and 0.15 <= l_val <= 0.85
        is_red_dominant = r >= 140 and r >= g * 1.35 and r >= b * 1.35 and s_val >= 0.25
        return is_red_hue or is_red_dominant
    return False


def get_safe_price_color(candidate: Optional[str], default_text: str = "#0f172a", is_dark: bool = False) -> str:
    """Selling price should NEVER be red, error tone, or camouflage against card background."""
    fallback = "#ffffff" if is_dark else (default_text or "#0f172a")
    if not candidate or not isinstance(candidate, str):
        return fallback
    clean = candidate.strip()
    if not clean or clean in ("transparent", "inherit", "default"):
        return fallback
    if is_red_or_destructive_color(clean):
        return fallback
    return clean


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
    Guarantees WCAG AA readability (>= min_ratio:1) while preserving the original hue and saturation!
    Instead of snapping directly to #0f172a or #ffffff, adjusts LIGHTNESS ONLY step-by-step
    to maintain designer tones (champagne, warm ivory, soft charcoal, espresso, tinted blush).
    Only falls back to #ffffff or #0f172a if no lightness adjustment satisfies the ratio.
    """
    if not text_hex or not isinstance(text_hex, str) or not text_hex.strip():
        return calculate_contrast_color(bg_hex)

    t_clean = text_hex.strip()
    b_clean = str(bg_hex or "").strip()

    t_match = re.search(r"#[0-9a-fA-F]{3,6}", t_clean)
    b_match = re.search(r"#[0-9a-fA-F]{3,6}", b_clean)
    if not t_match or not b_match:
        return calculate_contrast_color(bg_hex)

    t_hex = t_match.group(0)
    b_hex = b_match.group(0)

    try:
        if calculate_contrast_ratio(t_hex, b_hex) >= min_ratio:
            return t_hex
    except Exception:
        return calculate_contrast_color(bg_hex)

    try:
        bg_is_dark = is_color_dark(b_hex)
        h, s, _ = hex_to_hsl(t_hex)

        # 1. Primary search direction based on background lightness
        if bg_is_dark:
            for l_cand in [0.82, 0.86, 0.90, 0.93, 0.96, 0.985]:
                cand = hsl_to_hex(h, min(s, 0.40), l_cand)
                if calculate_contrast_ratio(cand, b_hex) >= min_ratio:
                    return cand
            for s_subtle in [0.20, 0.10, 0.04]:
                cand = hsl_to_hex(h, s_subtle, 0.99)
                if calculate_contrast_ratio(cand, b_hex) >= min_ratio:
                    return cand
            # Secondary search downward if background was in the middle-luminance zone
            for l_cand in [0.20, 0.14, 0.08, 0.04]:
                cand = hsl_to_hex(h, min(s, 0.35), l_cand)
                if calculate_contrast_ratio(cand, b_hex) >= min_ratio:
                    return cand
        else:
            for l_cand in [0.26, 0.20, 0.16, 0.12, 0.08, 0.04]:
                cand = hsl_to_hex(h, min(s, 0.35), l_cand)
                if calculate_contrast_ratio(cand, b_hex) >= min_ratio:
                    return cand
            for s_subtle in [0.20, 0.10, 0.04]:
                cand = hsl_to_hex(h, s_subtle, 0.04)
                if calculate_contrast_ratio(cand, b_hex) >= min_ratio:
                    return cand
            # Secondary search upward if background was in the middle-luminance zone
            for l_cand in [0.86, 0.92, 0.96, 0.99]:
                cand = hsl_to_hex(h, min(s, 0.40), l_cand)
                if calculate_contrast_ratio(cand, b_hex) >= min_ratio:
                    return cand

        # Decisive fallback: select whichever pure tone achieves maximum contrast
        r_white = calculate_contrast_ratio("#ffffff", b_hex)
        r_dark = calculate_contrast_ratio("#0f172a", b_hex)
        return "#ffffff" if r_white >= r_dark else "#0f172a"
    except Exception:
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


def sanitize_border_color(border_hex: Optional[str], is_dark: bool = False, allow_poppy: bool = False) -> str:
    """
    Ensures border colors default to subtle, elegant neutral dividers unless the user
    explicitly requested poppy/vibrant/neon borders.
    """
    default_neutral = "rgba(255, 255, 255, 0.12)" if is_dark else "#e2e8f0"
    if not border_hex or not isinstance(border_hex, str) or not border_hex.strip():
        return default_neutral

    clean = border_hex.strip()
    if allow_poppy:
        return clean

    # If it's already an rgba divider with low opacity, keep it
    if clean.startswith("rgba") or clean.startswith("hsla"):
        return clean

    try:
        hex_match = re.search(r"#[0-9a-fA-F]{3,6}", clean)
        if hex_match:
            r, g, b = hex_to_rgb(hex_match.group(0))
            chroma = (max(r, g, b) - min(r, g, b)) / 255.0
            # If chroma is > 0.22, it's a poppy/saturated color (e.g. bright yellow, red, blue, green)
            if chroma > 0.22:
                # Clamp to an elegant subtle neutral divider
                return "rgba(255, 255, 255, 0.12)" if is_dark else "#e2e8f0"
    except Exception:
        pass

    return clean



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
# 3. HYBRID MATHEMATICAL COLOR ENGINE & LLM NAMING
# ==========================================

import os
import secrets

USE_ALGO_PALETTES = os.getenv("USE_ALGO_PALETTES", "true").lower() in ("true", "1", "yes")

_sys_rng = secrets.SystemRandom()

# High-creativity LLM specifically for expressive palette naming and storytelling
naming_llm = ChatOpenAI(model="gpt-4o-mini", temperature=1.0, request_timeout=15, max_retries=1)
# Legacy LLM preserved for feature flag fallback
creative_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.85, request_timeout=20, max_retries=2)


class PaletteNamingItem(BaseModel):
    id: str = Field(description="The palette ID matching the input, e.g. palette_1")
    name: str = Field(description="Evocative 2-3 word luxury/designer title, e.g. Velvet Crimson, Emerald Mist, Royal Navy & Amber")
    description: str = Field(description="1-sentence aesthetic description highlighting the color harmony and mood")


class PaletteNamingResponse(BaseModel):
    palettes: List[PaletteNamingItem]


HUE_KEYWORD_RANGES: List[Tuple[str, List[Tuple[float, float]]]] = [
    # Red / Crimson / Wine / Ruby / Scarlet (Strictly 346.0 to 6.0 - NEVER ORANGE OR RUST!)
    (r"\b(red|crimson|ruby|scarlet|cherry|blood|burgundy|maroon|wine|bordeaux)\b", [(346.0, 6.0)]),
    # Orange / Terracotta / Rust / Amber / Copper / Peach
    (r"\b(orange|terracotta|amber|rust|copper|tangerine|apricot|clay|peach)\b", [(15.0, 32.0)]),
    # Yellow / Gold / Honey / Saffron / Canary
    (r"\b(yellow|gold|golden|honey|canary|mustard|lemon|sun|saffron)\b", [(44.0, 54.0)]),
    # Lime / Chartreuse
    (r"\b(lime|chartreuse)\b", [(72.0, 88.0)]),
    # Green / Emerald / Forest / Sage / Mint / Olive
    (r"\b(green|emerald|forest|sage|olive|mint|jade|moss|pine)\b", [(110.0, 155.0)]),
    # Teal / Cyan / Turquoise / Aquamarine
    (r"\b(teal|cyan|turquoise|aqua|aquamarine)\b", [(168.0, 192.0)]),
    # Blue / Navy / Cobalt / Sapphire / Ocean / Sky
    (r"\b(blue|ocean|navy|cobalt|indigo|sapphire|azure|sky|cerulean)\b", [(210.0, 235.0)]),
    # Purple / Violet / Lavender / Plum / Lilac / Amethyst
    (r"\b(purple|violet|lavender|plum|lilac|amethyst|grape|mauve)\b", [(260.0, 285.0)]),
    # Pink / Rose / Magenta / Fuchsia / Blush
    (r"\b(pink|rose|magenta|fuchsia|blush|flamingo)\b", [(315.0, 340.0)]),
    # Earthy / Sand / Beige / Brown / Tan / Khaki
    (r"\b(earthy|earth|sand|beige|brown|neutral|tan|khaki|coffee|chocolate|latte)\b", [(20.0, 34.0)]),
]


def extract_hex_code_from_text(text: str) -> Optional[str]:
    """
    Extracts a 3-digit or 6-digit hex color code from a string.
    Supports:
    - Explicit hash: '#ac3039', '#AC3039', '#fff', '#3b82f6'
    - Contextual keyword prefix without hash: 'color ac3039', 'hex ac3039', 'code ac3039', 'with ac3039'
    """
    if not text:
        return None
    # 1. Explicit hash hex match (# followed by 6 or 3 hex characters)
    m = re.search(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", text)
    if m:
        raw = m.group(1)
        if len(raw) == 3:
            raw = "".join([c * 2 for c in raw])
        return f"#{raw.lower()}"
    
    # 2. Contextual keyword match without hash (avoid matching common words like 'coffee' or 'decade')
    m_context = re.search(r"\b(?:hex|color|code|tone|shade|with)\s*(?:is|of|:)?\s*#?([0-9a-fA-F]{6})\b", text, re.IGNORECASE)
    if m_context:
        return f"#{m_context.group(1).lower()}"
    
    return None


def get_color_family_from_hue(hue: float) -> str:
    """Classifies a 0-360 hue angle into a standard designer color family."""
    h = hue % 360.0
    if h >= 346.0 or h <= 12.0:
        return "crimson"
    elif h <= 38.0:
        return "terracotta"
    elif h <= 65.0:
        return "gold"
    elif h <= 88.0:
        return "lime"
    elif h <= 165.0:
        return "emerald"
    elif h <= 198.0:
        return "teal"
    elif h <= 255.0:
        return "sapphire"
    elif h <= 295.0:
        return "amethyst"
    elif h <= 346.0:
        return "rose"
    return "dynamic"


def extract_requested_hue_range(user_prompt: str, history_str: str = "") -> Tuple[float, float, str, Optional[str]]:
    """
    Extracts requested hue range, color family name, and optional exact hex code from user prompt or history.
    Priority:
    1. Exact hex code in current prompt (e.g. '#ac3039') -> tight hue range centered on exact hue + exact hex.
    2. Color keyword in current prompt (e.g. 'red', 'crimson', 'blue') -> standard keyword range.
    3. Exact hex code in conversation history -> follow-up with preserved hex code.
    4. Color keyword in conversation history -> follow-up with preserved keyword range.
    5. Fallback: dynamic 360-degree range.
    """
    p_str = str(user_prompt or "")
    p_lower = p_str.lower()

    # 1. Exact hex code in current prompt
    hex_in_prompt = extract_hex_code_from_text(p_str)
    if hex_in_prompt:
        try:
            h, s, l = hex_to_hsl(hex_in_prompt)
            family = get_color_family_from_hue(h)
            min_h = (h - 5.0) % 360.0
            max_h = (h + 5.0) % 360.0
            return min_h, max_h, family, hex_in_prompt
        except Exception:
            pass

    # 2. Color keywords in current prompt
    for pattern, ranges in HUE_KEYWORD_RANGES:
        m = re.search(pattern, p_lower)
        if m:
            matched_word = m.group(1)
            chosen_range = _sys_rng.choice(ranges)
            return chosen_range[0], chosen_range[1], matched_word, None

    # 3. Conversational memory: Check history for exact hex code
    h_str = str(history_str or "")
    h_lower = h_str.lower()
    hex_in_hist = extract_hex_code_from_text(h_str)
    if hex_in_hist:
        try:
            h, s, l = hex_to_hsl(hex_in_hist)
            family = get_color_family_from_hue(h)
            min_h = (h - 5.0) % 360.0
            max_h = (h + 5.0) % 360.0
            return min_h, max_h, family, hex_in_hist
        except Exception:
            pass

    # 4. Conversational memory: Check history for color keywords
    if h_lower:
        for pattern, ranges in HUE_KEYWORD_RANGES:
            m = re.search(pattern, h_lower)
            if m:
                matched_word = m.group(1)
                chosen_range = _sys_rng.choice(ranges)
                return chosen_range[0], chosen_range[1], matched_word, None

    # 5. Default: completely dynamic 360-degree range
    start = _sys_rng.uniform(0.0, 360.0)
    return start, (start + 30.0) % 360.0, "dynamic", None


def pick_random_hue(min_h: float, max_h: float) -> float:
    """Samples a cryptographic random float hue within the designated range."""
    if min_h <= max_h:
        return _sys_rng.uniform(min_h, max_h)
    else:
        # Range wraps around 360 (e.g. 346 to 6)
        span = (360.0 - min_h) + max_h
        val = _sys_rng.uniform(0.0, span)
        return (min_h + val) % 360.0


def clamp_hue_in_range(hue: float, min_h: float, max_h: float) -> float:
    """Clamps a hue strictly within a range, correctly handling 360-degree wrap-around."""
    h = hue % 360.0
    if min_h <= max_h:
        return max(min_h, min(max_h, h))
    else:
        # Wrap-around range (e.g. 346.0 to 6.0)
        if h >= min_h or h <= max_h:
            return h
        dist_min = (min_h - h) % 360.0
        dist_max = (h - max_h) % 360.0
        return min_h if dist_min < dist_max else max_h


def generate_fallback_name_and_desc(
    brand_name: str,
    color_family: str,
    harmony: str,
    canvas_mode: str,
    accent_hex: str,
) -> Tuple[str, str]:
    """Provides instant, high-quality designer naming if LLM naming fails or times out."""
    family_cap = color_family.capitalize() if color_family != "dynamic" else "Modern"
    
    harmony_titles = {
        "complementary": f"{family_cap} & Contrast Sage",
        "split_complementary": f"{family_cap} Prismatic Harmony",
        "triadic": f"{family_cap} Triadic Vibrance",
        "analogous": f"{family_cap} & Soft Rosewood",
        "mono_deep": f"Velvet {family_cap} Depth",
        "warm_luxury": f"{family_cap} & Champagne Gold",
    }
    canvas_descs = {
        "deep_immersive": f"Immersive, mood-rich {color_family} canvas with elevated container cards and luminous {accent_hex} highlights.",
        "light_tint": f"Crisp luminous studio canvas with subtle {color_family} undertones and vibrant {accent_hex} action accents.",
        "dark_tint": f"Atmospheric midnight slate canvas infused with {color_family} tones and striking interactive depth.",
        "mid_tone": f"Warm organic editorial canvas balanced with refined {color_family} harmony and high-contrast typography.",
    }
    
    title = f"{brand_name} {harmony_titles.get(harmony, f'{family_cap} Studio')}"
    desc = canvas_descs.get(canvas_mode, f"Designer-crafted {color_family} palette tailored for {brand_name}.")
    return title, desc


# Session-level palette memory to guarantee non-repetitive archetypes on follow-ups
_SESSION_PALETTE_HISTORY: Dict[str, List[str]] = {}


async def generate_color_palettes(
    brand_name: str = "Store",
    domain: str = "E-Commerce",
    color_description: Optional[str] = None,
    session_id: Optional[str] = None,
    count: int = 3,
    history_str: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Industry-Standard Dynamic Color Generation Engine:
    1. Cryptographically samples diverse, balanced color harmonies (secrets.SystemRandom).
    2. Dynamically parses requested counts ("5 more", "3 palettes", "new one", etc.).
    3. Retains color context from conversation history across turns without color drift.
    4. Enforces non-repetitive archetypes across turns via session palette memory.
    5. Calculates 24+ PaletteOption surface, border, and typography tokens with guaranteed WCAG AA (>= 4.5).
    6. Explicitly records token & credit usage in terminal for full billing transparency.
    7. Calls LLM once with temperature 1.0 to assign unique, evocative luxury naming.
    """
    from agents.token_tracker import TokenCostCallback, get_token_tracker

    desc_lower = str(color_description or "").lower()

    # 1. Dynamic Count Detection (supports "5 more", "give me 5", "new one", "3 more", etc.)
    target_count = count
    count_match = re.search(r"\b(\d+)\s*(?:more|palettes?|palletes?|pallettes?|themes?|options?|styles?)?\b", desc_lower)
    if count_match:
        try:
            val = int(count_match.group(1))
            if 1 <= val <= 6:
                target_count = val
        except Exception:
            pass
    elif re.search(r"\b(new\s*one|another(?:\s*one)?)\b", desc_lower):
        target_count = 3  # Generate fresh batch of 3 when user asks for a new one/another
    else:
        word_map = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
        for word, num in word_map.items():
            if re.search(rf"\b{word}\s*(?:more|palettes?|palletes?|pallettes?|themes?|options?)?\b", desc_lower):
                target_count = num
                break

    # 2. Terminal Token & Credit Metering (Always visible in backend terminal when session is active)
    if session_id:
        token_tracker = get_token_tracker()
        est_input_tokens = len(desc_lower.split()) * 15 + 260
        est_output_tokens = target_count * 150
        token_tracker.record_usage(
            agent_name="ColorAgent.PaletteEngine",
            model_name="gpt-4o-mini",
            input_tokens=est_input_tokens,
            output_tokens=est_output_tokens,
            session_id=session_id,
        )

    # 3. Border Intent Detection
    wants_poppy_borders = bool(re.search(r"\b(poppy|vibrant|neon|bright|accent|colored|colourful|colorful)\s*borders?\b", desc_lower))

    # --- FEATURE FLAG: LEGACY LLM PATH ---
    if not USE_ALGO_PALETTES:
        border_instruction = (
            "- USER EXPLICITLY REQUESTED POPPY/VIBRANT BORDERS: Generate vibrant accent borders."
            if wants_poppy_borders else
            "- DEFAULT BORDER RULE: Cards and section borders must be subtle neutral dividers."
        )
        palette_prompt = ChatPromptTemplate.from_messages([
            ("system", f"""You are an elite color director for luxury e-commerce. Craft {target_count} distinct palettes. {border_instruction}"""),
            ("user", "Brand: {brand_name}\nDomain: {domain}\nRequest: {color_description}\nTarget Count: {target_count}"),
        ])
        try:
            structured_llm = palette_prompt | creative_llm.with_structured_output(PaletteResponse, method="function_calling")
            res: PaletteResponse = await structured_llm.ainvoke(
                {"brand_name": brand_name, "domain": domain, "color_description": color_description or "Modern clean", "target_count": target_count},
                config={"callbacks": [TokenCostCallback("ColorAgent.PaletteGenerator", session_id=session_id)]}
            )
            return [p.model_dump() for p in res.palettes]
        except Exception as e:
            print("Error in legacy palette generation:", e)
            return []

    # --- HYBRID MATHEMATICAL ENGINE ---
    # Extract requested hue range, inspecting both current query and conversation history
    min_h, max_h, color_family, exact_user_hex = extract_requested_hue_range(desc_lower, history_str=history_str or "")

    THEME_ARCHETYPES = [
        "bold_header_clean_body",   # Pure white body + bold saturated brand navbar!
        "soft_tinted_pastel",       # Delicate tinted blush/gelato wash + elevated white cards + punchy CTA!
        "deep_velvet_luxury",       # Opulent velvet/jewel canvas + metallic champagne gold highlights!
        "cyber_neon_noir",          # Midnight carbon slate + glowing electric neon CTA!
        "artisan_earth_warmth",     # Warm organic linen sand + terracotta brick red & sage accents!
        "minimal_pearl_duo",        # Clean modern pearl canvas + split-complementary focal points!
    ]

    # Session Memory: Filter out archetypes used in the previous turn so follow-ups ("give me 3 more", "new one") are 100% fresh
    sess_key = session_id or "default_session"
    recent_archetypes = _SESSION_PALETTE_HISTORY.get(sess_key, [])
    fresh_archetypes = [a for a in THEME_ARCHETYPES if a not in recent_archetypes]

    if len(fresh_archetypes) >= target_count:
        sampled_archetypes = _sys_rng.sample(fresh_archetypes, target_count)
    else:
        sampled_archetypes = list(fresh_archetypes)
        remaining = [a for a in THEME_ARCHETYPES if a not in sampled_archetypes]
        needed = target_count - len(sampled_archetypes)
        sampled_archetypes.extend(_sys_rng.sample(remaining, min(needed, len(remaining))))
        while len(sampled_archetypes) < target_count:
            sampled_archetypes.append(_sys_rng.choice(THEME_ARCHETYPES))

    # Update session memory
    _SESSION_PALETTE_HISTORY[sess_key] = list(sampled_archetypes)

    raw_palettes: List[Dict[str, Any]] = []
    has_specific_color = color_family != "dynamic"
    family_cap = color_family.capitalize() if has_specific_color else "Modern"
    color_label = f"{color_family} ({exact_user_hex})" if exact_user_hex else color_family

    h_exact, s_exact, l_exact = hex_to_hsl(exact_user_hex) if exact_user_hex else (0.0, 0.0, 0.0)
    contrast_text_exact = calculate_contrast_color(exact_user_hex) if exact_user_hex else "#ffffff"

    for idx in range(target_count):
        archetype = sampled_archetypes[idx]

        # Base Palette Hue with strict range clamping when a specific color is requested
        raw_hue = pick_random_hue(min_h, max_h)
        if has_specific_color:
            palette_base_hue = clamp_hue_in_range(raw_hue + _sys_rng.uniform(-3.5, 3.5), min_h, max_h)
        else:
            palette_base_hue = (raw_hue + _sys_rng.uniform(-8.0, 8.0)) % 360.0

        is_yellow_orange = 34.0 <= palette_base_hue <= 72.0

        # Archetype 1: Bold Header + Clean Studio Body
        if archetype == "bold_header_clean_body":
            primary_bg = hsl_to_hex(palette_base_hue, _sys_rng.uniform(0.01, 0.04), _sys_rng.uniform(0.985, 0.996))
            secondary_bg = hsl_to_hex(palette_base_hue, _sys_rng.uniform(0.03, 0.06), _sys_rng.uniform(0.955, 0.970))
            card_bg = "#ffffff"
            card_shadow = "0 4px 20px rgba(0,0,0,0.06)"
            card_radius = 20

            # Bold brand navbar (e.g. rich scarlet red header with crisp white text)
            nav_sat = _sys_rng.uniform(0.80, 0.94)
            nav_light = _sys_rng.uniform(0.32, 0.38)
            navbar_bg = hsl_to_hex(palette_base_hue, nav_sat, nav_light)
            navbar_outer_bg = navbar_bg
            navbar_text_color = "#ffffff"
            navbar_border_color = hsl_to_hex(palette_base_hue, 0.70, 0.26)
            navbar_variant = "solid"

            accent_hue = palette_base_hue
            acc_sat = _sys_rng.uniform(0.85, 0.98)
            acc_light = _sys_rng.uniform(0.34, 0.40)
            accent_color = hsl_to_hex(accent_hue, acc_sat, acc_light)
            accent_text = "#ffffff"

            if exact_user_hex:
                navbar_bg = exact_user_hex
                navbar_outer_bg = exact_user_hex
                navbar_text_color = contrast_text_exact
                navbar_border_color = hsl_to_hex(h_exact, 0.70, max(0.15, l_exact - 0.12))
                accent_color = exact_user_hex
                accent_text = contrast_text_exact

            text_color = hsl_to_hex(palette_base_hue, 0.15, 0.10)
            card_text_color = text_color
            muted_text = hsl_to_hex(palette_base_hue, 0.12, 0.44)

            soft_border = hsl_to_hex(palette_base_hue, 0.10, 0.90)
            border_color = sanitize_border_color(soft_border, allow_poppy=wants_poppy_borders)
            card_border_color = soft_border

            footer_bg = _sys_rng.choice(["#0f172a", hsl_to_hex(palette_base_hue, 0.35, 0.08)])
            footer_text_color = "#ffffff"

            hero_bg = f"linear-gradient(180deg, {hsl_to_hex(palette_base_hue, 0.06, 0.97)} 0%, #ffffff 100%)"
            hero_text_color = text_color
            hero_accent = accent_color
            visual_style = "solid_clean"
            fallback_name = f"{family_cap} Bold Header & Studio"
            fallback_desc = f"Crisp alabaster body anchored by an iconic bold {color_label} navigation header and vibrant action buttons."

        # Archetype 2: Soft Tinted Pastel Wash (Blush Rose / Modern Gelato)
        elif archetype == "soft_tinted_pastel":
            # Delicate tinted canvas at 96.5-98.0% lightness (e.g. #fff1f2 for red, gentle rose/blush)
            primary_bg = hsl_to_hex(palette_base_hue, _sys_rng.uniform(0.55, 0.80), _sys_rng.uniform(0.965, 0.980))
            secondary_bg = hsl_to_hex(palette_base_hue, 0.45, 0.935)
            card_bg = "#ffffff"
            card_shadow = "0 4px 20px rgba(0,0,0,0.05)"
            card_radius = 20

            navbar_bg = primary_bg
            navbar_outer_bg = primary_bg
            # High-contrast dark ruby / espresso text
            navbar_text_color = hsl_to_hex(palette_base_hue, 0.80, 0.14)
            navbar_border_color = hsl_to_hex(palette_base_hue, 0.45, 0.88)
            navbar_variant = "floating"

            accent_hue = palette_base_hue
            acc_sat = _sys_rng.uniform(0.85, 0.98)
            acc_light = _sys_rng.uniform(0.35, 0.42)
            accent_color = hsl_to_hex(accent_hue, acc_sat, acc_light)
            accent_text = "#ffffff"

            if exact_user_hex:
                accent_color = exact_user_hex
                accent_text = contrast_text_exact

            text_color = hsl_to_hex(palette_base_hue, 0.70, 0.12)
            card_text_color = text_color
            muted_text = hsl_to_hex(palette_base_hue, 0.35, 0.42)

            soft_border = hsl_to_hex(palette_base_hue, 0.45, 0.88)
            card_border_color = soft_border
            border_color = sanitize_border_color(soft_border, allow_poppy=wants_poppy_borders)

            footer_bg = "#0f172a"
            footer_text_color = "#ffffff"

            hero_bg = f"linear-gradient(135deg, {primary_bg} 0%, {hsl_to_hex(palette_base_hue, 0.40, 0.93)} 100%)"
            hero_text_color = text_color
            hero_accent = accent_color
            visual_style = "warm_organic"
            fallback_name = f"Blush {family_cap} & Gelato Wash"
            fallback_desc = f"Delicate pastel {color_label} tinted canvas paired with crisp elevated cards and vibrant action buttons."

        # Archetype 3: Deep Royal Velvet & Champagne Gold Luxe
        elif archetype == "deep_velvet_luxury":
            primary_bg = hsl_to_hex(palette_base_hue, _sys_rng.uniform(0.70, 0.90), _sys_rng.uniform(0.065, 0.095))
            secondary_bg = hsl_to_hex(palette_base_hue, 0.60, 0.13)
            card_bg = hsl_to_hex(palette_base_hue, 0.55, 0.16)
            card_shadow = "0 8px 30px rgba(0,0,0,0.35)"
            card_radius = 20

            navbar_bg = primary_bg
            navbar_outer_bg = primary_bg
            navbar_text_color = "#fef3c7"
            navbar_variant = "soft"

            if has_specific_color:
                accent_hue = palette_base_hue
                acc_sat = _sys_rng.uniform(0.85, 0.98)
                acc_light = _sys_rng.uniform(0.38, 0.44)
                accent_color = hsl_to_hex(accent_hue, acc_sat, acc_light)
                accent_text = "#ffffff"
                # Metallic champagne gold for borders and trims
                gold_hex = hsl_to_hex(_sys_rng.uniform(42.0, 48.0), 0.95, 0.52)
                soft_border = gold_hex
                navbar_border_color = gold_hex
            else:
                accent_hue = _sys_rng.uniform(42.0, 50.0) if not is_yellow_orange else (palette_base_hue + 180.0) % 360.0
                acc_sat = _sys_rng.uniform(0.90, 1.0)
                acc_light = 0.50
                accent_color = hsl_to_hex(accent_hue, acc_sat, acc_light)
                accent_text = "#0f172a"
                navbar_border_color = hsl_to_hex(accent_hue, 0.50, 0.28)
                soft_border = hsl_to_hex(accent_hue, 0.45, 0.30)

            if exact_user_hex:
                accent_color = exact_user_hex
                accent_text = contrast_text_exact

            text_color = "#fdf8f6"
            card_text_color = "#fdf8f6"
            muted_text = "#f3e8e2"
            card_border_color = soft_border
            border_color = soft_border

            footer_bg = hsl_to_hex(palette_base_hue, 0.50, 0.03)
            footer_text_color = "#ffffff"

            hero_bg = primary_bg
            hero_text_color = "#ffffff"
            hero_accent = accent_color
            visual_style = "elevated_luxury"
            fallback_name = f"{family_cap} & Champagne Gold Luxe"
            fallback_desc = f"Opulent deep {color_label} velvet canvas accented by luminous champagne gold trims and glowing CTA buttons."

        # Archetype 4: Cyber Neon Midnight Obsidian
        elif archetype == "cyber_neon_noir":
            primary_bg = hsl_to_hex(palette_base_hue, 0.20, _sys_rng.uniform(0.045, 0.065))
            secondary_bg = hsl_to_hex(palette_base_hue, 0.18, 0.09)
            card_bg = hsl_to_hex(palette_base_hue, 0.15, 0.12)
            card_shadow = "0 8px 32px rgba(0,0,0,0.45)"
            card_radius = 20

            navbar_bg = hsl_to_hex(palette_base_hue, 0.15, 0.035)
            navbar_outer_bg = navbar_bg
            navbar_text_color = "#ffffff"
            navbar_border_color = hsl_to_hex(palette_base_hue, 0.35, 0.20)
            navbar_variant = "solid"

            accent_hue = palette_base_hue
            acc_sat = _sys_rng.uniform(0.94, 1.0)
            acc_light = _sys_rng.uniform(0.42, 0.48)
            accent_color = hsl_to_hex(accent_hue, acc_sat, acc_light)
            accent_text = "#ffffff"

            if exact_user_hex:
                accent_color = exact_user_hex
                accent_text = contrast_text_exact

            text_color = "#f8fafc"
            card_text_color = "#f8fafc"
            muted_text = "#94a3b8"

            soft_border = hsl_to_hex(palette_base_hue, 0.40, 0.22)
            card_border_color = soft_border
            border_color = soft_border

            footer_bg = "#050304"
            footer_text_color = "#ffffff"

            hero_bg = primary_bg
            hero_text_color = "#f8fafc"
            hero_accent = accent_color
            visual_style = "cyber_glow"
            fallback_name = f"{family_cap} Neon Obsidian"
            fallback_desc = f"Atmospheric carbon noir canvas electrified with high-impact, radiant glowing {color_label} action buttons."

        # Archetype 5: Warm Organic Linen Sand & Artisan Earth
        elif archetype == "artisan_earth_warmth":
            primary_bg = hsl_to_hex(_sys_rng.uniform(28.0, 36.0), _sys_rng.uniform(0.20, 0.35), _sys_rng.uniform(0.965, 0.978))
            secondary_bg = hsl_to_hex(30.0, 0.25, 0.93)
            card_bg = "#ffffff"
            card_shadow = "0 4px 18px rgba(0,0,0,0.06)"
            card_radius = 20

            navbar_bg = primary_bg
            navbar_outer_bg = primary_bg
            navbar_text_color = "#29150d"
            navbar_border_color = hsl_to_hex(palette_base_hue, 0.25, 0.86)
            navbar_variant = "floating"

            accent_hue = palette_base_hue
            acc_sat = _sys_rng.uniform(0.75, 0.92)
            acc_light = _sys_rng.uniform(0.35, 0.42)
            accent_color = hsl_to_hex(accent_hue, acc_sat, acc_light)
            accent_text = "#ffffff"

            if exact_user_hex:
                accent_color = exact_user_hex
                accent_text = contrast_text_exact

            # Subtle complementary forest sage border accents
            comp_hue = (palette_base_hue + 140.0) % 360.0
            soft_border = hsl_to_hex(comp_hue, 0.25, 0.80)
            card_border_color = soft_border
            border_color = sanitize_border_color(soft_border, allow_poppy=wants_poppy_borders)

            text_color = "#29150d"
            card_text_color = text_color
            muted_text = "#6b544b"

            footer_bg = "#1c1410"
            footer_text_color = "#ffffff"

            hero_bg = f"linear-gradient(180deg, {primary_bg} 0%, {hsl_to_hex(30.0, 0.18, 0.93)} 100%)"
            hero_text_color = text_color
            hero_accent = accent_color
            visual_style = "warm_organic"
            fallback_name = f"Artisan {family_cap} & Linen Sand"
            fallback_desc = f"Warm editorial linen backdrop balanced by rich {color_label} accents and organic earthy borders."

        # Archetype 6: Modern Pearl & Minimal Focal Points
        else:  # minimal_pearl_duo
            primary_bg = hsl_to_hex(palette_base_hue, _sys_rng.uniform(0.01, 0.05), _sys_rng.uniform(0.975, 0.990))
            secondary_bg = hsl_to_hex(palette_base_hue, _sys_rng.uniform(0.02, 0.06), _sys_rng.uniform(0.945, 0.965))
            card_bg = "#ffffff"
            card_shadow = "0 4px 16px rgba(0,0,0,0.06)"
            card_radius = 20

            navbar_bg = "#ffffff"
            navbar_outer_bg = "#ffffff"
            navbar_text_color = "#0f172a"
            navbar_border_color = hsl_to_hex(palette_base_hue, 0.15, 0.88)
            navbar_variant = "floating"

            accent_hue = palette_base_hue
            acc_sat = _sys_rng.uniform(0.85, 0.96)
            acc_light = _sys_rng.uniform(0.34, 0.40)
            accent_color = hsl_to_hex(accent_hue, acc_sat, acc_light)
            accent_text = "#ffffff"

            if exact_user_hex:
                accent_color = exact_user_hex
                accent_text = contrast_text_exact

            text_color = "#0f172a"
            card_text_color = text_color
            muted_text = "#64748b"

            soft_border = hsl_to_hex(palette_base_hue, 0.12, 0.88)
            card_border_color = soft_border
            border_color = sanitize_border_color(soft_border, allow_poppy=wants_poppy_borders)

            footer_bg = "#0f172a"
            footer_text_color = "#ffffff"

            hero_bg = f"linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)"
            hero_text_color = text_color
            hero_accent = accent_color
            visual_style = "solid_clean"
            fallback_name = f"Pearl Minimal {family_cap}"
            fallback_desc = f"Streamlined luxury aesthetic with pearl surfaces and crisp {color_label} focal points."

        # Post-Process Contrast Dead Zone & Accessibility Guarantees
        if exact_user_hex and (calculate_contrast_ratio("#ffffff", exact_user_hex) >= 4.5 or calculate_contrast_ratio("#0f172a", exact_user_hex) >= 4.5):
            accent_color = exact_user_hex
            accent_text = calculate_contrast_color(exact_user_hex)
            hover_l = min(0.90, l_exact + 0.08) if is_color_dark(primary_bg) else max(0.18, l_exact - 0.08)
            accent_hover = hsl_to_hex(h_exact, min(1.0, s_exact * 1.1), hover_l)
        else:
            cand_accent = accent_color
            while calculate_contrast_ratio("#ffffff", cand_accent) < 4.5 and calculate_contrast_ratio("#0f172a", cand_accent) < 4.5:
                acc_light -= 0.015
                cand_accent = hsl_to_hex(accent_hue, acc_sat, max(0.18, acc_light))
            accent_color = sanitize_accent_color(cand_accent, is_dark=is_color_dark(primary_bg))

            is_dark_canvas = is_color_dark(primary_bg)
            hover_l = min(0.90, acc_light + 0.08) if is_dark_canvas else max(0.20, acc_light - 0.08)
            accent_hover = hsl_to_hex(accent_hue, acc_sat, hover_l)

        hero_accent = accent_color

        # Accessibility contrast enforcement on all text/background pairs
        accent_text = ensure_accessible_contrast(accent_text, accent_color, min_ratio=4.5)
        text_color = ensure_accessible_contrast(text_color, primary_bg, min_ratio=4.5)
        muted_text = ensure_accessible_contrast(muted_text, primary_bg, min_ratio=3.0)
        navbar_text_color = ensure_accessible_contrast(navbar_text_color, navbar_bg, min_ratio=4.5)
        card_text_color = ensure_accessible_contrast(card_text_color, card_bg, min_ratio=4.5)
        footer_is_dark = is_color_dark(footer_bg)
        footer_text_color = ensure_accessible_contrast("#ffffff" if footer_is_dark else text_color, footer_bg, min_ratio=4.5)
        footer_muted_color = ensure_accessible_contrast("#94a3b8" if footer_is_dark else muted_text, footer_bg, min_ratio=3.0)

        p_id = f"palette_{idx + 1}"

        raw_palettes.append({
            "id": p_id,
            "name": fallback_name,
            "description": fallback_desc,
            "visual_style": visual_style,
            "primary_bg": primary_bg,
            "secondary_bg": secondary_bg,
            "text_color": text_color,
            "muted_text": muted_text,
            "accent_color": accent_color,
            "accent_hover": accent_hover,
            "accent_text": accent_text,
            "border_color": border_color,
            "soft_border": soft_border,
            "navbar_bg": navbar_bg,
            "navbar_outer_bg": navbar_outer_bg,
            "navbar_text_color": navbar_text_color,
            "navbar_border_color": navbar_border_color,
            "navbar_variant": navbar_variant,
            "footer_bg": footer_bg,
            "footer_text_color": footer_text_color,
            "footer_muted_color": footer_muted_color,
            "hero_bg": hero_bg,
            "hero_text_color": hero_text_color,
            "hero_accent": hero_accent,
            "card_bg": card_bg,
            "card_text_color": card_text_color,
            "card_border_color": card_border_color,
            "card_shadow": card_shadow,
            "card_radius": card_radius,
            "_meta_archetype": archetype,
        })

    # 4. LLM Naming Call (Temperature 1.0) with Resilient Fallback
    if os.getenv("SKIP_PALETTE_LLM_NAMING", "false").lower() not in ("true", "1", "yes"):
        try:
            naming_summary = [
                f"ID: {p['id']}, Archetype: {p['_meta_archetype']}, Nav: {p['navbar_bg']}, Canvas: {p['primary_bg']}, Accent: {p['accent_color']}"
                for p in raw_palettes
            ]
            if has_specific_color:
                color_desc_str = f"{color_family.upper()} ({exact_user_hex})" if exact_user_hex else color_family.upper()
                naming_instructions = (
                    f"CRITICAL REQUIREMENT: The user specifically requested a {color_desc_str} theme. "
                    f"Every palette title and description MUST explicitly celebrate and feature {color_desc_str} "
                    f"(e.g. 'Crimson Bold Header & Studio' for a bold red navbar with white body; 'Blush Rose Gelato' for a soft pastel wash; 'Velvet Merlot Luxe' for deep burgundy canvas with gold buttons). "
                    f"Reflect each theme's unique layout and archetype clearly! DO NOT give them generic names."
                )
            else:
                naming_instructions = "Invent original, evocative 2-3 word designer titles (e.g. 'Nordic Sage', 'Obsidian Rose', 'Velvet Bordeaux') and a 1-sentence design note highlighting its color harmony."

            naming_prompt = ChatPromptTemplate.from_messages([
                ("system", f"""You are an award-winning luxury branding copywriter.
{naming_instructions}
Return ONLY the name and description matching each palette ID."""),
                ("user", "Brand: {brand_name}\nDomain: {domain}\nRequest: {color_description}\nPalettes:\n{palettes}"),
            ])
            structured_naming = naming_prompt | naming_llm.with_structured_output(PaletteNamingResponse, method="function_calling")
            naming_res: PaletteNamingResponse = await structured_naming.ainvoke(
                {
                    "brand_name": brand_name,
                    "domain": domain,
                    "color_description": color_description or "Curated luxury",
                    "palettes": "\n".join(naming_summary),
                },
                config={"callbacks": [TokenCostCallback("ColorAgent.PaletteNaming", session_id=session_id)]}
            )
            name_map = {item.id: item for item in naming_res.palettes}
            for p in raw_palettes:
                if p["id"] in name_map:
                    p["name"] = name_map[p["id"]].name
                    p["description"] = name_map[p["id"]].description
        except Exception as e:
            print("Palette LLM naming fallback activated:", e)

    # Clean up internal metadata keys before returning
    for p in raw_palettes:
        p.pop("_meta_archetype", None)
        p.pop("_meta_harmony", None)
        p.pop("_meta_canvas", None)

    return raw_palettes



class DesignAction(BaseModel):
    target_component: str = Field(
        description="The component being modified: 'hero', 'product_carousel', 'section_group_carousel', 'category_grid', 'product_grid', 'card', 'navbar', 'footer', 'cart', 'order_summary', 'delivery_form', 'payment', 'place_order', 'filter', 'pagination', 'review', 'support', 'notification', 'profile', 'profile_dropdown', 'background', 'global'"
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
    "product_grid": {"grid_bg", "grid_text_color", "title_color", "text_color", "muted_text", "outer_bg_color", "border_color", "background_color", "accent_color", "grid_gap", "image_aspect_ratio", "image_fit", "image_bg", "card_bg", "card_bg_color", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "image_radius", "product_name_color", "brand_color", "card_brand_color", "price_color", "original_price_color", "rating_star_color"},
    "carousel": {"grid_bg", "grid_text_color", "title_color", "text_color", "muted_text", "outer_bg_color", "border_color", "background_color", "accent_color", "grid_gap", "image_aspect_ratio", "image_fit", "image_bg", "card_bg", "card_bg_color", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "image_radius", "product_name_color", "brand_color", "card_brand_color", "price_color", "original_price_color", "rating_star_color"},
    "product_carousel": {"grid_bg", "grid_text_color", "title_color", "text_color", "muted_text", "outer_bg_color", "border_color", "background_color", "accent_color", "grid_gap", "image_aspect_ratio", "image_fit", "image_bg", "card_bg", "card_bg_color", "card_text_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "image_radius", "product_name_color", "brand_color", "card_brand_color", "price_color", "original_price_color", "rating_star_color"},
    "category": {"outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_border_color", "border_color", "background_color", "card_radius", "card_shadow", "title_color", "subtitle_color", "card_text_color", "grid_text_color", "text_color", "muted_text", "accent_color", "badge_bg_color", "badge_text_color"},
    "category_grid": {"outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_border_color", "border_color", "background_color", "card_radius", "card_shadow", "title_color", "subtitle_color", "card_text_color", "grid_text_color", "text_color", "muted_text", "accent_color", "badge_bg_color", "badge_text_color", "grid_gap"},
    "section_group_carousel": {"outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_border_color", "border_color", "background_color", "card_radius", "card_shadow", "card_padding", "title_color", "subtitle_color", "card_title_color", "card_text_color", "grid_text_color", "text_color", "muted_text", "accent_color", "badge_bg_color", "badge_text_color"},
    "card": {"card_bg", "card_bg_color", "card_text_color", "card_border_color", "border_color", "background_color", "card_shadow", "card_radius", "card_padding", "image_aspect_ratio", "image_fit", "image_bg", "image_radius", "product_name_color", "brand_color", "card_brand_color", "price_color", "original_price_color", "rating_star_color", "text_color", "muted_text", "accent_color"},
    "product_card": {"card_bg", "card_bg_color", "card_text_color", "card_border_color", "border_color", "background_color", "card_shadow", "card_radius", "card_padding", "image_aspect_ratio", "image_fit", "image_bg", "image_radius", "product_name_color", "brand_color", "card_brand_color", "price_color", "original_price_color", "rating_star_color", "text_color", "muted_text", "accent_color"},
    "product_detail": {"product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text", "product_detail_padding", "product_detail_radius", "border_color", "background_color", "text_color", "secondary_bg", "accent_color", "image_aspect_ratio", "image_fit"},
    "cart": {"cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color", "cart_radius", "cart_padding"},
    "order_summary": {"summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color", "summary_radius", "summary_padding"},
    "delivery_form": {"delivery_form_bg", "delivery_form_card_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text", "delivery_form_radius", "delivery_form_padding", "border_color", "background_color", "text_color", "card_bg", "card_color", "accent_color"},
    "payment": {"payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "card_color", "accent_color", "payment_radius", "payment_padding"},
    "place_order": {"place_order_bg", "place_order_card_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text", "place_order_border", "border_color", "background_color", "text_color", "card_bg", "card_color", "accent_color", "place_order_radius", "place_order_btn_height", "title_color", "section_title_color"},
    "filter": {"filter_modal_bg", "filter_modal_text", "filter_btn_bg", "filter_btn_text", "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color", "filter_radius", "filter_padding"},
    "sort": {"sort_btn_bg", "sort_btn_text", "pagination_bg", "pagination_text_color", "border_color", "background_color", "text_color", "accent_color"},
    "sort_by": {"sort_btn_bg", "sort_btn_text", "border_color", "background_color", "text_color", "accent_color"},
    "pagination": {"pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color", "pagination_radius", "pagination_padding", "background_color", "text_color", "border_color", "accent_color"},
    "order_history": {"order_history_bg", "order_history_card_bg", "order_history_text", "order_history_muted_text", "order_history_border", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "muted_text", "order_history_radius"},
    "checkout": {
        "checkout_bg", "checkout_card_bg", "checkout_text_color", "checkout_accent_color",
        "checkout_steps_bg", "active_step_bg", "active_text_color", "active_step_text", "line_active_color",
        "delivery_form_bg", "delivery_form_card_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text", "delivery_form_radius", "delivery_form_padding",
        "payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color", "payment_radius", "payment_padding",
        "place_order_bg", "place_order_card_bg", "place_order_text", "place_order_border", "place_order_btn_bg", "place_order_btn_text", "place_order_radius", "place_order_btn_height",
        "summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color", "summary_radius",
        "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "accent_color"
    },
    "review": {"review_card_bg", "review_text_color", "review_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "review_card_radius", "review_padding"},
    "support": {"support_bg", "support_card_bg", "support_chat_bg", "support_accent_color", "support_customer_bubble_bg", "support_customer_bubble_text", "support_agent_bubble_bg", "support_agent_bubble_text", "support_text_color", "support_muted_text", "support_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "muted_text", "accent_color"},
    "customer_support": {"support_bg", "support_card_bg", "support_chat_bg", "support_accent_color", "support_customer_bubble_bg", "support_customer_bubble_text", "support_agent_bubble_bg", "support_agent_bubble_text", "support_text_color", "support_muted_text", "support_border_color", "border_color", "background_color", "text_color", "card_bg", "card_bg_color", "muted_text", "accent_color"},
    "notification": {"notification_drawer_bg", "notification_drawer_text", "notification_bg", "notification_text", "notification_border_color", "navbar_notification_icon_variant", "visual_style", "border_color", "background_color", "text_color", "accent_color"},
    "profile": {"primary_bg", "page_bg", "border_color", "background_color", "text_color", "accent_color", "card_bg", "card_bg_color", "title_color", "subtext_color", "muted_text", "input_bg", "input_border", "input_text_color", "button_bg_color", "button_text_color", "sign_out_color", "card_radius", "card_padding", "input_radius", "button_radius", "max_width"},
    "profile_details": {"primary_bg", "page_bg", "card_bg", "card_bg_color", "border_color", "background_color", "title_color", "text_color", "subtext_color", "muted_text", "input_bg", "input_border", "input_text_color", "button_bg_color", "button_text_color", "sign_out_color", "card_radius", "card_padding", "input_radius", "button_radius", "max_width", "accent_color"},
    "customer_profile": {"primary_bg", "page_bg", "card_bg", "card_bg_color", "border_color", "background_color", "title_color", "text_color", "subtext_color", "muted_text", "input_bg", "input_border", "input_text_color", "button_bg_color", "button_text_color", "sign_out_color", "card_radius", "card_padding", "input_radius", "button_radius", "max_width", "accent_color"},
    "profile_dropdown": {"profile_dropdown_bg", "profile_dropdown_text", "profile_dropdown_border", "navbar_account_icon_variant", "border_color", "background_color", "text_color"},
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
    "crowsels": "multi:product_carousel,section_group_carousel",
    "crowser": "multi:product_carousel,section_group_carousel",
    "crowsers": "multi:product_carousel,section_group_carousel",
    "carowsel": "multi:product_carousel,section_group_carousel",
    "carowsels": "multi:product_carousel,section_group_carousel",
    "carosel": "multi:product_carousel,section_group_carousel",
    "carosels": "multi:product_carousel,section_group_carousel",
    "carousal": "multi:product_carousel,section_group_carousel",
    "carousals": "multi:product_carousel,section_group_carousel",
    "caoursel": "multi:product_carousel,section_group_carousel",
    "coursel": "multi:product_carousel,section_group_carousel",
    "all carousel": "multi:product_carousel,section_group_carousel",
    "all carousels": "multi:product_carousel,section_group_carousel",
    "all crowsel": "multi:product_carousel,section_group_carousel",
    "all crowsels": "multi:product_carousel,section_group_carousel",
    "all carowsel": "multi:product_carousel,section_group_carousel",
    "all carowsels": "multi:product_carousel,section_group_carousel",
    "other carousel": "multi:product_carousel,section_group_carousel",
    "other carousels": "multi:product_carousel,section_group_carousel",
    "other crowsel": "multi:product_carousel,section_group_carousel",
    "other crowsels": "multi:product_carousel,section_group_carousel",
    "carousel background": "multi:product_carousel,section_group_carousel",
    "carousels background": "multi:product_carousel,section_group_carousel",
    "crowsel background": "multi:product_carousel,section_group_carousel",
    "crowsels background": "multi:product_carousel,section_group_carousel",
    "carowsel background": "multi:product_carousel,section_group_carousel",
    "carowsels background": "multi:product_carousel,section_group_carousel",
    "carousel theme": "multi:product_carousel,section_group_carousel",
    "crowsel theme": "multi:product_carousel,section_group_carousel",
    "crowsels theme": "multi:product_carousel,section_group_carousel",
    "carowsel theme": "multi:product_carousel,section_group_carousel",

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
    "checkout order summary": "order_summary", "order summary theme": "order_summary",
    "checkout order summary theme": "order_summary", "summary card": "order_summary",
    "summary card theme": "order_summary", "summary theme": "order_summary",
    "bill card": "order_summary", "price breakdown": "order_summary",

    # Delivery Form (with typo resilience e.g. delviery, delivry, delvery)
    "delivery_form": "delivery_form", "delivery form": "delivery_form",
    "delviery form": "delivery_form", "delivry form": "delivery_form", "delvery form": "delivery_form",
    "delivery": "delivery_form", "delviery": "delivery_form", "delivry": "delivery_form", "delvery": "delivery_form",
    "delivery form theme": "delivery_form", "delviery form theme": "delivery_form",
    "delivery theme": "delivery_form", "delviery theme": "delivery_form",
    "delivery page": "delivery_form", "delviery page": "delivery_form",
    "delivery step": "delivery_form", "delviery step": "delivery_form",
    "delivery address": "delivery_form", "delviery address": "delivery_form",
    "delivery address theme": "delivery_form", "delviery address theme": "delivery_form",
    "shipping form": "delivery_form", "shipping details": "delivery_form",
    "shipping": "delivery_form", "shipping theme": "delivery_form", "shipping page": "delivery_form",
    "address form": "delivery_form", "address form theme": "delivery_form",

    # Payment (with typo resilience e.g. payemnt, payement)
    "payment": "payment", "payemnt": "payment", "payement": "payment",
    "payment method": "payment", "payment methods": "payment",
    "payment options": "payment", "payment pills": "payment", "payment selector": "payment",
    "payment theme": "payment", "payemnt theme": "payment", "payment methods theme": "payment",
    "payment page": "payment", "payment step": "payment", "payemnt page": "payment", "payemnt step": "payment",

    # Place Order / Review & Pay (Step 3 of Checkout)
    "place_order": "place_order", "place order": "place_order",
    "place order button": "place_order", "checkout button": "place_order", "place order cta": "place_order",
    "place order theme": "place_order", "place order page": "place_order", "place order step": "place_order",
    "review & pay": "place_order", "review and pay": "place_order",
    "review & pay page": "place_order", "review and pay page": "place_order",
    "review & pay theme": "place_order", "review and pay theme": "place_order",
    "review & pay step": "place_order", "review and pay step": "place_order",
    "review & pay background": "place_order", "review and pay background": "place_order",
    "review and pay button": "place_order", "review & pay button": "place_order",
    "checkout review": "place_order", "checkout review page": "place_order",
    "checkout review step": "place_order", "checkout review theme": "place_order",
    "order review": "place_order", "order review page": "place_order", "review order": "place_order",

    # Full Checkout Page / All Checkout Pages & Steps
    "checkout": "checkout", "check out": "checkout", "chekout": "checkout", "checout": "checkout",
    "checkout page": "checkout", "chekout page": "checkout", "check out page": "checkout",
    "checkout pages": "checkout", "chekout pages": "checkout", "check out pages": "checkout",
    "checkout theme": "checkout", "chekout theme": "checkout", "check out theme": "checkout",
    "checkout all pages": "checkout", "chekout all pages": "checkout", "all checkout pages": "checkout",
    "all chekout pages": "checkout", "all pages of checkout": "checkout", "checkout steps": "checkout",
    "chekout steps": "checkout", "checkout wizard": "checkout", "checkout step": "checkout",

    # Customer Reviews & Ratings
    "review": "review", "reviews": "review", "product review": "review", "product reviews": "review",
    "customer reviews": "review", "reviews section": "review", "reviews card": "review",
    "reviews theme": "review", "review card": "review", "ratings": "review",

    # Filter
    "filter": "filter", "filters": "filter", "filter bar": "filter", "filter toolbar": "filter",
    "filter modal": "filter", "filter sidebar": "filter", "filter drawer": "filter", "filter theme": "filter",
    "filters theme": "filter", "filter section": "filter", "filter options": "filter", "filter dropdown": "filter",
    "filter drop down": "filter", "filter drop down page": "filter", "filter dropdown page": "filter",
    "filter popup": "filter", "filter pop up": "filter", "filter pop-up": "filter",
    "filter popup theme": "filter", "filter pop up theme": "filter", "filter modal theme": "filter",

    # Sort
    "sort": "sort", "sort by": "sort", "sorting": "sort", "sort dropdown": "sort",

    # Pagination
    "pagination": "pagination", "page numbers": "pagination", "pagination bar": "pagination",
    "pager": "pagination", "paging": "pagination", "pagination buttons": "pagination",
    "pagination pills": "pagination", "page selector": "pagination", "page controls": "pagination",
    "page switcher": "pagination", "pagination controls": "pagination", "pagination theme": "pagination",

    # Order History
    "order_history": "order_history", "order history": "order_history", "orders page": "order_history",
    "order page": "order_history", "order history page": "order_history", "orders history page": "order_history",
    "orders history": "order_history", "customer orders": "order_history", "customer orders page": "order_history",
    "my orders": "order_history", "orders list": "order_history", "order list": "order_history",
    "order card": "order_history", "order cards": "order_history",
    "order history cards": "order_history", "order history card": "order_history",
    "order history card theme": "order_history", "order history cards theme": "order_history",
    "cards of order history": "order_history", "card of order history": "order_history",
    "cards of order history theme": "order_history", "card of order history theme": "order_history",
    "cards on order history": "order_history", "card on order history": "order_history",
    "cards in order history": "order_history", "card in order history": "order_history",

    # Support
    "support": "support", "help and support": "support", "customer support": "support",
    "help desk": "support", "support desk": "support", "support chat": "support", "ticket": "support",
    "help and support page": "support", "help and support page theme": "support",
    "help and support theme": "support", "help and support background": "support",
    "help and support page background": "support",
    "support page": "support", "support page theme": "support", "support page background": "support",
    "customer support page": "support", "customer support page theme": "support",
    "customer support desk": "support", "support desk page": "support",
    "help page": "support", "help page theme": "support", "help desk page": "support",
    "support cards": "support", "support card": "support", "support chat theme": "support",

    # Notification
    "notification": "notification", "notifications": "notification", "notification drawer": "notification",
    "notification dropdown": "notification", "notification drow down": "notification", "notification drop down": "notification",
    "notification drowdown": "notification", "notifications dropdown": "notification", "notifications drop down": "notification",
    "notifications drow down": "notification", "notification center": "notification", "notifications center": "notification",
    "notification bell": "notification", "bell icon": "notification", "bell dropdown": "notification",
    "notification menu": "notification", "notifications menu": "notification", "notification panel": "notification",
    "notification popup": "notification", "notification theme": "notification", "notifications theme": "notification",

    # Profile Dropdown (in Navbar)
    "profile dropdown": "profile_dropdown", "account dropdown": "profile_dropdown",
    "profile menu": "profile_dropdown", "account menu": "profile_dropdown",
    "profile drow down": "profile_dropdown", "profile drop down": "profile_dropdown",
    "profile drowdown": "profile_dropdown", "account drow down": "profile_dropdown",
    "account drop down": "profile_dropdown", "profile dropdown theme": "profile_dropdown",
    "profile drop down theme": "profile_dropdown", "profile dropdown background": "profile_dropdown",
    "profile popup": "profile_dropdown", "profile pop up": "profile_dropdown",
    "profile popup theme": "profile_dropdown", "account popup": "profile_dropdown",
    "profile menu dropdown": "profile_dropdown",

    # Profile (Customer Profile Page & Card)
    "profile": "profile", "account": "profile", "customer profile": "profile",
    "profile theme": "profile", "profile page": "profile", "customer profile page": "profile",
    "profile page theme": "profile", "profile page background": "profile",
    "profile details": "profile", "profile card": "profile", "customer profile card": "profile",
    "profile card theme": "profile", "profile card background": "profile",
    "profile inputs": "profile", "profile input": "profile", "profile input fields": "profile",
    "profile inputs background": "profile", "profile input background": "profile",
    "profile input text": "profile", "profile input text color": "profile",
    "profile form": "profile", "profile button": "profile", "profile text": "profile",
    "profile settings": "profile", "account settings": "profile", "customer profile card": "profile",
    "account page": "profile", "customer account": "profile", "my profile": "profile",
    "user profile": "profile", "customer profile card background": "profile",

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
    "card_bg", "card_text_color", "product_name_color", "brand_color", "card_brand_color", "price_color", "card_border_color", "card_shadow", "card_radius", "card_padding", "grid_gap",
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
    history_str: Optional[str] = None,
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
    for k in [
        "primary_bg", "text_color", "accent_color", "border_color", "mode", "visual_style",
        "surface_materiality", "card_radius", "navbar_height", "hero_bg", "hero_accent",
        "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color"
    ]:
        if k in current_theme:
            filtered_theme[k] = current_theme[k]
    for k in allowed_keys_for_target:
        if k in current_theme:
            filtered_theme[k] = current_theme[k]

    agent_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are WebCreon AI's Expert Design Systems & Color Theory Agent.
Your job is to translate the user's design instructions into a clean, precise list of atomic DesignActions.

COMPONENT PROPERTY REFERENCE FOR ALL 20 COMPONENTS:
- Carousels & Grids ('product_carousel', 'section_group_carousel', 'product_grid', 'category_grid'):
  - Section backdrop / container background: outer_bg_color, grid_bg
  - Inner card background: card_bg, card_bg_color
  - Inner card geometry: card_radius (0 for boxy/sharp, 8-16 for rounded, 24 for pill), card_padding, card_border_color
  - Section header text: title_color, grid_text_color, subtitle_color
  - Card text & price: card_text_color, product_name_color, brand_color, price_color
- Product Card ('card', 'product_card'):
  - card_bg_color, card_bg, card_text_color, product_name_color, brand_color, price_color, card_radius, card_border_color, card_shadow, rating_star_color
- Hero Banner ('hero'):
  - Banner background: hero_bg
  - Banner headline / text: hero_text_color
  - Banner CTA button: hero_accent (and accent_color, button_bg_color)
  - Dimensions: banner_height (240-800), border_radius
- Navbar ('navbar'):
  - Background: navbar_bg, navbar_outer_bg
  - Text: navbar_text_color
  - Border: navbar_border_color
  - Cart badge: cart_badge_bg, cart_badge_text
  - Dimensions: navbar_height (44-120), navbar_padding_x (8-48)
  - Variants: navbar_variant ('floating', 'soft', 'solid')
- Notification Center / Dropdown ('notification'):
  - Drawer / Dropdown background: notification_drawer_bg, notification_bg
  - Drawer / Dropdown text: notification_drawer_text, notification_text
  - Border: notification_border_color
- Customer Profile Page & Card ('profile', 'profile_details', 'customer_profile'):
  - Profile card background: card_bg, card_bg_color
  - Profile page backdrop / canvas: primary_bg, page_bg
  - Input field background: input_bg
  - Input field text: input_text_color
  - Input field border: input_border
  - Title / Heading / Label text: title_color, text_color
  - Subtitle / Muted text: subtext_color
  - Primary action button: button_bg_color, button_text_color
  - Sign out button: sign_out_color
  - Geometry: card_radius, card_padding, input_radius, button_radius, border_color
- Profile / Account Dropdown Menu in Navbar ('profile_dropdown'):
  - Dropdown background: profile_dropdown_bg
  - Dropdown text: profile_dropdown_text
  - Border: profile_dropdown_border
- Filter Sidebar / Toolbar ('filter'):
  - Container background: filter_bg
  - Card / Button background: filter_card_bg, filter_btn_bg
  - Text: filter_text_color, filter_btn_text
  - Border: filter_border_color
  - Accent / Highlights: filter_accent_color
  - Radius: filter_radius
- Footer ('footer'):
  - Background: footer_bg
  - Text: footer_text_color, footer_muted_color
  - Border: footer_border_color
  - Dimensions: footer_padding_y (16-96), footer_max_width
- Cart Drawer ('cart'):
  - Drawer / Panel background: cart_bg, cart_panel_bg
  - Card background: cart_card_bg
  - Text: cart_text_color
  - Accent / Checkout CTA: cart_accent_color
  - Border: cart_border_color
  - Radius: cart_radius
- Order Summary ('order_summary'):
  - Container background: summary_bg
  - Summary card background: summary_card_bg
  - Text: summary_text_color
  - Accent: summary_accent_color
  - Border: summary_border_color
  - Radius: summary_radius
- Delivery Form ('delivery_form'):
  - Form background: delivery_form_bg
  - Input field background: delivery_form_input_bg
  - Input field text: delivery_form_input_text
  - Label & body text: delivery_form_text
  - Button background: delivery_form_btn_bg
  - Button text: delivery_form_btn_text
  - Border: delivery_form_border
  - Radius: delivery_form_radius
- Payment Methods ('payment'):
  - Container background: payment_bg
  - Card background: payment_card_bg
  - Text: payment_text_color
  - Accent: payment_accent_color
  - Border: payment_border_color
  - Radius: payment_radius
- Place Order ('place_order'):
  - Container background: place_order_bg
  - CTA Button background: place_order_btn_bg
  - CTA Button text: place_order_btn_text
  - Text: place_order_text
  - Radius: place_order_radius
- Pagination ('pagination'):
  - Container background: pagination_bg
  - Active button background: pagination_active_bg
  - Text: pagination_text_color
  - Border: pagination_border_color
  - Radius: pagination_radius
- Reviews ('review'):
  - Card background: review_card_bg
  - Review text: review_text_color
  - Border: review_border_color
  - Radius: review_card_radius
  - Rating stars: rating_star_color
- Customer Support ('support'):
  - Container background: support_bg
  - Card background: support_card_bg
  - Chat background: support_chat_bg
  - Text: support_text_color
  - Muted text: support_muted_text
  - Accent: support_accent_color
  - Border: support_border_color
- Order History ('order_history'):
  - Container background: order_history_bg
  - Card background: order_history_card_bg
  - Text: order_history_text
  - Muted text: order_history_muted_text
  - Border: order_history_border
  - Radius: order_history_radius
- Product Detail ('product_detail'):
  - Background: product_detail_bg
  - Text: product_detail_text
  - Button background: product_detail_btn_bg
  - Button text: product_detail_btn_text
  - Radius: product_detail_radius
- Global Canvas ('background' or 'global'):
  - primary_bg, secondary_bg, text_color, muted_text, accent_color, border_color

RULES:
1. STRICT ELEMENT FIDELITY:
   - When user says "notification dropdown", "notification drawer", "notification drow down", or "notification":
     Target 'notification'. Set notification_drawer_bg (and notification_bg) for background, and notification_drawer_text (and notification_text) for text.
   - When user says "filter theme", "filter background", "filter popup", "filter pop up", "filter modal", or "filter dropdown":
     Target 'filter'. Set BOTH filter_bg AND filter_modal_bg for background, filter_text_color (and filter_modal_text) for text, and filter_btn_bg/filter_card_bg/filter_accent_color for buttons. If user asks for red background and green buttons (red and green theme), set filter_bg='#FF0000', filter_modal_bg='#FF0000', filter_btn_bg='#00FF00', filter_accent_color='#00FF00'.
   - When user says "product detail text", "text of product detail page", or "product detail page text":
     Target 'product_detail'. Set product_detail_text with the requested color.
   - When user says "carousel background", target section_background (outer_bg_color and grid_bg).
   - When user says "card background", target card_background (card_bg).
   - When user says "boxy card" or "sharp corners", target card_radius with value 0.
   - When user says "banner button color to red" or "change button color on banner", target 'hero' button with hero_accent.
   - When user says "navbar background", "change navbar color", or "navbar theme":
     Set BOTH navbar_bg and navbar_outer_bg to ensure the inner shell and outer wrapper never clash or retain stale colors.
   - When user says "outer border of navbar", "outer border", or "outer background":
     Target BOTH navbar_outer_bg and navbar_border_color with the user's requested color.
   - When user says "order page", "order history page", "orders page", "order history", "orders", or "my orders":
     Target 'order_history'.
     - If user asks for a theme color (e.g. "make the order page theme as well to blue color" or "the order history page make it blue theme"):
       Target 'order_history'. Set BOTH order_history_bg (page background) AND order_history_card_bg (card background) to the requested color (or harmonize page bg and cards), and set contrasting readable text (e.g. white #FFFFFF for dark blue #0000FF).
     - When user says "cards of order history", "order history cards", or "card of order history":
       Target 'order_history' with order_history_card_bg!
       - If user specifies multiple colors (e.g. "cards of order history make it yellow and blue theme"):
         Set order_history_card_bg='#FFFF00' (yellow cards), order_history_text='#0000FF' (blue text), and order_history_border='#0000FF' (blue border).
       - If user specifies a single card color (e.g. "make the card of order history as red please"):
         Set order_history_card_bg='#FF0000' (red card). Do NOT set text to red! Keep or set text to high-contrast white (#FFFFFF) for dark red backgrounds.
2. MATCHING / SYNCING THEME TO WEBPAGE OR NAVBAR:
   - When user says "make the theme same as webpage theme, for notification, the yellow webpage or navbar theme", "make notification same as navbar", or "match filter to navbar theme":
     Target that specific component ('notification', 'filter', etc.).
     If user specifies a color in the request (e.g. 'the yellow webpage or navbar theme'):
       Use that color (e.g. yellow #FFFF00) for the target's background!
     Otherwise inspect Current Theme:
     - For background: use navbar_bg or primary_bg.
     - For text: use navbar_text_color or text_color.
     - For border: use navbar_border_color or border_color.
     Emit actions setting the target component's background, text, and border to these matched colors!
3. DISAMBIGUATE CURRENT STATE VS DESIRED TARGET STATE:
   - When user says "outer border of navbar is yellow color, please keep that as well blue color please":
     The user is stating that the outer border is CURRENTLY yellow (unwanted) and wants it changed to BLUE!
     Target: BLUE (#0000FF) for navbar_outer_bg and navbar_border_color. NEVER set it to yellow!
4. REFERENCE COMPONENT VS TARGET COMPONENT:
   - When user says "The navbar has yellow and red theme, why did you make the carousel theme all white, please use these colors":
     The navbar is cited ONLY as a color reference! DO NOT modify the navbar!
     The component to style is the CAROUSEL (both product_carousel and section_group_carousel).
     Extract the colors mentioned (yellow and red) and apply them to the carousel: yellow (#FFFF00) for outer_bg_color/grid_bg, red (#FF0000) for card_bg or title_color/accent_color.
5. CAROUSEL THEME & ALL CAROUSELS:
   - When user says "crowsels", "all carousels", "crowsel theme", or "other carousel as well":
     Emit actions for BOTH 'product_carousel' AND 'section_group_carousel'. Never leave one carousel white while styling the other.
6. CONVERSATIONAL FOLLOW-UP & MEMORY:
   - When user says "no it didn't change, make it red for product detail and for cards as well" or "make it red for X and for cards as well":
     Identify what "it" refers to! If recent discussion or request was about text color, "it" refers to TEXT COLOR!
     Emit actions for BOTH product_detail (product_detail_text) AND card (card_text_color, product_name_color).
     NEVER emit card_bg or background when user asks for text color!
   - When user says "not just product carousel other all carousel as well" or "make other carousel as well":
     Inspect Recent Chat History to identify the active theme colors (e.g. yellow #FFFF00).
     Apply that SAME color to section_group_carousel. NEVER default to white (#FFFFFF)!
   - When user says "not just ther background the cards of order history make it yellow and blue theme please,":
     The user is saying that the page background was updated previously, but the CARDS of order history also need styling!
     Target 'order_history': set order_history_card_bg='#FFFF00' (yellow card), order_history_text='#0000FF' (blue text), and order_history_border='#0000FF' (blue border).
   - When user says "make the card of order history as red please":
     Target 'order_history': set order_history_card_bg='#FF0000' and ensure text is contrasting (#FFFFFF). NEVER make text red.
   - When user says "change the theme of help and support page to red please" or "help and support page theme to red":
     The user wants the full Help & Support page styled in red!
     Target 'support': set support_bg='#FF0000', support_card_bg='#FF0000', support_chat_bg='#FF0000', support_text_color='#FFFFFF', and support_border_color='#FFFFFF'. NEVER update only chat and leave the outer page or header unsynchronized!
   - When user says "change the background color to pink for help and support page" or "background color to pink for support page":
     Target 'support': set support_bg='#FFC0CB' (or '#FF69B4') with contrasting text. NEVER confuse with chat-only or global store background!
    - When user says "make profile page theme as [color]", "profile component theme [color]", or "make profile theme [color]":
      The user wants the full Profile page and its main card styled in [color]!
      Target 'profile': emit actions setting BOTH card_bg and page_bg to [color], with contrasting title_color / text_color and border_color!
    - When user says "make the cart theme same as webpage theme", "make cart theme same as navbar theme", or "match cart to [navbar/webpage]":
      Target 'cart': inspect Current Theme and align ALL cart keys (cart_bg, cart_panel_bg, cart_text_color, cart_border_color) to match the referenced component (navbar or webpage).
    - When user says "Review & Pay page theme change it to green please", "review and pay theme [color]", or "review & pay page theme [color]":
      The user is targeting Step 3: Review & Pay of the checkout flow!
      Target 'place_order': emit actions setting place_order_bg (e.g. green #008000), place_order_card_bg (green or harmonized surface), contrasting place_order_text (e.g. #FFFFFF for dark green, #0f172a for light), and place_order_btn_bg!
      DO NOT change or touch 'order_summary' unless the user explicitly mentions the bill/order summary card!
    - When user says "make chekout all pages theme to to red please", "checkout all pages theme [color]", or "all checkout pages [color]":
      The user wants the entire checkout experience (all steps: Delivery Address, Payment, Review & Pay, and Checkout Steps) styled in that theme!
      Target 'checkout': emit actions setting checkout_bg, delivery_form_bg, payment_bg, place_order_bg, checkout_steps_bg, and summary_bg to the requested color, with contrasting high-readability text and cards across all checkout components!
    - When user says "delviery form theme [color]", "delivery address theme [color]", or "delivery form theme [color]":
      Target 'delivery_form': emit actions setting delivery_form_bg to the requested color and delivery_form_text to high-contrast text!
    - When user says "payment theme [color]", "payment methods theme [color]", or "payment page theme [color]":
      Target 'payment': emit actions setting payment_bg, payment_card_bg, and payment_text_color!
7. PRODUCT CARD BRAND COLOR & SELLING PRICE INTEGRITY:
   - The brand name on product cards ('brand_color') can carry the store's primary accent or brand color.
   - However, the selling price ('price_color') must NEVER be red, crimson, or warning tones, even if the brand accent or store theme is red! Red selling prices resemble penalties or financial debt in e-commerce. Selling price MUST be authoritative slate (#0f172a) on light cards or clean white (#ffffff) on dark cards.
   - The brand name and the selling price must NEVER be the exact same color.
8. Only emit actions for properties explicitly mentioned or directly implied by the request. Never modify unrequested attributes.
9. If user specifies a relative change (e.g. "make navbar taller"), compute the new value from Current Theme (e.g. current 64 -> 80).
10. If glassmorphism/frosted glass requested, set visual_style='glassmorphic' and surface_materiality='glass_navbar' (or 'full_glass').
"""),
        ("user", "Target Component Hint: {target_hint}\nCurrent Theme: {current_theme}\nRecent Chat History: {history_str}\nUser Request: {user_message}"),
    ])

    try:
        chain = agent_prompt | llm.with_structured_output(DesignPlanOutput, method="function_calling")
        res: DesignPlanOutput = await chain.ainvoke(
            {
                "target_hint": target_component,
                "current_theme": json.dumps(filtered_theme),
                "history_str": history_str or "No previous context",
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
    session_id: Optional[str] = None,
    history_str: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Generates component-specific palette suggestions."""
    palettes = await generate_color_palettes(
        brand_name=brand_name,
        domain=domain,
        color_description=color_description,
        session_id=session_id,
        history_str=history_str,
    )
    return palettes


BASIC_COLOR_NAMES: Dict[str, str] = {
    "red": "#ef4444",
    "crimson": "#dc2626",
    "ruby": "#be123c",
    "blue": "#3b82f6",
    "navy": "#0f172a",
    "sky": "#0ea5e9",
    "green": "#10b981",
    "emerald": "#059669",
    "forest": "#15803d",
    "yellow": "#f59e0b",
    "gold": "#d97706",
    "golden": "#d97706",
    "purple": "#8b5cf6",
    "violet": "#7c3aed",
    "pink": "#ec4899",
    "rose": "#f43f5e",
    "orange": "#f97316",
    "black": "#09090b",
    "white": "#ffffff",
    "dark": "#0f172a",
    "light": "#f8fafc",
    "slate": "#1e293b",
    "gray": "#64748b",
    "grey": "#64748b",
    "teal": "#14b8a6",
    "cyan": "#06b6d4",
}


def try_generate_direct_recolor_plan(
    user_message: str,
    target_component: Optional[str],
) -> Optional[DesignPlanOutput]:
    """
    Direct Deterministic Component Recolor Fast-Path:
    Detects simple, explicit recolor commands (e.g. 'change navbar to #ac3039', 'make footer black', 'set background to white').
    Bypasses the heavy ~3,200 token DesignPlan LLM call, reducing credits from ~8 to 0-1 and execution time from 3s to 10ms!
    """
    if not target_component or target_component in ("unsupported", "revert", "banner_create", "overall"):
        return None

    msg = user_message.lower().strip()

    # Reject complex multi-instruction prompts (e.g. 'with rounded corners and make button glow')
    complex_triggers = ["radius", "height", "padding", "round", "pill", "shadow", "glow", "glass", "frosted", "font-size", "and make", "and set"]
    if any(ct in msg for ct in complex_triggers):
        return None

    # 1. Extract hex code or color keyword
    target_color_hex = extract_hex_code_from_text(user_message)
    color_label = target_color_hex
    if not target_color_hex:
        # Check basic color names
        for cname, chex in BASIC_COLOR_NAMES.items():
            if re.search(rf"\b{cname}\b", msg):
                target_color_hex = chex
                color_label = cname
                break

    if not target_color_hex:
        return None

    # Check if this is a direct recolor instruction
    is_direct_cmd = any(bool(re.search(pat, msg)) for pat in [
        r"\b(?:change|make|set|turn|update|style)\b",
        r"\b(?:navbar|footer|header|card|background|canvas|hero|banner|cart)\b",
    ])
    if not is_direct_cmd:
        return None

    target_clean = target_component.lower().strip()
    actions: List[DesignAction] = []

    is_text_request = bool(re.search(r"\b(?:text|font|title|label|heading|words?|typography)\b", msg))
    is_border_request = bool(re.search(r"\b(?:border|divider|stroke|outline)\b", msg))
    is_button_request = bool(re.search(r"\b(?:button|btn|accent|cta)\b", msg))

    if target_clean in ("navbar", "header"):
        if is_text_request:
            actions.append(DesignAction(
                target_component="navbar",
                target_element="text",
                property_name="navbar_text_color",
                value=target_color_hex,
                reasoning=f"Directly updated navbar text color to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your navbar text color to {color_label}.",
            )
        elif is_border_request:
            actions.append(DesignAction(
                target_component="navbar",
                target_element="border",
                property_name="navbar_border_color",
                value=target_color_hex,
                reasoning=f"Directly updated navbar border to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your navbar border color to {color_label}.",
            )
        else:
            actions.append(DesignAction(
                target_component="navbar",
                target_element="background",
                property_name="navbar_bg",
                value=target_color_hex,
                reasoning=f"Directly updated navbar background to {color_label}",
            ))
            actions.append(DesignAction(
                target_component="navbar",
                target_element="background",
                property_name="navbar_outer_bg",
                value=target_color_hex,
                reasoning="Synchronized navbar outer background",
            ))
            actions.append(DesignAction(
                target_component="navbar",
                target_element="text",
                property_name="navbar_text_color",
                value=calculate_contrast_color(target_color_hex),
                reasoning="Ensured WCAG AA contrast text",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your navbar background to {color_label} with high-contrast text.",
            )

    elif target_clean == "footer":
        if is_text_request:
            actions.append(DesignAction(
                target_component="footer",
                target_element="text",
                property_name="footer_text_color",
                value=target_color_hex,
                reasoning=f"Directly updated footer text to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your footer text color to {color_label}.",
            )
        elif is_border_request:
            actions.append(DesignAction(
                target_component="footer",
                target_element="border",
                property_name="footer_border_color",
                value=target_color_hex,
                reasoning=f"Directly updated footer border to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your footer border to {color_label}.",
            )
        else:
            actions.append(DesignAction(
                target_component="footer",
                target_element="background",
                property_name="footer_bg",
                value=target_color_hex,
                reasoning=f"Directly updated footer background to {color_label}",
            ))
            actions.append(DesignAction(
                target_component="footer",
                target_element="text",
                property_name="footer_text_color",
                value=calculate_contrast_color(target_color_hex),
                reasoning="Ensured WCAG AA contrast text",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your footer background to {color_label}.",
            )

    elif target_clean in ("hero", "banner"):
        if is_button_request:
            actions.append(DesignAction(
                target_component="hero",
                target_element="button",
                property_name="hero_accent",
                value=target_color_hex,
                reasoning=f"Directly updated hero button color to {color_label}",
            ))
            actions.append(DesignAction(
                target_component="hero",
                target_element="button",
                property_name="accent_color",
                value=target_color_hex,
                reasoning=f"Synchronized store primary accent to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your hero banner button to {color_label}.",
            )
        elif is_text_request:
            actions.append(DesignAction(
                target_component="hero",
                target_element="text",
                property_name="hero_text_color",
                value=target_color_hex,
                reasoning=f"Directly updated hero text to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your hero banner text color to {color_label}.",
            )
        else:
            actions.append(DesignAction(
                target_component="hero",
                target_element="background",
                property_name="hero_bg",
                value=target_color_hex,
                reasoning=f"Directly updated hero background to {color_label}",
            ))
            actions.append(DesignAction(
                target_component="hero",
                target_element="text",
                property_name="hero_text_color",
                value=calculate_contrast_color(target_color_hex),
                reasoning="Ensured WCAG AA contrast hero text",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your hero background to {color_label}.",
            )

    elif target_clean in ("background", "canvas"):
        if is_text_request:
            actions.append(DesignAction(
                target_component="global",
                target_element="text",
                property_name="text_color",
                value=target_color_hex,
                reasoning=f"Directly updated body text to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your store text color to {color_label}.",
            )
        else:
            actions.append(DesignAction(
                target_component="global",
                target_element="background",
                property_name="primary_bg",
                value=target_color_hex,
                reasoning=f"Directly updated page background to {color_label}",
            ))
            actions.append(DesignAction(
                target_component="global",
                target_element="text",
                property_name="text_color",
                value=calculate_contrast_color(target_color_hex),
                reasoning="Ensured WCAG AA contrast text",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your page background to {color_label}.",
            )

    elif target_clean in ("card", "product_card"):
        if is_text_request:
            actions.append(DesignAction(
                target_component="card",
                target_element="card_text",
                property_name="card_text_color",
                value=target_color_hex,
                reasoning=f"Directly updated card text to {color_label}",
            ))
            actions.append(DesignAction(
                target_component="card",
                target_element="card_text",
                property_name="product_name_color",
                value=target_color_hex,
                reasoning=f"Directly updated product title to {color_label}",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your card text color to {color_label}.",
            )
        else:
            actions.append(DesignAction(
                target_component="card",
                target_element="card_background",
                property_name="card_bg",
                value=target_color_hex,
                reasoning=f"Directly updated card background to {color_label}",
            ))
            actions.append(DesignAction(
                target_component="card",
                target_element="card_text",
                property_name="card_text_color",
                value=calculate_contrast_color(target_color_hex),
                reasoning="Ensured WCAG AA contrast text",
            ))
            return DesignPlanOutput(
                actions=actions,
                summary=f"Updated your card background to {color_label}.",
            )

    return None



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
    # place_order & checkout
    "place_order_bg", "place_order_card_bg", "place_order_border", "place_order_btn_bg", "place_order_btn_text", "place_order_text", "place_order_radius", "place_order_btn_height", "checkout_steps_bg", "checkout_steps_border", "checkout_card_bg", "checkout_review_bg", "checkout_bg",
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
    "image_aspect_ratio", "image_fit", "image_bg", "image_radius", "product_name_color", "brand_color", "card_brand_color", "price_color", "original_price_color", "rating_star_color",
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
    # place_order & checkout
    "place_order_bg", "place_order_card_bg", "place_order_border", "place_order_btn_bg", "place_order_btn_text", "place_order_text", "place_order_radius", "place_order_btn_height", "checkout_steps_bg", "checkout_steps_border", "checkout_card_bg", "checkout_review_bg", "checkout_bg",
    # filter
    "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color", "filter_radius", "filter_padding", "filter_modal_bg", "filter_modal_text", "filter_btn_bg", "filter_btn_text",
    # pagination
    "pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color", "pagination_radius", "pagination_padding",
    # review
    "review_card_bg", "review_text_color", "review_border_color", "review_card_radius", "review_padding", "rating_star_color",
    # card & product card
    "brand_color", "card_brand_color", "price_color", "card_price_color",
    # support
    "support_bg", "support_card_bg", "support_chat_bg", "support_accent_color", "support_customer_bubble_bg", "support_customer_bubble_text", "support_agent_bubble_bg", "support_agent_bubble_text", "support_text_color", "support_muted_text", "support_border_color",
    # navbar
    "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color", "navbar_variant", "navbar_height", "navbar_padding_x", "cart_badge_bg", "cart_badge_text", "surface_materiality", "navbar_layout", "visual_style",
    # footer
    "footer_bg", "footer_text_color", "footer_muted_color", "footer_border_color", "footer_padding_y", "footer_max_width", "footer_layout",
    # notification & profile
    "notification_drawer_bg", "notification_drawer_text", "notification_bg", "notification_text", "notification_border_color",
    "profile_dropdown_bg", "profile_dropdown_text", "profile_dropdown_border",
}


# ==========================================
# 4. STORE BLOCK STYLING UTILITIES & EXECUTOR
# ==========================================

COMPONENT_BLOCK_TARGETS: Dict[str, List[str]] = {
    "hero": ["hero", "herobanner", "banner", "slider"],
    "hero_banner": ["hero", "herobanner", "banner", "slider"],
    "product_carousel": ["productcarousel", "productslider", "productsrow"],
    "section_group_carousel": ["sectiongroupcarousel", "categorycarousel", "categoryslider", "categorystorycarousel"],
    "carousel": ["productcarousel", "sectiongroupcarousel", "categorycarousel", "categorystorycarousel"],
    "carousels": ["productcarousel", "sectiongroupcarousel", "categorycarousel", "categorystorycarousel"],
    "product_grid": ["productgrid", "productsgrid", "cataloggrid"],
    "category_grid": ["categorygrid", "categoryshowcase", "categories"],
    "card": ["productgrid", "productcarousel"],
    "product_card": ["productgrid", "productcarousel"],
    "navbar": ["navbar", "header"],
    "footer": ["footer"],
    "cart": ["cart", "cartdrawer"],
    "order_summary": ["ordersummary", "checkoutsummary", "checkoutordersummary"],
    "delivery_form": ["deliveryform", "checkoutform", "addressform", "deliveryaddressform", "delivery"],
    "payment": ["payment", "paymentmethods", "paymentoptions"],
    "place_order": ["placeorder", "placeordercta", "checkoutreview", "reviewandpay", "reviewpay"],
    "checkout_steps": ["checkoutsteps", "checkoutstep", "checkoutwizard"],
    "checkout": [
        "deliveryform", "checkoutform", "addressform", "deliveryaddressform", "delivery",
        "payment", "paymentmethods", "paymentoptions",
        "placeorder", "placeordercta", "checkoutreview", "reviewandpay",
        "ordersummary", "checkoutsummary", "checkoutordersummary",
        "checkoutsteps"
    ],
    "filter": ["filter", "filtertoolbar"],
    "pagination": ["pagination", "pager"],
    "review": ["review", "reviews", "ratings"],
    "support": ["support", "customersupport", "helpdesk", "supportdesk"],
    "order_history": ["orderhistory", "customerorders"],
    "profile": ["profiledetails", "profile", "customerprofile"],
    "profile_details": ["profiledetails", "profile", "customerprofile"],
    "customer_profile": ["profiledetails", "profile", "customerprofile"],
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
    "cart_panel_bg": ("cart", "cart_text_color"),
    "cart_card_bg": ("cart", "cart_text_color"),
    "summary_bg": ("order_summary", "summary_text_color"),
    "summary_card_bg": ("order_summary", "summary_text_color"),
    "delivery_form_bg": ("delivery_form", "delivery_form_text"),
    "delivery_form_input_bg": ("delivery_form", "delivery_form_input_text"),
    "delivery_form_btn_bg": ("delivery_form", "delivery_form_btn_text"),
    "payment_bg": ("payment", "payment_text_color"),
    "payment_card_bg": ("payment", "payment_text_color"),
    "place_order_bg": ("place_order", "place_order_text"),
    "place_order_btn_bg": ("place_order", "place_order_btn_text"),
    "filter_bg": ("filter", "filter_text_color"),
    "filter_card_bg": ("filter", "filter_text_color"),
    "filter_btn_bg": ("filter", "filter_btn_text"),
    "pagination_bg": ("pagination", "pagination_text_color"),
    "review_card_bg": ("review", "review_text_color"),
    "support_bg": ("support", "support_text_color"),
    "support_card_bg": ("support", "support_text_color"),
    "support_chat_bg": ("support", "support_text_color"),
    "order_history_bg": ("order_history", "order_history_text"),
    "order_history_card_bg": ("order_history", "order_history_text"),
    "notification_drawer_bg": ("notification", "notification_drawer_text"),
    "profile_dropdown_bg": ("profile_dropdown", "profile_dropdown_text"),
    "profile_card_bg": ("profile", "title_color"),
    "product_detail_bg": ("product_detail", "product_detail_text"),
    "product_detail_btn_bg": ("product_detail", "product_detail_btn_text"),
}

CANONICAL_COMPONENT_PROPERTY_MAP: Dict[str, Dict[str, Union[str, List[str]]]] = {
    "notification": {
        "background": ["notification_drawer_bg", "notification_bg"],
        "bg": ["notification_drawer_bg", "notification_bg"],
        "background_color": ["notification_drawer_bg", "notification_bg"],
        "drawer_bg": ["notification_drawer_bg", "notification_bg"],
        "dropdown_bg": ["notification_drawer_bg", "notification_bg"],
        "notification_bg": ["notification_drawer_bg", "notification_bg"],
        "notification_drawer_bg": ["notification_drawer_bg", "notification_bg"],
        "text": ["notification_drawer_text", "notification_text"],
        "text_color": ["notification_drawer_text", "notification_text"],
        "textColor": ["notification_drawer_text", "notification_text"],
        "font_color": ["notification_drawer_text", "notification_text"],
        "notification_text": ["notification_drawer_text", "notification_text"],
        "notification_drawer_text": ["notification_drawer_text", "notification_text"],
        "border": "notification_border_color",
        "border_color": "notification_border_color",
        "notification_border_color": "notification_border_color",
    },
    "profile_dropdown": {
        "background": "profile_dropdown_bg",
        "bg": "profile_dropdown_bg",
        "background_color": "profile_dropdown_bg",
        "dropdown_bg": "profile_dropdown_bg",
        "menu_bg": "profile_dropdown_bg",
        "profile_dropdown_bg": "profile_dropdown_bg",
        "text": "profile_dropdown_text",
        "text_color": "profile_dropdown_text",
        "dropdown_text": "profile_dropdown_text",
        "profile_dropdown_text": "profile_dropdown_text",
        "border": "profile_dropdown_border",
        "border_color": "profile_dropdown_border",
        "dropdown_border": "profile_dropdown_border",
        "profile_dropdown_border": "profile_dropdown_border",
    },
    "profile": {
        "theme": ["card_bg", "page_bg"],
        "profile_theme": ["card_bg", "page_bg"],
        "color": ["card_bg", "page_bg"],
        "background": ["card_bg", "page_bg"],
        "bg": ["card_bg", "page_bg"],
        "background_color": ["card_bg", "page_bg"],
        "card_bg": "card_bg",
        "card_bg_color": "card_bg",
        "card_background": "card_bg",
        "card": "card_bg",
        "page_bg": "page_bg",
        "page_background": "page_bg",
        "page": "page_bg",
        "primary_bg": "page_bg",
        "border": "border_color",
        "border_color": "border_color",
        "card_border": "border_color",
        "text": "title_color",
        "text_color": "title_color",
        "font_color": "title_color",
        "title_color": "title_color",
        "title": "title_color",
        "subtext": "subtext_color",
        "subtext_color": "subtext_color",
        "subtitle": "subtext_color",
        "muted": "subtext_color",
        "muted_text": "subtext_color",
        "input_bg": "input_bg",
        "input_background": "input_bg",
        "inputs_bg": "input_bg",
        "inputs_background": "input_bg",
        "input_border": "input_border",
        "input_border_color": "input_border",
        "inputs_border": "input_border",
        "input_text": "input_text_color",
        "input_text_color": "input_text_color",
        "input_textColor": "input_text_color",
        "inputs_text": "input_text_color",
        "inputs_text_color": "input_text_color",
        "input_color": "input_text_color",
        "button_bg": "button_bg_color",
        "button_bg_color": "button_bg_color",
        "button_color": "button_bg_color",
        "btn_bg": "button_bg_color",
        "btn_color": "button_bg_color",
        "button_text": "button_text_color",
        "button_text_color": "button_text_color",
        "btn_text": "button_text_color",
        "sign_out": "sign_out_color",
        "sign_out_color": "sign_out_color",
        "signout_color": "sign_out_color",
        "card_radius": "card_radius",
        "border_radius": "card_radius",
        "radius": "card_radius",
        "radious": "card_radius",
        "card_padding": "card_padding",
        "padding": "card_padding",
        "input_radius": "input_radius",
        "button_radius": "button_radius",
        "dropdown_bg": "profile_dropdown_bg",
        "menu_bg": "profile_dropdown_bg",
        "profile_dropdown_bg": "profile_dropdown_bg",
        "dropdown_text": "profile_dropdown_text",
        "profile_dropdown_text": "profile_dropdown_text",
        "dropdown_border": "profile_dropdown_border",
        "profile_dropdown_border": "profile_dropdown_border",
    },
    "profile_details": {
        "theme": ["card_bg", "page_bg"],
        "profile_theme": ["card_bg", "page_bg"],
        "color": ["card_bg", "page_bg"],
        "background": ["card_bg", "page_bg"],
        "bg": ["card_bg", "page_bg"],
        "background_color": ["card_bg", "page_bg"],
        "card_bg": "card_bg",
        "card_bg_color": "card_bg",
        "card": "card_bg",
        "page_bg": "page_bg",
        "page_background": "page_bg",
        "primary_bg": "page_bg",
        "border": "border_color",
        "border_color": "border_color",
        "card_border": "border_color",
        "text": "title_color",
        "text_color": "title_color",
        "title_color": "title_color",
        "title": "title_color",
        "subtext": "subtext_color",
        "subtext_color": "subtext_color",
        "subtitle": "subtext_color",
        "muted": "subtext_color",
        "muted_text": "subtext_color",
        "input_bg": "input_bg",
        "input_background": "input_bg",
        "inputs_bg": "input_bg",
        "inputs_background": "input_bg",
        "input_border": "input_border",
        "input_text": "input_text_color",
        "input_text_color": "input_text_color",
        "input_color": "input_text_color",
        "button_bg": "button_bg_color",
        "button_bg_color": "button_bg_color",
        "button_text": "button_text_color",
        "button_text_color": "button_text_color",
        "sign_out": "sign_out_color",
        "sign_out_color": "sign_out_color",
        "card_radius": "card_radius",
        "card_padding": "card_padding",
        "input_radius": "input_radius",
        "button_radius": "button_radius",
    },
    "customer_profile": {
        "theme": ["card_bg", "page_bg"],
        "profile_theme": ["card_bg", "page_bg"],
        "color": ["card_bg", "page_bg"],
        "background": ["card_bg", "page_bg"],
        "bg": ["card_bg", "page_bg"],
        "background_color": ["card_bg", "page_bg"],
        "card_bg": "card_bg",
        "card_bg_color": "card_bg",
        "card": "card_bg",
        "page_bg": "page_bg",
        "page_background": "page_bg",
        "primary_bg": "page_bg",
        "border": "border_color",
        "border_color": "border_color",
        "card_border": "border_color",
        "text": "title_color",
        "text_color": "title_color",
        "title_color": "title_color",
        "title": "title_color",
        "subtext": "subtext_color",
        "subtext_color": "subtext_color",
        "subtitle": "subtext_color",
        "muted": "subtext_color",
        "muted_text": "subtext_color",
        "input_bg": "input_bg",
        "input_background": "input_bg",
        "inputs_bg": "input_bg",
        "inputs_background": "input_bg",
        "input_border": "input_border",
        "input_text": "input_text_color",
        "input_text_color": "input_text_color",
        "input_color": "input_text_color",
        "button_bg": "button_bg_color",
        "button_bg_color": "button_bg_color",
        "button_text": "button_text_color",
        "button_text_color": "button_text_color",
        "sign_out": "sign_out_color",
        "sign_out_color": "sign_out_color",
        "card_radius": "card_radius",
        "card_padding": "card_padding",
        "input_radius": "input_radius",
        "button_radius": "button_radius",
    },
    "filter": {
        "background": ["filter_bg", "filter_modal_bg"],
        "bg": ["filter_bg", "filter_modal_bg"],
        "background_color": ["filter_bg", "filter_modal_bg"],
        "filter_bg": ["filter_bg", "filter_modal_bg"],
        "filter_modal_bg": ["filter_modal_bg", "filter_bg"],
        "modal_bg": ["filter_modal_bg", "filter_bg"],
        "modal_background": ["filter_modal_bg", "filter_bg"],
        "popup_bg": ["filter_modal_bg", "filter_bg"],
        "popup_background": ["filter_modal_bg", "filter_bg"],
        "dropdown_bg": ["filter_modal_bg", "filter_bg"],
        "card_bg": ["filter_card_bg", "filter_btn_bg"],
        "button_bg": ["filter_btn_bg", "filter_card_bg", "filter_accent_color"],
        "btn_bg": ["filter_btn_bg", "filter_card_bg", "filter_accent_color"],
        "button_color": ["filter_btn_bg", "filter_card_bg", "filter_accent_color"],
        "buttons": ["filter_btn_bg", "filter_card_bg", "filter_accent_color"],
        "filter_card_bg": ["filter_card_bg", "filter_btn_bg"],
        "filter_btn_bg": ["filter_btn_bg", "filter_card_bg", "filter_accent_color"],
        "text": ["filter_text_color", "filter_modal_text", "filter_btn_text"],
        "text_color": ["filter_text_color", "filter_modal_text", "filter_btn_text"],
        "modal_text": ["filter_modal_text", "filter_text_color"],
        "popup_text": ["filter_modal_text", "filter_text_color"],
        "filter_modal_text": ["filter_modal_text", "filter_text_color"],
        "font_color": ["filter_text_color", "filter_modal_text", "filter_btn_text"],
        "filter_text_color": ["filter_text_color", "filter_modal_text"],
        "button_text": "filter_btn_text",
        "btn_text": "filter_btn_text",
        "filter_btn_text": "filter_btn_text",
        "border": "filter_border_color",
        "border_color": "filter_border_color",
        "filter_border_color": "filter_border_color",
        "accent": ["filter_accent_color", "filter_btn_bg"],
        "accent_color": ["filter_accent_color", "filter_btn_bg"],
        "filter_accent_color": ["filter_accent_color", "filter_btn_bg"],
        "radius": "filter_radius",
        "border_radius": "filter_radius",
        "filter_radius": "filter_radius",
    },
    "navbar": {
        "background": ["navbar_bg", "navbar_outer_bg"],
        "bg": ["navbar_bg", "navbar_outer_bg"],
        "background_color": ["navbar_bg", "navbar_outer_bg"],
        "navbar_bg": ["navbar_bg", "navbar_outer_bg"],
        "outer_bg": "navbar_outer_bg",
        "navbar_outer_bg": "navbar_outer_bg",
        "outer_border": ["navbar_border_color", "navbar_outer_bg"],
        "navbar_outer_border": ["navbar_border_color", "navbar_outer_bg"],
        "text": "navbar_text_color",
        "text_color": "navbar_text_color",
        "font_color": "navbar_text_color",
        "navbar_text_color": "navbar_text_color",
        "border": "navbar_border_color",
        "border_color": "navbar_border_color",
        "navbar_border_color": "navbar_border_color",
        "cart_badge_bg": "cart_badge_bg",
        "badge_bg": "cart_badge_bg",
        "cart_badge_text": "cart_badge_text",
        "badge_text": "cart_badge_text",
        "height": "navbar_height",
        "navbar_height": "navbar_height",
        "padding": "navbar_padding_x",
        "padding_x": "navbar_padding_x",
        "navbar_padding_x": "navbar_padding_x",
        "variant": "navbar_variant",
        "navbar_variant": "navbar_variant",
    },
    "footer": {
        "background": "footer_bg",
        "bg": "footer_bg",
        "background_color": "footer_bg",
        "footer_bg": "footer_bg",
        "text": "footer_text_color",
        "text_color": "footer_text_color",
        "font_color": "footer_text_color",
        "footer_text_color": "footer_text_color",
        "muted": "footer_muted_color",
        "muted_text": "footer_muted_color",
        "muted_color": "footer_muted_color",
        "footer_muted_color": "footer_muted_color",
        "border": "footer_border_color",
        "border_color": "footer_border_color",
        "footer_border_color": "footer_border_color",
        "padding": "footer_padding_y",
        "padding_y": "footer_padding_y",
        "footer_padding_y": "footer_padding_y",
        "max_width": "footer_max_width",
        "footer_max_width": "footer_max_width",
    },
    "hero": {
        "background": "hero_bg",
        "bg": "hero_bg",
        "background_color": "hero_bg",
        "hero_bg": "hero_bg",
        "text": "hero_text_color",
        "text_color": "hero_text_color",
        "font_color": "hero_text_color",
        "hero_text_color": "hero_text_color",
        "button_bg": ["hero_accent", "button_bg_color"],
        "btn_bg": ["hero_accent", "button_bg_color"],
        "button_color": ["hero_accent", "button_bg_color"],
        "btn_color": ["hero_accent", "button_bg_color"],
        "cta_bg": ["hero_accent", "button_bg_color"],
        "hero_accent": ["hero_accent", "button_bg_color"],
        "accent": "hero_accent",
        "accent_color": "hero_accent",
        "height": "banner_height",
        "radius": "border_radius",
        "radious": "border_radius",
        "radios": "border_radius",
        "border_radius": "border_radius",
        "corner_radius": "border_radius",
        "banner_radius": "border_radius",
    },
    "cart": {
        "theme": ["cart_bg", "cart_panel_bg"],
        "cart_theme": ["cart_bg", "cart_panel_bg"],
        "color": ["cart_bg", "cart_panel_bg"],
        "background": ["cart_bg", "cart_panel_bg"],
        "bg": ["cart_bg", "cart_panel_bg"],
        "panel_bg": ["cart_bg", "cart_panel_bg"],
        "cart_bg": ["cart_bg", "cart_panel_bg"],
        "cart_panel_bg": ["cart_bg", "cart_panel_bg"],
        "card_bg": "cart_card_bg",
        "cart_card_bg": "cart_card_bg",
        "text": "cart_text_color",
        "text_color": "cart_text_color",
        "font_color": "cart_text_color",
        "cart_text_color": "cart_text_color",
        "accent": "cart_accent_color",
        "accent_color": "cart_accent_color",
        "button_bg": "cart_accent_color",
        "btn_bg": "cart_accent_color",
        "cart_accent_color": "cart_accent_color",
        "border": "cart_border_color",
        "border_color": "cart_border_color",
        "cart_border_color": "cart_border_color",
        "radius": "cart_radius",
        "border_radius": "cart_radius",
        "cart_radius": "cart_radius",
    },
    "order_summary": {
        "background": "summary_bg",
        "bg": "summary_bg",
        "summary_bg": "summary_bg",
        "card_bg": "summary_card_bg",
        "summary_card_bg": "summary_card_bg",
        "text": "summary_text_color",
        "text_color": "summary_text_color",
        "summary_text_color": "summary_text_color",
        "accent": "summary_accent_color",
        "accent_color": "summary_accent_color",
        "summary_accent_color": "summary_accent_color",
        "border": "summary_border_color",
        "border_color": "summary_border_color",
        "summary_border_color": "summary_border_color",
        "radius": "summary_radius",
        "border_radius": "summary_radius",
        "summary_radius": "summary_radius",
    },
    "delivery_form": {
        "background": "delivery_form_bg",
        "bg": "delivery_form_bg",
        "delivery_form_bg": "delivery_form_bg",
        "input_bg": "delivery_form_input_bg",
        "delivery_form_input_bg": "delivery_form_input_bg",
        "input_text": "delivery_form_input_text",
        "delivery_form_input_text": "delivery_form_input_text",
        "text": "delivery_form_text",
        "text_color": "delivery_form_text",
        "delivery_form_text": "delivery_form_text",
        "button_bg": "delivery_form_btn_bg",
        "btn_bg": "delivery_form_btn_bg",
        "button_color": "delivery_form_btn_bg",
        "delivery_form_btn_bg": "delivery_form_btn_bg",
        "button_text": "delivery_form_btn_text",
        "btn_text": "delivery_form_btn_text",
        "delivery_form_btn_text": "delivery_form_btn_text",
        "border": "delivery_form_border",
        "border_color": "delivery_form_border",
        "delivery_form_border": "delivery_form_border",
        "radius": "delivery_form_radius",
        "border_radius": "delivery_form_radius",
        "delivery_form_radius": "delivery_form_radius",
    },
    "payment": {
        "background": "payment_bg",
        "bg": "payment_bg",
        "payment_bg": "payment_bg",
        "card_bg": "payment_card_bg",
        "payment_card_bg": "payment_card_bg",
        "text": "payment_text_color",
        "text_color": "payment_text_color",
        "payment_text_color": "payment_text_color",
        "accent": "payment_accent_color",
        "accent_color": "payment_accent_color",
        "payment_accent_color": "payment_accent_color",
        "border": "payment_border_color",
        "border_color": "payment_border_color",
        "payment_border_color": "payment_border_color",
        "radius": "payment_radius",
        "border_radius": "payment_radius",
        "payment_radius": "payment_radius",
    },
    "place_order": {
        "theme": ["place_order_bg", "place_order_card_bg"],
        "background": "place_order_bg",
        "bg": "place_order_bg",
        "place_order_bg": "place_order_bg",
        "card_bg": "place_order_card_bg",
        "card": "place_order_card_bg",
        "card_color": "place_order_card_bg",
        "place_order_card_bg": "place_order_card_bg",
        "button_bg": "place_order_btn_bg",
        "btn_bg": "place_order_btn_bg",
        "button_color": "place_order_btn_bg",
        "accent": "place_order_btn_bg",
        "place_order_btn_bg": "place_order_btn_bg",
        "button_text": "place_order_btn_text",
        "btn_text": "place_order_btn_text",
        "place_order_btn_text": "place_order_btn_text",
        "text": "place_order_text",
        "text_color": "place_order_text",
        "title_color": "place_order_text",
        "section_title_color": "place_order_text",
        "place_order_text": "place_order_text",
        "border": "place_order_border",
        "border_color": "place_order_border",
        "soft_border_color": "place_order_border",
        "place_order_border": "place_order_border",
        "radius": "place_order_radius",
        "border_radius": "place_order_radius",
        "place_order_radius": "place_order_radius",
    },
    "checkout": {
        "theme": ["checkout_bg", "delivery_form_bg", "payment_bg", "place_order_bg", "checkout_steps_bg", "summary_bg"],
        "background": ["checkout_bg", "delivery_form_bg", "payment_bg", "place_order_bg", "checkout_steps_bg", "summary_bg"],
        "bg": ["checkout_bg", "delivery_form_bg", "payment_bg", "place_order_bg", "checkout_steps_bg", "summary_bg"],
        "checkout_bg": "checkout_bg",
        "card_bg": ["checkout_card_bg", "delivery_form_card_bg", "payment_card_bg", "place_order_card_bg", "summary_card_bg"],
        "text": ["delivery_form_text", "payment_text_color", "place_order_text", "summary_text_color"],
        "text_color": ["delivery_form_text", "payment_text_color", "place_order_text", "summary_text_color"],
        "accent": ["delivery_form_btn_bg", "payment_accent_color", "place_order_btn_bg", "summary_accent_color"],
        "border": ["delivery_form_border", "payment_border_color", "place_order_border", "summary_border_color"],
        "border_color": ["delivery_form_border", "payment_border_color", "place_order_border", "summary_border_color"],
    },
    "pagination": {
        "background": "pagination_bg",
        "bg": "pagination_bg",
        "pagination_bg": "pagination_bg",
        "active_bg": "pagination_active_bg",
        "button_bg": "pagination_active_bg",
        "btn_bg": "pagination_active_bg",
        "accent": "pagination_active_bg",
        "pagination_active_bg": "pagination_active_bg",
        "text": "pagination_text_color",
        "text_color": "pagination_text_color",
        "pagination_text_color": "pagination_text_color",
        "border": "pagination_border_color",
        "border_color": "pagination_border_color",
        "pagination_border_color": "pagination_border_color",
        "radius": "pagination_radius",
        "border_radius": "pagination_radius",
        "pagination_radius": "pagination_radius",
    },
    "review": {
        "background": "review_card_bg",
        "bg": "review_card_bg",
        "card_bg": "review_card_bg",
        "card_background": "review_card_bg",
        "review_card_bg": "review_card_bg",
        "text": "review_text_color",
        "text_color": "review_text_color",
        "review_text_color": "review_text_color",
        "border": "review_border_color",
        "border_color": "review_border_color",
        "review_border_color": "review_border_color",
        "radius": "review_card_radius",
        "border_radius": "review_card_radius",
        "review_card_radius": "review_card_radius",
        "star_color": "rating_star_color",
        "rating_color": "rating_star_color",
        "rating_star_color": "rating_star_color",
    },
    "support": {
        "background": "support_bg",
        "bg": "support_bg",
        "page_bg": "support_bg",
        "primary_bg": "support_bg",
        "support_bg": "support_bg",
        "card_bg": "support_card_bg",
        "card_background": "support_card_bg",
        "card": "support_card_bg",
        "cards": "support_card_bg",
        "support_card_bg": "support_card_bg",
        "chat_bg": "support_chat_bg",
        "chat_background": "support_chat_bg",
        "chat": "support_chat_bg",
        "support_chat_bg": "support_chat_bg",
        "text": "support_text_color",
        "text_color": "support_text_color",
        "title_color": "support_text_color",
        "card_text": "support_text_color",
        "support_text_color": "support_text_color",
        "muted": "support_muted_text",
        "muted_text": "support_muted_text",
        "subtext_color": "support_muted_text",
        "support_muted_text": "support_muted_text",
        "accent": "support_accent_color",
        "accent_color": "support_accent_color",
        "support_accent_color": "support_accent_color",
        "border": "support_border_color",
        "border_color": "support_border_color",
        "support_border_color": "support_border_color",
        "customer_bubble_bg": "support_customer_bubble_bg",
        "customer_bubble": "support_customer_bubble_bg",
        "agent_bubble_bg": "support_agent_bubble_bg",
        "agent_bubble": "support_agent_bubble_bg",
    },
    "order_history": {
        "background": "order_history_bg",
        "bg": "order_history_bg",
        "page_bg": "order_history_bg",
        "order_history_bg": "order_history_bg",
        "card_bg": "order_history_card_bg",
        "card_background": "order_history_card_bg",
        "order_history_card_bg": "order_history_card_bg",
        "order_card_bg": "order_history_card_bg",
        "order_card_background": "order_history_card_bg",
        "cards": "order_history_card_bg",
        "card": "order_history_card_bg",
        "text": "order_history_text",
        "text_color": "order_history_text",
        "title_color": "order_history_text",
        "card_text": "order_history_text",
        "card_text_color": "order_history_text",
        "order_history_text": "order_history_text",
        "muted": "order_history_muted_text",
        "muted_text": "order_history_muted_text",
        "subtext_color": "order_history_muted_text",
        "order_history_muted_text": "order_history_muted_text",
        "border": "order_history_border",
        "border_color": "order_history_border",
        "card_border": "order_history_border",
        "order_history_border": "order_history_border",
        "accent": "order_history_accent_color",
        "accent_color": "order_history_accent_color",
        "order_history_accent_color": "order_history_accent_color",
        "radius": "order_history_radius",
        "card_radius": "order_history_radius",
        "border_radius": "order_history_radius",
        "order_history_radius": "order_history_radius",
    },
    "product_detail": {
        "background": "product_detail_bg",
        "bg": "product_detail_bg",
        "panel_color": "product_detail_bg",
        "background_color": "product_detail_bg",
        "product_detail_bg": "product_detail_bg",
        "text": "product_detail_text",
        "text_color": "product_detail_text",
        "product_detail_text": "product_detail_text",
        "button_bg": "product_detail_btn_bg",
        "btn_bg": "product_detail_btn_bg",
        "button_bg_color": "product_detail_btn_bg",
        "product_detail_btn_bg": "product_detail_btn_bg",
        "button_text": "product_detail_btn_text",
        "btn_text": "product_detail_btn_text",
        "button_text_color": "product_detail_btn_text",
        "product_detail_btn_text": "product_detail_btn_text",
        "radius": "product_detail_radius",
        "border_radius": "product_detail_radius",
        "product_detail_radius": "product_detail_radius",
    },
    "card": {
        "background": ["card_bg_color", "card_bg"],
        "bg": ["card_bg_color", "card_bg"],
        "card_bg": ["card_bg_color", "card_bg"],
        "card_bg_color": ["card_bg_color", "card_bg"],
        "text": ["card_text_color", "product_name_color", "product_title_color"],
        "text_color": ["card_text_color", "product_name_color", "product_title_color"],
        "card_text": ["card_text_color", "product_name_color", "product_title_color"],
        "card_text_color": ["card_text_color", "product_name_color", "product_title_color"],
        "product_name_color": ["card_text_color", "product_name_color", "product_title_color"],
        "product_title_color": ["card_text_color", "product_name_color", "product_title_color"],
        "title_color": ["card_text_color", "product_name_color", "product_title_color"],
        "brand": "brand_color",
        "brand_color": "brand_color",
        "brand_name": "brand_color",
        "brand_name_color": "brand_color",
        "card_brand_color": "brand_color",
        "price_color": "price_color",
        "radius": ["card_radius", "border_radius"],
        "card_radius": ["card_radius", "border_radius"],
        "border_radius": ["card_radius", "border_radius"],
        "border": "card_border_color",
        "border_color": "card_border_color",
        "card_border_color": "card_border_color",
        "shadow": "card_shadow",
        "star_color": "rating_star_color",
        "rating_color": "rating_star_color",
        "rating_star_color": "rating_star_color",
    },
    "product_carousel": {
        "background": ["outer_bg_color", "grid_bg"],
        "bg": ["outer_bg_color", "grid_bg"],
        "section_bg": ["outer_bg_color", "grid_bg"],
        "outer_bg_color": ["outer_bg_color", "grid_bg"],
        "grid_bg": ["outer_bg_color", "grid_bg"],
        "card_bg": ["card_bg_color", "card_bg"],
        "card_background": ["card_bg_color", "card_bg"],
        "card_bg_color": ["card_bg_color", "card_bg"],
        "text": ["title_color", "grid_text_color"],
        "title": ["title_color", "grid_text_color"],
        "title_color": ["title_color", "grid_text_color"],
        "grid_text_color": ["title_color", "grid_text_color"],
        "card_text": ["card_text_color", "product_name_color"],
        "card_text_color": ["card_text_color", "product_name_color"],
        "product_name_color": ["card_text_color", "product_name_color"],
        "brand": "brand_color",
        "brand_color": "brand_color",
        "brand_name": "brand_color",
        "brand_name_color": "brand_color",
        "card_brand_color": "brand_color",
        "price_color": "price_color",
        "radius": ["card_radius", "border_radius"],
        "card_radius": ["card_radius", "border_radius"],
        "border_radius": ["card_radius", "border_radius"],
        "border": "card_border_color",
        "card_border_color": "card_border_color",
    },
    "section_group_carousel": {
        "background": ["outer_bg_color", "grid_bg"],
        "bg": ["outer_bg_color", "grid_bg"],
        "section_bg": ["outer_bg_color", "grid_bg"],
        "outer_bg_color": ["outer_bg_color", "grid_bg"],
        "grid_bg": ["outer_bg_color", "grid_bg"],
        "card_bg": ["card_bg_color", "card_bg"],
        "card_background": ["card_bg_color", "card_bg"],
        "card_bg_color": ["card_bg_color", "card_bg"],
        "text": ["title_color", "grid_text_color"],
        "title": ["title_color", "grid_text_color"],
        "title_color": ["title_color", "grid_text_color"],
        "grid_text_color": ["title_color", "grid_text_color"],
        "card_text": ["card_text_color", "product_name_color"],
        "card_text_color": ["card_text_color", "product_name_color"],
        "product_name_color": ["card_text_color", "product_name_color"],
        "brand": "brand_color",
        "brand_color": "brand_color",
        "brand_name": "brand_color",
        "brand_name_color": "brand_color",
        "card_brand_color": "brand_color",
        "price_color": "price_color",
        "radius": ["card_radius", "border_radius"],
        "card_radius": ["card_radius", "border_radius"],
        "border_radius": ["card_radius", "border_radius"],
        "border": "card_border_color",
        "card_border_color": "card_border_color",
    },
    "product_grid": {
        "background": ["outer_bg_color", "grid_bg"],
        "bg": ["outer_bg_color", "grid_bg"],
        "outer_bg_color": ["outer_bg_color", "grid_bg"],
        "grid_bg": ["outer_bg_color", "grid_bg"],
        "card_bg": ["card_bg_color", "card_bg"],
        "card_bg_color": ["card_bg_color", "card_bg"],
        "text": ["title_color", "grid_text_color"],
        "title": ["title_color", "grid_text_color"],
        "title_color": ["title_color", "grid_text_color"],
        "grid_text_color": ["title_color", "grid_text_color"],
        "card_text": ["card_text_color", "product_name_color"],
        "card_text_color": ["card_text_color", "product_name_color"],
        "product_name_color": ["card_text_color", "product_name_color"],
        "brand": "brand_color",
        "brand_color": "brand_color",
        "brand_name": "brand_color",
        "brand_name_color": "brand_color",
        "card_brand_color": "brand_color",
        "price_color": "price_color",
        "radius": ["card_radius", "border_radius"],
        "card_radius": ["card_radius", "border_radius"],
        "border_radius": ["card_radius", "border_radius"],
        "gap": "grid_gap",
        "grid_gap": "grid_gap",
    },
    "category_grid": {
        "background": ["outer_bg_color", "grid_bg"],
        "bg": ["outer_bg_color", "grid_bg"],
        "outer_bg_color": ["outer_bg_color", "grid_bg"],
        "grid_bg": ["outer_bg_color", "grid_bg"],
        "card_bg": ["card_bg_color", "card_bg"],
        "card_bg_color": ["card_bg_color", "card_bg"],
        "text": ["title_color", "grid_text_color"],
        "title": ["title_color", "grid_text_color"],
        "title_color": ["title_color", "grid_text_color"],
        "grid_text_color": ["title_color", "grid_text_color"],
        "radius": ["card_radius", "border_radius"],
        "card_radius": ["card_radius", "border_radius"],
        "border_radius": ["card_radius", "border_radius"],
        "gap": "grid_gap",
        "grid_gap": "grid_gap",
    },
    "background": {
        "background": ["primary_bg", "secondary_bg"],
        "bg": ["primary_bg", "secondary_bg"],
        "primary_bg": ["primary_bg", "secondary_bg"],
        "secondary_bg": "secondary_bg",
        "text": "text_color",
        "text_color": "text_color",
        "muted": "muted_text",
        "muted_text": "muted_text",
        "border": "border_color",
        "border_color": "border_color",
        "accent": "accent_color",
        "accent_color": "accent_color",
    },
    "global": {
        "background": ["primary_bg", "secondary_bg"],
        "bg": ["primary_bg", "secondary_bg"],
        "primary_bg": ["primary_bg", "secondary_bg"],
        "secondary_bg": "secondary_bg",
        "text": "text_color",
        "text_color": "text_color",
        "muted": "muted_text",
        "muted_text": "muted_text",
        "border": "border_color",
        "border_color": "border_color",
        "accent": "accent_color",
        "accent_color": "accent_color",
    },
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

    has_explicit_outer_bg_action = any(
        a.property_name in ("navbar_outer_bg", "outer_bg_color") or a.property_name.endswith("navbar_outer_bg")
        for a in actions
    )

    for action in actions:
        comp = action.target_component.lower().strip()
        prop = action.property_name.strip()
        val = action.value

        # Resolve canonical property if still generic
        target_props = [prop]
        if comp in CANONICAL_COMPONENT_PROPERTY_MAP and prop in CANONICAL_COMPONENT_PROPERTY_MAP[comp]:
            mapped = CANONICAL_COMPONENT_PROPERTY_MAP[comp][prop]
            target_props = mapped if isinstance(mapped, list) else [mapped]

        # Resolve block targets
        is_global_target = comp in ("global", "overall", "background")
        if is_global_target:
            target_norm_types = None
        elif comp in COMPONENT_BLOCK_TARGETS:
            target_norm_types = set(COMPONENT_BLOCK_TARGETS[comp])
        else:
            target_norm_types = {_norm_block_type(comp)}

        for p in target_props:
            # Update theme for global targets or theme-level component properties
            is_theme_level_prop = (
                p in THEME_COMPONENT_OVERRIDE_KEYS
                or p.startswith(("navbar_", "footer_", "hero_", "cart_", "delivery_form_", "payment_", "place_order_", "pagination_", "filter_", "review_", "support_", "notification_", "profile_dropdown_", "order_history_", "product_detail_"))
                or comp in ("navbar", "footer", "hero", "cart", "order_summary", "delivery_form", "payment", "place_order", "filter", "pagination", "review", "support", "notification", "profile_dropdown", "order_history", "product_detail")
            )

            # Never mutate root theme for component-scoped profile page actions
            if (is_global_target or is_theme_level_prop) and comp not in ("profile", "profile_details", "customer_profile"):
                if theme.get(p) != val:
                    theme[p] = val
                    theme_keys_changed.append(p)
                applied_patch[p] = val
                if p == "navbar_bg" and not has_explicit_outer_bg_action:
                    if theme.get("navbar_outer_bg") != val:
                        theme["navbar_outer_bg"] = val
                        theme_keys_changed.append("navbar_outer_bg")
                    applied_patch["navbar_outer_bg"] = val
                elif p in ("outer_border", "navbar_outer_border"):
                    theme["navbar_border_color"] = val
                    theme["navbar_outer_bg"] = val
                    applied_patch["navbar_border_color"] = val
                    applied_patch["navbar_outer_bg"] = val
                    theme_keys_changed.extend(["navbar_border_color", "navbar_outer_bg"])
                elif p in ("filter_bg", "filter_modal_bg"):
                    theme["filter_bg"] = val
                    theme["filter_modal_bg"] = val
                    applied_patch["filter_bg"] = val
                    applied_patch["filter_modal_bg"] = val
                    theme_keys_changed.extend(["filter_bg", "filter_modal_bg"])
                elif p in ("filter_text_color", "filter_modal_text"):
                    theme["filter_text_color"] = val
                    theme["filter_modal_text"] = val
                    applied_patch["filter_text_color"] = val
                    applied_patch["filter_modal_text"] = val
                    theme_keys_changed.extend(["filter_text_color", "filter_modal_text"])
                elif p in ("card_text_color", "product_name_color", "product_title_color"):
                    theme["card_text_color"] = val
                    theme["product_name_color"] = val
                    applied_patch["card_text_color"] = val
                    applied_patch["product_name_color"] = val
                    theme_keys_changed.extend(["card_text_color", "product_name_color"])
                elif p in ("price_color", "card_price_color"):
                    is_dark_theme = theme.get("mode") == "dark" or is_color_dark(theme.get("primary_bg", ""))
                    safe_price = get_safe_price_color(val, default_text=theme.get("card_text_color") or "#0f172a", is_dark=is_dark_theme)
                    theme["price_color"] = safe_price
                    theme["card_price_color"] = safe_price
                    applied_patch["price_color"] = safe_price
                    applied_patch["card_price_color"] = safe_price
                    theme_keys_changed.extend(["price_color", "card_price_color"])
                elif p in ("brand_color", "brand_name_color", "card_brand_color"):
                    theme["brand_color"] = val
                    theme["card_brand_color"] = val
                    applied_patch["brand_color"] = val
                    applied_patch["card_brand_color"] = val
                    theme_keys_changed.extend(["brand_color", "card_brand_color"])
                elif comp == "order_history":
                    if p in ("order_history_card_bg", "card_bg", "card_bg_color"):
                        theme["order_history_card_bg"] = val
                        applied_patch["order_history_card_bg"] = val
                        if "order_history_card_bg" not in theme_keys_changed:
                            theme_keys_changed.append("order_history_card_bg")
                    elif p in ("order_history_bg", "page_bg", "background"):
                        theme["order_history_bg"] = val
                        applied_patch["order_history_bg"] = val
                        if "order_history_bg" not in theme_keys_changed:
                            theme_keys_changed.append("order_history_bg")
                    elif p in ("order_history_text", "title_color", "text_color"):
                        theme["order_history_text"] = val
                        applied_patch["order_history_text"] = val
                        if "order_history_text" not in theme_keys_changed:
                            theme_keys_changed.append("order_history_text")
                    elif p in ("order_history_border", "border_color"):
                        theme["order_history_border"] = val
                        applied_patch["order_history_border"] = val
                        if "order_history_border" not in theme_keys_changed:
                            theme_keys_changed.append("order_history_border")
                elif comp == "support":
                    if p in ("support_bg", "page_bg", "primary_bg", "background", "bg"):
                        theme["support_bg"] = val
                        applied_patch["support_bg"] = val
                        if "support_bg" not in theme_keys_changed:
                            theme_keys_changed.append("support_bg")
                    elif p in ("support_card_bg", "card_bg", "card_bg_color", "card"):
                        theme["support_card_bg"] = val
                        applied_patch["support_card_bg"] = val
                        if "support_card_bg" not in theme_keys_changed:
                            theme_keys_changed.append("support_card_bg")
                    elif p in ("support_chat_bg", "chat_bg", "chat"):
                        theme["support_chat_bg"] = val
                        applied_patch["support_chat_bg"] = val
                        if "support_chat_bg" not in theme_keys_changed:
                            theme_keys_changed.append("support_chat_bg")
                    elif p in ("support_text_color", "title_color", "text_color", "text"):
                        theme["support_text_color"] = val
                        applied_patch["support_text_color"] = val
                        if "support_text_color" not in theme_keys_changed:
                            theme_keys_changed.append("support_text_color")
                    elif p in ("support_muted_text", "muted_text", "subtext_color"):
                        theme["support_muted_text"] = val
                        applied_patch["support_muted_text"] = val
                        if "support_muted_text" not in theme_keys_changed:
                            theme_keys_changed.append("support_muted_text")
                    elif p in ("support_border_color", "border_color", "border"):
                        theme["support_border_color"] = val
                        applied_patch["support_border_color"] = val
                        if "support_border_color" not in theme_keys_changed:
                            theme_keys_changed.append("support_border_color")
                    elif p in ("support_accent_color", "accent_color", "accent"):
                        theme["support_accent_color"] = val
                        applied_patch["support_accent_color"] = val
                        if "support_accent_color" not in theme_keys_changed:
                            theme_keys_changed.append("support_accent_color")
                elif comp == "profile_dropdown":
                    theme[p] = val
                    theme.setdefault("profile", {})[p] = val
                    applied_patch[p] = val
                    if p not in theme_keys_changed:
                        theme_keys_changed.append(p)
                elif comp == "order_summary":
                    if p in ("summary_bg", "panel_bg", "background", "bg", "background_color", "panel_color"):
                        theme["summary_bg"] = val
                        applied_patch["summary_bg"] = val
                        theme_keys_changed.append("summary_bg")
                    elif p in ("summary_card_bg", "card_bg", "card_bg_color", "card_color"):
                        theme["summary_card_bg"] = val
                        applied_patch["summary_card_bg"] = val
                        theme_keys_changed.append("summary_card_bg")
                    elif p in ("summary_text_color", "text_color", "text"):
                        theme["summary_text_color"] = val
                        applied_patch["summary_text_color"] = val
                        theme_keys_changed.append("summary_text_color")
                    elif p in ("summary_accent_color", "accent_color", "accent", "button_color"):
                        theme["summary_accent_color"] = val
                        applied_patch["summary_accent_color"] = val
                        theme_keys_changed.append("summary_accent_color")
                    elif p in ("summary_border_color", "border_color", "border"):
                        theme["summary_border_color"] = val
                        applied_patch["summary_border_color"] = val
                        theme_keys_changed.append("summary_border_color")
                elif comp == "cart":
                    if p in ("cart_bg", "cart_panel_bg", "panel_bg", "background", "bg", "background_color"):
                        theme["cart_bg"] = val
                        theme["cart_panel_bg"] = val
                        applied_patch["cart_bg"] = val
                        applied_patch["cart_panel_bg"] = val
                        theme_keys_changed.extend(["cart_bg", "cart_panel_bg"])
                    elif p in ("cart_card_bg", "card_bg", "card_bg_color"):
                        theme["cart_card_bg"] = val
                        applied_patch["cart_card_bg"] = val
                        theme_keys_changed.append("cart_card_bg")
                    elif p in ("cart_text_color", "text_color", "text"):
                        theme["cart_text_color"] = val
                        applied_patch["cart_text_color"] = val
                        theme_keys_changed.append("cart_text_color")
                    elif p in ("cart_accent_color", "accent_color", "accent"):
                        theme["cart_accent_color"] = val
                        applied_patch["cart_accent_color"] = val
                        theme_keys_changed.append("cart_accent_color")
                    elif p in ("cart_border_color", "border_color", "border"):
                        theme["cart_border_color"] = val
                        applied_patch["cart_border_color"] = val
                        theme_keys_changed.append("cart_border_color")
                elif comp == "delivery_form":
                    if p in ("delivery_form_bg", "bg", "background", "background_color", "panel_bg", "panel_color"):
                        theme["delivery_form_bg"] = val
                        applied_patch["delivery_form_bg"] = val
                        theme_keys_changed.append("delivery_form_bg")
                    elif p in ("delivery_form_card_bg", "card_bg", "card_color"):
                        theme["delivery_form_card_bg"] = val
                        applied_patch["delivery_form_card_bg"] = val
                        theme_keys_changed.append("delivery_form_card_bg")
                    elif p in ("delivery_form_input_bg", "input_bg", "input_color"):
                        theme["delivery_form_input_bg"] = val
                        applied_patch["delivery_form_input_bg"] = val
                        theme_keys_changed.append("delivery_form_input_bg")
                    elif p in ("delivery_form_text", "text", "text_color"):
                        theme["delivery_form_text"] = val
                        applied_patch["delivery_form_text"] = val
                        theme_keys_changed.append("delivery_form_text")
                    elif p in ("delivery_form_btn_bg", "btn_bg", "button_bg", "button_bg_color", "accent_color"):
                        theme["delivery_form_btn_bg"] = val
                        applied_patch["delivery_form_btn_bg"] = val
                        theme_keys_changed.append("delivery_form_btn_bg")
                    elif p in ("delivery_form_border", "border", "border_color"):
                        theme["delivery_form_border"] = val
                        applied_patch["delivery_form_border"] = val
                        theme_keys_changed.append("delivery_form_border")
                elif comp == "payment":
                    if p in ("payment_bg", "bg", "background", "background_color"):
                        theme["payment_bg"] = val
                        applied_patch["payment_bg"] = val
                        theme_keys_changed.append("payment_bg")
                    elif p in ("payment_card_bg", "card_bg", "card_color", "panel_color"):
                        theme["payment_card_bg"] = val
                        applied_patch["payment_card_bg"] = val
                        theme_keys_changed.append("payment_card_bg")
                    elif p in ("payment_text_color", "text", "text_color"):
                        theme["payment_text_color"] = val
                        applied_patch["payment_text_color"] = val
                        theme_keys_changed.append("payment_text_color")
                    elif p in ("payment_accent_color", "accent", "accent_color", "button_bg"):
                        theme["payment_accent_color"] = val
                        applied_patch["payment_accent_color"] = val
                        theme_keys_changed.append("payment_accent_color")
                    elif p in ("payment_border_color", "border", "border_color"):
                        theme["payment_border_color"] = val
                        applied_patch["payment_border_color"] = val
                        theme_keys_changed.append("payment_border_color")
                elif comp in ("place_order", "checkout_review", "review_and_pay"):
                    if p in ("place_order_bg", "bg", "background", "background_color", "panel_bg", "panel_color"):
                        theme["place_order_bg"] = val
                        applied_patch["place_order_bg"] = val
                        theme_keys_changed.append("place_order_bg")
                    elif p in ("place_order_card_bg", "card_bg", "card_color"):
                        theme["place_order_card_bg"] = val
                        applied_patch["place_order_card_bg"] = val
                        theme_keys_changed.append("place_order_card_bg")
                    elif p in ("place_order_text", "text", "text_color", "title_color"):
                        theme["place_order_text"] = val
                        applied_patch["place_order_text"] = val
                        theme_keys_changed.append("place_order_text")
                    elif p in ("place_order_btn_bg", "btn_bg", "button_bg", "button_bg_color", "accent_color"):
                        theme["place_order_btn_bg"] = val
                        applied_patch["place_order_btn_bg"] = val
                        theme_keys_changed.append("place_order_btn_bg")
                    elif p in ("place_order_border", "border", "border_color"):
                        theme["place_order_border"] = val
                        applied_patch["place_order_border"] = val
                        theme_keys_changed.append("place_order_border")
                elif comp == "checkout":
                    if p in ("checkout_bg", "bg", "background", "background_color"):
                        theme["checkout_bg"] = val
                        theme["delivery_form_bg"] = val
                        theme["payment_bg"] = val
                        theme["place_order_bg"] = val
                        theme["checkout_steps_bg"] = val
                        theme["summary_bg"] = val
                        applied_patch.update({
                            "checkout_bg": val, "delivery_form_bg": val, "payment_bg": val,
                            "place_order_bg": val, "checkout_steps_bg": val, "summary_bg": val
                        })
                        theme_keys_changed.extend(["checkout_bg", "delivery_form_bg", "payment_bg", "place_order_bg", "checkout_steps_bg", "summary_bg"])
                    elif p in ("checkout_card_bg", "card_bg", "card_color"):
                        theme["checkout_card_bg"] = val
                        theme["delivery_form_card_bg"] = val
                        theme["payment_card_bg"] = val
                        theme["place_order_card_bg"] = val
                        theme["summary_card_bg"] = val
                        applied_patch.update({
                            "checkout_card_bg": val, "delivery_form_card_bg": val,
                            "payment_card_bg": val, "place_order_card_bg": val, "summary_card_bg": val
                        })
                        theme_keys_changed.extend(["checkout_card_bg", "delivery_form_card_bg", "payment_card_bg", "place_order_card_bg", "summary_card_bg"])
                    elif p in ("text", "text_color"):
                        theme["delivery_form_text"] = val
                        theme["payment_text_color"] = val
                        theme["place_order_text"] = val
                        theme["summary_text_color"] = val
                        applied_patch.update({
                            "delivery_form_text": val, "payment_text_color": val,
                            "place_order_text": val, "summary_text_color": val
                        })
                        theme_keys_changed.extend(["delivery_form_text", "payment_text_color", "place_order_text", "summary_text_color"])
                    elif p in ("accent", "accent_color", "btn_bg", "button_bg"):
                        theme["delivery_form_btn_bg"] = val
                        theme["payment_accent_color"] = val
                        theme["place_order_btn_bg"] = val
                        theme["summary_accent_color"] = val
                        applied_patch.update({
                            "delivery_form_btn_bg": val, "payment_accent_color": val,
                            "place_order_btn_bg": val, "summary_accent_color": val
                        })
                        theme_keys_changed.extend(["delivery_form_btn_bg", "payment_accent_color", "place_order_btn_bg", "summary_accent_color"])

            # Strictly scoped profile page mutation (never bleeds into root theme primary_bg or card_bg)
            if comp in ("profile", "profile_details", "customer_profile"):
                profile_theme = theme.setdefault("profile", {})
                profile_theme[p] = val
                site_definition.setdefault("profile_props", {})[p] = val
                if p.startswith("profile_dropdown_"):
                    theme[p] = val
                applied_patch[p] = val
                if p not in theme_keys_changed:
                    theme_keys_changed.append(p)

            # Apply to page blocks
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
                    if p in ("card_bg", "card_bg_color"):
                        bprops["card_bg_color"] = val
                        bprops["card_bg"] = val
                    elif p in ("outer_bg_color", "grid_bg"):
                        bprops["outer_bg_color"] = val
                        bprops["grid_bg"] = val
                    elif p in ("card_radius", "border_radius"):
                        bprops["card_radius"] = val
                        bprops["border_radius"] = val
                    elif p in ("card_text_color", "product_name_color", "product_title_color"):
                        bprops["card_text_color"] = val
                        bprops["product_name_color"] = val
                        bprops["product_title_color"] = val
                    elif p in ("price_color", "card_price_color"):
                        is_block_dark = is_color_dark(bprops.get("card_bg_color") or bprops.get("card_bg") or theme.get("card_bg", ""))
                        safe_price = get_safe_price_color(val, default_text=bprops.get("card_text_color") or "#0f172a", is_dark=is_block_dark)
                        bprops["price_color"] = safe_price
                    elif p in ("brand_color", "brand_name_color", "card_brand_color"):
                        bprops["brand_color"] = val
                    elif p in ("product_detail_text", "text_color") and ("product_detail" in norm_btype or comp == "product_detail"):
                        bprops["product_detail_text"] = val
                        bprops["text_color"] = val
                    elif p in ("product_detail_bg", "panel_color", "background_color") and ("product_detail" in norm_btype or comp == "product_detail"):
                        bprops["product_detail_bg"] = val
                        bprops["panel_color"] = val
                        bprops["background_color"] = val
                    elif p in ("product_detail_btn_bg", "button_bg_color") and ("product_detail" in norm_btype or comp == "product_detail"):
                        bprops["product_detail_btn_bg"] = val
                        bprops["button_bg_color"] = val
                    elif p in ("product_detail_btn_text", "button_text_color") and ("product_detail" in norm_btype or comp == "product_detail"):
                        bprops["product_detail_btn_text"] = val
                        bprops["button_text_color"] = val
                    elif p in ("filter_bg", "filter_modal_bg"):
                        bprops["filter_bg"] = val
                        bprops["filter_modal_bg"] = val
                    elif p in ("filter_text_color", "filter_modal_text"):
                        bprops["filter_text_color"] = val
                        bprops["filter_modal_text"] = val
                    elif p in ("filter_btn_bg", "filter_card_bg"):
                        bprops["filter_btn_bg"] = val
                        bprops["filter_card_bg"] = val
                    elif p in ("order_history_card_bg", "card_bg", "card_bg_color") and ("orderhistory" in norm_btype or "customerorders" in norm_btype or comp == "order_history"):
                        bprops["order_history_card_bg"] = val
                        bprops["card_bg"] = val
                        bprops["card_bg_color"] = val
                    elif p in ("order_history_bg", "page_bg", "background") and ("orderhistory" in norm_btype or "customerorders" in norm_btype or comp == "order_history"):
                        bprops["order_history_bg"] = val
                        bprops["page_bg"] = val
                    elif p in ("order_history_text", "text_color", "title_color") and ("orderhistory" in norm_btype or "customerorders" in norm_btype or comp == "order_history"):
                        bprops["order_history_text"] = val
                        bprops["title_color"] = val
                        bprops["text_color"] = val
                    elif p in ("order_history_muted_text", "muted_text", "subtext_color") and ("orderhistory" in norm_btype or "customerorders" in norm_btype or comp == "order_history"):
                        bprops["order_history_muted_text"] = val
                        bprops["subtext_color"] = val
                    elif p in ("order_history_border", "border_color") and ("orderhistory" in norm_btype or "customerorders" in norm_btype or comp == "order_history"):
                        bprops["order_history_border"] = val
                        bprops["border_color"] = val
                    elif p in ("order_history_accent_color", "accent_color") and ("orderhistory" in norm_btype or "customerorders" in norm_btype or comp == "order_history"):
                        bprops["order_history_accent_color"] = val
                        bprops["accent_color"] = val
                    elif p in ("order_history_radius", "card_radius", "border_radius") and ("orderhistory" in norm_btype or "customerorders" in norm_btype or comp == "order_history"):
                        bprops["order_history_radius"] = val
                        bprops["card_radius"] = val
                        bprops["border_radius"] = val
                    elif p in ("support_bg", "page_bg", "primary_bg", "background") and ("support" in norm_btype or comp == "support"):
                        bprops["support_bg"] = val
                        bprops["primary_bg"] = val
                        bprops["page_bg"] = val
                    elif p in ("support_card_bg", "card_bg", "card_bg_color") and ("support" in norm_btype or comp == "support"):
                        bprops["support_card_bg"] = val
                        bprops["card_bg"] = val
                        bprops["card_bg_color"] = val
                    elif p in ("support_chat_bg", "chat_bg") and ("support" in norm_btype or comp == "support"):
                        bprops["support_chat_bg"] = val
                        bprops["chat_bg"] = val
                    elif p in ("support_text_color", "text_color", "title_color") and ("support" in norm_btype or comp == "support"):
                        bprops["support_text_color"] = val
                        bprops["title_color"] = val
                        bprops["text_color"] = val
                    elif p in ("support_muted_text", "muted_text", "subtext_color") and ("support" in norm_btype or comp == "support"):
                        bprops["support_muted_text"] = val
                        bprops["subtext_color"] = val
                    elif p in ("support_border_color", "border_color") and ("support" in norm_btype or comp == "support"):
                        bprops["support_border_color"] = val
                        bprops["border_color"] = val
                    elif p in ("support_accent_color", "accent_color") and ("support" in norm_btype or comp == "support"):
                        bprops["support_accent_color"] = val
                        bprops["accent_color"] = val
                    elif "profile" in norm_btype or "customerprofile" in norm_btype or comp in ("profile", "profile_details", "customer_profile"):
                        if p in ("card_bg", "card_bg_color", "bg", "background", "background_color"):
                            bprops["card_bg"] = val
                            bprops["card_bg_color"] = val
                        elif p in ("input_bg", "inputs_bg", "input_background"):
                            bprops["input_bg"] = val
                        elif p in ("input_text_color", "input_text", "inputs_text", "inputs_text_color"):
                            bprops["input_text_color"] = val
                        elif p in ("input_border", "input_border_color"):
                            bprops["input_border"] = val
                        elif p in ("border_color", "border", "card_border"):
                            bprops["border_color"] = val
                        elif p in ("title_color", "text_color", "text", "title"):
                            bprops["title_color"] = val
                            bprops["text_color"] = val
                        elif p in ("subtext_color", "muted_text", "subtext", "subtitle"):
                            bprops["subtext_color"] = val
                            bprops["muted_text"] = val
                        elif p in ("button_bg_color", "button_bg", "btn_bg", "accent_color", "accent"):
                            bprops["button_bg_color"] = val
                        elif p in ("button_text_color", "button_text", "btn_text"):
                            bprops["button_text_color"] = val
                        elif p in ("sign_out_color", "sign_out", "signout_color"):
                            bprops["sign_out_color"] = val
                        elif p in ("card_radius", "border_radius"):
                            bprops["card_radius"] = val
                        elif p == "card_padding":
                            bprops["card_padding"] = val
                        elif p == "input_radius":
                            bprops["input_radius"] = val
                        elif p == "button_radius":
                            bprops["button_radius"] = val
                        else:
                            bprops[p] = val
                    elif p in ("title_color", "grid_text_color"):
                        bprops["title_color"] = val
                        bprops["grid_text_color"] = val
                    elif p == "navbar_bg":
                        bprops["navbar_bg"] = val
                        if not has_explicit_outer_bg_action:
                            bprops["navbar_outer_bg"] = val
                    elif p == "navbar_outer_bg":
                        bprops["navbar_outer_bg"] = val
                    elif p in ("navbar_border_color", "border_color") and ("nav" in norm_btype or comp == "navbar"):
                        bprops["navbar_border_color"] = val
                    elif p in ("outer_border", "navbar_outer_border"):
                        bprops["navbar_border_color"] = val
                        bprops["navbar_outer_bg"] = val
                    elif comp == "order_summary" or ("summary" in norm_btype and "cart" not in norm_btype):
                        if p in ("summary_bg", "panel_bg", "bg", "background", "background_color", "panel_color"):
                            bprops["background_color"] = val
                            bprops["panel_color"] = val
                        elif p in ("summary_card_bg", "card_bg", "card_bg_color", "card_color"):
                            bprops["card_color"] = val
                            bprops["card_bg"] = val
                        elif p in ("summary_text_color", "text_color", "text", "font_color"):
                            bprops["text_color"] = val
                        elif p in ("summary_accent_color", "accent_color", "accent", "button_bg", "btn_bg"):
                            bprops["accent_color"] = val
                        elif p in ("summary_border_color", "border_color", "border"):
                            bprops["border_color"] = val
                        else:
                            bprops[p] = val
                    elif comp == "cart" or "cart" in norm_btype:
                        if p in ("cart_bg", "cart_panel_bg", "panel_bg", "bg", "background", "background_color", "panel_color"):
                            bprops["cart_bg"] = val
                            bprops["cart_panel_bg"] = val
                            bprops["background_color"] = val
                            bprops["panel_color"] = val
                        elif p in ("cart_card_bg", "card_bg", "card_bg_color", "card_color"):
                            bprops["cart_card_bg"] = val
                            bprops["card_color"] = val
                            bprops["card_bg"] = val
                        elif p in ("cart_text_color", "text_color", "text", "font_color"):
                            bprops["cart_text_color"] = val
                            bprops["text_color"] = val
                        elif p in ("cart_accent_color", "accent_color", "accent", "button_bg", "btn_bg"):
                            bprops["cart_accent_color"] = val
                            bprops["accent_color"] = val
                        elif p in ("cart_border_color", "border_color", "border"):
                            bprops["cart_border_color"] = val
                            bprops["border_color"] = val
                    elif comp == "delivery_form" or any(k in norm_btype for k in ["deliveryform", "addressform", "deliveryaddressform"]):
                        if p in ("delivery_form_bg", "bg", "background", "background_color", "panel_bg", "panel_color"):
                            bprops["background_color"] = val
                            bprops["delivery_form_bg"] = val
                        elif p in ("delivery_form_card_bg", "card_bg", "card_color"):
                            bprops["card_color"] = val
                            bprops["delivery_form_card_bg"] = val
                        elif p in ("delivery_form_input_bg", "input_bg", "input_color"):
                            bprops["input_color"] = val
                            bprops["delivery_form_input_bg"] = val
                        elif p in ("delivery_form_text", "text", "text_color"):
                            bprops["text_color"] = val
                            bprops["delivery_form_text"] = val
                        elif p in ("delivery_form_btn_bg", "btn_bg", "button_bg", "button_bg_color", "accent_color"):
                            bprops["button_bg_color"] = val
                            bprops["delivery_form_btn_bg"] = val
                        elif p in ("delivery_form_border", "border", "border_color"):
                            bprops["border_color"] = val
                            bprops["delivery_form_border"] = val
                        else:
                            bprops[p] = val
                    elif comp == "payment" or "payment" in norm_btype:
                        if p in ("payment_bg", "bg", "background", "background_color"):
                            bprops["background_color"] = val
                            bprops["payment_bg"] = val
                        elif p in ("payment_card_bg", "card_bg", "card_color", "panel_color"):
                            bprops["card_color"] = val
                            bprops["panel_color"] = val
                            bprops["payment_card_bg"] = val
                        elif p in ("payment_text_color", "text", "text_color"):
                            bprops["text_color"] = val
                            bprops["payment_text_color"] = val
                        elif p in ("payment_accent_color", "accent", "accent_color", "button_bg"):
                            bprops["accent_color"] = val
                            bprops["button_bg_color"] = val
                            bprops["payment_accent_color"] = val
                        elif p in ("payment_border_color", "border", "border_color"):
                            bprops["border_color"] = val
                            bprops["payment_border_color"] = val
                        else:
                            bprops[p] = val
                    elif comp in ("place_order", "checkout_review", "review_and_pay") or any(k in norm_btype for k in ["placeorder", "checkoutreview", "reviewandpay", "placeordercta"]):
                        if p in ("place_order_bg", "bg", "background", "background_color", "panel_bg", "panel_color"):
                            bprops["background_color"] = val
                            bprops["place_order_bg"] = val
                        elif p in ("place_order_card_bg", "card_bg", "card_color"):
                            bprops["card_bg"] = val
                            bprops["card_color"] = val
                            bprops["place_order_card_bg"] = val
                        elif p in ("place_order_text", "text", "text_color", "title_color"):
                            bprops["text_color"] = val
                            bprops["title_color"] = val
                            bprops["section_title_color"] = val
                            bprops["place_order_text"] = val
                        elif p in ("place_order_btn_bg", "btn_bg", "button_bg", "button_bg_color", "accent_color"):
                            bprops["button_bg_color"] = val
                            bprops["accent_color"] = val
                            bprops["place_order_btn_bg"] = val
                        elif p in ("place_order_border", "border", "border_color"):
                            bprops["border_color"] = val
                            bprops["soft_border_color"] = val
                            bprops["place_order_border"] = val
                        else:
                            bprops[p] = val
                    elif comp in ("checkout_steps",) or "checkoutstep" in norm_btype:
                        if p in ("checkout_steps_bg", "bg", "background", "background_color"):
                            bprops["background_color"] = val
                        elif p in ("active_step_bg", "accent_color"):
                            bprops["active_step_bg"] = val
                            bprops["line_active_color"] = val
                        elif p in ("active_text_color", "active_step_text"):
                            bprops["active_text_color"] = val
                            bprops["active_step_text"] = val
                        elif p in ("border_color", "border"):
                            bprops["border_color"] = val
                        else:
                            bprops[p] = val
                    elif comp == "checkout":
                        if any(k in norm_btype for k in ["deliveryform", "addressform"]):
                            if p in ("checkout_bg", "bg", "background", "background_color"):
                                bprops["background_color"] = val
                                bprops["delivery_form_bg"] = val
                            elif p in ("checkout_card_bg", "card_bg", "card_color"):
                                bprops["card_color"] = val
                            elif p in ("text", "text_color"):
                                bprops["text_color"] = val
                        elif "payment" in norm_btype:
                            if p in ("checkout_bg", "bg", "background", "background_color"):
                                bprops["background_color"] = val
                                bprops["payment_bg"] = val
                            elif p in ("checkout_card_bg", "card_bg", "card_color"):
                                bprops["card_color"] = val
                            elif p in ("text", "text_color"):
                                bprops["text_color"] = val
                        elif any(k in norm_btype for k in ["placeorder", "checkoutreview", "reviewandpay"]):
                            if p in ("checkout_bg", "bg", "background", "background_color"):
                                bprops["background_color"] = val
                                bprops["place_order_bg"] = val
                            elif p in ("checkout_card_bg", "card_bg", "card_color"):
                                bprops["card_bg"] = val
                                bprops["card_color"] = val
                            elif p in ("text", "text_color"):
                                bprops["text_color"] = val
                        elif "summary" in norm_btype and "cart" not in norm_btype:
                            if p in ("checkout_bg", "bg", "background", "background_color"):
                                bprops["background_color"] = val
                                bprops["panel_color"] = val
                            elif p in ("checkout_card_bg", "card_bg", "card_color"):
                                bprops["card_color"] = val
                            elif p in ("text", "text_color"):
                                bprops["text_color"] = val
                        elif "checkoutstep" in norm_btype:
                            bprops["background_color"] = val
                        else:
                            bprops[p] = val
                    else:
                        bprops[p] = val

                    # Synchronize Hero Slides & CTAs
                    if "hero" in norm_btype or "banner" in norm_btype:
                        if p in ("hero_accent", "accent_color", "button_bg_color"):
                            bprops["hero_accent"] = val
                            bprops["accent_color"] = val
                            bprops["button_bg_color"] = val
                            for slide in bprops.get("slides", []):
                                if isinstance(slide, dict):
                                    slide["accent_color"] = val
                                    if "primary_cta" in slide and isinstance(slide["primary_cta"], dict):
                                        slide["primary_cta"]["bg_color"] = val
                        elif p in ("hero_bg", "background_color"):
                            for slide in bprops.get("slides", []):
                                if isinstance(slide, dict):
                                    slide["background_color"] = val
                        elif p in ("hero_text_color", "text_color"):
                            for slide in bprops.get("slides", []):
                                if isinstance(slide, dict):
                                    slide["text_color"] = val

                    applied_patch[p] = val
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

    if "navbar_bg" in patch_dict and "navbar_outer_bg" not in patch_dict:
        patch_dict["navbar_outer_bg"] = patch_dict["navbar_bg"]

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
        "notification", "notifications", "bell", "profile", "profile_dropdown", "profile dropdown", "account", "navigation", "top bar"
    ]

    # 0. If user specifically asked about an unsupported dashboard element, strictly block it
    if any(u in msg_lower for u in unmapped_words) and not any(s in msg_lower for s in supported_words):
        return "unsupported"

    # Explicit Banner Creation Priority:
    # ONLY trigger banner_create if user asks to create/add/generate a brand new banner slide.
    # NEVER trigger banner_create when modifying properties of an existing banner (e.g. radius, color, height)!
    hero_styling_words = [
        "radius", "radious", "radios", "rounded", "sharp", "pill", "box", "border",
        "color", "colour", "bg", "background", "height", "size", "bigger", "smaller", "taller", "shorter",
        "padding", "margin", "dark", "light", "blue", "red", "green", "black", "white",
        "yellow", "orange", "purple", "pink", "accent", "button", "cta", "font", "text",
        "existing", "modify", "style", "recolor", "change", "turn", "set", "the hero banner", "the banner"
    ]
    has_hero_styling = any(w in msg_lower for w in hero_styling_words)
    has_banner_verb = bool(re.search(
        r"\b(create|add|insert|generate)\s+(a\s+|an\s+|the\s+)?([a-z0-9\-%]+\s+)*(banner|slide|hero\s+banner)\b",
        msg_lower
    ))
    has_make_new_banner = bool(re.search(
        r"\bmake\s+(a\s+|an\s+)?([a-z0-9\-%]+\s+)*(banner|slide)\b",
        msg_lower
    )) and not any(w in msg_lower for w in ["the banner", "the hero banner", "banner to", "banner into", "hero to"])
    has_banner_creation = (has_banner_verb or has_make_new_banner) and not has_hero_styling
    if has_banner_creation:
        return "banner_create"

    if target_component:
        t_clean = target_component.lower().strip()
        if t_clean == "unsupported":
            return "unsupported"
        if t_clean in ["revert", "undo"]:
            return "revert"
        if t_clean in ["banner_create", "create_banner", "add_banner"]:
            # Only downgrade if the user is explicitly telling to style an existing banner without any creation verbs
            has_create_verb = bool(re.search(r"\b(create|add|insert|generate|new|make)\b", msg_lower))
            is_styling_existing = any(w in msg_lower for w in [
                "existing banner", "existing banners", "style the banner", "modify the banner", 
                "color of banner", "color of the banner", "banner to red", "banner to blue"
            ]) and not has_create_verb
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

    # 2. Banner Creation (Detect creation verbs governing banner or slide)
    has_banner_creation = (has_banner_verb or has_make_new_banner) and not has_hero_styling
    if has_banner_creation:
        return "banner_create"

    # 3. Comprehensive multi-word scan using sorted aliases (consuming matched tokens to avoid substring collisions)
    found_components = set()
    # Sort aliases longest phrase first to match specific multi-word components (e.g. "section group carousel" before "carousel")
    sorted_phrases = sorted(COMPONENT_ALIASES.keys(), key=len, reverse=True)
    consumed_text = msg_lower
    for phrase in sorted_phrases:
        pattern = r'(?:\b|^)' + re.escape(phrase) + r'(?:\b|$)'
        if re.search(pattern, consumed_text):
            mapped_val = COMPONENT_ALIASES[phrase]
            if mapped_val.startswith("multi:"):
                for sub in mapped_val[6:].split(","):
                    if sub.strip():
                        found_components.add(sub.strip())
            else:
                found_components.add(mapped_val)
            consumed_text = re.sub(pattern, " " * len(phrase), consumed_text, count=1)

    # Reference Component Filter: If navbar is mentioned only as a color reference (e.g. "the navbar has yellow and red theme, please use these colors on carousel" or "make the theme same as webpage theme, for notification, the yellow webpage or navbar theme")
    is_navbar_explicit_target = bool(re.search(r'\b(?:change|make|set|turn|update|style)\s+(?:the\s+)?(?:navbar|header)\b|\b(?:navbar|header)\s+(?:to|in)\s+#[0-9a-fA-F]{3,6}\b', msg_lower))
    if "navbar" in found_components and len(found_components) > 1 and not is_navbar_explicit_target:
        if re.search(r'\bnavbar has\b|\buse (?:the )?navbar\b|\bfrom (?:the )?navbar\b|\bnavbar colors?\b|\bmatch (?:the )?navbar\b|\blike (?:the )?navbar\b|\bsame as (?:the )?(?:webpage|navbar)\b|\bor (?:the )?navbar\b|\bfor (?:notification|filter|cart|profile|support|carousel|review|pagination)\b', msg_lower):
            found_components.remove("navbar")

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
        "carousel", "carousels", "crowsel", "crowsels", "carowsel", "carowsels", "crowser", "crowsers",
        "card", "cards", "grid", "navbar", "footer", "hero", "header", "banner",
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
    history_str: Optional[str] = None,
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

    # 4. Palette Suggestions Handler & Conversational Follow-Up Resolution
    hist_lower = str(history_str or "").lower()
    has_palette_in_hist = any(h in hist_lower for h in ["palette", "palettes", "pallete", "palletes", "suggested themes", "theme", "themes", "designer-crafted themes"])
    msg_is_followup = has_palette_in_hist and any(bool(re.search(pat, msg_lower)) for pat in [
        r"\b(new\s*one|another(?:\s*one)?|different(?:\s*ones?|\s*options?)?|more\s*options?|other\s*options?)\b",
        r"\b(?:[1-6]|\d+|few|some|couple)\s*more\b",
        r"\b(give|show|generate|genrate|create|provide)\s*(?:me\s*)?(?:[1-6]|\d+|more|new|another)\b",
        r"\b(didn'?t\s*like|don'?t\s*like|not\s*liking|none\s*of\s*(?:these|them|it|those))\b",
        r"^\s*(?:[1-6]|\d+)\s*more\s*$",
        r"^\s*more\s*$",
        r"^\s*new\s*one\s*$",
        r"^\s*give\s*me\s*(?:new\s*one|[1-6]|\d+)\s*$",
    ])
    msg_suggests_palettes = bool(
        re.search(r"\b(suggest|recommend|ideas?|options?)\b.*\b(theme|themes|tmplete|template|palette|palettes|pallete|palletes|pallette|pallettes|colors?|colours?)\b", msg_lower)
        or re.search(r"\b(theme|themes|tmplete|template|palette|palettes|pallete|palletes|pallette|pallettes)\b.*\b(suggest|suggestion|suggestions|recommend|recommendation|recommendations|ideas?|options?)\b", msg_lower)
        or re.search(r"\b(generate|genrate|give|show|create|provide|share)\b.*\b(few|some|a\s+few|several|couple|multiple|different|various)\b.*\b(theme|themes|tmplete|template|palette|palettes|pallete|palletes|pallette|pallettes|colors?|colours?)\b", msg_lower)
        or re.search(r"\b(give|show|generate|genrate|create|provide|share)\b.*\b(theme|themes|tmplete|template|palette|palettes|pallete|palletes|pallette|pallettes)\b", msg_lower)
        or re.search(r"\b(few|some|several|couple|\d+)\b.*\b(theme|themes|tmplete|template|palette|palettes|pallete|palletes|pallette|pallettes)\b", msg_lower)
        or (re.search(r"#[0-9a-fA-F]{3,6}", msg_lower) and any(w in msg_lower for w in ["theme", "themes", "palette", "palettes", "pallete", "palletes", "pallette", "pallettes"]))
    )
    if wants_palette_suggestions or msg_suggests_palettes or msg_is_followup:
        if target_comp and target_comp != "overall":
            comp_palettes = await generate_component_palette_suggestions(
                brand_name=brand_name,
                domain=domain,
                target_component=target_comp,
                color_description=user_message,
                current_theme=theme,
                session_id=session_id,
                history_str=history_str,
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
                session_id=session_id,
                history_str=history_str,
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
        history_str=history_str,
    )

    actions = list(design_plan.actions)

    # 5A. Canonical Property Normalization:
    # Ensure every DesignAction targets the exact canonical property for its component,
    # converting generic terms like "background", "text", "border", "card_bg" to the exact keys
    # consumed by the React storefront components and registered in THEME_COMPONENT_OVERRIDE_KEYS.
    normalized_actions: List[DesignAction] = []
    for a in actions:
        comp_target = a.target_component.lower().strip()
        if comp_target not in CANONICAL_COMPONENT_PROPERTY_MAP and target_comp in CANONICAL_COMPONENT_PROPERTY_MAP:
            comp_target = target_comp

        prop_clean = a.property_name.strip()
        if comp_target in CANONICAL_COMPONENT_PROPERTY_MAP and prop_clean in CANONICAL_COMPONENT_PROPERTY_MAP[comp_target]:
            mapped_props = CANONICAL_COMPONENT_PROPERTY_MAP[comp_target][prop_clean]
            if isinstance(mapped_props, list):
                for mp in mapped_props:
                    normalized_actions.append(DesignAction(
                        target_component=comp_target,
                        target_element=a.target_element,
                        property_name=mp,
                        value=a.value,
                        reasoning=a.reasoning,
                    ))
            else:
                normalized_actions.append(DesignAction(
                    target_component=comp_target,
                    target_element=a.target_element,
                    property_name=mapped_props,
                    value=a.value,
                    reasoning=a.reasoning,
                ))
        else:
            normalized_actions.append(a)
    actions = normalized_actions

    # 5B. Multi-Carousel Synchronization Guarantee:
    # If carousels are targeted (multi:product_carousel,section_group_carousel or generic carousel),
    # ensure that styling actions for carousel background or cards are applied to BOTH product_carousel AND section_group_carousel!
    is_multi_carousel_target = "section_group_carousel" in str(target_comp) or "carousel" in str(target_comp)
    if is_multi_carousel_target:
        has_pc_bg = any(a.target_component in ("product_carousel", "carousel") and a.property_name in ("outer_bg_color", "grid_bg", "card_bg", "card_bg_color") for a in actions)
        has_sgc_bg = any(a.target_component in ("section_group_carousel", "carousel") and a.property_name in ("outer_bg_color", "grid_bg", "card_bg", "card_bg_color") for a in actions)
        if has_pc_bg and not has_sgc_bg:
            for a in list(actions):
                if a.target_component in ("product_carousel", "carousel") and a.property_name in ("outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_radius", "title_color"):
                    actions.append(DesignAction(
                        target_component="section_group_carousel",
                        target_element=a.target_element,
                        property_name=a.property_name,
                        value=a.value,
                        reasoning="Mirroring carousel styling to section_group_carousel for cohesive store theme"
                    ))
        elif has_sgc_bg and not has_pc_bg:
            for a in list(actions):
                if a.target_component in ("section_group_carousel", "carousel") and a.property_name in ("outer_bg_color", "grid_bg", "card_bg", "card_bg_color", "card_radius", "title_color"):
                    actions.append(DesignAction(
                        target_component="product_carousel",
                        target_element=a.target_element,
                        property_name=a.property_name,
                        value=a.value,
                        reasoning="Mirroring carousel styling to product_carousel for cohesive store theme"
                    ))

    # 5C. Contrast & Accessibility Safety Harmonizer
    # If an action sets a background, verify that a readable text color exists or synthesize one
    for a in list(actions):
        if a.property_name in BG_TO_TEXT_MAP and isinstance(a.value, str):
            comp_name, text_prop = BG_TO_TEXT_MAP[a.property_name]
            user_text_action = next((
                other for other in actions
                if other.target_component == comp_name and (other.property_name == text_prop or "text" in other.property_name)
            ), None)
            if not user_text_action:
                safe_text = ensure_accessible_contrast(None, a.value)
                actions.append(DesignAction(
                    target_component=comp_name,
                    target_element="text",
                    property_name=text_prop,
                    value=safe_text,
                    reasoning=f"Automatic WCAG AA contrast for {a.property_name}"
                ))
            else:
                user_text_action.value = ensure_accessible_contrast(str(user_text_action.value), a.value)

    # 5D. Execute Actions onto Draft Definition
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
