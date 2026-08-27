import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { Pagination } from "./Pagination";
import GlassToast from "./GlassToast";
import { GoogleMapPicker, GeoPickerResult } from "./GoogleMapPicker";

export type DeliveryMode = "own_agent" | "shiprocket" | "hybrid" | "manual";

export type DeliverySettingsData = {
  delivery_mode: DeliveryMode;
  enable_fleet?: boolean;
  enable_shiprocket?: boolean;
  enable_manual?: boolean;
  own_delivery_radius_km: number;
  allow_open_pickup?: boolean;
  shiprocket_email: string;
  shiprocket_connected: boolean;
  shiprocket_saved?: boolean;
  shiprocket_verified?: boolean;
  default_courier_preference: string;
  auto_assign_courier: boolean;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_pincode: string;
  sender_city: string;
  sender_state: string;
  sender_latitude?: number | null;
  sender_longitude?: number | null;
  shiprocket_delivery_radius_km?: number | null;
  default_weight_grams: number;
};

export type Agent = {
  id: string;
  name: string;
  phone: string;
  vehicle_type?: string;
  has_password?: boolean;
  cash_in_hand?: number;
  is_active: boolean;
  current_order_count: number;
  total_deliveries: number;
  last_active_at?: string;
  created_at?: string;
};

function formatPrice(amt?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amt || 0);
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

function formatPhoneDisplay(phone: string): string {
  const clean = clean10DigitPhone(phone);
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone ? `+91 ${phone}` : "";
}

const PhoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const KeyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5M16 7l-4 4-2-2-7 7v4h4l7-7-2-2 4-4z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ToggleSwitch = ({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    style={{
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      width: "38px",
      height: "22px",
      flexShrink: 0,
      cursor: disabled ? "not-allowed" : "pointer",
      borderRadius: "999px",
      border: "none",
      backgroundColor: checked ? "#2563eb" : "#cbd5e1",
      transition: "background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      padding: "2px",
      outline: "none",
      boxSizing: "border-box",
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
        transform: checked ? "translateX(16px)" : "translateX(0px)",
        transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    />
  </button>
);

const getCachedDeliverySettings = (id?: string): DeliverySettingsData | null => {
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`wc_admin_delivery_settings_${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getCachedAgents = (id?: string): Agent[] => {
  if (!id || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`wc_admin_agents_${id}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export default function DeliverySettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();

  const cachedSettings = getCachedDeliverySettings(siteId);
  const cachedAgents = getCachedAgents(siteId);

  const [settings, setSettings] = useState<DeliverySettingsData>(() => cachedSettings || {
    delivery_mode: "manual",
    enable_fleet: true,
    enable_shiprocket: false,
    enable_manual: true,
    own_delivery_radius_km: 10,
    allow_open_pickup: true,
    shiprocket_email: "",
    shiprocket_connected: false,
    default_courier_preference: "",
    auto_assign_courier: true,
    sender_name: "",
    sender_phone: "",
    sender_address: "",
    sender_pincode: "",
    sender_city: "",
    sender_state: "",
    default_weight_grams: 500,
  });

  const [srPassword, setSrPassword] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState<string>(() => cachedSettings ? JSON.stringify({ settings: cachedSettings, srPassword: "" }) : "");
  const [loadingSettings, setLoadingSettings] = useState(!cachedSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showStoreMapPicker, setShowStoreMapPicker] = useState(false);

  // Top 3-Tab navigation: fleet | shiprocket | manual
  type DeliveryTab = "fleet" | "shiprocket" | "manual";
  const [activeTab, setActiveTab] = useState<DeliveryTab>("fleet");

  // Agents state
  const [agents, setAgents] = useState<Agent[]>(cachedAgents);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Close filter popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (activityFilter !== "all") count++;
    if (vehicleFilter !== "all") count++;
    if (sortBy !== "default") count++;
    return count;
  }, [statusFilter, activityFilter, vehicleFilter, sortBy]);

  const resetFilters = () => {
    setStatusFilter("all");
    setActivityFilter("all");
    setVehicleFilter("all");
    setSortBy("default");
    setCurrentPage(1);
  };

  // New agent form
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");
  const [newAgentPin, setNewAgentPin] = useState("");
  const [newAgentVehicle, setNewAgentVehicle] = useState("bike");
  const [addingAgent, setAddingAgent] = useState(false);

  // Reset PIN modal
  const [resetPinAgent, setResetPinAgent] = useState<Agent | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");
  const [resettingPin, setResettingPin] = useState(false);

  // Settle Cash modal
  const [settleCashAgent, setSettleCashAgent] = useState<Agent | null>(null);
  const [settleCashAmount, setSettleCashAmount] = useState<string>("");
  const [settleCashNotes, setSettleCashNotes] = useState<string>("");
  const [settlingCash, setSettlingCash] = useState(false);

  // Toast
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const showFeedback = (msg: string, type: "success" | "error" | "info" = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    const current = JSON.stringify({ settings, srPassword });
    return current !== initialSnapshot;
  }, [settings, srPassword, initialSnapshot]);

  const fetchSettings = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/settings/${siteId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setInitialSnapshot(JSON.stringify({ settings: data, srPassword: "" }));
        try {
          localStorage.setItem(`wc_admin_delivery_settings_${siteId}`, JSON.stringify(data));
        } catch (_) {}
      }
    } catch (err) {
      console.error("Failed to load delivery settings", err);
    } finally {
      setLoadingSettings(false);
    }
  }, [siteId]);

  const fetchAgents = useCallback(async (showLoader = true) => {
    if (!siteId) return;
    try {
      if (showLoader && agents.length === 0) setLoadingAgents(true);
      const res = await fetch(`${API_BASE_URL}/delivery/agents/${siteId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const validAgents = Array.isArray(data) ? data : [];
        setAgents(validAgents);
        try {
          localStorage.setItem(`wc_admin_agents_${siteId}`, JSON.stringify(validAgents));
        } catch (_) {}
      }
    } catch (err) {
      console.error("Failed to load delivery agents", err);
    } finally {
      setLoadingAgents(false);
    }
  }, [siteId, agents.length]);

  useEffect(() => {
    if (!siteId) return;
    fetchSettings();
    fetchAgents();
  }, [siteId, fetchSettings, fetchAgents]);

  const saveSettings = async (overrides?: Partial<DeliverySettingsData>) => {
    if (!siteId) return;
    setSavingSettings(true);
    try {
      const payload = {
        ...settings,
        ...(overrides || {}),
      };

      if (payload.shiprocket_email && payload.shiprocket_email.trim()) {
        const emailClean = payload.shiprocket_email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
          showFeedback("Please enter a valid Shiprocket account email address (e.g. name@domain.com)", "error");
          setSavingSettings(false);
          return;
        }
      }

      const body: Record<string, any> = {
        delivery_mode: payload.delivery_mode,
        enable_fleet: Boolean(payload.enable_fleet),
        enable_shiprocket: Boolean(payload.enable_shiprocket),
        enable_manual: Boolean(payload.enable_manual),
        own_delivery_radius_km: Number(payload.own_delivery_radius_km) || 10,
        allow_open_pickup: payload.allow_open_pickup !== undefined ? Boolean(payload.allow_open_pickup) : true,
        shiprocket_email: payload.shiprocket_email?.trim() || "",
        default_courier_preference: payload.default_courier_preference || "",
        auto_assign_courier: Boolean(payload.auto_assign_courier),
        sender_name: payload.sender_name || "",
        sender_phone: payload.sender_phone || "",
        sender_address: payload.sender_address || "",
        sender_pincode: payload.sender_pincode || "",
        sender_city: payload.sender_city || "",
        sender_state: payload.sender_state || "",
        sender_latitude: payload.sender_latitude !== undefined ? payload.sender_latitude : null,
        sender_longitude: payload.sender_longitude !== undefined ? payload.sender_longitude : null,
        shiprocket_delivery_radius_km: payload.shiprocket_delivery_radius_km !== undefined ? (Number(payload.shiprocket_delivery_radius_km) || null) : null,
        default_weight_grams: Number(payload.default_weight_grams) || 500,
      };

      if (srPassword) {
        body.shiprocket_password = srPassword;
      }

      const res = await fetch(`${API_BASE_URL}/delivery/settings/${siteId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        let errMsg = "Failed to save settings";
        if (typeof errData?.detail === "string") {
          errMsg = errData.detail;
        } else if (Array.isArray(errData?.detail) && errData.detail[0]?.msg) {
          errMsg = errData.detail.map((e: any) => e.msg).join(", ");
        }
        throw new Error(errMsg);
      }

      showFeedback("Delivery settings saved successfully", "success");
      setInitialSnapshot(JSON.stringify({ settings: payload, srPassword: "" }));
      setSrPassword("");
      await fetchSettings();
    } catch (err: any) {
      showFeedback(err.message || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const testShiprocket = async () => {
    if (!siteId) return;
    if (!settings.shiprocket_email || !settings.shiprocket_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.shiprocket_email.trim())) {
      showFeedback("Please enter and save a valid Shiprocket account email address first.", "error");
      return;
    }
    setTestingConnection(true);
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/settings/${siteId}/test-shiprocket`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || "Connected to Shiprocket successfully!", "success");
        await fetchSettings();
      } else {
        const detail = data.detail || "Connection failed. Please check credentials.";
        if (detail.includes("Temporarily Locked") || detail.includes("too many failed") || detail.includes("User blocked")) {
          showFeedback("Shiprocket account temporarily locked (too many failed attempts). Please wait 15–20 minutes.", "error");
        } else if (detail.includes("Invalid") || detail.includes("401") || detail.includes("422") || detail.includes("combination") || detail.includes("Authentication failed")) {
          showFeedback("Invalid Shiprocket credentials. The email or password is incorrect.", "error");
        } else {
          showFeedback(detail, "error");
        }
      }
    } catch {
      showFeedback("Network error while testing Shiprocket connection.", "error");
    } finally {
      setTestingConnection(false);
    }
  };

  const addAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = clean10DigitPhone(newAgentPhone);
    if (!siteId || !newAgentName.trim() || !cleanPhone) {
      showFeedback("Please provide both name and mobile number", "error");
      return;
    }
    if (cleanPhone.length !== 10) {
      showFeedback("Mobile number must be exactly 10 digits.", "error");
      return;
    }
    if (!newAgentPin.trim()) {
      showFeedback("Please set a login PIN for this rider.", "error");
      return;
    }
    setAddingAgent(true);
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/agents/${siteId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAgentName.trim(),
          phone: cleanPhone,
          password: newAgentPin.trim(),
          vehicle_type: newAgentVehicle || "bike",
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Failed to add agent" }));
        throw new Error(errData.detail || "Failed to add agent");
      }
      setNewAgentName("");
      setNewAgentPhone("");
      setNewAgentPin("");
      setNewAgentVehicle("bike");
      setShowAgentForm(false);
      showFeedback("Delivery agent registered successfully", "success");
      await fetchAgents(false);
    } catch (err: any) {
      showFeedback(err.message || "Failed to add agent", "error");
    } finally {
      setAddingAgent(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !resetPinAgent || !resetPinValue.trim()) return;
    setResettingPin(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/delivery/agents/${siteId}/${resetPinAgent.id}/reset-password`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: resetPinValue.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to update PIN" }));
        throw new Error(err.detail || "Failed to update PIN");
      }
      showFeedback(`PIN updated for ${resetPinAgent.name}`, "success");
      setResetPinAgent(null);
      setResetPinValue("");
      await fetchAgents(false);
    } catch (err: any) {
      showFeedback(err.message || "Failed to reset PIN", "error");
    } finally {
      setResettingPin(false);
    }
  };

  const handleSettleCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !settleCashAgent) return;
    setSettlingCash(true);
    try {
      const amountNum = settleCashAmount ? parseFloat(settleCashAmount) : null;
      const res = await fetch(
        `${API_BASE_URL}/delivery/agents/${siteId}/${settleCashAgent.id}/settle-cash`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amountNum,
            notes: settleCashNotes.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to settle cash" }));
        throw new Error(err.detail || "Failed to settle cash");
      }
      const data = await res.json();
      showFeedback(data.message || `Cash settled for ${settleCashAgent.name}`, "success");
      setSettleCashAgent(null);
      setSettleCashAmount("");
      setSettleCashNotes("");
      await fetchAgents(false);
    } catch (err: any) {
      showFeedback(err.message || "Failed to settle cash", "error");
    } finally {
      setSettlingCash(false);
    }
  };

  const toggleAgent = async (agent: Agent) => {
    if (!siteId) return;
    const nextState = !agent.is_active;
    // Optimistic UI update: instant change with zero lag and zero reload flicker
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, is_active: nextState } : a))
    );
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/agents/${siteId}/${agent.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextState }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      showFeedback(`Agent ${nextState ? "activated" : "deactivated"}`, "success");
      await fetchAgents(false);
    } catch (err: any) {
      // Revert optimistic update on failure
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, is_active: agent.is_active } : a))
      );
      showFeedback(err.message || "Failed to update agent", "error");
    }
  };

  const deleteAgent = async (agent: Agent) => {
    if (!siteId) return;
    if (!window.confirm(`Are you sure you want to remove ${agent.name}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/agents/${siteId}/${agent.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
      showFeedback("Agent removed", "success");
      await fetchAgents(false);
    } catch (err: any) {
      showFeedback(err.message || "Failed to remove agent", "error");
    }
  };

  // Fleet stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.is_active).length;
  const totalCompletedDeliveries = agents.reduce((sum, a) => sum + (a.total_deliveries || 0), 0);
  const totalCashInHand = agents.reduce((sum, a) => sum + (a.cash_in_hand || 0), 0);

  // Filtered agents
  const filteredAgents = useMemo(() => {
    let list = [...agents];

    // Status filter
    if (statusFilter === "active") {
      list = list.filter((a) => a.is_active);
    } else if (statusFilter === "inactive") {
      list = list.filter((a) => !a.is_active);
    }

    // Activity & Cash filter
    if (activityFilter === "cash_in_hand") {
      list = list.filter((a) => (a.cash_in_hand || 0) > 0);
    } else if (activityFilter === "zero_orders") {
      list = list.filter((a) => (a.current_order_count || 0) === 0);
    } else if (activityFilter === "active_orders") {
      list = list.filter((a) => (a.current_order_count || 0) > 0);
    }

    // Vehicle Type filter
    if (vehicleFilter !== "all") {
      list = list.filter((a) => (a.vehicle_type || "bike").toLowerCase() === vehicleFilter);
    }

    // Sort order
    if (sortBy === "most_deliveries") {
      list.sort((a, b) => (b.total_deliveries || 0) - (a.total_deliveries || 0));
    } else if (sortBy === "highest_cash") {
      list.sort((a, b) => (b.cash_in_hand || 0) - (a.cash_in_hand || 0));
    }

    // Search query
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        (a.vehicle_type || "").toLowerCase().includes(q)
    );
  }, [agents, searchQuery, statusFilter, activityFilter, vehicleFilter, sortBy]);
  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / pageSize));
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, currentPage, pageSize]);

  const isFleetEnabled = settings.enable_fleet !== undefined ? Boolean(settings.enable_fleet) : (settings.delivery_mode === "own_agent" || settings.delivery_mode === "hybrid");
  const isShiprocketEnabled = settings.enable_shiprocket !== undefined ? Boolean(settings.enable_shiprocket) : (settings.delivery_mode === "shiprocket" || settings.delivery_mode === "hybrid");
  const isManualEnabled = settings.enable_manual !== undefined ? Boolean(settings.enable_manual) : (settings.delivery_mode === "manual");

  const activeOptionsCount =
    (isFleetEnabled ? 1 : 0) +
    (isShiprocketEnabled ? 1 : 0) +
    (isManualEnabled ? 1 : 0);

  const toggleFleet = (enabled: boolean) => {
    if (!enabled && isFleetEnabled && activeOptionsCount <= 1) {
      showFeedback("At least one delivery method must remain active.", "info");
      return;
    }
    setSettings((p) => {
      const nextFleet = enabled;
      const nextSr = p.enable_shiprocket !== undefined ? Boolean(p.enable_shiprocket) : (p.delivery_mode === "shiprocket" || p.delivery_mode === "hybrid");
      
      let nextMode: DeliveryMode = "manual";
      if (nextFleet && nextSr) nextMode = "hybrid";
      else if (nextFleet) nextMode = "own_agent";
      else if (nextSr) nextMode = "shiprocket";
      else nextMode = "manual";

      return {
        ...p,
        enable_fleet: nextFleet,
        delivery_mode: nextMode,
      };
    });
  };

  const toggleShiprocket = (enabled: boolean) => {
    if (!enabled && isShiprocketEnabled && activeOptionsCount <= 1) {
      showFeedback("At least one delivery method must remain active.", "info");
      return;
    }
    setSettings((p) => {
      const nextFleet = p.enable_fleet !== undefined ? Boolean(p.enable_fleet) : (p.delivery_mode === "own_agent" || p.delivery_mode === "hybrid");
      const nextSr = enabled;

      let nextMode: DeliveryMode = "manual";
      if (nextFleet && nextSr) nextMode = "hybrid";
      else if (nextFleet) nextMode = "own_agent";
      else if (nextSr) nextMode = "shiprocket";
      else nextMode = "manual";

      return {
        ...p,
        enable_shiprocket: nextSr,
        delivery_mode: nextMode,
      };
    });
  };

  const toggleManual = (enabled: boolean) => {
    if (!enabled && isManualEnabled && activeOptionsCount <= 1) {
      showFeedback("At least one delivery method must remain active.", "info");
      return;
    }
    setSettings((p) => {
      const nextManual = enabled;
      return {
        ...p,
        enable_manual: nextManual,
      };
    });
  };

  const currentTabEnabled =
    activeTab === "fleet"
      ? isFleetEnabled
      : activeTab === "shiprocket"
      ? isShiprocketEnabled
      : isManualEnabled;

  const handleStoreMapConfirm = async (result: GeoPickerResult) => {
    setShowStoreMapPicker(false);
    const updatedSettings = {
      ...settings,
      sender_latitude: result.lat,
      sender_longitude: result.lng,
      // Auto-fill all warehouse / store pickup address fields from reverse geocode
      sender_address: result.addressLine || settings.sender_address,
      sender_city: result.city || settings.sender_city,
      sender_state: result.state || settings.sender_state,
      sender_pincode: result.pincode || settings.sender_pincode,
    };
    setSettings(updatedSettings);
    await saveSettings({
      sender_latitude: result.lat,
      sender_longitude: result.lng,
      sender_address: updatedSettings.sender_address,
      sender_city: updatedSettings.sender_city,
      sender_state: updatedSettings.sender_state,
      sender_pincode: updatedSettings.sender_pincode,
    });
    showFeedback("Store & Warehouse location updated from Map!", "success");
  };

  if (loadingSettings) {
    return (
      <div style={{ maxWidth: "1100px", padding: "48px 0", textAlign: "center", color: "#64748b" }}>
        <p style={{ fontSize: "14px", fontWeight: 500 }}>Loading delivery settings...</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", color: "#0f172a", boxSizing: "border-box" }}>
      {/* Toast Feedback */}
      {feedback && (
        <GlassToast
          message={feedback.msg}
          type={feedback.type}
          onClose={() => setFeedback(null)}
          top="76px"
        />
      )}

      {/* Top Header Card (Segmented Tab Strip on Left + Active Tab Toggle Switch & Save Button on Right) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Segmented Pill Switcher */}
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: "3px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            gap: "2px",
          }}
        >
          {(
            [
              { id: "fleet", label: "Own Delivery Fleet", enabled: isFleetEnabled },
              { id: "shiprocket", label: "Shiprocket Courier", enabled: isShiprocketEnabled },
              { id: "manual", label: "Manual Courier", enabled: isManualEnabled },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  borderRadius: "6px",
                  padding: "6px 14px",
                  border: "none",
                  background: isActive ? "#ffffff" : "transparent",
                  color: isActive ? "#0f172a" : "#64748b",
                  boxShadow: isActive
                    ? "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                    : "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    minWidth: "6px",
                    borderRadius: "999px",
                    background: tab.enabled ? "#16a34a" : "#cbd5e1",
                    display: "inline-block",
                    transition: "background 0.2s ease",
                  }}
                  title={tab.enabled ? "Active" : "Disabled"}
                />
              </button>
            );
          })}
        </div>

        {/* Right Actions: Current Tab Toggle Switch + Save Settings Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Active Tab Toggle Switch */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#f8fafc",
              padding: "4px 10px 4px 12px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: currentTabEnabled ? "#0f172a" : "#64748b" }}>
              {currentTabEnabled ? "Active" : "Inactive"}
            </span>
            <ToggleSwitch
              checked={currentTabEnabled}
              onChange={(val) => {
                if (activeTab === "fleet") toggleFleet(val);
                else if (activeTab === "shiprocket") toggleShiprocket(val);
                else if (activeTab === "manual") toggleManual(val);
              }}
            />
          </div>

          {/* Save Settings Button */}
          <button
            type="button"
            onClick={() => saveSettings()}
            disabled={savingSettings}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              border: "none",
              background: hasUnsavedChanges ? "#2563eb" : "#0f172a",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: savingSettings ? "wait" : "pointer",
              boxShadow: hasUnsavedChanges ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
              opacity: savingSettings ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OWN DELIVERY FLEET                                                 */}
      {/* ========================================================================= */}
      {activeTab === "fleet" && (
        <div
          style={{
            opacity: isFleetEnabled ? 1 : 0.45,
            pointerEvents: isFleetEnabled ? "auto" : "none",
            filter: isFleetEnabled ? "none" : "grayscale(0.6)",
            transition: "opacity 0.2s ease, filter 0.2s ease",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
              {/* Top Bar: Left = Open Pickup Toggle, Right = Status Filter & Search */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "14px",
                  flexWrap: "wrap",
                  padding: "10px 14px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                {/* Left: Open Pickup Pool Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: "36px",
                      height: "20px",
                      cursor: "pointer",
                      margin: 0,
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings.allow_open_pickup}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          allow_open_pickup: e.target.checked,
                        }))
                      }
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: settings.allow_open_pickup ? "#2563eb" : "#cbd5e1",
                        borderRadius: "20px",
                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          height: "14px",
                          width: "14px",
                          left: settings.allow_open_pickup ? "18px" : "3px",
                          bottom: "3px",
                          backgroundColor: "#ffffff",
                          borderRadius: "50%",
                          transition: "0.2s",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }}
                      />
                    </span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>
                      Open Pickup Pool
                    </span>
                    <InfoTooltip text="Allow active riders to claim unassigned ready orders" />
                  </div>
                </div>

                {/* Right: Search & Filter Control matching TenantEarningsPage */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flex: "1 1 300px",
                    maxWidth: "520px",
                    justifyContent: "flex-end",
                  }}
                >
                  {/* Search input container */}
                  <div
                    style={{
                      position: "relative",
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Search rider by name, phone, vehicle..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{
                        width: "100%",
                        height: "32px",
                        padding: "0 28px 0 10px",
                        fontSize: "12px",
                        color: "#0f172a",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        style={{
                          position: "absolute",
                          right: "6px",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: "2px",
                          display: "grid",
                          placeItems: "center",
                        }}
                        title="Clear search"
                      >
                        <XMarkIcon />
                      </button>
                    ) : (
                      <span
                        style={{
                          position: "absolute",
                          right: "8px",
                          pointerEvents: "none",
                          color: "#94a3b8",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <SearchIcon />
                      </span>
                    )}
                  </div>

                  {/* Filter Dropdown Toggle Button */}
                  <div style={{ position: "relative" }} ref={filterPopoverRef}>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      style={{
                        height: "32px",
                        padding: "0 10px",
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: activeFilterCount > 0 ? "#93c5fd" : "#cbd5e1",
                        background: activeFilterCount > 0 ? "#eff6ff" : "#ffffff",
                        color: activeFilterCount > 0 ? "#1d4ed8" : "#475569",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <FilterIcon />
                      <span>Filter</span>
                      {activeFilterCount > 0 && (
                        <span
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            fontSize: "10px",
                            fontWeight: 700,
                            borderRadius: "999px",
                            padding: "1px 5px",
                            lineHeight: "1.2",
                          }}
                        >
                          {activeFilterCount}
                        </span>
                      )}
                    </button>

                    {/* Popover Menu for Multi-Criteria Filtering */}
                    {isFilterOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          right: 0,
                          width: "280px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                          padding: "14px",
                          zIndex: 50,
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Filter Riders</span>
                          {activeFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={resetFilters}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#2563eb",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              Reset All
                            </button>
                          )}
                        </div>

                        {/* Status Filter */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Status</span>
                          <select
                            value={statusFilter}
                            onChange={(e) => {
                              setStatusFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            style={{ ...inputStyle, height: "30px", fontSize: "12px", padding: "0 8px" }}
                          >
                            <option value="all">All Riders</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Inactive Only</option>
                          </select>
                        </div>

                        {/* Activity / Cash Filter */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Activity & Cash</span>
                          <select
                            value={activityFilter}
                            onChange={(e) => {
                              setActivityFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            style={{ ...inputStyle, height: "30px", fontSize: "12px", padding: "0 8px" }}
                          >
                            <option value="all">All Activities</option>
                            <option value="cash_in_hand">With Cash in Hand (COD)</option>
                            <option value="active_orders">Currently on Delivery</option>
                            <option value="zero_orders">Idle (0 Active Orders)</option>
                          </select>
                        </div>

                        {/* Vehicle Type Filter */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Vehicle Type</span>
                          <select
                            value={vehicleFilter}
                            onChange={(e) => {
                              setVehicleFilter(e.target.value);
                              setCurrentPage(1);
                            }}
                            style={{ ...inputStyle, height: "30px", fontSize: "12px", padding: "0 8px" }}
                          >
                            <option value="all">All Vehicles</option>
                            <option value="bike">Motorcycle / Bike</option>
                            <option value="scooter">Scooter / EV</option>
                            <option value="van">Delivery Van</option>
                            <option value="walking">On Foot</option>
                          </select>
                        </div>

                        {/* Sort Order */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Sort Order</span>
                          <select
                            value={sortBy}
                            onChange={(e) => {
                              setSortBy(e.target.value);
                              setCurrentPage(1);
                            }}
                            style={{ ...inputStyle, height: "30px", fontSize: "12px", padding: "0 8px" }}
                          >
                            <option value="default">Default Order</option>
                            <option value="most_deliveries">Highest Completed Deliveries</option>
                            <option value="highest_cash">Highest Pending Cash in Hand</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsFilterOpen(false)}
                          style={{
                            ...primaryButtonStyle,
                            height: "32px",
                            padding: 0,
                            fontSize: "12px",
                            marginTop: "2px",
                          }}
                        >
                          Apply Filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary Stat Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "12px",
                  width: "100%",
                }}
              >
                <StatCard label="Registered Riders" value={String(totalAgents)} />
                <StatCard label="Active on Duty" value={String(activeAgents)} />
                <StatCard label="Total Deliveries" value={String(totalCompletedDeliveries)} />
                <StatCard label="COD in Hand" value={formatPrice(totalCashInHand)} />
              </div>

              {/* Action Row: Left = Serviceable Delivery Radius, Right = Add Agent Button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                {/* Left: Compact Serviceable Radius + Store Location Pin */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
                    Serviceable Radius:
                  </span>
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      placeholder="10"
                      value={settings.own_delivery_radius_km}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          own_delivery_radius_km: Number(e.target.value) || 0,
                        }))
                      }
                      style={{
                        width: "48px",
                        height: "28px",
                        padding: "0 6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#0f172a",
                        border: "1px solid #cbd5e1",
                        borderRadius: "5px 0 0 5px",
                        background: "#ffffff",
                        textAlign: "center",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <span
                      style={{
                        height: "28px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 7px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderLeft: "none",
                        borderRadius: "0 5px 5px 0",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#64748b",
                        boxSizing: "border-box",
                        userSelect: "none",
                      }}
                    >
                      KM
                    </span>
                  </div>

                  {/* Store Location Pin Button */}
                  <button
                    type="button"
                    onClick={() => setShowStoreMapPicker(true)}
                    style={{
                      height: "28px",
                      padding: "0 10px",
                      border: `1px solid ${settings.sender_latitude ? "#2563eb" : "#cbd5e1"}`,
                      borderRadius: "5px",
                      background: settings.sender_latitude ? "#eff6ff" : "#ffffff",
                      color: settings.sender_latitude ? "#1d4ed8" : "#475569",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      whiteSpace: "nowrap",
                    }}
                    title="Pin your store location on the map for accurate delivery radius calculation"
                  >
                    📍 {settings.sender_latitude ? "Store Location Set ✓" : "Set Store Location"}
                  </button>
                </div>

                {/* Right: Add Agent Button */}
                <button
                  type="button"
                  onClick={() => setShowAgentForm(!showAgentForm)}
                  style={{ ...primaryButtonStyle, height: "30px", padding: "0 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                >
                  {showAgentForm ? "Cancel" : "+ Add delivery agent"}
                </button>
              </div>

              {/* Inline Add Agent Form Card */}
              {showAgentForm && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    padding: "16px 18px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: "10px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>
                        Register Delivery Agent
                      </h3>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                        Create login credentials for local fleet riders to accept and deliver customer orders.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAgentForm(false)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        padding: "4px",
                        display: "grid",
                        placeItems: "center",
                      }}
                      title="Close form"
                    >
                      <XMarkIcon />
                    </button>
                  </div>

                  <form onSubmit={addAgent} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Row 1: Name & Phone */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px 16px",
                      }}
                    >
                      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={labelStyle}>Full Name *</span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Sharma"
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                          style={{ ...inputStyle, height: "34px" }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={labelStyle}>Mobile Phone (10 Digits) *</span>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span
                            style={{
                              height: "34px",
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "0 9px",
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRight: "none",
                              borderRadius: "6px 0 0 6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "#475569",
                              whiteSpace: "nowrap",
                              boxSizing: "border-box",
                            }}
                          >
                            +91
                          </span>
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            placeholder="8825255108"
                            value={newAgentPhone}
                            onChange={(e) => setNewAgentPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                            style={{
                              ...inputStyle,
                              height: "34px",
                              borderRadius: "0 6px 6px 0",
                            }}
                          />
                        </div>
                      </label>
                    </div>

                    {/* Row 2: Login PIN & Vehicle Type */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px 16px",
                      }}
                    >
                      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={labelStyle}>Login PIN (4–6 Digits) *</span>
                        <input
                          type="password"
                          required
                          maxLength={6}
                          placeholder="Enter 4 to 6 digit PIN"
                          value={newAgentPin}
                          onChange={(e) => setNewAgentPin(e.target.value)}
                          style={{ ...inputStyle, height: "34px" }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={labelStyle}>Assigned Vehicle</span>
                        <select
                          value={newAgentVehicle}
                          onChange={(e) => setNewAgentVehicle(e.target.value)}
                          style={{ ...inputStyle, height: "34px" }}
                        >
                          <option value="bike">Motorcycle / Bike</option>
                          <option value="scooter">Scooter / EV</option>
                          <option value="van">Delivery Van</option>
                          <option value="walking">On Foot / Walking</option>
                        </select>
                      </label>
                    </div>

                    {/* Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: "8px",
                        paddingTop: "6px",
                        borderTop: "1px solid #f8fafc",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowAgentForm(false)}
                        style={{ ...ghostButtonStyle, height: "32px", padding: "0 14px", fontSize: "12px" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addingAgent || !newAgentName.trim() || clean10DigitPhone(newAgentPhone).length !== 10 || !newAgentPin.trim()}
                        style={{
                          ...primaryButtonStyle,
                          height: "32px",
                          padding: "0 16px",
                          fontSize: "12px",
                        }}
                      >
                        {addingAgent ? "Registering..." : "+ Register Agent"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Reset PIN Modal */}
              {resetPinAgent && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.5)",
                    display: "grid",
                    placeItems: "center",
                    zIndex: 999,
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "8px",
                      padding: "18px",
                      maxWidth: "360px",
                      width: "100%",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                      Reset PIN for {resetPinAgent.name}
                    </h3>
                    <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
                      Enter a new 4 to 6 digit login PIN for this rider.
                    </p>

                    <form onSubmit={handleResetPin} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <input
                        type="password"
                        required
                        autoFocus
                        placeholder="New PIN (e.g. 5678)"
                        value={resetPinValue}
                        onChange={(e) => setResetPinValue(e.target.value)}
                        style={inputStyle}
                      />

                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setResetPinAgent(null);
                            setResetPinValue("");
                          }}
                          style={{ ...ghostButtonStyle, padding: "7px 12px", fontSize: "12px" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={resettingPin || !resetPinValue.trim()}
                          style={{ ...primaryButtonStyle, padding: "7px 14px", fontSize: "12px" }}
                        >
                          {resettingPin ? "Updating..." : "Update PIN"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Settle Cash Modal */}
              {settleCashAgent && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.5)",
                    display: "grid",
                    placeItems: "center",
                    zIndex: 999,
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "8px",
                      padding: "18px",
                      maxWidth: "380px",
                      width: "100%",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                      Settle Cash for {settleCashAgent.name}
                    </h3>
                    <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
                      Current uncollected cash in hand: <strong style={{ color: "#b45309" }}>{formatPrice(settleCashAgent.cash_in_hand)}</strong>
                    </p>

                    <form onSubmit={handleSettleCash} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={labelStyle}>Settlement Amount (Leave empty to settle all)</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={`Full amount: ₹${(settleCashAgent.cash_in_hand || 0).toFixed(2)}`}
                          value={settleCashAmount}
                          onChange={(e) => setSettleCashAmount(e.target.value)}
                          style={inputStyle}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={labelStyle}>Settlement Note / Reference (Optional)</span>
                        <input
                          type="text"
                          placeholder="e.g. Cash collected & deposited to counter register"
                          value={settleCashNotes}
                          onChange={(e) => setSettleCashNotes(e.target.value)}
                          style={inputStyle}
                        />
                      </label>

                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSettleCashAgent(null);
                            setSettleCashAmount("");
                            setSettleCashNotes("");
                          }}
                          style={{ ...ghostButtonStyle, padding: "7px 12px", fontSize: "12px" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={settlingCash}
                          style={{ ...primaryButtonStyle, padding: "7px 14px", fontSize: "12px", background: "#059669" }}
                        >
                          {settlingCash ? "Settling..." : "Confirm Settlement"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Fleet Table (Responsive 4-Column Design) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                <div style={{ overflowX: "auto", width: "100%" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", tableLayout: "auto" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ ...thStyle, width: "30%", minWidth: "150px" }}>Rider Details</th>
                        <th style={{ ...thStyle, width: "24%", minWidth: "130px" }}>Duty & Deliveries</th>
                        <th style={{ ...thStyle, width: "18%", minWidth: "100px" }}>Cash in Hand</th>
                        <th style={{ ...thStyle, width: "28%", minWidth: "170px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingAgents ? (
                        <tr>
                          <td colSpan={4} style={{ ...tdStyle, textAlign: "center", padding: "28px", color: "#64748b" }}>
                            Loading delivery fleet...
                          </td>
                        </tr>
                      ) : filteredAgents.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ ...tdStyle, textAlign: "center", padding: "32px", color: "#64748b" }}>
                            {searchQuery ? "No delivery agents match your search." : "No delivery agents registered yet. Click '+ Add delivery agent' above to register your first rider."}
                          </td>
                        </tr>
                      ) : (
                        paginatedAgents.map((agent) => (
                          <tr key={agent.id}>
                            {/* Column 1: Rider Details (Name, Phone, Vehicle) */}
                            <td style={tdStyle}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{agent.name}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#64748b", flexWrap: "wrap" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <PhoneIcon />
                                    {formatPhoneDisplay(agent.phone)}
                                  </span>
                                  <span>•</span>
                                  <span style={{ textTransform: "capitalize" }}>{agent.vehicle_type || "bike"}</span>
                                </div>
                              </div>
                            </td>

                            {/* Column 2: Duty Status & Orders/Deliveries */}
                            <td style={tdStyle}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "4px",
                                    padding: "2px 7px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    background: agent.is_active ? "#f0fdf4" : "#fef2f2",
                                    color: agent.is_active ? "#15803d" : "#b91c1c",
                                    border: `1px solid ${agent.is_active ? "#bbf7d0" : "#fecaca"}`,
                                    width: "68px",
                                    boxSizing: "border-box",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "5px",
                                      height: "5px",
                                      borderRadius: "50%",
                                      background: agent.is_active ? "#16a34a" : "#dc2626",
                                    }}
                                  />
                                  {agent.is_active ? "On Duty" : "Inactive"}
                                </span>
                                <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                                  <span style={{ color: (agent.current_order_count || 0) > 0 ? "#2563eb" : "#64748b", fontWeight: (agent.current_order_count || 0) > 0 ? 600 : 400 }}>
                                    {agent.current_order_count || 0} active
                                  </span>
                                  <span> • </span>
                                  <span>{agent.total_deliveries || 0} done</span>
                                </div>
                              </div>
                            </td>

                            {/* Column 3: Dedicated Cash in Hand */}
                            <td style={tdStyle}>
                              {(agent.cash_in_hand || 0) > 0 ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "3px 8px",
                                    borderRadius: "5px",
                                    background: "#fffbeb",
                                    border: "1px solid #fde68a",
                                    color: "#b45309",
                                    fontWeight: 700,
                                    fontSize: "12.5px",
                                  }}
                                >
                                  {formatPrice(agent.cash_in_hand)}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12.5px", fontWeight: 500 }}>
                                  ₹0.00
                                </span>
                              )}
                            </td>

                            {/* Column 4: Actions */}
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: "5px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
                                {(agent.cash_in_hand || 0) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSettleCashAgent(agent);
                                      setSettleCashAmount("");
                                      setSettleCashNotes("");
                                    }}
                                    style={{
                                      ...ghostButtonStyle,
                                      height: "28px",
                                      padding: "0 8px",
                                      fontSize: "11.5px",
                                      color: "#059669",
                                      borderColor: "#a7f3d0",
                                      background: "#ecfdf5",
                                      borderRadius: "5px",
                                      whiteSpace: "nowrap",
                                      fontWeight: 600,
                                    }}
                                    title="Collect & Settle Cash in Hand"
                                  >
                                    <span>Settle</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetPinAgent(agent);
                                    setResetPinValue("");
                                  }}
                                  style={{
                                    ...ghostButtonStyle,
                                    height: "28px",
                                    padding: "0 8px",
                                    fontSize: "11.5px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                    borderRadius: "5px",
                                    whiteSpace: "nowrap",
                                  }}
                                  title="Reset Login PIN"
                                >
                                  <KeyIcon />
                                  <span>PIN</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleAgent(agent)}
                                  style={{
                                    ...ghostButtonStyle,
                                    height: "28px",
                                    width: "76px",
                                    minWidth: "76px",
                                    padding: "0",
                                    fontSize: "11.5px",
                                    color: agent.is_active ? "#b45309" : "#15803d",
                                    borderColor: agent.is_active ? "#fde68a" : "#bbf7d0",
                                    background: agent.is_active ? "#fffbeb" : "#f0fdf4",
                                    borderRadius: "5px",
                                    whiteSpace: "nowrap",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textAlign: "center",
                                  }}
                                  title={agent.is_active ? "Deactivate Rider" : "Activate Rider"}
                                >
                                  {agent.is_active ? "Deactivate" : "Activate"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteAgent(agent)}
                                  style={{
                                    ...dangerButtonStyle,
                                    height: "28px",
                                    padding: "0 7px",
                                    fontSize: "11.5px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: "5px",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={`Remove ${agent.name}`}
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Controls */}
              {filteredAgents.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    marginTop: "8px",
                  }}
                >
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(page) => setCurrentPage(page)}
                    totalItems={filteredAgents.length}
                    pageSize={pageSize}
                    showRangeText={true}
                    accentColor="#2563eb"
                    style={{ padding: 0 }}
                  />
                </div>
              )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SHIPROCKET COURIER INTEGRATION                                     */}
      {/* ========================================================================= */}
      {activeTab === "shiprocket" && (
        <div
          style={{
            opacity: isShiprocketEnabled ? 1 : 0.45,
            pointerEvents: isShiprocketEnabled ? "auto" : "none",
            filter: isShiprocketEnabled ? "none" : "grayscale(0.6)",
            transition: "opacity 0.2s ease, filter 0.2s ease",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Card 1: API Account Credentials */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              padding: "14px 16px",
            }}
          >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                      API Account Credentials
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: settings.shiprocket_verified
                          ? "#f0fdf4"
                          : settings.shiprocket_saved
                          ? "#fffbeb"
                          : "#fef2f2",
                        color: settings.shiprocket_verified
                          ? "#15803d"
                          : settings.shiprocket_saved
                          ? "#b45309"
                          : "#b91c1c",
                        border: `1px solid ${
                          settings.shiprocket_verified
                            ? "#bbf7d0"
                            : settings.shiprocket_saved
                            ? "#fde68a"
                            : "#fecaca"
                        }`,
                      }}
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: settings.shiprocket_verified
                            ? "#16a34a"
                            : settings.shiprocket_saved
                            ? "#f59e0b"
                            : "#dc2626",
                        }}
                      />
                      {settings.shiprocket_verified
                        ? "Verified"
                        : settings.shiprocket_saved
                        ? "Saved (Click Test)"
                        : "Not Configured"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={testShiprocket}
                    disabled={testingConnection}
                    style={{ ...ghostButtonStyle, height: "28px", padding: "0 12px", fontSize: "11.5px", whiteSpace: "nowrap" }}
                  >
                    {testingConnection ? "Verifying..." : "Test Connection"}
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "10px 16px",
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={labelStyle}>Shiprocket Account Email</span>
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={settings.shiprocket_email}
                      onChange={(e) => setSettings((p) => ({ ...p, shiprocket_email: e.target.value }))}
                      style={{ ...inputStyle, height: "34px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={labelStyle}>
                      Account Password {settings.shiprocket_connected ? "(Saved)" : ""}
                    </span>
                    <input
                      type="password"
                      placeholder={settings.shiprocket_connected ? "••••••••••••" : "Enter password"}
                      value={srPassword}
                      onChange={(e) => setSrPassword(e.target.value)}
                      style={{ ...inputStyle, height: "34px" }}
                    />
                  </label>
                </div>
              </div>

              {/* Card 2: Pickup Origin Warehouse Location & Coverage Limits */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {/* Header: Title + Map Pin Action */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                      Pickup Origin Warehouse Location
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                      Accurate dispatch coordinates for Shiprocket courier pickups & serviceability.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowStoreMapPicker(true)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: settings.sender_latitude ? "#f0fdf4" : "#eff6ff",
                      color: settings.sender_latitude ? "#15803d" : "#1d4ed8",
                      borderColor: settings.sender_latitude ? "#bbf7d0" : "#bfdbfe",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{settings.sender_latitude ? "Re-pin on Map" : "Pin on Map (Required)"}</span>
                  </button>
                </div>

                {/* Map Pin Locked Address Box */}
                {settings.sender_latitude ? (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                      <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "10.5px", background: "#dcfce7", padding: "1px 6px", borderRadius: "4px", flexShrink: 0 }}>
                        MAP LOCKED
                      </span>
                      <span style={{ color: "#334155", fontWeight: 500, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                        {[settings.sender_address, settings.sender_city, settings.sender_state, settings.sender_pincode].filter(Boolean).join(", ") || "Pinned Location"}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", flexShrink: 0 }}>
                      {settings.sender_latitude.toFixed(4)}, {settings.sender_longitude?.toFixed(4)}
                    </span>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowStoreMapPicker(true)}
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      background: "#fffbeb",
                      border: "1px dashed #fde68a",
                      color: "#92400e",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <span>No warehouse location pinned. Click to drop a pin on Google Maps.</span>
                    <span style={{ fontWeight: 600, textDecoration: "underline" }}>Open Map &rarr;</span>
                  </div>
                )}

                {/* Compact Row: Sender Name, Phone, Flat/Unit Detail, Box Weight */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "8px 12px",
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={labelStyle}>Sender Name</span>
                    <input
                      type="text"
                      placeholder="Warehouse Manager"
                      value={settings.sender_name}
                      onChange={(e) => setSettings((p) => ({ ...p, sender_name: e.target.value }))}
                      style={{ ...inputStyle, height: "30px", fontSize: "12px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={labelStyle}>Sender Phone</span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          height: "30px",
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0 7px",
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRight: "none",
                          borderRadius: "6px 0 0 6px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#475569",
                          boxSizing: "border-box",
                        }}
                      >
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="8825255108"
                        value={settings.sender_phone}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            sender_phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                        style={{ ...inputStyle, height: "30px", fontSize: "12px", borderRadius: "0 6px 6px 0" }}
                      />
                    </div>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={labelStyle}>Unit / Building / Plot No.</span>
                    <input
                      type="text"
                      placeholder="e.g. Unit 4, Gate B"
                      value={settings.sender_address}
                      onChange={(e) => setSettings((p) => ({ ...p, sender_address: e.target.value }))}
                      style={{ ...inputStyle, height: "30px", fontSize: "12px" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={labelStyle}>Default Box Weight</span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="number"
                        min={50}
                        max={50000}
                        placeholder="500"
                        value={settings.default_weight_grams}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            default_weight_grams: Number(e.target.value) || 0,
                          }))
                        }
                        style={{ ...inputStyle, height: "30px", fontSize: "12px", borderRadius: "6px 0 0 6px" }}
                      />
                      <span
                        style={{
                          height: "30px",
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0 7px",
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderLeft: "none",
                          borderRadius: "0 6px 6px 0",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#475569",
                          boxSizing: "border-box",
                        }}
                      >
                        g
                      </span>
                    </div>
                  </label>
                </div>

                {/* Sleek Compact Inline Delivery Coverage */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px",
                    padding: "8px 10px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                      Delivery Coverage:
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {settings.shiprocket_delivery_radius_km
                        ? `Max ${settings.shiprocket_delivery_radius_km} km radius from pinned warehouse`
                        : "Nationwide (All serviceable pincodes across India)"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "#334155", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="sr_coverage_compact"
                        checked={!settings.shiprocket_delivery_radius_km}
                        onChange={() => setSettings((p) => ({ ...p, shiprocket_delivery_radius_km: null }))}
                      />
                      Nationwide
                    </label>

                    <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "#334155", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="sr_coverage_compact"
                        checked={Boolean(settings.shiprocket_delivery_radius_km)}
                        onChange={() => setSettings((p) => ({ ...p, shiprocket_delivery_radius_km: p.shiprocket_delivery_radius_km || 500 }))}
                      />
                      Limit Radius:
                    </label>

                    {Boolean(settings.shiprocket_delivery_radius_km) && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          value={settings.shiprocket_delivery_radius_km || 500}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              shiprocket_delivery_radius_km: Math.max(1, Number(e.target.value) || 0),
                            }))
                          }
                          style={{ ...inputStyle, width: "65px", height: "26px", fontSize: "11.5px", padding: "2px 6px" }}
                        />
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>KM</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MANUAL COURIER DISPATCH                                            */}
      {/* ========================================================================= */}
      {activeTab === "manual" && (
        <div
          style={{
            opacity: isManualEnabled ? 1 : 0.45,
            pointerEvents: isManualEnabled ? "auto" : "none",
            filter: isManualEnabled ? "none" : "grayscale(0.6)",
            transition: "opacity 0.2s ease, filter 0.2s ease",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
              Standard Manual Dispatch Workflow
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
              <div style={{ padding: "10px 12px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>1. Pack Parcel</div>
                <div style={{ fontSize: "11.5px", color: "#64748b" }}>Package items and label box at your store.</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>2. Courier Handover</div>
                <div style={{ fontSize: "11.5px", color: "#64748b" }}>Ship with any courier and collect AWB tracking.</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>3. Mark Dispatched</div>
                <div style={{ fontSize: "11.5px", color: "#64748b" }}>Enter tracking code in Orders tab to update buyer.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Location Map Picker Modal */}
      <GoogleMapPicker
        siteId={siteId || ""}
        isOpen={showStoreMapPicker}
        onClose={() => setShowStoreMapPicker(false)}
        onConfirm={handleStoreMapConfirm}
        accentColor="#2563eb"
        deliveryMode="own_agent"
        mode="store"
        initialLat={settings.sender_latitude ?? undefined}
        initialLng={settings.sender_longitude ?? undefined}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component Styles matching AdminProducts.tsx
// -----------------------------------------------------------------------------
function InfoTooltip({ text }: { text: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: "13px", height: "13px", color: hovered ? "#2563eb" : "#94a3b8", transition: "color 0.15s ease" }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 500,
            padding: "5px 9px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100,
            pointerEvents: "none",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {text}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid #0f172a",
            }}
          />
        </div>
      )}
    </div>
  );
}

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      padding: "12px 14px",
      borderRadius: "8px",
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: 0,
      overflow: "hidden",
      fontFamily: "'Inter', sans-serif",
    }}
  >
    <div
      style={{
        fontSize: "22px",
        fontWeight: 600,
        color: "#334155",
        lineHeight: 1,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontSize: "12px",
        fontWeight: 500,
        color: "#555555",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {label}
    </div>
  </div>
);

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#475569",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "11px",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid #e2e8f0",
  fontSize: "13px",
  color: "#0f172a",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: "12px",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  fontSize: "12px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 600,
  fontSize: "12px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
