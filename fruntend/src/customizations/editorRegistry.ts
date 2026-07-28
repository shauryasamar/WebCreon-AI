import { EditorRegistry } from "./editorTypes";

const sizeField = {
  key: "size",
  label: "Size",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Small", value: "sm" },
    { label: "Medium", value: "md" },
    { label: "Large", value: "lg" },
  ],
};

const textColorField = {
  key: "text_color",
  label: "Text color",
  type: "color" as const,
  target: "props" as const,
};

const heroHeadlineField = {
  key: "headline",
  label: "Headline",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Enter headline",
};

const heroSubheadlineField = {
  key: "subheadline",
  label: "Subheadline",
  type: "textarea" as const,
  target: "props" as const,
  placeholder: "Enter subheadline",
};

const heroBackgroundImageField = {
  key: "background_image",
  label: "Background image URL",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Paste image URL",
};

const heroBackgroundOverlayField = {
  key: "background_overlay",
  label: "Background overlay",
  type: "text" as const,
  target: "props" as const,
  placeholder: "rgba(0, 0, 0, 0.28)",
};

const heroBackgroundPositionField = {
  key: "background_position",
  label: "Background position",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Center", value: "center" },
    { label: "Top", value: "top" },
    { label: "Bottom", value: "bottom" },
    { label: "Left", value: "left" },
    { label: "Right", value: "right" },
  ],
};

const heroBackgroundSizeField = {
  key: "background_size",
  label: "Background size",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Cover", value: "cover" },
    { label: "Contain", value: "contain" },
    { label: "Auto", value: "auto" },
  ],
};

const navbarBrandNameField = {
  key: "brandName",
  label: "Brand name",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Storefront",
};

const navbarTaglineField = {
  key: "tagline",
  label: "Tagline",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Short brand tagline",
};

const navbarShowSearchField = {
  key: "showSearch",
  label: "Show search",
  type: "checkbox" as const,
  target: "props" as const,
};

const navbarShowAccountField = {
  key: "showAccount",
  label: "Show account",
  type: "checkbox" as const,
  target: "props" as const,
};

const navbarShowCartField = {
  key: "showCart",
  label: "Show cart",
  type: "checkbox" as const,
  target: "props" as const,
};

const navbarVariantField = {
  key: "navbar_variant",
  label: "Navbar style",
  type: "select" as const,
  target: "theme" as const,
  options: [
    { label: "Soft", value: "soft" },
    { label: "Solid", value: "solid" },
    { label: "Floating", value: "floating" },
    { label: "Transparent", value: "transparent" },
  ],
};

const navbarPositionField = {
  key: "navbar_position",
  label: "Navbar position",
  type: "select" as const,
  target: "theme" as const,
  options: [
    { label: "Scroll with page", value: "static" },
    { label: "Stick while scrolling", value: "sticky" },
    { label: "Fixed preview position", value: "fixed" },
  ],
  helpText:
    "Use static for normal page flow, sticky to keep it visible while scrolling, and fixed preview position for a stronger pinned effect inside the builder preview.",
};

const navbarBackgroundColorField = {
  key: "navbar_bg",
  label: "Navbar background",
  type: "color" as const,
  target: "theme" as const,
};

const navbarTextColorField = {
  key: "navbar_text_color",
  label: "Navbar text color",
  type: "color" as const,
  target: "theme" as const,
};

const navbarMutedTextColorField = {
  key: "navbar_muted_text_color",
  label: "Muted text color",
  type: "color" as const,
  target: "theme" as const,
};

const navbarBorderColorField = {
  key: "navbar_border_color",
  label: "Border color",
  type: "color" as const,
  target: "theme" as const,
};

const navbarHeightField = {
  key: "navbar_height",
  label: "Navbar height",
  type: "number" as const,
  target: "theme" as const,
  min: 56,
  max: 140,
  step: 2,
  helpText: "Controls the minimum overall height of the navbar shell.",
};

const navbarMaxWidthField = {
  key: "navbar_max_width",
  label: "Content width",
  type: "number" as const,
  target: "theme" as const,
  min: 720,
  max: 1600,
  step: 10,
  helpText: "Controls how wide the navbar content area can grow.",
};

const navbarRadiusField = {
  key: "navbar_radius",
  label: "Corner radius",
  type: "number" as const,
  target: "theme" as const,
  min: 0,
  max: 40,
  step: 1,
  helpText: "Adjust the roundness of the navbar shell.",
};

const navbarPaddingXField = {
  key: "navbar_padding_x",
  label: "Horizontal padding",
  type: "number" as const,
  target: "theme" as const,
  min: 0,
  max: 40,
  step: 1,
  helpText: "Controls left and right spacing inside the navbar.",
};

const navbarPaddingYField = {
  key: "navbar_padding_y",
  label: "Vertical padding",
  type: "number" as const,
  target: "theme" as const,
  min: 0,
  max: 32,
  step: 1,
  helpText: "Controls top and bottom spacing inside the navbar.",
};

export const editorRegistry: EditorRegistry = {
  product_grid: {
    displayName: "Product Grid",
    fields: [sizeField, textColorField],
  },
  productgrid: {
    displayName: "Product Grid",
    fields: [sizeField, textColorField],
  },

  product_detail: {
    displayName: "Product Detail",
    fields: [sizeField, textColorField],
  },
  productdetail: {
    displayName: "Product Detail",
    fields: [sizeField, textColorField],
  },

  hero_banner: {
    displayName: "Hero Banner",
    fields: [
      heroHeadlineField,
      heroSubheadlineField,
      heroBackgroundImageField,
      heroBackgroundOverlayField,
      heroBackgroundPositionField,
      heroBackgroundSizeField,
      sizeField,
      textColorField,
    ],
  },
  herobanner: {
    displayName: "Hero Banner",
    fields: [
      heroHeadlineField,
      heroSubheadlineField,
      heroBackgroundImageField,
      heroBackgroundOverlayField,
      heroBackgroundPositionField,
      heroBackgroundSizeField,
      sizeField,
      textColorField,
    ],
  },

  category_grid: {
    displayName: "Category Grid",
    fields: [sizeField, textColorField],
  },
  categorygrid: {
    displayName: "Category Grid",
    fields: [sizeField, textColorField],
  },

  offer_cards: {
    displayName: "Offer Cards",
    fields: [sizeField, textColorField],
  },
  offercards: {
    displayName: "Offer Cards",
    fields: [sizeField, textColorField],
  },

  page_header: {
    displayName: "Page Header",
    fields: [sizeField, textColorField],
  },
  pageheader: {
    displayName: "Page Header",
    fields: [sizeField, textColorField],
  },

  navbar: {
    displayName: "Navbar",
    fields: [
      navbarBrandNameField,
      navbarTaglineField,
      navbarVariantField,
      navbarPositionField,
      navbarHeightField,
      navbarMaxWidthField,
      navbarRadiusField,
      navbarPaddingXField,
      navbarPaddingYField,
      navbarBackgroundColorField,
      navbarTextColorField,
      navbarMutedTextColorField,
      navbarBorderColorField,
      navbarShowSearchField,
      navbarShowAccountField,
      navbarShowCartField,
    ],
  },
};