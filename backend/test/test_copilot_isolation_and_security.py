"""
WebCreon AI Store Co-Pilot - Comprehensive Isolation, Security & Idempotency Test Suite
Verifies:
1. Cross-tenant & cross-site isolation
2. Canonical request context & authorization
3. SQL Agent AST containment & attack rejection
4. Safe order state transitions & audit trail
5. Idempotency & duplicate mutation prevention
6. Optimistic concurrency & server-persisted site revisions
7. Typed action planning & reference resolution
"""

import pytest
from uuid import uuid4, UUID
from decimal import Decimal
from datetime import datetime, timezone
from sqlmodel import Session, select

from sqlmodel import Session, select, create_engine, SQLModel
from sqlmodel.pool import StaticPool

from models import Admin, AdminSite, Site, User, Order, OrderStatusHistory, AuditLog, Role
from services.copilot_context import authorize_site_action, CopilotRequestContext
from services.idempotency_service import reserve_operation, complete_operation, _OPERATIONS_STORE
from services.site_revision_service import create_site_revision, undo_site_revision, _SITE_REVISIONS_STORE
from services.order_copilot_service import mutate_order_status_safe, get_order_for_site, ALLOWED_ORDER_TRANSITIONS
from agents.sql_agent_engine import validate_and_sanitize_sql, execute_safe_sql
from agents.copilot_action_plan import (
    PlannedAction,
    ActionPlan,
    calculate_deterministic_risk,
    resolve_component_target,
    validate_and_refine_action_plan,
)

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

# In-memory test engine for isolated unit testing
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
for model in [Admin, AdminSite, Site, User, Order, OrderStatusHistory, AuditLog, Role]:
    model.__table__.create(test_engine, checkfirst=True)





@pytest.fixture
def isolation_setup():
    """Sets up Tenant A (Admin A, Site A1, Site A2) and Tenant B (Admin B, Site B1)."""
    admin_a_id = uuid4()
    admin_b_id = uuid4()
    site_a1_id = uuid4()
    site_a2_id = uuid4()
    site_b1_id = uuid4()

    with Session(test_engine) as db:
        # Create Admins
        admin_a = Admin(id=admin_a_id, email=f"admin_a_{admin_a_id.hex[:6]}@example.com", password_hash="hash", name="Admin A", role="Owner")
        admin_b = Admin(id=admin_b_id, email=f"admin_b_{admin_b_id.hex[:6]}@example.com", password_hash="hash", name="Admin B", role="Owner")
        db.add(admin_a)
        db.add(admin_b)

        # Create Sites
        site_a1 = Site(id=site_a1_id, slug=f"site-a1-{site_a1_id.hex[:6]}", site_definition={"site": {"brand_name": "Store A1"}, "pages": [{"id": "p1", "blocks": [{"id": "hero_a1", "type": "hero_banner"}]}]})
        site_a2 = Site(id=site_a2_id, slug=f"site-a2-{site_a2_id.hex[:6]}", site_definition={"site": {"brand_name": "Store A2"}, "pages": [{"id": "p1", "blocks": [{"id": "hero_a2", "type": "hero_banner"}]}]})
        site_b1 = Site(id=site_b1_id, slug=f"site-b1-{site_b1_id.hex[:6]}", site_definition={"site": {"brand_name": "Store B1"}, "pages": [{"id": "p1", "blocks": [{"id": "hero_b1", "type": "hero_banner"}]}]})
        db.add(site_a1)
        db.add(site_a2)
        db.add(site_b1)

        # Link AdminSite
        link_a1 = AdminSite(id=uuid4(), admin_id=admin_a_id, site_id=site_a1_id, role_on_site="owner")
        link_a2 = AdminSite(id=uuid4(), admin_id=admin_a_id, site_id=site_a2_id, role_on_site="owner")
        link_b1 = AdminSite(id=uuid4(), admin_id=admin_b_id, site_id=site_b1_id, role_on_site="owner")
        db.add(link_a1)
        db.add(link_a2)
        db.add(link_b1)

        # Create Orders for each site
        order_a1_id = uuid4()
        order_b1_id = uuid4()
        order_a1 = Order(
            id=order_a1_id,
            site_id=site_a1_id,
            customer_id=uuid4(),
            total=Decimal("1500.00"),
            status="placed",
            items=[{"product_name": "Test Item A", "quantity": 1, "price": 1500.0}],
        )
        order_b1 = Order(
            id=order_b1_id,
            site_id=site_b1_id,
            customer_id=uuid4(),
            total=Decimal("2500.00"),
            status="placed",
            items=[{"product_name": "Test Item B", "quantity": 1, "price": 2500.0}],
        )
        db.add(order_a1)
        db.add(order_b1)


        db.commit()

    return {
        "admin_a_id": admin_a_id,
        "admin_b_id": admin_b_id,
        "site_a1_id": site_a1_id,
        "site_a2_id": site_a2_id,
        "site_b1_id": site_b1_id,
        "order_a1_id": order_a1_id,
        "order_b1_id": order_b1_id,
        "engine": test_engine,
    }




