import React, { createContext, useContext } from "react";

export type SiteTheme = {
  name?: string;
  mode?: "light" | "dark" | string;
  brand_tone?: string;
  visual_style?: string;
  design_direction?: string;
  
  primary_bg?: string;
  secondary_bg?: string;
  text_color?: string;
  muted_text?: string;
  accent_color?: string;
  accent_hover?: string;
  accent_text?: string;
  border_color?: string;
  soft_border?: string;
  
  navbar_layout?: string;
  navbar_variant?: string;
  navbar_position?: string;
  navbar_bg?: string;
  navbar_text_color?: string;
  navbar_border_color?: string;
  
  footer_layout?: string;
  footer_bg?: string;
  footer_text_color?: string;
  footer_muted_color?: string;
  
  hero_bg?: string;
  hero_text_color?: string;
  hero_accent?: string;
  
  card_style?: string;
  card_bg?: string;
  card_shadow?: string;
  
  festival_theme?: string;
  logo_height?: number | string;
  logo_fit?: string;
};

export function isColorDarkHex(colorHex?: string): boolean {
  if (!colorHex || typeof colorHex !== "string") return false;
  if (colorHex.startsWith("rgb")) {
    const match = colorHex.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
    }
  }
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  }
  return false;
}

export function getContrastTextColor(bgHex?: string, fallbackLight = "#ffffff", fallbackDark = "#0f172a"): string {
  if (!bgHex) return fallbackDark;
  return isColorDarkHex(bgHex) ? fallbackLight : fallbackDark;
}

export type ResolvedThemeTokens = {
  isDark: boolean;
  primaryBg: string;
  secondaryBg: string;
  cardBg: string;
  textColor: string;
  mutedTextColor: string;
  softTextColor: string;
  borderColor: string;
  softBorderColor: string;
  accentColor: string;
  accentHover: string;
  accentText: string;
  panelBg: string;
  inputBg: string;
  subtleBg: string;
  shadow: string;
};

export function resolveThemeTokens(theme?: SiteTheme | Record<string, any> | null): ResolvedThemeTokens {
  const isDark =
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    (theme?.secondary_bg ? isColorDarkHex(theme.secondary_bg) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false) ||
    theme?.mode === "dark";

  const primaryBg = theme?.primary_bg || (isDark ? "#0f172a" : "#ffffff");
  const secondaryBg = theme?.secondary_bg || (isDark ? "#1e293b" : "#f8fafc");
  const cardBg =
    theme?.card_bg ||
    (isDark
      ? (theme?.secondary_bg && isColorDarkHex(theme.secondary_bg) ? theme.secondary_bg : "#1e293b")
      : (theme?.secondary_bg && !isColorDarkHex(theme.secondary_bg) ? theme.secondary_bg : "#ffffff"));

  const textColor = theme?.text_color || (isDark ? "#f8fafc" : "#0f172a");
  const mutedTextColor =
    (isDark
      ? (theme?.muted_text && !isColorDarkHex(theme.muted_text) ? theme.muted_text : (theme?.muted_text_color && !isColorDarkHex(theme.muted_text_color) ? theme.muted_text_color : "rgba(248, 250, 252, 0.72)"))
      : (theme?.muted_text && isColorDarkHex(theme.muted_text) ? theme.muted_text : (theme?.muted_text_color && isColorDarkHex(theme.muted_text_color) ? theme.muted_text_color : "rgba(15, 23, 42, 0.65)")));

  const softTextColor =
    (isDark
      ? (theme?.soft_text_color && !isColorDarkHex(theme.soft_text_color) ? theme.soft_text_color : "rgba(248, 250, 252, 0.50)")
      : (theme?.soft_text_color && isColorDarkHex(theme.soft_text_color) ? theme.soft_text_color : "rgba(15, 23, 42, 0.45)"));

  const borderColor =
    (isDark
      ? (theme?.border_color && isColorDarkHex(theme.border_color) ? theme.border_color : "rgba(255, 255, 255, 0.14)")
      : (theme?.border_color || "rgba(15, 23, 42, 0.12)"));

  const softBorderColor =
    (isDark
      ? (theme?.soft_border && isColorDarkHex(theme.soft_border) ? theme.soft_border : "rgba(255, 255, 255, 0.08)")
      : (theme?.soft_border || "rgba(15, 23, 42, 0.06)"));

  const accentColor = theme?.accent_color || "#2563eb";
  const accentHover = theme?.accent_hover || (isDark ? "#3b82f6" : "#1d4ed8");
  const accentText = theme?.accent_text || getContrastTextColor(accentColor, "#ffffff", "#0f172a");

  const panelBg = isDark ? "rgba(255, 255, 255, 0.06)" : (primaryBg === "#ffffff" ? "#f8fafc" : "#ffffff");
  const inputBg = isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff";
  const subtleBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(15, 23, 42, 0.03)";
  const shadow = isDark ? "0 12px 32px rgba(0, 0, 0, 0.35)" : "0 10px 30px rgba(15, 23, 42, 0.06)";

  return {
    isDark,
    primaryBg,
    secondaryBg,
    cardBg,
    textColor,
    mutedTextColor,
    softTextColor,
    borderColor,
    softBorderColor,
    accentColor,
    accentHover,
    accentText,
    panelBg,
    inputBg,
    subtleBg,
    shadow,
  };
}

export const ThemeContext = createContext<SiteTheme | null>(null);

export const useTheme = (): SiteTheme => {
  const context = useContext(ThemeContext);
  return context || {};
};

export const ThemeProvider: React.FC<{ theme?: SiteTheme | null; children: React.ReactNode }> = ({
  theme,
  children,
}) => {
  return (
    <ThemeContext.Provider value={theme || null}>
      {children}
    </ThemeContext.Provider>
  );
};
