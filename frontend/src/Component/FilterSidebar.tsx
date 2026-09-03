import React, { useState, useRef, useEffect } from "react";
import { isColorDarkHex } from "../context/ThemeContext";

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
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

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
    if (!sortOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortOpen]);

  const displayTitle =
    (title &&
    !["featured products", "featured product", "curated collection"].includes(
      title.toLowerCase().trim()
    )
      ? title
      : null) || "Newest Arrivals";

  return (
    <div className="product-toolbar-wrapper">
      <div className="product-toolbar-container">
        {/* Left: Subtitle & Title */}
        <div className="product-toolbar-title-group">
          <p className="product-toolbar-subtitle">
            {subtitle || "Browse Products"}
          </p>
          <h2 className="product-toolbar-title">
            {displayTitle}
          </h2>
        </div>

        {/* Right: Item Count + Filter Button + Sort Dropdown */}
        <div className="product-toolbar-actions">
          {/* Item count */}
          <span className="product-toolbar-count">
            {itemCount.toLocaleString()} item{itemCount !== 1 ? "s" : ""}
          </span>

          {/* Filter & Categories button */}
          {showFilterButton && (
            <button
              onClick={onFilterClick}
              className="product-toolbar-btn"
            >
              <span>☰</span>
              <span>Filter & Categories</span>
              {activeFilterCount > 0 && (
                <span className="product-toolbar-badge">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {/* Sort by dropdown */}
          <div ref={sortRef} style={{ position: "relative" }}>
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="product-toolbar-btn"
            >
              <span>Sort by: <strong>{currentSort.label}</strong></span>
              <span style={{ fontSize: "10px", transition: "transform 200ms", transform: sortOpen ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
            </button>

            {sortOpen && (
              <div className="product-sort-dropdown">
                <div className="product-sort-header">
                  Sort by
                </div>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
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

      <style>{`
        .product-toolbar-wrapper {
          width: 100%;
          margin-bottom: 24px;
          padding-bottom: 14px;
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
          min-width: 200px;
        }
        .product-toolbar-subtitle {
          margin: 0 0 2px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${textSecondary};
        }
        .product-toolbar-title {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: ${textPrimary};
        }
        .product-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .product-toolbar-count {
          font-size: 13px;
          color: ${textSecondary};
          font-weight: 500;
        }
        .product-toolbar-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 999px;
          border: 1px solid ${borderColor};
          background: ${btnBg};
          color: ${textPrimary};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 180ms ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .product-toolbar-btn:hover {
          transform: translateY(-1px);
        }
        .product-toolbar-badge {
          background: ${accentColor};
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 999px;
          margin-left: 2px;
        }
        .product-sort-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 280px;
          max-width: calc(100vw - 32px);
          border-radius: 16px;
          border: 1px solid ${borderColor};
          background: ${dropdownBg};
          box-shadow: ${isDark ? "0 20px 45px rgba(0,0,0,0.6)" : "0 20px 45px rgba(15,23,42,0.18)"};
          padding: 8px;
          z-index: 99999;
          animation: sortDropIn 200ms ease;
        }
        .product-sort-header {
          padding: 10px 14px 8px;
          font-size: 14px;
          font-weight: 700;
          color: ${textPrimary};
          border-bottom: 1px solid ${borderColor};
          margin-bottom: 4px;
        }
        .product-sort-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: background 150ms ease;
          text-align: left;
        }

        @media (max-width: 640px) {
          .product-toolbar-container {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .product-toolbar-actions {
            width: 100%;
            justify-content: space-between;
          }
          .product-toolbar-btn {
            flex: 1;
            justify-content: center;
            padding: 10px 12px;
            font-size: 12px;
          }
          .product-toolbar-count {
            display: none;
          }
          .product-sort-dropdown {
            right: 0;
            left: auto;
            width: min(280px, calc(100vw - 24px));
          }
        }
        @keyframes sortDropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default FilterSidebar;