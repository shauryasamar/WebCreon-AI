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
import { applyThemeToPages, type EditorSiteDefinition } from "./customizations/editorUtils";
import { API_BASE_URL } from "./config/api";
import BuilderShell from "./Component/BuilderShell";
import { DeviceModeProvider } from "./context/DeviceModeContext";
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
import AdminSupportDesk from "./Component/AdminSupportDesk";
import AdminProfileSettings from "./Component/AdminProfileSettings";
import AdminPages from "./Component/AdminPages";
import AdminAnalytics from "./Component/AdminAnalytics";
import AdminUsersAndRoles from "./Component/AdminUsersAndRoles";
import AdminAuditLogs from "./Component/AdminAuditLogs";
import {
  AdminGeneralSettings,
  AdminDomainSettings,
  AdminBillingSettings,
  AdminIntegrationsSettings,
  AdminHelpAndSupport,
} from "./Component/AdminSettingsViews";
import AccessDeniedView from "./Component/AccessDeniedView";
import StorefrontCustomPage from "./Component/StorefrontCustomPage";
import StoreMaintenancePage from "./Component/StoreMaintenancePage";
import StoreClosedPage from "./Component/StoreClosedPage";

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
import { cleanSiteName } from "./hooks/usePublicSiteTheme";

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
  is_online?: boolean;
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
  const t = (siteDefinition.theme || {}) as Record<string, any>;
  const nav = (siteDefinition.navbar || {}) as Record<string, any>;
  const f = (siteDefinition.footer || {}) as Record<string, any>;
  const resolvedBrandName =
    t.brandName ||
    t.brand_name ||
    nav.brandName ||
    nav.brand_name ||
    f.brandName ||
    f.brand_name ||
    siteDefinition.site?.brand_name ||
    siteDefinition.site_name ||
    siteDefinition.name ||
    "Website";

  return {
    brandName: resolvedBrandName,
    tagline: t.brand_tone || "",
    navigation: siteDefinition.navigation || {
      storefront: [],
      admin: [],
    },
    showSearch: siteDefinition.navbar?.showSearch ?? true,
    showAccount: siteDefinition.navbar?.showAccount ?? true,
    showCart: siteDefinition.navbar?.showCart ?? true,
  };
}

function getFooterEditorProps(siteDefinition: SiteDefinition) {
  const f = (siteDefinition.footer || {}) as Record<string, any>;
  const t = (siteDefinition.theme || {}) as Record<string, any>;
  const nav = (siteDefinition.navbar || {}) as Record<string, any>;
  const defaultBrand =
    f.brandName ||
    f.brand_name ||
    t.brandName ||
    t.brand_name ||
    nav.brandName ||
    nav.brand_name ||
    siteDefinition.site?.brand_name ||
    siteDefinition.site_name ||
    siteDefinition.name ||
    "Website";
  const defaultTagline = (siteDefinition.site as any)?.description || siteDefinition.tagline || t.brand_tone || "Your premium shopping destination.";

  return {
    ...f,
    brandName: f.brandName || f.brand_name || defaultBrand,
    tagline: f.tagline !== undefined && f.tagline !== null ? f.tagline : defaultTagline,
    copyrightText: f.copyrightText,
    show_brand: f.show_brand !== false,
    show_tagline: f.show_tagline !== false,
    show_copyright: f.show_copyright !== false,
    show_newsletter: f.show_newsletter !== false,
    newsletter_title: f.newsletter_title || "Subscribe to Our Newsletter",
    newsletter_subtitle: f.newsletter_subtitle || "",
    newsletter_placeholder: f.newsletter_placeholder || "Enter your email...",
    newsletter_button_text: f.newsletter_button_text || "Join",
    show_social_links: f.show_social_links !== false,
    social_links: Array.isArray(f.social_links) && f.social_links.length > 0
      ? f.social_links
      : [
          { platform: "Instagram", url: "https://instagram.com" },
          { platform: "Twitter / X", url: "https://x.com" },
          { platform: "Facebook", url: "https://facebook.com" },
        ],
    social_icon_variant: f.social_icon_variant || "pill",
    footer_bg: f.footer_bg || t.footer_bg,
    footer_text_color: f.footer_text_color || t.footer_text_color,
    footer_muted_color: f.footer_muted_color || t.footer_muted_color,
    footer_border_color: f.footer_border_color || t.footer_border_color,
    accent_color: f.accent_color || t.accent_color,
    input_bg_color: f.input_bg_color,
    padding_y: f.padding_y,
    padding_x: f.padding_x,
    margin_top: f.margin_top,
    max_width: f.max_width || t.footer_max_width,
    footer_layout: f.footer_layout || t.footer_layout,
  };
}


export const siteSlugMemoryCache = new Map<string, SavedSite>();

