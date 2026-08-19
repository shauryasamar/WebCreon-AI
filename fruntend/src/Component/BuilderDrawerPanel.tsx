import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";
import { AdminCopilotChat } from "./AdminCopilotChat";
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

export type AdminNavKey =
  | "products"
  | "orders"
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
  { key: "orders", label: "Orders" },
  { key: "delivery", label: "Delivery & Shipping" },
  { key: "earnings", label: "Earnings & Ledger" },
  { key: "payment-settings", label: "Payout Settings" },
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
      return "WebNirmaan Co-Pilot";
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

    // Product Card Preview Mockups
    case "product-fashion-apparel":
      return (
        <div style={{ display: "flex", gap: "6px", background: "#ffffff", borderRadius: "10px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ width: "35px", height: "45px", borderRadius: "6px", background: "linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)", flexShrink: 0, position: "relative", display: "grid", placeItems: "center" }}>
            <span style={{ position: "absolute", top: "2px", left: "2px", fontSize: "5px", background: "#166534", color: "#fff", padding: "1px 3px", borderRadius: "4px", scale: "0.8" }}>96%</span>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "#ffffff", strokeWidth: 2, fill: "none" }}>
              <path d="M20.37 4.91L17.26 3.5a2.12 2.12 0 0 0-1.81 0l-3.1 1.41a.84.84 0 0 1-.7 0l-3.1-1.41a2.12 2.12 0 0 0-1.81 0L3.63 4.91a1 1 0 0 0-.58.91v2.5a2 2 0 0 0 .73 1.54L6 11.5v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7l2.22-1.65A2 2 0 0 0 21 8.32V5.82a1 1 0 0 0-.63-.91z" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px", flex: 1 }}>
            <span style={{ fontSize: "8px", color: "#94a3b8", fontWeight: 700 }}>VOGUE</span>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>Shirts</span>
            <span style={{ fontSize: "8px", color: "#d97706" }}>★ 3.0</span>
            <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b" }}>₹220</span>
          </div>
        </div>
      );
    case "product-electronics":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "#ffffff", borderRadius: "10px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ width: "100%", height: "35px", borderRadius: "6px", background: "#f8fafc", position: "relative", display: "grid", placeItems: "center" }}>
            <span style={{ position: "absolute", top: "2px", left: "2px", fontSize: "5px", background: "#166534", color: "#fff", padding: "1px 3px", borderRadius: "4px", scale: "0.8" }}>96%</span>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "#2563eb", strokeWidth: 2, fill: "none" }}>
              <path d="M3 14c0-4.97 4.03-9 9-9s9 4.03 9 9" />
              <path d="M19 12h2v4h-2zM3 12h2v4H3z" />
            </svg>
          </div>
          <span style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 700 }}>SONIC</span>
          <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>AirPods Pro</span>
          <div style={{ background: "#f4f4f6", padding: "3px 6px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
            <span style={{ fontSize: "8px", fontWeight: 800, color: "#1e293b" }}>₹220</span>
            <span style={{ fontSize: "6px", background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "1px 3px", borderRadius: "999px" }}>In Stock</span>
          </div>
        </div>
      );
    case "product-beauty-cosmetics":
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", background: "#ffffff", borderRadius: "10px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", textAlign: "center" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "999px", background: "#fff1f2", display: "grid", placeItems: "center", position: "relative" }}>
            <span style={{ position: "absolute", top: "-2px", left: "-2px", fontSize: "5px", background: "#166534", color: "#fff", padding: "1px 3px", borderRadius: "4px", scale: "0.7" }}>96%</span>
            <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", stroke: "#e11d48", strokeWidth: 2, fill: "none" }}>
              <path d="M9 22h6V10H9v12zM12 2v8M10 5h4" />
            </svg>
          </div>
          <span style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 700 }}>GLOW</span>
          <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>Face Wash</span>
          <span style={{ fontSize: "8px", color: "#dc2626", fontWeight: 800 }}>₹220</span>
          <span style={{ fontSize: "6px", background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "1px 4px", borderRadius: "999px" }}>In Stock</span>
        </div>
      );
    case "product-grocery":
      return (
        <div style={{ display: "flex", gap: "6px", background: "#ffffff", borderRadius: "10px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", alignItems: "center" }}>
          <div style={{ width: "35px", height: "35px", borderRadius: "6px", background: "#f0fdf4", flexShrink: 0, position: "relative", display: "grid", placeItems: "center" }}>
            <span style={{ position: "absolute", top: "2px", left: "2px", fontSize: "5px", background: "#166534", color: "#fff", padding: "1px 3px", borderRadius: "4px", scale: "0.7" }}>96%</span>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "#16a34a", strokeWidth: 2, fill: "none" }}>
              <path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
              <path d="M12 2v4M12 6c-2 0-3-1-3-3" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 700 }}>FRESH</span>
            <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>Red Apples</span>
            <div style={{ borderTop: "1px solid #e2e8f0", margin: "2px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "8px", fontWeight: 800 }}>₹220</span>
              <span style={{ fontSize: "5px", background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "1px 3px", borderRadius: "999px" }}>In Stock</span>
            </div>
          </div>
        </div>
      );
    case "product-books-stationery":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", background: "#ffffff", borderRadius: "10px", padding: "6px", border: "1px solid rgba(15,23,42,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ width: "100%", height: "45px", borderRadius: "4px", background: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)", position: "relative", display: "grid", placeItems: "center" }}>
            <span style={{ position: "absolute", top: "2px", left: "2px", fontSize: "5px", background: "#166534", color: "#fff", padding: "1px 3px", borderRadius: "4px", scale: "0.8" }}>96%</span>
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", stroke: "#ffffff", strokeWidth: 2, fill: "none" }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z" />
            </svg>
          </div>
          <span style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 700 }}>PENGUIN</span>
          <span style={{ fontSize: "9px", fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>Atomic Habits</span>
          <div style={{ borderTop: "1px solid #e2e8f0", margin: "2px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "8px", fontWeight: 800 }}>₹220</span>
            <span style={{ fontSize: "7px", color: "#d97706" }}>★ 3.0</span>
          </div>
        </div>
      );

    // Footer Preview Mockups
    case "footer-apple-minimal":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "4px 8px", background: "#ffffff", borderRadius: "6px", border: "1px solid rgba(15,23,42,0.06)", fontSize: "8px", color: "#64748b" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>© 2026 Brand.</span>
            <span>Terms • Privacy</span>
          </div>
        </div>
      );
    case "footer-glassmorphism":
      return (
        <div style={{ padding: "6px 8px", background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(8px)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.8)", fontSize: "8px", color: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Frosted Glass Footer</span>
          <div style={{ width: "40px", height: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }} />
        </div>
      );
    case "footer-modern-marketplace":
      return (
        <div style={{ padding: "6px 8px", background: "#f8fafc", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.06)", fontSize: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 800 }}>Shopify Market</span>
            <span>Payments accepted</span>
          </div>
          <div style={{ width: "100%", height: "1px", background: "#e2e8f0" }} />
          <span>© 2026 Shopify Market. All rights reserved.</span>
        </div>
      );
    case "footer-luxury-fashion":
      return (
        <div style={{ padding: "6px 8px", background: "#fafafa", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.04)", textAlign: "center", fontSize: "8px", fontFamily: "serif" }}>
          <div style={{ fontWeight: 800, fontSize: "10px", marginBottom: "2px" }}>YB</div>
          <span>CURATED LUXURY EDIT</span>
        </div>
      );
    case "footer-neo-modern":
      return (
        <div style={{ padding: "6px 8px", background: "#f0f4f9", borderRadius: "6px", boxShadow: "3px 3px 6px rgba(166,180,200,0.3)", fontSize: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800 }}>Neo Footer</span>
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
  const [savedThemes, setSavedThemes] = useState<any[]>([]);
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

  useEffect(() => {
    const loadSavedThemes = () => {
      try {
        const key = `webnirmaan_saved_themes_${selectedSiteId || siteDefinition?.id || ""}`;
        const cached = localStorage.getItem(key);
        setSavedThemes(cached ? JSON.parse(cached) : []);
      } catch {
        setSavedThemes([]);
      }
    };
    loadSavedThemes();

    window.addEventListener("webnirmaan_theme_saved", loadSavedThemes);
    return () => {
      window.removeEventListener("webnirmaan_theme_saved", loadSavedThemes);
    };
  }, [selectedSiteId, siteDefinition]);

  const handleDeleteSavedTheme = (id: string) => {
    const key = `webnirmaan_saved_themes_${selectedSiteId || siteDefinition?.id || ""}`;
    const updated = savedThemes.filter((t) => t.id !== id);
    setSavedThemes(updated);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  };

  const handleApplySavedTheme = (themeObj: any) => {
    if (!siteDefinition || !onSiteDefinitionChange) return;
    const patchProps = themeObj.patch || themeObj.theme || themeObj;
    const updatedDef = updateThemeValues(siteDefinition, patchProps, true);
    onSiteDefinitionChange(updatedDef);
  };

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
                          title={`Delete ${brandName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteSiteModal({
                              siteId: site.id,
                              brandName,
                            });
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
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
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
                { id: "navbar", label: "Navbar" },
                { id: "banner", label: "Banner" },
                { id: "products", label: "Products" },
                { id: "footer", label: "Footer" },
                { id: "saved_themes", label: `Saved Themes 📁 (${savedThemes.length})` },
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

            {/* Render Saved Themes Category when selected */}
            {selectedAssetCategory === "saved_themes" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {savedThemes.length === 0 ? (
                  <div style={{ padding: "30px 10px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "#64748b" }}>No Saved Themes Yet</p>
                    <p style={{ margin: "4px 0 0", fontSize: "11px" }}>
                      Click "Save 💾" on any theme card in Co-Pilot chat to collect custom theme presets here!
                    </p>
                  </div>
                ) : (
                  savedThemes.map((st) => (
                    <div
                      key={st.id}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 2px 6px rgba(15,23,42,0.03)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>{st.name}</div>
                        <span style={{ fontSize: "9px", color: "#94a3b8" }}>Saved {st.savedAt}</span>
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>Draft theme preset saved from Co-Pilot sidepanel</div>
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                        <button
                          type="button"
                          onClick={() => handleApplySavedTheme(st.theme)}
                          style={{
                            flex: 1,
                            padding: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Apply Draft Theme ✨
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedTheme(st.id)}
                          style={{
                            padding: "6px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#ef4444",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Delete 🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

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
        ) : activeDrawer === "chat" ? (
          <AdminCopilotChat
            siteId={selectedSiteId || siteDefinition?.id || ""}
            siteDefinition={siteDefinition}
            onSiteDefinitionChange={onSiteDefinitionChange}
          />
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
