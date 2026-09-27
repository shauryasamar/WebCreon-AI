import React, { useState, useEffect } from "react";
import { optimizeImageUrl, compressImageFile } from "../utils/imageOptimizer";

/**
 * Normalizes any backend uploaded or external media URL using the project's
 * standard image optimizer to ensure it loads correctly on all devices.
 */
export const resolveMediaUrl = optimizeImageUrl;
export { compressImageFile };

/**
 * Detects if a URL or string references an image file.
 */
export function isImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().split("?")[0].split("#")[0].toLowerCase();
  if (clean.includes("/uploads/support/") || clean.includes("/uploads/")) return true;
  if (url.startsWith("data:image/") || url.startsWith("blob:")) return true;
  return /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(clean);
}

export interface ParsedSupportMessage {
  cleanText: string;
  isOnlyImage: boolean;
  inlineImages: string[];
}

/**
 * Extracts inline image URLs or markdown images from a message string so they can
 * be rendered directly as adaptive images rather than raw text URLs.
 */
export function parseMessageWithMedia(
  rawMessage: string,
  existingAttachments: string[] = []
): ParsedSupportMessage {
  if (!rawMessage || typeof rawMessage !== "string") {
    return { cleanText: "", isOnlyImage: false, inlineImages: [] };
  }

  const normalizedExisting = (existingAttachments || []).map((u) =>
    resolveMediaUrl(u).toLowerCase()
  );
  const inlineImages: string[] = [];

  // 1. Handle markdown images: ![alt](url)
  const markdownImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/uploads\/[^\s)]+)\)/gi;
  let text = rawMessage.replace(markdownImgRegex, (_match, _alt, url) => {
    const resolved = resolveMediaUrl(url);
    if (!normalizedExisting.includes(resolved.toLowerCase()) && !inlineImages.includes(resolved)) {
      inlineImages.push(resolved);
    }
    return "";
  });

  // 2. Extract standalone or embedded image URLs
  const urlRegex = /(https?:\/\/[^\s<]+|\/uploads\/[^\s<]+)/gi;
  const matches = text.match(urlRegex) || [];

  for (const url of matches) {
    const cleanUrl = url.replace(/[.,;!?)]+$/, "");
    if (isImageUrl(cleanUrl)) {
      const resolved = resolveMediaUrl(cleanUrl);
      if (!normalizedExisting.includes(resolved.toLowerCase()) && !inlineImages.includes(resolved)) {
        inlineImages.push(resolved);
      }
      text = text.replace(cleanUrl, "").trim();
    }
  }

  const cleanText = text.trim();
  const isOnlyImage = !cleanText && inlineImages.length > 0;

  return { cleanText, isOnlyImage, inlineImages };
}

interface AdaptiveSupportImageProps {
  src: string;
  alt?: string;
  onClickZoom?: (resolvedUrl: string) => void;
  isStaff?: boolean;
  maxWidth?: string | number;
  maxHeight?: string | number;
}

/**
 * Adaptive, high-resolution proof image card with hover zoom effect,
 * aspect ratio preservation, loading skeleton, and fallback error handling.
 */
