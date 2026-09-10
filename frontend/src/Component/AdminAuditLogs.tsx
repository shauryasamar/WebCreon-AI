import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AccessDeniedView } from "./AccessDeniedView";
import { GlassToast } from "./GlassToast";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type ActivityItem = {
  id: string;
  site_id: string | null;
  site_name: string | null;
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
  { id: "website", label: "Home Sections & Pages" },
  { id: "settings", label: "Checkout Charges & Policies" },
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



const chipStyle: React.CSSProperties = {
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
};

const chipCloseStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#1d4ed8",
  padding: 0,
  display: "grid",
  placeItems: "center",
};

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

function getCategoryTheme(category: string) {
  const cat = (category || "").toLowerCase();
  switch (cat) {
    case "user_access":
    case "auth":
      return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: "Users & Roles" };
    case "product":
    case "products":
      return { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff", label: "Products" };
    case "order":
    case "orders":
      return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "Orders & Returns" };
    case "discounts":
    case "coupons":
    case "promo":
      return { bg: "#fdf2f8", color: "#be185d", border: "#fbcfe8", label: "Discounts & Promo" };
    case "support":
    case "tickets":
      return { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4", label: "Support & CRM" };
    case "delivery":
    case "shipping":
    case "riders":
      return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", label: "Delivery & Shipping" };
    case "website":
    case "pages":
    case "sections":
      return { bg: "#f0f9ff", color: "#0284c7", border: "#bae6fd", label: "Home Sections & Pages" };
    case "settings":
    case "checkout_charges":
      return { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Checkout Charges & Policies" };
    case "financial":
    case "earnings_ledger":
    case "payouts":
    case "ledger":
      return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", label: "Earnings & Ledger / Payouts" };
    default:
      return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0", label: category ? category.replace("_", " ").replace(".", " ").toUpperCase() : "Activity" };
  }
}

function getRoleBadge(role: string) {
  const r = (role || "").toLowerCase();
  if (r.includes("owner")) return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", text: "Owner" };
  if (r.includes("manager")) return { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe", text: "Store Manager" };
  if (r.includes("support")) return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", text: "Support Staff" };
  return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", text: role || "Staff" };
}

function getSourceBadge(source?: string, actorType?: string) {
  const s = (source || "").toLowerCase();
  const a = (actorType || "").toLowerCase();

  if (s === "shiprocket" || a === "shiprocket") {
    return { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd", text: "Shiprocket", icon: "🚀" };
  }
  if (s === "razorpay" || a === "payment_provider") {
    return { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe", text: "Razorpay", icon: "💳" };
  }
  if (s === "rider_app" || a === "rider") {
    return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", text: "Rider App", icon: "🛵" };
  }
  if (s === "ai_copilot" || a === "ai") {
    return { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff", text: "AI Copilot", icon: "✨" };
  }
  if (s === "cron_scheduler" || a === "cron_job" || a === "scheduled_task") {
    return { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4", text: "Automated", icon: "⏱️" };
  }
  if (s === "background_worker" || a === "background_job") {
    return { bg: "#f8fafc", color: "#475569", border: "#cbd5e1", text: "Worker Job", icon: "⚙️" };
  }
  if (s === "webhook" || a === "webhook") {
    return { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1", text: "Webhook", icon: "🔗" };
  }
  if (s === "ui" || a === "owner" || a === "team_member" || a === "user") {
    return { bg: "#f8fafc", color: "#1e293b", border: "#e2e8f0", text: "Dashboard", icon: "👤" };
  }
  return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0", text: source || "System", icon: "•" };
}

function getUserInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function AdminAuditLogs({ siteId: propSiteId }: { siteId?: string } = {}) {
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
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Accordion & Copy State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  const fetchActivity = async (isManualRefresh = false) => {
    if (!canView) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedSource !== "all") params.set("source", selectedSource);
      if (selectedUser !== "all") params.set("user_id", selectedUser);
      if (selectedSite !== "all") params.set("site_id", selectedSite);
      params.set("date_range", dateRange);
      if (dateRange === "custom") {
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
      }
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      // Validate effectiveSiteId is a proper UUID (not "all" or undefined)
      const isValidSiteId = effectiveSiteId
        && effectiveSiteId !== "all"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveSiteId);

      // Remove site_id from query params if we're already scoping by URL path
      if (isValidSiteId) {
        params.delete("site_id");
      }

      // Use site-scoped URL path only when we have a valid UUID siteId
      const endpoint = isValidSiteId
        ? `${API_BASE_URL}/admin/sites/${effectiveSiteId}/activity?${params.toString()}`
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
      setLogs(data.logs || []);
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

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedUser, selectedCategory, selectedSource, selectedSite, dateRange, startDate, endDate]);

  // Refetch when page or filters change
  useEffect(() => {
    fetchActivity();
  }, [page, pageSize, selectedUser, selectedCategory, selectedSource, selectedSite, dateRange, startDate, endDate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchActivity();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedUser("all");
    setSelectedCategory("all");
    setSelectedSource("all");
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
      (!effectiveSiteId && selectedSite !== "all") ||
      dateRange !== "30d" ||
      Boolean(startDate) ||
      Boolean(endDate)
    );
  }, [searchQuery, selectedUser, selectedCategory, selectedSource, selectedSite, effectiveSiteId, dateRange, startDate, endDate]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "all") count++;
    if (selectedSource !== "all") count++;
    if (selectedUser !== "all") count++;
    if (!effectiveSiteId && selectedSite !== "all") count++;
    if (dateRange !== "30d" || Boolean(startDate) || Boolean(endDate)) count++;
    return count;
  }, [selectedCategory, selectedSource, selectedUser, selectedSite, effectiveSiteId, dateRange, startDate, endDate]);


  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedSource !== "all") params.set("source", selectedSource);
    if (selectedUser !== "all") params.set("user_id", selectedUser);
    if (selectedSite !== "all") params.set("site_id", selectedSite);
    params.set("date_range", dateRange);
    if (dateRange === "custom") {
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
    }

    const endpoint = effectiveSiteId
      ? `${API_BASE_URL}/admin/sites/${effectiveSiteId}/activity/export-csv?${params.toString()}`
      : `${API_BASE_URL}/admin/activity/export-csv?${params.toString()}`;

    window.open(endpoint, "_blank");
    setToast({ message: "Exporting activity log to CSV...", type: "info" });
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
        color: "#0f172a",
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Toast */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* TOP HEADER CARD (Segmented Mode Pill + Search + Filters) */}
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
          {/* Mode Pill (Activity) */}
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
              Activity
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
                placeholder="Search activity, actions, users, resources..."
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
                    width: "300px",
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
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      {SOURCES.map((src) => (
                        <option key={src.id} value={src.id}>
                          {src.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      <option value="all">All Users</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!effectiveSiteId && (
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          background: "#ffffff",
                          outline: "none",
                        }}
                      >
                        <option value="all">All Websites</option>
                        {availableSites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name || site.slug}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      {DATE_RANGES.map((dr) => (
                        <option key={dr.id} value={dr.id}>
                          {dr.label}
                        </option>
                      ))}
                    </select>

                    {dateRange === "custom" && (
                      <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>From:</span>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{
                              width: "100%",
                              height: "30px",
                              padding: "0 8px",
                              borderRadius: "5px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12px",
                              boxSizing: "border-box",
                              marginTop: "2px",
                            }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>To:</span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{
                              width: "100%",
                              height: "30px",
                              padding: "0 8px",
                              borderRadius: "5px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12px",
                              boxSizing: "border-box",
                              marginTop: "2px",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
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
                        background: "#2563eb",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        padding: "5px 12px",
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
              paddingTop: "6px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, marginRight: "2px" }}>
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

            {selectedUser !== "all" && (
              <span style={chipStyle}>
                <span>
                  User: {availableUsers.find((u) => u.id === selectedUser)?.name || selectedUser}
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
                  Site: {availableSites.find((s) => s.id === selectedSite)?.name || selectedSite}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSite("all")}
                  style={chipCloseStyle}
                  title="Remove website filter"
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
              background: "#ffffff",
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
      {/* 4. ACTION BAR JUST ABOVE CARDS (TAB TITLE + EXPORT CSV)            */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          gap: "12px",
        }}
      >
        {/* Left: Tab / Heading */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            Activity Logs
          </span>
          {totalCount > 0 && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "1px 7px",
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
              }}
            >
              {totalCount}
            </span>
          )}
        </div>

        {/* Right: Export CSV Button */}
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={loading || totalCount === 0}
          style={{
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "5px 13px",
            height: "32px",
            fontSize: "12.5px",
            fontWeight: 600,
            cursor: loading || totalCount === 0 ? "not-allowed" : "pointer",
            opacity: loading || totalCount === 0 ? 0.7 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (!loading && totalCount > 0) e.currentTarget.style.background = "#1d4ed8";
          }}
          onMouseLeave={(e) => {
            if (!loading && totalCount > 0) e.currentTarget.style.background = "#2563eb";
          }}
        >
          <DownloadIcon />
          <span>Export CSV</span>
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. EVENT LOGS TABLE (CLEAN ACCORDION ROWS)                        */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Column Headers Bar (matching user's reference) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "9px 16px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontSize: "11px",
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            userSelect: "none",
          }}
        >
          <div style={{ width: "175px", flexShrink: 0 }}>Timestamp ▼</div>
          <div style={{ width: "115px", flexShrink: 0 }}>Category</div>
          <div style={{ width: "165px", flexShrink: 0 }}>Actor</div>
          <div style={{ flex: 1, minWidth: 0 }}>Activity Description</div>
          <div style={{ width: "24px", flexShrink: 0, textAlign: "right" }} />
        </div>

        {loading && logs.length === 0 ? (
          // Loading Skeleton Rows
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                padding: "11px 16px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ width: "175px", flexShrink: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f1f5f9" }} />
                <div style={{ width: "130px", height: "13px", borderRadius: "4px", background: "#f1f5f9" }} />
              </div>
              <div style={{ width: "115px", flexShrink: 0 }}>
                <div style={{ width: "70px", height: "18px", borderRadius: "4px", background: "#f1f5f9" }} />
              </div>
              <div style={{ width: "165px", flexShrink: 0, display: "flex", alignItems: "center", gap: "7px" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#f1f5f9" }} />
                <div style={{ width: "90px", height: "13px", borderRadius: "4px", background: "#f1f5f9" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: "70%", height: "13px", borderRadius: "4px", background: "#f1f5f9" }} />
              </div>
              <div style={{ width: "24px", flexShrink: 0 }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: "#f1f5f9", marginLeft: "auto" }} />
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
                  background: "#f1f5f9",
                  color: "#64748b",
                  display: "inline-grid",
                  placeItems: "center",
                  marginBottom: "14px",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                {isFiltered ? "No matching events found" : "No activity recorded yet"}
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
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
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
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
            const catTheme = getCategoryTheme(log.category);
            const roleBadge = getRoleBadge(log.actor_role);
            const srcBadge = getSourceBadge(log.source, log.actor_type);
            const summaryText = log.summary || log.description;
            const isLast = index === logs.length - 1;

            return (
              <div
                key={log.id}
                style={{
                  borderBottom: isLast && !isExpanded ? "none" : "1px solid #f1f5f9",
                  transition: "background 0.12s ease",
                }}
              >
                {/* Collapsed Event Row (Strictly Single Row) */}
                <div
                  onClick={() => toggleExpand(log.id)}
                  style={{
                    padding: "11px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    cursor: "pointer",
                    background: isExpanded ? "#f8fafc" : "#ffffff",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = "#fbfcfd";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = "#ffffff";
                  }}
                >
                  {/* 1. Timestamp Column */}
                  <div
                    style={{
                      width: "175px",
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
                        background: log.status === "failure" ? "#ef4444" : "#22c55e",
                        flexShrink: 0,
                      }}
                      title={`Status: ${log.status}`}
                    />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                      {dateInfo.formatted}
                    </span>
                  </div>

                  {/* 2. Category Column */}
                  <div style={{ width: "115px", flexShrink: 0 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1.5px 7px",
                        borderRadius: "4px",
                        background: catTheme.bg,
                        color: catTheme.color,
                        border: `1px solid ${catTheme.border}`,
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {log.category_label || catTheme.label}
                    </span>
                  </div>

                  {/* 3. Actor Column */}
                  <div
                    style={{
                      width: "165px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "#0f172a",
                        color: "#ffffff",
                        fontSize: "9px",
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {getUserInitials(log.actor_name)}
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#334155",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={log.actor_name || "System"}
                    >
                      {log.actor_name || "System"}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        background: roleBadge.bg,
                        color: roleBadge.color,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {roleBadge.text}
                    </span>
                  </div>

                  {/* 4. Activity Description Column (Single-line, strictly one row) */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "13px",
                      color: "#0f172a",
                      fontWeight: 500,
                    }}
                    title={summaryText}
                  >
                    {summaryText}
                  </div>

                  {/* 5. Chevron Column */}
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
                      padding: "16px 20px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    {/* Top metadata grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "14px",
                        marginBottom: "16px",
                        background: "#ffffff",
                        padding: "14px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {/* Actor Information */}
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                          Actor / Initiator
                        </div>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>
                          {log.actor_name || "System"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {log.actor_email || "system@webcreon.internal"}
                        </div>
                        <div style={{ marginTop: "4px" }}>
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 600,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: roleBadge.bg,
                              color: roleBadge.color,
                              border: `1px solid ${roleBadge.border}`,
                            }}
                          >
                            {roleBadge.text}
                          </span>
                        </div>
                      </div>

                      {/* Origin & Environment */}
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                          Origin & Client
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>
                            {srcBadge.icon} {srcBadge.text}
                          </span>
                          {log.actor_type && (
                            <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>
                              ({log.actor_type})
                            </span>
                          )}
                        </div>
                        {log.ip_address && (
                          <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                            IP: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: "3px" }}>{log.ip_address}</code>
                          </div>
                        )}
                        {log.user_agent && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#94a3b8",
                              marginTop: "2px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "280px",
                            }}
                            title={log.user_agent}
                          >
                            {log.user_agent}
                          </div>
                        )}
                      </div>

                      {/* Scope & Affected Resource */}
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                          Scope & Resource
                        </div>
                        <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600 }}>
                          {log.site_name ? `Store: ${log.site_name}` : "Organization Level"}
                        </div>
                        {(log.resource_name || log.resource_type || log.resource_id) && (
                          <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                            {log.resource_name && <span><strong>{log.resource_name}</strong> </span>}
                            {log.resource_type && <span style={{ textTransform: "capitalize", color: "#64748b" }}>({log.resource_type})</span>}
                            {log.resource_id && (
                              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                ID: {log.resource_id}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Execution Details */}
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", marginBottom: "4px" }}>
                          Execution & Time
                        </div>
                        <div style={{ fontSize: "12px", color: "#0f172a", fontWeight: 600 }}>
                          {dateInfo.formatted}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          UTC: {new Date(log.created_at).toISOString()}
                        </div>
                        {log.correlation_id && (
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                            Trace: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: "3px" }}>{log.correlation_id}</code>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Transaction & Financial Highlights */}
                    {log.details && (log.category === "financial" || log.details.amount !== undefined || log.details.payout_amount !== undefined || log.details.awb_code) && (
                      <div style={{ marginBottom: "14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#15803d", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>💳</span> Transaction & Execution Highlights
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "12.5px" }}>
                          {(log.details.amount !== undefined || log.details.payout_amount !== undefined) && (
                            <div>
                              <div style={{ fontSize: "11px", color: "#166534" }}>Amount</div>
                              <div style={{ fontSize: "15px", fontWeight: 700, color: "#14532d" }}>
                                ₹{Number(log.details.amount || log.details.payout_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          {log.details.masked_account_number && (
                            <div>
                              <div style={{ fontSize: "11px", color: "#166534" }}>Destination Account</div>
                              <div style={{ fontWeight: 600, color: "#14532d" }}>{log.details.masked_account_number}</div>
                            </div>
                          )}
                          {log.details.awb_code && (
                            <div>
                              <div style={{ fontSize: "11px", color: "#166534" }}>AWB / Courier Ref</div>
                              <div style={{ fontWeight: 600, color: "#14532d" }}>{log.details.awb_code}</div>
                            </div>
                          )}
                          {log.details.current_status && (
                            <div>
                              <div style={{ fontSize: "11px", color: "#166534" }}>Status</div>
                              <div style={{ fontWeight: 600, color: "#14532d", textTransform: "capitalize" }}>{log.details.current_status}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Changes Made (Diffs: Before ➔ After) */}
                    {log.details && (log.details.before || log.details.after) && (
                      <div style={{ marginBottom: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#475569", marginBottom: "6px" }}>
                          Changes Made (State Diffs)
                        </div>
                        <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                          {Object.keys(log.details.after || {}).map((key) => {
                            const beforeVal = log.details?.before?.[key];
                            const afterVal = log.details?.after?.[key];
                            if (beforeVal === undefined && afterVal === undefined) return null;

                            const formatVal = (v: any) => {
                              if (v === null || v === undefined) return <em style={{ color: "#94a3b8" }}>none</em>;
                              if (typeof v === "boolean") return v ? "true" : "false";
                              if (Array.isArray(v)) return v.join(", ") || "(empty)";
                              if (key.includes("price") || key.includes("cost") || key.includes("amount")) {
                                return `₹${v}`;
                              }
                              return String(v);
                            };

                            return (
                              <div
                                key={key}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "9px 14px",
                                  borderBottom: "1px solid #f1f5f9",
                                  fontSize: "12.5px",
                                }}
                              >
                                <span style={{ fontWeight: 600, color: "#334155", textTransform: "capitalize" }}>
                                  {key.replace(/_/g, " ")}:
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ color: "#64748b", textDecoration: beforeVal !== undefined ? "line-through" : "none" }}>
                                    {formatVal(beforeVal)}
                                  </span>
                                  <span style={{ color: "#94a3b8" }}>➔</span>
                                  <span style={{ fontWeight: 600, color: "#15803d", background: "#f0fdf4", padding: "1px 6px", borderRadius: "4px" }}>
                                    {formatVal(afterVal)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Raw Metadata & JSON Payload */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <details style={{ borderRadius: "8px", border: "1px solid #e2e8f0", background: "#ffffff", padding: "10px 14px" }}>
                        <summary style={{ fontSize: "12px", fontWeight: 600, color: "#475569", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>Raw Event Payload & Metadata</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCopyJson(log.id, log.details);
                            }}
                            style={{
                              padding: "3px 9px",
                              borderRadius: "5px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            {copiedId === log.id ? "Copied!" : "Copy JSON"}
                          </button>
                        </summary>
                        <pre
                          style={{
                            marginTop: "10px",
                            padding: "10px 12px",
                            background: "#0f172a",
                            color: "#f8fafc",
                            borderRadius: "6px",
                            fontSize: "11px",
                            overflowX: "auto",
                            fontFamily: "monospace",
                            lineHeight: 1.45,
                          }}
                        >
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pagination controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "12.5px",
            color: "#64748b",
          }}
        >
          <div>
            {totalCount > 0 ? (
              <span>
                Showing <strong style={{ color: "#0f172a" }}>{(page - 1) * pageSize + 1}</strong> to{" "}
                <strong style={{ color: "#0f172a" }}>{Math.min(page * pageSize, totalCount)}</strong> of{" "}
                <strong style={{ color: "#0f172a" }}>{totalCount}</strong> activities
              </span>
            ) : (
              <span>No activities</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Page Size Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  height: "28px",
                  padding: "0 6px",
                  borderRadius: "5px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: "12px",
                  color: "#0f172a",
                  outline: "none",
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Pagination Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                style={{
                  padding: "4px 10px",
                  borderRadius: "5px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: page <= 1 ? "#94a3b8" : "#334155",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <span style={{ padding: "0 6px", fontWeight: 600, color: "#0f172a" }}>
                {page} / {Math.max(1, totalPages)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                style={{
                  padding: "4px 10px",
                  borderRadius: "5px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: page >= totalPages ? "#94a3b8" : "#334155",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Retention notice */}
      <div style={{ marginTop: "12px", textAlign: "right", fontSize: "11.5px", color: "#94a3b8" }}>
        Activities are automatically and securely retained for 90 days.
      </div>
    </div>
  );
}
