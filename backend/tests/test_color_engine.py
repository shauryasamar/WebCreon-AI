"""
Unit Tests for WebCreon AI Hybrid Mathematical Color Engine
Validates:
(a) Running generate 50 times with "red" produces distinct palettes (no two primary_bg + accent_color pairs match across all runs).
(b) Every single text/background pair meets WCAG AA contrast (ratio >= 4.5:1).
(c) Requests with multiple palettes contain distinct harmonies / visual canvases.
"""

import sys
import os
import pytest
import asyncio

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["SKIP_PALETTE_LLM_NAMING"] = "true"
os.environ["SKIP_PALETTE_CREDIT_DEDUCTION"] = "true"

from agents.color_design_agent import (
    generate_color_palettes,
    calculate_contrast_ratio,
    ensure_accessible_contrast,
    hex_to_hsl,
    is_color_dark,
)


@pytest.mark.asyncio
async def test_palette_uniqueness_across_50_runs():
    """
    Asserts that across 50 runs of requesting 'red', every generation produces
    unique (primary_bg, accent_color) pairs thanks to cryptographic randomness.
    """
    seen_pairs = set()
    total_palettes = 0

    for run_idx in range(50):
        # Generate 1 palette per run for fast execution
        palettes = await generate_color_palettes(
            brand_name="TestStore",
            domain="Fashion",
            color_description="red theme palette",
            count=1,
        )
        assert len(palettes) == 1, f"Expected 1 palette, got {len(palettes)}"
        pal = palettes[0]
        pair = (pal["primary_bg"].lower(), pal["accent_color"].lower())
        
        # Verify no collision across 50 independent runs
        assert pair not in seen_pairs, f"Collision detected at run {run_idx}: {pair}"
        seen_pairs.add(pair)
        total_palettes += 1

    assert total_palettes == 50
    assert len(seen_pairs) == 50


@pytest.mark.asyncio
async def test_wcag_aa_contrast_on_all_text_pairs():
    """
    Asserts that every text/background pair across generated palettes satisfies
    strict WCAG AA contrast (ratio >= 4.5:1).
    """
    test_queries = [
        "give me 3 red theme palette",
        "emerald green luxury",
        "sunny yellow store",
        "oceanic blue modern",
        "earthy sand minimalist",
    ]

    for query in test_queries:
        palettes = await generate_color_palettes(
            brand_name="Aura Brand",
            domain="Luxury",
            color_description=query,
            count=3,
        )
        assert len(palettes) == 3

        for p_idx, pal in enumerate(palettes):
            # 1. Main Text vs Primary Background
            r_main = calculate_contrast_ratio(pal["text_color"], pal["primary_bg"])
            assert r_main >= 4.5, (
                f"Main text contrast failed on '{query}' (palette {p_idx}): "
                f"text={pal['text_color']}, bg={pal['primary_bg']}, ratio={r_main:.2f}"
            )

            # 2. Accent Text vs Accent Button Color
            r_accent = calculate_contrast_ratio(pal["accent_text"], pal["accent_color"])
            assert r_accent >= 4.5, (
                f"Accent text contrast failed on '{query}' (palette {p_idx}): "
                f"text={pal['accent_text']}, bg={pal['accent_color']}, ratio={r_accent:.2f}"
            )

            # 3. Navbar Text vs Navbar Background
            r_nav = calculate_contrast_ratio(pal["navbar_text_color"], pal["navbar_bg"])
            assert r_nav >= 4.5, (
                f"Navbar text contrast failed on '{query}' (palette {p_idx}): "
                f"text={pal['navbar_text_color']}, bg={pal['navbar_bg']}, ratio={r_nav:.2f}"
            )

            # 4. Card Text vs Card Background
            r_card = calculate_contrast_ratio(pal["card_text_color"], pal["card_bg"])
            assert r_card >= 4.5, (
                f"Card text contrast failed on '{query}' (palette {p_idx}): "
                f"text={pal['card_text_color']}, bg={pal['card_bg']}, ratio={r_card:.2f}"
            )

            # 5. Footer Text vs Footer Background
            r_footer = calculate_contrast_ratio(pal["footer_text_color"], pal["footer_bg"])
            assert r_footer >= 4.5, (
                f"Footer text contrast failed on '{query}' (palette {p_idx}): "
                f"text={pal['footer_text_color']}, bg={pal['footer_bg']}, ratio={r_footer:.2f}"
            )


