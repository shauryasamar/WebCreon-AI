import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import GlassToast from "./GlassToast";

export type ChargeCode =
  | "shipping_fee"
  | "tax"
  | "handling_fee"
  | "packaging_fee"
  | "service_fee"
  | "platform_fee"
  | "small_order_fee"
  | "cod_fee"
  | "gift_wrap";

export type ChargeRule = {
  id: string;
  code: ChargeCode | "custom";
  label: string;
  enabled: boolean;
  optional: boolean;
  customerSelectable: boolean;
  refundable: boolean;
  amountType: "fixed" | "percent";
  amountValue: string;
  applyConditionType: "none" | "subtotal_lt" | "subtotal_gte" | "payment_method";
  applyConditionValue: string;
  waiveConditionType: "none" | "subtotal_gte";
  waiveConditionValue: string;
  description: string;
};

export type TaxSettings = {
  enabled: boolean;
  label: string;
  rate: string;
  applyOnShipping: boolean;
};

export type CheckoutSettingsResponse = {
  taxSettings: TaxSettings;
  charges: ChargeRule[];
};

export const createDefaultCharges = (): ChargeRule[] => [
  {
    id: "shipping_fee",
    code: "shipping_fee",
    label: "Shipping fee",
    enabled: true,
    optional: false,
    customerSelectable: false,
    refundable: false,
    amountType: "fixed",
    amountValue: "99",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "subtotal_gte",
    waiveConditionValue: "999",
    description: "Standard delivery charge for orders.",
  },
  {
    id: "handling_fee",
    code: "handling_fee",
    label: "Handling fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    refundable: false,
    amountType: "fixed",
    amountValue: "29",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Store handling and processing fee.",
  },
  {
    id: "packaging_fee",
    code: "packaging_fee",
    label: "Packaging fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    refundable: true,
    amountType: "fixed",
    amountValue: "19",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Extra packaging or packing charge.",
  },
  {
    id: "service_fee",
    code: "service_fee",
    label: "Service fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    refundable: false,
    amountType: "fixed",
    amountValue: "15",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Store service charge.",
  },
  {
    id: "platform_fee",
    code: "platform_fee",
    label: "Platform fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    refundable: false,
    amountType: "fixed",
    amountValue: "9",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "subtotal_gte",
    waiveConditionValue: "799",
    description: "Platform support fee.",
  },
  {
    id: "small_order_fee",
    code: "small_order_fee",
    label: "Small order fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    refundable: false,
    amountType: "fixed",
    amountValue: "49",
    applyConditionType: "subtotal_lt",
    applyConditionValue: "499",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Applies when order subtotal is below minimum threshold.",
  },
  {
    id: "cod_fee",
    code: "cod_fee",
    label: "COD fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    refundable: false,
    amountType: "fixed",
    amountValue: "39",
    applyConditionType: "payment_method",
    applyConditionValue: "cod",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Applies when customer chooses cash on delivery.",
  },
  {
    id: "gift_wrap",
    code: "gift_wrap",
    label: "Gift wrap",
    enabled: false,
    optional: true,
    customerSelectable: true,
    refundable: true,
    amountType: "fixed",
    amountValue: "49",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Optional gift wrap add-on selected by customer.",
  },
];

export const defaultTaxSettings: TaxSettings = {
  enabled: true,
  label: "GST",
  rate: "5",
  applyOnShipping: false,
};

export const createDefaultCheckoutSettings = (): CheckoutSettingsResponse => ({
  taxSettings: defaultTaxSettings,
  charges: createDefaultCharges(),
});

export const normalizeCharge = (charge: Partial<ChargeRule>, index: number): ChargeRule => ({
  id: String(charge.id ?? `custom_${index}`),
  code: (charge.code ?? "custom") as ChargeRule["code"],
  label: String(charge.label ?? `Custom charge ${index + 1}`),
  enabled: Boolean(charge.enabled),
  optional: Boolean(charge.optional),
  customerSelectable: Boolean(charge.customerSelectable),
  refundable:
    charge.refundable !== undefined
      ? Boolean(charge.refundable)
      : charge.code === "packaging_fee" || charge.code === "gift_wrap",
  amountType: charge.amountType === "percent" ? "percent" : "fixed",
  amountValue: String(charge.amountValue ?? "0"),
  applyConditionType:
    charge.applyConditionType === "subtotal_lt" ||
    charge.applyConditionType === "subtotal_gte" ||
    charge.applyConditionType === "payment_method"
      ? charge.applyConditionType
      : "none",
  applyConditionValue: String(charge.applyConditionValue ?? ""),
  waiveConditionType: charge.waiveConditionType === "subtotal_gte" ? "subtotal_gte" : "none",
  waiveConditionValue: String(charge.waiveConditionValue ?? ""),
  description: String(charge.description ?? ""),
});

