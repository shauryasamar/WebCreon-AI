import React, { useEffect, useMemo, useState } from "react";
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
    padding: "10px 12px",
    borderRadius: "10px",
    border: isLightMode
      ? "1px solid rgba(17,24,39,0.12)"
      : "1px solid rgba(255,255,255,0.12)",
    background: isLightMode ? "#ffffff" : "rgba(255,255,255,0.04)",
    color: textColor,
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
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
    boxSizing: "border-box",
  };
}

function sectionCardStyle(_isLightMode: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "12px",
    padding: "12px",
    borderRadius: "4px",
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#ffffff",
  };
}

function blockFieldCardStyle(_isLightMode: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: "8px",
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#ffffff",
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
  if (["brandName", "tagline"].includes(field.key)) return "Brand";

  if (["showSearch", "showAccount", "showCart"].includes(field.key)) {
    return "Actions";
  }

  if (
    [
      "navbar_variant",
      "navbar_position",
      "navbar_height",
      "navbar_max_width",
      "navbar_radius",
      "navbar_padding_x",
      "navbar_padding_y",
    ].includes(field.key)
  ) {
    return "Layout";
  }

  if (
    [
      "navbar_bg",
      "navbar_text_color",
      "navbar_muted_text_color",
      "navbar_border_color",
    ].includes(field.key)
  ) {
    return "Colors";
  }

  return "Settings";
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

export default function EditorSidebar({
  siteDefinition,
  selectedBlockId,
  selectedTab,
  onTabChange,
  onSiteDefinitionChange,
}: EditorSidebarProps) {
  const isLightMode = true;

  // const textColor = isLightMode
  //   ? "#111827"
  //   : siteDefinition.theme?.text_color || "#f9fafb";

  // const accentColor = siteDefinition.theme?.accent_color || "#2563eb";
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
        padding: "16px",
        boxSizing: "border-box",
        color: "#111827",
        background: "#ffffff",
        border: "none",
        borderRadius: 0,
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
        <div style={{ display: "grid", gap: "16px" }}>
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
            ) : isNavbarSelected ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  opacity: 0.75,
                  lineHeight: 1.5,
                }}
              >
                Adjust brand, actions, layout, spacing, and colors for the storefront
                navbar.
              </p>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  opacity: 0.75,
                  lineHeight: 1.5,
                }}
              >
                Update the selected block settings here.
              </p>
            )}
          </div>

          {!selectedBlock ? (
            <div style={sectionCardStyle(isLightMode)}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  opacity: 0.72,
                  lineHeight: 1.5,
                }}
              >
                Select a visible block from the page canvas to edit its content
                and appearance.
              </p>
            </div>
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
            <>
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

              {fieldGroups.map((group) => (
                <section key={group.title} style={sectionCardStyle(isLightMode)}>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      {group.title}
                    </div>
                    {isNavbarSelected && group.title === "Layout" ? (
                      <div
                        style={{ fontSize: "12px", opacity: 0.72, lineHeight: 1.5 }}
                      >
                        Static scrolls with the page, sticky stays visible while
                        scrolling, and fixed preview position creates a stronger pinned
                        effect inside the builder preview.
                      </div>
                    ) : null}
                  </div>

                  {group.items.map((field) => {
                    const currentValue =
                      field.target === "theme"
                        ? siteDefinition.theme?.[
                            field.key as keyof typeof siteDefinition.theme
                          ]
                        : selectedBlock.props?.[field.key];

                    return (
                      <div
                        key={field.key}
                        style={
                          field.type === "checkbox"
                            ? undefined
                            : blockFieldCardStyle(isLightMode)
                        }
                      >
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

                        {field.helpText && field.type !== "json" ? (
                          <div
                            style={{
                              fontSize: "12px",
                              lineHeight: 1.5,
                              opacity: 0.68,
                            }}
                          >
                            {field.helpText}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </section>
              ))}
            </>
          )}
        </div>
      )}
    </aside>
  );
}