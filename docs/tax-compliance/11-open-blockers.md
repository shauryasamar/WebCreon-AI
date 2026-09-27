# WebCreon AI: Open Compliance Blockers & Decision Log
**Document Ref**: `docs/tax-compliance/11-open-blockers.md`  
**Classification**: Regulatory, Commercial & Engineering Decision Log  

---

## 1. Active Open Blockers Matrix

| Blocker ID | Domain | Description | Severity | Owner | Required Action & Evidence | Deadline |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | **Tax / Legal** | Exact interpretation of Section 194-O threshold breach (Incremental excess above ₹5L vs Full order once crossed). | **HIGH** | Chartered Accountant | Written advisory memo specifying exact deduction formula. | Day 14 |
| **BLK-02** | **Fintech / Route** | Razorpay Route transfer fee bearer and MDR pass-through schedule confirmation. | **HIGH** | Razorpay RM / Finance | Verification whether Razorpay deducts fees before transfer creation or from master account. | Day 10 |
| **BLK-03** | **Tax / Compliance** | Dedicated GSTIN registration for WebCreon entity as Tax Collector under Section 52. | **CRITICAL** | Finance / Tax Team | GST Certificate (REG-06) showing TCS collector status. | Day 21 |
| **BLK-04** | **Product / Catalog** | Existing products have unvalidated `hsn_code` text strings. | **MEDIUM** | Product / Catalog Team | Execute catalog review script to flag unverified products with `tax_review_required = True`. | Day 7 |
| **BLK-05** | **Customer Logistics** | Courier delivery fee GST rate treatment under Composite Supply for mixed carts. | **LOW** | Chartered Accountant | Confirmation of highest-rate vs proportional allocation for shipping GST. | Day 14 |
