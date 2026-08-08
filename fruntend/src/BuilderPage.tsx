import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import RenderPage from "./RenderPage";
import { CartProvider, Product, useCart } from "./CartContext";
import AdminLayout from "./Component/AdminLayout";
import AdminProducts from "./Component/AdminProducts";
import AdminOrders from "./Component/AdminOrders";
import CheckoutChargesPage from "./Component/CheckoutChargesPage";
import Navbar, { NavbarFixedBounds } from "./Component/Navbar";
import Footer from "./Component/Footer";
import EditorRenderPage from "./customizations/EditorRenderPage";
import EditorSidebar, { EditorTab } from "./customizations/EditorSidebar";
import { EditorSiteDefinition } from "./customizations/editorUtils";
import CustomerOrdersPage from "./pages/CustomerOrdersPage";
import { API_BASE_URL } from "./config/api";
import BuilderShell from "./Component/BuilderShell";
import BuilderTopControlBar from "./Component/BuilderTopControlBar";
import BuilderControlPanel from "./Component/BuilderControlPanel";
import QrLinkPopup from "./Component/QrLinkPopup";
import BuilderDrawerPanel, { AdminNavKey } from "./Component/BuilderDrawerPanel";


type Block = {
  id: string;
  type: string;
  props?: Record<string, any>;
  data_source?: string | null;
  datasource?: string | null;
  actions?: Record<string, any>;
};

type Page = {
  id: string;
  name: string;
  route: string;
  blocks: Block[];
  role?: string;
  flow?: string;
  show_in_nav?: boolean;
  showinnav?: boolean;
  page_type?: string;
};

type NavigationItem = {
  label: string;
  route: string;
  role?: string;
};

type SiteDefinition = EditorSiteDefinition & {
  navigation?: {
    storefront?: NavigationItem[];
    admin?: NavigationItem[];
  };
};

type SavedSite = {
  id: string;
  slug: string;
  site_definition: SiteDefinition;
  draft_definition: SiteDefinition | null;
  version: number;
  created_at: string;
  updated_at: string;
};


const NAVBAR_BLOCK_ID = "global-navbar";
const FOOTER_BLOCK_ID = "global-footer";
const BUILDER_TOPBAR_HEIGHT = 64;
const FIXED_NAVBAR_Z_INDEX = 240;
const FIXED_NAVBAR_CONTENT_OFFSET = 111;


function normalizeRoute(route?: string | null) {
  if (!route || route === "/") return "";
  return route.replace(/^\/+/, "");
}


function toFullAppPath(appBase: string, route?: string | null) {
  const normalized = normalizeRoute(route);
  return normalized ? `${appBase}/${normalized}` : appBase;
}


function isProductDetailBlockType(type: string) {
  return [
    "product_detail",
    "productdetail",
    "product_gallery",
    "productgallery",
    "product_info",
    "productinfo",
    "purchase_panel",
    "purchasepanel",
  ].includes((type || "").toLowerCase());
}


function isProductDetailRoute(route?: string | null) {
  const normalized = normalizeRoute(route);
  return (
    normalized === "products/:productSlug" ||
    normalized === "products/:slug" ||
    normalized === "products/*" ||
    normalized === "product/:productSlug" ||
    normalized === "product/:slug" ||
    normalized === "product/:id" ||
    normalized === "product/*"
  );
}


function getNavbarEditorProps(siteDefinition: SiteDefinition) {
  return {
    brandName: siteDefinition.site?.brand_name || "Website",
    tagline: siteDefinition.theme?.brand_tone || "",
    navigation: siteDefinition.navigation || {
      storefront: [],
      admin: [],
    },
    showSearch: siteDefinition.navbar?.showSearch ?? true,
    showAccount: siteDefinition.navbar?.showAccount ?? true,
    showCart: siteDefinition.navbar?.showCart ?? true,
  };
}


function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}


function normalizeStorefrontProduct(raw: any): Product {
  const attributes = raw?.attributes ?? {};
  const price = Number(raw?.price ?? 0);
  const comparePrice =
    raw?.compare_price != null
      ? Number(raw.compare_price)
      : raw?.comparePrice != null
      ? Number(raw.comparePrice)
      : raw?.original_price != null
      ? Number(raw.original_price)
      : raw?.originalPrice != null
      ? Number(raw.originalPrice)
      : null;
  const images = Array.isArray(raw?.images)
    ? raw.images.filter(
        (img: unknown) => typeof img === "string" && img.trim() !== ""
      )
    : raw?.image
    ? [raw.image]
    : [];
  const variantOption =
    raw?.variant_option ??
    raw?.variantOption ??
    (Array.isArray(attributes?.sizes) || Array.isArray(raw?.sizes)
      ? {
          optionType: "size",
          optionName: "Size",
          optionValues: (
            Array.isArray(attributes?.sizes) ? attributes.sizes : raw?.sizes || []
          ).map((size: string) => ({
            value: String(size),
            inStock: true,
            stockQty: null,
          })),
        }
      : null);
  const stock =
    raw?.stock != null && !Number.isNaN(Number(raw.stock))
      ? Number(raw.stock)
      : 0;
  const inStock =
    typeof raw?.in_stock === "boolean"
      ? raw.in_stock
      : typeof raw?.inStock === "boolean"
      ? raw.inStock
      : stock > 0;
  const originalPrice =
    comparePrice != null && comparePrice > 0 ? comparePrice : price;
  const discountPercent =
    raw?.discountPercent != null
      ? Number(raw.discountPercent)
      : raw?.discount_percent != null
      ? Number(raw.discount_percent)
      : comparePrice != null && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : 0;


  return {
    id: raw?.id != null ? String(raw.id) : slugify(raw?.name || ""),
    site_id: raw?.site_id != null ? String(raw.site_id) : undefined,
    name: raw?.name ?? "",
    brand: raw?.brand ?? "",
    category: raw?.category ?? "",
    description: raw?.description ?? "",
    slug: raw?.slug || slugify(raw?.name) || String(raw?.id ?? ""),
    price,
    compare_price: comparePrice,
    images,
    stock,
    in_stock: inStock,
    variant_option: variantOption,
    originalPrice,
    discountPercent,
    image: images[0] || "",
    sizes: Array.isArray(attributes?.sizes)
      ? attributes.sizes
      : Array.isArray(raw?.sizes)
      ? raw.sizes
      : [],
    inStock,
    average_rating:
      typeof raw?.average_rating === "number"
        ? raw.average_rating
        : Number(raw?.average_rating ?? 0),
    review_count:
      typeof raw?.review_count === "number"
        ? raw.review_count
        : Number(raw?.review_count ?? 0),
    reviews: Array.isArray(raw?.reviews) ? raw.reviews : undefined,
  };
}


async function resolveSiteBySlug(
  siteSlugParam: string
): Promise<SavedSite | null> {
  const publicCandidates = [
    `${API_BASE_URL}/public/sites/slug/${siteSlugParam}`,
    `${API_BASE_URL}/sites/slug/${siteSlugParam}`,
  ];


  for (const url of publicCandidates) {
    try {
      const response = await fetch(url, {
        credentials: "include",
      });


      if (response.ok) {
        const data = await response.json();
        if (
          data?.id ||
          data?.slug ||
          data?.site_definition ||
          data?.draft_definition
        ) {
          return data as SavedSite;
        }
      }
    } catch (error) {
      console.warn("Site slug lookup failed:", url, error);
    }
  }


  try {
    const adminResponse = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
      credentials: "include",
    });


    if (!adminResponse.ok) return null;


    const sites: SavedSite[] = await adminResponse.json();
    return sites.find((site) => site.slug === siteSlugParam) ?? null;
  } catch (error) {
    console.warn("Admin site slug fallback failed:", error);
    return null;
  }
}


