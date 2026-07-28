import React from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../CartContext";

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
};

type NavbarPosition = "static" | "sticky" | "fixed";

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

const toBuilderPath = (base: string, route?: string) => {
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
    return {
      position: "relative",
      zIndex: 20,
    };
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

  return {
    position: "sticky",
    top: `${topOffset}px`,
    zIndex: 40,
  };
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
}) => {
  const { cartCount = 0 } = useCart();
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();

  const base = `/builder/${siteId ?? ""}`;
  const light = isLightTheme(theme);

  const variant = theme?.navbar_variant || "soft";
  const position: NavbarPosition = theme?.navbar_position || "sticky";

  const resolvedHomePath = toBuilderPath(base, homeRoute);
  const resolvedCartPath = toBuilderPath(base, cartRoute);

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
  const cartButtonBg = light ? "#0f172a" : "#ffffff";
  const cartButtonText = light ? "#ffffff" : "#0f172a";

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

  return (
    <header
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: resolvedShellPadding,
            borderRadius: shellRadius,
            background: shellBg,
            border:
              variant === "transparent" || variant === "solid"
                ? "none"
                : shellBorder,
            boxShadow: shellBoxShadow,
            flexWrap: "wrap",
            minHeight: `${navbarHeight}px`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              minWidth: 0,
              flex: "1 1 auto",
              flexWrap: "wrap",
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

              <div style={{ textAlign: "left", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 750,
                    lineHeight: 1.1,
                    color: textColor,
                    letterSpacing: "-0.02em",
                    whiteSpace: "nowrap",
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
                    }}
                  >
                    {tagline}
                  </div>
                ) : null}
              </div>
            </button>

            {storefrontLinks.length > 0 && (
              <nav
                aria-label="Storefront"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  padding: "6px",
                  borderRadius: "16px",
                  background: softSurface,
                  border: variant === "transparent" ? "none" : softBorder,
                }}
              >
                {storefrontLinks.map((item) => (
                  <NavLink
                    key={`${item.label}-${item.route}`}
                    to={toBuilderPath(base, item.route)}
                    end={item.route === "/"}
                    style={({ isActive }) => ({
                      textDecoration: "none",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      fontSize: "14px",
                      fontWeight: 650,
                      letterSpacing: "-0.01em",
                      color: isActive ? "#ffffff" : mutedText,
                      background: isActive ? accentColor : "transparent",
                      border: "1px solid transparent",
                      boxShadow: isActive
                        ? light
                          ? "0 8px 18px rgba(37,99,235,0.24)"
                          : "0 8px 18px rgba(37,99,235,0.22)"
                        : "none",
                      transition: "all 180ms ease",
                      lineHeight: 1,
                    })}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginLeft: "auto",
            }}
          >
            {showSearch && (
              <button
                type="button"
                aria-label="Search"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "14px",
                  border: softBorder,
                  background: iconButtonBg,
                  color: textColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <svg viewBox="0 0 24 24" style={iconStyle}>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20L16.65 16.65" />
                </svg>
              </button>
            )}

            {showAccount && (
              <button
                type="button"
                aria-label="Account"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "14px",
                  border: softBorder,
                  background: iconButtonBg,
                  color: textColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <svg viewBox="0 0 24 24" style={iconStyle}>
                  <path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </button>
            )}

            {showCart && (
              <button
                type="button"
                aria-label="Cart"
                onClick={() => navigate(resolvedCartPath)}
                style={{
                  position: "relative",
                  height: "42px",
                  minWidth: "48px",
                  padding: "0 14px",
                  borderRadius: "14px",
                  border: softBorder,
                  background: cartButtonBg,
                  color: cartButtonText,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: light
                    ? "0 10px 24px rgba(15,23,42,0.16)"
                    : "0 10px 24px rgba(255,255,255,0.08)",
                }}
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;