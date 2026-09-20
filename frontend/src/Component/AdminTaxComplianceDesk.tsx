import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { GlassToast } from "./GlassToast";
import { Pagination } from "./Pagination";

interface TaxProfile {
  site_id: string;
  legal_business_name: string;
  trade_name?: string;
  entity_type: string;
  registration_type: string;
  pan_number: string;
  is_pan_verified: boolean;
  gstin?: string;
  is_gstin_verified: boolean;
  state_code: string;
  state_name?: string;
  city?: string;
  pincode?: string;
  is_composition_dealer: boolean;
  default_hsn_code?: string;
  default_tax_rate?: number;
  fy_gross_sales_amount: number;
  fy_tds_deducted_amount: number;
}

interface Section194OProgress {
  threshold: number;
  cumulative_sales: number;
  is_threshold_exceeded: boolean;
  progress_percent: number;
  applicable_rate: number;
  is_individual_or_huf: boolean;
  has_pan?: boolean;
}

interface GSTR8Table4Row {
  gstin_of_supplier: string;
  legal_name: string;
  state_code: string;
  gross_value_of_supplies: number;
  value_of_supplies_returned: number;
  net_value_of_supplies: number;
  integrated_tax_tcs: number;
  central_tax_tcs: number;
  state_ut_tax_tcs: number;
  total_tcs: number;
}

interface GSTR8OrderRecord {
  order_id: string;
  order_number: string;
  created_at: string;
  payment_method: string;
  taxable_product_value: number;
  is_returned: boolean;
  tcs_rate: number;
  cgst_tcs: number;
  sgst_tcs: number;
  igst_tcs: number;
  total_tcs: number;
  status: string;
}

interface Form26QRecord {
  order_id: string;
  order_number?: string;
  site_id: string;
  merchant_pan: string;
  merchant_name: string;
  section_code: string;
  payment_date: string;
  gross_amount_paid: number;
  tds_rate: number;
  tds_deducted: number;
}

