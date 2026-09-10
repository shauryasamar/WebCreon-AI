import React, { useMemo, useState } from "react";
import { useCart } from "../CartContext";
import { getThumbnailUrl } from "../utils/imageOptimizer";

type CheckoutFormProps = {
  title?: string;
  subtitle?: string;
  summary_title?: string;
  place_order_label?: string;
  success_title?: string;
  success_message?: string;
  cod_note?: string;
  shipping_label?: string;
  subtotal_label?: string;
  total_label?: string;
  empty_label?: string;
  shipping_fee?: number;
  theme?: "dark" | "light";
  accentColor?: string;
};

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  title = "Shipping details",
  subtitle = "Enter delivery details to complete your order.",
  summary_title = "Order summary",
  place_order_label = "Place order",
  success_title = "Order placed successfully",
  success_message = "Your demo order has been placed.",
  cod_note = "Cash on delivery demo checkout",
  shipping_label = "Shipping",
  subtotal_label = "Subtotal",
  total_label = "Total",
  empty_label = "No items in cart.",
  shipping_fee = 99,
  theme = "dark",
  accentColor = "#2563eb",
}) => {
  const { cartItems, cartTotal, clearCart } = useCart();

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    pincode: "",
  });

  const [orderPlaced, setOrderPlaced] = useState(false);

  const isDark = theme === "dark";

  const palette = useMemo(
    () => ({
      pageBg: isDark ? "#0b1020" : "#f8fafc",
      shellBg: isDark ? "#0f172a" : "#ffffff",
      cardBg: isDark ? "#111827" : "#ffffff",
      cardAltBg: isDark ? "#162033" : "#f8fafc",
      inputBg: isDark ? "#0b1220" : "#ffffff",
      border: isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.10)",
      softBorder: isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.06)",
      text: isDark ? "#e5e7eb" : "#0f172a",
      textMuted: isDark ? "#94a3b8" : "#64748b",
      textSoft: isDark ? "#cbd5e1" : "#475569",
      placeholder: isDark ? "#64748b" : "#94a3b8",
      successBg: isDark ? "rgba(34,197,94,0.14)" : "rgba(34,197,94,0.10)",
      successBorder: isDark ? "rgba(34,197,94,0.28)" : "rgba(34,197,94,0.20)",
      successText: isDark ? "#86efac" : "#166534",
      summaryBg: isDark
        ? "linear-gradient(180deg, rgba(17,24,39,1) 0%, rgba(15,23,42,1) 100%)"
        : "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
      heroBg: isDark
        ? "linear-gradient(180deg, rgba(30,41,59,0.72) 0%, rgba(15,23,42,0.94) 100%)"
        : "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,1) 100%)",
      shadow: isDark
        ? "0 24px 60px rgba(0,0,0,0.35)"
        : "0 20px 50px rgba(15,23,42,0.08)",
      cardShadow: isDark
        ? "0 12px 28px rgba(0,0,0,0.24)"
        : "0 10px 30px rgba(15,23,42,0.05)",
      disabledBg: isDark ? "#334155" : "#cbd5e1",
      disabledText: "#ffffff",
    }),
    [isDark]
  );

  const shippingFee = cartItems.length > 0 ? shipping_fee : 0;
  const finalTotal = cartTotal + shippingFee;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    if (
      !formData.fullName ||
      !formData.phone ||
      !formData.email ||
      !formData.address ||
      !formData.city ||
      !formData.pincode
    ) {
      alert("Please fill all required fields.");
      return;
    }

    setOrderPlaced(true);
    clearCart();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "48px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: `1px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.text,
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 600,
    color: palette.textSoft,
  };

  return (
    <section
      style={{
        padding: "20px 12px 40px",
        maxWidth: "1240px",
        margin: "0 auto",
        background: palette.pageBg,
      }}
    >
      <div
        style={{
          border: `1px solid ${palette.border}`,
          borderRadius: "28px",
          overflow: "hidden",
          background: palette.shellBg,
          boxShadow: palette.shadow,
        }}
      >
        <div
          style={{
            padding: "24px 22px 20px",
            borderBottom: `1px solid ${palette.softBorder}`,
            background: palette.heroBg,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: palette.textMuted,
              fontWeight: 700,
            }}
          >
            Secure checkout
          </p>

          <h3
            style={{
              margin: 0,
              fontSize: "clamp(24px, 2vw, 32px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: palette.text,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "10px 0 0",
              color: palette.textMuted,
              fontSize: "14px",
            }}
          >
            {subtitle}
          </p>
        </div>

        <div
          style={{
            padding: "18px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.9fr)",
              gap: "18px",
              alignItems: "start",
            }}
          >
            <div
              style={{
                border: `1px solid ${palette.softBorder}`,
                borderRadius: "24px",
                background: palette.cardBg,
                boxShadow: palette.cardShadow,
                padding: "20px",
              }}
            >
              {orderPlaced ? (
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "18px",
                    background: palette.successBg,
                    border: `1px solid ${palette.successBorder}`,
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 8px",
                      color: palette.successText,
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    {success_title}
                  </h4>

                  <p
                    style={{
                      margin: 0,
                      color: palette.text,
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    Thank you, {formData.fullName}. {success_message}
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: "grid",
                    gap: "18px",
                  }}
                >
                  <div>
                    <label htmlFor="fullName" style={labelStyle}>
                      Full name
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={handleChange}
                      style={inputStyle}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <label htmlFor="phone" style={labelStyle}>
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        placeholder="9876543210"
                        value={formData.phone}
                        onChange={handleChange}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label htmlFor="email" style={labelStyle}>
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="address" style={labelStyle}>
                      Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      placeholder="House number, street, area"
                      value={formData.address}
                      onChange={handleChange}
                      rows={4}
                      style={{
                        ...inputStyle,
                        minHeight: "120px",
                        resize: "vertical",
                        paddingTop: "14px",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <label htmlFor="city" style={labelStyle}>
                        City
                      </label>
                      <input
                        id="city"
                        name="city"
                        placeholder="City"
                        value={formData.city}
                        onChange={handleChange}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label htmlFor="pincode" style={labelStyle}>
                        Pincode
                      </label>
                      <input
                        id="pincode"
                        name="pincode"
                        placeholder="400001"
                        value={formData.pincode}
                        onChange={handleChange}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginTop: "6px",
                      paddingTop: "6px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: palette.textMuted,
                      }}
                    >
                      {cod_note}
                    </p>

                    <button
                      type="submit"
                      disabled={cartItems.length === 0}
                      style={{
                        minHeight: "48px",
                        padding: "12px 18px",
                        borderRadius: "14px",
                        border: "none",
                        background:
                          cartItems.length > 0 ? accentColor : palette.disabledBg,
                        color:
                          cartItems.length > 0
                            ? "#ffffff"
                            : palette.disabledText,
                        fontWeight: 700,
                        fontSize: "14px",
                        cursor:
                          cartItems.length > 0 ? "pointer" : "not-allowed",
                        boxShadow:
                          cartItems.length > 0
                            ? "0 14px 28px rgba(0,0,0,0.18)"
                            : "none",
                      }}
                    >
                      {place_order_label}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <aside
              style={{
                border: `1px solid ${palette.softBorder}`,
                borderRadius: "24px",
                background: palette.summaryBg,
                boxShadow: palette.cardShadow,
                padding: "20px",
                position: "sticky",
                top: "90px",
              }}
            >
              <h4
                style={{
                  margin: "0 0 14px",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: palette.text,
                  letterSpacing: "-0.02em",
                }}
              >
                {summary_title}
              </h4>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                {cartItems.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: palette.textMuted,
                      fontSize: "14px",
                    }}
                  >
                    {empty_label}
                  </p>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "56px minmax(0, 1fr) auto",
                        gap: "12px",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: `1px solid ${palette.softBorder}`,
                      }}
                    >
                      <div
                        style={{
                          width: "56px",
                          height: "56px",
                          borderRadius: "14px",
                          overflow: "hidden",
                          background: palette.cardAltBg,
                        }}
                      >
                        <img
                          src={getThumbnailUrl(item.image, 140, 140)}
                          alt={item.name}
                          loading="eager"
                          decoding="async"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "14px",
                            color: palette.text,
                            lineHeight: 1.3,
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: palette.textMuted,
                            marginTop: "4px",
                          }}
                        >
                          Qty {item.quantity}
                        </div>
                      </div>

                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "14px",
                          color: palette.text,
                          whiteSpace: "nowrap",
                        }}
                      >
                        ₹{item.price * item.quantity}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div
                style={{
                  borderTop: `1px solid ${palette.softBorder}`,
                  paddingTop: "14px",
                  display: "grid",
                  gap: "12px",
                  fontSize: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <span style={{ color: palette.textMuted }}>
                    {subtotal_label}
                  </span>
                  <span style={{ color: palette.text }}>₹{cartTotal}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <span style={{ color: palette.textMuted }}>
                    {shipping_label}
                  </span>
                  <span style={{ color: palette.text }}>₹{shippingFee}</span>
                </div>

                <div
                  style={{
                    height: "1px",
                    background: palette.softBorder,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: palette.text,
                    }}
                  >
                    {total_label}
                  </span>
                  <span
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: palette.text,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    ₹{finalTotal}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CheckoutForm;