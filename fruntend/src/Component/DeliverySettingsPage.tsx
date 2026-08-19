import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { Pagination } from "./Pagination";

type DeliveryMode = "own_agent" | "shiprocket" | "hybrid" | "manual";

type DeliverySettingsData = {
  delivery_mode: DeliveryMode;
  own_delivery_radius_km: number;
  shiprocket_email: string;
  shiprocket_connected: boolean;
  default_courier_preference: string;
  auto_assign_courier: boolean;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_pincode: string;
  sender_city: string;
  sender_state: string;
  default_weight_grams: number;
};

type Agent = {
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

type Tab = "mode" | "agents" | "courier";

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

const CheckCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
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

export default function DeliverySettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [tab, setTab] = useState<Tab>("mode");

  const [settings, setSettings] = useState<DeliverySettingsData>({
    delivery_mode: "manual",
    own_delivery_radius_km: 10,
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
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Agents state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    setTimeout(() => setFeedback(null), 3500);
  };

  useEffect(() => {
    if (!siteId) return;
    fetchSettings();
    fetchAgents();
  }, [siteId]);

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await fetch(`${API_BASE_URL}/delivery/settings/${siteId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to load delivery settings", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchAgents = async () => {
    try {
      setLoadingAgents(true);
      const res = await fetch(`${API_BASE_URL}/delivery/agents/${siteId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load delivery agents", err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const saveSettings = async (overrides?: Partial<DeliverySettingsData>) => {
    if (!siteId) return;
    setSavingSettings(true);
    try {
      const payload = {
        ...settings,
        ...(overrides || {}),
      };

      const body: Record<string, any> = {
        delivery_mode: payload.delivery_mode,
        own_delivery_radius_km: Number(payload.own_delivery_radius_km) || 10,
        shiprocket_email: payload.shiprocket_email || "",
        default_courier_preference: payload.default_courier_preference || "",
        auto_assign_courier: Boolean(payload.auto_assign_courier),
        sender_name: payload.sender_name || "",
        sender_phone: payload.sender_phone || "",
        sender_address: payload.sender_address || "",
        sender_pincode: payload.sender_pincode || "",
        sender_city: payload.sender_city || "",
        sender_state: payload.sender_state || "",
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
        const errText = await res.text();
        throw new Error(errText || "Failed to save settings");
      }

      showFeedback("Delivery settings saved successfully", "success");
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
        showFeedback(data.detail || "Connection failed. Please check credentials.", "error");
      }
    } catch {
      showFeedback("Network error while verifying Shiprocket credentials.", "error");
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
      await fetchAgents();
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
      await fetchAgents();
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
      await fetchAgents();
    } catch (err: any) {
      showFeedback(err.message || "Failed to settle cash", "error");
    } finally {
      setSettlingCash(false);
    }
  };

  const toggleAgent = async (agent: Agent) => {
    if (!siteId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/delivery/agents/${siteId}/${agent.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !agent.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      showFeedback(`Agent ${agent.is_active ? "deactivated" : "activated"}`, "success");
      await fetchAgents();
    } catch (err: any) {
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
      await fetchAgents();
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
    if (!searchQuery.trim()) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        (a.vehicle_type || "").toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / pageSize));
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, currentPage, pageSize]);

  const MODES: {
    key: DeliveryMode;
    label: string;
    tagline: string;
    badge?: string;
  }[] = [
    {
      key: "own_agent",
      label: "Own Delivery Fleet",
      tagline: "Direct dispatch to your in-house store delivery riders.",
      badge: "Local Fleet",
    },
    {
      key: "shiprocket",
      label: "Shiprocket Courier Aggregator",
      tagline: "Automated booking with Delhivery, BlueDart, DTDC, Xpressbees & 15+ couriers.",
      badge: "Pan-India",
    },
    {
      key: "hybrid",
      label: "Smart Hybrid Routing",
      tagline: "Flexible choice between in-house riders and Shiprocket couriers per order.",
      badge: "Recommended",
    },
    {
      key: "manual",
      label: "Manual Partner Dispatch",
      tagline: "Manually enter carrier name and tracking AWB per shipment.",
      badge: "Custom",
    },
  ];

  const showFleetTab = settings.delivery_mode === "own_agent" || settings.delivery_mode === "hybrid";
  const showCourierTab = settings.delivery_mode === "shiprocket" || settings.delivery_mode === "hybrid";

  useEffect(() => {
    if (tab === "agents" && !showFleetTab) {
      setTab("mode");
    } else if (tab === "courier" && !showCourierTab) {
      setTab("mode");
    }
  }, [settings.delivery_mode, showFleetTab, showCourierTab, tab]);

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
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            padding: "10px 16px",
            borderRadius: "6px",
            background: feedback.type === "success" ? "#0f172a" : "#b91c1c",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {feedback.type === "success" ? <CheckCircleIcon /> : null}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              Delivery & Shipping
            </h1>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 600,
                background: settings.delivery_mode === "shiprocket" ? "#eff6ff" : "#f0fdf4",
                color: settings.delivery_mode === "shiprocket" ? "#1d4ed8" : "#15803d",
                border: `1px solid ${settings.delivery_mode === "shiprocket" ? "#bfdbfe" : "#bbf7d0"}`,
                whiteSpace: "nowrap",
              }}
            >
              {settings.delivery_mode === "own_agent" && "Own Fleet Active"}
              {settings.delivery_mode === "shiprocket" && "Shiprocket Active"}
              {settings.delivery_mode === "hybrid" && "Hybrid Active"}
              {settings.delivery_mode === "manual" && "Manual Active"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            to={`/builder/${siteId}/admin/orders`}
            style={ghostButtonStyle}
          >
            ← View Orders
          </Link>
        </div>
      </div>

      {/* Navigation Tabs (Dynamically filtered by active strategy) */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: "1px solid #e2e8f0",
          marginBottom: "18px",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("mode")}
          style={{
            padding: "8px 14px",
            background: "none",
            border: "none",
            borderBottom: tab === "mode" ? "2px solid #2563eb" : "2px solid transparent",
            color: tab === "mode" ? "#2563eb" : "#64748b",
            fontWeight: tab === "mode" ? 700 : 600,
            fontSize: "13px",
            cursor: "pointer",
            marginBottom: "-1px",
            whiteSpace: "nowrap",
          }}
        >
          Delivery Strategy
        </button>

        {showFleetTab && (
          <button
            type="button"
            onClick={() => setTab("agents")}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              borderBottom: tab === "agents" ? "2px solid #2563eb" : "2px solid transparent",
              color: tab === "agents" ? "#2563eb" : "#64748b",
              fontWeight: tab === "agents" ? 700 : 600,
              fontSize: "13px",
              cursor: "pointer",
              marginBottom: "-1px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            <span>Delivery Fleet</span>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "11px",
                background: tab === "agents" ? "#eff6ff" : "#f1f5f9",
                color: tab === "agents" ? "#2563eb" : "#64748b",
                fontWeight: 700,
              }}
            >
              {agents.length}
            </span>
          </button>
        )}

        {showCourierTab && (
          <button
            type="button"
            onClick={() => setTab("courier")}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              borderBottom: tab === "courier" ? "2px solid #2563eb" : "2px solid transparent",
              color: tab === "courier" ? "#2563eb" : "#64748b",
              fontWeight: tab === "courier" ? 700 : 600,
              fontSize: "13px",
              cursor: "pointer",
              marginBottom: "-1px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            <span>Courier Integration</span>
            {settings.shiprocket_connected && (
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#16a34a",
                }}
              />
            )}
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DELIVERY STRATEGY                                                  */}
      {/* ========================================================================= */}
      {tab === "mode" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Strategy Selection Grid */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              padding: "18px",
            }}
          >
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>
              Select Active Delivery Strategy
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 14px" }}>
              Choose how your store handles customer shipments and rider dispatch.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {MODES.map((m) => {
                const isSelected = settings.delivery_mode === m.key;
                return (
                  <div
                    key={m.key}
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, delivery_mode: m.key }));
                      saveSettings({ delivery_mode: m.key });
                    }}
                    style={{
                      padding: "14px",
                      borderRadius: "6px",
                      border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      background: isSelected ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: isSelected ? "#1d4ed8" : "#0f172a" }}>
                          {m.label}
                        </span>
                        {m.badge && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              padding: "1px 5px",
                              borderRadius: "4px",
                              background: isSelected ? "#dbeafe" : "#f1f5f9",
                              color: isSelected ? "#1d4ed8" : "#64748b",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: 0, lineHeight: 1.4 }}>
                        {m.tagline}
                      </p>
                    </div>

                    <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            border: isSelected ? "3.5px solid #2563eb" : "1.5px solid #94a3b8",
                            background: "#ffffff",
                          }}
                        />
                        <span style={{ fontSize: "11px", fontWeight: 600, color: isSelected ? "#2563eb" : "#64748b" }}>
                          {isSelected ? "Active Strategy" : "Select Strategy"}
                        </span>
                      </div>

                      {/* Sleek inline helper link when selected */}
                      {isSelected && m.key === "own_agent" && agents.length === 0 && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setTab("agents");
                            setShowAgentForm(true);
                          }}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#2563eb",
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          + Add rider →
                        </span>
                      )}

                      {isSelected && m.key === "shiprocket" && !settings.shiprocket_connected && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setTab("courier");
                          }}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#2563eb",
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          Connect API →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DELIVERY FLEET (Matches AdminProducts Layout)                      */}
      {/* ========================================================================= */}
      {tab === "agents" && (
        <div>
          {/* Summary Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <StatCard label="Total Registered Riders" value={String(totalAgents)} />
            <StatCard label="Active on Duty" value={String(activeAgents)} />
            <StatCard label="Total Deliveries Done" value={String(totalCompletedDeliveries)} />
            <StatCard label="Pending COD in Hand" value={formatPrice(totalCashInHand)} />
          </div>

          {/* Action Bar (Search + Add Rider Button) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 240px", maxWidth: "340px" }}>
              <input
                type="text"
                placeholder="Search riders by name, phone, vehicle..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  ...inputStyle,
                  padding: "7px 10px",
                  fontSize: "12px",
                  width: "100%",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  style={{
                    ...ghostButtonStyle,
                    padding: "7px 10px",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAgentForm(!showAgentForm)}
              style={{ ...primaryButtonStyle, padding: "8px 14px", fontSize: "12px", whiteSpace: "nowrap" }}
            >
              {showAgentForm ? "Cancel" : "+ Add delivery agent"}
            </button>
          </div>

          {/* Inline Add Agent Form (matches AdminProducts Form layout) */}
          {showAgentForm && (
            <div
              style={{
                marginBottom: "16px",
                padding: "14px 16px",
                borderRadius: "8px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "15px",
                  color: "#0f172a",
                  fontWeight: 700,
                }}
              >
                Register New Delivery Agent
              </h2>

              <form
                onSubmit={addAgent}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px 14px",
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
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <span style={labelStyle}>Mobile Number (10 Digits) *</span>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        padding: "6px 8px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRight: "none",
                        borderRadius: "6px 0 0 6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#475569",
                        whiteSpace: "nowrap",
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
                        borderRadius: "0 6px 6px 0",
                      }}
                    />
                  </div>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <span style={labelStyle}>Rider Login PIN (4-6 Digits) *</span>
                  <input
                    type="password"
                    required
                    placeholder="e.g. 1234"
                    value={newAgentPin}
                    onChange={(e) => setNewAgentPin(e.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <span style={labelStyle}>Vehicle Type</span>
                  <select
                    value={newAgentVehicle}
                    onChange={(e) => setNewAgentVehicle(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="bike">Motorcycle / Bike</option>
                    <option value="scooter">Scooter / EV</option>
                    <option value="van">Delivery Van</option>
                    <option value="walking">On Foot</option>
                  </select>
                </label>

                <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button
                    type="submit"
                    disabled={addingAgent || !newAgentName.trim() || clean10DigitPhone(newAgentPhone).length !== 10 || !newAgentPin.trim()}
                    style={{ ...primaryButtonStyle, padding: "8px 14px", fontSize: "12px", whiteSpace: "nowrap" }}
                  >
                    {addingAgent ? "Registering..." : "Save Delivery Agent"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAgentForm(false)}
                    style={{ ...ghostButtonStyle, padding: "8px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                  >
                    Cancel
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

          {/* Fleet Table (nowrap, compact, responsive container) */}
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
                    <th style={thStyle}>Rider Name</th>
                    <th style={thStyle}>Contact</th>
                    <th style={thStyle}>Vehicle</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Active Stops</th>
                    <th style={thStyle}>COD in Hand</th>
                    <th style={thStyle}>Deliveries</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAgents ? (
                    <tr>
                      <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: "28px", color: "#64748b" }}>
                        Loading delivery fleet...
                      </td>
                    </tr>
                  ) : paginatedAgents.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                        {searchQuery ? "No delivery agents match your search." : "No delivery agents registered yet. Click \"+ Add delivery agent\" above."}
                      </td>
                    </tr>
                  ) : (
                    paginatedAgents.map((agent) => (
                      <tr key={agent.id} style={{ transition: "background 0.15s ease" }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a", whiteSpace: "nowrap" }}>
                            {agent.name}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ fontSize: "12px", color: "#475569", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                            <PhoneIcon />
                            <span>{formatPhoneDisplay(agent.phone)}</span>
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              textTransform: "capitalize",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "#334155",
                              background: "#f1f5f9",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {agent.vehicle_type || "bike"}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: agent.is_active ? "#15803d" : "#94a3b8",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: agent.is_active ? "#22c55e" : "#cbd5e1",
                              }}
                            />
                            <span>{agent.is_active ? "In Service" : "Inactive"}</span>
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a", whiteSpace: "nowrap" }}>
                            {agent.current_order_count}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, fontSize: "13px", color: agent.cash_in_hand ? "#b45309" : "#0f172a", whiteSpace: "nowrap" }}>
                            {formatPrice(agent.cash_in_hand)}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a", whiteSpace: "nowrap" }}>
                            {agent.total_deliveries || 0}
                          </span>
                        </td>

                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", whiteSpace: "nowrap" }}>
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
                                  padding: "5px 9px",
                                  fontSize: "12px",
                                  color: "#047857",
                                  borderColor: "#a7f3d0",
                                  background: "#ecfdf5",
                                  borderRadius: "5px",
                                  whiteSpace: "nowrap",
                                  fontWeight: 600,
                                }}
                                title="Collect & Settle Cash in Hand"
                              >
                                <span>Settle Cash</span>
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
                                padding: "5px 9px",
                                fontSize: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                borderRadius: "5px",
                                whiteSpace: "nowrap",
                              }}
                              title="Reset Login PIN"
                            >
                              <KeyIcon />
                              <span>Reset PIN</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleAgent(agent)}
                              style={{
                                ...ghostButtonStyle,
                                padding: "5px 9px",
                                fontSize: "12px",
                                color: agent.is_active ? "#b45309" : "#15803d",
                                borderColor: agent.is_active ? "#fde68a" : "#bbf7d0",
                                background: agent.is_active ? "#fffbeb" : "#f0fdf4",
                                borderRadius: "5px",
                                whiteSpace: "nowrap",
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
                                padding: "5px 8px",
                                fontSize: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                borderRadius: "5px",
                                whiteSpace: "nowrap",
                              }}
                              title={`Remove ${agent.name}`}
                            >
                              <TrashIcon />
                              <span>Delete</span>
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
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "14px",
                padding: "6px 2px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b" }}>
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

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
      {/* TAB 3: COURIER (SHIPROCKET) INTEGRATION                                   */}
      {/* ========================================================================= */}
      {tab === "courier" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Connection Status Card */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              padding: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Shiprocket API Integration
                </h3>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: settings.shiprocket_connected ? "#f0fdf4" : "#fef2f2",
                    color: settings.shiprocket_connected ? "#15803d" : "#b91c1c",
                    border: `1px solid ${settings.shiprocket_connected ? "#bbf7d0" : "#fecaca"}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: settings.shiprocket_connected ? "#16a34a" : "#dc2626",
                    }}
                  />
                  {settings.shiprocket_connected ? "Connected & Verified" : "Not Connected"}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                Generates live AWB tracking and auto-assigns couriers like Delhivery, BlueDart, and DTDC.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={testShiprocket}
                disabled={testingConnection}
                style={{ ...ghostButtonStyle, padding: "7px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
              >
                {testingConnection ? "Verifying..." : "Test Connection"}
              </button>
            </div>
          </div>

          {/* Account Credentials */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              padding: "18px",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: "0 0 12px" }}>
              API Account Credentials
            </h3>

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
                  placeholder="your-account@company.com"
                  value={settings.shiprocket_email}
                  onChange={(e) => setSettings((p) => ({ ...p, shiprocket_email: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={labelStyle}>Shiprocket Password {settings.shiprocket_connected ? "(Saved)" : ""}</span>
                <input
                  type="password"
                  placeholder={settings.shiprocket_connected ? "••••••••••••" : "Enter API password"}
                  value={srPassword}
                  onChange={(e) => setSrPassword(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
          </div>

          {/* Pickup Store Address */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              padding: "18px",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: "0 0 3px" }}>
              Pickup Warehouse / Store Location
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px" }}>
              Courier executives will arrive at this physical location to pick up packaged orders.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "10px 14px",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={labelStyle}>Contact Person / Store Name</span>
                <input
                  type="text"
                  placeholder="e.g. Warehouse Manager"
                  value={settings.sender_name}
                  onChange={(e) => setSettings((p) => ({ ...p, sender_name: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={labelStyle}>Contact Phone (10 Digits)</span>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      padding: "6px 8px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRight: "none",
                      borderRadius: "6px 0 0 6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#475569",
                      whiteSpace: "nowrap",
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
                    style={{ ...inputStyle, borderRadius: "0 6px 6px 0" }}
                  />
                </div>
              </label>

              <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={labelStyle}>Pickup Street Address</span>
                <input
                  type="text"
                  placeholder="e.g. Plot 42, Sector 5, HSR Layout"
                  value={settings.sender_address}
                  onChange={(e) => setSettings((p) => ({ ...p, sender_address: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={labelStyle}>City</span>
                <input
                  type="text"
                  placeholder="e.g. Bangalore"
                  value={settings.sender_city}
                  onChange={(e) => setSettings((p) => ({ ...p, sender_city: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={labelStyle}>State</span>
                <input
                  type="text"
                  placeholder="e.g. Karnataka"
                  value={settings.sender_state}
                  onChange={(e) => setSettings((p) => ({ ...p, sender_state: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={labelStyle}>Pincode</span>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 560102"
                  value={settings.sender_pincode}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      sender_pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                  style={inputStyle}
                />
              </label>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={() => saveSettings()}
              disabled={savingSettings}
              style={{ ...primaryButtonStyle, padding: "8px 18px", fontSize: "13px", whiteSpace: "nowrap" }}
            >
              {savingSettings ? "Saving Settings..." : "Save Courier Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component Styles matching AdminProducts.tsx
// -----------------------------------------------------------------------------
const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      padding: "12px 14px",
      borderRadius: "8px",
      background: "#ffffff",
      border: "1px solid #e2e8f0",
    }}
  >
    <p
      style={{
        margin: "0 0 4px",
        fontSize: "12px",
        color: "#64748b",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </p>
    <h3
      style={{
        margin: 0,
        fontSize: "18px",
        fontWeight: 700,
        color: "#0f172a",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </h3>
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
