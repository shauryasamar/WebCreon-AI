import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "../CartContext";
import { API_BASE_URL } from "../config/api";
import GlassToast from "./GlassToast";
import { generateSectionFilterUrl } from "./ProductCarousel";
import { optimizeImageUrl, getThumbnailUrl, compressImageFile } from "../utils/imageOptimizer";

export interface SectionGroupTileItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  link?: string;
  category?: string;
  brand?: string;
  collection_id?: string;
  product_type?: string;
  sort_by?: "bestseller" | "rating_desc" | "newest" | "price_asc" | "price_desc" | "discount_desc";
  min_price?: number;
  max_price?: number;
  in_stock_only?: boolean;
}

export interface HomeSectionItem {
  id: string;
  type: "product_carousel" | "section_group_carousel";
  title: string;
  subtitle?: string;
  viewAllLink?: string;
  layout?: "carousel" | "grid";
  cardShape?: "portrait" | "horizontal" | "square" | "circle" | "pill";
  cardStyle?: "default" | "fashion" | "electronics" | "beauty" | "grocery" | "standard" | string;
  limit?: number;
  isActive: boolean;
  order: number;
  rules: {
    category?: string;
    categories?: string[];
    brand?: string;
    brands?: string[];
    collection_id?: string;
    collection_ids?: string[];
    product_type?: string;
    product_types?: string[];
    min_price?: number;
    max_price?: number;
    in_stock_only?: boolean;
    sort_by?: "bestseller" | "rating_desc" | "newest" | "price_asc" | "price_desc" | "discount_desc";
    selected_product_ids?: string[];
  };
  items?: SectionGroupTileItem[];
}

interface CollectionOption {
  id: string;
  name: string;
  slug?: string;
  is_badge?: boolean;
  badge_color?: string;
}

const plainCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "4px",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid #f1f5f9",
  fontSize: "13px",
  color: "#0f172a",
  verticalAlign: "middle",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: "12.5px",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: "12.5px",
  cursor: "pointer",
};

// Clean SVG Icons (no emojis)
const SearchIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const LayersIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const UploadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: "grab", color: "#94a3b8", flexShrink: 0 }}>
    <circle cx="9" cy="5" r="1" fill="#94a3b8" />
    <circle cx="9" cy="12" r="1" fill="#94a3b8" />
    <circle cx="9" cy="19" r="1" fill="#94a3b8" />
    <circle cx="15" cy="5" r="1" fill="#94a3b8" />
    <circle cx="15" cy="12" r="1" fill="#94a3b8" />
    <circle cx="15" cy="19" r="1" fill="#94a3b8" />
  </svg>
);

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.2s ease",
      color: "#64748b",
      flexShrink: 0,
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ToggleSwitch = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) => {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      style={{
        width: "32px",
        height: "18px",
        borderRadius: "999px",
        backgroundColor: checked ? "#16a34a" : "#cbd5e1",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background-color 0.2s ease",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          position: "absolute",
          top: "2px",
          left: checked ? "16px" : "2px",
          transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
        }}
      />
    </div>
  );
};

