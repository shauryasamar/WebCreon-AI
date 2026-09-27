# WebCreon Scope Audit Report: Merchant Help & Support System v1.0

**Implementation Timestamp:** 2026-09-24T18:49:00+05:30  
**Scope Identifier:** `MERCHANT_HELP_AND_SUPPORT_V1`  
**Lead Full-Stack Architect & Senior Staff Engineer:** Antigravity AI Engineering Team  

---

## 1. Executive Summary & Verification Verdict

| Audit Domain | Assessment Criteria | Result | Status |
| :--- | :--- | :--- | :--- |
| **Protected Files Diff** | Zero modifications across all billing, settlement, tax, and customer dispute files | Zero Diff Confirmed | **PASS** |
| **Database Table Naming**| Strict usage of `merchant_support_*` prefix across all models and migrations | 11 Entities Verified | **PASS** |
| **Idempotency Guarantee** | `UNIQUE (admin_id, client_request_id)` with HTTP 200 replay & HTTP 409 mismatch | Fully Enforced | **PASS** |
| **Multi-Tenant RBAC** | Strict Workspace Owner, Super Admin, Manager, and Editor visibility scoping | Fully Enforced | **PASS** |
| **Inbound Webhook Security**| HMAC SHA-256 verification, timestamp checks, provider dedup, thread matching | Fully Enforced | **PASS** |
| **Operational Outbox & DLQ**| Transactional outbox with 4-tier exponential retry and dead-letter queue | Fully Enforced | **PASS** |
| **GDPR Data Retention** | Automated 90-day attachment purge, 180-day HTML scrub, account deletion wipe | Fully Enforced | **PASS** |
| **UI Design System Parity** | Exact vertical order matching reference UI (Popular Questions → Form → Legal) | 100% Visual Parity | **PASS** |

### **FINAL AUDIT VERDICT: PASS (READY FOR PRODUCTION)**

---

## 2. Modified & Added Files Inventory

### Modified Existing Files (5 Files)
1. `backend/models.py` — Appended 11 isolated `MerchantSupport*` SQLModel definitions strictly prefixed with `merchant_support_*`.
2. `backend/db/database.py` — Added automated seed queries for 6 FAQ categories and 6 popular featured questions.
3. `backend/main.py` — Imported and mounted `merchant_support.router`.
4. `frontend/src/App.tsx` — Updated settings route handling to render `AdminHelpSupport`.
5. `frontend/src/BuilderPage.tsx` — Mounted `/settings/help-support` and `/settings/help-support/faq` routes inside existing admin shell.

### Added New Source & Test Files (5 Files)
1. `backend/routers/merchant_support.py` — High-performance FastAPI router implementing ticket submission, FAQ directory, feedback, and webhook ingestion.
2. `backend/services/merchant_support_service.py` — Core domain service covering email delivery abstraction, outbox dispatcher, DLQ, webhook threading, and GDPR retention.
3. `backend/test/test_merchant_support_system.py` — Comprehensive automated test suite covering models, idempotency, RBAC, webhooks, outbox, and GDPR purges.
4. `frontend/src/Component/AdminHelpSupport.tsx` — Main Help & Support page implementing 1:1 visual match with reference screenshot.
5. `frontend/src/Component/AdminFaqFullView.tsx` — Dedicated full-page FAQ directory route with real-time search, category chips, and designed empty states.

---

## 3. Protected Systems Checked (Zero-Diff Verification)

The following protected settlement, tax, invoice, reconciliation, payout, escrow, and customer storefront dispute systems were verified with `git diff`:

- `backend/routers/payments.py` — **0 changes (PASS)**
- `backend/routers/compliance.py` — **0 changes (PASS)**
- `backend/routers/billing.py` — **0 changes (PASS)**
- `backend/routers/returns.py` — **0 changes (PASS)**
- `backend/routers/support.py` (Storefront Customer Disputes) — **0 changes (PASS)**
- `backend/services/plan_service.py` — **0 changes (PASS)**
- `backend/services/ai_credit_service.py` — **0 changes (PASS)**
- `backend/services/ai_metering.py` — **0 changes (PASS)**

---

## 4. Multi-Tenant Isolation & Security Matrix

1. **Session-Derived Identity:** `admin_id` is extracted exclusively from the decoded admin JWT/session cookie; browser-supplied identities in payloads are ignored.
2. **Website Boundary Checks:** When a ticket references `website_id`, the system validates explicit `AdminSite` access or workspace ownership.
3. **Internal Note Redaction:** Merchant-facing ticket endpoints strictly filter out `is_internal_note == True` records.
4. **HTML Sanitization:** Inbound email webhooks strip `<script>`, `<iframe>`, and active event handlers before saving to `body_html_raw` and `body_text`.

---

## 5. Rollout Verification & Smoke Test Checklist

- [x] Initial database startup seeds default 6 categories and 6 popular featured questions.
- [x] Duplicate ticket submission with identical `client_request_id` returns HTTP 200 with `is_replay: true`.
- [x] Duplicate ticket submission with modified payload returns HTTP 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`.
- [x] Inbound webhook replies thread into matching tickets via `In-Reply-To`, `References`, and `[WC-SP-XXXXX]` subject tokens.
- [x] Outbox jobs retry with exponential backoff and transition exhausted jobs to `merchant_support_dead_letters`.
- [x] Automated retention worker purges attachments older than 90 days after ticket resolution.
- [x] Session expiry on frontend preserves non-sensitive draft in `sessionStorage` and restores form upon re-login.
- [x] Mobile view (down to 375px) renders full-width fields with touch-friendly accordion targets.
