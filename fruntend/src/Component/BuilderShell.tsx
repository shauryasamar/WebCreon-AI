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
};

export default function BuilderShell({
  topBar,
  leftPanel,
  drawer,
  rightPanel,
  children,
  previewPaneRef,
  plainCenter = false,
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
          ? "auto minmax(0, 1fr) 20vw"
          : "auto minmax(0, 1fr) 0px",
        background: "#f8fafc",
        color: "#0f172a",
        overflow: "hidden",
        transition: "grid-template-columns 0.22s ease",
      }}
    >
      <style>{`
        .builder-preview-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .builder-preview-scroll::-webkit-scrollbar {
          display: none;
          width: 0px;
          height: 0px;
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
            width: drawer ? "300px" : "0px",
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
                  width: 299,
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
      ) : (
        <div
          style={{
            gridRow: "2 / 3",
            gridColumn: "2 / 3",
            minWidth: 0,
            margin: "8px",
            padding: "8px",
            border: "2px dashed #2563eb",
            borderRadius: "8px",
            background: "transparent",
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
              overflow: "hidden",
              position: "relative",
              transform: "translateZ(0)",
            }}
          >
            <main
              className="builder-preview-scroll"
              style={{
                height: "100%",
                minWidth: 0,
                overflow: "auto",
                position: "relative",
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
          width: hasRightPanel ? "20vw" : "0px",
          maxWidth: hasRightPanel ? "20vw" : "0px",
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