import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";


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
  navbar_padding_y?: number;
  logo_height?: number | string;
  logo_fit?: "contain" | "cover";
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
    return { position: "relative", zIndex: 20 };
  }

  if (position === "fixed") {
    if (fixedBounds) {
      return {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 500,
      };
    }

    return {
      position: "fixed",
      top: `${topOffset}px`,
      left: 0,
      width: "100%",
      right: "auto",
      zIndex: 500,
    };
  }

  return { position: "sticky", top: `${topOffset}px`, zIndex: 500 };
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
    brandName = "Storefront",
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
  const variant = theme?.navbar_variant || "soft";
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
        document.querySelector("[data-storefront-canvas]"),
        document.querySelector("#builder-canvas-viewport"),
        document.querySelector(".builder-main-viewport"),
        document.querySelector("main"),
      ];
      for (const cand of candidates) {
        if (cand && cand.scrollHeight > cand.clientHeight + 10) {
          return cand;
        }
      }
      return window;
    };

    const target = findScrollContainer();

    const handleScroll = () => {
      const currentScrollY =
        target === window
          ? window.scrollY || document.documentElement.scrollTop
          : (target as Element).scrollTop;

      const diff = currentScrollY - lastScrollYRef.current;

      if (currentScrollY > 60) {
        setIsScrolledPastTop(true);
        if (diff > 4) {
          // Scrolling DOWN -> Hide navbar
          setIsStickyVisible(false);
        } else if (diff < -4) {
          // Scrolling UP -> Reveal navbar & stick to top
          setIsStickyVisible(true);
        }
      } else {
        // At or near top of page
        setIsScrolledPastTop(false);
        setIsStickyVisible(true);
      }

      lastScrollYRef.current = currentScrollY;
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      target.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [position]);
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

  const logoHeightStyle = theme?.logo_height ? `${theme.logo_height}px` : "32px";
  const logoFitStyle = (theme?.logo_fit as any) || "contain";

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


  const navbarHeight = theme?.navbar_height ?? 72;
  const navbarMaxWidth = String(theme?.navbar_max_width) === "full" ? "100%" : `${theme?.navbar_max_width ?? 1280}px`;
  const navbarRadius = theme?.navbar_radius;
  const navbarPaddingX = theme?.navbar_padding_x;
  const navbarPaddingY = theme?.navbar_padding_y;


  const resolvedLogoUrl = props.logoUrl || props.logo_url || (props as any).logo;

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

  const searchPillBg = isSearchBgDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(15, 23, 42, 0.06)";
  const searchPillBorder = isSearchBgDark
    ? "1px solid rgba(255, 255, 255, 0.18)"
    : "1px solid rgba(15, 23, 42, 0.12)";
  const searchTextColor = isSearchBgDark ? "#ffffff" : "#0f172a";


  const resolvedWrapperPadding =
    navbarPaddingY !== undefined || navbarPaddingX !== undefined
      ? `${navbarPaddingY ?? 14}px ${navbarPaddingX ?? 16}px`
      : wrapperPadding;


  const resolvedShellPadding =
    navbarPaddingY !== undefined || navbarPaddingX !== undefined
      ? `${Math.max(8, navbarPaddingY ?? 12)}px ${Math.max(10, navbarPaddingX ?? 14)}px`
      : shellPadding;


  const mobileMenuButtonStyle: React.CSSProperties = useMemo(
    () => ({
      width: "42px",
      height: "42px",
      borderRadius: "14px",
      border: softBorder,
      background: mobileMenuOpen
        ? light
          ? "rgba(15,23,42,0.08)"
          : "rgba(255,255,255,0.10)"
        : iconButtonBg,
      color: textColor,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "all 160ms ease",
      flexShrink: 0,
    }),
    [softBorder, mobileMenuOpen, light, iconButtonBg, textColor]
  );


  useEffect(() => {
    if (!siteSlug) return;
    if (isBuilderAdminRoute) {
      clearUser();
      return;
    }
    if (!isStoreRoute && !location.pathname.startsWith("/builder/")) return;
    refreshMe(siteSlug);
  }, [siteSlug, location.pathname, refreshMe, isBuilderAdminRoute, isStoreRoute, clearUser]);


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

  const openMobileSearch = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    setMobileSearchOpen(true);
    setSearchActive(true);
    setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 50);
  };

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

    navigate(target, { replace: true });
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
    zIndex: 400,
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



  return (
    <header
      id="storefront-navbar"
      className={`storefront-navbar storefront-navbar--${position}`}
      data-navbar-position={position}
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
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          minWidth: 0,
          maxWidth: navbarMaxWidth,
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            padding: resolvedShellPadding,
            borderRadius: shellRadius,
            background: shellBg,
            border: variant === "transparent" || variant === "solid" ? "none" : shellBorder,
            boxShadow: shellBoxShadow,
            minHeight: `${navbarHeight}px`,
            width: "100%",
            boxSizing: "border-box",
            minWidth: 0,
          }}
        >
          {(() => {
            const layoutType = theme?.navbar_layout || "apple_minimal";

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
                    }}
                  />
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

            if (layoutType === "glassmorphism_premium") {
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: isMobile ? "8px" : "16px", padding: "6px 14px", background: light ? "rgba(255, 255, 255, 0.65)" : "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(20px)", borderRadius: "20px", border: light ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)", boxShadow: light ? "0 8px 32px rgba(31, 38, 135, 0.08)" : "0 8px 32px rgba(0, 0, 0, 0.4)", boxSizing: "border-box" }}>
                  {/* Brand */}
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{ display: "flex", alignItems: "center", gap: "10px", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }}
                  >
                    {resolvedLogoUrl ? (
                      <img
                        src={resolvedLogoUrl}
                        alt={brandName || "Logo"}
                        style={{ maxHeight: logoHeightStyle, height: logoHeightStyle, maxWidth: "160px", objectFit: logoFitStyle, flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: light ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.12)", border: light ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.15)", color: textColor, display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 800, flexShrink: 0 }}>
                        {getInitials(brandName)}
                      </div>
                    )}
                    <span style={{ fontSize: isMobile ? "14px" : "15px", fontWeight: 700, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName}</span>
                  </button>

                  {/* Glass Pill Search */}
                  {showSearch && !isMobile && (
                    <form
                      onSubmit={handleSearchSubmit}
                      style={{
                        flex: "1 1 240px",
                        maxWidth: "460px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "4px 4px 4px 16px",
                        borderRadius: "999px",
                        background: searchPillBg,
                        backdropFilter: "blur(10px)",
                        border: searchPillBorder,
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontWeight: 500 }}
                      />
                      <button
                        type="submit"
                        style={{ width: "32px", height: "32px", borderRadius: "999px", border: "none", background: light ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    </form>
                  )}

                  {/* Glass Action Icons */}
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px" }}>
                    {showSearch && isMobile && (
                      <button
                        type="button"
                        aria-label="Open search"
                        onClick={openMobileSearch}
                        style={{ width: "38px", height: "38px", borderRadius: "999px", border: light ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.15)", background: light ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.08)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    )}
                    {showCart && (
                      <button
                        type="button"
                        onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                        style={{ width: "38px", height: "38px", borderRadius: "999px", border: light ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.15)", background: light ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.08)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer", position: "relative" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "17px", height: "17px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                          <circle cx="9" cy="20" r="1.5" />
                          <circle cx="17" cy="20" r="1.5" />
                          <path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" />
                        </svg>
                        {cartCount > 0 && (
                          <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "18px", height: "18px", borderRadius: "999px", background: accentColor, color: "#ffffff", fontSize: "10px", fontWeight: 800, display: "grid", placeItems: "center" }}>
                            {cartCount}
                          </span>
                        )}
                      </button>
                    )}

                    {!isMobile && (
                      <button
                        type="button"
                        onClick={handleDummyNotification}
                        style={{ width: "38px", height: "38px", borderRadius: "999px", border: light ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.15)", background: light ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.08)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" />
                          <path d="M10 17a2 2 0 0 0 4 0" />
                        </svg>
                      </button>
                    )}

                    {showAccount && !isMobile && (
                      <div ref={accountMenuRef} style={{ position: "relative" }}>
                        <button
                          ref={accountButtonRef}
                          type="button"
                          onClick={handleAccountClick}
                          style={{ width: "38px", height: "38px", borderRadius: "999px", border: light ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.15)", background: light ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.08)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                        >
                          <svg viewBox="0 0 24 24" style={iconStyle}>
                            <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                            <circle cx="12" cy="8" r="4" />
                          </svg>
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
                </div>
              );
            }

            if (layoutType === "modern_marketplace") {
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: isMobile ? "8px" : "16px", padding: "6px 12px", boxSizing: "border-box" }}>
                  {/* Brand */}
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{ display: "flex", alignItems: "center", gap: "10px", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }}
                  >
                    {resolvedLogoUrl ? (
                      <img
                        src={resolvedLogoUrl}
                        alt={brandName || "Logo"}
                        style={{ maxHeight: logoHeightStyle, height: logoHeightStyle, maxWidth: "160px", objectFit: logoFitStyle, flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: light ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.08)", border: softBorder, color: textColor, display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 800, flexShrink: 0 }}>
                        {getInitials(brandName)}
                      </div>
                    )}
                    <span style={{ fontSize: isMobile ? "14px" : "15px", fontWeight: 700, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName}</span>
                  </button>

                  {/* Marketplace Search */}
                  {showSearch && !isMobile && (
                    <form
                      onSubmit={handleSearchSubmit}
                      style={{
                        flex: "1 1 240px",
                        maxWidth: "480px",
                        display: "flex",
                        alignItems: "center",
                        borderRadius: "8px",
                        border: searchPillBorder,
                        background: searchPillBg,
                        overflow: "hidden",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", padding: "8px 14px" }}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          style={{ width: "28px", height: "28px", border: "none", background: "transparent", color: searchTextColor, opacity: 0.7, display: "grid", placeItems: "center", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        type="submit"
                        style={{ width: "42px", height: "36px", border: "none", background: accentColor, color: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "currentColor", strokeWidth: 2.2, fill: "none" }}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    </form>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px" }}>
                    {showSearch && isMobile && (
                      <button
                        type="button"
                        aria-label="Open search"
                        onClick={openMobileSearch}
                        style={{ width: "38px", height: "38px", borderRadius: "8px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    )}
                    {showCart && (
                      <button
                        type="button"
                        onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                        style={{ width: "38px", height: "38px", borderRadius: "8px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer", position: "relative" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "17px", height: "17px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                          <circle cx="9" cy="20" r="1.5" />
                          <circle cx="17" cy="20" r="1.5" />
                          <path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" />
                        </svg>
                        {cartCount > 0 && (
                          <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "18px", height: "18px", borderRadius: "999px", background: accentColor, color: "#ffffff", fontSize: "10px", fontWeight: 800, display: "grid", placeItems: "center" }}>
                            {cartCount}
                          </span>
                        )}
                      </button>
                    )}

                    {!isMobile && (
                      <button
                        type="button"
                        onClick={handleDummyNotification}
                        style={{ width: "38px", height: "38px", borderRadius: "8px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" />
                          <path d="M10 17a2 2 0 0 0 4 0" />
                        </svg>
                      </button>
                    )}

                    {showAccount && !isMobile && (
                      <div ref={accountMenuRef} style={{ position: "relative" }}>
                        <button
                          ref={accountButtonRef}
                          type="button"
                          onClick={handleAccountClick}
                          style={{ width: "38px", height: "38px", borderRadius: "8px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                        >
                          <svg viewBox="0 0 24 24" style={iconStyle}>
                            <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                            <circle cx="12" cy="8" r="4" />
                          </svg>
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
                </div>
              );
            }

            if (layoutType === "luxury_fashion") {
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: isMobile ? "8px" : "16px", padding: "8px 16px", boxSizing: "border-box" }}>
                  {/* Serif Logo */}
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "16px", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }}
                  >
                    {resolvedLogoUrl ? (
                      <img
                        src={resolvedLogoUrl}
                        alt={brandName || "Logo"}
                        style={{ maxHeight: logoHeightStyle, height: logoHeightStyle, maxWidth: "160px", objectFit: logoFitStyle, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ fontFamily: "'Playfair Display', 'Didot', 'Georgia', serif", fontSize: isMobile ? "16px" : "20px", fontWeight: 700, color: textColor, flexShrink: 0 }}>
                        {getInitials(brandName)}
                      </span>
                    )}
                    <span style={{ width: "1px", height: "18px", background: light ? "rgba(15,23,42,0.15)" : "rgba(255,255,255,0.2)" }} />
                    <span style={{ fontFamily: "'Playfair Display', 'Didot', 'Georgia', serif", fontSize: isMobile ? "12px" : "15px", fontWeight: 600, color: textColor, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {brandName}
                    </span>
                  </button>

                  {/* Minimal Fashion Search Pill */}
                  {showSearch && !isMobile && (
                    <form
                      onSubmit={handleSearchSubmit}
                      style={{
                        flex: "1 1 240px",
                        maxWidth: "440px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "4px 4px 4px 16px",
                        borderRadius: "999px",
                        background: searchPillBg,
                        border: searchPillBorder,
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontFamily: "serif" }}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          style={{ width: "26px", height: "26px", border: "none", background: "transparent", color: searchTextColor, opacity: 0.7, display: "grid", placeItems: "center", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        type="submit"
                        style={{ width: "32px", height: "32px", borderRadius: "999px", border: "none", background: "transparent", color: searchTextColor, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    </form>
                  )}

                  {/* Luxury Minimal Icons */}
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "14px" }}>
                    {showSearch && isMobile && (
                      <button
                        type="button"
                        aria-label="Open search"
                        onClick={openMobileSearch}
                        style={{ background: "transparent", border: "none", color: textColor, cursor: "pointer", padding: "4px" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "19px", height: "19px", stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    )}
                    {showCart && (
                      <button
                        type="button"
                        onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                        style={{ background: "transparent", border: "none", color: textColor, cursor: "pointer", position: "relative", padding: "4px" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "19px", height: "19px", stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}>
                          <circle cx="9" cy="20" r="1.5" />
                          <circle cx="17" cy="20" r="1.5" />
                          <path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" />
                        </svg>
                        {cartCount > 0 && (
                          <span style={{ position: "absolute", top: "-2px", right: "-4px", width: "16px", height: "16px", borderRadius: "999px", background: accentColor, color: "#ffffff", fontSize: "9px", fontWeight: 800, display: "grid", placeItems: "center" }}>
                            {cartCount}
                          </span>
                        )}
                      </button>
                    )}

                    {!isMobile && (
                      <button
                        type="button"
                        onClick={handleDummyNotification}
                        style={{ background: "transparent", border: "none", color: textColor, cursor: "pointer", padding: "4px" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "19px", height: "19px", stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}>
                          <path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" />
                          <path d="M10 17a2 2 0 0 0 4 0" />
                        </svg>
                      </button>
                    )}

                    {showAccount && !isMobile && (
                      <div ref={accountMenuRef} style={{ position: "relative" }}>
                        <button
                          ref={accountButtonRef}
                          type="button"
                          onClick={handleAccountClick}
                          style={{ background: "transparent", border: "none", color: textColor, cursor: "pointer", padding: "4px" }}
                        >
                          <svg viewBox="0 0 24 24" style={{ width: "19px", height: "19px", stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}>
                            <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                            <circle cx="12" cy="8" r="4" />
                          </svg>
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

              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: isMobile ? "8px" : "16px", padding: "8px 16px", background: neoBg, borderRadius: "999px", boxShadow: outerShadow, boxSizing: "border-box" }}>
                  {/* Brand */}
                  <button
                    type="button"
                    onClick={handleHomeClick}
                    style={{ display: "flex", alignItems: "center", gap: "10px", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }}
                  >
                    {resolvedLogoUrl ? (
                      <img
                        src={resolvedLogoUrl}
                        alt={brandName || "Logo"}
                        style={{ maxHeight: logoHeightStyle, height: logoHeightStyle, maxWidth: "160px", objectFit: logoFitStyle, flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: neoBg, boxShadow: buttonShadow, color: neoTextColor, display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 800, flexShrink: 0 }}>
                        {getInitials(brandName)}
                      </div>
                    )}
                    <span style={{ fontSize: isMobile ? "14px" : "15px", fontWeight: 700, color: neoTextColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName}</span>
                  </button>

                  {/* Inset Neumorphic Search Bar */}
                  {showSearch && !isMobile && (
                    <form
                      onSubmit={handleSearchSubmit}
                      style={{
                        flex: "1 1 240px",
                        maxWidth: "460px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "4px 4px 4px 16px",
                        borderRadius: "999px",
                        background: neoBg,
                        boxShadow: insetShadow,
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => handleSearchInputChange(e.target.value)}
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontWeight: 500 }}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          style={{ width: "26px", height: "26px", border: "none", background: "transparent", color: searchTextColor, opacity: 0.7, display: "grid", placeItems: "center", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        type="submit"
                        style={{ width: "32px", height: "32px", borderRadius: "999px", border: "none", background: neoBg, boxShadow: buttonShadow, color: neoTextColor, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    </form>
                  )}

                  {/* Circular Neumorphic Action Controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "12px" }}>
                    {showSearch && isMobile && (
                      <button
                        type="button"
                        aria-label="Open search"
                        onClick={openMobileSearch}
                        style={{ width: "38px", height: "38px", borderRadius: "999px", border: "none", background: neoBg, boxShadow: buttonShadow, color: neoTextColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20L16.65 16.65" />
                        </svg>
                      </button>
                    )}
                    {showCart && (
                      <button
                        type="button"
                        onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                        style={{ width: "38px", height: "38px", borderRadius: "999px", border: "none", background: neoBg, boxShadow: buttonShadow, color: neoTextColor, display: "grid", placeItems: "center", cursor: "pointer", position: "relative" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "17px", height: "17px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                          <circle cx="9" cy="20" r="1.5" />
                          <circle cx="17" cy="20" r="1.5" />
                          <path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" />
                        </svg>
                        {cartCount > 0 && (
                          <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "18px", height: "18px", borderRadius: "999px", background: accentColor, color: "#ffffff", fontSize: "10px", fontWeight: 800, display: "grid", placeItems: "center" }}>
                            {cartCount}
                          </span>
                        )}
                      </button>
                    )}

                    {!isMobile && (
                      <button
                        type="button"
                        onClick={handleDummyNotification}
                        style={{ width: "38px", height: "38px", borderRadius: "999px", border: "none", background: neoBg, boxShadow: buttonShadow, color: neoTextColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" />
                          <path d="M10 17a2 2 0 0 0 4 0" />
                        </svg>
                      </button>
                    )}

                    {showAccount && !isMobile && (
                      <div ref={accountMenuRef} style={{ position: "relative" }}>
                        <button
                          ref={accountButtonRef}
                          type="button"
                          onClick={handleAccountClick}
                          style={{ width: "38px", height: "38px", borderRadius: "999px", border: "none", background: neoBg, boxShadow: buttonShadow, color: neoTextColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                        >
                          <svg viewBox="0 0 24 24" style={iconStyle}>
                            <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                            <circle cx="12" cy="8" r="4" />
                          </svg>
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
                </div>
              );
            }

            // Apple Minimal & Default Standard Layout
            return (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: isMobile ? "8px" : "16px", padding: "6px 12px", boxSizing: "border-box" }}>
                {/* Brand */}
                <button
                  type="button"
                  onClick={handleHomeClick}
                  style={{ display: "flex", alignItems: "center", gap: "10px", background: "transparent", border: "none", cursor: "pointer", minWidth: 0 }}
                >
                  {resolvedLogoUrl ? (
                    <img
                      src={resolvedLogoUrl}
                      alt={brandName || "Logo"}
                      style={{ maxHeight: logoHeightStyle, height: logoHeightStyle, maxWidth: "160px", objectFit: logoFitStyle, flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: light ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.08)", border: softBorder, color: textColor, display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 800, flexShrink: 0 }}>
                      {getInitials(brandName)}
                    </div>
                  )}
                  <span style={{ fontSize: isMobile ? "14px" : "15px", fontWeight: 700, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName}</span>
                </button>

                {/* Pill Search with enclosed button icon */}
                {showSearch && !isMobile && (
                  <form
                    onSubmit={handleSearchSubmit}
                    style={{
                      flex: "1 1 240px",
                      maxWidth: "460px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 4px 4px 16px",
                      borderRadius: "999px",
                      background: searchPillBg,
                      border: searchPillBorder,
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => handleSearchInputChange(e.target.value)}
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: searchTextColor, fontSize: "13px", fontWeight: 500 }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        style={{ width: "26px", height: "26px", border: "none", background: "transparent", color: searchTextColor, opacity: 0.7, display: "grid", placeItems: "center", cursor: "pointer", fontSize: "13px", flexShrink: 0 }}
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                    <button
                      type="submit"
                      style={{ width: "32px", height: "32px", borderRadius: "999px", border: "none", background: isSearchBgDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.08)", color: searchTextColor, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20L16.65 16.65" />
                      </svg>
                    </button>
                  </form>
                )}

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px" }}>
                  {showSearch && isMobile && (
                    <button
                      type="button"
                      aria-label="Open search"
                      onClick={openMobileSearch}
                      style={{ width: "38px", height: "38px", borderRadius: "999px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                    >
                      <svg viewBox="0 0 24 24" style={iconStyle}>
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20L16.65 16.65" />
                      </svg>
                    </button>
                  )}
                  {showCart && (
                    <button
                      type="button"
                      onClick={() => (onOpenCart ? onOpenCart() : navigate(resolvedCartPath))}
                      style={{ width: "38px", height: "38px", borderRadius: "999px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer", position: "relative" }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: "17px", height: "17px", stroke: "currentColor", strokeWidth: 2, fill: "none" }}>
                        <circle cx="9" cy="20" r="1.5" />
                        <circle cx="17" cy="20" r="1.5" />
                        <path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" />
                      </svg>
                      {cartCount > 0 && (
                        <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "18px", height: "18px", borderRadius: "999px", background: accentColor, color: "#ffffff", fontSize: "10px", fontWeight: 800, display: "grid", placeItems: "center" }}>
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}

                  {!isMobile && (
                    <button
                      type="button"
                      onClick={handleDummyNotification}
                      style={{ width: "38px", height: "38px", borderRadius: "999px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                    >
                      <svg viewBox="0 0 24 24" style={iconStyle}>
                        <path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" />
                        <path d="M10 17a2 2 0 0 0 4 0" />
                      </svg>
                    </button>
                  )}

                  {showAccount && !isMobile && (
                    <div ref={accountMenuRef} style={{ position: "relative" }}>
                      <button
                        ref={accountButtonRef}
                        type="button"
                        onClick={handleAccountClick}
                        style={{ width: "38px", height: "38px", borderRadius: "999px", border: softBorder, background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)", color: textColor, display: "grid", placeItems: "center", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                          <circle cx="12" cy="8" r="4" />
                        </svg>
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
              </div>
            );
          })()}
        </div>
      </div>
    </header>
  );
};


export default Navbar;
