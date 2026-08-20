from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlmodel import Session, select

from auth_middleware import authenticate_customer
from db.database import get_session
from models import Cart, CartItem, Product, Site, User


router = APIRouter(
    prefix="/cart",
    tags=["cart"],
)


def decimal_to_float(value: Optional[Decimal]) -> Optional[float]:
    if value is None:
        return None
    return float(value)


def get_site_or_404(session: Session, site_id: UUID) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


def get_user_for_site_or_404(session: Session, site_id: UUID, user_id: UUID) -> User:
    user = session.get(User, user_id)
    if not user or user.site_id != site_id or user.is_guest:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_product_for_site_or_404(
    session: Session,
    site_id: UUID,
    product_id: UUID,
) -> Product:
    product = session.get(Product, product_id)
    if not product or product.site_id != site_id:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def get_or_create_cart(session: Session, site_id: UUID, user_id: UUID) -> Cart:
    cart = session.exec(
        select(Cart).where(Cart.site_id == site_id, Cart.user_id == user_id)
    ).first()

    if cart:
        return cart

    cart = Cart(site_id=site_id, user_id=user_id)
    session.add(cart)
    session.commit()
    session.refresh(cart)
    return cart


def get_cart_item_or_404(
    session: Session,
    cart_id: UUID,
    item_id: UUID,
) -> CartItem:
    item = session.get(CartItem, item_id)
    if not item or item.cart_id != cart_id:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return item


def serialize_cart_item(item: CartItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "selected_variant_label": item.selected_variant_label,
        "selected_variant_value": item.selected_variant_value,
        "unit_price": decimal_to_float(item.unit_price) or 0.0,
        "compare_price": decimal_to_float(item.compare_price),
        "product_name": item.product_name,
        "product_image": item.product_image,
        "product_slug": item.product_slug,
        "line_total": float(item.unit_price * item.quantity),
    }


def build_cart_response(cart: Cart, items: list[CartItem]) -> dict[str, Any]:
    subtotal = sum((item.unit_price * item.quantity for item in items), Decimal("0"))
    total_items = sum(item.quantity for item in items)

    return {
        "id": cart.id,
        "site_id": cart.site_id,
        "user_id": cart.user_id,
        "items": [serialize_cart_item(item) for item in items],
        "subtotal": float(subtotal),
        "total_items": total_items,
    }


def extract_variant_details(
    product: Product,
    selected_variant_value: Optional[str],
) -> tuple[Decimal, Optional[Decimal], Optional[str], Optional[int]]:
    variant_option = product.variant_option or {}
    option_name = variant_option.get("optionName")
    option_values = variant_option.get("optionValues") or []

    if not selected_variant_value:
        return product.price, product.compare_price, option_name, product.stock

    for option in option_values:
        if option.get("value") == selected_variant_value:
            price = (
                Decimal(str(option["price"]))
                if option.get("price") is not None
                else product.price
            )
            compare_price = (
                Decimal(str(option["comparePrice"]))
                if option.get("comparePrice") is not None
                else product.compare_price
            )
            stock_qty = option.get("stockQty")
            variant_stock_qty = int(stock_qty) if stock_qty is not None else product.stock
            option_in_stock = option.get("inStock")

            if option_in_stock is False or variant_stock_qty <= 0:
                raise HTTPException(status_code=400, detail="Selected variant is out of stock")

            return price, compare_price, option_name, variant_stock_qty

    raise HTTPException(status_code=400, detail="Invalid selected variant")


