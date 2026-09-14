import { isColorDarkHex } from "../context/ThemeContext";

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
 * Ensures exact aesthetic consistency across colors, surfaces, borders, and controls.
 */
export function resolveMobileDrawerTheme(theme?: any): MobileDrawerThemeTokens {
  const isDark =
    theme?.mode === "dark" ||
    (theme?.dialog_bg ? isColorDarkHex(theme.dialog_bg) : false) ||
    (theme?.surface_bg ? isColorDarkHex(theme.surface_bg) : false) ||
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    (theme?.card_bg ? isColorDarkHex(theme.card_bg) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false);

  // Consistent surface background for phone drawers
  const drawerBg =
    theme?.drawer_bg ||
    theme?.dialog_bg ||
    theme?.surface_bg ||
    (isDark
      ? (theme?.card_bg && isColorDarkHex(theme.card_bg)
          ? theme.card_bg
          : (theme?.primary_bg && isColorDarkHex(theme.primary_bg) ? theme.primary_bg : "#0f172a"))
      : (theme?.card_bg && !isColorDarkHex(theme.card_bg) && theme.card_bg !== "transparent" && theme.card_bg !== "#ffffff"
          ? theme.card_bg
          : (theme?.primary_bg && !isColorDarkHex(theme.primary_bg) && theme.primary_bg !== "transparent" && theme.primary_bg !== "#ffffff"
              ? theme.primary_bg
              : "#ffffff")));

  const isDrawerDark = isColorDarkHex(drawerBg);

  const drawerBorder =
    theme?.filter_border_color ||
    theme?.border_color ||
    (isDrawerDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.10)");

  const cardBorder = isDrawerDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.07)";

  const textPrimary =
    (isDrawerDark
      ? (theme?.text_color && !isColorDarkHex(theme.text_color) ? theme.text_color : "#f8fafc")
      : (theme?.text_color && isColorDarkHex(theme.text_color) ? theme.text_color : "#0f172a"));

  const textSecondary =
    (isDrawerDark
      ? (theme?.muted_text_color && !isColorDarkHex(theme.muted_text_color)
          ? theme.muted_text_color
          : "rgba(248, 250, 252, 0.65)")
      : (theme?.muted_text_color && isColorDarkHex(theme.muted_text_color)
          ? theme.muted_text_color
          : "rgba(15, 23, 42, 0.60)"));

  const accentColor =
    theme?.filter_accent_color ||
    theme?.accent_color ||
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
