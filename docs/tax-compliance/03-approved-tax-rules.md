# WebCreon AI: Approved Tax Rules Catalog & Configuration
**Document Ref**: `docs/tax-compliance/03-approved-tax-rules.md`  
**Standard**: Configuration-Driven, Effective-Dated Tax Rule Catalog  
**Status**: DRAFT SPECIFICATION PENDING FORMAL CA ATTESTATION  

---

## 1. Governance & Rule Versioning Principles

Under Section 1 of the working rules:
1. **Zero Hardcoded Rates**: No tax rate, threshold, SAC code, or percentage may be hardcoded into business logic.
2. **Effective Dating**: Every rule must have `effective_from` and `effective_to` timestamps. An order created on September 15, 2026, must evaluate rules active on that exact UTC timestamp.
3. **CA Attestation Metadata**: Every production tax rule record must retain `source_reference`, `ca_approval_status`, `approved_by_ca_name`, and `approval_date`. Unapproved rules are rejected by the checkout engine.

---

## 2. Standard Tax Rules Configuration Schema

```json
{
  "rule_id": "TR-GST-52-TCS-V1",
  "rule_code": "GST_TCS_SEC52",
  "category": "STATUTORY_WITHHOLDING",
  "jurisdiction": "IN",
  "effective_from": "2018-10-01T00:00:00Z",
  "effective_to": null,
  "parameters": {
    "intra_state": {
      "cgst_rate": 0.25,
      "sgst_rate": 0.25,
      "igst_rate": 0.0
    },
    "inter_state": {
      "cgst_rate": 0.0,
      "sgst_rate": 0.0,
      "igst_rate": 0.50
    },
    "base_type": "NET_TAXABLE_SUPPLIES",
    "exclude_exempt": true,
    "exclude_taxes": true
  },
  "source_reference": "CBIC Notification No. 52/2018-Central Tax read with Section 52(1) CGST Act",
  "ca_approval_status": "APPROVED",
  "version": 1
}
```

---

## 3. Pre-Configured Master Tax Rules Catalog

### Category A: Statutory Withholding Rules (Platform Level)

| Rule ID | Code | Description | Parameters | Source Reference | CA Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TR-TCS-52-V1` | `GST_TCS_SEC52` | Section 52 GST-TCS on net supplies | Intra: 0.25% CGST + 0.25% SGST; Inter: 0.50% IGST | Notif 52/2018-CT | `PENDING_CA` |
| `TR-TDS-194O-V2` | `IT_TDS_194O` | Section 194-O Income-tax TDS | Regular Rate: **0.10%**; Missing PAN (206AA): **5.00%**; Ind/HUF Exemption: **₹5,00,000** | Finance Act, 2024 | `PENDING_CA` |
| `TR-PLAT-GST-V1` | `PLATFORM_FEE_GST` | 18% GST on Marketplace Commission | SAC: **998313**; Rate: **18.00%** (9% CGST + 9% SGST or 18% IGST) | Notif 11/2017-CT (Rate) | `PENDING_CA` |

### Category B: Core Goods HSN Master Rules (Merchant Catalog Level)

| HSN Code | Chapter / Description | Standard GST Rate | CGST | SGST | IGST | Exemption Flag |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `6109` | T-shirts, singlets and other vests, knitted or crocheted | **5.00%** (if sale value <= ₹1000) / **12.00%** (> ₹1000) | 2.5% / 6% | 2.5% / 6% | 5% / 12% | `FALSE` |
| `6203` | Men's or boys' suits, ensembles, jackets, trousers | **12.00%** | 6.0% | 6.0% | 12.0% | `FALSE` |
| `4202` | Trunks, suit-cases, executive-cases, brief-cases, handbags | **18.00%** | 9.0% | 9.0% | 18.0% | `FALSE` |
| `8517` | Smartphones, cellular network apparatus | **18.00%** | 9.0% | 9.0% | 18.0% | `FALSE` |
| `8471` | Automatic data processing machines (Laptops, Desktops) | **18.00%** | 9.0% | 9.0% | 18.0% | `FALSE` |
| `3304` | Beauty or make-up preparations, skincare | **18.00%** | 9.0% | 9.0% | 18.0% | `FALSE` |
| `0902` | Tea, whether or not flavored (Unbranded / Packed) | **5.00%** | 2.5% | 2.5% | 5.0% | `FALSE` |
| `4901` | Printed books, brochures, leaflets | **0.00%** | 0.0% | 0.0% | 0.0% | `TRUE` (Nil Rated) |
| `998313` | Information technology (IT) software and marketplace facilitation services | **18.00%** | 9.0% | 9.0% | 18.0% | `FALSE` |
| `996812` | Courier and express cargo delivery services | **18.00%** | 9.0% | 9.0% | 18.0% | `FALSE` |

---

## 4. Shipping & Delivery Fee Tax Policy

- **Statutory Precedent**: Composite Supply under Section 2(30) read with Section 8(a) of CGST Act.
- **Rule**: When shipping is charged by the seller to deliver the goods, the delivery service is naturally bundled with the principal supply. Therefore, the **shipping fee attracts the same GST rate as the principal item in the order**.
- **Multi-Item Carts with Differing GST Rates**: The shipping tax rate shall equal the rate of the item with the highest taxable value in the consignment, or proportional allocation across lines (configurable, subject to CA confirmation).
