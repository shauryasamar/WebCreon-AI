import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { optimizeImageUrl } from "../utils/imageOptimizer";
import {
  DiwaliGraphics,
  HoliGraphics,
  DurgaGraphics,
  RakhiGraphics,
  ChristmasGraphics,
  EidGraphics,
} from "./FestiveGraphics";

export type NavbarTheme = {
  name?: string;
  mode?: string;
  primary_bg?: string;
  secondary_bg?: string;
  card_bg?: string;
  surface_bg?: string;
  dialog_bg?: string;
  border_color?: string;
  text_color?: string;
  accent_color?: string;
  navbar_variant?: "solid" | "soft" | "floating" | "transparent";
  navbar_position?: "static" | "sticky" | "fixed";
  navbar_layout?:
  | "standard"
  | "apple_minimal"
  | "glassmorphism_premium"
  | "modern_marketplace"
  | "luxury_fashion"
  | "neo_modern";
  navbar_outer_bg?: string;
  navbar_bg?: string;
  navbar_text_color?: string;
  navbar_muted_text_color?: string;
  navbar_border_color?: string;
  navbar_height?: number;
  navbar_max_width?: number | string;
  navbar_radius?: number;
  navbar_padding_x?: number;
  brand_display_mode?: "both" | "logo_only" | "name_only";
  brand_alignment?: "left" | "center";
  brand_layout_direction?: "row" | "column";
  brand_font_family?: string;
  brand_font_weight?: string;
  brand_font_style?: string;
  brand_font_size?: number | string;
  brand_text_color?: string;
  logo_size?: number | string;
  logo_zoom?: number | string;
  logo_height?: number | string;
  logo_max_width?: number | string;
  logo_fit?: "contain" | "cover" | "fill" | "scale-down";
  search_display_mode?: "bar" | "icon";
  search_placement?: "left" | "center" | "right";
  search_max_width?: number | string;
  search_height?: number | string;
  search_text_color?: string;
  search_muted_text_color?: string;
  search_bg_color?: string;
  search_border_color?: string;
  [key: string]: any;
};


export type NavbarNavigationItem = {
  label: string;
  route: string;
  role?: string;
};


export type NavbarNavigationGroups = {
  storefront?: NavbarNavigationItem[];
  admin?: NavbarNavigationItem[];
};


export type NavbarFixedBounds = {
  left: number;
  width: number;
};


export type NavbarProps = {
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  logo_url?: string;
  theme?: NavbarTheme;
  navigation?: NavbarNavigationGroups;
  showSearch?: boolean;
  showAccount?: boolean;
  showCart?: boolean;
  homeRoute?: string;
  cartRoute?: string;
  topOffset?: number;
  fixedBounds?: NavbarFixedBounds;
  siteSlug?: string;
  appBase?: string;
  navbar_outer_bg?: string;
  navbar_bg?: string;
  navbar_text_color?: string;
  navbar_border_color?: string;
  onOpenCart?: () => void;
  onSearch?: (query: string) => void;
  editMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  [key: string]: any;
};


type NavbarPosition = "static" | "sticky" | "fixed";
type ViewportMode = "mobile" | "tablet" | "desktop";


const iconStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  stroke: "currentColor",
  strokeWidth: 1.8,
  fill: "none",
  flexShrink: 0,
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

const isLightTheme = (theme?: NavbarTheme) => {
  if (theme?.navbar_bg) {
    return !isColorDarkHex(theme.navbar_bg);
  }
  return theme?.mode === "light";
};


const getInitials = (brandName?: string) => {
  if (!brandName) return "SB";
  const words = brandName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};


