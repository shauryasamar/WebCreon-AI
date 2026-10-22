import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { useAdminTheme } from "../context/ThemeContext";

// ── Color Utilities ─────────────────────────────────────────────────────────────

export interface HsvColor {
  h: number; // 0 - 360
  s: number; // 0 - 1
  v: number; // 0 - 1
  a: number; // 0 - 1
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0;

  if (diff === 0) {
    h = 0;
  } else if (max === r) {
    h = ((g - b) / diff) % 6;
  } else if (max === g) {
    h = (b - r) / diff + 2;
  } else {
    h = (r - g) / diff + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return { h, s, v };
}

export function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

export function hsvToColorString(hsv: HsvColor): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  if (hsv.a <= 0.001) {
    return "transparent";
  }
  if (hsv.a >= 0.999) {
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  }
  const cleanA = Math.round(hsv.a * 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${cleanA})`;
}

export function parseColorToHsv(colorStr: string, fallback = "#3b82f6"): HsvColor {
  if (!colorStr || typeof colorStr !== "string") {
    return parseColorToHsv(fallback, "#3b82f6");
  }
  const str = colorStr.trim().toLowerCase();
  if (str === "transparent") {
    return { h: 210, s: 0.5, v: 0.5, a: 0 };
  }

  // Matches rgba(...) or rgb(...)
  const rgbMatch = str.match(
    /rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (rgbMatch) {
    const r = parseFloat(rgbMatch[1]);
    const g = parseFloat(rgbMatch[2]);
    const b = parseFloat(rgbMatch[3]);
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    const hsv = rgbToHsv(r, g, b);
    return { ...hsv, a: Math.max(0, Math.min(1, isNaN(a) ? 1 : a)) };
  }

  // Matches hex
  let hex = str.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  let a = 1;
  if (hex.length === 8) {
    a = parseInt(hex.substring(6, 8), 16) / 255;
    hex = hex.substring(0, 6);
  }
  if (hex.length === 6) {
    const num = parseInt(hex, 16);
    if (!isNaN(num)) {
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      const hsv = rgbToHsv(r, g, b);
      return { ...hsv, a: isNaN(a) ? 1 : a };
    }
  }

  return { h: 217, s: 0.85, v: 0.95, a: 1 };
}

const CHECKERBOARD_BG =
  "linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)";

// ── Themed Color Picker Popover ────────────────────────────────────────────────

interface ThemedColorPickerPopoverProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const ThemedColorPickerPopover: React.FC<ThemedColorPickerPopoverProps> = ({
  label,
  value,
  onChange,
  onClose,
  anchorRect,
  triggerRef,
}) => {
  const { isDark, tokens } = useAdminTheme();
  const [hsv, setHsv] = useState<HsvColor>(() => parseColorToHsv(value));
  const [inputMode, setInputMode] = useState<"HEX" | "RGB">("HEX");
  const [hexInput, setHexInput] = useState<string>("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const satAreaRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const alphaSliderRef = useRef<HTMLDivElement>(null);

  // Sync HSV on initial open
  useEffect(() => {
    const parsed = parseColorToHsv(value);
    setHsv(parsed);
    const { r, g, b } = hsvToRgb(parsed.h, parsed.s, parsed.v);
    setHexInput(`${toHex2(r)}${toHex2(g)}${toHex2(b)}`.toUpperCase());
  }, [value]);

  // Derived colors
  const { r, g, b } = useMemo(() => hsvToRgb(hsv.h, hsv.s, hsv.v), [hsv.h, hsv.s, hsv.v]);
  const solidHex = useMemo(() => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`.toUpperCase(), [r, g, b]);
  const currentColorStr = useMemo(() => hsvToColorString(hsv), [hsv]);

  // Handle color change and notify parent
  const updateHsv = useCallback(
    (newHsv: HsvColor) => {
      setHsv(newHsv);
      const outStr = hsvToColorString(newHsv);
      onChange(outStr);
      const rgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
      setHexInput(`${toHex2(rgb.r)}${toHex2(rgb.g)}${toHex2(rgb.b)}`.toUpperCase());
    },
    [onChange]
  );

  // Position calculation
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 100, left: 100 });

  useEffect(() => {
    if (!anchorRect) return;
    const popoverWidth = 270;
    const popoverHeight = 275;
    const padding = 12;

    // Prefer left of the anchor if on the right side of screen
    let left = anchorRect.left - popoverWidth - 10;
    if (left < padding) {
      // If it overflows left edge, try right of anchor
      left = anchorRect.right + 10;
      if (left + popoverWidth > window.innerWidth - padding) {
        // Fallback to center-clamped
        left = Math.max(padding, window.innerWidth - popoverWidth - padding);
      }
    }

    let top = anchorRect.top - 20;
    if (top + popoverHeight > window.innerHeight - padding) {
      top = window.innerHeight - popoverHeight - padding;
    }
    if (top < padding) {
      top = padding;
    }

    setPosition({ top, left });
  }, [anchorRect]);

  // Click outside & Escape listener (using capture phase so stopPropagation in sidebar doesn't block closing)
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, triggerRef]);

  // Saturation / Value drag handler
  const handleSatAreaPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!satAreaRef.current) return;
    satAreaRef.current.setPointerCapture(e.pointerId);

    const updateSatVal = (ev: PointerEvent | React.PointerEvent) => {
      if (!satAreaRef.current) return;
      const rect = satAreaRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
      const s = x / rect.width;
      const v = 1 - y / rect.height;
      updateHsv({ ...hsv, s, v });
    };

    updateSatVal(e);

    const onPointerMove = (ev: PointerEvent) => updateSatVal(ev);
    const onPointerUp = (ev: PointerEvent) => {
      if (satAreaRef.current) {
        try {
          satAreaRef.current.releasePointerCapture(ev.pointerId);
        } catch (_) {}
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Hue drag handler
  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hueSliderRef.current) return;
    hueSliderRef.current.setPointerCapture(e.pointerId);

    const updateHue = (ev: PointerEvent | React.PointerEvent) => {
      if (!hueSliderRef.current) return;
      const rect = hueSliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
      const h = Math.round((x / rect.width) * 360) % 360;
      updateHsv({ ...hsv, h });
    };

    updateHue(e);

    const onPointerMove = (ev: PointerEvent) => updateHue(ev);
    const onPointerUp = (ev: PointerEvent) => {
      if (hueSliderRef.current) {
        try {
          hueSliderRef.current.releasePointerCapture(ev.pointerId);
        } catch (_) {}
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Alpha drag handler
  const handleAlphaPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!alphaSliderRef.current) return;
    alphaSliderRef.current.setPointerCapture(e.pointerId);

    const updateAlpha = (ev: PointerEvent | React.PointerEvent) => {
      if (!alphaSliderRef.current) return;
      const rect = alphaSliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
      const a = Math.round((x / rect.width) * 100) / 100;
      updateHsv({ ...hsv, a });
    };

    updateAlpha(e);

    const onPointerMove = (ev: PointerEvent) => updateAlpha(ev);
    const onPointerUp = (ev: PointerEvent) => {
      if (alphaSliderRef.current) {
        try {
          alphaSliderRef.current.releasePointerCapture(ev.pointerId);
        } catch (_) {}
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // EyeDropper API support
  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;
  const triggerEyeDropper = async () => {
    try {
      const dropper = new (window as any).EyeDropper();
      const result = await dropper.open();
      if (result?.sRGBHex) {
        const parsed = parseColorToHsv(result.sRGBHex);
        updateHsv(parsed);
      }
    } catch (_) {}
  };

  // Hex input commit
  const handleHexInputChange = (text: string) => {
    const raw = text.replace(/[^0-9a-fA-F]/g, "").slice(0, 8);
    setHexInput(raw.toUpperCase());
    if (raw.length === 6 || raw.length === 8 || raw.length === 3) {
      const parsed = parseColorToHsv(`#${raw}`);
      setHsv(parsed);
      onChange(hsvToColorString(parsed));
    }
  };

  // RGB number commit
  const handleRgbChange = (channel: "r" | "g" | "b", valStr: string) => {
    const num = Math.max(0, Math.min(255, parseInt(valStr || "0", 10)));
    const newR = channel === "r" ? num : r;
    const newG = channel === "g" ? num : g;
    const newB = channel === "b" ? num : b;
    const newHsv = rgbToHsv(newR, newG, newB);
    updateHsv({ ...newHsv, a: hsv.a });
  };

  const isTransparent = hsv.a <= 0.001;

  const content = (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: "268px",
        background: isDark ? "#18181b" : "#ffffff",
        color: isDark ? "#f4f4f5" : "#0f172a",
        borderRadius: "14px",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: isDark
          ? "0 24px 48px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)"
          : "0 24px 48px -8px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 99999,
        fontFamily: "'Inter', system-ui, sans-serif",
        boxSizing: "border-box",
        userSelect: "none",
        animation: "wcFadeIn 0.14s ease-out",
      }}
    >
      <style>{`@keyframes wcFadeIn { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "4px",
              backgroundColor: isTransparent ? "transparent" : currentColorStr,
              backgroundImage: isTransparent ? CHECKERBOARD_BG : undefined,
              backgroundSize: "6px 6px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: isDark ? "#f4f4f5" : "#0f172a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={label || "Color Picker"}
          >
            {label || "Color Picker"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {hasEyeDropper && (
            <button
              type="button"
              onClick={triggerEyeDropper}
              title="Pick color from screen"
              style={{
                background: "transparent",
                border: "none",
                borderRadius: "5px",
                width: "22px",
                height: "22px",
                display: "grid",
                placeItems: "center",
                color: isDark ? "#a1a1aa" : "#64748b",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m2 22 1-1h3l9-9-3-3-9 9v3l-1 1" />
                <path d="m14 7 3-3 4 4-3 3" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              border: "none",
              borderRadius: "5px",
              width: "20px",
              height: "20px",
              display: "grid",
              placeItems: "center",
              color: isDark ? "#a1a1aa" : "#64748b",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── 2D Saturation / Value Gradient Canvas ── */}
      <div
        ref={satAreaRef}
        onPointerDown={handleSatAreaPointer}
        style={{
          position: "relative",
          width: "100%",
          height: "136px",
          borderRadius: "8px",
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          cursor: "crosshair",
          overflow: "hidden",
          touchAction: "none",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
        }}
      >
        {/* White-to-transparent saturation gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, #ffffff, transparent)",
          }}
        />
        {/* Transparent-to-black value gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, #000000, transparent)",
          }}
        />
        {/* Draggable Indicator Ring */}
        <div
          style={{
            position: "absolute",
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            border: "2px solid #ffffff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            backgroundColor: solidHex,
          }}
        />
      </div>

      {/* ── Sliders & Preview Row ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Hue Rainbow Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            ref={hueSliderRef}
            onPointerDown={handleHuePointer}
            style={{
              position: "relative",
              flex: 1,
              height: "12px",
              borderRadius: "6px",
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
              cursor: "pointer",
              touchAction: "none",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `${(hsv.h / 360) * 100}%`,
                top: "50%",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: `hsl(${hsv.h}, 100%, 50%)`,
                border: "2px solid #ffffff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Alpha / Opacity Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            ref={alphaSliderRef}
            onPointerDown={handleAlphaPointer}
            style={{
              position: "relative",
              flex: 1,
              height: "12px",
              borderRadius: "6px",
              backgroundColor: "transparent",
              backgroundImage: CHECKERBOARD_BG,
              backgroundSize: "6px 6px",
              cursor: "pointer",
              touchAction: "none",
              overflow: "hidden",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to right, transparent, ${solidHex})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${hsv.a * 100}%`,
                top: "50%",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "#ffffff",
                border: `2px solid ${solidHex}`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.25)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              fontFamily: "monospace",
              color: isDark ? "#a1a1aa" : "#64748b",
              width: "32px",
              textAlign: "right",
            }}
          >
            {Math.round(hsv.a * 100)}%
          </span>
        </div>
      </div>

      {/* ── Mode Inputs (HEX vs RGB) ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
          padding: "4px 6px",
          borderRadius: "7px",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
        }}
      >
        <button
          type="button"
          onClick={() => setInputMode((prev) => (prev === "HEX" ? "RGB" : "HEX"))}
          style={{
            fontSize: "9.5px",
            fontWeight: 700,
            color: isDark ? tokens.accent : "#2563eb",
            background: isDark ? "rgba(59,130,246,0.12)" : "#eff6ff",
            border: "none",
            borderRadius: "4px",
            padding: "2px 6px",
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
          title="Toggle HEX / RGB mode"
        >
          {inputMode} ⇅
        </button>

        {inputMode === "HEX" ? (
          <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, gap: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#71717a" : "#94a3b8" }}>#</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              placeholder="FFFFFF"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                color: isDark ? "#f4f4f5" : "#0f172a",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "monospace",
                letterSpacing: "0.03em",
                outline: "none",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
            {(["r", "g", "b"] as const).map((channel) => (
              <div key={channel} style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1 }}>
                <span style={{ fontSize: "8.5px", fontWeight: 700, color: isDark ? "#71717a" : "#94a3b8" }}>
                  {channel.toUpperCase()}
                </span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={channel === "r" ? r : channel === "g" ? g : b}
                  onChange={(e) => handleRgbChange(channel, e.target.value)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    color: isDark ? "#f4f4f5" : "#0f172a",
                    fontSize: "10px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    outline: "none",
                    padding: 0,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => updateHsv({ ...hsv, a: 0 })}
          title="Set Transparent"
          style={{
            fontSize: "9px",
            fontWeight: 600,
            color: isTransparent ? "#ef4444" : isDark ? "#a1a1aa" : "#64748b",
            backgroundColor: isTransparent
              ? isDark
                ? "rgba(239,68,68,0.18)"
                : "#fee2e2"
              : isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
            border: "none",
            borderRadius: "4px",
            padding: "2px 6px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

// ── Themed Color Swatch Trigger (Drop-in replacement for native color inputs) ────

interface ThemedColorSwatchProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  size?: number;
  borderRadius?: string | number;
}

export const ThemedColorSwatch: React.FC<ThemedColorSwatchProps> = ({
  value,
  onChange,
  label,
  placeholder,
  size = 18,
  borderRadius = "50%",
}) => {
  const { isDark } = useAdminTheme();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const rawStr = typeof value === "string" ? value : "";
  const isTransparent = rawStr.toLowerCase() === "transparent";
  const defaultFallbackHex = isDark ? "#0f172a" : "#ffffff";
  const activeColor = rawStr || placeholder || defaultFallbackHex;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        title={label ? `Choose ${label} color` : "Choose color"}
        style={{
          position: "relative",
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          minHeight: `${size}px`,
          borderRadius,
          backgroundColor: isTransparent ? "transparent" : activeColor,
          backgroundImage: isTransparent ? CHECKERBOARD_BG : undefined,
          backgroundSize: isTransparent ? "6px 6px" : undefined,
          border: isOpen
            ? (isDark ? "1.5px solid rgba(255,255,255,0.6)" : "1.5px solid rgba(0,0,0,0.5)")
            : (isDark ? "1.5px solid rgba(255,255,255,0.25)" : "1.5px solid rgba(0,0,0,0.18)"),
          boxShadow: isOpen
            ? "0 2px 6px rgba(0,0,0,0.25)"
            : "0 1px 2px rgba(0,0,0,0.18)",
          outline: "none",
          WebkitAppearance: "none",
          appearance: "none",
          cursor: "pointer",
          flexShrink: 0,
          overflow: "hidden",
          padding: 0,
          display: "grid",
          placeItems: "center",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      />

      {isOpen && (
        <ThemedColorPickerPopover
          label={label}
          value={rawStr || placeholder || defaultFallbackHex}
          onChange={onChange}
          onClose={() => setIsOpen(false)}
          anchorRect={anchorRect}
          triggerRef={triggerRef}
        />
      )}
    </>
  );
};
