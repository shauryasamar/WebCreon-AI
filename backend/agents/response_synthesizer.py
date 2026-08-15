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

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)


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

        # Order Statuses & Lifecycle breakdown - ALWAYS included so AI never confuses total with new/pending!
        summary["status_counts"] = m.get("status_counts", {})
        summary["new_orders_count"] = m.get("new_orders_count", 0)
        summary["pending_orders_count"] = m.get("pending_orders_count", 0)
        summary["accepted_orders_count"] = m.get("accepted_orders_count", 0)
        summary["shipped_orders_count"] = m.get("shipped_orders_count", 0)
        summary["delivered_orders_count"] = m.get("delivered_orders_count", 0)
        summary["cancelled_orders_count"] = m.get("cancelled_orders_count", 0)
        summary["orders_breakdown_summary"] = m.get("orders_breakdown_summary", "")
        summary["recent_orders_list"] = m.get("recent_orders_list", [])

        summary["top_product"] = m.get("top_product", "N/A")

        # Include product ratings, stock, & inventory info
        summary["avg_rating"] = m.get("avg_rating", "No reviews yet")
        summary["reviews_count"] = m.get("reviews_count", 0)
        summary["top_rated_products"] = m.get("top_rated_products", [])
        summary["total_products_count"] = m.get("total_products_count", 0)
        summary["total_inventory_stock"] = m.get("total_inventory_stock", 0)
        summary["out_of_stock_count"] = m.get("out_of_stock_count", 0)
        summary["low_stock_count"] = m.get("low_stock_count", 0)
        summary["store_products"] = m.get("store_products", [])

        if any(w in msg_lower for w in ["most sold", "top product", "best seller", "top seller", "popular", "items"]):
            summary["product_sales_qty"] = m.get("product_sales_qty", {})

        if any(w in msg_lower for w in ["return", "returns", "refund", "refunds"]):
            summary["total_returns_count"] = m.get("total_returns_count", 0)
            summary["return_status_counts"] = m.get("return_status_counts", {})
            summary["total_refunded_amount"] = f"₹{m.get('total_refunded_amount', 0.0):,.2f}"

    # 6B. Dynamic Safe SQL Execution Results
    if "dynamic_query_result" in payload and isinstance(payload["dynamic_query_result"], dict):
        dqr = payload["dynamic_query_result"]
        if dqr.get("success"):
            summary["dynamic_query_result"] = {
                "explanation": dqr.get("explanation", ""),
                "columns": dqr.get("columns", []),
                "rows": dqr.get("rows", [])[:20],
                "row_count": dqr.get("row_count", 0),
            }

    # 7. Guidance / Docs
    if "guidance" in payload:
        summary["guidance"] = payload["guidance"]

    # 8. General Chat (greetings, casual questions)
    if payload.get("is_general_chat"):
        summary["is_general_chat"] = True

    return summary


synthesis_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are WebNirmaan Store Co-Pilot — an intelligent, warm, and adaptive AI assistant embedded in an e-commerce store builder dashboard.

You receive context from specialized sub-agents (design, analytics, health audits, knowledge base, or general chat).
Your job is to compose a clear, natural, conversational response for the store admin.

CRITICAL ANTI-HALLUCINATION & ACCURACY RULES:
- You MUST rely STRICTLY on the facts provided in Payload Summary.

1. DYNAMIC DATABASE QUERY RESULTS:
- If `dynamic_query_result` is present in Payload Summary, it contains the exact results of a safe PostgreSQL query executed against the live store database.
- Provide a crisp, conversational 1-2 sentence executive summary (e.g. "Your top-selling item is **Red Flesh Dragon Fruit** with 7 units sold.") and highlight the top 1 or 2 key takeaways.
- Do NOT redundantly recite the entire list row-by-row if there are multiple items, as the full detailed table is already rendered directly beneath your message in an interactive table card!
- Format monetary numbers with ₹ (e.g. ₹1,499.00), format dates cleanly, and distinguish quantities/units from currency.
- If `dynamic_query_result.rows` is empty (0 rows), clearly tell the user that no matching records were found in the database.

