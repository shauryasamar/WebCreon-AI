"""
Webcreon AI - Store Co-Pilot LangGraph Orchestrator
Master router using LangGraph StateGraph to coordinate specialized sub-agents.
"""

import json
from decimal import Decimal
from typing import Dict, Any, List, Optional, TypedDict
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END

from agents.color_design_agent import handle_color_and_design_request
from agents.db_analytics_agent import (
    get_store_metrics_for_period,
    is_data_deletion_attempt,
)
from agents.seo_health_agent import audit_store_health, check_low_stock_inventory
from agents.copilot_knowledge import search_knowledge_base
from agents.response_synthesizer import synthesize_agent_response, stream_synthesize_agent_response

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0, request_timeout=20, max_retries=2)


class SubTask(BaseModel):
    intent: str = Field(description="Sub-intent: 'DESIGN', 'DB_QUERY', 'MUTATION', 'SEO_HEALTH', 'KNOWLEDGE', 'CHAT'")
    target_component: Optional[str] = Field(default=None, description="Target component name")
    task_instruction: str = Field(description="Instruction for this sub-task")
    color_descriptors: List[str] = Field(default_factory=list)
    days_filter: Optional[int] = None
    status_filter: Optional[str] = None
    target_order_id: Optional[str] = None
    new_order_status: Optional[str] = None
    wants_palette_suggestions: bool = False


class IntentAnalysis(BaseModel):
    is_compound: bool = Field(default=False, description="True if 2+ distinct operations requested across different domains")
    tasks: List[SubTask] = Field(default_factory=list, description="Chronological list of sub-tasks if compound")
    intent: str = Field(description="Core intent: 'DESIGN', 'DB_QUERY', 'MUTATION', 'SEO_HEALTH', 'KNOWLEDGE', 'CHAT', 'COMPOUND'")
    is_visual_change_requested: bool = Field(default=False, description="True if modifying visual styling, colors, or themes")
    sentiment_tone: Optional[str] = Field(default=None, description="Inferred sentiment or tone")
    user_intent_summary: Optional[str] = Field(default=None, description="1-sentence semantic summary of request")
    intent_confidence: float = Field(default=1.0, description="Confidence score 0.0-1.0")
    target_scope: str = Field(default="component", description="'component', 'page', or 'global'")
    target_component: Optional[str] = Field(default=None, description="Target component: 'navbar', 'footer', 'hero', 'product_grid', 'product_carousel', 'section_group_carousel', 'category_grid', 'card', 'product_detail', 'cart', 'order_summary', 'delivery_form', 'payment', 'place_order', 'filter', 'sort', 'pagination', 'order_history', 'support', 'notification', 'profile', 'background', 'banner_create', 'revert', 'overall', or 'unsupported'")
    design_element: Optional[str] = Field(default=None, description="Attribute to modify: 'background', 'cards', 'text', 'button', 'border', 'banner', 'all'")
    color_descriptors: List[str] = Field(default_factory=list, description="Extracted color names")
    days_filter: Optional[int] = Field(default=None, description="Days filter (1=today, 7=week, 30=month)")
    status_filter: Optional[str] = Field(default=None, description="Order status filter e.g. 'placed', 'accepted', 'shipped', 'delivered'")
    target_order_id: Optional[str] = Field(default=None, description="Order ID or prefix if updating")
    new_order_status: Optional[str] = Field(default=None, description="New status to set")
    wants_palette_suggestions: bool = Field(default=False, description="True if requesting theme/palette suggestions")
    reasoning: Optional[str] = Field(default=None, description="Brief explanation")


class CoPilotGraphState(TypedDict):
    user_message: str
    site_id: str
    actor_id: Optional[str]
    actor_name: Optional[str]
    actor_email: Optional[str]
    actor_role: Optional[str]
    site_definition: Dict[str, Any]
    previous_draft_definition: Optional[Dict[str, Any]]
    snapshot_history: Optional[List[Dict[str, Any]]]
    history_str: str
    intent: str
    is_compound: bool
    compound_tasks: List[Dict[str, Any]]
    target_scope: Optional[str]
    target_component: Optional[str]
    design_element: Optional[str]
    color_descriptors: List[str]
    days_filter: Optional[int]
    status_filter: Optional[str]
    target_order_id: Optional[str]
    new_order_status: Optional[str]
    wants_palette_suggestions: bool
    user_intent_summary: Optional[str]
    active_agent: str
    agent_payload: Dict[str, Any]
    final_output: Dict[str, Any]


