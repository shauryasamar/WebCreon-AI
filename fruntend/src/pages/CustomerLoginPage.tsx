import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { cleanSiteName, getContrastTextColor, usePublicSiteTheme } from "../hooks/usePublicSiteTheme";

type LocationState = {
  from?: string;
};

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { login, loading: authLoading } = useCustomerAuth();
  const { siteData } = usePublicSiteTheme(slug);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [inputFocused, setInputFocused] = useState<string | null>(null);

  const websiteName = slug || "";
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

  const siteName = siteData?.siteName || cleanSiteName("", websiteName);
  const theme = siteData?.theme || {};
  const isLight = theme.mode === "light";

  const primaryBg = theme.primary_bg || (isLight ? "#f8fafc" : "#0f172a");
  const cardBg = theme.card_bg || theme.secondary_bg || (isLight ? "#ffffff" : "#1e293b");

  // Dynamic High Contrast Text Colors
  const textColor = getContrastTextColor(cardBg);
  const subtextColor = textColor === "#0f172a" ? "rgba(15, 23, 42, 0.65)" : "rgba(248, 250, 252, 0.7)";
  const accentColor = theme.accent_color || "#2563eb";
  const buttonTextColor = getContrastTextColor(accentColor);
  const borderColor = textColor === "#0f172a" ? "rgba(15, 23, 42, 0.12)" : "rgba(255, 255, 255, 0.12)";

  // Clean, Non-Camouflaged Input Styling
  const inputBg = textColor === "#0f172a" ? "#ffffff" : "#0b1220";
  const inputTextColor = getContrastTextColor(inputBg);
  const inputPlaceholderColor = inputTextColor === "#0f172a" ? "rgba(15, 23, 42, 0.45)" : "rgba(248, 250, 252, 0.45)";
  const inputBorder = textColor === "#0f172a" ? "rgba(15, 23, 42, 0.2)" : "rgba(255, 255, 255, 0.2)";

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

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    try {
      await login(websiteName, {
        email: email.trim(),
        password,
      });

      navigate(safeRedirect, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Customer login failed";
      setError(message);
    }
  };

  const handleContinueAsGuest = () => {
    navigate(safeRedirect, { replace: true });
  };

  return (
    <div
      style={{
        height: "100vh",
        maxHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        padding: "16px",
        background: primaryBg,
        color: textColor,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          maxHeight: "calc(100vh - 32px)",
          background: cardBg,
          color: textColor,
          borderRadius: "20px",
          padding: "24px 28px",
          border: `1px solid ${borderColor}`,
          boxShadow: isLight
            ? "0 16px 36px rgba(15, 23, 42, 0.08)"
            : "0 16px 36px rgba(0, 0, 0, 0.35)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowY: "auto",
        }}
      >
        {/* Header Section */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
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
                  color: accentColor,
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
                Log in to your account
              </h1>
            </div>
          </div>

          <p
            style={{
              marginTop: 0,
              marginBottom: "16px",
              fontSize: "13px",
              color: subtextColor,
              lineHeight: 1.45,
            }}
          >
            Access your account on <strong style={{ color: textColor }}>{siteName}</strong> to view orders, track shipments, and check out faster.
          </p>

          {/* Form Section */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div>
              <label
                htmlFor="customer-email"
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "12.5px",
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
                  height: "40px",
                  boxSizing: "border-box",
                  padding: "0 12px",
                  borderRadius: "10px",
                  border: `1px solid ${inputFocused === "email" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: "13.5px",
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
                  marginBottom: "4px",
                  fontSize: "12.5px",
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
                autoComplete="current-password"
                placeholder="Enter your password"
                style={{
                  width: "100%",
                  height: "40px",
                  boxSizing: "border-box",
                  padding: "0 12px",
                  borderRadius: "10px",
                  border: `1px solid ${inputFocused === "password" ? accentColor : inputBorder}`,
                  background: inputBg,
                  color: inputTextColor,
                  outline: "none",
                  fontSize: "13.5px",
                  boxShadow: inputFocused === "password" ? `0 0 0 3px ${accentColor}25` : "none",
                  transition: "all 0.15s ease",
                }}
              />
            </div>

            {error ? (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#ef4444",
                  fontSize: "13px",
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
              <button
                type="submit"
                disabled={authLoading}
                style={{
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
                {authLoading ? "Signing in..." : "Log in"}
              </button>

              <button
                type="button"
                onClick={handleContinueAsGuest}
                style={{
                  height: "40px",
                  borderRadius: "10px",
                  border: `1px solid ${borderColor}`,
                  background: "transparent",
                  color: textColor,
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                Guest Access
              </button>
            </div>
          </form>
        </div>

        {/* Footer Links & WebNirmaan Badge */}
        <div>
          <p
            style={{
              marginTop: "14px",
              marginBottom: 0,
              textAlign: "center",
              fontSize: "13px",
              color: subtextColor,
            }}
          >
            Don&apos;t have an account?{" "}
            <Link
              to={websiteName ? `/store/${websiteName}/signup` : "/"}
              style={{
                color: accentColor,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Sign up
            </Link>
          </p>

          <div
            style={{
              marginTop: "14px",
              paddingTop: "12px",
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
                WebNirmaan AI
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}