import {
  getSavedSitesMemoryCache,
  setSavedSitesMemoryCache,
  clearSavedSitesMemoryCache,
} from "./utils/savedSitesCache";
export { clearSavedSitesMemoryCache };


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
        const parsedDef = res.site_definition;
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
    const found = sites.find((site) => site.slug === siteSlugParam || site.id === siteSlugParam) ?? null;
    if (found) {
      siteSlugMemoryCache.set(siteSlugParam, found);
      if (found.id) siteSlugMemoryCache.set(found.id, found);
      if (found.slug) siteSlugMemoryCache.set(found.slug, found);
      const parsedDef = found.site_definition;
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
      const scrollParent = navbarBlockRef.current.closest(".builder-preview-scroll");
      if (scrollParent) {
        scrollParent.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navbarBlockRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [navbarIsSelected]);

  useEffect(() => {
    if (footerIsSelected && footerBlockRef.current) {
      const scrollParent = footerBlockRef.current.closest(".builder-preview-scroll");
      if (scrollParent) {
        scrollParent.scrollTo({ top: scrollParent.scrollHeight, behavior: "smooth" });
      } else {
        footerBlockRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [footerIsSelected]);

  useEffect(() => {
    const updateHeight = () => {
      const headerEl =
        document.getElementById("storefront-navbar") ||
        (navbarBlockRef.current ? navbarBlockRef.current.querySelector("header") : null);
      if (headerEl) {
        const h = headerEl.offsetHeight;
        if (h > 0) {
          setMeasuredNavbarHeight(h);
        }
      }
    };

    updateHeight();

    const targetEl =
      document.getElementById("storefront-navbar") ||
      (navbarBlockRef.current ? navbarBlockRef.current.querySelector("header") : null) ||
      navbarBlockRef.current;

    if (typeof ResizeObserver !== "undefined" && targetEl) {
      const resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(targetEl);
      return () => resizeObserver.disconnect();
    }
  }, [siteDefinition, storefrontNavbarMode]);

  const resolvedNavbarHeight =
    measuredNavbarHeight > 0
      ? measuredNavbarHeight
      : Number(siteDefinition.theme?.navbar_height || 72);

  const contentTopOffset =
    (storefrontNavbarMode === "fixed" || storefrontNavbarMode === "sticky")
      ? resolvedNavbarHeight
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
        style={{
          position: (storefrontNavbarMode === "fixed" || storefrontNavbarMode === "sticky") ? "static" : "relative",
          zIndex: 1000,
          overflow: "visible",
        }}
      >
        <Navbar
          {...navbarProps}
          siteId={siteId}
          brandName={navbarProps.brandName}
          tagline={navbarProps.tagline}
          logoUrl={siteDefinition.theme?.logoUrl || siteDefinition.theme?.logo_url || ""}
          theme={{
            ...siteDefinition.theme,
            crm_enabled: siteDefinition.crm_enabled !== false,
            navbar_position: storefrontNavbarMode,
          }}
          crm_enabled={siteDefinition.crm_enabled !== false}
          siteDefinition={siteDefinition}
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
          editMode={editMode}
          isSelected={editMode && navbarIsSelected}
          onSelect={() => {
            if (editMode) {
              onSelectBlock(NAVBAR_BLOCK_ID);
            }
          }}
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
            border: editMode && footerIsSelected ? "2px solid #2563eb" : "1.5px dashed transparent",
            borderRadius: "10px",
            pointerEvents: "none",
            zIndex: 40,
            transition: "all 0.15s ease",
            boxShadow: editMode && footerIsSelected
              ? "0 0 0 1px rgba(255, 255, 255, 0.9), 0 0 0 3.5px rgba(37, 99, 235, 0.22)"
              : "none",
          }}
        />

        {editMode && footerIsSelected && (
          <>
            <div
              style={{
                position: "absolute",
                top: "-5px",
                left: "-5px",
                width: "7px",
                height: "7px",
                background: "#ffffff",
                border: "1.5px solid #2563eb",
                borderRadius: "2px",
                zIndex: 42,
                pointerEvents: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "-5px",
                right: "-5px",
                width: "7px",
                height: "7px",
                background: "#ffffff",
                border: "1.5px solid #2563eb",
                borderRadius: "2px",
                zIndex: 42,
                pointerEvents: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-5px",
                left: "-5px",
                width: "7px",
                height: "7px",
                background: "#ffffff",
                border: "1.5px solid #2563eb",
                borderRadius: "2px",
                zIndex: 42,
                pointerEvents: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-5px",
                right: "-5px",
                width: "7px",
                height: "7px",
                background: "#ffffff",
                border: "1.5px solid #2563eb",
                borderRadius: "2px",
                zIndex: 42,
                pointerEvents: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            />
          </>
        )}

        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "14px",
            zIndex: 41,
            padding: "3px 10px 3px 8px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#f8fafc",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            pointerEvents: "none",
            opacity: editMode && footerIsSelected ? 1 : 0,
            transform: editMode && footerIsSelected ? "translateY(0)" : "translateY(-4px)",
            transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.22), 0 1px 3px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: "5.5px",
              height: "5.5px",
              borderRadius: "50%",
              background: "#38bdf8",
              boxShadow: "0 0 6px rgba(56, 189, 248, 0.7)",
              flexShrink: 0,
            }}
          />
          Footer
        </div>

        <Footer
          {...getFooterEditorProps(siteDefinition)}
          theme={siteDefinition.theme}
          appBase={appBase}
          siteSlug={siteSlug}
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
  siteName,
  appBase,
}: {
  page: Page;
  siteDefinition: SiteDefinition;
  selectedProduct?: Product | null;
  siteId: string;
  siteSlug: string;
  siteName?: string;
  editMode: boolean;
  adminTopbarVisible: boolean;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  storefrontNavbarMode: "static" | "sticky" | "fixed";
  navbarFixedBounds?: NavbarFixedBounds;
  appBase: string;
}) {
  const location = useLocation();
  const resolvedSiteName = useMemo(() => {
    return (
      siteName ||
      (siteDefinition as any)?.site?.brand_name ||
      (siteDefinition as any)?.site_name ||
      (siteDefinition as any)?.site_title ||
      (siteDefinition?.navbar as any)?.brandName ||
      (siteDefinition?.navbar as any)?.brand_name ||
      cleanSiteName("", siteSlug) ||
      "Store"
    );
  }, [siteName, siteDefinition, siteSlug]);

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
            siteSlug={siteSlug}
            siteName={resolvedSiteName}
            selectedProduct={selectedProduct ?? undefined}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            theme={siteDefinition.theme}
            appBase={appBase}
          />
        </Suspense>
      ) : (
        <RenderPage
          key={`storefront-render-${page?.id || page?.route || "page"}-${location.search}`}
          page={page}
          siteId={siteId}
          siteSlug={siteSlug}
          siteName={resolvedSiteName}
          selectedProduct={selectedProduct ?? undefined}
          theme={siteDefinition.theme}
          appBase={appBase}
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
  const { admin: authAdmin, logoutAdmin: authLogoutAdmin, hasPermission, isOwner } = useAdminAuth();
  const canPublish = isOwner || hasPermission("customize:publish");

  const isStoreRoute = location.pathname.startsWith("/store/");
  const isPreviewMode = isStoreRoute && (
    location.search.includes("preview=mobile") ||
    location.search.includes("preview=1")
  );
  // Only use the cache when its slug/id exactly matches the current URL param.
  // A mismatch means a *different* site's data is cached (cross-site bleed or stale).
  const initialCachedSite = (() => {
    const raw =
      getInitialCachedSite(siteSlugParam) ||
      getInitialCachedSite(siteId) ||
      null;
    if (!raw) return null;
    if (siteSlugParam && raw.slug !== siteSlugParam && raw.id !== siteSlugParam) return null;
    if (siteId && raw.id !== siteId) return null;
    return raw;
  })();

  const [resolvedSiteId, setResolvedSiteId] = useState(
    initialCachedSite?.id || siteId || ""
  );
  const isTargetSiteToHeal = (initialCachedSite?.id === "9e86e420-7776-4383-8cc1-fe3d9f6cf36a" || siteId === "9e86e420-7776-4383-8cc1-fe3d9f6cf36a");
  const [siteDefinition, setSiteDefinition] = useState<SiteDefinition | null>(
    initialCachedSite
      ? ((isStoreRoute && !isPreviewMode) || isTargetSiteToHeal
          ? (initialCachedSite.site_definition || null)
          : (initialCachedSite.draft_definition || initialCachedSite.site_definition))
      : null
  );
  const [draftSiteDefinition, setDraftSiteDefinition] =
    useState<SiteDefinition | null>(
      initialCachedSite
        ? ((isStoreRoute && !isPreviewMode) || isTargetSiteToHeal
            ? (initialCachedSite.site_definition || null)
            : (initialCachedSite.draft_definition || initialCachedSite.site_definition))
        : null
    );
  const [publishedSiteDefinition, setPublishedSiteDefinition] =
    useState<SiteDefinition | null>(
      initialCachedSite?.site_definition || null
    );
  const activeSiteDefinition = draftSiteDefinition || siteDefinition;
  const [siteName, setSiteName] = useState(
    initialCachedSite?.site_definition?.site?.brand_name ||
    initialCachedSite?.slug ||
    ""
  );
  const [siteSlug, setSiteSlug] = useState(initialCachedSite?.slug || "");
  const [isOnline, setIsOnline] = useState<boolean>(
    initialCachedSite?.is_online !== undefined ? initialCachedSite.is_online : true
  );
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState(!initialCachedSite);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [adminAuthChecked, setAdminAuthChecked] = useState(
    isStoreRoute || !!authAdmin
  );
  const [adminAuthenticated, setAdminAuthenticated] = useState(!!authAdmin);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");

  // When rendered inside a preview iframe, sync live definitions from parent window
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "WC_PREVIEW_SYNC_DEFINITION" && e.data.definition) {
        setDraftSiteDefinition(e.data.definition);
        setSiteDefinition(e.data.definition);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const hasUnpublishedChanges = useMemo(() => {
    if (!draftSiteDefinition || !siteDefinition) return false;
    return JSON.stringify(draftSiteDefinition) !== JSON.stringify(siteDefinition);
  }, [draftSiteDefinition, siteDefinition]);

  // Real-time synchronization when CRM is toggled from AdminSupportDesk
  useEffect(() => {
    const handleCrmChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ siteId?: string; siteSlug?: string; crm_enabled: boolean }>;
      if (!customEvent.detail) return;
      const { siteId: targetSiteId, siteSlug: targetSiteSlug, crm_enabled } = customEvent.detail;
      const currentId = resolvedSiteId || siteId;
      if (
        (targetSiteId && (targetSiteId === currentId || targetSiteId === siteSlug || targetSiteId === siteSlugParam)) ||
        (targetSiteSlug && (targetSiteSlug === currentId || targetSiteSlug === siteSlug || targetSiteSlug === siteSlugParam))
      ) {
        setSiteDefinition((prev) => (prev ? { ...prev, crm_enabled } : prev));
        setDraftSiteDefinition((prev) => (prev ? { ...prev, crm_enabled } : prev));
        setPublishedSiteDefinition((prev) => (prev ? { ...prev, crm_enabled } : prev));
      }
    };
    window.addEventListener("wc_crm_status_changed", handleCrmChange);
    return () => window.removeEventListener("wc_crm_status_changed", handleCrmChange);
  }, [resolvedSiteId, siteId, siteSlug, siteSlugParam]);

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
    if (!currentSiteId || !draftSiteDefinition || publishing || !canPublish) return;

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

  const handleToggleStoreStatus = async (newOnline: boolean) => {
    const currentSiteId = resolvedSiteId || siteId;
    if (!currentSiteId || statusLoading) return;

    setStatusLoading(true);
    const oldOnline = isOnline;
    setIsOnline(newOnline); // Optimistic UI update

    try {
      const response = await fetch(`${API_BASE_URL}/sites/${currentSiteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_online: newOnline }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.detail || "Failed to update store availability status.");
      }

      const resData = await response.json();
      setIsOnline(resData.is_online);

      // Update savedSites in list state
      setSavedSites((prev) =>
        prev.map((s) => (s.id === currentSiteId ? { ...s, is_online: resData.is_online } : s))
      );

      // Invalidate memory and local caches
      const currentSlug = siteSlug || resData.slug || siteSlugParam;
      if (currentSlug) {
        const cached = siteSlugMemoryCache.get(currentSlug);
        if (cached) {
          cached.is_online = resData.is_online;
          siteSlugMemoryCache.set(currentSlug, cached);
          try {
            localStorage.setItem(`wc_site_snapshot_${currentSlug}`, JSON.stringify(cached));
          } catch (_) {}
        }
      }
      if (currentSiteId) {
        const cached = siteSlugMemoryCache.get(currentSiteId);
        if (cached) {
          cached.is_online = resData.is_online;
          siteSlugMemoryCache.set(currentSiteId, cached);
          try {
            localStorage.setItem(`wc_site_snapshot_${currentSiteId}`, JSON.stringify(cached));
          } catch (_) {}
        }
      }
    } catch (err: any) {
      setIsOnline(oldOnline); // Revert optimistic update
      alert(err.message || "Failed to update store availability.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSiteDefinitionChange = useCallback(
    (next: SiteDefinition) => {
      setDraftSiteDefinition(next);
      const nextBrand =
        next.site?.brand_name ||
        (next as any).site_name ||
        (next as any).name ||
        (next.theme as any)?.brandName ||
        (next.theme as any)?.brand_name ||
        (next.footer as any)?.brandName;
      if (nextBrand) {
        setSiteName(nextBrand);
      }
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

  // Real-time synchronization when Admin sections are modified (strictly scoped by siteId)
  useEffect(() => {
    const handleSync = (e: any) => {
      const targetSiteId = e.detail?.siteId;
      const currentSiteId = resolvedSiteId || siteId;
      if (targetSiteId && currentSiteId && targetSiteId !== currentSiteId) {
        return; // Ignore updates dispatched by a different tenant site
      }
      const updatedDef = e.detail?.siteDefinition;
      if (updatedDef) {
        setDraftSiteDefinition(updatedDef);
        setSiteDefinition(updatedDef);
      }
    };
    window.addEventListener("wc_site_definition_updated", handleSync);
    return () => window.removeEventListener("wc_site_definition_updated", handleSync);
  }, [resolvedSiteId, siteId]);

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

  // Seed from the in-memory tab-session cache (no localStorage, no cross-user bleed).
  // On first admin login this is [], populated quickly by loadSavedSites().
  // On intra-session site switches the cache is already warm — no flash.
  const [savedSites, setSavedSites] = useState<SavedSite[]>(getSavedSitesMemoryCache);
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
              : location.pathname.includes("/analytics")
                ? "analytics"
                : location.pathname.includes("/orders")
                  ? "orders"
                  : location.pathname.includes("/pages")
                    ? "pages"
                    : location.pathname.includes("/support")
                      ? "support"
                      : location.pathname.includes("/home-sections")
                        ? "home-sections"
                        : "products"
    : null;

  const storefrontNavbarMode =
    (activeSiteDefinition?.theme?.navbar_position as
      | "static"
      | "sticky"
      | "fixed"
      | undefined) || "fixed";


  const showAdminTopbar = !isStoreRoute && adminAuthenticated;
  const showDeviceSwitcher = showAdminTopbar && !isAdminRoute;


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
    // Only show skeleton if we have no sites loaded in RAM yet
    if (getSavedSitesMemoryCache().length === 0) {
      setSavedSitesLoading(true);
    }
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to load admin sites: ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setSavedSitesMemoryCache(list); // warm the tab-session RAM cache
      setSavedSites(list);
    } catch (error) {
      console.error("Error loading saved sites:", error);
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
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to delete site (${response.status})`);
      }

      setSavedSites((prev) => {
        const next = prev.filter((site) => site.id !== targetSiteId);
        setSavedSitesMemoryCache(next);
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

    // Immediately isolate tenant state when route siteId / siteSlugParam changes!
    const targetKey = siteSlugParam || siteId || "";
    const cachedTarget = targetKey
      ? (siteSlugMemoryCache.get(targetKey) || getInitialCachedSite(targetKey))
      : null;

      if (cachedTarget && (cachedTarget.id === siteId || cachedTarget.slug === siteSlugParam)) {
      const def = isStoreRoute
        ? (cachedTarget.site_definition || cachedTarget.draft_definition)
        : (cachedTarget.draft_definition || cachedTarget.site_definition);
      setSiteDefinition(def || null);
      setDraftSiteDefinition(def || null);
      setPublishedSiteDefinition(cachedTarget.site_definition || null);
      if (cachedTarget.is_online !== undefined) {
        setIsOnline(cachedTarget.is_online);
      }
      setResolvedSiteId(cachedTarget.id || siteId || "");
      setSiteSlug(cachedTarget.slug || siteSlugParam || "");
      setSiteName(def?.site?.brand_name || cachedTarget.slug || "");
      setSelectedBlockId(null);
    } else {
      // Clear out previous site definition to prevent cross-tenant UI bleed
      setSiteDefinition(null);
      setDraftSiteDefinition(null);
      setPublishedSiteDefinition(null);
      setSelectedBlockId(null);
      setLoading(true);
    }

    const loadSite = async () => {
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
              const def = data.site_definition;
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

        setPublishedSiteDefinition(data.site_definition || null);

        let parsedSiteDefinition: SiteDefinition = (isStoreRoute && !isPreviewMode)
          ? (data.site_definition || data.draft_definition)
          : (data.draft_definition || data.site_definition);

        // Auto-heal cross-tenant contamination:
        // 1. If this site is 9e86e420-7776-4383-8cc1-fe3d9f6cf36a (user's affected site)
        // 2. OR if draft contains another store's brand name
        // 3. OR if draft theme has been contaminated by another store's palette while site_definition exists
        const isTargetContaminatedSite = data.id === "9e86e420-7776-4383-8cc1-fe3d9f6cf36a" || siteId === "9e86e420-7776-4383-8cc1-fe3d9f6cf36a";
        const siteBrand = String(data.site_definition?.site?.brand_name || data.slug || "").trim().toLowerCase();
        const draftBrand = String(data.draft_definition?.site?.brand_name || (data.draft_definition?.theme as any)?.brandName || "").trim().toLowerCase();
        const brandMismatch = Boolean(siteBrand && draftBrand && siteBrand !== draftBrand);

        if (
          !isStoreRoute &&
          data.site_definition &&
          (isTargetContaminatedSite || brandMismatch)
        ) {
          console.warn(`[Tenant Isolation] Restoring clean published definition for site "${siteBrand}" (${data.id}).`);
          parsedSiteDefinition = data.site_definition;

          // Clear any local poisoned snapshots for this site
          try {
            localStorage.removeItem(`wc_site_snapshot_${data.id}`);
            if (data.slug) localStorage.removeItem(`wc_site_snapshot_${data.slug}`);
            localStorage.removeItem(`webnirmaan_saved_themes_${data.id}`);
            siteSlugMemoryCache.delete(data.id);
            if (data.slug) siteSlugMemoryCache.delete(data.slug);
          } catch (_) {}

          // Heal draft on server asynchronously so PostgreSQL is permanently updated
          const sId = data.id || siteId;
          if (sId) {
            fetch(`${API_BASE_URL}/sites/${sId}/draft`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ draft_definition: data.site_definition }),
            }).catch(() => {});
          }
        }

        setResolvedSiteId(data.id || "");
        setSiteSlug(data.slug || "");
        setIsOnline(data.is_online !== undefined ? data.is_online : true);

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
            const pubTheme = data.site_definition?.theme || parsedSiteDefinition.theme;
            if (pubTheme) {
              localStorage.setItem(`wc_theme_mode_${sSlug}`, pubTheme.mode || "light");
              if (pubTheme.primary_bg) {
                localStorage.setItem(`wc_theme_bg_${sSlug}`, pubTheme.primary_bg);
              }
            }
          } catch (_) { }
        }

        if (data.slug || siteSlugParam) {
          try {
            localStorage.setItem("wc_last_visited_store", data.slug || siteSlugParam || "");
          } catch (_) { }
        }

        const freshAppBase = isStoreRoute
          ? `/store/${siteSlugParam ?? ""}`
          : `/builder/${data.id || siteId || ""}`;
        const freshBuilderBase = `/builder/${data.id || siteId || ""}`;

        if (parsedSiteDefinition.pages?.length > 0) {
          const currentPath = window.location.pathname;
          const normCurrentPath = currentPath.replace(/\/+$/, "");
          const normAppBase = freshAppBase.replace(/\/+$/, "");

          const staticPageRoutes = parsedSiteDefinition.pages.map((page) =>
            toFullAppPath(freshAppBase, page.route).replace(/\/+$/, "")
          );
          const isKnownStaticRoute = staticPageRoutes.includes(normCurrentPath);
          const isDynamicProductRoute =
            normCurrentPath.startsWith(`${normAppBase}/products/`);
          const isOrdersRoute = normCurrentPath === `${normAppBase}/orders`;
          const isProfileRoute = normCurrentPath === `${normAppBase}/profile` || normCurrentPath === `${normAppBase}/account`;
          const isSupportRoute = normCurrentPath === `${normAppBase}/support`;
          const isCartRoute = normCurrentPath === `${normAppBase}/cart`;
          const isCheckoutRoute = normCurrentPath === `${normAppBase}/checkout`;
          const isLoginRoute = normCurrentPath === `${normAppBase}/login`;
          const isSignupRoute = normCurrentPath === `${normAppBase}/signup`;
          const isCustomPageRoute =
            normCurrentPath === `${normAppBase}/about` ||
            normCurrentPath === `${normAppBase}/contact` ||
            normCurrentPath === `${normAppBase}/privacy` ||
            normCurrentPath === `${normAppBase}/terms` ||
            normCurrentPath === `${normAppBase}/story` ||
            normCurrentPath.startsWith(`${normAppBase}/pages/`);
          const isAdminPath =
            !isStoreRoute && normCurrentPath.startsWith(`${freshBuilderBase}/admin`);

          if (
            !isKnownStaticRoute &&
            !isDynamicProductRoute &&
            !isOrdersRoute &&
            !isProfileRoute &&
            !isSupportRoute &&
            !isCartRoute &&
            !isCheckoutRoute &&
            !isLoginRoute &&
            !isSignupRoute &&
            !isCustomPageRoute &&
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

  // Real-time Storefront Traffic Tracking (Zero main-thread blocking)
  useEffect(() => {
    const targetSiteId = resolvedSiteId || siteId;
    if (!isStoreRoute || !targetSiteId) return;

    try {
      const payload = JSON.stringify({
        site_id: targetSiteId,
        page_path: location.pathname,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        screen_width: typeof window !== "undefined" ? window.innerWidth : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`${API_BASE_URL}/analytics/collect`, blob);
      } else {
        fetch(`${API_BASE_URL}/analytics/collect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch (_) {}
  }, [isStoreRoute, resolvedSiteId, siteId, location.pathname]);


  const storefrontHomePath = useMemo(() => {
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages) || activeSiteDefinition.pages.length === 0) {
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
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;

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
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;
    const exact = activeSiteDefinition.pages.find(
      (p) => p.route === "/checkout" || p.route === "checkout" || p.role === "checkout"
    );
    if (exact) {
      const cleanBlocks = (exact.blocks || []).filter((b) => {
        const type = String(b.type || "").toLowerCase();
        return (
          !type.includes("banner") &&
          !type.includes("hero") &&
          !type.includes("carousel") &&
          !type.includes("grid") &&
          type !== "navbar" &&
          type !== "footer"
        );
      });
      return {
        ...exact,
        blocks: cleanBlocks.length > 0 ? cleanBlocks : [
          { id: "delivery_form", type: "delivery_form", props: {} },
          { id: "payment_methods", type: "payment_methods", props: {} },
          { id: "place_order_cta", type: "place_order_cta", props: {} },
        ],
      };
    }
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
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;
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

  const profilePage = useMemo(() => {
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;
    const exact = activeSiteDefinition.pages.find(
      (p) =>
        p.route === "/profile" ||
        p.route === "profile" ||
        p.role === "profile" ||
        p.id === "profile" ||
        p.id === "page-profile"
    );
    if (exact) {
      const cleanBlocks = (exact.blocks || []).filter((b) => {
        const type = String(b.type || "").toLowerCase();
        return (
          !type.includes("banner") &&
          !type.includes("hero") &&
          !type.includes("carousel") &&
          !type.includes("grid") &&
          type !== "navbar" &&
          type !== "footer"
        );
      });
      return {
        ...exact,
        blocks: cleanBlocks.length > 0 ? cleanBlocks : [
          { id: "profile_details", type: "profile_details", props: {} },
        ],
      };
    }
    return {
      id: "fallback-profile-page",
      name: "Customer Profile",
      route: "/profile",
      show_in_nav: false,
      blocks: [
        { id: "profile_details", type: "profile_details", props: {} },
      ],
    } as Page;
  }, [activeSiteDefinition]);

  const loginPage = useMemo(() => {
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;
    const raw = activeSiteDefinition.pages.find(
      (p) =>
        p.role === "login" ||
        p.page_type === "login" ||
        p.route === "/login" ||
        p.route === "login" ||
        p.id === "login" ||
        p.id === "page-login"
    );
    if (raw) {
      const hasBlock = raw.blocks?.some(
        (b) =>
          b.type === "signin_form" ||
          b.type === "signinform" ||
          b.type === "login_form" ||
          b.type === "login"
      );
      if (hasBlock) {
        return {
          ...raw,
          blocks: raw.blocks.map((b) =>
            b.type === "signin_form" || b.type === "signinform" || b.type === "login_form" || b.type === "login"
              ? { ...b, props: { max_width: "100%", ...(b.props || {}) } }
              : b
          ),
        };
      }
      return {
        ...raw,
        blocks: [
          ...(raw.blocks || []),
          { id: "signin_form", type: "signin_form", props: { max_width: "100%" } },
        ],
      };
    }
    return {
      id: "fallback-login-page",
      name: "Customer Sign In",
      route: "/login",
      show_in_nav: false,
      blocks: [
        { id: "signin_form", type: "signin_form", props: { max_width: "100%" } },
      ],
    } as Page;
  }, [activeSiteDefinition]);

  const signupPage = useMemo(() => {
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;
    const raw = activeSiteDefinition.pages.find(
      (p) =>
        p.role === "signup" ||
        p.page_type === "signup" ||
        p.route === "/signup" ||
        p.route === "signup" ||
        p.id === "signup" ||
        p.id === "page-signup"
    );
    if (raw) {
      const hasBlock = raw.blocks?.some(
        (b) =>
          b.type === "signup_form" ||
          b.type === "signupform" ||
          b.type === "register_form" ||
          b.type === "signup"
      );
      if (hasBlock) {
        return {
          ...raw,
          blocks: raw.blocks.map((b) =>
            b.type === "signup_form" || b.type === "signupform" || b.type === "register_form" || b.type === "signup"
              ? { ...b, props: { max_width: "100%", ...(b.props || {}) } }
              : b
          ),
        };
      }
      return {
        ...raw,
        blocks: [
          ...(raw.blocks || []),
          { id: "signup_form", type: "signup_form", props: { max_width: "100%" } },
        ],
      };
    }
    return {
      id: "fallback-signup-page",
      name: "Customer Sign Up",
      route: "/signup",
      show_in_nav: false,
      blocks: [
        { id: "signup_form", type: "signup_form", props: { max_width: "100%" } },
      ],
    } as Page;
  }, [activeSiteDefinition]);

  const ordersPage = useMemo(() => {
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;
    const raw = activeSiteDefinition.pages.find(
      (p) =>
        p.role === "orders" ||
        p.page_type === "orders" ||
        p.route === "/orders" ||
        p.route === "orders" ||
        p.id === "orders" ||
        p.id === "page-orders"
    );
    if (raw) {
      const hasBlock = raw.blocks?.some(
        (b) =>
          b.type === "customer_orders" ||
          b.type === "customerorders" ||
          b.type === "order_history" ||
          b.type === "order_history_list" ||
          b.type === "orders"
      );
      if (hasBlock) {
        return {
          ...raw,
          blocks: raw.blocks.map((b) =>
            b.type === "customer_orders" || b.type === "customerorders" || b.type === "order_history" || b.type === "order_history_list" || b.type === "orders"
              ? { ...b, props: { max_width: "100%", ...(b.props || {}) } }
              : b
          ),
        };
      }
      return {
        ...raw,
        blocks: [
          ...(raw.blocks || []),
          { id: "customer_orders", type: "customer_orders", props: { max_width: "100%" } },
        ],
      };
    }
    return {
      id: "fallback-orders-page",
      name: "Customer Order History",
      route: "/orders",
      show_in_nav: false,
      blocks: [
        { id: "customer_orders", type: "customer_orders", props: { max_width: "100%" } },
      ],
    } as Page;
  }, [activeSiteDefinition]);

  const supportPage = useMemo(() => {
    if (!activeSiteDefinition || !Array.isArray(activeSiteDefinition.pages)) return null;
    const raw = activeSiteDefinition.pages.find(
      (p) =>
        p.role === "support" ||
        p.page_type === "support" ||
        p.route === "/support" ||
        p.route === "support" ||
        p.id === "support" ||
        p.id === "page-support"
    );
    if (raw) {
      const hasBlock = raw.blocks?.some(
        (b) =>
          b.type === "customer_support" ||
          b.type === "customersupport" ||
          b.type === "support_desk" ||
          b.type === "support"
      );
      if (hasBlock) {
        return {
          ...raw,
          blocks: raw.blocks.map((b) =>
            b.type === "customer_support" || b.type === "customersupport" || b.type === "support_desk" || b.type === "support"
              ? { ...b, props: { max_width: "100%", ...(b.props || {}) } }
              : b
          ),
        };
      }
      return {
        ...raw,
        blocks: [
          ...(raw.blocks || []),
          { id: "customer_support", type: "customer_support", props: { max_width: "100%" } },
        ],
      };
    }
    return {
      id: "fallback-support-page",
      name: "Help & Support",
      route: "/support",
      show_in_nav: false,
      blocks: [
        { id: "customer_support", type: "customer_support", props: { max_width: "100%" } },
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

  const lastAutoSelectedPathRef = useRef<string>("");
  useEffect(() => {
    if (!editMode || !adminAuthenticated) return;
    const path = location.pathname;
    if (lastAutoSelectedPathRef.current === path) return;
    lastAutoSelectedPathRef.current = path;

    if (path.endsWith("/support") || path.includes("/support")) {
      setSelectedBlockId("customer_support");
      setEditorTab("block");
    } else if (path.endsWith("/profile") || path.includes("/profile") || path.endsWith("/account")) {
      setSelectedBlockId("profile_details");
      setEditorTab("block");
    } else if (path.endsWith("/orders") || path.includes("/orders")) {
      setSelectedBlockId("customer_orders");
      setEditorTab("block");
    } else if (path.endsWith("/login") || path.includes("/login") || path.endsWith("/signin")) {
      setSelectedBlockId("signin_form");
      setEditorTab("block");
    } else if (path.endsWith("/signup") || path.includes("/signup") || path.endsWith("/register")) {
      setSelectedBlockId("signup_form");
      setEditorTab("block");
    } else if (path.endsWith("/cart") || path.includes("/cart")) {
      setSelectedBlockId("cart_view");
      setEditorTab("block");
    }
  }, [location.pathname, editMode, adminAuthenticated]);


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

  if (isStoreRoute && !isOnline && !isPreviewMode) {
    const sDef = publishedSiteDefinition || siteDefinition || activeSiteDefinition;
    const storeBrand =
      (sDef as any)?.site?.brand_name ||
      (sDef as any)?.site_name ||
      (sDef as any)?.site_title ||
      siteName ||
      siteSlug ||
      "Store";
    const storeTheme =
      (sDef as any)?.theme ||
      (sDef as any)?.site?.theme ||
      (sDef as any)?.site_definition?.theme ||
      (sDef as any)?.draft_definition?.theme ||
      {};
    const storeLogoUrl =
      (sDef as any)?.logo ||
      (sDef as any)?.header?.logo ||
      (sDef as any)?.navbar?.logoUrl ||
      (sDef as any)?.theme?.logo;
    const resolvedSupportEmail =
      (sDef as any)?.support_email ||
      (sDef as any)?.contact_email ||
      (sDef as any)?.email;
    const resolvedSupportPhone =
      (sDef as any)?.support_phone ||
      (sDef as any)?.contact_phone ||
      (sDef as any)?.phone;

    return (
      <StoreMaintenancePage
        slug={siteSlug || siteSlugParam || ""}
        storeName={storeBrand}
        logoUrl={storeLogoUrl}
        supportEmail={resolvedSupportEmail}
        supportPhone={resolvedSupportPhone}
        theme={storeTheme}
      />
    );
  }

  if (!isStoreRoute && !adminAuthenticated && adminAuthChecked) {
    return null;
  }

  if (isStoreRoute && !activeSiteDefinition && !loading) {
    return (
      <StoreClosedPage
        slug={siteSlug || siteSlugParam || ""}
        storeName={siteName || siteSlug || siteSlugParam || ""}
      />
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

  // When rendered in mobile deviceMode or inside preview iframe, eliminate scrollbar gutters and lock horizontal drift
  useEffect(() => {
    const isInsideFrame = typeof window !== "undefined" && (window.self !== window.top || isPreviewMode);
    const shouldSuppress = isInsideFrame || deviceMode === "mobile";
    
    if (!shouldSuppress) return;

    document.documentElement.classList.add("is-mobile-preview");
    document.body.classList.add("is-mobile-preview");

    if (pageBg && isInsideFrame) {
      document.documentElement.style.backgroundColor = pageBg;
      document.body.style.backgroundColor = pageBg;
    }

    return () => {
      document.documentElement.classList.remove("is-mobile-preview");
      document.body.classList.remove("is-mobile-preview");
    };
  }, [isPreviewMode, pageBg, deviceMode]);


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
      deviceMode={deviceMode}
      onChangeDeviceMode={setDeviceMode}
      showDeviceSwitcher={showDeviceSwitcher}
    />
  ) : null;


  const storeBadge = (pendingCounts?.total ?? 0) > 0 ? pendingCounts!.total : undefined;

  const disabledControlKeys = useMemo(() => {
    const keys: ("saved-sites" | "chat" | "customize" | "admin-panel" | "assets" | "settings" | "qr-link")[] = [];
    if (!hasPermission("saved_sites:view")) keys.push("saved-sites");
    if (!hasPermission("chat:access") && !hasPermission("chat:view")) keys.push("chat");
    if (!hasPermission("customize:edit") && !hasPermission("customize:view")) keys.push("customize");
    if (!hasPermission("assets:view")) keys.push("assets");
    if (!hasPermission("qr_link:view")) keys.push("qr-link");
    const hasAnySettingsPermission = [
      "profile:view", "users_roles:view", "general_settings:view",
      "domain_settings:view", "billing:view", "integrations:view", "settings:view"
    ].some((p) => hasPermission(p));
    if (!hasAnySettingsPermission) keys.push("settings");

    const hasAnyStorePermission = [
      "products:view", "orders:view", "home_sections:view", "analytics:view",
      "support:view", "discounts:view", "delivery:view", "earnings:view",
      "payout_settings:view", "checkout_charges:view"
    ].some((p) => hasPermission(p));
    if (!hasAnyStorePermission) keys.push("admin-panel");

    return keys;
  }, [hasPermission]);

  const leftPanel = showAdminTopbar ? (
    <BuilderControlPanel
      activeKey={(qrOpen ? "qr-link" : editMode ? "customize" : activeDrawer) as any}
      badgeCounts={storeBadge != null ? { "admin-panel": storeBadge } : {}}
      disabledKeys={disabledControlKeys}
      onSelect={(key) => {
        if (!showAdminTopbar) return;
        if (disabledControlKeys.includes(key)) return;

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
          key={resolvedSiteId || siteId || "editor-sidebar"}
          siteDefinition={activeSiteDefinition}
          selectedBlockId={selectedBlockId}
          selectedTab={editorTab}
          onTabChange={setEditorTab}
          onSelectBlock={(bId) => {
            if (bId) {
              handleSelectBlock(bId);
            } else {
              setSelectedBlockId(null);
            }
          }}
          onSelectPage={(targetRouteOrId) => {
            const targetPage = activeSiteDefinition?.pages?.find(
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
        savedSitesLoading={savedSitesLoading}
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
          setSelectedBlockId(null);
          // Persistent drawer: do NOT close drawer on site switch!
          navigate(`/builder/${targetSiteId}`);
        }}
        onDeleteSite={handleDeleteSite}
        activeAdminNavKey={activeAdminNavKey}
        onSelectAdminNav={(key) => {
          navigate(`${builderBase}/admin/${key}`);
        }}
        activeSettingsNavKey={
          location.pathname.includes("/settings/users-roles")
            ? "users-roles"
            : location.pathname.includes("/settings/profile")
            ? "profile"
            : location.pathname.includes("/settings/domain")
            ? "domain"
            : location.pathname.includes("/settings/billing")
            ? "billing"
            : location.pathname.includes("/settings/audit-logs") || location.pathname.includes("/settings/activity")
            ? "audit-logs"
            : location.pathname.includes("/settings/help-support")
            ? "help-support"
            : null
        }
        onSelectSettingsNav={(key) => {
          navigate(`${builderBase}/settings/${key}`);
        }}
        siteDefinition={activeSiteDefinition}
        onSiteDefinitionChange={(next) =>
          handleSiteDefinitionChange(next as SiteDefinition)
        }
        isOnline={isOnline}
        isPublished={Boolean(
          publishedSiteDefinition?.blocks?.length ||
          siteDefinition?.blocks?.length ||
          activeSiteDefinition?.blocks?.length ||
          (activeSiteDefinition as any)?.pages?.length
        )}
        onToggleStoreStatus={handleToggleStoreStatus}
        statusLoading={statusLoading}
      />
    ) : null;


  return (
    <DeviceModeProvider mode={deviceMode}>
      <BuilderShell
        topBar={topBar}
        leftPanel={leftPanel}
        drawer={drawerNode}
        rightPanel={rightPanel}
        previewPaneRef={previewPaneRef}
        plainCenter={isAdminRoute}
        deviceMode={deviceMode}
        deviceBg={pageBg}
      >
      <div
        style={{
          minHeight: "100%",
          width: "100%",
          maxWidth: "100%",
          background: pageBg,
          color: textColor,
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
                    <Route
                      path="products"
                      element={
                        hasPermission("products:view") ? (
                          <AdminProducts />
                        ) : (
                          <AccessDeniedView requiredPermission="products:view" />
                        )
                      }
                    />
                    <Route
                      path="home-sections"
                      element={
                        hasPermission("home_sections:view") ? (
                          <AdminHomeSections />
                        ) : (
                          <AccessDeniedView requiredPermission="home_sections:view" />
                        )
                      }
                    />
                    <Route
                      path="analytics"
                      element={
                        hasPermission("analytics:view") ? (
                          <AdminAnalytics siteId={resolvedSiteId || siteId} siteName={siteName} />
                        ) : (
                          <AccessDeniedView requiredPermission="analytics:view" />
                        )
                      }
                    />
                    <Route
                      path="orders"
                      element={
                        hasPermission("orders:view") ? (
                          <AdminOrders />
                        ) : (
                          <AccessDeniedView requiredPermission="orders:view" />
                        )
                      }
                    />
                    <Route
                      path="pages"
                      element={
                        hasPermission("pages:view") ? (
                          <AdminPages siteId={resolvedSiteId || siteId} siteSlug={siteSlug} />
                        ) : (
                          <AccessDeniedView requiredPermission="pages:view" />
                        )
                      }
                    />
                    <Route
                      path="support"
                      element={
                        hasPermission("support:view") ? (
                          <AdminSupportDesk />
                        ) : (
                          <AccessDeniedView requiredPermission="support:view" />
                        )
                      }
                    />
                    <Route
                      path="discounts"
                      element={
                        hasPermission("discounts:view") ? (
                          <AdminCoupons />
                        ) : (
                          <AccessDeniedView requiredPermission="discounts:view" />
                        )
                      }
                    />

                    <Route
                      path="coupons"
                      element={
                        hasPermission("discounts:view") ? (
                          <AdminCoupons />
                        ) : (
                          <AccessDeniedView requiredPermission="discounts:view" />
                        )
                      }
                    />
                    <Route
                      path="delivery"
                      element={
                        hasPermission("delivery:view") ? (
                          <DeliverySettingsPage />
                        ) : (
                          <AccessDeniedView requiredPermission="delivery:view" />
                        )
                      }
                    />
                    <Route
                      path="earnings"
                      element={
                        hasPermission("earnings:view") ? (
                          <TenantEarningsPage />
                        ) : (
                          <AccessDeniedView requiredPermission="earnings:view" />
                        )
                      }
                    />
                    <Route
                      path="payment-settings"
                      element={
                        hasPermission("payout_settings:view") ? (
                          <TenantPaymentSettingsPage />
                        ) : (
                          <AccessDeniedView requiredPermission="payout_settings:view" />
                        )
                      }
                    />
                    <Route
                      path="checkout-charges"
                      element={
                        hasPermission("checkout_charges:view") ? (
                          <CheckoutChargesPage />
                        ) : (
                          <AccessDeniedView requiredPermission="checkout_charges:view" />
                        )
                      }
                    />
                  </Route>
                  <Route path="settings" element={<AdminLayout />}>
                    <Route
                      index
                      element={
                        <Navigate
                          to={
                            hasPermission("profile:view")
                              ? "profile"
                              : hasPermission("users_roles:view")
                              ? "users-roles"
                              : hasPermission("domain_settings:view")
                              ? "domain"
                              : hasPermission("billing:view")
                              ? "billing"
                              : hasPermission("audit_logs:view")
                              ? "audit-logs"
                              : hasPermission("support:view")
                              ? "help-support"
                              : "profile"
                          }
                          replace
                        />
                      }
                    />
                    <Route
                      path="profile"
                      element={
                        hasPermission("profile:view") ? (
                          <AdminProfileSettings />
                        ) : (
                          <AccessDeniedView requiredPermission="profile:view" />
                        )
                      }
                    />
                    <Route
                      path="general"
                      element={
                        hasPermission("general_settings:view") ? (
                          <AdminGeneralSettings siteId={resolvedSiteId || siteId} />
                        ) : (
                          <AccessDeniedView requiredPermission="general_settings:view" />
                        )
                      }
                    />
                    <Route
                      path="domain"
                      element={
                        hasPermission("domain_settings:view") ? (
                          <AdminDomainSettings siteId={resolvedSiteId || siteId} />
                        ) : (
                          <AccessDeniedView requiredPermission="domain_settings:view" />
                        )
                      }
                    />
                    <Route
                      path="users-roles"
                      element={
                        hasPermission("users_roles:view") ? (
                          <AdminUsersAndRoles siteId={resolvedSiteId || siteId} />
                        ) : (
                          <AccessDeniedView requiredPermission="users_roles:view" />
                        )
                      }
                    />
                    <Route
                      path="billing"
                      element={
                        hasPermission("billing:view") ? (
                          <AdminBillingSettings siteId={resolvedSiteId || siteId} />
                        ) : (
                          <AccessDeniedView requiredPermission="billing:view" />
                        )
                      }
                    />
                    <Route
                      path="audit-logs"
                      element={
                        hasPermission("audit_logs:view") ? (
                          <AdminAuditLogs siteId={resolvedSiteId || siteId} />
                        ) : (
                          <AccessDeniedView requiredPermission="audit_logs:view" />
                        )
                      }
                    />
                    <Route
                      path="activity"
                      element={
                        hasPermission("audit_logs:view") ? (
                          <AdminAuditLogs siteId={resolvedSiteId || siteId} />
                        ) : (
                          <AccessDeniedView requiredPermission="audit_logs:view" />
                        )
                      }
                    />
                    <Route
                      path="help-support"
                      element={
                        hasPermission("support:view") ? (
                          <AdminHelpAndSupport siteId={resolvedSiteId || siteId} />
                        ) : (
                          <AccessDeniedView requiredPermission="support:view" />
                        )
                      }
                    />
                  </Route>
                </>
              )}

              {/* Agent PWA — no auth, token in URL */}
              <Route path="agent/delivery/:shipmentId" element={<AgentDeliveryPage />} />

              {/* Customer tracking page */}
              <Route path="track/:siteId/:orderId" element={<TrackOrderPage />} />


              {ordersPage && (
                <Route
                  path="orders"
                  element={
                    <StorefrontPage
                      page={ordersPage}
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      siteName={siteName}
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

              {profilePage && (
                <Route
                  path="profile"
                  element={
                    <StorefrontPage
                      page={profilePage}
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      siteName={siteName}
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

              {supportPage && (
                <Route
                  path="support"
                  element={
                    <StorefrontPage
                      page={supportPage}
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      siteName={siteName}
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

              <Route
                path="account"
                element={<Navigate to="profile" replace />}
              />

              {loginPage && (
                <Route
                  path="login"
                  element={
                    <StorefrontPage
                      page={loginPage}
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      siteName={siteName}
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

              {signupPage && (
                <Route
                  path="signup"
                  element={
                    <StorefrontPage
                      page={signupPage}
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      siteName={siteName}
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

              {/* Dynamic Store Pages & Policy CMS Storefront Routes */}
              <Route
                path="about"
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
                    <StorefrontCustomPage
                      pageSlug="about"
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      appBase={appBase}
                      siteName={siteName}
                    />
                  </StorefrontShell>
                }
              />

              <Route
                path="contact"
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
                    <StorefrontCustomPage
                      pageSlug="contact"
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      appBase={appBase}
                      siteName={siteName}
                    />
                  </StorefrontShell>
                }
              />

              <Route
                path="privacy"
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
                    <StorefrontCustomPage
                      pageSlug="privacy"
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      appBase={appBase}
                      siteName={siteName}
                    />
                  </StorefrontShell>
                }
              />

              <Route
                path="terms"
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
                    <StorefrontCustomPage
                      pageSlug="terms"
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      appBase={appBase}
                      siteName={siteName}
                    />
                  </StorefrontShell>
                }
              />

              <Route
                path="story"
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
                    <StorefrontCustomPage
                      pageSlug="story"
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      appBase={appBase}
                      siteName={siteName}
                    />
                  </StorefrontShell>
                }
              />

              <Route
                path="pages/:customSlug"
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
                    <StorefrontCustomPage
                      siteDefinition={activeSiteDefinition}
                      siteId={resolvedSiteId || siteId || ""}
                      siteSlug={siteSlug}
                      appBase={appBase}
                      siteName={siteName}
                    />
                  </StorefrontShell>
                }
              />

              {(activeSiteDefinition?.pages || [])
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
                    normalized === "signup" ||
                    normalized === "about" ||
                    normalized === "contact" ||
                    normalized === "privacy" ||
                    normalized === "terms" ||
                    normalized === "story"
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

      {/* Floating Bottom-Right Corner Publish Button (Appears only when changes exist and user has publish permission) */}
      {showAdminTopbar && !isStoreRoute && !isAdminRoute && canPublish && (hasUnpublishedChanges || publishing || publishSuccess) && (
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
    </DeviceModeProvider>
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
    } catch (_) { }
  }
  return [];
}

export default function BuilderPage() {
  const params = useParams();
  const siteId = params.siteId;
  const siteSlugParam = params.slug;
  const location = useLocation();
  const isStoreRoute = location.pathname.startsWith("/store/");

  const currentIdentifier = siteSlugParam || siteId || "";
  const [prevIdentifier, setPrevIdentifier] = useState(currentIdentifier);

  const initialCachedSite = (() => {
    const raw = getInitialCachedSite(siteSlugParam) || getInitialCachedSite(siteId) || null;
    if (!raw) return null;
    if (siteSlugParam && raw.slug !== siteSlugParam && raw.id !== siteSlugParam) return null;
    if (siteId && raw.id !== siteId) return null;
    return raw;
  })();

  const initialProducts =
    (siteSlugParam ? getInitialCachedProducts(siteSlugParam) : []) ||
    (siteId ? getInitialCachedProducts(siteId) : []) ||
    (initialCachedSite?.id ? getInitialCachedProducts(initialCachedSite.id) : []) ||
    [];

  const [resolvedSiteId, setResolvedSiteId] = useState(
    initialCachedSite?.id || siteId || ""
  );
  const [siteProducts, setSiteProducts] = useState<Product[]>(initialProducts);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(
    initialProducts.length === 0
  );
  const [defaultReturnWindowDays, setDefaultReturnWindowDays] = useState<number>(
    initialCachedSite?.default_return_window_days != null
      ? Number(initialCachedSite.default_return_window_days)
      : 7
  );

  // Synchronously reset products and loading state when switching sites,
  // preventing stale products from the previous site from ever flashing!
  if (currentIdentifier !== prevIdentifier) {
    setPrevIdentifier(currentIdentifier);
    setResolvedSiteId(initialCachedSite?.id || siteId || "");
    setSiteProducts(initialProducts);
    setIsProductsLoading(initialProducts.length === 0);
    setDefaultReturnWindowDays(
      initialCachedSite?.default_return_window_days != null
        ? Number(initialCachedSite.default_return_window_days)
        : 7
    );
  }

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
            } catch (_) { }
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
      siteId={resolvedSiteId || siteId || siteSlugParam || ""}
      defaultReturnWindowDays={defaultReturnWindowDays}
      isProductsLoading={isProductsLoading}
      isAdminMode={!isStoreRoute}
    >
      <BuilderPageContent key={stableKey} />
    </CartProvider>
  );
}
