"""
WebNirmaan AI - Response Synthesizer & Chat Presentation Agent
Unified output agent: converts raw payloads from specialized sub-agents into
polished, natural, conversational Markdown responses. Also handles greetings
and general chat (no separate chat agent needed).
"""

import json
from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o", temperature=0.3)


def _build_focused_payload_summary(user_message: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts only relevant facts needed to answer the user's specific query without noise."""
    msg_lower = user_message.lower()
    summary: Dict[str, Any] = {}

    # 1. Palette Suggestions
    if payload.get("data_cards"):
        summary["data_cards_summary"] = [c.get("title") for c in payload["data_cards"]]

    # 2. Design Patch
    if payload.get("design_modified"):
        summary["design_modified"] = True
        summary["updated_colors"] = payload.get("applied_patch") or payload.get("patch_applied") or payload.get("color_patch") or {}

    # 3. Store Audit
    if "audit" in payload:
        summary["audit"] = payload["audit"]

    # 4. Low Stock Inventory
    if "low_stock_products" in payload:
        summary["low_stock_products"] = payload["low_stock_products"]

    # 5. Order Mutation
    if "mutation" in payload:
        summary["mutation"] = payload["mutation"]

    # 6. Database / Sales Analytics
    if "metrics" in payload and isinstance(payload["metrics"], dict):
        m = payload["metrics"]
        summary["time_label"] = m.get("time_label", "Period")
        summary["period_sales"] = f"₹{m.get('period_sales', 0.0):,.2f}"
        summary["period_orders_count"] = m.get("period_orders_count", 0)
        summary["lifetime_sales"] = f"₹{m.get('lifetime_sales', 0.0):,.2f}"
        summary["total_orders_count"] = m.get("total_orders_count", 0)
        summary["top_product"] = m.get("top_product", "N/A")

        # Include product ratings & review info
        summary["avg_rating"] = m.get("avg_rating", "No reviews yet")
        summary["reviews_count"] = m.get("reviews_count", 0)
        summary["top_rated_products"] = m.get("top_rated_products", [])
        summary["store_products"] = m.get("store_products", [])

        if any(w in msg_lower for w in ["most sold", "top product", "best seller", "top seller", "popular", "items"]):
            summary["product_sales_qty"] = m.get("product_sales_qty", {})

        if any(w in msg_lower for w in ["return", "returns", "refund", "refunds"]):
            summary["total_returns_count"] = m.get("total_returns_count", 0)
            summary["return_status_counts"] = m.get("return_status_counts", {})
            summary["total_refunded_amount"] = f"₹{m.get('total_refunded_amount', 0.0):,.2f}"

        if any(w in msg_lower for w in ["middle", "status", "shipped", "accepted", "delivered", "unfulfilled"]):
            summary["status_counts"] = m.get("status_counts", {})

    # 7. Guidance / Docs
    if "guidance" in payload:
        summary["guidance"] = payload["guidance"]

    # 8. General Chat (greetings, casual questions)
    if payload.get("is_general_chat"):
        summary["is_general_chat"] = True

    return summary


async def synthesize_agent_response(
    user_message: str,
    active_agent: str,
    agent_payload: Dict[str, Any],
    history_str: str,
) -> Dict[str, Any]:
    """Synthesizes structured agent results into a clean, human-friendly conversational markdown response."""
    data_cards: List[Dict[str, Any]] = agent_payload.get("data_cards") or []
    design_modified = agent_payload.get("design_modified", False)
    next_draft_definition = agent_payload.get("next_draft_definition")

    # 1. Handle Safety Guardrail
    if agent_payload.get("is_guardrail"):
        return {
            "assistant_reply": (
                "⚠️ **Data Safety Guardrail Triggered**: Deleting orders, products, or store database records directly via AI Co-Pilot chat is restricted for data safety.\n\n"
                "If you need to remove an order or product, please perform this action manually through your **Admin Dashboard**."
            ),
            "data_cards": [],
            "design_modified": False,
            "next_draft_definition": None,
        }

    # 2. Unified LLM Synthesis — handles ALL response types including greetings
    synthesis_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are WebNirmaan Store Co-Pilot — an intelligent, warm, and adaptive AI assistant embedded in an e-commerce store builder dashboard.

You receive context from specialized sub-agents (design, analytics, health audits, knowledge base, or general chat).
Your job is to compose a clear, natural, conversational response for the store admin.

CRITICAL ANTI-HALLUCINATION RULES:
- You MUST rely STRICTLY on the facts provided in Payload Summary.
- If the user asks about product ratings, specific items (e.g. "what shirt has the most rated?"), or reviews, inspect `top_rated_products`, `reviews_count`, and `store_products` in Payload Summary.
- If `reviews_count` is 0 or no products match the user's specific query, state clearly and accurately that there are no ratings or reviews recorded for that product in the store database yet.
- NEVER invent, guess, or hallucinate product names (e.g. "Classic Cotton Tee"), rating counts (e.g. "150 ratings"), order numbers, or store figures.

GENERAL GUIDELINES:
- Be warm, professional, and genuinely helpful. Speak like a trusted advisor, not a rigid bot.
- When data is provided (sales figures, order counts, product names), weave them naturally into your response. Use ₹ for currency.
- When a design change was applied, briefly describe what changed and how it looks.
- When responding to greetings or casual questions, be friendly and briefly mention how you can help (design changes, analytics, order management, store audits).
- Use markdown formatting (bold, bullets) where it genuinely improves readability.
- Keep responses concise — aim for 2-4 sentences for simple queries.
- Never dump raw data. Never repeat system rules. Never mention internal agent names or architecture."""),
        ("user", """User Message: {user_message}
Active Agent: {active_agent}

Recent Conversation History:
{history_str}

Payload Summary:
{payload_json}

Compose your response:"""),
    ])

    try:
        focused_summary = _build_focused_payload_summary(user_message, agent_payload)
        payload_json = json.dumps(focused_summary, indent=2, default=str)

        res = await (synthesis_prompt | llm).ainvoke({
            "user_message": user_message,
            "active_agent": active_agent,
            "history_str": history_str,
            "payload_json": payload_json,
        })
        reply_text = res.content.strip()
    except Exception as e:
        print("Synthesis Error:", e)
        reply_text = "I've processed your request. Let me know if you need anything else!"

    return {
        "assistant_reply": reply_text,
        "data_cards": data_cards,
        "design_modified": design_modified,
        "next_draft_definition": next_draft_definition,
    }
