# WebCreon AI: Data Models & Database Migrations Specification
**Document Ref**: `docs/tax-compliance/04-data-model-and-migrations.md`  
**Database**: PostgreSQL / SQLModel  
**Strategy**: Non-destructive, append-only extension via lifespan DDL migrations  

---

## 1. Schema Extensions in `backend/models.py`

### A. New Models
1. **`MerchantTaxProfile`**: Stores verified merchant KYC, entity type, PAN, GSTIN, registered address, state code, and cumulative FY sales tracker.
2. **`TaxMaster`**: Configuration-driven HSN/SAC master with effective-dated GST rates and CA approval metadata.
3. **`TaxInvoice`**: Rule 46 compliant customer tax invoice entity with sequential numbering per merchant per FY.
4. **`TaxCreditNote`**: Rule 54 compliant credit note entity linked to the original invoice for returns/refunds.
5. **`PlatformTaxInvoice`**: Monthly B2B invoice from WebCreon AI to merchants for marketplace facilitation services (SAC 998313, 18% GST).
6. **`InvoiceSequence`**: Atomic lockable counter table guaranteeing gap-free consecutive invoice numbers.

### B. Modified Existing Models
1. **`Product`**: Add `hsn_sac_id: Optional[UUID]`, `price_inclusive_of_gst: bool = True`, `tax_rate_override: Optional[Decimal]`, `tax_review_required: bool = False`.
2. **`OrderItem`**: In `pricing_snapshot`, persist full immutable tax audit trail (`hsn_code`, `taxable_amount`, `cgst_rate`, `cgst_amount`, `sgst_rate`, `sgst_amount`, `igst_rate`, `igst_amount`).
3. **`TenantLedgerEntry`**: Upgrade from naive 4-field schema to comprehensive multi-component financial breakdown (`gross_order_value`, `taxable_product_value`, `product_cgst`, `product_sgst`, `product_igst`, `platform_commission_base`, `platform_fee_gst_cgst`, `platform_fee_gst_sgst`, `platform_fee_gst_igst`, `gst_tcs_cgst`, `gst_tcs_sgst`, `gst_tcs_igst`, `income_tax_tds_194o`, `net_merchant_payout`).

---

## 2. DDL Migration Script for `backend/db/database.py`

The following idempotent SQL block is added to `create_db_and_tables()`:

