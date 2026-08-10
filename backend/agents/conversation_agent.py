"""
WebNirmaan AI - Store Onboarding Conversation Agent
Manages multi-turn requirement gathering interview for new store creation.
Enforces strict step-by-step stage progression (Brand Name -> Color Palette -> Layout Options).
"""

import uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from agents.color_design_agent import generate_color_palettes


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


class AgentAnalysis(BaseModel):
    extracted_brand_name: Optional[str] = Field(
        default=None, 
        description="Brand or store name ONLY if explicitly chosen/specified by the user (e.g. 'ToyTrove', 'ElectroVault'). Leave null if user is asking for suggestions."
    )
    extracted_domain: Optional[str] = Field(
        default=None, 
        description="Business domain or product category (e.g. electronics, fashion/apparel, beauty, toy store, car toys)."
    )
    extracted_color_prompt: Optional[str] = Field(
        default=None, 
        description="Color theme or aesthetic vibe mentioned by user (e.g. pink luxury, dark mode, vibrant colorful, racing neon)."
    )
    extracted_tagline: Optional[str] = Field(
        default=None, 
        description="Tagline or slogan for the brand if specified or accepted by user."
    )
    extracted_navbar_position: Optional[str] = Field(
        default=None, 
        description="Navbar scroll behavior if specified: 'fixed', 'sticky', or 'static'."
    )
    extracted_navbar_layout: Optional[str] = Field(
        default=None, 
        description="Navbar design layout style: 'apple_minimal', 'glassmorphism_premium', 'modern_marketplace', 'luxury_fashion', or 'neo_modern'."
    )
    extracted_footer_layout: Optional[str] = Field(
        default=None, 
        description="Footer design layout style: 'apple_minimal', 'glassmorphism_premium', 'modern_marketplace', 'luxury_fashion', or 'neo_modern'."
    )
    
    user_requested_name_suggestions: bool = Field(
        default=False, 
        description="Set to True if the user asks for brand/store name ideas or suggestions."
    )
    user_requested_palette_refresh: bool = Field(
        default=False, 
        description="Set to True if the user wants different, more, or alternative color palette options."
    )
    user_requested_immediate_build: bool = Field(
        default=False, 
        description="Set to True if the user explicitly asks to build/generate the store immediately or says 'build it', 'ready', 'use defaults'."
    )
    
    assistant_reply: str = Field(
        description="Friendly, conversational assistant response strictly adhering to the current onboarding stage."
    )


llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

analyzer_system = """You are WebNirmaan AI's intelligent e-commerce store design assistant.
Your goal is to guide the store owner ({admin_name}) through a smooth, strict STEP-BY-STEP onboarding process.

STRICT STEP-BY-STEP STAGE PROGRESSION RULES:
- STEP 1 (Brand Name & Domain): Focus ONLY on domain and brand name.
  * If brand_name is NOT in collected data, help the user choose a brand name. Suggest 4-5 creative names if requested.
  * DO NOT ask about color themes, navbar, footer, or layout options in Step 1!
- STEP 2 (Color Palette & Vibe): Focus ONLY on color theme once brand_name IS in collected data.
  * Once brand_name is confirmed, present color palette options or ask about their preferred aesthetic.
  * Visual interactive color palette cards (with swatches) are automatically rendered on screen for the user in Step 2.
  * NEVER claim or tell the user that you cannot display images or cards! Encourage the user to select one of the color palette cards shown on screen.
  * DO NOT ask about navbar, footer, or layout options in Step 2!
- STEP 3 (Navbar & Footer Layout): Focus on layout options ONLY once chosen_palette IS in collected data.
  * Ask for navbar position, navbar layout, and footer layout one by one.

GENERAL RULES:
- NEVER repeat a hardcoded greeting if the user answers a question.
- Keep assistant_reply warm, professional, concise, and focused strictly on the CURRENT STEP.
"""

