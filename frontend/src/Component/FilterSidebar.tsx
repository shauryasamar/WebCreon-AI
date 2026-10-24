import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { isColorDarkHex } from "../context/ThemeContext";
import { useDeviceMode } from "../context/DeviceModeContext";
import { resolveMobileDrawerTheme } from "../utils/mobileDrawerTheme";
import { useDrawerDragToClose } from "../utils/useDrawerDragToClose";

type SortOption = {
  value: string;
  label: string;
  description: string;
};

const SORT_OPTIONS: SortOption[] = [
  { value: "relevance", label: "Relevance", description: "Most relevant matches first" },
  { value: "newest", label: "Newest Arrivals", description: "Recently added products" },
  { value: "price_asc", label: "Price: Low to High", description: "Sort by increasing price" },
  { value: "price_desc", label: "Price: High to Low", description: "Sort by decreasing price" },
  { value: "rating_desc", label: "Highest Rated", description: "Sort by customer rating" },
  { value: "discount_desc", label: "Biggest Discount", description: "Sort by discount percentage" },
];

type FilterSidebarProps = {
  title?: string;
  subtitle?: string;
  itemCount?: number;
  activeFilterCount?: number;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
  onFilterClick?: () => void;
  showFilterButton?: boolean;
  theme?: {
    mode?: string;
    text_color?: string;
    accent_color?: string;
    primary_bg?: string;
    [key: string]: any;
  };
  filters?: string[];
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;

  // Toolbar & Button Layout / Editability
  toolbar_layout?: "space_between" | "center" | "split_stacked";
  toolbar_actions_order?: "filter_first" | "sort_first";
  toolbar_btn_size?: "compact" | "standard" | "large";
  show_sort_button?: boolean;
  show_item_count?: boolean;
  filter_button_label?: string;

  // Button & Dropdown Styles
  toolbar_btn_radius?: string | number;
  toolbar_btn_style?: "outline" | "outlined" | "solid" | "duotone" | "soft" | "ghost";
  sort_dropdown_radius?: string | number;

  // Toolbar & Button Colors
  toolbar_bg?: string;
  filter_btn_bg?: string;
  filter_btn_text?: string;
  sort_btn_bg?: string;
  sort_btn_text?: string;
  toolbar_btn_border_color?: string;
  sort_dropdown_bg?: string;
  sort_dropdown_text_color?: string;
  sort_active_color?: string;
  sort_dropdown_header_label?: string;
  sort_dropdown_border_color?: string;
  filter_accent_color?: string;
  accent_color?: string;
  title_color?: string;
  subtitle_color?: string;
  item_count_color?: string;
};

