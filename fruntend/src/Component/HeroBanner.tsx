import React from "react";

type HeroBannerProps = {
  headline: string;
  subheadline?: string;
  primary_cta?: {
    label: string;
    href: string;
  };
  secondary_cta?: {
    label: string;
    href: string;
  };
  background_image?: string;
  background_overlay?: string;
  text_color?: string;
  size?: "sm" | "md" | "lg";
  background_position?: string;
  background_size?: string;
};

export const HeroBanner: React.FC<HeroBannerProps> = ({
  headline,
  subheadline,
  primary_cta,
  secondary_cta,
  background_image,
  background_overlay = "rgba(0, 0, 0, 0.28)",
  text_color,
  size = "md",
  background_position = "center",
  background_size = "cover",
}) => {
  const hasBackgroundImage = Boolean(background_image);

  const sizeStyles = {
    sm: {
      sectionPadding: "24px 20px",
      headlineSize: "1.5rem",
      subheadlineSize: "0.95rem",
    },
    md: {
      sectionPadding: "32px 24px",
      headlineSize: "1.8rem",
      subheadlineSize: "1rem",
    },
    lg: {
      sectionPadding: "48px 32px",
      headlineSize: "2.2rem",
      subheadlineSize: "1.05rem",
    },
  }[size];

  const sectionStyle: React.CSSProperties = hasBackgroundImage
    ? {
        position: "relative",
        overflow: "hidden",
        padding: sizeStyles.sectionPadding,
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: "320px",
        justifyContent: "center",
        backgroundImage: `url(${background_image})`,
        backgroundSize: background_size,
        backgroundPosition: background_position,
        backgroundRepeat: "no-repeat",
      }
    : {
        padding: sizeStyles.sectionPadding,
        borderRadius: "12px",
        background:
          "linear-gradient(135deg, rgba(0, 180, 120, 0.12), rgba(0, 150, 255, 0.08))",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      };

  const resolvedTextColor = text_color || (hasBackgroundImage ? "#ffffff" : undefined);

  return (
    <section style={sectionStyle}>
      {hasBackgroundImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: background_overlay,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={
          hasBackgroundImage
            ? {
                position: "relative",
                zIndex: 1,
              }
            : undefined
        }
      >
        <h1
          style={{
            fontSize: sizeStyles.headlineSize,
            fontWeight: 700,
            color: resolvedTextColor,
          }}
        >
          {headline}
        </h1>

        {subheadline && (
          <p
            style={{
              fontSize: sizeStyles.subheadlineSize,
              opacity: 0.85,
              color: resolvedTextColor,
            }}
          >
            {subheadline}
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          {primary_cta && (
            <a
              href={primary_cta.href}
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                backgroundColor: "#00b478",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {primary_cta.label}
            </a>
          )}

          {secondary_cta && (
            <a
              href={secondary_cta.href}
              style={{
                padding: "10px 18px",
                borderRadius: "999px",
                border: hasBackgroundImage
                  ? "1px solid rgba(255,255,255,0.28)"
                  : "1px solid rgba(0,0,0,0.12)",
                fontSize: "0.95rem",
                fontWeight: 500,
                textDecoration: "none",
                color: resolvedTextColor,
                background: hasBackgroundImage
                  ? "rgba(255,255,255,0.08)"
                  : "transparent",
              }}
            >
              {secondary_cta.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};