"""
WebNirmaan AI - Centralized Token & Cost Intelligence Tracker
Tracks real-time prompt tokens, completion tokens, total tokens, and USD cost across
all agent invocations, sessions, and store building pipelines.
"""

import threading
import time
from typing import Dict, Any, List, Optional
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

# Official OpenAI Model Pricing (USD per 1,000,000 tokens)
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    # GPT-4o-mini
    "gpt-4o-mini": {"input_per_million": 0.15, "output_per_million": 0.60},
    "gpt-4o-mini-2024-07-18": {"input_per_million": 0.15, "output_per_million": 0.60},
    
    # GPT-4o Flagship
    "gpt-4o": {"input_per_million": 2.50, "output_per_million": 10.00},
    "gpt-4o-2024-08-06": {"input_per_million": 2.50, "output_per_million": 10.00},
    "gpt-4o-2024-05-13": {"input_per_million": 5.00, "output_per_million": 15.00},
    
    # Default fallback
    "default": {"input_per_million": 0.50, "output_per_million": 1.50},
}


def calculate_token_cost(model_name: str, input_tokens: int, output_tokens: int) -> float:
    """Calculates exact cost in USD for given model and token counts."""
    clean_model = (model_name or "gpt-4o-mini").lower().strip()
    
    pricing = MODEL_PRICING.get(clean_model)
    if not pricing:
        # Check prefix matching (e.g. gpt-4o-mini...)
        if "gpt-4o-mini" in clean_model:
            pricing = MODEL_PRICING["gpt-4o-mini"]
        elif "gpt-4o" in clean_model:
            pricing = MODEL_PRICING["gpt-4o"]
        else:
            pricing = MODEL_PRICING["default"]
            
    input_cost = (input_tokens / 1_000_000.0) * pricing["input_per_million"]
    output_cost = (output_tokens / 1_000_000.0) * pricing["output_per_million"]
    return round(input_cost + output_cost, 7)


class TokenTrackerState:
    """Thread-safe state holding session-level and global cumulative token/cost metrics."""
    def __init__(self):
        self._lock = threading.Lock()
        self.global_stats: Dict[str, Any] = {
            "total_calls": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "total_cost_usd": 0.0,
            "by_agent": {},
            "by_model": {},
        }
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def record_usage(
        self,
        agent_name: str,
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            total_toks = input_tokens + output_tokens
            call_cost = calculate_token_cost(model_name, input_tokens, output_tokens)

            # 1. Update Global Cumulative Metrics
            self.global_stats["total_calls"] += 1
            self.global_stats["input_tokens"] += input_tokens
            self.global_stats["output_tokens"] += output_tokens
            self.global_stats["total_tokens"] += total_toks
            self.global_stats["total_cost_usd"] = round(self.global_stats["total_cost_usd"] + call_cost, 6)

            # Global by Agent
            agent_rec = self.global_stats["by_agent"].setdefault(agent_name, {
                "calls": 0, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0
            })
            agent_rec["calls"] += 1
            agent_rec["input_tokens"] += input_tokens
            agent_rec["output_tokens"] += output_tokens
            agent_rec["total_tokens"] += total_toks
            agent_rec["cost_usd"] = round(agent_rec["cost_usd"] + call_cost, 6)

            # Global by Model
            model_rec = self.global_stats["by_model"].setdefault(model_name, {
                "calls": 0, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost_usd": 0.0
            })
            model_rec["calls"] += 1
            model_rec["input_tokens"] += input_tokens
            model_rec["output_tokens"] += output_tokens
            model_rec["total_tokens"] += total_toks
            model_rec["cost_usd"] = round(model_rec["cost_usd"] + call_cost, 6)

            # 2. Update Session-Specific Metrics (if session_id provided)
            sess_key = session_id or "default_session"
            sess_rec = self.sessions.setdefault(sess_key, {
                "session_id": sess_key,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "total_calls": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "calls_log": [],
            })
            sess_rec["total_calls"] += 1
            sess_rec["input_tokens"] += input_tokens
            sess_rec["output_tokens"] += output_tokens
            sess_rec["total_tokens"] += total_toks
            sess_rec["total_cost_usd"] = round(sess_rec["total_cost_usd"] + call_cost, 6)

            log_entry = {
                "timestamp": time.strftime("%H:%M:%S", time.localtime()),
                "agent": agent_name,
                "model": model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_toks,
                "call_cost_usd": call_cost,
                "session_cost_so_far": sess_rec["total_cost_usd"],
            }
            sess_rec["calls_log"].append(log_entry)

            # 3. Clean Terminal Console Output
            print(
                f"\n💰 [TOKEN TRACKER] Agent: {agent_name:24} | Model: {model_name} | "
                f"In: {input_tokens} tok | Out: {output_tokens} tok | Total: {total_toks} tok | "
                f"Cost: ${call_cost:.6f} | Session Total: ${sess_rec['total_cost_usd']:.5f} ({sess_rec['total_calls']} calls)"
            )

            return {
                "call_cost_usd": call_cost,
                "session_cost_usd": sess_rec["total_cost_usd"],
                "session_total_tokens": sess_rec["total_tokens"],
                "global_total_cost_usd": self.global_stats["total_cost_usd"],
            }

    def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        with self._lock:
            return dict(self.sessions.get(session_id, {
                "session_id": session_id,
                "total_calls": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "calls_log": [],
            }))

    def get_global_summary(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self.global_stats)


# Singleton Instance
_tracker = TokenTrackerState()


class TokenCostCallback(BaseCallbackHandler):
    """LangChain callback handler that records token usage on every model invocation."""
    def __init__(self, agent_name: str, session_id: Optional[str] = None):
        super().__init__()
        self.agent_name = agent_name
        self.session_id = session_id

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        try:
            llm_output = response.llm_output or {}
            token_usage = llm_output.get("token_usage") or {}
            
            in_toks = token_usage.get("prompt_tokens") or 0
            out_toks = token_usage.get("completion_tokens") or 0
            model_name = llm_output.get("model_name") or "gpt-4o-mini"
            
            # Fallback if top-level llm_output didn't contain usage
            if in_toks == 0 and out_toks == 0:
                for gen_list in response.generations:
                    for gen in gen_list:
                        msg = getattr(gen, "message", None)
                        if msg:
                            meta = getattr(msg, "usage_metadata", None) or getattr(msg, "response_metadata", {}).get("token_usage", {})
                            if meta:
                                in_toks = meta.get("input_tokens") or meta.get("prompt_tokens") or in_toks
                                out_toks = meta.get("output_tokens") or meta.get("completion_tokens") or out_toks

            if in_toks > 0 or out_toks > 0:
                _tracker.record_usage(
                    agent_name=self.agent_name,
                    model_name=model_name,
                    input_tokens=in_toks,
                    output_tokens=out_toks,
                    session_id=self.session_id,
                )
        except Exception as e:
            print("TokenCostCallback error:", e)


def track_manual_usage(
    agent_name: str,
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Helper to manually record token usage from any agent."""
    return _tracker.record_usage(
        agent_name=agent_name,
        model_name=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        session_id=session_id,
    )


def get_token_tracker() -> TokenTrackerState:
    """Returns the singleton TokenTrackerState instance."""
    return _tracker
