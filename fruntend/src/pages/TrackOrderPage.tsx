/**
 * TrackOrderPage — Public customer-facing order tracking page.
 * Accessible at: /track/:siteId/:orderId
 * No login required.
 */
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

type TrackingData = {
  order_id: string;
  mode: string;
  status: string;
  courier_name: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  agent_first_name: string | null;
  estimated_delivery_at: string | null;
  shipped_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  notes?: string | null;
  order_status: string | null;
};

const TIMELINE = [
  { key: "placed", label: "Order Placed", desc: "Your order has been received" },
  { key: "confirmed", label: "Confirmed", desc: "Store accepted & preparing parcel" },
  { key: "shipped", label: "In Transit", desc: "Picked up by delivery partner" },
  { key: "out_for_delivery", label: "Out for Delivery", desc: "Rider is heading to your address" },
  { key: "delivered", label: "Delivered", desc: "Package handed over safely" },
] as const;

const STATUS_ORDER = ["placed", "confirmed", "shipped", "out_for_delivery", "delivered"];

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TrackOrderPage() {
  const { siteId, slug, orderId } = useParams<{ siteId?: string; slug?: string; orderId: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetSite = siteId || slug;

  useEffect(() => {
    if (!targetSite || !orderId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/delivery/track/${targetSite}/${orderId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Order tracking details not found" }));
          throw new Error(err.detail || "Order not found");
        }
        setData(await res.json());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId, orderId]);

  const currentStatusIndex = data
    ? Math.max(
        STATUS_ORDER.indexOf(data.status),
        STATUS_ORDER.indexOf(data.order_status || "")
      )
    : -1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
        display: "flex",
        justifyContent: "center",
        padding: "40px 16px 80px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "560px" }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
            Order Tracking
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Order ID: <strong>{orderId?.slice(0, 8).toUpperCase()}</strong>
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <p style={{ fontSize: "14px", fontWeight: 500 }}>Fetching live shipment status...</p>
          </div>
        )}

        {error && (
          <div
            style={{
              textAlign: "center",
              padding: "36px 24px",
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #fee2e2",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <p style={{ color: "#b91c1c", fontWeight: 700, margin: "0 0 4px", fontSize: "15px" }}>
              Tracking Not Found
            </p>
            <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Status Banner Card */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px 24px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: data.status === "delivered" ? "#f0fdf4" : data.status === "rescheduled" ? "#fffbeb" : "#eff6ff",
                  color: data.status === "delivered" ? "#16a34a" : data.status === "rescheduled" ? "#d97706" : "#2563eb",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "18px",
                  fontWeight: 700,
                  flexShrink: 0,
                  border: `1px solid ${data.status === "delivered" ? "#bbf7d0" : data.status === "rescheduled" ? "#fde68a" : "#bfdbfe"}`,
                }}
              >
                {data.status === "delivered" ? "✓" : data.status === "rescheduled" ? "!" : "●"}
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: data.status === "delivered" ? "#16a34a" : data.status === "rescheduled" ? "#d97706" : "#2563eb",
                    letterSpacing: "0.05em",
                  }}
                >
                  {data.status === "delivered" ? "Delivery Successful" : data.status === "rescheduled" ? "Delivery Attempt Rescheduled" : "Current Status"}
                </span>
                <h2 style={{ margin: "2px 0 2px", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                  {data.status === "delivered"
                    ? "Your order has been delivered"
                    : data.status === "rescheduled"
                    ? "Delivery Attempted — Rescheduled"
                    : data.status === "out_for_delivery"
                    ? "Out for Delivery"
                    : data.status === "picked_up"
                    ? "Picked up by Rider"
                    : data.status === "in_transit"
                    ? "Parcel In Transit"
                    : data.status === "accepted"
                    ? "Delivery Agent Assigned"
                    : "Order is Being Packed"}
                </h2>

                {data.notes && data.status === "rescheduled" && (
                  <p style={{ margin: "3px 0 2px", fontSize: "12px", color: "#92400e" }}>
                    <strong>Note:</strong> {data.notes}
                  </p>
                )}

                {data.estimated_delivery_at && data.status !== "delivered" && (
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: data.status === "rescheduled" ? "#b45309" : "#64748b", fontWeight: data.status === "rescheduled" ? 700 : 500 }}>
                    {data.status === "rescheduled" ? "Next Retry Expected:" : "Expected Delivery:"} {formatDate(data.estimated_delivery_at)}
                  </p>
                )}

                {data.agent_first_name && data.status !== "delivered" && (
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Assigned Rider: <strong style={{ color: "#0f172a" }}>{data.agent_first_name}</strong>
                  </p>
                )}

                {data.delivered_at && (
                  <p style={{ margin: 0, fontSize: "12px", color: "#16a34a" }}>
                    Delivered on {formatDate(data.delivered_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Timeline Card */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "24px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <h3 style={{ margin: "0 0 20px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Delivery Progress
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {TIMELINE.map((step, i) => {
                  const isDone = i <= currentStatusIndex;
                  const isCurrent = i === currentStatusIndex;
                  return (
                    <div key={step.key} style={{ display: "flex", gap: "16px" }}>
                      {/* Left dot + vertical bar */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            background: isDone ? (isCurrent ? "#2563eb" : "#16a34a") : "#f1f5f9",
                            color: isDone ? "#ffffff" : "#94a3b8",
                            fontSize: "12px",
                            fontWeight: 700,
                            display: "grid",
                            placeItems: "center",
                            border: isCurrent ? "2px solid #bfdbfe" : "none",
                            flexShrink: 0,
                          }}
                        >
                          {isDone ? (isCurrent ? "●" : "✓") : i + 1}
                        </div>

                        {i < TIMELINE.length - 1 && (
                          <div
                            style={{
                              width: "2px",
                              height: "36px",
                              background: i < currentStatusIndex ? "#16a34a" : "#e2e8f0",
                              margin: "4px 0",
                            }}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ paddingBottom: i < TIMELINE.length - 1 ? "18px" : "0", paddingTop: "4px" }}>
                        <div
                          style={{
                            fontWeight: isCurrent ? 700 : 600,
                            fontSize: "14px",
                            color: isDone ? (isCurrent ? "#2563eb" : "#0f172a") : "#94a3b8",
                          }}
                        >
                          {step.label}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {step.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Courier Details Card (if courier mode) */}
            {(data.courier_name || data.awb_number) && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "20px 24px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                  Courier Information
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", marginBottom: "14px" }}>
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                      Carrier Partner
                    </span>
                    <strong style={{ color: "#0f172a" }}>{data.courier_name || "Express Courier"}</strong>
                  </div>

                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                      Tracking Number (AWB)
                    </span>
                    <strong style={{ color: "#0f172a", fontFamily: "monospace" }}>{data.awb_number || "Pending"}</strong>
                  </div>
                </div>

                {data.tracking_url && (
                  <a
                    href={data.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      color: "#1d4ed8",
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "13px",
                      textDecoration: "none",
                    }}
                  >
                    🔍 Track on Courier Website
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
