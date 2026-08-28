import { editorRegistry } from "./editorRegistry";
import { EditableBlockConfig, EditorField } from "./editorTypes";

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
    navbar_padding_y?: number;
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
    show_newsletter?: boolean;
    newsletter_title?: string;
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
};

const DEFAULT_DARK_THEME: Partial<ThemeValues> = {
  mode: "dark",
  primary_bg: "#0f172a",
  secondary_bg: "#1e293b",
  card_bg: "#1e293b",
  text_color: "#f8fafc",
  muted_text_color: "rgba(248,250,252,0.7)",
  accent_color: "#38bdf8",
  navbar_bg: "#0f172a",
  navbar_outer_bg: "#0f172a",
  navbar_text_color: "#f8fafc",
  navbar_muted_text_color: "rgba(248,250,252,0.7)",
  navbar_border_color: "rgba(255,255,255,0.12)",
  footer_bg: "#0f172a",
  footer_text_color: "#f8fafc",
  footer_border_color: "rgba(255,255,255,0.12)",
  hero_bg: "#1e293b",
  hero_text_color: "#f8fafc",
  hero_accent: "#38bdf8",
};

export const FESTIVAL_THEME_PRESETS: Record<
  FestivalThemeKey,
  Omit<Partial<ThemeValues>, "mode">
> = {
  none: {},
  diwali: {
    festival_theme: "diwali",
    accent_color: "#f59e0b",
    brand_tone: "Warm and festive",
    visual_style: "Elegant celebration",
  },
  christmas: {
    festival_theme: "christmas",
    accent_color: "#dc2626",
    brand_tone: "Cozy and joyful",
    visual_style: "Classic festive",
  },
  eid: {
    festival_theme: "eid",
    accent_color: "#14b8a6",
    brand_tone: "Refined and celebratory",
    visual_style: "Modern festive",
  },
  holi: {
    festival_theme: "holi",
    accent_color: "#9333ea",
    brand_tone: "Playful and vibrant",
    visual_style: "Colorful festive",
  },
  durga_puja: {
    festival_theme: "durga_puja",
    accent_color: "#e11d48",
    brand_tone: "Devotional and grand",
    visual_style: "Royal cultural festival",
  },
  rakhi: {
    festival_theme: "rakhi",
    accent_color: "#f59e0b",
    brand_tone: "Cherished sibling celebration",
    visual_style: "Auspicious festive bond",
  },
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
      show_newsletter: siteDefinition.footer?.show_newsletter ?? true,
      newsletter_title: siteDefinition.footer?.newsletter_title || "Subscribe to Our Newsletter",
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
  "product_detail_bg", "product_detail_text", "product_detail_btn_bg", "product_detail_btn_text",
  "cart_bg", "cart_text_color", "cart_card_bg", "cart_accent_color", "cart_border_color", "cart_panel_bg",
  "summary_bg", "summary_card_bg", "summary_text_color", "summary_accent_color", "summary_border_color",
  "payment_bg", "payment_card_bg", "payment_text_color", "payment_accent_color", "payment_border_color",
  "place_order_bg", "place_order_btn_bg", "place_order_btn_text", "place_order_text",
  "filter_bg", "filter_card_bg", "filter_text_color", "filter_border_color", "filter_accent_color",
  "pagination_bg", "pagination_text_color", "pagination_active_bg", "pagination_border_color",
  "review_card_bg", "review_text_color", "review_border_color",
  "grid_bg", "grid_text_color", "outer_bg_color"
];

