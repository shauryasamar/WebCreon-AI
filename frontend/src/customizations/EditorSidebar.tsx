import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  applyFestivalTheme,
  applyThemeMode,
  applyThemeSnapshot,
  deleteThemeSnapshot,
  EditorSiteDefinition,
  FestivalThemeKey,
  findBlockById,
  getEditableConfigForBlock,
  getSavedThemeSnapshots,
  getSiteStorageId,
  saveThemeSnapshot,
  updateBlockFieldValue,
  updateThemeValues,
} from "./editorUtils";
import { EditorField } from "./editorTypes";
import { API_BASE_URL } from "../config/api";
import { optimizeImageUrl, compressImageFile } from "../utils/imageOptimizer";

function PageBlocksTreeView({
  siteDefinition: _siteDefinition,
  onSelectBlock,
  onSelectPage,
}: {
  siteDefinition: EditorSiteDefinition;
  onSelectBlock?: (blockId: string | null) => void;
  onSelectPage?: (pageId: string) => void;
  isLightMode?: boolean;
}) {
  const location = useLocation();
  const currentPath = location.pathname;

  const homeBlocks = useMemo(() => {
    const customHome = _siteDefinition?.pages?.find((p: any) => p.id === "home" || p.route === "/");
    if (customHome && Array.isArray(customHome.blocks) && customHome.blocks.length > 0) {
      return customHome.blocks.map((b: any) => ({
        id: b.id || b.type,
        type: b.type,
        name: b.props?.title || b.name || b.type,
      }));
    }
    return [
      { id: "navbar", type: "navbar", name: "Navbar" },
      { id: "hero_banner", type: "hero_banner", name: "Hero Banner" },
      { id: "product_carousel", type: "product_carousel", name: "Bestsellers Row" },
      { id: "product_grid", type: "product_grid", name: "Product Grid" },
      { id: "footer", type: "footer", name: "Footer" },
    ];
  }, [_siteDefinition]);

  const storefrontPages = [
    {
      id: "home",
      name: "Home",
      route: "/",
      blocks: homeBlocks,
    },
    {
      id: "product_detail",
      name: "Product Detail",
      route: "/products/:slug",
      blocks: [
        { id: "product_detail", type: "product_detail", name: "Product Detail" },
        { id: "related_products", type: "related_products", name: "Related Products" },
      ],
    },
    {
      id: "cart",
      name: "Cart",
      route: "/cart",
      blocks: [
        { id: "cart_view", type: "cart_view", name: "Cart View" },
      ],
    },
    {
      id: "checkout",
      name: "Checkout",
      route: "/checkout",
      blocks: [
        { id: "delivery_form", type: "delivery_form", name: "Delivery Form" },
        { id: "payment_methods", type: "payment_methods", name: "Payment Methods" },
        { id: "place_order_cta", type: "place_order_cta", name: "Place Order" },
      ],
    },
    {
      id: "profile",
      name: "Customer Profile",
      route: "/profile",
      blocks: [
        { id: "profile_details", type: "profile_details", name: "Profile Details" },
        { id: "saved_addresses", type: "saved_addresses", name: "Saved Addresses" },
      ],
    },
    {
      id: "orders",
      name: "Order History",
      route: "/orders",
      blocks: [
        { id: "order_history_list", type: "order_history_list", name: "Order History" },
        { id: "order_tracking", type: "order_tracking", name: "Order Tracking" },
      ],
    },
    {
      id: "login",
      name: "Customer Sign In",
      route: "/login",
      blocks: [
        { id: "signin_form", type: "signin_form", name: "Sign In Form" },
      ],
    },
    {
      id: "signup",
      name: "Customer Sign Up",
      route: "/signup",
      blocks: [
        { id: "signup_form", type: "signup_form", name: "Sign Up Form" },
      ],
    },
  ];

  const isRouteActive = (route: string) => {
    if (route === "/") {
      return (
        !currentPath.includes("/products/") &&
        !currentPath.includes("/cart") &&
        !currentPath.includes("/checkout") &&
        !currentPath.includes("/profile") &&
        !currentPath.includes("/orders") &&
        !currentPath.includes("/login") &&
        !currentPath.includes("/signup")
      );
    }
    if (route.includes("products")) return currentPath.includes("/products/");
    return currentPath.endsWith(route) || currentPath.includes(route);
  };

  const [manualToggled, setManualToggled] = useState<Record<string, boolean>>({});

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "4px",
        padding: "10px 8px",
        boxSizing: "border-box",
        width: "100%",
        color: "#0f172a",
        fontSize: "11px",
        lineHeight: "1.6",
      }}
    >
      {/* Root Node */}
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "6px", fontSize: "11.5px" }}>
        Storefront Pages & Components
      </div>

      {/* Pages Section */}
      <div style={{ display: "grid" }}>
        {storefrontPages.map((p, pIdx) => {
          const isLastPage = pIdx === storefrontPages.length - 1;
          const isCurrent = isRouteActive(p.route);
          const isOpen = manualToggled[p.id] !== undefined ? manualToggled[p.id] : isCurrent;

          return (
            <div key={p.id} style={{ display: "grid", marginBottom: "2px" }}>
                {/* Page Line */}
                <div
                  onClick={() => {
                    if (onSelectPage) onSelectPage(p.route);
                    if (onSelectBlock) onSelectBlock(null);
                    setManualToggled((prev) => ({
                      ...prev,
                      [p.id]: !isOpen,
                    }));
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 4px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? "#2563eb" : "#334155",
                    background: isCurrent ? "rgba(37,99,235,0.06)" : "transparent",
                    transition: "all 0.1s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8", marginRight: "6px", fontFamily: "monospace" }}>{isLastPage ? "└──" : "├──"}</span>
                    <span style={{ color: isOpen ? "#2563eb" : "#94a3b8", fontSize: "9px", marginRight: "4px", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }}>▶</span>
                    <span>{p.name}</span>
                    <span style={{ color: "#94a3b8", fontSize: "10px", marginLeft: "4px" }}>({p.route})</span>
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: "8.5px", color: "#2563eb", fontWeight: 700 }}>Active</span>
                  )}
                </div>

                {/* Page Block Components - Accordion: only shown when page is opened */}
                {isOpen && (
                  <div style={{ marginLeft: "16px", borderLeft: isLastPage ? "none" : "1px solid #e2e8f0", paddingLeft: isLastPage ? "1px" : "0", display: "grid", marginTop: "1px" }}>
                    {p.blocks.map((b, bIdx) => {
                      const isLastBlock = bIdx === p.blocks.length - 1;
                      return (
                        <div
                          key={b.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectPage && !isCurrent) onSelectPage(p.route);
                            if (onSelectBlock) onSelectBlock(b.id || b.type);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            cursor: "pointer",
                            color: "#475569",
                            fontSize: "10.5px",
                            transition: "all 0.1s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f1f5f9";
                            e.currentTarget.style.color = "#2563eb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#475569";
                          }}
                        >
                          <span>
                            <span style={{ color: "#cbd5e1", marginRight: "6px" }}>{isLastBlock ? "└──" : "├──"}</span>
                            {b.name}
                          </span>
                          <span style={{ fontSize: "9px", color: "#94a3b8" }}>Edit</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

export type EditorTab = "theme" | "block";

type EditorSidebarProps = {
  siteDefinition: EditorSiteDefinition;
  selectedBlockId: string | null;
  selectedTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  onSiteDefinitionChange: (next: EditorSiteDefinition) => void;
  onSelectBlock?: (blockId: string | null) => void;
  activePageId?: string;
  onSelectPage?: (pageId: string) => void;
};

const ADMIN_BLUE = "#2563eb";
const ADMIN_BLUE_HOVER = "#1d4ed8";
const ADMIN_TEXT = "#0f172a";
const ADMIN_MUTED = "#64748b";
const ADMIN_BORDER = "#cbd5e1";

type JsonFieldControlProps = {
  field: EditorField;
  currentValue: any;
  textColor: string;
  isLightMode: boolean;
  accentColor?: string;
  onChange: (value: any) => void;
};

function sharedInputStyle(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    height: "26px",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "11px",
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    outline: "none",
    transition: "border-color 0.12s ease, box-shadow 0.12s ease",
  };
}

interface CustomSelectDropdownProps {
  value: string;
  defaultValue?: string;
  options: { label: string; value: string }[];
  placeholder?: string;
  onChange: (value: string) => void;
}

const CustomSelectDropdown: React.FC<CustomSelectDropdownProps> = ({
  value,
  defaultValue,
  options,
  placeholder = "Select an option",
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selectedOption =
    options.find((o) => o.value === value) ||
    options.find((o) => o.value === defaultValue) ||
    (options.length > 0 ? options[0] : undefined);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          height: "26px",
          padding: "2px 6px",
          paddingRight: "20px",
          borderRadius: "4px",
          border: open ? "1px solid #2563eb" : "1px solid #cbd5e1",
          background: "#ffffff",
          color: selectedOption ? "#0f172a" : "#94a3b8",
          fontSize: "11px",
          fontWeight: 500,
          fontFamily: "'Inter', -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          textAlign: "left",
          outline: "none",
          boxShadow: open ? "0 0 0 2px rgba(37,99,235,0.15)" : "none",
          transition: "all 0.12s ease",
          boxSizing: "border-box",
        }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: "absolute",
            right: "6px",
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
            width: "11px",
            height: "11px",
            color: open ? "#2563eb" : "#64748b",
            transition: "transform 0.15s ease, color 0.12s ease",
            pointerEvents: "none",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "#ffffff",
            borderRadius: "5px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.04)",
            maxHeight: "150px",
            overflowY: "auto",
            padding: "2px",
            boxSizing: "border-box",
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: "4px 6px", fontSize: "10.5px", color: "#94a3b8" }}>No options</div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: "3px 6px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? "#2563eb" : "#0f172a",
                    background: isSelected ? "rgba(37,99,235,0.08)" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "4px",
                    transition: "background 0.1s ease",
                    marginBottom: "1px",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "10px", height: "10px", color: "#2563eb", flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function colorInputStyle(_isLightMode: boolean): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    height: "26px",
    padding: "2px",
    borderRadius: "4px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    cursor: "pointer",
  };
}

function sectionCardStyle(_isLightMode: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "4px",
    padding: "5px 7px",
    borderRadius: "5px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "visible",
  };
}

function blockFieldCardStyle(_isLightMode: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "2px",
    padding: "0",
    background: "transparent",
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "visible",
  };
}

