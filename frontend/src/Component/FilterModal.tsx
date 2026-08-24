import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { isColorDarkHex } from "../context/ThemeContext";

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
  products?: any[];
  priceRange: { min: number; max: number };
  theme?: Record<string, any>;
  container?: HTMLElement | null;
  isAdmin?: boolean;
};

type Tab = "categories" | "price" | "collection" | "type" | "brand";

function matchesCategory(p: any, categoryId: string | null, categories: CategoryOption[]): boolean {
  if (!categoryId) return true;
  const targetCatId = String(categoryId).toLowerCase().trim();
  const matchedCat = categories.find(
    (c) => String(c.id).toLowerCase().trim() === targetCatId || String(c.name).toLowerCase().trim() === targetCatId
  );
  const catIdToken = matchedCat ? String(matchedCat.id).toLowerCase().trim() : targetCatId;
  const catNameToken = matchedCat ? String(matchedCat.name).toLowerCase().trim() : targetCatId;
  const cleanName = catNameToken.trim();

  const isWordMatch = (text: string, target: string) => {
    if (!text || !target) return false;
    const t = text.toLowerCase().trim();
    const w = target.toLowerCase().trim();
    if (t === w) return true;
    const textWords = t.split(/[^a-z0-9]+/);
    if (!w.includes(" ")) {
      return textWords.includes(w);
    }
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(t);
  };

  const pCatId = p.category_id ? String(p.category_id).toLowerCase().trim() : "";
  const pCatName = p.category_name ? String(p.category_name).toLowerCase().trim() : "";
  const pCat = p.category ? String(p.category).toLowerCase().trim() : "";

  if (pCatId && pCatId === catIdToken) return true;
  if (pCatName && isWordMatch(pCatName, cleanName)) return true;
  if (pCat && isWordMatch(pCat, cleanName)) return true;
  return false;
}

function matchesCollections(p: any, selectedCollections: string[], collections: CollectionOption[]): boolean {
  if (!selectedCollections || selectedCollections.length === 0) return true;
  const selectedColTokens = new Set<string>();
  selectedCollections.forEach((colKey) => {
    const k = String(colKey).toLowerCase().trim();
    selectedColTokens.add(k);
    const matchCol = collections.find((c) => String(c.id).toLowerCase().trim() === k || String(c.name).toLowerCase().trim() === k);
    if (matchCol) {
      selectedColTokens.add(String(matchCol.id).toLowerCase().trim());
      selectedColTokens.add(String(matchCol.name).toLowerCase().trim());
      if (matchCol.slug) selectedColTokens.add(String(matchCol.slug).toLowerCase().trim());
    }
  });

  if (p.collections && Array.isArray(p.collections)) {
    const hasMatch = p.collections.some((col: any) => {
      const colId = col.id ? String(col.id).toLowerCase().trim() : "";
      const colName = col.name ? String(col.name).toLowerCase().trim() : "";
      const colSlug = col.slug ? String(col.slug).toLowerCase().trim() : "";
      return (
        selectedColTokens.has(colId) ||
        selectedColTokens.has(colName) ||
        selectedColTokens.has(colSlug) ||
        Array.from(selectedColTokens).some((t) => t && (colName.includes(t) || t.includes(colName)))
      );
    });
    if (hasMatch) return true;
  }
  const pCat = p.category ? String(p.category).toLowerCase().trim() : "";
  const pCatName = p.category_name ? String(p.category_name).toLowerCase().trim() : "";
  const pName = p.name ? String(p.name).toLowerCase().trim() : "";
  return Array.from(selectedColTokens).some(
    (token) => token && (pCat === token || pCat.includes(token) || pCatName === token || pName.includes(token))
  );
}

function matchesTypes(p: any, selectedTypes: string[]): boolean {
  if (!selectedTypes || selectedTypes.length === 0) return true;
  const types = selectedTypes.map((t) => String(t).toLowerCase().trim());
  const pCat = p.category ? String(p.category).toLowerCase().trim() : "";
  const pCatName = p.category_name ? String(p.category_name).toLowerCase().trim() : "";
  const pName = p.name ? String(p.name).toLowerCase().trim() : "";
  return types.some((st) => pCat === st || pCat.includes(st) || st.includes(pCat) || pCatName === st || pName.includes(st));
}

function matchesBrands(p: any, selectedBrands: string[]): boolean {
  if (!selectedBrands || selectedBrands.length === 0) return true;
  return p.brand && selectedBrands.includes(p.brand);
}

