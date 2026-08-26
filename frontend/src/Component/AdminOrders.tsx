import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { API_BASE_URL as API_BASE } from "../config/api";
import { Pagination } from "./Pagination";
import GlassToast from "./GlassToast";

type AdminMode = "orders" | "returns";

type OrderStatus =
  | "placed"
  | "confirmed"
  | "accepted"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "rescheduled"
  | "failed"
  | "partially_cancelled"
  | "cancelled"
  | "returned";

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
  weight_grams?: number;
};

type Shipment = {
  id: string;
  status: string;
  mode?: string | null;
  delivery_mode?: string | null;
  courier_name?: string | null;
  awb_number?: string | null;
  tracking_url?: string | null;
  label_url?: string | null;
  delivery_partner_name?: string | null;
  delivery_partner_phone?: string | null;
  estimated_delivery_at?: string | null;
  shipped_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
  notes?: string | null;
  agent_id?: string | null;
  agent_token?: string | null;
  agent_accepted_at?: string | null;
  pickup_pincode?: string | null;
  delivery_pincode?: string | null;
  delivery_otp?: string | null;
  [key: string]: any;
};

export type ShippingAddress = {
  fullName?: string;
  full_name?: string;
  addressLine1?: string;
  address_line1?: string;
  city?: string;
  postalCode?: string;
  postal_code?: string;
  mobileNumber?: string;
  mobile_number?: string;
  email?: string;
  addressType?: string;
  address_type?: string;
  latitude?: number | null;
  longitude?: number | null;
  geoAccuracy?: string | null;
  geo_accuracy?: string | null;
  [key: string]: any;
};

type AdminOrderListItem = {
  id: string;
  customer_id: string;
  status: OrderStatus;
  payment_status?: string | null;
  total: number;
  total_weight_grams?: number;
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
  shipping_address?: ShippingAddress | null;
  shipment?: Shipment | null;
  items?: OrderItem[];
  item_count?: number;
  pricing_snapshot?: any;
  delivery_otp?: string | null;
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
  total_weight_grams?: number;
  payment_method: string;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  shipping_address?: ShippingAddress | null;
  pricing_snapshot?: any;
  delivery_otp?: string | null;
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
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: ShippingAddress | null;
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
  pickup_status?: string | null;
  pickup_details?: {
    mode?: string;
    agent_id?: string;
    agent_name?: string;
    agent_phone?: string;
    courier_name?: string;
    tracking_number?: string;
    pickup_status?: string;
    pickup_notes?: string;
    weight_grams?: number;
    assigned_at?: string;
    inspection_result?: string;
    inspection_failed_reason?: string;
    inspection_notes?: string;
    doorstep_rejected_at?: string;
    [key: string]: any;
  } | null;
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
  pickup_status?: string | null;
  pickup_details?: {
    mode?: string;
    agent_id?: string;
    agent_name?: string;
    agent_phone?: string;
    courier_name?: string;
    tracking_number?: string;
    pickup_status?: string;
    pickup_notes?: string;
    weight_grams?: number;
    assigned_at?: string;
    inspection_result?: string;
    inspection_failed_reason?: string;
    inspection_notes?: string;
    doorstep_rejected_at?: string;
    [key: string]: any;
  } | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  received_at?: string | null;
  inspected_at?: string | null;
  refunded_at?: string | null;
  refund_breakdown?: {
    items_subtotal: number;
    discounts_prorated: number;
    tax_refund: number;
    refundable_charges_added: number;
    non_refundable_charges_retained: number;
    suggested_refund_amount: number;
    max_refundable_amount: number;
    actual_refund_amount?: number;
    exception_refund_added?: number;
    charge_allocations: Array<{
      id: string;
      code: string;
      label: string;
      refundable: boolean;
      total_order_amount: number;
      allocated_amount: number;
    }>;
  };
  created_at: string;
  updated_at?: string | null;
  order: {
    id: string;
    status: string;
    payment_method: string;
    payment_status?: string | null;
    razorpay_payment_id?: string | null;
    razorpay_order_id?: string | null;
    total: number;
    created_at?: string | null;
    delivered_at?: string | null;
    shipping_address?: ShippingAddress | null;
    pricing_snapshot?: any;
    [key: string]: any;
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
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
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


const PhoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

function formatPhoneDisplay(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const clean = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : (digits.length >= 10 ? digits.slice(-10) : digits);
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone ? `+91 ${phone}` : "";
}

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

function cleanShipmentNotes(notes?: string | null): string {
  if (!notes) return "";
  const matches = notes.match(/\[(.*?)\]/g);
  if (matches && matches.length > 0) {
    const unique = Array.from(new Set(matches.map((m) => m.trim())));
    return unique.join(" ");
  }
  return notes;
}


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
  if (!method) return "Online";
  const m = method.toLowerCase();
  if (m === "upi") return "UPI";
  if (m === "card") return "Card";
  if (m === "netbanking") return "Netbanking";
  if (m === "cod" || m === "cash_on_delivery") return "COD";
  if (m === "wallet") return "Wallet";
  if (m === "razorpay") return "Online";
  return method.replaceAll("_", " ");
};

const CreditCardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

const BoltIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const BankIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z" />
  </svg>
);

const CashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const getPaymentMethodIcon = (method?: string | null): React.ReactNode => {
  if (!method) return <CreditCardIcon />;
  const m = method.toLowerCase();
  if (m === "upi") return <BoltIcon />;
  if (m === "card") return <CreditCardIcon />;
  if (m === "netbanking") return <BankIcon />;
  if (m === "cod" || m === "cash_on_delivery") return <CashIcon />;
  return <CreditCardIcon />;
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
    case "rescheduled":
      return { bg: "#fffbeb", text: "#b45309", border: "1px solid #fde68a" };
    case "failed":
      return { bg: "#fef2f2", text: "#b91c1c", border: "1px solid #fecaca" };
    case "delivered":
      return { bg: "#f0fdf4", text: "#15803d", border: "1px solid #bbf7d0" };
    case "returned":
      return { bg: "#f5f3ff", text: "#7c3aed", border: "1px solid #ddd6fe" };
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
      return (
        order.status === "shipped" ||
        order.status === "out_for_delivery" ||
        order.status === "rescheduled" ||
        order.status === "failed"
      );
    case "delivered":
      return order.status === "delivered" || order.status === "returned";
    case "cancelled":
      return order.status === "cancelled" || order.status === "partially_cancelled";
    default:
      return false;
  }
};


type DeliveryAgentItem = {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  current_order_count: number;
};

type DeliverySettingsSummary = {
  delivery_mode: string;
  enable_fleet?: boolean;
  enable_shiprocket?: boolean;
  enable_manual?: boolean;
  shiprocket_connected: boolean;
  shiprocket_enabled?: boolean;
  allow_own_delivery_agents?: boolean;
  allow_manual_courier?: boolean;
  default_weight_grams?: number;
  free_delivery_above?: number;
  express_delivery_fee?: number;
};

const matchesReturnTab = (item: AdminReturnListItem, tab: ReturnTabKey) => item.status === tab;

