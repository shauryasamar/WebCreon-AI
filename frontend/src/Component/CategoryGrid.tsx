import React from "react";
import { Link, useParams } from "react-router-dom";
import { useCart } from "../CartContext";

type Category = {
  name: string;
  image?: string;
};

type CategoryGridProps = {
  title?: string;
  categories?: Category[];
  theme?: any;
};

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  title = "Shop by Category",
  categories = [],
  theme,
}) => {
  const { products } = useCart();
  const { siteId, slug: siteSlug } = useParams();

  const isStoreRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/store/");
  const appBase = isStoreRoute
    ? siteSlug
      ? `/store/${siteSlug}`
      : "/store"
    : `/builder/${siteId}`;

  // Only show if categories are explicitly provided, otherwise do not clutter the page
  if (!categories || categories.length === 0) {
    return null;
  }

  const isDark = theme?.mode === "dark";
  const titleColor = isDark ? "#ffffff" : "#0f172a";

  return (
    <section
      style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      <h3
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
          fontWeight: 800,
          color: titleColor,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {categories.map((category, index) => (
          <Link
            key={`${category.name}-${index}`}
            to={`${appBase}?category=${encodeURIComponent(category.name)}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px",
              background: isDark ? "#18181b" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
              borderRadius: "14px",
              textDecoration: "none",
              color: titleColor,
              fontWeight: 700,
              fontSize: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              transition: "all 0.18s ease",
            }}
          >
            {category.name}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default CategoryGrid;