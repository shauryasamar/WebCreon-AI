import React from "react";
import { useDeviceMode } from "../context/DeviceModeContext";
import { useAdminTheme } from "../context/ThemeContext";

export type PaginationProps = {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (newSize: number) => void;
  showRangeText?: boolean;
  theme?: {
    mode?: string;
    primary_bg?: string;
    secondary_bg?: string;
    text_color?: string;
    accent_color?: string;
    [key: string]: any;
  };
  accentColor?: string;
  style?: React.CSSProperties;
};

function isColorDarkHex(colorHex?: string): boolean {
  if (!colorHex || typeof colorHex !== "string") return false;
  if (colorHex.startsWith("rgb")) {
    const match = colorHex.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
    }
  }
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  }
  return false;
}

function getContrastTextColor(bgHex?: string, fallbackLight = "#ffffff", fallbackDark = "#0f172a"): string {
  if (!bgHex) return fallbackDark;
  return isColorDarkHex(bgHex) ? fallbackLight : fallbackDark;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  showRangeText = false,
  theme,
  accentColor: customAccent,
  style,
}) => {
  const { isDark: isDarkAdmin, tokens: adminTokens } = useAdminTheme();
  const deviceMode = useDeviceMode();
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );
  const effectiveIsMobile = deviceMode === "mobile" || isMobile;

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (totalPages <= 1 && (!showRangeText || !totalItems) && !pageSizeOptions) {
    return null;
  }

  // Detect whether Pagination is being rendered in Storefront context vs Admin context
  const isStorefront = Boolean(
    theme && (theme.primary_bg || theme.secondary_bg || theme.text_color || theme.accent_color || theme.mode || (theme as any).pagination_bg)
  );

  // Ground-Truth Luminance Darkness Detection (storefront never inherits admin theme toggle)
  const isDarkCanvas = isStorefront
    ? Boolean(
        ((theme as any)?.pagination_bg ? isColorDarkHex((theme as any).pagination_bg) : false) ||
        (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
        (theme?.secondary_bg ? isColorDarkHex(theme.secondary_bg) : false) ||
        ((theme as any)?.pagination_text_color ? !isColorDarkHex((theme as any).pagination_text_color) : false) ||
        (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
        theme?.mode === "dark"
      )
    : isDarkAdmin;

  // Resolved dynamic theme tokens with guaranteed contrast
  const resolvedAccent = isStorefront
    ? ((theme as any)?.pagination_active_bg || customAccent || theme?.accent_color || "#2563eb")
    : (customAccent || adminTokens?.accent || "#2563eb");

  const activeBtnTextColor = isColorDarkHex(resolvedAccent) ? "#ffffff" : "#0f172a";

  const btnBg = (theme as any)?.pagination_bg || (isStorefront
    ? (isDarkCanvas ? (theme?.secondary_bg || "#1e293b") : (theme?.secondary_bg || "#ffffff"))
    : (isDarkCanvas ? (adminTokens?.elevatedSurfaceBg || "#242429") : "#ffffff"));

  const btnHoverBg = isStorefront
    ? (isDarkCanvas ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9")
    : (isDarkCanvas ? (adminTokens?.hoverBg || "rgba(255, 255, 255, 0.08)") : "#f1f5f9");

  const borderColor = (theme as any)?.pagination_border_color || (isStorefront
    ? (theme?.border_color || (isDarkCanvas ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.14)"))
    : (isDarkCanvas ? (adminTokens?.border || "rgba(255, 255, 255, 0.08)") : (adminTokens?.border || "rgba(15, 23, 42, 0.14)")));

  const btnTextColor = (theme as any)?.pagination_text_color || (isStorefront
    ? (theme?.text_color || (isDarkCanvas ? "#f4f4f5" : "#0f172a"))
    : (isDarkCanvas ? (adminTokens?.textPrimary || "#f4f4f5") : (adminTokens?.textPrimary || "#0f172a")));

  const mutedText = isStorefront
    ? (isDarkCanvas ? "rgba(255, 255, 255, 0.6)" : "rgba(15, 23, 42, 0.6)")
    : (isDarkCanvas ? (adminTokens?.textSecondary || "#a1a1aa") : (adminTokens?.textSecondary || "#475569"));

  const disabledText = isStorefront
    ? (isDarkCanvas ? "rgba(255, 255, 255, 0.3)" : "rgba(15, 23, 42, 0.3)")
    : (isDarkCanvas ? (adminTokens?.textDisabled || "#52525b") : "#94a3b8");

  const getPageNumbers = (): number[] => {
    const WINDOW_SIZE = effectiveIsMobile ? 3 : 10;
    if (totalPages <= WINDOW_SIZE) {
      return Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);
    }

    let start = 1;
    let end = WINDOW_SIZE;

    if (effectiveIsMobile) {
      if (currentPage <= 2) {
        start = 1;
        end = 3;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 2;
        end = totalPages;
      } else {
        start = currentPage - 1;
        end = currentPage + 1;
      }
    } else {
      if (currentPage <= 6) {
        start = 1;
        end = WINDOW_SIZE;
      } else {
        start = currentPage - 5;
        end = currentPage + 4;
        if (end > totalPages) {
          end = totalPages;
          start = Math.max(1, totalPages - WINDOW_SIZE + 1);
        }
      }
    }

    const pages: number[] = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  };

  const pages = getPageNumbers();

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange?.(page);
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "20px 0 12px",
        width: "100%",
        boxSizing: "border-box",
        margin: "0 auto",
        ...style,
      }}
    >
      {/* Google-Style Centered Pagination Buttons Bar */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            margin: "0 auto",
          }}
        >
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => handlePageClick(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minWidth: "38px",
              height: "38px",
              padding: "0 14px",
              borderRadius: "10px",
              border: `1px solid ${borderColor}`,
              background: btnBg,
              color: currentPage <= 1 ? disabledText : btnTextColor,
              cursor: currentPage <= 1 ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.15s ease",
              opacity: currentPage <= 1 ? 0.45 : 1,
              touchAction: "manipulation",
            }}
            onMouseEnter={(e) => {
              if (currentPage > 1) {
                e.currentTarget.style.background = btnHoverBg;
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage > 1) {
                e.currentTarget.style.background = btnBg;
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            ‹ Prev
          </button>

          {/* 10-Page Number Buttons (Sliding Window) */}
          {pages.map((pageNum) => {
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageClick(pageNum)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "38px",
                  height: "38px",
                  padding: "0 10px",
                  borderRadius: "10px",
                  border: isActive ? `1px solid ${resolvedAccent}` : `1px solid ${borderColor}`,
                  background: isActive ? resolvedAccent : btnBg,
                  color: isActive ? activeBtnTextColor : btnTextColor,
                  cursor: "pointer",
                  fontSize: "13.5px",
                  fontWeight: isActive ? 800 : 500,
                  boxShadow: isActive ? `0 4px 12px ${resolvedAccent}33` : "none",
                  transition: "all 0.15s ease",
                  touchAction: "manipulation",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = btnHoverBg;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = btnBg;
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            type="button"
            onClick={() => handlePageClick(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minWidth: "38px",
              height: "38px",
              padding: "0 14px",
              borderRadius: "10px",
              border: `1px solid ${borderColor}`,
              background: btnBg,
              color: currentPage >= totalPages ? disabledText : btnTextColor,
              cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.15s ease",
              opacity: currentPage >= totalPages ? 0.45 : 1,
              touchAction: "manipulation",
            }}
            onMouseEnter={(e) => {
              if (currentPage < totalPages) {
                e.currentTarget.style.background = btnHoverBg;
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage < totalPages) {
                e.currentTarget.style.background = btnBg;
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            Next ›
          </button>
        </div>
      )}

      {/* Optional Range Text */}
      {showRangeText && totalItems !== undefined && totalItems > 0 && pageSize && (
        <div style={{ fontSize: "12px", color: mutedText, fontWeight: 500 }}>
          Showing <strong style={{ color: isDarkCanvas ? "#f4f4f5" : "#0f172a" }}>{Math.min((currentPage - 1) * pageSize + 1, totalItems)}</strong>–<strong style={{ color: isDarkCanvas ? "#f4f4f5" : "#0f172a" }}>{Math.min(currentPage * pageSize, totalItems)}</strong> of <strong style={{ color: isDarkCanvas ? "#f4f4f5" : "#0f172a" }}>{totalItems}</strong>
        </div>
      )}

      {/* Optional Page Size Selector (Centered below) */}
      {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12.5px", color: mutedText, marginTop: "2px" }}>
          <span>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              border: `1px solid ${borderColor}`,
              background: btnBg,
              color: btnTextColor,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option
                key={opt}
                value={opt}
                style={{
                  background: isStorefront
                    ? (isDarkCanvas ? (theme?.secondary_bg || "#18181b") : (theme?.secondary_bg || "#ffffff"))
                    : (isDarkCanvas ? (adminTokens?.surfaceBg || "#18181b") : "#ffffff"),
                  color: isStorefront
                    ? (theme?.text_color || (isDarkCanvas ? "#f4f4f5" : "#0f172a"))
                    : (isDarkCanvas ? (adminTokens?.textPrimary || "#f4f4f5") : "#0f172a"),
                }}
              >
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
};

export default Pagination;