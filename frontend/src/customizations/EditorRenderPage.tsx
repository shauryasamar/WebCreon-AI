import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Product, useCart } from "../CartContext";
import { componentRegistry } from "../componentRegistry";
import FilterModal, { FilterState } from "../Component/FilterModal";
import { API_BASE_URL } from "../config/api";
import { ThemeProvider, resolveThemeTokens } from "../context/ThemeContext";
import { normalizeStorefrontProduct } from "../utils/productNormalizer";
import FestiveBackgroundOverlay from "../Component/FestiveBackgroundOverlay";
import { getCheckoutAddresses, SavedAddress } from "../addressService";
import { useCustomerAuth } from "../context/CustomerAuthContext";

type Block = {
  id?: string;
  type: string;
  props?: Record<string, any>;
  data_source?: string | null;
  datasource?: string | null;
  actions?: Record<string, any>;
  isActive?: boolean;
  hidden?: boolean;
  [key: string]: any;
};

type Theme = {
  name?: string;
  mode?: string;
  primary_bg?: string;
  secondary_bg?: string;
  card_bg?: string;
  text_color?: string;
  accent_color?: string;
  festival_theme?: string;
  [key: string]: any;
};

type Page = {
  id?: string;
  name?: string;
  title?: string;
  route?: string;
  slug?: string;
  blocks?: Block[];
  role?: string;
  flow?: string;
  show_in_nav?: boolean;
  showinnav?: boolean;
  page_type?: string;
};

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

type EditorRenderPageProps = {
  page: Page | null | undefined;
  siteId: string;
  selectedProduct?: Product | null;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  theme?: Theme;
};

type EditorBlockWrapperProps = {
  blockId: string;
  blockType: string;
  selected: boolean;
  onSelect?: () => void;
  isCartBlock?: boolean;
  maxWidth?: number | string;
  borderRadius?: number;
  children: React.ReactNode;
};

type CheckoutStep = "delivery" | "payment" | "review";

type DeliveryData = {
  id?: string;
  label?: string;
  isDefault?: boolean;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  geoAccuracy?: string | null;
};

type PaymentData = {
  method: string;
  upiId: string;
};

const CHECKOUT_SUMMARY_TYPES = new Set([
  "cart_sidebar",
  "cartsidebar",
  "cart_items",
  "cartitems",
  "order_summary",
  "ordersummary",
]);

const PLACE_ORDER_TYPES = new Set(["place_order_cta", "placeordercta"]);
const PAYMENT_TYPES = new Set(["payment_methods", "paymentmethods"]);
const DELIVERY_TYPES = new Set(["delivery_form", "deliveryform"]);

const PRODUCT_DETAIL_TYPES = new Set([
  "product_detail",
  "productdetail",
  "product_gallery",
  "productgallery",
  "product_info",
  "productinfo",
  "purchase_panel",
  "purchasepanel",
]);

const PRODUCT_LISTING_TYPES = new Set([
  "product_grid",
  "productgrid",
  "products_grid",
  "productsgrid",
  "product_list",
  "productlist",
  "products_section",
  "productssection",
  "shop_products",
  "shopproducts",
]);

const FILTER_TYPES = new Set([
  "filter_sidebar",
  "filtersidebar",
  "filters",
  "shop_filters",
  "shopfilters",
]);

const CART_PAGE_TYPES = new Set([
  "cart",
  "cart_view",
  "cartview",
  "cart_sidebar",
  "cartsidebar",
  "cart_items",
  "cartitems",
  "order_summary",
  "ordersummary",
]);