# Node 1: Router Node (Two-Tier Semantic Intent Classification & Compound Decomposition)
async def router_node(state: CoPilotGraphState) -> Dict[str, Any]:
    user_msg = state["user_message"]
    # 1. Safety Guardrail & SQL Injection Probe check
    user_msg_clean = user_msg.lower().strip()
    is_sql_injection_probe = any(
        inj in user_msg_clean
        for inj in [
            "union select", "union all select", "1=1", "; drop", "; delete", "; truncate",
            "pg_shadow", "pg_user", "information_schema", "pg_sleep", "drop table", "truncate table",
            "'hacked'", "\"hacked\""
        ]
    )
    if is_data_deletion_attempt(user_msg) or is_sql_injection_probe:
        return {
            "intent": "GUARDRAIL",
            "active_agent": "Safety Guardrail",
            "is_compound": False,
            "compound_tasks": [],
        }

    # 1B. Pure Revert / Undo check (ONLY if message is solely a short revert command without extra actions)
    user_msg_clean = user_msg.lower().strip()
    words = [w.strip(".,;:!?+-") for w in user_msg_clean.split() if w.strip(".,;:!?+-")]

    revert_triggers = [
        "undo", "revert", "restore previous", "go back", "take back", 
        "revert back", "revert changes", "undo change", "can you revert", 
        "revert it", "undo it", "rollback", "roll back", "put it back",
        "change it back", "bring back the old", "bring back previous",
        "discard changes", "cancel that change", "restore older version",
        "make it like before", "how it was before"
    ]

    non_pure_indicators = [
        "and", "ad", "then", "also", "plus", "add", "create", "show", "what", "list",
        "change", "make", "set", "turn", "paint", "color", "colour", "background", "bg",
        "red", "blue", "green", "yellow", "black", "white", "pink", "purple", "orange",
        "navbar", "header", "footer", "hero", "page", "card", "button", "theme",
        "orders", "sales", "products", "banner", "support", "ticket", "table", "details"
    ]

    has_clause_delimiters = any(punct in user_msg for punct in [",", ";", "+", "&"])
    has_non_pure_words = any(w in non_pure_indicators for w in words)
    has_revert_keyword = any(t in user_msg_clean for t in revert_triggers)

    is_pure_revert = (
        has_revert_keyword
        and not has_clause_delimiters
        and not has_non_pure_words
        and len(words) <= 5
    )
    if is_pure_revert:
        return {
            "intent": "DESIGN",
            "is_compound": False,
            "compound_tasks": [],
            "target_component": "revert",
            "active_agent": "Color & Design Agent (Revert)",
        }

    # 1C. Palette / Theme Suggestion fast-path check (ONLY for explicit suggestion requests, never for styling commands)
    is_styling_command = any(
        w in user_msg_clean for w in [
            "change", "make", "set", "turn", "apply", "switch", "update", "style", "replace", "put", "use",
            "filter", "navbar", "nav", "carousel", "crowsel", "crowsels", "card", "cards", "hero", "banner",
            "footer", "notification", "dropdown", "button", "grid", "cart", "sidebar"
        ]
    )

    palette_suggestion_triggers = [
        "theme suggestion", "themes suggestion", "suggest theme", "suggest themes",
        "give me theme", "give me themes", "give me some theme", "give me some themes",
        "give me color theme", "give me color themes", "give me few theme", "give me few themes",
        "give me few thmese", "give me some thmese", "few thmese", "some thmese", "give me thmese",
        "recommend theme", "recommend themes", "palette suggestion", "palette suggestions",
        "suggest palette", "suggest palettes", "give me palettes", "give me palette",
        "show palettes", "show themes", "what themes", "color ideas", "theme ideas",
        "color palette", "colour palette", "color palettes", "colour palettes",
        "best theme for", "theme options", "palette options"
    ]
    if not is_styling_command and any(t in user_msg_clean for t in palette_suggestion_triggers) and not any(a in user_msg_clean for a in ["how to", "where is", "help with", "explain how", "documentation"]):
        return {
            "intent": "DESIGN",
            "is_compound": False,
            "compound_tasks": [],
            "target_component": "overall",
            "wants_palette_suggestions": True,
            "active_agent": "Color & Design Agent (Palettes)",
        }

    # 2. Semantic Intent Router with Deep Sentiment, Context, & 100% Storefront Component Coverage
    router_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are WebCreon AI's Store Co-Pilot Master Intent Router & Task Planner.
Classify the user's semantic intent, conversational context, and target component with high accuracy.

CORE INTENTS:
- 'DESIGN': Modifying visual appearance, styling, colors, backgrounds, borders, shadows, themes, banners, or revert/undo.
- 'DB_QUERY': Business questions, sales, revenue, orders, top products, customers, stock/inventory metrics.
- 'MUTATION': Explicit updates to database records (e.g. set order status to shipped/accepted). Never classify styling as MUTATION.
- 'SEO_HEALTH': Store health audits, inventory checks, catalog completeness.
- 'KNOWLEDGE': Questions on platform usage and documentation.
- 'CHAT': Greetings and general chit-chat.
- 'COMPOUND': User asks for 2+ distinct operations across different domains (e.g. "revert last change and show today's sales"). Break into sub-tasks in `tasks`.

