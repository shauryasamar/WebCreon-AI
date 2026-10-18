import { editorRegistry } from "./editorRegistry";
import { EditableBlockConfig, EditorField } from "./editorTypes";
import {
  isColorDarkHex,
  isRedOrDestructiveColor,
  getSafePriceColor,
  getAccessibleBrandColor,
} from "../context/ThemeContext";

export {
  isColorDarkHex,
  isRedOrDestructiveColor,
  getSafePriceColor,
  getAccessibleBrandColor,
};

export type EditorBlock = {
  id: string;
  type: string;
  props?: Record<string, any>;
  data_source?: string | null;
  datasource?: string | null;
  actions?: Record<string, any>;
};

export type EditorPage = {
  id: string;
  name: string;
  route: string;
  blocks: EditorBlock[];
  role?: string;
  flow?: string;
  show_in_nav?: boolean;
  showinnav?: boolean;
  page_type?: string;
};

export type EditorSiteDefinition = {
  id?: string;
  saved_themes?: any[];
  site: {
    site_type: string;
    domain: string | null;
    region: string | null;
    brand_name: string | null;
    catalog_type?: string | null;
    target_audience?: string | null;
  };
  theme: {
    name?: string;
    mode?: string;
    brand_tone?: string;
    visual_style?: string;
    design_direction?: string;
    primary_bg?: string;
    secondary_bg?: string;
    hero_bg?: string;
    hero_text_color?: string;
    hero_accent?: string;
    card_bg?: string;
    card_shadow?: string;
    text_color?: string;
    accent_color?: string;
    festival_theme?: string;
    navbar_variant?: "solid" | "soft" | "floating" | "transparent";
    navbar_position?: "static" | "sticky" | "fixed";
    navbar_outer_bg?: string;
    navbar_bg?: string;
    navbar_text_color?: string;
    navbar_muted_text_color?: string;
    navbar_border_color?: string;
    navbar_height?: number;
    navbar_max_width?: number | string;
    navbar_radius?: number;
    navbar_padding_x?: number;
    navbar_icon_shape?: "rounded" | "circle" | "square" | "ghost" | "pill";
    navbar_icon_style?: "outline" | "solid" | "duotone";
    navbar_cart_icon_variant?: "cart" | "bag" | "basket";
    navbar_account_icon_variant?: "user_clean" | "user_circle" | "user_rounded";
    navbar_notification_icon_variant?: "bell" | "bell_curved" | "bell_ring";
    navbar_search_icon_variant?: "magnifier" | "search_minimal" | "search_round";
    navbar_icon_size?: number;
    navbar_icon_inner_size?: number;
    navbar_icon_stroke_width?: number;
    navbar_icon_gap?: number;
    navbar_icon_border_enabled?: boolean;
    navbar_icon_bg_enabled?: boolean;
    navbar_icon_color?: string;
    navbar_icon_bg_color?: string;
    navbar_icon_border_color?: string;
    logo_height?: number | string;
    logo_fit?: "contain" | "cover";
    icon_color?: string;
    cart_badge_bg?: string;
    cart_badge_text_color?: string;
    nav_links_color?: string;
    footer_bg?: string;
    footer_text_color?: string;
    footer_muted_color?: string;
    footer_border_color?: string;
    footer_max_width?: string | number;
    footer_layout?: "apple_minimal" | "glassmorphism_premium" | "modern_marketplace" | "luxury_fashion" | "neo_modern";
    [key: string]: any;
  };
  navigation?: {
    storefront?: Array<{
      label: string;
      route: string;
      role?: string;
    }>;
    admin?: Array<{
      label: string;
      route: string;
      role?: string;
    }>;
  };
  navbar?: {
    logoUrl?: string;
    logo_url?: string;
    showSearch?: boolean;
    showAccount?: boolean;
    showCart?: boolean;
  };
  footer?: {
    layout?: string;
    footer_layout?: string;
    copyrightText?: string;
    tagline?: string;
    links?: Array<{ label: string; href: string }>;
    show_social_links?: boolean;
    social_links?: Array<{ platform: string; url: string }>;
  };
  pages: EditorPage[];
  resources: Array<{
    name: string;
    model: string;
    table_name: string;
  }>;
  admin?: {
    enabled?: boolean;
    features?: string[];
  };
  [key: string]: any;
};

export type ThemeMode = "light" | "dark";

export type FestivalThemeKey =
  | "none"
  | "diwali"
  | "christmas"
  | "eid"
  | "holi"
  | "durga_puja"
  | "rakhi";

type ThemeValues = EditorSiteDefinition["theme"];

const GLOBAL_NAVBAR_BLOCK_ID = "global-navbar";
const GLOBAL_FOOTER_BLOCK_ID = "global-footer";

const DEFAULT_LIGHT_THEME: Partial<ThemeValues> = {
  mode: "light",
  primary_bg: "#ffffff",
  secondary_bg: "#f8fafc",
  card_bg: "#ffffff",
  text_color: "#0f172a",
  muted_text_color: "rgba(15,23,42,0.65)",
  accent_color: "#2563eb",
  navbar_bg: "#ffffff",
  navbar_outer_bg: "#ffffff",
  navbar_text_color: "#0f172a",
  navbar_muted_text_color: "rgba(15,23,42,0.65)",
  navbar_border_color: "rgba(15,23,42,0.08)",
  footer_bg: "#ffffff",
  footer_text_color: "#0f172a",
  footer_border_color: "rgba(15,23,42,0.08)",
  hero_bg: "#f8fafc",
  hero_text_color: "#0f172a",
  hero_accent: "#2563eb",
  cart_bg: "#ffffff",
  cart_panel_bg: "#f8fafc",
  cart_card_bg: "#ffffff",
  cart_text_color: "#0f172a",
  cart_accent_color: "#2563eb",
  cart_border_color: "rgba(15,23,42,0.08)",
  summary_bg: "#ffffff",
  summary_card_bg: "#ffffff",
  summary_text_color: "#0f172a",
  summary_accent_color: "#2563eb",
  summary_border_color: "rgba(15,23,42,0.08)",
  product_detail_bg: "#ffffff",
  product_detail_text: "#0f172a",
  product_detail_btn_bg: "#2563eb",
  product_detail_btn_text: "#ffffff",
  badge_bg_color: "rgba(37,99,235,0.08)",
  badge_border_color: "rgba(37,99,235,0.2)",
  product_detail_badge_bg: "rgba(37,99,235,0.08)",
  product_detail_badge_border: "rgba(37,99,235,0.2)",
  profile_dropdown_bg: "#ffffff",
  profile_dropdown_text: "#0f172a",
  profile_dropdown_border: "rgba(15,23,42,0.08)",
  delivery_form_bg: "#ffffff",
  delivery_form_text: "#0f172a",
  delivery_form_border: "rgba(15,23,42,0.08)",
  delivery_form_btn_bg: "#2563eb",
  delivery_form_btn_text: "#ffffff",
  payment_bg: "#ffffff",
  payment_card_bg: "#ffffff",
  payment_text_color: "#0f172a",
  payment_accent_color: "#2563eb",
  payment_border_color: "rgba(15,23,42,0.08)",
  place_order_bg: "#ffffff",
  place_order_btn_bg: "#2563eb",
  place_order_btn_text: "#ffffff",
  order_history_bg: "#ffffff",
  order_history_card_bg: "#ffffff",
  order_history_text: "#0f172a",
  order_history_muted_text: "rgba(15,23,42,0.65)",
  order_history_border: "rgba(15,23,42,0.08)",
  order_history_accent_color: "#2563eb",
  support_bg: "#ffffff",
  support_card_bg: "#ffffff",
  support_chat_bg: "#ffffff",
  support_text_color: "#0f172a",
  support_muted_text: "rgba(15,23,42,0.65)",
  support_accent_color: "#2563eb",
  support_border_color: "rgba(15,23,42,0.08)",
  card_bg_color: "#ffffff",
  card_text_color: "#0f172a",
  product_name_color: "#0f172a",
  price_color: "#0f172a",
  card_price_color: "#0f172a",
  brand_color: "#2563eb",
  card_brand_color: "#2563eb",
  card_border_color: "rgba(15,23,42,0.08)",
};

const DEFAULT_DARK_THEME: Partial<ThemeValues> = {
  mode: "dark",
  primary_bg: "#121316",
  secondary_bg: "#1a1c21",
  card_bg: "#22252b",
  text_color: "#f8fafc",
  muted_text_color: "rgba(248, 250, 252, 0.72)",
  accent_color: "#3b82f6",
  navbar_bg: "#121316",
  navbar_outer_bg: "#121316",
  navbar_text_color: "#f8fafc",
  navbar_muted_text_color: "rgba(248, 250, 252, 0.72)",
  navbar_border_color: "rgba(255, 255, 255, 0.1)",
  footer_bg: "#0e0f12",
  footer_text_color: "#f8fafc",
  footer_border_color: "rgba(255, 255, 255, 0.1)",
  hero_bg: "#1a1c21",
  hero_text_color: "#f8fafc",
  hero_accent: "#60a5fa",
  cart_bg: "#121316",
  cart_panel_bg: "#1a1c21",
  cart_card_bg: "#22252b",
  cart_text_color: "#f8fafc",
  cart_accent_color: "#3b82f6",
  cart_border_color: "rgba(255, 255, 255, 0.1)",
  summary_bg: "#121316",
  summary_card_bg: "#22252b",
  summary_text_color: "#f8fafc",
  summary_accent_color: "#3b82f6",
  summary_border_color: "rgba(255, 255, 255, 0.1)",
  product_detail_bg: "#121316",
  product_detail_text: "#f8fafc",
  product_detail_btn_bg: "#3b82f6",
  product_detail_btn_text: "#ffffff",
  badge_bg_color: "rgba(59,130,246,0.15)",
  badge_border_color: "rgba(59,130,246,0.3)",
  product_detail_badge_bg: "rgba(59,130,246,0.15)",
  product_detail_badge_border: "rgba(59,130,246,0.3)",
  profile_dropdown_bg: "#22252b",
  profile_dropdown_text: "#f8fafc",
  profile_dropdown_border: "rgba(255, 255, 255, 0.1)",
  delivery_form_bg: "#22252b",
  delivery_form_text: "#f8fafc",
  delivery_form_border: "rgba(255, 255, 255, 0.1)",
  delivery_form_btn_bg: "#3b82f6",
  delivery_form_btn_text: "#ffffff",
  payment_bg: "#22252b",
  payment_card_bg: "#22252b",
  payment_text_color: "#f8fafc",
  payment_accent_color: "#3b82f6",
  payment_border_color: "rgba(255, 255, 255, 0.1)",
  place_order_bg: "#22252b",
  place_order_btn_bg: "#3b82f6",
  place_order_btn_text: "#ffffff",
  order_history_bg: "#121316",
  order_history_card_bg: "#22252b",
  order_history_text: "#f8fafc",
  order_history_muted_text: "rgba(248, 250, 252, 0.72)",
  order_history_border: "rgba(255, 255, 255, 0.1)",
  order_history_accent_color: "#3b82f6",
  support_bg: "#121316",
  support_card_bg: "#22252b",
  support_chat_bg: "#121316",
  support_text_color: "#f8fafc",
  support_muted_text: "rgba(248, 250, 252, 0.72)",
  support_accent_color: "#3b82f6",
  support_border_color: "rgba(255, 255, 255, 0.1)",
  card_bg_color: "#22252b",
  card_text_color: "#f8fafc",
  product_name_color: "#f8fafc",
  price_color: "#ffffff",
  card_price_color: "#ffffff",
  brand_color: "#60a5fa",
  card_brand_color: "#60a5fa",
  card_border_color: "rgba(255, 255, 255, 0.1)",
};

export const FESTIVAL_THEME_PRESETS: Record<
  FestivalThemeKey,
  { festival_theme: FestivalThemeKey }
> = {
  none: { festival_theme: "none" },
  diwali: { festival_theme: "diwali" },
  christmas: { festival_theme: "christmas" },
  eid: { festival_theme: "eid" },
  holi: { festival_theme: "holi" },
  durga_puja: { festival_theme: "durga_puja" },
  rakhi: { festival_theme: "rakhi" },
};

function buildGlobalNavbarBlock(siteDefinition: EditorSiteDefinition): EditorBlock {
  return {
    id: GLOBAL_NAVBAR_BLOCK_ID,
    type: "navbar",
    props: {
      brandName: siteDefinition.site?.brand_name || "Website",
      logoUrl: siteDefinition.navbar?.logoUrl || siteDefinition.navbar?.logo_url || "",
      tagline: siteDefinition.theme?.brand_tone || "",
      navigation: siteDefinition.navigation || {
        storefront: [],
        admin: [],
      },
      showSearch: siteDefinition.navbar?.showSearch ?? true,
      showAccount: siteDefinition.navbar?.showAccount ?? true,
      showCart: siteDefinition.navbar?.showCart ?? true,
    },
  };
}