export const AdaptiveSupportImage: React.FC<AdaptiveSupportImageProps> = ({
  src,
  alt = "Complaint Proof",
  onClickZoom,
  isStaff = false,
  maxWidth = "280px",
  maxHeight = "220px",
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const resolvedUrl = resolveMediaUrl(src);

  if (!resolvedUrl) return null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onClickZoom) onClickZoom(resolvedUrl);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
        borderRadius: "8px",
        overflow: "hidden",
        cursor: onClickZoom ? "zoom-in" : "default",
        background: isStaff ? "rgba(255, 255, 255, 0.12)" : "#f1f5f9",
        border: isStaff
          ? "1px solid rgba(255, 255, 255, 0.25)"
          : "1px solid #cbd5e1",
        boxShadow: isHovered
          ? "0 4px 12px rgba(0,0,0,0.12)"
          : "0 1px 3px rgba(0,0,0,0.05)",
        transform: isHovered ? "translateY(-1px)" : "none",
        transition: "all 0.15s ease",
        margin: "2px 0",
      }}
    >
      {/* Loading Skeleton */}
      {!loaded && !hasError && (
        <div
          style={{
            width: "160px",
            height: "120px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isStaff ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
            color: isStaff ? "#ffffff" : "#64748b",
            fontSize: "11px",
            fontWeight: 500,
          }}
        >
          Loading photo...
        </div>
      )}

      {/* Error Fallback */}
      {hasError ? (
        <div
          style={{
            padding: "10px 14px",
            background: isStaff ? "rgba(0,0,0,0.2)" : "#fef2f2",
            border: `1px solid ${isStaff ? "rgba(255,255,255,0.2)" : "#fecaca"}`,
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "12px",
            color: isStaff ? "#ffffff" : "#991b1b",
          }}
        >
          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
            <span>⚠️</span> Photo preview unavailable
          </div>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: isStaff ? "#93c5fd" : "#2563eb",
              textDecoration: "underline",
              fontSize: "11px",
              wordBreak: "break-all",
            }}
          >
            Open image link
          </a>
        </div>
      ) : (
        <img
          src={resolvedUrl}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(true);
            setHasError(true);
          }}
          style={{
            display: loaded ? "block" : "none",
            maxWidth: "100%",
            maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
            width: "auto",
            height: "auto",
            objectFit: "contain",
            borderRadius: "7px",
          }}
        />
      )}

      {/* Hover Zoom Pill Badge */}
      {loaded && !hasError && isHovered && (
        <div
          style={{
            position: "absolute",
            bottom: "6px",
            right: "6px",
            background: "rgba(15, 23, 42, 0.78)",
            color: "#ffffff",
            padding: "3px 8px",
            borderRadius: "20px",
            fontSize: "10.5px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <span>Zoom</span>
        </div>
      )}
    </div>
  );
};

interface SupportImageZoomModalProps {
  imageUrl: string | null;
  onClose: () => void;
  title?: string;
}

/**
 * Full-screen modal lightbox for zoom inspection of complaint proofs and documents.
 */
export const SupportImageZoomModal: React.FC<SupportImageZoomModalProps> = ({
  imageUrl,
  onClose,
  title = "Proof Attachment",
}) => {
  useEffect(() => {
    if (!imageUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  const resolved = resolveMediaUrl(imageUrl);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(15, 23, 42, 0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backdropFilter: "blur(6px)",
      }}
    >
      {/* Top action bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "16px",
          left: "20px",
          right: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{title}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a
            href={resolved}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              background: "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              textDecoration: "none",
              border: "1px solid rgba(255, 255, 255, 0.25)",
            }}
          >
            <span>Open in new tab</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              color: "#ffffff",
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              fontSize: "16px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Image View */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: "92vw",
          maxHeight: "85vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={resolved}
          alt={title}
          style={{
            maxWidth: "92vw",
            maxHeight: "85vh",
            borderRadius: "8px",
            objectFit: "contain",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          }}
        />
      </div>
    </div>
  );
};

/**
 * WhatsApp 2-Tick Status Component:
 * - ⏳ Sending in-flight
 * - ✓✓ Grey = Delivered to other party's system
 * - ✓✓ Sky-Blue = Read/Seen by recipient with tooltip "Seen at HH:MM"
 */
export const MessageStatusTick: React.FC<{
  isSending?: boolean;
  readAt?: string | null;
  isStaffSender?: boolean;
  isCustomerBubble?: boolean;
}> = ({ isSending, readAt, isCustomerBubble }) => {
  if (isSending) {
    return (
      <span
        title="Sending..."
        style={{
          fontSize: "11px",
          display: "inline-flex",
          alignItems: "center",
          marginLeft: "4px",
          opacity: 0.8,
        }}
      >
        ⏳
      </span>
    );
  }

  const isRead = Boolean(readAt);
  const formattedTime = readAt
    ? new Date(readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const tooltip = isRead ? `Seen at ${formattedTime}` : "Delivered";

  // WhatsApp-style: bright blue (#38bdf8 / #0284c7) when read, subtle gray / light-white when delivered
  const checkColor = isRead
    ? "#38bdf8"
    : isCustomerBubble
    ? "rgba(255, 255, 255, 0.7)"
    : "#94a3b8";

  return (
    <span
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginLeft: "4px",
        verticalAlign: "middle",
        color: checkColor,
        cursor: "default",
        userSelect: "none",
        transition: "color 0.25s ease",
      }}
    >
      <svg
        width="15"
        height="11"
        viewBox="0 0 16 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 6.5L4.5 10L11 1.5" />
        <path d="M5.5 6.5L9 10L15.5 1.5" />
      </svg>
    </span>
  );
};

