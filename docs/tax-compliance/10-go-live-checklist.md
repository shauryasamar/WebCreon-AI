# WebCreon AI: Production Go-Live Checklist & Verification Gates
**Document Ref**: `docs/tax-compliance/10-go-live-checklist.md`  
**Classification**: Gating Protocol for Live Payments & Real Money Transfers  

---

## 1. Statutory & Commercial Gating Gates (Must Be 100% Satisfied)

| Gate ID | Verification Item | Responsible Owner | Verification Evidence Required | Status |
| :--- | :--- | :--- | :--- | :--- |
| **GATE-01** | **Chartered Accountant Sign-Off** on Legal Model, Rule 46 PDF layout, and 194-O Threshold Policy | Legal / CA | Signed memo from practicing CA firm confirming ECO posture | `BLOCKED` (Awaiting CA Memo) |
| **GATE-02** | **Razorpay Route Agreement** verifying fee deductions, Route transfer fee bearer, and linked account KYC limits | Commercial / Razorpay | Countersigned Razorpay Route schedule with MDR rates | `BLOCKED` (Awaiting RM Verification) |
| **GATE-03** | **GST-TCS Tax Collector Registration** obtained by WebCreon legal entity | Finance | Form GST REG-06 showing Tax Collector under Section 51/52 | `BLOCKED` (Registration Pending) |
| **GATE-04** | **Database Migration Verification** executed in staging without data loss | Senior Backend Eng | DB migration logs showing all tables/columns created cleanly | `READY_FOR_EXECUTION` |
| **GATE-05** | **Automated Test Matrix (50+ Tests)** passing with 100% assertion success | QA Lead | Pytest test execution output report | `READY_FOR_EXECUTION` |
| **GATE-06** | **Razorpay Sandbox Split End-to-End Test** verified in Razorpay Dashboard | Payments Specialist | Sandbox transfer IDs, on_hold verification, reversal confirmation | `READY_FOR_EXECUTION` |
| **GATE-07** | **Canary Merchant Pilot** (3 live stores running in shadow mode for 7 days) | Product / Operations | Reconciled bank UTR settlements matching ledger within ₹0.00 | `PENDING_CANARY` |

---

## 2. Hard Stop Rule
> [!CAUTION]
> **NO LIVE PAYMENTS MAY BE PROCESSED WITH THE NEW SPLIT TRANSFERS UNTIL GATES 01, 02, AND 03 ARE RECORDED AS SATISFIED.**
> Feature flag `ENABLE_COMPLIANT_SETTLEMENT_SPLIT` must remain `False` in production until the final go-live sign-off is completed.
