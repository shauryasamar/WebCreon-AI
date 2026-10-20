import React, { useEffect } from "react";

export type GlassToastType = "success" | "error" | "info";

export type GlassToastProps = {
  message: string;
  type?: GlassToastType;
  onClose: () => void;
  duration?: number;
  top?: string;
};

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const GlassToast: React.FC<GlassToastProps> = ({
  message,
  type = "success",
  onClose,
  duration = 3500,
  top = "76px",
}) => {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, message]);

  const isSuccess = type === "success";
  const isError = type === "error";

  const bg = isSuccess
    ? "rgba(240, 253, 244, 0.65)"
    : isError
    ? "rgba(254, 242, 242, 0.65)"
    : "rgba(239, 246, 255, 0.65)";

  const textColor = isSuccess ? "#14532d" : isError ? "#991b1b" : "#1e40af";
  const iconColor = isSuccess ? "#15803d" : isError ? "#dc2626" : "#2563eb";
  const borderColor = isSuccess
    ? "rgba(22, 163, 74, 0.3)"
    : isError
    ? "rgba(220, 38, 38, 0.3)"
    : "rgba(37, 99, 235, 0.3)";

  const shadow = isSuccess
    ? "0 8px 30px 0 rgba(22, 101, 52, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.45)"
    : isError
    ? "0 8px 30px 0 rgba(153, 27, 27, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.45)"
    : "0 8px 30px 0 rgba(37, 99, 235, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.45)";

  return (
    <div
      style={{
        position: "fixed",
        top: top,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 18px",
        borderRadius: "10px",
        background: bg,
        backdropFilter: "blur(14px) saturate(180%)",
        WebkitBackdropFilter: "blur(14px) saturate(180%)",
        color: textColor,
        fontSize: "13px",
        fontWeight: 600,
        boxShadow: shadow,
        border: `1px solid ${borderColor}`,
        whiteSpace: "nowrap",
        maxWidth: "90vw",
        boxSizing: "border-box",
      }}
    >
      <span style={{ color: iconColor, display: "grid", placeItems: "center" }}>
        {isSuccess ? <CheckIcon /> : isError ? <XMarkIcon /> : <InfoIcon />}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: textColor,
          cursor: "pointer",
          marginLeft: "6px",
          padding: "2px",
          display: "grid",
          placeItems: "center",
          opacity: 0.75,
        }}
      >
        <XMarkIcon />
      </button>
    </div>
  );
};

export default GlassToast;
