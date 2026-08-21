import React, { useState, useEffect } from "react";
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

export default function TenantEarningsPage() {
  const { siteId } = useParams<{ siteId: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releasingEscrow, setReleasingEscrow] = useState(false);
  const [data, setData] = useState<EarningsSummaryData | null>(null);
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchEarnings = async (targetPage = 1, showRefreshState = false) => {
    if (!siteId) return;
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await fetch(
        `${API_BASE_URL}/admin/${siteId}/earnings?page=${targetPage}&limit=15`,
        { credentials: "include" }
      );

      if (res.ok) {
        const json: EarningsSummaryData = await res.json();
        setData(json);
        setPage(json.current_page);
      }
    } catch (err) {
      console.error("Failed to load earnings summary", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarnings(1);
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
        await fetchEarnings(page);
      } else {
        setFeedback({ text: json.detail || "Failed to process payouts.", type: "error" });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || "Network error while releasing payouts.", type: "error" });
    } finally {
      setReleasingEscrow(false);
    }
  };

  const handleRefreshClick = async () => {
    await fetchEarnings(page, true);
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

  if (loading && !data) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
        <p style={{ fontSize: "14px", margin: 0, fontWeight: 500 }}>Loading earnings & ledger...</p>
      </div>
    );
  }

  const gmv = data?.gross_gmv || 0;
  const platformFees = data?.total_platform_fees || 0;
  const escrowBalance = data?.escrow_balance || 0;
  const settledPayouts = data?.settled_payouts || 0;
  const feePercent = data?.platform_commission_percent || 3.0;

  return (
    <div
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding: "24px 20px",
        color: "#0f172a",
        fontFamily: "inherit",
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 0.65s linear infinite;
        }
        .btn-hover-effect:hover {
          opacity: 0.92;
        }
        .btn-hover-effect:active {
          transform: scale(0.98);
        }
      `}</style>

      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            Earnings & Ledger
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Automated payouts with a 48-hour delivery escrow lock. Platform fee is {feePercent}%.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {data?.bank_configured && (
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "#f0fdf4",
                color: "#15803d",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid #bbf7d0",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
              Auto Payouts Active
            </span>
          )}

          <button
            type="button"
            className="btn-hover-effect"
            onClick={handleReleaseMatureEscrows}
            disabled={releasingEscrow}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: releasingEscrow ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
              transition: "all 0.15s ease",
            }}
          >
            {releasingEscrow ? (
              <>
                <svg className="spin-animation" viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" />
                </svg>
                Processing...
              </>
            ) : (
              "Release Payouts"
            )}
          </button>

          <button
            type="button"
            className="btn-hover-effect"
            onClick={handleRefreshClick}
            disabled={refreshing}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: refreshing ? "#f8fafc" : "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 600,
              cursor: refreshing ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <svg
              className={refreshing ? "spin-animation" : ""}
              viewBox="0 0 20 20"
              fill="currentColor"
              style={{ width: 13, height: 13, color: refreshing ? "#2563eb" : "#64748b" }}
            >
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <Link
            to={`/builder/${siteId}/admin/payment-settings`}
            className="btn-hover-effect"
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            Bank Settings
          </Link>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <GlassToast
          message={feedback.text}
          type={feedback.type}
          onClose={() => setFeedback(null)}
          top="76px"
        />
      )}

      {/* Bank Alert if Not Configured */}
      {data && !data.bank_configured && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <div style={{ color: "#92400e" }}>
            <strong>Bank account not configured.</strong> Add your bank account and PAN to activate automated settlements.
          </div>
          <Link
            to={`/builder/${siteId}/admin/payment-settings`}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              background: "#d97706",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Configure →
          </Link>
        </div>
      )}

      {/* Stats Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        {/* Total Sales */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px 18px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Gross Sales (GMV)
          </p>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            {formatCurrency(gmv)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            {data?.total_orders_count || 0} online orders
          </p>
        </div>

        {/* In Escrow Hold */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "16px 18px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#b45309", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              In Escrow Hold
            </p>
            <span style={{ fontSize: "10px", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px", border: "1px solid #fde68a" }}>
              Return Window Lock
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#b45309" }}>
            {formatCurrency(escrowBalance)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#92400e" }}>
            Releases automatically after return window closes
          </p>
        </div>

        {/* Settled Payouts */}
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "16px 18px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Settled to Bank
          </p>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#15803d" }}>
            {formatCurrency(settledPayouts)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#166534" }}>
            Transferred directly to bank
          </p>
        </div>

        {/* Platform Fee */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px 18px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Platform Fee ({feePercent}%)
          </p>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#dc2626" }}>
            -{formatCurrency(platformFees)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            Platform commission
          </p>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            Settlement Ledger
          </span>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            {data?.total_orders_count || 0} Total Records
          </span>
        </div>

        {(!data?.ledger_entries || data.ledger_entries.length === 0) ? (
          <div style={{ padding: "44px 20px", textAlign: "center", color: "#64748b" }}>
            <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
              No transactions recorded yet
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              Completed online orders will automatically appear here with automated split tracking.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: "12px" }}>Date</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: "12px" }}>Order</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: "12px" }}>Gross Amount</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: "12px" }}>Fee ({feePercent}%)</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: "12px" }}>Net Earnings</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: "12px" }}>Settlement Status</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger_entries.map((entry) => {
                  const isSettled = entry.status === "paid" && entry.escrow_status === "unheld";
                  const isEscrowHeld = entry.escrow_status === "held" && entry.status !== "paid" && entry.status !== "refunded";
                  const isRefunded = entry.status === "refunded" || entry.escrow_status === "reversed";

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "12px 16px", color: "#64748b", whiteSpace: "nowrap" }}>
                        {formatDate(entry.created_at)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                        #{entry.order_number}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#0f172a", fontWeight: 600 }}>
                        {formatCurrency(entry.gross_amount)}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#dc2626", fontWeight: 500 }}>
                        -{formatCurrency(entry.platform_fee)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#16a34a" }}>
                        {formatCurrency(entry.tenant_share)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "grid", gap: "3px" }}>
                          {isSettled ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 9px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "#f0fdf4",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                                width: "fit-content",
                              }}
                            >
                              ✓ Settled to Bank
                            </span>
                          ) : isEscrowHeld ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 9px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "#fffbeb",
                                color: "#b45309",
                                border: "1px solid #fde68a",
                                width: "fit-content",
                              }}
                            >
                              🔒 In Escrow (Return Lock)
                            </span>
                          ) : isRefunded ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 9px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "#fef2f2",
                                color: "#b91c1c",
                                border: "1px solid #fecaca",
                                width: "fit-content",
                              }}
                            >
                              ↩ Refunded / Reversed
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 9px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "#f1f5f9",
                                color: "#475569",
                                border: "1px solid #e2e8f0",
                                width: "fit-content",
                              }}
                            >
                              {entry.status}
                            </span>
                          )}

                          {entry.return_window_closes_at && isEscrowHeld && (
                            <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                              Window closes: {formatDate(entry.return_window_closes_at)}
                            </span>
                          )}
                          {entry.razorpay_transfer_id && (
                            <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>
                              Ref: {entry.razorpay_transfer_id}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div
            style={{
              padding: "12px 18px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              background: "#f8fafc",
            }}
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => fetchEarnings(page - 1)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: page <= 1 ? "#f1f5f9" : "#ffffff",
                color: page <= 1 ? "#94a3b8" : "#334155",
                fontSize: "12px",
                fontWeight: 600,
                cursor: page <= 1 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>
            <span style={{ color: "#64748b" }}>
              Page {data.current_page} of {data.total_pages}
            </span>
            <button
              type="button"
              disabled={page >= data.total_pages}
              onClick={() => fetchEarnings(page + 1)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: page >= data.total_pages ? "#f1f5f9" : "#ffffff",
                color: page >= data.total_pages ? "#94a3b8" : "#334155",
                fontSize: "12px",
                fontWeight: 600,
                cursor: page >= data.total_pages ? "not-allowed" : "pointer",
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
