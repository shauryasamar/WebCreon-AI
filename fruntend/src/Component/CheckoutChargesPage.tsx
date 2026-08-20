import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";


// This is for admin checkout settings
type ChargeCode =
  | "shipping_fee"
  | "tax"
  | "handling_fee"
  | "packaging_fee"
  | "service_fee"
  | "platform_fee"
  | "small_order_fee"
  | "cod_fee"
  | "gift_wrap";


type ChargeRule = {
  id: string;
  code: ChargeCode | "custom";
  label: string;
  enabled: boolean;
  optional: boolean;
  customerSelectable: boolean;
  amountType: "fixed" | "percent";
  amountValue: string;
  applyConditionType: "none" | "subtotal_lt" | "subtotal_gte" | "payment_method";
  applyConditionValue: string;
  waiveConditionType: "none" | "subtotal_gte";
  waiveConditionValue: string;
  description: string;
};


type TaxSettings = {
  enabled: boolean;
  label: string;
  rate: string;
  applyOnShipping: boolean;
};


type CheckoutSettingsResponse = {
  taxSettings: TaxSettings;
  charges: ChargeRule[];
};


const createDefaultCharges = (): ChargeRule[] => [
  {
    id: "shipping_fee",
    code: "shipping_fee",
    label: "Shipping fee",
    enabled: true,
    optional: false,
    customerSelectable: false,
    amountType: "fixed",
    amountValue: "99",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "subtotal_gte",
    waiveConditionValue: "999",
    description: "Standard shipping charge for all eligible orders.",
  },
  {
    id: "handling_fee",
    code: "handling_fee",
    label: "Handling fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    amountType: "fixed",
    amountValue: "29",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Store handling or order processing fee.",
  },
  {
    id: "packaging_fee",
    code: "packaging_fee",
    label: "Packaging fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    amountType: "fixed",
    amountValue: "19",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Extra packaging or premium packing charge.",
  },
  {
    id: "service_fee",
    code: "service_fee",
    label: "Service fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    amountType: "fixed",
    amountValue: "15",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Store service or convenience charge.",
  },
  {
    id: "platform_fee",
    code: "platform_fee",
    label: "Platform fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    amountType: "fixed",
    amountValue: "9",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "subtotal_gte",
    waiveConditionValue: "799",
    description: "Platform or service support charge.",
  },
  {
    id: "small_order_fee",
    code: "small_order_fee",
    label: "Small order fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
    amountType: "fixed",
    amountValue: "49",
    applyConditionType: "subtotal_lt",
    applyConditionValue: "499",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Applies only when the order value is below a threshold.",
  },
  {
    id: "cod_fee",
    code: "cod_fee",
    label: "COD fee",
    enabled: false,
    optional: false,
    customerSelectable: false,
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
    amountType: "fixed",
    amountValue: "49",
    applyConditionType: "none",
    applyConditionValue: "",
    waiveConditionType: "none",
    waiveConditionValue: "",
    description: "Optional checkout add-on selected by customer.",
  },
];


const defaultTaxSettings: TaxSettings = {
  enabled: true,
  label: "GST",
  rate: "5",
  applyOnShipping: false,
};


const createDefaultCheckoutSettings = (): CheckoutSettingsResponse => ({
  taxSettings: defaultTaxSettings,
  charges: createDefaultCharges(),
});


