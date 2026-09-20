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
  platform_commission_base?: number | null;
  platform_fee_gst?: number | null;
  total_platform_fee_with_gst?: number | null;
  gateway_fee?: number | null;
  gateway_fee_gst?: number | null;
  gst_tcs?: number | null;
  tds_194o?: number | null;
  tds_rate_applied?: number | null;
  is_cod?: boolean;
  cod_fee_status?: "cooling" | "deducted" | "waived_returned" | string | null;
  cod_fee_deduction_due_at?: string | null;
  cod_fee_deducted_at?: string | null;
  cod_buffer_days?: number;
  status: string;
  currency: string;
  razorpay_transfer_id?: string | null;
  transfer_status?: string | null;
  escrow_status?: string | null;
  escrow_release_due_at?: string | null;
  unheld_at?: string | null;
  return_window_closes_at?: string | null;
  settled_at?: string | null;
  order_status?: string | null;
  payment_method?: string | null;
  delivered_at?: string | null;
  hold_reason_code?: string | null;
  hold_reason_title?: string | null;
  hold_reason_detail?: string | null;
  blocking_reference?: string | null;
};

type EarningsSummaryData = {
  gross_gmv: number;
  total_platform_fees: number;
  total_net_earnings: number;
  pending_payout: number;
  escrow_balance: number;
  settled_payouts: number;
  online_gross_amount?: number;
  online_refunded_amount?: number;
  online_net_amount?: number;
  cod_gross_amount?: number;
  cod_refunded_amount?: number;
  cod_net_amount?: number;
  cod_platform_fees_due?: number;
  cod_platform_fees_cooling?: number;
  cod_platform_fees_deducted?: number;
  refund_gateway_fees_due?: number;
  total_dues_owed_to_platform?: number;
  net_payable_to_merchant?: number;
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

const DownloadIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

function InfoTooltip({
  text,
  align = "center",
}: {
  text: string;
  align?: "left" | "right" | "center";
}) {
  const [hovered, setHovered] = useState(false);

  const getPopupStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      background: "#0f172a",
      color: "#ffffff",
      fontSize: "11.5px",
      fontWeight: 500,
      lineHeight: 1.45,
      padding: "8px 12px",
      borderRadius: "6px",
      width: "max-content",
      maxWidth: "250px",
      whiteSpace: "normal",
      wordBreak: "break-word",
      textAlign: "left",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
      zIndex: 999999,
      pointerEvents: "none",
      fontFamily: "'Inter', sans-serif",
    };

    if (align === "left") {
      return { ...base, left: "-4px", right: "auto" };
    }
    if (align === "right") {
      return { ...base, right: "-4px", left: "auto" };
    }
    return { ...base, left: "50%", transform: "translateX(-50%)" };
  };

  const getArrowStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      top: "100%",
      width: 0,
      height: 0,
      borderLeft: "5px solid transparent",
      borderRight: "5px solid transparent",
      borderTop: "5px solid #0f172a",
    };

    if (align === "left") {
      return { ...base, left: "8px" };
    }
    if (align === "right") {
      return { ...base, right: "8px" };
    }
    return { ...base, left: "50%", transform: "translateX(-50%)" };
  };

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setHovered((prev) => !prev);
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: "13px", height: "13px", color: hovered ? "#2563eb" : "#94a3b8", transition: "color 0.15s ease", flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {hovered && (
        <div style={getPopupStyle()}>
          {text}
          <div style={getArrowStyle()} />
        </div>
      )}
    </div>
  );
}

function EscrowReleaseIconButton({
  onClick,
  disabled,
  active,
  loading,
}: {
  onClick: () => void;
  disabled: boolean;
  active: boolean;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "5px",
          border: "1px solid",
          borderColor: active ? "#fde68a" : "#e2e8f0",
          background: active ? "#fef3c7" : "#f8fafc",
          color: active ? "#b45309" : "#94a3b8",
          cursor: disabled ? "default" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          transition: "all 0.15s ease",
        }}
        title="Release mature escrows"
      >
        {loading ? (
          <svg className="spin-animation" viewBox="0 0 24 24" fill="none" style={{ width: 12, height: 12 }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        )}
      </button>
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            background: "#0f172a",
            color: "#ffffff",
            fontSize: "11.5px",
            fontWeight: 500,
            lineHeight: 1.45,
            padding: "8px 12px",
            borderRadius: "6px",
            width: "max-content",
            maxWidth: "220px",
            whiteSpace: "normal",
            wordBreak: "break-word",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
            zIndex: 999999,
            pointerEvents: "none",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {active ? "Release mature escrows to bank" : "No mature escrows available"}
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: "6px",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #0f172a",
            }}
          />
        </div>
      )}
    </div>
  );
}

