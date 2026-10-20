import React from "react";
import { Link, useParams } from "react-router-dom";
import { useCart } from "../CartContext";
import { isColorDarkHex } from "../context/ThemeContext";

type Category = {
  name: string;
  image?: string;
};

type CategoryGridProps = {
  title?: string;
  categories?: Category[];
  theme?: any;
  max_width?: string;
  outer_bg_color?: string;
  card_bg_color?: string;
  card_border_color?: string;
  card_radius?: string | number;
  card_shadow?: string;
  title_color?: string;
  card_text_color?: string;
  grid_gap?: string | number;
  padding_y?: string | number;
  padding_x?: string | number;
  [key: string]: any;
};

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  title = "Shop by Category",
  categories = [],
  theme,
  max_width,
  outer_bg_color,
  card_bg_color,
  card_border_color,
  card_radius,
  card_shadow,
  title_color,
  card_text_color,
  grid_gap,
  padding_y,
  padding_x,
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

  const isDark =
    theme?.mode === "dark" ||
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false);

  const resolvedTitleColor =
    title_color ||
    (theme as any)?.title_color ||
    (theme as any)?.grid_text_color ||
    theme?.text_color ||
    (isDark ? "#ffffff" : "#0f172a");

  const cardBg =
    card_bg_color ||
    (theme as any)?.card_bg_color ||
    theme?.card_bg ||
    (isDark ? "#18181b" : "#ffffff");

  const isCardDark = isColorDarkHex(cardBg);
  const resolvedCardTextColor =
    card_text_color ||
    (theme as any)?.card_text_color ||
    (theme as any)?.title_color ||
    (isCardDark ? "#ffffff" : "#0f172a");

  const rawBorder = card_border_color || (theme as any)?.card_border_color || theme?.card_border_color || theme?.border_color;
  const cardBorder = rawBorder
    ? (String(rawBorder).startsWith("1px") || String(rawBorder).startsWith("2px") || String(rawBorder).includes("solid") ? String(rawBorder) : `1px solid ${rawBorder}`)
    : (isCardDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0");

  const resolvedCardRadius = card_radius || (theme as any)?.card_radius || "14px";
  const resolvedCardShadow = card_shadow || (theme as any)?.card_shadow || "0 1px 3px rgba(0,0,0,0.04)";
  const resolvedMaxWidth = max_width === "full" || !max_width ? "100%" : max_width;

  return (
    <section
      style={{
        width: "100%",
        maxWidth: resolvedMaxWidth,
        margin: "0 auto",
        padding: `${padding_y ?? 24}px ${padding_x ?? 16}px`,
        boxSizing: "border-box",
        backgroundColor: outer_bg_color || "transparent",
      }}
    >
      <h3
        style={{
          margin: "0 0 16px",
          fontSize: "20px",
          fontWeight: 800,
          color: resolvedTitleColor,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: typeof grid_gap === "number" ? `${grid_gap}px` : (grid_gap || "12px"),
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
              background: cardBg,
              border: cardBorder.startsWith("1px") || cardBorder.startsWith("2px") ? cardBorder : `1px solid ${cardBorder}`,
              borderRadius: typeof resolvedCardRadius === "number" ? `${resolvedCardRadius}px` : resolvedCardRadius,
              textDecoration: "none",
              color: resolvedCardTextColor,
              fontWeight: 700,
              fontSize: "14px",
              boxShadow: resolvedCardShadow,
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