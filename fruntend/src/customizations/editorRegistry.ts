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

const cartTitleField = {
  key: "title",
  label: "Cart title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Your cart",
};

const cartEmptyTitleField = {
  key: "empty_title",
  label: "Empty state title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Your cart is empty",
};

const cartEmptyMessageField = {
  key: "empty_message",
  label: "Empty state message",
  type: "textarea" as const,
  target: "props" as const,
  placeholder: "Add products to continue shopping.",
};

const cartShowPromoField = {
  key: "show_promo",
  label: "Show promo code",
  type: "checkbox" as const,
  target: "props" as const,
};

const cartShowSummaryField = {
  key: "show_summary",
  label: "Show summary",
  type: "checkbox" as const,
  target: "props" as const,
};

const cartPromoTitleField = {
  key: "promo_title",
  label: "Promo title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Promo code",
};

const cartPromoPlaceholderField = {
  key: "promo_placeholder",
  label: "Promo placeholder",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Enter promo code",
};

const cartPromoButtonLabelField = {
  key: "promo_button_label",
  label: "Promo button label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Apply",
};

const cartSummaryTitleField = {
  key: "summary_title",
  label: "Summary title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Order summary",
};

const cartCheckoutLabelField = {
  key: "checkout_label",
  label: "Checkout button label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Proceed to checkout",
};

const cartSubtotalLabelField = {
  key: "subtotal_label",
  label: "Subtotal label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Subtotal",
};

const cartShippingLabelField = {
  key: "shipping_label",
  label: "Shipping label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Shipping",
};

const cartTaxLabelField = {
  key: "tax_label",
  label: "Tax label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Estimated tax",
};

const cartTotalLabelField = {
  key: "total_label",
  label: "Total label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Total",
};

const cartMaxWidthField = {
  key: "max_width",
  label: "Cart width",
  type: "number" as const,
  target: "props" as const,
  min: 240,
  max: 900,
  step: 4,
  helpText: "Maximum width of the cart container.",
};

const cartMinHeightField = {
  key: "min_height",
  label: "Cart height",
  type: "number" as const,
  target: "props" as const,
  min: 0,
  max: 1200,
  step: 4,
  helpText: "Minimum height of the cart container.",
};

const cartBorderRadiusField = {
  key: "border_radius",
  label: "Outer corner radius",
  type: "number" as const,
  target: "props" as const,
  min: 0,
  max: 40,
  step: 1,
};

const cartCardRadiusField = {
  key: "card_radius",
  label: "Inner card radius",
  type: "number" as const,
  target: "props" as const,
  min: 0,
  max: 32,
  step: 1,
};

const cartBackgroundColorField = {
  key: "background_color",
  label: "Background color",
  type: "color" as const,
  target: "props" as const,
};

const cartPanelColorField = {
  key: "panel_color",
  label: "Panel color",
  type: "color" as const,
  target: "props" as const,
};

const cartCardColorField = {
  key: "card_color",
  label: "Card color",
  type: "color" as const,
  target: "props" as const,
};

const cartTextColorField = {
  key: "text_color",
  label: "Text color",
  type: "color" as const,
  target: "props" as const,
};

const cartMutedTextColorField = {
  key: "muted_text_color",
  label: "Muted text color",
  type: "color" as const,
  target: "props" as const,
};

const cartBorderColorField = {
  key: "border_color",
  label: "Border color",
  type: "color" as const,
  target: "props" as const,
};

const cartAccentColorField = {
  key: "accent_color",
  label: "Accent color",
  type: "color" as const,
  target: "props" as const,
};

const deliverySectionLabelField = {
  key: "sectionLabel",
  label: "Section label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Delivery",
};

const deliveryTitleField = {
  key: "title",
  label: "Title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Delivery details",
};

const deliveryAccentColorField = {
  key: "accentColor",
  label: "Accent color override",
  type: "color" as const,
  target: "props" as const,
};

const deliveryCompactField = {
  key: "compact",
  label: "Compact layout",
  type: "checkbox" as const,
  target: "props" as const,
};

const paymentSectionLabelField = {
  key: "sectionLabel",
  label: "Section label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Payment",
};

const paymentTitleField = {
  key: "title",
  label: "Title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Payment method",
};

const paymentMethodsField = {
  key: "paymentMethods",
  label: "Payment methods",
  type: "json" as const,
  target: "props" as const,
  helpText: 'Example: ["COD", "UPI"]',
};

const paymentAccentColorField = {
  key: "accentColor",
  label: "Accent color override",
  type: "color" as const,
  target: "props" as const,
};

const paymentCompactField = {
  key: "compact",
  label: "Compact layout",
  type: "checkbox" as const,
  target: "props" as const,
};

const placeOrderLabelField = {
  key: "buttonLabel",
  label: "Button label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Place order",
};

const placeOrderAccentColorField = {
  key: "accentColor",
  label: "Button color override",
  type: "color" as const,
  target: "props" as const,
};

const placeOrderCompactField = {
  key: "compact",
  label: "Compact layout",
  type: "checkbox" as const,
  target: "props" as const,
};

const styleBackgroundColorField = {
  key: "background_color",
  label: "Background color",
  type: "color" as const,
  target: "props" as const,
};

const stylePanelColorField = {
  key: "panel_color",
  label: "Panel color",
  type: "color" as const,
  target: "props" as const,
};