export const formatINR = (val: number | undefined | null) => {
  return Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const AdminTaxComplianceDesk: React.FC<{
  siteId?: string;
  onDirtyChange?: (isDirty: boolean) => void;
  onSavingChange?: (isSaving: boolean) => void;
  onSaveSuccess?: () => void;
}> = ({ siteId: propSiteId, onDirtyChange, onSavingChange, onSaveSuccess }) => {
  const { siteId: paramSiteId } = useParams<{ siteId: string }>();
  const siteId = propSiteId || paramSiteId || (typeof window !== "undefined" ? localStorage.getItem("last_active_site_id") || "" : "");
  const { isOwner, hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<"kyc" | "gstr8" | "form26q">("kyc");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Tab 1: KYC State
  const [loadingKYC, setLoadingKYC] = useState(false);
  const [savingKYC, setSavingKYC] = useState(false);
  const [taxProfile, setTaxProfile] = useState<TaxProfile | null>(null);
  const [sec194O, setSec194O] = useState<Section194OProgress | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const [formLegalName, setFormLegalName] = useState("");
  const [formTradeName, setFormTradeName] = useState("");
  const [formEntityType, setFormEntityType] = useState("proprietorship");
  const [formRegType, setFormRegType] = useState("regular");
  const [formPan, setFormPan] = useState("");
  const [formGstin, setFormGstin] = useState("");
  const [formStateCode, setFormStateCode] = useState("27");
  const [formCity, setFormCity] = useState("");
  const [formPincode, setFormPincode] = useState("");
  const [formIsComposition, setFormIsComposition] = useState(false);
  const [formDefaultHsn, setFormDefaultHsn] = useState("");

  const currentSnapshot = React.useMemo(() => {
    return JSON.stringify({
      formLegalName: formLegalName.trim(),
      formTradeName: formTradeName.trim(),
      formEntityType,
      formRegType,
      formPan: formPan.trim().toUpperCase(),
      formGstin: formGstin.trim().toUpperCase(),
      formStateCode: formStateCode.trim(),
      formCity: formCity.trim(),
      formPincode: formPincode.trim(),
      formIsComposition,
      formDefaultHsn: formDefaultHsn.trim(),
    });
  }, [
    formLegalName,
    formTradeName,
    formEntityType,
    formRegType,
    formPan,
    formGstin,
    formStateCode,
    formCity,
    formPincode,
    formIsComposition,
    formDefaultHsn,
  ]);

  const isDirty = Boolean(initialSnapshot && initialSnapshot !== currentSnapshot);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onSavingChange?.(savingKYC);
  }, [savingKYC, onSavingChange]);

  // Tab 2: GSTR-8 State (Default to current calendar month)
  const currentCalMonth = new Date().getMonth() + 1;
  const [gstr8FY, setGstr8FY] = useState("2026-2027");
  const [gstr8Month, setGstr8Month] = useState<number | "">(currentCalMonth);
  const [gstr8Page, setGstr8Page] = useState(1);
  const [gstr8PageSize, setGstr8PageSize] = useState(10);
  const [gstr8Data, setGstr8Data] = useState<{
    summary: any;
    table4_records: GSTR8Table4Row[];
    total_orders?: number;
    total_pages?: number;
    current_page?: number;
    page_size?: number;
    order_schedule?: GSTR8OrderRecord[];
  } | null>(null);
  const [loadingGstr8, setLoadingGstr8] = useState(false);

  // Tab 3: Form 26Q State (Default to current fiscal quarter)
  const getFiscalQuarter = (m: number) => {
    if (m >= 4 && m <= 6) return 1;
    if (m >= 7 && m <= 9) return 2;
    if (m >= 10 && m <= 12) return 3;
    return 4;
  };
  const currentFiscalQuarter = getFiscalQuarter(currentCalMonth);
  const [tdsFY, setTdsFY] = useState("2026-2027");
  const [tdsQuarter, setTdsQuarter] = useState<number | "">(currentFiscalQuarter);
  const [tdsPage, setTdsPage] = useState(1);
  const [tdsPageSize, setTdsPageSize] = useState(10);
  const [tdsData, setTdsData] = useState<{
    total_gross_paid: number;
    total_tds_deducted: number;
    total_records?: number;
    total_pages?: number;
    current_page?: number;
    page_size?: number;
    records: Form26QRecord[];
  } | null>(null);
  const [loadingTds, setLoadingTds] = useState(false);

  // Load KYC Profile
  const fetchKYCProfile = async () => {
    if (!siteId) return;
    setLoadingKYC(true);
    try {
      const res = await fetch(`${API_BASE_URL}/compliance/tax-kyc/${siteId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.has_profile && data.profile) {
          setTaxProfile(data.profile);
          setFormLegalName(data.profile.legal_business_name || "");
          setFormTradeName(data.profile.trade_name || "");
          setFormEntityType(data.profile.entity_type || "proprietorship");
          setFormRegType(data.profile.registration_type || "regular");
          setFormPan(data.profile.pan_number || "");
          setFormGstin(data.profile.gstin || "");
          setFormStateCode(data.profile.state_code || "27");
          setFormCity(data.profile.city || "");
          setFormPincode(data.profile.pincode || "");
          setFormIsComposition(data.profile.is_composition_dealer || false);
          setFormDefaultHsn(data.profile.default_hsn_code || "");

          const snap = JSON.stringify({
            formLegalName: (data.profile.legal_business_name || "").trim(),
            formTradeName: (data.profile.trade_name || "").trim(),
            formEntityType: data.profile.entity_type || "proprietorship",
            formRegType: data.profile.registration_type || "regular",
            formPan: (data.profile.pan_number || "").trim().toUpperCase(),
            formGstin: (data.profile.gstin || "").trim().toUpperCase(),
            formStateCode: (data.profile.state_code || "27").trim(),
            formCity: (data.profile.city || "").trim(),
            formPincode: (data.profile.pincode || "").trim(),
            formIsComposition: data.profile.is_composition_dealer || false,
            formDefaultHsn: (data.profile.default_hsn_code || "").trim(),
          });
          setInitialSnapshot(snap);
        }
        if (data.section_194o) {
          setSec194O(data.section_194o);
        }
      }
    } catch (err) {
      console.error("Failed to load tax KYC profile:", err);
    } finally {
      setLoadingKYC(false);
    }
  };

  useEffect(() => {
    fetchKYCProfile();
  }, [siteId]);

  // Load GSTR-8
  const fetchGSTR8 = async (page = gstr8Page, limit = gstr8PageSize) => {
    setLoadingGstr8(true);
    try {
      const q = new URLSearchParams();
      if (siteId) q.set("site_id", siteId);
      if (gstr8FY) q.set("financial_year", gstr8FY);
      if (gstr8Month !== "") q.set("month", String(gstr8Month));
      q.set("page", String(page));
      q.set("limit", String(limit));

      const res = await fetch(`${API_BASE_URL}/compliance/gstr8/table4?${q.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setGstr8Data(data);
      }
    } catch (err) {
      console.error("Failed to load GSTR-8:", err);
    } finally {
      setLoadingGstr8(false);
    }
  };

  // Load Form 26Q with Pagination
  const fetchForm26Q = async (page = tdsPage, limit = tdsPageSize) => {
    setLoadingTds(true);
    try {
      const q = new URLSearchParams();
      if (siteId) q.set("site_id", siteId);
      if (tdsFY) q.set("financial_year", tdsFY);
      if (tdsQuarter !== "") q.set("quarter", String(tdsQuarter));
      q.set("page", String(page));
      q.set("limit", String(limit));

      const res = await fetch(`${API_BASE_URL}/compliance/form26q?${q.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTdsData(data);
        if (data.section_194o) {
          setSec194O(data.section_194o);
        }
      }
    } catch (err) {
      console.error("Failed to load Form 26Q:", err);
    } finally {
      setLoadingTds(false);
    }
  };

  useEffect(() => {
    fetchKYCProfile();
    if (activeTab === "gstr8") fetchGSTR8(gstr8Page, gstr8PageSize);
    if (activeTab === "form26q") fetchForm26Q(tdsPage, tdsPageSize);
  }, [siteId, activeTab, gstr8FY, gstr8Month, gstr8Page, gstr8PageSize, tdsFY, tdsQuarter, tdsPage, tdsPageSize]);

  const handleSaveKYC = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalPan = formPan.trim().toUpperCase();
    const cleanGstin = formGstin.trim().toUpperCase();
    if ((!finalPan || finalPan.length < 10) && cleanGstin.length >= 12) {
      finalPan = cleanGstin.slice(2, 12);
      setFormPan(finalPan);
    }

    if (finalPan && finalPan.length !== 10) {
      setToast({ message: "PAN must be a valid 10-character code (e.g. AAACS1234F).", type: "error" });
      return;
    }

    setSavingKYC(true);
    try {
      const res = await fetch(`${API_BASE_URL}/compliance/tax-kyc`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          site_id: siteId,
          legal_business_name: formLegalName.trim(),
          trade_name: formTradeName.trim() || null,
          entity_type: formEntityType,
          registration_type: formRegType,
          pan_number: finalPan,
          gstin: cleanGstin || null,
          state_code: formStateCode.trim() || (cleanGstin.length >= 2 ? cleanGstin.slice(0, 2) : "27"),
          city: formCity.trim() || null,
          pincode: formPincode.trim() || null,
          is_composition_dealer: formIsComposition || formRegType === "composition",
          allow_interstate_sales: true,
          default_hsn_code: formDefaultHsn.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        let msg = "Failed to update KYC profile";
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else if (Array.isArray(data.detail)) {
          msg = data.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ");
        }
        throw new Error(msg);
      }

      setToast({ message: "Tax profile and HSN settings saved successfully!", type: "success" });
      setInitialSnapshot(currentSnapshot);
      onSaveSuccess?.();
      fetchKYCProfile();
    } catch (err: any) {
      setToast({ message: err.message || "Error saving tax profile", type: "error" });
    } finally {
      setSavingKYC(false);
    }
  };

  const downloadGstr8Csv = () => {
    const q = new URLSearchParams();
    if (siteId) q.set("site_id", siteId);
    if (gstr8FY) q.set("financial_year", gstr8FY);
    if (gstr8Month !== "") q.set("month", String(gstr8Month));
    q.set("format", "csv");
    window.open(`${API_BASE_URL}/compliance/gstr8/table4?${q.toString()}`, "_blank");
  };

  const downloadForm26QCsv = () => {
    const q = new URLSearchParams();
    if (siteId) q.set("site_id", siteId);
    if (tdsFY) q.set("financial_year", tdsFY);
    if (tdsQuarter !== "") q.set("quarter", String(tdsQuarter));
    q.set("format", "csv");
    window.open(`${API_BASE_URL}/compliance/form26q?${q.toString()}`, "_blank");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "7px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    color: "#0f172a",
    background: "#ffffff",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569",
    marginBottom: "5px",
  };

  return (
    <div style={{ width: "100%", color: "#0f172a", fontFamily: "inherit" }}>
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Sub-Tab Navigation Bar Matching Standard Charge style */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          borderBottom: "1px solid #e2e8f0",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("kyc")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            border: "none",
            borderBottom: activeTab === "kyc" ? "2px solid #2563eb" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "kyc" ? "#2563eb" : "#64748b",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
            marginBottom: "-1px",
          }}
        >
          <span>Tax & GST Profile</span>
          <span
            style={{
              width: "6px",
              height: "6px",
              minWidth: "6px",
              borderRadius: "999px",
              background: taxProfile?.is_pan_verified ? "#16a34a" : "#cbd5e1",
              display: "inline-block",
              transition: "background 0.2s ease",
            }}
            title={taxProfile?.is_pan_verified ? "Verified" : "Pending Profile"}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gstr8")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            border: "none",
            borderBottom: activeTab === "gstr8" ? "2px solid #2563eb" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "gstr8" ? "#2563eb" : "#64748b",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
            marginBottom: "-1px",
          }}
        >
          <span>GSTR-8 Reports</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("form26q")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 12px",
            border: "none",
            borderBottom: activeTab === "form26q" ? "2px solid #2563eb" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "form26q" ? "#2563eb" : "#64748b",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
            marginBottom: "-1px",
          }}
        >
          <span>Form 26Q (TDS)</span>
        </button>
      </div>

      {/* TAB 1: TAX PROFILE */}
      {activeTab === "kyc" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Clean Tax Profile Form */}
          <form
            id="tax-kyc-form"
            onSubmit={handleSaveKYC}
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              padding: "22px 24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* Section 1: Business Details */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "14px" }}>
                Business Registration & Tax Details
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Legal Business Name (as on PAN) *</label>
                  <input
                    type="text"
                    required
                    value={formLegalName}
                    onChange={(e) => setFormLegalName(e.target.value)}
                    placeholder="e.g. GreenHarvest Enterprises Pvt Ltd"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Trade / Brand Name</label>
                  <input
                    type="text"
                    value={formTradeName}
                    onChange={(e) => setFormTradeName(e.target.value)}
                    placeholder="e.g. GreenHarvest Store"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Legal Entity Type *</label>
                  <select
                    value={formEntityType}
                    onChange={(e) => setFormEntityType(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="proprietorship">Sole Proprietorship</option>
                    <option value="individual">Individual</option>
                    <option value="partnership">Partnership Firm</option>
                    <option value="llp">Limited Liability Partnership (LLP)</option>
                    <option value="company">Private / Public Limited Company</option>
                    <option value="huf">Hindu Undivided Family (HUF)</option>
                    <option value="trust_society">Trust / Society</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>GST Registration Type *</label>
                  <select
                    value={formRegType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormRegType(val);
                      if (val === "composition") setFormIsComposition(true);
                      else setFormIsComposition(false);
                    }}
                    style={inputStyle}
                  >
                    <option value="regular">Regular GST Registered</option>
                    <option value="composition">Composition Scheme Dealer (Section 10)</option>
                    <option value="unregistered">Unregistered (Exempted Threshold)</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Permanent Account Number (PAN)</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formPan}
                    onChange={(e) => setFormPan(e.target.value.toUpperCase())}
                    placeholder="AAACS1234F"
                    style={{ ...inputStyle, letterSpacing: "0.05em", fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>GSTIN (Goods & Services Tax ID)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formGstin}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase().trim();
                      setFormGstin(upper);
                      if (upper.length >= 2) {
                        setFormStateCode(upper.slice(0, 2));
                      }
                      if (upper.length >= 12 && (!formPan || formPan.length < 10)) {
                        setFormPan(upper.slice(2, 12));
                      }
                    }}
                    placeholder="27AAACS1234F1Z5"
                    style={{ ...inputStyle, letterSpacing: "0.05em", fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>GST State Code (First 2 Digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formStateCode}
                    onChange={(e) => setFormStateCode(e.target.value)}
                    placeholder="27"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Registered City & Pincode</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="City"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="text"
                      maxLength={6}
                      value={formPincode}
                      onChange={(e) => setFormPincode(e.target.value)}
                      placeholder="Pincode"
                      style={{ ...inputStyle, width: "100px" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "14px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12.5px", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={formIsComposition}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormIsComposition(checked);
                      if (checked) setFormRegType("composition");
                      else if (formRegType === "composition") setFormRegType("regular");
                    }}
                  />
                  <span>
                    <b>Registered as Composition Dealer under Section 10 CGST Act</b> (0% customer GST, Bill of Supply)
                  </span>
                </label>
              </div>
            </div>

            <div style={{ height: "1px", background: "#f1f5f9" }} />

            {/* Section 2: Store Default Tax & HSN Settings */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                Store Default HSN Code (Optional)
              </div>
              <p style={{ margin: "0 0 12px 0", fontSize: "12.5px", color: "#64748b" }}>
                Products without an individual HSN code will inherit this code. The statutory GST rate (e.g. 5%, 12%, 18%) is automatically derived by the tax engine.
              </p>

              <div style={{ maxWidth: "360px" }}>
                <label style={labelStyle}>Default HSN / SAC Code</label>
                <input
                  type="text"
                  value={formDefaultHsn}
                  onChange={(e) => setFormDefaultHsn(e.target.value)}
                  placeholder="e.g. 6403, 8517, or 0802"
                  style={inputStyle}
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: GSTR-8 (TABLE 4) — EXACT USER MOCKUP DESIGN */}
      {activeTab === "gstr8" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {(() => {
            const firstRow = gstr8Data?.table4_records?.[0];
            const gross = firstRow?.gross_value_of_supplies ?? 0;
            const returned = firstRow?.value_of_supplies_returned ?? 0;
            const net = firstRow?.net_value_of_supplies ?? 0;
            const tcs = firstRow?.total_tcs ?? 0;
            const cgstTcs = firstRow?.central_tax_tcs ?? (tcs / 2);
            const sgstTcs = firstRow?.state_ut_tax_tcs ?? (tcs / 2);
            const igstTcs = firstRow?.integrated_tax_tcs ?? 0;
            const activeGstin = firstRow?.gstin_of_supplier || formGstin || "27AAACS1234F1Z5";
            const activeLegalName = firstRow?.legal_name || formLegalName || "GreenHarvest Enterprises Private Limited";

            return (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "18px 20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {/* 1. Top Section: Header Title + Export Button */}
                {/* 1. Integrated Header with Inline Filters & Compact Export Button */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#2563eb",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                        GSTR-8 Section 52 Summary
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Statutory TCS return and order schedule
                      </div>
                    </div>
                  </div>

                  {/* Compact Right-Side Controls: Filters & Small Export Button */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <select
                      value={gstr8FY}
                      onChange={(e) => {
                        setGstr8FY(e.target.value);
                        setGstr8Page(1);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#0f172a",
                        background: "#ffffff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="2026-2027">FY 2026-27</option>
                      <option value="2025-2026">FY 2025-26</option>
                    </select>

                    <select
                      value={gstr8Month}
                      onChange={(e) => {
                        setGstr8Month(e.target.value === "" ? "" : Number(e.target.value));
                        setGstr8Page(1);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#0f172a",
                        background: "#ffffff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">All Months (Cumulative)</option>
                      <option value="4">Apr</option>
                      <option value="5">May</option>
                      <option value="6">Jun</option>
                      <option value="7">Jul</option>
                      <option value="8">Aug</option>
                      <option value="9">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                      <option value="1">Jan</option>
                      <option value="2">Feb</option>
                      <option value="3">Mar</option>
                    </select>

                    <button
                      type="button"
                      onClick={downloadGstr8Csv}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#ffffff",
                        color: "#16a34a",
                        border: "1px solid #86efac",
                        borderRadius: "6px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}
                      title="Download GSTR-8 Table 4 CSV"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* 2. Four Dynamic Metric Stats Row (Anti-Overlap & Compact) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {/* Card 1: Gross Supplies */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Gross Supplies (Taxable)
                    </div>
                    <div
                      style={{
                        fontSize: "clamp(15px, 1.5vw, 19px)",
                        fontWeight: 800,
                        color: "#0f172a",
                        letterSpacing: "-0.02em",
                        margin: "3px 0 1px 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontVariantNumeric: "tabular-nums",
                      }}
                      title={`₹${formatINR(gross)}`}
                    >
                      ₹{formatINR(gross)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Taxable base across orders
                    </div>
                  </div>

                  {/* Card 2: Returned / Cancelled */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Returned / Cancelled
                    </div>
                    <div
                      style={{
                        fontSize: "clamp(15px, 1.5vw, 19px)",
                        fontWeight: 800,
                        color: "#dc2626",
                        letterSpacing: "-0.02em",
                        margin: "3px 0 1px 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontVariantNumeric: "tabular-nums",
                      }}
                      title={`₹${formatINR(returned)}`}
                    >
                      ₹{formatINR(returned)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Reversed credit notes
                    </div>
                  </div>

                  {/* Card 3: Net Supplies Liable to TCS */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Net Supplies (TCS Base)
                    </div>
                    <div
                      style={{
                        fontSize: "clamp(15px, 1.5vw, 19px)",
                        fontWeight: 800,
                        color: "#2563eb",
                        letterSpacing: "-0.02em",
                        margin: "3px 0 1px 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontVariantNumeric: "tabular-nums",
                      }}
                      title={`₹${formatINR(net)}`}
                    >
                      ₹{formatINR(net)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Gross minus returns
                    </div>
                  </div>

                  {/* Card 4: Total Section 52 TCS */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Section 52 TCS
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "999px", background: "transparent", border: "1px solid #86efac", color: "#16a34a", whiteSpace: "nowrap" }}>
                        0.50%
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "clamp(15px, 1.5vw, 19px)",
                        fontWeight: 800,
                        color: "#16a34a",
                        letterSpacing: "-0.02em",
                        margin: "3px 0 1px 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontVariantNumeric: "tabular-nums",
                      }}
                      title={`₹${formatINR(tcs)}`}
                    >
                      ₹{formatINR(tcs)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {igstTcs > 0 ? `IGST ₹${formatINR(igstTcs)}` : `CGST ₹${formatINR(cgstTcs)} + SGST ₹${formatINR(sgstTcs)}`}
                    </div>
                  </div>
                </div>

                {/* 3. Streamlined Metadata Strip */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, overflow: "hidden" }}>
                    <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>GSTIN:</span>
                    <strong style={{ fontFamily: "monospace", color: "#2563eb", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{activeGstin}</strong>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeLegalName}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", flexShrink: 0 }}>
                    <span style={{ whiteSpace: "nowrap" }}>State: <strong style={{ color: "#0f172a" }}>{formStateCode || "27"}</strong></span>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <span style={{ whiteSpace: "nowrap" }}>Period: <strong style={{ color: "#0f172a" }}>{gstr8Month !== "" ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(gstr8Month)-1]} (${gstr8FY})` : `${gstr8FY} (Cumulative)`}</strong></span>
                  </div>
                </div>

                <div style={{ height: "1px", background: "#f1f5f9" }} />

                {/* 5. Section 52 GST-TCS Transaction Schedule (Order-by-Order) */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      Section 52 GST-TCS Transaction Schedule (Order-by-Order)
                    </div>
                    {gstr8Data?.total_orders !== undefined && (
                      <div style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                        Total Orders: <strong style={{ color: "#0f172a" }}>{gstr8Data.total_orders}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ overflowX: "hidden", width: "100%" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", background: "#ffffff" }}>
                          <th style={{ padding: "7px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>Order #</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>Date</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>Mode</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>Taxable (₹)</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>Rate</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>CGST (₹)</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>SGST (₹)</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>IGST (₹)</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>Total TCS (₹)</th>
                          <th style={{ padding: "7px 6px", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingGstr8 ? (
                          <tr>
                            <td colSpan={10} style={{ padding: "24px", textAlign: "center", color: "#64748b", whiteSpace: "nowrap" }}>
                              Loading Section 52 GST-TCS records...
                            </td>
                          </tr>
                        ) : gstr8Data?.order_schedule && gstr8Data.order_schedule.length > 0 ? (
                          gstr8Data.order_schedule.map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "8px 6px", fontFamily: "monospace", fontWeight: 600, color: "#2563eb", whiteSpace: "nowrap" }}>
                                {r.order_number}
                              </td>
                              <td style={{ padding: "8px 6px", color: "#64748b", whiteSpace: "nowrap" }}>{r.created_at}</td>
                              <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: "4px",
                                    background: "transparent",
                                    border: "1px solid #e2e8f0",
                                    color: r.payment_method.includes("COD") ? "#d97706" : "#2563eb",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {r.payment_method}
                                </span>
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: r.is_returned ? "#dc2626" : "#0f172a", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                {r.is_returned ? `-₹${formatINR(r.taxable_product_value)}` : `₹${formatINR(r.taxable_product_value)}`}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: "#64748b", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                {r.tcs_rate.toFixed(2)}%
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: "#64748b", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                ₹{formatINR(r.cgst_tcs)}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: "#64748b", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                ₹{formatINR(r.sgst_tcs)}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: "#64748b", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                ₹{formatINR(r.igst_tcs)}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800, color: r.total_tcs > 0 ? "#16a34a" : "#64748b", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                ₹{formatINR(r.total_tcs)}
                              </td>
                              <td style={{ padding: "8px 6px", textAlign: "center", whiteSpace: "nowrap" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "transparent",
                                    border:
                                      r.status === "deducted"
                                        ? "1px solid #86efac"
                                        : r.status === "reversed"
                                        ? "1px solid #fca5a5"
                                        : "1px solid #e2e8f0",
                                    color:
                                      r.status === "deducted"
                                        ? "#16a34a"
                                        : r.status === "reversed"
                                        ? "#dc2626"
                                        : "#64748b",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {r.status === "deducted"
                                    ? "TCS Deducted"
                                    : r.status === "reversed"
                                    ? "Reversed"
                                    : "Exempt"}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10} style={{ padding: "32px 20px", textAlign: "center" }}>
                              <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                                No Section 52 GST-TCS records for this period
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748b", maxWidth: "540px", margin: "0 auto" }}>
                                Orders fulfilled during the selected calendar month will be itemized here with exact CGST/SGST/IGST withholdings.
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Centered Pagination Controls */}
                  {gstr8Data && (gstr8Data.total_orders ?? 0) > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        marginTop: "16px",
                        padding: "8px 4px",
                        width: "100%",
                      }}
                    >
                      <Pagination
                        currentPage={gstr8Page}
                        totalPages={gstr8Data.total_pages || 1}
                        onPageChange={(page) => {
                          setGstr8Page(page);
                        }}
                        pageSize={gstr8PageSize}
                        pageSizeOptions={[10, 20, 50, 100]}
                        onPageSizeChange={(newSize) => {
                          setGstr8PageSize(newSize);
                          setGstr8Page(1);
                        }}
                        accentColor="#2563eb"
                        style={{ padding: 0 }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 6px 0", fontSize: "11px", color: "#94a3b8" }}>
                    <span>Statutory monthly ECO return under Section 52 CGST/SGST Act reported via GSTR-8 on the GST Portal.</span>
                    <span>Status: Auto-Reconciled</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 3: FORM 26Q (TDS) — MATCHING GSTR-8 EXECUTIVE CARD DESIGN */}
      {activeTab === "form26q" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              padding: "18px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* 1. Integrated Header with Inline Filters & Compact Export Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "8px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2563eb",
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="9.5" y1="9" x2="14.5" y2="15" />
                    <circle cx="10" cy="10" r="1" fill="currentColor" />
                    <circle cx="14" cy="14" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                    Form 26Q (TDS) Summary
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    Section 194-O Income-Tax quarterly returns and schedule
                  </div>
                </div>
              </div>

              {/* Compact Right-Side Controls: Filters & Small Export Button */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <select
                  value={tdsFY}
                  onChange={(e) => {
                    setTdsFY(e.target.value);
                    setTdsPage(1);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#ffffff",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="2026-2027">FY 2026-27</option>
                  <option value="2025-2026">FY 2025-26</option>
                </select>

                <select
                  value={tdsQuarter}
                  onChange={(e) => {
                    setTdsQuarter(e.target.value === "" ? "" : Number(e.target.value));
                    setTdsPage(1);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#ffffff",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Full Year (Cumulative)</option>
                  <option value="1">Q1 (Apr - Jun)</option>
                  <option value="2">Q2 (Jul - Sep)</option>
                  <option value="3">Q3 (Oct - Dec)</option>
                  <option value="4">Q4 (Jan - Mar)</option>
                </select>

                <button
                  type="button"
                  onClick={downloadForm26QCsv}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    background: "#ffffff",
                    color: "#16a34a",
                    border: "1px solid #86efac",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                  title="Download Form 26Q Section 194-O CSV"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* 2. Section 194-O Income-Tax TDS Tracker Card (Clean & Minimal) */}
            {sec194O && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>Section 194-O TDS Tracker</span>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: "999px",
                        background: "transparent",
                        whiteSpace: "nowrap",
                        border: (sec194O.has_pan === false || sec194O.applicable_rate >= 5.0 || sec194O.is_threshold_exceeded)
                          ? "1px solid #fca5a5"
                          : "1px solid #86efac",
                        color: (sec194O.has_pan === false || sec194O.applicable_rate >= 5.0 || sec194O.is_threshold_exceeded)
                          ? "#dc2626"
                          : "#16a34a",
                      }}
                    >
                      {sec194O.has_pan === false || sec194O.applicable_rate >= 5.0
                        ? "5.00% TDS (No PAN - Sec 206AA)"
                        : sec194O.is_threshold_exceeded
                        ? "0.10% TDS Active"
                        : "0.00% TDS (Under ₹5L)"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                    FY Sales: <strong style={{ color: "#0f172a", whiteSpace: "nowrap" }}>₹{formatINR(sec194O.cumulative_sales)}</strong>
                    {sec194O.is_individual_or_huf && sec194O.has_pan !== false && (
                      <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}> / ₹5,00,000.00</span>
                    )}
                  </div>
                </div>

                {sec194O.has_pan === false || sec194O.applicable_rate >= 5.0 ? (
                  <div style={{ fontSize: "11.5px", color: "#dc2626" }}>
                    No PAN on record. Under Section 206AA, penal TDS of 5.00% applies to all payouts.
                  </div>
                ) : sec194O.is_individual_or_huf ? (
                  <>
                    <div style={{ width: "100%", height: "5px", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden", marginBottom: "5px" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, sec194O.progress_percent)}%`,
                          background: sec194O.is_threshold_exceeded ? "#dc2626" : "#2563eb",
                          borderRadius: "999px",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                      <span>
                        {sec194O.is_threshold_exceeded
                          ? "Exemption threshold reached. 0.10% TDS applies on order credits."
                          : `₹${formatINR(Math.max(0, sec194O.threshold - sec194O.cumulative_sales))} remaining before TDS begins.`}
                      </span>
                      <span>{sec194O.progress_percent.toFixed(1)}%</span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                    Corporate / LLP Entity (0.10% standard TDS applies).
                  </div>
                )}
              </div>
            )}

            {/* 3. Four Dynamic Metric Stats Row (Anti-Overlap & Compact) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              {/* Card 1: Deductee Entity Type */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Deductee Entity
                </div>
                <div
                  style={{
                    fontSize: "clamp(15px, 1.5vw, 19px)",
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-0.01em",
                    margin: "3px 0 1px 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Sole Proprietor
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Individual PAN ('P')
                </div>
              </div>

              {/* Card 2: Withholding Rate */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Withholding Rate
                </div>
                <div
                  style={{
                    fontSize: "clamp(15px, 1.5vw, 19px)",
                    fontWeight: 800,
                    color: (sec194O?.applicable_rate && sec194O.applicable_rate > 0) ? "#dc2626" : "#16a34a",
                    letterSpacing: "-0.02em",
                    margin: "3px 0 1px 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {sec194O ? `${sec194O.applicable_rate.toFixed(2)}%` : "0.00%"}
                </div>
                <div style={{ fontSize: "11px", color: (sec194O?.applicable_rate && sec194O.applicable_rate > 0) ? "#dc2626" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {sec194O?.has_pan === false || (sec194O?.applicable_rate && sec194O.applicable_rate >= 5.0)
                    ? "Sec 206AA (No PAN)"
                    : sec194O?.is_threshold_exceeded
                    ? "Active on order credits"
                    : "Exempt under ₹5L"}
                </div>
              </div>

              {/* Card 3: Gross Orders Paid */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Gross Orders Paid
                </div>
                <div
                  style={{
                    fontSize: "clamp(15px, 1.5vw, 19px)",
                    fontWeight: 800,
                    color: "#2563eb",
                    letterSpacing: "-0.02em",
                    margin: "3px 0 1px 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontVariantNumeric: "tabular-nums",
                  }}
                  title={`₹${formatINR(tdsData?.total_gross_paid)}`}
                >
                  ₹{formatINR(tdsData?.total_gross_paid)}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Total credit value
                </div>
              </div>

              {/* Card 4: Total TDS Deducted */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Total TDS Deducted
                  </span>
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "999px", background: "transparent", border: "1px solid #cbd5e1", color: "#64748b", whiteSpace: "nowrap" }}>
                    NSDL
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "clamp(15px, 1.5vw, 19px)",
                    fontWeight: 800,
                    color: "#16a34a",
                    letterSpacing: "-0.02em",
                    margin: "3px 0 1px 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontVariantNumeric: "tabular-nums",
                  }}
                  title={`₹${formatINR(tdsData?.total_tds_deducted)}`}
                >
                  ₹{formatINR(tdsData?.total_tds_deducted)}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  For Form 16A credit
                </div>
              </div>
            </div>

            {/* 4. Streamlined Metadata Strip */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "7px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, overflow: "hidden" }}>
                <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>PAN:</span>
                <strong style={{ fontFamily: "monospace", color: "#2563eb", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{formPan || "Not Provided"}</strong>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <span style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formLegalName || "Store Owner"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", flexShrink: 0 }}>
                <span style={{ whiteSpace: "nowrap" }}>Sec: <strong style={{ color: "#0f172a" }}>194-O</strong></span>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <span style={{ whiteSpace: "nowrap" }}>TAN: <strong style={{ color: "#0f172a" }}>MUMB12345D</strong></span>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <span style={{ whiteSpace: "nowrap" }}>Period: <strong style={{ color: "#0f172a" }}>{tdsQuarter !== "" ? `Q${tdsQuarter} (${tdsFY})` : `${tdsFY} (Full Year)`}</strong></span>
              </div>
            </div>

            <div style={{ height: "1px", background: "#f1f5f9" }} />

            {/* 6. Order-by-Order Transaction Schedule Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                  Form 26Q Transaction Schedule (Order-by-Order)
                </div>
                {tdsData?.total_records !== undefined && (
                  <div style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                    Total Deductions: <strong style={{ color: "#0f172a" }}>{tdsData.total_records}</strong>
                  </div>
                )}
              </div>

              <div style={{ overflowX: "hidden", width: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", background: "#ffffff" }}>
                      <th style={{ padding: "7px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>Order #</th>
                      <th style={{ padding: "7px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>Deductee PAN</th>
                      <th style={{ padding: "7px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>Deductee Name</th>
                      <th style={{ padding: "7px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>Date</th>
                      <th style={{ padding: "7px 8px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>Gross Paid (₹)</th>
                      <th style={{ padding: "7px 8px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>TDS Rate</th>
                      <th style={{ padding: "7px 8px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>TDS Deducted (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTds ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#64748b", whiteSpace: "nowrap" }}>Loading Form 26Q records...</td>
                      </tr>
                    ) : tdsData && tdsData.records.length > 0 ? (
                      tdsData.records.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 8px", fontFamily: "monospace", fontWeight: 600, color: "#2563eb", whiteSpace: "nowrap" }}>{r.order_number || `ORD-${r.order_id.slice(0, 8).toUpperCase()}`}</td>
                          <td style={{ padding: "8px 8px", fontFamily: "monospace", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>{r.merchant_pan}</td>
                          <td style={{ padding: "8px 8px", color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }} title={r.merchant_name}>{r.merchant_name}</td>
                          <td style={{ padding: "8px 8px", color: "#64748b", whiteSpace: "nowrap" }}>{r.payment_date}</td>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: "#0f172a", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>₹{formatINR(r.gross_amount_paid)}</td>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: "#64748b", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{r.tds_rate.toFixed(2)}%</td>
                          <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 800, color: "#16a34a", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>₹{formatINR(r.tds_deducted)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: "32px 20px", textAlign: "center" }}>
                          <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                            No TDS deductions recorded for this period
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", maxWidth: "540px", margin: "0 auto" }}>
                            As an individual / sole proprietor, your payouts are exempt from Section 194-O TDS until cumulative sales cross ₹5,00,000.00. Once crossed, each order deduction will be logged here.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Centered Pagination Controls */}
              {tdsData && (tdsData.total_records ?? 0) > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    marginTop: "16px",
                    padding: "8px 4px",
                    width: "100%",
                  }}
                >
                  <Pagination
                    currentPage={tdsPage}
                    totalPages={tdsData.total_pages || 1}
                    onPageChange={(page) => {
                      setTdsPage(page);
                    }}
                    pageSize={tdsPageSize}
                    pageSizeOptions={[10, 20, 50, 100]}
                    onPageSizeChange={(newSize) => {
                      setTdsPageSize(newSize);
                      setTdsPage(1);
                    }}
                    accentColor="#2563eb"
                    style={{ padding: 0 }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 6px 0", fontSize: "11px", color: "#94a3b8" }}>
                <span>Income-tax quarterly return filed via TRACES / NSDL Portal under Section 194-O.</span>
                <span>Status: Auto-Tracked</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
