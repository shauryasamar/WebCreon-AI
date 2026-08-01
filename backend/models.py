from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Admin(SQLModel, table=True):
    __tablename__ = "admins"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
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


class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", index=True)

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
    items: list[dict[str, Any]] = Field(sa_column=Column(JSONB, nullable=False))
    status: str = Field(default="placed", nullable=False)
    total: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
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


class OrderStatusHistory(SQLModel, table=True):
    __tablename__ = "order_status_history"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    status: str
    changed_by: UUID = Field(foreign_key="admins.id", index=True)
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