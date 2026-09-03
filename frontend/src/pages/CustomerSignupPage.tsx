import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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

export type CustomerSignupPageProps = {
  siteSlug?: string;
  siteName?: string;
  theme?: any;
  card_bg?: string;
  border_color?: string;
  title_color?: string;
  subtext_color?: string;
  input_bg?: string;
  input_border?: string;
  input_text_color?: string;
  button_bg_color?: string;
  button_text_color?: string;
  card_radius?: number | string;
  card_padding?: number | string;
  input_radius?: number | string;
  button_radius?: number | string;
  max_width?: string;
  title?: string;
  subtitle?: string;
  submit_button_label?: string;
  show_google_auth?: boolean;
  [key: string]: any;
};

export default function CustomerSignupPage(props: CustomerSignupPageProps = {}) {
  const {
    siteSlug: propSiteSlug,
    siteName: propSiteName,
    theme: propTheme,
    ...customProps
  } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const { slug, siteId } = useParams<{ slug?: string; siteId?: string }>();
  const targetSlug = propSiteSlug || slug || siteId || "";
  const { signup, loginWithGoogle, loading: authLoading } = useCustomerAuth();
  const { siteData } = usePublicSiteTheme(targetSlug);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [previewNotice, setPreviewNotice] = useState("");
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [inputFocused, setInputFocused] = useState<string | null>(null);

  const isInsideEditor =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/builder/") ||
      window.location.search.includes("edit_mode=true") ||
      (window as any).__WC_EDIT_MODE__ === true);

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

  const websiteName = propSiteSlug || slug || siteId || "";
  const from = (location.state as LocationState | null)?.from;
  const redirectTo = useMemo(() => {
    if (from && from.trim()) {
      return from;
    }

    if (websiteName) {
      return `/store/${websiteName}/account`;
    }

    return "/";
  }, [from, websiteName]);

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

        const btnContainer = document.getElementById("customer-signup-google-btn");
        const fallbackBtn = document.getElementById("customer-signup-google-fallback");
        if (btnContainer) {
          (window as any).google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: isMobile ? 320 : 380,
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
      console.warn("GIS notice:", e);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setGoogleSubmitting(true);
    setError("");
    try {
      await loginWithGoogle(websiteName, idToken);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Google sign-up failed.");
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
        name: name.trim() || mockEmail.split("@")[0].toUpperCase(),
        picture: "https://lh3.googleusercontent.com/a/default-user",
      })
    );
    const mockIdToken = `${header}.${payload}.mock_signature`;
    handleGoogleSuccess(mockIdToken);
  };

  const theme = propTheme || siteData?.theme || {};
  const isLight = theme.mode !== "dark";
  const isHexId = (str?: string) => Boolean(str && /^[0-9a-fA-F]{24}$/.test(str.trim()));
  const siteName =
    propSiteName ||
    (customProps as any)?.siteName ||
    (customProps as any)?.site_name ||
    siteData?.siteName ||
    siteData?.navbar?.brandName ||
    (theme as any)?.site_name ||
    (propSiteSlug && !isHexId(propSiteSlug) ? cleanSiteName("", propSiteSlug) : "") ||
    (slug && !isHexId(slug) ? cleanSiteName("", slug) : "") ||
    (websiteName && !isHexId(websiteName) ? cleanSiteName("", websiteName) : "") ||
    "Store";

  const primaryBg = theme.primary_bg || (isLight ? "#f8fafc" : "#0f172a");
  const baseCardBg = theme.card_bg || theme.secondary_bg || (isLight ? "#ffffff" : "#1e293b");
  const defaultCardBg =
    baseCardBg.toLowerCase().trim() === primaryBg.toLowerCase().trim()
      ? isLight
        ? "#ffffff"
        : "#1e293b"
      : baseCardBg;
  const cardBg = customProps.card_bg || defaultCardBg;

  const computedContrastText = getContrastTextColor(cardBg);
  const rawThemeTextColor = theme.text_color;
  const isDarkCard = computedContrastText === "#ffffff";

  const defaultTextColor =
    rawThemeTextColor && Math.abs(getLuminance(rawThemeTextColor) - getLuminance(cardBg)) > 45
      ? rawThemeTextColor
      : computedContrastText;
  const textColor = customProps.title_color || defaultTextColor;

  const subtextColor = customProps.subtext_color || (isDarkCard ? "rgba(226, 232, 240, 0.78)" : "rgba(51, 65, 85, 0.78)");
  const accentColor = customProps.button_bg_color || theme.accent_color || "#2563eb";
  const accessibleAccentColor = getAccessibleAccentColor(accentColor, cardBg);
  const buttonTextColor = customProps.button_text_color || getContrastTextColor(accentColor);
  const borderColor = customProps.border_color || (isDarkCard ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.12)");

  const inputBg = customProps.input_bg || (isDarkCard ? "#0f172a" : "#ffffff");
  const inputTextColor = customProps.input_text_color || (isDarkCard ? "#f8fafc" : "#0f172a");
  const inputBorder = customProps.input_border || (isDarkCard ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.2)");

  const rawCardRadius = customProps.card_radius ?? (isMobile ? 18 : 24);
  const cardRadius = typeof rawCardRadius === "number" ? `${rawCardRadius}px` : rawCardRadius;

  const rawCardPadding = customProps.card_padding ?? (isMobile ? (isShortScreen ? "18px 18px" : "22px 20px") : "34px 36px 26px 36px");
  const cardPadding = typeof rawCardPadding === "number" ? `${rawCardPadding}px` : rawCardPadding;

  const rawInputRadius = customProps.input_radius ?? (isMobile ? 8 : 10);
  const inputRadius = typeof rawInputRadius === "number" ? `${rawInputRadius}px` : rawInputRadius;

  const rawButtonRadius = customProps.button_radius ?? (isMobile ? 9 : 11);
  const buttonRadius = typeof rawButtonRadius === "number" ? `${rawButtonRadius}px` : rawButtonRadius;

  const resolvedMaxWidth = (() => {
    const raw = customProps.max_width;
    if (!raw) return isMobile ? "380px" : "450px";
    const str = String(raw).trim().toLowerCase();
    if (str === "full" || str === "100%" || str === "100") return "100%";
    if (str.endsWith("px") || str.endsWith("%")) return str;
    const n = Number(str);
    return isNaN(n) ? "450px" : `${n}px`;
  })();

  const showGoogleAuth = customProps.show_google_auth !== false;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isInsideEditor) {
      setPreviewNotice("Account registration verified! (Visual Preview)");
      setTimeout(() => setPreviewNotice(""), 3000);
      return;
    }

    if (!websiteName) {
      setError("Missing site slug");
      return;
    }

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email and password are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await signup(websiteName, {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Customer signup failed";
      setError(message);
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
          maxWidth: resolvedMaxWidth,
          margin: "auto",
          background: cardBg,
          color: textColor,
          borderRadius: cardRadius,
          padding: cardPadding,
          border: `1px solid ${borderColor}`,
          boxShadow: isLight
            ? "0 16px 40px rgba(15, 23, 42, 0.08)"
            : "0 20px 48px rgba(0, 0, 0, 0.40)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? (isShortScreen ? "8px" : "12px") : "16px",
          transition: "all 0.2s ease",
        }}
      >
        {/* BACK TO STORE LINK */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate(websiteName ? `/store/${websiteName}` : "/")}
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

        {/* BRAND NAME HEADING & CLEAN CREATE ACCOUNT HEADER */}
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
            {customProps.title || siteName}
          </h1>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: isMobile ? "13px" : "14px",
              fontWeight: 500,
              color: subtextColor,
            }}
          >
            {customProps.subtitle || "Create your account"}
          </p>
        </div>

        {/* PREVIEW NOTICE */}
        {previewNotice && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: inputRadius,
              background: "rgba(34, 197, 94, 0.12)",
              color: "#16a34a",
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            ✓ {previewNotice}
          </div>
        )}

        {/* 1-CLICK GOOGLE SIGN-UP */}
        {showGoogleAuth && (
          <div>
            <div
              id="customer-signup-google-btn"
              style={{ display: "flex", justifyContent: "center", width: "100%" }}
            ></div>
            <button
              id="customer-signup-google-fallback"
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
                borderRadius: buttonRadius,
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
              <span>{googleSubmitting ? "Connecting..." : "Sign up with Google"}</span>
            </button>
          </div>
        )}

        {/* DIVIDER */}
        {showGoogleAuth && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ flex: 1, height: "1px", background: borderColor }}></div>
            <span style={{ fontSize: isMobile ? "10.5px" : "11.5px", fontWeight: 600, color: subtextColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              or with email
            </span>
            <div style={{ flex: 1, height: "1px", background: borderColor }}></div>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: isMobile ? "8px" : "12px" }}>
          <div>
            <label
              htmlFor="customer-name"
              style={{ display: "block", marginBottom: isMobile ? "2px" : "4px", fontSize: isMobile ? "11.5px" : "13px", fontWeight: 600, color: textColor }}
            >
              Full Name
            </label>
            <input
              id="customer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setInputFocused("name")}
              onBlur={() => setInputFocused(null)}
              autoComplete="name"
              placeholder="Enter your full name"
              style={{
                width: "100%",
                height: isMobile ? "34px" : "40px",
                boxSizing: "border-box",
                padding: isMobile ? "0 10px" : "0 12px",
                borderRadius: inputRadius,
                border: `1px solid ${inputFocused === "name" ? accentColor : inputBorder}`,
                background: inputBg,
                color: inputTextColor,
                outline: "none",
                fontSize: isMobile ? "12.5px" : "13.5px",
                boxShadow: inputFocused === "name" ? `0 0 0 3px ${accentColor}25` : "none",
                transition: "all 0.15s ease",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="customer-email"
              style={{ display: "block", marginBottom: isMobile ? "2px" : "4px", fontSize: isMobile ? "11.5px" : "13px", fontWeight: 600, color: textColor }}
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
                height: isMobile ? "34px" : "40px",
                boxSizing: "border-box",
                padding: isMobile ? "0 10px" : "0 12px",
                borderRadius: inputRadius,
                border: `1px solid ${inputFocused === "email" ? accentColor : inputBorder}`,
                background: inputBg,
                color: inputTextColor,
                outline: "none",
                fontSize: isMobile ? "12.5px" : "13.5px",
                boxShadow: inputFocused === "email" ? `0 0 0 3px ${accentColor}25` : "none",
                transition: "all 0.15s ease",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label
                htmlFor="customer-password"
                style={{ display: "block", marginBottom: isMobile ? "2px" : "4px", fontSize: isMobile ? "11.5px" : "13px", fontWeight: 600, color: textColor }}
              >
                Password
              </label>
              <input
                id="customer-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setInputFocused("password")}
                onBlur={() => setInputFocused(null)}
                autoComplete="new-password"
                placeholder="Password"
                style={{
                  width: "100%",
                  height: isMobile ? "34px" : "40px",
                  boxSizing: "border-box",
                  padding: isMobile ? "0 10px" : "0 12px",
                  borderRadius: inputRadius,
                  border: `1px solid ${inputFocused === "password" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: isMobile ? "12.5px" : "13.5px",
                  boxShadow: inputFocused === "password" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="customer-confirm-password"
                style={{ display: "block", marginBottom: isMobile ? "2px" : "4px", fontSize: isMobile ? "11.5px" : "13px", fontWeight: 600, color: textColor }}
              >
                Confirm
              </label>
              <input
                id="customer-confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setInputFocused("confirmPassword")}
                onBlur={() => setInputFocused(null)}
                autoComplete="new-password"
                placeholder="Repeat password"
                style={{
                  width: "100%",
                  height: isMobile ? "34px" : "40px",
                  boxSizing: "border-box",
                  padding: isMobile ? "0 10px" : "0 12px",
                  borderRadius: inputRadius,
                  border: `1px solid ${inputFocused === "confirmPassword" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: isMobile ? "12.5px" : "13.5px",
                  boxShadow: inputFocused === "confirmPassword" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-2px" }}>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: isMobile ? "11px" : "12px",
                fontWeight: 600,
                color: subtextColor,
                cursor: "pointer",
              }}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: inputRadius,
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                fontSize: "12.5px",
                lineHeight: 1.35,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading || googleSubmitting}
            style={{
              marginTop: "2px",
              height: isMobile ? "38px" : "44px",
              borderRadius: buttonRadius,
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
            {authLoading ? "Creating account..." : (customProps.submit_button_label || "Create Account")}
          </button>
        </form>

        {/* SWITCH TO LOGIN & BADGE */}
        <div style={{ textAlign: "center", paddingTop: "2px" }}>
          <p style={{ margin: 0, fontSize: isMobile ? "12.5px" : "13.5px", color: subtextColor }}>
            Already have an account?{" "}
            <Link
              to={websiteName ? `/store/${websiteName}/login` : "/"}
              style={{
                color: accessibleAccentColor,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Sign In
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
    </div>
  );
}