function StorefrontShell({
  siteDefinition,
  siteId,
  siteSlug,
  editMode,
  adminTopbarVisible,
  selectedBlockId,
  onSelectBlock,
  storefrontNavbarMode,
  navbarFixedBounds,
  appBase,
  children,
}: {
  siteDefinition: SiteDefinition;
  siteId: string;
  siteSlug: string;
  editMode: boolean;
  adminTopbarVisible: boolean;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  storefrontNavbarMode: "static" | "sticky" | "fixed";
  navbarFixedBounds?: NavbarFixedBounds;
  appBase: string;
  children: React.ReactNode;
}) {
  const navbarProps = getNavbarEditorProps(siteDefinition);
  const navbarIsSelected = selectedBlockId === NAVBAR_BLOCK_ID;


  const contentTopOffset =
    storefrontNavbarMode === "fixed" ? FIXED_NAVBAR_CONTENT_OFFSET : 0;


  const fixedNavbarTopOffset = adminTopbarVisible
    ? BUILDER_TOPBAR_HEIGHT
    : 0;


  return (
    <div
      style={{
        position: "relative",
        minWidth: 0,
        zIndex: 1,
        isolation: "isolate",
        overflow: "visible",
      }}
    >
      <div
        data-editor-block-id={NAVBAR_BLOCK_ID}
        data-editor-block-type="navbar"
        onClick={(e) => {
          if (!editMode) return;
          e.stopPropagation();
          onSelectBlock(NAVBAR_BLOCK_ID);
        }}
        style={{
          position: "relative",
          outline:
            editMode && navbarIsSelected
              ? "2px solid #2563eb"
              : "1px dashed transparent",
          outlineOffset: "4px",
          borderRadius: "8px",
          transition: "outline-color 0.15s ease",
          cursor: editMode ? "pointer" : "default",
          zIndex: storefrontNavbarMode === "fixed" ? FIXED_NAVBAR_Z_INDEX : 5,
          isolation: "isolate",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "12px",
            zIndex: 40,
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            pointerEvents: "none",
            opacity: editMode && navbarIsSelected ? 1 : 0,
            transform:
              editMode && navbarIsSelected
                ? "translateY(0)"
                : "translateY(4px)",
            transition: "all 0.15s ease",
          }}
        >
          navbar
        </div>


        <Navbar
          brandName={navbarProps.brandName}
          logoUrl={siteDefinition.navbar?.logoUrl || siteDefinition.navbar?.logo_url || (navbarProps as any).logoUrl}
          tagline={navbarProps.tagline}
          theme={{
            ...siteDefinition.theme,
            navbar_position: storefrontNavbarMode,
          }}
          navigation={navbarProps.navigation}
          showSearch={navbarProps.showSearch}
          showAccount={navbarProps.showAccount}
          showCart={navbarProps.showCart}
          topOffset={fixedNavbarTopOffset}
          fixedBounds={
            storefrontNavbarMode === "fixed" ? navbarFixedBounds : undefined
          }
          siteSlug={siteSlug}
          appBase={appBase}
        />
      </div>


      <div
        style={{
          position: "relative",
          zIndex: 1,
          overflow: "visible",
          paddingTop: `${contentTopOffset}px`,
        }}
      >
        {children}
      </div>


      {/* Global Footer Block */}
      <div
        data-editor-block-id={FOOTER_BLOCK_ID}
        data-editor-block-type="footer"
        onClick={(e) => {
          if (!editMode) return;
          e.stopPropagation();
          onSelectBlock(FOOTER_BLOCK_ID);
        }}
        style={{
          position: "relative",
          outline:
            editMode && selectedBlockId === FOOTER_BLOCK_ID
              ? "2px solid #2563eb"
              : "1px dashed transparent",
          outlineOffset: "4px",
          borderRadius: "8px",
          transition: "outline-color 0.15s ease",
          cursor: editMode ? "pointer" : "default",
          zIndex: 5,
          isolation: "isolate",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-24px",
            left: "12px",
            zIndex: 40,
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            pointerEvents: "none",
            opacity: editMode && selectedBlockId === FOOTER_BLOCK_ID ? 1 : 0,
            transform:
              editMode && selectedBlockId === FOOTER_BLOCK_ID
                ? "translateY(0)"
                : "translateY(4px)",
            transition: "all 0.15s ease",
          }}
        >
          footer
        </div>

        <Footer
          brandName={siteDefinition.site?.brand_name || (siteDefinition.footer as any)?.brandName}
          tagline={siteDefinition.footer?.tagline}
          copyrightText={siteDefinition.footer?.copyrightText}
          links={siteDefinition.footer?.links}
          show_newsletter={siteDefinition.footer?.show_newsletter}
          newsletter_title={siteDefinition.footer?.newsletter_title}
          show_social_links={siteDefinition.footer?.show_social_links}
          social_links={siteDefinition.footer?.social_links}
          theme={siteDefinition.theme}
        />
      </div>
    </div>
  );
}