const getCachedOrders = (id?: string): AdminOrderListItem[] => {
  if (!id || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`wc_admin_orders_${id}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getCachedReturns = (id?: string): AdminReturnListItem[] => {
  if (!id || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`wc_admin_returns_${id}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const AdminOrders: React.FC = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AdminMode>("orders");

  const initialOrders = getCachedOrders(siteId);
  const initialReturns = getCachedReturns(siteId);
  const [orders, setOrders] = useState<AdminOrderListItem[]>(initialOrders);
  const [detailsMap, setDetailsMap] = useState<Record<string, AdminOrderDetail>>({});
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, ShipmentDraft>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("new");

  // Delivery integration state
  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgentItem[]>([]);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettingsSummary | null>(null);
  const [selectedAgentMap, setSelectedAgentMap] = useState<Record<string, string>>({});
  const [selectedDispatchModeMap, setSelectedDispatchModeMap] = useState<Record<string, "own_agent" | "shiprocket" | "manual">>({});
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});
  const [reassigningOrderIdMap, setReassigningOrderIdMap] = useState<Record<string, boolean>>({});
  const [reassignAgentIdMap, setReassignAgentIdMap] = useState<Record<string, string>>({});
  const [packageWeightMap, setPackageWeightMap] = useState<Record<string, number>>({});
  const [editingCourierOrderIdMap, setEditingCourierOrderIdMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  const getOrderDefaultWeight = (orderItem?: AdminOrderListItem | AdminOrderDetail | null): number => {
    if (!orderItem) return deliverySettings?.default_weight_grams || 500;
    if (typeof orderItem.total_weight_grams === "number" && orderItem.total_weight_grams > 0) {
      return orderItem.total_weight_grams;
    }
    if (Array.isArray(orderItem.items) && orderItem.items.length > 0) {
      const sum = orderItem.items.reduce(
        (acc, it) =>
          acc +
          ((it.weight_grams && it.weight_grams > 0
            ? it.weight_grams
            : deliverySettings?.default_weight_grams || 500) *
            (it.quantity || 1)),
        0
      );
      if (sum > 0) return sum;
    }
    return deliverySettings?.default_weight_grams || 500;
  };

  // Return Reverse Logistics state
  const [selectedReturnAgentMap, setSelectedReturnAgentMap] = useState<Record<string, string>>({});
  const [selectedReturnDispatchModeMap, setSelectedReturnDispatchModeMap] = useState<Record<string, "own_agent" | "shiprocket" | "manual">>({});
  const [returnPackageWeightMap, setReturnPackageWeightMap] = useState<Record<string, number>>({});
  const [returnManualCourierMap, setReturnManualCourierMap] = useState<Record<string, { courierName: string; trackingNumber: string; notes: string }>>({});
  const [editingReturnCourierMap, setEditingReturnCourierMap] = useState<Record<string, boolean>>({});
  const [reassigningReturnIdMap, setReassigningReturnIdMap] = useState<Record<string, boolean>>({});
  const [reassignReturnAgentIdMap, setReassignReturnAgentIdMap] = useState<Record<string, string>>({});

  const [adminReturns, setAdminReturns] = useState<AdminReturnListItem[]>(initialReturns);
  const [returnDetailsMap, setReturnDetailsMap] = useState<Record<string, AdminReturnDetail>>({});
  const [expandedReturnId, setExpandedReturnId] = useState<string | null>(null);
  const [activeReturnTab, setActiveReturnTab] = useState<ReturnTabKey>("requested");


  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [receiveDrafts, setReceiveDrafts] = useState<Record<string, ReceiveDraft>>({});
  const [inspectDrafts, setInspectDrafts] = useState<Record<string, InspectDraft>>({});
  const [refundDrafts, setRefundDrafts] = useState<Record<string, RefundDraft>>({});

  // Filter & Search states (persists across tabs)
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "last_7_days" | "last_30_days" | "custom">("last_30_days");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [serverTotalOrders, setServerTotalOrders] = useState<number>(initialOrders.length);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);
  const [serverTabCounts, setServerTabCounts] = useState<Record<string, number>>({});

  const [serverTotalReturns, setServerTotalReturns] = useState<number>(initialReturns.length);
  const [serverTotalReturnPages, setServerTotalReturnPages] = useState<number>(1);
  const [serverReturnTabCounts, setServerReturnTabCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState<boolean>(initialOrders.length === 0);
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

    if (detail.pickup_details) {
      setReturnManualCourierMap((prev) => ({
        ...prev,
        [returnId]: {
          courierName: detail.pickup_details?.courier_name || "",
          trackingNumber: detail.pickup_details?.tracking_number || "",
          notes: detail.pickup_details?.pickup_notes || "",
        },
      }));
    }
  };

  const [selectedExtraChargesByReturn, setSelectedExtraChargesByReturn] = useState<Record<string, Record<string, boolean>>>({});

  const toggleExtraCharge = (
    returnId: string,
    chargeId: string,
    baseSuggested: number,
    allAllocations: Array<{ id: string; label: string; allocated_amount: number; refundable: boolean }>
  ) => {
    const currentChecked = selectedExtraChargesByReturn[returnId] || {};
    const willBeChecked = !currentChecked[chargeId];
    const nextChecked = { ...currentChecked, [chargeId]: willBeChecked };
    setSelectedExtraChargesByReturn((prev) => ({ ...prev, [returnId]: nextChecked }));

    let addedAmount = 0;
    const includedLabels: string[] = [];
    allAllocations.forEach((ch) => {
      if (nextChecked[ch.id]) {
        addedAmount += Number(ch.allocated_amount || 0);
        includedLabels.push(ch.label);
      }
    });

    const newTotal = Number((baseSuggested + addedAmount).toFixed(2));
    setRefundDraftValue(returnId, (draft) => ({
      ...draft,
      finalRefundAmount: String(newTotal),
      refundOverrideReason:
        includedLabels.length > 0
          ? `Exception: Refunded non-refundable charge(s) (${includedLabels.join(", ")}) upon admin review.`
          : "",
    }));
  };

  const loadOrdersForSite = async (
    page = currentPage,
    size = pageSize,
    tab = activeTab,
    search = searchQuery,
    payment = paymentFilter,
    date = dateFilter,
    fromD = customFromDate,
    toD = customToDate
  ) => {
    if (!siteId) return;
    try {
      const qParams = new URLSearchParams();
      qParams.set("page", String(page));
      qParams.set("page_size", String(size));
      if (tab) qParams.set("tab", tab);
      if (search.trim()) qParams.set("search", search.trim());
      if (payment !== "all") qParams.set("payment_method", payment);
      if (date !== "all") qParams.set("date_filter", date);
      if (fromD) qParams.set("from_date", fromD);
      if (toD) qParams.set("to_date", toD);

      const res = await fetchJson(`${API_BASE}/orders/admin/${siteId}?${qParams.toString()}`);
      if (res && Array.isArray(res.orders)) {
        setOrders(res.orders);
        setServerTotalOrders(res.total ?? res.orders.length);
        setServerTotalPages(res.total_pages ?? 1);
        if (res.tab_counts) setServerTabCounts(res.tab_counts);
        if (page === 1) {
          try {
            localStorage.setItem(`wc_admin_orders_${siteId}`, JSON.stringify(res.orders));
          } catch (_) {}
        }
      } else if (Array.isArray(res)) {
        setOrders(res);
        setServerTotalOrders(res.length);
        setServerTotalPages(Math.max(1, Math.ceil(res.length / size)));
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    }
    setDetailsMap({});
    setExpandedOrderId(null);
  };

  const loadReturnsForSite = async (
    page = currentPage,
    size = pageSize,
    tab = activeReturnTab,
    search = searchQuery
  ) => {
    if (!siteId) return;
    try {
      const qParams = new URLSearchParams();
      qParams.set("page", String(page));
      qParams.set("page_size", String(size));
      if (tab) qParams.set("status", tab);
      if (search.trim()) qParams.set("search", search.trim());

      const res = await fetchJson(`${API_BASE}/returns/admin/${siteId}?${qParams.toString()}`);
      if (res && Array.isArray(res.returns)) {
        setAdminReturns(res.returns);
        setServerTotalReturns(res.total ?? res.returns.length);
        setServerTotalReturnPages(res.total_pages ?? 1);
        if (res.tab_counts) setServerReturnTabCounts(res.tab_counts);
        if (page === 1) {
          try {
            localStorage.setItem(`wc_admin_returns_${siteId}`, JSON.stringify(res.returns));
          } catch (_) {}
        }
      } else if (Array.isArray(res)) {
        setAdminReturns(res);
        setServerTotalReturns(res.length);
        setServerTotalReturnPages(Math.max(1, Math.ceil(res.length / size)));
      }
    } catch (err) {
      console.error("Failed to load returns", err);
    }
    setReturnDetailsMap({});
    setExpandedReturnId(null);
  };

  const loadDeliveryMeta = async () => {
    if (!siteId) return;
    try {
      const [agentsRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/delivery/agents/${siteId}`, { credentials: "include" }),
        fetch(`${API_BASE}/delivery/settings/${siteId}`, { credentials: "include" }),
      ]);
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setDeliveryAgents(Array.isArray(agentsData) ? agentsData : []);
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setDeliverySettings(settingsData);
      }
    } catch {
      // ignore
    }
  };

  const handleDispatchOrder = async (
    orderId: string,
    customMode?: "own_agent" | "shiprocket" | "manual",
    overrideWeight?: number
  ) => {
    if (!siteId) return;
    setActionLoadingId(orderId);
    try {
      const isFleet = deliverySettings?.enable_fleet !== undefined ? Boolean(deliverySettings.enable_fleet) : (deliverySettings?.delivery_mode === "own_agent" || deliverySettings?.delivery_mode === "hybrid");
      const isSr = deliverySettings?.enable_shiprocket !== undefined ? Boolean(deliverySettings.enable_shiprocket) : (deliverySettings?.delivery_mode === "shiprocket" || deliverySettings?.delivery_mode === "hybrid");
      const fallbackMode = isFleet ? "own_agent" : (isSr ? "shiprocket" : "manual");
      const chosenMode = customMode || selectedDispatchModeMap[orderId] || fallbackMode;
      const agentId = selectedAgentMap[orderId] || "";

      const orderObj = orders.find((o) => o.id === orderId) || detailsMap[orderId];
      const defaultWeight = orderObj ? getOrderDefaultWeight(orderObj) : (deliverySettings?.default_weight_grams || 500);
      const customWeight = overrideWeight !== undefined
        ? overrideWeight
        : packageWeightMap[orderId] !== undefined
        ? packageWeightMap[orderId]
        : defaultWeight;

      const body: Record<string, any> = {
        mode: chosenMode,
        weight_grams: customWeight,
      };
      if (chosenMode === "own_agent" && agentId) {
        body.agent_id = agentId;
      }
      const res = await fetch(`${API_BASE}/delivery/dispatch/${siteId}/${orderId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: "Dispatch failed" }));
        throw new Error(errJson.detail || "Dispatch failed");
      }
      const resData = await res.json().catch(() => ({}));
      showToast(resData.message || "Order dispatched successfully!", "success");
      await loadOrdersForSite();
      if (expandedOrderId === orderId) {
        await refreshOrderDetail(orderId);
      }
      await loadDeliveryMeta();
    } catch (e: any) {
      showToast(e.message || "Failed to dispatch order", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReassignRider = async (orderId: string) => {
    if (!siteId) return;
    const newAgentId = reassignAgentIdMap[orderId] || "";
    if (!newAgentId) {
      showToast("Please select a new delivery agent to reassign this order.", "error");
      return;
    }
    setActionLoadingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/delivery/dispatch/${siteId}/${orderId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "own_agent",
          agent_id: newAgentId,
          force_reassign: true,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: "Reassign failed" }));
        throw new Error(errJson.detail || "Reassign failed");
      }
      showToast("Delivery rider reassigned successfully!", "success");
      setReassigningOrderIdMap((p) => ({ ...p, [orderId]: false }));
      await loadOrdersForSite();
      if (expandedOrderId === orderId) {
        await refreshOrderDetail(orderId);
      }
      await loadDeliveryMeta();
    } catch (e: any) {
      showToast(e.message || "Failed to reassign delivery agent", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyRiderLink = (orderId: string, link: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLinkMap((prev) => ({ ...prev, [orderId]: true }));
    showToast("Rider tracking link copied to clipboard!", "success");
    setTimeout(() => {
      setCopiedLinkMap((prev) => ({ ...prev, [orderId]: false }));
    }, 2500);
  };

  const handleDispatchReturnPickup = async (returnId: string, customMode?: "own_agent" | "shiprocket" | "manual") => {
    if (!siteId) return;
    setActionLoadingId(returnId);
    try {
      const isFleet = deliverySettings?.enable_fleet !== undefined ? Boolean(deliverySettings.enable_fleet) : (deliverySettings?.delivery_mode === "own_agent" || deliverySettings?.delivery_mode === "hybrid");
      const isSr = deliverySettings?.enable_shiprocket !== undefined ? Boolean(deliverySettings.enable_shiprocket) : (deliverySettings?.delivery_mode === "shiprocket" || deliverySettings?.delivery_mode === "hybrid");
      const fallbackMode = isFleet ? "own_agent" : (isSr ? "shiprocket" : "manual");
      const chosenMode = customMode || selectedReturnDispatchModeMap[returnId] || fallbackMode;
      const agentId = selectedReturnAgentMap[returnId] || "";
      const customWeight = returnPackageWeightMap[returnId] || deliverySettings?.default_weight_grams || 500;
      const manualData = returnManualCourierMap[returnId] || { courierName: "", trackingNumber: "", notes: "" };

      const body: Record<string, any> = {
        mode: chosenMode,
        package_weight_grams: customWeight,
      };

      if (chosenMode === "own_agent") {
        if (!agentId) {
          const availableAgent = deliveryAgents.find((a) => a.is_active);
          if (availableAgent) {
            body.agent_id = availableAgent.id;
          } else {
            showToast("Please select an active delivery rider to assign this return pickup.", "error");
            setActionLoadingId(null);
            return;
          }
        } else {
          body.agent_id = agentId;
        }
      } else if (chosenMode === "shiprocket") {
        body.courier_name = "Shiprocket Reverse Logistics";
      } else if (chosenMode === "manual") {
        body.courier_name = manualData.courierName || "Manual Courier / Self Ship";
        body.tracking_number = manualData.trackingNumber || "";
        body.pickup_notes = manualData.notes || "";
      }

      const res = await fetch(`${API_BASE}/returns/admin/${siteId}/${returnId}/dispatch-pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to dispatch return pickup");
      }

      const data = await res.json();
      if (data.return_request) {
        setReturnDetailsMap((prev) => ({ ...prev, [returnId]: data.return_request }));
      }
      showToast(data.message || "Return pickup dispatched successfully!", "success");
      setEditingReturnCourierMap((p) => ({ ...p, [returnId]: false }));
      await loadReturnsForSite();
      await loadDeliveryMeta();
    } catch (err: any) {
      showToast(err?.message || "Failed to dispatch return pickup", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReassignReturnRider = async (returnId: string) => {
    if (!siteId) return;
    const newAgentId = reassignReturnAgentIdMap[returnId] || "";
    if (!newAgentId) {
      showToast("Please select a new rider to reassign this return pickup.", "error");
      return;
    }
    setActionLoadingId(returnId);
    try {
      const res = await fetch(`${API_BASE}/returns/admin/${siteId}/${returnId}/dispatch-pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "own_agent",
          agent_id: newAgentId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to reassign return rider");
      }
      const data = await res.json();
      if (data.return_request) {
        setReturnDetailsMap((prev) => ({ ...prev, [returnId]: data.return_request }));
      }
      showToast("Return rider reassigned successfully!", "success");
      setReassigningReturnIdMap((p) => ({ ...p, [returnId]: false }));
      await loadReturnsForSite();
      await loadDeliveryMeta();
    } catch (err: any) {
      showToast(err?.message || "Failed to reassign rider", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSwitchReturnToManual = async (returnId: string) => {
    if (!siteId) return;
    const manualData = returnManualCourierMap[returnId] || { courierName: "", trackingNumber: "", notes: "" };
    setActionLoadingId(returnId);
    try {
      const res = await fetch(`${API_BASE}/returns/admin/${siteId}/${returnId}/dispatch-pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "manual",
          courier_name: manualData.courierName || "Manual Courier / Self Ship",
          tracking_number: manualData.trackingNumber || "",
          pickup_notes: manualData.notes || "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to switch return to manual courier");
      }
      const data = await res.json();
      if (data.return_request) {
        setReturnDetailsMap((prev) => ({ ...prev, [returnId]: data.return_request }));
      }
      showToast("Switched return to manual courier successfully!", "success");
      setReassigningReturnIdMap((p) => ({ ...p, [returnId]: false }));
      await loadReturnsForSite();
      await loadDeliveryMeta();
    } catch (err: any) {
      showToast(err?.message || "Failed to switch to manual return", "error");
    } finally {
      setActionLoadingId(null);
    }
  };



  useEffect(() => {
    if (!siteId) return;

    const loadByMode = async () => {
      setError("");
      try {
        if (mode === "orders") {
          await loadOrdersForSite(
            currentPage,
            pageSize,
            activeTab,
            searchQuery,
            paymentFilter,
            dateFilter,
            customFromDate,
            customToDate
          );
          try {
            await loadDeliveryMeta();
          } catch (metaErr) {
            console.warn("Delivery metadata load failed non-critically:", metaErr);
          }
        } else {
          await loadReturnsForSite(
            currentPage,
            pageSize,
            activeReturnTab,
            searchQuery
          );
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
  }, [
    siteId,
    mode,
    activeTab,
    activeReturnTab,
    currentPage,
    pageSize,
    searchQuery,
    paymentFilter,
    dateFilter,
    customFromDate,
    customToDate,
  ]);

  // Deep-linking support for direct order/return links (e.g. from Earnings/Ledger page)
  const targetOrderId = searchParams.get("orderId");
  const targetReturnId = searchParams.get("returnId");

  useEffect(() => {
    if (targetOrderId && orders.length > 0) {
      const found = orders.find(
        (o) => o.id === targetOrderId || o.id.toLowerCase() === targetOrderId.toLowerCase() || o.id.startsWith(targetOrderId)
      );
      if (found) {
        setMode("orders");
        if (found.status === "placed") setActiveTab("new");
        else if (found.status === "confirmed" || found.status === "accepted") setActiveTab("yet_to_ship");
        else if (
          found.status === "shipped" ||
          found.status === "out_for_delivery" ||
          found.status === "rescheduled" ||
          found.status === "failed"
        )
          setActiveTab("yet_to_deliver");
        else if (found.status === "delivered" || found.status === "returned") setActiveTab("delivered");
        else if (found.status === "cancelled" || found.status === "partially_cancelled") setActiveTab("cancelled");

        setDateFilter("all");
        setPaymentFilter("all");
        setFulfillmentFilter("all");
        setSearchQuery(found.id.slice(0, 8).toUpperCase());
        setExpandedOrderId(found.id);
        ensureOrderDetail(found.id);
      } else {
        setMode("orders");
        setDateFilter("all");
        setSearchQuery(targetOrderId.slice(0, 8).toUpperCase());
        setExpandedOrderId(targetOrderId);
        ensureOrderDetail(targetOrderId);
      }
    } else if (targetReturnId && adminReturns.length > 0) {
      const found = adminReturns.find(
        (r) => r.id === targetReturnId || r.id.toLowerCase() === targetReturnId.toLowerCase() || r.id.startsWith(targetReturnId)
      );
      if (found) {
        setMode("returns");
        setActiveReturnTab(found.status);
        setDateFilter("all");
        setSearchQuery(found.id.slice(0, 8).toUpperCase());
        setExpandedReturnId(found.id);
        ensureReturnDetail(found.id);
      }
    }
  }, [targetOrderId, targetReturnId, orders, adminReturns]);


  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    dateFilter !== "last_30_days" ||
    paymentFilter !== "all" ||
    fulfillmentFilter !== "all";

  const availableFulfillmentModes = useMemo(() => {
    // Check if store has in-house riders configured or orders with agents
    const hasRiders =
      (deliveryAgents && deliveryAgents.length > 0) ||
      Boolean(deliverySettings?.allow_own_delivery_agents) ||
      orders.some((o) => Boolean(o.shipment?.agent_id));

    // Check if store has Shiprocket courier configured or used
    const hasShiprocket =
      Boolean(deliverySettings?.shiprocket_enabled) ||
      orders.some((o) => Boolean(o.shipment?.courier_name));

    // Check if manual / self courier is allowed or used
    const hasManual =
      deliverySettings?.allow_manual_courier !== false ||
      orders.some((o) => !o.shipment?.agent_id && !o.shipment?.courier_name && Boolean(o.shipment?.delivery_partner_name));

    const channelCount = (hasRiders ? 1 : 0) + (hasShiprocket ? 1 : 0) + (hasManual ? 1 : 0);

    return {
      hasRiders,
      hasShiprocket,
      hasManual,
      channelCount,
      hasAnyDispatchConfig: channelCount > 0,
    };
  }, [deliveryAgents, deliverySettings, orders]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (dateFilter !== "last_30_days") c++;
    if (paymentFilter !== "all") c++;
    if (fulfillmentFilter !== "all") c++;
    return c;
  }, [dateFilter, paymentFilter, fulfillmentFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setDateFilter("last_30_days");
    setCustomFromDate("");
    setCustomToDate("");
    setPaymentFilter("all");
    setFulfillmentFilter("all");
    setCurrentPage(1);
  };

  const matchesOrderDateFilter = (createdAt?: string | null) => {
    if (dateFilter === "all") return true;
    if (!createdAt) return false;
    const orderDate = new Date(createdAt).getTime();
    const now = Date.now();
    if (dateFilter === "today") {
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      return orderDate >= startOfToday;
    } else if (dateFilter === "last_7_days") {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      return orderDate >= sevenDaysAgo;
    } else if (dateFilter === "last_30_days") {
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      return orderDate >= thirtyDaysAgo;
    } else if (dateFilter === "custom") {
      if (customFromDate && orderDate < new Date(customFromDate).getTime()) return false;
      if (customToDate) {
        const endOfToDate = new Date(customToDate).setHours(23, 59, 59, 999);
        if (orderDate > endOfToDate) return false;
      }
      return true;
    }
    return true;
  };

  const filteredOrders = useMemo(() => {
    if (Object.keys(serverTabCounts).length > 0) {
      return orders;
    }
    return orders.filter((order) => {
      // 1. Tab match
      if (!matchesTab(order, activeTab)) return false;

      // 2. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const customerName = (order.customer_name || order.shipping_address?.fullName || "").toLowerCase();
        const customerPhone = (order.customer_phone || order.shipping_address?.mobileNumber || "").toLowerCase();
        const customerEmail = (order.customer_email || order.shipping_address?.email || "").toLowerCase();
        const city = (order.shipping_address?.city || "").toLowerCase();
        const orderId = (order.id || "").toLowerCase();
        const riderName = (order.shipment?.delivery_partner_name || "").toLowerCase();
        const courierName = (order.shipment?.courier_name || "").toLowerCase();

        const match =
          customerName.includes(q) ||
          customerPhone.includes(q) ||
          customerEmail.includes(q) ||
          city.includes(q) ||
          orderId.includes(q) ||
          riderName.includes(q) ||
          courierName.includes(q);
        if (!match) return false;
      }

      // 3. Payment Filter
      if (paymentFilter !== "all") {
        const p = (order.payment_method || "").toLowerCase();
        if (paymentFilter === "cod" && !(p === "cod" || p === "cash_on_delivery")) return false;
        if (paymentFilter === "online" && (p === "cod" || p === "cash_on_delivery")) return false;
        if (paymentFilter === "upi" && p !== "upi") return false;
        if (paymentFilter === "card" && p !== "card") return false;
        if (paymentFilter === "netbanking" && p !== "netbanking") return false;
      }

      // 4. Dynamic Fulfillment / Dispatch Filter
      if (fulfillmentFilter !== "all") {
        const isRider = Boolean(order.shipment?.agent_id);
        const isShiprocket = Boolean(order.shipment?.courier_name);
        const isManual = !isRider && !isShiprocket && Boolean(order.shipment?.delivery_partner_name);
        const isDispatched = isRider || isShiprocket || isManual;

        if (fulfillmentFilter === "unassigned") {
          if (isDispatched) return false;
        } else if (fulfillmentFilter === "dispatched") {
          if (!isDispatched) return false;
        } else if (fulfillmentFilter === "rider") {
          if (!isRider) return false;
        } else if (fulfillmentFilter === "shiprocket") {
          if (!isShiprocket) return false;
        } else if (fulfillmentFilter === "manual") {
          if (!isManual) return false;
        } else if (fulfillmentFilter.startsWith("agent_")) {
          const targetAgentId = fulfillmentFilter.replace("agent_", "");
          if (order.shipment?.agent_id !== targetAgentId) return false;
        }
      }

      // 5. Date Filter
      if (!matchesOrderDateFilter(order.created_at)) return false;

      return true;
    });
  }, [
    serverTabCounts,
    orders,
    activeTab,
    searchQuery,
    paymentFilter,
    fulfillmentFilter,
    dateFilter,
    customFromDate,
    customToDate,
  ]);

  const totalPages = Math.max(1, serverTotalPages || Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    if (Object.keys(serverTabCounts).length > 0) return orders;
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [serverTabCounts, orders, filteredOrders, currentPage, pageSize]);

  const filteredReturns = useMemo(() => {
    if (Object.keys(serverReturnTabCounts).length > 0) {
      return adminReturns;
    }
    return adminReturns.filter((item) => {
      if (!matchesReturnTab(item, activeReturnTab)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const customerName = (item.customer_name || item.shipping_address?.fullName || "").toLowerCase();
        const orderId = (item.order_id || "").toLowerCase();
        const returnId = (item.id || "").toLowerCase();
        if (!customerName.includes(q) && !orderId.includes(q) && !returnId.includes(q)) return false;
      }
      if (!matchesOrderDateFilter(item.created_at)) return false;
      return true;
    });
  }, [serverReturnTabCounts, adminReturns, activeReturnTab, searchQuery, dateFilter, customFromDate, customToDate]);

  const totalReturnPages = Math.max(1, serverTotalReturnPages || Math.ceil(filteredReturns.length / pageSize));
  const paginatedReturns = useMemo(() => {
    if (Object.keys(serverReturnTabCounts).length > 0) return adminReturns;
    const start = (currentPage - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [serverReturnTabCounts, adminReturns, filteredReturns, currentPage, pageSize]);


  const counts = useMemo(() => {
    if (Object.keys(serverTabCounts).length > 0) {
      return {
        new: serverTabCounts.new ?? 0,
        yet_to_ship: serverTabCounts.yet_to_ship ?? 0,
        yet_to_deliver: serverTabCounts.yet_to_deliver ?? 0,
        delivered: serverTabCounts.delivered ?? 0,
        cancelled: serverTabCounts.cancelled ?? 0,
      };
    }
    const matchesNonTab = (o: AdminOrderListItem) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const customerName = (o.customer_name || o.shipping_address?.fullName || "").toLowerCase();
        const customerPhone = (o.customer_phone || o.shipping_address?.mobileNumber || "").toLowerCase();
        const customerEmail = (o.customer_email || o.shipping_address?.email || "").toLowerCase();
        const city = (o.shipping_address?.city || "").toLowerCase();
        const orderId = (o.id || "").toLowerCase();
        const riderName = (o.shipment?.delivery_partner_name || "").toLowerCase();
        const courierName = (o.shipment?.courier_name || "").toLowerCase();
        const match =
          customerName.includes(q) ||
          customerPhone.includes(q) ||
          customerEmail.includes(q) ||
          city.includes(q) ||
          orderId.includes(q) ||
          riderName.includes(q) ||
          courierName.includes(q);
        if (!match) return false;
      }
      if (paymentFilter !== "all") {
        const p = (o.payment_method || "").toLowerCase();
        if (paymentFilter === "cod" && !(p === "cod" || p === "cash_on_delivery")) return false;
        if (paymentFilter === "online" && (p === "cod" || p === "cash_on_delivery")) return false;
        if (paymentFilter === "upi" && p !== "upi") return false;
        if (paymentFilter === "card" && p !== "card") return false;
        if (paymentFilter === "netbanking" && p !== "netbanking") return false;
      }
      if (fulfillmentFilter !== "all") {
        if (fulfillmentFilter === "rider" && !o.shipment?.delivery_partner_name) return false;
        if (fulfillmentFilter === "courier" && !o.shipment?.courier_name) return false;
        if (
          fulfillmentFilter === "unassigned" &&
          (o.shipment?.delivery_partner_name || o.shipment?.courier_name)
        )
          return false;
      }
      if (!matchesOrderDateFilter(o.created_at)) return false;
      return true;
    };

    return {
      new: orders.filter((o) => matchesTab(o, "new") && matchesNonTab(o)).length,
      yet_to_ship: orders.filter((o) => matchesTab(o, "yet_to_ship") && matchesNonTab(o)).length,
      yet_to_deliver: orders.filter((o) => matchesTab(o, "yet_to_deliver") && matchesNonTab(o)).length,
      delivered: orders.filter((o) => matchesTab(o, "delivered") && matchesNonTab(o)).length,
      cancelled: orders.filter((o) => matchesTab(o, "cancelled") && matchesNonTab(o)).length,
    };
  }, [serverTabCounts, orders, searchQuery, paymentFilter, fulfillmentFilter, dateFilter, customFromDate, customToDate]);


  const returnCounts = useMemo(() => {
    if (Object.keys(serverReturnTabCounts).length > 0) {
      return {
        requested: serverReturnTabCounts.requested ?? 0,
        approved: serverReturnTabCounts.approved ?? 0,
        received: serverReturnTabCounts.received ?? 0,
        inspected: serverReturnTabCounts.inspected ?? 0,
        refunded: serverReturnTabCounts.refunded ?? 0,
        closed: serverReturnTabCounts.closed ?? 0,
        rejected: serverReturnTabCounts.rejected ?? 0,
      };
    }
    const matchesNonTabReturn = (item: AdminReturnListItem) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const customerName = (item.customer_name || item.shipping_address?.fullName || "").toLowerCase();
        const orderId = (item.order_id || "").toLowerCase();
        const returnId = (item.id || "").toLowerCase();
        if (!customerName.includes(q) && !orderId.includes(q) && !returnId.includes(q)) return false;
      }
      if (!matchesOrderDateFilter(item.created_at)) return false;
      return true;
    };

    return {
      requested: adminReturns.filter((o) => matchesReturnTab(o, "requested") && matchesNonTabReturn(o)).length,
      approved: adminReturns.filter((o) => matchesReturnTab(o, "approved") && matchesNonTabReturn(o)).length,
      received: adminReturns.filter((o) => matchesReturnTab(o, "received") && matchesNonTabReturn(o)).length,
      inspected: adminReturns.filter((o) => matchesReturnTab(o, "inspected") && matchesNonTabReturn(o)).length,
      refunded: adminReturns.filter((o) => matchesReturnTab(o, "refunded") && matchesNonTabReturn(o)).length,
      closed: adminReturns.filter((o) => matchesReturnTab(o, "closed") && matchesNonTabReturn(o)).length,
      rejected: adminReturns.filter((o) => matchesReturnTab(o, "rejected") && matchesNonTabReturn(o)).length,
    };
  }, [serverReturnTabCounts, adminReturns, searchQuery, dateFilter, customFromDate, customToDate]);


  const refreshOrderDetail = async (orderId: string) => {
    if (!siteId) return;
    const detail = await fetchJson(`${API_BASE}/orders/admin/${siteId}/${orderId}`);
    setDetailsMap((prev) => ({ ...prev, [orderId]: detail }));
    hydrateShipmentDraft(orderId, detail);
  };

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
      showToast(err.message || "Failed to update order", "error");
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
        showToast(err.message || "Failed to load order detail", "error");
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
        showToast(err.message || "Failed to load return detail", "error");
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
    const draft = getShipmentDraft(order);

    if (order.status === "shipped") {
      await handleOutForDelivery(orderId);
      return;
    }

    await updateStatus(orderId, "shipped", {
      delivery_partner_name: draft.deliveryPartnerName || null,
      delivery_partner_phone: draft.deliveryPartnerPhone || null,
      estimated_delivery_at: toIsoOrNull(draft.estimatedDeliveryAt),
    });
  };


  const handleReviewReturn = async (returnId: string) => {
    if (!siteId) return;
    const draft = reviewDrafts[returnId];
    if (!draft) return;

    if (draft.action === "approve") {
      const totalAppr = Object.values(draft.approvedQuantities).reduce((acc, q) => acc + Number(q || 0), 0);
      if (totalAppr <= 0) {
        showToast("Cannot approve return with 0 items. Please specify an approved quantity of at least 1, or select 'Reject Return' to decline the request.", "error");
        return;
      }
    }

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
      showToast("Return request reviewed successfully!", "success");
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      showToast(err.message || "Failed to review return request", "error");
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
      showToast("Return marked as received!", "success");
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      showToast(err.message || "Failed to mark return as received", "error");
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleInspectReturn = async (returnId: string) => {
    if (!siteId) return;
    const detail = returnDetailsMap[returnId];
    const draft = inspectDrafts[returnId];
    const itemsList = detail?.items || [];

    const itemsPayload = itemsList.map((item) => {
      const isZero = Number(item.quantity_received || 0) === 0;
      const dec = (draft?.restockDecisionByItem && draft.restockDecisionByItem[item.id]) || (isZero ? "discard" : "restock");
      const rawQty = (draft?.restockQuantityByItem && draft.restockQuantityByItem[item.id]);
      const qty = dec === "restock" ? Math.min(Number(item.quantity_received || 0), Number(rawQty ?? item.quantity_received ?? 0)) : 0;
      return {
        return_item_id: item.id,
        restock_decision: dec,
        restock_quantity: qty,
      };
    });

    setActionLoadingId(returnId);
    try {
      await fetchJson(`${API_BASE}/returns/admin/${siteId}/${returnId}/inspect`, {
        method: "PATCH",
        body: JSON.stringify({
          admin_note: draft?.adminNote || null,
          items: itemsPayload,
        }),
      });
      showToast("Return inspection recorded successfully!", "success");
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      showToast(err.message || "Failed to inspect return", "error");
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
      showToast("Refund processed successfully!", "success");
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      showToast(err.message || "Failed to process refund", "error");
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
      showToast("Return closed successfully!", "success");
      await syncReturnAfterAction(returnId);
    } catch (err: any) {
      showToast(err.message || "Failed to close return", "error");
    } finally {
      setActionLoadingId(null);
    }
  };


  const generateBillPdf = (order: AdminOrderDetail | AdminOrderListItem) => {
    showToast(`Generating invoice for ${order.id}...`, "info");
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
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            disabled={actionLoadingId === order.id}
            onClick={(e) => {
              e.stopPropagation();
              handleConfirmOrder(order.id);
            }}
            style={{
              ...actionButtonStyle,
              padding: "5px 10px",
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
              padding: "5px 10px",
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            Reject
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          const detail = detailsMap[order.id] || order;
          generateBillPdf(detail);
        }}
        style={{
          ...actionButtonStyle,
          padding: "5px 10px",
          background: "#ffffff",
          color: "#475569",
          border: "1px solid #e2e8f0",
        }}
      >
        Invoice
      </button>
    );
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
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {/* Top Header Card (Segmented Mode + Search & Filter Button) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative",
        }}
      >
        {/* Row 1: Mode Switcher + Global Search + Filter Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill (Orders vs Returns) */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
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
                    setCurrentPage(1);
                  }}
                  style={{
                    borderRadius: "6px",
                    padding: "6px 16px",
                    border: "none",
                    background: isActive ? "#ffffff" : "transparent",
                    color: isActive ? "#0f172a" : "#64748b",
                    boxShadow: isActive
                      ? "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                      : "none",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s ease",
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>

          {/* Search Bar & Filter Button Container */}
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
                placeholder={
                  mode === "orders"
                    ? "Search orders, customers, phone, city..."
                    : "Search returns, orders, customers..."
                }
                style={{
                  ...inputStyle,
                  paddingLeft: "34px",
                  paddingRight: searchQuery ? "28px" : "12px",
                  fontSize: "13px",
                  height: "36px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                }}
              />
              {searchQuery && (
                <button
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
            <button
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

            {/* Floating Filter Popover Modal */}
            {isFilterOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "44px",
                  right: "0",
                  width: "320px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  padding: "16px",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Filter Orders</div>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                  >
                    <XMarkIcon />
                  </button>
                </div>

                {/* Date Filter */}
                <div>
                  <label style={{ ...labelStyle, fontSize: "12px", marginBottom: "4px" }}>Date Range</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    style={{ ...inputStyle, fontSize: "13px", height: "34px", padding: "0 8px" }}
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
                        style={{ ...inputStyle, fontSize: "12px", height: "32px", padding: "0 6px" }}
                      />
                      <span style={{ fontSize: "12px", color: "#64748b" }}>to</span>
                      <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => {
                          setCustomToDate(e.target.value);
                          setCurrentPage(1);
                        }}
                        style={{ ...inputStyle, fontSize: "12px", height: "32px", padding: "0 6px" }}
                      />
                    </div>
                  )}
                </div>

                {/* Payment Filter */}
                {mode === "orders" && (
                  <div>
                    <label style={{ ...labelStyle, fontSize: "12px", marginBottom: "4px" }}>Payment Method</label>
                    <select
                      value={paymentFilter}
                      onChange={(e) => {
                        setPaymentFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ ...inputStyle, fontSize: "13px", height: "34px", padding: "0 8px" }}
                    >
                      <option value="all">All Payment Methods</option>
                      <option value="cod">Cash on Delivery (COD)</option>
                      <option value="online">Prepaid / Online</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="netbanking">Netbanking</option>
                    </select>
                  </div>
                )}

                {/* Dynamic Fulfillment Filter */}
                {mode === "orders" && availableFulfillmentModes.hasAnyDispatchConfig && (
                  <div>
                    <label style={{ ...labelStyle, fontSize: "12px", marginBottom: "4px" }}>Dispatch & Delivery</label>
                    <select
                      value={fulfillmentFilter}
                      onChange={(e) => {
                        setFulfillmentFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ ...inputStyle, fontSize: "13px", height: "34px", padding: "0 8px" }}
                    >
                      <option value="all">All Orders (Dispatched & Pending)</option>
                      <option value="unassigned">Unassigned (Pending Dispatch)</option>
                      <option value="dispatched">All Dispatched Orders</option>

                      {availableFulfillmentModes.hasRiders && (
                        <option value="rider">In-House Rider Assigned</option>
                      )}

                      {availableFulfillmentModes.hasShiprocket && (
                        <option value="shiprocket">Shiprocket Courier</option>
                      )}

                      {availableFulfillmentModes.hasManual && (
                        <option value="manual">Manual / Self Courier</option>
                      )}

                      {deliveryAgents && deliveryAgents.length > 0 && (
                        <optgroup label="Filter by Specific Rider">
                          {deliveryAgents.map((agent) => (
                            <option key={agent.id} value={`agent_${agent.id}`}>
                              Rider: {agent.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}

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
                    onClick={() => setIsFilterOpen(false)}
                    style={{
                      background: "#2563eb",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "12.5px",
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

        {/* Row 2: Active Filter Chips Bar (Only shown if non-default filters or query are active) */}
        {hasActiveFilters && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              paddingTop: "6px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, marginRight: "2px" }}>
              Active:
            </span>

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
                <span>Date: {dateFilter === "all" ? "All Time" : dateFilter.replaceAll("_", " ")}</span>
                <button
                  onClick={() => setDateFilter("last_30_days")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {paymentFilter !== "all" && (
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
                <span>Payment: {paymentFilter.toUpperCase()}</span>
                <button
                  onClick={() => setPaymentFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {fulfillmentFilter !== "all" && (
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
                <span>
                  {fulfillmentFilter === "unassigned"
                    ? "Dispatch: Unassigned"
                    : fulfillmentFilter === "dispatched"
                    ? "Dispatch: Dispatched"
                    : fulfillmentFilter === "rider"
                    ? "Dispatch: In-House Rider"
                    : fulfillmentFilter === "shiprocket"
                    ? "Dispatch: Shiprocket"
                    : fulfillmentFilter === "manual"
                    ? "Dispatch: Manual Courier"
                    : fulfillmentFilter.startsWith("agent_")
                    ? `Rider: ${deliveryAgents.find((a) => a.id === fulfillmentFilter.replace("agent_", ""))?.name || "Rider"}`
                    : `Dispatch: ${fulfillmentFilter}`}
                </span>
                <button
                  onClick={() => setFulfillmentFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            <button
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
          {/* Orders Subtabs (Clean Underline Filter Bar with Count Badges) */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: "16px",
            }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = counts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setExpandedOrderId(null);
                    setCurrentPage(1);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                    background: "transparent",
                    color: isActive ? "#2563eb" : "#64748b",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    marginBottom: "-1px",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: isActive ? "#eff6ff" : "#f1f5f9",
                      color: isActive ? "#2563eb" : "#64748b",
                      border: `1px solid ${isActive ? "#bfdbfe" : "#e2e8f0"}`,
                    }}
                  >
                    {count}
                  </span>
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
                {hasActiveFilters ? "No orders match your filter criteria." : "No records in this tab."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Clean Table Header */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(180px, 1.4fr) minmax(180px, 1.1fr) minmax(130px, 1fr) minmax(110px, 0.8fr) minmax(80px, auto) 28px",
                      gap: "12px",
                      alignItems: "center",
                      padding: "9px 16px",
                      background: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <div>Customer & Order</div>
                    <div>Amount & Payment</div>
                    <div>Delivery Partner</div>
                    <div>Status</div>
                    <div style={{ textAlign: "right" }}>Actions</div>
                    <div></div>
                  </div>

                  {paginatedOrders.map((order) => {
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
                          borderBottom: "1px solid #e2e8f0",
                          background: isExpanded ? "#f8fafc" : "#ffffff",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div
                          onClick={() => handleExpandToggle(order.id)}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "minmax(180px, 1.4fr) minmax(180px, 1.1fr) minmax(130px, 1fr) minmax(110px, 0.8fr) minmax(80px, auto) 28px",
                            gap: "12px",
                            alignItems: "center",
                            padding: "12px 16px",
                            cursor: "pointer",
                            background: isExpanded ? "#f1f5f9" : "transparent",
                            borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                            transition: "background 0.15s ease",
                          }}
                        >
                          {/* Col 1: Customer & Order Items */}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "13.5px",
                                fontWeight: 700,
                                color: "#0f172a",
                                marginBottom: "2px",
                                display: "flex",
                                alignItems: "center",
                                gap: "7px",
                              }}
                            >
                              <span>{order.customer_name || shippingAddress?.fullName || "Guest Customer"}</span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: "#64748b",
                                  background: "#f1f5f9",
                                  border: "1px solid #e2e8f0",
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                }}
                                title={`Full Order ID: ${order.id}`}
                              >
                                #{order.id.slice(0, 8).toUpperCase()}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#64748b",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {shippingAddress?.city ? `${shippingAddress.city} • ` : ""}
                              {items.length > 0
                                ? items.map((i) => `${i.product_name} ×${i.quantity}`).slice(0, 2).join(", ")
                                : `${order.item_count || 1} item`}
                            </div>
                          </div>

                          {/* Col 2: Amount & Date */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "13.5px", color: "#0f172a", fontWeight: 700 }}>
                                {formatPrice(order.total)}
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  background: "#f8fafc",
                                  color: "#475569",
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
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              {formatDate(order.created_at)}
                            </div>
                          </div>

                          {/* Col 3: Fulfillment / Rider Status */}
                          <div style={{ minWidth: 0 }}>
                            {order.shipment?.delivery_partner_name ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {order.shipment.delivery_partner_name}
                                </span>
                              </div>
                            ) : order.shipment?.courier_name ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />
                                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {order.shipment.courier_name}
                                </span>
                              </div>
                            ) : (order.status === "confirmed" || order.status === "accepted" || order.status === "shipped") ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ea580c", flexShrink: 0 }} />
                                <span style={{ fontSize: "12px", fontWeight: 600, color: "#c2410c" }}>
                                  Unassigned
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                            )}
                          </div>

                          {/* Col 4: Status Badge */}
                          <div>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                background: tone.bg,
                                color: tone.text,
                                border: tone.border,
                                fontSize: "12px",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getStatusLabel(order.status)}
                            </span>
                          </div>

                          {/* Col 5: Actions */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                            }}
                          >
                            {renderRowActions(order)}
                          </div>

                          {/* Col 6: Chevron */}
                          <div style={{ color: "#94a3b8", display: "grid", placeItems: "center" }}>
                            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                          </div>
                        </div>


                        {isExpanded ? (
                          <div style={{ padding: "16px 18px 20px", background: "#f8fafc" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                                gap: "16px",
                                alignItems: "start",
                              }}
                            >
                              {/* Left Column: Customer Details, Delivery Destination & Items */}
                              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                {/* Card 1: Customer & Shipping Information */}
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: "12px",
                                      paddingBottom: "8px",
                                      borderBottom: "1px solid #f1f5f9",
                                    }}
                                  >
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                      Customer & Destination
                                    </span>
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
                                        border: `1px solid ${(detail?.payment_status || order.payment_status) === "paid" ? "#bbf7d0" : (detail?.payment_status || order.payment_status) === "refunded" ? "#e9d5ff" : "#fde68a"}`,
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      Payment: {(detail?.payment_status || order.payment_status) || "Pending"}
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                      {shippingAddress?.fullName || detail?.customer_name || order.customer_name || "Guest Customer"}
                                    </div>

                                    <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                      <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "2px" }}>
                                        Delivery Address:
                                      </div>
                                      <div>{shippingAddress?.addressLine1 || "—"}</div>
                                      <div>
                                        {[shippingAddress?.city, shippingAddress?.postalCode].filter(Boolean).join(" - ") || "—"}
                                      </div>
                                      {(shippingAddress?.latitude && shippingAddress?.longitude) ? (
                                        <div style={{ marginTop: "6px", paddingTop: "4px" }}>
                                          <a
                                            href={`https://www.google.com/maps?q=${shippingAddress.latitude},${shippingAddress.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              fontSize: "12px",
                                              fontWeight: 600,
                                              color: "#2563eb",
                                              textDecoration: "none",
                                              background: "#eff6ff",
                                              border: "1px solid #bfdbfe",
                                              borderRadius: "4px",
                                              padding: "2px 8px",
                                            }}
                                          >
                                            📍 Open Exact Pinned Location on Maps
                                          </a>
                                        </div>
                                      ) : null}
                                    </div>

                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                                      {(shippingAddress?.mobileNumber || detail?.customer_phone || order.customer_phone) && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                          <PhoneIcon />
                                          <a
                                            href={`tel:${shippingAddress?.mobileNumber || detail?.customer_phone || order.customer_phone}`}
                                            style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                                          >
                                            {formatPhoneDisplay(shippingAddress?.mobileNumber || detail?.customer_phone || order.customer_phone || "")}
                                          </a>
                                        </div>
                                      )}
                                      {(shippingAddress?.email || detail?.customer_email || order.customer_email) && (
                                        <div style={{ color: "#64748b" }}>
                                          {shippingAddress?.email || detail?.customer_email || order.customer_email}
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                                      <span style={{ color: "#64748b" }}>Payment Method:</span>
                                      <span style={{ fontWeight: 700, color: "#0f172a", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <span>{getPaymentMethodIcon(detail?.payment_method || order.payment_method)}</span>
                                        <span>{formatPaymentMethodName(detail?.payment_method || order.payment_method)}</span>
                                      </span>
                                    </div>

                                    {(detail?.razorpay_payment_id || order.razorpay_payment_id) && (
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                                        <span style={{ color: "#64748b" }}>Payment Reference:</span>
                                        <code style={{ fontSize: "11px", fontWeight: 700, background: "#f8fafc", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0", color: "#0f172a" }}>
                                          {detail?.razorpay_payment_id || order.razorpay_payment_id}
                                        </code>
                                      </div>
                                    )}

                                    {(() => {
                                      const currentShipment = detail?.shipment || order.shipment;
                                      const isShiprocket = Boolean(
                                        currentShipment && (
                                          currentShipment.delivery_mode === "shiprocket" ||
                                          currentShipment.mode === "shiprocket" ||
                                          (Boolean(currentShipment.awb_number) && !currentShipment.agent_id && currentShipment.delivery_mode !== "manual")
                                        )
                                      );
                                      const isManual = Boolean(
                                        currentShipment && (
                                          currentShipment.delivery_mode === "manual" ||
                                          currentShipment.mode === "manual" ||
                                          (Boolean(currentShipment.delivery_partner_name) && currentShipment.delivery_mode !== "own_agent" && currentShipment.mode !== "own_agent" && !currentShipment.agent_id) ||
                                          ((order.status === "shipped" || order.status === "out_for_delivery") && !currentShipment.agent_id && currentShipment.delivery_mode !== "own_agent")
                                        )
                                      );
                                      const isOwnAgent = !isShiprocket && !isManual && Boolean(
                                        currentShipment && (
                                          currentShipment.delivery_mode === "own_agent" ||
                                          currentShipment.mode === "own_agent" ||
                                          Boolean(currentShipment.agent_id)
                                        )
                                      );

                                      if (!isOwnAgent || !(detail?.delivery_otp || order.delivery_otp) || order.status === "delivered" || order.status === "cancelled") {
                                        return null;
                                      }

                                      return (
                                        <div
                                          style={{
                                            marginTop: "6px",
                                            padding: "8px 12px",
                                            background: "#ecfdf5",
                                            borderRadius: "6px",
                                            border: "1px solid #a7f3d0",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                          }}
                                        >
                                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#065f46" }}>
                                            Delivery OTP:
                                          </span>
                                          <code
                                            style={{
                                              fontSize: "13px",
                                              fontWeight: 900,
                                              letterSpacing: "3px",
                                              fontFamily: "monospace",
                                              color: "#047857",
                                              background: "#ffffff",
                                              padding: "2px 8px",
                                              borderRadius: "4px",
                                              border: "1px dashed #059669",
                                            }}
                                          >
                                            {detail?.delivery_otp || order.delivery_otp}
                                          </code>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Card 2: Order Items & Pricing Breakdown */}
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: "12px",
                                      paddingBottom: "8px",
                                      borderBottom: "1px solid #f1f5f9",
                                    }}
                                  >
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                      Order Items ({items.length})
                                    </span>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                                      Total: {formatPrice(order.total)}
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {items.map((item) => (
                                      <div
                                        key={item.id}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "flex-start",
                                          gap: "12px",
                                          padding: "10px 12px",
                                          borderRadius: "6px",
                                          background: "#f8fafc",
                                          border: "1px solid #e2e8f0",
                                        }}
                                      >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                                            {item.product_name}
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", flexWrap: "wrap" }}>
                                            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>
                                              Qty: {item.quantity}
                                            </span>
                                            {item.selected_variant_value && (
                                              <span
                                                style={{
                                                  fontSize: "11px",
                                                  fontWeight: 600,
                                                  color: "#2563eb",
                                                  background: "#eff6ff",
                                                  border: "1px solid #bfdbfe",
                                                  padding: "1px 6px",
                                                  borderRadius: "4px",
                                                }}
                                              >
                                                {item.selected_variant_value}
                                              </span>
                                            )}
                                            <span style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                                              • {item.status.replaceAll("_", " ")}
                                            </span>
                                          </div>
                                        </div>
                                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                                          {formatPrice(item.line_total)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Fulfillment Dispatch Control & Admin Timeline */}
                              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                {/* Card 1: Delivery & Dispatch Control */}
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: "12px",
                                      paddingBottom: "8px",
                                      borderBottom: "1px solid #f1f5f9",
                                    }}
                                  >
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                      Fulfillment & Dispatch
                                    </span>
                                    {(detail?.shipment || order.shipment) ? (
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          padding: "3px 8px",
                                          borderRadius: "4px",
                                          background: (detail?.shipment?.status || order.shipment?.status) === "delivered" ? "#f0fdf4" : "#eff6ff",
                                          color: (detail?.shipment?.status || order.shipment?.status) === "delivered" ? "#15803d" : "#1d4ed8",
                                          border: `1px solid ${(detail?.shipment?.status || order.shipment?.status) === "delivered" ? "#bbf7d0" : "#bfdbfe"}`,
                                          textTransform: "capitalize",
                                        }}
                                      >
                                        {(detail?.shipment?.status || order.shipment?.status || "Pending").replaceAll("_", " ")}
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          padding: "3px 8px",
                                          borderRadius: "4px",
                                          background: "#fff7ed",
                                          color: "#c2410c",
                                          border: "1px solid #ffedd5",
                                        }}
                                      >
                                        Pending Dispatch
                                      </span>
                                    )}
                                  </div>

                                  {(() => {
                                    const currentShipment = detail?.shipment || order.shipment;
                                    const isFleetOn = deliverySettings?.enable_fleet !== undefined ? Boolean(deliverySettings.enable_fleet) : (deliverySettings?.delivery_mode === "own_agent" || deliverySettings?.delivery_mode === "hybrid");
                                    const isShiprocketOn = deliverySettings?.enable_shiprocket !== undefined ? Boolean(deliverySettings.enable_shiprocket) : (deliverySettings?.delivery_mode === "shiprocket" || deliverySettings?.delivery_mode === "hybrid");
                                    const isManualOn = deliverySettings?.enable_manual !== undefined ? Boolean(deliverySettings.enable_manual) : (deliverySettings?.delivery_mode === "manual");

                                    const availableModes: Array<{ id: "own_agent" | "shiprocket" | "manual"; label: string }> = [];
                                    if (isFleetOn) availableModes.push({ id: "own_agent", label: "Own Fleet" });
                                    if (isShiprocketOn) availableModes.push({ id: "shiprocket", label: "Shiprocket" });
                                    if (isManualOn) availableModes.push({ id: "manual", label: "Manual" });

                                    if (availableModes.length === 0) {
                                      availableModes.push({ id: "manual", label: "Manual" });
                                    }

                                    const activeMode: "own_agent" | "shiprocket" | "manual" = (
                                      selectedDispatchModeMap[order.id] && availableModes.some((m) => m.id === selectedDispatchModeMap[order.id])
                                        ? selectedDispatchModeMap[order.id]
                                        : availableModes[0].id
                                    ) as "own_agent" | "shiprocket" | "manual";

                                    const assignedRider = deliveryAgents.find((a) => a.id === currentShipment?.delivery_partner_phone || a.name === currentShipment?.delivery_partner_name);
                                    const riderName = currentShipment?.delivery_partner_name || assignedRider?.name || "Assigned Rider";
                                    const riderPhone = currentShipment?.delivery_partner_phone || assignedRider?.phone || "";
                                    const isReassigning = Boolean(reassigningOrderIdMap[order.id]);

                                    return (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        {/* If Order is already dispatched via Shiprocket */}
                                        {Boolean(
                                          currentShipment && (
                                            currentShipment.delivery_mode === "shiprocket" ||
                                            currentShipment.mode === "shiprocket" ||
                                            (Boolean(currentShipment.awb_number) && !currentShipment.agent_id && currentShipment.delivery_mode !== "manual")
                                          )
                                        ) ? (
                                          <div
                                            style={{
                                              padding: "14px",
                                              background: "#f8fafc",
                                              borderRadius: "8px",
                                              border: "1px solid #e2e8f0",
                                            }}
                                          >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                Courier Partner (Shiprocket)
                                              </div>
                                              <span
                                                style={{
                                                  fontSize: "11px",
                                                  fontWeight: 700,
                                                  padding: "2px 7px",
                                                  borderRadius: "4px",
                                                  background: "#eff6ff",
                                                  color: "#1d4ed8",
                                                  border: "1px solid #bfdbfe",
                                                  textTransform: "capitalize",
                                                }}
                                              >
                                                {(currentShipment?.status || "In Transit").replaceAll("_", " ")}
                                              </span>
                                            </div>

                                            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                                              {currentShipment?.courier_name || "Delhivery Surface"}
                                            </div>

                                            {currentShipment?.awb_number && (
                                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontSize: "13px" }}>
                                                <span style={{ color: "#64748b" }}>AWB Number:</span>
                                                <code style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px", fontWeight: 700, color: "#0f172a" }}>
                                                  {currentShipment.awb_number}
                                                </code>
                                              </div>
                                            )}

                                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                                              {currentShipment?.tracking_url && (
                                                <a
                                                  href={currentShipment.tracking_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    padding: "6px 12px",
                                                    borderRadius: "6px",
                                                    background: "#2563eb",
                                                    color: "#ffffff",
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    textDecoration: "none",
                                                  }}
                                                >
                                                  Track Parcel
                                                </a>
                                              )}

                                              {currentShipment?.label_url && (
                                                <a
                                                  href={currentShipment.label_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    padding: "6px 12px",
                                                    borderRadius: "6px",
                                                    background: "#ffffff",
                                                    color: "#0f172a",
                                                    border: "1px solid #cbd5e1",
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    textDecoration: "none",
                                                  }}
                                                >
                                                  Print Shipping Label (PDF)
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        ) : Boolean(
                                          currentShipment && (
                                            currentShipment.delivery_mode === "manual" ||
                                            currentShipment.mode === "manual" ||
                                            (Boolean(currentShipment.delivery_partner_name) && currentShipment.delivery_mode !== "own_agent" && currentShipment.mode !== "own_agent" && !currentShipment.agent_id) ||
                                            ((order.status === "shipped" || order.status === "out_for_delivery") && !currentShipment.agent_id && currentShipment.delivery_mode !== "own_agent")
                                          )
                                        ) ? (
                                          /* If Order is dispatched via Manual Courier */
                                          <div
                                            style={{
                                              padding: "14px",
                                              background: "#f8fafc",
                                              borderRadius: "8px",
                                              border: "1px solid #e2e8f0",
                                            }}
                                          >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                Manual Courier Partner
                                              </div>
                                              <span
                                                style={{
                                                  fontSize: "11px",
                                                  fontWeight: 700,
                                                  padding: "2px 7px",
                                                  borderRadius: "4px",
                                                  background: (order.status === "delivered" || currentShipment?.status === "delivered")
                                                    ? "#f0fdf4"
                                                    : (order.status === "out_for_delivery" || currentShipment?.status === "out_for_delivery")
                                                    ? "#fff7ed"
                                                    : "#eff6ff",
                                                  color: (order.status === "delivered" || currentShipment?.status === "delivered")
                                                    ? "#16a34a"
                                                    : (order.status === "out_for_delivery" || currentShipment?.status === "out_for_delivery")
                                                    ? "#c2410c"
                                                    : "#1d4ed8",
                                                  border: `1px solid ${
                                                    (order.status === "delivered" || currentShipment?.status === "delivered")
                                                      ? "#bbf7d0"
                                                      : (order.status === "out_for_delivery" || currentShipment?.status === "out_for_delivery")
                                                      ? "#ffedd5"
                                                      : "#bfdbfe"
                                                  }`,
                                                  textTransform: "capitalize",
                                                }}
                                              >
                                                {(order.status || currentShipment?.status || "Shipped").replaceAll("_", " ")}
                                              </span>
                                            </div>

                                            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                                              {currentShipment?.delivery_partner_name || "Courier Partner"}
                                            </div>

                                            {currentShipment?.delivery_partner_phone && (
                                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontSize: "13px" }}>
                                                <span style={{ color: "#64748b" }}>Tracking No. / Contact:</span>
                                                <code style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px", fontWeight: 700, color: "#0f172a" }}>
                                                  {currentShipment.delivery_partner_phone}
                                                </code>
                                              </div>
                                            )}

                                            {currentShipment?.notes && (
                                              <div
                                                style={{
                                                  marginTop: "8px",
                                                  marginBottom: "8px",
                                                  padding: "8px 10px",
                                                  background: "#fffbeb",
                                                  borderRadius: "6px",
                                                  border: "1px solid #fde68a",
                                                  fontSize: "12px",
                                                  color: "#92400e",
                                                  lineHeight: 1.4,
                                                }}
                                              >
                                                <div style={{ fontWeight: 700, color: "#b45309", marginBottom: "2px" }}>
                                                  Delivery Note:
                                                </div>
                                                <div>{cleanShipmentNotes(currentShipment.notes)}</div>
                                              </div>
                                            )}

                                            {/* Admin Control Actions for Manual Courier */}
                                            {order.status !== "delivered" && order.status !== "cancelled" ? (
                                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}>
                                                <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                                                  Admin Delivery Controls:
                                                </div>
                                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                  {order.status === "shipped" && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOutForDelivery(order.id)}
                                                      disabled={actionLoadingId === order.id}
                                                      style={{
                                                        padding: "7px 12px",
                                                        borderRadius: "6px",
                                                        background: "#d97706",
                                                        color: "#ffffff",
                                                        border: "none",
                                                        fontSize: "12px",
                                                        fontWeight: 700,
                                                        cursor: actionLoadingId === order.id ? "wait" : "pointer",
                                                      }}
                                                    >
                                                      {actionLoadingId === order.id ? "Updating..." : "Mark Out for Delivery"}
                                                    </button>
                                                  )}

                                                  {(order.status === "shipped" || order.status === "out_for_delivery" || order.status === "rescheduled") && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDelivered(order.id)}
                                                      disabled={actionLoadingId === order.id}
                                                      style={{
                                                        padding: "7px 12px",
                                                        borderRadius: "6px",
                                                        background: "#16a34a",
                                                        color: "#ffffff",
                                                        border: "none",
                                                        fontSize: "12px",
                                                        fontWeight: 700,
                                                        cursor: actionLoadingId === order.id ? "wait" : "pointer",
                                                      }}
                                                    >
                                                      {actionLoadingId === order.id ? "Updating..." : "Mark Delivered"}
                                                    </button>
                                                  )}

                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingCourierOrderIdMap((p) => ({ ...p, [order.id]: !p[order.id] }))}
                                                    style={{
                                                      padding: "7px 12px",
                                                      borderRadius: "6px",
                                                      background: "#ffffff",
                                                      color: "#475569",
                                                      border: "1px solid #cbd5e1",
                                                      fontSize: "12px",
                                                      fontWeight: 600,
                                                      cursor: "pointer",
                                                    }}
                                                  >
                                                    {editingCourierOrderIdMap[order.id] ? "Close Form" : "Edit Courier / Tracking"}
                                                  </button>
                                                </div>

                                                {/* Edit Form */}
                                                {editingCourierOrderIdMap[order.id] && (
                                                  <div
                                                    style={{
                                                      marginTop: "8px",
                                                      padding: "10px",
                                                      background: "#ffffff",
                                                      borderRadius: "6px",
                                                      border: "1px solid #cbd5e1",
                                                      display: "flex",
                                                      flexDirection: "column",
                                                      gap: "8px",
                                                    }}
                                                  >
                                                    <div>
                                                      <div style={labelStyle}>Courier Partner Name</div>
                                                      <input
                                                        value={shipmentDraft.deliveryPartnerName}
                                                        onChange={(e) => setShipmentDraftValue(order.id, "deliveryPartnerName", e.target.value)}
                                                        placeholder="e.g. BlueDart / DTDC / SpeedPost"
                                                        style={inputStyle}
                                                      />
                                                    </div>
                                                    <div>
                                                      <div style={labelStyle}>Tracking Number / Contact</div>
                                                      <input
                                                        value={shipmentDraft.deliveryPartnerPhone}
                                                        onChange={(e) => setShipmentDraftValue(order.id, "deliveryPartnerPhone", e.target.value)}
                                                        placeholder="e.g. AWB12345678"
                                                        style={inputStyle}
                                                      />
                                                    </div>
                                                    <div style={{ display: "flex", gap: "6px" }}>
                                                      <button
                                                        type="button"
                                                        onClick={async () => {
                                                          const draft = getShipmentDraft(order);
                                                          await updateStatus(order.id, order.status as OrderStatus, {
                                                            delivery_partner_name: draft.deliveryPartnerName || null,
                                                            delivery_partner_phone: draft.deliveryPartnerPhone || null,
                                                          });
                                                          setEditingCourierOrderIdMap((p) => ({ ...p, [order.id]: false }));
                                                        }}
                                                        disabled={actionLoadingId === order.id}
                                                        style={{
                                                          padding: "6px 12px",
                                                          borderRadius: "5px",
                                                          background: "#2563eb",
                                                          color: "#ffffff",
                                                          border: "none",
                                                          fontSize: "12px",
                                                          fontWeight: 700,
                                                          cursor: "pointer",
                                                        }}
                                                      >
                                                        {actionLoadingId === order.id ? "Saving..." : "Save Changes"}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setEditingCourierOrderIdMap((p) => ({ ...p, [order.id]: false }))}
                                                        style={{
                                                          padding: "6px 10px",
                                                          borderRadius: "5px",
                                                          background: "#ffffff",
                                                          color: "#475569",
                                                          border: "1px solid #cbd5e1",
                                                          fontSize: "12px",
                                                          fontWeight: 600,
                                                          cursor: "pointer",
                                                        }}
                                                      >
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ) : order.status === "delivered" ? (
                                              <div
                                                style={{
                                                  marginTop: "10px",
                                                  padding: "8px 12px",
                                                  background: "#f0fdf4",
                                                  border: "1px solid #bbf7d0",
                                                  borderRadius: "6px",
                                                  fontSize: "12px",
                                                  color: "#166534",
                                                  fontWeight: 600,
                                                }}
                                              >
                                                ✓ Package delivered to customer.
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : Boolean(
                                          currentShipment && (
                                            currentShipment.delivery_mode === "own_agent" ||
                                            currentShipment.mode === "own_agent" ||
                                            Boolean(currentShipment.agent_id) ||
                                            Boolean(assignedRider)
                                          )
                                        ) ? (
                                          /* If Order is dispatched via Own Fleet Rider */
                                          <div
                                            style={{
                                              padding: "14px",
                                              background: "#f8fafc",
                                              borderRadius: "8px",
                                              border: "1px solid #e2e8f0",
                                            }}
                                          >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                Store Delivery Partner (Own Fleet)
                                              </div>
                                              {order.status === "cancelled" ? (
                                                <span
                                                  style={{
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    padding: "2px 7px",
                                                    borderRadius: "4px",
                                                    background: currentShipment?.status === "returned_to_warehouse" ? "#f0fdf4" : "#fef2f2",
                                                    color: currentShipment?.status === "returned_to_warehouse" ? "#16a34a" : "#dc2626",
                                                    border: `1px solid ${currentShipment?.status === "returned_to_warehouse" ? "#bbf7d0" : "#fecaca"}`,
                                                    textTransform: "capitalize",
                                                  }}
                                                >
                                                  {currentShipment?.status === "returned_to_warehouse" ? "Returned to Warehouse" : "Cancelled"}
                                                </span>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => setReassigningOrderIdMap((p) => ({ ...p, [order.id]: !p[order.id] }))}
                                                  style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "#2563eb",
                                                    fontSize: "12px",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    padding: "0",
                                                    textDecoration: "underline",
                                                  }}
                                                >
                                                  {isReassigning ? "Close" : "Reassign Rider / Courier"}
                                                </button>
                                              )}
                                            </div>

                                            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                                              {riderName}
                                              {riderPhone && (
                                                <div style={{ fontSize: "13px", color: "#475569", marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                                                  <PhoneIcon />
                                                  <a href={`tel:${riderPhone}`} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                                                    {formatPhoneDisplay(riderPhone)}
                                                  </a>
                                                </div>
                                              )}

                                              {currentShipment?.notes && (
                                                <div
                                                  style={{
                                                    marginTop: "10px",
                                                    padding: "9px 12px",
                                                    background: order.status === "cancelled"
                                                      ? (currentShipment?.status === "returned_to_warehouse" ? "#f0fdf4" : "#fef2f2")
                                                      : "#fffbeb",
                                                    borderRadius: "6px",
                                                    border: `1px solid ${
                                                      order.status === "cancelled"
                                                        ? (currentShipment?.status === "returned_to_warehouse" ? "#bbf7d0" : "#fecaca")
                                                        : "#fde68a"
                                                    }`,
                                                    fontSize: "12px",
                                                    color: order.status === "cancelled"
                                                      ? (currentShipment?.status === "returned_to_warehouse" ? "#166534" : "#991b1b")
                                                      : "#92400e",
                                                    lineHeight: 1.4,
                                                  }}
                                                >
                                                  <div
                                                    style={{
                                                      fontWeight: 700,
                                                      color: order.status === "cancelled"
                                                        ? (currentShipment?.status === "returned_to_warehouse" ? "#15803d" : "#b91c1c")
                                                        : "#b45309",
                                                      marginBottom: "2px",
                                                    }}
                                                  >
                                                    {order.status === "cancelled"
                                                      ? (currentShipment?.status === "returned_to_warehouse" ? "Warehouse Return & Cancellation Note:" : "Cancellation Note:")
                                                      : "Delivery Note / Reschedule:"}
                                                  </div>
                                                  <div>{cleanShipmentNotes(currentShipment.notes)}</div>
                                                  {order.status !== "cancelled" && currentShipment.estimated_delivery_at && (
                                                    <div style={{ marginTop: "4px", fontWeight: 700, color: "#78350f" }}>
                                                      Next Delivery Retry: {formatDate(currentShipment.estimated_delivery_at)}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            {/* Reassignment Dropdown Panel */}
                                            {isReassigning && (
                                              <div
                                                style={{
                                                  marginTop: "12px",
                                                  padding: "12px",
                                                  background: "#ffffff",
                                                  borderRadius: "6px",
                                                  border: "1px solid #cbd5e1",
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  gap: "10px",
                                                }}
                                              >
                                                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                                                  Option 1: Choose Replacement In-House Rider
                                                </div>
                                                <select
                                                  value={reassignAgentIdMap[order.id] || ""}
                                                  onChange={(e) => setReassignAgentIdMap((p) => ({ ...p, [order.id]: e.target.value }))}
                                                  style={{ ...inputStyle, fontSize: "13px" }}
                                                >
                                                  <option value="">-- Choose Rider --</option>
                                                  {deliveryAgents
                                                    .filter((a) => a.is_active)
                                                    .map((a) => (
                                                      <option key={a.id} value={a.id}>
                                                        {a.name} ({formatPhoneDisplay(a.phone)}) — {a.current_order_count} active orders
                                                      </option>
                                                    ))}
                                                </select>
                                                <div style={{ display: "flex", gap: "8px" }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleReassignRider(order.id)}
                                                    disabled={actionLoadingId === order.id || !reassignAgentIdMap[order.id]}
                                                    style={{
                                                      padding: "6px 12px",
                                                      borderRadius: "5px",
                                                      background: "#2563eb",
                                                      color: "#ffffff",
                                                      border: "none",
                                                      fontSize: "12px",
                                                      fontWeight: 700,
                                                      cursor: (actionLoadingId === order.id || !reassignAgentIdMap[order.id]) ? "not-allowed" : "pointer",
                                                      opacity: !reassignAgentIdMap[order.id] ? 0.6 : 1,
                                                    }}
                                                  >
                                                    {actionLoadingId === order.id ? "Reassigning..." : "Confirm Replacement Rider"}
                                                  </button>
                                                </div>

                                                <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "10px", marginTop: "4px" }}>
                                                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                                                    Option 2: Switch to Manual Courier Partner
                                                  </div>
                                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                    <input
                                                      value={shipmentDraft.deliveryPartnerName}
                                                      onChange={(e) => setShipmentDraftValue(order.id, "deliveryPartnerName", e.target.value)}
                                                      placeholder="Courier Name (e.g. BlueDart / DTDC / SpeedPost)"
                                                      style={inputStyle}
                                                    />
                                                    <input
                                                      value={shipmentDraft.deliveryPartnerPhone}
                                                      onChange={(e) => setShipmentDraftValue(order.id, "deliveryPartnerPhone", e.target.value)}
                                                      placeholder="Tracking Number / AWB"
                                                      style={inputStyle}
                                                    />
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                      <button
                                                        type="button"
                                                        onClick={async () => {
                                                          const draft = getShipmentDraft(order);
                                                          if (!draft.deliveryPartnerName.trim()) {
                                                            showToast("Please enter the courier partner name.", "error");
                                                            return;
                                                          }
                                                          await updateStatus(order.id, "shipped", {
                                                            delivery_partner_name: draft.deliveryPartnerName,
                                                            delivery_partner_phone: draft.deliveryPartnerPhone || null,
                                                          });
                                                          setReassigningOrderIdMap((p) => ({ ...p, [order.id]: false }));
                                                        }}
                                                        disabled={actionLoadingId === order.id}
                                                        style={{
                                                          padding: "6px 12px",
                                                          borderRadius: "5px",
                                                          background: "#0f766e",
                                                          color: "#ffffff",
                                                          border: "none",
                                                          fontSize: "12px",
                                                          fontWeight: 700,
                                                          cursor: "pointer",
                                                        }}
                                                      >
                                                        {actionLoadingId === order.id ? "Switching..." : "Switch to Manual Courier"}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setReassigningOrderIdMap((p) => ({ ...p, [order.id]: false }))}
                                                        style={{
                                                          padding: "6px 10px",
                                                          borderRadius: "5px",
                                                          background: "#ffffff",
                                                          color: "#475569",
                                                          border: "1px solid #cbd5e1",
                                                          fontSize: "12px",
                                                          fontWeight: 600,
                                                          cursor: "pointer",
                                                        }}
                                                      >
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          /* If Not yet dispatched — Dispatch Controller */
                                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                            {/* Mode Tabs: only rendered if more than 1 delivery mode is enabled */}
                                            {availableModes.length > 1 && (
                                              <div style={{ display: "flex", gap: "4px", padding: "3px", background: "#f1f5f9", borderRadius: "6px" }}>
                                                {availableModes.map((mode) => (
                                                  <button
                                                    key={mode.id}
                                                    type="button"
                                                    onClick={() => setSelectedDispatchModeMap((p) => ({ ...p, [order.id]: mode.id }))}
                                                    style={{
                                                      flex: 1,
                                                      padding: "6px 8px",
                                                      borderRadius: "4px",
                                                      border: "none",
                                                      background: activeMode === mode.id ? "#ffffff" : "transparent",
                                                      color: activeMode === mode.id ? "#2563eb" : "#64748b",
                                                      fontWeight: 700,
                                                      fontSize: "12px",
                                                      cursor: "pointer",
                                                      boxShadow: activeMode === mode.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                                                    }}
                                                  >
                                                    {mode.label}
                                                  </button>
                                                ))}
                                              </div>
                                            )}

                                            {/* Mode 1: Own Fleet Agent Dropdown */}
                                            {activeMode === "own_agent" && (
                                              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                                <div>
                                                  <label style={labelStyle}>Assign Delivery Rider</label>
                                                  <select
                                                    value={selectedAgentMap[order.id] || ""}
                                                    onChange={(e) => setSelectedAgentMap((p) => ({ ...p, [order.id]: e.target.value }))}
                                                    style={{ ...inputStyle, cursor: "pointer" }}
                                                  >
                                                    <option value="">Auto-Assign (Least Busy Rider)</option>
                                                    {deliveryAgents
                                                      .filter((a) => a.is_active)
                                                      .map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                          {a.name} ({formatPhoneDisplay(a.phone)}) — {a.current_order_count} active orders
                                                        </option>
                                                      ))}
                                                  </select>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => handleDispatchOrder(order.id, "own_agent")}
                                                  disabled={actionLoadingId === order.id}
                                                  style={{
                                                    padding: "9px 14px",
                                                    borderRadius: "6px",
                                                    background: "#2563eb",
                                                    border: "1px solid #2563eb",
                                                    color: "#ffffff",
                                                    fontWeight: 700,
                                                    fontSize: "13px",
                                                    cursor: actionLoadingId === order.id ? "wait" : "pointer",
                                                  }}
                                                >
                                                  {actionLoadingId === order.id ? "Assigning Rider..." : "Assign Rider & Confirm Order"}
                                                </button>
                                              </div>
                                            )}

                                            {/* Mode 2: Shiprocket Auto Courier */}
                                            {activeMode === "shiprocket" && (() => {
                                               const defaultWeight = getOrderDefaultWeight(order);
                                               const currentWeight = packageWeightMap[order.id] !== undefined ? packageWeightMap[order.id] : defaultWeight;
                                               return (
                                                 <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                                   <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                                                     Auto-books courier pickup with Delhivery, BlueDart, DTDC, or Xpressbees and generates AWB tracking label.
                                                   </p>

                                                   <div>
                                                     <label style={{ ...labelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                       <span>Parcel Weight (Grams)</span>
                                                       <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "12px" }}>
                                                         {currentWeight > 0 ? `${(currentWeight / 1000).toFixed(2)} kg (${currentWeight} g)` : "0 g"}
                                                       </span>
                                                     </label>
                                                     <input
                                                       type="number"
                                                       min={10}
                                                       step={50}
                                                       placeholder="e.g. 500 (weight in grams)"
                                                       value={currentWeight || ""}
                                                       onChange={(e) =>
                                                         setPackageWeightMap((p) => ({
                                                           ...p,
                                                           [order.id]: Math.max(0, Number(e.target.value) || 0),
                                                         }))
                                                       }
                                                       style={inputStyle}
                                                     />
                                                     <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                                                       <span style={{ fontSize: "11px", color: "#059669", background: "rgba(16,185,129,0.1)", padding: "2px 7px", borderRadius: "4px", fontWeight: 600 }}>
                                                         ✓ Auto-calculated from product details
                                                       </span>
                                                       <span style={{ fontSize: "11px", color: "#64748b" }}>
                                                         (Editable before booking)
                                                       </span>
                                                     </div>
                                                   </div>

                                                   <button
                                                     type="button"
                                                     onClick={() => {
                                                       const weightToSend = packageWeightMap[order.id] !== undefined && packageWeightMap[order.id] > 0
                                                         ? packageWeightMap[order.id]
                                                         : defaultWeight;
                                                       if (!weightToSend || weightToSend <= 0) {
                                                         showToast("Please enter a valid parcel weight in grams", "error");
                                                         return;
                                                       }
                                                       handleDispatchOrder(order.id, "shiprocket", weightToSend);
                                                     }}
                                                     disabled={actionLoadingId === order.id}
                                                     style={{
                                                       padding: "9px 14px",
                                                       borderRadius: "6px",
                                                       background: "#2563eb",
                                                       border: "1px solid #2563eb",
                                                       color: "#ffffff",
                                                       fontWeight: 700,
                                                       fontSize: "13px",
                                                       cursor: actionLoadingId === order.id ? "wait" : "pointer",
                                                     }}
                                                   >
                                                     {actionLoadingId === order.id ? "Booking Courier..." : "Book Courier via Shiprocket"}
                                                   </button>
                                                 </div>
                                               );
                                             })()}

                                            {/* Mode 3: Manual partner entry */}
                                            {activeMode === "manual" && (
                                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                <div>
                                                  <div style={labelStyle}>Delivery Partner Name</div>
                                                  <input
                                                    value={shipmentDraft.deliveryPartnerName}
                                                    onChange={(e) =>
                                                      setShipmentDraftValue(order.id, "deliveryPartnerName", e.target.value)
                                                    }
                                                    placeholder="e.g. BlueDart / Local Courier"
                                                    style={inputStyle}
                                                  />
                                                </div>

                                                <div>
                                                  <div style={labelStyle}>Partner Phone / Tracking Number</div>
                                                  <input
                                                    value={shipmentDraft.deliveryPartnerPhone}
                                                    onChange={(e) =>
                                                      setShipmentDraftValue(order.id, "deliveryPartnerPhone", e.target.value)
                                                    }
                                                    placeholder="Contact number or AWB"
                                                    style={inputStyle}
                                                  />
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveShipment(order.id)}
                                                  disabled={actionLoadingId === order.id}
                                                  style={{
                                                    padding: "9px 14px",
                                                    borderRadius: "6px",
                                                    background: "#2563eb",
                                                    border: "1px solid #2563eb",
                                                    color: "#ffffff",
                                                    fontWeight: 700,
                                                    fontSize: "13px",
                                                    cursor: actionLoadingId === order.id ? "wait" : "pointer",
                                                  }}
                                                >
                                                  {actionLoadingId === order.id ? "Dispatching Order..." : "Save Details & Dispatch Order"}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Card 2: Timeline & Notes */}
                                <div style={{ ...plainCardStyle, padding: "16px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: "12px",
                                      paddingBottom: "8px",
                                      borderBottom: "1px solid #f1f5f9",
                                    }}
                                  >
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                      Order Timeline & Notes
                                    </span>
                                  </div>

                                  <div style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#475569" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#64748b" }}>Created:</span>
                                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(order.created_at)}</span>
                                    </div>
                                    {order.confirmed_at && (
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Confirmed:</span>
                                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(order.confirmed_at)}</span>
                                      </div>
                                    )}
                                    {order.shipped_at && (
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Shipped:</span>
                                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(order.shipped_at)}</span>
                                      </div>
                                    )}
                                    {order.delivered_at && (
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Delivered:</span>
                                        <span style={{ fontWeight: 600, color: "#15803d" }}>{formatDate(order.delivered_at)}</span>
                                      </div>
                                    )}
                                    {order.cancelled_at && (
                                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#64748b" }}>Cancelled:</span>
                                        <span style={{ fontWeight: 600, color: "#b91c1c" }}>{formatDate(order.cancelled_at)}</span>
                                      </div>
                                    )}
                                  </div>

                                  {detail?.cancel_reason ? (
                                    <div style={{ marginTop: "10px", padding: "8px 10px", background: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca", fontSize: "12.5px", color: "#991b1b" }}>
                                      <strong>Cancel Reason:</strong> {detail.cancel_reason}
                                    </div>
                                  ) : null}
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

          {/* Centered Pagination Controls */}
          {orders.length > 0 && (
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
        </>
      ) : (
        <>
          {/* Returns Subtabs (Clean Underline Filter Bar with Count Badges) */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: "16px",
            }}
          >
            {returnTabs.map((tab) => {
              const isActive = activeReturnTab === tab.key;
              const count = returnCounts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveReturnTab(tab.key);
                    setExpandedReturnId(null);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                    background: "transparent",
                    color: isActive ? "#2563eb" : "#64748b",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    marginBottom: "-1px",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: isActive ? "#eff6ff" : "#f1f5f9",
                      color: isActive ? "#2563eb" : "#64748b",
                      border: `1px solid ${isActive ? "#bfdbfe" : "#e2e8f0"}`,
                    }}
                  >
                    {count}
                  </span>
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
                {searchQuery ? "No returns match your search." : "No records in this tab."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Returns Table Header Bar */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(180px, 1.4fr) minmax(180px, 1.1fr) minmax(130px, 1fr) minmax(110px, 0.8fr) minmax(80px, auto) 28px",
                    gap: "12px",
                    padding: "10px 16px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <div>Customer & Return</div>
                  <div>Refund & Date</div>
                  <div>Delivery Partner</div>
                  <div>Status</div>
                  <div style={{ textAlign: "right" }}>Actions</div>
                  <div></div>
                </div>

                {paginatedReturns.map((returnItem) => {
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

                  const isOrderOnlinePaid = Boolean(
                    detail?.order?.razorpay_payment_id ||
                    (detail?.order?.payment_method &&
                      detail.order.payment_method.toLowerCase() !== "cod" &&
                      detail.order.payment_method.toLowerCase() !== "cash_on_delivery")
                  );

                  const defaultRefundMethod = detail?.refund_method || (isOrderOnlinePaid ? "original_payment" : "cod_refund");

                  const refundDraft: RefundDraft =
                    refundDrafts[returnItem.id] || {
                      refundMethod: defaultRefundMethod,
                      finalRefundAmount: String(returnItem.final_refund_amount || returnItem.suggested_refund_amount || ""),
                      refundOverrideReason: detail?.refund_override_reason || "",
                      adminNote: returnItem.admin_note || "",
                    };


                  return (
                    <div
                      key={returnItem.id}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: isExpanded ? "#f8fafc" : "#ffffff",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <div
                        onClick={() => handleReturnExpandToggle(returnItem.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(180px, 1.4fr) minmax(180px, 1.1fr) minmax(130px, 1fr) minmax(110px, 0.8fr) minmax(80px, auto) 28px",
                          gap: "12px",
                          alignItems: "center",
                          padding: "12px 16px",
                          cursor: "pointer",
                          background: isExpanded ? "#f1f5f9" : "transparent",
                          borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                          transition: "background 0.15s ease",
                        }}
                      >
                        {/* Col 1: Customer & Return Info */}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13.5px",
                              fontWeight: 700,
                              color: "#0f172a",
                              marginBottom: "2px",
                              display: "flex",
                              alignItems: "center",
                              gap: "7px",
                            }}
                          >
                            <span>{detail?.order?.shipping_address?.fullName || returnItem.customer_email || "Customer"}</span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#475569",
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                padding: "1px 5px",
                                borderRadius: "4px",
                              }}
                              title={`Full Return ID: ${returnItem.id}`}
                            >
                              Return #{returnItem.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748b",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span>Order #{returnItem.order_id.slice(0, 8).toUpperCase()}</span>
                            <span> • </span>
                            <span>
                              {detail?.items?.length || returnItem.item_count || 1} item
                              {(detail?.items?.length || returnItem.item_count || 1) > 1 ? "s" : ""} (
                              {returnItem.total_quantity_requested || 1} qty)
                            </span>
                            {returnItem.request_note ? (
                              <>
                                <span> • </span>
                                <span style={{ fontStyle: "italic" }}>
                                  "{returnItem.request_note.slice(0, 24)}
                                  {returnItem.request_note.length > 24 ? "..." : ""}"
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Col 2: Amount & Date */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "13.5px", color: "#0f172a", fontWeight: 700 }}>
                              {formatPrice(detail?.final_refund_amount || returnItem.final_refund_amount || returnItem.suggested_refund_amount)}
                            </span>
                            {returnItem.refund_status && (
                              <span
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  background:
                                    returnItem.refund_status === "completed"
                                      ? "#dcfce7"
                                      : returnItem.refund_status === "pending"
                                      ? "#fffbeb"
                                      : "#f1f5f9",
                                  color:
                                    returnItem.refund_status === "completed"
                                      ? "#15803d"
                                      : returnItem.refund_status === "pending"
                                      ? "#b45309"
                                      : "#475569",
                                  border: `1px solid ${
                                    returnItem.refund_status === "completed"
                                      ? "#bbf7d0"
                                      : returnItem.refund_status === "pending"
                                      ? "#fde68a"
                                      : "#e2e8f0"
                                  }`,
                                  textTransform: "uppercase",
                                }}
                              >
                                {returnItem.refund_status.replaceAll("_", " ")}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                            {formatDate(returnItem.created_at)}
                          </div>
                        </div>

                        {/* Col 3: Reverse Pickup Partner Pill (NEW) */}
                        <div style={{ minWidth: 0 }}>
                          {returnItem.pickup_details?.agent_name ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background:
                                    returnItem.pickup_details.pickup_status === "picked_up" ||
                                    returnItem.pickup_details.pickup_status === "delivered_to_hub"
                                      ? "#16a34a"
                                      : "#7c3aed",
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {returnItem.pickup_details.agent_name}
                                <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "4px", fontWeight: 500 }}>
                                  ({(returnItem.pickup_details.pickup_status || "assigned").replaceAll("_", " ")})
                                </span>
                              </span>
                            </div>
                          ) : returnItem.pickup_details?.courier_name ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />
                              <span
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {returnItem.pickup_details.courier_name}
                              </span>
                            </div>
                          ) : returnItem.status === "approved" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ea580c", flexShrink: 0 }} />
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#c2410c" }}>
                                Pickup Unassigned
                              </span>
                            </div>
                          ) : returnItem.status === "requested" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "#1d4ed8" }}>
                                Review Pending
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                          )}
                        </div>

                        {/* Col 4: Status Badge */}
                        <div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "5px 9px",
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

                        {/* Col 5: Actions */}
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

                        {/* Col 6: Chevron */}
                        <div style={{ color: "#94a3b8", display: "grid", placeItems: "center" }}>
                          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </div>
                      </div>


                      {isExpanded ? (
                        <div style={{ padding: "16px 18px 20px", background: "#f8fafc" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                              gap: "16px",
                              alignItems: "start",
                            }}
                          >
                            {/* Left Column: Customer Details, Pickup Address & Return Items */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                              {/* Card 1: Customer & Original Order Information */}
                              <div style={{ ...plainCardStyle, padding: "16px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "12px",
                                    paddingBottom: "8px",
                                    borderBottom: "1px solid #f1f5f9",
                                  }}
                                >
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Customer & Pickup Address
                                  </span>
                                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                                    Order #{returnItem.order_id.slice(0, 8).toUpperCase()}
                                  </span>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                    {detail?.order?.shipping_address?.fullName || "Customer"}
                                  </div>

                                  <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "2px" }}>
                                      Pickup Address:
                                    </div>
                                    <div>{detail?.order?.shipping_address?.addressLine1 || "—"}</div>
                                    <div>
                                      {[detail?.order?.shipping_address?.city, detail?.order?.shipping_address?.postalCode].filter(Boolean).join(" - ") || "—"}
                                    </div>
                                    {(detail?.order?.shipping_address?.latitude && detail?.order?.shipping_address?.longitude) ? (
                                      <div style={{ marginTop: "6px", paddingTop: "4px" }}>
                                        <a
                                          href={`https://www.google.com/maps?q=${detail.order.shipping_address.latitude},${detail.order.shipping_address.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            color: "#2563eb",
                                            textDecoration: "none",
                                            background: "#eff6ff",
                                            border: "1px solid #bfdbfe",
                                            borderRadius: "4px",
                                            padding: "2px 8px",
                                          }}
                                        >
                                          📍 Open Exact Pinned Location on Maps
                                        </a>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                                    {detail?.order?.shipping_address?.mobileNumber && (
                                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <PhoneIcon />
                                        <a
                                          href={`tel:${detail.order.shipping_address.mobileNumber}`}
                                          style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                                        >
                                          {formatPhoneDisplay(detail.order.shipping_address.mobileNumber)}
                                        </a>
                                      </div>
                                    )}
                                    {detail?.order?.shipping_address?.email && (
                                      <div style={{ color: "#64748b" }}>
                                        {detail.order.shipping_address.email}
                                      </div>
                                    )}
                                  </div>

                                  {returnItem.request_note && (
                                    <div style={{ marginTop: "6px", padding: "8px 10px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12.5px", color: "#334155" }}>
                                      <span style={{ fontWeight: 600, color: "#0f172a" }}>Customer Reason Note:</span> "{returnItem.request_note}"
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card 2: Return Items & Refund Account */}
                              <div style={{ ...plainCardStyle, padding: "16px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "12px",
                                    paddingBottom: "8px",
                                    borderBottom: "1px solid #f1f5f9",
                                  }}
                                >
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Return Items ({detail?.items?.length || returnItem.item_count || 1})
                                  </span>
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                                    Refund: {formatPrice(detail?.final_refund_amount || returnItem.final_refund_amount || returnItem.suggested_refund_amount)}
                                  </span>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {(detail?.items || []).map((item) => (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: "12px",
                                        padding: "10px 12px",
                                        borderRadius: "6px",
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                      }}
                                    >
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                                          {item.product_name}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                                            Req: {item.quantity_requested}
                                          </span>
                                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "1px 6px", borderRadius: "4px" }}>
                                            Appr: {item.quantity_approved}
                                          </span>
                                          {item.quantity_received !== undefined && item.quantity_received !== null && (
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: item.quantity_received >= item.quantity_approved ? "#15803d" : "#b45309", background: item.quantity_received >= item.quantity_approved ? "#ecfdf5" : "#fffbeb", padding: "1px 6px", borderRadius: "4px", border: `1px solid ${item.quantity_received >= item.quantity_approved ? "#a7f3d0" : "#fde68a"}` }}>
                                              Rider Picked: {item.quantity_received}
                                            </span>
                                          )}
                                          {(item.selected_variant_label || item.selected_variant_value) && (
                                            <span
                                              style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                color: "#7c3aed",
                                                background: "#f5f3ff",
                                                border: "1px solid #e9d5ff",
                                                padding: "1px 6px",
                                                borderRadius: "4px",
                                              }}
                                            >
                                              {item.selected_variant_value}
                                            </span>
                                          )}
                                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                                            • Reason: {item.reason_code.replaceAll("_", " ")}
                                          </span>
                                        </div>
                                      </div>
                                      <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                                        {formatPrice(item.line_refund_final)}
                                      </div>
                                    </div>
                                  ))}
                                  {/* Customer Refund Account: For COD orders, show Bank/UPI info */}
                                  {(detail?.order?.payment_method === "cod" || detail?.order?.payment_method === "cash_on_delivery") && (detail?.customer_refund_account || returnItem.customer_refund_account) && (
                                    <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span>Customer Refund Destination (COD Payout):</span>
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
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {detail?.order?.payment_method && detail.order.payment_method !== "cod" && detail.order.payment_method !== "cash_on_delivery" && (
                                    <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 10px", borderRadius: "6px", fontSize: "12px", color: "#166534" }}>
                                        <span><strong>Online Payment ({detail.order.payment_method}):</strong> Refund is automatically credited back to customer's original payment source via Razorpay.</span>
                                      </div>
                                    </div>
                                  )}

                                  {detail?.refund_breakdown && (
                                    <div
                                      style={{
                                        marginTop: "12px",
                                        padding: "10px 12px",
                                        borderRadius: "6px",
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        fontSize: "12px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          marginBottom: "8px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.04em",
                                        }}
                                      >
                                        <span>Refund Breakdown</span>
                                        <span style={{ fontSize: "10px", color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                                          Prorated
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                                          <span>Items Subtotal</span>
                                          <span style={{ fontWeight: 600, color: "#0f172a" }}>+{formatPrice(detail.refund_breakdown.items_subtotal)}</span>
                                        </div>
                                        {detail.refund_breakdown.discounts_prorated > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                                            <span>Discount</span>
                                            <span style={{ fontWeight: 600, color: "#dc2626" }}>-{formatPrice(detail.refund_breakdown.discounts_prorated)}</span>
                                          </div>
                                        )}
                                        {detail.refund_breakdown.tax_refund > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                                            <span>Tax (GST)</span>
                                            <span style={{ fontWeight: 600, color: "#0f172a" }}>+{formatPrice(detail.refund_breakdown.tax_refund)}</span>
                                          </div>
                                        )}
                                        {detail.refund_breakdown.refundable_charges_added > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                                            <span>Refundable Charges</span>
                                            <span style={{ fontWeight: 600, color: "#0f172a" }}>+{formatPrice(detail.refund_breakdown.refundable_charges_added)}</span>
                                          </div>
                                        )}
                                        {detail.refund_breakdown.non_refundable_charges_retained > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                                            <span>Non-Refundable Retained</span>
                                            <span style={{ fontWeight: 600, color: "#dc2626" }}>-{formatPrice(detail.refund_breakdown.non_refundable_charges_retained)}</span>
                                          </div>
                                        )}
                                        {(detail.refund_breakdown.exception_refund_added || 0) > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#15803d", fontWeight: 600, background: "#f0fdf4", padding: "4px 6px", borderRadius: "4px" }}>
                                            <span>Retained Charges Refunded (Exception)</span>
                                            <span style={{ fontWeight: 700 }}>+{formatPrice(detail.refund_breakdown.exception_refund_added || 0)}</span>
                                          </div>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "6px", marginTop: "2px", fontWeight: 700, fontSize: "12.5px" }}>
                                          <span>Total Refund</span>
                                          <span style={{ color: "#15803d" }}>
                                            {formatPrice(detail.final_refund_amount || returnItem.final_refund_amount || returnItem.suggested_refund_amount)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                            </div>

                            {/* Right Column: Reverse Logistics Control & Admin Action Center */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                              {/* Card 1: Reverse Pickup & Fleet Dispatch Center (NEW) */}
                              <div style={{ ...plainCardStyle, padding: "16px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "12px",
                                    paddingBottom: "8px",
                                    borderBottom: "1px solid #f1f5f9",
                                  }}
                                >
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Reverse Logistics & Pickup
                                  </span>
                                  {(detail?.pickup_details || returnItem.pickup_details) ? (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        background: "#eff6ff",
                                        color: "#1d4ed8",
                                        border: "1px solid #bfdbfe",
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      Pickup: {(detail?.pickup_details?.pickup_status || returnItem.pickup_details?.pickup_status || "Assigned").replaceAll("_", " ")}
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        background: returnItem.status === "approved" ? "#fff7ed" : returnItem.status === "requested" ? "#f1f5f9" : "#f0fdf4",
                                        color: returnItem.status === "approved" ? "#c2410c" : returnItem.status === "requested" ? "#64748b" : "#15803d",
                                        border: `1px solid ${returnItem.status === "approved" ? "#ffedd5" : returnItem.status === "requested" ? "#e2e8f0" : "#bbf7d0"}`,
                                      }}
                                    >
                                      {returnItem.status === "approved"
                                        ? "Pending Reverse Pickup"
                                        : returnItem.status === "requested"
                                        ? "Awaiting Review"
                                        : "Received at Hub"}
                                    </span>
                                  )}
                                </div>

                                {(() => {
                                   const currentPickup = detail?.pickup_details || returnItem.pickup_details;
                                   const isFleetOn = deliverySettings?.enable_fleet !== undefined ? Boolean(deliverySettings.enable_fleet) : (deliverySettings?.delivery_mode === "own_agent" || deliverySettings?.delivery_mode === "hybrid");
                                   const isShiprocketOn = deliverySettings?.enable_shiprocket !== undefined ? Boolean(deliverySettings.enable_shiprocket) : (deliverySettings?.delivery_mode === "shiprocket" || deliverySettings?.delivery_mode === "hybrid");
                                   const isManualOn = deliverySettings?.enable_manual !== undefined ? Boolean(deliverySettings.enable_manual) : (deliverySettings?.delivery_mode === "manual");

                                   const availableReturnModes: Array<{ id: "own_agent" | "shiprocket" | "manual"; label: string }> = [];
                                   if (isFleetOn) availableReturnModes.push({ id: "own_agent", label: "In-House Rider" });
                                   if (isShiprocketOn) availableReturnModes.push({ id: "shiprocket", label: "Shiprocket" });
                                   if (isManualOn) availableReturnModes.push({ id: "manual", label: "Manual" });

                                   if (availableReturnModes.length === 0) {
                                     availableReturnModes.push({ id: "manual", label: "Manual" });
                                   }

                                   const activeReturnMode: "own_agent" | "shiprocket" | "manual" = (
                                     selectedReturnDispatchModeMap[returnItem.id] && availableReturnModes.some((m) => m.id === selectedReturnDispatchModeMap[returnItem.id])
                                       ? selectedReturnDispatchModeMap[returnItem.id]
                                       : availableReturnModes[0].id
                                   ) as "own_agent" | "shiprocket" | "manual";
                                   const isReassigningReturn = Boolean(reassigningReturnIdMap[returnItem.id]);

                                  return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                      {/* If already assigned pickup */}
                                      {currentPickup?.agent_name || currentPickup?.courier_name ? (
                                        (() => {
                                          const isManualReturn = currentPickup.mode === "manual" || (!currentPickup.agent_name && Boolean(currentPickup.courier_name));
                                          const isFleetReturn = currentPickup.mode === "own_agent" || Boolean(currentPickup.agent_name);
                                          const isShiprocketReturn = currentPickup.mode === "shiprocket";
                                          const isEditingReturnCourier = Boolean(editingReturnCourierMap[returnItem.id]);

                                          if (isManualReturn) {
                                            return (
                                              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                      Manual Return Courier Partner
                                                    </span>
                                                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: "#e0f2fe", color: "#0369a1" }}>
                                                      Self-Ship / Courier
                                                    </span>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingReturnCourierMap((p) => ({ ...p, [returnItem.id]: !p[returnItem.id] }));
                                                      if (!returnManualCourierMap[returnItem.id]) {
                                                        setReturnManualCourierMap((p) => ({
                                                          ...p,
                                                          [returnItem.id]: {
                                                            courierName: currentPickup.courier_name || "",
                                                            trackingNumber: currentPickup.tracking_number || "",
                                                            notes: currentPickup.pickup_notes || "",
                                                          },
                                                        }));
                                                      }
                                                    }}
                                                    style={{
                                                      background: "none",
                                                      border: "none",
                                                      color: "#2563eb",
                                                      fontSize: "12px",
                                                      fontWeight: 600,
                                                      cursor: "pointer",
                                                      padding: "0",
                                                      textDecoration: "underline",
                                                    }}
                                                  >
                                                    {isEditingReturnCourier ? "Cancel Edit" : "Edit Courier / Tracking"}
                                                  </button>
                                                </div>

                                                {isEditingReturnCourier ? (
                                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                                                    <div>
                                                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Return Courier Name</label>
                                                      <input
                                                        value={returnManualCourierMap[returnItem.id]?.courierName ?? (currentPickup.courier_name || "")}
                                                        onChange={(e) =>
                                                          setReturnManualCourierMap((p) => ({
                                                            ...p,
                                                            [returnItem.id]: {
                                                              courierName: e.target.value,
                                                              trackingNumber: p[returnItem.id]?.trackingNumber ?? (currentPickup.tracking_number || ""),
                                                              notes: p[returnItem.id]?.notes ?? (currentPickup.pickup_notes || ""),
                                                            },
                                                          }))
                                                        }
                                                        placeholder="e.g. DTDC Return, BlueDart, India Post"
                                                        style={{ ...inputStyle, fontSize: "13px" }}
                                                      />
                                                    </div>
                                                    <div>
                                                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Tracking / AWB Number</label>
                                                      <input
                                                        value={returnManualCourierMap[returnItem.id]?.trackingNumber ?? (currentPickup.tracking_number || "")}
                                                        onChange={(e) =>
                                                          setReturnManualCourierMap((p) => ({
                                                            ...p,
                                                            [returnItem.id]: {
                                                              trackingNumber: e.target.value,
                                                              courierName: p[returnItem.id]?.courierName ?? (currentPickup.courier_name || ""),
                                                              notes: p[returnItem.id]?.notes ?? (currentPickup.pickup_notes || ""),
                                                            },
                                                          }))
                                                        }
                                                        placeholder="e.g. DTDC98234823"
                                                        style={{ ...inputStyle, fontSize: "13px" }}
                                                      />
                                                    </div>
                                                    <div>
                                                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Pickup / Handover Notes (Optional)</label>
                                                      <input
                                                        value={returnManualCourierMap[returnItem.id]?.notes ?? (currentPickup.pickup_notes || "")}
                                                        onChange={(e) =>
                                                          setReturnManualCourierMap((p) => ({
                                                            ...p,
                                                            [returnItem.id]: {
                                                              notes: e.target.value,
                                                              courierName: p[returnItem.id]?.courierName ?? (currentPickup.courier_name || ""),
                                                              trackingNumber: p[returnItem.id]?.trackingNumber ?? (currentPickup.tracking_number || ""),
                                                            },
                                                          }))
                                                        }
                                                        placeholder="e.g. Customer shipped via Speed Post"
                                                        style={{ ...inputStyle, fontSize: "13px" }}
                                                      />
                                                    </div>
                                                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleDispatchReturnPickup(returnItem.id, "manual")}
                                                        disabled={actionLoadingId === returnItem.id}
                                                        style={{
                                                          padding: "7px 14px",
                                                          borderRadius: "6px",
                                                          background: "#2563eb",
                                                          color: "#ffffff",
                                                          border: "none",
                                                          fontSize: "12px",
                                                          fontWeight: 700,
                                                          cursor: "pointer",
                                                        }}
                                                      >
                                                        {actionLoadingId === returnItem.id ? "Saving..." : "Save Courier Details"}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setEditingReturnCourierMap((p) => ({ ...p, [returnItem.id]: false }))}
                                                        style={{
                                                          padding: "7px 12px",
                                                          borderRadius: "6px",
                                                          background: "#ffffff",
                                                          color: "#475569",
                                                          border: "1px solid #cbd5e1",
                                                          fontSize: "12px",
                                                          fontWeight: 600,
                                                          cursor: "pointer",
                                                        }}
                                                      >
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                                      {currentPickup.courier_name || "Manual Courier / Self Ship"}
                                                    </div>
                                                    {currentPickup.tracking_number ? (
                                                      <div style={{ fontSize: "12.5px", color: "#475569" }}>
                                                        AWB / Tracking: <strong style={{ color: "#0f172a" }}>{currentPickup.tracking_number}</strong>
                                                      </div>
                                                    ) : (
                                                      <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                                                        No tracking number provided
                                                      </div>
                                                    )}
                                                    {currentPickup.pickup_notes && (
                                                      <div style={{ marginTop: "4px", fontSize: "12px", color: "#92400e", background: "#fffbeb", padding: "6px 8px", borderRadius: "4px", border: "1px solid #fde68a" }}>
                                                        {currentPickup.pickup_notes}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }

                                          if (isFleetReturn) {
                                            return (
                                              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                                    Store Delivery Partner (Own Fleet)
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => setReassigningReturnIdMap((p) => ({ ...p, [returnItem.id]: !p[returnItem.id] }))}
                                                    style={{
                                                      background: "none",
                                                      border: "none",
                                                      color: "#2563eb",
                                                      fontSize: "12px",
                                                      fontWeight: 600,
                                                      cursor: "pointer",
                                                      padding: "0",
                                                      textDecoration: "underline",
                                                    }}
                                                  >
                                                    {isReassigningReturn ? "Close" : "Reassign / Switch Partner"}
                                                  </button>
                                                </div>

                                                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                                  {currentPickup.agent_name}
                                                  {currentPickup.agent_phone && (
                                                    <div style={{ fontSize: "13px", color: "#475569", marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                                                      <PhoneIcon />
                                                      <a href={`tel:${currentPickup.agent_phone}`} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                                                        {formatPhoneDisplay(currentPickup.agent_phone)}
                                                      </a>
                                                    </div>
                                                  )}
                                                  {/* Level 1 Doorstep Physical Inspection Result */}
                                                  {(currentPickup.inspection_result === "failed" || currentPickup.pickup_status === "doorstep_rejected") ? (
                                                    <div style={{ marginTop: "8px", fontSize: "12px", color: "#991b1b", background: "#fef2f2", padding: "8px 10px", borderRadius: "6px", border: "1px solid #fecaca", lineHeight: 1.4 }}>
                                                      <div style={{ fontWeight: 700 }}>Doorstep Inspection Failed by Rider</div>
                                                      {currentPickup.inspection_failed_reason && <div>Reason: <strong>{currentPickup.inspection_failed_reason}</strong></div>}
                                                      {currentPickup.inspection_notes && <div>Rider Note: {currentPickup.inspection_notes}</div>}
                                                    </div>
                                                  ) : (currentPickup.pickup_status === "picked_up" || currentPickup.pickup_status === "delivered_to_hub") ? (
                                                    <div style={{ marginTop: "8px", fontSize: "12px", color: "#15803d", background: "#f0fdf4", padding: "6px 8px", borderRadius: "6px", border: "1px solid #bbf7d0", fontWeight: 600 }}>
                                                      Level 1 Doorstep Physical Inspection Passed
                                                    </div>
                                                  ) : null}
                                                  {currentPickup.pickup_notes && (
                                                    <div style={{ marginTop: "6px", fontSize: "12px", color: "#92400e", background: "#fffbeb", padding: "6px 8px", borderRadius: "4px", border: "1px solid #fde68a" }}>
                                                      {currentPickup.pickup_notes}
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Reassign Return Rider / Switch to Manual Panel */}
                                                {isReassigningReturn && (
                                                  <div style={{ marginTop: "12px", padding: "12px", background: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", flexDirection: "column", gap: "12px" }}>
                                                    {/* Option 1: In-House Rider Reassignment */}
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                                                        Option 1: Choose Replacement Rider
                                                      </label>
                                                      <select
                                                        value={reassignReturnAgentIdMap[returnItem.id] || ""}
                                                        onChange={(e) => setReassignReturnAgentIdMap((p) => ({ ...p, [returnItem.id]: e.target.value }))}
                                                        style={{ ...inputStyle, fontSize: "13px" }}
                                                      >
                                                        <option value="">-- Choose Rider --</option>
                                                        {deliveryAgents.filter((a) => a.is_active).map((a) => (
                                                          <option key={a.id} value={a.id}>
                                                            {a.name} ({formatPhoneDisplay(a.phone)}) — {a.current_order_count} active orders
                                                          </option>
                                                        ))}
                                                      </select>
                                                      <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleReassignReturnRider(returnItem.id)}
                                                          disabled={actionLoadingId === returnItem.id || !reassignReturnAgentIdMap[returnItem.id]}
                                                          style={{ padding: "6px 12px", borderRadius: "5px", background: "#2563eb", color: "#ffffff", border: "none", fontSize: "12px", fontWeight: 700, cursor: "pointer", opacity: !reassignReturnAgentIdMap[returnItem.id] ? 0.6 : 1 }}
                                                        >
                                                          {actionLoadingId === returnItem.id ? "Reassigning..." : "Confirm Reassign"}
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* Option 2: Switch to Manual Courier */}
                                                    <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                                                        Option 2: Switch to Manual Return Courier
                                                      </label>
                                                      <input
                                                        value={returnManualCourierMap[returnItem.id]?.courierName || ""}
                                                        onChange={(e) =>
                                                          setReturnManualCourierMap((p) => ({
                                                            ...p,
                                                            [returnItem.id]: {
                                                              courierName: e.target.value,
                                                              trackingNumber: p[returnItem.id]?.trackingNumber || "",
                                                              notes: p[returnItem.id]?.notes || "",
                                                            },
                                                          }))
                                                        }
                                                        placeholder="Courier Name (e.g. DTDC Return, Customer Self-Ship)"
                                                        style={{ ...inputStyle, fontSize: "13px" }}
                                                      />
                                                      <input
                                                        value={returnManualCourierMap[returnItem.id]?.trackingNumber || ""}
                                                        onChange={(e) =>
                                                          setReturnManualCourierMap((p) => ({
                                                            ...p,
                                                            [returnItem.id]: {
                                                              trackingNumber: e.target.value,
                                                              courierName: p[returnItem.id]?.courierName || "",
                                                              notes: p[returnItem.id]?.notes || "",
                                                            },
                                                          }))
                                                        }
                                                        placeholder="Tracking / AWB Number (Optional)"
                                                        style={{ ...inputStyle, fontSize: "13px" }}
                                                      />
                                                      <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                                                        <button
                                                          type="button"
                                                          onClick={() => handleSwitchReturnToManual(returnItem.id)}
                                                          disabled={actionLoadingId === returnItem.id}
                                                          style={{ padding: "6px 12px", borderRadius: "5px", background: "#059669", color: "#ffffff", border: "none", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                                                        >
                                                          {actionLoadingId === returnItem.id ? "Switching..." : "Switch to Manual Courier"}
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => setReassigningReturnIdMap((p) => ({ ...p, [returnItem.id]: false }))}
                                                          style={{ padding: "6px 10px", borderRadius: "5px", background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                                                        >
                                                          Cancel
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }

                                          if (isShiprocketReturn) {
                                            return (
                                              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
                                                  Shiprocket Reverse Logistics
                                                </div>
                                                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                                  {currentPickup.courier_name}
                                                </div>
                                                {currentPickup.tracking_number && (
                                                  <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                                                    AWB: <strong>{currentPickup.tracking_number}</strong>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }

                                          return null;
                                        })()
                                      ) : (returnItem.status === "rejected" || detail?.status === "rejected") ? (
                                        <div style={{ padding: "10px 12px", background: "#fef2f2", color: "#991b1b", borderRadius: "6px", fontSize: "12px", border: "1px solid #fecaca", fontWeight: 600 }}>
                                          Return request is rejected. Reverse logistics is disabled.
                                        </div>
                                      ) : (
                                        /* If Not assigned and return is approved or requested */
                                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                          {/* Mode Tabs: only rendered if more than 1 delivery mode is enabled */}
                                          {availableReturnModes.length > 1 && (
                                            <div style={{ display: "flex", gap: "4px", padding: "3px", background: "#f1f5f9", borderRadius: "6px" }}>
                                              {availableReturnModes.map((mode) => (
                                                <button
                                                  key={mode.id}
                                                  type="button"
                                                  onClick={() => setSelectedReturnDispatchModeMap((p) => ({ ...p, [returnItem.id]: mode.id }))}
                                                  style={{
                                                    flex: 1,
                                                    padding: "6px 8px",
                                                    borderRadius: "4px",
                                                    border: "none",
                                                    background: activeReturnMode === mode.id ? "#ffffff" : "transparent",
                                                    color: activeReturnMode === mode.id ? "#2563eb" : "#64748b",
                                                    fontWeight: 700,
                                                    fontSize: "12px",
                                                    cursor: "pointer",
                                                    boxShadow: activeReturnMode === mode.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                                                  }}
                                                >
                                                  {mode.label}
                                                </button>
                                              ))}
                                            </div>
                                          )}

                                          {/* Mode 1: In-House Rider Selection */}
                                          {activeReturnMode === "own_agent" && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                              <div>
                                                <label style={labelStyle}>Assign Delivery Fleet Rider for Pickup</label>
                                                <select
                                                  value={selectedReturnAgentMap[returnItem.id] || ""}
                                                  onChange={(e) => setSelectedReturnAgentMap((p) => ({ ...p, [returnItem.id]: e.target.value }))}
                                                  style={{ ...inputStyle, cursor: "pointer" }}
                                                >
                                                  <option value="">Auto-Assign (Least Busy Rider)</option>
                                                  {deliveryAgents
                                                    .filter((a) => a.is_active)
                                                    .map((a) => (
                                                      <option key={a.id} value={a.id}>
                                                        {a.name} ({formatPhoneDisplay(a.phone)}) — {a.current_order_count} active orders
                                                      </option>
                                                    ))}
                                                </select>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() => handleDispatchReturnPickup(returnItem.id, "own_agent")}
                                                disabled={actionLoadingId === returnItem.id}
                                                style={{
                                                  padding: "9px 14px",
                                                  borderRadius: "6px",
                                                  background: "#2563eb",
                                                  border: "1px solid #2563eb",
                                                  color: "#ffffff",
                                                  fontWeight: 700,
                                                  fontSize: "13px",
                                                  cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                                }}
                                              >
                                                {actionLoadingId === returnItem.id ? "Assigning..." : "Assign Rider for Return Pickup & Inspection"}
                                              </button>
                                            </div>
                                          )}

                                          {/* Mode 2: Shiprocket Reverse Pickup */}
                                          {activeReturnMode === "shiprocket" && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                              <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                                                Generates reverse courier pickup via Shiprocket (Delhivery, BlueDart, DTDC).
                                              </p>
                                              <button
                                                type="button"
                                                onClick={() => handleDispatchReturnPickup(returnItem.id, "shiprocket")}
                                                disabled={actionLoadingId === returnItem.id}
                                                style={{
                                                  padding: "9px 14px",
                                                  borderRadius: "6px",
                                                  background: "#2563eb",
                                                  border: "1px solid #2563eb",
                                                  color: "#ffffff",
                                                  fontWeight: 700,
                                                  fontSize: "13px",
                                                  cursor: actionLoadingId === returnItem.id ? "wait" : "pointer",
                                                }}
                                              >
                                                {actionLoadingId === returnItem.id ? "Booking..." : "Book Shiprocket Reverse Pickup"}
                                              </button>
                                            </div>
                                          )}

                                          {/* Mode 3: Manual Courier Return */}
                                          {activeReturnMode === "manual" && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                              <div>
                                                <div style={labelStyle}>Return Courier Name</div>
                                                <input
                                                  value={returnManualCourierMap[returnItem.id]?.courierName || ""}
                                                  onChange={(e) =>
                                                    setReturnManualCourierMap((p) => ({
                                                      ...p,
                                                      [returnItem.id]: {
                                                        ...p[returnItem.id],
                                                        courierName: e.target.value,
                                                        trackingNumber: p[returnItem.id]?.trackingNumber || "",
                                                        notes: p[returnItem.id]?.notes || "",
                                                      },
                                                    }))
                                                  }
                                                  placeholder="e.g. DTDC Return, Customer Self-Ship"
                                                  style={inputStyle}
                                                />
                                              </div>
                                              <div>
                                                <div style={labelStyle}>Tracking / AWB Number</div>
                                                <input
                                                  value={returnManualCourierMap[returnItem.id]?.trackingNumber || ""}
                                                  onChange={(e) =>
                                                    setReturnManualCourierMap((p) => ({
                                                      ...p,
                                                      [returnItem.id]: {
                                                        ...p[returnItem.id],
                                                        trackingNumber: e.target.value,
                                                        courierName: p[returnItem.id]?.courierName || "",
                                                        notes: p[returnItem.id]?.notes || "",
                                                      },
                                                    }))
                                                  }
                                                  placeholder="e.g. DTDC98234823"
                                                  style={inputStyle}
                                                />
                                              </div>
                                              <div>
                                                <div style={labelStyle}>Pickup / Handover Notes (Optional)</div>
                                                <input
                                                  value={returnManualCourierMap[returnItem.id]?.notes || ""}
                                                  onChange={(e) =>
                                                    setReturnManualCourierMap((p) => ({
                                                      ...p,
                                                      [returnItem.id]: {
                                                        ...p[returnItem.id],
                                                        notes: e.target.value,
                                                        courierName: p[returnItem.id]?.courierName || "",
                                                        trackingNumber: p[returnItem.id]?.trackingNumber || "",
                                                      },
                                                    }))
                                                  }
                                                  placeholder="e.g. Customer returned via speed post"
                                                  style={inputStyle}
                                                />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => handleDispatchReturnPickup(returnItem.id, "manual")}
                                                disabled={actionLoadingId === returnItem.id}
                                                style={{
                                                  padding: "8px 12px",
                                                  borderRadius: "6px",
                                                  background: "#2563eb",
                                                  border: "1px solid #2563eb",
                                                  color: "#ffffff",
                                                  fontWeight: 700,
                                                  fontSize: "13px",
                                                  cursor: "pointer",
                                                }}
                                              >
                                                Save Return Courier Details
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Card 2: Return Lifecycle Admin Action */}
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
                                      Approve Return
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
                                      Reject Return
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
                                (() => {
                                  const pickupInfo = detail?.pickup_details || returnItem.pickup_details;
                                  const isFleetRiderPickup = pickupInfo?.mode === "own_agent" && Boolean(pickupInfo.agent_name);

                                  if (isFleetRiderPickup) {
                                    return (
                                      <div style={{ ...plainCardStyle, padding: "16px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center" }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <rect x="1" y="3" width="15" height="13" />
                                              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                                              <circle cx="5.5" cy="18.5" r="2.5" />
                                              <circle cx="18.5" cy="18.5" r="2.5" />
                                            </svg>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                              Reverse Pickup In Progress
                                            </div>
                                            <div style={{ fontSize: "12px", color: "#64748b" }}>
                                              Assigned to rider <strong>{pickupInfo.agent_name}</strong>.
                                            </div>
                                          </div>
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5, background: "#ffffff", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                          The delivery rider will inspect and collect the items at the doorstep. Once handed over at the store/hub, <strong>Quality Inspection & Restock</strong> will activate automatically.
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div style={{ ...plainCardStyle, padding: "16px" }}>
                                      <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px", color: "#0f172a" }}>
                                        In-Store Package Receipt & Verification
                                      </div>
                                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
                                        {pickupInfo?.courier_name
                                          ? `Package returned via ${pickupInfo.courier_name}. Verify received quantities to proceed to Quality Inspection & Restock.`
                                          : "Confirm physical arrival if customer returned item directly to the store/hub."}
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
                                          placeholder="e.g. Package received at store warehouse in good condition..."
                                          style={{ ...inputStyle, minHeight: "56px", resize: "vertical" }}
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
                                        {actionLoadingId === returnItem.id ? "Receiving Package..." : "Confirm Package Received at Hub"}
                                      </button>
                                    </div>
                                  );
                                })()
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
                                      const isZeroReceived = Number(item.quantity_received || 0) === 0;
                                      const currentDecision =
                                        inspectDraft.restockDecisionByItem[item.id] || (isZeroReceived ? "discard" : "restock");
                                      const restockQty = isZeroReceived ? 0 : (inspectDraft.restockQuantityByItem[item.id] ?? item.quantity_received);

                                      return (
                                        <div
                                          key={item.id}
                                          style={{
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            background: isZeroReceived ? "#fef2f2" : "#f8fafc",
                                            border: `1px solid ${isZeroReceived ? "#fecaca" : "#e2e8f0"}`,
                                            display: "grid",
                                            gap: "8px",
                                          }}
                                        >
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", fontWeight: 700 }}>
                                            <span style={{ color: "#0f172a" }}>{item.product_name}</span>
                                            {isZeroReceived ? (
                                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", background: "#fee2e2", border: "1px solid #fca5a5", padding: "2px 7px", borderRadius: "4px" }}>
                                                Unreturned at Doorstep (0 Recv)
                                              </span>
                                            ) : (
                                              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#166534", background: "#dcfce7", border: "1px solid #bbf7d0", padding: "2px 7px", borderRadius: "4px" }}>
                                                Received at Hub: {item.quantity_received}
                                              </span>
                                            )}
                                          </div>

                                          {isZeroReceived ? (
                                            <div style={{ fontSize: "12px", color: "#7f1d1d", background: "#ffffff", padding: "7px 10px", borderRadius: "4px", border: "1px solid #fecaca", lineHeight: 1.4 }}>
                                              Rider verified <strong>0 units</strong> received at customer doorstep (missing or rejected). Marked as <strong>Discard (0 Restock)</strong>.
                                            </div>
                                          ) : (
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
                                                  <option value="restock">Restock (Return to Inventory)</option>
                                                  <option value="discard">Discard (Damaged / Unsellable)</option>
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
                                          )}
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
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: "12px",
                                      paddingBottom: "8px",
                                      borderBottom: "1px solid #f1f5f9",
                                    }}
                                  >
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                      Process Customer Refund
                                    </span>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#166534", background: "#dcfce7", border: "1px solid #bbf7d0", padding: "2px 7px", borderRadius: "4px" }}>
                                      Suggested: {formatPrice(returnItem.suggested_refund_amount)}
                                    </span>
                                  </div>

                                  {/* Refund Calculation Breakdown Box */}
                                  {detail?.refund_breakdown ? (
                                    <div
                                      style={{
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        padding: "12px 14px",
                                        marginBottom: "14px",
                                        fontSize: "12.5px",
                                      }}
                                    >
                                      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569" }}>
                                          Refund Breakdown
                                        </span>
                                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#64748b" }}>Prorated</span>
                                      </div>

                                      <div style={{ display: "grid", gap: "6px", color: "#475569" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                          <span>Items Subtotal</span>
                                          <span style={{ fontWeight: 600, color: "#0f172a" }}>+{formatPrice(detail.refund_breakdown.items_subtotal)}</span>
                                        </div>

                                        {detail.refund_breakdown.discounts_prorated > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#b91c1c" }}>
                                            <span>Discount</span>
                                            <span style={{ fontWeight: 600 }}>-{formatPrice(detail.refund_breakdown.discounts_prorated)}</span>
                                          </div>
                                        )}

                                        {detail.refund_breakdown.tax_refund > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>Tax (GST)</span>
                                            <span style={{ fontWeight: 600, color: "#0f172a" }}>+{formatPrice(detail.refund_breakdown.tax_refund)}</span>
                                          </div>
                                        )}

                                        {detail.refund_breakdown.refundable_charges_added > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
                                            <span>Refundable Charges</span>
                                            <span style={{ fontWeight: 600 }}>+{formatPrice(detail.refund_breakdown.refundable_charges_added)}</span>
                                          </div>
                                        )}

                                        {detail.refund_breakdown.non_refundable_charges_retained > 0 && (
                                          <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309" }}>
                                            <span>Non-Refundable Retained</span>
                                            <span style={{ fontWeight: 600 }}>-{formatPrice(detail.refund_breakdown.non_refundable_charges_retained)}</span>
                                          </div>
                                        )}

                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            borderTop: "1px solid #e2e8f0",
                                            paddingTop: "8px",
                                            marginTop: "4px",
                                            fontWeight: 700,
                                            fontSize: "13px",
                                            color: "#0f172a",
                                          }}
                                        >
                                          <span>Suggested Refund</span>
                                          <span style={{ color: "#16a34a", fontSize: "14px" }}>{formatPrice(detail.refund_breakdown.suggested_refund_amount)}</span>
                                        </div>
                                      </div>

                                      {/* Non-Refundable Exception Checkboxes */}
                                      {detail.refund_breakdown.charge_allocations?.some((c) => !c.refundable && c.allocated_amount > 0) && (
                                        <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}>
                                          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: "6px" }}>
                                            Refund Retained Charges
                                          </div>

                                          <div style={{ display: "grid", gap: "6px" }}>
                                            {detail.refund_breakdown.charge_allocations
                                              .filter((c) => !c.refundable && c.allocated_amount > 0)
                                              .map((charge) => {
                                                const isChecked = Boolean(selectedExtraChargesByReturn[returnItem.id]?.[charge.id]);
                                                return (
                                                  <label
                                                    key={charge.id}
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      justifyContent: "space-between",
                                                      padding: "7px 10px",
                                                      borderRadius: "6px",
                                                      background: isChecked ? "#f0fdf4" : "#ffffff",
                                                      border: isChecked ? "1px solid #86efac" : "1px solid #e2e8f0",
                                                      cursor: "pointer",
                                                      fontSize: "12px",
                                                      transition: "all 0.15s ease",
                                                    }}
                                                  >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                      <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() =>
                                                          toggleExtraCharge(
                                                            returnItem.id,
                                                            charge.id,
                                                            detail.refund_breakdown!.suggested_refund_amount,
                                                            detail.refund_breakdown!.charge_allocations
                                                          )
                                                        }
                                                        style={{ cursor: "pointer", accentColor: "#16a34a" }}
                                                      />
                                                      <span style={{ fontWeight: 500, color: "#0f172a" }}>{charge.label}</span>
                                                    </div>
                                                    <span style={{ color: isChecked ? "#16a34a" : "#64748b", fontWeight: 600 }}>
                                                      +{formatPrice(charge.allocated_amount)}
                                                    </span>
                                                  </label>
                                                );
                                              })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}

                                  {/* Original Order Payment Source Banner */}
                                  {isOrderOnlinePaid ? (
                                    <div
                                      style={{
                                        padding: "10px 12px",
                                        borderRadius: "6px",
                                        background: "#f0fdf4",
                                        border: "1px solid #bbf7d0",
                                        marginBottom: "14px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: "8px",
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#166534" }}>
                                          Payment Source: Online ({formatPaymentMethodName(detail?.order?.payment_method)})
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#15803d", marginTop: "2px" }}>
                                          {detail?.order?.razorpay_payment_id ? `Razorpay Payment ID: ${detail.order.razorpay_payment_id}` : "Gateway Reversal Enabled"}
                                        </div>
                                      </div>
                                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#15803d", background: "#ffffff", border: "1px solid #86efac", padding: "2px 6px", borderRadius: "4px" }}>
                                        Auto-Reversal
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        padding: "10px 12px",
                                        borderRadius: "6px",
                                        background: "#fffbeb",
                                        border: "1px solid #fde68a",
                                        marginBottom: "14px",
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#92400e" }}>
                                          Payment Source: Cash on Delivery (COD)
                                        </span>
                                        {(detail?.customer_refund_account || returnItem.customer_refund_account) && (
                                          <span style={{ fontSize: "10px", fontWeight: 800, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: "4px", textTransform: "uppercase" }}>
                                            {(detail?.customer_refund_account || returnItem.customer_refund_account).type || "UPI"}
                                          </span>
                                        )}
                                      </div>

                                      {(detail?.customer_refund_account || returnItem.customer_refund_account) ? (
                                        <div style={{ fontSize: "12px", color: "#78350f", background: "#ffffff", padding: "8px 10px", borderRadius: "4px", border: "1px solid #fef3c7", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {(detail?.customer_refund_account || returnItem.customer_refund_account).type === "upi" ? (
                                              <span><strong>UPI ID:</strong> {(detail?.customer_refund_account || returnItem.customer_refund_account).upi_id}</span>
                                            ) : (
                                              <span><strong>A/C:</strong> {(detail?.customer_refund_account || returnItem.customer_refund_account).account_number} ({detail?.customer_refund_account?.ifsc_code || returnItem.customer_refund_account?.ifsc_code})</span>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const val = (detail?.customer_refund_account || returnItem.customer_refund_account).type === "upi"
                                                ? (detail?.customer_refund_account || returnItem.customer_refund_account).upi_id
                                                : (detail?.customer_refund_account || returnItem.customer_refund_account).account_number;
                                              navigator.clipboard.writeText(val);
                                              alert("Copied to clipboard!");
                                            }}
                                            style={{ fontSize: "11px", fontWeight: 700, padding: "2px 7px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "4px", cursor: "pointer", color: "#92400e" }}
                                          >
                                            Copy
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: "11.5px", color: "#b45309", marginTop: "2px" }}>
                                          Customer has not attached a payout destination. You can issue store credit or contact customer.
                                        </div>
                                      )}
                                    </div>
                                  )}

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
                                        {isOrderOnlinePaid && (
                                          <option value="original_payment">Auto-Refund to Source (Razorpay Gateway)</option>
                                        )}
                                        <option value="cod_refund">Direct Bank Transfer / UPI Refund (Manual Payout)</option>
                                        <option value="store_credit">Store Credit / Voucher Code</option>
                                        {!isOrderOnlinePaid && (
                                          <option value="original_payment">Original Payment Gateway (Fallback)</option>
                                        )}
                                      </select>

                                      <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "4px", fontStyle: "italic" }}>
                                        {refundDraft.refundMethod === "original_payment"
                                          ? "Money is automatically reversed back to the customer's original card, UPI, or netbanking account via Razorpay API."
                                          : refundDraft.refundMethod === "cod_refund"
                                          ? "Merchant sends funds directly to the customer's UPI / Bank details shown above and confirms completion."
                                          : "Customer receives a store credit coupon code for future shopping."}
                                      </div>
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
                                      <div style={labelStyle}>Transaction Reference / Admin Note (Optional)</div>
                                      <textarea
                                        value={refundDraft.adminNote}
                                        onChange={(e) =>
                                          setRefundDraftValue(returnItem.id, (draft) => ({
                                            ...draft,
                                            adminNote: e.target.value,
                                          }))
                                        }
                                        placeholder="Bank UTR number, Razorpay refund reference, or internal payout note..."
                                        style={{ ...inputStyle, minHeight: "56px", resize: "vertical" }}
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
                                    {actionLoadingId === returnItem.id
                                      ? "Processing Refund..."
                                      : `Confirm & Issue Refund (${formatPrice(Number(refundDraft.finalRefundAmount || returnItem.final_refund_amount || returnItem.suggested_refund_amount))})`}
                                  </button>
                                </div>
                              ) : null}

                              {/* Timeline Card */}
                              <div style={{ ...plainCardStyle, padding: "16px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "12px",
                                    paddingBottom: "8px",
                                    borderBottom: "1px solid #f1f5f9",
                                  }}
                                >
                                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Return Timeline
                                  </span>
                                </div>

                                <div style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#475569" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#64748b" }}>Requested:</span>
                                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(returnItem.created_at)}</span>
                                  </div>
                                  {(detail?.approved_at || returnItem.approved_at) && (
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#64748b" }}>Approved:</span>
                                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(detail?.approved_at || returnItem.approved_at)}</span>
                                    </div>
                                  )}
                                  {(detail?.received_at || returnItem.received_at) && (
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#64748b" }}>Received:</span>
                                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(detail?.received_at || returnItem.received_at)}</span>
                                    </div>
                                  )}
                                  {(detail?.inspected_at || returnItem.inspected_at) && (
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#64748b" }}>Inspected:</span>
                                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatDate(detail?.inspected_at || returnItem.inspected_at)}</span>
                                    </div>
                                  )}
                                  {(detail?.refunded_at || returnItem.refunded_at) && (
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#64748b" }}>Refunded:</span>
                                      <span style={{ fontWeight: 600, color: "#15803d" }}>{formatDate(detail?.refunded_at || returnItem.refunded_at)}</span>
                                    </div>
                                  )}
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

          {/* Pagination and page size controls */}
          {adminReturns.length > 0 && (
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
                totalPages={totalReturnPages}
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
        </>
      )}
    </div>
  );
};


export default AdminOrders;
