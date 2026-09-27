# WebCreon AI: Official Source Verification Register
**Module**: Statutory Indian Compliance (GST, TCS Sec 52, TDS Sec 194-O & Razorpay Route)  
**Date**: September 16, 2026  
**Standards Body**: CBIC, GST Council, Income Tax Department (CBDT), Razorpay Official Docs  

---

## 1. Classification Methodology & Label Definitions

Every legal, fiscal, and technical rule in this register is tagged with one of the following authoritative classifications:
- **`VERIFIED_FROM_OFFICIAL_SOURCE`**: Documented in official Gazette notifications, GST Act/Rules, Income-tax Act, CBDT circulars, or official Razorpay developer API documentation.
- **`VERIFIED_FROM_EXISTING_CODE`**: Inspected and verified directly in the current WebCreon AI codebase.
- **`REQUIRES_CA_CONFIRMATION`**: Mandates written formal sign-off from a practicing Indian Chartered Accountant prior to production enablement.
- **`REQUIRES_RAZORPAY_CONFIRMATION`**: Mandates verification with Razorpay Relationship Manager / API Support regarding account-specific commercial agreements.
- **`ENGINEERING_ASSUMPTION`**: Pragmatic software design choice adopting safe default behavior.
- **`UNKNOWN`**: Unresolved regulatory or commercial open point requiring external clarification.

---

## 2. Goods and Services Tax (GST) Statutory Register

### A. Electronic Commerce Operator (ECO) Definition & Scope
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Central Goods and Services Tax Act, 2017 — Section 2(44) & Section 2(45).
- **Statutory Text / Finding**: Section 2(45) defines an ECO as *"any person who owns, operates or manages digital or electronic facility or platform for electronic commerce"*. Section 2(44) defines electronic commerce as *"the supply of goods or services or both, including digital products over digital or electronic network"*.
- **Conclusion**: WebCreon AI operates a digital platform facilitating transactions between merchants and buyers and is legally an Electronic Commerce Operator (ECO).

### B. Section 52 Tax Collection at Source (TCS) Applicability
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: CGST Act, 2017 — Section 52(1); CBIC Notification No. 52/2018-Central Tax.
- **Statutory Text / Finding**: An ECO is mandated to collect TCS where *"the consideration with respect to such supplies is to be collected by the operator"*.
- **Conclusion**: Since customers pay into WebCreon AI's central Razorpay MID and funds are held in escrow before being routed to merchant accounts, WebCreon AI collects the consideration and is strictly mandated to collect TCS under Section 52.

### C. Current GST-TCS Rates
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: CBIC Notification No. 52/2018-Central Tax (dated 20th September, 2018) read with Section 52(1) CGST Act.
- **Statutory Finding**: 
  - **Intra-state supply**: 0.25% CGST + 0.25% SGST / UTGST (Total: **0.5%**).
  - **Inter-state supply**: **0.5%** IGST.
  - *(Note: Statutory ceiling is 1% CGST + 1% SGST = 2%, but effective notified rate is 0.5% total)*.
- **Conclusion**: Tax engine must withhold exactly 0.5% total on the net taxable supply base, split 0.25/0.25 for intra-state and 0.50 for inter-state.

### D. Net Taxable Supplies Base & Return Adjustments
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Section 52(1) Explanation, CGST Act, 2017.
- **Statutory Finding**: *"Net value of taxable supplies shall mean the aggregate value of taxable supplies of goods or services... made during any month by all registered persons through the operator reduced by the aggregate value of taxable supplies returned to the suppliers during the said month"*.
- **Conclusion**: TCS base = `Gross Taxable Value of Supplies (excluding GST) - Value of Returned Supplies in the same month`. Value of exempt/nil-rated items and taxes are excluded from the TCS base.

### E. GSTR-8 Filing Due Date & Specifications
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Section 52(4) CGST Act, 2017 read with Rule 67(1) CGST Rules, 2017.
- **Statutory Finding**: Statement in **Form GSTR-8** must be electronically filed within **10 days** after the end of the calendar month (e.g., filing for September due by October 10).
- **Conclusion**: WebCreon AI platform must generate GSTR-8 Table 4 merchant-wise export reports on the 1st of every month.

### F. Mandatory ECO Registration
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Section 24(x) CGST Act, 2017.
- **Statutory Finding**: Compulsory registration under GST without any threshold exemption for persons who are required to collect tax under Section 52.
- **Conclusion**: WebCreon AI legal entity must possess a valid GSTIN registered specifically as a Tax Collector under GST in the state of its principal establishment.

### G. Unregistered Merchants on E-Commerce Platforms
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: CBIC Notification No. 34/2023-Central Tax & No. 35/2023-Central Tax (effective 1st October, 2023).
- **Statutory Finding**: Unregistered persons with turnover below ₹40L/₹20L are exempted from mandatory GST registration to sell goods through an ECO, subject to:
  1. The supply is **strictly intra-state** (no inter-state sales allowed).
  2. The seller has obtained an **Enrolment ID** from the GST common portal.
  3. The ECO does not permit inter-state shipments for such sellers.
  4. The ECO reports the Enrolment ID in GSTR-8.
