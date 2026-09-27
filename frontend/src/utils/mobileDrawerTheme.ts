import { isColorDarkHex, resolveThemeTokens } from "../context/ThemeContext";

export interface MobileDrawerThemeTokens {
  isDark: boolean;
  drawerBg: string;
  drawerBorder: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accentColor: string;
  pillColor: string;
  closeBtnBg: string;
  itemBg: string;
  itemActiveBg: string;
  boxShadow: string;
  overlayBg: string;
}

/**
 * Resolves a unified visual theme for all mobile phone bottom sheet drawers
 * (Filter drawer, Sort By drawer, and Notification drawer).
 * Directly matches the webpage's AI-generated theme colors, cards, and styling.
 */
export function resolveMobileDrawerTheme(theme?: any): MobileDrawerThemeTokens {
  const tokens = resolveThemeTokens(theme);
  const isThemeDark = tokens.isDark;

  // Derive drawer background directly from the site's card/surface theme
  const drawerBg =
    theme?.drawer_bg ||
    theme?.dialog_bg ||
    theme?.surface_bg ||
    theme?.card_bg ||
    (isThemeDark ? tokens.cardBg || tokens.secondaryBg || "#1e293b" : tokens.cardBg || tokens.primaryBg || "#ffffff");

  const isDrawerDark = isColorDarkHex(drawerBg);

  // Border colors matching the site's design tokens
  const drawerBorder =
    theme?.filter_border_color ||
    theme?.border_color ||
    tokens.borderColor ||
    (isDrawerDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.10)");

  const cardBorder =
    tokens.softBorderColor ||
    (isDrawerDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.07)");

  // Primary & secondary text safely adapting to the drawer background
  const textPrimary =
    (tokens.textColor && (isColorDarkHex(tokens.textColor) !== isDrawerDark))
      ? tokens.textColor
      : (isDrawerDark ? "#f8fafc" : "#0f172a");

  const textSecondary =
    (tokens.mutedTextColor && (isColorDarkHex(tokens.mutedTextColor) !== isDrawerDark))
      ? tokens.mutedTextColor
      : (isDrawerDark ? "rgba(248, 250, 252, 0.65)" : "rgba(15, 23, 42, 0.60)");

  // Accent color directly from the site's AI palette
  const accentColor =
    theme?.filter_accent_color ||
    theme?.accent_color ||
    tokens.accentColor ||
    (isDrawerDark ? "#60a5fa" : "#2563eb");

  const pillColor = isDrawerDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.18)";
  const closeBtnBg = isDrawerDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
  const itemBg = isDrawerDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.025)";
  const itemActiveBg = `${accentColor}18`;

  const boxShadow = isDrawerDark
    ? "0 -12px 45px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)"
    : "0 -12px 35px rgba(15, 23, 42, 0.16)";

  const overlayBg = "rgba(0, 0, 0, 0.55)";

  return {
    isDark: isDrawerDark,
    drawerBg,
    drawerBorder,
    cardBorder,
    textPrimary,
    textSecondary,
    accentColor,
    pillColor,
    closeBtnBg,
    itemBg,
    itemActiveBg,
    boxShadow,
    overlayBg,
  };
}
