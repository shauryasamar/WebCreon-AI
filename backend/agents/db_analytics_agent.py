"""
Webcreon AI - Database & Analytics Agent
Specialized agent for database queries, sales analytics with dynamic time ranges,
top selling products, real product review ratings, cancellation reason statistics,
return stage breakdowns, order mutations, return request status updates,
and typo-tolerant deletion guardrails.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlmodel import Session, select

from db.database import engine
from models import Order, Product, ProductReview, ReturnRequest, Coupon, OrderStatusHistory
from services.audit_service import AuditService, ActorType, SourceType, AuditCategory


def get_store_metrics_for_period(
    db: Session,
    site_uuid: Optional[UUID],
    days_filter: Optional[int] = None,
    status_filter: Optional[str] = None,
    site_definition: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Computes exact PostgreSQL database metrics with optional dynamic time-range filtering and site_definition catalog fallback."""
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

    # Apply status filter if provided (matching UI tabs precisely)
    if status_filter:
        st_clean = status_filter.lower().strip()
        if st_clean == "middle_state":
            filtered_orders = [
                o for o in period_orders
                if str(o.status or "").lower() in ["placed", "pending", "new", "accepted", "confirmed", "shipped", "out_for_delivery", "in_transit"]
            ]
        elif st_clean in ["yet_to_ship", "yet to ship", "confirmed", "accepted", "ready to ship"]:
            filtered_orders = [
                o for o in period_orders
                if str(o.status or "").lower() in ["confirmed", "accepted", "packed", "processing", "ready to ship"]
            ]
        elif st_clean in ["new", "placed", "pending"]:
            filtered_orders = [
                o for o in period_orders
                if str(o.status or "").lower() in ["placed", "pending", "new"]
            ]
        elif st_clean in ["yet_to_deliver", "yet to deliver", "shipped", "in_transit", "in transit", "out for delivery"]:
            filtered_orders = [
                o for o in period_orders
                if str(o.status or "").lower() in ["shipped", "out_for_delivery", "in_transit", "dispatched"]
            ]
        elif st_clean in ["delivered", "completed"]:
            filtered_orders = [
                o for o in period_orders
                if str(o.status or "").lower() in ["delivered", "completed", "fulfilled"]
            ]
        elif st_clean in ["cancelled", "canceled", "rejected"]:
            filtered_orders = [
                o for o in period_orders
                if "cancel" in str(o.status or "").lower() or "reject" in str(o.status or "").lower()
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

    # Granular order status counts matching exact Admin UI tabs
    new_orders_count = sum(1 for o in period_orders if str(o.status or "").lower() == "placed" and (not getattr(o, "contains_preorder", False) or getattr(o, "preorder_released", False)))
    accepted_orders_count = sum(1 for o in period_orders if str(o.status or "").lower() in ["accepted", "confirmed"])
    shipped_orders_count = sum(1 for o in period_orders if str(o.status or "").lower() in ["shipped", "out_for_delivery", "in_transit", "rescheduled", "failed", "replacement_dispatched"])
    delivered_orders_count = sum(1 for o in period_orders if str(o.status or "").lower() in ["delivered", "returned"])
    cancelled_orders_count = sum(1 for o in period_orders if "cancel" in str(o.status or "").lower() or "refund" in str(o.status or "").lower())
    pending_fulfillment_count = new_orders_count + accepted_orders_count

    breakdown_parts = [
        f"New (Placed): {new_orders_count}",
        f"Yet to Ship: {accepted_orders_count}",
        f"Yet to Deliver: {shipped_orders_count}",
        f"Delivered: {delivered_orders_count}",
        f"Cancelled: {cancelled_orders_count}",
    ]
    orders_breakdown_summary = ", ".join(breakdown_parts)

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
        avg_rating_str = f"{avg_num:.1f} ({total_reviews_count} review{'s' if total_reviews_count > 1 else ''})"

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

    # Inventory & Product Stock metrics calculation (with site_definition fallback)
    products_list = []
    if products_all:
        total_products_count = len(products_all)
        total_inventory_stock = sum(int(p.stock or 0) for p in products_all)
        out_of_stock_count = sum(1 for p in products_all if (getattr(p, 'is_active', True) is not False) and (int(p.stock or 0) <= 0 or getattr(p, 'in_stock', True) is False))
        low_stock_count = sum(1 for p in products_all if (getattr(p, 'is_active', True) is not False) and (0 < int(p.stock or 0) <= 20))

        products_list = [
            {
                "id": str(p.id)[:8],
                "name": p.name,
                "category": p.category or "General",
                "price": float(p.price or 0),
                "stock": int(p.stock if p.stock is not None else 0),
                "in_stock": bool(p.in_stock if p.in_stock is not None else (int(p.stock or 0) > 0)),
                "brand": p.brand or "Store Item",
            }
            for p in products_all
        ]
    elif site_definition and isinstance(site_definition, dict):
        # Extract products from site_definition
        raw_prods = site_definition.get("products") or []
        if not raw_prods:
            pages = site_definition.get("pages") or []
            for p in pages:
                for b in p.get("blocks", []):
                    b_prods = b.get("props", {}).get("products") or []
                    if isinstance(b_prods, list):
                        raw_prods.extend(b_prods)

        seen_names = set()
        for idx, p in enumerate(raw_prods):
            if isinstance(p, dict):
                p_name = p.get("name") or p.get("title") or f"Product {idx+1}"
                if p_name not in seen_names:
                    seen_names.add(p_name)
                    p_price = float(p.get("price") or 0)
                    p_stock = int(p.get("stock", 50))
                    products_list.append({
                        "id": str(p.get("id") or idx + 1)[:8],
                        "name": p_name,
                        "category": p.get("category") or "General",
                        "price": p_price,
                        "stock": p_stock,
                        "in_stock": p.get("in_stock", True),
                        "brand": p.get("brand") or site_definition.get("site", {}).get("brand_name", "Store"),
                    })

        total_products_count = len(products_list)
        total_inventory_stock = sum(p["stock"] for p in products_list)
        out_of_stock_count = sum(1 for p in products_list if p["stock"] <= 0)
        low_stock_count = sum(1 for p in products_list if 0 < p["stock"] <= 5)
    else:
        total_products_count = 0
        total_inventory_stock = 0
        out_of_stock_count = 0
        low_stock_count = 0

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
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
) -> Dict[str, Any]:
    """Updates order status in PostgreSQL database with centralized audit trail and order history."""
    with Session(engine) as db:
        site_uuid = UUID(site_id)
        clean_target = target_order_id.replace("-", "").replace("#", "").strip().lower()
        all_site_orders = db.exec(select(Order).where(Order.site_id == site_uuid)).all()
        matched_order = next(
            (o for o in all_site_orders if str(o.id).lower().startswith(target_order_id.lower()) or str(o.id).replace("-", "").lower().startswith(clean_target)),
            None
        )

        if not matched_order:
            return {"success": False, "error": f"Order #{target_order_id} not found."}

        now_dt = datetime.now(timezone.utc)
        status_clean = target_status.strip().lower()

        # Semantic status mapping to canonical system statuses
        STATUS_MAP = {
            # Confirmed / Yet to Ship
            "accepted": "confirmed",
            "accept": "confirmed",
            "confirmed": "confirmed",
            "confirm": "confirmed",
            "packed": "confirmed",
            "packing": "confirmed",
            "processing": "confirmed",
            "approved": "confirmed",
            "ready to ship": "confirmed",
            "yet to ship": "confirmed",

            # Shipped / Yet to Deliver
            "shipped": "shipped",
            "ship": "shipped",
            "dispatched": "shipped",
            "dispatch": "shipped",
            "in transit": "shipped",
            "on the way": "shipped",
            "out for delivery": "shipped",
            "yet to deliver": "shipped",

            # Delivered
            "delivered": "delivered",
            "deliver": "delivered",
            "completed": "delivered",
            "complete": "delivered",
            "fulfilled": "delivered",
            "received": "delivered",

            # Cancelled
            "cancelled": "cancelled",
            "cancel": "cancelled",
            "canceled": "cancelled",
            "rejected": "cancelled",
            "reject": "cancelled",
            "voided": "cancelled",

            # Placed / New
            "placed": "placed",
            "new": "placed",
            "pending": "placed",
        }

        canonical_status = STATUS_MAP.get(status_clean)
        if not canonical_status:
            for keyword, target in STATUS_MAP.items():
                if keyword in status_clean:
                    canonical_status = target
                    break

        if not canonical_status:
            return {
                "success": False,
                "error": f"Invalid status '{target_status}'. Supported system statuses are: Confirmed (Yet to Ship), Shipped (Yet to Deliver), Delivered, Cancelled, and Placed (New).",
            }

        prev_status = matched_order.status
        matched_order.status = canonical_status
        if canonical_status == "confirmed":
            matched_order.confirmed_at = now_dt
        elif canonical_status == "shipped":
            matched_order.shipped_at = now_dt
        elif canonical_status == "delivered":
            matched_order.delivered_at = now_dt
        elif canonical_status == "cancelled":
            matched_order.cancelled_at = now_dt

        parsed_admin_id = None
        if actor_id:
            try:
                parsed_admin_id = UUID(str(actor_id))
            except Exception:
                pass

        display_admin_name = (actor_name or "Admin").strip()
        display_admin_role = (actor_role or "Owner").strip()
        full_actor_display = f"{display_admin_name} (via Co-Pilot)"
        full_role_display = f"{display_admin_role} (via Co-Pilot)"

        # 1. Add Order Status History entry
        history_entry = OrderStatusHistory(
            order_id=matched_order.id,
            status=canonical_status,
            changed_by=parsed_admin_id,
            changed_by_type="co_pilot",
            notes=f"Status changed from {str(prev_status).capitalize()} to {canonical_status.capitalize()} by {full_actor_display}",
            changed_at=now_dt,
        )
        db.add(history_entry)

        db.add(matched_order)
        db.commit()
        db.refresh(matched_order)

        # 2. Centralized Audit Log entry for Activities Page
        AuditService.log_event(
            action="order.status_updated",
            category=AuditCategory.ORDERS,
            actor_type=ActorType.AI,
            source="ai_copilot",
            actor_id=parsed_admin_id,
            actor_name=full_actor_display,
            actor_role=full_role_display,
            actor_email=actor_email,
            site_id=site_uuid,
            resource_type="Order",
            resource_id=matched_order.id,
            resource_name=f"Order #{str(matched_order.id)[:8]}",
            summary=f"{full_actor_display} updated Order #{str(matched_order.id)[:8]} status to {canonical_status.capitalize()}.",
            description=f"Order status changed from {str(prev_status).capitalize()} to {canonical_status.capitalize()} via AI Co-Pilot command.",
            previous_state={"status": prev_status},
            new_state={"status": canonical_status},
            details={
                "order_id": str(matched_order.id)[:8],
                "previous_status": prev_status,
                "new_status": canonical_status,
                "total": float(matched_order.total or 0),
                "actor": full_actor_display,
            },
        )

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


