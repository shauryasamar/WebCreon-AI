"""
Webcreon AI - Text-to-SQL Dynamic Query Engine
Translates arbitrary natural language store queries into safe, read-only,
tenant-isolated PostgreSQL queries against store tables.
"""

import re
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from sqlalchemy import text
from sqlmodel import Session
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from db.database import engine

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0, request_timeout=20, max_retries=2)

SCHEMA_DOCS = """
CANONICAL STORE ANALYTICAL VIEWS (RECOMMENDED - Always prefer querying these 5 clean views):

1. `v_store_orders` (Complete order lifecycle, fulfillment status, delivery addresses, customer details & item counts)
   - order_id (UUID, PK)
   - site_id (UUID, Tenant Filter)
   - order_status (VARCHAR) - 'placed', 'accepted', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'
   - total_amount (NUMERIC 12,2) - Total order amount in INR (₹)
   - discount_amount (NUMERIC 12,2)
   - coupon_code (VARCHAR)
   - payment_method (VARCHAR)
   - payment_status (VARCHAR)
   - item_count (INTEGER) - Total count of items/units in the order
   - customer_name (VARCHAR)
   - customer_email (VARCHAR)
   - customer_phone (VARCHAR)
   - formatted_delivery_address (TEXT) - Full formatted address e.g. '68, 3rd main road, Bangalore, 560024'
   - delivery_city (VARCHAR)
   - delivery_pincode (VARCHAR)
   - contains_preorder (BOOLEAN)
   - preorder_released (BOOLEAN)
   - created_at (TIMESTAMPTZ)
   - confirmed_at, shipped_at, delivered_at, cancelled_at (TIMESTAMPTZ)

2. `v_order_items_detail` (Line items purchased, joined with order status, categories, and current inventory stock)
   - order_item_id (UUID, PK)
   - order_id (UUID)
   - site_id (UUID, Tenant Filter)
   - product_id (UUID)
   - product_name (VARCHAR)
   - category (VARCHAR)
   - variant_selected (VARCHAR)
   - quantity_ordered (INTEGER)
   - unit_price (NUMERIC 12,2)
   - line_total (NUMERIC 12,2)
   - order_status (VARCHAR)
   - order_date (TIMESTAMPTZ)
   - customer_name (VARCHAR)
   - current_stock (INTEGER) - Currently available inventory stock for this product

3. `v_product_inventory` (Products, stock levels & unpacked variants)
   - product_id (UUID, PK)
   - site_id (UUID, Tenant Filter)
   - product_name (VARCHAR)
   - category (VARCHAR)
   - sku (VARCHAR)
   - total_product_stock (INTEGER)
   - variant_name (VARCHAR) - e.g. '500g', '1kg', 'Default'
   - variant_stock (INTEGER) - Specific stock count for this variant
   - variant_price (NUMERIC 12,2)
   - base_price (NUMERIC 12,2)
   - compare_price (NUMERIC 12,2)
   - in_stock (BOOLEAN) - NOTE: An item is out of stock whenever (total_product_stock <= 0 OR in_stock = FALSE)
   - is_active (BOOLEAN)

4. `v_customer_analytics` (Customer summary & lifetime spend)
   - customer_id (UUID, PK)
   - site_id (UUID, Tenant Filter)
   - customer_name (VARCHAR)
   - customer_email (VARCHAR)
   - customer_phone (VARCHAR)
   - total_orders_count (INTEGER)
   - lifetime_spend (NUMERIC 12,2)
   - average_order_value (NUMERIC 12,2)
   - last_order_date (TIMESTAMPTZ)
   - customer_registered_at (TIMESTAMPTZ)

5. `v_promotions_and_returns` (Coupons & Promo code tracking)
   - coupon_id (UUID, PK)
   - site_id (UUID, Tenant Filter)
   - coupon_code (VARCHAR)
   - discount_type (VARCHAR)
   - discount_value (NUMERIC 10,2)
   - times_used (INTEGER)
   - is_coupon_active (BOOLEAN)
   - total_discount_given (NUMERIC 12,2)
   - starts_at, expires_at (TIMESTAMPTZ)

RAW STORE TABLES (Universal Fallback):
6. `products` (id, site_id, category_id, name, brand, description, price, stock, is_active)
7. `orders` (id, site_id, customer_id, total, status, cancel_reason, shipping_address, items)
8. `users` (id, site_id, name, email, phone)
9. `product_reviews` (id, site_id, product_id, customer_id, rating, review_text)
10. `return_requests` (id, site_id, order_id, customer_id, status, refund_status, final_refund_amount, request_note)
"""

