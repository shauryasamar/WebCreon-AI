from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlmodel import Session, func, select

from auth_middleware import authenticate_customer, enforce_site_ownership
from db.database import get_session
from models import Order, OrderItem, Product, ProductReview, Site, User


router = APIRouter(
    prefix="/sites/{site_id}/products",
    tags=["products"],
)


PRODUCT_UPLOADS_DIR = Path("uploads/products")
PRODUCT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

REVIEW_UPLOADS_DIR = Path("uploads/product-reviews")
REVIEW_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


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


def get_product_review_summary(session: Session, site_id: UUID, product_id: UUID) -> tuple[float, int]:
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


def get_product_reviews(session: Session, site_id: UUID, product_id: UUID) -> list[dict[str, Any]]:
    reviews = session.exec(
        select(ProductReview, User)
        .join(User, User.id == ProductReview.customer_id)
        .where(
            ProductReview.site_id == site_id,
            ProductReview.product_id == product_id,
        )
        .order_by(ProductReview.created_at.desc())
    ).all()

    return [
        serialize_review(review, customer_name=user.name or user.email or "Customer")
        for review, user in reviews
    ]


def to_product_response(
    product: Product,
    session: Session,
    include_reviews: bool = False,
) -> dict[str, Any]:
    average_rating, review_count = get_product_review_summary(session, product.site_id, product.id)

    response = {
        "id": product.id,
        "site_id": product.site_id,
        "name": product.name,
        "brand": product.brand,
        "category": product.category,
        "description": product.description or "",
        "slug": product.slug,
        "price": product.price,
        "compare_price": product.compare_price,
        "stock": product.stock,
        "in_stock": product.in_stock,
        "images": product.images or [],
        "variant_option": product.variant_option,
        "average_rating": average_rating,
        "review_count": review_count,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }

    if include_reviews:
        response["reviews"] = get_product_reviews(session, product.site_id, product.id)

    return response


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
    description: str
    price: Decimal
    compare_price: Optional[Decimal] = None
    stock: int = 0
    in_stock: bool = True
    slug: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    variant_option: Optional[ProductVariantOption] = None

    @field_validator("name", "category", "description")
    @classmethod
    def trim_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v

    @field_validator("brand", "slug")
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
    description: str
    price: Decimal
    compare_price: Optional[Decimal] = None
    stock: int = 0
    in_stock: bool = True
    slug: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    variant_option: Optional[ProductVariantOption] = None

    @field_validator("name", "category", "description")
    @classmethod
    def trim_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        return v

    @field_validator("brand", "slug")
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
    description: str
    slug: Optional[str] = None
    price: Decimal
    compare_price: Optional[Decimal] = None
    stock: int
    in_stock: bool
    images: list[str]
    variant_option: Optional[dict[str, Any]] = None
    average_rating: float = 0.0
    review_count: int = 0
    reviews: Optional[list[dict[str, Any]]] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None


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


@router.get("", response_model=list[ProductResponse])
def list_products(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    products = session.exec(
        select(Product).where(Product.site_id == site_id)
    ).all()
    return [to_product_response(product, session) for product in products]


@router.get("/public", response_model=list[ProductResponse], include_in_schema=False)
def list_products_public(
    site_id: UUID,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    products = session.exec(
        select(Product).where(Product.site_id == site_id)
    ).all()
    return [to_product_response(product, session) for product in products]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product_detail(
    site_id: UUID,
    product_id: UUID,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)
    return to_product_response(product, session, include_reviews=True)


@router.get("/{product_id}/reviews")
def list_product_reviews(
    site_id: UUID,
    product_id: UUID,
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)
    product = get_site_product_or_404(session, site_id, product_id)
    return get_product_reviews(session, site_id, product.id)


@router.post("/upload-image", response_model=UploadImageResponse)
async def upload_product_image(
    site_id: UUID,
    file: UploadFile = File(...),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    get_site_or_404(session, site_id)

    if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, JPEG, and WEBP images are allowed")

    extension = Path(file.filename or "image").suffix.lower()
    if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(status_code=400, detail="Invalid image file extension")

    filename = f"{uuid4()}{extension}"
    file_path = PRODUCT_UPLOADS_DIR / filename

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    with open(file_path, "wb") as buffer:
        buffer.write(content)

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
        raise HTTPException(status_code=400, detail="Only PNG, JPG, JPEG, and WEBP images are allowed")

    extension = Path(file.filename or "image").suffix.lower()
    if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(status_code=400, detail="Invalid image file extension")

    filename = f"{uuid4()}{extension}"
    file_path = REVIEW_UPLOADS_DIR / filename

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    with open(file_path, "wb") as buffer:
        buffer.write(content)

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

    average_rating, review_count = get_product_review_summary(session, site_id, product.id)

    return {
        "message": "Review submitted successfully",
        "review": serialize_review(review, customer_name=customer.name or customer.email or "Customer"),
        "average_rating": average_rating,
        "review_count": review_count,
    }


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
        description=product_in.description,
        slug=slug_value,
        price=product_in.price,
        compare_price=product_in.compare_price,
        stock=product_in.stock,
        in_stock=product_in.in_stock,
        images=product_in.images,
        variant_option=(
            json_safe(product_in.variant_option.model_dump())
            if product_in.variant_option
            else None
        ),
    )

    session.add(product)
    session.commit()
    session.refresh(product)
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
    product.description = product_in.description
    product.slug = product_in.slug or make_slug(product_in.name)
    product.price = product_in.price
    product.compare_price = product_in.compare_price
    product.stock = product_in.stock
    product.in_stock = product_in.in_stock
    product.images = product_in.images
    product.variant_option = (
        json_safe(product_in.variant_option.model_dump())
        if product_in.variant_option
        else None
    )

    session.add(product)
    session.commit()
    session.refresh(product)
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
    session.delete(product)
    session.commit()
    return