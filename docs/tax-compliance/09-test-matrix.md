# WebCreon AI: Comprehensive Test Matrix & Automated Verification
**Document Ref**: `docs/tax-compliance/09-test-matrix.md`  
**Framework**: Pytest / FastAPI TestClient / SQLModel In-Memory & PostgreSQL  

---

## 1. Test Suite Structure

| Test Suite File | Focus Area | Test Count Target |
| :--- | :--- | :--- |
| `backend/test/test_tax_engine_pos.py` | Place of supply, CGST/SGST vs IGST, inclusive vs exclusive, exempt items | 12 tests |
| `backend/test/test_statutory_withholding.py` | Section 52 TCS, Section 194-O TDS threshold crossing, 206AA penalty rates | 10 tests |
| `backend/test/test_invoice_sequencer.py` | Rule 46 sequential invoice numbering, FY rollover, concurrent generation | 8 tests |
| `backend/test/test_settlement_ledger_route.py` | Route split transfer math, paise conversion, multi-component reconciliation | 12 tests |
| `backend/test/test_refund_reversals_compliance.py` | Rule 54 Credit Notes, TCS reduction, Route transfer reversals | 8 tests |

---

## 2. Detailed Test Cases & Preconditions

### Test Case `TC-TAX-POS-01`: Intra-State Place of Supply
- **Input**: Seller State: `27` (MH), Customer State: `27` (MH), Gross: ₹1,180.00, GST Rate: 18%.
- **Expected**: `taxable_amount = 1000.00`, `cgst_rate = 9.0`, `cgst_amount = 90.00`, `sgst_rate = 9.0`, `sgst_amount = 90.00`, `igst_amount = 0.00`.
- **Assertion**: `CGST + SGST == 180.00` and `IGST == 0.00`.

### Test Case `TC-TAX-POS-02`: Inter-State Place of Supply
- **Input**: Seller State: `27` (MH), Customer State: `29` (KA), Gross: ₹1,180.00, GST Rate: 18%.
- **Expected**: `taxable_amount = 1000.00`, `igst_rate = 18.0`, `igst_amount = 180.00`, `cgst_amount = 0.00`, `sgst_amount = 0.00`.
- **Assertion**: `IGST == 180.00` and `CGST + SGST == 0.00`.

### Test Case `TC-TDS-194O-01`: Individual Below ₹5L Threshold
- **Preconditions**: Individual merchant, PAN verified, prior FY gross sales: ₹3,00,000. Current order: ₹2,000.
- **Expected**: Cumulative sales ₹3,02,000 <= ₹5,00,000 -> `tds_rate_applied = 0.00`, `tds_amount = 0.00`.

### Test Case `TC-TDS-194O-02`: Individual Breaching ₹5L Threshold
- **Preconditions**: Individual merchant, PAN verified, prior FY gross sales: ₹4,95,000. Current order: ₹10,000.
- **Expected**: Cumulative sales ₹5,05,000 > ₹5,00,000 -> Threshold crossed. `tds_rate_applied = 0.10`, `tds_amount = 10.00` (on ₹10,000 order).

### Test Case `TC-TDS-194O-03`: Missing PAN Punitive Rate (Section 206AA)
- **Preconditions**: Merchant with missing or unverified PAN. Order Gross: ₹5,000.
- **Expected**: `tds_rate_applied = 5.00`, `tds_amount = 250.00`.

### Test Case `TC-TCS-52-01`: Monthly Net Taxable Calculation with Returns
- **Preconditions**: 10 orders totaling ₹1,00,000 taxable; 2 returns in same month totaling ₹20,000 taxable.
- **Expected**: `net_taxable_supplies = 80,000.00`. Total TCS withheld = `80,000 * 0.50% = 400.00`.