function StorefrontPage({
  page,
  siteDefinition,
  selectedProduct,
  siteId,
  siteSlug,
  editMode,
  adminTopbarVisible,
  selectedBlockId,
  onSelectBlock,
  storefrontNavbarMode,
  navbarFixedBounds,
  appBase,
}: {
  page: Page;
  siteDefinition: SiteDefinition;
  selectedProduct?: Product | null;
  siteId: string;
  siteSlug: string;
  editMode: boolean;
  adminTopbarVisible: boolean;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  storefrontNavbarMode: "static" | "sticky" | "fixed";
  navbarFixedBounds?: NavbarFixedBounds;
  appBase: string;
}) {
  return (
    <StorefrontShell
      siteDefinition={siteDefinition}
      siteId={siteId}
      siteSlug={siteSlug}
      editMode={editMode}
      adminTopbarVisible={adminTopbarVisible}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
      storefrontNavbarMode={storefrontNavbarMode}
      navbarFixedBounds={navbarFixedBounds}
      appBase={appBase}
    >
      {editMode ? (
        <EditorRenderPage
          page={page}
          siteId={siteId}
          selectedProduct={selectedProduct ?? undefined}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          theme={siteDefinition.theme}
        />
      ) : (
        <RenderPage
          page={page}
          siteId={siteId}
          selectedProduct={selectedProduct ?? undefined}
          theme={siteDefinition.theme}
        />
      )}
    </StorefrontShell>
  );
}