- **Conclusion**: The platform must enforce `allow_interstate_sales = False` if merchant registration type is `unregistered` or `enrolled_eco`.

### H. Composition Dealers (Section 10)
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Section 10(2)(d) amended by Finance Act, 2023 read with Notification No. 36/2023-Central Tax.
- **Statutory Finding**: Composition dealers selling goods are permitted on ECO platforms strictly for **intra-state** supplies. They **cannot issue a Tax Invoice** (cannot charge GST from customers) and must issue a **Bill of Supply**.
- **Conclusion**: Order and invoicing engine must generate a Bill of Supply with 0% tax for composition sellers and restrict shipping to the merchant's home state.

### I. HSN/SAC Classification Mandatory Rules
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: CBIC Notification No. 78/2020-Central Tax (dated 15th October, 2020).
- **Statutory Finding**:
  - Aggregate turnover up to ₹5 Crores: Minimum **4-digit HSN** for B2B supplies (optional for B2C).
  - Aggregate turnover over ₹5 Crores: Minimum **6-digit HSN** for all supplies.
  - Services: Mandatory **6-digit SAC**.
- **Conclusion**: Product catalog must enforce 4 to 8-digit HSN codes for goods and 6-digit SAC codes for digital services.

### J. Rule 46 Tax Invoice Mandatory Fields
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Rule 46 of the CGST Rules, 2017.
- **Mandatory Fields**:
  - Name, address, and GSTIN of supplier (Merchant).
  - Consecutive serial number, not exceeding sixteen characters, unique for a financial year (Rule 46(b)).
  - Date of issue.
  - Name, address, and GSTIN/UIN of recipient (if registered).
  - Place of Supply along with state name and state code for inter-state supplies (Rule 46(e)).
  - HSN code of goods or SAC code of services.
  - Description of goods or services.
  - Total quantity and unit of measurement.
  - Total value of supply and taxable value.
  - Rate of tax (central tax, state tax, integrated tax, cess).
  - Amount of tax charged (split into CGST, SGST, IGST, cess).
  - Signature or digital signature of supplier or authorized representative.
- **Conclusion**: Invoices generated by WebCreon AI must list the Merchant as the legal supplier, with WebCreon AI listed only as the facilitating ECO.

### K. Place-of-Supply (PoS) Determination Rules
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Integrated Goods and Services Tax (IGST) Act, 2017 — Section 10(1)(a) (Goods) & Section 12 (Services).
- **Statutory Finding**:
  - *Goods involving movement*: Place of supply is the location where the movement terminates for delivery to the recipient (Customer shipping address).
  - *Intra-state supply*: Location of Supplier (Merchant registered address / pickup hub) State Code == Place of Supply State Code -> **CGST + SGST**.
  - *Inter-state supply*: Location of Supplier State Code != Place of Supply State Code -> **IGST**.
- **Conclusion**: The tax engine must compare merchant `state_code` against customer `shipping_address.state_code`.

### L. E-Invoicing Applicability (IRN & QR Code)
- **Classification**: `REQUIRES_CA_CONFIRMATION`
- **Official Source**: CBIC Notification No. 10/2023-Central Tax (dated 10th May, 2023).
- **Statutory Finding**: E-invoicing (generating IRN via Invoice Registration Portal) is mandatory for registered businesses with aggregate turnover exceeding ₹5 Crores. Since the Merchant is the legal supplier, whether e-invoicing is required depends on the **individual merchant's annual turnover**, not the platform's GMV.
- **Action**: Flag e-invoicing as optional merchant config until CA specifies whether WebCreon AI should integrate with an IRP GSP for large enterprise merchants.

---

## 3. Income Tax Department (Section 194-O) Statutory Register

### A. Statutory Provision & Effective Rate
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Section 194-O of the Income-tax Act, 1961 (inserted by Finance Act, 2020, amended by Finance Act, 2024).
- **Statutory Finding**: E-commerce operator must deduct income-tax at the rate of **0.1%** of the gross amount of sales of goods or provision of services facilitated through its digital facility.
- **Effective Reduction**: The rate was reduced from 1% to **0.1%** by Finance Act, 2024 (effective October 1, 2024) to ease working capital burdens on e-commerce participants.
- **Conclusion**: Base statutory TDS rate is **0.1%**.

### B. Individual / HUF Exemption Threshold
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Section 194-O(2) Income-tax Act, 1961.
- **Statutory Finding**: No deduction shall be made if:
  1. The e-commerce participant is an **Individual** or a **Hindu Undivided Family (HUF)**; AND
  2. The gross amount of sales does not exceed **₹5,00,000 (Five Lakh Rupees)** during the previous financial year; AND
  3. The individual/HUF has furnished their **Permanent Account Number (PAN)** or Aadhaar number to the e-commerce operator.
