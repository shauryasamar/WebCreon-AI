from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Admin(SQLModel, table=True):
    __tablename__ = "admins"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: Optional[str] = Field(default=None)
    password_hash: str
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class Site(SQLModel, table=True):
    __tablename__ = "sites"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    slug: str = Field(index=True, unique=True)
    site_definition: dict[str, Any] = Field(
        sa_column=Column(JSONB, nullable=False)
    )
    draft_definition: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    checkout_settings: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    version: int = Field(default=1, nullable=False)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class AdminSite(SQLModel, table=True):
    __tablename__ = "admin_sites"

    admin_id: UUID = Field(foreign_key="admins.id", primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", primary_key=True)
    role_on_site: str = Field(default="owner")
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("site_id", "email", name="uq_users_site_email"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)

    name: Optional[str] = Field(default=None, nullable=True)
    email: Optional[str] = Field(default=None, index=True, nullable=True)
    phone: Optional[str] = Field(default=None, nullable=True)
    password_hash: Optional[str] = Field(default=None, nullable=True)

    is_guest: bool = Field(default=False, nullable=False)
    is_active: bool = Field(default=True, nullable=False)

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class UserAddress(SQLModel, table=True):
    __tablename__ = "user_addresses"
    __table_args__ = (
        Index("ix_user_addresses_user_id", "user_id"),
        Index("ix_user_addresses_site_id", "site_id"),
        Index("ix_user_addresses_user_active", "user_id", "is_active"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)
    user_id: UUID = Field(foreign_key="users.id", nullable=False)

    full_name: str = Field(max_length=255, nullable=False)
    mobile_number: str = Field(max_length=30, nullable=False)
    address_line1: str = Field(max_length=255, nullable=False)
    city: str = Field(max_length=120, nullable=False)
    postal_code: str = Field(max_length=20, nullable=False)
    email: Optional[str] = Field(default=None, max_length=255, nullable=True)
    address_type: str = Field(max_length=30, nullable=False)

    is_default: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class Category(SQLModel, table=True):
    __tablename__ = "categories"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    name: str = Field(max_length=255, nullable=False)
    slug: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class Collection(SQLModel, table=True):
    __tablename__ = "collections"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    name: str = Field(max_length=255, nullable=False)
    slug: Optional[str] = Field(default=None, max_length=255)
    description: str = Field(default="")
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class ProductCollection(SQLModel, table=True):
    __tablename__ = "product_collections"
    __table_args__ = (
        UniqueConstraint("product_id", "collection_id", name="uq_product_collections_product_collection"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    product_id: UUID = Field(foreign_key="products.id", index=True)
    collection_id: UUID = Field(foreign_key="collections.id", index=True)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    category_id: Optional[UUID] = Field(default=None, foreign_key="categories.id", index=True)

    name: str
    brand: Optional[str] = Field(default=None, index=True)
    category: Optional[str] = Field(default=None, index=True)
    description: str = Field(default="")
    slug: Optional[str] = Field(default=None, index=True)

    price: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    compare_price: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True),
    )

    stock: int = Field(default=0, nullable=False)
    in_stock: bool = Field(default=True, nullable=False)

    images: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False),
    )
    variant_option: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class ProductReview(SQLModel, table=True):
    __tablename__ = "product_reviews"
    __table_args__ = (
        Index("ix_product_reviews_site_id", "site_id"),
        Index("ix_product_reviews_product_id", "product_id"),
        Index("ix_product_reviews_customer_id", "customer_id"),
        Index("ix_product_reviews_order_id", "order_id"),
        Index("ix_product_reviews_created_at", "created_at"),
        UniqueConstraint("order_item_id", name="uq_product_reviews_order_item"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    product_id: UUID = Field(foreign_key="products.id", index=True)
    customer_id: UUID = Field(foreign_key="users.id", index=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    order_item_id: UUID = Field(foreign_key="order_items.id", index=True)

    rating: int = Field(nullable=False)
    review_text: str = Field(default="", nullable=False)
    review_images: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False),
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class Cart(SQLModel, table=True):
    __tablename__ = "carts"
    __table_args__ = (UniqueConstraint("site_id", "user_id", name="uq_carts_site_user"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class CartItem(SQLModel, table=True):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint(
            "cart_id",
            "product_id",
            "selected_variant_value",
            name="uq_cart_items_cart_product_variant",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    cart_id: UUID = Field(foreign_key="carts.id", index=True)
    product_id: UUID = Field(foreign_key="products.id", index=True)

    quantity: int = Field(default=1, nullable=False)

    selected_variant_label: Optional[str] = Field(default=None)
    selected_variant_value: Optional[str] = Field(default=None)

    unit_price: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    compare_price: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True),
    )

    product_name: str = Field(default="", nullable=False)
    product_image: Optional[str] = Field(default=None)
    product_slug: Optional[str] = Field(default=None)

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    customer_id: UUID = Field(foreign_key="users.id", index=True)
    shipping_address_id: Optional[UUID] = Field(default=None, foreign_key="user_addresses.id")
    items: list[dict[str, Any]] = Field(sa_column=Column(JSONB, nullable=False))
    shipping_address: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    pricing_snapshot: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    payment_method: Optional[str] = Field(default=None, max_length=30)
    payment_status: str = Field(default="pending", max_length=30, nullable=False)
    razorpay_order_id: Optional[str] = Field(default=None, index=True)
    razorpay_payment_id: Optional[str] = Field(default=None, index=True)
    razorpay_signature: Optional[str] = Field(default=None)
    platform_fee: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    tenant_share: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    status: str = Field(default="placed", nullable=False)
    cancel_reason: Optional[str] = Field(default=None)
    total: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    confirmed_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    shipped_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    delivered_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    return_window_closes_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    escrow_status: str = Field(default="held", max_length=30, nullable=False)
    escrow_unheld_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    cancelled_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class OrderItem(SQLModel, table=True):
    __tablename__ = "order_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    product_id: UUID = Field(foreign_key="products.id", index=True)

    product_name: str
    product_slug: Optional[str] = Field(default=None)
    product_image: Optional[str] = Field(default=None)

    selected_variant_label: Optional[str] = Field(default=None)
    selected_variant_value: Optional[str] = Field(default=None)

    unit_price: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    compare_price: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(12, 2), nullable=True),
    )
    quantity: int = Field(nullable=False)
    line_total: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    status: str = Field(default="placed", max_length=40, nullable=False)
    returnable_quantity: int = Field(default=0, nullable=False)
    pricing_snapshot: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class Shipment(SQLModel, table=True):
    __tablename__ = "shipments"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    status: str = Field(default="pending", max_length=40, nullable=False)
    delivery_partner_name: Optional[str] = Field(default=None, max_length=255)
    delivery_partner_phone: Optional[str] = Field(default=None, max_length=30)
    estimated_delivery_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    shipped_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    out_for_delivery_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    delivered_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class InventoryMovement(SQLModel, table=True):
    __tablename__ = "inventory_movements"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    product_id: UUID = Field(foreign_key="products.id", index=True)
    order_id: Optional[UUID] = Field(default=None, foreign_key="orders.id")
    order_item_id: Optional[UUID] = Field(default=None, foreign_key="order_items.id")
    movement_type: str = Field(max_length=40, nullable=False)
    quantity_delta: int = Field(nullable=False)
    note: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class OrderStatusHistory(SQLModel, table=True):
    __tablename__ = "order_status_history"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    status: str
    changed_by: Optional[UUID] = Field(default=None, index=True)
    changed_by_type: str = Field(default="admin", max_length=30, nullable=False)
    changed_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class ReturnRequest(SQLModel, table=True):
    __tablename__ = "return_requests"
    __table_args__ = (
        Index("ix_return_requests_site_status", "site_id", "status"),
        Index("ix_return_requests_customer_status", "customer_id", "status"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    customer_id: UUID = Field(foreign_key="users.id", index=True)

    status: str = Field(default="requested", max_length=40, nullable=False)
    refund_status: str = Field(default="pending", max_length=40, nullable=False)

    request_note: Optional[str] = Field(default=None)
    admin_note: Optional[str] = Field(default=None)
    rejection_reason: Optional[str] = Field(default=None)
    refund_override_reason: Optional[str] = Field(default=None)

    suggested_refund_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    final_refund_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False),
    )

    refund_method: Optional[str] = Field(default=None, max_length=40)
    customer_refund_account: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )

    approved_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    rejected_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    received_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    inspected_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    refunded_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    closed_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class ReturnItem(SQLModel, table=True):
    __tablename__ = "return_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    return_request_id: UUID = Field(foreign_key="return_requests.id", index=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    order_item_id: UUID = Field(foreign_key="order_items.id", index=True)
    product_id: UUID = Field(foreign_key="products.id", index=True)

    product_name: str
    product_slug: Optional[str] = Field(default=None)
    product_image: Optional[str] = Field(default=None)

    selected_variant_label: Optional[str] = Field(default=None)
    selected_variant_value: Optional[str] = Field(default=None)

    quantity_requested: int = Field(nullable=False)
    quantity_approved: int = Field(default=0, nullable=False)
    quantity_received: int = Field(default=0, nullable=False)

    reason_code: str = Field(max_length=60, nullable=False)
    reason_note: Optional[str] = Field(default=None)

    unit_price_paid: Decimal = Field(
        sa_column=Column(Numeric(12, 2), nullable=False)
    )
    line_refund_suggested: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False),
    )
    line_refund_final: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False),
    )

    restock_decision: Optional[str] = Field(default=None, max_length=30)
    restocked_quantity: int = Field(default=0, nullable=False)

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class ReturnStatusHistory(SQLModel, table=True):
    __tablename__ = "return_status_history"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    return_request_id: UUID = Field(foreign_key="return_requests.id", index=True)
    status: str = Field(max_length=40, nullable=False)
    changed_by: Optional[UUID] = Field(default=None, index=True)
    changed_by_type: str = Field(default="admin", max_length=30, nullable=False)
    note: Optional[str] = Field(default=None)
    changed_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class SiteDefinitionHistory(SQLModel, table=True):
    __tablename__ = "site_definition_history"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    site_definition: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    saved_by: UUID = Field(foreign_key="admins.id", index=True)
    saved_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class TenantBankAccount(SQLModel, table=True):
    __tablename__ = "tenant_bank_accounts"
    __table_args__ = (
        Index("ix_tenant_bank_accounts_admin_id", "admin_id"),
        Index("ix_tenant_bank_accounts_site_id", "site_id"),
        Index("ix_tenant_bank_accounts_razorpay_account_id", "razorpay_account_id"),
        UniqueConstraint("site_id", name="uq_tenant_bank_accounts_site"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    admin_id: UUID = Field(foreign_key="admins.id", nullable=False)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)

    account_holder_name: str = Field(max_length=255, nullable=False)
    account_number_encrypted: str = Field(sa_column=Column(String, nullable=False))
    account_number_last4: str = Field(max_length=4, nullable=False)
    ifsc_code: str = Field(max_length=15, nullable=False)
    bank_name: str = Field(max_length=150, nullable=False)
    pan_number: Optional[str] = Field(default=None, max_length=10)
    gst_number: Optional[str] = Field(default=None, max_length=20)

    # Razorpay Route Linked Account Integration
    razorpay_account_id: Optional[str] = Field(default=None, max_length=64, nullable=True)
    route_status: str = Field(default="pending", max_length=30, nullable=False)
    route_onboarded_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

    is_verified: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class TenantLedgerEntry(SQLModel, table=True):
    __tablename__ = "tenant_ledger_entries"
    __table_args__ = (
        Index("ix_tenant_ledger_entries_admin_id", "admin_id"),
        Index("ix_tenant_ledger_entries_site_id", "site_id"),
        Index("ix_tenant_ledger_entries_order_id", "order_id", unique=True),
        Index("ix_tenant_ledger_entries_razorpay_transfer_id", "razorpay_transfer_id"),
        Index("ix_tenant_ledger_entries_status", "status"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    admin_id: UUID = Field(foreign_key="admins.id", nullable=False)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)
    order_id: UUID = Field(foreign_key="orders.id", nullable=False)

    gross_amount: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    platform_fee_percent: Decimal = Field(
        default=Decimal("3.00"),
        sa_column=Column(Numeric(5, 2), nullable=False),
    )
    platform_fee: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    tenant_share: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    currency: str = Field(default="INR", max_length=10, nullable=False)

    # status: pending_payout, paid, refunded, held
    status: str = Field(default="pending_payout", max_length=40, nullable=False)
    payout_id: Optional[UUID] = Field(default=None, foreign_key="payouts.id", nullable=True)

    # Razorpay Route Automated Split Transfer tracking
    razorpay_transfer_id: Optional[str] = Field(default=None, max_length=64, nullable=True)
    transfer_status: Optional[str] = Field(default="pending", max_length=30, nullable=True)
    escrow_status: str = Field(default="held", max_length=30, nullable=False)
    escrow_release_due_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    unheld_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    settled_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            onupdate=utc_now,
        ),
    )


class Payout(SQLModel, table=True):
    __tablename__ = "payouts"
    __table_args__ = (
        Index("ix_payouts_admin_id", "admin_id"),
        Index("ix_payouts_site_id", "site_id"),
        Index("ix_payouts_status", "status"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    admin_id: UUID = Field(foreign_key="admins.id", nullable=False)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)

    amount: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    currency: str = Field(default="INR", max_length=10, nullable=False)
    status: str = Field(default="processed", max_length=40, nullable=False)
    payout_method: str = Field(default="manual_bank_transfer", max_length=40)
    utr_reference: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None)

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )