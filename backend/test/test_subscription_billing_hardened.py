import pytest
import hmac
import hashlib
import os
import json
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from sqlmodel import Session, select
from fastapi.testclient import TestClient
from main import app
from db.database import engine, get_session
from auth_middleware import authenticate_admin
from models import (
    Admin,
    AdminSite,
    Site,
    Product,
    SubscriptionPlan,
    SubscriptionStatus,
    AICreditBatch,
    AICreditBatchType,
    AICreditBatchStatus,
    WebsiteSubscription,
    WebsiteSubscriptionEvent,
    ProductDraftReason,
    Role,
    WebsiteTeamMember,
    ProcessedBillingWebhookEvent,
)
from services.ai_credit_service import (
    calculate_cycle_end,
    ensure_utc,
    ensure_free_base_batch,
    create_batch_on_upgrade_or_renewal,
    revoke_website_ai_credit_batches,
    reserve_credits,
    commit_credits,
    release_credits,
    get_account_credit_balance,
)
from services.product_limit_service import (
    can_activate_product,
    get_free_pool_status,
    FREE_POOL_TOTAL_LIMIT,
    STARTER_DEDICATED_LIMIT,
)
from services.plan_service import (
    upgrade_website_plan,
    downgrade_website_plan,
    renew_website_subscription,
    get_or_create_website_subscription,
    verify_subscription_audit_chain,
)
from services.grace_period_service import (
    start_grace_period,
    expire_grace_period_job,
)


@pytest.fixture(name="db_session")
def session_fixture():
    with Session(engine) as session:
        yield session


@pytest.fixture(name="admin_context")
def admin_context_fixture(db_session: Session):
    admin_id = uuid4()
    admin = Admin(
        id=admin_id,
        email=f"billing_admin_{uuid4().hex[:8]}@webcreon.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    mock_admin = {
        "adminId": str(admin_id),
        "email": admin.email,
        "role": "Owner",
        "permissions": ["*"],
    }
    return admin, mock_admin


@pytest.fixture(name="client")
def client_fixture(admin_context):
    admin, mock_admin = admin_context
    app.dependency_overrides[authenticate_admin] = lambda: mock_admin

    test_client = TestClient(app)
    yield test_client

    app.dependency_overrides.clear()


# ==============================================================================
# 1. FIXED 30-DAY CYCLE ARITHMETIC & UTC TIMEZONE ASSERTIONS
# ==============================================================================

def test_fixed_30_day_cycle_math_and_utc_rejection():
    """
    Every cycle is exactly 30 * 24 hours (timedelta(days=30)).
    Test calendar edge cases:
    - Jan 31 -> Mar 2 (NOT Feb 28, NOT Feb 29, NOT Mar 31)
    - Feb 28 (non-leap) -> Mar 30
    - Feb 29 (leap) -> Mar 30
    - Mar 31 -> Apr 30
    - Dec 31 -> Jan 30 (next year)
    - Reject naive / non-UTC datetimes
    """
    # 1. Jan 31 00:00:00 UTC -> Mar 2 00:00:00 UTC (in non-leap year 2025: 31 Jan + 28 Feb + 2 Mar = 30 days)
    jan_31 = datetime(2025, 1, 31, 0, 0, 0, tzinfo=timezone.utc)
    cycle_end = calculate_cycle_end(jan_31)
    assert cycle_end == datetime(2025, 3, 2, 0, 0, 0, tzinfo=timezone.utc)
    assert (cycle_end - jan_31) == timedelta(days=30)
    assert (cycle_end - jan_31).total_seconds() == 30 * 24 * 3600

    # 2. Feb 28 2025 (non-leap) -> Mar 30 2025
    feb_28_non_leap = datetime(2025, 2, 28, 0, 0, 0, tzinfo=timezone.utc)
    cycle_end = calculate_cycle_end(feb_28_non_leap)
    assert cycle_end == datetime(2025, 3, 30, 0, 0, 0, tzinfo=timezone.utc)
    assert (cycle_end - feb_28_non_leap) == timedelta(days=30)

    # 3. Feb 29 2024 (leap) -> Mar 30 2024
    feb_29_leap = datetime(2024, 2, 29, 0, 0, 0, tzinfo=timezone.utc)
    cycle_end = calculate_cycle_end(feb_29_leap)
    assert cycle_end == datetime(2024, 3, 30, 0, 0, 0, tzinfo=timezone.utc)
    assert (cycle_end - feb_29_leap) == timedelta(days=30)

    # 4. Mar 31 2025 -> Apr 30 2025
    mar_31 = datetime(2025, 3, 31, 0, 0, 0, tzinfo=timezone.utc)
    cycle_end = calculate_cycle_end(mar_31)
    assert cycle_end == datetime(2025, 4, 30, 0, 0, 0, tzinfo=timezone.utc)
    assert (cycle_end - mar_31) == timedelta(days=30)

    # 5. Dec 31 2025 -> Jan 30 2026
    dec_31 = datetime(2025, 12, 31, 0, 0, 0, tzinfo=timezone.utc)
    cycle_end = calculate_cycle_end(dec_31)
    assert cycle_end == datetime(2026, 1, 30, 0, 0, 0, tzinfo=timezone.utc)
    assert (cycle_end - dec_31) == timedelta(days=30)

    # 6. Reject timezone-naive datetime
    naive_dt = datetime(2025, 1, 1, 0, 0, 0)
    with pytest.raises(ValueError, match="Naive datetime rejected"):
        calculate_cycle_end(naive_dt)


