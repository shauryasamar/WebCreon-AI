import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

export type FilterState = {
  categoryId: string | null;
  productTypes: string[];
  collections: string[];
  brands: string[];
  minPrice: number;
  maxPrice: number;
};

type CategoryOption = { id: string; name: string; slug?: string };
type CollectionOption = { id: string; name: string; slug?: string };

type FilterModalProps = {
  open: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
  categories: CategoryOption[];
  collections: CollectionOption[];
  productTypes: string[];
  brands: string[];
  priceRange: { min: number; max: number };
  theme?: Record<string, any>;
  container?: HTMLElement | null;
  isAdmin?: boolean;
};

type Tab = "categories" | "price" | "collection" | "type" | "brand";

const FilterModal: React.FC<FilterModalProps> = ({
  open,
  onClose,
  onApply,
  currentFilters,
  categories = [],
  collections = [],
  productTypes = [],
  brands = [],
  priceRange,
  theme,
  container,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [filtersAccordionOpen, setFiltersAccordionOpen] = useState(true);
  const [draft, setDraft] = useState<FilterState>(currentFilters);
  const modalRef = useRef<HTMLDivElement>(null);

  const isInline = Boolean(container);
  const targetContainer = container || document.body;

  const isDark = theme?.mode !== "light";
  
  // Theme-aware palette that adapts dynamically to Festive, Dark, Light, Emerald, Gold, etc.
  const rawBg = (theme as any)?.dialog_bg || (theme as any)?.surface_bg || theme?.primary_bg;
  const bg = rawBg || (isDark ? "#0f172a" : "#ffffff");
  const navBg = (theme as any)?.nav_bg || (theme as any)?.secondary_bg || (isDark ? "rgba(0, 0, 0, 0.28)" : "rgba(0, 0, 0, 0.03)");
  const panelBg = bg;
  const cardBg = (theme as any)?.card_bg || (isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.04)");
  const textPrimary = theme?.text_color || (isDark ? "#f8fafc" : "#0f172a");
  const textSecondary = (theme as any)?.muted_text_color || (isDark ? "rgba(248, 250, 252, 0.65)" : "rgba(15, 23, 42, 0.65)");
  const borderColor = (theme as any)?.border_color || (isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)");
  
  const accentColor = theme?.accent_color || "#3b82f6";
  const activeBg = `${accentColor}22`;

  useEffect(() => {
    if (open) {
      setDraft(currentFilters);
      setActiveTab("categories");
      if (!isInline) {
        document.body.style.overflow = "hidden";
      }
    }
    return () => {
      if (!isInline) {
        document.body.style.overflow = "";
      }
    };
  }, [open, currentFilters, isInline]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const handleClear = () => {
    setDraft({
      categoryId: null,
      productTypes: [],
      collections: [],
      brands: [],
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  if (!open) return null;

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const renderRightPanel = () => {
    switch (activeTab) {
      case "categories":
        return (
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: textPrimary }}>
              Categories
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: textSecondary }}>
              Filter products by broad category
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* All Option */}
              <div
                onClick={() => setDraft((d) => ({ ...d, categoryId: null }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${draft.categoryId === null ? accentColor : borderColor}`,
                  background: draft.categoryId === null ? activeBg : cardBg,
                  cursor: "pointer",
                  transition: "all 140ms ease",
                  boxShadow: draft.categoryId === null ? `0 0 10px ${accentColor}20` : "none",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: draft.categoryId === null ? 700 : 500, color: textPrimary }}>
                  All Categories
                </span>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "999px",
                    border: `2px solid ${draft.categoryId === null ? accentColor : textSecondary}`,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {draft.categoryId === null && (
                    <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: accentColor }} />
                  )}
                </div>
              </div>

              {/* Dynamic Categories with productTypes fallback */}
              {(() => {
                const displayCategories =
                  categories.length > 0
                    ? categories
                    : productTypes.map((pt) => ({ id: pt, name: pt }));

                if (displayCategories.length === 0) {
                  return (
                    <div style={{ padding: "16px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                      No categories available yet.
                    </div>
                  );
                }

                return displayCategories.map((cat) => {
                  const selected = draft.categoryId === cat.id || draft.categoryId === cat.name;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setDraft((d) => ({ ...d, categoryId: cat.id }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: `1px solid ${selected ? accentColor : borderColor}`,
                        background: selected ? activeBg : cardBg,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                        boxShadow: selected ? `0 0 10px ${accentColor}20` : "none",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: selected ? 700 : 500, color: textPrimary }}>
                        {cat.name}
                      </span>
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          border: `2px solid ${selected ? accentColor : textSecondary}`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {selected && (
                          <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: accentColor }} />
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        );

      case "price":
        return (
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: textPrimary }}>
              Price Range
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: textSecondary }}>
              Filter products by price range
            </p>
            <div style={{ background: cardBg, padding: "16px", borderRadius: "12px", border: `1px solid ${borderColor}` }}>
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: textSecondary }}>Min Price</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: textPrimary }}>
                    ₹{draft.minPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={draft.minPrice}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDraft((d) => ({ ...d, minPrice: Math.min(val, d.maxPrice) }));
                  }}
                  style={{ width: "100%", accentColor: accentColor }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: textSecondary }}>Max Price</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: textPrimary }}>
                    ₹{draft.maxPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={draft.maxPrice}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDraft((d) => ({ ...d, maxPrice: Math.max(val, d.minPrice) }));
                  }}
                  style={{ width: "100%", accentColor: accentColor }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "11px", color: textSecondary, fontWeight: 600 }}>
                <span>₹{priceRange.min.toLocaleString("en-IN")}</span>
                <span>₹{priceRange.max.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        );

      case "collection":
        return (
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: textPrimary }}>
              Collections
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: textSecondary }}>
              Select collections
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {collections.map((col) => {
                const checked = draft.collections.includes(col.id) || draft.collections.includes(col.name);
                return (
                  <div
                    key={col.id}
                    onClick={() => setDraft((d) => ({ ...d, collections: toggleArray(d.collections, col.id) }))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: `1px solid ${checked ? accentColor : borderColor}`,
                      background: checked ? activeBg : cardBg,
                      cursor: "pointer",
                      transition: "all 140ms ease",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: checked ? 700 : 500, color: textPrimary }}>
                      {col.name}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      style={{ accentColor: accentColor, width: "15px", height: "15px" }}
                    />
                  </div>
                );
              })}
              {collections.length === 0 && (
                <div style={{ padding: "16px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                  No collections created yet.
                </div>
              )}
            </div>
          </div>
        );

      case "type":
        return (
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: textPrimary }}>
              Product Type
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: textSecondary }}>
              Select product types
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {productTypes.map((pt) => {
                const checked = draft.productTypes.includes(pt);
                return (
                  <div
                    key={pt}
                    onClick={() => setDraft((d) => ({ ...d, productTypes: toggleArray(d.productTypes, pt) }))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: `1px solid ${checked ? accentColor : borderColor}`,
                      background: checked ? activeBg : cardBg,
                      cursor: "pointer",
                      transition: "all 140ms ease",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: checked ? 700 : 500, color: textPrimary }}>
                      {pt}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      style={{ accentColor: accentColor, width: "15px", height: "15px" }}
                    />
                  </div>
                );
              })}
              {productTypes.length === 0 && (
                <div style={{ padding: "16px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                  No product types available.
                </div>
              )}
            </div>
          </div>
        );

      case "brand":
        return (
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: textPrimary }}>
              Brands
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: textSecondary }}>
              Select brands
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {brands.map((b) => {
                const checked = draft.brands.includes(b);
                return (
                  <div
                    key={b}
                    onClick={() => setDraft((d) => ({ ...d, brands: toggleArray(d.brands, b) }))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: `1px solid ${checked ? accentColor : borderColor}`,
                      background: checked ? activeBg : cardBg,
                      cursor: "pointer",
                      transition: "all 140ms ease",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: checked ? 700 : 500, color: textPrimary }}>
                      {b}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      style={{ accentColor: accentColor, width: "15px", height: "15px" }}
                    />
                  </div>
                );
              })}
              {brands.length === 0 && (
                <div style={{ padding: "16px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                  No brands available.
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className="filter-modal-overlay"
    >
      <div
        ref={modalRef}
        className="filter-modal-dialog"
      >
        {/* --- Header --- */}
        <div className="filter-modal-header">
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: textPrimary, letterSpacing: "-0.01em" }}>
            Filter & Categories
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "16px",
              color: textSecondary,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px",
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* --- Body Grid --- */}
        <div className="filter-modal-body">
          {/* Left Navigation Panel */}
          <div className="filter-modal-left-nav">
            {/* Top Categories Tab Button */}
            <button
              onClick={() => setActiveTab("categories")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: "8px",
                border: `1px solid ${activeTab === "categories" ? accentColor : borderColor}`,
                background: activeTab === "categories" ? activeBg : "transparent",
                color: activeTab === "categories" ? accentColor : textPrimary,
                fontSize: "13px",
                fontWeight: activeTab === "categories" ? 700 : 600,
                cursor: "pointer",
                transition: "all 140ms ease",
              }}
            >
              <span>Categories</span>
              <span className="nav-chevron">›</span>
            </button>

            {/* Accordion FILTERS Section */}
            <div className="filter-accordion-section">
              <button
                onClick={() => setFiltersAccordionOpen((prev) => !prev)}
                className="filter-accordion-header"
              >
                <span>FILTERS</span>
                <span style={{ fontSize: "9px" }}>{filtersAccordionOpen ? "▲" : "▼"}</span>
              </button>

              {filtersAccordionOpen && (
                <div className="filter-accordion-items">
                  {[
                    { key: "price" as Tab, label: "Price" },
                    { key: "collection" as Tab, label: "Collection" },
                    { key: "type" as Tab, label: "Type" },
                    { key: "brand" as Tab, label: "Brand" },
                  ].map((filterTab) => {
                    const isActive = activeTab === filterTab.key;
                    return (
                      <button
                        key={filterTab.key}
                        onClick={() => setActiveTab(filterTab.key)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "none",
                          background: isActive ? activeBg : "transparent",
                          color: isActive ? accentColor : textPrimary,
                          fontSize: "12px",
                          fontWeight: isActive ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 140ms ease",
                        }}
                      >
                        <span>{filterTab.label}</span>
                        <span className="nav-chevron">›</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="filter-modal-right-content">
            {renderRightPanel()}
          </div>
        </div>

        {/* --- Footer --- */}
        <div className="filter-modal-footer">
          <button
            onClick={handleClear}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: `1px solid ${borderColor}`,
              background: "transparent",
              color: textPrimary,
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: accentColor,
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 4px 12px ${accentColor}35`,
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>

      <style>{`
        .filter-modal-overlay {
          position: ${isInline ? "absolute" : "fixed"};
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${isDark ? "rgba(15, 23, 42, 0.45)" : "rgba(15, 23, 42, 0.35)"};
          padding: 16px;
          border-radius: ${isInline ? "inherit" : "0"};
        }
        .filter-modal-dialog {
          width: min(540px, 92vw);
          max-height: min(520px, 80vh);
          border-radius: 16px;
          background: ${bg};
          border: 1px solid ${borderColor};
          box-shadow: ${isDark ? "0 20px 45px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255,255,255,0.08)" : "0 20px 40px rgba(15, 23, 42, 0.15)"};
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .filter-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          border-bottom: 1px solid ${borderColor};
          flex-shrink: 0;
        }
        .filter-modal-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          min-height: 280px;
        }
        .filter-modal-left-nav {
          width: 170px;
          flex-shrink: 0;
          border-right: 1px solid ${borderColor};
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-y: auto;
          background: ${navBg};
        }
        .filter-accordion-section {
          margin-top: 6px;
        }
        .filter-accordion-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 4px;
          background: none;
          border: none;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${textSecondary};
          cursor: pointer;
        }
        .filter-accordion-items {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 2px;
        }
        .nav-chevron {
          font-size: 11px;
          color: ${textSecondary};
        }
        .filter-modal-right-content {
          flex: 1;
          padding: 16px 18px;
          overflow-y: auto;
          background: ${panelBg};
        }
        .filter-modal-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-top: 1px solid ${borderColor};
          background: ${bg};
          flex-shrink: 0;
        }

        /* Mobile (< 640px) */
        @media (max-width: 640px) {
          .filter-modal-overlay {
            padding: 12px;
            align-items: center;
          }
          .filter-modal-dialog {
            width: 94vw;
            max-height: 84vh;
            border-radius: 16px;
          }
          .filter-modal-header {
            padding: 10px 14px;
          }
          .filter-modal-body {
            flex-direction: column;
            min-height: auto;
          }
          .filter-modal-left-nav {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid ${borderColor};
            padding: 8px 10px;
            flex-direction: row;
            overflow-x: auto;
            gap: 6px;
            white-space: nowrap;
          }
          .filter-modal-left-nav button {
            flex-shrink: 0;
            width: auto !important;
            padding: 6px 12px !important;
            font-size: 12px !important;
          }
          .filter-accordion-section {
            display: flex;
            gap: 4px;
            margin-top: 0;
          }
          .filter-accordion-header {
            display: none;
          }
          .filter-accordion-items {
            flex-direction: row;
            gap: 4px;
            margin-top: 0;
          }
          .nav-chevron {
            display: none;
          }
          .filter-modal-right-content {
            padding: 14px 14px;
          }
          .filter-modal-footer {
            padding: 10px 14px;
          }
        }
      `}</style>
    </div>,
    targetContainer
  );
};

export default FilterModal;
