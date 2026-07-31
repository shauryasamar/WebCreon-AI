from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, select

from auth_middleware import enforce_site_ownership
from db.database import get_session
from models import Product, Site

router = APIRouter(
    prefix="/sites/{site_id}/products",
    tags=["products"],
)


def get_site_or_404(session: Session, site_id: UUID) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


def get_site_product_or_404(
    session: Session, site_id: UUID, product_id: UUID
) -> Product:
    product = session.get(Product, product_id)
    if not product or product.site_id != site_id:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


class ProductCreate(BaseModel):
    name: str
    price: Decimal
    stock: int = 0
    category: Optional[str] = None
    images: Optional[List[str]] = None


class ProductUpdate(BaseModel):
    name: str
    price: Decimal
    stock: int
    category: Optional[str] = None
    images: Optional[List[str]] = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    site_id: UUID
    name: str
    price: Decimal
    stock: int
    category: Optional[str] = None
    images: Optional[List[str]] = Field(default=None)


@router.get("", response_model=List[ProductResponse])
def list_products(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    products = session.exec(
        select(Product).where(Product.site_id == site_id)
    ).all()
    return products


@router.post("", response_model=ProductResponse)
def create_product(
    site_id: UUID,
    product_in: ProductCreate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    product = Product(
        site_id=site_id,
        name=product_in.name,
        price=product_in.price,
        stock=product_in.stock,
        category=product_in.category,
        images=product_in.images,
    )

    session.add(product)
    session.commit()
    session.refresh(product)

    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    site_id: UUID,
    product_id: UUID,
    product_in: ProductUpdate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)

    product.name = product_in.name
    product.price = product_in.price
    product.stock = product_in.stock
    product.category = product_in.category
    product.images = product_in.images

    session.add(product)
    session.commit()
    session.refresh(product)

    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(
    site_id: UUID,
    product_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)

    session.delete(product)
    session.commit()
    return