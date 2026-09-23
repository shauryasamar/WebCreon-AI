import inspect
from typing import Any, Callable, Dict, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlmodel import Session
from db.database import engine
from services.ai_credit_service import (
    InsufficientCreditsError,
    commit_credits,
    release_credits,
    reserve_credits,
)

# Configurable Credit Cost Lookup Table per Feature
FEATURE_CREDIT_COSTS: Dict[str, int] = {
    "product_description_gen": 1,
    "bulk_image_gen": 5,
    "analytics_summary": 2,
    "seo_optimization": 1,
    "copilot_chat": 1,
    "store_generation": 5,
    "default": 1,
}

# Configurable conversion factor: 1 credit per ~2,000 tokens (or tuned per model)
TOKENS_PER_CREDIT = 2000


def get_feature_credit_cost(feature_name: str) -> int:
    """Returns estimated credits for a feature from the lookup table."""
    clean_name = (feature_name or "").lower().strip()
    return FEATURE_CREDIT_COSTS.get(clean_name, FEATURE_CREDIT_COSTS["default"])


def convert_tokens_to_credits(total_tokens: int, feature_name: str) -> int:
    """Converts raw input+output token count to internal credit units."""
    if total_tokens <= 0:
        return get_feature_credit_cost(feature_name)
    credits = max(1, round(total_tokens / TOKENS_PER_CREDIT))
    return credits


def extract_token_metadata(result: Any) -> Dict[str, Any]:
    """Extracts token counts and model info from LLM provider responses."""
    meta: Dict[str, Any] = {
        "input_tokens": None,
        "output_tokens": None,
        "total_tokens": None,
        "model": None,
        "provider_request_id": None,
        "usage_mode": "FALLBACK_ESTIMATE",
    }

    if result is None:
        return meta

    # Check LangChain LLMResult / AIMessage
    if hasattr(result, "response_metadata") and isinstance(result.response_metadata, dict):
        usage = result.response_metadata.get("token_usage") or result.response_metadata.get("usage")
        if usage and isinstance(usage, dict):
            meta["input_tokens"] = usage.get("prompt_tokens") or usage.get("input_tokens")
            meta["output_tokens"] = usage.get("completion_tokens") or usage.get("output_tokens")
            meta["total_tokens"] = usage.get("total_tokens")
            meta["usage_mode"] = "EXACT_TOKEN_METADATA"
        meta["model"] = result.response_metadata.get("model_name") or result.response_metadata.get("model")

    # Check dict payload
    elif isinstance(result, dict):
        usage = result.get("usage") or result.get("token_usage")
        if usage and isinstance(usage, dict):
            meta["input_tokens"] = usage.get("prompt_tokens") or usage.get("input_tokens")
            meta["output_tokens"] = usage.get("completion_tokens") or usage.get("output_tokens")
            meta["total_tokens"] = usage.get("total_tokens")
            meta["usage_mode"] = "EXACT_TOKEN_METADATA"
        meta["model"] = result.get("model")

    return meta


async def call_ai_with_metering(
    admin_id: UUID,
    website_id: Optional[UUID],
    feature_name: str,
    ai_call_fn: Callable[[], Any],
    idempotency_key: Optional[str] = None,
) -> Any:
    """
    Wraps an AI feature call with two-phase metering:
    1. Reserves estimated credits atomically.
    2. Executes provider call.
    3. Commits actual token usage and refunds unused reservation.
    4. On failure, releases reservation back to active batches.
    """
    key = idempotency_key or f"ai_req_{uuid4().hex}"
    estimated_cost = get_feature_credit_cost(feature_name)

    # Phase 1: Reserve credits
    with Session(engine) as db:
        try:
            reservation = reserve_credits(
                session=db,
                admin_id=admin_id,
                website_id=website_id,
                feature_name=feature_name,
                estimated_credits=estimated_cost,
                idempotency_key=key,
            )
            res_id = reservation.reservation_id
        except InsufficientCreditsError as ice:
            raise HTTPException(
                status_code=402,
                detail={
                    "error_code": "INSUFFICIENT_AI_CREDITS",
                    "message": "You've used all your AI credits for this 30-day cycle. Upgrade your plan or wait for cycle renewal for more credits.",
                },
            )

    # Phase 2: Execute AI Provider Call
    try:
        if inspect.iscoroutinefunction(ai_call_fn) or inspect.isawaitable(ai_call_fn):
            result = await ai_call_fn()
        else:
            result = ai_call_fn()
    except Exception as exc:
        # Provider call failed: release reservation in full
        with Session(engine) as db:
            release_credits(db, res_id, error_message=str(exc))
        raise exc

    # Phase 3: Commit actual credits
    meta = extract_token_metadata(result)
    actual_tokens = meta.get("total_tokens")
    if actual_tokens:
        actual_credits = convert_tokens_to_credits(actual_tokens, feature_name)
    else:
        actual_credits = estimated_cost

    with Session(engine) as db:
        commit_credits(
            session=db,
            reservation_id=res_id,
            actual_credits=actual_credits,
            provider_metadata=meta,
        )

    return result
