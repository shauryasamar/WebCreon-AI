import React, { useState } from "react";
import {
  COMPONENT_ASSETS,
  ComponentAsset,
  ComponentAssetCategory,
} from "../customizations/assetsRegistry";

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
  site_definition?: {
    site?: {
      brand_name?: string | null;
    };
  } | null;
  draft_definition?: {
    site?: {
      brand_name?: string | null;
    };
  } | null;
};

export type AdminNavKey = "products" | "orders" | "checkout-charges";

type AdminNavItem = {
  key: AdminNavKey;
  label: string;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "checkout-charges", label: "Checkout Charges" },
];

type BuilderDrawerPanelProps = {
  activeDrawer: ControlItemKey | null;
  onClose: () => void;
  savedSites?: SavedSite[];
  selectedSiteId?: string | null;
  onSelectSite?: (siteId: string) => void;
  onDeleteSite?: (siteId: string) => void;
  activeAdminNavKey?: AdminNavKey | null;
  onSelectAdminNav?: (key: AdminNavKey) => void;
  siteDefinition?: any;
  onSiteDefinitionChange?: (next: any) => void;
};

function titleForDrawer(key: ControlItemKey | null) {
  switch (key) {
    case "saved-sites":
      return "Saved Sites";
    case "chat":
      return "Chat Assistant";
    case "admin-panel":
      return "Store Control";
    case "assets":
      return "Component Assets";
    case "settings":
      return "Settings";
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
    case "navbar-apple-minimal":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "#ffffff", borderRadius: "999px", padding: "6px 10px", boxShadow: "0 3px 10px rgba(0,0,0,0.05)", border: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "6px", background: "#f1f5f9", fontSize: "9px", fontWeight: 800, display: "grid", placeItems: "center", color: "#0f172a" }}>YB</div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>Your Brand</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "999px", background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 0 8px" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8" }}>Search...</span>
            <div style={{ width: "12px", height: "12px", borderRadius: "999px", background: "#e2e8f0", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#475569", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "8px", height: "8px", borderRadius: "999px", background: "#0066ff", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "5px", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.6)", fontSize: "8px", fontWeight: 800, display: "grid", placeItems: "center", color: "#0f172a" }}>YB</div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>Your Brand</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 0 8px" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8" }}>Search...</span>
            <div style={{ width: "12px", height: "12px", borderRadius: "999px", background: "rgba(255,255,255,0.8)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#475569", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "8px", height: "8px", borderRadius: "999px", background: "#0066ff", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>
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
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: "#f1f5f9", border: "1px solid rgba(15,23,42,0.1)", fontSize: "8px", fontWeight: 800, display: "grid", placeItems: "center", color: "#0f172a" }}>YB</div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>Your Brand</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "4px", border: "1px solid rgba(15,23,42,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", overflow: "hidden", background: "#ffffff" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8", paddingLeft: "4px" }}>Search...</span>
            <div style={{ width: "18px", height: "100%", background: "#374151", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "8px", height: "8px", stroke: "#ffffff", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: "1px solid rgba(15,23,42,0.12)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "7px", height: "7px", borderRadius: "999px", background: "#0066ff", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: "1px solid rgba(15,23,42,0.12)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>
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
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontFamily: "serif", fontSize: "11px", fontWeight: 800, color: "#0f172a" }}>YB</span>
            <span style={{ width: "1px", height: "10px", background: "rgba(15,23,42,0.2)" }} />
            <span style={{ fontFamily: "serif", fontSize: "9px", fontWeight: 600, color: "#0f172a", letterSpacing: "0.1em" }}>Your Brand</span>
          </div>
          <div style={{ flex: 1, maxWidth: "100px", height: "16px", borderRadius: "999px", border: "1px solid rgba(15,23,42,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px" }}>
            <span style={{ fontSize: "7px", color: "#94a3b8", fontFamily: "serif" }}>Search...</span>
            <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#0f172a", strokeWidth: 2, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
            <div style={{ position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "10px", height: "10px", stroke: "#0f172a", strokeWidth: 1.8, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-3px", width: "6px", height: "6px", borderRadius: "999px", background: "#000", color: "#fff", fontSize: "4px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <svg viewBox="0 0 24 24" style={{ width: "10px", height: "10px", stroke: "#0f172a", strokeWidth: 1.8, fill: "none" }}><path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>
            <svg viewBox="0 0 24 24" style={{ width: "10px", height: "10px", stroke: "#0f172a", strokeWidth: 1.8, fill: "none" }}><path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" /><circle cx="12" cy="8" r="4" /></svg>
          </div>
        </div>
      );
    case "navbar-neo-modern":
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "#f0f4f9", borderRadius: "999px", padding: "6px 10px", boxShadow: "3px 3px 6px rgba(166,180,200,0.4), -3px -3px 6px rgba(255,255,255,0.9)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "5px", background: "#f0f4f9", boxShadow: "2px 2px 4px rgba(166,180,200,0.4), -2px -2px 4px rgba(255,255,255,0.9)", fontSize: "8px", fontWeight: 800, display: "grid", placeItems: "center", color: "#0f172a" }}>YB</div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>Your Brand</span>
          </div>
          <div style={{ flex: 1, maxWidth: "110px", height: "18px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "inset 2px 2px 4px rgba(166,180,200,0.4), inset -2px -2px 4px rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px" }}>
            <span style={{ fontSize: "8px", color: "#94a3b8" }}>Search...</span>
            <svg viewBox="0 0 24 24" style={{ width: "7px", height: "7px", stroke: "#475569", strokeWidth: 2.5, fill: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20L16.65 16.65" /></svg>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "2px 2px 4px rgba(166,180,200,0.4), -2px -2px 4px rgba(255,255,255,0.9)", display: "grid", placeItems: "center", position: "relative" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4H5L7.2 14.5C7.3 15 7.7 15.3 8.2 15.3H17.4C17.9 15.3 18.3 15 18.4 14.5L20 7H6.2" /></svg>
              <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "7px", height: "7px", borderRadius: "999px", background: "#0066ff", color: "#fff", fontSize: "5px", fontWeight: 900, display: "grid", placeItems: "center" }}>1</span>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "2px 2px 4px rgba(166,180,200,0.4), -2px -2px 4px rgba(255,255,255,0.9)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M15 17H5l1.5-1.5V11a5.5 5.5 0 1 1 11 0v4.5L19 17h-4" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>
            </div>
            <div style={{ width: "18px", height: "18px", borderRadius: "999px", background: "#f0f4f9", boxShadow: "2px 2px 4px rgba(166,180,200,0.4), -2px -2px 4px rgba(255,255,255,0.9)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: "9px", height: "9px", stroke: "#334155", strokeWidth: 2, fill: "none" }}><path d="M20 21C20 17.6863 16.866 15 13 15H11C7.13401 15 4 17.6863 4 21" /><circle cx="12" cy="8" r="4" /></svg>
            </div>
          </div>
        </div>
      );
    case "hero-flash-sale":
      return (
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "linear-gradient(135deg, #1e293b, #0f172a)", color: "#ffffff", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ background: "#ef4444", fontSize: "7px", fontWeight: 800, padding: "1px 5px", borderRadius: "4px" }}>FLASH SALE</span>
            <span style={{ fontSize: "7px", color: "#94a3b8" }}>CODE: SAVE50</span>
          </div>
          <div style={{ fontSize: "11px", fontWeight: 800, lineHeight: 1.2 }}>Festive Flash Sale - 50% OFF</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "7px", color: "#cbd5e1" }}>
            <span>ENDS IN:</span>
            <span style={{ background: "rgba(255,255,255,0.15)", padding: "1px 4px", borderRadius: "3px", fontWeight: 800 }}>04h:22m</span>
          </div>
        </div>
      );
    case "hero-product-launch":
      return (
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "linear-gradient(135deg, #eff6ff, #dbeafe)", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ background: "#2563eb", color: "#fff", fontSize: "6px", fontWeight: 800, padding: "1px 4px", borderRadius: "3px", width: "fit-content" }}>NEW LAUNCH</span>
            <div style={{ fontSize: "10px", fontWeight: 800 }}>Future Of Sound</div>
          </div>
          <div style={{ background: "#ffffff", padding: "4px 6px", borderRadius: "6px", border: "1px solid rgba(37,99,235,0.2)", fontSize: "8px", fontWeight: 800, color: "#2563eb" }}>
            $249 • 4.9 ⭐
          </div>
        </div>
      );
    case "hero-lead-magnet":
      return (
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", color: "#0f172a", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ background: "#10b981", color: "#fff", fontSize: "6px", fontWeight: 800, padding: "1px 4px", borderRadius: "3px", width: "fit-content" }}>VIP DISCOUNT</span>
          <div style={{ fontSize: "10px", fontWeight: 800 }}>Get 15% OFF Your First Order</div>
          <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
            <div style={{ flex: 1, height: "12px", borderRadius: "999px", background: "#ffffff", border: "1px solid rgba(16,185,129,0.3)" }} />
            <div style={{ width: "24px", height: "12px", borderRadius: "999px", background: "#10b981" }} />
          </div>
        </div>
      );
    case "hero-minimal-brand":
      return (
        <div style={{ padding: "8px 10px", borderRadius: "8px", background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1px solid rgba(15,23,42,0.08)", color: "#0f172a", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "6px", fontWeight: 800, color: "#64748b" }}>NEW COLLECTION</span>
          <div style={{ fontSize: "10px", fontWeight: 800 }}>Crafted For Everyday Elegance</div>
          <div style={{ fontSize: "7px", color: "#64748b" }}>✓ Free Delivery • ✓ 30-Day Guarantee</div>
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
  selectedSiteId,
  onSelectSite,
  onDeleteSite,
  activeAdminNavKey,
  onSelectAdminNav,
  siteDefinition,
  onSiteDefinitionChange,
}: BuilderDrawerPanelProps) {
  const [selectedAssetCategory, setSelectedAssetCategory] =
    useState<ComponentAssetCategory>("navbar");
  const [appliedAssetId, setAppliedAssetId] = useState<string | null>(null);

  if (
    !activeDrawer ||
    activeDrawer === "customize" ||
    activeDrawer === "qr-link"
  ) {
    return null;
  }

  const title = titleForDrawer(activeDrawer);
  if (!title) return null;

  const handleApplyAsset = (asset: ComponentAsset) => {
    if (!siteDefinition || !onSiteDefinitionChange) return;

    const nextDefinition = JSON.parse(JSON.stringify(siteDefinition));

    // Apply layout theme patches (UI-only variant changes, preserving color scheme intact)
    if (asset.patch.themePatch) {
      nextDefinition.theme = {
        ...(nextDefinition.theme ?? {}),
        ...asset.patch.themePatch,
      };
    }

    // Apply block patches to target blocks in pages or flat blocks
    if (asset.patch.blockPatch) {
      const updateBlockList = (blocksList: any[]) => {
        let hasHeroBlock = false;
        const targetType = asset.targetType;
        const updated = (blocksList ?? []).map((block: any) => {
          const blockType = String(block.type || "").toLowerCase();
          const isHero = targetType === "hero_banner" && (blockType === "hero_banner" || blockType.includes("hero"));

          if (isHero) {
            hasHeroBlock = true;
            const currentProps = block.props ?? {};
            const newSlide = {
              id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              ...asset.patch.blockPatch,
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
                ...asset.patch.blockPatch,
              },
            };
          }

          if (
            blockType === targetType ||
            (targetType === "product_grid" && blockType.includes("product")) ||
            (targetType === "footer" && blockType.includes("footer"))
          ) {
            return {
              ...block,
              props: {
                ...(block.props ?? {}),
                ...asset.patch.blockPatch,
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
                  ...asset.patch.blockPatch,
                },
              ],
            },
          });
        }
        return updated;
      };

      if (Array.isArray(nextDefinition.pages) && nextDefinition.pages.length > 0) {
        nextDefinition.pages = nextDefinition.pages.map((page: any) => ({
          ...page,
          blocks: updateBlockList(page.blocks ?? []),
        }));
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
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
          color: "#111827",
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
            color: "#6b7280",
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          padding:
            activeDrawer === "saved-sites" || activeDrawer === "admin-panel"
              ? "12px"
              : "10px 12px",
          fontSize: 12,
          color: "#4b5563",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        }}
      >
        {activeDrawer === "saved-sites" ? (
          savedSites.length === 0 ? (
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
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {savedSites.map((site) => {
                const brandName = getBrandName(site);
                const isSelected = selectedSiteId === site.id;

                return (
                  <PlainCard
                    key={site.id}
                    label={brandName}
                    isSelected={isSelected}
                    onClick={() => onSelectSite?.(site.id)}
                    trailing={
                      isSelected ? (
                        <button
                          type="button"
                          aria-label="Delete site"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSite?.(site.id);
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
                          }}
                        >
                          <DeleteIcon />
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )
        ) : activeDrawer === "admin-panel" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ADMIN_NAV_ITEMS.map((item) => (
              <PlainCard
                key={item.key}
                label={item.label}
                isSelected={activeAdminNavKey === item.key}
                onClick={() => onSelectAdminNav?.(item.key)}
              />
            ))}
          </div>
        ) : activeDrawer === "assets" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Category Filter Pills */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                paddingBottom: "4px",
                scrollbarWidth: "none",
              }}
            >
              {[
                { id: "all", label: "All Assets" },
                { id: "navbar", label: "Navbar" },
                { id: "banner", label: "Banner" },
                { id: "products", label: "Products" },
                { id: "footer", label: "Footer" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setSelectedAssetCategory(cat.id as ComponentAssetCategory)
                  }
                  style={{
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border:
                      selectedAssetCategory === cat.id
                        ? "1px solid #2563eb"
                        : "1px solid rgba(15,23,42,0.1)",
                    background:
                      selectedAssetCategory === cat.id
                        ? "rgba(37,99,235,0.08)"
                        : "#ffffff",
                    color: selectedAssetCategory === cat.id ? "#2563eb" : "#64748b",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat.label}
                </button>
              ))}
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
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {filteredAssets.map((asset) => {
                const isJustApplied = appliedAssetId === asset.id;
                const isCurrentlyActive =
                  siteDefinition?.theme?.navbar_layout ===
                    asset.patch.themePatch?.navbar_layout ||
                  (asset.id === "navbar-apple-minimal" &&
                    !siteDefinition?.theme?.navbar_layout);

                const heroBlock = (siteDefinition?.pages?.[0]?.blocks ?? []).find((b: any) => String(b.type || "").toLowerCase().includes("hero"));
                const activeSlidesList = Array.isArray(heroBlock?.props?.slides) ? heroBlock.props.slides : [];
                const appliedCount = asset.category === "banner"
                  ? activeSlidesList.filter((s: any) => (s.variant || "standard") === (asset.patch.blockPatch?.variant || "standard")).length
                  : 0;

                return (
                  <div
                    key={asset.id}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      border: isCurrentlyActive
                        ? "1.5px solid #2563eb"
                        : "1px solid rgba(15,23,42,0.08)",
                      background: isCurrentlyActive
                        ? "rgba(37,99,235,0.02)"
                        : "#ffffff",
                      boxShadow: "0 2px 6px rgba(15,23,42,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* Header: Title & Tag */}
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
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {asset.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {asset.category === "banner" && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "999px",
                              background: appliedCount > 0 ? "#2563eb" : "rgba(15,23,42,0.06)",
                              color: appliedCount > 0 ? "#ffffff" : "#64748b",
                            }}
                          >
                            {appliedCount} Applied
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isCurrentlyActive
                              ? "#2563eb"
                              : "rgba(37,99,235,0.08)",
                            color: isCurrentlyActive ? "#ffffff" : "#2563eb",
                          }}
                        >
                          {isCurrentlyActive ? "Active" : asset.tag}
                        </span>
                      </div>
                    </div>

                    {/* Visual Mini Navbar Preview */}
                    <div
                      style={{
                        padding: "6px",
                        borderRadius: "10px",
                        background: "#f8fafc",
                        border: "1px solid rgba(15,23,42,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      {renderAssetPreview(asset.id)}
                    </div>

                    {/* Apply Button */}
                    <button
                      type="button"
                      onClick={() => handleApplyAsset(asset)}
                      disabled={!siteDefinition || !onSiteDefinitionChange}
                      style={{
                        marginTop: "2px",
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: isJustApplied
                          ? "#16a34a"
                          : isCurrentlyActive
                          ? "#059669"
                          : "#2563eb",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor:
                          !siteDefinition || !onSiteDefinitionChange
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          !siteDefinition || !onSiteDefinitionChange ? 0.5 : 1,
                        transition: "background 0.2s ease",
                      }}
                    >
                      {isJustApplied
                        ? asset.category === "banner" ? "✓ Banner Added" : "✓ Layout Applied"
                        : asset.category === "banner"
                        ? "+ Add Banner to Carousel"
                        : isCurrentlyActive
                        ? "Active Layout"
                        : "Apply Layout"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Drawer content for <strong>{title}</strong> will go here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