# ==============================================================================
# 2. FREE BASE AI CREDIT BATCH EXACT-ONCE ALLOCATION
# ==============================================================================

def test_free_base_batch_exact_once_allocation(db_session: Session, admin_context):
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    # First call: creates base batch
    batch1 = ensure_free_base_batch(db_session, admin.id, cycle_start_at=now)
    assert batch1 is not None
    assert batch1.batch_type == AICreditBatchType.FREE_BASE.value
    assert batch1.allocated_amount == 300
    assert batch1.remaining_amount == 300
    assert batch1.status == AICreditBatchStatus.ACTIVE.value
    assert batch1.admin_id == admin.id
    assert (batch1.expiry_date - batch1.cycle_start_at) == timedelta(days=30)

    # Second call within same cycle: returns the EXACT same batch
    batch2 = ensure_free_base_batch(db_session, admin.id, cycle_start_at=now + timedelta(days=5))
    assert batch2.id == batch1.id
    assert batch2.allocated_amount == 300

    # Summary check
    summary = get_account_credit_balance(db_session, admin.id)
    assert summary["total_remaining"] == 300
    assert summary["total_monthly_allocation"] == 300
    assert len(summary["batches"]) == 1


# ==============================================================================
# 3. FREE PRODUCT POOL DYNAMIC AGGREGATION & CONCURRENCY
# ==============================================================================

