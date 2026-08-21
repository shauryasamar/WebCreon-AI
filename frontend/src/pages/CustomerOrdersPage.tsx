import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { Pagination } from "../Component/Pagination";
import { resolveThemeTokens } from "../context/ThemeContext";

type RefundInfo = {
  status: string;
  status_label: string;
  badge_color?: string;
  amount: number;
  payment_method?: string;
  reference_id?: string | null;
  arn?: string | null;
  estimated_days?: string | null;
  note?: string | null;
  initiated_at?: string | null;
};

type OrderListItem = {
  id: string;
  status: string;
  payment_status?: string | null;
  total: number;
  payment_method?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
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
  delivery_otp?: string | null;
  has_returnable_items?: boolean;
  can_request_return?: boolean;
  refund_info?: RefundInfo | null;
  shipment?: Shipment | null;
  [key: string]: any;
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
  return_window_days?: number | null;
  is_returnable?: boolean;
  max_returnable_quantity?: number;
  pricing_snapshot?: any;
};

type Shipment = {
  id: string;
  status: string;
  courier_name?: string | null;
  awb_number?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
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

type OrderDetail = {
  id: string;
  status: string;
  payment_status?: string | null;
  total: number;
  payment_method?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  shipping_address?: any;
  pricing_snapshot?: any;
  delivery_otp?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  items: OrderItem[];
  shipment?: Shipment | null;
  has_returnable_items?: boolean;
  can_request_return?: boolean;
  refund_info?: RefundInfo | null;
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
  effective_refund_quantity?: number;
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
  refund_account_type?: "upi" | "bank";
  refund_upi_id?: string;
  refund_account_holder?: string;
  refund_account_number?: string;
  refund_ifsc_code?: string;
  refund_bank_name?: string;
  items: Record<string, ReturnDraftItem>;
};

type CustomerOrdersPageProps = {
  siteId: string;
  siteSlug: string;
  theme?: {
    mode?: string;
    primary_bg?: string;
    secondary_bg?: string;
    card_bg?: string;
    text_color?: string;
    accent_color?: string;
    [key: string]: any;
  };
};

function isColorDarkHex(colorHex?: string): boolean {
  if (!colorHex || typeof colorHex !== "string") return false;
  if (colorHex.startsWith("rgb")) {
    const match = colorHex.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
    }
  }
  const hex = colorHex.replace("#", "").trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 160;
  }
  return false;
}

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

function clean10DigitPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

function formatPhoneDialable(phone: string): string {
  const clean = clean10DigitPhone(phone);
  return clean ? `+91${clean}` : "";
}

function formatPhoneDisplay(phone: string): string {
  const clean = clean10DigitPhone(phone);
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone ? `+91 ${phone}` : "";
}

const PhoneIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

