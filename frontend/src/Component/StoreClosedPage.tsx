import React, { useEffect } from "react";

export interface StoreClosedPageProps {
  slug?: string;
  storeName?: string;
}

export const StoreClosedPage: React.FC<StoreClosedPageProps> = ({
  slug,
  storeName,
}) => {
  const displayTitle = storeName || (slug ? slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Store");

  useEffect(() => {
    document.title = `${displayTitle} - Store No Longer Active`;

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
  }, [displayTitle]);

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
        backgroundColor: "#f8fafc",
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 85% 85%, rgba(239, 68, 68, 0.05) 0%, transparent 50%),
          #f8fafc
        `,
        padding: "16px 20px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient Decorative Rings */}
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          left: "-120px",
          width: "320px",
          height: "320px",
          borderRadius: "50%",
          border: "1.5px solid rgba(99, 102, 241, 0.08)",
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
          border: "1.5px solid rgba(15, 23, 42, 0.05)",
          pointerEvents: "none",
        }}
      />

      {/* Main Single-Page Focused Container */}
      <div
        style={{
          maxWidth: "740px",
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
        {/* 1. Header: Brand / Slug Name */}
        <div style={{ marginBottom: "8px" }}>
          <h2
            style={{
              margin: "0 0 2px 0",
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            {displayTitle}
          </h2>
          <div
            style={{
              fontSize: "9.5px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Storefront Decommissioned
          </div>
        </div>

        {/* 2. Hero Visual: Closed Storefront Illustration */}
        <div style={{ margin: "0 auto 6px auto", width: "100%", maxWidth: "420px" }}>
          <svg
            width="100%"
            height="170"
            viewBox="0 0 400 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: "visible" }}
          >
            <defs>
              <radialGradient id="closedAuraLight" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="awningSlateDarkLight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="awningWhiteLight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </linearGradient>
            </defs>

            {/* Aura */}
            <ellipse cx="200" cy="85" rx="130" ry="55" fill="url(#closedAuraLight)" />

            {/* Ground Line */}
            <rect x="80" y="140" width="240" height="3" rx="1.5" fill="#e2e8f0" />

            {/* Store Building */}
            <rect x="130" y="58" width="140" height="82" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Closed / Locked Door */}
            <rect x="146" y="80" width="36" height="60" rx="3" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
            <circle cx="154" cy="110" r="2.5" fill="#94a3b8" />

            {/* Closed Sign on Window */}
            <g transform="translate(195, 78)">
              <line x1="20" y1="0" x2="20" y2="12" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="50" y1="0" x2="50" y2="12" stroke="#94a3b8" strokeWidth="1.5" />
              <rect x="6" y="12" width="58" height="38" rx="6" fill="#ffffff" stroke="rgba(239, 68, 68, 0.35)" strokeWidth="1.5" />
              <text x="35" y="27" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="800" letterSpacing="0.08em">
                CLOSED
              </text>
              <text x="35" y="40" textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="600">
                Permanently
              </text>
            </g>

            {/* Crisp Awning (Slate & White) */}
            <g transform="translate(122, 32)">
              <path d="M4 32Q78 40 152 32" stroke="rgba(0,0,0,0.08)" strokeWidth="4" strokeLinecap="round" />
              
              <path d="M6 2L0 26Q11 30 22 26L20 2Z" fill="url(#awningSlateDarkLight)" />
              <path d="M20 2L22 26Q33 30 44 26L42 2Z" fill="url(#awningWhiteLight)" />
              <path d="M42 2L44 26Q55 30 66 26L64 2Z" fill="url(#awningSlateDarkLight)" />
              <path d="M64 2L66 26Q77 30 88 26L86 2Z" fill="url(#awningWhiteLight)" />
              <path d="M86 2L88 26Q99 30 110 26L108 2Z" fill="url(#awningSlateDarkLight)" />
              <path d="M108 2L110 26Q121 30 132 26L130 2Z" fill="url(#awningWhiteLight)" />
              <path d="M130 2L132 26Q143 30 154 26L148 2Z" fill="url(#awningSlateDarkLight)" />

              <path d="M4 2H150" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        {/* 3. Status Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.22)",
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
              backgroundColor: "#ef4444",
              boxShadow: "0 0 6px rgba(239, 68, 68, 0.4)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#dc2626",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Storefront No Longer Active
          </span>
        </div>

        {/* 4. Main Heading */}
        <h1
          style={{
            margin: "0 0 6px 0",
            fontSize: "23px",
            fontWeight: 800,
            lineHeight: 1.2,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          This store is no longer operating
        </h1>

        {/* 5. Subtitle */}
        <p
          style={{
            margin: "0 auto 16px auto",
            fontSize: "13px",
            lineHeight: 1.45,
            color: "#64748b",
            maxWidth: "500px",
          }}
        >
          The merchant has closed or decommissioned this storefront. This URL is no longer taking new
          orders or active customer inquiries.
        </p>

        {/* 6. Assurance Information Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            width: "100%",
            maxWidth: "680px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: "12px",
              padding: "10px 14px",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#4f46e5",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a", marginBottom: "1px" }}>
                Secure Records
              </div>
              <div style={{ fontSize: "10px", lineHeight: 1.35, color: "#64748b" }}>
                Past order receipts & records are archived safely.
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: "12px",
              padding: "10px 14px",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#ef4444",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#0f172a", marginBottom: "1px" }}>
                Orders Suspended
              </div>
              <div style={{ fontSize: "10px", lineHeight: 1.35, color: "#64748b" }}>
                New checkouts and transactions are disabled.
              </div>
            </div>
          </div>
        </div>

        {/* 7. Action Button: Back to Home */}
        <div style={{ marginBottom: "14px" }}>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#ffffff",
              background: "linear-gradient(135deg, #4f46e5, #2563eb)",
              padding: "7px 18px",
              borderRadius: "9999px",
              textDecoration: "none",
              boxShadow: "0 2px 10px rgba(37, 99, 235, 0.25)",
              transition: "transform 0.15s ease",
            }}
          >
            <span>Explore WebCreon</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* 8. Thin Divider */}
        <div
          style={{
            width: "100%",
            maxWidth: "680px",
            height: "1px",
            background: "rgba(15, 23, 42, 0.08)",
            marginBottom: "12px",
          }}
        />

        {/* 9. Brand Watermark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            color: "#64748b",
          }}
        >
          <span>Powered by</span>
          <span style={{ fontWeight: 700, color: "#0f172a", letterSpacing: "0.02em" }}>WebCreon</span>
        </div>
      </div>
    </div>
  );
};

export default StoreClosedPage;