const FilterModal: React.FC<FilterModalProps> = ({
  open,
  onClose,
  onApply,
  currentFilters,
  categories = [],
  collections = [],
  productTypes = [],
  brands = [],
  products = [],
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

  const isDark =
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    (theme?.secondary_bg ? isColorDarkHex(theme.secondary_bg) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
    theme?.mode === "dark";
  
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
        const scrollY = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
      }
    }
    return () => {
      if (!isInline) {
        const scrollY = document.body.style.top;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || "0", 10) * -1);
        }
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

  // Faceted option computations based on products
  const categoryCounts = useCallback((catId: string) => {
    if (!products || products.length === 0) return null;
    return products.filter((p) =>
      matchesCategory(p, catId, categories) &&
      matchesCollections(p, draft.collections, collections) &&
      matchesTypes(p, draft.productTypes) &&
      matchesBrands(p, draft.brands)
    ).length;
  }, [products, draft.collections, draft.productTypes, draft.brands, categories, collections]);

  const collectionCounts = useCallback((colId: string) => {
    if (!products || products.length === 0) return null;
    return products.filter((p) =>
      matchesCategory(p, draft.categoryId, categories) &&
      matchesCollections(p, [colId], collections) &&
      matchesTypes(p, draft.productTypes) &&
      matchesBrands(p, draft.brands)
    ).length;
  }, [products, draft.categoryId, draft.productTypes, draft.brands, categories, collections]);

  const dynamicProductTypes = useCallback(() => {
    if (!products || products.length === 0) {
      return productTypes.map((pt) => ({ name: pt, count: null }));
    }
    const matchingProds = products.filter((p) =>
      matchesCategory(p, draft.categoryId, categories) &&
      matchesCollections(p, draft.collections, collections) &&
      matchesBrands(p, draft.brands)
    );

    const typeCountMap = new Map<string, number>();
    matchingProds.forEach((p) => {
      const typeVal = (p.category || p.category_name || "").trim();
      if (typeVal) {
        typeCountMap.set(typeVal, (typeCountMap.get(typeVal) || 0) + 1);
      }
    });

    const setTypes = new Set<string>();
    const list: { name: string; count: number }[] = [];

    typeCountMap.forEach((count, name) => {
      setTypes.add(name.toLowerCase());
      list.push({ name, count });
    });

    productTypes.forEach((pt) => {
      if (!setTypes.has(pt.toLowerCase())) {
        const count = matchingProds.filter((p) => matchesTypes(p, [pt])).length;
        if (count > 0) {
          setTypes.add(pt.toLowerCase());
          list.push({ name: pt, count });
        }
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, draft.categoryId, draft.collections, draft.brands, productTypes, categories, collections]);

  const dynamicBrands = useCallback(() => {
    if (!products || products.length === 0) {
      return brands.map((b) => ({ name: b, count: null }));
    }
    const matchingProds = products.filter((p) =>
      matchesCategory(p, draft.categoryId, categories) &&
      matchesCollections(p, draft.collections, collections) &&
      matchesTypes(p, draft.productTypes)
    );

    const brandCountMap = new Map<string, number>();
    matchingProds.forEach((p) => {
      if (p.brand && String(p.brand).trim()) {
        const bName = String(p.brand).trim();
        brandCountMap.set(bName, (brandCountMap.get(bName) || 0) + 1);
      }
    });

    const list: { name: string; count: number }[] = [];
    brandCountMap.forEach((count, name) => {
      list.push({ name, count });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, draft.categoryId, draft.collections, draft.productTypes, brands, categories, collections]);

  const selectCategory = (catId: string | null) => {
    setDraft((prev) => {
      const nextCategory = catId;
      if (!products || products.length === 0 || !nextCategory) {
        return { ...prev, categoryId: nextCategory };
      }
      const validProds = products.filter((p) => matchesCategory(p, nextCategory, categories));
      const validTypes = prev.productTypes.filter((pt) => validProds.some((p) => matchesTypes(p, [pt])));
      const validBrands = prev.brands.filter((b) => validProds.some((p) => matchesBrands(p, [b])));
      const validCols = prev.collections.filter((colId) => validProds.some((p) => matchesCollections(p, [colId], collections)));
      return {
        ...prev,
        categoryId: nextCategory,
        productTypes: validTypes,
        brands: validBrands,
        collections: validCols,
      };
    });
  };

  const toggleCollection = (colId: string) => {
    setDraft((prev) => {
      const nextCols = toggleArray(prev.collections, colId);
      if (!products || products.length === 0 || nextCols.length === 0) {
        return { ...prev, collections: nextCols };
      }
      const validProds = products.filter((p) => matchesCollections(p, nextCols, collections));
      const validTypes = prev.productTypes.filter((pt) => validProds.some((p) => matchesTypes(p, [pt])));
      const validBrands = prev.brands.filter((b) => validProds.some((p) => matchesBrands(p, [b])));
      return {
        ...prev,
        collections: nextCols,
        productTypes: validTypes,
        brands: validBrands,
      };
    });
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
                onClick={() => selectCategory(null)}
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

              {/* Dynamic Categories */}
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
                  const count = categoryCounts(cat.id);
                  return (
                    <div
                      key={cat.id}
                      onClick={() => selectCategory(cat.id)}
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
                const count = collectionCounts(col.id);
                return (
                  <div
                    key={col.id}
                    onClick={() => toggleCollection(col.id)}
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
              {(() => {
                const typesList = dynamicProductTypes();
                if (typesList.length === 0) {
                  return (
                    <div style={{ padding: "16px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                      No product types available for the selected category.
                    </div>
                  );
                }
                return typesList.map(({ name: pt, count }) => {
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
                });
              })()}
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
              {(() => {
                const brandsList = dynamicBrands();
                if (brandsList.length === 0) {
                  return (
                    <div style={{ padding: "16px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                      No brands available for the selected category.
                    </div>
                  );
                }
                return brandsList.map(({ name: b, count }) => {
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
                });
              })()}
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
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: filterModalFadeIn 150ms ease-out;
          overscroll-behavior: contain;
          touch-action: none;
        }
        .filter-modal-dialog {
          width: 580px;
          max-width: 96vw;
          max-height: 80vh;
          border-radius: 16px;
          background: ${bg};
          border: 1px solid ${borderColor};
          box-shadow: ${isDark ? "0 20px 45px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255,255,255,0.08)" : "0 20px 40px rgba(15, 23, 42, 0.15)"};
          display: flex;
          flex-direction: column;
          overflow: hidden;
          overscroll-behavior: contain;
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
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
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
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
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