def mutate_bulk_orders_status_in_db(
    site_id: str,
    target_status: str,
    from_status: Optional[str] = "placed",
    older_than_days: Optional[int] = None,
    limit: Optional[int] = None,
    order_ids: Optional[List[str]] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
) -> Dict[str, Any]:
    """Bulk updates all orders with a specific source status (and optional date/id/limit filter) to a target status with full audit logging."""
    with Session(engine) as db:
        site_uuid = UUID(site_id)
        now_dt = datetime.now(timezone.utc)
        status_clean = target_status.strip().lower()

        STATUS_MAP = {
            "accepted": "confirmed",
            "accept": "confirmed",
            "confirmed": "confirmed",
            "confirm": "confirmed",
            "shipped": "shipped",
            "ship": "shipped",
            "delivered": "delivered",
            "cancelled": "cancelled",
            "cancel": "cancelled",
        }
        canonical_target = STATUS_MAP.get(status_clean, status_clean)

        from_statuses = ["placed", "new", "pending"] if from_status in ("placed", "new", "pending", None) else [from_status.lower()]

        all_site_orders = db.exec(
            select(Order).where(Order.site_id == site_uuid)
        ).all()

        matching_orders = [o for o in all_site_orders if str(o.status or "").lower() in from_statuses]

        # Exclude unreleased pre-orders when targeting new/placed orders (matches Admin UI 'New' tab)
        if from_status in ("placed", "new", "pending", None):
            matching_orders = [
                o for o in matching_orders 
                if not getattr(o, "contains_preorder", False) or getattr(o, "preorder_released", False)
            ]

        if order_ids:
            clean_ids = set(str(oid).strip().lower() for oid in order_ids)
            matching_orders = [o for o in matching_orders if str(o.id).lower() in clean_ids or str(o.id)[:8].lower() in clean_ids]

        if older_than_days is not None and older_than_days > 0:
            from datetime import timedelta
            cutoff_dt = now_dt - timedelta(days=older_than_days)
            def _is_older(order_dt):
                if not order_dt:
                    return False
                if order_dt.tzinfo is None:
                    order_dt = order_dt.replace(tzinfo=timezone.utc)
                return order_dt < cutoff_dt
            matching_orders = [o for o in matching_orders if _is_older(o.created_at)]

        # If a specific limit count was requested, enforce it
        if limit is not None and limit > 0:
            matching_orders = matching_orders[:limit]

        if not matching_orders:
            from_label = "new (placed)" if from_status in ("placed", "new", "pending", None) else from_status
            filter_extra = f" older than {older_than_days} days" if older_than_days else ""
            return {
                "success": False,
                "error": f"No {from_label} orders{filter_extra} found to update.",
                "updated_count": 0,
                "orders": [],
            }

        parsed_admin_id = None
        if actor_id:
            try:
                parsed_admin_id = UUID(str(actor_id))
            except Exception:
                pass

        display_admin_name = (actor_name or "Admin").strip()
        display_admin_role = (actor_role or "Owner").strip()
        full_actor_display = f"{display_admin_name} (via Co-Pilot)"
        full_role_display = f"{display_admin_role} (via Co-Pilot)"

        updated_list = []
        for order in matching_orders:
            prev_status = order.status
            order.status = canonical_target
            if canonical_target == "confirmed":
                order.confirmed_at = now_dt
            elif canonical_target == "shipped":
                order.shipped_at = now_dt
            elif canonical_target == "delivered":
                order.delivered_at = now_dt
            elif canonical_target == "cancelled":
                order.cancelled_at = now_dt

            history_entry = OrderStatusHistory(
                order_id=order.id,
                status=canonical_target,
                changed_by=parsed_admin_id,
                changed_by_type="co_pilot",
                notes=f"Bulk status updated from {str(prev_status).capitalize()} to {canonical_target.capitalize()} by {full_actor_display}",
                changed_at=now_dt,
            )
            db.add(history_entry)
            db.add(order)

            items_summary = "Order Items"
            if isinstance(order.items, list) and len(order.items) > 0:
                items_summary = ", ".join([f"{it.get('quantity', 1)}x {it.get('product_name', it.get('name', 'Item'))}" for it in order.items if isinstance(it, dict)])

            updated_list.append({
                "order_id": str(order.id)[:8],
                "status": canonical_target.capitalize(),
                "total": float(order.total or 0),
                "items_summary": items_summary,
            })

        db.commit()

        # Audit log entry for bulk operation in Activities Page
        AuditService.log_event(
            action="order.bulk_status_updated",
            category=AuditCategory.ORDERS,
            actor_type=ActorType.AI,
            source="ai_copilot",
            actor_id=parsed_admin_id,
            actor_name=full_actor_display,
            actor_role=full_role_display,
            actor_email=actor_email,
            site_id=site_uuid,
            resource_type="Orders",
            resource_id=None,
            resource_name=f"{len(updated_list)} Orders",
            summary=f"{full_actor_display} bulk accepted {len(updated_list)} new order(s) to Confirmed (Yet to Ship).",
            description=f"Bulk acceptance across {len(updated_list)} orders completed by Co-Pilot command.",
            details={
                "updated_count": len(updated_list),
                "from_status": from_status,
                "target_status": canonical_target,
                "order_ids": [o["order_id"] for o in updated_list],
                "actor": full_actor_display,
            },
        )

        return {
            "success": True,
            "updated_count": len(updated_list),
            "target_status": canonical_target.capitalize(),
            "orders": updated_list,
            "message": f"Successfully updated {len(updated_list)} order(s) to **{canonical_target.capitalize()}**.",
        }


