import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field
from sqlmodel import Session, select, delete, func
from sqlalchemy import text

from agents.backend_exec import build_backend_config
from agents.backend_runtime import register_backend_routes
from agents.planning import plan_site
from agents.site_schema import build_site_definition
from agents.understanding import extract_requirements
from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    check_admin_has_permission,
    enforce_owner_role,
    enforce_site_ownership,
)
from db.database import create_db_and_tables, get_session, engine
from models import (
    Admin, AdminSite, Site, Product, Category, Collection, Cart, CartItem, Order, OrderItem,
    ProductCollection, ProductReview, ReturnRequest, ReturnItem, ReturnStatusHistory,
    Shipment, InventoryMovement, OrderStatusHistory, User, UserAddress,
    DeliveryAgent, DeliverySettings, SiteTrafficEvent,
)
from routers import analytics, auth, cart, categories, checkout, checkout_settings, collections, coupons, orders, pages, payments, products, returns, support, users_roles, audit_logs
from routers import delivery


logger = logging.getLogger(__name__)

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ASSETS_DIR = Path("uploads/assets")
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


async def _mature_escrow_cron_task():
    while True:
        try:
            await asyncio.sleep(1800)  # Check every 30 minutes
            with Session(engine) as session:
                from routers.payments import process_mature_escrows
                released, total = process_mature_escrows(session)
                if released > 0:
                    logger.info("Auto-escrow cron: Released %d mature escrow payout(s) totaling ₹%.2f", released, total)
                    try:
                        from services.audit_service import AuditService, ActorType, SourceType, AuditCategory
                        AuditService.log_event(
                            session=session,
                            site_id=None,
                            actor_type=ActorType.CRON_JOB,
                            actor_name="Mature Escrow Cron",
                            actor_role="System Scheduler",
                            category=AuditCategory.EARNINGS_LEDGER,
                            action="escrow.auto_released",
                            source=SourceType.CRON_ESCROW_RELEASE,
                            summary=f"Automated background cron released {released} mature escrow payout(s) totaling ₹{float(total):,.2f}",
                            metadata={
                                "financial": True,
                                "amount": float(total),
                                "currency": "INR",
                                "released_count": released,
                            },
                        )
                    except Exception as cron_log_err:
                        logger.warning("Failed to log escrow.auto_released audit event: %s", cron_log_err)
        except asyncio.CancelledError:
            break
        except Exception as err:
            logger.error("Error in mature escrow background task: %s", err)


async def _activity_retention_cron_task():
    """Runs automatically at startup and once daily to permanently delete activity logs older than 90 days."""
    while True:
        try:
            with Session(engine) as session:
                from routers.audit_logs import cleanup_expired_activity_logs
                deleted = cleanup_expired_activity_logs(session, retention_days=90)
                if deleted > 0:
                    logger.info("Daily Activity Retention Cron: Purged %d expired records older than 90 days", deleted)
        except asyncio.CancelledError:
            break
        except Exception as err:
            logger.error("Error in activity log retention background task: %s", err)
        try:
            await asyncio.sleep(86400)  # Run once every 24 hours
        except asyncio.CancelledError:
            break


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    try:
        with Session(engine) as session:
            users_roles.ensure_default_roles_and_users(session)
            adms = session.exec(select(Admin.id, Admin.email, Admin.name, Admin.role, Admin.invited_by_admin_id, Admin.status)).all()
            logger.info("DIAGNOSTIC - All admins in DB: %s", [(str(a[0]), a[1], a[2], a[3], str(a[4]), a[5]) for a in adms])
            logger.info("Users & Roles system initialized successfully.")
    except Exception as seed_err:
        logger.warning("Could not seed default roles and users: %s", seed_err)

    try:
        with Session(engine) as session:
            # 1. Clean up any pytest test sites that leaked into production database
            test_sites = session.exec(
                select(Site).where(
                    (Site.slug.like("store-ret-%")) |
                    (Site.slug.like("store-charges-%")) |
                    (Site.slug.like("stat-store-%")) |
                    (Site.slug.like("inv-store-%")) |
                    (Site.slug.like("sec-store-%")) |
                    (Site.slug.like("test-store-%"))
                )
            ).all()
            test_ids = [s.id for s in test_sites]
            if test_ids:
                stale_links = session.exec(
                    select(AdminSite).where(AdminSite.site_id.in_(test_ids))
                ).all()
                for lk in stale_links:
                    session.delete(lk)
                for ts in test_sites:
                    session.delete(ts)
                session.commit()
                logger.info(f"Purged {len(test_ids)} leftover pytest test sites and links.")

            # 2. Scope team members strictly to their workspace owner
            from models import Role
            owner_admin = session.exec(
                select(Admin)
                .join(Role, Role.id == Admin.role_id, isouter=True)
                .where((Role.name == "Owner") | (Admin.role == "Owner"))
                .order_by(Admin.created_at.asc())
            ).first()

            if owner_admin:
                owner_site_links = session.exec(
                    select(AdminSite.site_id).where(AdminSite.admin_id == owner_admin.id)
                ).all()
                owner_site_ids = set(owner_site_links)

                non_owners = session.exec(
                    select(Admin).where(Admin.id != owner_admin.id)
                ).all()
                for no in non_owners:
                    if not no.invited_by_admin_id:
                        no.invited_by_admin_id = owner_admin.id
                        session.add(no)

                    # Delete any AdminSite records for this team member that are NOT in owner's workspace
                    if owner_site_ids:
                        bad_member_links = session.exec(
                            select(AdminSite).where(
                                AdminSite.admin_id == no.id,
                                ~AdminSite.site_id.in_(list(owner_site_ids))
                            )
                        ).all()
                        for bl in bad_member_links:
                            session.delete(bl)

                    # If team member has access "all", ensure they have AdminSite links for all owner's sites
                    if getattr(no, "website_access_type", "all") == "all" and owner_site_ids:
                        for osid in owner_site_ids:
                            existing_link = session.exec(
                                select(AdminSite).where(AdminSite.admin_id == no.id, AdminSite.site_id == osid)
                            ).first()
                            if not existing_link:
                                role_site_str = (no.role or "store_manager").lower().replace(" ", "_")
                                session.add(AdminSite(admin_id=no.id, site_id=osid, role_on_site=role_site_str))

                session.commit()
                logger.info("Workspace team members and AdminSite isolation verified and healed.")
    except Exception as cleanup_err:
        logger.warning("Could not complete workspace site isolation cleanup: %s", cleanup_err)

    try:
        with Session(engine) as session:
            repl_shipments = session.exec(select(Shipment).where(Shipment.awb_number.like("REPL-%"))).all()
            if repl_shipments:
                for s in repl_shipments:
                    session.delete(s)
                session.commit()
    except Exception as cleanup_err:
        logger.warning("Could not purge legacy REPL shipments: %s", cleanup_err)
    escrow_task = asyncio.create_task(_mature_escrow_cron_task())
    retention_task = asyncio.create_task(_activity_retention_cron_task())
    try:
        yield
    finally:
        try:
            from routers.support import ticket_hub
            ticket_hub.stop()
        except Exception:
            pass
        escrow_task.cancel()
        retention_task.cancel()
        try:
            await escrow_task
        except asyncio.CancelledError:
            pass
        try:
            await retention_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="AI Website Builder Backend", lifespan=lifespan)