export const normalizeResponse = (
  data: Partial<CheckoutSettingsResponse> | null | undefined
): CheckoutSettingsResponse => {
  const fallback = createDefaultCheckoutSettings();
  return {
    taxSettings: {
      enabled: data?.taxSettings?.enabled ?? fallback.taxSettings.enabled,
      label: data?.taxSettings?.label ?? fallback.taxSettings.label,
      rate: String(data?.taxSettings?.rate ?? fallback.taxSettings.rate),
      applyOnShipping:
        data?.taxSettings?.applyOnShipping ?? fallback.taxSettings.applyOnShipping,
    },
    charges:
      data?.charges && Array.isArray(data.charges) && data.charges.length > 0
        ? data.charges.map((charge, index) => normalizeCharge(charge, index))
        : fallback.charges,
  };
};

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}> = ({ checked, onChange, disabled, id }) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={checked}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    style={{
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      width: "32px",
      height: "18px",
      flexShrink: 0,
      cursor: disabled ? "not-allowed" : "pointer",
      borderRadius: "999px",
      border: "none",
      backgroundColor: checked ? "#16a34a" : "#cbd5e1",
      transition: "background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      padding: "2px",
      outline: "none",
      boxSizing: "border-box",
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
        transform: checked ? "translateX(14px)" : "translateX(0px)",
        transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    />
  </button>
);

const getShortTabLabel = (label: string) => {
  const map: Record<string, string> = {
    "Shipping fee": "Shipping",
    "Handling fee": "Handling",
    "Packaging fee": "Packaging",
    "Service fee": "Service",
    "Platform fee": "Platform",
    "Small order fee": "Small Order",
    "COD fee": "COD",
    "Gift wrap": "Gift Wrap",
  };
  return map[label] ?? label;
};

const CheckoutChargesPage: React.FC = () => {
  const { siteId } = useParams<{ siteId: string }>();

  const [mode, setMode] = useState<"standard" | "tax" | "custom">("standard");

  const [charges, setCharges] = useState<ChargeRule[]>(createDefaultCharges);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(defaultTaxSettings);
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const [toast, setToast] = useState<{ id: number; type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    const id = Date.now();
    setToast({ id, type, text });
    setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
    }, 3500);
  };

  const [activeStandardTab, setActiveStandardTab] = useState<string>("shipping_fee");
  const [activeCustomTab, setActiveCustomTab] = useState<string | null>(null);

  const standardCharges = useMemo(
    () => charges.filter((charge) => charge.code !== "custom"),
    [charges]
  );

  const customCharges = useMemo(
    () => charges.filter((charge) => charge.code === "custom"),
    [charges]
  );

  const activeStandardCharge = useMemo(() => {
    return (
      standardCharges.find((charge) => charge.id === activeStandardTab) ||
      standardCharges[0]
    );
  }, [activeStandardTab, standardCharges]);

  const activeCustomCharge = useMemo(() => {
    return (
      customCharges.find((charge) => charge.id === activeCustomTab) ||
      customCharges[0] ||
      null
    );
  }, [activeCustomTab, customCharges]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    const current = JSON.stringify({ taxSettings, charges });
    return current !== initialSnapshot;
  }, [taxSettings, charges, initialSnapshot]);

  useEffect(() => {
    const loadCheckoutSettings = async () => {
      if (!siteId) {
        showToast("error", "Missing site id in route.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const response = await fetch(
          `${API_BASE_URL}/sites/${siteId}/checkout-settings`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load checkout settings: ${response.status}`);
        }

        const data: CheckoutSettingsResponse = await response.json();
        const normalized = normalizeResponse(data);

        setTaxSettings(normalized.taxSettings);
        setCharges(normalized.charges);
        setInitialSnapshot(JSON.stringify(normalized));

        const firstStandard = normalized.charges.find((charge) => charge.code !== "custom");
        const firstCustom = normalized.charges.find((charge) => charge.code === "custom");

        setActiveStandardTab(firstStandard?.id ?? "shipping_fee");
        setActiveCustomTab(firstCustom?.id ?? null);
      } catch (error: any) {
        console.error("Error loading checkout settings:", error);
        showToast("error", error?.message || "Failed to load checkout settings.");
      } finally {
        setLoading(false);
      }
    };

    loadCheckoutSettings();
  }, [siteId]);

  const updateCharge = (
    id: string,
    field: keyof ChargeRule,
    value: string | boolean
  ) => {
    setCharges((prev) =>
      prev.map((charge) =>
        charge.id === id ? { ...charge, [field]: value } : charge
      )
    );
  };

  const addCustomCharge = () => {
    const nextId = `custom_${Date.now()}`;
    const customCount = charges.filter((charge) => charge.code === "custom").length + 1;

    const newCharge: ChargeRule = {
      id: nextId,
      code: "custom",
      label: `Custom Charge ${customCount}`,
      enabled: true,
      optional: false,
      customerSelectable: false,
      refundable: true,
      amountType: "fixed",
      amountValue: "0",
      applyConditionType: "none",
      applyConditionValue: "",
      waiveConditionType: "none",
      waiveConditionValue: "",
      description: "Custom store charge.",
    };

    setCharges((prev) => [...prev, newCharge]);
    setMode("custom");
    setActiveCustomTab(nextId);
  };

  const removeCustomCharge = (id: string) => {
    const nextCustomCharges = customCharges.filter((charge) => charge.id !== id);
    setCharges((prev) => prev.filter((charge) => charge.id !== id));
    if (activeCustomTab === id) {
      setActiveCustomTab(nextCustomCharges[0]?.id ?? null);
    }
  };

  const handleSave = async () => {
    if (!siteId) {
      showToast("error", "Missing site id in route.");
      return;
    }

    try {
      setSaving(true);

      const payload: CheckoutSettingsResponse = {
        taxSettings,
        charges,
      };

      const response = await fetch(
        `${API_BASE_URL}/sites/${siteId}/checkout-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        let errorMessage = `Failed to save settings: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.detail) {
            errorMessage =
              typeof errorData.detail === "string"
                ? errorData.detail
                : JSON.stringify(errorData.detail);
          }
        } catch {
          //
        }
        throw new Error(errorMessage);
      }

      const data: CheckoutSettingsResponse = await response.json();
      const normalized = normalizeResponse(data);

      setTaxSettings(normalized.taxSettings);
      setCharges(normalized.charges);
      setInitialSnapshot(JSON.stringify(normalized));
      showToast("success", "Checkout settings saved successfully.");
    } catch (error: any) {
      console.error("Error saving checkout settings:", error);
      showToast("error", error instanceof Error ? error.message : "Failed to save checkout settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "300px", display: "grid", placeItems: "center", color: "#64748b", fontSize: "13.5px" }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ color: "#0f172a", width: "100%" }}>
      {/* Top Header Card (Segmented Mode + Search & Action Button) */}
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
          gap: "10px",
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
              { id: "standard", label: "Standard Charges" },
              { id: "tax", label: "Tax Settings" },
              { id: "custom", label: "Custom Charges" },
            ] as const
          ).map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                }}
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
                }}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Action Area: Add + Save */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {mode === "custom" && (
            <button
              type="button"
              onClick={addCustomCharge}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 12px",
                borderRadius: "6px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                color: "#0f172a",
                fontWeight: 600,
                fontSize: "12.5px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <PlusIcon />
              Add Custom Charge
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
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
              cursor: saving ? "wait" : "pointer",
              boxShadow: hasUnsavedChanges ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
              opacity: saving ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Floating Top-Center Toast Notification */}
      {toast && (
        <GlassToast
          message={toast.text}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Sub-Tab Navigation Bar */}
      {mode === "standard" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: "16px",
          }}
        >
          {standardCharges.map((charge) => {
            const isActive = charge.id === activeStandardCharge?.id;
            const shortLabel = getShortTabLabel(charge.label);
            return (
              <button
                key={charge.id}
                type="button"
                onClick={() => setActiveStandardTab(charge.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  border: "none",
                  borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                  background: "transparent",
                  color: isActive ? "#2563eb" : "#64748b",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: "-1px",
                }}
              >
                <span>{shortLabel}</span>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    minWidth: "6px",
                    borderRadius: "999px",
                    background: charge.enabled ? "#16a34a" : "#cbd5e1",
                    display: "inline-block",
                    transition: "background 0.2s ease",
                  }}
                  title={charge.enabled ? "Active" : "Disabled"}
                />
              </button>
            );
          })}
        </div>
      )}

      {mode === "custom" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: "16px",
          }}
        >
          {customCharges.map((charge) => {
            const isActive = charge.id === activeCustomCharge?.id;
            return (
              <button
                key={charge.id}
                type="button"
                onClick={() => setActiveCustomTab(charge.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  border: "none",
                  borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                  background: "transparent",
                  color: isActive ? "#2563eb" : "#64748b",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: "-1px",
                }}
              >
                <span>{charge.label}</span>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    minWidth: "6px",
                    borderRadius: "999px",
                    background: charge.enabled ? "#16a34a" : "#cbd5e1",
                    display: "inline-block",
                    transition: "background 0.2s ease",
                  }}
                  title={charge.enabled ? "Active" : "Disabled"}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Main Mode View Panels */}
      {mode === "standard" && (
        <div>
          {activeStandardCharge ? (
            <ChargeConfigCard charge={activeStandardCharge} onChange={updateCharge} />
          ) : (
            <div style={emptyCardStyle}>No charges match your filter.</div>
          )}
        </div>
      )}

      {mode === "custom" && (
        <div>
          {customCharges.length === 0 ? (
            <div
              style={{
                ...plainCardStyle,
                padding: "36px 20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                No custom charges
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                Create optional or mandatory store charges tailored to your checkout flow.
              </p>
              <button
                type="button"
                onClick={addCustomCharge}
                style={{
                  marginTop: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <PlusIcon />
                Add Custom Charge
              </button>
            </div>
          ) : activeCustomCharge ? (
            <ChargeConfigCard
              charge={activeCustomCharge}
              onChange={updateCharge}
              onRemove={() => removeCustomCharge(activeCustomCharge.id)}
            />
          ) : (
            <div style={emptyCardStyle}>No custom charge selected.</div>
          )}
        </div>
      )}

      {mode === "tax" && (
        <div style={plainCardStyle}>
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Tax (GST) Settings
              </div>
              <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "2px" }}>
                Calculated on line items during checkout and automatically prorated on returns.
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={() => setTaxSettings((prev) => ({ ...prev, enabled: !prev.enabled }))}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: taxSettings.enabled ? "#0f172a" : "#64748b",
                }}
              >
                Enable Tax
              </span>
              <ToggleSwitch
                checked={taxSettings.enabled}
                onChange={(val) => setTaxSettings((prev) => ({ ...prev, enabled: val }))}
              />
            </div>
          </div>

          {/* Form Content */}
          <div style={{ padding: "18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                maxWidth: "700px",
              }}
            >
              <div>
                <div style={labelStyle}>Tax Display Label</div>
                <input
                  type="text"
                  value={taxSettings.label}
                  onChange={(e) => {
                    setTaxSettings((prev) => ({ ...prev, label: e.target.value }));
                  }}
                  placeholder="e.g. GST"
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={labelStyle}>Tax Rate (%)</div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxSettings.rate}
                  onChange={(e) => {
                    setTaxSettings((prev) => ({ ...prev, rate: e.target.value }));
                  }}
                  placeholder="e.g. 5"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", paddingTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={taxSettings.applyOnShipping}
                    onChange={(e) => {
                      setTaxSettings((prev) => ({ ...prev, applyOnShipping: e.target.checked }));
                    }}
                    style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#2563eb" }}
                  />
                  Apply tax on shipping fee as well
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Individual Charge Configuration Card (Clean & Minimal) */
const ChargeConfigCard: React.FC<{
  charge: ChargeRule;
  onChange: (id: string, field: keyof ChargeRule, value: string | boolean) => void;
  onRemove?: () => void;
}> = ({ charge, onChange, onRemove }) => {
  return (
    <div style={plainCardStyle}>
      {/* Card Header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            {charge.label}
          </div>
          {charge.refundable ? (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#f1f5f9", color: "#475569" }}>
              Refundable
            </span>
          ) : (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
              Non-Refundable
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "5px 9px",
                borderRadius: "5px",
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#64748b",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <TrashIcon />
              Delete
            </button>
          )}

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              userSelect: "none",
            }}
            onClick={() => onChange(charge.id, "enabled", !charge.enabled)}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: charge.enabled ? "#0f172a" : "#64748b",
              }}
            >
              Active
            </span>
            <ToggleSwitch
              checked={charge.enabled}
              onChange={(val) => onChange(charge.id, "enabled", val)}
            />
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div style={{ padding: "18px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Label */}
          <div>
            <div style={labelStyle}>Charge Label</div>
            <input
              type="text"
              value={charge.label}
              onChange={(e) => onChange(charge.id, "label", e.target.value)}
              placeholder="Display label"
              style={inputStyle}
            />
          </div>

          {/* Amount Type */}
          <div>
            <div style={labelStyle}>Amount Type</div>
            <select
              value={charge.amountType}
              onChange={(e) => onChange(charge.id, "amountType", e.target.value as "fixed" | "percent")}
              style={inputStyle}
            >
              <option value="fixed">Fixed (₹)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </div>

          {/* Amount Value */}
          <div>
            <div style={labelStyle}>
              {charge.amountType === "fixed" ? "Amount (₹)" : "Amount (%)"}
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={charge.amountValue}
              onChange={(e) => onChange(charge.id, "amountValue", e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Application Condition */}
          <div>
            <div style={labelStyle}>Application Condition</div>
            <select
              value={charge.applyConditionType}
              onChange={(e) => onChange(charge.id, "applyConditionType", e.target.value as ChargeRule["applyConditionType"])}
              style={inputStyle}
            >
              <option value="none">Always Apply (Default)</option>
              <option value="subtotal_lt">Subtotal less than (&lt;)</option>
              <option value="subtotal_gte">Subtotal greater than or equal (≥)</option>
              <option value="payment_method">Payment method (e.g. COD)</option>
            </select>
          </div>

          {/* Condition Value (if condition active) */}
          {charge.applyConditionType !== "none" && (
            <div>
              <div style={labelStyle}>
                {charge.applyConditionType === "payment_method"
                  ? "Payment Method (e.g. cod)"
                  : "Threshold Value (₹)"}
              </div>
              <input
                type="text"
                value={charge.applyConditionValue}
                onChange={(e) => onChange(charge.id, "applyConditionValue", e.target.value)}
                placeholder={charge.applyConditionType === "payment_method" ? "cod" : "499"}
                style={inputStyle}
              />
            </div>
          )}

          {/* Waiver Condition */}
          <div>
            <div style={labelStyle}>Free / Waiver Condition</div>
            <select
              value={charge.waiveConditionType}
              onChange={(e) => onChange(charge.id, "waiveConditionType", e.target.value as ChargeRule["waiveConditionType"])}
              style={inputStyle}
            >
              <option value="none">No Waiver</option>
              <option value="subtotal_gte">Free when Subtotal ≥</option>
            </select>
          </div>

          {/* Waiver Value */}
          {charge.waiveConditionType === "subtotal_gte" && (
            <div>
              <div style={labelStyle}>Free Waiver Subtotal (₹)</div>
              <input
                type="number"
                min="0"
                value={charge.waiveConditionValue}
                onChange={(e) => onChange(charge.id, "waiveConditionValue", e.target.value)}
                placeholder="e.g. 999"
                style={inputStyle}
              />
            </div>
          )}

          {/* Description */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>Description</div>
            <input
              type="text"
              value={charge.description}
              onChange={(e) => onChange(charge.id, "description", e.target.value)}
              placeholder="Short internal description"
              style={inputStyle}
            />
          </div>

          {/* Checkbox Options */}
          <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "20px", paddingTop: "4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#334155" }}>
              <input
                type="checkbox"
                checked={charge.refundable}
                onChange={(e) => onChange(charge.id, "refundable", e.target.checked)}
                style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#2563eb" }}
              />
              Refundable on return
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#334155" }}>
              <input
                type="checkbox"
                checked={charge.customerSelectable}
                onChange={(e) => {
                  onChange(charge.id, "customerSelectable", e.target.checked);
                  onChange(charge.id, "optional", e.target.checked);
                }}
                style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#2563eb" }}
              />
              Customer-selectable add-on (e.g. Gift Wrap)
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

const plainCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  overflow: "hidden",
};

const emptyCardStyle: React.CSSProperties = {
  ...plainCardStyle,
  padding: "24px 16px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "13.5px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "4px",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

export default CheckoutChargesPage;
