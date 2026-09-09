import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AccessDeniedView } from "./AccessDeniedView";
import { GlassToast } from "./GlassToast";

export type AuditLogItem = {
  id: string;
  site_id: string | null;
  admin_id: string | null;
  actor_email: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  category: "auth" | "orders" | "products" | "settings" | "security" | "general" | string;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  status: "success" | "warning" | "failure" | string;
  details: Record<string, any> | null;
  created_at: string;
};

export type AuditStats = {
  total_events: number;
  today_logins: number;
  security_events: number;
  active_actors: number;
};

const CATEGORIES = [
  { id: "all", label: "All Activity", icon: "📋" },
  { id: "auth", label: "Logins & Auth", icon: "🔑" },
  { id: "security", label: "Security Events", icon: "🛡️" },
  { id: "orders", label: "Orders & Fulfillment", icon: "📦" },
  { id: "products", label: "Products & Stock", icon: "🏷️" },
  { id: "settings", label: "Settings & Roles", icon: "⚙️" },
];

export default function AdminAuditLogs({ siteId: propSiteId }: { siteId?: string } = {}) {
  const { isOwner, hasPermission, loading: authLoading, admin } = useAdminAuth();
  const canView = isOwner || hasPermission("audit_logs:view") || !admin;

  const { siteId: routeSiteId } = useParams<{ siteId?: string }>();
  const effectiveSiteId = propSiteId || routeSiteId;

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total_events: 0,
    today_logins: 0,
    security_events: 0,
    active_actors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Log for detail modal
  const [inspectLog, setInspectLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async (isManualRefresh = false) => {
    if (!canView) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const endpoint = effectiveSiteId
        ? `${API_BASE_URL}/admin/sites/${effectiveSiteId}/audit-logs?${params.toString()}`
        : `${API_BASE_URL}/admin/audit-logs?${params.toString()}`;

      const res = await fetch(endpoint, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to load audit events (${res.status})`);
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error("Failed to load audit logs", err);
      setToast({ message: err.message || "Failed to load activity logs", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, statusFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [effectiveSiteId, selectedCategory, statusFilter, page, pageSize]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());

    const endpoint = effectiveSiteId
      ? `${API_BASE_URL}/admin/sites/${effectiveSiteId}/audit-logs/export-csv?${params.toString()}`
      : `${API_BASE_URL}/admin/audit-logs/export-csv?${params.toString()}`;

    window.open(endpoint, "_blank");
    setToast({ message: "Exporting activity logs CSV...", type: "info" });
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case "auth":
        return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "🔑" };
      case "security":
        return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", icon: "🛡️" };
      case "orders":
        return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", icon: "📦" };
      case "products":
        return { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff", icon: "🏷️" };
      case "settings":
        return { bg: "#fffbeb", color: "#b45309", border: "#fde68a", icon: "⚙️" };
      default:
        return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0", icon: "📋" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return { label: "Success", bg: "#dcfce7", color: "#15803d", dot: "#22c55e" };
      case "warning":
        return { label: "Warning", bg: "#fef3c7", color: "#92400e", dot: "#f59e0b" };
      case "failure":
      case "failed":
        return { label: "Failure", bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" };
      default:
        return { label: status, bg: "#f1f5f9", color: "#475569", dot: "#94a3b8" };
    }
  };

  if (!canView) {
    return (
      <AccessDeniedView
        title="Activity & Audit Logs Restricted"
        message="You do not have permission to view workspace activity events or admin login history."
        requiredPermission="audit_logs:view"
      />
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: "1280px", margin: "0 auto", color: "#0f172a", fontFamily: "inherit" }}>
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#0f172a" }}>
              Activity & Audit Logs
            </h1>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
              Live Audit Trail
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: "#64748b" }}>
            Real-time chronological record of administrative actions, user logins, security updates, and store operations.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 600,
              cursor: refreshing ? "wait" : "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: refreshing ? "rotate(180deg)" : "none", transition: "transform 0.4s ease" }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "#0f172a",
              border: "1px solid #0f172a",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(15,23,42,0.15)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* STATS SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Total Recorded Events
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
            {Number(stats?.total_events || 0).toLocaleString()}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Today's Admin Logins
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#1d4ed8" }}>
            {Number(stats?.today_logins || 0)}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: (stats?.security_events || 0) > 0 ? "#dc2626" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Security & Failures
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: (stats?.security_events || 0) > 0 ? "#b91c1c" : "#0f172a" }}>
            {Number(stats?.security_events || 0)}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Active Admins (7 Days)
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#047857" }}>
            {Number(stats?.active_actors || 0)}
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px 20px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Category Pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  border: isSelected ? "1px solid #2563eb" : "1px solid #e2e8f0",
                  background: isSelected ? "#eff6ff" : "#f8fafc",
                  color: isSelected ? "#1d4ed8" : "#475569",
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Controls */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "280px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, admin email, action name, IP address..."
                style={{
                  width: "100%",
                  padding: "9px 14px 9px 36px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  color: "#0f172a",
                  boxSizing: "border-box",
                  background: "#ffffff",
                }}
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: "2px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                color: "#334155",
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="success">Success Only</option>
              <option value="warning">Warnings</option>
              <option value="failure">Failures</option>
            </select>
          </div>

          <div style={{ fontSize: "12.5px", color: "#64748b" }}>
            Showing <strong>{logs.length}</strong> of <strong>{totalCount}</strong> events
          </div>
        </div>
      </div>

      {/* EVENT LOGS TABLE */}
      <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
            <div style={{ display: "inline-block", width: "28px", height: "28px", border: "3px solid #cbd5e1", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ marginTop: "12px", fontSize: "13px", fontWeight: 600 }}>Loading activity logs...</div>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>No Activity Events Found</div>
            <div style={{ fontSize: "13px", color: "#64748b", maxWidth: "400px", margin: "4px auto 16px" }}>
              {searchQuery || selectedCategory !== "all" || statusFilter !== "all"
                ? "No event records matched your filter criteria. Try resetting search filters."
                : "Activity logs will automatically populate as administrative actions, user logins, and store events occur."}
            </div>
            {(searchQuery || selectedCategory !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setStatusFilter("all");
                }}
                style={{ padding: "8px 14px", borderRadius: "8px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#334155", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <th style={{ padding: "12px 18px", width: "160px" }}>Timestamp</th>
                  <th style={{ padding: "12px 16px", width: "140px" }}>Category & Action</th>
                  <th style={{ padding: "12px 16px" }}>Event Description</th>
                  <th style={{ padding: "12px 16px", width: "220px" }}>Actor / Admin</th>
                  <th style={{ padding: "12px 16px", width: "100px" }}>Status</th>
                  <th style={{ padding: "12px 18px", width: "90px", textAlign: "right" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const catBadge = getCategoryBadgeStyle(log.category);
                  const stBadge = getStatusBadge(log.status);

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.1s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "12.5px" }}>
                          {formatRelativeTime(log.created_at)}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                        </div>
                      </td>

                      {/* Category & Action */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: catBadge.bg,
                            color: catBadge.color,
                            border: `1px solid ${catBadge.border}`,
                            fontSize: "11.5px",
                            fontWeight: 700,
                            marginBottom: "4px",
                          }}
                        >
                          <span>{catBadge.icon}</span>
                          <span style={{ textTransform: "capitalize" }}>{log.category}</span>
                        </span>
                        <div style={{ fontSize: "11.5px", color: "#64748b", fontFamily: "monospace" }}>
                          {log.action}
                        </div>
                      </td>

                      {/* Description */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ color: "#0f172a", fontWeight: 500, lineHeight: 1.4 }}>
                          {log.description}
                        </div>
                        {log.ip_address && (
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>
                            IP: <code>{log.ip_address}</code>
                          </div>
                        )}
                      </td>

                      {/* Actor */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "#e0e7ff",
                              color: "#4338ca",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 700,
                              fontSize: "11.5px",
                              flexShrink: 0,
                            }}
                          >
                            {(log.actor_name || log.actor_email || "A").slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "12.5px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {log.actor_name}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {log.actor_email || log.actor_role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: stBadge.bg,
                            color: stBadge.color,
                            fontSize: "11.5px",
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: stBadge.dot }} />
                          <span>{stBadge.label}</span>
                        </span>
                      </td>

                      {/* View Details */}
                      <td style={{ padding: "14px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => setInspectLog(log)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            color: "#334155",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ fontSize: "12.5px", color: "#64748b" }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total entries)
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: page <= 1 ? "#f1f5f9" : "#ffffff",
                  color: page <= 1 ? "#94a3b8" : "#334155",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: page >= totalPages ? "#f1f5f9" : "#ffffff",
                  color: page >= totalPages ? "#94a3b8" : "#334155",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INSPECT LOG DETAILS MODAL */}
      {inspectLog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
            boxSizing: "border-box",
          }}
          onClick={() => setInspectLog(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              boxSizing: "border-box",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: getCategoryBadgeStyle(inspectLog.category).bg,
                    color: getCategoryBadgeStyle(inspectLog.category).color,
                    border: `1px solid ${getCategoryBadgeStyle(inspectLog.category).border}`,
                    fontSize: "11.5px",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  <span>{getCategoryBadgeStyle(inspectLog.category).icon}</span>
                  <span style={{ textTransform: "capitalize" }}>{inspectLog.category}</span>
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  {inspectLog.description}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "10px", fontSize: "12.5px", color: "#475569", background: "#f8fafc", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Action Key:</span>
                <code style={{ fontWeight: 600, color: "#0f172a" }}>{inspectLog.action}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Status:</span>
                <span style={{ fontWeight: 700, textTransform: "capitalize", color: inspectLog.status === "success" ? "#15803d" : "#b91c1c" }}>
                  {inspectLog.status}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Timestamp (UTC):</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{new Date(inspectLog.created_at).toISOString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Actor:</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{inspectLog.actor_name} ({inspectLog.actor_email || "System"})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Actor Role:</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{inspectLog.actor_role}</span>
              </div>
              {inspectLog.ip_address && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>IP Address:</span>
                  <code style={{ fontWeight: 600, color: "#0f172a" }}>{inspectLog.ip_address}</code>
                </div>
              )}
              {inspectLog.user_agent && (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "4px" }}>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "3px" }}>User Agent:</span>
                  <div style={{ fontSize: "11px", color: "#64748b", wordBreak: "break-all", background: "#ffffff", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    {inspectLog.user_agent}
                  </div>
                </div>
              )}
            </div>

            {inspectLog.details && Object.keys(inspectLog.details).length > 0 && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Event Payload & Details
                </div>
                <pre
                  style={{
                    background: "#0f172a",
                    color: "#f8fafc",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    overflowX: "auto",
                    fontFamily: "monospace",
                    lineHeight: 1.4,
                  }}
                >
                  {JSON.stringify(inspectLog.details, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ marginTop: "18px", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
