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
                CREATE INDEX IF NOT EXISTS ix_orders_razorpay_order_id ON orders(razorpay_order_id);
                CREATE INDEX IF NOT EXISTS ix_orders_razorpay_payment_id ON orders(razorpay_payment_id);
                ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS customer_refund_account JSONB;

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
                CREATE INDEX IF NOT EXISTS ix_tenant_ledger_entries_razorpay_transfer_id ON tenant_ledger_entries(razorpay_transfer_id);
            """))
            conn.commit()
    except Exception as e:
        print("Schema migration note:", e)


def get_session():
    with Session(engine) as session:
        yield session