import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import {
  cleanSiteName,
  getAccessibleAccentColor,
  getContrastTextColor,
  getLuminance,
  usePublicSiteTheme,
} from "../hooks/usePublicSiteTheme";

type LocationState = {
  from?: string;
};

export default function CustomerLoginPage({
  siteSlug: propSiteSlug,
  siteName: propSiteName,
  theme: propTheme,
}: {
  siteSlug?: string;
  siteName?: string;
  theme?: any;
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { slug, siteId } = useParams<{ slug?: string; siteId?: string }>();
  const targetSlug = propSiteSlug || slug || siteId || "";
  const { login, loginWithGoogle, forgotPassword, resetPassword, loading: authLoading } =
    useCustomerAuth();
  const { siteData } = usePublicSiteTheme(targetSlug);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [inputFocused, setInputFocused] = useState<string | null>(null);

  // Responsive viewport hook
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 640;
  const isShortScreen = windowHeight <= 680;

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const websiteName = propSiteSlug || slug || siteId || "";
  const from = (location.state as LocationState | null)?.from;

  const storeBase = useMemo(
    () => (websiteName ? `/store/${websiteName}` : "/"),
    [websiteName]
  );

  const safeRedirect = useMemo(() => {
    if (from && from.trim() && from.startsWith(storeBase)) {
      return from;
    }
    return storeBase;
  }, [from, storeBase]);

  // Auto-trigger forgot password reset if linked via email
  useEffect(() => {
    const urlEmail = searchParams.get("reset_email");
    const urlToken = searchParams.get("token");
    if (urlEmail || urlToken) {
      if (urlEmail) setForgotEmail(urlEmail);
      if (urlToken) setResetOtp(urlToken);
      setForgotStep("reset");
      setShowForgotModal(true);
    }
  }, [searchParams]);

  // Google Identity Services (GIS)
  useEffect(() => {
    const clientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      "938163819749-placeholder.apps.googleusercontent.com";

    const loadGis = () => {
      if ((window as any).google?.accounts?.id) {
        initGoogleGIS(clientId);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleGIS(clientId);
      document.head.appendChild(script);
    };

    loadGis();
  }, [websiteName]);

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

        const btnContainer = document.getElementById("customer-google-signin-btn");
        const fallbackBtn = document.getElementById("customer-google-fallback-btn");
        if (btnContainer) {
          (window as any).google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: isMobile ? 320 : 380,
            text: "continue_with",
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
      console.warn("GIS notice:", e);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setGoogleSubmitting(true);
    setError("");
    try {
      await loginWithGoogle(websiteName, idToken);
      navigate(safeRedirect, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleDevGoogleLogin = () => {
    const mockEmail = email.trim() || `customer@${websiteName || "store"}.com`;
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: `google_cust_${Date.now()}`,
        email: mockEmail,
        name: mockEmail.split("@")[0].toUpperCase(),
        picture: "https://lh3.googleusercontent.com/a/default-user",
      })
    );
    const mockIdToken = `${header}.${payload}.mock_signature`;
    handleGoogleSuccess(mockIdToken);
  };

  // Exact theme definitions inherited from site theme
  const siteName = propSiteName || siteData?.siteName || cleanSiteName("", websiteName);
  const theme = propTheme || siteData?.theme || {};
  const isLight = theme.mode !== "dark";

  const primaryBg = theme.primary_bg || (isLight ? "#f8fafc" : "#0f172a");
  const baseCardBg = theme.card_bg || theme.secondary_bg || (isLight ? "#ffffff" : "#1e293b");
  const cardBg =
    baseCardBg.toLowerCase().trim() === primaryBg.toLowerCase().trim()
      ? isLight
        ? "#ffffff"
        : "#1e293b"
      : baseCardBg;

  const computedContrastText = getContrastTextColor(cardBg);
  const rawThemeTextColor = theme.text_color;
  const isDarkCard = computedContrastText === "#ffffff";

  const textColor =
    rawThemeTextColor && Math.abs(getLuminance(rawThemeTextColor) - getLuminance(cardBg)) > 45
      ? rawThemeTextColor
      : computedContrastText;

  const subtextColor = isDarkCard ? "rgba(226, 232, 240, 0.78)" : "rgba(51, 65, 85, 0.78)";
  const accentColor = theme.accent_color || "#2563eb";
  const accessibleAccentColor = getAccessibleAccentColor(accentColor, cardBg);
  const buttonTextColor = getContrastTextColor(accentColor);
  const borderColor = isDarkCard ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.12)";

  const inputBg = isDarkCard ? "#0f172a" : "#ffffff";
  const inputTextColor = isDarkCard ? "#f8fafc" : "#0f172a";
  const inputBorder = isDarkCard ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.2)";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      await login(websiteName, {
        email: email.trim(),
        password,
      });
      navigate(safeRedirect, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid email or password.");
    }
  };

  const handleContinueAsGuest = () => {
    navigate(safeRedirect, { replace: true });
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (!forgotEmail.trim()) {
      setForgotError("Please enter your email address.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await forgotPassword(websiteName, forgotEmail.trim());
      setForgotSuccess(res.message || "Verification code sent to your email.");
      setResendCooldown(30);
      setForgotStep("reset");
    } catch (err: any) {
      setForgotError(err?.message || "Failed to send verification code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || forgotLoading) return;
    setForgotError("");
    setForgotSuccess("");
    setForgotLoading(true);

    try {
      const res = await forgotPassword(websiteName, forgotEmail.trim());
      setForgotSuccess(res.message || "New verification code dispatched.");
      setResendCooldown(30);
    } catch (err: any) {
      setForgotError(err?.message || "Failed to resend verification code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    if (!resetOtp.trim()) {
      setForgotError("Please enter the 6-digit verification code.");
      return;
    }
    if (!newPassword.trim()) {
      setForgotError("Please enter a new password.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    setForgotLoading(true);
    try {
      await resetPassword(websiteName, {
        email: forgotEmail.trim(),
        otp: resetOtp.trim(),
        new_password: newPassword,
      });
      setForgotSuccess("Password updated! Redirecting...");
      setTimeout(() => {
        setShowForgotModal(false);
        navigate(safeRedirect, { replace: true });
      }, 1000);
    } catch (err: any) {
      setForgotError(err?.message || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 80px)",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "24px 14px" : "48px 24px",
        background: primaryBg,
        color: textColor,
        boxSizing: "border-box",
        transition: "background-color 0.25s ease, color 0.25s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: isMobile ? "380px" : "450px",
          margin: "auto",
          background: cardBg,
          color: textColor,
          borderRadius: isMobile ? "18px" : "24px",
          padding: isMobile
            ? isShortScreen ? "18px 18px" : "24px 20px"
            : "36px 36px 28px 36px",
          border: `1px solid ${borderColor}`,
          boxShadow: isLight
            ? "0 16px 40px rgba(15, 23, 42, 0.08)"
            : "0 20px 48px rgba(0, 0, 0, 0.40)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? (isShortScreen ? "10px" : "14px") : "18px",
          transition: "all 0.2s ease",
        }}
      >
        {/* BACK TO STORE LINK */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate(storeBase || "/")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: subtextColor,
              fontSize: "12px",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: 0,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = subtextColor)}
          >
            ← Back to store
          </button>
        </div>

        {/* BRAND NAME HEADING & CLEAN SIGN IN HEADER */}
        <div style={{ textAlign: "center", marginBottom: isMobile ? "2px" : "4px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? "22px" : "26px",
              fontWeight: 800,
              color: textColor,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {siteName}
          </h1>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: isMobile ? "13px" : "14px",
              fontWeight: 500,
              color: subtextColor,
            }}
          >
            Sign in to your account
          </p>
        </div>

        {/* 1-CLICK GOOGLE SIGN IN */}
        <div>
          <div
            id="customer-google-signin-btn"
            style={{ display: "flex", justifyContent: "center", width: "100%" }}
          ></div>
          <button
            id="customer-google-fallback-btn"
            type="button"
            onClick={() => {
              if ((window as any).google?.accounts?.id) {
                (window as any).google.accounts.id.prompt();
              } else {
                handleDevGoogleLogin();
              }
            }}
            disabled={googleSubmitting || authLoading}
            style={{
              width: "100%",
              height: isMobile ? "38px" : "44px",
              background: isDarkCard ? "#0f172a" : "#ffffff",
              border: `1px solid ${borderColor}`,
              borderRadius: isMobile ? "9px" : "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: isMobile ? "13px" : "14px",
              color: textColor,
              transition: "all 0.15s ease",
            }}
          >
            <svg width={isMobile ? 16 : 18} height={isMobile ? 16 : 18} viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{googleSubmitting ? "Connecting..." : "Continue with Google"}</span>
          </button>
        </div>

        {/* DIVIDER */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, height: "1px", background: borderColor }}></div>
          <span style={{ fontSize: isMobile ? "10.5px" : "11.5px", fontWeight: 600, color: subtextColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            or with email
          </span>
          <div style={{ flex: 1, height: "1px", background: borderColor }}></div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: isMobile ? "10px" : "14px" }}>
          <div>
            <label
              htmlFor="customer-email"
              style={{ display: "block", marginBottom: isMobile ? "3px" : "5px", fontSize: isMobile ? "11.5px" : "13px", fontWeight: 600, color: textColor }}
            >
              Email Address
            </label>
            <input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setInputFocused("email")}
              onBlur={() => setInputFocused(null)}
              autoComplete="email"
              placeholder="name@example.com"
              style={{
                width: "100%",
                height: isMobile ? "36px" : "42px",
                boxSizing: "border-box",
                padding: isMobile ? "0 10px" : "0 14px",
                borderRadius: isMobile ? "8px" : "10px",
                border: `1px solid ${inputFocused === "email" ? accentColor : inputBorder}`,
                background: inputBg,
                color: inputTextColor,
                outline: "none",
                fontSize: isMobile ? "13px" : "14px",
                boxShadow: inputFocused === "email" ? `0 0 0 3px ${accentColor}25` : "none",
                transition: "all 0.15s ease",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? "3px" : "5px" }}>
              <label
                htmlFor="customer-password"
                style={{ fontSize: isMobile ? "11.5px" : "13px", fontWeight: 600, color: textColor }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotStep("request");
                  setForgotError("");
                  setForgotSuccess("");
                  setShowForgotModal(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: isMobile ? "11px" : "12.5px",
                  fontWeight: 600,
                  color: accessibleAccentColor,
                  cursor: "pointer",
                }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="customer-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setInputFocused("password")}
                onBlur={() => setInputFocused(null)}
                autoComplete="current-password"
                placeholder="Enter password"
                style={{
                  width: "100%",
                  height: isMobile ? "36px" : "42px",
                  boxSizing: "border-box",
                  padding: isMobile ? "0 40px 0 10px" : "0 44px 0 14px",
                  borderRadius: isMobile ? "8px" : "10px",
                  border: `1px solid ${inputFocused === "password" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: isMobile ? "13px" : "14px",
                  boxShadow: inputFocused === "password" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
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
                  padding: "4px",
                  fontSize: isMobile ? "11.5px" : "12.5px",
                  fontWeight: 600,
                  color: subtextColor,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                fontSize: "12.5px",
                lineHeight: 1.35,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px", marginTop: "4px" }}>
            <button
              type="submit"
              disabled={authLoading || googleSubmitting}
              style={{
                height: isMobile ? "38px" : "44px",
                borderRadius: isMobile ? "9px" : "11px",
                border: "none",
                background: accentColor,
                color: buttonTextColor,
                fontSize: isMobile ? "13px" : "14px",
                fontWeight: 700,
                cursor: authLoading || googleSubmitting ? "not-allowed" : "pointer",
                opacity: authLoading || googleSubmitting ? 0.75 : 1,
                boxShadow: `0 3px 12px ${accentColor}35`,
                transition: "all 0.15s ease",
              }}
            >
              {authLoading ? "Signing in..." : "Sign In"}
            </button>

            <button
              type="button"
              onClick={handleContinueAsGuest}
              style={{
                height: isMobile ? "38px" : "44px",
                borderRadius: isMobile ? "9px" : "11px",
                border: `1px solid ${borderColor}`,
                background: "transparent",
                color: textColor,
                fontSize: isMobile ? "13px" : "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Guest Access
            </button>
          </div>
        </form>

        {/* SWITCH TO SIGN UP & BADGE */}
        <div style={{ textAlign: "center", paddingTop: "2px" }}>
          <p style={{ margin: 0, fontSize: isMobile ? "12.5px" : "13.5px", color: subtextColor }}>
            New customer?{" "}
            <Link
              to={websiteName ? `/store/${websiteName}/signup` : "/"}
              style={{
                color: accessibleAccentColor,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Create an account
            </Link>
          </p>

          <div style={{ marginTop: isMobile ? "8px" : "12px", display: "flex", justifyContent: "center" }}>
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                textDecoration: "none",
                fontSize: "11.5px",
                color: subtextColor,
                opacity: 0.85,
              }}
            >
              <span>Powered by</span>
              <span
                style={{
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                WebCreon AI
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              background: cardBg,
              color: textColor,
              borderRadius: "20px",
              padding: "26px 24px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              border: `1px solid ${borderColor}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
                {forgotStep === "request" ? "Reset Password" : "Verification Code"}
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", color: subtextColor, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {forgotError && (
              <div style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", fontSize: "12.5px", marginBottom: "12px" }}>
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(34, 197, 94, 0.12)", color: "#16a34a", fontSize: "12.5px", marginBottom: "12px" }}>
                {forgotSuccess}
              </div>
            )}

            {forgotStep === "request" ? (
              <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: subtextColor, lineHeight: 1.45 }}>
                  Enter your email address to receive a 6-digit verification code.
                </p>
                <div>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    style={{
                      width: "100%",
                      height: "40px",
                      boxSizing: "border-box",
                      padding: "0 12px",
                      borderRadius: "9px",
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "13.5px",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    height: "42px",
                    borderRadius: "9px",
                    border: "none",
                    background: accentColor,
                    color: buttonTextColor,
                    fontWeight: 700,
                    fontSize: "13.5px",
                    cursor: forgotLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {forgotLoading ? "Sending Code..." : "Send Verification Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: subtextColor }}>
                  <span>Code sent to <strong>{forgotEmail}</strong></span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || forgotLoading}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: resendCooldown > 0 ? subtextColor : accessibleAccentColor,
                      fontWeight: 700,
                      cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                      fontSize: "12px",
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>
                <div>
                  <input
                    type="text"
                    required
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    placeholder="6-digit verification code"
                    style={{
                      width: "100%",
                      height: "40px",
                      boxSizing: "border-box",
                      padding: "0 12px",
                      borderRadius: "9px",
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "15px",
                      letterSpacing: "3px",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    style={{
                      width: "100%",
                      height: "40px",
                      boxSizing: "border-box",
                      padding: "0 12px",
                      borderRadius: "9px",
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "13.5px",
                    }}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    style={{
                      width: "100%",
                      height: "40px",
                      boxSizing: "border-box",
                      padding: "0 12px",
                      borderRadius: "9px",
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "13.5px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep("request")}
                    style={{
                      flex: 1,
                      height: "42px",
                      borderRadius: "9px",
                      border: `1px solid ${borderColor}`,
                      background: "transparent",
                      color: textColor,
                      fontWeight: 600,
                      fontSize: "13.5px",
                      cursor: "pointer",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      flex: 2,
                      height: "42px",
                      borderRadius: "9px",
                      border: "none",
                      background: accentColor,
                      color: buttonTextColor,
                      fontWeight: 700,
                      fontSize: "13.5px",
                      cursor: forgotLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {forgotLoading ? "Updating..." : "Reset & Log In"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}