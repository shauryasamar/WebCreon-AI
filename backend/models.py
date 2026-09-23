from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Role(SQLModel, table=True):
    __tablename__ = "roles"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True, unique=True, nullable=False)
    description: Optional[str] = Field(default=None, nullable=True)
    is_system: bool = Field(default=False, nullable=False)
    permissions: list[str] = Field(
        default=[],
        sa_column=Column(JSONB, nullable=False, default=[]),
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


class Admin(SQLModel, table=True):
    __tablename__ = "admins"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: Optional[str] = Field(default=None)
    gender: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    role: str = Field(default="super_admin")
    role_id: Optional[UUID] = Field(default=None, foreign_key="roles.id", nullable=True)
    additional_permissions: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    website_access_type: str = Field(default="all")  # "all" | "specific"
    status: str = Field(default="active")  # "active" | "inactive" | "pending"
    invitation_token: Optional[str] = Field(default=None, nullable=True, index=True)
    invitation_expires_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    invited_by_admin_id: Optional[UUID] = Field(default=None, foreign_key="admins.id", nullable=True)
    auth_provider: str = Field(default="email")
    google_id: Optional[str] = Field(default=None)
    is_verified: bool = Field(default=True)
    is_active: bool = Field(default=True)
    timezone: str = Field(default="Asia/Kolkata")
    reset_token: Optional[str] = Field(default=None)
    reset_token_expires_at: Optional[datetime] = Field(default=None)
    last_login_at: Optional[datetime] = Field(default=None)
    last_login_ip: Optional[str] = Field(default=None)
    password_hash: Optional[str] = Field(default=None)
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
    default_return_window_days: int = Field(
        default=7,
        sa_column=Column(Integer, nullable=False, default=7),
    )
    default_hsn_code: Optional[str] = Field(
        default=None,
        sa_column=Column(String(50), nullable=True),
    )
    default_tax_rate: Optional[float] = Field(
        default=None,
        sa_column=Column(Float, nullable=True),
    )
    is_online: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True, index=True),
    )
    version: int = Field(default=1, nullable=False)
    @property
    def name(self) -> str:
        if self.site_definition and isinstance(self.site_definition, dict):
            return self.site_definition.get("site_name") or self.site_definition.get("name") or self.slug
        return self.slug

    @property
    def is_published(self) -> bool:
        if self.site_definition and isinstance(self.site_definition, dict):
            return bool(self.site_definition.get("pages") is not None)
        return False

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
    gender: Optional[str] = Field(default=None, nullable=True)
    date_of_birth: Optional[str] = Field(default=None, nullable=True)
    password_hash: Optional[str] = Field(default=None, nullable=True)
    auth_provider: str = Field(default="local", nullable=False)
    google_id: Optional[str] = Field(default=None, nullable=True)
    avatar_url: Optional[str] = Field(default=None, nullable=True)
    reset_token: Optional[str] = Field(default=None, nullable=True)
    reset_token_expires_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

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

    # Geo-location (pinned or geocoded)
    latitude: Optional[float] = Field(default=None, nullable=True)
    longitude: Optional[float] = Field(default=None, nullable=True)
    geo_accuracy: Optional[str] = Field(default=None, max_length=30, nullable=True)  # 'pinned' | 'geocoded'


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
    is_badge: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    badge_color: Optional[str] = Field(default=None, max_length=50, nullable=True)
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


class TaxMaster(SQLModel, table=True):
    """Configuration-driven HSN/SAC master with statutory GST rates and effective dates."""
    __tablename__ = "tax_masters"
    __table_args__ = (
        Index("ix_tax_masters_code", "code", unique=True),
        Index("ix_tax_masters_type", "code_type"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(max_length=20, nullable=False, unique=True)  # e.g., '61091000', '998313'
    code_type: str = Field(default="HSN", max_length=10)  # 'HSN' (Goods) or 'SAC' (Services)
    description: str = Field(max_length=500, nullable=False)

    # Standard statutory tax rates (percentages)
    gst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    cgst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    sgst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    igst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    cess_rate: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(5, 2), nullable=False))

    is_nil_rated: bool = Field(default=False, nullable=False)
    is_exempt: bool = Field(default=False, nullable=False)
    is_non_gst: bool = Field(default=False, nullable=False)

    effective_from: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    effective_to: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    ca_approval_status: str = Field(default="APPROVED", max_length=30)
    version: int = Field(default=1, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


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
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )
    draft_reason: Optional[str] = Field(
        default=None,
        max_length=50,
        nullable=True,
        index=True,
    )
    drafted_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    sku: Optional[str] = Field(default=None, max_length=100, nullable=True, index=True)
    hsn_code: Optional[str] = Field(default=None, max_length=50, nullable=True)
    hsn_sac_id: Optional[UUID] = Field(default=None, foreign_key="tax_masters.id", nullable=True)
    price_inclusive_of_gst: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    tax_rate_override: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(5, 2), nullable=True))
    tax_review_required: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    video_url: Optional[str] = Field(default=None, nullable=True)
    video_position: Optional[int] = Field(
        default=2,
        sa_column=Column(Integer, nullable=True, default=2),
    )
    sibling_group: Optional[str] = Field(default=None, max_length=100, nullable=True, index=True)
    sibling_label: Optional[str] = Field(default=None, max_length=100, nullable=True)
    weight_grams: int = Field(default=500, nullable=False)  # used for shipping label weight
    length_cm: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(8, 2), nullable=True),
    )
    width_cm: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(8, 2), nullable=True),
    )
    height_cm: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(8, 2), nullable=True),
    )
    return_window_days: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
    )

    images: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False),
    )
    highlights: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False),
    )
    variant_option: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    is_preorder: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    preorder_release_date: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    preorder_message: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
    )
    preorder_limit: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
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

    is_preorder: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    preorder_release_date: Optional[datetime] = Field(
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
    coupon_code: Optional[str] = Field(default=None, max_length=50, nullable=True)
    discount_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(12, 2), nullable=False, default=Decimal("0.00")),
    )
    contains_preorder: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    preorder_release_date: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    preorder_released: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    preorder_released_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
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
    delivery_otp: Optional[str] = Field(default=None, max_length=10, nullable=True)
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
    product_id: Optional[UUID] = Field(default=None, foreign_key="products.id", index=True, nullable=True)

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
    is_preorder: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    preorder_release_date: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    returnable_quantity: int = Field(default=0, nullable=False)
    return_window_days: int = Field(
        default=7,
        sa_column=Column(Integer, nullable=False, default=7),
    )
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


