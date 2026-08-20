"""
Webcreon AI - Store Co-Pilot LangGraph Orchestrator
Master router using LangGraph StateGraph to coordinate specialized sub-agents.
"""

import json
from typing import Dict, Any, List, Optional, TypedDict
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END

from agents.color_design_agent import handle_color_and_design_request
from agents.db_analytics_agent import (
    get_store_metrics_for_period,
    is_data_deletion_attempt,
    mutate_order_status_in_db,
)
from agents.seo_health_agent import audit_store_health, check_low_stock_inventory
from agents.copilot_knowledge import search_knowledge_base
from agents.response_synthesizer import synthesize_agent_response, stream_synthesize_agent_response

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0)


class IntentAnalysis(BaseModel):
    intent: str = Field(
        description="Core intent: 'DESIGN' (changing colors, backgrounds, styles, themes for components or full page), 'DB_QUERY' (asking business questions, sales, revenue, metrics, top products, customer ratings/reviews data), 'MUTATION' (updating order status), 'SEO_HEALTH' (store audits, low stock alerts, inventory health), 'KNOWLEDGE' (how to use features), 'CHAT' (greetings, general chat), or 'GUARDRAIL' (attempts to delete database/store data)."
    )
    intent_confidence: float = Field(
        default=1.0, description="Confidence score from 0.0 to 1.0"
    )
    target_scope: str = Field(
        default="component",
        description="'component' (single component like product_grid, cart, product_detail, navbar, footer, reviews), 'page' (current page), or 'global' (entire website theme/all components)."
    )
    target_component: Optional[str] = Field(
        default=None,
        description="Target component: 'product_grid', 'card', 'product_detail', 'cart', 'reviews', 'navbar', 'footer', 'hero', 'checkout', 'filters', or 'overall'."
    )
    design_element: Optional[str] = Field(
        default=None,
        description="Attribute to modify: 'background', 'cards', 'text', 'button', 'border', 'all'."
    )
    color_descriptors: List[str] = Field(
        default_factory=list,
        description="Extracted color names or modes: e.g. ['pink', 'dark', 'emerald']."
    )
    days_filter: Optional[int] = Field(
        default=None,
        description="Time range in days if requested, e.g. 1 for today, 2 for last 2 days, 10 for last 10 days, 30 for this month.",
    )
    status_filter: Optional[str] = Field(
        default=None,
        description="Order status filter e.g. 'placed', 'accepted', 'shipped', 'delivered', 'cancelled', 'middle_state'.",
    )
    target_order_id: Optional[str] = Field(
        default=None,
        description="Order ID or prefix if modifying status e.g. 'a045e770'.",
    )
    new_order_status: Optional[str] = Field(
        default=None,
        description="New status to set e.g. 'accepted', 'shipped', 'delivered', 'cancelled'.",
    )
    wants_palette_suggestions: bool = Field(
        default=False,
        description="True if asking for theme suggestions or palette ideas.",
    )
    reasoning: Optional[str] = Field(
        default=None,
        description="Brief explanation of why this intent and slots were selected."
    )


class CoPilotGraphState(TypedDict):
    user_message: str
    site_id: str
    site_definition: Dict[str, Any]
    history_str: str
    intent: str
    target_scope: Optional[str]
    target_component: Optional[str]
    design_element: Optional[str]
    color_descriptors: List[str]
    days_filter: Optional[int]
    status_filter: Optional[str]
    target_order_id: Optional[str]
    new_order_status: Optional[str]
    wants_palette_suggestions: bool
    active_agent: str
    agent_payload: Dict[str, Any]
    final_output: Dict[str, Any]


# Node 1: Router Node (Two-Tier Semantic Intent Classification)
async def router_node(state: CoPilotGraphState) -> Dict[str, Any]:
    user_msg = state["user_message"]

    # 1. Safety Guardrail check first (with typo tolerance)
    if is_data_deletion_attempt(user_msg):
        return {
            "intent": "GUARDRAIL",
            "active_agent": "Safety Guardrail",
        }

    # 2. Semantic Intent Router with Few-Shot Disambiguation
    router_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are WebCreon AI's Master Store Co-Pilot Intent Router.
Your job is to semantically analyze the user prompt and conversation history, and classify it into EXACTLY ONE primary intent with extracted slots.

