/**
 * AgentDeliveryPage — Premium Mobile Rider Partner Portal & Multi-Order Dashboard
 * Supports both:
 * 1. Logged-in Multi-Order Fleet Dashboard (/rider/dashboard or /store/:slug/rider/dashboard)
 * 2. Tokenized Single Task View (/agent/delivery/:shipmentId?token=...)
 */
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { usePublicSiteTheme, cleanSiteName } from "../hooks/usePublicSiteTheme";
import GlassToast from "../Component/GlassToast";

type DeliveryItem = {
  id?: string;
  product_name: string;
  quantity: number;
  quantity_requested?: number;
  quantity_approved?: number;
  quantity_received?: number;
  variant?: string | null;
  price?: number;
  reason?: string;
};

type Task = {
  task_type?: "delivery" | "return_pickup";
  return_id?: string;
  shipment_id: string;
  order_id: string;
  status: string;
  order_status: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  address: {
    line1: string;
    city: string;
    pincode: string;
    full: string;
  };
  google_maps_url: string;
  total_amount: number;
  payment_method: string;
  is_cod: boolean;
  items: DeliveryItem[];
  notes?: string | null;
  estimated_delivery_at?: string | null;
  created_at?: string;
  assigned_at?: string;
  is_cancelled?: boolean;
};

type PoolOrder = {
  order_id: string;
  customer_name: string;
  city: string;
  pincode: string;
  address_summary: string;
  total_amount: number;
  payment_method: string;
  is_cod: boolean;
  item_count: number;
  created_at?: string;
};

type RiderProfile = {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  cash_in_hand: number;
  current_order_count: number;
  total_deliveries: number;
  allow_open_pickup?: boolean;
  site_id: string;
  site_name: string;
  site_slug?: string;
};

function formatPrice(amt: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amt);
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

function formatDisplayDateTime(isoStr?: string | null): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

// Minimalist Vector Icons
const PhoneIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const PackageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4 7.55 4.24a1.78 1.78 0 0 0-2.5 1.55v12.42a1.78 1.78 0 0 0 2.5 1.55L16.5 14.6a1.78 1.78 0 0 0 0-3.1Z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" y1="22" x2="12" y2="12" />
  </svg>
);

const WalletIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M7 15h0M2 9.5h20" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RESCHEDULE_REASONS = [
  "Customer did not answer phone call",
  "Customer requested delivery at later date/time",
  "Customer not available at location",
  "Door locked / Premises closed",
  "Incomplete or incorrect address provided",
  "Severe weather / Route blocked",
  "Other delivery challenge",
];

const DECLINE_REASONS = [
  "Outside my coverage area / route",
  "Vehicle breakdown / maintenance issue",
  "At maximum carrying capacity",
  "Shift ending / unavailable",
  "Other reason",
];

const DOORSTEP_INSPECTION_REASONS = [
  "Seal is broken / Product unsealed",
  "Item is visibly damaged, stained, or torn",
  "Item has clearly been used / worn",
  "Missing original tags, packaging, or accessories",
  "Different item handed over than ordered",
  "Serial number or barcode mismatch",
  "Customer refused handover / Item unavailable",
  "Other physical defect or condition violation",
];

