import React, { useEffect, useRef, useState } from "react";
import {
  DiwaliGraphics,
  HoliGraphics,
  DurgaGraphics,
  RakhiGraphics,
  ChristmasGraphics,
  EidGraphics,
} from "./FestiveGraphics";
import { optimizeImageUrl } from "../utils/imageOptimizer";

export type HeroSlide = {
  id?: string;
  variant?: "flash_sale" | "product_launch" | "minimal_brand" | "standard";
  headline: string;
  subheadline?: string;
  badge?: string;
  coupon_code?: string;
  sale_countdown_type?: "ends_in" | "starts_in";
  sale_start_time?: string;
  sale_end_time?: string;
  primary_cta?: {
    label: string;
    href: string;
    show?: boolean;
    style?: "solid" | "outline" | "glass";
  };
  secondary_cta?: {
    label: string;
    href: string;
    show?: boolean;
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
  background_overlay_opacity?: number;
  text_alignment?: "left" | "center" | "right";
  show_primary_cta?: boolean;
  show_secondary_cta?: boolean;
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
    show?: boolean;
    style?: "solid" | "outline" | "glass";
  };
  secondary_cta?: {
    label: string;
    href: string;
    show?: boolean;
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

// Countdown Timer Helper Hook supporting both Starts In & Ends In
function useCountdown(
  startDateTime?: string,
  endDateTime?: string,
  explicitMode?: "starts_in" | "ends_in"
) {
  const [state, setState] = useState<{
    hours: string;
    minutes: string;
    seconds: string;
    label: "STARTS IN:" | "ENDS IN:";
    isExpired: boolean;
  }>({
    hours: "04h",
    minutes: "22m",
    seconds: "15s",
    label: explicitMode === "starts_in" ? "STARTS IN:" : "ENDS IN:",
    isExpired: false,
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const startTime = startDateTime ? new Date(startDateTime).getTime() : NaN;
      const endTime = endDateTime ? new Date(endDateTime).getTime() : NaN;

      let targetTime = NaN;
      let currentLabel: "STARTS IN:" | "ENDS IN:" = "ENDS IN:";

      if (explicitMode === "starts_in" && !isNaN(startTime)) {
        targetTime = startTime;
        currentLabel = "STARTS IN:";
      } else if (explicitMode === "ends_in" && !isNaN(endTime)) {
        targetTime = endTime;
        currentLabel = "ENDS IN:";
      } else {
        // Auto-detect based on dates
        if (!isNaN(startTime) && startTime > now) {
          targetTime = startTime;
          currentLabel = "STARTS IN:";
        } else if (!isNaN(endTime)) {
          targetTime = endTime;
          currentLabel = "ENDS IN:";
        } else if (!isNaN(startTime)) {
          targetTime = startTime;
          currentLabel = "STARTS IN:";
        }
      }

      if (isNaN(targetTime)) {
        setState((prev) => ({ ...prev, label: currentLabel }));
        return;
      }

      const diff = Math.max(0, targetTime - now);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setState({
        hours: `${String(hours).padStart(2, "0")}h`,
        minutes: `${String(minutes).padStart(2, "0")}m`,
        seconds: `${String(seconds).padStart(2, "0")}s`,
        label: currentLabel,
        isExpired: diff <= 0,
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startDateTime, endDateTime, explicitMode]);

  return state;
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
  ...restProps
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

  // Gesture & Swipe Tracking (Mobile Touch + Laptop Mouse Drag + Trackpad Wheel)
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const wheelLockRef = useRef(false);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeSlides.length <= 1) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null || activeSlides.length <= 1) return;
    const diffX = touchStartX - e.changedTouches[0].clientX;
    const diffY = touchStartY - e.changedTouches[0].clientY;

    // Trigger slide change on clear horizontal swipe (> 30px)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
      if (diffX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeSlides.length <= 1) return;
    // Don't intercept button or link clicks
    if ((e.target as HTMLElement).closest("button, a, input, select")) return;
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragOffset(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStartX === null) return;
    const offset = e.clientX - dragStartX;
    setDragOffset(offset);
  };

  const handleMouseUp = () => {
    if (isDragging && dragStartX !== null) {
      if (dragOffset < -35) {
        handleNext();
      } else if (dragOffset > 35) {
        handlePrev();
      }
    }
    setIsDragging(false);
    setDragStartX(null);
    setDragOffset(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (activeSlides.length <= 1) return;
    if (Math.abs(e.deltaX) > 35 && !wheelLockRef.current) {
      wheelLockRef.current = true;
      if (e.deltaX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 400);
    }
  };

  // Auto-scroll Timer
  useEffect(() => {
    if (!auto_play || isHovered || isDragging || activeSlides.length <= 1) return;

    const intervalMs = Math.max(1, auto_play_interval) * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [auto_play, auto_play_interval, isHovered, isDragging, activeSlides.length]);

  // Keep index within bounds
  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(Math.max(0, activeSlides.length - 1));
    }
  }, [activeSlides.length, currentIndex]);

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  const liveCountdown = useCountdown(
    currentSlide.sale_start_time,
    currentSlide.sale_end_time,
    currentSlide.sale_countdown_type
  );

  // Slide background image & color handling
  const slideBgImage = currentSlide.background_image;
  const hasSlideBgImage = Boolean(slideBgImage);
  const overlayOpacity =
    typeof currentSlide.background_overlay_opacity === "number"
      ? currentSlide.background_overlay_opacity
      : 0;
  const slideBgOverlay =
    currentSlide.background_overlay ||
    (overlayOpacity > 0 ? `rgba(0, 0, 0, ${overlayOpacity})` : "transparent");

  const slideImageFit = currentSlide.image_fit || currentSlide.background_size || background_size || "cover";
  const slideImagePosition = currentSlide.image_position || currentSlide.background_position || background_position || "center";
  const slideImageZoom = typeof currentSlide.image_zoom === "number" ? currentSlide.image_zoom : 100;

  const resolvedBgSize = slideImageZoom !== 100
    ? `${slideImageZoom}%`
    : slideImageFit === "contain"
      ? "contain"
      : slideImageFit === "fill"
        ? "100% 100%"
        : "cover";

  // Custom slide background color (supports manual block editing & global themes)
  const festTheme = (theme as any)?.festival_theme;
  const isFestive = Boolean(festTheme && festTheme !== "none");
  const directBlockBg = hero_bg || background_color;

  let slideCustomBgColor = isDarkMode ? (theme?.hero_bg || theme?.secondary_bg || "#1a1c21") : (theme?.hero_bg || "#f8fafc");
  if (isDarkMode) {
    slideCustomBgColor =
      currentSlide.background_color ||
      currentSlide.hero_bg ||
      theme?.hero_bg ||
      theme?.secondary_bg ||
      "#1a1c21";
  } else if (currentSlide.background_color || currentSlide.hero_bg) {
    slideCustomBgColor = currentSlide.background_color || currentSlide.hero_bg;
  } else if (theme?.hero_bg) {
    slideCustomBgColor = theme.hero_bg;
  } else if (directBlockBg) {
    slideCustomBgColor = directBlockBg;
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
    currentSlide.hero_text_color ||
    currentSlide.text_color ||
    (isDarkMode
      ? (theme?.hero_text_color || theme?.text_color || "#f8fafc")
      : (theme?.hero_text_color ||
        directTextColor ||
        theme?.text_color ||
        (hasSlideBgImage ? "#ffffff" : defaultTextColor)));
  const accentColor = currentSlide.hero_accent || currentSlide.accent_color || theme?.hero_accent || theme?.accent_color || (isDarkMode ? "#60a5fa" : "#2563eb");

  // Dynamic Scale-based Sizing
  const horizontalPadding = isMobile
    ? 18
    : Math.round(Math.max(28, 36 * hScale));
  const containerPadding = `${Math.round(Math.max(14, 28 * hScale))}px ${horizontalPadding}px`;
  const contentGap = `${Math.round(Math.max(6, 12 * hScale))}px`;

  const headlineFontSize = `${(Math.max(0.9, Math.min(2.3, 1.8 * hScale))).toFixed(2)}rem`;
  const subheadlineFontSize = `${(Math.max(0.72, Math.min(1.05, 0.95 * hScale))).toFixed(2)}rem`;
  const badgeFontSize = `${Math.max(9, Math.round(11 * hScale))}px`;

  const getHeroFontFamilyStyle = (fontKey?: string) => {
    switch (fontKey) {
      case "playfair_serif":
      case "elegant_serif":
        return "'Playfair Display', 'Didot', 'Georgia', serif";
      case "cinzel_display":
      case "bold_display":
        return "'Cinzel', 'Trajan Pro', 'Didot', serif";
      case "cormorant_serif":
        return "'Cormorant Garamond', 'Garamond', 'Baskerville', serif";
      case "outfit_tech":
      case "outfit_geometric":
      case "geometric":
        return "'Outfit', 'Poppins', 'Montserrat', sans-serif";
      case "plus_jakarta":
      case "jakarta_sans":
        return "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case "roboto_sans":
        return "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case "space_grotesk":
        return "'Space Grotesk', -apple-system, sans-serif";
      case "poppins_rounded":
        return "'Poppins', -apple-system, sans-serif";
      case "montserrat_bold":
        return "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      case "dancing_script":
      case "stylish_script":
        return "'Dancing Script', 'Brush Script MT', cursive";
      case "great_vibes":
        return "'Great Vibes', 'Allura', cursive";
      case "abril_fatface":
        return "'Abril Fatface', 'Playfair Display', 'Georgia', serif";
      case "monospace":
        return "'Fira Code', 'JetBrains Mono', 'Courier New', monospace";
      case "sans_modern":
      case "modern_sans":
      default:
        return "inherit";
    }
  };

  const headlineFontFamily = getHeroFontFamilyStyle(
    currentSlide.headline_font_family ||
    currentSlide.font_family ||
    (restProps as any).headline_font_family ||
    (restProps as any).font_family ||
    theme?.brand_font_family
  );
  const headlineFontWeight = String(
    currentSlide.headline_font_weight ||
    currentSlide.font_weight ||
    (restProps as any).headline_font_weight ||
    "800"
  );
  const headlineFontStyle = (
    currentSlide.headline_font_style ||
    currentSlide.font_style ||
    (restProps as any).headline_font_style ||
    "normal"
  ) as any;

  const customHeadlineFontSize = currentSlide.headline_font_size || (restProps as any).headline_font_size;
  const resolvedHeadlineFontSize = customHeadlineFontSize ? `${customHeadlineFontSize}px` : headlineFontSize;

  const customSubheadlineFontSize = currentSlide.subheadline_font_size || (restProps as any).subheadline_font_size;
  const resolvedSubheadlineFontSize = customSubheadlineFontSize ? `${customSubheadlineFontSize}px` : subheadlineFontSize;

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
    background: slideCustomBgColor,
    cursor: activeSlides.length > 1 ? (isDragging ? "grabbing" : "grab") : "default",
    userSelect: isDragging ? "none" : "auto",
    touchAction: "pan-y",
    boxShadow: isDarkMode
      ? "0 16px 40px rgba(0, 0, 0, 0.4)"
      : "0 12px 36px rgba(15, 23, 42, 0.06)",
  };

  const festivePosition = (
    currentSlide.festive_position ||
    (restProps as any).festive_position ||
    (theme as any)?.hero_festive_position ||
    (theme as any)?.festive_position ||
    "right"
  ) as "left" | "center" | "right";

  const rawFestiveOpacity = currentSlide.festive_opacity !== undefined
    ? currentSlide.festive_opacity
    : (restProps as any).festive_opacity !== undefined
    ? (restProps as any).festive_opacity
    : (theme as any)?.hero_festive_opacity !== undefined
    ? (theme as any)?.hero_festive_opacity
    : (theme as any)?.festive_opacity;

  const renderHeroFestiveBackdrop = () => {
    if (hasSlideBgImage || !festTheme || festTheme === "none") return null;

    const isCenter = festivePosition === "center";
    const isLeft = festivePosition === "left";

    const customOpacityScale = rawFestiveOpacity !== undefined
      ? Math.max(0, Math.min(100, Number(rawFestiveOpacity) > 1 ? Number(rawFestiveOpacity) : Number(rawFestiveOpacity) * 100)) / 100
      : undefined;

    const baseOpacity = isMobile
      ? (isDarkMode ? 0.35 : 0.25)
      : isCenter
        ? (isDarkMode ? 0.55 : 0.40)
        : 1;

    const resolvedOpacity = customOpacityScale !== undefined ? customOpacityScale : baseOpacity;

    const backdropStyle: React.CSSProperties = {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: isCenter ? "50%" : isLeft ? 0 : "auto",
      right: isCenter ? "auto" : isLeft ? "auto" : 0,
      transform: isCenter ? "translateX(-50%)" : "none",
      width: isCenter
        ? (isMobile ? "90%" : "60%")
        : (isMobile ? "100%" : isTablet ? "46%" : "50%"),
      height: "100%",
      pointerEvents: "none",
      zIndex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: isCenter ? "center" : isLeft ? "flex-start" : "flex-end",
      padding: isMobile ? "0px" : isCenter ? "10px" : "16px 28px",
      opacity: resolvedOpacity,
      transition: "opacity 0.2s ease, left 0.2s ease, right 0.2s ease, transform 0.2s ease",
    };

    return (
      <div
        aria-hidden="true"
        style={backdropStyle}
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

  const slideAlign = currentSlide.text_alignment || "left";
  const slideAlignItems = slideAlign === "center" ? "center" : slideAlign === "right" ? "flex-end" : "flex-start";
  const slideContentMaxWidth = slideAlign === "center" ? "760px" : "620px";
  const slideTextAlign = slideAlign === "center" ? "center" : slideAlign === "right" ? "right" : "left";
  const slideMargin = slideAlign === "center" ? "0 auto" : slideAlign === "right" ? "0 0 0 auto" : "0";

  // Per-slide CTA Button Visibility & Independent Links
  const showPrimaryCta = (currentSlide.show_primary_cta !== false && currentSlide.primary_cta?.show !== false) && Boolean(currentSlide.primary_cta?.label);
  const showSecondaryCta = (currentSlide.show_secondary_cta !== false && currentSlide.secondary_cta?.show !== false) && Boolean(currentSlide.secondary_cta?.label) && (responsiveHeight >= 260 || isMobile);
  const primaryBtnStyle = currentSlide.primary_cta?.style || "solid";

  const getPrimaryButtonStyle = (): React.CSSProperties => {
    if (primaryBtnStyle === "outline") {
      return {
        padding: ctaPadding,
        borderRadius: "999px",
        background: "transparent",
        border: `1.5px solid ${accentColor}`,
        color: accentColor,
        fontSize: ctaFontSize,
        fontWeight: 700,
        textDecoration: "none",
        transition: "all 0.15s ease",
      };
    }
    if (primaryBtnStyle === "glass") {
      return {
        padding: ctaPadding,
        borderRadius: "999px",
        background: isDarkMode ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.08)",
        backdropFilter: "blur(12px)",
        border: isDarkMode ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(15,23,42,0.15)",
        color: slideTextColor,
        fontSize: ctaFontSize,
        fontWeight: 700,
        textDecoration: "none",
        transition: "all 0.15s ease",
      };
    }
    return {
      padding: ctaPadding,
      borderRadius: "999px",
      background: accentColor,
      color: "#ffffff",
      fontSize: ctaFontSize,
      fontWeight: 700,
      textDecoration: "none",
      boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
      transition: "all 0.15s ease",
    };
  };

  const renderButtonsRow = () => {
    if (!showPrimaryCta && !showSecondaryCta) return null;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          marginTop: "4px",
          justifyContent: slideAlign === "center" ? "center" : slideAlign === "right" ? "flex-end" : "flex-start",
        }}
      >
        {showPrimaryCta && currentSlide.primary_cta && (
          <a
            href={currentSlide.primary_cta.href || "/products"}
            style={getPrimaryButtonStyle()}
          >
            {currentSlide.primary_cta.label}
          </a>
        )}
        {showSecondaryCta && currentSlide.secondary_cta && (
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
              transition: "all 0.15s ease",
            }}
          >
            {currentSlide.secondary_cta.label}
          </a>
        )}
      </div>
    );
  };

  const renderSlideContent = () => {
    const variant = currentSlide.variant || "standard";

    switch (variant) {
      case "flash_sale":
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: contentGap,
              maxWidth: slideContentMaxWidth,
              alignItems: slideAlignItems,
              textAlign: slideTextAlign as any,
              margin: slideMargin,
            }}
          >
            {/* Badge & Coupon */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: slideAlign === "center" ? "center" : slideAlign === "right" ? "flex-end" : "flex-start" }}>
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
                fontSize: resolvedHeadlineFontSize,
                fontWeight: headlineFontWeight as any,
                fontFamily: headlineFontFamily,
                fontStyle: headlineFontStyle,
                color: slideTextColor,
                lineHeight: 1.15,
                margin: 0,
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {currentSlide.headline}
            </h1>

            {/* Subheadline */}
            {showSubheadline && (
              <p
                style={{
                  fontSize: resolvedSubheadlineFontSize,
                  color: slideTextColor,
                  opacity: 0.92,
                  margin: 0,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {currentSlide.subheadline}
              </p>
            )}

            {/* Live Countdown Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: slideAlign === "center" ? "center" : slideAlign === "right" ? "flex-end" : "flex-start" }}>
              <span style={{ fontSize: badgeFontSize, fontWeight: 700, color: slideTextColor, opacity: 0.8 }}>{liveCountdown.label}</span>
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
            {renderButtonsRow()}
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: contentGap,
                alignItems: slideAlignItems,
                textAlign: slideTextAlign as any,
                margin: slideMargin,
              }}
            >
              {currentSlide.badge && (
                <span style={{ background: "rgba(37,99,235,0.15)", color: accentColor, fontSize: badgeFontSize, fontWeight: 800, padding: "3px 9px", borderRadius: "999px", width: "fit-content", textTransform: "uppercase" }}>
                  {currentSlide.badge}
                </span>
              )}
              <h1
                style={{
                  fontSize: resolvedHeadlineFontSize,
                  fontWeight: headlineFontWeight as any,
                  fontFamily: headlineFontFamily,
                  fontStyle: headlineFontStyle,
                  color: slideTextColor,
                  lineHeight: 1.15,
                  margin: 0,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {currentSlide.headline}
              </h1>
              {showSubheadline && (
                <p
                  style={{
                    fontSize: resolvedSubheadlineFontSize,
                    color: slideTextColor,
                    opacity: 0.9,
                    margin: 0,
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {currentSlide.subheadline}
                </p>
              )}

              {/* CTAs */}
              {renderButtonsRow()}
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
                  justifySelf: slideAlign === "right" ? "start" : "end",
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
        const trustBadgesList = Array.isArray(currentSlide.trust_badges)
          ? currentSlide.trust_badges
          : (variant === "minimal_brand" ? ["Free Shipping", "30-Day Money Back", "24/7 VIP Support"] : []);

        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: contentGap,
              maxWidth: slideContentMaxWidth,
              alignItems: slideAlignItems,
              textAlign: slideTextAlign as any,
              margin: slideMargin,
            }}
          >
            {currentSlide.badge && (
              <span
                style={{
                  background: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.08)",
                  color: slideTextColor,
                  fontSize: badgeFontSize,
                  fontWeight: 800,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  width: "fit-content",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  border: isDarkMode ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(15,23,42,0.1)",
                }}
              >
                {currentSlide.badge}
              </span>
            )}

            <h1
              style={{
                fontSize: resolvedHeadlineFontSize,
                fontWeight: headlineFontWeight as any,
                fontFamily: headlineFontFamily,
                fontStyle: headlineFontStyle,
                color: slideTextColor,
                lineHeight: 1.15,
                margin: 0,
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {currentSlide.headline}
            </h1>

            {showSubheadline && (
              <p
                style={{
                  fontSize: resolvedSubheadlineFontSize,
                  color: slideTextColor,
                  opacity: 0.92,
                  margin: 0,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {currentSlide.subheadline}
              </p>
            )}

            {/* Trust Badges */}
            {trustBadgesList.length > 0 && responsiveHeight >= 250 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: badgeFontSize, fontWeight: 600, color: slideTextColor, opacity: 0.8, justifyContent: slideAlign === "center" ? "center" : slideAlign === "right" ? "flex-end" : "flex-start" }}>
                {trustBadgesList.map((tb, idx) => (
                  <span key={idx}>✓ {tb}</span>
                ))}
              </div>
            )}

            {/* CTAs */}
            {renderButtonsRow()}
          </div>
        );
    }
  };

  return (
    <section
      style={containerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isDragging) handleMouseUp();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Absolute Background Image layer with exact object-fit, position, and zoom */}
      {hasSlideBgImage && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "hidden",
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          <img
            src={optimizeImageUrl(slideBgImage, 1920, 1080)}
            alt=""
            loading={currentIndex === 0 ? "eager" : "lazy"}
            fetchPriority={currentIndex === 0 ? "high" : "auto"}
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: (slideImageFit === "fill" ? "fill" : slideImageFit === "contain" ? "contain" : "cover") as any,
              objectPosition: slideImagePosition,
              transform: slideImageZoom !== 100 ? `scale(${slideImageZoom / 100})` : undefined,
              transformOrigin: slideImagePosition,
              display: "block",
              transition: "transform 0.15s ease, object-fit 0.15s ease",
            }}
          />
        </div>
      )}

      {/* Dark Readability Overlay on top of image */}
      {hasSlideBgImage && overlayOpacity > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: slideBgOverlay,
            zIndex: 1,
            pointerEvents: "none",
            transition: "background 0.15s ease",
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
          boxSizing: "border-box",
          pointerEvents: isDragging ? "none" : "auto",
        }}
      >
        {renderSlideContent()}
      </div>

      {/* Carousel Navigation Controls at Bottom (Side of Dots, No Pill Container) */}
      {activeSlides.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 30,
            pointerEvents: "auto",
          }}
        >
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Previous Slide"
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border: "none",
              background: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.12)",
              color: isDarkMode ? "#ffffff" : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 150ms ease, transform 150ms ease",
              padding: 0,
              outline: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(15,23,42,0.22)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.12)";
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Dots Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {activeSlides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                aria-label={`Go to slide ${idx + 1}`}
                style={{
                  width: currentIndex === idx ? "20px" : "6px",
                  height: "6px",
                  borderRadius: "999px",
                  border: "none",
                  padding: 0,
                  background: currentIndex === idx ? accentColor : (isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.3)"),
                  cursor: "pointer",
                  transition: "all 200ms ease",
                  outline: "none",
                }}
              />
            ))}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Next Slide"
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border: "none",
              background: isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.12)",
              color: isDarkMode ? "#ffffff" : "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 150ms ease, transform 150ms ease",
              padding: 0,
              outline: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(15,23,42,0.22)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDarkMode ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.12)";
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
};