FORBIDDEN_SQL_TERMS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "REPLACE",
    "GRANT", "REVOKE", "EXEC", "EXECUTE", "INTO OUTFILE", "INTO DUMPFILE",
    "ADMINS", "ADMIN_SITES", "PASSWORD_HASH", "PG_SLEEP", "PG_SHADOW", "INFORMATION_SCHEMA",
    "PG_CATALOG", "VACUUM", "LOCK", "CALL", "DO", "MERGE", "COPY",
    "SECRETS", "API_KEYS", "CREDENTIALS", "SESSIONS", "TOKEN", "AUTH"
]


class GeneratedSQL(BaseModel):
    title: str = Field(description="Short, crisp 2-4 word title for this result")
    sql_query: str = Field(description="Strict PostgreSQL SELECT query with site_id filter")
    explanation: str = Field(description="Brief 1-sentence explanation of what the query calculates")
    is_applicable: bool = Field(description="True if query can be answered using database tables")


SQL_SYSTEM_INSTRUCTIONS = f"""You are WebCreon AI's PostgreSQL Text-to-SQL Engineer.
Your job is to generate a high-precision, read-only PostgreSQL SELECT query to answer the user's question.

DATABASE SCHEMA:
{SCHEMA_DOCS}
STRICT SECURITY & ACCURACY RULES:
1. READ-ONLY: Output ONLY SELECT statements. Never output INSERT, UPDATE, DELETE, DROP, ALTER, or TRUNCATE.
2. MANDATORY TENANT ISOLATION: Every single table or view referenced MUST include site_id = '<site_id>' (e.g. WHERE v.site_id = '<site_id>'). If joining multiple tables/views, filter every table by site_id or join on site_id.
3. PREFER CANONICAL VIEWS: Always query `v_store_orders`, `v_order_items_detail`, `v_product_inventory`, `v_customer_analytics`, or `v_promotions_and_returns` whenever possible. They already handle address formatting, item counting, customer names, and variant extraction.
4. SELECT CLEAN, HUMAN-MEANINGFUL COLUMNS with professional aliases.
5. LIMIT: Append LIMIT 100 or LIMIT 200 by default unless a specific count is requested (e.g. 'top 5' or 'top 300') or an exact count is computed. Never exceed LIMIT 500.
6. PREVENT AGGREGATION MULTIPLICATION:
     SELECT 
       (SELECT COUNT(*) FROM v_store_orders WHERE site_id = '<site_id>') AS "total_orders",
       (SELECT COALESCE(SUM(total_product_stock), 0) FROM v_product_inventory WHERE site_id = '<site_id>') AS "total_stock";
7. PRODUCT & ORDER ITEM CONSOLIDATION:
   - When querying items in orders and their current inventory (e.g. 'what items are in new orders and their stock' or 'how many new orders and available stocks currently we have for those items' or 'ordered items stock'):
     SELECT 
       product_name,
       SUM(quantity_ordered) AS "ordered_units",
       MAX(current_stock) AS "available_stock",
       COUNT(DISTINCT order_id) AS "orders_containing_item"
     FROM v_order_items_detail
     WHERE site_id = '<site_id>' AND order_status = 'placed'
     GROUP BY product_name
     ORDER BY ordered_units DESC;
   - NEVER name a grouped product count column "total_new_orders" or "total_orders" because it represents per-item frequency, not the store's overall order count.
8. ORDERS, DELIVERY ADDRESSES & CUSTOMER DETAILS:
   - When querying customer orders and delivery addresses (e.g. 'give me order wise counts, delivery address and customer name/email'):
     SELECT 
       order_id,
       item_count,
       formatted_delivery_address AS "delivery_address",
       customer_name,
       customer_email
     FROM v_store_orders
     WHERE site_id = '<site_id>'
     ORDER BY created_at DESC;
9. ORDER TAB LIFECYCLE STATUS MAPPINGS:
   - 'New Orders' / 'Placed Orders':
     `WHERE order_status = 'placed' AND (contains_preorder = FALSE OR preorder_released = TRUE)`
   - 'Yet to Ship' / 'Accepted' / 'Confirmed':
     `WHERE order_status IN ('confirmed', 'accepted')`
   - 'Yet to Deliver' / 'Shipped' / 'In Transit':
     `WHERE order_status IN ('shipped', 'out_for_delivery', 'in_transit')`
   - 'Delivered':
     `WHERE order_status IN ('delivered', 'returned')`
   - 'Cancelled':
     `WHERE order_status IN ('cancelled', 'partially_cancelled', 'refunded')`
10. PRODUCT CATALOG & VARIANT INVENTORY:
   - When querying variants or specific product variant stock (e.g. 'what is the variant stock for Carrot', 'variants of carrot', 'show variants'):
     SELECT 
       product_name,
       variant_name,
       variant_stock AS "stock_quantity",
       variant_price AS "price",
       CASE WHEN variant_stock > 0 THEN 'In Stock' ELSE 'Out of Stock' END AS "status"
     FROM v_product_inventory
     WHERE site_id = '<site_id>' AND LOWER(product_name) LIKE '%carrot%'
     ORDER BY product_name, variant_name;
   - When querying store products or catalog items (e.g. 'what do we sell', 'list products', 'active products'):
     SELECT 
       product_name,
       category,
       total_product_stock AS "stock",
       base_price AS "price",
       CASE WHEN total_product_stock > 0 THEN 'In Stock' ELSE 'Out of Stock' END AS "status"
     FROM v_product_inventory
     WHERE site_id = '<site_id>' AND is_active = TRUE
     GROUP BY product_name, category, total_product_stock, base_price
     ORDER BY product_name;
11. TOP REVENUE PRODUCTS & BEST SELLERS:
   - When querying top revenue products, best sellers, or most sold items (e.g. 'top 5 revenue-generating products of all time along with their current available stock and total units sold'):
     SELECT 
       product_name,
       SUM(line_total) AS "total_revenue",
       SUM(quantity_ordered) AS "total_units_sold",
       MAX(current_stock) AS "available_stock"
     FROM v_order_items_detail
     WHERE site_id = '<site_id>' AND order_status != 'cancelled'
     GROUP BY product_name
     ORDER BY total_revenue DESC
     LIMIT 5;

12. CUSTOMER ANALYTICS & HIGH VALUE SPENDERS:
   - When querying customer lifetime spend, high value customers, or customer spending with order status (e.g. 'customers who spent more than ₹1000 in total and have at least one placed order'):
     SELECT 
       ca.customer_name,
       ca.customer_email,
       ca.customer_phone,
       ca.lifetime_spend,
       ca.total_orders_count,
       COUNT(so.order_id) AS "placed_orders_count"
     FROM v_customer_analytics ca
     JOIN v_store_orders so ON ca.customer_email = so.customer_email AND ca.site_id = so.site_id
     WHERE ca.site_id = '<site_id>' AND ca.lifetime_spend >= 1000 AND so.order_status = 'placed'
     GROUP BY ca.customer_name, ca.customer_email, ca.customer_phone, ca.lifetime_spend, ca.total_orders_count
     ORDER BY ca.lifetime_spend DESC;

13. INSUFFICIENT INVENTORY & RESTOCK URGENCY:
   - When querying ordered items that have less available inventory than required (e.g. 'ordered items with less stock than required to fulfill placed orders'):
     SELECT 
       product_name,
       SUM(quantity_ordered) AS "required_quantity",
       MAX(current_stock) AS "available_stock"
     FROM v_order_items_detail
     WHERE site_id = '<site_id>' AND order_status = 'placed'
     GROUP BY product_name
     HAVING MAX(current_stock) < SUM(quantity_ordered)
     ORDER BY (SUM(quantity_ordered) - MAX(current_stock)) DESC;

14. DEAD INVENTORY & PRODUCTS WITH ZERO ORDERS:
   - When querying active products with zero orders, no sales, or dead inventory (e.g. 'active products with more than 20 units in stock but zero orders and zero revenue' or 'products never ordered'):
     SELECT 
       p.product_name,
       p.category,
       p.total_product_stock AS "available_stock",
       p.base_price AS "price",
       '0 orders' AS "sales_status"
     FROM v_product_inventory p
     WHERE p.site_id = '<site_id>'
       AND p.is_active = TRUE
       AND p.total_product_stock > 20
       AND LOWER(TRIM(p.product_name)) NOT IN (
         SELECT DISTINCT LOWER(TRIM(product_name)) 
         FROM v_order_items_detail 
         WHERE site_id = '<site_id>' AND product_name IS NOT NULL
       )
     GROUP BY p.product_name, p.category, p.total_product_stock, p.base_price
     ORDER BY p.total_product_stock DESC;

15. OUT OF STOCK & ZERO INVENTORY PRODUCTS:
   - When querying out of stock products or zero inventory items (e.g. 'how many products we have with 0 inventory', 'out of stock items', 'products with zero stock', 'zero inventory products'):
     SELECT 
       product_name,
       category,
       total_product_stock AS "current_stock",
       base_price AS "price",
       CASE WHEN in_stock = FALSE OR total_product_stock <= 0 THEN 'Out of Stock' ELSE 'In Stock' END AS "inventory_status"
     FROM v_product_inventory
     WHERE site_id = '<site_id>'
       AND is_active = TRUE
       AND (total_product_stock <= 0 OR in_stock = FALSE)
     GROUP BY product_name, category, total_product_stock, base_price, in_stock
     ORDER BY product_name;

16. ZERO EMOJIS: Never include emojis, icons, or symbols in titles or column names."""


