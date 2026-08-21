import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCart } from "../CartContext";
import { API_BASE_URL } from "../config/api";
import { isColorDarkHex } from "../context/ThemeContext";

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
  show_items?: boolean;
  show_gift_card?: boolean;
  review_mode?: boolean;
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
  paymentMethod?: string;
};

type ChargeCode =
  | "shipping_fee"
  | "handling_fee"
  | "packaging_fee"
  | "service_fee"
  | "platform_fee"
  | "small_order_fee"
  | "cod_fee"
  | "gift_wrap"
  | "custom";

type ChargeRule = {
  id: string;
  code: ChargeCode | string;
  label: string;
  enabled: boolean;
  optional: boolean;
  customerSelectable: boolean;
  refundable?: boolean;
  amountType: "fixed" | "percent";
  amountValue: string;
  applyConditionType: "none" | "subtotal_lt" | "subtotal_gte" | "payment_method";
  applyConditionValue: string;
  waiveConditionType: "none" | "subtotal_gte";
  waiveConditionValue: string;
  description?: string;
};

type TaxSettings = {
  enabled: boolean;
  label: string;
  rate: string;
  applyOnShipping: boolean;
};

type CheckoutSettingsResponse = {
  charges: ChargeRule[];
  taxSettings: TaxSettings;
};

type AppliedCharge = ChargeRule & {
  calculatedAmount: number;
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

function getContrastingText(bgHex: string, preferredText?: string): string {
  if (!bgHex || typeof bgHex !== "string") return preferredText || "#0f172a";
  const rgb = hexToRgb(bgHex);
  if (!rgb) return preferredText || "#0f172a";
  const isBgDark = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114) < 160;

  if (preferredText && typeof preferredText === "string" && preferredText.startsWith("#")) {
    const textRgb = hexToRgb(preferredText);
    if (textRgb) {
      const isTextDark = (textRgb.r * 0.299 + textRgb.g * 0.587 + textRgb.b * 0.114) < 160;
      if (isBgDark !== isTextDark) {
        return preferredText;
      }
    }
  }

  return isBgDark ? "#ffffff" : "#0f172a";
}

