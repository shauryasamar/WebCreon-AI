from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from auth_middleware import enforce_site_ownership
from db.database import get_session
from models import Category, Site


router = APIRouter(
    prefix="/sites/{site_id}/categories",
    tags=["categories"],
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_site_or_404(session: Session, site_id: UUID) -> Site:
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


def make_slug(name: str) -> str:
    return "-".join(name.strip().lower().split())


class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None

    @field_validator("name")
    @classmethod
    def trim_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name cannot be empty")
        return v


class CategoryUpdate(BaseModel):
    name: str
    slug: Optional[str] = None

    @field_validator("name")
    @classmethod
    def trim_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name cannot be empty")
        return v


class CategoryResponse(BaseModel):
    id: UUID
    site_id: UUID
    name: str
    slug: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@router.get("/public", response_model=list[CategoryResponse])
def list_categories_public(
    site_id: UUID,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    categories = session.exec(
        select(Category)
        .where(Category.site_id == site_id)
        .order_by(Category.name)
    ).all()
    return categories


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    categories = session.exec(
        select(Category)
        .where(Category.site_id == site_id)
        .order_by(Category.name)
    ).all()
    return categories


@router.post("", response_model=CategoryResponse)
def create_category(
    site_id: UUID,
    payload: CategoryCreate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    slug_value = payload.slug or make_slug(payload.name)

    existing = session.exec(
        select(Category).where(
            Category.site_id == site_id,
            Category.slug == slug_value,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A category with this name already exists")

    category = Category(
        site_id=site_id,
        name=payload.name,
        slug=slug_value,
    )
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    site_id: UUID,
    category_id: UUID,
    payload: CategoryUpdate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    category = session.get(Category, category_id)
    if not category or category.site_id != site_id:
        raise HTTPException(status_code=404, detail="Category not found")

    slug_value = payload.slug or make_slug(payload.name)

    duplicate = session.exec(
        select(Category).where(
            Category.site_id == site_id,
            Category.slug == slug_value,
            Category.id != category_id,
        )
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="A category with this name already exists")

    category.name = payload.name
    category.slug = slug_value
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@router.delete("/{category_id}", status_code=204)
def delete_category(
    site_id: UUID,
    category_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    category = session.get(Category, category_id)
    if not category or category.site_id != site_id:
        raise HTTPException(status_code=404, detail="Category not found")

    session.delete(category)
    session.commit()
    return
