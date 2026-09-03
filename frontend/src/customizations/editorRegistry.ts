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
  label: "Brand Name",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Storefront",
};

const navbarLogoUrlField = {
  key: "logoUrl",
  label: "Brand Logo Image",
  type: "image_upload" as const,
  target: "props" as const,
  helpText: "Upload a PNG, SVG, or WEBP logo.",
};

const navbarBrandDisplayModeField = {
  key: "brand_display_mode",
  label: "Brand Display Mode",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "both",
  options: [
    { label: "Logo & Brand Name", value: "both" },
    { label: "Logo Only", value: "logo_only" },
    { label: "Brand Name Only", value: "name_only" },
  ],
  helpText: "Choose whether to display both logo and brand name, logo only, or brand name only.",
};

const navbarBrandAlignmentField = {
  key: "brand_alignment",
  label: "Brand Placement",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "left",
  options: [
    { label: "Left Aligned", value: "left" },
    { label: "Center Aligned", value: "center" },
  ],
  helpText: "Position the brand identity on the left or centered in the navbar.",
};

const navbarBrandLayoutDirectionField = {
  key: "brand_layout_direction",
  label: "Brand & Logo Layout",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "row",
  options: [
    { label: "Side by Side (Row)", value: "row" },
    { label: "Stacked (Column)", value: "column" },
  ],
  helpText: "Arrange the logo and brand name horizontally or vertically.",
};

const navbarBrandFontFamilyField = {
  key: "brand_font_family",
  label: "Brand Font Style",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "modern_sans",
  options: [
    { label: "Modern Clean (Inter)", value: "modern_sans" },
    { label: "Luxury Editorial Serif (Playfair)", value: "playfair_serif" },
    { label: "Royal Roman Display (Cinzel)", value: "cinzel_display" },
    { label: "Literary Fine Serif (Cormorant)", value: "cormorant_serif" },
    { label: "Contemporary Geometric (Outfit)", value: "outfit_geometric" },
    { label: "Neo-Grotesque Tech (Jakarta)", value: "jakarta_sans" },
    { label: "Modern Bold Sans (Montserrat)", value: "montserrat_bold" },
    { label: "Flowing Signature (Dancing Script)", value: "dancing_script" },
    { label: "Elegant Calligraphy (Great Vibes)", value: "great_vibes" },
    { label: "Vintage Editorial Display (Abril)", value: "abril_fatface" },
    { label: "Developer Monospace (Fira Code)", value: "monospace" },
  ],
  helpText: "Choose a curated typography family for the brand name.",
};

const navbarBrandFontWeightField = {
  key: "brand_font_weight",
  label: "Brand Font Weight",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "700",
  options: [
    { label: "Light (300)", value: "300" },
    { label: "Regular (400)", value: "400" },
    { label: "Medium (500)", value: "500" },
    { label: "Semi-Bold (600)", value: "600" },
    { label: "Bold (700)", value: "700" },
    { label: "Extra Bold (800)", value: "800" },
    { label: "Black / Heavy (900)", value: "900" },
  ],
  helpText: "Stroke thickness and weight for the brand name text.",
};

const navbarBrandFontStyleField = {
  key: "brand_font_style",
  label: "Brand Font Style (Italic)",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "normal",
  options: [
    { label: "Normal (Upright)", value: "normal" },
    { label: "Italic (Slanted)", value: "italic" },
  ],
  helpText: "Choose between upright or italicized slanted text.",
};

const navbarBrandFontSizeField = {
  key: "brand_font_size",
  label: "Brand Font Size (px)",
  type: "number" as const,
  target: "theme" as const,
  defaultValue: 16,
  min: 12,
  max: 36,
  step: 1,
  helpText: "Font size for the brand name text.",
};

const navbarBrandTextColorField = {
  key: "brand_text_color",
  label: "Brand Name Text Color",
  type: "color" as const,
  target: "theme" as const,
  helpText: "Custom text color specifically for the brand name.",
};

const navbarLogoSizeField = {
  key: "logo_size",
  label: "Logo Size (px)",
  type: "number" as const,
  target: "theme" as const,
  defaultValue: 36,
  min: 16,
  max: 120,
  step: 2,
  helpText: "Overall size of the brand logo in pixels (automatically fits inside navbar height).",
};

