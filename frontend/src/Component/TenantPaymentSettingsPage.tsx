import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import GlassToast from "./GlassToast";

type BankSettingsData = {
  id?: string;
  account_holder_name: string;
  account_number_masked: string;
  account_number_last4: string;
  ifsc_code: string;
  bank_name: string;
  pan_number?: string | null;
  gst_number?: string | null;
  is_verified: boolean;
  is_configured: boolean;
  razorpay_account_id?: string | null;
  route_status?: string;
  route_onboarded_at?: string | null;
  updated_at?: string | null;
};

const getCachedBankSettings = (id?: string): BankSettingsData | null => {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`wc_admin_bank_settings_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function TenantPaymentSettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();

  const cachedSettings = getCachedBankSettings(siteId);
  const [loading, setLoading] = useState(!cachedSettings);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [settings, setSettings] = useState<BankSettingsData>(() => cachedSettings || {
    account_holder_name: "",
    account_number_masked: "",
    account_number_last4: "",
    ifsc_code: "",
    bank_name: "",
    pan_number: "",
    gst_number: "",
    is_verified: false,
    is_configured: false,
  });

  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [holderName, setHolderName] = useState(() => cachedSettings?.account_holder_name || "");
  const [ifscCode, setIfscCode] = useState(() => cachedSettings?.ifsc_code || "");
  const [bankName, setBankName] = useState(() => cachedSettings?.bank_name || "");
  const [panNumber, setPanNumber] = useState(() => cachedSettings?.pan_number || "");
  const [gstNumber, setGstNumber] = useState(() => cachedSettings?.gst_number || "");

  const [initialSnapshot, setInitialSnapshot] = useState("");

  useEffect(() => {
    if (!siteId) return;

    let isMounted = true;
    const fetchSettings = async () => {
      try {
        if (!cachedSettings) {
          setLoading(true);
        }
        const res = await fetch(`${API_BASE_URL}/admin/${siteId}/payment-settings`, {
          credentials: "include",
        });

        if (res.ok) {
          const data: BankSettingsData = await res.json();
          if (isMounted) {
            setSettings(data);
            try {
              localStorage.setItem(`wc_admin_bank_settings_${siteId}`, JSON.stringify(data));
            } catch (_) {}
            const h = data.account_holder_name || "";
            const i = data.ifsc_code || "";
            const b = data.bank_name || "";
            const p = data.pan_number || "";
            const g = data.gst_number || "";

            if (data.is_configured) {
              setHolderName(h);
              setIfscCode(i);
              setBankName(b);
              setPanNumber(p);
              setGstNumber(g);
            }

            setInitialSnapshot(
              JSON.stringify({
                holderName: h,
                accountNumber: "",
                confirmAccountNumber: "",
                ifscCode: i,
                bankName: b,
                panNumber: p,
                gstNumber: g,
              })
            );
          }
        }
      } catch (err) {
        console.error("Failed to load bank settings", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [siteId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    const current = JSON.stringify({
      holderName,
      accountNumber,
      confirmAccountNumber,
      ifscCode,
      bankName,
      panNumber,
      gstNumber,
    });
    return current !== initialSnapshot;
  }, [
    holderName,
    accountNumber,
    confirmAccountNumber,
    ifscCode,
    bankName,
    panNumber,
    gstNumber,
    initialSnapshot,
  ]);

  const handleIfscLookup = async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    setIfscCode(cleaned);
    if (cleaned.length === 11) {
      try {
        setLookupLoading(true);
        const res = await fetch(`https://ifsc.razorpay.com/${cleaned}`);
        if (res.ok) {
          const ifscData = await res.json();
          if (ifscData.BANK) {
            setBankName(`${ifscData.BANK}${ifscData.BRANCH ? ` (${ifscData.BRANCH})` : ""}`);
          }
        }
      } catch {
        // Ignore lookup failure
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!siteId) return;

    if (!holderName.trim()) {
      setErrorMessage("Account holder name is required.");
      return;
    }

    if (!settings.is_configured || accountNumber.trim()) {
      if (!accountNumber.trim()) {
        setErrorMessage("Bank account number is required.");
        return;
      }

      if (accountNumber.trim() !== confirmAccountNumber.trim()) {
        setErrorMessage("Account numbers do not match.");
        return;
      }

      if (!/^\d{9,18}$/.test(accountNumber.trim())) {
        setErrorMessage("Bank account number must contain 9 to 18 numeric digits.");
        return;
      }
    }

    const ifscClean = ifscCode.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscClean)) {
      setErrorMessage("Please enter a valid 11-character IFSC code (e.g. HDFC0001234). 5th character must be '0'.");
      return;
    }

    if (!bankName.trim()) {
      setErrorMessage("Bank name is required.");
      return;
    }

    if (panNumber.trim()) {
      const panClean = panNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) {
        setErrorMessage("Invalid PAN format (e.g. ABCDE1234F).");
        return;
      }
    }

    if (gstNumber.trim()) {
      const gstClean = gstNumber.trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstClean)) {
        setErrorMessage("Invalid GST format (15 characters, e.g. 22AAAAA0000A1Z5).");
        return;
      }
    }

    try {
      setSaving(true);
      const payload: Record<string, any> = {
        account_holder_name: holderName.trim(),
        ifsc_code: ifscCode.trim().toUpperCase(),
        bank_name: bankName.trim(),
        pan_number: panNumber.trim().toUpperCase() || null,
        gst_number: gstNumber.trim().toUpperCase() || null,
      };

      if (accountNumber.trim()) {
        payload.account_number = accountNumber.trim();
      }

      const res = await fetch(`${API_BASE_URL}/admin/${siteId}/payment-settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        let msg = "Failed to save bank settings.";
        if (resData?.detail) {
          if (typeof resData.detail === "string") {
            msg = resData.detail;
          } else if (Array.isArray(resData.detail)) {
            msg = resData.detail
              .map((d: any) => d.msg || d.message || (d.loc ? `${d.loc.slice(-1)}: ${d.type}` : ""))
              .filter(Boolean)
              .join("; ") || "Validation error in submitted details.";
          }
        }
        throw new Error(msg);
      }

      setSettings(resData);
      setAccountNumber("");
      setConfirmAccountNumber("");
      setInitialSnapshot(
        JSON.stringify({
          holderName: resData.account_holder_name || "",
          accountNumber: "",
          confirmAccountNumber: "",
          ifscCode: resData.ifsc_code || "",
          bankName: resData.bank_name || "",
          panNumber: resData.pan_number || "",
          gstNumber: resData.gst_number || "",
        })
      );
      setSuccessMessage("Payout and bank settings saved successfully.");
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "6px",
  };

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
    overflow: "hidden",
  };

  const cardHeaderStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#ffffff",
  };

  if (loading) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
        Loading payout settings...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", color: "#0f172a", boxSizing: "border-box" }}>
      {/* Floating Top Glass Toast Notifications */}
      {successMessage && (
        <GlassToast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage("")}
          top="76px"
        />
      )}
      {errorMessage && (
        <GlassToast
          message={errorMessage}
          type="error"
          onClose={() => setErrorMessage("")}
          top="76px"
        />
      )}

      {/* Top Header Controls Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        {/* Left: Title & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
            Payout Settings
          </h1>
          {settings.is_configured ? (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#15803d",
                border: "1px solid #bbf7d0",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ✓ Active Route: {settings.bank_name || "Bank"} (•••{settings.account_number_last4})
            </span>
          ) : (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "10px",
                background: "#fffbeb",
                color: "#b45309",
                border: "1px solid #fde68a",
              }}
            >
              Not Configured
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            to={`/builder/${siteId}/admin/earnings`}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            View Ledger →
          </Link>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "6px",
              border: "none",
              background: saving ? "#94a3b8" : hasUnsavedChanges ? "#2563eb" : "#0f172a",
              color: "#ffffff",
              padding: "8px 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: saving ? "wait" : "pointer",
              transition: "background 0.15s ease",
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Main Settings Form Container */}
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Section 1: Primary Bank Details */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
              Bank Account Details
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Primary deposit destination for customer orders
            </div>
          </div>

          <div style={{ padding: "18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {/* Account Holder Name (Full Width) */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Account Holder Name *</label>
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Full name as registered in bank records"
                  required
                  style={inputStyle}
                />
              </div>

              {/* IFSC Code */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>IFSC Code *</label>
                  {lookupLoading && <span style={{ fontSize: "10.5px", color: "#2563eb", fontWeight: 600 }}>Looking up bank...</span>}
                </div>
                <input
                  type="text"
                  maxLength={11}
                  value={ifscCode}
                  onChange={(e) => handleIfscLookup(e.target.value)}
                  placeholder="e.g. HDFC0001234"
                  required
                  style={{ ...inputStyle, textTransform: "uppercase" }}
                />
              </div>

              {/* Bank & Branch Name */}
              <div>
                <label style={labelStyle}>Bank & Branch Name *</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Auto-filled via IFSC or enter manually"
                  required
                  style={inputStyle}
                />
              </div>

              {/* Account Number */}
              <div>
                <label style={labelStyle}>
                  {settings.is_configured ? "Account Number (Leave blank to keep unchanged)" : "Account Number *"}
                </label>
                <input
                  type="password"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={settings.is_configured ? settings.account_number_masked : "Enter bank account number"}
                  style={inputStyle}
                />
              </div>

              {/* Confirm Account Number */}
              <div>
                <label style={labelStyle}>
                  {settings.is_configured ? "Confirm Account Number" : "Confirm Account Number *"}
                </label>
                <input
                  type="text"
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                  placeholder={settings.is_configured ? "Re-enter if updating" : "Confirm bank account number"}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Business & Tax Identifiers (Optional) */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
              Business & Tax Information
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Optional billing identifiers
            </div>
          </div>

          <div style={{ padding: "18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {/* PAN Number */}
              <div>
                <label style={labelStyle}>PAN Number (Optional)</label>
                <input
                  type="text"
                  maxLength={10}
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  style={{ ...inputStyle, textTransform: "uppercase" }}
                />
              </div>

              {/* GST Number */}
              <div>
                <label style={labelStyle}>GST Number (Optional)</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  style={{ ...inputStyle, textTransform: "uppercase" }}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
