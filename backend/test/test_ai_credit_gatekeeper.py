import pytest
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from db.database import engine
from models import Admin, AICreditBatch
from services.ai_credit_service import check_account_has_credits, get_account_credit_balance

@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session

def test_check_account_has_credits_zero_balance(db_session: Session):
    # 1. Create a dummy admin with 0 credits
    test_admin_id = uuid4()
    admin = Admin(
        id=test_admin_id,
        email=f"test_zero_{test_admin_id.hex[:6]}@example.com",
        password_hash="test",
        is_owner=True,
    )
    db_session.add(admin)
    db_session.commit()

    now = datetime.now(timezone.utc)
    batch = AICreditBatch(
        id=uuid4(),
        admin_id=test_admin_id,
        batch_type="FREE_BASE",
        cycle_start_at=now,
        allocated_amount=100,
        remaining_amount=0,
        expiry_date=now + timedelta(days=29),
        status="ACTIVE",
    )
    db_session.add(batch)
    db_session.commit()

    has_credits, total_rem, reset_date = check_account_has_credits(db_session, test_admin_id)
    assert has_credits is False
    assert total_rem == 0

def test_check_account_has_credits_with_active_batch(db_session: Session):
    # 2. Create admin with active credit batch
    test_admin_id = uuid4()
    admin = Admin(
        id=test_admin_id,
        email=f"test_active_{test_admin_id.hex[:6]}@example.com",
        password_hash="test",
        is_owner=True,
    )
    db_session.add(admin)
    db_session.commit()

    now = datetime.now(timezone.utc)
    batch = AICreditBatch(
        id=uuid4(),
        admin_id=test_admin_id,
        batch_type="FREE_BASE",
        cycle_start_at=now - timedelta(days=1),
        allocated_amount=100,
        remaining_amount=50,
        expiry_date=now + timedelta(days=29),
        status="ACTIVE",
    )
    db_session.add(batch)
    db_session.commit()

    has_credits, total_rem, reset_date = check_account_has_credits(db_session, test_admin_id)
    assert has_credits is True
    assert total_rem >= 50
    assert reset_date is not None
