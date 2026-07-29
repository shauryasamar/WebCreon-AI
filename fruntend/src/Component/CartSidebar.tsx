import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCart } from "../CartContext";

type CartTheme = {
  name?: string;
  mode?: string;
  primary_bg?: string;
  text_color?: string;
  accent_color?: string;
  festival_theme?: string;
};

type CartSidebarProps = {
  mode?: "cart" | "checkout_summary";
  title?: string;
  empty_title?: string;
  empty_message?: string;
  clear_label?: string;
  remove_label?: string;
  promo_title?: string;
  promo_placeholder?: string;
  promo_button_label?: string;
  summary_title?: string;
  checkout_label?: string;
  shipping_label?: string;
  tax_label?: string;
  subtotal_label?: string;
  total_label?: string;
  note?: string;
  show_promo?: boolean;
  show_summary?: boolean;
  max_width?: number;
  min_height?: number;
  border_radius?: number;
  card_radius?: number;
  background_color?: string;
  panel_color?: string;
  card_color?: string;
  text_color?: string;
  muted_text_color?: string;
  border_color?: string;
  accent_color?: string;
  theme?: CartTheme;
  accentColor?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex?: string) {
  if (!hex) return null;
  const cleaned = hex.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned
      .split("")
      .map((char) => char + char)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return null;
}