function toNumber(value?: string | number | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePaymentMethod(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function matchesApplyCondition(
  charge: ChargeRule,
  subtotalAfterDiscount: number,
  paymentMethod: string
) {
  switch (charge.applyConditionType) {
    case "none":
      return true;
    case "subtotal_lt":
      return subtotalAfterDiscount < toNumber(charge.applyConditionValue);
    case "subtotal_gte":
      return subtotalAfterDiscount >= toNumber(charge.applyConditionValue);
    case "payment_method":
      return (
        normalizePaymentMethod(charge.applyConditionValue) ===
        normalizePaymentMethod(paymentMethod)
      );
    default:
      return true;
  }
}

function isChargeWaived(charge: ChargeRule, subtotalAfterDiscount: number) {
  switch (charge.waiveConditionType) {
    case "subtotal_gte":
      return subtotalAfterDiscount >= toNumber(charge.waiveConditionValue);
    case "none":
    default:
      return false;
  }
}

function calculateChargeAmount(charge: ChargeRule, baseAmount: number) {
  const raw = toNumber(charge.amountValue);
  if (charge.amountType === "percent") {
    return Math.max(0, Math.round((baseAmount * raw) / 100));
  }
  return Math.max(0, Math.round(raw));
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
  show_items = true,
  show_gift_card = true,
  review_mode = false,
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
  paymentMethod,
}) => {
  const { cartItems, updateQuantity, removeFromCart, clearCart } = useCart();
  const { siteId, slug } = useParams();

  const [promoCode, setPromoCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [checkoutSettings, setCheckoutSettings] =
    useState<CheckoutSettingsResponse | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [selectedOptionalChargeIds, setSelectedOptionalChargeIds] = useState<
    string[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setWindowWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadCheckoutSettings = async () => {
      try {
        let url = "";

        if (siteId) {
          url = `${API_BASE_URL}/sites/${siteId}/checkout-settings`;
        } else if (slug) {
          url = `${API_BASE_URL}/store/${slug}/checkout-settings`;
        } else {
          return;
        }

        setSettingsLoading(true);

        const response = await fetch(url, {
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to load checkout settings: ${response.status}`);
        }

        const data: CheckoutSettingsResponse = await response.json();
        setCheckoutSettings(data);

        setSelectedOptionalChargeIds((prev) => {
          if (prev.length > 0) return prev;

          return (data.charges || [])
            .filter(
              (charge) =>
                charge.enabled && charge.customerSelectable && charge.optional
            )
            .map((charge) => charge.id);
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Checkout settings load failed", error);
        }
      } finally {
        setSettingsLoading(false);
      }
    };

    loadCheckoutSettings();

    return () => controller.abort();
  }, [siteId, slug]);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isCheckoutSummary = mode === "checkout_summary";

  const shouldShowItems = show_items && !review_mode;
  const shouldShowPromo = show_promo && !review_mode;
  const shouldShowGiftCard = show_gift_card && !review_mode;

  const checkoutPath = slug
    ? `/store/${slug}/checkout`
    : siteId
    ? `/builder/${siteId}/checkout`
    : "/admin/sites";

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
  const fallbackTaxLabel = tax_label || "Tax";
  const subtotalLabel = subtotal_label || "Subtotal";
  const totalLabel = total_label || "Total";
  const footerNote = note || "Final charges will be validated at checkout.";

  const isDark =
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    (background_color ? isColorDarkHex(background_color) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
    theme?.mode === "dark";

  const resolvedAccentColor =
    accent_color ||
    accentColor ||
    (isCheckoutSummary ? (theme as any)?.summary_accent_color : (theme as any)?.cart_accent_color) ||
    theme?.accent_color ||
    "#7c3aed";

  const resolvedPrimaryBg =
    background_color ||
    (isCheckoutSummary ? (theme as any)?.summary_bg : (theme as any)?.cart_bg) ||
    theme?.primary_bg ||
    (isDark ? "#0b1020" : "#f8fafc");

  const resolvedTextColor =
    text_color ||
    (isCheckoutSummary ? (theme as any)?.summary_text_color : (theme as any)?.cart_text_color) ||
    theme?.text_color ||
    (isDark ? "#e5e7eb" : "#0f172a");

  const hasFestiveTint = Boolean(theme?.festival_theme);

  const outerRadius = clamp(border_radius ?? 24, 0, 40);
  const innerRadius = clamp(card_radius ?? 18, 0, 32);
  const resolvedMaxWidth = clamp(
    max_width ?? (isCheckoutSummary ? 1200 : 1240),
    240,
    1400
  );
  const resolvedMinHeight = clamp(min_height ?? 0, 0, 1600);

  const palette = useMemo(() => {
    const pageBg = resolvedPrimaryBg;

    const dynamicShellBorder =
      border_color ||
      (isCheckoutSummary ? (theme as any)?.summary_border_color : (theme as any)?.cart_border_color) ||
      alpha(resolvedTextColor, isDark ? 0.12 : 0.08);

    const dynamicCardBorder =
      border_color ||
      (isCheckoutSummary ? (theme as any)?.summary_border_color : (theme as any)?.cart_border_color) ||
      alpha(resolvedTextColor, isDark ? 0.09 : 0.06);

    if (!isDark) {
      const shellBg =
        panel_color ||
        background_color ||
        (isCheckoutSummary ? (theme as any)?.summary_bg : (theme as any)?.cart_bg) ||
        "#ffffff";
      const panelBg =
        panel_color ||
        background_color ||
        (isCheckoutSummary ? (theme as any)?.summary_bg : (theme as any)?.cart_panel_bg || (theme as any)?.cart_bg) ||
        mixHex(pageBg, "#ffffff", 0.7);
      const cardBg =
        card_color ||
        (isCheckoutSummary ? (theme as any)?.summary_card_bg : (theme as any)?.cart_card_bg) ||
        "#ffffff";

      const cardText = getContrastingText(
        cardBg,
        text_color ||
          (isCheckoutSummary ? (theme as any)?.summary_text_color : (theme as any)?.cart_text_color) ||
          theme?.text_color ||
          "#0f172a"
      );

      return {
        pageBg,
        shellBg,
        shellBorder: dynamicShellBorder,
        headerBg: shellBg,
        panelBg,
        cardBg,
        cardBorder: dynamicCardBorder,
        mutedBg: mixHex(pageBg, "#000000", 0.03),
        softBg: alpha(cardText, 0.04),
        text: cardText,
        textMuted: muted_text_color || mixHex(cardText, cardBg, 0.4),
        textSoft: muted_text_color || mixHex(cardText, cardBg, 0.25),
        danger: "#dc2626",
        successBg: alpha("#22c55e", 0.10),
        successText: "#166534",
        inputBg: cardBg,
        quantityBg: mixHex(pageBg, "#000000", 0.02),
        shadow: alpha(cardText, 0.06) ? `0 8px 20px ${alpha("#0f172a", 0.06)}` : "none",
        cardShadow: `0 4px 14px ${alpha("#0f172a", 0.04)}`,
        disabledBg: mixHex(cardText, cardBg, 0.5),
      };
    }

    const shellBg =
      panel_color ||
      background_color ||
      (theme as any)?.cart_bg ||
      (hasFestiveTint
        ? mixHex(pageBg, "#ffffff", 0.08)
        : mixHex(pageBg, "#ffffff", 0.04));
    const panelBg =
      panel_color ||
      background_color ||
      (theme as any)?.cart_panel_bg ||
      (theme as any)?.cart_bg ||
      (hasFestiveTint
        ? mixHex(pageBg, "#ffffff", 0.12)
        : mixHex(pageBg, "#ffffff", 0.06));
    const cardBg =
      card_color ||
      (theme as any)?.cart_card_bg ||
      (hasFestiveTint
        ? mixHex(mixHex(pageBg, "#ffffff", 0.14), resolvedAccentColor, 0.06)
        : mixHex(pageBg, "#ffffff", 0.09));
    const mutedBg = mixHex(pageBg, "#000000", 0.12);
    const inputBg = card_color || mixHex(pageBg, "#000000", 0.15);
    const quantityBg = mixHex(pageBg, "#000000", 0.12);

    const cardText = getContrastingText(cardBg, text_color || (theme as any)?.cart_text_color || (theme as any)?.card_text_color || theme?.text_color || "#e5e7eb");

    return {
      pageBg,
      shellBg,
      shellBorder: dynamicShellBorder,
      headerBg: shellBg,
      panelBg,
      cardBg,
      cardBorder: dynamicCardBorder,
      mutedBg,
      softBg: alpha("#ffffff", 0.05),
      text: cardText,
      textMuted:
        muted_text_color || mixHex(cardText, cardBg, 0.45),
      textSoft:
        muted_text_color || mixHex(cardText, cardBg, 0.28),
      danger: "#fda4af",
      successBg: alpha("#22c55e", 0.16),
      successText: "#86efac",
      inputBg,
      quantityBg,
      shadow: "0 10px 24px rgba(0,0,0,0.18)",
      cardShadow: "0 2px 10px rgba(0,0,0,0.10)",
      disabledBg: mixHex(resolvedTextColor, pageBg, 0.5),
    };
  }, [
    isDark,
    resolvedPrimaryBg,
    resolvedTextColor,
    resolvedAccentColor,
    hasFestiveTint,
    background_color,
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

  const subtotalAfterDiscount = Math.max(subtotal - promoDiscount, 0);
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  const enabledCharges = (checkoutSettings?.charges || []).filter(
    (charge) => charge.enabled
  );

  const optionalSelectableCharges = enabledCharges.filter(
    (charge) => charge.customerSelectable && charge.optional
  );

  const autoAppliedCharges = enabledCharges.filter(
    (charge) => !(charge.customerSelectable && charge.optional)
  );

  const selectedOptionalCharges = optionalSelectableCharges.filter((charge) =>
    selectedOptionalChargeIds.includes(charge.id)
  );

  const applicableCharges: AppliedCharge[] = [
    ...autoAppliedCharges,
    ...selectedOptionalCharges,
  ]
    .filter((charge) =>
      matchesApplyCondition(charge, subtotalAfterDiscount, normalizedPaymentMethod)
    )
    .filter((charge) => !isChargeWaived(charge, subtotalAfterDiscount))
    .map((charge) => ({
      ...charge,
      calculatedAmount: calculateChargeAmount(charge, subtotalAfterDiscount),
    }))
    .filter((charge) => charge.calculatedAmount > 0);

  const shippingRule =
    enabledCharges.find((charge) => charge.code === "shipping_fee") || null;

  const shippingCharge =
    applicableCharges.find((charge) => charge.code === "shipping_fee")
      ?.calculatedAmount || 0;

  const nonShippingCharges = applicableCharges.filter(
    (charge) => charge.code !== "shipping_fee"
  );

  const chargesBeforeTax =
    shippingCharge +
    nonShippingCharges.reduce((sum, charge) => sum + charge.calculatedAmount, 0);

  const taxSettings = checkoutSettings?.taxSettings;
  const taxBase = taxSettings?.applyOnShipping
    ? subtotalAfterDiscount + chargesBeforeTax
    : subtotalAfterDiscount;

  const tax =
    taxSettings?.enabled
      ? Math.max(0, Math.round((taxBase * toNumber(taxSettings.rate)) / 100))
      : 0;

  const total = Math.max(subtotalAfterDiscount + chargesBeforeTax + tax, 0);

  const shippingWaived = Boolean(
    shippingRule && isChargeWaived(shippingRule, subtotalAfterDiscount)
  );

  const freeShippingThreshold =
    shippingRule?.waiveConditionType === "subtotal_gte"
      ? toNumber(shippingRule.waiveConditionValue)
      : 0;

  const remainingForFreeShipping =
    freeShippingThreshold > 0
      ? Math.max(freeShippingThreshold - subtotalAfterDiscount, 0)
      : 0;

  const handleApplyPromo = () => {
    setAppliedCode(promoCode.trim());
  };

  const toggleOptionalCharge = (chargeId: string) => {
    setSelectedOptionalChargeIds((prev) =>
      prev.includes(chargeId)
        ? prev.filter((id) => id !== chargeId)
        : [...prev, chargeId]
    );
  };

  const summaryItemGrid = isMobile
    ? "56px minmax(0, 1fr)"
    : "56px minmax(0, 1fr) auto";

  const cartLayoutColumns =
    isMobile || isTablet
      ? "1fr"
      : "minmax(0, 1.5fr) minmax(340px, 0.85fr)";

  const optionalChargePicker =
    optionalSelectableCharges.length > 0 ? (
      <div
        style={{
          borderRadius: `${innerRadius}px`,
          background: palette.cardBg,
          border: `1px solid ${palette.cardBorder}`,
          boxShadow: palette.cardShadow,
          padding: isMobile ? "16px" : "18px",
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
          Optional add-ons
        </h4>

        <div style={{ display: "grid", gap: "10px" }}>
          {optionalSelectableCharges.map((charge) => {
            const checked = selectedOptionalChargeIds.includes(charge.id);
            const previewAmount = calculateChargeAmount(
              charge,
              subtotalAfterDiscount
            );

            return (
              <label
                key={charge.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: `1px solid ${palette.cardBorder}`,
                  background: checked ? palette.softBg : palette.inputBg,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOptionalCharge(charge.id)}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <div
                      style={{
                        color: palette.text,
                        fontSize: "14px",
                        fontWeight: 700,
                        lineHeight: 1.3,
                      }}
                    >
                      {charge.label}
                    </div>
                    {charge.description ? (
                      <div
                        style={{
                          marginTop: "4px",
                          color: palette.textMuted,
                          fontSize: "12px",
                          lineHeight: 1.45,
                        }}
                      >
                        {charge.description}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    color: palette.text,
                    fontSize: "14px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  ₹{previewAmount}
                </div>
              </label>
            );
          })}
        </div>
      </div>
    ) : null;

  const summaryCard = (
    <div
      style={{
        borderRadius: `${innerRadius}px`,
        background: palette.cardBg,
        border: `1px solid ${palette.cardBorder}`,
        boxShadow: palette.cardShadow,
        padding: isMobile ? "16px" : "18px",
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

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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

        {promoDiscount > 0 ? (
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
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            color: palette.textMuted,
            fontSize: "14px",
          }}
        >
          <span>{shippingRule?.label || shippingLabel}</span>
          <span style={{ color: palette.text }}>
            {shippingWaived ? "Free" : shippingCharge > 0 ? `₹${shippingCharge}` : "₹0"}
          </span>
        </div>

        {shippingRule && shippingWaived ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: palette.successBg,
              color: palette.successText,
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {shippingRule.label} waived for this order.
          </div>
        ) : shippingRule && freeShippingThreshold > 0 && remainingForFreeShipping > 0 ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: palette.softBg,
              color: palette.textMuted,
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            Add ₹{remainingForFreeShipping} more to waive {shippingRule.label.toLowerCase()}.
          </div>
        ) : null}

        {nonShippingCharges.map((charge) => (
          <div
            key={charge.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              color: palette.textMuted,
              fontSize: "14px",
            }}
          >
            <span>{charge.label}</span>
            <span style={{ color: palette.text }}>₹{charge.calculatedAmount}</span>
          </div>
        ))}

        {taxSettings?.enabled ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              color: palette.textMuted,
              fontSize: "14px",
            }}
          >
            <span>{taxSettings.label || fallbackTaxLabel}</span>
            <span style={{ color: palette.text }}>₹{tax}</span>
          </div>
        ) : null}

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
              fontSize: isMobile ? "20px" : "22px",
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
        {settingsLoading ? "Updating charges..." : footerNote}
      </p>

      {cartItems.length > 0 ? (
        <Link
          to={checkoutPath}
          style={{
            display: isCheckoutSummary ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            minHeight: "48px",
            borderRadius: "14px",
            background: resolvedAccentColor,
            color: isColorDarkHex(resolvedAccentColor) ? "#ffffff" : "#0f172a",
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
            display: isCheckoutSummary ? "none" : "block",
            width: "100%",
            minHeight: "48px",
            border: "none",
            borderRadius: "14px",
            background: palette.disabledBg,
            color: isColorDarkHex(palette.disabledBg) ? "#ffffff" : "#0f172a",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "not-allowed",
          }}
        >
          {checkoutLabel}
        </button>
      )}
    </div>
  );

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
                {shouldShowItems ? (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {cartItems.map((item, index) => (
                      <div
                        key={`${item.id}-${item.selectedVariantValue || "default"}-${index}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: summaryItemGrid,
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

                          {item.selectedVariantValue ? (
                            <p
                              style={{
                                margin: "0 0 4px",
                                fontSize: "12px",
                                color: palette.textMuted,
                                lineHeight: 1.4,
                                wordBreak: "break-word",
                              }}
                            >
                              {item.selectedVariantLabel || "Option"}:{" "}
                              {item.selectedVariantValue}
                            </p>
                          ) : null}

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
                            margin: isMobile ? "2px 0 0 68px" : 0,
                            fontSize: "14px",
                            fontWeight: 700,
                            color: palette.text,
                            whiteSpace: "nowrap",
                            textAlign: isMobile ? "left" : "right",
                          }}
                        >
                          ₹{item.price * item.quantity}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {shouldShowGiftCard ? optionalChargePicker : null}

                {shouldShowPromo ? (
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
                        gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
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
                          color: isColorDarkHex(resolvedAccentColor) ? "#ffffff" : "#0f172a",
                          padding: "0 16px",
                          fontWeight: 700,
                          cursor: "pointer",
                          width: isMobile ? "100%" : "auto",
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
                ) : null}

                {show_summary ? summaryCard : null}
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
        padding: isMobile ? "16px 12px 32px" : "20px 12px 36px",
        maxWidth: `${resolvedMaxWidth}px`,
        minHeight: resolvedMinHeight > 0 ? `${resolvedMinHeight}px` : undefined,
        margin: "0 auto",
        background: "transparent",
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
            padding: isMobile ? "18px 16px 16px" : "22px 22px 18px",
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
            <h3
              style={{
                margin: 0,
                fontSize: isMobile ? "24px" : "clamp(22px, 2vw, 30px)",
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

          {cartItems.length > 0 ? (
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
                width: isMobile ? "100%" : "auto",
              }}
            >
              {clearText}
            </button>
          ) : null}
        </div>

        <div
          style={{
            padding: isMobile ? "14px" : "18px",
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
                gridTemplateColumns: cartLayoutColumns,
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
                {cartItems.map((item, index) => (
                  <div
                    key={`${item.id}-${item.selectedVariantValue || "default"}-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "72px minmax(0, 1fr)"
                        : "92px minmax(0, 1fr)",
                      gap: isMobile ? "12px" : "14px",
                      alignItems: "start",
                      padding: isMobile ? "12px" : "14px",
                      borderRadius: `${innerRadius}px`,
                      background: palette.cardBg,
                      border: `1px solid ${palette.cardBorder}`,
                      boxShadow: palette.cardShadow,
                    }}
                  >
                    <div
                      style={{
                        width: isMobile ? "72px" : "92px",
                        height: isMobile ? "72px" : "92px",
                        borderRadius: isMobile ? "14px" : "16px",
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
                          flexWrap: isMobile ? "wrap" : "nowrap",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: isMobile ? "15px" : "16px",
                              fontWeight: 700,
                              color: palette.text,
                              lineHeight: 1.35,
                            }}
                          >
                            {item.name}
                          </p>

                          {item.selectedVariantValue ? (
                            <p
                              style={{
                                margin: "0 0 6px",
                                fontSize: "13px",
                                color: palette.textMuted,
                                lineHeight: 1.5,
                              }}
                            >
                              {item.selectedVariantLabel || "Option"}:{" "}
                              {item.selectedVariantValue}
                            </p>
                          ) : null}

                          <p
                            style={{
                              margin: 0,
                              fontSize: "13px",
                              color: palette.textMuted,
                            }}
                          >
                            ₹{item.price} each
                          </p>
                        </div>

                        <div
                          style={{
                            fontSize: isMobile ? "16px" : "18px",
                            fontWeight: 800,
                            color: palette.text,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ₹{item.price * item.quantity}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: isMobile ? "stretch" : "center",
                          gap: "12px",
                          flexWrap: isMobile ? "wrap" : "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: "999px",
                            border: `1px solid ${palette.cardBorder}`,
                            background: palette.quantityBg,
                            overflow: "hidden",
                            minHeight: "42px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity - 1,
                                item.selectedVariantValue ?? null
                              )
                            }
                            style={{
                              width: "40px",
                              height: "42px",
                              border: "none",
                              background: "transparent",
                              color: palette.text,
                              fontSize: "18px",
                              cursor: "pointer",
                            }}
                          >
                            -
                          </button>

                          <div
                            style={{
                              minWidth: "42px",
                              textAlign: "center",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: palette.text,
                            }}
                          >
                            {item.quantity}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity + 1,
                                item.selectedVariantValue ?? null
                              )
                            }
                            style={{
                              width: "40px",
                              height: "42px",
                              border: "none",
                              background: "transparent",
                              color: palette.text,
                              fontSize: "18px",
                              cursor: "pointer",
                            }}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              item.id,
                              item.selectedVariantValue ?? null
                            )
                          }
                          style={{
                            border: "none",
                            background: "transparent",
                            color: palette.danger,
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 700,
                            padding: 0,
                          }}
                        >
                          {removeText}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  minWidth: 0,
                  display: "grid",
                  gap: "14px",
                  position: isMobile || isTablet ? "static" : "sticky",
                  top: isMobile || isTablet ? undefined : "24px",
                }}
              >
                {optionalChargePicker}

                {show_promo ? (
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
                        gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
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
                          color: isColorDarkHex(resolvedAccentColor) ? "#ffffff" : "#0f172a",
                          padding: "0 16px",
                          fontWeight: 700,
                          cursor: "pointer",
                          width: isMobile ? "100%" : "auto",
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
                ) : null}

                {show_summary ? summaryCard : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CartSidebar;