import React, { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import WebCreonAnimatedLogo from "../Component/WebCreonAnimatedLogo";

export default function AdminResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialEmail = searchParams.get("email") || "";
  const initialToken = searchParams.get("token") || "";

  const [email, setEmail] = useState(initialEmail);
  const [tokenOrOtp, setTokenOrOtp] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
    if (initialToken) setTokenOrOtp(initialToken);
  }, [initialEmail, initialToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email.trim() || !tokenOrOtp.trim() || !newPassword.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          token_or_otp: tokenOrOtp.trim(),
          new_password: newPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.detail || "Failed to reset password. Please check your token or request a new one.");
        return;
      }

      setSuccessMessage("Your password has been successfully reset! Redirecting to login...");
      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 2200);
    } catch (err) {
      console.error("Reset password error:", err);
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
          .wn-reset-split-container {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .wn-reset-left-panel {
            flex: 0 0 auto !important;
            width: 100% !important;
            padding: 24px 16px 12px 16px !important;
            border-right: none !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .wn-reset-right-panel {
            flex: 1 1 auto !important;
            width: 100% !important;
            padding: 24px 20px !important;
          }
        }
      `}</style>

      <div
        className="wn-reset-split-container"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT SIDE HERO PANEL */}
        <div
          className="wn-reset-left-panel"
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

        {/* RIGHT SIDE FORM PANEL */}
        <div
          className="wn-reset-right-panel"
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
            <div style={{ marginBottom: "16px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                Reset Password
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Set a new password for your WebCreon AI admin workspace
              </p>
            </div>

            {successMessage ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "8px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    fontSize: "13px",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {successMessage}
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  style={{
                    height: "40px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@webcreon.com"
                    required
                    style={{
                      height: "36px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Reset Token or 6-Digit OTP
                  </label>
                  <input
                    type="text"
                    value={tokenOrOtp}
                    onChange={(e) => setTokenOrOtp(e.target.value)}
                    placeholder="Paste token or enter 6-digit code"
                    required
                    style={{
                      height: "36px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                      New Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        style={{
                          width: "100%",
                          height: "36px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          padding: "0 28px 0 8px",
                          fontSize: "12px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: "6px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#64748b",
                          fontSize: "10px",
                          cursor: "pointer",
                        }}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        height: "36px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        padding: "0 8px",
                        fontSize: "12px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      borderRadius: "6px",
                      padding: "6px 8px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                      fontSize: "11px",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: "6px",
                    height: "38px",
                    borderRadius: "6px",
                    border: "none",
                    background: submitting ? "#93c5fd" : "#2563eb",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            )}

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
              Remembered your password?{" "}
              <Link to="/admin/login" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