const getCachedEarnings = (id?: string): EarningsSummaryData | null => {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`wc_admin_earnings_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function TenantEarningsPage({ siteId: propSiteId }: { siteId?: string } = {}) {
  const { siteId: paramSiteId } = useParams<{ siteId: string }>();
  const siteId = propSiteId || paramSiteId || (typeof window !== "undefined" ? localStorage.getItem("last_active_site_id") || "" : "");
  const initialData = getCachedEarnings(siteId);
  const [data, setData] = useState<EarningsSummaryData | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [releasingEscrow, setReleasingEscrow] = useState(false);
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

  const fetchEarnings = async (
    mode: boolean | "silent" = false,
    page = currentPage,
    limit = pageSize,
    date = dateFilter,
    status = statusFilter,
    search = searchQuery,
    fromD = customFromDate,
    toD = customToDate,
    sort = sortOrder
  ) => {
    if (!siteId) return;
    try {
      if (mode === true) {
        setRefreshing(true);
      } else if (mode !== "silent" && !data) {
        setLoading(true);
      }

      const qParams = new URLSearchParams();
      qParams.set("page", String(page));
      qParams.set("limit", String(limit));
      if (date) qParams.set("date_filter", date);
      if (status && status !== "all") qParams.set("status", status);
      if (search.trim()) qParams.set("search", search.trim());
      if (fromD) qParams.set("from_date", fromD);
      if (toD) qParams.set("to_date", toD);
      if (sort) qParams.set("sort", sort);

      const res = await fetch(
        `${API_BASE_URL}/admin/${siteId}/earnings?${qParams.toString()}`,
        { credentials: "include" }
      );

      if (res.ok) {
        const json: EarningsSummaryData = await res.json();
        setData(json);
        if (page === 1 && date === "last_30_days" && status === "all" && !search.trim()) {
          try {
            localStorage.setItem(`wc_admin_earnings_${siteId}`, JSON.stringify(json));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error("Failed to load earnings summary", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!data) {
      setData(getCachedEarnings(siteId));
    }
    fetchEarnings(false, currentPage, pageSize, dateFilter, statusFilter, searchQuery, customFromDate, customToDate, sortOrder);
  }, [siteId, currentPage, pageSize, dateFilter, statusFilter, searchQuery, customFromDate, customToDate, sortOrder]);

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
        setFeedback({
          text: json.message || (json.released_count === 0 
            ? "No mature escrows to release."
            : `Released ${json.released_count} escrow payout(s).`),
          type: "success",
        });
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

  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    if (!siteId || isExportingCsv || loading || filteredEntries.length === 0) return;
    setIsExportingCsv(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery && searchQuery.trim()) params.set("search", searchQuery.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      params.set("date_filter", dateFilter);
      if (dateFilter === "custom") {
        if (customFromDate) params.set("from_date", customFromDate);
        if (customToDate) params.set("to_date", customToDate);
      }
      if (sortOrder) params.set("sort_by", sortOrder);

      const qs = params.toString();
      const endpoint = `${API_BASE_URL}/admin/${siteId}/earnings/export-csv${qs ? `?${qs}` : ""}`;

      const res = await fetch(endpoint, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Earnings_Ledger_${siteId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      setFeedback({
        text: "Earnings & settlement ledger statement (.csv) downloaded successfully.",
        type: "success",
      });
    } catch (err: any) {
      console.error("CSV Export failed:", err);
      setFeedback({
        text: err.message || "Failed to download settlement CSV statement.",
        type: "error",
      });
    } finally {
      setIsExportingCsv(false);
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

  // Filter & Search Logic (Server-side paginated & filtered)
  const allEntries = useMemo(() => data?.ledger_entries || [], [data]);
  const filteredEntries = allEntries;

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

  // Paginated Slicing (Backend handles server-side pagination per page with exact total_pages)
  const totalPages = data?.total_pages || 1;
  const paginatedEntries = filteredEntries;

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
  const codGross = data?.cod_gross_amount || 0;
  const codRefunded = data?.cod_refunded_amount || 0;
  const codNet = data?.cod_net_amount !== undefined ? data.cod_net_amount : Math.max(0, codGross - codRefunded);
  const onlineGross = data?.online_gross_amount !== undefined ? data.online_gross_amount : Math.max(0, gmv - codGross);
  const onlineRefunded = data?.online_refunded_amount || 0;
  const onlineNet = data?.online_net_amount !== undefined ? data.online_net_amount : Math.max(0, onlineGross - onlineRefunded);
  const codFeesDue = data?.cod_platform_fees_due || 0;
  const codFeesCooling = data?.cod_platform_fees_cooling || 0;
  const codFeesDeducted = data?.cod_platform_fees_deducted || 0;
  const refundGatewayDues = data?.refund_gateway_fees_due || 0;
  const totalDuesOwed = data?.total_dues_owed_to_platform !== undefined ? data.total_dues_owed_to_platform : (codFeesDue + refundGatewayDues);
  const netPayable = data?.net_payable_to_merchant !== undefined ? data.net_payable_to_merchant : (data?.pending_payout || 0);
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

      {/* Top Header Card: Action Controls on Left + Search & Filter on Right (Matching Orders Page Top Bar) */}
      <div
        style={{
          ...plainCardStyle,
          padding: "10px 14px",
          marginBottom: "10px",
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
          {/* Left Side: Clean Mode Pill */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                style={{
                  borderRadius: "6px",
                  padding: "6px 16px",
                  border: "none",
                  background: "#ffffff",
                  color: "#0f172a",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "default",
                  transition: "all 0.15s ease",
                }}
              >
                Earnings & Ledger
              </button>
            </div>
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
                      <option value="cod">Cash on Delivery (COD)</option>
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
                  onClick={() => {
                    setDateFilter("last_30_days");
                    setCurrentPage(1);
                  }}
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

      {/* Unconfigured Bank Alert (Subtle, placed right after navbar) */}
      {data && !data.bank_configured && (
        <div
          style={{
            background: "#fafaf9",
            border: "1px solid #e7e5e4",
            borderRadius: "8px",
            padding: "9px 14px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "12.5px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#44403c" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
            <span>
              <strong style={{ fontWeight: 600, color: "#1c1917" }}>Bank account not linked.</strong> Add your account details to receive automatic 48-hour order payouts.
            </span>
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
              whiteSpace: "nowrap",
              transition: "background 0.15s ease",
            }}
          >
            Configure Bank →
          </Link>
        </div>
      )}

      {/* Collection Metric Summary Boxes (5-Card Responsive Grid) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "8px",
          width: "100%",
          marginBottom: "10px",
        }}
      >
        {/* Card 1: Online Sales (Prepaid) */}
        <div style={{ ...plainCardStyle, padding: "10px 12px", minWidth: 0, overflow: "visible", position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "clamp(15px, 1.35vw, 19px)", fontWeight: 700, color: "#334155", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            {formatCurrency(onlineNet)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
              Online Sales (Prepaid)
            </span>
            <InfoTooltip
              align="left"
              text={`Gross Online: ${formatCurrency(onlineGross)} · Returned: ${formatCurrency(onlineRefunded)} · Net: ${formatCurrency(onlineNet)}. Net revenue collected online after customer returns.`}
            />
          </div>
        </div>

        {/* Card 2: In Escrow (Cooling) */}
        <div style={{ ...plainCardStyle, padding: "10px 12px", minWidth: 0, overflow: "visible", position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
            <div style={{ fontSize: "clamp(15px, 1.35vw, 19px)", fontWeight: 700, color: "#d97706", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
              {formatCurrency(escrowBalance)}
            </div>
            <EscrowReleaseIconButton
              onClick={handleReleaseMatureEscrows}
              disabled={releasingEscrow || escrowBalance <= 0}
              active={escrowBalance > 0}
              loading={releasingEscrow}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
              In Escrow (Cooling)
            </span>
            <InfoTooltip
              align="center"
              text="Prepaid funds held safely during customer return window. Auto-settles to bank upon maturity."
            />
          </div>
        </div>

        {/* Card 3: Settled to Bank */}
        <div style={{ ...plainCardStyle, padding: "10px 12px", minWidth: 0, overflow: "visible", position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "clamp(15px, 1.35vw, 19px)", fontWeight: 700, color: "#059669", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            {formatCurrency(settledPayouts)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
              Settled to Bank
            </span>
            <InfoTooltip
              align="center"
              text="Net earnings successfully transferred and credited into your bank account."
            />
          </div>
        </div>

        {/* Card 4: Cash on Delivery (COD) */}
        <div style={{ ...plainCardStyle, padding: "10px 12px", minWidth: 0, overflow: "visible", position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "clamp(15px, 1.35vw, 19px)", fontWeight: 700, color: "#0284c7", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            {formatCurrency(codNet)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
              COD Sales (Cash)
            </span>
            <InfoTooltip
              align="center"
              text={`Gross COD: ${formatCurrency(codGross)} · Returned/Waived: ${formatCurrency(codRefunded)} · Net Cash: ${formatCurrency(codNet)}. Cash collected at doorstep minus returned orders.`}
            />
          </div>
        </div>

        {/* Card 5: Dues Owed to WebCreon */}
        <div style={{ ...plainCardStyle, padding: "10px 12px", minWidth: 0, overflow: "visible", position: "relative", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "clamp(15px, 1.35vw, 19px)", fontWeight: 700, color: totalDuesOwed > 0 ? "#dc2626" : "#475569", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
            {formatCurrency(totalDuesOwed)}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>
              Dues to WebCreon
            </span>
            <InfoTooltip
              align="right"
              text={`Platform & statutory dues: ${formatCurrency(codFeesDue)} COD dues (Commission + TDS + TCS) + ${formatCurrency(refundGatewayDues)} gateway adjustments. Auto-deducted from online payouts.`}
            />
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
                  <th style={{ padding: "10px 16px", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span>Reference</span>
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        disabled={isExportingCsv || loading || filteredEntries.length === 0}
                        title="Export transaction settlement ledger (.csv)"
                        aria-label="Export transaction settlement ledger (.csv)"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "22px",
                          height: "22px",
                          padding: 0,
                          borderRadius: "5px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#64748b",
                          cursor: isExportingCsv || loading || filteredEntries.length === 0 ? "not-allowed" : "pointer",
                          opacity: isExportingCsv || loading || filteredEntries.length === 0 ? 0.45 : 1,
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isExportingCsv && !loading && filteredEntries.length > 0) {
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
                        {isExportingCsv ? <RefreshIcon spin /> : <DownloadIcon />}
                      </button>
                    </div>
                  </th>
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

                        {/* Status (Clean & Minimal to-the-point) */}
                        <td style={{ padding: "12px 16px" }}>
                          {entry.is_cod ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: entry.cod_fee_status === "deducted" ? "#16a34a" : entry.cod_fee_status === "waived_returned" ? "#64748b" : "#0284c7", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: entry.cod_fee_status === "deducted" ? "#16a34a" : entry.cod_fee_status === "waived_returned" ? "#94a3b8" : "#0284c7" }} />
                              {entry.cod_fee_status === "deducted" ? "Fee Settled" : entry.cod_fee_status === "waived_returned" ? "Waived (Returned)" : "COD Cash"}
                            </span>
                          ) : isSettled ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#16a34a", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                              Settled
                            </span>
                          ) : isEscrowHeld ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#475569", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#64748b" }} />
                              On Hold
                            </span>
                          ) : isRefunded ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#dc2626", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                              Refunded
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#475569", fontWeight: 600, fontSize: "12px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94a3b8" }} />
                              {entry.status === "pending_payout" ? "Pending" : entry.status}
                            </span>
                          )}
                        </td>

                        {/* Transfer Ref & Expand Indicator */}
                        <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <span style={{ fontFamily: "monospace", fontSize: "11.5px" }}>{entry.razorpay_transfer_id || "—"}</span>
                            <span style={{ fontSize: "10px", color: "#94a3b8", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
                              ▼
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Accordion: Simple, Minimal, Neutral Slate Theme */}
                      {isExpanded && (
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <td colSpan={7} style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                              {/* Top Banner inside Accordion */}
                              <div
                                style={{
                                  padding: "10px 14px",
                                  borderRadius: "6px",
                                  background: entry.is_cod 
                                    ? (entry.cod_fee_status === "deducted" ? "#f0fdf4" : entry.cod_fee_status === "waived_returned" ? "#f8fafc" : "#eff6ff")
                                    : "#ffffff",
                                  border: `1px solid ${entry.is_cod ? (entry.cod_fee_status === "deducted" ? "#bbf7d0" : entry.cod_fee_status === "waived_returned" ? "#e2e8f0" : "#bfdbfe") : "#e2e8f0"}`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                  fontSize: "12px",
                                }}
                              >
                                {entry.is_cod ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#334155" }}>
                                    <span style={{ fontWeight: 700, color: entry.cod_fee_status === "deducted" ? "#15803d" : entry.cod_fee_status === "waived_returned" ? "#475569" : "#1d4ed8" }}>
                                      {entry.cod_fee_status === "deducted" ? "✅ COD Fee Settled" : entry.cod_fee_status === "waived_returned" ? "🔄 Fee Waived (Returned)" : "🛡️ COD Safety Buffer"}:
                                    </span>
                                    <span>{entry.hold_reason_detail || "Protected under order return window + 2-day safety buffer."}</span>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#334155" }}>
                                    <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                      {isSettled ? "Payout Settled" : isRefunded ? "Payment Refunded" : "Escrow Status"}:
                                    </span>
                                    <span>{entry.hold_reason_detail || (isSettled ? "Transferred to bank account." : isRefunded ? "Reversed to customer." : "Funds held in escrow.")}</span>
                                    {entry.blocking_reference && (
                                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "1px 6px", borderRadius: "4px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>
                                        {entry.blocking_reference}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {entry.is_cod && entry.cod_fee_deduction_due_at && entry.cod_fee_status === "cooling" && (
                                  <div style={{ fontSize: "11.5px", color: "#1e40af" }}>
                                    <span>Deduction Date: </span>
                                    <strong>{formatDate(entry.cod_fee_deduction_due_at)}</strong>
                                  </div>
                                )}

                                {!entry.is_cod && entry.return_window_closes_at && isEscrowHeld && (
                                  <div style={{ fontSize: "11.5px", color: "#475569" }}>
                                    <span style={{ color: "#64748b" }}>Release Date: </span>
                                    <strong style={{ color: "#0f172a" }}>{formatDate(entry.return_window_closes_at)}</strong>
                                  </div>
                                )}
                              </div>

                              {/* 2-Card Structured Financial & Order Breakdown */}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                  gap: "10px",
                                }}
                              >
                                {/* Left Card: Order, Payment Mode & Invoice Download */}
                                <div
                                  style={{
                                    padding: "12px 14px",
                                    background: "#ffffff",
                                    borderRadius: "6px",
                                    border: "1px solid #e2e8f0",
                                    fontSize: "12px",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    gap: "10px",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", marginBottom: "8px" }}>
                                      Order & Settlement Summary
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", rowGap: "6px", columnGap: "8px" }}>
                                      <span style={{ color: "#64748b" }}>Order:</span>
                                      <Link
                                        to={`/builder/${siteId}/admin/orders?orderId=${entry.order_id}`}
                                        style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                                      >
                                        #{entry.order_number} →
                                      </Link>

                                      <span style={{ color: "#64748b" }}>Payment Mode:</span>
                                      <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                        {entry.is_cod || (entry.payment_method && entry.payment_method.toLowerCase().includes("cod"))
                                          ? "Cash on Delivery (Doorstep Cash)"
                                          : "Prepaid (Online Gateway)"}
                                      </span>

                                      <span style={{ color: "#64748b" }}>Order Status:</span>
                                      <span style={{ fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>
                                        {entry.order_status || "Delivered"}
                                      </span>

                                      <span style={{ color: "#64748b" }}>Settlement:</span>
                                      <span style={{ fontWeight: 600, color: entry.is_cod ? (entry.cod_fee_status === "deducted" ? "#059669" : "#0284c7") : (isSettled ? "#059669" : isEscrowHeld ? "#d97706" : "#0f172a") }}>
                                        {entry.is_cod
                                          ? (entry.cod_fee_status === "deducted"
                                              ? "Fee Deducted from Settlement"
                                              : entry.cod_fee_status === "waived_returned"
                                              ? "Fee Waived (Returned)"
                                              : "Fee in 7+2 Day Safety Buffer")
                                          : (entry.settled_at ? formatDate(entry.settled_at) : isSettled ? "Settled to Bank" : isEscrowHeld ? "In Escrow (Cooling Window)" : isRefunded ? "Refunded" : "Pending Payout")}
                                      </span>
                                    </div>

                                    <div style={{ paddingTop: "8px", borderTop: "1px solid #f1f5f9", display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                                      <button
                                        type="button"
                                        onClick={() => window.open(`${API_BASE_URL}/orders/${entry.order_id}/platform-invoice/pdf`, "_blank")}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          padding: "6px 12px",
                                          borderRadius: "6px",
                                          border: "1px solid #0284c7",
                                          background: "#f0f9ff",
                                          color: "#0369a1",
                                          fontSize: "11.5px",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          transition: "all 0.15s ease",
                                        }}
                                        title="Download WebCreon B2B Marketplace Service & Commission Tax Invoice with 18% GST and TCS breakdown"
                                      >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                          <polyline points="14 2 14 8 20 8" />
                                          <line x1="16" y1="13" x2="8" y2="13" />
                                          <line x1="16" y1="17" x2="8" y2="17" />
                                          <polyline points="10 9 9 9 8 9" />
                                        </svg>
                                        Platform Fee Tax Invoice (B2B)
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => window.open(`${API_BASE_URL}/orders/${entry.order_id}/invoice/pdf`, "_blank")}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          padding: "6px 10px",
                                          borderRadius: "6px",
                                          border: "1px solid #cbd5e1",
                                          background: "#f8fafc",
                                          color: "#475569",
                                          fontSize: "11.5px",
                                          fontWeight: 500,
                                          cursor: "pointer",
                                          transition: "all 0.15s ease",
                                        }}
                                        title="Download End Customer Product Tax Invoice / Bill of Supply"
                                      >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Customer Goods Bill
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Right Card: Transparent Itemized Financial Deductions */}
                                <div
                                  style={{
                                    padding: "12px 14px",
                                    background: "#ffffff",
                                    borderRadius: "6px",
                                    border: "1px solid #e2e8f0",
                                    fontSize: "12px",
                                  }}
                                >
                                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", marginBottom: "8px" }}>
                                    Financial & Fee Itemization
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                                      <span>{entry.is_cod ? "Gross Cash Collected (Doorstep):" : "Gross Order Value:"}</span>
                                      <span style={{ fontWeight: 600 }}>{formatCurrency(entry.gross_amount)}</span>
                                    </div>

                                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                                      <span>─ WebCreon Platform Fee ({entry.platform_fee_percent || 3}%):</span>
                                      <span style={{ color: entry.cod_fee_status === "waived_returned" ? "#059669" : "#dc2626" }}>
                                        {entry.cod_fee_status === "waived_returned"
                                          ? "Waived (₹0.00)"
                                          : `-${formatCurrency(entry.platform_commission_base || entry.gross_amount * ((entry.platform_fee_percent || 3) / 100))}`}
                                      </span>
                                    </div>

                                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                                      <span>─ GST on Platform Fee (18% SAC 9983):</span>
                                      <span style={{ color: entry.cod_fee_status === "waived_returned" ? "#059669" : "#dc2626" }}>
                                        {entry.cod_fee_status === "waived_returned"
                                          ? "Waived (₹0.00)"
                                          : `-${formatCurrency(entry.platform_fee_gst || 0)}`}
                                      </span>
                                    </div>

                                    {!entry.is_cod && ((entry.gateway_fee || 0) > 0 || (entry.gateway_fee_gst || 0) > 0) && (
                                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                                        <span>─ Payment Gateway Fee (Razorpay incl. 18% GST):</span>
                                        <span style={{ color: "#dc2626" }}>-{formatCurrency((entry.gateway_fee || 0) + (entry.gateway_fee_gst || 0))}</span>
                                      </div>
                                    )}

                                    {(entry.gst_tcs || 0) > 0 && (
                                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                                        <span>─ GST TCS (Section 52 - 0.50%):</span>
                                        <span style={{ color: "#dc2626" }}>-{formatCurrency(entry.gst_tcs || 0)}</span>
                                      </div>
                                    )}

                                    {(entry.tds_194o || 0) > 0 && (
                                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                                        <span>─ Income Tax TDS (Section 194-O {entry.tds_rate_applied ? `@ ${entry.tds_rate_applied}%` : ""}):</span>
                                        <span style={{ color: "#dc2626" }}>-{formatCurrency(entry.tds_194o || 0)}</span>
                                      </div>
                                    )}

                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginTop: "4px",
                                        paddingTop: "6px",
                                        borderTop: "1px solid #e2e8f0",
                                        fontWeight: 700,
                                        fontSize: "13px",
                                      }}
                                    >
                                      <span style={{ color: "#0f172a" }}>
                                        {entry.is_cod ? "Net Cash Kept by Merchant:" : "Net Merchant Share:"}
                                      </span>
                                      <span style={{ color: "#059669" }}>{formatCurrency(entry.tenant_share)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
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

      {/* Centered Pagination controls */}
      {filteredEntries.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginTop: "16px",
            padding: "8px 4px",
            width: "100%",
          }}
        >
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setCurrentPage(page);
            }}
            pageSize={pageSize}
            pageSizeOptions={[10, 15, 25, 50, 100]}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            accentColor="#2563eb"
            style={{ padding: 0 }}
          />
        </div>
      )}
    </div>
  );
}
