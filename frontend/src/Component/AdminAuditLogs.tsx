import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminTheme } from "../context/ThemeContext";
import { AccessDeniedView } from "./AccessDeniedView";
import { GlassToast } from "./GlassToast";
import { Pagination } from "./Pagination";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type ActivityItem = {
  id: string;
  site_id: string | null;
  site_name: string | null;
  website_name?: string | null;
  website?: { id: string; name: string; slug: string } | null;
  admin_id: string | null;
  actor_email: string | null;
  actor_name: string;
  actor_role: string;
  actor_type?: string;
  source?: string;
  correlation_id?: string | null;
  idempotency_key?: string | null;
  action: string;
  action_label?: string;
  category: "user_access" | "product" | "order" | "financial" | "website" | "settings" | "auth" | string;
  category_label?: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_name: string | null;
  summary?: string;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  status: "success" | "warning" | "failure" | string;
  details: Record<string, any> | null;
  created_at: string;
};

export type FilterUser = {
  id: string;
  name: string;
  email: string;
};

export type FilterSite = {
  id: string;
  name: string;
  slug: string;
};

const CATEGORIES = [
  { id: "all", label: "All Activity" },
  { id: "orders", label: "Orders & Returns" },
  { id: "product", label: "Products" },
  { id: "discounts", label: "Discounts & Promo" },
  { id: "support", label: "Support & CRM" },
  { id: "delivery", label: "Delivery & Shipping" },
  { id: "notifications", label: "Notifications & Emails" },
  { id: "website", label: "Home Sections & Pages" },
  { id: "settings", label: "Taxes & Surcharges" },
  { id: "financial", label: "Earnings & Ledger / Payouts" },
  { id: "user_access", label: "Users & Roles" },
];

const SOURCES = [
  { id: "all", label: "All Sources" },
  { id: "ui", label: "Dashboard / Web" },
  { id: "rider_app", label: "Rider App" },
  { id: "shiprocket", label: "Shiprocket" },
  { id: "razorpay", label: "Razorpay" },
  { id: "webhook", label: "Webhooks" },
  { id: "ai_copilot", label: "AI Copilot" },
  { id: "cron_scheduler", label: "Automated / Cron" },
  { id: "background_worker", label: "Background Jobs" },
];

const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "custom", label: "Custom Range" },
];

const STATUS_OPTIONS = [
  { id: "all", label: "All Statuses" },
  { id: "success", label: "Success / Non-Errors" },
  { id: "failed", label: "Errors / Failures" },
  { id: "warning", label: "Warnings" },
];

// ---------------------------------------------------------------------------
// ICONS & COMMON STYLES (MATCHING USERS & ROLES)
// ---------------------------------------------------------------------------

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ChevronDownIcon = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.2s ease",
      color: open ? "#2563eb" : "#94a3b8",
      flexShrink: 0,
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const StoreIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, opacity: 0.7 }}
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

function formatActivityDate(isoString: string): { formatted: string; relative: string } {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return { formatted: isoString, relative: "" };

    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "just now";
    if (diffMins >= 1 && diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours >= 1 && diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = "yesterday";
    else if (diffDays > 1 && diffDays < 90) relative = `${diffDays}d ago`;

    return { formatted, relative };
  } catch {
    return { formatted: isoString, relative: "" };
  }
}

