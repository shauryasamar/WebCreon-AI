from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlmodel import Session, select

from auth_middleware import enforce_site_ownership
from db.database import get_session, engine
from models import Order, OrderItem, Product, Site, SiteTrafficEvent

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analytics"])


# ==========================================
# BACKGROUND VISITOR LOGGING (0ms Latency Impact)
# ==========================================

class TrafficCollectPayload(BaseModel):
    site_id: UUID
    page_path: str = "/"
    referrer: Optional[str] = None
    screen_width: Optional[int] = None
    user_agent: Optional[str] = None


def _classify_referrer(ref: Optional[str]) -> str:
    if not ref or not ref.strip():
        return "Direct"
    r = ref.lower()
    if any(k in r for k in ["google.", "bing.", "yahoo.", "duckduckgo."]):
        return "Google Search"
    if any(k in r for k in ["instagram.", "facebook.", "fb.com", "twitter.", "t.co", "x.com", "linkedin.", "tiktok.", "whatsapp."]):
        return "Social Media"
    return "Other"


def _classify_device(width: Optional[int], ua: Optional[str]) -> str:
    ua_lower = (ua or "").lower()
    if width is not None:
        if width < 768:
            return "Mobile"
        if width <= 1024:
            return "Tablet"
        return "Desktop"
    if any(k in ua_lower for k in ["mobile", "android", "iphone"]):
        return "Mobile"
    if any(k in ua_lower for k in ["ipad", "tablet"]):
        return "Tablet"
    return "Desktop"


def _record_traffic_background(
    site_id: UUID,
    client_ip: str,
    user_agent: str,
    page_path: str,
    referrer: Optional[str],
    screen_width: Optional[int],
):
    try:
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        raw_token = f"{site_id}:{client_ip}:{user_agent}:{today_str}"
        session_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()[:32]

        ref_source = _classify_referrer(referrer)
        dev_type = _classify_device(screen_width, user_agent)

        with Session(engine) as session:
            event = SiteTrafficEvent(
                site_id=site_id,
                session_hash=session_hash,
                page_path=page_path[:500] if page_path else "/",
                referrer_source=ref_source,
                device_type=dev_type,
            )
            session.add(event)
            session.commit()
    except Exception as err:
        logger.debug("Failed to record background traffic event: %s", err)


