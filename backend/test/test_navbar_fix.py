import pytest
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.color_design_agent import (
    execute_design_actions,
    DesignAction,
    apply_theme_to_blocks,
    detect_target_component,
)


def test_navbar_bg_synchronizes_outer_bg_in_theme_and_blocks():
    """Verify that when navbar_bg is modified, navbar_outer_bg is synchronized to prevent stale outer background colors."""
    site_def = {
        "theme": {
            "navbar_bg": "#112233",
            "navbar_outer_bg": "#FFD700",  # Stale golden outer background
            "navbar_border_color": "#FFD700",
        },
        "pages": [
            {
                "name": "Home",
                "blocks": [
                    {
                        "type": "navbar",
                        "props": {
                            "navbar_bg": "#112233",
                            "navbar_outer_bg": "#FFD700",  # Stale golden outer background
                            "navbar_border_color": "#FFD700",
                        },
                    }
                ],
            }
        ],
    }

    actions = [
        DesignAction(
            target_component="navbar",
            target_element="background",
            property_name="navbar_bg",
            value="#0000FF",
            reasoning="Change navbar color to blue",
        )
    ]

    modified, modified_blocks, patch, changed_keys = execute_design_actions(site_def, actions)

    assert modified is True
    assert "navbar" in modified_blocks
    # Both theme and block props must have synchronized navbar_outer_bg
    assert site_def["theme"]["navbar_bg"] == "#0000FF"
    assert site_def["theme"]["navbar_outer_bg"] == "#0000FF"
    assert patch["navbar_bg"] == "#0000FF"
    assert patch["navbar_outer_bg"] == "#0000FF"

    block_props = site_def["pages"][0]["blocks"][0]["props"]
    assert block_props["navbar_bg"] == "#0000FF"
    assert block_props["navbar_outer_bg"] == "#0000FF"


def test_outer_border_action_updates_both_outer_bg_and_border():
    """Verify that targeting outer_border updates both navbar_border_color and navbar_outer_bg."""
    site_def = {
        "theme": {
            "navbar_bg": "#0000FF",
            "navbar_outer_bg": "#FFD700",
            "navbar_border_color": "#FFD700",
        },
        "pages": [
            {
                "name": "Home",
                "blocks": [
                    {
                        "type": "navbar",
                        "props": {
                            "navbar_bg": "#0000FF",
                            "navbar_outer_bg": "#FFD700",
                            "navbar_border_color": "#FFD700",
                        },
                    }
                ],
            }
        ],
    }

    actions = [
        DesignAction(
            target_component="navbar",
            target_element="border",
            property_name="outer_border",
            value="#0000FF",
            reasoning="Keep outer border as well blue color",
        )
    ]

    modified, modified_blocks, patch, changed_keys = execute_design_actions(site_def, actions)

    assert modified is True
    assert site_def["theme"]["navbar_border_color"] == "#0000FF"
    assert site_def["theme"]["navbar_outer_bg"] == "#0000FF"

    block_props = site_def["pages"][0]["blocks"][0]["props"]
    assert block_props["navbar_border_color"] == "#0000FF"
    assert block_props["navbar_outer_bg"] == "#0000FF"


def test_apply_theme_to_blocks_syncs_navbar_outer_bg():
    """Verify apply_theme_to_blocks compatibility layer also syncs navbar_outer_bg."""
    pages = [
        {
            "name": "Home",
            "blocks": [
                {
                    "type": "navbar",
                    "props": {
                        "navbar_bg": "#FFD700",
                        "navbar_outer_bg": "#FFD700",
                    },
                }
            ],
        }
    ]

    apply_theme_to_blocks(pages, {"navbar_bg": "#0000FF"}, target_type="navbar")
    assert pages[0]["blocks"][0]["props"]["navbar_bg"] == "#0000FF"
    assert pages[0]["blocks"][0]["props"]["navbar_outer_bg"] == "#0000FF"


def test_detect_target_component_for_outer_border_query():
    """Verify that queries like 'outer border of navbar is yellow color' resolve to navbar."""
    target = detect_target_component("outer border of navbar is yellow color, please keep that as well blue color please")
    assert target == "navbar"
