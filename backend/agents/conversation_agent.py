"""
WebNirmaan AI - Store Onboarding Conversation Agent
Manages multi-turn requirement gathering interview for new store creation.
Designed with Senior Product Design & Agentic Architecture principles:
1. Natural assimilation of store details in ANY order.
2. 5 Structural Layout Archetypes (Clean Minimal, Frosted Island, Marketplace, Haute Luxury, Neo-Modern).
3. Decoupled Surface Materiality (Classic Solid, Glass Navbar, Full Glass Ecosystem).
4. Direct Hex detection, sliding-window memory, and zero-data-loss session rehydration.
"""

import asyncio
import re
import uuid
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from agents.color_design_agent import generate_color_palettes, generate_tonal_harmony, generate_palettes_from_hex


class ConversationSession(BaseModel):
    session_id: str
    admin_name: str
    admin_email: Optional[str] = None
    turns: List[Dict[str, Any]] = Field(default_factory=list)
    collected: Dict[str, Any] = Field(default_factory=dict)
    palette_options: List[Dict[str, Any]] = Field(default_factory=list)
    phase: str = "analyzing"
    is_complete: bool = False


SESSIONS: Dict[str, ConversationSession] = {}


LAYOUT_ARCHETYPE_CHOICES = [
    {
        "id": "apple_minimal",
        "label": "Clean & Minimal",
        "description": "Spacious floating pill layout with clean typography — like Apple or Linear",
    },
    {
        "id": "glassmorphism_premium",
        "label": "Frosted Island",
        "description": "Floating translucent island with soft background blur and glowing edges",
    },
    {
        "id": "modern_marketplace",
        "label": "Modern Marketplace",
        "description": "High-density layout with prominent search and category badges — like Amazon",
    },
    {
        "id": "luxury_fashion",
        "label": "Haute Luxury",
        "description": "Editorial serif typography with generous spacing — high-end boutique aesthetic",
    },
    {
        "id": "neo_modern",
        "label": "Neo-Modern 2026",
        "description": "Tactile rounded contours with soft neumorphic controls and friendly curves",
    },
]

SURFACE_MATERIALITY_CHOICES = [
    {
        "id": "solid",
        "label": "Classic Solid",
        "description": "Crisp, opaque surfaces with high-contrast modern styling",
    },
    {
        "id": "glass_navbar",
        "label": "Glass Navbar",
        "description": "Translucent frosted glass navigation bar with solid page content",
    },
    {
        "id": "full_glass",
        "label": "Full Glass Ecosystem",
        "description": "Frosted glass finish across navbar, product cards, drawers, and overlays",
    },
]

BUILD_NOW_CHOICE = {
    "id": "build_now",
    "label": "⚡ Build Store Immediately",
    "description": "Synthesize website immediately with designer-recommended defaults",
}

LAYOUT_ARCHETYPE_MAP = {
    "apple_minimal": {"navbar_layout": "apple_minimal", "footer_layout": "apple_minimal"},
    "glassmorphism_premium": {"navbar_layout": "glassmorphism_premium", "footer_layout": "glassmorphism_premium"},
    "modern_marketplace": {"navbar_layout": "modern_marketplace", "footer_layout": "modern_marketplace"},
    "luxury_fashion": {"navbar_layout": "luxury_fashion", "footer_layout": "luxury_fashion"},
    "neo_modern": {"navbar_layout": "neo_modern", "footer_layout": "neo_modern"},
}


