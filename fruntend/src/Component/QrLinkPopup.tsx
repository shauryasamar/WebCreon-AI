import { useMemo } from "react";

type QrLinkPopupProps = {
  open: boolean;
  onClose: () => void;
  customerUrl: string;
};

export default function QrLinkPopup({ open, onClose, customerUrl }: QrLinkPopupProps) {
  const qrFallback = useMemo(() => {
    if (!customerUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(customerUrl)}`;
  }, [customerUrl]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!customerUrl) return;
    try {
      await navigator.clipboard.writeText(customerUrl);
    } catch {
      // intentionally silent for now
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(15,23,42,0.45)",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "20px",
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>QR & Link</h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>Share the customer website.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              border: "1px solid rgba(15,23,42,0.08)",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            width: "220px",
            height: "220px",
            margin: "0 auto 18px",
            borderRadius: "18px",
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.08)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {qrFallback ? (
            <img src={qrFallback} alt="Customer website QR code" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>QR preview</span>
          )}
        </div>

        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
          Customer website URL
        </label>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.08)",
            color: "#0f172a",
            fontSize: "13px",
            wordBreak: "break-all",
            marginBottom: "14px",
          }}
        >
          {customerUrl || "Not available"}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            width: "100%",
            height: "44px",
            borderRadius: "14px",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Copy Link
        </button>
      </div>
    </div>
  );
}
