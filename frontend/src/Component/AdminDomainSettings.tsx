import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  status: "dns_required" | "connected" | "routing_unknown" | "disconnecting" | "disconnected";
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
  is_published: boolean;
  webcreon_url: string;
  custom_domains_count: number;
  primary_domain: CustomDomainItem | null;
  health_status: "connected" | "dns_required" | "ssl_pending" | "subdomain_only" | "attention_needed";
  domains: CustomDomainItem[];
  updated_at: string | null;
};

// Unified row item for the domain table
export type UnifiedDomainRow = {
  row_id: string;
  site_id: string;
  site_name: string;
  site_slug: string;
  domain: string;
  domain_type: "custom_domain" | "subdomain";
  is_primary: boolean;
  status: "connected" | "dns_required" | "routing_unknown" | "active";
  ssl_status: "ssl_active" | "ssl_pending" | "ssl_failed";
  custom_domain_obj?: CustomDomainItem;
  url: string;
};

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
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const RefreshIcon = ({ spin }: { spin?: boolean }) => (
  <svg
    width="13"
    height="13"
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
  const { hasPermission, isOwner } = useAdminAuth();
  const canView = isOwner || hasPermission("domain_settings:view");
  const canEdit = isOwner || hasPermission("domain_settings:edit");

  // Primary Data
  const [stores, setStores] = useState<SiteDomainOverviewItem[]>([]);
  const [platformBaseDomain, setPlatformBaseDomain] = useState<string>("webcreon.in");
  const [routingTarget, setRoutingTarget] = useState<string>("cname.webcreon.in");
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  // Helper: Format human-readable site name
  const formatSiteName = (name: string) => {
    if (!name) return "Store";
    const clean = name.replace(/-\d{10,}$/, "").replace(/[-_]/g, " ").trim();
    return clean ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : name;
  };

  // Unified Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalStoreId, setModalStoreId] = useState<string>("");
  const [subdomainInput, setSubdomainInput] = useState<string>("");
  const [customDomainInput, setCustomDomainInput] = useState<string>("");
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState<boolean>(false);

  // Active store currently being configured inside the unified modal
  const modalActiveStore = useMemo(() => {
    return stores.find((s) => s.site_id === modalStoreId) || stores[0] || null;
  }, [stores, modalStoreId]);

  const activeCustomDomain = useMemo(() => {
    if (!modalActiveStore) return null;
    return modalActiveStore.domains && modalActiveStore.domains.length > 0
      ? modalActiveStore.domains[0]
      : null;
  }, [modalActiveStore]);

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

  // Fetch domain overview data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/domains/overview`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load domain records.");
      const data = await res.json();
      setStores(data.stores || []);
      if (data.platform_base_domain) setPlatformBaseDomain(data.platform_base_domain);
      if (data.custom_domain_routing_target) setRoutingTarget(data.custom_domain_routing_target);
      if (data.stores && data.stores.length > 0 && !modalStoreId) {
        setModalStoreId(propSiteId || data.stores[0].site_id);
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to load domains", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [propSiteId, modalStoreId]);

  useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [canView, fetchData]);

  // Build unified rows: Every store has 1 default subdomain + N custom domains
  const allRows: UnifiedDomainRow[] = useMemo(() => {
    const rows: UnifiedDomainRow[] = [];
    for (const s of stores) {
      // 1. Custom Domains
      if (s.domains && s.domains.length > 0) {
        for (const cd of s.domains) {
          rows.push({
            row_id: `cd_${cd.id}`,
            site_id: s.site_id,
            site_name: s.site_name,
            site_slug: s.slug,
            domain: cd.domain,
            domain_type: "custom_domain",
            is_primary: cd.is_primary,
            status: cd.status as any,
            ssl_status: cd.ssl_status as any,
            custom_domain_obj: cd,
            url: `https://${cd.domain}`,
          });
        }
      }

      // 2. Webcreon Subdomain
      const subUrl = `https://${s.slug}.${platformBaseDomain}`;
      const isSubPrimary = !s.primary_domain;
      rows.push({
        row_id: `sub_${s.site_id}`,
        site_id: s.site_id,
        site_name: s.site_name,
        site_slug: s.slug,
        domain: `${s.slug}.${platformBaseDomain}`,
        domain_type: "subdomain",
        is_primary: isSubPrimary,
        status: "active",
        ssl_status: "ssl_active",
        url: subUrl,
      });
    }
    return rows;
  }, [stores, platformBaseDomain]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      // Store filter
      if (storeFilter !== "all" && r.site_id !== storeFilter) {
        return false;
      }

      // Type filter
      if (typeFilter === "custom" && r.domain_type !== "custom_domain") {
        return false;
      }
      if (typeFilter === "subdomain" && r.domain_type !== "subdomain") {
        return false;
      }

      // Status filter
      if (statusFilter === "connected") {
        if (r.status !== "connected" && r.status !== "active") return false;
      } else if (statusFilter === "dns_required") {
        if (r.domain_type !== "custom_domain" || r.status !== "dns_required") return false;
      } else if (statusFilter === "ssl_pending") {
        if (r.domain_type !== "custom_domain" || r.ssl_status !== "ssl_pending") return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDomain = r.domain.toLowerCase().includes(q);
        const matchStore = formatSiteName(r.site_name).toLowerCase().includes(q) || r.site_slug.toLowerCase().includes(q);
        if (!matchDomain && !matchStore) return false;
      }

      return true;
    });
  }, [allRows, storeFilter, typeFilter, statusFilter, searchQuery]);

  const activeFilterCount =
    (storeFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  // Copy helper
  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    setToast({ message: `${label} copied!`, type: "info" });
  };

  // Open unified configuration modal for a given store
  const openConfigureModal = (targetSiteId: string) => {
    const st = stores.find((s) => s.site_id === targetSiteId);
    if (!st) return;
    setModalStoreId(st.site_id);
    setSubdomainInput(st.slug || "");
    setCustomDomainInput(st.domains && st.domains.length > 0 ? st.domains[0].domain : "");
    setIsModalOpen(true);
  };

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

  // Handle Unified Form Submission
  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalActiveStore || !canEdit) return;

    setFormSubmitting(true);
    try {
      let madeChanges = false;

      // 1. Subdomain Change Check
      const cleanSlug = subdomainInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (cleanSlug && cleanSlug !== modalActiveStore.slug) {
        const res = await fetch(`${API_BASE_URL}/api/sites/${modalActiveStore.site_id}/change-slug`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ new_slug: cleanSlug }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to update subdomain.");
        madeChanges = true;
      }

      // 2. Custom Domain Add Check
      if (customDomainAnalysis.clean && customDomainAnalysis.isValid && customDomainAnalysis.isNew) {
        const res = await fetch(`${API_BASE_URL}/api/sites/${modalActiveStore.site_id}/domains`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ domain: customDomainAnalysis.clean }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to connect custom domain.");
        madeChanges = true;
      }

      if (madeChanges) {
        setToast({ message: "Storefront domain configuration saved successfully!", type: "success" });
      } else {
        setToast({ message: "No configuration changes detected.", type: "info" });
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to save configuration", type: "error" });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Verify DNS in-modal
  const handleVerifyDns = async (customDom: CustomDomainItem) => {
    if (!modalActiveStore || !canEdit) return;
    setVerifyingId(customDom.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${modalActiveStore.site_id}/domains/${customDom.id}/verify`, {
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
      await fetchData();
    } catch (err: any) {
      setToast({ message: err.message || "DNS check failed", type: "error" });
    } finally {
      setVerifyingId(null);
    }
  };

  // Make Primary in-modal
  const handleSetPrimary = async (customDom: CustomDomainItem) => {
    if (!modalActiveStore || !canEdit) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${modalActiveStore.site_id}/domains/${customDom.id}/primary`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to set primary domain.");

      setToast({ message: `'${data.domain}' is now the primary storefront URL!`, type: "success" });
      await fetchData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to set primary domain", type: "error" });
    }
  };

  // Disconnect Custom Domain
  const handleDisconnectDomain = async () => {
    if (!modalActiveStore || !activeCustomDomain || !canEdit) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sites/${modalActiveStore.site_id}/domains/${activeCustomDomain.id}?purge=true`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to disconnect domain.");

      setToast({ message: `Domain '${activeCustomDomain.domain}' disconnected.`, type: "success" });
      setDisconnectConfirmOpen(false);
      setCustomDomainInput("");
      await fetchData();
    } catch (err: any) {
      setToast({ message: err.message || "Failed to disconnect domain", type: "error" });
    } finally {
      setFormSubmitting(false);
    }
  };

  if (!canView) {
    return <AccessDeniedView moduleName="Domain & URLs" requiredPermission="domain_settings:view" />;
  }

  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .wc-tr-hover:hover { background: #f8fafc; }
        .wc-input-focus:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important; }
      `}</style>

      {/* Toast Notification */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR / HEADER CARD                                               */}
      {/* ========================================================================= */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative",
        }}
      >
        {/* Row 1: Mode Pill + Global Search + Filter Button (Clean Navbar without separate Connect button) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill (Domains) */}
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

          {/* Search Bar & Filter Toggle */}
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
                placeholder="Search domains or stores..."
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: searchQuery ? "28px" : "12px",
                  fontSize: "13px",
                  height: "36px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: "2px",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title="Clear search"
                >
                  <XMarkIcon />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "7px",
                  border: activeFilterCount > 0 ? "1px solid #93c5fd" : "1px solid #cbd5e1",
                  background: activeFilterCount > 0 ? "#eff6ff" : "#ffffff",
                  color: activeFilterCount > 0 ? "#1d4ed8" : "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
                title="Toggle Filters"
              >
                <FilterIcon />
                <span>Filters</span>
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

              {/* Floating Filter Popover Modal */}
              {isFilterOpen && (
                <div
                  ref={filterPopoverRef}
                  style={{
                    position: "absolute",
                    top: "44px",
                    right: "0",
                    width: "280px",
                    background: "#ffffff",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                    padding: "16px",
                    zIndex: 100,
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {/* Website Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Website / Store
                    </label>
                    <select
                      value={storeFilter}
                      onChange={(e) => setStoreFilter(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      <option value="all">All Websites ({stores.length})</option>
                      {stores.map((s) => (
                        <option key={s.site_id} value={s.site_id}>
                          {formatSiteName(s.site_name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Domain Type Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Domain Type
                    </label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      <option value="all">All Types</option>
                      <option value="custom">Custom Domains Only</option>
                      <option value="subdomain">Webcreon Subdomains Only</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="connected">Connected</option>
                      <option value="dns_required">DNS Pending</option>
                      <option value="ssl_pending">SSL Provisioning</option>
                    </select>
                  </div>

                  {/* Reset & Done Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setStoreFilter("all");
                        setTypeFilter("all");
                        setStatusFilter("all");
                      }}
                      style={{ background: "none", border: "none", color: "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      style={{ background: "#2563eb", border: "none", color: "#ffffff", fontSize: "12.5px", fontWeight: 600, padding: "5px 12px", borderRadius: "6px", cursor: "pointer" }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Active Filter Chips Bar */}
        {(storeFilter !== "all" || typeFilter !== "all" || statusFilter !== "all" || searchQuery) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              paddingTop: "6px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, marginRight: "2px" }}>
              Active:
            </span>

            {searchQuery && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Search: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {storeFilter !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Store: {formatSiteName(stores.find((s) => s.site_id === storeFilter)?.site_name || storeFilter)}</span>
                <button
                  type="button"
                  onClick={() => setStoreFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {typeFilter !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Type: {typeFilter === "custom" ? "Custom Domain" : "Subdomain"}</span>
                <button
                  type="button"
                  onClick={() => setTypeFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {statusFilter !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Status: {statusFilter.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStoreFilter("all");
                setTypeFilter("all");
                setStatusFilter("all");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                fontSize: "11.5px",
                fontWeight: 600,
                cursor: "pointer",
                marginLeft: "4px",
              }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. UNIFIED CLEAN DOMAIN TABLE (Fully Responsive, Clean & Non-Cluttered)   */}
      {/* ========================================================================= */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
            <RefreshIcon spin />
            <div style={{ marginTop: "8px" }}>Loading domain records...</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
            No domain records found matching your filters.
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "620px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "12px 18px" }}>Storefront</th>
                  <th style={{ padding: "12px 16px" }}>Type</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>SSL</th>
                  <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.row_id} style={{ borderBottom: "1px solid #f1f5f9" }} className="wc-tr-hover">
                    {/* Storefront Name with Primary badge */}
                    <td style={{ padding: "13px 18px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "13.5px" }}>
                          {formatSiteName(row.site_name)}
                        </div>
                        {row.is_primary && (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#0f172a", color: "#ffffff" }}>
                            ★ PRIMARY
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Domain Type */}
                    <td style={{ padding: "13px 16px" }}>
                      {row.domain_type === "custom_domain" ? (
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                          Custom Domain
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
                          Webcreon Subdomain
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "13px 16px" }}>
                      {row.status === "connected" || row.status === "active" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                          Connected
                        </span>
                      ) : row.status === "dns_required" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />
                          DNS Pending
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                          <RefreshIcon spin />
                          Configuring
                        </span>
                      )}
                    </td>

                    {/* SSL */}
                    <td style={{ padding: "13px 16px" }}>
                      {row.ssl_status === "ssl_active" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#059669" }}>
                          <ShieldCheckIcon />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "#2563eb" }}>
                          <RefreshIcon spin />
                          <span>Provisioning</span>
                        </span>
                      )}
                    </td>

                    {/* Actions: Copy URL, Open Live Link & Configure */}
                    <td style={{ padding: "13px 18px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {/* Copy link */}
                        <button
                          type="button"
                          onClick={() => copyText(row.url, `${row.domain_type === "custom_domain" ? "Custom Domain" : "Subdomain"} URL`)}
                          title={`Copy ${row.url}`}
                          style={{
                            padding: "6px 8px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#475569",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <CopyIcon />
                        </button>

                        {/* Visit link */}
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Visit Live Storefront"
                          style={{
                            padding: "6px 8px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#475569",
                            textDecoration: "none",
                            display: "grid",
                            placeItems: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <ExternalLinkIcon />
                        </a>

                        {/* Configure Button */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openConfigureModal(row.site_id)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: "6px",
                              background: row.status === "dns_required" ? "#2563eb" : "#ffffff",
                              color: row.status === "dns_required" ? "#ffffff" : "#0f172a",
                              border: row.status === "dns_required" ? "none" : "1px solid #cbd5e1",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: row.status === "dns_required" ? "0 1px 2px rgba(37,99,235,0.2)" : "none",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {row.status === "dns_required" ? "DNS Setup" : "Configure"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIFIED DOMAIN & STOREFRONT URL MODAL (Industrial Card Grid Form)      */}
      {/* ========================================================================= */}
      {isModalOpen && modalActiveStore && (
        <div
          style={{
            position: "fixed",
            top: "64px", // Top gap to prevent overlapping the top admin header panel
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 1000,
            overflowY: "auto",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px 48px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "840px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
              border: "1px solid #cbd5e1",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Modal Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div style={{ color: "#2563eb", display: "grid", placeItems: "center" }}>
                  <GlobeIcon />
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    color: "#0f172a",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Configure Domains & URLs: {formatSiteName(modalActiveStore.site_name)}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "4px",
                  lineHeight: 1,
                  display: "grid",
                  placeItems: "center",
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveConfiguration} style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "18px 20px",
                  background: "#f8fafc",
                }}
              >
                {/* Card 1: Store Information (Fixed / Non-changeable) */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Target Website / Store
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                      {formatSiteName(modalActiveStore.site_name)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
                      Store ID: {modalActiveStore.site_id.slice(0, 8)}...
                    </span>
                    {modalActiveStore.is_published ? (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        ● Published
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "12px", background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
                        ○ Draft
                      </span>
                    )}
                  </div>
                </div>

                {/* Card 2: Webcreon Storefront Subdomain */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#0f172a",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>1. Webcreon Subdomain</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#059669", textTransform: "none", letterSpacing: "normal" }}>
                      ● Always Active & Protected
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                      Store Subdomain Prefix
                    </label>
                    <div style={{ display: "flex", alignItems: "center", borderRadius: "6px", border: "1px solid #cbd5e1", overflow: "hidden", background: "#ffffff" }}>
                      <input
                        type="text"
                        value={subdomainInput}
                        onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="your-brand-slug"
                        className="wc-input-focus"
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          border: "none",
                          outline: "none",
                          fontSize: "13.5px",
                          fontFamily: "monospace",
                          color: "#0f172a",
                        }}
                      />
                      <span style={{ padding: "8px 12px", background: "#f1f5f9", color: "#64748b", fontSize: "13px", fontWeight: 600, borderLeft: "1px solid #cbd5e1", userSelect: "none" }}>
                        .{platformBaseDomain}
                      </span>
                    </div>
                  </div>

                  {/* 90-Day Cooldown Protection Banner */}
                  <div style={{ padding: "8px 12px", borderRadius: "6px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", fontSize: "12px", lineHeight: 1.45 }}>
                    🛡️ <strong>90-Day Brand Protection:</strong> When you change your subdomain, your previous slug is reserved for 90 days to prevent domain hijacking and protect your brand equity.
                  </div>
                </div>

                {/* Card 3: Custom Domain (Optional / Connected) */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#0f172a",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <span>2. Custom Domain (Optional)</span>
                    {activeCustomDomain && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: activeCustomDomain.status === "connected" ? "#ecfdf5" : "#fef3c7",
                          color: activeCustomDomain.status === "connected" ? "#059669" : "#b45309",
                          border: activeCustomDomain.status === "connected" ? "1px solid #a7f3d0" : "1px solid #fde68a",
                          textTransform: "none",
                        }}
                      >
                        {activeCustomDomain.status === "connected" ? "● Connected" : "▲ DNS Pending"}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                      Custom Subdomain or WWW Domain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. shop.yourbrand.com or www.yourbrand.com"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      className="wc-input-focus"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "13.5px",
                        fontFamily: "monospace",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        boxSizing: "border-box",
                        background: "#ffffff",
                        color: "#0f172a",
                      }}
                    />
                  </div>

                  {/* Live Apex Warning */}
                  {customDomainAnalysis.isApex && (
                    <div style={{ padding: "10px 12px", borderRadius: "6px", background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", fontSize: "12px", lineHeight: 1.4 }}>
                      ⚠️ Bare root apex domains (e.g. <strong>{customDomainAnalysis.clean}</strong>) require ALIAS/ANAME root flattening. Please enter <strong>www.{customDomainAnalysis.clean}</strong> or <strong>shop.{customDomainAnalysis.clean}</strong>.
                    </div>
                  )}

                  {/* Connected Domain DNS Instructions & Status Card */}
                  {activeCustomDomain && (
                    <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {/* DNS Status & Action Bar */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {activeCustomDomain.is_primary ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: "#0f172a", color: "#ffffff" }}>
                              ★ PRIMARY URL
                            </span>
                          ) : activeCustomDomain.status === "connected" && canEdit ? (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(activeCustomDomain)}
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "3px 10px",
                                borderRadius: "4px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                color: "#334155",
                                cursor: "pointer",
                              }}
                            >
                              Make Primary URL
                            </button>
                          ) : null}

                          {activeCustomDomain.ssl_status === "ssl_active" && (
                            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#059669", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <ShieldCheckIcon /> SSL TLS 1.3 Active
                            </span>
                          )}
                        </div>

                        {canEdit && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => handleVerifyDns(activeCustomDomain)}
                              disabled={verifyingId === activeCustomDomain.id}
                              style={{
                                padding: "5px 12px",
                                borderRadius: "6px",
                                background: "#2563eb",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: verifyingId === activeCustomDomain.id ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <RefreshIcon spin={verifyingId === activeCustomDomain.id} />
                              <span>{verifyingId === activeCustomDomain.id ? "Verifying..." : "Verify DNS"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDisconnectConfirmOpen(true)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "6px",
                                border: "1px solid #fecaca",
                                background: "#fff5f5",
                                color: "#dc2626",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Disconnect
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Required DNS Records Table */}
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                          DNS Configuration Records
                        </div>
                        <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflowX: "auto" }}>
                          <table style={{ width: "100%", minWidth: "480px", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b", fontWeight: 700, fontSize: "11px" }}>
                                <th style={{ padding: "8px 10px", width: "60px" }}>Type</th>
                                <th style={{ padding: "8px 10px" }}>Host / Name</th>
                                <th style={{ padding: "8px 10px" }}>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* CNAME Record */}
                              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#2563eb" }}>CNAME</td>
                                <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#0f172a" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{activeCustomDomain.domain}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyText(activeCustomDomain.domain, "Host")}
                                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                                      title="Copy Host"
                                    >
                                      <CopyIcon />
                                    </button>
                                  </div>
                                </td>
                                <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#0f172a" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{routingTarget}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyText(routingTarget, "Value")}
                                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                                      title="Copy Value"
                                    >
                                      <CopyIcon />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {/* TXT Record */}
                              <tr>
                                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#7c3aed" }}>TXT</td>
                                <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#0f172a" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>_webcreon-challenge.{activeCustomDomain.domain}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyText(`_webcreon-challenge.${activeCustomDomain.domain}`, "Host")}
                                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                                      title="Copy Host"
                                    >
                                      <CopyIcon />
                                    </button>
                                  </div>
                                </td>
                                <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#0f172a", wordBreak: "break-all" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{activeCustomDomain.verification_token}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyText(activeCustomDomain.verification_token, "Token")}
                                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                                      title="Copy Token"
                                    >
                                      <CopyIcon />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Form Footer */}
              <div
                style={{
                  position: "sticky",
                  bottom: 0,
                  zIndex: 20,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 20px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#ffffff",
                  boxShadow: "0 -2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
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
                  type="submit"
                  disabled={formSubmitting || !canEdit || customDomainAnalysis.isApex}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "6px",
                    background: !canEdit || customDomainAnalysis.isApex ? "#94a3b8" : "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: formSubmitting || !canEdit || customDomainAnalysis.isApex ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                  }}
                >
                  {formSubmitting ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CONFIRMATION MODAL: DISCONNECT CUSTOM DOMAIN                           */}
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
                disabled={formSubmitting}
                style={{ padding: "7px 16px", borderRadius: "6px", background: "#dc2626", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: formSubmitting ? "not-allowed" : "pointer" }}
              >
                {formSubmitting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDomainSettings;