analyzer_prompt = ChatPromptTemplate.from_messages([
    ("system", analyzer_system),
    ("user", "Conversation History:\n{history}\n\nCurrently Collected Data:\n{collected}"),
])

analyzer_chain = analyzer_prompt | llm.with_structured_output(AgentAnalysis)


NAVBAR_POSITION_CHOICES = [
    {"id": "fixed", "label": "Fixed Position", "description": "Pins to top of viewport while scrolling"},
    {"id": "sticky", "label": "Sticky Scroll", "description": "Smoothly hides on scroll down, reappears on scroll up"},
    {"id": "static", "label": "Static Normal", "description": "Scrolls naturally with normal page content"}
]

NAVBAR_LAYOUT_CHOICES = [
    {"id": "apple_minimal", "label": "Apple / Vercel Minimal", "description": "Clean spacing, pill search, floating depth"},
    {"id": "glassmorphism_premium", "label": "Glassmorphism Premium", "description": "Frosted glass blur with subtle depth"},
    {"id": "modern_marketplace", "label": "Modern Marketplace", "description": "Compact Amazon/Shopify style with solid search"},
    {"id": "luxury_fashion", "label": "Luxury Fashion", "description": "Spacious typography with refined dividers"},
    {"id": "neo_modern", "label": "Neo Modern 2026", "description": "Soft neumorphic UI with rounded controls"}
]

