import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { GlassToast } from "./GlassToast";

export type FAQItem = {
  id: string;
  category_id: string;
  category_name: string;
  question: string;
  answer_rich_text: string;
  sort_order: number;
  is_featured_inline: boolean;
};

export type FAQCategory = {
  id: string;
  name: string;
  slug: string;
  icon_name?: string;
  sort_order: number;
};

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14 }}
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function CategoryIcon({ slug, size = 14 }: { slug: string; size?: number }) {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { width: size, height: size, flexShrink: 0 },
  };

  switch (slug) {
    case "billing-plans":
      return (
        <svg {...iconProps}>
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    case "domains-ssl":
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "storefront-products":
      return (
        <svg {...iconProps}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "orders-delivery":
      return (
        <svg {...iconProps}>
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "payments-payouts":
      return (
        <svg {...iconProps}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case "ai-credits-copilot":
      return (
        <svg {...iconProps}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
  }
}

function ChevronDownIcon({ open }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        width: 17,
        height: 17,
        transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        color: "#64748b",
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export const AdminFaqFullView: React.FC<{ siteId?: string; onBack?: () => void }> = ({ siteId, onBack }) => {
  const navigate = useNavigate();
  const { siteId: paramSiteId } = useParams<{ siteId?: string }>();
  const storedActiveSiteId = typeof window !== "undefined" ? (localStorage.getItem("last_active_site_id") || sessionStorage.getItem("last_active_site_id")) : null;
  const effectiveSiteId = siteId || paramSiteId || storedActiveSiteId || "site";

  // State
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Close filter popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch FAQ Catalog
  const fetchFaqs = useCallback(async (catSlug?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (catSlug && catSlug !== "all") params.append("category", catSlug);
      params.append("page_size", "50");

      const res = await fetch(`${API_BASE_URL}/api/help/faqs?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setItems(data.items || []);
      }
    } catch {
      setToast({ message: "Network error loading FAQs.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs(selectedCategorySlug);
  }, [fetchFaqs, selectedCategorySlug]);

  // Group items by category name
  const groupedItems = useMemo(() => {
    const map: Record<string, { slug: string; items: FAQItem[] }> = {};
    items.forEach((item) => {
      const cat = item.category_name || "General";
      const matchingCat = categories.find((c) => c.name === cat);
      const catSlug = matchingCat ? matchingCat.slug : "general";
      if (!map[cat]) map[cat] = { slug: catSlug, items: [] };
      map[cat].items.push(item);
    });
    return map;
  }, [items, categories]);

  const selectedCatObj = categories.find((c) => c.slug === selectedCategorySlug);
  const isFiltered = selectedCategorySlug !== "all";
  const currentFilterLabel = isFiltered ? (selectedCatObj?.name || "Filtered Category") : "Filter";

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(`/builder/${effectiveSiteId}/settings/help-support`);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .wc-faq-card { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .wc-faq-card:hover { border-color: #cbd5e1 !important; }
        .wc-filter-option:hover {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
      `}</style>

      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR (EXACT STRUCTURE AS ACTIVITY NAVBAR: MODE PILL ON LEFT,      */}
      {/*    FILTER ON RIGHT)                                                       */}
      {/* ========================================================================= */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "8px 12px",
          marginBottom: "12px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          position: "relative",
        }}
      >
        {/* Left Side: Mode Pill (Merchant Knowledge Base) */}
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <span
            style={{
              borderRadius: "6px",
              padding: "6px 16px",
              background: "#ffffff",
              color: "#0f172a",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              fontSize: "13px",
              fontWeight: 700,
              display: "inline-block",
              userSelect: "none",
            }}
          >
            Merchant Knowledge Base
          </span>
        </div>

        {/* Right Side: Filter Button with Popover (Exact Activity Navbar Shape & Size) */}
        <div ref={filterPopoverRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "36px",
              padding: "0 12px",
              borderRadius: "7px",
              border: isFiltered ? "1px solid #93c5fd" : "1px solid #cbd5e1",
              background: isFiltered ? "#eff6ff" : "#ffffff",
              color: isFiltered ? "#1d4ed8" : "#334155",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
            title="Toggle Filters"
          >
            <FilterIcon />
            <span>Filters</span>
            {isFiltered && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#2563eb",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "0 6px",
                  marginLeft: "2px",
                }}
              >
                1
              </span>
            )}
          </button>

          {/* Floating Filter Popover Modal */}
          {isFilterOpen && (
            <div
              style={{
                position: "absolute",
                top: "44px",
                right: "0",
                width: "260px",
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                padding: "8px",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <button
                type="button"
                className="wc-filter-option"
                onClick={() => {
                  setSelectedCategorySlug("all");
                  setIsFilterOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: selectedCategorySlug === "all" ? "#f1f5f9" : "transparent",
                  color: selectedCategorySlug === "all" ? "#0f172a" : "#475569",
                  fontSize: "12.5px",
                  fontWeight: selectedCategorySlug === "all" ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  All Categories
                </div>
                {selectedCategorySlug === "all" && <span style={{ color: "#0f62ab", fontSize: "13px", fontWeight: 700 }}>✓</span>}
              </button>

              {categories.map((cat) => {
                const isSelected = selectedCategorySlug === cat.slug;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className="wc-filter-option"
                    onClick={() => {
                      setSelectedCategorySlug(cat.slug);
                      setIsFilterOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: isSelected ? "#f1f5f9" : "transparent",
                      color: isSelected ? "#0f172a" : "#475569",
                      fontSize: "12.5px",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <CategoryIcon slug={cat.slug} size={13} />
                      {cat.name}
                    </div>
                    {isSelected && <span style={{ color: "#0f62ab", fontSize: "13px", fontWeight: 700 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BACK BUTTON (DOWN AFTER NAVBAR - BLACK COLOR)                          */}
      {/* ========================================================================= */}
      <div style={{ marginBottom: "10px" }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            background: "transparent",
            border: "none",
            color: "#0f172a",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            padding: "4px 2px",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Help & Support
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. FAQ CONTENT CARD (EXACT ACCORDION DESIGN AS POPULAR QUESTIONS)         */}
      {/* ========================================================================= */}
      <div
        className="wc-faq-card"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "18px 22px",
          marginBottom: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* Card Header: Title & Subtitle */}
        <div
          style={{
            paddingBottom: "14px",
            marginBottom: "14px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 3px 0",
              letterSpacing: "-0.01em",
            }}
          >
            Frequently Asked Questions
          </h2>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
            Find quick answers and setup guides for your store.
          </p>
        </div>

        {/* Card Body: Accordion Items */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px 0" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  height: "38px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
              No articles found in this category
            </h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#64748b" }}>
              Need help with custom setup? Submit an inquiry directly to our support team.
            </p>
            <button
              type="button"
              onClick={handleBack}
              style={{
                background: "#0f62ab",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "7px 16px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open Support Inquiry
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {Object.entries(groupedItems).map(([catName, { slug, items: catItems }], groupIndex) => (
              <div key={catName}>
                {/* Subtle category header when viewing All Categories */}
                {selectedCategorySlug === "all" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      paddingTop: groupIndex > 0 ? "18px" : "4px",
                      paddingBottom: "8px",
                    }}
                  >
                    <div style={{ color: "#0f62ab", display: "flex", alignItems: "center" }}>
                      <CategoryIcon slug={slug} size={13} />
                    </div>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {catName}
                    </span>
                  </div>
                )}

                {/* FAQ Questions */}
                {catItems.map((faq, index) => {
                  const isOpen = expandedFaqId === faq.id;
                  const isFirstItemInList = selectedCategorySlug !== "all" && index === 0;

                  return (
                    <div
                      key={faq.id}
                      style={{
                        borderTop: isFirstItemInList ? "none" : "1px solid #f1f5f9",
                        paddingTop: "12px",
                        paddingBottom: "12px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                        aria-expanded={isOpen}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "transparent",
                          border: "none",
                          padding: "2px 0",
                          cursor: "pointer",
                          textAlign: "left",
                          color: isOpen ? "#0f62ab" : "#0f172a",
                          fontSize: "13.5px",
                          fontWeight: 600,
                          lineHeight: "1.4",
                          gap: "12px",
                        }}
                      >
                        <span>{faq.question}</span>
                        <ChevronDownIcon open={isOpen} />
                      </button>

                      {isOpen && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "10px 14px",
                            background: "#f8fafc",
                            borderRadius: "8px",
                            fontSize: "13px",
                            lineHeight: 1.55,
                            color: "#334155",
                          }}
                        >
                          <p style={{ margin: 0 }}>{faq.answer_rich_text}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};




