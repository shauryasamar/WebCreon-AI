import React from "react";

type ThemeInput =
  | "dark"
  | "light"
  | {
      mode?: string;
      accent_color?: string;
    };

type PlaceOrderCtaProps = {
  buttonLabel?: string;
  accentColor?: string;
  onClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
  theme?: ThemeInput;
  text_color?: string;
  border_radius?: number;
  padding?: number;
  max_width?: number;
};

export const PlaceOrderCta: React.FC<PlaceOrderCtaProps> = ({
  buttonLabel = "Place order",
  accentColor,
  onClick,
  disabled = false,
  compact = false,
  theme,
  text_color,
  border_radius,
  padding,
  max_width,
}) => {
  const resolvedMode =
    typeof theme === "string" ? theme : theme?.mode === "light" ? "light" : "dark";

  const resolvedAccent =
    accentColor ||
    (typeof theme === "object" && theme?.accent_color) ||
    (resolvedMode === "dark" ? "#60a5fa" : "#2563eb");

  const resolvedRadius = border_radius ?? 999;
  const resolvedPaddingY = padding ?? (compact ? 14 : 16);
  const resolvedPaddingX = compact ? 18 : 22;

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
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          style={{
            width: "100%",
            minHeight: compact ? "52px" : "56px",
            padding: `${resolvedPaddingY}px ${resolvedPaddingX}px`,
            borderRadius: `${resolvedRadius}px`,
            border: "none",
            background: disabled ? "#94a3b8" : resolvedAccent,
            color: text_color || "#ffffff",
            fontWeight: 800,
            fontSize: compact ? "15px" : "16px",
            letterSpacing: "-0.02em",
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: disabled
              ? "none"
              : "0 14px 34px rgba(0,0,0,0.14), 0 6px 16px rgba(0,0,0,0.10)",
            transition:
              "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
          }}
          onMouseDown={(e) => {
            if (!disabled) e.currentTarget.style.transform = "translateY(1px)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </section>
  );
};

export default PlaceOrderCta;