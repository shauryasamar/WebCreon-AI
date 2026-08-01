import React, { useMemo, useState, useEffect } from "react";

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

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  sectionLabel = "Payment",
  title = "Payment method",
  paymentMethods = ["COD", "UPI"],
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
  const isDark = themeObject ? themeObject.mode !== "light" : theme === "dark";

  const resolvedAccent =
    accentColor ||
    themeObject?.accent_color ||
    (isDark ? "#4f8cff" : "#2f6df6");

  const resolvedPrimaryBg =
    background_color ||
    themeObject?.primary_bg ||
    (isDark ? "#0f172a" : "#f6f7fb");

  const resolvedText =
    text_color ||
    themeObject?.text_color ||
    (isDark ? "#f8fafc" : "#111827");

  const resolvedPadding = padding ?? (compact ? 16 : 18);
  const resolvedGap = gap ?? 12;
  const resolvedBorderRadius = border_radius ?? 14;
  const resolvedItemRadius = item_radius ?? 12;
  const resolvedFieldRadius = field_radius ?? 8;

  const palette = useMemo(() => {
    if (!isDark) {
      return {
        cardBg: "#ffffff",
        panelBg: panel_color || "#ffffff",
        optionBg: "#ffffff",
        optionSelectedBg: alpha(resolvedAccent, 0.06),
        inputBg: input_color || "#ffffff",
        border: border_color || "#e5e7eb",
        softBorder: soft_border_color || "#edf0f4",
        text: resolvedText,
        textMuted: muted_text_color || "#6b7280",
        textSoft: "#94a3b8",
        placeholder: placeholder_color || "#9ca3af",
        shadow: "0 1px 2px rgba(16,24,40,0.04)",
        selectedRing: `0 0 0 3px ${resolvedAccent}14`,
        inputRing: `0 0 0 3px ${resolvedAccent}22`,
        backButtonBg: "#ffffff",
        backButtonText: resolvedText,
        backButtonBorder: border_color || "#e5e7eb",
        primaryButtonBg: resolvedAccent,
        primaryButtonDisabledBg: "#cbd5e1",
        primaryButtonText: "#ffffff",
        radioBorder: "#cbd5e1",
      };
    }

    return {
      cardBg: background_color || "#111827",
      panelBg: panel_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.06),
      optionBg: mixHex(resolvedPrimaryBg, "#ffffff", 0.035),
      optionSelectedBg: alpha(resolvedAccent, 0.14),
      inputBg: input_color || mixHex(resolvedPrimaryBg, "#000000", 0.08),
      border: border_color || "rgba(148,163,184,0.18)",
      softBorder: soft_border_color || "rgba(148,163,184,0.12)",
      text: resolvedText,
      textMuted: muted_text_color || "#cbd5e1",
      textSoft: "#94a3b8",
      placeholder: placeholder_color || "#64748b",
      shadow: "0 8px 22px rgba(0,0,0,0.16)",
      selectedRing: `0 0 0 3px ${resolvedAccent}22`,
      inputRing: `0 0 0 3px ${resolvedAccent}2e`,
      backButtonBg: mixHex(resolvedPrimaryBg, "#ffffff", 0.05),
      backButtonText: resolvedText,
      backButtonBorder: border_color || "rgba(148,163,184,0.18)",
      primaryButtonBg: resolvedAccent,
      primaryButtonDisabledBg: "rgba(148,163,184,0.28)",
      primaryButtonText: "#ffffff",
      radioBorder: "rgba(148,163,184,0.4)",
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
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: palette.textSoft,
              fontWeight: 700,
            }}
          >
            {sectionLabel}
          </p>

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
            {paymentMethods.map((method) => {
              const isSelected = selectedMethod === method;
              const inputId = `payment-method-${method.toLowerCase()}`;

              return (
                <label
                  key={method}
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
                        onChange={() => handleMethodChange(method)}
                        style={{
                          accentColor: resolvedAccent,
                          width: "16px",
                          height: "16px",
                          margin: 0,
                          flexShrink: 0,
                        }}
                      />

                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "14px",
                          color: palette.text,
                          lineHeight: 1.2,
                        }}
                      >
                        {method}
                      </div>
                    </div>
                  </div>

                  {isSelected && method === "UPI" ? (
                    <div
                      style={{
                        marginTop: "2px",
                        paddingTop: "10px",
                        borderTop: `1px solid ${palette.softBorder}`,
                      }}
                    >
                      <label
                        htmlFor="upi-id"
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: palette.textMuted,
                        }}
                      >
                        UPI ID
                      </label>
                      <input
                        id="upi-id"
                        type="text"
                        value={upiId}
                        onChange={(e) => handleUpiChange(e.target.value)}
                        placeholder="name@upi"
                        style={inputStyle}
                      />
                    </div>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexDirection: isMobile ? "column-reverse" : "row",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              minHeight: "42px",
              borderRadius: "8px",
              border: `1px solid ${palette.backButtonBorder}`,
              background: palette.backButtonBg,
              color: palette.backButtonText,
              padding: "0 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            style={{
              minHeight: "42px",
              minWidth: isMobile ? "100%" : "160px",
              width: isMobile ? "100%" : "auto",
              border: "none",
              borderRadius: "8px",
              background: continueDisabled
                ? palette.primaryButtonDisabledBg
                : palette.primaryButtonBg,
              color: palette.primaryButtonText,
              padding: "0 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: continueDisabled ? "not-allowed" : "pointer",
              opacity: continueDisabled ? 0.8 : 1,
            }}
          >
            Review order
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

          @media (max-width: 767px) {
            select,
            input,
            textarea,
            button {
              font-size: 16px !important;
            }
          }
        `}
      </style>
    </section>
  );
};

export default PaymentMethods;