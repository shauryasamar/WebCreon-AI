import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
const BUILDER_TOPBAR_HEIGHT = 64;
const EDITOR_SIDEBAR_WIDTH = 320;
const FIXED_NAVBAR_CONTENT_OFFSET = 96;
const FIXED_NAVBAR_Z_INDEX = 240;

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
    normalized === "products/*"
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
    ? raw.images.filter((img: unknown) => typeof img === "string" && img.trim() !== "")
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
          optionValues: (Array.isArray(attributes?.sizes)
            ? attributes.sizes
            : raw?.sizes || []
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

async function resolveSiteBySlug(siteSlugParam: string): Promise<SavedSite | null> {
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
        if (data?.id || data?.slug || data?.site_definition || data?.draft_definition) {
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
          tagline={navbarProps.tagline}
          theme={{
            ...siteDefinition.theme,
            navbar_position: storefrontNavbarMode,
          }}
          navigation={navbarProps.navigation}
          showSearch={navbarProps.showSearch}
          showAccount={navbarProps.showAccount}
          showCart={navbarProps.showCart}
          topOffset={adminTopbarVisible ? BUILDER_TOPBAR_HEIGHT : 0}
          fixedBounds={storefrontNavbarMode === "fixed" ? navbarFixedBounds : undefined}
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

      <Footer />
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
  const [siteDefinition, setSiteDefinition] = useState<SiteDefinition | null>(null);
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
  const [navbarFixedBounds, setNavbarFixedBounds] = useState<NavbarFixedBounds>();

  const previewPaneRef = useRef<HTMLDivElement | null>(null);

  const isStoreRoute = location.pathname.startsWith("/store/");
  const appBase = isStoreRoute
    ? `/store/${siteSlugParam ?? ""}`
    : `/builder/${resolvedSiteId || siteId || ""}`;

  const builderBase = `/builder/${resolvedSiteId || siteId || ""}`;
  const isAdminRoute =
    !isStoreRoute && location.pathname.startsWith(`${builderBase}/admin`);

  const activeSiteDefinition = draftSiteDefinition || siteDefinition;

  const storefrontNavbarMode =
    (activeSiteDefinition?.theme?.navbar_position as
      | "static"
      | "sticky"
      | "fixed"
      | undefined) || "fixed";

  const storefrontLoginPath = siteSlug ? `/store/${siteSlug}/login` : "#";

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

  useLayoutEffect(() => {
    const element = previewPaneRef.current;
    if (!element) return;

    const updateBounds = () => {
      const rect = element.getBoundingClientRect();
      setNavbarFixedBounds({
        left: rect.left,
        width: rect.width,
      });
    };

    updateBounds();

    const resizeObserver = new ResizeObserver(() => {
      updateBounds();
    });

    resizeObserver.observe(element);
    window.addEventListener("resize", updateBounds);
    window.addEventListener("scroll", updateBounds, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("scroll", updateBounds, true);
    };
  }, [editMode, isAdminRoute, location.pathname]);

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
        setSiteName(parsedSiteDefinition.site?.brand_name || data.slug || "Website");

        if (parsedSiteDefinition.pages?.length > 0) {
          const currentPath = window.location.pathname;

          const staticPageRoutes = parsedSiteDefinition.pages.map((page) =>
            toFullAppPath(appBase, page.route)
          );

          const isKnownStaticRoute = staticPageRoutes.includes(currentPath);
          const isDynamicProductRoute = currentPath.startsWith(`${appBase}/products/`);
          const isOrdersRoute = currentPath === `${appBase}/orders`;
          const isAdminPath = !isStoreRoute && currentPath.startsWith(`${builderBase}/admin`);

          if (!isKnownStaticRoute && !isDynamicProductRoute && !isOrdersRoute && !isAdminPath) {
            const homePage =
              parsedSiteDefinition.pages.find(
                (page) =>
                  page.route === "/" ||
                  page.route === "" ||
                  page.role === "home"
              ) || parsedSiteDefinition.pages[0];

            navigate(toFullAppPath(appBase, homePage.route), {
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
  }, [siteId, siteSlugParam, navigate, appBase, builderBase, isStoreRoute]);

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

  const handleEnterEditMode = () => {
    if (!adminAuthenticated || isAdminRoute || isStoreRoute) return;
    setEditMode(true);
    setEditorTab("theme");
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

  const canEditStorefront = !isAdminRoute && !isStoreRoute && adminAuthenticated;
  const showAdminTopbar = !isStoreRoute && adminAuthenticated;

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

  const pageBg =
    activeSiteDefinition.theme?.mode === "light"
      ? "#f8fafc"
      : activeSiteDefinition.theme?.primary_bg || "#0f172a";

  const textColor =
    activeSiteDefinition.theme?.mode === "light"
      ? "#111827"
      : activeSiteDefinition.theme?.text_color || "#f9fafb";

  const accentColor = activeSiteDefinition.theme?.accent_color || "#2563eb";

  const secondaryButtonStyle = {
    padding: "9px 14px",
    borderRadius: "10px",
    background:
      activeSiteDefinition.theme?.mode === "light"
        ? "rgba(17,24,39,0.06)"
        : "rgba(255,255,255,0.08)",
    color: textColor,
    textDecoration: "none" as const,
    fontSize: "14px",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
  };

  const outlineButtonStyle = {
    padding: "9px 14px",
    borderRadius: "10px",
    border:
      activeSiteDefinition.theme?.mode === "light"
        ? "1px solid rgba(17,24,39,0.12)"
        : "1px solid rgba(255,255,255,0.16)",
    background: "transparent",
    color: textColor,
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: pageBg,
        color: textColor,
        overflow: "visible",
      }}
    >
      {showAdminTopbar && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 300,
            minHeight: `${BUILDER_TOPBAR_HEIGHT}px`,
            background:
              activeSiteDefinition.theme?.mode === "light"
                ? "rgba(255,255,255,0.92)"
                : "rgba(2, 6, 23, 0.88)",
            borderBottom:
              activeSiteDefinition.theme?.mode === "light"
                ? "1px solid rgba(17,24,39,0.08)"
                : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              minHeight: `${BUILDER_TOPBAR_HEIGHT}px`,
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color:
                  activeSiteDefinition.theme?.mode === "light"
                    ? "rgba(17,24,39,0.72)"
                    : "rgba(255,255,255,0.72)",
              }}
            >
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background:
                    activeSiteDefinition.theme?.mode === "light"
                      ? "rgba(37,99,235,0.10)"
                      : "rgba(37,99,235,0.14)",
                  border: "1px solid rgba(37,99,235,0.2)",
                  color: accentColor,
                  fontWeight: 600,
                }}
              >
                {isAdminRoute ? "Admin" : editMode ? "Editing" : "Preview"}
              </span>

              <span>{siteName}</span>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link to="/admin/sites" style={secondaryButtonStyle}>
                Back to dashboard
              </Link>

              {siteSlug && (
                <a
                  href={storefrontLoginPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={secondaryButtonStyle}
                >
                  Customer login
                </a>
              )}

              {isAdminRoute ? (
                <>
                  <Link to={storefrontHomePath} style={secondaryButtonStyle}>
                    Back to website
                  </Link>

                  <button onClick={handleLogout} style={outlineButtonStyle}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to={`${builderBase}/admin/products`}
                    style={secondaryButtonStyle}
                  >
                    Open admin
                  </Link>

                  {!editMode ? (
                    <button
                      onClick={handleEnterEditMode}
                      style={{
                        padding: "9px 14px",
                        borderRadius: "10px",
                        border: "none",
                        background: accentColor,
                        color: "white",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      Customize
                    </button>
                  ) : (
                    <button
                      onClick={handleCloseEditMode}
                      style={outlineButtonStyle}
                    >
                      Exit editor
                    </button>
                  )}

                  <button onClick={handleLogout} style={outlineButtonStyle}>
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          minWidth: 0,
          position: "relative",
          zIndex: 1,
          isolation: "isolate",
          overflow: "visible",
        }}
      >
        <div
          ref={previewPaneRef}
          style={{
            flex: 1,
            minWidth: 0,
            maxWidth:
              editMode && !isAdminRoute && !isStoreRoute
                ? `calc(100% - ${EDITOR_SIDEBAR_WIDTH}px)`
                : "100%",
            position: "relative",
            zIndex: 1,
            overflow: "visible",
          }}
        >
          <Routes>
            {!isStoreRoute && (
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="products" replace />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="checkout-charges" element={<CheckoutChargesPage />} />
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
                    page.blocks.some((block) => isProductDetailBlockType(block.type)));

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

        {editMode && canEditStorefront && activeSiteDefinition && (
          <div
            style={{
              width: `${EDITOR_SIDEBAR_WIDTH}px`,
              flexShrink: 0,
              alignSelf: "flex-start",
              position: "sticky",
              top: `${BUILDER_TOPBAR_HEIGHT}px`,
              zIndex: 120,
              height: `calc(100vh - ${BUILDER_TOPBAR_HEIGHT}px)`,
              overflow: "hidden",
              background:
                activeSiteDefinition.theme?.mode === "light"
                  ? "rgba(255,255,255,0.96)"
                  : "rgba(15,23,42,0.96)",
              borderLeft:
                activeSiteDefinition.theme?.mode === "light"
                  ? "1px solid rgba(17,24,39,0.08)"
                  : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                height: "100%",
                overflowY: "auto",
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
          </div>
        )}
      </div>
    </div>
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

        const res = await fetch(`${API_BASE_URL}/sites/${targetSiteId}/products/public`);

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