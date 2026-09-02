import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useCart, Product } from "../CartContext";
import FilterSidebar from "./FilterSidebar";
import { Pagination } from "./Pagination";
import { resolveThemeTokens } from "../context/ThemeContext";
import { optimizeImageUrl } from "../utils/imageOptimizer";
import {
  DiwaliGraphics,
  HoliGraphics,
  DurgaGraphics,
  RakhiGraphics,
  ChristmasGraphics,
  EidGraphics,
} from "./FestiveGraphics";

function resolveFontFamily(fontKey?: string): string | undefined {
  if (!fontKey || fontKey === "default" || fontKey === "inherit") return undefined;
  switch (fontKey) {
    case "sans_modern":
    case "modern_sans":
    case "inter":
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    case "roboto_sans":
    case "roboto":
      return "'Roboto', sans-serif";
    case "outfit_tech":
    case "outfit":
      return "'Outfit', sans-serif";
    case "plus_jakarta":
      return "'Plus Jakarta Sans', sans-serif";
    case "space_grotesk":
      return "'Space Grotesk', sans-serif";
    case "playfair_serif":
    case "playfair":
      return "'Playfair Display', Georgia, serif";
    case "cinzel_display":
    case "cinzel":
      return "'Cinzel', serif";
    case "cormorant_serif":
    case "cormorant":
      return "'Cormorant Garamond', Georgia, serif";
    case "montserrat_bold":
    case "montserrat":
      return "'Montserrat', sans-serif";
    case "poppins_rounded":
    case "poppins":
      return "'Poppins', sans-serif";
    case "serif":
      return "Georgia, 'Times New Roman', serif";
    case "mono":
      return "monospace, 'Courier New'";
    default:
      return fontKey.includes(" ") || fontKey.includes(",") ? fontKey : `'${fontKey}', sans-serif`;
  }
}

type ProductGridProps = {
  siteId: string;
  products?: Product[];
  title?: string;
  subtitle?: string;
  itemCount?: number;
  activeFilterCount?: number;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
  onFilterClick?: () => void;

  // Pagination
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  totalProducts?: number;

  // Layout & Spacing
  grid_gap?: string | number;
  gap?: string | number;
  max_width?: string;
  padding_y?: string | number;
  padding_x?: string | number;

  // Card Container & Background
  outer_bg_color?: string;
  card_bg_color?: string;
  card_radius?: string | number;
  card_border_color?: string;
  card_shadow?: string;

  // Product Image Settings
  image_aspect_ratio?: string;
  image_fit?: "cover" | "contain";
  image_bg?: string;
  image_radius?: string | number;
  image_corner_radius?: string | number;

  // Typography & Colors
  title_color?: string;
  product_name_color?: string;
  product_title_color?: string;
  product_name_font_family?: string;
  product_title_font_family?: string;
  product_name_font_size?: string | number;
  product_title_font_size?: string | number;
  product_name_font_weight?: string | number;
  product_title_font_weight?: string | number;
  product_name_font_style?: "normal" | "italic";
  product_title_font_style?: "normal" | "italic";
  brand_color?: string;
  price_color?: string;
  original_price_color?: string;
  rating_star_color?: string;
  accent_color?: string;

  // Visibility Toggles
  show_discount_badge?: boolean;
  show_stock_badge?: boolean;
  show_ratings?: boolean;
  show_original_price?: boolean;
  show_filter_button?: boolean;
  showFilterButton?: boolean;
  hideFilterButton?: boolean;
  card_style?: string;
  cardStyle?: string;
  show_brand_name?: boolean;

  theme?: {
    mode?: string;
    primary_bg?: string;
    secondary_bg?: string;
    text_color?: string;
    accent_color?: string;
    card_style?: string;
    card_bg?: string;
    card_text_color?: string;
    card_shadow?: string;
    [key: string]: any;
  };
};

type NormalizedProduct = Product & {
  normalizedImage: string;
  normalizedOriginalPrice?: number;
  normalizedDisplayPrice: number;
  normalizedInStock: boolean;
  normalizedDiscountPercent: number;
};

