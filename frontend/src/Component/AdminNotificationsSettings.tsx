import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import GlassToast from "./GlassToast";

interface EmailSettings {
  site_id: string;
  sender_name?: string;
  sender_email?: string;
  reply_to_email?: string;
  provider_type?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_use_tls?: boolean;
  smtp_use_ssl?: boolean;
  verification_status?: string;
  verification_error?: string | null;
  last_verified_at?: string | null;
  has_smtp_password?: boolean;
  is_enabled?: boolean;
  updated_at?: string;
}

const plainCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  outline: "none",
  fontSize: "13px",
  boxSizing: "border-box",
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "4px",
  display: "block",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const ghostButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const CheckCircleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const AdminNotificationsSettings: React.FC<{ siteId?: string }> = ({ siteId: propSiteId }) => {
  const { siteId: paramSiteId } = useParams<{ siteId?: string }>();
  const activeSiteId = propSiteId || paramSiteId || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
  };

  const [settings, setSettings] = useState<EmailSettings>({
    site_id: activeSiteId,
    sender_name: "",
    sender_email: "",
    reply_to_email: "",
    provider_type: "smtp",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_use_tls: true,
    smtp_use_ssl: false,
    verification_status: "not_configured",
    has_smtp_password: false,
    is_enabled: true,
  });
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState("");

  const getAdminToken = useCallback((): string | null => {
    return (
      localStorage.getItem("adminToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      null
    );
  }, []);

  const loadSettings = useCallback(async () => {
    if (!activeSiteId) return;
    setLoading(true);
    const token = getAdminToken();

    try {
      const resp = await fetch(`${API_BASE_URL}/notifications/admin/${activeSiteId}/email-settings`, {
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
      });

      if (resp.ok) {
        let data: any = {};
        try {
          data = await resp.json();
        } catch {
          data = {};
        }
        const loadedSettings: EmailSettings = {
          site_id: activeSiteId,
          sender_name: data.sender_name || "",
          sender_email: data.sender_email || "",
          reply_to_email: data.reply_to_email || "",
          provider_type: data.provider_type || "smtp",
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port || 587,
          smtp_user: data.smtp_user || "",
          smtp_password: "",
          smtp_use_tls: data.smtp_use_tls ?? true,
          smtp_use_ssl: data.smtp_use_ssl ?? false,
          verification_status: data.verification_status || "not_configured",
          verification_error: data.verification_error,
          last_verified_at: data.last_verified_at,
          has_smtp_password: data.has_smtp_password ?? false,
          is_enabled: data.is_enabled ?? true,
          updated_at: data.updated_at,
        };
        setSettings(loadedSettings);
        setPasswordEdited(false);
        setInitialSnapshot(
          JSON.stringify({
            sender_name: loadedSettings.sender_name || "",
            sender_email: loadedSettings.sender_email || "",
            reply_to_email: loadedSettings.reply_to_email || "",
            provider_type: loadedSettings.provider_type || "smtp",
            smtp_host: loadedSettings.smtp_host || "",
            smtp_port: loadedSettings.smtp_port || 587,
            smtp_user: loadedSettings.smtp_user || "",
            smtp_use_tls: loadedSettings.smtp_use_tls ?? true,
            smtp_use_ssl: loadedSettings.smtp_use_ssl ?? false,
            is_enabled: loadedSettings.is_enabled ?? true,
            has_password_edit: false,
          })
        );
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, [activeSiteId, getAdminToken]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    const current = JSON.stringify({
      sender_name: settings.sender_name || "",
      sender_email: settings.sender_email || "",
      reply_to_email: settings.reply_to_email || "",
      provider_type: settings.provider_type || "smtp",
      smtp_host: settings.smtp_host || "",
      smtp_port: settings.smtp_port || 587,
      smtp_user: settings.smtp_user || "",
      smtp_use_tls: settings.smtp_use_tls ?? true,
      smtp_use_ssl: settings.smtp_use_ssl ?? false,
      is_enabled: settings.is_enabled ?? true,
      has_password_edit: passwordEdited && Boolean(settings.smtp_password),
    });
    return current !== initialSnapshot;
  }, [settings, passwordEdited, initialSnapshot]);

  const handleSecurityProtocolChange = (protocol: "starttls" | "ssl" | "none") => {
    if (protocol === "starttls") {
      setSettings((prev) => ({
        ...prev,
        smtp_port: 587,
        smtp_use_tls: true,
        smtp_use_ssl: false,
      }));
    } else if (protocol === "ssl") {
      setSettings((prev) => ({
        ...prev,
        smtp_port: 465,
        smtp_use_tls: false,
        smtp_use_ssl: true,
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        smtp_port: 25,
        smtp_use_tls: false,
        smtp_use_ssl: false,
      }));
    }
  };

  const currentProtocol: "starttls" | "ssl" | "none" =
    settings.smtp_use_ssl ? "ssl" : settings.smtp_use_tls ? "starttls" : "none";

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSiteId) return;

    setSaving(true);
    const token = getAdminToken();

    const payload: Record<string, any> = {
      sender_name: settings.sender_name?.trim() || null,
      sender_email: settings.sender_email?.trim() || null,
      reply_to_email: settings.reply_to_email?.trim() || null,
      provider_type: settings.provider_type || "smtp",
      smtp_host: settings.smtp_host?.trim() || null,
      smtp_port: Number(settings.smtp_port) || 587,
      smtp_user: settings.smtp_user?.trim() || null,
      smtp_use_tls: settings.smtp_use_tls,
      smtp_use_ssl: settings.smtp_use_ssl,
      is_enabled: settings.is_enabled,
    };

    if (passwordEdited && settings.smtp_password) {
      payload.smtp_password = settings.smtp_password;
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/notifications/admin/${activeSiteId}/email-settings`, {
        method: "PUT",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let resData: any = {};
      try {
        resData = await resp.json();
      } catch {
        resData = {};
      }

      if (resp.ok) {
        showToast("success", "Settings saved successfully.");
        setPasswordEdited(false);
        setSettings((prev) => ({
          ...prev,
          has_smtp_password: Boolean(payload.smtp_password || prev.has_smtp_password),
          smtp_password: "",
        }));
        setInitialSnapshot(
          JSON.stringify({
            sender_name: settings.sender_name || "",
            sender_email: settings.sender_email || "",
            reply_to_email: settings.reply_to_email || "",
            provider_type: settings.provider_type || "smtp",
            smtp_host: settings.smtp_host || "",
            smtp_port: settings.smtp_port || 587,
            smtp_user: settings.smtp_user || "",
            smtp_use_tls: settings.smtp_use_tls ?? true,
            smtp_use_ssl: settings.smtp_use_ssl ?? false,
            is_enabled: settings.is_enabled ?? true,
            has_password_edit: false,
          })
        );
      } else {
        showToast("error", resData.detail || "Failed to save settings.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!activeSiteId || !testRecipient.trim()) return;

    setTesting(true);
    setTestFeedback(null);
    const token = getAdminToken();

    try {
      const resp = await fetch(`${API_BASE_URL}/notifications/admin/${activeSiteId}/email-settings/test`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient_email: testRecipient.trim() }),
      });

      let data: any = {};
      try {
        data = await resp.json();
      } catch {
        data = {};
      }

      if (resp.ok) {
        setTestFeedback({
          success: true,
          message: data.message || `Test email sent to ${testRecipient}.`,
        });
        showToast("success", `Test email sent to ${testRecipient}.`);
        setSettings((prev) => ({ ...prev, verification_status: "verified" }));
      } else {
        setTestFeedback({
          success: false,
          message: data.detail || "Connection failed. Check host, port and password.",
        });
        showToast("error", data.detail || "Connection failed.");
      }
    } catch (err: any) {
      setTestFeedback({ success: false, message: `Error: ${err.message}` });
      showToast("error", err.message || "Test dispatch failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ padding: "0", maxWidth: "100%", color: "#0f172a" }}>
      {/* 1. Top Navbar Header */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            style={{
              borderRadius: "6px",
              padding: "6px 16px",
              border: "none",
              background: "#ffffff",
              color: "#0f172a",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "default",
            }}
          >
            Notifications
          </button>
        </div>

        {/* Right Action Area: Save Settings */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              border: "none",
              background: saving ? "#94a3b8" : (hasUnsavedChanges ? "#2563eb" : "#0f172a"),
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: saving ? "wait" : "pointer",
              boxShadow: hasUnsavedChanges ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
              opacity: saving ? 0.7 : 1,
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Floating GlassToast Feedback */}
      {toast && (
        <GlassToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 2. Main Minimal Form Card */}
      <div style={{ ...plainCardStyle, padding: "20px 22px" }}>
        <form onSubmit={handleSaveSettings}>
          {/* Card Top Title & Master Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "14px",
              marginBottom: "18px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <h2 style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Email & SMTP Setup
            </h2>

            {/* Small Compact Toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>
                Customer Emails:
              </span>
              <div style={{ position: "relative", width: "34px", height: "20px" }}>
                <input
                  type="checkbox"
                  checked={settings.is_enabled ?? true}
                  onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
                />
                <span
                  style={{
                    position: "absolute",
                    cursor: "pointer",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: settings.is_enabled ? "#2563eb" : "#cbd5e1",
                    transition: "background-color 0.15s ease",
                    borderRadius: "20px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: "3px",
                      height: "14px",
                      width: "14px",
                      backgroundColor: "#ffffff",
                      borderRadius: "50%",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                      transform: settings.is_enabled ? "translateX(14px)" : "translateX(0px)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </span>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "48px", color: settings.is_enabled ? "#2563eb" : "#64748b" }}>
                {settings.is_enabled ? "Active" : "Inactive"}
              </span>
            </label>
          </div>

          {/* Sender Identity Section */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "18px" }}>
            <div>
              <label style={labelStyle}>Sender Name</label>
              <input
                type="text"
                placeholder="e.g. My Store"
                value={settings.sender_name || ""}
                onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Sender Email</label>
              <input
                type="email"
                placeholder="e.g. orders@mystore.com"
                value={settings.sender_email || ""}
                onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Reply-To Email</label>
              <input
                type="email"
                placeholder="e.g. support@mystore.com"
                value={settings.reply_to_email || ""}
                onChange={(e) => setSettings({ ...settings, reply_to_email: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* SMTP Host & Port Row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>SMTP Host</label>
              <input
                type="text"
                placeholder="e.g. smtp.sendgrid.net or smtp.gmail.com"
                value={settings.smtp_host || ""}
                onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Port</label>
              <input
                type="number"
                placeholder="587"
                value={settings.smtp_port || 587}
                onChange={(e) => setSettings({ ...settings, smtp_port: Number(e.target.value) })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Security Protocol Radio Switcher */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Security Protocol</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
              {[
                { key: "starttls", label: "STARTTLS (587)" },
                { key: "ssl", label: "Direct SSL (465)" },
                { key: "none", label: "None (25)" },
              ].map((p) => {
                const active = currentProtocol === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSecurityProtocolChange(p.key as any)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: active ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
                      background: active ? "#eff6ff" : "#ffffff",
                      color: active ? "#1d4ed8" : "#475569",
                      fontSize: "12.5px",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Username & Password Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
            <div>
              <label style={labelStyle}>SMTP Username</label>
              <input
                type="text"
                placeholder="Username / API Key"
                value={settings.smtp_user || ""}
                onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                SMTP Password {settings.has_smtp_password && !passwordEdited && "(Saved)"}
              </label>
              <input
                type="password"
                placeholder={settings.has_smtp_password && !passwordEdited ? "••••••••••••" : "Password"}
                value={settings.smtp_password || ""}
                onChange={(e) => {
                  setPasswordEdited(true);
                  setSettings({ ...settings, smtp_password: e.target.value });
                }}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Footer Verification & Actions Bar */}
          <div
            style={{
              paddingTop: "14px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {/* Status */}
            <div style={{ fontSize: "12.5px" }}>
              {settings.verification_status === "verified" ? (
                <span style={{ color: "#16a34a", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <CheckCircleIcon /> Verified
                </span>
              ) : settings.verification_status === "failed" ? (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>
                  ⚠️ Failed ({settings.verification_error || "Check credentials"})
                </span>
              ) : (
                <span style={{ color: "#64748b", fontWeight: 500 }}>
                  Using Default Platform Mailer
                </span>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  setTestRecipient(settings.reply_to_email || settings.sender_email || "");
                  setTestFeedback(null);
                  setIsTestModalOpen(true);
                }}
                style={{
                  ...ghostButtonStyle,
                  padding: "7px 12px",
                  fontSize: "12.5px",
                }}
              >
                Send Test Email
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Test Email Modal */}
      {isTestModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div style={{ ...plainCardStyle, maxWidth: "400px", width: "100%", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#0f172a" }}>Send Test Email</h3>
              <button
                onClick={() => setIsTestModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 0 }}
              >
                <XMarkIcon />
              </button>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Recipient Email</label>
              <input
                type="email"
                placeholder="you@domain.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                style={inputStyle}
              />
            </div>

            {testFeedback && (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "12px",
                  background: testFeedback.success ? "#f0fdf4" : "#fef2f2",
                  border: testFeedback.success ? "1px solid #bbf7d0" : "1px solid #fecaca",
                  color: testFeedback.success ? "#166534" : "#991b1b",
                }}
              >
                {testFeedback.message}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                style={{ ...ghostButtonStyle, padding: "6px 12px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={testing || !testRecipient.trim()}
                onClick={handleSendTestEmail}
                style={{
                  ...primaryButtonStyle,
                  padding: "6px 16px",
                  fontSize: "12px",
                  background: testing || !testRecipient.trim() ? "#94a3b8" : "#2563eb",
                }}
              >
                {testing ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsSettings;
