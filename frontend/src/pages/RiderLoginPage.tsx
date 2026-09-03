import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { usePublicSiteTheme, cleanSiteName } from "../hooks/usePublicSiteTheme";

// Minimal SVG Icons
const DeliveryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export function getRiderStorageKey(siteSlug?: string): { sessionKey: string; tokenKey: string } {
  if (siteSlug && siteSlug.trim()) {
    const clean = siteSlug.trim().toLowerCase();
    return {
      sessionKey: `rider_session_${clean}`,
      tokenKey: `rider_token_${clean}`,
    };
  }
  return {
    sessionKey: "rider_session_global",
    tokenKey: "rider_token_global",
  };
}

export default function RiderLoginPage() {
  const { slug, siteId } = useParams<{ slug?: string; siteId?: string }>();
  const navigate = useNavigate();

  // Load site theme and actual business name
  const { siteData } = usePublicSiteTheme(slug);

  const [storeIdentifier, setStoreIdentifier] = useState(slug || siteId || "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Resolving clean display name for the store
  const storeDisplayName = useMemo(() => {
    if (siteData?.siteName) return siteData.siteName;
    if (siteData?.navbar?.brandName) return siteData.navbar.brandName;
    if (slug) return cleanSiteName("", slug);
    return "Store";
  }, [siteData, slug]);

  useEffect(() => {
    if (slug || siteId) {
      setStoreIdentifier(slug || siteId || "");
    }
  }, [slug, siteId]);

  // If already logged in for this specific store, redirect to dashboard
  useEffect(() => {
    const { sessionKey } = getRiderStorageKey(slug || siteId);
    const existingRider = localStorage.getItem(sessionKey);
    if (existingRider) {
      try {
        const parsed = JSON.parse(existingRider);
        if (parsed?.token) {
          const targetSlug = parsed.agent?.site_slug || slug || siteId;
          navigate(targetSlug ? `/store/${targetSlug}/rider/dashboard` : "/rider/dashboard");
        }
      } catch {
        // ignore
      }
    }
  }, [navigate, slug, siteId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.replace(/\D/g, "");
    if (!storeIdentifier.trim()) {
      setError("Please specify the store identifier or slug.");
      return;
    }
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your rider login PIN.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/rider/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          site_slug_or_id: storeIdentifier.trim(),
          phone: cleanPhone,
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Login failed. Please check your mobile number and PIN.");
      }

      // Save session scoped strictly to this store
      const targetSlug = data.agent?.site_slug || slug || storeIdentifier.trim();
      const { sessionKey, tokenKey } = getRiderStorageKey(targetSlug);
      localStorage.setItem(sessionKey, JSON.stringify(data));
      localStorage.setItem(tokenKey, data.token);

      // Clean up any legacy unscoped keys
      localStorage.removeItem("rider_session");
      localStorage.removeItem("rider_token");

      navigate(targetSlug ? `/store/${targetSlug}/rider/dashboard` : "/rider/dashboard");
    } catch (err: any) {
      setError(err.message || "Unable to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b0f19 0%, #1e293b 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px 16px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Mobile App View Container */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "28px 24px 24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              border: "1px solid #dbeafe",
            }}
          >
            <DeliveryIcon />
          </div>

          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#64748b",
              marginBottom: "4px",
            }}
          >
            Delivery Partner Portal
          </div>

          <h1
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
            }}
          >
            {storeDisplayName}
          </h1>

          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
            Sign in to view and complete your assigned orders
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              lineHeight: 1.4,
            }}
          >
            <AlertCircleIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {!slug && !siteId && (
            <div>
              <label style={labelStyle}>Store Identifier</label>
              <input
                type="text"
                value={storeIdentifier}
                onChange={(e) => setStoreIdentifier(e.target.value)}
                placeholder="e.g. store-name"
                required
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Mobile Number</label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span
                style={{
                  padding: "10px 12px",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRight: "none",
                  borderRadius: "8px 0 0 8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  boxSizing: "border-box",
                }}
              >
                <PhoneIcon />
                <span>+91</span>
              </span>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="8825255108"
                required
                style={{
                  ...inputStyle,
                  borderRadius: "0 8px 8px 0",
                  letterSpacing: "0.05em",
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <label style={{ ...labelStyle, margin: 0 }}>Login PIN</label>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Set by store manager</span>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                maxLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter 4-6 digit PIN"
                required
                style={{
                  ...inputStyle,
                  paddingRight: "38px",
                  letterSpacing: showPassword ? "normal" : "0.2em",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                title={showPassword ? "Hide PIN" : "Show PIN"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || phone.replace(/\D/g, "").length !== 10 || !password.trim()}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              background: "#2563eb",
              border: "none",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              marginTop: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.15s ease",
              opacity: loading || phone.replace(/\D/g, "").length !== 10 || !password.trim() ? 0.7 : 1,
            }}
          >
            <span>{loading ? "Signing in..." : "Sign In to Rider App"}</span>
            {!loading && <ArrowRightIcon />}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
            borderTop: "1px solid #f1f5f9",
            paddingTop: "14px",
            fontSize: "11px",
            color: "#94a3b8",
            fontWeight: 500,
          }}
        >
          Powered by <span style={{ fontWeight: 700, color: "#475569" }}>WebCreon</span>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#334155",
  marginBottom: "5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
  background: "#ffffff",
};
