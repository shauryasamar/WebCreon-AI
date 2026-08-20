import React, { useEffect, useState } from "react";

type AiWebpageGeneratingAnimationProps = {
  brandName?: string;
  themeMode?: "light" | "dark";
  progress?: number;
  currentMessage?: string;
};

const DEFAULT_STEPS = [
  "Analyzing Brand Vibe & WCAG Palette Tokens...",
  "Synthesizing Responsive Navbar & Layout Specs...",
  "Structuring Product Catalog & Data Bindings...",
  "Compiling Theme Tokens & Page Definitions...",
  "Finalizing Webpage Blueprint...",
];

export const AiWebpageGeneratingAnimation: React.FC<AiWebpageGeneratingAnimationProps> = ({
  brandName = "Your Website",
  themeMode = "light",
  progress: externalProgress,
  currentMessage: externalMessage,
}) => {
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const [internalProgress, setInternalProgress] = useState(15);

  const isDark = themeMode === "dark";

  useEffect(() => {
    if (typeof externalProgress === "number") {
      setInternalProgress(externalProgress);
      return;
    }

    const stepInterval = setInterval(() => {
      setInternalStepIndex((prev) => {
        if (prev < DEFAULT_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 900);

    const progressInterval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev < 92) return prev + Math.floor(Math.random() * 6) + 4;
        return 96;
      });
    }, 150);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [externalProgress]);

  const activeProgress = typeof externalProgress === "number" ? externalProgress : internalProgress;
  const activeMessage =
    externalMessage || DEFAULT_STEPS[Math.min(internalStepIndex, DEFAULT_STEPS.length - 1)];

  // Theme-aware tokens
  const containerBg = isDark
    ? "linear-gradient(145deg, #0b0f19 0%, #111827 100%)"
    : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)";

  const containerBorder = isDark
    ? "1px solid rgba(99, 102, 241, 0.3)"
    : "1px solid rgba(15, 23, 42, 0.12)";

  const shadowStyle = isDark
    ? "0 12px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.12)"
    : "0 10px 30px rgba(15, 23, 42, 0.08), 0 0 15px rgba(37, 99, 235, 0.06)";

  const headerBg = isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(241, 245, 249, 0.8)";
  const headerBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)";
  const textColor = isDark ? "#ffffff" : "#0f172a";
  const subtextColor = isDark ? "#94a3b8" : "#64748b";
  const wireframeBg = isDark ? "#080c14" : "#f1f5f9";
  const wireframeBorder = isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(15, 23, 42, 0.08)";
  const wireframeBlockBg = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)";
  const wireframePillBg = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.2)";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "460px",
        margin: "10px 0",
        borderRadius: "16px",
        background: containerBg,
        border: containerBorder,
        boxShadow: shadowStyle,
        overflow: "hidden",
        color: textColor,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        position: "relative",
      }}
    >
      {/* Top Laser Shimmer Bar */}
      <div
        style={{
          height: "2.5px",
          width: "100%",
          background: "linear-gradient(90deg, #2563eb, #ec4899, #10b981, #2563eb)",
          backgroundSize: "200% 100%",
          animation: "aiLaserShimmer 2s linear infinite",
        }}
      />

      <style>{`
        @keyframes aiLaserShimmer {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
        @keyframes aiScanBeam {
          0% { transform: translateY(-100%); opacity: 0.2; }
          50% { opacity: 0.7; }
          100% { transform: translateY(280%); opacity: 0.2; }
        }
        @keyframes aiPulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.08); }
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
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
          <span style={{ marginLeft: "6px", fontSize: "11px", color: subtextColor, fontWeight: 600 }}>
            WebCreon AI Engine
          </span>
        </div>

        <div
          style={{
            padding: "3px 10px",
            borderRadius: "999px",
            background: isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(37, 99, 235, 0.1)",
            border: isDark ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid rgba(37, 99, 235, 0.25)",
            fontSize: "10px",
            color: isDark ? "#818cf8" : "#2563eb",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            letterSpacing: "0.4px",
          }}
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: isDark ? "#818cf8" : "#2563eb",
              boxShadow: isDark ? "0 0 6px #818cf8" : "0 0 6px #2563eb",
              animation: "aiPulseGlow 1.5s infinite",
            }}
          />
          GENERATING WEBPAGE
        </div>
      </div>

      {/* Main Content & Wireframe Simulation */}
      <div style={{ padding: "14px 16px" }}>
        {/* Status Header */}
        <div style={{ marginBottom: "10px", textAlign: "left" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, color: textColor, marginBottom: "2px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              Building <span style={{ color: isDark ? "#a5b4fc" : "#2563eb" }}>{brandName}</span>
            </div>
            <div style={{ fontSize: "12px", fontWeight: 800, color: isDark ? "#38bdf8" : "#2563eb" }}>
              {Math.round(activeProgress)}%
            </div>
          </div>
          <div style={{ fontSize: "12px", color: subtextColor, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: isDark ? "#38bdf8" : "#0284c7", fontWeight: 700 }}>
              AI Pipeline:
            </span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeMessage}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "5px",
            borderRadius: "999px",
            background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(activeProgress, 100)}%`,
              background: "linear-gradient(90deg, #2563eb 0%, #ec4899 50%, #10b981 100%)",
              borderRadius: "999px",
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        {/* Compact Animated Webpage Blueprint Container */}
        <div
          style={{
            borderRadius: "10px",
            border: wireframeBorder,
            background: wireframeBg,
            padding: "10px",
            position: "relative",
            overflow: "hidden",
            display: "grid",
            gap: "8px",
          }}
        >
          {/* Laser Scanning Line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "30px",
              background: isDark
                ? "linear-gradient(180deg, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0) 100%)"
                : "linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, rgba(37, 99, 235, 0) 100%)",
              borderBottom: isDark ? "1.5px solid rgba(99, 102, 241, 0.5)" : "1.5px solid rgba(37, 99, 235, 0.4)",
              pointerEvents: "none",
              zIndex: 10,
              animation: "aiScanBeam 2s ease-in-out infinite",
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
              <div style={{ width: "16px", height: "16px", borderRadius: "4px", background: "linear-gradient(135deg, #2563eb, #ec4899)" }} />
              <div style={{ width: "50px", height: "6px", borderRadius: "3px", background: wireframePillBg }} />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <div style={{ width: "24px", height: "6px", borderRadius: "3px", background: wireframePillBg }} />
              <div style={{ width: "24px", height: "6px", borderRadius: "3px", background: wireframePillBg }} />
            </div>
          </div>

          {/* Wireframe Hero Banner */}
          <div
            style={{
              padding: "12px 10px",
              borderRadius: "8px",
              background: isDark
                ? "linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(236, 72, 153, 0.08) 100%)"
                : "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(236, 72, 153, 0.05) 100%)",
              border: isDark ? "1px solid rgba(99, 102, 241, 0.2)" : "1px solid rgba(37, 99, 235, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              alignItems: "flex-start",
            }}
          >
            <div style={{ width: "60px", height: "10px", borderRadius: "999px", background: isDark ? "rgba(99, 102, 241, 0.4)" : "rgba(37, 99, 235, 0.3)" }} />
            <div style={{ width: "70%", height: "10px", borderRadius: "3px", background: wireframePillBg }} />
            <div style={{ width: "45%", height: "5px", borderRadius: "3px", background: wireframePillBg }} />
            <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
              <div style={{ width: "55px", height: "18px", borderRadius: "6px", background: "linear-gradient(90deg, #2563eb, #1d4ed8)" }} />
              <div style={{ width: "40px", height: "18px", borderRadius: "6px", background: wireframeBlockBg }} />
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
                <div style={{ height: "30px", borderRadius: "4px", background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)" }} />
                <div style={{ width: "75%", height: "5px", borderRadius: "2px", background: wireframePillBg }} />
                <div style={{ width: "40%", height: "5px", borderRadius: "2px", background: "rgba(16, 185, 129, 0.6)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
