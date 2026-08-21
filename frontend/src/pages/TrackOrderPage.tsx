/**
 * TrackOrderPage — Public customer-facing order tracking page.
 * Accessible at: /track/:siteId/:orderId
 * No login required.
 */
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

type TrackingScan = {
  date: string;
  status: string;
  activity: string;
  location?: string;
};

type TrackingData = {
  order_id: string;
  mode: string;
  status: string;
  courier_name: string | null;
  delivery_partner_name?: string | null;
  delivery_partner_phone?: string | null;
  vehicle_type?: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  agent_first_name: string | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  estimated_delivery_at: string | null;
  shipped_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  notes?: string | null;
  order_status: string | null;
  delivery_otp?: string | null;
  scans?: TrackingScan[];
};

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

function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function formatFlipkartDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const day = d.getDate();
    const s = ["th", "st", "nd", "rd"];
    const v = day % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear().toString().slice(-2);
    return `${dayName}, ${day}${suffix} ${month} '${year}`;
  } catch {
    return dateStr || "";
  }
}

function formatFlipkartDateTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const day = d.getDate();
    const s = ["th", "st", "nd", "rd"];
    const v = day % 100;
    const suffix = s[(v - 20) % 10] || s[v] || s[0];
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear().toString().slice(-2);
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
    return `${dayName}, ${day}${suffix} ${month} '${year} - ${time}`;
  } catch {
    return dateStr || "";
  }
}