def test_free_product_pool_shared_dynamic_limit(db_session: Session, admin_context):
    """
    Admin with two Free websites:
    Site 1 has 120 products, Site 2 has 80 products -> total 200.
    Attempting to add 1 more product to Site 2 (or Site 1) must be rejected.
    Upgrading Site 1 to Starter removes Site 1 from the Free pool, allowing Site 2
    to activate more products up to 200.
    """
    admin, _ = admin_context

    # Create Site 1 (Free)
    site1 = Site(
        id=uuid4(),
        slug=f"site1-{uuid4().hex[:6]}",
        site_definition={"site_name": "Free Site 1"},
    )
    # Create Site 2 (Free)
    site2 = Site(
        id=uuid4(),
        slug=f"site2-{uuid4().hex[:6]}",
        site_definition={"site_name": "Free Site 2"},
    )
    db_session.add(site1)
    db_session.add(site2)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin.id, site_id=site1.id, role_on_site="owner"))
    db_session.add(AdminSite(admin_id=admin.id, site_id=site2.id, role_on_site="owner"))
    db_session.commit()

    now = datetime.now(timezone.utc)
    cycle_end = calculate_cycle_end(now)

    # Create subscriptions
    sub1 = WebsiteSubscription(
        id=uuid4(),
        website_id=site1.id,
        admin_id=admin.id,
        plan=SubscriptionPlan.FREE.value,
        status=SubscriptionStatus.ACTIVE.value,
        billing_cycle_start_date=now,
        billing_cycle_end_date=cycle_end,
    )
    sub2 = WebsiteSubscription(
        id=uuid4(),
        website_id=site2.id,
        admin_id=admin.id,
        plan=SubscriptionPlan.FREE.value,
        status=SubscriptionStatus.ACTIVE,
        billing_cycle_start_date=now,
        billing_cycle_end_date=cycle_end,
    )
    db_session.add(sub1)
    db_session.add(sub2)
    db_session.commit()

    # Add 120 active products to Site 1
    for i in range(120):
        db_session.add(Product(
            id=uuid4(),
            site_id=site1.id,
            name=f"Site 1 Product {i}",
            price=Decimal("10.00"),
            is_active=True,
        ))

    # Add 80 active products to Site 2
    for i in range(80):
        db_session.add(Product(
            id=uuid4(),
            site_id=site2.id,
            name=f"Site 2 Product {i}",
            price=Decimal("10.00"),
            is_active=True,
        ))
    db_session.commit()

    # Free pool usage must be 200 / 200
    pool_usage = get_free_pool_status(db_session, admin.id)
    assert pool_usage["total_used"] == 200
    assert pool_usage["total_limit"] == FREE_POOL_TOTAL_LIMIT
    assert pool_usage["available"] == 0

    # Check can_activate_product on Site 2 -> should be False
    can_activate, reason = can_activate_product(db_session, site2.id)
    assert can_activate is False
    assert "Free shared product pool limit reached" in reason

    # Upgrade Site 1 to STARTER
    upgrade_website_plan(
        session=db_session,
        website_id=site1.id,
        new_plan=SubscriptionPlan.STARTER.value,
    )

    # Now Site 1 is on Starter (1000 limit). Site 1 active count = 120.
    # Sibling Free pool now only contains Site 2 with 80 products!
    pool_usage_after = get_free_pool_status(db_session, admin.id)
    assert pool_usage_after["total_used"] == 80
    assert pool_usage_after["available"] == 120

    # Site 2 should now be able to activate products!
    can_activate_site2, _ = can_activate_product(db_session, site2.id)
    assert can_activate_site2 is True


# ==============================================================================
# 4. FIFO AI CREDIT DEDUCTION & TWO-PHASE METERING
# ==============================================================================

def test_fifo_ai_credit_metering_two_phase_commit(db_session: Session, admin_context):
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    # Create Batch 1: 20 credits, expires in 10 days
    batch1 = AICreditBatch(
        id=uuid4(),
        admin_id=admin.id,
        batch_type=AICreditBatchType.FREE_BASE.value,
        allocated_amount=20,
        remaining_amount=20,
        status=AICreditBatchStatus.ACTIVE.value,
        cycle_start_at=now,
        expiry_date=now + timedelta(days=10),
    )
    # Create Batch 2: 100 credits, expires in 25 days
    batch2 = AICreditBatch(
        id=uuid4(),
        admin_id=admin.id,
        batch_type=AICreditBatchType.PAID_STARTER.value,
        allocated_amount=100,
        remaining_amount=100,
        status=AICreditBatchStatus.ACTIVE.value,
        cycle_start_at=now,
        expiry_date=now + timedelta(days=25),
    )
    db_session.add(batch1)
    db_session.add(batch2)
    db_session.commit()

    # Step 1: Reserve 15 credits. Nearest expiry is batch1 (10 days vs 25 days)
    res1 = reserve_credits(
        session=db_session,
        admin_id=admin.id,
        website_id=None,
        feature_name="copilot_chat",
        estimated_credits=15,
        idempotency_key=f"idem_res_{uuid4().hex[:8]}",
    )
    assert res1.status == "RESERVED"
    assert res1.reserved_credits == 15
    assert len(res1.batch_allocation_details) == 1
    assert res1.batch_allocation_details[0]["batch_id"] == str(batch1.id)
    assert res1.batch_allocation_details[0]["amount"] == 15

    # Commit reservation 1 with token usage metadata
    commit_credits(
        session=db_session,
        reservation_id=res1.reservation_id,
        actual_credits=15,
        provider_metadata={"model": "gemini-2.5-flash", "input_tokens": 300, "output_tokens": 200, "total_tokens": 500},
    )
    db_session.refresh(batch1)
    assert batch1.remaining_amount == 5
    assert batch1.status == AICreditBatchStatus.ACTIVE.value

    # Step 2: Reserve 10 credits -> Should take remaining 5 from batch1 and 5 from batch2
    res2 = reserve_credits(
        session=db_session,
        admin_id=admin.id,
        website_id=None,
        feature_name="copilot_description",
        estimated_credits=10,
        idempotency_key=f"idem_res_{uuid4().hex[:8]}",
    )
    assert len(res2.batch_allocation_details) == 2
    assert res2.batch_allocation_details[0]["batch_id"] == str(batch1.id)
    assert res2.batch_allocation_details[0]["amount"] == 5
    assert res2.batch_allocation_details[1]["batch_id"] == str(batch2.id)
    assert res2.batch_allocation_details[1]["amount"] == 5

    commit_credits(
        session=db_session,
        reservation_id=res2.reservation_id,
        actual_credits=10,
        provider_metadata={"model": "gemini-2.5-flash", "input_tokens": 150, "output_tokens": 100, "total_tokens": 250},
    )
    db_session.refresh(batch1)
    db_session.refresh(batch2)
    assert batch1.remaining_amount == 0
    assert batch2.remaining_amount == 95

    # Step 3: Two-phase release/refund
    res3 = reserve_credits(
        session=db_session,
        admin_id=admin.id,
        website_id=None,
        feature_name="image_generation",
        estimated_credits=20,
        idempotency_key=f"idem_res_{uuid4().hex[:8]}",
    )
    db_session.refresh(batch2)
    assert batch2.remaining_amount == 75  # 95 - 20

    # Now release reservation 3 (e.g. AI API threw error)
    release_credits(
        session=db_session,
        reservation_id=res3.reservation_id,
        error_message="Upstream AI timeout",
    )
    db_session.refresh(batch2)
    assert batch2.remaining_amount == 95  # credits safely restored!


