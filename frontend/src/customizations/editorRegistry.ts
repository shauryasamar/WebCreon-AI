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

const navbarLogoUrlField = {
  key: "logoUrl",
  label: "Brand Logo",
  type: "image_upload" as const,
  target: "props" as const,
  helpText: "Upload a PNG or SVG. For best results use a logo with a transparent background.",
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

const navbarLogoHeightField = {
  key: "logo_height",
  label: "Logo Height",
  type: "select" as const,
  target: "theme" as const,
  options: [
    { label: "Compact (28px)", value: "28" },
    { label: "Standard (36px)", value: "36" },
    { label: "Large (44px)", value: "44" },
    { label: "Extra Large (52px)", value: "52" },
  ],
};

const navbarLogoFitField = {
  key: "logo_fit",
  label: "Logo Image Fit",
  type: "select" as const,
  target: "theme" as const,
  options: [
    { label: "Contain (Fit Inside)", value: "contain" },
    { label: "Cover (Fill)", value: "cover" },
  ],
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



const productDetailAddToCartLabelField = {
  key: "add_to_cart_label",
  label: "Add to Cart button text",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Add to Bag",
};

const productDetailButtonBgColorField = {
  key: "button_bg_color",
  label: "Primary button background",
  type: "color" as const,
  target: "props" as const,
};

const productDetailButtonTextColorField = {
  key: "button_text_color",
  label: "Primary button text color",
  type: "color" as const,
  target: "props" as const,
};

const productDetailShowDeliveryInfoField = {
  key: "show_delivery_info",
  label: "Show Delivery Info Badge",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailDeliveryTextField = {
  key: "delivery_text",
  label: "Delivery badge text",
  type: "text" as const,
  target: "props" as const,
  placeholder: "Free Express Delivery on orders over ₹499",
};

const productDetailShowReturnPolicyField = {
  key: "show_return_policy",
  label: "Show Return Policy Badge",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailReturnPolicyTextField = {
  key: "return_policy_text",
  label: "Return policy badge text",
  type: "text" as const,
  target: "props" as const,
  placeholder: "7-Day Easy Returns & Exchange",
};

const productDetailShowQualityGuaranteeField = {
  key: "show_quality_guarantee",
  label: "Show Quality Guarantee Badge",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailQualityTextField = {
  key: "quality_text",
  label: "Quality guarantee text",
  type: "text" as const,
  target: "props" as const,
  placeholder: "100% Authentic & Quality Assured",
};

const productDetailShowDiscountBadgeField = {
  key: "show_discount_badge",
  label: "Show Discount Badge (% OFF)",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailShowStockBadgeField = {
  key: "show_stock_badge",
  label: "Show Stock Status Badge",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailShowRatingsField = {
  key: "show_ratings",
  label: "Show Customer Ratings",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailShowOriginalPriceField = {
  key: "show_original_price",
  label: "Show Original / Compare Price",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailShowBrandNameField = {
  key: "show_brand_name",
  label: "Show Brand / Category Tag",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailShowReviewsSectionField = {
  key: "show_reviews_section",
  label: "Show Reviews Section",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailShowDetailedSectionField = {
  key: "show_detailed_section",
  label: "Show Product Description Block",
  type: "checkbox" as const,
  target: "props" as const,
};

const productDetailMaxWidthField = {
  key: "max_width",
  label: "Max Container Width (px)",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Default (1160px)", value: "1160" },
    { label: "Compact (1000px)", value: "1000" },
    { label: "Wide (1280px)", value: "1280" },
    { label: "Full Width (100%)", value: "full" },
  ],
};

const productDetailImageAspectRatioField = {
  key: "image_aspect_ratio",
  label: "Product Image Aspect Ratio",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Square (1 : 1)", value: "1 / 1" },
    { label: "Portrait (4 : 5)", value: "4 / 5" },
    { label: "Tall (2 : 3)", value: "2 / 3" },
    { label: "Landscape (4 : 3)", value: "4 / 3" },
  ],
};

const productDetailImageFitField = {
  key: "image_fit",
  label: "Product Image Fit Mode",
  type: "select" as const,
  target: "props" as const,
  options: [
    { label: "Cover (Fill Frame)", value: "cover" },
    { label: "Contain (Fit Inside)", value: "contain" },
  ],
};

const productDetailFields = [
  productDetailAddToCartLabelField,
  productDetailButtonBgColorField,
  productDetailButtonTextColorField,
  productDetailShowDeliveryInfoField,
  productDetailDeliveryTextField,
  productDetailShowReturnPolicyField,
  productDetailReturnPolicyTextField,
  productDetailShowQualityGuaranteeField,
  productDetailQualityTextField,
  productDetailShowDiscountBadgeField,
  productDetailShowStockBadgeField,
  productDetailShowRatingsField,
  productDetailShowOriginalPriceField,
  productDetailShowBrandNameField,
  productDetailShowDetailedSectionField,
  productDetailShowReviewsSectionField,
  productDetailMaxWidthField,
  productDetailImageAspectRatioField,
  productDetailImageFitField,
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
      navbarLogoUrlField,
      navbarLogoHeightField,
      navbarLogoFitField,
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