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
  // Header controls
  show_title?: boolean;
  show_subtitle?: boolean;
  title_alignment?: "left" | "center" | "right";
  title_font_size?: string | number;
  title_font_weight?: string | number;
  title_text_transform?: "none" | "uppercase" | "capitalize";
  subtitle_font_size?: string | number;
  subtitle_font_weight?: string | number;
  subtitle_color?: string;
  show_view_all?: boolean;
  view_all_text?: string;
  viewAllLink?: string;
  view_all_link?: string;
  // Layout
  layout?: "carousel" | "grid";
  grid_columns?: number | string;
  cardStyle?: string;
  card_style?: string;
  card_width?: string | number;
  limit?: number;
  rules?: ProductCarouselFilterRules;
  categoryName?: string;
  collectionId?: string;
  brandName?: string;
  sortBy?: "bestseller" | "rating_desc" | "newest" | "price_asc" | "price_desc" | "discount_desc";
  theme?: any;
  // Spacing & bounds
  max_width?: string;
  gap?: string | number;
  grid_gap?: string | number;
  padding_y?: string | number;
  padding_x?: string | number;
  outer_bg_color?: string;
  // Visual Appearance Tokens
  card_bg_color?: string;
  card_radius?: string | number;
  card_border_color?: string;
  card_shadow?: string;
  title_color?: string;
  product_name_font_size?: string | number;
  product_name_font_weight?: string | number;
  product_name_font_family?: string;
  product_name_font_style?: "normal" | "italic";
  product_name_text_transform?: "none" | "uppercase" | "capitalize";
  product_name_color?: string;
  product_title_font_size?: string | number;
  product_title_font_weight?: string | number;
  product_title_font_family?: string;
  product_title_font_style?: "normal" | "italic";
  product_title_text_transform?: "none" | "uppercase" | "capitalize";
  product_title_color?: string;
  brand_color?: string;
  price_color?: string;
  price_font_size?: string | number;
  original_price_color?: string;
  rating_star_color?: string;
  image_aspect_ratio?: string;
  image_fit?: "cover" | "contain";
  image_bg?: string;
  image_radius?: string | number;
  image_corner_radius?: string | number;
  show_discount_badge?: boolean;
  show_stock_badge?: boolean;
  show_ratings?: boolean;
  show_original_price?: boolean;
  show_brand_name?: boolean;
  badge_style?: "pill" | "square" | "minimal" | "hidden";
  accent_color?: string;
}

function formatAspectRatio(ratio?: string): string {
  if (!ratio) return "3 / 4";
  const trimmed = String(ratio).trim();
  if (trimmed === "auto" || trimmed === "natural") return "auto";
  if (trimmed.includes(":")) {
    const [w, h] = trimmed.split(":").map((s) => s.trim());
    if (w && h) return `${w} / ${h}`;
  }
  if (trimmed.includes("/") && !trimmed.includes(" / ")) {
    const [w, h] = trimmed.split("/").map((s) => s.trim());
    if (w && h) return `${w} / ${h}`;
  }
  return trimmed;
}

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
      return fontKey.includes(",") ? fontKey : `'${fontKey}', sans-serif`;
  }
}

