import pytest
import concurrent.futures
from uuid import uuid4, UUID
from decimal import Decimal
from sqlmodel import Session, select, delete
from db.database import engine
from models import (
    Order,
    Product,
    Cart,
    CartItem,
    User,
    Site,
    UserAddress,
    TenantLedgerEntry,
    OrderItem,
    OrderStatusHistory,
    InventoryMovement,
)
from routers.orders import place_order, PlaceOrderRequest
from routers.payments import finalize_order_fulfillment
from fastapi import HTTPException


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


def create_test_fixtures(session: Session):
    site = session.exec(select(Site)).first()
    if not site:
        site = Site(
            name="Test Store",
            slug=f"store-{uuid4().hex[:6]}",
            owner_id=uuid4(),
        )
        session.add(site)
        session.commit()
        session.refresh(site)

    user1 = User(
        site_id=site.id,
        email=f"user1_{uuid4().hex[:6]}@test.com",
        name="Customer 1",
    )
    user2 = User(
        site_id=site.id,
        email=f"user2_{uuid4().hex[:6]}@test.com",
        name="Customer 2",
    )
    session.add(user1)
    session.add(user2)
    session.commit()
    session.refresh(user1)
    session.refresh(user2)

    addr1 = UserAddress(
        site_id=site.id,
        user_id=user1.id,
        full_name="Customer 1",
        mobile_number="9876543210",
        address_line1="123 Main St",
        city="Bengaluru",
        postal_code="560001",
        address_type="Home",
    )
    addr2 = UserAddress(
        site_id=site.id,
        user_id=user2.id,
        full_name="Customer 2",
        mobile_number="9876543211",
        address_line1="456 Cross St",
        city="Bengaluru",
        postal_code="560002",
        address_type="Home",
    )
    session.add(addr1)
    session.add(addr2)
    session.commit()
    session.refresh(addr1)
    session.refresh(addr2)

    return site, user1, addr1, user2, addr2


def test_multi_item_race_condition_place_order():
    """
    Simulates Customer 1 ordering [Product A (1 in stock), Product B (5 in stock)]
    and Customer 2 ordering [Product A (1 in stock)] at the exact same millisecond.
    Verifies:
    1. Exactly 1 order succeeds.
    2. The other order fails gracefully with 409 Conflict.
    3. Product A stock becomes 0.
    4. Product B stock is only deducted for the winning order (4 left), NOT deducted on failed order.
    """
    with Session(engine) as session:
        site, user1, addr1, user2, addr2 = create_test_fixtures(session)

        # Product A: Only 1 in stock
        prod_a = Product(
            site_id=site.id,
            name="Contested Exclusive Watch",
            slug=f"watch-{uuid4().hex[:6]}",
            price=Decimal("2999.00"),
            stock=1,
            in_stock=True,
        )
        # Product B: 5 in stock
        prod_b = Product(
            site_id=site.id,
            name="Standard Leather Strap",
            slug=f"strap-{uuid4().hex[:6]}",
            price=Decimal("499.00"),
            stock=5,
            in_stock=True,
        )
        session.add(prod_a)
        session.add(prod_b)
        session.commit()
        session.refresh(prod_a)
        session.refresh(prod_b)

        prod_a_id = prod_a.id
        prod_b_id = prod_b.id

        # User 1 Cart: Product A + Product B
        cart1 = Cart(site_id=site.id, user_id=user1.id)
        session.add(cart1)
        session.commit()
        session.refresh(cart1)
        ci1_a = CartItem(cart_id=cart1.id, product_id=prod_a_id, quantity=1, unit_price=prod_a.price)
        ci1_b = CartItem(cart_id=cart1.id, product_id=prod_b_id, quantity=1, unit_price=prod_b.price)
        session.add(ci1_a)
        session.add(ci1_b)

        # User 2 Cart: Product A
        cart2 = Cart(site_id=site.id, user_id=user2.id)
        session.add(cart2)
        session.commit()
        session.refresh(cart2)
        ci2_a = CartItem(cart_id=cart2.id, product_id=prod_a_id, quantity=1, unit_price=prod_a.price)
        session.add(ci2_a)
        session.commit()

        site_id = site.id
        u1_dict = {"userId": str(user1.id), "siteId": str(site.id)}
        u2_dict = {"userId": str(user2.id), "siteId": str(site.id)}
        a1_id = addr1.id
        a2_id = addr2.id

    def execute_order_1():
        with Session(engine) as s:
            payload = PlaceOrderRequest(address_id=a1_id, payment_method="cod")
            return place_order(site_id=site_id, payload=payload, user=u1_dict, session=s)

    def execute_order_2():
        with Session(engine) as s:
            payload = PlaceOrderRequest(address_id=a2_id, payment_method="cod")
            return place_order(site_id=site_id, payload=payload, user=u2_dict, session=s)

    # Launch both requests concurrently
    results = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(execute_order_1)
        f2 = executor.submit(execute_order_2)
        for f in (f1, f2):
            try:
                res = f.result()
                results.append(res)
            except Exception as e:
                errors.append(e)

    # Assertions
    assert len(results) == 1, f"Expected exactly 1 order to succeed, got {len(results)}"
    assert len(errors) == 1, f"Expected exactly 1 order to fail, got {len(errors)}"
    
    err = errors[0]
    assert isinstance(err, HTTPException)
    assert err.status_code == 409
    assert "stock" in err.detail.lower()

    # Verify final stock in DB
    with Session(engine) as session:
        updated_a = session.get(Product, prod_a_id)
        updated_b = session.get(Product, prod_b_id)

        assert updated_a.stock == 0
        assert updated_a.in_stock is False

        # If User 1 won, Product B should be 4. If User 2 won, User 1 failed completely so Product B remains 5.
        winning_order_id = UUID(results[0]["order_id"])
        winning_order = session.get(Order, winning_order_id)
        assert winning_order is not None

        if len(winning_order.items) == 2:
            assert updated_b.stock == 4, "Product B stock should be 4 (User 1 won)"
        else:
            assert updated_b.stock == 5, "Product B stock should be 5 (User 2 won, User 1 rolled back completely)"


def test_deterministic_lock_ordering_deadlock_free():
    """
    Tests deadlock immunity when concurrent threads purchase [A, B] and [B, A]
    in opposing order.
    """
    with Session(engine) as session:
        site, user1, addr1, user2, addr2 = create_test_fixtures(session)

        prod_x = Product(
            site_id=site.id,
            name="Product X",
            slug=f"prod-x-{uuid4().hex[:6]}",
            price=Decimal("100.00"),
            stock=50,
            in_stock=True,
        )
        prod_y = Product(
            site_id=site.id,
            name="Product Y",
            slug=f"prod-y-{uuid4().hex[:6]}",
            price=Decimal("200.00"),
            stock=50,
            in_stock=True,
        )
        session.add(prod_x)
        session.add(prod_y)
        session.commit()
        session.refresh(prod_x)
        session.refresh(prod_y)

        prod_x_id = prod_x.id
        prod_y_id = prod_y.id

        # Thread A cart: [X, Y]
        cart_a = Cart(site_id=site.id, user_id=user1.id)
        session.add(cart_a)
        session.commit()
        session.refresh(cart_a)
        session.add(CartItem(cart_id=cart_a.id, product_id=prod_x_id, quantity=1, unit_price=prod_x.price))
        session.add(CartItem(cart_id=cart_a.id, product_id=prod_y_id, quantity=1, unit_price=prod_y.price))

        # Thread B cart: [Y, X] (reverse order)
        cart_b = Cart(site_id=site.id, user_id=user2.id)
        session.add(cart_b)
        session.commit()
        session.refresh(cart_b)
        session.add(CartItem(cart_id=cart_b.id, product_id=prod_y_id, quantity=1, unit_price=prod_y.price))
        session.add(CartItem(cart_id=cart_b.id, product_id=prod_x_id, quantity=1, unit_price=prod_x.price))
        session.commit()

        site_id = site.id
        u1_dict = {"userId": str(user1.id), "siteId": str(site.id)}
        u2_dict = {"userId": str(user2.id), "siteId": str(site.id)}
        a1_id = addr1.id
        a2_id = addr2.id

    def buy_a():
        with Session(engine) as s:
            payload = PlaceOrderRequest(address_id=a1_id, payment_method="cod")
            return place_order(site_id=site_id, payload=payload, user=u1_dict, session=s)

    def buy_b():
        with Session(engine) as s:
            payload = PlaceOrderRequest(address_id=a2_id, payment_method="cod")
            return place_order(site_id=site_id, payload=payload, user=u2_dict, session=s)

    # Run simultaneously
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(buy_a)
        f2 = executor.submit(buy_b)
        res1 = f1.result()
        res2 = f2.result()

    assert res1["status"] == "placed"
    assert res2["status"] == "placed"

    with Session(engine) as session:
        updated_x = session.get(Product, prod_x_id)
        updated_y = session.get(Product, prod_y_id)
        assert updated_x.stock == 48  # 50 - 2 = 48
        assert updated_y.stock == 48  # 50 - 2 = 48


def test_multi_item_online_payment_auto_refund_on_oversell():
    """
    Verifies that when an online payment is captured for a multi-item cart [P1, P2]
    where P1 went out of stock right as payment completed:
    1. Order is marked cancelled with auto-refund initiated.
    2. P2 stock is NOT deducted.
    """
    with Session(engine) as session:
        site, user1, addr1, _, _ = create_test_fixtures(session)

        p1 = Product(
            site_id=site.id,
            name="Sold Out Ring",
            slug=f"ring-{uuid4().hex[:6]}",
            price=Decimal("5000.00"),
            stock=0,  # Sold out right before payment verification
            in_stock=False,
        )
        p2 = Product(
            site_id=site.id,
            name="Silver Chain",
            slug=f"chain-{uuid4().hex[:6]}",
            price=Decimal("1500.00"),
            stock=10,
            in_stock=True,
        )
        session.add(p1)
        session.add(p2)
        session.commit()
        session.refresh(p1)
        session.refresh(p2)

        p1_id = p1.id
        p2_id = p2.id

        order = Order(
            site_id=site.id,
            customer_id=user1.id,
            payment_method="razorpay",
            payment_status="pending",
            status="pending",
            total=Decimal("6500.00"),
            items=[
                {"product_id": str(p1.id), "product_name": p1.name, "quantity": 1, "unit_price": 5000.0, "line_total": 5000.0},
                {"product_id": str(p2.id), "product_name": p2.name, "quantity": 1, "unit_price": 1500.0, "line_total": 1500.0},
            ],
            pricing_snapshot={"total": 6500.0},
        )
        session.add(order)
        session.commit()
        session.refresh(order)

        success, msg = finalize_order_fulfillment(
            order=order,
            session=session,
            payment_id="pay_mock_concurrency_test",
        )

        assert success is False
        assert "out of stock" in msg.lower()
        assert "refund" in msg.lower()

        session.refresh(order)
        assert order.status == "cancelled"
        assert order.payment_status == "refunded"

        # Ensure P2 stock remained untouched at 10
        updated_p2 = session.get(Product, p2_id)
        assert updated_p2.stock == 10
