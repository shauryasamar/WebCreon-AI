"""
Webcreon AI - Unified Multi-Agent Response Synthesizer & Chat Presentation Agent
Unified output agent: converts raw payloads from specialized sub-agents into
polished, natural, conversational Markdown responses. Also handles greetings
and general chat (no separate chat agent needed).
"""

import json
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

import re
import json
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, request_timeout=20, max_retries=2)


def _build_focused_payload_summary(user_message: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts only relevant facts needed to answer the user's specific query without noise."""
    msg_lower = user_message.lower()
    summary: Dict[str, Any] = {}

    # 0. Active Store Identity & Brand Context
    site_def = payload.get("site_definition") or {}
    brand_name = (
        site_def.get("site", {}).get("brand_name")
        or site_def.get("brand_name")
        or site_def.get("site_name")
        or site_def.get("navbar", {}).get("brandName")
        or site_def.get("header", {}).get("brand_name")
        or site_def.get("title")
        or site_def.get("name")
    )
    if brand_name:
        summary["current_store_brand_name"] = brand_name
        summary["current_store_domain"] = site_def.get("site", {}).get("domain") or site_def.get("domain") or "e-commerce"

    # 1. Palette Suggestions & Table Cards
    has_table_card = False
    if payload.get("data_cards"):
        summary["has_data_cards"] = True
        summary["data_cards_summary"] = [c.get("title") for c in payload["data_cards"] if isinstance(c, dict)]
        for c in payload["data_cards"]:
            if isinstance(c, dict) and c.get("type") == "table_card" and c.get("rows"):
                has_table_card = True
                summary["table_card_data"] = {
                    "title": c.get("title"),
                    "columns": c.get("columns", []),
                    "matching_records_count": c.get("row_count") or len(c.get("rows", [])),
                    "ui_note": "A rich interactive Table Card is ALREADY rendered directly below the message. DO NOT recite rows or build ASCII tables in text."
                }

    # 2. Design Patch & Compound Execution
    if payload.get("compound_execution"):
        summary["compound_execution"] = True
        summary["compound_action_summaries"] = payload.get("compound_action_summaries", [])
    if payload.get("design_modified"):
        summary["design_modified"] = True
        summary["updated_colors"] = payload.get("applied_patch") or payload.get("patch_applied") or payload.get("color_patch") or {}
    elif payload.get("unmatched_component") or payload.get("unsupported_scope") or payload.get("target_component") in ["unsupported", "unknown"]:
        summary["design_modified"] = False
        summary["styling_outcome"] = "unmatched_or_unsupported"
        summary["target_component"] = payload.get("target_component") or "unspecified"

    # 3. Store Audit
    if "audit" in payload:
        summary["audit"] = payload["audit"]

    # 4. Low Stock Inventory
    if "low_stock_products" in payload:
        summary["low_stock_products"] = payload["low_stock_products"]

    # 5. Read-Only Restriction
    if payload.get("read_only_restriction"):
        summary["read_only_restriction"] = True
        summary["attempted_action"] = payload.get("attempted_action", "")

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

        summary["top_product"] = m.get("top_product", "N/A")

        # Include product ratings, stock, & inventory info
        summary["avg_rating"] = m.get("avg_rating", "No reviews yet")
        summary["reviews_count"] = m.get("reviews_count", 0)
        if any(w in msg_lower for w in ["how many product", "total product", "all product", "catalog count", "what do we sell", "what products", "webpage", "store name", "brand name", "catalog size", "how many item", "number of products"]):
            summary["total_products_count"] = m.get("total_products_count", 0)

        if any(w in msg_lower for w in ["out of stock", "zero stock", "0 stock", "no stock", "inventory", "low stock", "stock"]):
            summary["out_of_stock_count"] = m.get("out_of_stock_count", 0)
            summary["low_stock_count"] = m.get("low_stock_count", 0)

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
            row_count = dqr.get("row_count", 0)
            rows = dqr.get("rows", [])
            # If a table card was created for multi-row data, do not dump raw rows into the prompt
            if has_table_card:
                summary["dynamic_query_result"] = {
                    "explanation": dqr.get("explanation", ""),
                    "columns": dqr.get("columns", []),
                    "row_count": row_count,
                }
            else:
                # 1-row scalar or direct metric query without table card
                summary["dynamic_query_result"] = {
                    "explanation": dqr.get("explanation", ""),
                    "columns": dqr.get("columns", []),
                    "rows": rows[:3],
                    "row_count": row_count,
                }

    # 7. Guidance / Docs
    if "guidance" in payload:
        summary["guidance"] = payload["guidance"]

    # 8. General Chat (greetings, casual questions)
    if payload.get("is_general_chat"):
        summary["is_general_chat"] = True

    return summary


synthesis_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are WebCreon Store Co-Pilot — an intelligent, executive, and precise e-commerce AI assistant embedded in a store builder dashboard.

You receive context from specialized sub-agents (design, analytics, store health audits, knowledge base, or general chat).
Your job is to compose a clean, elegant, executive Markdown response optimized for a compact 380px-440px wide chat drawer.

FORMATTING & EXECUTIVE POLISH RULES:
1. ZERO DATA DUPLICATION & CARD CO-EXISTENCE (CRITICAL):
   - When any visual Data Card is attached (e.g. Table Card, Orders Card, Returns Card, or Analytics Card indicated in `has_data_cards`):
     * The rich interactive visual card is ALREADY presented directly underneath your text bubble in the UI.
     * NEVER recite, enumerate, list out, or repeat raw row items, product names, item counts, order IDs, addresses, emails, or individual prices/stocks into your text message!
     * NEVER output raw ASCII Markdown table syntax (NEVER use `| Col 1 | Col 2 |` or `|---|---|`).
     * Your text response MUST ONLY be 1 to 2 crisp, executive, informative sentences providing the high-level answer or overarching takeaway, letting the UI card display the details.
     * If you mention the count of records found, use `matching_records_count` from `table_card_data` (e.g. "Found 50 active products...") so the number in your text matches the Table Card header badge (50 rows) with 100% consistency.
   - When NO visual Data Card is attached, answer factually, cleanly, and concisely without building squished ASCII tables.

2. NO ASCII MARKDOWN TABLES:
   - NEVER use pipe characters `|` to draw tables in the text output. In the compact chat drawer, ASCII tables get broken, squished, and unreadable. Tabular data belongs strictly in the interactive Table Card.

3. STRICT ZERO EMOJI POLICY:
   - Do NOT include ANY emojis, sparkles, or icons (such as ✨, 🚀, 📊, ⏪, ✅, etc.) anywhere in your output.
   - Deliver pure, clean, professional executive English.

4. DIRECT FACTUAL ACCURACY & CURRENCY:
   - Rely strictly on the facts, records, and numbers in the current Payload Summary.
   - STRICT CURRENCY (INDIAN RUPEE): All store revenue, amounts, discounts, and prices are strictly in Indian Rupees (₹ / INR). ALWAYS use the Rupee symbol '₹' (e.g. ₹179.00, ₹1,250.00). NEVER use ₦ (Naira), $, €, £, or any other currency symbol.
   - STORE IDENTITY & TOTAL CATALOG PRODUCTS:
     * When the user asks what store/webpage they are on or what their store sells, use `current_store_brand_name` and domain.
     * ONLY IF the user explicitly asks how many products or items the store has in total, quote `total_products_count` (e.g. "**164 active products**").
     * NEVER append, recite, or mention "Your store has 164 active products" at the end of unrelated queries (such as stock checks, customer lists, order breakdowns, or sales analytics).
   - ORDER COUNTS:
     * If the user asks about "new orders", refer strictly to `new_orders_count` (e.g. "**11 new orders** currently placed"). NEVER quote total store lifetime orders (`total_orders_count` like 114) or pending drafts as new orders!
   - NO VAGUE NON-ANSWERS:
     * Never give vague non-answers like "information is available in the dashboard" or "check your dashboard for details".
     * Answer directly with the key figures and facts.

5. CLEAN CONVERSATIONAL TONE (NO BOILERPLATE):
   - Do NOT append repetitive boilerplate like "For further details, please refer to your Admin Dashboard." at the end of informational or analytical replies. Keep it crisp, natural, and executive.

6. COMPOUND ACTION & RESTRICTIONS:
   - When multiple actions were requested:
     * Confirm applied visual/design changes clearly in a concise bullet point.
     * If database write/update actions were requested (e.g. accepting orders, updating stock, creating coupons), politely state in 1 sentence that direct database modifications are restricted in chat for safety and should be managed in the Admin Dashboard.

7. DESIGN & STYLING OUTCOMES:
   - When `design_modified` is True, describe the applied color and styling updates clearly and concisely.
   - When `styling_outcome` is 'unmatched_or_unsupported', naturally and politely inform the user in 1-2 concise sentences that you couldn't identify or modify that specific element, and ask them to clarify which section or page they would like to customize.

8. CONCISENESS:
   - Total text response length should be 1 to 3 concise, high-impact sentences or clean bullet points."""),
    ("user", """User Message: {user_message}
Active Agent: {active_agent}

Recent Conversation History:
{history_str}

Payload Summary:
{payload_json}

Compose your structured response:"""),
])


def deduplicate_data_cards(cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicates data cards by type, title, and structure signature."""
    if not cards:
        return []
    seen = set()
    unique_cards = []
    for c in cards:
        if not isinstance(c, dict):
            continue
        c_type = c.get("type", "")
        if c_type == "table_card":
            cols_tuple = tuple(c.get("columns", []))
            sig = (c_type, cols_tuple, len(c.get("rows", [])))
        elif c_type in ("palette_suggestions_card", "component_palette_suggestions_card"):
            pal_names = tuple(p.get("name", "") for p in c.get("palettes", []))
            sig = (c_type, pal_names)
        else:
            sig = (c_type, c.get("title", ""))
        
        if sig not in seen:
            seen.add(sig)
            unique_cards.append(c)
    return unique_cards


def sanitize_synthesizer_output(text: str, has_data_cards: bool = False) -> str:
    """Cleans up text responses to ensure zero ASCII table leakage, removes repetitive dashboard boilerplate, and ensures clean markdown."""
    if not text:
        return text

    # Normalize currency symbols to Indian Rupee (₹)
    text = text.replace("₦", "₹")

    # 1. Strip raw ASCII markdown tables (| ... | ... |)
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # If line looks like a markdown table row e.g. | ... | or |---|---|
        if (stripped.startswith("|") and stripped.endswith("|")) or re.match(r"^\|?\s*[-:]+[-|\s:]+\|?$", stripped):
            continue
        cleaned_lines.append(line)
    
    cleaned_text = "\n".join(cleaned_lines)
    # Remove multiple consecutive blank lines
    cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text).strip()

    # 2. Strip repetitive boilerplate phrases like "For further details, please refer to your Admin Dashboard."
    # unless it's a read-only restriction message
    boilerplate_patterns = [
        r"For further details, please refer to your Admin Dashboard\.?",
        r"For more details, please visit your Admin Dashboard\.?",
        r"Please refer to your Admin Dashboard for further details\.?",
        r"For further details, refer to your Admin Dashboard\.?",
    ]
    for pattern in boilerplate_patterns:
        cleaned_text = re.sub(pattern, "", cleaned_text, flags=re.IGNORECASE)

    cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text).strip()
    return cleaned_text


