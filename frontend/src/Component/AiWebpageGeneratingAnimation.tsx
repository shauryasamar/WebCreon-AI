import React, { useEffect, useState, useRef } from "react";

type AiWebpageGeneratingAnimationProps = {
  brandName?: string;
  themeMode?: "light" | "dark";
  progress?: number;
  currentMessage?: string;
};

const DEFAULT_STEPS = [
  "Analyzing brand niche and requirements...",
  "Synthesizing navigation hierarchy and header...",
  "Structuring product layout and catalog bindings...",
  "Compiling design tokens and theme styling...",
  "Finalizing production-ready storefront...",
];

export const AiWebpageGeneratingAnimation: React.FC<AiWebpageGeneratingAnimationProps> = ({
  brandName = "Your Store",
  themeMode = "light",
  progress: externalProgress,
  currentMessage: externalMessage,
}) => {
  const isDark = themeMode === "dark";
  
  // Progress strictly starts at 0%
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  // Target progress reference to allow smooth fluid interpolation
  const targetProgress = typeof externalProgress === "number" ? externalProgress : 0;
  const targetRef = useRef(targetProgress);
  targetRef.current = targetProgress;

  useEffect(() => {
    // Smooth interpolation towards targetProgress
    const interval = setInterval(() => {
      setDisplayedProgress((current) => {
        const target = targetRef.current;
        if (typeof externalProgress === "number") {
          if (current < target) {
            const step = Math.max(1, Math.ceil((target - current) * 0.18));
            return Math.min(target, current + step);
          } else if (current > target) {
            return target;
          }
          return current;
        }

        // If no external progress provided, gently advance up to 92%
        if (current < 92) {
          return current + 1;
        }
        return current;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [externalProgress]);

  // Sync step message based on progress or external input
  useEffect(() => {
    if (externalMessage) return;

    if (displayedProgress < 20) setStepIndex(0);
    else if (displayedProgress < 45) setStepIndex(1);
    else if (displayedProgress < 70) setStepIndex(2);
    else if (displayedProgress < 90) setStepIndex(3);
    else setStepIndex(4);
  }, [displayedProgress, externalMessage]);

  const activeMessage = externalMessage || DEFAULT_STEPS[stepIndex];

  // WebCreon Brand Color System: Max 4-5 focused colors
  // 1. Primary Blue: #0f62ab (Light) / #3b82f6 (Dark)
  // 2. Amber Accent: #ffaa00
  // 3. Base Background: #ffffff / #0b0f19
  // 4. Elevated Surface: #f8fafc / #111827
  // 5. High-contrast Text: #0f172a / #f8fafc with Slate secondary #64748b / #94a3b8

  const brandBlue = isDark ? "#3b82f6" : "#0f62ab";
  const brandAmber = "#ffaa00";

  const containerBg = isDark ? "#0b0f19" : "#ffffff";
  const containerBorder = isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(15, 23, 42, 0.1)";
  const shadowStyle = isDark
    ? "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 1px rgba(59, 130, 246, 0.2)"
    : "0 8px 24px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)";

  const headerBg = isDark ? "rgba(255, 255, 255, 0.02)" : "#f8fafc";
  const headerBorder = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)";
  
  const textColor = isDark ? "#f8fafc" : "#0f172a";
  const subtextColor = isDark ? "#94a3b8" : "#64748b";

  const wireframeCanvasBg = isDark ? "#111827" : "#f8fafc";
  const wireframeBorder = isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(15, 23, 42, 0.08)";
  const wireframeBlockBg = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.05)";
  const wireframePillBg = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.15)";

  const roundedPct = Math.round(displayedProgress);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "460px",
        margin: "8px 0",
        borderRadius: "14px",
        background: containerBg,
        border: containerBorder,
        boxShadow: shadowStyle,
        overflow: "hidden",
        color: textColor,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes webcreonPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes subtleScan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(320%); }
        }
      `}</style>

      {/* Header Bar */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${headerBorder}`,
          background: headerBg,
        }}
      >
        {/* Brand Logo Lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ color: brandBlue }}>WEB</span>
            <span style={{ color: brandAmber }}>CREON</span>
          </div>
          <span style={{ fontSize: "11px", color: subtextColor, fontWeight: 500 }}>
            · Engine
          </span>
        </div>

        {/* Status Pill */}
        <div
          style={{
            padding: "3px 9px",
            borderRadius: "999px",
            background: isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(15, 98, 171, 0.08)",
            border: isDark ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid rgba(15, 98, 171, 0.18)",
            fontSize: "10px",
            color: brandBlue,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            letterSpacing: "0.3px",
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: brandAmber,
              boxShadow: `0 0 5px ${brandAmber}`,
              animation: "webcreonPulse 1.8s ease-in-out infinite",
            }}
          />
          GENERATING STORE
        </div>
      </div>

      {/* Main Body */}
      <div style={{ padding: "14px 16px" }}>
        {/* Header Text & Accurate % */}
        <div style={{ marginBottom: "10px", textAlign: "left" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: textColor,
              marginBottom: "3px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              Building <span style={{ color: brandBlue }}>{brandName}</span>
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: brandBlue,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {roundedPct}%
            </div>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: subtextColor,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ color: subtextColor, fontWeight: 600 }}>Step:</span>
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: textColor,
              }}
            >
              {activeMessage}
            </span>
          </div>
        </div>

        {/* Clean, Accurate Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            borderRadius: "999px",
            background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(Math.max(roundedPct, 0), 100)}%`,
              background: brandBlue,
              borderRadius: "999px",
              transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        {/* Minimalist Webpage Blueprint */}
        <div
          style={{
            borderRadius: "10px",
            border: wireframeBorder,
            background: wireframeCanvasBg,
            padding: "10px",
            position: "relative",
            overflow: "hidden",
            display: "grid",
            gap: "8px",
          }}
        >
          {/* Subtle Neutral Scanning Line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "22px",
              background: isDark
                ? "linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 100%)"
                : "linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0) 100%)",
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(15, 23, 42, 0.12)",
              opacity: 0.6,
              pointerEvents: "none",
              zIndex: 10,
              animation: "subtleScan 2.4s ease-in-out infinite",
            }}
          />

          {/* Wireframe Navbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: "6px",
              background: wireframeBlockBg,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "3px",
                  background: wireframePillBg,
                }}
              />
              <div
                style={{
                  width: "48px",
                  height: "5px",
                  borderRadius: "3px",
                  background: wireframePillBg,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <div
                style={{
                  width: "22px",
                  height: "5px",
                  borderRadius: "3px",
                  background: wireframePillBg,
                }}
              />
              <div
                style={{
                  width: "22px",
                  height: "5px",
                  borderRadius: "3px",
                  background: wireframePillBg,
                }}
              />
            </div>
          </div>

          {/* Wireframe Hero Banner */}
          <div
            style={{
              padding: "12px 10px",
              borderRadius: "6px",
              background: wireframeBlockBg,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "6px",
                borderRadius: "3px",
                background: wireframePillBg,
              }}
            />
            <div
              style={{
                width: "70%",
                height: "8px",
                borderRadius: "3px",
                background: wireframePillBg,
              }}
            />
            <div
              style={{
                width: "45%",
                height: "5px",
                borderRadius: "3px",
                background: wireframePillBg,
              }}
            />
            <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
              <div
                style={{
                  width: "50px",
                  height: "16px",
                  borderRadius: "4px",
                  background: isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(15, 23, 42, 0.16)",
                }}
              />
              <div
                style={{
                  width: "36px",
                  height: "16px",
                  borderRadius: "4px",
                  background: wireframePillBg,
                }}
              />
            </div>
          </div>

          {/* Wireframe Product Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            {[1, 2, 3].map((cardIdx) => (
              <div
                key={cardIdx}
                style={{
                  padding: "6px",
                  borderRadius: "6px",
                  background: wireframeBlockBg,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    height: "28px",
                    borderRadius: "4px",
                    background: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(15, 23, 42, 0.07)",
                  }}
                />
                <div
                  style={{
                    width: "75%",
                    height: "4px",
                    borderRadius: "2px",
                    background: wireframePillBg,
                  }}
                />
                <div
                  style={{
                    width: "35%",
                    height: "4px",
                    borderRadius: "2px",
                    background: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.25)",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