TARGET COMPONENTS (100% COVERAGE):
navbar (top bar/header), footer (bottom bar/copyright), hero (top banner/slides styling, button colors, backgrounds, text), product_grid (catalog grid), product_carousel (product slider), section_group_carousel (category story carousel), category_grid (category boxes/tiles), card (product boxes/cards/item titles/prices), product_detail (item page), cart (cart drawer/bag), order_summary, delivery_form, payment, place_order, filter, sort, pagination, order_history, support, notification, profile, background (page canvas), banner_create (ONLY when adding/creating a NEW promotional banner slide), revert, overall (store-wide).

RULES:
1. 'hero' vs 'banner_create': If user asks to change, recolor, style, or adjust banner buttons/background/text, use 'hero'. ONLY use 'banner_create' when the user explicitly asks to add/create a NEW banner slide!
2. Multi-target carousel/section styling: use 'multi:comp1,comp2' (e.g. 'multi:product_carousel,section_group_carousel').
3. Pronoun & follow-up resolution: If user says "make it black" or "change it", check Conversation History for the previously discussed component.
4. Single analytical questions asking for multiple metrics (e.g. "what are new orders and their stock") are a single 'DB_QUERY', NOT compound."""),
        ("user", "User Message: {user_message}\nConversation History: {history_str}"),
    ])

    try:
        from agents.token_tracker import TokenCostCallback
        structured_llm = router_prompt | llm.with_structured_output(IntentAnalysis, method="function_calling")
        res: IntentAnalysis = await structured_llm.ainvoke(
            {
                "user_message": user_msg,
                "history_str": state.get("history_str", ""),
            },
            config={"callbacks": [TokenCostCallback("Copilot.Router", session_id=state.get("site_id"))]}
        )

        raw_intent = (res.intent or "CHAT").upper().strip()
        target_comp = res.target_component.lower().strip() if res.target_component else None

        # Format compound tasks list if compound
        compound_tasks = [t.model_dump() for t in res.tasks] if res.is_compound and res.tasks else []

        # Check for conversational pronoun follow-ups
        history_str = state.get("history_str", "")
        words = user_msg_clean.split()
        is_pronoun_followup = any(w in words for w in ["it", "them", "that", "this", "those"]) or user_msg_clean.startswith("make it") or user_msg_clean.startswith("turn it")
        
        # If target was unresolved or generic 'overall', but history has a clear previous design component
        if (not target_comp or target_comp == "overall") and is_pronoun_followup and history_str:
            hist_lower = history_str.lower()
            for comp_candidate in ["section_group_carousel", "product_carousel", "category_grid", "product_grid", "navbar", "footer", "hero", "cart", "card", "filter"]:
                if comp_candidate in hist_lower or comp_candidate.replace("_", " ") in hist_lower:
                    if "carousel" in hist_lower and ("section" in hist_lower or "group" in hist_lower) and "product" in hist_lower:
                        target_comp = "multi:product_carousel,section_group_carousel"
                    else:
                        target_comp = comp_candidate
                    break

        # Disambiguate MUTATION misclassifications:
        # If router flagged MUTATION but the prompt is actually styling a storefront component and has no DB write signals
        storefront_styling_signals = [
            "color", "colour", "background", "border", "borders", "radius", "padding", "shadow", "frosted", "glass",
            "carousel", "grid", "card", "cards", "navbar", "footer", "hero", "cream", "violet", "peach"
        ]
        has_styling_signal = any(w in user_msg_clean for w in storefront_styling_signals)
        db_write_signals = [
            "accept order", "cancel order", "delete order", "create coupon", "delete coupon", "update stock", "set stock",
            "out of stock", "set price to", "change price to", "refund", "return status", "deactivate coupon", "activate coupon"
        ]
        has_db_write = any(w in user_msg_clean for w in db_write_signals)

        if raw_intent in ("MUTATION", "GUARDRAIL", "CHAT") and (res.is_visual_change_requested or has_styling_signal) and not has_db_write:
            raw_intent = "DESIGN"
            if not target_comp:
                target_comp = "overall"

        # Correct sub-tasks inside compound requests as well
        if compound_tasks:
            for t in compound_tasks:
                t_instr = str(t.get("task_instruction", "")).lower()
                if any(w in t_instr for w in storefront_styling_signals) and not any(w in t_instr for w in db_write_signals):
                    if t.get("intent") in ("MUTATION", "GUARDRAIL", "CHAT", "KNOWLEDGE", "DB_QUERY"):
                        t["intent"] = "DESIGN"

            if all(t.get("intent") in ("MUTATION", "GUARDRAIL") for t in compound_tasks):
                raw_intent = "MUTATION"
                compound_tasks = []
            elif any(t.get("intent") == "DESIGN" for t in compound_tasks) and len(compound_tasks) > 1:
                raw_intent = "COMPOUND"
            elif len(compound_tasks) == 1 and compound_tasks[0].get("intent") == "DESIGN":
                raw_intent = "DESIGN"
                target_comp = compound_tasks[0].get("target_component") or target_comp
                compound_tasks = []

        return {
            "intent": raw_intent,
            "is_compound": bool(raw_intent == "COMPOUND" and compound_tasks),
            "compound_tasks": compound_tasks,
            "target_scope": res.target_scope,
            "target_component": target_comp,
            "design_element": res.design_element,
            "color_descriptors": res.color_descriptors,
            "days_filter": res.days_filter,
            "status_filter": res.status_filter,
            "target_order_id": res.target_order_id,
            "new_order_status": res.new_order_status,
            "wants_palette_suggestions": res.wants_palette_suggestions,
            "user_intent_summary": res.user_intent_summary,
            "active_agent": f"{raw_intent} Agent",
        }
    except Exception as e:
        print("Router node error:", e)
        return {"intent": "CHAT", "active_agent": "General Chat Agent", "is_compound": False, "compound_tasks": []}



# Node 2: Color & Design Agent Node
async def color_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    user_msg = state["user_message"]
    intent_summary = state.get("user_intent_summary")
    words = user_msg.lower().split()
    if intent_summary and any(w in words for w in ["it", "them", "that", "this", "those"]):
        effective_msg = f"{user_msg}. ({intent_summary})"
    else:
        effective_msg = user_msg

    res = await handle_color_and_design_request(
        user_message=effective_msg,
        site_definition=state["site_definition"],
        target_component=state.get("target_component"),
        wants_palette_suggestions=state.get("wants_palette_suggestions", False),
        session_id=state.get("site_id"),
        history_str=state.get("history_str"),
    )
    return {"agent_payload": res, "active_agent": "Color & Design Agent"}


def deduplicate_data_cards(cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicates data cards by type, title, and structure signature."""
    if not cards:
        return []
    seen = set()
    unique_cards = []
    seen_table_cards: List[Dict[str, Any]] = []

    for c in cards:
        if not isinstance(c, dict):
            continue
        c_type = c.get("type", "")
        if c_type == "table_card":
            c_rows = c.get("rows", [])
            c_cols = set(str(k).lower().strip() for k in c.get("columns", []))
            is_dup_table = False
            for prev_idx, prev_card in enumerate(seen_table_cards):
                prev_cols = set(str(k).lower().strip() for k in prev_card.get("columns", []))
                col_overlap = len(c_cols.intersection(prev_cols))
                if col_overlap >= 2 or (len(c_rows) > 0 and len(c_rows) == len(prev_card.get("rows", []))):
                    is_dup_table = True
                    if len(c.get("columns", [])) > len(prev_card.get("columns", [])):
                        unique_cards[unique_cards.index(prev_card)] = c
                        seen_table_cards[prev_idx] = c
                    break
            if is_dup_table:
                continue
            seen_table_cards.append(c)
            unique_cards.append(c)
        elif c_type in ("palette_suggestions_card", "component_palette_suggestions_card"):
            pal_names = tuple(p.get("name", "") for p in c.get("palettes", []))
            sig = (c_type, pal_names)
            if sig not in seen:
                seen.add(sig)
                unique_cards.append(c)
        else:
            sig = (c_type, str(c.get("title", "")).strip().lower())
            if sig not in seen:
                seen.add(sig)
                unique_cards.append(c)
    return unique_cards