def test_cross_tenant_authorization_rejection(isolation_setup):
    """Test 1: Admin A cannot authorize an action on Tenant B's site B1."""
    with Session(isolation_setup["engine"]) as db:
        # Admin A requesting access to Site A1 -> ALLOWED
        dec_a1 = authorize_site_action(
            admin_id=isolation_setup["admin_a_id"],
            requested_site_id=isolation_setup["site_a1_id"],
            action="chat:send",
            session=db,
        )
        assert dec_a1.allowed is True
        assert dec_a1.context.site_id == isolation_setup["site_a1_id"]

        # Admin A requesting access to Site B1 -> REJECTED
        dec_b1 = authorize_site_action(
            admin_id=isolation_setup["admin_a_id"],
            requested_site_id=isolation_setup["site_b1_id"],
            action="chat:send",
            session=db,
        )
        assert dec_b1.allowed is False
        assert "does not have access" in dec_b1.reason


def test_cross_site_order_mutation_isolation(isolation_setup):
    """Test 2: Admin A cannot view or mutate Tenant B's order B1 through Site A1 context."""
    with Session(isolation_setup["engine"]) as db:
        # Looking up Order B1 under Site A1 context must return None
        looked_up = get_order_for_site(db, isolation_setup["site_a1_id"], str(isolation_setup["order_b1_id"]))
        assert looked_up is None

        # Attempting to mutate Order B1 under Site A1 must fail
        success, order, err = mutate_order_status_safe(
            session=db,
            site_id=isolation_setup["site_a1_id"],
            order_id_or_ref=str(isolation_setup["order_b1_id"]),
            new_status="accepted",
            actor_id=isolation_setup["admin_a_id"],
        )
        assert success is False
        assert "not found in this store" in err


def test_order_status_transition_matrix(isolation_setup):
    """Test 3: Order state transitions enforce business rules deterministically."""
    with Session(isolation_setup["engine"]) as db:
        order_id = str(isolation_setup["order_a1_id"])
        site_id = isolation_setup["site_a1_id"]
        admin_id = isolation_setup["admin_a_id"]

        # 1. placed -> accepted (VALID)
        s1, o1, err1 = mutate_order_status_safe(db, site_id, order_id, "accepted", admin_id)
        assert s1 is True
        assert o1.status == "accepted"

        # 2. accepted -> delivered (INVALID: must be shipped or out_for_delivery first)
        s2, o2, err2 = mutate_order_status_safe(db, site_id, order_id, "delivered", admin_id)
        assert s2 is False
        assert "Invalid status transition" in err2

        # 3. accepted -> shipped (VALID)
        s3, o3, err3 = mutate_order_status_safe(db, site_id, order_id, "shipped", admin_id)
        assert s3 is True
        assert o3.status == "shipped"

        # 4. shipped -> delivered (VALID)
        s4, o4, err4 = mutate_order_status_safe(db, site_id, order_id, "delivered", admin_id)
        assert s4 is True
        assert o4.status == "delivered"

        # 5. delivered -> cancelled (INVALID: delivered is terminal)
        s5, o5, err5 = mutate_order_status_safe(db, site_id, order_id, "cancelled", admin_id)
        assert s5 is False
        assert "Invalid status transition" in err5