const ProductGrid: React.FC<ProductGridProps> = ({
  siteId,
  products: productsProp,
  title,
  subtitle,
  itemCount,
  activeFilterCount,
  sortBy,
  onSortChange,
  onFilterClick,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalProducts,
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
  card_style,
  cardStyle,
  image_aspect_ratio,
  image_fit,
  image_bg,
  image_radius,
  image_corner_radius,
  title_color,
  product_name_color,
  product_title_color,
  product_name_font_family,
  product_title_font_family,
  product_name_font_size,
  product_title_font_size,
  product_name_font_weight,
  product_title_font_weight,
  product_name_font_style,
  product_title_font_style,
  brand_color,
  price_color,
  original_price_color,
  rating_star_color,
  accent_color,
  show_discount_badge = true,
  show_stock_badge = true,
  show_ratings = true,
  show_original_price = true,
  show_filter_button,
  showFilterButton,
  hideFilterButton,
  show_brand_name = true,
  theme,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug: siteSlug } = useParams();
  const { products: cartProducts, isProductsLoading = false } = useCart();

  const isDedicatedFilteredView = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Boolean(
      params.get("section_title") ||
      params.get("section") ||
      params.get("section_id") ||
      params.get("collection") ||
      params.get("category") ||
      params.get("brand") ||
      params.get("product_type") ||
      params.get("product_ids")
    );
  }, [location.search]);

  const effectiveShowFilterButton =
    showFilterButton !== undefined
      ? showFilterButton
      : show_filter_button !== undefined
      ? show_filter_button
      : hideFilterButton !== undefined
      ? !hideFilterButton
      : !isDedicatedFilteredView;

  const products = productsProp ?? cartProducts;
  const isStoreRoute = location.pathname.startsWith("/store/");

  const appBase = isStoreRoute
    ? siteSlug
      ? `/store/${siteSlug}`
      : "/store"
    : `/builder/${siteId}`;

  const [screenSize, setScreenSize] = useState<{ isMobile: boolean; isTablet: boolean; isLargePhone: boolean }>(() => {
    if (typeof window === "undefined") return { isMobile: false, isTablet: false, isLargePhone: false };
    const w = window.innerWidth;
    return {
      isMobile: w <= 640,
      isLargePhone: w > 480 && w <= 640,
      isTablet: w > 640 && w <= 1024,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timeoutId: any = null;
    const checkBreakpoints = () => {
      const w = window.innerWidth;
      const nextMobile = w <= 640;
      const nextLargePhone = w > 480 && w <= 640;
      const nextTablet = w > 640 && w <= 1024;
      setScreenSize((prev) => {
        if (
          prev.isMobile === nextMobile &&
          prev.isLargePhone === nextLargePhone &&
          prev.isTablet === nextTablet
        ) {
          return prev;
        }
        return { isMobile: nextMobile, isLargePhone: nextLargePhone, isTablet: nextTablet };
      });
    };

    const debouncedResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkBreakpoints, 100);
    };

    window.addEventListener("resize", debouncedResize, { passive: true });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("resize", debouncedResize);
    };
  }, []);

  const { isMobile, isTablet, isLargePhone } = screenSize;

