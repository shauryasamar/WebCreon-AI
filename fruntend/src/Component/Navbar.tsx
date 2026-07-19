import React from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../CartContext";

type Theme = {
  name?: string;
  mode?: string;
  primary_bg?: string;
  text_color?: string;
  accent_color?: string;
};

type NavigationItem = {
  label: string;
  route: string;
  role?: string;
};

type NavigationGroups = {
  storefront?: NavigationItem[];
  admin?: NavigationItem[];
};

type NavbarProps = {
  brandName?: string;
  tagline?: string;
  theme?: Theme;
  navigation?: NavigationGroups;
};

const iconStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  stroke: "currentColor",
  strokeWidth: 1.8,
  fill: "none",
  flexShrink: 0,
};

const isLightTheme = (theme?: Theme) =>
  theme?.mode === "light" || theme?.name === "light";

const getInitials = (brandName?: string) => {
  if (!brandName) return "SB";
  return brandName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
};

const toBuilderPath = (base: string, route?: string) => {
  if (!route || route === "/") return base;
  return `${base}${route}`;
};

const Navbar: React.FC<NavbarProps> = ({
  brandName = "Storefront",
  tagline,
  theme,
  navigation,
}) => {
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const { siteId } = useParams();

  const base = `/builder/${siteId}`;
  const light = isLightTheme(theme);

  const textColor = theme?.text_color || (light ? "#0f172a" : "#f8fafc");
  const accentColor = theme?.accent_color || "#2563eb";
  const primaryBg = theme?.primary_bg || (light ? "#f8fafc" : "#020617");

  const storefrontLinks =
    navigation?.storefront && navigation.storefront.length > 0
      ? navigation.storefront
      : [];

  const headerBg = light
    ? `linear-gradient(to bottom, ${primaryBg}, ${primaryBg})`
    : `linear-gradient(to bottom, ${primaryBg}, ${primaryBg})`;

  const shellBg = light ? "rgba(255,255,255,0.84)" : "rgba(15,23,42,0.78)";

  const shellBorder = light
    ? "1px solid rgba(15,23,42,0.08)"
    : "1px solid rgba(255,255,255,0.08)";

  const mutedText = light ? "rgba(15,23,42,0.64)" : "rgba(255,255,255,0.68)";

  const softSurface = light
    ? "rgba(15,23,42,0.04)"
    : "rgba(255,255,255,0.06)";

  const softBorder = light
    ? "1px solid rgba(15,23,42,0.07)"
    : "1px solid rgba(255,255,255,0.08)";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "14px 16px",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        background: headerBg,
        borderBottom: light
          ? "1px solid rgba(15,23,42,0.06)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "12px 14px",
            borderRadius: "20px",
            background: shellBg,
            border: shellBorder,
            boxShadow: light
              ? "0 10px 30px rgba(15,23,42,0.06)"
              : "0 12px 32px rgba(0,0,0,0.28)",
            flexWrap: "wrap",
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
              onClick={() => navigate(base)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "0",
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
                  border: softBorder,
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
                      border: isActive
                        ? "1px solid transparent"
                        : "1px solid transparent",
                      boxShadow: isActive
                        ? light
                          ? "0 8px 18px rgba(37,99,235,0.24)"
                          : "0 8px 18px rgba(37,99,235,0.22)"
                        : "none",
                      transition: "all 180ms ease",
                      lineHeight: 1,
                    })}
                  >
                    {item.label === "Shop" ? "Shop by Category" : item.label}
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
            <button
              aria-label="Search"
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "14px",
                border: softBorder,
                background: softSurface,
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

            <button
              aria-label="Account"
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "14px",
                border: softBorder,
                background: softSurface,
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

            <button
              aria-label="Cart"
              onClick={() => navigate(`${base}/cart`)}
              style={{
                position: "relative",
                height: "42px",
                minWidth: "48px",
                padding: "0 14px",
                borderRadius: "14px",
                border: softBorder,
                background: light ? "#0f172a" : "#ffffff",
                color: light ? "#ffffff" : "#0f172a",
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;