class AgentAnalysis(BaseModel):
    extracted_brand_name: Optional[str] = Field(
        default=None, 
        description="Brand or store name ONLY if explicitly chosen/specified by the user (e.g. 'ToyTrove', 'ElectroVault'). Leave null if user is asking for suggestions."
    )
    extracted_domain: Optional[str] = Field(
        default=None, 
        description="Business industry, niche, or product category (e.g. watches, electronics, fashion, footwear, beauty, jewelry, organic grocery, coffee). Note: this is the store's industry/niche, NOT a .com URL."
    )
    extracted_color_prompt: Optional[str] = Field(
        default=None, 
        description="Color theme or aesthetic vibe mentioned by user (e.g. pink luxury, dark mode, vibrant green, neon racing)."
    )
    extracted_tagline: Optional[str] = Field(
        default=None, 
        description="Tagline or slogan for the brand if specified or accepted by user."
    )
    extracted_layout_archetype: Optional[str] = Field(
        default=None,
        description="Layout style archetype: 'apple_minimal', 'glassmorphism_premium', 'modern_marketplace', 'luxury_fashion', or 'neo_modern'."
    )
    extracted_surface_materiality: Optional[str] = Field(
        default=None,
        description="Surface finish: 'solid', 'glass_navbar', or 'full_glass'."
    )
    user_requested_name_suggestions: bool = Field(
        default=False, 
        description="Set to True if the user explicitly asks for brand/store name ideas or suggestions."
    )
    user_requested_palette_refresh: bool = Field(
        default=False, 
        description="Set to True if the user wants different, more, or alternative color palette options."
    )
    user_requested_immediate_build: bool = Field(
        default=False, 
        description="CRITICAL: Set to True ONLY if the user explicitly says 'build it now', 'use defaults and generate right now', 'skip questions and build'. Set to FALSE for all greetings, starter phrases ('let's create one', 'start building', 'make a store', 'hi', 'hello'), and general answers."
    )
    assistant_reply: str = Field(
        description="Friendly, concise, senior designer response tailored to what the user communicated."
    )


llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, request_timeout=15, max_retries=2)

analyzer_system = """You are WebNirmaan AI's Lead Designer assisting {admin_name}.

GOAL: Conduct a natural design consultation to gather store requirements (brand name, product niche, colors, layout).

RULES:
1. Natural Extraction: Extract brand name, product domain (niche/products sold), colors, or layout style whenever mentioned.
2. Intelligent Conversation: Answer greetings, exploratory/platform questions, and capability queries conversationally. Do NOT repeat trailing questions. Only suggest brand names if asked.
3. Starter Phrases: Phrases like "let's create one", "build a store", "hi" start the consultation. Greet warmly and ask what products/brand they envision. Never mark immediate build on starters.
4. Brevity: 1 to 2 crisp, elegant sentences. Warm and professional.

STATUS:
{checklist}"""

analyzer_prompt = ChatPromptTemplate.from_messages([
    ("system", analyzer_system),
    ("user", "Conversation History:\n{history}\n\nCurrently Collected Data:\n{collected}"),
])

analyzer_chain = analyzer_prompt | llm.with_structured_output(AgentAnalysis)


async def rehydrate_session(
    session_id: Optional[str] = None,
    collected: Optional[Dict[str, Any]] = None,
    turns: Optional[List[Dict[str, Any]]] = None,
    admin_name: str = "Creator",
    admin_email: Optional[str] = None,
) -> ConversationSession:
    """Rebuild or restore a session from client-side state across server reloads."""
    sid = session_id or f"sess-{uuid.uuid4().hex[:10]}"
    session = ConversationSession(
        session_id=sid,
        admin_name=admin_name,
        admin_email=admin_email,
        turns=turns or [],
        collected=collected or {},
        phase="analyzing"
    )
    if session.collected.get("chosen_palette"):
        session.phase = "layout"
    if (
        session.collected.get("brand_name") and
        session.collected.get("domain") and
        session.collected.get("chosen_palette") and
        session.collected.get("layout_archetype") and
        session.collected.get("surface_materiality")
    ):
        session.phase = "completed"
        session.is_complete = True
        
    SESSIONS[sid] = session
    return session


async def start_session(initial_prompt: str, admin_name: str = "Creator", admin_email: Optional[str] = None) -> ConversationSession:
    session_id = f"sess-{uuid.uuid4().hex[:10]}"
    
    session = ConversationSession(
        session_id=session_id,
        admin_name=admin_name,
        admin_email=admin_email,
        turns=[{"sender": "user", "text": initial_prompt}],
        collected={},
        phase="analyzing"
    )
    
    SESSIONS[session_id] = session
    return await advance_session(session_id, user_reply=None)


async def reply_session(session_id: str, user_reply: str) -> ConversationSession:
    session = SESSIONS.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
        
    session.turns.append({"sender": "user", "text": user_reply})
    return await advance_session(session_id, user_reply=user_reply)


