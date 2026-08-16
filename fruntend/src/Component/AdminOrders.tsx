import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL as API_BASE } from "../config/api";

type AdminMode = "orders" | "returns";

type OrderStatus =
  | "placed"
  | "confirmed"
  | "accepted"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "partially_cancelled"
  | "cancelled";

type TabKey =
  | "new"
  | "yet_to_ship"
  | "yet_to_deliver"
  | "delivered"
  | "cancelled";

type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "inspected"
  | "refunded"
  | "closed";

type ReturnRefundStatus = "pending" | "processed" | "failed" | "not_applicable";

type ReturnTabKey =
  | "requested"
  | "approved"
  | "received"
  | "inspected"
  | "refunded"
  | "closed"
  | "rejected";

type ShipmentDraft = {
  deliveryPartnerName: string;
  deliveryPartnerPhone: string;
  estimatedDeliveryAt: string;
};

type OrderItem = {
  id: string;
  product_id?: string;
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
  returnable_quantity?: number;
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

type AdminOrderListItem = {
  id: string;
  customer_id: string;
  status: OrderStatus;
  payment_status?: string | null;
  total: number;
  payment_method: string;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: {
    fullName?: string;
    addressLine1?: string;
    city?: string;
    postalCode?: string;
    mobileNumber?: string;
    email?: string;
  } | null;
  shipment?: Shipment | null;
  items?: OrderItem[];
  item_count?: number;
  pricing_snapshot?: any;
};

type AdminOrderDetail = {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  status: OrderStatus;
  payment_status?: string | null;
  total: number;
  payment_method: string;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  shipping_address?: {
    fullName?: string;
    addressLine1?: string;
    city?: string;
    postalCode?: string;
    mobileNumber?: string;
    email?: string;
  } | null;
  pricing_snapshot?: any;
  created_at: string;
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  items: OrderItem[];
  shipment?: Shipment | null;
  status_history?: Array<{
    id: string;
    status: string;
    changed_by?: string | null;
    changed_by_type?: string | null;
    created_at: string;
  }>;
};

type ReturnItem = {
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

type ReturnHistoryEntry = {
  id: string;
  status: string;
  changed_by?: string | null;
  changed_by_type?: string | null;
  note?: string | null;
  changed_at?: string | null;
};

type AdminReturnListItem = {
  id: string;
  site_id: string;
  order_id: string;
  customer_id: string;
  status: ReturnStatus;
  refund_status: ReturnRefundStatus | string;
  request_note?: string | null;
  admin_note?: string | null;
  rejection_reason?: string | null;
  refund_override_reason?: string | null;
  suggested_refund_amount: number;
  final_refund_amount: number;
  refund_method?: string | null;
  customer_refund_account?: any;
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

type AdminReturnDetail = {
  id: string;
  site_id: string;
  order_id: string;
  customer_id: string;
  status: ReturnStatus;
  refund_status: ReturnRefundStatus | string;
  request_note?: string | null;
  admin_note?: string | null;
  rejection_reason?: string | null;
  refund_override_reason?: string | null;
  suggested_refund_amount: number;
  final_refund_amount: number;
  refund_method?: string | null;
  customer_refund_account?: any;
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
    shipping_address?: {
      fullName?: string;
      addressLine1?: string;
      city?: string;
      postalCode?: string;
      mobileNumber?: string;
      email?: string;
    } | null;
    pricing_snapshot?: any;
  };
  items: ReturnItem[];
  status_history: ReturnHistoryEntry[];
};

type ReviewDraft = {
  action: "approve" | "reject";
  adminNote: string;
  rejectionReason: string;
  approvedQuantities: Record<string, number>;
};

type ReceiveDraft = {
  adminNote: string;
  receivedQuantities: Record<string, number>;
};

type InspectDraft = {
  adminNote: string;
  restockDecisionByItem: Record<string, "restock" | "quarantine" | "discard">;
  restockQuantityByItem: Record<string, number>;
};

type RefundDraft = {
  refundMethod: string;
  finalRefundAmount: string;
  refundOverrideReason: string;
  adminNote: string;
};


const plainCardStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
};


const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  padding: "9px 10px",
  outline: "none",
  fontSize: "14px",
};


const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "6px",
};


const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "new", label: "New" },
  { key: "yet_to_ship", label: "Yet to Ship" },
  { key: "yet_to_deliver", label: "Yet to Deliver" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];


const returnTabs: Array<{ key: ReturnTabKey; label: string }> = [
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "received", label: "Received" },
  { key: "inspected", label: "Inspected" },
  { key: "refunded", label: "Refunded" },
  { key: "closed", label: "Closed" },
  { key: "rejected", label: "Rejected" },
];


const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });


  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data?.detail || data?.message || message;
    } catch {
      //
    }
    throw new Error(message);
  }


  return res.json();
};


const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};


const formatPrice = (value?: number | null) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};


const toInputDateTime = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};


const toIsoOrNull = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};


const formatPaymentMethodName = (method?: string | null): string => {
  if (!method) return "Online Payment";
  const m = method.toLowerCase();
  if (m === "upi") return "UPI / QR";
  if (m === "card") return "Card";
  if (m === "netbanking") return "Netbanking";
  if (m === "cod" || m === "cash_on_delivery") return "Cash on Delivery (COD)";
  if (m === "wallet") return "Wallet";
  if (m === "razorpay") return "Online Payment";
  return method.replaceAll("_", " ");
};

const getPaymentMethodIcon = (method?: string | null): string => {
  if (!method) return "💳";
  const m = method.toLowerCase();
  if (m === "upi") return "⚡";
  if (m === "card") return "💳";
  if (m === "netbanking") return "🏦";
  if (m === "cod" || m === "cash_on_delivery") return "💵";
  if (m === "wallet") return "👛";
  return "💳";
};

const getStatusLabel = (status: string) => status.replaceAll("_", " ");


const getStatusTone = (status: string) => {
  switch (status) {
    case "placed":
      return { bg: "#eff6ff", text: "#1d4ed8", border: "1px solid #bfdbfe" };
    case "confirmed":
    case "accepted":
      return { bg: "#ecfeff", text: "#0e7490", border: "1px solid #a5f3fc" };
    case "shipped":
      return { bg: "#fffbeb", text: "#b45309", border: "1px solid #fde68a" };
    case "out_for_delivery":
      return { bg: "#faf5ff", text: "#7c3aed", border: "1px solid #e9d5ff" };
    case "delivered":
      return { bg: "#f0fdf4", text: "#15803d", border: "1px solid #bbf7d0" };
    case "cancelled":
    case "partially_cancelled":
      return { bg: "#fef2f2", text: "#b91c1c", border: "1px solid #fecaca" };
    case "requested":
      return { bg: "#eff6ff", text: "#1d4ed8", border: "1px solid #bfdbfe" };
    case "approved":
      return { bg: "#ecfeff", text: "#0e7490", border: "1px solid #a5f3fc" };
    case "received":
      return { bg: "#fffbeb", text: "#b45309", border: "1px solid #fde68a" };
    case "inspected":
      return { bg: "#faf5ff", text: "#7c3aed", border: "1px solid #e9d5ff" };
    case "refunded":
      return { bg: "#f0fdf4", text: "#15803d", border: "1px solid #bbf7d0" };
    case "closed":
      return { bg: "#f1f5f9", text: "#334155", border: "1px solid #e2e8f0" };
    case "rejected":
      return { bg: "#fef2f2", text: "#b91c1c", border: "1px solid #fecaca" };
    default:
      return { bg: "#f8fafc", text: "#334155", border: "1px solid #e2e8f0" };
  }
};


