import React from "react";
import {
  applyFestivalTheme,
  applyThemeMode,
  EditorSiteDefinition,
  FestivalThemeKey,
  findBlockById,
  getEditableConfigForBlock,
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

function sharedInputStyle(
  isLightMode: boolean,
  textColor: string
): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: isLightMode
      ? "1px solid rgba(17,24,39,0.12)"
      : "1px solid rgba(255,255,255,0.12)",
    background: isLightMode ? "#ffffff" : "rgba(255,255,255,0.04)",
    color: textColor,
    fontSize: "14px",
    outline: "none",
  };
}

function colorInputStyle(isLightMode: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: "44px",
    padding: "4px",
    borderRadius: "10px",
    border: isLightMode
      ? "1px solid rgba(17,24,39,0.12)"
      : "1px solid rgba(255,255,255,0.12)",
    background: isLightMode ? "#ffffff" : "rgba(255,255,255,0.04)",
    cursor: "pointer",
  };
}

function sectionCardStyle(isLightMode: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "12px",
    padding: "14px",
    borderRadius: "12px",
    background: isLightMode
      ? "rgba(17,24,39,0.04)"
      : "rgba(255,255,255,0.04)",
  };
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
        style={inputStyle}
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
        value={currentValue ?? ""}
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
          gap: "10px",
          fontSize: "14px",
          color: textColor,
        }}
      >
        <input
          type="checkbox"
          checked={Boolean(currentValue)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  if (field.type === "color") {
    return (
      <input
        type="color"
        value={
          typeof currentValue === "string" && currentValue
            ? currentValue
            : "#2563eb"
        }
        onChange={(e) => onChange(e.target.value)}
        style={colorInputStyle(isLightMode)}
      />
    );
  }

  return null;
}

