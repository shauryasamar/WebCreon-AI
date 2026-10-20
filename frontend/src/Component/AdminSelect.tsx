import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAdminTheme } from "../context/ThemeContext";

export type AdminSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type AdminSelectProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (e: any) => void;
  options?: AdminSelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  name?: string;
  id?: string;
  required?: boolean;
  direction?: "auto" | "up" | "down";
};

export const AdminSelect: React.FC<AdminSelectProps> = ({
  value,
  defaultValue,
  onChange,
  options,
  children,
  placeholder = "Select...",
  disabled = false,
  style = {},
  className = "",
  name,
  id,
  direction = "auto",
}) => {
  const { isDark, tokens } = useAdminTheme();
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(direction === "up");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Extract options either from prop or recursively from <option> children
  const parsedOptions = useMemo<AdminSelectOption[]>(() => {
    if (options && options.length > 0) return options;
    const list: AdminSelectOption[] = [];
    const extract = (nodes: React.ReactNode) => {
      React.Children.forEach(nodes, (child) => {
        if (!child) return;
        if (React.isValidElement(child)) {
          if (child.type === "option") {
            const val = String((child.props as any).value ?? "");
            const lbl = (child.props as any).children ?? val;
            list.push({
              value: val,
              label: lbl,
              disabled: Boolean((child.props as any).disabled),
            });
          } else if ((child.props as any)?.children) {
            extract((child.props as any).children);
          }
        }
      });
    };
    extract(children);
    return list;
  }, [options, children]);

  // Current selected option
  const effectiveValue = value !== undefined ? value : defaultValue;
  const selectedOption = parsedOptions.find((o) => String(o.value) === String(effectiveValue));

  // Auto flip upward if close to bottom of viewport or explicitly instructed
  useEffect(() => {
    if (!open) return;
    if (direction === "up") {
      setOpenUpward(true);
      return;
    }
    if (direction === "down") {
      setOpenUpward(false);
      return;
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 250 && rect.top > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [open, direction]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (opt: AdminSelectOption) => {
    if (opt.disabled || disabled) return;
    if (onChange) {
      const syntheticEvent = {
        target: { value: opt.value, name: name || "" },
        currentTarget: { value: opt.value, name: name || "" },
        value: opt.value,
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(syntheticEvent);
    }
    setOpen(false);
  };

  const {
    width,
    minWidth,
    maxWidth,
    flex,
    height = "36px",
    fontSize = "13px",
    borderRadius = "9px",
    ...restStyle
  } = style;

  return (
    <div
      ref={containerRef}
      className={`wc-admin-select-container ${className}`}
      style={{
        position: "relative",
        width: width || (flex ? "auto" : "100%"),
        minWidth: minWidth || "130px",
        maxWidth: maxWidth || "100%",
        flex: flex,
        boxSizing: "border-box",
        userSelect: "none",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        style={{
          width: "100%",
          height: height,
          padding: "0 12px",
          paddingRight: "34px",
          borderRadius: borderRadius,
          border: open
            ? `1px solid ${tokens.accent || "#3b82f6"}`
            : isDark
            ? "1px solid rgba(255, 255, 255, 0.12)"
            : "1px solid var(--admin-border, rgba(15, 23, 42, 0.14))",
          background: isDark ? tokens.elevatedSurfaceBg || "#1e293b" : "#ffffff",
          color: selectedOption ? tokens.textPrimary : tokens.textMuted || "#64748b",
          fontSize: fontSize,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          outline: "none",
          boxShadow: open
            ? `0 0 0 3px ${isDark ? "rgba(59, 130, 246, 0.25)" : "rgba(59, 130, 246, 0.15)"}`
            : "0 1px 2px rgba(0, 0, 0, 0.03)",
          transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          boxSizing: "border-box",
          opacity: disabled ? 0.6 : 1,
          position: "relative",
          ...restStyle,
        }}
      >
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
            display: "block",
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {/* Sleek rotating chevron */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: "absolute",
            right: "11px",
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
            width: "13px",
            height: "13px",
            color: open ? (tokens.accent || "#3b82f6") : isDark ? "#94a3b8" : "#64748b",
            transition: "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Floating Modern Custom Dropdown Menu */}
      {open && (
        <div
          className="wc-admin-dropdown-menu"
          style={{
            position: "absolute",
            ...(openUpward
              ? { bottom: "calc(100% + 5px)" }
              : { top: "calc(100% + 5px)" }),
            left: 0,
            minWidth: "100%",
            width: "max-content",
            maxWidth: "min(380px, 92vw)",
            zIndex: 999999,
            background: isDark ? "rgba(24, 24, 27, 0.98)" : "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "12px",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.14)" : "1px solid rgba(15, 23, 42, 0.10)",
            boxShadow: isDark
              ? "0 18px 45px -4px rgba(0, 0, 0, 0.85), 0 4px 14px -2px rgba(0, 0, 0, 0.5)"
              : "0 18px 45px -4px rgba(15, 23, 42, 0.16), 0 4px 14px -2px rgba(15, 23, 42, 0.08)",
            maxHeight: "260px",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "5px",
            boxSizing: "border-box",
            animation: "wcDropdownIn 0.14s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <style>{`
            @keyframes wcDropdownIn {
              from { opacity: 0; transform: scale(0.97) translateY(-3px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .wc-admin-dropdown-menu::-webkit-scrollbar {
              width: 5px;
            }
            .wc-admin-dropdown-menu::-webkit-scrollbar-track {
              background: transparent;
            }
            .wc-admin-dropdown-menu::-webkit-scrollbar-thumb {
              background: ${isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.18)"};
              border-radius: 10px;
            }
            .wc-admin-dropdown-menu::-webkit-scrollbar-thumb:hover {
              background: ${isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"};
            }
          `}</style>
          {parsedOptions.length === 0 ? (
            <div style={{ padding: "8px 12px", fontSize: "12px", color: tokens.textMuted || "#64748b" }}>
              No options
            </div>
          ) : (
            parsedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(effectiveValue);
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={`${opt.value}-${idx}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: fontSize,
                    fontWeight: isSelected ? 600 : 500,
                    color: opt.disabled
                      ? (isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(15, 23, 42, 0.3)")
                      : isSelected
                      ? isDark
                        ? "#93c5fd"
                        : "#2563eb"
                      : tokens.textPrimary,
                    background: isSelected
                      ? isDark
                        ? "rgba(59, 130, 246, 0.18)"
                        : "#eff6ff"
                      : isHovered
                      ? isDark
                        ? "rgba(255, 255, 255, 0.07)"
                        : "rgba(15, 23, 42, 0.05)"
                      : "transparent",
                    cursor: opt.disabled ? "not-allowed" : "pointer",
                    transition: "all 0.12s ease",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ minWidth: 0, flex: 1, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {opt.label}
                  </span>

                  {/* Checkmark icon for active item */}
                  {isSelected && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isDark ? "#93c5fd" : "#2563eb"}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: "13px", height: "13px", flexShrink: 0 }}
                    >
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
};

export default AdminSelect;
