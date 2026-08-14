import React from "react";

export type PaginationProps = {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
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
      return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
    }
  }
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  return false;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems,
  pageSize,
  showRangeText = false,
  theme,
  accentColor: customAccent,
  style,
}) => {
  if (totalPages <= 1 && (!showRangeText || !totalItems)) {
    return null;
  }

  const explicitLightMode = typeof theme?.mode === "string" && theme.mode.toLowerCase() === "light";
  const explicitDarkMode = typeof theme?.mode === "string" && theme.mode.toLowerCase() === "dark";

  const isLight = explicitLightMode || (!explicitDarkMode && (
    (theme?.text_color && isColorDarkHex(theme.text_color)) ||
    (theme?.primary_bg && !isColorDarkHex(theme.primary_bg)) ||
    (theme?.card_bg && !isColorDarkHex(theme.card_bg)) ||
    (!theme?.text_color && !theme?.primary_bg && !theme?.card_bg)
  ));

  const resolvedAccent = customAccent || theme?.accent_color || "#2563eb";
  const primaryText = theme?.text_color || (isLight ? "#0f172a" : "#f8fafc");
  const isTextDark = isColorDarkHex(primaryText);
  
  const mutedText = (theme as any)?.muted_text_color || (isTextDark ? "rgba(15, 23, 42, 0.65)" : "rgba(248, 250, 252, 0.65)");
  const borderColor = (theme as any)?.border_color || (isLight ? "rgba(15, 23, 42, 0.12)" : "rgba(255, 255, 255, 0.12)");
  const btnBg = isLight ? "#ffffff" : "rgba(255, 255, 255, 0.05)";
  const btnHoverBg = isLight ? "#f1f5f9" : "rgba(255, 255, 255, 0.10)";

  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  const pages = getPageNumbers();

  const handlePageClick = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange?.(page);
  };

  const startItem = pageSize ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = pageSize && totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <nav
      aria-label="Pagination Navigation"
      style={{
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {showRangeText && totalItems !== undefined && totalItems > 0 && pageSize && (
        <span style={{ fontSize: "13px", color: mutedText, fontWeight: 500 }}>
          Showing <strong>{startItem}</strong> – <strong>{endItem}</strong> of <strong>{totalItems}</strong> items
        </span>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
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
              color: currentPage <= 1 ? (isLight ? "#cbd5e1" : "#475569") : primaryText,
              cursor: currentPage <= 1 ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.15s ease",
              opacity: currentPage <= 1 ? 0.5 : 1,
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

          {/* Page Numbers */}
          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "38px",
                    color: mutedText,
                    fontSize: "14px",
                    fontWeight: 600,
                    userSelect: "none",
                  }}
                >
                  …
                </span>
              );
            }

            const pageNum = p as number;
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
                  color: isActive ? "#ffffff" : primaryText,
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
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
              color: currentPage >= totalPages ? (isLight ? "#cbd5e1" : "#475569") : primaryText,
              cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.15s ease",
              opacity: currentPage >= totalPages ? 0.5 : 1,
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
    </nav>
  );
};

export default Pagination;