def mutate_return_status_in_db(
    site_id: str,
    target_return_id: str,
    target_status: str,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
) -> Dict[str, Any]:
    """Updates return request status in PostgreSQL database with semantic lifecycle mapping and audit trail."""
    with Session(engine) as db:
        site_uuid = UUID(site_id)
        clean_target = target_return_id.replace("-", "").replace("#", "").replace("ret", "").replace("RET", "").strip().lower()
        all_returns = db.exec(select(ReturnRequest).where(ReturnRequest.site_id == site_uuid)).all()
        matched_return = next(
            (r for r in all_returns if str(r.id).lower().startswith(target_return_id.lower()) or str(r.id).replace("-", "").lower().startswith(clean_target) or str(r.order_id).lower().startswith(target_return_id.lower())),
            None
        )

        if not matched_return:
            return {"success": False, "error": f"Return request #{target_return_id} not found."}

        now_dt = datetime.now(timezone.utc)
        status_clean = target_status.strip().lower()

        RETURN_STATUS_MAP = {
            "approved": "approved",
            "approve": "approved",
            "accept": "approved",
            "received": "received",
            "receive": "received",
            "inspected": "inspected",
            "inspect": "inspected",
            "refunded": "refunded",
            "refund": "refunded",
            "completed": "refunded",
            "closed": "closed",
            "close": "closed",
            "rejected": "rejected",
            "reject": "rejected",
            "declined": "rejected",
            "decline": "rejected",
            "requested": "requested",
        }

        canonical = RETURN_STATUS_MAP.get(status_clean)
        if not canonical:
            for k, v in RETURN_STATUS_MAP.items():
                if k in status_clean:
                    canonical = v
                    break

        if not canonical:
            return {
                "success": False,
                "error": f"Invalid return status '{target_status}'. Supported return statuses are: Approved, Received, Inspected, Refunded, Closed, Rejected, and Requested.",
            }

        prev_status = matched_return.status
        matched_return.status = canonical
        if canonical == "approved":
            matched_return.approved_at = now_dt
        elif canonical == "received":
            matched_return.received_at = now_dt
        elif canonical == "inspected":
            matched_return.inspected_at = now_dt
        elif canonical == "refunded":
            matched_return.refund_status = "completed"
            matched_return.refunded_at = now_dt
        elif canonical == "rejected":
            matched_return.rejected_at = now_dt

        db.add(matched_return)
        db.commit()
        db.refresh(matched_return)

        parsed_admin_id = None
        if actor_id:
            try:
                parsed_admin_id = UUID(str(actor_id))
            except Exception:
                pass

        display_admin_name = (actor_name or "Admin").strip()
        display_admin_role = (actor_role or "Owner").strip()
        full_actor_display = f"{display_admin_name} (via Co-Pilot)"
        full_role_display = f"{display_admin_role} (via Co-Pilot)"

        AuditService.log_event(
            action="order.return_status_updated",
            category=AuditCategory.ORDERS,
            actor_type=ActorType.AI,
            source="ai_copilot",
            actor_id=parsed_admin_id,
            actor_name=full_actor_display,
            actor_role=full_role_display,
            actor_email=actor_email,
            site_id=site_uuid,
            resource_type="ReturnRequest",
            resource_id=matched_return.id,
            resource_name=f"Return #{str(matched_return.id)[:8]}",
            summary=f"{full_actor_display} updated Return #{str(matched_return.id)[:8]} status to {canonical.capitalize()}.",
            description=f"Return request status changed from {str(prev_status).capitalize()} to {canonical.capitalize()} via AI Co-Pilot command.",
            previous_state={"status": prev_status},
            new_state={"status": canonical},
            details={
                "return_id": str(matched_return.id)[:8],
                "order_id": str(matched_return.order_id)[:8],
                "previous_status": prev_status,
                "new_status": canonical,
                "refund_status": matched_return.refund_status,
                "refund_amount": float(matched_return.final_refund_amount or matched_return.suggested_refund_amount or 0),
                "actor": full_actor_display,
            },
        )

        return {
            "success": True,
            "return_id": str(matched_return.id)[:8],
            "order_id": str(matched_return.order_id)[:8],
            "status": str(matched_return.status).capitalize(),
            "refund_status": str(matched_return.refund_status).capitalize(),
            "refund_amount": float(matched_return.final_refund_amount or matched_return.suggested_refund_amount or 0),
        }