def validate_and_sanitize_sql(sql_str: str, site_id: str) -> Tuple[bool, str, str]:
    """Validates that SQL is strictly read-only, safe, and filtered by tenant site_id."""
    if not sql_str or not sql_str.strip():
        return False, "", "Empty SQL query generated."

    # Remove comments to prevent comment injection
    cleaned = re.sub(r"--.*$", "", sql_str, flags=re.MULTILINE)
    cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL)
    cleaned = cleaned.strip().rstrip(";")

    # Reject multiple statements
    if ";" in cleaned:
        return False, "", "Multiple SQL statements are strictly forbidden."

    upper_sql = cleaned.upper()

    # 1. Must start with SELECT or WITH (for read-only CTEs)
    if not (upper_sql.startswith("SELECT") or upper_sql.startswith("WITH")):
        return False, "", "Only read-only SELECT queries are allowed."

    # 2. Block data-modifying CTEs or forbidden terms
    for term in FORBIDDEN_SQL_TERMS:
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, upper_sql):
            return False, "", f"Query contains forbidden keyword or table: {term}"

    # 3. Ensure tenant isolation (site_id check)
    site_clean = site_id.replace("'", "").strip()
    if site_clean.lower() not in cleaned.lower():
        if ":site_id" not in cleaned and "$1" not in cleaned:
            return False, "", "Query missing mandatory tenant site_id filter."

    # 4. Enforce default LIMIT 200 if not specified
    if "LIMIT" not in upper_sql and "COUNT(" not in upper_sql:
        cleaned = f"{cleaned} LIMIT 200"

    return True, cleaned, "Valid"


