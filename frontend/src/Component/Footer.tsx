import React, { useState, useEffect } from "react";
import {
  DiwaliGraphics,
  HoliGraphics,
  DurgaGraphics,
  RakhiGraphics,
  ChristmasGraphics,
  EidGraphics,
} from "./FestiveGraphics";

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

  const brandName = props.brandName || props.brand_name || theme?.brand_name || "Website";
  const tagline = props.tagline !== undefined ? props.tagline : "Your premium shopping destination.";

  // Responsive state listener
  const [screenSize, setScreenSize] = useState<{ isMobile: boolean; isSmallMobile: boolean }>(() => {
    if (typeof window === "undefined") return { isMobile: false, isSmallMobile: false };
    const w = window.innerWidth;
    return { isMobile: w < 768, isSmallMobile: w < 480 };
  });
  const [subscribed, setSubscribed] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timeoutId: any = null;
    const checkBreakpoints = () => {
      const w = window.innerWidth;
      const nextMobile = w < 768;
      const nextSmallMobile = w < 480;
      setScreenSize((prev) => {
        if (prev.isMobile === nextMobile && prev.isSmallMobile === nextSmallMobile) {
          return prev;
        }
        return { isMobile: nextMobile, isSmallMobile: nextSmallMobile };
      });
    };

    const debouncedResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkBreakpoints, 150);
    };

    window.addEventListener("resize", debouncedResize, { passive: true });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("resize", debouncedResize);
    };
  }, []);

  const isMobile = screenSize.isMobile;
  const isSmallMobile = screenSize.isSmallMobile;

  const layout = props.footer_layout || theme?.footer_layout || "apple_minimal";

  const isDarkTheme = theme?.mode === "dark";

  const festivalBg = theme?.festival_theme && theme.festival_theme !== "none"
    ? (theme?.footer_bg || theme?.secondary_bg || theme?.primary_bg)
    : undefined;

  const directBg = footer_bg || background_color || props.bg_color || theme?.footer_bg;

  const footerBg =
    festivalBg ||
    directBg ||
    theme?.secondary_bg ||
    (isDarkTheme ? "#0f172a" : theme?.primary_bg || "#f8fafc");

  const isFooterDark = isColorDarkHex(footerBg);
  const isLight = !isFooterDark;

  const directTextColor = footer_text_color || text_color || props.text_color || theme?.footer_text_color;
  const textColor =
    directTextColor ||
    (isFooterDark ? "#ffffff" : "#0f172a");

  const isTextColorDark = isColorDarkHex(textColor);

  const mutedText =
    footer_muted_color ||
    props.muted_color ||
    theme?.footer_muted_color ||
    (theme as any)?.muted_text_color ||
    (isTextColorDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.68)");

  const borderColor =
    footer_border_color ||
    props.border_color ||
    theme?.footer_border_color ||
    (theme as any)?.border_color ||
    (isFooterDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.10)");

  const accentColor = props.accent_color || theme?.accent_color || "#2563eb";

  const inputBg = props.input_bg_color || (isFooterDark ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.95)");
  const socialBg = isFooterDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.05)";
  const socialHoverBg = isFooterDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.10)";

  const showBrand = props.show_brand ?? true;
  const showTagline = props.show_tagline ?? true;
  const showCopyright = props.show_copyright ?? true;

  const brandFontSize = props.brand_font_size ? (typeof props.brand_font_size === "number" ? `${props.brand_font_size}px` : props.brand_font_size) : undefined;
  const taglineFontSize = props.tagline_font_size ? (typeof props.tagline_font_size === "number" ? `${props.tagline_font_size}px` : props.tagline_font_size) : undefined;
  const linkFontSize = props.link_font_size ? (typeof props.link_font_size === "number" ? `${props.link_font_size}px` : props.link_font_size) : undefined;

  const newsletterSubtitle = props.newsletter_subtitle || "";
  const newsletterPlaceholder = props.newsletter_placeholder || "Enter your email...";
  const newsletterButtonText = props.newsletter_button_text || "Join";

  const resolvedPaddingY =
    props.padding_y !== undefined && props.padding_y !== null && String(props.padding_y).trim() !== ""
      ? typeof props.padding_y === "number"
        ? `${props.padding_y}px`
        : !isNaN(parseInt(String(props.padding_y), 10))
          ? `${parseInt(String(props.padding_y), 10)}px`
          : props.padding_y
      : isMobile ? "24px" : "44px";

  const resolvedPaddingX =
    props.padding_x !== undefined && props.padding_x !== null && String(props.padding_x).trim() !== ""
      ? typeof props.padding_x === "number"
        ? `${props.padding_x}px`
        : !isNaN(parseInt(String(props.padding_x), 10))
          ? `${parseInt(String(props.padding_x), 10)}px`
          : props.padding_x
      : isMobile ? "16px" : "24px";

  const resolvedMarginTop =
    props.margin_top !== undefined && props.margin_top !== null && String(props.margin_top).trim() !== ""
      ? typeof props.margin_top === "number"
        ? `${props.margin_top}px`
        : !isNaN(parseInt(String(props.margin_top), 10))
          ? `${parseInt(String(props.margin_top), 10)}px`
          : props.margin_top
      : isMobile ? "20px" : "32px";

  const displayCopyright = copyrightText || props.copyright_text || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;
  const rawMaxWidth = props.max_width || theme?.footer_max_width || "full";
  const resolvedMaxWidth = rawMaxWidth === "full" || rawMaxWidth === "100%" ? "100%" : typeof rawMaxWidth === "number" ? `${rawMaxWidth}px` : rawMaxWidth;

  const footerStyle: React.CSSProperties = {
    padding: `${resolvedPaddingY} ${resolvedPaddingX}`,
    marginTop: resolvedMarginTop,
    borderTop: `1px solid ${borderColor}`,
    transition: "all 0.2s ease",
    fontFamily: layout === "luxury_fashion" ? "serif" : "sans-serif",
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
  };

  const renderFooterFestiveBackdrop = () => {
    const festTheme = (theme as any)?.festival_theme;
    if (!festTheme || festTheme === "none") return null;

    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        {festTheme === "diwali" && (
          <DiwaliGraphics variant="footer" isDark={isFooterDark} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 }} />
        )}
        {festTheme === "holi" && (
          <HoliGraphics variant="footer" isDark={isFooterDark} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 }} />
        )}
        {festTheme === "durga_puja" && (
          <DurgaGraphics variant="footer" isDark={isFooterDark} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 }} />
        )}
        {festTheme === "rakhi" && (
          <RakhiGraphics variant="footer" isDark={isFooterDark} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 }} />
        )}
        {festTheme === "christmas" && (
          <ChristmasGraphics variant="footer" isDark={isFooterDark} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 }} />
        )}
        {festTheme === "eid" && (
          <EidGraphics variant="footer" isDark={isFooterDark} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 }} />
        )}
      </div>
    );
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmailInput("");
    }, 4000);
  };

  const getSocialIconSvg = (platform: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("insta")) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    }
    if (p.includes("twitter") || p.includes("x")) {
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    }
    if (p.includes("face")) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    }
    if (p.includes("you")) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#fff" />
        </svg>
      );
    }
    if (p.includes("link")) {
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      );
    }
    if (p.includes("tik")) {
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.16 8.16 0 0 0 4.77 1.52V6.82a4.85 4.85 0 0 1-1-.13z" />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  };

  const socialVariant = (props as any).social_icon_variant || "pill";

  const renderSocials = (alignCenter = false) =>
    show_social_links && social_links.length > 0 ? (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: socialVariant === "minimal" ? "12px" : "8px",
          alignItems: "center",
          justifyContent: alignCenter || isMobile ? (alignCenter ? "center" : "flex-start") : "flex-start",
          width: isMobile ? "100%" : "auto",
        }}
      >
        {social_links.map((s, idx) => {
          const isCircle = socialVariant === "circle";
          const isRounded = socialVariant === "rounded";
          const isMinimal = socialVariant === "minimal";
          const isIconOnly = isCircle || isRounded || isMinimal;

          return (
            <a
              key={idx}
              href={s.url || "#"}
              target="_blank"
              rel="noreferrer"
              title={s.platform}
              style={{
                fontSize: isMobile ? "12px" : "12.5px",
                fontWeight: 600,
                color: mutedText,
                textDecoration: "none",
                background: isMinimal ? "transparent" : socialBg,
                width: isIconOnly ? (isMobile ? "32px" : "36px") : "auto",
                height: isIconOnly ? (isMobile ? "32px" : "36px") : "auto",
                padding: isIconOnly ? "0" : (isMobile ? "6px 12px" : "7px 14px"),
                borderRadius: isCircle ? "50%" : isRounded ? "8px" : isMinimal ? "6px" : "10px",
                border: isMinimal ? "none" : `1px solid ${borderColor}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s ease",
                touchAction: "manipulation",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isMinimal ? "transparent" : socialHoverBg;
                e.currentTarget.style.color = textColor;
                e.currentTarget.style.transform = "translateY(-1.5px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isMinimal ? "transparent" : socialBg;
                e.currentTarget.style.color = mutedText;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {getSocialIconSvg(s.platform)}
              {!isIconOnly && <span>{s.platform}</span>}
            </a>
          );
        })}
      </div>
    ) : null;

  const renderNewsletter = (fullWidthMobile = true) =>
    show_newsletter ? (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          maxWidth: isMobile ? "100%" : "380px",
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: textColor, letterSpacing: "-0.01em" }}>
          {newsletter_title}
        </span>
        {newsletterSubtitle && (
          <span style={{ fontSize: isMobile ? "11.5px" : "12px", color: mutedText, lineHeight: 1.45 }}>
            {newsletterSubtitle}
          </span>
        )}
        {subscribed ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "12px",
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
              alignItems: "center",
              gap: "6px",
              padding: "4px 4px 4px 14px",
              borderRadius: "12px",
              background: inputBg,
              border: `1px solid ${borderColor}`,
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={newsletterPlaceholder}
              required
              style={{
                flex: 1,
                minHeight: "36px",
                border: "none",
                background: "transparent",
                color: textColor,
                fontSize: "13.5px",
                outline: "none",
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              style={{
                minHeight: "36px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: accentColor,
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "opacity 0.2s, transform 0.1s",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {newsletterButtonText}
            </button>
          </form>
        )}
      </div>
    ) : null;

  // 1. Apple / Vercel Minimal
  if (layout === "apple_minimal") {
    return (
      <footer style={{ ...footerStyle, background: footerBg }}>
        {renderFooterFestiveBackdrop()}
        <div style={{ position: "relative", zIndex: 1, maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: isMobile ? "20px" : "32px", boxSizing: "border-box" }}>
          
          {/* Top Section: Brand + Newsletter */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isMobile ? "center" : "flex-start",
              textAlign: isMobile ? "center" : "left",
              gap: isMobile ? "16px" : "24px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "center" : "flex-start", gap: "8px", maxWidth: isMobile ? "100%" : "420px" }}>
              {showBrand && (
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
                  <span style={{ fontWeight: 800, fontSize: isMobile ? "16px" : "18px", color: textColor, letterSpacing: "-0.02em" }}>
                    {brandName}
                  </span>
                </div>
              )}
              {showTagline && tagline && (
                <span style={{ fontSize: isMobile ? "12px" : "13.5px", color: mutedText, lineHeight: 1.45, maxWidth: isMobile ? "320px" : "100%" }}>
                  {tagline}
                </span>
              )}
            </div>

            {renderNewsletter()}
          </div>

          {/* Middle Section: Navigation Links & Social Links */}
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isMobile ? "center" : "center",
              gap: isMobile ? "14px" : "20px",
              borderTop: `1px solid ${borderColor}`,
              paddingTop: isMobile ? "14px" : "24px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: isMobile ? "center" : "flex-start",
                gap: isMobile ? "6px 14px" : "12px 24px",
                alignItems: "center",
              }}
            >
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.href || "#"}
                  style={{
                    fontSize: isMobile ? "12.5px" : "13.5px",
                    color: mutedText,
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "color 0.2s ease",
                    padding: "2px 0",
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

            {renderSocials(isMobile)}
          </div>

          {/* Bottom Copyright */}
          {showCopyright && (
            <div style={{ fontSize: "11px", color: mutedText, textAlign: isMobile ? "center" : "left", lineHeight: 1.5, borderTop: isMobile ? `1px dashed ${borderColor}` : "none", paddingTop: isMobile ? "10px" : "0" }}>
              {displayCopyright}
            </div>
          )}
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
        {renderFooterFestiveBackdrop()}
        <div
          style={{
            position: "relative", zIndex: 1,
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
            {showBrand && (
              <span style={{ fontWeight: 800, fontSize: isMobile ? "20px" : "24px", color: textColor, letterSpacing: "-0.03em" }}>
                {brandName}
              </span>
            )}
            {showTagline && tagline && (
              <p style={{ margin: 0, fontSize: isMobile ? "13px" : "14px", color: mutedText, lineHeight: 1.5 }}>
                {tagline}
              </p>
            )}
          </div>

          <div style={{ width: "100%", maxWidth: "400px", display: "flex", justifyContent: "center" }}>
            {renderNewsletter()}
          </div>

          <div
            style={{
              display: isMobile ? "grid" : "flex",
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
              flexWrap: isMobile ? undefined : "wrap",
              justifyContent: "center",
              gap: isMobile ? "8px 16px" : "14px 24px",
              width: "100%",
              maxWidth: "500px",
            }}
          >
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href || "#"}
                style={{
                  fontSize: isMobile ? "13px" : "13.5px",
                  color: textColor,
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "6px 8px",
                  borderRadius: "8px",
                  background: isMobile ? socialBg : "transparent",
                  textAlign: "center",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = socialBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isMobile ? socialBg : "transparent";
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {renderSocials(true)}

          {showCopyright && (
            <div style={{ fontSize: "12px", color: mutedText, marginTop: "4px" }}>
              {displayCopyright}
            </div>
          )}
        </div>
      </footer>
    );
  }

  // 3. Modern Marketplace
  if (layout === "modern_marketplace") {
    return (
      <footer style={{ ...footerStyle, background: footerBg }}>
        {renderFooterFestiveBackdrop()}
        <div
          style={{
            position: "relative", zIndex: 1,
            maxWidth: resolvedMaxWidth,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "repeat(auto-fit, minmax(240px, 1fr))",
            gap: isMobile ? "24px" : "36px",
            paddingBottom: isMobile ? "20px" : "32px",
            boxSizing: "border-box",
          }}
        >
          {/* Brand & About */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {showBrand && (
              <span style={{ fontWeight: 800, fontSize: isMobile ? "18px" : "20px", color: textColor, letterSpacing: "-0.02em" }}>
                {brandName}
              </span>
            )}
            {showTagline && tagline && (
              <p style={{ margin: 0, fontSize: "13.5px", color: mutedText, lineHeight: 1.55 }}>
                {tagline}
              </p>
            )}
            <div style={{ marginTop: "4px" }}>
              {renderSocials()}
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontWeight: 700, fontSize: "12px", color: textColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Quick Links
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px 16px",
              }}
            >
              {links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.href || "#"}
                  style={{
                    fontSize: "13px",
                    color: mutedText,
                    textDecoration: "none",
                    padding: "3px 0",
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

        {showCopyright && (
          <div
            style={{
              position: "relative", zIndex: 1,
              borderTop: `1px solid ${borderColor}`,
              paddingTop: "16px",
              textAlign: isMobile ? "left" : "center",
              fontSize: "12px",
              color: mutedText,
              lineHeight: 1.5,
            }}
          >
            {displayCopyright}
          </div>
        )}
      </footer>
    );
  }

  // 4. Luxury Fashion
  if (layout === "luxury_fashion") {
    return (
      <footer style={{ ...footerStyle, background: footerBg, textAlign: "center" }}>
        {renderFooterFestiveBackdrop()}
        <div
          style={{
            position: "relative", zIndex: 1,
            maxWidth: resolvedMaxWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "20px" : "32px",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          {showBrand && (
            <div style={{ fontSize: isMobile ? "22px" : "30px", fontWeight: 300, color: textColor, fontFamily: "serif", letterSpacing: "0.14em" }}>
              {brandName.toUpperCase()}
            </div>
          )}
          {showTagline && tagline && (
            <p style={{ margin: 0, fontSize: isMobile ? "13px" : "14px", color: mutedText, fontFamily: "serif", fontStyle: "italic", letterSpacing: "0.04em", maxWidth: "480px", lineHeight: 1.6 }}>
              {tagline}
            </p>
          )}

          <div style={{ width: "100%", maxWidth: "380px", display: "flex", justifyContent: "center" }}>
            {renderNewsletter()}
          </div>

          <div
            style={{
              display: isMobile ? "grid" : "flex",
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
              flexWrap: isMobile ? undefined : "wrap",
              justifyContent: "center",
              gap: isMobile ? "10px 16px" : "14px 28px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              width: "100%",
              maxWidth: "500px",
            }}
          >
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href || "#"}
                style={{
                  fontSize: isMobile ? "11px" : "11.5px",
                  color: textColor,
                  fontWeight: 500,
                  textDecoration: "none",
                  padding: "4px 0",
                  textAlign: "center",
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

          {showCopyright && (
            <div style={{ fontSize: "11px", color: mutedText, letterSpacing: "0.08em", marginTop: "4px", borderTop: `1px solid ${borderColor}`, paddingTop: "14px", width: "100%" }}>
              {displayCopyright.toUpperCase()}
            </div>
          )}
        </div>
      </footer>
    );
  }

  // 5. Neo Modern 2026 (Carved out multi-level depth matching Neo Navbar)
  const neoBg = footerBg || (isLight ? "#f0f4f9" : "#1e293b");
  const neoTextColor = textColor || (isLight ? "#0f172a" : "#ffffff");
  const neoButtonShadow = isLight
    ? "3px 3px 6px rgba(166,180,200,0.4), -3px -3px 6px rgba(255,255,255,0.9)"
    : "3px 3px 6px rgba(0,0,0,0.4), -3px -3px 6px rgba(255,255,255,0.05)";
  const neoInsetShadow = isLight
    ? "inset 2px 2px 5px rgba(166,180,200,0.4), inset -2px -2px 5px rgba(255,255,255,0.9)"
    : "inset 2px 2px 5px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(255,255,255,0.05)";

  return (
    <footer
      style={{
        ...footerStyle,
        background: neoBg,
        borderTop: isLight ? "1px solid rgba(166,180,200,0.2)" : "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {renderFooterFestiveBackdrop()}
      <div style={{ position: "relative", zIndex: 1, maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: isMobile ? "22px" : "28px", boxSizing: "border-box" }}>
        
        {/* Brand & 4 Carved Out Link Buttons */}
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
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              alignItems: isMobile ? "center" : "flex-start",
            }}
          >
            {showBrand && (
              <div
                style={{
                  padding: "8px 20px",
                  borderRadius: "999px",
                  background: neoBg,
                  boxShadow: neoButtonShadow,
                  display: "inline-flex",
                  alignItems: "center",
                  alignSelf: isMobile ? "center" : "auto",
                  width: "fit-content",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: isMobile ? "15px" : "16px", color: neoTextColor }}>{brandName}</span>
              </div>
            )}
            {showTagline && tagline && (
              <p style={{ margin: 0, fontSize: isMobile ? "12.5px" : "13px", color: mutedText, lineHeight: 1.5, textAlign: isMobile ? "center" : "left", maxWidth: "420px" }}>
                {tagline}
              </p>
            )}
          </div>

          <div
            style={{
              display: isMobile ? "grid" : "flex",
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : undefined,
              flexWrap: isMobile ? undefined : "wrap",
              gap: isMobile ? "10px" : "12px",
              width: isMobile ? "100%" : "auto",
            }}
          >
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.href || "#"}
                style={{
                  fontSize: isMobile ? "12px" : "13px",
                  fontWeight: 600,
                  color: neoTextColor,
                  textDecoration: "none",
                  padding: isMobile ? "7px 12px" : "8px 16px",
                  borderRadius: "10px",
                  background: neoBg,
                  boxShadow: neoButtonShadow,
                  textAlign: "center",
                  transition: "all 0.18s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {link.label}
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
          {show_newsletter && (
            <div style={{ width: "100%", maxWidth: isMobile ? "100%" : "380px" }}>
              <span style={{ fontSize: isMobile ? "13px" : "14px", fontWeight: 700, color: neoTextColor, letterSpacing: "-0.01em", display: "block", marginBottom: "8px", textAlign: isMobile ? "center" : "left" }}>
                {newsletter_title}
              </span>
              {subscribed ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 16px",
                    borderRadius: "999px",
                    background: isLight ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.2)",
                    boxShadow: neoInsetShadow,
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
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 4px 4px 16px",
                    borderRadius: "999px",
                    background: neoBg,
                    boxShadow: neoInsetShadow,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={newsletterPlaceholder}
                    required
                    style={{
                      flex: 1,
                      minHeight: "36px",
                      border: "none",
                      background: "transparent",
                      color: neoTextColor,
                      fontSize: "13.5px",
                      outline: "none",
                      minWidth: 0,
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      minHeight: "36px",
                      padding: "8px 18px",
                      borderRadius: "999px",
                      border: "none",
                      background: accentColor,
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: neoButtonShadow,
                      transition: "opacity 0.2s, transform 0.1s",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {newsletterButtonText}
                  </button>
                </form>
              )}
            </div>
          )}

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
            borderTop: `1px solid ${isLight ? "rgba(166,180,200,0.2)" : "rgba(255,255,255,0.05)"}`,
            paddingTop: isMobile ? "14px" : "10px",
          }}
        >
          {showCopyright && <span>{displayCopyright}</span>}
          {showTagline && tagline && <span>{tagline}</span>}
        </div>
      </div>
    </footer>
  );
};

export default Footer;