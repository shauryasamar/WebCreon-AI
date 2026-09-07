import asyncio
import json
from pathlib import Path
import logging
import math
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Cookie, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, col, func, select
from sqlalchemy import text, update

from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    enforce_site_ownership,
)
from routers.products import save_optimized_upload_image

SUPPORT_UPLOADS_DIR = Path("uploads/support")
SUPPORT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_SUPPORT_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}
from sqlalchemy.orm.attributes import flag_modified

from auth_utils import (
    create_support_agent_token,
    decode_token,
    hash_password,
    verify_password,
)
from db.database import engine, get_session
from models import (
    AdminSite,
    Order,
    OrderItem,
    OrderStatusHistory,
    ReturnItem,
    ReturnRequest,
    Shipment,
    Site,
    SupportAgent,
    SupportTicket,
    SupportTicketMessage,
    TenantLedgerEntry,
    User,
    utc_now,
)

logger = logging.getLogger(__name__)

# Run defensive migration for order_status_history notes column if not yet present
try:
    with engine.connect() as _mig_conn:
        _mig_conn.execute(text("ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS notes TEXT;"))
        _mig_conn.commit()
except Exception as _m_err:
    logger.debug("OrderStatusHistory notes column check: %s", _m_err)

router = APIRouter(tags=["support"])


import gc

_uvicorn_server_instance = None


def is_uvicorn_shutting_down() -> bool:
    global _uvicorn_server_instance
    if _uvicorn_server_instance is not None:
        return bool(getattr(_uvicorn_server_instance, "should_exit", False))

    try:
        import uvicorn
        for obj in gc.get_objects():
            if isinstance(obj, uvicorn.Server):
                _uvicorn_server_instance = obj
                return bool(getattr(obj, "should_exit", False))
    except Exception:
        pass
    return False


# ---------------------------------------------------------------------------
# Real-time In-Memory Event Hub for Instant Ticket Delivery & Seen Receipts
# ---------------------------------------------------------------------------
class TicketEventHub:
    def __init__(self):
        self._listeners: dict[str, set[asyncio.Queue]] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._stopping: bool = False

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def stop(self):
        self._stopping = True
        for listeners in list(self._listeners.values()):
            for q in list(listeners):
                try:
                    q.put_nowait({"type": "_shutdown"})
                except Exception:
                    pass

    def subscribe(self, ticket_id: str) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        self._listeners.setdefault(str(ticket_id), set()).add(q)
        return q

    def unsubscribe(self, ticket_id: str, q: asyncio.Queue):
        if str(ticket_id) in self._listeners:
            self._listeners[str(ticket_id)].discard(q)
            if not self._listeners[str(ticket_id)]:
                del self._listeners[str(ticket_id)]

    def broadcast(self, ticket_id: str, event: dict):
        listeners = list(self._listeners.get(str(ticket_id), []))
        if not listeners:
            return

        def _push():
            for q in listeners:
                try:
                    q.put_nowait(event)
                except Exception:
                    pass

        try:
            loop = self._loop or asyncio.get_running_loop()
            if loop.is_running():
                loop.call_soon_threadsafe(_push)
            else:
                _push()
        except RuntimeError:
            if self._loop and self._loop.is_running():
                self._loop.call_soon_threadsafe(_push)
            else:
                _push()


ticket_hub = TicketEventHub()


@router.get("/support/tickets/{ticket_id}/stream")
@router.get("/sites/{site_id}/support/tickets/{ticket_id}/stream")
async def ticket_stream(
    ticket_id: UUID,
    request: Request,
    site_id: Optional[str] = None,
):
    """Real-time instant Server-Sent Events (SSE) stream for messages and WhatsApp-like read receipts."""
    try:
        ticket_hub.set_loop(asyncio.get_running_loop())
    except Exception:
        pass

    async def event_generator():
        q = ticket_hub.subscribe(str(ticket_id))
        loop = asyncio.get_running_loop()
        last_ping = loop.time()
        try:
            yield f"data: {json.dumps({'type': 'connected', 'ticket_id': str(ticket_id)})}\n\n"
            while not ticket_hub._stopping and not is_uvicorn_shutting_down():
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(q.get(), timeout=1.0)
                    if event.get("type") == "_shutdown":
                        break
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        break
                    now = loop.time()
                    if now - last_ping >= 15.0:
                        last_ping = now
                        yield ": ping\n\n"
                except (asyncio.CancelledError, GeneratorExit):
                    break
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            ticket_hub.unsubscribe(str(ticket_id), q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Helpers & Auth for Support Agents
# ---------------------------------------------------------------------------

def generate_ticket_number() -> str:
    """Generates human-readable ticket ID like TCK-84920."""
    return f"TCK-{secrets.randbelow(90000) + 10000}"


def authenticate_support_agent(
    request: Request,
    support_token: Optional[str] = Cookie(default=None, alias="support_token"),
    session: Session = Depends(get_session),
) -> SupportAgent:
    """Authenticates support staff via cookie or Authorization header."""
    token = support_token
    if not token and request.headers.get("Authorization"):
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Support agent authentication required",
        )

    payload = decode_token(token)
    if not payload or payload.get("tokenType") != "support_agent":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired support agent session",
        )

    agent_id = payload.get("agentId")
    if not agent_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    agent = session.get(SupportAgent, UUID(agent_id))
    if not agent or not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Support agent account is inactive or not found",
        )

    return agent


