import React, { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import WebCreonAnimatedLogo from "../Component/WebCreonAnimatedLogo";

export default function AdminSignupPage() {
  const navigate = useNavigate();
  const { refreshAdmin } = useAdminAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (idToken: string) => {
    setGoogleSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id_token: idToken,
          gender: gender || undefined,
          phone: phone || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.detail || "Google authentication failed");
        return;
      }

      await refreshAdmin();
      navigate("/admin/sites", { replace: true });
    } catch (err) {
      console.error("Google signup failed", err);
      setError("Unable to complete Google registration.");
    } finally {
      setGoogleSubmitting(false);
    }
  };

  // Google Identity Services (GIS) integration
  useEffect(() => {
    const rawClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    const hasValidClientId = rawClientId && !rawClientId.includes("exampleclientid");

    if (hasValidClientId) {
      if (!(window as any).google) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          initGoogleGIS(rawClientId);
        };
        document.head.appendChild(script);
      } else {
        initGoogleGIS(rawClientId);
      }
    }
  }, []);

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

        const btnContainer = document.getElementById("google-signup-btn");
        const fallbackBtn = document.getElementById("google-signup-fallback-btn");
        if (btnContainer) {
          (window as any).google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: 340,
            text: "signup_with",
            shape: "rectangular",
          });
          setTimeout(() => {
            if (fallbackBtn && btnContainer.children.length > 0) {
              fallbackBtn.style.display = "none";
            }
          }, 100);
        }
      }
    } catch (e) {
      console.warn("GIS initialization notice:", e);
    }
  };

  const handleDevGoogleSignup = () => {
    const mockEmail = email.trim() || "admin@webcreon.ai";
    const mockName = name.trim() || mockEmail.split("@")[0].toUpperCase();
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: "google_dev_signup_123",
        email: mockEmail,
        name: mockName,
        picture: "https://lh3.googleusercontent.com/a/default-user",
      })
    );
    const mockIdToken = `${header}.${payload}.mock_signature`;
    handleGoogleSuccess(mockIdToken);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          gender: gender || undefined,
          phone: phone.trim() || undefined,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.detail || "Registration failed");
        return;
      }

      await refreshAdmin();
      navigate("/admin/sites", { replace: true });
    } catch (err) {
      console.error("Admin signup failed", err);
      setError("Unable to create account right now. Please try again.");
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
          .wn-signup-split-container {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .wn-signup-left-panel {
            flex: 0 0 auto !important;
            width: 100% !important;
            padding: 24px 16px 12px 16px !important;
            border-right: none !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .wn-signup-right-panel {
            flex: 1 1 auto !important;
            width: 100% !important;
            padding: 24px 20px !important;
          }
        }
      `}</style>

      <div
        className="wn-signup-split-container"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT SIDE HERO */}
        <div
          className="wn-signup-left-panel"
          style={{
            flex: "1 1 55%",
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

        {/* RIGHT SIDE FORM */}
        <div
          className="wn-signup-right-panel"
          style={{
            flex: "1 1 45%",
            maxWidth: "520px",
            minWidth: "320px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px 36px",
            background: "#ffffff",
            boxSizing: "border-box",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "360px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "19px",
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                Create Admin Workspace
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Set up your store owner account with Google or Email
              </p>
            </div>

            {/* GOOGLE SIGNUP BUTTON */}
            <div style={{ marginBottom: "8px", display: "flex", flexDirection: "column" }}>
              <div id="google-signup-btn" style={{ display: "flex", justifyContent: "center" }}></div>
              <button
                id="google-signup-fallback-btn"
                type="button"
                onClick={() => {
                  if ((window as any).google?.accounts?.id) {
                    (window as any).google.accounts.id.prompt();
                  } else {
                    handleDevGoogleSignup();
                  }
                }}
                disabled={googleSubmitting}
                style={{
                  width: "100%",
                  height: "36px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
              >
                <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
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
                {googleSubmitting ? "Signing up..." : "Sign up with Google"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", margin: "6px 0 8px 0", gap: "8px" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>
                OR REGISTRATION FORM
              </span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* ROW 1: NAME & EMAIL */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    style={{
                      height: "35px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@webcreon.com"
                    required
                    style={{
                      height: "35px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* ROW 2: GENDER & PHONE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{
                      height: "35px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      padding: "0 6px",
                      fontSize: "12px",
                      background: "#ffffff",
                      outline: "none",
                      color: "#0f172a",
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      height: "35px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* ROW 3: PASSWORD & CONFIRM PASSWORD */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Password *
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        width: "100%",
                        height: "35px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        padding: "0 30px 0 10px",
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
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Confirm Password *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      height: "35px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
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
                    padding: "6px 10px",
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
                  marginTop: "4px",
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
                {submitting ? "Creating Account..." : "Create Admin Account"}
              </button>
            </form>

            <div
              style={{
                marginTop: "12px",
                paddingTop: "10px",
                borderTop: "1px solid #f1f5f9",
                textAlign: "center",
                fontSize: "11px",
                color: "#64748b",
              }}
            >
              Already have an admin workspace?{" "}
              <Link to="/admin/login" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}