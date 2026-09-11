import React, { useEffect, useMemo } from "react";
import { usePublicSiteTheme } from "../hooks/usePublicSiteTheme";
import { resolveThemeTokens, SiteTheme } from "../context/ThemeContext";

export interface StoreThemeConfig extends SiteTheme {
  primaryBg?: string;
  bgColor?: string;
  bg?: string;
  background?: string;
  secondaryBg?: string;
  cardBg?: string;
  textColor?: string;
  accentColor?: string;
  primaryColor?: string;
  primary?: string;
  accent?: string;
  borderColor?: string;
  fontFamily?: string;
}

export interface StoreMaintenancePageProps {
  slug?: string;
  storeName?: string;
  logoUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  theme?: StoreThemeConfig | Record<string, any>;
}

export const StoreMaintenancePage: React.FC<StoreMaintenancePageProps> = ({
  slug,
  storeName = "Our Store",
  logoUrl,
  supportEmail,
  supportPhone,
  theme = {},
}) => {
  const { siteData } = usePublicSiteTheme(slug);

  // Merge live fetched theme with passed theme from parent/builder
  const mergedTheme: any = useMemo(() => {
    return {
      ...(siteData?.theme || {}),
      ...(theme || {}),
    };
  }, [siteData?.theme, theme]);

  // Resolve standard design tokens matching the rest of the website
  const tokens = useMemo(() => {
    return resolveThemeTokens(mergedTheme);
  }, [mergedTheme]);

  const resolvedStoreName =
    storeName && storeName !== "Store" && storeName !== "Our Store"
      ? storeName
      : siteData?.siteName || storeName || "Our Store";

  const resolvedLogoUrl = logoUrl || siteData?.logo || siteData?.navbar?.logoUrl;

  useEffect(() => {
    // Dynamic meta tag for SEO safety while offline
    document.title = `${resolvedStoreName} - Temporarily Offline for Maintenance`;

    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    const createdRobots = !metaRobots;
    if (createdRobots) {
      metaRobots = document.createElement("meta");
      metaRobots.name = "robots";
      document.head.appendChild(metaRobots);
    }
    const previousContent = metaRobots.content;
    metaRobots.content = "noindex, nofollow";

    return () => {
      if (createdRobots) {
        metaRobots.remove();
      } else {
        metaRobots.content = previousContent;
      }
    };
  }, [resolvedStoreName]);

  const fontFamily =
    mergedTheme.font_family ||
    mergedTheme.fontFamily ||
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return (
    <div
      style={{
        height: "100vh",
        maxHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.primaryBg,
        background: tokens.isDark
          ? `radial-gradient(circle at 50% 20%, ${tokens.accentColor}18 0%, transparent 60%), radial-gradient(circle at 90% 85%, ${tokens.accentColor}10 0%, transparent 50%), ${tokens.primaryBg}`
          : `radial-gradient(circle at 50% 20%, ${tokens.accentColor}0f 0%, transparent 55%), radial-gradient(circle at 90% 85%, ${tokens.accentColor}08 0%, transparent 45%), ${tokens.primaryBg}`,
        padding: "16px 20px",
        fontFamily,
        color: tokens.textColor,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient Decorative Background Rings */}
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          left: "-120px",
          width: "320px",
          height: "320px",
          borderRadius: "50%",
          border: `1.5px solid ${tokens.accentColor}18`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-60px",
          right: "-120px",
          width: "380px",
          height: "380px",
          borderRadius: "50%",
          border: `1.5px solid ${tokens.borderColor}`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "0px",
          right: "-60px",
          width: "260px",
          height: "260px",
          borderRadius: "50%",
          border: `1.5px solid ${tokens.accentColor}12`,
          pointerEvents: "none",
        }}
      />

      {/* Main Single-Page Focused Container */}
      <div
        style={{
          maxWidth: "800px",
          width: "100%",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* 1. Header: Store Name / Logo & Subtitle */}
        <div style={{ marginBottom: "8px" }}>
          {resolvedLogoUrl ? (
            <img
              src={resolvedLogoUrl}
              alt={resolvedStoreName}
              style={{
                maxHeight: "36px",
                maxWidth: "200px",
                objectFit: "contain",
                marginBottom: "2px",
                filter: tokens.isDark ? "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" : "none",
              }}
            />
          ) : (
            <h2
              style={{
                margin: "0 0 2px 0",
                fontSize: "23px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: tokens.textColor,
              }}
            >
              {resolvedStoreName}
            </h2>
          )}
          <div
            style={{
              fontSize: "9.5px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: tokens.mutedTextColor,
            }}
          >
            Good Things Ahead
          </div>
        </div>

        {/* 2. Main Hero Focal Visual: Wide Aesthetic Storefront Illustration */}
        <div style={{ margin: "0 auto 6px auto", width: "100%", maxWidth: "460px" }}>
          <svg
            width="100%"
            height="185"
            viewBox="0 0 400 170"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: "visible" }}
          >
            <defs>
              <radialGradient id="storeAura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={tokens.accentColor} stopOpacity={tokens.isDark ? "0.26" : "0.15"} />
                <stop offset="100%" stopColor={tokens.accentColor} stopOpacity="0" />
              </radialGradient>
              <linearGradient id="awningAccent" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={tokens.accentColor} />
                <stop offset="100%" stopColor={tokens.accentHover || tokens.accentColor} stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="awningAlternating" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={tokens.cardBg} />
                <stop offset="100%" stopColor={tokens.secondaryBg} />
              </linearGradient>
              <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity={tokens.isDark ? "0.3" : "0.08"} />
              </filter>
            </defs>

            {/* Ambient Aura */}
            <ellipse cx="200" cy="90" rx="140" ry="60" fill="url(#storeAura)" />

            {/* Background Gear */}
            <g transform="translate(255, 18)" stroke={tokens.isDark ? `${tokens.accentColor}88` : tokens.borderColor} strokeWidth="2.5" fill={tokens.isDark ? "rgba(255,255,255,0.04)" : tokens.secondaryBg}>
              <circle cx="18" cy="18" r="13" />
              <path d="M18 2v3M18 31v3M2 18h3M31 18h3M6.7 6.7l2.1 2.1M27.2 27.2l2.1 2.1M6.7 29.3l2.1-2.1M27.2 8.8l2.1-2.1" strokeLinecap="round" />
              <circle cx="18" cy="18" r="5" fill={tokens.cardBg} />
            </g>

            {/* Sparkles */}
            <path d="M105 24L107 29L112 31L107 33L105 38L103 33L98 31L103 29Z" fill={tokens.accentColor} />
            <line x1="88" y1="42" x2="96" y2="38" stroke={tokens.accentColor} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <path d="M320 52L321.5 56L325.5 57.5L321.5 59L320 63L318.5 59L314.5 57.5L318.5 56Z" fill={tokens.accentColor} opacity="0.75" />
            <line x1="295" y1="60" x2="305" y2="60" stroke={tokens.borderColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="297" y1="66" x2="303" y2="66" stroke={tokens.borderColor} strokeWidth="2" strokeLinecap="round" />

            {/* Ground Shadow Base */}
            <rect x="75" y="146" width="250" height="4" rx="2" fill={tokens.isDark ? "rgba(255,255,255,0.08)" : tokens.borderColor} />

            {/* Store Building Walls */}
            <rect x="125" y="60" width="150" height="86" rx="4" fill={tokens.cardBg} stroke={tokens.borderColor} strokeWidth="1.5" />

            {/* Front Door */}
            <rect x="142" y="84" width="34" height="62" rx="3" fill={tokens.isDark ? "rgba(255,255,255,0.12)" : tokens.secondaryBg} stroke={tokens.borderColor} strokeWidth="1" />
            <circle cx="150" cy="116" r="2.5" fill={tokens.textColor} opacity="0.8" />

            {/* Potted Plant */}
            <g transform="translate(100, 108)">
              <path d="M5 25L8 37H22L25 25Z" fill={tokens.secondaryBg} stroke={tokens.borderColor} strokeWidth="1.2" />
              <ellipse cx="15" cy="18" rx="4" ry="10" fill="#10b981" />
              <ellipse cx="10" cy="20" rx="3.5" ry="8" fill="#059669" transform="rotate(-25 10 20)" />
              <ellipse cx="20" cy="20" rx="3.5" ry="8" fill="#34d399" transform="rotate(25 20 20)" />
            </g>

            {/* Hanging Sign */}
            <g transform="translate(196, 74)">
              <line x1="22" y1="0" x2="22" y2="14" stroke={tokens.mutedTextColor} strokeWidth="1.5" />
              <line x1="56" y1="0" x2="56" y2="14" stroke={tokens.mutedTextColor} strokeWidth="1.5" />
              <circle cx="22" cy="14" r="2" fill={tokens.accentColor} />
              <circle cx="56" cy="14" r="2" fill={tokens.accentColor} />
              <rect x="6" y="14" width="66" height="44" rx="6" fill={tokens.cardBg} stroke={tokens.borderColor} strokeWidth="1.5" filter="url(#cardShadow)" />
              <text x="39" y="32" textAnchor="middle" fill={tokens.mutedTextColor} fontSize="9.5" fontWeight="600" fontFamily={fontFamily}>
                We&apos;ll be
              </text>
              <text x="39" y="46" textAnchor="middle" fill={tokens.textColor} fontSize="10.5" fontWeight="700" fontFamily={fontFamily}>
                back soon
              </text>
            </g>

            {/* Wide Store Awning (7 Stripes with Theme Colors) */}
            <g transform="translate(115, 32)">
              <path d="M4 34Q85 43 166 34" stroke={tokens.isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.06)"} strokeWidth="5" strokeLinecap="round" />
              
              <path d="M8 2L0 28Q12 33 24 28L22 2Z" fill="url(#awningAccent)" />
              <path d="M22 2L24 28Q36 33 48 28L46 2Z" fill="url(#awningAlternating)" />
              <path d="M46 2L48 28Q60 33 72 28L70 2Z" fill="url(#awningAccent)" />
              <path d="M70 2L72 28Q84 33 96 28L94 2Z" fill="url(#awningAlternating)" />
              <path d="M94 2L96 28Q108 33 120 28L118 2Z" fill="url(#awningAccent)" />
              <path d="M118 2L120 28Q132 33 144 28L142 2Z" fill="url(#awningAlternating)" />
              <path d="M142 2L144 28Q156 33 168 28L160 2Z" fill="url(#awningAccent)" />

              <path d="M6 2H162" stroke={tokens.isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.8)"} strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        {/* 3. The Status Pill Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: `${tokens.accentColor}16`,
            border: `1px solid ${tokens.accentColor}38`,
            borderRadius: "9999px",
            padding: "4px 13px",
            marginBottom: "10px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: tokens.accentColor,
              boxShadow: `0 0 8px ${tokens.accentColor}`,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: tokens.accentColor,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Under Scheduled Maintenance
          </span>
        </div>

        {/* 4. Main Heading */}
        <h1
          style={{
            margin: "0 0 6px 0",
            fontSize: "24px",
            fontWeight: 800,
            lineHeight: 1.2,
            color: tokens.textColor,
            letterSpacing: "-0.02em",
          }}
        >
          We&apos;re making things better
        </h1>

        {/* 5. Compact Description Text */}
        <p
          style={{
            margin: "0 auto 16px auto",
            fontSize: "13px",
            lineHeight: 1.45,
            color: tokens.mutedTextColor,
            maxWidth: "520px",
          }}
        >
          We&apos;re currently updating our store to give you a smoother, faster and more reliable
          shopping experience. We&apos;ll be back online shortly!
        </p>

        {/* 6. 3-Column Assurance Cards Row (Slim & Compact with Exact Theme Tokens) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            width: "100%",
            maxWidth: "760px",
            marginBottom: "14px",
          }}
        >
          {/* Card 1: Data Safe */}
          <div
            style={{
              background: tokens.cardBg,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: `1px solid ${tokens.borderColor}`,
              borderRadius: "12px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textAlign: "left",
              boxShadow: tokens.shadow,
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: `${tokens.accentColor}16`,
                border: `1px solid ${tokens.accentColor}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: tokens.accentColor,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: tokens.textColor, marginBottom: "1px" }}>
                Your data is safe
              </div>
              <div style={{ fontSize: "10.5px", lineHeight: 1.35, color: tokens.mutedTextColor }}>
                Existing orders & accounts are securely preserved.
              </div>
            </div>
          </div>

          {/* Card 2: Better Experience */}
          <div
            style={{
              background: tokens.cardBg,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: `1px solid ${tokens.borderColor}`,
              borderRadius: "12px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textAlign: "left",
              boxShadow: tokens.shadow,
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: `${tokens.accentColor}16`,
                border: `1px solid ${tokens.accentColor}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: tokens.accentColor,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: tokens.textColor, marginBottom: "1px" }}>
                A better experience
              </div>
              <div style={{ fontSize: "10.5px", lineHeight: 1.35, color: tokens.mutedTextColor }}>
                Improved performance and new features.
              </div>
            </div>
          </div>

          {/* Card 3: Great Products */}
          <div
            style={{
              background: tokens.cardBg,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: `1px solid ${tokens.borderColor}`,
              borderRadius: "12px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textAlign: "left",
              boxShadow: tokens.shadow,
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: `${tokens.accentColor}16`,
                border: `1px solid ${tokens.accentColor}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: tokens.accentColor,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: tokens.textColor, marginBottom: "1px" }}>
                Same great products
              </div>
              <div style={{ fontSize: "10.5px", lineHeight: 1.35, color: tokens.mutedTextColor }}>
                All your favourites will be here when we&apos;re back.
              </div>
            </div>
          </div>
        </div>

        {/* 7. Support Section (if configured) */}
        {(supportEmail || supportPhone) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            {supportEmail && (
              <a
                href={`mailto:${supportEmail}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11.5px",
                  color: tokens.accentColor,
                  textDecoration: "none",
                  fontWeight: 600,
                  background: tokens.cardBg,
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  border: `1px solid ${tokens.borderColor}`,
                  boxShadow: tokens.shadow,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>{supportEmail}</span>
              </a>
            )}
            {supportPhone && (
              <a
                href={`tel:${supportPhone}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11.5px",
                  color: tokens.accentColor,
                  textDecoration: "none",
                  fontWeight: 600,
                  background: tokens.cardBg,
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  border: `1px solid ${tokens.borderColor}`,
                  boxShadow: tokens.shadow,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{supportPhone}</span>
              </a>
            )}
          </div>
        )}

        {/* 8. Thin Divider Line */}
        <div
          style={{
            width: "100%",
            maxWidth: "760px",
            height: "1px",
            background: tokens.borderColor,
            marginBottom: "12px",
          }}
        />

        {/* 9. Gratitude Note */}
        <div
          style={{
            fontSize: "12px",
            color: tokens.mutedTextColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            marginBottom: "10px",
          }}
        >
          <span>Thank you for your patience and support!</span>
          <span style={{ color: "#ef4444" }}>❤️</span>
        </div>

        {/* 10. Webcreon Brand Watermark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            color: tokens.mutedTextColor,
          }}
        >
          <span>Powered by</span>
          <span style={{ fontWeight: 700, color: tokens.textColor, letterSpacing: "0.02em" }}>WebCreon</span>
        </div>
      </div>
    </div>
  );
};

export default StoreMaintenancePage;
