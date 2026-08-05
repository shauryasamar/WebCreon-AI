import React, { useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useCart, Product } from "../CartContext";

type ProductGridProps = {
  siteId: string;
  products?: Product[];
  title?: string;
  theme?: {
    mode?: string;
    primary_bg?: string;
    text_color?: string;
    accent_color?: string;
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

  const isLight = theme?.mode === "light";
  const accentColor = theme?.accent_color || "#2563eb";
  const pageText = isLight ? "#0f172a" : theme?.text_color || "#f8fafc";
  const mutedText = isLight ? "#6b7280" : "rgba(255,255,255,0.66)";
  const faintText = isLight ? "#94a3b8" : "rgba(255,255,255,0.48)";
  const subtleBorder = isLight
    ? "1px solid rgba(15,23,42,0.07)"
    : "1px solid rgba(255,255,255,0.10)";
  const cardBg = isLight
    ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,250,249,0.96) 100%)"
    : "linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(15,23,42,0.72) 100%)";
  const mediaBg = isLight
    ? "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)"
    : "linear-gradient(180deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.96) 100%)";
  const softShadow = isLight
    ? "0 10px 28px rgba(15,23,42,0.055)"
    : "0 12px 28px rgba(2,6,23,0.28)";

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
          : typeof product.in_stock === "boolean"
          ? product.in_stock
          : Number(product.stock ?? 0) > 0;

      const normalizedDiscountPercent =
        typeof normalizedOriginalPrice === "number" &&
        normalizedOriginalPrice > normalizedDisplayPrice
          ? Math.round(
              ((normalizedOriginalPrice - normalizedDisplayPrice) / normalizedOriginalPrice) * 100
            )
          : typeof product.discountPercent === "number" && product.discountPercent > 0
          ? product.discountPercent
          : 0;

      return {
        ...product,
        normalizedImage:
          product.image ||
          (Array.isArray(product.images) && product.images[0]) ||
          "",
        normalizedOriginalPrice,
        normalizedDisplayPrice,
        normalizedInStock,
        normalizedDiscountPercent,
      };
    });
  }, [products]);

  const handleProductClick = (product: Product & { normalizedInStock?: boolean }) => {
    if (!product.slug || product.normalizedInStock === false) return;

    const targetPath = `${appBase}/products/${product.slug}`;

    if (location.pathname === targetPath) return;

    navigate(targetPath);
  };

  if (!normalizedProducts.length) {
    return (
      <section
        className="product-grid"
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "24px 16px 44px",
        }}
      >
        {title ? (
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: "clamp(22px, 2.4vw, 30px)",
              lineHeight: 1.06,
              letterSpacing: "-0.035em",
              color: pageText,
            }}
          >
            {title}
          </h2>
        ) : null}

        <div
          style={{
            borderRadius: "22px",
            border: subtleBorder,
            background: cardBg,
            padding: "26px",
            textAlign: "center",
            color: mutedText,
            boxShadow: softShadow,
          }}
        >
          No products available.
        </div>
      </section>
    );
  }

  return (
    <section
      className="product-grid"
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding: "24px 16px 44px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "18px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: mutedText,
            }}
          >
            Curated collection
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "clamp(24px, 2.8vw, 34px)",
              lineHeight: 1.04,
              letterSpacing: "-0.045em",
              color: pageText,
            }}
          >
            {title || "Featured products"}
          </h2>
        </div>

        <div
          style={{
            fontSize: "13px",
            color: mutedText,
            fontWeight: 500,
          }}
        >
          {normalizedProducts.length} item{normalizedProducts.length > 1 ? "s" : ""}
        </div>
      </div>

      <div
        className="product-grid__items"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {normalizedProducts.map((product) => {
          const showOriginal =
            typeof product.normalizedOriginalPrice === "number" &&
            product.normalizedOriginalPrice > product.normalizedDisplayPrice;

          const showDiscount =
            product.normalizedDiscountPercent > 0 && product.normalizedInStock;

          const isDisabled = !product.normalizedInStock;
          const ratingValue = Number(product.average_rating ?? 0);
          const ratingText = ratingValue > 0 ? ratingValue.toFixed(1) : "New";
          const reviewCount = Number(product.review_count ?? 0);

          return (
            <article
              key={product.id}
              className="product-card"
              onClick={isDisabled ? undefined : () => handleProductClick(product)}
              onKeyDown={(e) => {
                if (isDisabled) return;
                if ((e.key === "Enter" || e.key === " ") && product.slug) {
                  e.preventDefault();
                  handleProductClick(product);
                }
              }}
              role={isDisabled ? "article" : "button"}
              tabIndex={isDisabled || !product.slug ? -1 : 0}
              aria-disabled={isDisabled}
              style={{
                cursor: isDisabled ? "not-allowed" : product.slug ? "pointer" : "default",
                border: subtleBorder,
                borderRadius: "22px",
                padding: "10px",
                background: isDisabled
                  ? isLight
                    ? "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.96) 100%)"
                    : "linear-gradient(180deg, rgba(30,41,59,0.82) 0%, rgba(15,23,42,0.78) 100%)"
                  : cardBg,
                boxShadow: softShadow,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                minHeight: "100%",
                opacity: isDisabled ? 0.72 : 1,
                transition:
                  "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, opacity 180ms ease, filter 180ms ease",
              }}
              onMouseEnter={(e) => {
                if (isDisabled) return;
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = isLight
                  ? "0 18px 38px rgba(15,23,42,0.09)"
                  : "0 18px 36px rgba(2,6,23,0.34)";
                e.currentTarget.style.borderColor = isLight
                  ? "rgba(15,23,42,0.11)"
                  : "rgba(255,255,255,0.14)";
              }}
              onMouseLeave={(e) => {
                if (isDisabled) return;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = softShadow;
                e.currentTarget.style.borderColor = isLight
                  ? "rgba(15,23,42,0.07)"
                  : "rgba(255,255,255,0.10)";
              }}
              onFocus={(e) => {
                if (isDisabled) return;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${
                  isLight ? "rgba(37,99,235,0.12)" : "rgba(96,165,250,0.18)"
                }`;
                e.currentTarget.style.borderColor = accentColor;
              }}
              onBlur={(e) => {
                if (isDisabled) return;
                e.currentTarget.style.boxShadow = softShadow;
                e.currentTarget.style.borderColor = isLight
                  ? "rgba(15,23,42,0.07)"
                  : "rgba(255,255,255,0.10)";
              }}
            >
              <div
                style={{
                  position: "relative",
                  borderRadius: "16px",
                  overflow: "hidden",
                  background: mediaBg,
                  aspectRatio: "1 / 1.24",
                }}
              >
                {showDiscount && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      left: "10px",
                      zIndex: 2,
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: "linear-gradient(135deg, #166534 0%, #16a34a 100%)",
                      color: "#f0fdf4",
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      border: "1px solid rgba(255,255,255,0.20)",
                      boxShadow: "0 10px 20px rgba(22,101,52,0.24)",
                    }}
                  >
                    {product.normalizedDiscountPercent}% OFF
                  </div>
                )}

                {isDisabled && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(255,255,255,0.16)",
                      zIndex: 1,
                      pointerEvents: "none",
                    }}
                  />
                )}

                {!product.normalizedInStock && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      zIndex: 2,
                      padding: "6px 9px",
                      borderRadius: "999px",
                      background: isLight
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(15,23,42,0.84)",
                      color: isLight ? "#475569" : "rgba(255,255,255,0.82)",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                      border: isLight
                        ? "1px solid rgba(148,163,184,0.24)"
                        : "1px solid rgba(255,255,255,0.10)",
                      boxShadow: "0 8px 16px rgba(15,23,42,0.06)",
                    }}
                  >
                    Sold out
                  </div>
                )}

                {product.normalizedImage ? (
                  <>
                    <img
                      src={product.normalizedImage}
                      alt={product.name}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        transform: "scale(1.01)",
                        filter: isDisabled ? "grayscale(0.55) saturate(0.72)" : "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: isDisabled
                          ? "linear-gradient(180deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.12) 100%)"
                          : "linear-gradient(180deg, rgba(15,23,42,0.00) 0%, rgba(15,23,42,0.02) 100%)",
                        pointerEvents: "none",
                      }}
                    />
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: mutedText,
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    No image
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  padding: "2px 2px 2px",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "10px",
                      color: faintText,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                    }}
                  >
                    {product.brand || product.category || "Collection"}
                  </p>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "10px",
                      color: faintText,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ color: "#d97706" }}>★</span>
                    <span>{ratingText}</span>
                    <span>({reviewCount})</span>
                  </div>
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 700,
                    lineHeight: 1.22,
                    letterSpacing: "-0.02em",
                    color: isDisabled ? mutedText : pageText,
                    minHeight: "34px",
                  }}
                >
                  {product.name}
                </h3>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginTop: "1px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "20px",
                        fontWeight: 800,
                        letterSpacing: "-0.035em",
                        color: isDisabled ? mutedText : pageText,
                      }}
                    >
                      ₹{product.normalizedDisplayPrice}
                    </span>

                    {showOriginal && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: mutedText,
                          textDecoration: "line-through",
                        }}
                      >
                        ₹{product.normalizedOriginalPrice}
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: product.normalizedInStock
                        ? "#166534"
                        : isLight
                        ? "#64748b"
                        : "rgba(255,255,255,0.72)",
                      background: product.normalizedInStock
                        ? "rgba(34,197,94,0.10)"
                        : isLight
                        ? "rgba(148,163,184,0.12)"
                        : "rgba(255,255,255,0.06)",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      border: product.normalizedInStock
                        ? "1px solid rgba(34,197,94,0.13)"
                        : isLight
                        ? "1px solid rgba(148,163,184,0.16)"
                        : "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    {product.normalizedInStock ? "In stock" : "Out of stock"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ProductGrid;