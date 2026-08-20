import pytest
from uuid import uuid4
from decimal import Decimal
from sqlmodel import Session, select, delete
from db.database import engine
from models import Order, Product, Cart, CartItem, User, Site, TenantLedgerEntry, OrderItem, OrderStatusHistory, InventoryMovement
from routers.payments import finalize_order_fulfillment
from routers.orders import utc_now


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


def cleanup_order(session: Session, order_id):
    session.exec(delete(OrderStatusHistory).where(OrderStatusHistory.order_id == order_id))
    session.exec(delete(InventoryMovement).where(InventoryMovement.order_id == order_id))
    session.exec(delete(OrderItem).where(OrderItem.order_id == order_id))
    session.exec(delete(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order_id))
    session.exec(delete(Order).where(Order.id == order_id))
    session.commit()


def test_idempotent_fulfillment_and_webhook_safety(db_session: Session):
    site = db_session.exec(select(Site)).first()
    customer = db_session.exec(select(User)).first()
    if not customer:
        customer = User(
            site_id=site.id,
            email=f"customer_{uuid4().hex[:6]}@example.com",
            name="Test Customer",
        )
        db_session.add(customer)
        db_session.commit()
        db_session.refresh(customer)

    site_id = site.id
    customer_id = customer.id

    # 1. Create a product with stock = 5
    product = Product(
        site_id=site_id,
        name="Wireless Keyboard",
        slug=f"wireless-keyboard-{uuid4().hex[:6]}",
        price=Decimal("1500.00"),
        stock=5,
        in_stock=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    # 2. Pre-create pending order
    order = Order(
        site_id=site_id,
        customer_id=customer_id,
        items=[{
            "product_id": str(product.id),
            "product_name": product.name,
            "product_slug": product.slug,
            "product_image": None,
            "selected_variant_label": None,
            "selected_variant_value": None,
            "unit_price": 1500.0,
            "compare_price": None,
            "quantity": 2,
            "line_total": 3000.0,
        }],
        pricing_snapshot={"subtotal": 3000.0, "total": 3000.0},
        payment_method="razorpay",
        payment_status="pending",
        razorpay_order_id=f"order_test_resilience_{uuid4().hex[:8]}",
        status="pending",
        total=Decimal("3000.00"),
        platform_fee=Decimal("90.00"),
        tenant_share=Decimal("2910.00"),
    )
    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)

    try:
        # 3. Simulate Webhook-first fulfillment (user closed tab!)
        success, err = finalize_order_fulfillment(
            order=order,
            session=db_session,
            payment_id=f"pay_mock_webhook_{uuid4().hex[:8]}",
            payment_method="upi",
        )
        assert success is True
        assert order.status == "placed"
        assert order.payment_status == "paid"

        # Verify inventory was decremented from 5 to 3
        db_session.refresh(product)
        assert product.stock == 3

        # Verify OrderItem rows were created
        items = db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
        assert len(items) == 1
        assert items[0].quantity == 2

        # Verify TenantLedgerEntry was created
        ledger = db_session.exec(select(TenantLedgerEntry).where(TenantLedgerEntry.order_id == order.id)).first()
        assert ledger is not None
        assert float(ledger.gross_amount) == 3000.0

        # 4. Simulate Customer later calling verify-payment (Idempotency test)
        success2, err2 = finalize_order_fulfillment(
            order=order,
            session=db_session,
            payment_id=order.razorpay_payment_id,
            signature="mock_sig",
        )
        assert success2 is True
        assert err2 == "Already fulfilled"

        # Ensure stock was NOT decremented twice!
        db_session.refresh(product)
        assert product.stock == 3
        items2 = db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all()
        assert len(items2) == 1
    finally:
        # Cleanup
        cleanup_order(db_session, order.id)
        db_session.delete(product)
        db_session.commit()


def test_oversell_auto_refund_protection(db_session: Session):
    site = db_session.exec(select(Site)).first()
    customer = db_session.exec(select(User)).first()
    if not customer:
        customer = User(
            site_id=site.id,
            email=f"customer_{uuid4().hex[:6]}@example.com",
            name="Test Customer",
        )
        db_session.add(customer)
        db_session.commit()
        db_session.refresh(customer)

    site_id = site.id
    customer_id = customer.id

    # 1. Product with only 1 in stock
    product = Product(
        site_id=site_id,
        name="Limited Edition Watch",
        slug=f"limited-edition-watch-{uuid4().hex[:6]}",
        price=Decimal("5000.00"),
        stock=1,
        in_stock=True,
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    # 2. Customer attempts to fulfill order for 2 items (exceeding stock)
    order = Order(
        site_id=site_id,
        customer_id=customer_id,
        items=[{
            "product_id": str(product.id),
            "product_name": product.name,
            "product_slug": product.slug,
            "product_image": None,
            "selected_variant_label": None,
            "selected_variant_value": None,
            "unit_price": 5000.0,
            "compare_price": None,
            "quantity": 2,
            "line_total": 10000.0,
        }],
        pricing_snapshot={"subtotal": 10000.0, "total": 10000.0},
        payment_method="razorpay",
        payment_status="pending",
        razorpay_order_id=f"order_test_oversold_{uuid4().hex[:8]}",
        status="pending",
        total=Decimal("10000.00"),
        platform_fee=Decimal("300.00"),
        tenant_share=Decimal("9700.00"),
    )
    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)

    try:
        # 3. Attempt fulfillment
        success, err = finalize_order_fulfillment(
            order=order,
            session=db_session,
            payment_id=f"pay_mock_oversold_{uuid4().hex[:8]}",
        )
        assert success is False
        assert "out of stock" in str(err)
        assert order.status == "cancelled"
        assert order.payment_status == "refunded"

        # Stock should remain intact
        db_session.refresh(product)
        assert product.stock == 1
    finally:
        # Cleanup
        cleanup_order(db_session, order.id)
        db_session.delete(product)
        db_session.commit()
