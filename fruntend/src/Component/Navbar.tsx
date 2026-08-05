import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";


export type NavbarTheme = {
  name?: string;
  mode?: string;
  primary_bg?: string;
  text_color?: string;
  accent_color?: string;
  navbar_variant?: "solid" | "soft" | "floating" | "transparent";
  navbar_position?: "static" | "sticky" | "fixed";
  navbar_bg?: string;
  navbar_text_color?: string;
  navbar_muted_text_color?: string;
  navbar_border_color?: string;
  navbar_height?: number;
  navbar_max_width?: number;
  navbar_radius?: number;
  navbar_padding_x?: number;
  navbar_padding_y?: number;
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


const isLightTheme = (theme?: NavbarTheme) => theme?.mode === "light";


const getInitials = (brandName?: string) => {
  if (!brandName) return "SB";
  return brandName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
};


const toAppPath = (base: string, route?: string) => {
  if (!route || route === "/") return base;
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${base}${normalizedRoute}`;
};


const getNavbarPositionStyle = (
  position: NavbarPosition,
  topOffset: number,
  fixedBounds?: NavbarFixedBounds
): React.CSSProperties => {
  if (position === "static") {
    return { position: "relative", zIndex: 20 };
  }

  if (position === "fixed") {
    if (fixedBounds && fixedBounds.width > 0) {
      return {
        position: "fixed",
        top: `${topOffset}px`,
        left: `${fixedBounds.left}px`,
        width: `${fixedBounds.width}px`,
        right: "auto",
        zIndex: 240,
      };
    }

    return {
      position: "fixed",
      top: `${topOffset}px`,
      left: 0,
      right: 0,
      zIndex: 240,
    };
  }

  return { position: "sticky", top: `${topOffset}px`, zIndex: 40 };
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


const Navbar: React.FC<NavbarProps> = ({
  brandName = "Storefront",
  tagline,
  theme,
  navigation,
  showSearch = true,
  showAccount = true,
  showCart = true,
  homeRoute = "/",
  cartRoute = "/cart",
  topOffset = 0,
  fixedBounds,
  siteSlug,
  appBase,
}) => {
  const { cartCount = 0 } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { siteId, slug } = useParams<{ siteId?: string; slug?: string }>();
  const { isAuthenticated, refreshMe, clearUser, logout } = useCustomerAuth();

  const viewportMode = useViewportMode();
  const isMobile = viewportMode === "mobile";
  const isTablet = viewportMode === "tablet";
  const isCompact = isMobile;

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const navbarRef = useRef<HTMLElement | null>(null);

  const base =
    appBase ||
    (location.pathname.startsWith("/store/")
      ? `/store/${siteSlug || slug || ""}`
      : `/builder/${siteId ?? ""}`);

  const light = isLightTheme(theme);
  const variant = theme?.navbar_variant || "soft";
  const position: NavbarPosition = theme?.navbar_position || "sticky";

  const resolvedHomePath = toAppPath(base, homeRoute);
  const resolvedCartPath = toAppPath(base, cartRoute);

  const accentColor = theme?.accent_color || "#2563eb";
  const primaryBg = theme?.primary_bg || (light ? "#f8fafc" : "#020617");

  const storefrontLinks =
    navigation?.storefront && navigation.storefront.length > 0
      ? navigation.storefront
      : [];

  const defaultTextColor = theme?.text_color || (light ? "#0f172a" : "#f8fafc");
  const textColor = theme?.navbar_text_color || defaultTextColor;

  const defaultMutedText = light
    ? "rgba(15,23,42,0.64)"
    : "rgba(255,255,255,0.68)";
  const mutedText = theme?.navbar_muted_text_color || defaultMutedText;

  const defaultOuterBorder = light
    ? "1px solid rgba(15,23,42,0.06)"
    : "1px solid rgba(255,255,255,0.05)";

  const defaultShellBorder = light
    ? "1px solid rgba(15,23,42,0.08)"
    : "1px solid rgba(255,255,255,0.08)";

  const navbarHeight = theme?.navbar_height ?? 72;
  const navbarMaxWidth = theme?.navbar_max_width ?? 1280;
  const navbarRadius = theme?.navbar_radius;
  const navbarPaddingX = theme?.navbar_padding_x;
  const navbarPaddingY = theme?.navbar_padding_y;

  const hasCustomNavbarBg = Boolean(theme?.navbar_bg);
  const hasCustomNavbarBorder = Boolean(theme?.navbar_border_color);

  const darkOuterSurface = "#081226";
  const darkShellSurface = hasCustomNavbarBg ? theme!.navbar_bg! : "#0f172a";
  const darkSoftSurface = "rgba(255,255,255,0.06)";

  const lightOuterSurface = primaryBg;
  const lightShellSurface = hasCustomNavbarBg ? theme!.navbar_bg! : "#ffffff";
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

  const resolvedWrapperPadding =
    navbarPaddingY !== undefined || navbarPaddingX !== undefined
      ? `${navbarPaddingY ?? 14}px ${navbarPaddingX ?? 16}px`
      : wrapperPadding;

  const resolvedShellPadding =
    navbarPaddingY !== undefined || navbarPaddingX !== undefined
      ? `${Math.max(8, navbarPaddingY ?? 12)}px ${Math.max(
          10,
          navbarPaddingX ?? 14
        )}px`
      : shellPadding;

  const isBuilderAdminRoute =
    location.pathname.startsWith("/builder/") && location.pathname.includes("/admin");

  const isStoreRoute = location.pathname.startsWith("/store/");

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
  }, [
    siteSlug,
    location.pathname,
    refreshMe,
    isBuilderAdminRoute,
    isStoreRoute,
    clearUser,
  ]);

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
    if (!accountMenuOpen && !mobileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedAccount =
        accountMenuRef.current?.contains(target) ||
        accountButtonRef.current?.contains(target);
      const clickedMobileMenu =
        mobileMenuRef.current?.contains(target) ||
        mobileMenuButtonRef.current?.contains(target);

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

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const onScroll = () => {
      closeSearch();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileSearchOpen]);

  const closeAccountMenu = () => setAccountMenuOpen(false);

  const handleAccountClick = () => {
    if (isBuilderAdminRoute) {
      closeAccountMenu();
      return;
    }

    if (!siteSlug) return;

    if (isAuthenticated) {
      setAccountMenuOpen((prev) => !prev);
      return;
    }

    const storePrefix = `/store/${siteSlug}`;
    const safeFrom = location.pathname.startsWith(storePrefix)
      ? location.pathname
      : storePrefix;

    navigate(`/store/${siteSlug}/login`, {
      state: { from: safeFrom },
    });
  };

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
    setMobileMenuOpen(false);
    setMobileSearchOpen(true);
    setSearchActive(true);
  };

  const closeSearch = () => {
    setSearchActive(false);
    setMobileSearchOpen(false);
  };

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
    color: textColor,
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
    background: light ? "rgba(255,255,255,0.96)" : "rgba(15,23,42,0.96)",
    border: light ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.08)",
    boxShadow: light
      ? "0 20px 45px rgba(15,23,42,0.14)"
      : "0 20px 45px rgba(0,0,0,0.38)",
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
    background: light ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.06)",
    border: light ? "1px solid rgba(15,23,42,0.06)" : "1px solid rgba(255,255,255,0.06)",
    color: textColor,
    flexShrink: 0,
  };

  const menuMetaTextStyle: React.CSSProperties = {
    fontSize: "11px",
    color: mutedText,
    marginTop: "2px",
    letterSpacing: "0.01em",
  };

  const menuArrowStyle: React.CSSProperties = {
    color: light ? "rgba(15,23,42,0.32)" : "rgba(255,255,255,0.32)",
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
    boxShadow: light
      ? "0 10px 24px rgba(15,23,42,0.08)"
      : "0 10px 24px rgba(0,0,0,0.18)",
    overflow: "hidden",
    flex: "1 1 260px",
    maxWidth: isMobile ? "100%" : "min(100%, 440px)",
  };

  const mobileMenuPanelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
    paddingTop: "8px",
    borderTop: variant === "transparent" ? "none" : light ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.08)",
  };

  const mobileHeaderStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
  };

  const mobileTopRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    width: "100%",
  };

  const mobileBrandRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    flex: "1 1 auto",
  };

  const desktopMainRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    width: "100%",
    flexWrap: "nowrap",
  };

  const mobilePanelMenu = (
    <div ref={mobileMenuRef} style={mobileMenuPanelStyle}>
      <button
        type="button"
        onClick={openMobileSearch}
        style={{
          width: "100%",
          minHeight: "44px",
          borderRadius: "14px",
          border: softBorder,
          background: iconButtonBg,
          color: textColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          cursor: "pointer",
        }}
      >
        <svg viewBox="0 0 24 24" style={iconStyle}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20L16.65 16.65" />
        </svg>
        <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>
          Search
        </span>
      </button>

      <button
        type="button"
        onClick={handleDummyNotification}
        style={{
          width: "100%",
          minHeight: "44px",
          borderRadius: "14px",
          border: softBorder,
          background: iconButtonBg,
          color: textColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          cursor: "pointer",
        }}
      >
        <svg viewBox="0 0 24 24" style={iconStyle}>
          <path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" />
          <path d="M10 17a2 2 0 0 0 4 0" />
        </svg>
        <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>
          Notifications
        </span>
      </button>

      {showAccount ? (
        isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={handleGoToProfile}
              style={{
                width: "100%",
                minHeight: "44px",
                borderRadius: "14px",
                border: softBorder,
                background: iconButtonBg,
                color: textColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <svg viewBox="0 0 24 24" style={iconStyle}>
                <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                <circle cx="12" cy="8" r="4" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>
                Profile
              </span>
            </button>

            <button
              type="button"
              onClick={handleGoToOrders}
              style={{
                width: "100%",
                minHeight: "44px",
                borderRadius: "14px",
                border: softBorder,
                background: iconButtonBg,
                color: textColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <svg viewBox="0 0 24 24" style={iconStyle}>
                <path d="M3 7.5H21" />
                <path d="M6 7.5V17C6 18.1046 6.89543 19 8 19H16C17.1046 19 18 18.1046 18 17V7.5" />
                <path d="M9 11H15" />
                <path d="M10 4.5H14" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>
                Order history
              </span>
            </button>

            <button
              type="button"
              onClick={handleCustomerLogout}
              style={{
                width: "100%",
                minHeight: "44px",
                borderRadius: "14px",
                border: softBorder,
                background: iconButtonBg,
                color: light ? "#991b1b" : "#fca5a5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <svg viewBox="0 0 24 24" style={iconStyle}>
                <path d="M9 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H9" />
                <path d="M16 17L21 12L16 7" />
                <path d="M21 12H9" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>
                Logout
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleAccountClick}
            style={{
              width: "100%",
              minHeight: "44px",
              borderRadius: "14px",
              border: softBorder,
              background: iconButtonBg,
              color: textColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              cursor: "pointer",
            }}
          >
            <svg viewBox="0 0 24 24" style={iconStyle}>
              <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
              <circle cx="12" cy="8" r="4" />
            </svg>
            <span style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em" }}>
              Account
            </span>
          </button>
        )
      ) : null}
    </div>
  );

  useEffect(() => {
    if (!searchActive) return;
    const onScroll = () => {
      closeSearch();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [searchActive]);

  return (
    <header
      ref={navbarRef}
      id="storefront-navbar"
      className={`storefront-navbar storefront-navbar--${position}`}
      data-navbar-position={position}
      style={{
        ...getNavbarPositionStyle(position, topOffset, fixedBounds),
        padding: resolvedWrapperPadding,
        background: outerBackground,
        borderBottom: variant === "floating" ? "none" : outerBorder,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: `${navbarMaxWidth}px`,
          margin: "0 auto",
          width: "100%",
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
          }}
        >
          {isMobile ? (
            <div style={mobileHeaderStyle}>
              <div style={mobileTopRowStyle}>
                <div style={mobileBrandRowStyle}>
                  <button
                    type="button"
                    onClick={() => navigate(resolvedHomePath)}
                    style={{
                      display: searchActive ? "none" : "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: 0,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      minWidth: 0,
                      flex: "1 1 auto",
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "14px",
                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        boxShadow: light
                          ? "0 12px 24px rgba(37,99,235,0.18)"
                          : "0 12px 24px rgba(0,0,0,0.26)",
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(brandName)}
                    </div>
                    <div style={{ textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 750,
                          lineHeight: 1.1,
                          color: textColor,
                          letterSpacing: "-0.02em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {brandName}
                      </div>
                      {tagline ? (
                        <div
                          style={{
                            fontSize: "11px",
                            color: mutedText,
                            marginTop: "3px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "180px",
                          }}
                        >
                          {tagline}
                        </div>
                      ) : null}
                    </div>
                  </button>

                  {searchActive ? (
                    <div style={{ display: "flex", alignItems: "center", flex: 1, gap: "8px" }}>
                      <input
                        ref={mobileSearchInputRef}
                        type="text"
                        aria-label="Search products"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: "40px",
                          borderRadius: "12px",
                          border: softBorder,
                          background: light ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.05)",
                          outline: "none",
                          padding: "0 12px",
                          color: textColor,
                        }}
                        onBlur={() => {
                          if (searchQuery.trim().length === 0) {
                            closeSearch();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            closeSearch();
                          }
                          if (e.key === "Escape") {
                            closeSearch();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={closeSearch}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "12px",
                          border: "none",
                          background: light ? "#0f172a" : "#ffffff",
                          color: light ? "#ffffff" : "#0f172a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <svg viewBox="0 0 24 24" style={iconStyle}>
                          <path d="M6 6L18 18" />
                          <path d="M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {showCart && (
                    <button
                      type="button"
                      aria-label="Cart"
                      onClick={() => navigate(resolvedCartPath)}
                      style={leftIconBtnBase}
                    >
                      <svg viewBox="0 0 24 24" style={iconStyle}>
                        <circle cx="9" cy="20" r="1.5" />
                        <circle cx="17" cy="20" r="1.5" />
                        <path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" />
                      </svg>

                      {cartCount > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: "-5px",
                            right: "-5px",
                            minWidth: "20px",
                            height: "20px",
                            padding: "0 6px",
                            borderRadius: "999px",
                            background: "#ef4444",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 6px 14px rgba(239,68,68,0.35)",
                          }}
                        >
                          {cartCount}
                        </span>
                      )}
                    </button>
                  )}

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
                </div>
              </div>

              {!searchActive && mobileMenuOpen ? mobilePanelMenu : null}
            </div>
          ) : (
            <div style={desktopMainRowStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  minWidth: 0,
                  flex: "1 1 auto",
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate(resolvedHomePath)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: 0,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    minWidth: 0,
                    flex: "0 1 auto",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "14px",
                      background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      boxShadow: light
                        ? "0 12px 24px rgba(37,99,235,0.18)"
                        : "0 12px 24px rgba(0,0,0,0.26)",
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(brandName)}
                  </div>

                  <div style={{ textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 750,
                        lineHeight: 1.1,
                        color: textColor,
                        letterSpacing: "-0.02em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {brandName}
                    </div>

                    {tagline ? (
                      <div
                        style={{
                          fontSize: "12px",
                          color: mutedText,
                          marginTop: "3px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {tagline}
                      </div>
                    ) : null}
                  </div>
                </button>

                {showSearch && (
                  <div style={{ ...searchWrapStyle, flex: "1 1 260px" }}>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "0 16px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        aria-label="Search products"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          color: textColor,
                          fontSize: "14px",
                          fontWeight: 500,
                          padding: "12px 0",
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      aria-label="Search"
                      onClick={() => window.console.log("Search:", searchQuery)}
                      style={{
                        width: "46px",
                        height: "46px",
                        margin: "4px",
                        borderRadius: "999px",
                        border: "none",
                        background: light ? "#0f172a" : "#ffffff",
                        color: light ? "#ffffff" : "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                        boxShadow: light
                          ? "0 8px 18px rgba(15,23,42,0.12)"
                          : "0 8px 18px rgba(255,255,255,0.10)",
                      }}
                    >
                      <svg viewBox="0 0 24 24" style={iconStyle}>
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20L16.65 16.65" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: 0,
                  flex: "0 0 auto",
                }}
              >
                {showCart && (
                  <button
                    type="button"
                    aria-label="Cart"
                    onClick={() => navigate(resolvedCartPath)}
                    style={leftIconBtnBase}
                  >
                    <svg viewBox="0 0 24 24" style={iconStyle}>
                      <circle cx="9" cy="20" r="1.5" />
                      <circle cx="17" cy="20" r="1.5" />
                      <path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" />
                    </svg>

                    {cartCount > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-5px",
                          right: "-5px",
                          minWidth: "20px",
                          height: "20px",
                          padding: "0 6px",
                          borderRadius: "999px",
                          background: "#ef4444",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 6px 14px rgba(239,68,68,0.35)",
                        }}
                      >
                        {cartCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={handleDummyNotification}
                  style={leftIconBtnBase}
                >
                  <svg viewBox="0 0 24 24" style={iconStyle}>
                    <path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" />
                    <path d="M10 17a2 2 0 0 0 4 0" />
                  </svg>
                </button>

                {showAccount && (
                  <div ref={accountMenuRef} style={{ position: "relative" }}>
                    <button
                      ref={accountButtonRef}
                      type="button"
                      aria-label={isAuthenticated ? "Account menu" : "Account"}
                      aria-haspopup={isAuthenticated ? "menu" : undefined}
                      aria-expanded={isAuthenticated ? accountMenuOpen : undefined}
                      onClick={handleAccountClick}
                      style={leftIconBtnBase}
                    >
                      <svg viewBox="0 0 24 24" style={iconStyle}>
                        <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                        <circle cx="12" cy="8" r="4" />
                      </svg>
                    </button>

                    {isAuthenticated && accountMenuOpen && (
                      <div role="menu" aria-label="Account options" style={dropdownPanelStyle}>
                        <div
                          style={{
                            padding: "8px 10px 12px",
                            marginBottom: "8px",
                            borderBottom: light
                              ? "1px solid rgba(15,23,42,0.08)"
                              : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: mutedText,
                              marginBottom: "6px",
                            }}
                          >
                            Account
                          </div>

                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: textColor,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {brandName}
                          </div>

                          <div style={menuMetaTextStyle}>
                            Manage profile, orders, and session
                          </div>
                        </div>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleGoToProfile}
                          style={menuItemStyle}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                            <span style={menuRowIconStyle}>
                              <svg viewBox="0 0 24 24" style={iconStyle}>
                                <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                                <circle cx="12" cy="8" r="4" />
                              </svg>
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "13px", fontWeight: 650, color: textColor }}>Profile</div>
                              <div style={menuMetaTextStyle}>Personal details and preferences</div>
                            </span>
                          </div>
                          <span style={menuArrowStyle}>→</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleGoToOrders}
                          style={menuItemStyle}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                            <span style={menuRowIconStyle}>
                              <svg viewBox="0 0 24 24" style={iconStyle}>
                                <path d="M3 7.5H21" />
                                <path d="M6 7.5V17C6 18.1046 6.89543 19 8 19H16C17.1046 19 18 18.1046 18 17V7.5" />
                                <path d="M9 11H15" />
                                <path d="M10 4.5H14" />
                              </svg>
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "13px", fontWeight: 650, color: textColor }}>Order history</div>
                              <div style={menuMetaTextStyle}>Track purchases and order activity</div>
                            </span>
                          </div>
                          <span style={menuArrowStyle}>→</span>
                        </button>

                        <div
                          style={{
                            margin: "8px 2px 2px",
                            borderTop: light
                              ? "1px solid rgba(15,23,42,0.08)"
                              : "1px solid rgba(255,255,255,0.08)",
                            paddingTop: "8px",
                          }}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleCustomerLogout}
                            style={{
                              ...menuItemStyle,
                              color: light ? "#991b1b" : "#fca5a5",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span
                                style={{
                                  ...menuRowIconStyle,
                                  color: light ? "#991b1b" : "#fca5a5",
                                  background: light
                                    ? "rgba(239,68,68,0.05)"
                                    : "rgba(239,68,68,0.10)",
                                  border: light
                                    ? "1px solid rgba(239,68,68,0.10)"
                                    : "1px solid rgba(239,68,68,0.14)",
                                }}
                              >
                                <svg viewBox="0 0 24 24" style={iconStyle}>
                                  <path d="M9 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H9" />
                                  <path d="M16 17L21 12L16 7" />
                                  <path d="M21 12H9" />
                                </svg>
                              </span>
                              <span>
                                <div style={{ fontSize: "13px", fontWeight: 650 }}>Logout</div>
                                <div style={menuMetaTextStyle}>Sign out from this session</div>
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


export default Navbar;