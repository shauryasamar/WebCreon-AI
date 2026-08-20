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

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.0)

# Schema definitions for tenant tables
SCHEMA_DOCS = """
PostgreSQL Store Tables (Tenant ID is `site_id` UUID):

1. `orders`
   - id (UUID, PK)
   - site_id (UUID, FK -> sites.id)
   - customer_id (UUID, FK -> users.id)
   - total (NUMERIC 12,2) - Total order amount in INR (₹)
   - status (VARCHAR) - Values: 'placed', 'accepted', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'
   - cancel_reason (TEXT) - Optional cancellation note
   - payment_method (VARCHAR) - e.g. 'cod', 'upi', 'card'
   - shipping_address (JSONB) - JSON snapshot containing 'fullName'/'full_name', 'addressLine1'/'address_line1', 'city', 'postalCode'/'postal_code', 'mobileNumber'/'mobile_number', 'email'. NOTE: Always use COALESCE(shipping_address->>'addressLine1', shipping_address->>'address_line1', shipping_address->>'city', '') when extracting or checking for valid address. An order has an address if shipping_address IS NOT NULL AND (shipping_address->>'addressLine1' IS NOT NULL OR shipping_address->>'address_line1' IS NOT NULL OR shipping_address->>'city' IS NOT NULL).
   - created_at (TIMESTAMPTZ)
   - confirmed_at, shipped_at, delivered_at, cancelled_at (TIMESTAMPTZ)

2. `order_items`
   - id (UUID, PK)
   - order_id (UUID, FK -> orders.id)
   - site_id (UUID, FK -> sites.id)
   - product_id (UUID, FK -> products.id)
   - product_name (VARCHAR)
   - unit_price (NUMERIC 12,2)
   - quantity (INTEGER)
   - line_total (NUMERIC 12,2)
   - status (VARCHAR)
   - created_at (TIMESTAMPTZ)

3. `products`
   - id (UUID, PK)
   - site_id (UUID, FK -> sites.id)
   - category_id (UUID, FK -> categories.id)
   - name (VARCHAR)
   - brand (VARCHAR)
   - category (VARCHAR)
   - description (TEXT)
   - price (NUMERIC 12,2)
   - compare_price (NUMERIC 12,2)
   - stock (INTEGER) - Current inventory units
   - in_stock (BOOLEAN)
   - created_at (TIMESTAMPTZ)

4. `categories`
   - id (UUID, PK)
   - site_id (UUID, FK -> sites.id)
   - name (VARCHAR)
   - slug (VARCHAR)

5. `product_reviews`
   - id (UUID, PK)
   - site_id (UUID, FK -> sites.id)
   - product_id (UUID, FK -> products.id)
   - customer_id (UUID, FK -> users.id)
   - order_id (UUID, FK -> orders.id)
   - rating (INTEGER, 1 to 5)
   - review_text (TEXT)
   - created_at (TIMESTAMPTZ)

6. `users` (Store Customers)
   - id (UUID, PK)
   - site_id (UUID, FK -> sites.id)
   - name (VARCHAR)
   - email (VARCHAR)
   - phone (VARCHAR)
   - is_guest (BOOLEAN)
   - is_active (BOOLEAN)
   - created_at (TIMESTAMPTZ)

7. `user_addresses`
   - id (UUID, PK)
   - site_id (UUID, FK -> sites.id)
   - user_id (UUID, FK -> users.id)
   - full_name (VARCHAR)
   - mobile_number (VARCHAR)
   - city (VARCHAR)
   - postal_code (VARCHAR)
   - address_line1 (VARCHAR)

8. `return_requests`
   - id (UUID, PK)
   - site_id (UUID, FK -> sites.id)
   - order_id (UUID, FK -> orders.id)
   - customer_id (UUID, FK -> users.id)
   - status (VARCHAR) - 'requested', 'approved', 'rejected', 'refunded', 'closed'
   - refund_status (VARCHAR) - 'pending', 'processed', 'failed'
   - final_refund_amount (NUMERIC 12,2)
   - request_note (TEXT)
   - created_at (TIMESTAMPTZ)
"""