export default function EditorSidebar({
  siteDefinition,
  selectedBlockId,
  selectedTab,
  onTabChange,
  onSiteDefinitionChange,
}: EditorSidebarProps) {
  const isLightMode = siteDefinition.theme?.mode === "light";

  const textColor = isLightMode
    ? "#111827"
    : siteDefinition.theme?.text_color || "#f9fafb";

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
        width: "320px",
        flexShrink: 0,
        borderLeft: isLightMode
          ? "1px solid rgba(17,24,39,0.08)"
          : "1px solid rgba(255,255,255,0.08)",
        background: isLightMode
          ? "rgba(255,255,255,0.96)"
          : "rgba(15,23,42,0.96)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
        <button
          onClick={() => onTabChange("theme")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            background:
              selectedTab === "theme"
                ? accentColor
                : isLightMode
                ? "rgba(17,24,39,0.06)"
                : "rgba(255,255,255,0.08)",
            color: selectedTab === "theme" ? "#fff" : textColor,
            fontWeight: 600,
          }}
        >
          Theme
        </button>

        <button
          onClick={() => onTabChange("block")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            background:
              selectedTab === "block"
                ? accentColor
                : isLightMode
                ? "rgba(17,24,39,0.06)"
                : "rgba(255,255,255,0.08)",
            color: selectedTab === "block" ? "#fff" : textColor,
            fontWeight: 600,
          }}
        >
          Block
        </button>
      </div>

      {selectedTab === "theme" ? (
        <div style={{ display: "grid", gap: "18px" }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Theme</h3>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                opacity: 0.75,
                lineHeight: 1.5,
              }}
            >
              Control appearance, festive styling, and brand colors for the whole
              site.
            </p>
          </div>

          <section style={sectionCardStyle(isLightMode)}>
            <div>
              <div
                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
              >
                Appearance
              </div>
              <div style={{ fontSize: "13px", opacity: 0.72 }}>
                Switch the overall website mode.
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() =>
                  onSiteDefinitionChange(applyThemeMode(siteDefinition, "light"))
                }
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    siteDefinition.theme?.mode === "light"
                      ? accentColor
                      : isLightMode
                      ? "#ffffff"
                      : "rgba(255,255,255,0.06)",
                  color:
                    siteDefinition.theme?.mode === "light" ? "#fff" : textColor,
                  fontWeight: 600,
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
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    siteDefinition.theme?.mode === "dark"
                      ? accentColor
                      : isLightMode
                      ? "#ffffff"
                      : "rgba(255,255,255,0.06)",
                  color:
                    siteDefinition.theme?.mode === "dark" ? "#fff" : textColor,
                  fontWeight: 600,
                }}
              >
                Dark
              </button>
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div>
              <div
                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
              >
                Festive theme
              </div>
              <div style={{ fontSize: "13px", opacity: 0.72 }}>
                Apply a preset mood and color direction.
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
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
                      padding: "8px 12px",
                      borderRadius: "999px",
                      border: "none",
                      cursor: "pointer",
                      background: active
                        ? accentColor
                        : isLightMode
                        ? "#ffffff"
                        : "rgba(255,255,255,0.06)",
                      color: active ? "#fff" : textColor,
                      fontSize: "13px",
                      fontWeight: 600,
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
            <div>
              <div
                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
              >
                Brand colors
              </div>
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>
                Accent color
              </label>
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
                style={colorInputStyle(isLightMode)}
              />
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>
                Background color
              </label>
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
                style={colorInputStyle(isLightMode)}
              />
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>
                Text color
              </label>
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
                style={colorInputStyle(isLightMode)}
              />
            </div>
          </section>

          <section style={sectionCardStyle(isLightMode)}>
            <div>
              <div
                style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}
              >
                Brand feel
              </div>
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>
                Brand tone
              </label>
              <input
                type="text"
                value={siteDefinition.theme?.brand_tone || ""}
                onChange={(e) =>
                  onSiteDefinitionChange(
                    updateThemeValues(siteDefinition, {
                      brand_tone: e.target.value,
                    })
                  )
                }
                style={sharedInputStyle(isLightMode, textColor)}
                placeholder="Warm, premium, playful..."
              />
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>
                Visual style
              </label>
              <input
                type="text"
                value={siteDefinition.theme?.visual_style || ""}
                onChange={(e) =>
                  onSiteDefinitionChange(
                    updateThemeValues(siteDefinition, {
                      visual_style: e.target.value,
                    })
                  )
                }
                style={sharedInputStyle(isLightMode, textColor)}
                placeholder="Minimal, bold, festive..."
              />
            </div>
          </section>
        </div>
      ) : (
        <div>
          <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
            {editableConfig?.displayName || "Selected block"}
          </h3>

          {!selectedBlock ? (
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                opacity: 0.75,
                lineHeight: 1.5,
              }}
            >
              Click any block on the page to start editing it.
            </p>
          ) : !editableConfig ? (
            <div style={sectionCardStyle(isLightMode)}>
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.7,
                    marginBottom: "4px",
                  }}
                >
                  Block type
                </div>
                <div style={{ fontWeight: 600 }}>{selectedBlock.type}</div>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  opacity: 0.72,
                  lineHeight: 1.5,
                }}
              >
                This block is visible in edit mode, but it does not have editable
                fields yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "16px",
              }}
            >
              <div style={sectionCardStyle(isLightMode)}>
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.7,
                    marginBottom: "4px",
                  }}
                >
                  Block type
                </div>
                <div style={{ fontWeight: 600 }}>{selectedBlock.type}</div>
              </div>

              {editableConfig.fields.map((field) => {
                const currentValue =
                  field.target === "theme"
                    ? siteDefinition.theme?.[
                        field.key as keyof typeof siteDefinition.theme
                      ]
                    : selectedBlock.props?.[field.key];

                return (
                  <div key={field.key} style={{ display: "grid", gap: "8px" }}>
                    {field.type !== "checkbox" ? (
                      <label
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
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
          )}
        </div>
      )}
    </aside>
  );
}