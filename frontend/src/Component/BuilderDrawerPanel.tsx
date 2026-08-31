import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";
import { AdminCopilotChat } from "./AdminCopilotChat";
import AdminProfileSettings from "./AdminProfileSettings";
import {
  COMPONENT_ASSETS,
  ComponentAsset,
  ComponentAssetCategory,
} from "../customizations/assetsRegistry";
import { updateThemeValues } from "../customizations/editorUtils";

type ControlItemKey =
  | "saved-sites"
  | "chat"
  | "customize"
  | "admin-panel"
  | "assets"
  | "settings"
  | "qr-link";

type SavedSite = {
  id: string;
  slug: string;
  site_definition?: any;
  draft_definition?: any;
};

export type AdminNavKey =
  | "products"
  | "home-sections"
  | "orders"
  | "discounts"
  | "delivery"
  | "earnings"
  | "payment-settings"
  | "checkout-charges";

type AdminNavItem = {
  key: AdminNavKey;
  label: string;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: "products", label: "Products" },
  { key: "home-sections", label: "Home Sections" },
  { key: "orders", label: "Orders & Returns" },
  { key: "discounts", label: "Discounts & Promo" },
  { key: "delivery", label: "Delivery & Shipping" },
  { key: "checkout-charges", label: "Checkout Charges" },
  { key: "earnings", label: "Earnings & Ledger" },
  { key: "payment-settings", label: "Payout Settings" },
];

export type SettingsNavKey = "profile";

export type SettingsNavItem = {
  key: SettingsNavKey;
  label: string;
};

const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    key: "profile",
    label: "Profile",
  },
];

type BuilderDrawerPanelProps = {
  activeDrawer: ControlItemKey | null;
  onClose: () => void;
  savedSites?: SavedSite[];
  savedSitesLoading?: boolean;
  selectedSiteId?: string | null;
  onSelectSite?: (siteId: string) => void;
  onDeleteSite?: (siteId: string) => void;
  activeAdminNavKey?: AdminNavKey | null;
  onSelectAdminNav?: (key: AdminNavKey) => void;
  activeSettingsNavKey?: SettingsNavKey | null;
  onSelectSettingsNav?: (key: SettingsNavKey) => void;
  siteDefinition?: any;
  onSiteDefinitionChange?: (next: any) => void;
};

function titleForDrawer(key: ControlItemKey | null) {
  switch (key) {
    case "saved-sites":
      return "SAVED SITES";
    case "chat":
      return "WEBCREON CO-PILOT";
    case "admin-panel":
      return "STORE CONTROL";
    case "assets":
      return "COMPONENT ASSETS";
    case "settings":
      return "SETTINGS";
    default:
      return "";
  }
}

function getBrandName(site: SavedSite) {
  return (
    site.draft_definition?.site?.brand_name ||
    site.site_definition?.site?.brand_name ||
    site.slug ||
    "Website"
  );
}

function getSiteDescription(site: SavedSite): string {
  const def = site.draft_definition || site.site_definition;
  const brandName = getBrandName(site);
  if (!def) {
    return `Online store for ${brandName} with curated collections and secure checkout.`;
  }

  const siteObj = def.site || {};
  const domain = (siteObj.domain || siteObj.catalog_type || "").trim();

  // 1. Direct user-defined site description / tagline
  if (siteObj.description && typeof siteObj.description === "string" && siteObj.description.trim()) {
    return siteObj.description.trim();
  }
  if (siteObj.tagline && typeof siteObj.tagline === "string" && siteObj.tagline.trim()) {
    return siteObj.tagline.trim();
  }
  if (def.meta?.description && typeof def.meta.description === "string" && def.meta.description.trim()) {
    return def.meta.description.trim();
  }

  // 2. Check blocks for genuine custom copy (filter out agent prompt instructions like 'Introduce the...')
  const pages = def.pages;
  let homePrompt = "";
  if (Array.isArray(pages)) {
    for (const p of pages) {
      if (p?.role === "home" || p?.page_type === "landing" || p?.name === "Home" || p?.id === "home") {
        homePrompt = p?.generation_prompt || "";
        if (Array.isArray(p.blocks)) {
          for (const b of p.blocks) {
            const props = b?.props || {};
            for (const key of ["subheadline", "subtitle", "description", "subtext"]) {
              const val = props[key];
              if (typeof val === "string" && val.trim()) {
                const cleanVal = val.trim();
                // If not an AI instruction starting with 'Introduce', 'Create', 'Generate', etc.
                if (!/^(introduce|create|generate|design|showcase)\b/i.test(cleanVal)) {
                  return cleanVal;
                }
              }
            }
          }
        }
      }
    }
  }

  // 3. Domain & niche awareness for clean natural human-grade copy
  const combinedContext = `${domain} ${homePrompt} ${brandName} ${def.prompt || ""}`.toLowerCase();

  if (combinedContext.includes("skincare") || combinedContext.includes("beauty") || combinedContext.includes("korean")) {
    return "Premium Korean skincare & beauty essentials with natural nourishing formulations.";
  }
  if (combinedContext.includes("book") || combinedContext.includes("novel") || combinedContext.includes("read")) {
    return "Curated bookstore featuring bestselling fiction, literature, and reader favorites.";
  }
  if (combinedContext.includes("toy") || combinedContext.includes("kid") || combinedContext.includes("game")) {
    return "Playful toy collections, vehicles, racing cars, and interactive games for kids.";
  }
  if (combinedContext.includes("cloth") || combinedContext.includes("apparel") || combinedContext.includes("fashion") || combinedContext.includes("shirt")) {
    return "Modern clothing & fashion apparel featuring stylish collections and everyday wear.";
  }
  if (combinedContext.includes("grocer") || combinedContext.includes("market") || combinedContext.includes("fruit") || combinedContext.includes("vegetable")) {
    return "Fresh groceries, farm produce, daily essentials, and household staples.";
  }
  if (combinedContext.includes("baker") || combinedContext.includes("cake") || combinedContext.includes("pastry")) {
    return "Artisan baked treats, freshly crafted cakes, and delightful confectionery.";
  }
  if (combinedContext.includes("pharmacy") || combinedContext.includes("health") || combinedContext.includes("med")) {
    return "Healthcare essentials, wellness products, and everyday pharmacy supplies.";
  }
  if (combinedContext.includes("underwear") || combinedContext.includes("innerwear")) {
    return "Comfortable and elegant innerwear essentials crafted with premium soft fabrics.";
  }
  if (combinedContext.includes("jewel") || combinedContext.includes("gem") || combinedContext.includes("gold")) {
    return "Exquisite handcrafted jewelry, fine accessories, and timeless luxury pieces.";
  }
  if (combinedContext.includes("electronic") || combinedContext.includes("gadget") || combinedContext.includes("audio")) {
    return "Cutting-edge electronics, smart devices, and high-performance audio essentials.";
  }

  if (domain && domain.toLowerCase() !== "general" && domain.toLowerCase() !== "ecommerce") {
    return `Curated ${domain} storefront with special collections, offers, and fast delivery.`;
  }

  return `Online storefront for ${brandName} with curated catalog and easy checkout.`;
}