function isColorDarkHex(colorHex?: string): boolean {
  if (!colorHex || typeof colorHex !== "string") return false;
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  return false;
}

  const {
    isDark,
    primaryBg: resolvedPrimaryBg,
    cardBg: defaultCardBg,
    textColor: defaultTextColor,
    mutedTextColor: defaultMutedText,
    softTextColor: defaultFaintText,
    borderColor: resolvedBorderColor,
    accentColor,
  } = resolveThemeTokens(theme);
  const isLight = !isDark;

  const cardStyleKey = card_style || cardStyle || theme?.card_style || "fashion";
  const cardBg = card_bg_color || defaultCardBg;
  const isCardDark = isColorDarkHex(cardBg);

  const resolvedAccentColor = accent_color || (theme as any)?.accent_color || accentColor || "#3b82f6";

  const preferredTextColor =
    product_name_color ||
    product_title_color ||
    title_color ||
    (theme as any)?.card_text_color ||
    defaultTextColor;
  const isPreferredDark = isColorDarkHex(preferredTextColor);
  const pageText = preferredTextColor && (isPreferredDark !== isCardDark)
    ? preferredTextColor
    : (isCardDark ? "#ffffff" : "#0f172a");

  const mutedText =
    original_price_color ||
    (defaultMutedText && isColorDarkHex(defaultMutedText) !== isCardDark
      ? defaultMutedText
      : isCardDark
      ? "rgba(248, 250, 252, 0.72)"
      : "rgba(15, 23, 42, 0.65)");

  const faintText =
    brand_color ||
    (defaultFaintText && isColorDarkHex(defaultFaintText) !== isCardDark
      ? defaultFaintText
      : isCardDark
      ? "rgba(248, 250, 252, 0.50)"
      : "rgba(15, 23, 42, 0.45)");
  const starColor = rating_star_color || "#d97706";

  const subtleBorder = `1px solid ${resolvedBorderColor}`;

  const softShadow = isLight
    ? "0 10px 28px rgba(15,23,42,0.055)"
    : "0 12px 28px rgba(0,0,0,0.3)";

  const parsedCardRadiusNum =
    card_radius !== undefined && card_radius !== null && String(card_radius).trim() !== ""
      ? typeof card_radius === "number"
        ? card_radius
        : parseInt(String(card_radius), 10)
      : NaN;

  let computedRadius = !isNaN(parsedCardRadiusNum) && parsedCardRadiusNum >= 0
    ? `${parsedCardRadiusNum}px`
    : cardStyleKey === "electronics"
    ? "18px"
    : cardStyleKey === "beauty"
    ? "22px"
    : cardStyleKey === "grocery" || cardStyleKey === "books"
    ? "16px"
    : "20px";

  let computedCardBg = cardBg;
  let computedBorder = card_border_color ? `1px solid ${card_border_color}` : subtleBorder;

  let computedShadow = softShadow;
  if (card_shadow === "none") computedShadow = "none";
  else if (card_shadow === "subtle") computedShadow = isLight ? "0 4px 12px rgba(0,0,0,0.04)" : "0 4px 12px rgba(0,0,0,0.2)";
  else if (card_shadow === "soft") computedShadow = softShadow;
  else if (card_shadow === "elevated") computedShadow = isLight ? "0 20px 40px rgba(0,0,0,0.12)" : "0 20px 40px rgba(0,0,0,0.36)";

  const isGlass =
    (theme as any)?.surface_materiality === "full_glass" ||
    (theme as any)?.surface_materiality === "glassmorphism" ||
    (theme as any)?.visual_style === "glassmorphic" ||
    (theme as any)?.name?.toLowerCase()?.includes("glass") ||
    (typeof cardBg === "string" && cardBg.startsWith("rgba"));

  if (isGlass) {
    computedCardBg = card_bg_color || (isLight ? "rgba(255, 255, 255, 0.70)" : "rgba(15, 23, 42, 0.70)");
    computedBorder = card_border_color ? `1px solid ${card_border_color}` : (isLight ? "1px solid rgba(255, 255, 255, 0.55)" : "1px solid rgba(255, 255, 255, 0.14)");
    computedShadow = isLight
      ? "0 8px 32px rgba(31, 38, 135, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.75)"
      : "0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.16)";
  }

  const rawImgRadius = image_radius ?? image_corner_radius;
  const parsedImgRadiusNum =
    rawImgRadius !== undefined && rawImgRadius !== null && String(rawImgRadius).trim() !== ""
      ? typeof rawImgRadius === "number"
        ? rawImgRadius
        : parseInt(String(rawImgRadius), 10)
      : NaN;

  const resolvedImageRadius = !isNaN(parsedImgRadiusNum) && parsedImgRadiusNum >= 0
    ? `${parsedImgRadiusNum}px`
    : isMobile
    ? "10px"
    : "14px";

  const resolvedFontFamily = resolveFontFamily(product_name_font_family || product_title_font_family);
  const parsedProductNameSizeNum =
    product_name_font_size || product_title_font_size
      ? parseInt(String(product_name_font_size || product_title_font_size), 10)
      : NaN;
  const resolvedProductNameSize =
    !isNaN(parsedProductNameSizeNum) && parsedProductNameSizeNum > 0
      ? `${parsedProductNameSizeNum}px`
      : isMobile ? "13px" : "15px";

  const resolvedProductNameWeight = (product_name_font_weight || product_title_font_weight || 700) as any;
  const resolvedProductNameStyle = product_name_font_style || product_title_font_style || "normal";

  const normalizedProducts: NormalizedProduct[] = useMemo(() => {
    return (products ?? []).map((product) => {
      const firstVariant = product.variant_option?.optionValues?.[0];
      const normalizedDisplayPrice =
        typeof firstVariant?.price === "number" && firstVariant.price > 0
          ? firstVariant.price
          : product.price;

      const normalizedOriginalPrice =
        typeof (firstVariant as any)?.comparePrice === "number" &&
        (firstVariant as any).comparePrice > normalizedDisplayPrice
          ? (firstVariant as any).comparePrice
          : typeof product.originalPrice === "number" && product.originalPrice > normalizedDisplayPrice
          ? product.originalPrice
          : typeof product.compare_price === "number" && product.compare_price > normalizedDisplayPrice
          ? product.compare_price
          : undefined;

      const normalizedInStock =
        product.variant_option?.optionValues?.length
          ? product.variant_option.optionValues.some(
              (variant) =>
                variant.inStock !== false &&
                (variant.stockQty == null || Number(variant.stockQty) > 0)
            )
          : typeof product.inStock === "boolean"
          ? product.inStock
          : true;

      const normalizedDiscountPercent =
        normalizedOriginalPrice && normalizedOriginalPrice > normalizedDisplayPrice
          ? Math.round(((normalizedOriginalPrice - normalizedDisplayPrice) / normalizedOriginalPrice) * 100)
          : 0;

      return {
        ...product,
        normalizedImage: optimizeImageUrl(product.image || product.images?.[0] || ""),
        normalizedOriginalPrice,
        normalizedDisplayPrice,
        normalizedInStock,
        normalizedDiscountPercent,
      };
    });
  }, [products]);

  const handleProductClick = (product: NormalizedProduct) => {
    const targetSlug = product.slug || product.id;
    if (!targetSlug) return;
    navigate(`${appBase}/products/${targetSlug}`);
  };

  const resolvedMaxWidth =
    max_width === "full"
      ? "100%"
      : max_width
      ? String(max_width).endsWith("px") || String(max_width).endsWith("%")
        ? String(max_width)
        : `${max_width}px`
      : "1280px";

  const rawGapVal = gap !== undefined && gap !== "" ? gap : grid_gap;
  const parsedGapNum =
    rawGapVal !== undefined && rawGapVal !== null && String(rawGapVal).trim() !== ""
      ? typeof rawGapVal === "number"
        ? rawGapVal
        : parseInt(String(rawGapVal), 10)
      : NaN;

  const resolvedGridGap = !isNaN(parsedGapNum) && parsedGapNum >= 0
    ? `${parsedGapNum}px`
    : isMobile
    ? isLargePhone ? "12px" : "10px"
    : "16px";

  const parsedPaddingYNum =
    padding_y !== undefined && padding_y !== null && String(padding_y).trim() !== ""
      ? typeof padding_y === "number"
        ? padding_y
        : parseInt(String(padding_y), 10)
      : NaN;
  const resolvedPaddingY = !isNaN(parsedPaddingYNum) && parsedPaddingYNum >= 0
    ? `${parsedPaddingYNum}px`
    : isMobile ? "12px" : "24px";

  const parsedPaddingXNum =
    padding_x !== undefined && padding_x !== null && String(padding_x).trim() !== ""
      ? typeof padding_x === "number"
        ? padding_x
        : parseInt(String(padding_x), 10)
      : NaN;
  const resolvedPaddingX = !isNaN(parsedPaddingXNum) && parsedPaddingXNum >= 0
    ? `${parsedPaddingXNum}px`
    : isMobile ? "10px" : "16px";

  const resolvedColumns =
    cardStyleKey === "grocery"
      ? isMobile
        ? "repeat(1, 1fr)"
        : isTablet
        ? "repeat(auto-fill, minmax(290px, 1fr))"
        : "repeat(auto-fill, minmax(320px, 1fr))"
      : isMobile
      ? "repeat(2, minmax(0, 1fr))"
      : isTablet
      ? "repeat(auto-fill, minmax(190px, 1fr))"
      : "repeat(auto-fill, minmax(230px, 1fr))";

  const resolvedImageFit = image_fit || "cover";
  const resolvedImageBg = image_bg || (isLight ? "#f8fafc" : "rgba(255,255,255,0.04)");

  return (
    <section
      className="product-grid"
      style={{
        position: "relative",
        maxWidth: resolvedMaxWidth,
        margin: "0 auto",
        padding: `${resolvedPaddingY} ${resolvedPaddingX} ${isMobile ? "32px" : "44px"}`,
        background: outer_bg_color || "transparent",
        borderRadius: outer_bg_color ? "16px" : undefined,
        transition: "all 0.2s ease",
      }}
    >
      <style>{`
        .product-grid .product-card {
          transition: border-color 0.1s ease !important;
        }
        @media (hover: hover) and (pointer: fine) {
          .product-grid .product-card:hover {
            border-color: ${resolvedAccentColor} !important;
          }
        }
      `}</style>
      {/* Section Divider / Decorative Festive Transition — placed cleanly above the header toolbar */}
      {(() => {
        const festTheme = (theme as any)?.festival_theme;
        if (!festTheme || festTheme === "none") return null;
        return (
          <div aria-hidden="true" style={{ position: "relative", width: "100%", height: "20px", marginBottom: "12px", overflow: "hidden", pointerEvents: "none", zIndex: 0, opacity: isLight ? 0.85 : 0.75 }}>
            {festTheme === "diwali" && <DiwaliGraphics variant="grid" isDark={isDark} style={{ width: "100%", height: "100%" }} />}
            {festTheme === "holi" && <HoliGraphics variant="grid" isDark={isDark} style={{ width: "100%", height: "100%" }} />}
            {festTheme === "durga_puja" && <DurgaGraphics variant="grid" isDark={isDark} style={{ width: "100%", height: "100%" }} />}
            {festTheme === "rakhi" && <RakhiGraphics variant="grid" isDark={isDark} style={{ width: "100%", height: "100%" }} />}
            {festTheme === "christmas" && <ChristmasGraphics variant="grid" isDark={isDark} style={{ width: "100%", height: "100%" }} />}
            {festTheme === "eid" && <EidGraphics variant="grid" isDark={isDark} style={{ width: "100%", height: "100%" }} />}
          </div>
        );
      })()}

      {/* Header & Filter Toolbar */}
      <FilterSidebar
        title={title}
        subtitle={subtitle}
        itemCount={itemCount ?? normalizedProducts.length}
        activeFilterCount={activeFilterCount}
        sortBy={sortBy}
        onSortChange={onSortChange}
        onFilterClick={onFilterClick}
        showFilterButton={effectiveShowFilterButton}
        theme={theme}
      />

      {isProductsLoading && normalizedProducts.length === 0 ? (
        <div
          className="product-grid__items product-grid__skeleton"
          style={{
            display: "grid",
            gridTemplateColumns: resolvedColumns,
            gap: resolvedGridGap,
          }}
        >
          <style>{`
            @keyframes gridShimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const skeletonBg = isDark
              ? "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)"
              : "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)";
            const skStyle: React.CSSProperties = {
              backgroundImage: skeletonBg,
              backgroundSize: "200% 100%",
              animation: "gridShimmer 1.5s infinite linear",
              willChange: "background-position",
              transform: "translateZ(0)",
            };
            return (
              <div
                key={i}
                style={{
                  borderRadius: isMobile ? "14px" : computedRadius,
                  background: computedCardBg,
                  border: computedBorder,
                  boxShadow: computedShadow,
                  padding: isMobile ? "8px" : "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "6px" : "12px",
                }}
              >
                <div
                  style={{
                    ...skStyle,
                    width: "100%",
                    aspectRatio: image_aspect_ratio || "1/1",
                    borderRadius: "12px",
                  }}
                />
                <div style={{ display: "grid", gap: "8px", flex: 1 }}>
                  <div
                    style={{
                      ...skStyle,
                      width: "40%",
                      height: "12px",
                      borderRadius: "4px",
                    }}
                  />
                  <div
                    style={{
                      ...skStyle,
                      width: "85%",
                      height: "16px",
                      borderRadius: "6px",
                    }}
                  />
                  <div
                    style={{
                      ...skStyle,
                      width: "50%",
                      height: "20px",
                      borderRadius: "6px",
                      marginTop: "4px",
                    }}
                  />
                </div>
                <div
                  style={{
                    ...skStyle,
                    width: "100%",
                    height: "34px",
                    borderRadius: "10px",
                    marginTop: "auto",
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : normalizedProducts.length === 0 ? (
        <div
          style={{
            padding: "48px 16px",
            textAlign: "center",
            color: mutedText,
            borderRadius: computedRadius,
            background: computedCardBg,
            border: computedBorder,
            boxShadow: computedShadow,
            margin: "12px 0",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>🛍️</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: pageText }}>No Products Found</div>
          <div style={{ fontSize: "13px", marginTop: "4px", color: faintText }}>Try adjusting your search or filters to find what you're looking for.</div>
        </div>
      ) : (
        <div
          className="product-grid__items"
          style={{
            display: "grid",
            gridTemplateColumns: resolvedColumns,
            gap: resolvedGridGap,
            paddingTop: "4px",
            paddingBottom: "8px",
          }}
        >
          {normalizedProducts.map((product, cardIndex) => {
          const showOriginal =
            show_original_price &&
            typeof product.normalizedOriginalPrice === "number" &&
            product.normalizedOriginalPrice > product.normalizedDisplayPrice;

          const showDiscount =
            show_discount_badge &&
            product.normalizedDiscountPercent > 0 &&
            product.normalizedInStock;

          const isDisabled = !product.normalizedInStock;
          const ratingValue = Number(product.average_rating ?? 0);
          const reviewCount = Number(product.review_count ?? 0);
          const hasReviews = reviewCount > 0 && ratingValue > 0;
          const ratingDisplay = hasReviews
            ? `${ratingValue.toFixed(1)} (${reviewCount})`
            : "New";

          const brandText = product.brand || product.category || "Collection";
          const activePriceColor = price_color || (cardStyleKey === "beauty" ? "#dc2626" : pageText);

          const badgeCollections = (product.collections || []).filter((c: any) => c && c.is_badge);

          const renderCollectionBadges = (isCompact = false) => {
            if (!badgeCollections || badgeCollections.length === 0) return null;

            return (
              <div
                style={{
                  position: "absolute",
                  top: isCompact ? "6px" : "10px",
                  right: isCompact ? "6px" : "10px",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  alignItems: "flex-end",
                  maxWidth: isCompact ? "60px" : "110px",
                }}
              >
                {badgeCollections.slice(0, isCompact ? 1 : 2).map((col: any) => (
                  <div
                    key={col.id || col.name}
                    style={{
                      padding: isCompact ? "2px 5px" : "3px 8px",
                      borderRadius: "6px",
                      background: col.badge_color || "linear-gradient(135deg, #d97706, #b45309)",
                      color: "#ffffff",
                      fontSize: isCompact ? "8px" : "9px",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                    }}
                  >
                    {col.name}
                  </div>
                ))}
              </div>
            );
          };

          const festTheme = (theme as any)?.festival_theme;

          const renderDiscountBadge = () => (
            showDiscount ? (
              <div
                style={{
                  position: "absolute",
                  top: isMobile ? "6px" : "10px",
                  left: isMobile ? "6px" : "10px",
                  zIndex: 2,
                  padding: isMobile ? "2px 6px" : "4px 8px",
                  borderRadius: "999px",
                  background: "#166534",
                  color: "#ffffff",
                  fontSize: isMobile ? "9px" : "10px",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  boxShadow: "0 2px 8px rgba(22,101,52,0.25)",
                }}
              >
                {product.normalizedDiscountPercent}% OFF
              </div>
            ) : null
          );

          const renderInStockBadge = (centered = false) => (
            show_stock_badge ? (
              <span
                style={{
                  fontSize: isMobile ? "9px" : "11px",
                  fontWeight: 700,
                  color: product.normalizedInStock ? "#16a34a" : "#dc2626",
                  background: product.normalizedInStock ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
                  padding: isMobile ? "2px 6px" : "3px 10px",
                  borderRadius: "999px",
                  border: product.normalizedInStock ? "1px solid #16a34a" : "1px solid #dc2626",
                  display: "inline-block",
                  textAlign: "center",
                  margin: centered ? (isMobile ? "4px auto 0" : "8px auto 0") : undefined,
                  flexShrink: 0,
                }}
              >
                {product.normalizedInStock ? "In stock" : "Out of stock"}
              </span>
            ) : null
          );

          const targetSlug = product.slug || product.id;

          const commonArticleProps = {
            className: "product-card",
            onClick: isDisabled ? undefined : () => handleProductClick(product),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (isDisabled) return;
              if ((e.key === "Enter" || e.key === " ") && targetSlug) {
                e.preventDefault();
                handleProductClick(product);
              }
            },
            role: "button",
            tabIndex: isDisabled ? -1 : 0,
            "aria-label": `View details for ${product.name}`,
            "aria-disabled": isDisabled,
          };

          const cardBaseStyle: React.CSSProperties = {
            cursor: isDisabled ? "not-allowed" : targetSlug ? "pointer" : "default",
            border: computedBorder,
            borderRadius: !isNaN(parsedCardRadiusNum) && parsedCardRadiusNum >= 0
              ? `${Math.min(parsedCardRadiusNum, isMobile ? 24 : 48)}px`
              : isMobile ? "14px" : computedRadius,
            padding: isMobile ? "8px" : "10px",
            background: isDisabled
              ? isLight
                ? "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.96) 100%)"
                : "linear-gradient(180deg, rgba(30,41,59,0.82) 0%, rgba(15,23,42,0.78) 100%)"
              : computedCardBg,
            backdropFilter: isGlass ? "blur(18px) saturate(180%)" : undefined,
            WebkitBackdropFilter: isGlass ? "blur(18px) saturate(180%)" : undefined,
            boxShadow: isMobile
              ? (isLight ? "0 2px 8px rgba(15,23,42,0.04)" : "0 2px 8px rgba(0,0,0,0.25)")
              : computedShadow,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "6px" : "8px",
            minHeight: "100%",
            boxSizing: "border-box",
            overflow: "hidden",
            opacity: isDisabled ? 0.72 : 1,
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          };

          const resolvedImageBg = image_bg || (isLight ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.2)");

          const getImgContainerStyle = (defaultAspect: string): React.CSSProperties => ({
            position: "relative",
            borderRadius: resolvedImageRadius,
            overflow: "hidden",
            background: resolvedImageBg,
            aspectRatio: image_aspect_ratio || (isMobile ? "1 / 1.12" : defaultAspect),
          });

          const imageLoadingMode: "eager" | "lazy" = cardIndex < 8 ? "eager" : "lazy";

          if (cardStyleKey === "fashion") {
            return (
              <article key={product.id} {...commonArticleProps} style={cardBaseStyle}>
                <div style={getImgContainerStyle("3 / 4")}>
                  {renderDiscountBadge()}
                  {renderCollectionBadges(isMobile)}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading={imageLoadingMode} decoding="async" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
                  {show_brand_name && (
                    <span style={{ fontSize: isMobile ? "9px" : "11px", fontWeight: 700, color: brand_color || faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {brandText}
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontFamily: resolvedFontFamily, fontSize: resolvedProductNameSize, fontWeight: resolvedProductNameWeight, fontStyle: resolvedProductNameStyle, lineHeight: isMobile ? "1.25" : "1.35", color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", minHeight: isMobile ? "32px" : "auto" }}>
                    {product.name}
                  </h3>
                  {show_ratings && (
                    <div style={{ fontSize: isMobile ? "10px" : "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                      <span style={{ color: starColor }}>★</span> {ratingDisplay}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: "4px", flexWrap: "wrap", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: isMobile ? "4px" : "6px" }}>
                      <span style={{ fontSize: isMobile ? "15px" : "17px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                      {showOriginal && <span style={{ fontSize: isMobile ? "11px" : "12px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                    </div>
                    {renderInStockBadge()}
                  </div>
                </div>
              </article>
            );
          }

          if (cardStyleKey === "electronics") {
            return (
              <article key={product.id} {...commonArticleProps} style={cardBaseStyle}>
                <div style={getImgContainerStyle("4 / 3")}>
                  {renderDiscountBadge()}
                  {renderCollectionBadges(isMobile)}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading={imageLoadingMode} decoding="async" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
                  {show_brand_name && (
                    <span style={{ fontSize: isMobile ? "9px" : "10px", fontWeight: 700, color: brand_color || faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {brandText}
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontFamily: resolvedFontFamily, fontSize: resolvedProductNameSize, fontWeight: resolvedProductNameWeight, fontStyle: resolvedProductNameStyle, lineHeight: isMobile ? "1.25" : "1.35", color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: isMobile ? "32px" : "auto" }}>{product.name}</h3>
                  {show_ratings && (
                    <div style={{ fontSize: isMobile ? "10px" : "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                      <span style={{ color: starColor }}>★</span> {ratingDisplay}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: isMobile ? "4px" : "6px", margin: "2px 0" }}>
                    <span style={{ fontSize: isMobile ? "15px" : "18px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                    {showOriginal && <span style={{ fontSize: isMobile ? "11px" : "12px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                  </div>
                  <div style={{ marginTop: "auto" }}>
                    {renderInStockBadge()}
                  </div>
                </div>
              </article>
            );
          }

          if (cardStyleKey === "beauty") {
            return (
              <article key={product.id} {...commonArticleProps} style={{ ...cardBaseStyle, textAlign: "center" }}>
                <div style={getImgContainerStyle("1 / 1")}>
                  {renderDiscountBadge()}
                  {renderCollectionBadges(isMobile)}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading={imageLoadingMode} decoding="async" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "2px", flex: 1 }}>
                  {show_brand_name && (
                    <span style={{ fontSize: isMobile ? "9px" : "10px", fontWeight: 700, color: brand_color || faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {brandText}
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontFamily: resolvedFontFamily, fontSize: resolvedProductNameSize, fontWeight: resolvedProductNameWeight, fontStyle: resolvedProductNameStyle, lineHeight: isMobile ? "1.25" : "1.35", color: pageText, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: isMobile ? "32px" : "auto" }}>{product.name}</h3>
                  {show_ratings && (
                    <div style={{ fontSize: isMobile ? "10px" : "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                      <span style={{ color: starColor }}>★</span> {ratingDisplay}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: isMobile ? "4px" : "6px", margin: "2px 0" }}>
                    <span style={{ fontSize: isMobile ? "15px" : "20px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                    {showOriginal && <span style={{ fontSize: isMobile ? "10px" : "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                  </div>
                  <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center" }}>
                    {renderInStockBadge(true)}
                  </div>
                </div>
              </article>
            );
          }

          if (cardStyleKey === "grocery") {
            return (
              <article key={product.id} {...commonArticleProps} style={{ ...cardBaseStyle, flexDirection: "row", alignItems: "center", padding: isMobile ? "8px 10px" : "10px 12px", gap: isMobile ? "10px" : "12px", overflow: "hidden" }}>
                <div style={{ position: "relative", width: isMobile ? "84px" : "96px", height: isMobile ? "84px" : "96px", minWidth: isMobile ? "84px" : "96px", borderRadius: isMobile ? "10px" : "12px", overflow: "hidden", background: resolvedImageBg, flexShrink: 0 }}>
                  {renderDiscountBadge()}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading={imageLoadingMode} decoding="async" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "12px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", minWidth: 0 }}>
                    {show_brand_name && (
                      <span style={{ fontSize: isMobile ? "9px" : "10px", fontWeight: 700, color: brand_color || faintText, textTransform: "uppercase", letterSpacing: "0.08em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {brandText}
                      </span>
                    )}
                    {badgeCollections.length > 0 && (
                      <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                        {badgeCollections.slice(0, 1).map((col: any) => (
                          <span
                            key={col.id || col.name}
                            style={{
                              fontSize: "8px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              padding: "2px 5px",
                              borderRadius: "4px",
                              background: col.badge_color || "#d97706",
                              color: "#fff",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {col.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <h3 style={{ margin: "1px 0 0", fontFamily: resolvedFontFamily, fontSize: resolvedProductNameSize, fontWeight: resolvedProductNameWeight, fontStyle: resolvedProductNameStyle, lineHeight: "1.25", color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {product.name}
                  </h3>
                  {show_ratings && (
                    <div style={{ fontSize: isMobile ? "10px" : "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px", margin: "1px 0" }}>
                      <span style={{ color: starColor }}>★</span> {ratingDisplay}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "auto", paddingTop: "4px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: isMobile ? "4px" : "5px", flexShrink: 0 }}>
                      <span style={{ fontSize: isMobile ? "15px" : "16px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                      {showOriginal && <span style={{ fontSize: isMobile ? "10px" : "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                    </div>
                    {renderInStockBadge()}
                  </div>
                </div>
              </article>
            );
          }

          return (
            <article key={product.id} {...commonArticleProps} style={cardBaseStyle}>
              <div style={getImgContainerStyle("1 / 1.35")}>
                {renderDiscountBadge()}
                {renderCollectionBadges(isMobile)}
                {product.normalizedImage ? (
                  <img src={product.normalizedImage} alt={product.name} loading={imageLoadingMode} decoding="async" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
                {show_brand_name && (
                  <span style={{ fontSize: isMobile ? "9px" : "10px", fontWeight: 700, color: brand_color || faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {brandText}
                  </span>
                )}
                <h3 style={{ margin: 0, fontFamily: resolvedFontFamily, fontSize: resolvedProductNameSize, fontWeight: resolvedProductNameWeight, fontStyle: resolvedProductNameStyle, lineHeight: isMobile ? "1.25" : "1.35", color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: isMobile ? "32px" : "auto" }}>{product.name}</h3>
                <div style={{ borderTop: "1px solid rgba(148,163,184,0.2)", margin: "4px 0" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: isMobile ? "4px" : "6px" }}>
                    <span style={{ fontSize: isMobile ? "15px" : "18px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                    {showOriginal && <span style={{ fontSize: isMobile ? "10px" : "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                  </div>
                  {show_ratings && (
                    <div style={{ fontSize: isMobile ? "10px" : "11px", fontWeight: 600, color: faintText }}>
                      <span style={{ color: starColor }}>★</span> {ratingDisplay}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center" }}>
                  {renderInStockBadge(true)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      )}

      {Boolean((totalPages && totalPages > 1) || (totalProducts && totalProducts > 0) || onPageSizeChange) ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalItems={totalProducts || itemCount}
          pageSize={pageSize || 24}
          pageSizeOptions={[24, 48, 96, 100]}
          onPageSizeChange={onPageSizeChange}
          showRangeText={true}
          theme={theme}
          accentColor={accentColor}
        />
      ) : null}
    </section>
  );
};

export default ProductGrid;