# Node 3: DB & Analytics Agent Node
async def db_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    user_msg = state["user_message"]
    msg_lower = user_msg.lower()
    site_id = state["site_id"]
    intent = state["intent"]
    actor_id = state.get("actor_id")
    actor_name = state.get("actor_name")
    actor_email = state.get("actor_email")
    actor_role = state.get("actor_role")

    # 0. Strict Read-Only Guardrail for DB Operations
    write_triggers = [
        "accept order", "accept orders", "accept all", "accept these", "accept those", "accept placed", "accept new",
        "cancel order", "cancel orders", "cancel all", "cancel these", "cancel those", "bulk cancel", "bulk accept",
        "mark as", "mark order", "update order", "set status", "change status", "confirm order", "confirm accept", "confirm cancel",
        "create coupon", "create promo", "new coupon", "new promo", "add coupon", "add promo", "make coupon", "make promo",
        "deactivate coupon", "activate coupon", "disable coupon", "enable coupon", "disable promo", "enable promo", "delete coupon",
        "set stock", "update stock", "change stock", "increase stock", "decrease stock", "out of stock", "set price", "change price", "update price",
        "deactivate product", "activate product", "hide product", "unhide product",
        "approve return", "reject return", "receive return", "inspect return", "refund return", "close return"
    ]

    is_write_attempt = (
        intent == "MUTATION"
        or any(w in msg_lower for w in write_triggers)
        or any(w in msg_lower for w in ["stock to", "price to", "varint stock to", "variant stock to", "varient stock to", "quantity to", "qty to"])
        or (("coupon" in msg_lower or "promo code" in msg_lower or "discount code" in msg_lower) and any(w in msg_lower for w in ["create", "add", "make", "generate", "set up", "insert", "delete", "remove", "deactivate", "activate"]) and not any(w in msg_lower for w in ["banner", "hero", "slide", "how many", "list", "show", "active", "what"]))
    )

    is_read_query = (
        any(w in msg_lower for w in ["what are", "what is", "how many", "list", "show", "tell me", "display", "check", "find", "search", "get", "details", "breakdown", "analysis", "revenue", "sales", "metrics", "count"])
        and not any(w in msg_lower for w in ["set", "change to", "update to", "mark as", "stock to", "price to", "accept", "cancel", "delete"])
    )
    if is_read_query or any(w in msg_lower for w in ["theme", "palette", "color theme", "colour theme", "color palette", "colour palette"]):
        if not any(w in msg_lower for w in ["order", "coupon", "promo", "inventory", "stock", "refund", "return", "product status"]):
            is_write_attempt = False

    if is_write_attempt:
        return {
            "agent_payload": {
                "read_only_restriction": True,
                "attempted_action": user_msg,
                "data_cards": [],
            },
            "active_agent": "DB & Analytics Agent (Read-Only)",
        }

    # Extract days filter from message if router didn't catch it
    days_filter = state.get("days_filter")
    if days_filter is None:
        if "10 days" in msg_lower or "ten days" in msg_lower:
            days_filter = 10
        elif "2 days" in msg_lower or "two days" in msg_lower:
            days_filter = 2
        elif "7 days" in msg_lower or "week" in msg_lower:
            days_filter = 7
        elif "today" in msg_lower:
            days_filter = 1
        elif "month" in msg_lower:
            days_filter = 30

    from uuid import UUID
    site_uuid = UUID(site_id) if site_id else None
    from agents.db_analytics_agent import engine
    from sqlmodel import Session
    from agents.sql_agent_engine import run_dynamic_store_query

    with Session(engine) as db:
        metrics = get_store_metrics_for_period(
            db,
            site_uuid,
            days_filter=days_filter,
            status_filter=state.get("status_filter"),
            site_definition=state.get("site_definition"),
        )

    # Run Dynamic Safe Text-to-SQL for analytical & custom queries
    dynamic_sql_res = {}
    if site_id:
        try:
            dynamic_sql_res = await run_dynamic_store_query(
                user_query=user_msg,
                site_id=site_id,
                history_str=state.get("history_str", ""),
                site_definition=state.get("site_definition"),
            )
        except Exception as e:
            print("Copilot dynamic SQL error:", e)

    data_cards = []
    has_table_card = False

    # 1. Dynamic Table Card from SQL execution if multi-row tabular data returned
    if dynamic_sql_res.get("success") and dynamic_sql_res.get("rows"):
        rows = dynamic_sql_res.get("rows", [])
        cols = dynamic_sql_res.get("columns", [])
        # Only render a table card if it's actual tabular list data (not a 1-row summary scalar like total orders / stock count)
        is_summary_scalar = len(rows) == 1 and (len(cols) <= 2 or all(isinstance(v, (int, float)) for v in rows[0].values()))
        if not is_summary_scalar and len(rows) > 0:
            data_cards.append({
                "type": "table_card",
                "title": dynamic_sql_res.get("title") or "Database Query Results",
                "columns": cols,
                "rows": rows,
                "row_count": len(rows),
            })
            has_table_card = True
    
    # 2. Generate UI data cards based on query focus ONLY if no table card is active
    if not has_table_card:
        if any(w in msg_lower for w in ["returned", "return", "refund"]):
            returns_list = [
                {
                    "id": str(r.id)[:8],
                    "order_id": str(r.order_id)[:8] if getattr(r, "order_id", None) else "N/A",
                    "status": str(r.status or "requested").capitalize(),
                    "refund_status": str(r.refund_status or "pending").capitalize(),
                    "reason": r.request_note or r.admin_note or r.rejection_reason or "Customer return request",
                    "amount": float(r.final_refund_amount or r.suggested_refund_amount or 0),
                }
                for r in metrics.get("returns", [])[:12]
            ]
            if returns_list:
                data_cards.append({
                    "type": "returns_card",
                    "title": f"Return & Refund Requests ({metrics['total_returns_count']})",
                    "returns": returns_list,
                })
        elif any(w in msg_lower for w in ["show orders", "list orders", "recent orders", "view orders", "orders list", "unfulfilled orders", "order history", "track orders", "all orders"]) and not any(w in msg_lower for w in ["stock", "inventory", "available", "variant", "how many", "count", "items in"]):
            all_raw_orders = metrics.get("all_orders") or []
            if any(w in msg_lower for w in ["new", "placed", "unfulfilled"]):
                # Strictly placed orders (matches admin dashboard New Orders tab)
                orders_source = [o for o in all_raw_orders if str(getattr(o, "status", "")).lower() == "placed"]
                orders_title = f"New Placed Orders ({len(orders_source)})"
            elif any(w in msg_lower for w in ["accepted", "confirmed", "yet to ship"]):
                orders_source = [o for o in all_raw_orders if str(getattr(o, "status", "")).lower() in ("accepted", "confirmed")]
                orders_title = f"Confirmed Orders ({len(orders_source)})"
            elif any(w in msg_lower for w in ["shipped", "in transit", "yet to deliver", "out for delivery"]):
                orders_source = [o for o in all_raw_orders if str(getattr(o, "status", "")).lower() in ("shipped", "in_transit", "out_for_delivery")]
                orders_title = f"Shipped Orders ({len(orders_source)})"
            elif any(w in msg_lower for w in ["delivered"]):
                orders_source = [o for o in all_raw_orders if str(getattr(o, "status", "")).lower() == "delivered"]
                orders_title = f"Delivered Orders ({len(orders_source)})"
            elif any(w in msg_lower for w in ["cancelled", "canceled", "refunded"]):
                orders_source = [o for o in all_raw_orders if str(getattr(o, "status", "")).lower() in ("cancelled", "refunded")]
                orders_title = f"Cancelled Orders ({len(orders_source)})"
            elif "pending" in msg_lower:
                orders_source = [o for o in all_raw_orders if str(getattr(o, "status", "")).lower() == "pending"]
                orders_title = f"Pending Draft Orders ({len(orders_source)})"
            else:
                orders_source = metrics.get("filtered_orders") or all_raw_orders
                orders_title = f"Recent Orders ({len(orders_source)})"

            orders_list = [
                {
                    "id": str(o.id)[:8],
                    "items_summary": ", ".join([f"{it.get('quantity', 1)}x {it.get('product_name', it.get('name', 'Item'))}" for it in o.items if isinstance(it, dict)]) if isinstance(o.items, list) else "Order Item",
                    "total": float(o.total or 0),
                    "status": str(o.status or "placed").capitalize(),
                    "date": o.created_at.strftime("%b %d, %I:%M %p") if getattr(o, "created_at", None) else "",
                }
                for o in orders_source[:15]
            ]
            if orders_list:
                data_cards.append({
                    "type": "orders_card",
                    "title": orders_title,
                    "orders": orders_list,
                })
        elif any(w in msg_lower for w in ["sales overview", "revenue summary", "store performance", "sales analytics"]) and not any(w in msg_lower for w in ["stock", "inventory", "variant", "product", "how many", "items in"]):
            data_cards.append({
                "type": "analytics_card",
                "title": f"Store Sales Analytics ({metrics['time_label']})",
                "metrics": {
                    "total_sales": f"₹{metrics['period_sales']:,.2f}",
                    "orders_count": metrics["period_orders_count"],
                    "average_rating": metrics["avg_rating"],
                    "cancellation_rate": metrics["cancel_rate"],
                },
            })

    return {
        "agent_payload": {
            "metrics": metrics,
            "dynamic_query_result": dynamic_sql_res,
            "data_cards": deduplicate_data_cards(data_cards),
            "days_filter": days_filter,
        },
        "active_agent": "DB & Analytics Agent",
    }


