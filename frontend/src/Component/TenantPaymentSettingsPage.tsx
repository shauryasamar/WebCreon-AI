import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

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

export default function TenantPaymentSettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [settings, setSettings] = useState<BankSettingsData>({
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
  const [holderName, setHolderName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  useEffect(() => {
    if (!siteId) return;

    let isMounted = true;
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/admin/${siteId}/payment-settings`, {
          credentials: "include",
        });

        if (res.ok) {
          const data: BankSettingsData = await res.json();
          if (isMounted) {
            setSettings(data);
            if (data.is_configured) {
              setHolderName(data.account_holder_name || "");
              setIfscCode(data.ifsc_code || "");
              setBankName(data.bank_name || "");
              setPanNumber(data.pan_number || "");
              setGstNumber(data.gst_number || "");
            }
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
            setBankName(`${ifscData.BANK} (${ifscData.BRANCH || ""})`);
          }
        }
      } catch {
        // Ignore lookup failure
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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

      if (accountNumber.trim().length < 8) {
        setErrorMessage("Please enter a valid bank account number.");
        return;
      }
    }

    if (!ifscCode.trim() || ifscCode.trim().length !== 11) {
      setErrorMessage("Please enter a valid 11-character IFSC code.");
      return;
    }

    if (!bankName.trim()) {
      setErrorMessage("Bank name is required.");
      return;
    }

    try {
      setSaving(true);
      const payload: Record<string, any> = {
        account_holder_name: holderName.trim(),
        account_number: accountNumber.trim() || settings.account_number_last4,
        ifsc_code: ifscCode.trim().toUpperCase(),
        bank_name: bankName.trim(),
        pan_number: panNumber.trim().toUpperCase() || null,
        gst_number: gstNumber.trim().toUpperCase() || null,
      };

      const res = await fetch(`${API_BASE_URL}/admin/${siteId}/payment-settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Failed to save bank settings.");
      }

      setSettings(resData);
      setAccountNumber("");
      setConfirmAccountNumber("");
      setSuccessMessage("Bank account details saved successfully.");
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
        <p style={{ fontSize: "14px", margin: 0, fontWeight: 500 }}>Loading payout settings...</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#334155",
    marginBottom: "5px",
  };

  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "24px 20px",
        color: "#0f172a",
        fontFamily: "inherit",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            Payout & Bank Settings
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Manage the bank account where your order earnings will be transferred.
          </p>
        </div>

        <Link
          to={`/builder/${siteId}/admin/earnings`}
          style={{
            padding: "8px 14px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          View Ledger →
        </Link>
      </div>

      {/* Active Account Status Pill */}
      {settings.is_configured && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "16px 18px",
            marginBottom: "20px",
            display: "grid",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ color: "#166534" }}>
              <strong>Linked Account:</strong> {settings.bank_name} &bull;{" "}
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                {settings.account_number_masked || `•••• ${settings.account_number_last4}`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "#dcfce7",
                  color: "#15803d",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "1px solid #86efac",
                }}
              >
                ✓ Verified
              </span>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "1px solid #bfdbfe",
                }}
              >
                ⚡ Route Active
              </span>
            </div>
          </div>

          <div
            style={{
              paddingTop: "8px",
              borderTop: "1px dashed #bbf7d0",
              color: "#15803d",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            <strong>Automated Settlement Flow:</strong> Customer payments automatically split at checkout. Your 97% net earnings are held in escrow and deposit directly into your bank account 48 hours after the order is delivered.
          </div>
        </div>
      )}

      {/* Alerts */}
      {successMessage && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            padding: "12px 14px",
            borderRadius: "6px",
            fontSize: "13px",
            marginBottom: "16px",
            fontWeight: 600,
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "12px 14px",
            borderRadius: "6px",
            fontSize: "13px",
            marginBottom: "16px",
            fontWeight: 600,
          }}
        >
          ⚠ {errorMessage}
        </div>
      )}

      {/* Main Settings Card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <form onSubmit={handleSave}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div style={{ gridColumn: "span 2" }}>
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

            <div>
              <label style={labelStyle}>
                {settings.is_configured ? "Confirm Account Number" : "Confirm Account Number *"}
              </label>
              <input
                type="text"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder={settings.is_configured ? "Re-enter to update" : "Confirm bank account number"}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>IFSC Code *</label>
                {lookupLoading && <span style={{ fontSize: "11px", color: "#2563eb" }}>Looking up bank...</span>}
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

            <div>
              <label style={labelStyle}>Bank & Branch Name *</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank, Indiranagar Branch"
                required
                style={inputStyle}
              />
            </div>

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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "9px 20px",
                borderRadius: "6px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
              }}
            >
              {saving ? "Saving..." : settings.is_configured ? "Update Bank Details" : "Save Bank Details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