def test_sql_agent_containment_and_security():
    """Test 4: SQL Agent AST containment strictly rejects mutations, comments, and injection."""
    site_id = "11111111-2222-3333-4444-555555555555"

    # Valid SELECT query with site_id
    v1, q1, r1 = validate_and_sanitize_sql("SELECT name, price FROM products WHERE site_id = '11111111-2222-3333-4444-555555555555'", site_id)
    assert v1 is True
    assert "LIMIT 200" in q1

    # Missing site_id filter -> REJECTED
    v2, q2, r2 = validate_and_sanitize_sql("SELECT name, price FROM products", site_id)
    assert v2 is False
    assert "missing mandatory tenant" in r2.lower()

    # Mutation attempt: UPDATE -> REJECTED
    v3, q3, r3 = validate_and_sanitize_sql("UPDATE orders SET total = 0 WHERE site_id = '11111111-2222-3333-4444-555555555555'", site_id)
    assert v3 is False
    assert "forbidden" in r3.lower() or "read-only" in r3.lower()

    # Mutation attempt: DROP TABLE -> REJECTED
    v4, q4, r4 = validate_and_sanitize_sql("DROP TABLE orders; SELECT * FROM products WHERE site_id = '11111111-2222-3333-4444-555555555555'", site_id)
    assert v4 is False

    # Data-modifying CTE: WITH ins AS (INSERT ...) -> REJECTED
    v5, q5, r5 = validate_and_sanitize_sql("WITH ins AS (INSERT INTO products (name) VALUES ('Hacked')) SELECT * FROM products WHERE site_id = '11111111-2222-3333-4444-555555555555'", site_id)
    assert v5 is False
    assert "forbidden" in r5.lower()

    # Querying admin table -> REJECTED
    v6, q6, r6 = validate_and_sanitize_sql("SELECT email, password_hash FROM admins WHERE site_id = '11111111-2222-3333-4444-555555555555'", site_id)
    assert v6 is False


def test_idempotency_duplicate_protection():
    """Test 5: Replaying the same operation_id returns cached result and prevents duplicate execution."""
    op_id = uuid4()
    site_id = uuid4()
    user_id = uuid4()

    # 1. Initial reservation -> Allowed
    can_proceed, cached, err = reserve_operation(
        operation_id=op_id,
        site_id=site_id,
        user_id=user_id,
        action_type="order_cancel",
        payload={"order_id": "123"},
    )
    assert can_proceed is True
    assert cached is None

    # 2. Complete operation
    complete_operation(operation_id=op_id, result={"status": "cancelled", "order_id": "123"})

    # 3. Duplicate request with same payload -> Returns cached result, blocks re-execution
    can_proceed_dup, cached_dup, err_dup = reserve_operation(
        operation_id=op_id,
        site_id=site_id,
        user_id=user_id,
        action_type="order_cancel",
        payload={"order_id": "123"},
    )
    assert can_proceed_dup is False
    assert cached_dup == {"status": "cancelled", "order_id": "123"}

    # 4. Same operation ID with different payload -> Returns conflict error
    can_proceed_conflict, _, err_conflict = reserve_operation(
        operation_id=op_id,
        site_id=site_id,
        user_id=user_id,
        action_type="order_cancel",
        payload={"order_id": "456"},
    )
    assert can_proceed_conflict is False
    assert "Idempotency conflict" in err_conflict


