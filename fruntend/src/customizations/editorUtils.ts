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
  | "holi";

type ThemeValues = EditorSiteDefinition["theme"];

const GLOBAL_NAVBAR_BLOCK_ID = "global-navbar";
const GLOBAL_FOOTER_BLOCK_ID = "global-footer";

const DEFAULT_LIGHT_THEME: Partial<ThemeValues> = {
  mode: "light",
  primary_bg: "#f8fafc",
  text_color: "#111827",
  accent_color: "#2563eb",
  navbar_variant: "soft",
  navbar_position: "fixed",
  navbar_height: 72,
  navbar_max_width: 1280,
  navbar_radius: 20,
  navbar_padding_x: 16,
  navbar_padding_y: 14,
};

const DEFAULT_DARK_THEME: Partial<ThemeValues> = {
  mode: "dark",
  primary_bg: "#0f172a",
  text_color: "#f9fafb",
  accent_color: "#60a5fa",
  navbar_variant: "soft",
  navbar_position: "fixed",
  navbar_height: 72,
  navbar_max_width: 1280,
  navbar_radius: 20,
  navbar_padding_x: 16,
  navbar_padding_y: 14,
};

const FESTIVAL_THEME_PRESETS: Record<
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
        primary_bg: isDark ? "#1f172a" : "#fff7ed",
        text_color: isDark ? "#fff7ed" : "#3b1d12",
        navbar_bg: isDark ? "#2a1f3d" : "#ffffff",
        navbar_text_color: isDark ? "#fff7ed" : "#3b1d12",
        navbar_muted_text_color: isDark
          ? "rgba(255,247,237,0.74)"
          : "rgba(59,29,18,0.68)",
        navbar_border_color: isDark
          ? "rgba(245,158,11,0.24)"
          : "rgba(245,158,11,0.18)",
      };

    case "christmas":
      return {
        ...FESTIVAL_THEME_PRESETS.christmas,
        primary_bg: isDark ? "#0f2e1f" : "#f0fdf4",
        text_color: isDark ? "#f0fdf4" : "#163a2b",
        navbar_bg: isDark ? "#163524" : "#ffffff",
        navbar_text_color: isDark ? "#f0fdf4" : "#163a2b",
        navbar_muted_text_color: isDark
          ? "rgba(240,253,244,0.72)"
          : "rgba(22,58,43,0.68)",
        navbar_border_color: isDark
          ? "rgba(220,38,38,0.22)"
          : "rgba(220,38,38,0.18)",
      };

    case "eid":
      return {
        ...FESTIVAL_THEME_PRESETS.eid,
        primary_bg: isDark ? "#102a43" : "#f0fdfa",
        text_color: isDark ? "#f8fafc" : "#123040",
        navbar_bg: isDark ? "#173552" : "#ffffff",
        navbar_text_color: isDark ? "#f8fafc" : "#123040",
        navbar_muted_text_color: isDark
          ? "rgba(248,250,252,0.74)"
          : "rgba(18,48,64,0.68)",
        navbar_border_color: isDark
          ? "rgba(20,184,166,0.22)"
          : "rgba(20,184,166,0.18)",
      };

    case "holi":
      return {
        ...FESTIVAL_THEME_PRESETS.holi,
        primary_bg: isDark ? "#1a1024" : "#fff1f2",
        text_color: isDark ? "#fdf4ff" : "#1f2937",
        navbar_bg: isDark ? "#241235" : "#ffffff",
        navbar_text_color: isDark ? "#fdf4ff" : "#1f2937",
        navbar_muted_text_color: isDark
          ? "rgba(253,244,255,0.74)"
          : "rgba(31,41,55,0.72)",
        navbar_border_color: isDark
          ? "rgba(147,51,234,0.24)"
          : "rgba(147,51,234,0.16)",
      };

    case "none":
    default:
      return {};
  }
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

  if (blockId === GLOBAL_NAVBAR_BLOCK_ID) {
    return buildGlobalNavbarBlock(siteDefinition);
  }

  if (blockId === GLOBAL_FOOTER_BLOCK_ID) {
    return buildGlobalFooterBlock(siteDefinition);
  }

  for (const page of siteDefinition.pages) {
    const match = page.blocks.find((block) => block.id === blockId);
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
  if (blockId === GLOBAL_NAVBAR_BLOCK_ID) {
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

  if (blockId === GLOBAL_FOOTER_BLOCK_ID) {
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
  themePatch: Record<string, any>
): EditorSiteDefinition {
  return {
    ...siteDefinition,
    theme: {
      ...siteDefinition.theme,
      ...themePatch,
    },
  };
}

export function applyThemeMode(
  siteDefinition: EditorSiteDefinition,
  mode: ThemeMode
): EditorSiteDefinition {
  const base = mode === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
  const currentFestival = siteDefinition.theme?.festival_theme;

  let updatedTheme: any = {
    ...siteDefinition.theme,
    ...base,
    mode,
    navbar_bg: undefined,
    navbar_text_color: undefined,
    navbar_muted_text_color: undefined,
    navbar_border_color: undefined,
    footer_bg: undefined,
    footer_text_color: undefined,
    footer_muted_color: undefined,
    footer_border_color: undefined,
    secondary_bg: undefined,
  };

  if (currentFestival && currentFestival !== "none") {
    const festivalOverrides = getFestivalThemeOverrides(currentFestival as FestivalThemeKey, mode);
    updatedTheme = {
      ...updatedTheme,
      ...festivalOverrides,
      festival_theme: currentFestival,
    };
  }

  return {
    ...siteDefinition,
    theme: updatedTheme,
  };
}

export function applyFestivalTheme(
  siteDefinition: EditorSiteDefinition,
  preset: FestivalThemeKey
): EditorSiteDefinition {
  if (preset === "none") {
    return {
      ...siteDefinition,
      theme: {
        ...siteDefinition.theme,
        festival_theme: undefined,
        brand_tone: undefined,
        visual_style: undefined,
        accent_color: undefined,
        primary_bg: undefined,
        text_color: undefined,
        navbar_bg: undefined,
        navbar_text_color: undefined,
        navbar_muted_text_color: undefined,
        navbar_border_color: undefined,
      },
    };
  }

  const mode: ThemeMode =
    siteDefinition.theme.mode === "dark" ? "dark" : "light";

  const festivalOverrides = getFestivalThemeOverrides(preset, mode);
  const updatedTheme = {
    ...siteDefinition.theme,
    ...festivalOverrides,
    festival_theme: preset,
  };

  const heroBg = festivalOverrides.hero_bg || festivalOverrides.secondary_bg || festivalOverrides.primary_bg;
  const heroText = festivalOverrides.hero_text_color || festivalOverrides.text_color;
  const accentCol = festivalOverrides.accent_color;

  const nextPages = (siteDefinition.pages || []).map((page) => ({
    ...page,
    blocks: (page.blocks || []).map((block) => {
      const btype = String(block.type || "").toLowerCase();
      const isHero = btype === "hero_banner" || btype === "hero" || btype === "banner";
      const isNav = btype === "navbar" || btype === "header";
      const isFooter = btype === "footer";

      const existingProps = block.props || {};
      let updatedProps = { ...existingProps };

      if (isNav) {
        delete updatedProps.navbar_bg;
        delete updatedProps.navbar_text_color;
        delete updatedProps.navbar_border_color;
      }
      if (isFooter) {
        delete updatedProps.footer_bg;
        delete updatedProps.footer_text_color;
      }
      if (isHero) {
        delete updatedProps.hero_bg;
        delete updatedProps.background_color;
        if (Array.isArray(updatedProps.slides)) {
          updatedProps.slides = updatedProps.slides.map((slide: any) => ({
            ...slide,
            ...(heroBg ? { hero_bg: heroBg, background_color: heroBg } : {}),
            ...(heroText ? { hero_text_color: heroText, text_color: heroText } : {}),
            ...(accentCol ? { accent_color: accentCol } : {}),
          }));
        }
      }

      return {
        ...block,
        props: updatedProps,
      };
    }),
  }));

  return {
    ...siteDefinition,
    theme: updatedTheme,
    pages: nextPages,
  };
}

export function getSavedThemeSnapshots(siteDefinition: EditorSiteDefinition): any[] {
  const inMemory = Array.isArray((siteDefinition as any)?.saved_themes)
    ? (siteDefinition as any).saved_themes
    : [];

  const siteId = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id || siteDefinition?.site?.brand_name || "";
  let inStorage: any[] = [];
  if (typeof window !== "undefined" && siteId) {
    try {
      const raw = localStorage.getItem(`webnirmaan_saved_themes_${siteId}`);
      if (raw) inStorage = JSON.parse(raw);
    } catch {}
  }

  const map = new Map<string, any>();
  if (Array.isArray(inStorage)) {
    inStorage.forEach((s) => s && s.id && map.set(s.id, s));
  }
  if (Array.isArray(inMemory)) {
    inMemory.forEach((s) => s && s.id && map.set(s.id, s));
  }

  return Array.from(map.values()).slice(0, 30);
}

export function saveThemeSnapshot(
  siteDefinition: EditorSiteDefinition,
  name: string,
  customThemeProps?: Record<string, any>
): EditorSiteDefinition {
  const themeToSave = customThemeProps ? (customThemeProps.patch || customThemeProps.theme || customThemeProps) : (siteDefinition.theme || {});
  const snapshot = {
    id: `theme_${Date.now()}`,
    name: name.trim() || `Theme ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    created_at: new Date().toISOString(),
    theme: { ...themeToSave },
  };

  const currentSaved = getSavedThemeSnapshots(siteDefinition);
  const updatedList = [snapshot, ...currentSaved.filter((s: any) => s.id !== snapshot.id)].slice(0, 30);

  const siteId = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id || siteDefinition?.site?.brand_name || "";
  if (typeof window !== "undefined" && siteId) {
    try {
      localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(updatedList));
    } catch {}
  }

  return {
    ...siteDefinition,
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
  const heroBg = patchProps.hero_bg || patchProps.secondary_bg || patchProps.primary_bg;
  const heroText = patchProps.hero_text_color || patchProps.text_color;
  const accentCol = patchProps.hero_accent || patchProps.accent_color;

  const nextPages = (siteDefinition.pages || []).map((page) => ({
    ...page,
    blocks: (page.blocks || []).map((block) => {
      const btype = String(block.type || "").toLowerCase();
      const isHero = btype === "hero_banner" || btype === "hero" || btype === "banner";
      const isNav = btype === "navbar" || btype === "header";
      const isFooter = btype === "footer";

      const updatedProps = { ...(block.props || {}) };

      if (isNav) {
        delete updatedProps.navbar_bg;
        delete updatedProps.navbar_text_color;
        delete updatedProps.navbar_border_color;
      }
      if (isFooter) {
        delete updatedProps.footer_bg;
        delete updatedProps.footer_text_color;
      }
      if (isHero) {
        delete updatedProps.hero_bg;
        delete updatedProps.background_color;
        if (Array.isArray(updatedProps.slides)) {
          updatedProps.slides = updatedProps.slides.map((slide: any) => ({
            ...slide,
            ...(heroBg ? { hero_bg: heroBg, background_color: heroBg } : {}),
            ...(heroText ? { hero_text_color: heroText, text_color: heroText } : {}),
            ...(accentCol ? { accent_color: accentCol } : {}),
          }));
        }
      }

      return {
        ...block,
        props: updatedProps,
      };
    }),
  }));

  return {
    ...siteDefinition,
    saved_themes: currentSaved,
    theme: {
      ...siteDefinition.theme,
      ...patchProps,
    },
    pages: nextPages,
  };
}

export function deleteThemeSnapshot(
  siteDefinition: EditorSiteDefinition,
  snapshotId: string
): EditorSiteDefinition {
  const currentSaved = getSavedThemeSnapshots(siteDefinition);
  const updatedList = currentSaved.filter((s: any) => s.id !== snapshotId);

  const siteId = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id || siteDefinition?.site?.brand_name || "";
  if (typeof window !== "undefined" && siteId) {
    try {
      localStorage.setItem(`webnirmaan_saved_themes_${siteId}`, JSON.stringify(updatedList));
    } catch {}
  }

  return {
    ...siteDefinition,
    saved_themes: updatedList,
  } as any;
}