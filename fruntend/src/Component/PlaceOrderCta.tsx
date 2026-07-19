import React, { useMemo } from "react";

type PlaceOrderCtaProps = {
  buttonLabel?: string;
  theme?: "dark" | "light";
  accentColor?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export const PlaceOrderCta: React.FC<PlaceOrderCtaProps> = ({
  buttonLabel = "Place order",
  theme = "dark",
  accentColor = "#16a34a",
  onClick,
  disabled = false,
}) => {
  const isDark = theme === "dark";

  const palette = useMemo(
    () => ({
      pageBg: isDark ? "#0b1020" : "#f8fafc",
      disabledBg: isDark ? "#334155" : "#cbd5e1",
      disabledText: "#ffffff",
      shadow: isDark
        ? "0 20px 40px rgba(0,0,0,0.30)"
        : "0 16px 32px rgba(15,23,42,0.12)",
    }),
    [isDark]
  );

  return (
    <section
      style={{
        padding: "20px 12px 36px",
        maxWidth: "1240px",
        margin: "0 auto",
        background: palette.pageBg,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          width: "250%",
          minHeight: "56px",
          padding: "16px 20px",
          borderRadius: "18px",
          border: "none",
          background: disabled ? palette.disabledBg : accentColor,
          color: disabled ? palette.disabledText : "#ffffff",
          fontWeight: 800,
          fontSize: "16px",
          letterSpacing: "-0.02em",
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: disabled ? "none" : palette.shadow,
          transition: "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
        }}
        onMouseDown={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = "translateY(1px) scale(0.995)";
          }
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
        }}
      >
        {buttonLabel}
      </button>
    </section>
  );
};

export default PlaceOrderCta;