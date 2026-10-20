# Production Payment & Order System Runbook (Razorpay + COD)

This runbook defines immediate response protocols for on-call engineers managing payments, webhooks, reconciliation, and dispute operations.

---

## 1. Triage Checklist: "Payments Are Failing"

When payment failure alarms trigger or customers report checkout errors:

### Step 1: Check Upstream Gateway Status
- Visit [Razorpay Status Page](https://status.razorpay.com).
- Check if specific acquiring banks or payment modes (UPI, Netbanking, Cards) are degraded.

### Step 2: Query Live Metrics Endpoint
```bash
curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.yourdomain.com/payments/monitoring/metrics
```
- **Inspect**:
  - `success_rate`: If below **90%**, check `captured_count` vs `failed_count`.
  - `avg_latency_ms`: If > **3000ms**, upstream API latency is elevated.
  - `webhook_failure_rate`: If > **5%**, inspect webhook secrets and payload delivery.

### Step 3: Run Synthetic Transaction Health Check
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.yourdomain.com/payments/monitoring/synthetic-check
```
- Validates end-to-end Razorpay order creation, SDK signature crypto, and DB stock lock availability without charging real funds.

### Step 4: Check Backend Structured JSON Logs
Search logs for `PAYMENT_EVENT` or correlation IDs:
```bash
# Filter failed payments in past 15 minutes
grep '"event_type":"payment_failed"' /var/log/app/backend.log
```

---

## 2. Webhook Signature Failure Spikes

**Symptom**: Webhook failure metric > 5% or alert `PAYMENT_ALERT_WEBHOOK_SPIKE`.

### Root Cause Analysis:
1. **Secret Mismatch**: Razorpay dashboard webhook secret was changed without updating backend env vars.
2. **Replay / Spoofing Attack**: Malicious traffic hitting `/payments/webhook` with invalid signatures.

### Action Plan:
- Check `RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_WEBHOOK_SECRET_PREVIOUS`.
- If rotating secrets, ensure `RAZORPAY_WEBHOOK_SECRET_PREVIOUS` holds the old secret for at least 24 hours.

---

## 3. Stale / Orphaned Order Reconciliation

### Automated Cycle:
- The backend runs a periodic reconciliation job every 10 minutes checking orders in `status="pending"` older than 15 minutes.

### Manual Immediate Trigger:
If webhook delivery was down upstream for a period, trigger batch reconciliation:
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "https://api.yourdomain.com/payments/admin/reconcile-stale-orders?timeout_minutes=15"
```
**Response returns**:
- `total_scanned`: Number of pending orders scanned.
- `healed_count`: Orders auto-transitioned to Paid (stock deducted) or Cancelled (stock restored).

---

## 4. Notification Queue & Dead-Letter Queue (DLQ)

If email or SMS notifications fail after 3 retries with exponential backoff ($1\text{s}, 4\text{s}, 16\text{s}$), they are moved to the DLQ.

### View Failed Notifications:
```bash
curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.yourdomain.com/payments/admin/notifications/dlq
```

### Manual Resend / Re-drive DLQ:
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.yourdomain.com/payments/admin/notifications/dlq/retry-all
```

---

## 5. Dispute & Chargeback Protocol

When `payment.dispute.created` is received from Razorpay:
1. The associated Order is immediately placed on status `on_hold`, payment status `disputed`.
2. Fulfillment/Shipping actions are locked to prevent shipping fraudulent goods.
3. Check `order.notes` for the dispute ID, reason code, and `respond_by` deadline.
4. Upload proof of delivery (AWB tracking confirmation, customer communication) to the Razorpay Merchant Dashboard before the deadline.
