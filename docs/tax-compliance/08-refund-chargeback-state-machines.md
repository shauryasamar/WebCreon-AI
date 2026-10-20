# WebCreon AI: Refunds, Chargebacks & Negative Balance State Machines
**Document Ref**: `docs/tax-compliance/08-refund-chargeback-state-machines.md`  
**Classification**: Finite State Machines (FSM) & Edge Case Error Handling  

---

## 1. Return & Refund State Machine

```
[Customer Requests Return]
         │
         ▼
[Merchant Evaluates / Approves Return]
         │
         ▼
[Item Received & Restocked: returns.py:refund_return_request]
         │
         ├─────────────────────────────────────────────┐
         ▼                                             ▼
[Full Return]                                 [Partial Return]
  │                                             │
  ├─ Rule 54 Tax Credit Note (Full)             ├─ Rule 54 Credit Note (Item Line)
  ├─ Reverses Full Product GST                  ├─ Reverses Proportional Product GST
  ├─ Adds Negative TCS in GSTR-8                ├─ Reduces TCS Base by Item Value
  ├─ Reverses Platform Commission & GST         ├─ Reverses Line Commission & GST
  ├─ Razorpay Transfer Reversal (100%)          ├─ Razorpay Transfer Reversal (Pro-rata)
  └─ Gateway Customer Refund Triggered          └─ Gateway Customer Refund Triggered
```

---

## 2. Escrow Status Matrix vs Refund Timing

| Scenario | Escrow State | Gateway Action | Ledger Action | Razorpay Route Action |
| :--- | :--- | :--- | :--- | :--- |
| **Refund before delivery / cancellation** | `held` | Full customer refund via `POST /v1/payments/{id}/refund` | Creates `order_cancellation` entry; reverses commission | Route transfer reversed in full (`POST /v1/transfers/{id}/reversals`) |
| **Return during return window (T+7)** | `held` | Customer refunded once item inspected | Creates `return_refund` entry; issues Rule 54 Credit Note | Route transfer reversed before releasing hold |
| **Return after escrow released to bank** | `unheld` / `settled` | Customer refunded | Creates negative adjustment on merchant ledger | Calls `POST /v1/transfers/{id}/reversals` which debits merchant linked account. If balance < 0, triggers negative balance protocol |

---

## 3. Negative Merchant Balance & Chargeback Protocol

1. **Deficit Ledger**: If a reversal or chargeback debits a merchant whose current live balance is insufficient, a `negative_balance_record` is created with a 24-hour grace period.
2. **Future Payout Recovery**: 100% of proceeds from subsequent order settlements are automatically routed to offset the deficit balance before new transfers are unheld.
3. **Account Suspension**: If a negative balance persists for > 14 calendar days without new sales, the merchant's storefront is placed into maintenance mode (`is_online = False`).
