import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { resolveThemeTokens } from "../context/ThemeContext";
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
  show_title?: boolean;
  show_subtitle?: boolean;
  title_alignment?: "left" | "center" | "right";
  title_font_size?: string | number;
  title_font_weight?: string | number;
  title_text_transform?: "none" | "uppercase" | "capitalize";
  subtitle_font_size?: string | number;
  subtitle_font_weight?: string | number;
  items?: SectionGroupTile[];
  tiles?: SectionGroupTile[];
  cardShape?: "portrait" | "horizontal" | "square" | "circle" | "pill" | "custom";
  card_width?: string | number;
  card_height?: string | number;
  card_padding?: string | number;
  card_text_position?: "bottom_overlay" | "top_overlay" | "center_overlay" | "below_card";
  card_title_size?: string | number;
  card_title_weight?: string | number;
  card_title_align?: "left" | "center" | "right";
  badge_style?: "pill" | "square" | "minimal" | "hidden";
  layout?: "carousel" | "grid";
  grid_columns?: number | string;
  grid_gap?: string | number;
  gap?: string | number;
  max_width?: string;
  padding_y?: string | number;
  padding_x?: string | number;
  outer_bg_color?: string;
  card_bg_color?: string;
  card_radius?: string | number;
  card_border_color?: string;
  card_shadow?: string;
  title_color?: string;
  subtitle_color?: string;
  accent_color?: string;
  image_fit?: "cover" | "contain";
  image_bg?: string;
  badge_bg_color?: string;
  badge_text_color?: string;
  theme?: {
    primary_bg?: string;
    secondary_bg?: string;
    text_color?: string;
    accent_color?: string;
    card_bg?: string;
    card_radius?: string | number;
    card_border_color?: string;
    card_shadow?: string;
    card_text_color?: string;
    muted_text_color?: string;
    mode?: string;
    [key: string]: any;
  };
}

