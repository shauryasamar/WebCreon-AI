import json
from contextlib import asynccontextmanager
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field
from sqlmodel import Session, select, delete, func

from agents.backend_exec import build_backend_config
from agents.backend_runtime import register_backend_routes
from agents.planning import plan_site
from agents.site_schema import build_site_definition
from agents.understanding import extract_requirements
from auth_middleware import (
    authenticate_admin,
    authenticate_customer,
    enforce_site_ownership,
)
from db.database import create_db_and_tables, get_session
from models import (
    Admin, AdminSite, Site, Product, Category, Collection, Cart, CartItem, Order, OrderItem,
    ProductCollection, ProductReview, ReturnRequest, ReturnItem, ReturnStatusHistory,
    Shipment, InventoryMovement, OrderStatusHistory, User, UserAddress
)
from routers import auth, cart, categories, checkout, checkout_settings, collections, orders, products, returns

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="AI Website Builder Backend", lifespan=lifespan)


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(collections.router)
app.include_router(cart.router)
app.include_router(checkout.router)
app.include_router(checkout_settings.router)
app.include_router(orders.router)
app.include_router(returns.router)


class GenerateSiteRequest(BaseModel):
    prompt: str


class SaveSiteRequest(BaseModel):
    slug: str
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
async def conversation_start_endpoint(req: StartConversationRequest, request: Request):
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


@app.post("/conversation/reply")
async def conversation_reply_endpoint(req: ReplyConversationRequest):
    from agents.conversation_agent import reply_session
    try:
        session = await reply_session(session_id=req.session_id, user_reply=req.reply)
        return session.model_dump()
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@app.get("/conversation/{session_id}")
async def conversation_get_endpoint(session_id: str):
    from agents.conversation_agent import SESSIONS
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


class CoPilotChatRequest(BaseModel):
    site_id: str
    message: str
    chat_history: Optional[List[Dict[str, str]]] = None
    draft_definition: Optional[Dict[str, Any]] = None


@app.post("/copilot/chat")
async def copilot_chat_endpoint(req: CoPilotChatRequest):
    from agents.copilot_agent import process_copilot_request
    result = await process_copilot_request(
        message=req.message,
        site_id=req.site_id,
        chat_history=req.chat_history,
        draft_definition=req.draft_definition,
    )
    return result