# ==============================================================================
# 5. WEBHOOK DEDUPLICATION, SIGNATURE VALIDATION & MONOTONIC SEQUENCE
# ==============================================================================

def test_webhook_idempotency_and_signature_validation(client: TestClient, db_session: Session, admin_context):
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    site = Site(
        id=uuid4(),
        slug=f"webhook-site-{uuid4().hex[:6]}",
        site_definition={"site_name": "Webhook Site"},
    )
    db_session.add(site)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin.id, site_id=site.id, role_on_site="owner"))
    db_session.commit()

    sub = WebsiteSubscription(
        id=uuid4(),
        website_id=site.id,
        admin_id=admin.id,
        plan=SubscriptionPlan.STARTER.value,
        status=SubscriptionStatus.ACTIVE.value,
        billing_cycle_start_date=now,
        billing_cycle_end_date=calculate_cycle_end(now),
        provider_name="razorpay",
        provider_subscription_id="sub_wh_test_999",
        latest_provider_sequence=10,
    )
    db_session.add(sub)
    db_session.commit()

    provider_event_id = f"evt_wh_charge_{uuid4().hex[:8]}"
    payload = {
        "event": "subscription.charged",
        "event_id": provider_event_id,
        "created_at": 1716300000,
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_wh_test_999",
                    "status": "active",
                    "current_start": 1716300000,
                    "current_end": 1718892000,
                    "sequence_number": 11,
                }
            },
            "payment": {
                "entity": {
                    "id": f"pay_{uuid4().hex[:8]}",
                    "amount": 19900,
                    "currency": "INR",
                    "status": "captured",
                    "notes": {
                        "website_id": str(site.id),
                        "plan": "STARTER",
                    }
                }
            }
        }
    }

    raw_body = json.dumps(payload).encode("utf-8")
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "whsec_webcreon_dev_secret_key_2026")
    valid_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    # 1. Invalid signature should be rejected with 400
    res_bad = client.post(
        "/api/billing/webhooks/payment",
        content=raw_body,
        headers={"X-Razorpay-Signature": "invalid_signature_webcreon", "Content-Type": "application/json"},
    )
    assert res_bad.status_code == 400
    assert "Invalid webhook signature" in res_bad.json()["detail"]

    # 2. Valid signature should process successfully
    res_good = client.post(
        "/api/billing/webhooks/payment",
        content=raw_body,
        headers={"X-Razorpay-Signature": valid_signature, "Content-Type": "application/json"},
    )
    assert res_good.status_code == 200
    data = res_good.json()
    assert data["status"] in ("received", "processed")

    # 3. Duplicate event should be deduplicated (return duplicate_ignored)
    res_dup = client.post(
        "/api/billing/webhooks/payment",
        content=raw_body,
        headers={"X-Razorpay-Signature": valid_signature, "Content-Type": "application/json"},
    )
    assert res_dup.status_code == 200
    assert "duplicate" in res_dup.json()["status"]