class Coupon(SQLModel, table=True):
    __tablename__ = "coupons"
    __table_args__ = (
        UniqueConstraint("site_id", "code", name="uq_site_coupons_code"),
        Index("ix_coupons_site_id_code", "site_id", "code"),
        Index("ix_coupons_site_id_is_active", "site_id", "is_active"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)

    code: str = Field(max_length=50, nullable=False)
    description: Optional[str] = Field(default="", nullable=True)

    discount_type: str = Field(default="percentage", max_length=30, nullable=False)
    discount_value: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False),
    )
    max_discount_amount: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(10, 2), nullable=True),
    )

    applies_to: str = Field(
        default="all",
        sa_column=Column(String(30), nullable=False, default="all"),
    )
    collection_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, default=list),
    )
    category_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, default=list),
    )

    min_order_value: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False, default=Decimal("0.00")),
    )
    is_first_order_only: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )

    total_usage_limit: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
    )
    times_used: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, default=0),
    )
    per_customer_limit: int = Field(
        default=1,
        sa_column=Column(Integer, nullable=False, default=1),
    )

    starts_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    expires_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )
    is_public: bool = Field(
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


class CouponUsage(SQLModel, table=True):
    __tablename__ = "coupon_usages"
    __table_args__ = (
        Index("ix_coupon_usages_site_id_coupon_id", "site_id", "coupon_id"),
        Index("ix_coupon_usages_customer_email", "site_id", "customer_email"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)
    coupon_id: UUID = Field(foreign_key="coupons.id", index=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    user_id: Optional[UUID] = Field(default=None, foreign_key="users.id", nullable=True)

    customer_email: str = Field(max_length=255, nullable=False)
    discount_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(10, 2), nullable=False),
    )
    used_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class Shipment(SQLModel, table=True):
    __tablename__ = "shipments"
    __table_args__ = (
        Index("ix_shipments_order_id", "order_id"),
        Index("ix_shipments_site_id", "site_id"),
        Index("ix_shipments_status", "status"),
        Index("ix_shipments_delivery_mode", "delivery_mode"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)

    # Delivery mode: own_agent | shiprocket | manual
    delivery_mode: str = Field(default="manual", max_length=30, nullable=False)

    # Unified status across all modes
    # pending | assigned | accepted | picked_up | in_transit | out_for_delivery | delivered | failed | rto
    status: str = Field(default="pending", max_length=40, nullable=False)

    @property
    def mode(self) -> str:
        return self.delivery_mode

    @mode.setter
    def mode(self, value: str):
        self.delivery_mode = value

    # Own-agent fields
    agent_id: Optional[UUID] = Field(default=None, foreign_key="delivery_agents.id", nullable=True)
    agent_token: Optional[str] = Field(default=None, max_length=128, nullable=True)  # signed one-time URL token
    agent_accepted_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    agent_picked_up_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

    # Courier fields (Shiprocket / Delhivery / BlueDart)
    courier_name: Optional[str] = Field(default=None, max_length=100, nullable=True)
    courier_order_id: Optional[str] = Field(default=None, max_length=100, nullable=True)
    awb_number: Optional[str] = Field(default=None, max_length=100, nullable=True)
    label_url: Optional[str] = Field(default=None, nullable=True)
    tracking_url: Optional[str] = Field(default=None, nullable=True)

    # Legacy / manual fields (kept for backwards compat)
    delivery_partner_name: Optional[str] = Field(default=None, max_length=255)
    delivery_partner_phone: Optional[str] = Field(default=None, max_length=30)

    # Shared
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
    proof_of_delivery_url: Optional[str] = Field(default=None, nullable=True)
    delivery_otp: Optional[str] = Field(default=None, max_length=10, nullable=True)
    notes: Optional[str] = Field(default=None)

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


class DeliveryAgent(SQLModel, table=True):
    """An own delivery agent registered by a tenant (admin)."""
    __tablename__ = "delivery_agents"
    __table_args__ = (
        Index("ix_delivery_agents_site_id", "site_id"),
        Index("ix_delivery_agents_site_active", "site_id", "is_active"),
        Index("ix_delivery_agents_site_phone", "site_id", "phone"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)

    name: str = Field(max_length=255, nullable=False)
    phone: str = Field(max_length=30, nullable=False)  # WhatsApp / SMS number
    password_hash: Optional[str] = Field(default=None, max_length=255, nullable=True)
    vehicle_type: str = Field(default="bike", max_length=50, nullable=False)
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )
    current_order_count: int = Field(default=0, nullable=False)  # live load metric
    total_deliveries: int = Field(default=0, nullable=False)
    cash_in_hand: float = Field(default=0.0, nullable=False)
    last_active_at: Optional[datetime] = Field(
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


class DeliverySettings(SQLModel, table=True):
    """Per-tenant delivery configuration: mode, courier credentials, pickup address."""
    __tablename__ = "delivery_settings"

    site_id: UUID = Field(foreign_key="sites.id", primary_key=True)

    # Mode: own_agent | shiprocket | hybrid | manual
    delivery_mode: str = Field(default="manual", max_length=30, nullable=False)

    # Independent delivery channel toggles
    enable_fleet: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )
    enable_shiprocket: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    enable_manual: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )

    # Cash on Delivery (COD) controls
    enable_cod: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )
    max_cod_amount: float = Field(
        default=5000.0,
        sa_column=Column(Float, nullable=False, default=5000.0),
    )

    # Hybrid mode: orders within this radius use own agents, outside go to courier
    own_delivery_radius_km: float = Field(default=10.0, nullable=False)

    # Open pickup toggle: whether own delivery fleet riders can self-claim unassigned orders from the store pool
    allow_open_pickup: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )

    # Shiprocket credentials (password stored encrypted)
    shiprocket_email: Optional[str] = Field(default=None, max_length=255, nullable=True)
    shiprocket_password_encrypted: Optional[str] = Field(default=None, nullable=True)
    shiprocket_token: Optional[str] = Field(default=None, nullable=True)
    shiprocket_token_expires_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

    # Courier preferences
    default_courier_preference: Optional[str] = Field(default=None, max_length=60, nullable=True)
    auto_assign_courier: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )

    # Sender / pickup address (for shipping labels)
    sender_name: Optional[str] = Field(default=None, max_length=255, nullable=True)
    sender_phone: Optional[str] = Field(default=None, max_length=30, nullable=True)
    sender_address: Optional[str] = Field(default=None, nullable=True)
    sender_pincode: Optional[str] = Field(default=None, max_length=10, nullable=True)
    sender_city: Optional[str] = Field(default=None, max_length=100, nullable=True)
    sender_state: Optional[str] = Field(default=None, max_length=100, nullable=True)

    # Default product weight fallback (grams) when product.weight_grams is 0
    default_weight_grams: int = Field(default=500, nullable=False)

    # Store / sender geo-location (for accurate delivery radius calculations)
    sender_latitude: Optional[float] = Field(default=None, nullable=True)
    sender_longitude: Optional[float] = Field(default=None, nullable=True)

    # Optional Shiprocket courier max delivery distance in KM (None or 0 = nationwide unlimited)
    shiprocket_delivery_radius_km: Optional[float] = Field(default=None, nullable=True)

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
    product_id: Optional[UUID] = Field(default=None, foreign_key="products.id", index=True, nullable=True)
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
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
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
    pickup_status: Optional[str] = Field(default=None, max_length=40)
    pickup_details: Optional[dict[str, Any]] = Field(
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
    product_id: Optional[UUID] = Field(default=None, foreign_key="products.id", index=True, nullable=True)

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

    # Cooldown quarantine on credential edits (24h payout hold)
    bank_details_updated_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    quarantine_until: Optional[datetime] = Field(
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


class TenantLedgerEntry(SQLModel, table=True):
    __tablename__ = "tenant_ledger_entries"
    __table_args__ = (
        Index("ix_tenant_ledger_entries_admin_id", "admin_id"),
        Index("ix_tenant_ledger_entries_site_id", "site_id"),
        Index("ix_tenant_ledger_entries_order_id", "order_id"),
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

    # Multi-component statutory breakdown
    entry_type: str = Field(default="order_sale", max_length=40, nullable=False)
    return_request_id: Optional[UUID] = Field(default=None, foreign_key="return_requests.id", nullable=True)
    gross_order_value: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))
    taxable_product_value: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))
    product_cgst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    product_sgst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    product_igst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    product_cess: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    platform_commission_base: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))
    platform_fee_gst_cgst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    platform_fee_gst_sgst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    platform_fee_gst_igst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    total_platform_fee_with_gst: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))
    gst_tcs_cgst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    gst_tcs_sgst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    gst_tcs_igst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    total_gst_tcs: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    tds_rate_applied: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(5, 2), nullable=True, default=Decimal("0.00")))
    income_tax_tds_194o: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    gateway_fee: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    gateway_fee_gst: Optional[Decimal] = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=True, default=Decimal("0.00")))
    net_merchant_payout: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))

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


