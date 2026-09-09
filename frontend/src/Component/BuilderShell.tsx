import React from "react";

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
   * drawer), with the shell's own #f8fafc background showing through as
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
        background: "#f1f5f9",
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
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.35)",
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
  const hasAdminChrome = Boolean(topBar || leftPanel || rightPanel || drawer);
  const hasRightPanel = Boolean(rightPanel);

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
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
        transition: "grid-template-columns 0.22s ease",
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
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          background: "#ffffff",
          height: "64px",
          minHeight: "64px",
          position: "relative",
          zIndex: 50,
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
            width: 72,
            flexShrink: 0,
            height: "100%",
            borderRadius: drawer ? "6px 0 0 6px" : "6px",
            background: "#ffffff",
            boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "8px 0",
            overflow: "hidden",
          }}
        >
          {leftPanel}
        </div>

        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "stretch",
            transition: "width 0.22s ease, opacity 0.22s ease",
            width: drawer ? `${SIDE_PANEL_WIDTH}px` : "0px",
            opacity: drawer ? 1 : 0,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {drawer && (
            <>
              <div
                style={{
                  width: 1,
                  background: "rgba(15,23,42,0.08)",
                  alignSelf: "stretch",
                  flexShrink: 0,
                }}
              />

              <div
                style={{
                  width: SIDE_PANEL_WIDTH - 1,
                  height: "100%",
                  borderRadius: "0 6px 6px 0",
                  background: "#ffffff",
                  boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
                  transform: drawer ? "translateX(0)" : "translateX(-8px)",
                  transition: "transform 0.22s ease",
                  overflow: "hidden",
                }}
              >
                {drawer}
              </div>
            </>
          )}
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
            background: "#ffffff",
            boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
            overflow: "hidden",
            position: "relative",
            zIndex: 10,
          }}
        >
          <main
            className="builder-preview-scroll"
            style={{
              height: "100%",
              minWidth: 0,
              overflow: "auto",
              background: "#ffffff",
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
            border: "2px dashed #2563eb",
            borderRadius: "8px",
            background: deviceBg || "#ffffff",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
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
              borderRadius: "6px",
              overflow: "hidden",
              position: "relative",
              transform: "translateZ(0)",
              background: deviceBg || "#ffffff",
            }}
          >
            <main
              className="builder-preview-scroll"
              style={{
                height: "100%",
                minWidth: 0,
                overflow: "auto",
                position: "relative",
                background: deviceBg || "#ffffff",
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