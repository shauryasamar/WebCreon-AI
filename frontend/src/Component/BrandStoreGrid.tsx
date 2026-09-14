import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useCart } from "../CartContext";

export interface BrandStoreGridProps {
  title?: string;
  subtitle?: string;
  brands?: string[];
  maxBrands?: number;
  deliveryText?: string;
  theme?: any;
  max_width?: string;
}

export const BrandStoreGrid: React.FC<BrandStoreGridProps> = ({
  title = "Explore Official Brand Stores",
  subtitle,
  brands: explicitBrands,
  maxBrands = 8,
  deliveryText = "Delivery within 24 hours",
  theme,
  max_width,
}) => {
  const { products } = useCart();
  const { siteId, slug: siteSlug } = useParams();

  const isStoreRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/store/");
  const appBase = isStoreRoute
    ? siteSlug
      ? `/store/${siteSlug}`
      : "/store"
    : `/builder/${siteId}`;

  // Derive unique brands from active products
  const brandList = useMemo(() => {
    if (explicitBrands && explicitBrands.length > 0) {
      return explicitBrands.slice(0, maxBrands);
    }
    const set = new Set<string>();
    for (const p of products) {
      if (p.brand && typeof p.brand === "string" && p.brand.trim().length > 0) {
        set.add(p.brand.trim());
      }
    }
    const derived = Array.from(set);
    if (derived.length === 0) {
      return ["Adidas", "Nestle", "LG Electronics", "Dell", "Apple", "Chanel", "Zara Fashion", "Samsung"].slice(0, maxBrands);
    }
    return derived.slice(0, maxBrands);
  }, [explicitBrands, products, maxBrands]);

  const isDark = theme?.mode === "dark";
  const cardBg = isDark ? "#18181b" : "#ffffff";
  const cardBorder = isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0";
  const titleColor = isDark ? "#ffffff" : "#0f172a";
  const subtextColor = isDark ? "#a1a1aa" : "#64748b";
  const resolvedMaxWidth = max_width === "full" || !max_width ? "100%" : max_width;

  return (
    <section
      style={{
        width: "100%",
        maxWidth: resolvedMaxWidth,
        margin: "0 auto",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 800,
            color: titleColor,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: subtextColor }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Grid of brand pills */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        {brandList.map((brand, idx) => {
          const initials = brand
            .split(" ")
            .map((w) => w[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();

          return (
            <Link
              key={`${brand}-${idx}`}
              to={`${appBase}?brand=${encodeURIComponent(brand)}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                background: cardBg,
                border: cardBorder,
                borderRadius: "16px",
                textDecoration: "none",
                color: "inherit",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
                e.currentTarget.style.borderColor = "#3b82f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0";
              }}
            >
              {/* Brand Logo Avatar */}
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: isDark ? "#27272a" : "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: "14px",
                  color: isDark ? "#f4f4f5" : "#1e293b",
                  flexShrink: 0,
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
                }}
              >
                {initials}
              </div>

              {/* Brand Info */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: titleColor,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {brand}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginTop: "2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#10b981",
                      flexShrink: 0,
                    }}
                  />
                  <span>{deliveryText}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default BrandStoreGrid;
