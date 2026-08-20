import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from db.database import engine, get_session
from main import app
from models import Admin, AdminSite, Cart, CartItem, Order, Product, Site, TenantBankAccount, TenantLedgerEntry, User, UserAddress
from routers.payments import get_platform_commission_percent, sync_razorpay_linked_account


@pytest.fixture
def client_fixture():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def session_fixture():
    with Session(engine) as session:
        yield session


def test_sync_razorpay_linked_account(session_fixture: Session):
    admin_id = uuid.uuid4()
    site_id = uuid.uuid4()

    admin = Admin(id=admin_id, email=f"merchant_{admin_id.hex[:6]}@example.com", password_hash="hash")
    session_fixture.add(admin)

    site = Site(
        id=site_id,
        slug=f"test-shop-{site_id.hex[:6]}",
        site_definition={"site": {"brand_name": "Test Shop"}},
    )
    session_fixture.add(site)
    session_fixture.commit()

    bank_account = TenantBankAccount(
        admin_id=admin_id,
        site_id=site_id,
        account_holder_name="Jaipur Artisans Co",
        account_number_encrypted="dummy_enc",
        account_number_last4="4402",
        ifsc_code="HDFC0001234",
        bank_name="HDFC Bank",
        is_verified=True,
    )
    session_fixture.add(bank_account)
    session_fixture.commit()

    # Test sync in mock/fallback mode
    acc_id, status = sync_razorpay_linked_account(
        session=session_fixture,
        admin_id=admin_id,
        site_id=site_id,
        bank_account=bank_account,
        raw_account_number="50100492814402",
        client=None,
    )

    assert acc_id is not None
    assert acc_id.startswith("acc_")
    assert status == "active"
    assert bank_account.razorpay_account_id == acc_id
    assert bank_account.route_status == "active"


def test_split_transfers_calculation():
    gross = Decimal("5000.00")
    commission_pct = Decimal("3.00")
    platform_fee = (gross * commission_pct) / Decimal("100")
    tenant_share = gross - platform_fee

    assert platform_fee == Decimal("150.00")
    assert tenant_share == Decimal("4850.00")

    tenant_share_paise = int(tenant_share * 100)
    assert tenant_share_paise == 485000
