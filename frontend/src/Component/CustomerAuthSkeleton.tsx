import React from "react";
import { usePublicSiteTheme, cleanSiteName } from "../hooks/usePublicSiteTheme";
import { isColorDarkHex } from "../context/ThemeContext";

export interface CustomerAuthSkeletonProps {
  siteSlug?: string;
  isSignup?: boolean;
  theme?: any;
  siteName?: string;
}

export const CustomerAuthSkeleton: React.FC<CustomerAuthSkeletonProps> = ({
  siteSlug,
  isSignup = false,
  theme: explicitTheme,
  siteName: explicitSiteName,
}) => {
  const { siteData } = usePublicSiteTheme(siteSlug);

  const effectiveTheme = explicitTheme || siteData?.theme || {};
  const effectiveSiteName =
    explicitSiteName || siteData?.siteName || cleanSiteName(undefined, siteSlug);

  const primaryBg =
    effectiveTheme.primary_bg ||
    effectiveTheme.primaryBg ||
    (effectiveTheme.mode === "dark" ? "#0b0f17" : "#f8fafc");

  const isDark =
    effectiveTheme.mode === "dark" ||
    (primaryBg ? isColorDarkHex(primaryBg) : false);

  const cardBg =
    effectiveTheme.card_bg ||
    effectiveTheme.cardBg ||
    (isDark ? "#18181b" : "#ffffff");

  const isCardDark = isColorDarkHex(cardBg);

  const accentColor =
    effectiveTheme.accent_color ||
    effectiveTheme.accentColor ||
    "#2563eb";

  const rawBorder =
    effectiveTheme.border_color ||
    effectiveTheme.borderColor ||
    (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)");

  const border = rawBorder.startsWith("1px") || rawBorder.startsWith("2px")
    ? rawBorder
    : `1px solid ${rawBorder}`;

  const rawCardRadius = effectiveTheme.card_radius ?? 18;
  const cardRadius =
    typeof rawCardRadius === "number"
      ? `${rawCardRadius}px`
      : String(rawCardRadius).endsWith("px")
      ? String(rawCardRadius)
      : `${rawCardRadius}px`;

  const rawInputRadius = effectiveTheme.input_radius ?? 10;
  const inputRadius =
    typeof rawInputRadius === "number"
      ? `${rawInputRadius}px`
      : String(rawInputRadius).endsWith("px")
      ? String(rawInputRadius)
      : `${rawInputRadius}px`;

  const rawBtnRadius = effectiveTheme.button_radius ?? 10;
  const buttonRadius =
    typeof rawBtnRadius === "number"
      ? `${rawBtnRadius}px`
      : String(rawBtnRadius).endsWith("px")
      ? String(rawBtnRadius)
      : `${rawBtnRadius}px`;

  // Shimmer gradients
  const baseShimmer = isCardDark
    ? "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)";

  const skStyle: React.CSSProperties = {
    backgroundImage: baseShimmer,
    backgroundSize: "200% 100%",
    animation: "authShimmer 1.4s infinite linear",
    willChange: "background-position",
  };

  const accentShimmer: React.CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${accentColor} 25%, ${accentColor}dd 50%, ${accentColor} 75%)`,
    backgroundSize: "200% 100%",
    animation: "authShimmer 1.4s infinite linear",
    willChange: "background-position",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: primaryBg,
        boxSizing: "border-box",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @keyframes authShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Main Auth Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: cardBg,
          borderRadius: cardRadius,
          padding: "36px 32px",
          border: border,
          boxShadow: isDark
            ? "0 20px 48px rgba(0, 0, 0, 0.45)"
            : "0 16px 40px rgba(15, 23, 42, 0.08)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Back to store placeholder */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ ...skStyle, width: "100px", height: "14px", borderRadius: "4px" }} />
        </div>

        {/* Brand Header Skeleton */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          {/* Logo Placeholder */}
          <div
            style={{
              ...skStyle,
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              border: `1.5px solid ${accentColor}33`,
            }}
          />
          {/* Title Placeholder */}
          <div
            style={{
              ...skStyle,
              width: effectiveSiteName ? `${Math.min(effectiveSiteName.length * 12, 220)}px` : "160px",
              height: "26px",
              borderRadius: "6px",
              marginTop: "4px",
            }}
          />
          {/* Subtitle Placeholder */}
          <div
            style={{
              ...skStyle,
              width: isSignup ? "170px" : "150px",
              height: "14px",
              borderRadius: "4px",
            }}
          />
        </div>

        {/* Google Auth Button Placeholder */}
        <div
          style={{
            ...skStyle,
            width: "100%",
            height: "44px",
            borderRadius: buttonRadius,
            border: border,
          }}
        />

        {/* Divider Skeleton */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
          <div style={{ flex: 1, height: "1px", background: border }} />
          <div style={{ ...skStyle, width: "130px", height: "10px", borderRadius: "3px" }} />
          <div style={{ flex: 1, height: "1px", background: border }} />
        </div>

        {/* Form Inputs Skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isSignup && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ ...skStyle, width: "70px", height: "12px", borderRadius: "3px" }} />
              <div
                style={{
                  ...skStyle,
                  width: "100%",
                  height: "42px",
                  borderRadius: inputRadius,
                  border: border,
                }}
              />
            </div>
          )}

          {/* Email Field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ ...skStyle, width: "80px", height: "12px", borderRadius: "3px" }} />
            <div
              style={{
                ...skStyle,
                width: "100%",
                height: "42px",
                borderRadius: inputRadius,
                border: border,
              }}
            />
          </div>

          {/* Password Field */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ ...skStyle, width: "65px", height: "12px", borderRadius: "3px" }} />
              {!isSignup && (
                <div style={{ ...skStyle, width: "95px", height: "12px", borderRadius: "3px" }} />
              )}
            </div>
            <div
              style={{
                ...skStyle,
                width: "100%",
                height: "42px",
                borderRadius: inputRadius,
                border: border,
              }}
            />
          </div>

          {isSignup && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ ...skStyle, width: "110px", height: "12px", borderRadius: "3px" }} />
              <div
                style={{
                  ...skStyle,
                  width: "100%",
                  height: "42px",
                  borderRadius: inputRadius,
                  border: border,
                }}
              />
            </div>
          )}

          {/* Submit Button in Store's Accent Color */}
          <div
            style={{
              ...accentShimmer,
              width: "100%",
              height: "44px",
              borderRadius: buttonRadius,
              marginTop: "8px",
              boxShadow: `0 4px 14px ${accentColor}40`,
            }}
          />
        </div>

        {/* Footer Toggle Link Placeholder */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
          <div style={{ ...skStyle, width: "200px", height: "14px", borderRadius: "4px" }} />
        </div>
      </div>
    </div>
  );
};

export default CustomerAuthSkeleton;