const navbarLogoFitField = {
  key: "logo_fit",
  label: "Logo Image Fit",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "contain",
  options: [
    { label: "Contain (Preserve Aspect)", value: "contain" },
    { label: "Cover (Fill Frame Box)", value: "cover" },
    { label: "Fill / Stretch (Exact Box)", value: "fill" },
    { label: "Scale Down (Compact Fit)", value: "scale-down" },
  ],
  helpText: "How the logo scales and fits within its boundary box.",
};

const navbarLogoZoomField = {
  key: "logo_zoom",
  label: "Logo Zoom / Scale (%)",
  type: "number" as const,
  target: "theme" as const,
  defaultValue: 100,
  min: 60,
  max: 300,
  step: 5,
  helpText: "Zoom into the logo image to make emblems and artwork larger and clearer in less space.",
};

const navbarSearchDisplayModeField = {
  key: "search_display_mode",
  label: "Search Display Style",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "bar",
  options: [
    { label: "Full Search Bar", value: "bar" },
    { label: "Icon Button Only", value: "icon" },
  ],
  helpText: "Choose between an always-visible search bar or a compact icon that expands when clicked.",
};

const navbarSearchPlacementField = {
  key: "search_placement",
  label: "Search Bar Placement",
  type: "select" as const,
  target: "theme" as const,
  defaultValue: "center",
  options: [
    { label: "Center (Balanced)", value: "center" },
    { label: "Left (Next to Brand)", value: "left" },
    { label: "Right (Next to Actions)", value: "right" },
  ],
  helpText: "Controls where the search bar sits across the navbar layout on desktop screens.",
};

const navbarSearchMaxWidthField = {
  key: "search_max_width",
  label: "Search Bar Width (px)",
  type: "number" as const,
  target: "theme" as const,
  defaultValue: 460,
  min: 160,
  max: 800,
  step: 10,
  helpText: "Maximum pixel width for the search input capsule.",
};

const navbarSearchHeightField = {
  key: "search_height",
  label: "Search Bar Height (px)",
  type: "number" as const,
  target: "theme" as const,
  defaultValue: 38,
  min: 28,
  max: 64,
  step: 2,
  helpText: "Height of the search bar capsule.",
};

const navbarSearchTextColorField = {
  key: "search_text_color",
  label: "Search Input Text Color",
  type: "color" as const,
  target: "theme" as const,
  helpText: "Color of the text typed into the search bar.",
};

const navbarSearchMutedTextColorField = {
  key: "search_muted_text_color",
  label: "Search Placeholder & Muted Color",
  type: "color" as const,
  target: "theme" as const,
  helpText: "Color of the placeholder hint and clear icon in the search bar.",
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

const navbarOuterBackgroundColorField = {
  key: "navbar_outer_bg",
  label: "Outer header background",
  type: "color" as const,
  target: "theme" as const,
};

const navbarBackgroundColorField = {
  key: "navbar_bg",
  label: "Navbar inner background",
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
  type: "select" as const,
  target: "theme" as const,
  options: [
    { label: "Standard (1280px)", value: "1280" },
    { label: "Wide (1440px)", value: "1440" },
    { label: "Full Width (100%)", value: "full" },
  ],
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
  defaultValue: "Your cart",
};

const cartEmptyTitleField = {
  key: "empty_title",
  label: "Empty state title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Your cart is empty",
  defaultValue: "Your cart is empty",
};

const cartEmptyMessageField = {
  key: "empty_message",
  label: "Empty state message",
  type: "textarea" as const,
  target: "props" as const,
  placeholder: "Add a few products to see them here.",
  defaultValue: "Add a few products to see them here.",
};

const cartShowPromoField = {
  key: "show_promo",
  label: "Show promo code",
  type: "checkbox" as const,
  target: "props" as const,
  defaultValue: true,
};

const cartShowSummaryField = {
  key: "show_summary",
  label: "Show summary",
  type: "checkbox" as const,
  target: "props" as const,
  defaultValue: true,
};

const cartPromoTitleField = {
  key: "promo_title",
  label: "Promo title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Promo code",
  defaultValue: "Promo code",
};

const cartPromoPlaceholderField = {
  key: "promo_placeholder",
  label: "Promo placeholder",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Enter code",
  defaultValue: "Enter code",
};

const cartPromoButtonLabelField = {
  key: "promo_button_label",
  label: "Promo button label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Apply",
  defaultValue: "Apply",
};

const cartSummaryTitleField = {
  key: "summary_title",
  label: "Summary title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Order summary",
  defaultValue: "Order summary",
};

const cartCheckoutLabelField = {
  key: "checkout_label",
  label: "Checkout button label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Proceed to checkout",
  defaultValue: "Proceed to checkout",
};

const cartSubtotalLabelField = {
  key: "subtotal_label",
  label: "Subtotal label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Subtotal",
  defaultValue: "Subtotal",
};

const cartShippingLabelField = {
  key: "shipping_label",
  label: "Shipping label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Shipping",
  defaultValue: "Shipping",
};

const cartTaxLabelField = {
  key: "tax_label",
  label: "Tax label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Estimated tax",
  defaultValue: "Estimated tax",
};

const cartTotalLabelField = {
  key: "total_label",
  label: "Total label",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Total",
  defaultValue: "Total",
};

const cartMaxWidthField = {
  key: "max_width",
  label: "Cart width",
  type: "number" as const,
  target: "props" as const,
  min: 960,
  max: 1280,
  step: 20,
  helpText: "Width of the cart container (960px - 1280px).",
};

const cartMinHeightField = {
  key: "min_height",
  label: "Cart height",
  type: "number" as const,
  target: "props" as const,
  min: 280,
  max: 650,
  step: 20,
  helpText: "Minimum height of the cart container (280px - 650px).",
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



const productGridGapField = {
  key: "grid_gap",
  label: "Grid Gap (px)",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Compact (12px)", value: "12" },
    { label: "Default (16px)", value: "16" },
    { label: "Spacious (24px)", value: "24" },
    { label: "Relaxed (32px)", value: "32" },
  ],
};

const productGridMaxWidthField = {
  key: "max_width",
  label: "Section Max Width",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Standard (1200px)", value: "1200" },
    { label: "Wide (1400px)", value: "1400" },
    { label: "Full Width (100%)", value: "full" },
  ],
};

const productGridOuterBgColorField = {
  key: "outer_bg_color",
  label: "Section Outer Background",
  type: "color" as const,
  target: "props" as const,
};

const productGridCardBgColorField = {
  key: "card_bg_color",
  label: "Card Background Color",
  type: "color" as const,
  target: "props" as const,
};

const productGridCardRadiusField = {
  key: "card_radius",
  label: "Card Corner Radius (px)",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Sharp (0px)", value: "0" },
    { label: "Slightly Rounded (8px)", value: "8" },
    { label: "Smooth (16px)", value: "16" },
    { label: "Curved (24px)", value: "24" },
    { label: "Ultra Curved (32px)", value: "32" },
  ],
};

const productGridCardBorderColorField = {
  key: "card_border_color",
  label: "Card Border Color",
  type: "color" as const,
  target: "props" as const,
};

const productGridCardShadowField = {
  key: "card_shadow",
  label: "Card Elevation / Shadow",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Flat (No Shadow)", value: "none" },
    { label: "Subtle Glow", value: "subtle" },
    { label: "Soft Floating", value: "soft" },
    { label: "Deep Elevated", value: "elevated" },
  ],
};

const productGridImageAspectRatioField = {
  key: "image_aspect_ratio",
  label: "Image Aspect Ratio",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Square (1 : 1)", value: "1/1" },
    { label: "Portrait (3 : 4)", value: "3/4" },
    { label: "Tall (2 : 3)", value: "2/3" },
    { label: "Wide (16 : 9)", value: "16/9" },
  ],
};

const productGridImageFitField = {
  key: "image_fit",
  label: "Image Fitting",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Cover (Fill Space)", value: "cover" },
    { label: "Contain (Fit Inside)", value: "contain" },
  ],
};

const productGridImageBgField = {
  key: "image_bg",
  label: "Image Container Background",
  type: "color" as const,
  target: "props" as const,
};