function getJsonEditorValue(value: any) {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function getFieldGroupTitle(field: EditorField) {
  const key = field.key.toLowerCase();
  const label = (field.label || "").toLowerCase();

  if (["brandname", "logo", "tagline", "storename", "brand"].some((k) => key.includes(k) || label.includes(k))) {
    return "BRAND & IDENTITY";
  }

  if (key.includes("search") || label.includes("search")) {
    return "SEARCH BAR";
  }

  if (
    [
      "variant",
      "position",
      "height",
      "max_width",
      "width",
      "radius",
      "padding",
      "columns",
      "gap",
      "grid",
      "layout",
      "align",
    ].some((k) => key.includes(k) || label.includes(k))
  ) {
    return "LAYOUT & SPACING";
  }

  if (
    [
      "showaccount",
      "showcart",
      "button",
      "cta",
      "link",
      "action",
      "enable",
    ].some((k) => key.includes(k) || label.includes(k)) ||
    field.type === "checkbox"
  ) {
    return "ACTIONS & TOGGLES";
  }

  if (
    ["bg", "color", "text_color", "muted", "border", "accent", "theme", "shadow"].some(
      (k) => key.includes(k) || label.includes(k)
    ) ||
    field.type === "color"
  ) {
    return "COLOR PALETTE";
  }

  return "SETTINGS & CONTENT";
}

function groupFields(fields: EditorField[]) {
  const groups = new Map<string, EditorField[]>();

  fields.forEach((field) => {
    const groupTitle = getFieldGroupTitle(field);
    const existing = groups.get(groupTitle) || [];
    existing.push(field);
    groups.set(groupTitle, existing);
  });

  return Array.from(groups.entries()).map(([title, items]) => ({
    title,
    items,
  }));
}

function JsonFieldControl({
  field,
  currentValue,
  textColor: _textColor,
  isLightMode: _isLightMode,
  accentColor = "#2563eb",
  onChange,
}: JsonFieldControlProps) {
  const [rawValue, setRawValue] = useState(getJsonEditorValue(currentValue));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRawValue(getJsonEditorValue(currentValue));
    setError(null);
  }, [currentValue, field.key]);

  const handleBlur = () => {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      setError(null);
      onChange("");
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      setError(null);
      onChange(parsed);
    } catch {
      setError("Invalid JSON format. Please verify the syntax.");
    }
  };

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div
        style={{
          borderRadius: "8px",
          border: error ? "1px solid #ef4444" : "1px solid #e2e8f0",
          background: "#0f172a",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            padding: "5px 10px",
            background: "#1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            JSON CODE
          </span>
          <button
            type="button"
            onClick={() => {
              try {
                const formatted = JSON.stringify(JSON.parse(rawValue), null, 2);
                setRawValue(formatted);
                setError(null);
              } catch (_) {}
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#38bdf8",
              fontSize: "10px",
              fontWeight: 600,
              cursor: "pointer",
              padding: "1px 4px",
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Format
          </button>
        </div>
        <textarea
          value={rawValue}
          placeholder={field.placeholder || "{\n  ...\n}"}
          onChange={(e) => {
            setRawValue(e.target.value);
            if (error) setError(null);
          }}
          onBlur={handleBlur}
          rows={7}
          style={{
            width: "100%",
            minHeight: "120px",
            padding: "8px 10px",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#f8fafc",
            fontFamily: "'Fira Code', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
            fontSize: "11px",
            lineHeight: 1.5,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      {field.helpText ? (
        <div style={{ fontSize: "11px", lineHeight: 1.4, color: "#64748b" }}>
          {field.helpText}
        </div>
      ) : null}

      {error ? (
        <div style={{ fontSize: "11px", lineHeight: 1.4, color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : null}
    </div>
  );
}

type LogoUploadControlProps = {
  currentValue: string;
  isLightMode: boolean;
  onChange: (url: string) => void;
};

function LogoUploadControl({ currentValue, isLightMode, onChange }: LogoUploadControlProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const border = isLightMode ? "1.5px dashed rgba(17,24,39,0.2)" : "1.5px dashed rgba(255,255,255,0.2)";
  const activeBorder = "1.5px dashed #2563eb";
  const textMuted = isLightMode ? "rgba(17,24,39,0.5)" : "rgba(255,255,255,0.5)";
  const cardBg = isLightMode ? "#f8fafc" : "rgba(255,255,255,0.03)";

  const previewUrl = currentValue ? optimizeImageUrl(currentValue) : "";

  const uploadFile = useCallback(async (file: File) => {
    const allowed = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);
    if (!allowed.has(file.type)) {
      setError("Only PNG, JPEG, WEBP or SVG files are allowed.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const fileToUpload = await compressImageFile(file, 1920, 1080, 0.85);
      const formData = new FormData();
      formData.append("file", fileToUpload);
      const res = await fetch(`${API_BASE_URL}/assets/upload-logo`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload failed");
      }
      const data = await res.json();
      onChange(data.url);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {previewUrl ? (
        /* SINGLE UNIFIED PREVIEW CARD WITH REPLACE & REMOVE */
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            width: "100%",
            borderRadius: "8px",
            border: isDragging ? activeBorder : (isLightMode ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.12)"),
            background: isLightMode ? "#ffffff" : "rgba(15,23,42,0.6)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            overflow: "hidden",
            transition: "all 0.15s ease",
          }}
        >
          {/* Logo Viewport */}
          <div
            style={{
              width: "100%",
              height: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 12px",
              boxSizing: "border-box",
              background: isLightMode
                ? "repeating-conic-gradient(#f8fafc 0% 25%, #ffffff 0% 50%) 50% / 12px 12px"
                : "repeating-conic-gradient(#0f172a 0% 25%, #1e293b 0% 50%) 50% / 12px 12px",
            }}
          >
            <img
              src={previewUrl}
              alt="Logo"
              style={{
                maxHeight: "48px",
                maxWidth: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>

          {/* Action Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 8px",
              background: isLightMode ? "#f8fafc" : "rgba(255,255,255,0.02)",
              borderTop: isLightMode ? "1px solid #f1f5f9" : "1px solid rgba(255,255,255,0.06)",
              gap: "6px",
            }}
          >
            <button
              type="button"
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 600,
                color: "#2563eb",
                background: "transparent",
                border: "1px solid rgba(37,99,235,0.2)",
                borderRadius: "4px",
                cursor: "pointer",
                lineHeight: 1.2,
              }}
            >
              {uploading ? "Uploading..." : "Replace Logo"}
            </button>

            <button
              type="button"
              onClick={() => onChange("")}
              style={{
                padding: "3px 8px",
                fontSize: "10px",
                fontWeight: 600,
                color: "#ef4444",
                background: "transparent",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "4px",
                cursor: "pointer",
                lineHeight: 1.2,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* SINGLE UNIFIED EMPTY DROPZONE */
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            padding: "16px 12px",
            borderRadius: "8px",
            border: isDragging ? activeBorder : border,
            background: isDragging ? (isLightMode ? "rgba(37,99,235,0.04)" : "rgba(37,99,235,0.1)") : cardBg,
            cursor: uploading ? "wait" : "pointer",
            transition: "all 0.15s ease",
            textAlign: "center",
            userSelect: "none",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px", color: isDragging ? "#2563eb" : textMuted }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span style={{ fontSize: "11px", color: isDragging ? "#2563eb" : (isLightMode ? "#334155" : "#f1f5f9"), fontWeight: 600 }}>
            {uploading ? "Uploading..." : "Click or drag logo to upload"}
          </span>
          <span style={{ fontSize: "9.5px", color: textMuted }}>PNG, SVG, JPG, WEBP (Max 2MB)</span>
        </div>
      )}

      {error && (
        <div style={{ fontSize: "10px", color: "#ef4444", marginTop: "3px" }}>{error}</div>
      )}
    </div>
  );
}

export function exportCanvasTemplate({
  width = 1920,
  height = 450,
  borderRadius = 0,
  backgroundColor = "#0f172a",
  title = "Hero Banner Template",
  filename = "banner-canvas-template.png",
}: {
  width?: number;
  height?: number;
  borderRadius?: number;
  backgroundColor?: string;
  title?: string;
  filename?: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const bg = backgroundColor || "#0f172a";
  if (bg.includes("gradient")) {
    const colorMatches = bg.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
    if (colorMatches && colorMatches.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      colorMatches.forEach((col, idx) => {
        grad.addColorStop(idx / (colorMatches.length - 1), col);
      });
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = "#0f172a";
    }
  } else {
    try {
      ctx.fillStyle = bg;
    } catch {
      ctx.fillStyle = "#0f172a";
    }
  }

  if (borderRadius > 0) {
    const r = Math.min(borderRadius, height / 2, width / 2);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(width - r, 0);
    ctx.quadraticCurveTo(width, 0, width, r);
    ctx.lineTo(width, height - r);
    ctx.quadraticCurveTo(width, height, width - r, height);
    ctx.lineTo(r, height);
    ctx.quadraticCurveTo(0, height, 0, height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, width, height);
  }

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


function CompactColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const hexVal = typeof value === "string" && value ? value : "#2563eb";
  const isValidHex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(hexVal);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3.5px 7px",
        minHeight: "29px",
        background: "#f8fafc",
        borderRadius: "4px",
        border: "1px solid #e2e8f0",
        boxSizing: "border-box",
        width: "100%",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0, flex: 1 }}>
        <label
          style={{
            position: "relative",
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            background: hexVal,
            border: "1px solid rgba(0,0,0,0.18)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
            cursor: "pointer",
            flexShrink: 0,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
          title={`Choose ${label}`}
        >
          <input
            type="color"
            value={isValidHex && hexVal.startsWith("#") ? hexVal : "#2563eb"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              top: "-50%",
              left: "-50%",
              width: "200%",
              height: "200%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </label>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </div>

      <input
        type="text"
        value={hexVal.toUpperCase()}
        placeholder="#000000"
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw.startsWith("#") || raw === "" ? raw : `#${raw}`);
        }}
        style={{
          width: "68px",
          height: "22px",
          textAlign: "center",
          fontFamily: "'Inter', monospace",
          fontSize: "10.5px",
          fontWeight: 700,
          color: "#0f172a",
          borderRadius: "4px",
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          outline: "none",
          padding: "0 2px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function ModernColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  label?: string;
}) {
  const hexVal = typeof value === "string" && value ? value : "#2563eb";
  const isValidHex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(hexVal);

  return (
    <div style={{ display: "grid", gap: "3px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxSizing: "border-box" }}>
          <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {label}
          </label>
          <span style={{ fontSize: "9px", fontFamily: "'Inter', monospace", fontWeight: 800, color: "#475569", background: "rgba(100,116,139,0.08)", padding: "1px 5px", borderRadius: "3px" }}>
            {hexVal.toUpperCase()}
          </span>
        </div>
      )}

      {/* Modern Sleek Color Input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          height: "28px",
          padding: "2px 6px",
          borderRadius: "5px",
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          boxSizing: "border-box",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Interactive Swatch & Native Spectrum Trigger */}
        <label
          style={{
            position: "relative",
            width: "20px",
            height: "20px",
            borderRadius: "4px",
            background: hexVal,
            border: "1px solid rgba(0,0,0,0.18)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
            cursor: "pointer",
            flexShrink: 0,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
          title="Click to choose color"
        >
          <input
            type="color"
            value={isValidHex && hexVal.startsWith("#") ? hexVal : "#2563eb"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              top: "-50%",
              left: "-50%",
              width: "200%",
              height: "200%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </label>

        {/* Clean Uppercase HEX Input */}
        <input
          type="text"
          value={hexVal.toUpperCase()}
          placeholder="#000000"
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange(raw.startsWith("#") || raw === "" ? raw : `#${raw}`);
          }}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            fontFamily: "'Inter', monospace",
            fontSize: "11px",
            fontWeight: 700,
            color: "#0f172a",
            padding: 0,
            minWidth: 0,
            letterSpacing: "0.02em",
          }}
        />

        <span
          style={{
            fontSize: "8.5px",
            fontWeight: 800,
            color: "#94a3b8",
            letterSpacing: "0.05em",
            userSelect: "none",
          }}
        >
          HEX
        </span>
      </div>
    </div>
  );
}

function renderFieldControl(
  field: EditorField,
  currentValue: any,
  textColor: string,
  isLightMode: boolean,
  onChange: (value: any) => void
) {
  const inputStyle = sharedInputStyle();

  if (field.type === "text") {
    return (
      <input
        type="text"
        value={typeof currentValue === "string" ? currentValue : ""}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={typeof currentValue === "string" ? currentValue : ""}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{
          ...inputStyle,
          height: "auto",
          minHeight: "46px",
          resize: "vertical",
          lineHeight: 1.4,
          padding: "3px 6px",
        }}
      />
    );
  }

  if (field.type === "select") {
    const rawVal =
      currentValue !== undefined && currentValue !== null && currentValue !== ""
        ? String(currentValue)
        : field.defaultValue !== undefined
        ? String(field.defaultValue)
        : "";

    return (
      <div style={{ position: "relative", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <select
          value={rawVal}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputStyle,
            paddingRight: "22px",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            cursor: "pointer",
            background: "#ffffff",
            color: "#0f172a",
            fontWeight: 500,
            fontSize: "11px",
          }}
        >
          {!rawVal && !field.defaultValue && (
            <option value="" disabled>
              Select {field.label}...
            </option>
          )}
          {(field.options || []).map((opt) => (
            <option
              key={String(opt.value)}
              value={String(opt.value)}
              style={{ color: "#0f172a", background: "#ffffff", fontSize: "11px" }}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: "absolute",
            right: "7px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "11px",
            height: "11px",
            color: "#64748b",
            pointerEvents: "none",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        value={currentValue === undefined || currentValue === null ? "" : currentValue}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        style={inputStyle}
      />
    );
  }

  if (field.type === "checkbox") {
    const isChecked = Boolean(currentValue);
    return (
      <div
        onClick={() => onChange(!isChecked)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          padding: "3px 6px",
          borderRadius: "4px",
          border: "1px solid #e2e8f0",
          background: isChecked ? "rgba(37,99,235,0.04)" : "#ffffff",
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.12s ease",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <span style={{ fontSize: "10.5px", fontWeight: 500, color: isChecked ? "#0f172a" : "#475569" }}>
          {field.label}
        </span>
        <div
          style={{
            position: "relative",
            width: "24px",
            height: "14px",
            borderRadius: "999px",
            background: isChecked ? ADMIN_BLUE : "#cbd5e1",
            transition: "background 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: isChecked ? "12px" : "2px",
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: "#ffffff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
              transition: "left 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      </div>
    );
  }

  if (field.type === "color") {
    return (
      <CompactColorRow
        label={field.label || "Color"}
        value={typeof currentValue === "string" ? currentValue : ""}
        onChange={onChange}
      />
    );
  }

  if (field.type === "json") {
    return (
      <JsonFieldControl
        field={field}
        currentValue={currentValue}
        textColor={textColor}
        isLightMode={isLightMode}
        onChange={onChange}
      />
    );
  }

  if (field.type === "image_upload") {
    return (
      <LogoUploadControl
        currentValue={typeof currentValue === "string" ? currentValue : ""}
        isLightMode={isLightMode}
        onChange={onChange}
      />
    );
  }

  return null;
}

const SegmentedRow = ({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      background: "#f1f5f9",
      padding: "2px",
      borderRadius: "5px",
      gap: "2px",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      minWidth: 0,
    }}
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: "4px 4px",
            fontSize: "10.5px",
            lineHeight: 1.2,
            fontWeight: active ? 700 : 500,
            borderRadius: "4px",
            border: "none",
            background: active ? "#ffffff" : "transparent",
            color: active ? "#0f172a" : "#64748b",
            boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            cursor: "pointer",
            textAlign: "center",
            whiteSpace: "nowrap",
            transition: "all 0.12s ease",
            minWidth: 0,
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const NumberStepperField = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const stepRef = useRef(step);
  stepRef.current = step;
  const minRef = useRef(min);
  minRef.current = min;
  const maxRef = useRef(max);
  maxRef.current = max;

  const isFocusedRef = useRef(false);

  const clamp = (val: number) => Math.max(minRef.current, Math.min(maxRef.current, val));

  const attachWheel = useCallback((node: HTMLInputElement | null) => {
    if (!node) return;

    const handleWheel = (e: WheelEvent) => {
      // ONLY change number if the input is currently clicked / focused!
      if (!isFocusedRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? stepRef.current : -stepRef.current;
      const nextVal = Math.max(
        minRef.current,
        Math.min(maxRef.current, Number((valueRef.current + delta).toFixed(2)))
      );
      onChangeRef.current(nextVal);
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onChange(clamp(Number((value + step).toFixed(2))));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onChange(clamp(Number((value - step).toFixed(2))));
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "3px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxSizing: "border-box" }}>
        <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </label>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 800,
            color: ADMIN_BLUE,
            background: "rgba(37,99,235,0.08)",
            padding: "1px 5px",
            borderRadius: "3px",
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
            minWidth: "32px",
            display: "inline-block",
          }}
        >
          {value}{unit}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "3px", width: "100%", boxSizing: "border-box" }}>
        <button
          type="button"
          onClick={() => onChange(clamp(Number((value - step).toFixed(2))))}
          title={`Decrease (${step}${unit})`}
          style={{
            width: "28px",
            height: "26px",
            borderRadius: "4px",
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            color: "#0f172a",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          −
        </button>

        <input
          ref={attachWheel}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!isNaN(parsed)) {
              onChange(clamp(parsed));
            }
          }}
          style={{
            ...sharedInputStyle(),
            flex: 1,
            textAlign: "center",
            fontWeight: 700,
            fontSize: "11px",
            padding: "2px 4px",
            height: "26px",
            minWidth: 0,
          }}
        />

        <button
          type="button"
          onClick={() => onChange(clamp(Number((value + step).toFixed(2))))}
          title={`Increase (${step}${unit})`}
          style={{
            width: "28px",
            height: "26px",
            borderRadius: "4px",
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            color: "#0f172a",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          +
        </button>
      </div>

      {/* Smooth micro-slider for continuous sliding */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        style={{
          width: "100%",
          maxWidth: "100%",
          accentColor: ADMIN_BLUE,
          cursor: "pointer",
          height: "3px",
          margin: "1px 0 0 0",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
};

const SectionDivider = ({ title }: { title: string }) => (
  <div style={{ paddingTop: "6px", marginTop: "2px", borderTop: "1px solid #f1f5f9", display: "grid", gap: "4px", width: "100%", boxSizing: "border-box" }}>
    <span style={{ fontSize: "8.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {title}
    </span>
  </div>
);

function HeroSlidesEditor({
  selectedBlock,
  isLightMode,
  textColor,
  accentColor,
  onSiteDefinitionChange,
  siteDefinition,
}: {
  selectedBlock: any;
  isLightMode: boolean;
  textColor: string;
  accentColor: string;
  onSiteDefinitionChange: (next: EditorSiteDefinition) => void;
  siteDefinition: EditorSiteDefinition;
}) {
  const currentProps = selectedBlock.props ?? {};

  const autoPlayInterval = typeof currentProps.auto_play_interval === "number" ? currentProps.auto_play_interval : 3;
  const autoPlay = currentProps.auto_play ?? true;

  // Numeric Height, Width & Radius
  const bannerHeightNum =
    typeof currentProps.banner_height === "number"
      ? currentProps.banner_height
      : !isNaN(Number(currentProps.banner_height)) && Number(currentProps.banner_height) > 0
      ? Number(currentProps.banner_height)
      : 380;

  const bannerWidthVal = currentProps.banner_width ?? "100%";

  const borderRadiusNum =
    typeof currentProps.border_radius === "number"
      ? currentProps.border_radius
      : !isNaN(Number(currentProps.border_radius))
      ? Number(currentProps.border_radius)
      : 16;

  let slides: any[] = Array.isArray(currentProps.slides) ? currentProps.slides : [];
  if (slides.length === 0) {
    slides = [
      {
        id: "slide-1",
        variant: currentProps.variant || "standard",
        headline: currentProps.headline || "Welcome to Our Store",
        subheadline: currentProps.subheadline || "Discover premium products crafted for your lifestyle.",
        badge: currentProps.badge || "NEW COLLECTION",
        primary_cta: currentProps.primary_cta || { label: "Shop Now", href: "/products" },
        secondary_cta: currentProps.secondary_cta || { label: "Explore", href: "/categories" },
        background_image: currentProps.background_image || "",
        background_color: currentProps.background_color || "",
      },
    ];
  }

  const [expandedSlideIndex, setExpandedSlideIndex] = useState<number | null>(null);
  const [slideSubTabs, setSlideSubTabs] = useState<Record<number, "content" | "design" | "media">>({});
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const updateBlockProps = (newSlides: any[], extraProps: Record<string, any> = {}) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    const activeSlide = newSlides[0] || {};
    const slideBg = activeSlide.background_color || activeSlide.hero_bg;
    const slideText = activeSlide.hero_text_color || activeSlide.text_color;
    const slideAccent = activeSlide.accent_color;

    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => ({
        ...page,
        blocks: (page.blocks ?? []).map((block: any) => {
          if (block.id === selectedBlock.id) {
            return {
              ...block,
              props: {
                ...(block.props ?? {}),
                slides: newSlides,
                headline: activeSlide.headline ?? block.props?.headline,
                subheadline: activeSlide.subheadline ?? block.props?.subheadline,
                primary_cta: activeSlide.primary_cta ?? block.props?.primary_cta,
                secondary_cta: activeSlide.secondary_cta ?? block.props?.secondary_cta,
                background_image: activeSlide.background_image ?? block.props?.background_image,
                background_color: activeSlide.background_color ?? block.props?.background_color,
                banner_height: bannerHeightNum,
                banner_width: bannerWidthVal,
                border_radius: borderRadiusNum,
                ...extraProps,
              },
            };
          }
          return block;
        }),
      }));
    }

    if (slideBg || slideText || slideAccent) {
      nextDef.theme = {
        ...(nextDef.theme || {}),
        ...(slideBg ? { hero_bg: slideBg } : {}),
        ...(slideText ? { hero_text_color: slideText } : {}),
        ...(slideAccent ? { hero_accent: slideAccent } : {}),
      };
    }

    onSiteDefinitionChange(nextDef);
  };

  const handleSlideChange = (index: number, fieldPath: string, value: any) => {
    const updated = slides.map((slide, idx) => {
      if (idx === index) {
        if (fieldPath.includes(".")) {
          const parts = fieldPath.split(".");
          if (parts.length === 2) {
            const [parent, child] = parts;
            return {
              ...slide,
              [parent]: {
                ...(slide[parent] ?? {}),
                [child]: value,
              },
            };
          }
        }
        return { ...slide, [fieldPath]: value };
      }
      return slide;
    });
    updateBlockProps(updated);
  };

  const handleDeleteSlide = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (slides.length <= 1) {
      alert("Hero banner must have at least 1 banner slide.");
      return;
    }
    const updated = slides.filter((_, idx) => idx !== index);
    updateBlockProps(updated);
    if (expandedSlideIndex === index) {
      setExpandedSlideIndex(0);
    } else if (expandedSlideIndex !== null && expandedSlideIndex > index) {
      setExpandedSlideIndex(expandedSlideIndex - 1);
    }
  };

  // Drag and Drop Reordering
  const handleDragStart = (index: number) => {
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const reordered = [...slides];
    const item = reordered.splice(draggedIdx, 1)[0];
    reordered.splice(index, 0, item);
    setDraggedIdx(index);
    updateBlockProps(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 1. Global Sizing & Carousel Controls */}
      <section style={sectionCardStyle(isLightMode)}>
        <div style={{ fontSize: "9.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
          LAYOUT & DIMENSIONS
        </div>

        {/* Height & Radius Steppers (2-Column Grid) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <NumberStepperField
            label="Banner Height"
            value={bannerHeightNum}
            min={180}
            max={850}
            step={10}
            unit="px"
            onChange={(val) => updateBlockProps(slides, { banner_height: val })}
          />

          <NumberStepperField
            label="Border Radius"
            value={borderRadiusNum}
            min={0}
            max={48}
            step={2}
            unit="px"
            onChange={(val) => updateBlockProps(slides, { border_radius: val })}
          />
        </div>

        {/* Width Constraint */}
        <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Width Constraint
          </label>
          <SegmentedRow
            value={bannerWidthVal === "100%" || bannerWidthVal === "full" ? "100%" : bannerWidthVal}
            onChange={(val) => updateBlockProps(slides, { banner_width: val })}
            options={[
              { label: "1100px", value: "1100px" },
              { label: "1280px", value: "1280px" },
              { label: "1440px", value: "1440px" },
              { label: "100% Full", value: "100%" },
            ]}
          />
        </div>

        <SectionDivider title="Carousel Rotation" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box", alignItems: "start" }}>
          {/* Left: Auto-rotate Toggle with matched label & height */}
          <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "14px" }}>
              <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Auto-Rotate
              </label>
              <span
                style={{
                  fontSize: "8.5px",
                  fontWeight: 700,
                  padding: "0 4px",
                  borderRadius: "3px",
                  background: autoPlay ? "rgba(37,99,235,0.12)" : "#f1f5f9",
                  color: autoPlay ? ADMIN_BLUE : "#94a3b8",
                  letterSpacing: "0.02em",
                }}
              >
                {autoPlay ? "ON" : "OFF"}
              </span>
            </div>

            <div
              onClick={() => updateBlockProps(slides, { auto_play: !autoPlay })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6px",
                padding: "0 8px",
                height: "26px",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                background: autoPlay ? "rgba(37,99,235,0.06)" : "#f8fafc",
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.12s ease",
                boxSizing: "border-box",
                width: "100%",
              }}
            >
              <span style={{ fontSize: "10.5px", fontWeight: 600, color: autoPlay ? "#0f172a" : "#64748b" }}>
                {autoPlay ? "Enabled" : "Disabled"}
              </span>
              <div
                style={{
                  position: "relative",
                  width: "22px",
                  height: "13px",
                  borderRadius: "999px",
                  background: autoPlay ? ADMIN_BLUE : "#cbd5e1",
                  transition: "background 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: autoPlay ? "11px" : "2px",
                    width: "9px",
                    height: "9px",
                    borderRadius: "999px",
                    background: "#ffffff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    transition: "left 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>
            </div>

            {/* Placeholder spacer matching NumberStepperField micro-slider bar */}
            <div style={{ height: "3px", width: "100%" }} />
          </div>

          {/* Right: Rotation Speed (always 50% width, dimmed/blurred when auto-rotate is off) */}
          <div
            style={{
              opacity: autoPlay ? 1 : 0.38,
              filter: autoPlay ? "none" : "grayscale(1)",
              pointerEvents: autoPlay ? "auto" : "none",
              transition: "all 0.15s ease",
              userSelect: "none",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <NumberStepperField
              label="Rotation Speed"
              value={autoPlayInterval}
              min={1}
              max={20}
              step={1}
              unit="s"
              onChange={(val) => updateBlockProps(slides, { auto_play_interval: val })}
            />
          </div>
        </div>
      </section>

      {/* 2. Hero Slides Accordion List */}
      <section style={sectionCardStyle(isLightMode)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "9.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            ACTIVE BANNERS ({slides.length})
          </div>
          <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 500 }}>⋮⋮ Drag to reorder</span>
        </div>

        <div style={{ display: "grid", gap: "4px", marginTop: "1px" }}>
          {slides.map((slide, idx) => {
            const isExpanded = expandedSlideIndex === idx;
            const showPrimary = (slide.show_primary_cta !== false && slide.primary_cta?.show !== false);
            const showSecondary = (slide.show_secondary_cta !== false && slide.secondary_cta?.show !== false);
            const primaryStyle = slide.primary_cta?.style || "solid";
            const textAlign = slide.text_alignment || "left";
            const overlayOpacity = typeof slide.background_overlay_opacity === "number" ? Math.round(slide.background_overlay_opacity * 100) : 35;

            return (
              <div
                key={slide.id || idx}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                style={{
                  border: isExpanded ? `1px solid ${ADMIN_BLUE}` : "1px solid #e2e8f0",
                  borderRadius: "5px",
                  background: isExpanded ? "#ffffff" : "#f8fafc",
                  boxShadow: isExpanded ? "0 0 0 1px rgba(37,99,235,0.15)" : "none",
                  opacity: draggedIdx === idx ? 0.5 : 1,
                  transition: "all 120ms ease",
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => setExpandedSlideIndex(isExpanded ? null : idx)}
                  style={{
                    padding: "5px 7px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "4px",
                    cursor: "pointer",
                    background: isExpanded ? "rgba(37,99,235,0.04)" : "transparent",
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0, flex: 1, overflow: "hidden" }}>
                    <span style={{ cursor: "grab", fontSize: "10px", color: "#94a3b8", userSelect: "none", flexShrink: 0 }}>
                      ⋮⋮
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 4px", borderRadius: "3px", background: "#e2e8f0", color: "#334155", flexShrink: 0 }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: ADMIN_TEXT, minWidth: 0 }}>
                      {slide.headline || `Banner Slide ${idx + 1}`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteSlide(idx, e)}
                    title="Delete Banner"
                    style={{
                      padding: "2px 5px",
                      borderRadius: "3px",
                      border: "none",
                      background: "rgba(239,68,68,0.08)",
                      color: "#ef4444",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div style={{ padding: "6px 8px", borderTop: "1px solid #e2e8f0", display: "grid", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box", background: "#ffffff" }}>
                    {/* Compact Sub-tabs */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "2px",
                        background: "#f1f5f9",
                        padding: "2px",
                        borderRadius: "5px",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      {[
                        { id: "content", label: "Content" },
                        { id: "design", label: "Style" },
                        { id: "media", label: "Media & CTA" },
                      ].map((t) => {
                        const active = (slideSubTabs[idx] || "content") === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSlideSubTabs((prev) => ({ ...prev, [idx]: t.id as any }))}
                            style={{
                              padding: "4px 2px",
                              border: "none",
                              borderRadius: "4px",
                              background: active ? "#ffffff" : "transparent",
                              color: active ? ADMIN_BLUE : "#64748b",
                              fontWeight: active ? 800 : 600,
                              fontSize: "9.5px",
                              cursor: "pointer",
                              textAlign: "center",
                              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                              transition: "all 0.12s ease",
                            }}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* TAB 1: CONTENT */}
                    {(slideSubTabs[idx] || "content") === "content" && (
                      <div style={{ display: "grid", gap: "5px" }}>
                        <div style={{ display: "grid", gap: "2px" }}>
                          <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Headline</label>
                          <input
                            type="text"
                            value={slide.headline || ""}
                            onChange={(e) => handleSlideChange(idx, "headline", e.target.value)}
                            placeholder="Headline..."
                            style={sharedInputStyle()}
                          />
                        </div>

                        <div style={{ display: "grid", gap: "2px" }}>
                          <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Subheadline</label>
                          <textarea
                            rows={2}
                            value={slide.subheadline || ""}
                            onChange={(e) => handleSlideChange(idx, "subheadline", e.target.value)}
                            placeholder="Supporting text..."
                            style={{ ...sharedInputStyle(), height: "auto", minHeight: "36px", resize: "vertical", lineHeight: 1.3, padding: "4px 6px" }}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "5px" }}>
                          <div style={{ display: "grid", gap: "2px" }}>
                            <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Badge Tag</label>
                            <input
                              type="text"
                              value={slide.badge || ""}
                              onChange={(e) => handleSlideChange(idx, "badge", e.target.value)}
                              placeholder="NEW, 50% OFF..."
                              style={sharedInputStyle()}
                            />
                          </div>

                          <div style={{ display: "grid", gap: "2px" }}>
                            <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Align</label>
                            <SegmentedRow
                              value={textAlign === "right" ? "left" : textAlign}
                              onChange={(val) => handleSlideChange(idx, "text_alignment", val)}
                              options={[
                                { label: "Left", value: "left" },
                                { label: "Center", value: "center" },
                              ]}
                            />
                          </div>
                        </div>

                        {/* Flash Sale Countdown */}
                        {slide.variant === "flash_sale" && (
                          <div style={{ display: "grid", gap: "4px", padding: "5px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px" }}>
                            <div style={{ display: "grid", gap: "2px" }}>
                              <label style={{ fontSize: "8.5px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Mode</label>
                              <SegmentedRow
                                value={slide.sale_countdown_type || (slide.sale_start_time ? "starts_in" : "ends_in")}
                                onChange={(val) => handleSlideChange(idx, "sale_countdown_type", val)}
                                options={[
                                  { label: "Ends In", value: "ends_in" },
                                  { label: "Starts In", value: "starts_in" },
                                ]}
                              />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "4px" }}>
                              <div style={{ display: "grid", gap: "2px" }}>
                                <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                                  {(slide.sale_countdown_type === "starts_in" || (!slide.sale_countdown_type && slide.sale_start_time)) ? "Start Time" : "End Time"}
                                </label>
                                <input
                                  type="datetime-local"
                                  value={(slide.sale_countdown_type === "starts_in" || (!slide.sale_countdown_type && slide.sale_start_time)) ? (slide.sale_start_time || "") : (slide.sale_end_time || "")}
                                  onChange={(e) => {
                                    if (slide.sale_countdown_type === "starts_in" || (!slide.sale_countdown_type && slide.sale_start_time)) {
                                      handleSlideChange(idx, "sale_start_time", e.target.value);
                                    } else {
                                      handleSlideChange(idx, "sale_end_time", e.target.value);
                                    }
                                  }}
                                  style={sharedInputStyle()}
                                />
                              </div>
                              <div style={{ display: "grid", gap: "2px" }}>
                                <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Coupon</label>
                                <input
                                  type="text"
                                  value={slide.coupon_code || ""}
                                  onChange={(e) => handleSlideChange(idx, "coupon_code", e.target.value)}
                                  placeholder="CODE"
                                  style={sharedInputStyle()}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Product Launch Card */}
                        {slide.variant === "product_launch" && (
                          <div style={{ display: "grid", gap: "4px", padding: "5px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px" }}>
                            <input
                              type="text"
                              placeholder="Product Title"
                              value={slide.product_card?.title || ""}
                              onChange={(e) => handleSlideChange(idx, "product_card.title", e.target.value)}
                              style={sharedInputStyle()}
                            />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                              <input
                                type="text"
                                placeholder="Price ($199)"
                                value={slide.product_card?.price || ""}
                                onChange={(e) => handleSlideChange(idx, "product_card.price", e.target.value)}
                                style={sharedInputStyle()}
                              />
                              <input
                                type="text"
                                placeholder="Original ($299)"
                                value={slide.product_card?.original_price || ""}
                                onChange={(e) => handleSlideChange(idx, "product_card.original_price", e.target.value)}
                                style={sharedInputStyle()}
                              />
                            </div>
                          </div>
                        )}

                        {/* Trust Badges Editor (For Minimal Brand & Default/Standard banners) */}
                        {(slide.variant !== "flash_sale" && slide.variant !== "product_launch") && (
                          (Array.isArray(slide.trust_badges) ? slide.trust_badges.length > 0 : slide.variant === "minimal_brand") ? (
                            <div style={{ display: "grid", gap: "4px", padding: "5px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Trust Badges</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentBadges = Array.isArray(slide.trust_badges) ? slide.trust_badges : ["Free Shipping", "30-Day Money Back", "24/7 VIP Support"];
                                    handleSlideChange(idx, "trust_badges", [...currentBadges, "Secure Checkout"]);
                                  }}
                                  style={{
                                    fontSize: "8.5px",
                                    fontWeight: 700,
                                    color: ADMIN_BLUE,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  + Add Badge
                                </button>
                              </div>

                              <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                                {(Array.isArray(slide.trust_badges) ? slide.trust_badges : ["Free Shipping", "30-Day Money Back", "24/7 VIP Support"]).map((badge: string, bIdx: number) => (
                                  <div
                                    key={bIdx}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "3px",
                                      background: "#ffffff",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "4px",
                                      padding: "1px 5px",
                                      fontSize: "9.5px",
                                      color: "#334155",
                                    }}
                                  >
                                    <input
                                      type="text"
                                      value={badge}
                                      onChange={(e) => {
                                        const base = Array.isArray(slide.trust_badges) ? slide.trust_badges : ["Free Shipping", "30-Day Money Back", "24/7 VIP Support"];
                                        const next = [...base];
                                        next[bIdx] = e.target.value;
                                        handleSlideChange(idx, "trust_badges", next);
                                      }}
                                      style={{
                                        border: "none",
                                        outline: "none",
                                        background: "transparent",
                                        fontSize: "9.5px",
                                        fontWeight: 600,
                                        color: "#334155",
                                        width: `${Math.max(45, badge.length * 6.5)}px`,
                                        padding: 0,
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const base = Array.isArray(slide.trust_badges) ? slide.trust_badges : ["Free Shipping", "30-Day Money Back", "24/7 VIP Support"];
                                        const next = base.filter((_: any, i: number) => i !== bIdx);
                                        handleSlideChange(idx, "trust_badges", next);
                                      }}
                                      style={{
                                        border: "none",
                                        background: "none",
                                        color: "#ef4444",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        padding: "0 1px",
                                        lineHeight: 1,
                                        fontWeight: 800,
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => handleSlideChange(idx, "trust_badges", ["Free Shipping", "30-Day Money Back", "24/7 VIP Support"])}
                                style={{
                                  fontSize: "8.5px",
                                  fontWeight: 700,
                                  color: ADMIN_BLUE,
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "2px 0",
                                }}
                              >
                                + Add Trust Badges
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* TAB 2: STYLE (Typography & Colors) */}
                    {(slideSubTabs[idx] || "content") === "design" && (
                      <div style={{ display: "grid", gap: "5px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "5px" }}>
                          <div style={{ display: "grid", gap: "2px" }}>
                            <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              Font
                            </label>
                            <CustomSelectDropdown
                              value={slide.headline_font_family || "sans_modern"}
                              placeholder="Font"
                              options={[
                                { label: "Inter (Sans)", value: "sans_modern" },
                                { label: "Roboto (Sans)", value: "roboto_sans" },
                                { label: "Outfit (Tech)", value: "outfit_tech" },
                                { label: "Plus Jakarta", value: "plus_jakarta" },
                                { label: "Space Grotesk", value: "space_grotesk" },
                                { label: "Playfair (Serif)", value: "playfair_serif" },
                                { label: "Cinzel (Serif)", value: "cinzel_display" },
                                { label: "Cormorant", value: "cormorant_serif" },
                                { label: "Montserrat", value: "montserrat_bold" },
                                { label: "Poppins", value: "poppins_rounded" },
                                { label: "Abril Fatface", value: "abril_fatface" },
                                { label: "Dancing Script", value: "dancing_script" },
                              ]}
                              onChange={(val) => handleSlideChange(idx, "headline_font_family", val)}
                            />
                          </div>

                          <div style={{ display: "grid", gap: "2px" }}>
                            <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              Weight
                            </label>
                            <CustomSelectDropdown
                              value={String(slide.headline_font_weight || "800")}
                              placeholder="Weight"
                              options={[
                                { label: "300 Light", value: "300" },
                                { label: "400 Regular", value: "400" },
                                { label: "500 Medium", value: "500" },
                                { label: "600 Semi", value: "600" },
                                { label: "700 Bold", value: "700" },
                                { label: "800 Extra", value: "800" },
                                { label: "900 Black", value: "900" },
                              ]}
                              onChange={(val) => handleSlideChange(idx, "headline_font_weight", val)}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                          <div style={{ display: "grid", gap: "2px" }}>
                            <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              Style
                            </label>
                            <SegmentedRow
                              value={slide.headline_font_style || "normal"}
                              onChange={(val) => handleSlideChange(idx, "headline_font_style", val)}
                              options={[
                                { label: "Normal", value: "normal" },
                                { label: "Italic", value: "italic" },
                              ]}
                            />
                          </div>

                          <NumberStepperField
                            label="Headline Size"
                            value={Number(slide.headline_font_size || 28)}
                            min={16}
                            max={64}
                            step={2}
                            unit="px"
                            onChange={(val) => handleSlideChange(idx, "headline_font_size", val)}
                          />
                        </div>

                        <NumberStepperField
                          label="Subheadline Size"
                          value={Number(slide.subheadline_font_size || 14)}
                          min={10}
                          max={28}
                          step={1}
                          unit="px"
                          onChange={(val) => handleSlideChange(idx, "subheadline_font_size", val)}
                        />

                        <SectionDivider title="Colors" />

                        <CompactColorRow
                          label="Background Color"
                          value={slide.background_color || slide.hero_bg || siteDefinition.theme?.hero_bg || siteDefinition.theme?.primary_bg || (siteDefinition.theme?.mode === "dark" ? "#0f172a" : "#ffffff")}
                          onChange={(val) => handleSlideChange(idx, "background_color", val)}
                        />

                        <CompactColorRow
                          label="Text Color"
                          value={slide.hero_text_color || slide.text_color || siteDefinition.theme?.text_color || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                          onChange={(val) => handleSlideChange(idx, "hero_text_color", val)}
                        />

                        <CompactColorRow
                          label="Accent / CTA Color"
                          value={slide.hero_accent || slide.accent_color || siteDefinition.theme?.accent_color || "#2563eb"}
                          onChange={(val) => handleSlideChange(idx, "hero_accent", val)}
                        />

                        {/* Festive Motif Position & Opacity (when festival theme is enabled) */}
                        {(siteDefinition.theme?.festival_theme && siteDefinition.theme.festival_theme !== "none") && (
                          <div style={{ display: "grid", gap: "5px", marginTop: "2px", padding: "5px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px" }}>
                            <div style={{ display: "grid", gap: "2px" }}>
                              <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                                Festive Motif Position
                              </label>
                              <SegmentedRow
                                value={slide.festive_position || siteDefinition.theme?.hero_festive_position || "right"}
                                onChange={(val) => handleSlideChange(idx, "festive_position", val)}
                                options={[
                                  { label: "Left", value: "left" },
                                  { label: "Center", value: "center" },
                                  { label: "Right", value: "right" },
                                ]}
                              />
                            </div>

                            <NumberStepperField
                              label="Motif Opacity"
                              value={slide.festive_opacity !== undefined ? slide.festive_opacity : (siteDefinition.theme?.hero_festive_opacity !== undefined ? siteDefinition.theme.hero_festive_opacity : (siteDefinition.theme?.festive_opacity !== undefined ? siteDefinition.theme.festive_opacity : 100))}
                              min={0}
                              max={100}
                              step={5}
                              unit="%"
                              onChange={(val) => handleSlideChange(idx, "festive_opacity", val)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: MEDIA & CTA */}
                    {(slideSubTabs[idx] || "content") === "media" && (
                      <div style={{ display: "grid", gap: "5px" }}>
                        {/* Background Image Upload & Download Template */}
                        <div style={{ display: "grid", gap: "3px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "4px" }}>
                            <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Background Image</label>
                            <button
                              type="button"
                              onClick={() => {
                                const bannerH = Number(bannerHeightNum || 400);
                                const slideBg = slide.background_color || slide.hero_bg || (siteDefinition?.theme?.hero_bg || "#0f172a");
                                exportCanvasTemplate({
                                  width: 1280,
                                  height: bannerH,
                                  borderRadius: 0,
                                  backgroundColor: slideBg,
                                  title: `${slide.headline || "Slide"} Template`,
                                  filename: `banner-canvas-1280x${bannerH}.png`,
                                });
                              }}
                              style={{
                                fontSize: "8.5px",
                                fontWeight: 700,
                                color: ADMIN_BLUE,
                                background: "#eff6ff",
                                border: "1px solid rgba(37,99,235,0.25)",
                                borderRadius: "4px",
                                cursor: "pointer",
                                padding: "2px 7px",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                              title="Download exact canvas PNG matching your hero banner size to design in Canva"
                            >
                              📥 Download Canvas (1280×{bannerHeightNum || 400}px)
                            </button>
                          </div>
                          <LogoUploadControl
                            currentValue={slide.background_image || ""}
                            isLightMode={isLightMode}
                            onChange={(val) => handleSlideChange(idx, "background_image", val)}
                          />
                        </div>

                        {slide.background_image && (
                          <div style={{ display: "grid", gap: "5px" }}>
                            {/* Image Fit Row */}
                            <div style={{ display: "grid", gap: "2px" }}>
                              <label style={{ fontSize: "8.5px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Image Fit</label>
                              <SegmentedRow
                                value={slide.image_fit || "cover"}
                                onChange={(val) => handleSlideChange(idx, "image_fit", val)}
                                options={[
                                  { label: "Cover", value: "cover" },
                                  { label: "Contain", value: "contain" },
                                  { label: "Fill", value: "fill" },
                                ]}
                              />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                              <NumberStepperField
                                label="Zoom"
                                value={typeof slide.image_zoom === "number" ? slide.image_zoom : 100}
                                min={50}
                                max={250}
                                step={5}
                                unit="%"
                                onChange={(val) => handleSlideChange(idx, "image_zoom", val)}
                              />

                              <NumberStepperField
                                label="Dark Tint"
                                value={typeof slide.background_overlay_opacity === "number" ? Math.round(slide.background_overlay_opacity * 100) : 0}
                                min={0}
                                max={85}
                                step={5}
                                unit="%"
                                onChange={(val) => handleSlideChange(idx, "background_overlay_opacity", Number((val / 100).toFixed(2)))}
                              />
                            </div>
                          </div>
                        )}

                        <SectionDivider title="Action Buttons" />

                        {/* Primary Button */}
                        <div style={{ display: "grid", gap: "4px", padding: "5px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px" }}>
                          <div
                            onClick={() => handleSlideChange(idx, "show_primary_cta", !showPrimary)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                          >
                            <span style={{ fontSize: "8.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Primary Button</span>
                            <div
                              style={{
                                position: "relative",
                                width: "20px",
                                height: "12px",
                                borderRadius: "999px",
                                background: showPrimary ? ADMIN_BLUE : "#cbd5e1",
                                transition: "background 0.15s ease",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  top: "2px",
                                  left: showPrimary ? "10px" : "2px",
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "999px",
                                  background: "#ffffff",
                                  transition: "left 0.15s ease",
                                }}
                              />
                            </div>
                          </div>

                          {showPrimary && (
                            <div style={{ display: "grid", gap: "3px", marginTop: "2px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" }}>
                                <input
                                  type="text"
                                  placeholder="Label"
                                  value={slide.primary_cta?.label || ""}
                                  onChange={(e) => handleSlideChange(idx, "primary_cta.label", e.target.value)}
                                  style={sharedInputStyle()}
                                />
                                <input
                                  type="text"
                                  placeholder="URL (/products)"
                                  value={slide.primary_cta?.href || ""}
                                  onChange={(e) => handleSlideChange(idx, "primary_cta.href", e.target.value)}
                                  style={sharedInputStyle()}
                                />
                              </div>
                              <SegmentedRow
                                value={primaryStyle}
                                onChange={(val) => handleSlideChange(idx, "primary_cta.style", val)}
                                options={[
                                  { label: "Solid", value: "solid" },
                                  { label: "Outline", value: "outline" },
                                  { label: "Glass", value: "glass" },
                                ]}
                              />
                            </div>
                          )}
                        </div>

                        {/* Secondary Button */}
                        <div style={{ display: "grid", gap: "4px", padding: "5px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px" }}>
                          <div
                            onClick={() => handleSlideChange(idx, "show_secondary_cta", !showSecondary)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                          >
                            <span style={{ fontSize: "8.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Secondary Button</span>
                            <div
                              style={{
                                position: "relative",
                                width: "20px",
                                height: "12px",
                                borderRadius: "999px",
                                background: showSecondary ? ADMIN_BLUE : "#cbd5e1",
                                transition: "background 0.15s ease",
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  top: "2px",
                                  left: showSecondary ? "10px" : "2px",
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "999px",
                                  background: "#ffffff",
                                  transition: "left 0.15s ease",
                                }}
                              />
                            </div>
                          </div>

                          {showSecondary && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px", marginTop: "2px" }}>
                              <input
                                type="text"
                                placeholder="Label"
                                value={slide.secondary_cta?.label || ""}
                                onChange={(e) => handleSlideChange(idx, "secondary_cta.label", e.target.value)}
                                style={sharedInputStyle()}
                              />
                              <input
                                type="text"
                                placeholder="URL (/categories)"
                                value={slide.secondary_cta?.href || ""}
                                onChange={(e) => handleSlideChange(idx, "secondary_cta.href", e.target.value)}
                                style={sharedInputStyle()}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NavbarEditor({
  selectedBlock,
  isLightMode,
  textColor,
  accentColor,
  onSiteDefinitionChange,
  siteDefinition,
}: {
  selectedBlock: any;
  isLightMode: boolean;
  textColor: string;
  accentColor: string;
  onSiteDefinitionChange: (next: any) => void;
  siteDefinition: any;
}) {
  const [activeTab, setActiveTab] = useState<"brand" | "search" | "layout" | "icons" | "colors">("brand");

  const theme = siteDefinition.theme || {};
  const props = selectedBlock?.props || {};

  const getVal = (key: string, defaultVal: any) => {
    if (theme[key] !== undefined && theme[key] !== null) return theme[key];
    if (props[key] !== undefined && props[key] !== null) return props[key];
    return defaultVal;
  };

  const updateField = (key: string, value: any) => {
    onSiteDefinitionChange(updateThemeValues(siteDefinition, { [key]: value }));
  };

  const isDark = theme?.mode === "dark";
  const defaultBrandName = siteDefinition.brand_name || siteDefinition.site_name || siteDefinition.name || "My Store";

  // Values
  const brandDisplayMode = getVal("brand_display_mode", "both");
  const brandAlignment = getVal("brand_alignment", "left");
  const brandLayoutDirection = getVal("brand_layout_direction", "row");
  const brandName = getVal("brandName", defaultBrandName);
  const logoUrl = getVal("logoUrl", theme.logoUrl || theme.logo_url || "");
  const logoSize = Number(getVal("logo_size", theme.logo_size || 34));
  const logoZoom = Number(getVal("logo_zoom", theme.logo_zoom || 100));
  const logoFit = getVal("logo_fit", theme.logo_fit || "contain");
  const brandFontFamily = getVal("brand_font_family", theme.font_family || "sans_modern");
  const brandFontWeight = String(getVal("brand_font_weight", "700"));
  const brandFontStyle = getVal("brand_font_style", "normal");
  const brandFontSize = Number(getVal("brand_font_size", 18));
  const brandTextColor = getVal("brand_text_color", theme.accent_color || (isDark ? "#f8fafc" : "#15803d"));

  const searchDisplayMode = getVal("search_display_mode", "bar");
  const searchPlacement = getVal("search_placement", "center");
  const searchMaxWidth = Number(getVal("search_max_width", 420));
  const searchHeight = Number(getVal("search_height", 38));
  const searchTextColor = getVal("search_text_color", theme.text_color || (isDark ? "#f8fafc" : "#0f172a"));
  const searchMutedTextColor = getVal("search_muted_text_color", isDark ? "#94a3b8" : "#64748b");

  const navbarVariant = getVal("navbar_variant", "glassmorphism");
  const navbarPosition = getVal("navbar_position", "sticky");
  const navbarHeight = Number(getVal("navbar_height", 72));
  const rawMaxWidth = String(getVal("navbar_max_width", "1280px"));
  const navbarMaxWidth = rawMaxWidth === "full" ? "100%" : rawMaxWidth;
  const navbarRadius = Number(getVal("navbar_radius", 16));
  const navbarPaddingX = Number(getVal("navbar_padding_x", 16));
  const navbarPaddingY = Number(getVal("navbar_padding_y", 12));

  // Icons Customization Values
  const navbarIconShape = getVal("navbar_icon_shape", "rounded");
  const navbarIconStyle = getVal("navbar_icon_style", "outline");
  const navbarCartIconVariant = getVal("navbar_cart_icon_variant", "cart");
  const navbarAccountIconVariant = getVal("navbar_account_icon_variant", "user_clean");
  const navbarNotificationIconVariant = getVal("navbar_notification_icon_variant", "bell");
  const navbarSearchIconVariant = getVal("navbar_search_icon_variant", "magnifier");
  const navbarIconSize = Number(getVal("navbar_icon_size", 38));
  const navbarIconInnerSize = Number(getVal("navbar_icon_inner_size", 18));
  const navbarIconStrokeWidth = Number(getVal("navbar_icon_stroke_width", 2));
  const navbarIconGap = Number(getVal("navbar_icon_gap", 8));
  const navbarIconBorderEnabled = getVal("navbar_icon_border_enabled", true) !== false;
  const navbarIconBgEnabled = getVal("navbar_icon_bg_enabled", true) !== false;
  const navbarIconColor = getVal("navbar_icon_color", theme.navbar_icon_color || theme.navbar_text_color || theme.text_color || (isDark ? "#f8fafc" : "#0f172a"));
  const navbarIconBgColor = getVal("navbar_icon_bg_color", theme.navbar_icon_bg_color || (isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)"));
  const navbarIconBorderColor = getVal("navbar_icon_border_color", theme.navbar_icon_border_color || (isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)"));

  const defaultNavbarBg = theme.navbar_bg || theme.primary_bg || (isDark ? "#0f172a" : "rgba(255, 255, 255, 0.85)");
  const navbarBg = getVal("navbar_bg", defaultNavbarBg);
  const navbarOuterBg = getVal("navbar_outer_bg", theme.navbar_outer_bg || "transparent");
  const navbarTextColorVal = getVal("navbar_text_color", theme.navbar_text_color || theme.text_color || (isDark ? "#f8fafc" : "#0f172a"));
  const navbarBorderColor = getVal("navbar_border_color", isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(226, 232, 240, 0.8)");

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 5 Clean Navigation Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "2px",
          background: "#f1f5f9",
          padding: "2px",
          borderRadius: "6px",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        {[
          { id: "brand", label: "Brand" },
          { id: "search", label: "Search" },
          { id: "layout", label: "Layout" },
          { id: "icons", label: "Icons" },
          { id: "colors", label: "Colors" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "5px 1px",
                border: "none",
                borderRadius: "4px",
                background: isActive ? "#ffffff" : "transparent",
                color: isActive ? ADMIN_BLUE : "#64748b",
                fontWeight: isActive ? 800 : 600,
                fontSize: "10px",
                cursor: "pointer",
                textAlign: "center",
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.12s ease",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BRAND & LOGO */}
      {activeTab === "brand" && (
        <section style={sectionCardStyle(isLightMode)}>
          <div style={{ display: "grid", gap: "6px", width: "100%", boxSizing: "border-box" }}>
            {/* Display Mode */}
            <div style={{ display: "grid", gap: "2px" }}>
              <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Display
              </label>
              <SegmentedRow
                value={brandDisplayMode}
                onChange={(val) => updateField("brand_display_mode", val)}
                options={[
                  { label: "Both", value: "both" },
                  { label: "Logo", value: "logo_only" },
                  { label: "Name", value: "name_only" },
                ]}
              />
            </div>

            {/* Position & Direction in 2-Column Row */}
            <div style={{ display: "grid", gridTemplateColumns: brandDisplayMode === "both" ? "1fr 1fr" : "1fr", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Position
                </label>
                <SegmentedRow
                  value={brandAlignment}
                  onChange={(val) => updateField("brand_alignment", val)}
                  options={[
                    { label: "Left", value: "left" },
                    { label: "Center", value: "center" },
                  ]}
                />
              </div>

              {brandDisplayMode === "both" && (
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Direction
                  </label>
                  <SegmentedRow
                    value={brandLayoutDirection}
                    onChange={(val) => updateField("brand_layout_direction", val)}
                    options={[
                      { label: "Row", value: "row" },
                      { label: "Column", value: "column" },
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Logo Settings */}
            {brandDisplayMode !== "name_only" && (
              <>
                <SectionDivider title="Brand Logo" />

                <LogoUploadControl
                  currentValue={logoUrl}
                  isLightMode={isLightMode}
                  onChange={(val) => updateField("logoUrl", val)}
                />

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Logo Fit
                  </label>
                  <SegmentedRow
                    value={logoFit}
                    onChange={(val) => updateField("logo_fit", val)}
                    options={[
                      { label: "Contain", value: "contain" },
                      { label: "Cover", value: "cover" },
                      { label: "Fill", value: "fill" },
                    ]}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <NumberStepperField
                    label="Box Size"
                    value={logoSize}
                    min={16}
                    max={100}
                    step={2}
                    unit="px"
                    onChange={(val) => updateField("logo_size", val)}
                  />

                  <NumberStepperField
                    label="Zoom / Scale"
                    value={logoZoom}
                    min={60}
                    max={300}
                    step={5}
                    unit="%"
                    onChange={(val) => updateField("logo_zoom", val)}
                  />
                </div>
              </>
            )}

            {/* Brand Typography */}
            {brandDisplayMode !== "logo_only" && (
              <>
                <SectionDivider title="Typography" />

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    placeholder="Enter brand name..."
                    onChange={(e) => updateField("brandName", e.target.value)}
                    style={sharedInputStyle()}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "6px" }}>
                  <div style={{ display: "grid", gap: "2px" }}>
                    <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Font
                    </label>
                    <CustomSelectDropdown
                      value={brandFontFamily}
                      placeholder="Select Font"
                      options={[
                        { label: "Inter (Sans)", value: "sans_modern" },
                        { label: "Roboto (Sans)", value: "roboto_sans" },
                        { label: "Outfit (Tech)", value: "outfit_tech" },
                        { label: "Plus Jakarta", value: "plus_jakarta" },
                        { label: "Space Grotesk", value: "space_grotesk" },
                        { label: "Playfair (Serif)", value: "playfair_serif" },
                        { label: "Cinzel (Serif)", value: "cinzel_display" },
                        { label: "Cormorant", value: "cormorant_serif" },
                        { label: "Montserrat", value: "montserrat_bold" },
                        { label: "Poppins", value: "poppins_rounded" },
                        { label: "Abril Fatface", value: "abril_fatface" },
                      ]}
                      onChange={(val) => updateField("brand_font_family", val)}
                    />
                  </div>

                  <div style={{ display: "grid", gap: "2px" }}>
                    <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Weight
                    </label>
                    <CustomSelectDropdown
                      value={brandFontWeight}
                      placeholder="Weight"
                      options={[
                        { label: "300 Light", value: "300" },
                        { label: "400 Regular", value: "400" },
                        { label: "500 Medium", value: "500" },
                        { label: "600 Semi", value: "600" },
                        { label: "700 Bold", value: "700" },
                        { label: "800 Extra", value: "800" },
                        { label: "900 Black", value: "900" },
                      ]}
                      onChange={(val) => updateField("brand_font_weight", val)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <div style={{ display: "grid", gap: "2px" }}>
                    <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Style
                    </label>
                    <SegmentedRow
                      value={brandFontStyle}
                      onChange={(val) => updateField("brand_font_style", val)}
                      options={[
                        { label: "Normal", value: "normal" },
                        { label: "Italic", value: "italic" },
                      ]}
                    />
                  </div>

                  <NumberStepperField
                    label="Font Size"
                    value={brandFontSize}
                    min={12}
                    max={36}
                    step={1}
                    unit="px"
                    onChange={(val) => updateField("brand_font_size", val)}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: SEARCH BAR */}
      {activeTab === "search" && (
        <section style={sectionCardStyle(isLightMode)}>
          <div style={{ display: "grid", gap: "6px", width: "100%", boxSizing: "border-box" }}>
            {/* Search Display Style */}
            <div style={{ display: "grid", gap: "2px" }}>
              <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Display Mode
              </label>
              <SegmentedRow
                value={searchDisplayMode}
                onChange={(val) => updateField("search_display_mode", val)}
                options={[
                  { label: "Search Bar", value: "bar" },
                  { label: "Icon Only", value: "icon" },
                ]}
              />
            </div>

            {searchDisplayMode === "bar" && (
              <>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Placement
                  </label>
                  <SegmentedRow
                    value={searchPlacement}
                    onChange={(val) => updateField("search_placement", val)}
                    options={[
                      { label: "Left", value: "left" },
                      { label: "Center", value: "center" },
                      { label: "Right", value: "right" },
                    ]}
                  />
                </div>

                <SectionDivider title="Dimensions" />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <NumberStepperField
                    label="Width"
                    value={searchMaxWidth}
                    min={160}
                    max={650}
                    step={10}
                    unit="px"
                    onChange={(val) => updateField("search_max_width", val)}
                  />

                  <NumberStepperField
                    label="Height"
                    value={searchHeight}
                    min={28}
                    max={54}
                    step={2}
                    unit="px"
                    onChange={(val) => updateField("search_height", val)}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* TAB 3: LAYOUT & STRUCTURE */}
      {activeTab === "layout" && (
        <section style={sectionCardStyle(isLightMode)}>
          <div style={{ display: "grid", gap: "6px", width: "100%", boxSizing: "border-box" }}>
            {/* Style Variant */}
            <div style={{ display: "grid", gap: "2px" }}>
              <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Style Preset
              </label>
              <CustomSelectDropdown
                value={navbarVariant}
                placeholder="Select Navbar Style"
                options={[
                  { label: "Soft (Subtle Tint)", value: "soft" },
                  { label: "Solid (Full Color)", value: "solid" },
                  { label: "Floating (Island)", value: "floating" },
                  { label: "Glassmorphism (Frosted)", value: "glassmorphism" },
                ]}
                onChange={(val) => updateField("navbar_variant", val)}
              />
            </div>

            {/* Scroll Position */}
            <div style={{ display: "grid", gap: "2px" }}>
              <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Scroll Position
              </label>
              <SegmentedRow
                value={navbarPosition}
                onChange={(val) => updateField("navbar_position", val)}
                options={[
                  { label: "Sticky", value: "sticky" },
                  { label: "Fixed", value: "fixed" },
                  { label: "Static", value: "static" },
                ]}
              />
            </div>

            <SectionDivider title="Dimensions & Radius" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <NumberStepperField
                label="Navbar Height"
                value={navbarHeight}
                min={48}
                max={100}
                step={2}
                unit="px"
                onChange={(val) => updateField("navbar_height", val)}
              />

              <NumberStepperField
                label="Border Radius"
                value={navbarRadius}
                min={0}
                max={36}
                step={2}
                unit="px"
                onChange={(val) => updateField("navbar_radius", val)}
              />
            </div>

            <SectionDivider title="Padding & Max Width" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <NumberStepperField
                label="Sides (X)"
                value={navbarPaddingX}
                min={8}
                max={36}
                step={2}
                unit="px"
                onChange={(val) => updateField("navbar_padding_x", val)}
              />

              <NumberStepperField
                label="Top / Bottom (Y)"
                value={navbarPaddingY}
                min={4}
                max={28}
                step={2}
                unit="px"
                onChange={(val) => updateField("navbar_padding_y", val)}
              />
            </div>

            <div style={{ display: "grid", gap: "2px" }}>
              <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Max Width Constraint
              </label>
              <SegmentedRow
                value={navbarMaxWidth}
                onChange={(val) => updateField("navbar_max_width", val)}
                options={[
                  { label: "1100px", value: "1100px" },
                  { label: "1280px", value: "1280px" },
                  { label: "1440px", value: "1440px" },
                  { label: "100%", value: "100%" },
                ]}
              />
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: ICONS & ACTIONS */}
      {activeTab === "icons" && (
        <section style={sectionCardStyle(isLightMode)}>
          <div style={{ display: "grid", gap: "8px", width: "100%", boxSizing: "border-box" }}>
            {/* 1. BUTTON STYLE & SHAPE */}
            <div style={{ display: "grid", gap: "5px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Icon Visual Style
                </label>
                <SegmentedRow
                  value={navbarIconStyle}
                  onChange={(val) => updateField("navbar_icon_style", val)}
                  options={[
                    { label: "Outline", value: "outline" },
                    { label: "Solid", value: "solid" },
                    { label: "Duotone", value: "duotone" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Button Shape
                </label>
                <SegmentedRow
                  value={navbarIconShape}
                  onChange={(val) => updateField("navbar_icon_shape", val)}
                  options={[
                    { label: "Rounded", value: "rounded" },
                    { label: "Circle", value: "circle" },
                    { label: "Square", value: "square" },
                    { label: "Ghost", value: "ghost" },
                  ]}
                />
              </div>

              {navbarIconShape !== "ghost" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <div style={{ display: "grid", gap: "2px" }}>
                    <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Background
                    </label>
                    <SegmentedRow
                      value={navbarIconBgEnabled ? "on" : "off"}
                      onChange={(val) => updateField("navbar_icon_bg_enabled", val === "on")}
                      options={[
                        { label: "Filled", value: "on" },
                        { label: "None", value: "off" },
                      ]}
                    />
                  </div>

                  <div style={{ display: "grid", gap: "2px" }}>
                    <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Border
                    </label>
                    <SegmentedRow
                      value={navbarIconBorderEnabled ? "on" : "off"}
                      onChange={(val) => updateField("navbar_icon_border_enabled", val === "on")}
                      options={[
                        { label: "Border", value: "on" },
                        { label: "No Border", value: "off" },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>

            <SectionDivider title="Icon Variants" />

            {/* 2. ICON SHAPES */}
            <div style={{ display: "grid", gap: "5px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Cart / Bag Icon
                </label>
                <SegmentedRow
                  value={navbarCartIconVariant}
                  onChange={(val) => updateField("navbar_cart_icon_variant", val)}
                  options={[
                    { label: "Cart", value: "cart" },
                    { label: "Shopping Bag", value: "bag" },
                    { label: "Basket", value: "basket" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Account Icon
                </label>
                <SegmentedRow
                  value={navbarAccountIconVariant}
                  onChange={(val) => updateField("navbar_account_icon_variant", val)}
                  options={[
                    { label: "Standard", value: "user_clean" },
                    { label: "Circle", value: "user_circle" },
                    { label: "Rounded", value: "user_rounded" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Notification Bell
                </label>
                <SegmentedRow
                  value={navbarNotificationIconVariant}
                  onChange={(val) => updateField("navbar_notification_icon_variant", val)}
                  options={[
                    { label: "Classic", value: "bell" },
                    { label: "Curved", value: "bell_curved" },
                    { label: "Ringing", value: "bell_ring" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Search Icon
                </label>
                <SegmentedRow
                  value={navbarSearchIconVariant}
                  onChange={(val) => updateField("navbar_search_icon_variant", val)}
                  options={[
                    { label: "Classic", value: "magnifier" },
                    { label: "Compact", value: "search_minimal" },
                    { label: "Angled", value: "search_round" },
                  ]}
                />
              </div>
            </div>

            <SectionDivider title="Size & Spacing" />

            {/* 3. SIZE & SPACING */}
            <div style={{ display: "grid", gap: "5px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Button Size"
                  value={navbarIconSize}
                  min={28}
                  max={50}
                  step={2}
                  unit="px"
                  onChange={(val) => updateField("navbar_icon_size", val)}
                />

                <NumberStepperField
                  label="Icon Size"
                  value={navbarIconInnerSize}
                  min={12}
                  max={28}
                  step={1}
                  unit="px"
                  onChange={(val) => updateField("navbar_icon_inner_size", val)}
                />
              </div>

              {navbarIconStyle !== "solid" && (
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Icon Stroke Weight
                  </label>
                  <SegmentedRow
                    value={String(navbarIconStrokeWidth)}
                    onChange={(val) => updateField("navbar_icon_stroke_width", Number(val))}
                    options={[
                      { label: "1.5 Thin", value: "1.5" },
                      { label: "2.0 Reg", value: "2" },
                      { label: "2.5 Semi", value: "2.5" },
                      { label: "3.0 Bold", value: "3" },
                    ]}
                  />
                </div>
              )}

              <NumberStepperField
                label="Gap Between Icons"
                value={navbarIconGap}
                min={2}
                max={24}
                step={2}
                unit="px"
                onChange={(val) => updateField("navbar_icon_gap", val)}
              />
            </div>
          </div>
        </section>
      )}

      {/* TAB 5: COLORS & THEME */}
      {activeTab === "colors" && (
        <section style={sectionCardStyle(isLightMode)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", boxSizing: "border-box" }}>
            <span style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Navbar & Background
            </span>
            <CompactColorRow
              label="Navbar Background"
              value={navbarBg}
              onChange={(val) => updateField("navbar_bg", val)}
            />

            <CompactColorRow
              label="Outer Background (Floating)"
              value={navbarOuterBg}
              onChange={(val) => updateField("navbar_outer_bg", val)}
            />

            <CompactColorRow
              label="Border Color"
              value={navbarBorderColor}
              onChange={(val) => updateField("navbar_border_color", val)}
            />

            <span style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "4px" }}>
              Brand & Text
            </span>
            <CompactColorRow
              label="Brand Name Color"
              value={brandTextColor}
              onChange={(val) => updateField("brand_text_color", val)}
            />

            <CompactColorRow
              label="Text & Icons Color"
              value={navbarTextColorVal}
              onChange={(val) => updateField("navbar_text_color", val)}
            />

            <span style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "4px" }}>
              Action Icons Colors
            </span>
            <CompactColorRow
              label="Action Icon Color"
              value={navbarIconColor}
              onChange={(val) => updateField("navbar_icon_color", val)}
            />

            <CompactColorRow
              label="Icon Background"
              value={navbarIconBgColor}
              onChange={(val) => updateField("navbar_icon_bg_color", val)}
            />

            <CompactColorRow
              label="Icon Border Color"
              value={navbarIconBorderColor}
              onChange={(val) => updateField("navbar_icon_border_color", val)}
            />

            <span style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "4px" }}>
              Search Colors
            </span>
            <CompactColorRow
              label="Search Input Text"
              value={searchTextColor}
              onChange={(val) => updateField("search_text_color", val)}
            />

            <CompactColorRow
              label="Search Placeholder / Icon"
              value={searchMutedTextColor}
              onChange={(val) => updateField("search_muted_text_color", val)}
            />
          </div>
        </section>
      )}
    </div>
  );
}

export default function EditorSidebar({
  siteDefinition,
  selectedBlockId,
  selectedTab,
  onTabChange,
  onSiteDefinitionChange,
  onSelectBlock,
  activePageId,
  onSelectPage,
}: EditorSidebarProps) {
  const isLightMode = true;

  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotFeedback, setSnapshotFeedback] = useState<string | null>(null);
  const [showAllSnapshots, setShowAllSnapshots] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshCounter((c) => c + 1);
    window.addEventListener("webnirmaan_theme_saved", handleUpdate);
    return () => window.removeEventListener("webnirmaan_theme_saved", handleUpdate);
  }, []);

  const savedSnapshots = useMemo(
    () => getSavedThemeSnapshots(siteDefinition),
    [siteDefinition, refreshCounter]
  );

  const handleSaveSnapshot = async () => {
    const next = saveThemeSnapshot(siteDefinition, snapshotName);
    onSiteDefinitionChange(next);
    setSnapshotName("");
    setSnapshotFeedback("Saved!");
    setRefreshCounter((c) => c + 1);

    const sId = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id || getSiteStorageId(siteDefinition);
    if (sId && sId !== "default_site") {
      try {
        await fetch(`${API_BASE_URL}/sites/${sId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ draft_definition: next }),
        });
      } catch (err) {
        console.error("Failed to persist theme snapshot to server:", err);
      }
    }

    setTimeout(() => setSnapshotFeedback(null), 2000);
  };

  const handleDeleteSnapshot = async (id: string) => {
    const next = deleteThemeSnapshot(siteDefinition, id);
    onSiteDefinitionChange(next);
    setRefreshCounter((c) => c + 1);

    const sId = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id || getSiteStorageId(siteDefinition);
    if (sId && sId !== "default_site") {
      try {
        await fetch(`${API_BASE_URL}/sites/${sId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ draft_definition: next }),
        });
      } catch (err) {
        console.error("Failed to delete theme snapshot on server:", err);
      }
    }
  };

  const handleApplySnapshot = async (id: string) => {
    const next = applyThemeSnapshot(siteDefinition, id);
    onSiteDefinitionChange(next);
    setRefreshCounter((c) => c + 1);

    const sId = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id || getSiteStorageId(siteDefinition);
    if (sId && sId !== "default_site") {
      try {
        await fetch(`${API_BASE_URL}/sites/${sId}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ draft_definition: next }),
        });
      } catch (err) {
        console.error("Failed to persist applied theme snapshot on server:", err);
      }
    }
  };

  const textColor = "#0f172a";
  const accentColor = siteDefinition.theme?.accent_color || "#2563eb";
  const selectedBlock = findBlockById(siteDefinition, selectedBlockId);
  const editableConfig = selectedBlock
    ? getEditableConfigForBlock(selectedBlock.type)
    : null;
  const currentSearchDisplayMode = siteDefinition.theme?.search_display_mode || "bar";
  const currentBrandDisplayMode = siteDefinition.theme?.brand_display_mode || "both";

  const visibleFields = useMemo(() => {
    if (!editableConfig?.fields || editableConfig.fields.length === 0) return [];
    return editableConfig.fields.filter((field) => {
      if (selectedBlock?.type === "navbar" || selectedBlock?.type === "header") {
        // When search display mode is "icon", hide options that only apply to the full search bar
        if (currentSearchDisplayMode === "icon") {
          const searchBarOnlyKeys = [
            "search_placement",
            "search_max_width",
            "search_height",
            "search_text_color",
            "search_muted_text_color",
            "search_bg_color",
            "search_border_color",
          ];
          if (searchBarOnlyKeys.includes(field.key)) {
            return false;
          }
        }

        // When brand display mode is "logo_only", hide text-specific options
        if (currentBrandDisplayMode === "logo_only") {
          const brandTextOnlyKeys = [
            "brandName",
            "brand_font_family",
            "brand_font_weight",
            "brand_font_style",
            "brand_font_size",
            "brand_text_color",
            "brand_layout_direction",
          ];
          if (brandTextOnlyKeys.includes(field.key)) {
            return false;
          }
        }

        // When brand display mode is "name_only", hide logo-specific options
        if (currentBrandDisplayMode === "name_only") {
          const brandLogoOnlyKeys = [
            "logoUrl",
            "logo_size",
            "logo_zoom",
            "logo_height",
            "logo_max_width",
            "logo_fit",
            "brand_layout_direction",
          ];
          if (brandLogoOnlyKeys.includes(field.key)) {
            return false;
          }
        }
      }
      return true;
    });
  }, [editableConfig, selectedBlock?.type, currentSearchDisplayMode, currentBrandDisplayMode]);

  const fieldGroups = useMemo(() => {
    return visibleFields.length > 0 ? groupFields(visibleFields) : [];
  }, [visibleFields]);

  const handleFieldChange = (field: EditorField, value: any) => {
    if (field.target === "theme") {
      onSiteDefinitionChange(
        updateThemeValues(siteDefinition, { [field.key]: value })
      );
      return;
    }

    if (!selectedBlockId) return;

    onSiteDefinitionChange(
      updateBlockFieldValue(siteDefinition, selectedBlockId, field, value)
    );
  };

  const location = useLocation();
  const currentPath = location.pathname;

  const activePage =
    (siteDefinition.pages || []).find(
      (p) => p.id === activePageId || p.role === "home" || p.route === "/" || p.route === ""
    ) ||
    siteDefinition.pages?.[0] ||
    ({ name: "Home Page", route: "/" } as any);

  const activePageTitle = useMemo(() => {
    if (currentPath.includes("/checkout")) return "CHECKOUT (/checkout)";
    if (currentPath.includes("/cart")) return "CART (/cart)";
    if (currentPath.includes("/profile") || currentPath.includes("/account")) return "PROFILE (/profile)";
    if (currentPath.includes("/orders")) return "ORDERS (/orders)";
    if (currentPath.includes("/products/")) return "PRODUCT DETAIL (/products/:slug)";
    return `${activePage.name?.toUpperCase() || "HOME"} (${activePage.route || "/"})`;
  }, [currentPath, activePage]);

  return (
    <aside
      className="wc-editor-sidebar"
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        flexShrink: 0,
        position: "relative",
        top: "auto",
        overflowY: "auto",
        overflowX: "hidden",
        padding: "6px 8px",
        boxSizing: "border-box",
        color: "#0f172a",
        background: "#ffffff",
        border: "none",
        borderRadius: 0,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        .wc-editor-sidebar,
        .wc-editor-sidebar * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          box-sizing: border-box;
        }

        .wc-editor-sidebar input:focus,
        .wc-editor-sidebar select:focus,
        .wc-editor-sidebar textarea:focus {
          border-color: ${ADMIN_BLUE} !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15) !important;
        }

        .wc-editor-sidebar input:hover,
        .wc-editor-sidebar select:hover,
        .wc-editor-sidebar textarea:hover {
          border-color: #94a3b8;
        }

        .wc-editor-sidebar::-webkit-scrollbar {
          width: 4px;
        }
        .wc-editor-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        .wc-editor-sidebar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 999px;
        }
        .wc-editor-sidebar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>

      {/* Sleek Segmented Pill Tabs */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "2px",
          background: "#f1f5f9",
          borderRadius: "5px",
          marginBottom: "6px",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={() => onTabChange("theme")}
          style={{
            flex: 1,
            padding: "4px 6px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            background: selectedTab === "theme" ? ADMIN_BLUE : "transparent",
            color: selectedTab === "theme" ? "#ffffff" : "#64748b",
            boxShadow: selectedTab === "theme" ? "0 1px 2px rgba(37,99,235,0.2)" : "none",
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            transition: "all 0.12s ease",
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
          THEME
        </button>

        <button
          type="button"
          onClick={() => onTabChange("block")}
          style={{
            flex: 1,
            padding: "4px 6px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            background: selectedTab === "block" ? ADMIN_BLUE : "transparent",
            color: selectedTab === "block" ? "#ffffff" : "#64748b",
            boxShadow: selectedTab === "block" ? "0 1px 2px rgba(37,99,235,0.2)" : "none",
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            transition: "all 0.12s ease",
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          BLOCKS
        </button>
      </div>

      {selectedTab === "theme" ? (
        <div style={{ display: "grid", gap: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {/* Saved Snapshots Section */}
          <section style={{ ...sectionCardStyle(isLightMode), boxSizing: "border-box", overflow: "visible" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              SAVED SNAPSHOTS
            </div>
            
            <div style={{ display: "flex", gap: "4px", width: "100%", boxSizing: "border-box" }}>
              <input
                type="text"
                placeholder="Snapshot name..."
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveSnapshot();
                  }
                }}
                style={{ ...sharedInputStyle(), flex: 1, minWidth: 0, height: "26px", fontSize: "11px" }}
              />
              <button
                type="button"
                onClick={handleSaveSnapshot}
                style={{
                  padding: "0 10px",
                  height: "26px",
                  borderRadius: "4px",
                  border: "none",
                  background: snapshotFeedback ? "#10b981" : ADMIN_BLUE,
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {snapshotFeedback || "+ Save"}
              </button>
            </div>

            {savedSnapshots.length === 0 ? (
              <div style={{ fontSize: "10.5px", color: "#94a3b8", textAlign: "center", padding: "6px 0" }}>
                No snapshots yet. Enter a name & click + Save.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "3.5px",
                    marginTop: "3px",
                    width: "100%",
                    boxSizing: "border-box",
                    maxHeight: showAllSnapshots ? "250px" : "none",
                    overflowY: showAllSnapshots ? "auto" : "visible",
                    paddingRight: showAllSnapshots ? "2px" : "0",
                  }}
                >
                  {(showAllSnapshots ? savedSnapshots : savedSnapshots.slice(0, 3)).map((snap: any) => {
                    const th = snap.theme || {};
                    return (
                      <div
                        key={snap.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 6px",
                          minHeight: "29px",
                          borderRadius: "4px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          gap: "6px",
                          width: "100%",
                          boxSizing: "border-box",
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: "2px", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: th.primary_bg || "#ffffff", border: "1px solid #cbd5e1" }} title={`Primary: ${th.primary_bg || '#ffffff'}`} />
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: th.accent_color || "#2563eb", border: "1px solid #cbd5e1" }} title={`Accent: ${th.accent_color || '#2563eb'}`} />
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: th.navbar_bg || "#0f172a", border: "1px solid #cbd5e1" }} title={`Navbar: ${th.navbar_bg || '#0f172a'}`} />
                          </div>
                          <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                            {snap.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "3px", alignItems: "center", flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleApplySnapshot(snap.id)}
                            style={{
                              padding: "2px 7px",
                              height: "20px",
                              borderRadius: "3px",
                              border: "none",
                              background: ADMIN_BLUE,
                              color: "#ffffff",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSnapshot(snap.id)}
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "3px",
                              border: "none",
                              background: "rgba(239,68,68,0.1)",
                              color: "#ef4444",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                            }}
                            title="Delete Snapshot"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {savedSnapshots.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSnapshots(!showAllSnapshots)}
                    style={{
                      width: "100%",
                      padding: "4px 6px",
                      borderRadius: "4px",
                      border: "1px dashed #cbd5e1",
                      background: "#ffffff",
                      color: ADMIN_BLUE,
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "center",
                      marginTop: "3px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {showAllSnapshots
                      ? `▲ Show less (3 of ${savedSnapshots.length})`
                      : `▼ View all snapshots (${savedSnapshots.length})`}
                  </button>
                )}
              </>
            )}
          </section>

          {/* Appearance & Mode Section */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              APPEARANCE & MODE
            </div>

            <div style={{ display: "flex", gap: "3px", padding: "2px", background: "#f1f5f9", borderRadius: "5px" }}>
              <button
                type="button"
                onClick={() =>
                  onSiteDefinitionChange(applyThemeMode(siteDefinition, "light"))
                }
                style={{
                  flex: 1,
                  padding: "4px 6px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    siteDefinition.theme?.mode === "light"
                      ? "#ffffff"
                      : "transparent",
                  color:
                    siteDefinition.theme?.mode === "light" ? "#0f172a" : "#64748b",
                  boxShadow: siteDefinition.theme?.mode === "light" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.12s ease",
                }}
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                Light
              </button>

              <button
                type="button"
                onClick={() =>
                  onSiteDefinitionChange(applyThemeMode(siteDefinition, "dark"))
                }
                style={{
                  flex: 1,
                  padding: "4px 6px",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    siteDefinition.theme?.mode === "dark"
                      ? "#000000"
                      : "transparent",
                  color:
                    siteDefinition.theme?.mode === "dark" ? "#ffffff" : "#64748b",
                  boxShadow: siteDefinition.theme?.mode === "dark" ? "0 1px 2px rgba(0,0,0,0.25)" : "none",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.12s ease",
                }}
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                Dark
              </button>
            </div>
          </section>

          {/* Festival Themes Section */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              FESTIVAL THEME
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              {[
                {
                  key: "none",
                  label: "Default",
                  icon: (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
                    </svg>
                  ),
                },
                {
                  key: "diwali",
                  label: "Diwali",
                  icon: (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2c0 4.5-4 7-4 11a6 6 0 0 0 12 0c0-4-4-6.5-4-11z" />
                      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  key: "holi",
                  label: "Holi",
                  icon: (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="9" cy="9.5" r="1.5" fill="currentColor" />
                      <circle cx="15" cy="9.5" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  key: "durga_puja",
                  label: "Durga Puja",
                  icon: (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M12 2l-3.5 4v4.5a3.5 3.5 0 0 0 7 0V6L12 2zM5 8c0 2.5 2.5 4.5 7 4.5s7-2 7-4.5" />
                    </svg>
                  ),
                },
                {
                  key: "rakhi",
                  label: "Rakhi",
                  icon: (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="2" y1="12" x2="7" y2="12" />
                      <line x1="17" y1="12" x2="22" y2="12" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  key: "eid",
                  label: "Eid",
                  icon: (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  key: "christmas",
                  label: "Christmas",
                  icon: (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.5 5h-2l3.5 5.5h-2.5l4 6.5H4.5l4-6.5h-2.5l3.5-5.5h-2l3.5-5z" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  ),
                },
              ].map((item) => {
                const active = (siteDefinition.theme?.festival_theme || "none") === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSiteDefinitionChange(applyFestivalTheme(siteDefinition, item.key as any))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: active
                        ? "1px solid #2563eb"
                        : isLightMode ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.08)",
                      background: active
                        ? (isLightMode ? "#eff6ff" : "rgba(37,99,235,0.18)")
                        : (isLightMode ? "#ffffff" : "rgba(255,255,255,0.03)"),
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "10.5px",
                      fontWeight: active ? 700 : 500,
                      color: active
                        ? (isLightMode ? "#1e40af" : "#93c5fd")
                        : (isLightMode ? "#334155" : "#cbd5e1"),
                      transition: "all 0.12s ease",
                      gridColumn: item.key === "none" ? "1 / -1" : "span 1",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: active ? 1 : 0.75 }}>
                      {item.icon}
                    </span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Festive Motif Position (For Hero Banner) */}
            {(siteDefinition.theme?.festival_theme && siteDefinition.theme.festival_theme !== "none") && (
              <>
                <div style={{ marginTop: "8px", display: "grid", gap: "3px" }}>
                  <label style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Hero Banner Motif Position
                  </label>
                  <SegmentedRow
                    value={siteDefinition.theme?.hero_festive_position || siteDefinition.theme?.festive_position || "right"}
                    onChange={(val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { hero_festive_position: val, festive_position: val }))}
                    options={[
                      { label: "Left", value: "left" },
                      { label: "Center", value: "center" },
                      { label: "Right", value: "right" },
                    ]}
                  />
                </div>

                {/* Hero Banner Motif Opacity */}
                <div style={{ marginTop: "6px" }}>
                  <NumberStepperField
                    label="Hero Motif Opacity"
                    value={siteDefinition.theme?.hero_festive_opacity !== undefined ? siteDefinition.theme.hero_festive_opacity : (siteDefinition.theme?.festive_opacity !== undefined ? siteDefinition.theme.festive_opacity : 100)}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { hero_festive_opacity: val, festive_opacity: val }))}
                  />
                </div>
              </>
            )}
          </section>

          {/* Brand Palette Section */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: "4px" }}>
              BRAND PALETTE
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", boxSizing: "border-box" }}>
              <CompactColorRow
                label="Accent Color"
                value={siteDefinition.theme?.accent_color || "#2563eb"}
                onChange={(val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { accent_color: val }))}
              />

              <CompactColorRow
                label="Text Color"
                value={siteDefinition.theme?.text_color || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { text_color: val }))}
              />

              <CompactColorRow
                label="Primary Background"
                value={siteDefinition.theme?.primary_bg || (siteDefinition.theme?.mode === "dark" ? "#121316" : "#ffffff")}
                onChange={(val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { primary_bg: val }))}
              />

              <CompactColorRow
                label="Secondary Background"
                value={siteDefinition.theme?.secondary_bg || (siteDefinition.theme?.mode === "dark" ? "#1a1c21" : "#f8fafc")}
                onChange={(val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { secondary_bg: val }))}
              />
            </div>
          </section>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {/* Dynamic Page & Inspector Breadcrumb Header */}
          <div style={{ paddingBottom: "4px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
              {selectedBlock ? (
                <button
                  type="button"
                  onClick={() => onSelectBlock && onSelectBlock(null)}
                  style={{
                    border: "none",
                    background: "rgba(37,99,235,0.08)",
                    color: ADMIN_BLUE,
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontSize: "9.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    flexShrink: 0,
                  }}
                  title="Back to Page Tree"
                >
                  ← Tree
                </button>
              ) : (
                <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                  PAGE
                </span>
              )}
              <span style={{ fontSize: "9px", color: "#cbd5e1" }}>/</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedBlock ? (editableConfig?.displayName || selectedBlock.type.toUpperCase()) : activePageTitle}
              </span>
            </div>
            {selectedBlock && (
              <span style={{ fontSize: "8.5px", fontWeight: 800, padding: "1px 4px", borderRadius: "3px", background: "rgba(37,99,235,0.08)", color: ADMIN_BLUE, flexShrink: 0 }}>
                EDITING
              </span>
            )}
          </div>

          {!selectedBlock ? (
            <PageBlocksTreeView
              siteDefinition={siteDefinition}
              onSelectBlock={onSelectBlock}
              onSelectPage={onSelectPage}
              isLightMode={isLightMode}
            />
          ) : !editableConfig ? (
            <div style={sectionCardStyle(isLightMode)}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>{selectedBlock.type}</div>
              <p style={{ margin: 0, fontSize: "10.5px", color: "#64748b", lineHeight: 1.4 }}>
                This block does not have configurable properties.
              </p>
            </div>
          ) : (
            <>
              {selectedBlock.type === "hero_banner" || selectedBlock.type === "herobanner" || selectedBlock.type === "hero" || selectedBlock.type === "banner" ? (
                <HeroSlidesEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : selectedBlock.type === "navbar" || selectedBlock.type === "header" ? (
                <NavbarEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : (
                fieldGroups.map((group) => (
                  <section key={group.title} style={sectionCardStyle(isLightMode)}>
                    <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                      {group.title}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      {group.items.map((field) => {
                        const isFullWidth =
                          field.type !== "number" &&
                          !field.key.includes("height") &&
                          !field.key.includes("width") &&
                          !field.key.includes("radius") &&
                          !field.key.includes("padding") &&
                          !field.key.includes("gap") &&
                          !field.key.includes("columns");

                        const currentValue =
                          field.target === "theme"
                            ? siteDefinition.theme?.[
                                field.key as keyof typeof siteDefinition.theme
                              ]
                            : selectedBlock.props?.[field.key];

                        return (
                          <div
                            key={field.key}
                            style={{
                              gridColumn: isFullWidth ? "1 / -1" : "span 1",
                              display: "grid",
                              gap: "2px",
                              width: "100%",
                              minWidth: 0,
                              boxSizing: "border-box",
                            }}
                          >
                            {field.type !== "checkbox" ? (
                              <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                                {field.label}
                              </label>
                            ) : null}

                            {renderFieldControl(
                              field,
                              currentValue,
                              textColor,
                              isLightMode,
                              (value) => handleFieldChange(field, value)
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}