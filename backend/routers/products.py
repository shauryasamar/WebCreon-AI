from __future__ import annotations

import csv
import io
import re
import time
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from threading import Lock
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlmodel import Session, delete, func, or_, select, update
from sqlalchemy import case

from auth_middleware import authenticate_customer, enforce_site_ownership
from db.database import get_session
from models import (
    CartItem,
    Category,
    Collection,
    InventoryMovement,
    Order,
    OrderItem,
    Product,
    ProductCollection,
    ProductReview,
    ReturnItem,
    Site,
    User,
)

try:
    from PIL import Image, ImageOps
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def save_optimized_upload_image(content: bytes, destination_dir: Path, original_ext: str = ".webp") -> str:
    if HAS_PIL:
        try:
            with Image.open(io.BytesIO(content)) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                    img = img.convert("RGBA")
                else:
                    img = img.convert("RGB")

                max_dim = 1600
                if img.width > max_dim or img.height > max_dim:
                    img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

                filename = f"{uuid4()}.webp"
                img.save(destination_dir / filename, "WEBP", quality=82, method=6)
                return filename
        except Exception:
            pass

    ext = original_ext if original_ext in {".webp", ".png", ".jpg", ".jpeg"} else ".webp"
    filename = f"{uuid4()}{ext}"
    (destination_dir / filename).write_bytes(content)
    return filename



router = APIRouter(
    prefix="/sites/{site_id}/products",
    tags=["products"],
)


class ProductCatalogCache:
    def __init__(self, default_ttl: float = 60.0):
        self._cache: dict[str, tuple[float, Any]] = {}
        self._lock = Lock()
        self._default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            expires_at, data = entry
            if time.time() > expires_at:
                del self._cache[key]
                return None
            return data

    def set(self, key: str, data: Any, ttl: Optional[float] = None) -> None:
        duration = ttl if ttl is not None else self._default_ttl
        with self._lock:
            self._cache[key] = (time.time() + duration, data)

    def invalidate_site(self, site_id: Any) -> None:
        prefix = f"site:{str(site_id)}:"
        with self._lock:
            keys_to_remove = [k for k in self._cache if k.startswith(prefix)]
            for k in keys_to_remove:
                self._cache.pop(k, None)


catalog_cache = ProductCatalogCache(default_ttl=60.0)


PRODUCT_UPLOADS_DIR = Path("uploads/products")
PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

REVIEW_UPLOADS_DIR = Path("uploads/product-reviews")
REVIEW_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def make_slug(name: str) -> str:
    return "-".join(name.strip().lower().split())


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


def get_customer_for_site_or_404(
    session: Session, site_id: UUID, user_id: UUID
) -> User:
    user = session.get(User, user_id)
    if not user or user.site_id != site_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    return user


def make_slug(name: str) -> str:
    return "-".join(name.strip().lower().split())


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: json_safe(val) for key, val in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def serialize_review(review: ProductReview, customer_name: Optional[str] = None) -> dict[str, Any]:
    return {
        "id": str(review.id),
        "site_id": str(review.site_id),
        "product_id": str(review.product_id),
        "customer_id": str(review.customer_id),
        "order_id": str(review.order_id),
        "order_item_id": str(review.order_item_id),
        "rating": review.rating,
        "review_text": review.review_text,
        "review_images": review.review_images or [],
        "customer_name": customer_name,
        "created_at": review.created_at.isoformat() if review.created_at else None,
        "updated_at": review.updated_at.isoformat() if review.updated_at else None,
    }


def get_product_review_summary(
    session: Session, site_id: UUID, product_id: UUID, sibling_group: Optional[str] = None
) -> tuple[float, int]:
    if sibling_group:
        sibling_ids = session.exec(
            select(Product.id).where(
                Product.site_id == site_id,
                Product.sibling_group == sibling_group,
                Product.is_active == True,
            )
        ).all()
        if sibling_ids:
            result = session.exec(
                select(
                    func.coalesce(func.avg(ProductReview.rating), 0),
                    func.count(ProductReview.id),
                ).where(
                    ProductReview.site_id == site_id,
                    ProductReview.product_id.in_(sibling_ids),
                )
            ).first()
            if result:
                avg_rating, review_count = result
                return float(avg_rating or 0), int(review_count or 0)

    result = session.exec(
        select(
            func.coalesce(func.avg(ProductReview.rating), 0),
            func.count(ProductReview.id),
        ).where(
            ProductReview.site_id == site_id,
            ProductReview.product_id == product_id,
        )
    ).first()

    if not result:
        return 0.0, 0

    avg_rating, review_count = result
    return float(avg_rating or 0), int(review_count or 0)


def get_product_reviews(
    session: Session,
    site_id: UUID,
    product_id: UUID,
    sibling_group: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
) -> list[dict[str, Any]]:
    query = (
        select(ProductReview, User)
        .join(User, User.id == ProductReview.customer_id)
        .order_by(ProductReview.created_at.desc())
    )

    if sibling_group:
        sibling_ids = session.exec(
            select(Product.id).where(
                Product.site_id == site_id,
                Product.sibling_group == sibling_group,
                Product.is_active == True,
            )
        ).all()
        if sibling_ids:
            query = query.where(
                ProductReview.site_id == site_id,
                ProductReview.product_id.in_(sibling_ids),
            )
        else:
            query = query.where(
                ProductReview.site_id == site_id,
                ProductReview.product_id == product_id,
            )
    else:
        query = query.where(
            ProductReview.site_id == site_id,
            ProductReview.product_id == product_id,
        )

    if offset > 0:
        query = query.offset(offset)
    if limit is not None and limit > 0:
        query = query.limit(limit)

    reviews = session.exec(query).all()
    return [
        serialize_review(review, customer_name=user.name or user.email or "Customer")
        for review, user in reviews
    ]


def get_product_collections(session: Session, product_id: UUID) -> list[dict[str, Any]]:
    rows = session.exec(
        select(Collection)
        .join(ProductCollection, ProductCollection.collection_id == Collection.id)
        .where(ProductCollection.product_id == product_id)
        .order_by(Collection.name)
    ).all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "slug": c.slug,
            "is_badge": bool(getattr(c, "is_badge", False)),
            "badge_color": getattr(c, "badge_color", None),
        }
        for c in rows
    ]


def optimize_unsplash_image_url(url: str, width: int = 800, quality: int = 80) -> str:
    url_str = url.strip()
    if "images.unsplash.com" in url_str:
        base = url_str.split("?")[0]
        return f"{base}?auto=format&fit=crop&w={width}&q={quality}"
    return url_str


def heal_image_urls(images: list[str]) -> list[str]:
    if not images:
        return []
    healed: list[str] = []
    for img in images:
        img_str = str(img).strip()
        if not img_str:
            continue
        # If it contains an upload path like http://localhost:8000/uploads/... or http://192.168.x.x:8000/uploads/...
        # Normalize it to a relative /uploads/... path so all clients (desktop, mobile LAN, tunnels) resolve it against their current host!
        upload_idx = img_str.find("/uploads/")
        if upload_idx != -1:
            img_str = img_str[upload_idx:]

        if (
            healed
            and not img_str.startswith("http://")
            and not img_str.startswith("https://")
            and not img_str.startswith("/")
            and not img_str.startswith("data:")
        ):
            healed[-1] = f"{healed[-1]},{img_str}"
        else:
            healed.append(optimize_unsplash_image_url(img_str))
    return healed


def to_product_responses_batch(
    products: list[Product],
    session: Session,
    include_reviews: bool = False,
    include_siblings: bool = True,
) -> list[dict[str, Any]]:
    if not products:
        return []

    product_ids = [p.id for p in products]
    site_id = products[0].site_id

    # 1. Batch fetch Categories in 1 query
    category_ids = {p.category_id for p in products if p.category_id}
    category_map: dict[UUID, str] = {}
    if category_ids:
        cat_rows = session.exec(select(Category).where(Category.id.in_(category_ids))).all()
        for cat in cat_rows:
            category_map[cat.id] = cat.name

    # 2. Batch fetch Collections in 1 query
    collections_by_product_id: dict[UUID, list[dict[str, Any]]] = {pid: [] for pid in product_ids}
    if product_ids:
        pc_rows = session.exec(
            select(ProductCollection.product_id, Collection)
            .join(Collection, Collection.id == ProductCollection.collection_id)
            .where(ProductCollection.product_id.in_(product_ids))
            .order_by(Collection.name)
        ).all()
        for pid, c in pc_rows:
            collections_by_product_id.setdefault(pid, []).append(
                {
                    "id": str(c.id),
                    "name": c.name,
                    "slug": c.slug,
                    "is_badge": bool(getattr(c, "is_badge", False)),
                    "badge_color": getattr(c, "badge_color", None),
                }
            )

    # 3. Batch fetch Review Summary (always compute rating stats for all products)
    review_summary_by_product: dict[UUID, tuple[float, int]] = {}
    if product_ids:
        review_stats = session.exec(
            select(
                ProductReview.product_id,
                func.coalesce(func.avg(ProductReview.rating), 0),
                func.count(ProductReview.id),
            )
            .where(
                ProductReview.site_id == site_id,
                ProductReview.product_id.in_(product_ids),
            )
            .group_by(ProductReview.product_id)
        ).all()
        for pid, avg_r, count_r in review_stats:
            review_summary_by_product[pid] = (float(avg_r or 0), int(count_r or 0))

    # 4. Batch fetch Siblings only if requested
    siblings_by_group: dict[str, list[dict[str, Any]]] = {}
    if include_siblings:
        sibling_groups = {
            getattr(p, "sibling_group", None)
            for p in products
            if getattr(p, "sibling_group", None)
        }
        if sibling_groups:
            sibling_rows = session.exec(
                select(Product)
                .where(
                    Product.site_id == site_id,
                    Product.sibling_group.in_(sibling_groups),
                    Product.is_active == True,
                )
                .order_by(Product.created_at.asc())
            ).all()
            for s in sibling_rows:
                s_images = heal_image_urls(s.images or [])
                if s.sibling_group:
                    siblings_by_group.setdefault(s.sibling_group, []).append(
                        {
                            "id": str(s.id),
                            "name": s.name,
                            "sibling_label": getattr(s, "sibling_label", None) or s.name,
                            "slug": s.slug,
                            "price": float(s.price),
                            "compare_price": (
                                float(s.compare_price) if s.compare_price is not None else None
                            ),
                            "in_stock": s.in_stock,
                            "cover_image": s_images[0] if s_images else None,
                        }
                    )

    # 5. Assemble all responses in memory (0 extra queries)
    results: list[dict[str, Any]] = []
    for product in products:
        sibling_group_val = getattr(product, "sibling_group", None)
        avg_rating, rev_count = review_summary_by_product.get(product.id, (0.0, 0))

        group_siblings = siblings_by_group.get(sibling_group_val, []) if sibling_group_val else []
        product_siblings = [
            {**s, "is_current": s["id"] == str(product.id)}
            for s in group_siblings
        ]

        response = {
            "id": product.id,
            "site_id": product.site_id,
            "name": product.name,
            "brand": product.brand,
            "category": product.category,
            "category_id": str(product.category_id) if product.category_id else None,
            "category_name": category_map.get(product.category_id) if product.category_id else None,
            "collections": collections_by_product_id.get(product.id, []),
            "description": product.description or "",
            "slug": product.slug,
            "price": product.price,
            "compare_price": product.compare_price,
            "stock": product.stock,
            "in_stock": product.in_stock,
            "is_active": getattr(product, "is_active", True),
            "sku": getattr(product, "sku", None),
            "hsn_code": getattr(product, "hsn_code", None),
            "video_url": getattr(product, "video_url", None),
            "video_position": (
                getattr(product, "video_position", 2)
                if getattr(product, "video_position", None) is not None
                else 2
            ),
            "sibling_group": sibling_group_val,
            "sibling_label": getattr(product, "sibling_label", None),
            "siblings": product_siblings,
            "weight_grams": getattr(product, "weight_grams", 500),
            "length_cm": float(product.length_cm) if getattr(product, "length_cm", None) is not None else None,
            "width_cm": float(product.width_cm) if getattr(product, "width_cm", None) is not None else None,
            "height_cm": float(product.height_cm) if getattr(product, "height_cm", None) is not None else None,
            "images": heal_image_urls(product.images or []),
            "highlights": getattr(product, "highlights", []) or [],
            "variant_option": product.variant_option,
            "return_window_days": product.return_window_days,
            "average_rating": avg_rating,
            "review_count": rev_count,
            "created_at": product.created_at,
            "updated_at": product.updated_at,
        }

        if include_reviews:
            response["reviews"] = get_product_reviews(
                session, product.site_id, product.id, sibling_group_val, limit=8, offset=0
            )

        results.append(response)

    return results


