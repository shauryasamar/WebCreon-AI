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
                CREATE INDEX IF NOT EXISTS ix_tenant_bank_accounts_razorpay_account_id ON tenant_bank_accounts(razorpay_account_id);

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
                CREATE INDEX IF NOT EXISTS ix_coupons_site_id_is_public ON coupons(site_id, is_public);
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
            """))
            conn.commit()
    except Exception as e:
        print("Schema migration note:", e)


def get_session():
    with Session(engine) as session:
        yield session