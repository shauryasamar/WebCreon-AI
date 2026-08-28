import React, { useMemo, useState, useEffect } from "react";
import { isColorDarkHex } from "../context/ThemeContext";

type ThemeInput =
  | "dark"
  | "light"
  | {
      mode?: string;
      primary_bg?: string;
      text_color?: string;
      accent_color?: string;
      festival_theme?: string;
    };

type PaymentData = {
  method: string;
  upiId: string;
};

type PaymentMethodsProps = {
  sectionLabel?: string;
  title?: string;
  paymentMethods?: string[];
  theme?: ThemeInput;
  accentColor?: string;
  compact?: boolean;
  background_color?: string;
  panel_color?: string;
  input_color?: string;
  text_color?: string;
  muted_text_color?: string;
  placeholder_color?: string;
  border_color?: string;
  soft_border_color?: string;
  border_radius?: number;
  item_radius?: number;
  field_radius?: number;
  padding?: number;
  gap?: number;
  max_width?: number;
  paymentData?: PaymentData;
  onPaymentDataChange?: (data: PaymentData) => void;
  onBack?: () => void;
  onContinue?: () => void;
  continueDisabled?: boolean;
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
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
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

const emptyPaymentData: PaymentData = {
  method: "COD",
  upiId: "",
};

const DEFAULT_PAYMENT_METHODS = ["COD", "UPI"];

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  sectionLabel = "Payment",
  title = "Payment method",
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  theme = "dark",
  accentColor,
  compact = false,
  background_color,
  panel_color,
  input_color,
  text_color,
  muted_text_color,
  placeholder_color,
  border_color,
  soft_border_color,
  border_radius,
  item_radius,
  field_radius,
  padding,
  gap,
  max_width,
  paymentData = emptyPaymentData,
  onPaymentDataChange,
  onBack,
  onContinue,
  continueDisabled = false,
}) => {
  const [selectedMethod, setSelectedMethod] = useState(
    paymentData.method || paymentMethods[0] || "COD"
  );
  const [upiId, setUpiId] = useState(paymentData.upiId || "");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setSelectedMethod(paymentData.method || paymentMethods[0] || "COD");
    setUpiId(paymentData.upiId || "");
  }, [paymentData.method, paymentData.upiId, paymentMethods]);

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const themeObject = typeof theme === "object" ? theme : undefined;
  const isDark =
    theme === "dark" ||
    (themeObject?.primary_bg ? isColorDarkHex(themeObject.primary_bg) : false) ||
    (background_color ? isColorDarkHex(background_color) : false) ||
    themeObject?.mode === "dark" ||
    (themeObject?.text_color ? !isColorDarkHex(themeObject.text_color) : false);

  const resolvedAccent =
    accentColor ||
    (themeObject as any)?.payment_accent_color ||
    themeObject?.accent_color ||
    (isDark ? "#4f8cff" : "#2f6df6");

  const resolvedPrimaryBg =
    background_color ||
    (themeObject as any)?.payment_bg ||
    themeObject?.primary_bg ||
    (isDark ? "#0f172a" : "#f6f7fb");

  const resolvedText =
    text_color ||
    (themeObject as any)?.payment_text_color ||
    themeObject?.text_color ||
    (isDark ? "#f8fafc" : "#111827");

  const resolvedPadding = padding ?? (compact ? 16 : 18);
  const resolvedGap = gap ?? 12;
  const resolvedBorderRadius = border_radius ?? 14;
  const resolvedItemRadius = item_radius ?? 12;
  const resolvedFieldRadius = field_radius ?? 8;

  const palette = useMemo(() => {
    if (!isDark) {
      // Light or Warm Festive Light Theme
      const isPureWhiteBg = resolvedPrimaryBg.toLowerCase() === "#ffffff" || resolvedPrimaryBg.toLowerCase() === "#f8fafc" || resolvedPrimaryBg.toLowerCase() === "#f6f7fb";
      const surfaceBg = background_color || (themeObject as any)?.payment_bg || (themeObject as any)?.surface_bg || (themeObject as any)?.card_bg || (themeObject as any)?.secondary_bg || mixHex(resolvedPrimaryBg, "#ffffff", 0.7);
      const cardBgFinal = background_color || (themeObject as any)?.payment_bg || (isPureWhiteBg ? (themeObject as any)?.card_bg || (themeObject as any)?.secondary_bg || "#ffffff" : surfaceBg);
      const panelBgFinal = panel_color || (themeObject as any)?.payment_card_bg || cardBgFinal;
      const optionBgFinal = (themeObject as any)?.payment_card_bg || (isPureWhiteBg ? "#ffffff" : mixHex(cardBgFinal, "#ffffff", 0.3));
      const inputBgFinal = input_color || (isPureWhiteBg ? "#ffffff" : mixHex(cardBgFinal, "#ffffff", 0.5));
      const borderFinal = border_color || (themeObject as any)?.payment_border_color || (isPureWhiteBg ? "#e5e7eb" : mixHex(resolvedText, cardBgFinal, 0.15));

      return {
        cardBg: cardBgFinal,
        panelBg: panelBgFinal,
        optionBg: optionBgFinal,
        optionSelectedBg: alpha(resolvedAccent, 0.08),
        inputBg: inputBgFinal,
        border: borderFinal,
        softBorder: soft_border_color || mixHex(borderFinal, cardBgFinal, 0.5),
        text: resolvedText,
        textMuted: muted_text_color || mixHex(resolvedText, cardBgFinal, 0.4),
        textSoft: mixHex(resolvedText, cardBgFinal, 0.55),
        placeholder: placeholder_color || mixHex(resolvedText, cardBgFinal, 0.55),
        shadow: "0 2px 8px rgba(0,0,0,0.05)",
        selectedRing: `0 0 0 3px ${resolvedAccent}22`,
        inputRing: `0 0 0 3px ${resolvedAccent}22`,
        backButtonBg: inputBgFinal,
        backButtonText: resolvedText,
        backButtonBorder: borderFinal,
        primaryButtonBg: resolvedAccent,
        primaryButtonDisabledBg: mixHex(resolvedAccent, cardBgFinal, 0.3),
        primaryButtonText: "#ffffff",
        radioBorder: borderFinal,
      };
    }

    // Dark or Deep Festive Dark Theme
    const cardBgDark = background_color || (themeObject as any)?.payment_bg || (themeObject as any)?.surface_bg || (themeObject as any)?.card_bg || (themeObject as any)?.secondary_bg || mixHex(resolvedPrimaryBg, "#ffffff", 0.06);
    const panelBgDark = panel_color || (themeObject as any)?.payment_card_bg || mixHex(resolvedPrimaryBg, "#ffffff", 0.07);
    const isPaymentCardDark = isColorDarkHex(panelBgDark) || isColorDarkHex(cardBgDark);
    const optionBgDark = (themeObject as any)?.payment_card_bg || (isPaymentCardDark ? mixHex(resolvedPrimaryBg, "#ffffff", 0.04) : "#f8fafc");
    const inputBgDark = input_color || (isPaymentCardDark ? mixHex(resolvedPrimaryBg, "#ffffff", 0.09) : "#ffffff");
    const borderDark = border_color || (themeObject as any)?.payment_border_color || (isPaymentCardDark ? mixHex(resolvedText, resolvedPrimaryBg, 0.15) : "#e2e8f0");
    const paymentTextFinal = (themeObject as any)?.payment_text_color || (isPaymentCardDark ? resolvedText : "#0f172a");

    return {
      cardBg: cardBgDark,
      panelBg: panelBgDark,
      optionBg: optionBgDark,
      optionSelectedBg: alpha(resolvedAccent, 0.16),
      inputBg: inputBgDark,
      border: borderDark,
      softBorder: soft_border_color || mixHex(borderDark, cardBgDark, 0.5),
      text: paymentTextFinal,
      textMuted: muted_text_color || (isPaymentCardDark ? mixHex(resolvedText, resolvedPrimaryBg, 0.3) : "#475569"),
      textSoft: isPaymentCardDark ? mixHex(resolvedText, resolvedPrimaryBg, 0.45) : "#64748b",
      placeholder: placeholder_color || (isPaymentCardDark ? mixHex(resolvedText, resolvedPrimaryBg, 0.45) : "#94a3b8"),
      shadow: "0 8px 22px rgba(0,0,0,0.25)",
      selectedRing: `0 0 0 3px ${resolvedAccent}2e`,
      inputRing: `0 0 0 3px ${resolvedAccent}2e`,
      backButtonBg: isPaymentCardDark ? mixHex(resolvedPrimaryBg, "#ffffff", 0.07) : "#f1f5f9",
      backButtonText: paymentTextFinal,
      backButtonBorder: borderDark,
      primaryButtonBg: resolvedAccent,
      primaryButtonDisabledBg: "rgba(148,163,184,0.28)",
      primaryButtonText: (themeObject as any)?.place_order_btn_text || "#ffffff",
      radioBorder: borderDark,
    };
  }, [
    background_color,
    border_color,
    input_color,
    isDark,
    muted_text_color,
    panel_color,
    placeholder_color,
    resolvedAccent,
    resolvedPrimaryBg,
    resolvedText,
    soft_border_color,
    themeObject,
  ]);

  const updatePayment = (nextMethod: string, nextUpiId: string) => {
    onPaymentDataChange?.({
      method: nextMethod,
      upiId: nextUpiId,
    });
  };

  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    updatePayment(method, method === "UPI" ? upiId : "");
  };

  const handleUpiChange = (value: string) => {
    setUpiId(value);
    updatePayment(selectedMethod, value);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "42px",
    padding: "10px 12px",
    borderRadius: `${resolvedFieldRadius}px`,
    border: `1px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.text,
    outline: "none",
    boxSizing: "border-box",
    fontSize: "13px",
  };

  return (
    <section
      style={{
        width: "100%",
        maxWidth: max_width ? `${max_width}px` : undefined,
      }}
    >
      <div
        style={{
          width: "100%",
          border: `1px solid ${palette.softBorder}`,
          borderRadius: `${resolvedBorderRadius}px`,
          background: palette.cardBg,
          boxShadow: palette.shadow,
          boxSizing: "border-box",
          padding: isMobile ? "14px" : `${resolvedPadding}px`,
        }}
      >
        <div
          style={{
            marginBottom: "14px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: isMobile ? "20px" : "24px",
              lineHeight: 1.15,
              fontWeight: 700,
              color: palette.text,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: "12px",
              lineHeight: 1.5,
              color: palette.textMuted,
            }}
          >
            Choose how you want to complete payment for this order.
          </p>
        </div>

        <fieldset
          style={{
            margin: 0,
            padding: 0,
            border: "none",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: `${resolvedGap}px`,
            }}
          >
            {(() => {
              const methodsToDisplay =
                paymentMethods && paymentMethods.length > 0 && !paymentMethods.includes("CARD") && paymentMethods.includes("UPI")
                  ? ["UPI", "CARD", "NETBANKING", ...(paymentMethods.includes("COD") ? ["COD"] : [])]
                  : paymentMethods || ["UPI", "CARD", "NETBANKING", "COD"];

              return methodsToDisplay.map((methodKey) => {
                const isSelected = (selectedMethod || "").toUpperCase() === methodKey.toUpperCase();
                const inputId = `payment-method-${methodKey.toLowerCase()}`;
                
                let title = methodKey;
                let subtitle = "";
                let tag = "";

                if (methodKey.toUpperCase() === "UPI") {
                  title = "UPI (Google Pay, PhonePe, Paytm, QR)";
                  subtitle = "Instant payment via any UPI App or QR code";
                  tag = "Fastest";
                } else if (methodKey.toUpperCase() === "CARD" || methodKey.toUpperCase() === "CARDS") {
                  title = "Credit / Debit Card";
                  subtitle = "Visa, Mastercard, RuPay, Maestro";
                } else if (methodKey.toUpperCase() === "NETBANKING" || methodKey.toUpperCase() === "NET_BANKING") {
                  title = "Netbanking";
                  subtitle = "HDFC, SBI, ICICI, Axis & 50+ Indian banks";
                } else if (methodKey.toUpperCase() === "COD" || methodKey.toUpperCase() === "CASH_ON_DELIVERY") {
                  title = "Cash on Delivery (COD)";
                  subtitle = "Pay with cash upon package delivery";
                }

                return (
                  <label
                    key={methodKey}
                    htmlFor={inputId}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: isMobile ? "12px" : "14px 16px",
                      borderRadius: `${resolvedItemRadius}px`,
                      border: `1px solid ${
                        isSelected ? resolvedAccent : palette.border
                      }`,
                      background: isSelected
                        ? palette.optionSelectedBg
                        : palette.optionBg,
                      cursor: "pointer",
                      boxShadow: isSelected ? palette.selectedRing : "none",
                      transition: "all 180ms ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          minWidth: 0,
                        }}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name="payment-method"
                          checked={isSelected}
                          onChange={() => handleMethodChange(methodKey)}
                          style={{
                            accentColor: resolvedAccent,
                            width: "16px",
                            height: "16px",
                            margin: 0,
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontWeight: 700,
                              fontSize: "14px",
                              color: palette.text,
                              lineHeight: 1.2,
                            }}
                          >
                            <span>{title}</span>
                            {tag && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: alpha(resolvedAccent, 0.15),
                                  color: resolvedAccent,
                                }}
                              >
                                {tag}
                              </span>
                            )}
                          </div>
                          {subtitle && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: palette.textMuted,
                                lineHeight: 1.3,
                              }}
                            >
                              {subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              });
            })()}
          </div>
        </fieldset>

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              minHeight: isMobile ? "44px" : "42px",
              height: isMobile ? "44px" : "42px",
              borderRadius: isMobile ? "10px" : "8px",
              border: `1px solid ${palette.backButtonBorder}`,
              background: palette.backButtonBg,
              color: palette.backButtonText,
              padding: isMobile ? "0 14px" : "0 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              width: "auto",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            style={{
              minHeight: isMobile ? "44px" : "42px",
              height: isMobile ? "44px" : "42px",
              minWidth: isMobile ? "0" : "160px",
              flex: isMobile ? 1 : "initial",
              width: isMobile ? "auto" : "auto",
              border: "none",
              borderRadius: isMobile ? "10px" : "8px",
              background: continueDisabled
                ? palette.primaryButtonDisabledBg
                : palette.primaryButtonBg,
              color: palette.primaryButtonText,
              padding: isMobile ? "0 16px" : "0 18px",
              fontSize: isMobile ? "14px" : "13px",
              fontWeight: 700,
              cursor: continueDisabled ? "not-allowed" : "pointer",
              opacity: continueDisabled ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Review order →
          </button>
        </div>
      </div>

      <style>
        {`
          input::placeholder {
            color: ${palette.placeholder};
            opacity: 1;
          }

          input[type="text"]:focus {
            border-color: ${resolvedAccent};
            box-shadow: ${palette.inputRing};
          }
        `}
      </style>
    </section>
  );
};

export default PaymentMethods;