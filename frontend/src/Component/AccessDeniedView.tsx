import React from "react";
import { useNavigate, useParams } from "react-router-dom";

type AccessDeniedViewProps = {
  title?: string;
  message?: string;
  requiredPermission?: string;
  moduleName?: string;
};

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  title,
  message,
  requiredPermission,
  moduleName,
}) => {
  const displayTitle = title || (moduleName ? `${moduleName} Access Restricted` : "Access Denied");
  const displayMessage =
    message ||
    (moduleName
      ? `You don't have permission to view or manage ${moduleName}. Please contact your workspace owner if you require access.`
      : "You don't have permission to access this page. Please contact your workspace owner if you require access.");
  const navigate = useNavigate();
  const { siteId } = useParams();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "32px 16px",
        textAlign: "center",
        color: "#0f172a",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "14px",
          background: "#fef2f2",
          border: "1px solid #fee2e2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ef4444",
          marginBottom: "18px",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: "28px", height: "28px" }}
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <h2
        style={{
          margin: "0 0 8px 0",
          fontSize: "20px",
          fontWeight: 700,
          color: "#0f172a",
          letterSpacing: "-0.01em",
        }}
      >
        {displayTitle}
      </h2>

      <p
        style={{
          margin: "0 0 20px 0",
          fontSize: "13.5px",
          color: "#64748b",
          maxWidth: "420px",
          lineHeight: 1.5,
        }}
      >
        {displayMessage}
      </p>

      {requiredPermission && (
        <div
          style={{
            display: "inline-block",
            padding: "4px 10px",
            background: "#f1f5f9",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#475569",
            fontWeight: 600,
            marginBottom: "24px",
            border: "1px solid #e2e8f0",
          }}
        >
          Required Permission: <code>{requiredPermission}</code>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Go Back
        </button>

        <button
          type="button"
          onClick={() => {
            if (siteId) {
              navigate(`/builder/${siteId}`);
            } else {
              navigate("/admin/sites");
            }
          }}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Workspace Home
        </button>
      </div>
    </div>
  );
};

export default AccessDeniedView;
