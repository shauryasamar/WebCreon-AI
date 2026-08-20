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
    SQLModel.metadata.create_all(engine)
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending';
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

                ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(30) DEFAULT 'manual';
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
            """))
            conn.commit()
    except Exception as e:
        print("Schema migration note:", e)


def get_session():
    with Session(engine) as session:
        yield session