class SupportAgent(SQLModel, table=True):
    __tablename__ = "support_agents"
    __table_args__ = (
        UniqueConstraint("site_id", "email", name="uq_support_agents_site_email"),
        Index("ix_support_agents_site_active", "site_id", "is_active"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)

    name: str = Field(max_length=255, nullable=False)
    email: str = Field(max_length=255, nullable=False)
    phone: Optional[str] = Field(default=None, max_length=30, nullable=True)
    password_hash: str = Field(max_length=255, nullable=False)
    role: str = Field(default="agent", max_length=50, nullable=False)
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    assigned_ticket_count: int = Field(default=0, nullable=False)
    total_resolved_count: int = Field(default=0, nullable=False)

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


class SupportTicket(SQLModel, table=True):
    __tablename__ = "support_tickets"
    __table_args__ = (
        Index("ix_support_tickets_status", "status"),
        Index("ix_support_tickets_assigned_agent", "assigned_agent_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    ticket_number: str = Field(max_length=40, nullable=False, index=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    customer_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)
    order_id: Optional[UUID] = Field(default=None, foreign_key="orders.id", index=True, nullable=True)
    assigned_agent_id: Optional[UUID] = Field(default=None, foreign_key="support_agents.id", nullable=True)

    category: str = Field(default="other", max_length=50, nullable=False)
    priority: str = Field(default="medium", max_length=30, nullable=False)
    status: str = Field(default="open", max_length=40, nullable=False)

    subject: str = Field(max_length=255, nullable=False)
    order_items_summary: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    customer_refund_account: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSONB, nullable=True))

    resolution_type: Optional[str] = Field(default=None, max_length=50, nullable=True)
    resolution_note: Optional[str] = Field(default=None, nullable=True)
    refund_amount: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))

    resolved_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    closed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
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


class SupportTicketMessage(SQLModel, table=True):
    __tablename__ = "support_ticket_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    ticket_id: UUID = Field(foreign_key="support_tickets.id", index=True, nullable=False)


    sender_type: str = Field(max_length=30, nullable=False)
    sender_id: Optional[UUID] = Field(default=None, nullable=True)
    sender_name: str = Field(max_length=255, nullable=False)

    message: str = Field(nullable=False)
    attachments: Optional[list[str]] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    is_internal_note: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))

    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    read_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class StorePage(SQLModel, table=True):
    __tablename__ = "store_pages"
    __table_args__ = (
        UniqueConstraint("site_id", "slug", name="uq_store_pages_site_slug"),
        Index("ix_store_pages_site_slug", "site_id", "slug"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)

    title: str = Field(max_length=255, nullable=False)
    slug: str = Field(max_length=255, index=True, nullable=False)
    subtitle: Optional[str] = Field(default=None, max_length=500, nullable=True)
    content: str = Field(sa_column=Column(Text, nullable=False, default=""))
    page_type: str = Field(default="custom", max_length=50, nullable=False)  # "about", "contact", "policy", "terms", "story", "custom"

    is_published: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    is_default: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))

    # SEO metadata
    meta_title: Optional[str] = Field(default=None, max_length=255, nullable=True)
    meta_description: Optional[str] = Field(default=None, max_length=1000, nullable=True)

    # Contact details for contact/business pages
    contact_email: Optional[str] = Field(default=None, max_length=255, nullable=True)
    contact_phone: Optional[str] = Field(default=None, max_length=100, nullable=True)
    contact_address: Optional[str] = Field(default=None, max_length=500, nullable=True)
    contact_hours: Optional[str] = Field(default=None, max_length=255, nullable=True)

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


