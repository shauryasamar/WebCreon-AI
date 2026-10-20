import React from "react";
import { usePublicSiteTheme, cleanSiteName } from "../hooks/usePublicSiteTheme";
import { isColorDarkHex } from "../context/ThemeContext";

export interface StorefrontSkeletonProps {
  isProductDetail?: boolean;
  siteSlug?: string;
  theme?: any;
  siteName?: string;
}

export const StorefrontSkeleton: React.FC<StorefrontSkeletonProps> = ({
  isProductDetail,
  siteSlug,
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
    effectiveTheme.page_bg ||
    (effectiveTheme.mode === "dark" ? "#121214" : "#f8fafc");

  const isDark =
    effectiveTheme.mode === "dark" ||
    (primaryBg ? isColorDarkHex(primaryBg) : false);

  const cardBg =
    effectiveTheme.card_bg ||
    effectiveTheme.cardBg ||
    (isDark ? "rgba(255, 255, 255, 0.04)" : "#ffffff");

  const isCardDark = isColorDarkHex(cardBg);

  const accentColor =
    effectiveTheme.accent_color ||
    effectiveTheme.accentColor ||
    effectiveTheme.primary_color ||
    "#3b82f6";

  const rawBorder =
    effectiveTheme.border_color ||
    effectiveTheme.borderColor ||
    (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)");

  const border = rawBorder.startsWith("1px") || rawBorder.startsWith("2px")
    ? rawBorder
    : `1px solid ${rawBorder}`;

  const rawRadius = effectiveTheme.card_radius ?? 18;
  const radius =
    typeof rawRadius === "number"
      ? `${rawRadius}px`
      : String(rawRadius).endsWith("px") || String(rawRadius).endsWith("%")
      ? String(rawRadius)
      : `${rawRadius}px`;

  // Dynamic Shimmer style tuned to the store's dark/light atmosphere
  const shimmerGradient = isCardDark
    ? "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.03) 75%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)";

  const skStyle: React.CSSProperties = {
    backgroundImage: shimmerGradient,
    backgroundSize: "200% 100%",
    animation: "storeShimmer 1.5s infinite linear",
    willChange: "background-position",
  };

  const accentShimmerStyle: React.CSSProperties = skStyle;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: primaryBg,
        color: isDark ? "#f8fafc" : "#0f172a",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @keyframes storeShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (min-width: 768px) {
          .wc-sk-searchbar {
            display: flex !important;
          }
        }
      `}</style>

      {/* ── 1. Storefront Header / Navbar Skeleton ───────────────────── */}
      <header
        style={{
          height: "68px",
          borderBottom: border,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: isDark ? "rgba(24, 24, 27, 0.85)" : "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(14px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Brand Logo & Name */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              ...accentShimmerStyle,
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              border: border,
            }}
          />
          <div
            style={{
              ...skStyle,
              width: effectiveSiteName ? `${Math.min(effectiveSiteName.length * 10, 160)}px` : "120px",
              height: "20px",
              borderRadius: "6px",
            }}
          />
        </div>

        {/* Search Bar Placeholder */}
        <div
          style={{
            display: "none",
            alignItems: "center",
            width: "320px",
            height: "40px",
            borderRadius: "999px",
            background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
            border: border,
            padding: "0 16px",
          }}
          className="wc-sk-searchbar"
        >
          <div style={{ ...skStyle, width: "16px", height: "16px", borderRadius: "50%" }} />
          <div style={{ ...skStyle, width: "120px", height: "12px", borderRadius: "4px", marginLeft: "12px" }} />
        </div>

        {/* Nav Links & Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div style={{ ...skStyle, width: "50px", height: "14px", borderRadius: "4px" }} />
          <div style={{ ...skStyle, width: "65px", height: "14px", borderRadius: "4px" }} />
          {/* Cart Icon Button Placeholder */}
          <div
            style={{
              ...accentShimmerStyle,
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
            }}
          />
        </div>
      </header>

      {/* ── 2. Store Body Skeleton ───────────────────────────────────── */}
      <main
        style={{
          maxWidth: "1260px",
          margin: "0 auto",
          padding: "24px 20px 64px",
          boxSizing: "border-box",
        }}
      >
        {isProductDetail ? (
          /* ── Product Detail View Skeleton ── */
          <div>
            {/* Breadcrumb Skeleton */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ ...skStyle, width: "45px", height: "12px", borderRadius: "4px" }} />
              <div style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)", fontSize: "12px" }}>/</div>
              <div style={{ ...skStyle, width: "65px", height: "12px", borderRadius: "4px" }} />
              <div style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)", fontSize: "12px" }}>/</div>
              <div style={{ ...skStyle, width: "100px", height: "12px", borderRadius: "4px" }} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "40px",
                alignItems: "start",
              }}
            >
              {/* Left Column: Product Gallery */}
              <div>
                <div
                  style={{
                    ...skStyle,
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: radius,
                    border: border,
                    background: cardBg,
                  }}
                />
                <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                  {[1, 2, 3, 4].map((t) => (
                    <div
                      key={t}
                      style={{
                        ...skStyle,
                        width: "68px",
                        height: "68px",
                        borderRadius: "10px",
                        border: border,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Right Column: Product Information */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ ...skStyle, width: "25%", height: "14px", borderRadius: "4px" }} />
                <div style={{ ...skStyle, width: "80%", height: "30px", borderRadius: "8px" }} />
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ ...accentShimmerStyle, width: "90px", height: "18px", borderRadius: "4px" }} />
                  <div style={{ ...skStyle, width: "60px", height: "14px", borderRadius: "4px" }} />
                </div>
                <div style={{ ...skStyle, width: "35%", height: "36px", borderRadius: "8px", marginTop: "8px" }} />
                <div
                  style={{
                    ...skStyle,
                    width: "100%",
                    height: "110px",
                    borderRadius: "12px",
                    border: border,
                    marginTop: "8px",
                  }}
                />
                <div style={{ ...skStyle, width: "40%", height: "24px", borderRadius: "6px", marginTop: "8px" }} />
                <div style={{ display: "flex", gap: "10px" }}>
                  {[1, 2, 3].map((v) => (
                    <div
                      key={v}
                      style={{
                        ...skStyle,
                        width: "55px",
                        height: "36px",
                        borderRadius: "8px",
                        border: border,
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    ...accentShimmerStyle,
                    width: "100%",
                    height: "52px",
                    borderRadius: "14px",
                    marginTop: "16px",
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── Storefront Homepage / Catalog View Skeleton ── */
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {/* Hero / Promo Banner Skeleton */}
            <div
              style={{
                ...skStyle,
                width: "100%",
                height: "230px",
                borderRadius: radius,
                border: border,
                background: cardBg,
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "32px",
                boxSizing: "border-box",
                gap: "14px",
              }}
            >
              <div style={{ ...skStyle, width: "120px", height: "16px", borderRadius: "4px" }} />
              <div style={{ ...skStyle, width: "40%", height: "32px", borderRadius: "8px" }} />
              <div style={{ ...accentShimmerStyle, width: "140px", height: "40px", borderRadius: "10px", marginTop: "6px" }} />
            </div>

            {/* Category Story / Bubbles Skeleton */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                overflowX: "hidden",
                padding: "4px 0",
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      ...skStyle,
                      width: "68px",
                      height: "68px",
                      borderRadius: "50%",
                      border: `1.5px solid ${accentColor}33`,
                      background: cardBg,
                    }}
                  />
                  <div style={{ ...skStyle, width: "50px", height: "10px", borderRadius: "4px" }} />
                </div>
              ))}
            </div>

            {/* Section Title & View All */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "4px",
                    height: "20px",
                    borderRadius: "2px",
                    background: isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.4)",
                  }}
                />
                <div style={{ ...skStyle, width: "180px", height: "22px", borderRadius: "6px" }} />
              </div>
              <div style={{ ...accentShimmerStyle, width: "70px", height: "16px", borderRadius: "4px" }} />
            </div>

            {/* 8 Product Cards Grid Skeleton */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "20px",
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  style={{
                    background: cardBg,
                    border: border,
                    borderRadius: radius,
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: isDark
                      ? "0 4px 16px rgba(0,0,0,0.25)"
                      : "0 2px 8px rgba(15,23,42,0.04)",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Product Card Image Placeholder */}
                  <div
                    style={{
                      ...skStyle,
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: `calc(${radius} - 4px)`,
                    }}
                  />

                  {/* Brand Placeholder */}
                  <div style={{ ...skStyle, width: "35%", height: "10px", borderRadius: "4px" }} />

                  {/* Title Placeholder */}
                  <div style={{ ...skStyle, width: "85%", height: "16px", borderRadius: "6px" }} />

                  {/* Rating Stars Placeholder */}
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div
                        key={s}
                        style={{
                          ...accentShimmerStyle,
                          width: "12px",
                          height: "12px",
                          borderRadius: "2px",
                        }}
                      />
                    ))}
                    <div style={{ ...skStyle, width: "24px", height: "10px", borderRadius: "3px", marginLeft: "4px" }} />
                  </div>

                  {/* Price Tag Placeholder */}
                  <div style={{ ...skStyle, width: "50%", height: "20px", borderRadius: "6px" }} />

                  {/* Add to Cart CTA Button Placeholder */}
                  <div
                    style={{
                      ...accentShimmerStyle,
                      width: "100%",
                      height: "38px",
                      borderRadius: "10px",
                      marginTop: "auto",
                      border: `1px solid ${accentColor}40`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StorefrontSkeleton;
