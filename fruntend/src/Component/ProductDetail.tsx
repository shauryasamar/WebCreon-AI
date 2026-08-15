import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useCart, Product, ProductReview } from "../CartContext";
import { API_BASE_URL } from "../config/api";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { resolveThemeTokens } from "../context/ThemeContext";

type ProductDetailProps = {
  product?: Product | null;
  selectedProduct?: Product | null;

  add_to_cart_label?: string;
  button_bg_color?: string;
  button_text_color?: string;
  background_color?: string;
  panel_color?: string;
  text_color?: string;

  show_delivery_info?: boolean;
  delivery_text?: string;
  show_return_policy?: boolean;
  return_policy_text?: string;
  show_quality_guarantee?: boolean;
  quality_text?: string;

  show_discount_badge?: boolean;
  show_stock_badge?: boolean;
  show_ratings?: boolean;
  show_original_price?: boolean;
  show_brand_name?: boolean;
  show_reviews_section?: boolean;

  max_width?: string;
  image_aspect_ratio?: string;
  image_fit?: "cover" | "contain";

  theme?: {
    mode?: string;
    primary_bg?: string;
    secondary_bg?: string;
    card_bg?: string;
    text_color?: string;
    accent_color?: string;
    card_text_color?: string;
    card_shadow?: string;
    [key: string]: any;
  };
};

type VariantValue = {
  value: string;
  inStock?: boolean;
  stockQty?: number | null;
  price?: number | null;
  comparePrice?: number | null;
};

type VariantOption = {
  optionType?: string;
  optionName: string;
  optionValues?: VariantValue[];
};

type DeliveredOrderItem = {
  id: string;
  product_id: string | number;
  product_name?: string;
  product_slug?: string | null;
  product_image?: string | null;
  selected_variant_label?: string | null;
  selected_variant_value?: string | null;
  status?: string;
  is_returnable?: boolean;
};

type DeliveredOrder = {
  id: string | number;
  status?: string;
  items?: DeliveredOrderItem[];
};

function isColorDarkHex(colorHex?: string): boolean {
  if (!colorHex || typeof colorHex !== "string") return false;
  if (colorHex.startsWith("rgb")) {
    const match = colorHex.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
    }
  }
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

const MAX_GALLERY_IMAGES = 5;

