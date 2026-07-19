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
};