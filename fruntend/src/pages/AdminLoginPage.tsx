import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";

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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        backgroundImage: `
          radial-gradient(at 50% 0%, rgba(37, 99, 235, 0.05) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(15, 23, 42, 0.03) 0px, transparent 50%)
        `,
        padding: "16px",
        boxSizing: "border-box",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* BIG CAPITAL BRAND HEADER */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "999px",
              background: "#eff6ff",
              border: "1px solid #dbeafe",
              color: "#2563eb",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              style={{ width: "12px", height: "12px", fill: "currentColor" }}
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            Admin Console
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: "26px",
              fontWeight: 900,
              letterSpacing: "0.08em",
              color: "#0f172a",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            WEBNIRMAAN AI
          </h1>
        </div>

        {/* ELEGANT FORM CARD */}
        <div
          style={{
            width: "100%",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.05)",
            padding: "24px 28px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "#0f172a",
                letterSpacing: "-0.01em",
              }}
            >
              Sign In
            </h2>
            <p
              style={{
                margin: "3px 0 0 0",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Enter your credentials to access your store builder.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label
                htmlFor="admin-email-input"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#334155",
                  letterSpacing: "0.01em",
                }}
              >
                Email Address
              </label>
              <input
                id="admin-email-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@webnirmaan.com"
                autoComplete="email"
                required
                style={{
                  width: "100%",
                  height: "38px",
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

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label
                htmlFor="admin-password-input"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#334155",
                  letterSpacing: "0.01em",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  id="admin-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{
                    width: "100%",
                    height: "38px",
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
                    <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
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
                marginTop: "4px",
                height: "40px",
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
              marginTop: "16px",
              paddingTop: "12px",
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
  );
}