import React, { useEffect, useMemo, useState } from "react";
import {
  createCheckoutAddress,
  deleteCheckoutAddress,
  getCheckoutAddresses,
  SavedAddress,
  setDefaultCheckoutAddress,
  updateCheckoutAddress,
} from "../addressService";

type ThemeInput =
  | "dark"
  | "light"
  | {
      mode?: string;
      primary_bg?: string;
      text_color?: string;
      accent_color?: string;
      festival_theme?: string;
    };

export type DeliveryFormData = {
  id?: string;
  label?: string;
  isDefault?: boolean;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
};

type DeliveryFormProps = {
  siteId: string;
  sectionLabel?: string;
  title?: string;
  theme?: ThemeInput;
  accentColor?: string;
  compact?: boolean;
  background_color?: string;
  input_color?: string;
  text_color?: string;
  muted_text_color?: string;
  soft_text_color?: string;
  placeholder_color?: string;
  border_color?: string;
  soft_border_color?: string;
  border_radius?: number;
  field_radius?: number;
  padding?: number;
  gap?: number;
  max_width?: number;
  deliveryData?: DeliveryFormData;
  onDeliveryDataChange?: (data: DeliveryFormData) => void;
  onContinue?: () => void;
  continueDisabled?: boolean;
  savedAddresses?: DeliveryFormData[];
  selectedAddressId?: string | null;
  onSelectAddress?: (address: DeliveryFormData) => void;
  onSavedAddressesChange?: (addresses: DeliveryFormData[]) => void;
  isAuthenticated?: boolean;
  isAddressesLoading?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex?: string) {
  if (!hex) return null;
  const cleaned = hex.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned
      .split("")
      .map((char) => char + char)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  return null;
}

function hexToRgb(hex?: string) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(colorA: string, colorB: string, weight = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);

  if (!a && !b) return "#000000";
  if (!a) return colorB;
  if (!b) return colorA;

  const w = clamp(weight, 0, 1);

  return rgbToHex(
    a.r + (b.r - a.r) * w,
    a.g + (b.g - a.g) * w,
    a.b + (b.b - a.b) * w
  );
}

