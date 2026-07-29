import React, { useMemo, useState } from "react";

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
}) => {
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0] || "COD");
  const [upiId, setUpiId] = useState("");

  const themeObject = typeof theme === "object" ? theme : undefined;
  const isDark = themeObject ? themeObject.mode !== "light" : theme === "dark";
  const hasFestiveTheme = Boolean(themeObject?.festival_theme);

  const resolvedAccent =
    accentColor ||
    themeObject?.accent_color ||
    (isDark ? "#60a5fa" : "#2563eb");

  const resolvedPrimaryBg =
    background_color ||
    themeObject?.primary_bg ||
    (isDark ? "#0f172a" : "#f8fafc");

  const resolvedText =
    text_color ||
    themeObject?.text_color ||
    (isDark ? "#f9fafb" : "#111827");

  const resolvedPadding = padding ?? (compact ? 16 : 18);
  const resolvedGap = gap ?? 10;
  const resolvedBorderRadius = border_radius ?? 20;
  const resolvedItemRadius = item_radius ?? 16;
  const resolvedFieldRadius = field_radius ?? 12;

  const palette = useMemo(() => {
    if (!isDark) {
      if (hasFestiveTheme) {
        return {
          cardBg: background_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.7),
          panelBg: panel_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.84),
          inputBg: input_color || "#ffffff",
          border: border_color || alpha(resolvedAccent, 0.2),
          softBorder: soft_border_color || alpha(resolvedAccent, 0.14),
          text: resolvedText,
          textMuted: muted_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.38),
          placeholder:
            placeholder_color || mixHex(resolvedText, resolvedPrimaryBg, 0.56),
          selectedBg: panel_color || mixHex(resolvedAccent, "#ffffff", 0.9),
          shadow: "0 6px 16px rgba(15,23,42,0.05)",
          selectedRing: `0 0 0 1px ${resolvedAccent}33`,
          inputRing: `0 0 0 3px ${resolvedAccent}22`,
        };
      }

      return {
        cardBg: background_color || "#ffffff",
        panelBg: panel_color || "#f8fafc",
        inputBg: input_color || "#ffffff",
        border: border_color || "rgba(15,23,42,0.08)",
        softBorder: soft_border_color || "rgba(15,23,42,0.06)",
        text: resolvedText,
        textMuted: muted_text_color || "#64748b",
        placeholder: placeholder_color || "#94a3b8",
        selectedBg: `${resolvedAccent}14`,
        shadow: "0 6px 16px rgba(15,23,42,0.05)",
        selectedRing: `0 0 0 1px ${resolvedAccent}33`,
        inputRing: `0 0 0 3px ${resolvedAccent}22`,
      };
    }

    if (hasFestiveTheme) {
      return {
        cardBg: background_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.08),
        panelBg: panel_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.14),
        inputBg: input_color || mixHex(resolvedPrimaryBg, "#000000", 0.14),
        border: border_color || alpha(resolvedAccent, 0.22),
        softBorder: soft_border_color || alpha(resolvedAccent, 0.14),
        text: resolvedText,
        textMuted: muted_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.42),
        placeholder:
          placeholder_color || mixHex(resolvedText, resolvedPrimaryBg, 0.56),
        selectedBg: panel_color || alpha(resolvedAccent, 0.16),
        shadow: "0 10px 24px rgba(0,0,0,0.18)",
        selectedRing: `0 0 0 1px ${resolvedAccent}55`,
        inputRing: `0 0 0 3px ${resolvedAccent}2e`,
      };
    }

    return {
      cardBg: background_color || "#111827",
      panelBg: panel_color || "#1f2937",
      inputBg: input_color || "#0f172a",
      border: border_color || "rgba(148,163,184,0.18)",
      softBorder: soft_border_color || "rgba(148,163,184,0.12)",
      text: resolvedText,
      textMuted: muted_text_color || "#cbd5e1",
      placeholder: placeholder_color || "#64748b",
      selectedBg: panel_color || "#1f2937",
      shadow: "0 10px 24px rgba(0,0,0,0.18)",
      selectedRing: `0 0 0 1px ${resolvedAccent}55`,
      inputRing: `0 0 0 3px ${resolvedAccent}2e`,
    };
  }, [
    background_color,
    border_color,
    hasFestiveTheme,
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: compact ? "42px" : "46px",
    padding: compact ? "10px 12px" : "12px 14px",
    borderRadius: `${resolvedFieldRadius}px`,
    border: `1px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.text,
    outline: "none",
    boxSizing: "border-box",
    fontSize: "14px",
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
          border: `1px solid ${palette.border}`,
          borderRadius: `${resolvedBorderRadius}px`,
          background: palette.cardBg,
          boxShadow: palette.shadow,
          boxSizing: "border-box",
          padding: `${resolvedPadding}px`,
        }}
      >
        <div
          style={{
            marginBottom: compact ? "12px" : "14px",
            paddingBottom: compact ? "10px" : "12px",
            borderBottom: `1px solid ${palette.softBorder}`,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: palette.textMuted,
              fontWeight: 700,
            }}
          >
            {sectionLabel}
          </p>

          <h3
            style={{
              margin: 0,
              fontSize: compact ? "18px" : "20px",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: palette.text,
            }}
          >
            {title}
          </h3>
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
                    padding: compact ? "12px" : "14px",
                    borderRadius: `${resolvedItemRadius}px`,
                    border: `1px solid ${
                      isSelected ? resolvedAccent : palette.border
                    }`,
                    background: isSelected ? palette.selectedBg : palette.panelBg,
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
                        onChange={() => setSelectedMethod(method)}
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

                  {isSelected && method === "UPI" && (
                    <div
                      style={{
                        marginTop: "2px",
                        paddingTop: "10px",
                        borderTop: `1px solid ${palette.softBorder}`,
                      }}
                    >
                      <input
                        id="upi-id"
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="name@upi"
                        style={inputStyle}
                      />
                    </div>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
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