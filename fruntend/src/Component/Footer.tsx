import React from "react";

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

  const mutedText =
    footer_muted_color ||
    theme?.footer_muted_color ||
    (theme as any)?.muted_text_color ||
    (isFooterDark ? "rgba(255, 255, 255, 0.68)" : "rgba(15, 23, 42, 0.65)");

  const borderColor =
    footer_border_color ||
    theme?.footer_border_color ||
    (theme as any)?.border_color ||
    (isFooterDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)");

  const accentColor = theme?.accent_color || "#2563eb";

  const inputBg = isFooterDark ? "rgba(0, 0, 0, 0.25)" : "rgba(255, 255, 255, 0.85)";
  const socialBg = isFooterDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.05)";

  const displayCopyright = copyrightText || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`;
  const resolvedMaxWidth = theme?.footer_max_width === "full" ? "100%" : theme?.footer_max_width ? `${theme.footer_max_width}px` : "1200px";

  const footerStyle: React.CSSProperties = {
    padding: "3rem 1.5rem",
    marginTop: "4rem",
    borderTop: `1px solid ${borderColor}`,
    transition: "all 0.2s ease",
    fontFamily: layout === "luxury_fashion" ? "serif" : "sans-serif",
  };

  const renderSocials = () =>
    show_social_links && social_links.length > 0 ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        {social_links.map((s, idx) => (
          <a
            key={idx}
            href={s.url || "#"}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: mutedText,
              textDecoration: "none",
              background: socialBg,
              padding: "4px 10px",
              borderRadius: "8px",
              border: `1px solid ${borderColor}`,
            }}
          >
            {s.platform}
          </a>
        ))}
      </div>
    ) : null;

  const renderNewsletter = () =>
    show_newsletter ? (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "340px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: textColor }}>{newsletter_title}</span>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: "6px" }}>
          <input
            type="email"
            placeholder="Enter your email..."
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: "8px",
              border: `1px solid ${borderColor}`,
              background: inputBg,
              color: textColor,
              fontSize: "12px",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: "none",
              background: accentColor,
              color: "#fff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Join
          </button>
        </form>
      </div>
    ) : null;

  // 1. Apple / Vercel Minimal
  if (layout === "apple_minimal") {
    return (
      <footer style={{ ...footerStyle, background: footerBg }}>
        <div style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: accentColor, color: "#fff", display: "grid", placeItems: "center", fontSize: "10px", fontWeight: 800 }}>{brandName.charAt(0).toUpperCase()}</div>
                <span style={{ fontWeight: 700, fontSize: "15px", color: textColor }}>{brandName}</span>
              </div>
              <span style={{ fontSize: "12px", color: mutedText }}>{tagline}</span>
            </div>
            {renderNewsletter()}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px", borderTop: `1px solid ${borderColor}`, paddingTop: "16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
              {links.map((link, idx) => (
                <a key={idx} href={link.href || "#"} style={{ fontSize: "13px", color: mutedText, fontWeight: 500, textDecoration: "none" }}>{link.label}</a>
              ))}
            </div>
            {renderSocials()}
          </div>
          <div style={{ fontSize: "12px", color: mutedText }}>
            {displayCopyright}
          </div>
        </div>
      </footer>
    );
  }

  // 2. Glassmorphism Premium
  if (layout === "glassmorphism_premium") {
    return (
      <footer style={{
        ...footerStyle,
        background: footerBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${borderColor}`,
      }}>
        <div style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", textAlign: "center", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 800, fontSize: "20px", color: textColor, letterSpacing: "-0.03em" }}>{brandName}</span>
            <p style={{ margin: 0, fontSize: "13px", color: mutedText, maxWidth: "400px" }}>{tagline}</p>
          </div>
          {renderNewsletter()}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "24px" }}>
            {links.map((link, idx) => (
              <a key={idx} href={link.href || "#"} style={{ fontSize: "13px", color: textColor, fontWeight: 600, textDecoration: "none" }}>{link.label}</a>
            ))}
          </div>
          {renderSocials()}
          <div style={{ fontSize: "12px", color: mutedText, marginTop: "8px" }}>
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
        <div style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "32px", paddingBottom: "32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontWeight: 800, fontSize: "18px", color: textColor }}>{brandName}</span>
            <p style={{ margin: 0, fontSize: "13px", color: mutedText }}>{tagline}</p>
            {renderSocials()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontWeight: 700, fontSize: "13px", color: textColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Links</span>
            {links.map((link, idx) => (
              <a key={idx} href={link.href || "#"} style={{ fontSize: "13px", color: mutedText, textDecoration: "none" }}>{link.label}</a>
            ))}
          </div>
          {renderNewsletter()}
        </div>
        <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: "20px", textAlign: "center", fontSize: "12px", color: mutedText }}>
          {displayCopyright}
        </div>
      </footer>
    );
  }

  // 4. Luxury Fashion
  if (layout === "luxury_fashion") {
    return (
      <footer style={{ ...footerStyle, background: footerBg, textAlign: "center" }}>
        <div style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px", alignItems: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 300, color: textColor, fontFamily: "serif", letterSpacing: "0.15em" }}>{brandName.toUpperCase()}</div>
          <p style={{ margin: 0, fontSize: "14px", color: mutedText, fontFamily: "serif", fontStyle: "italic", letterSpacing: "0.05em" }}>{tagline}</p>
          {renderNewsletter()}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            {links.map((link, idx) => (
              <a key={idx} href={link.href || "#"} style={{ fontSize: "11px", color: textColor, fontWeight: 500, textDecoration: "none" }}>{link.label}</a>
            ))}
          </div>
          {renderSocials()}
          <div style={{ fontSize: "11px", color: mutedText, letterSpacing: "0.08em", marginTop: "12px" }}>
            {displayCopyright.toUpperCase()}
          </div>
        </div>
      </footer>
    );
  }

  // 5. Neo Modern 2026
  return (
    <footer style={{
      ...footerStyle,
      background: footerBg,
      borderTop: "none",
      boxShadow: isLight
        ? "inset 0 10px 20px rgba(166,180,200,0.15)"
        : "inset 0 10px 20px rgba(0,0,0,0.3)",
    }}>
      <div style={{ maxWidth: resolvedMaxWidth, margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "8px 16px", borderRadius: "999px", background: isLight ? "#f0f4f9" : "#1e293b", boxShadow: isLight ? "4px 4px 10px rgba(166,180,200,0.4), -4px -4px 10px rgba(255,255,255,0.9)" : "4px 4px 10px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.05)" }}>
            <span style={{ fontWeight: 800, fontSize: "16px", color: textColor }}>{brandName}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {links.map((link, idx) => (
              <a key={idx} href={link.href || "#"} style={{ textDecoration: "none", padding: "6px 12px", borderRadius: "10px", background: isLight ? "#f0f4f9" : "#1e293b", boxShadow: isLight ? "2px 2px 5px rgba(166,180,200,0.3), -2px -2px 5px rgba(255,255,255,0.8)" : "2px 2px 5px rgba(0,0,0,0.3), -2px -2px 5px rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: "12px", color: textColor, fontWeight: 600 }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          {renderNewsletter()}
          {renderSocials()}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", fontSize: "12px", color: mutedText, marginTop: "12px" }}>
          <span>{displayCopyright}</span>
          <span>{tagline}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;