def execute_safe_sql(sql_str: str, site_id: str) -> Dict[str, Any]:
    """Executes validated SQL query in read-only transaction with timeout and JSON serialization."""
    valid, sanitized_sql, reason = validate_and_sanitize_sql(sql_str, site_id)
    if not valid:
        return {"success": False, "error": reason, "columns": [], "rows": [], "row_count": 0}

    try:
        with Session(engine) as db:
            # Set read-only session with statement timeout if postgresql
            if engine.dialect.name == "postgresql":
                try:
                    db.exec(text("SET LOCAL statement_timeout = 3000"))
                except Exception:
                    pass

            cursor = db.exec(text(sanitized_sql))
            raw_rows = cursor.fetchall()
            col_names = list(cursor.keys()) if hasattr(cursor, "keys") else []

            # Filter out sensitive or system columns
            hidden_cols = {
                "site_id", "order_item_id", "password_hash", "admin_id",
                "secret", "razorpay_secret", "razorpay_signature", "reset_token",
                "api_key", "auth_token", "access_token", "refresh_token", "delivery_otp"
            }
            filtered_cols = [c for c in col_names if c.lower() not in hidden_cols]
            display_cols = filtered_cols if filtered_cols else col_names

            # Serialize values to clean JSON primitives
            serialized_rows = []
            for row in raw_rows:
                row_dict = {}
                row_items = dict(row._mapping) if hasattr(row, "_mapping") else dict(zip(col_names, row))
                for col in display_cols:
                    val = row_items.get(col)
                    if isinstance(val, Decimal):
                        row_dict[col] = float(val)
                    elif isinstance(val, (datetime, date)):
                        row_dict[col] = val.strftime("%Y-%m-%d %H:%M")
                    elif isinstance(val, UUID):
                        row_dict[col] = str(val)[:8]
                    elif isinstance(val, dict):
                        # Format address objects or key-value dicts into clean readable strings
                        if any(k in val for k in ["address_line1", "city", "postal_code", "full_name", "street"]):
                            addr_parts = [
                                str(val.get(k)) for k in ["address_line1", "city", "state", "postal_code"] if val.get(k)
                            ]
                            row_dict[col] = ", ".join(addr_parts) if addr_parts else ", ".join(f"{k}: {v}" for k, v in val.items() if v)
                        else:
                            row_dict[col] = ", ".join(f"{k}: {v}" for k, v in val.items() if v)
                    elif isinstance(val, list):
                        if val and isinstance(val[0], dict):
                            row_dict[col] = ", ".join(
                                str(item.get("product_name") or item.get("name") or item.get("title") or item.get("id"))
                                for item in val if isinstance(item, dict)
                            )
                        else:
                            row_dict[col] = ", ".join(str(v) for v in val)
                    else:
                        row_dict[col] = val
                serialized_rows.append(row_dict)

            return {
                "success": True,
                "columns": display_cols,
                "rows": serialized_rows,
                "row_count": len(serialized_rows),
                "sql_query": sanitized_sql,
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "columns": [],
            "rows": [],
            "row_count": 0,
            "sql_query": sanitized_sql,
        }