def authenticate_admin_or_support_agent(
    request: Request,
    admin_token: Optional[str] = Cookie(default=None, alias="admin_token"),
    support_token: Optional[str] = Cookie(default=None, alias="support_token"),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Allows either a Store Admin OR an authenticated Support Agent to access ticket tools."""
    auth_header = request.headers.get("Authorization", "")
    header_token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else None

    # 1. First priority: Explicit Authorization header (e.g. from Support Agent Dashboard)
    if header_token:
        payload = decode_token(header_token)
        if payload:
            token_type = payload.get("tokenType")
            if token_type == "support_agent":
                agent_id = payload.get("agentId")
                if agent_id:
                    agent = session.get(SupportAgent, UUID(agent_id))
                    if agent and agent.is_active:
                        return {
                            "actor_type": "agent",
                            "actor_id": str(agent.id),
                            "agent": agent,
                            "name": agent.name,
                        }
            elif token_type == "admin":
                return {
                    "actor_type": "admin",
                    "actor_id": payload.get("adminId"),
                    "name": "Store Admin",
                }

    # 2. Admin token cookie (takes priority for admin routes when admin is logged in)
    if admin_token:
        payload = decode_token(admin_token)
        if payload and payload.get("tokenType") == "admin":
            return {
                "actor_type": "admin",
                "actor_id": payload.get("adminId"),
                "name": "Store Admin",
            }

    # 3. Support token cookie
    if support_token:
        payload = decode_token(support_token)
        if payload and payload.get("tokenType") == "support_agent":
            agent_id = payload.get("agentId")
            if agent_id:
                agent = session.get(SupportAgent, UUID(agent_id))
                if agent and agent.is_active:
                    return {
                        "actor_type": "agent",
                        "actor_id": str(agent.id),
                        "agent": agent,
                        "name": agent.name,
                    }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin or Support Agent authorization required",
    )


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class SupportAgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    phone: Optional[str] = None
    password: str = Field(min_length=1)
    role: str = "agent"  # "agent" | "lead"


class SupportAgentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class SupportLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1)
    site_slug: Optional[str] = None
    site_id: Optional[str] = None


class CreateTicketRequest(BaseModel):
    order_id: Optional[UUID] = None
    category: str = "other"
    priority: str = "medium"
    subject: str = Field(min_length=3, max_length=255)
    message: str = Field(min_length=5)
    attachments: Optional[list[str]] = None
    order_items_summary: Optional[dict[str, Any]] = None
    customer_refund_account: Optional[dict[str, Any]] = None


class AddTicketMessageRequest(BaseModel):
    message: str = Field(min_length=1)
    attachments: Optional[list[str]] = None
    is_internal_note: bool = False


class AssignTicketRequest(BaseModel):
    agent_id: Optional[UUID] = None


class UpdateTicketStatusRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


class TicketActionItem(BaseModel):
    order_item_id: UUID
    quantity: int = 1


class TicketActionRequest(BaseModel):
    action_type: str  # "refund" | "replacement" | "cancel_order" | "resolve" | "reopen"
    note: Optional[str] = None
    refund_amount: Optional[Decimal] = None
    items: Optional[list[TicketActionItem]] = None
    payout_mode: Optional[str] = None  # e.g. "UPI Transfer", "Bank Account (NEFT/IMPS)", "Cash Handover"
    reference_id: Optional[str] = None  # e.g. UTR number, UPI transaction reference
    included_charge_ids: Optional[list[str]] = None  # e.g. shipping / delivery fee / COD fee IDs marked for refund


# ---------------------------------------------------------------------------
# Support Agent Authentication Routes
# ---------------------------------------------------------------------------

@router.post("/support/login")
def support_agent_login(
    payload: SupportLoginRequest,
    response: Response,
    session: Session = Depends(get_session),
):
    """Support agent login endpoint."""
    # Resolve site
    site = None
    if payload.site_id:
        site = session.get(Site, UUID(payload.site_id))
    elif payload.site_slug:
        site = session.exec(select(Site).where(Site.slug == payload.site_slug)).first()

    if not site:
        raise HTTPException(status_code=400, detail="Valid site_id or site_slug is required")

    agent = session.exec(
        select(SupportAgent).where(
            SupportAgent.site_id == site.id,
            SupportAgent.email == payload.email.lower().strip(),
        )
    ).first()

    if not agent or not verify_password(payload.password, agent.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your support agent account has been deactivated by the store administrator",
        )

    token = create_support_agent_token(str(agent.id), str(site.id))

    # Set secure cookie
    response.set_cookie(
        key="support_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production HTTPS
        max_age=86400 * 30,
        path="/",
    )

    return {
        "success": True,
        "token": token,
        "agent": {
            "id": str(agent.id),
            "name": agent.name,
            "email": agent.email,
            "role": agent.role,
            "site_id": str(site.id),
            "site_slug": site.slug,
        },
    }


@router.get("/support/me")
def support_agent_me(
    agent: SupportAgent = Depends(authenticate_support_agent),
    session: Session = Depends(get_session),
):
    """Get currently logged-in support agent profile."""
    site = session.get(Site, agent.site_id)
    open_count = session.exec(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.site_id == agent.site_id,
            SupportTicket.assigned_agent_id == agent.id,
            SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]),
        )
    ).one()
    resolved_count = session.exec(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.site_id == agent.site_id,
            SupportTicket.assigned_agent_id == agent.id,
            SupportTicket.status.in_(["resolved", "closed"]),
        )
    ).one()
    return {
        "id": str(agent.id),
        "name": agent.name,
        "email": agent.email,
        "phone": agent.phone,
        "role": agent.role,
        "is_active": agent.is_active,
        "assigned_ticket_count": open_count,
        "total_resolved_count": resolved_count,
        "site_id": str(agent.site_id),
        "site_slug": site.slug if site else "",
    }


@router.post("/support/logout")
def support_agent_logout(response: Response):
    """Logs out support agent by clearing cookie."""
    response.delete_cookie(key="support_token", path="/")
    return {"success": True, "message": "Logged out successfully"}


# ---------------------------------------------------------------------------
# Dedicated Support Agent Ticket Operations (Strictly Assigned Cases Only)
# ---------------------------------------------------------------------------

@router.get("/support/agent/tickets")
def support_agent_list_tickets(
    status_filter: Optional[str] = Query("my", alias="status"),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=5, le=100),
    agent: SupportAgent = Depends(authenticate_support_agent),
    session: Session = Depends(get_session),
):
    """Support Agent sees ONLY tickets strictly assigned directly to them."""
    query = select(SupportTicket).where(
        SupportTicket.site_id == agent.site_id,
        SupportTicket.assigned_agent_id == agent.id,
    )

    if status_filter:
        if status_filter in ("my", "open"):
            query = query.where(SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]))
        elif status_filter == "waiting_customer":
            query = query.where(SupportTicket.status == "waiting_customer")
        elif status_filter == "resolved":
            query = query.where(SupportTicket.status.in_(["resolved", "closed"]))
        elif status_filter != "all":
            query = query.where(SupportTicket.status == status_filter)

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.where(
            col(SupportTicket.ticket_number).ilike(s) | col(SupportTicket.subject).ilike(s)
        )

    # Calculate counts strictly for this agent
    agent_base = select(func.count(SupportTicket.id)).where(
        SupportTicket.site_id == agent.site_id,
        SupportTicket.assigned_agent_id == agent.id,
    )
    total_assigned = session.exec(agent_base).one()
    waiting_cust_count = session.exec(
        agent_base.where(SupportTicket.status == "waiting_customer")
    ).one()
    resolved_count = session.exec(
        agent_base.where(SupportTicket.status.in_(["resolved", "closed"]))
    ).one()
    active_my_count = session.exec(
        agent_base.where(SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]))
    ).one()

    total_matching = session.exec(select(func.count()).select_from(query.subquery())).one()
    offset = (page - 1) * page_size
    tickets = session.exec(
        query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(page_size)
    ).all()

    items = []
    for t in tickets:
        cust = session.get(User, t.customer_id)
        last_m = session.exec(
            select(SupportTicketMessage)
            .where(SupportTicketMessage.ticket_id == t.id)
            .order_by(SupportTicketMessage.created_at.desc())
        ).first()

        items.append({
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "order_id": str(t.order_id) if t.order_id else None,
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "subject": t.subject,
            "order_items_summary": t.order_items_summary,
            "customer": {
                "id": str(cust.id) if cust else str(t.customer_id),
                "name": cust.name if cust and cust.name else "Customer",
                "email": cust.email if cust else None,
                "phone": cust.phone if cust else None,
            },
            "assigned_agent": {
                "id": str(agent.id),
                "name": agent.name,
            },
            "last_message": last_m.message if last_m else None,
            "last_message_sender": last_m.sender_name if last_m else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        })

    return {
        "tickets": items,
        "pagination": {
            "total_items": total_matching,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total_matching + page_size - 1) // page_size),
        },
        "counts": {
            "all": total_assigned,
            "unassigned": 0,
            "my_tickets": active_my_count,
            "waiting_customer": waiting_cust_count,
            "resolved": resolved_count,
        },
    }


@router.get("/support/agent/tickets/{ticket_id}")
def support_agent_get_ticket_detail(
    ticket_id: UUID,
    agent: SupportAgent = Depends(authenticate_support_agent),
    session: Session = Depends(get_session),
):
    """Support agent retrieves detail for a ticket assigned to them."""
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != agent.site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.assigned_agent_id != agent.id:
        raise HTTPException(status_code=403, detail="Access restricted: This case is not assigned to you.")

    # 1. Customer CRM Profile
    cust = session.get(User, ticket.customer_id)
    total_cust_orders = session.exec(
        select(func.count(Order.id)).where(
            Order.site_id == agent.site_id,
            Order.customer_id == ticket.customer_id,
            Order.status != "pending",
        )
    ).one()
    total_cust_spend = session.exec(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.site_id == agent.site_id,
            Order.customer_id == ticket.customer_id,
            Order.status.notin_(["pending", "cancelled"]),
        )
    ).one()
    total_cust_disputes = session.exec(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.site_id == agent.site_id,
            SupportTicket.customer_id == ticket.customer_id,
        )
    ).one()

    # 2. Order 360 Context & Comprehensive Return/Refund History
    order_context = None
    if ticket.order_id:
        ord = session.get(Order, ticket.order_id)
        if ord:
            # Order items
            order_items = session.exec(
                select(OrderItem).where(OrderItem.order_id == ord.id)
            ).all()

            # Shipment & Rider
            shipment = session.exec(
                select(Shipment).where(Shipment.order_id == ord.id)
            ).first()

            # Query all return requests for this order
            all_return_requests = session.exec(
                select(ReturnRequest)
                .where(ReturnRequest.order_id == ord.id)
                .order_by(ReturnRequest.created_at.desc())
            ).all()

            return_req_ids = [r.id for r in all_return_requests]
            all_return_items = session.exec(
                select(ReturnItem)
                .where(ReturnItem.return_request_id.in_(return_req_ids))
            ).all() if return_req_ids else []

            ret_items_by_req_id: dict[UUID, list[ReturnItem]] = {}
            for r_it in all_return_items:
                ret_items_by_req_id.setdefault(r_it.return_request_id, []).append(r_it)

            # Build returns history list
            returns_history_list = []
            for ret in all_return_requests:
                items_in_ret = ret_items_by_req_id.get(ret.id, [])
                returns_history_list.append({
                    "id": str(ret.id),
                    "status": ret.status,
                    "refund_status": ret.refund_status,
                    "request_note": ret.request_note,
                    "admin_note": ret.admin_note,
                    "rejection_reason": ret.rejection_reason,
                    "refund_override_reason": ret.refund_override_reason,
                    "suggested_refund_amount": float(ret.suggested_refund_amount) if ret.suggested_refund_amount is not None else 0.0,
                    "final_refund_amount": float(ret.final_refund_amount) if ret.final_refund_amount is not None else 0.0,
                    "refund_method": ret.refund_method,
                    "pickup_status": ret.pickup_status,
                    "created_at": ret.created_at.isoformat() if ret.created_at else None,
                    "approved_at": ret.approved_at.isoformat() if ret.approved_at else None,
                    "received_at": ret.received_at.isoformat() if ret.received_at else None,
                    "inspected_at": ret.inspected_at.isoformat() if ret.inspected_at else None,
                    "refunded_at": ret.refunded_at.isoformat() if ret.refunded_at else None,
                    "items": [
                        {
                            "id": str(ri.id),
                            "order_item_id": str(ri.order_item_id),
                            "product_name": ri.product_name,
                            "quantity_requested": int(ri.quantity_requested or 0),
                            "quantity_approved": int(ri.quantity_approved or 0),
                            "quantity_received": int(ri.quantity_received or 0),
                            "unit_price_paid": float(ri.unit_price_paid) if ri.unit_price_paid is not None else 0.0,
                            "line_refund_final": float(ri.line_refund_final) if ri.line_refund_final is not None else float(ri.line_refund_suggested or 0.0),
                            "reason_code": ri.reason_code,
                            "reason_note": ri.reason_note,
                            "restock_decision": ri.restock_decision,
                        }
                        for ri in items_in_ret
                    ],
                })

            # Calculate total already refunded on this order
            pricing_snap = dict(ord.pricing_snapshot or {})
            refund_transactions_list = []
            if isinstance(pricing_snap.get("refund_history"), list):
                refund_transactions_list.extend(pricing_snap.get("refund_history"))
            elif pricing_snap.get("refund_details"):
                refund_transactions_list.append(pricing_snap.get("refund_details"))

            already_refunded_total = Decimal("0.00")
            for rf in refund_transactions_list:
                if isinstance(rf, dict) and rf.get("amount") is not None:
                    already_refunded_total += Decimal(str(rf.get("amount") or 0))

            # Also check completed return requests if refund_history was empty
            if already_refunded_total == Decimal("0.00"):
                for ret in all_return_requests:
                    if ret.status in ("refunded", "closed") or ret.refund_status == "processed":
                        already_refunded_total += Decimal(str(ret.final_refund_amount or 0))

            if ord.status == "refunded" or ord.payment_status == "refunded":
                already_refunded_total = max(already_refunded_total, Decimal(str(ord.total)))

            total_paid_dec = Decimal(str(ord.total or 0))
            if already_refunded_total > total_paid_dec:
                already_refunded_total = total_paid_dec

            remaining_refundable_dec = max(Decimal("0.00"), total_paid_dec - already_refunded_total)
            is_fully_refunded = remaining_refundable_dec <= Decimal("0.00") or ord.status == "refunded" or ord.payment_status == "refunded"

            refund_summary = {
                "total_paid": float(total_paid_dec),
                "already_refunded": float(already_refunded_total),
                "remaining_refundable": float(remaining_refundable_dec),
                "is_fully_refunded": is_fully_refunded,
                "payment_method": ord.payment_method,
                "payment_status": ord.payment_status,
                "razorpay_payment_id": ord.razorpay_payment_id,
            }

            order_context = {
                "id": str(ord.id),
                "status": ord.status,
                "total": float(ord.total),
                "payment_method": ord.payment_method,
                "payment_status": ord.payment_status,
                "shipping_address": ord.shipping_address,
                "delivery_otp": ord.delivery_otp,
                "created_at": ord.created_at.isoformat() if ord.created_at else None,
                "delivered_at": ord.delivered_at.isoformat() if ord.delivered_at else None,
                "items": [
                    {
                        "id": str(it.id),
                        "product_name": it.product_name,
                        "product_image": it.product_image,
                        "variant": it.selected_variant_value,
                        "quantity": it.quantity,
                        "unit_price": float(it.unit_price),
                        "line_total": float(it.line_total),
                    }
                    for it in order_items
                ],
                "shipment": {
                    "delivery_mode": shipment.delivery_mode,
                    "status": shipment.status,
                    "courier_name": shipment.courier_name or shipment.delivery_partner_name,
                    "awb_number": shipment.awb_number,
                    "rider_phone": shipment.delivery_partner_phone,
                    "proof_of_delivery_url": shipment.proof_of_delivery_url,
                } if shipment else None,
                "refund_summary": refund_summary,
                "pricing_snapshot": pricing_snap,
                "returns_history": returns_history_list,
                "refund_transactions": refund_transactions_list,
            }

    # Mark unread customer messages as read by agent (WhatsApp seen receipt)
    unread_customer_msgs = session.exec(
        select(SupportTicketMessage).where(
            SupportTicketMessage.ticket_id == ticket.id,
            SupportTicketMessage.sender_type == "customer",
            SupportTicketMessage.read_at.is_(None),
        )
    ).all()
    if unread_customer_msgs:
        seen_now = utc_now()
        for um in unread_customer_msgs:
            um.read_at = seen_now
            session.add(um)
        session.commit()
        ticket_hub.broadcast(str(ticket.id), {
            "type": "messages_read",
            "reader": "agent",
            "read_at": seen_now.isoformat(),
        })

    # 3. All Messages
    messages = session.exec(
        select(SupportTicketMessage)
        .where(SupportTicketMessage.ticket_id == ticket.id)
        .order_by(SupportTicketMessage.created_at.asc())
    ).all()

    ret_req = session.exec(select(ReturnRequest).where(ReturnRequest.order_id == ord.id)).first() if (ticket.order_id and ord) else None

    return {
        "ticket": {
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "order_id": str(ticket.order_id) if ticket.order_id else None,
            "category": ticket.category,
            "priority": ticket.priority,
            "status": ticket.status,
            "subject": ticket.subject,
            "order_items_summary": ticket.order_items_summary,
            "customer_refund_account": ticket.customer_refund_account,
            "resolution_type": ticket.resolution_type,
            "resolution_note": ticket.resolution_note,
            "refund_amount": float(ticket.refund_amount) if ticket.refund_amount else None,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
            "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        },
        "assigned_agent": {
            "id": str(agent.id),
            "name": agent.name,
        },
        "customer_crm": {
            "id": str(cust.id) if cust else str(ticket.customer_id),
            "name": cust.name if cust and cust.name else "Customer",
            "email": cust.email if cust else None,
            "phone": cust.phone if cust else None,
            "total_orders": total_cust_orders,
            "total_spend": float(total_cust_spend),
            "total_disputes": total_cust_disputes,
        },
        "order_360": order_context,
        "return_request": {
            "id": str(ret_req.id),
            "status": ret_req.status,
            "suggested_refund_amount": float(ret_req.suggested_refund_amount) if ret_req.suggested_refund_amount is not None else None,
            "final_refund_amount": float(ret_req.final_refund_amount) if ret_req.final_refund_amount is not None else None,
        } if ret_req else None,
        "messages": [
            {
                "id": str(m.id),
                "sender_type": m.sender_type,
                "sender_id": str(m.sender_id) if m.sender_id else None,
                "sender_name": m.sender_name,
                "message": m.message,
                "attachments": m.attachments or [],
                "is_internal_note": m.is_internal_note,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "read_at": m.read_at.isoformat() if m.read_at else None,
            }
            for m in messages
        ],
    }


@router.post("/support/agent/tickets/{ticket_id}/messages")
def support_agent_reply_ticket(
    ticket_id: UUID,
    payload: AddTicketMessageRequest,
    agent: SupportAgent = Depends(authenticate_support_agent),
    session: Session = Depends(get_session),
):
    """Support agent sends reply to customer or records internal note."""
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != agent.site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.assigned_agent_id != agent.id:
        raise HTTPException(status_code=403, detail="Access restricted: You can only reply to cases assigned directly to you.")

    msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="agent",
        sender_id=agent.id,
        sender_name=agent.name,
        message=payload.message.strip(),
        attachments=payload.attachments or [],
        is_internal_note=payload.is_internal_note,
    )
    session.add(msg)

    if not payload.is_internal_note and ticket.status != "resolved":
        ticket.status = "waiting_customer"

    ticket.updated_at = utc_now()
    session.add(ticket)
    session.commit()
    session.refresh(msg)

    msg_dict = {
        "id": str(msg.id),
        "sender_type": msg.sender_type,
        "sender_id": str(msg.sender_id) if msg.sender_id else None,
        "sender_name": msg.sender_name,
        "message": msg.message,
        "attachments": msg.attachments or [],
        "is_internal_note": msg.is_internal_note,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "read_at": None,
    }
    ticket_hub.broadcast(str(ticket.id), {
        "type": "new_message",
        "message": msg_dict,
    })

    return {
        "success": True,
        "message": msg_dict,
    }


@router.post("/support/agent/tickets/{ticket_id}/action")
def support_agent_execute_action(
    ticket_id: UUID,
    payload: TicketActionRequest,
    agent: SupportAgent = Depends(authenticate_support_agent),
    session: Session = Depends(get_session),
):
    """Support agent resolves ticket via 1-click action."""
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != agent.site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.assigned_agent_id != agent.id:
        raise HTTPException(status_code=403, detail="Access restricted: You can only resolve cases assigned directly to you.")

    if ticket.status in ("closed", "resolved") and payload.action_type in ("refund", "replacement", "cancel_order", "close", "resolve"):
        raise HTTPException(
            status_code=400,
            detail="This support ticket is closed and archived. Resolution actions (refund, re-dispatch, cancel) are disabled on closed cases. Please reopen the ticket first if further action is needed.",
        )

    action_msg = ""
    if payload.action_type == "refund":
        if ticket.order_id:
            ord = session.get(Order, ticket.order_id)
            if ord:
                is_cod = (ord.payment_method or "").strip().lower() in ("cod", "cash on delivery", "cash_on_delivery")
                # Calculate all previous refunds
                pricing_snap = dict(ord.pricing_snapshot or {})
                prior_refunds = []
                if isinstance(pricing_snap.get("refund_history"), list):
                    prior_refunds.extend(pricing_snap.get("refund_history"))
                elif pricing_snap.get("refund_details"):
                    prior_refunds.append(pricing_snap.get("refund_details"))

                already_refunded_total = Decimal("0.00")
                for rf in prior_refunds:
                    if isinstance(rf, dict) and rf.get("amount") is not None:
                        already_refunded_total += Decimal(str(rf.get("amount") or 0))

                if already_refunded_total == Decimal("0.00"):
                    all_ret_reqs = session.exec(select(ReturnRequest).where(ReturnRequest.order_id == ord.id)).all()
                    for r_req in all_ret_reqs:
                        if r_req.status in ("refunded", "closed") or r_req.refund_status == "processed":
                            already_refunded_total += Decimal(str(r_req.final_refund_amount or 0))

                if ord.status == "refunded" or ord.payment_status == "refunded":
                    already_refunded_total = max(already_refunded_total, Decimal(str(ord.total)))

                total_order_dec = Decimal(str(ord.total or 0))
                remaining_refundable_dec = max(Decimal("0.00"), total_order_dec - already_refunded_total)

                if remaining_refundable_dec <= Decimal("0.00"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot issue refund. Order #{str(ord.id)[:8]} has already been fully refunded (₹{already_refunded_total} of ₹{total_order_dec}).",
                    )

                refund_amount_dec = Decimal(str(payload.refund_amount if payload.refund_amount is not None else remaining_refundable_dec))
                if refund_amount_dec <= Decimal("0.00"):
                    raise HTTPException(status_code=400, detail="Refund amount must be greater than ₹0.00.")

                if refund_amount_dec > remaining_refundable_dec:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot refund ₹{refund_amount_dec}. The maximum remaining refundable balance for this order is ₹{remaining_refundable_dec}.",
                    )

                new_total_refunded = already_refunded_total + refund_amount_dec
                is_full_refund = new_total_refunded >= total_order_dec
                refund_item_summaries = []
                order_items = session.exec(select(OrderItem).where(OrderItem.order_id == ord.id)).all()
                if payload.items:
                    item_map = {item.order_item_id: item.quantity for item in payload.items}
                    for oi in order_items:
                        if oi.id in item_map:
                            qty = min(item_map[oi.id], oi.quantity)
                            if qty >= oi.quantity and is_full_refund:
                                oi.status = "refunded"
                                session.add(oi)
                            refund_item_summaries.append(f"{qty}x {oi.product_name}")
                refunded_items_str = f" for {', '.join(refund_item_summaries)}" if refund_item_summaries else ""

                ticket.resolution_type = "refund_issued"
                ticket.refund_amount = refund_amount_dec
                ticket.resolution_note = payload.note or f"Refund of ₹{refund_amount_dec} approved{refunded_items_str}."
                ticket.status = "closed"
                ticket.resolved_at = utc_now()
                ticket.closed_at = utc_now()

                if is_cod:
                    payout_str = f" via {payload.payout_mode}" if payload.payout_mode else " (Offline/UPI/Bank Transfer)"
                    ref_str = f" [Ref: {payload.reference_id}]" if payload.reference_id else ""
                    action_msg = f"Resolution Approved: COD Refund of ₹{refund_amount_dec} marked as completed{payout_str}{ref_str}{refunded_items_str}. {payload.note or ''}".strip()
                else:
                    action_msg = f"Resolution Approved: Refund of ₹{refund_amount_dec} initiated{refunded_items_str}. {payload.note or ''}".strip()

                gateway_refund_resp = None
                # Execute real live Razorpay gateway refund if paid online with real Razorpay ID
                if not is_cod and ord.razorpay_payment_id and not ord.razorpay_payment_id.startswith("pay_mock_"):
                    try:
                        from routers.payments import get_razorpay_client
                        client = get_razorpay_client()
                        if client:
                            refund_amount_paise = int(refund_amount_dec * 100)
                            gateway_refund_resp = client.payment.refund(
                                ord.razorpay_payment_id,
                                {
                                    "amount": refund_amount_paise,
                                    "reverse_all": 1 if is_full_refund else 0,
                                    "notes": {
                                        "reason": f"Support Ticket Refund: {payload.note or 'Approved'}",
                                        "ticket_id": str(ticket.id),
                                        "ticket_number": ticket.ticket_number or "",
                                        "order_id": str(ord.id),
                                    },
                                },
                            )
                            if isinstance(gateway_refund_resp, dict) and gateway_refund_resp.get("id"):
                                action_msg += f" (Gateway Refund ID: {gateway_refund_resp.get('id')})"
                    except Exception as rerr:
                        logger.error(f"Razorpay gateway refund error on agent resolution for order {ord.id}: {rerr}", exc_info=True)
                        raise HTTPException(
                            status_code=400,
                            detail=f"Razorpay Gateway Refund Failed: {str(rerr)}"
                        )

                # Record in refund history
                snapshot = dict(ord.pricing_snapshot or {})
                refund_history = list(snapshot.get("refund_history") or [])
                if not refund_history and snapshot.get("refund_details"):
                    refund_history.append(snapshot.get("refund_details"))

                refund_tx = {
                    "refund_id": gateway_refund_resp.get("id") if isinstance(gateway_refund_resp, dict) and gateway_refund_resp.get("id") else (payload.reference_id or f"rf_sup_{str(uuid4())[:8]}"),
                    "status": "processed",
                    "amount": float(refund_amount_dec),
                    "payout_mode": payload.payout_mode or ("Offline Payout / Cash / UPI" if is_cod else "Online Payment Gateway"),
                    "reference_id": payload.reference_id or None,
                    "is_cod": is_cod,
                    "arn": gateway_refund_resp.get("acquirer_data", {}).get("arn") if isinstance(gateway_refund_resp, dict) and isinstance(gateway_refund_resp.get("acquirer_data"), dict) else None,
                    "created_at": utc_now().isoformat(),
                    "source": "support_desk",
                    "actor_name": agent.name,
                    "note": payload.note or f"{'COD Refund' if is_cod else 'Refund'} of ₹{refund_amount_dec} recorded by {agent.name}",
                    "items": [{"order_item_id": str(i.order_item_id), "quantity": i.quantity} for i in payload.items] if payload.items else None,
                }
                refund_history.append(refund_tx)
                snapshot["refund_history"] = refund_history
                snapshot["refund_details"] = refund_tx
                ord.pricing_snapshot = snapshot
                flag_modified(ord, "pricing_snapshot")

                ord.status = "refunded" if is_full_refund else ord.status
                ord.payment_status = "refunded" if is_full_refund else "partially_refunded"
                ord.cancel_reason = f"Support Resolution: {payload.note or 'Refund issued via support ticket'}"
                ord.updated_at = utc_now()

                # Sync any associated Return Request
                ret_req = session.exec(select(ReturnRequest).where(ReturnRequest.order_id == ord.id)).first()
                if ret_req:
                    ret_req.status = "refunded"
                    ret_req.refund_status = "completed"
                    ret_req.final_refund_amount = (ret_req.final_refund_amount or Decimal("0.00")) + refund_amount_dec
                    ret_req.admin_note = payload.note or "Refund processed via support resolution."
                    session.add(ret_req)

                # Reverse ledger entry if needed
                ledger_entry = session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == ord.id)).first()
                if ledger_entry:
                    if is_full_refund:
                        ledger_entry.status = "refunded"
                        ledger_entry.escrow_status = "reversed"
                    session.add(ledger_entry)

                session.add(ord)
        else:
            ticket.resolution_type = "refund_issued"
            ticket.refund_amount = payload.refund_amount
            ticket.resolution_note = payload.note or f"Refund of ₹{payload.refund_amount or 0} recorded."
            ticket.status = "closed"
            ticket.resolved_at = utc_now()
            ticket.closed_at = utc_now()
            action_msg = f"Resolution Approved: Refund of ₹{payload.refund_amount or 0} recorded."

    elif payload.action_type == "replacement":
        ticket.resolution_type = "replacement_sent"
        ticket.resolution_note = payload.note or "Replacement package authorized."
        ticket.status = "closed"
        ticket.resolved_at = utc_now()
        ticket.closed_at = utc_now()

        replaced_items_str = ""
        if ticket.order_id:
            ord = session.get(Order, ticket.order_id)
            if ord:
                order_items = session.exec(select(OrderItem).where(OrderItem.order_id == ord.id)).all()
                repl_summaries = []
                if payload.items:
                    item_map = {item.order_item_id: item.quantity for item in payload.items}
                    for oi in order_items:
                        if oi.id in item_map:
                            oi.status = "confirmed"
                            session.add(oi)
                            qty = min(item_map[oi.id], oi.quantity)
                            repl_summaries.append(f"{qty}x {oi.product_name}")
                else:
                    for oi in order_items:
                        oi.status = "confirmed"
                        session.add(oi)
                if repl_summaries:
                    replaced_items_str = f" for {', '.join(repl_summaries)}"

                # Reset order to confirmed so admin can pack and mark as shipped
                ord.status = "confirmed"
                ord.cancel_reason = f"Replacement Authorized: {payload.note or 'Support resolution replacement'}"
                ord.shipped_at = None
                ord.delivered_at = None
                ord.delivery_otp = f"{secrets.randbelow(9000) + 1000}"
                ord.updated_at = utc_now()

                # Delete previous shipment records so the order is cleanly unassigned for manual admin re-dispatch
                existing_shipments = session.exec(select(Shipment).where(Shipment.order_id == ord.id)).all()
                for s in existing_shipments:
                    session.delete(s)

                session.add(
                    OrderStatusHistory(
                        order_id=ord.id,
                        status="confirmed",
                        changed_by=agent.id,
                        changed_by_type="agent",
                        notes=f"Replacement package authorized{replaced_items_str} by support. Order queued for packing and rider assignment.",
                    )
                )

                session.add(ord)

        action_msg = f"Resolution Approved: Free replacement package authorized{replaced_items_str}. Order #{str(ticket.order_id)[:8] if ticket.order_id else ''} queued under Yet to Ship for admin packing and rider assignment. {payload.note or ''}".strip()

    elif payload.action_type == "cancel_order":
        ticket.resolution_type = "order_cancelled"
        ticket.resolution_note = payload.note or "Order cancelled as requested."
        ticket.status = "closed"
        ticket.resolved_at = utc_now()
        ticket.closed_at = utc_now()
        action_msg = f"Order Cancelled: {payload.note or 'Customer requested cancellation.'}".strip()

        if ticket.order_id:
            ord = session.get(Order, ticket.order_id)
            if ord and ord.status not in ["cancelled", "delivered"]:
                # If online paid with live Razorpay, trigger full gateway refund
                if getattr(ord, "payment_status", None) == "paid" and ord.razorpay_payment_id and not ord.razorpay_payment_id.startswith("pay_mock_"):
                    try:
                        from routers.payments import get_razorpay_client
                        client = get_razorpay_client()
                        if client:
                            refund_amount_paise = int(Decimal(str(ord.total)) * 100)
                            refund_resp = client.payment.refund(
                                ord.razorpay_payment_id,
                                {
                                    "amount": refund_amount_paise,
                                    "reverse_all": 1,
                                    "notes": {
                                        "reason": f"Support Order Cancellation Refund: {payload.note or 'Cancelled'}",
                                        "ticket_id": str(ticket.id),
                                        "order_id": str(ord.id),
                                    },
                                },
                            )
                            if isinstance(refund_resp, dict):
                                snapshot = dict(ord.pricing_snapshot or {})
                                snapshot["refund_details"] = {
                                    "refund_id": refund_resp.get("id"),
                                    "status": refund_resp.get("status", "processed"),
                                    "amount": (refund_resp.get("amount") or refund_amount_paise) / 100,
                                    "arn": refund_resp.get("acquirer_data", {}).get("arn") if isinstance(refund_resp.get("acquirer_data"), dict) else None,
                                    "created_at": refund_resp.get("created_at"),
                                }
                                ord.pricing_snapshot = snapshot
                                flag_modified(ord, "pricing_snapshot")
                                rz_rf_id = refund_resp.get("id")
                                if rz_rf_id:
                                    action_msg += f" (Gateway Refund ID: {rz_rf_id})"
                    except Exception as rerr:
                        logger.error(f"Razorpay refund failed on cancel action for order {ord.id}: {rerr}", exc_info=True)
                        raise HTTPException(
                            status_code=400,
                            detail=f"Razorpay Gateway Refund Failed: {str(rerr)}"
                        )

                ord.status = "cancelled"
                ord.payment_status = "refunded" if getattr(ord, "payment_status", None) == "paid" else ord.payment_status
                ord.cancelled_at = utc_now()
                ord.cancel_reason = f"Support Resolution: {payload.note or 'Cancelled via ticket'}"
                ord.updated_at = utc_now()

                ledger_entry = session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == ord.id)).first()
                if ledger_entry:
                    ledger_entry.status = "refunded"
                    ledger_entry.escrow_status = "reversed"
                    session.add(ledger_entry)

                session.add(ord)

    elif payload.action_type in ("resolve", "resolved", "close", "closed", "done"):
        ticket.resolution_type = "ticket_closed"
        ticket.resolution_note = payload.note or "Case closed."
        ticket.status = "closed"
        ticket.resolved_at = utc_now()
        ticket.closed_at = utc_now()
        action_msg = f"Case Closed: {payload.note or 'Issue concluded successfully.'}".strip()

    elif payload.action_type in ("reopen", "open"):
        ticket.status = "open"
        ticket.resolution_type = None
        ticket.resolution_note = None
        ticket.resolved_at = None
        ticket.closed_at = None
        action_msg = f"Case Re-Opened: {payload.note or 'Case has been reopened for further investigation.'}"

    ticket.updated_at = utc_now()
    session.add(ticket)

    res_msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="agent",
        sender_name=agent.name,
        message=action_msg,
        is_internal_note=False,
    )
    session.add(res_msg)

    session.commit()
    session.refresh(res_msg)
    session.refresh(ticket)

    msg_dict = {
        "id": str(res_msg.id),
        "sender_type": res_msg.sender_type,
        "sender_id": str(res_msg.sender_id) if res_msg.sender_id else None,
        "sender_name": res_msg.sender_name,
        "message": res_msg.message,
        "attachments": res_msg.attachments or [],
        "is_internal_note": res_msg.is_internal_note,
        "created_at": res_msg.created_at.isoformat() if res_msg.created_at else None,
        "read_at": None,
    }
    ticket_hub.broadcast(str(ticket.id), {
        "type": "new_message",
        "message": msg_dict,
        "ticket_status": ticket.status,
    })

    return {
        "success": True,
        "message": f"Action '{payload.action_type}' executed successfully.",
        "ticket_status": ticket.status,
    }


# ---------------------------------------------------------------------------
# Support & CRM Service Settings
# ---------------------------------------------------------------------------

class SupportSettingsPayload(BaseModel):
    crm_enabled: bool = True


@router.get("/sites/{site_id}/support/settings")
def get_support_settings(
    site_id: str,
    session: Session = Depends(get_session),
):
    """Retrieve whether CRM and customer support services are enabled for a store."""
    site = None
    try:
        uuid_val = UUID(site_id)
        site = session.get(Site, uuid_val)
    except Exception:
        pass

    if not site:
        site = session.exec(select(Site).where(Site.slug == site_id)).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    site_def = site.site_definition if isinstance(site.site_definition, dict) else {}
    crm_enabled = site_def.get("crm_enabled", True)

    return {
        "site_id": str(site.id),
        "slug": site.slug,
        "crm_enabled": bool(crm_enabled),
    }


@router.put("/admin/sites/{site_id}/support/settings")
def update_support_settings(
    site_id: str,
    payload: SupportSettingsPayload,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """Enable or disable CRM & Customer Support services for the store (supports UUID or slug)."""
    site = None
    try:
        uuid_val = UUID(site_id)
        site = session.get(Site, uuid_val)
    except Exception:
        pass

    if not site:
        site = session.exec(select(Site).where(Site.slug == site_id)).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Verify admin ownership
    admin_id = admin.get("adminId")
    try:
        admin_uuid = UUID(admin_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid admin token payload")

    ownership = session.exec(
        select(AdminSite).where(
            AdminSite.admin_id == admin_uuid,
            AdminSite.site_id == site.id,
        )
    ).first()

    if not ownership:
        raise HTTPException(status_code=403, detail="Admin does not have access to this site")

    # Update site_definition
    site_def = dict(site.site_definition) if isinstance(site.site_definition, dict) else {}
    site_def["crm_enabled"] = bool(payload.crm_enabled)
    site.site_definition = site_def
    flag_modified(site, "site_definition")

    # Update draft_definition if present
    if site.draft_definition is not None and isinstance(site.draft_definition, dict):
        draft_def = dict(site.draft_definition)
        draft_def["crm_enabled"] = bool(payload.crm_enabled)
        site.draft_definition = draft_def
        flag_modified(site, "draft_definition")

    site.updated_at = utc_now()
    session.add(site)
    session.commit()
    session.refresh(site)

    # Invalidate public cache
    try:
        from main import invalidate_public_site_cache
        invalidate_public_site_cache(slug=site.slug, site_id=site.id)
    except Exception:
        pass

    return {
        "success": True,
        "site_id": str(site.id),
        "slug": site.slug,
        "crm_enabled": bool(payload.crm_enabled),
        "message": f"CRM services {'enabled' if payload.crm_enabled else 'disabled'} successfully.",
    }


# ---------------------------------------------------------------------------
# Admin Support Agent Management Routes
# ---------------------------------------------------------------------------

@router.get("/admin/sites/{site_id}/support-agents")
def list_support_agents(
    site_id: UUID,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """Store Admin lists all registered support agents for their site."""
    agents = session.exec(
        select(SupportAgent)
        .where(SupportAgent.site_id == site_id)
        .order_by(SupportAgent.created_at.desc())
    ).all()

    # Recalculate live ticket counts for accuracy
    result = []
    for ag in agents:
        open_count = session.exec(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.site_id == site_id,
                SupportTicket.assigned_agent_id == ag.id,
                SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]),
            )
        ).one()

        resolved_count = session.exec(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.site_id == site_id,
                SupportTicket.assigned_agent_id == ag.id,
                SupportTicket.status.in_(["resolved", "closed"]),
            )
        ).one()

        result.append({
            "id": str(ag.id),
            "name": ag.name,
            "email": ag.email,
            "phone": ag.phone,
            "role": ag.role,
            "is_active": ag.is_active,
            "assigned_ticket_count": open_count,
            "total_resolved_count": resolved_count,
            "created_at": ag.created_at.isoformat() if ag.created_at else None,
        })

    return {"agents": result}


@router.post("/admin/sites/{site_id}/support-agents")
def create_support_agent(
    site_id: UUID,
    payload: SupportAgentCreate,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """Store Admin provisions a new support staff account."""
    clean_name = (payload.name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Staff name is required")

    clean_email = (payload.email or "").strip().lower()
    if not clean_email or "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please provide a valid email address (e.g. name@domain.com)")

    clean_password = (payload.password or "").strip()
    if len(clean_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    existing = session.exec(
        select(SupportAgent).where(
            SupportAgent.site_id == site_id,
            SupportAgent.email == clean_email,
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An agent with email '{clean_email}' already exists on this store",
        )

    agent = SupportAgent(
        site_id=site_id,
        name=clean_name,
        email=clean_email,
        phone=payload.phone.strip() if payload.phone and payload.phone.strip() else None,
        password_hash=hash_password(clean_password),
        role=payload.role if payload.role in ("agent", "lead") else "agent",
        is_active=True,
    )
    session.add(agent)
    session.commit()
    session.refresh(agent)

    return {
        "success": True,
        "message": f"Support Agent '{agent.name}' created successfully",
        "agent": {
            "id": str(agent.id),
            "name": agent.name,
            "email": agent.email,
            "role": agent.role,
            "is_active": agent.is_active,
        },
    }


@router.patch("/admin/sites/{site_id}/support-agents/{agent_id}")
def update_support_agent(
    site_id: UUID,
    agent_id: UUID,
    payload: SupportAgentUpdate,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """Update support agent details, role, or active status."""
    agent = session.get(SupportAgent, agent_id)
    if not agent or agent.site_id != site_id:
        raise HTTPException(status_code=404, detail="Support agent not found")

    if payload.name is not None:
        agent.name = payload.name.strip()
    if payload.phone is not None:
        agent.phone = payload.phone.strip() if payload.phone else None
    if payload.role is not None:
        agent.role = payload.role
    if payload.is_active is not None:
        agent.is_active = payload.is_active
    if payload.password:
        agent.password_hash = hash_password(payload.password)

    agent.updated_at = utc_now()
    session.add(agent)
    session.commit()
    session.refresh(agent)

    return {"success": True, "agent": {"id": str(agent.id), "name": agent.name, "is_active": agent.is_active}}


@router.delete("/admin/sites/{site_id}/support-agents/{agent_id}")
def delete_support_agent(
    site_id: UUID,
    agent_id: UUID,
    admin=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """Deactivate and unassign tickets from a support agent."""
    agent = session.get(SupportAgent, agent_id)
    if not agent or agent.site_id != site_id:
        raise HTTPException(status_code=404, detail="Support agent not found")

    # Unassign pending tickets
    pending_tickets = session.exec(
        select(SupportTicket).where(
            SupportTicket.site_id == site_id,
            SupportTicket.assigned_agent_id == agent_id,
            SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]),
        )
    ).all()
    for t in pending_tickets:
        t.assigned_agent_id = None
        session.add(t)

    session.delete(agent)
    session.commit()

    return {"success": True, "message": "Support agent removed successfully"}


def _resolve_site_uuid(site_id_or_slug: str, session: Session) -> UUID:
    try:
        return UUID(str(site_id_or_slug))
    except (ValueError, TypeError):
        site = session.exec(select(Site).where(Site.slug == str(site_id_or_slug))).first()
        if site:
            return site.id
        raise HTTPException(status_code=404, detail="Store not found")


@router.post("/sites/{site_id}/support/tickets")
def create_customer_ticket(
    site_id: str,
    payload: CreateTicketRequest,
    customer=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    """Customer submits a new grievance or order inquiry ticket."""
    resolved_site_id = _resolve_site_uuid(site_id, session)
    customer_id = UUID(customer["userId"])

    site = session.get(Site, resolved_site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Store not found")
    site_def = site.site_definition if isinstance(site.site_definition, dict) else {}
    if not site_def.get("crm_enabled", True):
        raise HTTPException(
            status_code=403,
            detail="Customer support and CRM services are currently disabled for this store.",
        )

    # Optional order validation
    order = None
    if payload.order_id:
        order = session.get(Order, payload.order_id)
        if not order or order.site_id != resolved_site_id or order.customer_id != customer_id:
            raise HTTPException(status_code=400, detail="Invalid order specified")


    # Check for existing open ticket on the same order with same category to prevent duplicate spam
    if payload.order_id:
        existing_ticket = session.exec(
            select(SupportTicket).where(
                SupportTicket.site_id == resolved_site_id,
                SupportTicket.customer_id == customer_id,
                SupportTicket.order_id == payload.order_id,
                SupportTicket.category == payload.category,
                SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]),
            )
        ).first()
        if existing_ticket:
            raise HTTPException(
                status_code=409,
                detail=f"An active ticket (#{existing_ticket.ticket_number}) is already open for this issue on Order #{str(payload.order_id)[:8]}.",
            )

    ticket = SupportTicket(
        ticket_number=generate_ticket_number(),
        site_id=resolved_site_id,
        customer_id=customer_id,
        order_id=payload.order_id,
        category=payload.category,
        priority=payload.priority,
        status="open",
        subject=payload.subject.strip(),
        order_items_summary=payload.order_items_summary,
        customer_refund_account=payload.customer_refund_account,
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)

    # Initial message
    customer_user = session.get(User, customer_id)
    cust_name = customer_user.name if customer_user and customer_user.name else "Customer"

    init_msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="customer",
        sender_id=customer_id,
        sender_name=cust_name,
        message=payload.message.strip(),
        attachments=payload.attachments or [],
        is_internal_note=False,
    )
    session.add(init_msg)
    session.commit()

    return {
        "success": True,
        "message": f"Support ticket #{ticket.ticket_number} created successfully",
        "ticket": {
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "status": ticket.status,
            "category": ticket.category,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        },
    }


@router.get("/sites/{site_id}/support/tickets/my")
def get_my_support_tickets(
    site_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(8, ge=1, le=100),
    customer=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    """Customer retrieves paginated support tickets with total count."""
    resolved_site_id = _resolve_site_uuid(site_id, session)
    customer_id = UUID(customer["userId"])

    total_query = select(func.count(SupportTicket.id)).where(
        SupportTicket.site_id == resolved_site_id,
        SupportTicket.customer_id == customer_id,
    )
    total = session.exec(total_query).one() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    offset = (page - 1) * page_size
    tickets = session.exec(
        select(SupportTicket)
        .where(
            SupportTicket.site_id == resolved_site_id,
            SupportTicket.customer_id == customer_id,
        )
        .order_by(SupportTicket.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    results = []
    for t in tickets:
        # Get last message
        last_msg = session.exec(
            select(SupportTicketMessage)
            .where(
                SupportTicketMessage.ticket_id == t.id,
                SupportTicketMessage.is_internal_note == False,
            )
            .order_by(SupportTicketMessage.created_at.desc())
        ).first()

        agent_name = None
        if t.assigned_agent_id:
            ag = session.get(SupportAgent, t.assigned_agent_id)
            if ag:
                agent_name = ag.name

        results.append({
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "order_id": str(t.order_id) if t.order_id else None,
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "subject": t.subject,
            "order_items_summary": t.order_items_summary,
            "resolution_type": t.resolution_type,
            "resolution_note": t.resolution_note,
            "assigned_agent_name": agent_name,
            "last_message": last_msg.message if last_msg else None,
            "last_message_at": last_msg.created_at.isoformat() if last_msg else None,
            "last_sender_type": last_msg.sender_type if last_msg else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
        })

    return {
        "tickets": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/sites/{site_id}/support/tickets/{ticket_id}")
def get_customer_ticket_detail(
    site_id: str,
    ticket_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    customer=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    """Customer views ticket thread and status with paginated message history."""
    resolved_site_id = _resolve_site_uuid(site_id, session)
    customer_id = UUID(customer["userId"])

    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != resolved_site_id or ticket.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    total_msg_query = select(func.count(SupportTicketMessage.id)).where(
        SupportTicketMessage.ticket_id == ticket_id,
        SupportTicketMessage.is_internal_note == False,
    )
    total_messages = session.exec(total_msg_query).one() or 0
    total_msg_pages = math.ceil(total_messages / page_size) if total_messages > 0 else 1

    # Mark unread staff messages as read by customer (WhatsApp seen receipt)
    unread_staff_msgs = session.exec(
        select(SupportTicketMessage).where(
            SupportTicketMessage.ticket_id == ticket.id,
            SupportTicketMessage.sender_type.in_(["agent", "admin"]),
            SupportTicketMessage.is_internal_note == False,
            SupportTicketMessage.read_at.is_(None),
        )
    ).all()
    if unread_staff_msgs:
        seen_now = utc_now()
        for um in unread_staff_msgs:
            um.read_at = seen_now
            session.add(um)
        session.commit()
        ticket_hub.broadcast(str(ticket.id), {
            "type": "messages_read",
            "reader": "customer",
            "read_at": seen_now.isoformat(),
        })

    offset = (page - 1) * page_size
    messages_desc = session.exec(
        select(SupportTicketMessage)
        .where(
            SupportTicketMessage.ticket_id == ticket_id,
            SupportTicketMessage.is_internal_note == False,
        )
        .order_by(SupportTicketMessage.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    # Chronological ascending order for the loaded batch
    messages = list(reversed(messages_desc))

    agent_name = None
    if ticket.assigned_agent_id:
        ag = session.get(SupportAgent, ticket.assigned_agent_id)
        if ag:
            agent_name = ag.name

    # Order snippet if linked
    order_data = None
    if ticket.order_id:
        od = session.get(Order, ticket.order_id)
        if od:
            order_data = {
                "id": str(od.id),
                "total": float(od.total),
                "status": od.status,
                "payment_method": od.payment_method,
                "created_at": od.created_at.isoformat() if od.created_at else None,
            }

    return {
        "ticket": {
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "order_id": str(ticket.order_id) if ticket.order_id else None,
            "category": ticket.category,
            "priority": ticket.priority,
            "status": ticket.status,
            "subject": ticket.subject,
            "assigned_agent_name": agent_name,
            "order_items_summary": ticket.order_items_summary,
            "resolution_type": ticket.resolution_type,
            "resolution_note": ticket.resolution_note,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
            "order": order_data,
        },
        "messages": [
            {
                "id": str(m.id),
                "sender_type": m.sender_type,
                "sender_name": m.sender_name,
                "message": m.message,
                "attachments": m.attachments or [],
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "read_at": m.read_at.isoformat() if m.read_at else None,
            }
            for m in messages
        ],
        "pagination": {
            "total": total_messages,
            "page": page,
            "page_size": page_size,
            "total_pages": total_msg_pages,
            "has_more_older": page < total_msg_pages,
        },
    }


@router.post("/sites/{site_id}/support/tickets/{ticket_id}/messages")
def customer_reply_ticket(
    site_id: str,
    ticket_id: UUID,
    payload: AddTicketMessageRequest,
    customer=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    """Customer sends a follow-up reply to support."""
    resolved_site_id = _resolve_site_uuid(site_id, session)
    customer_id = UUID(customer["userId"])

    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != resolved_site_id or ticket.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status == "closed":
        # Check 5-day grace window for reopening
        if ticket.closed_at:
            delta = utc_now() - ticket.closed_at
            if delta.days > 5:
                raise HTTPException(
                    status_code=400,
                    detail="This ticket has been permanently closed for more than 5 days. Please open a new ticket.",
                )
        ticket.status = "open"

    # If ticket was waiting for customer, flip back to open
    if ticket.status == "waiting_customer":
        ticket.status = "open"

    ticket.updated_at = utc_now()
    session.add(ticket)

    customer_user = session.get(User, customer_id)
    cust_name = customer_user.name if customer_user and customer_user.name else "Customer"

    msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="customer",
        sender_id=customer_id,
        sender_name=cust_name,
        message=payload.message.strip(),
        attachments=payload.attachments or [],
        is_internal_note=False,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)

    msg_dict = {
        "id": str(msg.id),
        "sender_type": msg.sender_type,
        "sender_name": msg.sender_name,
        "message": msg.message,
        "attachments": msg.attachments or [],
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "read_at": None,
    }
    ticket_hub.broadcast(str(ticket.id), {
        "type": "new_message",
        "message": msg_dict,
    })

    return {
        "success": True,
        "message": msg_dict,
    }


@router.post("/sites/{site_id}/support/upload-image")
async def upload_support_image(
    site_id: str,
    request: Request,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """Uploads a support screenshot or photo attachment for tickets and chat messages."""
    resolved_site_id = _resolve_site_uuid(site_id, session)

    # Check authentication (customer, support agent, or admin)
    auth_header = request.headers.get("Authorization", "")
    bearer_token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else None

    is_authenticated = False
    for tok in (bearer_token, request.cookies.get("customer_token"), request.cookies.get("admin_token"), request.cookies.get("support_token")):
        if tok:
            payload = decode_token(tok)
            if payload and payload.get("tokenType") in ("customer", "admin", "support_agent"):
                is_authenticated = True
                break

    if not is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to upload support attachments",
        )

    if not file.content_type or file.content_type.lower() not in ALLOWED_SUPPORT_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Allowed: PNG, JPEG, JPG, WEBP, GIF",
        )

    extension = Path(file.filename or "image").suffix.lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file uploaded")

    filename = save_optimized_upload_image(content, SUPPORT_UPLOADS_DIR, extension)

    return {
        "success": True,
        "url": f"/uploads/support/{filename}",
        "filename": filename,
    }


@router.post("/sites/{site_id}/support/tickets/{ticket_id}/close")
def customer_close_ticket(
    site_id: str,
    ticket_id: UUID,
    customer=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    """Customer can self-close their ticket when satisfied."""
    resolved_site_id = _resolve_site_uuid(site_id, session)
    customer_id = UUID(customer["userId"])

    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != resolved_site_id or ticket.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = "closed"
    ticket.closed_at = utc_now()
    ticket.updated_at = utc_now()
    session.add(ticket)

    # Add system notification message
    sys_msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="system",
        sender_name="System",
        message="Ticket marked as resolved and closed by the customer.",
        is_internal_note=False,
    )
    session.add(sys_msg)
    session.commit()

    return {"success": True, "message": "Ticket closed successfully"}


# ---------------------------------------------------------------------------
# Admin & Support Staff Operations (CRM Desk)
# ---------------------------------------------------------------------------

@router.get("/admin/sites/{site_id}/support/tickets")
def admin_list_support_tickets(
    site_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    category: Optional[str] = None,
    agent_id: Optional[str] = None,  # "unassigned" | "my" | specific UUID
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=5, le=100),
    actor=Depends(authenticate_admin_or_support_agent),
    session: Session = Depends(get_session),
):
    """Filterable, searchable list of tickets formatted identically to AdminOrders."""
    query = select(SupportTicket).where(SupportTicket.site_id == site_id)

    is_agent = actor["actor_type"] == "agent"
    agent_uuid = UUID(actor["actor_id"]) if is_agent and actor.get("actor_id") else None

    # CRITICAL: If the actor is a support agent, strictly restrict all queries to tickets assigned directly to this agent
    if is_agent:
        query = query.where(SupportTicket.assigned_agent_id == agent_uuid)

    # Status tab filtering
    if status_filter and status_filter != "all":
        if status_filter == "unassigned":
            if is_agent:
                query = query.where(SupportTicket.id == None)  # Agents cannot access unassigned pool
            else:
                query = query.where(
                    SupportTicket.assigned_agent_id == None,
                    SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]),
                )
        elif status_filter == "my":
            if is_agent:
                query = query.where(
                    SupportTicket.assigned_agent_id == agent_uuid,
                    SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]),
                )
        elif status_filter == "waiting_customer":
            query = query.where(SupportTicket.status == "waiting_customer")
        elif status_filter == "resolved":
            query = query.where(SupportTicket.status.in_(["resolved", "closed"]))
        else:
            query = query.where(SupportTicket.status == status_filter)
    else:
        # Default / "all" active tab only displays active/open tickets; resolved tickets stay in "Resolved / Done"
        query = query.where(SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]))

    # Priority filter
    if priority and priority != "all":
        query = query.where(SupportTicket.priority == priority)

    # Category filter
    if category and category != "all":
        query = query.where(SupportTicket.category == category)

    # Specific agent filter (only available to Store Admin)
    if agent_id and not is_agent:
        if agent_id == "unassigned":
            query = query.where(SupportTicket.assigned_agent_id == None)
        else:
            try:
                query = query.where(SupportTicket.assigned_agent_id == UUID(agent_id))
            except ValueError:
                pass

    # Search (ticket number, subject)
    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        query = query.where(
            col(SupportTicket.ticket_number).ilike(s) | col(SupportTicket.subject).ilike(s)
        )

    # Calculate Tab Badge Counts for Store Control
    base_site_query = select(func.count(SupportTicket.id)).where(SupportTicket.site_id == site_id)
    
    if is_agent:
        agent_base = base_site_query.where(SupportTicket.assigned_agent_id == agent_uuid)
        active_count = session.exec(
            agent_base.where(SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]))
        ).one()
        unassigned_count = 0
        waiting_cust_count = session.exec(
            agent_base.where(SupportTicket.status == "waiting_customer")
        ).one()
        resolved_count = session.exec(
            agent_base.where(SupportTicket.status.in_(["resolved", "closed"]))
        ).one()
        my_count = active_count
    else:
        active_count = session.exec(
            base_site_query.where(SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]))
        ).one()
        unassigned_count = session.exec(
            base_site_query.where(
                SupportTicket.assigned_agent_id == None,
                SupportTicket.status.in_(["open", "in_progress", "waiting_customer"]),
            )
        ).one()
        waiting_cust_count = session.exec(
            base_site_query.where(SupportTicket.status == "waiting_customer")
        ).one()
        resolved_count = session.exec(
            base_site_query.where(SupportTicket.status.in_(["resolved", "closed"]))
        ).one()
        my_count = 0

    # Pagination
    total_matching = session.exec(select(func.count()).select_from(query.subquery())).one()
    offset = (page - 1) * page_size
    tickets = session.exec(
        query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(page_size)
    ).all()

    # Populate customer and agent names
    items = []
    for t in tickets:
        cust = session.get(User, t.customer_id)
        agent = session.get(SupportAgent, t.assigned_agent_id) if t.assigned_agent_id else None
        
        # Last message snippet
        last_m = session.exec(
            select(SupportTicketMessage)
            .where(SupportTicketMessage.ticket_id == t.id)
            .order_by(SupportTicketMessage.created_at.desc())
        ).first()

        items.append({
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "order_id": str(t.order_id) if t.order_id else None,
            "category": t.category,
            "priority": t.priority,
            "status": t.status,
            "subject": t.subject,
            "order_items_summary": t.order_items_summary,
            "customer": {
                "id": str(cust.id) if cust else str(t.customer_id),
                "name": cust.name if cust and cust.name else "Customer",
                "email": cust.email if cust else None,
                "phone": cust.phone if cust else None,
            },
            "assigned_agent": {
                "id": str(agent.id) if agent else None,
                "name": agent.name if agent else "Unassigned",
            },
            "last_message": last_m.message if last_m else None,
            "last_message_sender": last_m.sender_name if last_m else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        })

    return {
        "tickets": items,
        "pagination": {
            "total_items": total_matching,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total_matching + page_size - 1) // page_size),
        },
        "counts": {
            "all": active_count,
            "unassigned": unassigned_count,
            "my_tickets": my_count,
            "waiting_customer": waiting_cust_count,
            "resolved": resolved_count,
        },
    }


@router.get("/admin/sites/{site_id}/support/tickets/{ticket_id}")
def admin_get_ticket_detail(
    site_id: UUID,
    ticket_id: UUID,
    actor=Depends(authenticate_admin_or_support_agent),
    session: Session = Depends(get_session),
):
    """Full ticket detail with Order 360, Rider Context, Customer CRM Profile, and all messages."""
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if actor["actor_type"] == "agent" and ticket.assigned_agent_id != UUID(actor["actor_id"]):
        raise HTTPException(status_code=403, detail="Access restricted: This case is not assigned to you.")

    # 1. Customer CRM Profile
    cust = session.get(User, ticket.customer_id)
    total_cust_orders = session.exec(
        select(func.count(Order.id)).where(
            Order.site_id == site_id,
            Order.customer_id == ticket.customer_id,
            Order.status != "pending",
        )
    ).one()
    total_cust_spend = session.exec(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.site_id == site_id,
            Order.customer_id == ticket.customer_id,
            Order.status.notin_(["pending", "cancelled"]),
        )
    ).one()
    total_cust_disputes = session.exec(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.site_id == site_id,
            SupportTicket.customer_id == ticket.customer_id,
        )
    ).one()

    # 2. Order 360 Context & Comprehensive Return/Refund History
    order_context = None
    if ticket.order_id:
        ord = session.get(Order, ticket.order_id)
        if ord:
            # Order items
            order_items = session.exec(
                select(OrderItem).where(OrderItem.order_id == ord.id)
            ).all()

            # Shipment & Rider
            shipment = session.exec(
                select(Shipment).where(Shipment.order_id == ord.id)
            ).first()

            # Query all return requests for this order
            all_return_requests = session.exec(
                select(ReturnRequest)
                .where(ReturnRequest.order_id == ord.id)
                .order_by(ReturnRequest.created_at.desc())
            ).all()

            return_req_ids = [r.id for r in all_return_requests]
            all_return_items = session.exec(
                select(ReturnItem)
                .where(ReturnItem.return_request_id.in_(return_req_ids))
            ).all() if return_req_ids else []

            ret_items_by_req_id: dict[UUID, list[ReturnItem]] = {}
            for r_it in all_return_items:
                ret_items_by_req_id.setdefault(r_it.return_request_id, []).append(r_it)

            # Build returns history list
            returns_history_list = []
            for ret in all_return_requests:
                items_in_ret = ret_items_by_req_id.get(ret.id, [])
                returns_history_list.append({
                    "id": str(ret.id),
                    "status": ret.status,
                    "refund_status": ret.refund_status,
                    "request_note": ret.request_note,
                    "admin_note": ret.admin_note,
                    "rejection_reason": ret.rejection_reason,
                    "refund_override_reason": ret.refund_override_reason,
                    "suggested_refund_amount": float(ret.suggested_refund_amount) if ret.suggested_refund_amount is not None else 0.0,
                    "final_refund_amount": float(ret.final_refund_amount) if ret.final_refund_amount is not None else 0.0,
                    "refund_method": ret.refund_method,
                    "pickup_status": ret.pickup_status,
                    "created_at": ret.created_at.isoformat() if ret.created_at else None,
                    "approved_at": ret.approved_at.isoformat() if ret.approved_at else None,
                    "received_at": ret.received_at.isoformat() if ret.received_at else None,
                    "inspected_at": ret.inspected_at.isoformat() if ret.inspected_at else None,
                    "refunded_at": ret.refunded_at.isoformat() if ret.refunded_at else None,
                    "items": [
                        {
                            "id": str(ri.id),
                            "order_item_id": str(ri.order_item_id),
                            "product_name": ri.product_name,
                            "quantity_requested": int(ri.quantity_requested or 0),
                            "quantity_approved": int(ri.quantity_approved or 0),
                            "quantity_received": int(ri.quantity_received or 0),
                            "unit_price_paid": float(ri.unit_price_paid) if ri.unit_price_paid is not None else 0.0,
                            "line_refund_final": float(ri.line_refund_final) if ri.line_refund_final is not None else float(ri.line_refund_suggested or 0.0),
                            "reason_code": ri.reason_code,
                            "reason_note": ri.reason_note,
                            "restock_decision": ri.restock_decision,
                        }
                        for ri in items_in_ret
                    ],
                })

            # Calculate total already refunded on this order
            pricing_snap = dict(ord.pricing_snapshot or {})
            refund_transactions_list = []
            if isinstance(pricing_snap.get("refund_history"), list):
                refund_transactions_list.extend(pricing_snap.get("refund_history"))
            elif pricing_snap.get("refund_details"):
                refund_transactions_list.append(pricing_snap.get("refund_details"))

            already_refunded_total = Decimal("0.00")
            for rf in refund_transactions_list:
                if isinstance(rf, dict) and rf.get("amount") is not None:
                    already_refunded_total += Decimal(str(rf.get("amount") or 0))

            # Also check completed return requests if refund_history was empty
            if already_refunded_total == Decimal("0.00"):
                for ret in all_return_requests:
                    if ret.status in ("refunded", "closed") or ret.refund_status == "processed":
                        already_refunded_total += Decimal(str(ret.final_refund_amount or 0))

            if ord.status == "refunded" or ord.payment_status == "refunded":
                already_refunded_total = max(already_refunded_total, Decimal(str(ord.total)))

            total_paid_dec = Decimal(str(ord.total or 0))
            if already_refunded_total > total_paid_dec:
                already_refunded_total = total_paid_dec

            remaining_refundable_dec = max(Decimal("0.00"), total_paid_dec - already_refunded_total)
            is_fully_refunded = remaining_refundable_dec <= Decimal("0.00") or ord.status == "refunded" or ord.payment_status == "refunded"

            refund_summary = {
                "total_paid": float(total_paid_dec),
                "already_refunded": float(already_refunded_total),
                "remaining_refundable": float(remaining_refundable_dec),
                "is_fully_refunded": is_fully_refunded,
                "payment_method": ord.payment_method,
                "payment_status": ord.payment_status,
                "razorpay_payment_id": ord.razorpay_payment_id,
            }

            order_context = {
                "id": str(ord.id),
                "status": ord.status,
                "total": float(ord.total),
                "payment_method": ord.payment_method,
                "payment_status": ord.payment_status,
                "shipping_address": ord.shipping_address,
                "delivery_otp": ord.delivery_otp,
                "created_at": ord.created_at.isoformat() if ord.created_at else None,
                "delivered_at": ord.delivered_at.isoformat() if ord.delivered_at else None,
                "items": [
                    {
                        "id": str(it.id),
                        "product_name": it.product_name,
                        "product_image": it.product_image,
                        "variant": it.selected_variant_value,
                        "quantity": it.quantity,
                        "unit_price": float(it.unit_price),
                        "line_total": float(it.line_total),
                    }
                    for it in order_items
                ],
                "shipment": {
                    "delivery_mode": shipment.delivery_mode,
                    "status": shipment.status,
                    "courier_name": shipment.courier_name or shipment.delivery_partner_name,
                    "awb_number": shipment.awb_number,
                    "rider_phone": shipment.delivery_partner_phone,
                    "proof_of_delivery_url": shipment.proof_of_delivery_url,
                } if shipment else None,
                "refund_summary": refund_summary,
                "pricing_snapshot": pricing_snap,
                "returns_history": returns_history_list,
                "refund_transactions": refund_transactions_list,
            }

    # Mark unread customer messages as read by admin/agent (WhatsApp seen receipt)
    unread_customer_msgs = session.exec(
        select(SupportTicketMessage).where(
            SupportTicketMessage.ticket_id == ticket.id,
            SupportTicketMessage.sender_type == "customer",
            SupportTicketMessage.read_at.is_(None),
        )
    ).all()
    if unread_customer_msgs:
        seen_now = utc_now()
        for um in unread_customer_msgs:
            um.read_at = seen_now
            session.add(um)
        session.commit()
        ticket_hub.broadcast(str(ticket.id), {
            "type": "messages_read",
            "reader": "admin",
            "read_at": seen_now.isoformat(),
        })

    # 3. All Messages (including staff internal notes)
    messages = session.exec(
        select(SupportTicketMessage)
        .where(SupportTicketMessage.ticket_id == ticket.id)
        .order_by(SupportTicketMessage.created_at.asc())
    ).all()

    assigned_agent = session.get(SupportAgent, ticket.assigned_agent_id) if ticket.assigned_agent_id else None

    ret_req = session.exec(select(ReturnRequest).where(ReturnRequest.order_id == ord.id)).first() if (ticket.order_id and ord) else None

    return {
        "ticket": {
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "order_id": str(ticket.order_id) if ticket.order_id else None,
            "category": ticket.category,
            "priority": ticket.priority,
            "status": ticket.status,
            "subject": ticket.subject,
            "order_items_summary": ticket.order_items_summary,
            "customer_refund_account": ticket.customer_refund_account,
            "resolution_type": ticket.resolution_type,
            "resolution_note": ticket.resolution_note,
            "refund_amount": float(ticket.refund_amount) if ticket.refund_amount else None,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
            "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        },
        "assigned_agent": {
            "id": str(assigned_agent.id) if assigned_agent else None,
            "name": assigned_agent.name if assigned_agent else "Unassigned",
        },
        "customer_crm": {
            "id": str(cust.id) if cust else str(ticket.customer_id),
            "name": cust.name if cust and cust.name else "Customer",
            "email": cust.email if cust else None,
            "phone": cust.phone if cust else None,
            "total_orders": total_cust_orders,
            "total_spend": float(total_cust_spend),
            "total_disputes": total_cust_disputes,
        },
        "order_360": order_context,
        "return_request": {
            "id": str(ret_req.id),
            "status": ret_req.status,
            "suggested_refund_amount": float(ret_req.suggested_refund_amount) if ret_req.suggested_refund_amount is not None else None,
            "final_refund_amount": float(ret_req.final_refund_amount) if ret_req.final_refund_amount is not None else None,
        } if ret_req else None,
        "messages": [
            {
                "id": str(m.id),
                "sender_type": m.sender_type,
                "sender_id": str(m.sender_id) if m.sender_id else None,
                "sender_name": m.sender_name,
                "message": m.message,
                "attachments": m.attachments or [],
                "is_internal_note": m.is_internal_note,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "read_at": m.read_at.isoformat() if m.read_at else None,
            }
            for m in messages
        ],
    }


@router.post("/admin/sites/{site_id}/support/tickets/{ticket_id}/messages")
def admin_reply_ticket(
    site_id: UUID,
    ticket_id: UUID,
    payload: AddTicketMessageRequest,
    actor=Depends(authenticate_admin_or_support_agent),
    session: Session = Depends(get_session),
):
    """Staff sends a public message to the customer or records an internal yellow note."""
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if actor["actor_type"] == "agent" and ticket.assigned_agent_id != UUID(actor["actor_id"]):
        raise HTTPException(status_code=403, detail="Access restricted: You can only reply to cases assigned directly to you.")

    sender_type = "admin" if actor["actor_type"] == "admin" else "agent"
    sender_id = UUID(actor["actor_id"]) if actor.get("actor_id") else None
    sender_name = actor.get("name") or "Support Team"

    msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type=sender_type,
        sender_id=sender_id,
        sender_name=sender_name,
        message=payload.message.strip(),
        attachments=payload.attachments or [],
        is_internal_note=payload.is_internal_note,
    )
    session.add(msg)

    # If public message sent to customer, transition ticket to "waiting_customer" unless resolved
    if not payload.is_internal_note and ticket.status != "resolved":
        ticket.status = "waiting_customer"

    ticket.updated_at = utc_now()
    session.add(ticket)
    session.commit()
    session.refresh(msg)

    msg_dict = {
        "id": str(msg.id),
        "sender_type": msg.sender_type,
        "sender_id": str(msg.sender_id) if msg.sender_id else None,
        "sender_name": msg.sender_name,
        "message": msg.message,
        "attachments": msg.attachments or [],
        "is_internal_note": msg.is_internal_note,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "read_at": None,
    }
    ticket_hub.broadcast(str(ticket.id), {
        "type": "new_message",
        "message": msg_dict,
    })

    return {
        "success": True,
        "message": msg_dict,
    }


@router.patch("/admin/sites/{site_id}/support/tickets/{ticket_id}/assign")
def assign_ticket_agent(
    site_id: UUID,
    ticket_id: UUID,
    payload: AssignTicketRequest,
    actor=Depends(authenticate_admin_or_support_agent),
    session: Session = Depends(get_session),
):
    """Assign or reassign a support ticket to an agent."""
    if actor["actor_type"] == "agent":
        raise HTTPException(status_code=403, detail="Only store administrators can assign or reassign tickets.")

    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    agent_name = "Unassigned"
    if payload.agent_id:
        agent = session.get(SupportAgent, payload.agent_id)
        if not agent or agent.site_id != site_id:
            raise HTTPException(status_code=400, detail="Invalid support agent")
        ticket.assigned_agent_id = agent.id
        agent_name = agent.name
    else:
        ticket.assigned_agent_id = None

    ticket.updated_at = utc_now()
    session.add(ticket)

    # Log system message
    sys_msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="system",
        sender_name="System",
        message=f"Case assigned to {agent_name} by {actor.get('name')}.",
        is_internal_note=True,
    )
    session.add(sys_msg)
    session.commit()

    return {"success": True, "assigned_agent": {"id": str(payload.agent_id) if payload.agent_id else None, "name": agent_name}}


@router.patch("/admin/sites/{site_id}/support/tickets/{ticket_id}/status")
def update_ticket_status(
    site_id: UUID,
    ticket_id: UUID,
    payload: UpdateTicketStatusRequest,
    actor=Depends(authenticate_admin_or_support_agent),
    session: Session = Depends(get_session),
):
    """Update priority or status of ticket."""
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if actor["actor_type"] == "agent" and ticket.assigned_agent_id != UUID(actor["actor_id"]):
        raise HTTPException(status_code=403, detail="Access restricted: You can only update cases assigned directly to you.")

    if payload.status:
        ticket.status = payload.status
        if payload.status in ["resolved", "closed"]:
            ticket.resolved_at = utc_now()
            if payload.status == "closed":
                ticket.closed_at = utc_now()

    if payload.priority:
        ticket.priority = payload.priority

    ticket.updated_at = utc_now()
    session.add(ticket)
    session.commit()

    return {"success": True, "status": ticket.status, "priority": ticket.priority}


@router.post("/admin/sites/{site_id}/support/tickets/{ticket_id}/action")
def execute_ticket_resolution_action(
    site_id: UUID,
    ticket_id: UUID,
    payload: TicketActionRequest,
    actor=Depends(authenticate_admin_or_support_agent),
    session: Session = Depends(get_session),
):
    """Executes 1-click dispute resolution (Refund, Re-dispatch, Cancel, or Resolve)."""
    ticket = session.get(SupportTicket, ticket_id)
    if not ticket or ticket.site_id != site_id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if actor["actor_type"] == "agent" and ticket.assigned_agent_id != UUID(actor["actor_id"]):
        raise HTTPException(status_code=403, detail="Access restricted: You can only execute resolution actions on cases assigned directly to you.")

    if ticket.status in ("closed", "resolved") and payload.action_type in ("refund", "replacement", "cancel_order", "close", "resolve"):
        raise HTTPException(
            status_code=400,
            detail="This support ticket is closed and archived. Resolution actions (refund, re-dispatch, cancel) are disabled on closed cases. Please reopen the ticket first if further action is needed.",
        )

    action_msg = ""

    if payload.action_type == "refund":
        if ticket.order_id:
            ord = session.get(Order, ticket.order_id)
            if ord:
                is_cod = (ord.payment_method or "").strip().lower() in ("cod", "cash on delivery", "cash_on_delivery")
                # Calculate all previous refunds
                pricing_snap = dict(ord.pricing_snapshot or {})
                prior_refunds = []
                if isinstance(pricing_snap.get("refund_history"), list):
                    prior_refunds.extend(pricing_snap.get("refund_history"))
                elif pricing_snap.get("refund_details"):
                    prior_refunds.append(pricing_snap.get("refund_details"))

                already_refunded_total = Decimal("0.00")
                for rf in prior_refunds:
                    if isinstance(rf, dict) and rf.get("amount") is not None:
                        already_refunded_total += Decimal(str(rf.get("amount") or 0))

                if already_refunded_total == Decimal("0.00"):
                    all_ret_reqs = session.exec(select(ReturnRequest).where(ReturnRequest.order_id == ord.id)).all()
                    for r_req in all_ret_reqs:
                        if r_req.status in ("refunded", "closed") or r_req.refund_status == "processed":
                            already_refunded_total += Decimal(str(r_req.final_refund_amount or 0))

                if ord.status == "refunded" or ord.payment_status == "refunded":
                    already_refunded_total = max(already_refunded_total, Decimal(str(ord.total)))

                total_order_dec = Decimal(str(ord.total or 0))
                remaining_refundable_dec = max(Decimal("0.00"), total_order_dec - already_refunded_total)

                if remaining_refundable_dec <= Decimal("0.00"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot issue refund. Order #{str(ord.id)[:8]} has already been fully refunded (₹{already_refunded_total} of ₹{total_order_dec}).",
                    )

                refund_amount_dec = Decimal(str(payload.refund_amount if payload.refund_amount is not None else remaining_refundable_dec))
                if refund_amount_dec <= Decimal("0.00"):
                    raise HTTPException(status_code=400, detail="Refund amount must be greater than ₹0.00.")

                if refund_amount_dec > remaining_refundable_dec:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot refund ₹{refund_amount_dec}. The maximum remaining refundable balance for this order is ₹{remaining_refundable_dec}.",
                    )

                new_total_refunded = already_refunded_total + refund_amount_dec
                is_full_refund = new_total_refunded >= total_order_dec

                refund_item_summaries = []
                order_items = session.exec(select(OrderItem).where(OrderItem.order_id == ord.id)).all()
                if payload.items:
                    item_map = {item.order_item_id: item.quantity for item in payload.items}
                    for oi in order_items:
                        if oi.id in item_map:
                            qty = min(item_map[oi.id], oi.quantity)
                            if qty >= oi.quantity and is_full_refund:
                                oi.status = "refunded"
                                session.add(oi)
                            refund_item_summaries.append(f"{qty}x {oi.product_name}")
                refunded_items_str = f" for {', '.join(refund_item_summaries)}" if refund_item_summaries else ""

                ticket.resolution_type = "refund_issued"
                ticket.refund_amount = refund_amount_dec
                ticket.resolution_note = payload.note or f"Refund of ₹{refund_amount_dec} approved{refunded_items_str}."
                ticket.status = "closed"
                ticket.resolved_at = utc_now()
                ticket.closed_at = utc_now()

                if is_cod:
                    payout_str = f" via {payload.payout_mode}" if payload.payout_mode else " (Offline/UPI/Bank Transfer)"
                    ref_str = f" [Ref: {payload.reference_id}]" if payload.reference_id else ""
                    action_msg = f"Resolution Approved: COD Refund of ₹{refund_amount_dec} marked as completed{payout_str}{ref_str}{refunded_items_str}. {payload.note or ''}".strip()
                else:
                    action_msg = f"Resolution Approved: Refund of ₹{refund_amount_dec} initiated{refunded_items_str}. {payload.note or ''}".strip()

                gateway_refund_resp = None
                # Execute real live Razorpay gateway refund if paid online with real Razorpay ID
                if not is_cod and ord.razorpay_payment_id and not ord.razorpay_payment_id.startswith("pay_mock_"):
                    try:
                        from routers.payments import get_razorpay_client
                        client = get_razorpay_client()
                        if client:
                            refund_amount_paise = int(refund_amount_dec * 100)
                            gateway_refund_resp = client.payment.refund(
                                ord.razorpay_payment_id,
                                {
                                    "amount": refund_amount_paise,
                                    "reverse_all": 1 if is_full_refund else 0,
                                    "notes": {
                                        "reason": f"Support Ticket Refund: {payload.note or 'Approved'}",
                                        "ticket_id": str(ticket.id),
                                        "ticket_number": ticket.ticket_number or "",
                                        "order_id": str(ord.id),
                                    },
                                },
                            )
                            if isinstance(gateway_refund_resp, dict) and gateway_refund_resp.get("id"):
                                action_msg += f" (Gateway Refund ID: {gateway_refund_resp.get('id')})"
                    except Exception as rerr:
                        logger.error(f"Razorpay gateway refund error on admin resolution for order {ord.id}: {rerr}", exc_info=True)
                        raise HTTPException(
                            status_code=400,
                            detail=f"Razorpay Gateway Refund Failed: {str(rerr)}"
                        )

                # Record in refund history
                snapshot = dict(ord.pricing_snapshot or {})
                refund_history = list(snapshot.get("refund_history") or [])
                if not refund_history and snapshot.get("refund_details"):
                    refund_history.append(snapshot.get("refund_details"))

                staff_name = actor.get("name") if isinstance(actor, dict) else "Store Admin"
                refund_tx = {
                    "refund_id": gateway_refund_resp.get("id") if isinstance(gateway_refund_resp, dict) and gateway_refund_resp.get("id") else (payload.reference_id or f"rf_adm_{str(uuid4())[:8]}"),
                    "status": "processed",
                    "amount": float(refund_amount_dec),
                    "payout_mode": payload.payout_mode or ("Offline Payout / Cash / UPI" if is_cod else "Online Payment Gateway"),
                    "reference_id": payload.reference_id or None,
                    "is_cod": is_cod,
                    "arn": gateway_refund_resp.get("acquirer_data", {}).get("arn") if isinstance(gateway_refund_resp, dict) and isinstance(gateway_refund_resp.get("acquirer_data"), dict) else None,
                    "created_at": utc_now().isoformat(),
                    "source": "admin_desk",
                    "actor_name": staff_name,
                    "note": payload.note or f"{'COD Refund' if is_cod else 'Refund'} of ₹{refund_amount_dec} approved by {staff_name}",
                    "items": [{"order_item_id": str(i.order_item_id), "quantity": i.quantity} for i in payload.items] if payload.items else None,
                }
                refund_history.append(refund_tx)
                snapshot["refund_history"] = refund_history
                snapshot["refund_details"] = refund_tx
                ord.pricing_snapshot = snapshot
                flag_modified(ord, "pricing_snapshot")

                ord.status = "refunded" if is_full_refund else ord.status
                ord.payment_status = "refunded" if is_full_refund else "partially_refunded"
                ord.cancel_reason = f"Support Resolution: {payload.note or 'Refund issued via support ticket'}"
                ord.updated_at = utc_now()

                # Sync any associated Return Request
                ret_req = session.exec(select(ReturnRequest).where(ReturnRequest.order_id == ord.id)).first()
                if ret_req:
                    ret_req.status = "refunded"
                    ret_req.refund_status = "completed"
                    ret_req.final_refund_amount = (ret_req.final_refund_amount or Decimal("0.00")) + refund_amount_dec
                    ret_req.admin_note = payload.note or "Refund processed via support resolution."
                    session.add(ret_req)

                # Reverse ledger entry if needed
                ledger_entry = session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == ord.id)).first()
                if ledger_entry:
                    if is_full_refund:
                        ledger_entry.status = "refunded"
                        ledger_entry.escrow_status = "reversed"
                    session.add(ledger_entry)

                session.add(ord)
        else:
            ticket.resolution_type = "refund_issued"
            ticket.refund_amount = payload.refund_amount
            ticket.resolution_note = payload.note or f"Refund of ₹{payload.refund_amount or 0} recorded."
            ticket.status = "closed"
            ticket.resolved_at = utc_now()
            ticket.closed_at = utc_now()
            action_msg = f"Resolution Approved: Refund of ₹{payload.refund_amount or 0} recorded."

    elif payload.action_type == "replacement":
        ticket.resolution_type = "replacement_sent"
        ticket.resolution_note = payload.note or "Replacement package authorized."
        ticket.status = "closed"
        ticket.resolved_at = utc_now()
        ticket.closed_at = utc_now()

        replaced_items_str = ""
        if ticket.order_id:
            ord = session.get(Order, ticket.order_id)
            if ord:
                order_items = session.exec(select(OrderItem).where(OrderItem.order_id == ord.id)).all()
                repl_summaries = []
                if payload.items:
                    item_map = {item.order_item_id: item.quantity for item in payload.items}
                    for oi in order_items:
                        if oi.id in item_map:
                            oi.status = "confirmed"
                            session.add(oi)
                            qty = min(item_map[oi.id], oi.quantity)
                            repl_summaries.append(f"{qty}x {oi.product_name}")
                else:
                    for oi in order_items:
                        oi.status = "confirmed"
                        session.add(oi)
                if repl_summaries:
                    replaced_items_str = f" for {', '.join(repl_summaries)}"

                # Reset order to confirmed so admin can pack and mark as shipped
                ord.status = "confirmed"
                ord.cancel_reason = f"Replacement Authorized: {payload.note or 'Support resolution replacement'}"
                ord.shipped_at = None
                ord.delivered_at = None
                ord.delivery_otp = f"{secrets.randbelow(9000) + 1000}"
                ord.updated_at = utc_now()

                # Delete previous shipment records so the order is cleanly unassigned for manual admin re-dispatch
                existing_shipments = session.exec(select(Shipment).where(Shipment.order_id == ord.id)).all()
                for s in existing_shipments:
                    session.delete(s)

                changed_by_id = None
                try:
                    if actor.get("actor_id"):
                        changed_by_id = UUID(str(actor["actor_id"]))
                except Exception:
                    pass

                session.add(
                    OrderStatusHistory(
                        order_id=ord.id,
                        status="confirmed",
                        changed_by=changed_by_id,
                        changed_by_type="admin" if actor.get("actor_type") == "admin" else "agent",
                        notes=f"Replacement package authorized{replaced_items_str} by admin. Order queued for packing and rider assignment.",
                    )
                )

                session.add(ord)

        action_msg = f"Resolution Approved: Free replacement package authorized{replaced_items_str}. Order #{str(ticket.order_id)[:8] if ticket.order_id else ''} queued under Yet to Ship for admin packing and rider assignment. {payload.note or ''}".strip()

    elif payload.action_type == "cancel_order":
        ticket.resolution_type = "order_cancelled"
        ticket.resolution_note = payload.note or "Order cancelled as requested."
        ticket.status = "closed"
        ticket.resolved_at = utc_now()
        ticket.closed_at = utc_now()
        action_msg = f"Order Cancelled: {payload.note or 'Customer requested cancellation.'}".strip()

        if ticket.order_id:
            ord = session.get(Order, ticket.order_id)
            if ord and ord.status not in ["cancelled", "delivered"]:
                # If online paid with live Razorpay, trigger full gateway refund
                if getattr(ord, "payment_status", None) == "paid" and ord.razorpay_payment_id and not ord.razorpay_payment_id.startswith("pay_mock_"):
                    try:
                        from routers.payments import get_razorpay_client
                        client = get_razorpay_client()
                        if client:
                            refund_amount_paise = int(Decimal(str(ord.total)) * 100)
                            refund_resp = client.payment.refund(
                                ord.razorpay_payment_id,
                                {
                                    "amount": refund_amount_paise,
                                    "reverse_all": 1,
                                    "notes": {
                                        "reason": f"Support Order Cancellation Refund: {payload.note or 'Cancelled'}",
                                        "ticket_id": str(ticket.id),
                                        "order_id": str(ord.id),
                                    },
                                },
                            )
                            if isinstance(refund_resp, dict):
                                snapshot = dict(ord.pricing_snapshot or {})
                                snapshot["refund_details"] = {
                                    "refund_id": refund_resp.get("id"),
                                    "status": refund_resp.get("status", "processed"),
                                    "amount": (refund_resp.get("amount") or refund_amount_paise) / 100,
                                    "arn": refund_resp.get("acquirer_data", {}).get("arn") if isinstance(refund_resp.get("acquirer_data"), dict) else None,
                                    "created_at": refund_resp.get("created_at"),
                                }
                                ord.pricing_snapshot = snapshot
                                flag_modified(ord, "pricing_snapshot")
                                rz_rf_id = refund_resp.get("id")
                                if rz_rf_id:
                                    action_msg += f" (Gateway Refund ID: {rz_rf_id})"
                    except Exception as rerr:
                        logger.error(f"Razorpay refund failed on admin cancel action for order {ord.id}: {rerr}", exc_info=True)
                        raise HTTPException(
                            status_code=400,
                            detail=f"Razorpay Gateway Refund Failed: {str(rerr)}"
                        )

                ord.status = "cancelled"
                ord.payment_status = "refunded" if getattr(ord, "payment_status", None) == "paid" else ord.payment_status
                ord.cancelled_at = utc_now()
                ord.cancel_reason = f"Support Resolution: {payload.note or 'Cancelled via ticket'}"
                ord.updated_at = utc_now()

                ledger_entry = session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == ord.id)).first()
                if ledger_entry:
                    ledger_entry.status = "refunded"
                    ledger_entry.escrow_status = "reversed"
                    session.add(ledger_entry)

                session.add(ord)

    elif payload.action_type in ("resolve", "resolved", "close", "closed", "done"):
        ticket.resolution_type = "ticket_closed"
        ticket.resolution_note = payload.note or "Case closed."
        ticket.status = "closed"
        ticket.resolved_at = utc_now()
        ticket.closed_at = utc_now()
        action_msg = f"Case Closed: {payload.note or 'Issue concluded successfully.'}".strip()

    elif payload.action_type in ("reopen", "open"):
        ticket.status = "open"
        ticket.resolution_type = None
        ticket.resolution_note = None
        ticket.resolved_at = None
        ticket.closed_at = None
        action_msg = f"Case Re-Opened: {payload.note or 'Case has been reopened for further investigation.'}"

    ticket.updated_at = utc_now()
    session.add(ticket)

    # Add message to customer thread
    res_msg = SupportTicketMessage(
        ticket_id=ticket.id,
        sender_type="admin" if actor["actor_type"] == "admin" else "agent",
        sender_name=actor.get("name") or "Support Team",
        message=action_msg,
        is_internal_note=False,
    )
    session.add(res_msg)

    session.commit()
    session.refresh(res_msg)
    session.refresh(ticket)

    msg_dict = {
        "id": str(res_msg.id),
        "sender_type": res_msg.sender_type,
        "sender_id": str(res_msg.sender_id) if res_msg.sender_id else None,
        "sender_name": res_msg.sender_name,
        "message": res_msg.message,
        "attachments": res_msg.attachments or [],
        "is_internal_note": res_msg.is_internal_note,
        "created_at": res_msg.created_at.isoformat() if res_msg.created_at else None,
        "read_at": None,
    }
    ticket_hub.broadcast(str(ticket.id), {
        "type": "new_message",
        "message": msg_dict,
        "ticket_status": ticket.status,
    })

    return {
        "success": True,
        "message": f"Action '{payload.action_type}' executed successfully.",
        "ticket_status": ticket.status,
    }
