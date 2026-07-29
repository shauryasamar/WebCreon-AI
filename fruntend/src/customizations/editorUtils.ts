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
    text_color?: string;
    accent_color?: string;
    festival_theme?: string;
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
    showSearch?: boolean;
    showAccount?: boolean;
    showCart?: boolean;
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

export function findBlockById(
  siteDefinition: EditorSiteDefinition | null,
  blockId: string | null
): EditorBlock | null {
  if (!siteDefinition || !blockId) return null;

  if (blockId === GLOBAL_NAVBAR_BLOCK_ID) {
    return buildGlobalNavbarBlock(siteDefinition);
  }

  for (const page of siteDefinition.pages) {
    const match = page.blocks.find((block) => block.id === blockId);
    if (match) return match;
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
  return editorRegistry[blockType] || null;
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

    if (Object.prototype.hasOwnProperty.call(propsPatch, "brandName")) {
      nextSiteDefinition = {
        ...nextSiteDefinition,
        site: {
          ...nextSiteDefinition.site,
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

  return {
    ...siteDefinition,
    theme: {
      ...siteDefinition.theme,
      ...base,
      mode,
      name: undefined,
      festival_theme: undefined,
      brand_tone: undefined,
      visual_style: undefined,
      navbar_bg: undefined,
      navbar_text_color: undefined,
      navbar_muted_text_color: undefined,
      navbar_border_color: undefined,
    },
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

  return {
    ...siteDefinition,
    theme: {
      ...siteDefinition.theme,
      ...festivalOverrides,
      festival_theme: preset,
    },
  };
}