# Node 4: SEO & Store Health Agent Node
async def seo_health_node(state: CoPilotGraphState) -> Dict[str, Any]:
    msg_lower = state["user_message"].lower()
    site_id = state["site_id"]
    
    if any(w in msg_lower for w in ["low stock", "restock", "inventory"]):
        low_stock_prods = check_low_stock_inventory(site_id)
        return {
            "agent_payload": {
                "low_stock_products": low_stock_prods,
                "data_cards": [{
                    "type": "inventory_alert_card",
                    "title": f"Low Stock Items ({len(low_stock_prods)})",
                    "products": low_stock_prods,
                }] if low_stock_prods else [],
            },
            "active_agent": "SEO & Store Health Agent",
        }

    audit_res = audit_store_health(site_id, state["site_definition"])
    return {
        "agent_payload": {
            "audit": audit_res,
            "data_cards": [{
                "type": "store_audit_card",
                "title": "Store Health Audit Report",
                "audit": audit_res,
            }],
        },
        "active_agent": "SEO & Store Health Agent",
    }


# Node 5: Knowledge Base Agent Node
async def knowledge_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    guidance_text = search_knowledge_base(state["user_message"])
    return {
        "agent_payload": {"guidance": guidance_text},
        "active_agent": "Knowledge Base Agent",
    }


