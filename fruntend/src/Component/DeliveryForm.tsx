import React, { useMemo } from "react";

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

type DeliveryFormProps = {
  sectionLabel?: string;
  title?: string;
  theme?: ThemeInput;
  accentColor?: string;
  compact?: boolean;
  background_color?: string;
  input_color?: string;
  text_color?: string;
  muted_text_color?: string;
  soft_text_color?: string;
  placeholder_color?: string;
  border_color?: string;
  soft_border_color?: string;
  border_radius?: number;
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

export const DeliveryForm: React.FC<DeliveryFormProps> = ({
  sectionLabel = "Delivery",
  title = "Delivery details",
  theme = "dark",
  accentColor,
  compact = false,
  background_color,
  input_color,
  text_color,
  muted_text_color,
  soft_text_color,
  placeholder_color,
  border_color,
  soft_border_color,
  border_radius,
  field_radius,
  padding,
  gap,
  max_width,
}) => {
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
  const resolvedGap = gap ?? (compact ? 12 : 14);
  const resolvedBorderRadius = border_radius ?? 20;
  const resolvedFieldRadius = field_radius ?? 12;

  const palette = useMemo(() => {
    if (!isDark) {
      if (hasFestiveTheme) {
        return {
          cardBg: background_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.7),
          inputBg: input_color || "#ffffff",
          border: border_color || alpha(resolvedAccent, 0.2),
          softBorder: soft_border_color || alpha(resolvedAccent, 0.14),
          text: resolvedText,
          textMuted: muted_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.38),
          textSoft: soft_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.24),
          placeholder:
            placeholder_color || mixHex(resolvedText, resolvedPrimaryBg, 0.56),
          shadow: "0 6px 16px rgba(15,23,42,0.05)",
          accentRing: `0 0 0 3px ${resolvedAccent}22`,
        };
      }

      return {
        cardBg: background_color || "#ffffff",
        inputBg: input_color || "#ffffff",
        border: border_color || "rgba(15,23,42,0.08)",
        softBorder: soft_border_color || "rgba(15,23,42,0.06)",
        text: resolvedText,
        textMuted: muted_text_color || "#64748b",
        textSoft: soft_text_color || "#475569",
        placeholder: placeholder_color || "#94a3b8",
        shadow: "0 6px 16px rgba(15,23,42,0.05)",
        accentRing: `0 0 0 3px ${resolvedAccent}22`,
      };
    }

    if (hasFestiveTheme) {
      return {
        cardBg: background_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.08),
        inputBg: input_color || mixHex(resolvedPrimaryBg, "#000000", 0.14),
        border: border_color || alpha(resolvedAccent, 0.22),
        softBorder: soft_border_color || alpha(resolvedAccent, 0.14),
        text: resolvedText,
        textMuted: muted_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.42),
        textSoft: soft_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.28),
        placeholder:
          placeholder_color || mixHex(resolvedText, resolvedPrimaryBg, 0.56),
        shadow: "0 10px 24px rgba(0,0,0,0.18)",
        accentRing: `0 0 0 3px ${resolvedAccent}2e`,
      };
    }

    return {
      cardBg: background_color || "#111827",
      inputBg: input_color || "#0f172a",
      border: border_color || "rgba(148,163,184,0.18)",
      softBorder: soft_border_color || "rgba(148,163,184,0.12)",
      text: resolvedText,
      textMuted: muted_text_color || "#cbd5e1",
      textSoft: soft_text_color || "#94a3b8",
      placeholder: placeholder_color || "#64748b",
      shadow: "0 10px 24px rgba(0,0,0,0.18)",
      accentRing: `0 0 0 3px ${resolvedAccent}2e`,
    };
  }, [
    background_color,
    border_color,
    hasFestiveTheme,
    input_color,
    isDark,
    muted_text_color,
    placeholder_color,
    resolvedAccent,
    resolvedPrimaryBg,
    resolvedText,
    soft_border_color,
    soft_text_color,
  ]);

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: compact ? "42px" : "46px",
    padding: compact ? "10px 12px" : "12px 14px",
    borderRadius: `${resolvedFieldRadius}px`,
    border: `1px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.text,
    outline: "none",
    fontSize: "14px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "6px",
    color: palette.textSoft,
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
          boxSizing: "border-box",
          boxShadow: palette.shadow,
          padding: `${resolvedPadding}px`,
        }}
      >
        <div
          style={{
            marginBottom: `${resolvedGap}px`,
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
              fontSize: compact ? "20px" : "22px",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: palette.text,
            }}
          >
            {title}
          </h3>
        </div>

        <form
          style={{
            display: "grid",
            gap: `${resolvedGap}px`,
          }}
        >
          <div>
            <label htmlFor="delivery-full-name" style={labelStyle}>
              Full name
            </label>
            <input
              id="delivery-full-name"
              name="fullName"
              placeholder="Full name"
              style={fieldStyle}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <label htmlFor="delivery-phone" style={labelStyle}>
                Phone
              </label>
              <input id="delivery-phone" name="phone" placeholder="Phone" style={fieldStyle} />
            </div>

            <div style={{ minWidth: 0 }}>
              <label htmlFor="delivery-email" style={labelStyle}>
                Email
              </label>
              <input id="delivery-email" name="email" placeholder="Email" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label htmlFor="delivery-address" style={labelStyle}>
              Address
            </label>
            <textarea
              id="delivery-address"
              name="address"
              placeholder="House no, street, area"
              rows={compact ? 3 : 4}
              style={{
                ...fieldStyle,
                resize: "vertical",
                minHeight: compact ? "84px" : "100px",
                paddingTop: "12px",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <label htmlFor="delivery-city" style={labelStyle}>
                City
              </label>
              <input id="delivery-city" name="city" placeholder="City" style={fieldStyle} />
            </div>

            <div style={{ minWidth: 0 }}>
              <label htmlFor="delivery-pincode" style={labelStyle}>
                Pincode
              </label>
              <input
                id="delivery-pincode"
                name="pincode"
                placeholder="Pincode"
                style={fieldStyle}
              />
            </div>
          </div>
        </form>
      </div>

      <style>
        {`
          input::placeholder,
          textarea::placeholder {
            color: ${palette.placeholder};
            opacity: 1;
          }

          input:focus,
          textarea:focus {
            border-color: ${resolvedAccent};
            box-shadow: ${palette.accentRing};
          }
        `}
      </style>
    </section>
  );
};

export default DeliveryForm;