const styleInputColorField = {
  key: "input_color",
  label: "Input color",
  type: "color" as const,
  target: "props" as const,
};

const styleTextColorField = {
  key: "text_color",
  label: "Text color",
  type: "color" as const,
  target: "props" as const,
};

const styleMutedTextColorField = {
  key: "muted_text_color",
  label: "Muted text color",
  type: "color" as const,
  target: "props" as const,
};

const styleSoftTextColorField = {
  key: "soft_text_color",
  label: "Label color",
  type: "color" as const,
  target: "props" as const,
};

const stylePlaceholderColorField = {
  key: "placeholder_color",
  label: "Placeholder color",
  type: "color" as const,
  target: "props" as const,
};

const styleBorderColorField = {
  key: "border_color",
  label: "Border color",
  type: "color" as const,
  target: "props" as const,
};

const styleSoftBorderColorField = {
  key: "soft_border_color",
  label: "Soft border color",
  type: "color" as const,
  target: "props" as const,
};

const styleBorderRadiusField = {
  key: "border_radius",
  label: "Corner radius",
  type: "number" as const,
  target: "props" as const,
  min: 0,
  max: 40,
  step: 1,
};

const styleItemRadiusField = {
  key: "item_radius",
  label: "Inner item radius",
  type: "number" as const,
  target: "props" as const,
  min: 0,
  max: 32,
  step: 1,
};

const styleFieldRadiusField = {
  key: "field_radius",
  label: "Field radius",
  type: "number" as const,
  target: "props" as const,
  min: 0,
  max: 24,
  step: 1,
};

const stylePaddingField = {
  key: "padding",
  label: "Padding",
  type: "number" as const,
  target: "props" as const,
  min: 8,
  max: 40,
  step: 1,
};

const styleGapField = {
  key: "gap",
  label: "Section gap",
  type: "number" as const,
  target: "props" as const,
  min: 6,
  max: 32,
  step: 1,
};

const styleMaxWidthField = {
  key: "max_width",
  label: "Max width",
  type: "number" as const,
  target: "props" as const,
  min: 240,
  max: 900,
  step: 4,
};

const cartFields = [
  cartTitleField,
  cartEmptyTitleField,
  cartEmptyMessageField,
  cartShowPromoField,
  cartShowSummaryField,
  cartPromoTitleField,
  cartPromoPlaceholderField,
  cartPromoButtonLabelField,
  cartSummaryTitleField,
  cartCheckoutLabelField,
  cartSubtotalLabelField,
  cartShippingLabelField,
  cartTaxLabelField,
  cartTotalLabelField,
  cartMaxWidthField,
  cartMinHeightField,
  cartBorderRadiusField,
  cartCardRadiusField,
  cartBackgroundColorField,
  cartPanelColorField,
  cartCardColorField,
  cartTextColorField,
  cartMutedTextColorField,
  cartBorderColorField,
  cartAccentColorField,
];

const checkoutStyleFields = [
  styleBackgroundColorField,
  stylePanelColorField,
  styleInputColorField,
  styleTextColorField,
  styleMutedTextColorField,
  styleSoftTextColorField,
  stylePlaceholderColorField,
  styleBorderColorField,
  styleSoftBorderColorField,
  styleBorderRadiusField,
  styleItemRadiusField,
  styleFieldRadiusField,
  stylePaddingField,
  styleGapField,
  styleMaxWidthField,
];

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

  cart_sidebar: {
    displayName: "Cart",
    fields: cartFields,
  },
  cartsidebar: {
    displayName: "Cart",
    fields: cartFields,
  },
  cart_items: {
    displayName: "Cart",
    fields: cartFields,
  },
  cartitems: {
    displayName: "Cart",
    fields: cartFields,
  },

  delivery_form: {
    displayName: "Delivery Form",
    fields: [
      deliverySectionLabelField,
      deliveryTitleField,
      deliveryCompactField,
      deliveryAccentColorField,
      ...checkoutStyleFields,
    ],
  },
  deliveryform: {
    displayName: "Delivery Form",
    fields: [
      deliverySectionLabelField,
      deliveryTitleField,
      deliveryCompactField,
      deliveryAccentColorField,
      ...checkoutStyleFields,
    ],
  },

  payment_methods: {
    displayName: "Payment Methods",
    fields: [
      paymentSectionLabelField,
      paymentTitleField,
      paymentMethodsField,
      paymentCompactField,
      paymentAccentColorField,
      ...checkoutStyleFields,
    ],
  },
  paymentmethods: {
    displayName: "Payment Methods",
    fields: [
      paymentSectionLabelField,
      paymentTitleField,
      paymentMethodsField,
      paymentCompactField,
      paymentAccentColorField,
      ...checkoutStyleFields,
    ],
  },

  place_order_cta: {
    displayName: "Place Order Button",
    fields: [
      placeOrderLabelField,
      placeOrderCompactField,
      placeOrderAccentColorField,
      styleTextColorField,
      styleBorderRadiusField,
      stylePaddingField,
      styleMaxWidthField,
    ],
  },
  placeordercta: {
    displayName: "Place Order Button",
    fields: [
      placeOrderLabelField,
      placeOrderCompactField,
      placeOrderAccentColorField,
      styleTextColorField,
      styleBorderRadiusField,
      stylePaddingField,
      styleMaxWidthField,
    ],
  },
};