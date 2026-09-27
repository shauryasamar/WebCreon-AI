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
  muted_text_color?: string;
  soft_text_color?: string;
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

  [key: string]: any;
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
      : (theme?.soft_border || "rgba(15, 23, 42, 0.08)"));

  // Guard against stark pure black or dark charcoal becoming the interactive accent CTA
  const rawAccent = theme?.accent_color;
  const isAccentStarkDark = !rawAccent || rawAccent.toLowerCase() === "#000000" || rawAccent.toLowerCase() === "#0f172a" || rawAccent.toLowerCase() === "#111827" || rawAccent.toLowerCase() === "#18181b";
  const accentColor = isAccentStarkDark ? (isDark ? "#3b82f6" : "#2563eb") : rawAccent;
  const accentHover = theme?.accent_hover || (isDark ? "#60a5fa" : "#1d4ed8");
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

export type AdminThemeMode = "light" | "dark" | "system";

export type AdminThemeTokens = {
  isDark: boolean;
  mode: AdminThemeMode;
  
  // Surfaces & Backgrounds
  workspaceBg: string;       // Dark: deep charcoal/slate #090d16 (Light: #f8fafc)
  surfaceBg: string;         // Dark: refined charcoal/slate #111827 (Light: #ffffff)
  elevatedSurfaceBg: string; // Dark: #1a233a (Light: #f8fafc)
  subtleBg: string;          // Dark: rgba(255, 255, 255, 0.04) (Light: rgba(15, 23, 42, 0.03))
  
  // Borders & Dividers
  border: string;            // Dark: rgba(255, 255, 255, 0.08) (Light: rgba(15, 23, 42, 0.08))
  softBorder: string;        // Dark: rgba(255, 255, 255, 0.05) (Light: rgba(15, 23, 42, 0.04))
  divider: string;           // Dark: rgba(255, 255, 255, 0.08) (Light: #e2e8f0)
  
  // Typography
  textPrimary: string;       // Dark: #f8fafc (Light: #0f172a)
  textSecondary: string;     // Dark: #94a3b8 (Light: #64748b)
  textMuted: string;         // Dark: #64748b (Light: #94a3b8)
  textDisabled: string;      // Dark: #475569 (Light: #cbd5e1)
  
  // Interactive & Accents (WebCreon Blue)
  accent: string;            // WebCreon Blue #3b82f6 (Light: #2563eb)
  accentHover: string;       // #60a5fa (Light: #1d4ed8)
  accentBg: string;          // Dark: rgba(37, 99, 235, 0.16) (Light: rgba(37, 99, 235, 0.09))
  accentBorder: string;      // Dark: rgba(59, 130, 246, 0.35) (Light: rgba(37, 99, 235, 0.16))
  accentText: string;        // Dark: #60a5fa (Light: #1d4ed8)
  
  // Interactive states
  hoverBg: string;           // Dark: rgba(255, 255, 255, 0.05) (Light: rgba(15, 23, 42, 0.04))
  activeBg: string;          // Dark: rgba(255, 255, 255, 0.09) (Light: #f1f5f9)
  
  // Semantic colors
  success: string;           // #10b981
  successBg: string;         // Dark: rgba(16, 185, 129, 0.15) (Light: #ecfdf5)
  warning: string;           // #f59e0b
  warningBg: string;         // Dark: rgba(245, 158, 11, 0.15) (Light: #fffbeb)
  danger: string;            // #ef4444
  dangerBg: string;          // Dark: rgba(239, 68, 68, 0.15) (Light: #fef2f2)
  
  // Shadows
  shadow: string;            // Dark: 0 8px 24px rgba(0, 0, 0, 0.45) (Light: 0 8px 24px rgba(15, 23, 42, 0.06))
};

