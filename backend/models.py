from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Site(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    site_type: str
    domain: Optional[str] = None
    region: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SiteVersion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    site_id: int = Field(foreign_key="site.id")
    prompt: str
    site_definition_json: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    site_id: int = Field(foreign_key="site.id", index=True)

    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    price: float
    image: Optional[str] = None
    description: Optional[str] = None
    in_stock: bool = True

    # Store attributes as JSON string in DB to avoid dict type issues
    attributes: Optional[str] = None