```sql
-- 1. Create Tax Masters Table
CREATE TABLE IF NOT EXISTS tax_masters (
    id UUID PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    code_type VARCHAR(10) NOT NULL DEFAULT 'HSN',
    description VARCHAR(500) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL,
    cgst_rate NUMERIC(5, 2) NOT NULL,
    sgst_rate NUMERIC(5, 2) NOT NULL,
    igst_rate NUMERIC(5, 2) NOT NULL,
    cess_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_nil_rated BOOLEAN NOT NULL DEFAULT FALSE,
    is_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    is_non_gst BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    ca_approval_status VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_tax_masters_code ON tax_masters(code);
CREATE INDEX IF NOT EXISTS ix_tax_masters_type ON tax_masters(code_type);

-- 2. Create Merchant Tax Profiles Table
CREATE TABLE IF NOT EXISTS merchant_tax_profiles (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL UNIQUE REFERENCES sites(id),
    admin_id UUID NOT NULL REFERENCES admins(id),
    legal_business_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    entity_type VARCHAR(50) NOT NULL DEFAULT 'proprietorship',
    registration_type VARCHAR(50) NOT NULL DEFAULT 'regular',
    pan_number VARCHAR(10) NOT NULL,
    pan_holder_name VARCHAR(255),
    is_pan_verified BOOLEAN NOT NULL DEFAULT FALSE,
    pan_verification_details JSONB,
    gstin VARCHAR(15),
    enrolment_id VARCHAR(20),
    is_gstin_verified BOOLEAN NOT NULL DEFAULT FALSE,
    gstin_verification_details JSONB,
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    is_composition_dealer BOOLEAN NOT NULL DEFAULT FALSE,
    allow_interstate_sales BOOLEAN NOT NULL DEFAULT TRUE,
    current_fy VARCHAR(10) NOT NULL DEFAULT '2026-2027',
    fy_gross_sales_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    fy_tds_deducted_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_merchant_tax_profiles_site_id ON merchant_tax_profiles(site_id);
CREATE INDEX IF NOT EXISTS ix_merchant_tax_profiles_pan ON merchant_tax_profiles(pan_number);
CREATE INDEX IF NOT EXISTS ix_merchant_tax_profiles_gstin ON merchant_tax_profiles(gstin);

-- 3. Create Tax Invoices Table (Rule 46)
CREATE TABLE IF NOT EXISTS tax_invoices (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    invoice_number VARCHAR(50) NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supplier_legal_name VARCHAR(255) NOT NULL,
    supplier_trade_name VARCHAR(255),
    supplier_gstin VARCHAR(15),
    supplier_pan VARCHAR(10) NOT NULL,
    supplier_address JSONB NOT NULL,
    supplier_state_code VARCHAR(2) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_address JSONB NOT NULL,
    recipient_state_code VARCHAR(2) NOT NULL,
    place_of_supply_state_code VARCHAR(2) NOT NULL,
    eco_legal_name VARCHAR(255) NOT NULL DEFAULT 'WebCreon Technologies Private Limited',
    eco_gstin VARCHAR(15) NOT NULL DEFAULT '27AAACW1234F1Z1',
    taxable_value NUMERIC(12, 2) NOT NULL,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_tax_amount NUMERIC(12, 2) NOT NULL,
    total_invoice_value NUMERIC(12, 2) NOT NULL,
    items_snapshot JSONB NOT NULL,
    pdf_storage_path VARCHAR(500),
    qr_code_data TEXT,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tax_invoices_seq UNIQUE (site_id, financial_year, invoice_number)
);
CREATE INDEX IF NOT EXISTS ix_tax_invoices_order_id ON tax_invoices(order_id);
CREATE INDEX IF NOT EXISTS ix_tax_invoices_site_id ON tax_invoices(site_id);

-- 4. Create Tax Credit Notes Table (Rule 54)
CREATE TABLE IF NOT EXISTS tax_credit_notes (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id),
    original_invoice_id UUID NOT NULL REFERENCES tax_invoices(id),
    return_request_id UUID REFERENCES return_requests(id),
    credit_note_number VARCHAR(50) NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    credit_note_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason_for_issuance VARCHAR(100) NOT NULL DEFAULT 'Goods Returned',
    taxable_value NUMERIC(12, 2) NOT NULL,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_credit_value NUMERIC(12, 2) NOT NULL,
    items_snapshot JSONB NOT NULL,
    pdf_storage_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tax_credit_notes_seq UNIQUE (site_id, financial_year, credit_note_number)
);
CREATE INDEX IF NOT EXISTS ix_tax_credit_notes_orig_inv ON tax_credit_notes(original_invoice_id);

-- 5. Create Platform Tax Invoices Table (B2B Commission Invoicing)
CREATE TABLE IF NOT EXISTS platform_tax_invoices (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id),
    billing_month VARCHAR(7) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    financial_year VARCHAR(10) NOT NULL,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sac_code VARCHAR(10) NOT NULL DEFAULT '998313',
    platform_gstin VARCHAR(15) NOT NULL DEFAULT '27AAACW1234F1Z1',
    platform_state_code VARCHAR(2) NOT NULL DEFAULT '27',
    merchant_gstin VARCHAR(15),
    merchant_state_code VARCHAR(2) NOT NULL,
    is_b2b BOOLEAN NOT NULL DEFAULT TRUE,
    total_order_gmv NUMERIC(14, 2) NOT NULL,
    commission_taxable_base NUMERIC(12, 2) NOT NULL,
    subscription_fees NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_invoice_value NUMERIC(12, 2) NOT NULL,
    pdf_storage_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_platform_tax_invoices_month UNIQUE (site_id, billing_month)
);

-- 6. Create Sequential Counter Table
CREATE TABLE IF NOT EXISTS invoice_sequences (
    site_id UUID NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    document_type VARCHAR(20) NOT NULL, -- 'INVOICE', 'CREDIT_NOTE', 'PLATFORM_FEE'
    current_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (site_id, financial_year, document_type)
);

-- 7. Extend Existing Tables with Compliance Columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_sac_id UUID REFERENCES tax_masters(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_inclusive_of_gst BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate_override NUMERIC(5, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_review_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS gross_order_value NUMERIC(12, 2);
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS taxable_product_value NUMERIC(12, 2);
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS product_cgst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS product_sgst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS product_igst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS platform_commission_base NUMERIC(12, 2);
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS platform_fee_gst_cgst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS platform_fee_gst_sgst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS platform_fee_gst_igst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS total_platform_fee_with_gst NUMERIC(12, 2);
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS gst_tcs_cgst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS gst_tcs_sgst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS gst_tcs_igst NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS total_gst_tcs NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS tds_rate_applied NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS income_tax_tds_194o NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS net_merchant_payout NUMERIC(12, 2);
```
