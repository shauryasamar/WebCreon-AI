import { useMemo } from "react";

type BuilderTopControlBarProps = {
  siteName: string;
  onGoDashboard: () => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
};

export default function BuilderTopControlBar({ siteName, onGoDashboard, onLogout, userName, userEmail, avatarUrl }: BuilderTopControlBarProps) {
  const initials = useMemo(() => {
    const source = (userName || userEmail || "W").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || "W"}${parts[1][0] || "N"}`.toUpperCase();
    return (source[0] || "W").toUpperCase();
  }, [userEmail, userName]);

  return (
    <header style={{ height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "#ffffff" }}>
      <button type="button" onClick={onGoDashboard} style={{ display: "flex", alignItems: "center", gap: "10px", border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "11px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "grid", placeItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: "11px", letterSpacing: "0.04em" }}>WN</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", letterSpacing: "0.04em" }}>WEB NIRMAAN</span>
          <span style={{ color: "rgba(15,23,42,0.35)", fontWeight: 700 }}>›</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>{siteName || "Current Website"}</span>
        </div>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "999px", background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #cbd5e1, #94a3b8)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 800, color: "#0f172a", flexShrink: 0 }}>
            {avatarUrl ? <img src={avatarUrl} alt={userName || "User avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>{userName || "User"}</span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>{userEmail || "user@example.com"}</span>
          </div>
        </div>

        <button type="button" onClick={onLogout} title="Logout" style={{ width: "38px", height: "38px", borderRadius: "12px", border: "1px solid rgba(15,23,42,0.08)", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center", color: "#0f172a" }}>
          <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
        </button>
      </div>
    </header>
  );
}
