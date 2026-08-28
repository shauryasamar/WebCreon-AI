import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type EditorTab = "theme" | "block";

type EditorSidebarProps = {
  siteDefinition: EditorSiteDefinition;
  selectedBlockId: string | null;
  selectedTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  onSiteDefinitionChange: (next: EditorSiteDefinition) => void;
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

function CustomSelectDropdown({
  value,
  options,
  placeholder = "Select...",
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  placeholder?: string;
  accentColor?: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const selectedOption = options.find((o) => o.value === value);

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
    overflow: "hidden",
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
    overflow: "hidden",
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
      "showsearch",
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
  const activeBorder = "1.5px dashed #6366f1";
  const textMuted = isLightMode ? "rgba(17,24,39,0.5)" : "rgba(255,255,255,0.5)";
  const cardBg = isLightMode ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.04)";

  // Derive the absolute URL for the preview dynamically
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
    <div style={{ display: "grid", gap: "8px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {previewUrl ? (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            borderRadius: "10px",
            border: isLightMode ? "1px solid rgba(17,24,39,0.12)" : "1px solid rgba(255,255,255,0.12)",
            background: isLightMode ? "#ffffff" : "rgba(255,255,255,0.03)",
            overflow: "hidden",
            boxShadow: isLightMode ? "0 1px 3px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.2)",
          }}
        >
          {/* High-Clarity Preview Viewport */}
          <div
            style={{
              width: "100%",
              height: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 14px",
              boxSizing: "border-box",
              background: isLightMode
                ? "repeating-conic-gradient(#f1f5f9 0% 25%, #ffffff 0% 50%) 50% / 14px 14px"
                : "repeating-conic-gradient(#0f172a 0% 25%, #1e293b 0% 50%) 50% / 14px 14px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <img
              src={previewUrl}
              alt="Logo preview"
              style={{
                maxHeight: "64px",
                maxWidth: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
                imageRendering: "auto",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))",
              }}
            />
          </div>

          {/* Action Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 10px",
              borderTop: isLightMode ? "1px solid rgba(17,24,39,0.08)" : "1px solid rgba(255,255,255,0.08)",
              background: isLightMode ? "#f8fafc" : "rgba(255,255,255,0.02)",
              gap: "8px",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0, flex: 1 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "12px", height: "12px", color: textMuted, flexShrink: 0 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span
                style={{
                  fontSize: "11px",
                  color: textMuted,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {currentValue.split("/").pop() || "Brand logo"}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#ef4444",
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "4px",
                flexShrink: 0,
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isLightMode ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

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
          gap: "5px",
          padding: "14px 12px",
          borderRadius: "8px",
          border: isDragging ? activeBorder : border,
          background: isDragging ? (isLightMode ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.08)") : cardBg,
          cursor: uploading ? "wait" : "pointer",
          transition: "all 0.15s ease",
          textAlign: "center",
          userSelect: "none",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px", color: isDragging ? "#6366f1" : textMuted }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ fontSize: "11px", color: isDragging ? "#6366f1" : textMuted, fontWeight: 500 }}>
          {uploading ? "Uploading..." : previewUrl ? "Replace logo image" : "Upload logo image"}
        </span>
        <span style={{ fontSize: "10px", color: textMuted, opacity: 0.7 }}>PNG, SVG, WEBP • Max 2MB</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {error && (
        <div style={{ fontSize: "11px", color: "#ef4444", lineHeight: 1.4 }}>{error}</div>
      )}
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
    return (
      <CustomSelectDropdown
        value={typeof currentValue === "string" ? currentValue : ""}
        options={(field.options || []).map((opt) => ({ label: opt.label, value: opt.value }))}
        placeholder={`Select ${field.label}...`}
        onChange={(val) => onChange(val)}
      />
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
    const valHex = typeof currentValue === "string" && currentValue ? currentValue : "#2563eb";
    return (
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
            value={valHex.startsWith("#") ? valHex : "#2563eb"}
            onChange={(e) => onChange(e.target.value)}
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
          value={valHex.toUpperCase()}
          placeholder="#000000"
          onChange={(e) => onChange(e.target.value)}
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
        <span style={{ fontSize: "8.5px", color: "#94a3b8", fontWeight: 700, paddingRight: "2px" }}>HEX</span>
      </div>
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

export default function EditorSidebar({
  siteDefinition,
  selectedBlockId,
  selectedTab,
  onTabChange,
  onSiteDefinitionChange,
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

  const festivalPresets: FestivalThemeKey[] = [
    "none",
    "diwali",
    "christmas",
    "eid",
    "holi",
  ];

  const fieldGroups =
    editableConfig?.fields && editableConfig.fields.length > 0
      ? groupFields(editableConfig.fields)
      : [];

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
          BLOCK
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
                            fontSize: "9px",
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

          {/* Festive Themes Section */}
          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
              FESTIVE THEMES & GRAFFITI ART
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", width: "100%", boxSizing: "border-box" }}>
              {[
                { key: "none" as FestivalThemeKey, label: "Default", colors: ["#ffffff", "#2563eb"] },
                { key: "diwali" as FestivalThemeKey, label: "Diwali", colors: ["#f59e0b", "#78350f", "#fbbf24"] },
                { key: "holi" as FestivalThemeKey, label: "Holi", colors: ["#ec4899", "#8b5cf6", "#06b6d4"] },
                { key: "durga_puja" as FestivalThemeKey, label: "Durga Puja", colors: ["#e11d48", "#facc15", "#ffffff"] },
                { key: "rakhi" as FestivalThemeKey, label: "Raksha Bandhan", colors: ["#f59e0b", "#dc2626", "#fbbf24"] },
                { key: "christmas" as FestivalThemeKey, label: "Christmas", colors: ["#dc2626", "#059669", "#f0fdf4"] },
                { key: "eid" as FestivalThemeKey, label: "Eid", colors: ["#0d9488", "#facc15", "#05131f"] },
              ].map((item) => {
                const active = (siteDefinition.theme?.festival_theme || "none") === item.key;
                const isFull = item.key === "none";

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      onSiteDefinitionChange(
                        applyFestivalTheme(siteDefinition, item.key)
                      )
                    }
                    style={{
                      gridColumn: isFull ? "1 / -1" : "span 1",
                      padding: "4px 6px",
                      borderRadius: "5px",
                      border: active ? `1px solid ${ADMIN_BLUE}` : "1px solid #e2e8f0",
                      cursor: "pointer",
                      background: active ? "rgba(37,99,235,0.06)" : "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "4px",
                      transition: "all 0.12s ease",
                      boxSizing: "border-box",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: active ? 700 : 600,
                        color: active ? ADMIN_BLUE : "#334155",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label}
                    </span>
                    <div style={{ display: "flex", gap: "2px", alignItems: "center", flexShrink: 0 }}>
                      {item.colors.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            width: "6.5px",
                            height: "6.5px",
                            borderRadius: "50%",
                            background: c,
                            border: "1px solid rgba(0,0,0,0.15)",
                          }}
                        />
                      ))}
                    </div>
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
          {/* Sleek Figma Single-Line Inspector Header */}
          <div style={{ paddingBottom: "4px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
              <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                INSPECTOR
              </span>
              <span style={{ fontSize: "9px", color: "#cbd5e1" }}>/</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedBlock ? (editableConfig?.displayName || selectedBlock.type.toUpperCase()) : "NO SELECTION"}
              </span>
            </div>
            {selectedBlock && (
              <span style={{ fontSize: "8.5px", fontWeight: 800, padding: "1px 4px", borderRadius: "3px", background: "rgba(37,99,235,0.08)", color: ADMIN_BLUE, flexShrink: 0 }}>
                ACTIVE
              </span>
            )}
          </div>

          {!selectedBlock ? (
            <div style={sectionCardStyle(isLightMode)}>
              <p style={{ margin: 0, fontSize: "10.5px", color: "#64748b", lineHeight: 1.4 }}>
                Click any block on the page canvas to inspect and edit its properties.
              </p>
            </div>
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