class SiteTrafficEvent(SQLModel, table=True):
    __tablename__ = "site_traffic_events"
    __table_args__ = (
        Index("ix_traffic_site_created", "site_id", "created_at"),
        Index("ix_traffic_site_session", "site_id", "session_hash"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    session_hash: str = Field(max_length=64, index=True, nullable=False)
    page_path: str = Field(default="/", max_length=500, nullable=False)
    referrer_source: str = Field(default="Direct", max_length=100, nullable=False)
    device_type: str = Field(default="Desktop", max_length=50, nullable=False)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), index=True, nullable=False),
    )


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_site_created", "site_id", "created_at"),
        Index("ix_audit_category_created", "category", "created_at"),
        Index("ix_audit_actor_created", "actor_email", "created_at"),
        Index("ix_audit_actor_type_created", "actor_type", "created_at"),
        Index("ix_audit_source_created", "source", "created_at"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: Optional[UUID] = Field(default=None, foreign_key="sites.id", nullable=True, index=True)
    admin_id: Optional[UUID] = Field(default=None, foreign_key="admins.id", nullable=True, index=True)
    actor_type: str = Field(default="USER", index=True)  # USER, OWNER, TEAM_MEMBER, RIDER, SHIPROCKET, PAYMENT_PROVIDER, SYSTEM, CRON_JOB, AI, etc.
    source: str = Field(default="web_app", index=True)  # web_app, rider_app, webhook_razorpay, webhook_shiprocket, background_worker, cron, ai_agent
    actor_email: Optional[str] = Field(default=None, index=True)
    actor_name: Optional[str] = Field(default=None)
    actor_role: Optional[str] = Field(default=None)
    action: str = Field(index=True)  # e.g. "order.status_changed", "product.price_changed", "rider.delivered"
    category: str = Field(default="general", index=True)
    description: str = Field(nullable=False)
    ip_address: Optional[str] = Field(default=None)
    user_agent: Optional[str] = Field(default=None)
    resource_type: Optional[str] = Field(default=None, index=True)
    resource_id: Optional[str] = Field(default=None, index=True)
    resource_name: Optional[str] = Field(default=None)
    summary: Optional[str] = Field(default=None)
    request_id: Optional[str] = Field(default=None)
    correlation_id: Optional[str] = Field(default=None, index=True)
    idempotency_key: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="success")  # "success" | "warning" | "failure" | "partial" | "reversed"
    details: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), index=True, nullable=False),
    )


class SiteDomain(SQLModel, table=True):
    __tablename__ = "site_domains"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)

    domain: str = Field(index=True, unique=True, nullable=False)
    is_primary: bool = Field(default=False, nullable=False)
    domain_type: str = Field(default="custom_subdomain", nullable=False)  # custom_subdomain | custom_www

    status: str = Field(default="dns_required", nullable=False)
    ssl_status: str = Field(default="ssl_pending", nullable=False)

    dns_record_type: str = Field(default="CNAME", nullable=False)
    dns_record_name: str = Field(nullable=False)
    dns_record_value: str = Field(nullable=False)

    verification_token: str = Field(nullable=False)
    last_verified_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=utc_now))


class DomainOperation(SQLModel, table=True):
    __tablename__ = "domain_operations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    domain_id: UUID = Field(foreign_key="site_domains.id", index=True, nullable=False)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)

    operation_type: str = Field(nullable=False)  # REGISTER_DOMAIN, REMOVE_DOMAIN, VERIFY_DNS, CHECK_SSL, PURGE_CACHE
    idempotency_key: str = Field(index=True, unique=True, nullable=False)
    status: str = Field(default="pending", nullable=False)  # pending, in_progress, completed, failed, uncertain
    attempt_count: int = Field(default=0, nullable=False)
    last_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    provider_reference: Optional[str] = Field(default=None, nullable=True)

    next_retry_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=utc_now))


class ProcessedProviderEvent(SQLModel, table=True):
    __tablename__ = "processed_provider_events"
    __table_args__ = (
        UniqueConstraint("provider", "event_id", name="uq_provider_event_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    provider: str = Field(nullable=False)
    event_id: str = Field(nullable=False)

    resource_id: Optional[str] = Field(default=None, nullable=True)
    payload_hash: str = Field(nullable=False)
    status: str = Field(default="processed", nullable=False)

    received_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    processed_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SiteSlugHistory(SQLModel, table=True):
    __tablename__ = "site_slug_history"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    old_slug: str = Field(index=True, unique=True, nullable=False)
    reserved_until: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class CustomerNotification(SQLModel, table=True):
    __tablename__ = "customer_notifications"
    __table_args__ = (
        Index("ix_cust_notif_site_customer_created", "site_id", "customer_id", "created_at"),
        Index("ix_cust_notif_site_customer_unread", "site_id", "customer_id", "is_read"),
        Index("ix_cust_notif_idempotency", "site_id", "idempotency_key", unique=True),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    customer_id: UUID = Field(foreign_key="users.id", index=True, nullable=False)

    event_type: str = Field(max_length=80, nullable=False, index=True)
    category: str = Field(max_length=40, nullable=False, index=True)  # order, payment, delivery, return, refund, support, account, system
    title: str = Field(max_length=255, nullable=False)
    message: str = Field(sa_column=Column(Text, nullable=False))

    is_read: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False, index=True))
    read_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))

    related_entity_type: Optional[str] = Field(default=None, max_length=50, nullable=True)  # order, return_request, support_ticket, user
    related_entity_id: Optional[str] = Field(default=None, max_length=100, nullable=True)
    action_url: Optional[str] = Field(default=None, max_length=500, nullable=True)

    metadata_: Optional[dict[str, Any]] = Field(default=None, sa_column=Column("metadata", JSONB, nullable=True))
    idempotency_key: str = Field(max_length=160, nullable=False)

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class StoreEmailSettings(SQLModel, table=True):
    __tablename__ = "store_email_settings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False, unique=True)

    sender_name: Optional[str] = Field(default=None, max_length=255, nullable=True)
    sender_email: Optional[str] = Field(default=None, max_length=255, nullable=True)
    reply_to_email: Optional[str] = Field(default=None, max_length=255, nullable=True)

    provider_type: str = Field(default="smtp", max_length=50, nullable=False)  # smtp | ses | sendgrid
    smtp_host: Optional[str] = Field(default=None, max_length=255, nullable=True)
    smtp_port: int = Field(default=587, nullable=False)
    smtp_user: Optional[str] = Field(default=None, max_length=255, nullable=True)
    smtp_password_encrypted: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    smtp_use_tls: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    smtp_use_ssl: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))

    verification_status: str = Field(default="not_configured", max_length=40, nullable=False)  # not_configured | pending_verification | verified | failed
    verification_token: Optional[str] = Field(default=None, max_length=128, nullable=True)
    verification_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    last_verified_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))

    is_enabled: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=utc_now))


