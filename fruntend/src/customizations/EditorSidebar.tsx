import React, { useEffect, useMemo, useRef, useState } from "react";
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

export type EditorTab = "theme" | "block";

type EditorSidebarProps = {
  siteDefinition: EditorSiteDefinition;
  selectedBlockId: string | null;
  selectedTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  onSiteDefinitionChange: (next: EditorSiteDefinition) => void;
};

type JsonFieldControlProps = {
  field: EditorField;
  currentValue: any;
  textColor: string;
  isLightMode: boolean;
  onChange: (value: any) => void;
};

function sharedInputStyle(
  isLightMode: boolean,
  textColor: string
): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "4px 6px",
    borderRadius: "5px",
    border: isLightMode
      ? "1px solid rgba(17,24,39,0.15)"
      : "1px solid rgba(255,255,255,0.15)",
    background: isLightMode ? "#ffffff" : "rgba(255,255,255,0.04)",
    color: textColor,
    fontSize: "11px",
    outline: "none",
  };
}

function colorInputStyle(isLightMode: boolean): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    height: "28px",
    padding: "2px",
    borderRadius: "5px",
    border: isLightMode
      ? "1px solid rgba(17,24,39,0.15)"
      : "1px solid rgba(255,255,255,0.15)",
    background: isLightMode ? "#ffffff" : "rgba(255,255,255,0.04)",
    cursor: "pointer",
  };
}

