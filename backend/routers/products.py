from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
import json

from db.database import get_session
from models import Site, Product


router = APIRouter(
    prefix="/sites/{site_id}/products",
    tags=["products"],
)


def get_site_or_404(session: Session, site_id: int) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    price: float
    image: Optional[str] = None
    description: Optional[str] = None
    inStock: bool = True
    attributes: Optional[Dict[str, Any]] = None


class ProductUpdate(ProductCreate):
    pass


@router.get("", response_model=List[Dict[str, Any]])
def list_products(site_id: int, session: Session = Depends(get_session)):
    get_site_or_404(session, site_id)
    products = session.exec(
        select(Product).where(Product.site_id == site_id)
    ).all()
    return [
        {
            "id": p.id,
            "site_id": p.site_id,
            "name": p.name,
            "brand": p.brand,
            "category": p.category,
            "price": p.price,
            "image": p.image,
            "description": p.description,
            "inStock": p.in_stock,
            # attributes stored as JSON string in DB, decoded to dict for API
            "attributes": json.loads(p.attributes) if p.attributes else {},
        }
        for p in products
    ]


@router.post("", response_model=Dict[str, Any])
def create_product(
    site_id: int,
    product_in: ProductCreate,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    product = Product(
        site_id=site_id,
        name=product_in.name,
        brand=product_in.brand,
        category=product_in.category,
        price=product_in.price,
        image=product_in.image,
        description=product_in.description,
        in_stock=product_in.inStock,
        # encode dict attributes as JSON string
        attributes=json.dumps(product_in.attributes) if product_in.attributes else None,
    )

    session.add(product)
    session.commit()
    session.refresh(product)

    return {
        "id": product.id,
        "site_id": product.site_id,
        "name": product.name,
        "brand": product.brand,
        "category": product.category,
        "price": product.price,
        "image": product.image,
        "description": product.description,
        "inStock": product.in_stock,
        "attributes": json.loads(product.attributes) if product.attributes else {},
    }


@router.put("/{product_id}", response_model=Dict[str, Any])
def update_product(
    site_id: int,
    product_id: int,
    product_in: ProductUpdate,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = session.get(Product, product_id)

    if not product or product.site_id != site_id:
        raise HTTPException(status_code=404, detail="Product not found")

    product.name = product_in.name
    product.brand = product_in.brand
    product.category = product_in.category
    product.price = product_in.price
    product.image = product_in.image
    product.description = product_in.description
    product.in_stock = product_in.inStock
    product.attributes = (
        json.dumps(product_in.attributes) if product_in.attributes else None
    )

    session.add(product)
    session.commit()
    session.refresh(product)

    return {
        "id": product.id,
        "site_id": product.site_id,
        "name": product.name,
        "brand": product.brand,
        "category": product.category,
        "price": product.price,
        "image": product.image,
        "description": product.description,
        "inStock": product.in_stock,
        "attributes": json.loads(product.attributes) if product.attributes else {},
    }


@router.delete("/{product_id}", status_code=204)
def delete_product(
    site_id: int,
    product_id: int,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = session.get(Product, product_id)

    if not product or product.site_id != site_id:
        raise HTTPException(status_code=404, detail="Product not found")

    session.delete(product)
    session.commit()
    return