from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlmodel import Session, select, col
from models import (
    AICreditBatch,
    AICreditBatchStatus,
    AICreditBatchType,
    AICreditReservation,
    AICreditUsageEvent,
    utc_now,
)


CYCLE_DURATION_DAYS = 30
FREE_BASE_ALLOCATION = 20
STARTER_ALLOCATION = 100
PRO_ALLOCATION = 500


def ensure_utc(dt: datetime) -> datetime:
    """Ensures datetime is timezone-aware in UTC. Rejects naive datetimes."""
    if dt is None:
        return utc_now()
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        raise ValueError("Naive datetime rejected. All billing timestamps must be timezone-aware UTC.")
    return dt.astimezone(timezone.utc)


def calculate_cycle_end(start: datetime) -> datetime:
    """Calculates strict fixed 30-day cycle end (exactly 30 * 24 hours)."""
    start_utc = ensure_utc(start)
    return start_utc + timedelta(days=CYCLE_DURATION_DAYS)


class InsufficientCreditsError(Exception):
    def __init__(self, message: str = "Insufficient AI credits remaining in account pool"):
        super().__init__(message)
        self.message = message


def ensure_free_base_batch(
    session: Session,
    admin_id: UUID,
    cycle_start_at: Optional[datetime] = None,
) -> AICreditBatch:
    """
    Ensures the Admin has an active FREE_BASE batch for the current 30-day cycle.
    Enforces UNIQUE(admin_id, batch_type, cycle_start_at) at DB level.
    """
    now = utc_now()
    start_dt = ensure_utc(cycle_start_at or now)
    expiry_dt = calculate_cycle_end(start_dt)

    # Check for active existing free base batch that has not expired
    existing = session.exec(
        select(AICreditBatch).where(
            AICreditBatch.admin_id == admin_id,
            AICreditBatch.batch_type == AICreditBatchType.FREE_BASE.value,
            AICreditBatch.status == AICreditBatchStatus.ACTIVE.value,
            AICreditBatch.expiry_date > now,
        ).order_by(AICreditBatch.expiry_date.desc())
    ).first()

    if existing:
        return existing

    # Create new Free base batch for the cycle
    batch = AICreditBatch(
        id=uuid4(),
        admin_id=admin_id,
        source_website_id=None,
        batch_type=AICreditBatchType.FREE_BASE.value,
        cycle_start_at=start_dt,
        allocated_amount=FREE_BASE_ALLOCATION,
        remaining_amount=FREE_BASE_ALLOCATION,
        expiry_date=expiry_dt,
        status=AICreditBatchStatus.ACTIVE.value,
        created_at=now,
    )
    try:
        session.add(batch)
        session.commit()
        session.refresh(batch)
        return batch
    except Exception:
        session.rollback()
        # In case of concurrent creation race, fetch the newly created one
        return session.exec(
            select(AICreditBatch).where(
                AICreditBatch.admin_id == admin_id,
                AICreditBatch.batch_type == AICreditBatchType.FREE_BASE.value,
            ).order_by(AICreditBatch.created_at.desc())
        ).first()


def create_batch_on_upgrade_or_renewal(
    session: Session,
    admin_id: UUID,
    source_website_id: UUID,
    plan: str,
    cycle_start_at: Optional[datetime] = None,
) -> Optional[AICreditBatch]:
    """Creates a new 30-day AI credit batch upon plan upgrade or renewal."""
    plan_upper = (plan or "").upper()
    if plan_upper == "FREE":
        return ensure_free_base_batch(session, admin_id, cycle_start_at)

    allocation = PRO_ALLOCATION if plan_upper == "PRO" else STARTER_ALLOCATION
    batch_type = AICreditBatchType.PAID_PRO.value if plan_upper == "PRO" else AICreditBatchType.PAID_STARTER.value

    start_dt = ensure_utc(cycle_start_at or utc_now())
    expiry_dt = calculate_cycle_end(start_dt)
    now = utc_now()

    batch = AICreditBatch(
        id=uuid4(),
        admin_id=admin_id,
        source_website_id=source_website_id,
        batch_type=batch_type,
        cycle_start_at=start_dt,
        allocated_amount=allocation,
        remaining_amount=allocation,
        expiry_date=expiry_dt,
        status=AICreditBatchStatus.ACTIVE.value,
        created_at=now,
    )
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return batch


