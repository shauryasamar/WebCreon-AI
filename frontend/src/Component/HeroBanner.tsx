import React, { useEffect, useState } from "react";
import {
  DiwaliGraphics,
  HoliGraphics,
  DurgaGraphics,
  RakhiGraphics,
  ChristmasGraphics,
  EidGraphics,
} from "./FestiveGraphics";

export type HeroSlide = {
  id?: string;
  variant?: "flash_sale" | "product_launch" | "minimal_brand" | "standard";
  headline: string;
  subheadline?: string;
  badge?: string;
  coupon_code?: string;
  sale_end_time?: string;
  primary_cta?: {
    label: string;
    href: string;
  };
  secondary_cta?: {
    label: string;
    href: string;
  };
  product_card?: {
    title: string;
    price: string;
    original_price?: string;
    rating?: string;
    image_url?: string;
    product_href?: string;
  };
  trust_badges?: string[];
  background_image?: string;
  background_color?: string; // Custom background color / gradient per slide
  hero_bg?: string;
  background_overlay?: string;
  text_color?: string;
  hero_text_color?: string;
  accent_color?: string;
  hero_accent?: string;
  [key: string]: any;
};

export type HeroBannerProps = {
  headline?: string;
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
  background_color?: string;
  hero_bg?: string;
  background_overlay?: string;
  text_color?: string;
  hero_text_color?: string;
  size?: "sm" | "md" | "lg" | "xl";
  banner_height?: number | string;
  banner_width?: number | string; // Custom width limit
  border_radius?: number | string;
  background_position?: string;
  background_size?: string;
  theme?: {
    mode?: "light" | "dark";
    primary_bg?: string;
    secondary_bg?: string;
    hero_bg?: string;
    hero_text_color?: string;
    text_color?: string;
    accent_color?: string;
    festival_theme?: string;
    [key: string]: any;
  };

  // Multi-Slide Carousel Props
  slides?: HeroSlide[];
  auto_play_interval?: number; // In seconds (default: 3)
  auto_play?: boolean;
};

