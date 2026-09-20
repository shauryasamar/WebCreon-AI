# WebCreon AI: Master Fintech Legal Policy & Technical Implementation Specification
**Document Ref**: `docs/tax-compliance/MASTER_FINTECH_LEGAL_POLICY_AND_IMPLEMENTATION_PLAN.md`  
**Governing Benchmark**: Indian GST & Income-Tax Acts as of **September 2026**  
**Stakeholders**: Direct & Indirect Tax Chartered Accountants, Fintech Regulatory Counsel, and Principal Systems Architects  
**Sign-Off Target**: Production Deployment & Regulatory Filing Approval (Minimal or Zero Amendments Required)  

---

## Executive Summary & Systemic Context

WebCreon AI is a multi-tenant software-as-a-service (SaaS) and electronic commerce marketplace engine where distributed third-party merchants create autonomous storefronts, list physical and digital products, and sell to retail and commercial consumers across India.

### Payment & Settlement Architecture
- **Inbound Ingestion**: Customers pay directly into a **central Razorpay Master Merchant ID (MID)** operated by WebCreon Technologies Private Limited.
- **Outbound Dispersal**: The platform orchestrates automated split payouts to merchant linked bank accounts utilizing **Razorpay Route linked accounts with escrow holds (`on_hold: 1`)**.
- **Statutory Posture**: WebCreon operates as an **Electronic Commerce Operator (ECO)** under Section 2(44) and 2(45) of the CGST Act, 2017, and an **e-commerce operator** under Section 194-O of the Income-tax Act, 1961. It is **not the Merchant of Record (MoR)**. The merchant remains the legal supplier of goods and services.

---