# ==============================================================================
# 6. GRACE PERIOD LIFECYCLE & CASCADE DOWNGRADE
# ==============================================================================

def test_immediate_downgrade_on_payment_failure(db_session: Session, admin_context):
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    site = Site(
        id=uuid4(),
        slug=f"fail-site-{uuid4().hex[:6]}",
        site_definition={"site_name": "Fail Site"},
    )
    db_session.add(site)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin.id, site_id=site.id, role_on_site="owner"))
    db_session.commit()

    sub = WebsiteSubscription(
        id=uuid4(),
        website_id=site.id,
        admin_id=admin.id,
        plan=SubscriptionPlan.STARTER.value,
        status=SubscriptionStatus.ACTIVE.value,
        billing_cycle_start_date=now - timedelta(days=30),
        billing_cycle_end_date=now,
    )
    db_session.add(sub)
    db_session.commit()

    # Step 1: Involuntary payment failure -> immediate cascade downgrade to FREE (Zero Free Days)
    updated_sub = start_grace_period(session=db_session, website_id=site.id)
    assert updated_sub is not None
    assert updated_sub.plan == SubscriptionPlan.FREE.value
    assert updated_sub.status == SubscriptionStatus.ACTIVE.value


# ==============================================================================
# 7. PRODUCT DRAFT RESTORATION (SYSTEM VS MANUAL)
# ==============================================================================

def test_reupgrade_restores_system_drafts_never_manual(db_session: Session, admin_context):
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    site = Site(
        id=uuid4(),
        slug=f"reup-site-{uuid4().hex[:6]}",
        site_definition={"site_name": "Reupgrade Site"},
    )
    db_session.add(site)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin.id, site_id=site.id, role_on_site="owner"))
    db_session.commit()

    sub = WebsiteSubscription(
        id=uuid4(),
        website_id=site.id,
        admin_id=admin.id,
        plan=SubscriptionPlan.FREE.value,
        status=SubscriptionStatus.ACTIVE.value,
        billing_cycle_start_date=now,
        billing_cycle_end_date=calculate_cycle_end(now),
    )
    db_session.add(sub)
    db_session.commit()

    # Product 1: drafted by system due to limit exceeded
    p_sys = Product(
        id=uuid4(),
        site_id=site.id,
        name="System Exceeded Product",
        price=Decimal("50.00"),
        is_active=False,
        draft_reason=ProductDraftReason.SYSTEM_LIMIT_EXCEEDED.value,
    )
    # Product 2: manually drafted by merchant
    p_man = Product(
        id=uuid4(),
        site_id=site.id,
        name="Merchant Manual Draft Product",
        price=Decimal("100.00"),
        is_active=False,
        draft_reason=ProductDraftReason.MERCHANT_MANUAL.value,
    )
    db_session.add(p_sys)
    db_session.add(p_man)
    db_session.commit()

    # Upgrade to Starter
    upgrade_website_plan(
        session=db_session,
        website_id=site.id,
        new_plan=SubscriptionPlan.STARTER.value,
    )

    db_session.refresh(p_sys)
    db_session.refresh(p_man)

    # SYSTEM_LIMIT_EXCEEDED product must be restored to active!
    assert p_sys.is_active is True
    assert p_sys.draft_reason is None

    # MERCHANT_MANUAL product must remain draft!
    assert p_man.is_active is False
    assert p_man.draft_reason == ProductDraftReason.MERCHANT_MANUAL.value


# ==============================================================================
# 8. PRO-ONLY TEAM MEMBER & PAID-ONLY CUSTOM DOMAIN GUARDS
# ==============================================================================