export const ProductCarousel: React.FC<ProductCarouselProps> = ({
  id,
  title = "Featured Products",
  subtitle,
  show_title = true,
  show_subtitle = true,
  title_alignment = "left",
  title_font_size,
  title_font_weight,
  title_text_transform = "none",
  subtitle_font_size,
  subtitle_font_weight,
  subtitle_color,
  show_view_all = true,
  view_all_text = "View All",
  viewAllLink,
  view_all_link,
  layout = "carousel",
  grid_columns,
  cardStyle,
  card_style,
  card_width,
  limit = 10,
  rules,
  categoryName,
  collectionId,
  brandName,
  sortBy,
  theme,
  max_width,
  gap,
  grid_gap,
  padding_y,
  padding_x,
  outer_bg_color,
  card_bg_color,
  card_radius,
  card_border_color,
  card_shadow,
  title_color,
  product_name_font_size,
  product_name_font_weight,
  product_name_font_family,
  product_name_font_style,
  product_name_text_transform,
  product_name_color,
  product_title_font_size,
  product_title_font_weight,
  product_title_font_family,
  product_title_font_style,
  product_title_text_transform,
  product_title_color,
  brand_color,
  price_color,
  price_font_size,
  original_price_color,
  rating_star_color,
  image_aspect_ratio,
  image_fit,
  image_bg,
  image_radius,
  image_corner_radius,
  show_discount_badge = true,
  show_stock_badge = true,
  show_ratings = true,
  show_original_price = true,
  show_brand_name = true,
  badge_style = "pill",
  accent_color,
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

  // ── Mobile Viewport Detection ──────────────────────────────────────────────
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 640;
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // Theme Token Resolution (Identical to ProductGrid.tsx)
  const {
    isDark,
    cardBg: defaultCardBg,
    textColor: defaultTextColor,
    mutedTextColor: defaultMutedText,
    softTextColor: defaultFaintText,
    borderColor: resolvedBorderColor,
    accentColor: defaultAccentColor,
  } = resolveThemeTokens(theme);

  // Prefer explicit prop override then theme
  const resolvedAccentColor = accent_color || defaultAccentColor;

  const isLight = !isDark;

  // Active Card Style Key (Inherits directly from theme asset selection: fashion | electronics | beauty | grocery | books)
  const rawCarouselCardStyle = String(card_style || cardStyle || "").toLowerCase().trim();
  const cardStyleKey =
    rawCarouselCardStyle &&
    rawCarouselCardStyle !== "default" &&
    rawCarouselCardStyle !== "inherit" &&
    rawCarouselCardStyle !== "theme" &&
    rawCarouselCardStyle !== "auto"
      ? rawCarouselCardStyle
      : (theme?.card_style || "fashion").toLowerCase().trim();

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

  // ── Corner Radius: support numeric px string or raw number ─────────────────
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
  else if (card_shadow === "subtle") computedShadow = isLight ? "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)" : "0 2px 6px rgba(0,0,0,0.35)";
  else if (card_shadow === "soft") computedShadow = isLight ? "0 4px 12px -2px rgba(0,0,0,0.07), 0 2px 6px -1px rgba(0,0,0,0.03)" : "0 6px 18px -2px rgba(0,0,0,0.5)";
  else if (card_shadow === "elevated") computedShadow = isLight ? "0 10px 24px -4px rgba(0,0,0,0.09), 0 4px 8px -2px rgba(0,0,0,0.04)" : "0 12px 28px -4px rgba(0,0,0,0.65)";

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
    return generateSectionFilterUrl(title, effectiveRules, viewAllLink || view_all_link, id);
  }, [title, effectiveRules, viewAllLink, view_all_link, id]);

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
        normalizedImage: optimizeImageUrl(rawImg, 600, 600),
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

  // Exact Card Renderer with Uniform Proportional Scaling (Width & Height scale together)
  const renderSingleProductCard = (product: typeof normalizedProducts[0], isSingleInColumn = false) => {
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

    const isGrocery = cardStyleKey === "grocery";
    const baseCardWidth = isGrocery ? 280 : 190;
    const minCardWidth = isGrocery ? 220 : 140;
    const maxCardWidth = isGrocery ? 320 : 280;

    const parsedCardWidthNum = (() => {
      if (card_width !== undefined && card_width !== null && String(card_width).trim() !== "") {
        const raw = typeof card_width === "number" ? card_width : parseInt(String(card_width), 10) || baseCardWidth;
        return Math.max(minCardWidth, Math.min(maxCardWidth, raw));
      }
      return baseCardWidth;
    })();

    // Uniform geometric scale ratio (scales width & height in the exact same proportion)
    const scaleRatio = parsedCardWidthNum / baseCardWidth;
    const scalePx = (base: number, min = 8): string =>
      `${Math.max(min, Math.round(base * scaleRatio))}px`;

    // Grocery card proportional height & image size (both width & height scale together in 280:108 ratio)
    const groceryHeightPx = Math.round(parsedCardWidthNum * (108 / 280));
    const groceryImgSizePx = Math.max(68, Math.round(groceryHeightPx - Math.round(18 * scaleRatio)));

    const renderCollectionBadges = (isCompact = false) => {
      if (!badgeCollections || badgeCollections.length === 0) return null;
      return (
        <div
          style={{
            position: "absolute",
            top: scalePx(6, 4),
            right: scalePx(6, 4),
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
                padding: `${scalePx(2, 2)} ${scalePx(6, 4)}`,
                borderRadius: "5px",
                background: col.badge_color || "linear-gradient(135deg, #d97706, #b45309)",
                color: "#ffffff",
                fontSize: scalePx(8.5, 7.5),
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
            top: scalePx(6, 4),
            left: scalePx(6, 4),
            zIndex: 2,
            padding: `${scalePx(2.5, 2)} ${scalePx(6, 4)}`,
            borderRadius: "999px",
            background: "#166534",
            color: "#ffffff",
            fontSize: scalePx(9, 7.5),
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
            fontSize: scalePx(10.5, 8),
            fontWeight: 700,
            color: product.normalizedInStock ? "#16a34a" : "#dc2626",
            background: product.normalizedInStock ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
            padding: `${scalePx(3, 2)} ${scalePx(8, 5)}`,
            borderRadius: "999px",
            border: product.normalizedInStock ? "1px solid #16a34a" : "1px solid #dc2626",
            display: "inline-block",
            textAlign: "center",
            margin: centered ? `${scalePx(5, 3)} auto 0` : undefined,
            flexShrink: 0,
          }}
        >
          {product.normalizedInStock ? "In stock" : "Out of stock"}
        </span>
      ) : null;

    const cardBaseStyle: React.CSSProperties = {
      cursor: isDisabled ? "not-allowed" : "pointer",
      border: computedBorder,
      borderRadius: !isNaN(parsedCardRadiusNum) && parsedCardRadiusNum >= 0
        ? `${Math.min(parsedCardRadiusNum, isMobile ? 24 : 48)}px`
        : isMobile ? "14px" : computedRadius,
      padding: scalePx(10, 6),
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
      gap: scalePx(6, 4),
      minHeight: "100%",
      boxSizing: "border-box",
      overflow: "hidden",
      opacity: isDisabled ? 0.72 : 1,
      transition: "border-color 150ms ease, box-shadow 150ms ease",
    };

    const baseProductNameSize =
      parseInt(String(product_name_font_size || product_title_font_size || "14"), 10) || 14;
    const resolvedProductNameSize = scalePx(baseProductNameSize, 10);

    const resolvedProductNameWeight =
      product_name_font_weight || product_title_font_weight || 700;

    const resolvedProductNameFamily = resolveFontFamily(
      product_name_font_family || product_title_font_family
    );

    const resolvedProductNameStyle =
      product_name_font_style || product_title_font_style || "normal";

    const resolvedProductNameTransform =
      product_name_text_transform || product_title_text_transform || "none";

    const resolvedProductNameColor =
      product_name_color || product_title_color || pageText;

    const resolvedImageRadius = (() => {
      const raw =
        image_radius !== undefined && image_radius !== null && String(image_radius).trim() !== ""
          ? image_radius
          : image_corner_radius !== undefined && image_corner_radius !== null && String(image_corner_radius).trim() !== ""
          ? image_corner_radius
          : undefined;
      if (raw !== undefined) {
        const num = typeof raw === "number" ? raw : parseInt(String(raw), 10);
        if (!isNaN(num) && num >= 0) return `${num}px`;
      }
      return isMobile ? "10px" : "14px";
    })();

    const getImgContainerStyle = (defaultAspect: string): React.CSSProperties => {
      const chosenAspect = image_aspect_ratio
        ? (image_aspect_ratio === "auto" ? undefined : formatAspectRatio(image_aspect_ratio))
        : isMobile ? "1 / 1.12" : formatAspectRatio(defaultAspect);

      return {
        position: "relative",
        width: "100%",
        aspectRatio: chosenAspect,
        borderRadius: resolvedImageRadius,
        overflow: "hidden",
        background: resolvedImageBg,
        flex: "0 0 auto",
        flexShrink: 0,
        flexGrow: 0,
      };
    };

    // 1. FASHION PRESET
    if (cardStyleKey === "fashion") {
      return (
        <article
          key={product.id}
          className="product-card"
          onClick={() => handleProductClick(product)}
          style={cardBaseStyle}
        >
          <div style={getImgContainerStyle("3 / 4")}>
            {renderDiscountBadge()}
            {renderCollectionBadges(isMobile)}
            {product.normalizedImage ? (
              <img
                src={product.normalizedImage}
                alt={product.name}
                loading="lazy"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: resolvedImageFit,
                  display: "block",
                }}
              />
            ) : (
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
            {show_brand_name && (
              <span style={{ fontSize: scalePx(10, 8), fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {brandText}
              </span>
            )}
            <h3
              style={{
                margin: 0,
                fontSize: resolvedProductNameSize,
                lineHeight: "1.3",
                fontWeight: resolvedProductNameWeight as any,
                fontFamily: resolvedProductNameFamily,
                fontStyle: resolvedProductNameStyle,
                textTransform: resolvedProductNameTransform as any,
                color: resolvedProductNameColor,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minHeight: "2.6em",
                maxHeight: "2.6em",
              }}
            >
              {product.name}
            </h3>
            {show_ratings && (
              <div style={{ fontSize: scalePx(11, 9), fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: scalePx(4, 2), flexWrap: "wrap", gap: scalePx(4, 2) }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: scalePx(5, 3) }}>
                <span style={{ fontSize: scalePx(16, 12), fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                {showOriginal && <span style={{ fontSize: scalePx(11, 9), color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
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
          style={cardBaseStyle}
        >
          <div style={getImgContainerStyle("4 / 3")}>
            {renderDiscountBadge()}
            {renderCollectionBadges(isMobile)}
            {product.normalizedImage ? (
              <img
                src={product.normalizedImage}
                alt={product.name}
                loading="lazy"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: resolvedImageFit,
                  display: "block",
                }}
              />
            ) : (
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
            {show_brand_name && (
              <span style={{ fontSize: scalePx(10, 8), fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {brandText}
              </span>
            )}
            <h3
              style={{
                margin: 0,
                fontSize: resolvedProductNameSize,
                lineHeight: "1.3",
                fontWeight: resolvedProductNameWeight as any,
                fontFamily: resolvedProductNameFamily,
                fontStyle: resolvedProductNameStyle,
                textTransform: resolvedProductNameTransform as any,
                color: resolvedProductNameColor,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: "2.6em",
                maxHeight: "2.6em",
              }}
            >
              {product.name}
            </h3>
            {show_ratings && (
              <div style={{ fontSize: scalePx(11, 9), fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: scalePx(5, 3), margin: "2px 0" }}>
              <span style={{ fontSize: scalePx(16, 12), fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
              {showOriginal && <span style={{ fontSize: scalePx(11, 9), color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
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
          style={{ ...cardBaseStyle, textAlign: "center" }}
        >
          <div style={getImgContainerStyle("1 / 1")}>
            {renderDiscountBadge()}
            {renderCollectionBadges(isMobile)}
            {product.normalizedImage ? (
              <img
                src={product.normalizedImage}
                alt={product.name}
                loading="lazy"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: resolvedImageFit,
                  display: "block",
                }}
              />
            ) : (
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "2px", flex: 1 }}>
            {show_brand_name && (
              <span style={{ fontSize: scalePx(10, 8), fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {brandText}
              </span>
            )}
            <h3
              style={{
                margin: 0,
                fontSize: resolvedProductNameSize,
                lineHeight: "1.3",
                fontWeight: resolvedProductNameWeight as any,
                fontFamily: resolvedProductNameFamily,
                fontStyle: resolvedProductNameStyle,
                textTransform: resolvedProductNameTransform as any,
                color: resolvedProductNameColor,
                textAlign: "center",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: "2.6em",
                maxHeight: "2.6em",
              }}
            >
              {product.name}
            </h3>
            {show_ratings && (
              <div style={{ fontSize: scalePx(11, 9), fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: scalePx(5, 3), margin: "2px 0" }}>
              <span style={{ fontSize: scalePx(17, 12), fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
              {showOriginal && <span style={{ fontSize: scalePx(11, 9), color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
            </div>
            <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "center" }}>
              {renderInStockBadge(true)}
            </div>
          </div>
        </article>
      );
    }

    // 4. GROCERY PRESET (100% IDENTICAL TO PRODUCT GRID CARD, SCALES IN EXACT SAME RATIO)
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
            padding: `${scalePx(10, 6)} ${scalePx(12, 8)}`,
            gap: scalePx(12, 8),
            overflow: "hidden",
            width: "100%",
            minHeight: isMobile ? "88px" : `${groceryHeightPx}px`,
            height: isSingleInColumn ? "auto" : `${groceryHeightPx}px`,
            maxHeight: `${groceryHeightPx}px`,
            boxSizing: "border-box",
          }}
        >
          {/* Left: Scaled Square Image container with Discount Badge */}
          <div
            style={{
              position: "relative",
              width: `${groceryImgSizePx}px`,
              height: `${groceryImgSizePx}px`,
              minWidth: `${groceryImgSizePx}px`,
              borderRadius: image_radius !== undefined && image_radius !== "" ? resolvedImageRadius : (isMobile ? "10px" : "12px"),
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
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: resolvedImageFit,
                  display: "block",
                }}
              />
            ) : (
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "12px" }}>No image</div>
            )}
          </div>

          {/* Right: Info container with Brand, Badge, Title, Rating, Price & Stock Badge */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
            {/* Top row: Brand & Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", minWidth: 0 }}>
              {show_brand_name && (
                <span style={{ fontSize: scalePx(10, 8), fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {brandText}
                </span>
              )}
              {badgeCollections.length > 0 && (
                <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                  {badgeCollections.slice(0, 1).map((col: any) => (
                    <span
                      key={col.id || col.name}
                      style={{
                        fontSize: scalePx(8, 7),
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: `${scalePx(2, 1.5)} ${scalePx(5, 3)}`,
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
            <h3
              style={{
                margin: "1px 0 0",
                fontSize: resolvedProductNameSize,
                lineHeight: "1.25",
                fontWeight: resolvedProductNameWeight as any,
                fontFamily: resolvedProductNameFamily,
                fontStyle: resolvedProductNameStyle,
                textTransform: resolvedProductNameTransform as any,
                color: resolvedProductNameColor,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {product.name}
            </h3>

            {/* Star Rating */}
            {show_ratings && (
              <div style={{ fontSize: scalePx(11, 9), fontWeight: 600, color: faintText, display: "flex", alignItems: "center", gap: "3px", margin: "1px 0" }}>
                <span style={{ color: starColor }}>★</span> {ratingDisplay}
              </div>
            )}

            {/* Price & In Stock Pill */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "auto", paddingTop: scalePx(4, 2), minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: scalePx(5, 3), flexShrink: 0 }}>
                <span style={{ fontSize: scalePx(16, 12), fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
                {showOriginal && <span style={{ fontSize: scalePx(11, 9), color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
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
        style={cardBaseStyle}
      >
        <div style={getImgContainerStyle("1 / 1.35")}>
          {renderDiscountBadge()}
          {renderCollectionBadges(isMobile)}
          {product.normalizedImage ? (
            <img
              src={product.normalizedImage}
              alt={product.name}
              loading="lazy"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: resolvedImageFit,
                display: "block",
              }}
            />
          ) : (
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "grid", placeItems: "center", color: mutedText, fontSize: "13px" }}>No image</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px", flex: 1 }}>
          {show_brand_name && (
            <span style={{ fontSize: scalePx(10, 8), fontWeight: 700, color: faintText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {brandText}
            </span>
          )}
          <h3
            style={{
              margin: 0,
              fontSize: resolvedProductNameSize,
              lineHeight: "1.3",
              fontWeight: resolvedProductNameWeight as any,
              fontFamily: resolvedProductNameFamily,
              fontStyle: resolvedProductNameStyle,
              textTransform: resolvedProductNameTransform as any,
              color: resolvedProductNameColor,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "2.6em",
              maxHeight: "2.6em",
            }}
          >
            {product.name}
          </h3>
          <div style={{ borderTop: "1px solid rgba(148,163,184,0.2)", margin: "4px 0" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: scalePx(4, 2) }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: scalePx(5, 3) }}>
              <span style={{ fontSize: scalePx(16, 12), fontWeight: 800, color: activePriceColor }}>₹{product.normalizedDisplayPrice}</span>
              {showOriginal && <span style={{ fontSize: scalePx(11, 9), color: mutedText, textDecoration: "line-through" }}>₹{product.normalizedOriginalPrice}</span>}
            </div>
            {show_ratings && (
              <div style={{ fontSize: scalePx(11, 9), fontWeight: 600, color: faintText }}>
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

  // ── Resolved display values (support prop overrides) ──────────────────────
  const resolvedMaxWidth =
    max_width === "full" || !max_width
      ? "100%"
      : String(max_width).endsWith("px") || String(max_width).endsWith("%")
      ? String(max_width)
      : `${max_width}px`;

  const resolvedGap =
    gap !== undefined
      ? typeof gap === "number" ? `${gap}px` : gap
      : grid_gap !== undefined
        ? typeof grid_gap === "number" ? `${grid_gap}px` : grid_gap
        : "14px";

  const resolvedPaddingY =
    padding_y !== undefined && padding_y !== null && String(padding_y).trim() !== ""
      ? typeof padding_y === "number"
        ? `${padding_y}px`
        : !isNaN(parseInt(String(padding_y), 10))
          ? `${parseInt(String(padding_y), 10)}px`
          : padding_y
      : isMobile ? "8px" : "12px";

  const resolvedPaddingX =
    padding_x !== undefined
      ? typeof padding_x === "number" ? `${padding_x}px` : padding_x
      : isMobile ? "12px" : "16px";

  // ── Card sizing ──────────────────────────────────────────────────────────────
  const defaultCardWidths: Record<string, string> = {
    fashion: "190px",
    electronics: "205px",
    books: "185px",
    beauty: "190px",
    grocery: "280px",
  };

  const resolvedCardWidth = (() => {
    const isGrocery = cardStyleKey === "grocery";
    const minCardWidth = isGrocery ? 220 : 140;
    const maxCardWidth = isGrocery ? 320 : 280;
    if (card_width !== undefined && card_width !== null && String(card_width).trim() !== "") {
      const rawPx = typeof card_width === "number" ? card_width : parseInt(String(card_width), 10) || (isGrocery ? 280 : 190);
      const px = Math.max(minCardWidth, Math.min(maxCardWidth, rawPx));
      return isMobile
        ? isGrocery
          ? `min(${px}px, 78vw)`
          : `min(${px}px, 48vw)`
        : `${px}px`;
    }
    if (isMobile) {
      return isGrocery ? "min(280px, 78vw)" : "min(190px, 48vw)";
    }
    return defaultCardWidths[cardStyleKey] || (isGrocery ? "280px" : "190px");
  })();

  const resolvedTitleSize =
    title_font_size
      ? typeof title_font_size === "number" ? `${title_font_size}px` : String(title_font_size)
      : isMobile ? "17px" : "20px";

  const resolvedSubtitleSize =
    subtitle_font_size
      ? typeof subtitle_font_size === "number" ? `${subtitle_font_size}px` : String(subtitle_font_size)
      : isMobile ? "12px" : "13px";

  const resolvedSubtitleColor = subtitle_color || mutedText;

  const hasHeader =
    (show_title && title) ||
    (show_subtitle && subtitle) ||
    (show_view_all && effectiveViewAllLink);

  return (
    <section
      className="product-carousel"
      style={{
        width: "100%",
        maxWidth: resolvedMaxWidth,
        margin: "0 auto",
        padding: `${resolvedPaddingY} ${resolvedPaddingX}`,
        boxSizing: "border-box",
        position: "relative",
        background: outer_bg_color || "transparent",
      }}
    >
      <style>{`
        .product-carousel-track::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        .product-carousel .product-card {
          transition: border-color 0.1s ease !important;
        }
        @media (hover: hover) and (pointer: fine) {
          .product-carousel .product-card:hover {
            border-color: ${resolvedAccentColor} !important;
          }
        }
      `}</style>

      {/* ── Section Header ───────────────────────────────────────────────── */}
      {hasHeader && (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: title_alignment === "center" ? "center" : "space-between",
            marginBottom: isMobile ? "8px" : "11px",
            width: "100%",
          }}
        >
          <div
            style={{
              textAlign: title_alignment === "center" ? "center" : "left",
              flex: 1,
              paddingRight:
                title_alignment === "center" && show_view_all && effectiveViewAllLink
                  ? isMobile
                    ? "72px"
                    : "90px"
                  : undefined,
              paddingLeft:
                title_alignment === "center" && show_view_all && effectiveViewAllLink
                  ? isMobile
                    ? "72px"
                    : "90px"
                  : undefined,
            }}
          >
            {show_title && title && (
              <h2
                style={{
                  margin: 0,
                  fontSize: resolvedTitleSize,
                  fontWeight: (title_font_weight as any) || 800,
                  textTransform: title_text_transform || "none",
                  color: pageText,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.25,
                }}
              >
                {title}
              </h2>
            )}
            {show_subtitle && subtitle && (
              <p
                style={{
                  margin: show_title && title ? "4px 0 0" : 0,
                  fontSize: resolvedSubtitleSize,
                  fontWeight: (subtitle_font_weight as any) || 500,
                  color: resolvedSubtitleColor,
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {show_view_all && effectiveViewAllLink && (
            <div
              style={{
                position: title_alignment === "center" ? "absolute" : "static",
                right: title_alignment === "center" ? 0 : undefined,
                top: title_alignment === "center" ? "50%" : undefined,
                transform: title_alignment === "center" ? "translateY(-50%)" : undefined,
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                zIndex: 1,
              }}
            >
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
                  fontSize: isMobile ? "12px" : "13px",
                  fontWeight: 700,
                  color: resolvedAccentColor,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {view_all_text || "View All"} &gt;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Grid or Horizontal Scroll Carousel ───────────────────────────── */}
      {layout === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              grid_columns && String(grid_columns) !== "auto"
                ? `repeat(${grid_columns}, 1fr)`
                : isMobile
                  ? "repeat(2, 1fr)"
                  : cardStyleKey === "grocery"
                    ? "repeat(auto-fill, minmax(300px, 1fr))"
                    : "repeat(auto-fill, minmax(190px, 1fr))",
            gap: resolvedGap,
            paddingTop: "4px",
            paddingBottom: "8px",
          }}
        >
          {normalizedProducts.map((p) => renderSingleProductCard(p))}
        </div>
      ) : cardStyleKey === "grocery" ? (
        /* 2-ROW STACKED CAROUSEL (Zepto / Blinkit / Instamart style) */
        <div
          className="product-carousel-track"
          style={{
            display: "flex",
            gap: resolvedGap,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingTop: "3px",
            paddingBottom: "4px",
            paddingLeft: "2px",
            paddingRight: "2px",
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
                justifyContent: "flex-start",
                width: resolvedCardWidth,
                minWidth: resolvedCardWidth,
                maxWidth: resolvedCardWidth,
                flex: `0 0 ${resolvedCardWidth}`,
                flexShrink: 0,
                scrollSnapAlign: "start",
                boxSizing: "border-box",
              }}
            >
              {col.map((p) => renderSingleProductCard(p, col.length === 1))}
            </div>
          ))}
        </div>
      ) : (
        /* STANDARD 1-ROW HORIZONTAL CAROUSEL (Fashion, Electronics, Beauty, Books) */
        <div
          className="product-carousel-track"
          style={{
            display: "flex",
            gap: resolvedGap,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingTop: "3px",
            paddingBottom: "4px",
            paddingLeft: "2px",
            paddingRight: "2px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {normalizedProducts.map((p) => (
            <div
              key={p.id}
              style={{
                width: resolvedCardWidth,
                minWidth: resolvedCardWidth,
                maxWidth: resolvedCardWidth,
                flex: `0 0 ${resolvedCardWidth}`,
                flexShrink: 0,
                scrollSnapAlign: "start",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
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
