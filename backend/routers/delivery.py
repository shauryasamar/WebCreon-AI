import hashlib
import hmac
import logging
import os
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from auth_middleware import authenticate_admin, authenticate_rider, enforce_site_ownership
from auth_utils import hash_password, verify_password, create_rider_token
from crypto_utils import decrypt_string, encrypt_string
from db.database import get_session
from models import (
    Admin,
    AdminSite,
    DeliveryAgent,
    DeliverySettings,
    Order,
    OrderItem,
    OrderStatusHistory,
    ReturnItem,
    ReturnRequest,
    ReturnStatusHistory,
    Shipment,
    Site,
    User,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/delivery", tags=["delivery"])


# ──────────────────────────────────────────────────────────────────────────────
# Helpers & Security / Rate Limiting
# ──────────────────────────────────────────────────────────────────────────────

_DELIVERY_SECRET = os.getenv("DELIVERY_TOKEN_SECRET", "delivery-secret-fallback-please-change")

# Thread-safe in-memory rate limiter for rider login brute-force prevention
_RIDER_LOGIN_ATTEMPTS: dict[str, list[float]] = {}
_RIDER_LOGIN_LOCK = threading.Lock()


def _check_rider_login_rate_limit(phone_key: str) -> None:
    now_ts = time.time()
    window_sec = 600  # 10 minutes sliding window
    max_attempts = 5
    with _RIDER_LOGIN_LOCK:
        timestamps = [t for t in _RIDER_LOGIN_ATTEMPTS.get(phone_key, []) if now_ts - t < window_sec]
        if len(timestamps) >= max_attempts:
            remaining_mins = max(1, int((window_sec - (now_ts - timestamps[0])) / 60))
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed login attempts for this number. Account temporarily locked for {remaining_mins} minute(s)."
            )
        _RIDER_LOGIN_ATTEMPTS[phone_key] = timestamps


def _record_failed_rider_login(phone_key: str) -> None:
    now_ts = time.time()
    with _RIDER_LOGIN_LOCK:
        attempts = _RIDER_LOGIN_ATTEMPTS.setdefault(phone_key, [])
        attempts.append(now_ts)


def _clear_rider_login_attempts(phone_key: str) -> None:
    with _RIDER_LOGIN_LOCK:
        _RIDER_LOGIN_ATTEMPTS.pop(phone_key, None)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _sign_agent_token(shipment_id: UUID, agent_id: UUID) -> str:
    """Generate a short HMAC token for agent PWA links (no auth required)."""
    raw = f"{shipment_id}:{agent_id}".encode()
    return hmac.new(_DELIVERY_SECRET.encode(), raw, hashlib.sha256).hexdigest()[:32]


def _get_site_or_404(session: Session, site_id: UUID) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


def _get_settings_or_default(session: Session, site_id: UUID) -> DeliverySettings:
    settings = session.get(DeliverySettings, site_id)
    if not settings:
        settings = DeliverySettings(site_id=site_id)
    return settings


def _get_admin_site_id(admin: dict, session: Session) -> UUID:
    """Extract site_id from admin context (used in non-path-param endpoints)."""
    admin_id = UUID(admin["adminId"])
    link = session.exec(select(AdminSite).where(AdminSite.admin_id == admin_id)).first()
    if not link:
        raise HTTPException(status_code=403, detail="Admin has no site")
    return link.site_id


def _mark_order_delivered(order: Order, session: Session, auto_commit: bool = True) -> None:
    """Shared helper: mark order delivered, update order items, and start the 48-h escrow window."""
    now = _utc_now()
    order.status = "delivered"
    order.delivered_at = now
    order.return_window_closes_at = now + timedelta(hours=48)  # type: ignore[attr-defined]
    order.escrow_status = "held"
    session.add(order)

    # Update all non-cancelled order items to delivered and set returnable_quantity
    order_items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    for item in order_items:
        if item.status != "cancelled":
            item.status = "delivered"
            from models import ReturnRequest, ReturnItem
            ret_items = session.exec(
                select(ReturnItem).where(ReturnItem.order_item_id == item.id)
            ).all()
            active_ret_qty = 0
            for ri in ret_items:
                req = session.get(ReturnRequest, ri.return_request_id)
                if req and req.status != "rejected":
                    if req.status in ("received", "inspected", "refunded", "closed"):
                        actual_qty = ri.quantity_received
                    else:
                        actual_qty = ri.quantity_approved if (ri.quantity_approved and ri.quantity_approved > 0) else ri.quantity_requested
                    active_ret_qty += int(actual_qty or 0)
            item.returnable_quantity = max(0, item.quantity - active_ret_qty)
            item.updated_at = now
            session.add(item)

    history = OrderStatusHistory(
        order_id=order.id,
        status="delivered",
        changed_by_type="system",
    )
    session.add(history)
    if auto_commit:
        session.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ──────────────────────────────────────────────────────────────────────────────

class DeliverySettingsUpdate(BaseModel):
    delivery_mode: Optional[str] = None               # own_agent | shiprocket | hybrid | manual
    own_delivery_radius_km: Optional[float] = None
    shiprocket_email: Optional[str] = None
    shiprocket_password: Optional[str] = None          # plain-text; stored encrypted
    default_courier_preference: Optional[str] = None
    auto_assign_courier: Optional[bool] = None
    sender_name: Optional[str] = None
    sender_phone: Optional[str] = None
    sender_address: Optional[str] = None
    sender_pincode: Optional[str] = None
    sender_city: Optional[str] = None
    sender_state: Optional[str] = None
    default_weight_grams: Optional[int] = None


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    phone: str = Field(..., min_length=10, max_length=30)
    password: Optional[str] = Field(default=None, min_length=4, max_length=64)
    vehicle_type: Optional[str] = "bike"


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    password: Optional[str] = Field(default=None, min_length=4, max_length=64)
    vehicle_type: Optional[str] = None
    is_active: Optional[bool] = None


class AgentResetPassword(BaseModel):
    password: str = Field(..., min_length=4, max_length=64)


class AgentCashSettlement(BaseModel):
    amount: Optional[float] = None  # None or 0 means settle full cash_in_hand
    notes: Optional[str] = None


class RiderLoginRequest(BaseModel):
    site_slug_or_id: str
    phone: str
    password: str


class RiderTaskStatusUpdate(BaseModel):
    action: str   # accept | reject | decline | release | picked_up | out_for_delivery | delivered | reschedule | failed
    proof_url: Optional[str] = None
    notes: Optional[str] = None
    reason: Optional[str] = None
    rescheduled_at: Optional[str] = None
    picked_items: Optional[dict[str, int]] = None  # { item_id: picked_quantity }
    delivery_otp: Optional[str] = None


class AgentStatusUpdate(BaseModel):
    """Called by the agent PWA — legacy token-based or direct."""
    action: str   # accept | picked_up | delivered | failed
    proof_url: Optional[str] = None
    notes: Optional[str] = None
    delivery_otp: Optional[str] = None


class ManualDispatchRequest(BaseModel):
    mode: str = "manual"          # own_agent | shiprocket | manual
    agent_id: Optional[str] = None
    courier_name: Optional[str] = None
    awb_number: Optional[str] = None
    tracking_url: Optional[str] = None
    estimated_delivery_at: Optional[str] = None   # ISO datetime string
    weight_grams: Optional[int] = None
    weight_kg: Optional[float] = None
    force_reassign: Optional[bool] = False


