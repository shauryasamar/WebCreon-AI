import pytest
import asyncio
from uuid import uuid4
from decimal import Decimal
from datetime import datetime, timezone
from sqlmodel import Session

from db.database import engine
from models import Site, User, Product, Order, OrderItem
from agents.sql_agent_engine import (
    validate_and_sanitize_sql,
    execute_safe_sql,
    run_dynamic_store_query,
)


@pytest.fixture
def test_store_data():
    site_id = uuid4()
    with Session(engine) as db:
        # Create test site
        site = Site(
            id=site_id,
            slug=f"test-store-{site_id.hex[:6]}",
            site_definition={"site": {"brand_name": "Test Groceries"}},
        )
        db.add(site)
        db.commit()

        # Create customers & products
        u1 = User(id=uuid4(), site_id=site_id, name="Aarav Sharma", email=f"aarav-{uuid4().hex[:6]}@example.com")
        u2 = User(id=uuid4(), site_id=site_id, name="Priya Patel", email=f"priya-{uuid4().hex[:6]}@example.com")
        p1 = Product(id=uuid4(), site_id=site_id, name="Organic Almonds", category="Dry Fruits", price=Decimal("499.00"), stock=30)
        p2 = Product(id=uuid4(), site_id=site_id, name="Green Tea", category="Beverages", price=Decimal("250.00"), stock=15)
        db.add(u1)
        db.add(u2)
        db.add(p1)
        db.add(p2)
        db.commit()

        # Create orders
        o1 = Order(
            id=uuid4(),
            site_id=site_id,
            customer_id=u1.id,
            total=Decimal("998.00"),
            status="delivered",
            items=[{"product_name": "Organic Almonds", "quantity": 2, "price": 499.0}],
        )
        o2 = Order(
            id=uuid4(),
            site_id=site_id,
            customer_id=u2.id,
            total=Decimal("250.00"),
            status="placed",
            items=[{"product_name": "Green Tea", "quantity": 1, "price": 250.0}],
        )
        db.add(o1)
        db.add(o2)
        db.commit()

        # Create order items
        oi1 = OrderItem(
            id=uuid4(),
            site_id=site_id,
            order_id=o1.id,
            product_id=p1.id,
            product_name="Organic Almonds",
            unit_price=Decimal("499.00"),
            quantity=2,
            line_total=Decimal("998.00"),
        )
        oi2 = OrderItem(
            id=uuid4(),
            site_id=site_id,
            order_id=o2.id,
            product_id=p2.id,
            product_name="Green Tea",
            unit_price=Decimal("250.00"),
            quantity=1,
            line_total=Decimal("250.00"),
        )
        db.add(oi1)
        db.add(oi2)
        db.commit()

    yield str(site_id)

    # Teardown
    with Session(engine) as db:
        from sqlmodel import select
        for oi in db.exec(select(OrderItem).where(OrderItem.site_id == site_id)).all():
            db.delete(oi)
        for o in db.exec(select(Order).where(Order.site_id == site_id)).all():
            db.delete(o)
        for p in db.exec(select(Product).where(Product.site_id == site_id)).all():
            db.delete(p)
        for u in db.exec(select(User).where(User.site_id == site_id)).all():
            db.delete(u)
        site_obj = db.get(Site, site_id)
        if site_obj:
            db.delete(site_obj)
        db.commit()


def test_sql_validator_blocks_destructive_queries():
    site_id = "11111111-1111-1111-1111-111111111111"

    # Block DELETE
    v, _, _ = validate_and_sanitize_sql(f"DELETE FROM orders WHERE site_id = '{site_id}'", site_id)
    assert not v

    # Block DROP
    v, _, _ = validate_and_sanitize_sql(f"DROP TABLE orders", site_id)
    assert not v

    # Block UPDATE
    v, _, _ = validate_and_sanitize_sql(f"UPDATE orders SET total = 0 WHERE site_id = '{site_id}'", site_id)
    assert not v

    # Block Admin table queries
    v, _, _ = validate_and_sanitize_sql(f"SELECT * FROM admins WHERE site_id = '{site_id}'", site_id)
    assert not v

    # Block queries without site_id
    v, _, _ = validate_and_sanitize_sql(f"SELECT * FROM orders", site_id)
    assert not v

    # Valid SELECT
    v, clean, _ = validate_and_sanitize_sql(f"SELECT * FROM orders WHERE site_id = '{site_id}'", site_id)
    assert v
    assert "LIMIT" in clean


def test_sql_execution_on_test_store(test_store_data):
    site_id = test_store_data

    # Query total revenue
    sql = f"SELECT SUM(total) as revenue FROM orders WHERE site_id = '{site_id}' AND status != 'cancelled'"
    res = execute_safe_sql(sql, site_id)
    assert res["success"] is True
    assert res["row_count"] == 1
    assert float(res["rows"][0]["revenue"]) == 1248.0


def test_run_dynamic_store_query_end_to_end(test_store_data):
    site_id = test_store_data

    res = asyncio.run(run_dynamic_store_query("which customer spent the most?", site_id))
    assert res["success"] is True
    assert res["row_count"] >= 1
    # Aarav Sharma spent 998, Priya spent 250
    first_row = res["rows"][0]
    assert "Aarav" in str(first_row.values())
