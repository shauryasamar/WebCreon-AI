import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart, Product } from "../CartContext";

type ProductGridProps = {
  siteId: string;
  products?: Product[];
  title?: string;
};

const ProductGrid: React.FC<ProductGridProps> = ({
  siteId,
  products: productsProp,
  title,
}) => {
  const navigate = useNavigate();
  const { products: cartProducts, addToCart } = useCart();
  const [addedProductId, setAddedProductId] = useState<number | null>(null);

  const products = productsProp ?? cartProducts;

  const handleProductClick = (product: Product) => {
    if (!product.slug) return;
    navigate(`/builder/${siteId}/products/${product.slug}`);
  };

  const handleAddToCart = (
    e: React.MouseEvent<HTMLButtonElement>,
    product: Product
  ) => {
    e.stopPropagation();

    if (!product.inStock) return;

    addToCart(product);
    setAddedProductId(product.id);

    window.setTimeout(() => {
      setAddedProductId((current) => (current === product.id ? null : current));
    }, 1400);
  };

  const handleAddToCartKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
  };

  if (!products || products.length === 0) {
    return (
      <section
        className="product-grid"
        style={{
          maxWidth: "1040px",
          margin: "0 auto",
          padding: "18px 12px 36px",
        }}
      >
        {title ? (
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: "clamp(20px, 2.2vw, 28px)",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#0f172a",
            }}
          >
            {title}
          </h2>
        ) : null}

        <div
          style={{
            borderRadius: "18px",
            border: "1px solid rgba(15,23,42,0.08)",
            background: "rgba(255,255,255,0.92)",
            padding: "22px",
            textAlign: "center",
            color: "#64748b",
            boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
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
        maxWidth: "1040px",
        margin: "0 auto",
        padding: "18px 12px 36px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "14px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Curated collection
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "clamp(22px, 2.3vw, 30px)",
              lineHeight: 1.04,
              letterSpacing: "-0.04em",
              color: "#0f172a",
            }}
          >
            {title || "Featured products"}
          </h2>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#64748b",
            fontWeight: 500,
          }}
        >
          {products.length} item{products.length > 1 ? "s" : ""}
        </div>
      </div>

      <div
        className="product-grid__items"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {products.map((product) => {
          const showOriginal =
            typeof product.originalPrice === "number" &&
            product.originalPrice > product.price;

          const showDiscount =
            typeof product.discountPercent === "number" &&
            product.discountPercent > 0;

          const wasAdded = addedProductId === product.id;

          return (
            <article
              key={product.id}
              className="product-card"
              onClick={() => handleProductClick(product)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleProductClick(product);
                }
              }}
              role="button"
              tabIndex={0}
              style={{
                cursor: product.slug ? "pointer" : "default",
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: "16px",
                padding: "8px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
                boxShadow: "0 6px 14px rgba(15,23,42,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                minHeight: "100%",
                transition:
                  "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 12px 24px rgba(15,23,42,0.08)";
                e.currentTarget.style.borderColor = "rgba(37,99,235,0.22)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 6px 14px rgba(15,23,42,0.04)";
                e.currentTarget.style.borderColor = "rgba(15,23,42,0.08)";
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(37,99,235,0.16)";
                e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 14px rgba(15,23,42,0.04)";
                e.currentTarget.style.borderColor = "rgba(15,23,42,0.08)";
              }}
            >
              <div
                style={{
                  position: "relative",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background:
                    "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
                  aspectRatio: "1 / 1",
                }}
              >
                {showDiscount && (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      zIndex: 2,
                      padding: "5px 7px",
                      borderRadius: "999px",
                      background: "rgba(15,23,42,0.78)",
                      color: "#ffffff",
                      fontSize: "9px",
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                    }}
                  >
                    {product.discountPercent}% off
                  </div>
                )}

                {!product.inStock && (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      zIndex: 2,
                      padding: "5px 7px",
                      borderRadius: "999px",
                      background: "rgba(239,68,68,0.12)",
                      color: "#b91c1c",
                      fontSize: "9px",
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                      border: "1px solid rgba(239,68,68,0.16)",
                    }}
                  >
                    Sold out
                  </div>
                )}

                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  padding: "1px 1px 3px",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "9px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                    }}
                  >
                    {product.brand || "Collection"}
                  </p>

                  {product.category ? (
                    <span
                      style={{
                        fontSize: "9px",
                        color: "#475569",
                        background: "rgba(15,23,42,0.05)",
                        border: "1px solid rgba(15,23,42,0.06)",
                        borderRadius: "999px",
                        padding: "3px 6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.category}
                    </span>
                  ) : null}
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: "-0.02em",
                    color: "#0f172a",
                  }}
                >
                  {product.name}
                </h3>

                <div
                  style={{
                    display: "flex",
                    alignItems: "end",
                    justifyContent: "space-between",
                    gap: "6px",
                    marginTop: "4px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "5px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                        color: "#0f172a",
                      }}
                    >
                      ₹{product.price}
                    </span>

                    {showOriginal && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          textDecoration: "line-through",
                        }}
                      >
                        ₹{product.originalPrice}
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: product.inStock ? "#15803d" : "#b91c1c",
                      background: product.inStock
                        ? "rgba(34,197,94,0.10)"
                        : "rgba(239,68,68,0.10)",
                      padding: "4px 7px",
                      borderRadius: "999px",
                      border: product.inStock
                        ? "1px solid rgba(34,197,94,0.14)"
                        : "1px solid rgba(239,68,68,0.14)",
                    }}
                  >
                    {product.inStock ? "In stock" : "Out of stock"}
                  </span>
                </div>

                <div style={{ marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={(e) => handleAddToCart(e, product)}
                    onKeyDown={handleAddToCartKeyDown}
                    disabled={!product.inStock}
                    style={{
                      width: "100%",
                      minHeight: "34px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "none",
                      background: !product.inStock
                        ? "#cbd5e1"
                        : wasAdded
                        ? "#16a34a"
                        : "#2563eb",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      cursor: product.inStock ? "pointer" : "not-allowed",
                      boxShadow: product.inStock
                        ? wasAdded
                          ? "0 8px 14px rgba(22,163,74,0.16)"
                          : "0 8px 14px rgba(37,99,235,0.16)"
                        : "none",
                      transition: "all 180ms ease",
                    }}
                  >
                    {!product.inStock
                      ? "Unavailable"
                      : wasAdded
                      ? "Added"
                      : "Add to Cart"}
                  </button>
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