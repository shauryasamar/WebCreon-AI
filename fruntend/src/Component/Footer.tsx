import React, { useState, useEffect } from "react";

type FooterProps = {
  brandName?: string;
  tagline?: string;
  copyrightText?: string;
  links?: Array<{ label: string; href: string }>;
  show_newsletter?: boolean;
  newsletter_title?: string;
  show_social_links?: boolean;
  social_links?: Array<{ platform: string; url: string }>;
  footer_bg?: string;
  background_color?: string;
  footer_text_color?: string;
  text_color?: string;
  footer_muted_color?: string;
  footer_border_color?: string;
  theme?: {
    mode?: string;
    primary_bg?: string;
    secondary_bg?: string;
    text_color?: string;
    accent_color?: string;
    footer_layout?: string;
    footer_bg?: string;
    footer_text_color?: string;
    footer_muted_color?: string;
    footer_border_color?: string;
    footer_max_width?: string | number;
    [key: string]: any;
  };
  [key: string]: any;
};

function isColorDarkHex(colorHex?: string): boolean {
  if (!colorHex || typeof colorHex !== "string") return false;
  if (colorHex.startsWith("rgb")) {
    const match = colorHex.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
    }
  }
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  return false;
}

const Footer: React.FC<FooterProps> = (props) => {
  const {
    brandName = "Website",
    tagline = "Your premium shopping destination.",
    copyrightText,
    links = [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
    show_newsletter = true,
    newsletter_title = "Subscribe to Our Newsletter",
    show_social_links = true,
    social_links = [
      { platform: "Instagram", url: "https://instagram.com" },
      { platform: "Twitter / X", url: "https://x.com" },
      { platform: "Facebook", url: "https://facebook.com" },
    ],
    footer_bg,
    background_color,
    footer_text_color,
    text_color,
    footer_muted_color,
    footer_border_color,
    theme,
  } = props;

  // Responsive state listener
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [subscribed, setSubscribed] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isSmallMobile = windowWidth < 480;

  const layout = theme?.footer_layout || "apple_minimal";

  const isDarkTheme = theme?.mode === "dark";

  const festivalBg = theme?.festival_theme && theme.festival_theme !== "none"
    ? (theme?.footer_bg || theme?.secondary_bg || theme?.primary_bg)
    : undefined;

  const directBg = footer_bg || background_color || theme?.footer_bg;

  const footerBg =
    festivalBg ||
    directBg ||
    theme?.secondary_bg ||
    (isDarkTheme ? "#0f172a" : theme?.primary_bg || "#f8fafc");

  const isFooterDark = isColorDarkHex(footerBg);
  const isLight = !isFooterDark;

  const directTextColor = footer_text_color || text_color || theme?.footer_text_color;
  const textColor =
    directTextColor ||
    (isFooterDark ? "#ffffff" : "#0f172a");

  const isTextColorDark = isColorDarkHex(textColor);

  const mutedText =
    footer_muted_color ||
    theme?.footer_muted_color ||
    (theme as any)?.muted_text_color ||
    (isTextColorDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.68)");

  const borderColor =
    footer_border_color ||
    theme?.footer_border_color ||
    (theme as any)?.border_color ||
    (isFooterDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.10)");

  const accentColor = theme?.accent_color || "#2563eb";

  const inputBg = isFooterDark ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.95)";
  const socialBg = isFooterDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.05)";
  const socialHoverBg = isFooterDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.10)";

  const displayCopyright = copyrightText || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;
  const resolvedMaxWidth = theme?.footer_max_width === "full" ? "100%" : theme?.footer_max_width ? `${theme.footer_max_width}px` : "1200px";

  const footerStyle: React.CSSProperties = {
    padding: isSmallMobile ? "2.25rem 1rem 1.75rem" : isMobile ? "2.75rem 1.25rem 2rem" : "3.5rem 1.5rem",
    marginTop: isMobile ? "2.5rem" : "4rem",
    borderTop: `1px solid ${borderColor}`,
    transition: "all 0.2s ease",
    fontFamily: layout === "luxury_fashion" ? "serif" : "sans-serif",
    width: "100%",
    boxSizing: "border-box",
    overflowX: "hidden",
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmailInput("");
    }, 4000);
  };

  const renderSocials = (alignCenter = false) =>
    show_social_links && social_links.length > 0 ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: isSmallMobile ? "8px" : "10px",
          alignItems: "center",
          justifyContent: alignCenter || isMobile ? (alignCenter ? "center" : "flex-start") : "flex-start",
          width: isMobile ? "100%" : "auto",
        }}
      >
        {social_links.map((s, idx) => (
          <a
            key={idx}
            href={s.url || "#"}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: isSmallMobile ? "11.5px" : "12px",
              fontWeight: 600,
              color: mutedText,
              textDecoration: "none",
              background: socialBg,
              padding: isSmallMobile ? "6px 10px" : "7px 12px",
              borderRadius: "10px",
              border: `1px solid ${borderColor}`,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
              touchAction: "manipulation",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = socialHoverBg;
              e.currentTarget.style.color = textColor;
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = socialBg;
              e.currentTarget.style.color = mutedText;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {s.platform}
          </a>
        ))}
      </div>
    ) : null;

  const renderNewsletter = (fullWidthMobile = true) =>
    show_newsletter ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: isMobile && fullWidthMobile ? "100%" : "100%",
          maxWidth: isMobile ? "100%" : "360px",
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: isSmallMobile ? "13px" : "14px", fontWeight: 700, color: textColor, letterSpacing: "-0.01em" }}>
          {newsletter_title}
        </span>
        {subscribed ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "10px",
              background: isLight ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.2)",
              border: `1px solid ${isLight ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.4)"}`,
              color: isLight ? "#065f46" : "#34d399",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <span>✓</span> Thank you for subscribing!
          </div>
        ) : (
          <form
            onSubmit={handleSubscribe}
            style={{
              display: "flex",
              flexDirection: isSmallMobile ? "column" : "row",
              gap: "8px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter your email..."
              required
              style={{
                flex: 1,
                minHeight: "42px",
                padding: "8px 14px",
                borderRadius: "10px",
                border: `1px solid ${borderColor}`,
                background: inputBg,
                color: textColor,
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxSizing: "border-box",
                width: isSmallMobile ? "100%" : "auto",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = accentColor;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}26`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = borderColor;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="submit"
              style={{
                minHeight: "42px",
                padding: isSmallMobile ? "10px 16px" : "8px 18px",
                borderRadius: "10px",
                border: "none",
                background: accentColor,
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "opacity 0.2s, transform 0.1s",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                width: isSmallMobile ? "100%" : "auto",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.92";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              Join
            </button>
          </form>
        )}
      </div>
    ) : null;

  // 1. Apple / Vercel Minimal
  if (layout === "apple_minimal") {
    return (
      <footer style={{ ...footerStyle, background: footerBg }}>
        <div style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: isMobile ? "24px" : "32px", boxSizing: "border-box" }}>
          
          {/* Top Section: Brand + Newsletter */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isMobile ? "stretch" : "flex-start",
              gap: isMobile ? "22px" : "24px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: isMobile ? "100%" : "420px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: accentColor,
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "12px",
                    fontWeight: 800,
                    boxShadow: `0 4px 12px ${accentColor}33`,
                    flexShrink: 0,
                  }}
                >
                  {brandName.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontWeight: 800, fontSize: isMobile ? "17px" : "18px", color: textColor, letterSpacing: "-0.02em" }}>
                  {brandName}
                </span>
              </div>
              <span style={{ fontSize: isMobile ? "13px" : "13.5px", color: mutedText, lineHeight: 1.5 }}>
                {tagline}
              </span>
            </div>

            {renderNewsletter()}
          </div>

          {/* Middle Section: Navigation Links & Social Links */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isMobile ? "stretch" : "center",
              gap: isMobile ? "18px" : "20px",
              borderTop: `1px solid ${borderColor}`,
              paddingTop: isMobile ? "20px" : "24px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: isSmallMobile ? "10px 16px" : "12px 22px",
                alignItems: "center",
              }}
            >
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.href || "#"}
                  style={{
                    fontSize: isSmallMobile ? "13px" : "13.5px",
                    color: mutedText,
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "color 0.2s ease",
                    padding: "4px 0",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = textColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = mutedText;
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {renderSocials()}
          </div>

          {/* Bottom Copyright */}
          <div style={{ fontSize: "12px", color: mutedText, lineHeight: 1.5, borderTop: isMobile ? `1px dashed ${borderColor}` : "none", paddingTop: isMobile ? "14px" : "0" }}>
            {displayCopyright}
          </div>
        </div>
      </footer>
    );
  }

  // 2. Glassmorphism Premium
  if (layout === "glassmorphism_premium") {
    return (
      <footer
        style={{
          ...footerStyle,
          background: footerBg,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            maxWidth: resolvedMaxWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "22px" : "28px",
            textAlign: "center",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", maxWidth: "480px" }}>
            <span style={{ fontWeight: 800, fontSize: isMobile ? "20px" : "24px", color: textColor, letterSpacing: "-0.03em" }}>
              {brandName}
            </span>
            <p style={{ margin: 0, fontSize: isMobile ? "13px" : "14px", color: mutedText, lineHeight: 1.5 }}>
              {tagline}
            </p>
          </div>

          <div style={{ width: "100%", maxWidth: "400px", display: "flex", justifyContent: "center" }}>
            {renderNewsletter()}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: isSmallMobile ? "10px 16px" : "14px 24px",
              width: "100%",
            }}
          >
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href || "#"}
                style={{
                  fontSize: isSmallMobile ? "13px" : "13.5px",
                  color: textColor,
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = socialBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {renderSocials(true)}

          <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
            {displayCopyright}
          </div>
        </div>
      </footer>
    );
  }

  // 3. Modern Marketplace
  if (layout === "modern_marketplace") {
    return (
      <footer style={{ ...footerStyle, background: footerBg }}>
        <div
          style={{
            maxWidth: resolvedMaxWidth,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "repeat(auto-fit, minmax(240px, 1fr))",
            gap: isMobile ? "26px" : "36px",
            paddingBottom: isMobile ? "24px" : "32px",
            boxSizing: "border-box",
          }}
        >
          {/* Brand & About */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontWeight: 800, fontSize: isMobile ? "18px" : "20px", color: textColor, letterSpacing: "-0.02em" }}>
              {brandName}
            </span>
            <p style={{ margin: 0, fontSize: "13.5px", color: mutedText, lineHeight: 1.55 }}>
              {tagline}
            </p>
            <div style={{ marginTop: "4px" }}>
              {renderSocials()}
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontWeight: 700, fontSize: "13px", color: textColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Quick Links
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSmallMobile ? "1fr" : "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "8px 16px",
              }}
            >
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.href || "#"}
                  style={{
                    fontSize: "13.5px",
                    color: mutedText,
                    textDecoration: "none",
                    padding: "4px 0",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = textColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = mutedText;
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Newsletter Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {renderNewsletter()}
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${borderColor}`,
            paddingTop: "20px",
            textAlign: isMobile ? "left" : "center",
            fontSize: "12px",
            color: mutedText,
            lineHeight: 1.5,
          }}
        >
          {displayCopyright}
        </div>
      </footer>
    );
  }

  // 4. Luxury Fashion
  if (layout === "luxury_fashion") {
    return (
      <footer style={{ ...footerStyle, background: footerBg, textAlign: "center" }}>
        <div
          style={{
            maxWidth: resolvedMaxWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "24px" : "32px",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: isMobile ? "24px" : "30px", fontWeight: 300, color: textColor, fontFamily: "serif", letterSpacing: "0.14em" }}>
            {brandName.toUpperCase()}
          </div>
          <p style={{ margin: 0, fontSize: isMobile ? "13px" : "14px", color: mutedText, fontFamily: "serif", fontStyle: "italic", letterSpacing: "0.04em", maxWidth: "480px", lineHeight: 1.6 }}>
            {tagline}
          </p>

          <div style={{ width: "100%", maxWidth: "380px", display: "flex", justifyContent: "center" }}>
            {renderNewsletter()}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: isSmallMobile ? "12px 18px" : "14px 28px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              width: "100%",
            }}
          >
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href || "#"}
                style={{
                  fontSize: isSmallMobile ? "11px" : "11.5px",
                  color: textColor,
                  fontWeight: 500,
                  textDecoration: "none",
                  padding: "4px 0",
                  borderBottom: "1px solid transparent",
                  transition: "border-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderBottomColor = textColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderBottomColor = "transparent";
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {renderSocials(true)}

          <div style={{ fontSize: "11px", color: mutedText, letterSpacing: "0.08em", marginTop: "8px", borderTop: `1px solid ${borderColor}`, paddingTop: "18px", width: "100%" }}>
            {displayCopyright.toUpperCase()}
          </div>
        </div>
      </footer>
    );
  }

  // 5. Neo Modern
  return (
    <footer
      style={{
        ...footerStyle,
        background: footerBg,
        borderTop: "none",
        boxShadow: isLight
          ? "inset 0 10px 20px rgba(166,180,200,0.15)"
          : "inset 0 10px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: isMobile ? "22px" : "28px", boxSizing: "border-box" }}>
        
        {/* Brand & Link Pills */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            gap: "16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              padding: "8px 18px",
              borderRadius: "999px",
              background: isLight ? "#f0f4f9" : "#1e293b",
              boxShadow: isLight
                ? "4px 4px 10px rgba(166,180,200,0.4), -4px -4px 10px rgba(255,255,255,0.9)"
                : "4px 4px 10px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.05)",
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: isMobile ? "15px" : "16px", color: textColor }}>{brandName}</span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: isSmallMobile ? "8px" : "10px",
            }}
          >
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href || "#"}
                style={{
                  textDecoration: "none",
                  padding: isSmallMobile ? "7px 12px" : "8px 14px",
                  borderRadius: "12px",
                  background: isLight ? "#f0f4f9" : "#1e293b",
                  boxShadow: isLight
                    ? "2px 2px 5px rgba(166,180,200,0.3), -2px -2px 5px rgba(255,255,255,0.8)"
                    : "2px 2px 5px rgba(0,0,0,0.3), -2px -2px 5px rgba(255,255,255,0.04)",
                  transition: "transform 0.15s ease",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span style={{ fontSize: isSmallMobile ? "12px" : "13px", color: textColor, fontWeight: 600 }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Newsletter & Socials */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            gap: isMobile ? "20px" : "24px",
            boxSizing: "border-box",
          }}
        >
          {renderNewsletter()}
          {renderSocials()}
        </div>

        {/* Bottom Details */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            fontSize: "12px",
            color: mutedText,
            marginTop: "8px",
            gap: "6px",
            borderTop: isMobile ? `1px dashed ${borderColor}` : "none",
            paddingTop: isMobile ? "14px" : "0",
          }}
        >
          <span>{displayCopyright}</span>
          <span>{tagline}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;