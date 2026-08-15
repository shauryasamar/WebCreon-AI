"""
WebNirmaan AI - Database & Analytics Agent
Specialized agent for database queries, sales analytics with dynamic time ranges,
top selling products, real product review ratings, cancellation reason statistics,
return stage breakdowns, order mutations, return request status updates,
and typo-tolerant deletion guardrails.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlmodel import Session, select

from db.database import engine
from models import Order, Product, ProductReview, ReturnRequest


def get_store_metrics_for_period(
    db: Session,
    site_uuid: Optional[UUID],
    days_filter: Optional[int] = None,
    status_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """Computes exact PostgreSQL database metrics with optional dynamic time-range filtering."""
    if not site_uuid:
        return {
            "all_orders": [],
            "filtered_orders": [],
            "total_orders_count": 0,
            "period_sales": 0.0,
            "lifetime_sales": 0.0,
            "status_counts": {},
            "top_product": "N/A",
            "avg_rating": "No reviews yet",
            "reviews_count": 0,
            "top_rated_products": [],
            "cancel_rate": "0.0%",
            "returns": [],
            "total_returns_count": 0,
            "return_status_counts": {},
            "total_refunded_amount": 0.0,
        }

    all_orders = db.exec(
        select(Order).where(Order.site_id == site_uuid).order_by(Order.created_at.desc())
    ).all()

    now_utc = datetime.now(timezone.utc)
    cutoff_date = None
    time_label = "Lifetime"

    if days_filter is not None:
        if days_filter == 1:
            cutoff_date = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
            time_label = f"Today ({now_utc.strftime('%b %d, %Y')})"
        else:
            cutoff_date = now_utc - timedelta(days=days_filter)
            time_label = f"Last {days_filter} Days"

    if cutoff_date:
        period_orders = [o for o in all_orders if getattr(o, "created_at", None) and o.created_at >= cutoff_date]
    else:
        period_orders = all_orders

    # Apply status filter if provided
    if status_filter:
        st_clean = status_filter.lower().strip()
        if st_clean == "middle_state":
            filtered_orders = [
                o for o in period_orders
                if str(o.status or "").lower() in ["placed", "pending", "new", "accepted", "confirmed", "shipped", "out_for_delivery", "in_transit"]
            ]
        else:
            filtered_orders = [o for o in period_orders if st_clean in str(o.status or "").lower()]
    else:
        filtered_orders = period_orders

    # Sales calculations
    valid_lifetime = [o for o in all_orders if not any(w in str(o.status or "").lower() for w in ["cancel", "refund"])]
    lifetime_sales = sum([float(o.total or 0) for o in valid_lifetime])

    valid_period = [o for o in period_orders if not any(w in str(o.status or "").lower() for w in ["cancel", "refund"])]
    period_sales = sum([float(o.total or 0) for o in valid_period])

    # Status counts
    status_counts: Dict[str, int] = {}
    cancelled_count = 0
    product_sales_qty: Dict[str, int] = {}

    for o in all_orders:
        st = str(o.status or "placed").lower()
        status_counts[st] = status_counts.get(st, 0) + 1
        if "cancel" in st:
            cancelled_count += 1

        if not any(w in st for w in ["cancel", "refund"]):
            if isinstance(o.items, list):
                for item in o.items:
                    if isinstance(item, dict):
                        pname = item.get("product_name") or item.get("name") or "Product"
                        qty = int(item.get("quantity") or 1)
                        product_sales_qty[pname] = product_sales_qty.get(pname, 0) + qty

    top_product = "N/A"
    if product_sales_qty:
        top_product = max(product_sales_qty.items(), key=lambda x: x[1])[0]

    cancel_rate_str = f"{(cancelled_count / len(all_orders) * 100):.1f}%" if all_orders else "0.0%"

    # Granular order status counts for clear AI answering
    new_orders_count = sum(v for k, v in status_counts.items() if k in ["placed", "new", "pending"])
    pending_fulfillment_count = sum(v for k, v in status_counts.items() if k in ["placed", "new", "pending", "accepted", "confirmed", "processing"])
    accepted_orders_count = sum(v for k, v in status_counts.items() if k in ["accepted", "confirmed"])
    shipped_orders_count = sum(v for k, v in status_counts.items() if k in ["shipped", "out_for_delivery", "in_transit"])
    delivered_orders_count = status_counts.get("delivered", 0)
    cancelled_orders_count = sum(v for k, v in status_counts.items() if "cancel" in k)

    breakdown_parts = []
    for st_name, count in status_counts.items():
        breakdown_parts.append(f"{st_name.replace('_', ' ').title()}: {count}")
    orders_breakdown_summary = ", ".join(breakdown_parts) if breakdown_parts else "No orders recorded yet"

    recent_orders_list = [
        {
            "id": str(o.id)[:8],
            "status": str(o.status or "placed"),
            "total": f"₹{float(o.total or 0):,.2f}",
            "customer_name": getattr(o, "customer_name", "Customer"),
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if getattr(o, "created_at", None) else "",
        }
        for o in all_orders[:10]
    ]

    # Returns breakdown from ReturnRequest table
    returns_all = db.exec(select(ReturnRequest).where(ReturnRequest.site_id == site_uuid).order_by(ReturnRequest.created_at.desc())).all()
    return_status_counts: Dict[str, int] = {}
    total_refunded_amount = 0.0

    for r in returns_all:
        rst = str(r.status or "requested").lower()
        return_status_counts[rst] = return_status_counts.get(rst, 0) + 1
        if rst in ["refunded", "closed"]:
            total_refunded_amount += float(r.final_refund_amount or r.suggested_refund_amount or 0)

    # Review metrics & Top Rated Products
    reviews_all = db.exec(select(ProductReview).where(ProductReview.site_id == site_uuid)).all()
    products_all = db.exec(select(Product).where(Product.site_id == site_uuid)).all()
    prod_map = {p.id: p for p in products_all}

    total_reviews_count = len(reviews_all)
    avg_rating_str = "No reviews yet"
    top_rated_products: List[Dict[str, Any]] = []

    if reviews_all:
        avg_num = sum(r.rating for r in reviews_all) / total_reviews_count
        avg_rating_str = f"{avg_num:.1f} ⭐ ({total_reviews_count} review{'s' if total_reviews_count > 1 else ''})"

        # Group reviews by product
        prod_reviews: Dict[UUID, List[int]] = {}
        for r in reviews_all:
            prod_reviews.setdefault(r.product_id, []).append(r.rating)

        # Compute average rating & count per product
        rated_list = []
        for pid, ratings in prod_reviews.items():
            prod_obj = prod_map.get(pid)
            pname = prod_obj.name if prod_obj else "Product"
            avg_r = sum(ratings) / len(ratings)
            rated_list.append({
                "product_name": pname,
                "avg_rating": round(avg_r, 1),
                "review_count": len(ratings),
                "category": prod_obj.category if prod_obj else "",
            })

        # Sort by avg rating descending, then review count descending
        rated_list.sort(key=lambda x: (x["avg_rating"], x["review_count"]), reverse=True)
        top_rated_products = rated_list[:10]

    # Inventory & Product Stock metrics calculation
    total_products_count = len(products_all)
    total_inventory_stock = sum(p.stock for p in products_all)
    out_of_stock_count = sum(1 for p in products_all if p.stock <= 0)
    low_stock_count = sum(1 for p in products_all if 0 < p.stock <= 5)

    # Store products list summary with full stock details for AI context
    products_list = [
        {
            "id": str(p.id)[:8],
            "name": p.name,
            "category": p.category or "General",
            "price": float(p.price or 0),
            "stock": int(p.stock if p.stock is not None else 0),
            "in_stock": bool(p.in_stock if p.in_stock is not None else (p.stock > 0)),
            "brand": p.brand or "Store Item",
        }
        for p in products_all
    ]

    return {
        "all_orders": all_orders,
        "filtered_orders": filtered_orders,
        "period_orders": period_orders,
        "total_orders_count": len(all_orders),
        "period_orders_count": len(period_orders),
        "filtered_orders_count": len(filtered_orders),
        "period_sales": period_sales,
        "lifetime_sales": lifetime_sales,
        "status_counts": status_counts,
        "new_orders_count": new_orders_count,
        "pending_orders_count": pending_fulfillment_count,
        "accepted_orders_count": accepted_orders_count,
        "shipped_orders_count": shipped_orders_count,
        "delivered_orders_count": delivered_orders_count,
        "cancelled_orders_count": cancelled_orders_count,
        "orders_breakdown_summary": orders_breakdown_summary,
        "recent_orders_list": recent_orders_list,
        "top_product": top_product,
        "product_sales_qty": product_sales_qty,
        "avg_rating": avg_rating_str,
        "reviews_count": total_reviews_count,
        "top_rated_products": top_rated_products,
        "total_products_count": total_products_count,
        "total_inventory_stock": total_inventory_stock,
        "out_of_stock_count": out_of_stock_count,
        "low_stock_count": low_stock_count,
        "store_products": products_list,
        "cancel_rate": cancel_rate_str,
        "time_label": time_label,
        "returns": returns_all,
        "total_returns_count": len(returns_all),
        "return_status_counts": return_status_counts,
        "total_refunded_amount": total_refunded_amount,
    }


import re

def is_data_deletion_attempt(message: str) -> bool:
    """Checks for explicit data deletion attempts targeting orders, products, or tables with regex word boundaries."""
    msg_lower = message.lower()
    delete_pattern = r"\b(delete|drop|purge|destroy|erase|truncate|wipe|del|remove)\b"
    target_pattern = r"\b(all orders|orders|order|products|product|table|tables|database|db|all reviews|reviews|users|customers)\b"
    
    # Must match both a delete action and a data entity
    has_delete = bool(re.search(delete_pattern, msg_lower))
    has_target = bool(re.search(target_pattern, msg_lower))
    
    # Exception: removing a filter or clearing search is UI, not data deletion
    if "remove filter" in msg_lower or "clear filter" in msg_lower or "clear search" in msg_lower:
        return False
        
    return has_delete and has_target


def mutate_order_status_in_db(
    site_id: str,
    target_order_id: str,
    target_status: str,
) -> Dict[str, Any]:
    """Updates order status in PostgreSQL database."""
    with Session(engine) as db:
        site_uuid = UUID(site_id)
        all_site_orders = db.exec(select(Order).where(Order.site_id == site_uuid)).all()
        matched_order = next((o for o in all_site_orders if str(o.id).lower().startswith(target_order_id.lower())), None)

        if not matched_order:
            return {"success": False, "error": f"Order #{target_order_id} not found."}

        now_dt = datetime.now(timezone.utc)
        if target_status in ["accepted", "confirmed"]:
            matched_order.status = "confirmed"
            matched_order.confirmed_at = now_dt
        elif target_status == "shipped":
            matched_order.status = "shipped"
            matched_order.shipped_at = now_dt
        elif target_status == "delivered":
            matched_order.status = "delivered"
            matched_order.delivered_at = now_dt
        elif target_status == "cancelled":
            matched_order.status = "cancelled"
            matched_order.cancelled_at = now_dt
        else:
            matched_order.status = target_status

        db.add(matched_order)
        db.commit()
        db.refresh(matched_order)

        items_summary = "Order Items"
        if isinstance(matched_order.items, list) and len(matched_order.items) > 0:
            items_summary = ", ".join([f"{it.get('quantity', 1)}x {it.get('product_name', it.get('name', 'Item'))}" for it in matched_order.items if isinstance(it, dict)])

        return {
            "success": True,
            "order_id": str(matched_order.id)[:8],
            "status": str(matched_order.status).capitalize(),
            "total": float(matched_order.total or 0),
            "items_summary": items_summary,
            "updated_at": matched_order.updated_at.strftime("%b %d, %I:%M %p") if getattr(matched_order, "updated_at", None) else "",
        }