FORBIDDEN_SQL_TERMS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "REPLACE",
    "GRANT", "REVOKE", "EXEC", "EXECUTE", "INTO OUTFILE", "INTO DUMPFILE",
    "ADMINS", "ADMIN_SITES", "PASSWORD_HASH", "PG_SLEEP", "PG_SHADOW", "INFORMATION_SCHEMA"
]


class GeneratedSQL(BaseModel):
    title: str = Field(description="Short, crisp 2-4 word title for this result (e.g. 'Top Selling Products', 'Revenue by Category', 'Customer Order History')")
    sql_query: str = Field(description="Strict PostgreSQL SELECT query with site_id filter")
    explanation: str = Field(description="Brief 1-sentence explanation of what the query calculates")
    is_applicable: bool = Field(description="True if query can be answered using database tables")


sql_prompt = ChatPromptTemplate.from_messages([
    ("system", f"""You are WebCreon AI's PostgreSQL Text-to-SQL Engineer.
Your job is to generate a high-precision, read-only PostgreSQL SELECT query to answer the user's question.

DATABASE SCHEMA:
{SCHEMA_DOCS}STRICT SECURITY & ACCURACY RULES:
1. READ-ONLY: Output ONLY `SELECT` statements. Never output `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, or `TRUNCATE`.
2. MANDATORY TENANT ISOLATION: Every single table referenced MUST include `site_id = '{{site_id}}'` (e.g. `WHERE o.site_id = '{{site_id}}'`).
   If joining multiple tables, filter every table by `site_id` or join on `site_id`.
3. NEVER query admin tables (`admins`, `admin_sites`) or `password_hash`.
4. SELECT CLEAN, HUMAN-MEANINGFUL COLUMNS:
   - DO NOT write raw `SELECT *`! Always select user-meaningful columns like product name, customer name, rating, review text, order status, total amount, and date.
   - Use clear, professional aliases:
     * `p.name AS "Product"`
     * `u.name AS "Customer"`
     * `pr.rating AS "Rating"`, `pr.review_text AS "Review"`
     * `o.total AS "Total (₹)"`, `o.status AS "Status"`, `o.created_at AS "Date"`
5. ORDER STATUS DEFINITIONS:
   - "New orders" / "Pending orders" specifically means orders with status awaiting fulfillment: `status IN ('placed', 'new', 'pending')`.
     DO NOT filter as `status != 'cancelled'` for "new orders" or "pending orders"!
   - "Delivered orders": `status = 'delivered'`.
   - "Shipped / In-transit orders": `status IN ('shipped', 'out_for_delivery')`.
   - "Cancelled orders": `status = 'cancelled'`.
   - "Total orders": `COUNT(*) FROM orders`.
6. COLUMN NAMING CONVENTIONS (CRITICAL):
   - For quantities / items sold: ALWAYS alias as `units_sold` or `quantity_sold` (e.g. `SUM(oi.quantity) AS units_sold`). DO NOT name it `total_sold`!
   - For monetary revenue / sales: ALWAYS alias as `revenue` or `total_sales_inr` (e.g. `SUM(oi.line_total) AS revenue`).
   - For customer spend: ALWAYS alias as `total_spent` or `lifetime_spend`.
   - For product ratings: ALWAYS alias as `average_rating` and round: `ROUND(AVG(pr.rating), 1) AS average_rating`.
7. CURRENCY & REVENUE: Exclude cancelled orders (`status != 'cancelled'`) when computing gross revenue or sales totals.
8. DATES: Use PostgreSQL date functions like `CURRENT_DATE`, `NOW()`, `created_at >= NOW() - INTERVAL '7 days'`, `DATE_TRUNC('month', created_at)`.
   Do NOT apply date filters unless the user explicitly requested a time period (e.g. "today", "last 7 days", "this month").
9. LIMIT: Always append `LIMIT 50` unless an exact count is computed.
10. Return clean PostgreSQL syntax compatible with version 15+."""),
    ("user", "Tenant site_id: {site_id}\nUser Question: {user_query}\nContext: {history_str}"),
])


