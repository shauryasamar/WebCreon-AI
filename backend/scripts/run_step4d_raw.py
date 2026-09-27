import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.abspath("backend"))

from models import MerchantTaxProfile
from services.settlement_tax_service import calculate_settlement_split

print("=" * 80)
print("RAW UNFORMATTED STEP 4D AUDIT: CONTINUOUS PROGRESSION & ACCUMULATION")
print("=" * 80)

# Initialize merchant tax profile with 4,99,000.00 FY gross sales
profile_ind = MerchantTaxProfile(
    legal_business_name="Ramesh Kumar",
    entity_type="individual",
    registration_type="regular",
    pan_number="ABCDE1234F",
    gstin="27ABCDE1234F1Z5",
    state_code="27",
    current_fy="2026-2027",
    fy_gross_sales_amount=Decimal("499000.00"),
)

# Order 1 (Before Crossing)
prev_1 = profile_ind.fy_gross_sales_amount
order_1 = Decimal("500.00")
split_1 = calculate_settlement_split(
    gross_order_value=order_1,
    taxable_product_value=order_1,
    product_cgst=Decimal("0.00"),
    product_sgst=Decimal("0.00"),
    product_igst=Decimal("0.00"),
    product_cess=Decimal("0.00"),
    merchant_profile=profile_ind,
    customer_state_code="27",
)
new_1 = prev_1 + order_1
profile_ind.fy_gross_sales_amount = new_1

print("\n--- ORDER 1 (BEFORE CROSSING) ---")
print(f"previous_cumulative = {prev_1} (type: {type(prev_1).__name__})")
print(f"order_amount        = {order_1} (type: {type(order_1).__name__})")
print(f"new_cumulative      = {new_1} (type: {type(new_1).__name__})")
print(f"tds_rate            = {split_1.tds_rate_applied} (type: {type(split_1.tds_rate_applied).__name__})")
print(f"tds_amount          = {split_1.income_tax_tds_194o} (type: {type(split_1.income_tax_tds_194o).__name__})")
print(f"tds_threshold_exempt = {split_1.tds_threshold_exempt}")

# Order 2 (Crossing Order)
prev_2 = profile_ind.fy_gross_sales_amount
order_2 = Decimal("5000.00")
split_2 = calculate_settlement_split(
    gross_order_value=order_2,
    taxable_product_value=order_2,
    product_cgst=Decimal("0.00"),
    product_sgst=Decimal("0.00"),
    product_igst=Decimal("0.00"),
    product_cess=Decimal("0.00"),
    merchant_profile=profile_ind,
    customer_state_code="27",
)
new_2 = prev_2 + order_2
profile_ind.fy_gross_sales_amount = new_2

print("\n--- ORDER 2 (CROSSING ORDER) ---")
print(f"previous_cumulative = {prev_2} (type: {type(prev_2).__name__})")
print(f"order_amount        = {order_2} (type: {type(order_2).__name__})")
print(f"new_cumulative      = {new_2} (type: {type(new_2).__name__})")
print(f"tds_rate            = {split_2.tds_rate_applied} (type: {type(split_2.tds_rate_applied).__name__})")
print(f"tds_amount          = {split_2.income_tax_tds_194o} (type: {type(split_2.income_tax_tds_194o).__name__})")
print(f"tds_threshold_exempt = {split_2.tds_threshold_exempt}")

# Order 3 (Subsequent Order)
prev_3 = profile_ind.fy_gross_sales_amount
order_3 = Decimal("1000.00")
split_3 = calculate_settlement_split(
    gross_order_value=order_3,
    taxable_product_value=order_3,
    product_cgst=Decimal("0.00"),
    product_sgst=Decimal("0.00"),
    product_igst=Decimal("0.00"),
    product_cess=Decimal("0.00"),
    merchant_profile=profile_ind,
    customer_state_code="27",
)
new_3 = prev_3 + order_3
profile_ind.fy_gross_sales_amount = new_3

print("\n--- ORDER 3 (SUBSEQUENT ORDER) ---")
print(f"previous_cumulative = {prev_3} (type: {type(prev_3).__name__})")
print(f"order_amount        = {order_3} (type: {type(order_3).__name__})")
print(f"new_cumulative      = {new_3} (type: {type(new_3).__name__})")
print(f"tds_rate            = {split_3.tds_rate_applied} (type: {type(split_3.tds_rate_applied).__name__})")
print(f"tds_amount          = {split_3.income_tax_tds_194o} (type: {type(split_3.income_tax_tds_194o).__name__})")
print(f"tds_threshold_exempt = {split_3.tds_threshold_exempt}")

print("\n" + "=" * 80)
print("CONTINUITY CHECK:")
print(f"Order 1 new_cumulative ({new_1}) == Order 2 previous_cumulative ({prev_2}) -> {new_1 == prev_2}")
print(f"Order 2 new_cumulative ({new_2}) == Order 3 previous_cumulative ({prev_3}) -> {new_2 == prev_3}")
print(f"Order 2 Gross {order_2} * 0.10% = {order_2 * Decimal('0.001')} == Actual TDS {split_2.income_tax_tds_194o} -> {split_2.income_tax_tds_194o == order_2 * Decimal('0.001')}")
print("=" * 80)