function getCategoryTheme(category: string, isDark?: boolean) {
  const cat = (category || "").toLowerCase();
  switch (cat) {
    case "user_access":
    case "auth":
      return { bg: isDark ? "rgba(59, 130, 246, 0.18)" : "#eff6ff", color: isDark ? "#93c5fd" : "#1d4ed8", border: isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe", label: "Users & Roles" };
    case "product":
    case "products":
      return { bg: isDark ? "rgba(168, 85, 247, 0.18)" : "#faf5ff", color: isDark ? "#d8b4fe" : "#7e22ce", border: isDark ? "rgba(168, 85, 247, 0.3)" : "#e9d5ff", label: "Products" };
    case "order":
    case "orders":
      return { bg: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4", color: isDark ? "#86efac" : "#15803d", border: isDark ? "rgba(34, 197, 94, 0.3)" : "#bbf7d0", label: "Orders & Returns" };
    case "discounts":
    case "coupons":
    case "promo":
      return { bg: isDark ? "rgba(236, 72, 153, 0.18)" : "#fdf2f8", color: isDark ? "#f472b6" : "#be185d", border: isDark ? "rgba(236, 72, 153, 0.3)" : "#fbcfe8", label: "Discounts & Promo" };
    case "support":
    case "tickets":
      return { bg: isDark ? "rgba(20, 184, 166, 0.18)" : "#f0fdfa", color: isDark ? "#5eead4" : "#0f766e", border: isDark ? "rgba(20, 184, 166, 0.3)" : "#99f6e4", label: "Support & CRM" };
    case "delivery":
    case "shipping":
    case "riders":
      return { bg: isDark ? "rgba(249, 115, 22, 0.18)" : "#fff7ed", color: isDark ? "#fdba74" : "#c2410c", border: isDark ? "rgba(249, 115, 22, 0.3)" : "#fed7aa", label: "Delivery & Shipping" };
    case "website":
    case "pages":
    case "sections":
      return { bg: isDark ? "rgba(14, 165, 233, 0.18)" : "#f0f9ff", color: isDark ? "#7dd3fc" : "#0284c7", border: isDark ? "rgba(14, 165, 233, 0.3)" : "#bae6fd", label: "Pages & Sections" };
    case "settings":
    case "checkout_charges":
    case "taxes_and_surcharges":
      return { bg: isDark ? "rgba(245, 158, 11, 0.18)" : "#fffbeb", color: isDark ? "#fcd34d" : "#b45309", border: isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a", label: "Taxes & Surcharges" };
    case "financial":
    case "earnings_ledger":
    case "payouts":
    case "ledger":
      return { bg: isDark ? "rgba(16, 185, 129, 0.18)" : "#ecfdf5", color: isDark ? "#6ee7b7" : "#047857", border: isDark ? "rgba(16, 185, 129, 0.3)" : "#a7f3d0", label: "Earnings & Ledger" };
    default:
      return {
        bg: isDark ? "rgba(255, 255, 255, 0.08)" : "#f8fafc",
        color: isDark ? "#cbd5e1" : "#475569",
        border: isDark ? "rgba(255, 255, 255, 0.12)" : "#e2e8f0",
        label: category
          ? category
              .replace(/[_.]+/g, " ")
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ")
          : "Activity",
      };
  }
}

function getRoleBadge(role: string, isDark?: boolean) {
  const r = (role || "").toLowerCase();
  if (r.includes("owner")) return { bg: isDark ? "rgba(59, 130, 246, 0.18)" : "#eff6ff", color: isDark ? "#93c5fd" : "#1d4ed8", border: isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe", text: "Owner" };
  if (r.includes("manager")) return { bg: isDark ? "rgba(168, 85, 247, 0.18)" : "#f5f3ff", color: isDark ? "#d8b4fe" : "#6d28d9", border: isDark ? "rgba(168, 85, 247, 0.3)" : "#ddd6fe", text: "Store Manager" };
  if (r.includes("support")) return { bg: isDark ? "rgba(16, 185, 129, 0.18)" : "#ecfdf5", color: isDark ? "#6ee7b7" : "#047857", border: isDark ? "rgba(16, 185, 129, 0.3)" : "#a7f3d0", text: "Support Staff" };
  return { bg: isDark ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9", color: isDark ? "#cbd5e1" : "#475569", border: isDark ? "rgba(255, 255, 255, 0.12)" : "#e2e8f0", text: role || "Staff" };
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function AdminAuditLogs({ siteId: propSiteId }: { siteId?: string } = {}) {
  const { isDark, tokens } = useAdminTheme();
  const { isOwner, hasPermission, admin } = useAdminAuth();
  const canView = isOwner || hasPermission("audit_logs:view") || !admin;

  const { siteId: routeSiteId } = useParams<{ siteId?: string }>();
  const effectiveSiteId = propSiteId || routeSiteId;

  // Data states
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<FilterUser[]>([]);
  const [availableSites, setAvailableSites] = useState<FilterSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSite, setSelectedSite] = useState<string>(effectiveSiteId || "all");
  const [dateRange, setDateRange] = useState("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Filter Popover Modal
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  // Close filter popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFilterOpen]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Accordion & Copy State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11.5px",
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: "6px",
    background: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
    color: isDark ? "#93c5fd" : "#1d4ed8",
    border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe"}`,
    lineHeight: 1.3,
  };

  const chipCloseStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: isDark ? "#93c5fd" : "#1d4ed8",
    padding: 0,
    display: "grid",
    placeItems: "center",
    opacity: 0.85,
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyJson = (id: string, data: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  // Sync selectedSite if effectiveSiteId changes
  useEffect(() => {
    if (effectiveSiteId) {
      setSelectedSite(effectiveSiteId);
    }
  }, [effectiveSiteId]);

  // Fetch activity
  const fetchActivity = async (targetPage = page, targetPageSize = pageSize, isManualRefresh = false) => {
    if (!canView) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedSource !== "all") params.set("source", selectedSource);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (selectedUser !== "all") {
        params.set("user", selectedUser);
        params.set("user_id", selectedUser);
      }
      if (selectedSite && selectedSite !== "all") {
        params.set("site_id", selectedSite);
      }
      params.set("date_range", dateRange);
      if (dateRange === "custom") {
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
      }
      params.set("page", String(targetPage));
      params.set("page_size", String(targetPageSize));

      const targetSite = (selectedSite && selectedSite !== "all")
        ? selectedSite
        : (effectiveSiteId && effectiveSiteId !== "all" ? effectiveSiteId : null);

      const isValidSiteId = targetSite
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetSite);

      if (isValidSiteId) {
        params.delete("site_id");
      }

      const endpoint = isValidSiteId
        ? `${API_BASE_URL}/admin/sites/${targetSite}/activity?${params.toString()}`
        : `${API_BASE_URL}/admin/activity?${params.toString()}`;

      const res = await fetch(endpoint, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        let errMessage = `Error ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.detail) errMessage = errData.detail;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      const data = await res.json();
      setLogs(data.logs || data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);

      if (Array.isArray(data.available_users) && data.available_users.length > 0) {
        setAvailableUsers(data.available_users);
      }
      if (Array.isArray(data.available_sites) && data.available_sites.length > 0) {
        setAvailableSites(data.available_sites);
      }
    } catch (err: any) {
      console.error("Failed to load activity log", err);
      setFetchError(err.message || "Unable to fetch activity records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refetch on page 1 when any filter changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchActivity(1, pageSize);
      return;
    }
    setPage(1);
    fetchActivity(1, pageSize);
  }, [selectedUser, selectedCategory, selectedSource, selectedStatus, selectedSite, dateRange, startDate, endDate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchActivity(1, pageSize);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedUser("all");
    setSelectedCategory("all");
    setSelectedSource("all");
    setSelectedStatus("all");
    if (!effectiveSiteId) setSelectedSite("all");
    setDateRange("30d");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const isFiltered = useMemo(() => {
    return (
      Boolean(searchQuery.trim()) ||
      selectedUser !== "all" ||
      selectedCategory !== "all" ||
      selectedSource !== "all" ||
      selectedStatus !== "all" ||
      (!effectiveSiteId && selectedSite !== "all") ||
      dateRange !== "30d" ||
      Boolean(startDate) ||
      Boolean(endDate)
    );
  }, [searchQuery, selectedUser, selectedCategory, selectedSource, selectedStatus, selectedSite, effectiveSiteId, dateRange, startDate, endDate]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "all") count++;
    if (selectedSource !== "all") count++;
    if (selectedStatus !== "all") count++;
    if (selectedUser !== "all") count++;
    if (!effectiveSiteId && selectedSite !== "all") count++;
    if (dateRange !== "30d" || Boolean(startDate) || Boolean(endDate)) count++;
    return count;
  }, [selectedCategory, selectedSource, selectedStatus, selectedUser, selectedSite, effectiveSiteId, dateRange, startDate, endDate]);


  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedStatus !== "all") params.set("status", selectedStatus);
    if (selectedUser !== "all") {
      params.set("user", selectedUser);
      params.set("user_id", selectedUser);
    }
    if (selectedSite && selectedSite !== "all") params.set("site_id", selectedSite);
    params.set("date_range", dateRange);
    if (dateRange === "custom") {
      if (startDate) {
        params.set("start_date", startDate);
        params.set("from_date", startDate);
      }
      if (endDate) {
        params.set("end_date", endDate);
        params.set("to_date", endDate);
      }
    }

    const targetSite = (selectedSite && selectedSite !== "all")
      ? selectedSite
      : (effectiveSiteId && effectiveSiteId !== "all" ? effectiveSiteId : null);

    const isValidSiteId = targetSite
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetSite);

    if (isValidSiteId) {
      params.delete("site_id");
    }

    const endpoint = isValidSiteId
      ? `${API_BASE_URL}/admin/sites/${targetSite}/activity/export-csv?${params.toString()}`
      : `${API_BASE_URL}/admin/activity/export-csv?${params.toString()}`;

    window.open(endpoint, "_blank");
    setToast({ message: "Exporting compressed activity log (.zip)...", type: "info" });
  };

  if (!canView) {
    return (
      <AccessDeniedView
        title="Activity Log Restricted"
        message="You do not have permission to view activity logs for this workspace or store."
        requiredPermission="audit_logs:view"
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        color: tokens.textPrimary,
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Toast */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* TOP HEADER CARD (Segmented Mode Pill + Search + Filters) */}
      <div
        style={{
          background: isDark ? tokens.surfaceBg : "#ffffff",
          border: `1px solid ${tokens.border}`,
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          position: "relative",
        }}
      >
        {/* Row 1: Mode Switcher + Global Search + Filter Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill (Activity Logs) */}
          <div
            style={{
              display: "inline-flex",
              background: isDark ? tokens.elevatedSurfaceBg : "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: `1px solid ${tokens.border}`,
            }}
          >
            <span
              style={{
                borderRadius: "6px",
                padding: "6px 16px",
                background: isDark ? tokens.surfaceBg : "#ffffff",
                color: tokens.textPrimary,
                boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
                fontSize: "13px",
                fontWeight: 700,
                display: "inline-block",
                userSelect: "none",
              }}
            >
              Activity Logs
            </span>
          </div>

          {/* Search Bar, Filter Button & Export CSV Container */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: "1 1 300px",
              maxWidth: "520px",
              position: "relative",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: tokens.textMuted,
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
                placeholder="Search activity, actions, users, resources..."
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: searchQuery ? "28px" : "12px",
                  fontSize: "13px",
                  height: "36px",
                  borderRadius: "7px",
                  border: `1px solid ${tokens.border}`,
                  background: tokens.elevatedSurfaceBg,
                  color: tokens.textPrimary,
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
                    color: tokens.textMuted,
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
                  border: activeFilterCount > 0
                    ? `1px solid ${isDark ? "rgba(59, 130, 246, 0.4)" : "#93c5fd"}`
                    : `1px solid ${tokens.border}`,
                  background: activeFilterCount > 0
                    ? (isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff")
                    : tokens.surfaceBg,
                  color: activeFilterCount > 0
                    ? (isDark ? "#93c5fd" : "#1d4ed8")
                    : tokens.textPrimary,
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
                    top: "40px",
                    right: "0",
                    width: "300px",
                    background: isDark ? tokens.surfaceBg : "#ffffff",
                    borderRadius: "10px",
                    border: `1px solid ${tokens.border}`,
                    boxShadow: isDark
                      ? "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1)"
                      : "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                    padding: "16px",
                    zIndex: 100,
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: tokens.textSecondary, marginBottom: "6px" }}>
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: `1px solid ${tokens.border}`,
                        fontSize: "13px",
                        background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                        color: tokens.textPrimary,
                        outline: "none",
                      }}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id} style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: tokens.textSecondary, marginBottom: "6px" }}>
                      Source / Origin
                    </label>
                    <select
                      value={selectedSource}
                      onChange={(e) => setSelectedSource(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: `1px solid ${tokens.border}`,
                        fontSize: "13px",
                        background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                        color: tokens.textPrimary,
                        outline: "none",
                      }}
                    >
                      {SOURCES.map((src) => (
                        <option key={src.id} value={src.id} style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>
                          {src.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: tokens.textSecondary, marginBottom: "6px" }}>
                      Status / Outcome
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: `1px solid ${tokens.border}`,
                        fontSize: "13px",
                        background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                        color: tokens.textPrimary,
                        outline: "none",
                      }}
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st.id} value={st.id} style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: tokens.textSecondary, marginBottom: "6px" }}>
                      User / Actor
                    </label>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: `1px solid ${tokens.border}`,
                        fontSize: "13px",
                        background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                        color: tokens.textPrimary,
                        outline: "none",
                      }}
                    >
                      <option value="all" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>All Team Members</option>
                      {availableUsers.map((u: any) => (
                        <option key={u.id} value={u.id} style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>
                          {u.name || u.email} {u.role ? `(${u.role})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!effectiveSiteId && (
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: tokens.textSecondary, marginBottom: "6px" }}>
                        Website / Store
                      </label>
                      <select
                        value={selectedSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                        style={{
                          width: "100%",
                          height: "34px",
                          padding: "0 8px",
                          borderRadius: "6px",
                          border: `1px solid ${tokens.border}`,
                          fontSize: "13px",
                          background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                          color: tokens.textPrimary,
                          outline: "none",
                        }}
                      >
                        <option value="all" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>All Websites</option>
                        {availableSites.map((site) => (
                          <option key={site.id} value={site.id} style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>
                            {site.name || site.slug}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: tokens.textSecondary, marginBottom: "6px" }}>
                      Date Range
                    </label>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      style={{
                        width: "100%",
                        height: "34px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        border: `1px solid ${tokens.border}`,
                        fontSize: "13px",
                        background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                        color: tokens.textPrimary,
                        outline: "none",
                      }}
                    >
                      {DATE_RANGES.map((dr) => (
                        <option key={dr.id} value={dr.id} style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>
                          {dr.label}
                        </option>
                      ))}
                    </select>

                    {dateRange === "custom" && (
                      <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: tokens.textSecondary }}>From:</span>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{
                              width: "100%",
                              height: "30px",
                              padding: "0 8px",
                              borderRadius: "5px",
                              border: `1px solid ${tokens.border}`,
                              fontSize: "12px",
                              background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                              color: tokens.textPrimary,
                              colorScheme: isDark ? "dark" : "light",
                              boxSizing: "border-box",
                              marginTop: "2px",
                            }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: tokens.textSecondary }}>To:</span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{
                              width: "100%",
                              height: "30px",
                              padding: "0 8px",
                              borderRadius: "5px",
                              border: `1px solid ${tokens.border}`,
                              fontSize: "12px",
                              background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                              color: tokens.textPrimary,
                              colorScheme: isDark ? "dark" : "light",
                              boxSizing: "border-box",
                              marginTop: "2px",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: `1px solid ${tokens.border}` }}>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      style={{
                        background: "none",
                        border: "none",
                        color: tokens.textSecondary,
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "4px",
                      }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      style={{
                        background: tokens.accent || "#2563eb",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        padding: "5px 14px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
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
        {isFiltered && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              paddingTop: "8px",
              borderTop: `1px solid ${tokens.border}`,
            }}
          >
            <span style={{ fontSize: "11.5px", color: tokens.textSecondary, fontWeight: 600, marginRight: "2px" }}>
              Active:
            </span>

            {searchQuery && (
              <span style={chipStyle}>
                <span>Search: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={chipCloseStyle}
                  title="Remove search filter"
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {selectedCategory !== "all" && (
              <span style={chipStyle}>
                <span>
                  Category: {CATEGORIES.find((c) => c.id === selectedCategory)?.label || selectedCategory}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  style={chipCloseStyle}
                  title="Remove category filter"
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {selectedSource !== "all" && (
              <span style={chipStyle}>
                <span>
                  Source: {SOURCES.find((s) => s.id === selectedSource)?.label || selectedSource}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSource("all")}
                  style={chipCloseStyle}
                  title="Remove source filter"
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {selectedStatus !== "all" && (
              <span style={chipStyle}>
                <span>
                  Status: {STATUS_OPTIONS.find((s) => s.id === selectedStatus)?.label || selectedStatus}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStatus("all")}
                  style={chipCloseStyle}
                  title="Remove status filter"
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {selectedUser !== "all" && (
              <span style={chipStyle}>
                <span>
                  User:{" "}
                  {availableUsers.find((u) => u.id === selectedUser)?.name ||
                    availableUsers.find((u) => u.id === selectedUser)?.email ||
                    selectedUser}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedUser("all")}
                  style={chipCloseStyle}
                  title="Remove user filter"
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {!effectiveSiteId && selectedSite !== "all" && (
              <span style={chipStyle}>
                <span>
                  Site:{" "}
                  {availableSites.find((s) => s.id === selectedSite)?.name ||
                    availableSites.find((s) => s.id === selectedSite)?.slug ||
                    selectedSite}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSite("all")}
                  style={chipCloseStyle}
                  title="Remove site filter"
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {dateRange !== "30d" && (
              <span style={chipStyle}>
                <span>
                  Date: {DATE_RANGES.find((d) => d.id === dateRange)?.label || dateRange}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDateRange("30d");
                    setStartDate("");
                    setEndDate("");
                  }}
                  style={chipCloseStyle}
                  title="Reset date filter"
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                background: "none",
                border: "none",
                color: isDark ? "#f87171" : "#dc2626",
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

      {/* ----------------------------------------------------------------- */}
      {/* 3. ERROR STATE                                                    */}
      {/* ----------------------------------------------------------------- */}
      {fetchError && (
        <div
          style={{
            padding: "16px 20px",
            background: "#fef2f2",
            borderRadius: "10px",
            border: "1px solid #fecaca",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#991b1b", marginBottom: "2px" }}>
              Failed to load activity logs
            </div>
            <div style={{ fontSize: "12.5px", color: "#b91c1c" }}>{fetchError}</div>
          </div>
          <button
            type="button"
            onClick={() => fetchActivity()}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid #b91c1c",
              background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
              color: "#991b1b",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. EVENT LOGS TABLE (CLEAN ACCORDION ROWS)                        */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
          borderRadius: "10px",
          border: `1px solid ${tokens.border}`,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Column Headers Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "9px 16px",
            background: isDark ? tokens.surfaceBg : "#f8fafc",
            borderBottom: `1px solid ${tokens.border}`,
            fontSize: "11px",
            fontWeight: 700,
            color: tokens.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            userSelect: "none",
          }}
        >
          <div style={{ width: effectiveSiteId ? "170px" : "160px", flexShrink: 0 }}>Timestamp ▼</div>
          {!effectiveSiteId && <div style={{ width: "140px", flexShrink: 0 }}>Website</div>}
          <div style={{ width: effectiveSiteId ? "160px" : "140px", flexShrink: 0 }}>Category</div>
          <div style={{ width: effectiveSiteId ? "180px" : "170px", flexShrink: 0 }}>Actor</div>
          <div style={{ flex: 1, minWidth: 0 }}>Activity Description</div>
          <div
            style={{
              width: "24px",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading || totalCount === 0}
              title="Export activity logs (ZIP Archive)"
              aria-label="Export activity logs (ZIP Archive)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                padding: 0,
                borderRadius: "5px",
                border: `1px solid ${tokens.border}`,
                background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                color: tokens.textSecondary,
                cursor: loading || totalCount === 0 ? "not-allowed" : "pointer",
                opacity: loading || totalCount === 0 ? 0.45 : 1,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading && totalCount > 0) {
                  e.currentTarget.style.color = "#2563eb";
                  e.currentTarget.style.borderColor = "#93c5fd";
                  e.currentTarget.style.background = "#eff6ff";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.borderColor = "#cbd5e1";
                e.currentTarget.style.background = "#ffffff";
              }}
            >
              <DownloadIcon />
            </button>
          </div>
        </div>

        {loading && logs.length === 0 ? (
          // Loading Skeleton Rows
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${tokens.border}`,
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ width: effectiveSiteId ? "170px" : "160px", flexShrink: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isDark ? tokens.surfaceBg : "#f1f5f9" }} />
                <div style={{ width: "120px", height: "13px", borderRadius: "4px", background: isDark ? tokens.surfaceBg : "#f1f5f9" }} />
              </div>
              {!effectiveSiteId && (
                <div style={{ width: "140px", flexShrink: 0 }}>
                  <div style={{ width: "95px", height: "13px", borderRadius: "4px", background: isDark ? tokens.surfaceBg : "#f1f5f9" }} />
                </div>
              )}
              <div style={{ width: effectiveSiteId ? "160px" : "140px", flexShrink: 0 }}>
                <div style={{ width: "100px", height: "13px", borderRadius: "4px", background: isDark ? tokens.surfaceBg : "#f1f5f9" }} />
              </div>
              <div style={{ width: effectiveSiteId ? "180px" : "170px", flexShrink: 0, display: "flex", alignItems: "center", gap: "7px" }}>
                <div style={{ width: "110px", height: "13px", borderRadius: "4px", background: isDark ? tokens.surfaceBg : "#f1f5f9" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: "70%", height: "13px", borderRadius: "4px", background: isDark ? tokens.surfaceBg : "#f1f5f9" }} />
              </div>
              <div style={{ width: "24px", flexShrink: 0 }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: isDark ? tokens.surfaceBg : "#f1f5f9", marginLeft: "auto" }} />
              </div>
            </div>
          ))
        ) : logs.length === 0 ? (
          // Empty State
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <div style={{ maxWidth: "380px", margin: "0 auto" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: isDark ? tokens.surfaceBg : "#f1f5f9",
                  color: tokens.textSecondary,
                  display: "inline-grid",
                  placeItems: "center",
                  marginBottom: "14px",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 700, color: tokens.textPrimary }}>
                {isFiltered ? "No matching events found" : "No activity recorded yet"}
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.5 }}>
                {isFiltered
                  ? "Try adjusting your search query, filter criteria, or date range."
                  : "Important changes, user actions, and system executions will appear here in chronological order."}
              </p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "7px",
                    border: `1px solid ${tokens.border}`,
                    background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                    color: tokens.textPrimary,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          logs.map((log, index) => {
            const isExpanded = expandedIds.has(log.id);
            const dateInfo = formatActivityDate(log.created_at);
            const catTheme = getCategoryTheme(log.category, isDark);
            const roleBadge = getRoleBadge(log.actor_role, isDark);
            const summaryText = log.summary || log.description;
            const isLast = index === logs.length - 1;

            return (
              <div
                key={log.id}
                style={{
                  borderBottom: isLast && !isExpanded ? "none" : `1px solid ${tokens.border}`,
                  transition: "background 0.12s ease",
                }}
              >
                {/* Collapsed Event Row (Strictly Single Row) */}
                <div
                  onClick={() => toggleExpand(log.id)}
                  style={{
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    cursor: "pointer",
                    background: isExpanded
                      ? (isDark ? tokens.elevatedSurfaceBg : "#f8fafc")
                      : (isDark ? tokens.surfaceBg : "#ffffff"),
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = isDark ? tokens.elevatedSurfaceBg : "#fbfcfd";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = isDark ? tokens.surfaceBg : "#ffffff";
                  }}
                >
                  {/* 1. Timestamp Column */}
                  <div
                    style={{
                      width: effectiveSiteId ? "170px" : "160px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background:
                          log.status === "failure" || log.status === "failed" || log.status === "error"
                            ? "#ef4444"
                            : log.status === "warning"
                            ? "#f59e0b"
                            : "#22c55e",
                        flexShrink: 0,
                      }}
                      title={`Status: ${log.status}`}
                    />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: tokens.textPrimary }}>
                      {dateInfo.formatted}
                    </span>
                  </div>

                  {/* 2. Website Column (Only in global multi-site overview) */}
                  {!effectiveSiteId && (
                    <div
                      style={{
                        width: "140px",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        overflow: "hidden",
                      }}
                      title={log.site_name || (log.website_name && log.website_name !== "Account-wide" ? log.website_name : "Account-wide")}
                    >
                      {log.site_name || (log.website_name && log.website_name !== "Account-wide") ? (
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: tokens.textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <StoreIcon />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {log.site_name || log.website_name}
                          </span>
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 600,
                            color: tokens.textSecondary,
                            background: isDark ? tokens.surfaceBg : "#f1f5f9",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            border: `1px solid ${tokens.border}`,
                          }}
                        >
                          Account-wide
                        </span>
                      )}
                    </div>
                  )}

                  {/* 3. Category Column (Clean text typography, no bulky badge box) */}
                  <div
                    style={{
                      width: effectiveSiteId ? "160px" : "140px",
                      flexShrink: 0,
                      fontSize: "12px",
                      fontWeight: 500,
                      color: tokens.textSecondary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={log.category_label || catTheme.label}
                  >
                    {log.category_label || catTheme.label}
                  </div>

                  {/* 4. Actor Column */}
                  <div
                    style={{
                      width: effectiveSiteId ? "180px" : "170px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      overflow: "hidden",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: tokens.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flexShrink: 1,
                      }}
                      title={log.actor_name || "System"}
                    >
                      {log.actor_name || "System"}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: roleBadge.bg,
                        color: roleBadge.color,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {roleBadge.text}
                    </span>
                  </div>

                  {/* 5. Activity Description Column (Single-line, strictly one row) */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "13px",
                      color: tokens.textPrimary,
                      fontWeight: 500,
                    }}
                    title={summaryText}
                  >
                    {summaryText}
                  </div>

                  {/* 6. Chevron Column */}
                  <div
                    style={{
                      width: "24px",
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <ChevronDownIcon open={isExpanded} />
                  </div>
                </div>

                {/* Inline Accordion Details Panel */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "8px 16px 12px 16px",
                      background: isDark ? tokens.surfaceBg : "#f8fafc",
                      borderTop: `1px solid ${tokens.border}`,
                      borderBottom: `1px solid ${tokens.border}`,
                    }}
                  >
                    <div
                      style={{
                        background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                        border: `1px solid ${tokens.border}`,
                        borderRadius: "6px",
                        padding: "10px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {/* Full Activity Message */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            color: tokens.textSecondary,
                            letterSpacing: "0.04em",
                            flexShrink: 0,
                            paddingTop: "2px",
                          }}
                        >
                          Full Message:
                        </span>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: tokens.textPrimary,
                            lineHeight: 1.45,
                            wordBreak: "break-word",
                            flex: 1,
                          }}
                        >
                          {log.description || log.summary || summaryText}
                        </div>
                      </div>

                      {/* Prominent Error Details Banner (if error / failed) */}
                      {(log.status === "failure" || log.status === "failed" || log.status === "error" || Boolean(log.details?.error) || Boolean(log.details?.error_message) || Boolean(log.details?.last_error) || Boolean(log.details?.failure_reason)) && (
                        <div
                          style={{
                            padding: "8px 12px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            color: "#991b1b",
                            fontSize: "12.5px",
                          }}
                        >
                          <div style={{ fontWeight: 700, flexShrink: 0 }}>Error Details:</div>
                          <div style={{ wordBreak: "break-word", flex: 1, fontWeight: 500 }}>
                            {log.details?.error ||
                              log.details?.error_message ||
                              log.details?.last_error ||
                              log.details?.failure_reason ||
                              log.details?.reason ||
                              log.details?.detail ||
                              log.details?.message ||
                              (log.status !== "success" ? log.description : "Operation encountered a delivery/execution failure.")}
                          </div>
                        </div>
                      )}

                      {/* Compact Context Details Strip */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px 16px",
                          padding: "6px 10px",
                          background: isDark ? tokens.surfaceBg : "#f8fafc",
                          borderRadius: "5px",
                          border: `1px solid ${tokens.border}`,
                          fontSize: "11.5px",
                        }}
                      >
                        {log.action && (
                          <div>
                            <span style={{ color: tokens.textSecondary, marginRight: "4px" }}>Action:</span>
                            <code style={{ background: isDark ? tokens.elevatedSurfaceBg : "#ffffff", padding: "1px 5px", borderRadius: "3px", border: `1px solid ${tokens.border}`, color: tokens.textPrimary, fontWeight: 600 }}>
                              {log.action}
                            </code>
                          </div>
                        )}
                        {(log.resource_name || log.resource_id) && (
                          <div>
                            <span style={{ color: tokens.textSecondary, marginRight: "4px" }}>Target:</span>
                            <span style={{ color: tokens.textPrimary, fontWeight: 600 }}>{log.resource_name || log.resource_id}</span>
                            {log.resource_type && <span style={{ color: tokens.textMuted, marginLeft: "3px" }}>({log.resource_type})</span>}
                          </div>
                        )}
                        {log.ip_address && (
                          <div>
                            <span style={{ color: tokens.textSecondary, marginRight: "4px" }}>IP:</span>
                            <span style={{ color: tokens.textSecondary, fontFamily: "monospace" }}>{log.ip_address}</span>
                          </div>
                        )}
                        <div>
                          <span style={{ color: tokens.textSecondary, marginRight: "4px" }}>Exact Time:</span>
                          <span style={{ color: tokens.textSecondary }}>{new Date(log.created_at).toUTCString()}</span>
                        </div>
                      </div>

                      {/* Event Attributes (if any) */}
                      {log.details?.metadata && typeof log.details.metadata === "object" && Object.keys(log.details.metadata).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", fontSize: "11.5px" }}>
                          <span style={{ color: tokens.textSecondary, fontWeight: 600, marginRight: "2px" }}>Attributes:</span>
                          {Object.entries(log.details.metadata).map(([mKey, mVal]) => (
                            <span
                              key={mKey}
                              style={{
                                background: isDark ? tokens.surfaceBg : "#f8fafc",
                                border: `1px solid ${tokens.border}`,
                                borderRadius: "4px",
                                padding: "1px 6px",
                                color: tokens.textPrimary,
                              }}
                            >
                              <strong style={{ textTransform: "capitalize" }}>{mKey.replace(/_/g, " ")}:</strong> {typeof mVal === "boolean" ? (mVal ? "true" : "false") : String(mVal)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Changes Made (Diffs) */}
                      {log.details && (log.details.before || log.details.after) && (
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px", fontSize: "11.5px" }}>
                          <span style={{ color: tokens.textSecondary, fontWeight: 600, marginRight: "2px" }}>Changes:</span>
                          {Object.keys(log.details.after || {}).map((key) => {
                            const beforeVal = log.details?.before?.[key];
                            const afterVal = log.details?.after?.[key];
                            if (beforeVal === undefined && afterVal === undefined) return null;
                            const formatVal = (v: any) => {
                              if (v === null || v === undefined) return "none";
                              if (typeof v === "boolean") return v ? "true" : "false";
                              return String(v);
                            };
                            return (
                              <span
                                key={key}
                                style={{
                                  fontSize: "11.5px",
                                  background: isDark ? tokens.surfaceBg : "#f8fafc",
                                  border: `1px solid ${tokens.border}`,
                                  borderRadius: "4px",
                                  padding: "2px 7px",
                                }}
                              >
                                <strong style={{ color: tokens.textPrimary }}>{key.replace(/_/g, " ")}:</strong>{" "}
                                {beforeVal !== undefined && (
                                  <span style={{ color: tokens.textMuted, textDecoration: "line-through", marginRight: "4px" }}>
                                    {formatVal(beforeVal)}
                                  </span>
                                )}
                                <span style={{ color: "#15803d", fontWeight: 600 }}>{formatVal(afterVal)}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Transaction Highlights (if any) */}
                      {log.details && (log.category === "financial" || log.details.amount !== undefined || log.details.payout_amount !== undefined) && (
                        <div style={{ padding: "4px 8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "4px", display: "flex", alignItems: "center", gap: "12px", fontSize: "11.5px" }}>
                          {(log.details.amount !== undefined || log.details.payout_amount !== undefined) && (
                            <div>
                              <span style={{ color: "#166534", marginRight: "4px" }}>Amount:</span>
                              <strong style={{ color: "#14532d" }}>
                                ₹{Number(log.details.amount || log.details.payout_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          )}
                          {log.details.masked_account_number && (
                            <div>
                              <span style={{ color: "#166534", marginRight: "4px" }}>Account:</span>
                              <span style={{ color: "#14532d", fontWeight: 600 }}>{log.details.masked_account_number}</span>
                            </div>
                          )}
                          {log.details.current_status && (
                            <div>
                              <span style={{ color: "#166534", marginRight: "4px" }}>Status:</span>
                              <span style={{ color: "#14532d", fontWeight: 600, textTransform: "capitalize" }}>{log.details.current_status}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Raw JSON toggle */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div style={{ borderTop: "1px solid #f8fafc", paddingTop: "4px" }}>
                          <details style={{ fontSize: "11px", color: tokens.textSecondary }}>
                            <summary style={{ cursor: "pointer", userSelect: "none", fontWeight: 500 }}>
                              View Raw Payload
                            </summary>
                            <pre style={{ margin: "4px 0 0 0", padding: "6px 10px", background: "#0f172a", color: "#f8fafc", borderRadius: "4px", fontSize: "10.5px", overflowX: "auto", maxHeight: "160px" }}>
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination controls using shared standard Pagination component */}
      {totalCount > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          onPageChange={(newPage) => {
            setPage(newPage);
            fetchActivity(newPage, pageSize);
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
            fetchActivity(1, newSize);
          }}
          showRangeText={true}
          accentColor={tokens.accent}
        />
      )}

      {/* Retention notice */}
      <div style={{ marginTop: "12px", textAlign: "right", fontSize: "11.5px", color: tokens.textMuted }}>
        Activities are automatically and securely retained for 90 days.
      </div>
    </div>
  );
}


