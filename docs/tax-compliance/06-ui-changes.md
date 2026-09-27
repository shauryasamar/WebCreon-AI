# WebCreon AI: UI & Frontend Changes Specification
**Document Ref**: `docs/tax-compliance/06-ui-changes.md`  
**Frontend Framework**: React 19 / TypeScript / Tailwind-free Vanilla CSS & Styled Modules  

---

## 1. Merchant Settings: Tax & KYC Hub (`frontend/src/Component/AdminSettingsViews.tsx`)

### Existing UI State
- Two simple text inputs: `PAN Number` and `GST Number` inside `TenantBankAccount` editing card.
- No legal entity type dropdown, no state selection, no verification badge, and no Section 194-O tracker.

### Required Evolution
Replace the basic input fields with a structured **Merchant Legal & Tax Profile Section**:
1. **Legal Business & Trade Identity**:
   - `Legal Entity Type` Dropdown: `Individual`, `HUF`, `Proprietorship`, `Partnership`, `LLP`, `Private Limited`, `Public Limited`.
   - `Legal Business Name` (as registered on PAN).
   - `Trade Name` (storefront branding name).
2. **Statutory Tax Credentials**:
   - `PAN`: Formatted 10-character uppercase input with live regex format indicator.
   - `Registration Type`: Radio options: `Regular Registered`, `Composition Scheme (Sec 10)`, `Unregistered (Turnover < ₹20L/₹40L)`.
   - `GSTIN`: 15-character uppercase input with state code matching check.
   - `Enrolment ID`: Enabled if registration type is `Unregistered`.
3. **Principal Place of Business (PPoB)**:
   - State code dropdown with all 38 Indian state codes (e.g., `27 - Maharashtra`, `08 - Rajasthan`, `29 - Karnataka`, `07 - Delhi`).
   - Street address, City, PIN code.
4. **Section 194-O Threshold Gauge (for Individual / HUF)**:
   - Visual progress bar showing FY GMV toward the ₹5,00,000 threshold:
     ```
     [=======================>            ] ₹3,45,000 / ₹5,00,000 (69%)
     Status: Exempt from 0.1% TDS until threshold breached.
     ```

---

## 2. Order Details & Invoicing UI (`frontend/src/Component/AdminOrders.tsx` & `CustomerOrdersPage.tsx`)

### Existing UI State
- Line 2272 of `AdminOrders.tsx`:
  ```typescript
  showToast(`Generating invoice for ${order.id}...`, "info");
  ```
- No backend invoice download.

### Required Evolution
1. **Customer Order Receipt & Invoice Button**:
   - Replaces mock toast with a functional download action:
     ```typescript
     const handleDownloadInvoice = async (orderId: string) => {
       try {
         const res = await fetch(`/orders/${orderId}/invoice/pdf`, {
           headers: { Authorization: `Bearer ${token}` }
         });
         const blob = await res.blob();
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement("a");
         a.href = url;
         a.download = `Invoice-${orderId.slice(0, 8)}.pdf`;
         a.click();
       } catch (err) {
         showToast("Failed to download tax invoice", "error");
       }
     };
     ```
2. **Merchant Order Drawer: Settlement Ledger Card**:
   Display transparent deduction breakdown for the merchant:
   - Gross Customer Total: **₹2,500.00**
   - Less Platform Fee (3%): **-₹60.00**
   - Less Platform Fee GST (18%): **-₹10.80**
   - Less GST-TCS (0.5% IGST): **-₹10.59**
   - Less Section 194-O TDS (0.1%): **-₹2.50**
   - Less Gateway Fee (MDR): **-₹59.00**
   - **Net Payout (On Hold in Escrow)**: **₹2,357.11**

---

## 3. Product Catalog: Tax Configuration (`frontend/src/Component/AdminProductModal.tsx`)

1. **HSN/SAC Code Selector**:
   - Autocomplete dropdown pulling from `/api/tax-masters/search?q=...`.
   - Pre-fills description and standard GST rate (0%, 5%, 12%, 18%, 28%).
2. **Pricing Policy Toggle**:
   - Switch: `Price is inclusive of GST (Recommended for Indian retail / MRP)` vs `Price is exclusive of GST`.
   - When inclusive is toggled, UI displays real-time breakdown:
     *Entered Price: ₹1,180 -> Taxable Base: ₹1,000, GST (18%): ₹180*.
