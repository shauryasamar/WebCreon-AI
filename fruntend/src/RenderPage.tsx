import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCart, Product } from "./CartContext";
import { componentRegistry } from "./componentRegistry";
import { getCheckoutAddresses, SavedAddress } from "./addressService";
import { useCustomerAuth } from "./context/CustomerAuthContext";
import FilterModal, { FilterState } from "./Component/FilterModal";
import { API_BASE_URL } from "./config/api";
import { ThemeProvider } from "./context/ThemeContext";

type Block = {
  id?: string;
  type: string;
  props?: Record<string, any>;
  data_source?: string | null;
  datasource?: string | null;
  actions?: Record<string, any>;
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

type RenderPageProps = {
  page: Page | null | undefined;
  siteId: string;
  selectedProduct?: Product | null;
  theme?: Theme;
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
};

type PaymentData = {
  method: string;
  upiId: string;
};

type OrderPlacedState = {
  orderId: string;
  status: string;
  total?: number;
} | null;

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

const initialPaymentData: PaymentData = {
  method: "COD",
  upiId: "",
};

function isDeliveryValid(data: DeliveryData) {
  return Boolean(
    data.fullName.trim() &&
      data.phone.trim() &&
      data.email.trim() &&
      data.address.trim() &&
      data.city.trim() &&
      data.pincode.trim()
  );
}

function isPaymentValid(data: PaymentData) {
  if (!data.method.trim()) return false;
  if (data.method.toUpperCase() === "UPI") {
    return Boolean(data.upiId.trim());
  }
  return true;
}

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
  };
}

