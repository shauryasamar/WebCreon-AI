import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { isColorDarkHex } from "../context/ThemeContext";
import { useDeviceMode } from "../context/DeviceModeContext";

type SortOption = {
  value: string;
  label: string;
  description: string;
};

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest Arrivals", description: "Recently added products" },
  { value: "price_asc", label: "Price: Low to High", description: "Sort by increasing price" },
  { value: "price_desc", label: "Price: High to Low", description: "Sort by decreasing price" },
  { value: "rating_desc", label: "Highest Rated", description: "Sort by customer rating" },
  { value: "discount_desc", label: "Biggest Discount", description: "Sort by discount percentage" },
];

type FilterSidebarProps = {
  title?: string;
  subtitle?: string;
  itemCount?: number;
  activeFilterCount?: number;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
  onFilterClick?: () => void;
  showFilterButton?: boolean;
  theme?: {
    mode?: string;
    text_color?: string;
    accent_color?: string;
    primary_bg?: string;
  };
  filters?: string[];
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;
};

export const FilterSidebar = ({
  title,
  subtitle,
  itemCount = 0,
  activeFilterCount = 0,
  sortBy = "newest",
  onSortChange,
  onFilterClick,
  showFilterButton = true,
  theme,
}: FilterSidebarProps) => {
  const deviceMode = useDeviceMode();
  const [innerIsMobile, setInnerIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 640;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setInnerIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  const isMobile = deviceMode === "mobile" || innerIsMobile;
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isInsidePreviewStage, setIsInsidePreviewStage] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!sortOpen) return;
    // In builder admin preview, portal to the phone preview stage container if available
    const previewStage = sortRef.current?.closest(".builder-preview-stage") as HTMLElement | null;
    if (deviceMode === "mobile" && previewStage) {
      setPortalTarget(previewStage);
      setIsInsidePreviewStage(true);
    } else {
      setPortalTarget(document.body);
      setIsInsidePreviewStage(false);
    }
  }, [deviceMode, sortOpen]);

  useEffect(() => {
    if (!sortOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sortOpen]);

  useEffect(() => {
    if (!sortOpen || !isMobile || isInsidePreviewStage) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sortOpen, isMobile, isInsidePreviewStage]);

  const isDark =
    ((theme as any)?.filter_bg ? isColorDarkHex((theme as any).filter_bg) : false) ||
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    ((theme as any)?.filter_text_color ? !isColorDarkHex((theme as any).filter_text_color) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
    theme?.mode === "dark";
  const accentColor = (theme as any)?.filter_accent_color || theme?.accent_color || (isDark ? "#60a5fa" : "#2563eb");
  const resolvedPrimaryBg = (theme as any)?.filter_bg || theme?.primary_bg || (isDark ? "#0f172a" : "#f8fafc");

  const textPrimary = (theme as any)?.filter_text_color || theme?.text_color || (isDark ? "#f1f5f9" : "#0f172a");
  const textSecondary = (theme as any)?.muted_text_color || (isDark ? "rgba(241, 245, 249, 0.65)" : "rgba(15, 23, 42, 0.65)");
  const borderColor = (theme as any)?.filter_border_color || (theme as any)?.border_color || (isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)");

  const btnBg = (theme as any)?.filter_card_bg || (isDark
    ? "rgba(255, 255, 255, 0.08)"
    : (resolvedPrimaryBg === "#ffffff" ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.65)"));

  const dropdownBg = (theme as any)?.filter_card_bg || (theme as any)?.dialog_bg || (theme as any)?.surface_bg || (theme as any)?.card_bg || resolvedPrimaryBg;
  const hoverBg = `${accentColor}1c`;

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy) || SORT_OPTIONS[0];

  useEffect(() => {
    if (!sortOpen || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortOpen, isMobile]);

  const displayTitle =
    (title &&
    !["featured products", "featured product", "curated collection"].includes(
      title.toLowerCase().trim()
    )
      ? title
      : null) || "Newest Arrivals";

  return (
    <div className={`product-toolbar-wrapper ${isMobile ? "is-mobile" : ""}`}>
      <div className="product-toolbar-container">
        {/* Left: Subtitle & Title */}
        <div className="product-toolbar-title-group">
          <p className="product-toolbar-subtitle">
            {subtitle || "Browse Products"}
          </p>
          <h2 className="product-toolbar-title" title={displayTitle}>
            {displayTitle}
            {itemCount > 0 && (
              <span className="product-toolbar-title-count">
                ({itemCount.toLocaleString()})
              </span>
            )}
          </h2>
        </div>

        {/* Right: Actions */}
        <div className="product-toolbar-actions">
          {/* Filter button */}
          {showFilterButton && (
            isMobile ? (
              <button
                type="button"
                onClick={onFilterClick}
                className="product-toolbar-icon-btn"
                aria-label="Filter products and categories"
                title="Filter & Categories"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                {activeFilterCount > 0 && (
                  <span className="product-toolbar-icon-badge">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onFilterClick}
                className="product-toolbar-btn product-toolbar-filter-btn"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                <span>Filter & Categories</span>
                {activeFilterCount > 0 && (
                  <span className="product-toolbar-badge">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )
          )}

          {/* Sort button */}
          <div ref={sortRef} style={{ position: "relative" }}>
            {isMobile ? (
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="product-toolbar-icon-btn"
                aria-label={`Sort by: ${currentSort.label}`}
                title={`Sort by: ${currentSort.label}`}
                style={{
                  borderColor: sortBy !== "newest" ? accentColor : borderColor,
                  background: sortBy !== "newest" ? `${accentColor}16` : btnBg,
                  color: sortBy !== "newest" ? accentColor : textPrimary,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5h10M11 9h7M11 13h4" />
                  <path d="M3 17l3 3 3-3" />
                  <path d="M6 18V4" />
                </svg>
                {sortBy !== "newest" && (
                  <span
                    style={{
                      position: "absolute",
                      top: "5px",
                      right: "5px",
                      width: "6px",
                      height: "6px",
                      borderRadius: "999px",
                      background: accentColor,
                    }}
                  />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="product-toolbar-btn product-toolbar-sort-btn"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M11 5h10M11 9h7M11 13h4" />
                  <path d="M3 17l3 3 3-3" />
                  <path d="M6 18V4" />
                </svg>
                <span>
                  Sort by: <strong style={{ fontWeight: 600 }}>{currentSort.label}</strong>
                </span>
                <span style={{ fontSize: "8px", marginLeft: "3px", opacity: 0.75, transition: "transform 200ms", transform: sortOpen ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
              </button>
            )}

            {/* Desktop Popover Dropdown */}
            {sortOpen && !isMobile && (
              <div className="product-sort-dropdown">
                <div className="product-sort-header">
                  Sort by
                </div>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onSortChange?.(opt.value);
                        setSortOpen(false);
                      }}
                      className="product-sort-item"
                      style={{
                        background: isActive ? hoverBg : "transparent",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: isActive ? 700 : 500, color: isActive ? accentColor : textPrimary }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "11px", color: textSecondary, marginTop: "1px" }}>
                          {opt.description}
                        </div>
                      </div>
                      {isActive && (
                        <span style={{ color: accentColor, fontSize: "16px", fontWeight: 700 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Mobile Bottom Sheet (Both real mobile and in admin mobile preview chassis) */}
      {sortOpen && isMobile && (
        createPortal(
          <div
            className="mobile-sort-sheet-overlay"
            onClick={() => setSortOpen(false)}
            style={{
              position: isInsidePreviewStage ? "absolute" : "fixed",
              inset: 0,
              zIndex: 999999,
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              animation: "sortFadeIn 200ms ease-out",
              borderRadius: isInsidePreviewStage ? "30px" : undefined,
              overflow: "hidden",
            }}
          >
            <div
              className="mobile-sort-sheet"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxHeight: "85%",
                background: dropdownBg,
                borderRadius: "24px 24px 0 0",
                borderTop: `1px solid ${borderColor}`,
                boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.35)",
                display: "flex",
                flexDirection: "column",
                animation: "sortSheetSlideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)",
                boxSizing: "border-box",
              }}
            >
              {/* Grab Pill Handle */}
              <div style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    width: "36px",
                    height: "4.5px",
                    borderRadius: "999px",
                    background: isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.18)",
                  }}
                />
              </div>

              {/* Sheet Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 18px 14px",
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: textPrimary, letterSpacing: "-0.01em" }}>
                    Sort by
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: textSecondary }}>
                    Choose your preferred product order
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSortOpen(false)}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "999px",
                    background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                    border: "none",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    color: textSecondary,
                    padding: 0,
                  }}
                  aria-label="Close sort menu"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Options List */}
              <div
                style={{
                  padding: "10px 14px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  overflowY: "auto",
                }}
              >
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onSortChange?.(opt.value);
                        setSortOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: "14px",
                        border: `1.5px solid ${isActive ? accentColor : borderColor}`,
                        background: isActive ? `${accentColor}18` : (isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)"),
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 140ms ease",
                        outline: "none",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: isActive ? 700 : 600, color: isActive ? accentColor : textPrimary }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "11.5px", color: textSecondary, marginTop: "2px" }}>
                          {opt.description}
                        </div>
                      </div>

                      {/* Radio Indicator */}
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "999px",
                          border: `2px solid ${isActive ? accentColor : textSecondary}`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          marginLeft: "12px",
                          background: isActive ? `${accentColor}20` : "transparent",
                        }}
                      >
                        {isActive && (
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "999px",
                              background: accentColor,
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          portalTarget || document.body
        )
      )}

      <style>{`
        .product-toolbar-wrapper,
        .product-toolbar-wrapper * {
          box-sizing: border-box;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .product-toolbar-wrapper {
          width: 100%;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid ${borderColor};
        }
        .product-toolbar-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .product-toolbar-title-group {
          min-width: 160px;
        }
        .product-toolbar-subtitle {
          margin: 0 0 2px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${textSecondary};
        }
        .product-toolbar-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: ${textPrimary};
          display: flex;
          align-items: baseline;
        }
        .product-toolbar-title-count {
          font-size: 13.5px;
          font-weight: 500;
          color: ${textSecondary};
          margin-left: 6px;
        }
        .product-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .product-toolbar-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid ${borderColor};
          background: ${btnBg};
          color: ${textPrimary};
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 160ms ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          user-select: none;
        }
        .product-toolbar-btn:hover {
          border-color: ${accentColor};
          background: ${hoverBg};
        }
        .product-toolbar-btn:active {
          transform: scale(0.98);
        }
        .product-toolbar-badge {
          background: ${accentColor};
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 0 6px;
          height: 16px;
          min-width: 16px;
          border-radius: 999px;
          margin-left: 2px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .product-toolbar-icon-btn {
          width: 34px;
          height: 34px;
          min-width: 34px;
          padding: 0;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${borderColor};
          background: ${btnBg};
          color: ${textPrimary};
          cursor: pointer;
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          transition: all 140ms ease;
          outline: none;
        }
        .product-toolbar-icon-btn:hover {
          border-color: ${accentColor};
          background: ${hoverBg};
        }
        .product-toolbar-icon-btn:active {
          transform: scale(0.96);
        }
        .product-toolbar-icon-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: ${accentColor};
          color: #ffffff;
          font-size: 9.5px;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          padding: 0 3px;
          box-sizing: border-box;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .product-sort-dropdown,
        .product-sort-dropdown * {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .product-sort-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 250px;
          max-width: calc(100vw - 32px);
          border-radius: 12px;
          border: 1px solid ${borderColor};
          background: ${dropdownBg};
          box-shadow: ${isDark ? "0 16px 36px rgba(0,0,0,0.55)" : "0 12px 30px rgba(15,23,42,0.12)"};
          padding: 6px;
          z-index: 99999;
          animation: sortDropIn 160ms ease;
        }
        .product-sort-header {
          padding: 8px 10px 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: ${textSecondary};
          border-bottom: 1px solid ${borderColor};
          margin-bottom: 4px;
        }
        .product-sort-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: background 140ms ease;
          text-align: left;
        }

        /* Responsive Mobile Layout: Single row with Title on left & Icons on right */
        @media (max-width: 640px) {
          .product-toolbar-container {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            flex-wrap: nowrap !important;
          }
          .product-toolbar-title-group {
            min-width: 0 !important;
            flex: 1 !important;
          }
          .product-toolbar-title {
            font-size: 16px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .product-toolbar-subtitle {
            font-size: 10px !important;
            letter-spacing: 0.08em !important;
            margin-bottom: 1px !important;
          }
          .product-toolbar-actions {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
            flex-wrap: nowrap !important;
            width: auto !important;
          }
        }

        /* Mobile Preview Chassis in Builder: Exact same Single Row with Icons */
        .is-mobile-preview .product-toolbar-container,
        .product-toolbar-wrapper.is-mobile .product-toolbar-container {
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          flex-wrap: nowrap !important;
        }
        .is-mobile-preview .product-toolbar-title-group,
        .product-toolbar-wrapper.is-mobile .product-toolbar-title-group {
          min-width: 0 !important;
          flex: 1 !important;
        }
        .is-mobile-preview .product-toolbar-title,
        .product-toolbar-wrapper.is-mobile .product-toolbar-title {
          font-size: 16px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .is-mobile-preview .product-toolbar-subtitle,
        .product-toolbar-wrapper.is-mobile .product-toolbar-subtitle {
          font-size: 10px !important;
          letter-spacing: 0.08em !important;
          margin-bottom: 1px !important;
        }
        .is-mobile-preview .product-toolbar-actions,
        .product-toolbar-wrapper.is-mobile .product-toolbar-actions {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-shrink: 0 !important;
          flex-wrap: nowrap !important;
          width: auto !important;
        }

        @keyframes sortDropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sortSheetSlideUp {
          from {
            transform: translateY(100%);
            opacity: 0.8;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes sortFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default FilterSidebar;