import React, { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminTheme } from "../context/ThemeContext";
import WebCreonAnimatedLogo from "../Component/WebCreonAnimatedLogo";
import AdminThemeToggle from "../Component/AdminThemeToggle";

type LocationState = {
  from?: string;
};

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;
  const redirectTarget = state.from || "/admin/sites";
  const { refreshAdmin } = useAdminAuth();
  const { isDark, tokens } = useAdminTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  const handleGoogleSuccess = async (idToken: string) => {
    setGoogleSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_token: idToken }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.detail || "Google authentication failed");
        return;
      }

      const authedUser = await refreshAdmin();
      const isOwnerUser = authedUser?.isOwner ?? (data?.admin?.isOwner ?? true);

      const userSites = data?.sites || [];
      const isValidTarget = userSites.some((s: any) => s.id && redirectTarget.includes(s.id));

      if (!isOwnerUser && userSites.length > 0) {
        if (isValidTarget && redirectTarget.startsWith("/builder/")) {
          navigate(redirectTarget, { replace: true });
        } else {
          navigate(`/builder/${userSites[0].id}`, { replace: true });
        }
      } else if (userSites.length === 0 || !isValidTarget) {
        navigate("/admin/sites", { replace: true });
      } else {
        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      console.error("Google login failed", err);
      setError("Unable to complete Google authentication.");
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const initGoogleGIS = (clientId: string) => {
    try {
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response.credential) {
              handleGoogleSuccess(response.credential);
            }
          },
        });
      }
    } catch (e) {
      console.warn("GIS initialization notice:", e);
    }
  };

  // Google Identity Services (GIS) integration
  useEffect(() => {
    const rawClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    const hasValidClientId = rawClientId && !rawClientId.includes("exampleclientid");

    if (hasValidClientId) {
      if (!(window as any).google?.accounts?.id) {
        const existingScript = document.getElementById("google-gsi-client-script");
        if (!existingScript) {
          const script = document.createElement("script");
          script.id = "google-gsi-client-script";
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.defer = true;
          script.onload = () => {
            initGoogleGIS(rawClientId);
          };
          document.head.appendChild(script);
        } else {
          existingScript.addEventListener("load", () => initGoogleGIS(rawClientId));
        }
      } else {
        initGoogleGIS(rawClientId);
      }
    }
  }, []);

  const handleDevGoogleLogin = () => {
    // Simulated token for instant local development testing when Client ID is unconfigured
    const mockEmail = email.trim() || "admin@webcreon.ai";
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: "google_dev_12345",
        email: mockEmail,
        name: mockEmail.split("@")[0].toUpperCase(),
        picture: "https://lh3.googleusercontent.com/a/default-user",
      })
    );
    const mockIdToken = `${header}.${payload}.mock_signature`;
    handleGoogleSuccess(mockIdToken);
  };

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

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.detail || "Invalid email or password");
        return;
      }

      const authedUser = await refreshAdmin();
      const isOwnerUser = authedUser?.isOwner ?? (data?.admin?.isOwner ?? true);

      const userSites = data?.sites || [];
      const isValidTarget = userSites.some((s: any) => s.id && redirectTarget.includes(s.id));

      if (!isOwnerUser && userSites.length > 0) {
        if (isValidTarget && redirectTarget.startsWith("/builder/")) {
          navigate(redirectTarget, { replace: true });
        } else {
          navigate(`/builder/${userSites[0].id}`, { replace: true });
        }
      } else if (userSites.length === 0 || !isValidTarget) {
        navigate("/admin/sites", { replace: true });
      } else {
        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      console.error("Admin login failed", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotSubmitting(true);
    setForgotError("");
    setForgotMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setForgotError(data?.detail || "Failed to process request.");
        return;
      }

      setForgotMessage(data?.message || "Password reset instructions dispatched!");
    } catch (err) {
      console.error("Forgot password error", err);
      setForgotError("Unable to connect to server.");
    } finally {
      setForgotSubmitting(false);
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
        background: tokens.workspaceBg,
        color: tokens.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
      }}
    >
      <AdminThemeToggle style={{ position: "fixed", top: "16px", right: "16px", zIndex: 100 }} />
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
            border-bottom: 1px solid ${tokens.border} !important;
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
        {/* LEFT SIDE: BRAND ANIMATED HERO */}
        <div
          className="wn-login-left-panel"
          style={{
            flex: "1 1 58%",
            background: tokens.elevatedSurfaceBg,
            backgroundImage: isDark
              ? `radial-gradient(at 50% 0%, rgba(59, 130, 246, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(249, 115, 22, 0.05) 0px, transparent 50%)`
              : `radial-gradient(at 50% 0%, rgba(37, 99, 235, 0.04) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(249, 128, 18, 0.03) 0px, transparent 50%)`,
            borderRight: `1px solid ${tokens.border}`,
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

        {/* RIGHT SIDE: ADMIN LOGIN & GOOGLE OAUTH FORM */}
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
            background: tokens.surfaceBg,
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
            <div style={{ marginBottom: "20px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 700,
                  color: tokens.textPrimary,
                  letterSpacing: "-0.01em",
                }}
              >
                Sign In to Admin
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: tokens.textSecondary }}>
                Enter your credentials or use Google Identity
              </p>
            </div>

            {/* GOOGLE SIGN-IN BUTTON */}
            <div style={{ marginBottom: "16px" }}>
              <button
                id="google-signin-btn"
                type="button"
                onClick={() => {
                  if ((window as any).google?.accounts?.id) {
                    (window as any).google.accounts.id.prompt();
                  } else {
                    handleDevGoogleLogin();
                  }
                }}
                disabled={googleSubmitting}
                style={{
                  width: "100%",
                  height: "42px",
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
                  background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                  color: tokens.textPrimary,
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  cursor: googleSubmitting ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  if (!googleSubmitting) {
                    e.currentTarget.style.background = isDark ? tokens.hoverBg : "#f8fafc";
                    e.currentTarget.style.borderColor = tokens.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!googleSubmitting) {
                    e.currentTarget.style.background = isDark ? tokens.elevatedSurfaceBg : "#ffffff";
                    e.currentTarget.style.borderColor = tokens.border;
                  }
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: "18px", height: "18px", flexShrink: 0 }}>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{googleSubmitting ? "Authenticating with Google..." : "Sign in with Google"}</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", margin: "12px 0 16px 0", gap: "10px" }}>
              <div style={{ flex: 1, height: "1px", background: tokens.border }}></div>
              <span style={{ fontSize: "11px", fontWeight: 600, color: tokens.textMuted, textTransform: "uppercase" }}>
                OR EMAIL
              </span>
              <div style={{ flex: 1, height: "1px", background: tokens.border }}></div>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label
                  htmlFor="admin-login-email"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: tokens.textSecondary,
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
                    border: `1px solid ${tokens.border}`,
                    padding: "0 12px",
                    fontSize: "13px",
                    color: tokens.textPrimary,
                    background: tokens.elevatedSurfaceBg,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label
                    htmlFor="admin-login-password"
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: tokens.textSecondary,
                    }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: tokens.accent,
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
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
                      border: `1px solid ${tokens.border}`,
                      padding: "0 36px 0 12px",
                      fontSize: "13px",
                      color: tokens.textPrimary,
                      background: tokens.elevatedSurfaceBg,
                      outline: "none",
                      boxSizing: "border-box",
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
                      color: tokens.textMuted,
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    borderRadius: "8px",
                    padding: "8px 10px",
                    background: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                    border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.35)" : "#fecaca"}`,
                    color: isDark ? "#fca5a5" : "#991b1b",
                    fontSize: "12px",
                    fontWeight: 500,
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
                  height: "42px",
                  borderRadius: "8px",
                  border: "none",
                  background: submitting ? (isDark ? "#3b82f6aa" : "#93c5fd") : tokens.accent,
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 3px rgba(37,99,235,0.2)",
                  transition: "background 0.15s ease",
                }}
              >
                {submitting ? "Signing in..." : "Sign In to Admin"}
              </button>
            </form>

            <div
              style={{
                marginTop: "20px",
                paddingTop: "14px",
                borderTop: `1px solid ${tokens.border}`,
                textAlign: "center",
                fontSize: "12px",
                color: tokens.textSecondary,
              }}
            >
              Need an admin workspace?{" "}
              <Link
                to="/admin/signup"
                style={{
                  color: tokens.accent,
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

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: isDark ? "rgba(0, 0, 0, 0.75)" : "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              background: tokens.surfaceBg,
              borderRadius: "16px",
              padding: "28px 24px",
              boxShadow: tokens.shadow,
              border: `1px solid ${tokens.border}`,
              boxSizing: "border-box",
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotMessage("");
                setForgotError("");
              }}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
                color: tokens.textMuted,
              }}
            >
              ✕
            </button>

            <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: 700, color: tokens.textPrimary }}>
              Forgot Password
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: tokens.textSecondary }}>
              Enter your registered admin email address and we'll send you a password reset link and 6-digit OTP code.
            </p>

            {forgotMessage ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: isDark ? "rgba(16, 185, 129, 0.15)" : "#f0fdf4",
                    border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.35)" : "#bbf7d0"}`,
                    color: isDark ? "#86efac" : "#166534",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  {forgotMessage}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/reset-password?email=${encodeURIComponent(forgotEmail)}`)}
                  style={{
                    height: "40px",
                    borderRadius: "8px",
                    border: "none",
                    background: tokens.accent,
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Proceed to Password Reset Page
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: tokens.textSecondary }}>
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@webcreon.com"
                    required
                    style={{
                      height: "40px",
                      borderRadius: "8px",
                      border: `1px solid ${tokens.border}`,
                      padding: "0 12px",
                      fontSize: "13px",
                      color: tokens.textPrimary,
                      background: tokens.elevatedSurfaceBg,
                      outline: "none",
                    }}
                  />
                </div>

                {forgotError && (
                  <div
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      background: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                      border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.35)" : "#fecaca"}`,
                      color: isDark ? "#fca5a5" : "#991b1b",
                      fontSize: "12px",
                    }}
                  >
                    {forgotError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  style={{
                    height: "40px",
                    borderRadius: "8px",
                    border: "none",
                    background: forgotSubmitting ? (isDark ? "#3b82f6aa" : "#93c5fd") : tokens.accent,
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: forgotSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {forgotSubmitting ? "Sending Reset Email..." : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}