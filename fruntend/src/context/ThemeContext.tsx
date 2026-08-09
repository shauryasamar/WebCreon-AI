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
