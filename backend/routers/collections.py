from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from auth_middleware import enforce_site_ownership
from db.database import get_session
from models import Collection, Site


router = APIRouter(
    prefix="/sites/{site_id}/collections",
    tags=["collections"],
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


class CollectionCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: str = ""

    @field_validator("name")
    @classmethod
    def trim_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Collection name cannot be empty")
        return v


class CollectionUpdate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: str = ""

    @field_validator("name")
    @classmethod
    def trim_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Collection name cannot be empty")
        return v


class CollectionResponse(BaseModel):
    id: UUID
    site_id: UUID
    name: str
    slug: Optional[str] = None
    description: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@router.get("/public", response_model=list[CollectionResponse])
def list_collections_public(
    site_id: UUID,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    collections = session.exec(
        select(Collection)
        .where(Collection.site_id == site_id)
        .order_by(Collection.name)
    ).all()
    return collections


@router.get("", response_model=list[CollectionResponse])
def list_collections(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    collections = session.exec(
        select(Collection)
        .where(Collection.site_id == site_id)
        .order_by(Collection.name)
    ).all()
    return collections


@router.post("", response_model=CollectionResponse)
def create_collection(
    site_id: UUID,
    payload: CollectionCreate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    slug_value = payload.slug or make_slug(payload.name)

    existing = session.exec(
        select(Collection).where(
            Collection.site_id == site_id,
            Collection.slug == slug_value,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A collection with this name already exists")

    collection = Collection(
        site_id=site_id,
        name=payload.name,
        slug=slug_value,
        description=payload.description,
    )
    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


@router.put("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    site_id: UUID,
    collection_id: UUID,
    payload: CollectionUpdate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    collection = session.get(Collection, collection_id)
    if not collection or collection.site_id != site_id:
        raise HTTPException(status_code=404, detail="Collection not found")

    slug_value = payload.slug or make_slug(payload.name)

    duplicate = session.exec(
        select(Collection).where(
            Collection.site_id == site_id,
            Collection.slug == slug_value,
            Collection.id != collection_id,
        )
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="A collection with this name already exists")

    collection.name = payload.name
    collection.slug = slug_value
    collection.description = payload.description
    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


@router.delete("/{collection_id}", status_code=204)
def delete_collection(
    site_id: UUID,
    collection_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    collection = session.get(Collection, collection_id)
    if not collection or collection.site_id != site_id:
        raise HTTPException(status_code=404, detail="Collection not found")

    session.delete(collection)
    session.commit()
    return