def to_product_response(
    product: Product,
    session: Session,
    include_reviews: bool = False,
) -> dict[str, Any]:
    batch = to_product_responses_batch([product], session, include_reviews=include_reviews)
    return batch[0] if batch else {}


class UploadImageResponse(BaseModel):
    url: str
    filename: str


class ReviewImageUploadResponse(BaseModel):
    url: str
    filename: str


class VariantValue(BaseModel):
    value: str
    inStock: bool = True
    stockQty: Optional[int] = None
    price: Optional[Decimal] = None
    comparePrice: Optional[Decimal] = None

    @field_validator("value")
    @classmethod
    def trim_value(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Option value cannot be empty")
        return v

    @model_validator(mode="after")
    def clean_variant_fields(self):
        if self.stockQty is not None and self.stockQty < 0:
            raise ValueError("stockQty cannot be negative")
        if self.price is not None and self.price <= 0:
            raise ValueError("price must be greater than zero")
        if self.comparePrice is not None and self.comparePrice < 0:
            raise ValueError("comparePrice cannot be negative")
        if (
            self.price is not None
            and self.comparePrice is not None
            and self.comparePrice < self.price
        ):
            raise ValueError("comparePrice must be greater than or equal to price")
        return self


class ProductVariantOption(BaseModel):
    optionType: str = "custom"
    optionName: str
    optionValues: list[VariantValue]

    @field_validator("optionName")
    @classmethod
    def trim_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Option name cannot be empty")
        return v

    @model_validator(mode="after")
    def validate_unique_values(self):
        values = [item.value.strip() for item in self.optionValues if item.value.strip()]
        if len(values) != len(set(values)):
            raise ValueError("Duplicate option values are not allowed")
        return self


class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str
    category_id: Optional[UUID] = None
    collection_ids: list[UUID] = Field(default_factory=list)
    description: str
    highlights: list[str] = Field(default_factory=list)
    price: Decimal
    compare_price: Optional[Decimal] = None
    stock: int = 0
    in_stock: bool = True
    is_active: bool = True
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    video_url: Optional[str] = None
    video_position: Optional[int] = 2
    sibling_group: Optional[str] = None
    sibling_label: Optional[str] = None
    weight_grams: int = 500
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    slug: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    variant_option: Optional[ProductVariantOption] = None
    return_window_days: Optional[int] = None

    @field_validator("name", "category", "description")
    @classmethod
    def trim_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v

    @field_validator("brand", "slug", "sku", "hsn_code", "video_url", "sibling_group", "sibling_label")
    @classmethod
    def trim_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        return v or None

    @field_validator("images")
    @classmethod
    def validate_images(cls, v: list[str]) -> list[str]:
        cleaned = [item.strip() for item in v if item and item.strip()]
        if len(cleaned) == 0:
            raise ValueError("At least one image is required")
        return cleaned

    @field_validator("stock")
    @classmethod
    def validate_stock(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Stock cannot be negative")
        return v

    @field_validator("highlights", mode="before")
    @classmethod
    def parse_highlights_create(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [line.strip() for line in v.split("\n") if line.strip()]
        if isinstance(v, list):
            return [str(line).strip() for line in v if str(line).strip()]
        return []

    @field_validator("highlights")
    @classmethod
    def validate_highlights_word_count_create(cls, v: list[str]) -> list[str]:
        total_words = len(" ".join(v).split())
        if total_words > 50:
            raise ValueError(f"Highlights cannot exceed 50 words (currently {total_words} words)")
        return v

    @model_validator(mode="after")
    def validate_prices(self):
        if self.price <= 0:
            raise ValueError("Price must be greater than zero")
        if self.compare_price is not None and self.compare_price < self.price:
            raise ValueError("Compare price must be greater than or equal to price")
        return self


class ProductUpdate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str
    category_id: Optional[UUID] = None
    collection_ids: list[UUID] = Field(default_factory=list)
    description: str
    highlights: list[str] = Field(default_factory=list)
    price: Decimal
    compare_price: Optional[Decimal] = None
    stock: int = 0
    in_stock: bool = True
    is_active: bool = True
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    video_url: Optional[str] = None
    video_position: Optional[int] = 2
    sibling_group: Optional[str] = None
    sibling_label: Optional[str] = None
    weight_grams: int = 500
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    slug: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    variant_option: Optional[ProductVariantOption] = None
    return_window_days: Optional[int] = None

    @field_validator("name", "category", "description")
    @classmethod
    def trim_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v

    @field_validator("brand", "slug", "sku", "hsn_code", "video_url", "sibling_group", "sibling_label")
    @classmethod
    def trim_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        return v or None

    @field_validator("images")
    @classmethod
    def validate_images(cls, v: list[str]) -> list[str]:
        cleaned = [item.strip() for item in v if item and item.strip()]
        if len(cleaned) == 0:
            raise ValueError("At least one image is required")
        return cleaned

    @field_validator("stock")
    @classmethod
    def validate_stock(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Stock cannot be negative")
        return v

    @field_validator("highlights", mode="before")
    @classmethod
    def parse_highlights_update(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [line.strip() for line in v.split("\n") if line.strip()]
        if isinstance(v, list):
            return [str(line).strip() for line in v if str(line).strip()]
        return []

    @field_validator("highlights")
    @classmethod
    def validate_highlights_word_count_update(cls, v: list[str]) -> list[str]:
        total_words = len(" ".join(v).split())
        if total_words > 50:
            raise ValueError(f"Highlights cannot exceed 50 words (currently {total_words} words)")
        return v

    @model_validator(mode="after")
    def validate_prices(self):
        if self.price <= 0:
            raise ValueError("Price must be greater than zero")
        if self.compare_price is not None and self.compare_price < self.price:
            raise ValueError("Compare price must be greater than or equal to price")
        return self


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    site_id: UUID
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    collections: list[dict[str, Any]] = Field(default_factory=list)
    description: str
    slug: Optional[str] = None
    price: Decimal
    compare_price: Optional[Decimal] = None
    stock: int
    in_stock: bool
    is_active: bool = True
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    video_url: Optional[str] = None
    weight_grams: int = 500
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    images: list[str]
    highlights: list[str] = Field(default_factory=list)
    variant_option: Optional[dict[str, Any]] = None
    return_window_days: Optional[int] = None
    average_rating: float = 0.0
    review_count: int = 0
    reviews: Optional[list[dict[str, Any]]] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None


class ProductQuickEdit(BaseModel):
    price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    stock: Optional[int] = None
    in_stock: Optional[bool] = None
    is_active: Optional[bool] = None
    variant_option: Optional[dict[str, Any]] = None


class BulkProductActionRequest(BaseModel):
    product_ids: list[Any] = Field(default_factory=list)
    action: str  # "make_active", "make_draft", "delete"


ProductBulkAction = BulkProductActionRequest


class ProductReviewCreate(BaseModel):
    product_id: UUID
    order_item_id: UUID
    rating: int
    review_text: str = ""
    review_images: list[str] = Field(default_factory=list)

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v

    @field_validator("review_text")
    @classmethod
    def trim_review_text(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("review_images")
    @classmethod
    def clean_images(cls, v: list[str]) -> list[str]:
        return [item.strip() for item in v if item and item.strip()]


@router.get("")
def list_products(
    site_id: UUID,
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search products by name/brand/category/sku"),
    status: Optional[str] = Query(None, description="Filter by status: all, active, draft, in_stock, low_stock, out_of_stock"),
    category_id: Optional[UUID] = Query(None, description="Filter by category"),
    collection_id: Optional[UUID] = Query(None, description="Filter by collection"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    min_price: Optional[Decimal] = Query(None, description="Minimum price"),
    max_price: Optional[Decimal] = Query(None, description="Maximum price"),
    has_discount: Optional[bool] = Query(None, description="Filter products with discount / MRP strike"),
    return_policy: Optional[str] = Query(None, description="Filter by return policy: non_returnable, returnable"),
    has_video: Optional[bool] = Query(None, description="Filter products with video"),
    sort_by: Optional[str] = Query(None, description="Sort order"),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    cache_key = f"site:{site_id}:admin_list:{page}:{page_size}:{search}:{status}:{category_id}:{collection_id}:{brand}:{min_price}:{max_price}:{has_discount}:{return_policy}:{has_video}:{sort_by}"
    cached_data = catalog_cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    get_site_or_404(session, site_id)
    
    # 1. Build contextual base filter conditions
    conditions = [Product.site_id == site_id]
    if category_id:
        conditions.append(Product.category_id == category_id)
    if collection_id:
        product_ids_in_col = (
            select(ProductCollection.product_id)
            .where(ProductCollection.collection_id == collection_id)
        )
        conditions.append(Product.id.in_(product_ids_in_col))
    if brand and brand.strip():
        conditions.append(Product.brand.ilike(f"%{brand.strip()}%"))
    if min_price is not None:
        conditions.append(Product.price >= min_price)
    if max_price is not None:
        conditions.append(Product.price <= max_price)
    if has_discount is True:
        conditions.append(Product.compare_price.isnot(None))
        conditions.append(Product.compare_price > Product.price)
    elif has_discount is False:
        conditions.append((Product.compare_price.is_(None)) | (Product.compare_price <= Product.price))
    if return_policy == "non_returnable":
        conditions.append(Product.return_window_days == 0)
    elif return_policy == "returnable":
        conditions.append((Product.return_window_days.is_(None)) | (Product.return_window_days > 0))
    if has_video is True:
        conditions.append(Product.video_url.isnot(None))
        conditions.append(Product.video_url != "")
    elif has_video is False:
        conditions.append((Product.video_url.is_(None)) | (Product.video_url == ""))
    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            (Product.name.ilike(term))
            | (Product.brand.ilike(term))
            | (Product.category.ilike(term))
            | (Product.sku.ilike(term))
        )

    # 2. Fast scalar query for variant-aware tab badge counts
    stat_rows = session.exec(
        select(
            Product.id,
            Product.stock,
            Product.in_stock,
            Product.is_active,
            Product.variant_option,
        ).where(*conditions)
    ).all()

    all_count = len(stat_rows)
    active_count = 0
    in_stock_ids = set()
    low_stock_ids = set()

    for pid, stock, in_stock, is_active, v_opt in stat_rows:
        if is_active:
            active_count += 1

        has_variant_low = False
        has_variant_in_stock = False

        if isinstance(v_opt, dict):
            opt_vals = v_opt.get("optionValues")
            if isinstance(opt_vals, list) and len(opt_vals) > 0:
                for v in opt_vals:
                    if isinstance(v, dict):
                        qty = v.get("stockQty")
                        if qty is not None:
                            try:
                                q_val = int(qty)
                                if 0 < q_val <= 5:
                                    has_variant_low = True
                                if q_val > 0:
                                    has_variant_in_stock = True
                            except (ValueError, TypeError):
                                pass
                        elif v.get("inStock"):
                            has_variant_in_stock = True

        flat_low = bool(in_stock and stock is not None and 0 < stock <= 5)
        flat_in_stock = bool(in_stock and stock is not None and stock > 0)

        if flat_low or has_variant_low:
            low_stock_ids.add(pid)
        if flat_in_stock or has_variant_in_stock:
            in_stock_ids.add(pid)

    draft_count = max(0, all_count - active_count)
    in_stock_count = len(in_stock_ids)
    low_stock_count = len(low_stock_ids)
    out_of_stock_count = max(0, all_count - in_stock_count)

    # Distinct store brands for filter dropdown
    brand_rows = session.exec(
        select(Product.brand).where(Product.site_id == site_id, Product.brand.isnot(None)).distinct()
    ).all()
    all_brands = sorted([str(b).strip() for b in brand_rows if b and str(b).strip()])

    # 3. Apply active status tab filter to build lean query
    status_conditions = list(conditions)
    if status == "active":
        status_conditions.append(Product.is_active == True)
        total_count = active_count
    elif status == "draft":
        status_conditions.append(Product.is_active == False)
        total_count = draft_count
    elif status == "in_stock":
        status_conditions.append(Product.id.in_(list(in_stock_ids)) if in_stock_ids else False)
        total_count = in_stock_count
    elif status == "low_stock":
        status_conditions.append(Product.id.in_(list(low_stock_ids)) if low_stock_ids else False)
        total_count = low_stock_count
    elif status == "out_of_stock":
        status_conditions.append(~Product.id.in_(list(in_stock_ids)) if in_stock_ids else True)
        total_count = out_of_stock_count
    else:
        total_count = all_count

    base_query = select(Product).where(*status_conditions)

    # Sorting
    if sort_by == "price_asc":
        order_clause = Product.price.asc()
    elif sort_by == "price_desc":
        order_clause = Product.price.desc()
    elif sort_by == "stock_asc":
        order_clause = Product.stock.asc()
    elif sort_by == "stock_desc":
        order_clause = Product.stock.desc()
    elif sort_by == "name_asc":
        order_clause = Product.name.asc()
    else:
        order_clause = Product.created_at.desc()

    # If pagination is requested
    if page is not None and page_size is not None:
        if status == "active":
            total_count = active_count
        elif status == "draft":
            total_count = draft_count
        elif status == "in_stock":
            total_count = in_stock_count
        elif status == "low_stock":
            total_count = low_stock_count
        elif status == "out_of_stock":
            total_count = out_of_stock_count
        else:
            total_count = all_count

        paginated_query = (
            base_query.order_by(order_clause)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        products = session.exec(paginated_query).all()
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

        result = {
            "products": to_product_responses_batch(products, session, include_reviews=False, include_siblings=False),
            "total": total_count,
            "all_count": all_count,
            "total_count": all_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "active_count": active_count,
            "draft_count": draft_count,
            "in_stock_count": in_stock_count,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "brands": sorted(list(all_brands)),
        }
        catalog_cache.set(cache_key, result, ttl=30.0)
        return result

    # Unpaginated fallback
    products = session.exec(base_query.order_by(order_clause)).all()
    result = to_product_responses_batch(products, session, include_reviews=False, include_siblings=False)
    catalog_cache.set(cache_key, result, ttl=30.0)
    return result


@router.get("/public", include_in_schema=False)
def list_products_public(
    site_id: UUID,
    response: Response,
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    page_size: Optional[int] = Query(None, ge=1, le=1000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search across name, brand, product type"),
    category_id: Optional[str] = Query(None, description="Filter by category ID or name"),
    product_type: Optional[list[str]] = Query(None, description="Filter by product type(s)"),
    collection_id: Optional[list[str]] = Query(None, description="Filter by collection ID(s) or name(s)"),
    brand: Optional[list[str]] = Query(None, description="Filter by brand(s)"),
    min_price: Optional[Decimal] = Query(None, description="Minimum price"),
    max_price: Optional[Decimal] = Query(None, description="Maximum price"),
    in_stock_only: Optional[bool] = Query(None, description="Only in-stock products"),
    sort_by: Optional[str] = Query(None, description="Sort: newest, price_asc, price_desc, rating_desc, discount_desc"),
    session: Session = Depends(get_session),
):
    response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=60"

    cache_key = (
        f"site:{site_id}:public:"
        f"p={page}:ps={page_size}:q={search}:c={category_id}:"
        f"pt={','.join(sorted(product_type)) if product_type else ''}:"
        f"col={','.join(sorted(str(cid) for cid in collection_id)) if collection_id else ''}:"
        f"b={','.join(sorted(brand)) if brand else ''}:"
        f"min={min_price}:max={max_price}:stk={in_stock_only}:sort={sort_by}"
    )
    cached_val = catalog_cache.get(cache_key)
    if cached_val is not None:
        response.headers["X-Cache"] = "HIT"
        return cached_val

    get_site_or_404(session, site_id)

    query = select(Product).where(Product.site_id == site_id, Product.is_active == True)

    # --- Search ---
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            (Product.name.ilike(term))
            | (Product.brand.ilike(term))
            | (Product.category.ilike(term))
        )

    # --- Category filter (broad category or category name) ---
    if category_id and category_id.strip():
        cat_str = category_id.strip()
        try:
            cat_uuid = UUID(cat_str)
            query = query.where(Product.category_id == cat_uuid)
        except ValueError:
            query = query.where(
                (Product.category.ilike(f"%{cat_str}%"))
                | (Product.category_name.ilike(f"%{cat_str}%"))
            )

    # --- Product type filter (the existing category column) ---
    if product_type:
        query = query.where(Product.category.in_(product_type))

    # --- Brand filter ---
    if brand:
        query = query.where(Product.brand.in_(brand))

    # --- Collection filter (multi-select) ---
    if collection_id:
        col_uuids = []
        col_names = []
        for cid in collection_id:
            try:
                col_uuids.append(UUID(str(cid).strip()))
            except ValueError:
                col_names.append(str(cid).strip())

        col_conditions = []
        if col_uuids:
            product_ids_in_collections = (
                select(ProductCollection.product_id)
                .where(ProductCollection.collection_id.in_(col_uuids))
                .distinct()
            )
            col_conditions.append(Product.id.in_(product_ids_in_collections))
        if col_names:
            for cn in col_names:
                col_conditions.append(
                    (Product.category.ilike(f"%{cn}%"))
                    | (Product.category_name.ilike(f"%{cn}%"))
                )
        if col_conditions:
            query = query.where(or_(*col_conditions))

    # --- Price range ---
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)

    # --- In-stock filter ---
    if in_stock_only:
        query = query.where(Product.in_stock == True)

    # --- Sorting ---
    if sort_by == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort_by == "newest":
        query = query.order_by(Product.created_at.desc())
    elif sort_by == "discount_desc":
        # Sort by discount percentage descending; products without compare_price go last
        query = query.order_by(
            func.coalesce(
                (Product.compare_price - Product.price) / func.nullif(Product.compare_price, 0),
                0,
            ).desc()
        )
    elif sort_by == "rating_desc":
        # Sub-query approach: join with avg rating
        avg_rating_sub = (
            select(
                ProductReview.product_id,
                func.coalesce(func.avg(ProductReview.rating), 0).label("avg_rating"),
            )
            .group_by(ProductReview.product_id)
            .subquery()
        )
        query = (
            query
            .outerjoin(avg_rating_sub, Product.id == avg_rating_sub.c.product_id)
            .order_by(func.coalesce(avg_rating_sub.c.avg_rating, 0).desc())
        )
    else:
        # Default: newest first
        query = query.order_by(Product.created_at.desc())

    effective_page = page if page is not None and page >= 1 else 1
    effective_page_size = min(page_size if page_size is not None and page_size >= 1 else 24, 1000)

    count_query = select(func.count()).select_from(query.subquery())
    total_count = session.exec(count_query).one() or 0
    total_pages = (total_count + effective_page_size - 1) // effective_page_size if total_count > 0 else 1

    paginated_query = query.offset((effective_page - 1) * effective_page_size).limit(effective_page_size)
    products = session.exec(paginated_query).all()

    res = {
        "items": to_product_responses_batch(products, session),
        "total": total_count,
        "page": effective_page,
        "page_size": effective_page_size,
        "total_pages": total_pages,
    }
    catalog_cache.set(cache_key, res, ttl=60.0)
    return res


@router.get("/public/by-slug/{slug_or_id}")
def get_public_product_by_slug_or_id(
    site_id: UUID,
    slug_or_id: str,
    response: Response,
    session: Session = Depends(get_session),
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    target = slug_or_id.strip()
    target_clean = re.sub(r"[^a-z0-9]+", "-", target.lower()).strip("-")

    # Fast cache lookup
    cache_key = f"site:{str(site_id)}:slug:{target.lower()}"
    cached = catalog_cache.get(cache_key)
    if cached is not None:
        return cached

    get_site_or_404(session, site_id)

    # 1. Try exact slug match
    product = session.exec(
        select(Product).where(Product.site_id == site_id, Product.slug == target, Product.is_active == True)
    ).first()

    # 2. Try UUID match
    if not product:
        try:
            target_uuid = UUID(target)
            product = session.exec(
                select(Product).where(Product.site_id == site_id, Product.id == target_uuid, Product.is_active == True)
            ).first()
        except (ValueError, TypeError):
            pass

    # 3. Try name match / slugified name match
    if not product:
        prods = session.exec(
            select(Product).where(Product.site_id == site_id, Product.is_active == True)
        ).all()
        for p in prods:
            p_slug = (p.slug or "").lower().strip()
            p_clean_name = re.sub(r"[^a-z0-9]+", "-", (p.name or "").lower()).strip("-")
            if p_slug == target_clean or p_clean_name == target_clean or (p.name and p.name.lower() == target.lower()):
                product = p
                break

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    res = to_product_response(product, session, include_reviews=True)
    catalog_cache.set(cache_key, res, ttl=60.0)
    if target_clean and target_clean != target.lower():
        catalog_cache.set(f"site:{str(site_id)}:slug:{target_clean}", res, ttl=60.0)
    if product.slug:
        catalog_cache.set(f"site:{str(site_id)}:slug:{product.slug.lower()}", res, ttl=60.0)
    catalog_cache.set(f"site:{str(site_id)}:slug:{str(product.id).lower()}", res, ttl=60.0)
    return res


CSV_HEADERS = [
    "name",
    "brand",
    "category",
    "price",
    "compare_price",
    "stock",
    "is_active",
    "sku",
    "hsn_code",
    "video_url",
    "video_position",
    "sibling_group",
    "sibling_label",
    "return_window_days",
    "weight_grams",
    "length_cm",
    "width_cm",
    "height_cm",
    "highlights",
    "description",
    "images",
    "collections",
    "variant_option_name",
    "variant_values",
]


@router.get("/export-csv")
def export_products_csv(
    site_id: UUID,
    ids: Optional[str] = Query(default=None),
    search: Optional[str] = Query(None, description="Search products by name/brand/category/sku"),
    status: Optional[str] = Query(None, description="Filter by status: all, active, draft, in_stock, low_stock, out_of_stock"),
    category_id: Optional[UUID] = Query(None, description="Filter by category"),
    collection_id: Optional[UUID] = Query(None, description="Filter by collection"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    min_price: Optional[Decimal] = Query(None, description="Minimum price"),
    max_price: Optional[Decimal] = Query(None, description="Maximum price"),
    has_discount: Optional[bool] = Query(None, description="Filter products with discount / MRP strike"),
    return_policy: Optional[str] = Query(None, description="Filter by return policy: non_returnable, returnable"),
    has_video: Optional[bool] = Query(None, description="Filter products with video"),
    sort_by: Optional[str] = Query(None, description="Sort order"),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    
    if ids is not None and ids.strip():
        raw_uuid_list = []
        raw_str_list = []
        for raw_id in ids.split(","):
            raw_id_clean = raw_id.strip()
            if raw_id_clean:
                raw_str_list.append(raw_id_clean)
                try:
                    raw_uuid_list.append(UUID(raw_id_clean))
                except Exception:
                    pass
        matching_ids = raw_uuid_list if raw_uuid_list else raw_str_list
        if matching_ids:
            query = select(Product).where(Product.site_id == site_id, Product.id.in_(matching_ids))
        else:
            query = select(Product).where(Product.site_id == site_id, Product.id.is_(None))
        products = session.exec(query.order_by(Product.created_at.desc())).all()
    elif ids is not None:
        products = []
    else:
        all_site_prods = session.exec(select(Product).where(Product.site_id == site_id)).all()

        def is_prod_low_stock(p: Product) -> bool:
            if p.in_stock and p.stock is not None and 0 < p.stock <= 5:
                return True
            v_opt = getattr(p, "variant_option", None)
            if isinstance(v_opt, dict):
                opt_vals = v_opt.get("optionValues")
                if isinstance(opt_vals, list):
                    for v in opt_vals:
                        if isinstance(v, dict):
                            qty = v.get("stockQty")
                            if qty is not None:
                                try:
                                    if 0 < int(qty) <= 5:
                                        return True
                                except (ValueError, TypeError):
                                    pass
            return False

        def is_prod_in_stock(p: Product) -> bool:
            if p.in_stock and p.stock is not None and p.stock > 0:
                return True
            v_opt = getattr(p, "variant_option", None)
            if isinstance(v_opt, dict):
                opt_vals = v_opt.get("optionValues")
                if isinstance(opt_vals, list):
                    for v in opt_vals:
                        if isinstance(v, dict) and v.get("inStock"):
                            qty = v.get("stockQty")
                            if qty is None:
                                return True
                            try:
                                if int(qty) > 0:
                                    return True
                            except (ValueError, TypeError):
                                pass
            return False

        low_stock_ids = [p.id for p in all_site_prods if is_prod_low_stock(p)]
        in_stock_ids = [p.id for p in all_site_prods if is_prod_in_stock(p)]

        base_query = select(Product).where(Product.site_id == site_id)
        if status == "active":
            base_query = base_query.where(Product.is_active == True)
        elif status == "draft":
            base_query = base_query.where(Product.is_active == False)
        elif status == "in_stock":
            base_query = base_query.where(Product.id.in_(in_stock_ids) if in_stock_ids else False)
        elif status == "low_stock":
            base_query = base_query.where(Product.id.in_(low_stock_ids) if low_stock_ids else False)
        elif status == "out_of_stock":
            base_query = base_query.where(~Product.id.in_(in_stock_ids) if in_stock_ids else True)

        if category_id:
            base_query = base_query.where(Product.category_id == category_id)

        if collection_id:
            base_query = base_query.join(ProductCollection, ProductCollection.product_id == Product.id).where(ProductCollection.collection_id == collection_id)

        if brand and brand.strip():
            base_query = base_query.where(Product.brand.ilike(f"%{brand.strip()}%"))

        if min_price is not None:
            base_query = base_query.where(Product.price >= min_price)
        if max_price is not None:
            base_query = base_query.where(Product.price <= max_price)

        if has_discount is True:
            base_query = base_query.where(Product.compare_price.isnot(None), Product.compare_price > Product.price)
        elif has_discount is False:
            base_query = base_query.where((Product.compare_price.is_(None)) | (Product.compare_price <= Product.price))

        if return_policy == "non_returnable":
            base_query = base_query.where(Product.return_window_days == 0)
        elif return_policy == "returnable":
            base_query = base_query.where((Product.return_window_days.is_(None)) | (Product.return_window_days > 0))

        if has_video is True:
            base_query = base_query.where(Product.video_url.isnot(None), Product.video_url != "")
        elif has_video is False:
            base_query = base_query.where((Product.video_url.is_(None)) | (Product.video_url == ""))

        if search and search.strip():
            term = f"%{search.strip()}%"
            base_query = base_query.where(
                (Product.name.ilike(term))
                | (Product.brand.ilike(term))
                | (Product.category.ilike(term))
                | (Product.sku.ilike(term))
            )

        if sort_by == "price_asc":
            order_clause = Product.price.asc()
        elif sort_by == "price_desc":
            order_clause = Product.price.desc()
        elif sort_by == "stock_asc":
            order_clause = Product.stock.asc()
        elif sort_by == "stock_desc":
            order_clause = Product.stock.desc()
        elif sort_by == "name_asc":
            order_clause = Product.name.asc()
        elif sort_by == "name_desc":
            order_clause = Product.name.desc()
        elif sort_by == "oldest":
            order_clause = Product.created_at.asc()
        else:
            order_clause = Product.created_at.desc()

        products = session.exec(base_query.order_by(order_clause)).all()

    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Excel
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)

    for p in products:
        col_names = []
        assoc_rows = session.exec(
            select(ProductCollection).where(ProductCollection.product_id == p.id)
        ).all()
        for assoc in assoc_rows:
            col = session.get(Collection, assoc.collection_id)
            if col:
                col_names.append(col.name)

        var_name = ""
        var_values_str = ""
        if isinstance(p.variant_option, dict):
            var_name = p.variant_option.get("optionName", "")
            vals = p.variant_option.get("optionValues", [])
            val_strs = []
            for v in vals:
                v_name = v.get("value", "")
                v_price = v.get("price") or ""
                v_cmp = v.get("comparePrice") or ""
                v_stock = v.get("stockQty") if v.get("stockQty") is not None else ""
                val_strs.append(f"{v_name}:{v_price}:{v_cmp}:{v_stock}")
            var_values_str = "|".join(val_strs)

        hl_str = ""
        if isinstance(p.highlights, list):
            hl_str = "|".join(p.highlights)
        elif isinstance(p.highlights, str):
            hl_str = p.highlights

        imgs_str = ""
        if isinstance(p.images, list):
            imgs_str = " | ".join(heal_image_urls(p.images))

        writer.writerow([
            p.name or "",
            p.brand or "",
            p.category or "",
            float(p.price) if p.price is not None else "",
            float(p.compare_price) if p.compare_price is not None else "",
            p.stock or 0,
            "TRUE" if p.is_active else "FALSE",
            p.sku or "",
            p.hsn_code or "",
            getattr(p, "video_url", "") or "",
            getattr(p, "video_position", 2) or 2,
            getattr(p, "sibling_group", "") or "",
            getattr(p, "sibling_label", "") or "",
            getattr(p, "return_window_days", "") if getattr(p, "return_window_days", None) is not None else "",
            p.weight_grams or 500,
            float(p.length_cm) if p.length_cm is not None else "",
            float(p.width_cm) if p.width_cm is not None else "",
            float(p.height_cm) if p.height_cm is not None else "",
            hl_str,
            p.description or "",
            imgs_str,
            ", ".join(col_names),
            var_name,
            var_values_str,
        ])

    csv_data = output.getvalue().encode("utf-8")
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="products_{site_id}.csv"',
        },
    )


@router.get("/sample-csv")
def download_sample_csv(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)

    sample_rows = [
        [
            "Apple iPhone 15 Pro (Natural Titanium)",
            "Apple",
            "Smartphones",
            "119999",
            "134900",
            "20",
            "TRUE",
            "IPH15P-128-NAT",
            "85171300",
            "https://www.youtube.com/watch?v=xqyUdNxWazA",
            "2",
            "iphone-15-pro-series",
            "Natural Titanium",
            "7",
            "350",
            "14.6",
            "7.0",
            "0.8",
            "Aerospace-grade titanium design with textured matte glass back|6.1-inch Super Retina XDR display with ProMotion 120Hz|A17 Pro chip with 6-core GPU for next-gen mobile gaming|48MP Main camera with 3x Telephoto and optical image stabilization|Action button for quick access to favorite features|USB-C connector with USB 3 speeds",
            "## iPhone 15 Pro. Forged in titanium.\n\niPhone 15 Pro is the first iPhone to feature an aerospace‑grade titanium design, using the same alloy that spacecraft use for missions to Mars. Titanium has one of the best strength‑to‑weight ratios of any metal, making these our lightest Pro models ever.\n\n### Key Features\n- **A17 Pro Chip**: Next-generation graphics performance\n- **Pro Camera System**: 48MP Main with multiple focal lengths\n- **Customizable Action Button**: Fast shortcut to your favorite feature",
            "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=800&q=80",
            "Flagship, Electronics, Bestsellers",
            "Storage Capacity",
            "128GB:119999:134900:10|256GB:129999:144900:6|512GB:149999:164900:4",
        ],
        [
            "Apple iPhone 15 Pro (Blue Titanium)",
            "Apple",
            "Smartphones",
            "119999",
            "134900",
            "15",
            "TRUE",
            "IPH15P-128-BLU",
            "85171300",
            "https://www.youtube.com/watch?v=xqyUdNxWazA",
            "2",
            "iphone-15-pro-series",
            "Blue Titanium",
            "7",
            "350",
            "14.6",
            "7.0",
            "0.8",
            "Deep Blue Titanium finish with precision PVD coating|6.1-inch Super Retina XDR display with ProMotion 120Hz|A17 Pro chip with 6-core GPU for next-gen mobile gaming|48MP Main camera with 3x Telephoto and optical image stabilization|Action button for quick access to favorite features|USB-C connector with USB 3 speeds",
            "## iPhone 15 Pro in Blue Titanium.\n\nStunning deep blue finish crafted from aerospace-grade titanium with Ceramic Shield front and textured matte glass back.\n\n### In the Box\n- iPhone 15 Pro\n- USB-C Charge Cable (1 m)",
            "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=800&q=80",
            "Flagship, Electronics",
            "Storage Capacity",
            "128GB:119999:134900:8|256GB:129999:144900:5|512GB:149999:164900:2",
        ],
        [
            "Sony WH-1000XM5 Noise Canceling Wireless Headphones (Midnight Black)",
            "Sony",
            "Audio & Headphones",
            "29990",
            "34990",
            "30",
            "TRUE",
            "SNY-WH1000XM5-BLK",
            "85183000",
            "https://www.youtube.com/watch?v=MpkIdNf4o0Q",
            "2",
            "sony-wh1000xm5-series",
            "Midnight Black",
            "10",
            "250",
            "22.5",
            "18.5",
            "7.0",
            "Industry-leading Noise Canceling with two processors and 8 microphones|Magnificent sound engineered with precision 30mm carbon fiber driver unit|Crystal clear hands-free calling with 4 beamforming microphones|Up to 30-hour battery life with 3-minute quick charge for 3 hours playback|Ultra-comfortable lightweight design with soft fit leather headband|Multi-point connection allows switching seamlessly between two devices",
            "## Sony WH-1000XM5 Wireless Noise Cancelling Headphones\n\nThe WH-1000XM5 headphones rewrite the rules for distraction-free listening. Two processors control 8 microphones for unprecedented noise cancellation and exceptional call quality.\n\n### Specifications\n- **Driver Unit**: 30mm, dome type\n- **Battery Life**: Up to 30 hours (NC ON)\n- **Weight**: Approx. 250g\n\n### Package Contents\n- WH-1000XM5 Headphones\n- Collapsible Carrying Case\n- USB-A to USB-C Cable\n- 3.5mm Headphone Cable (1.2m)",
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
            "Audio Gear, Bestsellers, Premium",
            "Color Edition",
            "Midnight Black:29990:34990:18|Platinum Silver:29990:34990:12",
        ],
        [
            "Sony WH-1000XM5 Noise Canceling Wireless Headphones (Platinum Silver)",
            "Sony",
            "Audio & Headphones",
            "29990",
            "34990",
            "20",
            "TRUE",
            "SNY-WH1000XM5-SLV",
            "85183000",
            "https://www.youtube.com/watch?v=MpkIdNf4o0Q",
            "2",
            "sony-wh1000xm5-series",
            "Platinum Silver",
            "10",
            "250",
            "22.5",
            "18.5",
            "7.0",
            "Elegant Platinum Silver matte finish|Industry-leading Noise Canceling with Auto NC Optimizer|Ultra-clear hands-free calling with AI-based noise reduction|Up to 30-hour battery life with USB-PD rapid charging|Multipoint Bluetooth connection for two devices simultaneously",
            "## Sony WH-1000XM5 in Platinum Silver\n\nExperience sound purity in an exquisite platinum silver chassis with soft-fit leather cups.\n\n### In the Box\n- WH-1000XM5 Headphones\n- Premium Carrying Case\n- USB-C Cable & 3.5mm Audio Cable",
            "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
            "Audio Gear, Premium",
            "Color Edition",
            "Platinum Silver:29990:34990:20",
        ],
        [
            "Heritage Biker Full-Grain Leather Jacket (Vintage Tan)",
            "WebCreon Atelier",
            "Men's Apparel",
            "8499",
            "12999",
            "45",
            "TRUE",
            "WCA-JKT-TAN-M",
            "62019000",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "2",
            "heritage-leather-jacket-group",
            "Vintage Tan",
            "14",
            "1200",
            "45.0",
            "35.0",
            "5.0",
            "100% Handcrafted Full-Grain Cowhide Leather|YKK Antique Brass Heavy Duty Zippers|Quilted Thermal Diamond Inner Lining for maximum comfort|Two zippered chest pockets and two hand warmer side pockets|Adjustable waist buckle straps for tailored fit|Ages gracefully developing a unique vintage patina over time",
            "## Heritage Biker Leather Jacket\n\nCrafted with meticulous attention to detail, this jacket combines rugged biker aesthetics with refined luxury craftsmanship. Made from hand-selected full-grain cowhide that breaks in naturally to your body.\n\n### Care Instructions\n- Professional leather clean only\n- Store on a wide wooden hanger in a cool, dry place",
            "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
            "Winter Collection, Bestsellers, Apparel",
            "Size",
            "S:8499:12999:10|M:8499:12999:15|L:8499:12999:12|XL:8999:13999:8",
        ],
        [
            "Heritage Biker Full-Grain Leather Jacket (Obsidian Black)",
            "WebCreon Atelier",
            "Men's Apparel",
            "8499",
            "12999",
            "35",
            "TRUE",
            "WCA-JKT-BLK-M",
            "62019000",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "2",
            "heritage-leather-jacket-group",
            "Obsidian Black",
            "14",
            "1200",
            "45.0",
            "35.0",
            "5.0",
            "100% Genuine Full-Grain Matte Black Leather|Heavy-duty gunmetal hardware and YKK zippers|Thermal diamond quilted lining with dual interior pockets|Snap-button mandarin collar and zippered cuffs",
            "## Heritage Biker Leather Jacket in Obsidian Black\n\nTimeless black silhouette designed for urban adventures and cross-country rides.\n\n### Highlights\n- Supple full-grain cowhide leather\n- Gunmetal brass YKK hardware\n- Tailored athletic cut",
            "https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
            "Winter Collection, Apparel",
            "Size",
            "S:8499:12999:8|M:8499:12999:12|L:8499:12999:10|XL:8999:13999:5",
        ],
        [
            "Artisan Matte Ceramic Pour-Over Coffee Dripper Set",
            "BrewCraft Studios",
            "Kitchen & Home",
            "1499",
            "1999",
            "60",
            "TRUE",
            "BC-PO-SET-TERRA",
            "69120000",
            "https://www.youtube.com/watch?v=1u4j90iOqZk",
            "2",
            "artisan-pourover-set-group",
            "Terracotta Matte",
            "7",
            "680",
            "18.0",
            "14.0",
            "14.0",
            "Hand-thrown durable stoneware ceramic with matte glaze|Internal 60-degree spiral ribs ensure optimal extraction rate|Heat-resistant ergonomic wooden collar and acacia coaster|Includes 50 unbleached natural cone paper filters|Dishwasher safe and BPA-free food-grade construction",
            "## Elevate Your Morning Coffee Ritual\n\nThe BrewCraft Pour-Over Dripper combines Japanese minimalist design with precision extraction geometry for a clean, sweet cup every brew.\n\n### Set Includes\n- 1x Ceramic Cone Dripper (Size 02)\n- 1x Acacia Wood Dripper Stand\n- 1x 600ml Borosilicate Glass Carafe\n- 50x Natural Filter Papers",
            "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80",
            "Coffee Gear, Home & Living, New Arrivals",
            "Finish & Color",
            "Terracotta Matte:1499:1999:25|Nordic White:1499:1999:20|Charcoal Slate:1499:1999:15",
        ],
        [
            "Keychron Q1 Pro Wireless Custom Mechanical Keyboard",
            "Keychron",
            "Computer Accessories",
            "14999",
            "17999",
            "25",
            "TRUE",
            "KCH-Q1PRO-KPRO-RED",
            "84716040",
            "https://www.youtube.com/watch?v=F0bY1iB5zS8",
            "2",
            "keychron-q1-pro-group",
            "Carbon Black / Red Switches",
            "10",
            "1850",
            "32.7",
            "14.5",
            "4.5",
            "Full CNC Machined 6063 Aluminum Body with double-gasket mount design|Wireless Bluetooth 5.1 & Type-C wired connectivity with Mac & Windows support|Hot-swappable PCB compatible with 3-pin and 5-pin MX mechanical switches|South-facing RGB backlighting with 22 dynamic lighting effects|QMK/VIA programmable macro knob and key remapping support|4000mAh high-capacity battery for up to 300 hours non-backlit usage",
            "## Keychron Q1 Pro QMK/VIA Wireless Custom Mechanical Keyboard\n\nThe Q1 Pro is a groundbreaking full-metal wireless custom mechanical keyboard. Along with our signature customizable features and upgraded acoustic foam, the Q1 Pro is designed for unrivaled typing comfort and ultimate productivity.\n\n### Package Contains\n- Fully Assembled Keyboard with Aluminum Case\n- Type-C to Type-C Cable + Type-A Adapter\n- Keycap & Switch Puller Tool\n- Hex Key & Screwdriver",
            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1601445638532-3c6f6c322df6?auto=format&fit=crop&w=800&q=80 | https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
            "Computer Gear, Electronics, Premium, Work From Home",
            "Switch Type",
            "K Pro Red (Linear):14999:17999:10|K Pro Brown (Tactile):14999:17999:10|K Pro Banana (Early Bump):15499:18499:5",
        ],
    ]

    for r in sample_rows:
        writer.writerow(r)

    csv_data = output.getvalue().encode("utf-8")
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="sample_products_template.csv"',
        },
    )


class BulkProductActionRequest(BaseModel):
    product_ids: list[UUID]
    action: str  # "activate", "deactivate", "delete"


@router.post("/bulk-action")
def bulk_product_action(
    site_id: UUID,
    payload: BulkProductActionRequest,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    if not payload.product_ids:
        return {"success": True, "count": 0}

    if payload.action in {"activate", "make_active", "publish", "active"}:
        products = session.exec(
            select(Product).where(
                Product.site_id == site_id,
                Product.id.in_(payload.product_ids),
            )
        ).all()
        for p in products:
            p.is_active = True
        session.add_all(products)
        session.commit()
        catalog_cache.invalidate_site(site_id)
        return {"success": True, "count": len(products), "action": "activate"}

    elif payload.action in {"deactivate", "make_draft", "unpublish", "draft"}:
        products = session.exec(
            select(Product).where(
                Product.site_id == site_id,
                Product.id.in_(payload.product_ids),
            )
        ).all()
        for p in products:
            p.is_active = False
        session.add_all(products)
        session.commit()
        catalog_cache.invalidate_site(site_id)
        return {"success": True, "count": len(products), "action": "deactivate"}

    elif payload.action in {"duplicate", "copy"}:
        products = session.exec(
            select(Product).where(
                Product.site_id == site_id,
                Product.id.in_(payload.product_ids),
            )
        ).all()
        cloned_count = 0
        for product in products:
            cloned_product = Product(
                site_id=site_id,
                name=f"{product.name} (Copy)",
                brand=product.brand,
                category=product.category,
                category_id=product.category_id,
                description=product.description,
                price=product.price,
                compare_price=product.compare_price,
                stock=product.stock,
                in_stock=product.in_stock,
                is_active=False,
                sku=f"{product.sku}-COPY" if product.sku else None,
                hsn_code=product.hsn_code,
                video_url=product.video_url,
                video_position=getattr(product, "video_position", 2),
                sibling_group=getattr(product, "sibling_group", None),
                sibling_label=f"{product.sibling_label} (Copy)" if getattr(product, "sibling_label", None) else None,
                weight_grams=product.weight_grams,
                length_cm=product.length_cm,
                width_cm=product.width_cm,
                height_cm=product.height_cm,
                highlights=deepcopy(product.highlights) if product.highlights else [],
                images=deepcopy(product.images) if product.images else [],
                variant_option=deepcopy(product.variant_option) if product.variant_option else None,
                return_window_days=product.return_window_days,
            )
            session.add(cloned_product)
            session.flush()

            assoc_rows = session.exec(
                select(ProductCollection).where(
                    ProductCollection.product_id == product.id
                )
            ).all()
            for assoc in assoc_rows:
                session.add(
                    ProductCollection(
                        product_id=cloned_product.id,
                        collection_id=assoc.collection_id,
                    )
                )
            cloned_count += 1

        session.commit()
        catalog_cache.invalidate_site(site_id)
        return {"success": True, "count": cloned_count, "action": "duplicate"}

    elif payload.action == "delete":
        # 1. Fetch matching products belonging to this site
        products = session.exec(
            select(Product).where(
                Product.site_id == site_id,
                Product.id.in_(payload.product_ids),
            )
        ).all()
        if not products:
            return {"success": True, "count": 0, "action": "delete"}

        target_ids = [p.id for p in products]

        # 2. Clean up transient cart items containing these products
        session.exec(
            delete(CartItem).where(CartItem.product_id.in_(target_ids))
        )

        # 3. Clean up product collections junction
        session.exec(
            delete(ProductCollection).where(
                ProductCollection.product_id.in_(target_ids)
            )
        )

        # 4. Clean up product reviews
        session.exec(
            delete(ProductReview).where(
                ProductReview.product_id.in_(target_ids)
            )
        )

        # 5. Nullify historical order references to preserve order records without FK blocks
        session.exec(
            update(OrderItem).where(OrderItem.product_id.in_(target_ids)).values(product_id=None)
        )
        session.exec(
            update(ReturnItem).where(ReturnItem.product_id.in_(target_ids)).values(product_id=None)
        )
        session.exec(
            update(InventoryMovement).where(InventoryMovement.product_id.in_(target_ids)).values(product_id=None)
        )

        # 6. Delete products
        for p in products:
            session.delete(p)
        session.commit()
        catalog_cache.invalidate_site(site_id)
        return {"success": True, "count": len(products), "action": "delete"}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action '{payload.action}'")


@router.post("/import-csv")
async def import_products_csv(
    site_id: UUID,
    file: UploadFile = File(...),
    default_status: str = Form("draft"),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum CSV size is 25MB (~50,000 products).")

    try:
        text_content = content.decode("utf-8-sig", errors="replace")
    except Exception:
        text_content = content.decode("latin1", errors="replace")

    reader = csv.DictReader(io.StringIO(text_content))
    raw_rows = list(reader)
    if not raw_rows:
        return {"success": True, "created_count": 0, "errors": []}

    errors: list[dict[str, Any]] = []

    # 1. Pre-fetch existing Categories, Collections & Products
    existing_categories = session.exec(select(Category).where(Category.site_id == site_id)).all()
    cat_map = {c.name.strip().lower(): c for c in existing_categories}

    existing_collections = session.exec(select(Collection).where(Collection.site_id == site_id)).all()
    col_map = {c.name.strip().lower(): c for c in existing_collections}

    existing_products = session.exec(select(Product).where(Product.site_id == site_id)).all()
    sku_map: dict[str, Product] = {p.sku.strip().lower(): p for p in existing_products if p.sku}
    name_map: dict[str, Product] = {p.name.strip().lower(): p for p in existing_products if p.name}

    # Pre-fetch existing product-collection associations to prevent duplicates
    existing_assocs = session.exec(
        select(ProductCollection).where(
            ProductCollection.product_id.in_([p.id for p in existing_products])
        )
    ).all() if existing_products else []
    seen_assocs: set[tuple[UUID, UUID]] = {(a.product_id, a.collection_id) for a in existing_assocs}

    # 2. Collect unique missing categories & collections in ONE pre-pass
    new_categories_to_add: dict[str, Category] = {}
    new_collections_to_add: dict[str, Collection] = {}

    for row in raw_rows:
        cat_name = (row.get("category") or "General").strip()
        if cat_name:
            cat_key = cat_name.lower()
            if cat_key not in cat_map and cat_key not in new_categories_to_add:
                new_cat = Category(site_id=site_id, name=cat_name, slug=make_slug(cat_name))
                new_categories_to_add[cat_key] = new_cat

        col_raw = (row.get("collections") or "").strip()
        if col_raw:
            for c_name in col_raw.split(","):
                c_clean = c_name.strip()
                if c_clean:
                    c_key = c_clean.lower()
                    if c_key not in col_map and c_key not in new_collections_to_add:
                        new_col = Collection(site_id=site_id, name=c_clean, slug=make_slug(c_clean))
                        new_collections_to_add[c_key] = new_col

    # Batch insert new categories and collections in 1 transaction
    if new_categories_to_add:
        session.add_all(list(new_categories_to_add.values()))
    if new_collections_to_add:
        session.add_all(list(new_collections_to_add.values()))
    if new_categories_to_add or new_collections_to_add:
        session.commit()
        for k, v in new_categories_to_add.items():
            session.refresh(v)
            cat_map[k] = v
        for k, v in new_collections_to_add.items():
            session.refresh(v)
            col_map[k] = v

    # 3. Process Products in Enterprise Chunks (CHUNK_SIZE = 250)
    CHUNK_SIZE = 250
    created_count = 0
    updated_count = 0
    product_chunk: list[Product] = []
    assoc_chunk: list[ProductCollection] = []

    def commit_chunk():
        nonlocal product_chunk, assoc_chunk
        if not product_chunk:
            return
        try:
            session.add_all(product_chunk)
            if assoc_chunk:
                session.add_all(assoc_chunk)
            session.commit()
        except Exception as e:
            session.rollback()
            errors.append({"row": 0, "error": f"Batch transaction error: {str(e)}"})
        finally:
            product_chunk = []
            assoc_chunk = []

    row_index = 1
    for row in raw_rows:
        row_index += 1
        name = (row.get("name") or "").strip()
        if not name:
            errors.append({"row": row_index, "error": "Missing required 'name' column."})
            continue

        price_str = (row.get("price") or "").strip()
        try:
            price = Decimal(price_str)
            if price <= 0:
                raise ValueError("Price must be greater than zero")
        except Exception:
            errors.append({"row": row_index, "error": f"Invalid price '{price_str}'. Must be a positive number."})
            continue

        compare_price_str = (row.get("compare_price") or "").strip()
        compare_price = None
        if compare_price_str:
            try:
                cmp_val = Decimal(compare_price_str)
                if cmp_val >= price:
                    compare_price = cmp_val
            except Exception:
                pass

        stock_str = (row.get("stock") or "").strip()
        stock = 0
        try:
            stock = max(0, int(stock_str))
        except Exception:
            stock = 0

        cat_name = (row.get("category") or "General").strip()
        cat_key = cat_name.lower()
        cat_obj = cat_map.get(cat_key)

        if default_status == "draft":
            is_active = False
        elif default_status == "active":
            is_active = True
        else:
            is_active_val = (row.get("is_active") or "true").strip().lower()
            is_active = is_active_val in {"true", "1", "yes", "active"}

        hl_raw = (row.get("highlights") or "").strip()
        highlights_list: list[str] = []
        if hl_raw:
            if "|" in hl_raw:
                highlights_list = [h.strip() for h in hl_raw.split("|") if h.strip()]
            else:
                highlights_list = [h.strip() for h in hl_raw.split("\n") if h.strip()]

        img_raw = (row.get("images") or "").strip()
        images_list: list[str] = []
        if img_raw:
            if "|" in img_raw:
                raw_splits = [u.strip() for u in img_raw.split("|") if u.strip()]
            elif "\n" in img_raw:
                raw_splits = [u.strip() for u in img_raw.split("\n") if u.strip()]
            else:
                found_urls = re.findall(r"https?://\S+", img_raw)
                if found_urls:
                    raw_splits = [u.rstrip(",;") for u in found_urls if u.strip()]
                else:
                    raw_splits = [u.strip() for u in img_raw.split(",") if u.strip()]
            images_list = heal_image_urls(raw_splits)

        var_name = (row.get("variant_option_name") or "").strip()
        var_vals_raw = (row.get("variant_values") or "").strip()
        variant_option = None
        if var_name and var_vals_raw:
            opt_vals = []
            for item in var_vals_raw.split("|"):
                parts = [p.strip() for p in item.split(":")]
                if parts and parts[0]:
                    v_val = parts[0]
                    v_p = None
                    v_cmp = None
                    v_stk = None
                    if len(parts) > 1 and parts[1]:
                        try:
                            v_p = float(parts[1])
                        except Exception:
                            pass
                    if len(parts) > 2 and parts[2]:
                        try:
                            v_cmp = float(parts[2])
                        except Exception:
                            pass
                    if len(parts) > 3 and parts[3]:
                        try:
                            v_stk = int(parts[3])
                        except Exception:
                            pass
                    opt_vals.append({
                        "value": v_val,
                        "price": v_p if v_p is not None else float(price),
                        "comparePrice": v_cmp,
                        "stockQty": v_stk if v_stk is not None else stock,
                        "inStock": (v_stk or stock) > 0,
                    })
            if opt_vals:
                variant_option = {
                    "optionType": "custom",
                    "optionName": var_name,
                    "optionValues": opt_vals,
                }

        weight_grams = 500
        try:
            weight_grams = int(float(row.get("weight_grams") or 500))
        except Exception:
            weight_grams = 500

        length_cm = None
        try:
            if row.get("length_cm"):
                length_cm = float(row.get("length_cm"))
        except Exception:
            pass

        width_cm = None
        try:
            if row.get("width_cm"):
                width_cm = float(row.get("width_cm"))
        except Exception:
            pass

        height_cm = None
        try:
            if row.get("height_cm"):
                height_cm = float(row.get("height_cm"))
        except Exception:
            pass

        row_sku = (row.get("sku") or "").strip()
        row_sibling_group = (row.get("sibling_group") or "").strip() or None
        row_sibling_label = (row.get("sibling_label") or "").strip() or None
        row_video_url = (row.get("video_url") or "").strip() or None
        row_video_pos = 2
        try:
            if row.get("video_position"):
                row_video_pos = int(row.get("video_position"))
        except Exception:
            row_video_pos = 2

        row_return_window = None
        try:
            rw_val = row.get("return_window_days")
            if rw_val is not None and str(rw_val).strip() != "":
                row_return_window = int(str(rw_val).strip())
        except Exception:
            row_return_window = None

        # Check for existing product match (Duplicate Detection & Upsert)
        existing_p: Optional[Product] = None
        if row_sku and row_sku.lower() in sku_map:
            existing_p = sku_map[row_sku.lower()]
        elif name.lower() in name_map:
            existing_p = name_map[name.lower()]

        if existing_p:
            # Update existing product
            existing_p.name = name
            existing_p.brand = (row.get("brand") or "").strip() or existing_p.brand
            existing_p.category = cat_obj.name if cat_obj else cat_name
            existing_p.category_id = cat_obj.id if cat_obj else existing_p.category_id
            if (row.get("description") or "").strip():
                existing_p.description = (row.get("description") or "").strip()
            existing_p.price = price
            if compare_price is not None:
                existing_p.compare_price = compare_price
            existing_p.stock = stock
            existing_p.in_stock = stock > 0
            existing_p.is_active = is_active
            if row_sku:
                existing_p.sku = row_sku
            if (row.get("hsn_code") or "").strip():
                existing_p.hsn_code = (row.get("hsn_code") or "").strip()
            if row_sibling_group is not None:
                existing_p.sibling_group = row_sibling_group
            if row_sibling_label is not None:
                existing_p.sibling_label = row_sibling_label
            if row_video_url is not None:
                existing_p.video_url = row_video_url
            existing_p.video_position = row_video_pos
            if row_return_window is not None:
                existing_p.return_window_days = row_return_window
            existing_p.weight_grams = weight_grams
            if length_cm is not None:
                existing_p.length_cm = length_cm
            if width_cm is not None:
                existing_p.width_cm = width_cm
            if height_cm is not None:
                existing_p.height_cm = height_cm
            if highlights_list:
                existing_p.highlights = highlights_list
            if images_list:
                existing_p.images = images_list
            if variant_option:
                existing_p.variant_option = variant_option

            prod_id = existing_p.id
            product_chunk.append(existing_p)
            updated_count += 1
        else:
            # Create new product
            prod_id = uuid4()
            new_product = Product(
                id=prod_id,
                site_id=site_id,
                name=name,
                slug=make_slug(name),
                brand=(row.get("brand") or "").strip() or None,
                category=cat_obj.name if cat_obj else cat_name,
                category_id=cat_obj.id if cat_obj else None,
                description=(row.get("description") or "").strip(),
                price=price,
                compare_price=compare_price,
                stock=stock,
                in_stock=stock > 0,
                is_active=is_active,
                sku=row_sku or None,
                hsn_code=(row.get("hsn_code") or "").strip() or None,
                video_url=row_video_url,
                video_position=row_video_pos,
                sibling_group=row_sibling_group,
                sibling_label=row_sibling_label,
                return_window_days=row_return_window,
                weight_grams=weight_grams,
                length_cm=length_cm,
                width_cm=width_cm,
                height_cm=height_cm,
                highlights=highlights_list,
                images=images_list,
                variant_option=variant_option,
            )
            product_chunk.append(new_product)
            if row_sku:
                sku_map[row_sku.lower()] = new_product
            name_map[name.lower()] = new_product
            created_count += 1

        # Build associations using pre-assigned/existing prod_id
        col_raw = (row.get("collections") or "").strip()
        if col_raw:
            for c_name in col_raw.split(","):
                c_clean = c_name.strip()
                if c_clean:
                    col_obj = col_map.get(c_clean.lower())
                    if col_obj:
                        assoc_key = (prod_id, col_obj.id)
                        if assoc_key not in seen_assocs:
                            seen_assocs.add(assoc_key)
                            assoc_chunk.append(
                                ProductCollection(product_id=prod_id, collection_id=col_obj.id)
                            )

        if len(product_chunk) >= CHUNK_SIZE:
            commit_chunk()

    # Commit any remaining items in final chunk
    commit_chunk()
    catalog_cache.invalidate_site(site_id)

    return {
        "success": True,
        "created_count": created_count,
        "updated_count": updated_count,
        "errors": errors,
    }


@router.get("/{product_id}", response_model=ProductResponse)
def get_product_detail(
    site_id: UUID,
    product_id: UUID,
    session: Session = Depends(get_session),
):
    cache_key = f"site:{str(site_id)}:product:{str(product_id)}"
    cached = catalog_cache.get(cache_key)
    if cached is not None:
        return cached

    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)
    res = to_product_response(product, session, include_reviews=True)
    catalog_cache.set(cache_key, res, ttl=60.0)
    return res


@router.get("/{product_id}/reviews")
def list_product_reviews(
    site_id: UUID,
    product_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)

    # High-speed RAM cache lookup for reviews
    cache_key = f"site:{str(site_id)}:product:{str(product.id)}:reviews:{page}:{page_size}"
    cached = catalog_cache.get(cache_key)
    if cached is not None:
        return cached

    offset = (page - 1) * page_size
    reviews = get_product_reviews(
        session, site_id, product.id, product.sibling_group, limit=page_size, offset=offset
    )
    avg_rating, total_count = get_product_rating_summary(
        session, site_id, product.id, product.sibling_group
    )

    result = {
        "reviews": reviews,
        "total_count": total_count,
        "average_rating": avg_rating,
        "page": page,
        "page_size": page_size,
        "has_more": (offset + len(reviews)) < total_count,
    }
    catalog_cache.set(cache_key, result, ttl=120.0)
    return result


@router.post("/upload-image", response_model=UploadImageResponse)
async def upload_product_image(
    site_id: UUID,
    file: UploadFile = File(...),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Allowed: PNG, JPEG, JPG, WEBP",
        )

    extension = Path(file.filename or "image").suffix.lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file uploaded")

    filename = save_optimized_upload_image(content, PRODUCT_UPLOADS_DIR, extension)

    return UploadImageResponse(
        url=f"/uploads/products/{filename}",
        filename=filename,
    )


@router.post("/upload-review-image", response_model=ReviewImageUploadResponse)
async def upload_review_image(
    site_id: UUID,
    file: UploadFile = File(...),
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Allowed: PNG, JPEG, JPG, WEBP",
        )

    extension = Path(file.filename or "image").suffix.lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file uploaded")

    filename = save_optimized_upload_image(content, REVIEW_UPLOADS_DIR, extension)

    return ReviewImageUploadResponse(
        url=f"/uploads/product-reviews/{filename}",
        filename=filename,
    )


@router.post("/reviews")
def create_product_review(
    site_id: UUID,
    payload: ProductReviewCreate,
    user=Depends(authenticate_customer),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if str(site_id) != user["siteId"]:
        raise HTTPException(status_code=403, detail="Customer token does not match requested site")

    customer = get_customer_for_site_or_404(session, site_id, UUID(user["userId"]))
    product = get_site_product_or_404(session, site_id, payload.product_id)

    order_item = session.exec(
        select(OrderItem, Order)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            OrderItem.id == payload.order_item_id,
            OrderItem.product_id == product.id,
            Order.site_id == site_id,
            Order.customer_id == customer.id,
            OrderItem.status == "delivered",
        )
    ).first()

    if not order_item:
        raise HTTPException(status_code=400, detail="You can only review a product you have purchased and received")

    existing_review = session.exec(
        select(ProductReview).where(ProductReview.order_item_id == payload.order_item_id)
    ).first()

    if existing_review:
        raise HTTPException(status_code=400, detail="This order item has already been reviewed")

    order_item_row, order_row = order_item

    review = ProductReview(
        site_id=site_id,
        product_id=product.id,
        customer_id=customer.id,
        order_id=order_row.id,
        order_item_id=order_item_row.id,
        rating=payload.rating,
        review_text=payload.review_text,
        review_images=payload.review_images,
    )

    session.add(review)
    session.commit()
    session.refresh(review)

    catalog_cache.invalidate_site(site_id)

    average_rating, review_count = get_product_review_summary(session, site_id, product.id)

    return {
        "message": "Review submitted successfully",
        "review": serialize_review(review, customer_name=customer.name or customer.email or "Customer"),
        "average_rating": average_rating,
        "review_count": review_count,
    }


def sync_product_collections(
    session: Session, product_id: UUID, collection_ids: list[UUID]
) -> None:
    """Replace all collection associations for a product."""
    existing = session.exec(
        select(ProductCollection).where(ProductCollection.product_id == product_id)
    ).all()
    for pc in existing:
        session.delete(pc)
    session.flush()

    for cid in collection_ids:
        session.add(ProductCollection(product_id=product_id, collection_id=cid))


class MultiUploadImageResponse(BaseModel):
    urls: list[str]
    filenames: list[str]


@router.post("/upload-images", response_model=MultiUploadImageResponse)
async def upload_product_images(
    site_id: UUID,
    files: list[UploadFile] = File(...),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    urls = []
    filenames = []
    for file in files:
        if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_TYPES:
            continue
        extension = Path(file.filename or "image").suffix.lower()
        content = await file.read()
        if not content:
            continue
        filename = save_optimized_upload_image(content, PRODUCT_UPLOADS_DIR, extension)
        urls.append(f"/uploads/products/{filename}")
        filenames.append(filename)

    return MultiUploadImageResponse(urls=urls, filenames=filenames)


@router.post("", response_model=ProductResponse)
def create_product(
    site_id: UUID,
    product_in: ProductCreate,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    slug_value = product_in.slug or make_slug(product_in.name)

    product = Product(
        site_id=site_id,
        name=product_in.name,
        brand=product_in.brand,
        category=product_in.category,
        category_id=product_in.category_id,
        description=product_in.description,
        slug=slug_value,
        price=product_in.price,
        compare_price=product_in.compare_price,
        stock=product_in.stock,
        in_stock=product_in.in_stock,
        is_active=product_in.is_active,
        sku=product_in.sku,
        hsn_code=product_in.hsn_code,
        video_url=product_in.video_url,
        video_position=product_in.video_position if product_in.video_position is not None else 2,
        sibling_group=product_in.sibling_group,
        sibling_label=product_in.sibling_label,
        weight_grams=product_in.weight_grams,
        length_cm=Decimal(str(product_in.length_cm)) if product_in.length_cm is not None else None,
        width_cm=Decimal(str(product_in.width_cm)) if product_in.width_cm is not None else None,
        height_cm=Decimal(str(product_in.height_cm)) if product_in.height_cm is not None else None,
        return_window_days=product_in.return_window_days,
        images=product_in.images,
        highlights=product_in.highlights or [],
        variant_option=(
            json_safe(product_in.variant_option.model_dump())
            if product_in.variant_option
            else None
        ),
    )

    session.add(product)
    session.flush()

    if product_in.collection_ids:
        sync_product_collections(session, product.id, product_in.collection_ids)

    session.commit()
    session.refresh(product)
    catalog_cache.invalidate_site(site_id)
    return to_product_response(product, session)


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
    product.brand = product_in.brand
    product.category = product_in.category
    product.category_id = product_in.category_id
    product.description = product_in.description
    product.highlights = product_in.highlights or []
    product.slug = product_in.slug or make_slug(product_in.name)
    product.price = product_in.price
    product.compare_price = product_in.compare_price
    product.stock = product_in.stock
    product.in_stock = product_in.in_stock
    product.is_active = product_in.is_active
    product.sku = product_in.sku
    product.hsn_code = product_in.hsn_code
    product.video_url = product_in.video_url
    product.video_position = product_in.video_position if product_in.video_position is not None else 2
    product.sibling_group = product_in.sibling_group
    product.sibling_label = product_in.sibling_label
    product.weight_grams = product_in.weight_grams
    product.length_cm = Decimal(str(product_in.length_cm)) if product_in.length_cm is not None else None
    product.width_cm = Decimal(str(product_in.width_cm)) if product_in.width_cm is not None else None
    product.height_cm = Decimal(str(product_in.height_cm)) if product_in.height_cm is not None else None
    product.return_window_days = product_in.return_window_days
    product.images = product_in.images
    product.variant_option = (
        json_safe(product_in.variant_option.model_dump())
        if product_in.variant_option
        else None
    )

    sync_product_collections(session, product.id, product_in.collection_ids)

    session.add(product)
    session.commit()
    session.refresh(product)
    catalog_cache.invalidate_site(site_id)
    return to_product_response(product, session)


def chunk_list(items: list, chunk_size: int = 250):
    """Yield successive chunk_size chunks from items."""
    for i in range(0, len(items), chunk_size):
        yield items[i : i + chunk_size]


@router.post("/bulk-action")
def bulk_action_products(
    site_id: UUID,
    payload: BulkProductActionRequest,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    if not payload.product_ids:
        raise HTTPException(status_code=400, detail="No product IDs provided")

    action = payload.action.strip().lower()
    if action not in {"make_active", "make_draft", "delete"}:
        raise HTTPException(status_code=400, detail="Invalid bulk action")

    parsed_ids: list[UUID] = []
    for pid in payload.product_ids:
        if isinstance(pid, UUID):
            parsed_ids.append(pid)
        else:
            try:
                parsed_ids.append(UUID(str(pid).strip()))
            except Exception:
                pass

    if not parsed_ids:
        raise HTTPException(status_code=400, detail="No valid product IDs provided")

    # Deduplicate product IDs while preserving order
    unique_ids = list(dict.fromkeys(parsed_ids))

    # Industry Standard: Chunked set-based batch operations (250 IDs per batch)
    CHUNK_SIZE = 250
    affected_count = 0

    try:
        if action == "make_active":
            for chunk in chunk_list(unique_ids, CHUNK_SIZE):
                stmt = (
                    update(Product)
                    .where(Product.site_id == site_id, Product.id.in_(chunk))
                    .values(is_active=True)
                )
                result = session.exec(stmt)
                affected_count += getattr(result, "rowcount", len(chunk))
        elif action == "make_draft":
            for chunk in chunk_list(unique_ids, CHUNK_SIZE):
                stmt = (
                    update(Product)
                    .where(Product.site_id == site_id, Product.id.in_(chunk))
                    .values(is_active=False)
                )
                result = session.exec(stmt)
                affected_count += getattr(result, "rowcount", len(chunk))
        elif action == "delete":
            for chunk in chunk_list(unique_ids, CHUNK_SIZE):
                # 1. Delete transient cart items containing these products
                session.exec(
                    delete(CartItem)
                    .where(CartItem.product_id.in_(chunk))
                )
                # 2. Bulk delete junction associations first
                session.exec(
                    delete(ProductCollection)
                    .where(ProductCollection.product_id.in_(chunk))
                )
                # 3. Bulk delete reviews
                session.exec(
                    delete(ProductReview)
                    .where(ProductReview.product_id.in_(chunk))
                )
                # 4. Nullify historical order references to preserve order history without foreign key blocks
                session.exec(
                    update(OrderItem)
                    .where(OrderItem.product_id.in_(chunk))
                    .values(product_id=None)
                )
                session.exec(
                    update(ReturnItem)
                    .where(ReturnItem.product_id.in_(chunk))
                    .values(product_id=None)
                )
                session.exec(
                    update(InventoryMovement)
                    .where(InventoryMovement.product_id.in_(chunk))
                    .values(product_id=None)
                )
                # 5. Bulk delete products scoped to the site
                stmt = (
                    delete(Product)
                    .where(Product.site_id == site_id, Product.id.in_(chunk))
                )
                result = session.exec(stmt)
                affected_count += getattr(result, "rowcount", len(chunk))

        session.commit()
        catalog_cache.invalidate_site(site_id)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk action failed: {str(e)}")

    return {
        "success": True,
        "action": action,
        "affected_count": affected_count,
        "batch_size": CHUNK_SIZE,
    }


@router.patch("/{product_id}/quick-edit", response_model=ProductResponse)
def quick_edit_product(
    site_id: UUID,
    product_id: UUID,
    payload: ProductQuickEdit,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)
    if payload.price is not None:
        product.price = payload.price
    if payload.compare_price is not None:
        product.compare_price = payload.compare_price
    if payload.stock is not None:
        product.stock = payload.stock
        if payload.stock > 0:
            product.in_stock = True
        elif payload.stock == 0:
            product.in_stock = False
    if payload.in_stock is not None:
        product.in_stock = payload.in_stock
    if payload.is_active is not None:
        product.is_active = payload.is_active

    if payload.variant_option is not None:
        product.variant_option = json_safe(payload.variant_option)
        option_values = product.variant_option.get("optionValues", []) if isinstance(product.variant_option, dict) else []
        if option_values:
            total_stock = 0
            min_price = None
            for v in option_values:
                qty = v.get("stockQty")
                if qty is not None:
                    total_stock += int(qty)
                p = v.get("price")
                if p is not None:
                    try:
                        p_val = Decimal(str(p))
                        if min_price is None or p_val < min_price:
                            min_price = p_val
                    except Exception:
                        pass
            product.stock = total_stock
            product.in_stock = total_stock > 0
            if min_price is not None and min_price > 0:
                product.price = min_price

    session.add(product)
    session.commit()
    session.refresh(product)
    catalog_cache.invalidate_site(site_id)
    return to_product_response(product, session)


@router.delete("/{product_id}", status_code=204)
def delete_product(
    site_id: UUID,
    product_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)

    # 1. Clean up transient cart items containing this product
    session.exec(delete(CartItem).where(CartItem.product_id == product_id))

    # 2. Clean up product collections / category associations
    session.exec(delete(ProductCollection).where(ProductCollection.product_id == product_id))

    # 3. Clean up product reviews
    session.exec(delete(ProductReview).where(ProductReview.product_id == product_id))

    # 4. Nullify historical order references to preserve order records without FK blocks
    session.exec(
        update(OrderItem).where(OrderItem.product_id == product_id).values(product_id=None)
    )
    session.exec(
        update(ReturnItem).where(ReturnItem.product_id == product_id).values(product_id=None)
    )
    session.exec(
        update(InventoryMovement).where(InventoryMovement.product_id == product_id).values(product_id=None)
    )

    # 5. Delete the product itself
    session.delete(product)
    session.commit()
    catalog_cache.invalidate_site(site_id)
    return


@router.post("/{product_id}/duplicate", response_model=ProductResponse)
def duplicate_product(
    site_id: UUID,
    product_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)

    cloned_product = Product(
        site_id=site_id,
        name=f"{product.name} (Copy)",
        brand=product.brand,
        category=product.category,
        category_id=product.category_id,
        description=product.description,
        price=product.price,
        compare_price=product.compare_price,
        stock=product.stock,
        in_stock=product.in_stock,
        is_active=False,
        sku=f"{product.sku}-COPY" if product.sku else None,
        hsn_code=product.hsn_code,
        video_url=product.video_url,
        weight_grams=product.weight_grams,
        length_cm=product.length_cm,
        width_cm=product.width_cm,
        height_cm=product.height_cm,
        highlights=deepcopy(product.highlights) if product.highlights else [],
        images=deepcopy(product.images) if product.images else [],
        variant_option=deepcopy(product.variant_option) if product.variant_option else None,
        return_window_days=product.return_window_days,
    )

    session.add(cloned_product)
    session.commit()
    session.refresh(cloned_product)

    assoc_rows = session.exec(
        select(ProductCollection).where(ProductCollection.product_id == product.id)
    ).all()
    for assoc in assoc_rows:
        session.add(
            ProductCollection(
                product_id=cloned_product.id,
                collection_id=assoc.collection_id,
            )
        )
    session.commit()
    catalog_cache.invalidate_site(site_id)

    return to_product_response(cloned_product, session)