- **Corporate / Firm Treatment**: For Companies, LLPs, and Partnerships, **there is NO ₹5,00,000 threshold**. 0.1% TDS applies from Rupee 1.
- **Conclusion**: Profile must validate entity type. Individual/HUF tracks cumulative FY GMV until ₹5,00,000 is crossed.

### C. Penalty Rate for Missing / Inoperative PAN (Section 206AA)
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Section 206AA(1) of the Income-tax Act, 1961.
- **Statutory Finding**: If a payee fails to furnish a valid PAN, tax shall be deducted at the higher of:
  1. At the rate specified in the relevant provision; or
  2. At the rate or rates in force; or
  3. At the rate of **5%** (specifically amended for Section 194-O from 20% to 5% under Section 206AA proviso).
- **Conclusion**: If `pan_number` is unverified or invalid, the platform must withhold **5.0%** TDS.

### D. TDS Base Amount (Gross vs Net of GST)
- **Classification**: `REQUIRES_CA_CONFIRMATION`
- **Official Source**: CBDT Circular No. 17/2020 (dated 29th September, 2020) — Question 1 & Question 2.
- **Finding**: CBDT clarified that for Section 194-O, tax is to be deducted on the **gross amount of sales/services** (including GST and convenience fees). However, differing legal opinions exist on whether post-sale discounts and delivery fees charged directly by third-party couriers form part of the base.
- **Action**: Configuration must support `tds_base_includes_gst: bool` (default True per CBDT Circular 17/2020) pending CA sign-off.

### E. Threshold Crossing Mechanics (Incremental vs Full Order)
- **Classification**: `REQUIRES_CA_CONFIRMATION`
- **Statutory Question**: When an individual seller with ₹4,90,000 sales receives an order of ₹20,000 (breaching ₹5,00,000):
  - *Option A*: TDS applies only to the ₹10,000 portion exceeding ₹5,00,000.
  - *Option B*: TDS applies to the entire ₹20,000 order.
  - *Option C*: TDS applies retroactively to all ₹5,10,000 sales.
- **Action**: CA must formally advise. Default engineering implementation will adopt Option B (standard practice: apply 0.1% to the full transaction that breaches the threshold and all subsequent transactions).

### F. Quarterly Form 26Q TDS Return Filing
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Income Tax Rules, 1962 — Rule 31A & Form 26Q (Annexure for Section 194-O).
- **Statutory Due Dates**:
  - Q1 (April–June): July 31.
  - Q2 (July–September): October 31.
  - Q3 (October–December): January 31.
  - Q4 (January–March): May 31.
- **Conclusion**: Settlement service must accumulate deductee-wise quarterly statements matching NSDL e-TDS RPU specs.

---

## 4. Razorpay Route & Payment Gateway Verification Register

### A. Payment Gateway Fee & MDR
- **Classification**: `REQUIRES_RAZORPAY_CONFIRMATION`
- **Standard Baseline**: Standard Razorpay Indian gateway fee is **2.00% + 18% GST** on cards, netbanking, and commercial UPI. Rupay Debit and personal UPI are nominally 0%.
- **Verified in Code**: The current codebase does NOT deduct gateway fee from merchant payouts; it calculates a flat 3% platform commission.
- **Action**: Confirm whether WebCreon AI absorbs gateway MDR within its 3% commission or passes MDR through to merchants.

### B. Razorpay Route Split & Transfer Behavior
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Razorpay Route Documentation (API v1) & `backend/routers/payments.py:655-680`.
- **Finding**:
  - Transfers are initiated via `transfers` array in `POST /v1/orders` or via `POST /v1/payments/{id}/transfers`.
  - With `on_hold: 1`, funds are held in escrow within Razorpay and are not settled to the linked account until `PATCH /v1/transfers/{id}` with `{"on_hold": 0}` is sent.
  - Route transfer fee: Razorpay charges a nominal transfer fee (typically ₹2–₹5 per transfer depending on commercial terms).
- **Action**: Ensure `transfers_payload[0]["amount"]` reflects the exact net share after statutory withholding.

### C. Transfer Reversal & Refund Sequencing
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Official Source**: Razorpay Route Reversals API: `POST /v1/transfers/{transfer_id}/reversals`.
- **Finding**:
  - When an order is refunded, the split transfer to the linked account must be reversed proportionally.
  - If `on_hold: 1`, reversing the transfer immediately reduces the held amount.
  - If already unheld/settled, reversing the transfer debits the merchant's linked account balance. If balance is zero, it creates a negative balance in Razorpay Route.
- **Conclusion**: When customer returns are approved, WebCreon AI must issue a Route Transfer Reversal before issuing the customer gateway refund.

### D. Razorpay Compliance Disclaimer
- **Classification**: `VERIFIED_FROM_OFFICIAL_SOURCE`
- **Finding**: **Razorpay does NOT automatically deduct or deposit Section 52 GST-TCS or Section 194-O Income-tax TDS for Route transfers.** The legal obligation to register, deduct, deposit, and report TCS and TDS rests entirely on the Electronic Commerce Operator (WebCreon AI).
