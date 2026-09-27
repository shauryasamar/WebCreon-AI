# WebCreon AI: API Contracts & Specifications
**Document Ref**: `docs/tax-compliance/05-api-contracts.md`  
**Protocol**: REST / JSON / HTTP Status Codes  

---

## 1. Merchant Tax Profile API Endpoints

### `GET /api/tax-profile`
Fetches the active merchant tax profile for the authenticated tenant.
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Response `200 OK`**:
```json
{
  "siteId": "8f3b23c1-01b4-4e2b-b620-8022d8e411fa",
  "legalBusinessName": "Artisans of Jaipur Private Limited",
  "tradeName": "Jaipur Loom",
  "entityType": "private_limited",
  "registrationType": "regular",
  "panNumber": "AABCA1234F",
  "isPanVerified": true,
  "gstin": "08AABCA1234F1Z5",
  "isGstinVerified": true,
  "stateCode": "08",
  "stateName": "Rajasthan",
  "addressLine1": "Plot 42, Sitapura Industrial Area",
  "city": "Jaipur",
  "pincode": "302022",
  "isCompositionDealer": false,
  "allowInterstateSales": true,
  "currentFy": "2026-2027",
  "fyGrossSalesAmount": 345000.00,
  "fyTdsDeductedAmount": 345.00
}
```

### `POST /api/tax-profile`
Creates or updates the merchant tax profile.
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Request Body**:
```json
{
  "legalBusinessName": "Artisans of Jaipur Private Limited",
  "tradeName": "Jaipur Loom",
  "entityType": "private_limited",
  "registrationType": "regular",
  "panNumber": "AABCA1234F",
  "gstin": "08AABCA1234F1Z5",
  "stateCode": "08",
  "stateName": "Rajasthan",
  "addressLine1": "Plot 42, Sitapura Industrial Area",
  "city": "Jaipur",
  "pincode": "302022",
  "isCompositionDealer": false
}
```
- **Validation**:
  - `panNumber`: Must match regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`.
  - `gstin`: If provided, characters 3–12 must match `panNumber`, and first 2 digits must match `stateCode`.

---

## 2. Invoicing & Document Download API Endpoints

### `GET /orders/{order_id}/invoice/pdf`
Streams the verified Rule 46 Tax Invoice PDF.
- **Headers**: `Authorization: Bearer <CUSTOMER_JWT or ADMIN_JWT>`
- **Response**: `200 OK` with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="INV-2026-27-000142.pdf"`.

### `GET /orders/{order_id}/invoice/json`
Returns the structured invoice data for client-side rendering.
- **Response `200 OK`**:
```json
{
  "invoiceNumber": "WC/2026-27/000142",
  "invoiceDate": "2026-09-16T14:32:00Z",
  "supplier": {
    "legalName": "Artisans of Jaipur Private Limited",
    "gstin": "08AABCA1234F1Z5",
    "stateCode": "08",
    "address": "Plot 42, Sitapura Industrial Area, Jaipur, Rajasthan 302022"
  },
  "recipient": {
    "name": "Priya Sharma",
    "stateCode": "27",
    "address": "Flat 402, Sea Green Apts, Worli, Mumbai, Maharashtra 400018"
  },
  "placeOfSupply": "27 (Maharashtra)",
  "isInterstate": true,
  "items": [
    {
      "productName": "Handcrafted Cotton Kurta",
      "hsnCode": "61091000",
      "quantity": 2,
      "taxableValue": 1694.92,
      "igstRate": 18.0,
      "igstAmount": 305.08,
      "lineTotal": 2000.00
    }
  ],
  "taxableSubtotal": 1694.92,
  "igstTotal": 305.08,
  "cgstTotal": 0.00,
  "sgstTotal": 0.00,
  "totalInvoiceValue": 2000.00
}
```

---

## 3. Statutory Compliance Filing Export Endpoints

### `GET /api/compliance/gstr8/export`
Generates the monthly GSTR-8 Table 4 export file for GST portal filing.
- **Headers**: `Authorization: Bearer <SUPER_ADMIN_JWT>`
- **Query Params**: `month=2026-08`
- **Response**: CSV or JSON formatted strictly according to GSTN schema:
```csv
GSTIN_of_Supplier,Trade_Name,Gross_Taxable_Value,Returned_Taxable_Value,Net_Taxable_Value,CGST_TCS,SGST_TCS,IGST_TCS
08AABCA1234F1Z5,Jaipur Loom,450000.00,25000.00,425000.00,531.25,531.25,1062.50
```

### `GET /api/compliance/form26q/export`
Generates the quarterly Form 26Q Section 194-O deductee statement for NSDL e-TDS RPU utility.
- **Headers**: `Authorization: Bearer <SUPER_ADMIN_JWT>`
- **Query Params**: `fy=2026-2027&quarter=Q2`
- **Response**: Formatted ASCII / CSV matching NSDL RPU specifications.
