import React from "react";

export interface FestiveBackgroundOverlayProps {
  festivalTheme?: string;
  isDark?: boolean;
  backgroundColor?: string;
}

function checkIsDark(colorHex?: string, isDarkProp?: boolean): boolean {
  if (typeof isDarkProp === "boolean") return isDarkProp;
  if (!colorHex || typeof colorHex !== "string") return false;
  if (colorHex.startsWith("rgb")) {
    const match = colorHex.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return r * 0.299 + g * 0.587 + b * 0.114 < 160;
    }
  }
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 160;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 160;
  }
  return false;
}

export const FestiveBackgroundOverlay: React.FC<FestiveBackgroundOverlayProps> = ({
  festivalTheme,
  isDark: isDarkProp,
  backgroundColor,
}) => {
  if (!festivalTheme || festivalTheme === "none") return null;

  const isDark = checkIsDark(backgroundColor, isDarkProp);

  return (
    <div
      className="wc-festive-atmosphere"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* 🪔 1. DIWALI AMBIENCE */}
      {festivalTheme === "diwali" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40px",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "flex-start",
            opacity: isDark ? 0.4 : 0.25,
          }}
        >
          {[...Array(16)].map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "1px", height: i % 2 === 0 ? "12px" : "20px", background: isDark ? "#fbbf24" : "#b45309" }} />
              <div
                style={{
                  width: "7px",
                  height: "9px",
                  borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                  background: i % 3 === 0 ? "#fef08a" : i % 2 === 0 ? "#f59e0b" : "#ea580c",
                  boxShadow: isDark ? "0 0 8px #fbbf24" : "0 0 4px #d97706",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 🎨 2. HOLI AMBIENCE */}
      {festivalTheme === "holi" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "linear-gradient(90deg, #ec4899 0%, #a855f7 25%, #06b6d4 50%, #f59e0b 75%, #ec4899 100%)",
            opacity: isDark ? 0.8 : 0.6,
          }}
        />
      )}

      {/* 🔱 3. DURGA PUJA AMBIENCE */}
      {festivalTheme === "durga_puja" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "linear-gradient(90deg, #dc2626 0%, #facc15 50%, #dc2626 100%)",
            opacity: isDark ? 0.85 : 0.65,
          }}
        />
      )}

      {/* 🧵 4. RAKHI AMBIENCE */}
      {festivalTheme === "rakhi" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "linear-gradient(90deg, #f59e0b 0%, #dc2626 50%, #f59e0b 100%)",
            opacity: isDark ? 0.85 : 0.65,
          }}
        />
      )}

      {/* 🎄 5. CHRISTMAS AMBIENCE */}
      {festivalTheme === "christmas" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "36px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            opacity: isDark ? 0.4 : 0.25,
            padding: "0 10px",
          }}
        >
          {[...Array(16)].map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "1px", height: i % 2 === 0 ? "12px" : "18px", background: isDark ? "#34d399" : "#047857" }} />
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: i % 3 === 0 ? "#ef4444" : isDark ? "#f0fdf4" : "#059669",
                  boxShadow: i % 3 === 0 ? "0 0 6px #ef4444" : "0 0 4px rgba(255,255,255,0.4)",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 🌙 6. EID AMBIENCE */}
      {festivalTheme === "eid" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40px",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "flex-start",
            opacity: isDark ? 0.4 : 0.25,
          }}
        >
          {[...Array(10)].map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "1px", height: i % 2 === 0 ? "14px" : "22px", background: isDark ? "#2dd4bf" : "#0d9488", borderStyle: "dashed" }} />
              <div
                style={{
                  width: "10px",
                  height: "14px",
                  borderRadius: "2px 2px 50% 50%",
                  background: isDark ? "rgba(45,212,191,0.3)" : "rgba(13,148,136,0.25)",
                  border: `1px solid ${isDark ? "#facc15" : "#d97706"}`,
                  boxShadow: isDark ? "0 0 6px #facc15" : "0 0 3px #d97706",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FestiveBackgroundOverlay;