@app.post("/copilot/chat/stream")
async def copilot_chat_stream_endpoint(req: CoPilotChatRequest):
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
async def generate_site_definition_endpoint(req: CustomSiteDefinitionRequest):
    prompt_text = req.prompt or ""
    collected_reqs = {}

    if req.session_id:
        from agents.conversation_agent import SESSIONS
        session = SESSIONS.get(req.session_id)
        if session:
            collected_reqs = session.collected
            if not prompt_text:
                prompt_text = "\n".join([f"{t['sender']}: {t['text']}" for t in session.turns])

    # Run base extraction
    requirements = await extract_requirements(prompt_text or "General store")

    # Merge collected preferences from conversation
    if collected_reqs.get("brand_name"):
        requirements["brand_name"] = collected_reqs["brand_name"]
    if collected_reqs.get("domain"):
        requirements["domain"] = collected_reqs["domain"]
        requirements["catalog_type"] = collected_reqs["domain"]
    if collected_reqs.get("chosen_palette"):
        requirements["chosen_palette"] = collected_reqs["chosen_palette"]
    if collected_reqs.get("navbar_position"):
        requirements["navbar_position"] = collected_reqs["navbar_position"]
    if collected_reqs.get("navbar_layout"):
        requirements["navbar_layout"] = collected_reqs["navbar_layout"]
    if collected_reqs.get("footer_layout"):
        requirements["footer_layout"] = collected_reqs["footer_layout"]
    if collected_reqs.get("tagline"):
        requirements["tagline"] = collected_reqs["tagline"]

    # Run plan and build site definition
    site_plan = await plan_site(requirements)
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
async def generate_site_definition_stream_endpoint(req: CustomSiteDefinitionRequest):
    async def event_generator():
        try:
            yield f"data: {json.dumps({'step': 'start', 'progress': 10, 'message': 'Initializing AI generation pipeline...'})}\n\n"
            
            prompt_text = req.prompt or ""
            collected_reqs = {}

            if req.session_id:
                from agents.conversation_agent import SESSIONS
                session = SESSIONS.get(req.session_id)
                if session:
                    collected_reqs = session.collected
                    if not prompt_text:
                        prompt_text = "\n".join([f"{t['sender']}: {t['text']}" for t in session.turns])

            yield f"data: {json.dumps({'step': 'understanding', 'progress': 25, 'message': 'Extracting e-commerce brand requirements and theme tokens...'})}\n\n"
            requirements = await extract_requirements(prompt_text or "General store")

            if collected_reqs.get("brand_name"):
                requirements["brand_name"] = collected_reqs["brand_name"]
            if collected_reqs.get("domain"):
                requirements["domain"] = collected_reqs["domain"]
                requirements["catalog_type"] = collected_reqs["domain"]
            if collected_reqs.get("chosen_palette"):
                requirements["chosen_palette"] = collected_reqs["chosen_palette"]
            if collected_reqs.get("navbar_position"):
                requirements["navbar_position"] = collected_reqs["navbar_position"]
            if collected_reqs.get("navbar_layout"):
                requirements["navbar_layout"] = collected_reqs["navbar_layout"]
            if collected_reqs.get("footer_layout"):
                requirements["footer_layout"] = collected_reqs["footer_layout"]
            if collected_reqs.get("tagline"):
                requirements["tagline"] = collected_reqs["tagline"]

            yield f"data: {json.dumps({'step': 'planning', 'progress': 50, 'message': 'Synthesizing pages, catalog structures, and layout plans...'})}\n\n"
            site_plan = await plan_site(requirements)

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
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    site.site_definition = payload.draft_definition
    site.draft_definition = payload.draft_definition
    site.version = site.version + 1

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

    name = getattr(admin_obj, "name", None)
    if not name and admin_obj.email:
        prefix = admin_obj.email.split("@")[0]
        parts = [p.capitalize() for p in prefix.replace(".", " ").replace("_", " ").split()]
        name = " ".join(parts) if parts else "Admin"

    return {
        "admin": {
            "id": str(admin_obj.id),
            "email": admin_obj.email,
            "name": name,
        }
    }


@app.get("/auth/customer/me")
def customer_me(user=Depends(authenticate_customer)):
    return user


@app.get("/sites")
def get_sites(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
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


@app.get("/public/sites/slug/{slug}")
def get_public_site_by_slug(
    slug: str,
    session: Session = Depends(get_session),
):
    site = session.exec(
        select(Site).where(Site.slug == slug)
    ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    return site


@app.post("/sites")
def create_site(
    payload: SaveSiteRequest,
    admin=Depends(authenticate_admin),
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
        admin_id=UUID(admin["adminId"]),
        site_id=site.id,
        role_on_site="owner",
    )
    session.add(admin_site)
    session.commit()

    session.refresh(site)
    return site


@app.put("/sites/{site_id}")
def update_site(
    site_id: UUID,
    payload: SaveSiteRequest,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    slug_conflict = session.exec(
        select(Site).where(Site.slug == payload.slug, Site.id != site_id)
    ).first()
    if slug_conflict:
        raise HTTPException(status_code=400, detail="Site slug already exists")

    site.slug = payload.slug
    site.site_definition = payload.site_definition
    site.draft_definition = payload.draft_definition
    site.version = site.version + 1

    session.add(site)
    session.commit()
    session.refresh(site)

    return site


@app.get("/sites/{site_id}/delete-check")
def check_site_deletable(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
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