def test_pro_and_paid_feature_entitlement_guards(client: TestClient, db_session: Session, admin_context):
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    site = Site(
        id=uuid4(),
        slug=f"entitlement-site-{uuid4().hex[:6]}",
        site_definition={"site_name": "Entitlement Site"},
    )
    db_session.add(site)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin.id, site_id=site.id, role_on_site="owner"))
    db_session.commit()

    sub = WebsiteSubscription(
        id=uuid4(),
        website_id=site.id,
        admin_id=admin.id,
        plan=SubscriptionPlan.FREE.value,
        status=SubscriptionStatus.ACTIVE.value,
        billing_cycle_start_date=now,
        billing_cycle_end_date=calculate_cycle_end(now),
    )
    db_session.add(sub)
    db_session.commit()

    # 1. Custom domain on Free plan must be rejected with 403
    res_domain = client.post(
        f"/api/sites/{site.id}/domains",
        json={"domain": "store.example.com"},
    )
    assert res_domain.status_code == 403
    assert "paid feature" in str(res_domain.json()["detail"]).lower()


    # 2. Team member invite on Free plan must be rejected with 403
    role = db_session.exec(select(Role)).first()
    if not role:
        role = Role(id=uuid4(), name=f"Staff_{uuid4().hex[:6]}", permissions=["orders:view"])
        db_session.add(role)
        db_session.commit()

    invite_payload = {
        "name": "Colleague Name",
        "email": f"colleague_{uuid4().hex[:6]}@example.com",
        "role_id": str(role.id),
        "website_access_type": "specific",
        "site_ids": [str(site.id)],
    }
    res_team_free = client.post(
        "/api/users-roles/users/invite",
        json=invite_payload,
    )
    assert res_team_free.status_code == 403
    assert "TEAM_FEATURE_REQUIRES_PRO" in str(res_team_free.json()["detail"])

    # 3. Upgrade to Starter -> custom domain is allowed, but team member is still blocked (Pro required)
    sub.plan = SubscriptionPlan.STARTER.value
    db_session.add(sub)
    db_session.commit()

    res_team_starter = client.post(
        "/api/users-roles/users/invite",
        json=invite_payload,
    )
    assert res_team_starter.status_code == 403
    assert "TEAM_FEATURE_REQUIRES_PRO" in str(res_team_starter.json()["detail"])




# ==============================================================================
# 9. SHA-256 AUDIT LOG HASH CHAIN VERIFICATION
# ==============================================================================

def test_audit_log_hash_chain_integrity(db_session: Session, admin_context):
    admin, _ = admin_context

    site = Site(
        id=uuid4(),
        slug=f"audit-chain-site-{uuid4().hex[:6]}",
        site_definition={"site_name": "Audit Chain Site"},
    )
    db_session.add(site)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin.id, site_id=site.id, role_on_site="owner"))
    db_session.commit()

    # Upgrade to Starter -> creates first audit event
    upgrade_website_plan(
        session=db_session,
        website_id=site.id,
        new_plan=SubscriptionPlan.STARTER.value,
    )

    # Upgrade to Pro -> creates second chained event
    upgrade_website_plan(
        session=db_session,
        website_id=site.id,
        new_plan=SubscriptionPlan.PRO.value,
    )

    audit_result = verify_subscription_audit_chain(db_session, site.id)
    assert audit_result["valid"] is True
    assert audit_result["event_count"] >= 2


# ==============================================================================
# 10. TENANT ISOLATION
# ==============================================================================

def test_cross_admin_tenant_isolation(client: TestClient, db_session: Session):
    # Create Admin 2 and Site 2
    admin2 = Admin(
        id=uuid4(),
        email=f"other_admin_{uuid4().hex[:8]}@webcreon.com",
        role="Owner",
        is_active=True,
        hashed_password="pw",
    )
    db_session.add(admin2)
    db_session.commit()

    site2 = Site(
        id=uuid4(),
        slug=f"admin2-secret-site-{uuid4().hex[:6]}",
        site_definition={"site_name": "Admin 2 Site"},
    )
    db_session.add(site2)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin2.id, site_id=site2.id, role_on_site="owner"))
    db_session.commit()

    # Client is authenticated as Admin 1
    # Attempting to access Admin 2's website details should return 404 or 403
    res = client.get(f"/api/billing/websites/{site2.id}/details")
    assert res.status_code in (403, 404)

    # Attempting to downgrade Admin 2's site
    res_down = client.post(
        f"/api/billing/websites/{site2.id}/downgrade",
        json={"target_plan": "FREE", "confirmed": True},
    )
    assert res_down.status_code in (403, 404)