const productGridTitleColorField = {
  key: "title_color",
  label: "Product Title Color",
  type: "color" as const,
  target: "props" as const,
};

const productGridBrandColorField = {
  key: "brand_color",
  label: "Brand Label Color",
  type: "color" as const,
  target: "props" as const,
};

const productGridPriceColorField = {
  key: "price_color",
  label: "Sale Price Color",
  type: "color" as const,
  target: "props" as const,
};

const productGridOriginalPriceColorField = {
  key: "original_price_color",
  label: "Original Price Color",
  type: "color" as const,
  target: "props" as const,
};

const productGridRatingStarColorField = {
  key: "rating_star_color",
  label: "Rating Star Color",
  type: "color" as const,
  target: "props" as const,
};

const productGridShowDiscountBadgeField = {
  key: "show_discount_badge",
  label: "Show Discount Badge",
  type: "checkbox" as const,
  target: "props" as const,
};

const productGridShowStockBadgeField = {
  key: "show_stock_badge",
  label: "Show Stock Status Badge",
  type: "checkbox" as const,
  target: "props" as const,
};

const productGridShowRatingsField = {
  key: "show_ratings",
  label: "Show Ratings & Reviews",
  type: "checkbox" as const,
  target: "props" as const,
};

const productGridShowOriginalPriceField = {
  key: "show_original_price",
  label: "Show Strikethrough Original Price",
  type: "checkbox" as const,
  target: "props" as const,
};

const productGridShowBrandNameField = {
  key: "show_brand_name",
  label: "Show Brand Label",
  type: "checkbox" as const,
  target: "props" as const,
};

// --- Section Group Carousel / Category Story Carousel Fields ---
const sectionGroupTitleField = {
  key: "title",
  label: "Section Title",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Shop By Category",
};

const sectionGroupSubtitleField = {
  key: "subtitle",
  label: "Section Subtitle",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Explore curated collections and popular categories",
};

const sectionGroupTitleAlignmentField = {
  key: "title_alignment",
  label: "Title Alignment",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Left Aligned", value: "left" },
    { label: "Centered", value: "center" },
  ],
};

const sectionGroupCardShapeField = {
  key: "cardShape",
  label: "Card Shape & Style",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Portrait (Tall Card)", value: "portrait" },
    { label: "Square (1:1 Ratio)", value: "square" },
    { label: "Horizontal (Wide Card)", value: "horizontal" },
    { label: "Circle (Story Avatar)", value: "circle" },
    { label: "Pill (Compact)", value: "pill" },
  ],
};

const sectionGroupCardWidthField = {
  key: "card_width",
  label: "Card Width (px)",
  type: "number" as const,
  target: "props" as const,
  min: 70,
  max: 480,
  step: 5,
};

const sectionGroupCardHeightField = {
  key: "card_height",
  label: "Card Height (px)",
  type: "number" as const,
  target: "props" as const,
  min: 60,
  max: 480,
  step: 5,
};

const sectionGroupImageFitField = {
  key: "image_fit",
  label: "Image Fit",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Cover (Fill Space)", value: "cover" },
    { label: "Contain (Fit Inside)", value: "contain" },
  ],
};

const sectionGroupLayoutField = {
  key: "layout",
  label: "Display Layout",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Horizontal Carousel (Snap Scroll)", value: "carousel" },
    { label: "Responsive Grid (Multi-Column)", value: "grid" },
  ],
};

const sectionGroupOuterBgField = {
  key: "outer_bg_color",
  label: "Section Outer Background",
  type: "color" as const,
  target: "props" as const,
};

const sectionGroupCardBgField = {
  key: "card_bg_color",
  label: "Card Background Color",
  type: "color" as const,
  target: "props" as const,
};

const sectionGroupCardRadiusField = {
  key: "card_radius",
  label: "Card Corner Radius",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Sharp (0px)", value: "0" },
    { label: "Slightly Rounded (8px)", value: "8" },
    { label: "Smooth (14px)", value: "14" },
    { label: "Curved (20px)", value: "20" },
    { label: "Ultra Curved (30px)", value: "30" },
  ],
};

const sectionGroupCardBorderColorField = {
  key: "card_border_color",
  label: "Card Border Color",
  type: "color" as const,
  target: "props" as const,
};