const matchesTab = (order: AdminOrderListItem, tab: TabKey) => {
  switch (tab) {
    case "new":
      return order.status === "placed";
    case "yet_to_ship":
      return order.status === "confirmed" || order.status === "accepted";
    case "yet_to_deliver":
      return order.status === "shipped" || order.status === "out_for_delivery";
    case "delivered":
      return order.status === "delivered";
    case "cancelled":
      return order.status === "cancelled" || order.status === "partially_cancelled";
    default:
      return false;
  }
};


const matchesReturnTab = (item: AdminReturnListItem, tab: ReturnTabKey) => item.status === tab;


const AdminOrders: React.FC = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const [mode, setMode] = useState<AdminMode>("orders");


  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [detailsMap, setDetailsMap] = useState<Record<string, AdminOrderDetail>>({});
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, ShipmentDraft>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("new");


  const [adminReturns, setAdminReturns] = useState<AdminReturnListItem[]>([]);
  const [returnDetailsMap, setReturnDetailsMap] = useState<Record<string, AdminReturnDetail>>({});
  const [expandedReturnId, setExpandedReturnId] = useState<string | null>(null);
  const [activeReturnTab, setActiveReturnTab] = useState<ReturnTabKey>("requested");


  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [receiveDrafts, setReceiveDrafts] = useState<Record<string, ReceiveDraft>>({});
  const [inspectDrafts, setInspectDrafts] = useState<Record<string, InspectDraft>>({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, RefundDraft>>({});


  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");


  const hydrateShipmentDraft = (orderId: string, detail: AdminOrderDetail) => {
    setShipmentDrafts((prev) => ({
      ...prev,
      [orderId]: {
        deliveryPartnerName: detail.shipment?.delivery_partner_name || "",
        deliveryPartnerPhone: detail.shipment?.delivery_partner_phone || "",
        estimatedDeliveryAt: toInputDateTime(detail.shipment?.estimated_delivery_at),
      },
    }));
  };


  const hydrateReturnDrafts = (returnId: string, detail: AdminReturnDetail) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [returnId]:
        prev[returnId] || {
          action: "approve",
          adminNote: detail.admin_note || "",
          rejectionReason: detail.rejection_reason || "",
          approvedQuantities: Object.fromEntries(
            detail.items.map((item) => [item.id, item.quantity_requested])
          ),
        },
    }));


    setReceiveDrafts((prev) => ({
      ...prev,
      [returnId]:
        prev[returnId] || {
          adminNote: detail.admin_note || "",
          receivedQuantities: Object.fromEntries(
            detail.items.map((item) => [item.id, item.quantity_approved || 0])
          ),
        },
    }));


    setInspectDrafts((prev) => ({
      ...prev,
      [returnId]:
        prev[returnId] || {
          adminNote: detail.admin_note || "",
          restockDecisionByItem: Object.fromEntries(
            detail.items.map((item) => [
              item.id,
              (item.restock_decision || "discard") as "restock" | "quarantine" | "discard",
            ])
          ),
          restockQuantityByItem: Object.fromEntries(
            detail.items.map((item) => [item.id, item.restocked_quantity || 0])
          ),
        },
    }));


    setRefundDrafts((prev) => ({
      ...prev,
      [returnId]:
        prev[returnId] || {
          refundMethod: detail.refund_method || "cod_refund",
          finalRefundAmount: String(detail.final_refund_amount ?? ""),
          refundOverrideReason: detail.refund_override_reason || "",
          adminNote: detail.admin_note || "",
        },
    }));
  };


  const loadOrdersForSite = async () => {
    if (!siteId) return;
    const orderList = await fetchJson(`${API_BASE}/orders/admin/${siteId}`);
    setOrders(Array.isArray(orderList) ? orderList : []);
    setDetailsMap({});
    setExpandedOrderId(null);
  };


  const loadReturnsForSite = async () => {
    if (!siteId) return;
    const returnList = await fetchJson(`${API_BASE}/returns/admin/${siteId}`);
    setAdminReturns(Array.isArray(returnList) ? returnList : []);
    setReturnDetailsMap({});
    setExpandedReturnId(null);
  };


  useEffect(() => {
    if (!siteId) return;


    const loadByMode = async () => {
      setLoading(true);
      setError("");
      try {
        if (mode === "orders") {
          await loadOrdersForSite();
        } else {
          await loadReturnsForSite();
        }
      } catch (err: any) {
        setError(err.message || `Failed to load ${mode}`);
        if (mode === "orders") {
          setOrders([]);
        } else {
          setAdminReturns([]);
        }
      } finally {
        setLoading(false);
      }
    };


    loadByMode();
  }, [siteId, mode]);


  const filteredOrders = useMemo(() => {
    return orders.filter((order) => matchesTab(order, activeTab));
  }, [orders, activeTab]);


  const filteredReturns = useMemo(() => {
    return adminReturns.filter((item) => matchesReturnTab(item, activeReturnTab));
  }, [adminReturns, activeReturnTab]);


  const counts = useMemo(() => {
    return {
      new: orders.filter((o) => matchesTab(o, "new")).length,
      yet_to_ship: orders.filter((o) => matchesTab(o, "yet_to_ship")).length,
      yet_to_deliver: orders.filter((o) => matchesTab(o, "yet_to_deliver")).length,
      delivered: orders.filter((o) => matchesTab(o, "delivered")).length,
      cancelled: orders.filter((o) => matchesTab(o, "cancelled")).length,
    };
  }, [orders]);


  const returnCounts = useMemo(() => {
    return {
      requested: adminReturns.filter((o) => matchesReturnTab(o, "requested")).length,
      approved: adminReturns.filter((o) => matchesReturnTab(o, "approved")).length,
      received: adminReturns.filter((o) => matchesReturnTab(o, "received")).length,
      inspected: adminReturns.filter((o) => matchesReturnTab(o, "inspected")).length,
      refunded: adminReturns.filter((o) => matchesReturnTab(o, "refunded")).length,
      closed: adminReturns.filter((o) => matchesReturnTab(o, "closed")).length,
      rejected: adminReturns.filter((o) => matchesReturnTab(o, "rejected")).length,
    };
  }, [adminReturns]);


  const ensureOrderDetail = async (orderId: string) => {
    if (!siteId) return;
    if (detailsMap[orderId]) return;


    const detail = await fetchJson(`${API_BASE}/orders/admin/${siteId}/${orderId}`);
    setDetailsMap((prev) => ({ ...prev, [orderId]: detail }));
    hydrateShipmentDraft(orderId, detail);
  };


  const ensureReturnDetail = async (returnId: string) => {
    if (!siteId) return;
    if (returnDetailsMap[returnId]) return;


    const detail = await fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}`);
    setReturnDetailsMap((prev) => ({ ...prev, [returnId]: detail }));
    hydrateReturnDrafts(returnId, detail);
  };


  const syncOrderAfterAction = async (orderId: string) => {
    if (!siteId) return;


    const [orderList, detail] = await Promise.all([
      fetchJson(`${API_BASE}/orders/admin/${siteId}`),
      fetchJson(`${API_BASE}/orders/admin/${siteId}/${orderId}`),
    ]);


    setOrders(Array.isArray(orderList) ? orderList : []);
    setDetailsMap((prev) => ({ ...prev, [orderId]: detail }));
    hydrateShipmentDraft(orderId, detail);
  };


  const syncReturnAfterAction = async (returnId: string) => {
    if (!siteId) return;


    const [returnList, detail] = await Promise.all([
      fetchJson(`${API_BASE}/returns/admin/${siteId}`),
      fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}`),
    ]);


    setAdminReturns(Array.isArray(returnList) ? returnList : []);
    setReturnDetailsMap((prev) => ({ ...prev, [returnId]: detail }));
    hydrateReturnDrafts(returnId, detail);
  };


  const updateStatus = async (
    orderId: string,
    status: OrderStatus,
    extra: {
      delivery_partner_name?: string | null;
      delivery_partner_phone?: string | null;
      estimated_delivery_at?: string | null;
      cancel_reason?: string | null;
    } = {}
  ) => {
    if (!siteId) return;
    setActionLoadingId(orderId);
    try {
      await fetchJson(`${API_BASE}/orders/admin/${siteId}/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          delivery_partner_name: extra.delivery_partner_name ?? null,
          delivery_partner_phone: extra.delivery_partner_phone ?? null,
          estimated_delivery_at: extra.estimated_delivery_at ?? null,
          cancel_reason: extra.cancel_reason ?? null,
        }),
      });
      await syncOrderAfterAction(orderId);
    } catch (err: any) {
      window.alert(err.message || "Failed to update order");
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleExpandToggle = async (orderId: string) => {
    const next = expandedOrderId === orderId ? null : orderId;
    setExpandedOrderId(next);
    if (next) {
      try {
        await ensureOrderDetail(orderId);
      } catch (err: any) {
        window.alert(err.message || "Failed to load order detail");
      }
    }
  };


  const handleReturnExpandToggle = async (returnId: string) => {
    const next = expandedReturnId === returnId ? null : returnId;
    setExpandedReturnId(next);
    if (next) {
      try {
        await ensureReturnDetail(returnId);
      } catch (err: any) {
        window.alert(err.message || "Failed to load return detail");
      }
    }
  };


  const getExpandedOrder = (listOrder: AdminOrderListItem): AdminOrderDetail | null => {
    return detailsMap[listOrder.id] || null;
  };


  const getExpandedReturn = (listItem: AdminReturnListItem): AdminReturnDetail | null => {
    return returnDetailsMap[listItem.id] || null;
  };


  const getShipmentDraft = (order: AdminOrderListItem) => {
    return (
      shipmentDrafts[order.id] || {
        deliveryPartnerName: order.shipment?.delivery_partner_name || "",
        deliveryPartnerPhone: order.shipment?.delivery_partner_phone || "",
        estimatedDeliveryAt: toInputDateTime(order.shipment?.estimated_delivery_at),
      }
    );
  };


  const setShipmentDraftValue = (
    orderId: string,
    key: keyof ShipmentDraft,
    value: string
  ) => {
    setShipmentDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {
          deliveryPartnerName: "",
          deliveryPartnerPhone: "",
          estimatedDeliveryAt: "",
        }),
        [key]: value,
      },
    }));
  };


  const setReviewDraftValue = (
    returnId: string,
    updater: (draft: ReviewDraft) => ReviewDraft
  ) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [returnId]: updater(
        prev[returnId] || {
          action: "approve",
          adminNote: "",
          rejectionReason: "",
          approvedQuantities: {},
        }
      ),
    }));
  };


  const setReceiveDraftValue = (
    returnId: string,
    updater: (draft: ReceiveDraft) => ReceiveDraft
  ) => {
    setReceiveDrafts((prev) => ({
      ...prev,
      [returnId]: updater(
        prev[returnId] || {
          adminNote: "",
          receivedQuantities: {},
        }
      ),
    }));
  };


  const setInspectDraftValue = (
    returnId: string,
    updater: (draft: InspectDraft) => InspectDraft
  ) => {
    setInspectDrafts((prev) => ({
      ...prev,
      [returnId]: updater(
        prev[returnId] || {
          adminNote: "",
          restockDecisionByItem: {},
          restockQuantityByItem: {},
        }
      ),
    }));
  };


  const setRefundDraftValue = (
    returnId: string,
    updater: (draft: RefundDraft) => RefundDraft
  ) => {
    setRefundDrafts((prev) => ({
      ...prev,
      [returnId]: updater(
        prev[returnId] || {
          refundMethod: "cod_refund",
          finalRefundAmount: "",
          refundOverrideReason: "",
          adminNote: "",
        }
      ),
    }));
  };


  const handleConfirmOrder = async (orderId: string) => {
    await updateStatus(orderId, "confirmed");
  };


  const handleMarkShipped = async (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    const draft = getShipmentDraft(order);


    await updateStatus(orderId, "shipped", {
      delivery_partner_name: draft.deliveryPartnerName || null,
      delivery_partner_phone: draft.deliveryPartnerPhone || null,
      estimated_delivery_at: toIsoOrNull(draft.estimatedDeliveryAt),
    });
  };


  const handleOutForDelivery = async (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    const draft = getShipmentDraft(order);


    await updateStatus(orderId, "out_for_delivery", {
      delivery_partner_name: draft.deliveryPartnerName || null,
      delivery_partner_phone: draft.deliveryPartnerPhone || null,
      estimated_delivery_at: toIsoOrNull(draft.estimatedDeliveryAt),
    });
  };


  const handleDelivered = async (orderId: string) => {
    await updateStatus(orderId, "delivered");
  };


  const handleCancel = async (orderId: string) => {
    const cancelReason = window.prompt("Enter cancel reason") || "";
    await updateStatus(orderId, "cancelled", {
      cancel_reason: cancelReason || null,
    });
  };


  const handleSaveShipment = async (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;


    if (order.status === "confirmed") {
      await handleMarkShipped(orderId);
      return;
    }


    if (order.status === "shipped") {
      await handleOutForDelivery(orderId);
      return;
    }


    window.alert("Shipment details are saved when moving the order to shipped/out for delivery.");
  };


  const handleReviewReturn = async (returnId: string) => {
    if (!siteId) return;
    const draft = reviewDrafts[returnId];
    if (!draft) return;


    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          action: draft.action,
          admin_note: draft.adminNote || null,
          rejection_reason: draft.action === "reject" ? draft.rejectionReason || null : null,
          items:
            draft.action === "approve"
              ? Object.entries(draft.approvedQuantities).map(([return_item_id, quantity_approved]) => ({
                  return_item_id,
                  quantity_approved: Number(quantity_approved || 0),
                }))
              : [],
        }),
      });
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      window.alert(err.message || "Failed to review return request");
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleReceiveReturn = async (returnId: string) => {
    if (!siteId) return;
    const draft = receiveDrafts[returnId];
    if (!draft) return;


    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}/receive`, {
        method: "PATCH",
        body: JSON.stringify({
          admin_note: draft.adminNote || null,
          items: Object.entries(draft.receivedQuantities).map(
            ([return_item_id, quantity_received]) => ({
              return_item_id,
              quantity_received: Number(quantity_received || 0),
            })
          ),
        }),
      });
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      window.alert(err.message || "Failed to mark return as received");
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleInspectReturn = async (returnId: string) => {
    if (!siteId) return;
    const draft = inspectDrafts[returnId];
    if (!draft) return;


    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}/inspect`, {
        method: "PATCH",
        body: JSON.stringify({
          admin_note: draft.adminNote || null,
          items: Object.keys(draft.restockDecisionByItem).map((return_item_id) => ({
            return_item_id,
            restock_decision: draft.restockDecisionByItem[return_item_id],
            restock_quantity: Number(draft.restockQuantityByItem[return_item_id] || 0),
          })),
        }),
      });
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      window.alert(err.message || "Failed to inspect return");
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleRefundReturn = async (returnId: string) => {
    if (!siteId) return;
    const draft = refundDrafts[returnId];
    if (!draft) return;


    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}/refund`, {
        method: "PATCH",
        body: JSON.stringify({
          refund_method: draft.refundMethod,
          final_refund_amount:
            draft.finalRefundAmount.trim() === "" ? null : Number(draft.finalRefundAmount),
          refund_override_reason: draft.refundOverrideReason || null,
          admin_note: draft.adminNote || null,
        }),
      });
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      window.alert(err.message || "Failed to process refund");
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleCloseReturn = async (returnId: string) => {
    if (!siteId) return;


    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}/close`, {
        method: "PATCH",
      });
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      window.alert(err.message || "Failed to close return");
    } finally {
      setActionLoadingId(null);
    }
  };


  const generateBillPdf = (order: AdminOrderDetail | AdminOrderListItem) => {
    window.alert(`Generate invoice for ${order.id}`);
  };


  const renderRowActions = (order: AdminOrderListItem) => {
    const actionButtonStyle: React.CSSProperties = {
      border: "1px solid #cbd5e1",
      borderRadius: "6px",
      padding: "8px 10px",
      fontSize: "12px",
      fontWeight: 700,
      cursor: actionLoadingId === order.id ? "wait" : "pointer",
      whiteSpace: "nowrap",
      opacity: actionLoadingId === order.id ? 0.7 : 1,
      background: "#ffffff",
      color: "#0f172a",
    };


    if (activeTab === "new") {
      return (
        <>
          <button
            disabled={actionLoadingId === order.id}
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmOrder(order.id);
            }}
            style={{
              ...actionButtonStyle,
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
            }}
          >
            Accept
          </button>
          <button
            disabled={actionLoadingId === order.id}
            onClick={(e) => {
              e.stopPropagation();
              handleCancel(order.id);
            }}
            style={{
              ...actionButtonStyle,
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            Reject
          </button>
        </>
      );
    }


    if (activeTab === "yet_to_ship") {
      return (
        <>
          <button
            disabled={actionLoadingId === order.id}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkShipped(order.id);
            }}
            style={{
              ...actionButtonStyle,
              background: "#ecfeff",
              color: "#0e7490",
              border: "1px solid #a5f3fc",
            }}
          >
            Mark Shipped
          </button>


          <button
            onClick={(e) => {
              e.stopPropagation();
              const detail = detailsMap[order.id] || order;
              generateBillPdf(detail);
            }}
            style={actionButtonStyle}
          >
            Generate Bill PDF
          </button>


          <button
            disabled={actionLoadingId === order.id}
            onClick={(e) => {
              e.stopPropagation();
              handleCancel(order.id);
            }}
            style={{
              ...actionButtonStyle,
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            Cancel
          </button>
        </>
      );
    }


    if (activeTab === "yet_to_deliver") {
      return (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const detail = detailsMap[order.id] || order;
              generateBillPdf(detail);
            }}
            style={actionButtonStyle}
          >
            Generate Bill PDF
          </button>


          {order.status === "shipped" ? (
            <button
              disabled={actionLoadingId === order.id}
              onClick={(e) => {
                e.stopPropagation();
                handleOutForDelivery(order.id);
              }}
              style={{
                ...actionButtonStyle,
                background: "#fffbeb",
                color: "#b45309",
                border: "1px solid #fde68a",
              }}
            >
              Out for Delivery
            </button>
          ) : null}


          {order.status === "out_for_delivery" ? (
            <button
              disabled={actionLoadingId === order.id}
              onClick={(e) => {
                e.stopPropagation();
                handleDelivered(order.id);
              }}
              style={{
                ...actionButtonStyle,
                background: "#f0fdf4",
                color: "#15803d",
                border: "1px solid #bbf7d0",
              }}
            >
              Mark Delivered
            </button>
          ) : null}
        </>
      );
    }


    if (activeTab === "delivered") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const detail = detailsMap[order.id] || order;
            generateBillPdf(detail);
          }}
          style={actionButtonStyle}
        >
          Generate Bill PDF
        </button>
      );
    }


    return null;
  };


  const renderReturnRowActions = (returnItem: AdminReturnListItem) => {
    const actionButtonStyle: React.CSSProperties = {
      border: "1px solid #cbd5e1",
      borderRadius: "6px",
      padding: "8px 10px",
      fontSize: "12px",
      fontWeight: 700,
      cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
      whiteSpace: "nowrap",
      opacity: actionLoadingId === returnItem.id ? 0.7 : 1,
      background: "#ffffff",
      color: "#0f172a",
    };


    if (returnItem.status === "requested") {
      return (
        <button
          disabled={actionLoadingId === returnItem.id}
          onClick={(e) => {
            e.stopPropagation();
            handleReturnExpandToggle(returnItem.id);
          }}
          style={{
            ...actionButtonStyle,
            background: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
          }}
        >
          Review
        </button>
      );
    }


    if (returnItem.status === "approved") {
      return (
        <button
          disabled={actionLoadingId === returnItem.id}
          onClick={(e) => {
            e.stopPropagation();
            handleReturnExpandToggle(returnItem.id);
          }}
          style={{
            ...actionButtonStyle,
            background: "#fffbeb",
            color: "#b45309",
            border: "1px solid #fde68a",
          }}
        >
          Receive
        </button>
      );
    }


    if (returnItem.status === "received") {
      return (
        <button
          disabled={actionLoadingId === returnItem.id}
          onClick={(e) => {
            e.stopPropagation();
            handleReturnExpandToggle(returnItem.id);
          }}
          style={{
            ...actionButtonStyle,
            background: "#faf5ff",
            color: "#7c3aed",
            border: "1px solid #e9d5ff",
          }}
        >
          Inspect
        </button>
      );
    }


    if (returnItem.status === "inspected") {
      return (
        <button
          disabled={actionLoadingId === returnItem.id}
          onClick={(e) => {
            e.stopPropagation();
            handleReturnExpandToggle(returnItem.id);
          }}
          style={{
            ...actionButtonStyle,
            background: "#f0fdf4",
            color: "#15803d",
            border: "1px solid #bbf7d0",
          }}
        >
          Refund
        </button>
      );
    }


    if (returnItem.status === "refunded" || returnItem.status === "rejected") {
      return (
        <button
          disabled={actionLoadingId === returnItem.id}
          onClick={(e) => {
            e.stopPropagation();
            handleCloseReturn(returnItem.id);
          }}
          style={{
            ...actionButtonStyle,
            background: "#f1f5f9",
            color: "#334155",
            border: "1px solid #e2e8f0",
          }}
        >
          Close
        </button>
      );
    }


    return null;
  };


  return (
    <div style={{ color: "#0f172a" }}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        {(["orders", "returns"] as const).map((value) => {
          const isActive = mode === value;
          return (
            <button
              key={value}
              onClick={() => {
                setMode(value);
                setExpandedOrderId(null);
                setExpandedReturnId(null);
              }}
              style={{
                borderRadius: "6px",
                padding: "8px 12px",
                border: isActive ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                background: isActive ? "#eff6ff" : "#ffffff",
                color: isActive ? "#1d4ed8" : "#334155",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {value}
            </button>
          );
        })}
      </div>


      {error ? (
        <div
          style={{
            ...plainCardStyle,
            padding: "12px 14px",
            marginBottom: "16px",
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      ) : null}


      {mode === "orders" ? (
        <>
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setExpandedOrderId(null);
                  }}
                  style={{
                    borderRadius: "6px",
                    padding: "8px 12px",
                    border: isActive ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                    background: isActive ? "#eff6ff" : "#ffffff",
                    color: isActive ? "#1d4ed8" : "#334155",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {tab.label} ({counts[tab.key] || 0})
                </button>
              );
            })}
          </div>


          <div style={{ ...plainCardStyle, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "20px 16px", fontSize: "14px", color: "#64748b" }}>
                Loading orders...
              </div>
            ) : !filteredOrders.length ? (
              <div style={{ padding: "20px 16px", fontSize: "14px", color: "#64748b" }}>
                No records in this tab.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const tone = getStatusTone(order.status);
                  const detail = getExpandedOrder(order);
                  const shipmentDraft = getShipmentDraft(order);
                  const items = detail?.items || order.items || [];
                  const shippingAddress = detail?.shipping_address || order.shipping_address;


                  return (
                    <div key={order.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <div
                        onClick={() => handleExpandToggle(order.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1.2fr) minmax(0, 1fr) auto auto auto",
                          gap: "14px",
                          alignItems: "center",
                          padding: "14px 16px",
                          cursor: "pointer",
                          background: isExpanded ? "#f8fafc" : "transparent",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                            {order.id}
                          </div>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>
                            {order.customer_name || "—"}
                          </div>
                        </div>


                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
                            {formatDate(order.created_at)}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "13px", color: "#0f172a", fontWeight: 700 }}>
                              {formatPrice(order.total)}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "4px",
                                background: "#f1f5f9",
                                color: "#334155",
                                border: "1px solid #e2e8f0",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span>{getPaymentMethodIcon(order.payment_method)}</span>
                              <span>{formatPaymentMethodName(order.payment_method)}</span>
                            </span>
                          </div>
                        </div>


                        <div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "6px 9px",
                              borderRadius: "4px",
                              background: tone.bg,
                              color: tone.text,
                              border: tone.border,
                              fontSize: "12px",
                              fontWeight: 700,
                              textTransform: "capitalize",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getStatusLabel(order.status)}
                          </span>
                        </div>


                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          {renderRowActions(order)}
                        </div>


                        <div style={{ fontSize: "18px", color: "#94a3b8", justifySelf: "end" }}>
                          {isExpanded ? "−" : "+"}
                        </div>
                      </div>


                      {isExpanded ? (
                        <div style={{ padding: "0 16px 16px", background: "#ffffff" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
                              gap: "14px",
                              alignItems: "start",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                                  Order Items
                                </div>


                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {items.map((item) => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: "12px",
                                        padding: "10px",
                                        borderRadius: "6px",
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontSize: "14px", fontWeight: 700 }}>
                                          {item.product_name}
                                        </div>
                                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                                          Qty {item.quantity}
                                          {item.selected_variant_value ? ` · ${item.selected_variant_value}` : ""}
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                                          Item status: {item.status.replaceAll("_", " ")}
                                        </div>
                                      </div>


                                      <div style={{ fontSize: "14px", fontWeight: 700 }}>
                                        {formatPrice(item.line_total)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>


                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                                  Shipping Address
                                </div>


                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>
                                  {shippingAddress?.fullName || "—"}
                                </div>
                                <div style={{ fontSize: "14px", color: "#475569", lineHeight: 1.7 }}>
                                  {shippingAddress?.addressLine1 || "—"}
                                  <br />
                                  {(shippingAddress?.city || "—")} - {(shippingAddress?.postalCode || "—")}
                                  <br />
                                  {shippingAddress?.mobileNumber || "—"}
                                  {shippingAddress?.email ? ` · ${shippingAddress.email}` : ""}
                                </div>
                              </div>


                              {detail?.cancel_reason ? (
                                <div style={{ ...plainCardStyle, padding: "14px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>
                                    Cancel Reason
                                  </div>
                                  <div style={{ fontSize: "14px", color: "#475569" }}>{detail.cancel_reason}</div>
                                </div>
                              ) : null}
                            </div>


                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span>Customer & Payment</span>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      background: (detail?.payment_status || order.payment_status) === "paid"
                                        ? "#f0fdf4"
                                        : (detail?.payment_status || order.payment_status) === "refunded"
                                        ? "#faf5ff"
                                        : "#fffbeb",
                                      color: (detail?.payment_status || order.payment_status) === "paid"
                                        ? "#15803d"
                                        : (detail?.payment_status || order.payment_status) === "refunded"
                                        ? "#7c3aed"
                                        : "#b45309",
                                      border: (detail?.payment_status || order.payment_status) === "paid"
                                        ? "1px solid #bbf7d0"
                                        : (detail?.payment_status || order.payment_status) === "refunded"
                                        ? "1px solid #e9d5ff"
                                        : "1px solid #fde68a",
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {(detail?.payment_status || order.payment_status) || "Pending"}
                                  </span>
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>
                                  {detail?.customer_name || order.customer_name || "—"}
                                </div>
                                <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.8 }}>
                                  {detail?.customer_phone || order.customer_phone || "—"}
                                  <br />
                                  {detail?.customer_email || order.customer_email || "—"}
                                </div>
                                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                                    <span style={{ color: "#64748b" }}>Payment Method:</span>
                                    <span style={{ fontWeight: 700, color: "#0f172a", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                      <span>{getPaymentMethodIcon(detail?.payment_method || order.payment_method)}</span>
                                      <span>{formatPaymentMethodName(detail?.payment_method || order.payment_method)}</span>
                                    </span>
                                  </div>
                                  {(detail?.razorpay_payment_id || order.razorpay_payment_id) && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                                      <span style={{ color: "#64748b" }}>Payment Ref:</span>
                                      <code style={{ fontSize: "11px", fontWeight: 700, background: "#f8fafc", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0f172a" }}>
                                        {detail?.razorpay_payment_id || order.razorpay_payment_id}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              </div>


                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                                  Shipment Control
                                </div>


                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                  <div>
                                    <div style={labelStyle}>Delivery Partner Name</div>
                                    <input
                                      value={shipmentDraft.deliveryPartnerName}
                                      onChange={(e) =>
                                        setShipmentDraftValue(order.id, "deliveryPartnerName", e.target.value)
                                      }
                                      placeholder="Enter delivery partner name"
                                      style={inputStyle}
                                    />
                                  </div>


                                  <div>
                                    <div style={labelStyle}>Delivery Partner Phone</div>
                                    <input
                                      value={shipmentDraft.deliveryPartnerPhone}
                                      onChange={(e) =>
                                        setShipmentDraftValue(order.id, "deliveryPartnerPhone", e.target.value)
                                      }
                                      placeholder="Enter delivery partner phone"
                                      style={inputStyle}
                                    />
                                  </div>


                                  <div>
                                    <div style={labelStyle}>Estimated Delivery Time</div>
                                    <input
                                      type="datetime-local"
                                      value={shipmentDraft.estimatedDeliveryAt}
                                      onChange={(e) =>
                                        setShipmentDraftValue(order.id, "estimatedDeliveryAt", e.target.value)
                                      }
                                      style={inputStyle}
                                    />
                                  </div>


                                  <button
                                    onClick={() => handleSaveShipment(order.id)}
                                    style={{
                                      border: "1px solid #cbd5e1",
                                      background: "#ffffff",
                                      color: "#0f172a",
                                      borderRadius: "6px",
                                      padding: "10px 12px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Save Shipment Details
                                  </button>
                                </div>
                              </div>


                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                                  Timeline
                                </div>
                                <div style={{ display: "grid", gap: "6px", fontSize: "14px", color: "#475569" }}>
                                  <div>Created: {formatDate(order.created_at)}</div>
                                  <div>Confirmed: {formatDate(order.confirmed_at)}</div>
                                  <div>Shipped: {formatDate(order.shipped_at)}</div>
                                  <div>Delivered: {formatDate(order.delivered_at)}</div>
                                  <div>Cancelled: {formatDate(order.cancelled_at)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            {returnTabs.map((tab) => {
              const isActive = activeReturnTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveReturnTab(tab.key);
                    setExpandedReturnId(null);
                  }}
                  style={{
                    borderRadius: "6px",
                    padding: "8px 12px",
                    border: isActive ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                    background: isActive ? "#eff6ff" : "#ffffff",
                    color: isActive ? "#1d4ed8" : "#334155",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {tab.label} ({returnCounts[tab.key] || 0})
                </button>
              );
            })}
          </div>


          <div style={{ ...plainCardStyle, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "20px 16px", fontSize: "14px", color: "#64748b" }}>
                Loading returns...
              </div>
            ) : !filteredReturns.length ? (
              <div style={{ padding: "20px 16px", fontSize: "14px", color: "#64748b" }}>
                No records in this tab.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredReturns.map((returnItem) => {
                  const isExpanded = expandedReturnId === returnItem.id;
                  const tone = getStatusTone(returnItem.status);
                  const detail = getExpandedReturn(returnItem);


                  const reviewDraft: ReviewDraft =
                    reviewDrafts[returnItem.id] || {
                      action: "approve" as const,
                      adminNote: returnItem.admin_note || "",
                      rejectionReason: returnItem.rejection_reason || "",
                      approvedQuantities: Object.fromEntries(
                        detail?.items.map((item) => [item.id, item.quantity_requested]) || []
                      ),
                    };

                  const receiveDraft: ReceiveDraft =
                    receiveDrafts[returnItem.id] || {
                      adminNote: returnItem.admin_note || "",
                      receivedQuantities: Object.fromEntries(
                        detail?.items.map((item) => [item.id, item.quantity_approved ?? 0]) || []
                      ),
                    };

                  const inspectDraft: InspectDraft =
                    inspectDrafts[returnItem.id] || {
                      adminNote: returnItem.admin_note || "",
                      restockDecisionByItem: Object.fromEntries(
                        detail?.items.map((item) => [
                          item.id,
                          (item.restock_decision || "restock") as "restock" | "quarantine" | "discard",
                        ]) || []
                      ),
                      restockQuantityByItem: Object.fromEntries(
                        detail?.items.map((item) => [item.id, item.restocked_quantity ?? item.quantity_received ?? 0]) || []
                      ),
                    };

                  const refundDraft: RefundDraft =
                    refundDrafts[returnItem.id] || {
                      refundMethod: detail?.refund_method || "cod_refund",
                      finalRefundAmount: String(returnItem.final_refund_amount ?? ""),
                      refundOverrideReason: detail?.refund_override_reason || "",
                      adminNote: returnItem.admin_note || "",
                    };


                  return (
                    <div key={returnItem.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <div
                        onClick={() => handleReturnExpandToggle(returnItem.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1.2fr) minmax(0, 1fr) auto auto auto",
                          gap: "14px",
                          alignItems: "center",
                          padding: "14px 16px",
                          cursor: "pointer",
                          background: isExpanded ? "#f8fafc" : "transparent",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                            {returnItem.id}
                          </div>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>
                            Order: {returnItem.order_id}
                          </div>
                        </div>


                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>
                            {formatDate(returnItem.created_at)}
                          </div>
                          <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 700 }}>
                            {formatPrice(returnItem.final_refund_amount)}
                          </div>
                        </div>


                        <div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "6px 9px",
                              borderRadius: "4px",
                              background: tone.bg,
                              color: tone.text,
                              border: tone.border,
                              fontSize: "12px",
                              fontWeight: 700,
                              textTransform: "capitalize",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getStatusLabel(returnItem.status)}
                          </span>
                        </div>


                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          {renderReturnRowActions(returnItem)}
                        </div>


                        <div style={{ fontSize: "18px", color: "#94a3b8", justifySelf: "end" }}>
                          {isExpanded ? "−" : "+"}
                        </div>
                      </div>


                      {isExpanded ? (
                        <div style={{ padding: "0 16px 16px", background: "#ffffff" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
                              gap: "14px",
                              alignItems: "start",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                                  Return Items
                                </div>


                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {(detail?.items || []).map((item) => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: "12px",
                                        padding: "10px",
                                        borderRadius: "6px",
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontSize: "14px", fontWeight: 700 }}>
                                          {item.product_name}
                                        </div>
                                        {(item.selected_variant_label || item.selected_variant_value) ? (
                                          <div style={{ marginTop: "4px" }}>
                                            <span style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              fontSize: "12px",
                                              fontWeight: 600,
                                              color: "#7c3aed",
                                              background: "#f5f3ff",
                                              border: "1px solid #e9d5ff",
                                              borderRadius: "4px",
                                              padding: "2px 8px",
                                            }}>
                                              {item.selected_variant_label
                                                ? <><span style={{ opacity: 0.7 }}>{item.selected_variant_label}:</span> {item.selected_variant_value}</>
                                                : item.selected_variant_value}
                                            </span>
                                          </div>
                                        ) : null}
                                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>
                                          Requested {item.quantity_requested} · Approved {item.quantity_approved} · Received {item.quantity_received}
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                                          Reason: {item.reason_code.replaceAll("_", " ")}
                                          {item.reason_note ? ` · ${item.reason_note}` : ""}
                                        </div>
                                      </div>


                                      <div style={{ fontSize: "14px", fontWeight: 700 }}>
                                        {formatPrice(item.line_refund_final)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>


                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                                  Return Timeline
                                </div>
                                <div style={{ display: "grid", gap: "6px", fontSize: "14px", color: "#475569" }}>
                                  <div>Requested: {formatDate(returnItem.created_at)}</div>
                                  <div>Approved: {formatDate(detail?.approved_at || returnItem.approved_at)}</div>
                                  <div>Received: {formatDate(detail?.received_at || returnItem.received_at)}</div>
                                  <div>Inspected: {formatDate(detail?.inspected_at || returnItem.inspected_at)}</div>
                                  <div>Refunded: {formatDate(detail?.refunded_at || returnItem.refunded_at)}</div>
                                  <div>Closed: {formatDate(detail?.closed_at || returnItem.closed_at)}</div>
                                </div>
                              </div>
                            </div>


                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                              <div style={{ ...plainCardStyle, padding: "14px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
                                  Return Summary
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>
                                  Order {returnItem.order_id}
                                </div>
                                <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.8 }}>
                                  Items: {returnItem.item_count}
                                  <br />
                                  Requested Qty: {returnItem.total_quantity_requested}
                                  <br />
                                  Suggested Refund: {formatPrice(returnItem.suggested_refund_amount)}
                                  <br />
                                </div>

                                {(detail?.customer_refund_account || returnItem.customer_refund_account) && (
                                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}>
                                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span>⚡ Customer Refund Destination:</span>
                                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#ecfdf5", color: "#059669", fontWeight: 800, textTransform: "uppercase" }}>
                                        {(detail?.customer_refund_account || returnItem.customer_refund_account).type || "UPI"}
                                      </span>
                                    </div>
                                    {(detail?.customer_refund_account || returnItem.customer_refund_account).type === "upi" ? (
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                        <code style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                                          {(detail?.customer_refund_account || returnItem.customer_refund_account).upi_id}
                                        </code>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText((detail?.customer_refund_account || returnItem.customer_refund_account).upi_id);
                                            alert("Copied UPI ID to clipboard!");
                                          }}
                                          style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "3px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", color: "#2563eb", fontWeight: 700 }}
                                        >
                                          Copy UPI
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: "12px", color: "#334155", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", lineHeight: 1.6 }}>
                                        <div><strong>Name:</strong> {(detail?.customer_refund_account || returnItem.customer_refund_account).account_holder || "—"}</div>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <div><strong>A/C:</strong> {(detail?.customer_refund_account || returnItem.customer_refund_account).account_number}</div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText((detail?.customer_refund_account || returnItem.customer_refund_account).account_number);
                                              alert("Copied Account Number to clipboard!");
                                            }}
                                            style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "2px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "10px", color: "#2563eb", fontWeight: 700 }}
                                          >
                                            Copy A/C
                                          </button>
                                        </div>
                                        <div><strong>IFSC:</strong> {(detail?.customer_refund_account || returnItem.customer_refund_account).ifsc_code}</div>
                                        {(detail?.customer_refund_account || returnItem.customer_refund_account).bank_name && (
                                          <div><strong>Bank:</strong> {(detail?.customer_refund_account || returnItem.customer_refund_account).bank_name}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {returnItem.status === "requested" ? (
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "12px", color: "#0f172a" }}>
                                    Review Return Request
                                  </div>

                                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReviewDraftValue(returnItem.id, (draft) => ({
                                          ...draft,
                                          action: "approve",
                                        }))
                                      }
                                      style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: reviewDraft.action === "approve" ? "2px solid #16a34a" : "1px solid #cbd5e1",
                                        background: reviewDraft.action === "approve" ? "#f0fdf4" : "#ffffff",
                                        color: reviewDraft.action === "approve" ? "#15803d" : "#475569",
                                        fontWeight: 700,
                                        fontSize: "13px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✓ Approve Return
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReviewDraftValue(returnItem.id, (draft) => ({
                                          ...draft,
                                          action: "reject",
                                        }))
                                      }
                                      style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        borderRadius: "6px",
                                        border: reviewDraft.action === "reject" ? "2px solid #dc2626" : "1px solid #cbd5e1",
                                        background: reviewDraft.action === "reject" ? "#fef2f2" : "#ffffff",
                                        color: reviewDraft.action === "reject" ? "#b91c1c" : "#475569",
                                        fontWeight: 700,
                                        fontSize: "13px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✕ Reject Return
                                    </button>
                                  </div>

                                  {reviewDraft.action === "approve" ? (
                                    <div style={{ marginBottom: "14px" }}>
                                      <div style={{ ...labelStyle, marginBottom: "8px" }}>Item Approval Quantities</div>
                                      <div style={{ display: "grid", gap: "8px" }}>
                                        {(detail?.items || []).map((item) => {
                                          const approvedQty =
                                            reviewDraft.approvedQuantities[item.id] ?? item.quantity_requested;
                                          return (
                                            <div
                                              key={item.id}
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "8px 10px",
                                                borderRadius: "6px",
                                                background: "#f8fafc",
                                                border: "1px solid #e2e8f0",
                                              }}
                                            >
                                              <div style={{ fontSize: "13px", fontWeight: 600, minWidth: 0, paddingRight: "8px" }}>
                                                {item.product_name}
                                                <div style={{ fontSize: "11px", color: "#64748b" }}>
                                                  Requested: {item.quantity_requested}
                                                </div>
                                              </div>
                                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                <span style={{ fontSize: "12px", color: "#475569" }}>Approve:</span>
                                                <input
                                                  type="number"
                                                  min={0}
                                                  max={item.quantity_requested}
                                                  value={approvedQty}
                                                  onChange={(e) => {
                                                    const val = Math.max(0, Math.min(item.quantity_requested, Number(e.target.value) || 0));
                                                    setReviewDraftValue(returnItem.id, (draft) => ({
                                                      ...draft,
                                                      approvedQuantities: {
                                                        ...draft.approvedQuantities,
                                                        [item.id]: val,
                                                      },
                                                    }));
                                                  }}
                                                  style={{ ...inputStyle, width: "64px", textAlign: "center", padding: "4px 6px" }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ marginBottom: "14px" }}>
                                      <div style={labelStyle}>Rejection Reason (Required)</div>
                                      <input
                                        value={reviewDraft.rejectionReason}
                                        onChange={(e) =>
                                          setReviewDraftValue(returnItem.id, (draft) => ({
                                            ...draft,
                                            rejectionReason: e.target.value,
                                          }))
                                        }
                                        placeholder="e.g. Item not eligible, policy exceeded"
                                        style={inputStyle}
                                      />
                                    </div>
                                  )}

                                  <div style={{ marginBottom: "14px" }}>
                                    <div style={labelStyle}>Admin Note (Optional)</div>
                                    <textarea
                                      value={reviewDraft.adminNote}
                                      onChange={(e) =>
                                        setReviewDraftValue(returnItem.id, (draft) => ({
                                          ...draft,
                                          adminNote: e.target.value,
                                        }))
                                      }
                                      placeholder="Internal note for records..."
                                      style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }}
                                    />
                                  </div>

                                  <button
                                    onClick={() => handleReviewReturn(returnItem.id)}
                                    disabled={actionLoadingId === returnItem.id}
                                    style={{
                                      width: "100%",
                                      border: "none",
                                      background: reviewDraft.action === "approve" ? "#16a34a" : "#dc2626",
                                      color: "#ffffff",
                                      borderRadius: "6px",
                                      padding: "10px 14px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                    }}
                                  >
                                    {reviewDraft.action === "approve" ? "Confirm & Approve Return" : "Submit Rejection"}
                                  </button>
                                </div>
                              ) : null}


                              {returnItem.status === "approved" ? (
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px", color: "#0f172a" }}>
                                    Receive Returned Items
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
                                    Verify physical arrival of products and enter actual received quantities.
                                  </div>

                                  <div style={{ display: "grid", gap: "8px", marginBottom: "14px" }}>
                                    {(detail?.items || []).map((item) => {
                                      const receivedQty =
                                        receiveDraft.receivedQuantities[item.id] ?? item.quantity_approved;
                                      return (
                                        <div
                                          key={item.id}
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "8px 10px",
                                            borderRadius: "6px",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                          }}
                                        >
                                          <div style={{ fontSize: "13px", fontWeight: 600, minWidth: 0, paddingRight: "8px" }}>
                                            {item.product_name}
                                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                                              Approved Qty: {item.quantity_approved}
                                            </div>
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ fontSize: "12px", color: "#475569" }}>Received Qty:</span>
                                            <input
                                              type="number"
                                              min={0}
                                              max={item.quantity_approved}
                                              value={receivedQty}
                                              onChange={(e) => {
                                                const val = Math.max(0, Math.min(item.quantity_approved, Number(e.target.value) || 0));
                                                setReceiveDraftValue(returnItem.id, (draft) => ({
                                                  ...draft,
                                                  receivedQuantities: {
                                                    ...draft.receivedQuantities,
                                                    [item.id]: val,
                                                  },
                                                }));
                                              }}
                                              style={{ ...inputStyle, width: "64px", textAlign: "center", padding: "4px 6px" }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div style={{ marginBottom: "14px" }}>
                                    <div style={labelStyle}>Admin Note (Optional)</div>
                                    <textarea
                                      value={receiveDraft.adminNote}
                                      onChange={(e) =>
                                        setReceiveDraftValue(returnItem.id, (draft) => ({
                                          ...draft,
                                          adminNote: e.target.value,
                                        }))
                                      }
                                      placeholder="Condition of package on delivery..."
                                      style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }}
                                    />
                                  </div>

                                  <button
                                    onClick={() => handleReceiveReturn(returnItem.id)}
                                    disabled={actionLoadingId === returnItem.id}
                                    style={{
                                      width: "100%",
                                      border: "none",
                                      background: "#2563eb",
                                      color: "#ffffff",
                                      borderRadius: "6px",
                                      padding: "10px 14px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                    }}
                                  >
                                    Confirm Received Package & Quantities
                                  </button>
                                </div>
                              ) : null}


                              {returnItem.status === "received" ? (
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px", color: "#0f172a" }}>
                                    Product Quality Inspection & Stock Restock
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
                                    Inspect received items. Choosing <b>Restock</b> will automatically restore product inventory!
                                  </div>

                                  <div style={{ display: "grid", gap: "10px", marginBottom: "14px" }}>
                                    {(detail?.items || []).map((item) => {
                                      const currentDecision =
                                        inspectDraft.restockDecisionByItem[item.id] || "restock";
                                      const restockQty =
                                        inspectDraft.restockQuantityByItem[item.id] ?? item.quantity_received;

                                      return (
                                        <div
                                          key={item.id}
                                          style={{
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            display: "grid",
                                            gap: "8px",
                                          }}
                                        >
                                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700 }}>
                                            <span>{item.product_name}</span>
                                            <span style={{ color: "#64748b" }}>Received: {item.quantity_received}</span>
                                          </div>

                                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px", alignItems: "center" }}>
                                            <div>
                                              <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600 }}>Decision</div>
                                              <select
                                                value={currentDecision}
                                                onChange={(e) => {
                                                  const dec = e.target.value as "restock" | "quarantine" | "discard";
                                                  setInspectDraftValue(returnItem.id, (draft) => ({
                                                    ...draft,
                                                    restockDecisionByItem: {
                                                      ...draft.restockDecisionByItem,
                                                      [item.id]: dec,
                                                    },
                                                    restockQuantityByItem: {
                                                      ...draft.restockQuantityByItem,
                                                      [item.id]: dec === "restock" ? item.quantity_received : 0,
                                                    },
                                                  }));
                                                }}
                                                style={{ ...inputStyle, padding: "6px 8px", fontSize: "12px" }}
                                              >
                                                <option value="restock">📦 Restock (Return to Stock)</option>
                                                <option value="discard">🗑️ Discard (Damaged / Unsellable)</option>
                                                <option value="quarantine">⚠️ Quarantine (Hold for Quality Check)</option>
                                              </select>
                                            </div>

                                            <div>
                                              <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600 }}>
                                                {currentDecision === "restock" ? "Restock Qty (+Stock)" : "Qty Processed"}
                                              </div>
                                              <input
                                                type="number"
                                                min={0}
                                                max={item.quantity_received}
                                                disabled={currentDecision !== "restock"}
                                                value={restockQty}
                                                onChange={(e) => {
                                                  const val = Math.max(0, Math.min(item.quantity_received, Number(e.target.value) || 0));
                                                  setInspectDraftValue(returnItem.id, (draft) => ({
                                                    ...draft,
                                                    restockQuantityByItem: {
                                                      ...draft.restockQuantityByItem,
                                                      [item.id]: val,
                                                    },
                                                  }));
                                                }}
                                                style={{ ...inputStyle, padding: "6px 8px", fontSize: "12px" }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div style={{ marginBottom: "14px" }}>
                                    <div style={labelStyle}>Inspection Note (Optional)</div>
                                    <textarea
                                      value={inspectDraft.adminNote}
                                      onChange={(e) =>
                                        setInspectDraftValue(returnItem.id, (draft) => ({
                                          ...draft,
                                          adminNote: e.target.value,
                                        }))
                                      }
                                      placeholder="Notes on packaging or product condition..."
                                      style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }}
                                    />
                                  </div>

                                  <button
                                    onClick={() => handleInspectReturn(returnItem.id)}
                                    disabled={actionLoadingId === returnItem.id}
                                    style={{
                                      width: "100%",
                                      border: "none",
                                      background: "#7c3aed",
                                      color: "#ffffff",
                                      borderRadius: "6px",
                                      padding: "10px 14px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                    }}
                                  >
                                    Submit Inspection & Update Stock
                                  </button>
                                </div>
                              ) : null}


                              {returnItem.status === "inspected" ? (
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px", color: "#0f172a" }}>
                                    Process Customer Refund
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
                                    Calculated Allowed Refund: <b>{formatPrice(returnItem.suggested_refund_amount)}</b>
                                  </div>

                                  <div style={{ display: "grid", gap: "10px", marginBottom: "14px" }}>
                                    <div>
                                      <div style={labelStyle}>Refund Method</div>
                                      <select
                                        value={refundDraft.refundMethod}
                                        onChange={(e) =>
                                          setRefundDraftValue(returnItem.id, (draft) => ({
                                            ...draft,
                                            refundMethod: e.target.value,
                                          }))
                                        }
                                        style={inputStyle}
                                      >
                                        <option value="cod_refund">Bank Transfer / Cash Refund</option>
                                        <option value="store_credit">Store Credit Coupon</option>
                                        <option value="original_payment">Original Payment Gateway Refund</option>
                                      </select>
                                    </div>

                                    <div>
                                      <div style={labelStyle}>Final Refund Amount (₹)</div>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={refundDraft.finalRefundAmount}
                                        onChange={(e) =>
                                          setRefundDraftValue(returnItem.id, (draft) => ({
                                            ...draft,
                                            finalRefundAmount: e.target.value,
                                          }))
                                        }
                                        style={inputStyle}
                                      />
                                    </div>

                                    {Number(refundDraft.finalRefundAmount || 0) !== returnItem.suggested_refund_amount ? (
                                      <div>
                                        <div style={labelStyle}>Refund Override Reason (Required for amount change)</div>
                                        <input
                                          value={refundDraft.refundOverrideReason}
                                          onChange={(e) =>
                                            setRefundDraftValue(returnItem.id, (draft) => ({
                                              ...draft,
                                              refundOverrideReason: e.target.value,
                                            }))
                                          }
                                          placeholder="Reason for adjusting refund amount..."
                                          style={inputStyle}
                                        />
                                      </div>
                                    ) : null}

                                    <div>
                                      <div style={labelStyle}>Admin Note</div>
                                      <textarea
                                        value={refundDraft.adminNote}
                                        onChange={(e) =>
                                          setRefundDraftValue(returnItem.id, (draft) => ({
                                            ...draft,
                                            adminNote: e.target.value,
                                          }))
                                        }
                                        placeholder="Refund reference ID or payment note..."
                                        style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }}
                                      />
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleRefundReturn(returnItem.id)}
                                    disabled={actionLoadingId === returnItem.id}
                                    style={{
                                      width: "100%",
                                      border: "none",
                                      background: "#16a34a",
                                      color: "#ffffff",
                                      borderRadius: "6px",
                                      padding: "10px 14px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                    }}
                                  >
                                    Confirm & Issue Refund ({formatPrice(Number(refundDraft.finalRefundAmount || returnItem.final_refund_amount))})
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};


export default AdminOrders;