export const ADMIN_LIGHT_TOKENS: AdminThemeTokens = {
  isDark: false,
  mode: "light",
  workspaceBg: "#f8fafc",
  surfaceBg: "#ffffff",
  elevatedSurfaceBg: "#f8fafc",
  subtleBg: "rgba(15, 23, 42, 0.03)",
  border: "rgba(15, 23, 42, 0.08)",
  softBorder: "rgba(15, 23, 42, 0.04)",
  divider: "#e2e8f0",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  textDisabled: "#cbd5e1",
  accent: "#2563eb",
  accentHover: "#1d4ed8",
  accentBg: "rgba(37, 99, 235, 0.09)",
  accentBorder: "rgba(37, 99, 235, 0.16)",
  accentText: "#1d4ed8",
  hoverBg: "rgba(15, 23, 42, 0.04)",
  activeBg: "#f1f5f9",
  success: "#10b981",
  successBg: "#ecfdf5",
  warning: "#f59e0b",
  warningBg: "#fffbeb",
  danger: "#ef4444",
  dangerBg: "#fef2f2",
  shadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

export const ADMIN_DARK_TOKENS: AdminThemeTokens = {
  isDark: true,
  mode: "dark",
  workspaceBg: "#121214",
  surfaceBg: "#18181b",
  elevatedSurfaceBg: "#242429",
  subtleBg: "rgba(255, 255, 255, 0.035)",
  border: "rgba(255, 255, 255, 0.10)",
  softBorder: "rgba(255, 255, 255, 0.05)",
  divider: "rgba(255, 255, 255, 0.12)",
  textPrimary: "#f4f4f5",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  textDisabled: "#52525b",
  accent: "#3b82f6",
  accentHover: "#60a5fa",
  accentBg: "rgba(59, 130, 246, 0.12)",
  accentBorder: "rgba(59, 130, 246, 0.28)",
  accentText: "#60a5fa",
  hoverBg: "rgba(255, 255, 255, 0.05)",
  activeBg: "rgba(255, 255, 255, 0.08)",
  success: "#10b981",
  successBg: "rgba(16, 185, 129, 0.15)",
  warning: "#f59e0b",
  warningBg: "rgba(245, 158, 11, 0.15)",
  danger: "#ef4444",
  dangerBg: "rgba(239, 68, 68, 0.15)",
  shadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
};

export function getThemeCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)app_theme_mode=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export function setThemeCookie(mode: string, days = 365): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `app_theme_mode=${encodeURIComponent(mode)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getStoredThemeMode(): AdminThemeMode {
  try {
    const saved = localStorage.getItem("app_theme_mode");
    if (saved === "dark" || saved === "light" || saved === "system") return saved;
  } catch (_) {}
  try {
    const cookieSaved = getThemeCookie();
    if (cookieSaved === "dark" || cookieSaved === "light" || cookieSaved === "system") return cookieSaved as AdminThemeMode;
  } catch (_) {}
  return "light";
}

export function isSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

import { API_BASE_URL } from "../config/api";

function syncThemeToBackend(mode: AdminThemeMode) {
  if (typeof window === "undefined") return;
  try {
    fetch(`${API_BASE_URL}/auth/admin/theme`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ theme_preference: mode }),
    }).catch(() => {});
  } catch (_) {}
}

export type AdminThemeContextValue = {
  themeMode: AdminThemeMode;
  isDark: boolean;
  tokens: AdminThemeTokens;
  setThemeMode: (mode: AdminThemeMode) => void;
};

export const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export const useAdminTheme = (): AdminThemeContextValue => {
  const context = useContext(AdminThemeContext);
  if (context) {
    return context;
  }
  // Fallback if rendered outside provider
  const mode = getStoredThemeMode();
  const dark = mode === "dark" || (mode === "system" && isSystemDark());
  return {
    themeMode: mode,
    isDark: dark,
    tokens: dark ? { ...ADMIN_DARK_TOKENS, mode } : { ...ADMIN_LIGHT_TOKENS, mode },
    setThemeMode: (newMode: AdminThemeMode) => {
      try {
        localStorage.setItem("app_theme_mode", newMode);
      } catch (_) {}
      try {
        setThemeCookie(newMode, 365);
      } catch (_) {}
      window.dispatchEvent(new CustomEvent("wc-theme-change", { detail: newMode }));
      syncThemeToBackend(newMode);
    },
  };
};

export const AdminThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = React.useState<AdminThemeMode>(getStoredThemeMode);
  const [systemIsDark, setSystemIsDark] = React.useState<boolean>(isSystemDark);

  React.useEffect(() => {
    const mediaQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const mediaHandler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", mediaHandler);
    }
    const storageHandler = () => {
      setThemeModeState(getStoredThemeMode());
    };
    const customThemeHandler = (e: Event) => {
      const customEvent = e as CustomEvent<AdminThemeMode>;
      if (customEvent.detail) {
        setThemeModeState(customEvent.detail);
      } else {
        setThemeModeState(getStoredThemeMode());
      }
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener("wc-theme-change", customThemeHandler);

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", mediaHandler);
      }
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("wc-theme-change", customThemeHandler);
    };
  }, []);

  const isDark = themeMode === "dark" || (themeMode === "system" && systemIsDark);
  const tokens: AdminThemeTokens = React.useMemo(
    () => (isDark ? { ...ADMIN_DARK_TOKENS, mode: themeMode } : { ...ADMIN_LIGHT_TOKENS, mode: themeMode }),
    [isDark, themeMode]
  );

  const isCurrentAdminRoute = React.useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname.toLowerCase();
    return (
      path.startsWith("/admin") ||
      path.startsWith("/builder") ||
      path.startsWith("/tenant") ||
      path.startsWith("/support-agent") ||
      path.startsWith("/merchant")
    );
  }, []);

  const [isAdminPath, setIsAdminPath] = React.useState<boolean>(isCurrentAdminRoute);

  React.useEffect(() => {
    const handleRouteCheck = () => {
      setIsAdminPath(isCurrentAdminRoute());
    };
    window.addEventListener("popstate", handleRouteCheck);
    // Observe DOM mutations or URL changes
    const interval = setInterval(handleRouteCheck, 300);
    return () => {
      window.removeEventListener("popstate", handleRouteCheck);
      clearInterval(interval);
    };
  }, [isCurrentAdminRoute]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    // Always set CSS variables so admin components have access to tokens
    root.style.setProperty("--admin-surface", tokens.surfaceBg);
    root.style.setProperty("--admin-elevated-surface", tokens.elevatedSurfaceBg);
    root.style.setProperty("--admin-workspace", tokens.workspaceBg);
    root.style.setProperty("--admin-border", tokens.border);
    root.style.setProperty("--admin-soft-border", tokens.softBorder);
    root.style.setProperty("--admin-text-primary", tokens.textPrimary);
    root.style.setProperty("--admin-text-secondary", tokens.textSecondary);
    root.style.setProperty("--admin-text-muted", tokens.textMuted);
    root.style.setProperty("--admin-accent", tokens.accent);
    root.style.setProperty("--admin-accent-bg", tokens.accentBg);
    root.style.setProperty("--admin-accent-border", tokens.accentBorder);
    root.style.setProperty("--admin-accent-text", tokens.accentText);
    root.style.setProperty("--admin-hover-bg", tokens.hoverBg);
    root.style.setProperty("--admin-active-bg", tokens.activeBg);
    root.style.setProperty("--admin-shadow", tokens.shadow);

    if (isAdminPath) {
      root.style.backgroundColor = tokens.workspaceBg;
      root.style.color = tokens.textPrimary;
      root.style.colorScheme = isDark ? "dark" : "light";
      root.setAttribute("data-theme", isDark ? "dark" : "light");
      if (document.body) {
        document.body.style.backgroundColor = tokens.workspaceBg;
        document.body.style.color = tokens.textPrimary;
        document.body.style.colorScheme = isDark ? "dark" : "light";
      }
      const rootEl = document.getElementById("root");
      if (rootEl) {
        rootEl.style.backgroundColor = tokens.workspaceBg;
        rootEl.style.color = tokens.textPrimary;
      }
    } else {
      // Storefront route: remove admin global theme bleed completely
      root.removeAttribute("data-theme");
      root.style.backgroundColor = "";
      root.style.color = "";
      root.style.colorScheme = "";
      if (document.body) {
        document.body.style.backgroundColor = "";
        document.body.style.color = "";
        document.body.style.colorScheme = "";
      }
      const rootEl = document.getElementById("root");
      if (rootEl) {
        rootEl.style.backgroundColor = "";
        rootEl.style.color = "";
      }
    }
  }, [tokens, isDark, isAdminPath]);

  const setThemeMode = (mode: AdminThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem("app_theme_mode", mode);
    } catch (_) {}
    try {
      setThemeCookie(mode, 365);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("wc-theme-change", { detail: mode }));
    syncThemeToBackend(mode);
  };

  return (
    <AdminThemeContext.Provider value={{ themeMode, isDark, tokens, setThemeMode }}>
      {children}
    </AdminThemeContext.Provider>
  );
};