# Node 6: General Chat Agent Node
async def chat_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    return {
        "agent_payload": {"is_general_chat": True},
        "active_agent": "General Chat Agent",
    }


# Node 7: Compound Multi-Task Orchestrator Node
async def compound_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    tasks = state.get("compound_tasks") or []
    import copy
    current_def = copy.deepcopy(state.get("site_definition") or {})
    all_data_cards = []
    has_subsequent_design = False
    has_revert_task = False
    compound_action_summaries = []
    compound_patch = {}
    last_dynamic_sql = None
    last_metrics = None

    for task in tasks:
        t_intent = str(task.get("intent") or "CHAT").upper()
        instruction = task.get("task_instruction") or state["user_message"]
        t_comp = task.get("target_component")
        inst_lower = instruction.lower()

        if t_intent == "DESIGN":
            if t_comp == "revert" or any(w in inst_lower for w in ["revert", "undo", "take back"]):
                has_revert_task = True
                prev_from_state = state.get("previous_draft_definition")
                if not prev_from_state and state.get("snapshot_history") and len(state.get("snapshot_history", [])) > 0:
                    prev_from_state = state["snapshot_history"][-1]

                if prev_from_state:
                    current_def = copy.deepcopy(prev_from_state)
                else:
                    site_id_str = state.get("site_id")
                    if site_id_str:
                        try:
                            from services.site_revision_service import undo_site_revision
                            from sqlmodel import Session
                            from db.database import engine
                            from uuid import UUID
                            with Session(engine) as db_sess:
                                ok, new_v, prev_def, err = undo_site_revision(
                                    session=db_sess,
                                    site_id=site_id_str,
                                    actor_id=UUID(site_id_str) if site_id_str else UUID(int=0),
                                )
                                if ok and prev_def:
                                    current_def = copy.deepcopy(prev_def)
                        except Exception as e:
                            print("Compound revert error:", e)
                
                compound_action_summaries.append("Reverted storefront design to previous snapshot")
                continue

            res = await handle_color_and_design_request(
                user_message=instruction,
                site_definition=current_def,
                target_component=t_comp,
                wants_palette_suggestions=task.get("wants_palette_suggestions", False),
                session_id=state.get("site_id"),
                history_str=state.get("history_str"),
            )
            if res.get("design_modified") and res.get("next_draft_definition"):
                has_subsequent_design = True
                current_def = res["next_draft_definition"]
                if res.get("applied_patch"):
                    compound_patch.update(res["applied_patch"])
            if res.get("design_modified"):
                compound_action_summaries.append(f"Applied design updates to {t_comp or 'storefront'}")
            if res.get("data_cards"):
                all_data_cards.extend(res["data_cards"])

        elif t_intent == "MUTATION":
            compound_action_summaries.append(f"Database write operations ('{instruction}') cannot be performed directly via chat; please make these updates in your Admin Dashboard")

        elif t_intent == "DB_QUERY":
            from uuid import UUID
            site_uuid = UUID(state["site_id"]) if state.get("site_id") else None
            from sqlmodel import Session
            from agents.db_analytics_agent import engine, get_store_metrics_for_period
            from agents.sql_agent_engine import run_dynamic_store_query

            with Session(engine) as db:
                metrics = get_store_metrics_for_period(
                    db,
                    site_uuid,
                    days_filter=task.get("days_filter"),
                    status_filter=task.get("status_filter"),
                    site_definition=current_def,
                )
            last_metrics = metrics
            dynamic_sql_res = {}
            try:
                dynamic_sql_res = await run_dynamic_store_query(
                    user_query=instruction,
                    site_id=state.get("site_id", ""),
                    history_str=state.get("history_str", ""),
                    site_definition=current_def,
                )
            except Exception:
                pass
            if dynamic_sql_res.get("success") and dynamic_sql_res.get("rows"):
                last_dynamic_sql = dynamic_sql_res
                rows = dynamic_sql_res.get("rows", [])
                cols = dynamic_sql_res.get("columns", [])
                is_summary_scalar = len(rows) == 1 and (len(cols) <= 2 or all(isinstance(v, (int, float)) for v in rows[0].values()))
                if not is_summary_scalar and len(rows) > 0:
                    all_data_cards.append({
                        "type": "table_card",
                        "title": dynamic_sql_res.get("title") or "Database Query Results",
                        "columns": cols,
                        "rows": rows,
                        "row_count": len(rows),
                    })
            elif any(w in inst_lower for w in ["sales", "revenue", "performance", "analytics"]) and metrics:
                all_data_cards.append({
                    "type": "analytics_card",
                    "title": f"Store Sales Analytics ({metrics.get('time_label', 'Period')})",
                    "metrics": {
                        "total_sales": f"₹{metrics.get('period_sales', 0.0):,.2f}",
                        "orders_count": metrics.get("period_orders_count", 0),
                        "average_rating": metrics.get("avg_rating", "N/A"),
                        "cancellation_rate": metrics.get("cancel_rate", "0%"),
                    },
                })
            compound_action_summaries.append("Queried store database records")

        elif t_intent == "SEO_HEALTH":
            audit_res = audit_store_health(state.get("site_id", ""), current_def)
            all_data_cards.append({
                "type": "store_audit_card",
                "title": "Store Health Audit Report",
                "audit": audit_res,
            })
            compound_action_summaries.append("Completed store health audit")

    return {
        "agent_payload": {
            "compound_execution": True,
            "compound_action_summaries": compound_action_summaries,
            "design_modified": has_subsequent_design or has_revert_task,
            "has_reverted_base": bool(has_revert_task and has_subsequent_design),
            "action": "revert_snapshot" if (has_revert_task and not has_subsequent_design) else None,
            "next_draft_definition": current_def if (has_subsequent_design or has_revert_task) else None,
            "applied_patch": compound_patch,
            "data_cards": deduplicate_data_cards(all_data_cards),
            "dynamic_query_result": last_dynamic_sql if last_dynamic_sql else None,
            "metrics": last_metrics if last_metrics else None,
        },
        "active_agent": "Compound Multi-Action Orchestrator",
    }


