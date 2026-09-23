import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AccessDeniedView } from "./AccessDeniedView";
import { GlassToast } from "./GlassToast";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type DnsRecord = {
  type: "CNAME" | "TXT";
  name: string;
  value: string;
  purpose: string;
  ttl: number;
  required: boolean;
};

export type DnsInstructions = {
  domain: string;
  routing_target: string;
  records: DnsRecord[];
};

export type CustomDomainItem = {
  id: string;
  site_id: string;
  domain: string;
  is_primary: boolean;
  domain_type: "custom_subdomain" | "custom_www";
  status: "dns_required" | "connected" | "routing_unknown" | "disconnecting" | "disconnected" | "deactivated" | "inactive";
  ssl_status: "ssl_pending" | "ssl_active" | "ssl_failed";
  dns_record_type: string;
  dns_record_name: string;
  dns_record_value: string;
  verification_token: string;
  last_verified_at: string | null;
  error_message: string | null;
  created_at: string | null;
  dns_instructions?: DnsInstructions;
};

export type SiteDomainOverviewItem = {
  site_id: string;
  site_name: string;
  slug: string;
  plan?: string;
  subscription_status?: string;
  custom_domain_allowed?: boolean;
  is_published: boolean;
  webcreon_url: string;
  custom_domains_count: number;
  primary_domain: CustomDomainItem | null;
  health_status: "connected" | "dns_required" | "ssl_pending" | "subdomain_only" | "attention_needed";
  domains: CustomDomainItem[];
  updated_at: string | null;
};

// ---------------------------------------------------------------------------
// COLOR PALETTES FOR AVATARS (IDENTICAL TO BILLING)
// ---------------------------------------------------------------------------

const AVATAR_PALETTES = [
  { bg: "#eff6ff", color: "#2563eb" }, // Blue
  { bg: "#eef2ff", color: "#4f46e5" }, // Indigo
  { bg: "#fff1f2", color: "#e11d48" }, // Rose
  { bg: "#ecfdf5", color: "#059669" }, // Emerald
  { bg: "#faf5ff", color: "#9333ea" }, // Purple
  { bg: "#fffbeb", color: "#d97706" }, // Amber
  { bg: "#f0fdfa", color: "#0d9488" }, // Teal
  { bg: "#fdf4ff", color: "#c026d3" }, // Fuchsia
];

