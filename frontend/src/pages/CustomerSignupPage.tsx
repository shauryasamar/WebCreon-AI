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

export default function CustomerSignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { signup, loading: authLoading } = useCustomerAuth();
  const { siteData, loadingSite } = usePublicSiteTheme(slug);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [inputFocused, setInputFocused] = useState<string | null>(null);

  const websiteName = slug || "";
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

  const siteName = siteData?.siteName || cleanSiteName("", websiteName);
  const theme = siteData?.theme || {};
  const isLight = theme.mode !== "dark";

  const primaryBg = theme.primary_bg || (isLight ? "#f8fafc" : "#0f172a");
  const cardBg = theme.card_bg || theme.secondary_bg || (isLight ? "#ffffff" : "#1e293b");

  // Dynamic High Contrast & Accessible Text Colors
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
  const borderColor = isDarkCard ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)";

  // Clean, Non-Camouflaged Input Styling
  const inputBg = isDarkCard ? "#0f172a" : "#ffffff";
  const inputTextColor = isDarkCard ? "#f8fafc" : "#0f172a";
  const inputBorder = isDarkCard ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.2)";

  const initials = useMemo(() => {
    const parts = siteName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (siteName[0] || "S").toUpperCase();
  }, [siteName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

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

  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const isMobile = viewportWidth <= 640;

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "24px 14px" : "40px 20px",
        background: primaryBg,
        color: textColor,
        boxSizing: "border-box",
        transition: "background-color 0.25s ease, color 0.25s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          margin: "auto",
          background: cardBg,
          color: textColor,
          borderRadius: isMobile ? "18px" : "24px",
          padding: isMobile ? "24px 18px" : "32px 32px",
          border: `1px solid ${borderColor}`,
          boxShadow: isLight
            ? "0 16px 40px rgba(15, 23, 42, 0.08)"
            : "0 20px 48px rgba(0, 0, 0, 0.40)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          transition: "background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease",
        }}
      >
        {/* Header Section */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                overflow: "hidden",
                background: siteData?.logo
                  ? "transparent"
                  : `linear-gradient(135deg, ${accentColor}, #7c3aed)`,
                display: "grid",
                placeItems: "center",
                fontSize: "15px",
                fontWeight: 800,
                color: "#ffffff",
                flexShrink: 0,
                boxShadow: `0 4px 12px ${accentColor}33`,
              }}
            >
              {siteData?.logo ? (
                <img
                  src={siteData.logo}
                  alt={siteName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: accessibleAccentColor,
                }}
              >
                {siteName}
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 800,
                  lineHeight: 1.2,
                  color: textColor,
                }}
              >
                Create your account
              </h1>
            </div>
          </div>

          {/* Form Section - Clean single column vertical stack */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div>
              <label
                htmlFor="customer-name"
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: textColor,
                }}
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
                placeholder="Enter full name"
                style={{
                  width: "100%",
                  height: "36px",
                  boxSizing: "border-box",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: `1px solid ${inputFocused === "name" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: "13px",
                  boxShadow: inputFocused === "name" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="customer-email"
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: textColor,
                }}
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
                  height: "36px",
                  boxSizing: "border-box",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: `1px solid ${inputFocused === "email" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: "13px",
                  boxShadow: inputFocused === "email" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="customer-password"
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: textColor,
                }}
              >
                Password
              </label>
              <input
                id="customer-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setInputFocused("password")}
                onBlur={() => setInputFocused(null)}
                autoComplete="new-password"
                placeholder="Create password"
                style={{
                  width: "100%",
                  height: "36px",
                  boxSizing: "border-box",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: `1px solid ${inputFocused === "password" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: "13px",
                  boxShadow: inputFocused === "password" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="customer-confirm-password"
                style={{
                  display: "block",
                  marginBottom: "3px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: textColor,
                }}
              >
                Confirm Password
              </label>
              <input
                id="customer-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setInputFocused("confirmPassword")}
                onBlur={() => setInputFocused(null)}
                autoComplete="new-password"
                placeholder="Re-enter password"
                style={{
                  width: "100%",
                  height: "36px",
                  boxSizing: "border-box",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: `1px solid ${inputFocused === "confirmPassword" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: "13px",
                  boxShadow: inputFocused === "confirmPassword" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>

            {error ? (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "9px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#ef4444",
                  fontSize: "12.5px",
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                marginTop: "4px",
                height: "40px",
                borderRadius: "10px",
                border: "none",
                background: accentColor,
                color: buttonTextColor,
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: authLoading ? "not-allowed" : "pointer",
                opacity: authLoading ? 0.75 : 1,
                boxShadow: `0 3px 10px ${accentColor}33`,
                transition: "opacity 0.15s ease",
              }}
            >
              {authLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* Footer Links & Webcreon Badge */}
        <div>
          <p
            style={{
              marginTop: "12px",
              marginBottom: 0,
              textAlign: "center",
              fontSize: "13px",
              color: subtextColor,
            }}
          >
            Already have an account on {siteName}?{" "}
            <Link
              to={websiteName ? `/store/${websiteName}/login` : "/"}
              style={{
                color: accessibleAccentColor,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Log in
            </Link>
          </p>

          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: `1px solid ${borderColor}`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                textDecoration: "none",
                fontSize: "11.5px",
                fontWeight: 500,
                color: subtextColor,
              }}
            >
              <span>Powered by</span>
              <span
                style={{
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
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