function buildGlobalFooterBlock(siteDefinition: EditorSiteDefinition): EditorBlock {
  return {
    id: GLOBAL_FOOTER_BLOCK_ID,
    type: "footer",
    props: {
      brandName: siteDefinition.site?.brand_name || "Website",
      copyrightText: siteDefinition.footer?.copyrightText || `© ${new Date().getFullYear()} ${siteDefinition.site?.brand_name || "Website"}. All rights reserved.`,
      tagline: siteDefinition.footer?.tagline || siteDefinition.theme?.brand_tone || "Your premium shopping destination.",
      links: siteDefinition.footer?.links || [
        { label: "About Us", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
      show_social_links: siteDefinition.footer?.show_social_links ?? true,
      social_links: siteDefinition.footer?.social_links || [
        { platform: "Instagram", url: "https://instagram.com" },
        { platform: "Twitter / X", url: "https://x.com" },
        { platform: "Facebook", url: "https://facebook.com" },
      ],
    },
  };
}

function getFestivalThemeOverrides(
  preset: FestivalThemeKey,
  mode: ThemeMode
): Partial<ThemeValues> {
  const isDark = mode === "dark";

  switch (preset) {
    case "diwali":
      return {
        ...FESTIVAL_THEME_PRESETS.diwali,
        festival_theme: "diwali",
        primary_bg: isDark ? "#130f1c" : "#fffcf0",
        secondary_bg: isDark ? "#1f1530" : "#ffffff",
        card_bg: isDark ? "#1f1530" : "#ffffff",
        text_color: isDark ? "#fef3c7" : "#78350f",
        muted_text_color: isDark
          ? "rgba(254,243,199,0.72)"
          : "rgba(120,53,15,0.7)",
        accent_color: isDark ? "#fbbf24" : "#d97706",
        navbar_bg: isDark ? "#1a1226" : "#ffffff",
        navbar_outer_bg: isDark ? "#130f1c" : "#fffcf0",
        navbar_text_color: isDark ? "#fef3c7" : "#78350f",
        navbar_muted_text_color: isDark
          ? "rgba(254,243,199,0.72)"
          : "rgba(120,53,15,0.7)",
        navbar_border_color: isDark
          ? "rgba(251,191,36,0.3)"
          : "rgba(217,119,6,0.22)",
        footer_bg: isDark ? "#130f1c" : "#fef3c7",
        footer_text_color: isDark ? "#fef3c7" : "#78350f",
        footer_border_color: isDark
          ? "rgba(251,191,36,0.3)"
          : "rgba(217,119,6,0.22)",
        hero_bg: isDark ? "#241838" : "#fff7ed",
        hero_text_color: isDark ? "#fef3c7" : "#78350f",
        hero_accent: isDark ? "#fbbf24" : "#d97706",
      };

    case "christmas":
      return {
        ...FESTIVAL_THEME_PRESETS.christmas,
        festival_theme: "christmas",
        primary_bg: isDark ? "#07150e" : "#f4fbf7",
        secondary_bg: isDark ? "#0f231a" : "#ffffff",
        card_bg: isDark ? "#0f231a" : "#ffffff",
        text_color: isDark ? "#f0fdf4" : "#0f291e",
        muted_text_color: isDark
          ? "rgba(240,253,244,0.75)"
          : "rgba(15,41,30,0.68)",
        accent_color: isDark ? "#ef4444" : "#dc2626",
        navbar_bg: isDark ? "#0c1e15" : "#ffffff",
        navbar_outer_bg: isDark ? "#07150e" : "#f4fbf7",
        navbar_text_color: isDark ? "#f0fdf4" : "#0f291e",
        navbar_muted_text_color: isDark
          ? "rgba(240,253,244,0.75)"
          : "rgba(15,41,30,0.68)",
        navbar_border_color: isDark
          ? "rgba(239,68,68,0.28)"
          : "rgba(220,38,38,0.2)",
        footer_bg: isDark ? "#07150e" : "#ecfdf5",
        footer_text_color: isDark ? "#f0fdf4" : "#0f291e",
        footer_border_color: isDark
          ? "rgba(239,68,68,0.28)"
          : "rgba(220,38,38,0.2)",
        hero_bg: isDark ? "#10281e" : "#f0fdf4",
        hero_text_color: isDark ? "#f0fdf4" : "#0f291e",
        hero_accent: isDark ? "#ef4444" : "#dc2626",
      };

    case "eid":
      return {
        ...FESTIVAL_THEME_PRESETS.eid,
        festival_theme: "eid",
        primary_bg: isDark ? "#05131f" : "#f0fdfa",
        secondary_bg: isDark ? "#0a2236" : "#ffffff",
        card_bg: isDark ? "#0a2236" : "#ffffff",
        text_color: isDark ? "#f0fdfa" : "#134e4a",
        muted_text_color: isDark
          ? "rgba(240,253,250,0.75)"
          : "rgba(19,78,74,0.7)",
        accent_color: isDark ? "#2dd4bf" : "#0d9488",
        navbar_bg: isDark ? "#081b2c" : "#ffffff",
        navbar_outer_bg: isDark ? "#05131f" : "#f0fdfa",
        navbar_text_color: isDark ? "#f0fdfa" : "#134e4a",
        navbar_muted_text_color: isDark
          ? "rgba(240,253,250,0.75)"
          : "rgba(19,78,74,0.7)",
        navbar_border_color: isDark
          ? "rgba(45,212,191,0.28)"
          : "rgba(13,148,136,0.2)",
        footer_bg: isDark ? "#05131f" : "#e6fffa",
        footer_text_color: isDark ? "#f0fdfa" : "#134e4a",
        footer_border_color: isDark
          ? "rgba(45,212,191,0.28)"
          : "rgba(13,148,136,0.2)",
        hero_bg: isDark ? "#0b263d" : "#e6fffa",
        hero_text_color: isDark ? "#f0fdfa" : "#134e4a",
        hero_accent: isDark ? "#facc15" : "#0d9488",
      };

    case "holi":
      return {
        ...FESTIVAL_THEME_PRESETS.holi,
        festival_theme: "holi",
        primary_bg: isDark ? "#11071c" : "#fff5f8",
        secondary_bg: isDark ? "#1c0e2e" : "#ffffff",
        card_bg: isDark ? "#1c0e2e" : "#ffffff",
        text_color: isDark ? "#fdf4ff" : "#18181b",
        muted_text_color: isDark
          ? "rgba(253,244,255,0.75)"
          : "rgba(24,24,27,0.7)",
        accent_color: isDark ? "#ec4899" : "#db2777",
        navbar_bg: isDark ? "#180c28" : "#ffffff",
        navbar_outer_bg: isDark ? "#11071c" : "#fff5f8",
        navbar_text_color: isDark ? "#fdf4ff" : "#18181b",
        navbar_muted_text_color: isDark
          ? "rgba(253,244,255,0.75)"
          : "rgba(24,24,27,0.7)",
        navbar_border_color: isDark
          ? "rgba(236,72,153,0.3)"
          : "rgba(219,39,119,0.22)",
        footer_bg: isDark ? "#11071c" : "#fdf2f8",
        footer_text_color: isDark ? "#fdf4ff" : "#18181b",
        footer_border_color: isDark
          ? "rgba(236,72,153,0.3)"
          : "rgba(219,39,119,0.22)",
        hero_bg: isDark ? "#221138" : "#fdf2f8",
        hero_text_color: isDark ? "#fdf4ff" : "#18181b",
        hero_accent: isDark ? "#38bdf8" : "#db2777",
      };

    default:
      return {};
  }
}

export const ALL_COMPONENT_OVERRIDE_KEYS = [
  "delivery_form_bg", "delivery_form_text", "delivery_form_input_bg", "delivery_form_input_text", "delivery_form_border", "delivery_form_btn_bg", "delivery_form_btn_text",
  "order_history_bg", "order_history_card_bg", "order_history_text", "order_history_muted_text", "order_history_border",
  "product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text", "badge_bg_color", "badge_border_color", "product_detail_badge_bg", "product_detail_badge_border",
  "cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color", "cart_panel_bg",
  "summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color",
  "payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color",
  "place_order_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text",
  "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color",
  "pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color",
  "review_card_bg", "review_text_color", "review_border_color",
  "checkout_steps_bg", "checkout_steps_border", "checkout_steps_text",
  "notification_drawer_bg", "notification_drawer_text", "notification_bg", "notification_text", "notification_border_color",
  "profile_dropdown_bg", "profile_dropdown_text", "profile_dropdown_border",
  "support_bg", "support_card_bg", "support_chat_bg", "support_surface_bg", "support_text_color", "support_muted_text", "support_accent_color", "support_border_color", "customer_bubble_bg", "customer_bubble_text", "agent_bubble_bg", "agent_bubble_text",
  "grid_bg", "grid_text_color", "outer_bg_color",
  "product_name_color", "product_title_color", "card_title_color", "card_border_color", "subtitle_color", "image_bg",
  "card_price_color", "card_brand_color", "card_text_color"
];

export function applyThemeToPages(pages: EditorPage[], targetTheme: any): EditorPage[] {
  return (pages || []).map((page) => ({
    ...page,
    blocks: (page.blocks || []).map((block) => {
      const btype = String(block.type || "").toLowerCase();
      const bid = String(block.id || "").toLowerCase();
      const isNav = btype === "navbar" || btype === "header";
      const isFooter = btype === "footer";
      const isHero =
        btype === "hero_banner" ||
        btype === "hero" ||
        btype === "banner" ||
        bid === "hero_banner" ||
        bid === "herobanner";

      // Hero banner edits are isolated from theme snapshots and global theme cascading.
      // Always preserve all block props, slides, background, and colors exactly as edited/published.
      if (isHero) {
        return block;
      }

      const isProductDetail =
        btype === "product_detail" ||
        btype === "productdetail" ||
        btype === "product_info" ||
        btype === "productinfo" ||
        btype === "purchase_panel" ||
        btype === "purchasepanel" ||
        btype === "product_gallery" ||
        btype === "productgallery" ||
        String(block.id || "").toLowerCase().includes("product-detail");

      const updatedProps = { ...(block.props || {}) };

      // Delete all hardcoded block-level color overrides across ALL components
      delete updatedProps.card_bg_color;
      delete updatedProps.outer_bg_color;
      delete updatedProps.background_color;
      delete updatedProps.card_bg;
      delete updatedProps.secondary_bg;
      delete updatedProps.primary_bg;
      delete updatedProps.title_color;
      delete updatedProps.brand_color;
      delete updatedProps.price_color;
      delete updatedProps.original_price_color;
      delete updatedProps.rating_star_color;
      delete updatedProps.text_color;
      delete updatedProps.accent_color;
      delete updatedProps.panel_color;
      delete updatedProps.input_color;
      delete updatedProps.border_color;
      delete updatedProps.soft_border_color;
      delete updatedProps.navbar_bg;
      delete updatedProps.navbar_outer_bg;
      delete updatedProps.navbar_text_color;
      delete updatedProps.navbar_border_color;
      delete updatedProps.footer_bg;
      delete updatedProps.footer_text_color;
      delete updatedProps.footer_muted_color;
      delete updatedProps.footer_border_color;
      delete updatedProps.hero_bg;
      delete updatedProps.hero_text_color;
      delete updatedProps.hero_accent;
      delete updatedProps.button_bg_color;
      delete updatedProps.button_text_color;
      delete updatedProps.card_color;
      delete updatedProps.active_bg_color;
      delete updatedProps.badge_bg_color;
      delete updatedProps.badge_border_color;
      delete updatedProps.product_detail_badge_bg;
      delete updatedProps.product_detail_badge_border;
      delete updatedProps.product_name_color;
      delete updatedProps.product_title_color;
      delete updatedProps.card_title_color;
      delete updatedProps.card_border_color;
      delete updatedProps.subtitle_color;
      delete updatedProps.image_bg;
      delete updatedProps.card_price_color;
      delete updatedProps.card_brand_color;
      delete updatedProps.card_text_color;

      for (const k of ALL_COMPONENT_OVERRIDE_KEYS) {
        delete updatedProps[k];
      }

      if (isNav) {
        if (targetTheme.navbar_bg) {
          updatedProps.navbar_bg = targetTheme.navbar_bg;
          updatedProps.navbar_outer_bg = targetTheme.navbar_outer_bg || targetTheme.navbar_bg;
        } else if (targetTheme.navbar_outer_bg) {
          updatedProps.navbar_outer_bg = targetTheme.navbar_outer_bg;
        }
        if (targetTheme.navbar_text_color) updatedProps.navbar_text_color = targetTheme.navbar_text_color;
      } else if (isFooter) {
        if (targetTheme.footer_bg) updatedProps.footer_bg = targetTheme.footer_bg;
        if (targetTheme.footer_text_color) updatedProps.footer_text_color = targetTheme.footer_text_color;
      } else if (isProductDetail) {
        if (targetTheme.badge_bg_color || targetTheme.product_detail_badge_bg) {
          updatedProps.badge_bg_color = targetTheme.badge_bg_color || targetTheme.product_detail_badge_bg;
        }
        if (targetTheme.badge_border_color || targetTheme.product_detail_badge_border) {
          updatedProps.badge_border_color = targetTheme.badge_border_color || targetTheme.product_detail_badge_border;
        }
        if (targetTheme.product_detail_bg) {
          updatedProps.panel_color = targetTheme.product_detail_bg;
          updatedProps.background_color = targetTheme.product_detail_bg;
          updatedProps.product_detail_bg = targetTheme.product_detail_bg;
        }
        if (targetTheme.product_detail_text) {
          updatedProps.text_color = targetTheme.product_detail_text;
          updatedProps.product_detail_text = targetTheme.product_detail_text;
        }
        if (targetTheme.product_detail_btn_bg) {
          updatedProps.button_bg_color = targetTheme.product_detail_btn_bg;
          updatedProps.product_detail_btn_bg = targetTheme.product_detail_btn_bg;
        }
        if (targetTheme.product_detail_btn_text) {
          updatedProps.button_text_color = targetTheme.product_detail_btn_text;
          updatedProps.product_detail_btn_text = targetTheme.product_detail_btn_text;
        }
      } else if (
        btype === "order_history" ||
        btype === "orderhistory" ||
        btype === "order_history_list" ||
        btype === "customer_orders" ||
        btype === "customerorders" ||
        btype === "orders" ||
        block.id === "order_history" ||
        block.id === "customer_orders"
      ) {
        if (targetTheme.order_history_bg) {
          updatedProps.page_bg = targetTheme.order_history_bg;
          updatedProps.order_history_bg = targetTheme.order_history_bg;
        }
        if (targetTheme.order_history_card_bg) {
          updatedProps.card_bg = targetTheme.order_history_card_bg;
          updatedProps.order_history_card_bg = targetTheme.order_history_card_bg;
        }
        if (targetTheme.order_history_text) {
          updatedProps.title_color = targetTheme.order_history_text;
          updatedProps.text_color = targetTheme.order_history_text;
          updatedProps.order_history_text = targetTheme.order_history_text;
        }
        if (targetTheme.order_history_muted_text) {
          updatedProps.subtext_color = targetTheme.order_history_muted_text;
          updatedProps.order_history_muted_text = targetTheme.order_history_muted_text;
        }
        if (targetTheme.order_history_border) {
          updatedProps.border_color = targetTheme.order_history_border;
          updatedProps.order_history_border = targetTheme.order_history_border;
        }
        if (targetTheme.order_history_accent_color) {
          updatedProps.accent_color = targetTheme.order_history_accent_color;
          updatedProps.order_history_accent_color = targetTheme.order_history_accent_color;
        }
        if (targetTheme.order_history_radius !== undefined) {
          updatedProps.card_radius = targetTheme.order_history_radius;
          updatedProps.order_history_radius = targetTheme.order_history_radius;
        }
      } else if (
        btype === "customer_support" ||
        btype === "customersupport" ||
        btype === "support_desk" ||
        btype === "support" ||
        block.id === "customer_support" ||
        block.id === "support"
      ) {
        if (targetTheme.support_bg) {
          updatedProps.primary_bg = targetTheme.support_bg;
          updatedProps.page_bg = targetTheme.support_bg;
          updatedProps.support_bg = targetTheme.support_bg;
        }
        if (targetTheme.support_card_bg) {
          updatedProps.card_bg = targetTheme.support_card_bg;
          updatedProps.support_card_bg = targetTheme.support_card_bg;
        }
        if (targetTheme.support_chat_bg) {
          updatedProps.chat_bg = targetTheme.support_chat_bg;
          updatedProps.support_chat_bg = targetTheme.support_chat_bg;
        }
        if (targetTheme.support_text_color) {
          updatedProps.text_color = targetTheme.support_text_color;
          updatedProps.title_color = targetTheme.support_text_color;
          updatedProps.support_text_color = targetTheme.support_text_color;
        }
        if (targetTheme.support_muted_text) {
          updatedProps.subtext_color = targetTheme.support_muted_text;
          updatedProps.support_muted_text = targetTheme.support_muted_text;
        }
        if (targetTheme.support_border_color) {
          updatedProps.border_color = targetTheme.support_border_color;
          updatedProps.support_border_color = targetTheme.support_border_color;
        }
        if (targetTheme.support_accent_color) {
          updatedProps.accent_color = targetTheme.support_accent_color;
          updatedProps.support_accent_color = targetTheme.support_accent_color;
        }
      } else if (
        btype === "cart" ||
        btype === "cart_view" ||
        btype === "cart_sidebar" ||
        btype === "cart_items" ||
        btype === "order_summary" ||
        bid === "cart" ||
        bid === "cart_sidebar" ||
        bid === "cart_view" ||
        bid === "cart_items" ||
        bid === "order_summary" ||
        bid === "checkout_order_summary" ||
        bid.includes("cart")
      ) {
        const isOrderSummaryBlock = btype === "order_summary" || bid === "order_summary" || bid === "checkout_order_summary";
        const summaryBg = isOrderSummaryBlock && targetTheme.order_summary_bg ? targetTheme.order_summary_bg : (targetTheme.cart_bg || targetTheme.primary_bg);
        const summaryCardBg = isOrderSummaryBlock && (targetTheme.order_summary_card_bg || targetTheme.order_summary_bg) ? (targetTheme.order_summary_card_bg || targetTheme.order_summary_bg) : (targetTheme.cart_card_bg || targetTheme.card_bg);
        const summaryText = isOrderSummaryBlock && targetTheme.order_summary_text ? targetTheme.order_summary_text : (targetTheme.cart_text_color || targetTheme.text_color);
        const summaryAccent = isOrderSummaryBlock && targetTheme.order_summary_accent ? targetTheme.order_summary_accent : (targetTheme.cart_accent_color || targetTheme.accent_color);
        const summaryBorder = isOrderSummaryBlock && targetTheme.order_summary_border ? targetTheme.order_summary_border : (targetTheme.cart_border_color || targetTheme.navbar_border_color || targetTheme.card_border_color);

        if (summaryBg) {
          updatedProps.background_color = summaryBg;
          updatedProps.cart_bg = summaryBg;
        }
        if (targetTheme.cart_panel_bg || (isOrderSummaryBlock && targetTheme.order_summary_bg)) {
          const panelBg = isOrderSummaryBlock && targetTheme.order_summary_bg ? targetTheme.order_summary_bg : targetTheme.cart_panel_bg;
          updatedProps.panel_color = panelBg;
          updatedProps.cart_panel_bg = panelBg;
        } else if (targetTheme.card_bg) {
          updatedProps.panel_color = targetTheme.card_bg;
          updatedProps.cart_panel_bg = targetTheme.card_bg;
        }
        if (summaryCardBg) {
          updatedProps.card_color = summaryCardBg;
          updatedProps.card_bg = summaryCardBg;
          updatedProps.cart_card_bg = summaryCardBg;
        }
        if (summaryText) {
          updatedProps.text_color = summaryText;
          updatedProps.cart_text_color = summaryText;
          updatedProps.title_color = summaryText;
        }
        if (summaryAccent) {
          updatedProps.accent_color = summaryAccent;
          updatedProps.cart_accent_color = summaryAccent;
        }
        if (summaryBorder) {
          updatedProps.border_color = summaryBorder;
          updatedProps.cart_border_color = summaryBorder;
        }
      } else if (
        btype === "profile" ||
        btype === "profile_details" ||
        bid === "profile" ||
        bid === "profile_details" ||
        bid.includes("profile")
      ) {
        if (targetTheme.card_bg) {
          updatedProps.card_bg = targetTheme.card_bg;
        }
        if (targetTheme.primary_bg) {
          updatedProps.page_bg = targetTheme.primary_bg;
        }
        if (targetTheme.text_color) {
          updatedProps.text_color = targetTheme.text_color;
        }
        if (targetTheme.accent_color) {
          updatedProps.accent_color = targetTheme.accent_color;
        }
      } else if (
        btype === "product_grid" ||
        btype === "productgrid" ||
        btype === "product_carousel" ||
        btype === "productcarousel" ||
        btype === "section_group_carousel" ||
        btype === "category_grid"
      ) {
        if (targetTheme.card_bg) {
          updatedProps.card_bg_color = targetTheme.card_bg;
        }
        if (targetTheme.card_text_color || targetTheme.product_name_color || targetTheme.text_color) {
          updatedProps.product_name_color = targetTheme.card_text_color || targetTheme.product_name_color || targetTheme.text_color;
        }
        if (targetTheme.card_border_color || targetTheme.navbar_border_color) {
          updatedProps.card_border_color = targetTheme.card_border_color || targetTheme.navbar_border_color;
        }
        const isDarkTheme = targetTheme?.mode === "dark" || isColorDarkHex(targetTheme?.primary_bg);
        if (targetTheme.brand_color || targetTheme.accent_color) {
          updatedProps.brand_color = targetTheme.brand_color || targetTheme.accent_color;
        }
        if (targetTheme.price_color) {
          updatedProps.price_color = getSafePriceColor(
            targetTheme.price_color,
            targetTheme.card_text_color || targetTheme.product_name_color || targetTheme.text_color || (isDarkTheme ? "#ffffff" : "#0f172a"),
            isDarkTheme,
            targetTheme.card_bg
          );
        } else {
          updatedProps.price_color = isDarkTheme ? "#ffffff" : "#0f172a";
        }
      } else if (
        btype === "checkout_steps" ||
        btype === "checkoutsteps" ||
        btype === "checkout_stepper" ||
        bid === "checkout_steps"
      ) {
        if (targetTheme.checkout_steps_bg || targetTheme.card_bg) {
          updatedProps.background_color = targetTheme.checkout_steps_bg || targetTheme.card_bg;
        }
        if (targetTheme.checkout_steps_border || targetTheme.place_order_border) {
          updatedProps.border_color = targetTheme.checkout_steps_border || targetTheme.place_order_border;
        }
        if (targetTheme.accent_color) {
          updatedProps.active_step_bg = targetTheme.accent_color;
          updatedProps.line_active_color = targetTheme.accent_color;
        }
      } else if (
        btype === "delivery_form" ||
        btype === "deliveryform" ||
        btype === "delivery_address_form" ||
        bid === "delivery_form"
      ) {
        if (targetTheme.delivery_form_bg || targetTheme.card_bg) {
          updatedProps.background_color = targetTheme.delivery_form_bg || targetTheme.card_bg;
          updatedProps.card_bg = targetTheme.delivery_form_card_bg || targetTheme.delivery_form_bg || targetTheme.card_bg;
        }
        if (targetTheme.delivery_form_text || targetTheme.text_color) {
          updatedProps.text_color = targetTheme.delivery_form_text || targetTheme.text_color;
          updatedProps.title_color = targetTheme.delivery_form_text || targetTheme.text_color;
        }
        if (targetTheme.delivery_form_border || targetTheme.navbar_border_color) {
          updatedProps.border_color = targetTheme.delivery_form_border || targetTheme.navbar_border_color;
        }
        if (targetTheme.delivery_form_btn_bg || targetTheme.accent_color) {
          updatedProps.button_bg_color = targetTheme.delivery_form_btn_bg || targetTheme.accent_color;
        }
        if (targetTheme.delivery_form_btn_text) {
          updatedProps.button_text_color = targetTheme.delivery_form_btn_text;
        }
      } else if (
        btype === "payment_methods" ||
        btype === "paymentmethods" ||
        bid === "payment_methods" ||
        bid === "payment"
      ) {
        if (targetTheme.payment_bg || targetTheme.card_bg) {
          updatedProps.background_color = targetTheme.payment_bg || targetTheme.card_bg;
          updatedProps.card_bg = targetTheme.payment_card_bg || targetTheme.payment_bg || targetTheme.card_bg;
        }
        if (targetTheme.payment_text_color || targetTheme.text_color) {
          updatedProps.text_color = targetTheme.payment_text_color || targetTheme.text_color;
          updatedProps.title_color = targetTheme.payment_text_color || targetTheme.text_color;
        }
        if (targetTheme.payment_accent_color || targetTheme.accent_color) {
          updatedProps.accent_color = targetTheme.payment_accent_color || targetTheme.accent_color;
        }
        if (targetTheme.payment_border_color || targetTheme.navbar_border_color) {
          updatedProps.border_color = targetTheme.payment_border_color || targetTheme.navbar_border_color;
        }
      } else if (
        btype === "place_order_cta" ||
        btype === "placeordercta" ||
        btype === "checkout_review" ||
        bid === "place_order_cta"
      ) {
        if (targetTheme.place_order_bg || targetTheme.card_bg) {
          updatedProps.background_color = targetTheme.place_order_bg || targetTheme.card_bg;
          updatedProps.card_bg = targetTheme.place_order_card_bg || targetTheme.place_order_bg || targetTheme.card_bg;
        }
        if (targetTheme.place_order_btn_bg || targetTheme.accent_color) {
          updatedProps.button_bg_color = targetTheme.place_order_btn_bg || targetTheme.accent_color;
        }
        if (targetTheme.place_order_btn_text) {
          updatedProps.button_text_color = targetTheme.place_order_btn_text;
        }
        if (targetTheme.place_order_text || targetTheme.text_color) {
          updatedProps.text_color = targetTheme.place_order_text || targetTheme.text_color;
          updatedProps.title_color = targetTheme.place_order_text || targetTheme.text_color;
          updatedProps.section_title_color = targetTheme.place_order_text || targetTheme.text_color;
        }
        if (targetTheme.place_order_border) {
          updatedProps.border_color = targetTheme.place_order_border;
          updatedProps.soft_border_color = targetTheme.place_order_border;
        }
      }

      return {
        ...block,
        props: updatedProps,
      };
    }),
  }));
}

const PRODUCT_DETAIL_BLOCK_TYPES = new Set([
  "product_detail",
  "productdetail",
  "product_info",
  "productinfo",
  "product_gallery",
  "productgallery",
  "purchase_panel",
  "purchasepanel",
]);

const CHECKOUT_BLOCK_TYPES = new Set([
  "checkout_steps",
  "checkoutsteps",
  "checkout_stepper",
  "delivery_form",
  "deliveryform",
  "delivery_map_picker",
  "delivery_address_form",
  "payment_methods",
  "paymentmethods",
  "place_order_cta",
  "placeordercta",
  "checkout_summary",
  "checkoutsummary",
  "checkout_order_summary",
  "checkoutordersummary",
  "order_summary",
  "ordersummary",
]);

export function isProductDetailFallbackId(blockId: string | null | undefined): boolean {
  if (!blockId) return false;
  const lower = String(blockId).toLowerCase();
  if (PRODUCT_DETAIL_BLOCK_TYPES.has(lower)) return true;
  if (
    lower.startsWith("auto-product-detail") ||
    lower.startsWith("product-detail") ||
    lower.includes("product-detail")
  ) {
    return true;
  }
  return false;
}

export function isCheckoutFallbackId(blockId: string | null | undefined): boolean {
  if (!blockId) return false;
  const lower = String(blockId).toLowerCase();
  if (CHECKOUT_BLOCK_TYPES.has(lower)) return true;
  if (
    lower.startsWith("auto-checkout") ||
    lower.startsWith("checkout") ||
    lower.includes("checkout") ||
    lower.includes("delivery") ||
    lower.includes("payment") ||
    lower.includes("place")
  ) {
    return true;
  }
  return false;
}

const CART_BLOCK_TYPES = new Set([
  "cart",
  "cart_view",
  "cartview",
  "cart_sidebar",
  "cartsidebar",
  "cart_items",
  "cartitems",
  "order_summary",
  "ordersummary",
]);

export function isCartFallbackId(blockId: string | null | undefined): boolean {
  if (!blockId) return false;
  const lower = String(blockId).toLowerCase();
  if (CART_BLOCK_TYPES.has(lower)) return true;
  if (
    lower.startsWith("auto-cart") ||
    lower.startsWith("cart-") ||
    lower.includes("cart")
  ) {
    return true;
  }
  return false;
}

export function isProductDetailPageRoute(route?: string | null): boolean {
  if (!route) return false;
  const normalized = route.replace(/^\/+/, "").toLowerCase();
  return (
    normalized === "products/:productslug" ||
    normalized === "products/:slug" ||
    normalized === "products/*" ||
    normalized === "product/:productslug" ||
    normalized === "product/:slug" ||
    normalized === "product/:id" ||
    normalized === "product/*" ||
    normalized.includes("/products/") ||
    normalized.includes("/product/")
  );
}

export function isCheckoutPageRoute(route?: string | null): boolean {
  if (!route) return false;
  const normalized = route.replace(/^\/+/, "").toLowerCase();
  return (
    normalized === "checkout" ||
    normalized.includes("/checkout") ||
    normalized.includes("checkout")
  );
}

export function findBlockById(
  siteDefinition: EditorSiteDefinition | null,
  blockId: string | null
): EditorBlock | null {
  if (!siteDefinition || !blockId) return null;

  if (blockId === GLOBAL_NAVBAR_BLOCK_ID || blockId === "navbar") {
    return buildGlobalNavbarBlock(siteDefinition);
  }

  if (blockId === GLOBAL_FOOTER_BLOCK_ID || blockId === "footer") {
    return buildGlobalFooterBlock(siteDefinition);
  }

  if (blockId === "checkout_steps" || blockId === "checkoutsteps" || blockId === "checkout_stepper") {
    for (const page of siteDefinition.pages) {
      const match = page.blocks?.find(
        (block) =>
          block.id === "checkout_steps" ||
          block.type === "checkout_steps" ||
          block.type === "checkoutsteps" ||
          block.id === blockId ||
          block.type === blockId
      );
      if (match) return match;
    }
    return {
      id: "checkout_steps",
      type: "checkout_steps",
      props: {},
    };
  }

  if (
    blockId === "checkout_order_summary" ||
    blockId === "checkoutordersummary" ||
    blockId === "order_summary" ||
    blockId === "ordersummary" ||
    blockId === "checkout_summary" ||
    blockId.includes("summary")
  ) {
    const checkoutP = siteDefinition.pages.find(
      (p) =>
        p.role === "checkout" ||
        p.page_type === "checkout" ||
        (p as any).slug === "checkout" ||
        isCheckoutPageRoute(p.route)
    );
    const inCheckout = checkoutP?.blocks?.find(
      (b) =>
        b.id === "checkout_order_summary" ||
        b.type === "checkout_order_summary" ||
        b.type === "checkoutordersummary" ||
        b.type === "order_summary" ||
        b.id === "order_summary" ||
        b.type === "ordersummary" ||
        b.id === "ordersummary" ||
        String(b.id || "").toLowerCase().includes("summary") ||
        String(b.type || "").toLowerCase().includes("summary")
    );
    if (inCheckout) return inCheckout;
    return {
      id: "checkout_order_summary",
      type: "checkout_order_summary",
      props: {},
    };
  }

  if (blockId === "payment_methods" || blockId === "paymentmethods") {
    const checkoutP = siteDefinition.pages.find(
      (p) =>
        p.role === "checkout" ||
        p.page_type === "checkout" ||
        (p as any).slug === "checkout" ||
        isCheckoutPageRoute(p.route)
    );
    const inCheckout = checkoutP?.blocks?.find(
      (b) =>
        b.id === "payment_methods" ||
        b.type === "payment_methods" ||
        b.type === "paymentmethods"
    );
    if (inCheckout) return inCheckout;
    return {
      id: "payment_methods",
      type: "payment_methods",
      props: {},
    };
  }

  if (
    blockId === "profile_details" ||
    blockId === "profiledetails" ||
    blockId === "profile" ||
    blockId === "customer_profile"
  ) {
    const profileP = siteDefinition.pages.find(
      (p) =>
        p.role === "profile" ||
        p.page_type === "profile" ||
        p.route === "/profile" ||
        p.route === "profile" ||
        p.id === "profile" ||
        p.id === "page-profile"
    );
    const inProfile = profileP?.blocks?.find(
      (b) =>
        b.id === "profile_details" ||
        b.type === "profile_details" ||
        b.type === "profiledetails" ||
        b.type === "profile" ||
        b.type === "customer_profile"
    );
    if (inProfile) return inProfile;
    return {
      id: "profile_details",
      type: "profile_details",
      props: {},
    };
  }

  if (
    blockId === "signin_form" ||
    blockId === "signinform" ||
    blockId === "login_form" ||
    blockId === "loginform" ||
    blockId === "login"
  ) {
    const loginP = siteDefinition.pages.find(
      (p) =>
        p.role === "login" ||
        p.page_type === "login" ||
        p.route === "/login" ||
        p.route === "login" ||
        p.id === "login" ||
        p.id === "page-login"
    );
    const inLogin = loginP?.blocks?.find(
      (b) =>
        b.id === "signin_form" ||
        b.type === "signin_form" ||
        b.type === "signinform" ||
        b.type === "login_form" ||
        b.type === "login"
    );
    if (inLogin) return inLogin;
    return {
      id: "signin_form",
      type: "signin_form",
      props: { max_width: "100%" },
    };
  }

  if (
    blockId === "signup_form" ||
    blockId === "signupform" ||
    blockId === "register_form" ||
    blockId === "registerform" ||
    blockId === "signup"
  ) {
    const signupP = siteDefinition.pages.find(
      (p) =>
        p.role === "signup" ||
        p.page_type === "signup" ||
        p.route === "/signup" ||
        p.route === "signup" ||
        p.id === "signup" ||
        p.id === "page-signup"
    );
    const inSignup = signupP?.blocks?.find(
      (b) =>
        b.id === "signup_form" ||
        b.type === "signup_form" ||
        b.type === "signupform" ||
        b.type === "register_form" ||
        b.type === "signup"
    );
    if (inSignup) return inSignup;
    return {
      id: "signup_form",
      type: "signup_form",
      props: { max_width: "100%" },
    };
  }

  if (
    blockId === "customer_orders" ||
    blockId === "customerorders" ||
    blockId === "orders" ||
    blockId === "order_history" ||
    blockId === "order_history_list"
  ) {
    const ordersP = siteDefinition.pages.find(
      (p) =>
        p.role === "orders" ||
        p.page_type === "orders" ||
        p.route === "/orders" ||
        p.route === "orders" ||
        p.id === "orders" ||
        p.id === "page-orders"
    );
    const inOrders = ordersP?.blocks?.find(
      (b) =>
        b.id === "customer_orders" ||
        b.type === "customer_orders" ||
        b.type === "customerorders" ||
        b.type === "orders" ||
        b.type === "order_history" ||
        b.type === "order_history_list"
    );
    if (inOrders) return inOrders;
    return {
      id: "customer_orders",
      type: "customer_orders",
      props: { max_width: "100%" },
    };
  }

  if (
    blockId === "customer_support" ||
    blockId === "customersupport" ||
    blockId === "support" ||
    blockId === "support_desk" ||
    blockId === "supportdesk"
  ) {
    const isSupportB = (b: any) =>
      b &&
      (b.id === "customer_support" ||
        b.type === "customer_support" ||
        b.type === "customersupport" ||
        b.type === "support" ||
        b.type === "support_desk" ||
        b.type === "supportdesk");

    // 1. Check support page directly
    const supportP = siteDefinition.pages?.find(
      (p) =>
        p.role === "support" ||
        p.page_type === "support" ||
        p.route === "/support" ||
        p.route === "support" ||
        p.id === "support" ||
        p.id === "page-support" ||
        (p as any)?.slug === "support"
    );
    const inSupport = supportP?.blocks?.find(isSupportB);
    if (inSupport) return inSupport;

    // 2. Check all pages for any support block
    for (const page of siteDefinition.pages || []) {
      const match = page.blocks?.find(isSupportB);
      if (match) return match;
    }

    // 3. Check root blocks array if present
    const inRoot = (siteDefinition as any).blocks?.find?.(isSupportB);
    if (inRoot) return inRoot;

    return {
      id: "customer_support",
      type: "customer_support",
      props: { max_width: "100%" },
    };
  }

  for (const page of siteDefinition.pages) {
    const match = page.blocks.find(
      (block) => block.id === blockId || block.type === blockId
    );
    if (match) return match;
  }

  if (isProductDetailFallbackId(blockId)) {
    const pdPage = siteDefinition.pages.find(
      (p) =>
        p.role === "product_detail" ||
        p.page_type === "product_detail" ||
        isProductDetailPageRoute(p.route)
    );

    const existingBlock = pdPage?.blocks.find((b) =>
      PRODUCT_DETAIL_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
    );

    if (existingBlock) return existingBlock;

    return {
      id: blockId,
      type: "product_detail",
      data_source: "product",
      props: pdPage?.blocks?.[0]?.props || {},
    };
  }

  if (isCheckoutFallbackId(blockId)) {
    const checkoutPage = siteDefinition.pages.find(
      (p) =>
        p.role === "checkout" ||
        p.page_type === "checkout" ||
        (p as any).slug === "checkout" ||
        isCheckoutPageRoute(p.route)
    );

    const deliveryFormBlock = checkoutPage?.blocks.find(
      (b) =>
        String(b.type || "").toLowerCase() === "delivery_form" ||
        String(b.id || "").toLowerCase() === "delivery_form" ||
        String(b.type || "").toLowerCase() === "deliveryform"
    );

    if (blockId === "checkout_steps" || blockId === "checkoutsteps" || blockId === "checkout_stepper") {
      const existing = checkoutPage?.blocks.find(
        (b) =>
          String(b.id || "").toLowerCase() === "checkout_steps" ||
          String(b.type || "").toLowerCase() === "checkout_steps" ||
          String(b.type || "").toLowerCase() === "checkoutsteps"
      );
      if (existing) return existing;
      return {
        id: "checkout_steps",
        type: "checkout_steps",
        props: {},
      };
    }

    if (blockId === "delivery_map_picker") {
      return {
        id: "delivery_map_picker",
        type: "delivery_map_picker",
        props: deliveryFormBlock?.props || {},
      };
    }

    if (blockId === "delivery_address_form") {
      return {
        id: "delivery_address_form",
        type: "delivery_address_form",
        props: deliveryFormBlock?.props || {},
      };
    }

    const existingBlock = checkoutPage?.blocks.find(
      (b) =>
        String(b.id || b.type).toLowerCase() === blockId.toLowerCase() ||
        CHECKOUT_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
    );

    if (existingBlock) return existingBlock;

    const targetType = blockId.includes("delivery")
      ? "delivery_form"
      : blockId.includes("payment")
        ? "payment_methods"
        : blockId.includes("place") || blockId.includes("cta")
          ? "place_order_cta"
          : "order_summary";

    return {
      id: blockId,
      type: targetType,
      props: {},
    };
  }

  if (isCartFallbackId(blockId)) {
    const cartPage = siteDefinition.pages.find(
      (p) =>
        p.role === "cart" ||
        p.page_type === "cart" ||
        (p as any).slug === "cart" ||
        p.route === "/cart" ||
        p.route === "cart" ||
        p.blocks.some((b) => CART_BLOCK_TYPES.has(String(b.type || "").toLowerCase()))
    );

    const existingBlock = cartPage?.blocks.find(
      (b) =>
        String(b.id || b.type).toLowerCase() === blockId.toLowerCase() ||
        CART_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
    );

    if (existingBlock) return existingBlock;

    return {
      id: blockId,
      type: "cart_sidebar",
      props: cartPage?.blocks?.[0]?.props || {},
    };
  }

  if (blockId === "hero_banner" || blockId === "herobanner") {
    return {
      id: blockId,
      type: "hero_banner",
      props: {},
    };
  }

  if (blockId === "product_grid" || blockId === "productgrid") {
    return {
      id: blockId,
      type: "product_grid",
      props: {},
    };
  }

  if (blockId === "signin_form" || blockId === "login_form") {
    return {
      id: blockId,
      type: "signin_form",
      props: {},
    };
  }

  if (blockId === "signup_form" || blockId === "register_form") {
    return {
      id: blockId,
      type: "signup_form",
      props: {},
    };
  }

  if (
    blockId === "customer_orders" ||
    blockId === "customerorders" ||
    blockId === "orders" ||
    blockId === "order_history" ||
    blockId === "order_history_list"
  ) {
    return {
      id: blockId,
      type: "customer_orders",
      props: {},
    };
  }

  if (
    blockId === "customer_support" ||
    blockId === "customersupport" ||
    blockId === "support" ||
    blockId === "support_desk" ||
    blockId === "supportdesk"
  ) {
    return {
      id: blockId,
      type: "customer_support",
      props: {},
    };
  }

  return null;
}

export function findBlockLocation(
  siteDefinition: EditorSiteDefinition | null,
  blockId: string | null
): { pageIndex: number; blockIndex: number } | null {
  if (!siteDefinition || !blockId) return null;

  for (let pageIndex = 0; pageIndex < siteDefinition.pages.length; pageIndex += 1) {
    const page = siteDefinition.pages[pageIndex];
    if (!page) continue;

    const blockIndex = page.blocks.findIndex((block) => block.id === blockId);

    if (blockIndex !== -1) {
      return { pageIndex, blockIndex };
    }
  }

  return null;
}

export function getEditableConfigForBlock(
  blockType: string | undefined | null
): EditableBlockConfig | null {
  if (!blockType) return null;
  const raw = String(blockType).trim();
  const lower = raw.toLowerCase();
  const normalized = lower.replace(/[-_]/g, "");

  const found =
    editorRegistry[raw] ||
    editorRegistry[lower] ||
    editorRegistry[normalized];

  if (found) return found;

  if (PRODUCT_DETAIL_BLOCK_TYPES.has(lower) || PRODUCT_DETAIL_BLOCK_TYPES.has(normalized)) {
    return editorRegistry.product_detail || null;
  }

  if (CHECKOUT_BLOCK_TYPES.has(lower) || CHECKOUT_BLOCK_TYPES.has(normalized)) {
    return (
      editorRegistry[raw] ||
      editorRegistry[lower] ||
      editorRegistry[normalized] ||
      editorRegistry.delivery_form ||
      null
    );
  }

  return null;
}

export function updateBlockFieldValue(
  siteDefinition: EditorSiteDefinition,
  blockId: string,
  field: EditorField,
  value: any
): EditorSiteDefinition {
  if (blockId === GLOBAL_NAVBAR_BLOCK_ID || blockId === "navbar") {
    if (field.target === "theme") {
      return {
        ...siteDefinition,
        theme: {
          ...siteDefinition.theme,
          [field.key]: value,
        },
      };
    }

    if (field.key === "logoUrl" || field.key === "logo_url") {
      return {
        ...siteDefinition,
        navbar: {
          ...siteDefinition.navbar,
          logoUrl: value,
          logo_url: value,
        },
      };
    }

    if (field.key === "brandName") {
      return {
        ...siteDefinition,
        site: {
          ...siteDefinition.site,
          brand_name: value,
        },
      };
    }

    if (field.key === "tagline") {
      return {
        ...siteDefinition,
        theme: {
          ...siteDefinition.theme,
          brand_tone: value,
        },
      };
    }

    if (field.key === "navigation") {
      return {
        ...siteDefinition,
        navigation: value,
      };
    }

    if (
      field.key === "showSearch" ||
      field.key === "showAccount" ||
      field.key === "showCart"
    ) {
      return {
        ...siteDefinition,
        navbar: {
          ...siteDefinition.navbar,
          [field.key]: Boolean(value),
        },
      };
    }

    return siteDefinition;
  }

  if (blockId === GLOBAL_FOOTER_BLOCK_ID || blockId === "footer") {
    if (field.target === "theme") {
      return {
        ...siteDefinition,
        theme: {
          ...siteDefinition.theme,
          [field.key]: value,
        },
      };
    }

    return {
      ...siteDefinition,
      footer: {
        ...(siteDefinition.footer ?? {}),
        [field.key]: value,
      },
    };
  }

  const hasExistingBlock = siteDefinition.pages.some((p) =>
    p.blocks.some((b) => b.id === blockId)
  );

  if (!hasExistingBlock && isProductDetailFallbackId(blockId)) {
    const pdPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "product_detail" ||
        p.page_type === "product_detail" ||
        isProductDetailPageRoute(p.route) ||
        p.blocks.some((b) =>
          PRODUCT_DETAIL_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
        )
    );

    if (pdPageIndex !== -1) {
      const targetPage = siteDefinition.pages[pdPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex((b) =>
        PRODUCT_DETAIL_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
      );

      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlock = {
          ...existingBlock,
          props: {
            ...(existingBlock.props || {}),
            [field.key]: value,
          },
        };
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = updatedBlock;
        updatedPages[pdPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        const newBlock: EditorBlock = {
          id: blockId,
          type: "product_detail",
          data_source: "product",
          props: {
            [field.key]: value,
          },
        };
        updatedPages[pdPageIndex] = {
          ...targetPage,
          blocks: [...targetPage.blocks, newBlock],
        };
      }
      return {
        ...siteDefinition,
        pages: updatedPages,
      };
    } else {
      const newProductDetailPage: EditorPage = {
        id: "page-product-detail",
        name: "Product Detail",
        route: "/products/:productSlug",
        role: "product_detail",
        page_type: "product_detail",
        show_in_nav: false,
        blocks: [
          {
            id: blockId,
            type: "product_detail",
            data_source: "product",
            props: {
              [field.key]: value,
            },
          },
        ],
      };
      return {
        ...siteDefinition,
        pages: [...siteDefinition.pages, newProductDetailPage],
      };
    }
  }

  if (!hasExistingBlock && isCheckoutFallbackId(blockId)) {
    const checkoutPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "checkout" ||
        p.page_type === "checkout" ||
        (p as any).slug === "checkout" ||
        isCheckoutPageRoute(p.route) ||
        p.blocks.some((b) =>
          CHECKOUT_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
        )
    );

    const targetType = blockId.includes("delivery")
      ? "delivery_form"
      : blockId.includes("payment")
        ? "payment_methods"
        : blockId.includes("place") || blockId.includes("cta")
          ? "place_order_cta"
          : "order_summary";

    if (checkoutPageIndex !== -1) {
      const targetPage = siteDefinition.pages[checkoutPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) =>
          b.id === blockId ||
          String(b.type || "").toLowerCase() === targetType.toLowerCase()
      );

      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlock = {
          ...existingBlock,
          props: {
            ...(existingBlock.props || {}),
            [field.key]: value,
          },
        };
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = updatedBlock;
        updatedPages[checkoutPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        const newBlock: EditorBlock = {
          id: blockId,
          type: targetType,
          props: {
            [field.key]: value,
          },
        };
        updatedPages[checkoutPageIndex] = {
          ...targetPage,
          blocks: [...targetPage.blocks, newBlock],
        };
      }
      return {
        ...siteDefinition,
        pages: updatedPages,
      };
    } else {
      const newCheckoutPage: EditorPage = {
        id: "page-checkout",
        name: "Checkout",
        route: "/checkout",
        role: "checkout",
        page_type: "checkout",
        show_in_nav: false,
        blocks: [
          {
            id: blockId,
            type: targetType,
            props: {
              [field.key]: value,
            },
          },
        ],
      };
      return {
        ...siteDefinition,
        pages: [...siteDefinition.pages, newCheckoutPage],
      };
    }
  }

  if (!hasExistingBlock && isCartFallbackId(blockId)) {
    const cartPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "cart" ||
        p.page_type === "cart" ||
        (p as any).slug === "cart" ||
        p.route === "/cart" ||
        p.route === "cart" ||
        p.blocks.some((b) =>
          CART_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
        )
    );

    const targetType = "cart_sidebar";

    if (cartPageIndex !== -1) {
      const targetPage = siteDefinition.pages[cartPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) =>
          b.id === blockId ||
          CART_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
      );

      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlock = {
          ...existingBlock,
          props: {
            ...(existingBlock.props || {}),
            [field.key]: value,
          },
        };
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = updatedBlock;
        updatedPages[cartPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        const newBlock: EditorBlock = {
          id: blockId,
          type: targetType,
          props: {
            [field.key]: value,
          },
        };
        updatedPages[cartPageIndex] = {
          ...targetPage,
          blocks: [...targetPage.blocks, newBlock],
        };
      }
      return {
        ...siteDefinition,
        pages: updatedPages,
      };
    } else {
      const newCartPage: EditorPage = {
        id: "page-cart",
        name: "Cart",
        route: "/cart",
        role: "cart",
        page_type: "cart",
        show_in_nav: false,
        blocks: [
          {
            id: blockId,
            type: targetType,
            props: {
              [field.key]: value,
            },
          },
        ],
      };
      return {
        ...siteDefinition,
        pages: [...siteDefinition.pages, newCartPage],
      };
    }
  }

  return {
    ...siteDefinition,
    pages: siteDefinition.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        if (field.target === "theme") {
          return block;
        }

        return {
          ...block,
          props: {
            ...(block.props || {}),
            [field.key]: value,
          },
        };
      }),
    })),
  };
}