def test_optimistic_concurrency_and_server_undo(isolation_setup):
    """Test 6: Optimistic concurrency rejects stale writes (409) and server-side undo restores previous revision."""
    with Session(isolation_setup["engine"]) as db:
        site_id = isolation_setup["site_a1_id"]
        admin_id = isolation_setup["admin_a_id"]

        # Initial revision
        s1, v1, e1, rec1 = create_site_revision(
            session=db,
            site_id=site_id,
            actor_id=admin_id,
            new_definition={"theme": {"primary_bg": "#111111"}},
            expected_base_version=1,
        )
        assert s1 is True
        assert v1 == 2

        # Stale write attempt: client sends base_version=1 when server is at version=2 -> REJECTED
        s_stale, v_stale, e_stale, _ = create_site_revision(
            session=db,
            site_id=site_id,
            actor_id=admin_id,
            new_definition={"theme": {"primary_bg": "#222222"}},
            expected_base_version=1,
        )
        assert s_stale is False
        assert "Version conflict" in e_stale

        # Valid second revision
        s2, v2, e2, rec2 = create_site_revision(
            session=db,
            site_id=site_id,
            actor_id=admin_id,
            new_definition={"theme": {"primary_bg": "#333333"}},
            expected_base_version=2,
        )
        assert s2 is True
        assert v2 == 3

        # Durable Undo -> Restores v2 definition as a new compensating v4 revision
        u_success, u_version, u_def, u_err = undo_site_revision(
            session=db,
            site_id=site_id,
            actor_id=admin_id,
        )
        assert u_success is True
        assert u_version == 4
        assert u_def == {"theme": {"primary_bg": "#111111"}}



def test_action_plan_target_resolution_and_risk():
    """Test 7: Deterministic risk calculation and reference resolution within site definition."""
    site_def = {
        "pages": [
            {
                "id": "p1",
                "blocks": [
                    {"id": "hero_main_banner", "type": "hero_banner"},
                    {"id": "products_section", "type": "product_grid"},
                ]
            }
        ]
    }

    # Target resolution: "banner" resolves to hero_main_banner
    target_id, target_type = resolve_component_target(
        requested_target="banner",
        site_definition=site_def,
    )
    assert target_id == "hero_main_banner"
    assert target_type == "hero_banner"

    # Deterministic risk evaluation
    risk_read, conf_read = calculate_deterministic_risk("analytics_query", {})
    assert risk_read == "read_only"
    assert conf_read is False

    risk_cancel, conf_cancel = calculate_deterministic_risk("order_status_change", {"new_status": "cancelled"})
    assert risk_cancel == "financial_or_fulfilment_write"
    assert conf_cancel is True


@pytest.mark.asyncio
async def test_sql_agent_webpage_catalog_fallback():
    """Test 8: SQL Agent accurately returns products from site_definition when DB table is empty."""
    from agents.sql_agent_engine import run_dynamic_store_query
    
    mock_site_def = {
        "products": [
            {"id": "p1", "name": "Silk Velvet Kurta", "price": 2499.0, "stock": 45, "category": "Ethnic Wear", "in_stock": True},
            {"id": "p2", "name": "Cotton Linen Shirt", "price": 1299.0, "stock": 10, "category": "Casual", "in_stock": True},
        ]
    }
    
    res = await run_dynamic_store_query(
        user_query="What products and prices are on my webpage?",
        site_id="00000000-0000-0000-0000-000000000001",
        site_definition=mock_site_def,
    )
    assert res.get("success") is True
    assert res.get("row_count") == 2
    assert any("Silk Velvet Kurta" in r.get("Name", "") for r in res.get("rows", []))


@pytest.mark.asyncio
async def test_compound_action_chaining():
    """Test 9: Compound multi-action pipeline executes chained actions sequentially."""
    from agents.copilot_orchestrator import compound_agent_node
    
    base_def = {
        "site": {"brand_name": "Velvet Luxe", "domain": "fashion"},
        "theme": {"mode": "light", "primary_bg": "#ffffff", "navbar_bg": "#111111"},
        "pages": [{"id": "p1", "name": "Home", "route": "/", "blocks": []}],
    }
    
    state = {
        "user_message": "revert the last change and add new banner for Diwali sale",
        "site_id": "00000000-0000-0000-0000-000000000001",
        "site_definition": base_def,
        "history_str": "",
        "intent": "COMPOUND",
        "compound_tasks": [
            {"intent": "DESIGN", "target_component": "revert", "task_instruction": "revert the last change"},
            {"intent": "DESIGN", "target_component": "banner_create", "task_instruction": "add new banner for Diwali sale"},
        ],
    }
    
    out = await compound_agent_node(state)
    payload = out.get("agent_payload", {})
    assert payload.get("compound_execution") is True
    assert len(payload.get("compound_action_summaries", [])) >= 2
    assert payload.get("design_modified") is True
    assert payload.get("next_draft_definition") is not None