class NotificationDeliveryLog(SQLModel, table=True):
    __tablename__ = "notification_delivery_logs"
    __table_args__ = (
        Index("ix_notif_log_site_created", "site_id", "created_at"),
        Index("ix_notif_log_site_status", "site_id", "status"),
        Index("ix_notif_log_idempotency", "site_id", "idempotency_key", unique=True),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    customer_id: Optional[UUID] = Field(default=None, foreign_key="users.id", nullable=True)

    channel: str = Field(max_length=30, nullable=False)  # in_app | email
    recipient: str = Field(max_length=255, nullable=False)
    event_type: str = Field(max_length=80, nullable=False)
    subject: Optional[str] = Field(default=None, max_length=255, nullable=True)

    status: str = Field(default="queued", max_length=30, nullable=False)  # queued | processing | sent | delivered | failed | dead_letter
    attempts: int = Field(default=0, nullable=False)
    max_attempts: int = Field(default=3, nullable=False)
    last_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    locked_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    idempotency_key: str = Field(max_length=160, nullable=False)

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    sent_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class LegalEntityType(str, Enum):
    INDIVIDUAL = "individual"
    HUF = "huf"
    PROPRIETORSHIP = "proprietorship"
    PARTNERSHIP = "partnership"
    LLP = "llp"
    COMPANY = "company"
    PRIVATE_LIMITED = "private_limited"
    PUBLIC_LIMITED = "public_limited"
    TRUST_SOCIETY = "trust_society"


class GSTRegistrationType(str, Enum):
    REGULAR = "regular"
    COMPOSITION = "composition"
    UNREGISTERED = "unregistered"
    ENROLLED_ECO = "enrolled_eco"


class MerchantTaxProfile(SQLModel, table=True):
    __tablename__ = "merchant_tax_profiles"
    __table_args__ = (
        Index("ix_mtp_site_id", "site_id", unique=True),
        Index("ix_mtp_pan", "pan_number"),
        Index("ix_mtp_gstin", "gstin"),
        Index("ix_mtp_state", "state_code"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False, unique=True)
    admin_id: Optional[UUID] = Field(default=None, foreign_key="admins.id", nullable=True)

    legal_business_name: str = Field(max_length=255, nullable=False)
    trade_name: Optional[str] = Field(default=None, max_length=255)
    entity_type: LegalEntityType = Field(default=LegalEntityType.PROPRIETORSHIP, nullable=False)
    registration_type: GSTRegistrationType = Field(default=GSTRegistrationType.REGULAR, nullable=False)

    pan_number: str = Field(max_length=10, nullable=False)
    pan_holder_name: Optional[str] = Field(default=None, max_length=255)
    is_pan_verified: bool = Field(default=False, nullable=False)
    pan_verified_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    pan_verification_source: Optional[str] = Field(default=None, max_length=50)

    gstin: Optional[str] = Field(default=None, max_length=15, nullable=True)
    enrolment_id: Optional[str] = Field(default=None, max_length=20, nullable=True)
    is_gstin_verified: bool = Field(default=False, nullable=False)
    gstin_verified_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))

    state_code: str = Field(max_length=2, nullable=False)
    state_name: Optional[str] = Field(default=None, max_length=100)
    address_line1: Optional[str] = Field(default=None, max_length=255)
    address_line2: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=10)

    is_composition_dealer: bool = Field(default=False, nullable=False)
    allow_interstate_sales: bool = Field(default=True, nullable=False)
    default_hsn_code: Optional[str] = Field(default=None, max_length=50, nullable=True)
    default_tax_rate: Optional[float] = Field(default=None, nullable=True)

    current_fy: str = Field(default="2026-2027", max_length=10, nullable=False)
    fy_gross_sales_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    fy_tds_deducted_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=utc_now))


