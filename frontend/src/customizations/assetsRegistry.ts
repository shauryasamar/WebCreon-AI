export type ComponentAssetCategory =
  | "all"
  | "navbar"
  | "banner"
  | "products"
  | "footer"
  | "saved_themes";

export type ComponentAsset = {
  id: string;
  category: ComponentAssetCategory;
  title: string;
  description: string;
  tag: string;
  targetType: "navbar" | "hero_banner" | "product_grid" | "footer";
  patch: {
    themePatch?: Record<string, any>;
    blockPatch?: Record<string, any>;
  };
};

export const COMPONENT_ASSETS: ComponentAsset[] = [
  // Navbar Layout Orientations
  {
    id: "navbar-apple-minimal",
    category: "navbar",
    title: "Apple / Vercel Minimal",
    description: "Ultra minimal with clean spacing, pill search, and soft floating depth.",
    tag: "Minimal Pill",
    targetType: "navbar",
    patch: {
      themePatch: {
        navbar_layout: "apple_minimal",
      },
    },
  },
  {
    id: "navbar-glassmorphism",
    category: "navbar",
    title: "Glassmorphism Premium",
    description: "Frosted glass effect with blur, transparency, and elegant glass depth.",
    tag: "Frosted Glass",
    targetType: "navbar",
    patch: {
      themePatch: {
        navbar_layout: "glassmorphism_premium",
      },
    },
  },
  {
    id: "navbar-modern-marketplace",
    category: "navbar",
    title: "Modern Marketplace (Amazon/Shopify)",
    description: "Clean, compact layout inspired by top marketplaces with solid dark search button.",
    tag: "Marketplace",
    targetType: "navbar",
    patch: {
      themePatch: {
        navbar_layout: "modern_marketplace",
      },
    },
  },
  {
    id: "navbar-luxury-fashion",
    category: "navbar",
    title: "Luxury Fashion Store",
    description: "Elegant, spacious serif typography, vertical dividers, and minimal layout.",
    tag: "Luxury Serif",
    targetType: "navbar",
    patch: {
      themePatch: {
        navbar_layout: "luxury_fashion",
      },
    },
  },
  {
    id: "navbar-neo-modern",
    category: "navbar",
    title: "Neo Modern 2026 SaaS",
    description: "Soft Neumorphic UI with layered depth, pill search, and rounded controls.",
    tag: "Neumorphic 2026",
    targetType: "navbar",
    patch: {
      themePatch: {
        navbar_layout: "neo_modern",
      },
    },
  },

  // Hero Banner Asset Variants
  {
    id: "hero-flash-sale",
    category: "banner",
    title: "Flash Sale Banner",
    description: "High conversion banner with countdown timer, coupon code pill, and dual action buttons.",
    tag: "Flash Sale",
    targetType: "hero_banner",
    patch: {
      blockPatch: {
        variant: "flash_sale",
        headline: "FESTIVE FLASH SALE - UP TO 50% OFF",
        subheadline: "Huge discounts on top-trending categories. Limited stock available!",
        badge: "FLASH SALE",
        coupon_code: "SAVE50",
        primary_cta: { label: "Shop Sale Now", href: "/sale" },
        secondary_cta: { label: "Browse Catalog", href: "/products" },
      },
    },
  },
  {
    id: "hero-product-launch",
    category: "banner",
    title: "Product Launch Banner",
    description: "Highlight flagship releases with a floating product showcase card and rating badge.",
    tag: "Product Launch",
    targetType: "hero_banner",
    patch: {
      blockPatch: {
        variant: "product_launch",
        headline: "Introducing The Future Of Sound",
        subheadline: "Immersive 3D audio, active noise cancellation, and 40-hour battery life.",
        badge: "NEW LAUNCH",
        product_card: {
          title: "Wireless Headphones Max",
          price: "$249",
          original_price: "$349",
          rating: "4.9 ⭐",
        },
        primary_cta: { label: "Pre-Order Now", href: "/product/headphones" },
      },
    },
  },
  {
    id: "hero-minimal-brand",
    category: "banner",
    title: "Minimal Brand Hero",
    description: "Clean aesthetic with trust badges row for free shipping, money-back guarantee, and support.",
    tag: "Minimal Brand",
    targetType: "hero_banner",
    patch: {
      blockPatch: {
        variant: "minimal_brand",
        headline: "Crafted For Comfort & Everyday Elegance",
        subheadline: "Discover sustainable, high-performance essentials designed for modern living.",
        badge: "NEW COLLECTION",
        trust_badges: ["Free Worldwide Shipping", "30-Day Money Back", "24/7 VIP Support"],
        primary_cta: { label: "Explore Collection", href: "/categories" },
        secondary_cta: { label: "Our Story", href: "/about" },
      },
    },
  },

  // Product Grid Industry Assets
  {
    id: "product-fashion-apparel",
    category: "products",
    title: "Fashion / Apparel Card",
    description: "Large image focus with minimal details for a premium fashion feel.",
    tag: "Fashion",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "fashion",
      },
      blockPatch: {
        title: "Fashion & Apparel Collection",
      },
    },
  },
  {
    id: "product-electronics",
    category: "products",
    title: "Electronics Card",
    description: "Structured layout with image on top and information & price box emphasis.",
    tag: "Electronics",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "electronics",
      },
      blockPatch: {
        title: "Electronics & Tech",
      },
    },
  },
  {
    id: "product-beauty-cosmetics",
    category: "products",
    title: "Beauty & Cosmetics Card",
    description: "Centered composition with soft blush pastel spacing for beauty products.",
    tag: "Beauty",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "beauty",
      },
      blockPatch: {
        title: "Beauty & Skincare Essentials",
      },
    },
  },
  {
    id: "product-grocery",
    category: "products",
    title: "Grocery Card",
    description: "Horizontal layout for quick scanning and compact grocery browsing.",
    tag: "Grocery",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "grocery",
      },
      blockPatch: {
        title: "Fresh Grocery & Daily Needs",
      },
    },
  },
  {
    id: "product-books-stationery",
    category: "products",
    title: "Books & Stationery Card",
    description: "Image-first portrait approach perfect for book covers and stationery items.",
    tag: "Books",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "books",
      },
      blockPatch: {
        title: "Bestselling Books & Stationery",
      },
    },
  },

  // Footer Layout Assets (5 Themes)
  {
    id: "footer-apple-minimal",
    category: "footer",
    title: "Apple / Vercel Minimal Footer",
    description: "Clean multi-column link layout with subtle copyright, theme toggle, and legal links.",
    tag: "Minimal Pill",
    targetType: "footer",
    patch: {
      themePatch: {
        footer_layout: "apple_minimal",
      },
    },
  },
  {
    id: "footer-glassmorphism",
    category: "footer",
    title: "Glassmorphism Premium Footer",
    description: "Frosted glass bottom bar with backdrop blur, glass newsletter input, and social links.",
    tag: "Frosted Glass",
    targetType: "footer",
    patch: {
      themePatch: {
        footer_layout: "glassmorphism_premium",
      },
    },
  },
  {
    id: "footer-modern-marketplace",
    category: "footer",
    title: "Modern Marketplace Footer",
    description: "Comprehensive footer with newsletter subscription, payment icon badges, and help links.",
    tag: "Marketplace",
    targetType: "footer",
    patch: {
      themePatch: {
        footer_layout: "modern_marketplace",
      },
    },
  },
  {
    id: "footer-luxury-fashion",
    category: "footer",
    title: "Luxury Fashion Serif Footer",
    description: "Centered serif typography, elegant brand mark, and minimal social icons.",
    tag: "Luxury Serif",
    targetType: "footer",
    patch: {
      themePatch: {
        footer_layout: "luxury_fashion",
      },
    },
  },
  {
    id: "footer-neo-modern",
    category: "footer",
    title: "Neo Modern 2026 Footer",
    description: "Neumorphic soft depth footer with rounded pill subscription bar and sleek 2026 UI.",
    tag: "Neumorphic 2026",
    targetType: "footer",
    patch: {
      themePatch: {
        footer_layout: "neo_modern",
      },
    },
  },
];
