from dotenv import load_dotenv
load_dotenv()

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field
from sqlmodel import Session, select

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
from models import AdminSite, Site
from routers import auth, products

app = FastAPI(title="AI Website Builder Backend")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)


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


@app.post("/site-definition")
async def generate_site_definition_endpoint(req: GenerateSiteRequest):
    result = await run_generation_pipeline(req.prompt)
    return {
        "requirements": result["requirements"],
        "site_definition": result["site_definition"],
    }


@app.get("/auth/admin/me")
def admin_me(admin=Depends(authenticate_admin)):
    return admin


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