function labelize(value?: string | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatPaymentMethodName(method?: string | null): string {
  if (!method) return "Online Payment";
  const m = method.toLowerCase();
  if (m === "upi") return "UPI / QR";
  if (m === "card") return "Credit / Debit Card";
  if (m === "netbanking") return "Netbanking";
  if (m === "cod" || m === "cash_on_delivery") return "Cash on Delivery (COD)";
  if (m === "razorpay") return "Online Payment (Razorpay)";
  return labelize(method);
}

function getPaymentMethodIcon(method?: string | null): React.ReactNode {
  const m = (method || "").toLowerCase();
  if (m === "upi") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    );
  }
  if (m === "netbanking") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="21" x2="21" y2="21" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <polyline points="3 10 12 3 21 10" />
        <line x1="6" y1="10" x2="6" y2="21" />
        <line x1="10" y1="10" x2="10" y2="21" />
        <line x1="14" y1="10" x2="14" y2="21" />
        <line x1="18" y1="10" x2="18" y2="21" />
      </svg>
    );
  }
  if (m === "cod" || m === "cash_on_delivery") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function getStatusColor(status?: string) {
  switch (status) {
    case "delivered":
    case "refunded":
      return "#16a34a";
    case "returned":
      return "#7c3aed";
    case "cancelled":
    case "rejected":
      return "#dc2626";
    case "out_for_delivery":
    case "received":
      return "#f59e0b";
    case "rescheduled":
      return "#d97706";
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

function getTimelineSteps(detail: OrderDetail): TimelineStep[] {
  return [
    { key: "placed", label: "Order Placed", time: detail.created_at },
    { key: "confirmed", label: "Order Confirmed", time: detail.confirmed_at || detail.created_at },
    { key: "shipped", label: "Shipped", time: detail.shipped_at || detail.shipment?.shipped_at },
    { key: "out_for_delivery", label: "Out for Delivery", time: detail.shipment?.out_for_delivery_at },
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
    case "rescheduled":
      return 4;
    case "delivered":
    case "returned":
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
  const [expandedScansMap, setExpandedScansMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const {
    isDark,
    primaryBg: defaultPageBg,
    cardBg: defaultCardBg,
    textColor: defaultTextPrimary,
    mutedTextColor: defaultTextMuted,
    borderColor: resolvedBorderColor,
    accentColor,
    panelBg,
    subtleBg: innerBg,
  } = resolveThemeTokens(theme);
  const pageBg = (theme as any)?.order_history_bg || defaultPageBg;
  const cardBg = (theme as any)?.order_history_card_bg || defaultCardBg;
  const isCardDark = isColorDarkHex(cardBg);
  const isLight = !isCardDark;

  const rawTextPrimary = (theme as any)?.order_history_text;
  const textPrimary =
    rawTextPrimary && (isColorDarkHex(rawTextPrimary) !== isCardDark)
      ? rawTextPrimary
      : (isCardDark ? "#f8fafc" : "#0f172a");

  const rawTextMuted = (theme as any)?.order_history_muted_text;
  const textMuted =
    rawTextMuted && (isColorDarkHex(rawTextMuted) !== isCardDark)
      ? rawTextMuted
      : (isCardDark ? "rgba(248, 250, 252, 0.72)" : "rgba(15, 23, 42, 0.65)");

  const cardBorder = `1px solid ${(theme as any)?.order_history_border || (isCardDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)")}`;
  const divider = cardBorder;
  const timelineRail = isCardDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.18)";
  const pendingDot = isCardDark ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.25)";

  const isMobile = viewportWidth <= 640;
  const isTablet = viewportWidth > 640 && viewportWidth <= 1024;
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const loadOrders = async (page = currentPage) => {
    if (!siteId) return;
    const response = await fetch(`${API_BASE_URL}/orders/${siteId}/my-orders?page=${page}&page_size=${pageSize}`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to load orders");
    const data = await response.json();
    if (Array.isArray(data)) {
      setOrders(data);
      setTotalOrders(data.length);
      setTotalPages(Math.ceil(data.length / pageSize) || 1);
    } else if (data && Array.isArray(data.orders)) {
      setOrders(data.orders);
      setTotalOrders(data.total ?? data.orders.length);
      setTotalPages(data.total_pages ?? Math.ceil((data.total ?? data.orders.length) / pageSize) ?? 1);
    } else {
      setOrders([]);
      setTotalOrders(0);
      setTotalPages(1);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage === currentPage) return;
    setCurrentPage(newPage);
    setLoading(true);
    try {
      await loadOrders(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Failed to navigate order pages", err);
    } finally {
      setLoading(false);
    }
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
        await Promise.all([loadOrders(1), loadReturns()]);
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

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant" as ScrollBehavior,
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

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

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, refund_info: data.refund_info, payment_status: data.payment_status, status: data.status }
            : o
        )
      );

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

  const handleCancelOrder = async (orderId: string, currentStatus?: string) => {
    if (!siteId) return;

    const isInTransit = currentStatus === "shipped" || currentStatus === "out_for_delivery" || currentStatus === "rescheduled";
    const promptMsg = isInTransit
      ? "This order has already been dispatched. If you cancel, the courier/rider will return the package to the store warehouse and your refund will be initiated.\n\nReason for cancellation (optional):"
      : "Reason for cancellation (optional):";

    const cancelReason = window.prompt(promptMsg);
    if (cancelReason === null) return; // User clicked cancel in prompt dialog

    try {
      setCancellingOrderId(orderId);

      const response = await fetch(`${API_BASE_URL}/orders/${siteId}/${orderId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancel_reason: cancelReason || "Cancelled by customer",
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

  const isItemReturnable = (item: OrderItem, deliveredAt?: string | null) => {
    if (item.return_window_days === 0) return false;
    if (Number(item.returnable_quantity || 0) <= 0) return false;
    if (deliveredAt && item.return_window_days != null && item.return_window_days > 0) {
      const windowClosesMs = new Date(deliveredAt).getTime() + item.return_window_days * 24 * 60 * 60 * 1000;
      if (Date.now() > windowClosesMs) return false;
    }
    return true;
  };

  const canRequestReturnForOrder = (detail?: OrderDetail | null, order?: OrderListItem | null) => {
    if (detail && typeof detail.can_request_return === "boolean") {
      return detail.can_request_return;
    }

    if (order && typeof order.can_request_return === "boolean") {
      return order.can_request_return;
    }

    if (!detail || detail.status !== "delivered") return false;
    return detail.items.some((item) => isItemReturnable(item, detail.delivered_at));
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

    const draft = returnDrafts[orderId];
    const detail = detailMap[orderId];
    const currentOrder = orders.find((o) => o.id === orderId);
    const paymentMethod = (detail?.payment_method || currentOrder?.payment_method || "").toLowerCase();
    const isCod = paymentMethod === "cod" || paymentMethod === "cash_on_delivery";

    let customerRefundAccount: any = null;
    const accountType = draft?.refund_account_type || "upi";

    const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,30}$/;
    const EMAIL_DOMAIN_REGEX = /\.(com|in|co|org|net|io|edu|gov|co\.in|org\.in|ac\.in)$/i;
    const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;
    const ACCOUNT_HOLDER_REGEX = /^[a-zA-Z\s.]{2,70}$/;

    if (accountType === "bank") {
      const holder = draft?.refund_account_holder?.trim() || "";
      const accNum = draft?.refund_account_number?.trim() || "";
      const ifsc = draft?.refund_ifsc_code?.trim()?.toUpperCase() || "";
      const bankName = draft?.refund_bank_name?.trim() || "";

      if (isCod || holder || accNum || ifsc) {
        if (!holder || !ACCOUNT_HOLDER_REGEX.test(holder)) {
          alert("Please enter a valid Account Holder Full Name (letters and spaces only, at least 2 characters).");
          return;
        }
        if (!accNum || !ACCOUNT_NUMBER_REGEX.test(accNum)) {
          alert("Please enter a valid 9 to 18-digit Bank Account Number (digits only).");
          return;
        }
        if (!ifsc || !IFSC_REGEX.test(ifsc)) {
          alert(`'${ifsc}' is not a valid 11-character Indian Bank IFSC Code (e.g. HDFC0001234, SBIN0000456, ICIC0000001). The 5th character must be '0'.`);
          return;
        }
        customerRefundAccount = {
          type: "bank",
          account_holder: holder,
          account_number: accNum,
          ifsc_code: ifsc,
          bank_name: bankName || null,
        };
      }
    } else {
      const upi = draft?.refund_upi_id?.trim() || "";
      if (isCod || upi) {
        if (!upi || !upi.includes("@")) {
          alert("Please provide a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm).");
          return;
        }
        const parts = upi.split("@");
        if (parts.length === 2 && EMAIL_DOMAIN_REGEX.test(parts[1])) {
          alert(`'${upi}' appears to be an email address. A valid UPI ID uses a bank handle (e.g. @okhdfcbank, @paytm, @ybl, @okaxis, @upi) without '.com' or '.in'.`);
          return;
        }
        if (!UPI_ID_REGEX.test(upi)) {
          alert(`'${upi}' is not a valid UPI ID format (e.g. yourname@okhdfcbank or 9876543210@paytm).`);
          return;
        }
        customerRefundAccount = {
          type: "upi",
          upi_id: upi,
        };
      }
    }

    if (isCod && !customerRefundAccount) {
      alert("For Cash on Delivery (COD) orders, please provide your UPI ID or Bank Account details to receive your refund.");
      return;
    }

    try {
      setSubmittingReturnOrderId(orderId);

      const response = await fetch(`${API_BASE_URL}/returns/${siteId}/request`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
          request_note: draft?.request_note?.trim() || null,
          customer_refund_account: customerRefundAccount,
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
    const currentRank = isCancelled ? 0 : getStatusRank(orderStatus);
    const isDelivered = !isCancelled && (orderStatus === "delivered" || currentRank >= 5);
    const isOutForDelivery = !isCancelled && (currentRank >= 4 || orderStatus === "out_for_delivery");
    const isShipped = !isCancelled && (currentRank >= 3 || isOutForDelivery || isDelivered);
    const isPacked = !isCancelled && (currentRank >= 2 || isShipped);
    const isPlaced = true;

    const isOwnAgent =
      detail.shipment?.delivery_mode === "own_agent" ||
      detail.shipment?.mode === "own_agent" ||
      Boolean(detail.shipment?.agent_id) ||
      Boolean(detail.shipment?.delivery_partner_name && !detail.shipment?.awb_number);

    const isShiprocket =
      !isOwnAgent && (
        detail.shipment?.delivery_mode === "shiprocket" ||
        detail.shipment?.mode === "shiprocket" ||
        Boolean(detail.shipment?.awb_number) ||
        Boolean(detail.shipment?.courier_name)
      );

    const orderedDate = formatFlipkartDate(detail.created_at);
    const orderedTime = formatFlipkartDateTime(detail.created_at);

    const packedDate = formatFlipkartDate(detail.confirmed_at || detail.created_at);
    const packedTime = formatFlipkartDateTime(detail.confirmed_at || detail.created_at);

    const shippedDate = formatFlipkartDate(detail.shipped_at || detail.shipment?.shipped_at);
    const shippedTime = formatFlipkartDateTime(detail.shipped_at || detail.shipment?.shipped_at);

    const ofdDate = formatFlipkartDate(detail.shipment?.out_for_delivery_at || detail.shipped_at || detail.shipment?.shipped_at);
    const ofdTime = formatFlipkartDateTime(detail.shipment?.out_for_delivery_at || detail.shipped_at || detail.shipment?.shipped_at);

    const deliveredDate = formatFlipkartDate(detail.delivered_at || detail.shipment?.delivered_at);
    const deliveredTime = formatFlipkartDateTime(detail.delivered_at || detail.shipment?.delivered_at);
    const expectedDeliveryDate = formatFlipkartDate(detail.shipment?.estimated_delivery_at || detail.created_at);

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
      const riderName = detail.shipment?.delivery_partner_name || "Store Delivery Partner";
      const riderPhone = detail.shipment?.delivery_partner_phone;

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
                    ? `Your order is out for delivery with ${riderName}${riderPhone ? ` (${formatPhoneDisplay(riderPhone)})` : ""}.`
                    : "Your order was out for delivery with store delivery partner.",
                  sub: ofdTime,
                },
              ]
            : [{ text: "Item yet to be dispatched with delivery partner." }],
        },
        {
          key: "delivered",
          isDone: isDelivered,
          title: isDelivered ? "Delivered" : "Delivery Expected soon",
          date: isDelivered ? deliveredDate : "",
          items: isDelivered
            ? [{ text: "Your order has been handed over safely.", sub: deliveredTime }]
            : [{ text: "Item yet to be delivered." }],
        },
      ];
    } else if (isShiprocket) {
      const courierLine = detail.shipment?.courier_name || detail.shipment?.awb_number
        ? `${detail.shipment.courier_name || "Courier Partner"}${detail.shipment.awb_number ? ` - AWB: ${detail.shipment.awb_number}` : ""}`
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
                ...(isShipped ? [{ text: `Package handed over to ${detail.shipment?.courier_name || "courier partner"}.`, sub: shippedTime }] : []),
              ]
            : [{ text: "Seller will process your order soon." }],
        },
        {
          key: "shipped",
          isDone: isShipped,
          title: "In Transit",
          date: isShipped ? shippedDate : "",
          courier: isShipped ? courierLine : null,
          trackingUrl: isShipped ? detail.shipment?.tracking_url : null,
          items: isShipped
            ? [{ text: `In transit with ${detail.shipment?.courier_name || "courier partner"}.`, sub: shippedTime }]
            : [{ text: "Item yet to be picked up by courier." }],
          scans: isShipped ? (detail.shipment?.scans || []) : [],
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
      const partnerLine = detail.shipment?.delivery_partner_name || detail.shipment?.courier_name || detail.shipment?.awb_number
        ? `${detail.shipment.delivery_partner_name || detail.shipment.courier_name || "Delivery Partner"}${detail.shipment.awb_number ? ` - ${detail.shipment.awb_number}` : ""}`
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

    return (
      <div
        style={{
          border: cardBorder,
          borderRadius: "18px",
          padding: isCompact ? "16px" : "20px",
          background: panelBg,
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 800,
            marginBottom: "16px",
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
              borderRadius: "14px",
              border: "1px solid rgba(239,68,68,0.18)",
              background: "rgba(239,68,68,0.08)",
              padding: "14px 16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#dc2626", marginBottom: "4px" }}>
              Order Cancelled
            </div>
            <div style={{ fontSize: "13px", color: textMuted }}>
              {formatDate(detail.cancelled_at)}
            </div>
          </div>
        ) : null}

        {/* Continuous Flipkart-Style Vertical Stepper */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {nodes.map((node, nIdx) => {
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
                      border: node.isDone ? "none" : `2px solid ${isLight ? "#cbd5e1" : "rgba(255,255,255,0.25)"}`,
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
                        background: lineIsDone ? "#22c55e" : (isLight ? "#cbd5e1" : "rgba(255,255,255,0.15)"),
                        margin: "4px 0",
                      }}
                    />
                  )}
                </div>

                {/* Right Node Details */}
                <div style={{ paddingBottom: isLast ? "0" : "22px", flex: 1 }}>
                  {/* Title & Date on the same line */}
                  <div style={{ fontSize: "14.5px", color: textPrimary, marginBottom: "4px", lineHeight: 1.3 }}>
                    <strong style={{ fontWeight: 800 }}>{node.title}</strong>
                    {node.date && (
                      <span style={{ color: textMuted, fontWeight: 500, fontSize: "13px", marginLeft: "8px" }}>
                        {node.date}
                      </span>
                    )}
                  </div>

                  {/* Courier Partner & AWB Line */}
                  {node.courier && (
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: textPrimary, marginBottom: "4px" }}>
                      {node.courier}
                    </div>
                  )}

                  {/* Tracking link for courier */}
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
                        <div style={{ color: node.isDone ? textPrimary : textMuted, fontWeight: 500 }}>
                          {item.text}
                        </div>
                        {item.sub && (
                          <div style={{ color: textMuted, fontSize: "12px", marginTop: "1px" }}>
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
                        onClick={() => {
                          setExpandedScansMap((prev) => ({
                            ...prev,
                            [detail.id]: !prev[detail.id],
                          }));
                        }}
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
                        {expandedScansMap[detail.id]
                          ? "Hide tracking updates ▴"
                          : `See all tracking updates (${node.scans.length}) ▾`}
                      </button>

                      {expandedScansMap[detail.id] && (
                        <div
                          style={{
                            marginTop: "10px",
                            marginLeft: "8px",
                            paddingLeft: "12px",
                            borderLeft: `2px solid ${isLight ? "#bfdbfe" : "rgba(37,99,235,0.3)"}`,
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {node.scans.map((scan: any, sIdx: number) => (
                            <div key={sIdx} style={{ fontSize: "12.5px" }}>
                              <div style={{ color: textPrimary, fontWeight: 600 }}>
                                {scan.activity}
                              </div>
                              <div style={{ color: textMuted, fontSize: "11.5px", marginTop: "1px" }}>
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
          })}
        </div>

        {/* Own Fleet Rider Contact Card — below tracker, only when out for delivery and not cancelled */}
        {isOwnAgent && !isCancelled && isOutForDelivery && (detail.shipment?.delivery_partner_name || detail.shipment?.delivery_partner_phone) && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              borderRadius: "14px",
              background: isLight ? "#f0fdf4" : "rgba(16, 185, 129, 0.06)",
              border: "1.5px solid rgba(16, 185, 129, 0.25)",
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
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "#10b981",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "15px",
                  flexShrink: 0,
                }}
              >
                {detail.shipment.delivery_partner_name?.[0]?.toUpperCase() || "R"}
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Store Delivery Partner
                </div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: textPrimary }}>
                  {detail.shipment.delivery_partner_name || "Assigned Rider"}
                </div>
                {detail.shipment.delivery_partner_phone && (
                  <div style={{ fontSize: "12px", color: textMuted, marginTop: "1px" }}>
                    {formatPhoneDisplay(detail.shipment.delivery_partner_phone)}
                  </div>
                )}
              </div>
            </div>

            {detail.shipment.delivery_partner_phone && (
              <a
                href={`tel:${detail.shipment.delivery_partner_phone}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  background: "#10b981",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <PhoneIcon />
                <span>Call Delivery Partner</span>
              </a>
            )}
          </div>
        )}

        {/* Reschedule Notice if applicable */}
        {detail.shipment?.notes && (orderStatus === "rescheduled" || detail.shipment.status === "rescheduled") && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: isDark ? "rgba(217, 119, 6, 0.15)" : "#fffbeb",
              border: isDark ? "1px solid rgba(217, 119, 6, 0.3)" : "1px solid #fde68a",
              color: isDark ? "#fde68a" : "#92400e",
              fontSize: "12.5px",
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "2px" }}>
              Delivery Attempt Rescheduled
            </div>
            <div>{detail.shipment.notes}</div>
          </div>
        )}
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
                            {formatPrice(
                              item.effective_refund_quantity === 0 || item.quantity_received === 0
                                ? 0
                                : (typeof item.line_refund_final === "number"
                                    ? item.line_refund_final
                                    : (typeof item.line_refund_suggested === "number" ? item.line_refund_suggested : 0))
                            )}
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
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? "24px" : "28px",
                lineHeight: 1.2,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: textPrimary,
              }}
            >
              Order history
            </h1>
            {totalOrders > 0 && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)",
                  color: textMuted,
                }}
              >
                {totalOrders} {totalOrders === 1 ? "order" : "orders"}
              </span>
            )}
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
              borderRadius: "12px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: isLight ? "0 2px 6px rgba(15,23,42,0.04)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            ← Continue shopping
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
              const canCancel = order.status !== "delivered" && order.status !== "returned" && order.status !== "cancelled";
              const isDelivered = order.status === "delivered";
              const statusColor = getStatusColor(order.status);
              const canReturn = canRequestReturnForOrder(detail, order);
              const isReturnFormOpen = showReturnFormOrderId === order.id;
              const draft = returnDrafts[order.id];
              const orderReturns = getReturnsForOrder(order.id);
              const hasExistingReturn = orderReturns.length > 0;
              const hasSelectableReturnItems =
                !!detail && detail.items.some((item) => isItemReturnable(item, detail.delivered_at));

              return (
                <div
                  key={order.id}
                  style={{
                    background: cardBg,
                    border: isExpanded ? `1px solid ${accentColor}55` : cardBorder,
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: isExpanded
                      ? (isLight ? "0 14px 32px rgba(15,23,42,0.10)" : "0 20px 44px rgba(2,6,23,0.40)")
                      : (isLight ? "0 4px 16px rgba(15,23,42,0.04)" : "0 10px 24px rgba(2,6,23,0.20)"),
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(order.id)}
                    aria-expanded={isExpanded}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: isExpanded
                        ? (isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.03)")
                        : "transparent",
                      border: "none",
                      color: "inherit",
                      padding: isMobile ? "14px 14px" : "18px 20px",
                      cursor: "pointer",
                      display: "block",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        justifyContent: "space-between",
                        alignItems: isMobile ? "stretch" : "center",
                        gap: isMobile ? "12px" : "16px",
                      }}
                    >
                      {/* Left: Order icon, number, date */}
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "12px",
                            background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.08)",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                            color: textPrimary,
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <path d="M16 10a4 4 0 0 1-8 0"/>
                          </svg>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                            <span
                              style={{
                                fontSize: "15px",
                                fontWeight: 800,
                                letterSpacing: "-0.01em",
                                color: textPrimary,
                              }}
                            >
                              Order #{order.id.slice(0, 8)}
                            </span>
                            {order.items && order.items.length > 0 && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.08)",
                                  color: textMuted,
                                }}
                              >
                                {order.items.length} {order.items.length === 1 ? "item" : "items"}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "13px", color: textMuted, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span>{formatDate(order.created_at)}</span>
                            {order.payment_method && (
                              <>
                                <span>•</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                                  <span>{getPaymentMethodIcon(order.payment_method)}</span>
                                  <span>{formatPaymentMethodName(order.payment_method)}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle & Right: Status, Price, Chevron */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: isMobile ? "space-between" : "flex-end",
                          gap: isMobile ? "10px" : "20px",
                          flexWrap: isMobile ? "wrap" : "nowrap",
                        }}
                      >
                        {/* Status chip */}
                        {(() => {
                          const isFullyCancelledOrReturned = order.status === "cancelled" || order.status === "returned";
                          const currentRefundInfo = isFullyCancelledOrReturned
                            ? (detailMap[order.id]?.refund_info || order.refund_info)
                            : null;
                          const isRefundFailed = currentRefundInfo?.status === "failed";
                          const isRefundProcessing = currentRefundInfo?.status === "processing";
                          const isRefundCompleted = currentRefundInfo?.status === "completed" && isFullyCancelledOrReturned;
                          const chipColor = isRefundFailed
                            ? "#ef4444"
                            : (isRefundProcessing ? "#d97706" : (isRefundCompleted ? "#059669" : statusColor));
                          const chipLabel = isRefundFailed
                            ? "Refund Failed"
                            : (isRefundProcessing ? "Refund in progress" : (isRefundCompleted ? "Refunded" : order.status.replaceAll("_", " ")));

                          return (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "999px",
                                background: `${chipColor}14`,
                                border: `1px solid ${chipColor}28`,
                                color: chipColor,
                                fontSize: "12px",
                                fontWeight: 800,
                                textTransform: "capitalize",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: chipColor,
                                }}
                              />
                              {chipLabel}
                            </div>
                          );
                        })()}

                        {/* Delivery OTP Badge on Card — only for Own Fleet */}
                        {(order.status === "out_for_delivery" || order.status === "shipped") && order.delivery_otp && order.shipment?.mode !== "shiprocket" && order.shipment?.delivery_mode !== "shiprocket" ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "5px 12px",
                              borderRadius: "999px",
                              background: isLight ? "#ecfdf5" : "rgba(16, 185, 129, 0.12)",
                              border: "1px dashed #10b981",
                              color: "#059669",
                              fontSize: "12px",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span>OTP:</span>
                            <span style={{ letterSpacing: "2px", fontFamily: "monospace", fontWeight: 900 }}>
                              {order.delivery_otp}
                            </span>
                          </div>
                        ) : null}

                        {/* Price */}
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 800,
                            color: textPrimary,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatPrice(order.total)}
                        </div>

                        {/* Accordion expand indicator button */}
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "10px",
                            background: isExpanded
                              ? `${accentColor}18`
                              : isLight
                              ? "rgba(0,0,0,0.04)"
                              : "rgba(255,255,255,0.06)",
                            color: isExpanded ? accentColor : textMuted,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
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
                        <>
                          {/* Delivery Verification Code (OTP) Banner — only for Own Fleet */}
                          {detail.delivery_otp && detail.shipment?.mode !== "shiprocket" && detail.shipment?.delivery_mode !== "shiprocket" && (detail.status === "out_for_delivery" || detail.status === "shipped") ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: isCompact ? "12px 14px" : "14px 18px",
                                background: isLight ? "#f0fdf4" : "rgba(16, 185, 129, 0.08)",
                                border: "1.5px solid rgba(16, 185, 129, 0.3)",
                                borderRadius: "16px",
                                marginBottom: "16px",
                                flexWrap: "wrap",
                                gap: "12px",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 800,
                                    color: "#059669",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                  }}
                                >
                                  Delivery Verification OTP
                                </div>
                                <div style={{ fontSize: "12px", color: textMuted, marginTop: "2px" }}>
                                  Share this 4-digit code with the delivery partner upon receiving your order.
                                </div>
                              </div>
                              <div
                                style={{
                                  fontSize: "22px",
                                  fontWeight: 900,
                                  letterSpacing: "6px",
                                  color: "#059669",
                                  background: isLight ? "#ffffff" : "rgba(0,0,0,0.3)",
                                  padding: "4px 16px",
                                  borderRadius: "10px",
                                  border: "2px dashed #10b981",
                                  fontFamily: "monospace",
                                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)",
                                }}
                              >
                                {detail.delivery_otp}
                              </div>
                            </div>
                          ) : null}

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
                                  const itemCanReturn = isItemReturnable(item, detail.delivered_at);
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
                                          {item.return_window_days === 0 ? (
                                            <div style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px", fontWeight: 600 }}>
                                              Non-Returnable (Final Sale)
                                            </div>
                                          ) : Number(item.returnable_quantity || 0) > 0 ? (
                                            itemCanReturn ? (
                                              <div style={{ fontSize: "12px", color: "#16a34a", marginTop: "4px", fontWeight: 600 }}>
                                                Returnable ({item.return_window_days != null ? `${item.return_window_days} Days Policy` : "Returnable"} • Qty: {item.returnable_quantity})
                                              </div>
                                            ) : (
                                              <div style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px", fontWeight: 600 }}>
                                                Return window expired {item.return_window_days != null ? `(${item.return_window_days} Days Policy)` : ""}
                                              </div>
                                            )
                                          ) : (detail.status === "delivered" || detail.status === "returned") ? (
                                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", fontWeight: 600 }}>
                                              Already fully returned
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

                              <div
                                style={{
                                  border: cardBorder,
                                  borderRadius: "18px",
                                  padding: isCompact ? "14px" : "16px",
                                  background: panelBg,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    color: textMuted,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <span>Payment details</span>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      padding: "3px 9px",
                                      borderRadius: "999px",
                                      textTransform: "capitalize",
                                      background:
                                        detail.payment_status === "paid"
                                          ? "rgba(16,185,129,0.14)"
                                          : detail.payment_status === "refunded"
                                          ? "rgba(139,92,246,0.14)"
                                          : detail.payment_status === "failed"
                                          ? "rgba(239,68,68,0.14)"
                                          : "rgba(245,158,11,0.14)",
                                      color:
                                        detail.payment_status === "paid"
                                          ? "#059669"
                                          : detail.payment_status === "refunded"
                                          ? "#7c3aed"
                                          : detail.payment_status === "failed"
                                          ? "#dc2626"
                                          : "#d97706",
                                    }}
                                  >
                                    {detail.payment_status === "paid"
                                      ? (detail.payment_method?.toLowerCase() === "cod" ? "● Cash Collected (Paid)" : "● Paid")
                                      : detail.payment_status === "refunded"
                                      ? "● Refunded"
                                      : detail.payment_status === "failed"
                                      ? "● Payment Failed"
                                      : (detail.payment_method?.toLowerCase() === "cod" ? "● Pay on Delivery (Pending)" : "● " + (labelize(detail.payment_status) || "Pending"))}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                                    gap: "10px",
                                    marginTop: "2px",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontSize: "12px", color: textMuted, marginBottom: "3px" }}>
                                      Payment method
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "13px",
                                        fontWeight: 700,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }}
                                    >
                                      <span>{getPaymentMethodIcon(detail.payment_method)}</span>
                                      <span>{formatPaymentMethodName(detail.payment_method)}</span>
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: "12px", color: textMuted, marginBottom: "3px" }}>
                                      Total amount
                                    </div>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: textPrimary }}>
                                      {formatPrice(detail.total)}
                                    </div>
                                  </div>
                                </div>

                                {detail.razorpay_payment_id && (
                                  <div
                                    style={{
                                      paddingTop: "8px",
                                      borderTop: divider,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "4px",
                                    }}
                                  >
                                    <div style={{ fontSize: "11px", color: textMuted, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                      Transaction reference
                                    </div>
                                    <code
                                      style={{
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                                        wordBreak: "break-all",
                                        color: textPrimary,
                                        width: "fit-content",
                                      }}
                                    >
                                      {detail.razorpay_payment_id}
                                    </code>
                                  </div>
                                )}
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
                                {/* Refund Destination Account: Required for COD, Automatic for Online */}
                                {order.payment_method?.toLowerCase() === "cod" ? (
                                  <div
                                    style={{
                                      border: cardBorder,
                                      borderRadius: "14px",
                                      padding: "14px",
                                      background: isLight ? "#f8fafc" : "rgba(255,255,255,0.02)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "12px",
                                      marginBottom: "14px",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                                      <span style={{ fontSize: "13px", fontWeight: 800, color: textPrimary, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                        Where should we send your refund?
                                      </span>
                                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(245,158,11,0.14)", color: "#d97706" }}>
                                        Required for COD
                                      </span>
                                    </div>

                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button
                                        type="button"
                                        onClick={() => updateReturnDraft(order.id, (d) => ({ ...d, refund_account_type: "upi" }))}
                                        style={{
                                          padding: "7px 14px",
                                          borderRadius: "10px",
                                          fontSize: "12px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          border: (draft?.refund_account_type || "upi") === "upi" ? `1px solid ${accentColor}` : cardBorder,
                                          background: (draft?.refund_account_type || "upi") === "upi" ? `${accentColor}18` : "transparent",
                                          color: (draft?.refund_account_type || "upi") === "upi" ? accentColor : textMuted,
                                        }}
                                      >
                                        ⚡ Instant UPI / QR
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateReturnDraft(order.id, (d) => ({ ...d, refund_account_type: "bank" }))}
                                        style={{
                                          padding: "7px 14px",
                                          borderRadius: "10px",
                                          fontSize: "12px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          border: draft?.refund_account_type === "bank" ? `1px solid ${accentColor}` : cardBorder,
                                          background: draft?.refund_account_type === "bank" ? `${accentColor}18` : "transparent",
                                          color: draft?.refund_account_type === "bank" ? accentColor : textMuted,
                                        }}
                                      >
                                        🏦 Bank Account (NEFT/IMPS)
                                      </button>
                                    </div>

                                    {(draft?.refund_account_type || "upi") === "upi" ? (
                                      <div>
                                        <input
                                          type="text"
                                          value={draft?.refund_upi_id || ""}
                                          onChange={(e) => updateReturnDraft(order.id, (d) => ({ ...d, refund_upi_id: e.target.value.trim() }))}
                                          placeholder="Enter your UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm)"
                                          style={{
                                            width: "100%",
                                            borderRadius: "10px",
                                            border: cardBorder,
                                            background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                                            color: textPrimary,
                                            padding: "10px 14px",
                                            fontSize: "13px",
                                          }}
                                        />
                                        <div style={{ fontSize: "11px", color: textMuted, marginTop: "4px" }}>
                                          Format: <code style={{ color: accentColor }}>username@bankhandle</code> (e.g. @okhdfcbank, @okicici, @paytm, @ybl, @upi)
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "10px" }}>
                                        <div>
                                          <input
                                            type="text"
                                            maxLength={70}
                                            value={draft?.refund_account_holder || ""}
                                            onChange={(e) => updateReturnDraft(order.id, (d) => ({ ...d, refund_account_holder: e.target.value.replace(/[^a-zA-Z\s.]/g, "") }))}
                                            placeholder="Account Holder Full Name *"
                                            style={{ width: "100%", borderRadius: "10px", border: cardBorder, background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)", color: textPrimary, padding: "10px 14px", fontSize: "13px" }}
                                          />
                                        </div>
                                        <div>
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={18}
                                            value={draft?.refund_account_number || ""}
                                            onChange={(e) => updateReturnDraft(order.id, (d) => ({ ...d, refund_account_number: e.target.value.replace(/\D/g, "").slice(0, 18) }))}
                                            placeholder="Bank Account Number (9-18 digits) *"
                                            style={{ width: "100%", borderRadius: "10px", border: cardBorder, background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)", color: textPrimary, padding: "10px 14px", fontSize: "13px" }}
                                          />
                                        </div>
                                        <div>
                                          <input
                                            type="text"
                                            maxLength={11}
                                            value={draft?.refund_ifsc_code || ""}
                                            onChange={(e) => updateReturnDraft(order.id, (d) => ({ ...d, refund_ifsc_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) }))}
                                            placeholder="IFSC Code (e.g. HDFC0001234) *"
                                            style={{ width: "100%", borderRadius: "10px", border: cardBorder, background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)", color: textPrimary, padding: "10px 14px", fontSize: "13px" }}
                                          />
                                        </div>
                                        <div>
                                          <input
                                            type="text"
                                            maxLength={60}
                                            value={draft?.refund_bank_name || ""}
                                            onChange={(e) => updateReturnDraft(order.id, (d) => ({ ...d, refund_bank_name: e.target.value }))}
                                            placeholder="Bank Name (e.g. HDFC Bank, Optional)"
                                            style={{ width: "100%", borderRadius: "10px", border: cardBorder, background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)", color: textPrimary, padding: "10px 14px", fontSize: "13px" }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      border: cardBorder,
                                      borderRadius: "14px",
                                      padding: "14px",
                                      background: isLight ? "#f0fdf4" : "rgba(16,185,129,0.06)",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                      marginBottom: "14px",
                                    }}
                                  >
                                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(16,185,129,0.15)", display: "grid", placeItems: "center", color: "#059669", flexShrink: 0 }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="5" width="20" height="14" rx="2" />
                                        <line x1="2" y1="10" x2="22" y2="10" />
                                      </svg>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: "13px", fontWeight: 700, color: textPrimary }}>
                                        Automatic Online Refund
                                      </div>
                                      <div style={{ fontSize: "12px", color: textMuted }}>
                                        Refund will be credited back to your original payment method ({formatPaymentMethodName(order.payment_method)}).
                                      </div>
                                    </div>
                                  </div>
                                )}

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
                                  rows={3}
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
                            {detail.refund_info ? (
                              <div
                                style={{
                                  border: detail.refund_info.status === "failed"
                                    ? "1px solid rgba(239,68,68,0.35)"
                                    : (detail.refund_info.status === "completed"
                                      ? "1px solid rgba(16,185,129,0.30)"
                                      : (detail.refund_info.status === "processing"
                                        ? "1px solid rgba(245,158,11,0.30)"
                                        : cardBorder)),
                                  borderRadius: "18px",
                                  padding: isCompact ? "14px" : "16px",
                                  background: detail.refund_info.status === "failed"
                                    ? (isLight ? "#fef2f2" : "rgba(239,68,68,0.08)")
                                    : (detail.refund_info.status === "completed"
                                      ? (isLight ? "#ecfdf5" : "rgba(16,185,129,0.08)")
                                      : (detail.refund_info.status === "processing"
                                        ? (isLight ? "#fffbeb" : "rgba(245,158,11,0.08)")
                                        : panelBg)),
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "8px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: "8px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      fontWeight: 800,
                                      fontSize: "14px",
                                      color: detail.refund_info.status === "failed"
                                        ? "#ef4444"
                                        : (detail.refund_info.status === "completed"
                                          ? "#059669"
                                          : (detail.refund_info.status === "processing" ? "#d97706" : textPrimary)),
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: "8px",
                                        height: "8px",
                                        borderRadius: "50%",
                                        background: detail.refund_info.status === "failed"
                                          ? "#ef4444"
                                          : (detail.refund_info.status === "completed"
                                            ? "#059669"
                                            : (detail.refund_info.status === "processing" ? "#d97706" : textMuted)),
                                      }}
                                    />
                                    <span>{detail.refund_info.status_label}</span>
                                  </div>
                                  {detail.refund_info.estimated_days && (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        padding: "3px 8px",
                                        borderRadius: "6px",
                                        background: detail.refund_info.status === "failed"
                                          ? "rgba(239,68,68,0.18)"
                                          : (detail.refund_info.status === "completed" ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)"),
                                        color: detail.refund_info.status === "failed"
                                          ? "#dc2626"
                                          : (detail.refund_info.status === "completed" ? "#047857" : "#b45309"),
                                        textTransform: "uppercase",
                                        letterSpacing: "0.02em",
                                      }}
                                    >
                                      {detail.refund_info.estimated_days}
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: "13px", color: textMuted, lineHeight: 1.55 }}>
                                  {detail.refund_info.note}
                                </div>

                                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginTop: "2px" }}>
                                  {detail.refund_info.reference_id && (
                                    <div style={{ fontSize: "12px", color: textMuted }}>
                                      Gateway Ref: <code style={{ fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }}>{detail.refund_info.reference_id}</code>
                                    </div>
                                  )}
                                  {detail.refund_info.arn && (
                                    <div style={{ fontSize: "12px", color: textMuted }}>
                                      Bank ARN: <code style={{ fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }}>{detail.refund_info.arn}</code>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}

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
                                  onClick={() => handleCancelOrder(order.id, order.status)}
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
                        </>
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

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={totalOrders}
            pageSize={pageSize}
            showRangeText={true}
            theme={theme}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  );
};

export default CustomerOrdersPage;