function LinkIcon({ isSelected }: { isSelected?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={isSelected ? "#2563eb" : "#64748b"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 16, height: 16, flexShrink: 0, marginTop: "2px" }}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SavedSiteCard({
  site,
  isSelected,
  onClick,
  onDelete,
}: {
  site: SavedSite;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const brandName = getBrandName(site);
  const description = getSiteDescription(site);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: "10px",
        padding: "10px 12px",
        background: isSelected ? "#eff6ff" : isHovered ? "#f8fafc" : "transparent",
        border: isSelected ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        transition: "all 0.12s ease",
        position: "relative",
      }}
    >
      <LinkIcon isSelected={isSelected} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: 1.3,
            color: isSelected ? "#1d4ed8" : "#0f172a",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {brandName}
        </div>
        <div
          style={{
            fontSize: "11.5px",
            lineHeight: "1.45",
            color: "#64748b",
            marginTop: "3px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            wordBreak: "break-word",
          }}
        >
          {description}
        </div>
      </div>

      {isSelected && onDelete && (
        <button
          type="button"
          aria-label="Delete site"
          title={`Delete ${brandName}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "#ef4444",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: 0.85,
            transition: "opacity 0.15s ease",
            alignSelf: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
        >
          <DeleteIcon />
        </button>
      )}
    </div>
  );
}

function AdminNavIcon({ navKey, isSelected }: { navKey: AdminNavKey; isSelected: boolean }) {
  const stroke = isSelected ? "#2563eb" : "#64748b";
  const style = { width: 16, height: 16, flexShrink: 0 };

  switch (navKey) {
    case "products":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "home-sections":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      );
    case "orders":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );
    case "discounts":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "delivery":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "earnings":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "payment-settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11" />
        </svg>
      );
    case "checkout-charges":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <line x1="19" y1="5" x2="5" y2="19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

function AdminNavCard({
  item,
  isSelected,
  onClick,
}: {
  item: AdminNavItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: "10px",
        padding: "10px 12px",
        background: isSelected ? "#eff6ff" : isHovered ? "#f8fafc" : "transparent",
        border: isSelected ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        transition: "all 0.12s ease",
      }}
    >
      <AdminNavIcon navKey={item.key} isSelected={isSelected} />
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: isSelected ? "#1d4ed8" : "#0f172a",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.label}
      </span>
    </div>
  );
}

function SettingsNavCard({
  item,
  isSelected,
  onClick,
}: {
  item: SettingsNavItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: "10px",
        padding: "10px 12px",
        background: isSelected ? "#eff6ff" : isHovered ? "#f8fafc" : "transparent",
        border: isSelected ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        transition: "all 0.12s ease",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={isSelected ? "#2563eb" : "#64748b"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 18, height: 18, flexShrink: 0 }}
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: isSelected ? "#1d4ed8" : "#0f172a",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.label}
      </span>
    </div>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 16, height: 16 }}
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function PlainCard({
  label,
  isSelected,
  onClick,
  trailing,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        border: isSelected
          ? "1px solid rgba(37,99,235,0.35)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: "10px",
        padding: "12px 12px",
        background: isSelected ? "#eef2f7" : "#ffffff",
        cursor: "pointer",
        color: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: "#0f172a",
          minWidth: 0,
          flex: 1,
        }}
      >
        {label}
      </div>
      {trailing}
    </div>
  );
}

function renderAssetPreview(assetId: string) {
  switch (assetId) {
    // 1. NAVBAR PREVIEWS
    case "navbar-apple-minimal":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "#ffffff", borderRadius: "999px", padding: "6px 10px", boxShadow: "0 3px 10px rgba(0,0,0,0.05)", border: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", flexShrink: 0 }}>
              <rect width="24" height="24" rx="5" fill="#2563eb" />
              <path d="M6 8L9.5 16L12 10.5L14.5 16L18 8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>WebCreon</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "999px", background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 0 8px" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8", whiteSpace: "nowrap" }}>Search store...</span>
            <div style={{ width: "12px", height: "12px", borderRadius: "999px", background: "#e2e8f0", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#475569", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "8px", height: "8px", borderRadius: "999px", background: "#2563eb", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" /><circle cx="12" cy="8" r="4" /></svg>
            </div>
          </div>
        </div>
      );
    case "navbar-glassmorphism":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(240,244,248,0.75))", borderRadius: "10px", padding: "6px 10px", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 12px rgba(31,38,135,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", flexShrink: 0 }}>
              <rect width="24" height="24" rx="5" fill="#3b82f6" />
              <path d="M6 8L9.5 16L12 10.5L14.5 16L18 8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>WebCreon</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 0 8px" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8", whiteSpace: "nowrap" }}>Search store...</span>
            <div style={{ width: "12px", height: "12px", borderRadius: "999px", background: "rgba(255,255,255,0.8)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#475569", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "8px", height: "8px", borderRadius: "999px", background: "#2563eb", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" /><circle cx="12" cy="8" r="4" /></svg>
            </div>
          </div>
        </div>
      );
    case "navbar-modern-marketplace":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "#ffffff", borderRadius: "6px", padding: "6px 8px", border: "1px solid rgba(15,23,42,0.12)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", flexShrink: 0 }}>
              <rect width="24" height="24" rx="4" fill="#0f172a" />
              <path d="M6 8L9.5 16L12 10.5L14.5 16L18 8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>WebCreon</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "4px", border: "1px solid rgba(15,23,42,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", overflow: "hidden", background: "#ffffff" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8", paddingLeft: "4px", whiteSpace: "nowrap" }}>Search catalog...</span>
            <div style={{ width: "18px", height: "100%", background: "#0f172a", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "8px", height: "8px", stroke: "#ffffff", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: "1px solid rgba(15,23,42,0.12)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "7px", height: "7px", borderRadius: "999px", background: "#2563eb", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: "1px solid rgba(15,23,42,0.12)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" /><circle cx="12" cy="8" r="4" /></svg>
            </div>
          </div>
        </div>
      );
    case "navbar-luxury-fashion":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "#ffffff", borderRadius: "999px", padding: "6px 10px", border: "1px solid rgba(15,23,42,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
            <span style={{ fontFamily: "serif", fontSize: "11px", fontWeight: 900, letterSpacing: "0.05em", color: "#0f172a" }}>W</span>
            <span style={{ width: "1px", height: "9px", background: "rgba(15,23,42,0.2)" }} />
            <span style={{ fontFamily: "serif", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: "#0f172a", whiteSpace: "nowrap" }}>WEBCREON</span>
          </div>
          <div style={{ flex: 1, maxWidth: "100px", height: "16px", borderRadius: "999px", border: "1px solid rgba(15,23,42,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px" }}>
            <span style={{ fontSize: "7.5px", color: "#94a3b8", fontFamily: "serif", whiteSpace: "nowrap" }}>Search boutique...</span>
            <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#0f172a", strokeWidth: 2, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
          </div>
          <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "10px", height: "10px", stroke: "#0f172a", strokeWidth: 1.8, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-3px", width: "6px", height: "6px", borderRadius: "999px", background: "#000", color: "#fff", fontSize: "4px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <svg viewBox="0 0 24 24" style={{ width: "10px", height: "10px", stroke: "#0f172a", strokeWidth: 1.8, fill: "none" }}><path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" /><circle cx="12" cy="8" r="4" /></svg>
          </div>
        </div>
      );
    case "navbar-neo-modern":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "#f0f4f9", borderRadius: "999px", padding: "6px 10px", boxShadow: "3px 3px 6px rgba(166,180,200,0.4), -3px -3px 6px rgba(255,255,255,0.9)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "5px", background: "#f0f4f9", boxShadow: "2px 2px 4px rgba(166,180,200,0.4), -2px -2px 4px rgba(255,255,255,0.9)", fontSize: "8px", fontWeight: 800, display: "grid", placeItems: "center", color: "#0f172a" }}>WC</div>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>WebCreon</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "inset 2px 2px 4px rgba(166,180,200,0.4), inset -2px -2px 4px rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8", whiteSpace: "nowrap" }}>Search store...</span>
            <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#475569", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
          </div>
          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "2px 2px 4px rgba(166,180,200,0.4), -2px -2px 4px rgba(255,255,255,0.9)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "7px", height: "7px", borderRadius: "999px", background: "#2563eb", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "2px 2px 4px rgba(166,180,200,0.4), -2px -2px 4px rgba(255,255,255,0.9)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" /><circle cx="12" cy="8" r="4" /></svg>
            </div>
          </div>
        </div>
      );

    // 2. HERO BANNER PREVIEWS (Accurately matches on-page hero banner structures)
    case "hero-standard":
      return (
        <div style={{ padding: "10px 12px", borderRadius: "8px", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#ffffff", display: "flex", flexDirection: "column", gap: "4px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ background: "rgba(37,99,235,0.25)", border: "1px solid #3b82f6", color: "#93c5fd", fontSize: "6.5px", fontWeight: 800, padding: "2px 6px", borderRadius: "999px" }}>★ TRENDING NOW</span>
          </div>
          <div style={{ fontSize: "11px", fontWeight: 800, lineHeight: 1.2, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Elevate Your Lifestyle With Premium Essentials
          </div>
          <div style={{ fontSize: "7.5px", color: "#94a3b8", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Curated collections designed for modern everyday living.
          </div>
          <div style={{ display: "flex", gap: "5px", marginTop: "2px" }}>
            <span style={{ background: "#ffffff", color: "#0f172a", fontSize: "7.5px", fontWeight: 800, padding: "3px 8px", borderRadius: "4px" }}>Shop Best Sellers</span>
            <span style={{ border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff", fontSize: "7.5px", fontWeight: 700, padding: "3px 8px", borderRadius: "4px" }}>Explore</span>
          </div>
        </div>
      );
    case "hero-flash-sale":
      return (
        <div style={{ padding: "10px 12px", borderRadius: "8px", background: "linear-gradient(135deg, #1f0b0b 0%, #0f172a 100%)", color: "#ffffff", display: "flex", flexDirection: "column", gap: "5px", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <span style={{ background: "#ef4444", fontSize: "6.5px", fontWeight: 800, padding: "2px 6px", borderRadius: "999px", color: "#ffffff" }}>🔥 FLASH SALE</span>
            <span style={{ background: "rgba(255,255,255,0.1)", border: "1px dashed rgba(255,255,255,0.4)", fontSize: "6.5px", color: "#fca5a5", fontWeight: 800, padding: "1px 5px", borderRadius: "4px" }}>CODE: SAVE50</span>
          </div>
          <div style={{ fontSize: "11px", fontWeight: 800, lineHeight: 1.2, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Festive Flash Sale — Up to 50% OFF
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ fontSize: "6.5px", color: "#94a3b8", fontWeight: 700 }}>ENDS IN:</span>
              <div style={{ display: "flex", gap: "2px" }}>
                {["04h", "22m", "15s"].map((t, i) => (
                  <span key={i} style={{ background: "rgba(255,255,255,0.15)", padding: "1px 3px", borderRadius: "3px", fontSize: "6.5px", fontWeight: 800, color: "#ffffff" }}>{t}</span>
                ))}
              </div>
            </div>
            <span style={{ background: "#ef4444", color: "#ffffff", fontSize: "7.5px", fontWeight: 800, padding: "3px 8px", borderRadius: "4px" }}>Shop Sale →</span>
          </div>
        </div>
      );
    case "hero-product-launch":
      return (
        <div style={{ padding: "10px 12px", borderRadius: "8px", background: "linear-gradient(135deg, #0b192c 0%, #1e3a8a 100%)", color: "#ffffff", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignItems: "center", border: "1px solid rgba(59,130,246,0.3)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
            <span style={{ background: "#3b82f6", color: "#ffffff", fontSize: "6px", fontWeight: 800, padding: "1px 5px", borderRadius: "999px", width: "fit-content" }}>NEW LAUNCH</span>
            <div style={{ fontSize: "10.5px", fontWeight: 800, lineHeight: 1.2, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Future Of Sound</div>
            <span style={{ background: "#ffffff", color: "#0f172a", fontSize: "6.5px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", width: "fit-content", marginTop: "1px" }}>Pre-Order</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: "6px", padding: "4px 6px", display: "flex", flexDirection: "column", gap: "1px", position: "relative" }}>
            <span style={{ fontSize: "7.5px", fontWeight: 800, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Headphones Max</span>
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ fontSize: "8.5px", fontWeight: 900, color: "#60a5fa" }}>$249</span>
              <span style={{ fontSize: "6.5px", textDecoration: "line-through", color: "#94a3b8" }}>$349</span>
            </div>
            <span style={{ fontSize: "6px", color: "#fde047" }}>★★★★★ 4.9</span>
          </div>
        </div>
      );
    case "hero-minimal-brand":
      return (
        <div style={{ padding: "10px 12px", borderRadius: "8px", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", color: "#0f172a", display: "flex", flexDirection: "column", gap: "3px", border: "1px solid rgba(15,23,42,0.08)" }}>
          <span style={{ fontSize: "6.5px", fontWeight: 800, color: "#2563eb", letterSpacing: "0.05em" }}>NEW COLLECTION</span>
          <div style={{ fontSize: "10.5px", fontWeight: 800, lineHeight: 1.2, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Crafted For Everyday Comfort
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "6.5px", fontWeight: 600, color: "#475569", marginTop: "1px" }}>
            <span>✓ Free Shipping</span>
            <span>✓ 30-Day Guarantee</span>
            <span>✓ 24/7 Support</span>
          </div>
        </div>
      );

    // 3. PRODUCT CARD PREVIEWS
    case "product-fashion-apparel":
      return (
        <div style={{ display: "flex", gap: "6px", background: "#ffffff", borderRadius: "8px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <div style={{ width: "35px", height: "45px", borderRadius: "6px", background: "linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)", flexShrink: 0, position: "relative", display: "grid", placeItems: "center" }}>
            <span style={{ position: "absolute", top: "2px", left: "2px", fontSize: "5.5px", background: "#166534", color: "#fff", padding: "1px 3px", borderRadius: "3px", fontWeight: 800 }}>-40%</span>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "#ffffff", strokeWidth: 2, fill: "none" }}>
              <path d="M20.37 4.91L17.26 3.5a2.12 2.12 0 0 0-1.81 0l-3.1 1.41a.84.84 0 0 1-.7 0l-3.1-1.41a2.12 2.12 0 0 0-1.81 0L3.63 4.91a1 1 0 0 0-.58.91v2.5a2 2 0 0 0 .73 1.54L6 11.5v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7l2.22-1.65A2 2 0 0 0 21 8.32V5.82a1 1 0 0 0-.63-.91z" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1px", flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700, whiteSpace: "nowrap" }}>WEBCREON STUDIO</span>
            <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1e293b", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Linen Overshirt</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
              <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b" }}>₹1,899</span>
              <span style={{ fontSize: "7.5px", color: "#d97706", fontWeight: 700 }}>★ 4.9</span>
            </div>
          </div>
        </div>
      );
    case "product-electronics":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", background: "#ffffff", borderRadius: "8px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <div style={{ width: "100%", height: "35px", borderRadius: "6px", background: "#f8fafc", position: "relative", display: "grid", placeItems: "center" }}>
            <span style={{ position: "absolute", top: "2px", left: "2px", fontSize: "5.5px", background: "#2563eb", color: "#fff", padding: "1px 3px", borderRadius: "3px", fontWeight: 800 }}>ANC</span>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "#2563eb", strokeWidth: 2, fill: "none" }}>
              <path d="M3 14c0-4.97 4.03-9 9-9s9 4.03 9 9" />
              <path d="M19 12h2v4h-2zM3 12h2v4H3z" />
            </svg>
          </div>
          <span style={{ fontSize: "7.5px", color: "#94a3b8", fontWeight: 700 }}>WEBCREON TECH</span>
          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#1e293b", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Sonic Headphones Max</span>
          <div style={{ background: "#f8fafc", padding: "2px 5px", borderRadius: "5px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1px" }}>
            <span style={{ fontSize: "8.5px", fontWeight: 800, color: "#1e293b" }}>₹4,499</span>
            <span style={{ fontSize: "6.5px", background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "1px 3px", borderRadius: "999px", fontWeight: 700 }}>In Stock</span>
          </div>
        </div>
      );
    case "product-beauty-cosmetics":
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", background: "#ffffff", borderRadius: "8px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)", textAlign: "center" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "999px", background: "#fff1f2", display: "grid", placeItems: "center", position: "relative" }}>
            <svg viewBox="0 0 24 24" style={{ width: "13px", height: "13px", stroke: "#e11d48", strokeWidth: 2, fill: "none" }}>
              <path d="M9 22h6V10H9v12zM12 2v8M10 5h4" />
            </svg>
          </div>
          <span style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 700 }}>WEBCREON GLOW</span>
          <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b", lineHeight: 1, whiteSpace: "nowrap" }}>Hydra Serum</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "1px" }}>
            <span style={{ fontSize: "8px", color: "#dc2626", fontWeight: 800 }}>₹899</span>
            <span style={{ fontSize: "6px", background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "1px 3px", borderRadius: "999px", fontWeight: 700 }}>In Stock</span>
          </div>
        </div>
      );
    case "product-grocery":
      return (
        <div style={{ display: "flex", gap: "6px", background: "#ffffff", borderRadius: "8px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)", alignItems: "center" }}>
          <div style={{ width: "35px", height: "35px", borderRadius: "6px", background: "#f0fdf4", flexShrink: 0, position: "relative", display: "grid", placeItems: "center" }}>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "#16a34a", strokeWidth: 2, fill: "none" }}>
              <path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
              <path d="M12 2v4M12 6c-2 0-3-1-3-3" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 700, whiteSpace: "nowrap" }}>WEBCREON FRESH</span>
            <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Organic Farm Basket</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1px" }}>
              <span style={{ fontSize: "8px", fontWeight: 800 }}>₹499</span>
              <span style={{ fontSize: "5.5px", background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "1px 3px", borderRadius: "999px", fontWeight: 700 }}>Fresh</span>
            </div>
          </div>
        </div>
      );
    case "product-books-stationery":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", background: "#ffffff", borderRadius: "8px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
          <div style={{ width: "100%", height: "35px", borderRadius: "4px", background: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)", position: "relative", display: "grid", placeItems: "center" }}>
            <svg viewBox="0 0 24 24" style={{ width: "15px", height: "15px", stroke: "#ffffff", strokeWidth: 2, fill: "none" }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z" />
            </svg>
          </div>
          <span style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 700 }}>WEBCREON PRESS</span>
          <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Design Systems 2026</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1px" }}>
            <span style={{ fontSize: "8px", fontWeight: 800 }}>₹799</span>
            <span style={{ fontSize: "6.5px", color: "#d97706", fontWeight: 700 }}>★ 4.8</span>
          </div>
        </div>
      );

    // 4. FOOTER PREVIEWS
    case "footer-apple-minimal":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "5px 8px", background: "#ffffff", borderRadius: "6px", border: "1px solid rgba(15,23,42,0.06)", fontSize: "8px", color: "#64748b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>© 2026 WebCreon</span>
            <span>Terms • Privacy • Help</span>
          </div>
        </div>
      );
    case "footer-glassmorphism":
      return (
        <div style={{ padding: "5px 8px", background: "rgba(240, 244, 250, 0.95)", borderRadius: "6px", border: "1px solid rgba(226, 232, 240, 0.9)", fontSize: "8px", color: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 700 }}>WebCreon Studio</span>
          <div style={{ width: "40px", height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.9)", border: "1px solid rgba(0,0,0,0.08)" }} />
        </div>
      );

    case "footer-modern-marketplace":
      return (
        <div style={{ padding: "5px 8px", background: "#f8fafc", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.06)", fontSize: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 800, color: "#0f172a" }}>WebCreon Market</span>
            <span style={{ fontSize: "7px", color: "#64748b" }}>Secure Checkout</span>
          </div>
          <div style={{ width: "100%", height: "1px", background: "#e2e8f0" }} />
          <span style={{ fontSize: "7px", color: "#94a3b8", whiteSpace: "nowrap" }}>© 2026 WebCreon Inc. All rights reserved.</span>
        </div>
      );
    case "footer-luxury-fashion":
      return (
        <div style={{ padding: "5px 8px", background: "#fafafa", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.04)", textAlign: "center", fontSize: "7.5px", fontFamily: "serif" }}>
          <div style={{ fontWeight: 800, fontSize: "9.5px", color: "#0f172a" }}>WEBCREON</div>
          <span style={{ letterSpacing: "0.1em", color: "#64748b" }}>CURATED LUXURY & CRAFT</span>
        </div>
      );
    case "footer-neo-modern":
      return (
        <div style={{ padding: "5px 8px", background: "#f0f4f9", borderRadius: "6px", boxShadow: "3px 3px 6px rgba(166,180,200,0.3)", fontSize: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 800, color: "#0f172a" }}>WebCreon Neo</span>
          <div style={{ width: "30px", height: "8px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.1)" }} />
        </div>
      );

    default:
      return null;
  }
}

export default function BuilderDrawerPanel({
  activeDrawer,
  onClose,
  savedSites = [],
  savedSitesLoading = false,
  selectedSiteId,
  onSelectSite,
  onDeleteSite,
  activeAdminNavKey,
  onSelectAdminNav,
  activeSettingsNavKey,
  onSelectSettingsNav,
  siteDefinition,
  onSiteDefinitionChange,
}: BuilderDrawerPanelProps) {
  const [selectedAssetCategory, setSelectedAssetCategory] =
    useState<ComponentAssetCategory>("navbar");
  const [appliedAssetId, setAppliedAssetId] = useState<string | null>(null);
  const [deleteSiteModal, setDeleteSiteModal] = useState<{
    siteId: string;
    brandName: string;
  } | null>(null);
  const [deleteCheckLoading, setDeleteCheckLoading] = useState(false);
  const [deleteCheckData, setDeleteCheckData] = useState<{
    can_delete: boolean;
    active_orders: number;
    active_returns: number;
  } | null>(null);

  useEffect(() => {
    if (!deleteSiteModal) {
      setDeleteCheckData(null);
      setDeleteCheckLoading(false);
      return;
    }
    const checkSite = async () => {
      setDeleteCheckLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/sites/${deleteSiteModal.siteId}/delete-check`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setDeleteCheckData(data);
        } else {
          setDeleteCheckData({ can_delete: true, active_orders: 0, active_returns: 0 });
        }
      } catch {
        setDeleteCheckData({ can_delete: true, active_orders: 0, active_returns: 0 });
      } finally {
        setDeleteCheckLoading(false);
      }
    };
    checkSite();
  }, [deleteSiteModal]);

  if (
    !activeDrawer ||
    activeDrawer === "customize" ||
    activeDrawer === "qr-link"
  ) {
    return null;
  }

  const title = titleForDrawer(activeDrawer);
  const handleApplyAsset = (asset: ComponentAsset) => {
    if (!siteDefinition || !onSiteDefinitionChange) return;

    const nextDefinition = JSON.parse(JSON.stringify(siteDefinition));
    const targetType = asset.targetType;

    // Apply layout theme patches (UI-only variant changes, preserving color scheme intact)
    if (asset.patch.themePatch) {
      nextDefinition.theme = {
        ...(nextDefinition.theme ?? {}),
        ...asset.patch.themePatch,
      };
    }

    const mergedPatch = {
      ...(asset.patch.themePatch ?? {}),
      ...(asset.patch.blockPatch ?? {}),
    };

    // Apply block patches to target blocks in pages or flat blocks
    if (Object.keys(mergedPatch).length > 0) {
      const updateBlockList = (blocksList: any[]) => {
        let hasHeroBlock = false;
        const updated = (blocksList ?? []).map((block: any) => {
          const blockType = String(block.type || "").toLowerCase();
          const isHero = targetType === "hero_banner" && (blockType === "hero_banner" || blockType.includes("hero"));

          if (isHero) {
            hasHeroBlock = true;
            const currentProps = block.props ?? {};
            const newSlide = {
              id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...mergedPatch,
            };

            let existingSlides: any[] = Array.isArray(currentProps.slides) ? [...currentProps.slides] : [];

            if (existingSlides.length === 0 && (currentProps.headline || currentProps.variant)) {
              existingSlides.push({
                id: `slide-1`,
                variant: currentProps.variant || "standard",
                headline: currentProps.headline || "Welcome to Our Store",
                subheadline: currentProps.subheadline,
                primary_cta: currentProps.primary_cta,
                secondary_cta: currentProps.secondary_cta,
                background_image: currentProps.background_image,
                background_overlay: currentProps.background_overlay,
              });
            }

            existingSlides.push(newSlide);

            return {
              ...block,
              props: {
                ...currentProps,
                slides: existingSlides,
                ...mergedPatch,
              },
            };
          }

          if (
            blockType === targetType ||
            (targetType === "product_grid" && (blockType.includes("product") || blockType === "product_grid")) ||
            (targetType === "footer" && blockType.includes("footer")) ||
            (targetType === "navbar" && blockType.includes("nav"))
          ) {
            return {
              ...block,
              props: {
                ...(block.props ?? {}),
                ...mergedPatch,
              },
            };
          }
          return block;
        });

        if (targetType === "hero_banner" && !hasHeroBlock) {
          updated.unshift({
            id: `hero-${Date.now()}`,
            type: "hero_banner",
            props: {
              auto_play_interval: 3,
              auto_play: true,
              slides: [
                {
                  id: `slide-${Date.now()}`,
                  ...mergedPatch,
                },
              ],
            },
          });
        }
        return updated;
      };

      if (Array.isArray(nextDefinition.pages) && nextDefinition.pages.length > 0) {
        nextDefinition.pages = nextDefinition.pages.map((page: any) => {
          if (targetType === "hero_banner") {
            const isHomePage = page.role === "home" || page.id === "home" || page.page_type === "landing" || page.route === "/";
            if (!isHomePage) return page;
          }
          return {
            ...page,
            blocks: updateBlockList(page.blocks ?? []),
          };
        });
      }

      if (Array.isArray(nextDefinition.blocks)) {
        nextDefinition.blocks = updateBlockList(nextDefinition.blocks);
      }
    }

    onSiteDefinitionChange(nextDefinition);
    setAppliedAssetId(asset.id);
    setTimeout(() => setAppliedAssetId(null), 2000);
  };

  const filteredAssets = COMPONENT_ASSETS.filter((asset) => {
    if ((selectedAssetCategory as string) === "all") return true;
    return (asset.category as string) === (selectedAssetCategory as string);
  });

  return (
    <div
      className="builder-drawer-root"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        .builder-drawer-root,
        .builder-drawer-root input,
        .builder-drawer-root button,
        .builder-drawer-root select,
        .builder-drawer-root textarea,
        .builder-drawer-root span,
        .builder-drawer-root div,
        .builder-drawer-root p,
        .builder-drawer-root h1,
        .builder-drawer-root h2,
        .builder-drawer-root h3,
        .builder-drawer-root h4 {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
      `}</style>
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: "#64748b",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        <span>{title}</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            color: "#94a3b8",
            display: "grid",
            placeItems: "center",
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          padding: "12px",
          fontSize: 12,
          color: "#4b5563",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          WebkitOverflowScrolling: "touch",
          contain: "content",
        }}
      >
        {activeDrawer === "saved-sites" ? (
          savedSitesLoading ? (
            // Skeleton cards while the site list is being fetched from the server
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: "54px",
                    borderRadius: "10px",
                    background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
                    backgroundSize: "200% 100%",
                    animation: "drawerSkeletonShimmer 1.4s infinite linear",
                  }}
                />
              ))}
              <style>{`
                @keyframes drawerSkeletonShimmer {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
              `}</style>
            </div>
          ) : savedSites.length === 0 ? (
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid rgba(15,23,42,0.08)",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              No saved sites found.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {savedSites.map((site) => {
                const brandName = getBrandName(site);
                const isSelected = selectedSiteId === site.id;

                return (
                  <SavedSiteCard
                    key={site.id}
                    site={site}
                    isSelected={isSelected}
                    onClick={() => onSelectSite?.(site.id)}
                    onDelete={() => {
                      setDeleteSiteModal({
                        siteId: site.id,
                        brandName,
                      });
                    }}
                  />
                );
              })}
            </div>
          )
        ) : activeDrawer === "admin-panel" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {ADMIN_NAV_ITEMS.map((item) => (
              <AdminNavCard
                key={item.key}
                item={item}
                isSelected={activeAdminNavKey === item.key}
                onClick={() => onSelectAdminNav?.(item.key)}
              />
            ))}
          </div>
        ) : activeDrawer === "assets" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Clean Segmented Tab Control */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "2px",
                background: "#f1f5f9",
                padding: "3px",
                borderRadius: "10px",
                border: "1px solid rgba(226, 232, 240, 0.9)",
              }}
            >
              {[
                { id: "navbar", label: "Navbar" },
                { id: "banner", label: "Banner" },
                { id: "products", label: "Products" },
                { id: "footer", label: "Footer" },
              ].map((cat) => {
                const isActive = selectedAssetCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setSelectedAssetCategory(cat.id as ComponentAssetCategory)
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "7px 2px",
                      borderRadius: "7px",
                      border: "none",
                      background: isActive ? "#ffffff" : "transparent",
                      color: isActive ? "#1d4ed8" : "#64748b",
                      boxShadow: isActive
                        ? "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)"
                        : "none",
                      fontSize: "12px",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      userSelect: "none",
                    }}
                  >
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Banner Carousel Count Info Badge */}
            {selectedAssetCategory === "banner" && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(37,99,235,0.06)",
                  border: "1px solid rgba(37,99,235,0.15)",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Carousel Status</span>
                <span
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  {(() => {
                    const heroBlock = (siteDefinition?.pages?.[0]?.blocks ?? []).find((b: any) => String(b.type || "").toLowerCase().includes("hero"));
                    const count = Array.isArray(heroBlock?.props?.slides) ? heroBlock.props.slides.length : (heroBlock ? 1 : 0);
                    return `${count} ${count === 1 ? 'Banner' : 'Banners'} Active`;
                  })()}
                </span>
              </div>
            )}

            {/* Component Assets List */}
            {(() => {
              const heroBlock = (siteDefinition?.pages?.[0]?.blocks ?? []).find((b: any) => String(b.type || "").toLowerCase().includes("hero"));
              const activeSlidesList = Array.isArray(heroBlock?.props?.slides) ? heroBlock.props.slides : [];

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredAssets.map((asset) => {
                    const isJustApplied = appliedAssetId === asset.id;
                    const isCurrentlyActive =
                      asset.category === "navbar"
                        ? siteDefinition?.theme?.navbar_layout === asset.patch.themePatch?.navbar_layout || (asset.id === "navbar-apple-minimal" && !siteDefinition?.theme?.navbar_layout)
                        : asset.category === "products"
                          ? siteDefinition?.theme?.card_style === asset.patch.themePatch?.card_style || (asset.id === "product-fashion-apparel" && !siteDefinition?.theme?.card_style)
                          : asset.category === "footer"
                            ? siteDefinition?.theme?.footer_layout === asset.patch.themePatch?.footer_layout || (asset.id === "footer-apple-minimal" && !siteDefinition?.theme?.footer_layout)
                            : false;

                    const appliedCount = asset.category === "banner"
                      ? activeSlidesList.filter((s: any) => (s.variant || "standard") === (asset.patch.blockPatch?.variant || "standard")).length
                      : 0;

                    return (
                      <div
                        key={asset.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: isCurrentlyActive
                            ? "1.5px solid #2563eb"
                            : "1px solid rgba(15,23,42,0.08)",
                          background: isCurrentlyActive
                            ? "rgba(37,99,235,0.02)"
                            : "#ffffff",
                          boxShadow: isCurrentlyActive
                            ? "0 2px 8px rgba(37,99,235,0.08)"
                            : "0 1px 3px rgba(15,23,42,0.03)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          contain: "paint",
                          transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
                        }}
                      >

                    {/* Header: Title + Status Badge Row (top) & Full-width Description (bottom) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 700,
                            color: isCurrentlyActive ? "#1d4ed8" : "#0f172a",
                            lineHeight: 1.2,
                          }}
                        >
                          {asset.title}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                          {asset.category === "banner" && appliedCount > 0 && (
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: "#eff6ff",
                                color: "#2563eb",
                                border: "1px solid #bfdbfe",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {appliedCount} in Carousel
                            </span>
                          )}
                          {isCurrentlyActive && (
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: "#ecfdf5",
                                color: "#059669",
                                border: "1px solid #a7f3d0",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ✓ Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "10.5px",
                          color: "#64748b",
                          lineHeight: 1.35,
                          width: "100%",
                        }}
                      >
                        {asset.description}
                      </div>
                    </div>


                    {/* Visual Mini Preview */}
                    <div
                      style={{
                        padding: "5px",
                        borderRadius: "8px",
                        background: "#f8fafc",
                        border: "1px solid rgba(15,23,42,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      {renderAssetPreview(asset.id)}
                    </div>

                    {/* Apply / Add Button */}
                    <button
                      type="button"
                      onClick={() => handleApplyAsset(asset)}
                      disabled={!siteDefinition || !onSiteDefinitionChange}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: isCurrentlyActive ? "1px solid #e2e8f0" : "none",
                        background: isJustApplied
                          ? "#16a34a"
                          : isCurrentlyActive
                            ? "#f8fafc"
                            : "#2563eb",
                        color: isCurrentlyActive ? "#475569" : "#ffffff",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor:
                          !siteDefinition || !onSiteDefinitionChange
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          !siteDefinition || !onSiteDefinitionChange ? 0.5 : 1,
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      {isJustApplied
                        ? asset.category === "banner" ? "✓ Banner Added!" : "✓ Layout Applied!"
                        : asset.category === "banner"
                          ? "+ Add Banner to Carousel"
                          : isCurrentlyActive
                            ? "✓ Current Layout"
                            : "Apply Layout"}
                    </button>
                  </div>
                );
              })}
            </div>
            );
          })()}
          </div>
        ) : activeDrawer === "chat" ? (
          <AdminCopilotChat
            siteId={selectedSiteId || siteDefinition?.id || ""}
            siteDefinition={siteDefinition}
            onSiteDefinitionChange={onSiteDefinitionChange}
          />
        ) : activeDrawer === "settings" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {SETTINGS_NAV_ITEMS.map((item) => (
              <SettingsNavCard
                key={item.key}
                item={item}
                isSelected={activeSettingsNavKey === item.key}
                onClick={() => onSelectSettingsNav?.(item.key)}
              />
            ))}
          </div>
        ) : (
          <>
            <p style={{ margin: 0, color: "#4b5563" }}>
              Drawer content for <strong>{title}</strong> will go here.
            </p>
          </>
        )}
      </div>

      {deleteSiteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "16px",
          }}
          onClick={() => setDeleteSiteModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "360px",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.22)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {deleteCheckLoading ? (
              <div style={{ padding: "16px 0", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                Checking store activity...
              </div>
            ) : deleteCheckData && !deleteCheckData.can_delete ? (
              <>
                <h4
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#dc2626",
                  }}
                >
                  Cannot Delete Website
                </h4>

                <p
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "13px",
                    color: "#475569",
                    lineHeight: 1.45,
                  }}
                >
                  <strong>"{deleteSiteModal.brandName}"</strong> has active uncleared customer transactions:
                </p>

                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fee2e2",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    marginBottom: "16px",
                    fontSize: "12px",
                    color: "#991b1b",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {deleteCheckData.active_orders > 0 && (
                    <div>• <strong>{deleteCheckData.active_orders}</strong> active order(s) pending delivery/completion</div>
                  )}
                  {deleteCheckData.active_returns > 0 && (
                    <div>• <strong>{deleteCheckData.active_returns}</strong> open return request(s)</div>
                  )}
                  <div style={{ marginTop: "4px", fontSize: "11px", opacity: 0.85 }}>
                    Please resolve, fulfill, or cancel all active orders and return requests before deleting this website.
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setDeleteSiteModal(null)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#334155",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Got it
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Delete website?
                </h4>

                <p
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "13px",
                    color: "#64748b",
                    lineHeight: 1.45,
                  }}
                >
                  Are you sure you want to delete <strong>"{deleteSiteModal.brandName}"</strong>? All associated products, carts, inventory records, and order history for this store will be <strong style={{ color: "#ef4444" }}>permanently purged</strong>.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDeleteSiteModal(null)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#334155",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const targetId = deleteSiteModal.siteId;
                      setDeleteSiteModal(null);
                      onDeleteSite?.(targetId);
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#ef4444",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
