import React from "react";
import { useAdminTheme } from "../context/ThemeContext";
import { StorefrontSkeleton } from "./StorefrontSkeleton";

/**
 * Pure Monochrome (Black & White / Grayscale) Content Skeleton
 * Used strictly inside the center workspace pane of BuilderShell.
 * Does NOT render duplicate outer rails, drawers, or topbars.
 */
export const AdminContentSkeleton: React.FC = () => {
  const { isDark, tokens } = useAdminTheme();

  const shimmerGradient = isDark
    ? "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.03) 25%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.03) 75%)";

  const skStyle: React.CSSProperties = {
    backgroundImage: shimmerGradient,
    backgroundSize: "200% 100%",
    animation: "wcMonoSkShimmer 1.4s infinite linear",
    willChange: "background-position",
  };

  const cardBg = tokens.surfaceBg || (isDark ? "#18181b" : "#ffffff");
  const border = tokens.border
    ? (tokens.border.startsWith("1px") || tokens.border.startsWith("2px") ? tokens.border : `1px solid ${tokens.border}`)
    : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)");

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px",
        padding: "24px 28px",
        boxSizing: "border-box",
        background: cardBg,
        borderRadius: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @keyframes wcMonoSkShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Header Bar: Title + Search + Actions (Monochrome) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ width: "190px", height: "24px", borderRadius: "5px", ...skStyle }} />
          <div style={{ width: "270px", height: "13px", borderRadius: "4px", opacity: 0.5, ...skStyle }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "220px", height: "36px", borderRadius: "6px", border, ...skStyle }} />
          <div style={{ width: "90px", height: "36px", borderRadius: "6px", border, opacity: 0.7, ...skStyle }} />
          <div style={{ width: "120px", height: "36px", borderRadius: "6px", border, ...skStyle }} />
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div style={{ display: "flex", gap: "8px", borderBottom: border, paddingBottom: "12px" }}>
        <div style={{ width: "70px", height: "28px", borderRadius: "6px", ...skStyle }} />
        <div style={{ width: "95px", height: "28px", borderRadius: "6px", opacity: 0.5, ...skStyle }} />
        <div style={{ width: "110px", height: "28px", borderRadius: "6px", opacity: 0.5, ...skStyle }} />
        <div style={{ width: "85px", height: "28px", borderRadius: "6px", opacity: 0.5, ...skStyle }} />
      </div>

      {/* Table / List Card Skeleton (Pure monochrome) */}
      <div
        style={{
          flex: 1,
          borderRadius: "8px",
          border,
          background: isDark ? "rgba(255,255,255,0.015)" : "rgba(15,23,42,0.015)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            height: "44px",
            borderBottom: border,
            background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)",
            display: "grid",
            gridTemplateColumns: "48px 2.5fr 1.5fr 1fr 1fr 90px",
            alignItems: "center",
            padding: "0 16px",
            gap: "12px",
          }}
        >
          <div style={{ width: "18px", height: "18px", borderRadius: "4px", ...skStyle }} />
          <div style={{ width: "100px", height: "13px", borderRadius: "4px", ...skStyle }} />
          <div style={{ width: "80px", height: "13px", borderRadius: "4px", ...skStyle }} />
          <div style={{ width: "60px", height: "13px", borderRadius: "4px", ...skStyle }} />
          <div style={{ width: "70px", height: "13px", borderRadius: "4px", ...skStyle }} />
          <div style={{ width: "40px", height: "13px", borderRadius: "4px", ...skStyle }} />
        </div>

        {/* Table Body Rows */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              height: "56px",
              borderBottom: i < 5 ? border : "none",
              display: "grid",
              gridTemplateColumns: "48px 2.5fr 1.5fr 1fr 1fr 90px",
              alignItems: "center",
              padding: "0 16px",
              gap: "12px",
              opacity: 1 - i * 0.1,
            }}
          >
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", ...skStyle }} />
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "6px", flexShrink: 0, ...skStyle }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "75%" }}>
                <div style={{ width: "90%", height: "13px", borderRadius: "4px", ...skStyle }} />
                <div style={{ width: "50%", height: "10px", borderRadius: "3px", opacity: 0.5, ...skStyle }} />
              </div>
            </div>
            <div style={{ width: "70%", height: "12px", borderRadius: "4px", ...skStyle }} />
            <div style={{ width: "55%", height: "13px", borderRadius: "4px", ...skStyle }} />
            <div style={{ width: "64px", height: "22px", borderRadius: "11px", ...skStyle }} />
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", ...skStyle }} />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Full Shell Skeleton (Used only at Root level before React mounts the shell)
 * Pure Monochrome (Black & White), matching real BuilderShell.tsx geometry to the pixel.
 */