export default function AgentDeliveryPage() {
  const { shipmentId, slug } = useParams<{ shipmentId?: string; slug?: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  // Load site details
  const { siteData } = usePublicSiteTheme(slug);

  // State
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pool, setPool] = useState<PoolOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"tasks" | "pool">("tasks");
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState<string>(RESCHEDULE_REASONS[0]);
  const [rescheduleDateTime, setRescheduleDateTime] = useState<string>("");
  const [rescheduleNote, setRescheduleNote] = useState<string>("");

  const [declineTask, setDeclineTask] = useState<Task | null>(null);
  const [declineReason, setDeclineReason] = useState<string>(DECLINE_REASONS[0]);
  const [declineNote, setDeclineNote] = useState<string>("");

  const [doorstepRejectTask, setDoorstepRejectTask] = useState<Task | null>(null);
  const [doorstepRejectReason, setDoorstepRejectReason] = useState<string>(DOORSTEP_INSPECTION_REASONS[0]);
  const [doorstepRejectNote, setDoorstepRejectNote] = useState<string>("");

  const [pickupVerifyTask, setPickupVerifyTask] = useState<Task | null>(null);
  const [pickedQuantitiesMap, setPickedQuantitiesMap] = useState<Record<string, number>>({});
  const [pickupInspectionNote, setPickupInspectionNote] = useState<string>("");

  const [deliverOtpTask, setDeliverOtpTask] = useState<Task | null>(null);
  const [enteredDeliveryOtp, setEnteredDeliveryOtp] = useState<string>("");
  const [deliverOtpError, setDeliverOtpError] = useState<string | null>(null);

  const [deliverySuccessTask, setDeliverySuccessTask] = useState<Task | null>(null);

  // Single-task fallback data
  const [singleTask, setSingleTask] = useState<Task | null>(null);

  // Clean Store Name
  const storeDisplayName = useMemo(() => {
    if (siteData?.siteName) return siteData.siteName;
    if (profile?.site_name) return profile.site_name;
    if (slug) return cleanSiteName("", slug);
    return "Store";
  }, [siteData, profile, slug]);

  const initials = useMemo(() => {
    const name = profile?.name || "Rider";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [profile?.name]);

  // Default retry datetime to tomorrow same time
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setRescheduleDateTime(localIso);
  }, []);

  // Auto-switch to tasks tab if open pickup is disabled
  useEffect(() => {
    if (profile?.allow_open_pickup === false && activeTab === "pool") {
      setActiveTab("tasks");
    }
  }, [profile?.allow_open_pickup, activeTab]);

  // Load session or token
  useEffect(() => {
    bootstrap();
  }, [shipmentId, token]);

  const bootstrap = async () => {
    setLoading(true);
    setError(null);

    // If accessed with direct token in URL
    if (shipmentId && token) {
      await fetchSingleShipment(shipmentId, token);
      setLoading(false);
      return;
    }

    // Otherwise load full rider portal session
    const stored = localStorage.getItem("rider_session");
    const storedToken = localStorage.getItem("rider_token");
    if (!stored || !storedToken) {
      navigate(slug ? `/store/${slug}/rider/login` : "/rider/login");
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setProfile(parsed.agent);
      await Promise.all([loadTasks(storedToken), loadPool(storedToken), loadProfile(storedToken)]);
    } catch {
      setError("Session expired. Please log in again.");
      localStorage.removeItem("rider_session");
      localStorage.removeItem("rider_token");
      navigate(slug ? `/store/${slug}/rider/login` : "/rider/login");
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/rider/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // ignore
    }
  };

  const loadTasks = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/rider/tasks`, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load delivery tasks");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadPool = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/rider/available-pool`, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPool(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  const fetchSingleShipment = async (shId: string, tk: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/agent/${shId}?token=${tk}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Order task not found" }));
        throw new Error(err.detail || "Order task not found");
      }
      const data = await res.json();
      const addr = data.delivery_address || {};
      const fullAddr = [addr.line1, addr.city, addr.pincode].filter(Boolean).join(", ") || "Customer Address";
      const formatted: Task = {
        shipment_id: data.shipment_id,
        order_id: data.order_id,
        status: data.status,
        order_status: data.status === "delivered" ? "delivered" : "out_for_delivery",
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        address: {
          line1: addr.line1 || "",
          city: addr.city || "",
          pincode: addr.pincode || "",
          full: fullAddr,
        },
        google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`,
        total_amount: data.order_total,
        payment_method: data.payment_method,
        is_cod: data.payment_method === "cod",
        notes: data.notes,
        estimated_delivery_at: data.estimated_delivery_at,
        items: (data.items || []).map((i: any) => ({
          product_name: i.product_name || "Item",
          quantity: i.quantity || 1,
          variant: i.selected_variant_value,
          price: i.line_total,
        })),
      };
      setSingleTask(formatted);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateStatus = async (
    targetShipmentId: string,
    action: string,
    extraPayload?: {
      reason?: string;
      notes?: string;
      rescheduled_at?: string;
      picked_items?: Record<string, number>;
      [key: string]: any;
    }
  ) => {
    setActionLoadingId(targetShipmentId);
    setError(null);
    setSuccessMsg(null);

    try {
      const authToken = localStorage.getItem("rider_token");
      let res;
      const bodyData = {
        action,
        ...extraPayload,
      };

      if (authToken) {
        res = await fetch(`${API_BASE_URL}/delivery/rider/tasks/${targetShipmentId}/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          credentials: "include",
          body: JSON.stringify(bodyData),
        });
      } else if (token) {
        res = await fetch(`${API_BASE_URL}/delivery/agent/${targetShipmentId}/status?token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(bodyData),
        });
      }

      if (!res || !res.ok) {
        const err = await res?.json().catch(() => ({ detail: "Status update failed" }));
        throw new Error(err?.detail || "Status update failed");
      }

      let msg = "Delivery status updated!";
      if (action === "delivered") {
        msg = "Order marked as delivered successfully!";
        const completedTask =
          deliverOtpTask ||
          tasks.find((t) => t.shipment_id === targetShipmentId) ||
          singleTask;
        if (completedTask) {
          setDeliverySuccessTask(completedTask);
        }
      } else if (action === "reschedule") {
        msg = "Delivery rescheduled & notes updated.";
      } else if (action === "reject") {
        msg = "Order released back to pickup pool.";
      } else if (action === "return_to_hub") {
        msg = "Parcel returned to store warehouse successfully.";
      }

      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3500);

      // Close open input modals
      setRescheduleTask(null);
      setDeclineTask(null);
      setDeliverOtpTask(null);
      setDeliverOtpError(null);

      // Refresh tasks
      if (authToken) {
        await Promise.all([loadTasks(authToken), loadPool(authToken), loadProfile(authToken)]);
      } else if (targetShipmentId && token) {
        await fetchSingleShipment(targetShipmentId, token);
      }
    } catch (e: any) {
      if (action === "delivered") {
        setDeliverOtpError(e.message || "Invalid OTP code");
      } else {
        setError(e.message || "Failed to update status");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClaimOrder = async (orderId: string) => {
    setActionLoadingId(orderId);
    setError(null);
    try {
      const authToken = localStorage.getItem("rider_token");
      if (!authToken) throw new Error("Please log in to claim orders");

      const res = await fetch(`${API_BASE_URL}/delivery/rider/claim/${orderId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Claim failed" }));
        throw new Error(err.detail || "Could not claim order");
      }

      setSuccessMsg("Order assigned! Added to your active deliveries.");
      setTimeout(() => setSuccessMsg(null), 3000);
      setActiveTab("tasks");
      await Promise.all([loadTasks(authToken), loadPool(authToken), loadProfile(authToken)]);
    } catch (e: any) {
      setError(e.message || "Failed to claim order");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out of the delivery portal?")) return;
    try {
      await fetch(`${API_BASE_URL}/delivery/rider/logout`, { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    localStorage.removeItem("rider_session");
    localStorage.removeItem("rider_token");
    const targetSlug = profile?.site_slug || slug;
    navigate(targetSlug ? `/store/${targetSlug}/rider/login` : "/rider/login");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#64748b", fontSize: "14px", fontWeight: 600 }}>
          Loading delivery portal...
        </div>
      </div>
    );
  }

  // Full Multi-Order Dashboard
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "80px",
        boxSizing: "border-box",
      }}
    >
      {/* Top Navigation Bar */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 16px",
          position: "sticky",
          top: 0,
          zIndex: 30,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {/* Rider Profile Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "14px",
                flexShrink: 0,
                boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.25)",
              }}
            >
              {initials}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {profile?.name || "Rider Partner"}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#2563eb",
                    background: "#eff6ff",
                    border: "1px solid #dbeafe",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    textTransform: "capitalize",
                  }}
                >
                  {profile?.vehicle_type || "bike"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b", marginTop: "1px" }}>
                <span style={{ fontWeight: 600, color: "#475569" }}>{storeDisplayName}</span>
                <span>•</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#16a34a", fontWeight: 700, fontSize: "11px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                  On Shift
                </span>
              </div>
            </div>
          </div>

          {/* Right Action: Logout */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "7px 11px",
              borderRadius: "8px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#475569",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            title="Log out from rider app"
          >
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "16px" }}>
        {/* Toast / Status Alerts */}
        {error && (
          <GlassToast
            message={error}
            type="error"
            onClose={() => setError(null)}
            top="76px"
          />
        )}
        {successMsg && (
          <GlassToast
            message={successMsg}
            type="success"
            onClose={() => setSuccessMsg(null)}
            top="76px"
          />
        )}

        {/* Pure White Bento Shift Summary Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "16px 18px",
            color: "#0f172a",
            marginBottom: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: "10px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Active Shift Metrics
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#15803d",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                padding: "2px 8px",
                borderRadius: "12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#16a34a" }} />
              Live Route
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "12px 10px",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px", fontWeight: 600 }}>
                <PackageIcon />
                <span>Active Stops</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#2563eb", lineHeight: 1.1 }}>
                {tasks.length}
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "12px 10px",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px", fontWeight: 600 }}>
                <WalletIcon />
                <span>Cash in Hand</span>
              </div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#15803d", lineHeight: 1.1, wordBreak: "break-all" }}>
                {formatPrice(profile?.cash_in_hand || 0)}
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "12px 10px",
              }}
            >
              <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px", fontWeight: 600 }}>
                <CheckCircleIcon />
                <span>Delivered</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                {profile?.total_deliveries || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Segmented Tab Switcher / Header */}
        {profile?.allow_open_pickup !== false ? (
          <div
            style={{
              display: "flex",
              gap: "4px",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              padding: "3px",
              borderRadius: "10px",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("tasks")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === "tasks" ? "#ffffff" : "transparent",
                color: activeTab === "tasks" ? "#0f172a" : "#64748b",
                fontWeight: activeTab === "tasks" ? 700 : 600,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: activeTab === "tasks" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>Assigned Tasks</span>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: activeTab === "tasks" ? "#eff6ff" : "#e2e8f0",
                  color: activeTab === "tasks" ? "#2563eb" : "#64748b",
                }}
              >
                {tasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pool")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === "pool" ? "#ffffff" : "transparent",
                color: activeTab === "pool" ? "#0f172a" : "#64748b",
                fontWeight: activeTab === "pool" ? 700 : 600,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: activeTab === "pool" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <span>Open Pickups</span>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: activeTab === "pool" ? "#eff6ff" : "#e2e8f0",
                  color: activeTab === "pool" ? "#2563eb" : "#64748b",
                }}
              >
                {pool.length}
              </span>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
              padding: "0 2px",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
              Assigned Tasks
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                background: "#eff6ff",
                color: "#2563eb",
              }}
            >
              {tasks.length} active
            </span>
          </div>
        )}

        {/* TAB 1: ACTIVE DELIVERIES */}
        {activeTab === "tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {tasks.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "44px 20px",
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>
                  All Assigned Tasks Completed
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", margin: profile?.allow_open_pickup !== false ? "0 0 16px" : "0" }}>
                  {profile?.allow_open_pickup !== false
                    ? "You have completed all active deliveries. Check the Open Pickups tab to claim new orders."
                    : "You have completed all active deliveries. New orders will appear here when assigned by store management."}
                </p>
                {profile?.allow_open_pickup !== false && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("pool")}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      background: "#2563eb",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "13px",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                    }}
                  >
                    View Open Pickups →
                  </button>
                )}
              </div>
            ) : (
              tasks.map((task, index) => {
                const isCancelled = task.is_cancelled || task.status === "cancelled" || task.order_status === "cancelled";
                const isReturnPickup = task.task_type === "return_pickup";
                const isRescheduled = task.status === "rescheduled";
                const isAssigned = task.status === "assigned";
                const isAccepted = task.status === "accepted" || task.status === "shipped";
                const isOutForDelivery = task.status === "out_for_delivery";
                const isPickedUpReturn = isReturnPickup && task.status === "picked_up";

                return (
                  <div
                    key={task.shipment_id}
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      padding: "16px",
                      border: isCancelled
                        ? "1.5px solid #fca5a5"
                        : isReturnPickup
                        ? "1px solid #ddd6fe"
                        : isRescheduled
                        ? "1px solid #fde68a"
                        : "1px solid #e2e8f0",
                      boxShadow: isCancelled
                        ? "0 4px 12px -1px rgba(239, 68, 68, 0.12)"
                        : isReturnPickup
                        ? "0 4px 10px -1px rgba(124, 58, 237, 0.08)"
                        : "0 4px 6px -1px rgba(0, 0, 0, 0.04)",
                      position: "relative",
                    }}
                  >
                    {/* Sequence Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: isCancelled ? "#991b1b" : isReturnPickup ? "#6b21a8" : "#1d4ed8",
                            background: isCancelled ? "#fef2f2" : isReturnPickup ? "#f5f3ff" : "#eff6ff",
                            border: `1px solid ${isCancelled ? "#fca5a5" : isReturnPickup ? "#ddd6fe" : "#bfdbfe"}`,
                            padding: "2px 7px",
                            borderRadius: "4px",
                          }}
                        >
                          {isCancelled ? `CANCELLED #${index + 1}` : isReturnPickup ? `RETURN PICKUP #${index + 1}` : `STOP #${index + 1}`}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: isCancelled ? "#b91c1c" : isReturnPickup ? "#7c3aed" : "#64748b",
                            background: isCancelled ? "#fff1f2" : isReturnPickup ? "#f5f3ff" : "#f1f5f9",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          #{task.order_id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: isCancelled
                            ? "#fef2f2"
                            : isReturnPickup
                            ? isPickedUpReturn
                              ? "#ecfdf5"
                              : "#f5f3ff"
                            : isRescheduled
                            ? "#fffbeb"
                            : isOutForDelivery
                            ? "#eff6ff"
                            : isAssigned
                            ? "#f1f5f9"
                            : "#eff6ff",
                          color: isCancelled
                            ? "#b91c1c"
                            : isReturnPickup
                            ? isPickedUpReturn
                              ? "#059669"
                              : "#6b21a8"
                            : isRescheduled
                            ? "#d97706"
                            : isOutForDelivery
                            ? "#2563eb"
                            : isAssigned
                            ? "#475569"
                            : "#1d4ed8",
                          border: `1px solid ${
                            isCancelled
                              ? "#fca5a5"
                              : isReturnPickup
                              ? isPickedUpReturn
                                ? "#a7f3d0"
                                : "#ddd6fe"
                              : isRescheduled
                              ? "#fde68a"
                              : isOutForDelivery
                              ? "#bfdbfe"
                              : isAssigned
                              ? "#cbd5e1"
                              : "#bfdbfe"
                          }`,
                          textTransform: "capitalize",
                        }}
                      >
                        {isCancelled
                          ? "Cancelled by Customer"
                          : isReturnPickup
                          ? isPickedUpReturn
                            ? "Picked Up & Inspected"
                            : isAccepted
                            ? "Pickup Accepted"
                            : "Assigned for Pickup"
                          : isRescheduled
                          ? "Rescheduled"
                          : task.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* Cancelled Alert Banner */}
                    {isCancelled && (
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          fontSize: "12px",
                          marginBottom: "12px",
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: "2px" }}>
                          Order Cancelled by Customer
                        </div>
                        <div>
                          Customer cancelled this order. Do not deliver. Please return the parcel to the store warehouse.
                        </div>
                      </div>
                    )}

                    {/* Rescheduled Notice Banner */}
                    {isRescheduled && (
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          color: "#92400e",
                          fontSize: "12px",
                          marginBottom: "12px",
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                          <CalendarIcon />
                          <span>Attempt Rescheduled</span>
                        </div>
                        {task.notes && <div style={{ marginTop: "3px", color: "#78350f" }}>{task.notes}</div>}
                        {task.estimated_delivery_at && (
                          <div style={{ marginTop: "4px", fontWeight: 700, color: "#b45309" }}>
                            Next Slot: {formatDisplayDateTime(task.estimated_delivery_at)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Customer Details */}
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "3px" }}>
                      {task.customer_name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, marginBottom: "12px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                      <MapPinIcon />
                      <span>{task.address.full}</span>
                    </div>

                    {/* One-Tap Action Row (Call + Maps) */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                      {task.customer_phone && (
                        <a
                          href={`tel:${formatPhoneDialable(task.customer_phone)}`}
                          style={{
                            flex: 1,
                            padding: "9px 10px",
                            borderRadius: "8px",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            color: "#15803d",
                            fontSize: "12px",
                            fontWeight: 700,
                            textAlign: "center",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                          }}
                        >
                          <PhoneIcon />
                          <span>Call Customer</span>
                        </a>
                      )}

                      <a
                        href={task.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          padding: "9px 10px",
                          borderRadius: "8px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1d4ed8",
                          fontSize: "12px",
                          fontWeight: 700,
                          textAlign: "center",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                        }}
                      >
                        <MapPinIcon />
                        <span>Navigate Maps</span>
                        <ExternalLinkIcon />
                      </a>
                    </div>

                    {/* Payment / Refund Value */}
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: isReturnPickup ? "#f5f3ff" : task.is_cod ? "#fffbeb" : "#f0fdf4",
                        border: `1px solid ${isReturnPickup ? "#ddd6fe" : task.is_cod ? "#fde68a" : "#bbf7d0"}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 700, color: isReturnPickup ? "#6b21a8" : task.is_cod ? "#b45309" : "#15803d" }}>
                        {isReturnPickup ? "Customer Return Refund (Do not collect cash)" : task.is_cod ? "COD — Collect Cash" : "Prepaid (Do Not Collect Cash)"}
                      </span>
                      <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                        {formatPrice(task.total_amount)}
                      </span>
                    </div>

                    {/* Items Summary */}
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px" }}>
                      <strong style={{ color: "#334155" }}>
                        {isReturnPickup ? "Items to Inspect & Pick Up" : "Package Contents"} ({task.items.length}):
                      </strong>{" "}
                      {task.items.map((i) => `${i.product_name} ×${i.quantity}${i.reason ? ` (${i.reason})` : ""}`).join(", ")}
                    </div>

                    {/* Action Buttons Grid */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {/* Return Pickup Actions */}
                      {isReturnPickup ? (
                        <>
                          {isAssigned && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(task.shipment_id, "accept")}
                                disabled={actionLoadingId === task.shipment_id}
                                style={{
                                  flex: 1,
                                  padding: "12px",
                                  borderRadius: "8px",
                                  background: "#7c3aed",
                                  color: "#ffffff",
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  border: "none",
                                  cursor: actionLoadingId === task.shipment_id ? "wait" : "pointer",
                                  boxShadow: "0 2px 4px rgba(124, 58, 237, 0.2)",
                                }}
                              >
                                {actionLoadingId === task.shipment_id ? "Accepting..." : "Accept Return Pickup"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeclineTask(task);
                                  setDeclineReason(DECLINE_REASONS[0]);
                                  setDeclineNote("");
                                }}
                                disabled={actionLoadingId === task.shipment_id}
                                style={{
                                  padding: "12px 14px",
                                  borderRadius: "8px",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  border: "1px solid #fecaca",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Decline
                              </button>
                            </div>
                          )}

                          {isAccepted && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const initialMap: Record<string, number> = {};
                                  task.items.forEach((it) => {
                                    const key = it.id || it.product_name;
                                    initialMap[key] = it.quantity_approved || it.quantity || 1;
                                  });
                                  setPickedQuantitiesMap(initialMap);
                                  setPickupInspectionNote("");
                                  setPickupVerifyTask(task);
                                }}
                                disabled={actionLoadingId === task.shipment_id}
                                style={{
                                  width: "100%",
                                  padding: "13px",
                                  borderRadius: "8px",
                                  background: "#16a34a",
                                  color: "#ffffff",
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  border: "none",
                                  cursor: actionLoadingId === task.shipment_id ? "wait" : "pointer",
                                  boxShadow: "0 4px 6px -1px rgba(22, 163, 74, 0.2)",
                                }}
                              >
                                ✓ Verify Items & Pick Up
                              </button>

                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDoorstepRejectTask(task);
                                    setDoorstepRejectReason(DOORSTEP_INSPECTION_REASONS[0]);
                                    setDoorstepRejectNote("");
                                  }}
                                  disabled={actionLoadingId === task.shipment_id}
                                  style={{
                                    flex: 1,
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    background: "#fef2f2",
                                    color: "#b91c1c",
                                    fontSize: "12.5px",
                                    fontWeight: 700,
                                    border: "1px solid #fecaca",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  ✕ Reject at Doorstep
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRescheduleTask(task);
                                    setRescheduleReason(RESCHEDULE_REASONS[0]);
                                    setRescheduleNote("");
                                  }}
                                  disabled={actionLoadingId === task.shipment_id}
                                  style={{
                                    flex: 1,
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    background: "#fffbeb",
                                    color: "#b45309",
                                    fontSize: "12.5px",
                                    fontWeight: 700,
                                    border: "1px solid #fde68a",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "5px",
                                  }}
                                >
                                  <CalendarIcon />
                                  <span>Reschedule</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {isPickedUpReturn && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(task.shipment_id, "delivered_to_hub")}
                              disabled={actionLoadingId === task.shipment_id}
                              style={{
                                width: "100%",
                                padding: "13px",
                                borderRadius: "8px",
                                background: "#2563eb",
                                color: "#ffffff",
                                fontSize: "14px",
                                fontWeight: 700,
                                border: "none",
                                cursor: actionLoadingId === task.shipment_id ? "wait" : "pointer",
                                boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
                              }}
                            >
                              {actionLoadingId === task.shipment_id ? "Handing over..." : "Handover Return Package at Store / Hub"}
                            </button>
                          )}
                        </>
                      ) : (
                        /* Forward Delivery Actions */
                        <>
                          {isCancelled ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(task.shipment_id, "return_to_hub")}
                              disabled={actionLoadingId === task.shipment_id}
                              style={{
                                width: "100%",
                                padding: "13px",
                                borderRadius: "8px",
                                background: "#dc2626",
                                color: "#ffffff",
                                fontSize: "14px",
                                fontWeight: 700,
                                border: "none",
                                cursor: actionLoadingId === task.shipment_id ? "wait" : "pointer",
                                boxShadow: "0 4px 6px -1px rgba(220, 38, 38, 0.2)",
                              }}
                            >
                              {actionLoadingId === task.shipment_id ? "Updating..." : "Return Parcel to Store Warehouse"}
                            </button>
                          ) : (
                            <>
                              {isAssigned && (
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(task.shipment_id, "accept")}
                                    disabled={actionLoadingId === task.shipment_id}
                                    style={{
                                      flex: 1,
                                      padding: "12px",
                                      borderRadius: "8px",
                                      background: "#2563eb",
                                      color: "#ffffff",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      border: "none",
                                      cursor: actionLoadingId === task.shipment_id ? "wait" : "pointer",
                                      boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                                    }}
                                  >
                                    {actionLoadingId === task.shipment_id ? "Accepting..." : "Accept Order"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeclineTask(task);
                                      setDeclineReason(DECLINE_REASONS[0]);
                                      setDeclineNote("");
                                    }}
                                    disabled={actionLoadingId === task.shipment_id}
                                    style={{
                                      padding: "12px 14px",
                                      borderRadius: "8px",
                                      background: "#fef2f2",
                                      color: "#b91c1c",
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      border: "1px solid #fecaca",
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}

                              {isAccepted && (
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(task.shipment_id, "out_for_delivery")}
                                    disabled={actionLoadingId === task.shipment_id}
                                    style={{
                                      flex: 1,
                                      padding: "13px",
                                      borderRadius: "8px",
                                      background: "#2563eb",
                                      color: "#ffffff",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      border: "none",
                                      cursor: actionLoadingId === task.shipment_id ? "wait" : "pointer",
                                      boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
                                    }}
                                  >
                                    {actionLoadingId === task.shipment_id ? "Starting Trip..." : "Start Trip / Out for Delivery"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeclineTask(task);
                                      setDeclineReason(DECLINE_REASONS[0]);
                                      setDeclineNote("");
                                    }}
                                    disabled={actionLoadingId === task.shipment_id}
                                    style={{
                                      padding: "12px 14px",
                                      borderRadius: "8px",
                                      background: "#fef2f2",
                                      color: "#b91c1c",
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      border: "1px solid #fecaca",
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}

                              {(isOutForDelivery || isRescheduled) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isRescheduled) {
                                        handleUpdateStatus(task.shipment_id, "out_for_delivery");
                                      } else {
                                        setDeliverOtpTask(task);
                                        setEnteredDeliveryOtp("");
                                        setDeliverOtpError(null);
                                      }
                                    }}
                                    disabled={actionLoadingId === task.shipment_id}
                                    style={{
                                      width: "100%",
                                      padding: "13px",
                                      borderRadius: "8px",
                                      background: isOutForDelivery ? "#16a34a" : "#2563eb",
                                      color: "#ffffff",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      border: "none",
                                      cursor: actionLoadingId === task.shipment_id ? "wait" : "pointer",
                                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.15)",
                                      transition: "all 0.15s ease",
                                    }}
                                  >
                                    {actionLoadingId === task.shipment_id
                                      ? "Updating..."
                                      : isRescheduled
                                      ? "Resume / Start Trip"
                                      : "Mark Delivered (Verify OTP)"}
                                  </button>

                                  {/* Unable to deliver / Reschedule Trigger Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRescheduleTask(task);
                                      setRescheduleReason(RESCHEDULE_REASONS[0]);
                                      setRescheduleNote("");
                                    }}
                                    disabled={actionLoadingId === task.shipment_id}
                                    style={{
                                      width: "100%",
                                      padding: "10px",
                                      borderRadius: "8px",
                                      background: "#fffbeb",
                                      color: "#b45309",
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      border: "1px solid #fde68a",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    <CalendarIcon />
                                    <span>
                                      {isRescheduled ? "Update Reschedule Slot / Notes" : "Unable to Deliver? Reschedule"}
                                    </span>
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: OPEN PICKUPS POOL */}
        {profile?.allow_open_pickup !== false && activeTab === "pool" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {pool.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 20px", background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>
                  No Open Orders Waiting
                </div>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  All orders for this store are currently assigned.
                </p>
              </div>
            ) : (
              pool.map((order) => (
                <div
                  key={order.order_id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    padding: "14px 16px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                      {order.customer_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPinIcon />
                      <span>{order.city || "Local"} · {order.item_count} item{order.item_count > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
                      {formatPrice(order.total_amount)}{" "}
                      <span style={{ fontSize: "11px", color: order.is_cod ? "#b45309" : "#15803d", fontWeight: 600 }}>
                        ({order.is_cod ? "COD" : "Prepaid"})
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClaimOrder(order.order_id)}
                    disabled={actionLoadingId === order.order_id}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "8px",
                      background: "#2563eb",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "none",
                      cursor: actionLoadingId === order.order_id ? "wait" : "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                    }}
                  >
                    {actionLoadingId === order.order_id ? "Claiming..." : "Claim Order"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "36px", fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>
          Powered by <span style={{ fontWeight: 700, color: "#475569" }}>WebCreon</span>
        </div>
      </div>

      {/* RESCHEDULE MODAL */}
      {rescheduleTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
            padding: "0",
          }}
          onClick={() => setRescheduleTask(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 32px",
              boxShadow: "0 -10px 25px rgba(0, 0, 0, 0.15)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                  Reschedule Delivery Attempt
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Order #{rescheduleTask.order_id.slice(0, 8).toUpperCase()} • {rescheduleTask.customer_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleTask(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus(rescheduleTask.shipment_id, "reschedule", {
                  reason: rescheduleReason,
                  rescheduled_at: rescheduleDateTime ? new Date(rescheduleDateTime).toISOString() : undefined,
                  notes: rescheduleNote.trim(),
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={modalLabelStyle}>Why was delivery unsuccessful?</label>
                <select
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  style={modalInputStyle}
                  required
                >
                  {RESCHEDULE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={modalLabelStyle}>Next Delivery Retry Date & Time</label>
                <input
                  type="datetime-local"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  style={modalInputStyle}
                  required
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
                  This retry time will be shown live to the customer and store admin.
                </span>
              </div>

              <div>
                <label style={modalLabelStyle}>Rider Note (Visible to Customer & Admin)</label>
                <textarea
                  rows={2}
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  placeholder="e.g. Called customer 3 times, phone was unreachable. Will re-attempt tomorrow afternoon."
                  style={{ ...modalInputStyle, resize: "none", fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setRescheduleTask(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === rescheduleTask.shipment_id}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#d97706",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: actionLoadingId === rescheduleTask.shipment_id ? "wait" : "pointer",
                    boxShadow: "0 2px 4px rgba(217, 119, 6, 0.2)",
                  }}
                >
                  {actionLoadingId === rescheduleTask.shipment_id ? "Saving..." : "Confirm Reschedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DECLINE MODAL */}
      {declineTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
            padding: "0",
          }}
          onClick={() => setDeclineTask(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 32px",
              boxShadow: "0 -10px 25px rgba(0, 0, 0, 0.15)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                  Decline Order Assignment
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Order #{declineTask.order_id.slice(0, 8).toUpperCase()} will return to the store pickup pool.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeclineTask(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus(declineTask.shipment_id, "reject", {
                  reason: declineReason,
                  notes: declineNote.trim(),
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={modalLabelStyle}>Reason for declining</label>
                <select
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  style={modalInputStyle}
                  required
                >
                  {DECLINE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={modalLabelStyle}>Additional Details (Optional)</label>
                <input
                  type="text"
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  placeholder="e.g. flat tyre, unable to reach today"
                  style={modalInputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setDeclineTask(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === declineTask.shipment_id}
                  style={{
                    flex: 1.5,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#b91c1c",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: actionLoadingId === declineTask.shipment_id ? "wait" : "pointer",
                  }}
                >
                  {actionLoadingId === declineTask.shipment_id ? "Declining..." : "Decline & Release"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOORSTEP INSPECTION REJECTION MODAL */}
      {doorstepRejectTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
            padding: "0",
          }}
          onClick={() => setDoorstepRejectTask(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 32px",
              boxShadow: "0 -10px 25px rgba(0, 0, 0, 0.15)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#991b1b" }}>
                  Doorstep Inspection Failure
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Decline return pickup at customer's doorstep if items are damaged, unsealed, or violated policy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDoorstepRejectTask(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus(doorstepRejectTask.shipment_id, "doorstep_rejected", {
                  reason: doorstepRejectReason,
                  notes: doorstepRejectNote.trim(),
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={modalLabelStyle}>Inspection Failure Reason</label>
                <select
                  value={doorstepRejectReason}
                  onChange={(e) => setDoorstepRejectReason(e.target.value)}
                  style={modalInputStyle}
                  required
                >
                  {DOORSTEP_INSPECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={modalLabelStyle}>Rider Physical Observation / Notes</label>
                <textarea
                  rows={2}
                  value={doorstepRejectNote}
                  onChange={(e) => setDoorstepRejectNote(e.target.value)}
                  placeholder="e.g. Seal was broken and product had visible stains / scratches."
                  style={{ ...modalInputStyle, resize: "none", fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setDoorstepRejectTask(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === doorstepRejectTask.shipment_id}
                  style={{
                    flex: 1.5,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#dc2626",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: actionLoadingId === doorstepRejectTask.shipment_id ? "wait" : "pointer",
                    boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
                  }}
                >
                  {actionLoadingId === doorstepRejectTask.shipment_id ? "Submitting..." : "Submit Doorstep Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOORSTEP RETURN ITEM PICKUP VERIFICATION MODAL */}
      {pickupVerifyTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
            padding: "0",
          }}
          onClick={() => setPickupVerifyTask(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 32px",
              boxShadow: "0 -10px 25px rgba(0, 0, 0, 0.15)",
              boxSizing: "border-box",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#15803d" }}>
                  Doorstep Return Verification
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Confirm the physical quantity handed over by the customer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickupVerifyTask(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus(pickupVerifyTask.shipment_id, "picked_up", {
                  picked_items: pickedQuantitiesMap,
                  notes: pickupInspectionNote.trim(),
                });
                setPickupVerifyTask(null);
              }}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={modalLabelStyle}>Return Items Inspection & Picked Count</label>
                {pickupVerifyTask.items.map((item, idx) => {
                  const key = item.id || item.product_name;
                  const reqQty = item.quantity_requested || item.quantity || 1;
                  const apprQty = item.quantity_approved || item.quantity || 1;
                  const curPicked = pickedQuantitiesMap[key] !== undefined ? pickedQuantitiesMap[key] : apprQty;

                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                            {item.product_name}
                          </div>
                          {item.variant && (
                            <span style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 600, background: "#f5f3ff", padding: "1px 6px", borderRadius: "4px", border: "1px solid #e9d5ff", display: "inline-block", marginTop: "2px" }}>
                              {item.variant}
                            </span>
                          )}
                          {item.reason && (
                            <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                              Reason: {item.reason.replaceAll("_", " ")}
                            </div>
                          )}
                        </div>

                        {/* Approved vs Requested pills */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", fontSize: "11px" }}>
                          <span style={{ color: "#475569", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                            Requested: {reqQty}
                          </span>
                          <span style={{ color: "#166534", background: "#dcfce7", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                            Approved: {apprQty}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Picked Quantity Controls */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                          Picked Count at Doorstep:
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => setPickedQuantitiesMap((p) => ({ ...p, [key]: Math.max(0, curPicked - 1) }))}
                            disabled={curPicked <= 0}
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              background: curPicked <= 0 ? "#f1f5f9" : "#ffffff",
                              color: "#0f172a",
                              fontWeight: 700,
                              cursor: curPicked <= 0 ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            −
                          </button>
                          <span style={{ fontSize: "14px", fontWeight: 800, color: curPicked < apprQty ? "#b45309" : "#15803d", minWidth: "24px", textAlign: "center" }}>
                            {curPicked}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPickedQuantitiesMap((p) => ({ ...p, [key]: Math.min(apprQty, curPicked + 1) }))}
                            disabled={curPicked >= apprQty}
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              background: curPicked >= apprQty ? "#f1f5f9" : "#ffffff",
                              color: "#0f172a",
                              fontWeight: 700,
                              cursor: curPicked >= apprQty ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label style={modalLabelStyle}>Physical Condition / Inspection Note</label>
                <textarea
                  rows={2}
                  value={pickupInspectionNote}
                  onChange={(e) => setPickupInspectionNote(e.target.value)}
                  placeholder="e.g. Tags and packaging intact. Item verified against order."
                  style={{ ...modalInputStyle, resize: "none", fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setPickupVerifyTask(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === pickupVerifyTask.shipment_id}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#16a34a",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: actionLoadingId === pickupVerifyTask.shipment_id ? "wait" : "pointer",
                    boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
                  }}
                >
                  {actionLoadingId === pickupVerifyTask.shipment_id ? "Saving..." : "Confirm Doorstep Pickup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELIVERY OTP VERIFICATION MODAL */}
      {deliverOtpTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
            padding: "0",
          }}
          onClick={() => setDeliverOtpTask(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 32px",
              boxShadow: "0 -10px 25px rgba(0, 0, 0, 0.15)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#ecfdf5",
                    color: "#16a34a",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "18px",
                  }}
                >
                  🔒
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                    Customer Delivery Verification
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Order #{deliverOtpTask.order_id.slice(0, 8).toUpperCase()} • {deliverOtpTask.customer_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliverOtpTask(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* COD Cash Alert */}
            {deliverOtpTask.is_cod && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#b45309" }}>
                  💵 Cash to Collect:
                </span>
                <span style={{ fontSize: "17px", fontWeight: 800, color: "#92400e" }}>
                  {formatPrice(deliverOtpTask.total_amount)}
                </span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!enteredDeliveryOtp || enteredDeliveryOtp.trim().length !== 4) {
                  setDeliverOtpError("Please enter a valid 4-digit code.");
                  return;
                }
                handleUpdateStatus(deliverOtpTask.shipment_id, "delivered", {
                  delivery_otp: enteredDeliveryOtp.trim(),
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label style={modalLabelStyle}>
                  Enter 4-Digit Delivery OTP (From Customer)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  value={enteredDeliveryOtp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setEnteredDeliveryOtp(val);
                    if (deliverOtpError) setDeliverOtpError(null);
                  }}
                  placeholder="• • • •"
                  style={{
                    ...modalInputStyle,
                    fontSize: "28px",
                    fontWeight: "900",
                    letterSpacing: "12px",
                    textAlign: "center",
                    fontFamily: "monospace",
                    height: "56px",
                    borderColor: deliverOtpError ? "#ef4444" : "#cbd5e1",
                    background: "#f8fafc",
                  }}
                  required
                />
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block", textAlign: "center" }}>
                  Ask the customer for the verification code shown on their order screen.
                </span>
              </div>

              {deliverOtpError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {deliverOtpError}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setDeliverOtpTask(null)}
                  style={{
                    flex: 1,
                    padding: "13px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === deliverOtpTask.shipment_id || enteredDeliveryOtp.length !== 4}
                  style={{
                    flex: 2,
                    padding: "13px",
                    borderRadius: "8px",
                    background: enteredDeliveryOtp.length === 4 ? "#16a34a" : "#94a3b8",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: actionLoadingId === deliverOtpTask.shipment_id || enteredDeliveryOtp.length !== 4 ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
                  }}
                >
                  {actionLoadingId === deliverOtpTask.shipment_id ? "Verifying..." : "Verify OTP & Complete Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELIVERY SUCCESS CONFIRMATION MODAL */}
      {deliverySuccessTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: "20px 16px",
            boxSizing: "border-box",
          }}
          onClick={() => setDeliverySuccessTask(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#ffffff",
              borderRadius: "24px",
              padding: "28px 22px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
              boxSizing: "border-box",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Big Animated Success Badge */}
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontSize: "32px",
                margin: "0 auto 14px",
                boxShadow: "0 10px 20px rgba(16, 185, 129, 0.35)",
              }}
            >
              ✓
            </div>

            <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 900, color: "#0f172a" }}>
              Delivery Confirmed!
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#64748b" }}>
              OTP verified successfully. Order is marked as delivered.
            </p>

            {/* Order Summary Details Card */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "18px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: "10px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Order
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                    #{deliverySuccessTask.order_id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    background: "#dcfce7",
                    color: "#15803d",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  ● Delivered
                </div>
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Customer
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                  {deliverySuccessTask.customer_name}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", lineHeight: 1.4 }}>
                  {deliverySuccessTask.address.full}
                </div>
              </div>

              {/* Payment Summary */}
              <div
                style={{
                  marginTop: "4px",
                  padding: "12px",
                  borderRadius: "12px",
                  background: deliverySuccessTask.is_cod ? "#fffbeb" : "#f0fdf4",
                  border: `1px solid ${deliverySuccessTask.is_cod ? "#fde68a" : "#bbf7d0"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: deliverySuccessTask.is_cod ? "#b45309" : "#15803d",
                      textTransform: "uppercase",
                    }}
                  >
                    {deliverySuccessTask.is_cod ? "💵 Cash Collected" : "💳 Prepaid (Paid Online)"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    {deliverySuccessTask.is_cod ? "Credited to Cash in Hand" : "No cash collected"}
                  </div>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>
                  {formatPrice(deliverySuccessTask.total_amount)}
                </div>
              </div>
            </div>

            {/* Close / Return to Route Button */}
            <button
              type="button"
              onClick={() => setDeliverySuccessTask(null)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              Close Order & Back to Route →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const modalLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#334155",
  marginBottom: "5px",
};

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  color: "#0f172a",
  background: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
};