async def synthesize_agent_response(
    user_message: str,
    active_agent: str,
    agent_payload: Dict[str, Any],
    history_str: str,
) -> Dict[str, Any]:
    """Synthesizes structured agent results into a clean, human-friendly conversational markdown response."""
    data_cards: List[Dict[str, Any]] = deduplicate_data_cards(agent_payload.get("data_cards") or [])
    design_modified = agent_payload.get("design_modified", False)
    next_draft_definition = agent_payload.get("next_draft_definition")

    # 1. Handle Safety Guardrail
    if agent_payload.get("is_guardrail"):
        return {
            "assistant_reply": (
                "Security & Safety Guardrail: Direct raw SQL injection syntax, system table probing, and deleting store records via AI chat are restricted for data safety.\n\n"
                "If you need to manage database records, please use the verified controls in your Admin Dashboard."
            ),
            "data_cards": [],
            "design_modified": False,
            "next_draft_definition": None,
        }

    # 2. Handle Revert / Undo Action
    if agent_payload.get("action") == "revert_snapshot":
        return {
            "assistant_reply": agent_payload.get("assistant_reply") or "Reverted your design back to the previous snapshot.",
            "data_cards": [],
            "design_modified": False,
            "next_draft_definition": None,
            "action": "revert_snapshot",
        }

    # 3. Handle Direct Assistant Reply (e.g. from banner creation)
    if agent_payload.get("assistant_reply") and not agent_payload.get("metrics"):
        return {
            "assistant_reply": sanitize_synthesizer_output(agent_payload["assistant_reply"], bool(data_cards)),
            "data_cards": data_cards,
            "design_modified": design_modified,
            "next_draft_definition": next_draft_definition,
            "action": agent_payload.get("action"),
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
        reply_text = sanitize_synthesizer_output(res.content.strip(), bool(data_cards))
    except Exception as e:
        print("Synthesis Error:", e)
        reply_text = "I've processed your request. Let me know if you need anything else!"

    return {
        "assistant_reply": reply_text,
        "data_cards": data_cards,
        "design_modified": design_modified,
        "next_draft_definition": next_draft_definition,
        "action": agent_payload.get("action"),
        "has_reverted_base": agent_payload.get("has_reverted_base", False),
    }


async def stream_synthesize_agent_response(
    user_message: str,
    active_agent: str,
    agent_payload: Dict[str, Any],
    history_str: str,
):
    """Yields token-by-token streaming response chunks, then the final metadata payload."""
    data_cards: List[Dict[str, Any]] = deduplicate_data_cards(agent_payload.get("data_cards") or [])
    design_modified = agent_payload.get("design_modified", False)
    next_draft_definition = agent_payload.get("next_draft_definition")

    # 1. Handle Safety Guardrail
    if agent_payload.get("is_guardrail"):
        msg = (
            "Security & Safety Guardrail: Direct raw SQL injection syntax, system table probing, and deleting store records via AI chat are restricted for data safety.\n\n"
            "If you need to manage database records, please use the verified controls in your Admin Dashboard."
        )
        yield {"type": "token", "content": msg}
        yield {
            "type": "done",
            "assistant_reply": msg,
            "data_cards": [],
            "design_modified": False,
            "next_draft_definition": None,
            "has_reverted_base": False,
        }
        return

    # 2. Handle Revert / Undo Action
    if agent_payload.get("action") == "revert_snapshot":
        msg = agent_payload.get("assistant_reply") or "Reverted your design back to the previous snapshot."
        yield {"type": "token", "content": msg}
        yield {
            "type": "done",
            "assistant_reply": msg,
            "data_cards": [],
            "design_modified": False,
            "next_draft_definition": None,
            "action": "revert_snapshot",
            "has_reverted_base": False,
        }
        return

    # 3. Handle Direct Assistant Reply (e.g. from banner creation)
    if agent_payload.get("assistant_reply") and not agent_payload.get("metrics"):
        msg = sanitize_synthesizer_output(agent_payload["assistant_reply"], bool(data_cards))
        yield {"type": "token", "content": msg}
        yield {
            "type": "done",
            "assistant_reply": msg,
            "data_cards": data_cards,
            "design_modified": design_modified,
            "updated_draft_definition": next_draft_definition,
            "next_draft_definition": next_draft_definition,
            "action": agent_payload.get("action"),
            "has_reverted_base": agent_payload.get("has_reverted_base", False),
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
            content = str(chunk.content or "").replace("₦", "₹")
            if content:
                full_reply += content
                yield {"type": "token", "content": content}
    except Exception as e:
        print("Streaming Synthesis Error:", e)
        fallback = " I've processed your store request. Let me know if you need anything else!"
        full_reply += fallback
        yield {"type": "token", "content": fallback}

    cleaned_reply = sanitize_synthesizer_output(full_reply.strip(), bool(data_cards))
    yield {
        "type": "done",
        "assistant_reply": cleaned_reply,
        "data_cards": data_cards,
        "design_modified": design_modified,
        "updated_draft_definition": next_draft_definition,
        "next_draft_definition": next_draft_definition,
        "action": agent_payload.get("action"),
        "has_reverted_base": agent_payload.get("has_reverted_base", False),
    }