FOOTER_LAYOUT_CHOICES = [
    {"id": "apple_minimal", "label": "Apple Minimal Footer", "description": "Multi-column link grid with copyright"},
    {"id": "glassmorphism_premium", "label": "Glassmorphism Footer", "description": "Frosted glass bottom bar with newsletter"},
    {"id": "modern_marketplace", "label": "Marketplace Footer", "description": "Newsletter, payment badges, help links"},
    {"id": "luxury_fashion", "label": "Luxury Serif Footer", "description": "Centered typography with brand mark"},
    {"id": "neo_modern", "label": "Neo Modern 2026 Footer", "description": "Soft depth with rounded pill newsletter"}
]


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
        
    history_str = "\n".join([f"{t['sender']}: {t['text']}" for t in session.turns])
    reply_lower = (user_reply or "").strip().lower()

    # 1. Direct matching for interactive UI selections (Palette clicks / Choice clicks)
    if user_reply and session.palette_options and not session.collected.get("chosen_palette"):
        for i, pal in enumerate(session.palette_options):
            if (pal.get("id", "").lower() == reply_lower or 
                f"option {i+1}" in reply_lower or 
                str(i+1) == reply_lower or 
                pal.get("name", "").lower() in reply_lower):
                session.collected["chosen_palette"] = pal
                session.collected["color_theme"] = pal["name"]
                break

    if user_reply and not session.collected.get("navbar_position"):
        for pos in ["fixed", "sticky", "static"]:
            if pos in reply_lower:
                session.collected["navbar_position"] = pos
                break

    if user_reply and not session.collected.get("navbar_layout"):
        if "apple" in reply_lower or "vercel" in reply_lower:
            session.collected["navbar_layout"] = "apple_minimal"
        elif "glass" in reply_lower:
            session.collected["navbar_layout"] = "glassmorphism_premium"
        elif "market" in reply_lower:
            session.collected["navbar_layout"] = "modern_marketplace"
        elif "luxury" in reply_lower:
            session.collected["navbar_layout"] = "luxury_fashion"
        elif "neo" in reply_lower:
            session.collected["navbar_layout"] = "neo_modern"

    if user_reply and not session.collected.get("footer_layout"):
        if "apple" in reply_lower or "vercel" in reply_lower:
            session.collected["footer_layout"] = "apple_minimal"
        elif "glass" in reply_lower:
            session.collected["footer_layout"] = "glassmorphism_premium"
        elif "market" in reply_lower:
            session.collected["footer_layout"] = "modern_marketplace"
        elif "luxury" in reply_lower:
            session.collected["footer_layout"] = "luxury_fashion"
        elif "neo" in reply_lower:
            session.collected["footer_layout"] = "neo_modern"

    # 2. Run LLM Agent Analysis
    try:
        analysis: AgentAnalysis = await analyzer_chain.ainvoke({
            "history": history_str,
            "collected": str(session.collected),
            "admin_name": session.admin_name
        })

        # Update collected dict with newly extracted parameters
        if analysis.extracted_brand_name and not session.collected.get("brand_name"):
            session.collected["brand_name"] = analysis.extracted_brand_name
        if analysis.extracted_domain and not session.collected.get("domain"):
            session.collected["domain"] = analysis.extracted_domain
        if analysis.extracted_color_prompt:
            session.collected["color_prompt"] = analysis.extracted_color_prompt
        if analysis.extracted_tagline and not session.collected.get("tagline"):
            session.collected["tagline"] = analysis.extracted_tagline
        if analysis.extracted_navbar_position and not session.collected.get("navbar_position"):
            session.collected["navbar_position"] = analysis.extracted_navbar_position
        if analysis.extracted_navbar_layout and not session.collected.get("navbar_layout"):
            session.collected["navbar_layout"] = analysis.extracted_navbar_layout
        if analysis.extracted_footer_layout and not session.collected.get("footer_layout"):
            session.collected["footer_layout"] = analysis.extracted_footer_layout

        reply_text = analysis.assistant_reply
    except Exception as e:
        print("Error in conversation agent analyzer_chain:", e)
        analysis = None
        reply_text = f"That sounds great, {session.admin_name}! Tell me more about your vision for the store."

    # 3. Handle Step-by-Step UI Attachment
    turn_palettes = None
    turn_choices = None

    has_brand = bool(session.collected.get("brand_name"))
    has_chosen_palette = bool(session.collected.get("chosen_palette"))

    # STAGE 2: ONLY generate and show palette cards AFTER brand_name is chosen!
    if has_brand and not has_chosen_palette:
        should_refresh_palettes = analysis.user_requested_palette_refresh if analysis else False
        color_keywords = ["color", "palette", "theme", "boy", "car", "kid", "toy", "vibe", "style", "different", "more", "premium", "dark", "light", "neon", "pastel", "racing", "luxury", "fresh"]
        user_prompted_for_colors = any(k in reply_lower for k in color_keywords)
        current_prompt = session.collected.get("color_prompt") or reply_lower

        if should_refresh_palettes or user_prompted_for_colors or not session.palette_options:
            try:
                color_desc = f"{current_prompt} (User reply: {user_reply or ''})"
                palettes = await generate_color_palettes(
                    brand_name=session.collected.get("brand_name", "Brand"),
                    domain=session.collected.get("domain", "general"),
                    color_description=color_desc,
                )
                if palettes:
                    session.palette_options = palettes
            except Exception as pe:
                print("Error generating palettes:", pe)

        turn_palettes = session.palette_options

    # STAGE 3: ONLY show navbar/footer choice chips AFTER palette is chosen!
    elif has_brand and has_chosen_palette:
        if not session.collected.get("navbar_position"):
            turn_choices = NAVBAR_POSITION_CHOICES
        elif not session.collected.get("navbar_layout"):
            turn_choices = NAVBAR_LAYOUT_CHOICES
        elif not session.collected.get("footer_layout"):
            turn_choices = FOOTER_LAYOUT_CHOICES

    # 4. Check Completion Criteria
    is_fully_collected = bool(
        session.collected.get("brand_name") and
        session.collected.get("domain") and
        session.collected.get("chosen_palette") and
        session.collected.get("navbar_position") and
        session.collected.get("navbar_layout") and
        session.collected.get("footer_layout")
    )
    
    should_build = is_fully_collected or (analysis and analysis.user_requested_immediate_build)

    if should_build:
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
