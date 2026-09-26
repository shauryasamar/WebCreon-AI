import React from "react";
import { useAdminTheme } from "../context/ThemeContext";

type BuilderShellProps = {
  topBar: React.ReactNode;
  leftPanel: React.ReactNode;
  drawer?: React.ReactNode;
  rightPanel?: React.ReactNode;
  children: React.ReactNode;
  previewPaneRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * When true, the center pane renders as a floating white card inset by
   * the same 8px gap used everywhere else in the shell (left panel,
   * drawer), with the shell's own workspace background showing through as
   * the visual separator. Used for admin management screens (Products /
   * Orders / Checkout Charges) so they read as an "opened form" rather
   * than a flush full-bleed page that blends into the drawer/topbar.
   */
  plainCenter?: boolean;
  deviceMode?: "desktop" | "mobile";
  deviceBg?: string;
};

const SIDE_PANEL_WIDTH = 300;

function MobileDeviceStage({
  children,
  deviceBg = "#ffffff",
}: {
  children: React.ReactNode;
  deviceBg?: string;
}) {
  const { isDark, tokens } = useAdminTheme();
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    if (!stageRef.current) return;
    const updateScale = () => {
      if (!stageRef.current) return;
      const availW = stageRef.current.clientWidth - 32;
      const availH = stageRef.current.clientHeight - 32;
      if (availW <= 0 || availH <= 0) return;

      // Chassis outer size: 390 width + 20px border = 410px; 844 height + 20px border = 864px
      const targetW = 410;
      const targetH = 864;

      const scaleX = availW / targetW;
      const scaleY = availH / targetH;
      const computedScale = Math.min(1, scaleX, scaleY);
      setScale(Math.max(0.35, Number(computedScale.toFixed(3))));
    };

    updateScale();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScale) : null;
    if (ro && stageRef.current) {
      ro.observe(stageRef.current);
    }
    window.addEventListener("resize", updateScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const preventScroll = () => {
      if (el.scrollTop !== 0) el.scrollTop = 0;
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
    };
    el.addEventListener("scroll", preventScroll, { passive: true });
    return () => el.removeEventListener("scroll", preventScroll);
  }, []);

  const scaledW = Math.round(410 * scale);
  const scaledH = Math.round(864 * scale);

  return (
    <div
      ref={stageRef}
      style={{
        gridRow: "2 / 3",
        gridColumn: "2 / 3",
        minWidth: 0,
        height: "100%",
        background: isDark ? tokens.workspaceBg : "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      {/* Outer sizing box reporting exact scaled dimensions to flex parent so stageRef has ZERO scrollable overflow */}
      <div
        style={{
          width: `${scaledW}px`,
          height: `${scaledH}px`,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "410px",
            height: "864px",
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            transition: "transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
            flexShrink: 0,
          }}
        >
          {/* Modern Smartphone Chassis */}
          <div
            className="is-mobile-preview builder-preview-stage"
            style={{
              width: "390px",
              height: "844px",
              borderRadius: "40px",
              border: "10px solid #0f172a",
              boxShadow: isDark
                ? "0 25px 60px -15px rgba(0, 0, 0, 0.65)"
                : "0 25px 60px -15px rgba(15, 23, 42, 0.35)",
              background: "#0f172a",
              backgroundClip: "padding-box",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              boxSizing: "content-box",
            }}
          >
            <div
              className="is-mobile-preview builder-preview-stage"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "30px",
                overflow: "hidden",
                position: "relative",
                background: deviceBg || "#ffffff",
                WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                isolation: "isolate",
                transform: "translateZ(0)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BuilderShell({
  topBar,
  leftPanel,
  drawer,
  rightPanel,
  children,
  previewPaneRef,
  plainCenter = false,
  deviceMode = "desktop",
  deviceBg,
}: BuilderShellProps) {
  const { isDark, tokens } = useAdminTheme();
  const hasAdminChrome = Boolean(topBar || leftPanel || rightPanel || drawer);
  const hasRightPanel = Boolean(rightPanel);

  // Maintain drawer content during collapse animation to prevent border pops or white flash
  const [cachedDrawer, setCachedDrawer] = React.useState<React.ReactNode>(drawer);
  const isDrawerOpen = Boolean(drawer);
  const activeDrawerNode = drawer || cachedDrawer;

  React.useEffect(() => {
    if (drawer) {
      setCachedDrawer(drawer);
    } else {
      const timer = setTimeout(() => {
        setCachedDrawer(null);
      }, 230);
      return () => clearTimeout(timer);
    }
  }, [drawer]);

  if (!hasAdminChrome) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateRows: "64px minmax(0, 1fr)",
        gridTemplateColumns: hasRightPanel
          ? `auto minmax(0, 1fr) ${SIDE_PANEL_WIDTH}px`
          : "auto minmax(0, 1fr) 0px",
        background: tokens.workspaceBg,
        color: tokens.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
        transition: "grid-template-columns 0.22s ease, background 0.2s ease",
      }}
    >
      <style>{`
        .builder-preview-scroll,
        .builder-preview-stage {
          overscroll-behavior: contain !important;
        }

        .builder-preview-scroll,
        .builder-preview-scroll *,
        .builder-preview-stage,
        .builder-preview-stage * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }

        .builder-preview-scroll::-webkit-scrollbar,
        .builder-preview-scroll *::-webkit-scrollbar,
        .builder-preview-stage::-webkit-scrollbar,
        .builder-preview-stage *::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
          background: transparent !important;
        }
      `}</style>

      <header
        style={{
          gridRow: "1 / 2",
          gridColumn: "1 / 4",
          borderBottom: `1px solid ${tokens.border}`,
          background: tokens.surfaceBg,
          height: "64px",
          minHeight: "64px",
          position: "relative",
          zIndex: 50,
          transition: "background 0.2s ease, border-color 0.2s ease",
        }}
      >
        {topBar}
      </header>

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
        }}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "stretch",
            borderRadius: "6px",
            background: tokens.surfaceBg,
            border: isDark ? `1px solid ${tokens.border}` : "none",
            boxShadow: tokens.shadow,
            overflow: "hidden",
            transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          {/* LEFT ICON PANEL */}
          <div
            style={{
              width: 72,
              minWidth: 72,
              flexShrink: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            {leftPanel}
          </div>

          {/* DRAWER SECTION */}
          <div
            style={{
              height: "100%",
              width: isDrawerOpen ? `${SIDE_PANEL_WIDTH}px` : "0px",
              transition: "width 0.22s cubic-bezier(0.2, 0, 0, 1)",
              overflow: "hidden",
              flexShrink: 0,
              boxSizing: "border-box",
              borderLeft: isDrawerOpen ? `1px solid ${tokens.divider}` : "none",
            }}
          >
            {activeDrawerNode && (
              <div
                style={{
                  width: `${SIDE_PANEL_WIDTH}px`,
                  minWidth: `${SIDE_PANEL_WIDTH}px`,
                  height: "100%",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                {activeDrawerNode}
              </div>
            )}
          </div>
        </div>
      </div>

      {plainCenter ? (
        <div
          ref={previewPaneRef}
          style={{
            gridRow: "2 / 3",
            gridColumn: "2 / 3",
            minWidth: 0,
            margin: "8px",
            borderRadius: "8px",
            background: tokens.surfaceBg,
            border: isDark ? `1px solid ${tokens.border}` : "none",
            boxShadow: tokens.shadow,
            overflow: "hidden",
            position: "relative",
            zIndex: 10,
            transition: "background 0.2s ease, border-color 0.2s ease",
          }}
        >
          <main
            className="builder-preview-scroll"
            style={{
              height: "100%",
              width: "100%",
              minWidth: 0,
              overflowY: "auto",
              overflowX: "hidden",
              background: tokens.surfaceBg,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {children}
          </main>
        </div>
      ) : deviceMode === "mobile" ? (
        <MobileDeviceStage deviceBg={deviceBg}>
          <div
            ref={previewPaneRef}
            className="is-mobile-preview builder-preview-stage"
            style={{
              width: "100%",
              height: "100%",
              minWidth: 0,
              overflow: "hidden",
              position: "relative",
              transform: "translateZ(0)",
              background: deviceBg || "#ffffff",
              display: "flex",
              flexDirection: "column",
              flex: "1 0 auto",
            }}
          >
            <main
              className="builder-preview-scroll is-mobile-preview builder-preview-stage"
              style={{
                height: "100%",
                width: "100%",
                minWidth: 0,
                overflowY: "auto",
                overflowX: "hidden",
                position: "relative",
                background: deviceBg || "#ffffff",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                display: "flex",
                flexDirection: "column",
                flex: "1 0 auto",
              }}
            >
              {children}
            </main>
          </div>
        </MobileDeviceStage>
      ) : (
        <div
          style={{
            gridRow: "2 / 3",
            gridColumn: "2 / 3",
            minWidth: 0,
            margin: "8px",
            padding: "4px",
            borderRadius: "12px",
            background: isDark ? tokens.workspaceBg : "#f1f5f9",
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            transition: "background 0.2s ease, border-color 0.2s ease",
          }}
        >
          {/* Custom border framing around the storefront */}
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
          {/*
            Inner pane: this is the real fixed-position containing block
            via transform. It has zero padding of its own, so the fixed
            navbar and the normal-flow storefront content both measure
            against the exact same box and stay perfectly aligned.
          */}
          <div
            ref={previewPaneRef}
            style={{
              width: "100%",
              height: "100%",
              minWidth: 0,
              borderRadius: "8px",
              overflow: "hidden",
              position: "relative",
              transform: "translateZ(0)",
              background: deviceBg || (isDark ? tokens.workspaceBg : "#ffffff"),
              boxShadow: isDark
                ? "0 4px 20px rgba(0, 0, 0, 0.4)"
                : "0 2px 8px rgba(0, 0, 0, 0.06)",
              display: "flex",
              flexDirection: "column",
              flex: "1 0 auto",
              zIndex: 2,
            }}
          >
            <main
              className="builder-preview-scroll"
              style={{
                height: "100%",
                width: "100%",
                minWidth: 0,
                overflowY: "auto",
                overflowX: "hidden",
                position: "relative",
                background: deviceBg || (isDark ? tokens.workspaceBg : "#ffffff"),
                display: "flex",
                flexDirection: "column",
                flex: "1 0 auto",
              }}
            >
              {children}
            </main>
          </div>
        </div>
      )}

      <aside
        style={{
          gridRow: "2 / 3",
          gridColumn: "3 / 4",
          width: hasRightPanel ? `${SIDE_PANEL_WIDTH}px` : "0px",
          maxWidth: hasRightPanel ? `${SIDE_PANEL_WIDTH}px` : "0px",
          height: "100%",
          overflow: "hidden",
          minWidth: 0,
          opacity: hasRightPanel ? 1 : 0,
          pointerEvents: hasRightPanel ? "auto" : "none",
          transition: "width 0.22s ease, opacity 0.22s ease",
        }}
      >
        {rightPanel}
      </aside>
    </div>
  );
}