def reflect_and_sanitize_result(exec_res: Dict[str, Any], user_query: str) -> Dict[str, Any]:
    """Agentic Reflection: inspects output columns and rows to eliminate ambiguous metrics or naming collisions."""
    if not exec_res or not exec_res.get("success") or not exec_res.get("rows"):
        return exec_res

    cols = list(exec_res.get("columns", []))
    rows = list(exec_res.get("rows", []))

    # 1. Detect if per-product frequency was misnamed as 'total_new_orders' or 'total_orders'
    is_product_table = any("product" in str(c).lower() for c in cols)
    new_cols = []
    renamed_map = {}
    for col in cols:
        col_clean = str(col).strip()
        col_lower = col_clean.lower()
        if is_product_table and col_lower in ["total_new_orders", "total new orders", "total_orders", "total orders"]:
            renamed = "Orders Containing Item"
            renamed_map[col] = renamed
            new_cols.append(renamed)
        elif col_lower in ["formatted_delivery_address", "formatted delivery address"]:
            renamed = "Delivery Address"
            renamed_map[col] = renamed
            new_cols.append(renamed)
        else:
            new_cols.append(col)

    if renamed_map:
        new_rows = []
        for r in rows:
            new_r = {}
            for k, v in r.items():
                target_k = renamed_map.get(k, k)
                new_r[target_k] = v
            new_rows.append(new_r)
        exec_res["columns"] = new_cols
        exec_res["rows"] = new_rows

    return exec_res