const sectionGroupCardShadowField = {
  key: "card_shadow",
  label: "Card Elevation / Shadow",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Flat (No Shadow)", value: "none" },
    { label: "Subtle Glow", value: "subtle" },
    { label: "Soft Floating", value: "soft" },
    { label: "Deep Elevated", value: "elevated" },
  ],
};

const sectionGroupTitleColorField = {
  key: "title_color",
  label: "Header Title Color",
  type: "color" as const,
  target: "props" as const,
};

const sectionGroupSubtitleColorField = {
  key: "subtitle_color",
  label: "Header Subtitle Color",
  type: "color" as const,
  target: "props" as const,
};

const sectionGroupAccentColorField = {
  key: "accent_color",
  label: "Accent & Link Color",
  type: "color" as const,
  target: "props" as const,
};

const sectionGroupShowTitleField = {
  key: "show_title",
  label: "Show Title",
  type: "checkbox" as const,
  target: "props" as const,
};

const sectionGroupShowSubtitleField = {
  key: "show_subtitle",
  label: "Show Subtitle",
  type: "checkbox" as const,
  target: "props" as const,
};

const sectionGroupMaxWidthField = {
  key: "max_width",
  label: "Section Max Width",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Standard (1200px)", value: "1200px" },
    { label: "Wide (1280px)", value: "1280px" },
    { label: "Extra Wide (1440px)", value: "1440px" },
    { label: "Full Width (100%)", value: "full" },
  ],
};

const sectionGroupPaddingYField = {
  key: "padding_y",
  label: "Vertical Padding",
  type: "text" as const,
  target: "props" as const,
  placeholder: "24px",
};

const sectionGroupPaddingXField = {
  key: "padding_x",
  label: "Horizontal Padding",
  type: "text" as const,
  target: "props" as const,
  placeholder: "16px",
};

const sectionGroupFields = [
  sectionGroupTitleField,
  sectionGroupSubtitleField,
  sectionGroupTitleAlignmentField,
  sectionGroupCardShapeField,
  sectionGroupCardWidthField,
  sectionGroupCardHeightField,
  sectionGroupImageFitField,
  sectionGroupLayoutField,
  sectionGroupMaxWidthField,
  sectionGroupPaddingYField,
  sectionGroupPaddingXField,
  sectionGroupOuterBgField,
  sectionGroupCardBgField,
  sectionGroupCardRadiusField,
  sectionGroupCardBorderColorField,
  sectionGroupCardShadowField,
  sectionGroupTitleColorField,
  sectionGroupSubtitleColorField,
  sectionGroupAccentColorField,
  sectionGroupShowTitleField,
  sectionGroupShowSubtitleField,
];