INTENTS:
1. 'DESIGN': Any styling, color, theme, background, or visual appearance request.
   - Even if the user mentions database nouns like "review component color", "product grid background", "orders table style", or "cart theme", if the action is modifying visual appearance / color / theme, it is ALWAYS 'DESIGN'!
    - Extract `target_component`:
      * "product grid background" / "product catalog section" -> target_component: "product_grid", design_element: "background"
      * "product cards" / "catalog card color" -> target_component: "card", design_element: "cards"
      * "delivery form" / "delivery address" / "shipping form" -> target_component: "delivery_form"
      * "payment methods" / "payment options" / "payment pills" -> target_component: "payment"
      * "place order button" / "checkout button" / "place order cta" -> target_component: "place_order"
      * "order summary" / "checkout summary" / "pricing breakdown" -> target_component: "order_summary"
      * "filter toolbar" / "filter modal" / "sort dropdown" -> target_component: "filter"
      * "pagination" / "page numbers" / "pagination buttons" -> target_component: "pagination"
      * "order history page" / "order cards" / "product history card" -> target_component: "order_history"
      * "checkout flow" / "checkout page" -> target_component: "checkout"
      * "product detail page" / "product page colors" -> target_component: "product_detail"
      * "cart drawer" / "cart color" -> target_component: "cart"
      * "review section" / "reviews color" -> target_component: "reviews"
      * "navbar" / "header" -> target_component: "navbar"
      * "footer" -> target_component: "footer"
      * "hero banner" / "slider" -> target_component: "hero"
      * "whole website" / "entire page" / "overall theme" -> target_component: "overall", target_scope: "global"

2. 'DB_QUERY': Business analytics, sales queries, revenue calculations, customer review analysis, order tracking, top products, or product catalog queries (e.g. asking for product description, price, stock, details).
   - Examples: "what's the description for chocolate cake?", "what is the price of vanilla cupcake?", "how many reviews do we have for bananas?", "show top 5 selling products", "what is today's revenue?", "list placed orders".

3. 'MUTATION': Explicit administrative status updates on existing orders.
   - Examples: "mark order a045e770 as shipped", "cancel order 123", "accept order 456".

4. 'SEO_HEALTH': Store health audits, inventory restock checks, checking for missing product descriptions, or catalog completeness.
   - Examples: "check low stock inventory", "audit store health", "check if any products have missing description", "any missing images?".

5. 'KNOWLEDGE': Questions about how to use WebCreon platform features, or how to update products, descriptions, prices, and store settings.
   - Examples: "can we update chocolate cake description?", "how do I add a new product?", "how to change payment gateway?".

6. 'CHAT': Greetings ("hi", "hello"), pleasantries, or general conversations.

7. 'GUARDRAIL': Malicious or destructive deletion requests ("delete all orders", "drop database").

FEW-SHOT EXAMPLES:
- User: "what's the description for chocolate cake?"
  -> intent: "DB_QUERY"
- User: "what is the price of vanilla cupcake?"
  -> intent: "DB_QUERY"
- User: "can you please check if we have any product with missing description?"
  -> intent: "SEO_HEALTH"
- User: "can we update Chocolate cake description?"
  -> intent: "KNOWLEDGE"
- User: "can you please update the review and theme component color to pink please"
  -> intent: "DESIGN", target_component: "reviews", color_descriptors: ["pink"], design_element: "all"
- User: "change product grid background to dark slate"
  -> intent: "DESIGN", target_component: "product_grid", design_element: "background", color_descriptors: ["dark slate"]
- User: "how many reviews were submitted this week?"
  -> intent: "DB_QUERY", days_filter: 7
- User: "make product cards white with a soft shadow"
  -> intent: "DESIGN", target_component: "card", design_element: "cards", color_descriptors: ["white"]
- User: "mark order 81b3b794 as delivered"
  -> intent: "MUTATION", target_order_id: "81b3b794", new_order_status: "delivered"