function hexToRgb(hex?: string) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;

  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) =>
    clamp(Math.round(value), 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(colorA: string, colorB: string, weight = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  if (!a && !b) return "#000000";
  if (!a) return colorB;
  if (!b) return colorA;

  const w = clamp(weight, 0, 1);

  return rgbToHex(
    a.r + (b.r - a.r) * w,
    a.g + (b.g - a.g) * w,
    a.b + (b.b - a.b) * w
  );
}

function alpha(hex: string, opacity: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${opacity})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(opacity, 0, 1)})`;
}

const CartSidebar: React.FC<CartSidebarProps> = ({
  mode = "cart",
  title,
  empty_title,
  empty_message,
  clear_label,
  remove_label,
  promo_title,
  promo_placeholder,
  promo_button_label,
  summary_title,
  checkout_label,
  shipping_label,
  tax_label,
  subtotal_label,
  total_label,
  note,
  show_promo = true,
  show_summary = true,
  max_width,
  min_height,
  border_radius,
  card_radius,
  background_color,
  panel_color,
  card_color,
  text_color,
  muted_text_color,
  border_color,
  accent_color,
  theme,
  accentColor,
}) => {
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart();
  const { siteId } = useParams();
  const [promoCode, setPromoCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");

  const isCheckoutSummary = mode === "checkout_summary";

  const heading = title || (isCheckoutSummary ? "Order summary" : "Your cart");
  const emptyHeading = empty_title || "Your cart is empty";
  const emptyText = empty_message || "Add a few products to see them here.";
  const clearText = clear_label || "Clear cart";
  const removeText = remove_label || "Remove";
  const promoTitle = promo_title || "Promo code";
  const promoPlaceholder = promo_placeholder || "Enter code";
  const promoButtonLabel = promo_button_label || "Apply";
  const summaryTitle = summary_title || "Order summary";
  const checkoutLabel = checkout_label || "Proceed to checkout";
  const shippingLabel = shipping_label || "Shipping";
  const taxLabel = tax_label || "Estimated tax";
  const subtotalLabel = subtotal_label || "Subtotal";
  const totalLabel = total_label || "Total";
  const footerNote =
    note || "Shipping and taxes are calculated at checkout.";

  const isDark = theme?.mode !== "light";
  const resolvedAccentColor =
    accent_color || accentColor || theme?.accent_color || "#7c3aed";
  const resolvedPrimaryBg =
    background_color || theme?.primary_bg || (isDark ? "#0b1020" : "#f8fafc");
  const resolvedTextColor =
    text_color || theme?.text_color || (isDark ? "#e5e7eb" : "#0f172a");
  const hasFestiveTint = Boolean(theme?.festival_theme);

  const outerRadius = clamp(border_radius ?? 24, 0, 40);
  const innerRadius = clamp(card_radius ?? 18, 0, 32);
  const resolvedMaxWidth = clamp(
    max_width ?? (isCheckoutSummary ? 420 : 1240),
    240,
    1400
  );
  const resolvedMinHeight = clamp(min_height ?? 0, 0, 1600);

  const palette = useMemo(() => {
    if (!isDark) {
      return {
        pageBg: resolvedPrimaryBg,
        shellBg: panel_color || "#ffffff",
        shellBorder: border_color || "rgba(15,23,42,0.08)",
        headerBg: panel_color || "#ffffff",
        panelBg: panel_color || "#f8fafc",
        cardBg: card_color || "#ffffff",
        cardBorder: border_color || "rgba(15,23,42,0.06)",
        mutedBg: panel_color || "#f8fafc",
        softBg: "rgba(15,23,42,0.04)",
        text: resolvedTextColor,
        textMuted: muted_text_color || "#64748b",
        textSoft: muted_text_color || "#475569",
        danger: "#dc2626",
        successBg: "rgba(34,197,94,0.10)",
        successText: "#166534",
        inputBg: card_color || "#ffffff",
        quantityBg: panel_color || "#f8fafc",
        shadow: "0 8px 20px rgba(15,23,42,0.06)",
        cardShadow: "0 4px 14px rgba(15,23,42,0.04)",
        disabledBg: "#cbd5e1",
      };
    }

    const pageBg = resolvedPrimaryBg;
    const shellBg =
      panel_color ||
      (hasFestiveTint ? mixHex(pageBg, "#ffffff", 0.08) : "#111827");
    const panelBg =
      panel_color ||
      (hasFestiveTint ? mixHex(pageBg, "#ffffff", 0.12) : "#111827");
    const cardBg =
      card_color ||
      (hasFestiveTint
        ? mixHex(mixHex(pageBg, "#ffffff", 0.14), resolvedAccentColor, 0.06)
        : "#162033");
    const mutedBg = hasFestiveTint
      ? mixHex(pageBg, "#000000", 0.12)
      : "#0f172a";
    const inputBg = card_color
      ? card_color
      : hasFestiveTint
      ? mixHex(pageBg, "#000000", 0.18)
      : "#0b1220";
    const quantityBg = hasFestiveTint
      ? mixHex(pageBg, "#000000", 0.14)
      : "#0b1220";
    const shellBorder =
      border_color ||
      (hasFestiveTint
        ? alpha(resolvedAccentColor, 0.16)
        : "rgba(148,163,184,0.18)");
    const cardBorder =
      border_color ||
      (hasFestiveTint
        ? alpha(mixHex(resolvedAccentColor, "#ffffff", 0.35), 0.18)
        : "rgba(148,163,184,0.12)");

    return {
      pageBg,
      shellBg,
      shellBorder,
      headerBg: shellBg,
      panelBg,
      cardBg,
      cardBorder,
      mutedBg,
      softBg: hasFestiveTint ? alpha("#ffffff", 0.05) : "rgba(255,255,255,0.04)",
      text: resolvedTextColor,
      textMuted:
        muted_text_color ||
        (hasFestiveTint ? mixHex(resolvedTextColor, pageBg, 0.45) : "#94a3b8"),
      textSoft:
        muted_text_color ||
        (hasFestiveTint ? mixHex(resolvedTextColor, pageBg, 0.28) : "#cbd5e1"),
      danger: "#fda4af",
      successBg: alpha("#22c55e", 0.16),
      successText: "#86efac",
      inputBg,
      quantityBg,
      shadow: "0 10px 24px rgba(0,0,0,0.18)",
      cardShadow: "0 2px 10px rgba(0,0,0,0.10)",
      disabledBg: "#334155",
    };
  }, [
    isDark,
    resolvedPrimaryBg,
    resolvedTextColor,
    resolvedAccentColor,
    hasFestiveTint,
    panel_color,
    card_color,
    border_color,
    muted_text_color,
  ]);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const promoDiscount =
    appliedCode.trim().toLowerCase() === "save10"
      ? Math.round(subtotal * 0.1)
      : 0;

  const shipping = cartItems.length > 0 ? 99 : 0;
  const tax = Math.round((subtotal - promoDiscount) * 0.05);
  const total = Math.max(subtotal - promoDiscount + shipping + tax, 0);

  const handleApplyPromo = () => {
    setAppliedCode(promoCode.trim());
  };

  if (isCheckoutSummary) {
    return (
      <section style={{ width: "100%" }}>
        <div
          style={{
            border: `1px solid ${palette.shellBorder}`,
            background: palette.shellBg,
            borderRadius: `${outerRadius}px`,
            overflow: "hidden",
            boxShadow: palette.shadow,
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: `1px solid ${palette.shellBorder}`,
              background: palette.headerBg,
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: palette.textMuted,
              }}
            >
              Order overview
            </p>

            <h3
              style={{
                margin: 0,
                fontSize: "22px",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: palette.text,
              }}
            >
              {heading}
            </h3>

            <p
              style={{
                margin: "8px 0 0",
                color: palette.textMuted,
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {totalItems} item{totalItems !== 1 ? "s" : ""} in your order
            </p>
          </div>

          <div
            style={{
              padding: "18px",
              display: "grid",
              gap: "14px",
              background: palette.panelBg,
            }}
          >
            {cartItems.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  borderRadius: `${innerRadius}px`,
                  border: `1px solid ${palette.cardBorder}`,
                  background: palette.cardBg,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: palette.text,
                  }}
                >
                  {emptyHeading}
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "14px",
                    color: palette.textMuted,
                    lineHeight: 1.6,
                  }}
                >
                  {emptyText}
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "56px minmax(0, 1fr) auto",
                        gap: "12px",
                        alignItems: "center",
                        padding: "12px",
                        borderRadius: `${innerRadius}px`,
                        background: palette.cardBg,
                        border: `1px solid ${palette.cardBorder}`,
                        boxShadow: palette.cardShadow,
                      }}
                    >
                      <div
                        style={{
                          width: "56px",
                          height: "56px",
                          borderRadius: "12px",
                          overflow: "hidden",
                          background: palette.mutedBg,
                        }}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: palette.text,
                            lineHeight: 1.3,
                          }}
                        >
                          {item.name}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            color: palette.textMuted,
                          }}
                        >
                          Qty {item.quantity}
                        </p>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: 700,
                          color: palette.text,
                          whiteSpace: "nowrap",
                        }}
                      >
                        ₹{item.price * item.quantity}
                      </p>
                    </div>
                  ))}
                </div>

                {show_promo && (
                  <div
                    style={{
                      borderRadius: `${innerRadius}px`,
                      background: palette.cardBg,
                      border: `1px solid ${palette.cardBorder}`,
                      boxShadow: palette.cardShadow,
                      padding: "16px",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 12px",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: palette.text,
                      }}
                    >
                      {promoTitle}
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder={promoPlaceholder}
                        style={{
                          minHeight: "44px",
                          borderRadius: "12px",
                          border: `1px solid ${palette.cardBorder}`,
                          background: palette.inputBg,
                          color: palette.text,
                          padding: "0 14px",
                          outline: "none",
                        }}
                      />

                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        style={{
                          minHeight: "44px",
                          border: "none",
                          borderRadius: "12px",
                          background: resolvedAccentColor,
                          color: "#ffffff",
                          padding: "0 16px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {promoButtonLabel}
                      </button>
                    </div>

                    {appliedCode ? (
                      <p
                        style={{
                          margin: "10px 0 0",
                          fontSize: "13px",
                          color: palette.successText,
                          background: palette.successBg,
                          borderRadius: "10px",
                          padding: "10px 12px",
                        }}
                      >
                        Promo code <strong>{appliedCode}</strong> applied.
                      </p>
                    ) : null}
                  </div>
                )}

                {show_summary && (
                  <div
                    style={{
                      borderRadius: `${innerRadius}px`,
                      background: palette.cardBg,
                      border: `1px solid ${palette.cardBorder}`,
                      boxShadow: palette.cardShadow,
                      padding: "18px",
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
                      {summaryTitle}
                    </h4>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          color: palette.textMuted,
                          fontSize: "14px",
                        }}
                      >
                        <span>{subtotalLabel}</span>
                        <span style={{ color: palette.text }}>₹{subtotal}</span>
                      </div>

                      {promoDiscount > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            color: palette.successText,
                            fontSize: "14px",
                          }}
                        >
                          <span>Discount</span>
                          <span>-₹{promoDiscount}</span>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          color: palette.textMuted,
                          fontSize: "14px",
                        }}
                      >
                        <span>{shippingLabel}</span>
                        <span style={{ color: palette.text }}>₹{shipping}</span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          color: palette.textMuted,
                          fontSize: "14px",
                        }}
                      >
                        <span>{taxLabel}</span>
                        <span style={{ color: palette.text }}>₹{tax}</span>
                      </div>

                      <div
                        style={{
                          height: "1px",
                          background: palette.cardBorder,
                          margin: "2px 0",
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
                            fontWeight: 600,
                            color: palette.text,
                          }}
                        >
                          {totalLabel}
                        </span>
                        <span
                          style={{
                            fontSize: "22px",
                            fontWeight: 800,
                            color: palette.text,
                            letterSpacing: "-0.03em",
                          }}
                        >
                          ₹{total}
                        </span>
                      </div>
                    </div>

                    <p
                      style={{
                        margin: "14px 0 0",
                        fontSize: "13px",
                        color: palette.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      {footerNote}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        padding: "20px 12px 36px",
        maxWidth: `${resolvedMaxWidth}px`,
        minHeight: resolvedMinHeight > 0 ? `${resolvedMinHeight}px` : undefined,
        margin: "0 auto",
        background: palette.pageBg,
      }}
    >
      <div
        style={{
          border: `1px solid ${palette.shellBorder}`,
          background: palette.shellBg,
          borderRadius: `${outerRadius}px`,
          overflow: "hidden",
          boxShadow: palette.shadow,
        }}
      >
        <div
          style={{
            padding: "22px 22px 18px",
            borderBottom: `1px solid ${palette.shellBorder}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
            background: palette.headerBg,
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: palette.textMuted,
              }}
            >
              Shopping bag
            </p>

            <h3
              style={{
                margin: 0,
                fontSize: "clamp(22px, 2vw, 30px)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: palette.text,
              }}
            >
              {heading}
            </h3>

            <p
              style={{
                margin: "8px 0 0",
                color: palette.textMuted,
                fontSize: "14px",
              }}
            >
              {totalItems} item{totalItems !== 1 ? "s" : ""} in your cart
            </p>
          </div>

          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              style={{
                border: `1px solid ${palette.shellBorder}`,
                background: palette.softBg,
                color: palette.text,
                borderRadius: "12px",
                cursor: "pointer",
                padding: "10px 14px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {clearText}
            </button>
          )}
        </div>

        <div
          style={{
            padding: "18px",
            background: palette.panelBg,
          }}
        >
          {cartItems.length === 0 ? (
            <div
              style={{
                padding: "56px 18px",
                textAlign: "center",
                borderRadius: `${innerRadius}px`,
                border: `1px solid ${palette.cardBorder}`,
                background: palette.panelBg,
                boxShadow: "none",
              }}
            >
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>🛍️</div>
              <p
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 700,
                  color: palette.text,
                }}
              >
                {emptyHeading}
              </p>
              <p
                style={{
                  margin: "8px auto 0",
                  fontSize: "14px",
                  color: palette.textMuted,
                  maxWidth: "420px",
                  lineHeight: 1.6,
                }}
              >
                {emptyText}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 0.9fr)",
                gap: "18px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "92px minmax(0, 1fr)",
                      gap: "14px",
                      alignItems: "start",
                      padding: "14px",
                      borderRadius: `${innerRadius}px`,
                      background: palette.cardBg,
                      border: `1px solid ${palette.cardBorder}`,
                      boxShadow: palette.cardShadow,
                    }}
                  >
                    <div
                      style={{
                        width: "92px",
                        height: "92px",
                        borderRadius: "16px",
                        overflow: "hidden",
                        background: palette.mutedBg,
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
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
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                          marginBottom: "8px",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              margin: "0 0 4px",
                              fontSize: "11px",
                              color: palette.textMuted,
                              textTransform: "uppercase",
                              letterSpacing: "0.12em",
                              fontWeight: 700,
                            }}
                          >
                            {item.brand || "Collection"}
                          </p>

                          <h4
                            style={{
                              margin: 0,
                              fontSize: "16px",
                              lineHeight: 1.3,
                              color: palette.text,
                              fontWeight: 700,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {item.name}
                          </h4>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: palette.danger,
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            padding: "2px 0",
                          }}
                        >
                          {removeText}
                        </button>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              color: palette.textMuted,
                            }}
                          >
                            Unit price
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "16px",
                              fontWeight: 700,
                              color: palette.text,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            ₹{item.price}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            border: `1px solid ${palette.cardBorder}`,
                            borderRadius: "999px",
                            overflow: "hidden",
                            background: palette.quantityBg,
                            minHeight: "40px",
                          }}
                        >
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            style={{
                              border: "none",
                              background: "transparent",
                              color: palette.text,
                              width: "40px",
                              height: "40px",
                              cursor: "pointer",
                              fontSize: "18px",
                              fontWeight: 500,
                            }}
                          >
                            −
                          </button>

                          <span
                            style={{
                              minWidth: "40px",
                              textAlign: "center",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: palette.text,
                            }}
                          >
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            style={{
                              border: "none",
                              background: "transparent",
                              color: palette.text,
                              width: "40px",
                              height: "40px",
                              cursor: "pointer",
                              fontSize: "18px",
                              fontWeight: 500,
                            }}
                          >
                            +
                          </button>
                        </div>

                        <div
                          style={{
                            marginLeft: "auto",
                            textAlign: "right",
                          }}
                        >
                          <p
                            style={{
                              margin: "0 0 4px",
                              fontSize: "12px",
                              color: palette.textMuted,
                            }}
                          >
                            Line total
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "18px",
                              fontWeight: 800,
                              color: palette.text,
                              letterSpacing: "-0.03em",
                            }}
                          >
                            ₹{item.price * item.quantity}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <aside
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {show_promo && (
                  <div
                    style={{
                      borderRadius: `${innerRadius}px`,
                      background: palette.cardBg,
                      border: `1px solid ${palette.cardBorder}`,
                      boxShadow: palette.cardShadow,
                      padding: "18px",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 12px",
                        fontSize: "16px",
                        fontWeight: 700,
                        color: palette.text,
                      }}
                    >
                      {promoTitle}
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder={promoPlaceholder}
                        style={{
                          minHeight: "44px",
                          borderRadius: "12px",
                          border: `1px solid ${palette.cardBorder}`,
                          background: palette.inputBg,
                          color: palette.text,
                          padding: "0 14px",
                          outline: "none",
                        }}
                      />

                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        style={{
                          minHeight: "44px",
                          border: "none",
                          borderRadius: "12px",
                          background: resolvedAccentColor,
                          color: "#ffffff",
                          padding: "0 16px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {promoButtonLabel}
                      </button>
                    </div>

                    {appliedCode ? (
                      <p
                        style={{
                          margin: "10px 0 0",
                          fontSize: "13px",
                          color: palette.successText,
                          background: palette.successBg,
                          borderRadius: "10px",
                          padding: "10px 12px",
                        }}
                      >
                        Promo code <strong>{appliedCode}</strong> applied.
                      </p>
                    ) : null}
                  </div>
                )}

                {show_summary && (
                  <div
                    style={{
                      borderRadius: `${innerRadius}px`,
                      background: palette.cardBg,
                      border: `1px solid ${palette.cardBorder}`,
                      boxShadow: palette.cardShadow,
                      padding: "18px",
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
                      {summaryTitle}
                    </h4>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          color: palette.textMuted,
                          fontSize: "14px",
                        }}
                      >
                        <span>{subtotalLabel}</span>
                        <span style={{ color: palette.text }}>₹{subtotal}</span>
                      </div>

                      {promoDiscount > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            color: palette.successText,
                            fontSize: "14px",
                          }}
                        >
                          <span>Discount</span>
                          <span>-₹{promoDiscount}</span>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          color: palette.textMuted,
                          fontSize: "14px",
                        }}
                      >
                        <span>{shippingLabel}</span>
                        <span style={{ color: palette.text }}>₹{shipping}</span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          color: palette.textMuted,
                          fontSize: "14px",
                        }}
                      >
                        <span>{taxLabel}</span>
                        <span style={{ color: palette.text }}>₹{tax}</span>
                      </div>

                      <div
                        style={{
                          height: "1px",
                          background: palette.cardBorder,
                          margin: "2px 0",
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
                            fontWeight: 600,
                            color: palette.text,
                          }}
                        >
                          {totalLabel}
                        </span>
                        <span
                          style={{
                            fontSize: "22px",
                            fontWeight: 800,
                            color: palette.text,
                            letterSpacing: "-0.03em",
                          }}
                        >
                          ₹{total}
                        </span>
                      </div>
                    </div>

                    <p
                      style={{
                        margin: "14px 0 16px",
                        fontSize: "13px",
                        color: palette.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      {footerNote}
                    </p>

                    {cartItems.length > 0 ? (
                      <Link
                        to={`/builder/${siteId}/checkout`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          minHeight: "48px",
                          borderRadius: "14px",
                          background: resolvedAccentColor,
                          color: "#ffffff",
                          fontSize: "14px",
                          fontWeight: 700,
                          textDecoration: "none",
                          boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
                        }}
                      >
                        {checkoutLabel}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        style={{
                          width: "100%",
                          minHeight: "48px",
                          border: "none",
                          borderRadius: "14px",
                          background: palette.disabledBg,
                          color: "#ffffff",
                          fontSize: "14px",
                          fontWeight: 700,
                          cursor: "not-allowed",
                        }}
                      >
                        {checkoutLabel}
                      </button>
                    )}
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CartSidebar;