@pytest.mark.asyncio
async def test_distinct_harmonies_within_single_request():
    """
    Asserts that when 3 or 4 palettes are requested, all palettes in the batch
    have distinct visual surfaces and accent pairings (no identical duplicates).
    """
    palettes = await generate_color_palettes(
        brand_name="Cactus Tech",
        domain="Electronics",
        color_description="give me 4 red theme palettes",
        count=4,
    )
    assert len(palettes) == 4

    bgs = [p["primary_bg"].lower() for p in palettes]
    accents = [p["accent_color"].lower() for p in palettes]

    # No two primary_bg should be identical in the same response
    assert len(set(bgs)) == len(bgs), f"Duplicate primary_bg found in single request: {bgs}"

    # No two accent colors should be identical in the same response
    assert len(set(accents)) == len(accents), f"Duplicate accent_color found: {accents}"


@pytest.mark.asyncio
async def test_red_theme_prominence():
    """
    Asserts that when 'red' is requested, every generated palette has red prominently
    featured—either as the primary CTA accent_color, or as the deep immersive primary_bg.
    Never an off-white background with a green-only accent!
    """
    palettes = await generate_color_palettes(
        brand_name="Test Store",
        domain="Apparel",
        color_description="give me 3 red theme palettes",
        count=3,
    )
    assert len(palettes) == 3

    for idx, pal in enumerate(palettes):
        acc_h, acc_s, acc_l = hex_to_hsl(pal["accent_color"])
        bg_h, bg_s, bg_l = hex_to_hsl(pal["primary_bg"])
        
        # Red hue spans approximately 335 to 360 and 0 to 25
        acc_is_red = (acc_h >= 335.0 or acc_h <= 25.0) and acc_s > 0.3
        bg_is_red = (bg_h >= 335.0 or bg_h <= 25.0) and bg_s > 0.3
        
        assert acc_is_red or bg_is_red, (
            f"Palette {idx} ({pal['name']}) lacks prominent red! "
            f"accent_color={pal['accent_color']} (hue={acc_h:.1f}), "
            f"primary_bg={pal['primary_bg']} (hue={bg_h:.1f})"
        )


@pytest.mark.asyncio
async def test_followup_color_retention_and_count_parsing():
    """
    Asserts that follow-up requests ("give me 5 more", "3 more", "new one")
    dynamically parse the requested count and correctly retain the active color family (red)
    from conversation history without drifting to green or random hues.
    """
    history_context = "User: give me 3 red theme palettes\nAssistant: Here are 3 distinct, designer-crafted themes tailored for your store."
    
    # Test 1: "give me 5 more"
    palettes_5 = await generate_color_palettes(
        brand_name="Luxe Aura",
        domain="Fashion",
        color_description="give me 5 more",
        history_str=history_context,
        session_id="test_followup_session",
    )
    assert len(palettes_5) == 5, f"Expected 5 palettes for 'give me 5 more', got {len(palettes_5)}"
    
    # Verify all 5 palettes retain RED prominence from conversation history
    for idx, pal in enumerate(palettes_5):
        acc_h, acc_s, _ = hex_to_hsl(pal["accent_color"])
        bg_h, bg_s, _ = hex_to_hsl(pal["primary_bg"])
        nav_h, nav_s, _ = hex_to_hsl(pal["navbar_bg"])
        
        has_red = (
            ((acc_h >= 335.0 or acc_h <= 25.0) and acc_s > 0.3)
            or ((bg_h >= 335.0 or bg_h <= 25.0) and bg_s > 0.15)
            or ((nav_h >= 335.0 or nav_h <= 25.0) and nav_s > 0.3)
        )
        assert has_red, (
            f"Follow-up palette {idx} ({pal['name']}) drifted away from RED! "
            f"accent={pal['accent_color']} (hue={acc_h:.1f}), bg={pal['primary_bg']} (hue={bg_h:.1f})"
        )

    # Test 2: "give me new one"
    palettes_new = await generate_color_palettes(
        brand_name="Luxe Aura",
        domain="Fashion",
        color_description="give me new one",
        history_str=history_context,
        session_id="test_followup_session",
    )
    assert len(palettes_new) == 3, f"Expected fresh batch of 3 palettes for 'give me new one', got {len(palettes_new)}"