class TaxInvoice(SQLModel, table=True):
    __tablename__ = "tax_invoices"
    __table_args__ = (
        UniqueConstraint("site_id", "financial_year", "invoice_number", name="uq_tax_invoices_seq"),
        Index("ix_tax_invoices_order_id", "order_id", unique=True),
        Index("ix_tax_invoices_site_id", "site_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)
    order_id: UUID = Field(sa_column=Column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True))

    invoice_number: str = Field(max_length=50, nullable=False)
    financial_year: str = Field(max_length=10, nullable=False)
    invoice_date: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))

    supplier_legal_name: str = Field(max_length=255, nullable=False)
    supplier_trade_name: Optional[str] = Field(default=None, max_length=255)
    supplier_gstin: Optional[str] = Field(default=None, max_length=15)
    supplier_pan: str = Field(max_length=10, nullable=False)
    supplier_address: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    supplier_state_code: str = Field(max_length=2, nullable=False)

    recipient_name: str = Field(max_length=255, nullable=False)
    recipient_address: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    recipient_state_code: str = Field(max_length=2, nullable=False)
    place_of_supply_state_code: str = Field(max_length=2, nullable=False)

    eco_legal_name: str = Field(default="WebCreon Technologies Private Limited")
    eco_gstin: str = Field(default="27AAACW1234F1Z1")

    taxable_value: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    cgst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    sgst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    igst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    cess_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    total_tax_amount: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    total_invoice_value: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))

    items_snapshot: list[dict[str, Any]] = Field(sa_column=Column(JSONB, nullable=False))
    pdf_storage_path: Optional[str] = Field(default=None, max_length=500)
    qr_code_data: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_cancelled: bool = Field(default=False, nullable=False)

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class TaxCreditNote(SQLModel, table=True):
    __tablename__ = "tax_credit_notes"
    __table_args__ = (
        UniqueConstraint("site_id", "financial_year", "credit_note_number", name="uq_tax_credit_notes_seq"),
        Index("ix_tax_credit_notes_orig_inv", "original_invoice_id"),
        Index("ix_tax_credit_notes_return_id", "return_request_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)
    original_invoice_id: UUID = Field(sa_column=Column(ForeignKey("tax_invoices.id", ondelete="CASCADE"), nullable=False))
    return_request_id: Optional[UUID] = Field(default=None, foreign_key="return_requests.id", nullable=True)

    credit_note_number: str = Field(max_length=50, nullable=False)
    financial_year: str = Field(max_length=10, nullable=False)
    credit_note_date: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    reason_for_issuance: str = Field(default="Goods Returned", max_length=100)

    taxable_value: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    cgst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    sgst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    igst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    total_credit_value: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))

    items_snapshot: list[dict[str, Any]] = Field(sa_column=Column(JSONB, nullable=False))
    pdf_storage_path: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class PlatformTaxInvoice(SQLModel, table=True):
    __tablename__ = "platform_tax_invoices"
    __table_args__ = (
        UniqueConstraint("site_id", "billing_month", name="uq_platform_tax_invoices_month"),
        Index("ix_platform_invoices_site_month", "site_id", "billing_month"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False)
    billing_month: str = Field(max_length=7, nullable=False)  # YYYY-MM
    invoice_number: str = Field(max_length=50, nullable=False, unique=True)
    financial_year: str = Field(max_length=10, nullable=False)
    invoice_date: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))

    sac_code: str = Field(default="998313", max_length=10)
    platform_gstin: str = Field(default="27AAACW1234F1Z1", max_length=15)
    platform_state_code: str = Field(default="27", max_length=2)

    merchant_gstin: Optional[str] = Field(default=None, max_length=15)
    merchant_state_code: str = Field(max_length=2, nullable=False)
    is_b2b: bool = Field(default=True, nullable=False)

    total_order_gmv: Decimal = Field(sa_column=Column(Numeric(14, 2), nullable=False))
    commission_taxable_base: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    subscription_fees: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))

    gst_rate: Decimal = Field(default=Decimal("18.00"), sa_column=Column(Numeric(5, 2), nullable=False))
    cgst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    sgst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    igst_amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False))
    total_invoice_value: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))

    pdf_storage_path: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class InvoiceSequence(SQLModel, table=True):
    __tablename__ = "invoice_sequences"

    site_id: UUID = Field(primary_key=True)
    financial_year: str = Field(max_length=10, primary_key=True)
    document_type: str = Field(max_length=20, primary_key=True)  # 'INVOICE', 'CREDIT_NOTE', 'PLATFORM_FEE'
    current_value: int = Field(default=0, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=utc_now))


# ===========================================================================
# SUBSCRIPTION & BILLING HARDENED MODELS (STRICT 30-DAY CYCLES, UTC)
# ===========================================================================

class SubscriptionPlan(str, Enum):
    FREE = "FREE"
    STARTER = "STARTER"
    PRO = "PRO"


class SubscriptionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    GRACE_PERIOD = "GRACE_PERIOD"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class AICreditBatchStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED_LAPSED = "EXPIRED_LAPSED"
    EXPIRED_FULLY_USED = "EXPIRED_FULLY_USED"
    RENEWED = "RENEWED"


class AICreditBatchType(str, Enum):
    FREE_BASE = "FREE_BASE"
    PAID_STARTER = "PAID_STARTER"
    PAID_PRO = "PAID_PRO"


class ProductDraftReason(str, Enum):
    MERCHANT_MANUAL = "MERCHANT_MANUAL"
    SYSTEM_LIMIT_EXCEEDED = "SYSTEM_LIMIT_EXCEEDED"


class WebsiteSubscription(SQLModel, table=True):
    __tablename__ = "website_subscriptions"
    __table_args__ = (
        UniqueConstraint("website_id", name="uq_website_subscriptions_website_id"),
        Index("ix_website_subscriptions_admin_plan", "admin_id", "plan", "status"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    website_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    admin_id: UUID = Field(foreign_key="admins.id", index=True, nullable=False)
    plan: str = Field(default="FREE", nullable=False)
    status: str = Field(default="ACTIVE", nullable=False)

    billing_cycle_start_date: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    billing_cycle_end_date: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    grace_period_started_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    grace_period_ends_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    is_auto_renew: bool = Field(default=True, nullable=False)

    # Monotonic provider state tracking
    provider_name: str = Field(default="razorpay", nullable=False)
    provider_customer_id: Optional[str] = Field(default=None, nullable=True)
    provider_subscription_id: Optional[str] = Field(default=None, index=True, nullable=True)
    provider_plan_id: Optional[str] = Field(default=None, nullable=True)
    provider_payment_method_id: Optional[str] = Field(default=None, nullable=True)
    current_provider_status: Optional[str] = Field(default=None, nullable=True)

    latest_provider_event_id: Optional[str] = Field(default=None, nullable=True)
    latest_provider_event_created_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    latest_provider_sequence: Optional[int] = Field(default=None, nullable=True)
    latest_provider_state_version: Optional[int] = Field(default=None, nullable=True)

    last_reconciled_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    last_reconciliation_status: Optional[str] = Field(default=None, nullable=True)

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=utc_now))


