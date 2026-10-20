import React from "react";
import { createPortal } from "react-dom";
import { useDeviceMode } from "../context/DeviceModeContext";
import { useAdminTheme } from "../context/ThemeContext";
import { AdminSelect } from "./AdminSelect";

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

const StorefrontPageSizeSelect: React.FC<{
  value?: number;
  options: number[];
  onChange: (val: number) => void;
  btnBg: string;
  btnTextColor: string;
  borderColor: string;
  accentColor: string;
  isDark: boolean;
}> = ({ value, options, onChange, btnBg, btnTextColor, borderColor, accentColor, isDark }) => {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const updateCoords = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left + rect.width / 2,
      });
    }
  }, []);

  const handleToggle = () => {
    if (!open) {
      updateCoords();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    updateCoords();

    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const menuEl = document.getElementById("storefront-page-size-menu");
        if (menuEl && menuEl.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleScrollOrResize = () => {
      updateCoords();
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true } as any);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updateCoords]);

  const menuBg = isDark ? (btnBg || "#18181b") : "#ffffff";
  const contrastBorder = isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(15, 23, 42, 0.14)";
  const triggerBg = isDark ? "rgba(255, 255, 255, 0.08)" : "#ffffff";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", userSelect: "none" }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          height: "28px",
          minWidth: "62px",
          padding: "0 8px 0 10px",
          borderRadius: "8px",
          border: `1px solid ${open ? accentColor : (borderColor || contrastBorder)}`,
          background: triggerBg,
          color: btnTextColor,
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          outline: "none",
          transition: "all 0.15s ease",
          boxShadow: open ? `0 0 0 2px ${accentColor}25` : "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <span>{value}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            opacity: 0.75,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          id="storefront-page-size-menu"
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: "translateX(-50%)",
            minWidth: "76px",
            background: menuBg,
            border: `1px solid ${borderColor || contrastBorder}`,
            borderRadius: "10px",
            boxShadow: isDark
              ? "0 16px 36px -4px rgba(0, 0, 0, 0.85), 0 4px 12px rgba(0, 0, 0, 0.5)"
              : "0 16px 36px -4px rgba(15, 23, 42, 0.20), 0 4px 12px rgba(15, 23, 42, 0.08)",
            padding: "4px",
            zIndex: 9999999,
          }}
        >
          {options.map((opt) => {
            const isSelected = opt === value;
            return (
              <div
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? accentColor : btnTextColor,
                  background: isSelected ? `${accentColor}18` : "transparent",
                  cursor: "pointer",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span>{opt}</span>
                {isSelected && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};

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
  const rawProps = { ...(theme || {}), ...((style as any) || {}), ...({
    pagination_bg: (theme as any)?.pagination_bg,
    pagination_text_color: (theme as any)?.pagination_text_color,
    pagination_active_bg: (theme as any)?.pagination_active_bg,
    pagination_border_color: (theme as any)?.pagination_border_color,
  }) };

  const resolvedAccent = isStorefront
    ? (customAccent || (theme as any)?.pagination_active_bg || theme?.accent_color || "#2563eb")
    : (customAccent || adminTokens?.accent || "#2563eb");

  const activeBtnTextColor = isColorDarkHex(resolvedAccent) ? "#ffffff" : "#0f172a";

  const btnBg = (theme as any)?.pagination_bg || (theme as any)?.background_color || (isStorefront
    ? (isDarkCanvas ? (theme?.secondary_bg || "#1e293b") : (theme?.secondary_bg || "#ffffff"))
    : (isDarkCanvas ? (adminTokens?.elevatedSurfaceBg || "#242429") : "#ffffff"));

  const btnHoverBg = isStorefront
    ? (isDarkCanvas ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9")
    : (isDarkCanvas ? (adminTokens?.hoverBg || "rgba(255, 255, 255, 0.08)") : "#f1f5f9");

  const borderColor = (theme as any)?.pagination_border_color || (theme as any)?.border_color || (isStorefront
    ? (theme?.border_color || (isDarkCanvas ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.14)"))
    : (isDarkCanvas ? (adminTokens?.border || "rgba(255, 255, 255, 0.08)") : (adminTokens?.border || "rgba(15, 23, 42, 0.14)")));

  const btnTextColor = (theme as any)?.pagination_text_color || (theme as any)?.text_color || (isStorefront
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
        position: "relative",
        zIndex: 20,
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
          {isStorefront ? (
            <StorefrontPageSizeSelect
              value={pageSize}
              options={pageSizeOptions}
              onChange={onPageSizeChange}
              btnBg={btnBg}
              btnTextColor={btnTextColor}
              borderColor={borderColor}
              accentColor={resolvedAccent}
              isDark={isDarkCanvas}
            />
          ) : (
            <AdminSelect
              direction="up"
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                height: "28px",
                minWidth: "64px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "6px",
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={String(opt)}>
                  {opt}
                </option>
              ))}
            </AdminSelect>
          )}
        </div>
      )}
    </nav>
  );
};

export default Pagination;