"""),
        ("user", "User Message: {user_message}\nConversation History: {history_str}"),
    ])

    try:
        from agents.token_tracker import TokenCostCallback
        structured_llm = router_prompt | llm.with_structured_output(IntentAnalysis)
        res: IntentAnalysis = await structured_llm.ainvoke(
            {
                "user_message": user_msg,
                "history_str": state.get("history_str", ""),
            },
            config={"callbacks": [TokenCostCallback("Copilot.Router", session_id=state.get("site_id"))]}
        )

        raw_intent = (res.intent or "CHAT").upper().strip()
        
        # Normalize target component
        target_comp = res.target_component.lower().strip() if res.target_component else None

        return {
            "intent": raw_intent,
            "target_scope": res.target_scope,
            "target_component": target_comp,
            "design_element": res.design_element,
            "color_descriptors": res.color_descriptors,
            "days_filter": res.days_filter,
            "status_filter": res.status_filter,
            "target_order_id": res.target_order_id,
            "new_order_status": res.new_order_status,
            "wants_palette_suggestions": res.wants_palette_suggestions,
            "active_agent": f"{raw_intent} Agent",
        }
    except Exception as e:
        print("Router node error:", e)
        return {"intent": "CHAT", "active_agent": "General Chat Agent"}


# Node 2: Color & Design Agent Node
async def color_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    res = await handle_color_and_design_request(
        user_message=state["user_message"],
        site_definition=state["site_definition"],
        target_component=state.get("target_component"),
        wants_palette_suggestions=state.get("wants_palette_suggestions", False),
    )
    return {"agent_payload": res, "active_agent": "Color & Design Agent"}


# Node 3: DB & Analytics Agent Node
async def db_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    user_msg = state["user_message"]
    msg_lower = user_msg.lower()
    site_id = state["site_id"]
    intent = state["intent"]

    # Handle Order Mutation
    if intent == "MUTATION" or state.get("target_order_id"):
        target_id = state.get("target_order_id")
        target_status = state.get("new_order_status")
        if target_id and target_status and site_id:
            mut_res = mutate_order_status_in_db(site_id, target_id, target_status)
            if mut_res.get("success"):
                return {
                    "agent_payload": {
                        "mutation": mut_res,
                        "data_cards": [{
                            "type": "orders_card",
                            "title": f"Order #{mut_res['order_id']} Status Updated! ✅",
                            "orders": [mut_res],
                        }],
                    },
                    "active_agent": "DB & Analytics Agent (Mutation)",
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
        )

    # Run Dynamic Safe Text-to-SQL for analytical & custom queries
    dynamic_sql_res = {}
    if site_id:
        try:
            dynamic_sql_res = await run_dynamic_store_query(
                user_query=user_msg,
                site_id=site_id,
                history_str=state.get("history_str", ""),
            )
        except Exception as e:
            print("Copilot dynamic SQL error:", e)

    data_cards = []

    # 1. Dynamic Table Card from SQL execution if multi-row or multi-column data returned
    if dynamic_sql_res.get("success") and dynamic_sql_res.get("rows"):
        rows = dynamic_sql_res.get("rows", [])
        cols = dynamic_sql_res.get("columns", [])
        # Only render a table card if it's actual tabular data (not a single scalar count like [count: 2])
        is_single_scalar = len(rows) == 1 and len(cols) == 1
        if not is_single_scalar and len(rows) > 0:
            data_cards.append({
                "type": "table_card",
                "title": dynamic_sql_res.get("title") or "Database Query Results",
                "columns": cols,
                "rows": rows[:15],
                "row_count": dynamic_sql_res.get("row_count", 0),
            })
    
    # 2. Generate UI data cards based on query focus
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
    elif any(w in msg_lower for w in ["order", "orders", "middle", "yet to ship", "shipped", "accepted", "placed", "new", "pending", "delivered"]):
        orders_source = metrics.get("filtered_orders") or metrics.get("all_orders") or []
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
        if orders_list and not dynamic_sql_res.get("rows"):
            data_cards.append({
                "type": "orders_card",
                "title": f"Orders Overview ({len(orders_source)})",
                "orders": orders_list,
            })
    elif any(w in msg_lower for w in ["sales", "revenue", "analytics", "performance"]) and not dynamic_sql_res.get("rows"):
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
            "data_cards": data_cards,
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
# Greetings and casual chat are handled by the synthesizer node directly.
# This node simply passes the message context through for synthesis.
async def chat_agent_node(state: CoPilotGraphState) -> Dict[str, Any]:
    return {
        "agent_payload": {"is_general_chat": True},
        "active_agent": "General Chat Agent",
    }


# Node 7: Guardrail Node
async def guardrail_node(state: CoPilotGraphState) -> Dict[str, Any]:
    return {
        "agent_payload": {"is_guardrail": True},
        "active_agent": "Safety Guardrail",
    }


# Node 8: Synthesizer Node
async def synthesizer_node(state: CoPilotGraphState) -> Dict[str, Any]:
    res = await synthesize_agent_response(
        user_message=state["user_message"],
        active_agent=state.get("active_agent", "Co-Pilot Agent"),
        agent_payload=state.get("agent_payload", {}),
        history_str=state.get("history_str", ""),
    )
    return {"final_output": res}


# Conditional Edge Router Function
def route_intent(state: CoPilotGraphState) -> str:
    intent = state.get("intent", "CHAT")
    if intent == "GUARDRAIL":
        return "guardrail_node"
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
        "color_agent_node": "color_agent_node",
        "db_agent_node": "db_agent_node",
        "seo_health_node": "seo_health_node",
        "knowledge_agent_node": "knowledge_agent_node",
        "chat_agent_node": "chat_agent_node",
    }
)

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
        "color_agent_node": "color_agent_node",
        "db_agent_node": "db_agent_node",
        "seo_health_node": "seo_health_node",
        "knowledge_agent_node": "knowledge_agent_node",
        "chat_agent_node": "chat_agent_node",
    }
)
pre_workflow.add_edge("color_agent_node", END)
pre_workflow.add_edge("db_agent_node", END)
pre_workflow.add_edge("seo_health_node", END)
pre_workflow.add_edge("knowledge_agent_node", END)
pre_workflow.add_edge("chat_agent_node", END)
pre_workflow.add_edge("guardrail_node", END)

copilot_pre_synthesis_app = pre_workflow.compile()