const productDetailFields = [
  {
    key: "image_aspect_ratio",
    label: "Image Aspect Ratio",
    type: "select" as const,
    target: "props" as const,
    options: [
      { label: "Square (1:1)", value: "1 / 1" },
      { label: "Portrait (3:4)", value: "3 / 4" },
      { label: "Tall (4:5)", value: "4 / 5" },
      { label: "Wide (16:9)", value: "16 / 9" },
    ],
  },
  {
    key: "image_fit",
    label: "Image Fit",
    type: "select" as const,
    target: "props" as const,
    options: [
      { label: "Cover (Fill area)", value: "cover" },
      { label: "Contain (Show full image)", value: "contain" },
    ],
  },
  {
    key: "image_border_radius",
    label: "Image Corner Radius",
    type: "number" as const,
    target: "props" as const,
  },
  {
    key: "title_font_size",
    label: "Title Font Size (px)",
    type: "number" as const,
    target: "props" as const,
  },
  {
    key: "description_font_size",
    label: "Description Font Size (px)",
    type: "number" as const,
    target: "props" as const,
  },
  {
    key: "color_variant_layout",
    label: "Color Variant Display",
    type: "select" as const,
    target: "props" as const,
    options: [
      { label: "Carousel (Horizontal strip)", value: "carousel" },
      { label: "Grid (Wrap rows)", value: "grid" },
    ],
  },
  {
    key: "add_to_cart_label",
    label: "Add to Cart Button Text",
    type: "text" as const,
    target: "props" as const,
    placeholder: "Add to cart",
  },
  {
    key: "show_brand_name",
    label: "Show Brand & Category",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "show_ratings",
    label: "Show Customer Ratings",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "show_discount_badge",
    label: "Show Discount Badge",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "show_stock_badge",
    label: "Show Stock Status",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "show_original_price",
    label: "Show Original Strikethrough Price",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "show_description_accordion",
    label: "Show Description Accordion",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "show_specs_accordion",
    label: "Show Specifications Accordion",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "show_reviews_section",
    label: "Show Customer Reviews Section",
    type: "checkbox" as const,
    target: "props" as const,
  },
  {
    key: "panel_color",
    label: "Card Background Color",
    type: "color" as const,
    target: "props" as const,
  },
  {
    key: "text_color",
    label: "Text Color",
    type: "color" as const,
    target: "props" as const,
  },
  {
    key: "button_bg_color",
    label: "Button Background Color",
    type: "color" as const,
    target: "props" as const,
  },
  {
    key: "button_text_color",
    label: "Button Text Color",
    type: "color" as const,
    target: "props" as const,
  },
  {
    key: "card_border_radius",
    label: "Card Border Radius (px)",
    type: "number" as const,
    target: "props" as const,
  },
  {
    key: "button_border_radius",
    label: "Button Border Radius (px)",
    type: "number" as const,
    target: "props" as const,
  },
  {
    key: "badge_border_radius",
    label: "Badge Border Radius (px)",
    type: "number" as const,
    target: "props" as const,
  },
];