export const FilterSidebar = ({
  title,
  subtitle,
  itemCount = 0,
  activeFilterCount = 0,
  sortBy = "newest",
  onSortChange,
  onFilterClick,
  showFilterButton = true,
  theme,
  // Toolbar layout & visibility
  toolbar_layout = "space_between",
  toolbar_actions_order = "filter_first",
  toolbar_btn_size = "standard",
  show_sort_button = true,
  show_item_count = true,
  filter_button_label,
  // Toolbar styles
  toolbar_btn_radius,
  toolbar_btn_style = "outlined",
  sort_dropdown_radius,
  // Toolbar colors
  toolbar_bg,
  filter_btn_bg: customFilterBtnBg,
  filter_btn_text: customFilterBtnText,
  sort_btn_bg: customSortBtnBg,
  sort_btn_text: customSortBtnText,
  toolbar_btn_border_color,
  sort_dropdown_bg: customSortDropdownBg,
  sort_dropdown_text_color: customSortDropdownTextColor,
  sort_active_color,
  sort_dropdown_header_label,
  sort_dropdown_border_color,
  filter_accent_color,
  accent_color,
  title_color,
  subtitle_color,
  item_count_color,
}: FilterSidebarProps) => {
  const deviceMode = useDeviceMode();
  const [innerIsMobile, setInnerIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 640;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setInnerIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  const isMobile = deviceMode === "mobile" || innerIsMobile;
  const [sortOpen, setSortOpen] = useState(false);

  const { dragHandleProps, drawerStyle, isDragging } = useDrawerDragToClose({
    onClose: () => setSortOpen(false),
    isOpen: sortOpen && isMobile,
  });
  const sortRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isInsidePreviewStage, setIsInsidePreviewStage] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!sortOpen) return;
    // In builder admin preview, portal to the phone preview stage container if available
    const previewStage = sortRef.current?.closest(".builder-preview-stage") as HTMLElement | null;
    if (deviceMode === "mobile" && previewStage) {
      setPortalTarget(previewStage);
      setIsInsidePreviewStage(true);
    } else {
      setPortalTarget(document.body);
      setIsInsidePreviewStage(false);
    }
  }, [deviceMode, sortOpen]);

  useEffect(() => {
    if (!sortOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sortOpen]);

  useEffect(() => {
    if (!sortOpen || !isMobile || isInsidePreviewStage) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sortOpen, isMobile, isInsidePreviewStage]);

  const isDark =
    (theme?.mode === "dark") ||
    Boolean(toolbar_bg && toolbar_bg !== "transparent" && isColorDarkHex(toolbar_bg)) ||
    ((theme as any)?.filter_bg ? isColorDarkHex((theme as any).filter_bg) : false) ||
    (theme?.primary_bg ? isColorDarkHex(theme.primary_bg) : false) ||
    ((theme as any)?.filter_text_color ? !isColorDarkHex((theme as any).filter_text_color) : false) ||
    (theme?.text_color ? !isColorDarkHex(theme.text_color) : false);

  const resolvedAccentColor = accent_color || filter_accent_color || (theme as any)?.filter_accent_color || theme?.accent_color || (isDark ? "#60a5fa" : "#2563eb");
  const resolvedPrimaryBg = (theme as any)?.filter_bg || theme?.primary_bg || (isDark ? "#0f172a" : "#f8fafc");
  const isSectionDark = isColorDarkHex(resolvedPrimaryBg);

  const textPrimary = (theme as any)?.filter_text_color || (theme?.text_color && (isColorDarkHex(theme.text_color) !== isSectionDark) ? theme.text_color : (isSectionDark ? "#f1f5f9" : "#0f172a"));
  const textSecondary = (theme as any)?.muted_text_color && (isColorDarkHex((theme as any).muted_text_color) !== isSectionDark)
    ? (theme as any).muted_text_color
    : (isSectionDark ? "rgba(241, 245, 249, 0.65)" : "rgba(15, 23, 42, 0.65)");
  const borderColor = toolbar_btn_border_color || (theme as any)?.filter_border_color || (theme as any)?.border_color || (isSectionDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)");

  const baseBtnBg = (theme as any)?.filter_card_bg || (isSectionDark
    ? "rgba(255, 255, 255, 0.08)"
    : (resolvedPrimaryBg === "#ffffff" ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.65)"));

  let filterBtnBg = customFilterBtnBg || (theme as any)?.filter_btn_bg || baseBtnBg;
  let filterBtnText = customFilterBtnText || (theme as any)?.filter_btn_text || textPrimary;
  let filterBorder = borderColor;

  let sortBtnBg = customSortBtnBg || (theme as any)?.sort_btn_bg || baseBtnBg;
  let sortBtnText = customSortBtnText || (theme as any)?.sort_btn_text || textPrimary;
  let sortBorder = borderColor;

  if (toolbar_btn_style === "solid") {
    if (!customFilterBtnBg) filterBtnBg = isSectionDark ? "rgba(255, 255, 255, 0.16)" : "#e2e8f0";
    if (!customSortBtnBg) sortBtnBg = isSectionDark ? "rgba(255, 255, 255, 0.16)" : "#e2e8f0";
    filterBorder = "transparent";
    sortBorder = "transparent";
  } else if (toolbar_btn_style === "duotone" || toolbar_btn_style === "soft") {
    if (!customFilterBtnBg) filterBtnBg = `${resolvedAccentColor}18`;
    if (!customFilterBtnText) filterBtnText = resolvedAccentColor;
    if (!customSortBtnBg) sortBtnBg = `${resolvedAccentColor}18`;
    if (!customSortBtnText) sortBtnText = resolvedAccentColor;
    filterBorder = toolbar_btn_border_color || `${resolvedAccentColor}35`;
    sortBorder = toolbar_btn_border_color || `${resolvedAccentColor}35`;
  } else if (toolbar_btn_style === "ghost") {
    if (!customFilterBtnBg) filterBtnBg = "transparent";
    if (!customSortBtnBg) sortBtnBg = "transparent";
    filterBorder = "transparent";
    sortBorder = "transparent";
  }

  const btnRadius =
    toolbar_btn_radius !== undefined && toolbar_btn_radius !== null && String(toolbar_btn_radius).trim() !== ""
      ? typeof toolbar_btn_radius === "number"
        ? `${toolbar_btn_radius}px`
        : String(toolbar_btn_radius).includes("px") || String(toolbar_btn_radius).includes("%")
          ? String(toolbar_btn_radius)
          : `${toolbar_btn_radius}px`
      : "8px";

  const sizeStyles =
    toolbar_btn_size === "compact"
      ? { height: "30px", padding: "4px 10px", fontSize: "11.5px", iconSize: 12 }
      : toolbar_btn_size === "large"
        ? { height: "40px", padding: "8px 16px", fontSize: "13.5px", iconSize: 15 }
        : { height: "34px", padding: "6px 12px", fontSize: "12.5px", iconSize: 13 };

  const resolvedDropdownRadius =
    sort_dropdown_radius !== undefined && sort_dropdown_radius !== null && String(sort_dropdown_radius).trim() !== ""
      ? typeof sort_dropdown_radius === "number"
        ? `${sort_dropdown_radius}px`
        : String(sort_dropdown_radius).includes("px")
          ? String(sort_dropdown_radius)
          : `${sort_dropdown_radius}px`
      : "12px";

  const dropdownBg = customSortDropdownBg || (theme as any)?.sort_dropdown_bg || (theme as any)?.filter_card_bg || (theme as any)?.dialog_bg || (theme as any)?.surface_bg || (theme as any)?.card_bg || (isSectionDark ? "#1e293b" : "#ffffff");
  const isDropdownDark = isColorDarkHex(dropdownBg);
  const dropdownTextColor = customSortDropdownTextColor || (isDropdownDark ? "#f1f5f9" : "#0f172a");
  const dropdownMutedText = isDropdownDark ? "rgba(241, 245, 249, 0.65)" : "rgba(15, 23, 42, 0.65)";
  const dropdownBorderColor = isDropdownDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.12)";
  const resolvedSortActiveColor =
    sort_active_color ||
    (theme as any)?.sort_active_color ||
    filter_accent_color ||
    resolvedAccentColor;
  const sortHoverBg = `${resolvedSortActiveColor}18`;
  const resolvedSortHeaderLabel =
    sort_dropdown_header_label ||
    (theme as any)?.sort_dropdown_header_label ||
    "SORT BY";
  const resolvedSortBorderColor =
    sort_dropdown_border_color ||
    (theme as any)?.sort_dropdown_border_color ||
    dropdownBorderColor;
  const hoverBg = `${resolvedAccentColor}1c`;

  const mobileTheme = resolveMobileDrawerTheme(theme);

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy) || SORT_OPTIONS[0];

  useEffect(() => {
    if (!sortOpen || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortOpen, isMobile]);

  const displayTitle =
    (title &&
    !["featured products", "featured product", "curated collection"].includes(
      title.toLowerCase().trim()
    )
      ? title
      : null) || "Newest Arrivals";

  const isCentered = toolbar_layout === "center";
  const isStacked = toolbar_layout === "split_stacked";
  const resolvedFilterLabel = filter_button_label && filter_button_label.trim() ? filter_button_label : "Filter & Categories";

  return (
    <div
      className={`product-toolbar-wrapper ${isMobile ? "is-mobile" : ""}`}
      style={{
        background: toolbar_bg || "transparent",
        padding: toolbar_bg && toolbar_bg !== "transparent" ? "8px 12px" : undefined,
        borderRadius: toolbar_bg && toolbar_bg !== "transparent" ? "12px" : undefined,
      }}
    >
      <div
        className="product-toolbar-container"
        style={{
          justifyContent: isCentered ? "center" : "space-between",
          flexDirection: isStacked ? "column" : undefined,
          alignItems: isStacked ? "stretch" : "center",
          textAlign: isCentered ? "center" : undefined,
        }}
      >
        {/* Left: Subtitle & Title */}
        <div className="product-toolbar-title-group" style={{ textAlign: isCentered ? "center" : undefined }}>
          <p
            className="product-toolbar-subtitle"
            style={{
              color: subtitle_color || undefined,
            }}
          >
            {subtitle || "Browse Products"}
          </p>
          <h2
            className="product-toolbar-title"
            title={displayTitle}
            style={{
              justifyContent: isCentered ? "center" : "flex-start",
              color: title_color || undefined,
            }}
          >
            {displayTitle}
            {itemCount > 0 && show_item_count !== false && (
              <span
                className="product-toolbar-title-count"
                style={{
                  color: item_count_color || textSecondary,
                }}
              >
                ({itemCount.toLocaleString()})
              </span>
            )}
          </h2>
        </div>

        {/* Right: Actions */}
        <div
          className="product-toolbar-actions"
          style={{
            justifyContent: isCentered ? "center" : isStacked ? "flex-end" : undefined,
          }}
        >
          {/* Filter button */}
          {showFilterButton && (
            isMobile ? (
              <button
                type="button"
                onClick={onFilterClick}
                className="product-toolbar-icon-btn"
                aria-label={resolvedFilterLabel}
                title={resolvedFilterLabel}
                style={{
                  order: toolbar_actions_order === "sort_first" ? 2 : 1,
                  borderRadius: btnRadius,
                  borderColor: filterBorder,
                  background: filterBtnBg,
                  color: filterBtnText,
                  height: sizeStyles.height,
                  width: sizeStyles.height,
                  minWidth: sizeStyles.height,
                }}
              >
                <svg width={sizeStyles.iconSize + 2} height={sizeStyles.iconSize + 2} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                {activeFilterCount > 0 && (
                  <span className="product-toolbar-icon-badge" style={{ background: resolvedAccentColor }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onFilterClick}
                className="product-toolbar-btn product-toolbar-filter-btn"
                style={{
                  order: toolbar_actions_order === "sort_first" ? 2 : 1,
                  background: filterBtnBg,
                  color: filterBtnText,
                  borderColor: filterBorder,
                  borderRadius: btnRadius,
                  height: sizeStyles.height,
                  padding: sizeStyles.padding,
                  fontSize: sizeStyles.fontSize,
                }}
              >
                <svg width={sizeStyles.iconSize} height={sizeStyles.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                <span>{resolvedFilterLabel}</span>
                {activeFilterCount > 0 && (
                  <span className="product-toolbar-badge" style={{ background: resolvedAccentColor }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )
          )}

          {/* Sort button */}
          {show_sort_button !== false && (
            <div ref={sortRef} style={{ position: "relative", order: toolbar_actions_order === "sort_first" ? 1 : 2 }}>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setSortOpen(!sortOpen)}
                  className="product-toolbar-icon-btn"
                  aria-label={`Sort by: ${currentSort.label}`}
                  title={`Sort by: ${currentSort.label}`}
                  style={{
                    borderColor: sortBy !== "newest" ? resolvedAccentColor : sortBorder,
                    background: sortBy !== "newest" ? `${resolvedAccentColor}16` : sortBtnBg,
                    color: sortBy !== "newest" ? resolvedAccentColor : sortBtnText,
                    borderRadius: btnRadius,
                    height: sizeStyles.height,
                    width: sizeStyles.height,
                    minWidth: sizeStyles.height,
                  }}
                >
                  <svg width={sizeStyles.iconSize + 2} height={sizeStyles.iconSize + 2} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5h10M11 9h7M11 13h4" />
                    <path d="M3 17l3 3 3-3" />
                    <path d="M6 18V4" />
                  </svg>
                  {sortBy !== "newest" && (
                    <span
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        width: "6px",
                        height: "6px",
                        borderRadius: "999px",
                        background: resolvedAccentColor,
                      }}
                    />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSortOpen(!sortOpen)}
                  className="product-toolbar-btn product-toolbar-sort-btn"
                  style={{
                    background: sortBtnBg,
                    color: sortBtnText,
                    borderColor: sortBorder,
                    borderRadius: btnRadius,
                    height: sizeStyles.height,
                    padding: sizeStyles.padding,
                    fontSize: sizeStyles.fontSize,
                  }}
                >
                  <svg width={sizeStyles.iconSize} height={sizeStyles.iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M11 5h10M11 9h7M11 13h4" />
                    <path d="M3 17l3 3 3-3" />
                    <path d="M6 18V4" />
                  </svg>
                  <span>
                    Sort by: <strong style={{ fontWeight: 600 }}>{currentSort.label}</strong>
                  </span>
                  <span style={{ fontSize: "8px", marginLeft: "3px", opacity: 0.75, transition: "transform 200ms", transform: sortOpen ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                </button>
              )}

              {/* Desktop Popover Dropdown */}
              {sortOpen && !isMobile && (
                <div
                  className="product-sort-dropdown"
                  style={{
                    background: `${dropdownBg} !important`,
                    backgroundColor: `${dropdownBg} !important`,
                    border: `1px solid ${resolvedSortBorderColor} !important`,
                    borderRadius: `${resolvedDropdownRadius} !important`,
                  }}
                >
                  <div className="product-sort-header" style={{ color: dropdownMutedText, borderBottom: `1px solid ${resolvedSortBorderColor}` }}>
                    {resolvedSortHeaderLabel}
                  </div>
                  {SORT_OPTIONS.map((opt) => {
                    const isActive = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onSortChange?.(opt.value);
                          setSortOpen(false);
                        }}
                        className="product-sort-item"
                        style={{
                          background: isActive ? sortHoverBg : "transparent",
                          borderRadius: `calc(${resolvedDropdownRadius} - 4px)`,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: isActive ? 700 : 500, color: isActive ? resolvedSortActiveColor : dropdownTextColor }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: "11px", color: dropdownMutedText, marginTop: "1px" }}>
                            {opt.description}
                          </div>
                        </div>
                        {isActive && (
                          <span style={{ color: resolvedSortActiveColor, fontSize: "16px", fontWeight: 700 }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modern Mobile Bottom Sheet (Both real mobile and in admin mobile preview chassis) */}
      {sortOpen && isMobile && (
        createPortal(
          <div
            className="mobile-sort-sheet-overlay"
            onClick={() => setSortOpen(false)}
            style={{
              position: isInsidePreviewStage ? "absolute" : "fixed",
              inset: 0,
              zIndex: 999999,
              background: mobileTheme.overlayBg,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              animation: "sortFadeIn 200ms ease-out",
              borderRadius: isInsidePreviewStage ? "30px" : undefined,
              overflow: "hidden",
            }}
          >
            <div
              className="mobile-sort-sheet"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "540px",
                margin: "0 auto",
                maxHeight: "85%",
                background: customSortDropdownBg || mobileTheme.drawerBg,
                borderTopLeftRadius: resolvedDropdownRadius || "22px",
                borderTopRightRadius: resolvedDropdownRadius || "22px",
                border: `1px solid ${resolvedSortBorderColor || mobileTheme.drawerBorder}`,
                borderBottom: "none",
                boxShadow: mobileTheme.boxShadow,
                display: "flex",
                flexDirection: "column",
                animation: isDragging ? "none" : "sortSheetSlideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)",
                boxSizing: "border-box",
                overflow: "hidden",
                paddingBottom: "max(env(safe-area-inset-bottom, 12px), 12px)",
                ...drawerStyle,
              }}
            >
              {/* Grab Pill Handle (Draggable to close) */}
              <div
                {...dragHandleProps}
                style={{
                  padding: "10px 0 8px",
                  display: "flex",
                  justifyContent: "center",
                  cursor: "grab",
                  touchAction: "none",
                  ...dragHandleProps.style,
                }}
              >
                <div
                  style={{
                    width: "38px",
                    height: "4px",
                    borderRadius: "999px",
                    background: mobileTheme.pillColor,
                  }}
                />
              </div>

              {/* Sheet Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px 12px",
                  borderBottom: `1px solid ${resolvedSortBorderColor || mobileTheme.cardBorder}`,
                  background: isDropdownDark ? "rgba(255, 255, 255, 0.02)" : "transparent",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: dropdownTextColor, letterSpacing: "-0.01em" }}>
                    Sort by
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: dropdownMutedText }}>
                    Choose your preferred product order
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSortOpen(false)}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: mobileTheme.closeBtnBg,
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: dropdownTextColor,
                    fontSize: "14px",
                    fontWeight: 700,
                    padding: 0,
                  }}
                  aria-label="Close sort menu"
                >
                  ✕
                </button>
              </div>

              {/* Options List */}
              <div
                style={{
                  padding: "10px 14px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  overflowY: "auto",
                }}
              >
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onSortChange?.(opt.value);
                        setSortOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: resolvedDropdownRadius || "14px",
                        border: `1.5px solid ${isActive ? resolvedSortActiveColor : (resolvedSortBorderColor || mobileTheme.cardBorder)}`,
                        background: isActive ? (sortHoverBg || mobileTheme.itemActiveBg) : (customSortDropdownBg ? (isDropdownDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)") : mobileTheme.itemBg),
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 140ms ease",
                        outline: "none",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: isActive ? 700 : 600, color: isActive ? resolvedSortActiveColor : dropdownTextColor }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: "11.5px", color: dropdownMutedText, marginTop: "2px" }}>
                          {opt.description}
                        </div>
                      </div>

                      {/* Radio Indicator */}
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "999px",
                          border: `2px solid ${isActive ? resolvedSortActiveColor : dropdownMutedText}`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          marginLeft: "12px",
                          background: isActive ? `${resolvedSortActiveColor}20` : "transparent",
                        }}
                      >
                        {isActive && (
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "999px",
                              background: resolvedSortActiveColor,
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          portalTarget || document.body
        )
      )}

      <style>{`
        .product-toolbar-wrapper,
        .product-toolbar-wrapper * {
          box-sizing: border-box;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .product-toolbar-wrapper {
          width: 100%;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid ${borderColor};
        }
        .product-toolbar-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .product-toolbar-title-group {
          min-width: 160px;
        }
        .product-toolbar-subtitle {
          margin: 0 0 2px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${textSecondary};
        }
        .product-toolbar-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: ${textPrimary};
          display: flex;
          align-items: baseline;
        }
        .product-toolbar-title-count {
          font-size: 13.5px;
          font-weight: 500;
          color: ${textSecondary};
          margin-left: 6px;
        }
        .product-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .product-toolbar-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid ${borderColor};
          background: ${baseBtnBg};
          color: ${textPrimary};
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 160ms ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          user-select: none;
        }
        .product-toolbar-btn:hover {
          border-color: ${resolvedAccentColor};
          background: ${hoverBg};
        }
        .product-toolbar-btn:active {
          transform: scale(0.98);
        }
        .product-toolbar-badge {
          background: ${resolvedAccentColor};
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 0 6px;
          height: 16px;
          min-width: 16px;
          border-radius: 999px;
          margin-left: 2px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .product-toolbar-icon-btn {
          width: 34px;
          height: 34px;
          min-width: 34px;
          padding: 0;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${borderColor};
          background: ${baseBtnBg};
          color: ${textPrimary};
          cursor: pointer;
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          transition: all 140ms ease;
          outline: none;
        }
        .product-toolbar-icon-btn:hover {
          border-color: ${resolvedAccentColor};
          background: ${hoverBg};
        }
        .product-toolbar-icon-btn:active {
          transform: scale(0.96);
        }
        .product-toolbar-icon-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: ${resolvedAccentColor};
          color: #ffffff;
          font-size: 9.5px;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          padding: 0 3px;
          box-sizing: border-box;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .product-sort-dropdown,
        .product-sort-dropdown * {
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .product-sort-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 250px;
          max-width: calc(100vw - 32px);
          border-radius: ${resolvedDropdownRadius};
          border: 1px solid ${resolvedSortBorderColor};
          background: ${dropdownBg};
          box-shadow: ${isDark ? "0 16px 36px rgba(0,0,0,0.55)" : "0 12px 30px rgba(15,23,42,0.12)"};
          padding: 6px;
          z-index: 99999;
          animation: sortDropIn 160ms ease;
        }
        .product-sort-header {
          padding: 8px 10px 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: ${dropdownMutedText};
          border-bottom: 1px solid ${resolvedSortBorderColor};
          margin-bottom: 4px;
        }
        .product-sort-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: background 140ms ease;
          text-align: left;
        }
        .product-sort-item:hover {
          background: ${sortHoverBg} !important;
        }

        /* Responsive Mobile Layout: Single row with Title on left & Icons on right */
        @media (max-width: 640px) {
          .product-toolbar-container {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            flex-wrap: nowrap !important;
          }
          .product-toolbar-title-group {
            min-width: 0 !important;
            flex: 1 !important;
          }
          .product-toolbar-title {
            font-size: 16px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .product-toolbar-subtitle {
            font-size: 10px !important;
            letter-spacing: 0.08em !important;
            margin-bottom: 1px !important;
          }
          .product-toolbar-actions {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
            flex-wrap: nowrap !important;
            width: auto !important;
          }
        }

        /* Mobile Preview Chassis in Builder: Exact same Single Row with Icons */
        .is-mobile-preview .product-toolbar-container,
        .product-toolbar-wrapper.is-mobile .product-toolbar-container {
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          flex-wrap: nowrap !important;
        }
        .is-mobile-preview .product-toolbar-title-group,
        .product-toolbar-wrapper.is-mobile .product-toolbar-title-group {
          min-width: 0 !important;
          flex: 1 !important;
        }
        .is-mobile-preview .product-toolbar-title,
        .product-toolbar-wrapper.is-mobile .product-toolbar-title {
          font-size: 16px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .is-mobile-preview .product-toolbar-subtitle,
        .product-toolbar-wrapper.is-mobile .product-toolbar-subtitle {
          font-size: 10px !important;
          letter-spacing: 0.08em !important;
          margin-bottom: 1px !important;
        }
        .is-mobile-preview .product-toolbar-actions,
        .product-toolbar-wrapper.is-mobile .product-toolbar-actions {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-shrink: 0 !important;
          flex-wrap: nowrap !important;
          width: auto !important;
        }

        @keyframes sortDropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sortSheetSlideUp {
          from {
            transform: translateY(100%);
            opacity: 0.8;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes sortFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default FilterSidebar;