function getAvatarPalette(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

// ---------------------------------------------------------------------------
// ICONS
// ---------------------------------------------------------------------------

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const RefreshIcon = ({ spin }: { spin?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: spin ? "spin 1s linear infinite" : "none" }}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export function AdminDomainSettings({ siteId: propSiteId }: { siteId?: string } = {}) {
  const { siteId: paramSiteId } = useParams<{ siteId?: string }>();
  const storedActiveSiteId = typeof window !== "undefined" ? (localStorage.getItem("last_active_site_id") || sessionStorage.getItem("last_active_site_id")) : null;
  const effectiveSiteId = propSiteId || paramSiteId || storedActiveSiteId || null;

  const { hasPermission, isOwner } = useAdminAuth();
  const canView = isOwner || hasPermission("domain_settings:view");
  const canEdit = isOwner || hasPermission("domain_settings:edit");

  // Primary Data State
  const [stores, setStores] = useState<SiteDomainOverviewItem[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(effectiveSiteId || null);
  const [platformBaseDomain, setPlatformBaseDomain] = useState<string>("webcreon.in");
  const [routingTarget, setRoutingTarget] = useState<string>("cname.webcreon.in");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Search & Filter State for Overview Mode
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  // In-Page Form & Action States
  const [subdomainInput, setSubdomainInput] = useState<string>("");
  const [customDomainInput, setCustomDomainInput] = useState<string>("");
  const [subdomainSubmitting, setSubdomainSubmitting] = useState<boolean>(false);
  const [customDomainSubmitting, setCustomDomainSubmitting] = useState<boolean>(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState<boolean>(false);

  // Helper: Format human-readable site name
  const formatSiteName = (name: string) => {
    if (!name) return "Store";
    const clean = name.replace(/-\d{10,}$/, "").replace(/[-_]/g, " ").trim();
    return clean ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : name;
  };

  // Close filter popover on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Fetch Domain Overview Data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/domains/overview`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load domain records.");
      const data = await res.json();
      const loadedStores: SiteDomainOverviewItem[] = data.stores || [];
      setStores(loadedStores);
      if (data.platform_base_domain) setPlatformBaseDomain(data.platform_base_domain);
      if (data.custom_domain_routing_target) setRoutingTarget(data.custom_domain_routing_target);

      // Keep selected site in sync
      if (effectiveSiteId && loadedStores.some((s) => s.site_id === effectiveSiteId)) {
        setSelectedSiteId(effectiveSiteId);
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load domains", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveSiteId]);

  useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [canView, fetchData]);

  // Active Store Object
  const activeStore = useMemo(() => {
    if (!selectedSiteId) return null;
    return stores.find((s) => s.site_id === selectedSiteId) || null;
  }, [stores, selectedSiteId]);

  // Synchronize input fields when active store changes
  useEffect(() => {
    if (activeStore) {
      setSubdomainInput(activeStore.slug || "");
      if (activeStore.domains && activeStore.domains.length > 0) {
        setCustomDomainInput(activeStore.domains[0].domain);
      } else {
        setCustomDomainInput("");
      }
    }
  }, [activeStore]);

  // Active custom domain object for the current store
  const activeCustomDomain = useMemo(() => {
    if (!activeStore || !activeStore.domains || activeStore.domains.length === 0) return null;
    return activeStore.domains[0];
  }, [activeStore]);

  // Plan permissions for active store
  const isCustomDomainAllowed = useMemo(() => {
    if (!activeStore) return false;
    const plan = (activeStore.plan || "").toUpperCase().trim();
    return activeStore.custom_domain_allowed === true || plan === "STARTER" || plan === "PRO";
  }, [activeStore]);

  // Real-time custom domain validation
  const customDomainAnalysis = useMemo(() => {
    const raw = customDomainInput.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    if (!raw) return { clean: "", isApex: false, isValid: true, isNew: false };

    const parts = raw.split(".");
    let isApex = false;
    if (parts.length === 2 && parts[0] && parts[1]) {
      isApex = true;
    } else if (parts.length === 3 && ["co", "com", "org", "net"].includes(parts[1])) {
      isApex = true;
    }
    const isValid = raw.length >= 4 && parts.length >= 2 && !isApex;
    const isNew = !activeCustomDomain || activeCustomDomain.domain !== raw;
    return { clean: raw, isApex, isValid, isNew };
  }, [customDomainInput, activeCustomDomain]);

  // Copy helper
  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    setToast({ message: `${label} copied!`, type: "info" });
  };

  // 1. Handle Subdomain Update
  const handleSaveSubdomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !canEdit) return;
    const cleanSlug = subdomainInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!cleanSlug || cleanSlug === activeStore.slug) return;

    setSubdomainSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${activeStore.site_id}/change-slug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_slug: cleanSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update subdomain.");

      setToast({ message: `Subdomain updated to ${cleanSlug}.${platformBaseDomain}`, type: "success" });
      await fetchData(true);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to save subdomain", type: "error" });
    } finally {
      setSubdomainSubmitting(false);
    }
  };

  // 2. Handle Custom Domain Connect
  const handleConnectCustomDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !canEdit || !isCustomDomainAllowed) return;
    if (!customDomainAnalysis.clean || !customDomainAnalysis.isValid) return;

    setCustomDomainSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${activeStore.site_id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain: customDomainAnalysis.clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail?.message || data.detail || "Failed to connect custom domain.");

      setToast({ message: `Domain '${customDomainAnalysis.clean}' registered! Please verify DNS records.`, type: "success" });
      await fetchData(true);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to connect custom domain", type: "error" });
    } finally {
      setCustomDomainSubmitting(false);
    }
  };

  // 3. Verify DNS Records
  const handleVerifyDns = async (customDom: CustomDomainItem) => {
    if (!activeStore || !canEdit) return;
    setVerifyingId(customDom.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${activeStore.site_id}/domains/${customDom.id}/verify`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "DNS verification failed.");

      if (data.verified) {
        setToast({ message: "DNS Verified! Domain is connected and SSL TLS 1.3 is active.", type: "success" });
      } else {
        setToast({ message: data.error_message || "DNS check did not pass yet. Please ensure CNAME is propagated.", type: "error" });
      }
      await fetchData(true);
    } catch (err: any) {
      setToast({ message: err.message || "DNS check failed", type: "error" });
    } finally {
      setVerifyingId(null);
    }
  };

  // 4. Set Domain as Primary
  const handleSetPrimary = async (customDom: CustomDomainItem) => {
    if (!activeStore || !canEdit) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${activeStore.site_id}/domains/${customDom.id}/primary`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to set primary domain.");

      setToast({ message: `'${data.domain}' is now the primary storefront URL!`, type: "success" });
      await fetchData(true);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to set primary domain", type: "error" });
    }
  };

  // 5. Disconnect Custom Domain
  const handleDisconnectDomain = async () => {
    if (!activeStore || !activeCustomDomain || !canEdit) return;
    setCustomDomainSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${activeStore.site_id}/domains/${activeCustomDomain.id}?purge=true`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to disconnect domain.");

      setToast({ message: `Domain '${activeCustomDomain.domain}' disconnected.`, type: "success" });
      setDisconnectConfirmOpen(false);
      setCustomDomainInput("");
      await fetchData(true);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to disconnect domain", type: "error" });
    } finally {
      setCustomDomainSubmitting(false);
    }
  };

  // Filtered Stores for Overview List
  const filteredStores = useMemo(() => {
    let list = [...stores];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const matchName = formatSiteName(s.site_name).toLowerCase().includes(q);
        const matchSlug = s.slug.toLowerCase().includes(q);
        const matchDomain = s.domains?.some((d) => d.domain.toLowerCase().includes(q));
        return matchName || matchSlug || matchDomain;
      });
    }
    if (planFilter !== "all") {
      list = list.filter((s) => (s.plan || "FREE").toUpperCase() === planFilter);
    }
    return list;
  }, [stores, searchQuery, planFilter]);

  const activeFilterCount = (searchQuery ? 1 : 0) + (planFilter !== "all" ? 1 : 0);

  if (!canView) {
    return <AccessDeniedView moduleName="Domain & URLs" requiredPermission="domain_settings:view" />;
  }

  // Active Store Display Properties
  const activeCleanName = activeStore ? formatSiteName(activeStore.site_name) : "";
  const activePalette = getAvatarPalette(activeCleanName);
  const activeInitial = activeCleanName ? activeCleanName[0].toUpperCase() : "S";
  const primaryLiveUrl = activeCustomDomain && activeCustomDomain.status === "connected" && activeStore?.custom_domain_allowed
    ? `https://${activeCustomDomain.domain}`
    : `https://${activeStore?.slug}.${platformBaseDomain}`;

  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .wc-store-card { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .wc-store-card:hover { border-color: #93c5fd !important; box-shadow: 0 6px 16px rgba(37,99,235,0.08) !important; transform: translateY(-2px); }
        .wc-input-focus:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important; }
        .wc-code-box { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      `}</style>

      {/* Toast Notification */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR / HEADER CARD (MATCHING BILLING & PLANS EXACTLY)             */}
      {/* ========================================================================= */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "8px 12px",
          marginBottom: "12px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill: "Domains & URLs" */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                borderRadius: "6px",
                padding: "6px 16px",
                background: "#ffffff",
                color: "#0f172a",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                fontSize: "13px",
                fontWeight: 700,
                display: "inline-block",
                userSelect: "none",
              }}
            >
              Domains & URLs
            </span>
          </div>

          {/* Search Bar & Filter Toggle (Visible ONLY in Overview Mode) */}
          {!selectedSiteId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {/* Search Input */}
              <div style={{ position: "relative", width: "240px" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stores or domains..."
                  className="wc-input-focus"
                  style={{
                    width: "100%",
                    padding: "7px 28px 7px 32px",
                    fontSize: "12.5px",
                    borderRadius: "7px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}
                  >
                    <XMarkIcon />
                  </button>
                )}
              </div>

              {/* Filter Button */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "34px",
                    padding: "0 12px",
                    borderRadius: "7px",
                    border: activeFilterCount > 0 ? "1px solid #93c5fd" : "1px solid #cbd5e1",
                    background: activeFilterCount > 0 ? "#eff6ff" : "#ffffff",
                    color: activeFilterCount > 0 ? "#1d4ed8" : "#334155",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <FilterIcon />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        background: "#2563eb",
                        color: "#ffffff",
                        borderRadius: "10px",
                        padding: "0 6px",
                        marginLeft: "2px",
                      }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Filter Popover */}
                {isFilterOpen && (
                  <div
                    ref={filterPopoverRef}
                    style={{
                      position: "absolute",
                      top: "42px",
                      right: 0,
                      width: "220px",
                      background: "#ffffff",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                      padding: "14px",
                      zIndex: 100,
                    }}
                  >
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Plan Tier
                    </label>
                    <select
                      value={planFilter}
                      onChange={(e) => {
                        setPlanFilter(e.target.value);
                        setIsFilterOpen(false);
                      }}
                      style={{
                        width: "100%",
                        height: "32px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12.5px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      <option value="all">All Plans</option>
                      <option value="FREE">Free Tier</option>
                      <option value="STARTER">Starter Tier</option>
                      <option value="PRO">Growth Pro Tier</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter Chips Bar */}
        {!selectedSiteId && activeFilterCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingTop: "4px", borderTop: "1px solid #f1f5f9" }}>
            {searchQuery && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                <span>Search: "{searchQuery}"</span>
                <button type="button" onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}>
                  <XMarkIcon />
                </button>
              </span>
            )}
            {planFilter !== "all" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                <span>Plan: {planFilter}</span>
                <button type="button" onClick={() => setPlanFilter("all")} style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}>
                  <XMarkIcon />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPlanFilter("all");
              }}
              style={{ background: "none", border: "none", color: "#dc2626", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", marginLeft: "4px" }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT VIEW                                                      */}
      {/* ========================================================================= */}
      {loading ? (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "48px 20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
          <RefreshIcon spin />
          <div style={{ marginTop: "8px" }}>Loading domain settings...</div>
        </div>
      ) : selectedSiteId && activeStore ? (
        /* ----------------------------------------------------------------------- */
        /* VIEW A: DIRECT STORE DOMAIN CONFIGURATION                               */
        /* ----------------------------------------------------------------------- */
        <div>
          {/* Back button below navbar (Identical to Billing & Plans) */}
          {!effectiveSiteId && (
            <button
              type="button"
              onClick={() => setSelectedSiteId(null)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                color: "#1e293b",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0 0 10px 0",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#1e293b";
              }}
            >
              <ChevronLeftIcon /> Back to All Stores
            </button>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* TOP STORE BANNER CARD (Identical to Billing Top Store Card) */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                padding: "12px 18px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: activePalette.bg,
                    color: activePalette.color,
                    fontSize: "16px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {activeInitial}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                      {activeCleanName}
                    </h2>
                    {activeCustomDomain && activeCustomDomain.is_primary && (
                      <span title="Primary Custom Domain Active" style={{ display: "inline-flex", alignItems: "center" }}>
                        <StarIcon />
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "3px" }}>
                    <a
                      href={primaryLiveUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "12px",
                        fontFamily: "monospace",
                        color: "#2563eb",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>{primaryLiveUrl.replace("https://", "")}</span>
                      <ExternalLinkIcon />
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: "6px",
                    background: (activeStore.plan || "").toUpperCase() === "PRO" ? "#f3e8ff" : (activeStore.plan || "").toUpperCase() === "STARTER" ? "#eff6ff" : "#f1f5f9",
                    color: (activeStore.plan || "").toUpperCase() === "PRO" ? "#7e22ce" : (activeStore.plan || "").toUpperCase() === "STARTER" ? "#1d4ed8" : "#475569",
                    border: `1px solid ${(activeStore.plan || "").toUpperCase() === "PRO" ? "#d8b4fe" : (activeStore.plan || "").toUpperCase() === "STARTER" ? "#bfdbfe" : "#cbd5e1"}`,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {activeStore.plan || "FREE"} TIER
                </span>

                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: "12px",
                    background: activeStore.is_published ? "#ecfdf5" : "#f8fafc",
                    color: activeStore.is_published ? "#059669" : "#64748b",
                    border: `1px solid ${activeStore.is_published ? "#a7f3d0" : "#e2e8f0"}`,
                  }}
                >
                  {activeStore.is_published ? "● Published" : "○ Draft"}
                </span>
              </div>
            </div>

            {/* CARD 1: WEBCREON SUBDOMAIN */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "18px 20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                    1. Webcreon Subdomain
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    Built-in permanent storefront web address with automated SSL encryption.
                  </p>
                </div>

                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "3px 9px", borderRadius: "12px", border: "1px solid #a7f3d0" }}>
                  <ShieldCheckIcon />
                  <span>SSL Active</span>
                </span>
              </div>

              <form onSubmit={handleSaveSubdomain} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                    Store Subdomain Prefix
                  </label>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", borderRadius: "7px", border: "1px solid #cbd5e1", overflow: "hidden", background: "#ffffff", maxWidth: "520px" }}>
                    <div style={{ padding: "0 10px", color: "#94a3b8", display: "grid", placeItems: "center" }}>
                      <GlobeIcon />
                    </div>
                    <input
                      type="text"
                      value={subdomainInput}
                      onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="your-brand-slug"
                      className="wc-input-focus"
                      disabled={!canEdit || subdomainSubmitting}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "8px 4px",
                        border: "none",
                        outline: "none",
                        fontSize: "13.5px",
                        fontFamily: "monospace",
                        color: "#0f172a",
                      }}
                    />
                    <span style={{ padding: "8px 12px", background: "#f8fafc", color: "#64748b", fontSize: "13px", fontWeight: 600, borderLeft: "1px solid #cbd5e1", userSelect: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                      .{platformBaseDomain}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    🛡️ Previous slugs remain protected for 90 days to prevent domain hijacking.
                  </span>
                  {canEdit && subdomainInput.trim() !== activeStore.slug && (
                    <button
                      type="submit"
                      disabled={subdomainSubmitting || !subdomainInput.trim()}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "6px",
                        background: "#2563eb",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: subdomainSubmitting ? "not-allowed" : "pointer",
                        boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                      }}
                    >
                      {subdomainSubmitting ? "Saving..." : "Save Subdomain"}
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* CARD 2: CUSTOM DOMAIN */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "18px 20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                    2. Custom Domain
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    Connect your custom brand domain (such as shop.yourbrand.com or www.yourbrand.com).
                  </p>
                </div>

                {activeCustomDomain && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: "12px",
                      background: activeCustomDomain.status === "connected" ? "#ecfdf5" : activeCustomDomain.status === "inactive" ? "#fee2e2" : "#fef3c7",
                      color: activeCustomDomain.status === "connected" ? "#059669" : activeCustomDomain.status === "inactive" ? "#dc2626" : "#b45309",
                      border: `1px solid ${activeCustomDomain.status === "connected" ? "#a7f3d0" : activeCustomDomain.status === "inactive" ? "#fca5a5" : "#fde68a"}`,
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: activeCustomDomain.status === "connected" ? "#10b981" : activeCustomDomain.status === "inactive" ? "#ef4444" : "#f59e0b",
                      }}
                    />
                    {activeCustomDomain.status === "connected"
                      ? "Connected"
                      : activeCustomDomain.status === "inactive"
                      ? "Inactive (Free Plan)"
                      : "DNS Verification Required"}
                  </span>
                )}
              </div>

              {/* Free Tier Info */}
              {!isCustomDomainAllowed ? (
                <div style={{ background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "14px 16px" }}>
                  {activeCustomDomain ? (
                    <div style={{ fontSize: "13px", color: "#475569" }}>
                      Linked domain: <strong style={{ color: "#0f172a" }}>{activeCustomDomain.domain}</strong> is inactive while on the Free tier. Store traffic is routed via your Webcreon subdomain.
                    </div>
                  ) : (
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      Custom domain edge routing is available on Starter (₹199/mo) and Pro (₹499/mo) plans. Store traffic is active on your Webcreon subdomain.
                    </div>
                  )}
                </div>
              ) : activeCustomDomain ? (
                /* Custom Domain is Configured (Connected or DNS Pending) */
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Domain Header Strip */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "14.5px", fontWeight: 700, fontFamily: "monospace", color: "#0f172a" }}>
                        {activeCustomDomain.domain}
                      </span>
                      {activeCustomDomain.status === "connected" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#059669" }}>
                          <ShieldCheckIcon />
                          <span>TLS 1.3 Active</span>
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {activeCustomDomain.status === "connected" && !activeCustomDomain.is_primary && canEdit && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(activeCustomDomain)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: "6px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            color: "#334155",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Make Primary
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setDisconnectConfirmOpen(true)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: "6px",
                            background: "#ffffff",
                            border: "1px solid #fee2e2",
                            color: "#dc2626",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DNS Records Table (If DNS Verification Required) */}
                  {activeCustomDomain.status !== "connected" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "2px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                        Add these records in your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
                      </div>

                      <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                              <th style={{ padding: "8px 12px" }}>Type</th>
                              <th style={{ padding: "8px 12px" }}>Name / Host</th>
                              <th style={{ padding: "8px 12px" }}>Value / Points To</th>
                              <th style={{ padding: "8px 12px", textAlign: "right" }}>Copy</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "9px 12px", fontWeight: 700, color: "#2563eb" }}>CNAME</td>
                              <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#0f172a" }}>
                                {activeCustomDomain.domain.split(".")[0]}
                              </td>
                              <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#0f172a" }}>
                                {routingTarget}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => copyText(routingTarget, "CNAME Target")}
                                  style={{ padding: "3px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", cursor: "pointer" }}
                                >
                                  <CopyIcon />
                                </button>
                              </td>
                            </tr>
                            {activeCustomDomain.verification_token && (
                              <tr>
                                <td style={{ padding: "9px 12px", fontWeight: 700, color: "#059669" }}>TXT</td>
                                <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#0f172a" }}>
                                  _webcreon-challenge.{activeCustomDomain.domain.split(".")[0]}
                                </td>
                                <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#0f172a", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {activeCustomDomain.verification_token}
                                </td>
                                <td style={{ padding: "9px 12px", textAlign: "right" }}>
                                  <button
                                    type="button"
                                    onClick={() => copyText(activeCustomDomain.verification_token, "TXT Token")}
                                    style={{ padding: "3px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", cursor: "pointer" }}
                                  >
                                    <CopyIcon />
                                  </button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
                        <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                          DNS propagation may take a few moments. Click verify once your records are added.
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleVerifyDns(activeCustomDomain)}
                            disabled={verifyingId === activeCustomDomain.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "7px 16px",
                              borderRadius: "6px",
                              background: "#2563eb",
                              color: "#ffffff",
                              border: "none",
                              fontSize: "12.5px",
                              fontWeight: 600,
                              cursor: verifyingId === activeCustomDomain.id ? "not-allowed" : "pointer",
                              boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                            }}
                          >
                            <RefreshIcon spin={verifyingId === activeCustomDomain.id} />
                            <span>{verifyingId === activeCustomDomain.id ? "Verifying DNS..." : "Verify DNS Record"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Connect New Custom Domain Input */
                <form onSubmit={handleConnectCustomDomain} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                      Connect a Custom Domain
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "520px" }}>
                      <input
                        type="text"
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value)}
                        placeholder="e.g. shop.yourbrand.com or www.yourbrand.com"
                        className="wc-input-focus"
                        disabled={!canEdit || customDomainSubmitting}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: "7px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13.5px",
                          fontFamily: "monospace",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                      {canEdit && (
                        <button
                          type="submit"
                          disabled={customDomainSubmitting || !customDomainAnalysis.clean || !customDomainAnalysis.isValid || customDomainAnalysis.isApex}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "7px",
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            cursor: customDomainSubmitting || !customDomainAnalysis.clean || customDomainAnalysis.isApex ? "not-allowed" : "pointer",
                            boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                          }}
                        >
                          {customDomainSubmitting ? "Connecting..." : "Connect Domain"}
                        </button>
                      )}
                    </div>
                  </div>

                  {customDomainAnalysis.isApex && (
                    <div style={{ fontSize: "11.5px", color: "#dc2626" }}>
                      Apex root domains (e.g. <code>brand.com</code>) must use a subdomain like <code>www.brand.com</code> or <code>shop.brand.com</code> for CNAME routing.
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ----------------------------------------------------------------------- */
        /* VIEW B: OVERVIEW GRID OF ALL STORES (MATCHING BILLING & PLANS UI)       */
        /* ----------------------------------------------------------------------- */
        <div>
          {filteredStores.length === 0 ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "48px 20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              No stores found matching your filters.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: "14px",
              }}
            >
              {filteredStores.map((s) => {
                const cleanName = formatSiteName(s.site_name);
                const palette = getAvatarPalette(cleanName);
                const initial = cleanName[0].toUpperCase();
                const customDom = s.domains && s.domains.length > 0 ? s.domains[0] : null;

                return (
                  <div
                    key={s.site_id}
                    className="wc-store-card"
                    onClick={() => setSelectedSiteId(s.site_id)}
                    style={{
                      background: "#ffffff",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div>
                      {/* Top: Avatar, Name & Plan Badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              background: palette.bg,
                              color: palette.color,
                              fontSize: "15px",
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>

                          <div>
                            <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                              {cleanName}
                            </div>
                            <div style={{ fontSize: "11.5px", fontFamily: "monospace", color: "#64748b", marginTop: "2px" }}>
                              {s.slug}.{platformBaseDomain}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: (s.plan || "").toUpperCase() === "PRO" ? "#f3e8ff" : (s.plan || "").toUpperCase() === "STARTER" ? "#eff6ff" : "#f1f5f9",
                            color: (s.plan || "").toUpperCase() === "PRO" ? "#7e22ce" : (s.plan || "").toUpperCase() === "STARTER" ? "#1d4ed8" : "#475569",
                            border: `1px solid ${(s.plan || "").toUpperCase() === "PRO" ? "#d8b4fe" : (s.plan || "").toUpperCase() === "STARTER" ? "#bfdbfe" : "#cbd5e1"}`,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          {s.plan || "FREE"}
                        </span>
                      </div>

                      {/* Middle: Domain Details Strip */}
                      <div
                        style={{
                          background: "#f8fafc",
                          borderRadius: "6px",
                          padding: "8px 10px",
                          marginBottom: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12px",
                        }}
                      >
                        <span style={{ color: "#64748b", fontWeight: 500 }}>Custom Domain:</span>
                        <span style={{ fontWeight: 600, color: customDom ? "#0f172a" : "#94a3b8", fontFamily: customDom ? "monospace" : "inherit" }}>
                          {customDom ? customDom.domain : "Not Connected"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom: Status & Chevron */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "6px",
                        borderTop: "1px solid #f8fafc",
                      }}
                    >
                      <div>
                        {customDom ? (
                          customDom.status === "connected" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 700, color: "#059669" }}>
                              <ShieldCheckIcon />
                              <span>Connected & SSL Active</span>
                            </span>
                          ) : customDom.status === "inactive" ? (
                            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#dc2626" }}>Inactive (Free Plan)</span>
                          ) : (
                            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#b45309" }}>DNS Verification Pending</span>
                          )
                        ) : (
                          <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b" }}>Subdomain Live</span>
                        )}
                      </div>

                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: "#eff6ff",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ChevronRightIcon />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CONFIRMATION MODAL: DISCONNECT CUSTOM DOMAIN                           */}
      {/* ========================================================================= */}
      {disconnectConfirmOpen && activeCustomDomain && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(2px)", zIndex: 10001, display: "grid", placeItems: "center", padding: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", maxWidth: "420px", width: "100%", padding: "20px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#dc2626" }}>Disconnect Custom Domain?</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#475569", lineHeight: 1.45 }}>
              Are you sure you want to disconnect <strong>{activeCustomDomain.domain}</strong>? Storefront traffic will immediately fall back to your Webcreon subdomain.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setDisconnectConfirmOpen(false)}
                style={{ padding: "7px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnectDomain}
                disabled={customDomainSubmitting}
                style={{ padding: "7px 16px", borderRadius: "6px", background: "#dc2626", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: customDomainSubmitting ? "not-allowed" : "pointer" }}
              >
                {customDomainSubmitting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDomainSettings;