function sectionCardStyle(_isLightMode: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "8px",
    padding: "8px",
    borderRadius: "5px",
    border: "1px solid rgba(15,23,42,0.08)",
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
    gap: "3px",
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
  textColor,
  isLightMode,
  onChange,
}: JsonFieldControlProps) {
  const [rawValue, setRawValue] = useState(getJsonEditorValue(currentValue));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRawValue(getJsonEditorValue(currentValue));
    setError(null);
  }, [currentValue, field.key]);

  const inputStyle = useMemo(
    () => ({
      ...sharedInputStyle(isLightMode, textColor),
      resize: "vertical" as const,
      minHeight: "140px",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: "12px",
      lineHeight: 1.5,
      border: error
        ? "1px solid #ef4444"
        : isLightMode
        ? "1px solid rgba(17,24,39,0.12)"
        : "1px solid rgba(255,255,255,0.12)",
    }),
    [error, isLightMode, textColor]
  );

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
      setError("Invalid JSON. Please fix the format before leaving this field.");
    }
  };

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <textarea
        value={rawValue}
        placeholder={field.placeholder || ""}
        onChange={(e) => {
          setRawValue(e.target.value);
          if (error) setError(null);
        }}
        onBlur={handleBlur}
        rows={8}
        style={inputStyle}
      />

      {field.helpText ? (
        <div
          style={{
            fontSize: "12px",
            lineHeight: 1.5,
            opacity: 0.72,
          }}
        >
          {field.helpText}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            fontSize: "12px",
            lineHeight: 1.4,
            color: "#ef4444",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      ) : null}
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
  const inputStyle = sharedInputStyle(isLightMode, textColor);

  if (field.type === "text") {
    return (
      <input
        type="text"
        value={typeof currentValue === "string" ? currentValue : ""}
        placeholder={field.placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={typeof currentValue === "string" ? currentValue : ""}
        placeholder={field.placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        style={{
          ...inputStyle,
          resize: "vertical",
          minHeight: "96px",
        }}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={typeof currentValue === "string" ? currentValue : ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputStyle,
          cursor: "pointer",
        }}
      >
        <option value="">Select {field.label}</option>
        {(field.options || []).map((option) => (
          <option key={`${field.key}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "10px 12px",
          borderRadius: "10px",
          border: isLightMode
            ? "1px solid rgba(17,24,39,0.08)"
            : "1px solid rgba(255,255,255,0.08)",
          background: isLightMode ? "#ffffff" : "rgba(255,255,255,0.03)",
          fontSize: "14px",
          color: textColor,
          cursor: "pointer",
        }}
      >
        <span style={{ fontWeight: 600 }}>{field.label}</span>
        <input
          type="checkbox"
          checked={Boolean(currentValue)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  }

  if (field.type === "color") {
    const valHex = typeof currentValue === "string" && currentValue ? currentValue : "#2563eb";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", boxSizing: "border-box" }}>
        <input
          type="color"
          value={valHex.startsWith("#") ? valHex : "#2563eb"}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...colorInputStyle(isLightMode), width: "36px", flexShrink: 0, padding: "2px" }}
        />
        <input
          type="text"
          value={valHex}
          placeholder="#000000"
          onChange={(e) => onChange(e.target.value)}
          style={{ ...sharedInputStyle(isLightMode, textColor), flex: 1, fontFamily: "monospace", fontSize: "11px" }}
        />
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
    <div style={{ display: "grid", gap: "10px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 1. Global Sizing Controls (Figma Inspector Grid) */}
      <section style={sectionCardStyle(isLightMode)}>
        <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
          LAYOUT & DIMENSIONS
        </div>

        {/* 2-Column Figma Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {/* Banner Height */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>Height (px)</label>
            <input
              type="number"
              min="160"
              max="800"
              step="10"
              value={bannerHeightNum}
              onChange={(e) => updateBlockProps(slides, { banner_height: Number(e.target.value) || 380 })}
              style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", fontFamily: "monospace", fontWeight: 700 }}
            />
          </div>

          {/* Banner Width */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>Width (% or px)</label>
            <input
              type="text"
              placeholder="100% or 1200px"
              value={bannerWidthVal}
              onChange={(e) => updateBlockProps(slides, { banner_width: e.target.value })}
              style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", fontFamily: "monospace", fontWeight: 700 }}
            />
          </div>

          {/* Border Radius */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>Radius (px)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="2"
              value={borderRadiusNum}
              onChange={(e) => updateBlockProps(slides, { border_radius: Number(e.target.value) || 0 })}
              style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", fontFamily: "monospace", fontWeight: 700 }}
            />
          </div>

          {/* Rotation Speed */}
          <div style={{ display: "grid", gap: "2px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>Speed (sec)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={autoPlayInterval}
              onChange={(e) => updateBlockProps(slides, { auto_play_interval: Number(e.target.value) || 3 })}
              style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", fontFamily: "monospace" }}
            />
          </div>
        </div>

        {/* Auto-play Checkbox */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
          <input
            type="checkbox"
            id="hero-autoplay-toggle"
            checked={autoPlay}
            onChange={(e) => updateBlockProps(slides, { auto_play: e.target.checked })}
            style={{ width: "13px", height: "13px", cursor: "pointer", accentColor }}
          />
          <label htmlFor="hero-autoplay-toggle" style={{ fontSize: "11px", fontWeight: 600, cursor: "pointer", color: textColor }}>
            Auto-rotate slides
          </label>
        </div>
      </section>

      {/* 2. Hero Slides Accordion List (Figma Page Layers) */}
      <section style={sectionCardStyle(isLightMode)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>
            SLIDES ({slides.length})
          </div>
          <span style={{ fontSize: "9px", color: "#94a3b8" }}>⋮⋮ Drag to reorder</span>
        </div>

        <div style={{ display: "grid", gap: "6px", marginTop: "2px" }}>
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
                  border: isExpanded ? `1.5px solid ${accentColor}` : "1px solid #e2e8f0",
                  borderRadius: "5px",
                  background: isExpanded ? "#f8fafc" : "#ffffff",
                  opacity: draggedIdx === idx ? 0.5 : 1,
                  transition: "all 150ms ease",
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
                    padding: "6px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                    cursor: "pointer",
                    background: isExpanded ? "rgba(37,99,235,0.04)" : "transparent",
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1, overflow: "hidden" }}>
                    <span style={{ cursor: "grab", fontSize: "11px", color: "#94a3b8", userSelect: "none", flexShrink: 0 }}>
                      ⋮⋮
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 4px", borderRadius: "3px", background: "#f1f5f9", color: "#475569", flexShrink: 0 }}>
                      {variantLabel}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: textColor, minWidth: 0 }}>
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
                      fontSize: "10px",
                      flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div style={{ padding: "8px", borderTop: "1px solid #e2e8f0", display: "grid", gap: "8px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                    {/* Variant Selector */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Variant</label>
                      <select
                        value={slideVariant}
                        onChange={(e) => handleSlideChange(idx, "variant", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box", cursor: "pointer" }}
                      >
                        <option value="standard">Standard Banner</option>
                        <option value="flash_sale">⚡️ Flash Sale Offer</option>
                        <option value="product_launch">🚀 Product Showcase</option>
                        <option value="minimal_brand">✨ Minimal Trust Badges</option>
                      </select>
                    </div>

                    {/* Headline */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Headline</label>
                      <input
                        type="text"
                        value={slide.headline || ""}
                        onChange={(e) => handleSlideChange(idx, "headline", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                      />
                    </div>

                    {/* Subheadline */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Subheadline</label>
                      <textarea
                        rows={2}
                        value={slide.subheadline || ""}
                        onChange={(e) => handleSlideChange(idx, "subheadline", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box", resize: "vertical" }}
                      />
                    </div>

                    {/* Tag Pill */}
                    <div style={{ display: "grid", gap: "2px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Badge Tag Pill</label>
                      <input
                        type="text"
                        value={slide.badge || ""}
                        onChange={(e) => handleSlideChange(idx, "badge", e.target.value)}
                        placeholder="FLASH SALE..."
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                      />
                    </div>

                    {/* Background Color & Gradient Picker */}
                    <div style={{ display: "grid", gap: "4px", padding: "6px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>Slide Background Color</label>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", width: "100%", minWidth: 0 }}>
                        <input
                          type="color"
                          value={slide.background_color?.startsWith("#") ? slide.background_color : "#0f766e"}
                          onChange={(e) => handleSlideChange(idx, "background_color", e.target.value)}
                          style={{ width: "28px", height: "28px", padding: "0", border: "none", background: "none", cursor: "pointer", flexShrink: 0 }}
                        />
                        <input
                          type="text"
                          placeholder="e.g. #0f766e or gradient"
                          value={slide.background_color || ""}
                          onChange={(e) => handleSlideChange(idx, "background_color", e.target.value)}
                          style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", flex: 1, minWidth: 0, boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Variant Specific Fields */}
                    {slideVariant === "flash_sale" && (
                      <div style={{ display: "grid", gap: "6px", padding: "6px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                        <div style={{ fontSize: "9px", fontWeight: 800, color: "#ef4444", textTransform: "uppercase" }}>⚡️ Flash Sale</div>
                        <input
                          type="text"
                          value={slide.coupon_code || ""}
                          onChange={(e) => handleSlideChange(idx, "coupon_code", e.target.value)}
                          placeholder="Coupon (e.g. SAVE50)"
                          style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                        />
                        <input
                          type="datetime-local"
                          value={slide.sale_end_time || ""}
                          onChange={(e) => handleSlideChange(idx, "sale_end_time", e.target.value)}
                          style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box", fontFamily: "monospace" }}
                        />
                      </div>
                    )}

                    {slideVariant === "product_launch" && (
                      <div style={{ display: "grid", gap: "6px", padding: "6px", background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                        <div style={{ fontSize: "9px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase" }}>🚀 Product Card</div>
                        <input
                          type="text"
                          placeholder="Product Title"
                          value={slide.product_card?.title || ""}
                          onChange={(e) => handleSlideChange(idx, "product_card.title", e.target.value)}
                          style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: "4px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                          <input
                            type="text"
                            placeholder="Price ($249)"
                            value={slide.product_card?.price || ""}
                            onChange={(e) => handleSlideChange(idx, "product_card.price", e.target.value)}
                            style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", flex: 1, minWidth: 0, boxSizing: "border-box" }}
                          />
                          <input
                            type="text"
                            placeholder="Original ($349)"
                            value={slide.product_card?.original_price || ""}
                            onChange={(e) => handleSlideChange(idx, "product_card.original_price", e.target.value)}
                            style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", flex: 1, minWidth: 0, boxSizing: "border-box" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Dynamic Trust Badges Array Editor */}
                    {(slideVariant === "minimal_brand" || slideVariant === "standard") && (
                      <div style={{ display: "grid", gap: "4px", padding: "6px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <label style={{ fontSize: "9px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                            TRUST BADGES ({trustBadgesList.length})
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedBadges = [...trustBadgesList, "New Trust Feature"];
                              handleSlideChange(idx, "trust_badges", updatedBadges);
                            }}
                            style={{ padding: "1px 5px", borderRadius: "3px", border: "1px solid #2563eb", background: "rgba(37,99,235,0.08)", color: "#2563eb", fontSize: "9px", fontWeight: 700, cursor: "pointer" }}
                          >
                            + Add
                          </button>
                        </div>
                        {trustBadgesList.map((badgeText: string, bIdx: number) => (
                          <div key={bIdx} style={{ display: "flex", gap: "4px", alignItems: "center", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                            <input
                              type="text"
                              value={badgeText}
                              onChange={(e) => {
                                const updatedBadges = [...trustBadgesList];
                                updatedBadges[bIdx] = e.target.value;
                                handleSlideChange(idx, "trust_badges", updatedBadges);
                              }}
                              style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", flex: 1, minWidth: 0, boxSizing: "border-box" }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updatedBadges = trustBadgesList.filter((_: any, i: number) => i !== bIdx);
                                handleSlideChange(idx, "trust_badges", updatedBadges);
                              }}
                              style={{ padding: "3px 6px", borderRadius: "3px", border: "none", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "10px", cursor: "pointer", flexShrink: 0 }}
                            >
                              🗑
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Primary Button Card */}
                    <div style={{ display: "grid", gap: "4px", padding: "6px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>PRIMARY BUTTON</label>
                      <input
                        type="text"
                        placeholder="Label (Shop Now)"
                        value={slide.primary_cta?.label || ""}
                        onChange={(e) => handleSlideChange(idx, "primary_cta.label", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                      />
                      <input
                        type="text"
                        placeholder="Link URL (/products)"
                        value={slide.primary_cta?.href || ""}
                        onChange={(e) => handleSlideChange(idx, "primary_cta.href", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                      />
                    </div>

                    {/* Secondary Button Card */}
                    <div style={{ display: "grid", gap: "4px", padding: "6px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>SECONDARY BUTTON</label>
                      <input
                        type="text"
                        placeholder="Label (Explore)"
                        value={slide.secondary_cta?.label || ""}
                        onChange={(e) => handleSlideChange(idx, "secondary_cta.label", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                      />
                      <input
                        type="text"
                        placeholder="Link URL (/categories)"
                        value={slide.secondary_cta?.href || ""}
                        onChange={(e) => handleSlideChange(idx, "secondary_cta.href", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
                      />
                    </div>

                    {/* Background Image Card */}
                    <div style={{ display: "grid", gap: "4px", padding: "6px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "5px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                      <label style={{ fontSize: "9px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>BACKGROUND IMAGE URL</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={slide.background_image || ""}
                        onChange={(e) => handleSlideChange(idx, "background_image", e.target.value)}
                        style={{ ...sharedInputStyle(isLightMode, textColor), padding: "4px 6px", fontSize: "11px", width: "100%", minWidth: 0, boxSizing: "border-box" }}
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

  const textColor = "#111827";
  const accentColor = "#2563eb";
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

  const isNavbarSelected = selectedBlock?.type === "navbar";

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
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        flexShrink: 0,
        position: "relative",
        top: "auto",
        overflowY: "auto",
        overflowX: "hidden",
        padding: "12px",
        boxSizing: "border-box",
        color: "#111827",
        background: "#ffffff",
        border: "none",
        borderRadius: 0,
      }}
    >
      {/* Sleek Figma Inspector Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        <button
          onClick={() => onTabChange("theme")}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background:
              selectedTab === "theme"
                ? accentColor
                : "rgba(17,24,39,0.06)",
            color: selectedTab === "theme" ? "#fff" : textColor,
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Theme
        </button>

        <button
          onClick={() => onTabChange("block")}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background:
              selectedTab === "block"
                ? accentColor
                : "rgba(17,24,39,0.06)",
            color: selectedTab === "block" ? "#fff" : textColor,
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Block
        </button>
      </div>

      {selectedTab === "theme" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {/* Saved Themes Section */}
          <section style={{ ...sectionCardStyle(isLightMode), boxSizing: "border-box", overflow: "hidden" }}>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>
              SAVED THEMES SNAPSHOTS
            </div>
            
            <div style={{ display: "flex", gap: "6px", width: "100%", boxSizing: "border-box" }}>
              <input
                type="text"
                placeholder="Theme name..."
                id="saved-theme-input"
                style={{ ...sharedInputStyle(isLightMode, textColor), flex: 1, minWidth: 0, fontSize: "11px" }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("saved-theme-input") as HTMLInputElement;
                  const name = input ? input.value : "";
                  onSiteDefinitionChange(saveThemeSnapshot(siteDefinition, name));
                  if (input) input.value = "";
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "none",
                  background: accentColor,
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                + Save
              </button>
            </div>

            {(() => {
              const savedSnapshots = getSavedThemeSnapshots(siteDefinition);
              if (!savedSnapshots.length) return null;
              return (
                <div style={{ display: "grid", gap: "6px", marginTop: "4px", width: "100%", boxSizing: "border-box" }}>
                  {savedSnapshots.map((snap: any) => {
                  const th = snap.theme || {};
                  return (
                    <div
                      key={snap.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        background: "#ffffff",
                        border: "1px solid rgba(15,23,42,0.1)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        gap: "6px",
                        width: "100%",
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0, overflow: "hidden" }}>
                        <div style={{ display: "flex", gap: "2px", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: th.primary_bg || "#ffffff", border: "1px solid #cbd5e1" }} title={`Primary: ${th.primary_bg || '#ffffff'}`} />
                          <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: th.accent_color || "#2563eb", border: "1px solid #cbd5e1" }} title={`Accent: ${th.accent_color || '#2563eb'}`} />
                          <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: th.navbar_bg || "#0f172a", border: "1px solid #cbd5e1" }} title={`Navbar: ${th.navbar_bg || '#0f172a'}`} />
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>{snap.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => onSiteDefinitionChange(applyThemeSnapshot(siteDefinition, snap.id))}
                          style={{
                            padding: "3px 7px",
                            borderRadius: "4px",
                            border: "none",
                            background: "#2563eb",
                            color: "#ffffff",
                            fontSize: "10px",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Apply ✨
                        </button>
                        <button
                          type="button"
                          onClick={() => onSiteDefinitionChange(deleteThemeSnapshot(siteDefinition, snap.id))}
                          style={{
                            padding: "3px 6px",
                            borderRadius: "4px",
                            border: "none",
                            background: "rgba(239,68,68,0.1)",
                            color: "#ef4444",
                            fontSize: "10px",
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
            );
          })()}
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>
              APPEARANCE & MODE
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() =>
                  onSiteDefinitionChange(applyThemeMode(siteDefinition, "light"))
                }
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    siteDefinition.theme?.mode === "light"
                      ? accentColor
                      : "#f1f5f9",
                  color:
                    siteDefinition.theme?.mode === "light" ? "#fff" : textColor,
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                Light
              </button>

              <button
                onClick={() =>
                  onSiteDefinitionChange(applyThemeMode(siteDefinition, "dark"))
                }
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    siteDefinition.theme?.mode === "dark"
                      ? accentColor
                      : "#f1f5f9",
                  color:
                    siteDefinition.theme?.mode === "dark" ? "#fff" : textColor,
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                Dark
              </button>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>
              FESTIVE THEMES
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {festivalPresets.map((preset) => {
                const active =
                  (siteDefinition.theme?.festival_theme || "none") === preset;

                return (
                  <button
                    key={preset}
                    onClick={() =>
                      onSiteDefinitionChange(
                        applyFestivalTheme(siteDefinition, preset)
                      )
                    }
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      border: "none",
                      cursor: "pointer",
                      background: active ? accentColor : "#f1f5f9",
                      color: active ? "#fff" : textColor,
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "capitalize",
                    }}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>
              BRAND PALETTE
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "10px", fontWeight: 600, color: "#64748b" }}>Accent Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                  <input
                    type="color"
                    value={siteDefinition.theme?.accent_color || "#2563eb"}
                    onChange={(e) =>
                      onSiteDefinitionChange(
                        updateThemeValues(siteDefinition, {
                          accent_color: e.target.value,
                        })
                      )
                    }
                    style={{ ...colorInputStyle(isLightMode), width: "36px", flexShrink: 0, padding: "2px" }}
                  />
                  <input
                    type="text"
                    value={siteDefinition.theme?.accent_color || "#2563eb"}
                    placeholder="#2563eb"
                    onChange={(e) =>
                      onSiteDefinitionChange(
                        updateThemeValues(siteDefinition, {
                          accent_color: e.target.value,
                        })
                      )
                    }
                    style={{ ...sharedInputStyle(isLightMode, textColor), flex: 1, fontFamily: "monospace", fontSize: "11px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "10px", fontWeight: 600, color: "#64748b" }}>Background Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                  <input
                    type="color"
                    value={siteDefinition.theme?.primary_bg || "#0f172a"}
                    onChange={(e) =>
                      onSiteDefinitionChange(
                        updateThemeValues(siteDefinition, {
                          primary_bg: e.target.value,
                        })
                      )
                    }
                    style={{ ...colorInputStyle(isLightMode), width: "36px", flexShrink: 0, padding: "2px" }}
                  />
                  <input
                    type="text"
                    value={siteDefinition.theme?.primary_bg || "#0f172a"}
                    placeholder="#0f172a"
                    onChange={(e) =>
                      onSiteDefinitionChange(
                        updateThemeValues(siteDefinition, {
                          primary_bg: e.target.value,
                        })
                      )
                    }
                    style={{ ...sharedInputStyle(isLightMode, textColor), flex: 1, fontFamily: "monospace", fontSize: "11px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: "2px" }}>
                <label style={{ fontSize: "10px", fontWeight: 600, color: "#64748b" }}>Text Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                  <input
                    type="color"
                    value={siteDefinition.theme?.text_color || "#f9fafb"}
                    onChange={(e) =>
                      onSiteDefinitionChange(
                        updateThemeValues(siteDefinition, {
                          text_color: e.target.value,
                        })
                      )
                    }
                    style={{ ...colorInputStyle(isLightMode), width: "36px", flexShrink: 0, padding: "2px" }}
                  />
                  <input
                    type="text"
                    value={siteDefinition.theme?.text_color || "#f9fafb"}
                    placeholder="#f9fafb"
                    onChange={(e) =>
                      onSiteDefinitionChange(
                        updateThemeValues(siteDefinition, {
                          text_color: e.target.value,
                        })
                      )
                    }
                    style={{ ...sharedInputStyle(isLightMode, textColor), flex: 1, fontFamily: "monospace", fontSize: "11px" }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
          {/* Sleek Figma Single-Line Inspector Header (NO DUPLICATES) */}
          <div style={{ paddingBottom: "8px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>
                INSPECTOR
              </span>
              <span style={{ fontSize: "10px", color: "#cbd5e1" }}>/</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedBlock ? (editableConfig?.displayName || selectedBlock.type.toUpperCase()) : "NO SELECTION"}
              </span>
            </div>
            {selectedBlock && (
              <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "rgba(37,99,235,0.08)", color: "#2563eb", flexShrink: 0 }}>
                ACTIVE
              </span>
            )}
          </div>

          {!selectedBlock ? (
            <div style={sectionCardStyle(isLightMode)}>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.4 }}>
                Click any block on the page canvas to edit its properties.
              </p>
            </div>
          ) : !editableConfig ? (
            <div style={sectionCardStyle(isLightMode)}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>{selectedBlock.type}</div>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.4 }}>
                This block does not have configurable fields.
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
                    <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>
                      {group.title}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
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
                              <label style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
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