2. ORDER STATUS & LIFECYCLE RULES:
- `status_counts`, `new_orders_count`, `pending_orders_count`, `shipped_orders_count`, `delivered_orders_count`, `cancelled_orders_count`, and `orders_breakdown_summary` in Payload Summary contain the exact counts of orders in each stage.
- "New orders" refers specifically to orders that have been placed (status: `placed` or `new` or `pending`). Look at `new_orders_count` (or `status_counts.get("placed")`).
- "Pending orders" refers to orders awaiting fulfillment (placed, new, pending, or accepted).
- "Delivered orders" refers to orders with status `delivered`.
- "Shipped orders" refers to orders in transit (status: `shipped`, `out_for_delivery`).
- "Cancelled orders" refers to orders with status `cancelled`.
- NEVER equate `total_orders_count` with new or pending orders! If `total_orders_count` is 7, and `placed` is 2, `delivered` is 3, `shipped` is 2, say: "You have 2 new orders (out of 7 total orders: 2 Placed, 2 Shipped, 3 Delivered)".
- When the user asks "what is the state of all orders" or "status of orders", clearly list the breakdown across all statuses using `orders_breakdown_summary` or `status_counts`.

3. PRODUCT INVENTORY & STOCK RULES:
- `store_products` in Payload Summary contains the complete list of products in the store database, including each product's exact `stock` quantity, `brand`, `category`, and `price`.
- When the user asks for stock levels or inventory numbers for any products or categories, inspect `store_products` in Payload Summary and list each product's exact name and `stock` quantity clearly.
- NEVER state that stock numbers are missing or unavailable when `store_products` is provided in Payload Summary!

4. PRODUCT DESCRIPTION & CATALOG AUDIT RULES:
- When the user asks about products with missing descriptions or catalog completeness, inspect `audit.missing_description_products` and `audit.missing_description_count` in Payload Summary.
- If `missing_description_count` > 0, list the specific products that lack descriptions clearly.
- If `missing_description_count` == 0, confirm accurately that all products currently have descriptions.
- NEVER contradict yourself or make assumptions about whether a product has a description without checking the database or payload!

5. REVIEWS & RATINGS RULES:
- If the user asks about product ratings, specific items (e.g. "what shirt has the most rated?"), or reviews, inspect `top_rated_products`, `reviews_count`, and `store_products` in Payload Summary.
- If `reviews_count` is 0 or no products match the user's specific query, state clearly and accurately that there are no ratings or reviews recorded for that product in the store database yet.
- NEVER invent, guess, or hallucinate product names, rating counts, order numbers, or store figures.

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

    try:
        from agents.token_tracker import TokenCostCallback
        focused_summary = _build_focused_payload_summary(user_message, agent_payload)
        payload_json = json.dumps(focused_summary, indent=2, default=str)

        res = await (synthesis_prompt | llm).ainvoke(
            {
                "user_message": user_message,
                "active_agent": active_agent,
                "history_str": history_str,
                "payload_json": payload_json,
            },
            config={"callbacks": [TokenCostCallback("Copilot.Synthesizer")]}
        )
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


async def stream_synthesize_agent_response(
    user_message: str,
    active_agent: str,
    agent_payload: Dict[str, Any],
    history_str: str,
):
    """Yields token-by-token streaming response chunks, then the final metadata payload."""
    data_cards: List[Dict[str, Any]] = agent_payload.get("data_cards") or []
    design_modified = agent_payload.get("design_modified", False)
    next_draft_definition = agent_payload.get("next_draft_definition")

    # 1. Handle Safety Guardrail
    if agent_payload.get("is_guardrail"):
        msg = (
            "⚠️ **Data Safety Guardrail Triggered**: Deleting orders, products, or store database records directly via AI Co-Pilot chat is restricted for data safety.\n\n"
            "If you need to remove an order or product, please perform this action manually through your **Admin Dashboard**."
        )
        yield {"type": "token", "content": msg}
        yield {
            "type": "done",
            "assistant_reply": msg,
            "data_cards": [],
            "design_modified": False,
            "next_draft_definition": None,
        }
        return

    focused_summary = _build_focused_payload_summary(user_message, agent_payload)
    payload_json = json.dumps(focused_summary, indent=2, default=str)

    full_reply = ""
    try:
        from agents.token_tracker import TokenCostCallback
        async for chunk in (synthesis_prompt | llm).astream(
            {
                "user_message": user_message,
                "active_agent": active_agent,
                "history_str": history_str,
                "payload_json": payload_json,
            },
            config={"callbacks": [TokenCostCallback("Copilot.SynthesizerStream")]}
        ):
            content = str(chunk.content or "")
            if content:
                full_reply += content
                yield {"type": "token", "content": content}
    except Exception as e:
        print("Streaming Synthesis Error:", e)
        fallback = " I've processed your store request. Let me know if you need anything else!"
        full_reply += fallback
        yield {"type": "token", "content": fallback}

    yield {
        "type": "done",
        "assistant_reply": full_reply.strip(),
        "data_cards": data_cards,
        "design_modified": design_modified,
        "updated_draft_definition": next_draft_definition,
        "next_draft_definition": next_draft_definition,
    }
