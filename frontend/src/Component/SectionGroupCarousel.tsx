import React, { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { isColorDarkHex } from "../context/ThemeContext";
import { optimizeImageUrl } from "../utils/imageOptimizer";
import { generateSectionFilterUrl } from "./ProductCarousel";

export interface SectionGroupTile {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  link?: string;
  category?: string;
  brand?: string;
  collection_id?: string;
  product_type?: string;
  sort_by?: "bestseller" | "rating_desc" | "newest" | "price_asc" | "price_desc" | "discount_desc";
  min_price?: number;
  max_price?: number;
  in_stock_only?: boolean;
}

export interface SectionGroupCarouselProps {
  siteId?: string;
  title?: string;
  subtitle?: string;
  viewAllLink?: string;
  items?: SectionGroupTile[];
  tiles?: SectionGroupTile[];
  cardShape?: "portrait" | "horizontal" | "square" | "circle" | "pill";
  layout?: "carousel" | "grid";
  theme?: {
    primary_bg?: string;
    secondary_bg?: string;
    text_color?: string;
    accent_color?: string;
    card_bg?: string;
    mode?: string;
    [key: string]: any;
  };
}

export const SectionGroupCarousel: React.FC<SectionGroupCarouselProps> = ({
  siteId,
  title,
  subtitle,
  viewAllLink,
  items,
  tiles,
  cardShape = "portrait",
  layout = "carousel",
  theme,
}) => {
  const location = useLocation();
  const { slug: siteSlug } = useParams();

  const rawTiles: SectionGroupTile[] = useMemo(() => {
    return Array.isArray(items) ? items : Array.isArray(tiles) ? tiles : [];
  }, [items, tiles]);

  const isDark =
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
    theme?.mode === "dark";

  const isLight = !isDark;
  const textColor = theme?.text_color || (isLight ? "#0f172a" : "#f8fafc");
  const subtextColor = isLight ? "rgba(15, 23, 42, 0.65)" : "rgba(241, 245, 249, 0.65)";
  const accentColor = theme?.accent_color || "#2563eb";
  const cardBg = theme?.card_bg || (isLight ? "#ffffff" : "rgba(30, 41, 59, 0.7)");
  const cardBorder = isLight ? "1px solid rgba(226, 232, 240, 0.8)" : "1px solid rgba(255, 255, 255, 0.08)";

  const isStoreRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/store/");
  const appBase = isStoreRoute
    ? siteSlug
      ? `/store/${siteSlug}`
      : "/store"
    : `/builder/${siteId}`;

  // Helper to generate clean link for each tile
  const getTileTargetUrl = (tile: SectionGroupTile): string => {
    if (tile.link && tile.link.trim().length > 0) {
      const l = tile.link.trim();
      if (l.startsWith("?")) return `${location.pathname}${l}`;
      if (l.startsWith("/")) return `${appBase}${l.replace(/^\/+/, "")}`;
      return `${appBase}/${l}`;
    }

    const rules = {
      category: tile.category,
      brand: tile.brand,
      collection_id: tile.collection_id,
      product_type: tile.product_type,
      sort_by: tile.sort_by,
      min_price: tile.min_price,
      max_price: tile.max_price,
      in_stock_only: tile.in_stock_only,
    };

    const filterUrl = generateSectionFilterUrl(
      tile.title || "Collection",
      rules,
      undefined,
      tile.id
    );

    return filterUrl.startsWith("?") ? `${location.pathname}${filterUrl}` : filterUrl;
  };

  if (rawTiles.length === 0) {
    return null;
  }

  // Dimensions based on cardShape
  const getShapeStyles = () => {
    switch (cardShape) {
      case "circle":
        return {
          cardWidth: "120px",
          imageHeight: "120px",
          borderRadius: "50%",
          isCircular: true,
        };
      case "horizontal":
        return {
          cardWidth: "280px",
          imageHeight: "155px",
          borderRadius: "14px",
          isCircular: false,
        };
      case "square":
        return {
          cardWidth: "180px",
          imageHeight: "180px",
          borderRadius: "14px",
          isCircular: false,
        };
      case "pill":
        return {
          cardWidth: "140px",
          imageHeight: "95px",
          borderRadius: "20px",
          isCircular: false,
        };
      case "portrait":
      default:
        return {
          cardWidth: "200px",
          imageHeight: "260px",
          borderRadius: "14px",
          isCircular: false,
        };
    }
  };

  const shapeConfig = getShapeStyles();

  const hasTitle = Boolean(title && title.trim().length > 0);
  const hasSubtitle = Boolean(subtitle && subtitle.trim().length > 0);
  const hasViewAll = Boolean(viewAllLink && viewAllLink.trim().length > 0);
  const hasHeader = hasTitle || hasSubtitle || hasViewAll;

  return (
    <section
      className="section-group-carousel"
      style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "24px 16px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Header with Title, Subtitle, and View All Link */}
      {hasHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: "16px",
            gap: "12px",
          }}
        >
          <div>
            {hasTitle && (
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 800,
                  color: textColor,
                  letterSpacing: "-0.02em",
                }}
              >
                {title}
              </h2>
            )}
            {hasSubtitle && (
              <p
                style={{
                  margin: hasTitle ? "4px 0 0" : 0,
                  fontSize: "13px",
                  color: subtextColor,
                  fontWeight: 500,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {hasViewAll && (
            <div style={{ display: "flex", alignItems: "center", marginLeft: "auto" }}>
              <Link
                to={viewAllLink!.startsWith("?") ? `${location.pathname}${viewAllLink}` : viewAllLink!}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: accentColor,
                  textDecoration: "none",
                }}
              >
                View All &gt;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tiles Container: Carousel (Horizontal Scroll) or Multi-Column Grid */}
      <div
        style={
          layout === "grid"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "16px",
              }
            : {
                display: "flex",
                gap: "14px",
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                paddingBottom: "8px",
                WebkitOverflowScrolling: "touch",
              }
        }
      >
        <style>{`
          .section-group-tile-hover:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px -6px rgba(0,0,0,0.15) !important;
          }
          .section-group-tile-hover:hover img {
            transform: scale(1.05);
          }
        `}</style>

        {rawTiles.map((tile, idx) => {
          const targetUrl = getTileTargetUrl(tile);
          const optimizedImg = tile.imageUrl ? optimizeImageUrl(tile.imageUrl) : "";

          // Circular layout (Avatar / Story pill style)
          if (shapeConfig.isCircular) {
            return (
              <Link
                key={tile.id || idx}
                to={targetUrl}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                style={{
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  flexShrink: 0,
                  width: shapeConfig.cardWidth,
                  scrollSnapAlign: "start",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: shapeConfig.imageHeight,
                    height: shapeConfig.imageHeight,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: `2px solid ${accentColor}`,
                    padding: "3px",
                    background: cardBg,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    transition: "transform 0.2s ease",
                  }}
                  className="section-group-tile-hover"
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: isLight ? "#f1f5f9" : "#1e293b",
                    }}
                  >
                    {optimizedImg ? (
                      <img
                        src={optimizedImg}
                        alt={tile.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          transition: "transform 0.3s ease",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "grid",
                          placeItems: "center",
                          color: "#94a3b8",
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "center", width: "100%" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {tile.title}
                  </div>
                  {tile.subtitle && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: accentColor,
                        fontWeight: 600,
                        marginTop: "1px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tile.subtitle}
                    </div>
                  )}
                </div>
              </Link>
            );
          }

          // Portrait, Horizontal, Square & Pill Card Layout
          return (
            <Link
              key={tile.id || idx}
              to={targetUrl}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="section-group-tile-hover"
              style={{
                textDecoration: "none",
                flexShrink: 0,
                width: layout === "grid" ? "100%" : shapeConfig.cardWidth,
                height: shapeConfig.imageHeight,
                borderRadius: shapeConfig.borderRadius,
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                background: isLight ? "#f1f5f9" : "#1e293b",
                border: cardBorder,
                boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                scrollSnapAlign: "start",
                cursor: "pointer",
              }}
            >
              {/* Card Image */}
              {optimizedImg ? (
                <img
                  src={optimizedImg}
                  alt={tile.title}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.4s ease",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}

              {/* Gradient Scrim for text readability */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.85) 100%)",
                  pointerEvents: "none",
                }}
              />

              {/* Top Badge (if any) */}
              {tile.subtitle && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    background: "rgba(15, 23, 42, 0.85)",
                    backdropFilter: "blur(6px)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.02em",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  {tile.subtitle}
                </div>
              )}

              {/* Bottom Card Title (Clean, without explore button) */}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: "14px",
                  color: "#ffffff",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 800,
                    lineHeight: 1.25,
                    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                >
                  {tile.title}
                </h3>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default SectionGroupCarousel;