function BuilderPageContent() {
  const params = useParams();
  const siteId = params.siteId;
  const siteSlugParam = params.slug;
  const productSlug = params.productSlug;


  const navigate = useNavigate();
  const location = useLocation();
  const { products } = useCart();


  const [resolvedSiteId, setResolvedSiteId] = useState("");
  const [siteDefinition, setSiteDefinition] = useState<SiteDefinition | null>(
    null
  );
  const [draftSiteDefinition, setDraftSiteDefinition] =
    useState<SiteDefinition | null>(null);
  const [siteName, setSiteName] = useState("");
  const [siteSlug, setSiteSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);


  const [editMode, setEditMode] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("theme");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [navbarFixedBounds, setNavbarFixedBounds] =
    useState<NavbarFixedBounds>();
  const [controlPanelSelection, setControlPanelSelection] = useState<
    | "saved-sites"
    | "chat"
    | "customize"
    | "admin-panel"
    | "assets"
    | "settings"
    | "qr-link"
    | null
  >(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<
    | "saved-sites"
    | "chat"
    | "customize"
    | "admin-panel"
    | "assets"
    | "settings"
    | "qr-link"
    | null
  >(null);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [savedSitesLoading, setSavedSitesLoading] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<{ new_orders: number; new_returns: number; total: number } | null>(null);


  const previewPaneRef = useRef<HTMLDivElement | null>(null);


  const isStoreRoute = location.pathname.startsWith("/store/");
  const appBase = isStoreRoute
    ? `/store/${siteSlugParam ?? ""}`
    : `/builder/${resolvedSiteId || siteId || ""}`;
  const builderBase = `/builder/${resolvedSiteId || siteId || ""}`;
  const isAdminRoute =
    !isStoreRoute && location.pathname.startsWith(`${builderBase}/admin`);


  const activeAdminNavKey: AdminNavKey | null = isAdminRoute
    ? location.pathname.includes("/checkout-charges")
      ? "checkout-charges"
      : location.pathname.includes("/orders")
      ? "orders"
      : "products"
    : null;


  const activeSiteDefinition = draftSiteDefinition || siteDefinition;
  const storefrontNavbarMode =
    (activeSiteDefinition?.theme?.navbar_position as
      | "static"
      | "sticky"
      | "fixed"
      | undefined) || "fixed";


  const showAdminTopbar = !isStoreRoute && adminAuthenticated;


  useEffect(() => {
    const checkAdminAuth = async () => {
      if (isStoreRoute) {
        setAdminAuthenticated(false);
        setAdminAuthChecked(true);
        return;
      }


      try {
        const response = await fetch(`${API_BASE_URL}/auth/admin/me`, {
          credentials: "include",
        });


        if (!response.ok) {
          setAdminAuthenticated(false);


          if (isAdminRoute) {
            navigate("/admin/login", {
              replace: true,
              state: { from: location.pathname },
            });
          }


          return;
        }


        setAdminAuthenticated(true);
      } catch (error) {
        console.error("Failed to verify admin session:", error);
        setAdminAuthenticated(false);


        if (isAdminRoute) {
          navigate("/admin/login", {
            replace: true,
            state: { from: location.pathname },
          });
        }
      } finally {
        setAdminAuthChecked(true);
      }
    };


    checkAdminAuth();
  }, [isAdminRoute, isStoreRoute, navigate, location.pathname]);


  // Fetch pending order/return counts for the notification badge
  useEffect(() => {
    const currentSiteId = resolvedSiteId || siteId;
    if (!adminAuthenticated || !currentSiteId || isStoreRoute) return;

    const fetchCounts = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/orders/admin/${currentSiteId}/pending-counts`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setPendingCounts(data);
        }
      } catch {
        // silently ignore — this is a non-critical badge
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, [adminAuthenticated, resolvedSiteId, siteId, isStoreRoute]);


  useEffect(() => {
    setNavbarFixedBounds(showAdminTopbar ? { left: 0, width: 0 } : undefined);
  }, [showAdminTopbar]);


  const loadSavedSites = async () => {
    if (isStoreRoute) return;
    try {
      setSavedSitesLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to load admin sites: ${response.status}`);
      }
      const data = await response.json();
      setSavedSites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading saved sites:", error);
      setSavedSites([]);
    } finally {
      setSavedSitesLoading(false);
    }
  };


  useEffect(() => {
    if (!showAdminTopbar) return;
    loadSavedSites();
  }, [showAdminTopbar]);


  const handleDeleteSite = async (targetSiteId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sites/${targetSiteId}`, {
        method: "DELETE",
        credentials: "include",
      });


      if (!response.ok) {
        throw new Error(`Failed to delete site: ${response.status}`);
      }


      setSavedSites((prev) => prev.filter((site) => site.id !== targetSiteId));


      if (targetSiteId === (resolvedSiteId || siteId)) {
        navigate("/admin/sites", { replace: true });
      }
    } catch (error) {
      console.error("Error deleting site:", error);
    }
  };


  const selectedProduct: Product | null = useMemo(() => {
    if (!productSlug) return null;
    if (!products.length) return null;


    const normalizedTarget = String(productSlug).trim().toLowerCase();


    const bySlug = products.find(
      (p) => String(p.slug || "").trim().toLowerCase() === normalizedTarget
    );
    if (bySlug) return bySlug;


    const byId = products.find(
      (p) => String(p.id || "").trim().toLowerCase() === normalizedTarget
    );
    if (byId) return byId;


    const byNameSlug = products.find(
      (p) => slugify(String(p.name || "")) === normalizedTarget
    );
    return byNameSlug ?? null;
  }, [productSlug, products]);


  useEffect(() => {
    const loadSite = async () => {
      try {
        setLoading(true);


        let data: SavedSite | null = null;


        if (siteId) {
          const response = await fetch(`${API_BASE_URL}/sites/${siteId}`, {
            credentials: "include",
          });


          if (!response.ok) {
            throw new Error(`Failed to load site: ${response.status}`);
          }


          data = (await response.json()) as SavedSite;
        } else if (siteSlugParam) {
          data = await resolveSiteBySlug(siteSlugParam);


          if (!data?.id) {
            throw new Error("Site not found for slug");
          }
        } else {
          throw new Error("Missing site identifier");
        }


        const parsedSiteDefinition: SiteDefinition =
          data.draft_definition || data.site_definition;


        setResolvedSiteId(data.id || "");
        setSiteSlug(data.slug || "");


        if (!parsedSiteDefinition) {
          setSiteDefinition(null);
          setDraftSiteDefinition(null);
          setSiteName(data.slug || "");
          return;
        }


        setSiteDefinition(parsedSiteDefinition);
        setDraftSiteDefinition(parsedSiteDefinition);
        setSiteName(
          parsedSiteDefinition.site?.brand_name || data.slug || "Website"
        );


        const freshAppBase = isStoreRoute
          ? `/store/${siteSlugParam ?? ""}`
          : `/builder/${data.id || siteId || ""}`;
        const freshBuilderBase = `/builder/${data.id || siteId || ""}`;


        if (parsedSiteDefinition.pages?.length > 0) {
          const currentPath = window.location.pathname;


          const staticPageRoutes = parsedSiteDefinition.pages.map((page) =>
            toFullAppPath(freshAppBase, page.route)
          );
          const isKnownStaticRoute = staticPageRoutes.includes(currentPath);
          const isDynamicProductRoute =
            currentPath.startsWith(`${freshAppBase}/products/`);
          const isOrdersRoute = currentPath === `${freshAppBase}/orders`;
          const isAdminPath =
            !isStoreRoute && currentPath.startsWith(`${freshBuilderBase}/admin`);


          if (
            !isKnownStaticRoute &&
            !isDynamicProductRoute &&
            !isOrdersRoute &&
            !isAdminPath
          ) {
            const homePage =
              parsedSiteDefinition.pages.find(
                (page) =>
                  page.route === "/" ||
                  page.route === "" ||
                  page.role === "home"
              ) || parsedSiteDefinition.pages[0];


            navigate(toFullAppPath(freshAppBase, homePage.route), {
              replace: true,
            });
          }
        }
      } catch (error) {
        console.error("Error loading site:", error);
        setSiteDefinition(null);
        setDraftSiteDefinition(null);
      } finally {
        setLoading(false);
      }
    };


    if (siteId || siteSlugParam) {
      loadSite();
    }
  }, [siteId, siteSlugParam, navigate, isStoreRoute]);


  const storefrontHomePath = useMemo(() => {
    if (!activeSiteDefinition || activeSiteDefinition.pages.length === 0) {
      return appBase;
    }


    const homePage =
      activeSiteDefinition.pages.find(
        (page) =>
          page.route === "/" || page.route === "" || page.role === "home"
      ) || activeSiteDefinition.pages[0];


    return toFullAppPath(appBase, homePage.route);
  }, [activeSiteDefinition, appBase]);


  const productDetailPage = useMemo(() => {
    if (!activeSiteDefinition) return null;


    const exactProductPage = activeSiteDefinition.pages.find((page) => {
      if (page.role === "product_detail" || page.page_type === "product_detail") return true;
      if (isProductDetailRoute(page.route)) return true;
      return page.blocks.some((block) => isProductDetailBlockType(block.type));
    });


    if (exactProductPage) return exactProductPage;


    return {
      id: "fallback-product-detail",
      name: "Product Detail",
      route: "/products/:productSlug",
      show_in_nav: false,
      blocks: [
        {
          id: "product-detail-fallback",
          type: "product_detail",
          data_source: "product",
        },
      ],
    } as Page;
  }, [activeSiteDefinition]);


  /**
   * Note: this no longer bails out when `isAdminRoute` is true. Callers
   * that need to leave an admin page (Products/Orders/Checkout Charges)
   * call `navigate(storefrontHomePath)` immediately before this, and since
   * `navigate()` doesn't update `location`/`isAdminRoute` synchronously,
   * this function must still be allowed to set `editMode` in that same
   * tick — otherwise Customize would never re-enable itself after
   * visiting Store Control.
   */
  const handleEnterEditMode = () => {
    if (!adminAuthenticated || isStoreRoute) return;
    setEditMode(true);
    setEditorTab("theme");
    setControlPanelSelection("customize");
    setActiveDrawer(null);
  };


  const handleCloseEditMode = () => {
    setEditMode(false);
    setSelectedBlockId(null);
    setEditorTab("theme");
  };


  const handleSelectBlock = (blockId: string) => {
    if (!editMode || !adminAuthenticated) return;
    setSelectedBlockId(blockId);
    setEditorTab("block");
  };


  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setEditMode(false);
      navigate("/admin/login", { replace: true });
    }
  };


  const canEditStorefront =
    !isAdminRoute && !isStoreRoute && adminAuthenticated;


  if (loading || !adminAuthChecked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "24px",
          background: "#f8fafc",
          color: "#111827",
        }}
      >
        <p>Loading website...</p>
      </div>
    );
  }


  if (isAdminRoute && !adminAuthenticated) {
    return null;
  }


  if (!activeSiteDefinition) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "24px",
          background: "#f8fafc",
          color: "#111827",
        }}
      >
        <p>Website not found.</p>
        {!isStoreRoute && (
          <Link to="/admin/sites" style={{ color: "#2563eb" }}>
            Back to dashboard
          </Link>
        )}
      </div>
    );
  }


  const pageBg = isAdminRoute
    ? "#ffffff"
    : activeSiteDefinition.theme?.mode === "light"
    ? "#f8fafc"
    : activeSiteDefinition.theme?.primary_bg || "#0f172a";
  const textColor = isAdminRoute
    ? "#0f172a"
    : activeSiteDefinition.theme?.mode === "light"
    ? "#111827"
    : activeSiteDefinition.theme?.text_color || "#f9fafb";


  const topBar = showAdminTopbar ? (
    <BuilderTopControlBar
      siteName={siteName}
      onGoDashboard={() => navigate("/admin/sites")}
      onLogout={handleLogout}
      userName={undefined}
      userEmail={undefined}
      avatarUrl={undefined}
    />
  ) : null;


  const storeBadge = (pendingCounts?.total ?? 0) > 0 ? pendingCounts!.total : undefined;


  const leftPanel = showAdminTopbar ? (
    <BuilderControlPanel
      activeKey={controlPanelSelection as any}
      badgeCounts={storeBadge != null ? { "admin-panel": storeBadge } : {}}
      onSelect={(key) => {
        if (!showAdminTopbar) return;


        if (key === "customize") {
          if (editMode) {
            handleCloseEditMode();
            return;
          }
          if (isAdminRoute) {
            navigate(storefrontHomePath);
          }
          setControlPanelSelection("customize");
          handleEnterEditMode();
          return;
        }


        if (key === "saved-sites") {
          if (editMode) handleCloseEditMode();
          setControlPanelSelection(key);
          setActiveDrawer((prev) => (prev === "saved-sites" ? null : "saved-sites"));
          return;
        }


        if (key === "admin-panel") {
          if (editMode) handleCloseEditMode();
          setControlPanelSelection(key);
          setActiveDrawer((prev) => (prev === "admin-panel" ? null : "admin-panel"));
          return;
        }


        if (key === "assets") {
          if (editMode) handleCloseEditMode();
          if (isAdminRoute) {
            navigate(storefrontHomePath);
          }
          setControlPanelSelection(key);
          setActiveDrawer((prev) => (prev === "assets" ? null : "assets"));
          return;
        }


        if (key === "chat") {
          if (editMode) handleCloseEditMode();
          if (isAdminRoute) {
            navigate(storefrontHomePath);
          }
          setControlPanelSelection(key);
          setActiveDrawer((prev) => (prev === "chat" ? null : "chat"));
          return;
        }


        if (key === "settings") {
          if (editMode) handleCloseEditMode();
          setControlPanelSelection(key);
          setActiveDrawer((prev) => (prev === "settings" ? null : "settings"));
          return;
        }


        if (key === "qr-link") {
          setQrOpen(true);
          return;
        }
      }}
    />
  ) : null;


  const rightPanel =
    editMode && canEditStorefront && activeSiteDefinition ? (
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          background:
            activeSiteDefinition.theme?.mode === "light"
              ? "rgba(255,255,255,0.96)"
              : "rgba(15,23,42,0.96)",
        }}
      >
        <EditorSidebar
          siteDefinition={activeSiteDefinition}
          selectedBlockId={selectedBlockId}
          selectedTab={editorTab}
          onTabChange={setEditorTab}
          onSiteDefinitionChange={(next) =>
            setDraftSiteDefinition(next as SiteDefinition)
          }
        />
      </div>
    ) : undefined;


  const drawerNode =
    showAdminTopbar && activeDrawer ? (
      <BuilderDrawerPanel
        activeDrawer={activeDrawer}
        onClose={() => setActiveDrawer(null)}
        savedSites={savedSites}
        selectedSiteId={resolvedSiteId || siteId || ""}
        onSelectSite={(targetSiteId) => {
          if (targetSiteId === (resolvedSiteId || siteId)) {
            setActiveDrawer(null);
            return;
          }
          setActiveDrawer(null);
          navigate(`/builder/${targetSiteId}`);
        }}
        onDeleteSite={handleDeleteSite}
        activeAdminNavKey={activeAdminNavKey}
        onSelectAdminNav={(key) => {
          navigate(`${builderBase}/admin/${key}`);
        }}
        siteDefinition={activeSiteDefinition}
        onSiteDefinitionChange={(next) =>
          setDraftSiteDefinition(next as SiteDefinition)
        }
      />
    ) : null;


  return (
    <BuilderShell
      topBar={topBar}
      leftPanel={leftPanel}
      drawer={drawerNode}
      rightPanel={rightPanel}
      previewPaneRef={previewPaneRef}
      plainCenter={isAdminRoute}
    >
      <div
        style={{
          minHeight: "100%",
          background: pageBg,
          color: textColor,
          overflow: "visible",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Routes>
          {!isStoreRoute && (
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="products" replace />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route
                path="checkout-charges"
                element={<CheckoutChargesPage />}
              />
            </Route>
          )}


          <Route
            path="orders"
            element={
              <StorefrontShell
                siteDefinition={activeSiteDefinition}
                siteId={resolvedSiteId || siteId || ""}
                siteSlug={siteSlug}
                editMode={editMode}
                adminTopbarVisible={showAdminTopbar}
                selectedBlockId={selectedBlockId}
                onSelectBlock={handleSelectBlock}
                storefrontNavbarMode={storefrontNavbarMode}
                navbarFixedBounds={navbarFixedBounds}
                appBase={appBase}
              >
                <CustomerOrdersPage
                  siteId={resolvedSiteId || siteId || ""}
                  siteSlug={siteSlug}
                  theme={activeSiteDefinition.theme}
                />
              </StorefrontShell>
            }
          />


          {activeSiteDefinition.pages
            .filter((page) => {
              if (page.flow === "admin") return false;


              const sameAsResolvedProductPage =
                productDetailPage &&
                (page.id === productDetailPage.id ||
                  isProductDetailRoute(page.route) ||
                  page.blocks.some((block) =>
                    isProductDetailBlockType(block.type)
                  ));


              return !sameAsResolvedProductPage;
            })
            .map((page) => {
              const normalizedRoute = normalizeRoute(page.route);


              return (
                <Route
                  key={page.id}
                  path={normalizedRoute}
                  element={
                    <StorefrontPage
                      page={page}
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      selectedProduct={undefined}
                      editMode={editMode}
                      adminTopbarVisible={showAdminTopbar}
                      selectedBlockId={selectedBlockId}
                      onSelectBlock={handleSelectBlock}
                      storefrontNavbarMode={storefrontNavbarMode}
                      navbarFixedBounds={navbarFixedBounds}
                      appBase={appBase}
                    />
                  }
                />
              );
            })}


          {productDetailPage && (
            <Route
              path="products/:productSlug"
              element={
                <StorefrontPage
                  key={`product-detail-${productSlug || "unknown"}`}
                  page={productDetailPage}
                  siteDefinition={activeSiteDefinition}
                  selectedProduct={selectedProduct}
                  siteId={resolvedSiteId || siteId || ""}
                  siteSlug={siteSlug}
                  editMode={editMode}
                  adminTopbarVisible={showAdminTopbar}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={handleSelectBlock}
                  storefrontNavbarMode={storefrontNavbarMode}
                  navbarFixedBounds={navbarFixedBounds}
                  appBase={appBase}
                />
              }
            />
          )}
        </Routes>
      </div>


      <QrLinkPopup
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        customerUrl={
          siteSlug ? `${window.location.origin}/store/${siteSlug}` : ""
        }
      />
    </BuilderShell>
  );
}


export default function BuilderPage() {
  const params = useParams();
  const siteId = params.siteId;
  const siteSlugParam = params.slug;
  const [resolvedSiteId, setResolvedSiteId] = useState(siteId || "");
  const [siteProducts, setSiteProducts] = useState<Product[]>([]);


  useEffect(() => {
    const resolveAndLoadProducts = async () => {
      try {
        let targetSiteId = siteId || "";


        if (!targetSiteId && siteSlugParam) {
          const matchedSite = await resolveSiteBySlug(siteSlugParam);


          if (!matchedSite?.id) {
            throw new Error("Site not found for slug");
          }


          targetSiteId = matchedSite.id;
        }


        if (!targetSiteId) {
          setSiteProducts([]);
          return;
        }


        setResolvedSiteId(targetSiteId);


        const res = await fetch(
          `${API_BASE_URL}/sites/${targetSiteId}/products/public`
        );


        if (res.ok) {
          const data = await res.json();
          const normalizedProducts = Array.isArray(data)
            ? data.map(normalizeStorefrontProduct)
            : [];
          setSiteProducts(normalizedProducts);
        } else {
          console.error("Failed to load products for site", res.status);
          setSiteProducts([]);
        }
      } catch (err) {
        console.error("Error loading products for site", err);
        setSiteProducts([]);
      }
    };


    resolveAndLoadProducts();
  }, [siteId, siteSlugParam]);


  return (
    <CartProvider
      key={resolvedSiteId || siteId || siteSlugParam}
      products={siteProducts}
      siteId={resolvedSiteId || siteId || ""}
    >
      <BuilderPageContent />
    </CartProvider>
  );
}