class AddCartItemRequest(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1)
    selected_variant_value: Optional[str] = None

    @field_validator("selected_variant_value")
    @classmethod
    def clean_variant_value(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(ge=1)


class CartItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    quantity: int
    selected_variant_label: Optional[str] = None
    selected_variant_value: Optional[str] = None
    unit_price: float
    compare_price: Optional[float] = None
    product_name: str
    product_image: Optional[str] = None
    product_slug: Optional[str] = None
    line_total: float


class CartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    site_id: UUID
    user_id: UUID
    items: list[CartItemResponse]
    subtotal: float
    total_items: int


@router.get("/{site_id}", response_model=CartResponse)
def get_cart(
    site_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    cart = get_or_create_cart(session, site_id, customer.id)

    items = session.exec(
        select(CartItem).where(CartItem.cart_id == cart.id)
    ).all()

    return build_cart_response(cart, items)


@router.post("/{site_id}/items", response_model=CartResponse)
def add_item_to_cart(
    site_id: UUID,
    payload: AddCartItemRequest,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    product = get_product_for_site_or_404(session, site_id, payload.product_id)

    if not product.in_stock or product.stock <= 0:
        raise HTTPException(status_code=400, detail="Product is out of stock")

    unit_price, compare_price, selected_variant_label, available_stock = extract_variant_details(
        product,
        payload.selected_variant_value,
    )

    cart = get_or_create_cart(session, site_id, customer.id)

    existing_item = session.exec(
        select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == payload.product_id,
            CartItem.selected_variant_value == payload.selected_variant_value,
        )
    ).first()

    next_quantity = payload.quantity
    if existing_item:
        next_quantity = existing_item.quantity + payload.quantity

    if next_quantity > available_stock:
        raise HTTPException(
            status_code=400,
            detail="Requested quantity exceeds available stock",
        )

    if existing_item:
        existing_item.quantity = next_quantity
        existing_item.unit_price = unit_price
        existing_item.compare_price = compare_price
        existing_item.product_name = product.name
        existing_item.product_image = (product.images or [None])[0]
        existing_item.product_slug = product.slug
        existing_item.selected_variant_label = selected_variant_label
        session.add(existing_item)
    else:
        item = CartItem(
            cart_id=cart.id,
            product_id=product.id,
            quantity=payload.quantity,
            selected_variant_label=selected_variant_label,
            selected_variant_value=payload.selected_variant_value,
            unit_price=unit_price,
            compare_price=compare_price,
            product_name=product.name,
            product_image=(product.images or [None])[0],
            product_slug=product.slug,
        )
        session.add(item)

    session.commit()
    session.refresh(cart)

    items = session.exec(
        select(CartItem).where(CartItem.cart_id == cart.id)
    ).all()

    return build_cart_response(cart, items)


@router.put("/{site_id}/items/{item_id}", response_model=CartResponse)
def update_cart_item(
    site_id: UUID,
    item_id: UUID,
    payload: UpdateCartItemRequest,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    cart = get_or_create_cart(session, site_id, customer.id)
    item = get_cart_item_or_404(session, cart.id, item_id)

    product = get_product_for_site_or_404(session, site_id, item.product_id)

    _, _, _, available_stock = extract_variant_details(
        product,
        item.selected_variant_value,
    )

    if payload.quantity > available_stock:
        raise HTTPException(
            status_code=400,
            detail="Requested quantity exceeds available stock",
        )

    item.quantity = payload.quantity
    session.add(item)
    session.commit()
    session.refresh(cart)

    items = session.exec(
        select(CartItem).where(CartItem.cart_id == cart.id)
    ).all()

    return build_cart_response(cart, items)


@router.delete("/{site_id}/items/{item_id}", response_model=CartResponse)
def remove_cart_item(
    site_id: UUID,
    item_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    cart = get_or_create_cart(session, site_id, customer.id)
    item = get_cart_item_or_404(session, cart.id, item_id)

    session.delete(item)
    session.commit()
    session.refresh(cart)

    items = session.exec(
        select(CartItem).where(CartItem.cart_id == cart.id)
    ).all()

    return build_cart_response(cart, items)


@router.delete("/{site_id}/clear", response_model=CartResponse)
def clear_cart(
    site_id: UUID,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_user_for_site_or_404(session, site_id, UUID(user["userId"]))
    cart = get_or_create_cart(session, site_id, customer.id)

    items = session.exec(
        select(CartItem).where(CartItem.cart_id == cart.id)
    ).all()

    for item in items:
        session.delete(item)

    session.commit()
    session.refresh(cart)

    return build_cart_response(cart, [])