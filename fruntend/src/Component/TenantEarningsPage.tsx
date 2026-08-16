import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

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
};

type EarningsSummaryData = {
  gross_gmv: number;
  total_platform_fees: number;
  total_net_earnings: number;
  pending_payout: number;
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
  const [data, setData] = useState<EarningsSummaryData | null>(null);
  const [page, setPage] = useState(1);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [utrRef, setUtrRef] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  const fetchEarnings = async (targetPage = 1) => {
    if (!siteId) return;
    try {
      setLoading(true);
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
    }
  };

  useEffect(() => {
    fetchEarnings(1);
  }, [siteId]);

  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !payoutAmount) return;

    try {
      setSubmittingPayout(true);
      setPayoutMsg("");

      const res = await fetch(`${API_BASE_URL}/admin/${siteId}/payouts/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payoutAmount),
          utr_reference: utrRef.trim() || undefined,
          notes: payoutNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "Failed to record payout");
      }

      setPayoutMsg("Payout marked as settled.");
      setPayoutAmount("");
      setUtrRef("");
      setPayoutNotes("");
      setPayoutModalOpen(false);
      fetchEarnings(page);
    } catch (err: any) {
      setPayoutMsg(err.message || "Error recording payout");
    } finally {
      setSubmittingPayout(false);
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

  if (loading && !data) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "#64748b" }}>
        <p style={{ fontSize: "14px", margin: 0 }}>Loading earnings & ledger...</p>
      </div>
    );
  }

  const gmv = data?.gross_gmv || 0;
  const platformFees = data?.total_platform_fees || 0;
  const netEarnings = data?.total_net_earnings || 0;
  const pendingPayout = data?.pending_payout || 0;
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
            Overview of store sales, platform fee ({feePercent}%), and bank settlements.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {pendingPayout > 0 && (
            <button
              type="button"
              onClick={() => setPayoutModalOpen(true)}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#15803d",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Record Payout
            </button>
          )}

          <Link
            to={`/builder/${siteId}/admin/payment-settings`}
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
            }}
          >
            Bank Settings
          </Link>
        </div>
      </div>

      {/* Bank Alert if Not Configured */}
      {data && !data.bank_configured && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <div style={{ color: "#92400e" }}>
            <strong>Bank details not set.</strong> Add your bank account to receive payouts.
          </div>
          <Link
            to={`/builder/${siteId}/admin/payment-settings`}
            style={{
              padding: "6px 12px",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {/* Total Sales */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
            Gross Sales (GMV)
          </p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
            {formatCurrency(gmv)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            {data?.total_orders_count || 0} online orders
          </p>
        </div>

        {/* Platform Fee */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
            Platform Fee ({feePercent}%)
          </p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#dc2626" }}>
            -{formatCurrency(platformFees)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            Platform commission
          </p>
        </div>

        {/* Net Earnings */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
            Total Net Earnings
          </p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#16a34a" }}>
            {formatCurrency(netEarnings)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            Net revenue earned
          </p>
        </div>

        {/* Pending Payout */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
            Pending Payout
          </p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1d4ed8" }}>
            {formatCurrency(pendingPayout)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b" }}>
            Awaiting bank transfer
          </p>
        </div>

        {/* Settled Payouts */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
            Settled to Bank
          </p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#334155" }}>
            {formatCurrency(settledPayouts)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94a3b8" }}>
            Transferred payouts
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
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#fafafa",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            Transaction History
          </span>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            {data?.total_orders_count || 0} Total Records
          </span>
        </div>

        {(!data?.ledger_entries || data.ledger_entries.length === 0) ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
            <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
              No transactions recorded yet
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              Completed online orders will automatically appear here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "12px" }}>Date</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "12px" }}>Order</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "12px" }}>Gross</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "12px" }}>Fee ({feePercent}%)</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "12px" }}>Net Share</th>
                  <th style={{ padding: "10px 16px", fontWeight: 600, fontSize: "12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger_entries.map((entry) => {
                  const isPending = entry.status === "pending_payout";
                  const isPaid = entry.status === "paid";
                  const isRefunded = entry.status === "refunded";

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
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
                      <td style={{ padding: "12px 16px", color: "#dc2626" }}>
                        -{formatCurrency(entry.platform_fee)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#16a34a" }}>
                        {formatCurrency(entry.tenant_share)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: isPaid
                              ? "#f0fdf4"
                              : isPending
                              ? "#eff6ff"
                              : isRefunded
                              ? "#fef2f2"
                              : "#f1f5f9",
                            color: isPaid
                              ? "#15803d"
                              : isPending
                              ? "#1d4ed8"
                              : isRefunded
                              ? "#b91c1c"
                              : "#475569",
                            border: isPaid
                              ? "1px solid #bbf7d0"
                              : isPending
                              ? "1px solid #bfdbfe"
                              : isRefunded
                              ? "1px solid #fecaca"
                              : "1px solid #e2e8f0",
                          }}
                        >
                          {isPaid ? "Settled" : isPending ? "Pending Payout" : isRefunded ? "Refunded" : entry.status}
                        </span>
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
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
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
                background: page <= 1 ? "#f8fafc" : "#ffffff",
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
                background: page >= data.total_pages ? "#f8fafc" : "#ffffff",
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

      {/* Clean Payout Modal */}
      {payoutModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={() => setPayoutModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              padding: "24px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
              border: "1px solid #e2e8f0",
              color: "#0f172a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Record Bank Settlement</h3>
              <button
                type="button"
                onClick={() => setPayoutModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayout}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Payout Amount (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={pendingPayout}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder={`Available: ₹${pendingPayout.toFixed(2)}`}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Bank UTR / Ref Number (Optional)
                </label>
                <input
                  type="text"
                  value={utrRef}
                  onChange={(e) => setUtrRef(e.target.value)}
                  placeholder="e.g. UTR123456789"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Weekly settlement"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setPayoutModalOpen(false)}
                  style={{
                    padding: "8px 14px",
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
                  disabled={submittingPayout || !payoutAmount}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: submittingPayout ? "wait" : "pointer",
                  }}
                >
                  {submittingPayout ? "Saving..." : "Confirm Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