def mutate_product_in_db(
    site_id: str,
    product_identifier: str,
    variant_identifier: Optional[str] = None,
    new_stock: Optional[int] = None,
    stock_delta: Optional[int] = None,
    new_price: Optional[Decimal] = None,
    new_compare_price: Optional[Decimal] = None,
    is_active: Optional[bool] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
) -> Dict[str, Any]:
    """Updates product stock quantity (including specific variants), price, or active status in database with audit logging."""
    with Session(engine) as db:
        site_uuid = UUID(site_id)
        prod_clean = product_identifier.strip().lower()
        var_clean = (variant_identifier or "").strip().lower()

        # Find product by exact ID or SKU
        all_prods = db.exec(select(Product).where(Product.site_id == site_uuid)).all()
        matched_prod = next((p for p in all_prods if str(p.id).lower().startswith(prod_clean) or (p.sku and p.sku.lower() == prod_clean)), None)
        
        # Exact name match
        if not matched_prod:
            matched_prod = next((p for p in all_prods if p.name.lower() == prod_clean or (p.slug and p.slug.lower() == prod_clean)), None)
            
        # Fuzzy / token-overlap scoring to avoid accidental wrong product selection
        if not matched_prod:
            import re
            def _clean_tokens(s: str) -> set:
                return set(re.findall(r'[a-zA-Z0-9]+', s.lower()))

            query_tokens = _clean_tokens(prod_clean)
            if query_tokens:
                scored_prods = []
                for p in all_prods:
                    p_tokens = _clean_tokens(p.name)
                    # Check if query matches variant option name/value
                    v_tokens = set()
                    if p.variant_option and isinstance(p.variant_option, dict):
                        for opt in (p.variant_option.get("optionValues") or []):
                            if isinstance(opt, dict):
                                v_tokens.update(_clean_tokens(str(opt.get("value", ""))))
                                v_tokens.update(_clean_tokens(str(opt.get("label", ""))))
                    all_target_tokens = p_tokens | v_tokens
                    overlap = len(query_tokens & all_target_tokens)
                    if overlap > 0:
                        # Bonus if all product name tokens are in query
                        name_match_score = len(p_tokens & query_tokens) / max(1, len(p_tokens))
                        scored_prods.append((overlap + name_match_score, p))
                
                if scored_prods:
                    scored_prods.sort(key=lambda x: x[0], reverse=True)
                    matched_prod = scored_prods[0][1]

        if not matched_prod:
            return {"success": False, "error": f"Product matching '{product_identifier}' not found in catalog."}

        prev_state = {
            "stock": matched_prod.stock,
            "price": float(matched_prod.price or 0),
            "is_active": matched_prod.is_active,
        }

        changes = []
        variant_updated = False

        # Handle Variant Stock Update if product has variant options
        if (new_stock is not None or stock_delta is not None) and matched_prod.variant_option and isinstance(matched_prod.variant_option, dict):
            import copy
            variant_payload = copy.deepcopy(matched_prod.variant_option)
            option_values = variant_payload.get("optionValues") or []

            # Determine variant value candidate from variant_identifier or product_identifier
            target_variant_str = var_clean
            if not target_variant_str and "(" in prod_clean:
                # e.g. "Okra (Bhindi) (250g)" -> check "250g", "dozen (12 pcs)"
                import re
                bracket_matches = re.findall(r'\(([^)]+)\)', product_identifier)
                for b in bracket_matches:
                    b_clean = b.strip().lower()
                    if any(b_clean in str(opt.get("value", "")).lower() or str(opt.get("value", "")).lower() in b_clean for opt in option_values if isinstance(opt, dict)):
                        target_variant_str = b_clean
                        break

            for opt in option_values:
                if not isinstance(opt, dict):
                    continue
                opt_val = str(opt.get("value") or opt.get("label") or "").strip().lower()
                if (target_variant_str and (target_variant_str in opt_val or opt_val in target_variant_str)) or (len(option_values) == 1 and not target_variant_str):
                    current_v_stock = int(opt.get("stockQty", matched_prod.stock) or 0)
                    if new_stock is not None:
                        opt["stockQty"] = max(0, new_stock)
                    elif stock_delta is not None:
                        opt["stockQty"] = max(0, current_v_stock + stock_delta)
                    opt["inStock"] = opt["stockQty"] > 0
                    variant_updated = True
                    changes.append(f"Variant '{opt.get('value')}' stock set to {opt['stockQty']} units")
                    break

            if variant_updated:
                variant_payload["optionValues"] = option_values
                matched_prod.variant_option = variant_payload
                # Sum all variant stock
                matched_prod.stock = sum(int(opt.get("stockQty", 0) or 0) for opt in option_values if isinstance(opt, dict))
                matched_prod.in_stock = matched_prod.stock > 0
                changes.append(f"Total product stock updated to {matched_prod.stock} units")

        if not variant_updated:
            if new_stock is not None:
                matched_prod.stock = max(0, new_stock)
                matched_prod.in_stock = matched_prod.stock > 0
                changes.append(f"Stock set to {matched_prod.stock} units")
            elif stock_delta is not None:
                matched_prod.stock = max(0, matched_prod.stock + stock_delta)
                matched_prod.in_stock = matched_prod.stock > 0
                changes.append(f"Stock updated by {stock_delta:+d} (now {matched_prod.stock} units)")

        if new_price is not None:
            matched_prod.price = Decimal(str(new_price))
            changes.append(f"Price updated to ₹{matched_prod.price:.2f}")

        if new_compare_price is not None:
            matched_prod.compare_price = Decimal(str(new_compare_price))
            changes.append(f"Compare price updated to ₹{matched_prod.compare_price:.2f}")

        if is_active is not None:
            matched_prod.is_active = is_active
            changes.append("Activated" if is_active else "Deactivated")

        db.add(matched_prod)
        db.commit()
        db.refresh(matched_prod)

        parsed_admin_id = None
        if actor_id:
            try:
                parsed_admin_id = UUID(str(actor_id))
            except Exception:
                pass

        display_admin_name = (actor_name or "Admin").strip()
        display_admin_role = (actor_role or "Owner").strip()
        full_actor_display = f"{display_admin_name} (via Co-Pilot)"
        full_role_display = f"{display_admin_role} (via Co-Pilot)"

        AuditService.log_event(
            action="product.stock_changed" if (new_stock is not None or stock_delta is not None) else "product.updated",
            category=AuditCategory.PRODUCTS,
            actor_type=ActorType.AI,
            source="ai_copilot",
            actor_id=parsed_admin_id,
            actor_name=full_actor_display,
            actor_role=full_role_display,
            actor_email=actor_email,
            site_id=site_uuid,
            resource_type="Product",
            resource_id=matched_prod.id,
            resource_name=matched_prod.name,
            summary=f"{full_actor_display} updated product '{matched_prod.name}': {', '.join(changes)}.",
            description=f"Product '{matched_prod.name}' was modified via AI Co-Pilot command.",
            previous_state=prev_state,
            new_state={
                "stock": matched_prod.stock,
                "price": float(matched_prod.price or 0),
                "is_active": matched_prod.is_active,
            },
            details={
                "product_id": str(matched_prod.id)[:8],
                "product_name": matched_prod.name,
                "changes": changes,
                "actor": full_actor_display,
            },
        )

        return {
            "success": True,
            "product_id": str(matched_prod.id)[:8],
            "product_name": matched_prod.name,
            "category": matched_prod.category or "General",
            "price": float(matched_prod.price),
            "stock": matched_prod.stock,
            "in_stock": matched_prod.in_stock,
            "is_active": matched_prod.is_active,
            "changes_summary": ", ".join(changes) if changes else "No changes made",
        }