const normalizeCharge = (charge: Partial<ChargeRule>, index: number): ChargeRule => ({
  id: String(charge.id ?? `custom_${index}`),
  code: (charge.code ?? "custom") as ChargeRule["code"],
  label: String(charge.label ?? `Custom charge ${index + 1}`),
  enabled: Boolean(charge.enabled),
  optional: Boolean(charge.optional),
  customerSelectable: Boolean(charge.customerSelectable),
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


const normalizeResponse = (data: Partial<CheckoutSettingsResponse> | null | undefined): CheckoutSettingsResponse => {
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


const CheckoutChargesPage = () => {
  const { siteId } = useParams<{ siteId: string }>();


  const [charges, setCharges] = useState<ChargeRule[]>(createDefaultCharges);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(defaultTaxSettings);
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStandardTab, setActiveStandardTab] = useState<string>("shipping_fee");
  const [activeCustomTab, setActiveCustomTab] = useState<string | null>(null);


  const activeCharges = useMemo(
    () => charges.filter((charge) => charge.enabled),
    [charges]
  );


  const optionalChargesCount = useMemo(
    () => charges.filter((charge) => charge.enabled && charge.customerSelectable).length,
    [charges]
  );


  const standardCharges = useMemo(
    () => charges.filter((charge) => charge.code !== "custom"),
    [charges]
  );


  const customCharges = useMemo(
    () => charges.filter((charge) => charge.code === "custom"),
    [charges]
  );


  const activeStandardCharge =
    standardCharges.find((charge) => charge.id === activeStandardTab) ?? standardCharges[0];


  const activeCustomCharge =
    customCharges.find((charge) => charge.id === activeCustomTab) ?? customCharges[0] ?? null;


  useEffect(() => {
    const loadCheckoutSettings = async () => {
      if (!siteId) {
        setSaveMessage("Missing site id in route.");
        setLoading(false);
        return;
      }


      try {
        setLoading(true);
        setSaveMessage("");


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


        const firstStandard = normalized.charges.find((charge) => charge.code !== "custom");
        const firstCustom = normalized.charges.find((charge) => charge.code === "custom");


        setActiveStandardTab(firstStandard?.id ?? "shipping_fee");
        setActiveCustomTab(firstCustom?.id ?? null);
      } catch (error) {
        console.error("Error loading checkout settings:", error);
        setSaveMessage("Failed to load checkout settings.");
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
    setSaveMessage("");
  };


  const addCustomCharge = () => {
    const nextId = `custom_${Date.now()}`;
    const customCount = charges.filter((charge) => charge.code === "custom").length + 1;


    setCharges((prev) => [
      ...prev,
      {
        id: nextId,
        code: "custom",
        label: `Custom charge ${customCount}`,
        enabled: true,
        optional: false,
        customerSelectable: false,
        amountType: "fixed",
        amountValue: "0",
        applyConditionType: "none",
        applyConditionValue: "",
        waiveConditionType: "none",
        waiveConditionValue: "",
        description: "Store-specific custom charge.",
      },
    ]);
    setActiveCustomTab(nextId);
    setSaveMessage("");
  };


  const removeCustomCharge = (id: string) => {
    const nextCustomCharges = customCharges.filter((charge) => charge.id !== id);
    setCharges((prev) => prev.filter((charge) => charge.id !== id));
    setActiveCustomTab(nextCustomCharges[0]?.id ?? null);
    setSaveMessage("");
  };


  const handleSave = async () => {
    if (!siteId) {
      setSaveMessage("Missing site id in route.");
      return;
    }


    try {
      setSaving(true);
      setSaveMessage("");


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
      setSaveMessage("Checkout settings saved successfully.");
    } catch (error) {
      console.error("Error saving checkout settings:", error);
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to save checkout settings."
      );
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div
        style={{
          minHeight: "320px",
          display: "grid",
          placeItems: "center",
          color: "#0f172a",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
          Loading checkout settings...
        </p>
      </div>
    );
  }


  return (
    <div style={{ maxWidth: "1120px", color: "#0f172a" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "18px",
        }}
      >
        <button onClick={handleSave} style={primaryButtonStyle} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <StatCard label="Active charges" value={String(activeCharges.length)} />
        <StatCard label="Optional charges" value={String(optionalChargesCount)} />
        <StatCard
          label="Tax status"
          value={taxSettings.enabled ? "Enabled" : "Disabled"}
        />
      </div>


      <SectionCard
        title="Tax settings"
        subtitle="Tax stays separate from other charges because it is not waivable."
        style={{ marginBottom: "20px" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <ToggleField
            label="Enable tax"
            checked={taxSettings.enabled}
            onChange={(checked) => {
              setTaxSettings((prev) => ({ ...prev, enabled: checked }));
              setSaveMessage("");
            }}
          />
          <FormField
            label="Tax label"
            value={taxSettings.label}
            onChange={(value) => {
              setTaxSettings((prev) => ({ ...prev, label: value }));
              setSaveMessage("");
            }}
          />
          <FormField
            label="Tax rate (%)"
            type="number"
            value={taxSettings.rate}
            onChange={(value) => {
              setTaxSettings((prev) => ({ ...prev, rate: value }));
              setSaveMessage("");
            }}
          />
          <ToggleField
            label="Apply tax on shipping"
            checked={taxSettings.applyOnShipping}
            onChange={(checked) => {
              setTaxSettings((prev) => ({ ...prev, applyOnShipping: checked }));
              setSaveMessage("");
            }}
          />
        </div>
      </SectionCard>


      <SectionCard
        title="Standard charges"
        subtitle="Click a charge button to open and edit that section only."
        style={{ marginBottom: "20px" }}
      >
        <TabBar
          items={standardCharges.map((charge) => ({
            id: charge.id,
            label: charge.label,
            enabled: charge.enabled,
          }))}
          activeId={activeStandardCharge?.id ?? ""}
          onChange={setActiveStandardTab}
        />


        {activeStandardCharge ? (
          <div style={{ marginTop: "14px" }}>
            <ChargeCard charge={activeStandardCharge} onChange={updateCharge} />
          </div>
        ) : null}
      </SectionCard>


      <SectionCard
        title="Custom charges"
        subtitle="Each custom charge gets its own tab. Add a new one to create another section."
        action={
          <button onClick={addCustomCharge} style={primaryButtonStyle}>
            + Add custom charge
          </button>
        }
      >
        {customCharges.length === 0 ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "6px",
              border: "1px dashed #cbd5e1",
              color: "#64748b",
              fontSize: "14px",
              background: "#ffffff",
            }}
          >
            No custom charges added yet.
          </div>
        ) : (
          <>
            <TabBar
              items={customCharges.map((charge) => ({
                id: charge.id,
                label: charge.label,
                enabled: charge.enabled,
              }))}
              activeId={activeCustomCharge?.id ?? ""}
              onChange={setActiveCustomTab}
            />


            {activeCustomCharge ? (
              <div style={{ marginTop: "14px" }}>
                <ChargeCard
                  charge={activeCustomCharge}
                  onChange={updateCharge}
                  onRemove={() => removeCustomCharge(activeCustomCharge.id)}
                />
              </div>
            ) : null}
          </>
        )}
      </SectionCard>


      {saveMessage ? (
        <div
          style={{
            marginTop: "16px",
            padding: "10px 12px",
            borderRadius: "6px",
            background: saveMessage.toLowerCase().includes("saved") ? "#f0fdf4" : "#fef2f2",
            border: saveMessage.toLowerCase().includes("saved")
              ? "1px solid #bbf7d0"
              : "1px solid #fecaca",
            color: saveMessage.toLowerCase().includes("saved") ? "#15803d" : "#b91c1c",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {saveMessage}
        </div>
      ) : null}
    </div>
  );
};


const SectionCard = ({
  title,
  subtitle,
  action,
  children,
  style,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      padding: "16px",
      borderRadius: "8px",
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      ...style,
    }}
  >
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
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: "15px", color: "#0f172a", fontWeight: 700 }}>
          {title}
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>{subtitle}</p>
      </div>
      {action}
    </div>


    {children}
  </div>
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


const TabBar = ({
  items,
  activeId,
  onChange,
}: {
  items: { id: string; label: string; enabled: boolean }[];
  activeId: string;
  onChange: (id: string) => void;
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      gap: "8px",
      width: "100%",
    }}
  >
    {items.map((item) => {
      const isActive = item.id === activeId;
      const shortLabel = getShortTabLabel(item.label);


      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          style={{
            minWidth: 0,
            padding: "8px 8px",
            borderRadius: "6px",
            border: isActive ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
            background: isActive ? "#eff6ff" : "#ffffff",
            color: isActive ? "#1d4ed8" : "#334155",
            fontWeight: isActive ? 700 : 600,
            fontSize: "12px",
            lineHeight: 1.2,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={item.label}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shortLabel}
          </span>


          <span
            style={{
              width: "6px",
              height: "6px",
              minWidth: "6px",
              borderRadius: "999px",
              background: item.enabled ? "#22c55e" : "#cbd5e1",
              display: "inline-block",
            }}
          />
        </button>
      );
    })}
  </div>
);


const ChargeCard = ({
  charge,
  onChange,
  onRemove,
}: {
  charge: ChargeRule;
  onChange: (id: string, field: keyof ChargeRule, value: string | boolean) => void;
  onRemove?: () => void;
}) => {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "6px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "14px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: "14px", color: "#0f172a", fontWeight: 700 }}>
            {charge.label}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>{charge.description}</p>
        </div>


        {onRemove ? (
          <button onClick={onRemove} style={dangerButtonStyle}>
            Remove
          </button>
        ) : null}
      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <ToggleField
          label="Enable charge"
          checked={charge.enabled}
          onChange={(checked) => onChange(charge.id, "enabled", checked)}
        />


        <ToggleField
          label="Optional charge"
          checked={charge.optional}
          onChange={(checked) => onChange(charge.id, "optional", checked)}
        />


        <ToggleField
          label="Customer selectable"
          checked={charge.customerSelectable}
          onChange={(checked) => onChange(charge.id, "customerSelectable", checked)}
        />


        <SelectField
          label="Amount type"
          value={charge.amountType}
          onChange={(value) => onChange(charge.id, "amountType", value)}
          options={[
            { label: "Fixed amount", value: "fixed" },
            { label: "Percentage", value: "percent" },
          ]}
        />


        <FormField
          label={charge.amountType === "fixed" ? "Amount (₹)" : "Amount (%)"}
          type="number"
          value={charge.amountValue}
          onChange={(value) => onChange(charge.id, "amountValue", value)}
        />


        <FormField
          label="Customer label"
          value={charge.label}
          onChange={(value) => onChange(charge.id, "label", value)}
        />


        <SelectField
          label="Apply condition"
          value={charge.applyConditionType}
          onChange={(value) => onChange(charge.id, "applyConditionType", value)}
          options={[
            { label: "No condition", value: "none" },
            { label: "Subtotal less than", value: "subtotal_lt" },
            { label: "Subtotal greater than or equal", value: "subtotal_gte" },
            { label: "Payment method", value: "payment_method" },
          ]}
        />


        <FormField
          label="Apply condition value"
          value={charge.applyConditionValue}
          onChange={(value) => onChange(charge.id, "applyConditionValue", value)}
        />


        <SelectField
          label="Waive condition"
          value={charge.waiveConditionType}
          onChange={(value) => onChange(charge.id, "waiveConditionType", value)}
          options={[
            { label: "No waiver", value: "none" },
            { label: "Waive at subtotal >=", value: "subtotal_gte" },
          ]}
        />


        <FormField
          label="Waive condition value"
          value={charge.waiveConditionValue}
          onChange={(value) => onChange(charge.id, "waiveConditionValue", value)}
        />
      </div>
    </div>
  );
};


const FormField = ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <span style={labelStyle}>{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  </label>
);


const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <span style={labelStyle}>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);


const ToggleField = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minHeight: "42px",
      color: "#334155",
      fontSize: "14px",
      fontWeight: 600,
      paddingTop: "24px",
    }}
  >
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);


const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      padding: "14px 16px",
      borderRadius: "8px",
      background: "#ffffff",
      border: "1px solid #e2e8f0",
    }}
  >
    <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#64748b" }}>{label}</p>
    <h3 style={{ margin: 0, fontSize: "22px", color: "#0f172a" }}>{value}</h3>
  </div>
);


const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#475569",
};


const inputStyle: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
  width: "100%",
};


const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};


const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 600,
  cursor: "pointer",
};


export default CheckoutChargesPage;
