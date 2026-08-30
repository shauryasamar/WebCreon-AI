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
  saveThemeSnapshot,
  updateBlockFieldValue,
  updateThemeValues,
} from "./editorUtils";
import { EditorField } from "./editorTypes";
import { API_BASE_URL } from "../config/api";
import { optimizeImageUrl } from "../utils/imageOptimizer";

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
      const formData = new FormData();
      formData.append("file", file);
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
      <ModernColorPicker
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

  const autoPlayInterval = currentProps.auto_play_interval ?? 3;
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

  const [expandedSlideIndex, setExpandedSlideIndex] = useState<number | null>(0);
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
      {/* 1. Global Sizing Controls */}
      <section style={sectionCardStyle(isLightMode)}>
        <div style={{ fontSize: "9.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
          LAYOUT & DIMENSIONS
        </div>

        {/* 2-Column Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {/* Banner Height */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Height (px)</label>
            <input
              type="number"
              min="160"
              max="800"
              step="10"
              value={bannerHeightNum}
              onChange={(e) => updateBlockProps(slides, { banner_height: Number(e.target.value) || 380 })}
              style={sharedInputStyle()}
            />
          </div>

          {/* Banner Width */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Width (% or px)</label>
            <input
              type="text"
              placeholder="100% or 1200px"
              value={bannerWidthVal}
              onChange={(e) => updateBlockProps(slides, { banner_width: e.target.value })}
              style={sharedInputStyle()}
            />
          </div>

          {/* Border Radius */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Radius (px)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="2"
              value={borderRadiusNum}
              onChange={(e) => updateBlockProps(slides, { border_radius: Number(e.target.value) || 0 })}
              style={sharedInputStyle()}
            />
          </div>

          {/* Rotation Speed */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Speed (sec)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={autoPlayInterval}
              onChange={(e) => updateBlockProps(slides, { auto_play_interval: Number(e.target.value) || 3 })}
              style={sharedInputStyle()}
            />
          </div>
        </div>

        {/* Auto-play Checkbox Toggle */}
        <div
          onClick={() => updateBlockProps(slides, { auto_play: !autoPlay })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
            padding: "4px 6px",
            borderRadius: "4px",
            border: "1px solid #e2e8f0",
            background: autoPlay ? "rgba(37,99,235,0.04)" : "#ffffff",
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.12s ease",
            boxSizing: "border-box",
            width: "100%",
            marginTop: "1px",
          }}
        >
          <span style={{ fontSize: "10.5px", fontWeight: 500, color: autoPlay ? "#0f172a" : "#475569" }}>
            Auto-rotate banner slides
          </span>
          <div
            style={{
              position: "relative",
              width: "24px",
              height: "14px",
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
                left: autoPlay ? "12px" : "2px",
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
      </section>

      {/* 2. Hero Slides Accordion List */}
      <section style={sectionCardStyle(isLightMode)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "9.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
            SLIDES ({slides.length})
          </div>
          <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: 500 }}>⋮⋮ Drag to reorder</span>
        </div>

        <div style={{ display: "grid", gap: "4px", marginTop: "1px" }}>
          {slides.map((slide, idx) => {
            const isExpanded = expandedSlideIndex === idx;
            const slideVariant = slide.variant || "standard";
            const variantLabel =
              slideVariant === "flash_sale"
                ? "Flash Sale"
                : slideVariant === "product_launch"
                ? "Product Launch"
                : slideVariant === "minimal_brand"
                ? "Minimal Brand"
                : "Standard";

            const trustBadgesList = Array.isArray(slide.trust_badges)
              ? slide.trust_badges
              : ["Free Worldwide Shipping", "30-Day Money Back", "24/7 VIP Support"];

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
                      {variantLabel}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: ADMIN_TEXT, minWidth: 0 }}>
                      {idx + 1}. {slide.headline || "Untitled Banner"}
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
                    {/* Variant Selector */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Variant</label>
                      <CustomSelectDropdown
                        value={slideVariant}
                        options={[
                          { label: "Standard Banner", value: "standard" },
                          { label: "Flash Sale Offer", value: "flash_sale" },
                          { label: "Product Showcase", value: "product_launch" },
                          { label: "Minimal Trust Badges", value: "minimal_brand" },
                        ]}
                        onChange={(val) => handleSlideChange(idx, "variant", val)}
                      />
                    </div>

                    {/* Headline */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Headline</label>
                      <input
                        type="text"
                        value={slide.headline || ""}
                        onChange={(e) => handleSlideChange(idx, "headline", e.target.value)}
                        style={sharedInputStyle()}
                      />
                    </div>

                    {/* Subheadline */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Subheadline</label>
                      <textarea
                        rows={2}
                        value={slide.subheadline || ""}
                        onChange={(e) => handleSlideChange(idx, "subheadline", e.target.value)}
                        style={{ ...sharedInputStyle(), height: "auto", minHeight: "46px", resize: "vertical", lineHeight: 1.4, padding: "3px 6px" }}
                      />
                    </div>

                    {/* Tag Pill */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Badge Tag Pill</label>
                      <input
                        type="text"
                        value={slide.badge || ""}
                        onChange={(e) => handleSlideChange(idx, "badge", e.target.value)}
                        placeholder="FLASH SALE..."
                        style={sharedInputStyle()}
                      />
                    </div>

                    {/* Background Color & Gradient Picker */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Slide Background Color</label>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          width: "100%",
                          height: "26px",
                          padding: "2px 4px",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            width: "18px",
                            height: "18px",
                            borderRadius: "3px",
                            overflow: "hidden",
                            border: "1px solid rgba(0,0,0,0.15)",
                            flexShrink: 0,
                          }}
                        >
                          <input
                            type="color"
                            value={slide.background_color?.startsWith("#") ? slide.background_color : "#0f766e"}
                            onChange={(e) => handleSlideChange(idx, "background_color", e.target.value)}
                            style={{
                              position: "absolute",
                              top: "-50%",
                              left: "-50%",
                              width: "200%",
                              height: "200%",
                              cursor: "pointer",
                              border: "none",
                              padding: 0,
                              margin: 0,
                            }}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. #0f766e"
                          value={slide.background_color || ""}
                          onChange={(e) => handleSlideChange(idx, "background_color", e.target.value)}
                          style={{
                            flex: 1,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontFamily: "'Inter', monospace",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            color: "#0f172a",
                            padding: "0 2px",
                            minWidth: 0,
                          }}
                        />
                      </div>
                    </div>

                    {/* Variant Specific Fields */}
                    {slideVariant === "flash_sale" && (
                      <div style={{ display: "grid", gap: "4px", padding: "6px", background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                        <div style={{ fontSize: "9.5px", fontWeight: 800, color: "#ef4444", textTransform: "uppercase" }}>Flash Sale Details</div>
                        <input
                          type="text"
                          value={slide.coupon_code || ""}
                          onChange={(e) => handleSlideChange(idx, "coupon_code", e.target.value)}
                          placeholder="Coupon Code (e.g. SAVE50)"
                          style={sharedInputStyle()}
                        />
                        <input
                          type="datetime-local"
                          value={slide.sale_end_time || ""}
                          onChange={(e) => handleSlideChange(idx, "sale_end_time", e.target.value)}
                          style={sharedInputStyle()}
                        />
                      </div>
                    )}

                    {slideVariant === "product_launch" && (
                      <div style={{ display: "grid", gap: "4px", padding: "6px", background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                        <div style={{ fontSize: "9.5px", fontWeight: 800, color: ADMIN_BLUE, textTransform: "uppercase" }}>Featured Product Card</div>
                        <input
                          type="text"
                          placeholder="Product Title"
                          value={slide.product_card?.title || ""}
                          onChange={(e) => handleSlideChange(idx, "product_card.title", e.target.value)}
                          style={sharedInputStyle()}
                        />
                        <div style={{ display: "flex", gap: "4px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                          <input
                            type="text"
                            placeholder="Price ($249)"
                            value={slide.product_card?.price || ""}
                            onChange={(e) => handleSlideChange(idx, "product_card.price", e.target.value)}
                            style={{ ...sharedInputStyle(), flex: 1 }}
                          />
                          <input
                            type="text"
                            placeholder="Original ($349)"
                            value={slide.product_card?.original_price || ""}
                            onChange={(e) => handleSlideChange(idx, "product_card.original_price", e.target.value)}
                            style={{ ...sharedInputStyle(), flex: 1 }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Dynamic Trust Badges Array Editor */}
                    {(slideVariant === "minimal_brand" || slideVariant === "standard") && (
                      <div style={{ display: "grid", gap: "4px", padding: "6px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <label style={{ fontSize: "9.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                            TRUST BADGES ({trustBadgesList.length})
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedBadges = [...trustBadgesList, "New Trust Feature"];
                              handleSlideChange(idx, "trust_badges", updatedBadges);
                            }}
                            style={{ padding: "1px 5px", borderRadius: "3px", border: `1px solid ${ADMIN_BLUE}`, background: "rgba(37,99,235,0.08)", color: ADMIN_BLUE, fontSize: "9.5px", fontWeight: 700, cursor: "pointer" }}
                          >
                            + Add
                          </button>
                        </div>
                        {trustBadgesList.map((badgeText: string, bIdx: number) => (
                          <div key={bIdx} style={{ display: "flex", gap: "3px", alignItems: "center", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                            <input
                              type="text"
                              value={badgeText}
                              onChange={(e) => {
                                const updatedBadges = [...trustBadgesList];
                                updatedBadges[bIdx] = e.target.value;
                                handleSlideChange(idx, "trust_badges", updatedBadges);
                              }}
                              style={{ ...sharedInputStyle(), height: "24px", fontSize: "10.5px", flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updatedBadges = trustBadgesList.filter((_: any, i: number) => i !== bIdx);
                                handleSlideChange(idx, "trust_badges", updatedBadges);
                              }}
                              style={{ padding: "2px 4px", borderRadius: "3px", border: "none", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                            >
                              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Primary Button Card */}
                    <div style={{ display: "grid", gap: "3px", padding: "6px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>PRIMARY BUTTON</label>
                      <input
                        type="text"
                        placeholder="Label (Shop Now)"
                        value={slide.primary_cta?.label || ""}
                        onChange={(e) => handleSlideChange(idx, "primary_cta.label", e.target.value)}
                        style={sharedInputStyle()}
                      />
                      <input
                        type="text"
                        placeholder="Link URL (/products)"
                        value={slide.primary_cta?.href || ""}
                        onChange={(e) => handleSlideChange(idx, "primary_cta.href", e.target.value)}
                        style={sharedInputStyle()}
                      />
                    </div>

                    {/* Secondary Button Card */}
                    <div style={{ display: "grid", gap: "3px", padding: "6px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>SECONDARY BUTTON</label>
                      <input
                        type="text"
                        placeholder="Label (Explore)"
                        value={slide.secondary_cta?.label || ""}
                        onChange={(e) => handleSlideChange(idx, "secondary_cta.label", e.target.value)}
                        style={sharedInputStyle()}
                      />
                      <input
                        type="text"
                        placeholder="Link URL (/categories)"
                        value={slide.secondary_cta?.href || ""}
                        onChange={(e) => handleSlideChange(idx, "secondary_cta.href", e.target.value)}
                        style={sharedInputStyle()}
                      />
                    </div>

                    {/* Background Image Card */}
                    <div style={{ display: "grid", gap: "3px", padding: "6px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>BACKGROUND IMAGE URL</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={slide.background_image || ""}
                        onChange={(e) => handleSlideChange(idx, "background_image", e.target.value)}
                        style={sharedInputStyle()}
                      />
                    </div>
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
  const [activeTab, setActiveTab] = useState<"brand" | "search" | "layout" | "colors">("brand");

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

  // Values
  const brandDisplayMode = getVal("brand_display_mode", "both");
  const brandAlignment = getVal("brand_alignment", "left");
  const brandLayoutDirection = getVal("brand_layout_direction", "row");
  const brandName = getVal("brandName", "GreenHarvest");
  const logoUrl = getVal("logoUrl", "");
  const logoSize = Number(getVal("logo_size", 34));
  const logoZoom = Number(getVal("logo_zoom", 100));
  const brandFontFamily = getVal("brand_font_family", "sans_modern");
  const brandFontWeight = String(getVal("brand_font_weight", "700"));
  const brandFontStyle = getVal("brand_font_style", "normal");
  const brandFontSize = Number(getVal("brand_font_size", 18));
  const brandTextColor = getVal("brand_text_color", "#15803d");

  const searchDisplayMode = getVal("search_display_mode", "bar");
  const searchPlacement = getVal("search_placement", "center");
  const searchMaxWidth = Number(getVal("search_max_width", 420));
  const searchHeight = Number(getVal("search_height", 38));
  const searchTextColor = getVal("search_text_color", "#0f172a");
  const searchMutedTextColor = getVal("search_muted_text_color", "#64748b");

  const navbarVariant = getVal("navbar_variant", "glassmorphism");
  const navbarPosition = getVal("navbar_position", "sticky");
  const navbarHeight = Number(getVal("navbar_height", 72));
  const rawMaxWidth = String(getVal("navbar_max_width", "1280px"));
  const navbarMaxWidth = rawMaxWidth === "full" ? "100%" : rawMaxWidth;
  const navbarRadius = Number(getVal("navbar_radius", 16));
  const navbarPaddingX = Number(getVal("navbar_padding_x", 16));
  const navbarPaddingY = Number(getVal("navbar_padding_y", 12));

  const navbarBg = getVal("navbar_bg", "rgba(255, 255, 255, 0.85)");
  const navbarOuterBg = getVal("navbar_outer_bg", "transparent");
  const navbarTextColorVal = getVal("navbar_text_color", "#0f172a");
  const navbarBorderColor = getVal("navbar_border_color", "rgba(226, 232, 240, 0.8)");

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
              padding: "4px 3px",
              fontSize: "10px",
              fontWeight: active ? 700 : 500,
              borderRadius: "4px",
              border: "none",
              background: active ? "#ffffff" : "transparent",
              color: active ? "#0f172a" : "#64748b",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
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

    const clamp = (val: number) => Math.max(minRef.current, Math.min(maxRef.current, val));

    const attachWheel = useCallback((node: HTMLElement | null) => {
      if (!node) return;

      const handleWheel = (e: WheelEvent) => {
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
        ref={attachWheel}
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

        {/* Smooth micro-slider for continuous sliding or 2-finger wheel */}
        <input
          ref={attachWheel}
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

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 4 Clean Navigation Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
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
          { id: "colors", label: "Colors" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "5px 2px",
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

                <ModernColorPicker
                  label="Brand Color"
                  value={brandTextColor}
                  onChange={(val) => updateField("brand_text_color", val)}
                />
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

                <SectionDivider title="Colors" />

                <ModernColorPicker
                  label="Input Text Color"
                  value={searchTextColor}
                  onChange={(val) => updateField("search_text_color", val)}
                />

                <ModernColorPicker
                  label="Placeholder / Icon Color"
                  value={searchMutedTextColor}
                  onChange={(val) => updateField("search_muted_text_color", val)}
                />
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

      {/* TAB 4: COLORS & THEME */}
      {activeTab === "colors" && (
        <section style={sectionCardStyle(isLightMode)}>
          <div style={{ display: "grid", gap: "8px", width: "100%", boxSizing: "border-box" }}>
            <ModernColorPicker
              label="Navbar Background"
              value={navbarBg}
              onChange={(val) => updateField("navbar_bg", val)}
            />

            <ModernColorPicker
              label="Outer Background (Floating Mode)"
              value={navbarOuterBg}
              onChange={(val) => updateField("navbar_outer_bg", val)}
            />

            <ModernColorPicker
              label="Navbar Text & Icons Color"
              value={navbarTextColorVal}
              onChange={(val) => updateField("navbar_text_color", val)}
            />

            <ModernColorPicker
              label="Navbar Border Color"
              value={navbarBorderColor}
              onChange={(val) => updateField("navbar_border_color", val)}
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

  const handleSaveSnapshot = () => {
    const next = saveThemeSnapshot(siteDefinition, snapshotName);
    onSiteDefinitionChange(next);
    setSnapshotName("");
    setSnapshotFeedback("Saved!");
    setRefreshCounter((c) => c + 1);
    setTimeout(() => setSnapshotFeedback(null), 2000);
  };

  const handleDeleteSnapshot = (id: string) => {
    const next = deleteThemeSnapshot(siteDefinition, id);
    onSiteDefinitionChange(next);
    setRefreshCounter((c) => c + 1);
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
          {/* Saved Themes Section */}
          <section style={{ ...sectionCardStyle(isLightMode), boxSizing: "border-box", overflow: "hidden" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              SAVED THEMES SNAPSHOTS
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
                style={{ ...sharedInputStyle(), flex: 1, minWidth: 0, height: "24px", fontSize: "10.5px" }}
              />
              <button
                type="button"
                onClick={handleSaveSnapshot}
                style={{
                  padding: "0 8px",
                  height: "24px",
                  borderRadius: "4px",
                  border: "none",
                  background: snapshotFeedback ? "#10b981" : ADMIN_BLUE,
                  color: "#ffffff",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                {snapshotFeedback || "+ Save"}
              </button>
            </div>

            {savedSnapshots.length === 0 ? (
              <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center", padding: "4px 0" }}>
                No snapshots yet. Enter a name & click + Save.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "3px", marginTop: "1px", width: "100%", boxSizing: "border-box" }}>
                {savedSnapshots.map((snap: any) => {
                  const th = snap.theme || {};
                  return (
                    <div
                      key={snap.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "3px 5px",
                        borderRadius: "4px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        gap: "4px",
                        width: "100%",
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <div style={{ display: "flex", gap: "2px", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: th.primary_bg || "#ffffff", border: "1px solid #cbd5e1" }} title={`Primary: ${th.primary_bg || '#ffffff'}`} />
                          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: th.accent_color || "#2563eb", border: "1px solid #cbd5e1" }} title={`Accent: ${th.accent_color || '#2563eb'}`} />
                          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: th.navbar_bg || "#0f172a", border: "1px solid #cbd5e1" }} title={`Navbar: ${th.navbar_bg || '#0f172a'}`} />
                        </div>
                        <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>{snap.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => onSiteDefinitionChange(applyThemeSnapshot(siteDefinition, snap.id))}
                          style={{
                            padding: "2px 6px",
                            borderRadius: "3px",
                            border: "none",
                            background: ADMIN_BLUE,
                            color: "#ffffff",
                            fontSize: "9.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSnapshot(snap.id)}
                          style={{
                            padding: "2px 4px",
                            borderRadius: "3px",
                            border: "none",
                            background: "rgba(239,68,68,0.1)",
                            color: "#ef4444",
                            fontSize: "9px",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                          title="Delete Theme Snapshot"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                      ? "#0f172a"
                      : "transparent",
                  color:
                    siteDefinition.theme?.mode === "dark" ? "#ffffff" : "#64748b",
                  boxShadow: siteDefinition.theme?.mode === "dark" ? "0 1px 2px rgba(0,0,0,0.15)" : "none",
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
              FESTIVAL THEME (PRESET PALETTES)
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" }}>
              {[
                { key: "none", label: "None / Default", icon: "⚪" },
                { key: "diwali", label: "Diwali (Gold & Light)", icon: "🪔" },
                { key: "christmas", label: "Christmas (Evergreen)", icon: "🎄" },
                { key: "eid", label: "Eid (Emerald & Gold)", icon: "🌙" },
                { key: "holi", label: "Holi (Vibrant Colors)", icon: "🎨" },
                { key: "durga_puja", label: "Durga Puja (Crimson)", icon: "🔱" },
                { key: "rakhi", label: "Rakhi (Saffron & Ruby)", icon: "🧵" },
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
                      gap: "4px",
                      padding: "4px 6px",
                      borderRadius: "4px",
                      border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
                      background: active ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: active ? 700 : 500,
                      color: active ? "#1e40af" : "#334155",
                      transition: "all 0.12s ease",
                      gridColumn: item.key === "none" ? "1 / -1" : "span 1",
                    }}
                  >
                    <span>{item.icon}</span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Brand Palette Section */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              BRAND PALETTE
            </div>

            <div style={{ display: "grid", gap: "4px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Accent Color</label>
                {renderFieldControl(
                  { key: "accent_color", label: "Accent Color", type: "color", target: "theme" },
                  siteDefinition.theme?.accent_color || "#2563eb",
                  textColor,
                  isLightMode,
                  (val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { accent_color: val }))
                )}
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Background Color</label>
                {renderFieldControl(
                  { key: "primary_bg", label: "Primary Background", type: "color", target: "theme" },
                  siteDefinition.theme?.primary_bg || "#0f172a",
                  textColor,
                  isLightMode,
                  (val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { primary_bg: val }))
                )}
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Text Color</label>
                {renderFieldControl(
                  { key: "text_color", label: "Text Color", type: "color", target: "theme" },
                  siteDefinition.theme?.text_color || "#f9fafb",
                  textColor,
                  isLightMode,
                  (val) => onSiteDefinitionChange(updateThemeValues(siteDefinition, { text_color: val }))
                )}
              </div>
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
              {selectedBlock.type === "hero_banner" || selectedBlock.type === "herobanner" ? (
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