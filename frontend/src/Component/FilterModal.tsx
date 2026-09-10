import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { isColorDarkHex } from "../context/ThemeContext";
import { useDeviceMode } from "../context/DeviceModeContext";

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
  priceRange = { min: 0, max: 100000 },
  theme,
  container,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [draft, setDraft] = useState<FilterState>(currentFilters);
  const [tabSearchQuery, setTabSearchQuery] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const deviceMode = useDeviceMode();
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = deviceMode === "mobile" || windowWidth <= 640;

  const isInline = Boolean(container);
  const targetContainer = container || document.body;

  const isDark =
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    (theme?.secondary_bg ? isColorDarkHex(theme.secondary_bg) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
    theme?.mode === "dark";

  const rawBg = (theme as any)?.dialog_bg || (theme as any)?.surface_bg || theme?.primary_bg;
  const bg = rawBg || (isDark ? "#0f172a" : "#ffffff");
  const navBg = (theme as any)?.nav_bg || (theme as any)?.secondary_bg || (isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(0, 0, 0, 0.025)");
  const panelBg = bg;
  const cardBg = (theme as any)?.card_bg || (isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.035)");
  const textPrimary = theme?.text_color || (isDark ? "#f8fafc" : "#0f172a");
  const textSecondary = (theme as any)?.muted_text_color || (isDark ? "rgba(248, 250, 252, 0.65)" : "rgba(15, 23, 42, 0.65)");
  const borderColor = (theme as any)?.border_color || (isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)");

  const accentColor = theme?.accent_color || "#3b82f6";
  const activeBg = `${accentColor}1c`;

  useEffect(() => {
    if (open) {
      setDraft(currentFilters);
      setActiveTab("categories");
      setTabSearchQuery("");
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
    setTabSearchQuery("");
  }, [activeTab]);

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

  // Selected counts per tab & overall
  const getTabCount = useCallback(
    (tab: Tab): number => {
      switch (tab) {
        case "categories":
          return draft.categoryId ? 1 : 0;
        case "price":
          return draft.minPrice > priceRange.min || draft.maxPrice < priceRange.max ? 1 : 0;
        case "collection":
          return draft.collections.length;
        case "type":
          return draft.productTypes.length;
        case "brand":
          return draft.brands.length;
        default:
          return 0;
      }
    },
    [draft, priceRange]
  );

  const totalActiveCount = useMemo(() => {
    return (
      (draft.categoryId ? 1 : 0) +
      draft.collections.length +
      draft.productTypes.length +
      draft.brands.length +
      (draft.minPrice > priceRange.min || draft.maxPrice < priceRange.max ? 1 : 0)
    );
  }, [draft, priceRange]);

  // Faceted option computations based on products
  const categoryCounts = useCallback(
    (catId: string) => {
      if (!products || products.length === 0) return null;
      return products.filter(
        (p) =>
          matchesCategory(p, catId, categories) &&
          matchesCollections(p, draft.collections, collections) &&
          matchesTypes(p, draft.productTypes) &&
          matchesBrands(p, draft.brands)
      ).length;
    },
    [products, draft.collections, draft.productTypes, draft.brands, categories, collections]
  );

  const collectionCounts = useCallback(
    (colId: string) => {
      if (!products || products.length === 0) return null;
      return products.filter(
        (p) =>
          matchesCategory(p, draft.categoryId, categories) &&
          matchesCollections(p, [colId], collections) &&
          matchesTypes(p, draft.productTypes) &&
          matchesBrands(p, draft.brands)
      ).length;
    },
    [products, draft.categoryId, draft.productTypes, draft.brands, categories, collections]
  );

  const dynamicProductTypes = useCallback(() => {
    if (!products || products.length === 0) {
      return productTypes.map((pt) => ({ name: pt, count: null }));
    }
    const matchingProds = products.filter(
      (p) =>
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
    const matchingProds = products.filter(
      (p) =>
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

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  // Quick price chips
  const quickPriceRanges = useMemo(() => {
    const max = priceRange.max || 100000;
    const ranges = [
      { label: "Under ₹500", min: 0, max: 500 },
      { label: "₹500 - ₹1,000", min: 500, max: 1000 },
      { label: "₹1,000 - ₹2,500", min: 1000, max: 2500 },
      { label: "₹2,500 - ₹5,000", min: 2500, max: 5000 },
      { label: "₹5,000+", min: 5000, max: max },
    ];
    return ranges.filter((r) => r.min < max);
  }, [priceRange.max]);

  const priceMatchingCount = useMemo(() => {
    if (!products || products.length === 0) return null;
    return products.filter((p) => {
      const price = Number(p.price || p.regular_price || p.sale_price || 0);
      return price >= draft.minPrice && price <= draft.maxPrice;
    }).length;
  }, [products, draft.minPrice, draft.maxPrice]);

  if (!open) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "categories", label: "Categories" },
    { key: "price", label: "Price" },
    { key: "collection", label: "Collections" },
    { key: "type", label: "Product Type" },
    { key: "brand", label: "Brands" },
  ];

  const renderSearchBox = (placeholder: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 10px",
        borderRadius: "8px",
        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
        border: `1px solid ${borderColor}`,
        marginBottom: "10px",
        flexShrink: 0,
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={textSecondary}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={tabSearchQuery}
        onChange={(e) => setTabSearchQuery(e.target.value)}
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          width: "100%",
          fontSize: "12px",
          color: textPrimary,
        }}
      />
      {tabSearchQuery && (
        <button
          onClick={() => setTabSearchQuery("")}
          style={{
            background: "none",
            border: "none",
            fontSize: "12px",
            color: textSecondary,
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: 1,
          }}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );

  const renderRightPanel = () => {
    switch (activeTab) {
      case "categories": {
        const displayCategories =
          categories.length > 0
            ? categories
            : productTypes.map((pt) => ({ id: pt, name: pt }));

        const filteredCategories = displayCategories.filter((cat) =>
          cat.name.toLowerCase().includes(tabSearchQuery.toLowerCase().trim())
        );

        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ marginBottom: "10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: textPrimary }}>
                  Categories
                </h3>
                {draft.categoryId && (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: accentColor }}>
                    1 selected
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: textSecondary }}>
                Filter products by broad category
              </p>
            </div>

            {displayCategories.length > 4 && renderSearchBox("Search categories...")}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, overflowY: "auto", paddingRight: "2px" }}>
              {/* All Categories Option (hidden if searching) */}
              {!tabSearchQuery && (
                <div
                  onClick={() => selectCategory(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "9px",
                    border: `1px solid ${draft.categoryId === null ? accentColor : borderColor}`,
                    background: draft.categoryId === null ? activeBg : cardBg,
                    cursor: "pointer",
                    transition: "all 140ms ease",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: draft.categoryId === null ? 700 : 500, color: textPrimary }}>
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
              )}

              {filteredCategories.length === 0 ? (
                <div style={{ padding: "24px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                  {tabSearchQuery ? `No categories match "${tabSearchQuery}"` : "No categories available."}
                </div>
              ) : (
                filteredCategories.map((cat) => {
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
                        padding: "9px 12px",
                        borderRadius: "9px",
                        border: `1px solid ${selected ? accentColor : borderColor}`,
                        background: selected ? activeBg : cardBg,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: selected ? 700 : 500,
                            color: textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cat.name}
                        </span>
                        {count !== null && count > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: textSecondary,
                              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                              padding: "1px 6px",
                              borderRadius: "999px",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </div>
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
                })
              )}
            </div>
          </div>
        );
      }

      case "price":
        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
            <div style={{ marginBottom: "12px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: textPrimary }}>
                  Price Range
                </h3>
                {(draft.minPrice > priceRange.min || draft.maxPrice < priceRange.max) && (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: accentColor }}>
                    Filtered
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: textSecondary }}>
                Filter products within your desired budget
              </p>
            </div>

            {/* Quick Price Range Chips */}
            <div style={{ marginBottom: "14px", flexShrink: 0 }}>
              <div
                style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                Quick Presets
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {quickPriceRanges.map((chip, idx) => {
                  const isChipActive = draft.minPrice === chip.min && draft.maxPrice === chip.max;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (isChipActive) {
                          setDraft((d) => ({ ...d, minPrice: priceRange.min, maxPrice: priceRange.max }));
                        } else {
                          setDraft((d) => ({ ...d, minPrice: chip.min, maxPrice: Math.min(chip.max, priceRange.max) }));
                        }
                      }}
                      style={{
                        padding: "6px 11px",
                        borderRadius: "999px",
                        border: `1px solid ${isChipActive ? accentColor : borderColor}`,
                        background: isChipActive ? activeBg : cardBg,
                        color: isChipActive ? accentColor : textPrimary,
                        fontSize: "11.5px",
                        fontWeight: isChipActive ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Numeric Inputs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: "8px",
                marginBottom: "14px",
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: textSecondary, marginBottom: "4px" }}>
                  MIN (₹)
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "7px 10px",
                    borderRadius: "8px",
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <input
                    type="number"
                    min={priceRange.min}
                    max={draft.maxPrice}
                    value={draft.minPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDraft((d) => ({ ...d, minPrice: Math.max(priceRange.min, Math.min(val, d.maxPrice)) }));
                    }}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: textPrimary,
                    }}
                  />
                </div>
              </div>

              <span style={{ fontSize: "12px", color: textSecondary, paddingTop: "16px", fontWeight: 600 }}>
                —
              </span>

              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: textSecondary, marginBottom: "4px" }}>
                  MAX (₹)
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "7px 10px",
                    borderRadius: "8px",
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <input
                    type="number"
                    min={draft.minPrice}
                    max={priceRange.max}
                    value={draft.maxPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDraft((d) => ({ ...d, maxPrice: Math.min(priceRange.max, Math.max(val, d.minPrice)) }));
                    }}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: textPrimary,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Sliders Container */}
            <div
              style={{
                background: cardBg,
                padding: "14px",
                borderRadius: "12px",
                border: `1px solid ${borderColor}`,
                marginBottom: "12px",
                flexShrink: 0,
              }}
            >
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px" }}>
                  <span style={{ color: textSecondary, fontWeight: 500 }}>Min Price</span>
                  <span style={{ fontWeight: 700, color: textPrimary }}>₹{draft.minPrice.toLocaleString("en-IN")}</span>
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
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px" }}>
                  <span style={{ color: textSecondary, fontWeight: 500 }}>Max Price</span>
                  <span style={{ fontWeight: 700, color: textPrimary }}>₹{draft.maxPrice.toLocaleString("en-IN")}</span>
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
            </div>

            {/* Match summary indicator */}
            {priceMatchingCount !== null && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  border: `1px solid ${borderColor}`,
                  fontSize: "11.5px",
                  color: textSecondary,
                  textAlign: "center",
                  marginTop: "auto",
                }}
              >
                Matching: <strong style={{ color: textPrimary }}>{priceMatchingCount}</strong> items in this range
              </div>
            )}
          </div>
        );

      case "collection": {
        const filteredCollections = collections.filter((c) =>
          c.name.toLowerCase().includes(tabSearchQuery.toLowerCase().trim())
        );

        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ marginBottom: "10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: textPrimary }}>
                  Collections
                </h3>
                {draft.collections.length > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: accentColor }}>
                    {draft.collections.length} selected
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: textSecondary }}>
                Select curated collections
              </p>
            </div>

            {collections.length > 4 && renderSearchBox("Search collections...")}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, overflowY: "auto", paddingRight: "2px" }}>
              {filteredCollections.length === 0 ? (
                <div style={{ padding: "24px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                  {tabSearchQuery ? `No collections match "${tabSearchQuery}"` : "No collections available."}
                </div>
              ) : (
                filteredCollections.map((col) => {
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
                        padding: "9px 12px",
                        borderRadius: "9px",
                        border: `1px solid ${checked ? accentColor : borderColor}`,
                        background: checked ? activeBg : cardBg,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: checked ? 700 : 500,
                            color: textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {col.name}
                        </span>
                        {count !== null && count > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: textSecondary,
                              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                              padding: "1px 6px",
                              borderRadius: "999px",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        style={{ accentColor: accentColor, width: "15px", height: "15px", flexShrink: 0 }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      }

      case "type": {
        const typesList = dynamicProductTypes();
        const filteredTypes = typesList.filter((pt) =>
          pt.name.toLowerCase().includes(tabSearchQuery.toLowerCase().trim())
        );

        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ marginBottom: "10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: textPrimary }}>
                  Product Type
                </h3>
                {draft.productTypes.length > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: accentColor }}>
                    {draft.productTypes.length} selected
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: textSecondary }}>
                Filter by specific product types
              </p>
            </div>

            {typesList.length > 4 && renderSearchBox("Search product types...")}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, overflowY: "auto", paddingRight: "2px" }}>
              {filteredTypes.length === 0 ? (
                <div style={{ padding: "24px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                  {tabSearchQuery ? `No product types match "${tabSearchQuery}"` : "No product types available for the current selection."}
                </div>
              ) : (
                filteredTypes.map(({ name: pt, count }) => {
                  const checked = draft.productTypes.includes(pt);
                  return (
                    <div
                      key={pt}
                      onClick={() => setDraft((d) => ({ ...d, productTypes: toggleArray(d.productTypes, pt) }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        borderRadius: "9px",
                        border: `1px solid ${checked ? accentColor : borderColor}`,
                        background: checked ? activeBg : cardBg,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: checked ? 700 : 500,
                            color: textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pt}
                        </span>
                        {count !== null && count > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: textSecondary,
                              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                              padding: "1px 6px",
                              borderRadius: "999px",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        style={{ accentColor: accentColor, width: "15px", height: "15px", flexShrink: 0 }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      }

      case "brand": {
        const brandsList = dynamicBrands();
        const filteredBrands = brandsList.filter((b) =>
          b.name.toLowerCase().includes(tabSearchQuery.toLowerCase().trim())
        );

        return (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ marginBottom: "10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: textPrimary }}>
                  Brands
                </h3>
                {draft.brands.length > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: accentColor }}>
                    {draft.brands.length} selected
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: textSecondary }}>
                Filter by preferred brand
              </p>
            </div>

            {brandsList.length > 4 && renderSearchBox("Search brands...")}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, overflowY: "auto", paddingRight: "2px" }}>
              {filteredBrands.length === 0 ? (
                <div style={{ padding: "24px 0", fontSize: "12px", color: textSecondary, textAlign: "center" }}>
                  {tabSearchQuery ? `No brands match "${tabSearchQuery}"` : "No brands available for the current selection."}
                </div>
              ) : (
                filteredBrands.map(({ name: b, count }) => {
                  const checked = draft.brands.includes(b);
                  return (
                    <div
                      key={b}
                      onClick={() => setDraft((d) => ({ ...d, brands: toggleArray(d.brands, b) }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        borderRadius: "9px",
                        border: `1px solid ${checked ? accentColor : borderColor}`,
                        background: checked ? activeBg : cardBg,
                        cursor: "pointer",
                        transition: "all 140ms ease",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: checked ? 700 : 500,
                            color: textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b}
                        </span>
                        {count !== null && count > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: textSecondary,
                              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                              padding: "1px 6px",
                              borderRadius: "999px",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        style={{ accentColor: accentColor, width: "15px", height: "15px", flexShrink: 0 }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      }
    }
  };

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className={`filter-modal-overlay ${isMobile ? "is-mobile" : ""}`}
    >
      <div
        ref={modalRef}
        className="filter-modal-dialog"
      >
        {/* Grab Handle for Touch UI on Mobile */}
        {isMobile && (
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              padding: "7px 0 2px 0",
              flexShrink: 0,
              background: bg,
            }}
          >
            <div
              style={{
                width: "36px",
                height: "4px",
                borderRadius: "2px",
                background: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.18)",
              }}
            />
          </div>
        )}

        {/* --- Header --- */}
        <div className="filter-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? "15px" : "16px", fontWeight: 800, color: textPrimary, letterSpacing: "-0.01em" }}>
              Filters
            </h2>
            {totalActiveCount > 0 && (
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 800,
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 6px",
                  borderRadius: "999px",
                  background: accentColor,
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  boxSizing: "border-box",
                }}
              >
                {totalActiveCount}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {totalActiveCount > 0 && (
              <button
                onClick={handleClear}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: accentColor,
                  cursor: "pointer",
                  padding: "4px 6px",
                }}
              >
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                border: "none",
                fontSize: "13px",
                color: textSecondary,
                cursor: "pointer",
                width: "28px",
                height: "28px",
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* --- Body: Split Pane 2-Column Layout --- */}
        <div className="filter-modal-body">
          {/* Left Navigation Tabs */}
          <div className="filter-modal-left-nav">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = getTabCount(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: isMobile ? "11px 8px" : "11px 12px",
                    borderRadius: "8px",
                    border: "none",
                    borderLeft: isActive ? `3px solid ${accentColor}` : "3px solid transparent",
                    background: isActive ? activeBg : "transparent",
                    color: isActive ? accentColor : textPrimary,
                    fontSize: isMobile ? "12px" : "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 140ms ease",
                    boxSizing: "border-box",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {tab.label}
                  </span>
                  {count > 0 && (
                    <span
                      style={{
                        marginLeft: "4px",
                        minWidth: "18px",
                        height: "18px",
                        borderRadius: "999px",
                        background: accentColor,
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: "0 4px",
                        boxSizing: "border-box",
                        flexShrink: 0,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Content Panel */}
          <div className="filter-modal-right-content">
            {renderRightPanel()}
          </div>
        </div>

        {/* --- Footer Actions --- */}
        <div className="filter-modal-footer">
          <button
            onClick={handleClear}
            disabled={totalActiveCount === 0}
            style={{
              padding: "10px 16px",
              borderRadius: "9px",
              border: `1px solid ${borderColor}`,
              background: "transparent",
              color: totalActiveCount === 0 ? textSecondary : textPrimary,
              opacity: totalActiveCount === 0 ? 0.5 : 1,
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: totalActiveCount === 0 ? "default" : "pointer",
              transition: "all 140ms ease",
              flexShrink: 0,
            }}
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              padding: "10px 18px",
              borderRadius: "9px",
              border: "none",
              background: accentColor,
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 4px 14px ${accentColor}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "transform 100ms ease, box-shadow 140ms ease",
            }}
          >
            <span>Apply Filters</span>
            {totalActiveCount > 0 && (
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.25)",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 6px",
                  borderRadius: "999px",
                  fontSize: "10.5px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  boxSizing: "border-box",
                }}
              >
                {totalActiveCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes filterModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes filterModalPopIn {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes filterModalSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .filter-modal-overlay {
          position: ${isInline ? "absolute" : "fixed"};
          inset: 0;
          z-index: 99999;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: filterModalFadeIn 160ms ease-out;
          overscroll-behavior: contain;
          touch-action: none;
        }

        .filter-modal-dialog {
          width: 620px;
          max-width: 96vw;
          height: 520px;
          min-height: 520px;
          max-height: 85vh;
          border-radius: 18px;
          background: ${bg};
          border: 1px solid ${borderColor};
          box-shadow: ${isDark ? "0 24px 50px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255,255,255,0.08)" : "0 20px 45px rgba(15, 23, 42, 0.16)"};
          display: flex;
          flex-direction: column;
          overflow: hidden;
          overscroll-behavior: contain;
          animation: filterModalPopIn 160ms ease-out;
        }

        .filter-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          border-bottom: 1px solid ${borderColor};
          background: ${bg};
          flex-shrink: 0;
        }

        .filter-modal-body {
          display: flex;
          flex-direction: row;
          flex: 1;
          overflow: hidden;
          min-height: 0;
          height: 100%;
        }

        .filter-modal-left-nav {
          width: 165px;
          min-width: 165px;
          flex-shrink: 0;
          border-right: 1px solid ${borderColor};
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
          background: ${navBg};
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .filter-modal-right-content {
          flex: 1;
          padding: 14px 18px;
          overflow-y: auto;
          background: ${panelBg};
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          display: flex;
          flex-direction: column;
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

        /* Mobile Viewports (< 640px) */
        @media (max-width: 640px) {
          .filter-modal-overlay {
            padding: 0 !important;
            align-items: flex-end !important;
            justify-content: center !important;
          }
          .filter-modal-dialog {
            width: 100% !important;
            max-width: 100% !important;
            height: 84% !important;
            min-height: 84% !important;
            max-height: 84% !important;
            border-radius: 20px 20px 0 0 !important;
            border-bottom: none !important;
            border-left: none !important;
            border-right: none !important;
            box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.35) !important;
            animation: filterModalSlideUp 240ms cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .filter-modal-header {
            padding: 10px 14px !important;
          }
          .filter-modal-body {
            flex-direction: row !important;
            flex: 1 !important;
            min-height: 0 !important;
            height: 100% !important;
          }
          .filter-modal-left-nav {
            width: 114px !important;
            min-width: 114px !important;
            max-width: 114px !important;
            border-right: 1px solid ${borderColor} !important;
            border-bottom: none !important;
            padding: 8px 5px !important;
            flex-direction: column !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            white-space: normal !important;
            gap: 4px !important;
          }
          .filter-modal-right-content {
            flex: 1 !important;
            padding: 12px 12px !important;
            overflow-y: auto !important;
            height: 100% !important;
          }
          .filter-modal-footer {
            padding: 10px 14px !important;
            padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
          }
        }

        /* Mobile preview inside admin stage (when deviceMode === "mobile") */
        .filter-modal-overlay.is-mobile,
        .is-mobile-preview .filter-modal-overlay {
          padding: 0 !important;
          align-items: flex-end !important;
          justify-content: center !important;
        }
        .filter-modal-overlay.is-mobile .filter-modal-dialog,
        .is-mobile-preview .filter-modal-dialog {
          width: 100% !important;
          max-width: 100% !important;
          height: 84% !important;
          min-height: 84% !important;
          max-height: 84% !important;
          border-radius: 20px 20px 0 0 !important;
          border-bottom: none !important;
          border-left: none !important;
          border-right: none !important;
          box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.35) !important;
          animation: filterModalSlideUp 240ms cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .filter-modal-overlay.is-mobile .filter-modal-header,
        .is-mobile-preview .filter-modal-header {
          padding: 10px 14px !important;
        }
        .filter-modal-overlay.is-mobile .filter-modal-body,
        .is-mobile-preview .filter-modal-body {
          flex-direction: row !important;
          flex: 1 !important;
          min-height: 0 !important;
          height: 100% !important;
        }
        .filter-modal-overlay.is-mobile .filter-modal-left-nav,
        .is-mobile-preview .filter-modal-left-nav {
          width: 114px !important;
          min-width: 114px !important;
          max-width: 114px !important;
          border-right: 1px solid ${borderColor} !important;
          border-bottom: none !important;
          padding: 8px 5px !important;
          flex-direction: column !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          white-space: normal !important;
          gap: 4px !important;
        }
        .filter-modal-overlay.is-mobile .filter-modal-right-content,
        .is-mobile-preview .filter-modal-right-content {
          flex: 1 !important;
          padding: 12px 12px !important;
          overflow-y: auto !important;
          height: 100% !important;
        }
        .filter-modal-overlay.is-mobile .filter-modal-footer,
        .is-mobile-preview .filter-modal-footer {
          padding: 10px 14px !important;
          padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
        }
      `}</style>
    </div>,
    targetContainer
  );
};

export default FilterModal;
