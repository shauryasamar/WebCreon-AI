import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import WebCreonAnimatedLogo from "../Component/WebCreonAnimatedLogo";

type LocationState = {
  from?: string;
};

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;
  const { refreshAdmin } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const redirectTarget = state.from || "/admin/sites";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.detail || "Invalid email or password");
        return;
      }

      await refreshAdmin();
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      console.error("Admin login failed", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        maxHeight: "100vh",
        width: "100vw",
        display: "flex",
        overflow: "hidden",
        background: "#ffffff",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @media (max-width: 860px) {
          .wn-login-split-container {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .wn-login-left-panel {
            flex: 0 0 auto !important;
            width: 100% !important;
            padding: 24px 16px 12px 16px !important;
            border-right: none !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .wn-login-right-panel {
            flex: 1 1 auto !important;
            width: 100% !important;
            padding: 24px 20px !important;
          }
        }
      `}</style>

      <div
        className="wn-login-split-container"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT SIDE (60% WIDTH): ANIMATED WEBNIRMAAN LOGO & STORE */}
        <div
          className="wn-login-left-panel"
          style={{
            flex: "1 1 58%",
            background: "#f8fafc",
            backgroundImage: `
              radial-gradient(at 50% 0%, rgba(37, 99, 235, 0.04) 0px, transparent 50%),
              radial-gradient(at 100% 100%, rgba(249, 128, 18, 0.03) 0px, transparent 50%)
            `,
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          <div style={{ width: "100%", maxWidth: "420px" }}>
            <WebCreonAnimatedLogo showText={true} />
          </div>
        </div>

        {/* RIGHT SIDE (40% WIDTH): CLEAN ELEGANT LOGIN FORM */}
        <div
          className="wn-login-right-panel"
          style={{
            flex: "1 1 42%",
            maxWidth: "480px",
            minWidth: "320px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "32px 40px",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "340px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* BRAND TITLE BADGE REMOVED AS REQUESTED */}

            <div style={{ marginBottom: "20px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                Sign In
              </h2>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label
                  htmlFor="admin-login-email"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Email Address
                </label>
                <input
                  id="admin-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@webcreon.com"
                  autoComplete="email"
                  required
                  style={{
                    width: "100%",
                    height: "40px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    padding: "0 12px",
                    fontSize: "13px",
                    color: "#0f172a",
                    background: "#ffffff",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#2563eb";
                    e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.12)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label
                  htmlFor="admin-login-password"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Password
                </label>
                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    id="admin-login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    style={{
                      width: "100%",
                      height: "40px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      padding: "0 36px 0 12px",
                      fontSize: "13px",
                      color: "#0f172a",
                      background: "#ffffff",
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#2563eb";
                      e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.12)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#cbd5e1";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  style={{
                    borderRadius: "8px",
                    padding: "8px 10px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    fontSize: "12px",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "currentColor", strokeWidth: 2, fill: "none", flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: "6px",
                  height: "42px",
                  borderRadius: "8px",
                  border: "none",
                  background: submitting ? "#93c5fd" : "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: submitting ? "none" : "0 2px 4px rgba(37, 99, 235, 0.2)",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!submitting) e.currentTarget.style.background = "#1d4ed8";
                }}
                onMouseLeave={(e) => {
                  if (!submitting) e.currentTarget.style.background = "#2563eb";
                }}
              >
                {submitting ? "Signing in..." : "Sign In to Admin"}
              </button>
            </form>

            <div
              style={{
                marginTop: "20px",
                paddingTop: "14px",
                borderTop: "1px solid #f1f5f9",
                textAlign: "center",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Need an admin workspace?{" "}
              <Link
                to="/admin/signup"
                style={{
                  color: "#2563eb",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}