def test_downgrade_revokes_paid_ai_credit_batch(db_session: Session, admin_context):
    """Verifies that downgrading to Free immediately revokes the site's paid AI credit batch."""
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    site = Site(
        id=uuid4(),
        slug=f"paid-ai-site-{uuid4().hex[:6]}",
        site_definition={"site_name": "Paid AI Site"},
    )
    db_session.add(site)
    db_session.commit()

    db_session.add(AdminSite(admin_id=admin.id, site_id=site.id, role_on_site="owner"))
    db_session.commit()

    # Create active Starter subscription and Starter AI credit batch
    sub = WebsiteSubscription(
        id=uuid4(),
        website_id=site.id,
        admin_id=admin.id,
        plan=SubscriptionPlan.STARTER.value,
        status=SubscriptionStatus.ACTIVE.value,
        billing_cycle_start_date=now,
        billing_cycle_end_date=now + timedelta(days=30),
    )
    db_session.add(sub)
    db_session.commit()

    # Provision base batch (300) and Starter batch (1000)
    ensure_free_base_batch(db_session, admin.id)
    starter_batch = create_batch_on_upgrade_or_renewal(db_session, admin.id, site.id, "STARTER")
    assert starter_batch is not None
    assert starter_batch.status == AICreditBatchStatus.ACTIVE.value

    # Pre-downgrade balance: 300 + 1000 = 1300
    balance_before = get_account_credit_balance(db_session, admin.id)
    assert balance_before["total_remaining"] == 1300

    # Downgrade to Free
    downgrade_website_plan(db_session, site.id, "FREE")

    # Post-downgrade: Starter batch must be EXPIRED_LAPSED, balance back to 300
    db_session.refresh(starter_batch)
    assert starter_batch.status == AICreditBatchStatus.EXPIRED_LAPSED.value

    balance_after = get_account_credit_balance(db_session, admin.id)
    assert balance_after["total_remaining"] == 300


def test_sync_and_cleanup_lapses_stale_paid_batches_and_consolidates_free(db_session: Session, admin_context):
    """Verifies that visiting the billing page triggers sync to lapse legacy batches and consolidate free base to 300."""
    admin, _ = admin_context
    now = datetime.now(timezone.utc)

    # Simulate legacy state: an old paid batch with no active subscription, plus an expired batch, plus duplicate free batch
    expired_batch = AICreditBatch(
        id=uuid4(),
        admin_id=admin.id,
        batch_type=AICreditBatchType.FREE_BASE.value,
        cycle_start_at=now - timedelta(days=40),
        allocated_amount=50,
        remaining_amount=20,
        expiry_date=now - timedelta(days=10),
        status=AICreditBatchStatus.ACTIVE.value,
        created_at=now - timedelta(days=40),
    )
    free_site = Site(
        id=uuid4(),
        slug=f"free-orphan-{uuid4().hex[:6]}",
        site_definition={"name": "Free Orphan"},
    )
    db_session.add(free_site)
    db_session.commit()

    orphan_paid_batch = AICreditBatch(
        id=uuid4(),
        admin_id=admin.id,
        source_website_id=free_site.id, # site exists but is on Free (or has no paid sub)
        batch_type=AICreditBatchType.PAID_STARTER.value,
        cycle_start_at=now,
        allocated_amount=1000,
        remaining_amount=1000,
        expiry_date=now + timedelta(days=30),
        status=AICreditBatchStatus.ACTIVE.value,
        created_at=now,
    )
    db_session.add(expired_batch)
    db_session.add(orphan_paid_batch)
    db_session.commit()

    # Call get_account_credit_balance
    balance = get_account_credit_balance(db_session, admin.id)

    # Verify orphan paid batch and expired batch are lapsed, and only 300 base credits remain
    assert balance["total_remaining"] == 300
    assert balance["batches_count"] == 1
    assert balance["batches"][0]["is_free_base"] is True
    assert balance["batches"][0]["allocated"] == 300