const checkoutSteps: { key: CheckoutStep; label: string }[] = [
  { key: "delivery", label: "Delivery Address" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review & Pay" },
];

const initialDeliveryData: DeliveryData = {
  id: "",
  label: "Home",
  isDefault: false,
  fullName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  pincode: "",
};

function mapSavedAddressToDeliveryData(address: SavedAddress): DeliveryData {
  return {
    id: address.id,
    label: address.addressType || "Home",
    isDefault: address.isDefault,
    fullName: address.fullName || "",
    phone: address.mobileNumber || "",
    email: address.email || "",
    address: address.addressLine1 || "",
    city: address.city || "",
    pincode: address.postalCode || "",
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    geoAccuracy: address.geoAccuracy ?? null,
  };
}

const initialPaymentData: PaymentData = {
  method: "COD",
  upiId: "",
};

function isDeliveryValid(data: DeliveryData) {
  return Boolean(
    data &&
    data.fullName?.trim() &&
    data.phone?.trim() &&
    data.address?.trim() &&
    data.city?.trim() &&
    data.pincode?.trim()
  );
}

function isPaymentValid(data: PaymentData) {
  return Boolean(data && data.method && data.method.trim());
}

function EditorBlockWrapper({
  blockId,
  blockType,
  selected,
  onSelect,
  isCartBlock,
  maxWidth,
  borderRadius,
  children,
}: EditorBlockWrapperProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (selected && blockRef.current) {
      blockRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selected]);

  const readableName = (blockType || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const isCart = Boolean(isCartBlock);
  const parseNumSafe = (val: any, fallback: number) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };
  const resolveWidthRatio = (val: any) => {
    if (val === undefined || val === null || val === "") return 94;
    const str = String(val).trim();
    const n = Number(str.replace(/[^0-9.]/g, ""));
    if (isNaN(n)) return 94;
    if (n <= 100) return Math.max(70, Math.min(100, Math.round(n)));
    return Math.max(70, Math.min(100, Math.round((n / 1240) * 94)));
  };

  const containerRadius = isCart ? parseNumSafe(borderRadius, 24) : 10;
  const outlineRadius = containerRadius;
  const cartWidthPercent = isCart ? resolveWidthRatio(maxWidth) : undefined;

  // Shared outline overlay styles
  const outlineStyle: React.CSSProperties = {
    position: "absolute",
    inset: "-2px",
    border: selected
      ? "2px solid #2563eb"
      : isHovered
        ? "1.5px dashed #3b82f6"
        : "1.5px dashed transparent",
    borderRadius: `${outlineRadius}px`,
    pointerEvents: "none",
    zIndex: 20,
    transition: "all 0.15s ease",
    boxShadow: selected
      ? "0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 0 3.5px rgba(37, 99, 235, 0.22)"
      : isHovered
        ? "0 0 0 2px rgba(59, 130, 246, 0.1)"
        : "none",
  };

  const cornerHandleStyle = (pos: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    width: "7px",
    height: "7px",
    background: "#ffffff",
    border: "1.5px solid #2563eb",
    borderRadius: "2px",
    zIndex: 35,
    pointerEvents: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
    ...pos,
  });

  const badgeStyle: React.CSSProperties = {
    position: "absolute",
    top: "10px",
    left: "14px",
    zIndex: 30,
    padding: "3px 10px 3px 8px",
    borderRadius: "6px",
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#f8fafc",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    pointerEvents: "none",
    opacity: selected ? 1 : 0,
    transform: selected ? "translateY(0)" : "translateY(-4px)",
    transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.22), 0 1px 3px rgba(0,0,0,0.12)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const dotStyle: React.CSSProperties = {
    width: "5.5px",
    height: "5.5px",
    borderRadius: "50%",
    background: "#38bdf8",
    boxShadow: "0 0 6px rgba(56, 189, 248, 0.7)",
    flexShrink: 0,
  };

  const Overlay = () => (
    <>
      <div style={outlineStyle} />
      {selected && (
        <>
          <div style={cornerHandleStyle({ top: "-5px", left: "-5px" })} />
          <div style={cornerHandleStyle({ top: "-5px", right: "-5px" })} />
          <div style={cornerHandleStyle({ bottom: "-5px", left: "-5px" })} />
          <div style={cornerHandleStyle({ bottom: "-5px", right: "-5px" })} />
        </>
      )}
      <div style={badgeStyle}>
        <span style={dotStyle} />
        {readableName}
      </div>
    </>
  );

  return (
    <div
      ref={blockRef}
      data-editor-block-id={blockId}
      data-editor-block-type={blockType}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      style={{
        position: "relative",
        cursor: "default",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        margin: "0",
        padding: 0,
        zIndex: selected ? 50 : 1,
        overflow: "visible",
        boxSizing: "border-box",
        borderRadius: isCart ? 0 : `${containerRadius}px`,
      }}
    >
      {isCart ? (
        // ─── Cart Block ───
        // Uses the exact same proportional width ratio (default 94%)
        // as the customer view, with clean balanced side margins.
        <div
          style={{
            width: `${cartWidthPercent}%`,
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "24px 0 36px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <Overlay />
            {children}
          </div>
        </div>
      ) : (
        // ─── Non-cart blocks ───
        <>
          <Overlay />
          <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

const EditorRenderPage: React.FC<EditorRenderPageProps> = ({
  page,
  siteId,
  selectedProduct = null,
  selectedBlockId = null,
  onSelectBlock,
  theme,
}) => {
  const { products, cartItems } = useCart();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const initialSearchQuery = searchParams.get("search") || "";
  const initialSortBy = searchParams.get("sort_by") || searchParams.get("sort") || "newest";
  const initialCatParam = searchParams.get("category") || searchParams.get("category_id");
  const initialBrandParams = searchParams.getAll("brand");
  const initialColParams = searchParams.getAll("collection").concat(searchParams.getAll("collection_id"));
  const initialProdTypeParams = searchParams.getAll("product_type");
  const initialMinP = searchParams.get("min_price");
  const initialMaxP = searchParams.get("max_price");

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; slug?: string }[]>([]);
  const [collections, setCollections] = useState<{ id: string; name: string; slug?: string }[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    categoryId: initialCatParam || null,
    productTypes: initialCatParam ? Array.from(new Set([...initialProdTypeParams, initialCatParam])) : initialProdTypeParams,
    brands: initialBrandParams,
    collections: initialColParams,
    minPrice: initialMinP ? Number(initialMinP) : 0,
    maxPrice: initialMaxP ? Number(initialMaxP) : 100000,
  });
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [serverProducts, setServerProducts] = useState<Product[] | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverTotalPages, setServerTotalPages] = useState<number | null>(null);
  const [isServerLoading, setIsServerLoading] = useState<boolean>(false);
  const [isCompactCheckout, setIsCompactCheckout] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery, sortBy]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const params = new URLSearchParams(location.search);
    const q = params.get("search") || "";
    setSearchQuery(q);

    const sortParam = params.get("sort_by") || params.get("sort");
    if (sortParam) {
      setSortBy(sortParam);
    }

    const catParam = params.get("category") || params.get("category_id");
    const brandParams = params.getAll("brand");
    const colParams = params.getAll("collection").concat(params.getAll("collection_id"));
    const prodTypeParams = params.getAll("product_type");
    const minP = params.get("min_price");
    const maxP = params.get("max_price");

    setFilters({
      categoryId: catParam || null,
      productTypes: catParam ? Array.from(new Set([...prodTypeParams, catParam])) : prodTypeParams,
      brands: brandParams,
      collections: colParams,
      minPrice: minP ? Number(minP) : 0,
      maxPrice: maxP ? Number(maxP) : 100000,
    });
  }, [location.search]);

  useEffect(() => {
    if (!siteId) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        setIsServerLoading(true);
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("page_size", String(pageSize));
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (sortBy) {
          params.set("sort_by", sortBy);
        }
        if (filters.categoryId) {
          params.set("category_id", filters.categoryId);
        }
        filters.productTypes.forEach((pt) => params.append("product_type", pt));
        filters.collections.forEach((cid) => params.append("collection_id", cid));
        filters.brands.forEach((b) => params.append("brand", b));
        if (filters.minPrice > 0) {
          params.set("min_price", String(filters.minPrice));
        }
        if (filters.maxPrice < 100000) {
          params.set("max_price", String(filters.maxPrice));
        }

        const res = await fetch(
          `${API_BASE_URL}/sites/${siteId}/products/public?${params.toString()}`
        );

        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data && typeof data === "object" && Array.isArray(data.items || data.products)) {
            const rawItems = data.items || data.products || [];
            const norm = rawItems.map(normalizeStorefrontProduct);
            setServerProducts(norm);
            setServerTotal(typeof data.total === "number" ? data.total : norm.length);
            setServerTotalPages(typeof data.total_pages === "number" ? data.total_pages : 1);
          }
        }
      } catch (err) {
        console.error("Failed to fetch public products server-side in editor", err);
      } finally {
        if (!cancelled) {
          setIsServerLoading(false);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [siteId, currentPage, pageSize, searchQuery, filters, sortBy]);

  useEffect(() => {
    if (!siteId) return;
    fetch(`${API_BASE_URL}/sites/${siteId}/categories/public`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => { });

    fetch(`${API_BASE_URL}/sites/${siteId}/collections/public`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCollections(Array.isArray(data) ? data : []))
      .catch(() => { });
  }, [siteId]);

  const resolvedBlocks = page?.blocks ?? [];

  const isCheckoutPage =
    page?.slug === "checkout" ||
    page?.route === "/checkout" ||
    page?.page_type === "checkout" ||
    page?.flow === "checkout";

  const isCartPage =
    page?.slug === "cart" ||
    page?.route === "/cart" ||
    page?.page_type === "cart" ||
    page?.role === "cart";

  const isProductDetailPageContext =
    Boolean(selectedProduct) ||
    page?.role === "product_detail" ||
    page?.page_type === "product_detail" ||
    page?.route === "/products/:productSlug" ||
    page?.route === "/products/:slug" ||
    resolvedBlocks.some((block) =>
      PRODUCT_DETAIL_TYPES.has(String(block.type || "").toLowerCase())
    );

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("delivery");
  const [deliveryData, setDeliveryData] = useState<DeliveryData>(initialDeliveryData);
  const [paymentData, setPaymentData] = useState<PaymentData>(initialPaymentData);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryData[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddressesLoading, setIsAddressesLoading] = useState(false);

  const { isAuthenticated, loading: authLoading } = useCustomerAuth();

  // Load customer's saved addresses for the checkout delivery step — same logic as RenderPage
  useEffect(() => {
    if (!siteId || !isCheckoutPage) return;
    if (authLoading) return;

    if (!isAuthenticated) {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      setDeliveryData(initialDeliveryData);
      setIsAddressesLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setIsAddressesLoading(true);
        const addresses = await getCheckoutAddresses(siteId);
        if (cancelled) return;
        const mapped = addresses.map(mapSavedAddressToDeliveryData);
        setSavedAddresses(mapped);
        const selected =
          mapped.find((addr) => addr.isDefault) || mapped[0] || null;
        if (selected) {
          setSelectedAddressId(selected.id || null);
          setDeliveryData(selected);
        } else {
          setSelectedAddressId(null);
          setDeliveryData(initialDeliveryData);
        }
      } catch (error) {
        console.error("Failed to load checkout addresses in editor", error);
        if (!cancelled) {
          setSavedAddresses([]);
          setSelectedAddressId(null);
          setDeliveryData(initialDeliveryData);
        }
      } finally {
        if (!cancelled) setIsAddressesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [siteId, isCheckoutPage, isAuthenticated, authLoading]);

  useEffect(() => {
    const syncViewport = () => {
      setIsCompactCheckout(window.innerWidth < 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const sectionTitleParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("section_title") || params.get("section");
  }, [location.search]);

  const currentSectionIdParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("section_id") || params.get("section");
  }, [location.search]);

  const activeSectionBlock = useMemo(() => {
    if (!sectionTitleParam && !currentSectionIdParam) return null;
    const cleanTitle = (sectionTitleParam || "").trim().toLowerCase();
    const cleanId = (currentSectionIdParam || "").trim().toLowerCase();
    const blocks = Array.isArray(resolvedBlocks) ? resolvedBlocks : Array.isArray(page?.blocks) ? page.blocks : [];
    return (
      blocks.find(
        (b) =>
          (b.type === "product_carousel" || b.type === "brand_store_grid") &&
          (String(b.id || "").toLowerCase() === cleanId ||
            String(b.id || "").toLowerCase() === cleanTitle ||
            String((b as any).name || "").toLowerCase() === cleanTitle ||
            String(b.props?.title || "").toLowerCase() === cleanTitle)
      ) || null
    );
  }, [sectionTitleParam, currentSectionIdParam, resolvedBlocks, page]);

  const isDedicatedSectionOrSearchView = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Boolean(
      searchQuery.trim() ||
      sectionTitleParam ||
      currentSectionIdParam ||
      params.get("collection") ||
      params.get("category") ||
      params.get("brand") ||
      params.get("product_type") ||
      params.get("product_ids")
    );
  }, [searchQuery, sectionTitleParam, currentSectionIdParam, location.search]);

  const sectionBaseProducts = useMemo(() => {
    if (!activeSectionBlock) return products;
    const rules = activeSectionBlock.props?.rules || {
      category: activeSectionBlock.props?.categoryName,
      collection_id: activeSectionBlock.props?.collectionId,
      brand: activeSectionBlock.props?.brandName,
      sort_by: activeSectionBlock.props?.sortBy,
    };
    let list = [...products];
    const cat = rules.category || (rules.categories && rules.categories[0]);
    if (cat) {
      const targetCat = cat.toLowerCase();
      list = list.filter((p) => (p.category && p.category.toLowerCase() === targetCat) || (p.category_name && p.category_name.toLowerCase() === targetCat));
    }
    const br = rules.brand || (rules.brands && rules.brands[0]);
    if (br) {
      const targetBrand = br.toLowerCase();
      list = list.filter((p) => p.brand && p.brand.toLowerCase() === targetBrand);
    }
    const col = rules.collection_id || (rules.collection_ids && rules.collection_ids[0]);
    if (col) {
      const targetCol = String(col).toLowerCase();
      list = list.filter((p: any) => (p.collections || []).some((c: any) => (c.id && String(c.id).toLowerCase() === targetCol) || (c.collection_id && String(c.collection_id).toLowerCase() === targetCol) || (c.name && c.name.toLowerCase() === targetCol)));
    }
    if (rules.min_price !== undefined && rules.min_price !== null) {
      list = list.filter((p) => Number(p.price) >= rules.min_price);
    }
    if (rules.max_price !== undefined && rules.max_price !== null) {
      list = list.filter((p) => Number(p.price) <= rules.max_price);
    }
    if (rules.in_stock_only) {
      list = list.filter((p) => p.in_stock !== false);
    }
    if (rules.selected_product_ids && rules.selected_product_ids.length > 0) {
      list = list.filter((p) => rules.selected_product_ids.includes(String(p.id)));
    }
    return list;
  }, [activeSectionBlock, products]);

  const sourceProductsForFilters = activeSectionBlock ? sectionBaseProducts : products;

  const availableProductTypes = useMemo(() => {
    return Array.from(
      new Set(
        sourceProductsForFilters
          .map((product) => product.category)
          .filter((category): category is string => Boolean(category))
      )
    ).sort();
  }, [sourceProductsForFilters]);

  const availableBrands = useMemo(() => {
    return Array.from(
      new Set(
        sourceProductsForFilters
          .map((product) => product.brand)
          .filter((brand): brand is string => Boolean(brand))
      )
    ).sort();
  }, [sourceProductsForFilters]);

  const filteredAndSortedProducts = useMemo(() => {
    let list = [...sourceProductsForFilters];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.category_name && p.category_name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (filters.categoryId) {
      const targetCatId = String(filters.categoryId).toLowerCase().trim();
      const matchedCat = categories.find(
        (c) => String(c.id).toLowerCase().trim() === targetCatId || String(c.name).toLowerCase().trim() === targetCatId
      );
      const catIdToken = matchedCat ? String(matchedCat.id).toLowerCase().trim() : targetCatId;
      const catNameToken = matchedCat ? String(matchedCat.name).toLowerCase().trim() : targetCatId;
      const cleanName = catNameToken.trim();

      const isWordMatch = (text: string, target: string) => {
        if (!text || !target) return false;
        const t = text.toLowerCase().trim();
        const w = target.toLowerCase().trim();
        if (t === w) return true;
        const textWords = t.split(/[^a-z0-9]+/);
        if (!w.includes(" ")) {
          return textWords.includes(w);
        }
        const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(t);
      };

      list = list.filter((p) => {
        const pCatId = p.category_id ? String(p.category_id).toLowerCase().trim() : "";
        const pCatName = p.category_name ? String(p.category_name).toLowerCase().trim() : "";
        const pCat = p.category ? String(p.category).toLowerCase().trim() : "";

        if (pCatId && pCatId === catIdToken) return true;
        if (pCatName && isWordMatch(pCatName, cleanName)) return true;
        if (pCat && isWordMatch(pCat, cleanName)) return true;
        return false;
      });
    }

    if (filters.productTypes.length > 0) {
      const selectedTypes = filters.productTypes.map((t) => String(t).toLowerCase().trim());
      list = list.filter((p) => {
        const pCat = p.category ? String(p.category).toLowerCase().trim() : "";
        const pCatName = p.category_name ? String(p.category_name).toLowerCase().trim() : "";
        const pName = p.name ? String(p.name).toLowerCase().trim() : "";
        return selectedTypes.some((st) => pCat === st || pCat.includes(st) || st.includes(pCat) || pCatName === st || pName.includes(st));
      });
    }

    if (filters.collections.length > 0) {
      const selectedColTokens = new Set<string>();
      filters.collections.forEach((colKey) => {
        const k = String(colKey).toLowerCase().trim();
        selectedColTokens.add(k);
        const matchCol = collections.find((c) => String(c.id).toLowerCase().trim() === k || String(c.name).toLowerCase().trim() === k);
        if (matchCol) {
          selectedColTokens.add(String(matchCol.id).toLowerCase().trim());
          selectedColTokens.add(String(matchCol.name).toLowerCase().trim());
          if (matchCol.slug) selectedColTokens.add(String(matchCol.slug).toLowerCase().trim());
        }
      });

      list = list.filter((p) => {
        if (p.collections && Array.isArray(p.collections)) {
          const hasMatch = p.collections.some((col: any) => {
            const colId = col.id ? String(col.id).toLowerCase().trim() : "";
            const colName = col.name ? String(col.name).toLowerCase().trim() : "";
            const colSlug = col.slug ? String(col.slug).toLowerCase().trim() : "";
            return (
              selectedColTokens.has(colId) ||
              selectedColTokens.has(colName) ||
              selectedColTokens.has(colSlug) ||
              Array.from(selectedColTokens).some((t) => t && (colName.includes(t) || t.includes(colName)))
            );
          });
          if (hasMatch) return true;
        }
        const pCat = p.category ? String(p.category).toLowerCase().trim() : "";
        const pCatName = p.category_name ? String(p.category_name).toLowerCase().trim() : "";
        const pName = p.name ? String(p.name).toLowerCase().trim() : "";
        return Array.from(selectedColTokens).some(
          (token) => token && (pCat === token || pCat.includes(token) || pCatName === token || pName.includes(token))
        );
      });
    }

    if (filters.brands.length > 0) {
      list = list.filter((p) => p.brand && filters.brands.includes(p.brand));
    }

    if (filters.minPrice > 0 || filters.maxPrice < 100000) {
      list = list.filter((p) => {
        const price = Number(p.price || 0);
        return price >= filters.minPrice && price <= filters.maxPrice;
      });
    }

    if (sortBy === "price_asc") {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === "rating_desc") {
      list.sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0));
    } else if (sortBy === "discount_desc") {
      list.sort((a, b) => {
        const getDisc = (p: any) => {
          const pVal = Number(p.price || 0);
          const compVal = Number(p.compare_price || p.originalPrice || 0);
          return compVal > pVal && compVal > 0 ? ((compVal - pVal) / compVal) * 100 : 0;
        };
        return getDisc(b) - getDisc(a);
      });
    } else {
      list.sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tB - tA;
      });
    }

    return list;
  }, [sourceProductsForFilters, searchQuery, filters, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedProducts.slice(start, start + pageSize);
  }, [filteredAndSortedProducts, currentPage, pageSize]);

  const isSectionFocused = Boolean(sectionTitleParam || currentSectionIdParam);
  const resolvedStoreProducts = isSectionFocused ? paginatedProducts : (serverProducts ?? paginatedProducts);
  const resolvedTotalCount = isSectionFocused ? filteredAndSortedProducts.length : (serverTotal ?? filteredAndSortedProducts.length);
  const resolvedTotalPages = isSectionFocused ? totalPages : (serverTotalPages ?? totalPages);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categoryId) count++;
    count += filters.productTypes.length;
    count += filters.collections.length;
    count += filters.brands.length;
    if (filters.minPrice > 0) count++;
    if (filters.maxPrice < 100000) count++;
    return count;
  }, [filters]);

  const dynamicTitle = useMemo(() => {
    if (sectionTitleParam) return sectionTitleParam;
    if (activeSectionBlock) return activeSectionBlock.props?.title || (activeSectionBlock as any).name || "Collection";
    if (searchQuery.trim()) return `Search Results for "${searchQuery.trim()}"`;
    if (filters.categoryId) {
      const cat = categories.find((c) => c.id === filters.categoryId || c.name === filters.categoryId);
      if (cat) return cat.name;
      return filters.categoryId;
    }
    if (filters.collections.length > 0) {
      const matched = collections
        .filter((c) => filters.collections.includes(c.id) || filters.collections.includes(c.name))
        .map((c) => c.name);
      if (matched.length > 0) return matched.join(", ");
    }
    if (filters.brands.length > 0) {
      return filters.brands.join(", ");
    }
    return "All Products";
  }, [sectionTitleParam, activeSectionBlock, searchQuery, filters, categories, collections]);

  const dynamicSubtitle = useMemo(() => {
    if (sectionTitleParam) return `${resolvedTotalCount.toLocaleString()} Items`;
    if (activeSectionBlock) return activeSectionBlock.props?.subtitle || `${resolvedTotalCount.toLocaleString()} Items`;
    if (searchQuery.trim()) return "Search Results";
    if (filters.categoryId) return "Category";
    if (filters.collections.length > 0) return "Collection";
    return "Browse Products";
  }, [sectionTitleParam, activeSectionBlock, searchQuery, filters, resolvedTotalCount]);

  const detailRelevantBlocks = useMemo(() => {
    if (!isProductDetailPageContext) return resolvedBlocks;

    const filtered = resolvedBlocks.filter((block) => {
      const type = String(block.type || "").toLowerCase();
      const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;

      if (FILTER_TYPES.has(type)) return false;
      if (resolvedDataSource === "products") return false;
      if (PRODUCT_LISTING_TYPES.has(type)) return false;

      return true;
    });

    const hasRenderableDetailBlock = filtered.some((block) => {
      const type = String(block.type || "").toLowerCase();
      const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;

      return (
        (PRODUCT_DETAIL_TYPES.has(type) || resolvedDataSource === "product") &&
        Boolean(componentRegistry[block.type])
      );
    });

    if (hasRenderableDetailBlock) {
      const mergedDetailProps: Record<string, any> = {};
      filtered.forEach((b) => {
        const t = String(b.type || "").toLowerCase();
        const ds = b.data_source ?? b.datasource ?? undefined;
        if (PRODUCT_DETAIL_TYPES.has(t) || ds === "product") {
          Object.assign(mergedDetailProps, b.props || {});
        }
      });

      let mergedOnce = false;
      return filtered.map((b) => {
        const t = String(b.type || "").toLowerCase();
        const ds = b.data_source ?? b.datasource ?? undefined;
        if ((PRODUCT_DETAIL_TYPES.has(t) || ds === "product") && !mergedOnce) {
          mergedOnce = true;
          return {
            ...b,
            props: {
              ...mergedDetailProps,
              ...(b.props || {}),
            },
          };
        }
        return b;
      });
    }

    const pdBlockInPage = page?.blocks?.find((b) =>
      PRODUCT_DETAIL_TYPES.has(String(b.type || "").toLowerCase())
    );

    return [
      {
        id: pdBlockInPage?.id || "auto-product-detail-fallback",
        type: "product_detail",
        data_source: "product",
        props: pdBlockInPage?.props || {},
      },
    ];
  }, [isProductDetailPageContext, resolvedBlocks, page]);

  const blocksToRender = useMemo(() => {
    let blocks = detailRelevantBlocks;

    // Filter out navbar and footer as they are rendered globally by StorefrontShell
    blocks = blocks.filter((b) => {
      const type = String(b.type || "").toLowerCase();
      return type !== "navbar" && type !== "footer";
    });

    if (isCheckoutPage) {
      // Checkout flow only renders checkout components (delivery, payment, order summary, place order)
      // Never render hero banners, promotional banners, carousels, or product grids
      return blocks.filter((b) => {
        const type = String(b.type || "").toLowerCase();
        return (
          !type.includes("banner") &&
          !type.includes("hero") &&
          !type.includes("carousel") &&
          !type.includes("grid")
        );
      });
    }

    // If searching OR viewing an expanded section (via "View All >" or Banner Link):
    // HIDE ALL other hero banners, carousels, category grids, brand grids!
    // ONLY show filter sidebar, product grid, and pagination.
    if (isDedicatedSectionOrSearchView) {
      blocks = blocks.filter((b) => {
        const type = String(b.type || "").toLowerCase();
        return (
          type === "filter_sidebar" ||
          type === "filtersidebar" ||
          type === "product_grid" ||
          type === "productgrid" ||
          type === "pagination"
        );
      });
      // Guarantee product_grid block exists
      const hasGrid = blocks.some((b) => {
        const type = String(b.type || "").toLowerCase();
        return type === "product_grid" || type === "productgrid";
      });
      if (!hasGrid) {
        blocks = [
          {
            id: "auto-section-product-grid",
            type: "product_grid",
            data_source: "products",
            props: {},
          },
          ...blocks,
        ];
      }
    } else {
      // Filter out hero banners on subpages (cart, checkout, product detail, catalog)
      const isLandingHome = page?.role === "home" || page?.id === "home" || page?.page_type === "landing" || page?.route === "/";
      if (!isLandingHome) {
        blocks = blocks.filter((b) => {
          const type = String(b.type || "").toLowerCase();
          return !type.includes("banner") && !type.includes("hero");
        });
      }
    }

    let hasRenderedPrimaryCartBlock = false;
    let hasRenderedPrimaryProductDetailBlock = false;

    return blocks.filter((block) => {
      // Respect admin visibility toggle
      if (
        block.props?.isActive === false ||
        (block as any).isActive === false ||
        block.hidden === true ||
        block.props?.hidden === true
      ) {
        return false;
      }

      const type = String(block.type || "").toLowerCase();
      const dataSource = block.data_source ?? block.datasource ?? undefined;

      // Navbar and Footer are rendered globally by StorefrontShell
      if (type === "navbar" || type === "footer") return false;

      if (isCartPage) {
        const isCartLike = CART_PAGE_TYPES.has(type) || dataSource === "cart" || type.includes("cart");
        if (isCartLike) {
          if (hasRenderedPrimaryCartBlock) return false;
          hasRenderedPrimaryCartBlock = true;
          return true;
        }
        // Exclude redundant sub-blocks (checkout_cta, promo_code, cart_summary, etc.) on the cart page
        return false;
      }

      const isProductDetailLike =
        PRODUCT_DETAIL_TYPES.has(type) || dataSource === "product";
      if (isProductDetailPageContext && isProductDetailLike) {
        if (hasRenderedPrimaryProductDetailBlock) return false;
        hasRenderedPrimaryProductDetailBlock = true;
        return true;
      }

      return true;
    });
  }, [detailRelevantBlocks, isCheckoutPage, isCartPage, isProductDetailPageContext, isDedicatedSectionOrSearchView, page]);

  // Auto switch checkout step if selected block belongs to a specific step
  useEffect(() => {
    if (!selectedBlockId || !isCheckoutPage) return;
    if (
      selectedBlockId.includes("delivery") ||
      selectedBlockId === "delivery_map_picker" ||
      selectedBlockId === "delivery_address_form"
    ) {
      setCheckoutStep("delivery");
      return;
    }
    const matched = blocksToRender.find((b) => (b.id || b.type) === selectedBlockId);
    if (!matched) return;
    const type = (matched.type || "").toLowerCase();
    if (PAYMENT_TYPES.has(type)) {
      setCheckoutStep("payment");
    } else if (PLACE_ORDER_TYPES.has(type)) {
      setCheckoutStep("review");
    } else if (DELIVERY_TYPES.has(type)) {
      setCheckoutStep("delivery");
    }
  }, [selectedBlockId, isCheckoutPage, blocksToRender]);

  const renderBlock = (
    block: Block,
    index: number,
    overrides?: Record<string, any>
  ) => {
    const Component = componentRegistry[block.type] as
      | React.ComponentType<any>
      | undefined;

    if (!Component) {
      return null;
    }

    const blockId = block.id || block.type || `${page.id ?? "page"}-${block.type}-${index}`;
    const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;
    const blockProps = (block.props ?? {}) as Record<string, any>;
    const resolvedTheme: Theme | undefined = theme;

    const isCartBlock = Boolean(
      isCartPage && (
        CART_PAGE_TYPES.has(String(block.type || "").toLowerCase()) ||
        resolvedDataSource === "cart" ||
        String(blockId || "").toLowerCase().includes("cart")
      )
    );

    const componentProps = {
      siteId,
      ...blockProps,
      theme: resolvedTheme,
      embeddedInEditorWrapper: isCartBlock,
      ...(overrides ?? {}),
    };

    let renderedNode: React.ReactNode;

    const isProductListingBlock =
      resolvedDataSource === "products" ||
      PRODUCT_LISTING_TYPES.has(String(block.type || "").toLowerCase());

    if (block.type === "navbar") {
      renderedNode = (
        <Component
          {...componentProps}
          onSearch={(query: string) => setSearchQuery(query)}
        />
      );
    } else if (
      !isProductDetailPageContext &&
      (block.type === "filter_sidebar" || block.type === "filtersidebar")
    ) {
      renderedNode = (
        <Component
          {...componentProps}
          title={dynamicTitle}
          subtitle={dynamicSubtitle}
          itemCount={resolvedTotalCount}
          activeFilterCount={activeFilterCount}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onFilterClick={() => setFilterModalOpen(true)}
          showFilterButton={!isDedicatedSectionOrSearchView}
        />
      );
    } else if (
      resolvedDataSource === "product" ||
      PRODUCT_DETAIL_TYPES.has(String(block.type || "").toLowerCase())
    ) {
      renderedNode = (
        <Component
          {...componentProps}
          product={selectedProduct}
          selectedProduct={selectedProduct}
        />
      );
    } else if (!isProductDetailPageContext && (block.type === "pagination" || block.type === "Pagination")) {
      renderedNode = (
        <Component
          {...componentProps}
          currentPage={currentPage}
          totalPages={resolvedTotalPages}
          onPageChange={setCurrentPage}
          totalItems={resolvedTotalCount}
          pageSize={pageSize}
          pageSizeOptions={[24, 48, 96, 100]}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          theme={theme}
        />
      );
    } else if (!isProductDetailPageContext && isProductListingBlock) {
      renderedNode = (
        <Component
          {...componentProps}
          products={resolvedStoreProducts}
          title={dynamicTitle}
          subtitle={dynamicSubtitle}
          itemCount={resolvedTotalCount}
          activeFilterCount={activeFilterCount}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onFilterClick={() => setFilterModalOpen(true)}
          showFilterButton={!isDedicatedSectionOrSearchView}
          currentPage={currentPage}
          totalPages={resolvedTotalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          pageSizeOptions={[24, 48, 96, 100]}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          totalProducts={resolvedTotalCount}
        />
      );
    } else if (resolvedDataSource === "cart") {
      renderedNode = (
        <Component
          {...componentProps}
          cartItems={cartItems}
        />
      );
    } else {
      renderedNode = <Component {...componentProps} />;
    }

    const isSelected = Boolean(
      selectedBlockId &&
      (selectedBlockId === blockId ||
        selectedBlockId === block.id ||
        selectedBlockId === block.type ||
        (selectedBlockId === "hero_banner" && (block.type.includes("banner") || block.type.includes("hero"))) ||
        (selectedBlockId === "product_grid" && (block.type.includes("grid") || block.type.includes("product") || isProductListingBlock)) ||
        (selectedBlockId === "product_detail" && (PRODUCT_DETAIL_TYPES.has(block.type.toLowerCase()) || block.type.includes("detail"))) ||
        (selectedBlockId === "delivery_form" && DELIVERY_TYPES.has(block.type.toLowerCase())) ||
        (selectedBlockId === "payment_methods" && PAYMENT_TYPES.has(block.type.toLowerCase())) ||
        (selectedBlockId === "place_order_cta" && PLACE_ORDER_TYPES.has(block.type.toLowerCase())) ||
        ((selectedBlockId === "cart_view" || selectedBlockId === "cart" || selectedBlockId === "cart_sidebar") &&
          (CART_PAGE_TYPES.has(block.type.toLowerCase()) || isCartBlock)))
    );

    return (
      <EditorBlockWrapper
        key={blockId}
        blockId={blockId}
        blockType={block.type}
        selected={isSelected}
        onSelect={() => onSelectBlock?.(blockId)}
        isCartBlock={isCartBlock}
        maxWidth={blockProps.max_width}
        borderRadius={blockProps.border_radius}
      >
        {renderedNode}
      </EditorBlockWrapper>
    );
  };

  if (!isCheckoutPage) {
    const isFullGlass =
      (theme as any)?.surface_materiality === "full_glass" ||
      (theme as any)?.surface_materiality === "glassmorphism" ||
      (theme as any)?.visual_style === "glassmorphic" ||
      (theme as any)?.name?.toLowerCase()?.includes("glass");

    const isThemeDark = theme?.mode === "dark" || isColorDarkHex(theme?.primary_bg);

    const glassBackground = isThemeDark
      ? "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.18) 0%, transparent 45%), radial-gradient(circle at 90% 60%, rgba(139, 92, 246, 0.18) 0%, transparent 50%), radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.12) 0%, transparent 45%), #090d16"
      : "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.14) 0%, transparent 45%), radial-gradient(circle at 90% 60%, rgba(139, 92, 246, 0.12) 0%, transparent 50%), radial-gradient(circle at 50% 90%, rgba(236, 72, 153, 0.08) 0%, transparent 45%), #f8fafc";

    return (
      <ThemeProvider theme={theme as any}>
        <div
          ref={setContainerEl}
          style={{
            position: "relative",
            width: "100%",
            minHeight: isCartPage ? "calc(100vh - 220px)" : "100%",
            display: isCartPage ? "flex" : undefined,
            flexDirection: isCartPage ? "column" : undefined,
            justifyContent: isCartPage ? "center" : undefined,
            boxSizing: "border-box",
            background: isFullGlass ? glassBackground : (theme?.primary_bg || (isThemeDark ? "#0f172a" : "#ffffff")),
            color: theme?.text_color || (isThemeDark ? "#f8fafc" : "#0f172a"),
          }}
        >
          {/* Festive Background Overlay — strictly on home / catalog landing pages, never on cart, product details, or checkout pages */}
          {!isCartPage && !isProductDetailPageContext && !isCheckoutPage && (
            <FestiveBackgroundOverlay
              festivalTheme={theme?.festival_theme}
              backgroundColor={theme?.primary_bg}
              isDark={isThemeDark}
            />
          )}

          {blocksToRender.map((block, index) => renderBlock(block, index))}
          <FilterModal
            open={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            onApply={(newFilters) => setFilters(newFilters)}
            currentFilters={filters}
            categories={categories}
            collections={collections}
            productTypes={availableProductTypes}
            brands={availableBrands}
            products={sourceProductsForFilters}
            priceRange={{ min: 0, max: 100000 }}
            theme={theme}
            container={containerEl}
            isAdmin={true}
          />
        </div>
      </ThemeProvider>
    );
  }

  const checkoutStepsBlock = blocksToRender.find((block) =>
    block.type === "checkout_steps" ||
    block.type === "checkoutsteps" ||
    block.id === "checkout_steps" ||
    block.id === "checkoutsteps"
  );

  const deliveryBlock = blocksToRender.find((block) =>
    DELIVERY_TYPES.has(block.type.toLowerCase())
  );

  const paymentBlock = blocksToRender.find((block) =>
    PAYMENT_TYPES.has(block.type.toLowerCase())
  );

  const placeOrderBlock = blocksToRender.find((block) =>
    PLACE_ORDER_TYPES.has(block.type.toLowerCase())
  );

  const summaryBlock = blocksToRender.find((block) =>
    CHECKOUT_SUMMARY_TYPES.has(block.type.toLowerCase())
  );

  const usedBlockIds = new Set(
    [checkoutStepsBlock, deliveryBlock, paymentBlock, placeOrderBlock, summaryBlock]
      .filter(Boolean)
      .map((block) => block!.id || block!.type)
  );

  const extraBlocks = blocksToRender.filter((block) => {
    const key = block.id || block.type;
    const type = String(block.type || "").toLowerCase();
    if (
      type.includes("banner") ||
      type.includes("hero") ||
      type.includes("carousel") ||
      type.includes("grid") ||
      type === "navbar" ||
      type === "footer"
    ) {
      return false;
    }
    return !usedBlockIds.has(key);
  });

  const {
    isDark,
    primaryBg: pageBg,
    cardBg,
    textColor,
    mutedTextColor: subtleText,
    borderColor: resolvedBorderColor,
    accentColor,
    panelBg: softPanel,
    subtleBg: mutedPanel,
  } = resolveThemeTokens(theme);
  const isLight = !isDark;

  const shellBg = isLight ? "#ffffff" : "rgba(255,255,255,0.06)";
  const shellBorder = `1px solid ${resolvedBorderColor}`;
  const cardBorder = `1px solid ${resolvedBorderColor}`;
  const cardDivider = `1px solid ${resolvedBorderColor}`;

  const selectedAddress =
    savedAddresses.find((address) => address.id === selectedAddressId) ||
    savedAddresses.find((address) => address.isDefault) ||
    (deliveryData?.id ? deliveryData : null) ||
    savedAddresses[0] ||
    null;

  const currentStepIndex = checkoutSteps.findIndex((step) => step.key === checkoutStep);
  const canContinueDelivery = Boolean(
    (selectedAddress && isDeliveryValid(selectedAddress)) ||
    (deliveryData && isDeliveryValid(deliveryData))
  );
  const canContinuePayment = isPaymentValid(paymentData);

  const goToStep = (nextStep: CheckoutStep) => {
    setCheckoutStep(nextStep);
  };

  const paymentLayoutColumns = isCompactCheckout
    ? "minmax(0, 1fr)"
    : "minmax(0, 1.1fr) minmax(360px, 0.9fr)";

  const reviewLayoutColumns = isCompactCheckout
    ? "minmax(0, 1fr)"
    : "minmax(0, 1.2fr) minmax(340px, 0.8fr)";

  const deliveryCardBg = (theme as any)?.delivery_form_bg || (theme as any)?.checkout_card_bg || cardBg;
  const isDeliveryCardDark = isColorDarkHex(deliveryCardBg);
  const deliveryText = (theme as any)?.delivery_form_text || (isDeliveryCardDark ? "#f8fafc" : "#0f172a");
  const reviewCardText = isDeliveryCardDark ? "#f8fafc" : "#0f172a";
  const reviewCardMuted = isDeliveryCardDark ? "rgba(248, 250, 252, 0.72)" : "rgba(15, 23, 42, 0.65)";

  const infoCardStyle: React.CSSProperties = {
    borderRadius: "14px",
    border: cardBorder,
    background: deliveryCardBg,
    padding: isCompactCheckout ? "14px" : "16px",
    boxShadow: isLight
      ? "0 1px 2px rgba(16,24,40,0.04)"
      : "0 10px 24px rgba(0,0,0,0.14)",
  };

  const displayCartItems =
    cartItems.length > 0
      ? cartItems
      : products.length > 0
        ? [
          {
            id: products[0].id,
            name: products[0].name,
            price: products[0].price,
            quantity: 1,
            image: products[0].image,
            selectedVariantLabel: "Option",
            selectedVariantValue: products[0].sizes?.[0] || undefined,
          },
        ]
        : [];

  const selectedItemsCard = (
    <div style={infoCardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 700,
            color: reviewCardText,
          }}
        >
          Selected items
        </h4>
      </div>

      {displayCartItems.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: reviewCardMuted,
            lineHeight: 1.6,
          }}
        >
          No items in cart.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {displayCartItems.map((item, index) => (
            <div
              key={`${item.id}-${item.selectedVariantValue || "default"}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: isCompactCheckout
                  ? "56px minmax(0, 1fr)"
                  : "64px minmax(0, 1fr) auto",
                gap: "12px",
                alignItems: "center",
                padding: "10px 0",
                borderBottom:
                  index === displayCartItems.length - 1 ? "none" : cardDivider,
              }}
            >
              <div
                style={{
                  width: isCompactCheckout ? "56px" : "64px",
                  height: isCompactCheckout ? "56px" : "64px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: mutedPanel,
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: reviewCardText,
                    lineHeight: 1.35,
                  }}
                >
                  {item.name}
                </p>

                {item.selectedVariantValue ? (
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "12px",
                      color: reviewCardMuted,
                      lineHeight: 1.45,
                    }}
                  >
                    {item.selectedVariantLabel || "Option"}:{" "}
                    {item.selectedVariantValue}
                  </p>
                ) : null}

                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: reviewCardMuted,
                  }}
                >
                  Qty {item.quantity} × ₹{item.price}
                </p>
              </div>

              {!isCompactCheckout ? (
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: reviewCardText,
                    whiteSpace: "nowrap",
                  }}
                >
                  ₹{item.quantity * item.price}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!page) {
    return <div style={{ padding: "24px" }}>Page not found.</div>;
  }

  const configuredMaxWidth =
    deliveryBlock?.props?.max_width ||
    checkoutStepsBlock?.props?.max_width;

  const isFullWidth =
    configuredMaxWidth === "100%" ||
    configuredMaxWidth === "full" ||
    configuredMaxWidth === 100;

  const checkoutOuterMaxWidth = isFullWidth
    ? "100%"
    : configuredMaxWidth
    ? typeof configuredMaxWidth === "number"
      ? `${configuredMaxWidth}px`
      : String(configuredMaxWidth).endsWith("%") || String(configuredMaxWidth).endsWith("px")
      ? String(configuredMaxWidth)
      : `${configuredMaxWidth}px`
    : "1240px";

  const stepsProps = checkoutStepsBlock?.props || {};

  const resolvedStep1 = stepsProps.step_1_label || stepsProps.delivery_label || "Delivery Address";
  const resolvedStep2 = stepsProps.step_2_label || stepsProps.payment_label || "Payment";
  const resolvedStep3 = stepsProps.step_3_label || stepsProps.review_label || "Review & Pay";

  const resolvedCheckoutSteps: { key: CheckoutStep; label: string }[] = [
    { key: "delivery", label: resolvedStep1 },
    { key: "payment", label: resolvedStep2 },
    { key: "review", label: resolvedStep3 },
  ];

  const stepsBg = stepsProps.background_color || shellBg;
  const stepsBorder = stepsProps.border_color ? `1px solid ${stepsProps.border_color}` : shellBorder;
  const stepsRadius = stepsProps.border_radius !== undefined ? `${stepsProps.border_radius}px` : "18px";
  const rawStepRadius = stepsProps.step_radius !== undefined ? Number(stepsProps.step_radius) : 11;
  const stepsBadgeRadius = `${rawStepRadius > 20 ? 11 : rawStepRadius}px`;
  const stepsPadding = stepsProps.padding !== undefined ? `${stepsProps.padding}px` : (isCompactCheckout ? "14px" : "18px");
  const stepsMarginBottom = stepsProps.gap !== undefined ? `${stepsProps.gap}px` : stepsProps.margin_bottom !== undefined ? `${stepsProps.margin_bottom}px` : (isCompactCheckout ? "14px" : "18px");

  const stepsAlign = stepsProps.text_align || "left";
  const stepsGap = stepsProps.step_gap !== undefined ? Number(stepsProps.step_gap) : (isCompactCheckout ? 10 : 16);

  const stepsActiveBadgeBg = stepsProps.active_step_bg || accentColor;
  const stepsActiveBadgeText = stepsProps.active_step_text || "#ffffff";
  const stepsActiveTitle = stepsProps.active_text_color || textColor;
  const stepsActiveLine = stepsProps.line_active_color || accentColor;

  const stepsInactiveBadgeBg = stepsProps.inactive_step_bg || "transparent";
  const stepsInactiveBadgeBorder = stepsProps.inactive_step_border || (isLight ? "#d5dbe4" : "rgba(255,255,255,0.16)");
  const stepsInactiveBadgeText = stepsProps.inactive_step_text || subtleText;
  const stepsInactiveTitle = stepsProps.inactive_text_color || subtleText;
  const stepsInactiveLine = stepsProps.line_inactive_color || (isLight ? "#e5e7eb" : "rgba(255,255,255,0.12)");

  const isStepperSelected = Boolean(
    selectedBlockId &&
    (selectedBlockId === "checkout_steps" ||
     selectedBlockId === "checkoutsteps" ||
     selectedBlockId === checkoutStepsBlock?.id ||
     selectedBlockId === checkoutStepsBlock?.type)
  );

  return (
    <ThemeProvider theme={theme as any}>
      <div
        style={{
          minHeight: "100vh",
          padding: isCompactCheckout ? "16px 12px 28px" : "20px 16px 36px",
          background: pageBg,
        }}
      >
        <div
          style={{
            maxWidth: checkoutOuterMaxWidth,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            transition: "max-width 0.2s ease",
          }}
        >
          <EditorBlockWrapper
            blockId="checkout_steps"
            blockType="checkout_steps"
            selected={isStepperSelected}
            onSelect={() => onSelectBlock?.("checkout_steps")}
            borderRadius={stepsProps.border_radius !== undefined ? Number(stepsProps.border_radius) : 18}
            maxWidth={stepsProps.max_width}
          >
            <div
              style={{
                borderRadius: stepsRadius,
                border: stepsBorder,
                background: stepsBg,
                boxShadow: isLight
                  ? "0 1px 2px rgba(16,24,40,0.04)"
                  : "0 18px 44px rgba(0,0,0,0.22)",
                padding: stepsPadding,
                marginBottom: stepsMarginBottom,
                boxSizing: "border-box",
                cursor: "pointer",
              }}
              onClick={() => onSelectBlock?.("checkout_steps")}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isCompactCheckout
                    ? "minmax(0,1fr)"
                    : "repeat(3, minmax(0, 1fr))",
                  gap: `${stepsGap}px`,
                  alignItems: "center",
                }}
              >
                {resolvedCheckoutSteps.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = step.key === checkoutStep;
                  const isAccessible = true;

                  return (
                    <div
                      key={step.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          !isCompactCheckout && index < resolvedCheckoutSteps.length - 1
                            ? "1fr auto"
                            : "1fr",
                        alignItems: "center",
                        gap: `${Math.max(6, Math.round(stepsGap / 2))}px`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          isAccessible && goToStep(step.key);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          textAlign: stepsAlign as any,
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            stepsAlign === "center"
                              ? "center"
                              : stepsAlign === "right"
                              ? "flex-end"
                              : "flex-start",
                          gap: "10px",
                          opacity: 1,
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: stepsBadgeRadius,
                            display: "grid",
                            placeItems: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                            border:
                              isCurrent || isCompleted
                                ? `1px solid ${stepsActiveBadgeBg}`
                                : `1px solid ${stepsInactiveBadgeBorder}`,
                            background:
                              isCurrent || isCompleted ? stepsActiveBadgeBg : stepsInactiveBadgeBg,
                            color:
                              isCurrent || isCompleted ? stepsActiveBadgeText : stepsInactiveBadgeText,
                            flexShrink: 0,
                          }}
                        >
                          {index + 1}
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: isCurrent ? 700 : 600,
                            color: isCurrent ? stepsActiveTitle : stepsInactiveTitle,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {step.label}
                        </div>
                      </button>

                      {!isCompactCheckout && index < resolvedCheckoutSteps.length - 1 ? (
                        <div
                          style={{
                            height: "1px",
                            background:
                              index < currentStepIndex ? stepsActiveLine : stepsInactiveLine,
                            width: "100%",
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </EditorBlockWrapper>

          {checkoutStep === "delivery" ? (
            <div
              style={{
                minWidth: 0,
                display: "grid",
                gap: "14px",
                alignContent: "start",
              }}
            >
              {deliveryBlock
                ? renderBlock(deliveryBlock, blocksToRender.indexOf(deliveryBlock), {
                  siteId,
                  compact: false,
                  currentStep: "delivery",
                  selectedBlockId,
                  deliveryData,
                  savedAddresses,
                  selectedAddressId,
                  isAuthenticated,
                  isAddressesLoading,
                  onSavedAddressesChange: (addresses: DeliveryData[]) => {
                    setSavedAddresses(addresses);
                    const stillSelected = addresses.find((a) => a.id === selectedAddressId);
                    if (!stillSelected) {
                      const next = addresses.find((a) => a.isDefault) || addresses[0] || null;
                      if (next) {
                        setSelectedAddressId(next.id || null);
                        setDeliveryData(next);
                      } else {
                        setSelectedAddressId(null);
                        setDeliveryData(initialDeliveryData);
                      }
                    }
                  },
                  onSelectAddress: (address: DeliveryData) => {
                    setSelectedAddressId(address.id || null);
                    setDeliveryData(address);
                  },
                  onDeliveryDataChange: setDeliveryData,
                  onContinue: () => goToStep("payment"),
                  continueDisabled: false,
                })
                : null}
            </div>
          ) : null}

          {checkoutStep === "payment" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: paymentLayoutColumns,
                gap: isCompactCheckout ? "14px" : "18px",
                alignItems: "start",
              }}
            >
              <aside
                style={{
                  minWidth: 0,
                  display: "grid",
                  gap: "12px",
                  alignContent: "start",
                  position: isCompactCheckout ? "static" : "sticky",
                  top: isCompactCheckout ? undefined : "84px",
                }}
              >
                {summaryBlock
                  ? renderBlock(summaryBlock, blocksToRender.indexOf(summaryBlock), {
                    mode: "checkout_summary",
                    compact: false,
                    paymentMethod: paymentData.method,
                    show_promo: true,
                    show_summary: true,
                  })
                  : null}
              </aside>

              <div
                style={{
                  minWidth: 0,
                  display: "grid",
                  gap: "14px",
                  alignContent: "start",
                }}
              >
                {paymentBlock
                  ? renderBlock(paymentBlock, blocksToRender.indexOf(paymentBlock), {
                    compact: false,
                    currentStep: "payment",
                    paymentData,
                    onPaymentDataChange: setPaymentData,
                    onBack: () => goToStep("delivery"),
                    onContinue: () => goToStep("review"),
                    continueDisabled: false,
                  })
                  : null}
              </div>
            </div>
          ) : null}

          {checkoutStep === "review" ? (
            <div
              style={{
                borderRadius: "16px",
                border: shellBorder,
                background: shellBg,
                boxShadow: isLight
                  ? "0 1px 2px rgba(16,24,40,0.04)"
                  : "0 10px 24px rgba(0,0,0,0.16)",
                padding: isCompactCheckout ? "16px" : "18px",
              }}
            >
              <div
                style={{
                  marginBottom: "18px",
                  paddingBottom: "12px",
                  borderBottom: cardDivider,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    lineHeight: 1.1,
                    color: isColorDarkHex(shellBg) ? "#f8fafc" : "#0f172a",
                    fontWeight: 700,
                  }}
                >
                  Review & Pay
                </h3>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: reviewLayoutColumns,
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  {selectedItemsCard}

                  <div style={infoCardStyle}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 700,
                          color: deliveryText,
                        }}
                      >
                        Delivery address
                      </h4>

                      <button
                        type="button"
                        onClick={() => goToStep("delivery")}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: accentColor,
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Change
                      </button>
                    </div>

                    <div
                      style={{
                        color: reviewCardMuted,
                        fontSize: "14px",
                        lineHeight: 1.65,
                      }}
                    >
                      <div style={{ color: deliveryText, fontWeight: 700 }}>
                        {(selectedAddress || deliveryData).fullName || "—"}
                      </div>
                      <div>{(selectedAddress || deliveryData).phone || "—"}</div>
                      <div>{(selectedAddress || deliveryData).email || "—"}</div>
                      <div>{(selectedAddress || deliveryData).address || "—"}</div>
                      <div>
                        {(selectedAddress || deliveryData).city || "—"}{" "}
                        {(selectedAddress || deliveryData).pincode ? `- ${(selectedAddress || deliveryData).pincode}` : ""}
                      </div>
                    </div>
                  </div>

                  <div style={infoCardStyle}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 700,
                          color: reviewCardText,
                        }}
                      >
                        Payment method
                      </h4>

                      <button
                        type="button"
                        onClick={() => goToStep("payment")}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: accentColor,
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Change
                      </button>
                    </div>

                    <div
                      style={{
                        color: reviewCardMuted,
                        fontSize: "14px",
                        lineHeight: 1.65,
                      }}
                    >
                      <div style={{ color: reviewCardText, fontWeight: 700 }}>
                        {paymentData.method.toUpperCase() === "UPI"
                          ? "UPI (Google Pay, PhonePe, Paytm, QR)"
                          : paymentData.method.toUpperCase() === "CARD"
                            ? "Credit / Debit Card"
                            : paymentData.method.toUpperCase() === "NETBANKING"
                              ? "Netbanking"
                              : paymentData.method.toUpperCase() === "COD"
                                ? "Cash on Delivery (COD)"
                                : paymentData.method || "—"}
                      </div>
                      <div>
                        {paymentData.method.toUpperCase() === "COD"
                          ? "Pay in cash upon package delivery."
                          : "You will complete payment securely on the next step."}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    minWidth: 0,
                    display: "grid",
                    gap: "12px",
                    alignContent: "start",
                    position: isCompactCheckout ? "static" : "sticky",
                    top: isCompactCheckout ? undefined : "84px",
                  }}
                >
                  {summaryBlock
                    ? renderBlock(summaryBlock, blocksToRender.indexOf(summaryBlock), {
                      mode: "checkout_summary",
                      compact: false,
                      paymentMethod: paymentData.method,
                      show_summary: true,
                      show_items: false,
                      show_promo: false,
                      show_gift_card: false,
                      review_mode: true,
                    })
                    : null}

                  {placeOrderBlock
                    ? renderBlock(placeOrderBlock, blocksToRender.indexOf(placeOrderBlock), {
                      compact: false,
                      buttonLabel:
                        placeOrderBlock.props?.buttonLabel ||
                        (paymentData.method.toUpperCase() === "COD"
                          ? "Place Order"
                          : "Pay Now"),
                      reviewMode: true,
                      disabled: false,
                    })
                    : null}
                </div>
              </div>
            </div>
          ) : null}

          {extraBlocks.length > 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "grid",
                gap: "16px",
                minWidth: 0,
                marginTop: "16px",
              }}
            >
              {extraBlocks.map((block, index) =>
                renderBlock(block, index + blocksToRender.length)
              )}
            </div>
          ) : null}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default EditorRenderPage;