def query_product_variant_stock_in_db(
    site_id: str,
    product_search_term: str,
) -> Dict[str, Any]:
    """Queries exact variant stocks, variant pricing, and option details for a given product or keyword."""
    with Session(engine) as db:
        site_uuid = UUID(site_id)
        term_clean = product_search_term.strip().lower()

        all_prods = db.exec(select(Product).where(Product.site_id == site_uuid, Product.is_active == True)).all()
        matched_prods = []
        for p in all_prods:
            p_name_lower = p.name.lower()
            if term_clean in p_name_lower or (p.slug and term_clean in p.slug.lower()) or (p.sku and term_clean == p.sku.lower()):
                matched_prods.append(p)
            elif p.variant_option and isinstance(p.variant_option, dict):
                for opt in (p.variant_option.get("optionValues") or []):
                    if isinstance(opt, dict) and term_clean in str(opt.get("value", "")).lower():
                        matched_prods.append(p)
                        break

        if not matched_prods:
            import re
            query_tokens = set(re.findall(r'[a-zA-Z0-9]+', term_clean))
            for p in all_prods:
                p_tokens = set(re.findall(r'[a-zA-Z0-9]+', p.name.lower()))
                if query_tokens & p_tokens:
                    matched_prods.append(p)

        if not matched_prods:
            return {
                "success": False,
                "error": f"No products matching '{product_search_term}' found in catalog.",
                "rows": [],
            }

        rows = []
        for p in matched_prods:
            if p.variant_option and isinstance(p.variant_option, dict):
                opt_name = p.variant_option.get("optionName") or "Variant"
                option_values = p.variant_option.get("optionValues") or []
                for opt in option_values:
                    if not isinstance(opt, dict):
                        continue
                    v_val = opt.get("value") or opt.get("label") or "Default"
                    v_stock = opt.get("stockQty")
                    if v_stock is None:
                        v_stock = opt.get("stock")
                    if v_stock is None:
                        v_stock = opt.get("quantity")
                    if v_stock is None:
                        v_stock = opt.get("qty")
                    if v_stock is None:
                        v_stock = 0

                    v_price = float(opt.get("price") if opt.get("price") is not None else (p.price or 0))
                    v_in_stock = int(v_stock) > 0

                    rows.append({
                        "product_name": p.name,
                        "total_stock": int(p.stock or 0),
                        "option_type": opt_name,
                        "variant_name": str(v_val),
                        "variant_stock": int(v_stock),
                        "variant_price": f"₹{v_price:,.2f}",
                        "status": "In Stock" if v_in_stock else "Out of Stock",
                    })
            else:
                rows.append({
                    "product_name": p.name,
                    "total_stock": int(p.stock or 0),
                    "option_type": "Standard",
                    "variant_name": "Default",
                    "variant_stock": int(p.stock or 0),
                    "variant_price": f"₹{float(p.price or 0):,.2f}",
                    "status": "In Stock" if int(p.stock or 0) > 0 else "Out of Stock",
                })

        return {
            "success": True,
            "product_count": len(matched_prods),
            "variant_count": len(rows),
            "rows": rows,
        }


