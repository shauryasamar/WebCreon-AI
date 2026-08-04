import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL as API_BASE} from "../config/api";
type AdminMode = "orders" | "returns";

type OrderStatus =
  | "placed"
  | "confirmed"
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
  total: number;
  payment_method: string;
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
  total: number;
  payment_method: string;
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

type SiteRecord = {
  id: string;
  name?: string;
  slug?: string;
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


const sectionCardStyle: React.CSSProperties = {
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(15,23,42,0.72)",
  backdropFilter: "blur(14px)",
  boxShadow: "0 10px 30px rgba(2,6,23,0.28)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#f8fafc",
  padding: "11px 12px",
  outline: "none",
  fontSize: "14px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "rgba(255,255,255,0.62)",
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

const getStatusLabel = (status: string) => status.replaceAll("_", " ");

const getStatusTone = (status: string) => {
  switch (status) {
    case "placed":
      return {
        bg: "rgba(59,130,246,0.14)",
        text: "#93c5fd",
        border: "1px solid rgba(59,130,246,0.22)",
      };
    case "confirmed":
      return {
        bg: "rgba(14,165,233,0.14)",
        text: "#67e8f9",
        border: "1px solid rgba(14,165,233,0.22)",
      };
    case "shipped":
      return {
        bg: "rgba(245,158,11,0.14)",
        text: "#fcd34d",
        border: "1px solid rgba(245,158,11,0.22)",
      };
    case "out_for_delivery":
      return {
        bg: "rgba(168,85,247,0.14)",
        text: "#d8b4fe",
        border: "1px solid rgba(168,85,247,0.22)",
      };
    case "delivered":
      return {
        bg: "rgba(34,197,94,0.14)",
        text: "#86efac",
        border: "1px solid rgba(34,197,94,0.22)",
      };
    case "cancelled":
    case "partially_cancelled":
      return {
        bg: "rgba(239,68,68,0.14)",
        text: "#fca5a5",
        border: "1px solid rgba(239,68,68,0.22)",
      };
    case "requested":
      return {
        bg: "rgba(59,130,246,0.14)",
        text: "#93c5fd",
        border: "1px solid rgba(59,130,246,0.22)",
      };
    case "approved":
      return {
        bg: "rgba(14,165,233,0.14)",
        text: "#67e8f9",
        border: "1px solid rgba(14,165,233,0.22)",
      };
    case "received":
      return {
        bg: "rgba(245,158,11,0.14)",
        text: "#fcd34d",
        border: "1px solid rgba(245,158,11,0.22)",
      };
    case "inspected":
      return {
        bg: "rgba(168,85,247,0.14)",
        text: "#d8b4fe",
        border: "1px solid rgba(168,85,247,0.22)",
      };
    case "refunded":
      return {
        bg: "rgba(34,197,94,0.14)",
        text: "#86efac",
        border: "1px solid rgba(34,197,94,0.22)",
      };
    case "closed":
      return {
        bg: "rgba(148,163,184,0.16)",
        text: "#cbd5e1",
        border: "1px solid rgba(148,163,184,0.22)",
      };
    case "rejected":
      return {
        bg: "rgba(239,68,68,0.14)",
        text: "#fca5a5",
        border: "1px solid rgba(239,68,68,0.22)",
      };
    default:
      return {
        bg: "rgba(255,255,255,0.06)",
        text: "#e2e8f0",
        border: "1px solid rgba(255,255,255,0.12)",
      };
  }
};

const matchesTab = (order: AdminOrderListItem, tab: TabKey) => {
  switch (tab) {
    case "new":
      return order.status === "placed";
    case "yet_to_ship":
      return order.status === "confirmed";
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
  const [mode, setMode] = useState<AdminMode>("orders");
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

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
        prev[returnId] ||
        {
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
        prev[returnId] ||
        {
          adminNote: detail.admin_note || "",
          receivedQuantities: Object.fromEntries(
            detail.items.map((item) => [item.id, item.quantity_approved || 0])
          ),
        },
    }));

    setInspectDrafts((prev) => ({
      ...prev,
      [returnId]:
        prev[returnId] ||
        {
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
        prev[returnId] ||
        {
          refundMethod: detail.refund_method || "cod_refund",
          finalRefundAmount: String(detail.final_refund_amount ?? ""),
          refundOverrideReason: detail.refund_override_reason || "",
          adminNote: detail.admin_note || "",
        },
    }));
  };

  const loadSites = async () => {
    const siteList = await fetchJson(`${API_BASE}/sites`);
    const normalizedSites: SiteRecord[] = Array.isArray(siteList) ? siteList : [];
    setSites(normalizedSites);
    return normalizedSites;
  };

  const loadOrdersForSite = async (siteId: string) => {
    const orderList = await fetchJson(`${API_BASE}/orders/admin/${siteId}`);
    setOrders(Array.isArray(orderList) ? orderList : []);
    setDetailsMap({});
    setExpandedOrderId(null);
  };

  const loadReturnsForSite = async (siteId: string) => {
    const returnList = await fetchJson(`${API_BASE}/returns/admin/${siteId}`);
    setAdminReturns(Array.isArray(returnList) ? returnList : []);
    setReturnDetailsMap({});
    setExpandedReturnId(null);
  };

  const loadSitesAndRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const siteList = await loadSites();
      const fallbackSiteId = siteList[0]?.id || "";
      const siteIdToUse = selectedSiteId || fallbackSiteId;

      if (!siteIdToUse) {
        setOrders([]);
        setAdminReturns([]);
        setLoading(false);
        return;
      }

      if (!selectedSiteId) {
        setSelectedSiteId(siteIdToUse);
      }

      if (mode === "orders") {
        await loadOrdersForSite(siteIdToUse);
      } else {
        await loadReturnsForSite(siteIdToUse);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin data");
      setOrders([]);
      setAdminReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSitesAndRecords();
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;

    const loadByMode = async () => {
      setLoading(true);
      setError("");
      try {
        if (mode === "orders") {
          await loadOrdersForSite(selectedSiteId);
        } else {
          await loadReturnsForSite(selectedSiteId);
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
  }, [selectedSiteId, mode]);

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
    if (!selectedSiteId) return;
    if (detailsMap[orderId]) return;

    const detail = await fetchJson(`${API_BASE}/orders/admin/${selectedSiteId}/${orderId}`);
    setDetailsMap((prev) => ({ ...prev, [orderId]: detail }));
    hydrateShipmentDraft(orderId, detail);
  };

  const ensureReturnDetail = async (returnId: string) => {
    if (!selectedSiteId) return;
    if (returnDetailsMap[returnId]) return;

    const detail = await fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}/${returnId}`);
    setReturnDetailsMap((prev) => ({ ...prev, [returnId]: detail }));
    hydrateReturnDrafts(returnId, detail);
  };

  const syncOrderAfterAction = async (orderId: string) => {
    if (!selectedSiteId) return;

    const [orderList, detail] = await Promise.all([
      fetchJson(`${API_BASE}/orders/admin/${selectedSiteId}`),
      fetchJson(`${API_BASE}/orders/admin/${selectedSiteId}/${orderId}`),
    ]);

    setOrders(Array.isArray(orderList) ? orderList : []);
    setDetailsMap((prev) => ({ ...prev, [orderId]: detail }));
    hydrateShipmentDraft(orderId, detail);
  };

  const syncReturnAfterAction = async (returnId: string) => {
    if (!selectedSiteId) return;

    const [returnList, detail] = await Promise.all([
      fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}`),
      fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}/${returnId}`),
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
    if (!selectedSiteId) return;
    setActionLoadingId(orderId);
    try {
      await fetchJson(`${API_BASE}/orders/admin/${selectedSiteId}/${orderId}/status`, {
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
    if (!selectedSiteId) return;
    const draft = reviewDrafts[returnId];
    if (!draft) return;

    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}/${returnId}/review`, {
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
    if (!selectedSiteId) return;
    const draft = receiveDrafts[returnId];
    if (!draft) return;

    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}/${returnId}/receive`, {
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
    if (!selectedSiteId) return;
    const draft = inspectDrafts[returnId];
    if (!draft) return;

    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}/${returnId}/inspect`, {
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
    if (!selectedSiteId) return;
    const draft = refundDrafts[returnId];
    if (!draft) return;

    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}/${returnId}/refund`, {
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
    if (!selectedSiteId) return;

    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${selectedSiteId}/${returnId}/close`, {
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
      border: "none",
      borderRadius: "10px",
      padding: "9px 12px",
      fontSize: "12px",
      fontWeight: 700,
      cursor: actionLoadingId === order.id ? "wait" : "pointer",
      whiteSpace: "nowrap",
      opacity: actionLoadingId === order.id ? 0.7 : 1,
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
              background: "rgba(59,130,246,0.16)",
              color: "#93c5fd",
              border: "1px solid rgba(59,130,246,0.22)",
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
              background: "rgba(239,68,68,0.14)",
              color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.2)",
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
              background: "rgba(14,165,233,0.16)",
              color: "#67e8f9",
              border: "1px solid rgba(14,165,233,0.22)",
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
            style={{
              ...actionButtonStyle,
              background: "rgba(255,255,255,0.08)",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
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
              background: "rgba(239,68,68,0.14)",
              color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.2)",
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
            style={{
              ...actionButtonStyle,
              background: "rgba(255,255,255,0.08)",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
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
                background: "rgba(245,158,11,0.16)",
                color: "#fcd34d",
                border: "1px solid rgba(245,158,11,0.22)",
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
                background: "rgba(34,197,94,0.16)",
                color: "#86efac",
                border: "1px solid rgba(34,197,94,0.22)",
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
          style={{
            ...actionButtonStyle,
            background: "rgba(255,255,255,0.08)",
            color: "#f8fafc",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          Generate Bill PDF
        </button>
      );
    }

    return null;
  };

  const renderReturnRowActions = (returnItem: AdminReturnListItem) => {
    const actionButtonStyle: React.CSSProperties = {
      border: "none",
      borderRadius: "10px",
      padding: "9px 12px",
      fontSize: "12px",
      fontWeight: 700,
      cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
      whiteSpace: "nowrap",
      opacity: actionLoadingId === returnItem.id ? 0.7 : 1,
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
            background: "rgba(59,130,246,0.16)",
            color: "#93c5fd",
            border: "1px solid rgba(59,130,246,0.22)",
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
            background: "rgba(245,158,11,0.16)",
            color: "#fcd34d",
            border: "1px solid rgba(245,158,11,0.22)",
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
            background: "rgba(168,85,247,0.16)",
            color: "#d8b4fe",
            border: "1px solid rgba(168,85,247,0.22)",
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
            background: "rgba(34,197,94,0.16)",
            color: "#86efac",
            border: "1px solid rgba(34,197,94,0.22)",
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
            background: "rgba(148,163,184,0.16)",
            color: "#cbd5e1",
            border: "1px solid rgba(148,163,184,0.22)",
          }}
        >
          Close
        </button>
      );
    }

    return null;
  };

  return (
    <div style={{ color: "#f8fafc" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, marginBottom: "8px", fontSize: "30px" }}>Orders</h1>
          <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.64)" }}>
            Manage fulfilment, shipment, cancellations, returns, and exchanges.
          </div>
        </div>

        <div style={{ minWidth: "260px" }}>
          <div style={labelStyle}>Site</div>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            style={inputStyle}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id} style={{ color: "#0f172a" }}>
                {site.name || site.slug || site.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div
          style={{
            ...sectionCardStyle,
            padding: "14px 16px",
            marginBottom: "18px",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "10px",
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
                borderRadius: "999px",
                padding: "10px 14px",
                border: isActive
                  ? "1px solid rgba(59,130,246,0.3)"
                  : "1px solid rgba(255,255,255,0.08)",
                background: isActive ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.04)",
                color: isActive ? "#93c5fd" : "#e2e8f0",
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

      {mode === "orders" ? (
        <>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "18px",
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
                    borderRadius: "999px",
                    padding: "10px 14px",
                    border: isActive
                      ? "1px solid rgba(59,130,246,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: isActive ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.04)",
                    color: isActive ? "#93c5fd" : "#e2e8f0",
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

          <div style={{ ...sectionCardStyle, overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              {tabs.find((tab) => tab.key === activeTab)?.label}
            </div>

            {loading ? (
              <div
                style={{
                  padding: "22px 16px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.58)",
                }}
              >
                Loading orders...
              </div>
            ) : !filteredOrders.length ? (
              <div
                style={{
                  padding: "22px 16px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.58)",
                }}
              >
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
                    <div
                      key={order.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        onClick={() => handleExpandToggle(order.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1.2fr) minmax(0, 1fr) auto auto auto",
                          gap: "14px",
                          alignItems: "center",
                          padding: "16px",
                          cursor: "pointer",
                          background: isExpanded ? "rgba(59,130,246,0.06)" : "transparent",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px" }}>
                            {order.id}
                          </div>
                          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                            {order.customer_name || "—"}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.62)",
                              marginBottom: "4px",
                            }}
                          >
                            {formatDate(order.created_at)}
                          </div>
                          <div style={{ fontSize: "13px", color: "#f8fafc", fontWeight: 700 }}>
                            {formatPrice(order.total)}
                          </div>
                        </div>

                        <div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "8px 10px",
                              borderRadius: "999px",
                              background: tone.bg,
                              color: tone.text,
                              border: tone.border,
                              fontSize: "12px",
                              fontWeight: 800,
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

                        <div
                          style={{
                            fontSize: "18px",
                            color: "rgba(255,255,255,0.56)",
                            justifySelf: "end",
                          }}
                        >
                          {isExpanded ? "−" : "+"}
                        </div>
                      </div>

                      {isExpanded ? (
                        <div
                          style={{
                            padding: "0 16px 16px",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
                              gap: "16px",
                              alignItems: "start",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                  Order Items
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                  {items.map((item) => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: "12px",
                                        padding: "12px",
                                        borderRadius: "14px",
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontSize: "14px", fontWeight: 700 }}>
                                          {item.product_name}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: "13px",
                                            color: "rgba(255,255,255,0.62)",
                                            marginTop: "4px",
                                          }}
                                        >
                                          Qty {item.quantity}
                                          {item.selected_variant_value
                                            ? ` · ${item.selected_variant_value}`
                                            : ""}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            color: "rgba(255,255,255,0.48)",
                                            marginTop: "4px",
                                          }}
                                        >
                                          Item status: {item.status.replaceAll("_", " ")}
                                        </div>
                                      </div>

                                      <div style={{ fontSize: "14px", fontWeight: 800 }}>
                                        {formatPrice(item.line_total)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                  Shipping Address
                                </div>

                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>
                                  {shippingAddress?.fullName || "—"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "14px",
                                    color: "rgba(255,255,255,0.7)",
                                    lineHeight: 1.7,
                                  }}
                                >
                                  {shippingAddress?.addressLine1 || "—"}
                                  <br />
                                  {(shippingAddress?.city || "—")} -{" "}
                                  {(shippingAddress?.postalCode || "—")}
                                  <br />
                                  {shippingAddress?.mobileNumber || "—"}
                                  {shippingAddress?.email ? ` · ${shippingAddress.email}` : ""}
                                </div>
                              </div>

                              {detail?.cancel_reason ? (
                                <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "10px" }}>
                                    Cancel Reason
                                  </div>
                                  <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.72)" }}>
                                    {detail.cancel_reason}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                  Customer
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>
                                  {detail?.customer_name || order.customer_name || "—"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    color: "rgba(255,255,255,0.68)",
                                    lineHeight: 1.8,
                                  }}
                                >
                                  {detail?.customer_phone || order.customer_phone || "—"}
                                  <br />
                                  {detail?.customer_email || order.customer_email || "—"}
                                  <br />
                                  Payment: {order.payment_method.toUpperCase()}
                                </div>
                              </div>

                              <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                  Shipment Control
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                                      border: "1px solid rgba(255,255,255,0.08)",
                                      background: "rgba(255,255,255,0.06)",
                                      color: "#f8fafc",
                                      borderRadius: "12px",
                                      padding: "11px 14px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Save Shipment Details
                                  </button>
                                </div>
                              </div>

                              <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                  Timeline
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                    Placed: {formatDate(order.created_at)}
                                  </div>
                                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                    Confirmed: {formatDate(detail?.confirmed_at || order.confirmed_at)}
                                  </div>
                                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                    Shipped: {formatDate(detail?.shipped_at || order.shipped_at)}
                                  </div>
                                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                    Out for delivery: {formatDate(detail?.shipment?.out_for_delivery_at)}
                                  </div>
                                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                    Delivered: {formatDate(detail?.delivered_at || order.delivered_at)}
                                  </div>
                                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                    Cancelled: {formatDate(detail?.cancelled_at || order.cancelled_at)}
                                  </div>
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
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "18px",
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
                    borderRadius: "999px",
                    padding: "10px 14px",
                    border: isActive
                      ? "1px solid rgba(59,130,246,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: isActive ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.04)",
                    color: isActive ? "#93c5fd" : "#e2e8f0",
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

          <div style={{ ...sectionCardStyle, overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              {returnTabs.find((tab) => tab.key === activeReturnTab)?.label}
            </div>

            {loading ? (
              <div
                style={{
                  padding: "22px 16px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.58)",
                }}
              >
                Loading returns...
              </div>
            ) : !filteredReturns.length ? (
              <div
                style={{
                  padding: "22px 16px",
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.58)",
                }}
              >
                No return requests in this tab.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredReturns.map((returnItem) => {
                  const isExpanded = expandedReturnId === returnItem.id;
                  const tone = getStatusTone(returnItem.status);
                  const detail = getExpandedReturn(returnItem);

                  const reviewDraft = reviewDrafts[returnItem.id];
                  const receiveDraft = receiveDrafts[returnItem.id];
                  const inspectDraft = inspectDrafts[returnItem.id];
                  const refundDraft = refundDrafts[returnItem.id];

                  return (
                    <div
                      key={returnItem.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        onClick={() => handleReturnExpandToggle(returnItem.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1.2fr) minmax(0, 1fr) auto auto auto",
                          gap: "14px",
                          alignItems: "center",
                          padding: "16px",
                          cursor: "pointer",
                          background: isExpanded ? "rgba(59,130,246,0.06)" : "transparent",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px" }}>
                            {returnItem.id}
                          </div>
                          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                            Order: {returnItem.order_id}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "rgba(255,255,255,0.62)",
                              marginBottom: "4px",
                            }}
                          >
                            {formatDate(returnItem.created_at)}
                          </div>
                          <div style={{ fontSize: "13px", color: "#f8fafc", fontWeight: 700 }}>
                            Refund: {formatPrice(returnItem.final_refund_amount)}
                          </div>
                        </div>

                        <div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "8px 10px",
                              borderRadius: "999px",
                              background: tone.bg,
                              color: tone.text,
                              border: tone.border,
                              fontSize: "12px",
                              fontWeight: 800,
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

                        <div
                          style={{
                            fontSize: "18px",
                            color: "rgba(255,255,255,0.56)",
                            justifySelf: "end",
                          }}
                        >
                          {isExpanded ? "−" : "+"}
                        </div>
                      </div>

                      {isExpanded ? (
                        <div
                          style={{
                            padding: "0 16px 16px",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          {!detail ? (
                            <div style={{ paddingTop: "12px", fontSize: "13px", color: "rgba(255,255,255,0.62)" }}>
                              Loading return details...
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
                                gap: "16px",
                                alignItems: "start",
                                paddingTop: "16px",
                              }}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                    Return Items
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {detail.items.map((item) => (
                                      <div
                                        key={item.id}
                                        style={{
                                          padding: "12px",
                                          borderRadius: "14px",
                                          background: "rgba(255,255,255,0.03)",
                                          border: "1px solid rgba(255,255,255,0.06)",
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: "12px",
                                          }}
                                        >
                                          <div>
                                            <div style={{ fontSize: "14px", fontWeight: 700 }}>
                                              {item.product_name}
                                            </div>
                                            <div
                                              style={{
                                                fontSize: "13px",
                                                color: "rgba(255,255,255,0.62)",
                                                marginTop: "4px",
                                              }}
                                            >
                                              Requested: {item.quantity_requested} · Approved:{" "}
                                              {item.quantity_approved} · Received: {item.quantity_received}
                                            </div>
                                            <div
                                              style={{
                                                fontSize: "12px",
                                                color: "rgba(255,255,255,0.48)",
                                                marginTop: "4px",
                                              }}
                                            >
                                              Reason: {getStatusLabel(item.reason_code)}
                                              {item.reason_note ? ` · ${item.reason_note}` : ""}
                                            </div>
                                            <div
                                              style={{
                                                fontSize: "12px",
                                                color: "rgba(255,255,255,0.48)",
                                                marginTop: "4px",
                                              }}
                                            >
                                              Restock: {item.restock_decision || "—"} · Qty:{" "}
                                              {item.restocked_quantity}
                                            </div>
                                          </div>

                                          <div style={{ fontSize: "14px", fontWeight: 800 }}>
                                            {formatPrice(item.line_refund_final)}
                                          </div>
                                        </div>

                                        {detail.status === "requested" && reviewDraft ? (
                                          <div
                                            style={{
                                              marginTop: "12px",
                                              display: "grid",
                                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                              gap: "10px",
                                            }}
                                          >
                                            <div>
                                              <div style={labelStyle}>Approved Quantity</div>
                                              <input
                                                type="number"
                                                min={0}
                                                max={item.quantity_requested}
                                                value={reviewDraft.approvedQuantities[item.id] ?? 0}
                                                onChange={(e) =>
                                                  setReviewDraftValue(returnItem.id, (draft) => ({
                                                    ...draft,
                                                    approvedQuantities: {
                                                      ...draft.approvedQuantities,
                                                      [item.id]: Number(e.target.value || 0),
                                                    },
                                                  }))
                                                }
                                                style={inputStyle}
                                              />
                                            </div>
                                          </div>
                                        ) : null}

                                        {detail.status === "approved" && receiveDraft ? (
                                          <div
                                            style={{
                                              marginTop: "12px",
                                              display: "grid",
                                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                              gap: "10px",
                                            }}
                                          >
                                            <div>
                                              <div style={labelStyle}>Received Quantity</div>
                                              <input
                                                type="number"
                                                min={0}
                                                max={item.quantity_approved}
                                                value={receiveDraft.receivedQuantities[item.id] ?? 0}
                                                onChange={(e) =>
                                                  setReceiveDraftValue(returnItem.id, (draft) => ({
                                                    ...draft,
                                                    receivedQuantities: {
                                                      ...draft.receivedQuantities,
                                                      [item.id]: Number(e.target.value || 0),
                                                    },
                                                  }))
                                                }
                                                style={inputStyle}
                                              />
                                            </div>
                                          </div>
                                        ) : null}

                                        {detail.status === "received" && inspectDraft ? (
                                          <div
                                            style={{
                                              marginTop: "12px",
                                              display: "grid",
                                              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                              gap: "10px",
                                            }}
                                          >
                                            <div>
                                              <div style={labelStyle}>Restock Decision</div>
                                              <select
                                                value={inspectDraft.restockDecisionByItem[item.id] || "discard"}
                                                onChange={(e) =>
                                                  setInspectDraftValue(returnItem.id, (draft) => ({
                                                    ...draft,
                                                    restockDecisionByItem: {
                                                      ...draft.restockDecisionByItem,
                                                      [item.id]: e.target.value as
                                                        | "restock"
                                                        | "quarantine"
                                                        | "discard",
                                                    },
                                                  }))
                                                }
                                                style={inputStyle}
                                              >
                                                <option value="restock" style={{ color: "#0f172a" }}>
                                                  Restock
                                                </option>
                                                <option value="quarantine" style={{ color: "#0f172a" }}>
                                                  Quarantine
                                                </option>
                                                <option value="discard" style={{ color: "#0f172a" }}>
                                                  Discard
                                                </option>
                                              </select>
                                            </div>

                                            <div>
                                              <div style={labelStyle}>Restock Quantity</div>
                                              <input
                                                type="number"
                                                min={0}
                                                max={item.quantity_received}
                                                value={inspectDraft.restockQuantityByItem[item.id] ?? 0}
                                                onChange={(e) =>
                                                  setInspectDraftValue(returnItem.id, (draft) => ({
                                                    ...draft,
                                                    restockQuantityByItem: {
                                                      ...draft.restockQuantityByItem,
                                                      [item.id]: Number(e.target.value || 0),
                                                    },
                                                  }))
                                                }
                                                style={inputStyle}
                                              />
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                    Customer Order
                                  </div>
                                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)", lineHeight: 1.8 }}>
                                    Order ID: {detail.order.id}
                                    <br />
                                    Order Status: {getStatusLabel(detail.order.status)}
                                    <br />
                                    Payment: {detail.order.payment_method.toUpperCase()}
                                    <br />
                                    Order Total: {formatPrice(detail.order.total)}
                                    <br />
                                    Delivered At: {formatDate(detail.order.delivered_at)}
                                  </div>
                                </div>

                                <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                    Shipping Address
                                  </div>
                                  <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}>
                                    {detail.order.shipping_address?.fullName || "—"}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "14px",
                                      color: "rgba(255,255,255,0.7)",
                                      lineHeight: 1.7,
                                    }}
                                  >
                                    {detail.order.shipping_address?.addressLine1 || "—"}
                                    <br />
                                    {(detail.order.shipping_address?.city || "—")} -{" "}
                                    {(detail.order.shipping_address?.postalCode || "—")}
                                    <br />
                                    {detail.order.shipping_address?.mobileNumber || "—"}
                                    {detail.order.shipping_address?.email
                                      ? ` · ${detail.order.shipping_address.email}`
                                      : ""}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                    Return Summary
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Status: {getStatusLabel(detail.status)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Refund status: {getStatusLabel(detail.refund_status)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Suggested refund: {formatPrice(detail.suggested_refund_amount)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Final refund: {formatPrice(detail.final_refund_amount)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Refund method: {detail.refund_method || "—"}
                                    </div>
                                  </div>
                                </div>

                                {detail.status === "requested" && reviewDraft ? (
                                  <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                      Review Action
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                      <div>
                                        <div style={labelStyle}>Action</div>
                                        <select
                                          value={reviewDraft.action}
                                          onChange={(e) =>
                                            setReviewDraftValue(returnItem.id, (draft) => ({
                                              ...draft,
                                              action: e.target.value as "approve" | "reject",
                                            }))
                                          }
                                          style={inputStyle}
                                        >
                                          <option value="approve" style={{ color: "#0f172a" }}>
                                            Approve
                                          </option>
                                          <option value="reject" style={{ color: "#0f172a" }}>
                                            Reject
                                          </option>
                                        </select>
                                      </div>

                                      <div>
                                        <div style={labelStyle}>Admin Note</div>
                                        <textarea
                                          value={reviewDraft.adminNote}
                                          onChange={(e) =>
                                            setReviewDraftValue(returnItem.id, (draft) => ({
                                              ...draft,
                                              adminNote: e.target.value,
                                            }))
                                          }
                                          rows={3}
                                          style={inputStyle}
                                        />
                                      </div>

                                      {reviewDraft.action === "reject" ? (
                                        <div>
                                          <div style={labelStyle}>Rejection Reason</div>
                                          <textarea
                                            value={reviewDraft.rejectionReason}
                                            onChange={(e) =>
                                              setReviewDraftValue(returnItem.id, (draft) => ({
                                                ...draft,
                                                rejectionReason: e.target.value,
                                              }))
                                            }
                                            rows={3}
                                            style={inputStyle}
                                          />
                                        </div>
                                      ) : null}

                                      <button
                                        disabled={actionLoadingId === returnItem.id}
                                        onClick={() => handleReviewReturn(returnItem.id)}
                                        style={{
                                          border: "1px solid rgba(59,130,246,0.24)",
                                          background: "rgba(59,130,246,0.16)",
                                          color: "#93c5fd",
                                          borderRadius: "12px",
                                          padding: "11px 14px",
                                          fontSize: "14px",
                                          fontWeight: 700,
                                          cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                        }}
                                      >
                                        Submit Review
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {detail.status === "approved" && receiveDraft ? (
                                  <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                      Receive Action
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                      <div>
                                        <div style={labelStyle}>Admin Note</div>
                                        <textarea
                                          value={receiveDraft.adminNote}
                                          onChange={(e) =>
                                            setReceiveDraftValue(returnItem.id, (draft) => ({
                                              ...draft,
                                              adminNote: e.target.value,
                                            }))
                                          }
                                          rows={3}
                                          style={inputStyle}
                                        />
                                      </div>

                                      <button
                                        disabled={actionLoadingId === returnItem.id}
                                        onClick={() => handleReceiveReturn(returnItem.id)}
                                        style={{
                                          border: "1px solid rgba(245,158,11,0.24)",
                                          background: "rgba(245,158,11,0.16)",
                                          color: "#fcd34d",
                                          borderRadius: "12px",
                                          padding: "11px 14px",
                                          fontSize: "14px",
                                          fontWeight: 700,
                                          cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                        }}
                                      >
                                        Mark Received
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {detail.status === "received" && inspectDraft ? (
                                  <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                      Inspection Action
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                      <div>
                                        <div style={labelStyle}>Admin Note</div>
                                        <textarea
                                          value={inspectDraft.adminNote}
                                          onChange={(e) =>
                                            setInspectDraftValue(returnItem.id, (draft) => ({
                                              ...draft,
                                              adminNote: e.target.value,
                                            }))
                                          }
                                          rows={3}
                                          style={inputStyle}
                                        />
                                      </div>

                                      <button
                                        disabled={actionLoadingId === returnItem.id}
                                        onClick={() => handleInspectReturn(returnItem.id)}
                                        style={{
                                          border: "1px solid rgba(168,85,247,0.24)",
                                          background: "rgba(168,85,247,0.16)",
                                          color: "#d8b4fe",
                                          borderRadius: "12px",
                                          padding: "11px 14px",
                                          fontSize: "14px",
                                          fontWeight: 700,
                                          cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                        }}
                                      >
                                        Complete Inspection
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {detail.status === "inspected" && refundDraft ? (
                                  <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                      Refund Action
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                      <div>
                                        <div style={labelStyle}>Refund Method</div>
                                        <input
                                          value={refundDraft.refundMethod}
                                          onChange={(e) =>
                                            setRefundDraftValue(returnItem.id, (draft) => ({
                                              ...draft,
                                              refundMethod: e.target.value,
                                            }))
                                          }
                                          placeholder="e.g. cod_refund"
                                          style={inputStyle}
                                        />
                                      </div>

                                      <div>
                                        <div style={labelStyle}>Final Refund Amount</div>
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
                                          placeholder={String(detail.suggested_refund_amount)}
                                          style={inputStyle}
                                        />
                                      </div>

                                      <div>
                                        <div style={labelStyle}>Refund Override Reason</div>
                                        <textarea
                                          value={refundDraft.refundOverrideReason}
                                          onChange={(e) =>
                                            setRefundDraftValue(returnItem.id, (draft) => ({
                                              ...draft,
                                              refundOverrideReason: e.target.value,
                                            }))
                                          }
                                          rows={3}
                                          style={inputStyle}
                                        />
                                      </div>

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
                                          rows={3}
                                          style={inputStyle}
                                        />
                                      </div>

                                      <button
                                        disabled={actionLoadingId === returnItem.id}
                                        onClick={() => handleRefundReturn(returnItem.id)}
                                        style={{
                                          border: "1px solid rgba(34,197,94,0.24)",
                                          background: "rgba(34,197,94,0.16)",
                                          color: "#86efac",
                                          borderRadius: "12px",
                                          padding: "11px 14px",
                                          fontSize: "14px",
                                          fontWeight: 700,
                                          cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                        }}
                                      >
                                        Process Refund
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {(detail.status === "rejected" || detail.status === "refunded") && (
                                  <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                      Final Action
                                    </div>
                                    <button
                                      disabled={actionLoadingId === returnItem.id}
                                      onClick={() => handleCloseReturn(returnItem.id)}
                                      style={{
                                        border: "1px solid rgba(148,163,184,0.24)",
                                        background: "rgba(148,163,184,0.16)",
                                        color: "#cbd5e1",
                                        borderRadius: "12px",
                                        padding: "11px 14px",
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                      }}
                                    >
                                      Close Return
                                    </button>
                                  </div>
                                )}

                                <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                    Timeline
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Requested: {formatDate(detail.created_at)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Approved: {formatDate(detail.approved_at)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Rejected: {formatDate(detail.rejected_at)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Received: {formatDate(detail.received_at)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Inspected: {formatDate(detail.inspected_at)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Refunded: {formatDate(detail.refunded_at)}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.68)" }}>
                                      Closed: {formatDate(detail.closed_at)}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ ...sectionCardStyle, padding: "16px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "14px" }}>
                                    Status History
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {detail.status_history?.length ? (
                                      detail.status_history.map((entry) => (
                                        <div
                                          key={entry.id}
                                          style={{
                                            padding: "10px 12px",
                                            borderRadius: "12px",
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                          }}
                                        >
                                          <div style={{ fontSize: "13px", fontWeight: 700 }}>
                                            {getStatusLabel(entry.status)}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: "12px",
                                              color: "rgba(255,255,255,0.58)",
                                              marginTop: "4px",
                                            }}
                                          >
                                            {formatDate(entry.changed_at)} · {entry.changed_by_type || "system"}
                                          </div>
                                          {entry.note ? (
                                            <div
                                              style={{
                                                fontSize: "12px",
                                                color: "rgba(255,255,255,0.72)",
                                                marginTop: "6px",
                                              }}
                                            >
                                              {entry.note}
                                            </div>
                                          ) : null}
                                        </div>
                                      ))
                                    ) : (
                                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.58)" }}>
                                        No status history found.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
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