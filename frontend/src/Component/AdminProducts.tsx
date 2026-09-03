import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { Pagination } from "./Pagination";
import { optimizeImageUrl, getThumbnailUrl, compressImageFile } from "../utils/imageOptimizer";


type VariantValue = {
  value: string;
  inStock: boolean;
  stockQty?: number | null;
  price?: number | null;
  comparePrice?: number | null;
};

type ProductVariantOption = {
  optionType: "size" | "weight" | "shoe_size" | "volume" | "pack_size" | "custom";
  optionName: string;
  optionValues: VariantValue[];
};

type Category = {
  id: string;
  name: string;
  slug?: string;
};

type Collection = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  is_badge?: boolean;
  badge_color?: string | null;
};

type Product = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  category_id?: string | null;
  category_name?: string | null;
  collections?: { id: string; name: string; slug?: string; is_badge?: boolean; badge_color?: string | null }[];
  price: number;
  compare_price?: number | null;
  images: string[];
  description: string;
  highlights?: string[];
  in_stock: boolean;
  stock: number;
  is_active: boolean;
  sku?: string | null;
  hsn_code?: string | null;
  video_url?: string | null;
  video_position?: number | null;
  sibling_group?: string | null;
  sibling_label?: string | null;
  weight_grams: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  slug?: string | null;
  variant_option?: ProductVariantOption | null;
  return_window_days?: number | null;
};

type VariantRow = {
  value: string;
  price: string;
  comparePrice: string;
  stockQty: string;
  inStock: boolean;
};

type ProductFormValues = {
  name: string;
  brand: string;
  category: string;
  categoryId: string;
  selectedCollectionIds: string[];
  description: string;
  highlights: string;
  slug: string;
  imagesText: string;
  is_active: boolean;
  sku: string;
  hsn_code: string;
  video_url: string;
  video_position: number;
  sibling_group: string;
  sibling_label: string;
  weight_grams: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  price: string;
  compare_price: string;
  stock: string;
  optionType: ProductVariantOption["optionType"];
  optionName: string;
  optionValuesText: string;
  return_window_days: string;
};

type FormErrors = Partial<
  Record<keyof ProductFormValues | "imagesText" | "optionValuesText" | "variantRows", string>
>;

const presetMap: Record<
  ProductVariantOption["optionType"],
  { optionName: string; values: string[] }
> = {
  size: { optionName: "Size", values: ["S", "M", "L", "XL"] },
  weight: { optionName: "Weight", values: ["500g", "1kg", "2kg"] },
  shoe_size: { optionName: "Shoe Size", values: ["UK6", "UK7", "UK8", "UK9"] },
  volume: { optionName: "Volume", values: ["250ml", "500ml", "1L"] },
  pack_size: { optionName: "Pack Size", values: ["1 pack", "2 pack", "5 pack"] },
  custom: { optionName: "", values: [] },
};

const normalizeProduct = (p: any): Product => ({
  id: String(p.id),
  name: p.name ?? "",
  brand: p.brand ?? "",
  category: p.category ?? "",
  category_id: p.category_id ? String(p.category_id) : null,
  category_name: p.category_name ?? null,
  collections: Array.isArray(p.collections) ? p.collections : [],
  price: Number(p.price ?? 0),
  compare_price: p.compare_price != null ? Number(p.compare_price) : null,
  images: Array.isArray(p.images)
    ? p.images.filter(Boolean).map((img: string) => optimizeImageUrl(img))
    : [],
  description: p.description ?? "",
  highlights: Array.isArray(p.highlights) ? p.highlights : [],
  in_stock: Boolean(p.in_stock ?? Number(p.stock ?? 0) > 0),
  stock: Number(p.stock ?? 0),
  is_active: p.is_active !== false,
  sku: p.sku ?? null,
  hsn_code: p.hsn_code ?? null,
  video_url: p.video_url ?? null,
  video_position: p.video_position != null ? Number(p.video_position) : 2,
  sibling_group: p.sibling_group ?? null,
  sibling_label: p.sibling_label ?? null,
  weight_grams: Number(p.weight_grams ?? 500),
  length_cm: p.length_cm != null ? Number(p.length_cm) : null,
  width_cm: p.width_cm != null ? Number(p.width_cm) : null,
  height_cm: p.height_cm != null ? Number(p.height_cm) : null,
  slug: p.slug ?? null,
  variant_option: p.variant_option ?? null,
  return_window_days: p.return_window_days != null ? Number(p.return_window_days) : null,
});

const buildVariantRowsFromText = (
  text: string,
  existing: VariantRow[] = []
): VariantRow[] => {
  const values = text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return values.map((value) => {
    const found = existing.find((item) => item.value.toLowerCase() === value.toLowerCase());
    return (
      found || {
        value,
        price: "",
        comparePrice: "",
        stockQty: "",
        inStock: true,
      }
    );
  });
};

const getVariantDiscountPercent = (price: string, comparePrice: string) => {
  const finalPrice = Number(price);
  const original = Number(comparePrice);

  if (
    !price.trim() ||
    !comparePrice.trim() ||
    !Number.isFinite(finalPrice) ||
    !Number.isFinite(original) ||
    original <= finalPrice ||
    finalPrice <= 0
  ) {
    return null;
  }

  return Math.round(((original - finalPrice) / original) * 100);
};

export const ToggleSwitch = ({
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
        width: "34px",
        height: "19px",
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
          width: "15px",
          height: "15px",
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          position: "absolute",
          top: "2px",
          left: checked ? "17px" : "2px",
          transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
        }}
      />
    </div>
  );
};

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

const LightningIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const QuickEditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    <polygon points="13 2 9 8 13 8 11 14 17 7 13 7 13 2" fill="currentColor" stroke="none" />
  </svg>
);

const getOptimizedThumbnailUrl = (url?: string, width = 120, height = 140): string => {
  return getThumbnailUrl(url, width, height);
};

const RefreshIcon = ({ spin = false }: { spin?: boolean }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: spin ? "spin 1s linear infinite" : undefined }}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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

const FilmIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
    <line x1="7" y1="2" x2="7" y2="22" />
    <line x1="17" y1="2" x2="17" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const UploadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const getCachedProducts = (id?: string): Product[] => {
  if (!id || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`wc_admin_products_${id}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getCachedCategories = (id?: string): Category[] => {
  if (!id || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`wc_admin_categories_${id}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getCachedCollections = (id?: string): Collection[] => {
  if (!id || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`wc_admin_collections_${id}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

type AdminProductsCacheEntry = {
  products: Product[];
  totalProducts: number;
  filteredTotal: number;
  totalPages: number;
  activeCount?: number;
  draftCount?: number;
  inStockCount?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  timestamp: number;
};

const MAX_ADMIN_QUERY_CACHE = 40;
const adminProductsQueryCache = new Map<string, AdminProductsCacheEntry>();

function setAdminProductsCache(key: string, entry: AdminProductsCacheEntry) {
  while (adminProductsQueryCache.size >= MAX_ADMIN_QUERY_CACHE) {
    const oldestKey = adminProductsQueryCache.keys().next().value;
    if (!oldestKey) break;
    adminProductsQueryCache.delete(oldestKey);
  }
  adminProductsQueryCache.set(key, entry);
}

function invalidateAdminProductsCache(targetSiteId?: string) {
  if (!targetSiteId) {
    adminProductsQueryCache.clear();
    return;
  }
  const prefix = `${targetSiteId}:`;
  for (const key of Array.from(adminProductsQueryCache.keys())) {
    if (key.startsWith(prefix)) {
      adminProductsQueryCache.delete(key);
    }
  }
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
  padding: "10px 16px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
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
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: "12px",
};

const AdminProducts = () => {
  const { siteId } = useParams();
  const initialProducts = getCachedProducts(siteId);
  const [products, setProducts] = useState<Product[]>(() => {
    if (initialProducts.length > 0 && siteId) {
      const defaultKey = `${siteId}:all:1:10::::::all:all:all:newest`;
      if (!adminProductsQueryCache.has(defaultKey)) {
        adminProductsQueryCache.set(defaultKey, {
          products: initialProducts,
          totalProducts: initialProducts.length,
          filteredTotal: initialProducts.length,
          totalPages: 1,
          timestamp: Date.now(),
        });
      }
    }
    return initialProducts;
  });
  const [categories, setCategories] = useState<Category[]>(() => getCachedCategories(siteId));
  const [collections, setCollections] = useState<Collection[]>(() => getCachedCollections(siteId));

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(initialProducts.length);
  const [filteredTotal, setFilteredTotal] = useState(initialProducts.length);
  const [activeCount, setActiveCount] = useState(() => initialProducts.filter((p) => p.is_active).length);
  const [draftCount, setDraftCount] = useState(() => initialProducts.filter((p) => !p.is_active).length);
  const [inStockCount, setInStockCount] = useState(() => initialProducts.filter((p) => p.in_stock && p.stock > 0).length);
  const [lowStockCount, setLowStockCount] = useState(() => initialProducts.filter((p) => p.in_stock && p.stock > 0 && p.stock <= 5).length);
  const [outOfStockCount, setOutOfStockCount] = useState(() => initialProducts.filter((p) => !p.in_stock || p.stock <= 0).length);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "low_stock" | "out_of_stock">("all");

  // Rich Filter Popover states
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterCollection, setFilterCollection] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterDiscount, setFilterDiscount] = useState<"all" | "discounted" | "regular">("all");
  const [filterReturnPolicy, setFilterReturnPolicy] = useState<"all" | "non_returnable" | "returnable">("all");
  const [filterHasVideo, setFilterHasVideo] = useState<"all" | "with_video" | "images_only">("all");
  const [filterSortBy, setFilterSortBy] = useState<string>("newest");
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const [storeBrands, setStoreBrands] = useState<string[]>([]);

  // Dynamic available brands across full store catalog
  const availableBrands = useMemo(() => {
    const set = new Set<string>(storeBrands);
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim());
    });
    return Array.from(set).sort();
  }, [products, storeBrands]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionIsBadge, setNewCollectionIsBadge] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);

  const [isLoading, setIsLoading] = useState(initialProducts.length === 0);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // Bulk Actions State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Inline quick-edit state for price and stock (flat products)
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState<string>("");
  const [inlineStock, setInlineStock] = useState<string>("");
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  // Variant Quick Edit Modal State (multi-variant products)
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickEditVariantRows, setQuickEditVariantRows] = useState<VariantRow[]>([]);

  const [defaultReturnWindowDays, setDefaultReturnWindowDays] = useState<number>(7);
  const [isUpdatingReturnPolicy, setIsUpdatingReturnPolicy] = useState(false);

  // CSV Import / Export States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [defaultImportStatus, setDefaultImportStatus] = useState<"draft" | "active" | "csv">("draft");
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [importResult, setImportResult] = useState<{
    success?: boolean;
    created_count?: number;
    updated_count?: number;
    errors?: Array<{ row: number; error: string }>;
  } | null>(null);

  const [formValues, setFormValues] = useState<ProductFormValues>({
    name: "",
    brand: "",
    category: "",
    categoryId: "",
    selectedCollectionIds: [],
    description: "",
    highlights: "",
    slug: "",
    imagesText: "",
    is_active: true,
    sku: "",
    hsn_code: "",
    video_url: "",
    video_position: 2,
    sibling_group: "",
    sibling_label: "",
    weight_grams: "500",
    length_cm: "",
    width_cm: "",
    height_cm: "",
    price: "",
    compare_price: "",
    stock: "10",
    optionType: "custom",
    optionName: "",
    optionValuesText: "",
    return_window_days: "",
  });

  const parseImages = (text: string): string[] => {
    if (!text || !text.trim()) return [];
    const lines = text
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const healed: string[] = [];
    for (const line of lines) {
      // If line is a broken suffix from a comma split (e.g. "1000_QL80_.jpg")
      if (
        healed.length > 0 &&
        !line.startsWith("http://") &&
        !line.startsWith("https://") &&
        !line.startsWith("/") &&
        !line.startsWith("data:")
      ) {
        healed[healed.length - 1] = `${healed[healed.length - 1]},${line}`;
      } else {
        healed.push(line);
      }
    }
    return healed;
  };

  const imagePreviewList = useMemo(() => parseImages(formValues.imagesText), [formValues.imagesText]);

  const buildVariantOption = (): ProductVariantOption | null => {
    if (!formValues.optionName.trim() && variantRows.length === 0) return null;

    const optionValues = variantRows
      .map((row) => ({
        value: row.value.trim(),
        inStock: row.inStock,
        stockQty: row.stockQty.trim() === "" ? null : Number(row.stockQty),
        price: row.price.trim() === "" ? null : Number(row.price),
        comparePrice: row.comparePrice.trim() === "" ? null : Number(row.comparePrice),
      }))
      .filter((row) => row.value);

    if (optionValues.length === 0) return null;

    return {
      optionType: formValues.optionType,
      optionName: formValues.optionName.trim(),
      optionValues,
    };
  };

  const getFallbackProductPrice = () => {
    const firstWithPrice = variantRows.find(
      (row) => row.price.trim() !== "" && Number(row.price) > 0
    );
    return firstWithPrice ? Number(firstWithPrice.price) : 0;
  };

  const getFallbackComparePrice = () => {
    const firstWithComparePrice = variantRows.find(
      (row) =>
        row.comparePrice.trim() !== "" &&
        Number(row.comparePrice) > 0 &&
        Number(row.comparePrice) >= Number(row.price || 0)
    );
    return firstWithComparePrice ? Number(firstWithComparePrice.comparePrice) : null;
  };

  const getFallbackStock = () =>
    variantRows.reduce((sum, row) => {
      const qty = row.stockQty.trim() === "" ? 0 : Number(row.stockQty);
      return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
    }, 0);

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const images = parseImages(formValues.imagesText);
    const optionValues = formValues.optionValuesText
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (!formValues.name.trim()) nextErrors.name = "Name is required.";
    if (!formValues.category.trim()) nextErrors.category = "Product Type is required.";
    if (!formValues.description.trim()) nextErrors.description = "Description is required.";
    if (images.length === 0) nextErrors.imagesText = "Add at least one image.";

    const hasVariantSection =
      formValues.optionName.trim() !== "" ||
      optionValues.length > 0 ||
      variantRows.length > 0;

    if (hasVariantSection) {
      if (!formValues.optionName.trim()) nextErrors.optionName = "Option name is required.";
      if (optionValues.length === 0) nextErrors.optionValuesText = "Add at least one option value.";
      if (new Set(optionValues.map((v) => v.toLowerCase())).size !== optionValues.length) {
        nextErrors.optionValuesText = "Duplicate option values are not allowed.";
      }

      const hasAnyVariantPrice = variantRows.some(
        (row) => row.price.trim() !== "" && Number(row.price) > 0
      );

      if (!hasAnyVariantPrice) {
        nextErrors.variantRows = "Add at least one variant price.";
      }

      const invalidVariantRow = variantRows.some((row) => {
        const price = row.price.trim() === "" ? null : Number(row.price);
        const comparePrice =
          row.comparePrice.trim() === "" ? null : Number(row.comparePrice);
        const stockQty = row.stockQty.trim() === "" ? null : Number(row.stockQty);

        return (
          !row.value.trim() ||
          price == null ||
          !Number.isFinite(price) ||
          price <= 0 ||
          (comparePrice != null &&
            (!Number.isFinite(comparePrice) || comparePrice < price)) ||
          (stockQty != null &&
            (!Number.isFinite(stockQty) || stockQty < 0))
        );
      });

      if (invalidVariantRow) {
        nextErrors.variantRows =
          "Each variant must have value, valid price, optional MRP, and valid stock.";
      }
    } else {
      // Validate Base Price & Stock when no sub-variants (e.g. Color Earphones / Standalone Product)
      const basePrice = formValues.price.trim() === "" ? null : Number(formValues.price);
      const baseComparePrice = formValues.compare_price.trim() === "" ? null : Number(formValues.compare_price);
      const baseStock = formValues.stock.trim() === "" ? null : Number(formValues.stock);

      if (basePrice == null || !Number.isFinite(basePrice) || basePrice <= 0) {
        nextErrors.price = "Selling price is required and must be greater than 0.";
      }

      if (baseComparePrice != null && (!Number.isFinite(baseComparePrice) || (basePrice != null && baseComparePrice < basePrice))) {
        nextErrors.compare_price = "MRP / Strike Price cannot be less than selling price.";
      }

      if (baseStock != null && (!Number.isFinite(baseStock) || baseStock < 0)) {
        nextErrors.stock = "Stock quantity cannot be negative.";
      }
    }

    const highlightWords = formValues.highlights.trim() ? formValues.highlights.trim().split(/\s+/).filter(Boolean).length : 0;
    if (highlightWords > 50) {
      nextErrors.highlights = `Highlights cannot exceed 50 words (currently ${highlightWords} words).`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setEditingProduct(null);
    setErrors({});
    setVariantRows([]);
    setFormValues({
      name: "",
      brand: "",
      category: "",
      categoryId: "",
      selectedCollectionIds: [],
      description: "",
      highlights: "",
      slug: "",
      imagesText: "",
      is_active: true,
      sku: "",
      hsn_code: "",
      video_url: "",
      video_position: 2,
      sibling_group: "",
      sibling_label: "",
      weight_grams: "500",
      length_cm: "",
      width_cm: "",
      height_cm: "",
      price: "",
      compare_price: "",
      stock: "10",
      optionType: "custom",
      optionName: "",
      optionValuesText: "",
      return_window_days: "",
    });
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    const optionValues = product.variant_option?.optionValues ?? [];
    setEditingProduct(product);
    setErrors({});
    setVariantRows(
      optionValues.map((v) => ({
        value: v.value,
        price: v.price != null ? String(v.price) : "",
        comparePrice:
          (v as any).comparePrice != null ? String((v as any).comparePrice) : "",
        stockQty: v.stockQty != null ? String(v.stockQty) : "",
        inStock: v.inStock !== false,
      }))
    );
    const productHighlights =
      Array.isArray(product.highlights)
        ? product.highlights.join("\n")
        : typeof (product as any).highlights === "string"
        ? (product as any).highlights
        : "";
    setFormValues({
      name: product.name,
      brand: product.brand ?? "",
      category: product.category ?? "",
      categoryId: product.category_id ?? "",
      selectedCollectionIds: (product.collections ?? []).map((c) => c.id),
      description: product.description ?? "",
      highlights: productHighlights,
      slug: product.slug ?? "",
      imagesText: (product.images ?? []).map((img) => optimizeImageUrl(img)).join("\n"),
      is_active: product.is_active !== false,
      sku: product.sku ?? "",
      hsn_code: product.hsn_code ?? "",
      video_url: product.video_url ?? "",
      video_position: product.video_position != null ? Number(product.video_position) : 2,
      sibling_group: product.sibling_group ?? "",
      sibling_label: product.sibling_label ?? "",
      weight_grams: String(product.weight_grams ?? 500),
      length_cm: product.length_cm != null ? String(product.length_cm) : "",
      width_cm: product.width_cm != null ? String(product.width_cm) : "",
      height_cm: product.height_cm != null ? String(product.height_cm) : "",
      price: product.price != null && product.price > 0 ? String(product.price) : "",
      compare_price: product.compare_price != null ? String(product.compare_price) : "",
      stock: product.stock != null ? String(product.stock) : "10",
      optionType: product.variant_option?.optionType ?? "custom",
      optionName: product.variant_option?.optionName ?? "",
      optionValuesText: optionValues.map((v) => v.value).join(", "),
      return_window_days: product.return_window_days != null ? String(product.return_window_days) : "",
    });
    setShowForm(true);
  };

  const handleCreateCategoryInline = async () => {
    if (!siteId || !newCategoryName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setCategories((prev) => [...prev, created]);
        setFormValues((prev) => ({ ...prev, categoryId: created.id }));
        setNewCategoryName("");
        setShowAddCategory(false);
      }
    } catch (err) {
      console.error("Error creating category", err);
    }
  };

  const handleCreateCollectionInline = async () => {
    if (!siteId || !newCollectionName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newCollectionName.trim(),
          is_badge: newCollectionIsBadge,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCollections((prev) => [...prev, created]);
        setFormValues((prev) => ({
          ...prev,
          selectedCollectionIds: [...prev.selectedCollectionIds, created.id],
        }));
        setNewCollectionName("");
        setNewCollectionIsBadge(false);
        setShowAddCollection(false);
      }
    } catch (err) {
      console.error("Error creating collection", err);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!siteId) return;
    if (
      !window.confirm(
        `Are you sure you want to delete category "${categoryName}"? Any products assigned to this category will become unassigned.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/categories/${categoryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
        if (formValues.categoryId === categoryId) {
          setFormValues((prev) => ({ ...prev, categoryId: "", category: "" }));
        }
        await loadProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to delete category");
      }
    } catch (err: any) {
      console.error("Error deleting category", err);
      alert(err.message || "Failed to delete category");
    }
  };

  const handleDeleteCollection = async (collectionId: string, collectionName: string) => {
    if (!siteId) return;
    if (
      !window.confirm(
        `Are you sure you want to delete collection "${collectionName}"?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/collections/${collectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c.id !== collectionId));
        setFormValues((prev) => ({
          ...prev,
          selectedCollectionIds: prev.selectedCollectionIds.filter((id) => id !== collectionId),
        }));
        await loadProducts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to delete collection");
      }
    } catch (err: any) {
      console.error("Error deleting collection", err);
      alert(err.message || "Failed to delete collection");
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory) count++;
    if (filterCollection) count++;
    if (filterBrand) count++;
    if (filterMinPrice) count++;
    if (filterMaxPrice) count++;
    if (filterDiscount !== "all") count++;
    if (filterReturnPolicy !== "all") count++;
    if (filterHasVideo !== "all") count++;
    if (filterSortBy !== "newest") count++;
    return count;
  }, [
    filterCategory,
    filterCollection,
    filterBrand,
    filterMinPrice,
    filterMaxPrice,
    filterDiscount,
    filterReturnPolicy,
    filterHasVideo,
    filterSortBy,
  ]);

  const loadProducts = async (customParams?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "all" | "active" | "draft" | "low_stock" | "out_of_stock";
    catId?: string;
    colId?: string;
    brand?: string;
    minP?: string;
    maxP?: string;
    discount?: "all" | "discounted" | "regular";
    retPol?: "all" | "non_returnable" | "returnable";
    hasVid?: "all" | "with_video" | "images_only";
    sortB?: string;
  }) => {
    if (!siteId) return;

    const page = customParams?.page !== undefined ? customParams.page : currentPage;
    const limit = customParams?.limit !== undefined ? customParams.limit : pageSize;
    const search = customParams?.search !== undefined ? customParams.search : searchQuery;
    const status = customParams?.status !== undefined ? customParams.status : statusFilter;
    const catId = customParams?.catId !== undefined ? customParams.catId : filterCategory;
    const colId = customParams?.colId !== undefined ? customParams.colId : filterCollection;
    const brand = customParams?.brand !== undefined ? customParams.brand : filterBrand;
    const minP = customParams?.minP !== undefined ? customParams.minP : filterMinPrice;
    const maxP = customParams?.maxP !== undefined ? customParams.maxP : filterMaxPrice;
    const discount = customParams?.discount !== undefined ? customParams.discount : filterDiscount;
    const retPol = customParams?.retPol !== undefined ? customParams.retPol : filterReturnPolicy;
    const hasVid = customParams?.hasVid !== undefined ? customParams.hasVid : filterHasVideo;
    const sortB = customParams?.sortB !== undefined ? customParams.sortB : filterSortBy;

    const cacheKey = `${siteId}:${status}:${page}:${limit}:${search}:${catId}:${colId}:${brand}:${minP}:${maxP}:${discount}:${retPol}:${hasVid}:${sortB}`;
    const cached = adminProductsQueryCache.get(cacheKey);

    if (cached) {
      setProducts(cached.products);
      setTotalProducts(cached.totalProducts);
      setFilteredTotal(cached.filteredTotal);
      setTotalPages(cached.totalPages);
      if (cached.activeCount != null) setActiveCount(cached.activeCount);
      if (cached.draftCount != null) setDraftCount(cached.draftCount);
      if (cached.inStockCount != null) setInStockCount(cached.inStockCount);
      if (cached.lowStockCount != null) setLowStockCount(cached.lowStockCount);
      if (cached.outOfStockCount != null) setOutOfStockCount(cached.outOfStockCount);
      setIsLoading(false);
      if (Date.now() - cached.timestamp < 30000) {
        return;
      }
    } else if (page === 1 && status === "all" && !search && !catId && products.length > 0) {
      setIsLoading(false);
    } else {
      setProducts([]);
      setIsLoading(true);
    }

    try {
      const qParams = new URLSearchParams();
      qParams.set("page", String(page));
      qParams.set("page_size", String(limit));
      if (search && search.trim()) qParams.set("search", search.trim());
      if (status !== "all") qParams.set("status", status);
      if (catId) qParams.set("category_id", catId);
      if (colId) qParams.set("collection_id", colId);
      if (brand) qParams.set("brand", brand);
      if (minP) qParams.set("min_price", minP);
      if (maxP) qParams.set("max_price", maxP);
      if (discount === "discounted") qParams.set("has_discount", "true");
      else if (discount === "regular") qParams.set("has_discount", "false");
      if (retPol === "non_returnable") qParams.set("return_policy", "non_returnable");
      else if (retPol === "returnable") qParams.set("return_policy", "returnable");
      if (hasVid === "with_video") qParams.set("has_video", "true");
      else if (hasVid === "images_only") qParams.set("has_video", "false");
      if (sortB && sortB !== "newest") qParams.set("sort_by", sortB);

      const prodRes = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products?${qParams.toString()}`,
        { credentials: "include" }
      );

      if (prodRes.ok) {
        const data = await prodRes.json();
        if (data && Array.isArray(data.products)) {
          const norm = data.products.map(normalizeProduct);
          setProducts(norm);
          const allCnt = data.all_count ?? data.total_count ?? (data.total ?? 0);
          const totPages = data.total_pages ?? 1;
          const act = data.active_count ?? activeCount;
          const dft = data.draft_count ?? (data.active_count != null ? Math.max(0, allCnt - data.active_count) : draftCount);
          const inStk = data.in_stock_count ?? inStockCount;
          const lowStk = data.low_stock_count ?? lowStockCount;
          const outStk = data.out_of_stock_count ?? outOfStockCount;

          setTotalProducts(allCnt);
          setFilteredTotal(data.total ?? 0);
          setTotalPages(totPages);
          if (data.active_count != null) setActiveCount(act);
          if (data.draft_count != null || data.active_count != null) setDraftCount(dft);
          if (data.in_stock_count != null) setInStockCount(inStk);
          if (data.low_stock_count != null) setLowStockCount(lowStk);
          if (data.out_of_stock_count != null) setOutOfStockCount(outStk);
          if (Array.isArray(data.brands)) setStoreBrands(data.brands);

          try {
            if (page === 1 && status === "all" && !search && !catId) {
              localStorage.setItem(`wc_admin_products_${siteId}`, JSON.stringify(norm.slice(0, 25)));
            }
          } catch (_) {}

          setAdminProductsCache(cacheKey, {
            products: norm,
            totalProducts: allCnt,
            filteredTotal: data.total ?? 0,
            totalPages: totPages,
            activeCount: act,
            draftCount: dft,
            inStockCount: inStk,
            lowStockCount: lowStk,
            outOfStockCount: outStk,
            timestamp: Date.now(),
          });
        } else if (Array.isArray(data)) {
          const norm = data.map(normalizeProduct);
          setProducts(norm);
          const act = norm.filter((p) => p.is_active).length;
          const dft = norm.length - act;
          const inStk = norm.filter((p) => p.in_stock && p.stock > 0).length;
          const lowStk = norm.filter((p) => p.in_stock && p.stock > 0 && p.stock <= 5).length;
          const outStk = norm.filter((p) => !p.in_stock || p.stock <= 0).length;
          const totPages = Math.max(1, Math.ceil(norm.length / limit));

          setTotalProducts(norm.length);
          setFilteredTotal(norm.length);
          setTotalPages(totPages);
          setActiveCount(act);
          setDraftCount(dft);
          setInStockCount(inStk);
          setLowStockCount(lowStk);
          setOutOfStockCount(outStk);

          try {
            if (page === 1 && status === "all" && !search && !catId) {
              localStorage.setItem(`wc_admin_products_${siteId}`, JSON.stringify(norm.slice(0, 25)));
            }
          } catch (_) {}

          setAdminProductsCache(cacheKey, {
            products: norm,
            totalProducts: norm.length,
            filteredTotal: norm.length,
            totalPages: totPages,
            activeCount: act,
            draftCount: dft,
            inStockCount: inStk,
            lowStockCount: lowStk,
            outOfStockCount: outStk,
            timestamp: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error("Error loading products", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!siteId) return;
    const timer = setTimeout(async () => {
      try {
        const [catRes, colRes, siteRes] = await Promise.all([
          fetch(`${API_BASE_URL}/sites/${siteId}/categories`, { credentials: "include" }),
          fetch(`${API_BASE_URL}/sites/${siteId}/collections`, { credentials: "include" }),
          fetch(`${API_BASE_URL}/sites/${siteId}`, { credentials: "include" }),
        ]);
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(catData);
          try {
            localStorage.setItem(`wc_admin_categories_${siteId}`, JSON.stringify(catData));
          } catch (_) {}
        }
        if (colRes.ok) {
          const colData = await colRes.json();
          setCollections(colData);
          try {
            localStorage.setItem(`wc_admin_collections_${siteId}`, JSON.stringify(colData));
          } catch (_) {}
        }
        if (siteRes.ok) {
          const siteData = await siteRes.json();
          if (siteData.default_return_window_days != null) {
            setDefaultReturnWindowDays(siteData.default_return_window_days);
          }
        }
      } catch (err) {
        console.error("Error loading categories or collections", err);
      }
    }, categories.length > 0 ? 120 : 0);

    return () => clearTimeout(timer);
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    loadProducts();
  }, [
    siteId,
    currentPage,
    pageSize,
    statusFilter,
    filterCategory,
    filterCollection,
    filterBrand,
    filterMinPrice,
    filterMaxPrice,
    filterDiscount,
    filterReturnPolicy,
    filterHasVideo,
    filterSortBy,
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setShowFilterPopover(false);
      }
    }
    if (showFilterPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilterPopover]);

  const handleUpdateDefaultReturnPolicy = async (days: number) => {
    if (!siteId) return;
    setIsUpdatingReturnPolicy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/default-return-policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ default_return_window_days: days }),
      });
      if (res.ok) {
        setDefaultReturnWindowDays(days);
        await loadProducts();
      } else {
        alert("Failed to update store default return policy");
      }
    } catch (err) {
      console.error("Error updating default return policy", err);
      alert("Error updating store default return policy");
    } finally {
      setIsUpdatingReturnPolicy(false);
    }
  };

  const handleFormChange = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K]
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === "optionType") {
      const preset = presetMap[value as ProductVariantOption["optionType"]];
      if (preset) {
        setFormValues((prev) => ({
          ...prev,
          optionType: value as ProductVariantOption["optionType"],
          optionName: preset.optionName,
          optionValuesText: preset.values.join(", "),
        }));
        setVariantRows((prev) => buildVariantRowsFromText(preset.values.join(", "), prev));
      }
      return;
    }

    if (field === "optionValuesText" && typeof value === "string") {
      setVariantRows((prev) => buildVariantRowsFromText(value, prev));
    }
  };

  const handleVariantRowChange = (
    index: number,
    field: keyof VariantRow,
    value: string | boolean
  ) => {
    setVariantRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  // Batch Image Upload Handler
  const handleBatchImageUpload = async (fileList: FileList | File[]) => {
    if (!siteId) return;
    const files = Array.from(fileList);
    const validFiles = files.filter((f) =>
      ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(f.type)
    );
    if (validFiles.length === 0) {
      alert("Only PNG, JPG, JPEG, and WEBP files are allowed.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const compressedFiles = await Promise.all(
        validFiles.map((f) => compressImageFile(f, 1600, 1600, 0.82))
      );

      const formData = new FormData();
      compressedFiles.forEach((f) => formData.append("files", f));

      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products/upload-images`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const newUrls = (data.urls || []).map((u: string) => optimizeImageUrl(u));
        setFormValues((prev) => {
          const existing = prev.imagesText.trim() ? prev.imagesText.trim().split("\n") : [];
          return {
            ...prev,
            imagesText: [...existing, ...newUrls].join("\n"),
          };
        });
      } else {
        // Fallback to uploading individually if /upload-images fails
        for (const file of validFiles) {
          const singleData = new FormData();
          singleData.append("file", file);
          const singleRes = await fetch(`${API_BASE_URL}/sites/${siteId}/products/upload-image`, {
            method: "POST",
            credentials: "include",
            body: singleData,
          });
          if (singleRes.ok) {
            const data = await singleRes.json();
            const fullUrl = optimizeImageUrl(data.url);
            setFormValues((prev) => ({
              ...prev,
              imagesText: prev.imagesText.trim() ? `${prev.imagesText}\n${fullUrl}` : fullUrl,
            }));
          }
        }
      }
    } catch (err) {
      console.error("Image upload failed", err);
      alert("Image upload failed.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Image Reordering Functions
  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= imagePreviewList.length) return;
    const updated = [...imagePreviewList];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    handleFormChange("imagesText", updated.join("\n"));
  };

  const setAsCoverImage = (index: number) => {
    if (index === 0) return;
    moveImage(index, 0);
  };

  const removeImage = (index: number) => {
    const updated = imagePreviewList.filter((_, i) => i !== index);
    handleFormChange("imagesText", updated.join("\n"));
  };

  // Bulk Actions
  const handleBulkAction = async (action: "make_active" | "make_draft" | "delete" | "duplicate") => {
    if (selectedProductIds.size === 0 || !siteId) return;

    if (action === "delete") {
      if (
        !window.confirm(
          `Are you sure you want to permanently delete ${selectedProductIds.size} selected product(s)?`
        )
      ) {
        return;
      }
    }

    setBulkActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products/bulk-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          product_ids: Array.from(selectedProductIds),
          action,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          typeof err.detail === "string"
            ? err.detail
            : Array.isArray(err.detail)
            ? err.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
            : typeof err.message === "string"
            ? err.message
            : "Failed to execute bulk action";
        throw new Error(msg);
      }

      setSelectedProductIds(new Set());
      invalidateAdminProductsCache(siteId);
      await loadProducts();
    } catch (err: any) {
      console.error("Bulk action failed", err);
      alert(err.message || "Bulk action failed");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Open Multi-Variant Quick Edit Modal
  const openVariantQuickEdit = (product: Product) => {
    setQuickEditProduct(product);
    const vals = product.variant_option?.optionValues || [];
    setQuickEditVariantRows(
      vals.map((v) => ({
        value: v.value,
        price: v.price != null ? String(v.price) : "",
        comparePrice:
          (v as any).comparePrice != null ? String((v as any).comparePrice) : "",
        stockQty: v.stockQty != null ? String(v.stockQty) : "",
        inStock: v.inStock !== false,
      }))
    );
  };

  // Save Multi-Variant Quick Edit
  const handleSaveVariantQuickEdit = async () => {
    if (!siteId || !quickEditProduct) return;
    setIsQuickSaving(true);
    try {
      const updatedValues = quickEditVariantRows.map((row) => ({
        value: row.value.trim(),
        price: row.price.trim() === "" ? null : Number(row.price),
        comparePrice: row.comparePrice.trim() === "" ? null : Number(row.comparePrice),
        stockQty: row.stockQty.trim() === "" ? null : Number(row.stockQty),
        inStock: row.inStock,
      }));

      const payload = {
        variant_option: {
          optionType: quickEditProduct.variant_option?.optionType || "custom",
          optionName: quickEditProduct.variant_option?.optionName || "Options",
          optionValues: updatedValues,
        },
      };

      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products/${quickEditProduct.id}/quick-edit`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) {
        setQuickEditProduct(null);
        invalidateAdminProductsCache(siteId);
        await loadProducts();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to update variants");
      }
    } catch (err: any) {
      console.error("Variant quick edit failed", err);
      alert(err.message || "Variant quick edit failed");
    } finally {
      setIsQuickSaving(false);
    }
  };

  // Quick Inline Table Save for Single Products
  const handleQuickSave = async (productId: string) => {
    if (!siteId) return;
    setIsQuickSaving(true);
    try {
      const payload: any = {};
      if (inlinePrice.trim() !== "") payload.price = Number(inlinePrice);
      if (inlineStock.trim() !== "") payload.stock = Number(inlineStock);

      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products/${productId}/quick-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setInlineEditingId(null);
        invalidateAdminProductsCache(siteId);
        await loadProducts();
      } else {
        alert("Failed to update product details");
      }
    } catch (err) {
      console.error("Quick edit failed", err);
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleExportCSV = async () => {
    if (!siteId) return;
    setIsExportingCSV(true);
    try {
      const qParams = new URLSearchParams();
      if (searchQuery && searchQuery.trim()) qParams.set("search", searchQuery.trim());
      if (statusFilter !== "all") qParams.set("status", statusFilter);
      if (filterCategory) qParams.set("category_id", filterCategory);
      if (filterCollection) qParams.set("collection_id", filterCollection);
      if (filterBrand) qParams.set("brand", filterBrand);
      if (filterMinPrice) qParams.set("min_price", filterMinPrice);
      if (filterMaxPrice) qParams.set("max_price", filterMaxPrice);
      if (filterDiscount === "discounted") qParams.set("has_discount", "true");
      else if (filterDiscount === "regular") qParams.set("has_discount", "false");
      if (filterReturnPolicy === "non_returnable") qParams.set("return_policy", "non_returnable");
      else if (filterReturnPolicy === "returnable") qParams.set("return_policy", "returnable");
      if (filterHasVideo === "with_video") qParams.set("has_video", "true");
      else if (filterHasVideo === "images_only") qParams.set("has_video", "false");
      if (filterSortBy && filterSortBy !== "newest") qParams.set("sort_by", filterSortBy);

      const qs = qParams.toString();
      const exportUrl = `${API_BASE_URL}/sites/${siteId}/products/export-csv${qs ? `?${qs}` : ""}`;
      const res = await fetch(exportUrl, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to export products CSV");
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const isFiltered = qs.length > 0;
      link.setAttribute("download", isFiltered ? `products_filtered_${siteId}.csv` : `products_${siteId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Failed to export products CSV", err);
      alert(err.message || "Failed to export products CSV");
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportSelectedCSV = async () => {
    if (!siteId || selectedProductIds.size === 0) return;
    setIsExportingCSV(true);
    try {
      const ids = Array.from(selectedProductIds).join(",");
      const exportUrl = `${API_BASE_URL}/sites/${siteId}/products/export-csv?ids=${encodeURIComponent(ids)}`;
      const res = await fetch(exportUrl, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to export selected products CSV");
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `products_selected_${siteId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Failed to export selected products CSV", err);
      alert(err.message || "Failed to export selected products CSV");
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleDownloadSampleCSV = async () => {
    if (!siteId) return;
    try {
      const sampleUrl = `${API_BASE_URL}/sites/${siteId}/products/sample-csv`;
      const res = await fetch(sampleUrl, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to download sample CSV");
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", "sample_products_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Failed to download sample CSV", err);
      alert(err.message || "Failed to download sample CSV");
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !importFile) return;

    setIsImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("default_status", defaultImportStatus);

    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products/import-csv`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Import failed");
      }

      setImportResult(data);
      const totalChanges = (data.created_count || 0) + (data.updated_count || 0);
      if (totalChanges > 0) {
        try {
          const [catRes, colRes] = await Promise.all([
            fetch(`${API_BASE_URL}/sites/${siteId}/categories`, { credentials: "include" }),
            fetch(`${API_BASE_URL}/sites/${siteId}/collections`, { credentials: "include" }),
          ]);
          if (catRes.ok) setCategories(await catRes.json());
          if (colRes.ok) setCollections(await colRes.json());
        } catch (fetchErr) {
          console.error("Error refreshing categories/collections after import", fetchErr);
        }
        invalidateAdminProductsCache(siteId);
        await loadProducts({ page: 1 });
      }
    } catch (err: any) {
      console.error("CSV Import error", err);
      alert(err.message || "Failed to import CSV");
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleCollectionBadge = async (collectionId: string) => {
    if (!siteId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/collections/${collectionId}/toggle-badge`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setCollections((prev) =>
          prev.map((col) => (col.id === collectionId ? updated : col))
        );
      } else {
        alert("Failed to update collection badge status");
      }
    } catch (err) {
      console.error("Error toggling collection badge", err);
    }
  };

  const handleDuplicateProduct = async (productId: string) => {
    if (!siteId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products/${productId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to duplicate product");
      }

      invalidateAdminProductsCache(siteId);
      await loadProducts();
    } catch (err: any) {
      console.error("Duplicate failed", err);
      alert(err.message || "Failed to duplicate product");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) return;
    if (!validateForm()) return;

    const hasVariantOptions =
      variantRows.length > 0 && formValues.optionName.trim() !== "";

    const effectivePrice = hasVariantOptions
      ? getFallbackProductPrice()
      : Number(formValues.price) || 0;
    const effectiveComparePrice = hasVariantOptions
      ? getFallbackComparePrice()
      : formValues.compare_price.trim()
      ? Number(formValues.compare_price)
      : null;
    const effectiveStock = hasVariantOptions
      ? getFallbackStock()
      : formValues.stock.trim()
      ? Number(formValues.stock)
      : 0;

    const cleanHighlights = formValues.highlights
      .split("\n")
      .map((h) => h.trim())
      .filter(Boolean);

    const payload = {
      name: formValues.name.trim(),
      brand: formValues.brand.trim() || null,
      category: formValues.category.trim(),
      category_id: formValues.categoryId ? formValues.categoryId : null,
      collection_ids: formValues.selectedCollectionIds,
      description: formValues.description.trim(),
      highlights: cleanHighlights,
      price: effectivePrice,
      compare_price: effectiveComparePrice,
      stock: effectiveStock,
      in_stock: hasVariantOptions
        ? variantRows.some((row) => row.inStock && Number(row.stockQty || 0) > 0)
        : effectiveStock > 0,
      is_active: formValues.is_active,
      sku: formValues.sku.trim() || null,
      hsn_code: formValues.hsn_code.trim() || null,
      video_url: formValues.video_url.trim() || null,
      video_position: Number(formValues.video_position) || 2,
      sibling_group: formValues.sibling_group.trim() || null,
      sibling_label: formValues.sibling_label.trim() || null,
      weight_grams: Number(formValues.weight_grams) || 500,
      length_cm: formValues.length_cm.trim() ? Number(formValues.length_cm) : null,
      width_cm: formValues.width_cm.trim() ? Number(formValues.width_cm) : null,
      height_cm: formValues.height_cm.trim() ? Number(formValues.height_cm) : null,
      slug: formValues.slug.trim() || null,
      images: parseImages(formValues.imagesText),
      variant_option: hasVariantOptions ? buildVariantOption() : null,
      return_window_days: formValues.return_window_days === "" ? null : Number(formValues.return_window_days),
    };

    try {
      if (editingProduct) {
        const res = await fetch(
          `${API_BASE_URL}/sites/${siteId}/products/${editingProduct.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          await loadProducts();
        } else {
          console.error("Failed to update product", res.status);
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          invalidateAdminProductsCache(siteId);
          await loadProducts();
        } else {
          console.error("Failed to create product", res.status);
        }
      }
    } catch (err) {
      console.error("Error saving product", err);
    } finally {
      setShowForm(false);
      resetForm();
    }
  };

  const handleDelete = async (productId: string) => {
    if (!siteId) return;
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products/${productId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        invalidateAdminProductsCache(siteId);
        await loadProducts();
      } else {
        console.error("Failed to delete product", res.status);
      }
    } catch (err) {
      console.error("Error deleting product", err);
    }
  };

  return (
    <div style={{ width: "100%", color: "#0f172a", display: "flex", flexDirection: "column", gap: "10px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        @keyframes storeShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {/* Top Header Card (Mode Switcher + Search & Filter Button) */}
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
          {/* Mode Pill (Products) */}
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
              Products
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
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setCurrentPage(1);
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                  searchTimerRef.current = setTimeout(() => {
                    loadProducts({ page: 1, search: val });
                  }, 350);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                    setCurrentPage(1);
                    loadProducts({ page: 1, search: searchQuery });
                  }
                }}
                placeholder="Search products by title, SKU, brand, category..."
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
                  onClick={() => {
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                    setSearchQuery("");
                    setCurrentPage(1);
                    loadProducts({ page: 1, search: "" });
                  }}
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
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Filter Products</span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCategory("");
                        setFilterCollection("");
                        setFilterBrand("");
                        setFilterMinPrice("");
                        setFilterMaxPrice("");
                        setFilterDiscount("all");
                        setFilterReturnPolicy("all");
                        setFilterHasVideo("all");
                        setFilterSortBy("newest");
                        setCurrentPage(1);
                        loadProducts({
                          page: 1,
                          catId: "",
                          colId: "",
                          brand: "",
                          minP: "",
                          maxP: "",
                          discount: "all",
                          retPol: "all",
                          hasVid: "all",
                          sortB: "newest",
                        });
                        setShowFilterPopover(false);
                      }}
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

                {/* Filter by Category */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Collection */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Collection / Badge</label>
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

                {/* Filter by Brand */}
                {availableBrands.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Brand</label>
                    <select
                      value={filterBrand}
                      onChange={(e) => setFilterBrand(e.target.value)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    >
                      <option value="">All Brands</option>
                      {availableBrands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Price Range */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Price Range (₹)</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="number"
                      placeholder="Min"
                      value={filterMinPrice}
                      onChange={(e) => setFilterMinPrice(e.target.value)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    />
                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={filterMaxPrice}
                      onChange={(e) => setFilterMaxPrice(e.target.value)}
                      style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                    />
                  </div>
                </div>

                {/* Discount Status */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Discount / Offer</label>
                  <select
                    value={filterDiscount}
                    onChange={(e) => setFilterDiscount(e.target.value as any)}
                    style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                  >
                    <option value="all">All Products</option>
                    <option value="discounted">Discounted Only (On Sale)</option>
                    <option value="regular">Regular Price Only</option>
                  </select>
                </div>

                {/* Return Policy Filter */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Returns</label>
                  <select
                    value={filterReturnPolicy}
                    onChange={(e) => setFilterReturnPolicy(e.target.value as any)}
                    style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                  >
                    <option value="all">All</option>
                    <option value="returnable">Returnable</option>
                    <option value="non_returnable">Non-Returnable</option>
                  </select>
                </div>

                {/* Video Media Filter */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Media / Video</label>
                  <select
                    value={filterHasVideo}
                    onChange={(e) => setFilterHasVideo(e.target.value as any)}
                    style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                  >
                    <option value="all">All Media</option>
                    <option value="with_video">Has Product Video</option>
                    <option value="images_only">Photos Only</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Sort By</label>
                  <select
                    value={filterSortBy}
                    onChange={(e) => setFilterSortBy(e.target.value)}
                    style={{ ...inputStyle, fontSize: "12.5px", padding: "5px 8px" }}
                  >
                    <option value="newest">Newest Added</option>
                    <option value="oldest">Oldest Added</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="stock_asc">Stock: Low to High</option>
                    <option value="stock_desc">Stock: High to Low</option>
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                  </select>
                </div>

                {/* Apply Filters Button */}
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(1);
                      loadProducts({
                        page: 1,
                        catId: filterCategory,
                        colId: filterCollection,
                        brand: filterBrand,
                        minP: filterMinPrice,
                        maxP: filterMaxPrice,
                        discount: filterDiscount,
                        retPol: filterReturnPolicy,
                        hasVid: filterHasVideo,
                        sortB: filterSortBy,
                      });
                      setShowFilterPopover(false);
                    }}
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

      {/* Active Filter Chips (if any filters active) */}
        {activeFilterCount > 0 && (
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
              paddingTop: "6px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, marginRight: "2px" }}>
              Active:
            </span>

            {filterCategory && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Category: {categories.find((c) => c.id === filterCategory)?.name || filterCategory}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory("");
                    setCurrentPage(1);
                    loadProducts({ page: 1, catId: "" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {filterCollection && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Collection: {collections.find((c) => c.id === filterCollection)?.name || filterCollection}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterCollection("");
                    setCurrentPage(1);
                    loadProducts({ page: 1, colId: "" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {filterBrand && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Brand: {filterBrand}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterBrand("");
                    setCurrentPage(1);
                    loadProducts({ page: 1, brand: "" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {(filterMinPrice || filterMaxPrice) && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Price: ₹{filterMinPrice || "0"} – ₹{filterMaxPrice || "∞"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMinPrice("");
                    setFilterMaxPrice("");
                    setCurrentPage(1);
                    loadProducts({ page: 1, minP: "", maxP: "" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {filterDiscount !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>{filterDiscount === "discounted" ? "Discounted Only" : "Regular Price"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterDiscount("all");
                    setCurrentPage(1);
                    loadProducts({ page: 1, discount: "all" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {filterReturnPolicy !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>{filterReturnPolicy === "non_returnable" ? "Non-Returnable Only" : "Returnable Only"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterReturnPolicy("all");
                    setCurrentPage(1);
                    loadProducts({ page: 1, retPol: "all" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {filterHasVideo !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>{filterHasVideo === "with_video" ? "With Video" : "Photos Only"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterHasVideo("all");
                    setCurrentPage(1);
                    loadProducts({ page: 1, hasVid: "all" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {filterSortBy !== "newest" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Sort: {filterSortBy}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterSortBy("newest");
                    setCurrentPage(1);
                    loadProducts({ page: 1, sortB: "newest" });
                  }}
                  style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setFilterCategory("");
                setFilterCollection("");
                setFilterBrand("");
                setFilterMinPrice("");
                setFilterMaxPrice("");
                setFilterDiscount("all");
                setFilterReturnPolicy("all");
                setFilterHasVideo("all");
                setFilterSortBy("newest");
                setCurrentPage(1);
                loadProducts({
                  page: 1,
                  catId: "",
                  colId: "",
                  brand: "",
                  minP: "",
                  maxP: "",
                  discount: "all",
                  retPol: "all",
                  hasVid: "all",
                  sortB: "newest",
                });
              }}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                marginLeft: "2px",
                padding: "2px 4px",
              }}
            >
              Clear All
            </button>
          </div>
        )}
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
        {/* Total Products */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#334155", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {totalProducts}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Total Products
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

        {/* In Stock */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#16a34a", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {inStockCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            In Stock
          </div>
        </div>

        {/* Low Stock (≤5) */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#d97706", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {lowStockCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Low Stock (≤5)
          </div>
        </div>

        {/* Out of Stock */}
        <div style={{ ...plainCardStyle, padding: "12px 14px", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#ef4444", lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
            {outOfStockCount}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 500, color: "#555555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            Out of Stock
          </div>
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
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
              setShowForm(false);
              resetForm();
            }
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "1100px",
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
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : "Add New Product"}
                </h2>
                {editingProduct?.sku && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    SKU: {editingProduct.sku}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                {/* Product Status (Draft vs Active) Switch */}
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
                      color: formValues.is_active ? "#15803d" : "#64748b",
                    }}
                  >
                    {formValues.is_active ? "● Live on Store" : "○ Draft (Hidden)"}
                  </span>
                  <ToggleSwitch
                    checked={formValues.is_active}
                    onChange={(val) => handleFormChange("is_active", val)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
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
                  title="Close form"
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "visible",
              }}
            >
              {/* Form Body - 2 Column Industrial Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: "14px",
                  padding: "16px 20px",
                  background: "#f8fafc",
                }}
              >
                {/* Left Main Column: Basic Info, Media, Highlights & Sub-Variants */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
                  {/* Card 1: Basic Information */}
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
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "8px",
                      }}
                    >
                      General Information
                    </div>

                    <FormField
                      label="Product Title / Name *"
                      value={formValues.name}
                      onChange={(v) => handleFormChange("name", v)}
                      error={errors.name}
                      placeholder="e.g. Wireless Noise-Cancelling Headphones"
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <FormField
                        label="Brand (Optional)"
                        value={formValues.brand}
                        onChange={(v) => handleFormChange("brand", v)}
                        placeholder="e.g. Sony, Apple, Nike"
                      />
                      <FormField
                        label="Product Type *"
                        value={formValues.category}
                        onChange={(v) => handleFormChange("category", v)}
                        error={errors.category}
                        placeholder="e.g. Over-Ear Headphones"
                      />
                    </div>
                  </div>

                  {/* Card 2: Photos & Media Gallery */}
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
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0f172a",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Product Photos & Gallery
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                          First photo is the default cover on catalog cards.
                        </span>
                      </div>

                      <label
                        style={{
                          ...primaryButtonStyle,
                          padding: "6px 12px",
                          fontSize: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <span>+ Upload Photos</span>
                        <input
                          type="file"
                          multiple
                          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleBatchImageUpload(e.target.files);
                              e.target.value = "";
                            }
                          }}
                          style={{ display: "none" }}
                        />
                      </label>
                    </div>

                    {isUploadingImage && (
                      <div style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
                        Uploading images, please wait...
                      </div>
                    )}

                    {imagePreviewList.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                          gap: "8px",
                        }}
                      >
                        {imagePreviewList.map((image, index) => {
                          const isCover = index === 0;
                          return (
                            <div
                              key={`${image}-${index}`}
                              style={{
                                borderRadius: "6px",
                                border: isCover ? "2px solid #2563eb" : "1px solid #cbd5e1",
                                background: "#f8fafc",
                                padding: "4px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                                position: "relative",
                              }}
                            >
                              {isCover && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "6px",
                                    left: "6px",
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: "3px",
                                    letterSpacing: "0.04em",
                                    zIndex: 2,
                                  }}
                                >
                                  COVER
                                </div>
                              )}
                              <img
                                src={getOptimizedThumbnailUrl(image, 240, 180)}
                                alt={`Photo ${index + 1}`}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: "100%",
                                  height: "90px",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                  background: "#ffffff",
                                }}
                              />
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "2px",
                                }}
                              >
                                <button
                                  type="button"
                                  title="Move Left"
                                  disabled={index === 0}
                                  onClick={() => moveImage(index, index - 1)}
                                  style={{
                                    ...ghostButtonStyle,
                                    padding: "2px 6px",
                                    fontSize: "10px",
                                    opacity: index === 0 ? 0.3 : 1,
                                    height: "24px",
                                  }}
                                >
                                  ←
                                </button>
                                {!isCover && (
                                  <button
                                    type="button"
                                    title="Set as Cover Photo"
                                    onClick={() => setAsCoverImage(index)}
                                    style={{
                                      border: "1px solid #cbd5e1",
                                      background: "#ffffff",
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      padding: "2px 5px",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      height: "24px",
                                      color: "#334155",
                                    }}
                                  >
                                    Set Cover
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Move Right"
                                  disabled={index === imagePreviewList.length - 1}
                                  onClick={() => moveImage(index, index + 1)}
                                  style={{
                                    ...ghostButtonStyle,
                                    padding: "2px 6px",
                                    fontSize: "10px",
                                    opacity: index === imagePreviewList.length - 1 ? 0.3 : 1,
                                    height: "24px",
                                  }}
                                >
                                  →
                                </button>
                                <button
                                  type="button"
                                  title="Remove Photo"
                                  onClick={() => removeImage(index)}
                                  style={{
                                    ...dangerButtonStyle,
                                    padding: "2px 5px",
                                    fontSize: "10px",
                                    height: "24px",
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <FormField
                      label="Direct Image URLs (one URL per line)"
                      value={formValues.imagesText}
                      onChange={(v) => handleFormChange("imagesText", v)}
                      multiline
                      error={errors.imagesText}
                      placeholder="https://images.example.com/product-1.jpg"
                    />

                    {/* Video Section */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: formValues.video_url.trim() ? "1fr 160px" : "1fr",
                        gap: "10px",
                        alignItems: "end",
                        background: "#f8fafc",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <FormField
                        label="Product Video URL (YouTube, Vimeo, or direct MP4)"
                        value={formValues.video_url}
                        onChange={(v) => handleFormChange("video_url", v)}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />

                      {formValues.video_url.trim() && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <label style={{ ...labelStyle, fontSize: "12px", fontWeight: 600 }}>
                            Video Slot
                          </label>
                          <select
                            value={formValues.video_position}
                            onChange={(e) => handleFormChange("video_position", Number(e.target.value))}
                            style={{ ...inputStyle, height: "34px", fontSize: "12px", padding: "4px 8px" }}
                          >
                            <option value="0">1st (Cover Video)</option>
                            <option value="1">2nd (After Photo 1)</option>
                            <option value="2">3rd (Recommended)</option>
                            <option value="3">4th</option>
                            <option value="99">Last Slot</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Highlights & Detailed Description */}
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
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "8px",
                      }}
                    >
                      Description & Key Highlights
                    </div>

                    {/* Highlights */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={labelStyle}>Top Highlights (Hero Section Bullets)</span>
                        {(() => {
                          const words = formValues.highlights.trim()
                            ? formValues.highlights.trim().split(/\s+/).filter(Boolean).length
                            : 0;
                          const isOver = words > 50;
                          return (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: isOver ? "#fee2e2" : "#f1f5f9",
                                color: isOver ? "#b91c1c" : "#64748b",
                                border: isOver ? "1px solid #fca5a5" : "1px solid #e2e8f0",
                              }}
                            >
                              {words} / 50 words {isOver ? "(Exceeded)" : ""}
                            </span>
                          );
                        })()}
                      </div>
                      <textarea
                        value={formValues.highlights}
                        onChange={(e) => handleFormChange("highlights", e.target.value)}
                        placeholder={`- Active Noise Cancellation with Transparency Mode\n- 40-Hour Battery Life with Fast USB-C Charging\n- Custom 40mm Dynamic Drivers for Deep Bass\n- Bluetooth 5.3 Multipoint Connection`}
                        rows={3}
                        style={{
                          ...inputStyle,
                          fontFamily: "inherit",
                          resize: "vertical",
                          lineHeight: 1.5,
                          fontSize: "13px",
                          borderColor:
                            errors.highlights ||
                            (formValues.highlights.trim() &&
                              formValues.highlights.trim().split(/\s+/).filter(Boolean).length > 50)
                              ? "#ef4444"
                              : "#cbd5e1",
                        }}
                      />
                      {errors.highlights && <span style={errorStyle}>{errors.highlights}</span>}
                    </div>

                    {/* Full Description */}
                    <div>
                      <FormField
                        label="Full Product Description (Detailed Accordion) *"
                        value={formValues.description}
                        onChange={(v) => handleFormChange("description", v)}
                        multiline
                        error={errors.description}
                        placeholder="Detailed product features, specifications, box contents, warranty information..."
                      />
                      <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
                        Supports Markdown headings (<code>#</code>, <code>##</code>), paragraphs, and bullet lists.
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Sub-Variants (Size / Storage / Specs) */}
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
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0f172a",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Sub-Variant Options (Size / Storage / Specs)
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                          Optional. Use if product has sizes or spec tiers. Leave empty for color-only products.
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: "#64748b",
                          background: "#f1f5f9",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        Optional
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px", alignItems: "start" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={labelStyle}>Option Preset</span>
                        <select
                          value={formValues.optionType}
                          onChange={(e) =>
                            handleFormChange("optionType", e.target.value as ProductVariantOption["optionType"])
                          }
                          style={{ ...inputStyle, height: "34px", fontSize: "12px", padding: "4px 8px" }}
                        >
                          <option value="custom">Custom (or None)</option>
                          <option value="size">Size</option>
                          <option value="weight">Weight</option>
                          <option value="shoe_size">Shoe Size</option>
                          <option value="volume">Volume</option>
                          <option value="pack_size">Pack Size</option>
                        </select>
                      </label>

                      <FormField
                        label="Option Name"
                        value={formValues.optionName}
                        onChange={(v) => handleFormChange("optionName", v)}
                        error={errors.optionName}
                        placeholder="e.g. Storage, Size, RAM (leave empty if none)"
                      />
                    </div>

                    <FormField
                      label="Option Values (comma-separated)"
                      value={formValues.optionValuesText}
                      onChange={(v) => handleFormChange("optionValuesText", v)}
                      error={errors.optionValuesText}
                      placeholder="e.g. 128GB, 256GB, 512GB (leave empty if none)"
                    />

                    {variantRows.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                          Variant Pricing & Inventory Matrix
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {variantRows.map((row, index) => {
                            const discountPercent = getVariantDiscountPercent(row.price, row.comparePrice);

                            return (
                              <div
                                key={`${row.value}-${index}`}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1.2fr 1fr 1fr 1fr 90px 80px",
                                  gap: "8px",
                                  alignItems: "center",
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #e2e8f0",
                                  background: "#f8fafc",
                                }}
                              >
                                <FormField
                                  label="Value"
                                  value={row.value}
                                  onChange={(v) => handleVariantRowChange(index, "value", v)}
                                />
                                <FormField
                                  label="Price (₹) *"
                                  type="number"
                                  value={row.price}
                                  onChange={(v) => handleVariantRowChange(index, "price", v)}
                                />
                                <FormField
                                  label="MRP (₹)"
                                  type="number"
                                  value={row.comparePrice}
                                  onChange={(v) => handleVariantRowChange(index, "comparePrice", v)}
                                />
                                <FormField
                                  label="Stock Qty"
                                  type="number"
                                  value={row.stockQty}
                                  onChange={(v) => handleVariantRowChange(index, "stockQty", v)}
                                />
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    color: "#334155",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    paddingTop: "14px",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={row.inStock}
                                    onChange={(e) => handleVariantRowChange(index, "inStock", e.target.checked)}
                                  />
                                  In stock
                                </label>

                                <div
                                  style={{
                                    paddingTop: "14px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: discountPercent ? "#15803d" : "#94a3b8",
                                    textAlign: "right",
                                  }}
                                >
                                  {discountPercent ? `${discountPercent}% off` : "No sale"}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {errors.variantRows && <span style={errorStyle}>{errors.variantRows}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Sidebar Column: Pricing, Organization, Shipping, Color Family */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
                  {/* Card 5: Base Pricing & Inventory */}
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
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#0f172a",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Base Pricing & Inventory
                      </span>
                      {(() => {
                        const basePrice = Number(formValues.price);
                        const baseCompare = Number(formValues.compare_price);
                        if (basePrice > 0 && baseCompare > basePrice) {
                          const pct = Math.round(((baseCompare - basePrice) / baseCompare) * 100);
                          return (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#15803d",
                                background: "#dcfce7",
                                border: "1px solid #bbf7d0",
                                padding: "2px 7px",
                                borderRadius: "999px",
                              }}
                            >
                              {pct}% OFF
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <FormField
                        label="Selling Price (₹) *"
                        type="number"
                        value={formValues.price}
                        onChange={(v) => handleFormChange("price", v)}
                        error={errors.price}
                        placeholder="1999"
                      />
                      <FormField
                        label="MRP / Strike Price (₹)"
                        type="number"
                        value={formValues.compare_price}
                        onChange={(v) => handleFormChange("compare_price", v)}
                        error={errors.compare_price}
                        placeholder="2999"
                      />
                    </div>

                    <FormField
                      label="Available Stock Quantity *"
                      type="number"
                      value={formValues.stock}
                      onChange={(v) => handleFormChange("stock", v)}
                      error={errors.stock}
                      placeholder="50"
                    />
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Set stock to 0 to mark product as Out of Stock.
                    </span>
                  </div>

                  {/* Card 6: Organization, Taxonomy & Policies */}
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
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "8px",
                      }}
                    >
                      Organization & Taxonomy
                    </div>

                    {/* Broad Category */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={labelStyle}>Category</label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <select
                          value={formValues.categoryId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const catObj = categories.find((c) => c.id === selectedId);
                            handleFormChange("categoryId", selectedId);
                            if (catObj && !formValues.category) {
                              handleFormChange("category", catObj.name);
                            }
                          }}
                          style={{ ...inputStyle, flex: 1, height: "34px", fontSize: "13px", padding: "4px 8px" }}
                        >
                          <option value="">Select Category (Optional)</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowAddCategory(!showAddCategory)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#f8fafc",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          + New
                        </button>
                        {formValues.categoryId && (
                          <button
                            type="button"
                            onClick={() => {
                              const cat = categories.find((c) => c.id === formValues.categoryId);
                              if (cat) handleDeleteCategory(cat.id, cat.name);
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#dc2626",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                            title="Delete currently selected category"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      {showAddCategory && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          <input
                            type="text"
                            placeholder="Category name (e.g. Men)"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            style={{ ...inputStyle, flex: 1, height: "30px", fontSize: "12px", padding: "4px 8px" }}
                          />
                          <button
                            type="button"
                            onClick={handleCreateCategoryInline}
                            style={{ ...primaryButtonStyle, padding: "4px 10px", fontSize: "11px" }}
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Return Policy */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={labelStyle}>Return Policy</label>
                      <select
                        value={formValues.return_window_days}
                        onChange={(e) => handleFormChange("return_window_days", e.target.value)}
                        style={{ ...inputStyle, height: "34px", fontSize: "13px", padding: "4px 8px" }}
                      >
                        <option value="">Use Store Default ({defaultReturnWindowDays} Days)</option>
                        <option value="0">Non-Returnable (Final Sale - Instant Payout)</option>
                        <option value="2">2 Days Returnable</option>
                        <option value="7">7 Days Returnable</option>
                        <option value="10">10 Days Returnable</option>
                        <option value="14">14 Days Returnable</option>
                        <option value="30">30 Days Returnable</option>
                      </select>
                    </div>

                    {/* Collections & Badges */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={labelStyle}>Collections & Badges</span>
                        <button
                          type="button"
                          onClick={() => setShowAddCollection(!showAddCollection)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#2563eb",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          + New Collection
                        </button>
                      </div>

                      {showAddCollection && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            background: "#f8fafc",
                            padding: "8px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                          }}
                        >
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input
                              type="text"
                              placeholder="Collection name (e.g. Bestsellers)"
                              value={newCollectionName}
                              onChange={(e) => setNewCollectionName(e.target.value)}
                              style={{ ...inputStyle, flex: 1, height: "30px", fontSize: "12px", padding: "4px 8px" }}
                            />
                            <button
                              type="button"
                              onClick={handleCreateCollectionInline}
                              style={{ ...primaryButtonStyle, padding: "4px 10px", fontSize: "11px" }}
                            >
                              Save
                            </button>
                          </div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "11px",
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            <ToggleSwitch checked={newCollectionIsBadge} onChange={setNewCollectionIsBadge} />
                            <span>Display as Card Badge (e.g. Bestseller tag)</span>
                          </label>
                        </div>
                      )}

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                        {collections.map((col) => {
                          const selected = formValues.selectedCollectionIds.includes(col.id);
                          return (
                            <div
                              key={col.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                borderRadius: "999px",
                                border: selected ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
                                background: selected ? "#eff6ff" : "#ffffff",
                                padding: "2px 4px 2px 10px",
                                gap: "4px",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span
                                onClick={() => {
                                  const next = selected
                                    ? formValues.selectedCollectionIds.filter((id) => id !== col.id)
                                    : [...formValues.selectedCollectionIds, col.id];
                                  handleFormChange("selectedCollectionIds", next);
                                }}
                                style={{
                                  fontSize: "12px",
                                  fontWeight: selected ? 700 : 500,
                                  color: selected ? "#2563eb" : "#334155",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                              >
                                {selected ? "✓ " : ""}
                                {col.name}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCollectionBadge(col.id);
                                }}
                                style={{
                                  border: col.is_badge ? "1px solid #fcd34d" : "1px solid #e2e8f0",
                                  borderRadius: "999px",
                                  padding: "1px 6px",
                                  fontSize: "9.5px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  background: col.is_badge ? "#fef3c7" : "#f8fafc",
                                  color: col.is_badge ? "#92400e" : "#64748b",
                                }}
                                title={col.is_badge ? "Badge active on card" : "Click to set as card badge"}
                              >
                                {col.is_badge ? "Badge" : "+ Badge"}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCollection(col.id, col.name);
                                }}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "#94a3b8",
                                  padding: "1px 4px",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                                title={`Delete collection "${col.name}"`}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                        {collections.length === 0 && (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            No collections yet. Click "+ New Collection" above.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 7: Shipping Dimensions, SKU & Tax */}
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
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "8px",
                      }}
                    >
                      Shipping & Identifiers
                    </div>

                    <FormField
                      label="Shipping Weight (Grams)"
                      type="number"
                      value={formValues.weight_grams}
                      onChange={(v) => handleFormChange("weight_grams", v)}
                      placeholder="500"
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      <FormField
                        label="Length (cm)"
                        type="number"
                        value={formValues.length_cm}
                        onChange={(v) => handleFormChange("length_cm", v)}
                        placeholder="10"
                      />
                      <FormField
                        label="Width (cm)"
                        type="number"
                        value={formValues.width_cm}
                        onChange={(v) => handleFormChange("width_cm", v)}
                        placeholder="10"
                      />
                      <FormField
                        label="Height (cm)"
                        type="number"
                        value={formValues.height_cm}
                        onChange={(v) => handleFormChange("height_cm", v)}
                        placeholder="5"
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <FormField
                        label="SKU / Barcode"
                        value={formValues.sku}
                        onChange={(v) => handleFormChange("sku", v)}
                        placeholder="WH-1000XM5-BLK"
                      />
                      <FormField
                        label="HSN / Tax Code"
                        value={formValues.hsn_code}
                        onChange={(v) => handleFormChange("hsn_code", v)}
                        placeholder="85183000"
                      />
                    </div>
                  </div>

                  {/* Card 8: Color Family & Sibling Variations */}
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
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#0f172a",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Color Family Variations
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#6d28d9",
                          background: "#f5f3ff",
                          border: "1px solid #ddd6fe",
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        Multi-Color Linking
                      </span>
                    </div>

                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Group different color variants under the same Family Tag (e.g. <code>iphone-17-series</code>) to let customers switch colors on the storefront.
                    </span>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <FormField
                        label="Family Tag"
                        value={formValues.sibling_group}
                        onChange={(v) => handleFormChange("sibling_group", v)}
                        placeholder="e.g. sony-xm5"
                      />
                      <FormField
                        label="Color Label"
                        value={formValues.sibling_label}
                        onChange={(v) => handleFormChange("sibling_label", v)}
                        placeholder="e.g. Midnight Black"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Footer Action Bar */}
              <div
                style={{
                  position: "sticky",
                  bottom: 0,
                  zIndex: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#ffffff",
                  boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {editingProduct ? "Editing existing catalog product" : "Ready to publish to storefront catalog"}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    style={ghostButtonStyle}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      ...primaryButtonStyle,
                      padding: "8px 18px",
                      fontSize: "13px",
                    }}
                    disabled={isUploadingImage}
                  >
                    {editingProduct ? "Save Changes" : "Publish / Create Product"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Status Filter Tabs & Action Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          borderBottom: "1px solid #e2e8f0",
          marginTop: "4px",
        }}
      >
        {/* Status Navigation Tabs */}
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
            { key: "all", label: "All Products", count: totalProducts },
            { key: "active", label: "Active (Live)", count: activeCount },
            { key: "draft", label: "Drafts", count: draftCount },
            { key: "low_stock", label: "Low Stock", count: lowStockCount },
            { key: "out_of_stock", label: "Out of Stock", count: outOfStockCount },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (statusFilter === tab.key) return;
                  setSelectedProductIds(new Set());
                  const nextStatus = tab.key as any;
                  setStatusFilter(nextStatus);
                  setCurrentPage(1);

                  const cacheKey = `${siteId}:${nextStatus}:1:${pageSize}:${searchQuery}:${filterCategory}:${filterCollection}:${filterBrand}:${filterMinPrice}:${filterMaxPrice}:${filterDiscount}:${filterReturnPolicy}:${filterHasVideo}:${filterSortBy}`;
                  const cached = adminProductsQueryCache.get(cacheKey);
                  if (cached) {
                    setProducts(cached.products);
                    setTotalProducts(cached.totalProducts);
                    setFilteredTotal(cached.filteredTotal);
                    setTotalPages(cached.totalPages);
                    setIsLoading(false);
                  } else {
                    setProducts([]);
                    setIsLoading(true);
                  }
                }}
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

        {/* Right Action Toolbar: Bulk Actions or Store Default Return Policy */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, paddingBottom: "6px" }}>
          {selectedProductIds.size > 0 ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "3px 4px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {/* Selection Count Pill */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "5px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#1d4ed8",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{selectedProductIds.size} Selected</span>
              </div>

              <div style={{ width: "1px", height: "16px", background: "#e2e8f0", margin: "0 2px" }} />

              {/* Bulk Publish */}
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => handleBulkAction("make_active")}
                title="Publish selected products live to store"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                  color: "#166534",
                  cursor: bulkActionLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <CheckCircleIcon />
                <span>{bulkActionLoading ? "Publishing..." : "Publish"}</span>
              </button>

              {/* Bulk Draft */}
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => handleBulkAction("make_draft")}
                title="Hide selected products from store"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  cursor: bulkActionLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <EyeOffIcon />
                <span>{bulkActionLoading ? "Drafting..." : "Draft"}</span>
              </button>

              {/* Bulk Duplicate */}
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => handleBulkAction("duplicate")}
                title="Duplicate selected products"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  cursor: bulkActionLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <CopyIcon />
                <span>{bulkActionLoading ? "Copying..." : "Duplicate"}</span>
              </button>

              {/* Bulk CSV Export */}
              <button
                type="button"
                disabled={isExportingCSV}
                onClick={handleExportSelectedCSV}
                title="Export selected products to CSV"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  cursor: isExportingCSV ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <DownloadIcon />
                <span>{isExportingCSV ? "Exporting..." : "CSV"}</span>
              </button>

              {/* Bulk Delete */}
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => handleBulkAction("delete")}
                title="Permanently delete selected products"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#dc2626",
                  cursor: bulkActionLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <TrashIcon />
                <span>Delete</span>
              </button>

              <div style={{ width: "1px", height: "16px", background: "#e2e8f0", margin: "0 2px" }} />

              {/* Clear Selection */}
              <button
                type="button"
                onClick={() => setSelectedProductIds(new Set())}
                title="Clear selection"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "26px",
                  height: "26px",
                  borderRadius: "4px",
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fee2e2";
                  e.currentTarget.style.color = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#64748b";
                }}
              >
                <XMarkIcon />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, flexWrap: "nowrap" }}>
              {/* Default Return Selector (Compact) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  whiteSpace: "nowrap",
                  height: "32px",
                  boxSizing: "border-box",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
                  Return:
                </span>
                <select
                  value={defaultReturnWindowDays}
                  disabled={isUpdatingReturnPolicy}
                  onChange={(e) => handleUpdateDefaultReturnPolicy(Number(e.target.value))}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#1e293b",
                    cursor: "pointer",
                    outline: "none",
                    padding: 0,
                  }}
                >
                  <option value={0}>No Return</option>
                  <option value={2}>2 Days</option>
                  <option value={7}>7 Days</option>
                  <option value={10}>10 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>

              {/* Actions Dropdown (Compact) */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 9px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    boxSizing: "border-box",
                  }}
                >
                  <span>Actions</span>
                  <ChevronDownIcon />
                </button>

                {showActionsMenu && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 4px)",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)",
                      minWidth: "170px",
                      zIndex: 50,
                      padding: "4px 0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowImportModal(true);
                        setImportFile(null);
                        setImportResult(null);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 14px",
                        background: "none",
                        border: "none",
                        textAlign: "left",
                        fontSize: "13px",
                        color: "#1e293b",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <UploadIcon /> Import CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false);
                        handleExportCSV();
                      }}
                      disabled={isExportingCSV}
                      style={{
                        width: "100%",
                        padding: "8px 14px",
                        background: "none",
                        border: "none",
                        textAlign: "left",
                        fontSize: "13px",
                        color: "#1e293b",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <DownloadIcon />{" "}
                      {isExportingCSV
                        ? "Exporting..."
                        : statusFilter !== "all" || searchQuery || activeFilterCount > 0
                        ? "Export Filtered CSV"
                        : "Export All CSV"}
                    </button>
                  </div>
                )}
              </div>

              {/* + Add Product Primary Button (Blue) */}
              <button
                onClick={openCreateForm}
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
                <span>Add Product</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Main Products Table Card */}
      <div style={{ ...plainCardStyle, overflow: "hidden", position: "relative" }}>
        {/* Top Animated Progress Indicator Bar */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2.5px",
              background: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #2563eb 100%)",
              backgroundSize: "200% 100%",
              animation: "storeShimmer 1.2s infinite linear",
              zIndex: 20,
            }}
          />
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <tr style={{ color: "#64748b" }}>
                <th style={{ ...thStyle, width: "36px", textAlign: "center", padding: "10px 12px" }}>
                  <input
                    type="checkbox"
                    aria-label="Select All Visible Products"
                    checked={products.length > 0 && products.every((p) => selectedProductIds.has(p.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const next = new Set(selectedProductIds);
                        products.forEach((p) => next.add(p.id));
                        setSelectedProductIds(next);
                      } else {
                        const next = new Set(selectedProductIds);
                        products.forEach((p) => next.delete(p.id));
                        setSelectedProductIds(next);
                      }
                    }}
                    style={{ cursor: "pointer", width: "15px", height: "15px" }}
                  />
                </th>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Price (₹)</th>
                <th style={thStyle}>Category & Tags</th>
                <th style={thStyle}>Stock & Visibility</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody style={{ opacity: isLoading && products.length > 0 ? 0.6 : 1, transition: "opacity 0.12s ease" }}>
              {isLoading && products.length === 0 && (
                [...Array(6)].map((_, idx) => (
                  <tr key={`skel-row-${idx}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ ...tdStyle, width: "36px", textAlign: "center" }}>
                      <div style={{ width: "15px", height: "15px", background: "#f1f5f9", borderRadius: "4px", margin: "0 auto" }} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "42px", height: "42px", borderRadius: "6px", background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "storeShimmer 1.4s infinite" }} />
                        <div style={{ display: "grid", gap: "6px", flex: 1 }}>
                          <div style={{ height: "14px", width: `${130 + (idx % 3) * 45}px`, borderRadius: "4px", background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "storeShimmer 1.4s infinite" }} />
                          <div style={{ height: "10px", width: "80px", borderRadius: "4px", background: "#f1f5f9" }} />
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ height: "14px", width: "55px", borderRadius: "4px", background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "storeShimmer 1.4s infinite" }} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ height: "14px", width: "90px", borderRadius: "4px", background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "storeShimmer 1.4s infinite" }} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ height: "20px", width: "70px", borderRadius: "12px", background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "storeShimmer 1.4s infinite" }} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ height: "28px", width: "80px", borderRadius: "6px", background: "#f1f5f9", marginLeft: "auto" }} />
                    </td>
                  </tr>
                ))
              )}

              {!isLoading && products.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: "48px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", maxWidth: "340px", margin: "0 auto" }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          background: "#f1f5f9",
                          color: "#64748b",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <SearchIcon />
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                        No products found
                      </div>
                      {searchQuery || activeFilterCount > 0 ? (
                        <>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            Try clearing search keywords or active filters.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery("");
                              setFilterCategory("");
                              setFilterCollection("");
                              setFilterBrand("");
                              setFilterMinPrice("");
                              setFilterMaxPrice("");
                              setFilterDiscount("all");
                              setFilterReturnPolicy("all");
                              setFilterHasVideo("all");
                              setFilterSortBy("newest");
                              setCurrentPage(1);
                              loadProducts({
                                page: 1,
                                search: "",
                                catId: "",
                                colId: "",
                                brand: "",
                                minP: "",
                                maxP: "",
                                discount: "all",
                                retPol: "all",
                                hasVid: "all",
                                sortB: "newest",
                              });
                            }}
                            style={{
                              ...ghostButtonStyle,
                              padding: "5px 12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              marginTop: "4px",
                            }}
                          >
                            Clear Filters
                          </button>
                        </>
                      ) : (
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          No products available in this category or view.
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {products.map((product, index) => {
                const firstVariant = product.variant_option?.optionValues?.[0];
                const hasVariants =
                  Array.isArray(product.variant_option?.optionValues) &&
                  product.variant_option.optionValues.length > 0;

                const displayPrice =
                  typeof firstVariant?.price === "number" && firstVariant.price > 0
                    ? firstVariant.price
                    : product.price;
                const displayComparePrice =
                  typeof (firstVariant as any)?.comparePrice === "number" &&
                  (firstVariant as any).comparePrice > displayPrice
                    ? (firstVariant as any).comparePrice
                    : product.compare_price;

                const isInlineEditing = inlineEditingId === product.id;

                const isOverallLowStock = product.stock > 0 && product.stock <= 5;
                const variantValues = product.variant_option?.optionValues || [];
                const lowStockVariants = variantValues.filter(
                  (v) => v.stockQty != null && v.stockQty > 0 && v.stockQty <= 5
                );
                const hasVariantLowStock = lowStockVariants.length > 0;

                return (
                  <tr
                    key={product.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    {/* Multi-Select Checkbox */}
                    <td style={{ ...tdStyle, width: "36px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${product.name}`}
                        checked={selectedProductIds.has(product.id)}
                        onChange={(e) => {
                          const next = new Set(selectedProductIds);
                          if (e.target.checked) {
                            next.add(product.id);
                          } else {
                            next.delete(product.id);
                          }
                          setSelectedProductIds(next);
                        }}
                        style={{ cursor: "pointer", width: "15px", height: "15px" }}
                      />
                    </td>

                    {/* Product Media & Info */}
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          minWidth: "260px",
                        }}
                      >
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <img
                            src={getOptimizedThumbnailUrl(product.images[0], 120, 140) || ""}
                            alt={product.name}
                            loading={index < 12 ? "eager" : "lazy"}
                            decoding="async"
                            style={{
                              width: "40px",
                              height: "48px",
                              borderRadius: "6px",
                              objectFit: "cover",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              display: "block",
                            }}
                          />
                          {product.video_url && (
                            <span
                              title="Has product video"
                              style={{
                                position: "absolute",
                                bottom: "2px",
                                right: "2px",
                                background: "rgba(0,0,0,0.75)",
                                color: "#fff",
                                fontSize: "8.5px",
                                padding: "1px 3px",
                                borderRadius: "3px",
                                display: "inline-flex",
                                alignItems: "center",
                              }}
                            >
                              <FilmIcon />
                            </span>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#0f172a",
                              marginBottom: "2px",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>{product.name}</span>
                            {!product.is_active && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  background: "#f1f5f9",
                                  color: "#64748b",
                                  fontWeight: 600,
                                }}
                              >
                                Draft
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#64748b",
                              display: "flex",
                              gap: "6px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            {product.brand && <span>{product.brand}</span>}
                            {product.sku && (
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                SKU: {product.sku}
                              </span>
                            )}
                            {product.sibling_group && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "#6d28d9",
                                  background: "#f5f3ff",
                                  border: "1px solid #ddd6fe",
                                  padding: "0 5px",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                                title={`Color Family: ${product.sibling_group}`}
                              >
                                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#7c3aed" }} />
                                {product.sibling_label || product.sibling_group}
                              </span>
                            )}
                            {hasVariants && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "#2563eb",
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  padding: "0 5px",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                }}
                              >
                                {product.variant_option?.optionValues?.length} Variants
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price with Inline Edit */}
                    <td style={tdStyle}>
                      {isInlineEditing ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="number"
                            value={inlinePrice}
                            onChange={(e) => setInlinePrice(e.target.value)}
                            style={{
                              ...inputStyle,
                              width: "80px",
                              padding: "4px 8px",
                              fontSize: "12.5px",
                              height: "28px",
                            }}
                            placeholder="Price"
                          />
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "2px" }}>
                          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>
                            ₹{displayPrice}
                            {hasVariants && (
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500, marginLeft: "3px" }}>
                                (from)
                              </span>
                            )}
                          </span>
                          {displayComparePrice != null && displayComparePrice > displayPrice && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#94a3b8",
                                textDecoration: "line-through",
                              }}
                            >
                              ₹{displayComparePrice}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Category & Badge Collections */}
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "12.5px" }}>
                        {product.category || "General"}
                      </div>
                      {product.collections && product.collections.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" }}>
                          {product.collections.map((col) => (
                            <span
                              key={col.id}
                              style={{
                                display: "inline-block",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: 600,
                                background: col.is_badge ? "#fef3c7" : "#f1f5f9",
                                color: col.is_badge ? "#b45309" : "#475569",
                                border: col.is_badge ? "1px solid #fde68a" : "1px solid #e2e8f0",
                              }}
                            >
                              {col.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: "3px" }}>
                        {product.return_window_days === 0 ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 600,
                              background: "#fef2f2",
                              color: "#991b1b",
                              border: "1px solid #fecaca",
                            }}
                          >
                            Non-Returnable
                          </span>
                        ) : product.return_window_days != null ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 600,
                              background: "#eff6ff",
                              color: "#2563eb",
                              border: "1px solid #bfdbfe",
                            }}
                          >
                            {product.return_window_days}d Return
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Stock & Status */}
                    <td style={tdStyle}>
                      {isInlineEditing ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="number"
                            value={inlineStock}
                            onChange={(e) => setInlineStock(e.target.value)}
                            style={{
                              ...inputStyle,
                              width: "70px",
                              padding: "4px 8px",
                              fontSize: "12.5px",
                              height: "28px",
                            }}
                            placeholder="Stock"
                          />
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "3px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                background: product.in_stock ? "#f0fdf4" : "#fef2f2",
                                color: product.in_stock ? "#15803d" : "#b91c1c",
                                fontWeight: 600,
                                fontSize: "11px",
                              }}
                            >
                              {product.in_stock ? "In Stock" : "Out of Stock"}
                            </span>
                            {isOverallLowStock ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  fontWeight: 600,
                                  fontSize: "10.5px",
                                  border: "1px solid #fde68a",
                                }}
                              >
                                Low ({product.stock} left)
                              </span>
                            ) : hasVariantLowStock ? (
                              <span
                                title={`Low variants: ${lowStockVariants.map((v) => `${v.value} (${v.stockQty})`).join(", ")}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  fontWeight: 600,
                                  fontSize: "10.5px",
                                  border: "1px solid #fde68a",
                                  cursor: "help",
                                }}
                              >
                                Low: {lowStockVariants[0]?.value} (≤5)
                              </span>
                            ) : null}
                          </div>
                          <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                            Total Stock: {product.stock}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Actions & Quick Edit */}
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {isInlineEditing ? (
                        <div style={{ display: "inline-flex", gap: "5px", alignItems: "center" }}>
                          <button
                            onClick={() => handleQuickSave(product.id)}
                            disabled={isQuickSaving}
                            style={{
                              ...primaryButtonStyle,
                              padding: "4px 8px",
                              fontSize: "11.5px",
                              background: "#16a34a",
                              height: "28px",
                              borderRadius: "5px",
                            }}
                          >
                            {isQuickSaving ? "..." : "Save"}
                          </button>
                          <button
                            onClick={() => setInlineEditingId(null)}
                            style={{
                              ...ghostButtonStyle,
                              padding: "4px 8px",
                              fontSize: "11.5px",
                              height: "28px",
                              borderRadius: "5px",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "inline-flex", gap: "4px", alignItems: "center", justifyContent: "flex-end", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                          {/* Quick Edit */}
                          <button
                            type="button"
                            title={hasVariants ? "Quick Edit Variant Prices & Stocks" : "Quick Edit Price & Stock"}
                            style={{
                              width: "28px",
                              height: "28px",
                              padding: 0,
                              display: "inline-grid",
                              placeItems: "center",
                              color: "#2563eb",
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              borderRadius: "5px",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                            onClick={() => {
                              if (hasVariants) {
                                openVariantQuickEdit(product);
                              } else {
                                setInlineEditingId(product.id);
                                setInlinePrice(String(displayPrice));
                                setInlineStock(String(product.stock));
                              }
                            }}
                          >
                            <QuickEditIcon />
                          </button>

                          {/* Full Edit Form */}
                          <button
                            type="button"
                            title="Edit Product Details"
                            style={{
                              width: "28px",
                              height: "28px",
                              padding: 0,
                              display: "inline-grid",
                              placeItems: "center",
                              color: "#334155",
                              background: "#f8fafc",
                              border: "1px solid #cbd5e1",
                              borderRadius: "5px",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                            onClick={() => openEditForm(product)}
                          >
                            <PencilIcon />
                          </button>

                          {/* Duplicate Product */}
                          <button
                            type="button"
                            title="Duplicate as new Draft product"
                            style={{
                              width: "28px",
                              height: "28px",
                              padding: 0,
                              display: "inline-grid",
                              placeItems: "center",
                              color: "#4f46e5",
                              background: "#eef2ff",
                              border: "1px solid #c7d2fe",
                              borderRadius: "5px",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                            onClick={() => handleDuplicateProduct(product.id)}
                          >
                            <CopyIcon />
                          </button>

                          {/* Delete Product */}
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            style={{
                              width: "28px",
                              height: "28px",
                              padding: 0,
                              display: "inline-grid",
                              placeItems: "center",
                              color: "#dc2626",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              borderRadius: "5px",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                            title={`Delete ${product.name}`}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Server-Side Pagination Bar */}
      {filteredTotal > 0 && (
        <div style={{ marginTop: "16px" }}>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredTotal}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={(p) => {
              setCurrentPage(p);
              const cacheKey = `${siteId}:${statusFilter}:${p}:${pageSize}:${searchQuery}:${filterCategory}:${filterCollection}:${filterBrand}:${filterMinPrice}:${filterMaxPrice}:${filterDiscount}:${filterReturnPolicy}:${filterHasVideo}:${filterSortBy}`;
              const cached = adminProductsQueryCache.get(cacheKey);
              if (cached) {
                setProducts(cached.products);
                setIsLoading(false);
              } else {
                setProducts([]);
                setIsLoading(true);
              }
              loadProducts({ page: p });
            }}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
              setProducts([]);
              setIsLoading(true);
              loadProducts({ page: 1, limit: newSize });
            }}
            showRangeText={true}
          />
        </div>
      )}

      {/* Multi-Variant Quick Edit Modal */}
      {quickEditProduct && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "680px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  Quick Edit Variants: {quickEditProduct.name}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Option: {quickEditProduct.variant_option?.optionName || "Variant Values"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setQuickEditProduct(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "grid", gap: "12px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left", fontSize: "12px" }}>
                    <th style={{ padding: "8px 10px" }}>Variant Value</th>
                    <th style={{ padding: "8px 10px" }}>Selling Price (₹)</th>
                    <th style={{ padding: "8px 10px" }}>Original MRP (₹)</th>
                    <th style={{ padding: "8px 10px" }}>Stock Qty</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>In Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {quickEditVariantRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#1e293b", fontSize: "13px" }}>
                        {row.value}
                      </td>
                      <td style={{ padding: "10px" }}>
                        <input
                          type="number"
                          value={row.price}
                          onChange={(e) => {
                            const next = [...quickEditVariantRows];
                            next[idx].price = e.target.value;
                            setQuickEditVariantRows(next);
                          }}
                          style={{ ...inputStyle, width: "90px", padding: "6px 8px", fontSize: "13px" }}
                          placeholder="Price"
                        />
                      </td>
                      <td style={{ padding: "10px" }}>
                        <input
                          type="number"
                          value={row.comparePrice}
                          onChange={(e) => {
                            const next = [...quickEditVariantRows];
                            next[idx].comparePrice = e.target.value;
                            setQuickEditVariantRows(next);
                          }}
                          style={{ ...inputStyle, width: "90px", padding: "6px 8px", fontSize: "13px" }}
                          placeholder="MRP"
                        />
                      </td>
                      <td style={{ padding: "10px" }}>
                        <input
                          type="number"
                          value={row.stockQty}
                          onChange={(e) => {
                            const next = [...quickEditVariantRows];
                            next[idx].stockQty = e.target.value;
                            setQuickEditVariantRows(next);
                          }}
                          style={{ ...inputStyle, width: "80px", padding: "6px 8px", fontSize: "13px" }}
                          placeholder="Stock"
                        />
                      </td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <ToggleSwitch
                          checked={row.inStock}
                          onChange={(val) => {
                            const next = [...quickEditVariantRows];
                            next[idx].inStock = val;
                            setQuickEditVariantRows(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setQuickEditProduct(null)}
                style={{ ...ghostButtonStyle, padding: "8px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isQuickSaving}
                onClick={handleSaveVariantQuickEdit}
                style={{ ...primaryButtonStyle, padding: "8px 20px", background: "#16a34a" }}
              >
                {isQuickSaving ? "Saving..." : "Save All Variants"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* CSV Bulk Import Modal */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "560px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                  Import Products via CSV
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Upload spreadsheets to bulk create or update catalog products.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSubmit} style={{ padding: "20px", display: "grid", gap: "16px" }}>
              {/* Template Download Banner */}
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "12.5px", color: "#1e40af" }}>
                  <strong>Need a template?</strong> Download our pre-filled CSV sample with columns & demo data.
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  style={{
                    ...secondaryButtonStyle,
                    padding: "5px 12px",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    background: "#ffffff",
                    borderColor: "#93c5fd",
                    color: "#1d4ed8",
                    fontWeight: 700,
                  }}
                >
                  Sample CSV
                </button>
              </div>

              {/* File Upload Drop Zone */}
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: "10px",
                  padding: "24px 16px",
                  textAlign: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                  display: "grid",
                  gap: "8px",
                  justifyItems: "center",
                }}
                onClick={() => document.getElementById("csv-file-input")?.click()}
              >
                <span style={{ fontSize: "28px", color: "#94a3b8" }}>↑</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                  {importFile ? importFile.name : "Click to select or drag & drop CSV file"}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {importFile
                    ? `${(importFile.size / 1024).toFixed(1)} KB`
                    : "Supports UTF-8 encoded .csv files up to 25MB (~50,000 products)"}
                </span>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                      setImportResult(null);
                    }
                  }}
                  style={{ display: "none" }}
                />
              </div>

              {/* Default Import Status Choice */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155" }}>
                  Default Status for Uploaded Products:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setDefaultImportStatus("draft")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: defaultImportStatus === "draft" ? "2px solid #f59e0b" : "1px solid #cbd5e1",
                      background: defaultImportStatus === "draft" ? "#fffbeb" : "#ffffff",
                      color: defaultImportStatus === "draft" ? "#b45309" : "#475569",
                      fontWeight: defaultImportStatus === "draft" ? 700 : 500,
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span><strong>Save as Draft</strong></span>
                    <span style={{ fontSize: "10.5px", color: "#64748b" }}>Safe review before publishing</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDefaultImportStatus("active")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: defaultImportStatus === "active" ? "2px solid #16a34a" : "1px solid #cbd5e1",
                      background: defaultImportStatus === "active" ? "#f0fdf4" : "#ffffff",
                      color: defaultImportStatus === "active" ? "#15803d" : "#475569",
                      fontWeight: defaultImportStatus === "active" ? 700 : 500,
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span><strong>Publish Live</strong></span>
                    <span style={{ fontSize: "10.5px", color: "#64748b" }}>Directly visible on store</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDefaultImportStatus("csv")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: defaultImportStatus === "csv" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      background: defaultImportStatus === "csv" ? "#eff6ff" : "#ffffff",
                      color: defaultImportStatus === "csv" ? "#1d4ed8" : "#475569",
                      fontWeight: defaultImportStatus === "csv" ? 700 : 500,
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span><strong>From CSV Column</strong></span>
                    <span style={{ fontSize: "10.5px", color: "#64748b" }}>Follow 'is_active' column</span>
                  </button>
                </div>
              </div>

              {/* Results / Error reporting */}
              {importResult && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background:
                      (importResult.created_count && importResult.created_count > 0) ||
                      (importResult.updated_count && importResult.updated_count > 0)
                        ? "#f0fdf4"
                        : "#fef2f2",
                    border:
                      (importResult.created_count && importResult.created_count > 0) ||
                      (importResult.updated_count && importResult.updated_count > 0)
                        ? "1px solid #bbf7d0"
                        : "1px solid #fecaca",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color:
                        (importResult.created_count && importResult.created_count > 0) ||
                        (importResult.updated_count && importResult.updated_count > 0)
                          ? "#166534"
                          : "#991b1b",
                    }}
                  >
                    Processed: {importResult.created_count || 0} created,{" "}
                    {importResult.updated_count || 0} updated (existing SKUs/Names synced).
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div style={{ marginTop: "6px", maxHeight: "100px", overflowY: "auto", fontSize: "11.5px", color: "#dc2626" }}>
                      {importResult.errors.map((err, i) => (
                        <div key={i}>
                          Row {err.row}: {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  style={{ ...ghostButtonStyle, padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFile || isImporting}
                  style={{
                    ...primaryButtonStyle,
                    padding: "8px 20px",
                    background: !importFile || isImporting ? "#94a3b8" : "#2563eb",
                  }}
                >
                  {isImporting ? "Importing Products..." : "Upload & Ingest CSV"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FormField = ({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  multiline?: boolean;
  placeholder?: string;
  error?: string;
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <span style={labelStyle}>{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={inputStyle}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    )}
    {error ? <span style={errorStyle}>{error}</span> : null}
  </label>
);

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div
    style={{
      padding: "10px 12px",
      borderRadius: "8px",
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      minWidth: 0,
      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
    }}
  >
    <p
      style={{
        margin: "0 0 3px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#64748b",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </p>
    <h3
      style={{
        margin: 0,
        fontSize: "17px",
        fontWeight: 700,
        color: "#0f172a",
        lineHeight: 1.1,
      }}
    >
      {value}
    </h3>
  </div>
);

export default AdminProducts;
