import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCart, Product, ProductReview } from "../CartContext";
import { API_BASE_URL } from "../config/api";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { resolveThemeTokens } from "../context/ThemeContext";
import { optimizeImageUrl, getThumbnailUrl, compressImageFile } from "../utils/imageOptimizer";
import { normalizeStorefrontProduct } from "../utils/productNormalizer";

const MAX_CACHE_ENTRIES = 150;
const productDetailMemoryCache = new Map<string, Product>();
const siteSlugToIdCache = new Map<string, string>();

function getCachedProduct(target?: string | null): Product | null {
  if (!target) return null;
  const norm = String(target).trim().toLowerCase();
  if (!norm) return null;
  const item = productDetailMemoryCache.get(norm);
  if (item) {
    // Refresh LRU order (delete and re-insert at end)
    productDetailMemoryCache.delete(norm);
    productDetailMemoryCache.set(norm, item);
    return item;
  }
  return null;
}

function cacheStoreProduct(prod: Product | null | undefined) {
  if (!prod) return;
  // Evict oldest entries if max capacity reached
  while (productDetailMemoryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = productDetailMemoryCache.keys().next().value;
    if (!oldestKey) break;
    productDetailMemoryCache.delete(oldestKey);
  }

  if (prod.id != null) {
    productDetailMemoryCache.set(String(prod.id).trim().toLowerCase(), prod);
  }
  if (prod.slug) {
    productDetailMemoryCache.set(String(prod.slug).trim().toLowerCase(), prod);
  }
  if (prod.name) {
    const sName = String(prod.name).toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]+/g, "");
    if (sName) productDetailMemoryCache.set(sName, prod);
  }
}

type SiblingProduct = {
  id: string;
  name: string;
  sibling_label?: string | null;
  slug?: string | null;
  price: number;
  compare_price?: number | null;
  in_stock: boolean;
  cover_image?: string | null;
  is_current?: boolean;
};

type ProductDetailProps = {
  siteId?: string;
  product?: Product | null;
  selectedProduct?: Product | null;

  add_to_cart_label?: string;
  button_bg_color?: string;
  button_text_color?: string;
  background_color?: string;
  panel_color?: string;
  text_color?: string;

  show_delivery_info?: boolean;
  delivery_text?: string;
  show_return_policy?: boolean;
  return_policy_text?: string;
  show_quality_guarantee?: boolean;
  quality_text?: string;

  show_discount_badge?: boolean;
  show_stock_badge?: boolean;
  show_ratings?: boolean;
  show_original_price?: boolean;
  show_brand_name?: boolean;
  show_reviews_section?: boolean;
  show_detailed_section?: boolean;
  show_description_accordion?: boolean;
  show_specs_accordion?: boolean;
  show_gallery_accordion?: boolean;

  max_width?: string;
  image_aspect_ratio?: string;
  image_fit?: "cover" | "contain";

  theme?: {
    mode?: string;
    primary_bg?: string;
    secondary_bg?: string;
    card_bg?: string;
    text_color?: string;
    accent_color?: string;
    card_text_color?: string;
    card_shadow?: string;
    [key: string]: any;
  };
};

type VariantValue = {
  value: string;
  inStock?: boolean;
  stockQty?: number | null;
  price?: number | null;
  comparePrice?: number | null;
};

type VariantOption = {
  optionType?: string;
  optionName: string;
  optionValues?: VariantValue[];
};

type DeliveredOrderItem = {
  id: string;
  product_id: string | number;
  product_name?: string;
  product_slug?: string | null;
  product_image?: string | null;
  selected_variant_label?: string | null;
  selected_variant_value?: string | null;
  status?: string;
  is_returnable?: boolean;
};

type DeliveredOrder = {
  id: string | number;
  status?: string;
  items?: DeliveredOrderItem[];
};