# Node 8: Guardrail Node
async def guardrail_node(state: CoPilotGraphState) -> Dict[str, Any]:
    return {
        "agent_payload": {"is_guardrail": True},
        "active_agent": "Safety Guardrail",
    }


# Node 9: Synthesizer Node
async def synthesizer_node(state: CoPilotGraphState) -> Dict[str, Any]:
    agent_payload = state.get("agent_payload", {})
    if "site_definition" not in agent_payload and state.get("site_definition"):
        agent_payload["site_definition"] = state.get("site_definition")
    res = await synthesize_agent_response(
        user_message=state["user_message"],
        active_agent=state.get("active_agent", "Co-Pilot Agent"),
        agent_payload=agent_payload,
        history_str=state.get("history_str", ""),
    )
    return {"final_output": res}


# Conditional Edge Router Function
def route_intent(state: CoPilotGraphState) -> str:
    intent = state.get("intent", "CHAT")
    if intent == "GUARDRAIL":
        return "guardrail_node"
    elif intent == "COMPOUND":
        return "compound_agent_node"
    elif intent == "DESIGN":
        return "color_agent_node"
    elif intent in ["DB_QUERY", "MUTATION"]:
        return "db_agent_node"
    elif intent == "SEO_HEALTH":
        return "seo_health_node"
    elif intent == "KNOWLEDGE":
        return "knowledge_agent_node"
    else:
        return "chat_agent_node"


