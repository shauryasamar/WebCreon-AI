import React from "react";
import { useAdminTheme } from "../context/ThemeContext";

export interface AdminThemeToggleProps {
  style?: React.CSSProperties;
  showLabel?: boolean;
  compact?: boolean;
}

export const AdminThemeToggle: React.FC<AdminThemeToggleProps> = ({
  style,
  showLabel = false,
  compact = false,
}) => {
  const { isDark, setThemeMode, tokens } = useAdminTheme();

  return (
    <button
      type="button"
      onClick={() => setThemeMode(isDark ? "light" : "dark")}
      title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      aria-label={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        height: compact ? "32px" : "36px",
        padding: compact ? "0 8px" : "0 12px",
        borderRadius: "8px",
        border: `1px solid ${tokens.border}`,
        background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.04)",
        color: tokens.textSecondary,
        cursor: "pointer",
        fontSize: "12.5px",
        fontWeight: 600,
        transition: "all 0.15s ease",
        backdropFilter: "blur(8px)",
        boxSizing: "border-box",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.color = tokens.textPrimary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.04)";
        e.currentTarget.style.color = tokens.textSecondary;
      }}
    >
      {isDark ? (
        // Sun Icon for switching to light mode
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, color: "#facc15" }}
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        // Moon Icon for switching to dark mode
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, color: "#64748b" }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {showLabel && <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
};

export default AdminThemeToggle;