export function updateBlockProps(
  siteDefinition: EditorSiteDefinition,
  blockId: string,
  propsPatch: Record<string, any>
): EditorSiteDefinition {
  if (blockId === GLOBAL_NAVBAR_BLOCK_ID) {
    let nextSiteDefinition = { ...siteDefinition };

    if (
      Object.prototype.hasOwnProperty.call(propsPatch, "logoUrl") ||
      Object.prototype.hasOwnProperty.call(propsPatch, "logo_url")
    ) {
      const val = propsPatch.logoUrl ?? propsPatch.logo_url;
      nextSiteDefinition = {
        ...nextSiteDefinition,
        navbar: {
          ...nextSiteDefinition.navbar,
          logoUrl: val,
          logo_url: val,
        },
      };
    }

    if (Object.prototype.hasOwnProperty.call(propsPatch, "brandName")) {
      nextSiteDefinition = {
        ...nextSiteDefinition,
        site: {
          ...siteDefinition.site,
          brand_name: propsPatch.brandName,
        },
      };
    }

    if (Object.prototype.hasOwnProperty.call(propsPatch, "tagline")) {
      nextSiteDefinition = {
        ...nextSiteDefinition,
        theme: {
          ...nextSiteDefinition.theme,
          brand_tone: propsPatch.tagline,
        },
      };
    }

    if (Object.prototype.hasOwnProperty.call(propsPatch, "navigation")) {
      nextSiteDefinition = {
        ...nextSiteDefinition,
        navigation: propsPatch.navigation,
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(propsPatch, "showSearch") ||
      Object.prototype.hasOwnProperty.call(propsPatch, "showAccount") ||
      Object.prototype.hasOwnProperty.call(propsPatch, "showCart")
    ) {
      nextSiteDefinition = {
        ...nextSiteDefinition,
        navbar: {
          ...nextSiteDefinition.navbar,
          ...(Object.prototype.hasOwnProperty.call(propsPatch, "showSearch")
            ? { showSearch: Boolean(propsPatch.showSearch) }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(propsPatch, "showAccount")
            ? { showAccount: Boolean(propsPatch.showAccount) }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(propsPatch, "showCart")
            ? { showCart: Boolean(propsPatch.showCart) }
            : {}),
        },
      };
    }

    return nextSiteDefinition;
  }

  const hasExistingBlockProps = siteDefinition.pages.some((p) =>
    p.blocks.some((b) => b.id === blockId)
  );

  if (!hasExistingBlockProps && isProductDetailFallbackId(blockId)) {
    const pdPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "product_detail" ||
        p.page_type === "product_detail" ||
        isProductDetailPageRoute(p.route) ||
        p.blocks.some((b) =>
          PRODUCT_DETAIL_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
        )
    );

    if (pdPageIndex !== -1) {
      const targetPage = siteDefinition.pages[pdPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex((b) =>
        PRODUCT_DETAIL_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
      );

      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlock = {
          ...existingBlock,
          props: {
            ...(existingBlock.props || {}),
            ...propsPatch,
          },
        };
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = updatedBlock;
        updatedPages[pdPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        const newBlock: EditorBlock = {
          id: blockId,
          type: "product_detail",
          data_source: "product",
          props: {
            ...propsPatch,
          },
        };
        updatedPages[pdPageIndex] = {
          ...targetPage,
          blocks: [...targetPage.blocks, newBlock],
        };
      }
      return {
        ...siteDefinition,
        pages: updatedPages,
      };
    } else {
      const newProductDetailPage: EditorPage = {
        id: "page-product-detail",
        name: "Product Detail",
        route: "/products/:productSlug",
        role: "product_detail",
        page_type: "product_detail",
        show_in_nav: false,
        blocks: [
          {
            id: blockId,
            type: "product_detail",
            data_source: "product",
            props: {
              ...propsPatch,
            },
          },
        ],
      };
      return {
        ...siteDefinition,
        pages: [...siteDefinition.pages, newProductDetailPage],
      };
    }
  }

  if (!hasExistingBlockProps && isCheckoutFallbackId(blockId)) {
    const checkoutPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "checkout" ||
        p.page_type === "checkout" ||
        (p as any).slug === "checkout" ||
        isCheckoutPageRoute(p.route) ||
        p.blocks.some((b) =>
          CHECKOUT_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
        )
    );

    const targetType = blockId.includes("delivery")
      ? "delivery_form"
      : blockId.includes("payment")
        ? "payment_methods"
        : blockId.includes("place") || blockId.includes("cta")
          ? "place_order_cta"
          : "order_summary";

    if (checkoutPageIndex !== -1) {
      const targetPage = siteDefinition.pages[checkoutPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) =>
          b.id === blockId ||
          String(b.type || "").toLowerCase() === targetType.toLowerCase()
      );

      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlock = {
          ...existingBlock,
          props: {
            ...(existingBlock.props || {}),
            ...propsPatch,
          },
        };
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = updatedBlock;
        updatedPages[checkoutPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        const newBlock: EditorBlock = {
          id: blockId,
          type: targetType,
          props: {
            ...propsPatch,
          },
        };
        updatedPages[checkoutPageIndex] = {
          ...targetPage,
          blocks: [...targetPage.blocks, newBlock],
        };
      }
      return {
        ...siteDefinition,
        pages: updatedPages,
      };
    } else {
      const newCheckoutPage: EditorPage = {
        id: "page-checkout",
        name: "Checkout",
        route: "/checkout",
        role: "checkout",
        page_type: "checkout",
        show_in_nav: false,
        blocks: [
          {
            id: blockId,
            type: targetType,
            props: {
              ...propsPatch,
            },
          },
        ],
      };
      return {
        ...siteDefinition,
        pages: [...siteDefinition.pages, newCheckoutPage],
      };
    }
  }

  if (!hasExistingBlockProps && isCartFallbackId(blockId)) {
    const cartPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "cart" ||
        p.page_type === "cart" ||
        (p as any).slug === "cart" ||
        p.route === "/cart" ||
        p.route === "cart" ||
        p.blocks.some((b) =>
          CART_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
        )
    );

    const targetType = "cart_sidebar";

    if (cartPageIndex !== -1) {
      const targetPage = siteDefinition.pages[cartPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) =>
          b.id === blockId ||
          CART_BLOCK_TYPES.has(String(b.type || "").toLowerCase())
      );

      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlock = {
          ...existingBlock,
          props: {
            ...(existingBlock.props || {}),
            ...propsPatch,
          },
        };
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = updatedBlock;
        updatedPages[cartPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        const newBlock: EditorBlock = {
          id: blockId,
          type: targetType,
          props: {
            ...propsPatch,
          },
        };
        updatedPages[cartPageIndex] = {
          ...targetPage,
          blocks: [...targetPage.blocks, newBlock],
        };
      }
      return {
        ...siteDefinition,
        pages: updatedPages,
      };
    } else {
      const newCartPage: EditorPage = {
        id: "page-cart",
        name: "Cart",
        route: "/cart",
        role: "cart",
        page_type: "cart",
        show_in_nav: false,
        blocks: [
          {
            id: blockId,
            type: targetType,
            props: {
              ...propsPatch,
            },
          },
        ],
      };
      return {
        ...siteDefinition,
        pages: [...siteDefinition.pages, newCartPage],
      };
    }
  }

  const isProfileFallbackId = (id: string) =>
    id === "profile_details" || id === "profiledetails" || id === "profile" || id === "customer_profile";
  if (!hasExistingBlockProps && isProfileFallbackId(blockId)) {
    const profilePageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "profile" ||
        p.page_type === "profile" ||
        p.route === "/profile" ||
        p.route === "profile" ||
        p.id === "profile" ||
        p.id === "page-profile"
    );
    if (profilePageIndex !== -1) {
      const targetPage = siteDefinition.pages[profilePageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) => isProfileFallbackId(b.id) || isProfileFallbackId(b.type)
      );
      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = {
          ...existingBlock,
          props: { ...(existingBlock.props || {}), ...propsPatch },
        };
        updatedPages[profilePageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        updatedPages[profilePageIndex] = {
          ...targetPage,
          blocks: [
            ...targetPage.blocks,
            { id: "profile_details", type: "profile_details", props: { ...propsPatch } },
          ],
        };
      }
      return { ...siteDefinition, pages: updatedPages };
    } else {
      const newProfilePage: EditorPage = {
        id: "page-profile",
        name: "Customer Profile",
        route: "/profile",
        role: "profile",
        page_type: "profile",
        show_in_nav: false,
        blocks: [
          { id: "profile_details", type: "profile_details", props: { ...propsPatch } },
        ],
      };
      return { ...siteDefinition, pages: [...siteDefinition.pages, newProfilePage] };
    }
  }

  const isSignInFallbackId = (id: string) =>
    id === "signin_form" || id === "signinform" || id === "login_form" || id === "login";
  if (!hasExistingBlockProps && isSignInFallbackId(blockId)) {
    const loginPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "login" ||
        p.page_type === "login" ||
        p.route === "/login" ||
        p.route === "login" ||
        p.id === "login" ||
        p.id === "page-login"
    );
    if (loginPageIndex !== -1) {
      const targetPage = siteDefinition.pages[loginPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) => isSignInFallbackId(b.id) || isSignInFallbackId(b.type)
      );
      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = {
          ...existingBlock,
          props: { ...(existingBlock.props || {}), ...propsPatch },
        };
        updatedPages[loginPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        updatedPages[loginPageIndex] = {
          ...targetPage,
          blocks: [
            ...targetPage.blocks,
            { id: "signin_form", type: "signin_form", props: { max_width: "100%", ...propsPatch } },
          ],
        };
      }
      return { ...siteDefinition, pages: updatedPages };
    } else {
      const newLoginPage: EditorPage = {
        id: "page-login",
        name: "Customer Sign In",
        route: "/login",
        role: "login",
        page_type: "login",
        show_in_nav: false,
        blocks: [
          { id: "signin_form", type: "signin_form", props: { max_width: "100%", ...propsPatch } },
        ],
      };
      return { ...siteDefinition, pages: [...siteDefinition.pages, newLoginPage] };
    }
  }

  const isSignUpFallbackId = (id: string) =>
    id === "signup_form" || id === "signupform" || id === "register_form" || id === "signup";
  if (!hasExistingBlockProps && isSignUpFallbackId(blockId)) {
    const signupPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "signup" ||
        p.page_type === "signup" ||
        p.route === "/signup" ||
        p.route === "signup" ||
        p.id === "signup" ||
        p.id === "page-signup"
    );
    if (signupPageIndex !== -1) {
      const targetPage = siteDefinition.pages[signupPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) => isSignUpFallbackId(b.id) || isSignUpFallbackId(b.type)
      );
      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = {
          ...existingBlock,
          props: { ...(existingBlock.props || {}), ...propsPatch },
        };
        updatedPages[signupPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        updatedPages[signupPageIndex] = {
          ...targetPage,
          blocks: [
            ...targetPage.blocks,
            { id: "signup_form", type: "signup_form", props: { max_width: "100%", ...propsPatch } },
          ],
        };
      }
      return { ...siteDefinition, pages: updatedPages };
    } else {
      const newSignUpPage: EditorPage = {
        id: "page-signup",
        name: "Customer Sign Up",
        route: "/signup",
        role: "signup",
        page_type: "signup",
        show_in_nav: false,
        blocks: [
          { id: "signup_form", type: "signup_form", props: { max_width: "100%", ...propsPatch } },
        ],
      };
      return { ...siteDefinition, pages: [...siteDefinition.pages, newSignUpPage] };
    }
  }

  const isOrdersFallbackId = (id: string) =>
    id === "customer_orders" ||
    id === "customerorders" ||
    id === "orders" ||
    id === "order_history" ||
    id === "order_history_list";
  if (!hasExistingBlockProps && isOrdersFallbackId(blockId)) {
    const ordersPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "orders" ||
        p.page_type === "orders" ||
        p.route === "/orders" ||
        p.route === "orders" ||
        p.id === "orders" ||
        p.id === "page-orders"
    );
    if (ordersPageIndex !== -1) {
      const targetPage = siteDefinition.pages[ordersPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) => isOrdersFallbackId(b.id) || isOrdersFallbackId(b.type)
      );
      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = {
          ...existingBlock,
          props: { ...(existingBlock.props || {}), ...propsPatch },
        };
        updatedPages[ordersPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        updatedPages[ordersPageIndex] = {
          ...targetPage,
          blocks: [
            ...targetPage.blocks,
            { id: "customer_orders", type: "customer_orders", props: { max_width: "100%", ...propsPatch } },
          ],
        };
      }
      return { ...siteDefinition, pages: updatedPages };
    } else {
      const newOrdersPage: EditorPage = {
        id: "page-orders",
        name: "Customer Order History",
        route: "/orders",
        role: "orders",
        page_type: "orders",
        show_in_nav: false,
        blocks: [
          { id: "customer_orders", type: "customer_orders", props: { max_width: "100%", ...propsPatch } },
        ],
      };
      return { ...siteDefinition, pages: [...siteDefinition.pages, newOrdersPage] };
    }
  }

  const isSupportFallbackId = (id: string) =>
    id === "customer_support" ||
    id === "customersupport" ||
    id === "support" ||
    id === "support_desk" ||
    id === "supportdesk";
  if (!hasExistingBlockProps && isSupportFallbackId(blockId)) {
    const supportPageIndex = siteDefinition.pages.findIndex(
      (p) =>
        p.role === "support" ||
        p.page_type === "support" ||
        p.route === "/support" ||
        p.route === "support" ||
        p.id === "support" ||
        p.id === "page-support" ||
        (p as any)?.slug === "support" ||
        (p as any)?.name?.toLowerCase?.().includes("support")
    );
    if (supportPageIndex !== -1) {
      const targetPage = siteDefinition.pages[supportPageIndex];
      const existingBlockIndex = targetPage.blocks.findIndex(
        (b) => isSupportFallbackId(b.id) || isSupportFallbackId(b.type)
      );
      const updatedPages = [...siteDefinition.pages];
      if (existingBlockIndex !== -1) {
        const existingBlock = targetPage.blocks[existingBlockIndex];
        const updatedBlocks = [...targetPage.blocks];
        updatedBlocks[existingBlockIndex] = {
          ...existingBlock,
          props: { ...(existingBlock.props || {}), ...propsPatch },
        };
        updatedPages[supportPageIndex] = { ...targetPage, blocks: updatedBlocks };
      } else {
        updatedPages[supportPageIndex] = {
          ...targetPage,
          blocks: [
            ...targetPage.blocks,
            { id: "customer_support", type: "customer_support", props: { max_width: "100%", ...propsPatch } },
          ],
        };
      }
      return { ...siteDefinition, pages: updatedPages };
    } else {
      const newSupportPage: EditorPage = {
        id: "page-support",
        name: "Help & Support",
        route: "/support",
        role: "support",
        page_type: "support",
        show_in_nav: false,
        blocks: [
          { id: "customer_support", type: "customer_support", props: { max_width: "100%", ...propsPatch } },
        ],
      };
      return { ...siteDefinition, pages: [...siteDefinition.pages, newSupportPage] };
    }
  }

  return {
    ...siteDefinition,
    pages: siteDefinition.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        return {
          ...block,
          props: {
            ...(block.props || {}),
            ...propsPatch,
          },
        };
      }),
    })),
  };
}
export function updateThemeValues(
  siteDefinition: EditorSiteDefinition,
  themePatch: Record<string, any>,
  isGlobalPatch?: boolean
): EditorSiteDefinition {
  const nextPatch = { ...themePatch };
  if (nextPatch.navbar_bg && !nextPatch.navbar_outer_bg) {
    nextPatch.navbar_outer_bg = nextPatch.navbar_bg;
  }

  // Detect whether this is a full theme or palette application (e.g. from Copilot suggestions or global palette picker)
  const isGlobalThemeChange = isGlobalPatch || Boolean(
    (nextPatch.primary_bg && nextPatch.accent_color) ||
    (nextPatch.primary_bg && nextPatch.card_bg) ||
    nextPatch.visual_style ||
    nextPatch.palette_id ||
    nextPatch.id
  );

  let componentBaselines: Record<string, any> = {};
  if (isGlobalThemeChange) {
    const rawMode = nextPatch.mode || siteDefinition.theme?.mode;
    const isDark = rawMode === "dark" || isColorDarkHex(nextPatch.primary_bg || siteDefinition.theme?.primary_bg || "#ffffff");
    const baseDefaults = isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;

    const primaryBg = nextPatch.primary_bg || siteDefinition.theme?.primary_bg || baseDefaults.primary_bg;
    const cardBg = nextPatch.card_bg || nextPatch.secondary_bg || siteDefinition.theme?.card_bg || baseDefaults.card_bg;
    const textColor = nextPatch.text_color || siteDefinition.theme?.text_color || baseDefaults.text_color;
    const mutedText = nextPatch.muted_text_color || nextPatch.muted_text || siteDefinition.theme?.muted_text_color || baseDefaults.muted_text_color;
    const accentColor = nextPatch.accent_color || siteDefinition.theme?.accent_color || baseDefaults.accent_color;
    const defaultNeutralBorder = isDark ? "rgba(255, 255, 255, 0.12)" : "#e2e8f0";
    const borderColor = nextPatch.card_border_color || nextPatch.border_color || siteDefinition.theme?.card_border_color || siteDefinition.theme?.border_color || defaultNeutralBorder;
    const navbarBorder = nextPatch.navbar_border_color || borderColor;

    componentBaselines = {
      cart_bg: primaryBg,
      cart_panel_bg: cardBg,
      cart_card_bg: cardBg,
      cart_text_color: textColor,
      cart_accent_color: accentColor,
      cart_border_color: borderColor,
      summary_bg: primaryBg,
      summary_card_bg: cardBg,
      summary_text_color: textColor,
      summary_accent_color: accentColor,
      summary_border_color: borderColor,
      order_summary_bg: primaryBg,
      order_summary_card_bg: cardBg,
      order_summary_text: textColor,
      order_summary_accent: accentColor,
      order_summary_border: borderColor,
      product_detail_bg: cardBg,
      product_detail_text: textColor,
      product_detail_btn_bg: accentColor,
      product_detail_btn_text: "#ffffff",
      badge_bg_color: isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.08)",
      badge_border_color: isDark ? "rgba(59,130,246,0.3)" : "rgba(37,99,235,0.2)",
      product_detail_badge_bg: isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.08)",
      product_detail_badge_border: isDark ? "rgba(59,130,246,0.3)" : "rgba(37,99,235,0.2)",
      delivery_form_bg: cardBg,
      delivery_form_card_bg: cardBg,
      delivery_form_text: textColor,
      delivery_form_border: borderColor,
      delivery_form_btn_bg: accentColor,
      delivery_form_btn_text: "#ffffff",
      delivery_form_input_bg: primaryBg,
      delivery_form_input_text: textColor,
      payment_bg: cardBg,
      payment_card_bg: cardBg,
      payment_text_color: textColor,
      payment_accent_color: accentColor,
      payment_border_color: borderColor,
      place_order_bg: cardBg,
      place_order_card_bg: cardBg,
      place_order_btn_bg: accentColor,
      place_order_btn_text: "#ffffff",
      place_order_text: textColor,
      place_order_border: borderColor,
      checkout_steps_bg: cardBg,
      checkout_steps_border: borderColor,
      checkout_bg: primaryBg,
      checkout_card_bg: cardBg,
      profile_dropdown_bg: cardBg,
      profile_dropdown_text: textColor,
      profile_dropdown_border: borderColor,
      order_history_bg: primaryBg,
      order_history_card_bg: cardBg,
      order_history_text: textColor,
      order_history_muted_text: mutedText,
      order_history_border: borderColor,
      order_history_accent_color: accentColor,
      support_bg: primaryBg,
      support_card_bg: cardBg,
      support_chat_bg: cardBg,
      support_surface_bg: cardBg,
      support_text_color: textColor,
      support_muted_text: mutedText,
      support_accent_color: accentColor,
      support_border_color: borderColor,
      card_bg: cardBg,
      card_bg_color: cardBg,
      card_text_color: textColor,
      product_name_color: textColor,
      card_border_color: borderColor,
      brand_color: accentColor,
      price_color: getSafePriceColor(undefined, textColor, isDark, cardBg),
    };
  }

  const updatedTheme = {
    ...siteDefinition.theme,
    ...componentBaselines,
    ...nextPatch,
  };

  const nextPages = applyThemeToPages(siteDefinition.pages || [], updatedTheme);

  const nextDef: EditorSiteDefinition = {
    ...siteDefinition,
    theme: updatedTheme,
    pages: nextPages,
  };

  if (themePatch.brandName !== undefined || themePatch.brand_name !== undefined) {
    const brand = themePatch.brandName ?? themePatch.brand_name;
    if (nextDef.site) {
      (nextDef.site as any).brand_name = brand;
    }
    (nextDef as any).site_name = brand;
    (nextDef as any).name = brand;
    if ((nextDef as any).navbar) {
      (nextDef as any).navbar.brandName = brand;
      (nextDef as any).navbar.brand_name = brand;
    }
    if ((nextDef as any).footer) {
      (nextDef as any).footer.brandName = brand;
      (nextDef as any).footer.brand_name = brand;
    }
  }

  return nextDef;
}
export function applyThemeMode(
  siteDefinition: EditorSiteDefinition,
  mode: ThemeMode
): EditorSiteDefinition {
  const currentTheme = siteDefinition.theme || {};
  const baseDefaults = mode === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;

  const updatedTheme: any = {
    ...currentTheme,
    ...baseDefaults,
    // Preserve custom branding, logos, layout configs, fonts, etc.
    logo_url: currentTheme.logo_url || currentTheme.logoUrl,
    logoUrl: currentTheme.logoUrl || currentTheme.logo_url,
    brand_tone: currentTheme.brand_tone,
    font_family: currentTheme.font_family,
    navbar_position: currentTheme.navbar_position,
    navbar_height: currentTheme.navbar_height,
    mode,
    festival_theme: currentTheme.festival_theme || "none",
    // Hero banner styles are preserved as edited/published
    hero_bg: currentTheme.hero_bg,
    hero_text_color: currentTheme.hero_text_color,
    hero_accent: currentTheme.hero_accent,
    hero_festive_position: currentTheme.hero_festive_position,
    hero_festive_opacity: currentTheme.hero_festive_opacity,
  };
  // Explicitly clear any active snapshot reference so preset mode is purely active
  delete updatedTheme.active_snapshot_id;

  const nextPages = applyThemeToPages(siteDefinition.pages || [], updatedTheme);

  return {
    ...siteDefinition,
    theme: updatedTheme,
    pages: nextPages,
  };
}