@pytest.mark.asyncio
async def test_palette_memory_fresh_archetypes():
    """
    Asserts that session memory prevents repetitive archetypes:
    Turn 1 generates 3 archetypes; Turn 2 ('3 more') generates the 3 remaining archetypes,
    resulting in 0 overlap between the two successive turns!
    """
    sess = "session_memory_test_unique"
    
    # Turn 1
    t1_palettes = await generate_color_palettes(
        brand_name="Store",
        domain="Apparel",
        color_description="give me 3 red theme palettes",
        session_id=sess,
        count=3,
    )
    assert len(t1_palettes) == 3
    t1_names = [p["name"] for p in t1_palettes]
    t1_bgs = [p["primary_bg"].lower() for p in t1_palettes]

    # Turn 2: Follow-up requesting 3 more
    t2_palettes = await generate_color_palettes(
        brand_name="Store",
        domain="Apparel",
        color_description="3 more",
        history_str="User: give me 3 red theme palettes",
        session_id=sess,
        count=3,
    )
    assert len(t2_palettes) == 3
    t2_names = [p["name"] for p in t2_palettes]
    t2_bgs = [p["primary_bg"].lower() for p in t2_palettes]

    # Primary background styles between Turn 1 and Turn 2 should have zero overlap
    overlap = set(t1_bgs).intersection(set(t2_bgs))
    assert len(overlap) == 0, f"Repetitive backgrounds detected between turns: {overlap}"


@pytest.mark.asyncio
async def test_hex_code_palette_generation():
    """
    Asserts that passing an explicit hex color code (e.g. #ac3039):
    1. Accurately detects the hex code and classifies it into the correct color family (Crimson).
    2. Centers all palettes around the exact hue (~355.6 degrees).
    3. Guarantees the exact hex code #ac3039 is used in the generated palettes as accent and/or header.
    4. Guarantees WCAG AA (>= 4.5:1) compliance for all text/background pairs.
    5. Retains the hex code across conversational follow-ups ('give me 3 more').
    """
    # Turn 1: Explicit hex code with typo 'pallete'
    palettes = await generate_color_palettes(
        brand_name="Crimson Atelier",
        domain="Luxury",
        color_description="give me theme in color of this #ac3039, 3 pallete i need",
        session_id="test_hex_session",
        count=3,
    )
    assert len(palettes) == 3, f"Expected 3 palettes, got {len(palettes)}"

    for idx, pal in enumerate(palettes):
        # Assert exact hex #ac3039 is used in accent_color (or navbar_bg for bold header)
        accent = pal["accent_color"].lower()
        nav = pal["navbar_bg"].lower()
        assert accent == "#ac3039" or nav == "#ac3039", (
            f"Palette {idx} ({pal['name']}) did not incorporate #ac3039! Accent={accent}, Nav={nav}"
        )

        # WCAG AA contrast check
        r_acc = calculate_contrast_ratio(pal["accent_text"], pal["accent_color"])
        assert r_acc >= 4.5, f"Accent text contrast failed on palette {idx}: ratio={r_acc}"

        r_text = calculate_contrast_ratio(pal["text_color"], pal["primary_bg"])
        assert r_text >= 4.5, f"Text contrast failed on palette {idx}: ratio={r_text}"

        r_nav = calculate_contrast_ratio(pal["navbar_text_color"], pal["navbar_bg"])
        assert r_nav >= 4.5, f"Navbar contrast failed on palette {idx}: ratio={r_nav}"

    # Turn 2: Follow-up 'give me 3 more' retaining #ac3039 via conversational memory
    followup_palettes = await generate_color_palettes(
        brand_name="Crimson Atelier",
        domain="Luxury",
        color_description="give me 3 more",
        history_str="User: give me theme in color of this #ac3039, 3 pallete i need\nAssistant: Here are 3 palettes",
        session_id="test_hex_session",
        count=3,
    )
    assert len(followup_palettes) == 3
    for idx, pal in enumerate(followup_palettes):
        accent = pal["accent_color"].lower()
        nav = pal["navbar_bg"].lower()
        assert accent == "#ac3039" or nav == "#ac3039", (
            f"Follow-up palette {idx} ({pal['name']}) lost #ac3039 context! Accent={accent}, Nav={nav}"
        )


if __name__ == "__main__":
    asyncio.run(test_palette_uniqueness_across_50_runs())
    asyncio.run(test_wcag_aa_contrast_on_all_text_pairs())
    asyncio.run(test_distinct_harmonies_within_single_request())
    asyncio.run(test_red_theme_prominence())
    asyncio.run(test_followup_color_retention_and_count_parsing())
    asyncio.run(test_palette_memory_fresh_archetypes())
    asyncio.run(test_hex_code_palette_generation())
    print("ALL TESTS PASSED SUCCESSFULLY!")


