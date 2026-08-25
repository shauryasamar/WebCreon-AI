import { useMemo, useState } from "react";
import WebCreonAnimatedLogo from "./WebCreonAnimatedLogo";
import { UserAvatar } from "./UserAvatar";

type BuilderTopControlBarProps = {
  siteName: string;
  onGoDashboard: () => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
  gender?: string;
};

export default function BuilderTopControlBar({
  siteName,
  onGoDashboard,
  onLogout,
  userName,
  userEmail,
  avatarUrl,
  gender,
}: BuilderTopControlBarProps) {
  const [logoutHovered, setLogoutHovered] = useState(false);

  const displayName = useMemo(() => {
    if (userName && userName.trim()) return userName.trim();
    if (userEmail && userEmail.trim()) {
      const prefix = userEmail.split("@")[0];
      const parts = prefix.replace(/[._-]/g, " ").split(/\s+/).filter(Boolean);
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
    return "Admin";
  }, [userName, userEmail]);

  const displayEmail = useMemo(() => {
    return userEmail ? userEmail.trim() : "";
  }, [userEmail]);

  const initials = useMemo(() => {
    const source = displayName || "A";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || "A"}${parts[1][0] || "D"}`.toUpperCase();
    return (source[0] || "A").toUpperCase();
  }, [displayName]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "#ffffff",
      }}
    >
      <button
        type="button"
        onClick={onGoDashboard}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <WebCreonAnimatedLogo staticMode showText={false} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span style={{ color: "#0f62ab" }}>WEB</span><span style={{ color: "#ffaa00" }}>CREON</span>
          </span>
          {siteName ? (
            <>
              <span style={{ color: "rgba(15,23,42,0.35)", fontWeight: 700 }}>›</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>{siteName}</span>
            </>
          ) : null}
        </div>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "transparent",
            border: "none",
            boxShadow: "none",
            padding: "4px 0",
          }}
        >
          <UserAvatar size={34} avatarUrl={avatarUrl} gender={gender} variant="yellow" />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>
              {displayName}
            </span>
            {displayEmail ? (
              <span style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.2 }}>
                {displayEmail}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ width: "1px", height: "18px", background: "#e2e8f0", margin: "0 2px" }} />

        <button
          type="button"
          onClick={onLogout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
          title="Logout"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "9px",
            border: "none",
            boxShadow: "none",
            background: logoutHovered ? "#fef2f2" : "transparent",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            color: logoutHovered ? "#dc2626" : "#64748b",
            transition: "all 0.15s ease",
          }}
        >
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
