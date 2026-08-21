import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { Pagination } from "./Pagination";
import GlassToast from "./GlassToast";

type LedgerEntry = {
  id: string;
  order_id: string;
  order_number: string;
  created_at: string;
  gross_amount: number;
  platform_fee: number;
  platform_fee_percent: number;
  tenant_share: number;
  status: string;
  currency: string;
  razorpay_transfer_id?: string | null;
  transfer_status?: string | null;
  escrow_status?: string | null;
  escrow_release_due_at?: string | null;
  unheld_at?: string | null;
  return_window_closes_at?: string | null;
  settled_at?: string | null;
};

type EarningsSummaryData = {
  gross_gmv: number;
  total_platform_fees: number;
  total_net_earnings: number;
  pending_payout: number;
  escrow_balance: number;
  settled_payouts: number;
  platform_commission_percent: number;
  total_orders_count: number;
  bank_configured: boolean;
  ledger_entries: LedgerEntry[];
  total_pages: number;
  current_page: number;
};

type DateFilter = "all" | "today" | "last_7_days" | "last_30_days" | "custom";
type SortOrder = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

// Minimal SVG Icons
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
    style={{ animation: spin ? "spin 0.65s linear infinite" : "none" }}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export default function TenantEarningsPage() {
  const { siteId } = useParams<{ siteId: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releasingEscrow, setReleasingEscrow] = useState(false);
  const [data, setData] = useState<EarningsSummaryData | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("last_30_days");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date_desc");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Close filter popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  const fetchEarnings = async (mode: boolean | "silent" = false) => {
    if (!siteId) return;
    try {
      if (mode === true) {
        setRefreshing(true);
      } else if (mode !== "silent") {
        setLoading(true);
      }
      const res = await fetch(
        `${API_BASE_URL}/admin/${siteId}/earnings?page=1&limit=100`,
        { credentials: "include" }
      );

      if (res.ok) {
        const json: EarningsSummaryData = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load earnings summary", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarnings(false);
  }, [siteId]);

  const handleReleaseMatureEscrows = async () => {
    if (!siteId || releasingEscrow) return;
    try {
      setReleasingEscrow(true);
      setFeedback(null);
      const res = await fetch(`${API_BASE_URL}/admin/${siteId}/release-mature-escrows`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback({ text: json.message || "Payouts processed successfully.", type: "success" });
        await fetchEarnings("silent");
      } else {
        setFeedback({ text: json.detail || "Failed to process payouts.", type: "error" });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || "Network error while releasing payouts.", type: "error" });
    } finally {
      setReleasingEscrow(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Filter & Search Logic
  const allEntries = useMemo(() => data?.ledger_entries || [], [data]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter((entry) => {
      // 1. Search Query (order_number, order_id, transfer_id, amount)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase().replace("#", "");
        const matchNumber = entry.order_number?.toLowerCase().includes(q);
        const matchId = entry.order_id?.toLowerCase().includes(q);
        const matchTransfer = entry.razorpay_transfer_id?.toLowerCase().includes(q);
        const matchGross = entry.gross_amount.toString().includes(q);
        const matchNet = entry.tenant_share.toString().includes(q);
        if (!matchNumber && !matchId && !matchTransfer && !matchGross && !matchNet) {
          return false;
        }
      }

      // 2. Status Popover Filter (if explicitly set)
      if (statusFilter !== "all") {
        const isSettled = entry.status === "paid" && entry.escrow_status === "unheld";
        const isEscrow = entry.escrow_status === "held" && entry.status !== "paid" && entry.status !== "refunded";
        const isRefunded = entry.status === "refunded" || entry.escrow_status === "reversed";

        if (statusFilter === "settled" && !isSettled) return false;
        if (statusFilter === "escrow" && !isEscrow) return false;
        if (statusFilter === "refunded" && !isRefunded) return false;
        if (statusFilter === "pending" && entry.status !== "pending_payout") return false;
      }

      // 4. Date Range Filter
      if (dateFilter !== "all" && entry.created_at) {
        const entryDate = new Date(entry.created_at).getTime();
        const now = Date.now();

        if (dateFilter === "today") {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          if (entryDate < startOfToday.getTime()) return false;
        } else if (dateFilter === "last_7_days") {
          if (entryDate < now - 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateFilter === "last_30_days") {
          if (entryDate < now - 30 * 24 * 60 * 60 * 1000) return false;
        } else if (dateFilter === "custom") {
          if (customFromDate && entryDate < new Date(customFromDate).getTime()) return false;
          if (customToDate) {
            const toEnd = new Date(customToDate);
            toEnd.setHours(23, 59, 59, 999);
            if (entryDate > toEnd.getTime()) return false;
          }
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortOrder === "date_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOrder === "date_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOrder === "amount_desc") {
        return b.tenant_share - a.tenant_share;
      }
      if (sortOrder === "amount_asc") {
        return a.tenant_share - b.tenant_share;
      }
      return 0;
    });
  }, [allEntries, searchQuery, statusFilter, dateFilter, customFromDate, customToDate, sortOrder]);

  // Active Filters Count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateFilter !== "last_30_days") count++;
    if (statusFilter !== "all") count++;
    if (sortOrder !== "date_desc") count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [dateFilter, statusFilter, sortOrder, searchQuery]);

  const resetFilters = () => {
    setSearchQuery("");
    setDateFilter("last_30_days");
    setCustomFromDate("");
    setCustomToDate("");
    setStatusFilter("all");
    setSortOrder("date_desc");
    setCurrentPage(1);
  };

  // Paginated Slicing
  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  // Design Tokens
  const plainCardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  };

  if (loading && !data) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
        Loading earnings & ledger...
      </div>
    );
  }

  const gmv = data?.gross_gmv || 0;
  const platformFees = data?.total_platform_fees || 0;
  const escrowBalance = data?.escrow_balance || 0;
  const settledPayouts = data?.settled_payouts || 0;
  const feePercent = data?.platform_commission_percent || 3.0;

  return (
    <div style={{ width: "100%", maxWidth: "100%", color: "#0f172a", boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 0.65s linear infinite;
        }
      `}</style>

      {/* Floating Glass Toast Notification */}
      {feedback && (
        <GlassToast
          message={feedback.text}
          type={feedback.type}
          onClose={() => setFeedback(null)}
          top="76px"
        />
      )}

      {/* Unconfigured Bank Alert (Only shown if bank settings are missing) */}
      {data && !data.bank_configured && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "10px 16px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <div style={{ color: "#92400e" }}>
            <strong>Bank account not linked.</strong> Add your account details to receive automatic 48-hour order payouts.
          </div>
          <Link
            to={`/builder/${siteId}/admin/payment-settings`}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Configure Bank →
          </Link>
        </div>
      )}

      {/* Top Header Card: Action Controls on Left + Search & Filter on Right (Matching Orders Page Top Bar) */}
      <div
        style={{
          ...plainCardStyle,
          padding: "10px 14px",
          marginBottom: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Left Side: Release Mature Escrows & Refresh Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleReleaseMatureEscrows}
              disabled={releasingEscrow}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                height: "36px",
                minWidth: "190px",
                padding: "0 14px",
                borderRadius: "7px",
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: releasingEscrow ? "wait" : "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                transition: "background 0.15s ease",
              }}
            >
              {releasingEscrow ? (
                <>
                  <svg className="spin-animation" viewBox="0 0 24 24" fill="none" style={{ width: 13, height: 13 }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" />
                  </svg>
                  <span>Releasing Escrows...</span>
                </>
              ) : (
                <span>Release Mature Escrows</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => fetchEarnings(true)}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                height: "36px",
                minWidth: "98px",
                padding: "0 12px",
                borderRadius: "7px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 600,
                cursor: refreshing ? "wait" : "pointer",
                transition: "background 0.15s ease",
              }}
              title="Refresh ledger records"
            >
              <RefreshIcon spin={refreshing} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>

          {/* Right Side: Search Bar & Filter Toggle Button */}
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
            <div style={{ position: "relative", flex: 1 }}>
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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search transactions, order #, transfer ID, amount..."
                style={{
                  ...inputStyle,
                  paddingLeft: "34px",
                  paddingRight: searchQuery ? "28px" : "12px",
                  fontSize: "13px",
                  height: "36px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  width: "100%",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
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
            <div style={{ position: "relative" }} ref={filterPopoverRef}>
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

              {/* Filter Popover Dropdown */}
              {isFilterOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "42px",
                    right: 0,
                    width: "300px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    padding: "14px",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Filter Transactions</div>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                    >
                      <XMarkIcon />
                    </button>
                  </div>

                  {/* Date Range */}
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px", textTransform: "uppercase" }}>
                      Date Range
                    </label>
                    <select
                      value={dateFilter}
                      onChange={(e) => {
                        setDateFilter(e.target.value as DateFilter);
                        setCurrentPage(1);
                      }}
                      style={{ ...inputStyle, width: "100%", height: "34px", padding: "0 8px" }}
                    >
                      <option value="last_30_days">Last 30 Days (Default)</option>
                      <option value="today">Today</option>
                      <option value="last_7_days">Last 7 Days</option>
                      <option value="all">All Time</option>
                      <option value="custom">Custom Date Range...</option>
                    </select>

                    {dateFilter === "custom" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                        <input
                          type="date"
                          value={customFromDate}
                          onChange={(e) => {
                            setCustomFromDate(e.target.value);
                            setCurrentPage(1);
                          }}
                          style={{ ...inputStyle, width: "50%", fontSize: "12px", height: "30px", padding: "0 4px" }}
                        />
                        <span style={{ fontSize: "11px", color: "#64748b" }}>to</span>
                        <input
                          type="date"
                          value={customToDate}
                          onChange={(e) => {
                            setCustomToDate(e.target.value);
                            setCurrentPage(1);
                          }}
                          style={{ ...inputStyle, width: "50%", fontSize: "12px", height: "30px", padding: "0 4px" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Settlement Status */}
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px", textTransform: "uppercase" }}>
                      Settlement Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ ...inputStyle, width: "100%", height: "34px", padding: "0 8px" }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="settled">Settled to Bank</option>
                      <option value="escrow">In Escrow Hold</option>
                      <option value="pending">Pending Payout</option>
                      <option value="refunded">Refunded / Reversed</option>
                    </select>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px", textTransform: "uppercase" }}>
                      Sort By
                    </label>
                    <select
                      value={sortOrder}
                      onChange={(e) => {
                        setSortOrder(e.target.value as SortOrder);
                        setCurrentPage(1);
                      }}
                      style={{ ...inputStyle, width: "100%", height: "34px", padding: "0 8px" }}
                    >
                      <option value="date_desc">Newest First (Default)</option>
                      <option value="date_asc">Oldest First</option>
                      <option value="amount_desc">Highest Net Amount</option>
                      <option value="amount_asc">Lowest Net Amount</option>
                    </select>
                  </div>

                  {/* Action footer */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: "8px",
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        resetFilters();
                        setIsFilterOpen(false);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc2626",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "4px 6px",
                      }}
                    >
                      Reset All
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      style={{
                        background: "#0f172a",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "6px 14px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              paddingTop: "4px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, marginRight: "2px" }}>
              Active:
            </span>

            {searchQuery.trim() && (
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
                <span>Search: "{searchQuery.trim()}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {dateFilter !== "last_30_days" && (
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
                <span>Date: {dateFilter === "all" ? "All Time" : dateFilter.replace(/_/g, " ")}</span>
                <button
                  type="button"
                  onClick={() => setDateFilter("last_30_days")}
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
                <span>Status: {statusFilter}</span>
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
              onClick={resetFilters}
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

      {/* Collection Metric Summary Boxes (Placed ABOVE the Tabs) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        {/* Gross Sales */}
        <div style={{ ...plainCardStyle, padding: "10px 14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Gross Sales (GMV)
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
            {formatCurrency(gmv)}
          </div>
          <div style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: "2px" }}>
            {data?.total_orders_count || 0} online orders
          </div>
        </div>

        {/* In Escrow Hold */}
        <div style={{ ...plainCardStyle, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              In Escrow Hold
            </span>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#d97706" }}>
              Pending
            </span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#d97706", marginTop: "2px" }}>
            {formatCurrency(escrowBalance)}
          </div>
          <div style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: "2px" }}>
            Clears after return window
          </div>
        </div>

        {/* Settled to Bank */}
        <div style={{ ...plainCardStyle, padding: "10px 14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Settled to Bank
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#16a34a", marginTop: "2px" }}>
            {formatCurrency(settledPayouts)}
          </div>
          <div style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: "2px" }}>
            Transferred directly to bank
          </div>
        </div>

        {/* Platform Fee */}
        <div style={{ ...plainCardStyle, padding: "10px 14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Platform Fee ({feePercent}%)
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#dc2626", marginTop: "2px" }}>
            -{formatCurrency(platformFees)}
          </div>
          <div style={{ fontSize: "10.5px", color: "#94a3b8", marginTop: "2px" }}>
            Platform software commission
          </div>
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div style={{ ...plainCardStyle, overflow: "hidden" }}>
        {filteredEntries.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
              {activeFilterCount > 0 ? "No matching ledger records" : "No records in this tab."}
            </div>
            <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
              {activeFilterCount > 0
                ? "Try adjusting your search query, status filters, or date range."
                : "Completed customer orders will automatically record financial ledger entries here."}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  marginTop: "12px",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  background: "#0f172a",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Date & Time</th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Order</th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Gross (GMV)</th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Platform Fee</th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Net Payout</th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Settlement Status</th>
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntries.map((entry) => {
                  const isSettled = entry.status === "paid" && entry.escrow_status === "unheld";
                  const isEscrowHeld = entry.escrow_status === "held" && entry.status !== "paid" && entry.status !== "refunded";
                  const isRefunded = entry.status === "refunded" || entry.escrow_status === "reversed";
                  const isExpanded = expandedId === entry.id;

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: isExpanded ? "#f8fafc" : "#ffffff",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                      >
                        {/* Date */}
                        <td style={{ padding: "12px 16px", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatDate(entry.created_at)}
                        </td>

                        {/* Order */}
                        <td style={{ padding: "12px 16px" }}>
                          <Link
                            to={`/builder/${siteId}/admin/orders?orderId=${entry.order_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontWeight: 700,
                              color: "#0f172a",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Open order in Orders page"
                          >
                            <span>#{entry.order_number}</span>
                            <span style={{ fontSize: "10.5px", color: "#2563eb" }}>↗</span>
                          </Link>
                        </td>

                        {/* Gross */}
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                          {formatCurrency(entry.gross_amount)}
                        </td>

                        {/* Fee */}
                        <td style={{ padding: "12px 16px", color: "#dc2626", fontWeight: 500 }}>
                          -{formatCurrency(entry.platform_fee)}
                        </td>

                        {/* Net */}
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#16a34a" }}>
                          {formatCurrency(entry.tenant_share)}
                        </td>

                        {/* Status (Minimal Colored Dot & Text - No Loud Heavy Backgrounds) */}
                        <td style={{ padding: "12px 16px" }}>
                          {isSettled ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#16a34a", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                              Settled to Bank
                            </span>
                          ) : isEscrowHeld ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#d97706", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }} />
                              In Escrow Hold
                            </span>
                          ) : isRefunded ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#dc2626", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                              Refunded / Reversed
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#475569", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#64748b" }} />
                              {entry.status}
                            </span>
                          )}
                        </td>

                        {/* Transfer Ref */}
                        <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace", fontSize: "11.5px" }}>
                          {entry.razorpay_transfer_id || "—"}
                        </td>
                      </tr>

                      {/* Expandable Breakdown Drawer */}
                      {isExpanded && (
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <td colSpan={7} style={{ padding: "14px 20px" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: "12px",
                                fontSize: "12px",
                                color: "#475569",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 700, color: "#0f172a" }}>Order Reference:</span>{" "}
                                <Link
                                  to={`/builder/${siteId}/admin/orders?orderId=${entry.order_id}`}
                                  style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                                >
                                  View #{entry.order_number} in Orders →
                                </Link>
                              </div>
                              <div>
                                <span style={{ fontWeight: 700, color: "#0f172a" }}>Split Ratio:</span>{" "}
                                97% Merchant / 3% Platform Fee
                              </div>
                              {entry.return_window_closes_at && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "#0f172a" }}>Return Window Lock Closes:</span>{" "}
                                  {formatDate(entry.return_window_closes_at)}
                                </div>
                              )}
                              {entry.settled_at && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "#0f172a" }}>Settled On:</span>{" "}
                                  {formatDate(entry.settled_at)}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination and page size controls (Outside the table card, matching Orders & Products page) */}
      {filteredEntries.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "16px",
            padding: "8px 4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748b" }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setCurrentPage(page);
            }}
            totalItems={filteredEntries.length}
            pageSize={pageSize}
            showRangeText={true}
            accentColor="#2563eb"
            style={{ padding: 0 }}
          />
        </div>
      )}
    </div>
  );
}
