"""
WebNirmaan AI - Unified Master Color & Design Agent
Unified source of truth for color palette generation, WCAG AA accessibility contrast,
component color patching, live block styling, whole-site theme matching, and AI palette suggestions.
"""

import copy
import json
import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# Upgraded to GPT-4o with low temperature for high-precision component color targeting
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)


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
# 2. CONTRAST & ACCESSIBILITY UTILITIES
# ==========================================

def calculate_contrast_color(bg_val: str) -> str:
    """Calculates high-contrast text color (#ffffff or #0f172a) for any background hex, RGB, or gradient."""
    if not isinstance(bg_val, str) or not bg_val.strip():
        return "#ffffff"

    bg_clean = bg_val.strip().lower()

    # Extract hex code from gradient string if applicable (e.g. "linear-gradient(135deg, #0f172a, #1e293b)")
    hex_match = re.search(r"#[0-9a-f]{3,6}", bg_clean)
    if hex_match:
        hex_clean = hex_match.group(0).lstrip("#")
    elif bg_clean.startswith("#"):
        hex_clean = bg_clean.lstrip("#")
    else:
        return "#ffffff"

    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    if len(hex_clean) != 6:
        return "#ffffff"
    try:
        r = int(hex_clean[0:2], 16)
        g = int(hex_clean[2:4], 16)
        b = int(hex_clean[4:6], 16)
        luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return "#0f172a" if luminance > 0.5 else "#ffffff"
    except Exception:
        return "#ffffff"


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
    primary_bg: Optional[str] = Field(default=None, description="Primary page background hex")
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
    
    product_detail_bg: Optional[str] = Field(default=None, description="Product detail page container background hex")
    product_detail_text: Optional[str] = Field(default=None, description="Product detail text color hex")
    product_detail_btn_bg: Optional[str] = Field(default=None, description="Product detail add to cart button background hex")
    product_detail_btn_text: Optional[str] = Field(default=None, description="Product detail add to cart button text hex")

    cart_bg: Optional[str] = Field(default=None, description="Cart sidebar/drawer background hex")
    cart_text_color: Optional[str] = Field(default=None, description="Cart sidebar text hex")
    cart_card_bg: Optional[str] = Field(default=None, description="Cart item card background hex")
    cart_accent_color: Optional[str] = Field(default=None, description="Cart checkout button background hex")

    review_card_bg: Optional[str] = Field(default=None, description="Review section card background hex")
    review_text_color: Optional[str] = Field(default=None, description="Review section text hex")
    review_border_color: Optional[str] = Field(default=None, description="Review section border hex")


# Comprehensive Component Scoping Map covering all storefront sections
COMPONENT_ALLOWED_KEYS = {
    "navbar": {"navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color"},
    "footer": {"footer_bg", "footer_text_color", "footer_muted_color", "footer_border_color"},
    "hero": {"hero_bg", "hero_text_color", "hero_accent"},
    "card": {"card_bg", "card_text_color", "card_border_color", "card_shadow"},
    "product_grid": {"card_bg", "card_text_color", "card_border_color", "card_shadow"},
    "product_detail": {"product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text", "secondary_bg"},
    "cart": {"cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "border_color"},
    "checkout": {"checkout_bg", "checkout_card_bg", "checkout_text_color", "checkout_accent_color"},
    "payment": {"payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color"},
    "filter": {"filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color"},
    "review": {"review_card_bg", "review_text_color", "review_border_color"},
    "background": {"primary_bg", "secondary_bg", "text_color", "muted_text"},
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
- If target_component is 'navbar', ONLY populate navbar_bg, navbar_text_color, navbar_border_color. Do NOT touch primary_bg or card_bg!
- If target_component is 'footer', ONLY populate footer_bg, footer_text_color, footer_muted_color, footer_border_color. Do NOT touch primary_bg!
- If target_component is 'card' or 'product_grid', ONLY populate card_bg, card_text_color, card_border_color for catalog product cards. Do NOT touch product_detail or cart!
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
        # If user explicitly requested whole webpage/website/overall -> ALLOW ALL KEYS
        elif target_lower in ["overall", "webpage", "website", "site", "all", "entire", "full"]:
            allowed = None
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
                    "button_bg_color", "button_text_color", "card_color"
                ]:
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
                    if "card_bg" in patch_dict:
                        bprops["card_bg_color"] = patch_dict["card_bg"]
                    if "card_text_color" in patch_dict:
                        bprops["title_color"] = patch_dict["card_text_color"]
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
    if any(w in msg_lower for w in ["navbar", "nav bar", "header", "top bar"]):
        found_components.add("navbar")
    if "footer" in msg_lower:
        found_components.add("footer")
    if any(w in msg_lower for w in ["hero", "banner", "slider"]):
        found_components.add("hero")
    if "cart" in msg_lower:
        found_components.add("cart")
    if any(w in msg_lower for w in ["checkout", "payment"]):
        found_components.add("checkout")
    if any(w in msg_lower for w in ["review", "rating"]):
        found_components.add("review")
    if "filter" in msg_lower:
        found_components.add("filter")
    if any(w in msg_lower for w in ["product detail", "product page", "details page", "detail page", "product info", "gallery", "purchase panel"]):
        found_components.add("product_detail")
    elif any(w in msg_lower for w in ["product card", "product cards", "card color", "cards color", "card bg", "card background", "catalog card", "item card", "grid card", "card"]):
        found_components.add("card")
    elif any(w in msg_lower for w in ["product grid", "products grid", "products section", "product section", "collection grid"]):
        found_components.add("product_grid")
    if any(w in msg_lower for w in ["background", "bg", "page bg"]):
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

    # 2. Whole Website Component Matcher Handler (e.g. "match whole website to navbar", "card theme as well please")
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