# CORS: reads comma-separated origins from CORS_ORIGINS env var.
# Defaults to ["*"] for local dev. Set to specific domains in production.
# Example: CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
_cors_raw = os.getenv("CORS_ORIGINS", "*").strip()
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.types import Scope

class CachedStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        return response

app.mount("/uploads", CachedStaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(collections.router)
app.include_router(cart.router)
app.include_router(checkout.router)
app.include_router(checkout_settings.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(returns.router)
app.include_router(delivery.router)
app.include_router(coupons.router)
app.include_router(pages.router)
app.include_router(pages.router, prefix="/api")
app.include_router(support.router)
app.include_router(support.router, prefix="/api")
app.include_router(analytics.router)
app.include_router(analytics.router, prefix="/api")
app.include_router(users_roles.router)
app.include_router(users_roles.router, prefix="/api")
app.include_router(audit_logs.router)
app.include_router(audit_logs.router, prefix="/api")


# ---------------------------------------------------------------------------
# Asset Upload Endpoint (brand logos, etc.)
# ---------------------------------------------------------------------------

ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"}

@app.post("/assets/upload-logo")
async def upload_brand_logo(
    request: Request,
    file: UploadFile = File(...),
    admin=Depends(lambda: None),  # No auth required – only used inside the authenticated builder
):
    """Accepts a logo image, stores it as-is (preserving original format including transparency)
    in uploads/assets/. Returns the absolute URL."""
    from uuid import uuid4

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: PNG, JPEG, WEBP, SVG.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    suffix = Path(file.filename or "logo").suffix.lower() or ".png"
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        suffix = ".png"

    # For raster images – optimize but PRESERVE ALPHA channel (do NOT flatten to RGB)
    try:
        from PIL import Image, ImageOps
        import io as _io
        if suffix != ".svg":
            with Image.open(_io.BytesIO(content)) as img:
                img = ImageOps.exif_transpose(img)
                # Keep RGBA/LA so transparency is preserved
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGBA")
                else:
                    img = img.convert("RGB")
                # Preserve crisp high-resolution detail (up to 1600x1600) while keeping aspect ratio
                img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                buf = _io.BytesIO()
                # Always save as PNG to preserve transparency
                img.save(buf, "PNG", optimize=True)
                content = buf.getvalue()
                suffix = ".png"
    except Exception:
        pass  # Fall back to storing the file as-is

    filename = f"{uuid4()}{suffix}"
    (ASSETS_DIR / filename).write_bytes(content)

    return {"url": f"{request.base_url}uploads/assets/{filename}", "filename": filename}


class GenerateSiteRequest(BaseModel):
    prompt: str


class SaveSiteRequest(BaseModel):
    slug: Optional[str] = None
    site_definition: dict[str, Any]
    draft_definition: Optional[dict[str, Any]] = None


class RequirementsResponse(BaseModel):
    requirements: Dict[str, Any]


class SitePlanResponse(BaseModel):
    requirements: Dict[str, Any]
    site_plan: Dict[str, Any]
    backend_config: Dict[str, Any]
    frontend_config: Dict[str, Any]


class SiteGenerationResponse(BaseModel):
    requirements: Dict[str, Any]
    site_plan: Dict[str, Any]
    backend_config: Dict[str, Any]
    frontend_config: Dict[str, Any]
    site_definition: Dict[str, Any]


class SiteGenerationState(BaseModel):
    user_prompt: str
    requirements: Dict[str, Any] = Field(default_factory=dict)
    site_plan: Dict[str, Any] = Field(default_factory=dict)
    backend_config: Dict[str, Any] = Field(default_factory=dict)
    frontend_config: Dict[str, Any] = Field(default_factory=dict)
    site_definition: Dict[str, Any] = Field(default_factory=dict)
    runtime_registered: bool = False


def build_frontend_config(frontend_plan: Dict[str, Any]) -> Dict[str, Any]:
    pages = frontend_plan.get("pages", [])
    page_plans = frontend_plan.get("page_plans", [])
    theme_name = frontend_plan.get("theme", "light")
    design_direction = frontend_plan.get(
        "design_direction", "modern ecommerce storefront"
    )

    page_map = {
        page_plan["page_key"]: {
            "route": {
                "home": "/",
                "product_list": "/products",
                "product_detail": "/products/:slug",
                "cart": "/cart",
                "checkout": "/checkout",
                "order_confirmation": "/order-confirmation",
                "admin_dashboard": "/admin",
                "admin_products": "/admin/products",
                "admin_orders": "/admin/orders",
                "admin_inventory": "/admin/inventory",
            }.get(page_plan["page_key"], f'/{page_plan["page_key"]}'),
            "page_type": page_plan.get("page_type"),
            "goal": page_plan.get("goal"),
            "sections": page_plan.get("sections", []),
            "generation_prompt": page_plan.get("generation_prompt"),
        }
        for page_plan in page_plans
    }

    for page in pages:
        page_map.setdefault(
            page,
            {
                "route": f"/{page}",
                "page_type": "informational",
                "goal": "",
                "sections": [],
                "generation_prompt": "",
            },
        )

    return {
        "pages": page_map,
        "theme": theme_name,
        "design_direction": design_direction,
        "required_components": frontend_plan.get("required_components", []),
    }


async def understanding_node(state: SiteGenerationState) -> Dict[str, Any]:
    requirements = await extract_requirements(state.user_prompt)
    return {"requirements": requirements}


async def planning_node(state: SiteGenerationState) -> Dict[str, Any]:
    site_plan = await plan_site(state.requirements)
    return {"site_plan": site_plan}


async def backend_config_node(state: SiteGenerationState) -> Dict[str, Any]:
    backend_config = build_backend_config(state.site_plan["backend_plan"])
    return {"backend_config": backend_config}


async def frontend_config_node(state: SiteGenerationState) -> Dict[str, Any]:
    frontend_config = build_frontend_config(state.site_plan["frontend_plan"])
    return {"frontend_config": frontend_config}


async def site_schema_node(state: SiteGenerationState) -> Dict[str, Any]:
    site_definition = build_site_definition(
        requirements=state.requirements,
        site_plan=state.site_plan,
        backend_config=state.backend_config,
        frontend_config=state.frontend_config,
    )
    return {"site_definition": site_definition}


async def runtime_registration_node(state: SiteGenerationState) -> Dict[str, Any]:
    if not state.runtime_registered:
        register_backend_routes(app, state.backend_config)
    return {"runtime_registered": True}


def build_generation_graph():
    graph = StateGraph(SiteGenerationState)

    graph.add_node("understanding", understanding_node)
    graph.add_node("planning", planning_node)
    graph.add_node("backend_config", backend_config_node)
    graph.add_node("frontend_config", frontend_config_node)
    graph.add_node("site_schema", site_schema_node)
    graph.add_node("runtime_registration", runtime_registration_node)

    graph.set_entry_point("understanding")
    graph.add_edge("understanding", "planning")
    graph.add_edge("planning", "backend_config")
    graph.add_edge("backend_config", "frontend_config")
    graph.add_edge("frontend_config", "site_schema")
    graph.add_edge("site_schema", "runtime_registration")
    graph.add_edge("runtime_registration", END)

    return graph.compile()


generation_graph = build_generation_graph()


async def run_generation_pipeline(prompt: str) -> Dict[str, Any]:
    initial_state = SiteGenerationState(user_prompt=prompt)
    final_state = await generation_graph.ainvoke(initial_state)

    if isinstance(final_state, SiteGenerationState):
        state_obj = final_state
    else:
        state_obj = SiteGenerationState(**final_state)

    return {
        "requirements": state_obj.requirements,
        "site_plan": state_obj.site_plan,
        "backend_config": state_obj.backend_config,
        "frontend_config": state_obj.frontend_config,
        "site_definition": state_obj.site_definition,
    }


class StartConversationRequest(BaseModel):
    prompt: str

class ReplyConversationRequest(BaseModel):
    session_id: str
    reply: str

class PublishSiteRequest(BaseModel):
    draft_definition: Dict[str, Any]


@app.post("/conversation/start")
async def conversation_start_endpoint(
    req: StartConversationRequest,
    request: Request,
    owner=Depends(enforce_owner_role),
):
    admin_name = "Creator"
    admin_email = None
    try:
        cookie_val = request.cookies.get("admin_session")
        if cookie_val:
            decoded = json.loads(cookie_val)
            admin_email = decoded.get("email")
            if admin_email:
                admin_name = admin_email.split("@")[0].title()
    except Exception:
        pass

    from agents.conversation_agent import start_session
    session = await start_session(initial_prompt=req.prompt, admin_name=admin_name, admin_email=admin_email)
    return session.model_dump()


@app.post("/conversation/start/stream")
async def conversation_start_stream_endpoint(
    req: StartConversationRequest,
    request: Request,
    owner=Depends(enforce_owner_role),
):
    admin_name = "Creator"
    admin_email = None
    try:
        cookie_val = request.cookies.get("admin_session")
        if cookie_val:
            decoded = json.loads(cookie_val)
            admin_email = decoded.get("email")
            if admin_email:
                admin_name = admin_email.split("@")[0].title()
    except Exception:
        pass

    from agents.conversation_agent import start_session_stream

    async def event_generator():
        try:
            async for event in start_session_stream(initial_prompt=req.prompt, admin_name=admin_name, admin_email=admin_email):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            err_payload = {
                "type": "done",
                "text": f"Error starting session: {str(e)}",
                "phase": "analyzing",
                "is_complete": False,
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/conversation/reply")
async def conversation_reply_endpoint(
    req: ReplyConversationRequest,
    owner=Depends(enforce_owner_role),
):
    from agents.conversation_agent import reply_session
    try:
        session = await reply_session(session_id=req.session_id, user_reply=req.reply)
        return session.model_dump()
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@app.post("/conversation/reply/stream")
async def conversation_reply_stream_endpoint(
    req: ReplyConversationRequest,
    owner=Depends(enforce_owner_role),
):
    from agents.conversation_agent import reply_session_stream, SESSIONS

    session = SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {req.session_id} not found")

    async def event_generator():
        try:
            async for event in reply_session_stream(session_id=req.session_id, user_reply=req.reply):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            err_payload = {
                "type": "done",
                "text": f"Error processing reply: {str(e)}",
                "phase": "analyzing",
                "is_complete": False,
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/conversation/{session_id}")
async def conversation_get_endpoint(
    session_id: str,
    owner=Depends(enforce_owner_role),
):
    from agents.conversation_agent import SESSIONS
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


class RehydrateConversationRequest(BaseModel):
    session_id: Optional[str] = None
    collected: Optional[Dict[str, Any]] = None
    turns: Optional[List[Dict[str, Any]]] = None
    reply: Optional[str] = None


@app.post("/conversation/rehydrate")
async def conversation_rehydrate_endpoint(
    req: RehydrateConversationRequest,
    request: Request,
    owner=Depends(enforce_owner_role),
):
    admin_name = "Creator"
    admin_email = None
    try:
        cookie_val = request.cookies.get("admin_session")
        if cookie_val:
            decoded = json.loads(cookie_val)
            admin_email = decoded.get("email")
            if admin_email:
                admin_name = admin_email.split("@")[0].title()
    except Exception:
        pass

    from agents.conversation_agent import rehydrate_session, reply_session
    session = await rehydrate_session(
        session_id=req.session_id,
        collected=req.collected,
        turns=req.turns,
        admin_name=admin_name,
        admin_email=admin_email,
    )
    if req.reply:
        session = await reply_session(session_id=session.session_id, user_reply=req.reply)
    return session.model_dump()


class CoPilotChatRequest(BaseModel):
    site_id: str
    message: str
    chat_history: Optional[List[Dict[str, str]]] = None
    draft_definition: Optional[Dict[str, Any]] = None


@app.post("/copilot/chat")
async def copilot_chat_endpoint(
    req: CoPilotChatRequest,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    if not (check_admin_has_permission(admin["adminId"], "chat:access", session) or check_admin_has_permission(admin["adminId"], "chat:send", session)):
        raise HTTPException(status_code=403, detail="You do not have permission to access AI Copilot.")

    from agents.copilot_agent import process_copilot_request
    result = await process_copilot_request(
        message=req.message,
        site_id=req.site_id,
        chat_history=req.chat_history,
        draft_definition=req.draft_definition,
    )
    return result


@app.post("/copilot/chat/stream")
async def copilot_chat_stream_endpoint(
    req: CoPilotChatRequest,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    if not (check_admin_has_permission(admin["adminId"], "chat:access", session) or check_admin_has_permission(admin["adminId"], "chat:send", session)):
        raise HTTPException(status_code=403, detail="You do not have permission to access AI Copilot.")
    from agents.copilot_agent import process_copilot_request_stream

    async def event_generator():
        try:
            async for event in process_copilot_request_stream(
                message=req.message,
                site_id=req.site_id,
                chat_history=req.chat_history,
                draft_definition=req.draft_definition,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            error_payload = {
                "type": "done",
                "assistant_reply": "I ran into an issue processing your request. Please try again.",
                "data_cards": [],
                "design_modified": False,
                "updated_draft_definition": None,
            }
            yield f"data: {json.dumps(error_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/understanding", response_model=RequirementsResponse)
async def understanding_endpoint(req: GenerateSiteRequest):
    requirements = await extract_requirements(req.prompt)
    return RequirementsResponse(requirements=requirements)


@app.post("/planning", response_model=SitePlanResponse)
async def planning_endpoint(req: GenerateSiteRequest):
    requirements = await extract_requirements(req.prompt)
    site_plan = await plan_site(requirements)
    backend_config = build_backend_config(site_plan["backend_plan"])
    frontend_config = build_frontend_config(site_plan["frontend_plan"])

    return SitePlanResponse(
        requirements=requirements,
        site_plan=site_plan,
        backend_config=backend_config,
        frontend_config=frontend_config,
    )


@app.post("/generate-site", response_model=SiteGenerationResponse)
async def generate_site(req: GenerateSiteRequest):
    result = await run_generation_pipeline(req.prompt)
    return SiteGenerationResponse(**result)


class CustomSiteDefinitionRequest(BaseModel):
    prompt: Optional[str] = None
    session_id: Optional[str] = None


@app.post("/site-definition")
async def generate_site_definition_endpoint(
    req: CustomSiteDefinitionRequest,
    owner=Depends(enforce_owner_role),
):
    prompt_text = req.prompt or ""
    collected_reqs = {}
    session = None

    if req.session_id:
        from agents.conversation_agent import SESSIONS
        session = SESSIONS.get(req.session_id)
        if session:
            collected_reqs = session.collected
            if not prompt_text:
                prompt_text = "\n".join([f"{t['sender']}: {t['text']}" for t in session.turns])

    # Fast path: If session.collected already has core requirements, compile directly without redundant LLM call
    if collected_reqs.get("brand_name") and collected_reqs.get("domain") and collected_reqs.get("chosen_palette"):
        from agents.understanding import WebsiteRequirements, _normalize_requirements
        fast_reqs = WebsiteRequirements(
            brand_name=collected_reqs["brand_name"],
            domain=collected_reqs["domain"],
            tagline=collected_reqs.get("tagline"),
            chosen_palette=collected_reqs["chosen_palette"],
            navbar_position=collected_reqs.get("navbar_position", "fixed"),
            navbar_layout=collected_reqs.get("navbar_layout", "apple_minimal"),
            footer_layout=collected_reqs.get("footer_layout", "apple_minimal"),
            surface_materiality=collected_reqs.get("surface_materiality", "solid"),
            catalog_type=collected_reqs.get("domain", "general"),
        )
        requirements = _normalize_requirements(fast_reqs).model_dump()
    else:
        # Fallback to LLM extraction for freeform prompt requests
        requirements = await extract_requirements(prompt_text or "General store", session_id=req.session_id)
        if collected_reqs.get("brand_name"):
            requirements["brand_name"] = collected_reqs["brand_name"]
        if collected_reqs.get("domain"):
            requirements["domain"] = collected_reqs["domain"]
            requirements["catalog_type"] = collected_reqs["domain"]
        if collected_reqs.get("chosen_palette"):
            requirements["chosen_palette"] = collected_reqs["chosen_palette"]
        elif session and isinstance(requirements.get("chosen_palette"), str) and session.palette_options:
            pal_str = requirements["chosen_palette"].strip().lower()
            for p in session.palette_options:
                if (
                    p.get("id", "").lower() == pal_str
                    or p.get("name", "").lower() == pal_str
                    or pal_str.endswith(p.get("id", "").lower())
                ):
                    requirements["chosen_palette"] = p
                    break
        if collected_reqs.get("navbar_position"):
            requirements["navbar_position"] = collected_reqs["navbar_position"]
        if collected_reqs.get("navbar_layout"):
            requirements["navbar_layout"] = collected_reqs["navbar_layout"]
        if collected_reqs.get("footer_layout"):
            requirements["footer_layout"] = collected_reqs["footer_layout"]
        if collected_reqs.get("surface_materiality"):
            requirements["surface_materiality"] = collected_reqs["surface_materiality"]
        if collected_reqs.get("tagline"):
            requirements["tagline"] = collected_reqs["tagline"]

    # Run plan and build site definition
    site_plan = await plan_site(requirements, session_id=req.session_id)
    backend_config = build_backend_config(site_plan["backend_plan"])
    frontend_config = build_frontend_config(site_plan["frontend_plan"])

    site_definition = build_site_definition(
        requirements=requirements,
        site_plan=site_plan,
        backend_config=backend_config,
        frontend_config=frontend_config,
    )

    return {
        "requirements": requirements,
        "site_definition": site_definition,
    }


@app.post("/site-definition/stream")
async def generate_site_definition_stream_endpoint(
    req: CustomSiteDefinitionRequest,
    owner=Depends(enforce_owner_role),
):
    async def event_generator():
        try:
            yield f"data: {json.dumps({'step': 'start', 'progress': 10, 'message': 'Initializing AI generation pipeline...'})}\n\n"
            
            prompt_text = req.prompt or ""
            collected_reqs = {}
            session = None

            if req.session_id:
                from agents.conversation_agent import SESSIONS
                session = SESSIONS.get(req.session_id)
                if session:
                    collected_reqs = session.collected
                    if not prompt_text:
                        prompt_text = "\n".join([f"{t['sender']}: {t['text']}" for t in session.turns])

            yield f"data: {json.dumps({'step': 'understanding', 'progress': 25, 'message': 'Extracting e-commerce brand requirements and theme tokens...'})}\n\n"
            
            # Fast path: If session.collected already has core requirements, compile directly without redundant LLM call
            if collected_reqs.get("brand_name") and collected_reqs.get("domain") and collected_reqs.get("chosen_palette"):
                from agents.understanding import WebsiteRequirements, _normalize_requirements
                fast_reqs = WebsiteRequirements(
                    brand_name=collected_reqs["brand_name"],
                    domain=collected_reqs["domain"],
                    tagline=collected_reqs.get("tagline"),
                    chosen_palette=collected_reqs["chosen_palette"],
                    navbar_position=collected_reqs.get("navbar_position", "fixed"),
                    navbar_layout=collected_reqs.get("navbar_layout", "apple_minimal"),
                    footer_layout=collected_reqs.get("footer_layout", "apple_minimal"),
                    surface_materiality=collected_reqs.get("surface_materiality", "solid"),
                    catalog_type=collected_reqs.get("domain", "general"),
                )
                requirements = _normalize_requirements(fast_reqs).model_dump()
            else:
                requirements = await extract_requirements(prompt_text or "General store", session_id=req.session_id)
                if collected_reqs.get("brand_name"):
                    requirements["brand_name"] = collected_reqs["brand_name"]
                if collected_reqs.get("domain"):
                    requirements["domain"] = collected_reqs["domain"]
                    requirements["catalog_type"] = collected_reqs["domain"]
                if collected_reqs.get("chosen_palette"):
                    requirements["chosen_palette"] = collected_reqs["chosen_palette"]
                elif session and isinstance(requirements.get("chosen_palette"), str) and session.palette_options:
                    pal_str = requirements["chosen_palette"].strip().lower()
                    for p in session.palette_options:
                        if (
                            p.get("id", "").lower() == pal_str
                            or p.get("name", "").lower() == pal_str
                            or pal_str.endswith(p.get("id", "").lower())
                        ):
                            requirements["chosen_palette"] = p
                            break
                if collected_reqs.get("navbar_position"):
                    requirements["navbar_position"] = collected_reqs["navbar_position"]
                if collected_reqs.get("navbar_layout"):
                    requirements["navbar_layout"] = collected_reqs["navbar_layout"]
                if collected_reqs.get("footer_layout"):
                    requirements["footer_layout"] = collected_reqs["footer_layout"]
                if collected_reqs.get("surface_materiality"):
                    requirements["surface_materiality"] = collected_reqs["surface_materiality"]
                if collected_reqs.get("tagline"):
                    requirements["tagline"] = collected_reqs["tagline"]

            yield f"data: {json.dumps({'step': 'planning', 'progress': 50, 'message': 'Synthesizing pages, catalog structures, and layout plans...'})}\n\n"
            site_plan = await plan_site(requirements, session_id=req.session_id)

            yield f"data: {json.dumps({'step': 'backend_config', 'progress': 70, 'message': 'Configuring database entities, resources, and routes...'})}\n\n"
            backend_config = build_backend_config(site_plan["backend_plan"])

            yield f"data: {json.dumps({'step': 'frontend_config', 'progress': 85, 'message': 'Designing UI components, colors, and responsive blocks...'})}\n\n"
            frontend_config = build_frontend_config(site_plan["frontend_plan"])

            yield f"data: {json.dumps({'step': 'site_schema', 'progress': 95, 'message': 'Compiling final site definition...'})}\n\n"
            site_definition = build_site_definition(
                requirements=requirements,
                site_plan=site_plan,
                backend_config=backend_config,
                frontend_config=frontend_config,
            )

            result_payload = {
                "step": "complete",
                "progress": 100,
                "message": "Site blueprint successfully generated!",
                "requirements": requirements,
                "site_definition": site_definition,
            }
            yield f"data: {json.dumps(result_payload)}\n\n"
        except Exception as e:
            error_payload = {
                "step": "error",
                "progress": 0,
                "message": f"Site generation failed: {str(e)}",
            }
            yield f"data: {json.dumps(error_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.patch("/sites/{site_id}/publish")
def publish_site(
    site_id: UUID,
    payload: PublishSiteRequest,
    request: Request = None,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not check_admin_has_permission(ownership["adminId"], "customize:publish", session):
        raise HTTPException(status_code=403, detail="You do not have permission to publish changes to live storefront.")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    old_version = site.version
    site.site_definition = payload.draft_definition
    site.draft_definition = payload.draft_definition
    site.version = site.version + 1

    session.add(site)
    session.commit()
    session.refresh(site)

    try:
        audit_logs.log_activity(
            session=session,
            user_id=UUID(ownership["adminId"]),
            action="website_published",
            category="website",
            site_id=site.id,
            resource_type="website",
            resource_id=str(site.id),
            resource_name=site.name or site.slug,
            summary=f"Published storefront changes for {site.name or site.slug} (v{site.version})",
            details={
                "version": site.version,
                "previous_version": old_version,
                "slug": site.slug,
            },
            request=request,
            user_email=ownership.get("email"),
            user_name=ownership.get("name") or ownership.get("email"),
        )
    except Exception as log_err:
        logger.warning(f"Failed to record website_published log: {log_err}")

    invalidate_public_site_cache(site.slug, site.id)
    return site


@app.patch("/sites/{site_identifier}/draft")
def save_site_draft(
    site_identifier: str,
    payload: PublishSiteRequest,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    if not (check_admin_has_permission(admin["adminId"], "customize:edit", session) or check_admin_has_permission(admin["adminId"], "assets:view", session) or check_admin_has_permission(admin["adminId"], "customize:view", session)):
        raise HTTPException(status_code=403, detail="You do not have permission to edit storefront customizations.")

    admin_id = UUID(admin["adminId"])

    site = None
    try:
        site_uuid = UUID(site_identifier)
        site = session.get(Site, site_uuid)
    except (ValueError, TypeError):
        pass

    if not site:
        site = session.exec(select(Site).where(Site.slug == site_identifier)).first()

    if not site:
        # Check prefix match for timestamp-suffixed slugs (e.g. greenharvest -> greenharvest-1786...)
        site = session.exec(
            select(Site)
            .join(AdminSite, AdminSite.site_id == Site.id)
            .where(
                AdminSite.admin_id == admin_id,
                Site.slug.startswith(site_identifier),
            )
            .order_by(Site.created_at.desc())
        ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    ownership = session.exec(
        select(AdminSite).where(
            AdminSite.admin_id == admin_id,
            AdminSite.site_id == site.id,
        )
    ).first()

    if not ownership:
        raise HTTPException(status_code=403, detail="Admin does not have access to this site")

    site.draft_definition = payload.draft_definition
    session.add(site)
    session.commit()
    session.refresh(site)
    return site


@app.get("/auth/admin/me")
def admin_me(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = UUID(admin["adminId"])
    admin_obj = session.get(Admin, admin_id)
    if not admin_obj:
        raise HTTPException(status_code=404, detail="Admin not found")

    from routers.auth import serialize_admin
    return {"admin": serialize_admin(admin_obj, session)}


@app.get("/auth/customer/me")
def customer_me(user=Depends(authenticate_customer)):
    return user


@app.get("/sites")
def get_sites(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    if not check_admin_has_permission(admin["adminId"], "saved_sites:view", session):
        raise HTTPException(status_code=403, detail="You do not have permission to view saved websites.")

    admin_id = UUID(admin["adminId"])

    sites = session.exec(
        select(Site)
        .join(AdminSite, AdminSite.site_id == Site.id)
        .where(AdminSite.admin_id == admin_id)
        .order_by(Site.created_at.desc())
    ).all()

    return sites


@app.get("/api/admin/token-metrics")
def get_global_token_metrics():
    """Internal backend monitoring endpoint to inspect live cumulative token usage and costs."""
    from agents.token_tracker import get_token_tracker
    return get_token_tracker().get_global_summary()


@app.get("/api/admin/token-metrics/{session_id}")
def get_session_token_metrics(session_id: str):
    """Internal backend monitoring endpoint to inspect token usage and costs for a specific session."""
    from agents.token_tracker import get_token_tracker
    return get_token_tracker().get_session_summary(session_id)


@app.get("/api/debug-admins")
def debug_admins():
    with Session(engine) as session:
        adms = session.exec(select(Admin)).all()
        return [
            {
                "id": str(a.id),
                "email": a.email,
                "name": a.name,
                "role": a.role,
                "role_id": str(a.role_id) if a.role_id else None,
                "status": a.status,
                "invited_by": str(a.invited_by_admin_id) if a.invited_by_admin_id else None,
            }
            for a in adms
        ]




@app.get("/sites/{site_id}")
def get_site(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    return site


@app.get("/sites/slug/{slug}")
def get_site_by_slug(
    slug: str,
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    admin_id = UUID(admin["adminId"])

    site = session.exec(
        select(Site)
        .join(AdminSite, AdminSite.site_id == Site.id)
        .where(
            Site.slug == slug,
            AdminSite.admin_id == admin_id,
        )
    ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    return site


# High-speed in-memory cache for public site metadata & themes
import time

PUBLIC_SITE_CACHE: dict = {}


def invalidate_public_site_cache(slug: str = None, site_id: UUID = None):
    if slug and slug in PUBLIC_SITE_CACHE:
        PUBLIC_SITE_CACHE.pop(slug, None)
    if site_id:
        to_remove = [k for k, v in PUBLIC_SITE_CACHE.items() if v.get("id") == str(site_id)]
        for k in to_remove:
            PUBLIC_SITE_CACHE.pop(k, None)


@app.get("/public/sites/slug/{slug}/theme")
def get_public_site_theme_fast(
    slug: str,
    response: Response,
    session: Session = Depends(get_session),
):
    """Ultra-low-latency endpoint returning only the minimal theme & branding payload (<1KB)."""
    now = time.time()
    cached = PUBLIC_SITE_CACHE.get(slug)
    if cached and cached.get("theme_payload") and cached.get("expiry", 0) > now:
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["ETag"] = cached.get("etag", f'"{cached["id"]}"')
        return cached["theme_payload"]

    site = None
    try:
        uuid_val = UUID(slug)
        site = session.exec(
            select(Site.id, Site.slug, Site.site_definition).where((Site.slug == slug) | (Site.id == uuid_val))
        ).first()
    except Exception:
        site = session.exec(
            select(Site.id, Site.slug, Site.site_definition).where(Site.slug == slug)
        ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    site_id, site_slug, site_def = site
    site_def = site_def or {}
    etag_val = f'"{site_id}-{site_def.get("theme", {}).get("footer_layout", "default")}"'

    theme_payload = {
        "id": str(site_id),
        "slug": site_slug,
        "site_name": site_def.get("site_name") or site_def.get("site_title") or site_def.get("title") or site_def.get("name") or "",
        "logo": site_def.get("logo") or site_def.get("header", {}).get("logo") or site_def.get("theme", {}).get("logo"),
        "theme": site_def.get("theme") or {},
        "crm_enabled": bool(site_def.get("crm_enabled", True)),
        "navbar": {
            "brandName": site_def.get("navbar", {}).get("brandName") or site_def.get("header", {}).get("brandName") or site_def.get("site_name") or "",
            "logoUrl": site_def.get("logo") or site_def.get("header", {}).get("logo") or site_def.get("theme", {}).get("logo"),
        },
    }

    PUBLIC_SITE_CACHE[slug] = {
        "id": str(site_id),
        "theme_payload": theme_payload,
        "etag": etag_val,
        "expiry": now + 300,
    }

    response.headers["Cache-Control"] = "no-cache, must-revalidate"
    response.headers["ETag"] = etag_val
    return theme_payload


@app.get("/public/sites/slug/{slug}")
def get_public_site_by_slug(
    slug: str,
    response: Response,
    session: Session = Depends(get_session),
):
    now = time.time()
    cached = PUBLIC_SITE_CACHE.get(slug)
    if cached and cached.get("full_site") and cached.get("expiry", 0) > now:
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["ETag"] = cached.get("etag", f'"{cached["id"]}"')
        return cached["full_site"]

    site = None
    try:
        uuid_val = UUID(slug)
        site = session.exec(
            select(Site).where((Site.slug == slug) | (Site.id == uuid_val))
        ).first()
    except Exception:
        site = session.exec(
            select(Site).where(Site.slug == slug)
        ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    etag_val = f'"{site.id}-{site.version}"'
    if slug not in PUBLIC_SITE_CACHE:
        PUBLIC_SITE_CACHE[slug] = {}
    PUBLIC_SITE_CACHE[slug]["id"] = str(site.id)
    PUBLIC_SITE_CACHE[slug]["full_site"] = site
    PUBLIC_SITE_CACHE[slug]["etag"] = etag_val
    PUBLIC_SITE_CACHE[slug]["expiry"] = now + 300

    response.headers["Cache-Control"] = "no-cache, must-revalidate"
    response.headers["ETag"] = etag_val
    return site


@app.post("/sites")
def create_site(
    payload: SaveSiteRequest,
    owner=Depends(enforce_owner_role),
    session: Session = Depends(get_session),
):
    existing_site = session.exec(
        select(Site).where(Site.slug == payload.slug)
    ).first()
    if existing_site:
        raise HTTPException(status_code=400, detail="Site slug already exists")

    site = Site(
        slug=payload.slug,
        site_definition=payload.site_definition,
        draft_definition=payload.draft_definition,
    )
    session.add(site)
    session.commit()
    session.refresh(site)

    admin_site = AdminSite(
        admin_id=UUID(owner["adminId"]),
        site_id=site.id,
        role_on_site="owner",
    )
    session.add(admin_site)
    session.commit()

    invalidate_public_site_cache(payload.slug, site.id)
    session.refresh(site)
    return site


@app.put("/sites/{site_id}")
def update_site(
    site_id: UUID,
    payload: SaveSiteRequest,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    admin_id = ownership["adminId"]
    # Owners always have full access; team members need at least one relevant permission
    if not ownership.get("is_owner", False):
        has_perm = (
            check_admin_has_permission(admin_id, "home_sections:edit", session)
            or check_admin_has_permission(admin_id, "home_sections:publish", session)
            or check_admin_has_permission(admin_id, "customize:edit", session)
            or check_admin_has_permission(admin_id, "customize:publish", session)
            or check_admin_has_permission(admin_id, "website:edit", session)
            or check_admin_has_permission(admin_id, "store:edit", session)
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to edit site layout or home sections",
            )

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Only update slug if a valid, non-UUID, different slug is provided
    if payload.slug and payload.slug != str(site_id) and payload.slug != site.slug:
        slug_conflict = session.exec(
            select(Site).where(Site.slug == payload.slug, Site.id != site_id)
        ).first()
        if slug_conflict:
            raise HTTPException(status_code=400, detail="Site slug already exists")
        site.slug = payload.slug

    site.site_definition = payload.site_definition
    site.draft_definition = payload.draft_definition or payload.site_definition
    site.version = (site.version or 1) + 1
    site.updated_at = datetime.now(timezone.utc)

    session.add(site)
    session.commit()
    session.refresh(site)

    invalidate_public_site_cache(site.slug, site_id)

    try:
        from services.audit_service import AuditService, ActorType, SourceType, AuditCategory
        admin_uuid = UUID(str(admin_id)) if admin_id else None
        AuditService.log_event(
            session=session,
            site_id=site_id,
            actor_type=ActorType.OWNER if ownership.get("is_owner") else ActorType.TEAM_MEMBER,
            actor_id=admin_uuid,
            actor_name=ownership.get("name") or "Team Member",
            actor_email=ownership.get("email") or "",
            actor_role=ownership.get("role") or "Staff",
            category=AuditCategory.WEBSITE,
            action="website.home_sections_updated",
            source=SourceType.WEB_ADMIN,
            resource_type="website_sections",
            resource_id=str(site_id),
            resource_name=f"{site.name or site.slug} Home Sections",
            summary=f"Updated home sections layout for '{site.name or site.slug}' (v{site.version})",
            metadata={"version": site.version, "slug": site.slug},
        )
    except Exception as log_err:
        logger.error("Audit log failed in update_site: %s", log_err)

    return site


class UpdateDefaultReturnPolicyRequest(BaseModel):
    default_return_window_days: int = Field(ge=0, le=365)


@app.patch("/sites/{site_id}/default-return-policy")
def update_site_default_return_policy(
    site_id: UUID,
    payload: UpdateDefaultReturnPolicyRequest,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not check_admin_has_permission(ownership["adminId"], "products:edit", session):
        raise HTTPException(status_code=403, detail="You do not have permission to update store return policies.")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    site.default_return_window_days = payload.default_return_window_days
    site.updated_at = datetime.now(timezone.utc)
    session.add(site)
    session.commit()
    session.refresh(site)

    try:
        from services.audit_service import AuditService, ActorType, SourceType, AuditCategory
        admin_uuid = UUID(str(ownership["adminId"])) if ownership.get("adminId") else None
        AuditService.log_event(
            session=session,
            site_id=site_id,
            actor_type=ActorType.OWNER if (ownership.get("role") or "").lower() == "owner" else ActorType.TEAM_MEMBER,
            actor_id=admin_uuid,
            actor_name=ownership.get("name"),
            actor_email=ownership.get("email"),
            actor_role=ownership.get("role") or "Staff",
            category=AuditCategory.SETTINGS,
            action="store.settings_changed",
            source=SourceType.WEB_ADMIN,
            resource_type="store_policy",
            resource_id=str(site_id),
            resource_name=f"{site.name or site.slug} Return Policy",
            summary=f"Updated default store return window to {payload.default_return_window_days} days",
            metadata={"default_return_window_days": payload.default_return_window_days},
        )
    except Exception as log_err:
        pass

    return {
        "message": "Store default return policy updated",
        "default_return_window_days": site.default_return_window_days,
    }


@app.get("/sites/{site_id}/delete-check")
def check_site_deletable(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not check_admin_has_permission(ownership["adminId"], "saved_sites:delete", session):
        raise HTTPException(status_code=403, detail="You do not have permission to delete websites.")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    active_orders_count = session.exec(
        select(func.count())
        .select_from(Order)
        .where(Order.site_id == site_id, Order.status.not_in(["delivered", "cancelled"]))
    ).one()

    active_returns_count = session.exec(
        select(func.count())
        .select_from(ReturnRequest)
        .where(ReturnRequest.site_id == site_id, ReturnRequest.status.not_in(["closed", "rejected", "refunded"]))
    ).one()

    can_delete = (active_orders_count == 0 and active_returns_count == 0)

    return {
        "can_delete": can_delete,
        "active_orders": active_orders_count,
        "active_returns": active_returns_count,
        "site_id": str(site_id),
    }


@app.delete("/sites/{site_id}", status_code=200)
def delete_site(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    if not check_admin_has_permission(ownership["adminId"], "saved_sites:delete", session):
        raise HTTPException(status_code=403, detail="You do not have permission to delete websites.")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Restriction: Cannot delete website if active orders or active return requests exist
    active_orders_count = session.exec(
        select(func.count())
        .select_from(Order)
        .where(Order.site_id == site_id, Order.status.not_in(["delivered", "cancelled"]))
    ).one()

    active_returns_count = session.exec(
        select(func.count())
        .select_from(ReturnRequest)
        .where(ReturnRequest.site_id == site_id, ReturnRequest.status.not_in(["closed", "rejected", "refunded"]))
    ).one()

    if active_orders_count > 0 or active_returns_count > 0:
        reasons = []
        if active_orders_count > 0:
            reasons.append(f"{active_orders_count} active order(s)")
        if active_returns_count > 0:
            reasons.append(f"{active_returns_count} pending return request(s)")

        detail_msg = f"Cannot delete store with uncleared activity ({', '.join(reasons)}). Please resolve or cancel all active orders and return requests first."
        raise HTTPException(status_code=400, detail=detail_msg)

    # 1. Return related tables
    return_request_ids = session.exec(select(ReturnRequest.id).where(ReturnRequest.site_id == site_id)).all()
    if return_request_ids:
        session.exec(delete(ReturnStatusHistory).where(ReturnStatusHistory.return_request_id.in_(return_request_ids)))
    session.exec(delete(ReturnItem).where(ReturnItem.site_id == site_id))
    session.exec(delete(ReturnRequest).where(ReturnRequest.site_id == site_id))

    # 2. Product Reviews
    session.exec(delete(ProductReview).where(ProductReview.site_id == site_id))

    # 3. Shipments & Inventory Movements
    session.exec(delete(Shipment).where(Shipment.site_id == site_id))
    session.exec(delete(InventoryMovement).where(InventoryMovement.site_id == site_id))

    # 4. Orders, Order Items & Order Status History
    order_ids = session.exec(select(Order.id).where(Order.site_id == site_id)).all()
    if order_ids:
        session.exec(delete(OrderStatusHistory).where(OrderStatusHistory.order_id.in_(order_ids)))
    session.exec(delete(OrderItem).where(OrderItem.site_id == site_id))
    session.exec(delete(Order).where(Order.site_id == site_id))

    # 5. Cart Items & Carts
    cart_ids = session.exec(select(Cart.id).where(Cart.site_id == site_id)).all()
    if cart_ids:
        session.exec(delete(CartItem).where(CartItem.cart_id.in_(cart_ids)))
    session.exec(delete(Cart).where(Cart.site_id == site_id))

    # 6. Product Collections & Products
    product_ids = session.exec(select(Product.id).where(Product.site_id == site_id)).all()
    if product_ids:
        session.exec(delete(ProductCollection).where(ProductCollection.product_id.in_(product_ids)))
    session.exec(delete(Product).where(Product.site_id == site_id))

    # 7. Collections & Categories
    session.exec(delete(Collection).where(Collection.site_id == site_id))
    session.exec(delete(Category).where(Category.site_id == site_id))

    # 8. User Addresses & Users
    session.exec(delete(UserAddress).where(UserAddress.site_id == site_id))
    session.exec(delete(User).where(User.site_id == site_id))

    # 9. AdminSite associations
    session.exec(delete(AdminSite).where(AdminSite.site_id == site_id))

    # 10. Delete Site entity
    session.delete(site)
    session.commit()

    return {"message": "Site deleted successfully", "site_id": str(site_id)}