import React, { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import WebCreonAnimatedLogo from "../Component/WebCreonAnimatedLogo";
import { GlassToast } from "../Component/GlassToast";

export default function AdminAcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { refreshAdmin } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invitation token is missing. Please check your invitation link.");
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users-roles/invitation/${token}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.detail || "Invalid or expired invitation link");
        }
        setInvitationData(data);
      } catch (err: any) {
        setError(err.message || "Failed to verify invitation");
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password) {
      setToast({ message: "Password is required", type: "error" });
      return;
    }
    if (password !== confirmPassword) {
      setToast({ message: "Passwords do not match", type: "error" });
      return;
    }
    if (password.length < 8) {
      setToast({ message: "Password must be at least 8 characters long", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users-roles/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to set up account");
      }

      const authedUser = await refreshAdmin();
      setToast({ message: "Account created! Redirecting to Webcreon...", type: "success" });
      setTimeout(() => {
        const sites = data?.sites || [];
        if (authedUser && !authedUser.isOwner && sites.length > 0) {
          navigate(`/builder/${sites[0].id}`, { replace: true });
        } else {
          navigate("/admin/sites", { replace: true });
        }
      }, 1000);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to set password", type: "error" });
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
          .wn-invite-split-container {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .wn-invite-left-panel {
            flex: 0 0 auto !important;
            width: 100% !important;
            padding: 24px 16px 12px 16px !important;
            border-right: none !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .wn-invite-right-panel {
            flex: 1 1 auto !important;
            width: 100% !important;
            padding: 24px 20px !important;
          }
        }
      `}</style>

      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div
        className="wn-invite-split-container"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT SIDE: BRAND ANIMATED HERO */}
        <div
          className="wn-invite-left-panel"
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

        {/* RIGHT SIDE: INVITATION ACCEPT FORM */}
        <div
          className="wn-invite-right-panel"
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
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    border: "3px solid #e2e8f0",
                    borderTopColor: "#2563eb",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 12px auto",
                  }}
                />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  Verifying workspace invitation...
                </div>
              </div>
            ) : error || !invitationData ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#fef2f2",
                    color: "#ef4444",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 14px",
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  ✕
                </div>
                <h2 style={{ margin: "0 0 6px 0", fontSize: "19px", fontWeight: 700, color: "#0f172a" }}>
                  Invitation Invalid
                </h2>
                <p style={{ margin: "0 0 20px 0", fontSize: "12.5px", color: "#64748b", lineHeight: 1.5 }}>
                  {error || "This invitation link is invalid or has expired."}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  style={{
                    width: "100%",
                    height: "40px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "18px" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "#0f172a",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Accept Invitation
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    Create your password to join the workspace
                  </p>
                </div>

                {/* USER & ROLE BADGE */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    marginBottom: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                      {invitationData.name}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: "#eff6ff",
                        color: "#2563eb",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      {invitationData.role}
                    </span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                    {invitationData.email}
                  </div>
                </div>

                {/* PASSWORD SETUP FORM */}
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <label
                      htmlFor="invite-password"
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#334155",
                      }}
                    >
                      Create Password
                    </label>
                    <div style={{ position: "relative", width: "100%" }}>
                      <input
                        id="invite-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
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
                        }}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <label
                      htmlFor="invite-confirm-password"
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#334155",
                      }}
                    >
                      Confirm Password
                    </label>
                    <div style={{ position: "relative", width: "100%" }}>
                      <input
                        id="invite-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
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
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
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
                        }}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: "100%",
                      height: "40px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: submitting ? "not-allowed" : "pointer",
                      marginTop: "6px",
                      opacity: submitting ? 0.75 : 1,
                      boxShadow: "0 2px 8px rgba(37, 99, 235, 0.2)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {submitting ? "Activating Account..." : "Join Workspace"}
                  </button>
                </form>

                <div
                  style={{
                    marginTop: "20px",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Already accepted?{" "}
                  <Link
                    to="/admin/login"
                    style={{
                      color: "#2563eb",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
