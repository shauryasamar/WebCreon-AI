import uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

from agents.color_agent import generate_color_palettes


class ConversationSession(BaseModel):
    session_id: str
    admin_name: str = "Creator"
    admin_email: Optional[str] = None
    turns: List[Dict[str, Any]] = Field(default_factory=list)
    collected: Dict[str, Any] = Field(default_factory=dict)
    phase: str = "initial"
    palette_options: List[Dict[str, Any]] = Field(default_factory=list)
    is_complete: bool = False


# In-memory store for multi-turn sessions
SESSIONS: Dict[str, ConversationSession] = {}


class AgentAnalysis(BaseModel):
    extracted_brand_name: Optional[str] = Field(
        default=None, 
        description="Brand or store name extracted from conversation if mentioned, chosen, or specified by user. Do NOT set if user is asking for name suggestions."
    )
    extracted_domain: Optional[str] = Field(
        default=None, 
        description="Business domain or product category (e.g. electronics, fashion/apparel, beauty/cosmetics, grocery, books, jewelry, furniture)."
    )
    extracted_color_prompt: Optional[str] = Field(
        default=None, 
        description="Color theme or aesthetic vibe mentioned by user (e.g. pink luxury, dark mode, obsidian blue, pastel bakery)."
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
        description="Set to True if the user asks for brand/store name ideas, recommendations, or suggestions."
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
        description="Friendly, creative, and highly responsive conversational reply to send to the user. Answer any question they asked (e.g. provide creative store names if requested), confirm choices made, and naturally ask for any remaining missing details."
    )
    is_sufficient_for_build: bool = Field(
        default=False, 
        description="Set to True ONLY if all required details (brand_name, domain, color palette/theme, navbar style, footer style) are gathered OR user requested immediate build."
    )


llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0.5)

analyzer_system = """You are WebNirmaan AI's intelligent e-commerce store design assistant.
Your goal is to converse naturally, creatively, and responsively with the store owner ({admin_name}) to gather requirements for generating their custom e-commerce website.

Store parameters to collect:
1. brand_name: Store/Brand name (e.g., ElectroVault, VelvetGlow)
2. domain: Product domain (e.g., Electronics, Fashion, Beauty, Grocery, Books, Jewelry, etc.)
3. color_prompt / chosen_palette: Color theme or aesthetic vibe
4. navbar_position: Navbar scroll behavior ('fixed', 'sticky', 'static')
5. navbar_layout: Navbar layout ('apple_minimal', 'glassmorphism_premium', 'modern_marketplace', 'luxury_fashion', 'neo_modern')
6. footer_layout: Footer layout ('apple_minimal', 'glassmorphism_premium', 'modern_marketplace', 'luxury_fashion', 'neo_modern')

CRITICAL INSTRUCTIONS FOR RESPONSIVENESS:
- NEVER repeat a hardcoded greeting if the user asks a question or gives an answer.
- If the user asks for store name suggestions (e.g. "suggest me a few names", "help me pick a name for an electronics store"), offer 4-5 creative, catchy brand names directly in your assistant_reply! Do NOT set `extracted_brand_name` until the user actually selects or specifies a name.
- If the user provides a store name (e.g., "WebShop", "Let's call it ElectroVault"), set `extracted_brand_name` = "WebShop" / "ElectroVault".
- Be helpful, enthusiastic, and conversational! Keep responses concise and engaging.
- If the prompt has full detail or user says "build it", set `user_requested_immediate_build` = True.
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
        if analysis.extracted_color_prompt and not session.collected.get("color_prompt"):
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
        reply_text = f"That sounds great, {session.admin_name}! Tell me more about your vision or preferences for the store."

    # 3. Handle Color Palette Generation
    should_refresh_palettes = analysis.user_requested_palette_refresh if analysis else False
    has_color_info = bool(session.collected.get("color_prompt") or session.collected.get("domain") or session.collected.get("brand_name"))
    
    if (should_refresh_palettes or (has_color_info and not session.collected.get("chosen_palette") and not session.palette_options)):
        try:
            color_desc = session.collected.get("color_prompt") or reply_lower or "modern aesthetic"
            palettes = await generate_color_palettes(
                brand_name=session.collected.get("brand_name", "Brand"),
                domain=session.collected.get("domain", "general"),
                color_description=color_desc,
                target_audience="general",
                brand_tone="modern"
            )
            session.palette_options = palettes
        except Exception as pe:
            print("Error generating palettes:", pe)

    # 4. Check for Interactive UI Attachment (Palette cards or Choice chips)
    turn_palettes = None
    turn_choices = None

    if session.palette_options and not session.collected.get("chosen_palette"):
        turn_palettes = session.palette_options
    elif session.collected.get("brand_name") and session.collected.get("chosen_palette"):
        if not session.collected.get("navbar_position"):
            turn_choices = NAVBAR_POSITION_CHOICES
        elif not session.collected.get("navbar_layout"):
            turn_choices = NAVBAR_LAYOUT_CHOICES
        elif not session.collected.get("footer_layout"):
            turn_choices = FOOTER_LAYOUT_CHOICES

    # 5. Check Completion Criteria
    is_fully_collected = bool(
        session.collected.get("brand_name") and
        session.collected.get("domain") and
        session.collected.get("chosen_palette") and
        session.collected.get("navbar_position") and
        session.collected.get("navbar_layout") and
        session.collected.get("footer_layout")
    )
    
    is_immediate = analysis.user_requested_immediate_build if analysis else False
    is_sufficient = analysis.is_sufficient_for_build if analysis else False

    if is_fully_collected or is_immediate or is_sufficient:
        session.is_complete = True
        session.phase = "complete"
        brand_str = session.collected.get("brand_name", "your store")
        session.turns.append({
            "sender": "assistant",
            "text": f"{reply_text}\n\nAll preferences collected. Generating **{brand_str}** website now...",
            "type": "generating_animation"
        })
        return session

    # 6. Append Standard Assistant Turn
    turn_dict: Dict[str, Any] = {
        "sender": "assistant",
        "text": reply_text
    }
    if turn_palettes:
        turn_dict["type"] = "palette_choice"
        turn_dict["palette_options"] = turn_palettes
    elif turn_choices:
        turn_dict["choices"] = turn_choices

    session.turns.append(turn_dict)
    return session