# ──────────────────────────────────────────────────────────────────────────────
# Delivery Settings endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/settings/{site_id}")
def get_delivery_settings(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    settings = _get_settings_or_default(session, site_id)
    # Never expose the encrypted password or cached token
    return {
        "site_id": str(settings.site_id),
        "delivery_mode": settings.delivery_mode,
        "own_delivery_radius_km": settings.own_delivery_radius_km,
        "shiprocket_email": settings.shiprocket_email,
        "shiprocket_connected": bool(settings.shiprocket_email and settings.shiprocket_password_encrypted),
        "default_courier_preference": settings.default_courier_preference,
        "auto_assign_courier": settings.auto_assign_courier,
        "sender_name": settings.sender_name,
        "sender_phone": settings.sender_phone,
        "sender_address": settings.sender_address,
        "sender_pincode": settings.sender_pincode,
        "sender_city": settings.sender_city,
        "sender_state": settings.sender_state,
        "default_weight_grams": settings.default_weight_grams,
    }


@router.put("/settings/{site_id}")
def update_delivery_settings(
    site_id: UUID,
    body: DeliverySettingsUpdate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    settings = _get_settings_or_default(session, site_id)

    if body.delivery_mode is not None:
        valid_modes = {"own_agent", "shiprocket", "hybrid", "manual"}
        if body.delivery_mode not in valid_modes:
            raise HTTPException(400, f"Invalid delivery_mode. Valid: {valid_modes}")
        settings.delivery_mode = body.delivery_mode

    if body.own_delivery_radius_km is not None:
        settings.own_delivery_radius_km = body.own_delivery_radius_km

    if body.shiprocket_email is not None:
        settings.shiprocket_email = body.shiprocket_email
        # Invalidate old token if email changes
        settings.shiprocket_token = None
        settings.shiprocket_token_expires_at = None

    if body.shiprocket_password is not None and body.shiprocket_password.strip():
        settings.shiprocket_password_encrypted = encrypt_string(body.shiprocket_password)
        # Reset token so next dispatch re-authenticates
        settings.shiprocket_token = None
        settings.shiprocket_token_expires_at = None

    if body.default_courier_preference is not None:
        settings.default_courier_preference = body.default_courier_preference
    if body.auto_assign_courier is not None:
        settings.auto_assign_courier = body.auto_assign_courier
    if body.sender_name is not None:
        settings.sender_name = body.sender_name
    if body.sender_phone is not None:
        settings.sender_phone = body.sender_phone
    if body.sender_address is not None:
        settings.sender_address = body.sender_address
    if body.sender_pincode is not None:
        settings.sender_pincode = body.sender_pincode
    if body.sender_city is not None:
        settings.sender_city = body.sender_city
    if body.sender_state is not None:
        settings.sender_state = body.sender_state
    if body.default_weight_grams is not None:
        settings.default_weight_grams = max(1, body.default_weight_grams)

    session.add(settings)
    session.commit()
    session.refresh(settings)
    return {"ok": True, "delivery_mode": settings.delivery_mode}


@router.post("/settings/{site_id}/test-shiprocket")
def test_shiprocket_connection(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """Test Shiprocket credentials by fetching a fresh token."""
    settings = _get_settings_or_default(session, site_id)
    if not settings.shiprocket_email or not settings.shiprocket_password_encrypted:
        raise HTTPException(400, "Shiprocket credentials not configured")

    try:
        from services.shiprocket import ShiprocketClient, ShiprocketError
        password = decrypt_string(settings.shiprocket_password_encrypted)
        token = ShiprocketClient.get_token(settings.shiprocket_email, password)
        # Cache the token
        settings.shiprocket_token = token
        settings.shiprocket_token_expires_at = _utc_now() + timedelta(hours=238)
        session.add(settings)
        session.commit()
        return {"ok": True, "message": "Connected to Shiprocket successfully ✅"}
    except Exception as exc:
        raise HTTPException(400, f"Shiprocket connection failed: {exc}")


# ──────────────────────────────────────────────────────────────────────────────
# Agent CRUD
# ──────────────────────────────────────────────────────────────────────────────

def _sync_rider_stats(agent: DeliveryAgent, session: Session) -> tuple[int, int]:
    """
    Computes exact real-time (current_active_orders, total_delivered_orders) from Shipment and ReturnRequest tables.
    Optimized to index-scanned statuses only for high-speed execution at scale.
    """
    # 1. Forward Deliveries
    active_forward = session.exec(
        select(Shipment).where(
            Shipment.agent_id == agent.id,
            Shipment.status.in_(["assigned", "accepted", "out_for_delivery", "rescheduled"]),
        )
    ).all()

    delivered_forward = session.exec(
        select(Shipment).where(
            Shipment.agent_id == agent.id,
            Shipment.status == "delivered",
        )
    ).all()

    # 2. Reverse Return Pickups (Optimized: Filter to active/delivered_to_hub return requests only)
    relevant_returns = session.exec(
        select(ReturnRequest).where(
            ReturnRequest.site_id == agent.site_id,
            ReturnRequest.pickup_status.in_(["assigned", "accepted", "picked_up", "rescheduled", "delivered_to_hub"]),
        )
    ).all()

    active_returns = [
        r for r in relevant_returns
        if str((r.pickup_details or {}).get("agent_id") or "") == str(agent.id)
        and (r.pickup_status in ["assigned", "accepted", "picked_up", "rescheduled"])
    ]

    completed_returns = [
        r for r in relevant_returns
        if str((r.pickup_details or {}).get("agent_id") or "") == str(agent.id)
        and (r.pickup_status == "delivered_to_hub")
    ]

    real_current_count = len(active_forward) + len(active_returns)
    real_total_delivered = len(delivered_forward) + len(completed_returns)

    if agent.current_order_count != real_current_count or agent.total_deliveries != real_total_delivered:
        agent.current_order_count = real_current_count
        agent.total_deliveries = real_total_delivered
        session.add(agent)
        session.commit()

    return real_current_count, real_total_delivered


@router.get("/agents/{site_id}")
def list_agents(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    agents = session.exec(
        select(DeliveryAgent)
        .where(DeliveryAgent.site_id == site_id)
        .order_by(DeliveryAgent.created_at.desc())
    ).all()

    result = []
    for a in agents:
        curr_cnt, tot_deliv = _sync_rider_stats(a, session)
        result.append({
            "id": str(a.id),
            "name": a.name,
            "phone": a.phone,
            "vehicle_type": getattr(a, "vehicle_type", "bike") or "bike",
            "has_password": bool(a.password_hash),
            "cash_in_hand": float(getattr(a, "cash_in_hand", 0.0) or 0.0),
            "is_active": a.is_active,
            "current_order_count": curr_cnt,
            "total_deliveries": tot_deliv,
            "last_active_at": a.last_active_at.isoformat() if getattr(a, "last_active_at", None) else None,
            "created_at": a.created_at.isoformat(),
        })
    return result


@router.post("/agents/{site_id}", status_code=201)
def create_agent(
    site_id: UUID,
    body: AgentCreate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    clean_phone = "".join(filter(str.isdigit, body.phone or ""))
    if len(clean_phone) == 12 and clean_phone.startswith("91"):
        clean_phone = clean_phone[2:]
    elif len(clean_phone) == 11 and clean_phone.startswith("0"):
        clean_phone = clean_phone[1:]

    if len(clean_phone) != 10:
        raise HTTPException(
            status_code=400,
            detail="Delivery agent mobile number must be exactly 10 digits.",
        )

    # Check if duplicate phone exists for this store
    existing = session.exec(
        select(DeliveryAgent).where(
            DeliveryAgent.site_id == site_id,
            DeliveryAgent.phone == clean_phone,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A delivery agent ({existing.name}) with mobile number {clean_phone} already exists.",
        )

    pwd_hash = hash_password(body.password) if body.password else None
    agent = DeliveryAgent(
        site_id=site_id,
        name=body.name.strip(),
        phone=clean_phone,
        password_hash=pwd_hash,
        vehicle_type=body.vehicle_type or "bike",
    )
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return {
        "id": str(agent.id),
        "name": agent.name,
        "phone": agent.phone,
        "vehicle_type": agent.vehicle_type,
        "has_password": bool(agent.password_hash),
        "is_active": agent.is_active,
        "current_order_count": 0,
        "total_deliveries": 0,
        "created_at": agent.created_at.isoformat(),
    }


@router.patch("/agents/{site_id}/{agent_id}")
def update_agent(
    site_id: UUID,
    agent_id: UUID,
    body: AgentUpdate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    agent = session.exec(
        select(DeliveryAgent)
        .where(DeliveryAgent.id == agent_id, DeliveryAgent.site_id == site_id)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    if body.name is not None:
        agent.name = body.name.strip()
    if body.phone is not None:
        clean_phone = "".join(filter(str.isdigit, body.phone))
        agent.phone = clean_phone if len(clean_phone) >= 10 else body.phone.strip()
    if body.password is not None and body.password.strip():
        agent.password_hash = hash_password(body.password.strip())
    if body.vehicle_type is not None:
        agent.vehicle_type = body.vehicle_type
    if body.is_active is not None:
        agent.is_active = body.is_active

    session.add(agent)
    session.commit()
    return {"ok": True}


@router.post("/agents/{site_id}/{agent_id}/reset-password")
def reset_agent_password(
    site_id: UUID,
    agent_id: UUID,
    body: AgentResetPassword,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    agent = session.exec(
        select(DeliveryAgent)
        .where(DeliveryAgent.id == agent_id, DeliveryAgent.site_id == site_id)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    agent.password_hash = hash_password(body.password)
    session.add(agent)
    session.commit()
    return {"ok": True, "message": f"Password updated for {agent.name}"}


@router.post("/agents/{site_id}/{agent_id}/settle-cash")
def settle_agent_cash(
    site_id: UUID,
    agent_id: UUID,
    body: AgentCashSettlement,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """Admin collects and settles COD cash-in-hand collected by a rider."""
    agent = session.exec(
        select(DeliveryAgent)
        .where(DeliveryAgent.id == agent_id, DeliveryAgent.site_id == site_id)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    current_cash = float(getattr(agent, "cash_in_hand", 0.0) or 0.0)
    if current_cash <= 0:
        return {
            "ok": True,
            "message": "Agent has no outstanding COD cash in hand to settle.",
            "settled_amount": 0.0,
            "remaining_cash": 0.0,
        }

    settle_amount = float(body.amount) if body.amount is not None and body.amount > 0 else current_cash
    settle_amount = min(settle_amount, current_cash)

    new_balance = max(0.0, current_cash - settle_amount)
    agent.cash_in_hand = new_balance
    session.add(agent)
    session.commit()

    return {
        "ok": True,
        "message": f"Successfully collected & settled ₹{settle_amount:.2f} with {agent.name}.",
        "settled_amount": settle_amount,
        "remaining_cash": new_balance,
        "notes": body.notes,
    }


@router.delete("/agents/{site_id}/{agent_id}", status_code=204)
def delete_agent(
    site_id: UUID,
    agent_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    agent = session.exec(
        select(DeliveryAgent)
        .where(DeliveryAgent.id == agent_id, DeliveryAgent.site_id == site_id)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    session.delete(agent)
    session.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Shipment listing
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/shipments/{site_id}")
def list_shipments(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    session: Session = Depends(get_session),
):
    q = select(Shipment).where(Shipment.site_id == site_id)
    if status_filter:
        q = q.where(Shipment.status == status_filter)
    q = q.order_by(Shipment.created_at.desc())
    shipments = session.exec(q).all()
    return [
        {
            "id": str(s.id),
            "order_id": str(s.order_id),
            "mode": s.mode,
            "status": s.status,
            "agent_id": str(s.agent_id) if s.agent_id else None,
            "courier_name": s.courier_name,
            "awb_number": s.awb_number,
            "tracking_url": s.tracking_url,
            "label_url": s.label_url,
            "estimated_delivery_at": s.estimated_delivery_at.isoformat() if s.estimated_delivery_at else None,
            "delivered_at": s.delivered_at.isoformat() if s.delivered_at else None,
            "created_at": s.created_at.isoformat(),
        }
        for s in shipments
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Dispatch — admin manually triggers (or system calls after payment)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/dispatch/{site_id}/{order_id}", status_code=201)
def dispatch_order(
    site_id: UUID,
    order_id: UUID,
    body: ManualDispatchRequest,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Dispatch an order for delivery. Creates a Shipment record.
    Supports own_agent, shiprocket, or manual mode.
    Idempotent: if a non-failed shipment already exists, returns it.
    """
    # Check for existing active shipment
    existing = session.exec(
        select(Shipment)
        .where(
            Shipment.order_id == order_id,
            Shipment.site_id == site_id,
            Shipment.status.not_in(["failed", "rto", "delivered", "cancelled"]),  # type: ignore[attr-defined]
        )
    ).first()

    # Get order
    order = session.exec(
        select(Order).where(Order.id == order_id, Order.site_id == site_id)
    ).first()
    if not order:
        raise HTTPException(404, "Order not found")

    settings = _get_settings_or_default(session, site_id)
    mode = body.mode or settings.delivery_mode or "manual"

    # If already dispatched and NOT a reassignment request
    if existing and not body.force_reassign and not body.agent_id:
        return {
            "shipment_id": str(existing.id),
            "mode": existing.mode,
            "status": existing.status,
            "message": "Already dispatched",
            "agent_link": _build_agent_link(existing) if existing.mode == "own_agent" else None,
            "awb_number": existing.awb_number,
            "label_url": existing.label_url,
        }

    if mode == "own_agent":
        return _dispatch_own_agent(order, site_id, body, settings, session, existing_shipment=existing)
    elif mode == "shiprocket":
        return _dispatch_shiprocket(order, site_id, body, settings, session)
    else:
        # Manual — admin just fills in the tracking info
        return _dispatch_manual(order, site_id, body, session)


def _dispatch_own_agent(
    order: Order,
    site_id: UUID,
    body: ManualDispatchRequest,
    settings: DeliverySettings,
    session: Session,
    existing_shipment: Optional[Shipment] = None,
) -> dict:
    """Assign or reassign an own delivery agent — auto-pick least busy if agent_id not specified."""
    agent_id: Optional[UUID] = None
    if body.agent_id:
        try:
            agent_id = UUID(body.agent_id)
        except ValueError:
            raise HTTPException(400, "Invalid agent_id format")

    if agent_id:
        agent = session.exec(
            select(DeliveryAgent)
            .where(DeliveryAgent.id == agent_id, DeliveryAgent.site_id == site_id, DeliveryAgent.is_active == True)
        ).first()
        if not agent:
            raise HTTPException(404, "Agent not found or inactive")
    else:
        # Auto-assign: least loaded active agent
        agents = session.exec(
            select(DeliveryAgent)
            .where(DeliveryAgent.site_id == site_id, DeliveryAgent.is_active == True)
            .order_by(DeliveryAgent.current_order_count.asc())
        ).all()
        if not agents:
            raise HTTPException(400, "No active delivery agents available. Please add agents in Delivery Settings.")
        agent = agents[0]

    # If reassigning from a previous agent
    was_already_assigned_to_new_agent = (
        existing_shipment
        and existing_shipment.agent_id == agent.id
        and existing_shipment.status not in ["pending", "failed", "cancelled"]
    )

    if existing_shipment:
        if existing_shipment.agent_id and existing_shipment.agent_id != agent.id:
            prev_agent = session.get(DeliveryAgent, existing_shipment.agent_id)
            if prev_agent:
                prev_agent.current_order_count = max(0, prev_agent.current_order_count - 1)
                session.add(prev_agent)

        existing_shipment.agent_id = agent.id
        existing_shipment.delivery_partner_name = agent.name
        existing_shipment.delivery_partner_phone = agent.phone
        existing_shipment.mode = "own_agent"
        existing_shipment.delivery_mode = "own_agent"
        existing_shipment.agent_token = _sign_agent_token(existing_shipment.id, agent.id)
        if existing_shipment.status == "pending":
            existing_shipment.status = "assigned"
        shipment = existing_shipment
        session.add(shipment)
        is_reassign = True
    else:
        # Create shipment
        shipment = Shipment(
            order_id=order.id,
            site_id=site_id,
            mode="own_agent",
            delivery_mode="own_agent",
            status="assigned",
            agent_id=agent.id,
            delivery_partner_name=agent.name,
            delivery_partner_phone=agent.phone,
        )
        shipment.agent_token = _sign_agent_token(shipment.id, agent.id)
        session.add(shipment)
        is_reassign = False
        was_already_assigned_to_new_agent = False

    # FIX: Only increment if this agent didn't already have this order counted.
    # On a self-reassign (same agent re-dispatched), don't double-count.
    if not was_already_assigned_to_new_agent:
        agent.current_order_count += 1
        session.add(agent)

    # Update order status
    if order.status == "placed":
        order.status = "confirmed"
    session.add(order)
    session.add(
        OrderStatusHistory(
            order_id=order.id,
            status=order.status,
            changed_by_type="admin",
            notes=f"Assigned delivery rider {agent.name} ({agent.phone})" if not is_reassign else f"Reassigned delivery rider to {agent.name} ({agent.phone})",
        )
    )

    session.commit()
    session.refresh(shipment)

    agent_link = _build_agent_link(shipment)

    return {
        "shipment_id": str(shipment.id),
        "mode": "own_agent",
        "status": shipment.status,
        "agent_id": str(agent.id),
        "agent_name": agent.name,
        "agent_phone": agent.phone,
        "agent_link": agent_link,
        "message": f"Order assigned to {agent.name}. Share the agent link." if not is_reassign else f"Order reassigned to {agent.name}.",
    }


def _dispatch_shiprocket(
    order: Order,
    site_id: UUID,
    body: ManualDispatchRequest,
    settings: DeliverySettings,
    session: Session,
) -> dict:
    """Create a Shiprocket shipment and assign AWB automatically."""
    if not settings.shiprocket_email or not settings.shiprocket_password_encrypted:
        raise HTTPException(400, "Shiprocket credentials not configured. Go to Delivery Settings.")

    try:
        from services.shiprocket import ShiprocketClient, ShiprocketError, build_order_payload_from_order

        # Refresh token if needed
        token = _get_or_refresh_shiprocket_token(settings, session)

        # Build Shiprocket order payload
        shipping_addr = order.shipping_address or {}
        items = []
        for item in (order.items or []):
            items.append({
                "name": item.get("product_name", "Item"),
                "sku": item.get("product_id", "SKU"),
                "units": int(item.get("quantity", 1)),
                "selling_price": float(item.get("unit_price", 0)),
            })

        order_date = order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else _utc_now().strftime("%Y-%m-%d %H:%M")
        total_weight_kg = (
            float(body.weight_kg)
            if body.weight_kg is not None and body.weight_kg > 0
            else (float(body.weight_grams) / 1000.0)
            if body.weight_grams is not None and body.weight_grams > 0
            else (settings.default_weight_grams * max(1, sum(i.get("quantity", 1) for i in (order.items or [])))) / 1000.0
        )

        billing_shipping = {
            "name": shipping_addr.get("full_name", "Customer"),
            "last_name": "",
            "address": shipping_addr.get("address_line1", ""),
            "city": shipping_addr.get("city", ""),
            "pincode": str(shipping_addr.get("postal_code", "")),
            "state": shipping_addr.get("state", ""),
            "country": "India",
            "email": shipping_addr.get("email", ""),
            "phone": str(shipping_addr.get("mobile_number", "")),
        }

        payload = ShiprocketClient.build_order_payload(
            order_id=f"ORD-{str(order.id)[:8].upper()}",
            order_date=order_date,
            billing=billing_shipping,
            shipping=billing_shipping,
            items=items,
            payment_method="Prepaid" if order.payment_method != "cod" else "COD",
            sub_total=float(order.total),
            weight=max(0.1, round(total_weight_kg, 2)),
            pickup_location=settings.sender_name or "Primary",
        )

        sr_order = ShiprocketClient.create_order(token, payload)
        shipment_id_sr = sr_order.get("shipment_id")
        sr_order_id = sr_order.get("order_id")

        # Assign AWB (auto-selects cheapest courier)
        awb = None
        label_url = None
        courier_name = None
        try:
            awb = ShiprocketClient.assign_awb(token, shipment_id_sr)
            label_url = ShiprocketClient.get_label_url(token, shipment_id_sr)
        except Exception as awb_err:
            logger.warning("AWB assignment failed (non-fatal): %s", awb_err)

        # Build tracking URL
        tracking_url = f"https://shiprocket.co/tracking/{awb}" if awb else None

        # Save shipment record
        shipment = Shipment(
            order_id=order.id,
            site_id=site_id,
            mode="shiprocket",
            status="in_transit" if awb else "assigned",
            courier_order_id=str(sr_order_id),
            awb_number=awb,
            label_url=label_url,
            tracking_url=tracking_url,
            courier_name=courier_name or "Auto-selected",
            shipped_at=_utc_now() if awb else None,
        )
        session.add(shipment)

        order.status = "shipped" if awb else "confirmed"
        order.shipped_at = _utc_now() if awb else None
        session.add(order)
        session.add(OrderStatusHistory(order_id=order.id, status=order.status, changed_by_type="system"))

        session.commit()
        session.refresh(shipment)

        return {
            "shipment_id": str(shipment.id),
            "mode": "shiprocket",
            "status": shipment.status,
            "awb_number": awb,
            "label_url": label_url,
            "tracking_url": tracking_url,
            "message": "Shipment created on Shiprocket" + (" and AWB assigned." if awb else ". AWB pending."),
        }

    except Exception as exc:
        logger.error("Shiprocket dispatch error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Shiprocket dispatch failed: {exc}")


def _dispatch_manual(
    order: Order,
    site_id: UUID,
    body: ManualDispatchRequest,
    session: Session,
) -> dict:
    """Manual shipment — admin fills in courier name, AWB, tracking URL."""
    estimated_at = None
    if body.estimated_delivery_at:
        try:
            estimated_at = datetime.fromisoformat(body.estimated_delivery_at)
        except ValueError:
            pass

    shipment = Shipment(
        order_id=order.id,
        site_id=site_id,
        mode="manual",
        status="in_transit" if body.awb_number else "assigned",
        delivery_partner_name=body.courier_name,
        courier_name=body.courier_name,
        awb_number=body.awb_number,
        tracking_url=body.tracking_url,
        estimated_delivery_at=estimated_at,
        shipped_at=_utc_now() if body.awb_number else None,
    )
    session.add(shipment)

    order.status = "shipped" if body.awb_number else "confirmed"
    if body.awb_number:
        order.shipped_at = _utc_now()
    session.add(order)
    session.add(OrderStatusHistory(order_id=order.id, status=order.status, changed_by_type="admin"))

    session.commit()
    session.refresh(shipment)

    return {
        "shipment_id": str(shipment.id),
        "mode": "manual",
        "status": shipment.status,
        "awb_number": body.awb_number,
        "tracking_url": body.tracking_url,
        "message": "Manual shipment created.",
    }


def _build_agent_link(shipment: Shipment) -> str:
    """Build the agent PWA URL from shipment fields."""
    base = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return f"{base}/agent/delivery/{shipment.id}?token={shipment.agent_token}"


# ──────────────────────────────────────────────────────────────────────────────
# Agent PWA status update endpoint (no auth — token-based)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/agent/{shipment_id}")
def agent_get_shipment(
    shipment_id: UUID,
    token: str = Query(...),
    session: Session = Depends(get_session),
):
    """Public endpoint — agent opens this link to see order details."""
    shipment = session.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    # Verify HMAC token
    if not shipment.agent_id:
        raise HTTPException(403, "Not an own-agent shipment")
    expected = _sign_agent_token(shipment_id, shipment.agent_id)
    if not hmac.compare_digest(expected, token[:32]):
        raise HTTPException(403, "Invalid token")

    # Load order
    order = session.get(Order, shipment.order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    # Load agent
    agent = session.get(DeliveryAgent, shipment.agent_id)

    shipping_addr = order.shipping_address or {}
    return {
        "shipment_id": str(shipment.id),
        "status": shipment.status,
        "order_id": str(order.id),
        "agent_name": agent.name if agent else "Agent",
        "customer_name": shipping_addr.get("fullName") or shipping_addr.get("full_name") or "Customer",
        "customer_phone": shipping_addr.get("mobileNumber") or shipping_addr.get("mobile_number") or "",
        "delivery_address": {
            "line1": (
                shipping_addr.get("addressLine1")
                or shipping_addr.get("address_line1")
                or shipping_addr.get("address1")
                or shipping_addr.get("line1")
                or ""
            ),
            "city": str(shipping_addr.get("city") or ""),
            "pincode": str(
                shipping_addr.get("postalCode")
                or shipping_addr.get("postal_code")
                or shipping_addr.get("pincode")
                or ""
            ),
            "state": str(shipping_addr.get("state") or ""),
        },
        "items": order.items or [],
        "order_total": float(order.total),
        "payment_method": order.payment_method,
    }


@router.post("/agent/{shipment_id}/status")
def agent_update_status(
    shipment_id: UUID,
    body: AgentStatusUpdate,
    token: str = Query(...),
    session: Session = Depends(get_session),
):
    """Agent PWA calls this to update delivery status step-by-step."""
    shipment = session.get(Shipment, shipment_id)
    if not shipment or not shipment.agent_id:
        raise HTTPException(404, "Shipment not found")

    # Verify token
    expected = _sign_agent_token(shipment_id, shipment.agent_id)
    if not hmac.compare_digest(expected, token[:32]):
        raise HTTPException(403, "Invalid token")

    now = _utc_now()
    action = body.action.lower()

    VALID_TRANSITIONS = {
        "assigned": ["accept", "failed"],
        "accepted": ["picked_up", "failed"],
        "picked_up": ["delivered", "failed"],
        "in_transit": ["delivered", "failed"],
        "out_for_delivery": ["delivered", "failed"],
    }

    if shipment.status not in VALID_TRANSITIONS:
        raise HTTPException(400, f"Cannot update shipment in status '{shipment.status}'")

    allowed = VALID_TRANSITIONS[shipment.status]
    if action not in allowed:
        raise HTTPException(400, f"Action '{action}' not allowed. Allowed: {allowed}")

    if action == "accept":
        shipment.status = "accepted"
        shipment.agent_accepted_at = now

    elif action == "picked_up":
        shipment.status = "picked_up"
        shipment.agent_picked_up_at = now
        shipment.shipped_at = now

        # Update order
        order = session.get(Order, shipment.order_id)
        if order:
            order.status = "out_for_delivery"
            order.shipped_at = now
            session.add(order)
            session.add(OrderStatusHistory(order_id=order.id, status="out_for_delivery", changed_by_type="agent"))

    elif action == "delivered":
        order = session.get(Order, shipment.order_id)
        if order and order.delivery_otp:
            expected_otp = order.delivery_otp.strip()
            provided_otp = (body.delivery_otp or "").strip()
            if not provided_otp or provided_otp != expected_otp:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Delivery OTP. Please ask the customer for their 4-digit verification code.",
                )

        # FIX: Idempotency guard — don't double-count stats if already delivered
        if shipment.status == "delivered":
            return {"ok": True, "status": shipment.status}

        shipment.status = "delivered"
        shipment.delivered_at = now
        if body.proof_url:
            shipment.proof_of_delivery_url = body.proof_url
        if body.notes:
            shipment.notes = body.notes

        # Mark order delivered + start escrow timer (auto_commit=False for single atomic commit)
        if order:
            _mark_order_delivered(order, session, auto_commit=False)

        # Reduce agent load, increment deliveries
        agent = session.get(DeliveryAgent, shipment.agent_id)
        if agent:
            agent.current_order_count = max(0, agent.current_order_count - 1)
            agent.total_deliveries += 1
            session.add(agent)

    elif action == "failed":
        shipment.status = "failed"
        if body.notes:
            shipment.notes = body.notes

        # Reduce agent load
        agent = session.get(DeliveryAgent, shipment.agent_id)
        if agent:
            agent.current_order_count = max(0, agent.current_order_count - 1)
            session.add(agent)

    session.add(shipment)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {"ok": True, "status": shipment.status}


# ──────────────────────────────────────────────────────────────────────────────
# Customer tracking endpoint (public)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/track/{site_id}/{order_id}")
def track_order(
    site_id: str,
    order_id: str,
    session: Session = Depends(get_session),
):
    """Public tracking endpoint. Supports site UUID or store slug. Returns shipment/order info."""
    # Resolve site UUID
    target_site_uuid: Optional[UUID] = None
    try:
        target_site_uuid = UUID(site_id)
    except ValueError:
        site_obj = session.exec(select(Site).where(Site.slug == site_id)).first()
        if site_obj:
            target_site_uuid = site_obj.id

    try:
        order_uuid = UUID(order_id)
    except ValueError:
        raise HTTPException(400, "Invalid order_id format")

    order = session.get(Order, order_uuid)
    if not order:
        raise HTTPException(404, "Order not found")

    shipment_query = select(Shipment).where(Shipment.order_id == order_uuid)
    if target_site_uuid:
        shipment_query = shipment_query.where(Shipment.site_id == target_site_uuid)

    shipment = session.exec(shipment_query.order_by(Shipment.created_at.desc())).first()

    agent_name = None
    if shipment and shipment.agent_id:
        agent = session.get(DeliveryAgent, shipment.agent_id)
        if agent:
            agent_name = agent.name.split()[0]

    return {
        "order_id": str(order.id),
        "mode": shipment.mode if shipment else "manual",
        "status": shipment.status if shipment else order.status,
        "courier_name": (shipment.courier_name or shipment.delivery_partner_name) if shipment else None,
        "awb_number": shipment.awb_number if shipment else None,
        "tracking_url": shipment.tracking_url if shipment else None,
        "agent_first_name": agent_name,
        "estimated_delivery_at": shipment.estimated_delivery_at.isoformat() if shipment and shipment.estimated_delivery_at else None,
        "shipped_at": (shipment.shipped_at or order.shipped_at).isoformat() if (shipment and shipment.shipped_at) or order.shipped_at else None,
        "out_for_delivery_at": shipment.out_for_delivery_at.isoformat() if shipment and shipment.out_for_delivery_at else None,
        "delivered_at": (shipment.delivered_at or order.delivered_at).isoformat() if (shipment and shipment.delivered_at) or order.delivered_at else None,
        "notes": shipment.notes if shipment else None,
        "order_status": order.status,
        "delivery_otp": (
            order.delivery_otp
            if getattr(order, "delivery_otp", None)
            else (
                setattr(order, "delivery_otp", f"{secrets.randbelow(9000) + 1000}")
                or (session.add(order) or session.commit() or order.delivery_otp)
            )
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Shiprocket webhook (push tracking events)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/webhooks/shiprocket")
async def shiprocket_webhook(
    request: Request,
    session: Session = Depends(get_session),
    token: Optional[str] = Query(None),
):
    """
    Receives tracking event webhooks from Shiprocket with token / secret verification.
    Shiprocket sends: awb, current_status, order_id
    """
    # Verify configured webhook secret if present
    configured_secret = os.getenv("SHIPROCKET_WEBHOOK_SECRET")
    if configured_secret:
        header_secret = (
            request.headers.get("x-shiprocket-token")
            or request.headers.get("x-api-key")
            or request.headers.get("x-shiprocket-hmac-sha256")
        )
        auth_header = request.headers.get("authorization", "")
        bearer_token = auth_header.replace("Bearer ", "").strip() if "Bearer " in auth_header else auth_header
        provided = header_secret or token or bearer_token
        if not provided or not hmac.compare_digest(provided, configured_secret):
            logger.warning("Unauthorized Shiprocket webhook invocation attempted.")
            raise HTTPException(401, "Invalid webhook token or signature")

    try:
        payload = await request.json()
    except Exception:
        return {"ok": True}

    awb = payload.get("awb") or payload.get("awb_code")
    sr_status = (payload.get("current_status") or "").lower()

    if not awb:
        return {"ok": True}

    # Find shipment by AWB
    shipment = session.exec(
        select(Shipment).where(Shipment.awb_number == awb)
    ).first()
    if not shipment:
        return {"ok": True}

    now = _utc_now()

    # Map Shiprocket status → internal status
    status_map = {
        "picked up": "picked_up",
        "in transit": "in_transit",
        "out for delivery": "out_for_delivery",
        "delivered": "delivered",
        "rto": "rto",
        "rto initiated": "rto",
        "undelivered": "failed",
    }
    new_status = None
    for sr_key, internal in status_map.items():
        if sr_key in sr_status:
            new_status = internal
            break

    if not new_status or new_status == shipment.status:
        return {"ok": True}

    shipment.status = new_status

    if new_status == "picked_up":
        shipment.shipped_at = now
    elif new_status == "out_for_delivery":
        shipment.out_for_delivery_at = now
    elif new_status == "delivered":
        shipment.delivered_at = now
        order = session.get(Order, shipment.order_id)
        if order:
            _mark_order_delivered(order, session, auto_commit=False)
    elif new_status in ("rto", "failed"):
        pass  # admin will manually handle

    session.add(shipment)
    session.commit()

    return {"ok": True, "new_status": new_status}


# ──────────────────────────────────────────────────────────────────────────────
# Internal: Shiprocket token refresh
# ──────────────────────────────────────────────────────────────────────────────

def _get_or_refresh_shiprocket_token(settings: DeliverySettings, session: Session) -> str:
    """Return valid cached token or fetch a fresh one from Shiprocket."""
    now = _utc_now()
    expires_at = settings.shiprocket_token_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if settings.shiprocket_token and expires_at and expires_at > now + timedelta(hours=1):
        return settings.shiprocket_token

    from services.shiprocket import ShiprocketClient
    password = decrypt_string(settings.shiprocket_password_encrypted or "")
    if not password:
        raise ValueError("Shiprocket password not configured")

    token = ShiprocketClient.get_token(settings.shiprocket_email, password)
    settings.shiprocket_token = token
    settings.shiprocket_token_expires_at = now + timedelta(hours=238)
    session.add(settings)
    session.commit()
    return token


# ──────────────────────────────────────────────────────────────────────────────
# Rider Portal Auth & Task Management Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/rider/login")
def rider_login(
    body: RiderLoginRequest,
    session: Session = Depends(get_session),
):
    """Authenticate a delivery agent for a specific store."""
    from fastapi.responses import JSONResponse
    import re

    site_obj = None
    try:
        site_uuid = UUID(body.site_slug_or_id)
        site_obj = session.get(Site, site_uuid)
    except ValueError:
        site_obj = session.exec(select(Site).where(Site.slug == body.site_slug_or_id)).first()

    if not site_obj:
        # Fallback: check AdminSite
        admin_site_link = None
        try:
            admin_site_link = session.exec(select(AdminSite).where(AdminSite.site_id == UUID(body.site_slug_or_id))).first()
        except ValueError:
            pass
        if not admin_site_link:
            raise HTTPException(404, "Store not found. Please check store ID or link.")
        target_site_id = admin_site_link.site_id
        site_name = "Store"
        site_slug = str(target_site_id)
    else:
        target_site_id = site_obj.id
        site_name = getattr(site_obj, "name", None) or site_obj.slug or "Store"
        site_slug = site_obj.slug or str(site_obj.id)

    raw_phone = re.sub(r"\D", "", body.phone)
    if len(raw_phone) > 10 and raw_phone.startswith("91"):
        raw_phone = raw_phone[2:]

    # Rate limiting check per phone number
    _check_rider_login_rate_limit(raw_phone)

    agents = session.exec(
        select(DeliveryAgent)
        .where(DeliveryAgent.site_id == target_site_id, DeliveryAgent.is_active == True)
    ).all()

    matched_agent = None
    for a in agents:
        a_digits = re.sub(r"\D", "", a.phone)
        if a_digits.endswith(raw_phone) or raw_phone.endswith(a_digits):
            matched_agent = a
            break

    if not matched_agent:
        _record_failed_rider_login(raw_phone)
        raise HTTPException(401, "Invalid mobile number or rider account is not active.")

    if matched_agent.password_hash:
        if not verify_password(body.password, matched_agent.password_hash):
            _record_failed_rider_login(raw_phone)
            raise HTTPException(401, "Incorrect password or PIN.")
    else:
        # FIX: Removed insecure universal fallbacks "1234" and "0000".
        # If no password is set, only the last 4 digits of the agent's own phone work.
        # Admin should always set a proper PIN before handing the app to the rider.
        if body.password != matched_agent.phone[-4:]:
            _record_failed_rider_login(raw_phone)
            raise HTTPException(401, "PIN not set. Please ask your store admin to set your login PIN before using the app.")

    # Successful login: clear any failed attempt history
    _clear_rider_login_attempts(raw_phone)

    matched_agent.last_active_at = _utc_now()
    session.add(matched_agent)
    session.commit()

    curr_cnt, tot_deliv = _sync_rider_stats(matched_agent, session)
    token = create_rider_token(str(matched_agent.id), str(target_site_id))

    response_data = {
        "ok": True,
        "token": token,
        "agent": {
            "id": str(matched_agent.id),
            "name": matched_agent.name,
            "phone": matched_agent.phone,
            "vehicle_type": getattr(matched_agent, "vehicle_type", "bike") or "bike",
            "cash_in_hand": float(getattr(matched_agent, "cash_in_hand", 0.0) or 0.0),
            "current_order_count": curr_cnt,
            "total_deliveries": tot_deliv,
            "site_id": str(target_site_id),
            "site_name": site_name,
            "site_slug": site_slug,
        },
    }

    resp = JSONResponse(content=response_data)
    resp.set_cookie(
        key="rider_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=43200,  # FIX: 43200 seconds = 12 hours (was incorrectly 43200 * 60 = 30 days)
        path="/",
    )
    return resp


@router.post("/rider/logout")
def rider_logout():
    from fastapi.responses import JSONResponse
    resp = JSONResponse(content={"ok": True, "message": "Logged out successfully"})
    resp.delete_cookie(key="rider_token", path="/")
    return resp


@router.get("/rider/me")
def get_rider_profile(
    rider=Depends(authenticate_rider),
    session: Session = Depends(get_session),
):
    agent_id = UUID(rider["agentId"])
    agent = session.get(DeliveryAgent, agent_id)
    if not agent:
        raise HTTPException(404, "Rider not found")

    curr_cnt, tot_deliv = _sync_rider_stats(agent, session)
    site = session.get(Site, agent.site_id)
    return {
        "id": str(agent.id),
        "name": agent.name,
        "phone": agent.phone,
        "vehicle_type": getattr(agent, "vehicle_type", "bike") or "bike",
        "is_active": agent.is_active,
        "cash_in_hand": float(getattr(agent, "cash_in_hand", 0.0) or 0.0),
        "current_order_count": curr_cnt,
        "total_deliveries": tot_deliv,
        "site_id": str(agent.site_id),
        "site_name": (getattr(site, "name", None) or site.slug) if site else "Store",
        "site_slug": site.slug if site else str(agent.site_id),
    }


@router.get("/rider/tasks")
def get_rider_tasks(
    rider=Depends(authenticate_rider),
    session: Session = Depends(get_session),
):
    """Fetch active assigned delivery tasks & return pickups for the authenticated rider."""
    import urllib.parse
    agent_id = UUID(rider["agentId"])
    site_id = UUID(rider["siteId"])

    # 1. Forward Delivery Orders
    shipments = session.exec(
        select(Shipment)
        .where(
            Shipment.agent_id == agent_id,
            Shipment.site_id == site_id,
            Shipment.status.not_in(["delivered", "failed", "rto", "cancelled"]),
        )
        .order_by(Shipment.created_at.asc())
    ).all()

    tasks = []
    for sh in shipments:
        order = session.get(Order, sh.order_id)
        if not order or order.status == "cancelled":
            continue

        shipping_addr = order.shipping_address or {}
        addr_line = (
            shipping_addr.get("addressLine1")
            or shipping_addr.get("address_line1")
            or shipping_addr.get("address1")
            or shipping_addr.get("line1")
            or ""
        )
        city = str(shipping_addr.get("city") or "")
        pincode = str(
            shipping_addr.get("postalCode")
            or shipping_addr.get("postal_code")
            or shipping_addr.get("pincode")
            or ""
        )
        state = str(shipping_addr.get("state") or "")

        parts = [p for p in [addr_line, city, state, pincode] if p]
        full_address = ", ".join(parts) if parts else "Address not specified"

        maps_query = urllib.parse.quote(full_address)
        maps_url = f"https://www.google.com/maps/search/?api=1&query={maps_query}"

        items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
        task_items = [
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "variant": item.selected_variant_value,
                "price": float(item.line_total),
            }
            for item in items
        ]

        tasks.append({
            "task_type": "delivery",
            "shipment_id": str(sh.id),
            "order_id": str(order.id),
            "status": sh.status,
            "order_status": order.status,
            "customer_name": (shipping_addr.get("full_name") or shipping_addr.get("fullName") or "Customer") if isinstance(shipping_addr, dict) else "Customer",
            "customer_phone": (shipping_addr.get("mobile_number") or shipping_addr.get("mobileNumber") or "") if isinstance(shipping_addr, dict) else "",
            "customer_email": (shipping_addr.get("email") or "") if isinstance(shipping_addr, dict) else "",
            "address": {
                "line1": addr_line,
                "city": city,
                "pincode": pincode,
                "full": full_address,
            },
            "google_maps_url": maps_url,
            "total_amount": float(order.total),
            "payment_method": order.payment_method,
            "is_cod": order.payment_method == "cod",
            "items": task_items,
            "notes": sh.notes,
            "estimated_delivery_at": sh.estimated_delivery_at.isoformat() if sh.estimated_delivery_at else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "assigned_at": sh.created_at.isoformat() if sh.created_at else None,
        })

    # 2. Reverse Logistics Return Pickups
    return_requests = session.exec(
        select(ReturnRequest)
        .where(
            ReturnRequest.site_id == site_id,
            ReturnRequest.status.not_in(["rejected", "closed"]),
            ReturnRequest.pickup_status.in_(["assigned", "accepted", "picked_up", "out_for_pickup", "rescheduled"]),
        )
        .order_by(ReturnRequest.updated_at.desc())
    ).all()

    for ret in return_requests:
        p_details = ret.pickup_details or {}
        if str(p_details.get("agent_id") or "") != str(agent_id):
            continue

        order = session.get(Order, ret.order_id)
        shipping_addr = (order.shipping_address or {}) if order else {}
        addr_line = (
            shipping_addr.get("addressLine1")
            or shipping_addr.get("address_line1")
            or shipping_addr.get("address1")
            or shipping_addr.get("line1")
            or ""
        )
        city = str(shipping_addr.get("city") or "")
        pincode = str(
            shipping_addr.get("postalCode")
            or shipping_addr.get("postal_code")
            or shipping_addr.get("pincode")
            or ""
        )
        state = str(shipping_addr.get("state") or "")

        parts = [p for p in [addr_line, city, state, pincode] if p]
        full_address = ", ".join(parts) if parts else "Customer Return Pickup Address"

        maps_query = urllib.parse.quote(full_address)
        maps_url = f"https://www.google.com/maps/search/?api=1&query={maps_query}"

        ret_items = session.exec(
            select(ReturnItem).where(ReturnItem.return_request_id == ret.id)
        ).all()

        task_items = [
            {
                "id": str(item.id),
                "product_name": item.product_name,
                "quantity": int(item.quantity_approved or item.quantity_requested or 1),
                "quantity_requested": int(item.quantity_requested or 1),
                "quantity_approved": int(item.quantity_approved or item.quantity_requested or 1),
                "quantity_received": int(item.quantity_received or 0),
                "variant": item.selected_variant_value,
                "price": float(item.line_refund_suggested or item.unit_price_paid or 0),
                "reason": item.reason_code,
            }
            for item in ret_items
        ]

        tasks.append({
            "task_type": "return_pickup",
            "return_id": str(ret.id),
            "shipment_id": str(ret.id),
            "order_id": str(ret.order_id),
            "status": ret.pickup_status or "assigned",
            "order_status": f"Return ({ret.status})",
            "customer_name": (shipping_addr.get("full_name") or shipping_addr.get("fullName") or "Customer") if isinstance(shipping_addr, dict) else "Customer",
            "customer_phone": (shipping_addr.get("mobile_number") or shipping_addr.get("mobileNumber") or "") if isinstance(shipping_addr, dict) else "",
            "customer_email": (shipping_addr.get("email") or "") if isinstance(shipping_addr, dict) else "",
            "address": {
                "line1": addr_line,
                "city": city,
                "pincode": pincode,
                "full": full_address,
            },
            "google_maps_url": maps_url,
            "total_amount": float(ret.suggested_refund_amount or 0),
            "payment_method": "Return Refund",
            "is_cod": False,
            "items": task_items,
            "notes": p_details.get("pickup_notes") or ret.request_note,
            "created_at": ret.created_at.isoformat() if ret.created_at else None,
            "assigned_at": p_details.get("assigned_at") or (ret.updated_at.isoformat() if ret.updated_at else None),
        })

    return tasks


@router.get("/rider/available-pool")
def get_available_pickup_pool(
    rider=Depends(authenticate_rider),
    session: Session = Depends(get_session),
):
    """Fetch unassigned shipped orders ready for pickup claiming by delivery riders."""
    site_id = UUID(rider["siteId"])

    # Riders can ONLY claim orders that are packed and marked 'shipped' by the Store Admin
    orders = session.exec(
        select(Order)
        .where(
            Order.site_id == site_id,
            Order.status == "shipped",
        )
        .order_by(Order.shipped_at.desc(), Order.created_at.desc())
    ).all()

    pool = []
    for o in orders:
        existing_active = session.exec(
            select(Shipment).where(
                Shipment.order_id == o.id,
                Shipment.agent_id != None,
                Shipment.status.not_in(["failed", "cancelled"]),
            )
        ).first()
        if existing_active:
            continue

        shipping_addr = o.shipping_address or {}
        items = session.exec(select(OrderItem).where(OrderItem.order_id == o.id)).all()

        addr_line = (
            shipping_addr.get("addressLine1")
            or shipping_addr.get("address_line1")
            or shipping_addr.get("address1")
            or shipping_addr.get("line1")
            or ""
        )
        city = str(shipping_addr.get("city") or "")
        pincode = str(
            shipping_addr.get("postalCode")
            or shipping_addr.get("postal_code")
            or shipping_addr.get("pincode")
            or ""
        )
        parts = [p for p in [addr_line, city, pincode] if p]
        summary_addr = ", ".join(parts) if parts else "Address not provided"

        pool.append({
            "order_id": str(o.id),
            "customer_name": (shipping_addr.get("full_name") or shipping_addr.get("fullName") or "Customer") if isinstance(shipping_addr, dict) else "Customer",
            "city": city,
            "pincode": pincode,
            "address_summary": summary_addr,
            "total_amount": float(o.total),
            "payment_method": o.payment_method,
            "is_cod": o.payment_method == "cod",
            "item_count": sum(i.quantity for i in items),
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })

    return pool


@router.post("/rider/claim/{order_id}")
def rider_claim_order(
    order_id: UUID,
    rider=Depends(authenticate_rider),
    session: Session = Depends(get_session),
):
    """Rider claims an unassigned shipped order from the open store pool."""
    agent_id = UUID(rider["agentId"])
    site_id = UUID(rider["siteId"])

    agent = session.get(DeliveryAgent, agent_id)
    if not agent or not agent.is_active:
        raise HTTPException(403, "Agent inactive")

    order = session.get(Order, order_id)
    if not order or order.site_id != site_id:
        raise HTTPException(404, "Order not found")

    if order.status != "shipped":
        raise HTTPException(400, "Order is not ready for delivery (must be marked shipped by admin first).")

    # FIX: Race condition mitigation — re-fetch the shipment inside the transaction
    # and re-validate that no other rider has claimed it in the window between
    # the pool listing and this claim request.
    existing_shipment = session.exec(
        select(Shipment).where(
            Shipment.order_id == order_id,
            Shipment.status.not_in(["failed", "cancelled"]),  # type: ignore[attr-defined]
        )
    ).first()

    if (
        existing_shipment
        and existing_shipment.agent_id
        and existing_shipment.agent_id != agent_id
        and existing_shipment.status not in ["failed", "cancelled"]
    ):
        raise HTTPException(400, "Order has already been claimed by another rider")

    now = _utc_now()
    if existing_shipment:
        existing_shipment.agent_id = agent.id
        existing_shipment.delivery_partner_name = agent.name
        existing_shipment.delivery_partner_phone = agent.phone
        existing_shipment.delivery_mode = "own_agent"
        existing_shipment.status = "accepted"
        existing_shipment.agent_accepted_at = now
        session.add(existing_shipment)
    else:
        shipment = Shipment(
            order_id=order.id,
            site_id=site_id,
            mode="own_agent",
            delivery_mode="own_agent",
            status="accepted",
            agent_id=agent.id,
            delivery_partner_name=agent.name,
            delivery_partner_phone=agent.phone,
            agent_accepted_at=now,
        )
        shipment.agent_token = _sign_agent_token(shipment.id, agent.id)
        session.add(shipment)

    agent.current_order_count += 1
    session.add(agent)

    try:
        session.commit()
    except Exception:
        session.rollback()
        # Another rider won the race — surface a friendly error
        raise HTTPException(400, "Order was just claimed by another rider. Please refresh the list.")

    return {"ok": True, "message": f"Order claimed successfully by {agent.name}"}


@router.post("/rider/tasks/{shipment_id}/status")
def rider_update_task_status(
    shipment_id: UUID,
    body: RiderTaskStatusUpdate,
    rider=Depends(authenticate_rider),
    session: Session = Depends(get_session),
):
    """Rider updates status of their active delivery task."""
    agent_id = UUID(rider["agentId"])
    site_id = UUID(rider["siteId"])

    shipment = session.get(Shipment, shipment_id)
    return_request = None
    if not shipment:
        return_request = session.get(ReturnRequest, shipment_id)
        if not return_request or str((return_request.pickup_details or {}).get("agent_id") or "") != str(agent_id):
            raise HTTPException(404, "Task not found or not assigned to you")

    agent = session.get(DeliveryAgent, agent_id)
    action = body.action.lower()
    now = _utc_now()

    # If updating a Return Pickup task
    if return_request:
        p_details = dict(return_request.pickup_details or {})
        if action == "accept":
            return_request.pickup_status = "accepted"
            p_details["pickup_status"] = "accepted"
            p_details["accepted_at"] = now.isoformat()
        elif action in ["reject", "decline", "release"]:
            return_request.pickup_status = "pending"
            p_details["pickup_status"] = "pending"
            p_details.pop("agent_id", None)
            p_details.pop("agent_name", None)
            p_details.pop("agent_phone", None)
            decline_reason = body.notes or body.reason or "Declined by rider"
            p_details["decline_reason"] = decline_reason
            if agent:
                agent.current_order_count = max(0, agent.current_order_count - 1)
                session.add(agent)
        elif action in ["picked_up", "out_for_delivery", "inspection_passed"]:
            return_request.pickup_status = "picked_up"
            p_details["pickup_status"] = "picked_up"
            p_details["inspection_result"] = "passed"
            p_details["picked_up_at"] = now.isoformat()
            if body.notes:
                p_details["pickup_notes"] = body.notes

            # Process Doorstep Item-level picked quantities if provided
            total_picked = 0
            total_approved = 0
            ret_items = session.exec(
                select(ReturnItem).where(ReturnItem.return_request_id == return_request.id)
            ).all()

            picked_map = body.picked_items or {}
            for item in ret_items:
                appr_qty = int(item.quantity_approved or item.quantity_requested or 1)
                total_approved += appr_qty
                # If rider sent custom picked quantity for this item:
                if str(item.id) in picked_map:
                    picked_qty = max(0, min(int(picked_map[str(item.id)]), appr_qty))
                else:
                    picked_qty = appr_qty

                item.quantity_received = picked_qty
                session.add(item)
                total_picked += picked_qty

            p_details["total_approved_quantity"] = total_approved
            p_details["total_picked_quantity"] = total_picked
            p_details["picked_quantities"] = {str(item.id): item.quantity_received for item in ret_items}

            history_note = f"Doorstep Physical Inspection Passed by Rider {agent.name if agent else ''}. Picked up {total_picked}/{total_approved} units from customer."
            if body.notes:
                history_note += f" • Note: {body.notes}"

            session.add(
                ReturnStatusHistory(
                    return_request_id=return_request.id,
                    status=return_request.status,
                    changed_by=agent.id if agent else None,
                    changed_by_type="agent",
                    note=history_note,
                    changed_at=now,
                )
            )
        elif action in ["doorstep_rejected", "inspection_failed", "reject_doorstep"]:
            fail_reason = body.reason or "Seal broken or item in damaged/used condition"
            custom_note = body.notes or ""
            full_note = f"Doorstep Inspection Failed by Rider: {fail_reason}"
            if custom_note:
                full_note += f" • Note: {custom_note}"

            return_request.pickup_status = "doorstep_rejected"
            return_request.status = "rejected"
            return_request.rejected_at = now
            return_request.rejection_reason = fail_reason
            return_request.admin_note = (return_request.admin_note or "") + f" [Rider Doorstep Rejection: {full_note}]"

            p_details["pickup_status"] = "doorstep_rejected"
            p_details["inspection_result"] = "failed"
            p_details["inspection_failed_reason"] = fail_reason
            p_details["inspection_notes"] = custom_note
            p_details["doorstep_rejected_at"] = now.isoformat()

            session.add(
                ReturnStatusHistory(
                    return_request_id=return_request.id,
                    status="rejected",
                    changed_by=agent.id if agent else None,
                    changed_by_type="agent",
                    note=full_note,
                    changed_at=now,
                )
            )

            if agent:
                agent.current_order_count = max(0, agent.current_order_count - 1)
                session.add(agent)
        elif action in ["delivered", "delivered_to_hub", "hub_handover"]:
            return_request.pickup_status = "delivered_to_hub"
            return_request.status = "received"
            return_request.received_at = now
            p_details["pickup_status"] = "delivered_to_hub"
            p_details["delivered_to_hub_at"] = now.isoformat()
            if body.notes:
                p_details["pickup_notes"] = body.notes
            session.add(
                ReturnStatusHistory(
                    return_request_id=return_request.id,
                    status="received",
                    changed_by=agent.id if agent else None,
                    changed_by_type="agent",
                    note=f"Return package delivered & handed over at store/hub by Rider {agent.name if agent else ''}. Ready for store admin inspection & restock.",
                    changed_at=now,
                )
            )
            if agent:
                agent.total_deliveries += 1
                agent.current_order_count = max(0, agent.current_order_count - 1)
                session.add(agent)
        elif action in ["reschedule", "attempt_failed"]:
            return_request.pickup_status = "rescheduled"
            p_details["pickup_status"] = "rescheduled"
            fail_reason = body.reason or "Customer unreachable / Premises closed"
            p_details["reschedule_reason"] = fail_reason
            if body.notes:
                p_details["pickup_notes"] = body.notes
        elif action == "failed":
            return_request.pickup_status = "failed"
            p_details["pickup_status"] = "failed"
            if body.notes:
                p_details["pickup_notes"] = body.notes
            if agent:
                agent.current_order_count = max(0, agent.current_order_count - 1)
                session.add(agent)

        return_request.pickup_details = p_details
        return_request.updated_at = now
        session.add(return_request)
        session.commit()
        return {
            "ok": True,
            "status": return_request.pickup_status,
            "order_status": f"Return ({return_request.status})",
            "cash_in_hand": float(getattr(agent, "cash_in_hand", 0.0) or 0.0) if agent else 0.0,
        }

    # ---- Forward delivery shipment update ----
    order = session.get(Order, shipment.order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    # FIX: Enforce the same state-machine transitions as the token-based PWA endpoint.
    # Without this, a rider could call action=delivered on an assigned (unpicked) shipment.
    FORWARD_VALID_TRANSITIONS = {
        "assigned": ["accept", "reject", "decline", "release", "failed"],
        "accepted": ["picked_up", "out_for_delivery", "reject", "decline", "release", "reschedule", "attempt_failed", "failed"],
        "out_for_delivery": ["delivered", "reschedule", "attempt_failed", "failed"],
        "picked_up": ["delivered", "reschedule", "attempt_failed", "failed"],
        "in_transit": ["delivered", "reschedule", "attempt_failed", "failed"],
        "rescheduled": ["picked_up", "out_for_delivery", "delivered", "reschedule", "attempt_failed", "failed"],
    }

    if shipment.status not in FORWARD_VALID_TRANSITIONS:
        raise HTTPException(400, f"Cannot update shipment in status '{shipment.status}'")

    allowed_actions = FORWARD_VALID_TRANSITIONS[shipment.status]
    if action not in allowed_actions:
        raise HTTPException(400, f"Action '{action}' not allowed for a shipment in status '{shipment.status}'. Allowed: {allowed_actions}")

    if action == "accept":
        shipment.status = "accepted"
        shipment.agent_accepted_at = now
    elif action in ["reject", "decline", "release"]:
        # Rider declines/releases order back to store pickup pool
        shipment.status = "pending"
        shipment.agent_id = None
        shipment.agent_token = None
        shipment.agent_accepted_at = None
        shipment.delivery_partner_name = None
        shipment.delivery_partner_phone = None
        decline_reason = body.notes or body.reason or "Declined by rider"
        shipment.notes = f"Released by rider {agent.name if agent else 'Partner'}: {decline_reason}"
        if agent:
            agent.current_order_count = max(0, agent.current_order_count - 1)
            session.add(agent)
        order.status = "confirmed"  # Return to Yet to Ship / Needs Rider Assignment
        session.add(order)
        session.add(OrderStatusHistory(order_id=order.id, status="confirmed", changed_by_type="agent", notes=f"Rider declined: {decline_reason}"))
    elif action in ["picked_up", "out_for_delivery"]:
        shipment.status = "out_for_delivery"
        shipment.out_for_delivery_at = now
        shipment.shipped_at = shipment.shipped_at or now
        order.status = "out_for_delivery"
        order.shipped_at = order.shipped_at or now
        session.add(order)
        session.add(OrderStatusHistory(order_id=order.id, status="out_for_delivery", changed_by_type="agent"))
    elif action == "delivered":
        # Enforce Delivery OTP verification if assigned on order
        expected_otp = (order.delivery_otp or "").strip()
        if expected_otp:
            provided_otp = (body.delivery_otp or "").strip()
            if not provided_otp or provided_otp != expected_otp:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Delivery OTP. Please ask the customer for their 4-digit verification code.",
                )

        # FIX: Idempotency — don't double-count if already delivered (network retry / double tap)
        if shipment.status == "delivered":
            session.add(shipment)
            session.commit()
            return {
                "ok": True,
                "status": shipment.status,
                "order_status": order.status,
                "cash_in_hand": float(getattr(agent, "cash_in_hand", 0.0) or 0.0) if agent else 0.0,
            }

        shipment.status = "delivered"
        shipment.delivered_at = now
        if body.proof_url:
            shipment.proof_of_delivery_url = body.proof_url
        if body.notes:
            shipment.notes = body.notes

        _mark_order_delivered(order, session, auto_commit=False)

        if agent:
            agent.total_deliveries += 1
            agent.current_order_count = max(0, agent.current_order_count - 1)
            if order.payment_method == "cod":
                agent.cash_in_hand = float(getattr(agent, "cash_in_hand", 0.0) or 0.0) + float(order.total)
            session.add(agent)
    elif action in ["reschedule", "attempt_failed"]:
        # FIX: Enforce a maximum of 5 reschedule attempts to prevent infinite loop
        forward_reschedule_count = session.exec(
            select(OrderStatusHistory).where(
                OrderStatusHistory.order_id == order.id,
                OrderStatusHistory.status == "rescheduled",
            )
        ).all()
        if len(forward_reschedule_count) >= 5:
            raise HTTPException(
                400,
                "Maximum rescheduling attempts (5) reached. Please contact admin to manually resolve this delivery.",
            )

        shipment.status = "rescheduled"
        fail_reason = body.reason or "Customer unreachable / Door closed"
        custom_note = body.notes or ""
        note_str = f"Delivery Attempt Failed: {fail_reason}"
        if custom_note:
            note_str += f" • Note: {custom_note}"
        shipment.notes = note_str

        if body.rescheduled_at:
            try:
                from datetime import datetime as dt
                clean_iso = body.rescheduled_at.replace("Z", "+00:00")
                shipment.estimated_delivery_at = dt.fromisoformat(clean_iso)
            except Exception:
                pass

        order.status = "rescheduled"
        session.add(order)
        session.add(OrderStatusHistory(order_id=order.id, status="rescheduled", changed_by_type="agent"))
    elif action == "failed":
        shipment.status = "failed"
        if body.notes:
            shipment.notes = body.notes
        if agent:
            agent.current_order_count = max(0, agent.current_order_count - 1)
            session.add(agent)

    session.add(shipment)
    session.commit()
    return {
        "ok": True,
        "status": shipment.status,
        "order_status": order.status,
        "cash_in_hand": float(getattr(agent, "cash_in_hand", 0.0) or 0.0) if agent else 0.0,
    }
