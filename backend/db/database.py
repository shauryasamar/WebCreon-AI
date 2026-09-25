import os

from sqlmodel import SQLModel, Session, create_engine


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://webnirmaan:devpassword@localhost:5432/webnirmaan",
)


engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=30,
)


from sqlalchemy import text


def create_db_and_tables():
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                DROP INDEX IF EXISTS ix_support_tickets_site_id;
                DROP INDEX IF EXISTS ix_support_tickets_customer_id;
                DROP INDEX IF EXISTS ix_support_tickets_order_id;
                DROP INDEX IF EXISTS ix_support_ticket_messages_ticket_id;
                DROP INDEX IF EXISTS ix_support_agents_site_id;
            """))
            conn.commit()
    except Exception:
        pass
    SQLModel.metadata.create_all(engine)
    try:
        with engine.connect() as conn:

            conn.execute(text("""
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT TRUE;
                CREATE INDEX IF NOT EXISTS ix_sites_is_online ON sites(is_online);
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending';
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS role_id UUID;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS additional_permissions JSONB;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS website_access_type VARCHAR(20) DEFAULT 'all';
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(128);
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS invited_by_admin_id UUID;
                CREATE INDEX IF NOT EXISTS ix_admins_invitation_token ON admins(invitation_token);
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_share NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_window_closes_at TIMESTAMPTZ;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(30) DEFAULT 'held';
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_unheld_at TIMESTAMPTZ;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(10);
                CREATE INDEX IF NOT EXISTS ix_orders_razorpay_order_id ON orders(razorpay_order_id);
                CREATE INDEX IF NOT EXISTS ix_orders_razorpay_payment_id ON orders(razorpay_payment_id);
                ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS customer_refund_account JSONB;
                ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS pickup_status VARCHAR(50);
                ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS pickup_details JSONB;
                ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
                ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS notes TEXT;

                ALTER TABLE tenant_bank_accounts ADD COLUMN IF NOT EXISTS razorpay_account_id VARCHAR(64);
                ALTER TABLE tenant_bank_accounts ADD COLUMN IF NOT EXISTS route_status VARCHAR(30) DEFAULT 'pending';
                ALTER TABLE tenant_bank_accounts ADD COLUMN IF NOT EXISTS route_onboarded_at TIMESTAMPTZ;
                ALTER TABLE tenant_bank_accounts ADD COLUMN IF NOT EXISTS bank_details_updated_at TIMESTAMPTZ;
                ALTER TABLE tenant_bank_accounts ADD COLUMN IF NOT EXISTS quarantine_until TIMESTAMPTZ;
                CREATE INDEX IF NOT EXISTS ix_tenant_bank_accounts_razorpay_account_id ON tenant_bank_accounts(razorpay_account_id);

                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS enable_cod BOOLEAN NOT NULL DEFAULT TRUE;
                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS max_cod_amount DOUBLE PRECISION NOT NULL DEFAULT 5000.0;

                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS razorpay_transfer_id VARCHAR(64);
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(30) DEFAULT 'pending';
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(30) DEFAULT 'held';
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS escrow_release_due_at TIMESTAMPTZ;
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS unheld_at TIMESTAMPTZ;
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER DEFAULT 500;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS video_position INTEGER DEFAULT 2;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS sibling_group VARCHAR(100);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS sibling_label VARCHAR(100);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS is_cod_allowed BOOLEAN;
                ALTER TABLE products ALTER COLUMN is_cod_allowed DROP NOT NULL;
                CREATE INDEX IF NOT EXISTS ix_products_sibling_group ON products(sibling_group);

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id UUID PRIMARY KEY,
                    site_id UUID,
                    admin_id UUID,
                    actor_email VARCHAR(255) NOT NULL,
                    actor_name VARCHAR(255),
                    actor_role VARCHAR(50),
                    action VARCHAR(100) NOT NULL,
                    category VARCHAR(50) NOT NULL DEFAULT 'general',
                    description TEXT NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent VARCHAR(500),
                    status VARCHAR(20) NOT NULL DEFAULT 'success',
                    details JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_audit_logs_site_id ON audit_logs(site_id);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_admin_id ON audit_logs(admin_id);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_category ON audit_logs(category);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_email ON audit_logs(actor_email);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type VARCHAR;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_name VARCHAR;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS summary VARCHAR;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR;
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type VARCHAR(50) DEFAULT 'USER';
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'web_app';
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100);
                ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_type ON audit_logs(resource_type);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_id ON audit_logs(resource_id);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_type ON audit_logs(actor_type);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_source ON audit_logs(source);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_idempotency_key ON audit_logs(idempotency_key);
                CREATE INDEX IF NOT EXISTS ix_audit_logs_correlation_id ON audit_logs(correlation_id);
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS agent_id UUID;
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS agent_token VARCHAR(128);
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS agent_accepted_at TIMESTAMPTZ;
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS agent_picked_up_at TIMESTAMPTZ;
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS courier_name VARCHAR(100);
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS courier_order_id VARCHAR(100);
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS awb_number VARCHAR(100);
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS label_url TEXT;
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS tracking_url TEXT;
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS proof_of_delivery_url TEXT;
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS notes TEXT;
                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(10);
                CREATE INDEX IF NOT EXISTS ix_shipments_delivery_mode ON shipments(delivery_mode);
                CREATE INDEX IF NOT EXISTS ix_shipments_agent_id ON shipments(agent_id);

                ALTER TABLE delivery_agents ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
                ALTER TABLE delivery_agents ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50) DEFAULT 'bike';
                ALTER TABLE delivery_agents ADD COLUMN IF NOT EXISTS cash_in_hand NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE delivery_agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
                CREATE INDEX IF NOT EXISTS ix_delivery_agents_site_phone ON delivery_agents(site_id, phone);

                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS allow_open_pickup BOOLEAN DEFAULT TRUE;
                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS enable_fleet BOOLEAN DEFAULT TRUE;
                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS enable_shiprocket BOOLEAN DEFAULT FALSE;
                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS enable_manual BOOLEAN DEFAULT TRUE;

                ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
                ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

                ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
                ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applies_to VARCHAR(30) DEFAULT 'all';
                ALTER TABLE coupons ADD COLUMN IF NOT EXISTS collection_ids JSONB DEFAULT '[]'::jsonb;
                ALTER TABLE coupons ADD COLUMN IF NOT EXISTS category_ids JSONB DEFAULT '[]'::jsonb;
                CREATE INDEX IF NOT EXISTS ix_coupons_site_id_is_public ON coupons(site_id, is_public);
                CREATE INDEX IF NOT EXISTS ix_coupons_site_id_applies_to ON coupons(site_id, applies_to);
                ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS geo_accuracy VARCHAR(30);

                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS sender_latitude DOUBLE PRECISION;
                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS sender_longitude DOUBLE PRECISION;
                ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS shiprocket_delivery_radius_km DOUBLE PRECISION;

                ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_badge BOOLEAN DEFAULT FALSE;
                ALTER TABLE collections ADD COLUMN IF NOT EXISTS badge_color VARCHAR(50);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8, 2);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8, 2);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8, 2);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '[]'::jsonb;
                CREATE INDEX IF NOT EXISTS ix_products_sku ON products(sku);

                ALTER TABLE sites ADD COLUMN IF NOT EXISTS default_return_window_days INTEGER DEFAULT 7;
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS default_hsn_code VARCHAR(50);
                ALTER TABLE sites ADD COLUMN IF NOT EXISTS default_tax_rate DOUBLE PRECISION;
                ALTER TABLE merchant_tax_profiles ADD COLUMN IF NOT EXISTS default_hsn_code VARCHAR(50);
                ALTER TABLE merchant_tax_profiles ADD COLUMN IF NOT EXISTS default_tax_rate DOUBLE PRECISION;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS return_window_days INTEGER;
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS return_window_days INTEGER DEFAULT 7;

                ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
                ALTER TABLE return_items ALTER COLUMN product_id DROP NOT NULL;
                ALTER TABLE inventory_movements ALTER COLUMN product_id DROP NOT NULL;

                ALTER TABLE admins ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS avatar_url TEXT;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'super_admin';
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Asia/Kolkata';
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
                ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100);
                ALTER TABLE admins ALTER COLUMN password_hash DROP NOT NULL;

                ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';
                ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(50);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
                ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
                ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

                ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;

                CREATE TABLE IF NOT EXISTS store_pages (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) NOT NULL,
                    subtitle VARCHAR(500),
                    content TEXT NOT NULL DEFAULT '',
                    page_type VARCHAR(50) NOT NULL DEFAULT 'custom',
                    is_published BOOLEAN NOT NULL DEFAULT TRUE,
                    is_default BOOLEAN NOT NULL DEFAULT FALSE,
                    meta_title VARCHAR(255),
                    meta_description VARCHAR(1000),
                    contact_email VARCHAR(255),
                    contact_phone VARCHAR(100),
                    contact_address VARCHAR(500),
                    contact_hours VARCHAR(255),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_store_pages_site_slug UNIQUE (site_id, slug)
                );
                CREATE INDEX IF NOT EXISTS ix_store_pages_site_id ON store_pages(site_id);
                CREATE INDEX IF NOT EXISTS ix_store_pages_slug ON store_pages(slug);
                CREATE INDEX IF NOT EXISTS ix_store_pages_site_slug ON store_pages(site_id, slug);

                UPDATE order_items SET return_window_days = 0, returnable_quantity = 0 WHERE order_id IN (SELECT id FROM orders WHERE id::text LIKE '2cd85585%');
                UPDATE orders SET escrow_status = 'unheld', return_window_closes_at = delivered_at WHERE id::text LIKE '2cd85585%';
                UPDATE tenant_ledger_entries SET escrow_status = 'unheld', status = 'paid', settled_at = CURRENT_TIMESTAMP WHERE order_id IN (SELECT id FROM orders WHERE id::text LIKE '2cd85585%');

                CREATE TABLE IF NOT EXISTS site_domains (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    domain VARCHAR(255) NOT NULL UNIQUE,
                    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                    domain_type VARCHAR(30) NOT NULL DEFAULT 'custom_subdomain',
                    status VARCHAR(30) NOT NULL DEFAULT 'dns_required',
                    ssl_status VARCHAR(30) NOT NULL DEFAULT 'ssl_pending',
                    dns_record_type VARCHAR(10) NOT NULL DEFAULT 'CNAME',
                    dns_record_name VARCHAR(100) NOT NULL,
                    dns_record_value VARCHAR(255) NOT NULL,
                    verification_token VARCHAR(128) NOT NULL,
                    last_verified_at TIMESTAMPTZ,
                    error_message TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_site_domains_site_id ON site_domains(site_id);
                CREATE INDEX IF NOT EXISTS ix_site_domains_domain ON site_domains(domain);
                CREATE INDEX IF NOT EXISTS ix_site_domains_status ON site_domains(status);
                CREATE UNIQUE INDEX IF NOT EXISTS ix_site_domains_one_active_primary 
                ON site_domains (site_id) 
                WHERE is_primary = TRUE AND status = 'connected';

                CREATE TABLE IF NOT EXISTS domain_operations (
                    id UUID PRIMARY KEY,
                    domain_id UUID NOT NULL REFERENCES site_domains(id) ON DELETE CASCADE,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    operation_type VARCHAR(50) NOT NULL,
                    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
                    status VARCHAR(30) NOT NULL DEFAULT 'pending',
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    provider_reference VARCHAR(255),
                    next_retry_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_domain_operations_domain_id ON domain_operations(domain_id);
                CREATE INDEX IF NOT EXISTS ix_domain_operations_status_retry ON domain_operations(status, next_retry_at);

                CREATE TABLE IF NOT EXISTS processed_provider_events (
                    id UUID PRIMARY KEY,
                    provider VARCHAR(50) NOT NULL,
                    event_id VARCHAR(128) NOT NULL,
                    resource_id VARCHAR(255),
                    payload_hash VARCHAR(64) NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'processed',
                    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_provider_event_id UNIQUE (provider, event_id)
                );

                CREATE TABLE IF NOT EXISTS site_slug_history (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    old_slug VARCHAR(255) NOT NULL UNIQUE,
                    reserved_until TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_site_slug_history_old_slug ON site_slug_history(old_slug);

                ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_release_date TIMESTAMPTZ;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_message TEXT;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_limit INTEGER;
                CREATE INDEX IF NOT EXISTS ix_products_is_preorder ON products(is_preorder);

                ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS preorder_release_date TIMESTAMPTZ;
                ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS preorder_message TEXT;

                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preorder_release_date TIMESTAMPTZ;
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preorder_message TEXT;

                ALTER TABLE orders ADD COLUMN IF NOT EXISTS contains_preorder BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_release_date TIMESTAMPTZ;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_released BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_released_at TIMESTAMPTZ;
                CREATE INDEX IF NOT EXISTS ix_orders_contains_preorder ON orders(contains_preorder);
                CREATE INDEX IF NOT EXISTS ix_orders_preorder_released ON orders(preorder_released);

                CREATE TABLE IF NOT EXISTS customer_notifications (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    event_type VARCHAR(80) NOT NULL,
                    category VARCHAR(40) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    is_read BOOLEAN NOT NULL DEFAULT FALSE,
                    read_at TIMESTAMPTZ,
                    related_entity_type VARCHAR(50),
                    related_entity_id VARCHAR(100),
                    action_url VARCHAR(500),
                    metadata JSONB,
                    idempotency_key VARCHAR(160) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_cust_notif_site_customer_created ON customer_notifications(site_id, customer_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS ix_cust_notif_site_customer_unread ON customer_notifications(site_id, customer_id, is_read);
                CREATE UNIQUE INDEX IF NOT EXISTS uq_cust_notif_site_idempotency ON customer_notifications(site_id, idempotency_key);

                CREATE TABLE IF NOT EXISTS store_email_settings (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    sender_name VARCHAR(255),
                    sender_email VARCHAR(255),
                    reply_to_email VARCHAR(255),
                    provider_type VARCHAR(50) NOT NULL DEFAULT 'smtp',
                    smtp_host VARCHAR(255),
                    smtp_port INTEGER NOT NULL DEFAULT 587,
                    smtp_user VARCHAR(255),
                    smtp_password_encrypted TEXT,
                    smtp_use_tls BOOLEAN NOT NULL DEFAULT TRUE,
                    smtp_use_ssl BOOLEAN NOT NULL DEFAULT FALSE,
                    verification_status VARCHAR(40) NOT NULL DEFAULT 'not_configured',
                    verification_token VARCHAR(128),
                    verification_error TEXT,
                    last_verified_at TIMESTAMPTZ,
                    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_store_email_settings_site UNIQUE (site_id)
                );
                CREATE INDEX IF NOT EXISTS ix_store_email_settings_site_id ON store_email_settings(site_id);

                CREATE TABLE IF NOT EXISTS notification_delivery_logs (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    channel VARCHAR(30) NOT NULL,
                    recipient VARCHAR(255) NOT NULL,
                    event_type VARCHAR(80) NOT NULL,
                    subject VARCHAR(255),
                    status VARCHAR(30) NOT NULL DEFAULT 'queued',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_attempts INTEGER NOT NULL DEFAULT 3,
                    last_error TEXT,
                    locked_at TIMESTAMPTZ,
                    idempotency_key VARCHAR(160) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    sent_at TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS ix_notif_log_site_created ON notification_delivery_logs(site_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS ix_notif_log_site_status ON notification_delivery_logs(site_id, status);
                CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_log_site_idempotency ON notification_delivery_logs(site_id, idempotency_key);

                -- =========================================================================
                -- INDIAN FINTECH & STATUTORY COMPLIANCE DDL EXTENSIONS (GST, TCS, TDS)
                -- =========================================================================
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

                CREATE TABLE IF NOT EXISTS merchant_tax_profiles (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
                    admin_id UUID REFERENCES admins(id),
                    legal_business_name VARCHAR(255) NOT NULL,
                    trade_name VARCHAR(255),
                    entity_type VARCHAR(50) NOT NULL DEFAULT 'proprietorship',
                    registration_type VARCHAR(50) NOT NULL DEFAULT 'regular',
                    pan_number VARCHAR(10) NOT NULL,
                    pan_holder_name VARCHAR(255),
                    is_pan_verified BOOLEAN NOT NULL DEFAULT FALSE,
                    pan_verified_at TIMESTAMPTZ,
                    pan_verification_source VARCHAR(50),
                    gstin VARCHAR(15),
                    enrolment_id VARCHAR(20),
                    is_gstin_verified BOOLEAN NOT NULL DEFAULT FALSE,
                    gstin_verified_at TIMESTAMPTZ,
                    state_code VARCHAR(2) NOT NULL,
                    state_name VARCHAR(100),
                    address_line1 VARCHAR(255),
                    address_line2 VARCHAR(255),
                    city VARCHAR(100),
                    pincode VARCHAR(10),
                    is_composition_dealer BOOLEAN NOT NULL DEFAULT FALSE,
                    allow_interstate_sales BOOLEAN NOT NULL DEFAULT TRUE,
                    current_fy VARCHAR(10) NOT NULL DEFAULT '2026-2027',
                    fy_gross_sales_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
                    fy_tds_deducted_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_mtp_site_id ON merchant_tax_profiles(site_id);
                CREATE INDEX IF NOT EXISTS ix_mtp_pan ON merchant_tax_profiles(pan_number);
                CREATE INDEX IF NOT EXISTS ix_mtp_gstin ON merchant_tax_profiles(gstin);

                CREATE TABLE IF NOT EXISTS tax_invoices (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
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

                CREATE TABLE IF NOT EXISTS tax_credit_notes (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
                    original_invoice_id UUID NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
                    return_request_id UUID REFERENCES return_requests(id) ON DELETE SET NULL,
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

                CREATE TABLE IF NOT EXISTS platform_tax_invoices (
                    id UUID PRIMARY KEY,
                    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
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

                CREATE TABLE IF NOT EXISTS invoice_sequences (
                    site_id UUID NOT NULL,
                    financial_year VARCHAR(10) NOT NULL,
                    document_type VARCHAR(20) NOT NULL,
                    current_value INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (site_id, financial_year, document_type)
                );

                ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_sac_id UUID REFERENCES tax_masters(id);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS price_inclusive_of_gst BOOLEAN NOT NULL DEFAULT TRUE;
                ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate_override NUMERIC(5, 2);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_review_required BOOLEAN NOT NULL DEFAULT FALSE;

                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS entry_type VARCHAR(40) NOT NULL DEFAULT 'order_sale';
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS return_request_id UUID REFERENCES return_requests(id);
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS gross_order_value NUMERIC(12, 2);
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS taxable_product_value NUMERIC(12, 2);
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS product_cgst NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS product_sgst NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS product_igst NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS product_cess NUMERIC(12, 2) DEFAULT 0.00;
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
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS gateway_fee_gst NUMERIC(12, 2) DEFAULT 0.00;
                ALTER TABLE tenant_ledger_entries ADD COLUMN IF NOT EXISTS net_merchant_payout NUMERIC(12, 2);

                -- Ensure order_id index is non-unique to support multiple ledger postings (refunds/adjustments) per order
                DROP INDEX IF EXISTS ix_tenant_ledger_entries_order_id;
                CREATE INDEX IF NOT EXISTS ix_tenant_ledger_entries_order_id ON tenant_ledger_entries (order_id);

                -- Seed standard tax masters if empty
                INSERT INTO tax_masters (id, code, code_type, description, gst_rate, cgst_rate, sgst_rate, igst_rate, cess_rate, is_nil_rated, is_exempt, is_non_gst, effective_from, ca_approval_status, is_active, version, created_at)
                VALUES 
                  ('c1091000-0000-0000-0000-000000006109', '61091000', 'HSN', 'T-shirts, singlets and other vests, knitted or crocheted, of cotton', 5.00, 2.50, 2.50, 5.00, 0.00, FALSE, FALSE, FALSE, '2017-07-01 00:00:00+00', 'APPROVED', TRUE, 1, NOW()),
                  ('c4202221-0000-0000-0000-000000004202', '42022210', 'HSN', 'Handbags with outer surface of leather or composition leather', 18.00, 9.00, 9.00, 18.00, 0.00, FALSE, FALSE, FALSE, '2017-07-01 00:00:00+00', 'APPROVED', TRUE, 1, NOW()),
                  ('c8517130-0000-0000-0000-000000008517', '85171300', 'HSN', 'Smartphones and other cellular telecommunication apparatus', 18.00, 9.00, 9.00, 18.00, 0.00, FALSE, FALSE, FALSE, '2017-07-01 00:00:00+00', 'APPROVED', TRUE, 1, NOW()),
                  ('c8471301-0000-0000-0000-000000008471', '84713010', 'HSN', 'Personal computers, laptops, notebooks and sub-notebooks', 18.00, 9.00, 9.00, 18.00, 0.00, FALSE, FALSE, FALSE, '2017-07-01 00:00:00+00', 'APPROVED', TRUE, 1, NOW()),
                  ('c9983130-0000-0000-0000-000000998313', '998313', 'SAC', 'Information technology (IT) software, consulting, and support services', 18.00, 9.00, 9.00, 18.00, 0.00, FALSE, FALSE, FALSE, '2017-07-01 00:00:00+00', 'APPROVED', TRUE, 1, NOW()),
                  ('c9983140-0000-0000-0000-000000998314', '998314', 'SAC', 'Internet telecommunication, portal hosting, and marketplace facilitation services', 18.00, 9.00, 9.00, 18.00, 0.00, FALSE, FALSE, FALSE, '2017-07-01 00:00:00+00', 'APPROVED', TRUE, 1, NOW()),
                  ('c4901101-0000-0000-0000-000000004901', '49011010', 'HSN', 'Printed books, brochures, leaflets, and similar printed matter', 0.00, 0.00, 0.00, 0.00, 0.00, TRUE, FALSE, FALSE, '2017-07-01 00:00:00+00', 'APPROVED', TRUE, 1, NOW())
                ON CONFLICT (code) DO NOTHING;

                -- Seed Merchant Support FAQ Categories
                INSERT INTO merchant_support_faq_categories (id, name, slug, icon_name, sort_order, is_active, created_at)
                VALUES
                  ('c1a2b3c4-0001-0000-0000-000000000001', 'Billing & Plans', 'billing-plans', 'CreditCard', 1, TRUE, NOW()),
                  ('c1a2b3c4-0002-0000-0000-000000000002', 'Domains & SSL', 'domains-ssl', 'Globe', 2, TRUE, NOW()),
                  ('c1a2b3c4-0003-0000-0000-000000000003', 'Storefront & Products', 'storefront-products', 'Store', 3, TRUE, NOW()),
                  ('c1a2b3c4-0004-0000-0000-000000000004', 'Orders & Delivery', 'orders-delivery', 'Package', 4, TRUE, NOW()),
                  ('c1a2b3c4-0005-0000-0000-000000000005', 'Payments & Payouts', 'payments-payouts', 'Banknote', 5, TRUE, NOW()),
                  ('c1a2b3c4-0006-0000-0000-000000000006', 'AI Credits & Co-Pilot', 'ai-credits-copilot', 'Sparkles', 6, TRUE, NOW())
                ON CONFLICT (slug) DO NOTHING;

                -- Seed Comprehensive Merchant Support FAQ Items
                INSERT INTO merchant_support_faq_items (id, category_id, question, answer_rich_text, sort_order, is_published, is_featured_inline, view_count, helpful_count, not_helpful_count, created_at, updated_at)
                VALUES
                  -- Storefront & Products
                  ('f1a2b3c4-0001-0000-0000-000000000001', 'c1a2b3c4-0003-0000-0000-000000000003', 'Why did my products become draft?', 'Products are placed in Draft if your active catalog exceeds your plan limit (200 on Free, 1,000 on Starter, Unlimited on Pro) or if saved with missing required attributes (title or selling price). You can edit and re-activate products anytime once active slot capacity is available.', 1, TRUE, TRUE, 120, 14, 0, NOW(), NOW()),
                  ('f1a2b3c4-0007-0000-0000-000000000003', 'c1a2b3c4-0003-0000-0000-000000000003', 'How do product variants and product families work?', 'Variants (such as sizes or colors) are configured directly on the product without requiring separate SKUs. If you offer multiple products that share the same design style, you can link them to the same Product Family so customers can switch between options on your product page.', 2, TRUE, FALSE, 84, 10, 0, NOW(), NOW()),
                  ('f1a2b3c4-0010-0000-0000-000000000003', 'c1a2b3c4-0003-0000-0000-000000000003', 'Will editing or drafting a product alter past orders or invoices?', 'No. Past orders maintain immutable legal snapshots of product details, prices, and tax rates at the exact time of purchase. Editing or drafting an item in your active catalog will not alter past invoices or customer receipts.', 3, TRUE, FALSE, 65, 8, 0, NOW(), NOW()),
                  
                  -- AI Credits & Visual Canvas
                  ('f1a2b3c4-0003-0000-0000-000000000006', 'c1a2b3c4-0006-0000-0000-000000000006', 'How do canvas snapshots and publishing work?', 'In the Visual Editor, you can save Version Snapshots at any design milestone. You can preview and apply any previous snapshot at any time. When you are ready to make changes live to customers, clicking Publish Changes deploys the latest layout to WebCreon global CDN edge network.', 4, TRUE, TRUE, 142, 22, 0, NOW(), NOW()),
                  ('f1a2b3c4-0009-0000-0000-000000000006', 'c1a2b3c4-0006-0000-0000-000000000006', 'How are AI generation credits allocated and used?', 'AI credits power storefront generation, product copy, and AI Co-Pilot synthesis. Free accounts receive 300 base credits monthly, Starter includes 1,000 credits/mo, and Pro includes 2,000 credits/mo. Credits remain valid throughout your active billing cycle.', 5, TRUE, FALSE, 105, 15, 0, NOW(), NOW()),
                  ('f1a2b3c4-0011-0000-0000-000000000006', 'c1a2b3c4-0006-0000-0000-000000000006', 'How does the AI Storefront Generator work?', 'Provide your brand name, industry, and desired aesthetic. The AI engine synthesizes high-converting layouts, responsive color palettes, typography pairings, and placeholder banners in under 30 seconds using your available AI credits.', 6, TRUE, FALSE, 90, 11, 0, NOW(), NOW()),
                  
                  -- Domains & SSL
                  ('f1a2b3c4-0004-0000-0000-000000000002', 'c1a2b3c4-0002-0000-0000-000000000002', 'How do I connect my custom domain?', 'Navigate to Settings → Domains, enter your custom domain (e.g. shop.yourbrand.com), and copy the provided CNAME / A DNS records into your domain registrar (GoDaddy, Cloudflare, Namecheap). SSL provisioning and DNS routing activate within 10–15 minutes.', 7, TRUE, TRUE, 88, 11, 0, NOW(), NOW()),
                  ('f1a2b3c4-0012-0000-0000-000000000002', 'c1a2b3c4-0002-0000-0000-000000000002', 'What happens to my custom domain if my plan expires?', 'Custom domain routing requires an active Starter or Pro subscription. If your plan expires, domain routing pauses and your store safely falls back to your free WebCreon subdomain until your subscription is renewed.', 8, TRUE, FALSE, 72, 7, 0, NOW(), NOW()),
                  
                  -- Orders & Delivery
                  ('f1a2b3c4-0006-0000-0000-000000000004', 'c1a2b3c4-0004-0000-0000-000000000004', 'How does Shiprocket shipping & fulfillment work?', 'WebCreon integrates with Shiprocket to automate courier label printing, scheduled pickups, and customer live delivery tracking. Dispatched courier freight is non-reversible, and refunding customer shipping fees on returns is at your sole discretion.', 9, TRUE, TRUE, 110, 18, 1, NOW(), NOW()),
                  ('f1a2b3c4-0013-0000-0000-000000000004', 'c1a2b3c4-0004-0000-0000-000000000004', 'How do customer return requests work?', 'Customers can initiate return requests from their live order tracking page. You can review customer reasons and submitted photos in Orders & Returns, and either approve a reverse courier pickup or reject with an explanation.', 10, TRUE, FALSE, 83, 9, 0, NOW(), NOW()),
                  ('f1a2b3c4-0014-0000-0000-000000000004', 'c1a2b3c4-0004-0000-0000-000000000004', 'What are the stages of an order lifecycle?', 'Orders progress through Pending (checkout in progress) → Paid (confirmed & ready to pack) → Shipped (AWB generated & in transit) → Delivered (handover confirmed) → Completed (escrow matured).', 11, TRUE, FALSE, 78, 10, 0, NOW(), NOW()),
                  
                  -- Payments & Payouts
                  ('f1a2b3c4-0008-0000-0000-000000000005', 'c1a2b3c4-0005-0000-0000-000000000005', 'When are order earnings released to my bank account?', 'Order earnings are held in compliant escrow until courier delivery confirmation plus dispute window (T+2 days). Once matured, available balances are transferred to your verified bank account or UPI VPA configured in Payout Settings.', 12, TRUE, FALSE, 92, 12, 0, NOW(), NOW()),
                  ('f1a2b3c4-0015-0000-0000-000000000005', 'c1a2b3c4-0005-0000-0000-000000000005', 'What deductions are applied to my gross sales?', 'Your net payout equals Gross Order Total minus Razorpay transaction fees (approx 2%), minus courier shipping costs (if fulfilled via Shiprocket), and statutory TCS withholding if applicable under GST.', 13, TRUE, FALSE, 86, 11, 0, NOW(), NOW()),
                  
                  -- Billing & Plans
                  ('f1a2b3c4-0002-0000-0000-000000000001', 'c1a2b3c4-0001-0000-0000-000000000001', 'What happens when my paid plan expires?', 'When a paid subscription plan expires or is cancelled, your store transitions immediately to the Free tier with zero grace period charges. Your first 200 products remain active while additional products are safely preserved in Draft status. Custom domain connections and team roles are paused until renewed.', 14, TRUE, TRUE, 95, 8, 1, NOW(), NOW()),
                  ('f1a2b3c4-0005-0000-0000-000000000001', 'c1a2b3c4-0001-0000-0000-000000000001', 'How does the 7-day money-back guarantee work?', 'All first-time paid plan upgrades (Starter and Pro) are protected by a 100% money-back guarantee within 7 calendar days of your upgrade. To request a refund, submit a support inquiry under Billing & Plans or email billing@webcreon.com.', 15, TRUE, TRUE, 76, 9, 0, NOW(), NOW()),
                  ('f1a2b3c4-0016-0000-0000-000000000001', 'c1a2b3c4-0001-0000-0000-000000000001', 'Where can I download official GST tax invoices for my subscription?', 'In Admin → Billing Settings → Invoices & Receipts, each subscription charge has a downloadable B2B Tax Invoice (PDF) with your GSTIN, WebCreon GSTIN, SAC code 998313, and statutory CGST/SGST/IGST breakdowns.', 16, TRUE, FALSE, 98, 14, 0, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET 
                  category_id = EXCLUDED.category_id,
                  question = EXCLUDED.question,
                  answer_rich_text = EXCLUDED.answer_rich_text,
                  sort_order = EXCLUDED.sort_order,
                  is_published = EXCLUDED.is_published,
                  is_featured_inline = EXCLUDED.is_featured_inline,
                  updated_at = NOW();

                -- Subscription & Billing Hardened Schema Migrations
                ALTER TABLE products ADD COLUMN IF NOT EXISTS draft_reason VARCHAR(50);
                ALTER TABLE products ADD COLUMN IF NOT EXISTS drafted_at TIMESTAMPTZ;
                CREATE INDEX IF NOT EXISTS ix_products_draft_reason ON products (draft_reason);

                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS provider_name VARCHAR(50) DEFAULT 'razorpay';
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(128);
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(128);
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS provider_plan_id VARCHAR(128);
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS provider_payment_method_id VARCHAR(128);
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS current_provider_status VARCHAR(50);
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS latest_provider_event_id VARCHAR(128);
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS latest_provider_event_created_at TIMESTAMPTZ;
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS latest_provider_sequence INTEGER;
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS latest_provider_state_version INTEGER;
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;
                ALTER TABLE website_subscriptions ADD COLUMN IF NOT EXISTS last_reconciliation_status VARCHAR(50);

                ALTER TABLE ai_credit_batches ADD COLUMN IF NOT EXISTS batch_type VARCHAR(50) DEFAULT 'FREE_BASE';
                ALTER TABLE ai_credit_batches ADD COLUMN IF NOT EXISTS cycle_start_at TIMESTAMPTZ DEFAULT NOW();

                -- Immutability trigger for append-only audit events (PostgreSQL)
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'website_subscription_events') THEN
                        CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
                        RETURNS TRIGGER AS $audit_func$
                        BEGIN
                            RAISE EXCEPTION 'Audit records in website_subscription_events are strictly immutable and cannot be updated or deleted.';
                        END;
                        $audit_func$ LANGUAGE plpgsql;

                        DROP TRIGGER IF EXISTS trg_immutable_sub_events_update ON website_subscription_events;
                        CREATE TRIGGER trg_immutable_sub_events_update
                        BEFORE UPDATE OR DELETE ON website_subscription_events
                        FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();
                    END IF;
                END $$;
            """))
            conn.commit()
    except Exception as e:
        print("Schema migration note:", e)


def get_session():
    with Session(engine) as session:
        yield session