## Table of Contents
1. [Core Architectural & Accounting Invariants](#1-core-architectural--accounting-invariants)
2. [Section A: Legal & Operating Model Confirmation](#2-section-a-legal--operating-model-confirmation)
3. [Section B: Merchant Tax Profile & KYC Architecture](#3-section-b-merchant-tax-profile--kyc-architecture)
4. [Section C: Product Tax Engine (HSN/SAC & Place of Supply)](#4-section-c-product-tax-engine-hsnsac--place-of-supply)
5. [Section D: Customer GST Invoice & Credit Note System (Rule 46 & Rule 54)](#5-section-d-customer-gst-invoice--credit-note-system-rule-46--rule-54)
6. [Section E: Platform Fee GST & B2B Invoicing (SAC 998313)](#6-section-e-platform-fee-gst--b2b-invoicing-sac-998313)
7. [Section F: GST Tax Collection at Source (Section 52) Engine](#7-section-f-gst-tax-collection-at-source-section-52-engine)
8. [Section G: Income-Tax TDS (Section 194-O) Engine](#8-section-g-income-tax-tds-section-194-o-engine)
9. [Section H: Settlement Ledger & Razorpay Route Reconciliation](#9-section-h-settlement-ledger--razorpay-route-reconciliation)
10. [Section I: MDR Handling & Customer/Merchant UI Policies](#10-section-i-mdr-handling--customermerchant-ui-policies)
11. [Section J: Testing Matrix, Invariant Verification & Go-Live Checklist](#11-section-j-testing-matrix-invariant-verification--go-live-checklist)
12. [Section K: Legal Provisions Mapping & CA Policy Attestation Sheet](#12-section-k-legal-provisions-mapping--ca-policy-attestation-sheet)

---

## 1. Core Architectural & Accounting Invariants

Every subsystem in WebCreon AI (Checkout, Orders, Settlement, Invoicing, Tax Engines, and Ledgers) must strictly enforce the following four core invariants. Any transaction violating these invariants will fail execution with an uncatchable accounting exception.

```
========================================================================================
                                CORE ACCOUNTING INVARIANTS
========================================================================================

INVARIANT 1: PENNY-PERFECT BALANCE (Settlement Identity)
For each order line, order total, and settlement batch:
  Gross_Customer_Payment =
      Net_Merchant_Payout
    + Platform_Fee_With_GST
    + GST_TCS_Total
    + TDS_194O_Amount
    + Gateway_MDR_With_GST

INVARIANT 2: TAX SEGREGATION (Fiduciary Firewall)
Product GST (CGST/SGST/IGST/Cess) collected from the end consumer belongs strictly
to the Merchant as the legal supplier. It is credited to the Merchant's Gross Settlement
Base and is NEVER recognized as Platform Revenue.

INVARIANT 3: TCS NON-NEGATIVITY & IGNORE-NEGATIVE RULE (CBIC FAQ Compliance)
Where returns exceed supplies in a calendar month at the Merchant GSTIN level:
  Net_Taxable_Supplies < 0  ===>  GST_TCS_Payable = ₹0.00
The negative balance is IGNORED, cannot be declared on the GST Portal, and is
STRICTLY NOT CARRIED FORWARD into subsequent monthly periods.

INVARIANT 4: STRICTLY INCREASING INVOICE NUMBERING (Rule 46(b) Immutability)
Every merchant's tax invoice sequence per Financial Year (April 1 to March 31) must
be STRICTLY INCREASING, gap-free, and immutable. Historical invoices and line tax
snapshots can never be mutated; reversals must occur via linked Rule 54 Credit Notes.
========================================================================================
```

---

## 2. Section A: Legal & Operating Model Confirmation

### 2.1 Statutory Characterization
- **WebCreon Technologies Private Limited** functions as an **Electronic Commerce Operator (ECO)** pursuant to Section 2(44) and 2(45) of the Central Goods and Services Tax (CGST) Act, 2017:
  - *Section 2(45)*: *"Electronic commerce operator means any person who owns, operates or manages digital or electronic facility or platform for electronic commerce"*.
  - *Section 2(44)*: *"Electronic commerce means the supply of goods or services or both, including digital products over digital or electronic network"*.
- **The Merchant / Store Owner** is the **Principal Supplier** and **Seller of Record**:
  - The contract of sale is executed directly between the merchant and the end consumer.
  - The merchant determines catalog pricing, descriptions, product warranties, and return policies.
  - The merchant bears all product defect, consumer protection, and physical fulfillment liabilities.
- **Payment Collection Trigger**: Because WebCreon centrally collects customer consideration via its Master Razorpay MID, Section 52(1) of the CGST Act and Section 194-O of the Income-tax Act, 1961, are **statutorily triggered**.

### 2.2 Rejection of Alternative Legal Archetypes

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                ARCHETYPE COMPARISON                                   │
├──────────────────────┬──────────────────────────────┬─────────────────────────────────┤
│ Archetype            │ Operational Mechanism        │ Why Rejected / Why Adopted      │
├──────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ Pure SaaS            │ Platform only provides code; │ REJECTED: Eliminating merchant  │
│ (e.g. Self-hosted    │ merchants must bring their   │ payment gateway approval leads  │
│ Magento / Shopify BYO│ own individual merchant MIDs │ to massive (>80%) onboarding    │
│ Gateway)             │ and bank merchant accounts.  │ drop-off. Market requires       │
│                      │ Platform never touches cash. │ instant central checkout.       │
├──────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ Merchant of Record   │ Platform buys from vendor    │ REJECTED: Platform would take on│
│ (MoR Reseller        │ and resells to consumer.     │ inventory risk, consumer defect │
│ e.g. Amazon Retail,  │ Platform issues consumer     │ liabilities, and massive working│
│ Myntra, Blinkit B2C) │ invoices in its own name     │ capital lockup for gross product│
│                      │ and recognizes gross GMV.    │ GST across millions of SKUs.    │
├──────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ ECO Marketplace      │ Central Master MID captures  │ ADOPTED: Enables instant store  │
│ with Route Escrow    │ funds; Razorpay Route splits │ launch for sellers, protects    │
│ (WebCreon AI Model)  │ net payout to merchant linked│ platform from product liability,│
│                      │ account with on_hold: 1.     │ and complies with RBI E-Commerce│
│                      │ Merchant issues invoice.     │ aggregator guidelines.          │
└──────────────────────┴──────────────────────────────┴─────────────────────────────────┘
```

### 2.3 Legal Responsibility Allocation Matrix

| Domain | Legal Obligation | Bearer | Statutory / Contractual Reference |
| :--- | :--- | :--- | :--- |
| **Product Supply GST** | Discharge of output tax on goods/services sold | **Merchant** | Section 9(1), CGST Act, 2017 |
| **Customer Product Invoicing** | Issuance of tax invoice / bill of supply | **Merchant** | Rule 46 / Rule 49, CGST Rules, 2017 |
| **GST-TCS Withholding & Filing** | Withhold 0.5% net, remit, and file Form GSTR-8 | **Platform** | Section 52, CGST Act, 2017 |
| **Income-tax TDS 194-O** | Withhold 0.1% / 5% gross, remit, file Form 26Q | **Platform** | Section 194-O, Income-tax Act, 1961 |
| **Platform Service GST** | Invoice 18% GST on marketplace commissions | **Platform** | Section 9(1), CGST Act (SAC 998313) |
| **Gateway MDR Processing Fee** | Payment processing charges (~2% + 18% GST) | **Merchant** | Standard Commercial Marketplace Agreement |
| **Route Linked Account Fee** | Fixed routing charge per payout split | **Platform** | Absorbed as Platform SaaS Operating Expense |
| **Consumer Protection** | Defective goods, refunds, replacement warranty | **Merchant** | Consumer Protection (E-Commerce) Rules, 2020 |
| **Chargebacks & Disputes** | Chargeback debits, dispute admin fees | **Merchant** | Quarantined and debited against Merchant escrow |

---

## 3. Section B: Merchant Tax Profile & KYC Architecture

### 3.1 Data Model Specification (`merchant_tax_profiles`)

```python
class LegalEntityType(str, Enum):
    INDIVIDUAL = "individual"
    HUF = "huf"
    PROPRIETORSHIP = "proprietorship"
    PARTNERSHIP = "partnership"
    LLP = "llp"
    PRIVATE_LIMITED = "private_limited"
    PUBLIC_LIMITED = "public_limited"
    TRUST_SOCIETY = "trust_society"

class GSTRegistrationType(str, Enum):
    REGULAR = "regular"
    COMPOSITION = "composition"
    UNREGISTERED = "unregistered"
    ENROLLED_ECO = "enrolled_eco"  # Intra-state unregistered with Enrolment ID (Notif 34/2023-CT)

class MerchantTaxProfile(SQLModel, table=True):
    __tablename__ = "merchant_tax_profiles"
    __table_args__ = (
        Index("ix_mtp_site_id", "site_id", unique=True),
        Index("ix_mtp_pan", "pan_number"),
        Index("ix_mtp_gstin", "gstin"),
        Index("ix_mtp_state", "state_code"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    site_id: UUID = Field(foreign_key="sites.id", nullable=False, unique=True)
    admin_id: UUID = Field(foreign_key="admins.id", nullable=False)

    # 1. Commercial & Entity Identity
    legal_business_name: str = Field(max_length=255, nullable=False)
    trade_name: str = Field(max_length=255, nullable=False)
    entity_type: LegalEntityType = Field(default=LegalEntityType.PROPRIETORSHIP, nullable=False)
    registration_type: GSTRegistrationType = Field(default=GSTRegistrationType.REGULAR, nullable=False)

    # 2. Direct Tax Identifiers (Income Tax)
    pan_number: str = Field(max_length=10, nullable=False)
    pan_holder_name: Optional[str] = Field(default=None, max_length=255)
    is_pan_verified: bool = Field(default=False, nullable=False)
    pan_verified_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    pan_verification_source: Optional[str] = Field(default=None, max_length=50) # 'NSDL_API', 'MANUAL_CA'

    # 3. Indirect Tax Identifiers (GST)
    gstin: Optional[str] = Field(default=None, max_length=15, nullable=True)
    enrolment_id: Optional[str] = Field(default=None, max_length=20, nullable=True)
    is_gstin_verified: bool = Field(default=False, nullable=False)
    gstin_verified_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))

    # 4. Registered Principal Place of Business (PPoB)
    state_code: str = Field(max_length=2, nullable=False) # 2-digit Indian GST State Code (e.g. '27', '29')
    state_name: str = Field(max_length=100, nullable=False)
    address_line1: str = Field(max_length=255, nullable=False)
    address_line2: Optional[str] = Field(default=None, max_length=255)
    city: str = Field(max_length=100, nullable=False)
    pincode: str = Field(max_length=10, nullable=False)

    # 5. Statutory Scheme Toggles
    is_composition_dealer: bool = Field(default=False, nullable=False)
    allow_interstate_sales: bool = Field(default=True, nullable=False)

    # 6. Section 194-O Cumulative Sales Tracker
    current_fy: str = Field(default="2026-2027", max_length=10, nullable=False)
    fy_gross_sales_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )
    fy_tds_deducted_amount: Decimal = Field(
        default=Decimal("0.00"),
        sa_column=Column(Numeric(14, 2), nullable=False, default=Decimal("0.00")),
    )

    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
```

### 3.2 Automated Validation Rules & Verification Flow
1. **PAN Structural Sanity (Regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`)**:
   - The 4th character denotes entity structure:
     - `P`: Individual / Proprietorship
     - `C`: Company (Private or Public Ltd)
     - `H`: Hindu Undivided Family (HUF)
     - `F`: Partnership Firm / Limited Liability Partnership (LLP)
     - `T`: Trust / Society
   - The onboarding API raises `HTTP 422 Unprocessable Entity` if the selected `entity_type` contradicts the 4th character of the PAN.
2. **GSTIN Checksum & Cross-Validation**:
   - Standard 15-digit format: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`.
   - Characters 1–2 must match `state_code`.
   - Characters 3–12 must strictly match `pan_number`.
   - Character 14 must be `Z`.
3. **Policy for Unregistered Merchants (CBIC Notification No. 34/2023-Central Tax)**:
   - Small suppliers with aggregate turnover below the mandatory registration threshold (₹40 Lakhs for goods, ₹20 Lakhs for services) are permitted to sell through an ECO.
   - **Mandatory Condition 1**: Seller must declare their **Enrolment ID** generated on the GST Portal.
   - **Mandatory Condition 2**: Seller is statutorily prohibited from making **inter-state supplies**.
   - **Enforcement**: When `registration_type == "unregistered"` or `"enrolled_eco"`, the system hardcodes `allow_interstate_sales = False`. The checkout engine rejects any order where the customer shipping state differs from the merchant's registered state.
4. **Policy for Composition Dealers (Section 10 CGST Act)**:
   - Permitted under Section 10(2)(d) as amended by Finance Act, 2023.
   - Restricted strictly to **intra-state supplies of goods**.
   - Prohibited from collecting GST from customers. System automatically generates a **Bill of Supply** with 0% tax.
5. **Missing or Inoperative PAN (Section 206AA & Section 206AB)**:
   - If the merchant fails to provide a verified PAN or the PAN is flagged inoperative due to Aadhaar non-linking, the settlement engine enforces **5.00% TDS** withholding under the Section 206AA proviso for Section 194-O.

---

## 4. Section C: Product Tax Engine (HSN/SAC & Place of Supply)

### 4.1 Master Table Schema (`tax_masters`)

```python
class TaxMaster(SQLModel, table=True):
    __tablename__ = "tax_masters"
    __table_args__ = (
        Index("ix_tax_masters_code", "code", unique=True),
        Index("ix_tax_masters_type", "code_type"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(max_length=20, nullable=False, unique=True) # e.g., '61091000', '998313'
    code_type: str = Field(default="HSN", max_length=10) # 'HSN' (Goods) or 'SAC' (Services)
    description: str = Field(max_length=500, nullable=False)

    # Standard Statutory Tax Rates (Percentages)
    gst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    cgst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    sgst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    igst_rate: Decimal = Field(sa_column=Column(Numeric(5, 2), nullable=False))
    cess_rate: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(5, 2), nullable=False))

    is_nil_rated: bool = Field(default=False, nullable=False)
    is_exempt: bool = Field(default=False, nullable=False)
    is_non_gst: bool = Field(default=False, nullable=False)

    effective_from: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    effective_to: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    ca_approval_status: str = Field(default="APPROVED", max_length=30)
    version: int = Field(default=1, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
```

### 4.2 Place-of-Supply (PoS) Mathematical Engine

The tax engine is implemented as a pure, deterministic, side-effect-free service executing in `backend/services/tax_engine.py`:

```
========================================================================================
                         PLACE OF SUPPLY (PoS) ALGORITHM
========================================================================================
Inputs:
  - Unit Selling Price (P)
  - Quantity (Q)
  - Price Inclusive of GST Flag (I)
  - Applicable GST Rate (R) and Cess Rate (C)
  - Seller State Code (S_origin)
  - Consignee Delivery State Code (S_destination)
  - Merchant Registration Type (Reg_Type)

Computation:
1. Base & Tax Extraction:
   Gross_Line_Total = round_half_up(P * Q, 2)
   
   IF Reg_Type IN ("composition", "unregistered", "enrolled_eco") OR R == 0:
       Taxable_Amount = Gross_Line_Total
       Total_Tax      = 0.00
       CGST_Amount    = 0.00
       SGST_Amount    = 0.00
       IGST_Amount    = 0.00
       Cess_Amount    = 0.00
   ELSE:
       IF I == True (MRP Inclusive):
           Taxable_Amount = round_half_up(Gross_Line_Total / (1 + (R + C) / 100), 2)
           Total_Tax      = Gross_Line_Total - Taxable_Amount
       ELSE (Price Exclusive):
           Taxable_Amount = Gross_Line_Total
           Total_Tax      = round_half_up(Taxable_Amount * (R + C) / 100, 2)
           Gross_Line_Total = Taxable_Amount + Total_Tax

       -- Determine PoS Jurisdictional Split:
       IF S_origin == S_destination (Intra-state):
           CGST_Rate   = R / 2
           SGST_Rate   = R / 2
           IGST_Rate   = 0.00
           CGST_Amount = round_half_up(Taxable_Amount * (CGST_Rate / 100), 2)
           SGST_Amount = Total_Tax - CGST_Amount -- Prevents rounding penny discrepancy
           IGST_Amount = 0.00
       ELSE (Inter-state):
           CGST_Rate   = 0.00
           SGST_Rate   = 0.00
           IGST_Rate   = R
           CGST_Amount = 0.00
           SGST_Amount = 0.00
           IGST_Amount = Total_Tax

       Cess_Amount = round_half_up(Taxable_Amount * (C / 100), 2) if C > 0 else 0.00
========================================================================================
```

### 4.3 Handling Edge Cases
- **Unclassified Products**: If a merchant creates a product without a valid `hsn_sac_id`, the product is tagged `tax_review_required = True`. The product is hidden from the public storefront and checkout is blocked until an approved HSN/SAC code is attached.
- **Historical Rate Changes & Immutability**: If the GST Council alters a rate (e.g., from 12% to 18% on Oct 1), the previous rule's `effective_to` is populated and a new `TaxMaster` version is seeded. Orders placed prior to Oct 1 pull the frozen snapshot from `order_items.pricing_snapshot` and remain completely untouched.

---

## 5. Section D: Customer GST Invoice & Credit Note System (Rule 46 & Rule 54)

### 5.1 Rule 46 Tax Invoice Requirements & Schema
Invoices generated by WebCreon AI conform strictly to Rule 46 of the CGST Rules, 2017:
- **Supplier Header**: Displays the Merchant's Legal Name, Trade Name, Registered Address, PAN, and GSTIN.
- **ECO Notation (Statutory)**: Displays: `"Order facilitated via Electronic Commerce Operator: WebCreon Technologies Pvt Ltd, GSTIN: 27AAACW1234F1Z1"`.
- **Recipient Details**: Displays Customer Name, Shipping Address, and Destination State Code (mandatory under Rule 46(e) for inter-state supplies exceeding ₹50,000, and standard practice for all B2C orders).
- **Line Item Itemization**: Full table detailing Item Description, HSN/SAC Code, Quantity, Unit Rate, Gross Value, Discount, Taxable Value, CGST Rate & Amount, SGST Rate & Amount, IGST Rate & Amount, and Line Total.

### 5.2 Sequential Alphanumeric Numbering Scheme
Under Rule 46(b), tax invoices must have a consecutive serial number not exceeding sixteen characters, unique for a financial year:
- **Format**: `{PREFIX}/{FY_CODE}/{000001}` (e.g., `WC/26-27/000142`).
- **Implementation**: Enforced via an atomic counter table in PostgreSQL (`invoice_sequences`) using `SELECT ... FOR UPDATE` locking to guarantee zero sequence collision and zero sequence gaps during high-concurrency checkout flash sales.

### 5.3 Rule 54 Credit Note Flow for Returns & Refunds
When an item is returned or refunded:
1. The system creates a **Rule 54 Tax Credit Note** (`tax_credit_notes`) linking explicitly to `tax_invoices.id`.
2. Reverses the exact taxable value and tax amounts (CGST/SGST or IGST) of the returned lines.
3. In the platform's monthly GST-TCS ledger, the credit note amount is credited to reduce the merchant's **Net Taxable Supplies** in the month of the return.
4. The customer receives a downloadable Credit Note PDF alongside their refund confirmation.

---

## 6. Section E: Platform Fee GST & B2B Invoicing (SAC 998313)

### 6.1 Service Classification & 18% GST Rate
- **Classification**: **SAC 998313** (*Information technology software consulting and support services*) or **SAC 998314** (*Internet telecommunications, marketplace, and portal hosting services*).
- **Statutory Rate**: Standard rate of **18.00% GST**.

### 6.2 Platform Commission Base & Inter-State Determination
The platform commission is computed strictly on the **Taxable Value of Products** (excluding product GST):
$$\text{Commission Base} = \text{Taxable Product Value} \times \text{Commission Percent (e.g., 3.00\%)}$$

- **Platform State**: Maharashtra (`27`).
- **If Merchant Registered State == '27' (Intra-state)**:
  - CGST: $9.00\%$ on Commission Base.
  - SGST: $9.00\%$ on Commission Base.
- **If Merchant Registered State != '27' (Inter-state)**:
  - IGST: $18.00\%$ on Commission Base.

### 6.3 B2B Invoicing Policy: Monthly Consolidated vs Per-Order

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            B2B INVOICE DESIGN EVALUATION                             │
├──────────────────────┬───────────────────────────────┬───────────────────────────────┤
│ Consideration        │ Per-Order B2B Invoicing       │ Monthly Consolidated Invoicing│
├──────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ Transaction Volume   │ Extremely high: 100k orders   │ Clean & Manageable: 1 invoice │
│                      │ creates 100k micro-invoices.  │ per active merchant per month.│
├──────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ Merchant Accounting  │ Overwhelms merchant CA with   │ Standard industry practice.   │
│ & ITC Reconciliation │ thousands of ₹3–₹6 invoices.  │ Merchant easily files ITC in  │
│                      │ High risk of GSTR-2B mismatches│ GSTR-3B using 1 summary bill. │
├──────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ Industry Alignment   │ Deviates from Indian norms.   │ Adopted by Amazon, Flipkart,  │
│                      │                               │ Swiggy, Zomato, Razorpay.     │
├──────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ FINAL POLICY VERDICT │ REJECTED                      │ ADOPTED (Generated on 1st of  │
│                      │                               │ following calendar month).    │
└──────────────────────┴───────────────────────────────┴───────────────────────────────┘
```

---

## 7. Section F: GST Tax Collection at Source (Section 52) Engine

### 7.1 Applicability Conditions
Under Section 52(1) of the CGST Act, 2017:
- WebCreon AI is statutorily mandated to collect TCS because consideration for third-party supplies is collected by the operator centrally via its payment gateway.
- **Statutory Rate (September 2026)**: **0.50% total** on Net Taxable Supplies (0.25% CGST + 0.25% SGST for intra-state; 0.50% IGST for inter-state) pursuant to CBIC Notification No. 52/2018-Central Tax.

### 7.2 Net Value of Taxable Supplies & Ignore-Negative Rule
Under the Explanation to Section 52(1):
$$\text{Net Taxable Supplies} = \sum (\text{Taxable Supplies of Goods/Services}) - \sum (\text{Taxable Supplies Returned})$$
$$\text{TCS Base} = \text{Net Taxable Supplies (Strictly excluding Product Taxes)}$$

```
========================================================================================
                      CBIC FAQ IGNORE-NEGATIVE RULE (INVARIANT 3)
========================================================================================
Statutory Precedent:
CBIC Official E-Commerce FAQs (Question 14 & Question 18).

Finding:
Where returns of goods exceed the value of supplies made by a merchant in a given
month, the net value of taxable supplies becomes negative.
The official GST Portal schema does NOT accept negative values in Table 4 of Form GSTR-8.

Enforcement Rule:
1. If Net_Taxable_Supplies <= 0 for Merchant M in Month T:
     - GST_TCS_CGST = ₹0.00
     - GST_TCS_SGST = ₹0.00
     - GST_TCS_IGST = ₹0.00
     - Total_GST_TCS = ₹0.00
2. The negative balance is IGNORED in Month T.
3. The negative balance is STRICTLY NOT CARRIED FORWARD into Month T+1.
   (Month T+1 starts fresh from ₹0.00 base).
========================================================================================
```

### 7.3 Form GSTR-8 Reporting Architecture
On the 1st of every month, the platform aggregates Table 4 of Form GSTR-8 (due on the 10th of the following month):
- `GSTIN of Supplier` (or `Enrolment ID` for unregistered sellers under Notification 34/2023-CT).
- `State Code of Place of Supply`.
- `Gross Value of Taxable Supplies`.
- `Value of Taxable Supplies Returned`.
- `Net Amount Liable for TCS`.
- `Central Tax (CGST TCS)`.
- `State/UT Tax (SGST TCS)`.
- `Integrated Tax (IGST TCS)`.

### 7.4 Multi-State TCS Registration Strategy (CA Confirmation Point)
> [!IMPORTANT]
> Under Section 24(x) of the CGST Act, an ECO collecting TCS must obtain a separate GST registration as a Tax Collector **in every Indian State/UT from which its merchants make supplies**.
> - **Initial Production Phase**: Platform obtains GST-TCS registration in Maharashtra (`27`) and restricts merchant onboarding to Maharashtra-origin warehouses.
> - **National Expansion Phase**: Platform obtains Tax Collector GST registrations in all 28 States and 8 UTs before opening multi-state seller onboarding.

---

## 8. Section G: Income-Tax TDS (Section 194-O) Engine

### 8.1 Rate Schedule & Entity Thresholds (FY 2026–27)
- **Governing Provision**: Section 194-O of the Income-tax Act, 1961 (as amended by Finance Act, 2024 to 0.1%).
- **Standard TDS Rate**: **0.10%** of gross sales.
- **Punitive Rate (Section 206AA)**: **5.00%** if PAN is missing, unverified, or inoperative.

### 8.2 Entity-Wise Threshold Decision Tree

```mermaid
graph TD
    A[Order Placed & Paid] --> B{Is Merchant Entity Individual or HUF?}
    B -- No (Company, LLP, Firm) --> C[Deduct 0.10% TDS from Rupee 1]
    B -- Yes --> D{Is PAN Verified & Compliant?}
    D -- No --> E[Deduct 5.00% TDS under Section 206AA]
    D -- Yes --> F{Cumulative FY Gross Sales + Current Order > ₹5,00,000?}
    F -- No --> G[TDS = ₹0.00 (Exempt under Sec 194-O 2)]
    F -- Yes --> H[Deduct 0.10% TDS on Current Order & Subsequent Orders]
```

### 8.3 Base for TDS (CBDT Circular No. 17/2020 Compliance)
- **Statutory Authority**: Question 1 & Question 2 of CBDT Circular No. 17/2020 (dated 29th September, 2020).
- **Rule**: Income-tax TDS under Section 194-O must be deducted on the **Gross Amount of Sales**, which **includes the GST component and customer delivery charges**.
$$\text{TDS-194O Base} = \text{Customer Gross Order Total (Taxable Base + Product GST + Shipping Gross)}$$
*(Note: Marked in Section 12 as a CA Confirmation point for final formal sign-off).*

### 8.4 Form 26Q Export & Quarterly Filing
Quarterly statement for Section 194-O (remitted via Challan 281 by the 7th of the following month; Form 26Q filed quarterly):
- `Deductee PAN`
- `Deductee Legal Name`
- `Section Code: 194O`
- `Date of Payment or Credit`
- `Amount Paid or Credited (Gross Base)`
- `Total Tax Deducted (TDS Amount)`
- `Date of Deduction`
- `Rate of TDS (0.10% or 5.00%)`

---

## 9. Section H: Settlement Ledger & Razorpay Route Reconciliation

### 9.1 Comprehensive Payout Formula (Enforcing Invariant 1)

$$\begin{aligned}
\text{Net Merchant Payout} = &\;\; \text{Customer Gross Order Total} \\
&- (\text{Platform Fee} + 18\%\text{ Fee GST}) \\
&- \text{Total Section 52 GST-TCS} \\
&- \text{Total Section 194-O TDS} \\
&- (\text{Razorpay Gateway MDR} + 18\%\text{ MDR GST})
\end{aligned}$$

### 9.2 Upgraded Multi-Component Ledger Schema (`tenant_ledger_entries`)

```sql
CREATE TABLE tenant_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admins(id),
    site_id UUID NOT NULL REFERENCES sites(id),
    order_id UUID REFERENCES orders(id),
    return_request_id UUID REFERENCES return_requests(id),
    
    -- Transaction Classification
    entry_type VARCHAR(40) NOT NULL DEFAULT 'order_sale', -- 'order_sale', 'order_refund', 'platform_fee_invoice', 'chargeback'

    -- 1. Customer Gross Financials
    gross_order_value NUMERIC(12, 2) NOT NULL,
    taxable_product_value NUMERIC(12, 2) NOT NULL,
    product_cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    product_sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    product_igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    product_cess NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    -- 2. Platform Commission & 18% GST (Withheld by Platform)
    platform_commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
    platform_commission_base NUMERIC(12, 2) NOT NULL,
    platform_fee_gst_cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    platform_fee_gst_sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    platform_fee_gst_igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_platform_fee_with_gst NUMERIC(12, 2) NOT NULL,

    -- 3. Section 52 GST-TCS (Withheld for GSTR-8 Remittance)
    gst_tcs_cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_tcs_sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_tcs_igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_gst_tcs NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    -- 4. Section 194-O Income-tax TDS (Withheld for Form 26Q Remittance)
    tds_rate_applied NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    income_tax_tds_194o NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    -- 5. Gateway Processing Fee (MDR Pass-Through)
    gateway_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gateway_fee_gst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    -- 6. Net Merchant Settlement Payout
    net_merchant_payout NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',

    -- Razorpay Route Escrow Tracking
    razorpay_transfer_id VARCHAR(64),
    transfer_status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'held', 'processed', 'reversed'
    escrow_status VARCHAR(30) NOT NULL DEFAULT 'held', -- 'held', 'unheld', 'reversed'
    escrow_release_due_at TIMESTAMPTZ,
    unheld_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 9.3 Razorpay Route Transfer Dispatch Walkthrough

```
Mathematical Walkthrough:
  - Product MRP: ₹2,360.00 (Inclusive of 18% IGST: ₹2,000.00 Base + ₹360.00 IGST)
  - Delivery Fee: ₹140.00 (Inclusive of 18% IGST: ₹118.64 Base + ₹21.36 IGST)
  - Gross Customer Paid: ₹2,500.00
  - Seller: Private Limited Company (MH), Customer: Karnataka (KA)

Deduction Waterfall:
  + Customer Gross Total:                              ₹2,500.00
  - Platform Commission (3% of ₹2,000 Base):             -₹60.00
  - Platform Fee GST (18% on ₹60):                       -₹10.80
  - Section 52 GST-TCS (0.50% on ₹2,118.64 Net Taxable): -₹10.59
  - Section 194-O TDS (0.10% on ₹2,500 Gross):            -₹2.50
  - Razorpay Gateway MDR (2% on ₹2,500):                 -₹50.00
  - GST on Gateway MDR (18% on ₹50):                      -₹9.00
  --------------------------------------------------------------
  NET MERCHANT PAYOUT:                                 ₹2,357.11 (235,711 Paise)
  AMOUNT RETAINED IN CENTRAL MID:                        ₹142.89

Razorpay Order Creation Payload:
  transfers_payload = [{
      "account": "acc_JaipurArtisans4402",
      "amount": 235711,
      "currency": "INR",
      "on_hold": 1,
      "notes": {
          "order_id": "ord_8f3b23c1",
          "platform_fee_with_gst": "70.80",
          "gst_tcs": "10.59",
          "it_tds": "2.50",
          "mdr_with_gst": "59.00"
      }
  }]
```

### 9.4 MDR Ingestion, Reconciliation & Input Tax Credit (ITC)
1. When Razorpay settles customer transactions, the backend reconciles against the daily settlement report CSV using `fee` and `tax` fields.
2. WebCreon AI receives a monthly B2B Tax Invoice from **Razorpay Software Private Limited** for gateway MDR expenses.
3. WebCreon's finance team claims **18% Input Tax Credit (ITC)** on Razorpay MDR in its monthly **Form GSTR-3B** return.

---

## 10. Section I: MDR Handling & Customer/Merchant UI Policies

### 10.1 Customer Checkout UI Policy
- **Visible Line Items**:
  1. Product Price (MRP inclusive or Taxable + GST)
  2. Delivery / Courier Charge
  3. Coupon Discount (if applied)
  4. **Total Payable Amount**
- **Strict Prohibition**: **Never display internal payment gateway MDR, GST-TCS, Section 194-O TDS, or platform commission to the customer.** These are commercial deductions between the platform, merchant, and tax authorities.

### 10.2 Customer Convenience Fee Policy
- **Baseline Policy**: **Zero convenience fee charged.**
- **Future Policy (If activated)**: If a payment instrument convenience fee is charged (e.g. ₹20 for Cash on Delivery or credit card premium):
  - It represents platform service revenue.
  - Platform must issue a separate B2C tax invoice from Platform to Customer with 18% GST.
  - The fee must be explicitly disclosed on the checkout screen before the customer initiates payment.

### 10.3 Merchant Dashboard View
The Merchant Order Drawer and Settlement Statement must show a transparent breakdown:
```
Gross Order Total:               ₹2,500.00
  - Product GST (Collected):        ₹381.36
Deductions:
  - Platform Marketplace Fee:       -₹60.00
  - GST on Platform Fee (18%):      -₹10.80
  - GST-TCS Withheld (0.5%):        -₹10.59
  - Income-tax TDS (0.1%):           -₹2.50
  - Gateway Processing MDR (2%+GST):-₹59.00
-------------------------------------------
Net Settlement (Razorpay Route): ₹2,357.11
Status: Held in Escrow (Release due on delivered + 7 days)
```

---

## 11. Section J: Testing Matrix, Invariant Verification & Go-Live Checklist

### 11.1 Automated Test Suite Matrix

| Test Suite | File Path | Focus & Assertions |
| :--- | :--- | :--- |
| **`TC-POS`** | `backend/test/test_tax_engine_pos.py` | Validates 50/50 CGST+SGST split for intra-state and 100% IGST split for inter-state across 0%, 5%, 12%, 18%, 28% rates. |
| **`TC-INCL`** | `backend/test/test_tax_engine_pos.py` | Validates penny-perfect base extraction for MRP-inclusive pricing ($Taxable = Price / (1 + Rate)$). |
| **`TC-TCS`** | `backend/test/test_statutory_withholding.py` | Validates 0.5% net calculation. **Asserts Invariant 3**: If returns > sales, verifies TCS == 0.00 and zero carry-forward. |
| **`TC-TDS`** | `backend/test/test_statutory_withholding.py` | Validates ₹5L threshold for Individual/HUF, 0.1% for Companies from Re 1, and 5.0% for missing PAN (Sec 206AA). |
| **`TC-SEQ`** | `backend/test/test_invoice_sequencer.py` | Concurrently fires 50 threads creating invoices; verifies strictly incrementing sequence with zero duplicate keys. |
| **`TC-BAL`** | `backend/test/test_settlement_ledger_route.py` | **Asserts Invariant 1**: Verifies $Gross == Net + PlatformFee + FeeGST + TCS + TDS + MDR$ across all test orders. |

### 11.2 Production Go-Live Gating Checklist

- [ ] **CA Formal Sign-Off**: Written attestation recorded on Section 12 policy sheet.
- [ ] **Razorpay Commercial Sign-Off**: Verification of MDR deduction schedule and Route linked account transfer fee structure.
- [ ] **GST REG-06 Registration**: WebCreon entity holds valid Tax Collector registration under Section 51/52 in primary operating state.
- [ ] **Feature Flag Guard**: `ENABLE_COMPLIANT_SETTLEMENT_SPLIT = False` until sandbox test suite achieves 100% pass rate.
- [ ] **Automated Test Matrix**: 50+ unit and integration tests passing in `backend/test/`.
- [ ] **Canary Pilot**: 3 pilot merchants run in shadow mode for 7 days with zero reconciliation variance.

---

## 12. Section K: Legal Provisions Mapping & CA Policy Attestation Sheet

The following statutory mapping outlines each design choice against official Indian law as of September 2026 for formal Chartered Accountant review and signature:

| Statutory Provision | Authority / Act | WebCreon Implementation Reference | Final / CA Confirmation Point | CA Signature & Seal |
| :--- | :--- | :--- | :--- | :--- |
| **Section 2(44), 2(45) CGST Act** | Central Board of Indirect Taxes & Customs | Section 2: ECO Marketplace Characterization (Not MoR) | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **Section 52(1) CGST Act** | CBIC Notification No. 52/2018-CT | Section 7: 0.5% Total GST-TCS Withholding on Net Supplies | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **Section 52(1) Explanation & FAQs**| CBIC E-Commerce FAQs (Q14, Q18) | Section 1 & 7.2: Invariant 3 (Negative Net Ignored & Not Carried Forward) | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **Notification No. 34/2023-CT** | CBIC Central Tax Notification | Section 3.2: Intra-state Lock for Unregistered Enrolment IDs | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **Rule 46 & 54 CGST Rules** | CGST Rules, 2017 | Section 5: Rule 46 Merchant Invoices & Rule 54 Credit Notes | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **SAC 998313 (18% GST)** | Notification No. 11/2017-CT (Rate) | Section 6: Monthly Consolidated B2B Invoices for Platform Fees | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **Section 194-O Income-tax Act** | CBDT / Finance Act, 2024 | Section 8: 0.1% TDS & ₹5,00,000 Individual/HUF Threshold | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **Section 206AA Income-tax Act**| Income-tax Act, 1961 | Section 3.2 & 8.1: 5.0% Punitive TDS Rate for Missing PAN | **FINAL STATUTORY BASELINE** | `[ PENDING ATTESTATION ]` |
| **CBDT Circular No. 17/2020 (Q1)** | Central Board of Direct Taxes | Section 8.3: TDS Base includes Product GST & Delivery | **REQUIRES CA WRITTEN CONFIRMATION** | `[ PENDING ATTESTATION ]` |
| **Multi-State TCS Registration**| Section 24(x) CGST Act | Section 7.4: Phase-1 Maharashtra vs National Multi-State Expansion | **REQUIRES CA WRITTEN CONFIRMATION** | `[ PENDING ATTESTATION ]` |

---
**Attestation Block**:
- **Chartered Accountant Name**: `________________________________________________`
- **Firm Name & Registration No. (FRN)**: `______________________________________`
- **Membership Number (M.No.)**: `_______________________________________________`
- **UDIN Generated for Attestation**: `__________________________________________`
- **Date & Location**: `________________________________________________________`
- **Signature & Stamp**: `_______________________________________________________`