const RenderPage: React.FC<RenderPageProps> = ({
  page,
  siteId,
  selectedProduct = null,
  theme,
}) => {
  const { products, cartItems } = useCart();
  const { isAuthenticated, loading: authLoading } = useCustomerAuth();

  const location = useLocation();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; slug?: string }[]>([]);
  const [collections, setCollections] = useState<{ id: string; name: string; slug?: string }[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    categoryId: null,
    productTypes: [],
    collections: [],
    brands: [],
    minPrice: 0,
    maxPrice: 100000,
  });
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [isCompactCheckout, setIsCompactCheckout] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery, sortBy]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("search") || "";
    setSearchQuery(q);
  }, [location.search]);

  useEffect(() => {
    if (!siteId) return;
    fetch(`${API_BASE_URL}/sites/${siteId}/categories/public`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch(`${API_BASE_URL}/sites/${siteId}/collections/public`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCollections(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [siteId]);

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("delivery");
  const [deliveryData, setDeliveryData] = useState<DeliveryData>(initialDeliveryData);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryData[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData>(initialPaymentData);
  const [isAddressesLoading, setIsAddressesLoading] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OrderPlacedState>(null);

  useEffect(() => {
    const syncViewport = () => {
      setIsCompactCheckout(window.innerWidth < 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!siteId) return;
    if (authLoading) return;

    if (!isAuthenticated) {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      setDeliveryData(initialDeliveryData);
      setIsAddressesLoading(false);
      return;
    }

    let cancelled = false;

    const loadSavedAddresses = async () => {
      try {
        setIsAddressesLoading(true);
        const addresses = await getCheckoutAddresses(siteId);
        if (cancelled) return;

        const mapped = addresses.map(mapSavedAddressToDeliveryData);
        setSavedAddresses(mapped);

        const selected =
          mapped.find((address) => address.isDefault) || mapped[0] || null;

        if (selected) {
          setSelectedAddressId(selected.id || null);
          setDeliveryData(selected);
        } else {
          setSelectedAddressId(null);
          setDeliveryData(initialDeliveryData);
        }
      } catch (error) {
        console.error("Failed to load checkout addresses", error);
        if (!cancelled) {
          setSavedAddresses([]);
          setSelectedAddressId(null);
          setDeliveryData(initialDeliveryData);
        }
      } finally {
        if (!cancelled) {
          setIsAddressesLoading(false);
        }
      }
    };

    loadSavedAddresses();

    return () => {
      cancelled = true;
    };
  }, [siteId, isAuthenticated, authLoading]);

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

  const availableProductTypes = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.category)
          .filter((category): category is string => Boolean(category))
      )
    ).sort();
  }, [products]);

  const availableBrands = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.brand)
          .filter((brand): brand is string => Boolean(brand))
      )
    ).sort();
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    let list = [...products];

    // Search filter across name, brand, product type
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

    // Broad Category filter
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

    // Product Type filter
    if (filters.productTypes.length > 0) {
      const selectedTypes = filters.productTypes.map((t) => String(t).toLowerCase().trim());
      list = list.filter((p) => {
        const pCat = p.category ? String(p.category).toLowerCase().trim() : "";
        const pCatName = p.category_name ? String(p.category_name).toLowerCase().trim() : "";
        const pName = p.name ? String(p.name).toLowerCase().trim() : "";
        return selectedTypes.some((st) => pCat === st || pCat.includes(st) || st.includes(pCat) || pCatName === st || pName.includes(st));
      });
    }

    // Collections filter
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

    // Brand filter
    if (filters.brands.length > 0) {
      list = list.filter((p) => p.brand && filters.brands.includes(p.brand));
    }

    // Price range
    if (filters.minPrice > 0 || filters.maxPrice < 100000) {
      list = list.filter((p) => {
        const price = Number(p.price || 0);
        return price >= filters.minPrice && price <= filters.maxPrice;
      });
    }

    // Sorting
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
      // default: newest
      list.sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tB - tA;
      });
    }

    return list;
  }, [products, searchQuery, filters, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedProducts.slice(start, start + pageSize);
  }, [filteredAndSortedProducts, currentPage, pageSize]);

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
    if (searchQuery.trim()) return `Search Results for "${searchQuery.trim()}"`;
    if (filters.categoryId) {
      const cat = categories.find((c) => c.id === filters.categoryId);
      if (cat) return cat.name;
    }
    if (filters.collections.length > 0) {
      const matched = collections
        .filter((c) => filters.collections.includes(c.id))
        .map((c) => c.name);
      if (matched.length > 0) return matched.join(", ");
    }
    return "New Arrivals";
  }, [searchQuery, filters, categories, collections]);

  const dynamicSubtitle = useMemo(() => {
    if (searchQuery.trim()) return "Search";
    if (filters.categoryId) return "Category";
    if (filters.collections.length > 0) return "Collection";
    return "Browse Products";
  }, [searchQuery, filters]);

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

    return [
      {
        id: "auto-product-detail-fallback",
        type: "product_detail",
        data_source: "product",
        props: {},
      },
    ];
  }, [isProductDetailPageContext, resolvedBlocks]);

  const blocksToRender = useMemo(() => {
    if (isCheckoutPage) return detailRelevantBlocks;

    let blocks = detailRelevantBlocks;

    // Filter out hero banners on subpages (cart, checkout, product detail, catalog)
    const isLandingHome = page?.role === "home" || page?.id === "home" || page?.page_type === "landing" || page?.route === "/";
    if (!isLandingHome) {
      blocks = blocks.filter((b) => {
        const type = String(b.type || "").toLowerCase();
        return !type.includes("banner") && !type.includes("hero");
      });
    }

    if (searchQuery.trim()) {
      blocks = blocks.filter((b) => {
        const type = String(b.type || "").toLowerCase();
        return !type.includes("banner") && !type.includes("hero");
      });
    }

    let hasRenderedPrimaryCartBlock = false;
    let hasRenderedPrimaryProductDetailBlock = false;

    return blocks.filter((block) => {
      const type = String(block.type || "").toLowerCase();
      const dataSource = block.data_source ?? block.datasource ?? undefined;

      const isCartLike = CART_PAGE_TYPES.has(type) || dataSource === "cart";
      if (isCartPage && isCartLike) {
        if (hasRenderedPrimaryCartBlock) return false;
        hasRenderedPrimaryCartBlock = true;
        return true;
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
  }, [detailRelevantBlocks, isCheckoutPage, isCartPage, isProductDetailPageContext, searchQuery, page]);

  const renderBlock = (
    block: Block,
    index: number,
    overrides?: Record<string, any>
  ) => {
    const Component = componentRegistry[block.type];

    if (!Component) {
      return null;
    }

    const blockId = block.id || block.type || `${page?.id ?? "page"}-${block.type}-${index}`;
    const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;
    const blockProps = (block.props ?? {}) as Record<string, any>;
    const resolvedTheme: Theme | undefined = theme;

    const componentProps = {
      siteId,
      ...blockProps,
      theme: resolvedTheme,
      ...(overrides ?? {}),
    };

    const isProductListingBlock =
      resolvedDataSource === "products" ||
      PRODUCT_LISTING_TYPES.has(String(block.type || "").toLowerCase());

    if (block.type === "navbar") {
      return (
        <Component
          key={blockId}
          {...componentProps}
          onSearch={(query: string) => setSearchQuery(query)}
        />
      );
    }

    if (
      !isProductDetailPageContext &&
      (block.type === "filter_sidebar" || block.type === "filtersidebar")
    ) {
      return (
        <Component
          key={blockId}
          {...componentProps}
          title={dynamicTitle}
          subtitle={dynamicSubtitle}
          itemCount={filteredAndSortedProducts.length}
          activeFilterCount={activeFilterCount}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onFilterClick={() => setFilterModalOpen(true)}
        />
      );
    }

    if (resolvedDataSource === "product") {
      return (
        <Component
          key={blockId}
          {...componentProps}
          product={selectedProduct}
          selectedProduct={selectedProduct}
        />
      );
    }

    if (!isProductDetailPageContext && (block.type === "pagination" || block.type === "Pagination")) {
      return (
        <Component
          key={blockId}
          {...componentProps}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredAndSortedProducts.length}
          pageSize={pageSize}
          theme={theme}
        />
      );
    }

    if (!isProductDetailPageContext && isProductListingBlock) {
      return (
        <Component
          key={blockId}
          {...componentProps}
          products={paginatedProducts}
          title={dynamicTitle}
          subtitle={dynamicSubtitle}
          itemCount={filteredAndSortedProducts.length}
          activeFilterCount={activeFilterCount}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onFilterClick={() => setFilterModalOpen(true)}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalProducts={filteredAndSortedProducts.length}
        />
      );
    }

    if (resolvedDataSource === "cart") {
      return (
        <Component
          key={blockId}
          {...componentProps}
          cartItems={cartItems}
        />
      );
    }

    return <Component key={blockId} {...componentProps} />;
  };

  const isInAdminSpace = location.pathname.startsWith("/builder/");

  if (!isCheckoutPage) {
    return (
      <ThemeProvider theme={theme as any}>
        <div ref={setContainerEl} style={{ position: "relative", width: "100%", minHeight: "100%" }}>
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
            products={products}
            priceRange={{ min: 0, max: 100000 }}
            theme={theme}
            container={isInAdminSpace ? containerEl : undefined}
            isAdmin={isInAdminSpace}
          />
        </div>
      </ThemeProvider>
    );
  }

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

  const explicitLightMode = typeof theme?.mode === "string" && theme.mode.toLowerCase() === "light";
  const explicitDarkMode = typeof theme?.mode === "string" && theme.mode.toLowerCase() === "dark";

  const isLight = explicitLightMode || (!explicitDarkMode && (
    (theme?.text_color && isColorDarkHex(theme.text_color)) || 
    (theme?.primary_bg && !isColorDarkHex(theme.primary_bg)) || 
    (theme?.card_bg && !isColorDarkHex(theme.card_bg)) || 
    (!theme?.text_color && !theme?.primary_bg && !theme?.card_bg)
  ));

  const pageBg = theme?.primary_bg || (isLight ? "#f6f7fb" : "#0f172a");
  const textColor = theme?.text_color || (isLight ? "#111827" : "#f9fafb");
  const isTextColorDark = isColorDarkHex(textColor);
  const subtleText = (theme as any)?.muted_text_color || (isTextColorDark ? "#6b7280" : "rgba(255,255,255,0.68)");
  const accentColor = theme?.accent_color || "#2f6df6";

  const shellBg = isLight ? "#ffffff" : "rgba(15,23,42,0.42)";
  const shellBorder = isLight
    ? "1px solid #e8ebf0"
    : "1px solid rgba(255,255,255,0.08)";
  const softPanel = isLight ? "#f8fafc" : "rgba(255,255,255,0.04)";
  const cardBg = isLight ? "#ffffff" : "rgba(255,255,255,0.04)";
  const cardBorder = isLight
    ? "1px solid #e5e7eb"
    : "1px solid rgba(255,255,255,0.08)";
  const cardDivider = isLight
    ? "1px solid #edf0f4"
    : "1px solid rgba(255,255,255,0.08)";
  const mutedPanel = isLight ? "#f8fafc" : "rgba(255,255,255,0.03)";

  const selectedAddress =
    savedAddresses.find((address) => address.id === selectedAddressId) || null;

  const canContinueDelivery = Boolean(
    selectedAddress && isDeliveryValid(selectedAddress)
  );
  const canContinuePayment = isPaymentValid(paymentData);

  const currentStepIndex = checkoutSteps.findIndex(
    (step) => step.key === checkoutStep
  );

  const goToStep = (nextStep: CheckoutStep) => {
    if (nextStep === "delivery") {
      setCheckoutStep("delivery");
      return;
    }

    if (nextStep === "payment") {
      if (!canContinueDelivery) return;
      setCheckoutStep("payment");
      return;
    }

    if (nextStep === "review") {
      if (!canContinueDelivery || !canContinuePayment) return;
      setCheckoutStep("review");
    }
  };

  const paymentLayoutColumns = isCompactCheckout
    ? "minmax(0, 1fr)"
    : "minmax(0, 1.1fr) minmax(360px, 0.9fr)";

  const reviewLayoutColumns = isCompactCheckout
    ? "minmax(0, 1fr)"
    : "minmax(0, 1.2fr) minmax(340px, 0.8fr)";

  const infoCardStyle: React.CSSProperties = {
    borderRadius: "14px",
    border: cardBorder,
    background: cardBg,
    padding: isCompactCheckout ? "14px" : "16px",
    boxShadow: isLight
      ? "0 1px 2px rgba(16,24,40,0.04)"
      : "0 10px 24px rgba(0,0,0,0.14)",
  };

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
            color: textColor,
          }}
        >
          Selected items
        </h4>
      </div>

      {cartItems.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: subtleText,
            lineHeight: 1.6,
          }}
        >
          No items in cart.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {cartItems.map((item, index) => (
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
                borderBottom: index === cartItems.length - 1 ? "none" : cardDivider,
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
                    color: textColor,
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
                      color: subtleText,
                      lineHeight: 1.45,
                    }}
                  >
                    {item.selectedVariantLabel || "Option"}: {item.selectedVariantValue}
                  </p>
                ) : null}

                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: subtleText,
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
                    color: textColor,
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

  if (placedOrder) {
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
              maxWidth: "720px",
              margin: "0 auto",
              width: "100%",
            }}
          >
            <div
              style={{
                borderRadius: "20px",
                border: shellBorder,
                background: shellBg,
                padding: isCompactCheckout ? "20px 16px" : "32px 24px",
                textAlign: "center",
                boxShadow: isLight
                  ? "0 1px 2px rgba(16,24,40,0.04)"
                  : "0 20px 48px rgba(0,0,0,0.28)",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: isLight ? "#ecfdf5" : "rgba(16,185,129,0.14)",
                  color: "#10b981",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 16px auto",
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <h2
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "24px",
                  fontWeight: 800,
                  color: textColor,
                }}
              >
                Thank you for your order!
              </h2>

              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: subtleText,
                  lineHeight: 1.6,
                }}
              >
                Your order has been received and is being processed.
              </p>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  marginTop: "20px",
                  textAlign: "left",
                  borderRadius: "14px",
                  border: cardBorder,
                  background: cardBg,
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: subtleText }}>Order ID</span>
                  <span style={{ fontSize: "13px", color: textColor, fontWeight: 700 }}>
                    {placedOrder.orderId}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: subtleText }}>Status</span>
                  <span style={{ fontSize: "13px", color: textColor, fontWeight: 700, textTransform: "capitalize" }}>
                    {placedOrder.status.replace(/_/g, " ")}
                  </span>
                </div>

                {typeof placedOrder.total === "number" ? (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontSize: "13px", color: subtleText }}>Total</span>
                    <span style={{ fontSize: "13px", color: textColor, fontWeight: 700 }}>
                      ₹{placedOrder.total}
                    </span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  const path = window.location.pathname;
                  if (path.startsWith("/builder/")) {
                    const segments = path.split("/").filter(Boolean);
                    const currentSiteId = segments[1] || siteId;
                    window.location.href = `/builder/${currentSiteId}`;
                  } else if (path.startsWith("/store/")) {
                    const segments = path.split("/").filter(Boolean);
                    const currentSlug = segments[1];
                    window.location.href = `/store/${currentSlug}`;
                  } else if (siteId) {
                    window.location.href = `/builder/${siteId}`;
                  } else {
                    window.location.href = "/";
                  }
                }}
                style={{
                  marginTop: "24px",
                  padding: "10px 24px",
                  borderRadius: "999px",
                  border: "none",
                  background: accentColor,
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

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
            maxWidth: "1240px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            style={{
              marginBottom: isCompactCheckout ? "14px" : "18px",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: isCompactCheckout
                  ? "clamp(28px, 4vw, 32px)"
                  : "clamp(34px, 4vw, 38px)",
                lineHeight: 1.05,
                fontWeight: 800,
                color: textColor,
                letterSpacing: "-0.03em",
              }}
            >
              {page.title || page.name || "Checkout"}
            </h1>
          </div>

          <div
            style={{
              borderRadius: "18px",
              border: shellBorder,
              background: shellBg,
              boxShadow: isLight
                ? "0 1px 2px rgba(16,24,40,0.04)"
                : "0 18px 44px rgba(0,0,0,0.22)",
              padding: isCompactCheckout ? "14px" : "18px",
              marginBottom: isCompactCheckout ? "14px" : "18px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${checkoutSteps.length}, minmax(0, 1fr))`,
                gap: isCompactCheckout ? "8px" : "12px",
                alignItems: "center",
              }}
            >
              {checkoutSteps.map((step, index) => {
                const isActive = step.key === checkoutStep;
                const isCompleted = index < currentStepIndex;
                const isDisabled =
                  (step.key === "payment" && !canContinueDelivery) ||
                  (step.key === "review" &&
                    (!canContinueDelivery || !canContinuePayment));

                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => !isDisabled && goToStep(step.key)}
                    disabled={isDisabled}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: isCompactCheckout ? "8px 10px" : "10px 14px",
                      borderRadius: "12px",
                      border: isActive
                        ? `1.5px solid ${accentColor}`
                        : "1.5px solid transparent",
                      background: isActive
                        ? isLight
                          ? "#ffffff"
                          : "rgba(255,255,255,0.08)"
                        : "transparent",
                      color: isActive
                        ? textColor
                        : isCompleted
                        ? "#10b981"
                        : subtleText,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      opacity: isDisabled ? 0.45 : 1,
                      transition: "all 0.15s ease",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: isCompleted
                          ? "#10b981"
                          : isActive
                          ? accentColor
                          : isLight
                          ? "#e5e7eb"
                          : "rgba(255,255,255,0.15)",
                        color: isCompleted || isActive ? "#ffffff" : subtleText,
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isCompleted ? "✓" : index + 1}
                    </div>

                    <span
                      style={{
                        fontSize: isCompactCheckout ? "12px" : "13px",
                        fontWeight: isActive ? 700 : 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {step.label}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

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
                  compact: false,
                  currentStep: "delivery",
                  deliveryData,
                  savedAddresses,
                  selectedAddressId,
                  isAuthenticated,
                  isAddressesLoading,
                  onSavedAddressesChange: (addresses: DeliveryData[]) => {
                    setSavedAddresses(addresses);

                    const stillSelected = addresses.find(
                      (address) => address.id === selectedAddressId
                    );

                    if (!stillSelected) {
                      const nextSelected =
                        addresses.find((address) => address.isDefault) ||
                        addresses[0] ||
                        null;

                      if (nextSelected) {
                        setSelectedAddressId(nextSelected.id || null);
                        setDeliveryData(nextSelected);
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
                  onContinue: () => canContinueDelivery && goToStep("payment"),
                  continueDisabled: !canContinueDelivery,
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
                    onContinue: () => canContinuePayment && goToStep("review"),
                    continueDisabled: !canContinuePayment,
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
              background: isLight ? "#ffffff" : softPanel,
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
                  color: textColor,
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
                        color: textColor,
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
                      color: subtleText,
                      fontSize: "14px",
                      lineHeight: 1.65,
                    }}
                  >
                    <div style={{ color: textColor, fontWeight: 700 }}>
                      {selectedAddress?.fullName || deliveryData.fullName || "—"}
                    </div>
                    <div>{selectedAddress?.phone || deliveryData.phone || "—"}</div>
                    <div>{selectedAddress?.email || deliveryData.email || "—"}</div>
                    <div>{selectedAddress?.address || deliveryData.address || "—"}</div>
                    <div>
                      {selectedAddress?.city || deliveryData.city || "—"}
                      {(selectedAddress?.pincode || deliveryData.pincode)
                        ? ` - ${selectedAddress?.pincode || deliveryData.pincode}`
                        : ""}
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
                        color: textColor,
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
                      color: subtleText,
                      fontSize: "14px",
                      lineHeight: 1.65,
                    }}
                  >
                    <div style={{ color: textColor, fontWeight: 700 }}>
                      {paymentData.method || "—"}
                    </div>
                    {paymentData.method.toUpperCase() === "UPI" ? (
                      <div>{paymentData.upiId || "—"}</div>
                    ) : (
                      <div>Payment will be completed using the selected method.</div>
                    )}
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
                      disabled: !(
                        canContinueDelivery &&
                        canContinuePayment &&
                        cartItems.length > 0 &&
                        selectedAddressId
                      ),
                      selectedAddressId,
                      paymentData,
                      onOrderPlaced: (order: {
                        orderId: string;
                        status: string;
                        total?: number;
                      }) => {
                        setPlacedOrder(order);
                      },
                    })
                  : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
    </ThemeProvider>
  );
};

export default RenderPage;