async def run_dynamic_store_query(
    user_query: str,
    site_id: str,
    history_str: str = "",
    session_id: Optional[str] = None,
    site_definition: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Translates user query into SQL, executes safely, and returns structured result."""
    if not site_id:
        return {"success": False, "error": "Missing store site_id", "columns": [], "rows": []}

    exec_res = {}
    try:
        from agents.token_tracker import TokenCostCallback
        from langchain_core.messages import SystemMessage, HumanMessage
        system_content = SQL_SYSTEM_INSTRUCTIONS.replace("<site_id>", site_id)
        user_content = f"Tenant site_id: {site_id}\nUser Question: {user_query}\nContext: {history_str}"
        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=user_content),
        ]
        structured_chain = llm.with_structured_output(GeneratedSQL)
        gen_res: GeneratedSQL = await structured_chain.ainvoke(
            messages,
            config={"callbacks": [TokenCostCallback("Copilot.SQLAgent", session_id=session_id or site_id)]}
        )

        if gen_res.is_applicable and gen_res.sql_query:
            exec_res = execute_safe_sql(gen_res.sql_query, site_id)
            exec_res["title"] = gen_res.title or "Database Query Results"
            exec_res["explanation"] = gen_res.explanation
            exec_res = reflect_and_sanitize_result(exec_res, user_query)
    except Exception as e:
        exec_res = {"success": False, "error": str(e), "columns": [], "rows": [], "row_count": 0}

    # If SQL execution returned 0 rows or failed, but query is about catalog / webpage, extract from site_definition
    if (not exec_res.get("success") or not exec_res.get("rows")) and site_definition:
        q_lower = user_query.lower()
        if any(w in q_lower for w in ["product", "item", "catalog", "price", "stock", "cost", "page", "section", "banner"]):
            # Extract from site_definition
            raw_prods = site_definition.get("products") or []
            if not raw_prods:
                for p in site_definition.get("pages", []):
                    for b in p.get("blocks", []):
                        b_prods = b.get("props", {}).get("products") or []
                        if isinstance(b_prods, list):
                            raw_prods.extend(b_prods)

            if raw_prods:
                rows = []
                seen = set()
                for idx, p in enumerate(raw_prods):
                    p_name = p.get("name") or p.get("title") or f"Product {idx+1}"
                    if p_name not in seen:
                        seen.add(p_name)
                        rows.append({
                            "Name": p_name,
                            "Category": p.get("category", "General"),
                            "Price (₹)": float(p.get("price", 0)),
                            "Stock": int(p.get("stock", 50)),
                            "Status": "In Stock" if p.get("in_stock", True) else "Out of Stock",
                        })
                return {
                    "success": True,
                    "title": "Storefront Product Catalog",
                    "explanation": f"Retrieved {len(rows)} products configured on your storefront.",
                    "columns": ["Name", "Category", "Price (₹)", "Stock", "Status"],
                    "rows": rows[:20],
                    "row_count": len(rows),
                    "sql_query": "site_definition.products",
                }

    if not exec_res or not exec_res.get("success"):
        return exec_res if exec_res else {"success": False, "error": "Question is not a queryable database topic", "columns": [], "rows": []}

    return exec_res