# Build LangGraph StateGraph Workflow
workflow = StateGraph(CoPilotGraphState)

workflow.add_node("router_node", router_node)
workflow.add_node("compound_agent_node", compound_agent_node)
workflow.add_node("color_agent_node", color_agent_node)
workflow.add_node("db_agent_node", db_agent_node)
workflow.add_node("seo_health_node", seo_health_node)
workflow.add_node("knowledge_agent_node", knowledge_agent_node)
workflow.add_node("chat_agent_node", chat_agent_node)
workflow.add_node("guardrail_node", guardrail_node)
workflow.add_node("synthesizer_node", synthesizer_node)

workflow.set_entry_point("router_node")

workflow.add_conditional_edges(
    "router_node",
    route_intent,
    {
        "guardrail_node": "guardrail_node",
        "compound_agent_node": "compound_agent_node",
        "color_agent_node": "color_agent_node",
        "db_agent_node": "db_agent_node",
        "seo_health_node": "seo_health_node",
        "knowledge_agent_node": "knowledge_agent_node",
        "chat_agent_node": "chat_agent_node",
    }
)

workflow.add_edge("compound_agent_node", "synthesizer_node")
workflow.add_edge("color_agent_node", "synthesizer_node")
workflow.add_edge("db_agent_node", "synthesizer_node")
workflow.add_edge("seo_health_node", "synthesizer_node")
workflow.add_edge("knowledge_agent_node", "synthesizer_node")
workflow.add_edge("chat_agent_node", "synthesizer_node")
workflow.add_edge("guardrail_node", "synthesizer_node")

workflow.add_edge("synthesizer_node", END)

copilot_langgraph_app = workflow.compile()


# Pre-synthesis workflow for streaming execution
pre_workflow = StateGraph(CoPilotGraphState)
pre_workflow.add_node("router_node", router_node)
pre_workflow.add_node("compound_agent_node", compound_agent_node)
pre_workflow.add_node("color_agent_node", color_agent_node)
pre_workflow.add_node("db_agent_node", db_agent_node)
pre_workflow.add_node("seo_health_node", seo_health_node)
pre_workflow.add_node("knowledge_agent_node", knowledge_agent_node)
pre_workflow.add_node("chat_agent_node", chat_agent_node)
pre_workflow.add_node("guardrail_node", guardrail_node)

pre_workflow.set_entry_point("router_node")
pre_workflow.add_conditional_edges(
    "router_node",
    route_intent,
    {
        "guardrail_node": "guardrail_node",
        "compound_agent_node": "compound_agent_node",
        "color_agent_node": "color_agent_node",
        "db_agent_node": "db_agent_node",
        "seo_health_node": "seo_health_node",
        "knowledge_agent_node": "knowledge_agent_node",
        "chat_agent_node": "chat_agent_node",
    }
)
pre_workflow.add_edge("compound_agent_node", END)
pre_workflow.add_edge("color_agent_node", END)
pre_workflow.add_edge("db_agent_node", END)
pre_workflow.add_edge("seo_health_node", END)
pre_workflow.add_edge("knowledge_agent_node", END)
pre_workflow.add_edge("chat_agent_node", END)
pre_workflow.add_edge("guardrail_node", END)

copilot_pre_synthesis_app = pre_workflow.compile()

