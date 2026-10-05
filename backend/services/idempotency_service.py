"""
WebCreon AI Store Co-Pilot - Idempotency & Operation Management Service
Guarantees exactly-once execution for mutations across retries, reconnects, and SSE fallbacks.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from uuid import UUID


_OPERATIONS_STORE: Dict[str, Dict[str, Any]] = {}


def _compute_hash(payload: Any) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def reserve_operation(
    operation_id: str | UUID,
    site_id: str | UUID,
    user_id: str | UUID,
    action_type: str,
    payload: Any = None,
    idempotency_key: Optional[str] = None,
) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """
    Reserves an operation slot.
    Returns:
    (can_proceed, cached_result, conflict_or_in_progress_reason)
    """
    op_key = str(idempotency_key or operation_id)
    req_hash = _compute_hash(payload) if payload is not None else ""

    if op_key in _OPERATIONS_STORE:
        existing = _OPERATIONS_STORE[op_key]
        if existing["site_id"] != str(site_id):
            return False, None, "Operation key belongs to a different site context"

        # Check payload match
        if existing.get("request_hash") and req_hash and existing["request_hash"] != req_hash:
            return False, None, "Idempotency conflict: same key reused with different request payload"

        if existing["status"] == "completed":
            return False, existing["result"], None  # Return cached completed result
        elif existing["status"] == "in_progress":
            return False, None, "Operation is currently in-progress"
        elif existing["status"] == "failed":
            # Allow retry on failed operation
            pass

    # Reserve operation
    _OPERATIONS_STORE[op_key] = {
        "operation_id": str(operation_id),
        "idempotency_key": idempotency_key,
        "site_id": str(site_id),
        "user_id": str(user_id),
        "action_type": action_type,
        "request_hash": req_hash,
        "status": "in_progress",
        "result": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }
    return True, None, None


def complete_operation(
    operation_id: str | UUID,
    result: Dict[str, Any],
    idempotency_key: Optional[str] = None,
) -> None:
    """Marks operation as completed with cached result."""
    op_key = str(idempotency_key or operation_id)
    if op_key in _OPERATIONS_STORE:
        _OPERATIONS_STORE[op_key]["status"] = "completed"
        _OPERATIONS_STORE[op_key]["result"] = result
        _OPERATIONS_STORE[op_key]["completed_at"] = datetime.now(timezone.utc).isoformat()


def fail_operation(
    operation_id: str | UUID,
    error: str,
    idempotency_key: Optional[str] = None,
) -> None:
    """Marks operation as failed."""
    op_key = str(idempotency_key or operation_id)
    if op_key in _OPERATIONS_STORE:
        _OPERATIONS_STORE[op_key]["status"] = "failed"
        _OPERATIONS_STORE[op_key]["error"] = error
        _OPERATIONS_STORE[op_key]["completed_at"] = datetime.now(timezone.utc).isoformat()
