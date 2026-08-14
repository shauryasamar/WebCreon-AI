import React, { useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useCart, Product } from "../CartContext";
import FilterSidebar from "./FilterSidebar";
import { Pagination } from "./Pagination";

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
  totalProducts?: number;

  // Layout & Spacing
  grid_gap?: string | number;
  max_width?: string;

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

  // Typography & Colors
  title_color?: string;
  brand_color?: string;
  price_color?: string;
  original_price_color?: string;
  rating_star_color?: string;

  // Visibility Toggles
  show_discount_badge?: boolean;
  show_stock_badge?: boolean;
  show_ratings?: boolean;
  show_original_price?: boolean;
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
  totalProducts,
  grid_gap,
  max_width,
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
  title_color,
  brand_color,
  price_color,
  original_price_color,
  rating_star_color,
  show_discount_badge = true,
  show_stock_badge = true,
  show_ratings = true,
  show_original_price = true,
  show_brand_name = true,
  theme,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug: siteSlug } = useParams();
  const { products: cartProducts } = useCart();

  const products = productsProp ?? cartProducts;
  const isStoreRoute = location.pathname.startsWith("/store/");

  const appBase = isStoreRoute
    ? siteSlug
      ? `/store/${siteSlug}`
      : "/store"
    : `/builder/${siteId}`;

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

  const explicitLightMode = typeof theme?.mode === "string" && theme.mode.toLowerCase() === "light";
  const explicitDarkMode = typeof theme?.mode === "string" && theme.mode.toLowerCase() === "dark";

  const isLight = explicitLightMode || (!explicitDarkMode && (
    (theme?.text_color && isColorDarkHex(theme.text_color)) || 
    (theme?.primary_bg && !isColorDarkHex(theme.primary_bg)) || 
    (theme?.card_bg && !isColorDarkHex(theme.card_bg)) || 
    (!theme?.text_color && !theme?.primary_bg && !theme?.card_bg)
  ));
  const accentColor = theme?.accent_color || "#2563eb";
  const resolvedPrimaryBg = theme?.primary_bg || (isLight ? "#f8fafc" : "#0f172a");

  const cardStyleKey = card_style || cardStyle || theme?.card_style || "fashion";
  const cardBg = card_bg_color || theme?.card_bg || theme?.secondary_bg || (isLight ? (resolvedPrimaryBg === "#ffffff" ? "#ffffff" : "rgba(255,255,255,0.75)") : "#1e293b");
  const isCardDark = isColorDarkHex(cardBg);

  const preferredTextColor = title_color || (theme as any)?.card_text_color || theme?.text_color;
  const isPreferredDark = isColorDarkHex(preferredTextColor);
  const pageText = preferredTextColor && (isPreferredDark !== isCardDark)
    ? preferredTextColor
    : (isCardDark ? "#ffffff" : "#0f172a");

  const mutedText = original_price_color || (theme as any)?.muted_text_color || (isCardDark ? "rgba(255,255,255,0.68)" : "rgba(15,23,42,0.65)");
  const faintText = brand_color || (theme as any)?.soft_text_color || (isCardDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)");
  const starColor = rating_star_color || "#d97706";

  const subtleBorder = isLight
    ? `1px solid ${(theme as any)?.border_color || "rgba(15,23,42,0.08)"}`
    : `1px solid ${(theme as any)?.border_color || "rgba(255,255,255,0.12)"}`;

  const softShadow = isLight
    ? "0 10px 28px rgba(15,23,42,0.055)"
    : "0 12px 28px rgba(0,0,0,0.3)";

  let computedRadius = card_radius !== undefined && card_radius !== "" ? `${card_radius}px` : "20px";
  let computedCardBg = cardBg;
  let computedBorder = card_border_color ? `1px solid ${card_border_color}` : subtleBorder;

  let computedShadow = softShadow;
  if (card_shadow === "none") computedShadow = "none";
  else if (card_shadow === "subtle") computedShadow = isLight ? "0 4px 12px rgba(0,0,0,0.04)" : "0 4px 12px rgba(0,0,0,0.2)";
  else if (card_shadow === "soft") computedShadow = softShadow;
  else if (card_shadow === "elevated") computedShadow = isLight ? "0 20px 40px rgba(0,0,0,0.12)" : "0 20px 40px rgba(0,0,0,0.36)";

  if (card_radius === undefined || card_radius === "") {
    if (cardStyleKey === "electronics") computedRadius = "18px";
    else if (cardStyleKey === "beauty") computedRadius = "22px";
    else if (cardStyleKey === "grocery" || cardStyleKey === "books") computedRadius = "16px";
  }

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

      const discountPercentVal = product.discountPercent ?? product.discount_percent;
      const normalizedDiscountPercent =
        typeof discountPercentVal === "number" && discountPercentVal > 0
          ? discountPercentVal
          : normalizedOriginalPrice && normalizedOriginalPrice > normalizedDisplayPrice
          ? Math.round(
              ((normalizedOriginalPrice - normalizedDisplayPrice) /
                normalizedOriginalPrice) *
                100
            )
          : 0;

      const normalizedImage =
        product.image_url ||
        product.imageUrl ||
        product.image ||
        (Array.isArray(product.images) && product.images[0]) ||
        "";

      return {
        ...product,
        normalizedImage,
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

  const resolvedMaxWidth = max_width === "full" ? "100%" : max_width ? `${max_width}px` : "1120px";

  const parsedGap = Number(grid_gap);
  const resolvedGridGap =
    grid_gap !== undefined && grid_gap !== "" && !isNaN(parsedGap) && parsedGap >= 0
      ? `${parsedGap}px`
      : "16px";

  const resolvedColumns =
    cardStyleKey === "grocery"
      ? "repeat(auto-fill, minmax(310px, 1fr))"
      : "repeat(auto-fill, minmax(240px, 1fr))";

  const resolvedImageFit = image_fit || "cover";
  const resolvedImageBg = image_bg || (isLight ? "#f8fafc" : "rgba(255,255,255,0.04)");

  return (
    <section
      className="product-grid"
      style={{
        maxWidth: resolvedMaxWidth,
        margin: "0 auto",
        padding: "24px 16px 44px",
        background: outer_bg_color || "transparent",
        borderRadius: outer_bg_color ? "16px" : undefined,
        transition: "all 0.2s ease",
      }}
    >
      {/* Header & Filter Toolbar */}
      <FilterSidebar
        title={title}
        subtitle={subtitle}
        itemCount={itemCount ?? normalizedProducts.length}
        activeFilterCount={activeFilterCount}
        sortBy={sortBy}
        onSortChange={onSortChange}
        onFilterClick={onFilterClick}
        theme={theme}
      />

      <div
        className="product-grid__items"
        style={{
          display: "grid",
          gridTemplateColumns: resolvedColumns,
          gap: resolvedGridGap,
        }}
      >
        {normalizedProducts.map((product) => {
          const showOriginal =
            show_original_price &&
            typeof product.normalizedOriginalPrice === "number" &&
            product.normalizedOriginalPrice > product.normalizedDisplayPrice;

          const showDiscount =
            show_discount_badge &&
            product.normalizedDiscountPercent > 0 &&
            product.normalizedInStock;

          const isDisabled = !product.normalizedInStock;
          const ratingValue = Number(product.average_rating ?? 3.0);
          const ratingText = ratingValue > 0 ? ratingValue.toFixed(1) : "3.0";
          const reviewCount = Number(product.review_count ?? 3);

          const brandText = product.brand || product.category || "Collection";
          const activePriceColor = price_color || (cardStyleKey === "beauty" ? "#dc2626" : pageText);

          const renderDiscountBadge = () => (
            showDiscount ? (
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "10px",
                  zIndex: 2,
                  padding: "4px 8px",
                  borderRadius: "999px",
                  background: "#166534",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  boxShadow: "0 4px 12px rgba(22,101,52,0.25)",
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
                  fontSize: "11px",
                  fontWeight: 700,
                  color: product.normalizedInStock ? "#16a34a" : "#dc2626",
                  background: product.normalizedInStock ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  border: product.normalizedInStock ? "1px solid #16a34a" : "1px solid #dc2626",
                  display: "inline-block",
                  textAlign: "center",
                  margin: centered ? "8px auto 0" : undefined,
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
            role: isDisabled ? "article" : "button",
            tabIndex: isDisabled || !targetSlug ? -1 : 0,
            "aria-disabled": isDisabled,
          };

          const cardBaseStyle: React.CSSProperties = {
            cursor: isDisabled ? "not-allowed" : targetSlug ? "pointer" : "default",
            border: computedBorder,
            borderRadius: computedRadius,
            padding: "10px",
            background: isDisabled
              ? isLight
                ? "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.96) 100%)"
                : "linear-gradient(180deg, rgba(30,41,59,0.82) 0%, rgba(15,23,42,0.78) 100%)"
              : computedCardBg,
            boxShadow: computedShadow,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minHeight: "100%",
            boxSizing: "border-box",
            opacity: isDisabled ? 0.72 : 1,
            transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
          };

          const resolvedImageBg = image_bg || (isLight ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.2)");

          // Aspect ratio evaluation
          const getImgContainerStyle = (defaultAspect: string): React.CSSProperties => ({
            position: "relative",
            borderRadius: "14px",
            overflow: "hidden",
            background: resolvedImageBg,
            aspectRatio: image_aspect_ratio || defaultAspect,
          });

          // 1. Fashion / Apparel (Default layout)
          if (cardStyleKey === "fashion") {
            return (
              <article key={product.id} {...commonArticleProps} style={cardBaseStyle}>
                <div style={getImgContainerStyle("1 / 1.25")}>
                  {renderDiscountBadge()}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "4px 2px", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {show_brand_name && (
                      <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        {brandText}
                      </span>
                    )}
                    {show_ratings && (
                      <div style={{ fontSize: "10px", fontWeight: 600, color: faintText }}>
                        <span style={{ color: starColor }}>★</span> {ratingText} ({reviewCount})
                      </div>
                    )}
                  </div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: pageText }}>{product.name}</h3>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: "4px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                      {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                    </div>
                    {renderInStockBadge()}
                  </div>
                </div>
              </article>
            );
          }

          // 2. Electronics
          if (cardStyleKey === "electronics") {
            return (
              <article key={product.id} {...commonArticleProps} style={cardBaseStyle}>
                <div style={getImgContainerStyle("1 / 0.95")}>
                  {renderDiscountBadge()}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "6px 2px 0", flex: 1 }}>
                  {show_brand_name && (
                    <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {brandText}
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: pageText }}>{product.name}</h3>
                  {show_ratings && (
                    <div style={{ fontSize: "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                      <span style={{ color: starColor }}>★</span> {ratingText} ({reviewCount})
                    </div>
                  )}
                  <div style={{ marginTop: "auto", background: isLight ? "#f4f4f6" : "rgba(255,255,255,0.05)", padding: "10px 12px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                      {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                    </div>
                    {renderInStockBadge()}
                  </div>
                </div>
              </article>
            );
          }

          // 3. Beauty & Cosmetics
          if (cardStyleKey === "beauty") {
            return (
              <article key={product.id} {...commonArticleProps} style={{ ...cardBaseStyle, textAlign: "center" }}>
                <div style={getImgContainerStyle("1 / 1")}>
                  {renderDiscountBadge()}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "4px 2px", flex: 1 }}>
                  {show_brand_name && (
                    <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {brandText}
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: pageText, textAlign: "center" }}>{product.name}</h3>
                  {show_ratings && (
                    <div style={{ fontSize: "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: starColor }}>★</span> {ratingText} ({reviewCount})
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "4px 0" }}>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                    {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                  </div>
                  <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center" }}>
                    {renderInStockBadge(true)}
                  </div>
                </div>
              </article>
            );
          }

          // 4. Grocery
          if (cardStyleKey === "grocery") {
            return (
              <article key={product.id} {...commonArticleProps} style={{ ...cardBaseStyle, flexDirection: "row", alignItems: "center" }}>
                <div style={{ position: "relative", width: "120px", height: "120px", borderRadius: "14px", overflow: "hidden", background: resolvedImageBg, flexShrink: 0 }}>
                  {renderDiscountBadge()}
                  {product.normalizedImage ? (
                    <img src={product.normalizedImage} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "12px" }}>No image</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: 0, paddingLeft: "4px" }}>
                  {show_brand_name && (
                    <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {brandText}
                    </span>
                  )}
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: pageText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {product.name}
                  </h3>
                  {show_ratings && (
                    <div style={{ fontSize: "11px", fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: starColor }}>★</span> {ratingText} ({reviewCount})
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid rgba(148,163,184,0.2)", margin: "4px 0" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span style={{ fontSize: "18px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                      {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                    </div>
                    {renderInStockBadge()}
                  </div>
                </div>
              </article>
            );
          }

          // 5. Books & Stationery
          return (
            <article key={product.id} {...commonArticleProps} style={cardBaseStyle}>
              <div style={getImgContainerStyle("1 / 1.35")}>
                {renderDiscountBadge()}
                {product.normalizedImage ? (
                  <img src={product.normalizedImage} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "6px 2px 2px", flex: 1 }}>
                {show_brand_name && (
                  <span style={{ fontSize: "10px", fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {brandText}
                  </span>
                )}
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: pageText }}>{product.name}</h3>
                <div style={{ borderTop: "1px solid rgba(148,163,184,0.2)", margin: "4px 0" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                    {showOriginal && <span style={{ fontSize: "11px", color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
                  </div>
                  {show_ratings && (
                    <div style={{ fontSize: "11px", fontWeight: 600, color: faintText }}>
                      <span style={{ color: starColor }}>★</span> {ratingText} ({reviewCount})
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

      {totalPages && totalPages > 1 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          totalItems={totalProducts || itemCount}
          pageSize={pageSize}
          showRangeText={true}
          theme={theme}
          accentColor={accentColor}
        />
      ) : null}
    </section>
  );
};

export default ProductGrid;