async def advance_session(session_id: str, user_reply: Optional[str] = None) -> ConversationSession:
    session = SESSIONS.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    # Sliding-window memory: Keep turn 0 (initial prompt) + last 8 turns to eliminate token bloat
    if len(session.turns) > 9:
        windowed_turns = [session.turns[0]] + session.turns[-8:]
    else:
        windowed_turns = session.turns

    history_str = "\n".join([f"{t['sender']}: {t['text']}" for t in windowed_turns])
    reply_lower = (user_reply or "").strip().lower()

    # 1. Direct matching for Explicit Build Triggers ONLY (Buttons / Skip Setup)
    explicit_build_triggers = [
        "build_now",
        "⚡ build store immediately",
        "build now with defaults",
        "generate with defaults now",
        "skip setup and build immediately",
        "skip and build now",
    ]
    user_explicit_skip = any(kw in reply_lower for kw in [
        "skip questions", "use defaults", "pick for me", "you decide", "surprise me", "auto generate everything"
    ])
    user_requested_build = (reply_lower in explicit_build_triggers) or user_explicit_skip

    # 2. Direct Matching for Custom Hex Codes (Generate 5 Palettes Centered on Hex)
    hex_matches = re.findall(r'#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b', user_reply) if user_reply else []
    if hex_matches:
        primary_hex = hex_matches[0]
        brand_name = session.collected.get("brand_name") or "Brand"
        palettes = generate_palettes_from_hex(primary_hex, brand_name=brand_name)
        session.palette_options = palettes
        session.collected["color_prompt"] = f"Custom Hex Base: {primary_hex}"
        session.collected.pop("chosen_palette", None)
        session.collected.pop("color_theme", None)

    # 3. Direct matching for Interactive Palette Selection
    if user_reply and session.palette_options and not session.collected.get("chosen_palette"):
        for i, pal in enumerate(session.palette_options):
            if (pal.get("id", "").lower() == reply_lower or 
                f"option {i+1}" in reply_lower or 
                str(i+1) == reply_lower or 
                pal.get("name", "").lower() in reply_lower):
                session.collected["chosen_palette"] = pal
                session.collected["color_theme"] = pal["name"]
                break

    # 4. Direct matching for Layout Archetype Selection (All 5 archetypes)
    if user_reply and not session.collected.get("layout_archetype"):
        for arch in LAYOUT_ARCHETYPE_CHOICES:
            arch_id = arch["id"].lower()
            arch_label = arch["label"].lower()
            if arch_id == reply_lower or arch_id in reply_lower or arch_label == reply_lower or arch_label in reply_lower:
                session.collected["layout_archetype"] = arch["id"]
                mapped = LAYOUT_ARCHETYPE_MAP.get(arch["id"], {"navbar_layout": "apple_minimal", "footer_layout": "apple_minimal"})
                session.collected["navbar_layout"] = mapped["navbar_layout"]
                session.collected["footer_layout"] = mapped["footer_layout"]
                session.collected["navbar_position"] = "fixed"
                break

    # 5. Direct matching for Surface Materiality Selection
    if user_reply and session.collected.get("layout_archetype") and not session.collected.get("surface_materiality"):
        for mat in SURFACE_MATERIALITY_CHOICES:
            mat_id = mat["id"].lower()
            mat_label = mat["label"].lower()
            if mat_id == reply_lower or mat_id in reply_lower or mat_label == reply_lower or mat_label in reply_lower:
                session.collected["surface_materiality"] = mat["id"]
                break

    # 6. Build Dynamic Checklist for the LLM
    checklist_lines = [
        f"- Brand Name: {'✅ ' + str(session.collected.get('brand_name')) if session.collected.get('brand_name') else '❌ Not yet'}",
        f"- Business Domain: {'✅ ' + str(session.collected.get('domain')) if session.collected.get('domain') else '❌ Not yet'}",
        f"- Color Palette: {'✅ ' + str(session.collected.get('color_theme') or 'Selected') if session.collected.get('chosen_palette') else '❌ Not yet'}",
        f"- Layout Archetype: {'✅ ' + str(session.collected.get('layout_archetype')) if session.collected.get('layout_archetype') else '❌ Not yet'}",
        f"- Surface Materiality: {'✅ ' + str(session.collected.get('surface_materiality')) if session.collected.get('surface_materiality') else '❌ Not yet'}",
    ]
    dynamic_checklist = "\n".join(checklist_lines)

    # 7. Run LLM Agent Analysis
    try:
        from agents.token_tracker import TokenCostCallback
        analysis: AgentAnalysis = await analyzer_chain.ainvoke(
            {
                "history": history_str,
                "collected": str(session.collected),
                "admin_name": session.admin_name,
                "checklist": dynamic_checklist,
            },
            config={"callbacks": [TokenCostCallback("Onboarding.Analyzer", session_id=session_id)]}
        )

        if analysis.extracted_brand_name and not session.collected.get("brand_name"):
            session.collected["brand_name"] = analysis.extracted_brand_name
        if analysis.extracted_domain and not session.collected.get("domain"):
            session.collected["domain"] = analysis.extracted_domain
        if analysis.extracted_color_prompt:
            session.collected["color_prompt"] = analysis.extracted_color_prompt
        if analysis.extracted_tagline and not session.collected.get("tagline"):
            session.collected["tagline"] = analysis.extracted_tagline
        if analysis.extracted_layout_archetype and not session.collected.get("layout_archetype"):
            session.collected["layout_archetype"] = analysis.extracted_layout_archetype
            mapped = LAYOUT_ARCHETYPE_MAP.get(analysis.extracted_layout_archetype, {"navbar_layout": "apple_minimal", "footer_layout": "apple_minimal"})
            session.collected["navbar_layout"] = mapped["navbar_layout"]
            session.collected["footer_layout"] = mapped["footer_layout"]
            session.collected["navbar_position"] = "fixed"
        if analysis.extracted_surface_materiality and not session.collected.get("surface_materiality"):
            session.collected["surface_materiality"] = analysis.extracted_surface_materiality

        reply_text = analysis.assistant_reply
    except Exception as e:
        print("Error in conversation agent analyzer_chain:", e)
        analysis = None
        reply_text = f"That sounds great, {session.admin_name}! What brand name or store style do you have in mind?"

    # 8. Handle UI Attachments (Palettes -> Layout Archetypes -> Surface Materiality)
    turn_palettes = None
    turn_choices = None

    has_brand = bool(session.collected.get("brand_name"))
    has_domain = bool(session.collected.get("domain"))
    has_chosen_palette = bool(session.collected.get("chosen_palette"))
    has_layout = bool(session.collected.get("layout_archetype"))
    has_materiality = bool(session.collected.get("surface_materiality"))

    color_mentioned = bool(session.collected.get("color_prompt")) or bool(hex_matches)
    should_refresh_palettes = analysis.user_requested_palette_refresh if analysis else False
    color_keywords = ["color", "palette", "theme", "vibe", "style", "different", "more", "premium", "dark", "light", "neon", "pastel", "racing", "luxury", "fresh", "gold", "blue", "red", "green"]
    user_prompted_for_colors = any(k in reply_lower for k in color_keywords)

    # Palettes should ONLY be shown if user talked about colors, brand+domain are ready, or palettes were already generated
    should_show_palettes = not has_chosen_palette and (
        color_mentioned or (has_brand and has_domain) or user_prompted_for_colors or should_refresh_palettes or bool(session.palette_options)
    )

    if should_show_palettes:
        current_prompt = session.collected.get("color_prompt") or (reply_lower if user_prompted_for_colors else "modern aesthetic")
        needs_generation = should_refresh_palettes or user_prompted_for_colors or not session.palette_options

        if needs_generation and (color_mentioned or (has_brand and has_domain) or user_prompted_for_colors or should_refresh_palettes):
            try:
                color_desc = f"{current_prompt} (User reply: {user_reply or ''})"
                palettes = await generate_color_palettes(
                    brand_name=session.collected.get("brand_name", "Brand"),
                    domain=session.collected.get("domain", "general"),
                    color_description=color_desc,
                    session_id=session_id,
                )
                if palettes:
                    session.palette_options = palettes
            except Exception as pe:
                print("Error generating palettes:", pe)

        turn_palettes = session.palette_options

    # STAGE: Layout Archetypes (Shown once Palette is Chosen)
    elif has_chosen_palette and not has_layout:
        turn_choices = [
            *LAYOUT_ARCHETYPE_CHOICES,
            BUILD_NOW_CHOICE,
        ]

    # STAGE: Surface Materiality (Shown once Layout Archetype is Chosen)
    elif has_chosen_palette and has_layout and not has_materiality:
        turn_choices = [
            *SURFACE_MATERIALITY_CHOICES,
            BUILD_NOW_CHOICE,
        ]

    # 9. Check Completion Criteria
    has_brand = bool(session.collected.get("brand_name"))
    has_domain = bool(session.collected.get("domain"))
    has_chosen_palette = bool(session.collected.get("chosen_palette"))
    has_layout = bool(session.collected.get("layout_archetype"))
    has_materiality = bool(session.collected.get("surface_materiality"))

    is_fully_collected = bool(
        has_brand and has_domain and has_chosen_palette and has_layout and has_materiality
    )
    
    # Only allow immediate build if user explicitly commanded a skip/build_now AND we have at least 1 turn of context
    explicit_build_allowed = (user_requested_build or (analysis and analysis.user_requested_immediate_build)) and (
        (has_brand or has_domain) or user_explicit_skip or (len(session.turns) >= 3)
    )

    should_build = is_fully_collected or session.is_complete or explicit_build_allowed

    if should_build:
        if not session.collected.get("brand_name"):
            session.collected["brand_name"] = f"{session.admin_name}'s Store"
        if not session.collected.get("domain"):
            session.collected["domain"] = "clothing"
        if not session.collected.get("layout_archetype"):
            session.collected["layout_archetype"] = "apple_minimal"
            session.collected["navbar_layout"] = "apple_minimal"
            session.collected["footer_layout"] = "apple_minimal"
            session.collected["navbar_position"] = "fixed"
        if not session.collected.get("surface_materiality"):
            session.collected["surface_materiality"] = "solid"
        session.phase = "completed"
        session.is_complete = True

    session.turns.append({
        "sender": "assistant",
        "text": reply_text,
        "type": "palette_choice" if turn_palettes else ("choice" if turn_choices else "text"),
        "palettes": turn_palettes,
        "palette_options": turn_palettes,
        "choices": turn_choices,
        "phase": session.phase,
        "is_complete": session.is_complete,
        "collected": session.collected,
    })

    return session