const toAppPath = (base: string, route?: string) => {
  if (!route || route === "/") return base;
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${base}${normalizedRoute}`;
};


/**
 * IMPORTANT: When `fixedBounds` is provided, it means the navbar is being
 * rendered inside the admin builder preview, and its nearest scrolling
 * ancestor (the preview pane in BuilderShell.tsx) has been given a real
 * CSS containing block via `transform: translateZ(0)`. That means
 * `position: fixed` here resolves against that preview pane's box, NOT
 * the browser viewport, and is genuinely clipped by that pane's
 * `overflow: hidden`. Because of that, we no longer need (or want) to
 * compute pixel-perfect left/width via getBoundingClientRect — the
 * navbar can simply fill 100% of its containing block.
 */
const getNavbarPositionStyle = (
  position: NavbarPosition,
  topOffset: number,
  fixedBounds?: NavbarFixedBounds
): React.CSSProperties => {
  if (position === "static") {
    return { position: "relative", zIndex: 1000 };
  }

  if (position === "fixed") {
    if (fixedBounds) {
      return {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 1000,
      };
    }

    return {
      position: "fixed",
      top: `${topOffset}px`,
      left: 0,
      width: "100%",
      right: "auto",
      zIndex: 1000,
    };
  }

  return { position: "sticky", top: `${topOffset}px`, zIndex: 1000 };
};


const useViewportMode = (): ViewportMode => {
  const getMode = (): ViewportMode => {
    if (typeof window === "undefined") return "desktop";
    if (window.innerWidth <= 640) return "mobile";
    if (window.innerWidth <= 960) return "tablet";
    return "desktop";
  };


  const [mode, setMode] = useState<ViewportMode>(getMode);


  useEffect(() => {
    const handleResize = () => setMode(getMode());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  return mode;
};


const Navbar: React.FC<NavbarProps> = (props) => {
  const {
    brandName: propBrandName,
    logoUrl,
    logo_url,
    theme,
    navigation,
    showSearch = (props as any).show_search ?? props.showSearch ?? true,
    showAccount = (props as any).show_account ?? props.showAccount ?? true,
    showCart = (props as any).show_cart ?? props.showCart ?? true,
    homeRoute = "/",
    cartRoute = "/cart",
    topOffset = 0,
    fixedBounds,
    siteSlug,
    appBase,
    onOpenCart,
    onSearch,
    editMode = false,
    isSelected = false,
    onSelect,
  } = props;
  const { cartCount = 0 } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { siteId, slug } = useParams<{ siteId?: string; slug?: string }>();
  const { isAuthenticated, refreshMe, clearUser, logout } = useCustomerAuth();


  const viewportMode = useViewportMode();
  const isMobile = viewportMode === "mobile";
  const isCompact = isMobile;


  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("search") || "";
    setSearchQuery(q);
  }, [location.search]);


  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);


  const base =
    appBase ||
    (location.pathname.startsWith("/store/")
      ? `/store/${siteSlug || slug || ""}`
      : `/builder/${siteId ?? ""}`);


  const light = isLightTheme(theme);
  const rawVariant = (props as any).navbar_variant || theme?.navbar_variant || "glassmorphism";
  const variant = rawVariant;
  const rawPosition = (props as any).navbar_position || (props as any).position || theme?.navbar_position;
  const position: NavbarPosition = (rawPosition === "static" || rawPosition === "sticky" || rawPosition === "fixed") ? rawPosition : "fixed";

  const [isStickyVisible, setIsStickyVisible] = useState(true);
  const [isScrolledPastTop, setIsScrolledPastTop] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    if (position !== "sticky") {
      setIsStickyVisible(true);
      setIsScrolledPastTop(false);
      return;
    }

    const findScrollContainer = (): Element | Window => {
      const candidates = [
        document.querySelector(".store-canvas-container"),
        document.querySelector(".storefront-viewport"),
        document.querySelector("main"),
        window,
      ];
      for (const el of candidates) {
        if (!el) continue;
        if (el === window) return window;
        const style = window.getComputedStyle(el as Element);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          return el;
        }
      }
      return window;
    };

    const container = findScrollContainer();
    const getScrollY = () =>
      container === window
        ? window.scrollY
        : (container as Element).scrollTop;

    const handleScroll = () => {
      const currentY = getScrollY();
      setIsScrolledPastTop(currentY > 10);

      if (currentY <= 40) {
        setIsStickyVisible(true);
        lastScrollYRef.current = currentY;
        return;
      }

      if (currentY > lastScrollYRef.current + 8) {
        setIsStickyVisible(false);
      } else if (currentY < lastScrollYRef.current - 4) {
        setIsStickyVisible(true);
      }
      lastScrollYRef.current = currentY;
    };

    const target: EventTarget = container === window ? window : container;
    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, [position]);

  const rawBrandName =
    props.brandName ||
    (props as any).brand_name ||
    (props as any).name ||
    (props as any).title ||
    theme?.brandName ||
    theme?.brand_name ||
    theme?.store_name ||
    "GreenHarvest";
  const brandName = rawBrandName;

  const isBuilderAdminRoute =
    location.pathname.startsWith("/builder/") && location.pathname.includes("/admin");
  const isStoreRoute = location.pathname.startsWith("/store/");


  const resolvedHomePath = toAppPath(base, homeRoute);
  const resolvedCartPath = toAppPath(base, cartRoute);


  const accentColor = theme?.accent_color || "#2563eb";
  const primaryBg = theme?.primary_bg || (light ? "#f8fafc" : "#020617");


  const defaultTextColor = theme?.text_color || (light ? "#0f172a" : "#f8fafc");
  const textColor = (props as any).navbar_text_color || theme?.navbar_text_color || defaultTextColor;
  const defaultMutedText = light ? "rgba(15,23,42,0.64)" : "rgba(255,255,255,0.68)";
  const mutedText = (props as any).navbar_muted_text_color || theme?.navbar_muted_text_color || defaultMutedText;

  const navbarHeight = theme?.navbar_height ?? 72;
  const navbarHeightNum = Number(navbarHeight) || 72;
  const rawMaxWidth = (props as any).navbar_max_width || theme?.navbar_max_width || "full";
  const navbarMaxWidth =
    String(rawMaxWidth) === "100%" || String(rawMaxWidth) === "full"
      ? "100%"
      : typeof rawMaxWidth === "number"
      ? `${rawMaxWidth}px`
      : String(rawMaxWidth).endsWith("px") || String(rawMaxWidth).endsWith("%") || String(rawMaxWidth).endsWith("vw")
      ? String(rawMaxWidth)
      : `${rawMaxWidth}px`;
  const navbarRadius = theme?.navbar_radius;
  const navbarPaddingX = theme?.navbar_padding_x;
  const navbarPaddingY = theme?.navbar_padding_y;

  const brandDisplayMode = (props as any).brand_display_mode || theme?.brand_display_mode || "both";
  const brandAlignment = (props as any).brand_alignment || theme?.brand_alignment || "left";
  const brandLayoutDirection = (props as any).brand_layout_direction || theme?.brand_layout_direction || "row";
  const brandFontFamily = (props as any).brand_font_family || theme?.brand_font_family || "modern_sans";
  const brandFontWeight = (props as any).brand_font_weight || theme?.brand_font_weight || "700";
  const brandFontStyle = (props as any).brand_font_style || theme?.brand_font_style || "normal";
  const brandFontSizeNum = Number((props as any).brand_font_size || theme?.brand_font_size || 15);
  const brandCustomTextColor = (props as any).brand_text_color || theme?.brand_text_color;
  const brandTextColor = brandCustomTextColor || textColor;

  const logoSizeNum = Number(
    (props as any).logo_size ||
    (props as any).logo_height ||
    theme?.logo_size ||
    theme?.logo_height ||
    36
  );
  // Allow the brand logo to scale up to full navbar height with minimal buffer
  const maxInnerLogoHeight = Math.max(16, navbarHeightNum - 4);
  const effectiveLogoSize = Math.max(16, Math.min(logoSizeNum, maxInnerLogoHeight));
  const logoFitStyle: React.CSSProperties["objectFit"] = ((props as any).logo_fit || theme?.logo_fit || "contain") as any;
  const logoZoomNum = Math.max(50, Math.min(300, Number((props as any).logo_zoom || theme?.logo_zoom || 100)));
  const logoBlendMode: React.CSSProperties["mixBlendMode"] = undefined;
  const effectiveLogoMaxHeight = effectiveLogoSize;
  const logoHeightStyle = `${effectiveLogoSize}px`;

  const getBrandFontFamilyStyle = (fontKey: string) => {
    switch (fontKey) {
      case "playfair_serif":
      case "elegant_serif":
        return "'Playfair Display', 'Didot', 'Georgia', serif";
      case "cinzel_display":
      case "bold_display":
        return "'Cinzel', 'Trajan Pro', 'Didot', serif";
      case "cormorant_serif":
        return "'Cormorant Garamond', 'Garamond', 'Baskerville', serif";
      case "outfit_geometric":
      case "geometric":
        return "'Outfit', 'Poppins', 'Montserrat', sans-serif";
      case "jakarta_sans":
        return "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
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
      case "modern_sans":
      default:
        return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }
  };
  const resolvedBrandFontFamily = getBrandFontFamilyStyle(brandFontFamily);

  const rawLogoUrl =
    props.logoUrl ||
    props.logo_url ||
    (props as any).logo ||
    theme?.logoUrl ||
    theme?.logo_url;

  const resolvedLogoUrl = rawLogoUrl ? optimizeImageUrl(rawLogoUrl) : "";

  const outerBgFromPropsOrTheme =
    props.navbar_outer_bg ||
    theme?.navbar_outer_bg ||
    props.navbar_bg ||
    theme?.navbar_bg;

  const shellBgFromPropsOrTheme =
    props.navbar_bg ||
    theme?.navbar_bg;

  const hasCustomNavbarBorder = Boolean(theme?.navbar_border_color || props.navbar_border_color);

  const darkOuterSurface = outerBgFromPropsOrTheme || theme?.secondary_bg || primaryBg || "#081226";
  const darkShellSurface = shellBgFromPropsOrTheme || theme?.secondary_bg || primaryBg || "#0f172a";
  const darkSoftSurface = "rgba(255,255,255,0.06)";


  const lightOuterSurface = outerBgFromPropsOrTheme || theme?.secondary_bg || primaryBg || "#ffffff";
  const lightShellSurface = shellBgFromPropsOrTheme || theme?.secondary_bg || primaryBg || "#ffffff";
  const lightSoftSurface = "rgba(15,23,42,0.04)";


  let outerBackground = light ? lightOuterSurface : darkOuterSurface;
  let shellBg = light ? lightShellSurface : darkShellSurface;
  let shellBoxShadow = light
    ? "0 10px 30px rgba(15,23,42,0.06)"
    : "0 12px 32px rgba(0,0,0,0.30)";
  let shellRadius = navbarRadius !== undefined ? `${navbarRadius}px` : "20px";
  let wrapperPadding = "14px 16px";
  let shellPadding = "12px 14px";


  if (variant === "solid") {
    outerBackground = light ? lightShellSurface : darkShellSurface;
    shellBg = "transparent";
    shellBoxShadow = "none";
    shellRadius = navbarRadius !== undefined ? `${navbarRadius}px` : "0px";
    wrapperPadding = "0";
    shellPadding = "14px 16px";
  }


  if (variant === "floating") {
    outerBackground =
      position === "static"
        ? light
          ? lightOuterSurface
          : darkOuterSurface
        : "transparent";
    shellBg = light ? lightShellSurface : darkShellSurface;
    shellBoxShadow = light
      ? "0 14px 34px rgba(15,23,42,0.10)"
      : "0 14px 34px rgba(0,0,0,0.34)";
    shellRadius = navbarRadius !== undefined ? `${navbarRadius}px` : "22px";
    wrapperPadding = "16px";
    shellPadding = "12px 14px";
  }


  if (variant === "transparent") {
    outerBackground = "transparent";
    shellBg = "transparent";
    shellBoxShadow = "none";
    shellRadius = navbarRadius !== undefined ? `${navbarRadius}px` : "0px";
    wrapperPadding = "10px 16px";
    shellPadding = "10px 0";
  }


  if (variant === "soft") {
    outerBackground = light ? lightOuterSurface : darkOuterSurface;
    shellBg = light ? lightShellSurface : darkShellSurface;
  }

  if (variant === "glassmorphism") {
    outerBackground = "transparent";
    shellBg = light ? "rgba(255, 255, 255, 0.72)" : "rgba(15, 23, 42, 0.72)";
    shellBoxShadow = light
      ? "0 10px 30px rgba(31, 38, 135, 0.08)"
      : "0 12px 32px rgba(0, 0, 0, 0.40)";
    shellRadius = navbarRadius !== undefined ? `${navbarRadius}px` : "20px";
    wrapperPadding = "12px 16px";
    shellPadding = "10px 14px";
  }


  const customBorderColor = (props as any).navbar_border_color || theme?.navbar_border_color;
  const defaultOuterBorder = customBorderColor
    ? `1px solid ${customBorderColor}`
    : light
      ? "1px solid rgba(15,23,42,0.06)"
      : "1px solid rgba(255,255,255,0.05)";
  const defaultShellBorder = customBorderColor
    ? `1px solid ${customBorderColor}`
    : light
      ? "1px solid rgba(15,23,42,0.08)"
      : "1px solid rgba(255,255,255,0.08)";

  const outerBorder = hasCustomNavbarBorder
    ? `1px solid ${theme!.navbar_border_color!}`
    : defaultOuterBorder;
  const shellBorder = hasCustomNavbarBorder
    ? `1px solid ${theme!.navbar_border_color!}`
    : defaultShellBorder;


  const softSurface =
    variant === "transparent"
      ? "transparent"
      : light
        ? lightSoftSurface
        : darkSoftSurface;
  const softBorder = hasCustomNavbarBorder
    ? `1px solid ${theme!.navbar_border_color!}`
    : light
      ? "1px solid rgba(15,23,42,0.07)"
      : "1px solid rgba(255,255,255,0.08)";
  const iconButtonBg = softSurface;

  const effectiveShellBg = shellBg && shellBg !== "transparent" ? shellBg : (outerBackground && outerBackground !== "transparent" ? outerBackground : (light ? "#ffffff" : "#0f172a"));
  const isSearchBgDark = isColorDarkHex(effectiveShellBg);

  const searchDisplayMode = (props as any).search_display_mode || theme?.search_display_mode || "bar";
  const searchPlacement = (props as any).search_placement || theme?.search_placement || "center";
  const searchMaxWidthNum = (props as any).search_max_width || theme?.search_max_width || 460;
  const searchHeightNum = Math.max(26, Math.min(68, Number((props as any).search_height || theme?.search_height || 38)));
  const searchButtonSize = Math.max(22, searchHeightNum - 6);
  const searchClearSize = Math.max(18, searchHeightNum - 12);
  const searchIconSize = Math.max(13, Math.min(18, Math.round(searchHeightNum * 0.38)));
  const searchCustomTextColor = (props as any).search_text_color || theme?.search_text_color;
  const searchCustomMutedColor = (props as any).search_muted_text_color || theme?.search_muted_text_color;
  const searchCustomBg = (props as any).search_bg_color || theme?.search_bg_color;
  const searchCustomBorder = (props as any).search_border_color || theme?.search_border_color;

  const searchPillBg = searchCustomBg || (isSearchBgDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(15, 23, 42, 0.06)");
  const searchPillBorder = searchCustomBorder
    ? `1px solid ${searchCustomBorder}`
    : (isSearchBgDark
      ? "1px solid rgba(255, 255, 255, 0.18)"
      : "1px solid rgba(15, 23, 42, 0.12)");
  const searchTextColor = searchCustomTextColor || (isSearchBgDark ? "#ffffff" : "#0f172a");
  const searchPlaceholderColor = searchCustomMutedColor || (isSearchBgDark ? "rgba(255, 255, 255, 0.55)" : "rgba(15, 23, 42, 0.45)");
  const effectiveShowSearch = Boolean(showSearch);


  const resolvedWrapperPadding =
    navbarPaddingY !== undefined || navbarPaddingX !== undefined
      ? `${navbarPaddingY ?? 14}px ${navbarPaddingX ?? 16}px`
      : wrapperPadding;


  const resolvedShellPadding =
    navbarPaddingY !== undefined || navbarPaddingX !== undefined
      ? `${navbarPaddingY ?? 12}px ${navbarPaddingX ?? 16}px`
      : shellPadding;


  // --- Dynamic Action Icons & Buttons Styling ---
  const iconShape = (props as any).navbar_icon_shape || theme?.navbar_icon_shape || "rounded";
  const iconButtonSizeNum = Math.max(26, Math.min(56, Number((props as any).navbar_icon_size || theme?.navbar_icon_size || (isMobile ? 36 : 38))));
  const iconInnerSizeNum = Math.max(12, Math.min(32, Number((props as any).navbar_icon_inner_size || theme?.navbar_icon_inner_size || 18)));
  const iconStrokeWidthNum = Number((props as any).navbar_icon_stroke_width || theme?.navbar_icon_stroke_width || 2);
  const iconGapNum = Math.max(2, Math.min(28, Number((props as any).navbar_icon_gap || theme?.navbar_icon_gap || (isMobile ? 6 : 10))));

  const iconBorderEnabled = (props as any).navbar_icon_border_enabled !== undefined
    ? (props as any).navbar_icon_border_enabled
    : (theme?.navbar_icon_border_enabled !== undefined ? theme.navbar_icon_border_enabled : true);

  const iconBgEnabled = (props as any).navbar_icon_bg_enabled !== undefined
    ? (props as any).navbar_icon_bg_enabled
    : (theme?.navbar_icon_bg_enabled !== undefined ? theme.navbar_icon_bg_enabled : true);

  const iconCustomColor = (props as any).navbar_icon_color || theme?.navbar_icon_color;
  const iconCustomBg = (props as any).navbar_icon_bg_color || theme?.navbar_icon_bg_color;
  const iconCustomBorderColor = (props as any).navbar_icon_border_color || theme?.navbar_icon_border_color;

  let resolvedIconRadius = "8px";
  if (iconShape === "circle") resolvedIconRadius = "50%";
  else if (iconShape === "square") resolvedIconRadius = "3px";
  else if (iconShape === "ghost") resolvedIconRadius = "6px";
  else if (iconShape === "pill") resolvedIconRadius = "999px";

  const resolvedIconBg = !iconBgEnabled || iconShape === "ghost"
    ? "transparent"
    : (iconCustomBg || (light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)"));

  const resolvedIconBorder = !iconBorderEnabled || iconShape === "ghost"
    ? "none"
    : (iconCustomBorderColor ? `1px solid ${iconCustomBorderColor}` : softBorder);

  const resolvedIconColor = iconCustomColor || textColor;

  const actionButtonStyle: React.CSSProperties = {
    width: `${iconButtonSizeNum}px`,
    height: `${iconButtonSizeNum}px`,
    minWidth: `${iconButtonSizeNum}px`,
    minHeight: `${iconButtonSizeNum}px`,
    borderRadius: resolvedIconRadius,
    border: resolvedIconBorder,
    background: resolvedIconBg,
    color: resolvedIconColor,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
    boxSizing: "border-box",
    cursor: "pointer",
    flexShrink: 0,
    position: "relative",
    lineHeight: 0,
    outline: "none",
    verticalAlign: "middle",
    transition: "all 0.15s ease",
  };

  const actionIconSvgStyle: React.CSSProperties = {
    width: `${iconInnerSizeNum}px`,
    height: `${iconInnerSizeNum}px`,
    stroke: "currentColor",
    strokeWidth: iconStrokeWidthNum,
    fill: "none",
    display: "block",
    flexShrink: 0,
    margin: "auto",
  };

  const iconStyle = actionIconSvgStyle;

  const cartBadgeStyle: React.CSSProperties = {
    position: "absolute",
    top: "-2px",
    right: "-2px",
    minWidth: "16px",
    height: "16px",
    padding: "0 3px",
    borderRadius: "999px",
    background: (props as any).cart_badge_bg || theme?.cart_badge_bg || accentColor,
    color: (props as any).cart_badge_text_color || theme?.cart_badge_text_color || "#ffffff",
    fontSize: "9px",
    fontWeight: 800,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    pointerEvents: "none",
    zIndex: 2,
    boxSizing: "border-box",
  };

  const mobileMenuButtonStyle: React.CSSProperties = useMemo(
    () => ({
      width: `${iconButtonSizeNum}px`,
      height: `${iconButtonSizeNum}px`,
      borderRadius: resolvedIconRadius,
      border: resolvedIconBorder,
      background: mobileMenuOpen
        ? light
          ? "rgba(15,23,42,0.08)"
          : "rgba(255,255,255,0.10)"
        : resolvedIconBg,
      color: resolvedIconColor,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "all 160ms ease",
      flexShrink: 0,
    }),
    [iconButtonSizeNum, resolvedIconRadius, resolvedIconBorder, mobileMenuOpen, light, resolvedIconBg, resolvedIconColor]
  );
  // --- Dynamic Action Icons Visual Family & Variant Renderers ---
  const iconVisualFamily = ((props as any).navbar_icon_style || theme?.navbar_icon_style || "outline") as "outline" | "solid" | "duotone";
  const cartIconVariant = ((props as any).navbar_cart_icon_variant || theme?.navbar_cart_icon_variant || "cart") as "cart" | "bag" | "basket";
  const accountIconVariant = ((props as any).navbar_account_icon_variant || theme?.navbar_account_icon_variant || "user_clean") as "user_clean" | "user_circle" | "user_rounded";
  const notificationIconVariant = ((props as any).navbar_notification_icon_variant || theme?.navbar_notification_icon_variant || "bell") as "bell" | "bell_curved" | "bell_ring";
  const searchIconVariant = ((props as any).navbar_search_icon_variant || theme?.navbar_search_icon_variant || "magnifier") as "magnifier" | "search_minimal" | "search_round";

  const renderCartActionIcon = () => {
    if (cartIconVariant === "bag") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M7.5 6v1.5H16.5V6a4.5 4.5 0 0 0-9 0zm-2 1.5V6a6.5 6.5 0 0 1 13 0v1.5h1.25a2 2 0 0 1 1.99 2.22l-1.25 11.25A2 2 0 0 1 18.5 22.5H5.5a2 2 0 0 1-1.99-1.78L2.26 9.72A2 2 0 0 1 4.25 7.5H5.5z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
            <path d="M4 9h16l-1.5 12H5.5L4 9z" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <path d="M6 9V7a6 6 0 0 1 12 0v2" strokeLinecap="round" fill="none" />
            <path d="M4 9h16l-1.5 12H5.5L4 9z" strokeLinejoin="round" fill="none" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <path d="M6 9V7a6 6 0 0 1 12 0v2" strokeLinecap="round" />
          <path d="M4 9h16l-1.5 12H5.5L4 9z" strokeLinejoin="round" />
        </svg>
      );
    }

    if (cartIconVariant === "basket") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2.25a.75.75 0 0 1 .63.34l4.5 6.41h4.12a1.25 1.25 0 0 1 1.24 1.39l-1.5 10a1.25 1.25 0 0 1-1.24 1.11H4.25a1.25 1.25 0 0 1-1.24-1.11l-1.5-10a1.25 1.25 0 0 1 1.24-1.39h4.12l4.5-6.41a.75.75 0 0 1 .63-.34zm0 2.87L8.85 9h6.3L12 5.12z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
            <path d="M4 10h16l-1.5 10H5.5L4 10z" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <path d="M4 10h16l-1.5 10H5.5L4 10z" strokeLinejoin="round" fill="none" />
            <path d="M7 10l5-7 5 7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M12 10v10" strokeLinecap="round" fill="none" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <path d="M4 10h16l-1.5 10H5.5L4 10z" strokeLinejoin="round" />
          <path d="M7 10l5-7 5 7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 10v10" strokeLinecap="round" />
          <path d="M4 10h16" strokeLinecap="round" />
        </svg>
      );
    }

    // Default: Clean Rolling Shopping Cart
    if (iconVisualFamily === "solid") {
      return (
        <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
          <path d="M1 2.75A.75.75 0 0 1 1.75 2h3.5a.75.75 0 0 1 .73.58l.75 3.42h14.52a.75.75 0 0 1 .73.92l-2 8a.75.75 0 0 1-.73.58H8.89a.75.75 0 0 1-.73-.59L6.12 3.5H1.75A.75.75 0 0 1 1 2.75z" />
          <circle cx="9" cy="19.5" r="1.75" />
          <circle cx="17" cy="19.5" r="1.75" />
        </svg>
      );
    }
    if (iconVisualFamily === "duotone") {
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <path d="M6.5 6h15.2l-1.8 8.1a2 2 0 0 1-1.95 1.6H9.4a2 2 0 0 1-1.96-1.6L6.5 6z" fill="currentColor" fillOpacity="0.2" stroke="none" />
          <circle cx="9" cy="20" r="1.5" fill="currentColor" />
          <circle cx="17" cy="20" r="1.5" fill="currentColor" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const renderAccountActionIcon = () => {
    if (accountIconVariant === "user_circle") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm-6.2 13.1c.7-2.3 3.3-3.6 6.2-3.6s5.5 1.3 6.2 3.6A8 8 0 0 1 5.8 19.1z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
            <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <circle cx="12" cy="12" r="9" fill="none" />
            <circle cx="12" cy="10" r="3" fill="currentColor" stroke="none" />
            <path d="M6.2 18.5a7 7 0 0 1 11.6 0" strokeLinecap="round" fill="none" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6.2 18.5a7 7 0 0 1 11.6 0" strokeLinecap="round" />
        </svg>
      );
    }

    if (accountIconVariant === "user_rounded") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
            <circle cx="12" cy="7" r="4.25" />
            <path d="M4.5 19.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
            <circle cx="12" cy="8" r="4.25" fill="currentColor" fillOpacity="0.2" />
            <path d="M5 19.5a7 7 0 0 1 14 0" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <circle cx="12" cy="8" r="4.25" fill="none" />
            <path d="M5 19.5a7 7 0 0 1 14 0" strokeLinecap="round" fill="none" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <circle cx="12" cy="8" r="4.25" />
          <path d="M5 19.5a7 7 0 0 1 14 0" strokeLinecap="round" />
        </svg>
      );
    }

    // Default: Standard Clean User
    if (iconVisualFamily === "solid") {
      return (
        <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
          <circle cx="12" cy="7" r="4.5" />
          <path d="M4 19.5C4 16.5 7.5 14 12 14s8 2.5 8 5.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    }
    if (iconVisualFamily === "duotone") {
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <circle cx="12" cy="7" r="4" fill="currentColor" fillOpacity="0.2" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="currentColor" fillOpacity="0.2" stroke="none" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" fill="none" />
          <circle cx="12" cy="7" r="4" fill="none" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  };

  const renderNotificationActionIcon = () => {
    if (notificationIconVariant === "bell_curved") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
            <path d="M12 2a5 5 0 0 0-5 5c0 3.2-.6 6.3-1.8 7.9a.75.75 0 0 0 .6 1.1h16.4a.75.75 0 0 0 .6-1.1C21.6 13.3 21 10.2 21 7a5 5 0 0 0-5-5zm-2 17.5a2 2 0 0 0 4 0h-4z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
            <path d="M6 16h12c-1.5-2-2-5-2-8a4 4 0 1 0-8 0c0 3-.5 6-2 8z" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <path d="M6 16h12c-1.5-2-2-5-2-8a4 4 0 1 0-8 0c0 3-.5 6-2 8z" strokeLinejoin="round" fill="none" />
            <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" fill="none" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <path d="M6 16h12c-1.5-2-2-5-2-8a4 4 0 1 0-8 0c0 3-.5 6-2 8z" strokeLinejoin="round" />
          <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
        </svg>
      );
    }

    if (notificationIconVariant === "bell_ring") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
            <path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v.3c3.2.7 5 3.1 5 6.7v3.8c0 1.2.5 2 1.4 2.7.5.4.3 1.3-.4 1.3H4.5c-.7 0-.9-.9-.4-1.3.9-.7 1.4-1.5 1.4-2.7V10.5c0-3.6 1.8-6 5-6.7V3.5A1.5 1.5 0 0 1 12 2zm-2.5 17.5a2.5 2.5 0 0 0 5 0h-5z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" fill="none" />
            <path d="M4 4a8.5 8.5 0 0 0 0 10M20 4a8.5 8.5 0 0 1 0 10" strokeLinecap="round" fill="none" opacity="0.6" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
          <path d="M4 4a8.5 8.5 0 0 0 0 10M20 4a8.5 8.5 0 0 1 0 10" strokeLinecap="round" opacity="0.6" />
        </svg>
      );
    }

    // Default: Classic Bell
    if (iconVisualFamily === "solid") {
      return (
        <svg viewBox="0 0 24 24" style={{ ...actionIconSvgStyle, stroke: "none", fill: "currentColor" }}>
          <path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v.3c3.2.7 5 3.1 5 6.7v3.8c0 1.2.5 2 1.4 2.7.5.4.3 1.3-.4 1.3H4.5c-.7 0-.9-.9-.4-1.3.9-.7 1.4-1.5 1.4-2.7V10.5c0-3.6 1.8-6 5-6.7V3.5A1.5 1.5 0 0 1 12 2zm-2.5 17.5a2.5 2.5 0 0 0 5 0h-5z" />
        </svg>
      );
    }
    if (iconVisualFamily === "duotone") {
      return (
        <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="currentColor" fillOpacity="0.2" stroke="none" />
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" fill="none" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" style={actionIconSvgStyle}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
      </svg>
    );
  };

  const renderSearchActionIcon = (customSvgStyle?: React.CSSProperties) => {
    const activeSvgStyle = customSvgStyle || actionIconSvgStyle;
    
    if (searchIconVariant === "search_minimal") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...activeSvgStyle, stroke: "none", fill: "currentColor" }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M11 3.5a7.5 7.5 0 1 0 4.67 13.37l3.78 3.78a1 1 0 0 0 1.42-1.42l-3.78-3.78A7.5 7.5 0 0 0 11 3.5zm-5.5 7.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={activeSvgStyle}>
            <circle cx="11" cy="11" r="7" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <circle cx="11" cy="11" r="7" fill="none" />
            <path d="M16 16l4.5 4.5" strokeLinecap="round" fill="none" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={activeSvgStyle}>
          <circle cx="11" cy="11" r="7" />
          <path d="M16 16l4.5 4.5" strokeLinecap="round" />
        </svg>
      );
    }

    if (searchIconVariant === "search_round") {
      if (iconVisualFamily === "solid") {
        return (
          <svg viewBox="0 0 24 24" style={{ ...activeSvgStyle, stroke: "none", fill: "currentColor" }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M10.5 3a7.5 7.5 0 1 0 4.7 13.34l4.73 4.73a1 1 0 0 0 1.41-1.41l-4.73-4.73A7.5 7.5 0 0 0 10.5 3zm-5.5 7.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z" />
          </svg>
        );
      }
      if (iconVisualFamily === "duotone") {
        return (
          <svg viewBox="0 0 24 24" style={activeSvgStyle}>
            <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.2" stroke="none" />
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" />
            <path d="M15.5 15.5L20.5 20.5" strokeLinecap="round" fill="none" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 24 24" style={activeSvgStyle}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5L20.5 20.5" strokeLinecap="round" />
        </svg>
      );
    }

    // Default: Classic Search Lens
    if (iconVisualFamily === "solid") {
      return (
        <svg viewBox="0 0 24 24" style={{ ...activeSvgStyle, stroke: "none", fill: "currentColor" }}>
          <path fillRule="evenodd" clipRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.19 12.06l4.25 4.25a1 1 0 0 0 1.42-1.42l-4.25-4.25A6.75 6.75 0 0 0 10.5 3.75zm-4.75 6.75a4.75 4.75 0 1 1 9.5 0 4.75 4.75 0 0 1-9.5 0z" />
        </svg>
      );
    }
    if (iconVisualFamily === "duotone") {
      return (
        <svg viewBox="0 0 24 24" style={activeSvgStyle}>
          <circle cx="11" cy="11" r="8" fill="currentColor" fillOpacity="0.2" stroke="none" />
          <circle cx="11" cy="11" r="8" fill="none" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" fill="none" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" style={activeSvgStyle}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
      </svg>
    );
  };


  useEffect(() => {
    if (!siteSlug) return;
    // In builder workspace (any /builder/ route) or admin panel, the user is
    // an admin previewing/editing. Customer auth should never run here.
    if (!isStoreRoute) {
      clearUser(siteSlug);
      return;
    }
    refreshMe(siteSlug);
  }, [siteSlug, isStoreRoute, refreshMe, clearUser]);


  useEffect(() => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);


  useEffect(() => {
    if (!isCompact) {
      setMobileSearchOpen(false);
      setMobileMenuOpen(false);
    }
  }, [isCompact]);


  useEffect(() => {
    if (mobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (!searchActive && !mobileSearchOpen) return;
    const headerEl = document.getElementById("storefront-navbar");

    const updatePosition = () => {
      if (headerEl && window.visualViewport) {
        headerEl.style.top = `${window.visualViewport.offsetTop}px`;
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updatePosition);
      window.visualViewport.addEventListener("scroll", updatePosition);
      updatePosition();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updatePosition);
        window.visualViewport.removeEventListener("scroll", updatePosition);
      }
      if (headerEl) {
        headerEl.style.top = "";
      }
    };
  }, [searchActive, mobileSearchOpen]);


  useEffect(() => {
    if (!accountMenuOpen && !mobileMenuOpen) return;


    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedAccount =
        accountMenuRef.current?.contains(target) || accountButtonRef.current?.contains(target);
      const clickedMobileMenu =
        mobileMenuRef.current?.contains(target) || mobileMenuButtonRef.current?.contains(target);


      if (clickedAccount || clickedMobileMenu) return;
      setAccountMenuOpen(false);
      setMobileMenuOpen(false);
    };


    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
        accountButtonRef.current?.focus();
      }
    };


    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen, mobileMenuOpen]);


  const closeAccountMenu = () => setAccountMenuOpen(false);

  const handleGoToProfile = () => {
    closeAccountMenu();
    navigate(isBuilderAdminRoute ? `${base}/admin/profile` : `${base}/profile`);
  };

  const handleGoToOrders = () => {
    closeAccountMenu();
    navigate(isBuilderAdminRoute ? `${base}/admin/orders` : `${base}/orders`);
  };

  const handleCustomerLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Customer logout failed:", error);
    } finally {
      closeAccountMenu();
      navigate(`/store/${siteSlug}/login`, { replace: true });
    }
  };

  const handleDummyNotification = () => {
    window.console.log("Notification clicked");
  };

  const openSearch = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    setMobileSearchOpen(true);
    setSearchActive(true);
    setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 50);
  };
  const openMobileSearch = openSearch;

  const closeSearch = () => {
    setSearchQuery("");
    if (onSearch) {
      onSearch("");
    }
    const params = new URLSearchParams(location.search);
    if (params.has("search")) {
      params.delete("search");
      const searchStr = params.toString();
      const target = `${location.pathname}${searchStr ? `?${searchStr}` : ""}`;
      navigate(target, { replace: true });
    }
    setSearchActive(false);
    setMobileSearchOpen(false);
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const isBuilderContext = location.pathname.startsWith("/builder/");

  const handleAccountClick = () => {
    setMobileSearchOpen(false);
    setSearchActive(false);
    if (isAuthenticated || isBuilderAdminRoute || isBuilderContext) {
      setAccountMenuOpen((prev) => !prev);
      return;
    }
    if (siteSlug) {
      const storePrefix = `/store/${siteSlug}`;
      const safeFrom = location.pathname.startsWith(storePrefix) ? location.pathname : storePrefix;
      navigate(`/store/${siteSlug}/login`, {
        state: { from: safeFrom },
      });
    } else {
      setAccountMenuOpen((prev) => !prev);
    }
  };


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("search") || "";
    setSearchQuery(q);
  }, [location.search]);

  const handleHomeClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setSearchQuery("");
    if (onSearch) {
      onSearch("");
    }
    const currentSiteId = siteId || (location.pathname.startsWith("/builder/") ? location.pathname.split("/")[2] : undefined);
    const target = isBuilderContext || isBuilderAdminRoute
      ? (currentSiteId ? `/builder/${currentSiteId}` : base)
      : (siteSlug ? `/store/${siteSlug}` : resolvedHomePath);

    navigate(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const executeGlobalSearch = (query: string) => {
    const trimmed = query.trim();
    if (onSearch) {
      onSearch(trimmed);
    }
    const currentSiteId = siteId || (location.pathname.startsWith("/builder/") ? location.pathname.split("/")[2] : undefined);
    const homeBase = isBuilderContext || isBuilderAdminRoute
      ? (currentSiteId ? `/builder/${currentSiteId}` : base)
      : (siteSlug ? `/store/${siteSlug}` : resolvedHomePath);

    if (trimmed) {
      navigate(`${homeBase}?search=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(homeBase);
    }
    setSearchActive(false);
    setMobileSearchOpen(false);
  };

  const handleClearSearch = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSearchQuery("");
    executeGlobalSearch("");
  };

  const handleSearchInputChange = (val: string) => {
    setSearchQuery(val);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeGlobalSearch(searchQuery);
  };


  const dropdownBg = theme?.dialog_bg || theme?.surface_bg || theme?.primary_bg || (light ? "#ffffff" : "#0f172a");
  const dropdownBorderColor = (theme as any)?.border_color || (light ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)");

  const isDropdownLight = !isColorDarkHex(dropdownBg);
  const dropdownTextColor = isDropdownLight ? "#0f172a" : "#ffffff";
  const dropdownMutedText = isDropdownLight ? "#64748b" : "rgba(255,255,255,0.7)";
  const dropdownIconBg = isDropdownLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.08)";
  const dropdownIconBorder = isDropdownLight ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.12)";

  const menuItemStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 12px",
    borderRadius: "12px",
    border: "1px solid transparent",
    background: "transparent",
    color: dropdownTextColor,
    cursor: "pointer",
    textAlign: "left",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    transition: "background 160ms ease, border-color 160ms ease, transform 160ms ease",
  };

  const dropdownPanelStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 12px)",
    right: 0,
    width: isMobile ? "min(280px, calc(100vw - 32px))" : "248px",
    maxWidth: "calc(100vw - 32px)",
    padding: "10px",
    borderRadius: "18px",
    background: dropdownBg,
    border: `1px solid ${dropdownBorderColor}`,
    boxShadow: light
      ? "0 20px 45px rgba(15,23,42,0.14)"
      : "0 20px 45px rgba(0,0,0,0.45)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    zIndex: 99999,
  };

  const menuRowIconStyle: React.CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: dropdownIconBg,
    border: dropdownIconBorder,
    color: dropdownTextColor,
    flexShrink: 0,
  };

  const menuMetaTextStyle: React.CSSProperties = {
    fontSize: "11px",
    color: dropdownMutedText,
    marginTop: "2px",
    letterSpacing: "0.01em",
  };

  const menuArrowStyle: React.CSSProperties = {
    color: dropdownMutedText,
    fontSize: "14px",
    lineHeight: 1,
    flexShrink: 0,
  };


  const leftIconBtnBase: React.CSSProperties = {
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    border: softBorder,
    background: iconButtonBg,
    color: textColor,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    position: "relative",
  };


  const searchWrapStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    borderRadius: "999px",
    border: softBorder,
    background: light ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.05)",
    boxShadow: light ? "0 10px 24px rgba(15,23,42,0.08)" : "0 10px 24px rgba(0,0,0,0.18)",
    overflow: "hidden",
    flex: "1 1 260px",
    maxWidth: isMobile ? "100%" : "min(100%, 440px)",
  };

  {/* Festive motif inside search box — positioned towards the right side, auto-disappears when user is typing or search is narrow */}
  const renderSearchFestiveGraphic = () => {
    const festTheme = (theme as any)?.festival_theme;
    if (!festTheme || festTheme === "none" || (searchQuery && searchQuery.trim().length > 0) || Number(searchMaxWidthNum) < 280) {
      return null;
    }

    return (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "36px",
          top: 0,
          bottom: 0,
          height: "100%",
          width: "160px",
          maxWidth: "45%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          pointerEvents: "none",
          zIndex: 1,
          opacity: light ? 0.85 : 0.95,
          transition: "opacity 0.2s ease",
          overflow: "hidden",
        }}
      >
        {festTheme === "diwali" && (
          <DiwaliGraphics variant="navbar" isDark={!light} style={{ height: "90%", width: "auto" }} />
        )}
        {festTheme === "holi" && (
          <HoliGraphics variant="navbar" isDark={!light} style={{ height: "90%", width: "auto" }} />
        )}
        {festTheme === "durga_puja" && (
          <DurgaGraphics variant="navbar" isDark={!light} style={{ height: "90%", width: "auto" }} />
        )}
        {festTheme === "rakhi" && (
          <RakhiGraphics variant="navbar" isDark={!light} style={{ height: "90%", width: "auto" }} />
        )}
        {festTheme === "christmas" && (
          <ChristmasGraphics variant="navbar" isDark={!light} style={{ height: "90%", width: "auto" }} />
        )}
        {festTheme === "eid" && (
          <EidGraphics variant="navbar" isDark={!light} style={{ height: "90%", width: "auto" }} />
        )}
      </div>
    );
  };



  return (
    <header
      id="storefront-navbar"
      className={`storefront-navbar storefront-navbar--${position}`}
      data-navbar-position={position}
      onClick={(e) => {
        if (editMode && onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      style={{
        ...(position === "fixed" || searchActive || mobileSearchOpen || Boolean(isMobile && searchQuery.trim())
          ? { position: "fixed", top: 0, left: 0, right: 0, width: "100%", zIndex: 1000 }
          : position === "sticky"
            ? {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              width: "100%",
              zIndex: 1000,
              transform: isStickyVisible ? "translateY(0)" : "translateY(-100%)",
              transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease",
              boxShadow: isScrolledPastTop ? "0 4px 20px rgba(0, 0, 0, 0.08)" : "none",
            }
            : getNavbarPositionStyle(position, topOffset, fixedBounds)),
        padding: resolvedWrapperPadding,
        background: outerBackground,
        borderBottom: variant === "floating" ? "none" : outerBorder,
        boxSizing: "border-box",
        minHeight: `${navbarHeightNum}px`,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: accountMenuOpen || mobileMenuOpen ? 99999 : 1000,
        cursor: editMode ? "pointer" : undefined,
        overflow: "visible",
      }}
    >
      <style>{`
        #storefront-navbar input::placeholder {
          color: ${searchPlaceholderColor} !important;
          opacity: 0.85 !important;
        }
      `}</style>
      {/* Editor Selection Indicator for Non-Floating Navbars */}
      {editMode && variant !== "floating" && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: isSelected ? "2px solid #2563eb" : "1.5px dashed transparent",
              pointerEvents: "none",
              zIndex: 100001,
              transition: "all 0.15s ease",
              boxShadow: isSelected
                ? "inset 0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 0 3.5px rgba(37, 99, 235, 0.22)"
                : "none",
            }}
          />
          {isSelected && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: "-4px",
                  left: "-4px",
                  width: "7px",
                  height: "7px",
                  background: "#ffffff",
                  border: "1.5px solid #2563eb",
                  borderRadius: "2px",
                  zIndex: 100003,
                  pointerEvents: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "7px",
                  height: "7px",
                  background: "#ffffff",
                  border: "1.5px solid #2563eb",
                  borderRadius: "2px",
                  zIndex: 100003,
                  pointerEvents: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "-4px",
                  left: "-4px",
                  width: "7px",
                  height: "7px",
                  background: "#ffffff",
                  border: "1.5px solid #2563eb",
                  borderRadius: "2px",
                  zIndex: 100003,
                  pointerEvents: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "-4px",
                  right: "-4px",
                  width: "7px",
                  height: "7px",
                  background: "#ffffff",
                  border: "1.5px solid #2563eb",
                  borderRadius: "2px",
                  zIndex: 100003,
                  pointerEvents: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
              />
            </>
          )}
          <div
            style={{
              position: "absolute",
              top: "8px",
              left: "14px",
              zIndex: 100002,
              padding: "3px 10px 3px 8px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              pointerEvents: "none",
              opacity: isSelected ? 1 : 0,
              transform: isSelected ? "translateY(0)" : "translateY(4px)",
              transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 4px 14px rgba(15, 23, 42, 0.22), 0 1px 3px rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "5.5px",
                height: "5.5px",
                borderRadius: "50%",
                background: "#38bdf8",
                boxShadow: "0 0 6px rgba(56, 189, 248, 0.7)",
                flexShrink: 0,
              }}
            />
            Navbar
          </div>
        </>
      )}

      <div
        style={{
          width: "100%",
          minWidth: 0,
          maxWidth: navbarMaxWidth,
          minHeight: `${navbarHeightNum}px`,
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "visible",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "relative",
            padding: resolvedShellPadding,
            borderRadius: shellRadius,
            background: shellBg,
            border: variant === "transparent" || variant === "solid" ? "none" : shellBorder,
            boxShadow: shellBoxShadow,
            minHeight: `${navbarHeightNum}px`,
            width: "100%",
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box",
            minWidth: 0,
            overflow: "visible",
          }}
        >
          {/* Editor Selection Indicator for Floating Navbars */}
          {editMode && variant === "floating" && (
            <>
              <div
                style={{
                  position: "absolute",
                  inset: "-2px",
                  border: isSelected ? "2px solid #2563eb" : "1.5px dashed transparent",
                  borderRadius: `calc(${shellRadius} + 2px)`,
                  pointerEvents: "none",
                  zIndex: 100001,
                  transition: "all 0.15s ease",
                  boxShadow: isSelected
                    ? "0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 0 3.5px rgba(37, 99, 235, 0.22)"
                    : "none",
                }}
              />
              {isSelected && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: "-5px",
                      left: "-5px",
                      width: "7px",
                      height: "7px",
                      background: "#ffffff",
                      border: "1.5px solid #2563eb",
                      borderRadius: "2px",
                      zIndex: 100003,
                      pointerEvents: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "-5px",
                      right: "-5px",
                      width: "7px",
                      height: "7px",
                      background: "#ffffff",
                      border: "1.5px solid #2563eb",
                      borderRadius: "2px",
                      zIndex: 100003,
                      pointerEvents: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-5px",
                      left: "-5px",
                      width: "7px",
                      height: "7px",
                      background: "#ffffff",
                      border: "1.5px solid #2563eb",
                      borderRadius: "2px",
                      zIndex: 100003,
                      pointerEvents: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-5px",
                      right: "-5px",
                      width: "7px",
                      height: "7px",
                      background: "#ffffff",
                      border: "1.5px solid #2563eb",
                      borderRadius: "2px",
                      zIndex: 100003,
                      pointerEvents: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }}
                  />
                </>
              )}
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  left: "14px",
                  zIndex: 100002,
                  padding: "3px 10px 3px 8px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f8fafc",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  pointerEvents: "none",
                  opacity: isSelected ? 1 : 0,
                  transform: isSelected ? "translateY(0)" : "translateY(-4px)",
                  transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.22), 0 1px 3px rgba(0,0,0,0.12)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    width: "5.5px",
                    height: "5.5px",
                    borderRadius: "50%",
                    background: "#38bdf8",
                    boxShadow: "0 0 6px rgba(56, 189, 248, 0.7)",
                    flexShrink: 0,
                  }}
                />
                Navbar
              </div>
            </>
          )}
          {(() => {
            const rawLayout = (props as any).navbar_layout || theme?.navbar_layout;
            const layoutType = rawLayout || (variant === "glassmorphism" ? "glassmorphism_premium" : variant === "floating" ? "neo_modern" : variant === "solid" ? "modern_marketplace" : "apple_minimal");

            if (searchActive || mobileSearchOpen) {
              return (
                <form
                  onSubmit={handleSearchSubmit}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 8px 4px 14px",
                    borderRadius: "999px",
                    background: searchPillBg,
                    border: searchPillBorder,
                    boxSizing: "border-box",
                    position: "relative",
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: searchTextColor, strokeWidth: 2, fill: "none", flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20L16.65 16.65" />
                  </svg>
                  <input
                    ref={mobileSearchInputRef}
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: searchTextColor,
                      fontSize: "13px",
                      fontWeight: 500,
                      minWidth: 0,
                      paddingRight: searchQuery ? "28px" : "64px",
                    }}
                  />
                  {renderSearchFestiveGraphic()}
                  <button
                    type="button"
                    onClick={closeSearch}
                    aria-label="Close search"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "999px",
                      border: "none",
                      background: isSearchBgDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.08)",
                      color: searchTextColor,
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", stroke: "currentColor", strokeWidth: 2.2, fill: "none" }}>
                      <path d="M18 6L6 18" />
                      <path d="M6 6L18 18" />
                    </svg>
                  </button>
                </form>
              );
            }

            // Mobile toggle button renderer with anchored dropdown
            const renderMobileToggleBtn = () =>
              isMobile ? (
                <div ref={mobileMenuRef} style={{ position: "relative" }}>
                  <button
                    ref={mobileMenuButtonRef}
                    type="button"
                    aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileMenuOpen}
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    style={{
                      ...mobileMenuButtonStyle,
                      display: searchActive ? "none" : "flex",
                    }}
                  >
                    <svg viewBox="0 0 24 24" style={iconStyle}>
                      {mobileMenuOpen ? (
                        <>
                          <path d="M6 6L18 18" />
                          <path d="M18 6L6 18" />
                        </>
                      ) : (
                        <>
                          <path d="M4 7H20" />
                          <path d="M4 12H20" />
                          <path d="M4 17H20" />
                        </>
                      )}
                    </svg>
                  </button>
                  {mobileMenuOpen && (
                    <div
                      role="menu"
                      style={{
                        ...dropdownPanelStyle,
                        top: "calc(100% + 12px)",
                        right: 0,
                        width: "190px",
                      }}
                    >
                      <button
                        type="button"
                        style={menuItemStyle}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleDummyNotification();
                        }}
                      >
                        Notifications
                      </button>
                      <button
                        type="button"
                        style={menuItemStyle}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleGoToProfile();
                        }}
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        style={menuItemStyle}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleGoToOrders();
                        }}
                      >
                        Orders
                      </button>
                      {isAuthenticated ? (
                        <button
                          type="button"
                          style={{
                            ...menuItemStyle,
                            color: light ? "#dc2626" : "#f87171",
                          }}
                          onClick={() => {
                            setMobileMenuOpen(false);
                            handleCustomerLogout();
                          }}
                        >
                          Logout
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={menuItemStyle}
                          onClick={() => {
                            setMobileMenuOpen(false);
                            if (siteSlug) {
                              navigate(`/store/${siteSlug}/login`);
                            } else {
                              navigate(`/login`);
                            }
                          }}
                        >
                          Login/ Sign up
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : null;

            const renderBrandLogo = (customFallback?: React.ReactNode) => {
              const showLogo = brandDisplayMode === "both" || brandDisplayMode === "logo_only";
              if (!showLogo) return null;

              if (resolvedLogoUrl) {
                return (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: `${effectiveLogoSize}px`,
                      maxHeight: `${effectiveLogoSize}px`,
                      width: "auto",
                      maxWidth: "100%",
                      overflow: "hidden",
                      flexShrink: 0,
                      margin: 0,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    <img
                      src={resolvedLogoUrl}
                      alt={brandName || "Logo"}
                      style={{
                        height: `${effectiveLogoSize}px`,
                        maxHeight: `${effectiveLogoSize}px`,
                        maxWidth: "100%",
                        width: "auto",
                        objectFit: logoFitStyle || "contain",
                        transform: `scale(${logoZoomNum / 100})`,
                        transformOrigin: "center center",
                        transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                        display: "block",
                        flexShrink: 0,
                        mixBlendMode: logoBlendMode,
                      }}
                    />
                  </div>
                );
              }

              return customFallback || (
                <div
                  style={{
                    width: `${Math.min(36, effectiveLogoSize)}px`,
                    height: `${Math.min(36, effectiveLogoSize)}px`,
                    borderRadius: "10px",
                    background: light ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.08)",
                    border: softBorder,
                    color: brandTextColor,
                    display: "grid",
                    placeItems: "center",
                    fontSize: "12px",
                    fontWeight: 800,
                    flexShrink: 0,
                    margin: 0,
                  }}
                >
                  {getInitials(brandName)}
                </div>
              );
            };

            const renderBrandText = (extraStyle?: React.CSSProperties) => {
              const showText = brandDisplayMode === "both" || brandDisplayMode === "name_only";
              if (!showText) return null;

              const isCinzel = brandFontFamily === "cinzel_display" || brandFontFamily === "bold_display";
              const isSerif = brandFontFamily === "playfair_serif" || brandFontFamily === "elegant_serif" || brandFontFamily === "cormorant_serif" || brandFontFamily === "abril_fatface";

              return (
                <span
                  style={{
                    fontFamily: resolvedBrandFontFamily,
                    fontSize: isMobile ? `${Math.max(12, Math.round(brandFontSizeNum * 0.85))}px` : `${brandFontSizeNum}px`,
                    fontWeight: Number(brandFontWeight) || brandFontWeight || 700,
                    fontStyle: brandFontStyle === "italic" ? "italic" : "normal",
                    letterSpacing: isCinzel ? "0.08em" : (isSerif ? "0.04em" : "normal"),
                    textTransform: isCinzel ? "uppercase" : "none",
                    color: brandTextColor,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    lineHeight: 1.2,
                    ...extraStyle,
                  }}
                >
                  {brandName}
                </span>
              );
            };

            if (layoutType === "glassmorphism_premium") {
              const renderGlassBrand = () => {
                const showLogo = brandDisplayMode === "both" || brandDisplayMode === "logo_only";
                const showText = brandDisplayMode === "both" || brandDisplayMode === "name_only";
                const isColumn = brandLayoutDirection === "column" && showLogo && showText;

                return (
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{
                      display: "inline-flex",
                      flexDirection: isColumn ? "column" : "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: isColumn ? "2px" : "8px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                      flex: "0 0 auto",
                      minWidth: "max-content",
                      padding: 0,
                      margin: 0,
                      textDecoration: "none",
                      lineHeight: 1,
                    }}
                  >
                    {renderBrandLogo()}
                    {renderBrandText()}
                  </button>
                );
              };

              const renderGlassSearch = () => (
                <form
                  onSubmit={handleSearchSubmit}
                  style={{
                    flex: `0 1 ${searchMaxWidthNum}px`,
                    width: "100%",
                    maxWidth: `${searchMaxWidthNum}px`,
                    height: `${searchHeightNum}px`,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0 4px 0 14px",
                    borderRadius: "999px",
                    background: searchPillBg,
                    backdropFilter: "blur(10px)",
                    border: searchPillBorder,
                    position: "relative",
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontWeight: 500, paddingRight: searchQuery ? "4px" : "8px", boxSizing: "border-box" }}
                  />
                  {renderSearchFestiveGraphic()}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{ width: `${searchClearSize}px`, height: `${searchClearSize}px`, border: "none", background: "transparent", color: searchPlaceholderColor, opacity: 0.8, display: "grid", placeItems: "center", cursor: "pointer", fontSize: `${Math.max(11, searchClearSize - 10)}px`, flexShrink: 0 }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="submit"
                    style={{ width: `${searchButtonSize}px`, height: `${searchButtonSize}px`, borderRadius: "999px", border: "none", background: light ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: `${searchIconSize}px`, height: `${searchIconSize}px`, stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20L16.65 16.65" />
                    </svg>
                  </button>
                </form>
              );

              const renderGlassActions = () => (
                <div style={{ display: "flex", alignItems: "center", gap: `${iconGapNum}px`, flexShrink: 0 }}>
                  {effectiveShowSearch && (isMobile || searchDisplayMode === "icon") && (
                    <button
                      type="button"
                      aria-label="Open search"
                      onClick={openSearch}
                      style={actionButtonStyle}
                    >
                      {renderSearchActionIcon()}
                    </button>
                  )}
                  {showCart && (
                    <button
                      type="button"
                      onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                      style={actionButtonStyle}
                    >
                      {renderCartActionIcon()}
                      {cartCount > 0 && (
                        <span style={cartBadgeStyle}>
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}

                  {!isMobile && (
                    <button
                      type="button"
                      onClick={handleDummyNotification}
                      style={actionButtonStyle}
                    >
                      {renderNotificationActionIcon()}
                    </button>
                  )}

                  {showAccount && !isMobile && (
                    <div ref={accountMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        ref={accountButtonRef}
                        type="button"
                        onClick={handleAccountClick}
                        style={actionButtonStyle}
                      >
                        {renderAccountActionIcon()}
                      </button>
                      {accountMenuOpen && (
                        <div role="menu" style={dropdownPanelStyle}>
                          <button type="button" style={menuItemStyle} onClick={handleGoToProfile}>Profile</button>
                          <button type="button" style={menuItemStyle} onClick={handleGoToOrders}>Orders</button>
                          {isAuthenticated && <button type="button" style={menuItemStyle} onClick={handleCustomerLogout}>Logout</button>}
                        </div>
                      )}
                    </div>
                  )}

                  {renderMobileToggleBtn()}
                </div>
              );

              const glassContainerStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                minHeight: `${Math.max(48, navbarHeightNum - 20)}px`,
                gap: isMobile ? "8px" : "16px",
                padding: "8px 16px",
                background: light ? "rgba(255, 255, 255, 0.65)" : "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(20px)",
                borderRadius: "20px",
                border: light ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: light ? "0 8px 32px rgba(31, 38, 135, 0.08)" : "0 8px 32px rgba(0, 0, 0, 0.4)",
                boxSizing: "border-box",
              };

              const isBrandCentered = brandAlignment === "center" && !isMobile;

              if (isBrandCentered) {
                return (
                  <div style={glassContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement === "left" && renderGlassSearch()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", minWidth: 0 }}>
                      {renderGlassBrand()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0, gap: "10px" }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement !== "left" && renderGlassSearch()}
                      {renderGlassActions()}
                    </div>
                  </div>
                );
              }

              if (searchPlacement === "left") {
                return (
                  <div style={glassContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                      {renderGlassBrand()}
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderGlassSearch()}
                    </div>
                    {renderGlassActions()}
                  </div>
                );
              }

              if (searchPlacement === "right") {
                return (
                  <div style={glassContainerStyle}>
                    {renderGlassBrand()}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderGlassSearch()}
                      {renderGlassActions()}
                    </div>
                  </div>
                );
              }

              return (
                <div style={glassContainerStyle}>
                  <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-start", minWidth: 0 }}>
                    {renderGlassBrand()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: `0 1 ${searchMaxWidthNum}px`, width: "100%", maxWidth: `${searchMaxWidthNum}px`, minWidth: 0 }}>
                    {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderGlassSearch()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                    {renderGlassActions()}
                  </div>
                </div>
              );
            }

            if (layoutType === "modern_marketplace") {
              const renderMarketplaceBrand = () => {
                const showLogo = brandDisplayMode === "both" || brandDisplayMode === "logo_only";
                const showText = brandDisplayMode === "both" || brandDisplayMode === "name_only";
                const isColumn = brandLayoutDirection === "column" && showLogo && showText;

                return (
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{
                      display: "inline-flex",
                      flexDirection: isColumn ? "column" : "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: isColumn ? "2px" : "8px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                      flex: "0 0 auto",
                      minWidth: "max-content",
                      padding: 0,
                      margin: 0,
                      textDecoration: "none",
                      lineHeight: 1,
                    }}
                  >
                    {renderBrandLogo()}
                    {renderBrandText()}
                  </button>
                );
              };

              const renderMarketplaceSearch = () => (
                <form
                  onSubmit={handleSearchSubmit}
                  style={{
                    flex: `0 1 ${searchMaxWidthNum}px`,
                    width: "100%",
                    maxWidth: `${searchMaxWidthNum}px`,
                    height: `${searchHeightNum}px`,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "8px",
                    border: searchPillBorder,
                    background: searchPillBg,
                    overflow: "hidden",
                    position: "relative",
                    boxSizing: "border-box",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", padding: "0 12px", paddingRight: searchQuery ? "4px" : "8px", boxSizing: "border-box" }}
                  />
                  {renderSearchFestiveGraphic()}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{ width: `${searchClearSize}px`, height: `${searchClearSize}px`, border: "none", background: "transparent", color: searchPlaceholderColor, opacity: 0.8, display: "grid", placeItems: "center", cursor: "pointer", fontSize: `${Math.max(11, searchClearSize - 10)}px`, flexShrink: 0 }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="submit"
                    style={{ width: `${Math.max(34, searchHeightNum + 4)}px`, height: `${searchHeightNum}px`, border: "none", background: accentColor, color: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: `${searchIconSize}px`, height: `${searchIconSize}px`, stroke: "currentColor", strokeWidth: 2.2, fill: "none" }}>
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20L16.65 16.65" />
                    </svg>
                  </button>
                </form>
              );

              const renderMarketplaceActions = () => (
                <div style={{ display: "flex", alignItems: "center", gap: `${iconGapNum}px`, flexShrink: 0 }}>
                  {effectiveShowSearch && (isMobile || searchDisplayMode === "icon") && (
                    <button
                      type="button"
                      aria-label="Open search"
                      onClick={openSearch}
                      style={actionButtonStyle}
                    >
                      {renderSearchActionIcon()}
                    </button>
                  )}
                  {showCart && (
                    <button
                      type="button"
                      onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                      style={actionButtonStyle}
                    >
                      {renderCartActionIcon()}
                      {cartCount > 0 && (
                        <span style={cartBadgeStyle}>
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}

                  {!isMobile && (
                    <button
                      type="button"
                      onClick={handleDummyNotification}
                      style={actionButtonStyle}
                    >
                      {renderNotificationActionIcon()}
                    </button>
                  )}

                  {showAccount && !isMobile && (
                    <div ref={accountMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        ref={accountButtonRef}
                        type="button"
                        onClick={handleAccountClick}
                        style={actionButtonStyle}
                      >
                        {renderAccountActionIcon()}
                      </button>
                      {accountMenuOpen && (
                        <div role="menu" style={dropdownPanelStyle}>
                          <button type="button" style={menuItemStyle} onClick={handleGoToProfile}>Profile</button>
                          <button type="button" style={menuItemStyle} onClick={handleGoToOrders}>Orders</button>
                          {isAuthenticated && <button type="button" style={menuItemStyle} onClick={handleCustomerLogout}>Logout</button>}
                        </div>
                      )}
                    </div>
                  )}

                  {renderMobileToggleBtn()}
                </div>
              );

              const marketplaceContainerStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                minHeight: `${Math.max(48, navbarHeightNum - 20)}px`,
                gap: isMobile ? "8px" : "16px",
                padding: "8px 14px",
                boxSizing: "border-box",
              };

              const isBrandCentered = brandAlignment === "center" && !isMobile;

              if (isBrandCentered) {
                return (
                  <div style={marketplaceContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement === "left" && renderMarketplaceSearch()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", minWidth: 0 }}>
                      {renderMarketplaceBrand()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0, gap: "10px" }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement !== "left" && renderMarketplaceSearch()}
                      {renderMarketplaceActions()}
                    </div>
                  </div>
                );
              }

              if (searchPlacement === "left") {
                return (
                  <div style={marketplaceContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                      {renderMarketplaceBrand()}
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderMarketplaceSearch()}
                    </div>
                    {renderMarketplaceActions()}
                  </div>
                );
              }

              if (searchPlacement === "right") {
                return (
                  <div style={marketplaceContainerStyle}>
                    {renderMarketplaceBrand()}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderMarketplaceSearch()}
                      {renderMarketplaceActions()}
                    </div>
                  </div>
                );
              }

              return (
                <div style={marketplaceContainerStyle}>
                  <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-start", minWidth: 0 }}>
                    {renderMarketplaceBrand()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: `0 1 ${searchMaxWidthNum}px`, width: "100%", maxWidth: `${searchMaxWidthNum}px`, minWidth: 0 }}>
                    {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderMarketplaceSearch()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                    {renderMarketplaceActions()}
                  </div>
                </div>
              );
            }

            if (layoutType === "luxury_fashion") {
              const renderLuxuryBrand = () => {
                const showLogo = brandDisplayMode === "both" || brandDisplayMode === "logo_only";
                const showText = brandDisplayMode === "both" || brandDisplayMode === "name_only";
                const isColumn = brandLayoutDirection === "column" && showLogo && showText;

                return (
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{
                      display: "inline-flex",
                      flexDirection: isColumn ? "column" : "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: isColumn ? "2px" : isMobile ? "8px" : "12px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                      flex: "0 0 auto",
                      minWidth: "max-content",
                      padding: 0,
                      margin: 0,
                      textDecoration: "none",
                      lineHeight: 1,
                    }}
                  >
                    {renderBrandLogo(
                      <span
                        style={{
                          fontFamily: resolvedBrandFontFamily,
                          fontSize: isMobile ? "16px" : "20px",
                          fontWeight: 700,
                          color: brandTextColor,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(brandName)}
                      </span>
                    )}
                    {showLogo && showText && !isColumn && (
                      <span style={{ width: "1px", height: "18px", background: light ? "rgba(15,23,42,0.15)" : "rgba(255,255,255,0.2)" }} />
                    )}
                    {renderBrandText({
                      letterSpacing: brandFontFamily === "modern_sans" ? "0.06em" : "0.12em",
                      textTransform: "uppercase",
                    })}
                  </button>
                );
              };

              const renderLuxurySearch = () => (
                <form
                  onSubmit={handleSearchSubmit}
                  style={{
                    flex: `0 1 ${searchMaxWidthNum}px`,
                    width: "100%",
                    maxWidth: `${searchMaxWidthNum}px`,
                    height: `${searchHeightNum}px`,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0 4px 0 14px",
                    borderRadius: "999px",
                    background: searchPillBg,
                    border: searchPillBorder,
                    position: "relative",
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontFamily: "serif", paddingRight: searchQuery ? "4px" : "8px", boxSizing: "border-box" }}
                  />
                  {renderSearchFestiveGraphic()}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{ width: `${searchClearSize}px`, height: `${searchClearSize}px`, border: "none", background: "transparent", color: searchPlaceholderColor, opacity: 0.8, display: "grid", placeItems: "center", cursor: "pointer", fontSize: `${Math.max(11, searchClearSize - 10)}px`, flexShrink: 0 }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="submit"
                    style={{ width: `${searchButtonSize}px`, height: `${searchButtonSize}px`, borderRadius: "999px", border: "none", background: "transparent", color: searchTextColor, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: `${searchIconSize}px`, height: `${searchIconSize}px`, stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}>
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20L16.65 16.65" />
                    </svg>
                  </button>
                </form>
              );

              const renderLuxuryActions = () => (
                <div style={{ display: "flex", alignItems: "center", gap: `${iconGapNum}px`, flexShrink: 0 }}>
                  {effectiveShowSearch && (isMobile || searchDisplayMode === "icon") && (
                    <button
                      type="button"
                      aria-label="Open search"
                      onClick={openSearch}
                      style={actionButtonStyle}
                    >
                      {renderSearchActionIcon()}
                    </button>
                  )}
                  {showCart && (
                    <button
                      type="button"
                      onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                      style={actionButtonStyle}
                    >
                      {renderCartActionIcon()}
                      {cartCount > 0 && (
                        <span style={cartBadgeStyle}>
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}

                  {!isMobile && (
                    <button
                      type="button"
                      onClick={handleDummyNotification}
                      style={actionButtonStyle}
                    >
                      {renderNotificationActionIcon()}
                    </button>
                  )}

                  {showAccount && !isMobile && (
                    <div ref={accountMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        ref={accountButtonRef}
                        type="button"
                        onClick={handleAccountClick}
                        style={actionButtonStyle}
                      >
                        {renderAccountActionIcon()}
                      </button>
                      {accountMenuOpen && (
                        <div role="menu" style={dropdownPanelStyle}>
                          <button type="button" style={menuItemStyle} onClick={handleGoToProfile}>Profile</button>
                          <button type="button" style={menuItemStyle} onClick={handleGoToOrders}>Orders</button>
                          {isAuthenticated && <button type="button" style={menuItemStyle} onClick={handleCustomerLogout}>Logout</button>}
                        </div>
                      )}
                    </div>
                  )}

                  {renderMobileToggleBtn()}
                </div>
              );

              const luxuryContainerStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                minHeight: `${Math.max(48, navbarHeightNum - 20)}px`,
                gap: isMobile ? "8px" : "16px",
                padding: "8px 18px",
                boxSizing: "border-box",
              };

              const isBrandCentered = brandAlignment === "center" && !isMobile;

              if (isBrandCentered) {
                return (
                  <div style={luxuryContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement === "left" && renderLuxurySearch()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", minWidth: 0 }}>
                      {renderLuxuryBrand()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0, gap: "10px" }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement !== "left" && renderLuxurySearch()}
                      {renderLuxuryActions()}
                    </div>
                  </div>
                );
              }

              if (searchPlacement === "left") {
                return (
                  <div style={luxuryContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                      {renderLuxuryBrand()}
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderLuxurySearch()}
                    </div>
                    {renderLuxuryActions()}
                  </div>
                );
              }

              if (searchPlacement === "right") {
                return (
                  <div style={luxuryContainerStyle}>
                    {renderLuxuryBrand()}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderLuxurySearch()}
                      {renderLuxuryActions()}
                    </div>
                  </div>
                );
              }

              return (
                <div style={luxuryContainerStyle}>
                  <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-start", minWidth: 0 }}>
                    {renderLuxuryBrand()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: `0 1 ${searchMaxWidthNum}px`, width: "100%", maxWidth: `${searchMaxWidthNum}px`, minWidth: 0 }}>
                    {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderLuxurySearch()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                    {renderLuxuryActions()}
                  </div>
                </div>
              );
            }

            if (layoutType === "neo_modern") {
              const customNavBg = (props as any).navbar_bg || theme?.navbar_bg;
              const customTextColor = (props as any).navbar_text_color || theme?.navbar_text_color;
              const neoBg = customNavBg || (light ? "#f0f4f9" : "#1e293b");
              const neoTextColor = customTextColor || (light ? "#0f172a" : "#ffffff");
              const outerShadow = light
                ? "6px 6px 14px rgba(166,180,200,0.4), -6px -6px 14px rgba(255,255,255,0.9)"
                : "6px 6px 14px rgba(0,0,0,0.5), -6px -6px 14px rgba(255,255,255,0.05)";
              const insetShadow = light
                ? "inset 2px 2px 5px rgba(166,180,200,0.4), inset -2px -2px 5px rgba(255,255,255,0.9)"
                : "inset 2px 2px 5px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(255,255,255,0.05)";
              const buttonShadow = light
                ? "3px 3px 6px rgba(166,180,200,0.4), -3px -3px 6px rgba(255,255,255,0.9)"
                : "3px 3px 6px rgba(0,0,0,0.4), -3px -3px 6px rgba(255,255,255,0.05)";

              const renderNeoBrand = () => {
                const showLogo = brandDisplayMode === "both" || brandDisplayMode === "logo_only";
                const showText = brandDisplayMode === "both" || brandDisplayMode === "name_only";
                const isColumn = brandLayoutDirection === "column" && showLogo && showText;

                return (
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{
                      display: "inline-flex",
                      flexDirection: isColumn ? "column" : "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: isColumn ? "2px" : "8px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                      flex: "0 0 auto",
                      minWidth: "max-content",
                      padding: 0,
                      margin: 0,
                      textDecoration: "none",
                      lineHeight: 1,
                    }}
                  >
                    {renderBrandLogo(
                      <div
                        style={{
                          width: `${Math.min(36, effectiveLogoSize)}px`,
                          height: `${Math.min(36, effectiveLogoSize)}px`,
                          borderRadius: "10px",
                          background: neoBg,
                          boxShadow: buttonShadow,
                          color: brandCustomTextColor || neoTextColor,
                          display: "grid",
                          placeItems: "center",
                          fontSize: "12px",
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(brandName)}
                      </div>
                    )}
                    {renderBrandText({
                      color: brandCustomTextColor || neoTextColor,
                    })}
                  </button>
                );
              };

              const renderNeoSearch = () => (
                <form
                  onSubmit={handleSearchSubmit}
                  style={{
                    flex: `0 1 ${searchMaxWidthNum}px`,
                    width: "100%",
                    maxWidth: `${searchMaxWidthNum}px`,
                    height: `${searchHeightNum}px`,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0 4px 0 14px",
                    borderRadius: "999px",
                    background: searchCustomBg || neoBg,
                    boxShadow: insetShadow,
                    border: searchCustomBorder ? `1px solid ${searchCustomBorder}` : "none",
                    position: "relative",
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontWeight: 500, paddingRight: searchQuery ? "4px" : "8px", boxSizing: "border-box" }}
                  />
                  {renderSearchFestiveGraphic()}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{ width: `${searchClearSize}px`, height: `${searchClearSize}px`, border: "none", background: "transparent", color: searchPlaceholderColor, opacity: 0.8, display: "grid", placeItems: "center", cursor: "pointer", fontSize: `${Math.max(11, searchClearSize - 10)}px`, flexShrink: 0 }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="submit"
                    style={{ width: `${searchButtonSize}px`, height: `${searchButtonSize}px`, borderRadius: "999px", border: "none", background: neoBg, boxShadow: buttonShadow, color: neoTextColor, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                  >
                    <svg viewBox="0 0 24 24" style={{ width: `${searchIconSize}px`, height: `${searchIconSize}px`, stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20L16.65 16.65" />
                    </svg>
                  </button>
                </form>
              );

              const renderNeoActions = () => (
                <div style={{ display: "flex", alignItems: "center", gap: `${iconGapNum}px`, flexShrink: 0 }}>
                  {effectiveShowSearch && (isMobile || searchDisplayMode === "icon") && (
                    <button
                      type="button"
                      aria-label="Open search"
                      onClick={openSearch}
                      style={actionButtonStyle}
                    >
                      {renderSearchActionIcon()}
                    </button>
                  )}
                  {showCart && (
                    <button
                      type="button"
                      onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                      style={actionButtonStyle}
                    >
                      {renderCartActionIcon()}
                      {cartCount > 0 && (
                        <span style={cartBadgeStyle}>
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}

                  {!isMobile && (
                    <button
                      type="button"
                      onClick={handleDummyNotification}
                      style={actionButtonStyle}
                    >
                      {renderNotificationActionIcon()}
                    </button>
                  )}

                  {showAccount && !isMobile && (
                    <div ref={accountMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        ref={accountButtonRef}
                        type="button"
                        onClick={handleAccountClick}
                        style={actionButtonStyle}
                      >
                        {renderAccountActionIcon()}
                      </button>
                      {accountMenuOpen && (
                        <div role="menu" style={dropdownPanelStyle}>
                          <button type="button" style={menuItemStyle} onClick={handleGoToProfile}>Profile</button>
                          <button type="button" style={menuItemStyle} onClick={handleGoToOrders}>Orders</button>
                          {isAuthenticated && <button type="button" style={menuItemStyle} onClick={handleCustomerLogout}>Logout</button>}
                        </div>
                      )}
                    </div>
                  )}

                  {renderMobileToggleBtn()}
                </div>
              );

              const neoContainerStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                minHeight: `${Math.max(48, navbarHeightNum - 20)}px`,
                gap: isMobile ? "8px" : "16px",
                padding: "8px 18px",
                background: neoBg,
                borderRadius: "999px",
                boxShadow: outerShadow,
                boxSizing: "border-box",
              };

              const isBrandCentered = brandAlignment === "center" && !isMobile;

              if (isBrandCentered) {
                return (
                  <div style={neoContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement === "left" && renderNeoSearch()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", minWidth: 0 }}>
                      {renderNeoBrand()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0, gap: "10px" }}>
                      {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement !== "left" && renderNeoSearch()}
                      {renderNeoActions()}
                    </div>
                  </div>
                );
              }

              if (searchPlacement === "left") {
                return (
                  <div style={neoContainerStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                      {renderNeoBrand()}
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderNeoSearch()}
                    </div>
                    {renderNeoActions()}
                  </div>
                );
              }

              if (searchPlacement === "right") {
                return (
                  <div style={neoContainerStyle}>
                    {renderNeoBrand()}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                      {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderNeoSearch()}
                      {renderNeoActions()}
                    </div>
                  </div>
                );
              }

              return (
                <div style={neoContainerStyle}>
                  <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-start", minWidth: 0 }}>
                    {renderNeoBrand()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: `0 1 ${searchMaxWidthNum}px`, width: "100%", maxWidth: `${searchMaxWidthNum}px`, minWidth: 0 }}>
                    {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderNeoSearch()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                    {renderNeoActions()}
                  </div>
                </div>
              );
            }

            // Apple Minimal & Default Standard Layout
            const renderDefaultBrand = () => {
              const showLogo = brandDisplayMode === "both" || brandDisplayMode === "logo_only";
              const showText = brandDisplayMode === "both" || brandDisplayMode === "name_only";
              const isColumn = brandLayoutDirection === "column" && showLogo && showText;

              return (
                <button
                  type="button"
                  onClick={handleHomeClick}
                  style={{
                    display: "inline-flex",
                    flexDirection: isColumn ? "column" : "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: isColumn ? "2px" : "8px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    flex: "0 0 auto",
                    minWidth: "max-content",
                    padding: 0,
                    margin: 0,
                    textDecoration: "none",
                    lineHeight: 1,
                  }}
                >
                  {renderBrandLogo()}
                  {renderBrandText()}
                </button>
              );
            };

            const renderDefaultSearch = () => (
              <form
                onSubmit={handleSearchSubmit}
                style={{
                  flex: `0 1 ${searchMaxWidthNum}px`,
                  width: "100%",
                  maxWidth: `${searchMaxWidthNum}px`,
                  height: `${searchHeightNum}px`,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0 4px 0 14px",
                  borderRadius: "999px",
                  background: searchPillBg,
                  border: searchPillBorder,
                  position: "relative",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  style={{ flex: 1, minWidth: 0, width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontWeight: 500, paddingRight: searchQuery ? "4px" : "8px", boxSizing: "border-box" }}
                />
                {renderSearchFestiveGraphic()}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{ width: `${searchClearSize}px`, height: `${searchClearSize}px`, border: "none", background: "transparent", color: searchPlaceholderColor, opacity: 0.8, display: "grid", placeItems: "center", cursor: "pointer", fontSize: `${Math.max(11, searchClearSize - 10)}px`, flexShrink: 0 }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  style={{ width: `${searchButtonSize}px`, height: `${searchButtonSize}px`, borderRadius: "999px", border: "none", background: isSearchBgDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.08)", color: searchTextColor, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: `${searchIconSize}px`, height: `${searchIconSize}px`, stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20L16.65 16.65" />
                  </svg>
                </button>
              </form>
            );

            const renderDefaultActions = () => (
              <div style={{ display: "flex", alignItems: "center", gap: `${iconGapNum}px`, flexShrink: 0 }}>
                {effectiveShowSearch && (isMobile || searchDisplayMode === "icon") && (
                  <button
                    type="button"
                    aria-label="Open search"
                    onClick={openSearch}
                    style={actionButtonStyle}
                  >
                    {renderSearchActionIcon()}
                  </button>
                )}
                {showCart && (
                  <button
                    type="button"
                    onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                    style={actionButtonStyle}
                  >
                    {renderCartActionIcon()}
                    {cartCount > 0 && (
                      <span style={cartBadgeStyle}>
                        {cartCount}
                      </span>
                    )}
                  </button>
                )}

                {!isMobile && (
                  <button
                    type="button"
                    onClick={handleDummyNotification}
                    style={actionButtonStyle}
                  >
                    {renderNotificationActionIcon()}
                  </button>
                )}

                {showAccount && !isMobile && (
                  <div ref={accountMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      ref={accountButtonRef}
                      type="button"
                      onClick={handleAccountClick}
                      style={actionButtonStyle}
                    >
                      {renderAccountActionIcon()}
                    </button>
                    {accountMenuOpen && (
                      <div role="menu" style={dropdownPanelStyle}>
                        <button type="button" style={menuItemStyle} onClick={handleGoToProfile}>Profile</button>
                        <button type="button" style={menuItemStyle} onClick={handleGoToOrders}>Orders</button>
                        {isAuthenticated && <button type="button" style={menuItemStyle} onClick={handleCustomerLogout}>Logout</button>}
                      </div>
                    )}
                  </div>
                )}

                {renderMobileToggleBtn()}
              </div>
            );

            const defaultContainerStyle: React.CSSProperties = {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              minHeight: `${Math.max(48, navbarHeightNum - 20)}px`,
              gap: isMobile ? "8px" : "16px",
              padding: "8px 14px",
              boxSizing: "border-box",
            };

            const isBrandCentered = brandAlignment === "center" && !isMobile;

            if (isBrandCentered) {
              return (
                <div style={defaultContainerStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", flex: 1, minWidth: 0 }}>
                    {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement === "left" && renderDefaultSearch()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", minWidth: 0 }}>
                    {renderDefaultBrand()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0, gap: "10px" }}>
                    {effectiveShowSearch && searchDisplayMode === "bar" && searchPlacement !== "left" && renderDefaultSearch()}
                    {renderDefaultActions()}
                  </div>
                </div>
              );
            }

            if (searchPlacement === "left") {
              return (
                <div style={defaultContainerStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                    {renderDefaultBrand()}
                    {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderDefaultSearch()}
                  </div>
                  {renderDefaultActions()}
                </div>
              );
            }

            if (searchPlacement === "right") {
              return (
                <div style={defaultContainerStyle}>
                  {renderDefaultBrand()}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                    {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderDefaultSearch()}
                    {renderDefaultActions()}
                  </div>
                </div>
              );
            }

            return (
              <div style={defaultContainerStyle}>
                <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-start", minWidth: 0 }}>
                  {renderDefaultBrand()}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: `0 1 ${searchMaxWidthNum}px`, width: "100%", maxWidth: `${searchMaxWidthNum}px`, minWidth: 0 }}>
                  {effectiveShowSearch && !isMobile && searchDisplayMode === "bar" && renderDefaultSearch()}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
                  {renderDefaultActions()}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </header>
  );
};


export default Navbar;
