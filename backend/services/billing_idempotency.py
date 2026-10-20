import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Tuple
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlmodel import Session, select
from models import BillingIdempotencyKey, utc_now


def canonical_fingerprint(data: Any) -> str:
    """Generates a stable, sorted SHA-256 fingerprint for request payloads."""
    if data is None:
        return "EMPTY_PAYLOAD"
    try:
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    except Exception:
        return hashlib.sha256(str(data).encode("utf-8")).hexdigest()


class IdempotencyReusedError(HTTPException):
    def __init__(self, message: str = "Idempotency key was previously used with a different request payload"):
        super().__init__(
            status_code=409,
            detail={
                "error_code": "IDEMPOTENCY_KEY_REUSED",
                "message": message,
            },
        )


class OperationInProgressError(HTTPException):
    def __init__(self, message: str = "A billing operation with this idempotency key is currently in progress"):
        super().__init__(
            status_code=409,
            detail={
                "error_code": "OPERATION_IN_PROGRESS",
                "message": message,
            },
        )


def check_and_start_idempotency(
    session: Session,
    idempotency_key: Optional[str],
    operation_type: str,
    admin_id: Optional[UUID],
    website_id: Optional[UUID],
    request_data: Any,
) -> Tuple[Optional[BillingIdempotencyKey], Optional[Dict[str, Any]]]:
    """
    Checks if an operation has already been executed or is in progress.
    Returns (idempotency_record, cached_response).
    If cached_response is returned, the caller can immediately return the cached result.
    """
    if not idempotency_key:
        return None, None

    fingerprint = canonical_fingerprint(request_data)

    existing = session.exec(
        select(BillingIdempotencyKey).where(
            BillingIdempotencyKey.operation_type == operation_type,
            BillingIdempotencyKey.idempotency_key == idempotency_key,
        )
    ).first()

    if existing:
        # Check payload fingerprint mismatch
        if existing.request_fingerprint != fingerprint:
            raise IdempotencyReusedError(
                f"Idempotency key '{idempotency_key}' was previously used with different request parameters."
            )

        if existing.status == "SUCCEEDED":
            return existing, {
                "cached": True,
                "status_code": existing.response_status or 200,
                "data": existing.response_body or {},
            }
        elif existing.status == "STARTED":
            # Check timeout for abandoned operation (older than 2 minutes)
            now = utc_now()
            if existing.created_at and (now - existing.created_at) > timedelta(minutes=2):
                existing.status = "FAILED"
                existing.response_body = {"error": "Previous attempt timed out, recovering"}
                session.add(existing)
                session.commit()
            else:
                raise OperationInProgressError()

    record = BillingIdempotencyKey(
        id=uuid4(),
        admin_id=admin_id,
        website_id=website_id,
        idempotency_key=idempotency_key,
        operation_type=operation_type,
        request_fingerprint=fingerprint,
        status="STARTED",
        created_at=utc_now(),
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record, None


def complete_idempotency(
    session: Session,
    record: Optional[BillingIdempotencyKey],
    response_data: Dict[str, Any],
    response_status: int = 200,
) -> None:
    if not record:
        return
    record.status = "SUCCEEDED"
    record.response_status = response_status
    record.response_body = response_data
    record.completed_at = utc_now()
    session.add(record)
    session.commit()


def fail_idempotency(
    session: Session,
    record: Optional[BillingIdempotencyKey],
    error_message: str,
    response_status: int = 400,
) -> None:
    if not record:
        return
    record.status = "FAILED"
    record.response_status = response_status
    record.response_body = {"error": error_message}
    record.completed_at = utc_now()
    session.add(record)
    session.commit()
