# WebCreon AI: Evidence Index & Compliance Artifact Registry
**Document Ref**: `docs/tax-compliance/12-evidence-index.md`  
**Classification**: Audit Trail & Evidence Registry  

---

## 1. Compliance Documentation Suite

| Document | Title | Purpose / Scope | Location |
| :--- | :--- | :--- | :--- |
| **Doc 00** | Codebase Audit | Comprehensive technical audit of current backend, frontend, database, and payments | [`docs/tax-compliance/00-codebase-audit.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/00-codebase-audit.md) |
| **Doc 01** | Source Verification Register | Official legal/regulatory citations (CBIC, Income Tax, Razorpay) with classification labels | [`docs/tax-compliance/01-source-verification-register.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/01-source-verification-register.md) |
| **Doc 02** | Legal & Payment Model | Contractual relationships, seller of record, and numerical settlement example | [`docs/tax-compliance/02-legal-and-payment-model.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/02-legal-and-payment-model.md) |
| **Doc 03** | Approved Tax Rules | Configuration-driven tax rules catalog with HSN/SAC master rates | [`docs/tax-compliance/03-approved-tax-rules.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/03-approved-tax-rules.md) |
| **Doc 04** | Data Models & Migrations | SQLModel definitions and DDL migration scripts for database extension | [`docs/tax-compliance/04-data-model-and-migrations.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/04-data-model-and-migrations.md) |
| **Doc 05** | API Contracts | OpenAPI specifications for tax profiles, invoices, GSTR-8, and Form 26Q | [`docs/tax-compliance/05-api-contracts.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/05-api-contracts.md) |
| **Doc 06** | UI Changes | React 19 UI mockups and code modifications for merchant & customer dashboards | [`docs/tax-compliance/06-ui-changes.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/06-ui-changes.md) |
| **Doc 07** | Settlement & Reconciliation | Double-entry ledger architecture and daily 4-way reconciliation invariant formulas | [`docs/tax-compliance/07-settlement-and-reconciliation.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/07-settlement-and-reconciliation.md) |
| **Doc 08** | Refund State Machines | FSM for returns, Rule 54 credit notes, Route transfer reversals, and chargebacks | [`docs/tax-compliance/08-refund-chargeback-state-machines.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/08-refund-chargeback-state-machines.md) |
| **Doc 09** | Test Matrix | 50+ test cases covering PoS, TCS, TDS thresholds, sequential invoices, and ledger math | [`docs/tax-compliance/09-test-matrix.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/09-test-matrix.md) |
| **Doc 10** | Go-Live Checklist | Gating criteria and blocked states before real money enablement | [`docs/tax-compliance/10-go-live-checklist.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/10-go-live-checklist.md) |
| **Doc 11** | Open Blockers | Active blockers, owner assignments, required actions, and decision deadlines | [`docs/tax-compliance/11-open-blockers.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/11-open-blockers.md) |
| **Doc 12** | Evidence Index | Registry of all files, test evidence, and audit logs | [`docs/tax-compliance/12-evidence-index.md`](file:///c:/Users/shaurya%20samar/OneDrive/Desktop/WebCreon%20AI/docs/tax-compliance/12-evidence-index.md) |

---

## 2. Codebase Files Inspected & Verified

1. **`backend/models.py`**: Inspected `Order`, `OrderItem`, `TenantBankAccount`, `TenantLedgerEntry`, `Product`, `DeliverySettings`. Verified naive 3%/97% split and flat tax settings.
2. **`backend/db/database.py`**: Inspected PostgreSQL engine setup, pool settings, and `create_db_and_tables()` migration approach.
3. **`backend/routers/payments.py`**: Inspected `create_payment_order()`, `verify_payment_signature()`, Route split transfers, `process_mature_escrows()`.
4. **`backend/routers/orders.py`**: Inspected `evaluate_pricing()` flat tax calculation, stock management, shipment serialization.
5. **`backend/routers/checkout_settings.py`**: Inspected `TaxSettingsPayload` and `build_default_checkout_settings()`.
6. **`backend/routers/returns.py`**: Inspected return requests, refund processing, and `TenantLedgerEntry` fee adjustment creation.
7. **`frontend/package.json`**: Inspected React 19, Vite 8, jsPDF 4.2.1 dependencies.
8. **`frontend/src/Component/AdminOrders.tsx`**: Inspected line 2272 showing mock toast `Generating invoice for ${order.id}...`.
9. **`frontend/src/Component/AdminSettingsViews.tsx`**: Inspected lines 313–350 showing mock billing history and basic bank input fields.