export default function TrackOrderPage() {
  const { siteId, slug, orderId } = useParams<{ siteId?: string; slug?: string; orderId: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scansExpanded, setScansExpanded] = useState(false);

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
  }, [targetSite, orderId]);

  const currentStatus = data?.status || data?.order_status || "placed";
  const currentStatusIndex = data
    ? Math.max(
        STATUS_ORDER.indexOf(data.status),
        STATUS_ORDER.indexOf(data.order_status || "")
      )
    : -1;

  const isOwnAgent = Boolean(
    data && (
      data.mode === "own_agent" ||
      (Boolean(data.agent_first_name || data.delivery_partner_name || data.agent_name) && !data.awb_number)
    )
  );

  const isShiprocket = Boolean(
    data && !isOwnAgent && (
      data.mode === "shiprocket" ||
      Boolean(data.awb_number) ||
      Boolean(data.courier_name)
    )
  );

  const riderName = data?.delivery_partner_name || data?.agent_name || data?.agent_first_name;
  const riderPhone = data?.delivery_partner_phone || data?.agent_phone;

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
                borderRadius: "14px",
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
                  background: currentStatus === "delivered" ? "#f0fdf4" : currentStatus === "rescheduled" ? "#fffbeb" : "#eff6ff",
                  color: currentStatus === "delivered" ? "#16a34a" : currentStatus === "rescheduled" ? "#d97706" : "#2563eb",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "18px",
                  fontWeight: 700,
                  flexShrink: 0,
                  border: `1px solid ${currentStatus === "delivered" ? "#bbf7d0" : currentStatus === "rescheduled" ? "#fde68a" : "#bfdbfe"}`,
                }}
              >
                {currentStatus === "delivered" ? "✓" : currentStatus === "rescheduled" ? "!" : "●"}
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: currentStatus === "delivered" ? "#16a34a" : currentStatus === "rescheduled" ? "#d97706" : "#2563eb",
                    letterSpacing: "0.05em",
                  }}
                >
                  {currentStatus === "delivered" ? "Delivery Successful" : currentStatus === "rescheduled" ? "Delivery Attempt Rescheduled" : "Current Status"}
                </span>
                <h2 style={{ margin: "2px 0 2px", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                  {currentStatus === "delivered"
                    ? "Your order has been delivered"
                    : currentStatus === "rescheduled"
                    ? "Delivery Attempted — Rescheduled"
                    : currentStatus === "out_for_delivery"
                    ? (isOwnAgent ? "Out for Delivery with Store Rider" : "Out for Delivery")
                    : currentStatus === "shipped"
                    ? (isOwnAgent ? "Dispatched with Store Rider" : "Parcel In Transit")
                    : currentStatus === "confirmed"
                    ? "Order Confirmed & Being Prepared"
                    : "Order Placed"}
                </h2>

                {data.notes && currentStatus === "rescheduled" && (
                  <p style={{ margin: "3px 0 2px", fontSize: "12px", color: "#92400e" }}>
                    <strong>Note:</strong> {data.notes}
                  </p>
                )}

                {data.estimated_delivery_at && currentStatus !== "delivered" && data.order_status !== "delivered" && data.order_status !== "returned" && data.order_status !== "cancelled" && (
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: currentStatus === "rescheduled" ? "#b45309" : "#64748b", fontWeight: currentStatus === "rescheduled" ? 700 : 500 }}>
                    {currentStatus === "rescheduled" ? "Next Retry Expected:" : "Expected Delivery:"} {formatDate(data.estimated_delivery_at)}
                  </p>
                )}

                {data.delivered_at && (
                  <p style={{ margin: 0, fontSize: "12px", color: "#16a34a" }}>
                    Delivered on {formatDate(data.delivered_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Delivery OTP Banner — only for Own Fleet / Local Handover */}
            {data.delivery_otp && !isShiprocket && (currentStatus === "out_for_delivery" || data.order_status === "out_for_delivery" || currentStatus === "shipped") ? (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  borderRadius: "14px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Delivery Verification Code
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    Share this 4-digit OTP with your delivery partner at the doorstep.
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    letterSpacing: "6px",
                    color: "#16a34a",
                    background: "#ffffff",
                    padding: "4px 16px",
                    borderRadius: "8px",
                    border: "2px dashed #22c55e",
                    fontFamily: "monospace",
                  }}
                >
                  {data.delivery_otp}
                </div>
              </div>
            ) : null}

            {/* Continuous Flipkart-Style Vertical Stepper */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "24px 20px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(() => {
                  const isCancelled = data.order_status === "cancelled" || data.status === "cancelled" || currentStatus === "cancelled";
                  const isDelivered = !isCancelled && (currentStatus === "delivered" || currentStatusIndex >= 4);
                  const isOutForDelivery = !isCancelled && (currentStatusIndex >= 3 || currentStatus === "out_for_delivery");
                  const isShipped = !isCancelled && (currentStatusIndex >= 2 || isOutForDelivery || isDelivered);
                  const isPacked = !isCancelled && (currentStatusIndex >= 1 || isShipped);
                  const isPlaced = true;

                  const orderedDate = formatFlipkartDate(data.shipped_at || data.delivered_at);
                  const orderedTime = formatFlipkartDateTime(data.shipped_at || data.delivered_at);

                  const packedDate = formatFlipkartDate(data.shipped_at || data.delivered_at);
                  const packedTime = formatFlipkartDateTime(data.shipped_at || data.delivered_at);

                  const shippedDate = formatFlipkartDate(data.shipped_at);
                  const shippedTime = formatFlipkartDateTime(data.shipped_at);

                  const ofdDate = formatFlipkartDate(data.out_for_delivery_at || data.shipped_at);
                  const ofdTime = formatFlipkartDateTime(data.out_for_delivery_at || data.shipped_at);

                  const deliveredDate = formatFlipkartDate(data.delivered_at);
                  const deliveredTime = formatFlipkartDateTime(data.delivered_at);
                  const expectedDeliveryDate = formatFlipkartDate(data.estimated_delivery_at);

                  let nodes: Array<{
                    key: string;
                    isDone: boolean;
                    title: string;
                    date?: string;
                    courier?: string | null;
                    trackingUrl?: string | null;
                    items: Array<{ text: string; sub?: string }>;
                    scans?: any[];
                  }> = [];

                  if (isOwnAgent) {
                    nodes = [
                      {
                        key: "ordered",
                        isDone: isPlaced,
                        title: "Ordered",
                        date: orderedDate,
                        items: [{ text: "Your order has been placed.", sub: orderedTime }],
                      },
                      {
                        key: "packed",
                        isDone: isPacked,
                        title: "Packed",
                        date: isPacked ? packedDate : "",
                        items: isPacked
                          ? [
                              { text: "Seller has processed your order and assigned a store delivery partner.", sub: packedTime },
                            ]
                          : [{ text: "Seller will process your order soon." }],
                      },
                      {
                        key: "out_for_delivery",
                        isDone: isOutForDelivery || isDelivered,
                        title: "Out for Delivery",
                        date: (isOutForDelivery || isDelivered) ? ofdDate : "",
                        items: (isOutForDelivery || isDelivered)
                          ? [
                              {
                                text: isOutForDelivery && !isDelivered
                                  ? `Your order is out for delivery with ${riderName || "Store Delivery Partner"}${riderPhone ? ` (${formatPhoneDisplay(riderPhone)})` : ""}.`
                                  : "Your order was out for delivery with store delivery partner.",
                                sub: ofdTime,
                              },
                            ]
                          : [{ text: "Item yet to be dispatched with delivery partner." }],
                      },
                      {
                        key: "delivered",
                        isDone: isDelivered,
                        title: isDelivered ? "Delivered" : (expectedDeliveryDate ? `Delivery Expected by ${expectedDeliveryDate}` : "Delivery Expected soon"),
                        date: isDelivered ? deliveredDate : "",
                        items: isDelivered
                          ? [{ text: "Your order has been handed over safely.", sub: deliveredTime }]
                          : [{ text: "Item yet to be delivered." }],
                      },
                    ];
                  } else if (isShiprocket) {
                    const courierLine = data.courier_name || data.awb_number
                      ? `${data.courier_name || "Courier Partner"}${data.awb_number ? ` - AWB: ${data.awb_number}` : ""}`
                      : null;

                    nodes = [
                      {
                        key: "ordered",
                        isDone: isPlaced,
                        title: "Ordered",
                        date: orderedDate,
                        items: [{ text: "Your order has been placed.", sub: orderedTime }],
                      },
                      {
                        key: "packed",
                        isDone: isPacked,
                        title: "Packed",
                        date: isPacked ? packedDate : "",
                        items: isPacked
                          ? [
                              { text: "Seller has processed your order. Manifest created.", sub: packedTime },
                              ...(isShipped ? [{ text: `Package handed over to ${data.courier_name || "courier partner"}.`, sub: shippedTime }] : []),
                            ]
                          : [{ text: "Seller will process your order soon." }],
                      },
                      {
                        key: "shipped",
                        isDone: isShipped,
                        title: "In Transit",
                        date: isShipped ? shippedDate : "",
                        courier: isShipped ? courierLine : null,
                        trackingUrl: isShipped ? data.tracking_url : null,
                        items: isShipped
                          ? [{ text: `In transit with ${data.courier_name || "courier partner"}.`, sub: shippedTime }]
                          : [{ text: "Item yet to be picked up by courier." }],
                        scans: isShipped ? (data.scans || []) : [],
                      },
                      {
                        key: "out_for_delivery",
                        isDone: isOutForDelivery || isDelivered,
                        title: "Out for Delivery",
                        date: (isOutForDelivery || isDelivered) ? ofdDate : "",
                        items: (isOutForDelivery || isDelivered)
                          ? [{ text: "Package is out for delivery with courier delivery executive.", sub: ofdTime }]
                          : [{ text: "Package not yet out for delivery." }],
                      },
                      {
                        key: "delivered",
                        isDone: isDelivered,
                        title: isDelivered ? "Delivered" : (expectedDeliveryDate ? `Delivery Expected by ${expectedDeliveryDate}` : "Delivery Expected soon"),
                        date: isDelivered ? deliveredDate : "",
                        items: isDelivered
                          ? [{ text: "Your item has been delivered.", sub: deliveredTime }]
                          : [{ text: "Item yet to be delivered." }],
                      },
                    ];
                  } else {
                    // Manual Dispatch
                    const partnerLine = data.delivery_partner_name || data.courier_name || data.awb_number
                      ? `${data.delivery_partner_name || data.courier_name || "Delivery Partner"}${data.awb_number ? ` - ${data.awb_number}` : ""}`
                      : null;

                    nodes = [
                      {
                        key: "ordered",
                        isDone: isPlaced,
                        title: "Ordered",
                        date: orderedDate,
                        items: [{ text: "Your order has been placed.", sub: orderedTime }],
                      },
                      {
                        key: "packed",
                        isDone: isPacked,
                        title: "Packed",
                        date: isPacked ? packedDate : "",
                        items: isPacked
                          ? [{ text: "Seller has processed your order.", sub: packedTime }]
                          : [{ text: "Seller will process your order soon." }],
                      },
                      {
                        key: "shipped",
                        isDone: isShipped,
                        title: "Shipped",
                        date: isShipped ? shippedDate : "",
                        courier: isShipped ? partnerLine : null,
                        items: isShipped
                          ? [{ text: "Your item has been dispatched.", sub: shippedTime }]
                          : [{ text: "Item yet to be shipped." }],
                      },
                      {
                        key: "delivered",
                        isDone: isDelivered,
                        title: isDelivered ? "Delivered" : `Delivery Expected by ${expectedDeliveryDate || "soon"}`,
                        date: isDelivered ? deliveredDate : "",
                        items: isDelivered
                          ? [{ text: "Your item has been delivered.", sub: deliveredTime }]
                          : [{ text: "Item yet to be delivered." }],
                      },
                    ];
                  }

                  return nodes.map((node, nIdx) => {
                    const isLast = nIdx === nodes.length - 1;
                    const nextNode = nodes[nIdx + 1];
                    const lineIsDone = node.isDone && (nextNode ? nextNode.isDone : false);

                    return (
                      <div key={node.key} style={{ display: "flex", gap: "16px" }}>
                        {/* Left Rail with Dot & Connecting Vertical Line */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              background: node.isDone ? "#22c55e" : "transparent",
                              border: node.isDone ? "none" : "2px solid #cbd5e1",
                              marginTop: "4px",
                              flexShrink: 0,
                            }}
                          />
                          {!isLast && (
                            <div
                              style={{
                                width: "2px",
                                flex: 1,
                                minHeight: "44px",
                                background: lineIsDone ? "#22c55e" : "#cbd5e1",
                                margin: "4px 0",
                              }}
                            />
                          )}
                        </div>

                        {/* Right Node Details */}
                        <div style={{ paddingBottom: isLast ? "0" : "22px", flex: 1 }}>
                          {/* Title & Date */}
                          <div style={{ fontSize: "14.5px", color: "#0f172a", marginBottom: "4px", lineHeight: 1.3 }}>
                            <strong style={{ fontWeight: 800 }}>{node.title}</strong>
                            {node.date && (
                              <span style={{ color: "#64748b", fontWeight: 500, fontSize: "13px", marginLeft: "8px" }}>
                                {node.date}
                              </span>
                            )}
                          </div>

                          {/* Courier Partner & AWB Line */}
                          {node.courier && (
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                              {node.courier}
                            </div>
                          )}

                          {/* Tracking URL */}
                          {node.trackingUrl && (
                            <div style={{ marginBottom: "6px" }}>
                              <a
                                href={node.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "#2563eb",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                Track on Courier Website ↗
                              </a>
                            </div>
                          )}

                          {/* Node Events */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {node.items.map((item, iIdx) => (
                              <div key={iIdx} style={{ fontSize: "13px" }}>
                                <div style={{ color: node.isDone ? "#0f172a" : "#64748b", fontWeight: 500 }}>
                                  {item.text}
                                </div>
                                {item.sub && (
                                  <div style={{ color: "#64748b", fontSize: "12px", marginTop: "1px" }}>
                                    {item.sub}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Collapsible Scans for Shipped Step */}
                          {node.scans && node.scans.length > 0 && (
                            <div style={{ marginTop: "8px" }}>
                              <button
                                type="button"
                                onClick={() => setScansExpanded((prev) => !prev)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: "3px 0",
                                  color: "#2563eb",
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                {scansExpanded
                                  ? "Hide tracking updates ▴"
                                  : `See all tracking updates (${node.scans.length}) ▾`}
                              </button>

                              {scansExpanded && (
                                <div
                                  style={{
                                    marginTop: "10px",
                                    marginLeft: "8px",
                                    paddingLeft: "12px",
                                    borderLeft: "2px solid #bfdbfe",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                  }}
                                >
                                  {node.scans.map((scan: any, sIdx: number) => (
                                    <div key={sIdx} style={{ fontSize: "12.5px" }}>
                                      <div style={{ color: "#0f172a", fontWeight: 600 }}>
                                        {scan.activity}
                                      </div>
                                      <div style={{ color: "#64748b", fontSize: "11.5px", marginTop: "1px" }}>
                                        {scan.date && <span>{scan.date}</span>}
                                        {scan.location && <span>{scan.date ? " - " : ""}{scan.location}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Own Fleet Rider Contact Card — below tracker, only when actively out for delivery and not cancelled/delivered */}
            {isOwnAgent && data.order_status !== "cancelled" && data.status !== "cancelled" && data.order_status !== "delivered" && data.status !== "delivered" && currentStatus === "out_for_delivery" && (riderName || riderPhone) && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1.5px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "14px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "#10b981",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "16px",
                      flexShrink: 0,
                    }}
                  >
                    {riderName?.[0]?.toUpperCase() || "R"}
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Store Delivery Partner
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                      {riderName || "Assigned Rider"}
                    </div>
                    {riderPhone && (
                      <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "1px" }}>
                        {formatPhoneDisplay(riderPhone)}
                      </div>
                    )}
                  </div>
                </div>

                {riderPhone && (
                  <a
                    href={`tel:${riderPhone}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "#10b981",
                      color: "#ffffff",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      textDecoration: "none",
                      boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)",
                    }}
                  >
                    <PhoneIcon />
                    <span>Call Delivery Partner</span>
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
