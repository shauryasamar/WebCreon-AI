import React, { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCart, Product } from "../CartContext";
import { optimizeImageUrl } from "../utils/imageOptimizer";
import { resolveThemeTokens, isColorDarkHex } from "../context/ThemeContext";

export interface ProductCarouselFilterRules {
  category?: string;
  categories?: string[];
  brand?: string;
  brands?: string[];
  collection_id?: string;
  collection_ids?: string[];
  product_type?: string;
  product_types?: string[];
  min_price?: number;
  max_price?: number;
  in_stock_only?: boolean;
  sort_by?: "bestseller" | "rating_desc" | "newest" | "price_asc" | "price_desc" | "discount_desc";
  selected_product_ids?: string[];
}

export function generateSectionFilterUrl(
  title?: string,
  rules?: ProductCarouselFilterRules,
  explicitLink?: string,
  id?: string
): string {
  if (explicitLink && explicitLink.trim().length > 0) {
    return explicitLink.trim();
  }
  const params = new URLSearchParams();
  const effectiveTitle = title || id || "Section";
  params.set("section_title", effectiveTitle);
  if (id) params.set("section_id", id);

  const cat = rules?.category || (rules?.categories && rules.categories[0]);
  if (cat) params.set("category", cat);

  const br = rules?.brand || (rules?.brands && rules.brands[0]);
  if (br) params.set("brand", br);

  const col = rules?.collection_id || (rules?.collection_ids && rules.collection_ids[0]);
  if (col) params.set("collection", col);

  const pt = rules?.product_type || (rules?.product_types && rules.product_types[0]);
  if (pt) params.set("product_type", pt);

  const sort = rules?.sort_by;
  if (sort) params.set("sort_by", sort);

  if (rules?.min_price !== undefined && rules.min_price !== null && rules.min_price > 0) {
    params.set("min_price", String(rules.min_price));
  }
  if (rules?.max_price !== undefined && rules.max_price !== null && rules.max_price < 100000) {
    params.set("max_price", String(rules.max_price));
  }
  if (rules?.in_stock_only) {
    params.set("in_stock", "true");
  }
  if (rules?.selected_product_ids && rules.selected_product_ids.length > 0) {
    params.set("product_ids", rules.selected_product_ids.join(","));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface ProductCarouselProps {
  id?: string;
  title?: string;
  subtitle?: string;
  viewAllLink?: string;
  layout?: "carousel" | "grid";
  cardStyle?: string;
  card_style?: string;
  limit?: number;
  rules?: ProductCarouselFilterRules;
  categoryName?: string;
  collectionId?: string;
  brandName?: string;
  sortBy?: "bestseller" | "rating_desc" | "newest" | "price_asc" | "price_desc" | "discount_desc";
  theme?: any;

  // Visual Appearance Tokens
  card_bg_color?: string;
  card_radius?: string | number;
  card_border_color?: string;
  card_shadow?: string;
  title_color?: string;
  brand_color?: string;
  price_color?: string;
  original_price_color?: string;
  rating_star_color?: string;
  image_aspect_ratio?: string;
  image_fit?: "cover" | "contain";
  image_bg?: string;
  show_discount_badge?: boolean;
  show_stock_badge?: boolean;
  show_ratings?: boolean;
  show_original_price?: boolean;
  show_brand_name?: boolean;
}

export const ProductCarousel: React.FC<ProductCarouselProps> = ({
  id,
  title = "Featured Products",
  subtitle,
  viewAllLink,
  layout = "carousel",
  cardStyle,
  card_style,
  limit = 10,
  rules,
  categoryName,
  collectionId,
  brandName,
  sortBy,
  theme,

  card_bg_color,
  card_radius,
  card_border_color,
  card_shadow,
  title_color,
  brand_color,
  price_color,
  original_price_color,
  rating_star_color,
  image_aspect_ratio,
  image_fit,
  image_bg,
  show_discount_badge = true,
  show_stock_badge = true,
  show_ratings = true,
  show_original_price = true,
  show_brand_name = true,
}) => {
  const { products } = useCart();
  const { siteId, slug: siteSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isStoreRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/store/");
  const appBase = isStoreRoute
    ? siteSlug
      ? `/store/${siteSlug}`
      : "/store"
    : `/builder/${siteId}`;

  // Theme Token Resolution (Identical to ProductGrid.tsx)
  const {
    isDark,
    cardBg: defaultCardBg,
    textColor: defaultTextColor,
    mutedTextColor: defaultMutedText,
    softTextColor: defaultFaintText,
    borderColor: resolvedBorderColor,
    accentColor,
  } = resolveThemeTokens(theme);

  const isLight = !isDark;

  // Active Card Style Key (Inherits directly from theme asset selection: fashion | electronics | beauty | grocery | books)
  const cardStyleKey =
    card_style && card_style !== "default"
      ? card_style
      : cardStyle && cardStyle !== "default"
      ? cardStyle
      : theme?.card_style || "fashion";

  const cardBg = card_bg_color || defaultCardBg;
  const isCardDark = isColorDarkHex(cardBg);

  const preferredTextColor = title_color || (theme as any)?.card_text_color || defaultTextColor;
  const isPreferredDark = isColorDarkHex(preferredTextColor);
  const pageText =
    preferredTextColor && isPreferredDark !== isCardDark
      ? preferredTextColor
      : isCardDark
      ? "#ffffff"
      : "#0f172a";

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
  const softShadow = isLight ? "0 10px 28px rgba(15,23,42,0.055)" : "0 12px 28px rgba(0,0,0,0.3)";

  let computedRadius = card_radius !== undefined && card_radius !== "" ? `${card_radius}px` : "20px";
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

  if (card_radius === undefined || card_radius === "") {
    if (cardStyleKey === "electronics") computedRadius = "18px";
    else if (cardStyleKey === "beauty") computedRadius = "22px";
    else if (cardStyleKey === "grocery" || cardStyleKey === "books") computedRadius = "16px";
  }

  const effectiveRules = useMemo(() => {
    return {
      category: rules?.category || categoryName,
      collection_id: rules?.collection_id || collectionId,
      brand: rules?.brand || brandName,
      sort_by: rules?.sort_by || sortBy,
      ...(rules || {}),
    };
  }, [rules, categoryName, collectionId, brandName, sortBy]);

  const effectiveViewAllLink = useMemo(() => {
    return generateSectionFilterUrl(title, effectiveRules, viewAllLink, id);
  }, [title, effectiveRules, viewAllLink, id]);

  // Execute universal multi-filter matching
  const filteredProducts = useMemo(() => {
    let list = [...products];

    const catFilter = rules?.category || rules?.categories || (categoryName ? [categoryName] : null);
    const brandFilter = rules?.brand || rules?.brands || (brandName ? [brandName] : null);
    const colFilter = rules?.collection_id || rules?.collection_ids || (collectionId ? [collectionId] : null);
    const typesFilter = rules?.product_type || rules?.product_types;
    const activeSort = rules?.sort_by || sortBy || "newest";
    const selectedIds = rules?.selected_product_ids;

    // 1. Handpicked Product IDs
    if (selectedIds && selectedIds.length > 0) {
      list = list.filter((p) => selectedIds.includes(String(p.id)));
    }

    // 2. Category Filter
    if (catFilter) {
      const cats = Array.isArray(catFilter) ? catFilter.map((c) => c.toLowerCase()) : [String(catFilter).toLowerCase()];
      list = list.filter((p) => p.category && cats.includes(p.category.toLowerCase()));
    }

    // 3. Brand Filter
    if (brandFilter) {
      const brands = Array.isArray(brandFilter) ? brandFilter.map((b) => b.toLowerCase()) : [String(brandFilter).toLowerCase()];
      list = list.filter((p) => p.brand && brands.includes(p.brand.toLowerCase()));
    }

    // 4. Collection Filter
    if (colFilter) {
      const cols = Array.isArray(colFilter) ? colFilter : [colFilter];
      list = list.filter((p: any) =>
        (p.collections || []).some((c: any) => cols.includes(c.id || c.collection_id))
      );
    }

    // 5. Product Types Filter
    if (typesFilter) {
      const types = Array.isArray(typesFilter)
        ? typesFilter.map((t) => t.toLowerCase())
        : [String(typesFilter).toLowerCase()];
      list = list.filter((p: any) => p.product_type && types.includes(p.product_type.toLowerCase()));
    }

    // 6. Price Range
    if (rules?.min_price !== undefined && rules.min_price !== null) {
      list = list.filter((p) => Number(p.price) >= rules.min_price!);
    }
    if (rules?.max_price !== undefined && rules.max_price !== null) {
      list = list.filter((p) => Number(p.price) <= rules.max_price!);
    }

    // 7. In-Stock Only
    if (rules?.in_stock_only) {
      list = list.filter((p) => p.in_stock !== false);
    }

    // 8. Sorting
    list.sort((a, b) => {
      if (activeSort === "bestseller") {
        const sA = Number((a as any).sales_count ?? (a as any).salesCount ?? 0);
        const sB = Number((b as any).sales_count ?? (b as any).salesCount ?? 0);
        return sB - sA;
      }
      if (activeSort === "rating_desc") {
        const rA = Number((a as any).average_rating || (a as any).rating_summary?.avg_rating || 0);
        const rB = Number((b as any).average_rating || (b as any).rating_summary?.avg_rating || 0);
        return rB - rA;
      }
      if (activeSort === "price_asc") {
        return Number(a.price) - Number(b.price);
      }
      if (activeSort === "price_desc") {
        return Number(b.price) - Number(a.price);
      }
      if (activeSort === "discount_desc") {
        const dA = a.compare_price && Number(a.compare_price) > Number(a.price)
          ? ((Number(a.compare_price) - Number(a.price)) / Number(a.compare_price))
          : 0;
        const dB = b.compare_price && Number(b.compare_price) > Number(b.price)
          ? ((Number(b.compare_price) - Number(b.price)) / Number(b.compare_price))
          : 0;
        return dB - dA;
      }
      const tA = new Date((a as any).created_at || (a as any).createdAt || 0).getTime();
      const tB = new Date((b as any).created_at || (b as any).createdAt || 0).getTime();
      return tB - tA;
    });

    return list.slice(0, limit);
  }, [products, rules, categoryName, brandName, collectionId, sortBy, limit]);

  // Normalized product mapping identical to ProductGrid.tsx
  const normalizedProducts = useMemo(() => {
    return filteredProducts.map((product) => {
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
        product.in_stock !== false &&
        (product.stock === undefined || product.stock > 0);

      const normalizedDiscountPercent =
        normalizedOriginalPrice && normalizedOriginalPrice > normalizedDisplayPrice
          ? Math.round(((normalizedOriginalPrice - normalizedDisplayPrice) / normalizedOriginalPrice) * 100)
          : 0;

      const rawImg =
        product.image_url ||
        ((product as any).images && (product as any).images[0]) ||
        product.image ||
        "";

      return {
        ...product,
        normalizedImage: optimizeImageUrl(rawImg, 320),
        normalizedDisplayPrice,
        normalizedOriginalPrice,
        normalizedInStock,
        normalizedDiscountPercent,
      };
    });
  }, [filteredProducts]);

  // Group into pairs for 2-Row Stacked Carousel (Grocery Style)
  const stackedGroceryColumns = useMemo(() => {
    if (cardStyleKey !== "grocery") return [];
    const cols: typeof normalizedProducts[] = [];
    for (let i = 0; i < normalizedProducts.length; i += 2) {
      cols.push(normalizedProducts.slice(i, i + 2));
    }
    return cols;
  }, [normalizedProducts, cardStyleKey]);

  const handleProductClick = (product: any) => {
    const slugOrId = product.slug || product.id;
    if (!slugOrId) return;
    navigate(`${appBase}/products/${slugOrId}`);
  };

  if (normalizedProducts.length === 0) {
    return null;
  }

  const resolvedImageFit = image_fit || "cover";
  const resolvedImageBg = image_bg || (isLight ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.2)");
  const activePriceColor = price_color || (cardStyleKey === "beauty" ? "#dc2626" : pageText);

  // Exact Card Renderer 100% matched with ProductGrid.tsx
  const renderSingleProductCard = (product: typeof normalizedProducts[0]) => {
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
    const ratingDisplay = hasReviews ? `${ratingValue.toFixed(1)} (${reviewCount})` : "New";

    const brandText = product.brand || product.category || "Collection";
    const badgeCollections = (product.collections || []).filter((c: any) => c && c.is_badge);

    const renderCollectionBadges = (isMobile = false) => {
      if (!badgeCollections || badgeCollections.length === 0) return null;
      return (
        <div
          style={{
            position: "absolute",
            top: isMobile ? "6px" : "8px",
            right: isMobile ? "6px" : "8px",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            alignItems: "flex-end",
            maxWidth: isMobile ? "60px" : "95px",
          }}
        >
          {badgeCollections.slice(0, isMobile ? 1 : 2).map((col: any) => (
            <div
              key={col.id || col.name}
              style={{
                padding: isMobile ? "2px 5px" : "2px 7px",
                borderRadius: "5px",
                background: col.badge_color || "linear-gradient(135deg, #d97706, #b45309)",
                color: "#ffffff",
                fontSize: isMobile ? "8px" : "8.5px",
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

    const renderDiscountBadge = () =>
      showDiscount ? (
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "6px",
            zIndex: 2,
            padding: "2px 6px",
            borderRadius: "999px",
            background: "#166534",
            color: "#ffffff",
            fontSize: "9px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            boxShadow: "0 2px 8px rgba(22,101,52,0.25)",
          }}
        >
          {product.normalizedDiscountPercent}% OFF
        </div>
      ) : null;

    const renderInStockBadge = (centered = false) =>
      show_stock_badge ? (
        <span
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            color: product.normalizedInStock ? "#16a34a" : "#dc2626",
            background: product.normalizedInStock ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
            padding: "3px 9px",
            borderRadius: "999px",
            border: product.normalizedInStock ? "1px solid #16a34a" : "1px solid #dc2626",
            display: "inline-block",
            textAlign: "center",
            margin: centered ? "6px auto 0" : undefined,
            flexShrink: 0,
          }}
        >
          {product.normalizedInStock ? "In stock" : "Out of stock"}
        </span>
      ) : null;

    const cardBaseStyle: React.CSSProperties = {
      cursor: isDisabled ? "not-allowed" : "pointer",
      border: computedBorder,
      borderRadius: computedRadius,
      padding: "10px",
      background: isDisabled
        ? isLight
          ? "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.96) 100%)"
          : "linear-gradient(180deg, rgba(30,41,59,0.82) 0%, rgba(15,23,42,0.78) 100%)"
        : computedCardBg,
      backdropFilter: isGlass ? "blur(18px) saturate(180%)" : undefined,
      WebkitBackdropFilter: isGlass ? "blur(18px) saturate(180%)" : undefined,
      boxShadow: computedShadow,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      boxSizing: "border-box",
      overflow: "hidden",
      opacity: isDisabled ? 0.72 : 1,
      transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
    };

    const getImgContainerStyle = (defaultAspect: string): React.CSSProperties => ({
      position: "relative",
      borderRadius: "12px",
      overflow: "hidden",
      background: resolvedImageBg,
      aspectRatio: image_aspect_ratio || defaultAspect,
    });

    // 1. FASHION PRESET
    if (cardStyleKey === "fashion") {
      return (
        <article
          key={product.id}
          className="product-card"
          onClick={() => handleProductClick(product)}
          style={{ ...cardBaseStyle, height: "100%" }}
        >
          <div style={getImgContainerStyle("3 / 4")}>
            {renderDiscountBadge()}
            {renderCollectionBadges(false)}
            {product.normalizedImage ? (
              <img
                src={product.normalizedImage}
                alt={product.name}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
            {show_brand_name && (
              <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {brandText}
              </span>
            )}
            <h3 style={{ margin: 0, fontSize: "14px", lineHeight: "1.3", fontWeight: 700, color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", minHeight: "34px" }}>
              {product.name}
            </h3>
            {show_ratings && (
              <div style={{ fontSize: "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: "4px", flexWrap: "wrap", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
              </div>
              {renderInStockBadge()}
            </div>
          </div>
        </article>
      );
    }

    // 2. ELECTRONICS PRESET
    if (cardStyleKey === "electronics") {
      return (
        <article
          key={product.id}
          className="product-card"
          onClick={() => handleProductClick(product)}
          style={{ ...cardBaseStyle, height: "100%" }}
        >
          <div style={getImgContainerStyle("4 / 3")}>
            {renderDiscountBadge()}
            {renderCollectionBadges(false)}
            {product.normalizedImage ? (
              <img
                src={product.normalizedImage}
                alt={product.name}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
            {show_brand_name && (
              <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {brandText}
              </span>
            )}
            <h3 style={{ margin: 0, fontSize: "14px", lineHeight: "1.3", fontWeight: 800, color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "34px" }}>
              {product.name}
            </h3>
            {show_ratings && (
              <div style={{ fontSize: "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: "5px", margin: "2px 0" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
              {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
            </div>
            <div style={{ marginTop: "auto" }}>
              {renderInStockBadge()}
            </div>
          </div>
        </article>
      );
    }

    // 3. BEAUTY PRESET
    if (cardStyleKey === "beauty") {
      return (
        <article
          key={product.id}
          className="product-card"
          onClick={() => handleProductClick(product)}
          style={{ ...cardBaseStyle, height: "100%", textAlign: "center" }}
        >
          <div style={getImgContainerStyle("1 / 1")}>
            {renderDiscountBadge()}
            {renderCollectionBadges(false)}
            {product.normalizedImage ? (
              <img
                src={product.normalizedImage}
                alt={product.name}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "2px", flex: 1 }}>
            {show_brand_name && (
              <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {brandText}
              </span>
            )}
            <h3 style={{ margin: 0, fontSize: "14px", lineHeight: "1.3", fontWeight: 800, color: pageText, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "34px" }}>
              {product.name}
            </h3>
            {show_ratings && (
              <div style={{ fontSize: "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: "5px", margin: "2px 0" }}>
              <span style={{ fontSize: "17px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
              {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
            </div>
            <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center" }}>
              {renderInStockBadge(true)}
            </div>
          </div>
        </article>
      );
    }

    // 4. GROCERY PRESET (100% IDENTICAL TO HOME PRODUCT CARD - PICTURE 2)
    if (cardStyleKey === "grocery") {
      return (
        <article
          key={product.id}
          className="product-card"
          onClick={() => handleProductClick(product)}
          style={{
            ...cardBaseStyle,
            flexDirection: "row",
            alignItems: "center",
            padding: "10px 12px",
            gap: "12px",
            overflow: "hidden",
            width: "100%",
          }}
        >
          {/* Left: 96px Image container with Discount Badge */}
          <div
            style={{
              position: "relative",
              width: "96px",
              height: "96px",
              minWidth: "96px",
              borderRadius: "12px",
              overflow: "hidden",
              background: resolvedImageBg,
              flexShrink: 0,
            }}
          >
            {renderDiscountBadge()}
            {product.normalizedImage ? (
              <img
                src={product.normalizedImage}
                alt={product.name}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "12px" }}>No image</div>
            )}
          </div>

          {/* Right: Info container with Brand, Badge, Title, Rating, Price & Stock Badge */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
            {/* Top row: Brand & Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", minWidth: 0 }}>
              {show_brand_name && (
                <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

            {/* Product Name */}
            <h3 style={{ margin: "1px 0 0", fontSize: "14px", lineHeight: "1.25", fontWeight: 700, color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
              {product.name}
            </h3>

            {/* Star Rating */}
            {show_ratings && (
              <div style={{ fontSize: "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px", margin: "1px 0" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}

            {/* Price & In Stock Pill */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "auto", paddingTop: "4px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "5px", flexShrink: 0 }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
              </div>
              {renderInStockBadge()}
            </div>
          </div>
        </article>
      );
    }

    // 5. BOOKS & STATIONERY / STANDARD PRESET
    return (
      <article
        key={product.id}
        className="product-card"
        onClick={() => handleProductClick(product)}
        style={{ ...cardBaseStyle, height: "100%" }}
      >
        <div style={getImgContainerStyle("1 / 1.35")}>
          {renderDiscountBadge()}
          {renderCollectionBadges(false)}
          {product.normalizedImage ? (
            <img
              src={product.normalizedImage}
              alt={product.name}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
          {show_brand_name && (
            <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {brandText}
            </span>
          )}
          <h3 style={{ margin: 0, fontSize: "14px", lineHeight: "1.3", fontWeight: 800, color: pageText, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "34px" }}>
            {product.name}
          </h3>
          <div style={{ borderTop: "1px solid rgba(148,163,184,0.2)", margin: "4px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
              {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
            </div>
            {show_ratings && (
              <div style={{ fontSize: "11px", fontWeight: 600, color: faintText }}>
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
  };

  return (
    <section
      className="product-carousel"
      style={{
        width: "100%",
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "24px 16px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <style>{`
        .product-carousel .product-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 24px -6px rgba(0,0,0,0.12) !important;
          border-color: ${accentColor} !important;
        }
        .product-carousel .product-card:hover img {
          transform: scale(1.04);
        }
        .product-carousel img {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>

      {/* Header with Title, Subtitle, View All, and Scroll Controls */}
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
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 800,
              color: pageText,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: mutedText }}>
              {subtitle}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          {effectiveViewAllLink && (
            <Link
              to={
                effectiveViewAllLink.startsWith("?")
                  ? `${location.pathname}${effectiveViewAllLink}`
                  : effectiveViewAllLink.startsWith("/")
                  ? `${appBase}${effectiveViewAllLink.replace(/^\/+/, "")}`
                  : `${appBase}/${effectiveViewAllLink}`
              }
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
          )}
        </div>
      </div>

      {/* Grid or Horizontal Scroll Carousel */}
      {layout === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              cardStyleKey === "grocery"
                ? "repeat(auto-fill, minmax(320px, 1fr))"
                : "repeat(auto-fill, minmax(190px, 1fr))",
            gap: "14px",
          }}
        >
          {normalizedProducts.map((p) => renderSingleProductCard(p))}
        </div>
      ) : cardStyleKey === "grocery" ? (
        /* 💡 2-ROW STACKED CAROUSEL FOR GROCERY (Zepto / Blinkit / Instamart style) */
        <div
          style={{
            display: "flex",
            gap: "12px",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingBottom: "8px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {stackedGroceryColumns.map((col, colIdx) => (
            <div
              key={colIdx}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                minWidth: "330px",
                maxWidth: "360px",
                flexShrink: 0,
                scrollSnapAlign: "start",
              }}
            >
              {col.map((p) => renderSingleProductCard(p))}
            </div>
          ))}
        </div>
      ) : (
        /* STANDARD 1-ROW HORIZONTAL CAROUSEL (Fashion, Electronics, Beauty, Books) */
        <div
          style={{
            display: "flex",
            gap: "14px",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingBottom: "8px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {normalizedProducts.map((p) => (
            <div
              key={p.id}
              style={{
                minWidth:
                  cardStyleKey === "fashion"
                    ? "190px"
                    : cardStyleKey === "electronics"
                    ? "210px"
                    : cardStyleKey === "books"
                    ? "180px"
                    : "185px",
                maxWidth:
                  cardStyleKey === "fashion"
                    ? "220px"
                    : cardStyleKey === "electronics"
                    ? "240px"
                    : cardStyleKey === "books"
                    ? "200px"
                    : "210px",
                flexShrink: 0,
                scrollSnapAlign: "start",
              }}
            >
              {renderSingleProductCard(p)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductCarousel;
