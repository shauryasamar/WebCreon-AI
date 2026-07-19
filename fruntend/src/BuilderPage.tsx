import { useEffect, useMemo, useState } from "react";
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
import Navbar from "./Component/Navbar";
import Footer from "./Component/Footer";
import EditorRenderPage from "./customizations/EditorRenderPage";
import EditorSidebar, { EditorTab } from "./customizations/EditorSidebar";
import { EditorSiteDefinition } from "./customizations/editorUtils";

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
  id: number;
  name: string;
  site_type: string;
  domain: string | null;
  region: string | null;
  created_at: string;
};

type SiteVersion = {
  id: number;
  site_id: number;
  prompt: string;
  site_definition_json: string;
  created_at: string;
};

type SiteDetailResponse = {
  site: SavedSite;
  latest_version: SiteVersion | null;
};

function normalizeRoute(route?: string | null) {
  if (!route || route === "/") return "";
  return route.replace(/^\/+/, "");
}

function toFullBuilderPath(builderBase: string, route?: string | null) {
  const normalized = normalizeRoute(route);
  return normalized ? `${builderBase}/${normalized}` : builderBase;
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

function StorefrontPage({
  page,
  siteDefinition,
  selectedProduct,
  siteId,
  editMode,
  selectedBlockId,
  onSelectBlock,
}: {
  page: Page;
  siteDefinition: SiteDefinition;
  selectedProduct?: Product | null;
  siteId: string;
  editMode: boolean;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
}) {
  return (
    <>
      <Navbar
        brandName={siteDefinition.site.brand_name || "Website"}
        tagline={siteDefinition.theme.brand_tone}
        theme={siteDefinition.theme}
        navigation={siteDefinition.navigation}
      />

      {editMode ? (
        <EditorRenderPage
          page={page}
          siteId={siteId}
          selectedProduct={selectedProduct ?? undefined}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
        />
      ) : (
        <RenderPage
          page={page}
          siteId={siteId}
          selectedProduct={selectedProduct ?? undefined}
          theme={siteDefinition.theme}
        />
      )}

      <Footer />
    </>
  );
}

function BuilderPageContent() {
  const { siteId, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { products } = useCart();

  const [siteDefinition, setSiteDefinition] = useState<SiteDefinition | null>(null);
  const [draftSiteDefinition, setDraftSiteDefinition] =
    useState<SiteDefinition | null>(null);
  const [siteName, setSiteName] = useState("");
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("theme");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const builderBase = `/builder/${siteId}`;
  const isAdminRoute = location.pathname.startsWith(`${builderBase}/admin`);

  const activeSiteDefinition = draftSiteDefinition || siteDefinition;

  const selectedProduct: Product | null = useMemo(() => {
    if (!slug) return null;

    const bySlug = products.find((p) => p.slug === slug);
    if (bySlug) return bySlug;

    const byId = products.find((p) => String(p.id) === String(slug));
    return byId ?? null;
  }, [slug, products]);

  useEffect(() => {
    const loadSite = async () => {
      try {
        setLoading(true);

        const response = await fetch(`http://127.0.0.1:8000/sites/${siteId}`);

        if (!response.ok) {
          throw new Error(`Failed to load site: ${response.status}`);
        }

        const data: SiteDetailResponse = await response.json();

        if (!data.latest_version?.site_definition_json) {
          setSiteDefinition(null);
          setDraftSiteDefinition(null);
          setSiteName(data.site?.name || "");
          return;
        }

        const parsedSiteDefinition: SiteDefinition = JSON.parse(
          data.latest_version.site_definition_json
        );

        setSiteDefinition(parsedSiteDefinition);
        setDraftSiteDefinition(parsedSiteDefinition);
        setSiteName(
          parsedSiteDefinition.site?.brand_name || data.site?.name || "Website"
        );

        if (parsedSiteDefinition.pages?.length > 0) {
          const currentPath = window.location.pathname;

          const staticPageRoutes = parsedSiteDefinition.pages.map((page) =>
            toFullBuilderPath(builderBase, page.route)
          );

          const isKnownStaticRoute = staticPageRoutes.includes(currentPath);
          const isDynamicProductRoute = currentPath.startsWith(
            `${builderBase}/products/`
          );
          const isAdminPath = currentPath.startsWith(`${builderBase}/admin`);

          if (!isKnownStaticRoute && !isDynamicProductRoute && !isAdminPath) {
            const homePage =
              parsedSiteDefinition.pages.find(
                (page) =>
                  page.route === "/" ||
                  page.route === "" ||
                  page.role === "home"
              ) || parsedSiteDefinition.pages[0];

            navigate(toFullBuilderPath(builderBase, homePage.route), {
              replace: true,
            });
          }
        }
      } catch (error) {
        console.error("Error loading site:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSite();
  }, [siteId, navigate, builderBase]);

  const storefrontHomePath = useMemo(() => {
    if (!activeSiteDefinition || activeSiteDefinition.pages.length === 0) {
      return builderBase;
    }

    const homePage =
      activeSiteDefinition.pages.find(
        (page) =>
          page.route === "/" || page.route === "" || page.role === "home"
      ) || activeSiteDefinition.pages[0];

    return toFullBuilderPath(builderBase, homePage.route);
  }, [activeSiteDefinition, builderBase]);

  const productDetailPage = useMemo(() => {
    if (!activeSiteDefinition) return null;

    const existing = activeSiteDefinition.pages.find((page) =>
      page.blocks.some((block) => isProductDetailBlockType(block.type))
    );

    if (existing) return existing;

    return {
      id: "fallback-product-detail",
      name: "Product Detail",
      route: "/products/:slug",
      show_in_nav: false,
      blocks: [{ id: "product-detail-fallback", type: "product_detail" }],
    } as Page;
  }, [activeSiteDefinition]);

  const handleEnterEditMode = () => {
    if (isAdminRoute) return;
    setEditMode(true);
    setEditorTab("theme");
  };

  const handleCloseEditMode = () => {
    setEditMode(false);
    setSelectedBlockId(null);
    setEditorTab("theme");
  };

  const handleSelectBlock = (blockId: string) => {
    if (!editMode) return;
    setSelectedBlockId(blockId);
    setEditorTab("block");
  };

  if (loading) {
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
        <Link to="/" style={{ color: "#2563eb" }}>
          Back to dashboard
        </Link>
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: pageBg,
        color: textColor,
        display: "flex",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            backdropFilter: "blur(12px)",
            background:
              activeSiteDefinition.theme?.mode === "light"
                ? "rgba(255,255,255,0.82)"
                : "rgba(2, 6, 23, 0.75)",
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
              <Link
                to="/"
                style={{
                  padding: "9px 14px",
                  borderRadius: "10px",
                  background:
                    activeSiteDefinition.theme?.mode === "light"
                      ? "rgba(17,24,39,0.06)"
                      : "rgba(255,255,255,0.08)",
                  color: textColor,
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Back to dashboard
              </Link>

              {isAdminRoute ? (
                <Link
                  to={storefrontHomePath}
                  style={{
                    padding: "9px 14px",
                    borderRadius: "10px",
                    background:
                      activeSiteDefinition.theme?.mode === "light"
                        ? "rgba(17,24,39,0.06)"
                        : "rgba(255,255,255,0.08)",
                    color: textColor,
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  Back to website
                </Link>
              ) : (
                <>
                  <Link
                    to={`${builderBase}/admin/products`}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "10px",
                      background:
                        activeSiteDefinition.theme?.mode === "light"
                          ? "rgba(17,24,39,0.06)"
                          : "rgba(255,255,255,0.08)",
                      color: textColor,
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
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
                      style={{
                        padding: "9px 14px",
                        borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.16)",
                        background: "transparent",
                        color: textColor,
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      Exit editor
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <Routes>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>

          {activeSiteDefinition.pages
            .filter((page) => page.flow !== "admin")
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
                      siteId={siteId || ""}
                      selectedProduct={undefined}
                      editMode={editMode}
                      selectedBlockId={selectedBlockId}
                      onSelectBlock={handleSelectBlock}
                    />
                  }
                />
              );
            })}

          {productDetailPage && (
            <Route
              path="products/:slug"
              element={
                <StorefrontPage
                  page={productDetailPage}
                  siteDefinition={activeSiteDefinition}
                  selectedProduct={selectedProduct}
                  siteId={siteId || ""}
                  editMode={editMode}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={handleSelectBlock}
                />
              }
            />
          )}
        </Routes>
      </div>

      {editMode && !isAdminRoute && activeSiteDefinition && (
        <EditorSidebar
          siteDefinition={activeSiteDefinition}
          selectedBlockId={selectedBlockId}
          selectedTab={editorTab}
          onTabChange={setEditorTab}
          onSiteDefinitionChange={(next) =>
            setDraftSiteDefinition(next as SiteDefinition)
          }
        />
      )}
    </div>
  );
}

export default function BuilderPage() {
  const { siteId } = useParams();
  const [siteProducts, setSiteProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      if (!siteId) return;

      try {
        const res = await fetch(`http://127.0.0.1:8000/sites/${siteId}/products`);

        if (res.ok) {
          const data: Product[] = await res.json();
          setSiteProducts(data);
        } else {
          console.error("Failed to load products for site", res.status);
          setSiteProducts([]);
        }
      } catch (err) {
        console.error("Error loading products for site", err);
        setSiteProducts([]);
      }
    };

    loadProducts();
  }, [siteId]);

  return (
    <CartProvider key={siteId} products={siteProducts}>
      <BuilderPageContent />
    </CartProvider>
  );
}