export function applyFestivalTheme(
  siteDefinition: EditorSiteDefinition,
  preset: FestivalThemeKey
): EditorSiteDefinition {
  const currentTheme = siteDefinition.theme || {};
  const presetConfig = FESTIVAL_THEME_PRESETS[preset] || {};
  const updatedTheme: any = {
    ...currentTheme,
    ...presetConfig,
    festival_theme: preset,
  };

  const nextPages = applyThemeToPages(siteDefinition.pages || [], updatedTheme);

  return {
    ...siteDefinition,
    theme: updatedTheme,
    pages: nextPages,
  };
}

export function getSiteStorageId(siteDefinition?: EditorSiteDefinition): string {
  if (siteDefinition) {
    const id = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id;
    if (id && typeof id === "string" && id.trim()) return id.trim();
    const slug = (siteDefinition as any)?.slug || (siteDefinition as any)?.site?.slug;
    if (slug && typeof slug === "string" && slug.trim()) return slug.trim();
  }
  if (typeof window !== "undefined") {
    try {
      const path = window.location.pathname || "";
      const match = path.match(/\/(builder|store)\/([^/?#]+)/);
      if (match && match[2]) return match[2].trim();
    } catch { }
  }
  if (siteDefinition) {
    const brand = siteDefinition?.site?.brand_name;
    if (brand && typeof brand === "string" && brand.trim()) {
      return brand.trim().toLowerCase().replace(/\s+/g, "_");
    }
  }
  return "default_site";
}

export function getSavedThemeSnapshots(siteDefinition: EditorSiteDefinition): any[] {
  const siteId = getSiteStorageId(siteDefinition);
  const slug = (siteDefinition as any)?.slug || (siteDefinition as any)?.site?.slug;
  const brand = siteDefinition?.site?.brand_name ? String(siteDefinition.site.brand_name).trim().toLowerCase().replace(/\s+/g, "_") : "";
  let inStorage: any[] = [];

  if (typeof window !== "undefined") {
    try {
      // Clean up legacy global keys to prevent cross-tenant theme contamination
      localStorage.removeItem("webnirmaan_saved_themes_global");
      localStorage.removeItem("webnirmaan_saved_themes_default_site");
      localStorage.removeItem("webnirmaan_saved_themes_latest");

      const keysToCheck = new Set<string>();
      if (siteId && siteId !== "default_site") keysToCheck.add(`webnirmaan_saved_themes_${siteId}`);
      if (slug && slug !== "default_site") keysToCheck.add(`webnirmaan_saved_themes_${slug}`);
      if (brand && brand !== "default_site") keysToCheck.add(`webnirmaan_saved_themes_${brand}`);

      const path = window.location.pathname || "";
      const match = path.match(/\/(builder|store)\/([^/?#]+)/);
      if (match && match[2] && match[2] !== "default_site") {
        keysToCheck.add(`webnirmaan_saved_themes_${match[2].trim()}`);
      }

      keysToCheck.forEach((k) => {
        const rawSpecific = localStorage.getItem(k);
        if (rawSpecific) {
          try {
            const parsed = JSON.parse(rawSpecific);
            if (Array.isArray(parsed)) inStorage.push(...parsed);
          } catch { }
        }
      });
    } catch { }
  }

  const inMemory = Array.isArray((siteDefinition as any)?.saved_themes)
    ? (siteDefinition as any).saved_themes
    : [];

  const map = new Map<string, any>();
  [...inMemory, ...inStorage].forEach((item) => {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  });

  // Auto-seed initial generated theme as the first snapshot if no snapshots exist yet
  if (map.size === 0 && siteDefinition?.theme && Object.keys(siteDefinition.theme).length > 0) {
    const brand = siteDefinition?.site?.brand_name || (siteDefinition as any)?.site_name || "Original";
    const initialSnapshot = {
      id: `theme_initial_${siteId || "site"}`,
      name: `${brand} (Original)`,
      created_at: new Date().toISOString(),
      is_initial: true,
      theme: { ...siteDefinition.theme },
    };
    map.set(initialSnapshot.id, initialSnapshot);

    if (typeof window !== "undefined") {
      try {
        const toPersist = [initialSnapshot];
        if (siteId && siteId !== "default_site") {
          localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(toPersist));
        }
        if (slug && slug !== siteId && slug !== "default_site") {
          localStorage.setItem(`webnirmaan_saved_themes_${slug}`, JSON.stringify(toPersist));
        }
      } catch { }
    }
  }

  const result = Array.from(map.values()).slice(0, 30);
  if (typeof window !== "undefined" && inMemory.length > 0) {
    try {
      if (siteId && siteId !== "default_site") {
        localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(result));
      }
      if (slug && slug !== siteId && slug !== "default_site") {
        localStorage.setItem(`webnirmaan_saved_themes_${slug}`, JSON.stringify(result));
      }
    } catch { }
  }
  return result;
}

export function getPublishedHeroDefinition(
  siteDefinition?: EditorSiteDefinition,
  publishedSiteDefinition?: EditorSiteDefinition
): { heroBlock?: any; heroTheme?: Record<string, any> } {
  let pubDef = publishedSiteDefinition;

  if (!pubDef && siteDefinition) {
    pubDef = (siteDefinition as any)._published || (siteDefinition as any).published_definition;
  }

  if (!pubDef && typeof window !== "undefined") {
    try {
      const siteId = getSiteStorageId(siteDefinition);
      const slug = (siteDefinition as any)?.slug || (siteDefinition as any)?.site?.slug;

      const storedPubDef =
        (siteId && localStorage.getItem(`wc_published_site_def_${siteId}`)) ||
        (slug && localStorage.getItem(`wc_published_site_def_${slug}`));
      if (storedPubDef) {
        pubDef = JSON.parse(storedPubDef);
      } else {
        const storedSnapshot =
          (slug && localStorage.getItem(`wc_site_snapshot_${slug}`)) ||
          (siteId && localStorage.getItem(`wc_site_snapshot_${siteId}`));
        if (storedSnapshot) {
          const parsed = JSON.parse(storedSnapshot);
          if (parsed?.site_definition) pubDef = parsed.site_definition;
        }
      }
    } catch { }
  }

  let heroBlock: any = null;
  if (pubDef?.pages) {
    for (const page of pubDef.pages) {
      const found = (page.blocks || []).find((b: any) => {
        const t = String(b.type || "").toLowerCase();
        const id = String(b.id || "").toLowerCase();
        return t === "hero_banner" || t === "hero" || t === "banner" || id === "hero_banner" || id === "herobanner";
      });
      if (found) {
        heroBlock = JSON.parse(JSON.stringify(found));
        break;
      }
    }
  }

  const sourceTheme = pubDef?.theme || siteDefinition?.theme || {};
  const heroTheme: Record<string, any> = {};
  if (sourceTheme.hero_bg) heroTheme.hero_bg = sourceTheme.hero_bg;
  if (sourceTheme.hero_text_color) heroTheme.hero_text_color = sourceTheme.hero_text_color;
  if (sourceTheme.hero_accent) heroTheme.hero_accent = sourceTheme.hero_accent;
  if (sourceTheme.hero_festive_position) heroTheme.hero_festive_position = sourceTheme.hero_festive_position;
  if (sourceTheme.hero_festive_opacity !== undefined) heroTheme.hero_festive_opacity = sourceTheme.hero_festive_opacity;

  return { heroBlock, heroTheme };
}

export function saveThemeSnapshot(
  siteDefinition: EditorSiteDefinition,
  name: string,
  customThemeProps?: Record<string, any>
): EditorSiteDefinition {
  const baseTheme = { ...(siteDefinition.theme || {}) };

  const cleanBaseTheme: Record<string, any> = {};
  Object.keys(baseTheme).forEach((k) => {
    if (baseTheme[k] !== undefined && baseTheme[k] !== null) {
      cleanBaseTheme[k] = baseTheme[k];
    }
  });

  // Hero banner edits and styles are excluded from snapshots:
  delete cleanBaseTheme.hero_bg;
  delete cleanBaseTheme.hero_text_color;
  delete cleanBaseTheme.hero_accent;
  delete cleanBaseTheme.hero_festive_position;
  delete cleanBaseTheme.hero_festive_opacity;
  delete cleanBaseTheme.banner_height;
  delete cleanBaseTheme.banner_width;
  delete cleanBaseTheme.slides;

  // Capture product detail, card block, and cart block overrides into theme object for snapshot
  let pdBadgeBg: string | undefined;
  let pdBadgeBorder: string | undefined;
  let pdPanelBg: string | undefined;
  let pdTextColor: string | undefined;
  let pdBtnBg: string | undefined;
  let pdBtnText: string | undefined;

  let cardBlockBg: string | undefined;
  let cardBlockText: string | undefined;
  let cardBlockBorder: string | undefined;
  let cardBlockBrand: string | undefined;
  let cardBlockPrice: string | undefined;

  let cartBlockBg: string | undefined;
  let cartBlockPanelBg: string | undefined;
  let cartBlockCardBg: string | undefined;
  let cartBlockText: string | undefined;
  let cartBlockAccent: string | undefined;
  let cartBlockBorder: string | undefined;

  (siteDefinition.pages || []).forEach((page) => {
    (page.blocks || []).forEach((block) => {
      const btype = String(block.type || "").toLowerCase();
      // Hero banner is intentionally excluded from theme snapshot

      if (
        btype === "product_detail" ||
        btype === "productdetail" ||
        btype === "product_info" ||
        btype === "productinfo" ||
        btype === "purchase_panel" ||
        btype === "purchasepanel" ||
        btype === "product_gallery" ||
        btype === "productgallery" ||
        String(block.id || "").toLowerCase().includes("product-detail")
      ) {
        const props = block.props || {};
        if (props.badge_bg_color) pdBadgeBg = props.badge_bg_color;
        if (props.badge_border_color) pdBadgeBorder = props.badge_border_color;
        if (props.panel_color) pdPanelBg = props.panel_color;
        if (props.text_color) pdTextColor = props.text_color;
        if (props.button_bg_color) pdBtnBg = props.button_bg_color;
        if (props.button_text_color) pdBtnText = props.button_text_color;
      }

      if (
        btype === "cart" ||
        btype === "cart_view" ||
        btype === "cart_sidebar" ||
        btype === "cart_items" ||
        btype === "order_summary" ||
        String(block.id || "").toLowerCase().includes("cart")
      ) {
        const props = block.props || {};
        if (props.cart_bg || props.background_color) cartBlockBg = props.cart_bg || props.background_color;
        if (props.cart_panel_bg || props.panel_color) cartBlockPanelBg = props.cart_panel_bg || props.panel_color;
        if (props.cart_card_bg || props.card_color) cartBlockCardBg = props.cart_card_bg || props.card_color;
        if (props.cart_text_color || props.text_color) cartBlockText = props.cart_text_color || props.text_color;
        if (props.cart_accent_color || props.accent_color) cartBlockAccent = props.cart_accent_color || props.accent_color;
        if (props.cart_border_color || props.border_color) cartBlockBorder = props.cart_border_color || props.border_color;
      }

      if (
        btype === "product_grid" ||
        btype === "productgrid" ||
        btype === "product_carousel" ||
        btype === "productcarousel" ||
        btype === "section_group_carousel" ||
        btype === "category_grid"
      ) {
        const props = block.props || {};
        if (props.card_bg_color) cardBlockBg = props.card_bg_color;
        else if (props.card_bg) cardBlockBg = props.card_bg;

        if (props.product_name_color) cardBlockText = props.product_name_color;
        else if (props.product_title_color) cardBlockText = props.product_title_color;
        else if (props.card_title_color) cardBlockText = props.card_title_color;
        else if (props.title_color) cardBlockText = props.title_color;

        if (props.card_border_color) cardBlockBorder = props.card_border_color;
        if (props.brand_color) cardBlockBrand = props.brand_color;
        if (props.price_color) cardBlockPrice = props.price_color;
      }
    });
  });

  const customPatch = customThemeProps ? (customThemeProps.patch || customThemeProps.theme || customThemeProps) : {};
  const cleanCustomPatch: Record<string, any> = {};
  if (customPatch && typeof customPatch === "object") {
    Object.keys(customPatch).forEach((k) => {
      if (customPatch[k] !== undefined && customPatch[k] !== null) {
        cleanCustomPatch[k] = customPatch[k];
      }
    });
  }
  // Exclude hero properties from custom theme patch
  delete cleanCustomPatch.hero_bg;
  delete cleanCustomPatch.hero_text_color;
  delete cleanCustomPatch.hero_accent;
  delete cleanCustomPatch.hero_festive_position;
  delete cleanCustomPatch.hero_festive_opacity;
  delete cleanCustomPatch.banner_height;
  delete cleanCustomPatch.banner_width;
  delete cleanCustomPatch.slides;

  const mode: ThemeMode = (cleanBaseTheme.mode === "light" ? "light" : "dark") as ThemeMode;
  const isDark = mode === "dark";
  const baseDefaults = isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;

  const primaryBg = cleanBaseTheme.primary_bg || baseDefaults.primary_bg;
  const cardBg = cleanBaseTheme.card_bg || baseDefaults.card_bg;
  const textColor = cleanBaseTheme.text_color || baseDefaults.text_color;
  const mutedText = cleanBaseTheme.muted_text_color || baseDefaults.muted_text_color;
  const accentColor = cleanBaseTheme.accent_color || baseDefaults.accent_color;
  const borderColor = cleanBaseTheme.navbar_border_color || cleanBaseTheme.card_border_color || baseDefaults.navbar_border_color;

  const componentBaselines: Record<string, any> = {
    cart_bg: primaryBg,
    cart_panel_bg: cardBg,
    cart_card_bg: cardBg,
    cart_text_color: textColor,
    cart_accent_color: accentColor,
    cart_border_color: borderColor,
    summary_bg: primaryBg,
    summary_card_bg: cardBg,
    summary_text_color: textColor,
    summary_accent_color: accentColor,
    summary_border_color: borderColor,
    product_detail_bg: cardBg,
    product_detail_text: textColor,
    product_detail_btn_bg: accentColor,
    product_detail_btn_text: "#ffffff",
    badge_bg_color: "rgba(37,99,235,0.08)",
    badge_border_color: "rgba(37,99,235,0.2)",
    product_detail_badge_bg: "rgba(37,99,235,0.08)",
    product_detail_badge_border: "rgba(37,99,235,0.2)",
    delivery_form_bg: cardBg,
    delivery_form_text: textColor,
    delivery_form_border: borderColor,
    delivery_form_btn_bg: accentColor,
    delivery_form_btn_text: "#ffffff",
    delivery_form_input_bg: primaryBg,
    delivery_form_input_text: textColor,
    payment_bg: cardBg,
    payment_card_bg: cardBg,
    payment_text_color: textColor,
    payment_accent_color: accentColor,
    payment_border_color: borderColor,
    place_order_bg: cardBg,
    place_order_btn_bg: accentColor,
    place_order_btn_text: "#ffffff",
    place_order_text: textColor,
    profile_dropdown_bg: cardBg,
    profile_dropdown_text: textColor,
    profile_dropdown_border: borderColor,
    order_history_bg: primaryBg,
    order_history_card_bg: cardBg,
    order_history_text: textColor,
    order_history_muted_text: mutedText,
    order_history_border: borderColor,
    order_history_accent_color: accentColor,
    support_bg: primaryBg,
    support_card_bg: cardBg,
    support_chat_bg: cardBg,
    support_surface_bg: cardBg,
    support_text_color: textColor,
    support_muted_text: mutedText,
    support_accent_color: accentColor,
    support_border_color: borderColor,
    card_bg: cardBg,
    card_bg_color: cardBg,
    card_text_color: textColor,
    product_name_color: textColor,
    card_border_color: borderColor,
    brand_color: accentColor,
    price_color: getSafePriceColor(undefined, textColor, isDark),
  };

  const themeToSave: Record<string, any> = {
    ...baseDefaults,
    ...componentBaselines,
    ...cleanBaseTheme,
    ...(cartBlockBg ? { cart_bg: cartBlockBg } : {}),
    ...(cartBlockPanelBg ? { cart_panel_bg: cartBlockPanelBg } : {}),
    ...(cartBlockCardBg ? { cart_card_bg: cartBlockCardBg } : {}),
    ...(cartBlockText ? { cart_text_color: cartBlockText } : {}),
    ...(cartBlockAccent ? { cart_accent_color: cartBlockAccent } : {}),
    ...(cartBlockBorder ? { cart_border_color: cartBlockBorder } : {}),
    ...(pdBadgeBg ? { badge_bg_color: pdBadgeBg, product_detail_badge_bg: pdBadgeBg } : {}),
    ...(pdBadgeBorder ? { badge_border_color: pdBadgeBorder, product_detail_badge_border: pdBadgeBorder } : {}),
    ...(pdPanelBg ? { product_detail_bg: pdPanelBg } : {}),
    ...(pdTextColor ? { product_detail_text: pdTextColor } : {}),
    ...(pdBtnBg ? { product_detail_btn_bg: pdBtnBg } : {}),
    ...(pdBtnText ? { product_detail_btn_text: pdBtnText } : {}),
    ...(cardBlockBg ? { card_bg: cardBlockBg, card_bg_color: cardBlockBg } : {}),
    ...(cardBlockText ? { card_text_color: cardBlockText, product_name_color: cardBlockText, title_color: cardBlockText } : {}),
    ...(cardBlockBorder ? { card_border_color: cardBlockBorder } : {}),
    ...(cardBlockBrand ? { brand_color: cardBlockBrand } : {}),
    ...(cardBlockPrice ? { price_color: cardBlockPrice } : {}),
    ...cleanCustomPatch,
  };

  // Strictly strip all hero banner properties so snapshot never touches the hero banner
  delete themeToSave.hero_bg;
  delete themeToSave.hero_text_color;
  delete themeToSave.hero_accent;
  delete themeToSave.hero_festive_position;
  delete themeToSave.hero_festive_opacity;
  delete themeToSave.banner_height;
  delete themeToSave.banner_width;
  delete themeToSave.slides;

  if (themeToSave.navbar_bg && !themeToSave.navbar_outer_bg) {
    themeToSave.navbar_outer_bg = themeToSave.navbar_bg;
  }

  const snapshot = {
    id: `theme_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim() || `Theme ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    created_at: new Date().toISOString(),
    theme: { ...themeToSave },
  };

  const currentSaved = getSavedThemeSnapshots(siteDefinition);
  const updatedList = [snapshot, ...currentSaved.filter((s: any) => s.id !== snapshot.id)].slice(0, 30);

  const siteId = getSiteStorageId(siteDefinition);
  const slug = (siteDefinition as any)?.slug || (siteDefinition as any)?.site?.slug;
  if (typeof window !== "undefined") {
    try {
      if (siteId && siteId !== "default_site") {
        localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(updatedList));
      }
      if (slug && slug !== siteId && slug !== "default_site") {
        localStorage.setItem(`webnirmaan_saved_themes_${slug}`, JSON.stringify(updatedList));
      }
      const path = window.location.pathname || "";
      const match = path.match(/\/(builder|store)\/([^/?#]+)/);
      if (match && match[2] && match[2] !== siteId && match[2] !== slug && match[2] !== "default_site") {
        localStorage.setItem(`webnirmaan_saved_themes_${match[2].trim()}`, JSON.stringify(updatedList));
      }
      window.dispatchEvent(new CustomEvent("webnirmaan_theme_saved", { detail: { siteId, slug, snapshots: updatedList } }));
    } catch { }
  }
  const isCustomPaletteSave = Boolean(customThemeProps && Object.keys(cleanCustomPatch).length > 0);

  if (isCustomPaletteSave) {
    // When saving a suggested theme to library from chat, keep active canvas theme untouched
    return {
      ...siteDefinition,
      saved_themes: updatedList,
    } as any;
  }

  const finalTheme: Record<string, any> = {
    ...siteDefinition.theme,
    ...themeToSave,
    active_snapshot_id: snapshot.id,
    // Preserve existing hero theme values on canvas definition
    ...(siteDefinition.theme?.hero_bg ? { hero_bg: siteDefinition.theme.hero_bg } : {}),
    ...(siteDefinition.theme?.hero_text_color ? { hero_text_color: siteDefinition.theme.hero_text_color } : {}),
    ...(siteDefinition.theme?.hero_accent ? { hero_accent: siteDefinition.theme.hero_accent } : {}),
    ...(siteDefinition.theme?.hero_festive_position ? { hero_festive_position: siteDefinition.theme.hero_festive_position } : {}),
    ...(siteDefinition.theme?.hero_festive_opacity !== undefined ? { hero_festive_opacity: siteDefinition.theme.hero_festive_opacity } : {}),
  };
  if (finalTheme.navbar_bg && !finalTheme.navbar_outer_bg) {
    finalTheme.navbar_outer_bg = finalTheme.navbar_bg;
  }

  const nextPages = applyThemeToPages(siteDefinition.pages || [], finalTheme);

  return {
    ...siteDefinition,
    theme: finalTheme,
    pages: nextPages,
    saved_themes: updatedList,
  } as any;
}

export function applyThemeSnapshot(
  siteDefinition: EditorSiteDefinition,
  snapshotId: string,
  publishedSiteDefinition?: EditorSiteDefinition
): EditorSiteDefinition {
  const currentSaved = getSavedThemeSnapshots(siteDefinition);
  const found = currentSaved.find((s: any) => s.id === snapshotId);
  if (!found || !found.theme) return siteDefinition;

  const patchProps = found.theme;
  const mode: ThemeMode = patchProps.mode === "dark" ? "dark" : "light";
  const isDark = mode === "dark";
  const baseDefaults = isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;

  const cleanPatchProps: Record<string, any> = {};
  Object.keys(patchProps).forEach((k) => {
    if (patchProps[k] !== undefined && patchProps[k] !== null) {
      cleanPatchProps[k] = patchProps[k];
    }
  });

  // Strip hero banner styles from snapshot patch so snapshots never alter the hero banner
  delete cleanPatchProps.hero_bg;
  delete cleanPatchProps.hero_text_color;
  delete cleanPatchProps.hero_accent;
  delete cleanPatchProps.hero_festive_position;
  delete cleanPatchProps.hero_festive_opacity;
  delete cleanPatchProps.banner_height;
  delete cleanPatchProps.banner_width;
  delete cleanPatchProps.slides;

  if (cleanPatchProps.navbar_bg && !cleanPatchProps.navbar_outer_bg) {
    cleanPatchProps.navbar_outer_bg = cleanPatchProps.navbar_bg;
  }

  // Retrieve published hero banner block and hero theme
  const { heroBlock: pubHeroBlock, heroTheme: pubHeroTheme } = getPublishedHeroDefinition(
    siteDefinition,
    publishedSiteDefinition
  );

  const primaryBg = cleanPatchProps.primary_bg || baseDefaults.primary_bg;
  const cardBg = cleanPatchProps.card_bg || baseDefaults.card_bg;
  const textColor = cleanPatchProps.text_color || baseDefaults.text_color;
  const mutedText = cleanPatchProps.muted_text_color || baseDefaults.muted_text_color;
  const accentColor = cleanPatchProps.accent_color || baseDefaults.accent_color;
  const borderColor = cleanPatchProps.navbar_border_color || cleanPatchProps.card_border_color || baseDefaults.navbar_border_color;

  const componentBaselines: Record<string, any> = {
    cart_bg: primaryBg,
    cart_panel_bg: cardBg,
    cart_card_bg: cardBg,
    cart_text_color: textColor,
    cart_accent_color: accentColor,
    cart_border_color: borderColor,
    summary_bg: primaryBg,
    summary_card_bg: cardBg,
    summary_text_color: textColor,
    summary_accent_color: accentColor,
    summary_border_color: borderColor,
    product_detail_bg: cardBg,
    product_detail_text: textColor,
    product_detail_btn_bg: accentColor,
    product_detail_btn_text: "#ffffff",
    badge_bg_color: "rgba(37,99,235,0.08)",
    badge_border_color: "rgba(37,99,235,0.2)",
    product_detail_badge_bg: "rgba(37,99,235,0.08)",
    product_detail_badge_border: "rgba(37,99,235,0.2)",
    delivery_form_bg: cardBg,
    delivery_form_text: textColor,
    delivery_form_border: borderColor,
    delivery_form_btn_bg: accentColor,
    delivery_form_btn_text: "#ffffff",
    delivery_form_input_bg: primaryBg,
    delivery_form_input_text: textColor,
    payment_bg: cardBg,
    payment_card_bg: cardBg,
    payment_text_color: textColor,
    payment_accent_color: accentColor,
    payment_border_color: borderColor,
    place_order_bg: cardBg,
    place_order_btn_bg: accentColor,
    place_order_btn_text: "#ffffff",
    place_order_text: textColor,
    profile_dropdown_bg: cardBg,
    profile_dropdown_text: textColor,
    profile_dropdown_border: borderColor,
    order_history_bg: primaryBg,
    order_history_card_bg: cardBg,
    order_history_text: textColor,
    order_history_muted_text: mutedText,
    order_history_border: borderColor,
    order_history_accent_color: accentColor,
    support_bg: primaryBg,
    support_card_bg: cardBg,
    support_chat_bg: cardBg,
    support_surface_bg: cardBg,
    support_text_color: textColor,
    support_muted_text: mutedText,
    support_accent_color: accentColor,
    support_border_color: borderColor,
    card_bg: cardBg,
    card_bg_color: cardBg,
    card_text_color: textColor,
    product_name_color: textColor,
    card_border_color: borderColor,
    brand_color: accentColor,
    price_color: getSafePriceColor(undefined, textColor, isDark),
  };

  const updatedTheme: any = {
    ...baseDefaults,
    ...componentBaselines,
    ...cleanPatchProps,
    mode,
    active_snapshot_id: snapshotId,
    // Hero theme always preserves published theme and color
    ...pubHeroTheme,
  };

  let nextPages = applyThemeToPages(siteDefinition.pages || [], updatedTheme);

  // If a published hero block exists, ensure all hero blocks across pages reflect the published banner!
  if (pubHeroBlock) {
    nextPages = nextPages.map((page) => ({
      ...page,
      blocks: (page.blocks || []).map((block) => {
        const t = String(block.type || "").toLowerCase();
        const id = String(block.id || "").toLowerCase();
        const isHero = t === "hero_banner" || t === "hero" || t === "banner" || id === "hero_banner" || id === "herobanner";
        if (isHero) {
          return {
            ...block,
            props: JSON.parse(JSON.stringify(pubHeroBlock.props || {})),
          };
        }
        return block;
      }),
    }));
  }

  return {
    ...siteDefinition,
    saved_themes: currentSaved,
    theme: updatedTheme,
    pages: nextPages,
  };
}

export function deleteThemeSnapshot(
  siteDefinition: EditorSiteDefinition,
  snapshotId: string
): EditorSiteDefinition {
  const currentSaved = getSavedThemeSnapshots(siteDefinition);
  const updatedList = currentSaved.filter((s: any) => s.id !== snapshotId);

  const siteId = getSiteStorageId(siteDefinition);
  const slug = (siteDefinition as any)?.slug || (siteDefinition as any)?.site?.slug;
  if (typeof window !== "undefined") {
    try {
      if (siteId && siteId !== "default_site") {
        localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(updatedList));
      }
      if (slug && slug !== siteId && slug !== "default_site") {
        localStorage.setItem(`webnirmaan_saved_themes_${slug}`, JSON.stringify(updatedList));
      }
      window.dispatchEvent(new CustomEvent("webnirmaan_theme_saved", { detail: { siteId, slug, snapshots: updatedList } }));
    } catch { }
  }

  return {
    ...siteDefinition,
    saved_themes: updatedList,
    pages: siteDefinition.pages,
  } as any;
}