class AICreditBatch(SQLModel, table=True):
    __tablename__ = "ai_credit_batches"
    __table_args__ = (
        UniqueConstraint("admin_id", "batch_type", "cycle_start_at", name="uq_ai_credit_batches_admin_type_cycle"),
        Index("ix_ai_credit_batches_fifo", "admin_id", "status", "expiry_date"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    admin_id: UUID = Field(foreign_key="admins.id", index=True, nullable=False)
    source_website_id: Optional[UUID] = Field(default=None, foreign_key="sites.id", index=True, nullable=True)
    batch_type: str = Field(default="FREE_BASE", nullable=False)  # FREE_BASE, PAID_STARTER, PAID_PRO
    cycle_start_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

    allocated_amount: int = Field(default=0, nullable=False)
    remaining_amount: int = Field(default=0, nullable=False)
    expiry_date: datetime = Field(sa_column=Column(DateTime(timezone=True), index=True, nullable=False))
    status: str = Field(default="ACTIVE", nullable=False)  # ACTIVE, EXPIRED_LAPSED, EXPIRED_FULLY_USED, RENEWED
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class BillingIdempotencyKey(SQLModel, table=True):
    __tablename__ = "billing_idempotency_keys"
    __table_args__ = (
        UniqueConstraint("operation_type", "idempotency_key", name="uq_billing_idempotency_type_key"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    admin_id: Optional[UUID] = Field(default=None, index=True, nullable=True)
    website_id: Optional[UUID] = Field(default=None, index=True, nullable=True)
    idempotency_key: str = Field(index=True, nullable=False)
    operation_type: str = Field(index=True, nullable=False)  # UPGRADE, DOWNGRADE, ACTIVATE_PRODUCT
    request_fingerprint: str = Field(nullable=False)
    response_status: Optional[int] = Field(default=None, nullable=True)
    response_body: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSONB, nullable=True))
    status: str = Field(default="STARTED", nullable=False)  # STARTED, SUCCEEDED, FAILED
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class ProcessedBillingWebhookEvent(SQLModel, table=True):
    __tablename__ = "processed_billing_webhook_events"
    __table_args__ = (
        UniqueConstraint("provider", "provider_event_id", name="uq_processed_webhook_provider_event_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    provider: str = Field(default="razorpay", nullable=False)
    provider_event_id: str = Field(index=True, nullable=False)
    event_type: str = Field(index=True, nullable=False)
    payload_hash: str = Field(nullable=False)
    raw_payload: dict[str, Any] = Field(default={}, sa_column=Column(JSONB, nullable=False))
    processing_status: str = Field(default="RECEIVED", index=True, nullable=False)  # RECEIVED, PROCESSING, PROCESSED, RETRYABLE_FAILURE, DEAD_LETTER, DUPLICATE, STALE
    provider_event_created_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    provider_sequence: Optional[int] = Field(default=None, nullable=True)
    error_message: Optional[str] = Field(default=None, nullable=True)
    last_error_code: Optional[str] = Field(default=None, nullable=True)
    retry_count: int = Field(default=0, nullable=False)
    max_retry_count: int = Field(default=5, nullable=False)
    next_retry_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    locked_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    locked_by: Optional[str] = Field(default=None, nullable=True)
    dead_lettered_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    resolved_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    resolved_by: Optional[str] = Field(default=None, nullable=True)
    received_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    processed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class WebsiteSubscriptionEvent(SQLModel, table=True):
    __tablename__ = "website_subscription_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    website_id: UUID = Field(index=True, nullable=False)
    admin_id: UUID = Field(index=True, nullable=False)
    event_type: str = Field(index=True, nullable=False)  # UPGRADE, DOWNGRADE, RENEWAL, GRACE_STARTED, GRACE_CANCELLED, EXPIRED, CANCELLED
    previous_plan: Optional[str] = Field(default=None, nullable=True)
    new_plan: Optional[str] = Field(default=None, nullable=True)
    previous_status: Optional[str] = Field(default=None, nullable=True)
    new_status: Optional[str] = Field(default=None, nullable=True)
    source: str = Field(default="USER", nullable=False)  # USER, PAYMENT_WEBHOOK, CRON, ADMIN, RECONCILIATION
    idempotency_key: Optional[str] = Field(default=None, index=True, nullable=True)
    metadata_json: dict[str, Any] = Field(default={}, sa_column=Column(JSONB, nullable=False))

    previous_event_hash: Optional[str] = Field(default=None, nullable=True)
    event_hash: str = Field(nullable=False)
    hash_algorithm: str = Field(default="sha256", nullable=False)
    chain_scope: str = Field(default="website_subscription", nullable=False)
    hash_version: int = Field(default=1, nullable=False)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class AICreditReservation(SQLModel, table=True):
    __tablename__ = "ai_credit_reservations"

    reservation_id: UUID = Field(default_factory=uuid4, primary_key=True)
    idempotency_key: str = Field(unique=True, index=True, nullable=False)
    admin_id: UUID = Field(index=True, nullable=False)
    website_id: Optional[UUID] = Field(default=None, index=True, nullable=True)
    feature_name: str = Field(nullable=False)
    estimated_credits: int = Field(nullable=False)
    reserved_credits: int = Field(nullable=False)
    committed_credits: int = Field(default=0, nullable=False)
    released_credits: int = Field(default=0, nullable=False)
    batch_allocation_details: list[dict[str, Any]] = Field(default=[], sa_column=Column(JSONB, nullable=False))

    provider_request_id: Optional[str] = Field(default=None, index=True, nullable=True)
    provider_model: Optional[str] = Field(default=None, nullable=True)
    input_tokens: Optional[int] = Field(default=None, nullable=True)
    output_tokens: Optional[int] = Field(default=None, nullable=True)
    total_tokens: Optional[int] = Field(default=None, nullable=True)
    usage_mode: str = Field(default="EXACT_TOKEN_METADATA", nullable=False)  # EXACT_TOKEN_METADATA, FALLBACK_ESTIMATE
    status: str = Field(default="RESERVED", index=True, nullable=False)  # RESERVED, COMMITTED, RELEASED, UNKNOWN, EXPIRED

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    committed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    released_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class AICreditUsageEvent(SQLModel, table=True):
    __tablename__ = "ai_credit_usage_events"
    __table_args__ = (
        UniqueConstraint("admin_id", "idempotency_key", name="uq_ai_credit_usage_admin_idemp"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    admin_id: UUID = Field(foreign_key="admins.id", index=True, nullable=False)
    website_id: Optional[UUID] = Field(default=None, foreign_key="sites.id", index=True, nullable=True)
    batch_id: Optional[UUID] = Field(default=None, foreign_key="ai_credit_batches.id", index=True, nullable=True)
    amount_deducted: int = Field(nullable=False)
    feature_used: str = Field(nullable=False)
    idempotency_key: str = Field(index=True, nullable=False)

    provider_request_id: Optional[str] = Field(default=None, nullable=True)
    provider_model: Optional[str] = Field(default=None, nullable=True)
    input_tokens: Optional[int] = Field(default=None, nullable=True)
    output_tokens: Optional[int] = Field(default=None, nullable=True)
    total_tokens: Optional[int] = Field(default=None, nullable=True)
    calculated_credit_amount: int = Field(default=0, nullable=False)
    event_status: str = Field(default="COMMITTED", nullable=False)  # RESERVED, COMMITTED, RELEASED, FAILED
    error_message: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SubscriptionPayment(SQLModel, table=True):
    __tablename__ = "subscription_payments"
    __table_args__ = (
        UniqueConstraint("provider", "provider_payment_id", name="uq_sub_payments_provider_payment_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    provider: str = Field(default="razorpay", nullable=False)
    provider_payment_id: str = Field(index=True, nullable=False)
    provider_order_id: Optional[str] = Field(default=None, nullable=True)
    provider_invoice_id: Optional[str] = Field(default=None, nullable=True)
    provider_subscription_id: Optional[str] = Field(default=None, index=True, nullable=True)
    website_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    admin_id: UUID = Field(foreign_key="admins.id", index=True, nullable=False)

    amount: int = Field(nullable=False)  # Amount in paisa
    currency: str = Field(default="INR", nullable=False)
    billing_period_start: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    billing_period_end: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    payment_status: str = Field(default="CAPTURED", nullable=False)  # CAPTURED, FAILED, REFUNDED

    provider_created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    received_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    raw_metadata: dict[str, Any] = Field(default={}, sa_column=Column(JSONB, nullable=False))


class GracePeriodReminderEvent(SQLModel, table=True):
    __tablename__ = "grace_period_reminder_events"
    __table_args__ = (
        UniqueConstraint("subscription_id", "reminder_day", name="uq_grace_reminder_sub_day"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    subscription_id: UUID = Field(foreign_key="website_subscriptions.id", index=True, nullable=False)
    reminder_day: int = Field(nullable=False)  # 1, 4, 7
    sent_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    channel: str = Field(default="IN_APP", nullable=False)


class BillingJobRun(SQLModel, table=True):
    __tablename__ = "billing_job_runs"
    __table_args__ = (
        UniqueConstraint("job_name", "execution_id", name="uq_billing_job_execution"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    job_name: str = Field(index=True, nullable=False)
    execution_id: str = Field(index=True, nullable=False)
    lock_key: str = Field(nullable=False)
    started_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    heartbeat: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    status: str = Field(default="RUNNING", nullable=False)  # RUNNING, COMPLETED, FAILED
    records_processed: int = Field(default=0, nullable=False)
    error_details: Optional[str] = Field(default=None, nullable=True)


class WebsiteTeamMember(SQLModel, table=True):
    __tablename__ = "website_team_members"
    __table_args__ = (
        UniqueConstraint("website_id", "user_id", name="uq_website_team_members_site_user"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    website_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    user_id: UUID = Field(foreign_key="admins.id", index=True, nullable=False)
    role: str = Field(default="STAFF", nullable=False)  # OWNER, MANAGER, STAFF
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=utc_now))


class SubscriptionInvoice(SQLModel, table=True):
    __tablename__ = "subscription_invoices"
    __table_args__ = (
        UniqueConstraint("invoice_number", name="uq_subscription_invoices_number"),
        Index("ix_subscription_invoices_website", "website_id", "created_at"),
        Index("ix_subscription_invoices_admin", "admin_id", "created_at"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    invoice_number: str = Field(index=True, nullable=False)
    website_id: UUID = Field(foreign_key="sites.id", index=True, nullable=False)
    admin_id: UUID = Field(foreign_key="admins.id", index=True, nullable=False)

    plan: str = Field(nullable=False)  # STARTER, PRO
    plan_name: str = Field(default="WebCreon Subscription", nullable=False)
    billing_interval: str = Field(default="monthly", nullable=False)  # monthly, 3months, yearly
    billing_cycle_start: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    billing_cycle_end: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

    # Statutory Tax Breakdown (SAC 998313 - SaaS / Cloud Software Service)
    sac_code: str = Field(default="998313", nullable=False)
    subtotal: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2, nullable=False)
    tax_rate: Decimal = Field(default=Decimal("18.00"), max_digits=5, decimal_places=2, nullable=False)
    cgst_amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2, nullable=False)
    sgst_amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2, nullable=False)
    igst_amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2, nullable=False)
    total_tax: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2, nullable=False)
    total_amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2, nullable=False)
    currency: str = Field(default="INR", nullable=False)

    # Payment & Transaction Audit
    payment_status: str = Field(default="PAID", nullable=False)  # PAID, FAILED, REFUNDED
    payment_method: str = Field(default="Net Banking", nullable=False)
    razorpay_payment_id: Optional[str] = Field(default=None, nullable=True)
    razorpay_order_id: Optional[str] = Field(default=None, nullable=True)

    # Seller Snapshot (Statutory Rule 46)
    seller_legal_name: str = Field(default="WebCreon Technologies Private Limited", nullable=False)
    seller_trade_name: str = Field(default="WebCreon", nullable=False)
    seller_gstin: str = Field(default="27AAACW1234F1Z1", nullable=False)
    seller_pan: str = Field(default="AAACW1234F", nullable=False)
    seller_cin: str = Field(default="U72900MH2026PTC123456", nullable=False)
    seller_address: dict[str, Any] = Field(default={}, sa_column=Column(JSONB, nullable=False))
    seller_state: str = Field(default="Maharashtra", nullable=False)
    seller_state_code: str = Field(default="27", nullable=False)

    # Buyer Snapshot
    buyer_name: str = Field(nullable=False)
    buyer_email: str = Field(nullable=False)
    buyer_business_name: Optional[str] = Field(default=None, nullable=True)
    buyer_gstin: Optional[str] = Field(default=None, nullable=True)
    buyer_state: str = Field(default="Maharashtra", nullable=False)
    buyer_state_code: str = Field(default="27", nullable=False)
    place_of_supply: str = Field(default="27-Maharashtra", nullable=False)

    # Invoice Metadata & Event Chaining
    invoice_date: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))



