import React from "react";
import { useParams } from "react-router-dom";
import { useCart, Product } from "../CartContext";

type ProductDetailProps = {
  product?: Product | null;
  selectedProduct?: Product | null;
};

const ProductDetail: React.FC<ProductDetailProps> = ({
  product: propProduct,
  selectedProduct,
}) => {
  const { addToCart, products } = useCart();
  const { slug } = useParams();

  const product =
    propProduct ??
    selectedProduct ??
    (slug
      ? products.find((p) => p.slug === slug) ??
        products.find((p) => String(p.id) === String(slug)) ??
        null
      : null);

  if (!product) {
    return (
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "32px 20px 56px",
        }}
      >
        <div
          style={{
            borderRadius: "24px",
            border: "1px solid rgba(15,23,42,0.08)",
            background: "rgba(255,255,255,0.88)",
            padding: "32px",
            boxShadow: "0 12px 30px rgba(15,23,42,0.05)",
            color: "#475569",
          }}
        >
          Product not found.
        </div>
      </section>
    );
  }

  const showOriginal =
    typeof product.originalPrice === "number" &&
    product.originalPrice > product.price;

  const showDiscount =
    typeof product.discountPercent === "number" &&
    product.discountPercent > 0;

  const sizes = Array.isArray(product.sizes) ? product.sizes : [];

  return (
    <section
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "32px 20px 64px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.08fr) minmax(320px, 0.92fr)",
          gap: "28px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            borderRadius: "28px",
            border: "1px solid rgba(15,23,42,0.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
            boxShadow: "0 16px 40px rgba(15,23,42,0.06)",
            padding: "18px",
          }}
        >
          <div
            style={{
              position: "relative",
              borderRadius: "22px",
              overflow: "hidden",
              background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
              aspectRatio: "4 / 5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showDiscount && (
              <div
                style={{
                  position: "absolute",
                  top: "16px",
                  left: "16px",
                  zIndex: 2,
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "rgba(15,23,42,0.82)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  backdropFilter: "blur(10px)",
                }}
              >
                {product.discountPercent}% off
              </div>
            )}

            {!product.inStock && (
              <div
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  zIndex: 2,
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.16)",
                  color: "#b91c1c",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                Out of stock
              </div>
            )}

            <img
              src={product.image}
              alt={product.name}
              loading="eager"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              {product.brand ? (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#64748b",
                  }}
                >
                  {product.brand}
                </span>
              ) : null}

              {product.category ? (
                <span
                  style={{
                    fontSize: "12px",
                    color: "#475569",
                    background: "rgba(15,23,42,0.05)",
                    border: "1px solid rgba(15,23,42,0.06)",
                    padding: "6px 10px",
                    borderRadius: "999px",
                  }}
                >
                  {product.category}
                </span>
              ) : null}
            </div>

            <h1
              style={{
                margin: "0 0 14px",
                fontSize: "clamp(32px, 4vw, 56px)",
                lineHeight: 0.98,
                letterSpacing: "-0.05em",
                color: "#0f172a",
              }}
            >
              {product.name}
            </h1>

            {product.description ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "16px",
                  lineHeight: 1.75,
                  color: "#475569",
                  maxWidth: "58ch",
                }}
              >
                {product.description}
              </p>
            ) : null}
          </div>

          <div
            style={{
              borderRadius: "24px",
              border: "1px solid rgba(15,23,42,0.08)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
              boxShadow: "0 14px 36px rgba(15,23,42,0.05)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "end",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "36px",
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "#0f172a",
                  }}
                >
                  ₹{product.price}
                </span>

                {showOriginal && (
                  <span
                    style={{
                      fontSize: "17px",
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
                  fontSize: "13px",
                  fontWeight: 700,
                  color: product.inStock ? "#15803d" : "#b91c1c",
                  background: product.inStock
                    ? "rgba(34,197,94,0.10)"
                    : "rgba(239,68,68,0.10)",
                  border: product.inStock
                    ? "1px solid rgba(34,197,94,0.14)"
                    : "1px solid rgba(239,68,68,0.14)",
                  padding: "8px 12px",
                  borderRadius: "999px",
                }}
              >
                {product.inStock ? "In stock" : "Out of stock"}
              </span>
            </div>

            {showDiscount && (
              <div
                style={{
                  fontSize: "14px",
                  color: "#0f766e",
                  fontWeight: 600,
                }}
              >
                You save {product.discountPercent}% on this item.
              </div>
            )}

            {sizes.length > 0 && (
              <div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Available sizes
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  {sizes.map((size) => (
                    <span
                      key={size}
                      style={{
                        minWidth: "44px",
                        padding: "10px 14px",
                        textAlign: "center",
                        borderRadius: "12px",
                        border: "1px solid rgba(15,23,42,0.08)",
                        background: "rgba(248,250,252,0.9)",
                        color: "#0f172a",
                        fontWeight: 600,
                        fontSize: "14px",
                      }}
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <button
                onClick={() => addToCart(product)}
                disabled={!product.inStock}
                style={{
                  width: "100%",
                  padding: "15px 18px",
                  borderRadius: "16px",
                  border: "none",
                  background: product.inStock ? "#2563eb" : "#94a3b8",
                  color: "#ffffff",
                  cursor: product.inStock ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  fontSize: "15px",
                  boxShadow: product.inStock
                    ? "0 14px 28px rgba(37,99,235,0.24)"
                    : "none",
                }}
              >
                {product.inStock ? "Add to Cart" : "Currently Unavailable"}
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "14px",
                    background: "rgba(248,250,252,0.92)",
                    border: "1px solid rgba(15,23,42,0.06)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "11px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#64748b",
                      fontWeight: 700,
                    }}
                  >
                    Delivery
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Fast ship
                  </p>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "14px",
                    background: "rgba(248,250,252,0.92)",
                    border: "1px solid rgba(15,23,42,0.06)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "11px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#64748b",
                      fontWeight: 700,
                    }}
                  >
                    Returns
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Easy return
                  </p>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "14px",
                    background: "rgba(248,250,252,0.92)",
                    border: "1px solid rgba(15,23,42,0.06)",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "11px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#64748b",
                      fontWeight: 700,
                    }}
                  >
                    Quality
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                      Curated pick
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetail;