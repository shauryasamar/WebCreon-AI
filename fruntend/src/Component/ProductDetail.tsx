import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useCart, Product } from "../CartContext";

type ProductDetailProps = {
  product?: Product | null;
  selectedProduct?: Product | null;
  theme?: {
    mode?: string;
    primary_bg?: string;
    text_color?: string;
    accent_color?: string;
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

const MAX_GALLERY_IMAGES = 5;

const ProductDetail: React.FC<ProductDetailProps> = ({
  product: propProduct,
  selectedProduct,
  theme,
}) => {
  const { addToCart, products, cartItems } = useCart();
  const { productSlug } = useParams();

  const product =
    propProduct ??
    selectedProduct ??
    (productSlug
      ? products.find((p) => p.slug === productSlug) ??
        products.find((p) => String(p.id) === String(productSlug)) ??
        null
      : null);

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  const isLight = theme?.mode === "light";
  const accentColor = theme?.accent_color || "#2563eb";
  const pageText = isLight ? "#0f172a" : theme?.text_color || "#f8fafc";
  const mutedText = isLight ? "#475569" : "rgba(255,255,255,0.72)";
  const subtleText = isLight ? "#64748b" : "rgba(255,255,255,0.56)";
  const panelBg = isLight
    ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)"
    : "linear-gradient(180deg, rgba(15,23,42,0.90) 0%, rgba(15,23,42,0.78) 100%)";
  const elevatedBg = isLight ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.045)";
  const softSectionBg = isLight
    ? "rgba(248,250,252,0.88)"
    : "rgba(255,255,255,0.035)";
  const mediaBg = isLight
    ? "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)"
    : "linear-gradient(180deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.96) 100%)";
  const subtleBorder = isLight
    ? "1px solid rgba(15,23,42,0.08)"
    : "1px solid rgba(255,255,255,0.10)";
  const strongerBorder = isLight
    ? "1px solid rgba(15,23,42,0.14)"
    : "1px solid rgba(255,255,255,0.14)";
  const softShadow = isLight
    ? "0 12px 32px rgba(15,23,42,0.06)"
    : "0 16px 36px rgba(2,6,23,0.26)";
  const panelShadow = isLight
    ? "0 18px 40px rgba(15,23,42,0.08)"
    : "0 22px 48px rgba(2,6,23,0.30)";
  const activeRing = isLight
    ? "0 0 0 3px rgba(37,99,235,0.12)"
    : "0 0 0 3px rgba(96,165,250,0.18)";
  const reviewCardBg = isLight ? "rgba(248,250,252,0.88)" : "rgba(255,255,255,0.04)";

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

  if (!product) {
    return (
      <section style={{ maxWidth: "1160px", margin: "0 auto", padding: "20px 16px 40px" }}>
        <div
          style={{
            ...shellCard,
            borderRadius: "20px",
            padding: "24px",
            boxShadow: softShadow,
            color: mutedText,
          }}
        >
          Product not found.
        </div>
      </section>
    );
  }

  const resolvedProduct = product;
  const anyProduct = resolvedProduct as any;

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

  const [selectedImage, setSelectedImage] = useState(normalizedImages[0] || "");
  const [selectedOption, setSelectedOption] = useState(firstAvailableVariant);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => setSelectedImage(normalizedImages[0] || ""), [normalizedImages]);
  useEffect(() => setSelectedOption(firstAvailableVariant), [firstAvailableVariant, resolvedProduct.id]);
  useEffect(() => {
    setQuantity(1);
    setAdded(false);
  }, [resolvedProduct.id]);

  const selectedVariantMeta = optionValues.find((option) => option.value === selectedOption);

  const effectivePrice =
    typeof selectedVariantMeta?.price === "number" && selectedVariantMeta.price > 0
      ? selectedVariantMeta.price
      : resolvedProduct.price;

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
    : typeof resolvedProduct.stock === "number"
    ? resolvedProduct.stock
    : null;

  const quantityAlreadyInCart = cartItems.reduce((sum, item) => {
    const sameProduct = String(item.id) === String(resolvedProduct.id);
    const sameVariant = (item.selectedVariantValue ?? null) === (hasVariants ? selectedOption : null);
    return sameProduct && sameVariant ? sum + item.quantity : sum;
  }, 0);

  const remainingQty =
    typeof availableQty === "number" ? Math.max(availableQty - quantityAlreadyInCart, 0) : null;

  const isEntireProductOutOfStock = !normalizedInStock;
  const isCartLimitReached =
    typeof remainingQty === "number" ? remainingQty <= 0 : false;

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

  const isAtMaxQty =
    typeof maxAllowedQty === "number" ? quantity >= maxAllowedQty : false;

  const canAddToCart = normalizedInStock && (!hasVariants || Boolean(selectedOption));
  const finalCanAddToCart =
    canAddToCart && !selectedVariantOutOfStock && !isCartLimitReached;

  const handleAddToCart = async () => {
    if (!finalCanAddToCart) return;
    if (typeof maxAllowedQty === "number" && quantity > maxAllowedQty) return;

    const productToAdd: Product = {
      ...resolvedProduct,
      price: effectivePrice,
      compare_price: showOriginal ? effectiveOriginalPrice ?? null : null,
      in_stock: true,
      stock: variantStockQty ?? resolvedProduct.stock,
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

  const reviews = [
    {
      name: "Aarav",
      rating: "★★★★★",
      title: "Great fit and clean finish",
      body: "Fabric feels premium and the fit is exactly as expected. Good for regular wear and the stitching also looks neat.",
    },
    {
      name: "Neha",
      rating: "★★★★☆",
      title: "Looks good in person",
      body: "The color and overall finish are nice. Delivery was smooth and sizing was mostly accurate. Would buy again.",
    },
    {
      name: "Rohit",
      rating: "★★★★★",
      title: "Value for money",
      body: "Good quality for the price. The material feels comfortable and the product looks better than expected.",
    },
  ];

  const supportItems = [
    { label: "Delivery", value: "Fast ship" },
    { label: "Returns", value: "Easy return" },
    { label: "Quality", value: "Curated pick" },
  ];

  return (
    <section style={{ maxWidth: "1160px", margin: "0 auto", padding: pagePadding }}>
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
              padding: isMobile ? "10px" : "12px",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: isMobile ? "14px" : "16px",
                overflow: "hidden",
                background: mediaBg,
                aspectRatio: isMobile ? "4 / 4.6" : "4 / 4.35",
                minHeight: isMobile ? "280px" : "340px",
                maxHeight: isMobile ? "380px" : "460px",
              }}
            >
              {showDiscount && (
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

              {!normalizedInStock && (
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
                  alt={resolvedProduct.name}
                  loading="eager"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: isMobile ? "6px" : "8px" }}>
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
                      alt={`${resolvedProduct.name} view ${index + 1}`}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
                {resolvedProduct.brand && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: subtleText,
                    }}
                  >
                    {resolvedProduct.brand}
                  </span>
                )}

                {resolvedProduct.category && (
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
                    {resolvedProduct.category}
                  </span>
                )}

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
                  <span>4.8</span>
                  <span style={{ color: subtleText }}>(24 reviews)</span>
                </span>
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
                {resolvedProduct.name}
              </h1>

              {resolvedProduct.description && (
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
                  {resolvedProduct.description}
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

                  {showOriginal && (
                    <span style={{ fontSize: "14px", color: subtleText, textDecoration: "line-through" }}>
                      ₹{effectiveOriginalPrice}
                    </span>
                  )}

                  {showDiscount && (
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
                        ? "#b91c1c"
                        : "#15803d",
                    background:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? "rgba(239,68,68,0.10)"
                        : "rgba(34,197,94,0.10)",
                    border:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? "1px solid rgba(239,68,68,0.14)"
                        : "1px solid rgba(34,197,94,0.14)",
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
                          ? "#b91c1c"
                          : "#b45309",
                      fontWeight: 600,
                    }}
                  >
                    {stockMessage}
                  </p>
                )}

                {!selectedOption && (
                  <p style={{ margin: 0, fontSize: "12px", color: "#b45309", fontWeight: 600 }}>
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
                      : accentColor,
                    color: "#ffffff",
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
                    : "Add to cart"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: supportGridColumns,
                gap: "10px",
                paddingTop: "14px",
                borderTop: subtleBorder,
              }}
            >
              {supportItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "12px 10px",
                    borderRadius: "14px",
                    background: softSectionBg,
                    border: subtleBorder,
                    textAlign: "left",
                  }}
                >
                  <p style={{ margin: "0 0 5px", ...tagText }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: pageText }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
            <span>4.8</span>
            <span style={{ color: subtleText, fontWeight: 600 }}>based on 24 ratings</span>
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
                Dummy review form for now. Submission logic can be wired after review API is added.
              </p>
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Your rating
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "12px",
                      border: subtleBorder,
                      background: isLight ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.04)",
                      color: "#f59e0b",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Review title
              </p>
              <input
                type="text"
                placeholder="Summarize your experience"
                style={{ ...reviewInputBase, height: "42px", padding: "0 12px" }}
              />
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Review
              </p>
              <textarea
                placeholder="Share fit, quality, comfort, delivery experience, and overall satisfaction."
                rows={5}
                style={{
                  ...reviewInputBase,
                  padding: "12px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <button
              type="button"
              style={{
                minHeight: "42px",
                borderRadius: "12px",
                border: "none",
                background: accentColor,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: isLight
                  ? "0 12px 24px rgba(37,99,235,0.20)"
                  : "0 12px 24px rgba(37,99,235,0.24)",
              }}
            >
              Submit review
            </button>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {reviews.map((review, index) => (
              <div
                key={`${review.name}-${index}`}
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
                      {review.name}
                    </div>
                    <div style={{ color: "#f59e0b", fontSize: "12px", letterSpacing: "0.04em" }}>
                      {review.rating}
                    </div>
                  </div>

                  <span style={{ fontSize: "11px", color: subtleText, fontWeight: 600 }}>
                    2 days ago
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
                  {review.title}
                </div>

                <p style={{ margin: 0, color: mutedText, fontSize: "13px", lineHeight: 1.68 }}>
                  {review.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetail;