"""
WebNirmaan AI - Store Co-Pilot LangGraph Orchestrator
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
from agents.response_synthesizer import synthesize_agent_response

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0)


class IntentAnalysis(BaseModel):
    intent: str = Field(
        description="Core intent: 'DESIGN', 'DB_QUERY', 'MUTATION', 'SEO_HEALTH', 'KNOWLEDGE', 'CHAT', or 'GUARDRAIL'."
    )
    target_component: Optional[str] = Field(
        default=None,
        description="Target block/component, e.g. 'navbar', 'footer', 'hero', 'card', 'product_grid', 'overall'.",
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


class CoPilotGraphState(TypedDict):
    user_message: str
    site_id: str
    site_definition: Dict[str, Any]
    history_str: str
    intent: str
    target_component: Optional[str]
    days_filter: Optional[int]
    status_filter: Optional[str]
    target_order_id: Optional[str]
    new_order_status: Optional[str]
    wants_palette_suggestions: bool
    active_agent: str
    agent_payload: Dict[str, Any]
    final_output: Dict[str, Any]


# Node 1: Router Node (Intent Classification)
async def router_node(state: CoPilotGraphState) -> Dict[str, Any]:
    user_msg = state["user_message"]
    msg_lower = user_msg.lower()

    # Safety Guardrail check first (with typo tolerance)
    if is_data_deletion_attempt(user_msg):
        return {
            "intent": "GUARDRAIL",
            "active_agent": "Safety Guardrail",
        }

    router_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are WebNirmaan AI's Store Co-Pilot Intent Router.
Classify the user prompt into one of the core intents:
- 'DESIGN': Changing colors, themes, backgrounds, navbar, footer, card styles, or asking to match whole website to navbar/component.
- 'DB_QUERY': Asking about sales, revenue, orders, cancellations, returns, top selling items, product ratings, reviews, most rated products, or middle state orders, for any time range.
- 'MUTATION': Explicitly updating an order status (accept, ship, deliver, cancel order #1234).
- 'SEO_HEALTH': Store health audits, inventory restock checks, or SEO optimizations.
- 'KNOWLEDGE': How-to questions about platform features or controls.
- 'CHAT': Greetings ('hi', 'hello'), casual questions, or general assistance.

Extract parameters carefully:
- `days_filter`: Number of days if requested (e.g. 'last 10 days' -> 10, 'last 2 days' -> 2, 'today' -> 1).
- `target_component`: Target block if design query (e.g. 'navbar', 'footer', 'card', 'product_grid', 'overall').
"""),
        ("user", "User Message: {user_message}\nHistory: {history_str}"),
    ])

    try:
        structured_llm = router_prompt | llm.with_structured_output(IntentAnalysis)
        res: IntentAnalysis = await structured_llm.ainvoke({
            "user_message": user_msg,
            "history_str": state.get("history_str", ""),
        })

        intent = res.intent.upper() if res.intent else "CHAT"
        
        # Override intent if specific key phrases present
        if any(w in msg_lower for w in ["audit", "health check", "low stock", "restock"]):
            intent = "SEO_HEALTH"
        elif any(w in msg_lower for w in ["match whole website", "card theme as well", "match navbar"]):
            intent = "DESIGN"
        elif any(w in msg_lower for w in ["rating", "ratings", "rated", "review", "reviews", "top rated", "most rated", "most sold"]):
            intent = "DB_QUERY"
        elif any(w in msg_lower for w in ["hi", "hello", "hey", "who are you"]) and len(msg_lower.split()) <= 3:
            intent = "CHAT"

        return {
            "intent": intent,
            "target_component": res.target_component,
            "days_filter": res.days_filter,
            "status_filter": res.status_filter,
            "target_order_id": res.target_order_id,
            "new_order_status": res.new_order_status,
            "wants_palette_suggestions": res.wants_palette_suggestions,
            "active_agent": f"{intent} Agent",
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

    with Session(engine) as db:
        metrics = get_store_metrics_for_period(
            db,
            site_uuid,
            days_filter=days_filter,
            status_filter=state.get("status_filter"),
        )

    data_cards = []
    
    # Generate UI data cards based on query focus
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
    elif any(w in msg_lower for w in ["middle", "yet to ship", "shipped", "accepted"]):
        middle_orders = metrics.get("filtered_orders") or []
        orders_list = [
            {
                "id": str(o.id)[:8],
                "items_summary": ", ".join([f"{it.get('quantity', 1)}x {it.get('product_name', it.get('name', 'Item'))}" for it in o.items if isinstance(it, dict)]) if isinstance(o.items, list) else "Order Item",
                "total": float(o.total or 0),
                "status": str(o.status or "placed").capitalize(),
                "date": o.created_at.strftime("%b %d, %I:%M %p") if getattr(o, "created_at", None) else "",
            }
            for o in middle_orders[:15]
        ]
        data_cards.append({
            "type": "orders_card",
            "title": f"In-Progress Orders ({len(middle_orders)})",
            "orders": orders_list,
        })
    elif any(w in msg_lower for w in ["sales", "revenue", "analytics", "performance"]):
        data_cards.append({
            "type": "analytics_card",
            "title": f"Store Sales Analytics ({metrics['time_label']})",
            "metrics": {
                "period_sales": f"₹{metrics['period_sales']:,.2f}",
                "lifetime_sales": f"₹{metrics['lifetime_sales']:,.2f}",
                "period_orders": metrics["period_orders_count"],
                "total_orders": metrics["total_orders_count"],
                "top_product": metrics["top_product"],
            },
        })

    return {
        "agent_payload": {
            "metrics": metrics,
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