const ProductDetail: React.FC<ProductDetailProps> = ({
  product: propProduct,
  selectedProduct,
  add_to_cart_label,
  button_bg_color,
  button_text_color,
  background_color,
  panel_color,
  text_color,
  show_delivery_info = true,
  delivery_text,
  show_return_policy = true,
  return_policy_text,
  show_quality_guarantee = true,
  quality_text,
  show_discount_badge = true,
  show_stock_badge = true,
  show_ratings = true,
  show_original_price = true,
  show_brand_name = true,
  show_reviews_section = true,
  max_width,
  image_aspect_ratio,
  image_fit,
  theme,
}) => {
  const { addToCart, products, cartItems } = useCart();
  const { isAuthenticated } = useCustomerAuth();
  const { productSlug } = useParams();

  const product =
    propProduct ??
    selectedProduct ??
    (productSlug
      ? products.find((p) => p.slug === productSlug) ??
        products.find((p) => String(p.id) === String(productSlug)) ??
        null
      : null);

  const anyProduct = (product ?? {}) as any;

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [reviews, setReviews] = useState<ProductReview[]>(
    Array.isArray(anyProduct?.reviews) ? (anyProduct.reviews as ProductReview[]) : []
  );
  const [averageRating, setAverageRating] = useState<number>(
    Number(anyProduct?.average_rating ?? 0)
  );
  const [reviewCount, setReviewCount] = useState<number>(
    Number(anyProduct?.review_count ?? 0)
  );
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewUploadError, setReviewUploadError] = useState<string>("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string>("");
  const [eligibleOrderItem, setEligibleOrderItem] = useState<DeliveredOrderItem | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const normalizedImages: string[] = useMemo(() => {
    const imageList = Array.isArray(anyProduct?.images)
      ? anyProduct.images.filter(
          (image: unknown): image is string =>
            typeof image === "string" && image.trim() !== ""
        )
      : [];

    if (imageList.length) return imageList.slice(0, MAX_GALLERY_IMAGES);
    if (typeof anyProduct?.image === "string" && anyProduct.image.trim()) return [anyProduct.image];
    return [];
  }, [anyProduct]);

  const variantOption: VariantOption | null = anyProduct?.variant_option
    ? {
        optionType: anyProduct.variant_option.optionType,
        optionName: anyProduct.variant_option.optionName || "Options",
        optionValues: Array.isArray(anyProduct.variant_option.optionValues)
          ? anyProduct.variant_option.optionValues
          : [],
      }
    : null;

  const optionValues: VariantValue[] = Array.isArray(variantOption?.optionValues)
    ? variantOption.optionValues
    : Array.isArray(anyProduct?.sizes)
    ? anyProduct.sizes.map((size: string) => ({ value: size, inStock: true }))
    : [];

  const optionLabel = variantOption?.optionName || "Options";
  const hasVariants = optionValues.length > 0;
  const firstAvailableVariant =
    optionValues.find((option) => option.inStock !== false)?.value ??
    optionValues[0]?.value ??
    "";

  const siteId =
    anyProduct?.site_id != null
      ? String(anyProduct.site_id)
      : (selectedProduct as any)?.site_id != null
      ? String((selectedProduct as any).site_id)
      : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setReviews(Array.isArray(anyProduct?.reviews) ? anyProduct.reviews : []);
    setAverageRating(Number(anyProduct?.average_rating ?? 0));
    setReviewCount(Number(anyProduct?.review_count ?? 0));
  }, [anyProduct]);

  useEffect(() => {
    setSelectedImage(normalizedImages[0] || "");
  }, [normalizedImages]);

  useEffect(() => {
    setSelectedOption(firstAvailableVariant);
  }, [firstAvailableVariant, product?.id]);

  useEffect(() => {
    setQuantity(1);
    setAdded(false);
  }, [product?.id]);

  useEffect(() => {
    const loadProductReviews = async () => {
      if (!siteId || !product?.id) return;

      try {
        const res = await fetch(
          `${API_BASE_URL}/sites/${siteId}/products/${product.id}`,
          { credentials: "include" }
        );

        if (!res.ok) return;

        const data = await res.json();

        if (Array.isArray(data?.reviews)) {
          setReviews(data.reviews);
        }

        if (typeof data?.average_rating === "number") {
          setAverageRating(data.average_rating);
        }

        if (typeof data?.review_count === "number") {
          setReviewCount(data.review_count);
        }
      } catch (error) {
        console.error("Failed to load product reviews", error);
      }
    };

    loadProductReviews();
  }, [product?.id, siteId]);

  useEffect(() => {
    if (!isAuthenticated || !product || !siteId) return;

    const loadEligibleOrderItem = async () => {
      setCheckingEligibility(true);
      try {
        const res = await fetch(`${API_BASE_URL}/orders/${siteId}/delivered`, {
          credentials: "include",
        });
        if (!res.ok) {
          setEligibleOrderItem(null);
          return;
        }
        const data = await res.json();
        const ordersList = Array.isArray(data?.orders) ? data.orders : [];
        
        const matchedItem = ordersList
          .flatMap((o: any) => o.items || [])
          .find((item: any) => String(item.product_id) === String(product.id)) ?? null;

        setEligibleOrderItem(matchedItem);
      } catch (error) {
        setEligibleOrderItem(null);
      } finally {
        setCheckingEligibility(false);
      }
    };

    loadEligibleOrderItem();
  }, [isAuthenticated, product, siteId]);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  const {
    isDark,
    primaryBg: resolvedPrimaryBg,
    cardBg: defaultCardBg,
    textColor: defaultTextColor,
    borderColor: resolvedBorderColor,
    accentColor: defaultAccent,
    accentHover,
    accentText: defaultAccentText,
  } = resolveThemeTokens(theme);
  const panelBg =
    panel_color ||
    background_color ||
    (theme as any)?.product_detail_bg ||
    (theme as any)?.detail_bg ||
    defaultCardBg;

  // Determine dark vs light directly from the panel's own surface background!
  const isPanelDark = isColorDarkHex(panelBg);
  const isLight = !isPanelDark;

  // Derive high-contrast typography and subtle elements relative to the panel surface!
  const surfaceDefaultText = isPanelDark ? "#f8fafc" : "#0f172a";
  const rawRequestedText = text_color || (theme as any)?.product_detail_text;

  // If text color is provided and has good contrast, keep it; otherwise compute contrast against panel
  const pageText =
    rawRequestedText && (isColorDarkHex(rawRequestedText) !== isPanelDark)
      ? rawRequestedText
      : (theme as any)?.card_text_color && (isColorDarkHex((theme as any).card_text_color) !== isPanelDark)
      ? (theme as any).card_text_color
      : (defaultTextColor && isColorDarkHex(defaultTextColor) !== isPanelDark)
      ? defaultTextColor
      : surfaceDefaultText;

  const mutedText = isPanelDark ? "rgba(248, 250, 252, 0.72)" : "rgba(15, 23, 42, 0.68)";
  const subtleText = isPanelDark ? "rgba(248, 250, 252, 0.50)" : "rgba(15, 23, 42, 0.50)";

  const activeBtnBg =
    button_bg_color ||
    (theme as any)?.product_detail_btn_bg ||
    defaultAccent;

  const activeBtnTextColor =
    button_text_color ||
    (theme as any)?.product_detail_btn_text ||
    (isColorDarkHex(activeBtnBg) ? "#ffffff" : "#0f172a");

  const accentColor = activeBtnBg;

  const subtleBorder = isPanelDark
    ? `1px solid ${(theme as any)?.border_color || "rgba(255, 255, 255, 0.12)"}`
    : `1px solid ${(theme as any)?.border_color || "rgba(15, 23, 42, 0.10)"}`;

  if (!product) {
    return (
      <section style={{ maxWidth: "1160px", margin: "0 auto", padding: "20px 16px 40px" }}>
        <div
          style={{
            border: subtleBorder,
            borderRadius: "20px",
            padding: "24px",
            background: panelBg,
            color: mutedText,
          }}
        >
          Product not found.
        </div>
      </section>
    );
  }

  const elevatedBg = isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.06)";
  const softSectionBg = isLight ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.04)";
  const mediaBg = isLight ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.25)";

  const strongerBorder = isLight
    ? `1px solid ${(theme as any)?.border_color || "rgba(15,23,42,0.16)"}`
    : `1px solid ${(theme as any)?.border_color || "rgba(255,255,255,0.18)"}`;

  const softShadow = isLight
    ? "0 12px 32px rgba(15,23,42,0.06)"
    : "0 16px 36px rgba(0,0,0,0.3)";

  const panelShadow = isLight
    ? "0 18px 40px rgba(15,23,42,0.08)"
    : "0 22px 48px rgba(0,0,0,0.35)";

  const activeRing = `0 0 0 3px ${accentColor}25`;
  const reviewCardBg = isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.05)";

  const shellCard = {
    border: subtleBorder,
    background: panelBg,
  } as const;

  const reviewInputBase = {
    width: "100%",
    borderRadius: "12px",
    border: strongerBorder,
    background: isLight ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.04)",
    color: pageText,
    outline: "none",
  } as const;

  const tagText = {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: subtleText,
  };

  const selectedVariantMeta = optionValues.find((option) => option.value === selectedOption);

  const effectivePrice =
    typeof selectedVariantMeta?.price === "number" && selectedVariantMeta.price > 0
      ? selectedVariantMeta.price
      : product.price;

  const effectiveOriginalPrice =
    typeof selectedVariantMeta?.comparePrice === "number" &&
    selectedVariantMeta.comparePrice > effectivePrice
      ? selectedVariantMeta.comparePrice
      : typeof anyProduct?.originalPrice === "number" && anyProduct.originalPrice > effectivePrice
      ? anyProduct.originalPrice
      : typeof anyProduct?.compare_price === "number" && anyProduct.compare_price > effectivePrice
      ? anyProduct.compare_price
      : undefined;

  const normalizedDiscountPercent =
    typeof effectiveOriginalPrice === "number" && effectiveOriginalPrice > effectivePrice
      ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
      : typeof anyProduct?.discountPercent === "number" && anyProduct.discountPercent > 0
      ? anyProduct.discountPercent
      : 0;

  const variantStockQty =
    typeof selectedVariantMeta?.stockQty === "number" ? selectedVariantMeta.stockQty : null;

  const normalizedInStock = hasVariants
    ? optionValues.some(
        (option) =>
          option.inStock !== false &&
          (option.stockQty == null || Number(option.stockQty) > 0)
      )
    : typeof anyProduct?.inStock === "boolean"
    ? anyProduct.inStock
    : typeof anyProduct?.in_stock === "boolean"
    ? anyProduct.in_stock
    : Number(anyProduct?.stock ?? 0) > 0;

  const showOriginal =
    typeof effectiveOriginalPrice === "number" && effectiveOriginalPrice > effectivePrice;

  const showDiscount = normalizedDiscountPercent > 0;

  const selectedVariantOutOfStock =
    hasVariants &&
    (!selectedVariantMeta ||
      selectedVariantMeta.inStock === false ||
      (variantStockQty != null && variantStockQty <= 0));

  const availableQty = hasVariants
    ? variantStockQty
    : typeof product.stock === "number"
    ? product.stock
    : null;

  const quantityAlreadyInCart = cartItems.reduce((sum, item) => {
    const sameProduct = String(item.id) === String(product.id);
    const sameVariant =
      (item.selectedVariantValue ?? null) === (hasVariants ? selectedOption : null);
    return sameProduct && sameVariant ? sum + item.quantity : sum;
  }, 0);

  const remainingQty =
    typeof availableQty === "number" ? Math.max(availableQty - quantityAlreadyInCart, 0) : null;

  const isEntireProductOutOfStock = !normalizedInStock;
  const isCartLimitReached = typeof remainingQty === "number" ? remainingQty <= 0 : false;

  const stockMessage = isEntireProductOutOfStock
    ? "Out of stock"
    : selectedVariantOutOfStock && selectedOption
    ? `${selectedOption} is out of stock`
    : isCartLimitReached
    ? "All available stock is already in your cart"
    : hasVariants &&
      selectedOption &&
      typeof remainingQty === "number" &&
      remainingQty > 0 &&
      remainingQty <= 5
    ? `Only ${remainingQty} left in ${selectedOption}`
    : "";

  const maxAllowedQty =
    typeof remainingQty === "number" && remainingQty > 0 ? remainingQty : null;

  const isAtMaxQty = typeof maxAllowedQty === "number" ? quantity >= maxAllowedQty : false;

  const canAddToCart = normalizedInStock && (!hasVariants || Boolean(selectedOption));
  const finalCanAddToCart =
    canAddToCart && !selectedVariantOutOfStock && !isCartLimitReached;

  const ratingDisplay = averageRating > 0 ? averageRating.toFixed(1) : "New";
  const reviewCountDisplay =
    reviewCount > 0 ? `based on ${reviewCount} ratings` : "No ratings yet";

  const canSubmitReview =
    isAuthenticated &&
    !!siteId &&
    !!eligibleOrderItem &&
    reviewRating >= 1 &&
    reviewRating <= 5 &&
    !reviewSubmitting;

  const handleAddToCart = async () => {
    if (!finalCanAddToCart) return;
    if (typeof maxAllowedQty === "number" && quantity > maxAllowedQty) return;

    const productToAdd: Product = {
      ...product,
      price: effectivePrice,
      compare_price: showOriginal ? effectiveOriginalPrice ?? null : null,
      in_stock: true,
      stock: variantStockQty ?? product.stock,
      selectedVariantValue: hasVariants ? selectedOption : null,
      selectedVariantLabel: hasVariants ? optionLabel : null,
      ...(hasVariants && selectedOption
        ? {
            variant_option: {
              optionType: variantOption?.optionType,
              optionName: variantOption?.optionName || optionLabel,
              optionValues: selectedVariantMeta ? [selectedVariantMeta] : [],
            },
          }
        : {}),
    };

    try {
      await addToCart(productToAdd, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    } catch (error) {
      console.error("Failed to add product to cart", error);
    }
  };

  const handleReviewImageUpload = async (file: File) => {
    if (!file) return;
    if (!siteId) {
      setReviewUploadError("Missing site id for this product.");
      return;
    }

    setReviewUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products/upload-review-image`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to upload review image");
      }

      if (data?.url) {
        setReviewImages((current) => [...current, data.url]);
      }
    } catch (error) {
      console.error("Review image upload failed", error);
      setReviewUploadError(
        error instanceof Error ? error.message : "Failed to upload image"
      );
    }
  };

  const submitReview = async () => {
    if (!isAuthenticated) {
      setReviewMessage("Please log in to submit a review.");
      return;
    }

    if (!siteId) {
      setReviewMessage("Missing site id for this product.");
      return;
    }

    if (!eligibleOrderItem?.id) {
      setReviewMessage("No delivered purchase found for this product.");
      return;
    }

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      setReviewMessage("Please select a rating.");
      return;
    }

    setReviewSubmitting(true);
    setReviewMessage("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products/reviews`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: product.id,
            order_item_id: eligibleOrderItem.id,
            rating: reviewRating,
            review_text: reviewText,
            review_images: reviewImages,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to submit review");
      }

      if (data?.review) {
        setReviews((current) => [data.review, ...current]);
      }
      setAverageRating(Number(data?.average_rating ?? averageRating));
      setReviewCount(Number(data?.review_count ?? reviewCount));
      setReviewRating(0);
      setReviewText("");
      setReviewImages([]);
      setReviewMessage("Review submitted successfully.");
      setEligibleOrderItem(null);
    } catch (error) {
      console.error("Failed to submit review", error);
      setReviewMessage(
        error instanceof Error ? error.message : "Failed to submit review"
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const gallerySlots = Array.from(
    { length: MAX_GALLERY_IMAGES },
    (_, index) => normalizedImages[index] || null
  );

  const pagePadding = isMobile ? "14px 12px 36px" : "18px 16px 44px";
  const mainGridColumns = isMobile
    ? "1fr"
    : isTablet
    ? "minmax(0, 380px) minmax(0, 1fr)"
    : "minmax(0, 470px) minmax(320px, 1fr)";
  const buyGridColumns = isMobile ? "1fr" : "116px minmax(0, 1fr)";
  const reviewGridColumns = isMobile ? "1fr" : "minmax(280px, 360px) minmax(0, 1fr)";
  const supportGridColumns = isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))";

  const resolvedAddToCartText = add_to_cart_label || "Add to cart";
  const resolvedMaxWidth = max_width === "full" ? "100%" : max_width ? `${max_width}px` : "1160px";
  const resolvedImageAspect = image_aspect_ratio || "1 / 1";
  const resolvedImageFit = image_fit || "cover";

  return (
    <section style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", padding: pagePadding }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mainGridColumns,
          gap: isMobile ? "16px" : "20px",
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              ...shellCard,
              borderRadius: isMobile ? "18px" : "22px",
              boxShadow: softShadow,
              padding: isMobile ? "8px" : "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                borderRadius: isMobile ? "14px" : "16px",
                overflow: "hidden",
                background: mediaBg,
                aspectRatio: resolvedImageAspect,
              }}
            >
              {show_discount_badge && showDiscount && (
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    left: "12px",
                    zIndex: 2,
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: isLight ? "rgba(15,23,42,0.82)" : "rgba(255,255,255,0.12)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {normalizedDiscountPercent}% OFF
                </div>
              )}

              {show_stock_badge && !normalizedInStock && (
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    zIndex: 2,
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: isLight ? "rgba(255,255,255,0.94)" : "rgba(15,23,42,0.84)",
                    border: subtleBorder,
                    color: isLight ? "#b91c1c" : "#fecaca",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  Out of stock
                </div>
              )}

              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  loading="eager"
                  style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, objectPosition: "top center", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: mutedText,
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  No image available
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: isMobile ? "6px" : "8px",
            }}
          >
            {gallerySlots.map((image, index) => {
              const isActive = image && selectedImage === image;

              return (
                <button
                  key={`gallery-slot-${index}`}
                  type="button"
                  onClick={() => image && setSelectedImage(image)}
                  disabled={!image}
                  style={{
                    padding: 0,
                    borderRadius: isMobile ? "10px" : "12px",
                    overflow: "hidden",
                    border: isActive ? `1.5px solid ${accentColor}` : subtleBorder,
                    background: image ? panelBg : isLight ? "#f8fafc" : "rgba(255,255,255,0.03)",
                    boxShadow: isActive ? activeRing : "none",
                    cursor: image ? "pointer" : "default",
                    aspectRatio: "1 / 1",
                    opacity: image ? 1 : isLight ? 0.55 : 0.35,
                  }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={`${product.name} view ${index + 1}`}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: isLight
                          ? "linear-gradient(180deg, rgba(241,245,249,0.9) 0%, rgba(248,250,252,0.95) 100%)"
                          : "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.02) 100%)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...shellCard,
              borderRadius: isMobile ? "20px" : "24px",
              boxShadow: panelShadow,
              padding: isMobile ? "16px" : isTablet ? "18px" : "20px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "14px" : "16px",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "grid", gap: "10px", paddingBottom: "14px", borderBottom: subtleBorder }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {show_brand_name && product.brand && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: subtleText,
                    }}
                  >
                    {product.brand}
                  </span>
                )}

                {show_brand_name && product.category && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: mutedText,
                      background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
                      border: subtleBorder,
                      padding: "4px 8px",
                      borderRadius: "999px",
                    }}
                  >
                    {product.category}
                  </span>
                )}

                {show_ratings && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "12px",
                      color: mutedText,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ color: "#f59e0b", letterSpacing: "0.04em" }}>★★★★☆</span>
                    <span>{ratingDisplay}</span>
                    <span style={{ color: subtleText }}>({reviewCountDisplay})</span>
                  </span>
                )}
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: isMobile ? "24px" : "clamp(22px, 2.5vw, 30px)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.04em",
                  color: pageText,
                }}
              >
                {product.name}
              </h1>

              {product.description && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    lineHeight: 1.7,
                    color: mutedText,
                    maxWidth: "56ch",
                    display: "-webkit-box",
                    WebkitLineClamp: isMobile ? 3 : 4,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {product.description}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "14px",
                paddingBottom: "14px",
                borderBottom: subtleBorder,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: subtleText,
                  }}
                >
                  Price
                </span>

                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: isMobile ? "28px" : "30px",
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      color: pageText,
                    }}
                  >
                    ₹{effectivePrice}
                  </span>

                  {show_original_price && showOriginal && (
                    <span style={{ fontSize: "14px", color: subtleText, textDecoration: "line-through" }}>
                      ₹{effectiveOriginalPrice}
                    </span>
                  )}

                  {show_discount_badge && showDiscount && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: isLight ? "#166534" : "#86efac",
                        background: isLight ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.14)",
                        border: isLight
                          ? "1px solid rgba(34,197,94,0.16)"
                          : "1px solid rgba(134,239,172,0.18)",
                        padding: "4px 8px",
                        borderRadius: "999px",
                      }}
                    >
                      Save {normalizedDiscountPercent}%
                    </span>
                  )}
                </div>

                <span style={{ fontSize: "12px", color: mutedText, fontWeight: 500 }}>
                  Inclusive of all taxes
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMobile ? "flex-start" : "flex-end",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? (isLight ? "#b91c1c" : "#f87171")
                        : (isLight ? "#15803d" : "#4ade80"),
                    background:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? (isLight ? "rgba(239,68,68,0.10)" : "rgba(248,113,113,0.15)")
                        : (isLight ? "rgba(34,197,94,0.10)" : "rgba(74,222,128,0.15)"),
                    border:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? (isLight ? "1px solid rgba(239,68,68,0.14)" : "1px solid rgba(248,113,113,0.25)")
                        : (isLight ? "1px solid rgba(34,197,94,0.14)" : "1px solid rgba(74,222,128,0.25)"),
                    padding: "6px 10px",
                    borderRadius: "999px",
                  }}
                >
                  {isEntireProductOutOfStock
                    ? "Out of stock"
                    : selectedVariantOutOfStock && selectedOption
                    ? `${selectedOption} is out of stock`
                    : isCartLimitReached
                    ? "Already in cart"
                    : "In stock"}
                </span>

                <span style={{ fontSize: "12px", color: subtleText, fontWeight: 600 }}>
                  Free delivery on prepaid orders
                </span>
              </div>
            </div>

            {hasVariants && (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  padding: isMobile ? "12px" : "14px",
                  borderRadius: isMobile ? "16px" : "18px",
                  background: softSectionBg,
                  border: subtleBorder,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: pageText }}>
                    Select {optionLabel}
                  </p>
                  {selectedOption && (
                    <span style={{ fontSize: "12px", color: mutedText, fontWeight: 600 }}>
                      Chosen: {selectedOption}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {optionValues.map((option) => {
                    const optionInStock =
                      option.inStock !== false &&
                      (option.stockQty == null || Number(option.stockQty) > 0);
                    const isSelected = selectedOption === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => optionInStock && setSelectedOption(option.value)}
                        disabled={!optionInStock}
                        style={{
                          minWidth: "52px",
                          padding: "9px 13px",
                          borderRadius: "12px",
                          border: isSelected ? `1px solid ${accentColor}` : subtleBorder,
                          background: isSelected
                            ? isLight
                              ? "rgba(37,99,235,0.08)"
                              : "rgba(37,99,235,0.16)"
                            : optionInStock
                            ? elevatedBg
                            : "rgba(148,163,184,0.10)",
                          color: optionInStock ? pageText : subtleText,
                          fontWeight: 700,
                          fontSize: "12px",
                          opacity: optionInStock ? 1 : 0.55,
                          textDecoration: optionInStock ? "none" : "line-through",
                          cursor: optionInStock ? "pointer" : "not-allowed",
                          boxShadow: isSelected ? activeRing : "none",
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        {option.value}
                      </button>
                    );
                  })}
                </div>

                {stockMessage && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color:
                        stockMessage === "Out of stock" ||
                        stockMessage.includes("out of stock") ||
                        stockMessage.includes("already in your cart")
                          ? (isLight ? "#b91c1c" : "#f87171")
                          : (isLight ? "#b45309" : "#fbbf24"),
                      fontWeight: 600,
                    }}
                  >
                    {stockMessage}
                  </p>
                )}

                {!selectedOption && (
                  <p style={{ margin: 0, fontSize: "12px", color: isLight ? "#b45309" : "#fbbf24", fontWeight: 600 }}>
                    Please select {optionLabel.toLowerCase()} before adding to cart.
                  </p>
                )}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: buyGridColumns,
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div style={{ display: "grid", gap: "7px" }}>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: pageText }}>
                  Quantity
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 40px",
                    alignItems: "center",
                    minHeight: "46px",
                    borderRadius: "15px",
                    border: strongerBorder,
                    background: elevatedBg,
                    overflow: "hidden",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    style={{
                      height: "46px",
                      border: "none",
                      borderRight: subtleBorder,
                      background: "transparent",
                      color: mutedText,
                      fontSize: "18px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    −
                  </button>

                  <div style={{ textAlign: "center", fontSize: "14px", fontWeight: 700, color: pageText }}>
                    {quantity}
                  </div>

                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQuantity((current) => {
                        if (typeof maxAllowedQty === "number") {
                          return Math.min(maxAllowedQty, current + 1);
                        }
                        return current + 1;
                      })
                    }
                    disabled={
                      selectedVariantOutOfStock ||
                      isEntireProductOutOfStock ||
                      isCartLimitReached ||
                      isAtMaxQty
                    }
                    style={{
                      height: "46px",
                      border: "none",
                      borderLeft: subtleBorder,
                      background: "transparent",
                      color:
                        selectedVariantOutOfStock ||
                        isEntireProductOutOfStock ||
                        isCartLimitReached ||
                        isAtMaxQty
                          ? subtleText
                          : mutedText,
                      fontSize: "18px",
                      fontWeight: 700,
                      cursor:
                        selectedVariantOutOfStock ||
                        isEntireProductOutOfStock ||
                        isCartLimitReached ||
                        isAtMaxQty
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        selectedVariantOutOfStock ||
                        isEntireProductOutOfStock ||
                        isCartLimitReached ||
                        isAtMaxQty
                          ? 0.5
                          : 1,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "7px" }}>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: subtleText }}>
                  Purchase
                </p>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!finalCanAddToCart}
                  style={{
                    width: "100%",
                    minHeight: "46px",
                    padding: "12px 16px",
                    borderRadius: "15px",
                    border: "none",
                    background: !finalCanAddToCart
                      ? "#94a3b8"
                      : added
                      ? "#16a34a"
                      : activeBtnBg,
                    color: activeBtnTextColor,
                    cursor: finalCanAddToCart ? "pointer" : "not-allowed",
                    fontWeight: 700,
                    fontSize: "14px",
                    letterSpacing: "0.01em",
                    boxShadow: finalCanAddToCart
                      ? added
                        ? "0 12px 24px rgba(22,163,74,0.20)"
                        : isLight
                        ? "0 12px 24px rgba(37,99,235,0.20)"
                        : "0 12px 24px rgba(37,99,235,0.24)"
                      : "none",
                  }}
                >
                  {!finalCanAddToCart
                    ? isEntireProductOutOfStock
                      ? "Out of stock"
                      : selectedVariantOutOfStock
                      ? `${selectedOption || optionLabel} is out of stock`
                      : isCartLimitReached
                      ? "Already added"
                      : `Select ${optionLabel}`
                    : added
                    ? "Added to cart"
                    : resolvedAddToCartText}
                </button>
              </div>
            </div>

            {(show_delivery_info || show_return_policy || show_quality_guarantee) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: supportGridColumns,
                  gap: "10px",
                  paddingTop: "14px",
                  borderTop: subtleBorder,
                }}
              >
                {show_delivery_info && (
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: "14px",
                      background: softSectionBg,
                      border: subtleBorder,
                      textAlign: "left",
                    }}
                  >
                    <p style={{ margin: "0 0 5px", ...tagText }}>Delivery</p>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: pageText }}>
                      {delivery_text || "Fast ship"}
                    </p>
                  </div>
                )}
                {show_return_policy && (
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: "14px",
                      background: softSectionBg,
                      border: subtleBorder,
                      textAlign: "left",
                    }}
                  >
                    <p style={{ margin: "0 0 5px", ...tagText }}>Returns</p>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: pageText }}>
                      {return_policy_text || "Easy return"}
                    </p>
                  </div>
                )}
                {show_quality_guarantee && (
                  <div
                    style={{
                      padding: "12px 10px",
                      borderRadius: "14px",
                      background: softSectionBg,
                      border: subtleBorder,
                      textAlign: "left",
                    }}
                  >
                    <p style={{ margin: "0 0 5px", ...tagText }}>Quality</p>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: pageText }}>
                      {quality_text || "Curated pick"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {show_reviews_section && (
        <div
          style={{
            ...shellCard,
            marginTop: isMobile ? "18px" : "22px",
            borderRadius: isMobile ? "18px" : "22px",
            boxShadow: softShadow,
            padding: isMobile ? "16px" : "20px",
            display: "grid",
            gap: "18px",
          }}
        >
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "flex-end",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: "0 0 5px", ...tagText }}>Ratings & reviews</p>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: pageText,
              }}
            >
              Customer reviews
            </h2>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: mutedText,
              fontWeight: 700,
              fontSize: "13px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#f59e0b", fontSize: "15px" }}>★★★★☆</span>
            <span>{ratingDisplay}</span>
            <span style={{ color: subtleText, fontWeight: 600 }}>{reviewCountDisplay}</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: reviewGridColumns,
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              borderRadius: "18px",
              border: subtleBorder,
              background: reviewCardBg,
              padding: "16px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px", lineHeight: 1.2, color: pageText }}>
                Write a review
              </h3>
              <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: mutedText }}>
                {checkingEligibility
                  ? "Checking your delivered purchases..."
                  : eligibleOrderItem
                  ? "Share your delivered purchase experience."
                  : "No delivered purchase found for this product."}
              </p>
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Your rating
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= reviewRating;

                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      aria-pressed={reviewRating === star}
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "12px",
                        border: reviewRating === star ? `1px solid ${accentColor}` : subtleBorder,
                        background: isLight ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.04)",
                        color: isFilled ? "#f59e0b" : subtleText,
                        fontSize: "16px",
                        cursor: "pointer",
                      }}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Review text
              </p>
              <textarea
                placeholder="Share fit, quality, comfort, delivery experience, and overall satisfaction."
                rows={5}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                style={{
                  ...reviewInputBase,
                  padding: "12px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Review images
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  for (const file of files) {
                    await handleReviewImageUpload(file);
                  }
                  e.currentTarget.value = "";
                }}
                style={{
                  ...reviewInputBase,
                  padding: "10px 12px",
                }}
              />
              {reviewUploadError ? (
                <p style={{ margin: "8px 0 0", color: isLight ? "#dc2626" : "#f87171", fontSize: "12px" }}>
                  {reviewUploadError}
                </p>
              ) : null}

              {reviewImages.length ? (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                  {reviewImages.map((img) => (
                    <img
                      key={img}
                      src={img}
                      alt="review upload"
                      style={{
                        width: "56px",
                        height: "56px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        border: subtleBorder,
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={submitReview}
              disabled={!canSubmitReview}
              style={{
                minHeight: "42px",
                borderRadius: "12px",
                border: "none",
                background: accentColor,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: canSubmitReview ? "pointer" : "not-allowed",
                boxShadow: isLight
                  ? "0 12px 24px rgba(37,99,235,0.20)"
                  : "0 12px 24px rgba(37,99,235,0.24)",
                opacity: canSubmitReview ? 1 : 0.65,
              }}
            >
              {reviewSubmitting ? "Submitting..." : "Submit review"}
            </button>

            {reviewMessage ? (
              <p style={{ margin: 0, fontSize: "12px", color: mutedText }}>{reviewMessage}</p>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {reviews.length === 0 ? (
              <div
                style={{
                  borderRadius: "16px",
                  border: subtleBorder,
                  background: reviewCardBg,
                  padding: "14px",
                  color: mutedText,
                  fontSize: "13px",
                }}
              >
                No reviews yet.
              </div>
            ) : (
              reviews.map((review, index) => (
                <div
                  key={review.id || `${review.customer_name || "customer"}-${index}`}
                  style={{
                    borderRadius: "16px",
                    border: subtleBorder,
                    background: reviewCardBg,
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginBottom: "8px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: pageText,
                          marginBottom: "4px",
                        }}
                      >
                        {review.customer_name || "Customer"}
                      </div>
                      <div style={{ color: "#f59e0b", fontSize: "12px", letterSpacing: "0.04em" }}>
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </div>
                    </div>

                    <span style={{ fontSize: "11px", color: subtleText, fontWeight: 600 }}>
                      {review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: pageText,
                      marginBottom: "6px",
                    }}
                  >
                    Review
                  </div>

                  <p style={{ margin: 0, color: mutedText, fontSize: "13px", lineHeight: 1.68 }}>
                    {review.review_text}
                  </p>

                  {Array.isArray(review.review_images) && review.review_images.length > 0 ? (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                      {review.review_images.map((img) => (
                        <img
                          key={img}
                          src={img}
                          alt="review"
                          style={{
                            width: "64px",
                            height: "64px",
                            objectFit: "cover",
                            borderRadius: "10px",
                            border: subtleBorder,
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </section>
  );
};

export default ProductDetail;