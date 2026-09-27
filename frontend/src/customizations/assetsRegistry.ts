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
    title: "Minimal Pill",
    description: "Floating pill design with clean rounded search and quick action icons.",
    tag: "Floating Pill",
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
    title: "Glassmorphic",
    description: "Frosted translucent glass with backdrop blur and modern lighting.",
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
    title: "Marketplace",
    description: "High-conversion commerce header with prominent search and category links.",
    tag: "Commerce",
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
    title: "Luxury Serif",
    description: "Editorial serif typography, refined dividers, and boutique minimalism.",
    tag: "Boutique",
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
    title: "Neo Modern",
    description: "Tactile soft neumorphic curves and layered 2026 controls.",
    tag: "Neumorphic",
    targetType: "navbar",
    patch: {
      themePatch: {
        navbar_layout: "neo_modern",
      },
    },
  },

  // Hero Banner Asset Variants
  {
    id: "hero-standard",
    category: "banner",
    title: "Classic Brand Banner",
    description: "Bold headline, subtitle, trending tag, and dual call-to-action buttons.",
    tag: "Standard",
    targetType: "hero_banner",
    patch: {
      blockPatch: {
        variant: "standard",
        headline: "Elevate Your Lifestyle With Premium Essentials",
        subheadline: "Curated collections with exceptional craftsmanship, designed for modern everyday living.",
        badge: "TRENDING NOW",
        primary_cta: { label: "Shop Best Sellers", href: "/products" },
        secondary_cta: { label: "Explore Collections", href: "/categories" },
      },
    },
  },
  {
    id: "hero-flash-sale",
    category: "banner",
    title: "Flash Sale Banner",
    description: "Urgent deal showcase with countdown timer, coupon code, and sale CTAs.",
    tag: "Countdown Sale",
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
    description: "Spotlight flagship products with live price tag and star rating card.",
    tag: "Product Spotlight",
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
    title: "Minimal Trust Banner",
    description: "Minimalist brand statement paired with trust badges and guarantees.",
    tag: "Trust Badges",
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
    title: "Fashion & Apparel",
    description: "Large editorial image focus with clean brand and pricing labels.",
    tag: "Editorial",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "fashion",
      },
      blockPatch: {
        card_style: "fashion",
      },
    },
  },
  {
    id: "product-electronics",
    category: "products",
    title: "Electronics & Tech",
    description: "Structured card with spec emphasis and stock availability pill.",
    tag: "Tech Specs",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "electronics",
      },
      blockPatch: {
        card_style: "electronics",
      },
    },
  },
  {
    id: "product-beauty-cosmetics",
    category: "products",
    title: "Beauty & Skincare",
    description: "Soft pastel spacing with centered product focus and rating.",
    tag: "Pastel Clean",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "beauty",
      },
      blockPatch: {
        card_style: "beauty",
      },
    },
  },
  {
    id: "product-grocery",
    category: "products",
    title: "Grocery & Daily Needs",
    description: "Horizontal quick-scan layout designed for fast shopping carts.",
    tag: "Quick Scan",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "grocery",
      },
      blockPatch: {
        card_style: "grocery",
      },
    },
  },
  {
    id: "product-books-stationery",
    category: "products",
    title: "Books & Stationery",
    description: "Portrait book-cover aspect ratio with author and review details.",
    tag: "Book Cover",
    targetType: "product_grid",
    patch: {
      themePatch: {
        card_style: "books",
      },
      blockPatch: {
        card_style: "books",
      },
    },
  },

  // Footer Layout Assets
  {
    id: "footer-apple-minimal",
    category: "footer",
    title: "Minimal Pill Footer",
    description: "Clean link columns with subtle legal lines and copyright.",
    tag: "Floating Pill",
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
    title: "Glassmorphic Footer",
    description: "Translucent frosted bottom bar with backdrop blur and newsletter field.",
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
    title: "Marketplace Footer",
    description: "Comprehensive multi-column footer with payment badges and help links.",
    tag: "Commerce",
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
    title: "Luxury Serif Footer",
    description: "Boutique centered serif typography and minimalist brand crest.",
    tag: "Boutique",
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
    title: "Neo Modern Footer",
    description: "Soft tactile neumorphic footer with rounded subscription bar.",
    tag: "Neumorphic",
    targetType: "footer",
    patch: {
      themePatch: {
        footer_layout: "neo_modern",
      },
    },
  },
];