async def start_session_stream(initial_prompt: str, admin_name: str = "Creator", admin_email: Optional[str] = None):
    session_id = f"sess-{uuid.uuid4().hex[:10]}"
    
    session = ConversationSession(
        session_id=session_id,
        admin_name=admin_name,
        admin_email=admin_email,
        turns=[{"sender": "user", "text": initial_prompt}],
        collected={},
        phase="analyzing"
    )
    
    SESSIONS[session_id] = session
    async for event in advance_session_stream(session_id, user_reply=None):
        yield event


async def reply_session_stream(session_id: str, user_reply: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
        
    session.turns.append({"sender": "user", "text": user_reply})
    async for event in advance_session_stream(session_id, user_reply=user_reply):
        yield event


async def advance_session_stream(session_id: str, user_reply: Optional[str] = None):
    session = SESSIONS.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    # Sliding-window memory: Keep turn 0 + last 8 turns
    if len(session.turns) > 9:
        windowed_turns = [session.turns[0]] + session.turns[-8:]
    else:
        windowed_turns = session.turns

    history_str = "\n".join([f"{t['sender']}: {t['text']}" for t in windowed_turns])
    reply_lower = (user_reply or "").strip().lower()

    # 1. Direct matching for Explicit Build Triggers ONLY (Buttons / Skip Setup)
    explicit_build_triggers = [
        "build_now",
        "⚡ build store immediately",
        "build now with defaults",
        "generate with defaults now",
        "skip setup and build immediately",
        "skip and build now",
    ]
    user_explicit_skip = any(kw in reply_lower for kw in [
        "skip questions", "use defaults", "pick for me", "you decide", "surprise me", "auto generate everything"
    ])
    user_requested_build = (reply_lower in explicit_build_triggers) or user_explicit_skip

    # 2. Direct Matching for Custom Hex Codes (Generate 5 Palettes Centered on Hex)
    hex_matches = re.findall(r'#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b', user_reply) if user_reply else []
    if hex_matches:
        primary_hex = hex_matches[0]
        brand_name = session.collected.get("brand_name") or "Brand"
        palettes = generate_palettes_from_hex(primary_hex, brand_name=brand_name)
        session.palette_options = palettes
        session.collected["color_prompt"] = f"Custom Hex Base: {primary_hex}"
        session.collected.pop("chosen_palette", None)
        session.collected.pop("color_theme", None)

    # 3. Direct matching for Interactive Palette Selection
    if user_reply and session.palette_options and not session.collected.get("chosen_palette"):
        for i, pal in enumerate(session.palette_options):
            if (pal.get("id", "").lower() == reply_lower or 
                f"option {i+1}" in reply_lower or 
                str(i+1) == reply_lower or 
                pal.get("name", "").lower() in reply_lower):
                session.collected["chosen_palette"] = pal
                session.collected["color_theme"] = pal["name"]
                break

    # 4. Direct matching for Layout Archetype Selection
    if user_reply and not session.collected.get("layout_archetype"):
        for arch in LAYOUT_ARCHETYPE_CHOICES:
            arch_id = arch["id"].lower()
            arch_label = arch["label"].lower()
            if arch_id == reply_lower or arch_id in reply_lower or arch_label == reply_lower or arch_label in reply_lower:
                session.collected["layout_archetype"] = arch["id"]
                mapped = LAYOUT_ARCHETYPE_MAP.get(arch["id"], {"navbar_layout": "apple_minimal", "footer_layout": "apple_minimal"})
                session.collected["navbar_layout"] = mapped["navbar_layout"]
                session.collected["footer_layout"] = mapped["footer_layout"]
                session.collected["navbar_position"] = "fixed"
                break

    # 5. Direct matching for Surface Materiality Selection
    if user_reply and session.collected.get("layout_archetype") and not session.collected.get("surface_materiality"):
        for mat in SURFACE_MATERIALITY_CHOICES:
            mat_id = mat["id"].lower()
            mat_label = mat["label"].lower()
            if mat_id == reply_lower or mat_id in reply_lower or mat_label == reply_lower or mat_label in reply_lower:
                session.collected["surface_materiality"] = mat["id"]
                break

    # 6. Build Dynamic Checklist for the LLM
    checklist_lines = [
        f"- Brand Name: {'✅ ' + str(session.collected.get('brand_name')) if session.collected.get('brand_name') else '❌ Not yet'}",
        f"- Business Domain: {'✅ ' + str(session.collected.get('domain')) if session.collected.get('domain') else '❌ Not yet'}",
        f"- Color Palette: {'✅ ' + str(session.collected.get('color_theme') or 'Selected') if session.collected.get('chosen_palette') else '❌ Not yet'}",
        f"- Layout Archetype: {'✅ ' + str(session.collected.get('layout_archetype')) if session.collected.get('layout_archetype') else '❌ Not yet'}",
        f"- Surface Materiality: {'✅ ' + str(session.collected.get('surface_materiality')) if session.collected.get('surface_materiality') else '❌ Not yet'}",
    ]
    dynamic_checklist = "\n".join(checklist_lines)

    # 7. Run LLM Agent Analysis
    try:
        from agents.token_tracker import TokenCostCallback
        analysis: AgentAnalysis = await analyzer_chain.ainvoke(
            {
                "history": history_str,
                "collected": str(session.collected),
                "admin_name": session.admin_name,
                "checklist": dynamic_checklist,
            },
            config={"callbacks": [TokenCostCallback("Onboarding.Analyzer", session_id=session_id)]}
        )

        if analysis.extracted_brand_name and not session.collected.get("brand_name"):
            session.collected["brand_name"] = analysis.extracted_brand_name
        if analysis.extracted_domain and not session.collected.get("domain"):
            session.collected["domain"] = analysis.extracted_domain
        if analysis.extracted_color_prompt:
            session.collected["color_prompt"] = analysis.extracted_color_prompt
        if analysis.extracted_tagline and not session.collected.get("tagline"):
            session.collected["tagline"] = analysis.extracted_tagline
        if analysis.extracted_layout_archetype and not session.collected.get("layout_archetype"):
            session.collected["layout_archetype"] = analysis.extracted_layout_archetype
            mapped = LAYOUT_ARCHETYPE_MAP.get(analysis.extracted_layout_archetype, {"navbar_layout": "apple_minimal", "footer_layout": "apple_minimal"})
            session.collected["navbar_layout"] = mapped["navbar_layout"]
            session.collected["footer_layout"] = mapped["footer_layout"]
            session.collected["navbar_position"] = "fixed"
        if analysis.extracted_surface_materiality and not session.collected.get("surface_materiality"):
            session.collected["surface_materiality"] = analysis.extracted_surface_materiality

        reply_text = analysis.assistant_reply
    except Exception as e:
        print("Error in conversation agent analyzer_chain:", e)
        analysis = None
        reply_text = f"That sounds great, {session.admin_name}! What brand name or store style do you have in mind?"

    # Stream tokens word-by-word with natural cadence
    words = reply_text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield {"type": "token", "content": chunk}
        await asyncio.sleep(0.015)

    # 8. Handle UI Attachments (Palettes -> Layout Archetypes -> Surface Materiality)
    turn_palettes = None
    turn_choices = None

    has_brand = bool(session.collected.get("brand_name"))
    has_domain = bool(session.collected.get("domain"))
    has_chosen_palette = bool(session.collected.get("chosen_palette"))
    has_layout = bool(session.collected.get("layout_archetype"))
    has_materiality = bool(session.collected.get("surface_materiality"))

    color_mentioned = bool(session.collected.get("color_prompt")) or bool(hex_matches)
    should_refresh_palettes = analysis.user_requested_palette_refresh if analysis else False
    color_keywords = ["color", "palette", "theme", "vibe", "style", "different", "more", "premium", "dark", "light", "neon", "pastel", "racing", "luxury", "fresh", "gold", "blue", "red", "green"]
    user_prompted_for_colors = any(k in reply_lower for k in color_keywords)

    # Palettes should ONLY be shown if user talked about colors, brand+domain are ready, or palettes were already generated
    should_show_palettes = not has_chosen_palette and (
        color_mentioned or (has_brand and has_domain) or user_prompted_for_colors or should_refresh_palettes or bool(session.palette_options)
    )

    if should_show_palettes:
        current_prompt = session.collected.get("color_prompt") or (reply_lower if user_prompted_for_colors else "modern aesthetic")
        needs_generation = should_refresh_palettes or user_prompted_for_colors or not session.palette_options

        if needs_generation and (color_mentioned or (has_brand and has_domain) or user_prompted_for_colors or should_refresh_palettes):
            try:
                color_desc = f"{current_prompt} (User reply: {user_reply or ''})"
                palettes = await generate_color_palettes(
                    brand_name=session.collected.get("brand_name", "Brand"),
                    domain=session.collected.get("domain", "general"),
                    color_description=color_desc,
                    session_id=session_id,
                )
                if palettes:
                    session.palette_options = palettes
            except Exception as pe:
                print("Error generating palettes:", pe)

        turn_palettes = session.palette_options

    elif has_chosen_palette and not has_layout:
        turn_choices = [
            *LAYOUT_ARCHETYPE_CHOICES,
            BUILD_NOW_CHOICE,
        ]

    elif has_chosen_palette and has_layout and not has_materiality:
        turn_choices = [
            *SURFACE_MATERIALITY_CHOICES,
            BUILD_NOW_CHOICE,
        ]

    # 9. Check Completion Criteria
    is_fully_collected = bool(
        has_brand and has_domain and has_chosen_palette and has_layout and has_materiality
    )
    
    # Only allow immediate build if user explicitly commanded a skip/build_now AND we have at least 1 turn of context
    explicit_build_allowed = (user_requested_build or (analysis and analysis.user_requested_immediate_build)) and (
        (has_brand or has_domain) or user_explicit_skip or (len(session.turns) >= 3)
    )

    should_build = is_fully_collected or session.is_complete or explicit_build_allowed

    if should_build:
        if not session.collected.get("brand_name"):
            session.collected["brand_name"] = f"{session.admin_name}'s Store"
        if not session.collected.get("domain"):
            session.collected["domain"] = "clothing"
        if not session.collected.get("layout_archetype"):
            session.collected["layout_archetype"] = "apple_minimal"
            session.collected["navbar_layout"] = "apple_minimal"
            session.collected["footer_layout"] = "apple_minimal"
            session.collected["navbar_position"] = "fixed"
        if not session.collected.get("surface_materiality"):
            session.collected["surface_materiality"] = "solid"
        session.phase = "completed"
        session.is_complete = True

    turn_data = {
        "sender": "assistant",
        "text": reply_text,
        "type": "palette_choice" if turn_palettes else ("choice" if turn_choices else "text"),
        "palettes": turn_palettes,
        "palette_options": turn_palettes,
        "choices": turn_choices,
        "phase": session.phase,
        "is_complete": session.is_complete,
        "collected": session.collected,
    }
    session.turns.append(turn_data)

    yield {
        "type": "done",
        "session_id": session.session_id,
        "text": reply_text,
        "palette_options": turn_palettes,
        "palettes": turn_palettes,
        "choices": turn_choices,
        "phase": session.phase,
        "is_complete": session.is_complete,
        "collected": session.collected,
        "turns": session.turns,
    }
