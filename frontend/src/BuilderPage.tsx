import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense } from "react";
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
import Navbar, { NavbarFixedBounds } from "./Component/Navbar";
import Footer from "./Component/Footer";
import type { EditorTab } from "./customizations/EditorSidebar";
import type { EditorSiteDefinition } from "./customizations/editorUtils";
import { API_BASE_URL } from "./config/api";
import BuilderShell from "./Component/BuilderShell";
import BuilderTopControlBar from "./Component/BuilderTopControlBar";
import BuilderControlPanel from "./Component/BuilderControlPanel";
import type { AdminNavKey, SettingsNavKey } from "./Component/BuilderDrawerPanel";
import { useAdminAuth } from "./context/AdminAuthContext";

// Direct imports for instant, 60fps zero-jitter workspace interactions
import AdminLayout from "./Component/AdminLayout";
import AdminProducts from "./Component/AdminProducts";
import AdminHomeSections from "./Component/AdminHomeSections";
import AdminOrders from "./Component/AdminOrders";
import AdminCoupons from "./Component/AdminCoupons";
import CheckoutChargesPage from "./Component/CheckoutChargesPage";
import TenantPaymentSettingsPage from "./Component/TenantPaymentSettingsPage";
import TenantEarningsPage from "./Component/TenantEarningsPage";
import DeliverySettingsPage from "./Component/DeliverySettingsPage";
import AdminProfileSettings from "./Component/AdminProfileSettings";
import EditorRenderPage from "./customizations/EditorRenderPage";
import EditorSidebar from "./customizations/EditorSidebar";
import CustomerOrdersPage from "./pages/CustomerOrdersPage";
import CustomerProfilePage from "./pages/CustomerProfilePage";
import CustomerLoginPage from "./pages/CustomerLoginPage";
import CustomerSignupPage from "./pages/CustomerSignupPage";
import QrLinkPopup from "./Component/QrLinkPopup";
import BuilderDrawerPanel from "./Component/BuilderDrawerPanel";
import { normalizeStorefrontProduct, slugify } from "./utils/productNormalizer";
import { isColorDarkHex } from "./context/ThemeContext";
import FestiveBackgroundOverlay from "./Component/FestiveBackgroundOverlay";

// Standalone secondary routes remain lazy
const AgentDeliveryPage = React.lazy(() => import("./pages/AgentDeliveryPage"));
const TrackOrderPage = React.lazy(() => import("./pages/TrackOrderPage"));