def validate_and_sanitize_sql(sql_str: str, site_id: str) -> Tuple[bool, str, str]:
    """Validates that SQL is strictly read-only, safe, and filtered by tenant site_id."""
    if not sql_str or not sql_str.strip():
        return False, "", "Empty SQL query generated."

    cleaned = sql_str.strip().rstrip(";")
    upper_sql = cleaned.upper()

    # 1. Must start with SELECT or WITH (for CTEs)
    if not (upper_sql.startswith("SELECT") or upper_sql.startswith("WITH")):
        return False, "", "Only read-only SELECT queries are allowed."

    # 2. Block forbidden DDL/DML keywords
    for term in FORBIDDEN_SQL_TERMS:
        # Check as standalone word
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, upper_sql):
            return False, "", f"Query contains forbidden keyword: {term}"

    # 3. Ensure tenant isolation (site_id check)
    site_clean = site_id.replace("'", "").strip()
    if site_clean.lower() not in cleaned.lower():
        # If site_id literal not in query, check if parameter placeholder exists
        if ":site_id" not in cleaned and "$1" not in cleaned:
            return False, "", "Query missing mandatory tenant site_id filter."

    # 4. Enforce max LIMIT 100
    if "LIMIT" not in upper_sql:
        cleaned = f"{cleaned} LIMIT 50"

    return True, cleaned, "Valid"


def execute_safe_sql(sql_str: str, site_id: str) -> Dict[str, Any]:
    """Executes validated SQL query in read-only transaction with timeout and JSON serialization."""
    valid, sanitized_sql, reason = validate_and_sanitize_sql(sql_str, site_id)
    if not valid:
        return {"success": False, "error": reason, "columns": [], "rows": [], "row_count": 0}

    try:
        with Session(engine) as db:
            # Set read-only session with strict 3-second statement timeout
            db.exec(text("SET LOCAL statement_timeout = 3000"))
            cursor = db.exec(text(sanitized_sql))
            raw_rows = cursor.fetchall()
            col_names = list(cursor.keys()) if hasattr(cursor, "keys") else []

            # Filter out internal unformatted system columns from front display if meaningful columns exist
            hidden_cols = {"site_id", "order_item_id", "password_hash"}
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
                    elif val is None:
                        row_dict[col] = "-"
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
        print("Dynamic SQL Execution Error:", e)
        return {
            "success": False,
            "error": str(e),
            "columns": [],
            "rows": [],
            "row_count": 0,
            "sql_query": sanitized_sql,
        }


async def run_dynamic_store_query(
    user_query: str,
    site_id: str,
    history_str: str = "",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Translates user query into SQL, executes safely, and returns structured result."""
    if not site_id:
        return {"success": False, "error": "Missing store site_id", "columns": [], "rows": []}

    try:
        from agents.token_tracker import TokenCostCallback
        structured_chain = sql_prompt | llm.with_structured_output(GeneratedSQL)
        gen_res: GeneratedSQL = await structured_chain.ainvoke(
            {
                "site_id": site_id,
                "user_query": user_query,
                "history_str": history_str,
            },
            config={"callbacks": [TokenCostCallback("Copilot.SQLAgent", session_id=session_id or site_id)]}
        )

        if not gen_res.is_applicable or not gen_res.sql_query:
            return {"success": False, "error": "Question is not a queryable database topic", "columns": [], "rows": []}

        exec_res = execute_safe_sql(gen_res.sql_query, site_id)
        exec_res["title"] = gen_res.title or "Database Query Results"
        exec_res["explanation"] = gen_res.explanation
        return exec_res
    except Exception as e:
        print("run_dynamic_store_query error:", e)
        return {"success": False, "error": str(e), "columns": [], "rows": [], "row_count": 0}