def get_account_credit_balance(session: Session, admin_id: UUID) -> Dict[str, Any]:
    """
    Returns account-wide pooled AI credit balance:
    total_remaining, total_monthly_allocation, and individual active batches with expiry.
    """
    ensure_free_base_batch(session, admin_id)
    now = utc_now()

    # Query all active batches where expiry_date > now
    active_batches = session.exec(
        select(AICreditBatch).where(
            AICreditBatch.admin_id == admin_id,
            AICreditBatch.status == AICreditBatchStatus.ACTIVE.value,
            AICreditBatch.expiry_date > now,
        ).order_by(AICreditBatch.expiry_date.asc())
    ).all()

    total_remaining = sum(b.remaining_amount for b in active_batches)
    total_allocated = sum(b.allocated_amount for b in active_batches)

    batches_data = [
        {
            "batch_id": str(b.id),
            "batch_type": b.batch_type,
            "source_website_id": str(b.source_website_id) if b.source_website_id else None,
            "allocated": b.allocated_amount,
            "remaining": b.remaining_amount,
            "cycle_start_at": b.cycle_start_at.isoformat() if b.cycle_start_at else None,
            "expiry_date": b.expiry_date.isoformat(),
            "status": b.status,
            "is_free_base": b.batch_type == AICreditBatchType.FREE_BASE.value,
        }
        for b in active_batches
    ]

    return {
        "admin_id": str(admin_id),
        "total_remaining": total_remaining,
        "total_monthly_allocation": total_allocated,
        "batches_count": len(active_batches),
        "batches": batches_data,
        "cycle_policy": "Strict 30-day fixed cycle (30 x 24h UTC). Unused credits lapse at batch expiry.",
    }


def reserve_credits(
    session: Session,
    admin_id: UUID,
    website_id: Optional[UUID],
    feature_name: str,
    estimated_credits: int,
    idempotency_key: str,
) -> AICreditReservation:
    """
    Two-Phase Metering - Phase 1:
    Atomically reserves estimated credits by locking active batches in FIFO order.
    """
    now = utc_now()

    # Idempotency check on existing reservation
    existing = session.exec(
        select(AICreditReservation).where(
            AICreditReservation.idempotency_key == idempotency_key
        )
    ).first()
    if existing:
        return existing

    # Lock eligible active batches ordered by expiry_date ASC
    eligible_batches = session.exec(
        select(AICreditBatch).where(
            AICreditBatch.admin_id == admin_id,
            AICreditBatch.status == AICreditBatchStatus.ACTIVE.value,
            AICreditBatch.expiry_date > now,
            AICreditBatch.remaining_amount > 0,
        ).order_by(AICreditBatch.expiry_date.asc()).with_for_update()
    ).all()

    total_available = sum(b.remaining_amount for b in eligible_batches)
    if total_available < estimated_credits:
        raise InsufficientCreditsError(
            f"Insufficient AI credits. Required: {estimated_credits}, Available: {total_available}"
        )

    # FIFO deduction across batches
    needed = estimated_credits
    debit_details: List[Dict[str, Any]] = []

    for batch in eligible_batches:
        if needed <= 0:
            break
        deduct = min(batch.remaining_amount, needed)
        batch.remaining_amount -= deduct
        needed -= deduct
        debit_details.append({
            "batch_id": str(batch.id),
            "amount": deduct,
        })
        session.add(batch)

    reservation = AICreditReservation(
        reservation_id=uuid4(),
        idempotency_key=idempotency_key,
        admin_id=admin_id,
        website_id=website_id,
        feature_name=feature_name,
        estimated_credits=estimated_credits,
        reserved_credits=estimated_credits,
        committed_credits=0,
        released_credits=0,
        batch_allocation_details=debit_details,
        status="RESERVED",
        created_at=now,
        expires_at=now + timedelta(minutes=10),
    )
    session.add(reservation)
    session.commit()
    session.refresh(reservation)
    return reservation


