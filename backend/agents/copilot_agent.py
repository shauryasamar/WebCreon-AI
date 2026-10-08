"""
Webcreon AI Admin Co-Pilot Agent
Entry point for the Co-Pilot chat pipeline.
Delegates all processing to the LangGraph Multi-Agent Orchestrator.
"""

import copy
from typing import Dict, Any, List, Optional
from uuid import UUID

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from sqlmodel import Session, select
from db.database import engine
from models import Site
from agents.copilot_orchestrator import (
    copilot_langgraph_app,
    copilot_pre_synthesis_app,
    stream_synthesize_agent_response,
)


async def process_copilot_request(
    message: str,
    site_id: str,
    site_definition: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
    draft_definition: Optional[Dict[str, Any]] = None,
    previous_draft_definition: Optional[Dict[str, Any]] = None,
    snapshot_history: Optional[List[Dict[str, Any]]] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
) -> Dict[str, Any]:
    """Processes user chat request using the LangGraph Multi-Agent Orchestrator Pipeline."""
    effective_definition = draft_definition or site_definition
    effective_history = chat_history or conversation_history

    # Fetch site definition from database if not provided
    if not effective_definition and site_id:
        try:
            with Session(engine) as db:
                site = db.exec(select(Site).where(Site.id == UUID(site_id))).first()
                if site:
                    effective_definition = site.draft_definition or site.site_definition
        except Exception as se:
            print("Error loading site definition:", se)

    if not effective_definition:
        effective_definition = {
            "site": {"brand_name": "My Store", "domain": "fashion"},
            "theme": {"mode": "light", "primary_bg": "#ffffff", "text_color": "#0f172a"},
            "pages": [],
        }

    # Format history string with token bounding
    history_lines = []
    if effective_history:
        for turn in effective_history[-4:]:
            role = turn.get("role") or turn.get("sender") or "User"
            content = (turn.get("content") or turn.get("text") or "").strip()
            if len(content) > 120:
                content = content[:120] + "..."
            history_lines.append(f"{role}: {content}")
    history_str = "\n".join(history_lines) if history_lines else "No previous chat history."

    # Invoke LangGraph StateGraph Multi-Agent Pipeline
    initial_state = {
        "user_message": message,
        "site_id": site_id,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "actor_email": actor_email,
        "actor_role": actor_role,
        "site_definition": copy.deepcopy(effective_definition),
        "previous_draft_definition": previous_draft_definition,
        "snapshot_history": snapshot_history or [],
        "history_str": history_str,
        "intent": "CHAT",
        "target_component": None,
        "days_filter": None,
        "status_filter": None,
        "target_order_id": None,
        "new_order_status": None,
        "wants_palette_suggestions": False,
        "active_agent": "Orchestrator Node",
        "agent_payload": {},
        "final_output": {},
    }

    try:
        result_state = await copilot_langgraph_app.ainvoke(initial_state)
        final_output = result_state.get("final_output") or {}
        agent_payload = result_state.get("agent_payload") or {}

        return {
            "assistant_reply": final_output.get("assistant_reply") or "I've processed your store request!",
            "is_new_site_request": False,
            "redirect_url": None,
            "design_modified": final_output.get("design_modified", False) or agent_payload.get("design_modified", False),
            "updated_draft_definition": final_output.get("next_draft_definition") or agent_payload.get("next_draft_definition"),
            "data_cards": final_output.get("data_cards") or agent_payload.get("data_cards") or [],
            "action": final_output.get("action") or agent_payload.get("action"),
            "has_reverted_base": final_output.get("has_reverted_base", False) or agent_payload.get("has_reverted_base", False),
        }
    except Exception as ge:
        print("LangGraph Execution Error:", ge)
        return {
            "assistant_reply": "I ran into an issue processing your request. Please try again.",
            "is_new_site_request": False,
            "redirect_url": None,
            "design_modified": False,
            "updated_draft_definition": None,
            "data_cards": [],
        }


async def process_copilot_request_stream(
    message: str,
    site_id: str,
    site_definition: Optional[Dict[str, Any]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
    draft_definition: Optional[Dict[str, Any]] = None,
    previous_draft_definition: Optional[Dict[str, Any]] = None,
    snapshot_history: Optional[List[Dict[str, Any]]] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
):
    """Processes user chat request, yielding live word-by-word tokens followed by final event payload."""
    effective_definition = draft_definition or site_definition
    effective_history = chat_history or conversation_history

    if not effective_definition and site_id:
        try:
            with Session(engine) as db:
                site = db.exec(select(Site).where(Site.id == UUID(site_id))).first()
                if site:
                    effective_definition = site.draft_definition or site.site_definition
        except Exception as se:
            print("Error loading site definition for stream:", se)

    if not effective_definition:
        effective_definition = {
            "site": {"brand_name": "My Store", "domain": "fashion"},
            "theme": {"mode": "light", "primary_bg": "#ffffff", "text_color": "#0f172a"},
            "pages": [],
        }

    history_lines = []
    if effective_history:
        for turn in effective_history[-4:]:
            role = turn.get("role") or turn.get("sender") or "User"
            content = (turn.get("content") or turn.get("text") or "").strip()
            if len(content) > 120:
                content = content[:120] + "..."
            history_lines.append(f"{role}: {content}")
    history_str = "\n".join(history_lines) if history_lines else "No previous chat history."

    initial_state = {
        "user_message": message,
        "site_id": site_id,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "actor_email": actor_email,
        "actor_role": actor_role,
        "site_definition": copy.deepcopy(effective_definition),
        "previous_draft_definition": previous_draft_definition,
        "snapshot_history": snapshot_history or [],
        "history_str": history_str,
        "intent": "CHAT",
        "target_component": None,
        "days_filter": None,
        "status_filter": None,
        "target_order_id": None,
        "new_order_status": None,
        "wants_palette_suggestions": False,
        "active_agent": "Orchestrator Node",
        "agent_payload": {},
        "final_output": {},
    }

    try:
        intermediate_state = await copilot_pre_synthesis_app.ainvoke(initial_state)
        active_agent = intermediate_state.get("active_agent", "Co-Pilot Agent")
        agent_payload = intermediate_state.get("agent_payload") or {}
        if "site_definition" not in agent_payload and intermediate_state.get("site_definition"):
            agent_payload["site_definition"] = intermediate_state.get("site_definition")

        async for event in stream_synthesize_agent_response(
            user_message=message,
            active_agent=active_agent,
            agent_payload=agent_payload,
            history_str=history_str,
        ):
            yield event
    except Exception as ge:
        print("LangGraph Streaming Execution Error:", ge)
        import traceback
        traceback.print_exc()
        yield {"type": "token", "content": "I ran into an issue processing your request. Please try again."}
        yield {
            "type": "done",
            "assistant_reply": "I ran into an issue processing your request. Please try again.",
            "data_cards": [],
            "design_modified": False,
            "updated_draft_definition": None,
        }