export const SectionGroupCarousel: React.FC<SectionGroupCarouselProps> = ({
  siteId,
  title,
  subtitle,
  show_title = true,
  show_subtitle = true,
  title_alignment = "left",
  title_font_size,
  title_font_weight,
  title_text_transform = "none",
  subtitle_font_size,
  subtitle_font_weight,
  items,
  tiles,
  cardShape = "portrait",
  card_width,
  card_height,
  card_padding,
  card_text_position = "bottom_overlay",
  card_title_size,
  card_title_weight,
  card_title_align,
  badge_style = "pill",
  layout = "carousel",
  grid_columns,
  grid_gap,
  gap,
  max_width,
  padding_y,
  padding_x,
  outer_bg_color,
  card_bg_color,
  card_radius,
  card_border_color,
  card_shadow,
  title_color,
  subtitle_color,
  accent_color,
  image_fit = "cover",
  image_bg,
  badge_bg_color,
  badge_text_color,
  theme,
}) => {
  const location = useLocation();
  const { slug: siteSlug } = useParams();

  // Mobile viewport detection
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 640;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkBreakpoint = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener("resize", checkBreakpoint, { passive: true });
    return () => window.removeEventListener("resize", checkBreakpoint);
  }, []);

  const rawTiles: SectionGroupTile[] = useMemo(() => {
    return Array.isArray(items) && items.length > 0 ? items : Array.isArray(tiles) ? tiles : [];
  }, [items, tiles]);

  // Theme Dynamic Resolution
  const tokens = resolveThemeTokens(theme);
  const isDark = tokens.isDark;
  const isLight = !isDark;

  const resolvedOuterBg = outer_bg_color || "transparent";
  const resolvedCardBg = card_bg_color || theme?.card_bg || tokens.cardBg;
  
  const rawRadius =
    card_radius !== undefined && card_radius !== null
      ? card_radius
      : (theme as any)?.card_radius !== undefined && (theme as any)?.card_radius !== null
      ? (theme as any).card_radius
      : "14px";

  const resolvedCardRadius =
    typeof rawRadius === "number"
      ? `${rawRadius}px`
      : String(rawRadius).endsWith("px") || String(rawRadius).endsWith("%") || String(rawRadius).endsWith("rem")
      ? String(rawRadius)
      : !isNaN(Number(rawRadius))
      ? `${Number(rawRadius)}px`
      : String(rawRadius);

  const resolvedCardBorder =
    card_border_color ||
    theme?.card_border_color ||
    (isLight ? "1px solid rgba(226, 232, 240, 0.8)" : "1px solid rgba(255, 255, 255, 0.08)");

  const resolvedCardShadow =
    card_shadow === "none"
      ? "none"
      : card_shadow === "subtle"
      ? isLight
        ? "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)"
        : "0 2px 6px rgba(0, 0, 0, 0.35)"
      : card_shadow === "soft"
      ? isLight
        ? "0 4px 12px -2px rgba(0, 0, 0, 0.07), 0 2px 6px -1px rgba(0, 0, 0, 0.03)"
        : "0 6px 18px -2px rgba(0, 0, 0, 0.5)"
      : card_shadow === "elevated"
      ? isLight
        ? "0 10px 24px -4px rgba(0, 0, 0, 0.09), 0 4px 8px -2px rgba(0, 0, 0, 0.04)"
        : "0 12px 28px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06)"
      : theme?.card_shadow || (isLight ? "0 2px 8px -1px rgba(0, 0, 0, 0.05)" : "0 4px 12px rgba(0, 0, 0, 0.4)");

  const resolvedTitleColor = title_color || theme?.card_text_color || theme?.text_color || tokens.textColor;
  const resolvedSubtitleColor =
    subtitle_color || theme?.muted_text_color || (isLight ? "rgba(15, 23, 42, 0.65)" : "rgba(241, 245, 249, 0.65)");
  const resolvedAccentColor = accent_color || theme?.accent_color || tokens.accentColor;
  const resolvedImageBg = image_bg || (isLight ? "#f1f5f9" : "rgba(255, 255, 255, 0.05)");
  const resolvedImageFit = image_fit || "cover";
  const resolvedMaxWidth = max_width === "full" ? "100%" : max_width || "1280px";
  const resolvedGap =
    grid_gap !== undefined
      ? typeof grid_gap === "number"
        ? `${grid_gap}px`
        : grid_gap
      : gap !== undefined
      ? typeof gap === "number"
        ? `${gap}px`
        : gap
      : isMobile
      ? "12px"
      : "16px";

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

  // Dimensions & Shape styles with mobile scaling
  const getShapeStyles = () => {
    const hasCustomWidth = card_width !== undefined && card_width !== null && String(card_width).trim().length > 0;
    const hasCustomHeight = card_height !== undefined && card_height !== null && String(card_height).trim().length > 0;

    const parseDim = (val: string | number | undefined, defaultPx: number, mobileScale = 0.8) => {
      if (val === undefined || val === null) return `${isMobile ? Math.round(defaultPx * mobileScale) : defaultPx}px`;
      if (typeof val === "number") return `${isMobile ? Math.round(val * mobileScale) : val}px`;
      if (val.endsWith("%") || val.endsWith("vw")) return val;
      const num = parseFloat(val);
      if (!isNaN(num)) return `${isMobile ? Math.round(num * mobileScale) : num}px`;
      return val;
    };

    switch (cardShape) {
      case "circle": {
        const d = hasCustomWidth ? parseDim(card_width, 120, 0.75) : isMobile ? "90px" : "120px";
        return {
          cardWidth: d,
          imageHeight: d,
          borderRadius: "50%",
          isCircular: true,
        };
      }
      case "horizontal":
        return {
          cardWidth: hasCustomWidth ? parseDim(card_width, 280, 0.8) : isMobile ? "220px" : "280px",
          imageHeight: hasCustomHeight ? parseDim(card_height, 155, 0.8) : isMobile ? "125px" : "155px",
          borderRadius: resolvedCardRadius,
          isCircular: false,
        };
      case "square":
        return {
          cardWidth: hasCustomWidth ? parseDim(card_width, 180, 0.78) : isMobile ? "140px" : "180px",
          imageHeight: hasCustomHeight ? parseDim(card_height, 180, 0.78) : isMobile ? "140px" : "180px",
          borderRadius: resolvedCardRadius,
          isCircular: false,
        };
      case "pill":
        return {
          cardWidth: hasCustomWidth ? parseDim(card_width, 140, 0.8) : isMobile ? "115px" : "140px",
          imageHeight: hasCustomHeight ? parseDim(card_height, 95, 0.8) : isMobile ? "76px" : "95px",
          borderRadius: card_radius !== undefined ? resolvedCardRadius : "24px",
          isCircular: false,
        };
      case "portrait":
      default:
        return {
          cardWidth: hasCustomWidth ? parseDim(card_width, 200, 0.75) : isMobile ? "150px" : "200px",
          imageHeight: hasCustomHeight ? parseDim(card_height, 260, 0.75) : isMobile ? "195px" : "260px",
          borderRadius: resolvedCardRadius,
          isCircular: false,
        };
    }
  };

  const shapeConfig = getShapeStyles();

  const effectiveHasTitle = Boolean(show_title && title && title.trim().length > 0);
  const effectiveHasSubtitle = Boolean(show_subtitle && subtitle && subtitle.trim().length > 0);
  const hasHeader = effectiveHasTitle || effectiveHasSubtitle;

  const headerAlignStyle =
    title_alignment === "center"
      ? { alignItems: "center" as const, textAlign: "center" as const }
      : title_alignment === "right"
      ? { alignItems: "flex-end" as const, textAlign: "right" as const }
      : { alignItems: "flex-start" as const, textAlign: "left" as const };

  const parsedTitleSize = title_font_size
    ? typeof title_font_size === "number"
      ? `${title_font_size}px`
      : title_font_size
    : isMobile
    ? "17px"
    : "20px";

  const parsedSubtitleSize = subtitle_font_size
    ? typeof subtitle_font_size === "number"
      ? `${subtitle_font_size}px`
      : subtitle_font_size
    : isMobile
    ? "12px"
    : "13px";

  const parsedCardTitleSize = card_title_size
    ? typeof card_title_size === "number"
      ? `${card_title_size}px`
      : card_title_size
    : isMobile
    ? "13.5px"
    : "15px";

  const isBelowCardText = card_text_position === "below_card" || shapeConfig.isCircular;

  // Builder empty state placeholder
  if (rawTiles.length === 0) {
    return (
      <section
        className="section-group-carousel-empty"
        style={{
          width: "100%",
          maxWidth: resolvedMaxWidth,
          margin: "0 auto",
          padding: `${padding_y || (isMobile ? "18px" : "28px")} ${padding_x || (isMobile ? "12px" : "16px")}`,
          boxSizing: "border-box",
          background: resolvedOuterBg,
        }}
      >
        <div
          style={{
            border: `2px dashed ${isLight ? "#cbd5e1" : "rgba(255,255,255,0.15)"}`,
            borderRadius: "14px",
            padding: isMobile ? "24px 14px" : "36px 20px",
            textAlign: "center",
            background: resolvedCardBg,
          }}
        >
          <div style={{ fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: resolvedTitleColor, marginBottom: "4px" }}>
            {title || "Categories & Collections Carousel"}
          </div>
          <div style={{ fontSize: "12px", color: resolvedSubtitleColor, maxWidth: "420px", margin: "0 auto" }}>
            No category or story tiles added yet. Configure collections and styles in the editor sidebar.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="section-group-carousel"
      style={{
        width: "100%",
        maxWidth: resolvedMaxWidth,
        margin: "0 auto",
        padding: `${padding_y || (isMobile ? "16px" : "24px")} ${padding_x || (isMobile ? "12px" : "16px")}`,
        boxSizing: "border-box",
        position: "relative",
        background: resolvedOuterBg,
      }}
    >
      {/* Header with Title and Subtitle */}
      {hasHeader && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            ...headerAlignStyle,
            marginBottom: isMobile ? "12px" : "16px",
            width: "100%",
          }}
        >
          {effectiveHasTitle && (
            <h2
              style={{
                margin: 0,
                fontSize: parsedTitleSize,
                fontWeight: (title_font_weight as any) || 800,
                textTransform: title_text_transform || "none",
                color: resolvedTitleColor,
                letterSpacing: "-0.02em",
                lineHeight: 1.25,
              }}
            >
              {title}
            </h2>
          )}
          {effectiveHasSubtitle && (
            <p
              style={{
                margin: effectiveHasTitle ? "4px 0 0" : 0,
                fontSize: parsedSubtitleSize,
                fontWeight: (subtitle_font_weight as any) || 500,
                color: resolvedSubtitleColor,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Tiles Container: Carousel (Horizontal Snap Scroll) or Multi-Column Grid */}
      <div
        className="section-group-carousel-container"
        style={
          layout === "grid"
            ? {
                display: "grid",
                gridTemplateColumns:
                  grid_columns && String(grid_columns) !== "auto"
                    ? `repeat(${grid_columns}, 1fr)`
                    : isMobile
                    ? shapeConfig.isCircular
                      ? "repeat(auto-fill, minmax(80px, 1fr))"
                      : "repeat(2, 1fr)"
                    : shapeConfig.isCircular
                    ? "repeat(auto-fill, minmax(110px, 1fr))"
                    : "repeat(auto-fill, minmax(180px, 1fr))",
                gap: resolvedGap,
              }
            : {
                display: "flex",
                gap: resolvedGap,
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                paddingBottom: "6px",
                WebkitOverflowScrolling: "touch",
              }
        }
      >
        <style>{`
          .section-group-carousel-container::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          .section-group-tile-hover {
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .section-group-tile-hover:hover {
            transform: translateY(-3px);
          }
          .section-group-tile-hover:hover img {
            transform: scale(1.04);
          }
        `}</style>

        {rawTiles.map((tile, idx) => {
          const targetUrl = getTileTargetUrl(tile);
          const optimizedImg = tile.imageUrl ? optimizeImageUrl(tile.imageUrl) : "";

          // Circular layout (Avatar / Story style) or Below-Card Text layout
          if (isBelowCardText) {
            return (
              <Link
                key={tile.id || idx}
                to={targetUrl}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                style={{
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: card_title_align === "left" ? "flex-start" : card_title_align === "right" ? "flex-end" : "center",
                  gap: isMobile ? "6px" : "8px",
                  flexShrink: 0,
                  width: layout === "grid" ? "100%" : shapeConfig.cardWidth,
                  scrollSnapAlign: "start",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: shapeConfig.isCircular ? shapeConfig.imageHeight : "100%",
                    height: shapeConfig.imageHeight,
                    borderRadius: shapeConfig.borderRadius,
                    overflow: "hidden",
                    border: shapeConfig.isCircular ? `2.5px solid ${resolvedAccentColor}` : resolvedCardBorder,
                    padding: shapeConfig.isCircular ? (isMobile ? "2px" : "3px") : 0,
                    background: resolvedCardBg,
                    boxShadow: resolvedCardShadow,
                    position: "relative",
                  }}
                  className="section-group-tile-hover"
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: shapeConfig.isCircular ? "50%" : shapeConfig.borderRadius,
                      overflow: "hidden",
                      background: resolvedImageBg,
                    }}
                  >
                    {optimizedImg ? (
                      <img
                        src={optimizedImg}
                        alt={tile.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: resolvedImageFit as any,
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
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Top Badge (if any & not circular) */}
                  {!shapeConfig.isCircular && badge_style !== "hidden" && tile.subtitle && (
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        background: badge_bg_color || resolvedAccentColor,
                        color: badge_text_color || "#ffffff",
                        fontSize: "9.5px",
                        fontWeight: 700,
                        padding: badge_style === "pill" ? "2px 8px" : "2px 5px",
                        borderRadius: badge_style === "pill" ? "12px" : "4px",
                        letterSpacing: "0.02em",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                      }}
                    >
                      {tile.subtitle}
                    </div>
                  )}
                </div>

                {/* Below-Card Text */}
                <div style={{ textAlign: (card_title_align as any) || (shapeConfig.isCircular ? "center" : "left"), width: "100%" }}>
                  <div
                    style={{
                      fontSize: parsedCardTitleSize,
                      fontWeight: (card_title_weight as any) || 700,
                      color: resolvedTitleColor,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {tile.title}
                  </div>
                  {tile.subtitle && shapeConfig.isCircular && (
                    <div
                      style={{
                        fontSize: isMobile ? "10px" : "11px",
                        color: resolvedAccentColor,
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

          // Overlay Placement (Bottom, Top, or Center Overlay)
          const justifyContent =
            card_text_position === "top_overlay"
              ? "flex-start"
              : card_text_position === "center_overlay"
              ? "center"
              : "flex-end";

          const textAlign = (card_title_align as any) || "left";

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
                justifyContent: justifyContent,
                background: resolvedImageBg,
                border: resolvedCardBorder,
                boxShadow: resolvedCardShadow,
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
                    objectFit: resolvedImageFit as any,
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
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}

              {/* Gradient Scrim */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    card_text_position === "top_overlay"
                      ? "linear-gradient(0deg, transparent 50%, rgba(0,0,0,0.25) 75%, rgba(0,0,0,0.65) 100%)"
                      : card_text_position === "center_overlay"
                      ? "rgba(0,0,0,0.3)"
                      : "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.25) 75%, rgba(0,0,0,0.65) 100%)",
                  pointerEvents: "none",
                }}
              />

              {/* Top Badge (if any & not hidden) */}
              {badge_style !== "hidden" && tile.subtitle && (
                <div
                  style={{
                    position: "absolute",
                    top: isMobile ? "8px" : "10px",
                    left: isMobile ? "8px" : "10px",
                    background: badge_bg_color || "rgba(15, 23, 42, 0.85)",
                    backdropFilter: "blur(6px)",
                    color: badge_text_color || "#ffffff",
                    fontSize: isMobile ? "10px" : "11px",
                    fontWeight: 700,
                    padding: badge_style === "pill" ? "2px 8px" : "2px 6px",
                    borderRadius: badge_style === "pill" ? "12px" : "5px",
                    letterSpacing: "0.02em",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  {tile.subtitle}
                </div>
              )}

              {/* Card Title */}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: card_padding !== undefined ? (typeof card_padding === "number" ? `${card_padding}px` : card_padding) : isMobile ? "10px" : "14px",
                  color: "#ffffff",
                  textAlign: textAlign,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: parsedCardTitleSize,
                    fontWeight: (card_title_weight as any) || 800,
                    lineHeight: 1.25,
                    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
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