def mutate_coupon_in_db(
    site_id: str,
    code: str,
    action: str = "create",  # "create", "activate", "deactivate", "update"
    discount_type: str = "percentage",  # "percentage", "fixed_amount", "free_shipping"
    discount_value: Optional[Decimal] = None,
    min_order_value: Optional[Decimal] = None,
    max_discount_amount: Optional[Decimal] = None,
    applies_to: str = "all",  # "all", "collections", "categories"
    collection_ids: Optional[List[str]] = None,
    category_ids: Optional[List[str]] = None,
    collection_names: Optional[List[str]] = None,
    category_names: Optional[List[str]] = None,
    is_first_order_only: Optional[bool] = None,
    total_usage_limit: Optional[int] = None,
    per_customer_limit: Optional[int] = None,
    is_public: Optional[bool] = None,
    starts_at: Optional[datetime] = None,
    expires_at: Optional[datetime] = None,
    description: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
) -> Dict[str, Any]:
    """Creates, activates, deactivates, or updates promo coupons in database with full field support and audit trail."""
    with Session(engine) as db:
        site_uuid = UUID(site_id)
        code_clean = code.strip().upper()

        parsed_admin_id = None
        if actor_id:
            try:
                parsed_admin_id = UUID(str(actor_id))
            except Exception:
                pass

        display_admin_name = (actor_name or "Admin").strip()
        display_admin_role = (actor_role or "Owner").strip()
        full_actor_display = f"{display_admin_name} (via Co-Pilot)"
        full_role_display = f"{display_admin_role} (via Co-Pilot)"

        coupon = db.exec(select(Coupon).where(Coupon.site_id == site_uuid, Coupon.code == code_clean)).first()

        if action == "deactivate":
            if not coupon:
                return {"success": False, "error": f"Coupon '{code_clean}' not found."}
            coupon.is_active = False
            db.add(coupon)
            db.commit()
            db.refresh(coupon)

            AuditService.log_event(
                action="coupon.status_changed",
                category=AuditCategory.DISCOUNTS_PROMO,
                actor_type=ActorType.AI,
                source="ai_copilot",
                actor_id=parsed_admin_id,
                actor_name=full_actor_display,
                actor_role=full_role_display,
                actor_email=actor_email,
                site_id=site_uuid,
                resource_type="Coupon",
                resource_id=coupon.id,
                resource_name=coupon.code,
                summary=f"{full_actor_display} deactivated coupon '{coupon.code}'.",
                description=f"Coupon '{coupon.code}' was deactivated via AI Co-Pilot command.",
                details={"coupon_code": coupon.code, "is_active": False, "actor": full_actor_display},
            )

            return {
                "success": True,
                "coupon_code": coupon.code,
                "is_active": False,
                "discount_display": f"{coupon.discount_value:.0f}% OFF" if coupon.discount_type == "percentage" else (f"₹{coupon.discount_value:.2f} OFF" if coupon.discount_type == "fixed_amount" else "Free Shipping"),
                "message": f"Coupon '{coupon.code}' has been deactivated.",
            }

        elif action == "activate":
            if not coupon:
                return {"success": False, "error": f"Coupon '{code_clean}' not found."}
            coupon.is_active = True
            db.add(coupon)
            db.commit()
            db.refresh(coupon)

            AuditService.log_event(
                action="coupon.status_changed",
                category=AuditCategory.DISCOUNTS_PROMO,
                actor_type=ActorType.AI,
                source="ai_copilot",
                actor_id=parsed_admin_id,
                actor_name=full_actor_display,
                actor_role=full_role_display,
                actor_email=actor_email,
                site_id=site_uuid,
                resource_type="Coupon",
                resource_id=coupon.id,
                resource_name=coupon.code,
                summary=f"{full_actor_display} activated coupon '{coupon.code}'.",
                description=f"Coupon '{coupon.code}' was activated via AI Co-Pilot command.",
                details={"coupon_code": coupon.code, "is_active": True, "actor": full_actor_display},
            )

            return {
                "success": True,
                "coupon_code": coupon.code,
                "is_active": True,
                "discount_display": f"{coupon.discount_value:.0f}% OFF" if coupon.discount_type == "percentage" else (f"₹{coupon.discount_value:.2f} OFF" if coupon.discount_type == "fixed_amount" else "Free Shipping"),
                "message": f"Coupon '{coupon.code}' has been activated.",
            }

        else:
            # Canonical discount type mapping
            norm_dtype = discount_type.lower().strip()
            if norm_dtype in ("fixed", "flat", "fixed_amount", "flat_amount", "amount", "rupees", "rs"):
                d_type = "fixed_amount"
            elif norm_dtype in ("free_shipping", "freeshipping", "shipping", "free delivery"):
                d_type = "free_shipping"
            else:
                d_type = "percentage"

            d_val = discount_value if discount_value is not None else (Decimal("0.00") if d_type == "free_shipping" else Decimal("10.00"))
            m_val = min_order_value if min_order_value is not None else Decimal("0.00")
            st_val = starts_at or datetime.now(timezone.utc)

            # Resolve collection and category IDs if names were provided
            final_col_ids = list(collection_ids or [])
            if collection_names:
                from models import Collection
                site_cols = db.exec(select(Collection).where(Collection.site_id == site_uuid)).all()
                for cname in collection_names:
                    cn_clean = str(cname).strip().lower()
                    matched_col = next((c for c in site_cols if c.name.lower() == cn_clean or cn_clean in c.name.lower()), None)
                    if matched_col and str(matched_col.id) not in final_col_ids:
                        final_col_ids.append(str(matched_col.id))

            final_cat_ids = list(category_ids or [])
            if category_names:
                from models import Category
                site_cats = db.exec(select(Category).where(Category.site_id == site_uuid)).all()
                for cname in category_names:
                    cn_clean = str(cname).strip().lower()
                    matched_cat = next((c for c in site_cats if c.name.lower() == cn_clean or cn_clean in c.name.lower()), None)
                    if matched_cat and str(matched_cat.id) not in final_cat_ids:
                        final_cat_ids.append(str(matched_cat.id))

            # Auto-infer applies_to if collections or categories are specified
            final_applies_to = applies_to
            if final_col_ids and final_applies_to == "all":
                final_applies_to = "collections"
            elif final_cat_ids and final_applies_to == "all":
                final_applies_to = "categories"

            is_new = False
            if not coupon:
                is_new = True
                default_desc = "Free shipping promotional offer" if d_type == "free_shipping" else (f"{d_val:.0f}% promotional discount" if d_type == "percentage" else f"₹{d_val:.2f} discount")
                coupon = Coupon(
                    site_id=site_uuid,
                    code=code_clean,
                    description=description or default_desc,
                    discount_type=d_type,
                    discount_value=d_val,
                    max_discount_amount=max_discount_amount,
                    applies_to=final_applies_to,
                    collection_ids=final_col_ids,
                    category_ids=final_cat_ids,
                    min_order_value=m_val,
                    is_first_order_only=bool(is_first_order_only) if is_first_order_only is not None else False,
                    total_usage_limit=total_usage_limit,
                    per_customer_limit=per_customer_limit if per_customer_limit is not None else 1,
                    starts_at=st_val,
                    expires_at=expires_at,
                    is_active=True,
                    is_public=bool(is_public) if is_public is not None else True,
                )
            else:
                coupon.discount_type = d_type
                coupon.discount_value = d_val
                if max_discount_amount is not None:
                    coupon.max_discount_amount = max_discount_amount
                if min_order_value is not None:
                    coupon.min_order_value = m_val
                if description is not None:
                    coupon.description = description
                if final_applies_to is not None:
                    coupon.applies_to = final_applies_to
                if final_col_ids:
                    coupon.collection_ids = final_col_ids
                if final_cat_ids:
                    coupon.category_ids = final_cat_ids
                if is_first_order_only is not None:
                    coupon.is_first_order_only = is_first_order_only
                if total_usage_limit is not None:
                    coupon.total_usage_limit = total_usage_limit
                if per_customer_limit is not None:
                    coupon.per_customer_limit = per_customer_limit
                if is_public is not None:
                    coupon.is_public = is_public
                if starts_at:
                    coupon.starts_at = starts_at
                if expires_at:
                    coupon.expires_at = expires_at
                coupon.is_active = True

            db.add(coupon)
            db.commit()
            db.refresh(coupon)

            if coupon.discount_type == "free_shipping":
                discount_str = "Free Shipping"
            elif coupon.discount_type == "percentage":
                discount_str = f"{coupon.discount_value:.0f}% OFF"
            else:
                discount_str = f"₹{coupon.discount_value:.2f} OFF"

            validity_info = ""
            if coupon.starts_at and coupon.expires_at:
                validity_info = f" (Valid: {coupon.starts_at.strftime('%b %d, %Y')} to {coupon.expires_at.strftime('%b %d, %Y')})"
            elif coupon.expires_at:
                validity_info = f" (Expires: {coupon.expires_at.strftime('%b %d, %Y')})"

            extra_rules = []
            if coupon.min_order_value and float(coupon.min_order_value) > 0:
                extra_rules.append(f"Min order ₹{float(coupon.min_order_value):,.2f}")
            if coupon.max_discount_amount and float(coupon.max_discount_amount) > 0:
                extra_rules.append(f"Max cap ₹{float(coupon.max_discount_amount):,.2f}")
            if coupon.is_first_order_only:
                extra_rules.append("First-time customers only")
            if coupon.total_usage_limit:
                extra_rules.append(f"Limit {coupon.total_usage_limit} total uses")
            rules_str = f" [{', '.join(extra_rules)}]" if extra_rules else ""

            AuditService.log_event(
                action="coupon.created" if is_new else "coupon.updated",
                category=AuditCategory.DISCOUNTS_PROMO,
                actor_type=ActorType.AI,
                source="ai_copilot",
                actor_id=parsed_admin_id,
                actor_name=full_actor_display,
                actor_role=full_role_display,
                actor_email=actor_email,
                site_id=site_uuid,
                resource_type="Coupon",
                resource_id=coupon.id,
                resource_name=coupon.code,
                summary=f"{full_actor_display} {'created' if is_new else 'updated'} coupon '{coupon.code}' ({discount_str}){validity_info}{rules_str}.",
                description=f"Coupon '{coupon.code}' was {'created' if is_new else 'updated'} via AI Co-Pilot command.",
                details={
                    "coupon_code": coupon.code,
                    "discount_type": coupon.discount_type,
                    "discount_value": float(coupon.discount_value),
                    "max_discount_amount": float(coupon.max_discount_amount) if coupon.max_discount_amount else None,
                    "applies_to": coupon.applies_to,
                    "min_order_value": float(coupon.min_order_value),
                    "is_first_order_only": coupon.is_first_order_only,
                    "total_usage_limit": coupon.total_usage_limit,
                    "per_customer_limit": coupon.per_customer_limit,
                    "is_public": coupon.is_public,
                    "starts_at": coupon.starts_at.isoformat() if coupon.starts_at else None,
                    "expires_at": coupon.expires_at.isoformat() if coupon.expires_at else None,
                    "is_active": coupon.is_active,
                    "actor": full_actor_display,
                },
            )

            return {
                "success": True,
                "coupon_code": coupon.code,
                "discount_display": discount_str,
                "discount_type": coupon.discount_type,
                "discount_value": float(coupon.discount_value),
                "max_discount_amount": float(coupon.max_discount_amount) if coupon.max_discount_amount else None,
                "min_order_value": float(coupon.min_order_value),
                "applies_to": coupon.applies_to,
                "is_first_order_only": coupon.is_first_order_only,
                "total_usage_limit": coupon.total_usage_limit,
                "per_customer_limit": coupon.per_customer_limit,
                "is_public": coupon.is_public,
                "starts_at": coupon.starts_at.strftime("%b %d, %Y") if coupon.starts_at else "",
                "expires_at": coupon.expires_at.strftime("%b %d, %Y") if coupon.expires_at else "",
                "is_active": coupon.is_active,
                "message": f"Coupon **{coupon.code}** ({discount_str}) is now active!{validity_info}{rules_str}",
            }