export const AdminWorkspaceSkeleton: React.FC = () => {
  const { isDark, tokens } = useAdminTheme();

  const shimmerGradient = isDark
    ? "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.03) 25%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.03) 75%)";

  const skStyle: React.CSSProperties = {
    backgroundImage: shimmerGradient,
    backgroundSize: "200% 100%",
    animation: "wcMonoSkShimmer 1.4s infinite linear",
    willChange: "background-position",
  };

  const barBg = tokens.surfaceBg || (isDark ? "#18181b" : "#ffffff");
  const workspaceBg = tokens.workspaceBg || (isDark ? "#121214" : "#f1f5f9");
  const border = tokens.border
    ? (tokens.border.startsWith("1px") || tokens.border.startsWith("2px") ? tokens.border : `1px solid ${tokens.border}`)
    : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.08)");

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateRows: "64px minmax(0, 1fr)",
        gridTemplateColumns: "auto minmax(0, 1fr) 0px",
        background: workspaceBg,
        color: tokens.textPrimary || (isDark ? "#f8fafc" : "#0f172a"),
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes wcMonoSkShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Topbar: 64px, pure monochrome matching BuilderTopControlBar */}
      <header
        style={{
          gridRow: "1 / 2",
          gridColumn: "1 / -1",
          height: "64px",
          minHeight: "64px",
          background: barBg,
          borderBottom: border,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          boxSizing: "border-box",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0, ...skStyle }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "86px", height: "16px", borderRadius: "4px", ...skStyle }} />
            <div style={{ width: "6px", height: "14px", borderRadius: "2px", opacity: 0.4, ...skStyle }} />
            <div style={{ width: "100px", height: "14px", borderRadius: "4px", ...skStyle }} />
          </div>
        </div>

        <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)", border, borderRadius: "8px", padding: "3px", display: "inline-flex", alignItems: "center", gap: "2px" }}>
          <div style={{ width: "32px", height: "30px", borderRadius: "6px", ...skStyle }} />
          <div style={{ width: "32px", height: "30px", borderRadius: "6px", opacity: 0.4, ...skStyle }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0, ...skStyle }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ width: "90px", height: "13px", borderRadius: "3px", ...skStyle }} />
            <div style={{ width: "130px", height: "10px", borderRadius: "3px", opacity: 0.5, ...skStyle }} />
          </div>
          <div style={{ width: "28px", height: "28px", borderRadius: "6px", opacity: 0.4, ...skStyle }} />
        </div>
      </header>

      {/* Left 72px Floating Rail (Exact BuilderShell padding: 8px 0 8px 8px, borderRadius: 6px) */}
      <div
        style={{
          gridRow: "2 / 3",
          gridColumn: "1 / 2",
          display: "flex",
          alignItems: "stretch",
          minWidth: 0,
          padding: "8px 0 8px 8px",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "stretch",
            borderRadius: "6px",
            background: barBg,
            border: border,
            boxShadow: tokens.shadow || (isDark ? "0 1px 3px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(15, 23, 42, 0.08)"),
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "72px",
              minWidth: "72px",
              flexShrink: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "8px 0",
              boxSizing: "border-box",
            }}
          >
            {/* Top 5 Icons (Saved Sites, Chat, Customize, Store Control, Assets) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", width: "100%" }}>
              <div style={{ padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "100%" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "10px", ...skStyle }} />
                <div style={{ width: "44px", height: "8px", borderRadius: "2px", opacity: 0.7, ...skStyle }} />
              </div>
              <div style={{ padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "100%" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "10px", ...skStyle }} />
                <div style={{ width: "26px", height: "8px", borderRadius: "2px", opacity: 0.7, ...skStyle }} />
              </div>
              <div style={{ padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "100%" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "10px", ...skStyle }} />
                <div style={{ width: "42px", height: "8px", borderRadius: "2px", opacity: 0.7, ...skStyle }} />
              </div>
              <div style={{ padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "100%" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "10px", ...skStyle }} />
                <div style={{ width: "50px", height: "8px", borderRadius: "2px", opacity: 0.7, ...skStyle }} />
              </div>
              <div style={{ padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "100%" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "10px", ...skStyle }} />
                <div style={{ width: "32px", height: "8px", borderRadius: "2px", opacity: 0.7, ...skStyle }} />
              </div>
            </div>

            {/* Bottom 2 Icons (Settings, QR & Link) + Divider */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", width: "100%", paddingBottom: "4px" }}>
              <div style={{ width: "32px", height: "1px", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)", marginBottom: "4px" }} />
              <div style={{ padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "100%" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "10px", ...skStyle }} />
                <div style={{ width: "36px", height: "8px", borderRadius: "2px", opacity: 0.7, ...skStyle }} />
              </div>
              <div style={{ padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", width: "100%" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "10px", ...skStyle }} />
                <div style={{ width: "38px", height: "8px", borderRadius: "2px", opacity: 0.7, ...skStyle }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Stage: Exact matching BuilderShell preview container (margin: 8px, padding: 4px, borderRadius: 12px) */}
      <div
        style={{
          gridRow: "2 / 3",
          gridColumn: "2 / 3",
          minWidth: 0,
          margin: "8px",
          padding: "4px",
          borderRadius: "12px",
          background: workspaceBg,
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Custom dashed border frame around preview canvas (Matching BuilderShell.tsx) */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="12"
            ry="12"
            fill="none"
            stroke={isDark ? "#60a5fa" : "#3b82f6"}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Inner Preview Canvas: Rounded 8px, shadow, white/light canvas (Matching BuilderShell.tsx lines 562-580) */}
        <div
          style={{
            width: "100%",
            height: "100%",
            minWidth: 0,
            borderRadius: "8px",
            overflow: "hidden",
            position: "relative",
            background: isDark ? "#18181b" : "#ffffff",
            boxShadow: isDark
              ? "0 4px 20px rgba(0, 0, 0, 0.4)"
              : "0 2px 8px rgba(0, 0, 0, 0.06)",
            display: "flex",
            flexDirection: "column",
            flex: "1 0 auto",
            zIndex: 2,
          }}
        >
          {/* Storefront Navbar (Exact Picture 2) */}
          <header
            style={{
              height: "64px",
              borderBottom: border,
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: isDark ? "rgba(24, 24, 27, 0.85)" : "rgba(255, 255, 255, 0.85)",
              flexShrink: 0,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", ...skStyle }} />
              <div style={{ width: "130px", height: "18px", borderRadius: "4px", ...skStyle }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "140px", height: "34px", borderRadius: "20px", ...skStyle }} />
              <div style={{ width: "34px", height: "34px", borderRadius: "8px", ...skStyle }} />
              <div style={{ width: "34px", height: "34px", borderRadius: "8px", ...skStyle }} />
              <div style={{ width: "34px", height: "34px", borderRadius: "8px", ...skStyle }} />
            </div>
          </header>

          {/* Storefront Body: Hero Banner + Section Title + 3 Product Cards (Exact Picture 2) */}
          <div
            style={{
              padding: "24px",
              boxSizing: "border-box",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {/* Big Hero Banner */}
            <div
              style={{
                width: "100%",
                height: "200px",
                borderRadius: "16px",
                border,
                background: isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(15, 23, 42, 0.025)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "28px",
                boxSizing: "border-box",
                gap: "12px",
                flexShrink: 0,
                ...skStyle,
              }}
            >
              <div style={{ width: "110px", height: "14px", borderRadius: "4px", ...skStyle }} />
              <div style={{ width: "35%", height: "28px", borderRadius: "6px", ...skStyle }} />
            </div>

            {/* Section Title & Filter Pills */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ width: "160px", height: "22px", borderRadius: "4px", ...skStyle }} />
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ width: "100px", height: "32px", borderRadius: "8px", ...skStyle }} />
                <div style={{ width: "100px", height: "32px", borderRadius: "8px", ...skStyle }} />
              </div>
            </div>

            {/* 3 Product Cards Grid (Square image on top, title & price below) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "20px",
              }}
            >
              {[1, 2, 3].map((cardId) => (
                <div
                  key={cardId}
                  style={{
                    border,
                    borderRadius: "14px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(15, 23, 42, 0.02)",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: "10px", ...skStyle }} />
                  <div style={{ width: "45%", height: "10px", borderRadius: "3px", ...skStyle }} />
                  <div style={{ width: "85%", height: "14px", borderRadius: "4px", ...skStyle }} />
                  <div style={{ width: "40%", height: "15px", borderRadius: "4px", ...skStyle }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWorkspaceSkeleton;