@router.post("/analytics/collect", status_code=status.HTTP_204_NO_CONTENT)
async def collect_storefront_visit(
    payload: TrafficCollectPayload,
    request: Request,
    background_tasks: BackgroundTasks,
):
    client_ip = (
        request.headers.get("x-forwarded-for")
        or request.client.host
        if request.client
        else "127.0.0.1"
    ).split(",")[0].strip()

    ua = payload.user_agent or request.headers.get("user-agent") or ""

    background_tasks.add_task(
        _record_traffic_background,
        site_id=payload.site_id,
        client_ip=client_ip,
        user_agent=ua,
        page_path=payload.page_path,
        referrer=payload.referrer,
        screen_width=payload.screen_width,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# TIME-SERIES & REAL METRICS AGGREGATION
# ==========================================

def _parse_time_range(
    range_key: str,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None,
) -> tuple[datetime, datetime, datetime, str]:
    now_utc = datetime.now(timezone.utc)

    if range_key == "today":
        start_time = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
        end_time = now_utc
        duration = end_time - start_time
        prev_start_time = start_time - timedelta(days=1)
        label = f"Today ({now_utc.strftime('%b %d, %Y')})"
    elif range_key == "7d":
        start_time = now_utc - timedelta(days=7)
        end_time = now_utc
        prev_start_time = start_time - timedelta(days=7)
        label = "Last 7 Days"
    elif range_key == "90d":
        start_time = now_utc - timedelta(days=90)
        end_time = now_utc
        prev_start_time = start_time - timedelta(days=90)
        label = "Last 90 Days"
    elif range_key == "year":
        start_time = datetime(now_utc.year, 1, 1, tzinfo=timezone.utc)
        end_time = now_utc
        days_in = max(1, (end_time - start_time).days)
        prev_start_time = start_time - timedelta(days=days_in)
        label = "This Year"
    elif range_key == "custom" and start_date_str and end_date_str:
        try:
            start_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
            if not start_dt.tzinfo:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            end_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
            if not end_dt.tzinfo:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            start_time = start_dt
            end_time = end_dt
            diff = end_time - start_time
            prev_start_time = start_time - diff
            label = f"{start_time.strftime('%b %d')} - {end_time.strftime('%b %d, %Y')}"
        except Exception:
            start_time = now_utc - timedelta(days=30)
            end_time = now_utc
            prev_start_time = start_time - timedelta(days=30)
            label = "Last 30 Days"
    else:  # Default to 30d
        start_time = now_utc - timedelta(days=30)
        end_time = now_utc
        prev_start_time = start_time - timedelta(days=30)
        label = "Last 30 Days"

    return start_time, end_time, prev_start_time, label


def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _compute_growth_pct(current: float, previous: float) -> float:
    if previous <= 0:
        return 0.0 if current <= 0 else 100.0
    return round(((current - previous) / previous) * 100.0, 1)


def _get_store_analytics_data(
    site_id: UUID,
    range_key: str,
    session: Session,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Computes strictly real database metrics for this store."""
    start_time, end_time, prev_start_time, time_label = _parse_time_range(
        range_key, start_date, end_date
    )

    # 1. Fetch Real Orders for this site
    all_site_orders = session.exec(
        select(Order).where(Order.site_id == site_id)
    ).all()

    # 2. Fetch Real Traffic Events for this site
    curr_traffic_events = session.exec(
        select(SiteTrafficEvent).where(
            SiteTrafficEvent.site_id == site_id,
            SiteTrafficEvent.created_at >= start_time,
            SiteTrafficEvent.created_at <= end_time,
        )
    ).all()

    prev_traffic_events = session.exec(
        select(SiteTrafficEvent).where(
            SiteTrafficEvent.site_id == site_id,
            SiteTrafficEvent.created_at >= prev_start_time,
            SiteTrafficEvent.created_at < start_time,
        )
    ).all()

    current_period_orders = []
    for o in all_site_orders:
        o_dt = _normalize_dt(getattr(o, "created_at", None))
        if o_dt and start_time <= o_dt <= end_time:
            current_period_orders.append(o)

    previous_period_orders = []
    for o in all_site_orders:
        o_dt = _normalize_dt(getattr(o, "created_at", None))
        if o_dt and prev_start_time <= o_dt < start_time:
            previous_period_orders.append(o)

    curr_valid_orders = [o for o in current_period_orders if "cancel" not in str(o.status or "").lower()]
    prev_valid_orders = [o for o in previous_period_orders if "cancel" not in str(o.status or "").lower()]

    curr_revenue = sum(float(o.total or 0) for o in curr_valid_orders)
    prev_revenue = sum(float(o.total or 0) for o in prev_valid_orders)

    curr_orders_count = len(curr_valid_orders)
    prev_orders_count = len(prev_valid_orders)

    # Helper to extract customer identifiers from an order (UUID, email, phone)
    def _extract_customer_keys(o: Order) -> list[str]:
        keys: list[str] = []
        cid = getattr(o, "customer_id", None)
        if cid and str(cid).strip() and str(cid).lower() not in ("none", "null", ""):
            keys.append(f"uid:{str(cid).strip().lower()}")

        s_addr = getattr(o, "shipping_address", None) or {}
        if isinstance(s_addr, dict):
            email = s_addr.get("email")
            if email and str(email).strip():
                keys.append(f"email:{str(email).strip().lower()}")
            phone = s_addr.get("mobile_number") or s_addr.get("phone")
            if phone and str(phone).strip():
                clean_phone = re.sub(r"\D", "", str(phone).strip())
                if len(clean_phone) >= 10:
                    keys.append(f"phone:{clean_phone[-10:]}")
                elif clean_phone:
                    keys.append(f"phone:{clean_phone}")

        c_email = getattr(o, "customer_email", None)
        if c_email and str(c_email).strip():
            keys.append(f"email:{str(c_email).strip().lower()}")

        c_phone = getattr(o, "customer_phone", None)
        if c_phone and str(c_phone).strip():
            clean_phone = re.sub(r"\D", "", str(c_phone).strip())
            if len(clean_phone) >= 10:
                keys.append(f"phone:{clean_phone[-10:]}")

        if not keys:
            keys.append(f"order:{str(o.id)}")
        return keys

    # Group all site orders by customer cluster (Disjoint Set / Canonical Customer ID)
    parent: Dict[str, str] = {}

    def find(item: str) -> str:
        if item not in parent:
            parent[item] = item
        if parent[item] != item:
            parent[item] = find(parent[item])
        return parent[item]

    def union(item1: str, item2: str):
        root1 = find(item1)
        root2 = find(item2)
        if root1 != root2:
            parent[root2] = root1

    all_valid_site_orders = [o for o in all_site_orders if "cancel" not in str(o.status or "").lower()]

    # Connect all identifiers across all orders
    for o in all_valid_site_orders:
        keys = _extract_customer_keys(o)
        if keys:
            first_key = keys[0]
            for other_key in keys[1:]:
                union(first_key, other_key)

    # Map each order to its canonical customer root and count lifetime orders
    customer_lifetime_orders: Dict[str, int] = {}
    for o in all_valid_site_orders:
        keys = _extract_customer_keys(o)
        root = find(keys[0])
        customer_lifetime_orders[root] = customer_lifetime_orders.get(root, 0) + 1

    # Current period customers
    curr_period_customer_roots = set()
    for o in curr_valid_orders:
        keys = _extract_customer_keys(o)
        root = find(keys[0])
        curr_period_customer_roots.add(root)

    total_customers_count = len(curr_period_customer_roots)
    # A returning customer is any buyer who has placed 2 or more orders across all time
    returning_customers_count = sum(
        1 for root in curr_period_customer_roots if customer_lifetime_orders.get(root, 0) >= 2
    )
    new_customers_count = max(0, total_customers_count - returning_customers_count)

    # Previous period customers
    prev_period_customer_roots = set()
    for o in prev_valid_orders:
        keys = _extract_customer_keys(o)
        root = find(keys[0])
        prev_period_customer_roots.add(root)

    # Real unique visitor sessions from traffic tracking
    curr_tracked_sessions = len(set(e.session_hash for e in curr_traffic_events if e.session_hash))
    prev_tracked_sessions = len(set(e.session_hash for e in prev_traffic_events if e.session_hash))

    # Real Total Visitors:
    # A customer who placed an order visited the store. When orders exist prior to the
    # real-time traffic tracking beacon being added, baseline visitors accounts for those converting visits.
    real_visitors = max(curr_tracked_sessions, total_customers_count, curr_orders_count)
    prev_visitors = max(prev_tracked_sessions, len(prev_period_customer_roots), prev_orders_count)

    # Real E-commerce Conversion Rate:
    # Formula: (Orders / Visitors) * 100, bounded realistically between 0% and 100.0%.
    if real_visitors > 0 and curr_orders_count > 0:
        conversion_rate = min(100.0, round((curr_orders_count / real_visitors) * 100, 1))
    else:
        conversion_rate = 0.0

    if prev_visitors > 0 and prev_orders_count > 0:
        prev_conv_rate = min(100.0, round((prev_orders_count / prev_visitors) * 100, 1))
    else:
        prev_conv_rate = 0.0

    # Real Traffic Sources
    tot_events = len(curr_traffic_events)
    traffic_sources = []
    if tot_events > 0:
        src_counts: Dict[str, int] = {}
        for e in curr_traffic_events:
            src = e.referrer_source or "Direct"
            src_counts[src] = src_counts.get(src, 0) + 1
        
        color_map = {
            "Direct": "#3b82f6",
            "Google Search": "#1e293b",
            "Social Media": "#f87171",
            "Other": "#10b981",
        }
        for src, count in sorted(src_counts.items(), key=lambda x: x[1], reverse=True):
            pct = round((count / tot_events) * 100)
            traffic_sources.append({
                "label": src,
                "percentage": pct,
                "visitors": count,
                "color": color_map.get(src, "#64748b"),
            })

    # Real Device Breakdown
    devices = []
    if tot_events > 0:
        dev_counts: Dict[str, int] = {}
        for e in curr_traffic_events:
            dev = e.device_type or "Desktop"
            dev_counts[dev] = dev_counts.get(dev, 0) + 1
        for dev, count in sorted(dev_counts.items(), key=lambda x: x[1], reverse=True):
            devices.append({
                "device": dev,
                "percentage": round((count / tot_events) * 100),
            })

    # Real Top Selling Products from Order Items
    product_counter: Dict[str, Dict[str, Any]] = {}
    for o in curr_valid_orders:
        items = getattr(o, "items", []) or []
        if isinstance(items, list):
            for itm in items:
                if isinstance(itm, dict):
                    pname = itm.get("product_name") or itm.get("name") or "Product"
                    qty = int(itm.get("quantity") or 1)
                    unit_price = float(itm.get("price") or itm.get("unit_price") or 0)
                    subtotal = float(itm.get("subtotal") or (qty * unit_price))
                    if pname not in product_counter:
                        product_counter[pname] = {
                            "name": pname,
                            "orders": 0,
                            "revenue": 0.0,
                        }
                    product_counter[pname]["orders"] += qty
                    product_counter[pname]["revenue"] += subtotal

    top_prod_list = sorted(product_counter.values(), key=lambda x: x["revenue"], reverse=True)[:20]
    formatted_top_products = []
    for idx, p in enumerate(top_prod_list, start=1):
        formatted_top_products.append({
            "rank": idx,
            "name": p["name"],
            "orders": p["orders"],
            "revenue": round(p["revenue"], 2),
        })

    # Real Timeline Points (Full Chronological Coverage with 100% Order Inclusion)
    chart_points = []
    if range_key == "today":
        # 6 hourly intervals across 24h: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
        today_date = start_time.date()
        hour_steps = [0, 4, 8, 12, 16, 20, 24]
        for idx in range(len(hour_steps) - 1):
            h_start = hour_steps[idx]
            h_end = hour_steps[idx + 1]
            dt_start = datetime(today_date.year, today_date.month, today_date.day, h_start, 0, tzinfo=timezone.utc)
            dt_end = dt_start + timedelta(hours=(h_end - h_start))
            bucket_orders = [
                o for o in curr_valid_orders
                if dt_start <= _normalize_dt(getattr(o, "created_at", None)) < dt_end
            ]
            chart_points.append({
                "date": f"{h_start:02d}:00",
                "revenue": round(sum(float(o.total or 0) for o in bucket_orders), 2),
                "orders": len(bucket_orders),
                "full_date": f"{dt_start.strftime('%d %b')}, {h_start:02d}:00 - {h_end:02d}:00",
            })
    elif range_key == "7d":
        # Exactly 7 daily points covering each day of the last 7 days
        for i in range(7):
            d = (start_time + timedelta(days=i)).date()
            day_orders = [
                o for o in curr_valid_orders
                if _normalize_dt(getattr(o, "created_at", None)).date() == d
            ]
            chart_points.append({
                "date": d.strftime("%d %b"),
                "revenue": round(sum(float(o.total or 0) for o in day_orders), 2),
                "orders": len(day_orders),
                "full_date": d.strftime("%d %b %Y"),
            })
    elif range_key == "year":
        # 12 monthly points
        year_num = start_time.year
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        for m in range(1, 13):
            m_orders = [
                o for o in curr_valid_orders
                if _normalize_dt(getattr(o, "created_at", None)).year == year_num
                and _normalize_dt(getattr(o, "created_at", None)).month == m
            ]
            chart_points.append({
                "date": month_names[m - 1],
                "revenue": round(sum(float(o.total or 0) for o in m_orders), 2),
                "orders": len(m_orders),
                "full_date": f"{month_names[m - 1]} {year_num}",
            })
    else:
        # 30d, 90d, custom: Daily or multi-day intervals covering 100% of dates without skipping
        total_days = max(1, (end_time.date() - start_time.date()).days + 1)
        if total_days <= 31:
            for i in range(total_days):
                d = (start_time + timedelta(days=i)).date()
                day_orders = [
                    o for o in curr_valid_orders
                    if _normalize_dt(getattr(o, "created_at", None)).date() == d
                ]
                chart_points.append({
                    "date": d.strftime("%d %b"),
                    "revenue": round(sum(float(o.total or 0) for o in day_orders), 2),
                    "orders": len(day_orders),
                    "full_date": d.strftime("%d %b %Y"),
                })
        else:
            num_buckets = 10
            step = total_days / num_buckets
            for b in range(num_buckets):
                b_start = start_time + timedelta(days=int(b * step))
                b_end = start_time + timedelta(days=int((b + 1) * step)) if b < num_buckets - 1 else end_time + timedelta(seconds=1)
                b_orders = [
                    o for o in curr_valid_orders
                    if b_start <= _normalize_dt(getattr(o, "created_at", None)) < b_end
                ]
                chart_points.append({
                    "date": b_start.strftime("%d %b"),
                    "revenue": round(sum(float(o.total or 0) for o in b_orders), 2),
                    "orders": len(b_orders),
                    "full_date": f"{b_start.strftime('%d %b')} - {b_end.strftime('%d %b %Y')}",
                })

    # Recent Activity from Real Orders
    recent_acts = []
    for o in sorted(curr_valid_orders, key=lambda x: x.created_at or datetime.min, reverse=True)[:25]:
        recent_acts.append({
            "id": str(o.id),
            "date": o.created_at.strftime("%b %d, %H:%M") if getattr(o, "created_at", None) else "Recent",
            "event": f"Order #{str(o.id)[:6].upper()}",
            "details": f"₹{float(o.total or 0):,.0f} • {str(o.status or 'placed').capitalize()}",
        })

    has_prev_data = (prev_revenue > 0) or (prev_orders_count > 0) or (prev_visitors > 0)
    comparison_text = f"vs previous {time_label.lower()}" if has_prev_data else ""

    return {
        "time_label": time_label,
        "range_key": range_key,
        "overview": {
            "visitors": real_visitors,
            "visitors_change": _compute_growth_pct(real_visitors, prev_visitors) if has_prev_data else 0.0,
            "orders": curr_orders_count,
            "orders_change": _compute_growth_pct(curr_orders_count, prev_orders_count) if has_prev_data else 0.0,
            "revenue": round(curr_revenue, 2),
            "revenue_change": _compute_growth_pct(curr_revenue, prev_revenue) if has_prev_data else 0.0,
            "conversion_rate": conversion_rate,
            "conversion_rate_change": round(conversion_rate - prev_conv_rate, 2) if has_prev_data else 0.0,
            "comparison_text": comparison_text,
        },
        "chart_points": chart_points,
        "traffic_sources": traffic_sources,
        "customers": {
            "total": total_customers_count,
            "new": new_customers_count,
            "returning": returning_customers_count,
        },
        "top_products": formatted_top_products,
        "devices": devices,
        "recent_activity": recent_acts,
    }


# ==========================================
# ADMIN ENDPOINTS (Strict Store-Owner Isolation)
# ==========================================

@router.get("/admin/{site_id}/analytics/all")
def get_all_analytics(
    site_id: UUID,
    range: str = Query("30d", description="Time range (today, 7d, 30d, 90d, year, custom)"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    return _get_store_analytics_data(
        site_id=site_id,
        range_key=range,
        session=session,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/admin/{site_id}/analytics/overview")
def get_overview_metrics(
    site_id: UUID,
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    data = _get_store_analytics_data(site_id, range, session, start_date, end_date)
    return {"overview": data.get("overview"), "time_label": data.get("time_label")}


@router.get("/admin/{site_id}/analytics/revenue")
def get_revenue_and_orders_chart(
    site_id: UUID,
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    data = _get_store_analytics_data(site_id, range, session, start_date, end_date)
    return {"chart_points": data.get("chart_points"), "time_label": data.get("time_label")}


@router.get("/admin/{site_id}/analytics/traffic")
def get_traffic_sources(
    site_id: UUID,
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    data = _get_store_analytics_data(site_id, range, session, start_date, end_date)
    return {"traffic_sources": data.get("traffic_sources"), "visitors": data.get("overview", {}).get("visitors")}


@router.get("/admin/{site_id}/analytics/customers")
def get_customer_metrics(
    site_id: UUID,
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    data = _get_store_analytics_data(site_id, range, session, start_date, end_date)
    return {"customers": data.get("customers")}


@router.get("/admin/{site_id}/analytics/products")
def get_top_products(
    site_id: UUID,
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    data = _get_store_analytics_data(site_id, range, session, start_date, end_date)
    return {"top_products": data.get("top_products")}


@router.get("/admin/{site_id}/analytics/devices")
def get_devices_breakdown(
    site_id: UUID,
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    data = _get_store_analytics_data(site_id, range, session, start_date, end_date)
    return {"devices": data.get("devices")}