function alpha(hex: string, opacity: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${opacity})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(opacity, 0, 1)})`;
}

function isAddressValid(data: DeliveryFormData) {
  return Boolean(
    data.fullName.trim() &&
      data.phone.trim() &&
      data.email.trim() &&
      data.address.trim() &&
      data.city.trim() &&
      data.pincode.trim()
  );
}

function mapSavedAddressToDeliveryData(address: SavedAddress): DeliveryFormData {
  return {
    id: address.id,
    label: address.addressType || "Home",
    isDefault: address.isDefault,
    fullName: address.fullName || "",
    phone: address.mobileNumber || "",
    email: address.email || "",
    address: address.addressLine1 || "",
    city: address.city || "",
    pincode: address.postalCode || "",
  };
}

function toAddressPayload(data: DeliveryFormData) {
  return {
    full_name: data.fullName.trim(),
    mobile_number: data.phone.trim(),
    address_line1: data.address.trim(),
    city: data.city.trim(),
    postal_code: data.pincode.trim(),
    email: data.email.trim() || null,
    address_type: (data.label || "Home").trim(),
    is_default: Boolean(data.isDefault),
  };
}

const emptyDeliveryData: DeliveryFormData = {
  id: "",
  label: "Home",
  isDefault: false,
  fullName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  pincode: "",
};

export const DeliveryForm: React.FC<DeliveryFormProps> = ({
  siteId,
  sectionLabel = "Delivery",
  title = "Delivery Address",
  theme = "light",
  accentColor,
  compact = false,
  background_color,
  input_color,
  text_color,
  muted_text_color,
  soft_text_color,
  placeholder_color,
  border_color,
  soft_border_color,
  border_radius,
  field_radius,
  padding,
  gap,
  max_width,
  deliveryData = emptyDeliveryData,
  onDeliveryDataChange,
  onContinue,
  continueDisabled = false,
  savedAddresses = [],
  selectedAddressId = null,
  onSelectAddress,
  onSavedAddressesChange,
  isAuthenticated = false,
  isAddressesLoading = false,
}) => {
  console.log("DeliveryForm isAuthenticated:", isAuthenticated);
  const [addresses, setAddresses] = useState<DeliveryFormData[]>(savedAddresses);
  const [formMode, setFormMode] = useState<"hidden" | "add" | "edit">("hidden");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [draftAddress, setDraftAddress] = useState<DeliveryFormData>(emptyDeliveryData);
  const [isMobile, setIsMobile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

useEffect(() => {
  setAddresses(savedAddresses);
  
  if (!isAuthenticated) {
    setFormMode("hidden");
    setEditingAddressId(null);
    setDraftAddress(emptyDeliveryData);
    return;
  }

  if (savedAddresses.length === 0) {
    setEditingAddressId(null);

    if (formMode !== "add") {
      setFormMode("hidden");
      setDraftAddress(emptyDeliveryData);
    }

    return;
  }

  const selectedStillExists = savedAddresses.some(
    (address: DeliveryFormData) => address.id === selectedAddressId
  );

  if (!selectedStillExists) {
    const defaultAddress =
      savedAddresses.find((address: DeliveryFormData) => address.isDefault) ||
      savedAddresses[0];

    if (defaultAddress) {
      onSelectAddress?.(defaultAddress);
      onDeliveryDataChange?.(defaultAddress);
    }
  }
}, [
  savedAddresses,
  selectedAddressId,
  onSelectAddress,
  onDeliveryDataChange,
  isAuthenticated,
  formMode,
]);

  useEffect(() => {
    if (formMode === "edit" || formMode === "add") return;

    if (
      deliveryData?.fullName ||
      deliveryData?.phone ||
      deliveryData?.email ||
      deliveryData?.address ||
      deliveryData?.city ||
      deliveryData?.pincode
    ) {
      setDraftAddress((prev) => ({
        ...prev,
        ...emptyDeliveryData,
        ...deliveryData,
      }));
    }
  }, [deliveryData, formMode]);

  const themeObject = typeof theme === "object" ? theme : undefined;
  const isDark = themeObject ? themeObject.mode !== "light" : theme === "dark";
  const resolvedAccent =
    accentColor ||
    themeObject?.accent_color ||
    (isDark ? "#4f8cff" : "#2f6df6");

  const resolvedPrimaryBg =
    background_color ||
    themeObject?.primary_bg ||
    (isDark ? "#0f172a" : "#f6f7fb");

  const resolvedText =
    text_color ||
    themeObject?.text_color ||
    (isDark ? "#f8fafc" : "#111827");

  const resolvedPadding = padding ?? (compact ? 16 : 18);
  const resolvedGap = gap ?? 16;
  const resolvedBorderRadius = border_radius ?? 14;
  const resolvedFieldRadius = field_radius ?? 8;

  const palette = useMemo(() => {
    if (!isDark) {
      // Light or Warm Festive Light Theme
      const surfaceBg = background_color || (themeObject as any)?.surface_bg || (themeObject as any)?.card_bg || (themeObject as any)?.secondary_bg || mixHex(resolvedPrimaryBg, "#ffffff", 0.7);
      const isPureWhiteBg = resolvedPrimaryBg.toLowerCase() === "#ffffff" || resolvedPrimaryBg.toLowerCase() === "#f8fafc" || resolvedPrimaryBg.toLowerCase() === "#f6f7fb";
      const cardBgFinal = background_color || (isPureWhiteBg ? (themeObject as any)?.card_bg || (themeObject as any)?.secondary_bg || "#ffffff" : surfaceBg);
      const inputBgFinal = input_color || (isPureWhiteBg ? "#ffffff" : mixHex(cardBgFinal, "#ffffff", 0.5));
      const borderFinal = border_color || (isPureWhiteBg ? "#e5e7eb" : mixHex(resolvedText, cardBgFinal, 0.15));

      return {
        cardBg: cardBgFinal,
        panelBg: cardBgFinal,
        listCardBg: isPureWhiteBg ? "#ffffff" : mixHex(cardBgFinal, "#ffffff", 0.3),
        listCardSelectedBg: alpha(resolvedAccent, 0.08),
        emptyStateBg: isPureWhiteBg ? "#f8fafc" : mixHex(cardBgFinal, "#000000", 0.03),
        emptyStateBorder: borderFinal,
        inputBg: inputBgFinal,
        inputText: resolvedText,
        border: borderFinal,
        softBorder: soft_border_color || mixHex(borderFinal, cardBgFinal, 0.5),
        selectedBorder: resolvedAccent,
        text: resolvedText,
        textMuted: muted_text_color || mixHex(resolvedText, cardBgFinal, 0.4),
        textSoft: soft_text_color || mixHex(resolvedText, cardBgFinal, 0.55),
        placeholder: placeholder_color || mixHex(resolvedText, cardBgFinal, 0.55),
        shadow: "0 2px 8px rgba(0,0,0,0.05)",
        accentRing: `0 0 0 3px ${resolvedAccent}22`,
        subtleButtonBg: inputBgFinal,
        subtleButtonText: resolvedText,
        subtleButtonBorder: borderFinal,
        secondaryButtonBg: inputBgFinal,
        secondaryButtonText: muted_text_color || mixHex(resolvedText, cardBgFinal, 0.4),
        secondaryButtonBorder: borderFinal,
        primaryButtonBg: resolvedAccent,
        primaryButtonDisabledBg: mixHex(resolvedAccent, cardBgFinal, 0.3),
        primaryButtonText: "#ffffff",
        radioBorder: borderFinal,
        editText: mixHex(resolvedText, cardBgFinal, 0.5),
        deleteText: "#dc2626",
        defaultBadgeBg: alpha(resolvedAccent, 0.1),
        errorBg: "#fef2f2",
        errorText: "#b91c1c",
        errorBorder: "#fecaca",
      };
    }

    // Dark or Deep Festive Dark Theme (e.g. Deep Maroon, Forest Emerald, Festive Purple, Slate Dark)
    const cardBgDark = background_color || (themeObject as any)?.surface_bg || (themeObject as any)?.card_bg || (themeObject as any)?.secondary_bg || mixHex(resolvedPrimaryBg, "#ffffff", 0.06);
    const inputBgDark = input_color || mixHex(resolvedPrimaryBg, "#ffffff", 0.09);
    const borderDark = border_color || mixHex(resolvedText, resolvedPrimaryBg, 0.15);

    return {
      cardBg: cardBgDark,
      panelBg: mixHex(resolvedPrimaryBg, "#ffffff", 0.07),
      listCardBg: mixHex(resolvedPrimaryBg, "#ffffff", 0.04),
      listCardSelectedBg: alpha(resolvedAccent, 0.16),
      emptyStateBg: mixHex(resolvedPrimaryBg, "#ffffff", 0.04),
      emptyStateBorder: borderDark,
      inputBg: inputBgDark,
      inputText: resolvedText,
      border: borderDark,
      softBorder: soft_border_color || mixHex(borderDark, resolvedPrimaryBg, 0.5),
      selectedBorder: resolvedAccent,
      text: resolvedText,
      textMuted: muted_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.3),
      textSoft: soft_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.45),
      placeholder: placeholder_color || mixHex(resolvedText, resolvedPrimaryBg, 0.45),
      shadow: "0 8px 22px rgba(0,0,0,0.25)",
      accentRing: `0 0 0 3px ${resolvedAccent}2e`,
      subtleButtonBg: mixHex(resolvedPrimaryBg, "#ffffff", 0.07),
      subtleButtonText: resolvedText,
      subtleButtonBorder: borderDark,
      secondaryButtonBg: mixHex(resolvedPrimaryBg, "#ffffff", 0.05),
      secondaryButtonText: muted_text_color || mixHex(resolvedText, resolvedPrimaryBg, 0.3),
      secondaryButtonBorder: borderDark,
      primaryButtonBg: resolvedAccent,
      primaryButtonDisabledBg: "rgba(148,163,184,0.28)",
      primaryButtonText: "#ffffff",
      radioBorder: borderDark,
      editText: mixHex(resolvedText, resolvedPrimaryBg, 0.35),
      deleteText: "#f87171",
      defaultBadgeBg: alpha(resolvedAccent, 0.16),
      errorBg: "rgba(239,68,68,0.12)",
      errorText: "#fca5a5",
      errorBorder: "rgba(248,113,113,0.32)",
    };
  }, [
    background_color,
    border_color,
    input_color,
    isDark,
    muted_text_color,
    placeholder_color,
    resolvedAccent,
    resolvedPrimaryBg,
    resolvedText,
    soft_border_color,
    soft_text_color,
  ]);

  const syncAddresses = (nextAddresses: DeliveryFormData[]) => {
    setAddresses(nextAddresses);
    onSavedAddressesChange?.(nextAddresses);
  };

  const handleDraftChange =
    (field: keyof DeliveryFormData) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
      const value =
        field === "isDefault"
          ? (event.target as HTMLInputElement).checked
          : event.target.value;

      const nextDraft = {
        ...draftAddress,
        [field]: value,
      };

      setDraftAddress(nextDraft);
      onDeliveryDataChange?.(nextDraft);
    };

  const handleSelectAddress = (address: DeliveryFormData) => {
    onSelectAddress?.(address);
    onDeliveryDataChange?.(address);
  };

  const handleAddNew = () => {
    if (!isAuthenticated) {
      setErrorMessage("Please sign in or signup to continue shopping.");
      return;
    }

    const hasDefault = addresses.some(
      (address: DeliveryFormData) => address.isDefault
    );

    const nextDraft: DeliveryFormData = {
      ...emptyDeliveryData,
      label: "Home",
      isDefault: !hasDefault,
    };

    setErrorMessage("");
    setDraftAddress(nextDraft);
    onDeliveryDataChange?.(nextDraft);
    setEditingAddressId(null);
    setFormMode("add");
  };

  const handleEdit = (address: DeliveryFormData) => {
    setErrorMessage("");
    setDraftAddress({
      ...emptyDeliveryData,
      ...address,
      isDefault: Boolean(address.isDefault),
    });
    onDeliveryDataChange?.(address);
    setEditingAddressId(address.id || null);
    setFormMode("edit");
  };

  const handleCloseForm = () => {
  setErrorMessage("");
  setEditingAddressId(null);
  setDraftAddress(emptyDeliveryData);
  setFormMode("hidden");

  if (addresses.length === 0) {
    onDeliveryDataChange?.(emptyDeliveryData);
  }
};

  const refreshAddressesFromServer = async (
    preferredAddressId?: string | null
  ): Promise<DeliveryFormData[]> => {
    const response = await getCheckoutAddresses(siteId);
    const nextAddresses: DeliveryFormData[] = response.map(
      (address: SavedAddress) => mapSavedAddressToDeliveryData(address)
    );

    syncAddresses(nextAddresses);

    const nextSelected =
      nextAddresses.find(
        (address: DeliveryFormData) => address.id === preferredAddressId
      ) ||
      nextAddresses.find((address: DeliveryFormData) => address.isDefault) ||
      nextAddresses[0] ||
      null;

    if (nextSelected) {
      onSelectAddress?.(nextSelected);
      onDeliveryDataChange?.(nextSelected);
    } else {
      onDeliveryDataChange?.(emptyDeliveryData);
    }

    return nextAddresses;
  };

  const handleDeleteAddress = async () => {
    if (!editingAddressId) return;

    try {
      setIsDeleting(true);
      setErrorMessage("");
      await deleteCheckoutAddress(siteId, editingAddressId);
      await refreshAddressesFromServer(null);

      setEditingAddressId(null);
      setDraftAddress(emptyDeliveryData);
      setFormMode("hidden");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete address"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!isAuthenticated) {
      setErrorMessage("Please sign in or signup to continue shopping.");
      return;
    }

    if (!isAddressValid(draftAddress)) return;

    try {
      setIsSaving(true);
      setErrorMessage("");

      let saved: SavedAddress;

      if (formMode === "edit" && editingAddressId) {
        saved = await updateCheckoutAddress(
          siteId,
          editingAddressId,
          toAddressPayload(draftAddress)
        );
      } else {
        saved = await createCheckoutAddress(siteId, toAddressPayload(draftAddress));
      }

      if (draftAddress.isDefault && saved.id) {
        await setDefaultCheckoutAddress(siteId, saved.id);
      }

      const refreshed = await refreshAddressesFromServer(saved.id);
      const selected =
        refreshed.find((address: DeliveryFormData) => address.id === saved.id) ||
        refreshed[0] ||
        null;

      if (selected) {
        setEditingAddressId(selected.id || null);
      } else {
        setEditingAddressId(null);
      }

      setFormMode("hidden");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save address";

      if (
        message.toLowerCase().includes("authentication required") ||
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("customer authentication required")
      ) {
        setErrorMessage("Please sign in or signup to continue shopping.");
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAddress =
    addresses.find((address: DeliveryFormData) => address.id === selectedAddressId) ||
    addresses.find((address: DeliveryFormData) => address.isDefault) ||
    null;

  const disableContinue = !selectedAddress || continueDisabled;
  const showAddressList = addresses.length > 0;
  const showForm = formMode !== "hidden";
  const isSplitView = showForm && !compact && !isMobile;
  const isEditMode = formMode === "edit";

  const inputBaseStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "42px",
    padding: "10px 12px",
    borderRadius: `${resolvedFieldRadius}px`,
    border: `1px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.inputText,
    outline: "none",
    fontSize: "13px",
    lineHeight: 1.4,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 600,
    marginBottom: "6px",
    color: palette.textMuted,
  };

  return (
    <section
      style={{
        width: "100%",
        maxWidth: max_width ? `${max_width}px` : undefined,
      }}
    >
      <div
        style={{
          width: "100%",
          border: `1px solid ${palette.softBorder}`,
          borderRadius: `${resolvedBorderRadius}px`,
          background: palette.cardBg,
          boxSizing: "border-box",
          boxShadow: palette.shadow,
          padding: isMobile ? "14px" : `${resolvedPadding}px`,
        }}
      >
        <div
          style={{
            marginBottom: `${resolvedGap}px`,
            display: "flex",
            alignItems: isMobile ? "stretch" : "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: isMobile ? "20px" : "24px",
                lineHeight: 1.15,
                fontWeight: 700,
                color: palette.text,
              }}
            >
              {title}
            </h3>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "12px",
                lineHeight: 1.5,
                color: palette.textMuted,
              }}
            >
              {isAuthenticated
                ? "Select one of your saved delivery addresses or add a new one."
                : "Please sign in or signup to continue shopping."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddNew}
            style={{
              minHeight: "40px",
              border: `1px solid ${palette.subtleButtonBorder}`,
              borderRadius: "10px",
              background: palette.subtleButtonBg,
              color: palette.subtleButtonText,
              padding: isMobile ? "0 12px" : "0 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              width: isMobile ? "100%" : "auto",
            }}
          >
            + Add New Address
          </button>
        </div>

        {errorMessage ? (
          <div
            style={{
              marginBottom: "14px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${palette.errorBorder}`,
              background: palette.errorBg,
              color: palette.errorText,
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isSplitView
              ? "minmax(0, 1.15fr) minmax(320px, 0.85fr)"
              : "minmax(0, 1fr)",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "grid",
              gap: "12px",
            }}
          >
            {isAddressesLoading ? (
              <div
                style={{
                  borderRadius: "12px",
                  border: `1px dashed ${palette.emptyStateBorder}`,
                  background: palette.emptyStateBg,
                  padding: isMobile ? "16px" : "20px",
                  fontSize: "13px",
                  color: palette.textMuted,
                }}
              >
                Loading saved addresses...
              </div>
            ) : showAddressList ? (
              addresses.map((address: DeliveryFormData) => {
                const isSelected = address.id === selectedAddressId;

                return (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => handleSelectAddress(address)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: `1px solid ${
                        isSelected ? palette.selectedBorder : palette.border
                      }`,
                      background: isSelected
                        ? palette.listCardSelectedBg
                        : palette.listCardBg,
                      borderRadius: "12px",
                      padding: isMobile ? "12px" : "14px 16px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "flex-start",
                        flexDirection: isMobile ? "column" : "row",
                      }}
                    >
                      <div style={{ minWidth: 0, display: "flex", gap: "10px", width: "100%" }}>
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "999px",
                            border: `1.5px solid ${
                              isSelected ? resolvedAccent : palette.radioBorder
                            }`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: "2px",
                            flexShrink: 0,
                          }}
                        >
                          {isSelected ? (
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "999px",
                                background: resolvedAccent,
                              }}
                            />
                          ) : null}
                        </div>

                        <div style={{ minWidth: 0, width: "100%" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: resolvedAccent,
                              }}
                            >
                              {address.label || "Home"}
                            </span>

                            {address.isDefault ? (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: resolvedAccent,
                                  background: palette.defaultBadgeBg,
                                  borderRadius: "999px",
                                  padding: "3px 8px",
                                }}
                              >
                                Default
                              </span>
                            ) : null}
                          </div>

                          <div
                            style={{
                              fontSize: isMobile ? "15px" : "16px",
                              fontWeight: 700,
                              color: palette.text,
                              marginBottom: "4px",
                            }}
                          >
                            {address.fullName}
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              lineHeight: 1.6,
                              color: palette.textMuted,
                              wordBreak: "break-word",
                            }}
                          >
                            <div>{address.phone}</div>
                            <div>{address.address}</div>
                            <div>
                              {address.city}, {address.pincode}
                            </div>
                            <div>{address.email}</div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(address);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: palette.editText,
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                          flexShrink: 0,
                          alignSelf: isMobile ? "flex-end" : "flex-start",
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </button>
                );
              })
            ) : (
              <div
                style={{
                  borderRadius: "12px",
                  border: `1px dashed ${palette.emptyStateBorder}`,
                  background: palette.emptyStateBg,
                  padding: isMobile ? "16px" : "20px",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 6px",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: palette.text,
                  }}
                >
                  No address saved
                </h4>

                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: palette.textMuted,
                  }}
                >
                  {isAuthenticated
                    ? "Add your first delivery address to continue."
                    : "Please sign in or signup to continue shopping."}
                </p>
              </div>
            )}
          </div>

          {showForm ? (
            <div
              style={{
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  border: `1px solid ${palette.border}`,
                  borderRadius: "12px",
                  background: palette.panelBg,
                  padding: isMobile ? "14px" : "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "stretch" : "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "14px",
                    flexDirection: isMobile ? "column" : "row",
                  }}
                >
                  <div>
                    <h4
                      style={{
                        margin: "0 0 4px",
                        fontSize: "18px",
                        fontWeight: 700,
                        color: palette.text,
                      }}
                    >
                      {formMode === "edit" ? "Edit Address" : "Add New Address"}
                    </h4>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        lineHeight: 1.5,
                        color: palette.textMuted,
                      }}
                    >
                      Fill in the details below
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseForm}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: palette.textMuted,
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                      alignSelf: isMobile ? "flex-end" : "auto",
                    }}
                  >
                    Close
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveAddress();
                  }}
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "minmax(0, 1fr)"
                        : "repeat(2, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor="delivery-full-name" style={labelStyle}>
                        Full Name
                      </label>
                      <input
                        id="delivery-full-name"
                        value={draftAddress.fullName}
                        onChange={handleDraftChange("fullName")}
                        placeholder="Full name"
                        style={inputBaseStyle}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <label htmlFor="delivery-phone" style={labelStyle}>
                        Mobile Number
                      </label>
                      <input
                        id="delivery-phone"
                        value={draftAddress.phone}
                        onChange={handleDraftChange("phone")}
                        placeholder="+91 98765 43210"
                        style={inputBaseStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="delivery-address" style={labelStyle}>
                      Address Line 1
                    </label>
                    <input
                      id="delivery-address"
                      value={draftAddress.address}
                      onChange={handleDraftChange("address")}
                      placeholder="House no, street, area"
                      style={inputBaseStyle}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "minmax(0, 1fr)"
                        : "repeat(2, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor="delivery-city" style={labelStyle}>
                        City
                      </label>
                      <input
                        id="delivery-city"
                        value={draftAddress.city}
                        onChange={handleDraftChange("city")}
                        placeholder="City"
                        style={inputBaseStyle}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <label htmlFor="delivery-pincode" style={labelStyle}>
                        Postal Code
                      </label>
                      <input
                        id="delivery-pincode"
                        value={draftAddress.pincode}
                        onChange={handleDraftChange("pincode")}
                        placeholder="Postal code"
                        style={inputBaseStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="delivery-email" style={labelStyle}>
                      Email Address
                    </label>
                    <input
                      id="delivery-email"
                      value={draftAddress.email}
                      onChange={handleDraftChange("email")}
                      placeholder="Email address"
                      style={inputBaseStyle}
                    />
                  </div>

                  <div>
                    <label htmlFor="delivery-label" style={labelStyle}>
                      Address Type
                    </label>
                    <select
                      id="delivery-label"
                      value={draftAddress.label || "Home"}
                      onChange={handleDraftChange("label")}
                      style={inputBaseStyle}
                    >
                      <option value="Home">Home</option>
                      <option value="Office">Office</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <label
                    htmlFor="delivery-default-address"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      userSelect: "none",
                      marginTop: "2px",
                    }}
                  >
                    <input
                      id="delivery-default-address"
                      type="checkbox"
                      checked={Boolean(draftAddress.isDefault)}
                      onChange={handleDraftChange("isDefault")}
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: resolvedAccent,
                        cursor: "pointer",
                        margin: 0,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        color: palette.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      Make this my default address
                    </span>
                  </label>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginTop: "6px",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      {isEditMode ? (
                        <button
                          type="button"
                          onClick={handleDeleteAddress}
                          disabled={isDeleting}
                          style={{
                            minHeight: "42px",
                            borderRadius: "8px",
                            border: "none",
                            background: "transparent",
                            color: palette.deleteText,
                            padding: "0 4px",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: isDeleting ? "not-allowed" : "pointer",
                            width: isMobile ? "100%" : "auto",
                            textAlign: isMobile ? "left" : "left",
                            opacity: isDeleting ? 0.6 : 1,
                          }}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexDirection: isMobile ? "column-reverse" : "row",
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleCloseForm}
                        style={{
                          minHeight: "42px",
                          borderRadius: "8px",
                          border: `1px solid ${palette.secondaryButtonBorder}`,
                          background: palette.secondaryButtonBg,
                          color: palette.secondaryButtonText,
                          padding: "0 16px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          width: isMobile ? "100%" : "auto",
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={!isAddressValid(draftAddress) || isSaving}
                        style={{
                          minHeight: "42px",
                          minWidth: isMobile ? "100%" : "140px",
                          width: isMobile ? "100%" : "auto",
                          borderRadius: "8px",
                          border: "none",
                          background:
                            isAddressValid(draftAddress) && !isSaving
                              ? palette.primaryButtonBg
                              : palette.primaryButtonDisabledBg,
                          color: palette.primaryButtonText,
                          padding: "0 18px",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor:
                            isAddressValid(draftAddress) && !isSaving
                              ? "pointer"
                              : "not-allowed",
                        }}
                      >
                        {isSaving
                          ? "Saving..."
                          : formMode === "edit"
                          ? "Save Changes"
                          : "Save Address"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "16px",
          }}
        >
          <button
            type="button"
            onClick={onContinue}
            disabled={disableContinue}
            style={{
              minHeight: "42px",
              minWidth: isMobile ? "100%" : "120px",
              width: isMobile ? "100%" : "auto",
              borderRadius: "8px",
              border: "none",
              background: disableContinue
                ? palette.primaryButtonDisabledBg
                : palette.primaryButtonBg,
              color: palette.primaryButtonText,
              padding: "0 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: disableContinue ? "not-allowed" : "pointer",
            }}
          >
            Continue
          </button>
        </div>
      </div>

      <style>
        {`
          input::placeholder,
          textarea::placeholder {
            color: ${palette.placeholder};
            opacity: 1;
          }

          input:focus,
          textarea:focus,
          select:focus {
            border-color: ${resolvedAccent};
            box-shadow: ${palette.accentRing};
          }

          @media (max-width: 767px) {
            select,
            input,
            textarea,
            button {
              font-size: 16px !important;
            }
          }
        `}
      </style>
    </section>
  );
};

export default DeliveryForm;