type Block = {
  id: string;
  type: string;
  name?: string;
  props?: Record<string, any>;
  data_source?: string | null;
  datasource?: string | null;
  actions?: Record<string, any>;
  isActive?: boolean;
  hidden?: boolean;
  [key: string]: any;
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
  default_return_window_days?: number;
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


export const siteSlugMemoryCache = new Map<string, SavedSite>();


function getInitialCachedSite(slugOrId?: string): SavedSite | null {
  if (!slugOrId) return null;
  if (siteSlugMemoryCache.has(slugOrId)) {
    return siteSlugMemoryCache.get(slugOrId)!;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`wc_site_snapshot_${slugOrId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSite;
        if (parsed?.id || parsed?.site_definition) {
          siteSlugMemoryCache.set(slugOrId, parsed);
          if (parsed.id) siteSlugMemoryCache.set(parsed.id, parsed);
          if (parsed.slug) siteSlugMemoryCache.set(parsed.slug, parsed);
          return parsed;
        }
      }
    } catch (_) { }
  }
  return null;
}

async function resolveSiteBySlug(
  siteSlugParam: string,
  preferNetwork = true
): Promise<SavedSite | null> {
  if (!siteSlugParam) return null;
  if (!preferNetwork && siteSlugMemoryCache.has(siteSlugParam)) {
    return siteSlugMemoryCache.get(siteSlugParam)!;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/public/sites/slug/${siteSlugParam}?t=${Date.now()}`,
      { credentials: "include", cache: "no-cache" }
    );

    if (response.ok) {
      const data = await response.json();
      if (
        data?.id ||
        data?.slug ||
        data?.site_definition ||
        data?.draft_definition
      ) {
        const res = data as SavedSite;
        siteSlugMemoryCache.set(siteSlugParam, res);
        if (res.id) siteSlugMemoryCache.set(res.id, res);
        if (res.slug) siteSlugMemoryCache.set(res.slug, res);
        const parsedDef = res.site_definition || res.draft_definition;
        const targetSlug = res.slug || siteSlugParam;
        if (targetSlug && typeof window !== "undefined") {
          try {
            const serialized = JSON.stringify(res);
            localStorage.setItem(`wc_site_snapshot_${targetSlug}`, serialized);
            if (res.id) {
              localStorage.setItem(`wc_site_snapshot_${res.id}`, serialized);
            }
            if (parsedDef?.theme) {
              localStorage.setItem(
                `wc_theme_mode_${targetSlug}`,
                parsedDef.theme.mode || "light"
              );
              if (parsedDef.theme.primary_bg) {
                localStorage.setItem(
                  `wc_theme_bg_${targetSlug}`,
                  parsedDef.theme.primary_bg
                );
              }
            }
          } catch (_) { }
        }
        return res;
      }
    }
  } catch (error) {
    console.warn("Site slug lookup failed:", error);
  }

  // Fallback to cached copy if offline
  if (siteSlugMemoryCache.has(siteSlugParam)) {
    return siteSlugMemoryCache.get(siteSlugParam)!;
  }

  try {
    const adminResponse = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
      credentials: "include",
    });

    if (!adminResponse.ok) return null;

    const sites: SavedSite[] = await adminResponse.json();
    const found = sites.find((site) => site.slug === siteSlugParam) ?? null;
    if (found) {
      siteSlugMemoryCache.set(siteSlugParam, found);
      if (found.id) siteSlugMemoryCache.set(found.id, found);
      if (found.slug) siteSlugMemoryCache.set(found.slug, found);
      const parsedDef = found.draft_definition || found.site_definition;
      const targetSlug = found.slug || siteSlugParam;
      if (targetSlug && typeof window !== "undefined") {
        try {
          const serialized = JSON.stringify(found);
          localStorage.setItem(`wc_site_snapshot_${targetSlug}`, serialized);
          if (found.id) {
            localStorage.setItem(`wc_site_snapshot_${found.id}`, serialized);
          }
          if (parsedDef?.theme) {
            localStorage.setItem(
              `wc_theme_mode_${targetSlug}`,
              parsedDef.theme.mode || "light"
            );
            if (parsedDef.theme.primary_bg) {
              localStorage.setItem(
                `wc_theme_bg_${targetSlug}`,
                parsedDef.theme.primary_bg
              );
            }
          }
        } catch (_) { }
      }
    }
    return found;
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
  const navbarIsSelected = selectedBlockId === NAVBAR_BLOCK_ID || selectedBlockId === "navbar";
  const footerIsSelected = selectedBlockId === FOOTER_BLOCK_ID || selectedBlockId === "footer";

  const navbarBlockRef = useRef<HTMLDivElement | null>(null);
  const footerBlockRef = useRef<HTMLDivElement | null>(null);
  const [measuredNavbarHeight, setMeasuredNavbarHeight] = useState(118);

  useEffect(() => {
    if (navbarIsSelected && navbarBlockRef.current) {
      navbarBlockRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [navbarIsSelected]);

  useEffect(() => {
    if (footerIsSelected && footerBlockRef.current) {
      footerBlockRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [footerIsSelected]);

  useEffect(() => {
    if (!navbarBlockRef.current) return;

    const updateHeight = () => {
      if (navbarBlockRef.current) {
        const h = navbarBlockRef.current.offsetHeight;
        if (h > 0) {
          setMeasuredNavbarHeight(h);
        }
      }
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(navbarBlockRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [siteDefinition, storefrontNavbarMode]);

  const contentTopOffset =
    (storefrontNavbarMode === "fixed" || storefrontNavbarMode === "sticky")
      ? FIXED_NAVBAR_CONTENT_OFFSET
      : 0;

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
      <FestiveBackgroundOverlay
        festivalTheme={siteDefinition.theme?.festival_theme}
        backgroundColor={siteDefinition.theme?.primary_bg}
        isDark={
          siteDefinition.theme?.mode === "dark" ||
          isColorDarkHex(siteDefinition.theme?.primary_bg)
        }
      />

      {/* Global Navbar Block */}
      <div
        ref={navbarBlockRef}
        data-editor-block-id={NAVBAR_BLOCK_ID}
        data-editor-block-type="navbar"
        onClick={(e) => {
          if (!editMode) return;
          e.stopPropagation();
          onSelectBlock(NAVBAR_BLOCK_ID);
        }}
        style={{
          position: "relative",
          cursor: editMode ? "pointer" : "default",
          zIndex: 1000,
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-2px",
            border: editMode && navbarIsSelected ? "2px solid #3b82f6" : "1px dashed transparent",
            borderRadius: "10px",
            pointerEvents: "none",
            zIndex: 1001,
            transition: "all 0.15s ease",
            boxShadow: editMode && navbarIsSelected ? "0 0 0 3px rgba(59, 130, 246, 0.15)" : "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "-9px",
            left: "14px",
            zIndex: 1002,
            padding: "2px 8px",
            borderRadius: "4px",
            background: "#0f172a",
            color: "#ffffff",
            fontSize: "10.5px",
            fontWeight: 600,
            letterSpacing: "0.01em",
            pointerEvents: "none",
            opacity: editMode && navbarIsSelected ? 1 : 0,
            transform: editMode && navbarIsSelected ? "translateY(0)" : "translateY(4px)",
            transition: "all 0.15s ease",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#3b82f6" }} />
          Navbar
        </div>


        <Navbar
          {...navbarProps}
          siteId={siteId}
          brandName={navbarProps.brandName || siteDefinition.site_name || siteDefinition.name || "WebCreon Store"}
          tagline={navbarProps.tagline}
          logoUrl={siteDefinition.navbar?.logoUrl || siteDefinition.navbar?.logo_url || (navbarProps as any).logoUrl}
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
            (storefrontNavbarMode === "fixed" || storefrontNavbarMode === "sticky") ? navbarFixedBounds : undefined
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
        ref={footerBlockRef}
        data-editor-block-id={FOOTER_BLOCK_ID}
        data-editor-block-type="footer"
        onClick={(e) => {
          if (!editMode) return;
          e.stopPropagation();
          onSelectBlock(FOOTER_BLOCK_ID);
        }}
        style={{
          position: "relative",
          cursor: editMode ? "pointer" : "default",
          zIndex: editMode && footerIsSelected ? 50 : 5,
          isolation: "isolate",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-2px",
            border: editMode && footerIsSelected ? "2px solid #3b82f6" : "1px dashed transparent",
            borderRadius: "10px",
            pointerEvents: "none",
            zIndex: 40,
            transition: "all 0.15s ease",
            boxShadow: editMode && footerIsSelected ? "0 0 0 3px rgba(59, 130, 246, 0.15)" : "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "-9px",
            left: "14px",
            zIndex: 41,
            padding: "2px 8px",
            borderRadius: "4px",
            background: "#0f172a",
            color: "#ffffff",
            fontSize: "10.5px",
            fontWeight: 600,
            letterSpacing: "0.01em",
            pointerEvents: "none",
            opacity: editMode && footerIsSelected ? 1 : 0,
            transform: editMode && footerIsSelected ? "translateY(0)" : "translateY(4px)",
            transition: "all 0.15s ease",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#3b82f6" }} />
          Footer
        </div>

        <Footer
          {...(siteDefinition.footer || {})}
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
  const location = useLocation();
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
        <Suspense
          fallback={
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Loading editor canvas...
            </div>
          }
        >
          <EditorRenderPage
            key={`editor-render-${page?.id || page?.route || "page"}-${location.search}`}
            page={page}
            siteId={siteId}
            selectedProduct={selectedProduct ?? undefined}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            theme={siteDefinition.theme}
          />
        </Suspense>
      ) : (
        <RenderPage
          key={`storefront-render-${page?.id || page?.route || "page"}-${location.search}`}
          page={page}
          siteId={siteId}
          selectedProduct={selectedProduct ?? undefined}
          theme={siteDefinition.theme}
        />
      )}
    </StorefrontShell>
  );
}


function StorefrontSkeleton({
  isProductDetail,
}: {
  isProductDetail?: boolean;
  siteSlug?: string;
}) {
  const bg = "#f8fafc";
  const headerBg = "rgba(255,255,255,0.9)";
  const border = "1px solid rgba(0,0,0,0.06)";
  const cardBg = "#ffffff";
  const cardBorder = "1px solid rgba(0,0,0,0.06)";

  const skStyle: React.CSSProperties = {
    backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 75%)",
    backgroundSize: "200% 100%",
    animation: "storeShimmer 1.5s infinite linear",
    willChange: "background-position",
    transform: "translateZ(0)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: "#0f172a",
        overflow: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @keyframes storeShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Navbar Skeleton */}
      <header
        style={{
          height: "64px",
          borderBottom: border,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: headerBg,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              ...skStyle,
              width: "36px",
              height: "36px",
              borderRadius: "10px",
            }}
          />
          <div
            style={{
              ...skStyle,
              width: "120px",
              height: "18px",
              borderRadius: "6px",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              ...skStyle,
              width: "60px",
              height: "14px",
              borderRadius: "4px",
            }}
          />
          <div
            style={{
              ...skStyle,
              width: "60px",
              height: "14px",
              borderRadius: "4px",
            }}
          />
          <div
            style={{
              ...skStyle,
              width: "38px",
              height: "38px",
              borderRadius: "50%",
            }}
          />
        </div>
      </header>

      {/* Main Body Skeleton */}
      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "32px 20px 64px",
        }}
      >
        {isProductDetail ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "40px",
              alignItems: "start",
            }}
          >
            <div
              style={{
                ...skStyle,
                width: "100%",
                aspectRatio: "1/1",
                borderRadius: "24px",
              }}
            />
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div
                style={{
                  ...skStyle,
                  width: "30%",
                  height: "16px",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  ...skStyle,
                  width: "85%",
                  height: "32px",
                  borderRadius: "8px",
                }}
              />
              <div
                style={{
                  ...skStyle,
                  width: "40%",
                  height: "28px",
                  borderRadius: "6px",
                }}
              />
              <div
                style={{
                  ...skStyle,
                  width: "100%",
                  height: "100px",
                  borderRadius: "12px",
                  marginTop: "12px",
                }}
              />
              <div
                style={{
                  ...skStyle,
                  width: "100%",
                  height: "48px",
                  borderRadius: "14px",
                  marginTop: "16px",
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "36px" }}
          >
            {/* Hero Skeleton */}
            <div
              style={{
                ...skStyle,
                width: "100%",
                height: "220px",
                borderRadius: "24px",
                border: cardBorder,
              }}
            />

            {/* Section Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  ...skStyle,
                  width: "180px",
                  height: "24px",
                  borderRadius: "6px",
                }}
              />
              <div
                style={{
                  ...skStyle,
                  width: "100%",
                  maxWidth: "100px",
                  height: "20px",
                  borderRadius: "6px",
                }}
              />
            </div>

            {/* Product Grid Skeleton (8 Cards) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "20px",
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  style={{
                    background: cardBg,
                    border: cardBorder,
                    borderRadius: "20px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      ...skStyle,
                      width: "100%",
                      aspectRatio: "1/1",
                      borderRadius: "14px",
                    }}
                  />
                  <div
                    style={{
                      ...skStyle,
                      width: "40%",
                      height: "12px",
                      borderRadius: "4px",
                    }}
                  />
                  <div
                    style={{
                      ...skStyle,
                      width: "80%",
                      height: "16px",
                      borderRadius: "6px",
                    }}
                  />
                  <div
                    style={{
                      ...skStyle,
                      width: "50%",
                      height: "20px",
                      borderRadius: "6px",
                    }}
                  />
                  <div
                    style={{
                      ...skStyle,
                      width: "100%",
                      height: "36px",
                      borderRadius: "10px",
                      marginTop: "auto",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


function BuilderPageContent() {
  const params = useParams();
  const siteId = params.siteId;
  const siteSlugParam = params.slug;
  const location = useLocation();
  const pathMatch = location.pathname.match(/\/products\/([^/?#]+)/);
  const productSlug = params.productSlug || (pathMatch ? decodeURIComponent(pathMatch[1]) : undefined);

  const navigate = useNavigate();
  const { products } = useCart();
  const { admin: authAdmin, logoutAdmin: authLogoutAdmin } = useAdminAuth();

  const isStoreRoute = location.pathname.startsWith("/store/");
  const initialCachedSite =
    getInitialCachedSite(siteSlugParam) ||
    getInitialCachedSite(siteId) ||
    null;

  const [resolvedSiteId, setResolvedSiteId] = useState(
    initialCachedSite?.id || siteId || ""
  );
  const [siteDefinition, setSiteDefinition] = useState<SiteDefinition | null>(
    initialCachedSite
      ? initialCachedSite.draft_definition || initialCachedSite.site_definition
      : null
  );
  const [draftSiteDefinition, setDraftSiteDefinition] =
    useState<SiteDefinition | null>(
      initialCachedSite
        ? initialCachedSite.draft_definition || initialCachedSite.site_definition
        : null
    );
  const [siteName, setSiteName] = useState(
    initialCachedSite?.site_definition?.site?.brand_name ||
    initialCachedSite?.slug ||
    ""
  );
  const [siteSlug, setSiteSlug] = useState(initialCachedSite?.slug || "");
  const [loading, setLoading] = useState(!initialCachedSite);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [adminAuthChecked, setAdminAuthChecked] = useState(
    isStoreRoute || !!authAdmin
  );
  const [adminAuthenticated, setAdminAuthenticated] = useState(!!authAdmin);

  const hasUnpublishedChanges = useMemo(() => {
    if (!draftSiteDefinition || !siteDefinition) return false;
    return JSON.stringify(draftSiteDefinition) !== JSON.stringify(siteDefinition);
  }, [draftSiteDefinition, siteDefinition]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant" as ScrollBehavior,
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  const handlePublish = async () => {
    const currentSiteId = resolvedSiteId || siteId;
    if (!currentSiteId || !draftSiteDefinition || publishing) return;

    setPublishing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/sites/${currentSiteId}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draft_definition: draftSiteDefinition }),
      });

      if (!response.ok) {
        throw new Error(`Publish failed: ${response.status}`);
      }

      const updatedSite = await response.json();
      const finalDef = updatedSite.site_definition || draftSiteDefinition;
      setSiteDefinition(finalDef);
      setDraftSiteDefinition(updatedSite.draft_definition || finalDef);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);

      // Invalidate memory and local caches so customer storefront immediately renders new theme
      const currentSlug = siteSlug || updatedSite.slug || siteSlugParam;
      if (currentSlug) {
        siteSlugMemoryCache.set(currentSlug, updatedSite);
        try {
          localStorage.setItem(`wc_site_snapshot_${currentSlug}`, JSON.stringify(updatedSite));
          if (finalDef?.theme) {
            localStorage.setItem(`wc_theme_mode_${currentSlug}`, finalDef.theme.mode || "light");
            if (finalDef.theme.primary_bg) {
              localStorage.setItem(`wc_theme_bg_${currentSlug}`, finalDef.theme.primary_bg);
            }
          }
        } catch (_) { }
      }
      if (currentSiteId) {
        siteSlugMemoryCache.set(currentSiteId, updatedSite);
        try {
          localStorage.setItem(`wc_site_snapshot_${currentSiteId}`, JSON.stringify(updatedSite));
        } catch (_) { }
      }
    } catch (err) {
      console.error("Error publishing site:", err);
    } finally {
      setPublishing(false);
    }
  };

  const handleSiteDefinitionChange = useCallback(
    (next: SiteDefinition) => {
      setDraftSiteDefinition(next);
      const currentSlug = siteSlug || siteSlugParam;
      const currentId = resolvedSiteId || siteId;
      const existing =
        (currentSlug ? siteSlugMemoryCache.get(currentSlug) : null) ||
        (currentId ? siteSlugMemoryCache.get(currentId) : null);

      const updatedSnapshot: SavedSite = {
        id: currentId || existing?.id || "",
        slug: currentSlug || existing?.slug || "",
        draft_definition: next,
        site_definition: siteDefinition || existing?.site_definition || next,
        version: existing?.version ?? 1,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (currentSlug) {
        siteSlugMemoryCache.set(currentSlug, updatedSnapshot);
        try {
          localStorage.setItem(`wc_site_snapshot_${currentSlug}`, JSON.stringify(updatedSnapshot));
          if (next.theme) {
            localStorage.setItem(`wc_theme_mode_${currentSlug}`, next.theme.mode || "light");
            if (next.theme.primary_bg) {
              localStorage.setItem(`wc_theme_bg_${currentSlug}`, next.theme.primary_bg);
            }
          }
        } catch (_) { }
      }

      if (currentId) {
        siteSlugMemoryCache.set(currentId, updatedSnapshot);
        try {
          localStorage.setItem(`wc_site_snapshot_${currentId}`, JSON.stringify(updatedSnapshot));
        } catch (_) { }
      }
    },
    [siteSlug, siteSlugParam, resolvedSiteId, siteId, siteDefinition]
  );

  // Real-time synchronization when Admin sections are modified
  useEffect(() => {
    const handleSync = (e: any) => {
      const updatedDef = e.detail?.siteDefinition;
      if (updatedDef) {
        setDraftSiteDefinition(updatedDef);
        setSiteDefinition(updatedDef);
      }
    };
    window.addEventListener("wc_site_definition_updated", handleSync);
    return () => window.removeEventListener("wc_site_definition_updated", handleSync);
  }, []);


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

  const [activeDrawer, setActiveDrawerState] = useState<
    | "saved-sites"
    | "chat"
    | "customize"
    | "admin-panel"
    | "assets"
    | "settings"
    | "qr-link"
    | null
  >(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = sessionStorage.getItem("wc_active_builder_drawer");
      if (
        saved &&
        [
          "saved-sites",
          "chat",
          "customize",
          "admin-panel",
          "assets",
          "settings",
        ].includes(saved)
      ) {
        return saved as any;
      }
    } catch { }
    return null;
  });

  const setActiveDrawer = useCallback((
    nextState:
      | "saved-sites"
      | "chat"
      | "customize"
      | "admin-panel"
      | "assets"
      | "settings"
      | "qr-link"
      | null
      | ((prev: "saved-sites" | "chat" | "customize" | "admin-panel" | "assets" | "settings" | "qr-link" | null) => "saved-sites" | "chat" | "customize" | "admin-panel" | "assets" | "settings" | "qr-link" | null)
  ) => {
    setActiveDrawerState((prev) => {
      const next = typeof nextState === "function" ? nextState(prev) : nextState;
      try {
        if (next) {
          sessionStorage.setItem("wc_active_builder_drawer", next);
        } else {
          sessionStorage.removeItem("wc_active_builder_drawer");
        }
      } catch { }
      return next;
    });
  }, []);

  const [savedSites, setSavedSites] = useState<SavedSite[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("wc_admin_saved_sites");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [savedSitesLoading, setSavedSitesLoading] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<{ new_orders: number; new_returns: number; total: number } | null>(null);


  const previewPaneRef = useRef<HTMLDivElement | null>(null);

  const appBase = isStoreRoute
    ? `/store/${siteSlugParam ?? ""}`
    : `/builder/${resolvedSiteId || siteId || ""}`;
  const builderBase = `/builder/${resolvedSiteId || siteId || ""}`;
  const isSettingsRoute =
    !isStoreRoute && location.pathname.startsWith(`${builderBase}/settings`);
  const isAdminRoute =
    !isStoreRoute && (location.pathname.startsWith(`${builderBase}/admin`) || isSettingsRoute);

  const activeAdminNavKey: AdminNavKey | null = (!isStoreRoute && location.pathname.startsWith(`${builderBase}/admin`))
    ? location.pathname.includes("/payment-settings")
      ? "payment-settings"
      : location.pathname.includes("/delivery")
        ? "delivery"
        : location.pathname.includes("/earnings")
          ? "earnings"
          : location.pathname.includes("/discounts") || location.pathname.includes("/coupons")
            ? "discounts"
            : location.pathname.includes("/checkout-charges")
              ? "checkout-charges"
              : location.pathname.includes("/orders")
                ? "orders"
                : location.pathname.includes("/home-sections")
                  ? "home-sections"
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

      if (authAdmin) {
        setAdminAuthenticated(true);
        setAdminAuthChecked(true);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/admin/me`, {
          credentials: "include",
        });

        if (!response.ok) {
          setAdminAuthenticated(false);
          if (!isStoreRoute) {
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
        if (!isStoreRoute) {
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
  }, [isAdminRoute, isStoreRoute, authAdmin]);


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
      const response = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to load admin sites: ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setSavedSites(list);
      try {
        localStorage.setItem("wc_admin_saved_sites", JSON.stringify(list));
      } catch (_) { }
    } catch (error) {
      console.error("Error loading saved sites:", error);
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
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to delete site (${response.status})`);
      }

      setSavedSites((prev) => {
        const next = prev.filter((site) => site.id !== targetSiteId);
        try {
          localStorage.setItem("wc_admin_saved_sites", JSON.stringify(next));
        } catch (_) { }
        return next;
      });

      if (targetSiteId === (resolvedSiteId || siteId)) {
        navigate("/admin/sites", { replace: true });
      }
    } catch (error: any) {
      console.error("Error deleting site:", error);
      alert(error?.message || "Failed to delete site.");
    }
  };


  const [asyncDetailProduct, setAsyncDetailProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!productSlug) {
      setAsyncDetailProduct(null);
      return;
    }

    const normalizedTarget = String(productSlug).trim().toLowerCase();
    const inMem = products.find(
      (p) =>
        String(p.slug || "").trim().toLowerCase() === normalizedTarget ||
        String(p.id || "").trim().toLowerCase() === normalizedTarget ||
        slugify(String(p.name || "")) === normalizedTarget
    );

    if (inMem) {
      setAsyncDetailProduct(inMem);
      return;
    }

    let cancelled = false;
    const fetchProduct = async () => {
      try {
        const targetSite = resolvedSiteId || siteId;
        if (!targetSite) return;

        const res = await fetch(
          `${API_BASE_URL}/sites/${targetSite}/products/public/by-slug/${encodeURIComponent(productSlug)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data && (data.id || data.name)) {
            setAsyncDetailProduct(normalizeStorefrontProduct(data));
          }
        }
      } catch (e) {
        console.error("Failed to load product by slug", e);
      }
    };

    fetchProduct();
    return () => {
      cancelled = true;
    };
  }, [productSlug, products, resolvedSiteId, siteId]);

  const selectedProduct: Product | null = useMemo(() => {
    if (!productSlug) return null;

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
    if (byNameSlug) return byNameSlug;

    return asyncDetailProduct ?? null;
  }, [productSlug, products, asyncDetailProduct]);


  useEffect(() => {
    let cancelled = false;

    const loadSite = async () => {
      if (!siteDefinition) {
        setLoading(true);
      }

      try {
        let data: SavedSite | null = null;

        if (siteId) {
          const response = await fetch(`${API_BASE_URL}/sites/${siteId}?t=${Date.now()}`, {
            credentials: "include",
            cache: "no-cache",
          });

          if (!response.ok) {
            throw new Error(`Failed to load site: ${response.status}`);
          }

          data = (await response.json()) as SavedSite;
          siteSlugMemoryCache.set(siteId, data);
          if (data.slug) siteSlugMemoryCache.set(data.slug, data);
          try {
            localStorage.setItem(`wc_site_snapshot_${siteId}`, JSON.stringify(data));
            if (data.slug) {
              localStorage.setItem(`wc_site_snapshot_${data.slug}`, JSON.stringify(data));
              const def = data.draft_definition || data.site_definition;
              if (def?.theme) {
                localStorage.setItem(`wc_theme_mode_${data.slug}`, def.theme.mode || "light");
                if (def.theme.primary_bg) {
                  localStorage.setItem(`wc_theme_bg_${data.slug}`, def.theme.primary_bg);
                }
              }
            }
          } catch (_) { }
        } else if (siteSlugParam) {
          data = await resolveSiteBySlug(siteSlugParam);

          if (!data?.id) {
            throw new Error("Site not found for slug");
          }
        } else {
          throw new Error("Missing site identifier");
        }

        if (cancelled) return;

        const parsedSiteDefinition: SiteDefinition = isStoreRoute
          ? data.site_definition || data.draft_definition
          : data.draft_definition || data.site_definition;

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

        if (isStoreRoute && (data.slug || siteSlugParam)) {
          const sSlug = data.slug || siteSlugParam || "";
          try {
            if (parsedSiteDefinition.theme) {
              localStorage.setItem(`wc_theme_mode_${sSlug}`, parsedSiteDefinition.theme.mode || "light");
              if (parsedSiteDefinition.theme.primary_bg) {
                localStorage.setItem(`wc_theme_bg_${sSlug}`, parsedSiteDefinition.theme.primary_bg);
              }
            }
          } catch (_) { }
        }

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
          const isProfileRoute = currentPath === `${freshAppBase}/profile` || currentPath === `${freshAppBase}/account`;
          const isCartRoute = currentPath === `${freshAppBase}/cart`;
          const isCheckoutRoute = currentPath === `${freshAppBase}/checkout`;
          const isLoginRoute = currentPath === `${freshAppBase}/login`;
          const isSignupRoute = currentPath === `${freshAppBase}/signup`;
          const isAdminPath =
            !isStoreRoute && currentPath.startsWith(`${freshBuilderBase}/admin`);

          if (
            !isKnownStaticRoute &&
            !isDynamicProductRoute &&
            !isOrdersRoute &&
            !isProfileRoute &&
            !isCartRoute &&
            !isCheckoutRoute &&
            !isLoginRoute &&
            !isSignupRoute &&
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
      } catch (error: any) {
        console.error("Error loading site:", error);
        if (!cancelled) {
          setSiteDefinition(null);
          setDraftSiteDefinition(null);
          if (!isStoreRoute) {
            navigate("/admin/sites", { replace: true });
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (siteId || siteSlugParam) {
      loadSite();
    }

    return () => {
      cancelled = true;
    };
  }, [siteId, siteSlugParam, isStoreRoute]);


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

  const checkoutPage = useMemo(() => {
    if (!activeSiteDefinition) return null;
    const exact = activeSiteDefinition.pages.find(
      (p) => p.route === "/checkout" || p.route === "checkout" || p.role === "checkout"
    );
    if (exact) return exact;
    return {
      id: "fallback-checkout-page",
      name: "Checkout",
      route: "/checkout",
      show_in_nav: false,
      blocks: [
        { id: "delivery_form", type: "delivery_form", props: {} },
        { id: "payment_methods", type: "payment_methods", props: {} },
        { id: "place_order_cta", type: "place_order_cta", props: {} },
      ],
    } as Page;
  }, [activeSiteDefinition]);

  const cartPage = useMemo(() => {
    if (!activeSiteDefinition) return null;
    const exact = activeSiteDefinition.pages.find(
      (p) => p.route === "/cart" || p.route === "cart" || p.role === "cart"
    );
    if (exact) return exact;
    return {
      id: "fallback-cart-page",
      name: "Cart",
      route: "/cart",
      show_in_nav: false,
      blocks: [
        { id: "cart_view", type: "cart_view", props: {} },
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


  if (isStoreRoute && loading && !activeSiteDefinition) {
    return (
      <StorefrontSkeleton
        isProductDetail={Boolean(productSlug)}
        siteSlug={siteSlug || siteSlugParam || ""}
      />
    );
  }

  if (!isStoreRoute && !adminAuthenticated && adminAuthChecked) {
    return null;
  }

  if (isStoreRoute && !activeSiteDefinition && !loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#0f172a",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            marginBottom: "16px",
          }}
        >
          🏪
        </div>
        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>Store Not Found</h2>
        <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px", maxWidth: "380px" }}>
          We couldn't locate this storefront. Please check the link or return to the main dashboard.
        </p>
      </div>
    );
  }


  const isDarkSiteTheme = activeSiteDefinition?.theme?.mode === "dark" || isColorDarkHex(activeSiteDefinition?.theme?.primary_bg);
  const pageBg = isAdminRoute
    ? "#ffffff"
    : activeSiteDefinition?.theme?.primary_bg ||
    (isDarkSiteTheme ? "#0f172a" : "#f8fafc");
  const textColor = isAdminRoute
    ? "#0f172a"
    : activeSiteDefinition?.theme?.text_color ||
    (isDarkSiteTheme ? "#f9fafb" : "#111827");


  const topBar = showAdminTopbar ? (
    <BuilderTopControlBar
      siteName={siteName}
      onGoDashboard={() => navigate("/admin/sites")}
      onLogout={async () => {
        await authLogoutAdmin();
        navigate("/admin/login", { replace: true });
      }}
      userName={authAdmin?.name}
      userEmail={authAdmin?.email}
      avatarUrl={authAdmin?.avatarUrl}
      gender={authAdmin?.gender}
    />
  ) : null;


  const storeBadge = (pendingCounts?.total ?? 0) > 0 ? pendingCounts!.total : undefined;


  const leftPanel = showAdminTopbar ? (
    <BuilderControlPanel
      activeKey={(qrOpen ? "qr-link" : editMode ? "customize" : activeDrawer) as any}
      badgeCounts={storeBadge != null ? { "admin-panel": storeBadge } : {}}
      onSelect={(key) => {
        if (!showAdminTopbar) return;

        if (key === "qr-link") {
          if (editMode) handleCloseEditMode();
          setQrOpen((prev) => !prev);
          return;
        }

        // Close QR popup if another tool is clicked
        setQrOpen(false);

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
          onSelectBlock={setSelectedBlockId}
          onSelectPage={(targetRouteOrId) => {
            const targetPage = activeSiteDefinition.pages.find(
              (p) => p.id === targetRouteOrId || p.route === targetRouteOrId
            );
            const route = targetPage ? targetPage.route : targetRouteOrId;
            if (isProductDetailRoute(route)) {
              const sampleSlug = products[0]?.slug || products[0]?.id || "sample-product";
              navigate(toFullAppPath(appBase, `/products/${sampleSlug}`));
            } else {
              navigate(toFullAppPath(appBase, route));
            }
          }}
          onSiteDefinitionChange={(next) =>
            handleSiteDefinitionChange(next as SiteDefinition)
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
          const target = savedSites.find((s) => s.id === targetSiteId);
          if (target) {
            siteSlugMemoryCache.set(targetSiteId, target);
            if (target.slug) siteSlugMemoryCache.set(target.slug, target);
            try {
              localStorage.setItem(
                `wc_site_snapshot_${targetSiteId}`,
                JSON.stringify(target)
              );
              if (target.slug) {
                localStorage.setItem(
                  `wc_site_snapshot_${target.slug}`,
                  JSON.stringify(target)
                );
              }
            } catch (_) { }
          }
          if (targetSiteId === (resolvedSiteId || siteId)) {
            return;
          }
          // Persistent drawer: do NOT close drawer on site switch!
          navigate(`/builder/${targetSiteId}`);
        }}
        onDeleteSite={handleDeleteSite}
        activeAdminNavKey={activeAdminNavKey}
        onSelectAdminNav={(key) => {
          navigate(`${builderBase}/admin/${key}`);
        }}
        activeSettingsNavKey={location.pathname.includes("/settings/profile") ? "profile" : null}
        onSelectSettingsNav={(key) => {
          navigate(`${builderBase}/settings/${key}`);
        }}
        siteDefinition={activeSiteDefinition}
        onSiteDefinitionChange={(next) =>
          handleSiteDefinitionChange(next as SiteDefinition)
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
        {!activeSiteDefinition && loading ? (
          <StorefrontSkeleton
            isProductDetail={Boolean(productSlug)}
            siteSlug={siteSlug || siteSlugParam || ""}
          />
        ) : (
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: "50vh",
                  display: "grid",
                  placeItems: "center",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                Loading page...
              </div>
            }
          >
            <Routes>
              {!isStoreRoute && (
                <>
                  <Route path="admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="products" replace />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="home-sections" element={<AdminHomeSections />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="discounts" element={<AdminCoupons />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                    <Route path="delivery" element={<DeliverySettingsPage />} />
                    <Route path="earnings" element={<TenantEarningsPage />} />
                    <Route path="payment-settings" element={<TenantPaymentSettingsPage />} />
                    <Route
                      path="checkout-charges"
                      element={<CheckoutChargesPage />}
                    />
                  </Route>
                  <Route path="settings" element={<AdminLayout />}>
                    <Route index element={<Navigate to="profile" replace />} />
                    <Route path="profile" element={<AdminProfileSettings />} />
                  </Route>
                </>
              )}

              {/* Agent PWA — no auth, token in URL */}
              <Route path="agent/delivery/:shipmentId" element={<AgentDeliveryPage />} />

              {/* Customer tracking page */}
              <Route path="track/:siteId/:orderId" element={<TrackOrderPage />} />


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

              <Route
                path="profile"
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
                    <CustomerProfilePage
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      theme={activeSiteDefinition.theme}
                    />
                  </StorefrontShell>
                }
              />

              <Route
                path="account"
                element={<Navigate to="profile" replace />}
              />

              <Route
                path="login"
                element={
                  <CustomerLoginPage
                    siteSlug={siteSlug || siteSlugParam || ""}
                    siteName={activeSiteDefinition?.site?.brand_name || siteName || "Store"}
                    theme={activeSiteDefinition?.theme}
                  />
                }
              />

              <Route
                path="signup"
                element={
                  <CustomerSignupPage
                    siteSlug={siteSlug || siteSlugParam || ""}
                    siteName={activeSiteDefinition?.site?.brand_name || siteName || "Store"}
                    theme={activeSiteDefinition?.theme}
                  />
                }
              />

              {cartPage && (
                <Route
                  path="cart"
                  element={
                    <StorefrontPage
                      page={cartPage}
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
              )}

              {checkoutPage && (
                <Route
                  path="checkout"
                  element={
                    <StorefrontPage
                      page={checkoutPage}
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
              )}


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

                  if (sameAsResolvedProductPage) return false;

                  const normalized = normalizeRoute(page.route);
                  if (
                    normalized === "checkout" ||
                    normalized === "cart" ||
                    normalized === "orders" ||
                    normalized === "profile" ||
                    normalized === "account" ||
                    normalized === "login" ||
                    normalized === "signup"
                  ) {
                    return false;
                  }

                  return true;
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
          </Suspense>
        )}
      </div>


      <QrLinkPopup
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        customerUrl={
          siteSlug ? `${window.location.origin}/store/${siteSlug}` : ""
        }
      />

      {/* Floating Bottom-Right Corner Publish Button (Appears only when changes exist) */}
      {showAdminTopbar && !isStoreRoute && !isAdminRoute && (hasUnpublishedChanges || publishing || publishSuccess) && (
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            padding: "10px 22px",
            borderRadius: "999px",
            border: "none",
            background: "linear-gradient(135deg, #0f62ab, #0a467c)",
            color: "#fbbf24",
            fontSize: "13px",
            fontWeight: 800,
            cursor: publishing ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 6px 20px rgba(15,98,171,0.45)",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {publishing ? "Publishing..." : publishSuccess ? "Published" : "Publish"}
        </button>
      )}
    </BuilderShell>
  );
}

export const siteProductsMemoryCache = new Map<string, Product[]>();

function getInitialCachedProducts(slugOrId?: string): Product[] {
  if (!slugOrId) return [];
  if (siteProductsMemoryCache.has(slugOrId)) {
    return siteProductsMemoryCache.get(slugOrId)!;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`wc_site_products_${slugOrId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          siteProductsMemoryCache.set(slugOrId, parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }
  return [];
}

export default function BuilderPage() {
  const params = useParams();
  const siteId = params.siteId;
  const siteSlugParam = params.slug;

  const initialCachedSite =
    getInitialCachedSite(siteSlugParam) || getInitialCachedSite(siteId) || null;
  const [resolvedSiteId, setResolvedSiteId] = useState(
    initialCachedSite?.id || siteId || ""
  );

  const initialProducts =
    (siteSlugParam ? getInitialCachedProducts(siteSlugParam) : []) ||
    (siteId ? getInitialCachedProducts(siteId) : []) ||
    (initialCachedSite?.id ? getInitialCachedProducts(initialCachedSite.id) : []) ||
    [];

  const [siteProducts, setSiteProducts] = useState<Product[]>(
    initialProducts.length > 0
      ? initialProducts
      : (siteSlugParam ? getInitialCachedProducts(siteSlugParam) : [])
  );
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(
    siteProducts.length === 0
  );
  const [defaultReturnWindowDays, setDefaultReturnWindowDays] = useState<number>(
    initialCachedSite?.default_return_window_days != null
      ? Number(initialCachedSite.default_return_window_days)
      : 7
  );

  useEffect(() => {
    let cancelled = false;

    const resolveAndLoadProducts = async () => {
      try {
        let targetSiteId = siteId || "";
        let defaultDays = 7;

        if (!targetSiteId && siteSlugParam) {
          const matchedSite = await resolveSiteBySlug(siteSlugParam);

          if (!matchedSite?.id) {
            throw new Error("Site not found for slug");
          }

          targetSiteId = matchedSite.id;
          if (matchedSite.default_return_window_days != null) {
            defaultDays = Number(matchedSite.default_return_window_days);
          }
        } else if (targetSiteId) {
          try {
            const siteRes = await fetch(`${API_BASE_URL}/sites/${targetSiteId}`, { credentials: "include" });
            if (siteRes.ok) {
              const siteData = await siteRes.json();
              if (siteData?.default_return_window_days != null) {
                defaultDays = Number(siteData.default_return_window_days);
              }
            }
          } catch (_) { }
        }

        if (!targetSiteId) {
          if (!cancelled) {
            setSiteProducts([]);
            setIsProductsLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setResolvedSiteId(targetSiteId);
          setDefaultReturnWindowDays(defaultDays);
        }

        const res = await fetch(
          `${API_BASE_URL}/sites/${targetSiteId}/products/public?page=1&page_size=1000`
        );

        if (res.ok) {
          const data = await res.json();
          const rawList = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
              ? data.items
              : [];
          const normalizedProducts = rawList.map(normalizeStorefrontProduct);
          if (!cancelled) {
            setSiteProducts(normalizedProducts);
            setIsProductsLoading(false);
            siteProductsMemoryCache.set(targetSiteId, normalizedProducts);
            if (siteSlugParam) siteProductsMemoryCache.set(siteSlugParam, normalizedProducts);
            try {
              localStorage.setItem(`wc_site_products_${targetSiteId}`, JSON.stringify(normalizedProducts));
              if (siteSlugParam) {
                localStorage.setItem(`wc_site_products_${siteSlugParam}`, JSON.stringify(normalizedProducts));
              }
            } catch (_) {}
          }
        } else {
          console.error("Failed to load products for site", res.status);
          if (!cancelled) {
            setIsProductsLoading(false);
          }
        }
      } catch (err) {
        console.error("Error loading products for site", err);
        if (!cancelled) {
          setIsProductsLoading(false);
        }
      }
    };

    resolveAndLoadProducts();

    return () => {
      cancelled = true;
    };
  }, [siteId, siteSlugParam]);

  const stableKey = siteSlugParam
    ? `store-${siteSlugParam}`
    : `builder-${siteId || "default"}`;

  return (
    <CartProvider
      key={stableKey}
      products={siteProducts}
      siteId={resolvedSiteId || siteId || ""}
      defaultReturnWindowDays={defaultReturnWindowDays}
      isProductsLoading={isProductsLoading}
    >
      <BuilderPageContent />
    </CartProvider>
  );
}