export const editorRegistry: EditorRegistry = {
  product_grid: {
    displayName: "Product Grid",
    fields: [
      productGridGapField,
      productGridMaxWidthField,
      productGridOuterBgColorField,
      productGridCardBgColorField,
      productGridCardRadiusField,
      productGridCardBorderColorField,
      productGridCardShadowField,
      productGridImageAspectRatioField,
      productGridImageFitField,
      productGridImageBgField,
      productGridTitleColorField,
      productGridBrandColorField,
      productGridPriceColorField,
      productGridOriginalPriceColorField,
      productGridRatingStarColorField,
      productGridShowDiscountBadgeField,
      productGridShowStockBadgeField,
      productGridShowRatingsField,
      productGridShowOriginalPriceField,
      productGridShowBrandNameField,
    ],
  },
  productgrid: {
    displayName: "Product Grid",
    fields: [
      productGridGapField,
      productGridMaxWidthField,
      productGridOuterBgColorField,
      productGridCardBgColorField,
      productGridCardRadiusField,
      productGridCardBorderColorField,
      productGridCardShadowField,
      productGridImageAspectRatioField,
      productGridImageFitField,
      productGridImageBgField,
      productGridTitleColorField,
      productGridBrandColorField,
      productGridPriceColorField,
      productGridOriginalPriceColorField,
      productGridRatingStarColorField,
      productGridShowDiscountBadgeField,
      productGridShowStockBadgeField,
      productGridShowRatingsField,
      productGridShowOriginalPriceField,
      productGridShowBrandNameField,
    ],
  },

  product_detail: {
    displayName: "Product Detail",
    fields: productDetailFields,
  },
  productdetail: {
    displayName: "Product Detail",
    fields: productDetailFields,
  },
  product_info: {
    displayName: "Product Detail",
    fields: productDetailFields,
  },
  productinfo: {
    displayName: "Product Detail",
    fields: productDetailFields,
  },
  product_gallery: {
    displayName: "Product Detail",
    fields: productDetailFields,
  },
  productgallery: {
    displayName: "Product Detail",
    fields: productDetailFields,
  },
  purchase_panel: {
    displayName: "Product Detail",
    fields: productDetailFields,
  },
  purchasepanel: {
    displayName: "Product Detail",
    fields: productDetailFields,
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

  section_group_carousel: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
  },
  sectiongroupcarousel: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
  },
  category_story_carousel: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
  },
  category_carousel: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
  },
  section_carousel: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
  },
  story_carousel: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
  },
  category_grid: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
  },
  categorygrid: {
    displayName: "Category & Story Carousel",
    fields: sectionGroupFields,
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
      navbarBrandDisplayModeField,
      navbarBrandAlignmentField,
      navbarBrandNameField,
      navbarLogoUrlField,
      navbarBrandLayoutDirectionField,
      navbarBrandFontFamilyField,
      navbarBrandFontWeightField,
      navbarBrandFontStyleField,
      navbarBrandFontSizeField,
      navbarBrandTextColorField,
      navbarLogoSizeField,
      navbarLogoFitField,
      navbarLogoZoomField,
      navbarSearchDisplayModeField,
      navbarSearchPlacementField,
      navbarSearchMaxWidthField,
      navbarSearchHeightField,
      navbarSearchTextColorField,
      navbarSearchMutedTextColorField,
      navbarVariantField,
      navbarPositionField,
      navbarHeightField,
      navbarMaxWidthField,
      navbarRadiusField,
      navbarPaddingXField,
      navbarPaddingYField,
      navbarOuterBackgroundColorField,
      navbarBackgroundColorField,
      navbarTextColorField,
      navbarBorderColorField,
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
  cart_view: {
    displayName: "Cart",
    fields: cartFields,
  },
  cartview: {
    displayName: "Cart",
    fields: cartFields,
  },
  cart: {
    displayName: "Cart",
    fields: cartFields,
  },

  delivery_form: {
    displayName: "Delivery Form",
    fields: [
      deliveryTitleField,
      deliveryCompactField,
      deliveryAccentColorField,
      ...checkoutStyleFields,
    ],
  },
  deliveryform: {
    displayName: "Delivery Form",
    fields: [
      deliveryTitleField,
      deliveryCompactField,
      deliveryAccentColorField,
      ...checkoutStyleFields,
    ],
  },

  payment_methods: {
    displayName: "Payment Methods",
    fields: [
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

  footer: {
    displayName: "Footer Settings",
    fields: [
      {
        key: "brandName",
        label: "Brand name",
        type: "text" as const,
        target: "props" as const,
        placeholder: "Storefront",
      },
      {
        key: "tagline",
        label: "Tagline text",
        type: "text" as const,
        target: "props" as const,
        placeholder: "Your premium shopping destination.",
      },
      {
        key: "copyrightText",
        label: "Copyright text",
        type: "text" as const,
        target: "props" as const,
        placeholder: "© 2026 Storefront. All rights reserved.",
      },
      {
        key: "footer_max_width",
        label: "Footer Max Width",
        type: "select" as const,
        target: "theme" as const,
        options: [
          { label: "Standard (1200px)", value: "1200" },
          { label: "Wide (1400px)", value: "1400" },
          { label: "Full Width (100%)", value: "full" },
        ],
      },
      {
        key: "footer_bg",
        label: "Footer Background Color",
        type: "color" as const,
        target: "theme" as const,
      },
      {
        key: "footer_text_color",
        label: "Footer Text Color",
        type: "color" as const,
        target: "theme" as const,
      },
      {
        key: "footer_muted_color",
        label: "Footer Secondary Text Color",
        type: "color" as const,
        target: "theme" as const,
      },
      {
        key: "footer_border_color",
        label: "Footer Border Color",
        type: "color" as const,
        target: "theme" as const,
      },
      {
        key: "show_newsletter",
        label: "Show Newsletter Signup",
        type: "checkbox" as const,
        target: "props" as const,
      },
      {
        key: "newsletter_title",
        label: "Newsletter Heading Text",
        type: "text" as const,
        target: "props" as const,
        placeholder: "Subscribe to Our Newsletter",
      },
      {
        key: "show_social_links",
        label: "Show Social Media Links",
        type: "checkbox" as const,
        target: "props" as const,
      },
      {
        key: "social_links",
        label: "Social Links JSON List",
        type: "json" as const,
        target: "props" as const,
        helpText: 'JSON array of social handles. Example: [{"platform": "Instagram", "url": "https://instagram.com"}]',
      },
      {
        key: "links",
        label: "Footer links",
        type: "json" as const,
        target: "props" as const,
        helpText: 'JSON list of links. Example: [{"label": "About", "href": "/about"}]',
      },
    ],
  },
};