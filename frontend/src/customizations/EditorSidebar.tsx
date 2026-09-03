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
      return customHome.blocks.map((b: any) => {
        const bType = String(b.type || "").toLowerCase();
        const bId = String(b.id || "").toLowerCase();
        let displayName = "Section";

        if (bType === "navbar" || bType === "header" || bId === "navbar") {
          displayName = "Navbar";
        } else if (
          bType === "hero_banner" ||
          bType === "herobanner" ||
          bType === "hero" ||
          bType === "banner" ||
          bId.includes("hero")
        ) {
          displayName = "Hero Banner";
        } else if (
          bType === "product_grid" ||
          bType === "productgrid" ||
          bId === "product_grid" ||
          bId.includes("product_grid")
        ) {
          displayName = "Product Grid";
        } else if (bType === "footer" || bId === "footer") {
          displayName = "Footer";
        } else if (
          bType === "product_carousel" ||
          bType === "productcarousel" ||
          bType === "products_carousel"
        ) {
          displayName = b.props?.title || b.name || "Product Carousel";
        } else if (
          bType === "section_group_carousel" ||
          bType === "sectiongroupcarousel"
        ) {
          displayName = b.props?.title || b.name || "Category Carousel";
        } else if (bType === "category_grid" || bType === "categorygrid") {
          displayName = b.props?.title || b.name || "Category Grid";
        } else if (bType === "category_strip") {
          displayName = b.props?.title || b.name || "Category Strip";
        } else if (bType === "trust_badges") {
          displayName = "Trust Badges";
        } else {
          displayName = b.name || b.props?.title || b.type;
        }

        return {
          id: b.id || b.type,
          type: b.type,
          name: displayName,
        };
      });
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
        { id: "checkout_steps", type: "checkout_steps", name: "Checkout Steps" },
        { id: "delivery_form", type: "delivery_form", name: "Delivery Form" },
        { id: "delivery_map_picker", type: "delivery_map_picker", name: "Map Location Picker" },
        { id: "delivery_address_form", type: "delivery_address_form", name: "Add / Edit Address Form" },
        { id: "payment_methods", type: "payment_methods", name: "Payment Methods" },
        { id: "checkout_order_summary", type: "checkout_order_summary", name: "Order Summary" },
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

  // 1. Color Palette: Any color picker or color/bg/border key
  if (
    field.type === "color" ||
    ["_color", "_bg", "background", "border_color", "accent", "muted_text", "soft_text", "placeholder_color"].some(
      (k) => key.includes(k) || label.includes(k)
    )
  ) {
    return "COLOR PALETTE";
  }

  // 2. Layout & Spacing: Any dimensions, radii, padding, gap, max width, alignment
  if (
    [
      "radius",
      "padding",
      "gap",
      "width",
      "height",
      "max_width",
      "position",
      "align",
      "columns",
      "grid",
      "layout",
      "aspect_ratio",
      "fit",
    ].some((k) => key.includes(k) || label.includes(k))
  ) {
    return "LAYOUT & SPACING";
  }

  // 3. Brand & Search specific categories if applicable
  if (["brandname", "logo", "tagline", "storename"].some((k) => key.includes(k) || label.includes(k))) {
    return "BRAND & IDENTITY";
  }
  if (key.includes("search") && !key.includes("placeholder") && !key.includes("radius") && !key.includes("bg") && !key.includes("color")) {
    return "SEARCH BAR";
  }

  // 4. Feature Toggles
  if (
    field.type === "checkbox" ||
    ["showaccount", "showcart", "enable"].some((k) => key.includes(k) || label.includes(k))
  ) {
    return "ACTIONS & TOGGLES";
  }

  // 5. Default to Settings & Content
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
    const activeVal =
      currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== ""
        ? String(currentValue)
        : field.defaultValue !== undefined && field.defaultValue !== null
        ? String(field.defaultValue)
        : field.placeholder || "";

    return (
      <input
        type="text"
        value={typeof currentValue === "string" && currentValue !== "" ? currentValue : activeVal}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    );
  }

  if (field.type === "textarea") {
    const activeVal =
      currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== ""
        ? String(currentValue)
        : field.defaultValue !== undefined && field.defaultValue !== null
        ? String(field.defaultValue)
        : field.placeholder || "";

    return (
      <textarea
        value={typeof currentValue === "string" && currentValue !== "" ? currentValue : activeVal}
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
}) => {
  const isCompact = options.length >= 4;
  const isVeryCompact = options.length >= 5;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
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
            title={opt.label}
            style={{
              padding: isVeryCompact ? "4px 1px" : isCompact ? "4px 2px" : "4px 4px",
              fontSize: isVeryCompact ? "9px" : isCompact ? "9.5px" : "10px",
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "all 0.12s ease",
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

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
  const [inputValue, setInputValue] = useState(String(value ?? ""));

  useEffect(() => {
    if (!isFocusedRef.current) {
      setInputValue(String(value ?? ""));
    }
  }, [value]);

  const clamp = (val: number) => Math.max(minRef.current, Math.min(maxRef.current, val));

  const attachWheel = useCallback((node: HTMLInputElement | null) => {
    if (!node) return;

    const handleWheel = (e: WheelEvent) => {
      // ONLY change number if the input is currently clicked / focused!
      if (!isFocusedRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? stepRef.current : -stepRef.current;
      const current = typeof valueRef.current === "number" ? valueRef.current : parseFloat(String(valueRef.current)) || 0;
      const nextVal = Math.max(
        minRef.current,
        Math.min(maxRef.current, Number((current + delta).toFixed(2)))
      );
      if (nextVal !== valueRef.current) {
        setInputValue(String(nextVal));
        onChangeRef.current(nextVal);
      }
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = clamp(Number((value + step).toFixed(2)));
      setInputValue(String(next));
      onChange(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = clamp(Number((value - step).toFixed(2)));
      setInputValue(String(next));
      onChange(next);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      setInputValue(String(value));
    } else {
      const clamped = clamp(parsed);
      setInputValue(String(clamped));
      if (clamped !== value) {
        onChange(clamped);
      }
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
          onClick={() => {
            const next = clamp(Number((value - step).toFixed(2)));
            setInputValue(String(next));
            onChange(next);
          }}
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
          value={inputValue}
          onWheel={(e) => e.preventDefault()}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const raw = e.target.value;
            setInputValue(raw);
            const parsed = parseFloat(raw);
            if (!isNaN(parsed) && parsed >= min && parsed <= max) {
              onChange(parsed);
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
            color: "#0f172a",
            background: "#ffffff",
          }}
        />

        <button
          type="button"
          onClick={() => {
            const next = clamp(Number((value + step).toFixed(2)));
            setInputValue(String(next));
            onChange(next);
          }}
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
        onChange={(e) => {
          const next = clamp(Number(e.target.value));
          setInputValue(String(next));
          onChange(next);
        }}
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

function SectionGroupCarouselEditor({
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
  const [activeTab, setActiveTab] = useState<"layout" | "styling">("layout");

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => ({
        ...page,
        blocks: (page.blocks ?? []).map((block: any) => {
          if (block.id === selectedBlock.id) {
            return {
              ...block,
              props: {
                ...(block.props ?? {}),
                ...patch,
              },
            };
          }
          return block;
        }),
      }));
    }
    onSiteDefinitionChange(nextDef);
  };

  const cardShape = currentProps.cardShape || "portrait";
  const layout = currentProps.layout || "carousel";

  const defaultWidthForShape = (s: string) => {
    switch (s) {
      case "circle": return 120;
      case "horizontal": return 280;
      case "square": return 180;
      case "pill": return 140;
      case "portrait":
      default: return 200;
    }
  };

  const defaultHeightForShape = (s: string) => {
    switch (s) {
      case "circle": return 120;
      case "horizontal": return 155;
      case "square": return 180;
      case "pill": return 95;
      case "portrait":
      default: return 260;
    }
  };

  const currentCardWidth =
    currentProps.card_width !== undefined && currentProps.card_width !== null
      ? typeof currentProps.card_width === "number"
        ? currentProps.card_width
        : parseInt(String(currentProps.card_width), 10) || defaultWidthForShape(cardShape)
      : defaultWidthForShape(cardShape);

  const currentCardHeight =
    currentProps.card_height !== undefined && currentProps.card_height !== null
      ? typeof currentProps.card_height === "number"
        ? currentProps.card_height
        : parseInt(String(currentProps.card_height), 10) || defaultHeightForShape(cardShape)
      : defaultHeightForShape(cardShape);

  const handleShapePresetChange = (shape: string) => {
    updateProps({
      cardShape: shape,
      card_width: defaultWidthForShape(shape),
      card_height: defaultHeightForShape(shape),
    });
  };

  const parsedTitleSize = parseInt(String(currentProps.title_font_size || "20"), 10) || 20;
  const parsedSubtitleSize = parseInt(String(currentProps.subtitle_font_size || "13"), 10) || 13;
  const parsedCardTitleSize = parseInt(String(currentProps.card_title_size || "15"), 10) || 15;

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 2 Clean Navigation Tabs matching Navbar theme */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
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
          { id: "layout", label: "Layout" },
          { id: "styling", label: "Styles" },
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

      {/* 1. LAYOUT & STRUCTURE TAB */}
      {activeTab === "layout" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Card Shape & Custom Dimensions */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Card Dimensions & Shape
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Shape Preset
                </label>
                <SegmentedRow
                  value={cardShape}
                  onChange={handleShapePresetChange}
                  options={[
                    { label: "Portrait", value: "portrait" },
                    { label: "Square", value: "square" },
                    { label: "Wide", value: "horizontal" },
                    { label: "Circle", value: "circle" },
                    { label: "Pill", value: "pill" },
                  ]}
                />
              </div>

              {/* Dual Width & Height Steppers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Card Width"
                  value={currentCardWidth}
                  min={60}
                  max={500}
                  step={5}
                  unit="px"
                  onChange={(val) => updateProps({ card_width: val })}
                />
                <NumberStepperField
                  label="Card Height"
                  value={currentCardHeight}
                  min={60}
                  max={500}
                  step={5}
                  unit="px"
                  onChange={(val) => updateProps({ card_height: val })}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Display Mode
                </label>
                <SegmentedRow
                  value={layout}
                  onChange={(val) => updateProps({ layout: val })}
                  options={[
                    { label: "Carousel", value: "carousel" },
                    { label: "Grid", value: "grid" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Card Text Placement
                </label>
                <SegmentedRow
                  value={currentProps.card_text_position || "bottom_overlay"}
                  onChange={(val) => updateProps({ card_text_position: val })}
                  options={[
                    { label: "Bottom", value: "bottom_overlay" },
                    { label: "Top", value: "top_overlay" },
                    { label: "Center", value: "center_overlay" },
                    { label: "Below", value: "below_card" },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Bounds, Spacing & Padding */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Spacing & Bounds
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Max Width
                  </label>
                  <CustomSelectDropdown
                    value={currentProps.max_width || "full"}
                    placeholder="Max Width"
                    options={[
                      { label: "Full Width (100%)", value: "full" },
                      { label: "Extra Wide (1440px)", value: "1440px" },
                      { label: "Wide (1280px)", value: "1280px" },
                      { label: "Standard (1200px)", value: "1200px" },
                    ]}
                    onChange={(val) => updateProps({ max_width: val })}
                  />
                </div>

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Card Gap
                  </label>
                  <CustomSelectDropdown
                    value={String(currentProps.grid_gap || currentProps.gap || "16px")}
                    placeholder="Gap"
                    options={[
                      { label: "Compact (8px)", value: "8px" },
                      { label: "Standard (14px)", value: "14px" },
                      { label: "Spacious (20px)", value: "20px" },
                      { label: "Wide (28px)", value: "28px" },
                    ]}
                    onChange={(val) => updateProps({ grid_gap: val, gap: val })}
                  />
                </div>
              </div>

              {/* Vertical & Horizontal Padding */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Vertical Padding"
                  value={
                    currentProps.padding_y !== undefined && currentProps.padding_y !== null && String(currentProps.padding_y).trim() !== ""
                      ? !isNaN(parseInt(String(currentProps.padding_y), 10))
                        ? parseInt(String(currentProps.padding_y), 10)
                        : 12
                      : 12
                  }
                  min={0}
                  max={80}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ padding_y: `${val}px` })}
                />
                <NumberStepperField
                  label="Horizontal Padding"
                  value={parseInt(String(currentProps.padding_x || "16"), 10) || 16}
                  min={4}
                  max={48}
                  step={4}
                  unit="px"
                  onChange={(val) => updateProps({ padding_x: `${val}px` })}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. TYPOGRAPHY & STYLES TAB */}
      {activeTab === "styling" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Header Typography */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Header Typography & Alignment
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Title Alignment
                </label>
                <SegmentedRow
                  value={currentProps.title_alignment || "left"}
                  onChange={(val) => updateProps({ title_alignment: val })}
                  options={[
                    { label: "Left", value: "left" },
                    { label: "Center", value: "center" },
                    { label: "Right", value: "right" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Title Size"
                  value={parsedTitleSize}
                  min={14}
                  max={36}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ title_font_size: `${val}px` })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Title Weight
                  </label>
                  <CustomSelectDropdown
                    value={String(currentProps.title_font_weight || "800")}
                    placeholder="Weight"
                    options={[
                      { label: "Semi-Bold (600)", value: "600" },
                      { label: "Bold (700)", value: "700" },
                      { label: "Extra Bold (800)", value: "800" },
                      { label: "Black (900)", value: "900" },
                    ]}
                    onChange={(val) => updateProps({ title_font_weight: val })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Letter Case
                  </label>
                  <SegmentedRow
                    value={currentProps.title_text_transform || "none"}
                    onChange={(val) => updateProps({ title_text_transform: val })}
                    options={[
                      { label: "Normal", value: "none" },
                      { label: "Caps", value: "uppercase" },
                    ]}
                  />
                </div>

                <NumberStepperField
                  label="Subtitle Size"
                  value={parsedSubtitleSize}
                  min={10}
                  max={20}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ subtitle_font_size: `${val}px` })}
                />
              </div>
            </div>
          </section>

          {/* Card Typography & Badge */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Card Typography & Badge
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Card Title Size"
                  value={parsedCardTitleSize}
                  min={11}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ card_title_size: `${val}px` })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Card Title Weight
                  </label>
                  <CustomSelectDropdown
                    value={String(currentProps.card_title_weight || "800")}
                    placeholder="Weight"
                    options={[
                      { label: "Medium (500)", value: "500" },
                      { label: "Semi-Bold (600)", value: "600" },
                      { label: "Bold (700)", value: "700" },
                      { label: "Heavy (800)", value: "800" },
                    ]}
                    onChange={(val) => updateProps({ card_title_weight: val })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Card Text Align
                  </label>
                  <SegmentedRow
                    value={currentProps.card_title_align || "left"}
                    onChange={(val) => updateProps({ card_title_align: val })}
                    options={[
                      { label: "Left", value: "left" },
                      { label: "Center", value: "center" },
                      { label: "Right", value: "right" },
                    ]}
                  />
                </div>

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Badge Tag Style
                  </label>
                  <CustomSelectDropdown
                    value={currentProps.badge_style || "pill"}
                    placeholder="Badge Style"
                    options={[
                      { label: "Pill (Rounded)", value: "pill" },
                      { label: "Corner Tag", value: "square" },
                      { label: "Minimal Clean", value: "minimal" },
                      { label: "Hidden", value: "hidden" },
                    ]}
                    onChange={(val) => updateProps({ badge_style: val })}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Visual Effects & Colors */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Visual Styling & Colors
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Image Fit
                </label>
                <SegmentedRow
                  value={currentProps.image_fit || "cover"}
                  onChange={(val) => updateProps({ image_fit: val })}
                  options={[
                    { label: "Cover", value: "cover" },
                    { label: "Contain", value: "contain" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Corner Radius"
                  value={
                    currentProps.card_radius !== undefined && currentProps.card_radius !== null && String(currentProps.card_radius).trim() !== ""
                      ? !isNaN(parseInt(String(currentProps.card_radius), 10))
                        ? parseInt(String(currentProps.card_radius), 10)
                        : 14
                      : 14
                  }
                  min={0}
                  max={48}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ card_radius: `${val}px` })}
                />

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Card Shadow
                  </label>
                  <CustomSelectDropdown
                    value={currentProps.card_shadow || "subtle"}
                    placeholder="Shadow"
                    options={[
                      { label: "None", value: "none" },
                      { label: "Subtle (Crisp)", value: "subtle" },
                      { label: "Soft (Floating)", value: "soft" },
                      { label: "Elevated (Deep)", value: "elevated" },
                    ]}
                    onChange={(val) => updateProps({ card_shadow: val })}
                  />
                </div>
              </div>

              <SectionDivider title="Theme Colors" />

              <CompactColorRow
                label="Section Background"
                value={currentProps.outer_bg_color || "transparent"}
                onChange={(val) => updateProps({ outer_bg_color: val })}
              />

              <CompactColorRow
                label="Card Background"
                value={currentProps.card_bg_color || siteDefinition.theme?.card_bg || "#ffffff"}
                onChange={(val) => updateProps({ card_bg_color: val })}
              />

              <CompactColorRow
                label="Card Border Color"
                value={currentProps.card_border_color || siteDefinition.theme?.card_border_color || "rgba(226, 232, 240, 0.8)"}
                onChange={(val) => updateProps({ card_border_color: val })}
              />

              <CompactColorRow
                label="Title Color"
                value={currentProps.title_color || siteDefinition.theme?.text_color || "#0f172a"}
                onChange={(val) => updateProps({ title_color: val })}
              />

              <CompactColorRow
                label="Subtitle Color"
                value={currentProps.subtitle_color || siteDefinition.theme?.muted_text_color || "#64748b"}
                onChange={(val) => updateProps({ subtitle_color: val })}
              />

              <CompactColorRow
                label="Accent & Ring Color"
                value={currentProps.accent_color || siteDefinition.theme?.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ accent_color: val })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ProductCarouselEditor({
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
  const [activeTab, setActiveTab] = useState<"layout" | "styling">("layout");
  const p = selectedBlock.props ?? {};

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => ({
        ...page,
        blocks: (page.blocks ?? []).map((block: any) =>
          block.id === selectedBlock.id
            ? { ...block, props: { ...(block.props ?? {}), ...patch } }
            : block
        ),
      }));
    }
    onSiteDefinitionChange(nextDef);
  };

  const cardStyleKey = String(p.card_style || p.theme_card_style || "fashion").toLowerCase();
  const isGrocery = cardStyleKey === "grocery";
  const minCardWidth = isGrocery ? 220 : 140;
  const maxCardWidth = isGrocery ? 320 : 280;
  const defaultCardWidth = isGrocery ? 280 : 190;

  const parsedCardWidth = (() => {
    const v = p.card_width;
    if (v === undefined || v === null || String(v).trim() === "") return defaultCardWidth;
    const n = typeof v === "number" ? v : parseInt(String(v), 10) || defaultCardWidth;
    return Math.max(minCardWidth, Math.min(maxCardWidth, n));
  })();

  const parsedTitleSize = parseInt(String(p.title_font_size || "20"), 10) || 20;
  const parsedSubtitleSize = parseInt(String(p.subtitle_font_size || "13"), 10) || 13;
  const parsedProductNameSize = parseInt(String(p.product_name_font_size || p.product_title_font_size || "14"), 10) || 14;

  const parsedImageRadius = (() => {
    const v = p.image_radius ?? p.image_corner_radius;
    if (v === undefined || v === null || String(v).trim() === "") return 12;
    const num = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(num) ? 12 : num;
  })();

  const parsedCardRadius = (() => {
    const v = p.card_radius;
    if (v === undefined || v === null || String(v).trim() === "") return 18;
    const num = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(num) ? 18 : num;
  })();

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Tab Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "2px", background: "#f1f5f9", padding: "2px", borderRadius: "6px", boxSizing: "border-box" }}>
        {[{ id: "layout", label: "Layout" }, { id: "styling", label: "Styles" }].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "5px 4px", border: "none", borderRadius: "4px",
                background: isActive ? "#ffffff" : "transparent",
                color: isActive ? ADMIN_BLUE : "#64748b",
                fontWeight: isActive ? 800 : 600, fontSize: "10px",
                cursor: "pointer", textAlign: "center",
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.12s ease", whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Layout Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "layout" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Layout & Card Size</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Display Mode</label>
                <SegmentedRow
                  value={p.layout || "carousel"}
                  onChange={(val) => updateProps({ layout: val })}
                  options={[{ label: "Carousel", value: "carousel" }, { label: "Grid", value: "grid" }]}
                />
              </div>
              <NumberStepperField
                label="Card Size" value={parsedCardWidth} min={minCardWidth} max={maxCardWidth} step={10} unit="px"
                onChange={(val) => updateProps({ card_width: `${val}px` })}
              />
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Image Fitting</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Image Fit</label>
                <SegmentedRow
                  value={p.image_fit || "cover"}
                  onChange={(val) => updateProps({ image_fit: val })}
                  options={[{ label: "Cover", value: "cover" }, { label: "Contain", value: "contain" }]}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Aspect Ratio</label>
                  <CustomSelectDropdown
                    value={p.image_aspect_ratio || "3 / 4"}
                    placeholder="Aspect Ratio"
                    options={[
                      { label: "1:1  Square", value: "1 / 1" },
                      { label: "3:4  Portrait", value: "3 / 4" },
                      { label: "4:3  Standard", value: "4 / 3" },
                      { label: "16:9 Wide", value: "16 / 9" },
                      { label: "2:3  Tall", value: "2 / 3" },
                    ]}
                    onChange={(val) => updateProps({ image_aspect_ratio: val })}
                  />
                </div>
                <NumberStepperField
                  label="Image Radius"
                  value={parsedImageRadius}
                  min={0}
                  max={36}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ image_radius: `${val}px`, image_corner_radius: `${val}px` })}
                />
              </div>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Spacing & Bounds</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Max Width</label>
                  <CustomSelectDropdown
                    value={p.max_width || "full"}
                    placeholder="Max Width"
                    options={[
                      { label: "Full Width (100%)", value: "full" },
                      { label: "1440px", value: "1440px" },
                      { label: "1280px", value: "1280px" },
                      { label: "1200px", value: "1200px" },
                    ]}
                    onChange={(val) => updateProps({ max_width: val })}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Card Gap</label>
                  <CustomSelectDropdown
                    value={String(p.gap || p.grid_gap || "14px")}
                    placeholder="Gap"
                    options={[
                      { label: "Compact 8px", value: "8px" },
                      { label: "Default 14px", value: "14px" },
                      { label: "Spacious 20px", value: "20px" },
                      { label: "Wide 28px", value: "28px" },
                    ]}
                    onChange={(val) => updateProps({ gap: val, grid_gap: val })}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Vertical Pad"
                  value={
                    p.padding_y !== undefined && p.padding_y !== null && String(p.padding_y).trim() !== ""
                      ? !isNaN(parseInt(String(p.padding_y), 10))
                        ? parseInt(String(p.padding_y), 10)
                        : 12
                      : 12
                  }
                  min={0}
                  max={80}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ padding_y: `${val}px` })}
                />
                <NumberStepperField
                  label="Horiz. Pad" value={parseInt(String(p.padding_x || "16"), 10) || 16}
                  min={4} max={48} step={4} unit="px"
                  onChange={(val) => updateProps({ padding_x: `${val}px` })}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Styles Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "styling" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Section Header</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Title Alignment</label>
                <SegmentedRow
                  value={p.title_alignment || "left"}
                  onChange={(val) => updateProps({ title_alignment: val })}
                  options={[{ label: "Left", value: "left" }, { label: "Center", value: "center" }]}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Title Size" value={parsedTitleSize} min={14} max={36} step={1} unit="px"
                  onChange={(val) => updateProps({ title_font_size: `${val}px` })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Title Weight</label>
                  <CustomSelectDropdown
                    value={String(p.title_font_weight || "800")}
                    placeholder="Weight"
                    options={[
                      { label: "SemiBold 600", value: "600" },
                      { label: "Bold 700", value: "700" },
                      { label: "ExtraBold 800", value: "800" },
                      { label: "Black 900", value: "900" },
                    ]}
                    onChange={(val) => updateProps({ title_font_weight: val })}
                  />
                </div>
              </div>
              <NumberStepperField
                label="Subtitle Size" value={parsedSubtitleSize} min={10} max={20} step={1} unit="px"
                onChange={(val) => updateProps({ subtitle_font_size: `${val}px` })}
              />
            </div>
          </section>

          {/* Product Title / Card Text Styling */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Product Title & Font</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Font Family</label>
                <CustomSelectDropdown
                  value={p.product_name_font_family || p.product_title_font_family || "sans_modern"}
                  placeholder="Font"
                  options={[
                    { label: "Inter (Modern Sans)", value: "sans_modern" },
                    { label: "Roboto (Sans)", value: "roboto_sans" },
                    { label: "Outfit (Tech)", value: "outfit_tech" },
                    { label: "Plus Jakarta", value: "plus_jakarta" },
                    { label: "Poppins (Rounded)", value: "poppins_rounded" },
                    { label: "Montserrat", value: "montserrat_bold" },
                    { label: "Space Grotesk", value: "space_grotesk" },
                    { label: "Playfair (Serif)", value: "playfair_serif" },
                    { label: "Cinzel (Display)", value: "cinzel_display" },
                    { label: "Cormorant (Serif)", value: "cormorant_serif" },
                  ]}
                  onChange={(val) => updateProps({ product_name_font_family: val, product_title_font_family: val })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Font Size"
                  value={parsedProductNameSize}
                  min={11}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ product_name_font_size: `${val}px`, product_title_font_size: `${val}px` })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Font Weight</label>
                  <CustomSelectDropdown
                    value={String(p.product_name_font_weight || p.product_title_font_weight || "700")}
                    placeholder="Weight"
                    options={[
                      { label: "Regular 400", value: "400" },
                      { label: "Medium 500", value: "500" },
                      { label: "SemiBold 600", value: "600" },
                      { label: "Bold 700", value: "700" },
                      { label: "ExtraBold 800", value: "800" },
                    ]}
                    onChange={(val) => updateProps({ product_name_font_weight: val, product_title_font_weight: val })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Font Style</label>
                <SegmentedRow
                  value={p.product_name_font_style || p.product_title_font_style || "normal"}
                  onChange={(val) => updateProps({ product_name_font_style: val, product_title_font_style: val })}
                  options={[{ label: "Normal", value: "normal" }, { label: "Italic", value: "italic" }]}
                />
              </div>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Card Visibility</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {[
                { label: "Title", key: "show_title" },
                { label: "Subtitle", key: "show_subtitle" },
                { label: "View All", key: "show_view_all" },
                { label: "Badge", key: "show_discount_badge" },
                { label: "Ratings", key: "show_ratings" },
                { label: "Brand", key: "show_brand_name" },
                { label: "Old Price", key: "show_original_price" },
                { label: "Stock", key: "show_stock_badge" },
              ].map(({ label, key }) => (
                <div key={key} style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{label}</label>
                  <SegmentedRow
                    value={p[key] !== false ? "on" : "off"}
                    onChange={(val) => updateProps({ [key]: val === "on" })}
                    options={[{ label: "On", value: "on" }, { label: "Off", value: "off" }]}
                  />
                </div>
              ))}
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Visual Effects & Colors</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Corner Radius" value={parsedCardRadius} min={0} max={48} step={2} unit="px"
                  onChange={(val) => updateProps({ card_radius: `${val}px` })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Card Shadow</label>
                  <CustomSelectDropdown
                    value={p.card_shadow || "soft"}
                    placeholder="Shadow"
                    options={[
                      { label: "None", value: "none" },
                      { label: "Subtle", value: "subtle" },
                      { label: "Soft", value: "soft" },
                      { label: "Elevated", value: "elevated" },
                    ]}
                    onChange={(val) => updateProps({ card_shadow: val })}
                  />
                </div>
              </div>
              <SectionDivider title="Theme Colors" />
              <CompactColorRow label="Section BG" value={p.outer_bg_color || "transparent"} onChange={(val) => updateProps({ outer_bg_color: val })} />
              <CompactColorRow label="Card BG" value={p.card_bg_color || siteDefinition.theme?.card_bg || "#ffffff"} onChange={(val) => updateProps({ card_bg_color: val })} />
              <CompactColorRow label="Card Border" value={p.card_border_color || siteDefinition.theme?.card_border_color || "rgba(226,232,240,0.8)"} onChange={(val) => updateProps({ card_border_color: val })} />
              <CompactColorRow label="Image BG" value={p.image_bg || (isLightMode ? "#f8fafc" : "rgba(255,255,255,0.04)")} onChange={(val) => updateProps({ image_bg: val })} />
              <CompactColorRow label="Section Title" value={p.title_color || siteDefinition.theme?.text_color || "#0f172a"} onChange={(val) => updateProps({ title_color: val })} />
              <CompactColorRow label="Product Title" value={p.product_name_color || p.product_title_color || p.title_color || siteDefinition.theme?.text_color || "#0f172a"} onChange={(val) => updateProps({ product_name_color: val, product_title_color: val, title_color: val })} />
              <CompactColorRow label="Brand Label" value={p.brand_color || siteDefinition.theme?.muted_text_color || "#64748b"} onChange={(val) => updateProps({ brand_color: val })} />
              <CompactColorRow label="Price Color" value={p.price_color || siteDefinition.theme?.text_color || "#0f172a"} onChange={(val) => updateProps({ price_color: val })} />
              <CompactColorRow label="Old Price" value={p.original_price_color || siteDefinition.theme?.muted_text_color || "#94a3b8"} onChange={(val) => updateProps({ original_price_color: val })} />
              <CompactColorRow label="Star Color" value={p.rating_star_color || "#d97706"} onChange={(val) => updateProps({ rating_star_color: val })} />
              <CompactColorRow label="Accent" value={p.accent_color || siteDefinition.theme?.accent_color || ADMIN_BLUE} onChange={(val) => updateProps({ accent_color: val })} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ProductGridEditor({
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
  const [activeTab, setActiveTab] = useState<"layout" | "styling">("layout");
  const p = selectedBlock.props ?? {};

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => ({
        ...page,
        blocks: (page.blocks ?? []).map((block: any) =>
          block.id === selectedBlock.id
            ? { ...block, props: { ...(block.props ?? {}), ...patch } }
            : block
        ),
      }));
    }
    onSiteDefinitionChange(nextDef);
  };

  const parsedProductNameSize =
    parseInt(String(p.product_name_font_size || p.product_title_font_size || "15"), 10) || 15;

  const parsedImageRadius = (() => {
    const v = p.image_radius ?? p.image_corner_radius;
    if (v === undefined || v === null || String(v).trim() === "") return 12;
    const num = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(num) ? 12 : num;
  })();

  const parsedCardRadius = (() => {
    const v = p.card_radius;
    if (v === undefined || v === null || String(v).trim() === "") return 18;
    const num = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(num) ? 18 : num;
  })();

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Tab Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "2px", background: "#f1f5f9", padding: "2px", borderRadius: "6px", boxSizing: "border-box" }}>
        {[{ id: "layout", label: "Layout" }, { id: "styling", label: "Styles" }].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "5px 4px", border: "none", borderRadius: "4px",
                background: isActive ? "#ffffff" : "transparent",
                color: isActive ? ADMIN_BLUE : "#64748b",
                fontWeight: isActive ? 800 : 600, fontSize: "10px",
                cursor: "pointer", textAlign: "center",
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.12s ease", whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Layout Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "layout" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Card Style & Preset</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Card Style</label>
                <CustomSelectDropdown
                  value={p.card_style || p.cardStyle || "default"}
                  placeholder="Card Style"
                  options={[
                    { label: `Store Theme Default (${(siteDefinition.theme?.card_style || "fashion").toUpperCase()})`, value: "default" },
                    { label: "Grocery & Daily Needs (Horizontal Row)", value: "grocery" },
                    { label: "Fashion & Apparel (3:4 Portrait)", value: "fashion" },
                    { label: "Electronics & Tech (4:3 Landscape)", value: "electronics" },
                    { label: "Beauty & Minimal (1:1 Rounded)", value: "beauty" },
                    { label: "Standard Square (1:1)", value: "standard" },
                    { label: "Books & Stationery", value: "books" },
                  ]}
                  onChange={(val) => updateProps({ card_style: val, cardStyle: val })}
                />
              </div>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Spacing & Bounds</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Max Width</label>
                  <CustomSelectDropdown
                    value={p.max_width || "full"}
                    placeholder="Max Width"
                    options={[
                      { label: "Full Width (100%)", value: "full" },
                      { label: "1440px", value: "1440px" },
                      { label: "1280px", value: "1280px" },
                      { label: "1200px", value: "1200px" },
                    ]}
                    onChange={(val) => updateProps({ max_width: val })}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Grid Gap</label>
                  <CustomSelectDropdown
                    value={String(p.gap || p.grid_gap || "16px")}
                    placeholder="Gap"
                    options={[
                      { label: "Compact 8px", value: "8px" },
                      { label: "Default 16px", value: "16px" },
                      { label: "Spacious 20px", value: "20px" },
                      { label: "Wide 28px", value: "28px" },
                    ]}
                    onChange={(val) => updateProps({ gap: val, grid_gap: val })}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Vertical Pad"
                  value={
                    p.padding_y !== undefined && p.padding_y !== null && String(p.padding_y).trim() !== ""
                      ? !isNaN(parseInt(String(p.padding_y), 10))
                        ? parseInt(String(p.padding_y), 10)
                        : 12
                      : 12
                  }
                  min={0}
                  max={80}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ padding_y: `${val}px` })}
                />
                <NumberStepperField
                  label="Horiz. Pad" value={parseInt(String(p.padding_x || "16"), 10) || 16}
                  min={4} max={48} step={4} unit="px"
                  onChange={(val) => updateProps({ padding_x: `${val}px` })}
                />
              </div>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Image Fitting</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Image Fit</label>
                <SegmentedRow
                  value={p.image_fit || "cover"}
                  onChange={(val) => updateProps({ image_fit: val })}
                  options={[{ label: "Cover", value: "cover" }, { label: "Contain", value: "contain" }]}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Aspect Ratio</label>
                  <CustomSelectDropdown
                    value={p.image_aspect_ratio || "3 / 4"}
                    placeholder="Aspect Ratio"
                    options={[
                      { label: "1:1  Square", value: "1 / 1" },
                      { label: "3:4  Portrait", value: "3 / 4" },
                      { label: "4:3  Standard", value: "4 / 3" },
                      { label: "16:9 Wide", value: "16 / 9" },
                      { label: "2:3  Tall", value: "2 / 3" },
                    ]}
                    onChange={(val) => updateProps({ image_aspect_ratio: val })}
                  />
                </div>
                <NumberStepperField
                  label="Image Radius"
                  value={parsedImageRadius}
                  min={0}
                  max={36}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ image_radius: `${val}px`, image_corner_radius: `${val}px` })}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Styles Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "styling" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Product Title / Card Text Styling */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Product Title & Font</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Font Family</label>
                <CustomSelectDropdown
                  value={p.product_name_font_family || p.product_title_font_family || "sans_modern"}
                  placeholder="Font"
                  options={[
                    { label: "Inter (Modern Sans)", value: "sans_modern" },
                    { label: "Roboto (Sans)", value: "roboto_sans" },
                    { label: "Outfit (Tech)", value: "outfit_tech" },
                    { label: "Plus Jakarta", value: "plus_jakarta" },
                    { label: "Poppins (Rounded)", value: "poppins_rounded" },
                    { label: "Montserrat", value: "montserrat_bold" },
                    { label: "Space Grotesk", value: "space_grotesk" },
                    { label: "Playfair (Serif)", value: "playfair_serif" },
                    { label: "Cinzel (Display)", value: "cinzel_display" },
                    { label: "Cormorant (Serif)", value: "cormorant_serif" },
                  ]}
                  onChange={(val) => updateProps({ product_name_font_family: val, product_title_font_family: val })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Font Size"
                  value={parsedProductNameSize}
                  min={11}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ product_name_font_size: `${val}px`, product_title_font_size: `${val}px` })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Font Weight</label>
                  <CustomSelectDropdown
                    value={String(p.product_name_font_weight || p.product_title_font_weight || "700")}
                    placeholder="Weight"
                    options={[
                      { label: "Regular 400", value: "400" },
                      { label: "Medium 500", value: "500" },
                      { label: "SemiBold 600", value: "600" },
                      { label: "Bold 700", value: "700" },
                      { label: "ExtraBold 800", value: "800" },
                    ]}
                    onChange={(val) => updateProps({ product_name_font_weight: val, product_title_font_weight: val })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Font Style</label>
                <SegmentedRow
                  value={p.product_name_font_style || p.product_title_font_style || "normal"}
                  onChange={(val) => updateProps({ product_name_font_style: val, product_title_font_style: val })}
                  options={[{ label: "Normal", value: "normal" }, { label: "Italic", value: "italic" }]}
                />
              </div>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Card Visibility</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {[
                { label: "Badge", key: "show_discount_badge" },
                { label: "Ratings", key: "show_ratings" },
                { label: "Brand", key: "show_brand_name" },
                { label: "Old Price", key: "show_original_price" },
                { label: "Stock", key: "show_stock_badge" },
                { label: "Filter Button", key: "show_filter_button" },
              ].map(({ label, key }) => (
                <div key={key} style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{label}</label>
                  <SegmentedRow
                    value={p[key] !== false ? "on" : "off"}
                    onChange={(val) => updateProps({ [key]: val === "on" })}
                    options={[{ label: "On", value: "on" }, { label: "Off", value: "off" }]}
                  />
                </div>
              ))}
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>Visual Effects & Colors</div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Corner Radius" value={parsedCardRadius} min={0} max={48} step={2} unit="px"
                  onChange={(val) => updateProps({ card_radius: `${val}px` })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Card Shadow</label>
                  <CustomSelectDropdown
                    value={p.card_shadow || "soft"}
                    placeholder="Shadow"
                    options={[
                      { label: "None", value: "none" },
                      { label: "Subtle", value: "subtle" },
                      { label: "Soft", value: "soft" },
                      { label: "Elevated", value: "elevated" },
                    ]}
                    onChange={(val) => updateProps({ card_shadow: val })}
                  />
                </div>
              </div>
              <SectionDivider title="Theme Colors" />
              <CompactColorRow label="Section BG" value={p.outer_bg_color || "transparent"} onChange={(val) => updateProps({ outer_bg_color: val })} />
              <CompactColorRow label="Card BG" value={p.card_bg_color || siteDefinition.theme?.card_bg || "#ffffff"} onChange={(val) => updateProps({ card_bg_color: val })} />
              <CompactColorRow label="Card Border" value={p.card_border_color || siteDefinition.theme?.card_border_color || "rgba(226,232,240,0.8)"} onChange={(val) => updateProps({ card_border_color: val })} />
              <CompactColorRow label="Image BG" value={p.image_bg || (isLightMode ? "#f8fafc" : "rgba(255,255,255,0.04)")} onChange={(val) => updateProps({ image_bg: val })} />
              <CompactColorRow label="Product Title" value={p.product_name_color || p.product_title_color || p.title_color || siteDefinition.theme?.text_color || "#0f172a"} onChange={(val) => updateProps({ product_name_color: val, product_title_color: val, title_color: val })} />
              <CompactColorRow label="Brand Label" value={p.brand_color || siteDefinition.theme?.muted_text_color || "#64748b"} onChange={(val) => updateProps({ brand_color: val })} />
              <CompactColorRow label="Sale Price" value={p.price_color || siteDefinition.theme?.text_color || "#0f172a"} onChange={(val) => updateProps({ price_color: val })} />
              <CompactColorRow label="Old Price" value={p.original_price_color || siteDefinition.theme?.muted_text_color || "#94a3b8"} onChange={(val) => updateProps({ original_price_color: val })} />
              <CompactColorRow label="Star Color" value={p.rating_star_color || "#d97706"} onChange={(val) => updateProps({ rating_star_color: val })} />
              <CompactColorRow label="Accent" value={p.accent_color || siteDefinition.theme?.accent_color || ADMIN_BLUE} onChange={(val) => updateProps({ accent_color: val })} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function FooterEditor({
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
  const [activeTab, setActiveTab] = useState<"content" | "social" | "design">("content");

  const f = siteDefinition.footer || {};
  const theme = siteDefinition.theme || {};
  const props = selectedBlock?.props || {};

  const getVal = (key: string, defaultVal: any) => {
    if (f[key] !== undefined && f[key] !== null) return f[key];
    if (props[key] !== undefined && props[key] !== null) return props[key];
    if (theme[key] !== undefined && theme[key] !== null) return theme[key];
    return defaultVal;
  };

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));

    // 1. Update siteDefinition.footer (used by StorefrontShell in BuilderPage)
    nextDef.footer = {
      ...(nextDef.footer || {}),
      ...patch,
    };

    // If brandName is changed in Footer, sync it across site, navbar, and theme!
    if (patch.brandName !== undefined || patch.brand_name !== undefined) {
      const bName = patch.brandName ?? patch.brand_name;
      if (!nextDef.site) nextDef.site = {};
      (nextDef.site as any).brand_name = bName;
      (nextDef as any).site_name = bName;
      (nextDef as any).name = bName;
      nextDef.theme = {
        ...(nextDef.theme || {}),
        brandName: bName,
        brand_name: bName,
      };
      if (!nextDef.navbar) nextDef.navbar = {};
      (nextDef.navbar as any).brandName = bName;
      (nextDef.navbar as any).brand_name = bName;
    }

    // 2. Keep siteDefinition.theme in sync for shared styling keys
    if (patch.footer_layout !== undefined) {
      nextDef.theme = { ...(nextDef.theme || {}), footer_layout: patch.footer_layout };
    }
    if (patch.footer_bg !== undefined) {
      nextDef.theme = { ...(nextDef.theme || {}), footer_bg: patch.footer_bg };
    }
    if (patch.footer_text_color !== undefined) {
      nextDef.theme = { ...(nextDef.theme || {}), footer_text_color: patch.footer_text_color };
    }
    if (patch.footer_border_color !== undefined) {
      nextDef.theme = { ...(nextDef.theme || {}), footer_border_color: patch.footer_border_color };
    }
    if (patch.footer_muted_color !== undefined) {
      nextDef.theme = { ...(nextDef.theme || {}), footer_muted_color: patch.footer_muted_color };
    }
    if (patch.accent_color !== undefined) {
      nextDef.theme = { ...(nextDef.theme || {}), accent_color: patch.accent_color };
    }
    if (patch.max_width !== undefined) {
      nextDef.theme = { ...(nextDef.theme || {}), footer_max_width: patch.max_width };
    }

    // 3. Keep page blocks in sync if footer block exists in pages
    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => ({
        ...page,
        blocks: (page.blocks ?? []).map((block: any) => {
          if (block.id === selectedBlock?.id || block.type === "footer") {
            return {
              ...block,
              props: {
                ...(block.props ?? {}),
                ...patch,
              },
            };
          }
          return block;
        }),
      }));
    }

    onSiteDefinitionChange(nextDef);
  };

  const defaultBrand =
    f.brandName ||
    f.brand_name ||
    theme.brandName ||
    theme.brand_name ||
    siteDefinition.navbar?.brandName ||
    siteDefinition.navbar?.brand_name ||
    siteDefinition.site?.brand_name ||
    siteDefinition.site_name ||
    siteDefinition.name ||
    "Website";
  const brandName = getVal("brandName", defaultBrand);
  const defaultTagline = siteDefinition.site?.description || siteDefinition.tagline || theme.brand_tone || "Your premium shopping destination.";
  const tagline = getVal("tagline", defaultTagline);
  const copyrightText = getVal("copyrightText", `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`);

  const rawMaxWidth = getVal("max_width", theme.footer_max_width || "full");
  const maxWidth = rawMaxWidth === "full" ? "full" : String(rawMaxWidth);

  const marginTop = (() => {
    const v = getVal("margin_top", 32);
    const num = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(num) ? 32 : num;
  })();

  const paddingY = (() => {
    const v = getVal("padding_y", 44);
    const num = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(num) ? 44 : num;
  })();

  const paddingX = (() => {
    const v = getVal("padding_x", 24);
    const num = typeof v === "number" ? v : parseInt(String(v), 10);
    return isNaN(num) ? 24 : num;
  })();

  // Visibility
  const showBrand = getVal("show_brand", true) !== false;
  const showTagline = getVal("show_tagline", true) !== false;
  const showCopyright = getVal("show_copyright", true) !== false;

  // Newsletter
  const showNewsletter = getVal("show_newsletter", true) !== false;
  const newsletterTitle = getVal("newsletter_title", "Subscribe to Our Newsletter");
  const newsletterSubtitle = getVal("newsletter_subtitle", "Get weekly updates on new arrivals, special promotions and deals.");
  const newsletterPlaceholder = getVal("newsletter_placeholder", "Enter your email...");
  const newsletterButtonText = getVal("newsletter_button_text", "Join");

  // Social Links
  const showSocialLinks = getVal("show_social_links", true) !== false;
  const socialIconVariant = getVal("social_icon_variant", "pill");
  const rawSocial = getVal("social_links", [
    { platform: "Instagram", url: "https://instagram.com" },
    { platform: "Twitter / X", url: "https://x.com" },
    { platform: "Facebook", url: "https://facebook.com" },
  ]);
  const socialLinks: Array<{ platform: string; url: string }> = Array.isArray(rawSocial) ? rawSocial : [];

  const handleUpdateSocial = (index: number, key: "platform" | "url", val: string) => {
    const next = [...socialLinks];
    next[index] = { ...next[index], [key]: val };
    updateProps({ social_links: next });
  };

  const handleAddSocial = () => {
    const next = [...socialLinks, { platform: "YouTube", url: "https://youtube.com" }];
    updateProps({ social_links: next });
  };

  const handleRemoveSocial = (index: number) => {
    const next = socialLinks.filter((_, i) => i !== index);
    updateProps({ social_links: next });
  };

  // Colors
  const isDark = theme.mode === "dark";
  const defaultFooterBg = theme.footer_bg || theme.secondary_bg || (isDark ? "#0f172a" : "#f8fafc");
  const footerBg = getVal("footer_bg", defaultFooterBg);
  const footerTextColor = getVal("footer_text_color", theme.footer_text_color || (isDark ? "#ffffff" : "#0f172a"));
  const footerMutedColor = getVal("footer_muted_color", theme.footer_muted_color || (isDark ? "#94a3b8" : "#64748b"));
  const footerBorderColor = getVal("footer_border_color", theme.footer_border_color || (isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)"));
  const resolvedAccent = getVal("accent_color", theme.accent_color || ADMIN_BLUE);
  const inputBgColor = getVal("input_bg_color", isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.95)");

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 3 Focused Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "3px",
          background: "#f1f5f9",
          padding: "2px",
          borderRadius: "6px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {[
          { id: "content", label: "Content" },
          { id: "social", label: "Social" },
          { id: "design", label: "Design" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                border: "none",
                background: isActive ? "#ffffff" : "transparent",
                color: isActive ? "#0f172a" : "#64748b",
                fontSize: "11px",
                fontWeight: isActive ? 800 : 600,
                padding: "6px 4px",
                borderRadius: "5px",
                cursor: "pointer",
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.1s ease",
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 1. Content Tab (Brand, Tagline, Copyright & Newsletter) ─────────── */}
      {activeTab === "content" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Brand Identity & Copy */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Brand Identity & Copy
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  placeholder="Website"
                  onChange={(e) => updateProps({ brandName: e.target.value, brand_name: e.target.value })}
                  style={sharedInputStyle()}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Store Tagline</label>
                <textarea
                  rows={2}
                  value={tagline}
                  placeholder="Your premium shopping destination."
                  onChange={(e) => updateProps({ tagline: e.target.value })}
                  style={{ ...sharedInputStyle(), resize: "none" }}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Copyright Notice</label>
                <input
                  type="text"
                  value={copyrightText}
                  placeholder="© 2026 Brand. All rights reserved."
                  onChange={(e) => updateProps({ copyrightText: e.target.value, copyright_text: e.target.value })}
                  style={sharedInputStyle()}
                />
              </div>

              <SectionDivider title="Element Visibility" />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Brand Name</label>
                  <SegmentedRow
                    value={showBrand ? "on" : "off"}
                    onChange={(v) => updateProps({ show_brand: v === "on" })}
                    options={[{ label: "On", value: "on" }, { label: "Off", value: "off" }]}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Tagline</label>
                  <SegmentedRow
                    value={showTagline ? "on" : "off"}
                    onChange={(v) => updateProps({ show_tagline: v === "on" })}
                    options={[{ label: "On", value: "on" }, { label: "Off", value: "off" }]}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Copyright</label>
                  <SegmentedRow
                    value={showCopyright ? "on" : "off"}
                    onChange={(v) => updateProps({ show_copyright: v === "on" })}
                    options={[{ label: "On", value: "on" }, { label: "Off", value: "off" }]}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Newsletter Subscription */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Newsletter Subscription
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Show Newsletter Form</label>
                <SegmentedRow
                  value={showNewsletter ? "on" : "off"}
                  onChange={(v) => updateProps({ show_newsletter: v === "on" })}
                  options={[{ label: "On", value: "on" }, { label: "Off", value: "off" }]}
                />
              </div>

              {showNewsletter && (
                <>
                  <div style={{ display: "grid", gap: "2px" }}>
                    <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Heading</label>
                    <input
                      type="text"
                      value={newsletterTitle}
                      placeholder="Subscribe to Our Newsletter"
                      onChange={(e) => updateProps({ newsletter_title: e.target.value })}
                      style={sharedInputStyle()}
                    />
                  </div>

                  <div style={{ display: "grid", gap: "2px" }}>
                    <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Subtitle</label>
                    <input
                      type="text"
                      value={newsletterSubtitle}
                      placeholder="Get weekly updates..."
                      onChange={(e) => updateProps({ newsletter_subtitle: e.target.value })}
                      style={sharedInputStyle()}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <div style={{ display: "grid", gap: "2px" }}>
                      <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Placeholder</label>
                      <input
                        type="text"
                        value={newsletterPlaceholder}
                        placeholder="Enter email..."
                        onChange={(e) => updateProps({ newsletter_placeholder: e.target.value })}
                        style={sharedInputStyle()}
                      />
                    </div>
                    <div style={{ display: "grid", gap: "2px" }}>
                      <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Button Text</label>
                      <input
                        type="text"
                        value={newsletterButtonText}
                        placeholder="Join"
                        onChange={(e) => updateProps({ newsletter_button_text: e.target.value })}
                        style={sharedInputStyle()}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── 2. Social Tab (Icons Toggle, Variants & Platform Links) ─────────── */}
      {activeTab === "social" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Social Media Display
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Show Social Icons</label>
                <SegmentedRow
                  value={showSocialLinks ? "on" : "off"}
                  onChange={(v) => updateProps({ show_social_links: v === "on" })}
                  options={[{ label: "On", value: "on" }, { label: "Off", value: "off" }]}
                />
              </div>

              {showSocialLinks && (
                <div style={{ display: "grid", gap: "2px", marginTop: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Icon Style Variant</label>
                  <SegmentedRow
                    value={socialIconVariant}
                    onChange={(val) => updateProps({ social_icon_variant: val })}
                    options={[
                      { label: "Pills", value: "pill" },
                      { label: "Circles", value: "circle" },
                      { label: "Rounded", value: "rounded" },
                      { label: "Minimal", value: "minimal" },
                    ]}
                  />
                </div>
              )}
            </div>
          </section>

          {showSocialLinks && (
            <section style={sectionCardStyle(isLightMode)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                  Platforms ({socialLinks.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddSocial}
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: ADMIN_BLUE,
                    background: "rgba(37,99,235,0.08)",
                    border: "none",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  + Add Social
                </button>
              </div>

              <div style={{ display: "grid", gap: "6px" }}>
                {socialLinks.map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1.3fr auto",
                      gap: "4px",
                      alignItems: "center",
                      background: "#f8fafc",
                      padding: "4px 6px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <input
                      type="text"
                      value={s.platform}
                      placeholder="Platform"
                      onChange={(e) => handleUpdateSocial(idx, "platform", e.target.value)}
                      style={{ ...sharedInputStyle(), fontSize: "11px", padding: "4px 6px" }}
                    />
                    <input
                      type="text"
                      value={s.url}
                      placeholder="https://..."
                      onChange={(e) => handleUpdateSocial(idx, "url", e.target.value)}
                      style={{ ...sharedInputStyle(), fontSize: "11px", padding: "4px 6px" }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSocial(idx)}
                      title="Remove Social Link"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "4px",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── 3. Design Tab (Spacing & Colors) ─────────────────────────────────── */}
      {activeTab === "design" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Spacing & Container Width */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Container & Spacing
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Max Width
                </label>
                <SegmentedRow
                  value={maxWidth}
                  onChange={(val) => updateProps({ max_width: val })}
                  options={[
                    { label: "Full (100%)", value: "full" },
                    { label: "1400px", value: "1400px" },
                    { label: "1200px", value: "1200px" },
                    { label: "1000px", value: "1000px" },
                  ]}
                />
              </div>

              <NumberStepperField
                label="Top Spacing Margin"
                value={marginTop}
                min={0}
                max={120}
                step={4}
                unit="px"
                onChange={(val) => updateProps({ margin_top: `${val}px` })}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Vertical Pad"
                  value={paddingY}
                  min={8}
                  max={120}
                  step={4}
                  unit="px"
                  onChange={(val) => updateProps({ padding_y: `${val}px` })}
                />
                <NumberStepperField
                  label="Horiz. Pad"
                  value={paddingX}
                  min={4}
                  max={60}
                  step={4}
                  unit="px"
                  onChange={(val) => updateProps({ padding_x: `${val}px` })}
                />
              </div>
            </div>
          </section>

          {/* Theme Colors */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Footer Theme Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Footer Background"
                value={footerBg}
                onChange={(val) => updateProps({ footer_bg: val, background_color: val })}
              />
              <CompactColorRow
                label="Text Color"
                value={footerTextColor}
                onChange={(val) => updateProps({ footer_text_color: val, text_color: val })}
              />
              <CompactColorRow
                label="Muted Text Color"
                value={footerMutedColor}
                onChange={(val) => updateProps({ footer_muted_color: val })}
              />
              <CompactColorRow
                label="Divider / Border"
                value={footerBorderColor}
                onChange={(val) => updateProps({ footer_border_color: val })}
              />
              <CompactColorRow
                label="Accent / Buttons"
                value={resolvedAccent}
                onChange={(val) => updateProps({ accent_color: val })}
              />
              <CompactColorRow
                label="Input Background"
                value={inputBgColor}
                onChange={(val) => updateProps({ input_bg_color: val })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CartEditor({
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
  const [activeTab, setActiveTab] = useState<"layout" | "content" | "colors">("layout");
  const p = selectedBlock.props ?? {};

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    const cartTypes = new Set([
      "cart",
      "cart_view",
      "cartview",
      "cart_sidebar",
      "cartsidebar",
      "cart_items",
      "cartitems",
      "order_summary",
      "ordersummary",
    ]);

    let updated = false;
    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => {
        const isCartP =
          page.role === "cart" ||
          page.page_type === "cart" ||
          page.slug === "cart" ||
          page.route === "/cart" ||
          page.route === "cart";

        const hasMatchingBlock = (page.blocks ?? []).some(
          (b: any) =>
            b.id === selectedBlock.id ||
            b.type === selectedBlock.type ||
            cartTypes.has(String(b.type || "").toLowerCase())
        );

        if (hasMatchingBlock || isCartP) {
          const blocks = (page.blocks ?? []).map((block: any) => {
            if (
              block.id === selectedBlock.id ||
              block.type === selectedBlock.type ||
              cartTypes.has(String(block.type || "").toLowerCase())
            ) {
              updated = true;
              return {
                ...block,
                props: {
                  ...(block.props ?? {}),
                  ...patch,
                },
              };
            }
            return block;
          });

          if (!updated && isCartP) {
            updated = true;
            blocks.push({
              id: selectedBlock.id || "cart_view",
              type: "cart_sidebar",
              props: { ...(selectedBlock.props ?? {}), ...patch },
            });
          }

          return { ...page, blocks };
        }
        return page;
      });
    }

    if (!updated) {
      if (!Array.isArray(nextDef.pages)) nextDef.pages = [];
      nextDef.pages.push({
        id: "page-cart",
        name: "Cart",
        route: "/cart",
        role: "cart",
        page_type: "cart",
        show_in_nav: false,
        blocks: [
          {
            id: selectedBlock.id || "cart_view",
            type: "cart_sidebar",
            props: { ...(selectedBlock.props ?? {}), ...patch },
          },
        ],
      });
    }

    onSiteDefinitionChange(nextDef);
  };

  const parseNumProp = (val: any, fallback: number) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  const getStr = (key: string, fallback: string) => {
    const val = p[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val);
    }
    return fallback;
  };

  const parseWidthRatio = (val: any, fallback = 94) => {
    if (val === undefined || val === null || val === "") return fallback;
    const str = String(val).trim();
    const n = Number(str.replace(/[^0-9.]/g, ""));
    if (isNaN(n)) return fallback;
    if (n <= 100) return Math.max(70, Math.min(100, Math.round(n)));
    return Math.max(70, Math.min(100, Math.round((n / 1240) * 94)));
  };

  const parsedBorderRadius = parseNumProp(p.border_radius, 24);
  const parsedCardRadius = parseNumProp(p.card_radius, 18);
  const parsedWidthRatio = parseWidthRatio(p.max_width, 94);
  const parsedMinHeight = Math.max(280, Math.min(650, parseNumProp(p.min_height, 380)));

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 3 Modern Clean Navigation Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
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
          { id: "layout", label: "Layout" },
          { id: "content", label: "Content" },
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
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. LAYOUT & FEATURES TAB */}
      {activeTab === "layout" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Dimensions & Radii */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Container Dimensions & Radii
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <NumberStepperField
                label="Container Width"
                value={parsedWidthRatio}
                min={70}
                max={100}
                step={2}
                unit="%"
                onChange={(val) => updateProps({ max_width: `${Math.max(70, Math.min(100, val))}%` })}
              />

              <NumberStepperField
                label="Minimum Height"
                value={parsedMinHeight}
                min={280}
                max={650}
                step={20}
                unit="px"
                onChange={(val) => updateProps({ min_height: Math.max(280, Math.min(650, val)) })}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Outer Radius"
                  value={parsedBorderRadius}
                  min={0}
                  max={40}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ border_radius: Math.max(0, Math.min(40, val)) })}
                />
                <NumberStepperField
                  label="Card Radius"
                  value={parsedCardRadius}
                  min={0}
                  max={32}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ card_radius: Math.max(0, Math.min(32, val)) })}
                />
              </div>
            </div>
          </section>

          {/* Feature Toggles — Only Promo Code as requested */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Promo Code Feature
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              {(() => {
                const isChecked = p.show_promo !== undefined ? Boolean(p.show_promo) : true;
                return (
                  <div
                    onClick={() => updateProps({ show_promo: !isChecked })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      padding: "6px 8px",
                      borderRadius: "4px",
                      border: "1px solid #e2e8f0",
                      background: isChecked ? "rgba(37,99,235,0.04)" : "#ffffff",
                      cursor: "pointer",
                      userSelect: "none",
                      boxSizing: "border-box",
                      width: "100%",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 600, color: isChecked ? "#0f172a" : "#475569" }}>
                      Show Promo Code Input
                    </span>
                    <div
                      style={{
                        position: "relative",
                        width: "24px",
                        height: "14px",
                        borderRadius: "999px",
                        background: isChecked ? ADMIN_BLUE : "#cbd5e1",
                        transition: "background 0.15s ease",
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
                          borderRadius: "50%",
                          background: "#ffffff",
                          transition: "left 0.15s ease",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        </div>
      )}

      {/* 2. CONTENT TAB */}
      {activeTab === "content" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Header & Empty State */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Cart Header & Empty State
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Cart Title
                </label>
                <input
                  type="text"
                  value={getStr("title", "Your cart")}
                  placeholder="Your cart"
                  onChange={(e) => updateProps({ title: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Clear Cart Button Label
                </label>
                <input
                  type="text"
                  value={getStr("clear_label", "Clear cart")}
                  placeholder="Clear cart"
                  onChange={(e) => updateProps({ clear_label: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Empty State Heading
                </label>
                <input
                  type="text"
                  value={getStr("empty_title", "Your cart is empty")}
                  placeholder="Your cart is empty"
                  onChange={(e) => updateProps({ empty_title: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Empty State Message
                </label>
                <input
                  type="text"
                  value={getStr("empty_message", "Add a few products to see them here.")}
                  placeholder="Add a few products to see them here."
                  onChange={(e) => updateProps({ empty_message: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </section>

          {/* Order Summary & Checkout CTA */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Order Summary & Checkout CTA
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Checkout Button Text
                </label>
                <input
                  type="text"
                  value={getStr("checkout_label", "Proceed to checkout")}
                  placeholder="Proceed to checkout"
                  onChange={(e) => updateProps({ checkout_label: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Subtotal Label
                  </label>
                  <input
                    type="text"
                    value={getStr("subtotal_label", "Subtotal")}
                    placeholder="Subtotal"
                    onChange={(e) => updateProps({ subtotal_label: e.target.value })}
                    style={{
                      width: "100%",
                      height: "28px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0f172a",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Total Label
                  </label>
                  <input
                    type="text"
                    value={getStr("total_label", "Total")}
                    placeholder="Total"
                    onChange={(e) => updateProps({ total_label: e.target.value })}
                    style={{
                      width: "100%",
                      height: "28px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0f172a",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Shipping Label
                  </label>
                  <input
                    type="text"
                    value={getStr("shipping_label", "Shipping")}
                    placeholder="Shipping"
                    onChange={(e) => updateProps({ shipping_label: e.target.value })}
                    style={{
                      width: "100%",
                      height: "28px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0f172a",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Tax Label
                  </label>
                  <input
                    type="text"
                    value={getStr("tax_label", "Estimated tax")}
                    placeholder="Estimated tax"
                    onChange={(e) => updateProps({ tax_label: e.target.value })}
                    style={{
                      width: "100%",
                      height: "28px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0f172a",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Summary Footer Note
                </label>
                <input
                  type="text"
                  value={getStr("note", "Taxes and shipping calculated at checkout")}
                  placeholder="Taxes and shipping calculated at checkout"
                  onChange={(e) => updateProps({ note: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </section>

          {/* Promo & Items */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Promo Box & Item Actions
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Promo Box Title
                </label>
                <input
                  type="text"
                  value={getStr("promo_title", "Promo code")}
                  placeholder="Promo code"
                  onChange={(e) => updateProps({ promo_title: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Promo Placeholder
                  </label>
                  <input
                    type="text"
                    value={getStr("promo_placeholder", "Enter code")}
                    placeholder="Enter code"
                    onChange={(e) => updateProps({ promo_placeholder: e.target.value })}
                    style={{
                      width: "100%",
                      height: "28px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0f172a",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Apply Button Text
                  </label>
                  <input
                    type="text"
                    value={getStr("promo_button_label", "Apply")}
                    placeholder="Apply"
                    onChange={(e) => updateProps({ promo_button_label: e.target.value })}
                    style={{
                      width: "100%",
                      height: "28px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0f172a",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Remove Item Button Label
                </label>
                <input
                  type="text"
                  value={getStr("remove_label", "Remove")}
                  placeholder="Remove"
                  onChange={(e) => updateProps({ remove_label: e.target.value })}
                  style={{
                    width: "100%",
                    height: "28px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#0f172a",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. COLORS TAB */}
      {activeTab === "colors" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Cart Colors & Surfaces
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Container Background"
                value={p.panel_color || p.background_color || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#ffffff")}
                onChange={(val) => updateProps({ panel_color: val, background_color: val })}
              />

              <CompactColorRow
                label="Card Background"
                value={p.card_color || (siteDefinition.theme?.mode === "dark" ? "#243047" : "#ffffff")}
                onChange={(val) => updateProps({ card_color: val })}
              />

              <CompactColorRow
                label="Border Color"
                value={p.border_color || (siteDefinition.theme?.mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.09)")}
                onChange={(val) => updateProps({ border_color: val })}
              />

              <CompactColorRow
                label="Text Color"
                value={p.text_color || siteDefinition.theme?.text_color || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => updateProps({ text_color: val })}
              />

              <CompactColorRow
                label="Muted Text Color"
                value={p.muted_text_color || siteDefinition.theme?.muted_text_color || (siteDefinition.theme?.mode === "dark" ? "#94a3b8" : "#64748b")}
                onChange={(val) => updateProps({ muted_text_color: val })}
              />

              <CompactColorRow
                label="Accent & Button"
                value={p.accent_color || siteDefinition.theme?.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ accent_color: val })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function isCheckoutStepsBlock(block?: any): boolean {
  if (!block) return false;
  const rawType = String(block.type || "").toLowerCase().trim();
  const rawId = String(block.id || "").toLowerCase().trim();
  const normType = rawType.replace(/[-_\s]/g, "");
  const normId = rawId.replace(/[-_\s]/g, "");

  return (
    normType === "checkoutsteps" ||
    normType === "checkoutstepper" ||
    normId === "checkoutsteps" ||
    normId === "checkoutstepper" ||
    rawType.includes("checkoutstep") ||
    rawId.includes("checkoutstep")
  );
}

function CheckoutStepsEditor({
  selectedBlock,
  isLightMode,
  textColor: _textColor,
  accentColor: _accentColor,
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
  const [activeTab, setActiveTab] = useState<"layout" | "content" | "colors">("layout");
  const p = selectedBlock?.props ?? {};

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    let updated = false;

    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => {
        const isCheckoutP =
          page.role === "checkout" ||
          page.page_type === "checkout" ||
          page.slug === "checkout" ||
          page.route === "/checkout" ||
          page.route === "checkout";

        if (isCheckoutP) {
          const blocks = (page.blocks ?? []).map((block: any) => {
            if (
              block.id === "checkout_steps" ||
              block.type === "checkout_steps" ||
              block.id === selectedBlock.id ||
              block.type === selectedBlock.type
            ) {
              updated = true;
              return {
                ...block,
                props: {
                  ...(block.props ?? {}),
                  ...patch,
                },
              };
            }
            return block;
          });

          if (!updated) {
            updated = true;
            blocks.unshift({
              id: "checkout_steps",
              type: "checkout_steps",
              props: { ...(selectedBlock.props ?? {}), ...patch },
            });
          }

          return { ...page, blocks };
        }
        return page;
      });
    }

    if (!updated) {
      if (!Array.isArray(nextDef.pages)) nextDef.pages = [];
      nextDef.pages.push({
        id: "page-checkout",
        name: "Checkout",
        route: "/checkout",
        role: "checkout",
        page_type: "checkout",
        show_in_nav: false,
        blocks: [
          {
            id: "checkout_steps",
            type: "checkout_steps",
            props: { ...(selectedBlock.props ?? {}), ...patch },
          },
        ],
      });
    }

    onSiteDefinitionChange(nextDef);
  };

  const parseNumProp = (val: any, fallback: number) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  const getStr = (key: string, fallback: string) => {
    const val = p[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val);
    }
    return fallback;
  };

  const textInputStyle: React.CSSProperties = {
    width: "100%",
    height: "28px",
    padding: "0 8px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#0f172a",
    borderRadius: "4px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    boxSizing: "border-box",
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: "9px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  };



  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 3 Navigation Tabs: Layout, Content, Colors */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
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
          { id: "layout", label: "Layout" },
          { id: "content", label: "Content" },
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
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. LAYOUT TAB */}
      {activeTab === "layout" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Dimensions & Width */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Container Dimensions
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Text Alignment</label>
                <SegmentedRow
                  value={p.text_align || "left"}
                  onChange={(val) => updateProps({ text_align: val })}
                  options={[
                    { label: "Left", value: "left" },
                    { label: "Center", value: "center" },
                    { label: "Right", value: "right" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Padding"
                  value={parseNumProp(p.padding, 18)}
                  min={6}
                  max={40}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ padding: val })}
                />
                <NumberStepperField
                  label="Step Gap"
                  value={parseNumProp(p.step_gap, 16)}
                  min={4}
                  max={48}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ step_gap: val })}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <NumberStepperField
                  label="Bottom Spacing"
                  value={parseNumProp(p.gap || p.margin_bottom, 18)}
                  min={4}
                  max={40}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ gap: val, margin_bottom: val })}
                />
              </div>
            </div>
          </section>

          {/* Corner Radii */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Corner Radii
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Container Radius"
                  value={parseNumProp(p.border_radius, 18)}
                  min={0}
                  max={36}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ border_radius: val })}
                />
                <NumberStepperField
                  label="Circle Radius"
                  value={parseNumProp(p.step_radius, 11) > 20 ? 11 : parseNumProp(p.step_radius, 11)}
                  min={0}
                  max={20}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ step_radius: val })}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. CONTENT TAB */}
      {activeTab === "content" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Step Titles
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Step 1 Label</label>
                <input
                  type="text"
                  value={getStr("step_1_label", "Delivery Address")}
                  placeholder="Delivery Address"
                  onChange={(e) => updateProps({ step_1_label: e.target.value })}
                  style={textInputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Step 2 Label</label>
                <input
                  type="text"
                  value={getStr("step_2_label", "Payment")}
                  placeholder="Payment"
                  onChange={(e) => updateProps({ step_2_label: e.target.value })}
                  style={textInputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Step 3 Label</label>
                <input
                  type="text"
                  value={getStr("step_3_label", "Review & Pay")}
                  placeholder="Review & Pay"
                  onChange={(e) => updateProps({ step_3_label: e.target.value })}
                  style={textInputStyle}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. COLORS TAB */}
      {activeTab === "colors" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Container Colors */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Container Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Container Background"
                value={p.background_color || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#ffffff")}
                onChange={(val) => updateProps({ background_color: val })}
              />
              <CompactColorRow
                label="Container Border Color"
                value={p.border_color || (siteDefinition.theme?.mode === "dark" ? "#334155" : "#e2e8f0")}
                onChange={(val) => updateProps({ border_color: val })}
              />
            </div>
          </section>

          {/* Active Step Colors */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Active Step Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Active Badge Background"
                value={p.active_step_bg || siteDefinition.theme?.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ active_step_bg: val })}
              />
              <CompactColorRow
                label="Active Badge Text"
                value={p.active_step_text || "#ffffff"}
                onChange={(val) => updateProps({ active_step_text: val })}
              />
              <CompactColorRow
                label="Active Step Title"
                value={p.active_text_color || siteDefinition.theme?.text_color || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => updateProps({ active_text_color: val })}
              />
              <CompactColorRow
                label="Active Connecting Line"
                value={p.line_active_color || siteDefinition.theme?.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ line_active_color: val })}
              />
            </div>
          </section>

          {/* Inactive Step Colors */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Inactive Step Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Inactive Badge Background"
                value={p.inactive_step_bg || (siteDefinition.theme?.mode === "dark" ? "#0f172a" : "#f8fafc")}
                onChange={(val) => updateProps({ inactive_step_bg: val })}
              />
              <CompactColorRow
                label="Inactive Badge Border"
                value={p.inactive_step_border || (siteDefinition.theme?.mode === "dark" ? "#334155" : "#d5dbe4")}
                onChange={(val) => updateProps({ inactive_step_border: val })}
              />
              <CompactColorRow
                label="Inactive Badge Text"
                value={p.inactive_step_text || (siteDefinition.theme?.mode === "dark" ? "#94a3b8" : "#64748b")}
                onChange={(val) => updateProps({ inactive_step_text: val })}
              />
              <CompactColorRow
                label="Inactive Step Title"
                value={p.inactive_text_color || (siteDefinition.theme?.mode === "dark" ? "#94a3b8" : "#64748b")}
                onChange={(val) => updateProps({ inactive_text_color: val })}
              />
              <CompactColorRow
                label="Inactive Connecting Line"
                value={p.line_inactive_color || (siteDefinition.theme?.mode === "dark" ? "#334155" : "#e5e7eb")}
                onChange={(val) => updateProps({ line_inactive_color: val })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CompactToggleRow({
  label,
  subtitle,
  checked,
  onChange,
}: {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        padding: "5px 7px",
        borderRadius: "5px",
        background: checked ? "rgba(37,99,235,0.05)" : "#f8fafc",
        border: `1px solid ${checked ? "#bfdbfe" : "#e2e8f0"}`,
        cursor: "pointer",
        transition: "all 0.15s ease",
        userSelect: "none",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: checked ? "#1e40af" : "#334155", lineHeight: 1.2 }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: "8.5px", color: "#64748b", marginTop: "1px" }}>
            {subtitle}
          </div>
        )}
      </div>
      <div
        style={{
          width: "28px",
          height: "16px",
          borderRadius: "999px",
          background: checked ? ADMIN_BLUE : "#cbd5e1",
          position: "relative",
          transition: "background 0.2s ease",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "#ffffff",
            position: "absolute",
            top: "2px",
            left: checked ? "14px" : "2px",
            transition: "left 0.2s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </div>
  );
}

function isPaymentMethodsBlock(block?: any): boolean {
  if (!block) return false;
  const rawType = String(block.type || "").toLowerCase().trim();
  const rawId = String(block.id || "").toLowerCase().trim();
  const normType = rawType.replace(/[-_\s]/g, "");
  const normId = rawId.replace(/[-_\s]/g, "");

  return (
    normType === "paymentmethods" ||
    normType === "payment" ||
    normId === "paymentmethods" ||
    normId === "payment" ||
    rawType.includes("payment_method") ||
    rawId.includes("payment_method") ||
    rawType.includes("paymentmethod") ||
    rawId.includes("paymentmethod")
  );
}

function isCheckoutSummaryBlock(block?: any): boolean {
  if (!block) return false;
  const rawType = String(block.type || "").toLowerCase().trim();
  const rawId = String(block.id || "").toLowerCase().trim();
  return (
    rawId === "checkout_order_summary" ||
    rawType === "checkout_order_summary" ||
    rawId === "checkoutordersummary" ||
    rawType === "checkoutordersummary"
  );
}

function PaymentMethodsEditor({
  selectedBlock,
  isLightMode,
  textColor: _textColor,
  accentColor: _accentColor,
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
  const [activeTab, setActiveTab] = useState<"layout" | "content" | "colors">("layout");
  const p = selectedBlock?.props ?? {};

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    let updated = false;

    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => {
        const isCheckoutP =
          page.role === "checkout" ||
          page.page_type === "checkout" ||
          page.slug === "checkout" ||
          page.route === "/checkout" ||
          page.route === "checkout";

        if (isCheckoutP) {
          let found = false;
          const blocks = (page.blocks ?? []).map((block: any) => {
            if (
              block.id === "payment_methods" ||
              block.type === "payment_methods" ||
              block.type === "paymentmethods" ||
              block.id === selectedBlock.id ||
              block.type === selectedBlock.type
            ) {
              found = true;
              updated = true;
              return {
                ...block,
                props: {
                  ...(block.props ?? {}),
                  ...patch,
                },
              };
            }
            return block;
          });

          if (!found) {
            updated = true;
            blocks.push({
              id: "payment_methods",
              type: "payment_methods",
              props: { ...(selectedBlock.props ?? {}), ...patch },
            });
          }

          return { ...page, blocks };
        }
        return page;
      });
    }

    if (!updated) {
      if (!Array.isArray(nextDef.pages)) nextDef.pages = [];
      nextDef.pages.push({
        id: "page-checkout",
        name: "Checkout",
        route: "/checkout",
        role: "checkout",
        page_type: "checkout",
        show_in_nav: false,
        blocks: [
          {
            id: "payment_methods",
            type: "payment_methods",
            props: { ...(selectedBlock.props ?? {}), ...patch },
          },
        ],
      });
    }

    onSiteDefinitionChange(nextDef);
  };

  const getStr = (key: string, fallback = "") =>
    p[key] !== undefined && p[key] !== null ? String(p[key]) : fallback;

  const parseNumProp = (val: any, fallback: number) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  const textInputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    height: "26px",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: "11px",
    color: "#0f172a",
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: "9px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  };

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 3 Navigation Tabs with Layout Coming First */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "2px",
          padding: "2px",
          background: "#f1f5f9",
          borderRadius: "6px",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        {[
          { id: "layout", label: "Layout" },
          { id: "content", label: "Content" },
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
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. LAYOUT TAB (METHODS TOGGLES + RADII + SPACING) */}
      {activeTab === "layout" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Method Toggles */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Enabled Payment Methods
            </div>
            <div style={{ display: "grid", gap: "5px" }}>
              <CompactToggleRow
                label="UPI (Google Pay / PhonePe / Paytm / QR)"
                subtitle="Instant UPI App or QR code payment"
                checked={p.enable_upi !== false}
                onChange={(val) => updateProps({ enable_upi: val })}
              />
              <CompactToggleRow
                label="Credit / Debit Card"
                subtitle="Visa, Mastercard, RuPay"
                checked={p.enable_card !== false}
                onChange={(val) => updateProps({ enable_card: val })}
              />
              <CompactToggleRow
                label="Netbanking"
                subtitle="50+ major Indian banks"
                checked={p.enable_netbanking !== false}
                onChange={(val) => updateProps({ enable_netbanking: val })}
              />
              <CompactToggleRow
                label="Cash on Delivery (COD)"
                subtitle="Pay with cash upon delivery"
                checked={p.enable_cod !== false}
                onChange={(val) => updateProps({ enable_cod: val })}
              />
            </div>
          </section>

          {/* Corner Radii */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Corner Radii
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Container Radius"
                  value={parseNumProp(p.border_radius, 14)}
                  min={0}
                  max={36}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ border_radius: val })}
                />
                <NumberStepperField
                  label="Option Radius"
                  value={parseNumProp(p.item_radius, 12)}
                  min={0}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ item_radius: val })}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Button Radius"
                  value={parseNumProp(p.button_border_radius, 10)}
                  min={0}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ button_border_radius: val })}
                />
                <NumberStepperField
                  label="Badge Radius"
                  value={parseNumProp(p.badge_border_radius, 12)}
                  min={0}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ badge_border_radius: val })}
                />
              </div>
            </div>
          </section>

          {/* Spacing & Dimensions */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Spacing & Dimensions
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <NumberStepperField
                label="Padding"
                value={parseNumProp(p.padding, 18)}
                min={6}
                max={40}
                step={2}
                unit="px"
                onChange={(val) => updateProps({ padding: val })}
              />
              <NumberStepperField
                label="Option Gap"
                value={parseNumProp(p.gap, 12)}
                min={4}
                max={30}
                step={2}
                unit="px"
                onChange={(val) => updateProps({ gap: val })}
              />
            </div>
          </section>
        </div>
      )}

      {/* 2. CONTENT TAB */}
      {activeTab === "content" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Header & Button Labels
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Section Title</label>
                <input
                  type="text"
                  value={getStr("title", "Payment method")}
                  placeholder="Payment method"
                  onChange={(e) => updateProps({ title: e.target.value })}
                  style={textInputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Subtitle</label>
                <input
                  type="text"
                  value={getStr("subtitle", "Choose how you want to complete payment for this order.")}
                  placeholder="Choose payment method"
                  onChange={(e) => updateProps({ subtitle: e.target.value })}
                  style={textInputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Back Button</label>
                  <input
                    type="text"
                    value={getStr("back_button_label", "← Back")}
                    placeholder="← Back"
                    onChange={(e) => updateProps({ back_button_label: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Continue Button</label>
                  <input
                    type="text"
                    value={getStr("continue_button_label", "Review order →")}
                    placeholder="Review order →"
                    onChange={(e) => updateProps({ continue_button_label: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Method Labels & Subtitles
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>UPI Title & Badge</label>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "4px" }}>
                  <input
                    type="text"
                    value={getStr("upi_title", "UPI (Google Pay, PhonePe, Paytm, QR)")}
                    placeholder="UPI Title"
                    onChange={(e) => updateProps({ upi_title: e.target.value })}
                    style={textInputStyle}
                  />
                  <input
                    type="text"
                    value={getStr("upi_badge", "Fastest")}
                    placeholder="Badge"
                    onChange={(e) => updateProps({ upi_badge: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Card Title</label>
                <input
                  type="text"
                  value={getStr("card_title", "Credit / Debit Card")}
                  placeholder="Card Title"
                  onChange={(e) => updateProps({ card_title: e.target.value })}
                  style={textInputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Netbanking Title</label>
                <input
                  type="text"
                  value={getStr("netbanking_title", "Netbanking")}
                  placeholder="Netbanking Title"
                  onChange={(e) => updateProps({ netbanking_title: e.target.value })}
                  style={textInputStyle}
                />
              </div>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>COD Title</label>
                <input
                  type="text"
                  value={getStr("cod_title", "Cash on Delivery (COD)")}
                  placeholder="COD Title"
                  onChange={(e) => updateProps({ cod_title: e.target.value })}
                  style={textInputStyle}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. COLORS TAB */}
      {activeTab === "colors" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Container & Cards
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Container Background"
                value={p.background_color || (siteDefinition.theme?.mode === "dark" ? "#0f172a" : "#ffffff")}
                onChange={(val) => updateProps({ background_color: val })}
              />
              <CompactColorRow
                label="Container Border"
                value={p.border_color || (siteDefinition.theme?.mode === "dark" ? "#334155" : "#e2e8f0")}
                onChange={(val) => updateProps({ border_color: val })}
              />
              <CompactColorRow
                label="Option Card Background"
                value={p.card_color || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#ffffff")}
                onChange={(val) => updateProps({ card_color: val })}
              />
              <CompactColorRow
                label="Selected Option Background"
                value={p.selected_card_bg || "rgba(37,99,235,0.08)"}
                onChange={(val) => updateProps({ selected_card_bg: val })}
              />
              <CompactColorRow
                label="Selected Accent / Ring"
                value={p.accent_color || siteDefinition.theme?.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ accent_color: val })}
              />
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Text & Action Buttons
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Primary Text"
                value={p.text_color || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => updateProps({ text_color: val })}
              />
              <CompactColorRow
                label="Muted / Subtitle Text"
                value={p.muted_text_color || (siteDefinition.theme?.mode === "dark" ? "#94a3b8" : "#64748b")}
                onChange={(val) => updateProps({ muted_text_color: val })}
              />
              <CompactColorRow
                label="Continue Button Background"
                value={p.button_bg_color || siteDefinition.theme?.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ button_bg_color: val })}
              />
              <CompactColorRow
                label="Continue Button Text"
                value={p.button_text_color || "#ffffff"}
                onChange={(val) => updateProps({ button_text_color: val })}
              />
              <CompactColorRow
                label="Back Button Background"
                value={p.back_button_bg || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#f1f5f9")}
                onChange={(val) => updateProps({ back_button_bg: val })}
              />
              <CompactColorRow
                label="Back Button Text"
                value={p.back_button_text || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => updateProps({ back_button_text: val })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CheckoutOrderSummaryNotice({
  isLightMode,
  onSelectPage,
  onSelectBlock,
}: {
  isLightMode: boolean;
  onSelectPage?: (pageId: string) => void;
  onSelectBlock?: (blockId: string | null) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "10px", width: "100%", boxSizing: "border-box" }}>
      <section
        style={{
          ...sectionCardStyle(isLightMode),
          padding: "14px 12px",
          background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
          border: "1px solid #cbd5e1",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "rgba(37,99,235,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ADMIN_BLUE,
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a" }}>
              Order Summary
            </div>
            <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "3px", background: "#e0f2fe", color: "#0369a1" }}>
              SHARED WITH CART
            </span>
          </div>
        </div>

        <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#475569", lineHeight: 1.6 }}>
          This block is shared with your <strong>Shopping Cart</strong> — keeping pricing, promo logic, and labels perfectly in sync across the cart and every checkout step.
        </p>

        <p style={{ margin: "0 0 14px", fontSize: "10.5px", color: "#64748b", lineHeight: 1.5 }}>
          To adjust text labels, promo code input, border styles, or colors, head to the <strong>Cart</strong> page and edit the component there.
        </p>

        <button
          type="button"
          onClick={() => {
            if (onSelectPage) onSelectPage("/cart");
            if (onSelectBlock) onSelectBlock("cart_sidebar");
          }}
          style={{
            width: "100%",
            height: "32px",
            borderRadius: "6px",
            border: "none",
            background: ADMIN_BLUE,
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            boxShadow: "0 1px 3px rgba(37,99,235,0.3)",
            transition: "all 0.15s ease",
          }}
        >
          Edit on Cart Page →
        </button>
      </section>
    </div>
  );
}

function isDeliveryBlock(block?: any): boolean {
  if (!block) return false;
  if (isCheckoutStepsBlock(block)) return false;
  if (isPaymentMethodsBlock(block)) return false;
  if (isCheckoutSummaryBlock(block)) return false;
  const rawType = String(block.type || "").toLowerCase().trim();
  const rawId = String(block.id || "").toLowerCase().trim();
  if (rawType.includes("checkoutstep") || rawId.includes("checkoutstep")) return false;
  if (rawType.includes("payment") || rawId.includes("payment")) return false;
  const normType = rawType.replace(/[-_\s]/g, "");
  const normId = rawId.replace(/[-_\s]/g, "");

  return (
    normType === "deliveryform" ||
    normType === "delivery" ||
    normType === "deliverymappicker" ||
    normType === "deliveryaddressform" ||
    normId === "deliveryform" ||
    normId === "delivery" ||
    normId === "deliverymappicker" ||
    normId === "deliveryaddressform" ||
    rawType.includes("delivery") ||
    rawId.includes("delivery")
  );
}

function DeliveryFormEditor({
  selectedBlock,
  isLightMode,
  textColor: _textColor,
  accentColor: _accentColor,
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
  const [activeTab, setActiveTab] = useState<"layout" | "content" | "colors">("layout");
  const p = selectedBlock?.props ?? {};

  const updateProps = (patch: Record<string, any>) => {
    const nextDef = JSON.parse(JSON.stringify(siteDefinition));
    const deliveryTypes = new Set([
      "delivery_form",
      "deliveryform",
      "delivery_map_picker",
      "delivery_address_form",
    ]);

    let updated = false;
    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => {
        const isCheckoutP =
          page.role === "checkout" ||
          page.page_type === "checkout" ||
          page.slug === "checkout" ||
          page.route === "/checkout" ||
          page.route === "checkout";

        const hasMatchingBlock = (page.blocks ?? []).some(
          (b: any) =>
            b.id === selectedBlock.id ||
            b.type === selectedBlock.type ||
            deliveryTypes.has(String(b.type || "").toLowerCase())
        );

        if (hasMatchingBlock || isCheckoutP) {
          const blocks = (page.blocks ?? []).map((block: any) => {
            if (
              block.id === selectedBlock.id ||
              block.type === selectedBlock.type ||
              deliveryTypes.has(String(block.type || "").toLowerCase())
            ) {
              updated = true;
              return {
                ...block,
                props: {
                  ...(block.props ?? {}),
                  ...patch,
                },
              };
            }
            return block;
          });

          if (!updated && isCheckoutP) {
            updated = true;
            blocks.push({
              id: selectedBlock.id || "delivery_form",
              type: "delivery_form",
              props: { ...(selectedBlock.props ?? {}), ...patch },
            });
          }

          return { ...page, blocks };
        }
        return page;
      });
    }

    if (!updated) {
      if (!Array.isArray(nextDef.pages)) nextDef.pages = [];
      nextDef.pages.push({
        id: "page-checkout",
        name: "Checkout",
        route: "/checkout",
        role: "checkout",
        page_type: "checkout",
        show_in_nav: false,
        blocks: [
          {
            id: selectedBlock.id || "delivery_form",
            type: "delivery_form",
            props: { ...(selectedBlock.props ?? {}), ...patch },
          },
        ],
      });
    }

    onSiteDefinitionChange(nextDef);
  };

  const parseNumProp = (val: any, fallback: number) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  const getStr = (key: string, fallback: string) => {
    const val = p[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val);
    }
    return fallback;
  };

  const textInputStyle: React.CSSProperties = {
    width: "100%",
    height: "28px",
    padding: "0 8px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#0f172a",
    borderRadius: "4px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    boxSizing: "border-box",
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: "9px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  };

  const currentMaxWidth = p.max_width ? String(p.max_width) : "100%";
  const normalizedWidth =
    currentMaxWidth === "100%" || currentMaxWidth === "full"
      ? "100%"
      : currentMaxWidth.endsWith("px")
      ? currentMaxWidth
      : `${currentMaxWidth}px`;

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 3 Standard Navigation Tabs: Layout, Content, Colors */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
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
          { id: "layout", label: "Layout" },
          { id: "content", label: "Content" },
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
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. LAYOUT TAB */}
      {/* ========================================================================= */}
      {activeTab === "layout" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Width & Spacing */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Container Dimensions
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Container Width</label>
                <SegmentedRow
                  value={
                    normalizedWidth === "100%" || normalizedWidth === "full"
                      ? "100%"
                      : normalizedWidth
                  }
                  onChange={(val) => updateProps({ max_width: val })}
                  options={[
                    { label: "100% Full", value: "100%" },
                    { label: "1280px", value: "1280px" },
                    { label: "1100px", value: "1100px" },
                    { label: "900px", value: "900px" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Padding"
                  value={parseNumProp(p.padding, 18)}
                  min={8}
                  max={40}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ padding: val })}
                />
                <NumberStepperField
                  label="Section Gap"
                  value={parseNumProp(p.gap || p.section_gap, 16)}
                  min={4}
                  max={40}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ gap: val, section_gap: val })}
                />
              </div>
            </div>
          </section>

          {/* Corner Radii */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Corner Radii
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Outer Radius"
                  value={parseNumProp(p.border_radius, 14)}
                  min={0}
                  max={36}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ border_radius: val })}
                />
                <NumberStepperField
                  label="Card Radius"
                  value={parseNumProp(p.card_radius, 12)}
                  min={0}
                  max={32}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ card_radius: val })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Button Radius"
                  value={parseNumProp(p.button_border_radius, 10)}
                  min={0}
                  max={30}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ button_border_radius: val, button_radius: val })}
                />
                <NumberStepperField
                  label="Badge Radius"
                  value={parseNumProp(p.badge_border_radius || p.badge_radius, 12) > 24 ? 12 : parseNumProp(p.badge_border_radius || p.badge_radius, 12)}
                  min={0}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ badge_border_radius: val, badge_radius: val })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Field Radius"
                  value={parseNumProp(p.field_radius, 8)}
                  min={0}
                  max={24}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ field_radius: val })}
                />
                <NumberStepperField
                  label="Modal Radius"
                  value={parseNumProp(p.map_modal_radius || p.form_card_radius, 14)}
                  min={0}
                  max={32}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ map_modal_radius: val, form_card_radius: val })}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CONTENT TAB */}
      {/* ========================================================================= */}
      {activeTab === "content" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Header & Headings */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Delivery Info
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Badge</label>
                  <input
                    type="text"
                    value={getStr("sectionLabel", "Delivery")}
                    placeholder="Delivery"
                    onChange={(e) => updateProps({ sectionLabel: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Title</label>
                  <input
                    type="text"
                    value={getStr("title", "Delivery Address")}
                    placeholder="Delivery Address"
                    onChange={(e) => updateProps({ title: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Subtitle</label>
                <input
                  type="text"
                  value={getStr("subtitle", "Choose address or add new")}
                  placeholder="Choose address or add new"
                  onChange={(e) => updateProps({ subtitle: e.target.value })}
                  style={textInputStyle}
                />
              </div>
            </div>
          </section>

          {/* Action Buttons & Empty State */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Buttons & Empty State
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Add Button</label>
                  <input
                    type="text"
                    value={getStr("add_address_button_label", "+ Add New")}
                    placeholder="+ Add New"
                    onChange={(e) => updateProps({ add_address_button_label: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Continue Button</label>
                  <input
                    type="text"
                    value={getStr("continue_button_label", "Deliver to this address")}
                    placeholder="Deliver to this address"
                    onChange={(e) => updateProps({ continue_button_label: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Empty Title</label>
                  <input
                    type="text"
                    value={getStr("empty_title", "No address saved")}
                    placeholder="No address saved"
                    onChange={(e) => updateProps({ empty_title: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Empty Text</label>
                  <input
                    type="text"
                    value={getStr("empty_message", "Add address to continue")}
                    placeholder="Add address to continue"
                    onChange={(e) => updateProps({ empty_message: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Address Form Titles & Placeholders */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Address Form Modal
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Add Title</label>
                  <input
                    type="text"
                    value={getStr("form_title_add", "Add Address")}
                    placeholder="Add Address"
                    onChange={(e) => updateProps({ form_title_add: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Edit Title</label>
                  <input
                    type="text"
                    value={getStr("form_title_edit", "Edit Address")}
                    placeholder="Edit Address"
                    onChange={(e) => updateProps({ form_title_edit: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Subtitle</label>
                  <input
                    type="text"
                    value={getStr("form_subtitle", "Enter delivery details")}
                    placeholder="Enter delivery details"
                    onChange={(e) => updateProps({ form_subtitle: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Save Button</label>
                  <input
                    type="text"
                    value={getStr("form_save_button_label", "Save & Deliver")}
                    placeholder="Save & Deliver"
                    onChange={(e) => updateProps({ form_save_button_label: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Name Hint</label>
                  <input
                    type="text"
                    value={getStr("form_name_placeholder", "Full name")}
                    placeholder="Full name"
                    onChange={(e) => updateProps({ form_name_placeholder: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Phone Hint</label>
                  <input
                    type="text"
                    value={getStr("form_phone_placeholder", "Phone number")}
                    placeholder="Phone number"
                    onChange={(e) => updateProps({ form_phone_placeholder: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Address Hint</label>
                <input
                  type="text"
                  value={getStr("form_address_placeholder", "Flat, building, street")}
                  placeholder="Flat, building, street"
                  onChange={(e) => updateProps({ form_address_placeholder: e.target.value })}
                  style={textInputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>City Hint</label>
                  <input
                    type="text"
                    value={getStr("form_city_placeholder", "City / Area")}
                    placeholder="City / Area"
                    onChange={(e) => updateProps({ form_city_placeholder: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Pincode Hint</label>
                  <input
                    type="text"
                    value={getStr("form_pincode_placeholder", "Postal code")}
                    placeholder="Postal code"
                    onChange={(e) => updateProps({ form_pincode_placeholder: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Map Location Picker */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Map Location Picker
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Modal Title</label>
                  <input
                    type="text"
                    value={getStr("map_modal_title", "Pick Location")}
                    placeholder="Pick Location"
                    onChange={(e) => updateProps({ map_modal_title: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={fieldLabelStyle}>Confirm Button</label>
                  <input
                    type="text"
                    value={getStr("map_confirm_button_label", "Confirm Location")}
                    placeholder="Confirm Location"
                    onChange={(e) => updateProps({ map_confirm_button_label: e.target.value })}
                    style={textInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Search Hint</label>
                <input
                  type="text"
                  value={getStr("map_search_placeholder", "Search address or area")}
                  placeholder="Search address or area"
                  onChange={(e) => updateProps({ map_search_placeholder: e.target.value })}
                  style={textInputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={fieldLabelStyle}>Instructions</label>
                <input
                  type="text"
                  value={getStr("map_helper_text", "Drag map to position pin")}
                  placeholder="Drag map to position pin"
                  onChange={(e) => updateProps({ map_helper_text: e.target.value })}
                  style={textInputStyle}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. COLORS TAB */}
      {/* ========================================================================= */}
      {activeTab === "colors" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Card & Background Colors */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Card & Background Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Container Background"
                value={p.background_color || (siteDefinition.theme?.mode === "dark" ? "#0f172a" : "#ffffff")}
                onChange={(val) => updateProps({ background_color: val })}
              />
              <CompactColorRow
                label="Card Background"
                value={p.card_color || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#ffffff")}
                onChange={(val) => updateProps({ card_color: val })}
              />
              <CompactColorRow
                label="Selected Card Background"
                value={p.selected_card_bg || (siteDefinition.theme?.mode === "dark" ? "#1e3a8a" : "#eff6ff")}
                onChange={(val) => updateProps({ selected_card_bg: val })}
              />
              <CompactColorRow
                label="Card Border Color"
                value={p.border_color || (siteDefinition.theme?.mode === "dark" ? "#334155" : "#e2e8f0")}
                onChange={(val) => updateProps({ border_color: val })}
              />
              <CompactColorRow
                label="Container Border Color"
                value={p.soft_border_color || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#f1f5f9")}
                onChange={(val) => updateProps({ soft_border_color: val })}
              />
            </div>
          </section>

          {/* Action Buttons & Accent */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Buttons & Accent
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Accent Color"
                value={p.accentColor || siteDefinition.theme?.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ accentColor: val })}
              />
              <CompactColorRow
                label="Continue Button Background"
                value={p.button_bg_color || p.accentColor || ADMIN_BLUE}
                onChange={(val) => updateProps({ button_bg_color: val })}
              />
              <CompactColorRow
                label="Continue Button Text Color"
                value={p.button_text_color || "#ffffff"}
                onChange={(val) => updateProps({ button_text_color: val })}
              />
              <CompactColorRow
                label="Form Save Button Background"
                value={p.form_save_btn_bg || p.accentColor || ADMIN_BLUE}
                onChange={(val) => updateProps({ form_save_btn_bg: val })}
              />
              <CompactColorRow
                label="Form Save Button Text Color"
                value={p.form_save_btn_text || "#ffffff"}
                onChange={(val) => updateProps({ form_save_btn_text: val })}
              />
            </div>
          </section>

          {/* Text Typography */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Typography Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Text Color"
                value={p.text_color || siteDefinition.theme?.text_color || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => updateProps({ text_color: val })}
              />
              <CompactColorRow
                label="Muted Text Color"
                value={p.muted_text_color || siteDefinition.theme?.muted_text_color || (siteDefinition.theme?.mode === "dark" ? "#94a3b8" : "#64748b")}
                onChange={(val) => updateProps({ muted_text_color: val })}
              />
            </div>
          </section>

          {/* Form & Map Backgrounds */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Modals & Inputs Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Form Panel Background"
                value={p.form_panel_bg || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#ffffff")}
                onChange={(val) => updateProps({ form_panel_bg: val })}
              />
              <CompactColorRow
                label="Inputs Background"
                value={p.form_input_bg || (siteDefinition.theme?.mode === "dark" ? "#0f172a" : "#f8fafc")}
                onChange={(val) => updateProps({ form_input_bg: val })}
              />
              <CompactColorRow
                label="Inputs Text Color"
                value={p.form_input_text || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => updateProps({ form_input_text: val })}
              />
              <CompactColorRow
                label="Field Labels Color"
                value={p.form_label_color || (siteDefinition.theme?.mode === "dark" ? "#94a3b8" : "#64748b")}
                onChange={(val) => updateProps({ form_label_color: val })}
              />
              <CompactColorRow
                label="Placeholder Color"
                value={p.form_placeholder_color || "#94a3b8"}
                onChange={(val) => updateProps({ form_placeholder_color: val })}
              />
              <CompactColorRow
                label="Fields Border Color"
                value={p.form_border_color || (siteDefinition.theme?.mode === "dark" ? "#334155" : "#cbd5e1")}
                onChange={(val) => updateProps({ form_border_color: val })}
              />
              <CompactColorRow
                label="Map Modal Background"
                value={p.map_modal_bg || (siteDefinition.theme?.mode === "dark" ? "#0f172a" : "#ffffff")}
                onChange={(val) => updateProps({ map_modal_bg: val })}
              />
              <CompactColorRow
                label="Map Search Background"
                value={p.map_search_bg || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#f8fafc")}
                onChange={(val) => updateProps({ map_search_bg: val })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function isProductDetailBlock(block?: any): boolean {
  if (!block) return false;
  const rawType = String(block.type || "").toLowerCase().trim();
  const rawId = String(block.id || "").toLowerCase().trim();
  const normType = rawType.replace(/[-_\s]/g, "");
  const normId = rawId.replace(/[-_\s]/g, "");

  if (
    normType === "productdetail" ||
    normType === "productdetails" ||
    normType === "productinfo" ||
    normType === "productgallery" ||
    normType === "purchasepanel" ||
    normType === "detail" ||
    normType === "product"
  ) {
    return true;
  }

  if (
    rawType.includes("product_detail") ||
    rawType.includes("product-detail") ||
    rawType.includes("productdetail") ||
    rawType.includes("product_info") ||
    rawType.includes("purchase_panel")
  ) {
    return true;
  }

  if (
    normId === "productdetail" ||
    normId === "productdetails" ||
    normId === "productinfo" ||
    normId === "productgallery" ||
    normId === "purchasepanel" ||
    rawId.includes("product-detail") ||
    rawId.includes("product_detail") ||
    rawId.includes("productdetail")
  ) {
    return true;
  }

  return false;
}

function ProductDetailEditor({
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
  const [activeTab, setActiveTab] = useState<"design" | "colors">("design");
  const p = selectedBlock.props ?? {};
  const theme = siteDefinition.theme || {};

  const updateProps = (patch: Record<string, any>) => {
    let nextDef = JSON.parse(JSON.stringify(siteDefinition));

    // Mirror block colors to theme so saveThemeSnapshot and theme switcher preserve them
    if (patch.badge_bg_color) {
      nextDef.theme = { ...(nextDef.theme || {}), badge_bg_color: patch.badge_bg_color, product_detail_badge_bg: patch.badge_bg_color };
    }
    if (patch.badge_border_color) {
      nextDef.theme = { ...(nextDef.theme || {}), badge_border_color: patch.badge_border_color, product_detail_badge_border: patch.badge_border_color };
    }
    if (patch.panel_color) {
      nextDef.theme = { ...(nextDef.theme || {}), product_detail_bg: patch.panel_color };
    }
    if (patch.text_color) {
      nextDef.theme = { ...(nextDef.theme || {}), product_detail_text: patch.text_color };
    }
    if (patch.button_bg_color) {
      nextDef.theme = { ...(nextDef.theme || {}), product_detail_btn_bg: patch.button_bg_color };
    }
    if (patch.button_text_color) {
      nextDef.theme = { ...(nextDef.theme || {}), product_detail_btn_text: patch.button_text_color };
    }

    let updated = false;
    if (Array.isArray(nextDef.pages)) {
      nextDef.pages = nextDef.pages.map((page: any) => {
        const isDetailP =
          page.role === "product" ||
          page.role === "product_detail" ||
          page.page_type === "product" ||
          page.page_type === "product_detail" ||
          page.route?.includes("/product");

        const hasMatchingBlock = (page.blocks ?? []).some(
          (b: any) =>
            b.id === selectedBlock.id ||
            b.type === selectedBlock.type ||
            isProductDetailBlock(b)
        );

        if (hasMatchingBlock || isDetailP) {
          const blocks = (page.blocks ?? []).map((block: any) => {
            if (
              block.id === selectedBlock.id ||
              block.type === selectedBlock.type ||
              isProductDetailBlock(block)
            ) {
              updated = true;
              return {
                ...block,
                props: {
                  ...(block.props ?? {}),
                  ...patch,
                },
              };
            }
            return block;
          });

          return { ...page, blocks };
        }
        return page;
      });
    }

    if (!updated && selectedBlock?.id) {
      const bKey = Object.keys(patch)[0];
      const updatedSite = updateBlockFieldValue(
        nextDef,
        selectedBlock.id,
        { key: bKey, target: "props" } as any,
        patch[bKey]
      );
      onSiteDefinitionChange(updatedSite);
      return;
    }

    onSiteDefinitionChange(nextDef);
  };

  const parseNumProp = (val: any, fallback: number) => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  const getStr = (key: string, fallback: string) => {
    const val = p[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val);
    }
    return fallback;
  };

  const isReturnsActive = p.show_return_policy !== false;

  const currentTrustBadges = useMemo(() => {
    const raw = Array.isArray(p.trust_badges) && p.trust_badges.length > 0
      ? [...p.trust_badges]
      : [
          { id: "delivery", title: "Delivery", subtitle: p.delivery_text || "Fast ship" },
          { id: "returns", title: "Returns", subtitle: "Auto Policy" },
          { id: "quality", title: "Quality", subtitle: p.quality_text || "Curated pick" },
        ];

    // Ensure Returns badge is always present and never lost
    const hasReturns = raw.some((b: any) => b.id === "returns" || (b.title || "").trim().toLowerCase() === "returns");
    if (!hasReturns) {
      raw.splice(1, 0, { id: "returns", title: "Returns", subtitle: "Auto Policy" });
    }
    return raw;
  }, [p.trust_badges, p.delivery_text, p.quality_text]);

  const handleToggleReturns = (enabled: boolean) => {
    updateProps({ show_return_policy: enabled });
  };

  const handleUpdateBadge = (index: number, field: "title" | "subtitle", value: string) => {
    const updated = currentTrustBadges.map((b: any, idx: number) =>
      idx === index ? { ...b, [field]: value } : b
    );
    updateProps({ trust_badges: updated });
  };

  const handleAddBadge = () => {
    const newBadge = {
      id: `badge-${Date.now()}`,
      title: "Service",
      subtitle: "Service details",
    };
    updateProps({ trust_badges: [...currentTrustBadges, newBadge] });
  };

  const handleDeleteBadge = (index: number) => {
    const target = currentTrustBadges[index];
    if (target && (target.id === "returns" || (target.title || "").trim().toLowerCase() === "returns")) {
      handleToggleReturns(false);
      return;
    }
    const updated = currentTrustBadges.filter((_: any, idx: number) => idx !== index);
    updateProps({ trust_badges: updated });
  };

  const renderToggle = (label: string, propKey: string, defaultVal = true) => {
    const isChecked = p[propKey] !== undefined ? Boolean(p[propKey]) : defaultVal;
    return (
      <div
        key={propKey}
        onClick={() => updateProps({ [propKey]: !isChecked })}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 0",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: "10px", fontWeight: 600, color: "#334155" }}>
          {label}
        </span>
        <div
          style={{
            position: "relative",
            width: "22px",
            height: "13px",
            borderRadius: "999px",
            background: isChecked ? ADMIN_BLUE : "#cbd5e1",
            transition: "background 0.15s ease",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: isChecked ? "11px" : "2px",
              width: "9px",
              height: "9px",
              borderRadius: "999px",
              background: "#ffffff",
              transition: "left 0.15s ease",
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: "6px", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 2 Modern Clean Navigation Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
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
          { id: "design", label: "Design" },
          { id: "colors", label: "Colors" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "6px 2px",
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

      {/* 1. DESIGN & CONTENT TAB */}
      {activeTab === "design" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {/* Section 1: Media Gallery (Left Column) */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Media Gallery (Image)
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Aspect Ratio</label>
                <SegmentedRow
                  value={getStr("image_aspect_ratio", "1 / 1")}
                  onChange={(val) => updateProps({ image_aspect_ratio: val })}
                  options={[
                    { label: "1:1 Square", value: "1 / 1" },
                    { label: "3:4 Portrait", value: "3 / 4" },
                    { label: "4:5 Tall", value: "4 / 5" },
                    { label: "16:9 Wide", value: "16 / 9" },
                  ]}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Image Fit</label>
                  <SegmentedRow
                    value={getStr("image_fit", "cover")}
                    onChange={(val) => updateProps({ image_fit: val })}
                    options={[
                      { label: "Cover", value: "cover" },
                      { label: "Contain", value: "contain" },
                    ]}
                  />
                </div>
                <NumberStepperField
                  label="Image Radius"
                  value={parseNumProp(p.image_border_radius, 16)}
                  min={0}
                  max={40}
                  step={2}
                  unit="px"
                  onChange={(val) => updateProps({ image_border_radius: val })}
                />
              </div>
            </div>
          </section>

          {/* Section 2: Typography & Sibling Variants */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Title Typography & Sibling Variants
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Title Size"
                  value={parseNumProp(p.title_font_size, 26)}
                  min={18}
                  max={44}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ title_font_size: val })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Font Family</label>
                  <CustomSelectDropdown
                    value={getStr("title_font_family", "inherit")}
                    placeholder="Font"
                    options={[
                      { label: "Default Theme", value: "inherit" },
                      { label: "Inter", value: "'Inter', sans-serif" },
                      { label: "Outfit", value: "'Outfit', sans-serif" },
                      { label: "Playfair Display", value: "'Playfair Display', serif" },
                      { label: "Poppins", value: "'Poppins', sans-serif" },
                      { label: "Plus Jakarta", value: "'Plus Jakarta Sans', sans-serif" },
                      { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
                      { label: "Cinzel", value: "'Cinzel', serif" },
                    ]}
                    onChange={(val) => updateProps({ title_font_family: val })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Title Weight</label>
                  <CustomSelectDropdown
                    value={String(p.title_font_weight || "800")}
                    placeholder="Weight"
                    options={[
                      { label: "Medium (500)", value: "500" },
                      { label: "Semi-Bold (600)", value: "600" },
                      { label: "Bold (700)", value: "700" },
                      { label: "Heavy (800)", value: "800" },
                      { label: "Black (900)", value: "900" },
                    ]}
                    onChange={(val) => updateProps({ title_font_weight: val })}
                  />
                </div>
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Title Style</label>
                  <SegmentedRow
                    value={p.title_font_style || "normal"}
                    onChange={(val) => updateProps({ title_font_style: val })}
                    options={[
                      { label: "Normal", value: "normal" },
                      { label: "Italic", value: "italic" },
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Desc. Size"
                  value={parseNumProp(p.description_font_size, 14)}
                  min={11}
                  max={22}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ description_font_size: val })}
                />
                <div style={{ display: "grid", gap: "2px" }}>
                  <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>CTA Button Text</label>
                  <input
                    type="text"
                    value={getStr("add_to_cart_label", "Add to cart")}
                    placeholder="Add to cart"
                    onChange={(e) => updateProps({ add_to_cart_label: e.target.value })}
                    style={{
                      width: "100%",
                      height: "26px",
                      padding: "0 6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0f172a",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px", marginTop: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Color Variants Display</label>
                <SegmentedRow
                  value={p.color_variant_layout || "carousel"}
                  onChange={(val) => updateProps({ color_variant_layout: val })}
                  options={[
                    { label: "Carousel (Scroll)", value: "carousel" },
                    { label: "Grid (Wrap)", value: "grid" },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Section 3: Trust & Service Badges */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                Trust & Service Badges ({currentTrustBadges.length})
              </div>
              <button
                type="button"
                onClick={handleAddBadge}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: ADMIN_BLUE,
                  fontSize: "9.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Badge</span>
              </button>
            </div>
            <div style={{ display: "grid", gap: "6px", marginTop: "4px" }}>
              {currentTrustBadges.map((badge: any, bIdx: number) => {
                const isReturns = badge.id === "returns" || (badge.title || "").trim().toLowerCase() === "returns";
                return (
                  <div
                    key={badge.id || bIdx}
                    style={{
                      display: "grid",
                      gap: "4px",
                      padding: "6px 8px",
                      background: isReturns ? "#f8fafc" : "#ffffff",
                      border: isReturns ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                      borderRadius: "5px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        {isReturns ? (
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                        ) : null}
                        <span style={{ fontSize: "9px", fontWeight: 700, color: isReturns ? (isReturnsActive ? "#0369a1" : "#64748b") : "#475569" }}>
                          {isReturns ? "Returns Policy" : `Badge #${bIdx + 1}`}
                        </span>
                      </div>

                      {isReturns ? (
                        <div
                          onClick={() => handleToggleReturns(!isReturnsActive)}
                          title={isReturnsActive ? "Click to disable Returns badge" : "Click to enable Returns badge"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                        >
                          <span style={{ fontSize: "8.5px", fontWeight: 700, color: isReturnsActive ? "#16a34a" : "#94a3b8" }}>
                            {isReturnsActive ? "Enabled" : "Disabled"}
                          </span>
                          <div
                            style={{
                              position: "relative",
                              width: "22px",
                              height: "13px",
                              borderRadius: "999px",
                              background: isReturnsActive ? ADMIN_BLUE : "#cbd5e1",
                              transition: "background 0.15s ease",
                              flexShrink: 0,
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: "2px",
                                left: isReturnsActive ? "11px" : "2px",
                                width: "9px",
                                height: "9px",
                                borderRadius: "999px",
                                background: "#ffffff",
                                transition: "left 0.15s ease",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteBadge(bIdx)}
                          title="Remove badge"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "2px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {isReturns ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "4px", alignItems: "center", opacity: isReturnsActive ? 1 : 0.6 }}>
                        <input
                          type="text"
                          value="Returns"
                          disabled
                          style={{
                            width: "100%",
                            height: "24px",
                            padding: "0 5px",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            color: "#64748b",
                            borderRadius: "4px",
                            border: "1px solid #e2e8f0",
                            background: "#f1f5f9",
                            boxSizing: "border-box",
                            cursor: "not-allowed",
                          }}
                        />
                        <div
                          style={{
                            height: "24px",
                            padding: "0 6px",
                            fontSize: "9px",
                            fontWeight: 600,
                            color: isReturnsActive ? "#0369a1" : "#64748b",
                            background: isReturnsActive ? "#f0f9ff" : "#f1f5f9",
                            borderRadius: "4px",
                            border: isReturnsActive ? "1px dashed #7dd3fc" : "1px dashed #cbd5e1",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            boxSizing: "border-box",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                          title="Automatically determined by store & product return window settings (e.g. 7 Days Return or No Returns)"
                        >
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          <span>Auto: Store Policy</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                        <input
                          type="text"
                          placeholder="Title (e.g. Delivery)"
                          value={badge.title || ""}
                          onChange={(e) => handleUpdateBadge(bIdx, "title", e.target.value)}
                          style={{
                            width: "100%",
                            height: "24px",
                            padding: "0 5px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            color: "#0f172a",
                            borderRadius: "4px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            boxSizing: "border-box",
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Subtitle (e.g. Fast ship)"
                          value={badge.subtitle || ""}
                          onChange={(e) => handleUpdateBadge(bIdx, "subtitle", e.target.value)}
                          style={{
                            width: "100%",
                            height: "24px",
                            padding: "0 5px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            color: "#0f172a",
                            borderRadius: "4px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <NumberStepperField
                label="Badge Radius"
                value={parseNumProp(p.badge_border_radius, 14)}
                min={0}
                max={30}
                step={1}
                unit="px"
                onChange={(val) => updateProps({ badge_border_radius: val })}
              />
            </div>
          </section>

          {/* Section 4: Component Visibility */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Visibility Toggles
            </div>
            <div style={{ display: "grid", gap: "2px" }}>
              {renderToggle("Brand & Category", "show_brand_name", true)}
              {renderToggle("Customer Ratings", "show_ratings", true)}
              {renderToggle("Discount Badge", "show_discount_badge", true)}
              {renderToggle("Stock Status Badge", "show_stock_badge", true)}
              {renderToggle("Original Strikethrough Price", "show_original_price", true)}
              {renderToggle("Description Accordion", "show_description_accordion", true)}
              {renderToggle("Specifications Accordion", "show_specs_accordion", true)}
              {renderToggle("Customer Reviews Section", "show_reviews_section", true)}
            </div>
          </section>

          {/* Section 5: Layout & Border Radii */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Layout & Border Radii
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "9px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Max Container Width
                </label>
                <CustomSelectDropdown
                  value={
                    p.max_width === "full" || p.max_width === "100%"
                      ? "full"
                      : p.max_width === "1440" || p.max_width === "1440px"
                      ? "1440px"
                      : p.max_width === "1280" || p.max_width === "1280px"
                      ? "1280px"
                      : p.max_width === "1200" || p.max_width === "1200px"
                      ? "1200px"
                      : p.max_width === "1000" || p.max_width === "1000px"
                      ? "1000px"
                      : p.max_width
                      ? String(p.max_width)
                      : "full"
                  }
                  placeholder="Max Width"
                  options={[
                    { label: "Full Width (100%)", value: "full" },
                    { label: "Extra Wide (1440px)", value: "1440px" },
                    { label: "Wide (1280px)", value: "1280px" },
                    { label: "Standard (1200px)", value: "1200px" },
                    { label: "Compact (1000px)", value: "1000px" },
                  ]}
                  onChange={(val) => updateProps({ max_width: val })}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <NumberStepperField
                  label="Card Radius"
                  value={parseNumProp(p.card_border_radius, 22)}
                  min={0}
                  max={36}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ card_border_radius: val })}
                />
                <NumberStepperField
                  label="Button Radius"
                  value={parseNumProp(p.button_border_radius, 15)}
                  min={0}
                  max={30}
                  step={1}
                  unit="px"
                  onChange={(val) => updateProps({ button_border_radius: val })}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. COLORS TAB */}
      {activeTab === "colors" && (
        <div style={{ display: "grid", gap: "8px" }}>
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Card & Background Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Card Panel Background"
                value={p.panel_color || p.background_color || theme.card_bg || (siteDefinition.theme?.mode === "dark" ? "#1e293b" : "#ffffff")}
                onChange={(val) => updateProps({ panel_color: val, background_color: val })}
              />
              <CompactColorRow
                label="Primary Text Color"
                value={p.text_color || theme.text_color || (siteDefinition.theme?.mode === "dark" ? "#f8fafc" : "#0f172a")}
                onChange={(val) => updateProps({ text_color: val })}
              />
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Action Button Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Button Background"
                value={p.button_bg_color || theme.accent_color || ADMIN_BLUE}
                onChange={(val) => updateProps({ button_bg_color: val })}
              />
              <CompactColorRow
                label="Button Text Color"
                value={p.button_text_color || "#ffffff"}
                onChange={(val) => updateProps({ button_text_color: val })}
              />
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              Trust Badge Colors
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <CompactColorRow
                label="Badge Background"
                value={p.badge_bg_color || theme.badge_bg_color || theme.product_detail_badge_bg || (siteDefinition.theme?.mode === "dark" ? "rgba(255,255,255,0.04)" : "#f8fafc")}
                onChange={(val) => updateProps({ badge_bg_color: val })}
              />
              <CompactColorRow
                label="Badge Border"
                value={p.badge_border_color || theme.badge_border_color || theme.product_detail_badge_border || (siteDefinition.theme?.mode === "dark" ? "rgba(255,255,255,0.08)" : "#e2e8f0")}
                onChange={(val) => updateProps({ badge_border_color: val })}
              />
            </div>
          </section>
        </div>
      )}
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
    const patch: Record<string, any> = { [key]: value };
    if (key === "brandName" || key === "brand_name") {
      patch.brandName = value;
      patch.brand_name = value;
    }
    const nextDef = updateThemeValues(siteDefinition, patch);
    if (key === "brandName" || key === "brand_name") {
      if (!nextDef.site) nextDef.site = {} as any;
      (nextDef.site as any).brand_name = value;
      (nextDef as any).site_name = value;
      (nextDef as any).name = value;
      if (!nextDef.navbar) nextDef.navbar = {};
      (nextDef.navbar as any).brandName = value;
      (nextDef.navbar as any).brand_name = value;
      if (!nextDef.footer) nextDef.footer = {};
      (nextDef.footer as any).brandName = value;
      (nextDef.footer as any).brand_name = value;
    }
    onSiteDefinitionChange(nextDef);
  };

  const isDark = theme?.mode === "dark";
  const defaultBrandName =
    theme.brandName ||
    theme.brand_name ||
    siteDefinition.site?.brand_name ||
    siteDefinition.navbar?.brandName ||
    siteDefinition.navbar?.brand_name ||
    siteDefinition.site_name ||
    siteDefinition.name ||
    "My Store";

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
  const rawMaxWidth = String(getVal("navbar_max_width", "100%"));
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
                  { label: "100%", value: "100%" },
                  { label: "1440px", value: "1440px" },
                  { label: "1280px", value: "1280px" },
                  { label: "1100px", value: "1100px" },
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
    const handleUpdate = (e: any) => {
      const currentSiteId = (siteDefinition as any)?.id || (siteDefinition as any)?.site_id || getSiteStorageId(siteDefinition);
      if (!e.detail?.siteId || e.detail.siteId === currentSiteId) {
        setRefreshCounter((c) => c + 1);
      }
    };
    window.addEventListener("webnirmaan_theme_saved", handleUpdate);
    return () => window.removeEventListener("webnirmaan_theme_saved", handleUpdate);
  }, [siteDefinition]);

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
  const _rawSelectedBlock = findBlockById(siteDefinition, selectedBlockId);
  const selectedBlock =
    (selectedBlockId === "checkout_steps" || selectedBlockId === "checkoutsteps" || selectedBlockId === "checkout_stepper")
      ? (_rawSelectedBlock || { id: "checkout_steps", type: "checkout_steps", props: {} })
      : (selectedBlockId === "checkout_order_summary")
        ? { id: "checkout_order_summary", type: "checkout_order_summary", props: _rawSelectedBlock?.props ?? {} }
      : _rawSelectedBlock;
  const editableConfig = selectedBlock
    ? getEditableConfigForBlock(selectedBlock.type)
    : null;

  // Block types that have dedicated custom editors and bypass editableConfig
  const hasSpecialEditor = (() => {
    if (!selectedBlock) return false;
    if (isProductDetailBlock(selectedBlock) || editableConfig?.displayName === "Product Detail") return true;
    const t = selectedBlock.type?.toLowerCase?.() ?? "";
    return (
      t === "hero_banner" || t === "herobanner" || t === "hero" || t === "banner" ||
      t === "navbar" || t === "header" ||
      t === "section_group_carousel" || t === "sectiongroupcarousel" ||
      t === "category_story_carousel" || t === "category_carousel" ||
      t === "section_carousel" || t === "story_carousel" ||
      t === "category_grid" || t === "categorygrid" ||
      t === "product_carousel" || t === "productcarousel" ||
      t === "products_carousel" || t === "product_grid" ||
      t === "productgrid" || t === "featured_products" ||
      t === "collection_products" ||
      t === "footer" ||
      t === "cart" || t === "cart_view" || t === "cartview" ||
      t === "cart_sidebar" || t === "cartsidebar" ||
      isCheckoutStepsBlock(selectedBlock) ||
      t === "checkout_steps" || t === "checkoutsteps" ||
      isPaymentMethodsBlock(selectedBlock) ||
      t === "payment_methods" || t === "paymentmethods" ||
      isCheckoutSummaryBlock(selectedBlock) ||
      t === "checkout_order_summary" || t === "checkoutordersummary" ||
      isDeliveryBlock(selectedBlock) ||
      t === "delivery_form" || t === "deliveryform" ||
      t === "delivery_map_picker" || t === "delivery_address_form"
    );
  })();
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
                {selectedBlock
                  ? editableConfig?.displayName ||
                    (selectedBlock.type === "product_grid" || selectedBlock.type === "productgrid"
                      ? "Product Grid"
                      : selectedBlock.type === "hero_banner" || selectedBlock.type === "herobanner" || selectedBlock.type === "hero"
                      ? "Hero Banner"
                      : selectedBlock.type === "navbar" || selectedBlock.type === "header"
                      ? "Navbar"
                      : selectedBlock.type === "footer"
                      ? "Footer"
                      : selectedBlock.type === "cart" ||
                        selectedBlock.type === "cart_view" ||
                        selectedBlock.type === "cartview" ||
                        selectedBlock.type === "cart_sidebar" ||
                        selectedBlock.type === "cartsidebar" ||
                        selectedBlock.type === "cart_items" ||
                        selectedBlock.type === "cartitems"
                      ? "Shopping Cart"
                      : isProductDetailBlock(selectedBlock) ||
                        editableConfig?.displayName === "Product Detail"
                      ? "Product Detail"
                      : isCheckoutStepsBlock(selectedBlock) ||
                        selectedBlock.id === "checkout_steps" ||
                        selectedBlock.type === "checkout_steps" ||
                        selectedBlockId === "checkout_steps"
                      ? "Checkout Steps"
                      : isCheckoutSummaryBlock(selectedBlock) ||
                        selectedBlock.id === "checkout_order_summary" ||
                        selectedBlock.type === "checkout_order_summary" ||
                        selectedBlock.type === "checkoutordersummary" ||
                        selectedBlockId === "checkout_order_summary"
                      ? "Order Summary"
                      : isDeliveryBlock(selectedBlock) ||
                        editableConfig?.displayName === "Delivery Form"
                      ? (selectedBlock.type === "delivery_map_picker"
                          ? "Map Location Picker"
                          : selectedBlock.type === "delivery_address_form"
                          ? "Add / Edit Address Form"
                          : "Delivery Form")
                      : isPaymentMethodsBlock(selectedBlock) ||
                        selectedBlock.id === "payment_methods" ||
                        selectedBlock.type === "payment_methods" ||
                        selectedBlock.type === "paymentmethods" ||
                        selectedBlockId === "payment_methods"
                      ? "Payment Methods"
                      : selectedBlock.type.toUpperCase())
                  : activePageTitle}
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
          ) : !editableConfig && !hasSpecialEditor ? (
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
              ) : selectedBlock.type === "section_group_carousel" ||
                selectedBlock.type === "sectiongroupcarousel" ||
                selectedBlock.type === "category_story_carousel" ||
                selectedBlock.type === "category_carousel" ||
                selectedBlock.type === "section_carousel" ||
                selectedBlock.type === "story_carousel" ||
                selectedBlock.type === "category_grid" ||
                selectedBlock.type === "categorygrid" ? (
                <SectionGroupCarouselEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                /> 
              ) : selectedBlock.type === "product_grid" ||
                selectedBlock.type === "productgrid" ? (
                <ProductGridEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : selectedBlock.type === "product_carousel" ||
                selectedBlock.type === "productcarousel" ||
                selectedBlock.type === "products_carousel" ||
                selectedBlock.type === "featured_products" ||
                selectedBlock.type === "collection_products" ? (
                <ProductCarouselEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : selectedBlock.type === "footer" ? (
                <FooterEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : selectedBlock.type === "cart" ||
                selectedBlock.type === "cart_view" ||
                selectedBlock.type === "cartview" ||
                selectedBlock.type === "cart_sidebar" ||
                selectedBlock.type === "cartsidebar" ||
                selectedBlock.type === "cart_items" ||
                selectedBlock.type === "cartitems" ||
                (selectedBlock.type === "order_summary" && !isCheckoutSummaryBlock(selectedBlock) && selectedBlock.id !== "checkout_order_summary") ||
                (selectedBlock.type === "ordersummary" && !isCheckoutSummaryBlock(selectedBlock) && selectedBlock.id !== "checkout_order_summary") ? (
                <CartEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : isProductDetailBlock(selectedBlock) ||
                editableConfig?.displayName === "Product Detail" ? (
                <ProductDetailEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : isCheckoutStepsBlock(selectedBlock) ||
                selectedBlock.id === "checkout_steps" ||
                selectedBlock.type === "checkout_steps" ||
                selectedBlock.type === "checkoutsteps" ||
                selectedBlockId === "checkout_steps" ? (
                <CheckoutStepsEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : isCheckoutSummaryBlock(selectedBlock) ||
                selectedBlock.id === "checkout_order_summary" ||
                selectedBlock.type === "checkout_order_summary" ||
                selectedBlock.type === "checkoutordersummary" ||
                selectedBlockId === "checkout_order_summary" ? (
                <CheckoutOrderSummaryNotice
                  isLightMode={isLightMode}
                  onSelectPage={onSelectPage}
                  onSelectBlock={onSelectBlock}
                />
              ) : isDeliveryBlock(selectedBlock) ||
                editableConfig?.displayName === "Delivery Form" ||
                selectedBlock.type === "delivery_form" ||
                selectedBlock.type === "deliveryform" ||
                selectedBlock.type === "delivery_map_picker" ||
                selectedBlock.type === "delivery_address_form" ? (
                <DeliveryFormEditor
                  selectedBlock={selectedBlock}
                  isLightMode={isLightMode}
                  textColor={textColor}
                  accentColor={accentColor}
                  onSiteDefinitionChange={onSiteDefinitionChange}
                  siteDefinition={siteDefinition}
                />
              ) : isPaymentMethodsBlock(selectedBlock) ||
                selectedBlock.id === "payment_methods" ||
                selectedBlock.type === "payment_methods" ||
                selectedBlock.type === "paymentmethods" ||
                selectedBlockId === "payment_methods" ? (
                <PaymentMethodsEditor
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