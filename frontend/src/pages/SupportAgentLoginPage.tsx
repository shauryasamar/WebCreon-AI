import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { usePublicSiteTheme, cleanSiteName } from "../hooks/usePublicSiteTheme";

export const SupportAgentLoginPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { siteData } = usePublicSiteTheme(slug);
  const brandName = siteData?.siteName || cleanSiteName("", slug);
  const isDark = siteData?.theme?.mode === "dark";
  const accentColor = siteData?.theme?.accent_color || "#2563eb";
  const primaryBg = siteData?.theme?.primary_bg;
  const textColor = siteData?.theme?.text_color;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/support/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
          site_slug: slug || undefined,
          site_id: siteData?.id || siteData?.site_id || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Login failed. Check your email and password.");
      }

      // Save agent session
      if (typeof window !== "undefined") {
        localStorage.setItem("support_agent_session", JSON.stringify(data.agent));
        if (data.token) {
          localStorage.setItem("support_agent_token", data.token);
        }
      }

      // Navigate to Support Dashboard
      if (slug) {
        navigate(`/store/${slug}/support/dashboard`, { replace: true });
      } else {
        navigate("/support/dashboard", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: isDark ? "#090d16" : "#f1f5f9",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: isDark ? "#131b2e" : "#ffffff",
          borderRadius: "20px",
          padding: "32px 28px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: `${accentColor || "#2563eb"}15`,
              color: accentColor || "#2563eb",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 12px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 800, color: isDark ? "#ffffff" : "#0f172a" }}>
            Support Staff Login
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b" }}>
            {brandName} Grievance & Customer Help Desk
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#334155", marginBottom: "4px" }}>
              Staff Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@yourbrand.com"
              style={{
                width: "100%",
                height: "40px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: isDark ? "#1e293b" : "#f8fafc",
                color: isDark ? "#ffffff" : "#0f172a",
                fontSize: "13.5px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#334155", marginBottom: "4px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "0 38px 0 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: isDark ? "#1e293b" : "#f8fafc",
                  color: isDark ? "#ffffff" : "#0f172a",
                  fontSize: "13.5px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              height: "42px",
              borderRadius: "10px",
              border: "none",
              background: accentColor || "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Log In to Help Desk"}
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
          Protected Customer Support Portal · WebCreon AI
        </div>
      </div>
    </div>
  );
};

export default SupportAgentLoginPage;
