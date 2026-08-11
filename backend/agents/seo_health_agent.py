"""
WebNirmaan AI - SEO & Store Health Agent
Specialized agent for store health audits, low stock inventory alerts,
and SEO metadata optimization recommendations.
"""

from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlmodel import Session, select

from db.database import engine
from models import Order, Product, ReturnRequest
from agents.color_design_agent import calculate_contrast_color


def audit_store_health(site_id: str, site_definition: Dict[str, Any]) -> Dict[str, Any]:
    """Runs a complete store operational, inventory, and design health audit."""
    if not site_id:
        return {"audit": "No site ID provided."}

    site_uuid = UUID(site_id)
    with Session(engine) as db:
        # 1. Orders Audit
        all_orders = db.exec(select(Order).where(Order.site_id == site_uuid)).all()
        unfulfilled = [o for o in all_orders if str(o.status or "").lower() in ["placed", "pending", "new", "accepted"]]
        
        # 2. Returns Audit
        returns_all = db.exec(select(ReturnRequest).where(ReturnRequest.site_id == site_uuid)).all()
        pending_returns = [r for r in returns_all if str(r.status or "").lower() in ["requested", "received", "inspected"]]

        # 3. Inventory Stock Audit
        products = db.exec(select(Product).where(Product.site_id == site_uuid)).all()
        low_stock_prods = [p for p in products if p.stock <= 5]

        # 4. Color Contrast Audit
        theme = site_definition.get("theme") or {}
        bg_hex = theme.get("primary_bg") or "#ffffff"
        text_hex = theme.get("text_color") or "#0f172a"
        contrast_ok = calculate_contrast_color(bg_hex) == text_hex.lower()

        return {
            "total_orders": len(all_orders),
            "unfulfilled_orders_count": len(unfulfilled),
            "pending_returns_count": len(pending_returns),
            "total_products": len(products),
            "low_stock_products": [
                {"name": p.name, "stock": p.stock, "price": float(p.price or 0)}
                for p in low_stock_prods
            ],
            "low_stock_count": len(low_stock_prods),
            "contrast_compliant": contrast_ok,
            "theme_bg": bg_hex,
            "theme_text": text_hex,
        }


def check_low_stock_inventory(site_id: str, threshold: int = 5) -> List[Dict[str, Any]]:
    """Inspects PostgreSQL database for products with stock below threshold."""
    if not site_id:
        return []

    site_uuid = UUID(site_id)
    with Session(engine) as db:
        products = db.exec(select(Product).where(Product.site_id == site_uuid, Product.stock <= threshold)).all()
        return [
            {
                "id": str(p.id)[:8],
                "name": p.name,
                "stock": p.stock,
                "price": float(p.price or 0),
                "brand": p.brand or "Store Item",
            }
            for p in products
        ]