def commit_credits(
    session: Session,
    reservation_id: UUID,
    actual_credits: int,
    provider_metadata: Optional[Dict[str, Any]] = None,
) -> AICreditReservation:
    """
    Two-Phase Metering - Phase 2 (Commit):
    Charges actual credits. If actual < reserved, refunds difference back to original batches in reverse order.
    """
    now = utc_now()
    reservation = session.exec(
        select(AICreditReservation).where(
            AICreditReservation.reservation_id == reservation_id
        ).with_for_update()
    ).first()

    if not reservation:
        raise ValueError(f"Reservation {reservation_id} not found")

    if reservation.status == "COMMITTED":
        return reservation

    reserved = reservation.reserved_credits
    # Clamp actual credits between 0 and reserved
    actual = max(0, min(actual_credits, reserved))
    refund = reserved - actual

    if refund > 0 and reservation.batch_allocation_details:
        # Refund unused credits back to original batches in reverse debit order
        remaining_refund = refund
        for debit in reversed(reservation.batch_allocation_details):
            if remaining_refund <= 0:
                break
            b_id = UUID(debit["batch_id"])
            debited_amt = debit["amount"]
            refund_to_batch = min(remaining_refund, debited_amt)

            batch = session.get(AICreditBatch, b_id)
            if batch:
                batch.remaining_amount = min(batch.allocated_amount, batch.remaining_amount + refund_to_batch)
                session.add(batch)
            remaining_refund -= refund_to_batch

    meta = provider_metadata or {}
    reservation.committed_credits = actual
    reservation.released_credits = refund
    reservation.status = "COMMITTED"
    reservation.committed_at = now
    reservation.provider_request_id = meta.get("provider_request_id")
    reservation.provider_model = meta.get("model")
    reservation.input_tokens = meta.get("input_tokens")
    reservation.output_tokens = meta.get("output_tokens")
    reservation.total_tokens = meta.get("total_tokens")
    reservation.usage_mode = meta.get("usage_mode", "EXACT_TOKEN_METADATA")

    # Record usage event
    usage_event = AICreditUsageEvent(
        id=uuid4(),
        admin_id=reservation.admin_id,
        website_id=reservation.website_id,
        batch_id=UUID(reservation.batch_allocation_details[0]["batch_id"]) if reservation.batch_allocation_details else None,
        amount_deducted=actual,
        feature_used=reservation.feature_name,
        idempotency_key=reservation.idempotency_key,
        provider_request_id=meta.get("provider_request_id"),
        provider_model=meta.get("model"),
        input_tokens=meta.get("input_tokens"),
        output_tokens=meta.get("output_tokens"),
        total_tokens=meta.get("total_tokens"),
        calculated_credit_amount=actual,
        event_status="COMMITTED",
        created_at=now,
    )
    session.add(reservation)
    session.add(usage_event)
    session.commit()
    session.refresh(reservation)
    return reservation


def release_credits(
    session: Session,
    reservation_id: UUID,
    error_message: Optional[str] = None,
) -> AICreditReservation:
    """
    Two-Phase Metering - Phase 2 (Release):
    On AI provider call failure, releases 100% of reserved credits back to the original batches.
    """
    now = utc_now()
    reservation = session.exec(
        select(AICreditReservation).where(
            AICreditReservation.reservation_id == reservation_id
        ).with_for_update()
    ).first()

    if not reservation:
        raise ValueError(f"Reservation {reservation_id} not found")

    if reservation.status in ("RELEASED", "COMMITTED"):
        return reservation

    if reservation.batch_allocation_details:
        for debit in reservation.batch_allocation_details:
            b_id = UUID(debit["batch_id"])
            debited_amt = debit["amount"]
            batch = session.get(AICreditBatch, b_id)
            if batch:
                batch.remaining_amount = min(batch.allocated_amount, batch.remaining_amount + debited_amt)
                session.add(batch)

    reservation.released_credits = reservation.reserved_credits
    reservation.committed_credits = 0
    reservation.status = "RELEASED"
    reservation.released_at = now

    # Record usage event marked RELEASED/FAILED
    usage_event = AICreditUsageEvent(
        id=uuid4(),
        admin_id=reservation.admin_id,
        website_id=reservation.website_id,
        batch_id=UUID(reservation.batch_allocation_details[0]["batch_id"]) if reservation.batch_allocation_details else None,
        amount_deducted=0,
        feature_used=reservation.feature_name,
        idempotency_key=reservation.idempotency_key,
        calculated_credit_amount=0,
        event_status="RELEASED",
        error_message=error_message or "Provider call failed - reservation released",
        created_at=now,
    )
    session.add(reservation)
    session.add(usage_event)
    session.commit()
    session.refresh(reservation)
    return reservation


def expire_batches_job(session: Session) -> Dict[str, Any]:
    """
    Distributed Cron Job:
    Scans for ACTIVE batches where expiry_date <= now().
    Marks them EXPIRED_LAPSED (if remaining > 0) or EXPIRED_FULLY_USED (if remaining == 0).
    Lapsed credits are removed naturally without carryover.
    """
    now = utc_now()
    expired_batches = session.exec(
        select(AICreditBatch).where(
            AICreditBatch.status == AICreditBatchStatus.ACTIVE.value,
            AICreditBatch.expiry_date <= now,
        ).with_for_update()
    ).all()

    lapsed_count = 0
    fully_used_count = 0
    total_lapsed_credits = 0

    for batch in expired_batches:
        if batch.remaining_amount > 0:
            batch.status = AICreditBatchStatus.EXPIRED_LAPSED.value
            total_lapsed_credits += batch.remaining_amount
            lapsed_count += 1
        else:
            batch.status = AICreditBatchStatus.EXPIRED_FULLY_USED.value
            fully_used_count += 1
        session.add(batch)

    session.commit()
    return {
        "timestamp": now.isoformat(),
        "batches_processed": len(expired_batches),
        "lapsed_count": lapsed_count,
        "fully_used_count": fully_used_count,
        "total_lapsed_credits": total_lapsed_credits,
    }
