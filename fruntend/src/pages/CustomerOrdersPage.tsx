import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

type OrderListItem = {
  id: string;
  status: string;
  total: number;
  payment_method?: string | null;
  created_at: string;
  items?: Array<{
    id?: string;
    product_name?: string;
    quantity?: number;
    selected_variant_value?: string | null;
    returnable_quantity?: number;
    is_returnable?: boolean;
    max_returnable_quantity?: number;
    pricing_snapshot?: any;
  }>;
  has_returnable_items?: boolean;
  can_request_return?: boolean;
};

type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug?: string | null;
  product_image?: string | null;
  selected_variant_label?: string | null;
  selected_variant_value?: string | null;
  unit_price: number;
  compare_price?: number | null;
  quantity: number;
  line_total: number;
  status: string;
  returnable_quantity: number;
  is_returnable?: boolean;
  max_returnable_quantity?: number;
  pricing_snapshot?: any;
};

type Shipment = {
  id: string;
  status: string;
  delivery_partner_name?: string | null;
  delivery_partner_phone?: string | null;
  estimated_delivery_at?: string | null;
  shipped_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
};

type OrderDetail = {
  id: string;
  status: string;
  total: number;
  payment_method?: string | null;
  shipping_address?: any;
  pricing_snapshot?: any;
  created_at: string;
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  items: OrderItem[];
  shipment?: Shipment | null;
  has_returnable_items?: boolean;
  can_request_return?: boolean;
};

type CustomerReturnListItem = {
  id: string;
  site_id: string;
  order_id: string;
  customer_id: string;
  status: "requested" | "approved" | "rejected" | "received" | "inspected" | "refunded" | "closed";
  refund_status: "pending" | "processed" | "failed" | "not_applicable" | string;
  request_note?: string | null;
  admin_note?: string | null;
  rejection_reason?: string | null;
  refund_override_reason?: string | null;
  suggested_refund_amount: number;
  final_refund_amount: number;
  refund_method?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  received_at?: string | null;
  inspected_at?: string | null;
  refunded_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  item_count: number;
  total_quantity_requested: number;
};

type CustomerReturnItem = {
  id: string;
  return_request_id: string;
  site_id: string;
  order_id: string;
  order_item_id: string;
  product_id?: string | null;
  product_name: string;
  product_slug?: string | null;
  product_image?: string | null;
  selected_variant_label?: string | null;
  selected_variant_value?: string | null;
  quantity_requested: number;
  quantity_approved: number;
  quantity_received: number;
  reason_code: string;
  reason_note?: string | null;
  unit_price_paid: number;
  line_refund_suggested: number;
  line_refund_final: number;
  restock_decision?: "restock" | "quarantine" | "discard" | null;
  restocked_quantity: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type CustomerReturnDetail = {
  id: string;
  site_id: string;
  order_id: string;
  customer_id: string;
  status: "requested" | "approved" | "rejected" | "received" | "inspected" | "refunded" | "closed";
  refund_status: "pending" | "processed" | "failed" | "not_applicable" | string;
  request_note?: string | null;
  admin_note?: string | null;
  rejection_reason?: string | null;
  refund_override_reason?: string | null;
  suggested_refund_amount: number;
  final_refund_amount: number;
  refund_method?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  received_at?: string | null;
  inspected_at?: string | null;
  refunded_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  order: {
    id: string;
    status: string;
    payment_method: string;
    total: number;
    created_at?: string | null;
    delivered_at?: string | null;
    shipping_address?: any;
    pricing_snapshot?: any;
  };
  items: CustomerReturnItem[];
  status_history: Array<{
    id: string;
    status: string;
    changed_by?: string | null;
    changed_by_type?: string | null;
    note?: string | null;
    changed_at?: string | null;
  }>;
};

type ReturnReasonCode =
  | "damaged"
  | "defective"
  | "wrong_item"
  | "size_issue"
  | "quality_not_as_expected"
  | "changed_mind"
  | "other";

type ReturnDraftItem = {
  selected: boolean;
  quantity: number;
  reason_code: ReturnReasonCode;
  reason_note: string;
};

type ReturnDraft = {
  request_note: string;
  items: Record<string, ReturnDraftItem>;
};

type CustomerOrdersPageProps = {
  siteId: string;
  siteSlug: string;
  theme?: {
    mode?: string;
    primary_bg?: string;
    text_color?: string;
    accent_color?: string;
  };
};

type TimelineStep = {
  key: string;
  label: string;
  time?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatPrice(value?: number | null) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function labelize(value?: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function getStatusColor(status?: string) {
  switch (status) {
    case "delivered":
    case "refunded":
      return "#16a34a";
    case "cancelled":
    case "rejected":
      return "#dc2626";
    case "out_for_delivery":
    case "received":
      return "#f59e0b";
    case "shipped":
    case "inspected":
      return "#2563eb";
    case "confirmed":
    case "approved":
      return "#7c3aed";
    case "placed":
    case "requested":
      return "#0ea5e9";
    case "closed":
      return "#64748b";
    default:
      return "#0ea5e9";
  }
}

function getTimelineSteps(detail: OrderDetail): TimelineStep[] {
  return [
    { key: "placed", label: "Order Placed", time: detail.created_at },
    { key: "confirmed", label: "Order Confirmed", time: detail.confirmed_at },
    { key: "shipped", label: "Shipped", time: detail.shipped_at || detail.shipment?.shipped_at },
    { key: "out_for_delivery", label: "Out For Delivery", time: detail.shipment?.out_for_delivery_at },
    { key: "delivered", label: "Delivered", time: detail.delivered_at || detail.shipment?.delivered_at },
  ];
}

function getStatusRank(status?: string) {
  switch (status) {
    case "placed":
      return 1;
    case "confirmed":
      return 2;
    case "shipped":
      return 3;
    case "out_for_delivery":
      return 4;
    case "delivered":
      return 5;
    case "partially_cancelled":
      return 2;
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

function getStepRank(stepKey: string) {
  switch (stepKey) {
    case "placed":
      return 1;
    case "confirmed":
      return 2;
    case "shipped":
      return 3;
    case "out_for_delivery":
      return 4;
    case "delivered":
      return 5;
    default:
      return 0;
  }
}

function getReturnTimelineSteps(detail: CustomerReturnDetail): TimelineStep[] {
  return [
    { key: "requested", label: "Return requested", time: detail.created_at },
    { key: "approved", label: "Item ready to pick", time: detail.approved_at },
    { key: "received", label: "Item received", time: detail.received_at },
    { key: "inspected", label: "Quality check complete", time: detail.inspected_at },
    { key: "refunded", label: "Refund processed", time: detail.refunded_at },
    { key: "closed", label: "Return closed", time: detail.closed_at },
  ];
}

const RETURN_REASONS: Array<{ value: ReturnReasonCode; label: string }> = [
  { value: "damaged", label: "Damaged" },
  { value: "defective", label: "Defective" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "size_issue", label: "Size issue" },
  { value: "quality_not_as_expected", label: "Quality not as expected" },
  { value: "changed_mind", label: "Changed mind" },
  { value: "other", label: "Other" },
];

const CustomerOrdersPage: React.FC<CustomerOrdersPageProps> = ({
  siteId,
  siteSlug,
  theme,
}) => {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [returns, setReturns] = useState<CustomerReturnListItem[]>([]);
  const [returnDetailMap, setReturnDetailMap] = useState<Record<string, CustomerReturnDetail>>({});
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, OrderDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [submittingReturnOrderId, setSubmittingReturnOrderId] = useState<string | null>(null);
  const [returnDrafts, setReturnDrafts] = useState<Record<string, ReturnDraft>>({});
  const [showReturnFormOrderId, setShowReturnFormOrderId] = useState<string | null>(null);
  const [expandedReturnId, setExpandedReturnId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const isLight = theme?.mode === "light";
  const accentColor = theme?.accent_color || "#3b82f6";
  const resolvedPrimaryBg = theme?.primary_bg || (isLight ? "#f8fafc" : "#0f172a");

  // Festive & Theme-adaptive color palette
  const pageBg = resolvedPrimaryBg;
  const cardBg = isLight
    ? (resolvedPrimaryBg === "#ffffff" ? "#ffffff" : "rgba(255,255,255,0.75)")
    : "rgba(0,0,0,0.25)";

  const cardBorder = isLight
    ? `1px solid ${(theme as any)?.border_color || "rgba(15,23,42,0.12)"}`
    : `1px solid ${(theme as any)?.border_color || "rgba(255,255,255,0.14)"}`;

  const textPrimary = theme?.text_color || (isLight ? "#0f172a" : "#f8fafc");
  const textMuted = (theme as any)?.muted_text_color || (isLight ? "rgba(15,23,42,0.65)" : "rgba(248,250,252,0.65)");
  const panelBg = cardBg;
  const innerBg = isLight ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.2)";
  const divider = cardBorder;
  const timelineRail = isLight ? "rgba(15,23,42,0.18)" : "rgba(255,255,255,0.2)";
  const pendingDot = isLight ? "rgba(15,23,42,0.25)" : "rgba(255,255,255,0.25)";

  const isMobile = viewportWidth <= 640;
  const isTablet = viewportWidth > 640 && viewportWidth <= 1024;
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadOrders = async () => {
    if (!siteId) return;
    const response = await fetch(`${API_BASE_URL}/orders/${siteId}/my-orders`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to load orders");
    const data = await response.json();
    setOrders(Array.isArray(data) ? data : []);
  };

  const loadReturns = async () => {
    if (!siteId) return;
    const response = await fetch(`${API_BASE_URL}/returns/${siteId}/my-returns`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to load returns");
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    setReturns(list);
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!siteId) return;
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadOrders(), loadReturns()]);
      } catch (err) {
        console.error(err);
        setOrders([]);
        setReturns([]);
        setError("Unable to load orders right now.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [siteId]);

  const loadOrderDetail = async (orderId: string, force = false) => {
    if (!siteId) return;
    if (!force && detailMap[orderId]) return;

    try {
      setDetailLoadingId(orderId);
      const response = await fetch(`${API_BASE_URL}/orders/${siteId}/my-orders/${orderId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load order detail");
      }

      const data = await response.json();
      setDetailMap((prev) => ({
        ...prev,
        [orderId]: data,
      }));

      setReturnDrafts((prev) => {
        const existingDraft = prev[orderId];
        const currentItems = existingDraft?.items || {};
        const nextItems: Record<string, ReturnDraftItem> = {};

        (data.items || []).forEach((item: OrderItem) => {
          const itemCanReturn =
            data.status === "delivered" &&
            ((typeof item.is_returnable === "boolean" && item.is_returnable) ||
              Number(item.returnable_quantity || 0) > 0);

          if (itemCanReturn) {
            nextItems[item.id] = {
              selected: currentItems[item.id]?.selected || false,
              quantity: Math.min(
                Math.max(currentItems[item.id]?.quantity || 1, 1),
                Number(item.max_returnable_quantity || item.returnable_quantity || 1)
              ),
              reason_code: currentItems[item.id]?.reason_code || "damaged",
              reason_note: currentItems[item.id]?.reason_note || "",
            };
          }
        });

        return {
          ...prev,
          [orderId]: {
            request_note: existingDraft?.request_note || "",
            items: nextItems,
          },
        };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoadingId(null);
    }
  };

  const loadReturnDetail = async (returnId: string) => {
    if (!siteId || returnDetailMap[returnId]) return;
    try {
      const response = await fetch(`${API_BASE_URL}/returns/${siteId}/my-returns/${returnId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load return detail");
      const data = await response.json();
      setReturnDetailMap((prev) => ({
        ...prev,
        [returnId]: data,
      }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    returns.forEach((item) => {
      if (!returnDetailMap[item.id]) {
        loadReturnDetail(item.id);
      }
    });
  }, [returns, siteId]);

  const handleToggle = async (orderId: string) => {
    const nextOrderId = expandedOrderId === orderId ? null : orderId;
    setExpandedOrderId(nextOrderId);

    if (nextOrderId) {
      await loadOrderDetail(nextOrderId);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!siteId) return;

    const cancelReason = window.prompt("Reason for cancellation (optional)") || "";

    try {
      setCancellingOrderId(orderId);

      const response = await fetch(`${API_BASE_URL}/orders/${siteId}/${orderId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancel_reason: cancelReason,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Failed to cancel order");
      }

      await loadOrders();
      setDetailMap((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await loadOrderDetail(orderId, true);
    } catch (err: any) {
      alert(err?.message || "Unable to cancel order");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getReturnsForOrder = (orderId: string) => {
    return returns
      .filter((item) => item.order_id === orderId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const isItemReturnable = (item: OrderItem) => {
    if (typeof item.is_returnable === "boolean") {
      return item.is_returnable && Number(item.returnable_quantity || 0) > 0;
    }
    return item.status === "delivered" && Number(item.returnable_quantity || 0) > 0;
  };

  const canRequestReturnForOrder = (detail?: OrderDetail | null, order?: OrderListItem | null) => {
    if (detail && typeof detail.can_request_return === "boolean") {
      return detail.can_request_return;
    }

    if (order && typeof order.can_request_return === "boolean") {
      return order.can_request_return;
    }

    if (!detail || detail.status !== "delivered") return false;
    return detail.items.some((item) => isItemReturnable(item));
  };

  const getSelectedReturnItems = (orderId: string) => {
    const draft = returnDrafts[orderId];
    const detail = detailMap[orderId];
    if (!draft || !detail) return [];

    return Object.entries(draft.items)
      .filter(([, item]) => item.selected)
      .map(([order_item_id, item]) => {
        const sourceItem = detail.items.find((detailItem) => detailItem.id === order_item_id);
        const maxQty = Number(
          sourceItem?.max_returnable_quantity || sourceItem?.returnable_quantity || 0
        );
        const clampedQty = Math.max(1, Math.min(maxQty, Number(item.quantity || 0)));

        return {
          order_item_id,
          quantity: clampedQty,
          reason_code: item.reason_code,
          reason_note: item.reason_note?.trim() || undefined,
        };
      })
      .filter((item) => item.quantity > 0);
  };

  const updateReturnDraft = (
    orderId: string,
    updater: (draft: ReturnDraft) => ReturnDraft
  ) => {
    setReturnDrafts((prev) => ({
      ...prev,
      [orderId]: updater(
        prev[orderId] || {
          request_note: "",
          items: {},
        }
      ),
    }));
  };

  const handleSubmitReturnRequest = async (orderId: string) => {
    if (!siteId) return;
    const selectedItems = getSelectedReturnItems(orderId);

    if (!selectedItems.length) {
      alert("Please select at least one item for return.");
      return;
    }

    const invalidQuantity = selectedItems.some((item) => item.quantity <= 0);
    if (invalidQuantity) {
      alert("Return quantity must be at least 1.");
      return;
    }

    try {
      setSubmittingReturnOrderId(orderId);

      const draft = returnDrafts[orderId];
      const response = await fetch(`${API_BASE_URL}/returns/${siteId}/request`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
          request_note: draft?.request_note?.trim() || null,
          items: selectedItems,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Failed to create return request");
      }

      setShowReturnFormOrderId(null);
      await Promise.all([loadOrders(), loadReturns()]);
      await loadOrderDetail(orderId, true);
    } catch (err: any) {
      alert(err?.message || "Unable to create return request");
    } finally {
      setSubmittingReturnOrderId(null);
    }
  };

  const getReturnHeadline = (ret: CustomerReturnListItem) => {
    switch (ret.status) {
      case "requested":
        return "Return request submitted";
      case "approved":
        return "Item ready to pick";
      case "received":
        return "Returned item received";
      case "inspected":
        return "Inspection completed";
      case "refunded":
        return "Refund processed";
      case "rejected":
        return "Return request declined";
      case "closed":
        return "Return completed";
      default:
        return "Return update available";
    }
  };

  const getReturnSubtext = (ret: CustomerReturnListItem) => {
    switch (ret.status) {
      case "requested":
        return "Your request is under review.";
      case "approved":
        return "Pickup has been approved and is ready for the next step.";
      case "received":
        return "The returned item has reached us.";
      case "inspected":
        return "Quality check is complete. Refund processing is next.";
      case "refunded":
        return "Your refund has been processed successfully.";
      case "rejected":
        return ret.rejection_reason || "This return request was not approved.";
      case "closed":
        return "This return request is now closed.";
      default:
        return "We’ll keep this updated as your return progresses.";
    }
  };

  const renderTrackingTimeline = (detail: OrderDetail) => {
    const orderStatus = detail.status;
    const isCancelled = orderStatus === "cancelled";
    const currentRank = getStatusRank(orderStatus);
    const timelineSteps = getTimelineSteps(detail);

    return (
      <div
        style={{
          border: cardBorder,
          borderRadius: "18px",
          padding: isCompact ? "14px" : "18px",
          background: panelBg,
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 800,
            marginBottom: "14px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: textMuted,
          }}
        >
          Tracking
        </div>

        {isCancelled ? (
          <div
            style={{
              borderRadius: "16px",
              border: "1px solid rgba(239,68,68,0.18)",
              background: "rgba(239,68,68,0.08)",
              padding: "14px 16px",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: "#dc2626",
                marginBottom: "4px",
              }}
            >
              Order Cancelled
            </div>
            <div style={{ fontSize: "13px", color: textMuted }}>
              {formatDate(detail.cancelled_at)}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {timelineSteps.map((step, index) => {
            const stepRank = getStepRank(step.key);
            const isCompleted =
              !isCancelled &&
              (step.time
                ? stepRank < currentRank || orderStatus === "delivered" || stepRank === currentRank
                : false);
            const isCurrent =
              !isCancelled &&
              ((stepRank === currentRank && orderStatus !== "delivered") ||
                (orderStatus === "delivered" && step.key === "delivered"));
            const isPending = !isCompleted && !isCurrent;

            const dotOuterColor = isCompleted
              ? "#16a34a"
              : isCurrent
              ? getStatusColor(orderStatus)
              : pendingDot;

            const dotInnerColor = isCompleted
              ? "#ffffff"
              : isCurrent
              ? "#f59e0b"
              : "transparent";

            const lineColor =
              !isCancelled && (isCompleted || (orderStatus === "delivered" && step.key !== "delivered"))
                ? "#16a34a"
                : timelineRail;

            return (
              <div
                key={step.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px minmax(0, 1fr)",
                  gap: "12px",
                  alignItems: "flex-start",
                  minHeight: isCompact ? "62px" : "72px",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    justifyContent: "center",
                    paddingTop: "2px",
                    minHeight: isCompact ? "62px" : "72px",
                  }}
                >
                  {index < timelineSteps.length - 1 ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "22px",
                        bottom: "-8px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "4px",
                        borderRadius: "999px",
                        background: lineColor,
                        opacity: isPending ? 0.7 : 1,
                      }}
                    />
                  ) : null}

                  <div
                    style={{
                      width: isCurrent ? "22px" : "20px",
                      height: isCurrent ? "22px" : "20px",
                      borderRadius: "999px",
                      background: dotOuterColor,
                      border: isPending
                        ? `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.12)"}`
                        : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: isCurrent ? `0 0 0 4px ${getStatusColor(orderStatus)}20` : "none",
                      position: "relative",
                      zIndex: 2,
                      marginTop: "2px",
                    }}
                  >
                    {isCompleted ? (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "999px",
                          background: dotInnerColor,
                        }}
                      />
                    ) : isCurrent ? (
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "999px",
                          background: dotInnerColor,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "4px",
                          background: pendingDot,
                        }}
                      />
                    )}
                  </div>
                </div>

                <div style={{ paddingTop: "1px" }}>
                  <div
                    style={{
                      fontSize: isMobile ? "16px" : "18px",
                      fontWeight: isCurrent ? 800 : 700,
                      color: textPrimary,
                      marginBottom: "4px",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? "13px" : "14px",
                      color: textMuted,
                    }}
                  >
                    {step.time ? formatDate(step.time) : "Pending"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {detail.shipment ? (
          <div
            style={{
              marginTop: "10px",
              paddingTop: "14px",
              borderTop: divider,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "13px", color: textMuted }}>
              Delivery partner: {detail.shipment.delivery_partner_name || "—"}
            </div>
            <div style={{ fontSize: "13px", color: textMuted }}>
              Delivery phone: {detail.shipment.delivery_partner_phone || "—"}
            </div>
            <div style={{ fontSize: "13px", color: textMuted }}>
              ETA: {formatDate(detail.shipment.estimated_delivery_at)}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderReturnAccordion = (orderId: string) => {
    const orderReturns = getReturnsForOrder(orderId);
    if (!orderReturns.length) return null;

    const latestReturn = orderReturns[0];
    const latestDetail = returnDetailMap[latestReturn.id];
    const isExpanded = expandedReturnId === latestReturn.id;
    const statusColor = getStatusColor(latestReturn.status);
    const timelineSteps = latestDetail ? getReturnTimelineSteps(latestDetail) : [];

    return (
      <div
        style={{
          border: cardBorder,
          borderRadius: "18px",
          background: panelBg,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setExpandedReturnId((prev) => (prev === latestReturn.id ? null : latestReturn.id));
            if (!latestDetail) {
              loadReturnDetail(latestReturn.id);
            }
          }}
          style={{
            width: "100%",
            textAlign: "left",
            background: "transparent",
            border: "none",
            color: "inherit",
            padding: isCompact ? "14px" : "16px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto",
              gap: "12px",
              alignItems: isMobile ? "flex-start" : "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  marginBottom: "10px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: textMuted,
                }}
              >
                Return status
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "999px",
                    background: `${statusColor}18`,
                    border: `1px solid ${statusColor}30`,
                    color: statusColor,
                    fontSize: "12px",
                    fontWeight: 800,
                    textTransform: "capitalize",
                  }}
                >
                  {labelize(latestReturn.status)}
                </div>

                <div style={{ fontSize: "13px", color: textMuted }}>
                  Refund:{" "}
                  <span style={{ color: textPrimary, fontWeight: 700 }}>
                    {formatPrice(latestReturn.final_refund_amount || latestReturn.suggested_refund_amount)}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: textMuted }}>
                  {latestReturn.total_quantity_requested} item
                  {latestReturn.total_quantity_requested > 1 ? "s" : ""}
                </div>
              </div>

              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
                {getReturnHeadline(latestReturn)}
              </div>

              <div style={{ fontSize: "13px", color: textMuted, lineHeight: 1.6 }}>
                {getReturnSubtext(latestReturn)}
              </div>
            </div>

            <div
              style={{
                fontSize: "13px",
                color: textMuted,
                whiteSpace: "nowrap",
              }}
            >
              {isExpanded ? "Hide details" : "View details"}
            </div>
          </div>
        </button>

        {isExpanded ? (
          <div
            style={{
              borderTop: divider,
              padding: `0 ${isCompact ? "14px" : "16px"} ${isCompact ? "14px" : "16px"}`,
            }}
          >
            {!latestDetail ? (
              <div style={{ paddingTop: "14px", fontSize: "14px", color: textMuted }}>
                Loading return details...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "14px" }}>
                <div
                  style={{
                    borderRadius: "16px",
                    background: innerBg,
                    border: cardBorder,
                    padding: isCompact ? "12px" : "14px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {timelineSteps.map((step, index) => {
                      const stepStatuses = timelineSteps.map((entry) => entry.key);
                      const currentIndex = stepStatuses.indexOf(latestDetail.status);
                      const stepIndex = stepStatuses.indexOf(step.key);
                      const isRejected = latestDetail.status === "rejected";
                      const isCompleted = !isRejected && !!step.time && stepIndex <= currentIndex;
                      const isCurrent = !isRejected && step.key === latestDetail.status;
                      const isPending = !isCompleted && !isCurrent;
                      const lineColor = isCompleted ? "#16a34a" : timelineRail;

                      return (
                        <div
                          key={step.key}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "30px minmax(0, 1fr)",
                            gap: "12px",
                            alignItems: "flex-start",
                            minHeight: isCompact ? "62px" : "68px",
                          }}
                        >
                          <div
                            style={{
                              position: "relative",
                              display: "flex",
                              justifyContent: "center",
                              paddingTop: "2px",
                              minHeight: isCompact ? "62px" : "68px",
                            }}
                          >
                            {index < timelineSteps.length - 1 ? (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "22px",
                                  bottom: "-8px",
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  width: "4px",
                                  borderRadius: "999px",
                                  background: lineColor,
                                  opacity: isPending ? 0.7 : 1,
                                }}
                              />
                            ) : null}

                            <div
                              style={{
                                width: isCurrent ? "22px" : "20px",
                                height: isCurrent ? "22px" : "20px",
                                borderRadius: "999px",
                                background: isRejected
                                  ? step.key === "requested"
                                    ? "#dc2626"
                                    : pendingDot
                                  : isCompleted
                                  ? "#16a34a"
                                  : isCurrent
                                  ? statusColor
                                  : pendingDot,
                                border: isPending
                                  ? `1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.12)"}`
                                  : "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: isCurrent ? `0 0 0 4px ${statusColor}20` : "none",
                                position: "relative",
                                zIndex: 2,
                                marginTop: "2px",
                              }}
                            >
                              <div
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "999px",
                                  background:
                                    isRejected
                                      ? step.key === "requested"
                                        ? "#ffffff"
                                        : "transparent"
                                      : isCompleted
                                      ? "#ffffff"
                                      : isCurrent
                                      ? "#ffffff"
                                      : "transparent",
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ paddingTop: "1px" }}>
                            <div
                              style={{
                                fontSize: isMobile ? "15px" : "16px",
                                fontWeight: isCurrent ? 800 : 700,
                                color: textPrimary,
                                marginBottom: "4px",
                                letterSpacing: "-0.02em",
                              }}
                            >
                              {step.label}
                            </div>
                            <div style={{ fontSize: "13px", color: textMuted }}>
                              {step.time ? formatDate(step.time) : "Pending"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {latestDetail.status === "rejected" ? (
                    <div
                      style={{
                        marginTop: "8px",
                        borderRadius: "14px",
                        border: "1px solid rgba(239,68,68,0.18)",
                        background: "rgba(239,68,68,0.08)",
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#dc2626", marginBottom: "4px" }}>
                        Return declined
                      </div>
                      <div style={{ fontSize: "13px", color: textMuted }}>
                        {latestDetail.rejection_reason || "This return request was rejected."}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    borderRadius: "16px",
                    background: innerBg,
                    border: cardBorder,
                    padding: isCompact ? "12px" : "14px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : isTablet
                        ? "repeat(2, minmax(0, 1fr))"
                        : "repeat(3, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", color: textMuted, marginBottom: "4px" }}>Refund amount</div>
                      <div style={{ fontSize: "16px", fontWeight: 800 }}>
                        {formatPrice(latestDetail.final_refund_amount || latestDetail.suggested_refund_amount)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: textMuted, marginBottom: "4px" }}>Refund status</div>
                      <div style={{ fontSize: "16px", fontWeight: 800 }}>
                        {labelize(latestDetail.refund_status)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: textMuted, marginBottom: "4px" }}>Refund method</div>
                      <div style={{ fontSize: "16px", fontWeight: 800 }}>
                        {latestDetail.refund_method || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: "16px",
                    background: innerBg,
                    border: cardBorder,
                    padding: isCompact ? "12px" : "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      marginBottom: "12px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: textMuted,
                    }}
                  >
                    Returned items
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {latestDetail.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          borderRadius: "14px",
                          border: cardBorder,
                          background: isLight ? "#ffffff" : "rgba(255,255,255,0.02)",
                          padding: "12px",
                          display: "grid",
                          gridTemplateColumns: isMobile
                            ? "1fr"
                            : item.product_image
                            ? "64px minmax(0, 1fr) auto"
                            : "minmax(0, 1fr) auto",
                          gap: "12px",
                          alignItems: isMobile ? "flex-start" : "center",
                        }}
                      >
                        {item.product_image ? (
                          <img
                            src={item.product_image}
                            alt={item.product_name}
                            style={{
                              width: "64px",
                              height: "64px",
                              objectFit: "cover",
                              borderRadius: "12px",
                              border: cardBorder,
                            }}
                          />
                        ) : null}

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                            {item.product_name}
                          </div>
                          <div style={{ fontSize: "12px", color: textMuted, lineHeight: 1.6 }}>
                            Requested: {item.quantity_requested} · Approved: {item.quantity_approved} · Received: {item.quantity_received}
                            <br />
                            Reason: {labelize(item.reason_code)}
                            {item.reason_note ? ` · ${item.reason_note}` : ""}
                            {item.selected_variant_value
                              ? ` · ${item.selected_variant_label || "Variant"}: ${item.selected_variant_value}`
                              : ""}
                          </div>
                        </div>

                        <div style={{ textAlign: isMobile ? "left" : "right" }}>
                          <div style={{ fontSize: "12px", color: textMuted, marginBottom: "4px" }}>
                            Refund
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 800 }}>
                            {formatPrice(item.line_refund_final || item.line_refund_suggested)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {latestDetail.request_note ? (
                    <div style={{ marginTop: "12px", fontSize: "13px", color: textMuted }}>
                      Your note: {latestDetail.request_note}
                    </div>
                  ) : null}

                  {latestDetail.admin_note ? (
                    <div style={{ marginTop: "8px", fontSize: "13px", color: textMuted }}>
                      Support note: {latestDetail.admin_note}
                    </div>
                  ) : null}

                  {latestDetail.refund_override_reason ? (
                    <div style={{ marginTop: "8px", fontSize: "13px", color: textMuted }}>
                      Refund note: {latestDetail.refund_override_reason}
                    </div>
                  ) : null}
                </div>

                {orderReturns.length > 1 ? (
                  <div
                    style={{
                      borderRadius: "16px",
                      background: innerBg,
                      border: cardBorder,
                      padding: isCompact ? "12px" : "14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        marginBottom: "10px",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: textMuted,
                      }}
                    >
                      Previous return requests
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {orderReturns.slice(1).map((ret) => {
                        const color = getStatusColor(ret.status);
                        return (
                          <div
                            key={ret.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "12px",
                              flexWrap: "wrap",
                              alignItems: "center",
                              borderRadius: "12px",
                              border: cardBorder,
                              padding: "10px 12px",
                              background: isLight ? "#ffffff" : "rgba(255,255,255,0.02)",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                                Return #{ret.id.slice(0, 8)}
                              </div>
                              <div style={{ fontSize: "12px", color: textMuted, marginTop: "4px" }}>
                                {formatDate(ret.created_at)} · {formatPrice(ret.final_refund_amount || ret.suggested_refund_amount)}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "7px 10px",
                                borderRadius: "999px",
                                background: `${color}18`,
                                border: `1px solid ${color}30`,
                                color,
                                fontSize: "11px",
                                fontWeight: 800,
                                textTransform: "capitalize",
                              }}
                            >
                              {labelize(ret.status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 140px)",
        background: isLight ? pageBg : "transparent",
        color: textPrimary,
        padding: isMobile ? "16px 12px 36px" : "24px 16px 48px",
      }}
    >
      <div
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "22px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? "26px" : "32px",
                lineHeight: 1.1,
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              Order history
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: textMuted,
                fontSize: isMobile ? "13px" : "14px",
              }}
            >
              Track orders, view shipment updates, and manage eligible actions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const path = window.location.pathname;
              if (path.startsWith("/builder/")) {
                const segments = path.split("/").filter(Boolean);
                const currentSiteId = segments[1] || siteId;
                navigate(`/builder/${currentSiteId}`);
              } else if (siteSlug) {
                navigate(`/store/${siteSlug}`);
              } else if (siteId) {
                navigate(`/builder/${siteId}`);
              } else {
                navigate("/");
              }
            }}
            style={{
              border: cardBorder,
              background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
              color: textPrimary,
              borderRadius: "14px",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Continue shopping
          </button>
        </div>

        {loading ? (
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: "24px",
              padding: "24px",
            }}
          >
            Loading orders...
          </div>
        ) : error ? (
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: "24px",
              padding: "24px",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: "24px",
              padding: "32px",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
              No orders yet
            </div>
            <div style={{ color: textMuted, fontSize: "14px" }}>
              Orders placed from this account will show here.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {orders.map((order) => {
              const detail = detailMap[order.id];
              const isExpanded = expandedOrderId === order.id;
              const canCancel = order.status === "placed" || order.status === "confirmed";
              const isDelivered = order.status === "delivered";
              const statusColor = getStatusColor(order.status);
              const canReturn = canRequestReturnForOrder(detail, order);
              const isReturnFormOpen = showReturnFormOrderId === order.id;
              const draft = returnDrafts[order.id];
              const orderReturns = getReturnsForOrder(order.id);
              const hasExistingReturn = orderReturns.length > 0;
              const hasSelectableReturnItems =
                !!detail && detail.items.some((item) => isItemReturnable(item));

              return (
                <div
                  key={order.id}
                  style={{
                    background: cardBg,
                    border: cardBorder,
                    borderRadius: "22px",
                    overflow: "hidden",
                    boxShadow: isLight
                      ? "0 12px 28px rgba(15,23,42,0.06)"
                      : "0 18px 40px rgba(2,6,23,0.28)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(order.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      padding: isCompact ? "16px 14px 14px" : "18px 18px 16px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile
                          ? "1fr"
                          : isTablet
                          ? "minmax(0, 1fr) minmax(0, 1fr)"
                          : "minmax(0, 1.5fr) minmax(0, 1fr) auto auto",
                        gap: "14px",
                        alignItems: isMobile ? "flex-start" : "center",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                            marginBottom: "6px",
                          }}
                        >
                          Order #{order.id.slice(0, 8)}
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: textMuted,
                            whiteSpace: isMobile ? "normal" : "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {formatDate(order.created_at)}
                        </div>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "12px",
                            color: textMuted,
                            marginBottom: "4px",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          Payment
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: 700 }}>
                          {(order.payment_method || "—").toUpperCase()}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "9px 12px",
                            borderRadius: "999px",
                            background: `${statusColor}18`,
                            border: `1px solid ${statusColor}30`,
                            color: statusColor,
                            fontSize: "12px",
                            fontWeight: 800,
                            textTransform: "capitalize",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {order.status.replaceAll("_", " ")}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatPrice(order.total)}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div
                      style={{
                        borderTop: divider,
                        padding: isCompact ? "14px" : "18px",
                        background: isLight ? "#f8fafc" : "rgba(255,255,255,0.02)",
                      }}
                    >
                      {detailLoadingId === order.id && !detail ? (
                        <div style={{ color: textMuted, fontSize: "14px" }}>
                          Loading order details...
                        </div>
                      ) : detail ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: isTablet || isMobile
                              ? "1fr"
                              : "minmax(0, 1.4fr) minmax(320px, 1fr)",
                            gap: "18px",
                            alignItems: "start",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "14px",
                            }}
                          >
                            <div
                              style={{
                                border: cardBorder,
                                borderRadius: "18px",
                                padding: isCompact ? "14px" : "16px",
                                background: panelBg,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 800,
                                  marginBottom: "12px",
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  color: textMuted,
                                }}
                              >
                                Items
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "12px",
                                }}
                              >
                                {detail.items.map((item) => {
                                  const draftItem = draft?.items?.[item.id];
                                  const itemCanReturn = isItemReturnable(item);
                                  const isEligible = itemCanReturn && isReturnFormOpen;

                                  return (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "12px",
                                        padding: "12px",
                                        borderRadius: "16px",
                                        background: innerBg,
                                        border: cardBorder,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: isMobile
                                            ? "1fr"
                                            : item.product_image
                                            ? "72px minmax(0, 1fr) auto"
                                            : "minmax(0, 1fr) auto",
                                          gap: "12px",
                                          alignItems: isMobile ? "flex-start" : "center",
                                        }}
                                      >
                                        {item.product_image ? (
                                          <img
                                            src={item.product_image}
                                            alt={item.product_name}
                                            style={{
                                              width: "72px",
                                              height: "72px",
                                              objectFit: "cover",
                                              borderRadius: "14px",
                                              border: cardBorder,
                                            }}
                                          />
                                        ) : null}

                                        <div style={{ minWidth: 0 }}>
                                          <div
                                            style={{
                                              fontSize: "14px",
                                              fontWeight: 700,
                                              marginBottom: "4px",
                                            }}
                                          >
                                            {item.product_name}
                                          </div>
                                          <div style={{ fontSize: "13px", color: textMuted }}>
                                            Qty {item.quantity}
                                            {item.selected_variant_value
                                              ? ` • ${item.selected_variant_label || "Variant"}: ${item.selected_variant_value}`
                                              : ""}
                                          </div>
                                          <div style={{ fontSize: "12px", color: textMuted, marginTop: "4px" }}>
                                            Item status: {item.status.replaceAll("_", " ")}
                                          </div>
                                          <div style={{ fontSize: "12px", color: textMuted, marginTop: "4px" }}>
                                            Returnable quantity: {item.returnable_quantity}
                                          </div>
                                          {!itemCanReturn && detail.status === "delivered" ? (
                                            <div style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px", fontWeight: 600 }}>
                                              Already fully returned or not eligible for return
                                            </div>
                                          ) : null}
                                        </div>

                                        <div
                                          style={{
                                            fontSize: "14px",
                                            fontWeight: 800,
                                            whiteSpace: "nowrap",
                                            textAlign: isMobile ? "left" : "right",
                                          }}
                                        >
                                          {formatPrice(item.line_total)}
                                        </div>
                                      </div>

                                      {isEligible && draftItem ? (
                                        <div
                                          style={{
                                            display: "grid",
                                            gridTemplateColumns: isMobile
                                              ? "1fr"
                                              : isTablet
                                              ? "repeat(2, minmax(0, 1fr))"
                                              : "auto minmax(110px, 120px) minmax(160px, 1fr) minmax(180px, 1fr)",
                                            gap: "10px",
                                            alignItems: "end",
                                            paddingTop: "4px",
                                            borderTop: divider,
                                          }}
                                        >
                                          <label
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "8px",
                                              fontSize: "13px",
                                              fontWeight: 600,
                                              color: textPrimary,
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={draftItem.selected}
                                              onChange={(e) =>
                                                updateReturnDraft(order.id, (currentDraft) => ({
                                                  ...currentDraft,
                                                  items: {
                                                    ...currentDraft.items,
                                                    [item.id]: {
                                                      ...currentDraft.items[item.id],
                                                      selected: e.target.checked,
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            Return this item
                                          </label>

                                          <div>
                                            <div style={{ fontSize: "12px", color: textMuted, marginBottom: "6px" }}>
                                              Quantity
                                            </div>
                                            <input
                                              type="number"
                                              min={1}
                                              max={Number(item.max_returnable_quantity || item.returnable_quantity)}
                                              value={draftItem.quantity}
                                              disabled={!draftItem.selected}
                                              onChange={(e) =>
                                                updateReturnDraft(order.id, (currentDraft) => ({
                                                  ...currentDraft,
                                                  items: {
                                                    ...currentDraft.items,
                                                    [item.id]: {
                                                      ...currentDraft.items[item.id],
                                                      quantity: Math.max(
                                                        1,
                                                        Math.min(
                                                          Number(item.max_returnable_quantity || item.returnable_quantity),
                                                          Number(e.target.value || 1)
                                                        )
                                                      ),
                                                    },
                                                  },
                                                }))
                                              }
                                              style={{
                                                width: "100%",
                                                borderRadius: "12px",
                                                border: cardBorder,
                                                background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                                                color: textPrimary,
                                                padding: "10px 12px",
                                              }}
                                            />
                                          </div>

                                          <div>
                                            <div style={{ fontSize: "12px", color: textMuted, marginBottom: "6px" }}>
                                              Reason
                                            </div>
                                            <select
                                              value={draftItem.reason_code}
                                              disabled={!draftItem.selected}
                                              onChange={(e) =>
                                                updateReturnDraft(order.id, (currentDraft) => ({
                                                  ...currentDraft,
                                                  items: {
                                                    ...currentDraft.items,
                                                    [item.id]: {
                                                      ...currentDraft.items[item.id],
                                                      reason_code: e.target.value as ReturnReasonCode,
                                                    },
                                                  },
                                                }))
                                              }
                                              style={{
                                                width: "100%",
                                                borderRadius: "12px",
                                                border: cardBorder,
                                                background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                                                color: textPrimary,
                                                padding: "10px 12px",
                                              }}
                                            >
                                              {RETURN_REASONS.map((reason) => (
                                                <option key={reason.value} value={reason.value}>
                                                  {reason.label}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          <div>
                                            <div style={{ fontSize: "12px", color: textMuted, marginBottom: "6px" }}>
                                              Note
                                            </div>
                                            <input
                                              type="text"
                                              value={draftItem.reason_note}
                                              disabled={!draftItem.selected}
                                              onChange={(e) =>
                                                updateReturnDraft(order.id, (currentDraft) => ({
                                                  ...currentDraft,
                                                  items: {
                                                    ...currentDraft.items,
                                                    [item.id]: {
                                                      ...currentDraft.items[item.id],
                                                      reason_note: e.target.value,
                                                    },
                                                  },
                                                }))
                                              }
                                              placeholder="Optional note"
                                              style={{
                                                width: "100%",
                                                borderRadius: "12px",
                                                border: cardBorder,
                                                background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                                                color: textPrimary,
                                                padding: "10px 12px",
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                              }}
                            >
                              <div
                                style={{
                                  border: cardBorder,
                                  borderRadius: "18px",
                                  padding: isCompact ? "14px" : "16px",
                                  background: panelBg,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    marginBottom: "10px",
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    color: textMuted,
                                  }}
                                >
                                  Shipping address
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 700 }}>
                                  {detail.shipping_address?.fullName || "—"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "14px",
                                    color: textMuted,
                                    marginTop: "6px",
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {detail.shipping_address?.addressLine1 || "—"}
                                  <br />
                                  {detail.shipping_address?.city || "—"} - {detail.shipping_address?.postalCode || "—"}
                                  <br />
                                  {detail.shipping_address?.mobileNumber || "—"}
                                  {detail.shipping_address?.email ? ` • ${detail.shipping_address.email}` : ""}
                                </div>
                              </div>

                              {renderReturnAccordion(order.id)}
                            </div>

                            {isReturnFormOpen && canReturn ? (
                              <div
                                style={{
                                  border: cardBorder,
                                  borderRadius: "18px",
                                  padding: isCompact ? "14px" : "16px",
                                  background: panelBg,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    marginBottom: "12px",
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    color: textMuted,
                                  }}
                                >
                                  Return request note
                                </div>

                                <textarea
                                  value={draft?.request_note || ""}
                                  onChange={(e) =>
                                    updateReturnDraft(order.id, (currentDraft) => ({
                                      ...currentDraft,
                                      request_note: e.target.value,
                                    }))
                                  }
                                  placeholder="Optional note for this return request"
                                  rows={4}
                                  style={{
                                    width: "100%",
                                    borderRadius: "14px",
                                    border: cardBorder,
                                    background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                                    color: textPrimary,
                                    padding: "12px 14px",
                                    resize: "vertical",
                                  }}
                                />

                                <div
                                  style={{
                                    display: "flex",
                                    gap: "10px",
                                    flexWrap: "wrap",
                                    marginTop: "14px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitReturnRequest(order.id)}
                                    disabled={submittingReturnOrderId === order.id}
                                    style={{
                                      border: `1px solid ${accentColor}33`,
                                      background: `${accentColor}14`,
                                      color: accentColor,
                                      borderRadius: "14px",
                                      padding: "12px 16px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: submittingReturnOrderId === order.id ? "not-allowed" : "pointer",
                                      opacity: submittingReturnOrderId === order.id ? 0.7 : 1,
                                    }}
                                  >
                                    {submittingReturnOrderId === order.id ? "Submitting..." : "Submit return request"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setShowReturnFormOrderId(null)}
                                    style={{
                                      border: cardBorder,
                                      background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                                      color: textPrimary,
                                      borderRadius: "14px",
                                      padding: "12px 16px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "14px",
                            }}
                          >
                            {renderTrackingTimeline(detail)}

                            <div
                              style={{
                                border: cardBorder,
                                borderRadius: "18px",
                                padding: isCompact ? "14px" : "16px",
                                background: panelBg,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 800,
                                  marginBottom: "10px",
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  color: textMuted,
                                }}
                              >
                                Summary
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    fontSize: "14px",
                                  }}
                                >
                                  <span style={{ color: textMuted }}>Subtotal</span>
                                  <span>{formatPrice(detail.pricing_snapshot?.subtotal)}</span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    fontSize: "14px",
                                  }}
                                >
                                  <span style={{ color: textMuted }}>Discount</span>
                                  <span>-{formatPrice(detail.pricing_snapshot?.promoDiscount || 0)}</span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    fontSize: "14px",
                                  }}
                                >
                                  <span style={{ color: textMuted }}>Tax</span>
                                  <span>{formatPrice(detail.pricing_snapshot?.tax?.amount || 0)}</span>
                                </div>

                                {(detail.pricing_snapshot?.charges || []).map((charge: any) => (
                                  <div
                                    key={charge.id || charge.code}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: "12px",
                                      fontSize: "14px",
                                    }}
                                  >
                                    <span style={{ color: textMuted }}>{charge.label}</span>
                                    <span>{formatPrice(charge.finalAmount || 0)}</span>
                                  </div>
                                ))}

                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    fontSize: "16px",
                                    fontWeight: 800,
                                    paddingTop: "10px",
                                    borderTop: divider,
                                  }}
                                >
                                  <span>Total</span>
                                  <span>{formatPrice(detail.total)}</span>
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "10px",
                              }}
                            >
                              {canCancel ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancelOrder(order.id)}
                                  disabled={cancellingOrderId === order.id}
                                  style={{
                                    border: "1px solid rgba(239,68,68,0.26)",
                                    background: "rgba(239,68,68,0.12)",
                                    color: "#dc2626",
                                    borderRadius: "14px",
                                    padding: "12px 16px",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    cursor: cancellingOrderId === order.id ? "not-allowed" : "pointer",
                                    opacity: cancellingOrderId === order.id ? 0.7 : 1,
                                  }}
                                >
                                  {cancellingOrderId === order.id ? "Cancelling..." : "Cancel order"}
                                </button>
                              ) : null}

                              {isDelivered && canReturn ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowReturnFormOrderId((prev) => (prev === order.id ? null : order.id))
                                  }
                                  style={{
                                    border: `1px solid ${accentColor}33`,
                                    background: `${accentColor}14`,
                                    color: accentColor,
                                    borderRadius: "14px",
                                    padding: "12px 16px",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {isReturnFormOpen ? "Hide return form" : "Request return"}
                                </button>
                              ) : null}

                              {isDelivered && !canReturn ? (
                                <button
                                  type="button"
                                  disabled
                                  style={{
                                    border: `1px solid ${accentColor}22`,
                                    background: `${accentColor}10`,
                                    color: accentColor,
                                    borderRadius: "14px",
                                    padding: "12px 16px",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    cursor: "not-allowed",
                                    opacity: 0.75,
                                  }}
                                >
                                  No returnable items left
                                </button>
                              ) : null}

                              {isDelivered && hasExistingReturn && canReturn ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "12px 14px",
                                    borderRadius: "14px",
                                    border: cardBorder,
                                    background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                                    color: textMuted,
                                    fontSize: "13px",
                                    fontWeight: 600,
                                  }}
                                >
                                  Previous return requests exist. You can still return other eligible items.
                                </div>
                              ) : null}

                              {isDelivered && isReturnFormOpen && !hasSelectableReturnItems ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "12px 14px",
                                    borderRadius: "14px",
                                    border: "1px solid rgba(239,68,68,0.18)",
                                    background: "rgba(239,68,68,0.08)",
                                    color: "#dc2626",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                  }}
                                >
                                  All items in this order have already been fully returned.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: textMuted, fontSize: "14px" }}>
                          Unable to load order details.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerOrdersPage;