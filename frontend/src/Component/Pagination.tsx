import React from "react";

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
  if (totalPages <= 1 && (!showRangeText || !totalItems) && !pageSizeOptions) {
    return null;
  }

  // Ground-Truth Luminance Darkness Detection (never trust stale theme.mode)
  const isDarkCanvas =
    ((theme as any)?.pagination_bg ? isColorDarkHex((theme as any).pagination_bg) : false) ||
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    (theme?.secondary_bg ? isColorDarkHex(theme.secondary_bg) : false) ||
    ((theme as any)?.pagination_text_color ? !isColorDarkHex((theme as any).pagination_text_color) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
    theme?.mode === "dark";

  // Resolved dynamic theme tokens with guaranteed contrast
  const resolvedAccent = (theme as any)?.pagination_active_bg || customAccent || theme?.accent_color || "#2563eb";
  const activeBtnTextColor = isColorDarkHex(resolvedAccent) ? "#ffffff" : "#0f172a";

  const btnBg = (theme as any)?.pagination_bg || (isDarkCanvas
    ? "rgba(255, 255, 255, 0.10)"
    : "#ffffff");

  const btnHoverBg = isDarkCanvas
    ? "rgba(255, 255, 255, 0.20)"
    : "#f1f5f9";

  const borderColor = (theme as any)?.pagination_border_color || (isDarkCanvas
    ? "rgba(255, 255, 255, 0.18)"
    : (theme?.border_color || "rgba(15, 23, 42, 0.14)"));

  const btnTextColor = (theme as any)?.pagination_text_color || (isDarkCanvas
    ? "#ffffff"
    : (theme?.text_color && isColorDarkHex(theme.text_color) ? theme.text_color : "#0f172a"));

  const mutedText = isDarkCanvas ? "rgba(255, 255, 255, 0.85)" : "#475569";
  const disabledText = isDarkCanvas ? "rgba(255, 255, 255, 0.35)" : "#94a3b8";

  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getPageNumbers = (): number[] => {
    const WINDOW_SIZE = isMobile ? 3 : 10;
    if (totalPages <= WINDOW_SIZE) {
      return Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);
    }

    let start = 1;
    let end = WINDOW_SIZE;

    if (isMobile) {
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
              <option key={opt} value={opt} style={{ background: isDarkCanvas ? "#1e293b" : "#ffffff", color: isDarkCanvas ? "#ffffff" : "#0f172a" }}>
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