function getEmbedVideoInfo(url?: string | null): { type: "youtube" | "vimeo" | "direct" | null; src: string | null } {
  if (!url || typeof url !== "string") return { type: null, src: null };
  const trimmed = url.trim();
  if (!trimmed) return { type: null, src: null };

  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return { type: "youtube", src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0` };
  }

  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return { type: "vimeo", src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };
  }

  return { type: "direct", src: trimmed };
}

function parseInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: "rgba(148,163,184,0.15)",
            padding: "2px 5px",
            borderRadius: "4px",
            fontSize: "0.9em",
            fontFamily: "monospace",
          }}
        >
          {match[4]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderHeroHighlights(highlights: any, textColor: string, mutedColor: string) {
  if (!highlights) return null;
  const rawText = Array.isArray(highlights) ? highlights.join("\n") : String(highlights);
  if (!rawText.trim()) return null;

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: "6px", margin: "6px 0 2px" }}>
      {lines.map((line, idx) => {
        const isBullet = /^[•\-\*▪►✔✓]/.test(line);
        const cleanLine = isBullet ? line.replace(/^[•\-\*▪►✔✓]\s*/, "") : line;

        if (isBullet) {
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "13.5px",
                color: mutedColor,
                lineHeight: 1.55,
              }}
            >
              <span style={{ color: "#16a34a", fontSize: "13px", fontWeight: 800, lineHeight: 1.3, flexShrink: 0 }}>✓</span>
              <div style={{ flex: 1 }}>{parseInlineMarkdown(cleanLine)}</div>
            </div>
          );
        }

        // Regular paragraph / sentence
        return (
          <p
            key={idx}
            style={{
              margin: 0,
              fontSize: "13.5px",
              color: mutedColor,
              lineHeight: 1.6,
            }}
          >
            {parseInlineMarkdown(cleanLine)}
          </p>
        );
      })}
    </div>
  );
}

function renderFormattedDescription(content: string, textColor: string) {
  if (!content || !content.trim()) {
    return (
      <p style={{ margin: 0, fontSize: "14px", color: textColor, opacity: 0.7 }}>
        No detailed description provided for this product.
      </p>
    );
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let currentTable: string[][] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      const items = [...currentList];
      currentList = [];
      elements.push(
        <ul
          key={`ul-${elements.length}`}
          style={{
            margin: "6px 0",
            paddingLeft: "20px",
            display: "grid",
            gap: "6px",
          }}
        >
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: "14px", lineHeight: 1.6 }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
    }
  };

  const flushTable = () => {
    if (currentTable.length > 0) {
      const rows = [...currentTable];
      currentTable = [];
      const headerRow = rows[0] || [];
      const bodyRows = rows.slice(1);

      elements.push(
        <div key={`tbl-${elements.length}`} style={{ overflowX: "auto", margin: "12px 0 16px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13.5px",
              textAlign: "left",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {headerRow.length > 0 && (
              <thead>
                <tr style={{ background: "rgba(148, 163, 184, 0.12)", borderBottom: "2px solid rgba(148, 163, 184, 0.25)" }}>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} style={{ padding: "10px 14px", fontWeight: 700, color: textColor }}>
                      {parseInlineMarkdown(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((r, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: rIdx < bodyRows.length - 1 ? "1px solid rgba(148, 163, 184, 0.15)" : "none",
                    background: rIdx % 2 === 1 ? "rgba(148, 163, 184, 0.04)" : "transparent",
                  }}
                >
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: "9px 14px", color: textColor }}>
                      {parseInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  };

  const flushAll = () => {
    flushList();
    flushTable();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Markdown Table Row: | Col 1 | Col 2 |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      // Skip separator delimiter row e.g. |---|---| or |:---|:---|
      if (/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(trimmed)) {
        continue;
      }
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      currentTable.push(cells);
      continue;
    }

    // Heading 3: ### Heading or ###Heading
    const h3Match = trimmed.match(/^###\s*(.*)$/);
    if (h3Match) {
      flushAll();
      elements.push(
        <h4
          key={`h3-${i}`}
          style={{
            margin: "14px 0 4px",
            fontSize: "15px",
            fontWeight: 700,
            color: textColor,
          }}
        >
          {parseInlineMarkdown(h3Match[1])}
        </h4>
      );
      continue;
    }

    // Heading 2: ## Heading or ##Heading
    const h2Match = trimmed.match(/^##\s*(.*)$/);
    if (h2Match) {
      flushAll();
      elements.push(
        <h3
          key={`h2-${i}`}
          style={{
            margin: "18px 0 6px",
            fontSize: "18px",
            fontWeight: 800,
            color: textColor,
          }}
        >
          {parseInlineMarkdown(h2Match[1])}
        </h3>
      );
      continue;
    }

    // Heading 1: # Heading or #Heading
    const h1Match = trimmed.match(/^#\s*(.*)$/);
    if (h1Match) {
      flushAll();
      elements.push(
        <h2
          key={`h1-${i}`}
          style={{
            margin: "22px 0 8px",
            fontSize: "21px",
            fontWeight: 900,
            color: textColor,
          }}
        >
          {parseInlineMarkdown(h1Match[1])}
        </h2>
      );
      continue;
    }

    // Bullet list items
    const bulletMatch = trimmed.match(/^[•\-\*▪►✔✓]\s*(.*)$/);
    if (bulletMatch) {
      flushTable();
      currentList.push(bulletMatch[1] || trimmed);
      continue;
    }

    // Regular paragraph
    flushAll();
    elements.push(
      <p
        key={`p-${i}`}
        style={{
          margin: "0 0 8px",
          fontSize: "14px",
          lineHeight: 1.75,
          color: textColor,
        }}
      >
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushAll();

  return (
    <div style={{ display: "grid", gap: "2px", color: textColor, lineHeight: 1.75 }}>
      {elements}
    </div>
  );
}

function isColorDarkHex(colorHex?: string): boolean {
  if (!colorHex || typeof colorHex !== "string") return false;
  if (colorHex.startsWith("rgb")) {
    const match = colorHex.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
    }
  }
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  return false;
}

const WhatsAppOfficialIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12c0 1.884.522 3.647 1.428 5.151L2.055 21.94a.6.6 0 0 0 .733.733l4.789-1.373A9.957 9.957 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 0 0-7.304 12.855.75.75 0 0 1 .094.498l-.942 3.243 3.243-.942a.75.75 0 0 1 .498.094A8.5 8.5 0 1 0 12 3.5zm4.87 11.232c-.267-.133-1.58-.78-1.825-.87-.245-.09-.423-.133-.6.134-.179.266-.69 1.022-.846 1.2-.156.177-.312.2-.579.066-.267-.133-1.127-.416-2.147-1.326-.793-.707-1.328-1.58-1.484-1.847-.156-.267-.017-.411.117-.544.12-.12.267-.31.401-.466.133-.156.178-.267.267-.445.089-.178.044-.333-.022-.467-.067-.133-.6-1.444-.822-1.978-.216-.52-.436-.45-.6-.458l-.512-.008c-.178 0-.467.066-.711.333-.245.267-.934.912-.934 2.223 0 1.311.956 2.578 1.09 2.756.133.178 1.88 2.87 4.555 4.025.637.275 1.134.44 1.522.563.64.203 1.222.175 1.682.106.513-.077 1.58-.646 1.802-1.269.222-.623.222-1.157.156-1.269-.067-.111-.245-.178-.512-.311z"
      fill="#25D366"
    />
  </svg>
);

const TelegramOfficialIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.07-.05-.17-.03-.24-.02-.11.02-1.79 1.14-5.06 3.35-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.86-.44-.75-.24-1.34-.37-1.29-.79.03-.22.33-.44.9-.68 3.55-1.54 5.92-2.56 7.11-3.07 3.38-1.42 4.09-1.66 4.54-1.67.1 0 .32.02.46.14.12.1.15.24.17.34.02.13.02.26 0 .38z"
      fill="#229ED9"
    />
  </svg>
);

const XTwitterOfficialIcon = ({ size = 17, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const EmailOfficialIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="3" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LinkChainIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const slugify = (text: string) =>
  (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const MAX_GALLERY_IMAGES = 5;

const ProductDetail: React.FC<ProductDetailProps> = ({
  siteId: propSiteId,
  product: propProduct,
  selectedProduct,
  add_to_cart_label,
  button_bg_color,
  button_text_color,
  background_color,
  panel_color,
  text_color,
  show_delivery_info = true,
  delivery_text,
  show_return_policy = true,
  return_policy_text,
  show_quality_guarantee = true,
  quality_text,
  show_discount_badge = true,
  show_stock_badge = true,
  show_ratings = true,
  show_original_price = true,
  show_brand_name = true,
  show_reviews_section = true,
  show_detailed_section = true,
  show_description_accordion = true,
  show_specs_accordion = true,
  show_gallery_accordion = true,
  max_width,
  image_aspect_ratio,
  image_fit,
  theme,
}) => {
  const { addToCart, products, cartItems, defaultReturnWindowDays = 7 } = useCart();
  const { isAuthenticated } = useCustomerAuth();
  const { productSlug, slug: siteSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [failedSlug, setFailedSlug] = useState<string | null>(null);
  const [isFetchingDirect, setIsFetchingDirect] = useState<boolean>(false);

  const normalizedTarget = useMemo(() => {
    return productSlug ? String(productSlug).trim().toLowerCase() : "";
  }, [productSlug]);

  const product = useMemo(() => {
    if (propProduct) {
      if (!normalizedTarget) return propProduct;
      if (
        String(propProduct.slug || "").trim().toLowerCase() === normalizedTarget ||
        String(propProduct.id || "").trim().toLowerCase() === normalizedTarget ||
        slugify(String(propProduct.name || "")) === normalizedTarget
      ) {
        cacheStoreProduct(propProduct);
        return propProduct;
      }
    }

    if (selectedProduct) {
      if (!normalizedTarget) return selectedProduct;
      if (
        String(selectedProduct.slug || "").trim().toLowerCase() === normalizedTarget ||
        String(selectedProduct.id || "").trim().toLowerCase() === normalizedTarget ||
        slugify(String(selectedProduct.name || "")) === normalizedTarget
      ) {
        cacheStoreProduct(selectedProduct);
        return selectedProduct;
      }
    }

    if (fetchedProduct) {
      if (!normalizedTarget) return fetchedProduct;
      if (
        String(fetchedProduct.slug || "").trim().toLowerCase() === normalizedTarget ||
        String(fetchedProduct.id || "").trim().toLowerCase() === normalizedTarget ||
        slugify(String(fetchedProduct.name || "")) === normalizedTarget
      ) {
        cacheStoreProduct(fetchedProduct);
        return fetchedProduct;
      }
    }

    if (!normalizedTarget) return null;

    if (Array.isArray(products)) {
      const bySlug = products.find(
        (p) => String(p.slug || "").trim().toLowerCase() === normalizedTarget
      );
      if (bySlug) {
        cacheStoreProduct(bySlug);
        return bySlug;
      }

      const byId = products.find(
        (p) => String(p.id || "").trim().toLowerCase() === normalizedTarget
      );
      if (byId) {
        cacheStoreProduct(byId);
        return byId;
      }

      const byNameSlug = products.find(
        (p) => slugify(String(p.name || "")) === normalizedTarget
      );
      if (byNameSlug) {
        cacheStoreProduct(byNameSlug);
        return byNameSlug;
      }
    }

    const cached = getCachedProduct(normalizedTarget);
    if (cached) return cached;

    return null;
  }, [propProduct, selectedProduct, fetchedProduct, normalizedTarget, products]);

  const isResolvingProduct = Boolean(
    normalizedTarget && !product && (isFetchingDirect || failedSlug !== normalizedTarget)
  );

  const anyProduct = (product ?? {}) as any;

  const siteId =
    propSiteId ||
    (anyProduct?.site_id != null
      ? String(anyProduct.site_id)
      : (selectedProduct as any)?.site_id != null
      ? String((selectedProduct as any).site_id)
      : "");

  const [screenSize, setScreenSize] = useState<{ isMobile: boolean; isTablet: boolean }>(() => {
    if (typeof window === "undefined") return { isMobile: false, isTablet: false };
    const w = window.innerWidth;
    return { isMobile: w < 768, isTablet: w >= 768 && w < 1024 };
  });
  const [reviews, setReviews] = useState<ProductReview[]>(
    Array.isArray(anyProduct?.reviews) ? (anyProduct.reviews as ProductReview[]) : []
  );
  const [averageRating, setAverageRating] = useState<number>(
    Number(anyProduct?.average_rating ?? 0)
  );
  const [reviewCount, setReviewCount] = useState<number>(
    Number(anyProduct?.review_count ?? 0)
  );
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewUploadError, setReviewUploadError] = useState<string>("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string>("");
  const [eligibleOrderItem, setEligibleOrderItem] = useState<DeliveredOrderItem | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const galleryScrollRef = React.useRef<HTMLDivElement>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [openDescription, setOpenDescription] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [fetchedSiblings, setFetchedSiblings] = useState<SiblingProduct[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(4);
  const [reviewPage, setReviewPage] = useState(1);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [reviewPreviewModalImage, setReviewPreviewModalImage] = useState<string | null>(null);
  const inlineBuyRef = React.useRef<HTMLDivElement>(null);
  const [showBottomSticky, setShowBottomSticky] = useState(true);

  useEffect(() => {
    if (!screenSize.isMobile) return;

    const checkSticky = () => {
      if (!inlineBuyRef.current) return;
      const rect = inlineBuyRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      // Show sticky when the real button position is below the bottom of the viewport
      setShowBottomSticky(rect.top > windowHeight - 50);
    };

    window.addEventListener("scroll", checkSticky, { passive: true });
    window.addEventListener("resize", checkSticky, { passive: true });
    checkSticky();

    return () => {
      window.removeEventListener("scroll", checkSticky);
      window.removeEventListener("resize", checkSticky);
    };
  }, [screenSize.isMobile, product?.id]);

  const getProductShareUrl = () => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  };

  const copyToClipboard = async (text: string) => {
    let success = false;
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (_) {}
    }
    if (!success && typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (_) {}
    }
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    }
    return success;
  };

  const handleNativeShare = async () => {
    const url = getProductShareUrl();
    const title = product?.name || "Product";
    const text = `Check out ${product?.name || "this product"}!`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as any)?.name === "AbortError") return;
      }
    }

    copyToClipboard(url);
  };

  const videoInfo = useMemo(
    () => getEmbedVideoInfo(anyProduct?.video_url),
    [anyProduct?.video_url]
  );

  const videoPos = useMemo(() => {
    const rawPos = anyProduct?.video_position;
    return typeof rawPos === "number" ? rawPos : 2;
  }, [anyProduct?.video_position]);

  const parsedVariantOption = useMemo(() => {
    if (!anyProduct?.variant_option) return null;
    if (typeof anyProduct.variant_option === "string") {
      try {
        return JSON.parse(anyProduct.variant_option);
      } catch (_) {
        return null;
      }
    }
    return anyProduct.variant_option;
  }, [anyProduct?.variant_option]);

  const resolvedSiblings: SiblingProduct[] = useMemo(() => {
    if (Array.isArray(fetchedSiblings) && fetchedSiblings.length > 1) {
      return fetchedSiblings;
    }
    if (Array.isArray(anyProduct?.siblings) && anyProduct.siblings.length > 1) {
      return anyProduct.siblings;
    }
    if (anyProduct?.sibling_group && Array.isArray(products)) {
      const groupKey = String(anyProduct.sibling_group).trim().toLowerCase();
      const matched = products.filter(
        (p) =>
          p.sibling_group &&
          String(p.sibling_group).trim().toLowerCase() === groupKey &&
          p.is_active !== false
      );
      if (matched.length > 1) {
        return matched.map((p) => ({
          id: String(p.id),
          name: p.name,
          sibling_label: p.sibling_label || p.name,
          slug: p.slug || String(p.id),
          price: Number(p.price),
          compare_price: p.compare_price != null ? Number(p.compare_price) : null,
          in_stock: p.in_stock !== false && (p.stock == null || p.stock > 0),
          cover_image: (p.images && p.images[0]) || p.image || p.image_url || null,
          is_current:
            String(p.id) === String(anyProduct.id) ||
            p.slug === anyProduct.slug ||
            p.slug === productSlug,
        }));
      }
    }
    return [];
  }, [fetchedSiblings, anyProduct?.siblings, anyProduct?.sibling_group, products, productSlug, anyProduct.id, anyProduct.slug]);

  useEffect(() => {
    if (Array.isArray(resolvedSiblings)) {
      let currentSiteId = siteId || propSiteId;
      if (!currentSiteId && typeof window !== "undefined") {
        const seg =
          window.location.pathname.split("/store/")[1]?.split("/")[0] ||
          window.location.pathname.split("/builder/")[1]?.split("/")[0];
        if (seg) {
          currentSiteId = siteSlugToIdCache.get(seg) || seg;
        }
      }

      for (const sib of resolvedSiblings) {
        if (sib.slug || sib.id) {
          const targetKey = sib.slug || sib.id;
          const existing = getCachedProduct(targetKey);
          if (!existing) {
            const placeholderProd = normalizeStorefrontProduct({
              id: sib.id,
              name: sib.name,
              slug: sib.slug || sib.id,
              price: sib.price,
              compare_price: sib.compare_price,
              in_stock: sib.in_stock,
              image: sib.cover_image,
              images: sib.cover_image ? [sib.cover_image] : [],
              sibling_label: sib.sibling_label,
              sibling_group: anyProduct?.sibling_group,
              category: anyProduct?.category,
              brand: anyProduct?.brand,
            });
            cacheStoreProduct(placeholderProd);
          }

          // Preload sibling cover image in browser memory
          if (typeof window !== "undefined" && sib.cover_image) {
            const img = new Image();
            img.src = optimizeImageUrl(sib.cover_image, 900, 900);
          }

          // In background, proactively pre-fetch full sibling product details so color switching is 0ms instant
          if (currentSiteId && (!existing || (existing.images && existing.images.length <= 1))) {
            const fetchSlug = sib.slug || sib.id;
            fetch(`${API_BASE_URL}/sites/${currentSiteId}/products/public/by-slug/${encodeURIComponent(fetchSlug)}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((raw) => {
                if (raw && (raw.id || raw.name)) {
                  const fullProd = normalizeStorefrontProduct(raw);
                  cacheStoreProduct(fullProd);
                  if (Array.isArray(fullProd.images)) {
                    fullProd.images.forEach((imgUrl: string) => {
                      if (imgUrl && typeof window !== "undefined") {
                        const i = new Image();
                        i.src = optimizeImageUrl(imgUrl, 900, 900);
                      }
                    });
                  }
                }
              })
              .catch(() => {});
          }
        }
      }
    }
  }, [resolvedSiblings, anyProduct?.sibling_group, anyProduct?.category, anyProduct?.brand, siteId, propSiteId]);

  useEffect(() => {
    setIsVideoActive(videoPos === 0 && Boolean(videoInfo.src));
    setSelectedImage(null);
    setSelectedOption("");
    setQuantity(1);
    setAdded(false);
    setOpenDescription(false);
    setReviewRating(0);
    setReviewText("");
    setReviewImages([]);
    setReviewUploadError("");
    setReviewMessage("");
  }, [productSlug, anyProduct?.id, videoInfo.src, videoPos]);

  const normalizedImages: string[] = useMemo(() => {
    const rawList = Array.isArray(anyProduct?.images)
      ? anyProduct.images.filter(
          (image: unknown): image is string =>
            typeof image === "string" && image.trim() !== ""
        )
      : [];

    const healed: string[] = [];
    for (const img of rawList) {
      if (
        healed.length > 0 &&
        !img.startsWith("http://") &&
        !img.startsWith("https://") &&
        !img.startsWith("/") &&
        !img.startsWith("data:")
      ) {
        healed[healed.length - 1] = `${healed[healed.length - 1]},${img}`;
      } else {
        healed.push(img);
      }
    }

    if (healed.length) {
      return healed
        .slice(0, MAX_GALLERY_IMAGES)
        .map((url) => optimizeImageUrl(url, 900, 900));
    }
    if (typeof anyProduct?.image === "string" && anyProduct.image.trim()) {
      return [optimizeImageUrl(anyProduct.image, 900, 900)];
    }
    return [];
  }, [anyProduct]);

  const activeDisplayImage = selectedImage || normalizedImages[0] || "";


  const mediaItems = useMemo(() => {
    type MediaItem = { type: "image"; src: string } | { type: "video" };
    const items: MediaItem[] = normalizedImages.map((src) => ({ type: "image", src }));
    if (videoInfo.src) {
      const insertIdx = Math.min(Math.max(0, videoPos), items.length);
      items.splice(insertIdx, 0, { type: "video" });
    }
    return items.slice(0, MAX_GALLERY_IMAGES + (videoInfo.src ? 1 : 0));
  }, [normalizedImages, videoInfo.src, videoPos]);

  const effectiveReturnPolicyText = useMemo(() => {
    const days =
      product?.return_window_days !== undefined && product?.return_window_days !== null
        ? product.return_window_days
        : defaultReturnWindowDays;

    if (days === 0) return "Non-Returnable (Final Sale)";
    if (days === 1) return "1 Day Easy Return";
    if (days && days > 1) {
      return `${days} Days Easy Return`;
    }
    return return_policy_text || `${defaultReturnWindowDays} Days Easy Return`;
  }, [product?.return_window_days, defaultReturnWindowDays, return_policy_text]);

  const productHighlights = useMemo(() => {
    if (Array.isArray(anyProduct?.highlights) && anyProduct.highlights.length > 0) {
      const valid = anyProduct.highlights.filter((h: string) => typeof h === "string" && h.trim() !== "");
      if (valid.length > 0) return valid;
    }
    if (!product?.description) return [];
    const lines = product.description
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    const bullets = lines
      .filter((l: string) => /^[•\-\*▪►✔✓]/.test(l) || (l.length < 80 && !l.startsWith("#")))
      .map((l: string) => l.replace(/^[•\-\*▪►✔✓]\s*/, "").trim())
      .filter(Boolean);

    return bullets.slice(0, 4);
  }, [anyProduct?.highlights, product?.description]);

  const badgeCollections = useMemo(() => {
    return (product?.collections || []).filter((c: any) => c && c.is_badge);
  }, [product?.collections]);

  const variantOption: VariantOption | null = parsedVariantOption
    ? {
        optionType: parsedVariantOption.optionType,
        optionName: parsedVariantOption.optionName || "Options",
        optionValues: Array.isArray(parsedVariantOption.optionValues)
          ? parsedVariantOption.optionValues
          : [],
      }
    : null;

  const optionValues: VariantValue[] = Array.isArray(variantOption?.optionValues)
    ? variantOption.optionValues
    : Array.isArray(anyProduct?.sizes)
    ? anyProduct.sizes.map((size: string) => ({ value: size, inStock: true }))
    : [];

  const optionLabel = variantOption?.optionName || "Options";
  const hasVariants = optionValues.length > 0;
  const firstAvailableVariant =
    optionValues.find((option) => option.inStock !== false)?.value ??
    optionValues[0]?.value ??
    "";

  useEffect(() => {
    if (!normalizedTarget || product) {
      setIsFetchingDirect(false);
      return;
    }

    if (failedSlug === normalizedTarget) {
      setIsFetchingDirect(false);
      return;
    }

    let isMounted = true;
    setIsFetchingDirect(true);

    const attemptDirectFetch = async () => {
      try {
        let currentSiteId = siteId || propSiteId;

        if (!currentSiteId && typeof window !== "undefined") {
          currentSiteId =
            window.location.pathname.split("/builder/")[1]?.split("/")[0] ||
            window.location.pathname.split("/store/")[1]?.split("/")[0] ||
            null;
        }

        // If currentSiteId is a slug (e.g. "underaura"), resolve the UUID with memory cache
        if (currentSiteId && (!currentSiteId.includes("-") || currentSiteId.length !== 36)) {
          if (siteSlugToIdCache.has(currentSiteId)) {
            currentSiteId = siteSlugToIdCache.get(currentSiteId)!;
          } else {
            try {
              const siteRes = await fetch(`${API_BASE_URL}/public/sites/slug/${currentSiteId}`);
              if (siteRes.ok) {
                const sData = await siteRes.json();
                if (sData?.id) {
                  siteSlugToIdCache.set(currentSiteId, sData.id);
                  currentSiteId = sData.id;
                }
              }
            } catch (_) {}
          }
        }

        if (currentSiteId) {
          // 1. Direct public by-slug endpoint
          const directRes = await fetch(
            `${API_BASE_URL}/sites/${currentSiteId}/products/public/by-slug/${encodeURIComponent(productSlug || "")}`
          );
          if (directRes.ok) {
            const rawMatch = await directRes.json();
            if (isMounted && rawMatch && (rawMatch.id || rawMatch.name)) {
              const match = normalizeStorefrontProduct(rawMatch);
              cacheStoreProduct(match);
              setFetchedProduct(match);
              setIsFetchingDirect(false);
              return;
            }
          }

          // 2. Fallback to public search
          const searchRes = await fetch(
            `${API_BASE_URL}/sites/${currentSiteId}/products/public?search=${encodeURIComponent(productSlug || "")}&page=1&page_size=24`
          );
          if (searchRes.ok) {
            const data = await searchRes.json();
            const items: any[] = Array.isArray(data) ? data : data.products || data.items || [];
            const rawMatch = items.find(
              (p: any) =>
                String(p.slug || "").trim().toLowerCase() === normalizedTarget ||
                String(p.id || "").trim().toLowerCase() === normalizedTarget ||
                slugify(String(p.name || "")) === normalizedTarget
            );
            if (isMounted && rawMatch) {
              const match = normalizeStorefrontProduct(rawMatch);
              cacheStoreProduct(match);
              setFetchedProduct(match);
              setIsFetchingDirect(false);
              return;
            }
          }
        }
      } catch (_) {}

      if (isMounted) {
        setFailedSlug(normalizedTarget);
        setIsFetchingDirect(false);
      }
    };

    attemptDirectFetch();

    return () => {
      isMounted = false;
    };
  }, [normalizedTarget, product, failedSlug, siteId, propSiteId, productSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timeoutId: any = null;
    const checkBreakpoints = () => {
      const w = window.innerWidth;
      const nextMobile = w < 768;
      const nextTablet = w >= 768 && w < 1024;
      setScreenSize((prev) => {
        if (prev.isMobile === nextMobile && prev.isTablet === nextTablet) {
          return prev;
        }
        return { isMobile: nextMobile, isTablet: nextTablet };
      });
    };

    const debouncedResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkBreakpoints, 150);
    };

    window.addEventListener("resize", debouncedResize, { passive: true });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("resize", debouncedResize);
    };
  }, []);

  useEffect(() => {
    setReviews(Array.isArray(anyProduct?.reviews) ? anyProduct.reviews : []);
    setAverageRating(Number(anyProduct?.average_rating ?? 0));
    setReviewCount(Number(anyProduct?.review_count ?? 0));
    if (Array.isArray(anyProduct?.siblings)) {
      setFetchedSiblings(anyProduct.siblings);
    }
  }, [anyProduct]);

  useEffect(() => {
    setSelectedImage(null);
  }, [productSlug, anyProduct?.id]);

  useEffect(() => {
    setSelectedOption(firstAvailableVariant);
  }, [firstAvailableVariant, product?.id]);

  useEffect(() => {
    setQuantity(1);
    setAdded(false);
  }, [product?.id]);

  useEffect(() => {
    if (Array.isArray(anyProduct?.reviews)) {
      setReviews(anyProduct.reviews as ProductReview[]);
    }
    if (typeof anyProduct?.average_rating === "number") {
      setAverageRating(Number(anyProduct.average_rating));
    }
    if (typeof anyProduct?.review_count === "number") {
      setReviewCount(Number(anyProduct.review_count));
    }
    if (Array.isArray(anyProduct?.siblings)) {
      setFetchedSiblings(anyProduct.siblings);
    }
  }, [product?.id]);

  useEffect(() => {
    if (!siteId || !product?.id) return;
    // If the parent already passed reviews and siblings, skip redundant blocking fetch
    if (Array.isArray(anyProduct?.reviews) && Array.isArray(anyProduct?.siblings)) {
      return;
    }

    const loadProductReviews = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/sites/${siteId}/products/${product.id}`,
          { credentials: "include" }
        );

        if (!res.ok) return;

        const data = await res.json();

        if (Array.isArray(data?.reviews)) {
          setReviews(data.reviews);
        }

        if (typeof data?.average_rating === "number") {
          setAverageRating(data.average_rating);
        }

        if (typeof data?.review_count === "number") {
          setReviewCount(data.review_count);
        }

        if (Array.isArray(data?.siblings)) {
          setFetchedSiblings(data.siblings);
        }
      } catch (error) {
        console.error("Failed to load product reviews", error);
      }
    };

    loadProductReviews();
  }, [product?.id, siteId]);

  useEffect(() => {
    if (!isAuthenticated || !product || !siteId) return;

    const loadEligibleOrderItem = async () => {
      setCheckingEligibility(true);
      try {
        const res = await fetch(`${API_BASE_URL}/orders/${siteId}/delivered`, {
          credentials: "include",
        });
        if (!res.ok) {
          setEligibleOrderItem(null);
          return;
        }
        const data = await res.json();
        const ordersList = Array.isArray(data?.orders) ? data.orders : [];
        
        const matchedItem = ordersList
          .flatMap((o: any) => o.items || [])
          .find((item: any) => String(item.product_id) === String(product.id)) ?? null;

        setEligibleOrderItem(matchedItem);
      } catch (error) {
        setEligibleOrderItem(null);
      } finally {
        setCheckingEligibility(false);
      }
    };

    loadEligibleOrderItem();
  }, [isAuthenticated, product, siteId]);

  const isMobile = screenSize.isMobile;
  const isTablet = screenSize.isTablet;

  const {
    isDark,
    primaryBg: resolvedPrimaryBg,
    cardBg: defaultCardBg,
    textColor: defaultTextColor,
    borderColor: resolvedBorderColor,
    accentColor: defaultAccent,
    accentHover,
    accentText: defaultAccentText,
  } = resolveThemeTokens(theme);
  const panelBg =
    panel_color ||
    background_color ||
    (theme as any)?.product_detail_bg ||
    (theme as any)?.detail_bg ||
    defaultCardBg;

  // Determine dark vs light directly from the panel's own surface background!
  const isPanelDark = isColorDarkHex(panelBg);
  const isLight = !isPanelDark;

  // Derive high-contrast typography and subtle elements relative to the panel surface!
  const surfaceDefaultText = isPanelDark ? "#f8fafc" : "#0f172a";
  const rawRequestedText = text_color || (theme as any)?.product_detail_text;

  // If text color is provided and has good contrast, keep it; otherwise compute contrast against panel
  const pageText =
    rawRequestedText && (isColorDarkHex(rawRequestedText) !== isPanelDark)
      ? rawRequestedText
      : (theme as any)?.card_text_color && (isColorDarkHex((theme as any).card_text_color) !== isPanelDark)
      ? (theme as any).card_text_color
      : (defaultTextColor && isColorDarkHex(defaultTextColor) !== isPanelDark)
      ? defaultTextColor
      : surfaceDefaultText;

  const mutedText = isPanelDark ? "rgba(248, 250, 252, 0.72)" : "rgba(15, 23, 42, 0.68)";
  const subtleText = isPanelDark ? "rgba(248, 250, 252, 0.50)" : "rgba(15, 23, 42, 0.50)";

  const activeBtnBg =
    button_bg_color ||
    (theme as any)?.product_detail_btn_bg ||
    defaultAccent;

  const activeBtnTextColor =
    button_text_color ||
    (theme as any)?.product_detail_btn_text ||
    (isColorDarkHex(activeBtnBg) ? "#ffffff" : "#0f172a");

  const accentColor = activeBtnBg;

  const subtleBorder = isPanelDark
    ? `1px solid ${(theme as any)?.border_color || "rgba(255, 255, 255, 0.12)"}`
    : `1px solid ${(theme as any)?.border_color || "rgba(15, 23, 42, 0.10)"}`;

  if (isResolvingProduct && !product) {
    const skeletonBg = isPanelDark
      ? "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)"
      : "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)";

    const skeletonStyle: React.CSSProperties = {
      backgroundImage: skeletonBg,
      backgroundSize: "200% 100%",
      animation: "detailShimmer 1.5s infinite linear",
      willChange: "background-position",
      transform: "translateZ(0)",
    };

    return (
      <section
        style={{
          maxWidth: max_width ? `${max_width}px` : "1180px",
          margin: "0 auto",
          padding: isMobile ? "12px 12px 32px" : "16px 20px 48px",
          fontFamily: theme?.font_family || "inherit",
        }}
      >
        <style>{`
          @keyframes detailShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.05fr 1fr",
            gap: isMobile ? "20px" : "32px",
            alignItems: "start",
          }}
        >
          {/* Left Column: Media Gallery Skeleton */}
          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                ...skeletonStyle,
                width: "100%",
                aspectRatio: "1/1",
                borderRadius: "20px",
                border: subtleBorder,
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    ...skeletonStyle,
                    width: "64px",
                    height: "64px",
                    borderRadius: "12px",
                    border: subtleBorder,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right Column: Product Info Skeleton */}
          <div
            style={{
              display: "grid",
              gap: "16px",
              padding: isMobile ? "16px" : "24px",
              borderRadius: "22px",
              border: subtleBorder,
              background: panelBg,
            }}
          >
            <div
              style={{
                ...skeletonStyle,
                width: "90px",
                height: "24px",
                borderRadius: "999px",
              }}
            />

            <div style={{ display: "grid", gap: "8px" }}>
              <div
                style={{
                  ...skeletonStyle,
                  width: "90%",
                  height: "28px",
                  borderRadius: "8px",
                }}
              />
              <div
                style={{
                  ...skeletonStyle,
                  width: "60%",
                  height: "28px",
                  borderRadius: "8px",
                }}
              />
            </div>

            <div
              style={{
                ...skeletonStyle,
                width: "140px",
                height: "18px",
                borderRadius: "6px",
              }}
            />

            <div
              style={{
                ...skeletonStyle,
                width: "180px",
                height: "36px",
                borderRadius: "10px",
                margin: "4px 0",
              }}
            />

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ ...skeletonStyle, width: "32px", height: "32px", borderRadius: "50%" }} />
              <div style={{ ...skeletonStyle, width: "32px", height: "32px", borderRadius: "50%" }} />
              <div style={{ ...skeletonStyle, width: "32px", height: "32px", borderRadius: "50%" }} />
            </div>

            <div
              style={{
                ...skeletonStyle,
                width: "100%",
                height: "48px",
                borderRadius: "12px",
                marginTop: "10px",
              }}
            />

            <div
              style={{
                ...skeletonStyle,
                width: "100%",
                height: "64px",
                borderRadius: "14px",
                marginTop: "4px",
              }}
            />
          </div>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section
        style={{
          maxWidth: max_width ? `${max_width}px` : "1180px",
          margin: "0 auto",
          padding: isMobile ? "32px 16px" : "64px 20px",
          fontFamily: theme?.font_family || "inherit",
        }}
      >
        <div
          style={{
            border: subtleBorder,
            borderRadius: "24px",
            padding: isMobile ? "36px 20px" : "56px 32px",
            background: panelBg,
            color: pageText,
            textAlign: "center",
            maxWidth: "520px",
            margin: "0 auto",
            boxShadow: isPanelDark ? "0 20px 40px rgba(0,0,0,0.4)" : "0 16px 32px rgba(15,23,42,0.06)",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: isPanelDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              margin: "0 auto 16px",
            }}
          >
            🔍
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px", color: pageText }}>
            Product Not Found
          </h2>
          <p style={{ fontSize: "14px", color: mutedText, margin: "0 0 24px", lineHeight: 1.6 }}>
            The product you are looking for might have been moved, renamed, or is temporarily unavailable.
          </p>
          <button
            type="button"
            onClick={() => {
              if (siteSlug) {
                navigate(`/store/${siteSlug}`);
              } else {
                navigate("/");
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 24px",
              borderRadius: "12px",
              background: accentColor,
              color: activeBtnTextColor || "#ffffff",
              border: "none",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "transform 0.15s ease",
            }}
          >
            <span>← Back to Store</span>
          </button>
        </div>
      </section>
    );
  }

  const elevatedBg = isLight ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.08)";
  const softSectionBg = isLight ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.04)";
  const mediaBg = isLight ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.25)";

  const strongerBorder = isLight
    ? `1px solid ${(theme as any)?.border_color || "rgba(15,23,42,0.16)"}`
    : `1px solid ${(theme as any)?.border_color || "rgba(255,255,255,0.18)"}`;

  const softShadow = isMobile
    ? "0 2px 8px rgba(0,0,0,0.04)"
    : isLight
    ? "0 12px 32px rgba(15,23,42,0.06)"
    : "0 16px 36px rgba(0,0,0,0.3)";

  const panelShadow = isMobile
    ? "0 4px 14px rgba(0,0,0,0.06)"
    : isLight
    ? "0 18px 40px rgba(15,23,42,0.08)"
    : "0 22px 48px rgba(0,0,0,0.35)";

  const activeRing = `0 0 0 3px ${accentColor}25`;
  const reviewCardBg = isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.05)";

  const shellCard = {
    border: subtleBorder,
    background: panelBg,
  } as const;

  const reviewInputBase = {
    width: "100%",
    borderRadius: "12px",
    border: strongerBorder,
    background: isLight ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.04)",
    color: pageText,
    outline: "none",
  } as const;

  const tagText = {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: subtleText,
  };

  const selectedVariantMeta = optionValues.find((option) => option.value === selectedOption);

  const effectivePrice =
    typeof selectedVariantMeta?.price === "number" && selectedVariantMeta.price > 0
      ? selectedVariantMeta.price
      : product.price;

  const effectiveOriginalPrice =
    typeof selectedVariantMeta?.comparePrice === "number" &&
    selectedVariantMeta.comparePrice > effectivePrice
      ? selectedVariantMeta.comparePrice
      : typeof anyProduct?.originalPrice === "number" && anyProduct.originalPrice > effectivePrice
      ? anyProduct.originalPrice
      : typeof anyProduct?.compare_price === "number" && anyProduct.compare_price > effectivePrice
      ? anyProduct.compare_price
      : undefined;

  const normalizedDiscountPercent =
    typeof effectiveOriginalPrice === "number" && effectiveOriginalPrice > effectivePrice
      ? Math.round(((effectiveOriginalPrice - effectivePrice) / effectiveOriginalPrice) * 100)
      : typeof anyProduct?.discountPercent === "number" && anyProduct.discountPercent > 0
      ? anyProduct.discountPercent
      : 0;

  const variantStockQty =
    typeof selectedVariantMeta?.stockQty === "number" ? selectedVariantMeta.stockQty : null;

  const normalizedInStock = hasVariants
    ? optionValues.some(
        (option) =>
          option.inStock !== false &&
          (option.stockQty == null || Number(option.stockQty) > 0)
      )
    : typeof anyProduct?.inStock === "boolean"
    ? anyProduct.inStock
    : typeof anyProduct?.in_stock === "boolean"
    ? anyProduct.in_stock
    : Number(anyProduct?.stock ?? 0) > 0;

  const showOriginal =
    typeof effectiveOriginalPrice === "number" && effectiveOriginalPrice > effectivePrice;

  const showDiscount = normalizedDiscountPercent > 0;

  const selectedVariantOutOfStock =
    hasVariants &&
    (!selectedVariantMeta ||
      selectedVariantMeta.inStock === false ||
      (variantStockQty != null && variantStockQty <= 0));

  const availableQty = hasVariants
    ? variantStockQty
    : typeof product.stock === "number"
    ? product.stock
    : null;

  const quantityAlreadyInCart = cartItems.reduce((sum, item) => {
    const sameProduct = String(item.id) === String(product.id);
    const sameVariant =
      (item.selectedVariantValue ?? null) === (hasVariants ? selectedOption : null);
    return sameProduct && sameVariant ? sum + item.quantity : sum;
  }, 0);

  const remainingQty =
    typeof availableQty === "number" ? Math.max(availableQty - quantityAlreadyInCart, 0) : null;

  const isEntireProductOutOfStock = !normalizedInStock;
  const isCartLimitReached = typeof remainingQty === "number" ? remainingQty <= 0 : false;

  const stockMessage = isEntireProductOutOfStock
    ? "Out of stock"
    : selectedVariantOutOfStock && selectedOption
    ? `${selectedOption} is out of stock`
    : isCartLimitReached
    ? "All available stock is already in your cart"
    : hasVariants &&
      selectedOption &&
      typeof remainingQty === "number" &&
      remainingQty > 0 &&
      remainingQty <= 5
    ? `Only ${remainingQty} left in ${selectedOption}`
    : "";

  const maxAllowedQty =
    typeof remainingQty === "number" && remainingQty > 0 ? remainingQty : null;

  const isAtMaxQty = typeof maxAllowedQty === "number" ? quantity >= maxAllowedQty : false;

  const canAddToCart = normalizedInStock && (!hasVariants || Boolean(selectedOption));
  const finalCanAddToCart =
    canAddToCart && !selectedVariantOutOfStock && !isCartLimitReached;

  const ratingDisplay = averageRating > 0 ? averageRating.toFixed(1) : "New";
  const reviewCountDisplay = reviewCount > 0 ? String(reviewCount) : "";

  const canSubmitReview =
    isAuthenticated &&
    !!siteId &&
    !!eligibleOrderItem &&
    reviewRating >= 1 &&
    reviewRating <= 5 &&
    !reviewSubmitting;

  const handleAddToCart = async () => {
    if (!finalCanAddToCart) return;
    if (typeof maxAllowedQty === "number" && quantity > maxAllowedQty) return;

    const productToAdd: Product = {
      ...product,
      price: effectivePrice,
      compare_price: showOriginal ? effectiveOriginalPrice ?? null : null,
      in_stock: true,
      stock: variantStockQty ?? product.stock,
      selectedVariantValue: hasVariants ? selectedOption : null,
      selectedVariantLabel: hasVariants ? optionLabel : null,
      ...(hasVariants && selectedOption
        ? {
            variant_option: {
              optionType: variantOption?.optionType,
              optionName: variantOption?.optionName || optionLabel,
              optionValues: selectedVariantMeta ? [selectedVariantMeta] : [],
            },
          }
        : {}),
    };

    try {
      await addToCart(productToAdd, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    } catch (error) {
      console.error("Failed to add product to cart", error);
    }
  };

  const handleReviewImageUpload = async (file: File) => {
    if (!file) return;
    if (!siteId) {
      setReviewUploadError("Missing site id for this product.");
      return;
    }

    setReviewUploadError("");

    try {
      const compressedFile = await compressImageFile(file, 1200, 1200, 0.80);
      const formData = new FormData();
      formData.append("file", compressedFile);

      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products/upload-review-image`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to upload review image");
      }

      if (data?.url) {
        setReviewImages((current) => [...current, data.url]);
      }
    } catch (error) {
      console.error("Review image upload failed", error);
      setReviewUploadError(
        error instanceof Error ? error.message : "Failed to upload image"
      );
    }
  };

  const submitReview = async () => {
    if (!isAuthenticated) {
      setReviewMessage("Please log in to submit a review.");
      return;
    }

    if (!siteId) {
      setReviewMessage("Missing site id for this product.");
      return;
    }

    if (!eligibleOrderItem?.id) {
      setReviewMessage("No delivered purchase found for this product.");
      return;
    }

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      setReviewMessage("Please select a rating.");
      return;
    }

    setReviewSubmitting(true);
    setReviewMessage("");

    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products/reviews`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: product.id,
            order_item_id: eligibleOrderItem.id,
            rating: reviewRating,
            review_text: reviewText,
            review_images: reviewImages,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to submit review");
      }

      if (data?.review) {
        setReviews((current) => [data.review, ...current]);
      }
      setAverageRating(Number(data?.average_rating ?? averageRating));
      setReviewCount(Number(data?.review_count ?? reviewCount));
      setReviewRating(0);
      setReviewText("");
      setReviewImages([]);
      setReviewMessage("Review submitted successfully.");
      setEligibleOrderItem(null);
    } catch (error) {
      console.error("Failed to submit review", error);
      setReviewMessage(
        error instanceof Error ? error.message : "Failed to submit review"
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleLoadMoreReviews = async () => {
    if (visibleReviewsCount < reviews.length) {
      setVisibleReviewsCount((prev) => prev + 4);
      return;
    }

    if (siteId && product?.id && (hasMoreReviews || reviews.length < reviewCount)) {
      setLoadingMoreReviews(true);
      try {
        const nextPage = reviewPage + 1;
        const res = await fetch(
          `${API_BASE_URL}/sites/${siteId}/products/${product.id}/reviews?page=${nextPage}&page_size=10`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          const newReviews = Array.isArray(data?.reviews) ? data.reviews : [];
          if (newReviews.length > 0) {
            setReviews((prev) => {
              const existingIds = new Set(prev.map((r) => r.id));
              const filtered = newReviews.filter((r: ProductReview) => !existingIds.has(r.id));
              return [...prev, ...filtered];
            });
            setReviewPage(nextPage);
            setVisibleReviewsCount((prev) => prev + 4);
          }
          setHasMoreReviews(Boolean(data?.has_more));
        }
      } catch (err) {
        console.error("Failed to load more reviews", err);
      } finally {
        setLoadingMoreReviews(false);
      }
    }
  };

  const gallerySlots = Array.from(
    { length: MAX_GALLERY_IMAGES },
    (_, index) => normalizedImages[index] || null
  );

  const pagePadding = isMobile ? "12px 12px 32px" : "16px 16px 40px";
  const mainGridColumns = isMobile
    ? "1fr"
    : isTablet
    ? "minmax(0, 380px) minmax(0, 1fr)"
    : "minmax(0, 460px) minmax(0, 1fr)";
  const buyGridColumns = isMobile ? "108px minmax(0, 1fr)" : "116px minmax(0, 1fr)";
  const reviewGridColumns = isMobile ? "1fr" : "minmax(280px, 360px) minmax(0, 1fr)";
  const supportGridColumns = isMobile ? "repeat(3, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";

  const resolvedAddToCartText = add_to_cart_label || "Add to cart";
  const resolvedMaxWidth = max_width === "full" ? "100%" : max_width ? `${max_width}px` : "1140px";
  const resolvedImageAspect = image_aspect_ratio || "1 / 1";
  const resolvedImageFit = image_fit || "cover";

  return (
    <section
      style={{
        maxWidth: resolvedMaxWidth,
        margin: "0 auto",
        padding: pagePadding,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mainGridColumns,
          gap: isMobile ? "14px" : "20px",
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              ...shellCard,
              borderRadius: isMobile ? "18px" : "22px",
              boxShadow: softShadow,
              padding: isMobile ? "8px" : "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                borderRadius: isMobile ? "14px" : "16px",
                overflow: "hidden",
                background: mediaBg,
                aspectRatio: resolvedImageAspect,
              }}
            >
              {/* Top-Right Share Icon Button (Mobile Only) */}
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  title="Share this product"
                  aria-label="Share product"
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    zIndex: 3,
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: isLight ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.85)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: subtleBorder,
                    color: pageText,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    padding: 0,
                    transition: "transform 0.15s ease",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
              )}

              {/* Bottom-Left Fixed Rating Badge (Clickable to jump to Reviews) */}
              {show_ratings && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const el = document.getElementById("reviews-section");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  title="View customer reviews"
                  aria-label="View customer reviews"
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    left: "10px",
                    zIndex: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: isLight ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.85)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: subtleBorder,
                    fontSize: "11px",
                    fontWeight: 700,
                    color: pageText,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                    cursor: "pointer",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span style={{ color: "#f59e0b", fontSize: "11px" }}>★</span>
                  <span>{ratingDisplay}</span>
                  {reviewCountDisplay && (
                    <>
                      <span style={{ color: mutedText, opacity: 0.5 }}>|</span>
                      <span style={{ color: mutedText, fontWeight: 600 }}>{reviewCountDisplay}</span>
                    </>
                  )}
                </button>
              )}

              {show_discount_badge && showDiscount && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    zIndex: 2,
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: isLight ? "rgba(15,23,42,0.85)" : "rgba(30,41,59,0.92)",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  {normalizedDiscountPercent}% OFF
                </div>
              )}

              {show_stock_badge && !normalizedInStock && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "52px",
                    zIndex: 2,
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: isLight ? "rgba(255,255,255,0.94)" : "rgba(15,23,42,0.84)",
                    border: subtleBorder,
                    color: isLight ? "#b91c1c" : "#fecaca",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  Out of stock
                </div>
              )}

              {/* Swipeable & Scrollable Gallery Track */}
              <div
                ref={galleryScrollRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el && el.clientWidth > 0) {
                    const idx = Math.round(el.scrollLeft / el.clientWidth);
                    if (idx !== activeSlideIndex && idx >= 0 && idx < mediaItems.length) {
                      setActiveSlideIndex(idx);
                      const item = mediaItems[idx];
                      if (item) {
                        if (item.type === "video") {
                          setIsVideoActive(true);
                        } else {
                          setIsVideoActive(false);
                          if (item.src) setSelectedImage(item.src);
                        }
                      }
                    }
                  }
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  overflowX: "auto",
                  scrollSnapType: "x mandatory",
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {mediaItems.length > 0 ? (
                  mediaItems.map((item, idx) => (
                    <div
                      key={`gallery-slide-${idx}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        flexShrink: 0,
                        scrollSnapAlign: "start",
                        position: "relative",
                      }}
                    >
                      {item.type === "video" ? (
                        videoInfo.src ? (
                          videoInfo.type === "youtube" || videoInfo.type === "vimeo" ? (
                            <iframe
                              src={videoInfo.src}
                              title={`${product?.name || "Product"} Video`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                            />
                          ) : (
                            <video
                              src={videoInfo.src}
                              controls
                              autoPlay
                              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }}
                            />
                          )
                        ) : null
                      ) : item.src ? (
                        <img
                          src={item.src}
                          alt={`${product.name} - view ${idx + 1}`}
                          loading={idx === 0 ? "eager" : "lazy"}
                          decoding="async"
                          style={{ width: "100%", height: "100%", objectFit: resolvedImageFit, objectPosition: "top center", display: "block" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            color: mutedText,
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        >
                          No image available
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: mutedText,
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    No image available
                  </div>
                )}
              </div>
            </div>
          </div>

          {videoInfo.src && (
            <button
              type="button"
              onClick={() => {
                const videoIdx = mediaItems.findIndex((m) => m.type === "video");
                if (videoIdx >= 0) {
                  setIsVideoActive(!isVideoActive);
                  setActiveSlideIndex(videoIdx);
                  if (galleryScrollRef.current) {
                    galleryScrollRef.current.scrollTo({
                      left: videoIdx * galleryScrollRef.current.clientWidth,
                      behavior: "smooth",
                    });
                  }
                } else {
                  setIsVideoActive(!isVideoActive);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "12px",
                border: isVideoActive ? `1.5px solid ${accentColor}` : subtleBorder,
                background: isVideoActive
                  ? isLight
                    ? "#eff6ff"
                    : "rgba(37,99,235,0.2)"
                  : isLight
                  ? "#ffffff"
                  : "rgba(255,255,255,0.04)",
                color: isVideoActive ? (isLight ? "#1d4ed8" : "#93c5fd") : pageText,
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: softShadow,
                transition: "all 0.2s ease",
              }}
            >
              <span>{isVideoActive ? "✕ Close Video Player" : "▶ Watch Product Video"}</span>
            </button>
          )}

          <div
            style={{
              display: isMobile ? "flex" : "grid",
              overflowX: isMobile ? "auto" : "visible",
              gridTemplateColumns: isMobile ? undefined : `repeat(${Math.max(mediaItems.length, 4)}, minmax(0, 1fr))`,
              gap: isMobile ? "6px" : "8px",
              scrollbarWidth: "none",
              paddingBottom: isMobile ? "2px" : "0",
            }}
          >
            {mediaItems.map((item, index) => {
              if (item.type === "video") {
                return (
                  <button
                    key={`media-video-${index}`}
                    type="button"
                    onClick={() => {
                      setIsVideoActive(true);
                      setActiveSlideIndex(index);
                      if (galleryScrollRef.current) {
                        galleryScrollRef.current.scrollTo({
                          left: index * galleryScrollRef.current.clientWidth,
                          behavior: "smooth",
                        });
                      }
                    }}
                    style={{
                      padding: 0,
                      width: isMobile ? "54px" : "auto",
                      height: isMobile ? "54px" : "auto",
                      flexShrink: 0,
                      borderRadius: isMobile ? "10px" : "12px",
                      overflow: "hidden",
                      border: isVideoActive ? `1.5px solid ${accentColor}` : subtleBorder,
                      background: isVideoActive ? (isLight ? "#eff6ff" : "rgba(37,99,235,0.2)") : (isLight ? "#f8fafc" : "rgba(255,255,255,0.03)"),
                      boxShadow: isVideoActive ? activeRing : "none",
                      cursor: "pointer",
                      aspectRatio: "1 / 1",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                    }}
                  >
                    <span style={{ fontSize: isMobile ? "16px" : "18px" }}>▶️</span>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: isVideoActive ? "#2563eb" : mutedText, textTransform: "uppercase" }}>Video</span>
                  </button>
                );
              }

              const image = item.src;
              const isActive = !isVideoActive && (activeSlideIndex === index || (image && selectedImage === image));

              return (
                <button
                  key={`gallery-slot-${index}`}
                  type="button"
                  onClick={() => {
                    if (image) {
                      setIsVideoActive(false);
                      setSelectedImage(image);
                      setActiveSlideIndex(index);
                      if (galleryScrollRef.current) {
                        galleryScrollRef.current.scrollTo({
                          left: index * galleryScrollRef.current.clientWidth,
                          behavior: "smooth",
                        });
                      }
                    }
                  }}
                  style={{
                    padding: 0,
                    width: isMobile ? "54px" : "auto",
                    height: isMobile ? "54px" : "auto",
                    flexShrink: 0,
                    borderRadius: isMobile ? "10px" : "12px",
                    overflow: "hidden",
                    border: isActive ? `1.5px solid ${accentColor}` : subtleBorder,
                    background: image ? panelBg : isLight ? "#f8fafc" : "rgba(255,255,255,0.03)",
                    boxShadow: isActive ? activeRing : "none",
                    cursor: "pointer",
                    aspectRatio: "1 / 1",
                  }}
                >
                  <img
                    src={getThumbnailUrl(image, 140, 140)}
                    alt={`${product.name} view ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ minWidth: 0, position: isMobile ? "static" : "sticky", top: "20px" }}>
          <div
            style={{
              ...shellCard,
              borderRadius: isMobile ? "18px" : "22px",
              boxShadow: panelShadow,
              padding: isMobile ? "14px 14px" : isTablet ? "16px 18px" : "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "12px" : "14px",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "grid", gap: "10px", paddingBottom: "14px", borderBottom: subtleBorder }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {show_brand_name && product.brand && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: subtleText,
                    }}
                  >
                    {product.brand}
                  </span>
                )}

                {show_brand_name && product.category && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: mutedText,
                      background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)",
                      border: subtleBorder,
                      padding: "4px 8px",
                      borderRadius: "999px",
                    }}
                  >
                    {product.category}
                  </span>
                )}


                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    title="Share this product"
                    style={{
                      marginLeft: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      borderRadius: "999px",
                      background: copiedLink
                        ? isLight
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(34,197,94,0.2)"
                        : isLight
                        ? "rgba(15,23,42,0.06)"
                        : "rgba(255,255,255,0.09)",
                      border: copiedLink
                        ? `1px solid ${isLight ? "rgba(34,197,94,0.3)" : "rgba(134,239,172,0.3)"}`
                        : subtleBorder,
                      color: copiedLink ? (isLight ? "#15803d" : "#4ade80") : pageText,
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.16s ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    {copiedLink ? (
                      <>
                        <span style={{ fontSize: "12px", color: "#16a34a" }}>✓</span>
                        <span style={{ color: isLight ? "#15803d" : "#4ade80" }}>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        <span>Share</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {badgeCollections.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "2px" }}>
                  {badgeCollections.map((col: any) => (
                    <span
                      key={col.id || col.name}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        background: col.badge_color || "linear-gradient(135deg, #d97706, #b45309)",
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                        textTransform: "uppercase",
                      }}
                    >
                      {col.name}
                    </span>
                  ))}
                </div>
              )}

              <h1
                style={{
                  margin: 0,
                  fontSize: isMobile ? "24px" : "clamp(22px, 2.5vw, 30px)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.04em",
                  color: pageText,
                }}
              >
                {product.name}
              </h1>

              {renderHeroHighlights(product.highlights, pageText, mutedText)}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "14px",
                paddingBottom: "14px",
                borderBottom: subtleBorder,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: subtleText,
                  }}
                >
                  Price
                </span>

                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: isMobile ? "28px" : "30px",
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      color: pageText,
                    }}
                  >
                    ₹{effectivePrice}
                  </span>

                  {show_original_price && showOriginal && (
                    <span style={{ fontSize: "14px", color: subtleText, textDecoration: "line-through" }}>
                      ₹{effectiveOriginalPrice}
                    </span>
                  )}

                  {showDiscount && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: isLight ? "#16a34a" : "#4ade80",
                        background: isLight ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.2)",
                        border: isLight
                          ? "1px solid rgba(34,197,94,0.2)"
                          : "1px solid rgba(134,239,172,0.2)",
                        padding: "4px 8px",
                        borderRadius: "999px",
                      }}
                    >
                      Save {normalizedDiscountPercent}%
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMobile ? "flex-start" : "flex-end",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? (isLight ? "#b91c1c" : "#f87171")
                        : (isLight ? "#15803d" : "#4ade80"),
                    background:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? (isLight ? "rgba(239,68,68,0.10)" : "rgba(248,113,113,0.15)")
                        : (isLight ? "rgba(34,197,94,0.10)" : "rgba(74,222,128,0.15)"),
                    border:
                      isEntireProductOutOfStock || selectedVariantOutOfStock || isCartLimitReached
                        ? (isLight ? "1px solid rgba(239,68,68,0.14)" : "1px solid rgba(248,113,113,0.25)")
                        : (isLight ? "1px solid rgba(34,197,94,0.14)" : "1px solid rgba(74,222,128,0.25)"),
                    padding: "6px 10px",
                    borderRadius: "999px",
                  }}
                >
                  {isEntireProductOutOfStock
                    ? "Out of stock"
                    : selectedVariantOutOfStock && selectedOption
                    ? `${selectedOption} is out of stock`
                    : isCartLimitReached
                    ? "Already in cart"
                    : "In stock"}
                </span>
              </div>
            </div>

            {/* Sibling Products / Color Family Switcher (Amazon & Flipkart Style) */}
            {resolvedSiblings.length > 1 && (
              <div
                style={{
                  display: "grid",
                  gap: "8px",
                  padding: isMobile ? "10px 12px" : "12px 14px",
                  borderRadius: isMobile ? "14px" : "16px",
                  background: softSectionBg,
                  border: subtleBorder,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: pageText }}>
                      Color:
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 800,
                        color: accentColor,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {anyProduct.sibling_label || anyProduct.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: mutedText,
                      fontWeight: 600,
                    }}
                  >
                    {resolvedSiblings.length} colors
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: isMobile ? "nowrap" : "wrap",
                    overflowX: isMobile ? "auto" : "visible",
                    scrollbarWidth: "none",
                    gap: isMobile ? "8px" : "10px",
                    alignItems: "center",
                    paddingBottom: isMobile ? "4px" : "0",
                  }}
                >
                  {resolvedSiblings.map((sib: SiblingProduct) => {
                    const isCurrent =
                      sib.is_current ||
                      sib.id === String(anyProduct.id) ||
                      (sib.slug && sib.slug === productSlug);
                    const isOut = !sib.in_stock;

                    const isStoreRoute = location.pathname.startsWith("/store/");
                    const appBase = isStoreRoute
                      ? siteSlug
                        ? `/store/${siteSlug}`
                        : "/store"
                      : siteId
                      ? `/builder/${siteId}`
                      : "";

                    return (
                      <button
                        key={sib.id}
                        type="button"
                        onClick={() => {
                          const targetSlug = sib.slug || sib.id;
                          if (targetSlug) {
                            const cached = getCachedProduct(targetSlug);
                            if (cached) {
                              setFetchedProduct(cached);
                            }
                            navigate(`${appBase}/products/${targetSlug}`);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "5px 10px 5px 6px",
                          borderRadius: "10px",
                          border: isCurrent
                            ? `2px solid ${accentColor}`
                            : `1px solid ${isLight ? "#e2e8f0" : "rgba(255,255,255,0.12)"}`,
                          background: isCurrent
                            ? isLight
                              ? "rgba(37,99,235,0.06)"
                              : "rgba(37,99,235,0.18)"
                            : isLight
                            ? "#ffffff"
                            : "rgba(255,255,255,0.03)",
                          boxShadow: isCurrent
                            ? `0 0 0 1px ${accentColor}`
                            : "0 1px 2px rgba(0,0,0,0.04)",
                          cursor: "pointer",
                          transition: "all 0.16s ease",
                          opacity: isOut ? 0.55 : 1,
                          flex: "0 0 auto",
                          maxWidth: isMobile ? "140px" : "160px",
                        }}
                      >
                        {sib.cover_image && (
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "6px",
                              overflow: "hidden",
                              flexShrink: 0,
                              background: isLight ? "#f1f5f9" : "#1e293b",
                            }}
                          >
                            <img
                              src={getThumbnailUrl(sib.cover_image, 80, 80)}
                              alt={sib.sibling_label || sib.name}
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            textAlign: "left",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: isCurrent ? 800 : 600,
                              color: isCurrent ? (isLight ? "#1d4ed8" : "#93c5fd") : pageText,
                              lineHeight: 1.2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "90px",
                            }}
                          >
                            {sib.sibling_label || sib.name}
                          </span>

                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: isOut ? "#ef4444" : mutedText,
                            }}
                          >
                            {isOut ? "Sold Out" : `₹${sib.price}`}
                          </span>
                        </div>

                        {isCurrent && (
                          <span
                            style={{
                              color: accentColor,
                              fontSize: "11px",
                              fontWeight: 900,
                              marginLeft: "2px",
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasVariants && (
              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  padding: isMobile ? "12px" : "14px",
                  borderRadius: isMobile ? "16px" : "18px",
                  background: softSectionBg,
                  border: subtleBorder,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: pageText }}>
                    Select {optionLabel}
                  </p>
                  {selectedOption && (
                    <span style={{ fontSize: "12px", color: mutedText, fontWeight: 600 }}>
                      Chosen: {selectedOption}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {optionValues.map((option) => {
                    const optionInStock =
                      option.inStock !== false &&
                      (option.stockQty == null || Number(option.stockQty) > 0);
                    const isSelected = selectedOption === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => optionInStock && setSelectedOption(option.value)}
                        disabled={!optionInStock}
                        style={{
                          minWidth: "52px",
                          padding: "9px 13px",
                          borderRadius: "12px",
                          border: isSelected ? `1px solid ${accentColor}` : subtleBorder,
                          background: isSelected
                            ? isLight
                              ? "rgba(37,99,235,0.08)"
                              : "rgba(37,99,235,0.16)"
                            : optionInStock
                            ? elevatedBg
                            : "rgba(148,163,184,0.10)",
                          color: optionInStock ? pageText : subtleText,
                          fontWeight: 700,
                          fontSize: "12px",
                          opacity: optionInStock ? 1 : 0.55,
                          textDecoration: optionInStock ? "none" : "line-through",
                          cursor: optionInStock ? "pointer" : "not-allowed",
                          boxShadow: isSelected ? activeRing : "none",
                        }}
                      >
                        {option.value}
                      </button>
                    );
                  })}
                </div>

                {stockMessage && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color:
                        stockMessage === "Out of stock" ||
                        stockMessage.includes("out of stock") ||
                        stockMessage.includes("already in your cart")
                          ? (isLight ? "#b91c1c" : "#f87171")
                          : (isLight ? "#b45309" : "#fbbf24"),
                      fontWeight: 600,
                    }}
                  >
                    {stockMessage}
                  </p>
                )}

                {!selectedOption && (
                  <p style={{ margin: 0, fontSize: "12px", color: isLight ? "#b45309" : "#fbbf24", fontWeight: 600 }}>
                    Please select {optionLabel.toLowerCase()} before adding to cart.
                  </p>
                )}
              </div>
            )}

            <div
              ref={inlineBuyRef}
              style={{
                display: "grid",
                gridTemplateColumns: buyGridColumns,
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div style={{ display: "grid", gap: "7px" }}>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: pageText }}>
                  Quantity
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 40px",
                    alignItems: "center",
                    minHeight: "46px",
                    borderRadius: "15px",
                    border: strongerBorder,
                    background: elevatedBg,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    style={{
                      height: "46px",
                      border: "none",
                      borderRight: subtleBorder,
                      background: "transparent",
                      color: mutedText,
                      fontSize: "18px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    −
                  </button>

                  <div style={{ textAlign: "center", fontSize: "14px", fontWeight: 700, color: pageText }}>
                    {quantity}
                  </div>

                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQuantity((current) => {
                        if (typeof maxAllowedQty === "number") {
                          return Math.min(maxAllowedQty, current + 1);
                        }
                        return current + 1;
                      })
                    }
                    disabled={
                      selectedVariantOutOfStock ||
                      isEntireProductOutOfStock ||
                      isCartLimitReached ||
                      isAtMaxQty
                    }
                    style={{
                      height: "46px",
                      border: "none",
                      borderLeft: subtleBorder,
                      background: "transparent",
                      color:
                        selectedVariantOutOfStock ||
                        isEntireProductOutOfStock ||
                        isCartLimitReached ||
                        isAtMaxQty
                          ? subtleText
                          : mutedText,
                      fontSize: "18px",
                      fontWeight: 700,
                      cursor:
                        selectedVariantOutOfStock ||
                        isEntireProductOutOfStock ||
                        isCartLimitReached ||
                        isAtMaxQty
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        selectedVariantOutOfStock ||
                        isEntireProductOutOfStock ||
                        isCartLimitReached ||
                        isAtMaxQty
                          ? 0.5
                          : 1,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "7px" }}>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!finalCanAddToCart}
                  style={{
                    width: "100%",
                    minHeight: "46px",
                    padding: "12px 16px",
                    borderRadius: "15px",
                    border: "none",
                    background: !finalCanAddToCart
                      ? "#94a3b8"
                      : added
                      ? "#16a34a"
                      : activeBtnBg,
                    color: activeBtnTextColor,
                    cursor: finalCanAddToCart ? "pointer" : "not-allowed",
                    fontWeight: 700,
                    fontSize: "14px",
                    letterSpacing: "0.01em",
                    boxShadow: finalCanAddToCart
                      ? added
                        ? "0 12px 24px rgba(22,163,74,0.20)"
                        : isLight
                        ? "0 12px 24px rgba(37,99,235,0.20)"
                        : "0 12px 24px rgba(37,99,235,0.24)"
                      : "none",
                  }}
                >
                  {!finalCanAddToCart
                    ? isEntireProductOutOfStock
                      ? "Out of stock"
                      : selectedVariantOutOfStock
                      ? `${selectedOption || optionLabel} is out of stock`
                      : isCartLimitReached
                      ? "Already added"
                      : `Select ${optionLabel}`
                    : added
                    ? "Added to cart"
                    : resolvedAddToCartText}
                </button>
              </div>
            </div>

            {(show_delivery_info || show_return_policy || show_quality_guarantee) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: supportGridColumns,
                  gap: isMobile ? "8px" : "10px",
                  paddingTop: "14px",
                  borderTop: subtleBorder,
                }}
              >
                {show_delivery_info && (
                  <div
                    style={{
                      padding: isMobile ? "10px 8px" : "12px 10px",
                      borderRadius: "14px",
                      background: softSectionBg,
                      border: subtleBorder,
                      textAlign: isMobile ? "center" : "left",
                    }}
                  >
                    <p style={{ margin: "0 0 5px", ...tagText }}>Delivery</p>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: pageText }}>
                      {delivery_text || "Fast ship"}
                    </p>
                  </div>
                )}
                {show_return_policy && (
                  <div
                    style={{
                      padding: isMobile ? "10px 8px" : "12px 10px",
                      borderRadius: "14px",
                      background: softSectionBg,
                      border: subtleBorder,
                      textAlign: isMobile ? "center" : "left",
                    }}
                  >
                    <p style={{ margin: "0 0 5px", ...tagText }}>Returns</p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        fontWeight: 600,
                        color:
                          product?.return_window_days === 0 ||
                          (product?.return_window_days == null && defaultReturnWindowDays === 0)
                            ? "#dc2626"
                            : pageText,
                      }}
                    >
                      {effectiveReturnPolicyText}
                    </p>
                  </div>
                )}
                {show_quality_guarantee && (
                  <div
                    style={{
                      padding: isMobile ? "10px 8px" : "12px 10px",
                      borderRadius: "14px",
                      background: softSectionBg,
                      border: subtleBorder,
                      textAlign: isMobile ? "center" : "left",
                    }}
                  >
                    <p style={{ margin: "0 0 5px", ...tagText }}>Quality</p>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: pageText }}>
                      {quality_text || "Curated pick"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {show_detailed_section && (
        <div
          style={{
            ...shellCard,
            marginTop: isMobile ? "18px" : "24px",
            borderRadius: isMobile ? "16px" : "20px",
            boxShadow: softShadow,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setOpenDescription(!openDescription)}
            style={{
              width: "100%",
              padding: isMobile ? "16px 18px" : "18px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              borderBottom: openDescription ? subtleBorder : "none",
            }}
          >
            <span
              style={{
                fontSize: isMobile ? "16px" : "18px",
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: pageText,
              }}
            >
              Product Description
            </span>
            <span
              style={{
                fontSize: "18px",
                color: mutedText,
                transform: openDescription ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "inline-block",
              }}
            >
              ▾
            </span>
          </button>

          {openDescription && (
            <div style={{ padding: isMobile ? "16px 18px 20px" : "20px 24px 24px" }}>
              {renderFormattedDescription(product?.description || "", pageText)}
            </div>
          )}
        </div>
      )}

      {show_reviews_section && (
        <div
          id="reviews-section"
          style={{
            ...shellCard,
            marginTop: isMobile ? "18px" : "22px",
            borderRadius: isMobile ? "18px" : "22px",
            boxShadow: softShadow,
            padding: isMobile ? "16px" : "20px",
            display: "grid",
            gap: "18px",
          }}
        >
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "flex-end",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: pageText,
              }}
            >
              Customer reviews
            </h2>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: mutedText,
              fontWeight: 700,
              fontSize: "13px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#f59e0b", fontSize: "15px" }}>★★★★☆</span>
            <span>{ratingDisplay}</span>
            <span style={{ color: subtleText, fontWeight: 600 }}>{reviewCountDisplay}</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: reviewGridColumns,
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              borderRadius: "18px",
              border: subtleBorder,
              background: reviewCardBg,
              padding: "16px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px", lineHeight: 1.2, color: pageText }}>
                Write a review
              </h3>
              <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: mutedText }}>
                {checkingEligibility
                  ? "Checking your delivered purchases..."
                  : eligibleOrderItem
                  ? "Share your delivered purchase experience."
                  : "No delivered purchase found for this product."}
              </p>
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Your rating
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= reviewRating;

                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      aria-pressed={reviewRating === star}
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "12px",
                        border: reviewRating === star ? `1px solid ${accentColor}` : subtleBorder,
                        background: isLight ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.04)",
                        color: isFilled ? "#f59e0b" : subtleText,
                        fontSize: "16px",
                        cursor: "pointer",
                      }}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Review text
              </p>
              <textarea
                placeholder="Share fit, quality, comfort, delivery experience, and overall satisfaction."
                rows={5}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                style={{
                  ...reviewInputBase,
                  padding: "12px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, color: pageText }}>
                Review images
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  for (const file of files) {
                    await handleReviewImageUpload(file);
                  }
                  e.currentTarget.value = "";
                }}
                style={{
                  ...reviewInputBase,
                  padding: "10px 12px",
                }}
              />
              {reviewUploadError ? (
                <p style={{ margin: "8px 0 0", color: isLight ? "#dc2626" : "#f87171", fontSize: "12px" }}>
                  {reviewUploadError}
                </p>
              ) : null}

              {reviewImages.length ? (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                  {reviewImages.map((img, uploadIdx) => (
                    <img
                      key={`review-upload-preview-${uploadIdx}`}
                      src={optimizeImageUrl(img, 200, 200)}
                      alt="review upload"
                      style={{
                        width: "56px",
                        height: "56px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        border: subtleBorder,
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={submitReview}
              disabled={!canSubmitReview}
              style={{
                minHeight: "42px",
                borderRadius: "12px",
                border: "none",
                background: accentColor,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: canSubmitReview ? "pointer" : "not-allowed",
                boxShadow: isLight
                  ? "0 12px 24px rgba(37,99,235,0.20)"
                  : "0 12px 24px rgba(37,99,235,0.24)",
                opacity: canSubmitReview ? 1 : 0.65,
              }}
            >
              {reviewSubmitting ? "Submitting..." : "Submit review"}
            </button>

            {reviewMessage ? (
              <p style={{ margin: 0, fontSize: "12px", color: mutedText }}>{reviewMessage}</p>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {reviews.length === 0 ? (
              <div
                style={{
                  borderRadius: "16px",
                  border: subtleBorder,
                  background: reviewCardBg,
                  padding: "14px",
                  color: mutedText,
                  fontSize: "13px",
                }}
              >
                No reviews yet.
              </div>
            ) : (
              <>
                {reviews.slice(0, visibleReviewsCount).map((review, index) => (
                  <div
                    key={review.id || `${review.customer_name || "customer"}-${index}`}
                    style={{
                      borderRadius: "16px",
                      border: subtleBorder,
                      background: reviewCardBg,
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: pageText,
                            marginBottom: "4px",
                          }}
                        >
                          {review.customer_name || "Customer"}
                        </div>
                        <div style={{ color: "#f59e0b", fontSize: "12px", letterSpacing: "0.04em" }}>
                          {"★".repeat(review.rating)}
                          {"☆".repeat(5 - review.rating)}
                        </div>
                      </div>

                      <span style={{ fontSize: "11px", color: subtleText, fontWeight: 600 }}>
                        {review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: pageText,
                        marginBottom: "6px",
                      }}
                    >
                      Review
                    </div>

                    <p style={{ margin: 0, color: mutedText, fontSize: "13px", lineHeight: 1.68 }}>
                      {review.review_text}
                    </p>

                    {Array.isArray(review.review_images) && review.review_images.length > 0 ? (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                        {review.review_images.map((img, imgIdx) => {
                          const resolvedImgUrl = optimizeImageUrl(img, 400, 400);
                          return (
                            <button
                              key={`review-image-${imgIdx}`}
                              type="button"
                              onClick={() => setReviewPreviewModalImage(resolvedImgUrl)}
                              title="Click to zoom image"
                              style={{
                                padding: 0,
                                border: subtleBorder,
                                borderRadius: "10px",
                                overflow: "hidden",
                                cursor: "pointer",
                                background: "transparent",
                                width: "64px",
                                height: "64px",
                                flexShrink: 0,
                              }}
                            >
                              <img
                                src={resolvedImgUrl}
                                alt="Customer review attachment"
                                loading="lazy"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}

                {(reviews.length > 4 || hasMoreReviews || reviewCount > reviews.length) && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                    {visibleReviewsCount < reviews.length || hasMoreReviews || reviewCount > reviews.length ? (
                      <button
                        type="button"
                        onClick={handleLoadMoreReviews}
                        disabled={loadingMoreReviews}
                        style={{
                          width: "100%",
                          padding: "11px 18px",
                          borderRadius: "12px",
                          border: subtleBorder,
                          background: isLight ? "#ffffff" : "rgba(255,255,255,0.06)",
                          color: pageText,
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: loadingMoreReviews ? "not-allowed" : "pointer",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          transition: "all 0.15s ease",
                          opacity: loadingMoreReviews ? 0.7 : 1,
                        }}
                      >
                        {loadingMoreReviews ? (
                          <span>Loading reviews...</span>
                        ) : (
                          <>
                            <span>
                              View more reviews
                              {reviewCount > visibleReviewsCount
                                ? ` (${reviewCount - visibleReviewsCount} remaining)`
                                : ""}
                            </span>
                            <span>↓</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setVisibleReviewsCount(4);
                          document.getElementById("reviews-section")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        style={{
                          width: "100%",
                          padding: "11px 18px",
                          borderRadius: "12px",
                          border: subtleBorder,
                          background: isLight ? "#ffffff" : "rgba(255,255,255,0.06)",
                          color: pageText,
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>Show fewer reviews</span>
                        <span>↑</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )}
      {/* Review Image Preview Lightbox Modal */}
      {reviewPreviewModalImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setReviewPreviewModalImage(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setReviewPreviewModalImage(null)}
              title="Close image"
              style={{
                position: "absolute",
                top: "-42px",
                right: "0px",
                background: "rgba(255, 255, 255, 0.2)",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                color: "#ffffff",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <img
              src={reviewPreviewModalImage}
              alt="Review full photo"
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                borderRadius: "16px",
                objectFit: "contain",
                boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </div>
      )}

      {/* Share Product Modal - Dynamically Themed & Clean Vector Logos */}
      {showShareModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              background: panelBg,
              color: pageText,
              borderRadius: "22px",
              padding: "24px 22px",
              width: "100%",
              maxWidth: "430px",
              boxShadow: isPanelDark
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.12)"
                : "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)",
              border: subtleBorder,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "10px",
                    background: isPanelDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
                    color: accentColor,
                  }}
                >
                  <LinkChainIcon size={16} color={accentColor} />
                </span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: pageText, letterSpacing: "-0.02em" }}>
                  Share Product
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{
                  background: isPanelDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
                  border: "none",
                  fontSize: "14px",
                  color: mutedText,
                  cursor: "pointer",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  transition: "opacity 0.15s ease",
                }}
              >
                ✕
              </button>
            </div>

            {/* Mini Product Card Preview */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "12px",
                background: softSectionBg,
                border: subtleBorder,
                marginBottom: "16px",
              }}
            >
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt={product.name}
                  style={{ width: "46px", height: "46px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: pageText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {product.name}
                </div>
                <div style={{ fontSize: "12.5px", fontWeight: 800, color: accentColor, marginTop: "2px" }}>
                  ₹{effectivePrice.toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Social Quick Share Tiles with Official Logos */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${product.name} (₹${effectivePrice}): ` + getProductShareUrl())}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 4px",
                  borderRadius: "14px",
                  background: isPanelDark ? "rgba(37, 211, 102, 0.12)" : "#f0fdf4",
                  border: `1px solid ${isPanelDark ? "rgba(37, 211, 102, 0.28)" : "rgba(37, 211, 102, 0.35)"}`,
                  textDecoration: "none",
                  transition: "transform 0.15s ease",
                }}
              >
                <WhatsAppOfficialIcon size={22} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: isPanelDark ? "#4ade80" : "#15803d" }}>WhatsApp</span>
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(getProductShareUrl())}&text=${encodeURIComponent(`Check out ${product.name} for ₹${effectivePrice}!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 4px",
                  borderRadius: "14px",
                  background: isPanelDark ? "rgba(34, 158, 217, 0.12)" : "#f0f9ff",
                  border: `1px solid ${isPanelDark ? "rgba(34, 158, 217, 0.28)" : "rgba(34, 158, 217, 0.35)"}`,
                  textDecoration: "none",
                  transition: "transform 0.15s ease",
                }}
              >
                <TelegramOfficialIcon size={22} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: isPanelDark ? "#38bdf8" : "#0284c7" }}>Telegram</span>
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${product.name} for ₹${effectivePrice}!`)}&url=${encodeURIComponent(getProductShareUrl())}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 4px",
                  borderRadius: "14px",
                  background: isPanelDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.04)",
                  border: subtleBorder,
                  textDecoration: "none",
                  transition: "transform 0.15s ease",
                }}
              >
                <XTwitterOfficialIcon size={19} color={pageText} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: pageText }}>X / Twitter</span>
              </a>

              <a
                href={`mailto:?subject=${encodeURIComponent(`Check out ${product.name}`)}&body=${encodeURIComponent(`I thought you might like this product: ${product.name} (₹${effectivePrice})\n\n${getProductShareUrl()}`)}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 4px",
                  borderRadius: "14px",
                  background: isPanelDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2",
                  border: `1px solid ${isPanelDark ? "rgba(239, 68, 68, 0.28)" : "rgba(239, 68, 68, 0.35)"}`,
                  textDecoration: "none",
                  transition: "transform 0.15s ease",
                }}
              >
                <EmailOfficialIcon size={20} color={isPanelDark ? "#f87171" : "#dc2626"} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: isPanelDark ? "#f87171" : "#dc2626" }}>Email</span>
              </a>
            </div>

            {/* Copy Link Input Bar */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                readOnly
                value={getProductShareUrl()}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: subtleBorder,
                  background: isPanelDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)",
                  color: pageText,
                  fontSize: "12px",
                  outline: "none",
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={() => copyToClipboard(getProductShareUrl())}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  background: copiedLink ? "#16a34a" : accentColor,
                  color: activeBtnTextColor || "#ffffff",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  whiteSpace: "nowrap",
                  boxShadow: copiedLink ? "0 2px 8px rgba(22, 163, 74, 0.3)" : "0 2px 8px rgba(0,0,0,0.12)",
                }}
              >
                {copiedLink ? (
                  <>
                    <span>✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <LinkChainIcon size={14} color={activeBtnTextColor || "#ffffff"} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            {/* System / More Share Options */}
            {typeof navigator !== "undefined" && navigator.share && (
              <button
                type="button"
                onClick={handleNativeShare}
                style={{
                  marginTop: "12px",
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  background: isPanelDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
                  border: subtleBorder,
                  color: mutedText,
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>More Device Share Options</span>
              </button>
            )}
          </div>
        </div>
      )}
      {/* Attached Bottom Purchase Bar on Mobile (Zero corner radius, perfectly aligned with card buttons) */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            width: "100%",
            zIndex: 9999,
            padding: "12px 26px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderRadius: "0",
            background: isPanelDark ? "rgba(30, 41, 59, 0.98)" : "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderTop: subtleBorder,
            borderLeft: "none",
            borderRight: "none",
            borderBottom: "none",
            boxShadow: isPanelDark
              ? "0 -10px 30px rgba(0,0,0,0.55)"
              : "0 -6px 24px rgba(15,23,42,0.09)",
            display: "grid",
            gridTemplateColumns: buyGridColumns,
            gap: "12px",
            alignItems: "center",
            transform: showBottomSticky ? "translateY(0)" : "translateY(110%)",
            opacity: showBottomSticky ? 1 : 0,
            pointerEvents: showBottomSticky ? "auto" : "none",
            transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 40px",
              alignItems: "center",
              minHeight: "46px",
              borderRadius: "15px",
              border: strongerBorder,
              background: elevatedBg,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              style={{
                height: "46px",
                border: "none",
                borderRight: subtleBorder,
                background: "transparent",
                color: mutedText,
                fontSize: "18px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              −
            </button>

            <div style={{ textAlign: "center", fontSize: "14px", fontWeight: 700, color: pageText }}>
              {quantity}
            </div>

            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() =>
                setQuantity((current) => {
                  if (typeof maxAllowedQty === "number") {
                    return Math.min(maxAllowedQty, current + 1);
                  }
                  return current + 1;
                })
              }
              disabled={
                selectedVariantOutOfStock ||
                isEntireProductOutOfStock ||
                isCartLimitReached ||
                isAtMaxQty
              }
              style={{
                height: "46px",
                border: "none",
                borderLeft: subtleBorder,
                background: "transparent",
                color:
                  selectedVariantOutOfStock ||
                  isEntireProductOutOfStock ||
                  isCartLimitReached ||
                  isAtMaxQty
                    ? subtleText
                    : mutedText,
                fontSize: "18px",
                fontWeight: 700,
                cursor:
                  selectedVariantOutOfStock ||
                  isEntireProductOutOfStock ||
                  isCartLimitReached ||
                  isAtMaxQty
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  selectedVariantOutOfStock ||
                  isEntireProductOutOfStock ||
                  isCartLimitReached ||
                  isAtMaxQty
                    ? 0.5
                    : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!finalCanAddToCart}
            style={{
              width: "100%",
              minHeight: "46px",
              padding: "12px 16px",
              borderRadius: "15px",
              border: "none",
              background: !finalCanAddToCart
                ? "#94a3b8"
                : added
                ? "#16a34a"
                : activeBtnBg,
              color: activeBtnTextColor,
              cursor: finalCanAddToCart ? "pointer" : "not-allowed",
              fontWeight: 700,
              fontSize: "14px",
              letterSpacing: "0.01em",
              boxShadow: finalCanAddToCart
                ? added
                  ? "0 12px 24px rgba(22,163,74,0.20)"
                  : isLight
                  ? "0 12px 24px rgba(37,99,235,0.20)"
                  : "0 12px 24px rgba(37,99,235,0.24)"
                : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!finalCanAddToCart
              ? isEntireProductOutOfStock
                ? "Out of stock"
                : selectedVariantOutOfStock
                ? `${selectedOption || optionLabel} is out of stock`
                : isCartLimitReached
                ? "Already added"
                : `Select ${optionLabel}`
              : added
              ? "Added to cart"
              : resolvedAddToCartText}
          </button>
        </div>
      )}
    </section>
  );
};

export default ProductDetail;