// Countdown Timer Helper Hook
function useCountdown(targetDateTime?: string) {
  const [timeLeft, setTimeLeft] = useState<{ hours: string; minutes: string; seconds: string }>({
    hours: "04h",
    minutes: "22m",
    seconds: "15s",
  });

  useEffect(() => {
    if (!targetDateTime) return;
    const target = new Date(targetDateTime).getTime();
    if (isNaN(target)) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        hours: `${String(hours).padStart(2, "0")}h`,
        minutes: `${String(minutes).padStart(2, "0")}m`,
        seconds: `${String(seconds).padStart(2, "0")}s`,
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDateTime]);

  return timeLeft;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  headline = "Welcome to Our Store",
  subheadline = "Discover premium products crafted for your lifestyle.",
  primary_cta = { label: "Shop Now", href: "/products" },
  secondary_cta = { label: "Explore Collection", href: "/categories" },
  background_image,
  background_color,
  hero_bg,
  background_overlay = "rgba(15, 23, 42, 0.45)",
  text_color,
  hero_text_color,
  banner_height = 380,
  banner_width = "100%",
  border_radius = 16,
  background_position = "center",
  background_size = "cover",
  theme,
  slides,
  auto_play_interval = 3,
  auto_play = true,
}) => {
  const isDarkMode = theme?.mode === "dark";

  const [screenSize, setScreenSize] = useState<{ isMobile: boolean; isTablet: boolean }>(() => {
    if (typeof window === "undefined") return { isMobile: false, isTablet: false };
    const w = window.innerWidth;
    return { isMobile: w <= 640, isTablet: w <= 960 };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timeoutId: any = null;
    const checkBreakpoints = () => {
      const w = window.innerWidth;
      const nextMobile = w <= 640;
      const nextTablet = w <= 960;
      setScreenSize((prev) => {
        if (prev.isMobile === nextMobile && prev.isTablet === nextTablet) {
          return prev;
        }
        return { isMobile: nextMobile, isTablet: nextTablet };
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
  const isTablet = screenSize.isTablet;

  // Format Numeric Sizing
  const rawHeightNum =
    typeof banner_height === "number"
      ? banner_height
      : !isNaN(Number(banner_height)) && Number(banner_height) > 0
        ? Number(banner_height)
        : 380;

  const responsiveHeight = isMobile ? Math.min(rawHeightNum, 360) : rawHeightNum;
  const computedHeight = `${responsiveHeight}px`;

  // Banner Width Computation
  const computedWidth =
    typeof banner_width === "number"
      ? `${banner_width}px`
      : !isNaN(Number(banner_width)) && Number(banner_width) > 0
        ? `${banner_width}px`
        : String(banner_width || "100%");

  // Height Scale Factor (hScale) relative to 380px standard height
  const hScale = Math.min(1.3, Math.max(0.42, responsiveHeight / 380));

  const computedRadius =
    typeof border_radius === "number" || (!isNaN(Number(border_radius)) && String(border_radius).indexOf("px") === -1)
      ? `${border_radius}px`
      : String(border_radius || "16px");

  // Normalize slides
  const activeSlides: HeroSlide[] =
    slides && slides.length > 0
      ? slides
      : [
        {
          id: "default-slide",
          variant: "standard",
          headline,
          subheadline,
          primary_cta,
          secondary_cta,
          background_image,
          background_color,
          background_overlay,
          text_color,
        },
      ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll Timer
  useEffect(() => {
    if (!auto_play || isHovered || activeSlides.length <= 1) return;

    const intervalMs = Math.max(1, auto_play_interval) * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [auto_play, auto_play_interval, isHovered, activeSlides.length]);

  // Keep index within bounds
  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(Math.max(0, activeSlides.length - 1));
    }
  }, [activeSlides.length, currentIndex]);

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const liveCountdown = useCountdown(currentSlide.sale_end_time);

  // Slide background image & color handling
  const slideBgImage = currentSlide.background_image;
  const hasSlideBgImage = Boolean(slideBgImage);
  const slideBgOverlay = currentSlide.background_overlay || background_overlay;

  // Custom slide background color (supports manual block editing & global themes)
  const festTheme = (theme as any)?.festival_theme;
  const isFestive = Boolean(festTheme && festTheme !== "none");
  const directBlockBg = hero_bg || background_color;

  let slideCustomBgColor = isDarkMode ? (theme?.hero_bg || theme?.secondary_bg || "#1a1c21") : (theme?.hero_bg || "#f8fafc");
  if (isDarkMode) {
    slideCustomBgColor =
      theme?.hero_bg ||
      theme?.secondary_bg ||
      (currentSlide.hero_bg && currentSlide.hero_bg !== "#f8fafc" && currentSlide.hero_bg !== "#ffffff" ? currentSlide.hero_bg : "#1a1c21");
  } else if (theme?.hero_bg) {
    slideCustomBgColor = theme.hero_bg;
  } else if (isFestive && theme?.secondary_bg) {
    slideCustomBgColor = theme.secondary_bg;
  } else if (currentSlide.background_color || currentSlide.hero_bg || directBlockBg) {
    slideCustomBgColor = currentSlide.background_color || currentSlide.hero_bg || directBlockBg || "#f8fafc";
  } else if (theme?.secondary_bg || theme?.primary_bg) {
    slideCustomBgColor = theme.secondary_bg || theme.primary_bg || "#f8fafc";
  }

  const defaultBgStyle: React.CSSProperties = {
    background: slideCustomBgColor,
  };

  // Theme-adaptive text color
  const defaultTextColor = isDarkMode ? "#f8fafc" : "#0f172a";
  const directTextColor = hero_text_color || text_color;
  const slideTextColor =
    isDarkMode
      ? (theme?.hero_text_color || theme?.text_color || "#f8fafc")
      : (theme?.hero_text_color ||
         currentSlide.hero_text_color ||
         currentSlide.text_color ||
         directTextColor ||
         theme?.text_color ||
         (hasSlideBgImage ? "#ffffff" : defaultTextColor));
  const accentColor = theme?.hero_accent || currentSlide.accent_color || theme?.accent_color || (isDarkMode ? "#60a5fa" : "#2563eb");

  // Dynamic Scale-based Sizing
  const containerPadding = `${Math.round(Math.max(14, 28 * hScale))}px ${Math.round(isMobile ? 16 : 32 * hScale)}px`;
  const contentGap = `${Math.round(Math.max(6, 12 * hScale))}px`;

  const headlineFontSize = `${(Math.max(0.9, Math.min(2.3, 1.8 * hScale))).toFixed(2)}rem`;
  const subheadlineFontSize = `${(Math.max(0.72, Math.min(1.05, 0.95 * hScale))).toFixed(2)}rem`;
  const badgeFontSize = `${Math.max(9, Math.round(11 * hScale))}px`;

  const ctaPadding = `${Math.round(Math.max(6, 10 * hScale))}px ${Math.round(Math.max(12, 20 * hScale))}px`;
  const ctaFontSize = `${(Math.max(0.75, Math.min(0.95, 0.88 * hScale))).toFixed(2)}rem`;

  // Hide subheadline on very small heights (< 220px) to prevent overflowing
  const showSubheadline = responsiveHeight >= 220 && Boolean(currentSlide.subheadline);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    borderRadius: computedRadius,
    padding: containerPadding,
    height: computedHeight,
    minHeight: computedHeight,
    maxHeight: computedHeight,
    width: computedWidth,
    maxWidth: "100%",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxSizing: "border-box",
    flexShrink: 0,
    boxShadow: isDarkMode
      ? "0 16px 40px rgba(0, 0, 0, 0.4)"
      : "0 12px 36px rgba(15, 23, 42, 0.06)",
    ...(hasSlideBgImage
      ? {
        backgroundImage: `url(${slideBgImage})`,
        backgroundSize: background_size,
        backgroundPosition: background_position,
        backgroundRepeat: "no-repeat",
      }
      : defaultBgStyle),
  };

  const renderHeroFestiveBackdrop = () => {
    if (hasSlideBgImage || !festTheme || festTheme === "none") return null;

    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? "100%" : isTablet ? "46%" : "50%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: isMobile ? "0px" : "16px 28px",
          opacity: isMobile ? (isDarkMode ? 0.35 : 0.25) : 1,
        }}
      >
        {festTheme === "diwali" && (
          <DiwaliGraphics 
            variant="hero"
            isDark={isDarkMode} 
            style={{ width: "100%", height: "100%", maxHeight: "100%", objectFit: "contain" }} 
          />
        )}

        {festTheme === "holi" && (
          <HoliGraphics 
            variant="hero"
            isDark={isDarkMode} 
            style={{ width: "100%", height: "100%", maxHeight: "100%", objectFit: "contain" }} 
          />
        )}

        {festTheme === "durga_puja" && (
          <DurgaGraphics 
            variant="hero"
            isDark={isDarkMode} 
            style={{ width: "100%", height: "100%", maxHeight: "100%", objectFit: "contain" }} 
          />
        )}

        {festTheme === "rakhi" && (
          <RakhiGraphics 
            variant="hero"
            isDark={isDarkMode} 
            style={{ width: "100%", height: "100%", maxHeight: "100%", objectFit: "contain" }} 
          />
        )}

        {festTheme === "christmas" && (
          <ChristmasGraphics 
            variant="hero"
            isDark={isDarkMode} 
            style={{ width: "100%", height: "100%", maxHeight: "100%", objectFit: "contain" }} 
          />
        )}

        {festTheme === "eid" && (
          <EidGraphics 
            variant="hero"
            isDark={isDarkMode} 
            style={{ width: "100%", height: "100%", maxHeight: "100%", objectFit: "contain" }} 
          />
        )}
      </div>
    );
  };

  const isFestiveActive = Boolean(festTheme && festTheme !== "none" && !hasSlideBgImage);
  const slideContentMaxWidth = isMobile ? "100%" : isFestiveActive ? "48%" : "640px";

  const renderSlideContent = () => {
    const variant = currentSlide.variant || "standard";

    switch (variant) {
      case "flash_sale":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: contentGap, maxWidth: slideContentMaxWidth }}>
            {/* Badge & Coupon */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {currentSlide.badge && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: badgeFontSize,
                    fontWeight: 800,
                    padding: "3px 9px",
                    borderRadius: "999px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
                  }}
                >
                  {currentSlide.badge}
                </span>
              )}
              {currentSlide.coupon_code && (
                <span
                  style={{
                    background: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.06)",
                    border: isDarkMode ? "1px dashed rgba(255,255,255,0.3)" : "1px dashed rgba(15,23,42,0.2)",
                    color: slideTextColor,
                    fontSize: badgeFontSize,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  CODE: {currentSlide.coupon_code}
                </span>
              )}
            </div>

            {/* Headline */}
            <h1
              style={{
                fontSize: headlineFontSize,
                fontWeight: 800,
                color: slideTextColor,
                lineHeight: 1.12,
                margin: 0,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                textOverflow: "ellipsis",
              }}
            >
              {currentSlide.headline}
            </h1>

            {/* Subheadline (If height permits) */}
            {showSubheadline && (
              <p
                style={{
                  fontSize: subheadlineFontSize,
                  color: slideTextColor,
                  opacity: 0.88,
                  margin: 0,
                  lineHeight: 1.35,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  textOverflow: "ellipsis",
                }}
              >
                {currentSlide.subheadline}
              </p>
            )}

            {/* Live Countdown Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: badgeFontSize, fontWeight: 700, color: slideTextColor, opacity: 0.8 }}>ENDS IN:</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {[liveCountdown.hours, liveCountdown.minutes, liveCountdown.seconds].map((unit, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: isDarkMode ? "#0f172a" : "rgba(15,23,42,0.85)",
                      color: "#ffffff",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: badgeFontSize,
                      fontWeight: 800,
                      fontFamily: "monospace",
                    }}
                  >
                    {unit}
                  </span>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
              {currentSlide.primary_cta && (
                <a
                  href={currentSlide.primary_cta.href || "/sale"}
                  style={{
                    padding: ctaPadding,
                    borderRadius: "999px",
                    background: accentColor,
                    color: "#ffffff",
                    fontSize: ctaFontSize,
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                  }}
                >
                  {currentSlide.primary_cta.label}
                </a>
              )}
            </div>
          </div>
        );

      case "product_launch":
        const pCard = currentSlide.product_card || {
          title: "Next-Gen Smartwatch Pro",
          price: "$199",
          original_price: "$299",
          rating: "4.9 ⭐",
          product_href: "/products",
        };
        return (
          <div style={{ display: "grid", gridTemplateColumns: isMobile || responsiveHeight < 300 ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: contentGap, alignItems: "center", width: "100%" }}>
            {/* Left Content */}
            <div style={{ display: "flex", flexDirection: "column", gap: contentGap }}>
              {currentSlide.badge && (
                <span style={{ background: "rgba(37,99,235,0.15)", color: accentColor, fontSize: badgeFontSize, fontWeight: 800, padding: "3px 9px", borderRadius: "999px", width: "fit-content", textTransform: "uppercase" }}>
                  {currentSlide.badge}
                </span>
              )}
              <h1
                style={{
                  fontSize: headlineFontSize,
                  fontWeight: 800,
                  color: slideTextColor,
                  lineHeight: 1.12,
                  margin: 0,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  textOverflow: "ellipsis",
                }}
              >
                {currentSlide.headline}
              </h1>
              {showSubheadline && (
                <p
                  style={{
                    fontSize: subheadlineFontSize,
                    color: slideTextColor,
                    opacity: 0.85,
                    margin: 0,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentSlide.subheadline}
                </p>
              )}

              {/* CTAs */}
              <div style={{ display: "flex", gap: "8px" }}>
                {currentSlide.primary_cta && (
                  <a
                    href={currentSlide.primary_cta.href || "/products"}
                    style={{ padding: ctaPadding, borderRadius: "999px", background: accentColor, color: "#ffffff", fontSize: ctaFontSize, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}
                  >
                    {currentSlide.primary_cta.label}
                  </a>
                )}
              </div>
            </div>

            {/* Right Showcase Card */}
            {!isMobile && responsiveHeight >= 300 && (
              <a
                href={pCard.product_href || currentSlide.primary_cta?.href || "/products"}
                style={{
                  textDecoration: "none",
                  background: isDarkMode ? "rgba(30,41,59,0.9)" : "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(16px)",
                  padding: `${Math.round(12 * hScale)}px`,
                  borderRadius: "12px",
                  border: isDarkMode ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(15,23,42,0.1)",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                  maxWidth: "260px",
                  justifySelf: "end",
                  display: "block",
                }}
              >
                <div style={{ fontSize: "9px", fontWeight: 800, color: accentColor, textTransform: "uppercase" }}>Featured Product</div>
                <div style={{ fontSize: `${(0.85 * hScale).toFixed(2)}rem`, fontWeight: 700, color: isDarkMode ? "#ffffff" : "#0f172a", marginTop: "2px" }}>{pCard.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                  <span style={{ fontSize: `${(0.95 * hScale).toFixed(2)}rem`, fontWeight: 800, color: isDarkMode ? "#ffffff" : "#0f172a" }}>{pCard.price}</span>
                  {pCard.original_price && (
                    <span style={{ fontSize: "11px", color: "#94a3b8", textDecoration: "line-through" }}>{pCard.original_price}</span>
                  )}
                </div>
              </a>
            )}
          </div>
        );

      case "minimal_brand":
      case "standard":
      default:
        const trustBadgesList = currentSlide.trust_badges && currentSlide.trust_badges.length > 0
          ? currentSlide.trust_badges
          : ["Free Worldwide Shipping", "30-Day Money Back", "24/7 VIP Support"];

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: contentGap, maxWidth: slideContentMaxWidth }}>
            {currentSlide.badge && (
              <span style={{ background: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)", color: slideTextColor, fontSize: badgeFontSize, fontWeight: 800, padding: "3px 9px", borderRadius: "999px", width: "fit-content" }}>
                {currentSlide.badge}
              </span>
            )}
            <h1
              style={{
                fontSize: headlineFontSize,
                fontWeight: 800,
                color: slideTextColor,
                lineHeight: 1.12,
                margin: 0,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                textOverflow: "ellipsis",
              }}
            >
              {currentSlide.headline}
            </h1>
            {showSubheadline && (
              <p
                style={{
                  fontSize: subheadlineFontSize,
                  color: slideTextColor,
                  opacity: 0.88,
                  margin: 0,
                  lineHeight: 1.35,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  textOverflow: "ellipsis",
                }}
              >
                {currentSlide.subheadline}
              </p>
            )}

            {/* Trust Badges */}
            {trustBadgesList.length > 0 && responsiveHeight >= 250 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: badgeFontSize, fontWeight: 600, color: slideTextColor, opacity: 0.8 }}>
                {trustBadgesList.map((tb, idx) => (
                  <span key={idx}>✓ {tb}</span>
                ))}
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
              {currentSlide.primary_cta && (
                <a
                  href={currentSlide.primary_cta.href || "/products"}
                  style={{
                    padding: ctaPadding,
                    borderRadius: "999px",
                    background: accentColor,
                    color: "#ffffff",
                    fontSize: ctaFontSize,
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                  }}
                >
                  {currentSlide.primary_cta.label}
                </a>
              )}
              {currentSlide.secondary_cta && responsiveHeight >= 280 && (
                <a
                  href={currentSlide.secondary_cta.href || "/categories"}
                  style={{
                    padding: ctaPadding,
                    borderRadius: "999px",
                    border: isDarkMode ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(15,23,42,0.15)",
                    background: "transparent",
                    color: slideTextColor,
                    fontSize: ctaFontSize,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {currentSlide.secondary_cta.label}
                </a>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <section
      style={containerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Overlay */}
      {hasSlideBgImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: slideBgOverlay,
            pointerEvents: "none",
          }}
        />
      )}

      {renderHeroFestiveBackdrop()}

      {/* Main Slide Content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {renderSlideContent()}
      </div>

      {/* Carousel Navigation Controls (Invisible by default, APPEARS ONLY ON HOVER) */}
      {activeSlides.length > 1 && (
        <>
          {/* Left Arrow (Only visible on hover) */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous Banner"
            style={{
              position: "absolute",
              left: isMobile ? "8px" : "16px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(15,23,42,0.5)",
              backdropFilter: "blur(8px)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: 20,
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              fontSize: "18px",
              fontWeight: 700,
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? "auto" : "none",
              transition: "opacity 200ms ease, transform 200ms ease",
            }}
          >
            ‹
          </button>

          {/* Right Arrow (Only visible on hover) */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next Banner"
            style={{
              position: "absolute",
              right: isMobile ? "8px" : "16px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(15,23,42,0.5)",
              backdropFilter: "blur(8px)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: 20,
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              fontSize: "18px",
              fontWeight: 700,
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? "auto" : "none",
              transition: "opacity 200ms ease, transform 200ms ease",
            }}
          >
            ›
          </button>

          {/* Sleek Dots Indicator */}
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "6px",
              zIndex: 10,
            }}
          >
            {activeSlides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                style={{
                  width: currentIndex === idx ? "20px" : "6px",
                  height: "6px",
                  borderRadius: "999px",
                  border: "none",
                  background: currentIndex === idx ? accentColor : "rgba(255,255,255,0.45)",
                  cursor: "pointer",
                  transition: "all 200ms ease",
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};