export const AdminHomeSections: React.FC = () => {
  const { siteId } = useParams();
  const { products: cartProducts } = useCart();
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const [sections, setSections] = useState<HomeSectionItem[]>([]);
  const [siteSlug, setSiteSlug] = useState<string>("");
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [heroBannerActive, setHeroBannerActive] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");

  // Tab Filtering
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "product_carousel" | "section_group_carousel">("all");

  // Rich Filter Popover States
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "product_carousel" | "section_group_carousel">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "hidden">("all");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterCollection, setFilterCollection] = useState<string>("");
  const [filterCardShape, setFilterCardShape] = useState<string>("all");
  const [filterLayout, setFilterLayout] = useState<string>("all");

  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Modal State for Add / Edit
  const [editingModalOpen, setEditingModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<HomeSectionItem | null>(null);
  const [uploadingTileIndex, setUploadingTileIndex] = useState<number | null>(null);
  const [expandedTileIds, setExpandedTileIds] = useState<Set<string>>(new Set());

  // Drag and Drop States for Main Table & Modal Tiles
  const [draggedTileIndex, setDraggedTileIndex] = useState<number | null>(null);
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);

  // Effective products list (allProducts or cartProducts fallback)
  const products = useMemo(() => {
    return allProducts.length > 0 ? allProducts : cartProducts;
  }, [allProducts, cartProducts]);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowFilterPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extract unique categories and brands from product inventory
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Load site definition, products, and sections from Backend API
  useEffect(() => {
    if (!siteId) return;

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Products
        try {
          const prodRes = await fetch(
            `${API_BASE_URL}/sites/${siteId}/products/public?page=1&page_size=1000`
          );
          if (prodRes.ok) {
            const prodData = await prodRes.json();
            const rawList = Array.isArray(prodData)
              ? prodData
              : Array.isArray(prodData?.items)
              ? prodData.items
              : [];
            if (rawList.length > 0) {
              setAllProducts(rawList);
            }
          }
        } catch (_) {}

        // 2. Fetch Collections
        try {
          const colRes = await fetch(`${API_BASE_URL}/sites/${siteId}/collections`, {
            credentials: "include",
          });
          if (colRes.ok) {
            const cols = await colRes.json();
            setCollections(Array.isArray(cols) ? cols : cols.collections || []);
          }
        } catch (_) {}

        // 3. Fetch Site from Backend
        let siteDef: any = null;
        try {
          const siteRes = await fetch(`${API_BASE_URL}/sites/${siteId}?t=${Date.now()}`, {
            credentials: "include",
          });
          if (siteRes.ok) {
            const siteData = await siteRes.json();
            if (siteData.slug) setSiteSlug(siteData.slug);
            siteDef = siteData.draft_definition || siteData.site_definition;
          }
        } catch (_) {}

        // Fallback to local snapshot if backend fetch fails
        if (!siteDef) {
          const savedDraft =
            localStorage.getItem(`wc_site_snapshot_${siteId}`) ||
            sessionStorage.getItem(`wc_site_snapshot_${siteId}`);
          if (savedDraft) {
            try {
              const parsed = JSON.parse(savedDraft);
              if (parsed.slug) setSiteSlug(parsed.slug);
              siteDef = parsed.draft_definition || parsed.site_definition || parsed;
            } catch (_) {}
          }
        }

        let loadedSections: HomeSectionItem[] = [];
        if (siteDef) {
          const homePage = (siteDef.pages || []).find((p: any) => p.id === "home" || p.route === "/");
          if (homePage && Array.isArray(homePage.blocks)) {
            // Read Hero Banner status
            const heroBlock = homePage.blocks.find(
              (b: any) =>
                b.type === "hero_banner" ||
                b.type === "herobanner" ||
                b.type === "banner"
            );
            if (heroBlock) {
              setHeroBannerActive(
                heroBlock.props?.isActive !== false &&
                heroBlock.isActive !== false &&
                heroBlock.hidden !== true &&
                heroBlock.props?.hidden !== true
              );
            }

            const dynamicBlocks = homePage.blocks.filter(
              (b: any) =>
                b.type === "product_carousel" ||
                b.type === "section_group_carousel"
            );

            loadedSections = dynamicBlocks.map((b: any, index: number) => ({
              id: b.id || `sec_${Date.now()}_${index}`,
              type: b.type === "section_group_carousel" ? "section_group_carousel" : "product_carousel",
              title: b.props?.title || b.name || "Featured Section",
              subtitle: b.props?.subtitle || "",
              viewAllLink: b.props?.viewAllLink || "",
              layout: b.props?.layout || "carousel",
              cardShape: b.props?.cardShape || "portrait",
              cardStyle: b.props?.cardStyle || "default",
              limit: b.props?.limit || 10,
              isActive: b.props?.isActive !== false,
              order: index + 1,
              rules: b.props?.rules || {
                category: b.props?.categoryName,
                collection_id: b.props?.collectionId,
                brand: b.props?.brandName,
                sort_by: b.props?.sortBy || "newest",
              },
              items: Array.isArray(b.props?.items) ? b.props.items : [],
            }));
          }
        }

        setSections(loadedSections);
      } catch (err) {
        console.error("Error loading home sections:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [siteId]);

  // Helper: Count matching products for rule preview
  const countMatchingProducts = useCallback(
    (rules?: Partial<HomeSectionItem["rules"]> | Partial<SectionGroupTileItem>) => {
      if (!rules) return products.length;
      let list = [...products];

      if ((rules as any).selected_product_ids && (rules as any).selected_product_ids.length > 0) {
        list = list.filter((p) => (rules as any).selected_product_ids!.includes(String(p.id)));
      }
      if (rules.category) {
        list = list.filter((p) => p.category?.toLowerCase() === rules.category!.toLowerCase());
      }
      if (rules.brand) {
        list = list.filter((p) => p.brand?.toLowerCase() === rules.brand!.toLowerCase());
      }
      if (rules.collection_id) {
        list = list.filter((p: any) =>
          (p.collections || []).some((c: any) => (c.id || c.collection_id) === rules.collection_id)
        );
      }
      if (rules.min_price !== undefined && rules.min_price !== null) {
        list = list.filter((p) => Number(p.price) >= rules.min_price!);
      }
      if (rules.max_price !== undefined && rules.max_price !== null) {
        list = list.filter((p) => Number(p.price) <= rules.max_price!);
      }
      if (rules.in_stock_only) {
        list = list.filter((p) => p.in_stock !== false);
      }

      return list.length;
    },
    [products]
  );

  // Handle Tile Image Upload with Client-Side Compression
  const handleTileImageUpload = async (file: File, tileIdx: number) => {
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      alert("Only PNG, JPG, JPEG, and WEBP image formats are supported.");
      return;
    }

    setUploadingTileIndex(tileIdx);
    try {
      const compressed = await compressImageFile(file, 1200, 1200, 0.82);

      const formData = new FormData();
      formData.append("file", compressed);

      let finalUrl = "";
      try {
        const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products/upload-image`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          finalUrl = optimizeImageUrl(data.url);
        }
      } catch (_) {}

      if (!finalUrl) {
        finalUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(compressed);
        });
      }

      if (activeSection) {
        const next = [...(activeSection.items || [])];
        next[tileIdx] = { ...next[tileIdx], imageUrl: finalUrl };
        setActiveSection({ ...activeSection, items: next });
      }
    } catch (err) {
      console.error("Tile image compression failed:", err);
      alert("Failed to process image.");
    } finally {
      setUploadingTileIndex(null);
    }
  };

  // Drag and Drop Handler for Category Cards (Modal)
  const handleDragStart = (index: number) => {
    setDraggedTileIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedTileIndex === null || draggedTileIndex === targetIndex || !activeSection) return;
    const list = [...(activeSection.items || [])];
    const [removed] = list.splice(draggedTileIndex, 1);
    list.splice(targetIndex, 0, removed);
    setActiveSection({ ...activeSection, items: list });
    setDraggedTileIndex(null);
  };

  const toggleTileAccordion = (id: string) => {
    setExpandedTileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Drag and Drop Handler for Main Table Rows (Home Sections)
  const handleSectionDragStart = (index: number) => {
    setDraggedSectionIndex(index);
  };

  const handleSectionDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverSectionIndex !== index) {
      setDragOverSectionIndex(index);
    }
  };

  const handleSectionDrop = (targetIndex: number) => {
    if (draggedSectionIndex === null || draggedSectionIndex === targetIndex) {
      setDraggedSectionIndex(null);
      setDragOverSectionIndex(null);
      return;
    }
    const next = [...sections];
    const [moved] = next.splice(draggedSectionIndex, 1);
    next.splice(targetIndex, 0, moved);
    next.forEach((item, idx) => (item.order = idx + 1));
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
    handleSaveSections(next);
  };

  // Save changes to Site Definition and permanently sync to backend
  const handleSaveSections = async (
    updatedList: HomeSectionItem[],
    heroActive: boolean = heroBannerActive
  ) => {
    if (!siteId) return;
    setSaving(true);
    try {
      const snapshotKey = `wc_site_snapshot_${siteId}`;
      const rawSnapshot = localStorage.getItem(snapshotKey) || sessionStorage.getItem(snapshotKey);
      let snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : { site_definition: { pages: [] } };
      let siteDef = snapshot.draft_definition || snapshot.site_definition || { pages: [] };

      if (!Array.isArray(siteDef.pages)) {
        siteDef.pages = [];
      }

      let homePage = siteDef.pages.find((p: any) => p.id === "home" || p.route === "/");
      if (!homePage) {
        homePage = {
          id: "home",
          name: "Home",
          route: "/",
          blocks: [],
        };
        siteDef.pages.unshift(homePage);
      }

      const existingBlocks: any[] = Array.isArray(homePage.blocks) ? homePage.blocks : [];

      const navbarBlock = existingBlocks.find((b: any) => b.type === "navbar") || {
        id: "navbar",
        type: "navbar",
        name: "Navbar",
      };

      let heroBlock = existingBlocks.find(
        (b: any) =>
          b.type === "hero_banner" ||
          b.type === "herobanner" ||
          b.type === "banner"
      );
      if (heroBlock) {
        heroBlock = {
          ...heroBlock,
          props: {
            ...(heroBlock.props || {}),
            isActive: heroActive,
            hidden: !heroActive,
          },
          isActive: heroActive,
          hidden: !heroActive,
        };
      } else {
        heroBlock = {
          id: "hero_banner",
          type: "hero_banner",
          name: "Hero Banner",
          props: { isActive: heroActive, hidden: !heroActive },
          isActive: heroActive,
          hidden: !heroActive,
        };
      }

      const productGridBlock = existingBlocks.find(
        (b: any) => b.type === "product_grid" || b.type === "productgrid"
      ) || {
        id: "product_grid",
        type: "product_grid",
        name: "All Products",
      };
      const footerBlock = existingBlocks.find((b: any) => b.type === "footer") || {
        id: "footer",
        type: "footer",
        name: "Footer",
      };

      // Map user custom sections
      const dynamicSectionBlocks = updatedList.map((sec) => ({
        id: sec.id,
        type: sec.type,
        name: sec.title,
        props: {
          title: sec.title,
          subtitle: sec.subtitle,
          viewAllLink: sec.viewAllLink,
          layout: sec.layout,
          cardShape: sec.cardShape,
          cardStyle: sec.cardStyle,
          card_style: sec.cardStyle,
          limit: sec.limit,
          rules: sec.rules,
          items: sec.items || [],
          isActive: sec.isActive,
        },
      }));

      // Hierarchy: Navbar -> Hero Banner -> User Custom Sections -> Product Grid -> Footer
      homePage.blocks = [
        navbarBlock,
        heroBlock,
        ...dynamicSectionBlocks,
        productGridBlock,
        footerBlock,
      ];

      snapshot.draft_definition = siteDef;
      snapshot.site_definition = siteDef;
      snapshot.updated_at = new Date().toISOString();

      localStorage.setItem(`wc_site_snapshot_${siteId}`, JSON.stringify(snapshot));
      if (siteSlug) {
        localStorage.setItem(`wc_site_snapshot_${siteSlug}`, JSON.stringify(snapshot));
      }

      // 1. Sync to backend database via PUT
      try {
        await fetch(`${API_BASE_URL}/sites/${siteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            slug: siteSlug || siteId,
            site_definition: siteDef,
            draft_definition: siteDef,
          }),
        });
      } catch (backendErr) {
        console.warn("Backend sync notice:", backendErr);
      }

      // 2. Broadcast realtime event to storefront preview
      window.dispatchEvent(
        new CustomEvent("wc_site_definition_updated", {
          detail: { siteId, siteDefinition: siteDef },
        })
      );

      setToastMessage("Home sections updated successfully!");
      setToastType("success");
      setSections(updatedList);
    } catch (err) {
      console.error("Failed to save sections:", err);
      setToastMessage("Failed to save sections. Please try again.");
      setToastType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHeroBanner = async (newVal: boolean) => {
    setHeroBannerActive(newVal);
    await handleSaveSections(sections, newVal);
  };

  const toggleActive = (id: string) => {
    const next = sections.map((sec) =>
      sec.id === id ? { ...sec, isActive: !sec.isActive } : sec
    );
    handleSaveSections(next);
  };

  const deleteSection = (id: string) => {
    if (!window.confirm("Are you sure you want to remove this section from the Home screen?")) return;
    const next = sections.filter((s) => s.id !== id);
    next.forEach((item, idx) => (item.order = idx + 1));
    handleSaveSections(next);
  };

  const handleAddNew = () => {
    const newSection: HomeSectionItem = {
      id: `sec_${Date.now()}`,
      type: "product_carousel",
      title: "",
      subtitle: "",
      viewAllLink: "",
      layout: "carousel",
      cardShape: "portrait",
      limit: 10,
      isActive: true,
      order: sections.length + 1,
      rules: {
        sort_by: "bestseller",
      },
      items: [],
    };
    setActiveSection(newSection);
    setExpandedTileIds(new Set());
    setEditingModalOpen(true);
  };

  const handleEdit = (sec: HomeSectionItem) => {
    setActiveSection(JSON.parse(JSON.stringify(sec)));
    if (sec.type === "section_group_carousel" && (sec.items || []).length > 0) {
      setExpandedTileIds(new Set([sec.items![0].id]));
    } else {
      setExpandedTileIds(new Set());
    }
    setEditingModalOpen(true);
  };

  const handleSaveModal = () => {
    if (!activeSection) return;
    if (activeSection.type === "product_carousel" && !activeSection.title.trim()) {
      alert("Please enter a section title");
      return;
    }

    const effectiveTitle = activeSection.title.trim() || (activeSection.type === "section_group_carousel" ? "" : "Featured Products");
    const sectionToSave = {
      ...activeSection,
      title: effectiveTitle,
    };

    const exists = sections.some((s) => s.id === activeSection.id);
    let next: HomeSectionItem[];
    if (exists) {
      next = sections.map((s) => (s.id === activeSection.id ? sectionToSave : s));
    } else {
      next = [...sections, sectionToSave];
    }
    next.forEach((item, idx) => (item.order = idx + 1));

    setEditingModalOpen(false);
    setActiveSection(null);
    handleSaveSections(next);
  };

  // Filter sections by search, tabs, and rich popover filters
  const displayedSections = useMemo(() => {
    return sections.filter((sec) => {
      // 1. Tab Filter
      if (statusFilter === "active" && !sec.isActive) return false;
      if (statusFilter === "hidden" && sec.isActive) return false;
      if (statusFilter === "product_carousel" && sec.type !== "product_carousel") return false;
      if (statusFilter === "section_group_carousel" && sec.type !== "section_group_carousel") return false;

      // 2. Popover Filters
      if (filterType !== "all" && sec.type !== filterType) return false;
      if (filterStatus === "active" && !sec.isActive) return false;
      if (filterStatus === "hidden" && sec.isActive) return false;
      if (filterLayout !== "all" && (sec.layout || "carousel") !== filterLayout) return false;
      if (filterCardShape !== "all" && (sec.cardShape || "portrait") !== filterCardShape) return false;

      if (filterCategory) {
        const matchesCategory =
          sec.rules?.category === filterCategory ||
          (sec.items || []).some((t) => t.category === filterCategory);
        if (!matchesCategory) return false;
      }

      if (filterBrand) {
        const matchesBrand =
          sec.rules?.brand === filterBrand ||
          (sec.items || []).some((t) => t.brand === filterBrand);
        if (!matchesBrand) return false;
      }

      if (filterCollection) {
        const matchesCollection =
          sec.rules?.collection_id === filterCollection ||
          (sec.items || []).some((t) => t.collection_id === filterCollection);
        if (!matchesCollection) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = sec.title.toLowerCase().includes(q);
        const matchesSubtitle = Boolean(sec.subtitle && sec.subtitle.toLowerCase().includes(q));
        const matchesCategory = Boolean(sec.rules?.category && sec.rules.category.toLowerCase().includes(q));
        const matchesBrand = Boolean(sec.rules?.brand && sec.rules.brand.toLowerCase().includes(q));
        const matchesTiles = (sec.items || []).some(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.subtitle && t.subtitle.toLowerCase().includes(q)) ||
            (t.category && t.category.toLowerCase().includes(q))
        );
        if (!matchesTitle && !matchesSubtitle && !matchesCategory && !matchesBrand && !matchesTiles) {
          return false;
        }
      }

      return true;
    });
  }, [
    sections,
    statusFilter,
    filterType,
    filterStatus,
    filterLayout,
    filterCardShape,
    filterCategory,
    filterBrand,
    filterCollection,
    searchQuery,
  ]);

  // Counts for KPI Stat Cards and Tabs
  const totalSectionsCount = sections.length;
  const activeCount = sections.filter((s) => s.isActive).length;
  const hiddenCount = sections.filter((s) => !s.isActive).length;
  const productCarouselCount = sections.filter((s) => s.type === "product_carousel").length;
  const categoryCarouselCount = sections.filter((s) => s.type === "section_group_carousel").length;

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterType !== "all") count++;
    if (filterStatus !== "all") count++;
    if (filterCategory) count++;
    if (filterBrand) count++;
    if (filterCollection) count++;
    if (filterCardShape !== "all") count++;
    if (filterLayout !== "all") count++;
    return count;
  }, [filterType, filterStatus, filterCategory, filterBrand, filterCollection, filterCardShape, filterLayout]);

  const resetAllFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
    setFilterCategory("");
    setFilterBrand("");
    setFilterCollection("");
    setFilterCardShape("all");
    setFilterLayout("all");
  };

  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {toastMessage && (
        <GlassToast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* 1. Top Header Card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative",
        }}
      >
        {/* Row 1: Mode Switcher + Global Search + Filter Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill (Home Sections) */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              style={{
                borderRadius: "6px",
                padding: "6px 16px",
                border: "none",
                background: "#ffffff",
                color: "#0f172a",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "default",
                textTransform: "capitalize",
                transition: "all 0.15s ease",
              }}
            >
              Home Sections
            </button>
          </div>

          {/* Search Bar & Filter Button Container */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: "1 1 300px",
              maxWidth: "520px",
              position: "relative",
            }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <div
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <SearchIcon />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sections by title, category, brand..."
                style={{
                  ...inputStyle,
                  paddingLeft: "34px",
                  paddingRight: searchQuery ? "28px" : "12px",
                  fontSize: "13px",
                  height: "36px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: "2px",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title="Clear search"
                >
                  <XMarkIcon />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <div style={{ position: "relative" }} ref={filterPopoverRef}>
              <button
                type="button"
                onClick={() => setShowFilterPopover(!showFilterPopover)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "7px",
                  border: activeFilterCount > 0 ? "1px solid #93c5fd" : "1px solid #cbd5e1",
                  background: activeFilterCount > 0 ? "#eff6ff" : "#ffffff",
                  color: activeFilterCount > 0 ? "#1d4ed8" : "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
                title="Toggle Filters"
              >
                <FilterIcon />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "#2563eb",
                      color: "#ffffff",
                      borderRadius: "10px",
                      padding: "0 6px",
                      marginLeft: "2px",
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Rich Filter Popover Dropdown */}
              {showFilterPopover && (
                <div
                  style={{
                    position: "absolute",
                    top: "44px",
                    right: 0,
                    width: "320px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    padding: "16px",
                    zIndex: 60,
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxHeight: "85vh",
                    overflowY: "auto",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Filter Home Sections</span>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  {/* Filter by Section Type */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Section Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as any)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    >
                      <option value="all">All Types</option>
                      <option value="product_carousel">Products Rows</option>
                      <option value="section_group_carousel">Visual Collection Cards</option>
                    </select>
                  </div>

                  {/* Filter by Status */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active (Live on Store)</option>
                      <option value="hidden">Hidden / Inactive</option>
                    </select>
                  </div>

                  {/* Filter by Category */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Category</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    >
                      <option value="">All Categories</option>
                      {uniqueCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Brand */}
                  {uniqueBrands.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Brand</label>
                      <select
                        value={filterBrand}
                        onChange={(e) => setFilterBrand(e.target.value)}
                        style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                      >
                        <option value="">All Brands</option>
                        {uniqueBrands.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Filter by Collection */}
                  {collections.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Collection</label>
                      <select
                        value={filterCollection}
                        onChange={(e) => setFilterCollection(e.target.value)}
                        style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                      >
                        <option value="">All Collections</option>
                        {collections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name} {col.is_badge ? "(Badge)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Card Visual Style */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Card Style</label>
                    <select
                      value={filterCardShape}
                      onChange={(e) => setFilterCardShape(e.target.value)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    >
                      <option value="all">All Styles</option>
                      <option value="portrait">Portrait</option>
                      <option value="horizontal">Horizontal (Landscape)</option>
                      <option value="square">Square</option>
                      <option value="circle">Circle (Story)</option>
                      <option value="pill">Pill</option>
                    </select>
                  </div>

                  {/* Display Layout */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Display Layout</label>
                    <select
                      value={filterLayout}
                      onChange={(e) => setFilterLayout(e.target.value)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    >
                      <option value="all">All Layouts</option>
                      <option value="carousel">Horizontal Scroll Carousel</option>
                      <option value="grid">Multi-Column Grid</option>
                    </select>
                  </div>

                  {/* Apply / Close Button */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setShowFilterPopover(false)}
                      style={{ ...primaryButtonStyle, flex: 1, padding: "7px", fontSize: "12px" }}
                    >
                      Apply Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilterPopover(false)}
                      style={{ ...ghostButtonStyle, padding: "7px 12px", fontSize: "12px" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 5 Summary KPI Stat Boxes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "12px",
          width: "100%",
        }}
      >
        {/* Total Sections */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#334155", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {totalSectionsCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Total Sections
          </div>
        </div>

        {/* Active on Store */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#334155", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {activeCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Active on Store
          </div>
        </div>

        {/* Products Rows */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#16a34a", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {productCarouselCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Products Rows
          </div>
        </div>

        {/* Visual Collection Cards */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#d97706", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {categoryCarouselCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Collection Cards
          </div>
        </div>

        {/* Hidden / Inactive */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#ef4444", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {hiddenCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Hidden / Inactive
          </div>
        </div>
      </div>

      {/* 3. Underline Tab Bar with Hero Banner Toggle & + Add Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          gap: "16px",
          marginTop: "6px",
          flexWrap: "nowrap",
          minWidth: 0,
        }}
      >
        {/* Left: Tabs with Count Badges */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            overflowX: "auto",
            whiteSpace: "nowrap",
            flex: "1 1 auto",
            minWidth: 0,
            scrollbarWidth: "none",
          }}
        >
          {[
            { key: "all", label: "All Sections", count: totalSectionsCount },
            { key: "active", label: "Active (Live)", count: activeCount },
            { key: "hidden", label: "Hidden / Drafts", count: hiddenCount },
            { key: "product_carousel", label: "Products Rows", count: productCarouselCount },
            { key: "section_group_carousel", label: "Collection Cards", count: categoryCarouselCount },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  border: "none",
                  borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                  background: "transparent",
                  color: isActive ? "#2563eb" : "#64748b",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  marginBottom: "-1px",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: isActive ? "#dbeafe" : "#f1f5f9",
                    color: isActive ? "#1e40af" : "#64748b",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Hero Banner Toggle & + Add Section Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, paddingBottom: "6px" }}>
          {/* Hero Banner Toggle Control (Fixed width label so no shifts) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "4px 10px",
              height: "32px",
              boxSizing: "border-box",
              whiteSpace: "nowrap",
            }}
            title="Toggle Hero Banner on the Home Page"
          >
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
              Hero Banner:
            </span>
            <ToggleSwitch
              checked={heroBannerActive}
              onChange={(val) => handleToggleHeroBanner(val)}
              disabled={saving}
            />
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 600,
                color: heroBannerActive ? "#15803d" : "#64748b",
                width: "44px",
                display: "inline-block",
                textAlign: "left",
              }}
            >
              {heroBannerActive ? "Active" : "Hidden"}
            </span>
          </div>

          {/* + Add Section Primary Button */}
          <button
            type="button"
            onClick={handleAddNew}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "5px 13px",
              height: "32px",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
              boxSizing: "border-box",
            }}
          >
            <PlusIcon />
            <span>Add Section</span>
          </button>
        </div>
      </div>

      {/* 4. Table of Home Sections (Fully drag-and-drop enabled) */}
      <div style={{ ...plainCardStyle, overflow: "hidden", width: "100%" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
            Loading home sections...
          </div>
        ) : displayedSections.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ display: "grid", placeItems: "center", marginBottom: "8px" }}>
              <LayersIcon />
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              {searchQuery || activeFilterCount > 0 || statusFilter !== "all"
                ? "No matching home sections found"
                : "No Home Sections Created"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
              {searchQuery || activeFilterCount > 0 || statusFilter !== "all"
                ? "Try clearing search or filters to see all sections."
                : "Click '+ Add Section' to build product rows or visual collection cards."}
            </p>
            {searchQuery || activeFilterCount > 0 || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  resetAllFilters();
                  setStatusFilter("all");
                }}
                style={{
                  ...ghostButtonStyle,
                  fontSize: "13px",
                  padding: "7px 16px",
                }}
              >
                Clear Search & Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddNew}
                style={{
                  ...primaryButtonStyle,
                  fontSize: "13px",
                  padding: "8px 18px",
                }}
              >
                + Add Section
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "680px" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ ...thStyle, width: "65px" }}>ORDER</th>
                  <th style={{ ...thStyle, minWidth: "150px" }}>SECTION TITLE</th>
                  <th style={{ ...thStyle, width: "130px" }}>TYPE</th>
                  <th style={{ ...thStyle, minWidth: "120px" }}>TARGET / TILES</th>
                  <th style={{ ...thStyle, width: "75px" }}>ITEMS</th>
                  <th style={{ ...thStyle, width: "95px" }}>STATUS</th>
                  <th style={{ ...thStyle, width: "105px", textAlign: "right", paddingRight: "14px" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {displayedSections.map((sec, index) => {
                  const matchCount = sec.type === "product_carousel" ? countMatchingProducts(sec.rules) : (sec.items || []).length;
                  const secUrl = generateSectionFilterUrl(
                    sec.title,
                    sec.rules,
                    sec.viewAllLink,
                    sec.id
                  );

                  const tileCount = (sec.items || []).length;
                  let criteriaSummary = "All Products";
                  if (sec.type === "section_group_carousel") {
                    criteriaSummary = `${tileCount} Collection ${tileCount === 1 ? "Card" : "Cards"}`;
                  } else if (sec.rules.category) {
                    criteriaSummary = `Category: ${sec.rules.category}`;
                  } else if (sec.rules.brand) {
                    criteriaSummary = `Brand: ${sec.rules.brand}`;
                  } else if (sec.rules.collection_id) {
                    const colName = collections.find((c) => c.id === sec.rules.collection_id)?.name;
                    criteriaSummary = `Collection: ${colName || "Selected"}`;
                  } else if (sec.rules.sort_by) {
                    criteriaSummary = `Sort: ${sec.rules.sort_by}`;
                  }

                  const isDraggingThis = draggedSectionIndex === index;
                  const isDragOverThis = dragOverSectionIndex === index;

                  return (
                    <tr
                      key={sec.id}
                      draggable
                      onDragStart={() => handleSectionDragStart(index)}
                      onDragOver={(e) => handleSectionDragOver(e, index)}
                      onDrop={() => handleSectionDrop(index)}
                      style={{
                        background: isDragOverThis ? "#eff6ff" : sec.isActive ? "#ffffff" : "#fafafa",
                        borderTop: isDragOverThis ? "2px solid #2563eb" : undefined,
                        opacity: isDraggingThis ? 0.35 : sec.isActive ? 1 : 0.75,
                        transition: "background 0.15s ease",
                        cursor: "default",
                      }}
                    >
                      {/* 1. Reorder Position with Drag Handle Grip */}
                      <td style={{ ...tdStyle, width: "65px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div
                            style={{
                              display: "grid",
                              placeItems: "center",
                              cursor: "grab",
                              padding: "2px",
                              userSelect: "none",
                            }}
                            title="Drag handle to reorder section on homepage"
                          >
                            <GripIcon />
                          </div>
                          <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", minWidth: "16px" }}>
                            #{sec.order}
                          </span>
                        </div>
                      </td>

                      {/* 2. Section Title */}
                      <td style={{ ...tdStyle, minWidth: "150px" }}>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: sec.title ? "#0f172a" : "#64748b", lineHeight: 1.3, fontStyle: sec.title ? "normal" : "italic" }}>
                          {sec.title || (sec.type === "section_group_carousel" ? "No Title (Collection Cards)" : "Untitled Section")}
                        </div>
                        {sec.subtitle && (
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
                            {sec.subtitle}
                          </div>
                        )}
                      </td>

                      {/* 3. Content Type */}
                      <td style={{ ...tdStyle, width: "130px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: sec.type === "section_group_carousel" ? "#fdf4ff" : "#f1f5f9",
                            border: sec.type === "section_group_carousel" ? "1px solid #f0abfc" : "1px solid #e2e8f0",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: sec.type === "section_group_carousel" ? "#a21caf" : "#334155",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sec.type === "section_group_carousel"
                            ? `Collection Cards`
                            : sec.layout === "grid"
                            ? "Products Grid"
                            : "Products Row"}
                        </span>
                      </td>

                      {/* 4. Criteria Summary */}
                      <td style={{ ...tdStyle, minWidth: "120px" }}>
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: sec.type === "section_group_carousel" ? "#a21caf" : "#1d4ed8",
                            background: sec.type === "section_group_carousel" ? "#fdf4ff" : "#eff6ff",
                            border: sec.type === "section_group_carousel" ? "1px solid #f5d0fe" : "1px solid #bfdbfe",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            display: "inline-block",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {criteriaSummary}
                        </span>
                      </td>

                      {/* 5. Items Count */}
                      <td style={{ ...tdStyle, width: "75px" }}>
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: matchCount > 0 ? "#16a34a" : "#dc2626",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {matchCount} {sec.type === "section_group_carousel" ? "cards" : "items"}
                        </span>
                      </td>

                      {/* 6. Status Switch (Compact & Strictly Fixed Width) */}
                      <td style={{ ...tdStyle, width: "95px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "85px" }}>
                          <ToggleSwitch
                            checked={sec.isActive}
                            onChange={() => toggleActive(sec.id)}
                            disabled={saving}
                          />
                          <span
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 600,
                              color: sec.isActive ? "#15803d" : "#64748b",
                              width: "44px",
                              display: "inline-block",
                              textAlign: "left",
                            }}
                          >
                            {sec.isActive ? "Live" : "Hidden"}
                          </span>
                        </div>
                      </td>

                      {/* 7. Actions (Compact & Never Clipped) */}
                      <td style={{ ...tdStyle, width: "105px", textAlign: "right", paddingRight: "14px" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {/* Copy Link Icon Button */}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(secUrl || "/");
                              setToastMessage("Section filter link copied! Use this in Hero Banner CTAs or buttons.");
                              setToastType("success");
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "5px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#475569",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              padding: 0,
                            }}
                            title="Copy Section Filter URL: Use this link in Hero Banner CTA buttons, promo cards, or marketing links to open this exact filtered product view"
                          >
                            <CopyIcon />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleEdit(sec)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              padding: "0 8px",
                              height: "28px",
                              borderRadius: "5px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#334155",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            title="Edit section"
                          >
                            <PencilIcon />
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => deleteSection(sec.id)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              borderRadius: "5px",
                              border: "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#dc2626",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              padding: 0,
                            }}
                            title="Delete section"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. PRODUCTION-GRADE ADD / EDIT SECTION MODAL */}
      {editingModalOpen && activeSection && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 1000,
            overflowY: "auto",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px 48px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingModalOpen(false);
              setActiveSection(null);
            }
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "1040px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
              marginBottom: "32px",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Sticky Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    color: "#0f172a",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {activeSection.id.startsWith("sec_") && !sections.some((s) => s.id === activeSection.id)
                    ? "Add New Home Section"
                    : `Edit Section: ${activeSection.title || "Untitled"}`}
                </h2>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                {/* Status Switch (Fixed width to avoid shifts) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#f8fafc",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: activeSection.isActive ? "#15803d" : "#64748b",
                      width: "80px",
                      display: "inline-block",
                      textAlign: "left",
                    }}
                  >
                    {activeSection.isActive ? "Live on Store" : "Hidden"}
                  </span>
                  <ToggleSwitch
                    checked={activeSection.isActive}
                    onChange={(val) => setActiveSection({ ...activeSection, isActive: val })}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingModalOpen(false);
                    setActiveSection(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    color: "#64748b",
                    padding: "4px",
                    lineHeight: 1,
                    display: "grid",
                    placeItems: "center",
                  }}
                  title="Close modal"
                >
                  <XMarkIcon />
                </button>
              </div>
            </div>

            {/* 2-Column Industrial Grid Body */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
                gap: "14px",
                padding: "16px 20px",
                background: "#f8fafc",
              }}
            >
              {/* Left Column: General Configuration */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
                {/* Card 1: Section Type Visual Selector */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#0f172a",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: "6px",
                    }}
                  >
                    Section Type
                  </div>

                  {/* 2 Clear, Intuitive Visual Selection Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {/* Option 1: Products Row */}
                    <div
                      onClick={() => setActiveSection({ ...activeSection, type: "product_carousel" })}
                      style={{
                        border: activeSection.type === "product_carousel" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: activeSection.type === "product_carousel" ? "#eff6ff" : "#ffffff",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: activeSection.type === "product_carousel" ? "#1d4ed8" : "#0f172a" }}>
                          Products Row
                        </span>
                        <input
                          type="radio"
                          checked={activeSection.type === "product_carousel"}
                          onChange={() => {}}
                          style={{ cursor: "pointer", accentColor: "#2563eb" }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.3 }}>
                        Display products on your homepage (e.g. Bestsellers, New Drops, Summer Sale).
                      </span>
                    </div>

                    {/* Option 2: Visual Collection Cards */}
                    <div
                      onClick={() => setActiveSection({ ...activeSection, type: "section_group_carousel" })}
                      style={{
                        border: activeSection.type === "section_group_carousel" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: activeSection.type === "section_group_carousel" ? "#eff6ff" : "#ffffff",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: activeSection.type === "section_group_carousel" ? "#1d4ed8" : "#0f172a" }}>
                          Collection Cards
                        </span>
                        <input
                          type="radio"
                          checked={activeSection.type === "section_group_carousel"}
                          onChange={() => {}}
                          style={{ cursor: "pointer", accentColor: "#2563eb" }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.3 }}>
                        Clickable custom photo cards linking to categories, brands, or collections (e.g. Men, Nike, Footwear).
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Section Info & Appearance */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#0f172a",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: "6px",
                    }}
                  >
                    Section Info & Appearance
                  </div>

                  {/* Section Title */}
                  <div>
                    <label style={labelStyle}>
                      Section Title {activeSection.type === "product_carousel" ? <span style={{ color: "#ef4444" }}>*</span> : <span style={{ fontSize: "11px", fontWeight: 500, color: "#64748b" }}>(Optional)</span>}
                    </label>
                    <input
                      type="text"
                      value={activeSection.title}
                      onChange={(e) => setActiveSection({ ...activeSection, title: e.target.value })}
                      placeholder={
                        activeSection.type === "section_group_carousel"
                          ? "e.g. Featured Categories (Leave blank for no title)"
                          : "e.g. Summer Essentials, Featured Brands, Trending Collections"
                      }
                      style={inputStyle}
                    />
                  </div>

                  {/* Subtitle */}
                  <div>
                    <label style={labelStyle}>Subtitle (Optional)</label>
                    <input
                      type="text"
                      value={activeSection.subtitle || ""}
                      onChange={(e) => setActiveSection({ ...activeSection, subtitle: e.target.value })}
                      placeholder="e.g. Explore our top curated selections"
                      style={inputStyle}
                    />
                  </div>

                  {/* Layout & Card Style */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>Display Layout</label>
                      <select
                        value={activeSection.layout || "carousel"}
                        onChange={(e) => setActiveSection({ ...activeSection, layout: e.target.value as any })}
                        style={inputStyle}
                      >
                        <option value="carousel">Horizontal Scroll Carousel</option>
                        <option value="grid">Multi-Column Grid</option>
                      </select>
                    </div>

                    {activeSection.type === "product_carousel" && (
                      <div>
                        <label style={labelStyle}>Card Style</label>
                        <select
                          value={activeSection.cardStyle || "default"}
                          onChange={(e) => setActiveSection({ ...activeSection, cardStyle: e.target.value as any })}
                          style={inputStyle}
                        >
                          <option value="default">Store Theme Default</option>
                          <option value="fashion">Fashion (3:4 Portrait)</option>
                          <option value="electronics">Electronics (4:3 Tech)</option>
                          <option value="grocery">Grocery (2-Row Stacked)</option>
                          <option value="beauty">Beauty (Rounded Minimal)</option>
                          <option value="standard">Standard (1:1 Square)</option>
                        </select>
                      </div>
                    )}

                    {activeSection.type === "section_group_carousel" && (
                      <div>
                        <label style={labelStyle}>Card Shape</label>
                        <select
                          value={activeSection.cardShape || "portrait"}
                          onChange={(e) => setActiveSection({ ...activeSection, cardShape: e.target.value as any })}
                          style={inputStyle}
                        >
                          <option value="portrait">Portrait</option>
                          <option value="horizontal">Horizontal (Landscape)</option>
                          <option value="square">Square</option>
                          <option value="circle">Circle (Story)</option>
                          <option value="pill">Pill</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 3: Direct Filter Link Info */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>
                      Direct Filter Link
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const url = generateSectionFilterUrl(
                          activeSection.title,
                          activeSection.rules,
                          activeSection.viewAllLink,
                          activeSection.id
                        );
                        navigator.clipboard.writeText(url);
                        setToastMessage("Section URL copied to clipboard!");
                        setToastType("success");
                      }}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "5px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <CopyIcon />
                      <span>Copy Link</span>
                    </button>
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "11.5px",
                      color: "#0f172a",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      padding: "6px 10px",
                      borderRadius: "5px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {generateSectionFilterUrl(
                      activeSection.title,
                      activeSection.rules,
                      activeSection.viewAllLink,
                      activeSection.id
                    ) || "/ (All Products)"}
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Use this URL in Hero Banner CTA buttons or promo links to direct shoppers to this exact filtered view.
                  </span>
                </div>
              </div>

              {/* Right Column: Rules or Collection Cards Accordion */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
                {/* 1. PRODUCT FILTER RULES (If Products Row) */}
                {activeSection.type === "product_carousel" && (
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#0f172a",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Products Selection
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: "#f0fdf4",
                          color: "#15803d",
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        {countMatchingProducts(activeSection.rules)} matching items
                      </span>
                    </div>

                    {/* Category */}
                    <div>
                      <label style={labelStyle}>Category</label>
                      <select
                        value={activeSection.rules.category || ""}
                        onChange={(e) =>
                          setActiveSection({
                            ...activeSection,
                            rules: { ...activeSection.rules, category: e.target.value || undefined },
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="">All Categories</option>
                        {uniqueCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Collection */}
                    <div>
                      <label style={labelStyle}>Collection</label>
                      <select
                        value={activeSection.rules.collection_id || ""}
                        onChange={(e) =>
                          setActiveSection({
                            ...activeSection,
                            rules: { ...activeSection.rules, collection_id: e.target.value || undefined },
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="">All Collections</option>
                        {collections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name} {col.is_badge ? "(Badge)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Brand & Sort */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={labelStyle}>Brand</label>
                        <select
                          value={activeSection.rules.brand || ""}
                          onChange={(e) =>
                            setActiveSection({
                              ...activeSection,
                              rules: { ...activeSection.rules, brand: e.target.value || undefined },
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="">All Brands</option>
                          {uniqueBrands.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={labelStyle}>Sort Order</label>
                        <select
                          value={activeSection.rules.sort_by || "newest"}
                          onChange={(e) =>
                            setActiveSection({
                              ...activeSection,
                              rules: { ...activeSection.rules, sort_by: e.target.value as any },
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="bestseller">Bestseller</option>
                          <option value="rating_desc">Highest Rating</option>
                          <option value="newest">Newest</option>
                          <option value="discount_desc">Discount</option>
                          <option value="price_asc">Price: Low to High</option>
                          <option value="price_desc">Price: High to Low</option>
                        </select>
                      </div>
                    </div>

                    {/* Price Range & Max Items */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={labelStyle}>Min Price (₹)</label>
                        <input
                          type="number"
                          value={activeSection.rules.min_price ?? ""}
                          onChange={(e) =>
                            setActiveSection({
                              ...activeSection,
                              rules: {
                                ...activeSection.rules,
                                min_price: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                          placeholder="0"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Max Price (₹)</label>
                        <input
                          type="number"
                          value={activeSection.rules.max_price ?? ""}
                          onChange={(e) =>
                            setActiveSection({
                              ...activeSection,
                              rules: {
                                ...activeSection.rules,
                                max_price: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                          placeholder="No limit"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Max Items</label>
                        <input
                          type="number"
                          min="4"
                          max="30"
                          value={activeSection.limit || 10}
                          onChange={(e) =>
                            setActiveSection({
                              ...activeSection,
                              limit: Number(e.target.value) || 10,
                            })
                          }
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#334155", cursor: "pointer", marginTop: "2px" }}>
                      <input
                        type="checkbox"
                        checked={activeSection.rules.in_stock_only || false}
                        onChange={(e) =>
                          setActiveSection({
                            ...activeSection,
                            rules: { ...activeSection.rules, in_stock_only: e.target.checked },
                          })
                        }
                      />
                      <span>In-Stock items only</span>
                    </label>
                  </div>
                )}

                {/* 2. COLLECTION CARDS ACCORDION */}
                {activeSection.type === "section_group_carousel" && (
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "8px",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 700,
                            color: "#0f172a",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Collection Cards ({(activeSection.items || []).length})
                        </span>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          Drag handle icon to reorder. Click header to expand.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const newTileId = `tile_${Date.now()}`;
                          const newTile: SectionGroupTileItem = {
                            id: newTileId,
                            title: "",
                            subtitle: "",
                            imageUrl: "",
                            category: "",
                            sort_by: "bestseller",
                          };
                          setActiveSection({
                            ...activeSection,
                            items: [...(activeSection.items || []), newTile],
                          });
                          setExpandedTileIds((prev) => new Set(prev).add(newTileId));
                        }}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          background: "#2563eb",
                          color: "#ffffff",
                          border: "none",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <PlusIcon />
                        <span>Add Card</span>
                      </button>
                    </div>

                    {/* Accordion Tiles List */}
                    {(activeSection.items || []).length === 0 ? (
                      <div
                        style={{
                          padding: "30px 16px",
                          textAlign: "center",
                          background: "#f8fafc",
                          borderRadius: "8px",
                          border: "1px dashed #cbd5e1",
                          color: "#64748b",
                          fontSize: "12.5px",
                        }}
                      >
                        No collection cards added yet. Click <strong>+ Add Card</strong> to create your first card with an uploaded picture and target category, brand, or collection.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "480px", overflowY: "auto", paddingRight: "2px" }}>
                        {(activeSection.items || []).map((tile, tIdx) => {
                          const tileMatches = countMatchingProducts(tile);
                          const isOpen = expandedTileIds.has(tile.id);

                          return (
                            <div
                              key={tile.id || tIdx}
                              draggable
                              onDragStart={() => handleDragStart(tIdx)}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(tIdx)}
                              style={{
                                background: "#ffffff",
                                border: isOpen ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                                borderRadius: "8px",
                                overflow: "hidden",
                                boxShadow: isOpen ? "0 2px 6px rgba(37,99,235,0.08)" : "none",
                                opacity: draggedTileIndex === tIdx ? 0.4 : 1,
                                transition: "all 0.15s ease",
                              }}
                            >
                              {/* Accordion Header (Clickable with Drag Handle) */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "9px 12px",
                                  background: isOpen ? "#eff6ff" : "#f8fafc",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                                onClick={() => toggleTileAccordion(tile.id)}
                              >
                                {/* Left Side: Drag Grip + Thumbnail + Title + Matching pill */}
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                  <div
                                    style={{ display: "grid", placeItems: "center", cursor: "grab", padding: "2px" }}
                                    title="Drag to rearrange"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripIcon />
                                  </div>

                                  {/* Small Thumbnail */}
                                  {tile.imageUrl ? (
                                    <img
                                      src={getThumbnailUrl(tile.imageUrl, 80, 80)}
                                      alt="thumb"
                                      style={{ width: "26px", height: "26px", objectFit: "cover", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: "26px",
                                        height: "26px",
                                        borderRadius: "4px",
                                        border: "1px dashed #cbd5e1",
                                        background: "#ffffff",
                                        display: "grid",
                                        placeItems: "center",
                                        fontSize: "9px",
                                        color: "#94a3b8",
                                      }}
                                    >
                                      Img
                                    </div>
                                  )}

                                  {/* Title & Badge */}
                                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {tile.title || `Card #${tIdx + 1}`}
                                  </span>

                                  {tile.subtitle && (
                                    <span
                                      style={{
                                        fontSize: "10.5px",
                                        fontWeight: 600,
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        background: "#f1f5f9",
                                        color: "#475569",
                                      }}
                                    >
                                      {tile.subtitle}
                                    </span>
                                  )}

                                  <span
                                    style={{
                                      fontSize: "10.5px",
                                      fontWeight: 600,
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      background: tileMatches > 0 ? "#f0fdf4" : "#fef2f2",
                                      color: tileMatches > 0 ? "#15803d" : "#b91c1c",
                                      border: tileMatches > 0 ? "1px solid #bbf7d0" : "1px solid #fecaca",
                                    }}
                                  >
                                    {tileMatches} items
                                  </span>
                                </div>

                                {/* Right Side: Remove Button + Expand Chevron */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = (activeSection.items || []).filter((_, i) => i !== tIdx);
                                      setActiveSection({ ...activeSection, items: next });
                                    }}
                                    style={{
                                      padding: "3px 7px",
                                      fontSize: "11px",
                                      border: "1px solid #fecaca",
                                      background: "#fef2f2",
                                      color: "#dc2626",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                    }}
                                    title="Delete card"
                                  >
                                    Remove
                                  </button>

                                  <div style={{ display: "grid", placeItems: "center" }}>
                                    <ChevronDownIcon open={isOpen} />
                                  </div>
                                </div>
                              </div>

                              {/* Accordion Body Content (when open) */}
                              {isOpen && (
                                <div
                                  style={{
                                    padding: "12px 14px",
                                    borderTop: "1px solid #e2e8f0",
                                    background: "#ffffff",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                  }}
                                >
                                  {/* Tile Image Upload with Client-Side Optimizer */}
                                  <div>
                                    <label style={labelStyle}>Card Image (Uploaded & Optimized)</label>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                      {tile.imageUrl ? (
                                        <div style={{ position: "relative", width: "44px", height: "44px", flexShrink: 0 }}>
                                          <img
                                            src={getThumbnailUrl(tile.imageUrl, 120, 120)}
                                            alt="tile"
                                            style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                          />
                                        </div>
                                      ) : (
                                        <div
                                          style={{
                                            width: "44px",
                                            height: "44px",
                                            borderRadius: "6px",
                                            border: "1px dashed #cbd5e1",
                                            background: "#f8fafc",
                                            display: "grid",
                                            placeItems: "center",
                                            flexShrink: 0,
                                            color: "#94a3b8",
                                            fontSize: "10px",
                                          }}
                                        >
                                          No Image
                                        </div>
                                      )}

                                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
                                        <label
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            padding: "5px 12px",
                                            background: "#ffffff",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: "6px",
                                            color: "#334155",
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            cursor: uploadingTileIndex === tIdx ? "not-allowed" : "pointer",
                                            width: "fit-content",
                                          }}
                                        >
                                          <UploadIcon />
                                          <span>
                                            {uploadingTileIndex === tIdx
                                              ? "Compressing & Uploading..."
                                              : tile.imageUrl
                                              ? "Change Image"
                                              : "Upload Image"}
                                          </span>
                                          <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            disabled={uploadingTileIndex === tIdx}
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handleTileImageUpload(file, tIdx);
                                            }}
                                          />
                                        </label>
                                        <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                                          Auto-compressed to WebP for fast store loading.
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Title & Badge */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                    <div>
                                      <label style={labelStyle}>
                                        Title <span style={{ color: "#ef4444" }}>*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={tile.title}
                                        onChange={(e) => {
                                          const next = [...(activeSection.items || [])];
                                          next[tIdx] = { ...next[tIdx], title: e.target.value };
                                          setActiveSection({ ...activeSection, items: next });
                                        }}
                                        placeholder="e.g. Shirts, Shoes, Watches"
                                        style={inputStyle}
                                      />
                                    </div>

                                    <div>
                                      <label style={labelStyle}>Badge / Offer (Optional)</label>
                                      <input
                                        type="text"
                                        value={tile.subtitle || ""}
                                        onChange={(e) => {
                                          const next = [...(activeSection.items || [])];
                                          next[tIdx] = { ...next[tIdx], subtitle: e.target.value };
                                          setActiveSection({ ...activeSection, items: next });
                                        }}
                                        placeholder="e.g. Min 40% Off"
                                        style={inputStyle}
                                      />
                                    </div>
                                  </div>

                                  {/* Category, Brand, Collection targeting */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                    <div>
                                      <label style={labelStyle}>Category</label>
                                      <select
                                        value={tile.category || ""}
                                        onChange={(e) => {
                                          const catVal = e.target.value;
                                          const next = [...(activeSection.items || [])];
                                          const effectiveTitle = next[tIdx].title || catVal;
                                          next[tIdx] = {
                                            ...next[tIdx],
                                            category: catVal || undefined,
                                            title: effectiveTitle,
                                          };
                                          setActiveSection({ ...activeSection, items: next });
                                        }}
                                        style={inputStyle}
                                      >
                                        <option value="">All Categories</option>
                                        {uniqueCategories.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label style={labelStyle}>Collection</label>
                                      <select
                                        value={tile.collection_id || ""}
                                        onChange={(e) => {
                                          const colVal = e.target.value;
                                          const next = [...(activeSection.items || [])];
                                          next[tIdx] = {
                                            ...next[tIdx],
                                            collection_id: colVal || undefined,
                                          };
                                          setActiveSection({ ...activeSection, items: next });
                                        }}
                                        style={inputStyle}
                                      >
                                        <option value="">All Collections</option>
                                        {collections.map((col) => (
                                          <option key={col.id} value={col.id}>
                                            {col.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label style={labelStyle}>Brand</label>
                                      <select
                                        value={tile.brand || ""}
                                        onChange={(e) => {
                                          const brVal = e.target.value;
                                          const next = [...(activeSection.items || [])];
                                          next[tIdx] = {
                                            ...next[tIdx],
                                            brand: brVal || undefined,
                                          };
                                          setActiveSection({ ...activeSection, items: next });
                                        }}
                                        style={inputStyle}
                                      >
                                        <option value="">All Brands</option>
                                        {uniqueBrands.map((b) => (
                                          <option key={b} value={b}>
                                            {b}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer */}
            <div
              style={{
                position: "sticky",
                bottom: 0,
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                padding: "12px 20px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                boxShadow: "0 -1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setEditingModalOpen(false);
                  setActiveSection(null);
                }}
                style={ghostButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                style={primaryButtonStyle}
              >
                Save Section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHomeSections;