export function applyThemeToPages(pages: EditorPage[], targetTheme: any): EditorPage[] {
  return (pages || []).map((page) => ({
    ...page,
    blocks: (page.blocks || []).map((block) => {
      const btype = String(block.type || "").toLowerCase();
      const isNav = btype === "navbar" || btype === "header";
      const isFooter = btype === "footer";
      const isHero = btype === "hero_banner" || btype === "hero" || btype === "banner";

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
      } else if (isHero) {
        if (targetTheme.hero_bg) updatedProps.hero_bg = targetTheme.hero_bg;
        if (targetTheme.hero_text_color) updatedProps.hero_text_color = targetTheme.hero_text_color;
        if (targetTheme.hero_accent) updatedProps.accent_color = targetTheme.hero_accent;

        if (Array.isArray(updatedProps.slides)) {
          updatedProps.slides = updatedProps.slides.map((slide: any) => {
            const nextSlide = { ...slide };
            if (!nextSlide.background_image) {
              delete nextSlide.background_color;
              delete nextSlide.hero_bg;
              delete nextSlide.hero_text_color;
              delete nextSlide.text_color;
              delete nextSlide.accent_color;
            }
            return nextSlide;
          });
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
  "delivery_form",
  "deliveryform",
  "payment_methods",
  "paymentmethods",
  "place_order_cta",
  "placeordercta",
  "checkout_summary",
  "checkoutsummary",
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

  if (blockId === "cart_view" || blockId.includes("cart")) {
    return {
      id: blockId,
      type: "cart_view",
      props: {},
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
  const updatedTheme = {
    ...siteDefinition.theme,
    ...nextPatch,
  };

  // If this is a global theme update (e.g. palette change, primary_bg / secondary_bg update),
  // purge all residual component-level overrides so the new theme takes effect 100% across all components!
  const isGlobal =
    isGlobalPatch ||
    ("primary_bg" in nextPatch && "secondary_bg" in nextPatch) ||
    ("primary_bg" in nextPatch && "text_color" in nextPatch) ||
    ("festival_theme" in nextPatch);

  if (isGlobal) {
    for (const k of ALL_COMPONENT_OVERRIDE_KEYS) {
      if (!(k in nextPatch)) {
        delete (updatedTheme as any)[k];
      }
    }
  }

  const nextPages = applyThemeToPages(siteDefinition.pages || [], updatedTheme);

  return {
    ...siteDefinition,
    theme: updatedTheme,
    pages: nextPages,
  };
}

export function applyThemeMode(
  siteDefinition: EditorSiteDefinition,
  mode: ThemeMode
): EditorSiteDefinition {
  const baseDefaults = mode === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;

  const updatedTheme: any = {
    ...baseDefaults,
    mode,
    festival_theme: "none",
  };

  // Purge any residual component-level overrides from prior chats/customizations
  for (const k of ALL_COMPONENT_OVERRIDE_KEYS) {
    delete updatedTheme[k];
  }

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
  const updatedTheme: any = {
    ...currentTheme,
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
    const brand = siteDefinition?.site?.brand_name;
    if (brand && typeof brand === "string" && brand.trim()) {
      return brand.trim().toLowerCase().replace(/\s+/g, "_");
    }
  }
  if (typeof window !== "undefined") {
    try {
      const path = window.location.pathname || "";
      const match = path.match(/\/(builder|store)\/([^/?#]+)/);
      if (match && match[2]) return match[2].trim();
    } catch {}
  }
  return "default_site";
}

export function getSavedThemeSnapshots(siteDefinition: EditorSiteDefinition): any[] {
  const siteId = getSiteStorageId(siteDefinition);
  let inStorage: any[] = [];

  if (typeof window !== "undefined") {
    try {
      const rawSpecific = localStorage.getItem(`webnirmaan_saved_themes_${siteId}`);
      if (rawSpecific) {
        const parsed = JSON.parse(rawSpecific);
        if (Array.isArray(parsed)) {
          inStorage = parsed;
        }
      }
      if (inStorage.length === 0) {
        const rawGlobal = localStorage.getItem("webnirmaan_saved_themes_global");
        if (rawGlobal) {
          const parsedGlobal = JSON.parse(rawGlobal);
          if (Array.isArray(parsedGlobal)) {
            inStorage = parsedGlobal;
          }
        }
      }
    } catch {}
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

  return Array.from(map.values()).slice(0, 30);
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

  // Capture hero block overrides into theme object for snapshot
  let heroBlockBg: string | undefined;
  let heroBlockText: string | undefined;
  let heroBlockAccent: string | undefined;

  (siteDefinition.pages || []).forEach((page) => {
    (page.blocks || []).forEach((block) => {
      const btype = String(block.type || "").toLowerCase();
      if (btype === "hero_banner" || btype === "hero" || btype === "banner") {
        const props = block.props || {};
        const activeSlide = Array.isArray(props.slides) ? props.slides[0] : null;
        if (props.hero_bg) heroBlockBg = props.hero_bg;
        else if (props.background_color) heroBlockBg = props.background_color;
        else if (activeSlide?.background_color) heroBlockBg = activeSlide.background_color;
        else if (activeSlide?.hero_bg) heroBlockBg = activeSlide.hero_bg;

        if (props.hero_text_color) heroBlockText = props.hero_text_color;
        else if (props.text_color) heroBlockText = props.text_color;
        else if (activeSlide?.hero_text_color) heroBlockText = activeSlide.hero_text_color;
        else if (activeSlide?.text_color) heroBlockText = activeSlide.text_color;

        if (props.accent_color) heroBlockAccent = props.accent_color;
        else if (activeSlide?.accent_color) heroBlockAccent = activeSlide.accent_color;
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

  const themeToSave: Record<string, any> = {
    ...cleanBaseTheme,
    ...(heroBlockBg ? { hero_bg: heroBlockBg } : {}),
    ...(heroBlockText ? { hero_text_color: heroBlockText } : {}),
    ...(heroBlockAccent ? { hero_accent: heroBlockAccent } : {}),
    ...cleanCustomPatch,
  };

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
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(updatedList));
      localStorage.setItem("webnirmaan_saved_themes_global", JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent("webnirmaan_theme_saved", { detail: { snapshots: updatedList } }));
    } catch {}
  }

  const finalTheme: Record<string, any> = {
    ...siteDefinition.theme,
    ...themeToSave,
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
  snapshotId: string
): EditorSiteDefinition {
  const currentSaved = getSavedThemeSnapshots(siteDefinition);
  const found = currentSaved.find((s: any) => s.id === snapshotId);
  if (!found || !found.theme) return siteDefinition;

  const patchProps = found.theme;
  const mode: ThemeMode = patchProps.mode === "dark" ? "dark" : "light";
  const baseDefaults = mode === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;

  const cleanPatchProps: Record<string, any> = {};
  Object.keys(patchProps).forEach((k) => {
    if (patchProps[k] !== undefined && patchProps[k] !== null) {
      cleanPatchProps[k] = patchProps[k];
    }
  });

  if (cleanPatchProps.navbar_bg && !cleanPatchProps.navbar_outer_bg) {
    cleanPatchProps.navbar_outer_bg = cleanPatchProps.navbar_bg;
  }

  const updatedTheme: any = {
    ...baseDefaults,
    ...cleanPatchProps,
    mode,
  };

  const nextPages = applyThemeToPages(siteDefinition.pages || [], updatedTheme);

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
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(updatedList));
      localStorage.setItem("webnirmaan_saved_themes_global", JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent("webnirmaan_theme_saved", { detail: { snapshots: updatedList } }));
    } catch {}
  }

  return {
    ...siteDefinition,
    saved_themes: updatedList,
  } as any;
}