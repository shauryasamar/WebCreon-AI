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

const DEFAULT_LIGHT_THEME: Partial<ThemeValues> = {
  mode: "light",
  primary_bg: "#f8fafc",
  text_color: "#111827",
  accent_color: "#2563eb",
};

const DEFAULT_DARK_THEME: Partial<ThemeValues> = {
  mode: "dark",
  primary_bg: "#0f172a",
  text_color: "#f9fafb",
  accent_color: "#60a5fa",
};

const FESTIVAL_THEME_PRESETS: Record<FestivalThemeKey, Partial<ThemeValues>> = {
  none: {},
  diwali: {
    festival_theme: "diwali",
    accent_color: "#f59e0b",
    primary_bg: "#1f172a",
    text_color: "#fff7ed",
    brand_tone: "Warm and festive",
    visual_style: "Elegant celebration",
  },
  christmas: {
    festival_theme: "christmas",
    accent_color: "#dc2626",
    primary_bg: "#0f2e1f",
    text_color: "#f0fdf4",
    brand_tone: "Cozy and joyful",
    visual_style: "Classic festive",
  },
  eid: {
    festival_theme: "eid",
    accent_color: "#14b8a6",
    primary_bg: "#102a43",
    text_color: "#f8fafc",
    brand_tone: "Refined and celebratory",
    visual_style: "Modern festive",
  },
  holi: {
    festival_theme: "holi",
    accent_color: "#9333ea",
    primary_bg: "#fff7ed",
    text_color: "#1f2937",
    brand_tone: "Playful and vibrant",
    visual_style: "Colorful festive",
  },
};

export function findBlockById(
  siteDefinition: EditorSiteDefinition | null,
  blockId: string | null
): EditorBlock | null {
  if (!siteDefinition || !blockId) return null;

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
    const blockIndex = siteDefinition.pages[pageIndex].blocks.findIndex(
      (block) => block.id === blockId
    );

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
    },
  };
}

export function applyFestivalTheme(
  siteDefinition: EditorSiteDefinition,
  preset: FestivalThemeKey
): EditorSiteDefinition {
  return {
    ...siteDefinition,
    theme: {
      ...siteDefinition.theme,
      ...FESTIVAL_THEME_PRESETS[preset],
      festival_theme: preset === "none" ? undefined : preset,
    },
  };
}