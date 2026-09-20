# WebCreon AI: Settlement, Ledger & Razorpay Reconciliation
**Document Ref**: `docs/tax-compliance/07-settlement-and-reconciliation.md`  
**Classification**: Financial Ledger Architecture & Bank Reconciliation  

---

## 1. Multi-Component Settlement Ledger Principles

1. **Append-Only & Immutable**: Every financial movement (order, fee deduction, tax retention, escrow unhold, refund, chargeback) is logged as an immutable row in `tenant_ledger_entries`. Prior rows are never edited; adjustments are created as linked reversing rows.
2. **Component Separation**: Statutory withholdings (TCS, TDS), platform commission, fee GST, and gateway fees are never lumped into a single opaque deduction field.
3. **Paise-Level Precision**: All calculations in Python use `Decimal` with `ROUND_HALF_UP` and convert to exact integer paise before dispatching to the Razorpay Route API.

---

## 2. Invariant Reconciliation Formula

For every settled transaction, the following mathematical identity must hold true:

$$\text{Gross Customer Payment} = \text{Taxable Product Value} + \text{Product GST} + \text{Shipping Gross}$$

$$\text{Net Merchant Payout} = \text{Gross} - \text{Platform Fee} - \text{Platform Fee GST} - \text{GST-TCS} - \text{TDS-194O} - \text{Gateway Fee Withheld}$$

$$\text{Transfers Payload Amount (Paise)} = \text{round}(\text{Net Merchant Payout} \times 100)$$

---

## 3. Daily Bank & Gateway Reconciliation Protocol

The platform runs an automated reconciliation job matching 4 independent sources:
1. **Internal Database**: `orders`, `tenant_ledger_entries`, `tax_invoices`.
2. **Razorpay Payments API**: `GET /v1/payments/{payment_id}` (Amount, Status, Fee, Tax).
3. **Razorpay Route Transfers API**: `GET /v1/transfers/{transfer_id}` (Amount, Recipient, on_hold, Reversals).
4. **Razorpay Settlement Reports**: Daily automated settlement dump CSV matching bank UTR reference numbers.

Any variance greater than ₹0.01 triggers an immediate `AuditCategory.EARNINGS_LEDGER` alert and flags the record for manual engineering review.
