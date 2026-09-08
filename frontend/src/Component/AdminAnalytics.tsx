import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AnalyticsData,
  DATE_RANGE_OPTIONS,
  DateRangeKey,
  exportAnalyticsCSV,
  exportAnalyticsPDF,
  fetchStoreAnalytics,
  formatINR,
  getBlankAnalyticsData,
} from "../services/analyticsService";

// --- Clean SVG Icons (NO EMOJIS) ---
const IconUsers = ({ color = "#2563eb" }: { color?: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconCart = ({ color = "#10b981" }: { color?: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const IconTag = ({ color = "#7c3aed" }: { color?: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconPercent = ({ color = "#ea580c" }: { color?: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconRefresh = ({ spin }: { spin?: boolean }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: spin ? "spin 0.7s linear infinite" : "none" }}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconTrendingUp = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconTrendingDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

const IconPackage = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconFileText = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconFilePdf = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="15" x2="9" y2="12" />
    <line x1="12" y1="15" x2="12" y2="12" />
    <line x1="15" y1="15" x2="15" y2="12" />
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

interface AdminAnalyticsProps {
  siteId?: string;
  siteName?: string;
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ siteId: propSiteId, siteName = "Store" }) => {
  const params = useParams<{ siteId?: string }>();
  const navigate = useNavigate();
  const siteId = propSiteId || params.siteId || "";

  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [metricTab, setMetricTab] = useState<"revenue" | "orders">("revenue");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dropdowns
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [customRangeModalOpen, setCustomRangeModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Chart hover
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Table expand/collapse
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = async (range: DateRangeKey, sDate?: string, eDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStoreAnalytics(siteId, range, sDate, eDate);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load analytics data");
      setData(getBlankAnalyticsData(range));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange !== "custom") {
      loadData(dateRange);
    }
  }, [siteId, dateRange]);

  const handleSelectDateRange = (key: DateRangeKey) => {
    setDateDropdownOpen(false);
    if (key === "custom") {
      setCustomRangeModalOpen(true);
    } else {
      setDateRange(key);
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      showToast("Please select both start and end dates");
      return;
    }
    setDateRange("custom");
    setCustomRangeModalOpen(false);
    loadData("custom", customStartDate, customEndDate);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportCSV = () => {
    if (!data) return;
    setExportDropdownOpen(false);
    exportAnalyticsCSV(data, siteName);
    showToast("CSV export downloaded successfully");
  };

  const handleExportPDF = () => {
    if (!data) return;
    setExportDropdownOpen(false);
    exportAnalyticsPDF(data, siteName);
    showToast("PDF report generated and downloaded");
  };



  // SVG Line/Area Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const chartPoints = useMemo(() => data?.chart_points || [], [data]);

  const hasChartData = useMemo(() => {
    return chartPoints.some((p) => (metricTab === "revenue" ? p.revenue > 0 : p.orders > 0));
  }, [chartPoints, metricTab]);

  const yMax = useMemo(() => {
    if (!chartPoints.length) return 100;
    const vals = chartPoints.map((p) => (metricTab === "revenue" ? p.revenue : p.orders));
    const maxVal = Math.max(...vals, 0);
    if (metricTab === "revenue") {
      if (maxVal <= 0) return 1000;
      if (maxVal <= 500) return Math.max(100, Math.ceil(maxVal / 100) * 100);
      if (maxVal <= 2000) return Math.ceil(maxVal / 250) * 250;
      if (maxVal <= 5000) return Math.ceil(maxVal / 500) * 500;
      if (maxVal <= 20000) return Math.ceil(maxVal / 2000) * 2000;
      return Math.ceil(maxVal / 5000) * 5000;
    } else {
      if (maxVal <= 0) return 5;
      if (maxVal <= 4) return 5;
      if (maxVal <= 10) return 10;
      if (maxVal <= 20) return 20;
      return Math.ceil(maxVal / 5) * 5;
    }
  }, [chartPoints, metricTab]);

  const coordinates = useMemo(() => {
    if (!chartPoints.length) return [];
    return chartPoints.map((p, idx) => {
      const x = paddingLeft + (idx / Math.max(1, chartPoints.length - 1)) * innerWidth;
      const val = metricTab === "revenue" ? p.revenue : p.orders;
      const y = paddingTop + innerHeight - (val / Math.max(1, yMax)) * innerHeight;
      return { x, y, point: p, val };
    });
  }, [chartPoints, metricTab, yMax, innerWidth, innerHeight]);

  const { linePath, areaPath } = useMemo(() => {
    if (coordinates.length < 2) {
      return { linePath: "", areaPath: "" };
    }

    let d = `M ${coordinates[0].x},${coordinates[0].y}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p0 = coordinates[i === 0 ? 0 : i - 1];
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      const p3 = coordinates[i + 2 < coordinates.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    const firstX = coordinates[0].x;
    const lastX = coordinates[coordinates.length - 1].x;
    const baseY = paddingTop + innerHeight;
    const aPath = `${d} L ${lastX},${baseY} L ${firstX},${baseY} Z`;

    return { linePath: d, areaPath: aPath };
  }, [coordinates, innerHeight]);

  // Donut chart segments
  const donutSegments = useMemo(() => {
    if (!data?.traffic_sources) return [];
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPct = 0;

    return data.traffic_sources.map((s) => {
      const strokeDasharray = `${(s.percentage / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedPct / 100) * circumference);
      accumulatedPct += s.percentage;
      return {
        ...s,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [data]);

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
    padding: "16px 14px",
    position: "relative",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const selectedDateLabel =
    DATE_RANGE_OPTIONS.find((o) => o.key === dateRange)?.label ||
    (dateRange === "custom" && customStartDate ? `${customStartDate} to ${customEndDate}` : "Last 30 Days");

  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "#0f172a",
            color: "#ffffff",
            padding: "9px 16px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
            fontSize: "12.5px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP HEADER CARD (Segmented Mode Pill on Left + Header Action Controls on Right) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          position: "relative",
          marginBottom: "6px",
        }}
      >
        {/* Left Side: Store Control Mode Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              style={{
                borderRadius: "6px",
                padding: "6px 16px",
                border: "none",
                background: "#ffffff",
                color: "#0f172a",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "default",
                textTransform: "capitalize",
                transition: "all 0.15s ease",
              }}
            >
              Analytics
            </button>
          </div>
        </div>

        {/* Right Side: Header Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(dateRange)}
            title="Refresh analytics"
            style={{
              height: "36px",
              width: "36px",
              display: "grid",
              placeItems: "center",
              border: "1px solid #cbd5e1",
              borderRadius: "7px",
              background: "#ffffff",
              color: "#334155",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.borderColor = "#94a3b8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            <IconRefresh spin={loading} />
          </button>

          {/* Date Selector Dropdown */}
          <div style={{ position: "relative" }} ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => setDateDropdownOpen((prev) => !prev)}
              style={{
                height: "36px",
                padding: "0 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                borderRadius: "7px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.borderColor = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
            >
              <IconCalendar />
              <span>{selectedDateLabel}</span>
              <IconChevronDown />
            </button>

            {dateDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: "175px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                  zIndex: 100,
                  overflow: "hidden",
                  padding: "4px",
                }}
              >
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectDateRange(opt.key)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "7px 11px",
                      borderRadius: "5px",
                      border: "none",
                      background: dateRange === opt.key ? "#eff6ff" : "transparent",
                      color: dateRange === opt.key ? "#2563eb" : "#1e293b",
                      fontSize: "12.5px",
                      fontWeight: dateRange === opt.key ? 600 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                    onMouseEnter={(e) => {
                      if (dateRange !== opt.key) e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (dateRange !== opt.key) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span>{opt.label}</span>
                    {dateRange === opt.key && <span style={{ color: "#2563eb", fontSize: "11px" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div style={{ position: "relative" }} ref={exportDropdownRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen((prev) => !prev)}
              style={{
                height: "36px",
                padding: "0 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                borderRadius: "7px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.borderColor = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
            >
              <IconDownload />
              <span>Export</span>
              <IconChevronDown />
            </button>

            {exportDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: "195px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                  zIndex: 100,
                  overflow: "hidden",
                  padding: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={handleExportCSV}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: "5px",
                    border: "none",
                    background: "transparent",
                    color: "#1e293b",
                    fontSize: "12.5px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <IconFileText />
                  <span>Export as CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: "5px",
                    border: "none",
                    background: "transparent",
                    color: "#1e293b",
                    fontSize: "12.5px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <IconFilePdf />
                  <span>Export as PDF Report</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CUSTOM DATE RANGE MODAL */}
      {customRangeModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              padding: "20px",
              width: "340px",
              maxWidth: "90%",
              boxShadow: "0 20px 35px rgba(0,0,0,0.15)",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 700 }}>Select Custom Date Range</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setCustomRangeModalOpen(false)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustomRange}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#b91c1c",
            marginBottom: "16px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadData(dateRange)}
            style={{
              background: "#b91c1c",
              color: "#ffffff",
              border: "none",
              padding: "5px 10px",
              borderRadius: "5px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ROW 1: TOP 4 KPI CARDS (SQUEEZED ON A SINGLE ROW) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "16px",
          width: "100%",
        }}
        className="analytics-kpi-grid"
      >
        {/* KPI 1: Visitors */}
        <div style={{ ...cardStyle, padding: "14px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px", minWidth: 0 }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "#eff6ff",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <IconUsers color="#2563eb" />
            </div>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Visitors
            </span>
          </div>

          <div
            style={{
              fontSize: "clamp(18px, 1.8vw, 24px)",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "4px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {loading || !data ? (
              <span className="shimmer-placeholder" style={{ display: "inline-block", width: "70px", height: "24px", borderRadius: "4px" }} />
            ) : (
              data.overview.visitors.toLocaleString("en-IN")
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", height: "18px" }}>
            {data && data.overview.visitors > 0 && data.overview.comparison_text ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  fontWeight: 600,
                  color: data.overview.visitors_change >= 0 ? "#16a34a" : "#dc2626",
                  flexShrink: 0,
                }}
              >
                {data.overview.visitors_change >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
                {Math.abs(data.overview.visitors_change)}%
              </span>
            ) : null}
            <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data && data.overview.visitors > 0 && data.overview.comparison_text ? data.overview.comparison_text : "No prior period data"}
            </span>
          </div>
        </div>

        {/* KPI 2: Orders */}
        <div style={{ ...cardStyle, padding: "14px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px", minWidth: 0 }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "#ecfdf5",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <IconCart color="#10b981" />
            </div>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Orders
            </span>
          </div>

          <div
            style={{
              fontSize: "clamp(18px, 1.8vw, 24px)",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "4px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {loading || !data ? (
              <span className="shimmer-placeholder" style={{ display: "inline-block", width: "60px", height: "24px", borderRadius: "4px" }} />
            ) : (
              data.overview.orders.toLocaleString("en-IN")
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", height: "18px" }}>
            {data && data.overview.orders > 0 && data.overview.comparison_text ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  fontWeight: 600,
                  color: data.overview.orders_change >= 0 ? "#16a34a" : "#dc2626",
                  flexShrink: 0,
                }}
              >
                {data.overview.orders_change >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
                {Math.abs(data.overview.orders_change)}%
              </span>
            ) : null}
            <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data && data.overview.orders > 0 && data.overview.comparison_text ? data.overview.comparison_text : "No prior period data"}
            </span>
          </div>
        </div>

        {/* KPI 3: Revenue */}
        <div style={{ ...cardStyle, padding: "14px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px", minWidth: 0 }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "#f5f3ff",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <IconTag color="#7c3aed" />
            </div>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Revenue
            </span>
          </div>

          <div
            style={{
              fontSize: "clamp(18px, 1.8vw, 24px)",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "4px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {loading || !data ? (
              <span className="shimmer-placeholder" style={{ display: "inline-block", width: "95px", height: "24px", borderRadius: "4px" }} />
            ) : (
              formatINR(data.overview.revenue)
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", height: "18px" }}>
            {data && data.overview.revenue > 0 && data.overview.comparison_text ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  fontWeight: 600,
                  color: data.overview.revenue_change >= 0 ? "#16a34a" : "#dc2626",
                  flexShrink: 0,
                }}
              >
                {data.overview.revenue_change >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
                {Math.abs(data.overview.revenue_change)}%
              </span>
            ) : null}
            <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data && data.overview.revenue > 0 && data.overview.comparison_text ? data.overview.comparison_text : "No prior period data"}
            </span>
          </div>
        </div>

        {/* KPI 4: Conversion Rate */}
        <div style={{ ...cardStyle, padding: "14px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px", minWidth: 0 }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "#fff7ed",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <IconPercent color="#ea580c" />
            </div>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Conversion Rate
            </span>
          </div>

          <div
            style={{
              fontSize: "clamp(18px, 1.8vw, 24px)",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "4px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {loading || !data ? (
              <span className="shimmer-placeholder" style={{ display: "inline-block", width: "60px", height: "24px", borderRadius: "4px" }} />
            ) : (
              `${Math.min(100, Math.max(0, data.overview.conversion_rate))}%`
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", height: "18px" }}>
            {data && data.overview.conversion_rate > 0 && data.overview.comparison_text ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  fontWeight: 600,
                  color: data.overview.conversion_rate_change >= 0 ? "#16a34a" : "#dc2626",
                  flexShrink: 0,
                }}
              >
                {data.overview.conversion_rate_change >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
                {Math.abs(data.overview.conversion_rate_change)}%
              </span>
            ) : null}
            <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>
              {data && data.overview.conversion_rate > 0 && data.overview.comparison_text ? data.overview.comparison_text : "No prior period data"}
            </span>
          </div>
        </div>
      </div>

      {/* ROW 2: MAIN CHART + TRAFFIC SOURCES (SQUEEZED WITHOUT DROPPING) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.85fr) minmax(0, 1.15fr)",
          gap: "12px",
          marginBottom: "16px",
          width: "100%",
        }}
        className="analytics-row-2"
      >
        {/* REVENUE & ORDERS CHART */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
          {/* Card Header with Segmented Switch */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
              flexWrap: "nowrap",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
              Revenue & Orders
            </span>

            {/* Segmented Control */}
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                borderRadius: "7px",
                padding: "2.5px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setMetricTab("revenue")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "5px",
                  border: "none",
                  background: metricTab === "revenue" ? "#2563eb" : "transparent",
                  color: metricTab === "revenue" ? "#ffffff" : "#64748b",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: metricTab === "revenue" ? "0 1px 3px rgba(37,99,235,0.25)" : "none",
                }}
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => setMetricTab("orders")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "5px",
                  border: "none",
                  background: metricTab === "orders" ? "#2563eb" : "transparent",
                  color: metricTab === "orders" ? "#ffffff" : "#64748b",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: metricTab === "orders" ? "0 1px 3px rgba(37,99,235,0.25)" : "none",
                }}
              >
                Orders
              </button>
            </div>
          </div>

          {/* SVG Line / Area Chart */}
          <div style={{ position: "relative", width: "100%", height: "210px", flexGrow: 1 }}>
            {coordinates.length >= 2 ? (
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                style={{ width: "100%", height: "100%", overflow: "visible" }}
                onMouseLeave={() => setHoveredPointIndex(null)}
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Horizontal Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = paddingTop + innerHeight * (1 - ratio);
                  const tickVal = Math.round(yMax * ratio);
                  const formattedTick =
                    metricTab === "revenue"
                      ? tickVal >= 1000
                        ? `₹${(tickVal / 1000).toFixed(tickVal % 1000 === 0 ? 0 : 1)}k`
                        : `₹${tickVal}`
                      : tickVal.toString();

                  return (
                    <g key={ratio}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={paddingLeft + innerWidth}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="10.5"
                        fill="#94a3b8"
                        fontFamily="inherit"
                      >
                        {formattedTick}
                      </text>
                    </g>
                  );
                })}

                {/* Area Fill & Curve Line only when there's active data */}
                {hasChartData ? (
                  <>
                    <path d={areaPath} fill="url(#areaGradient)" />
                    <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <line
                      x1={paddingLeft}
                      y1={paddingTop + innerHeight}
                      x2={paddingLeft + innerWidth}
                      y2={paddingTop + innerHeight}
                      stroke="#e2e8f0"
                      strokeWidth="1.5"
                    />
                    <text
                      x={paddingLeft + innerWidth / 2}
                      y={paddingTop + innerHeight / 2}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="12.5"
                      fontWeight="500"
                    >
                      No {metricTab} recorded for this period
                    </text>
                  </>
                )}

                {/* Interactive Points, X-axis Labels, and Hover Rectangles */}
                {coordinates.map((pt, idx) => {
                  const isHovered = hoveredPointIndex === idx;
                  const showLabel =
                    coordinates.length <= 12 ||
                    idx % Math.ceil(coordinates.length / 7) === 0 ||
                    idx === coordinates.length - 1;

                  return (
                    <g key={idx}>
                      {isHovered && hasChartData && (
                        <line
                          x1={pt.x}
                          y1={paddingTop}
                          x2={pt.x}
                          y2={paddingTop + innerHeight}
                          stroke="#cbd5e1"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      )}

                      {hasChartData && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? "5.5" : "3.5"}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={isHovered ? "2.5" : "2"}
                          style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                        />
                      )}

                      {showLabel && (
                        <text
                          x={pt.x}
                          y={paddingTop + innerHeight + 16}
                          textAnchor="middle"
                          fontSize="10.5"
                          fill="#94a3b8"
                          fontFamily="inherit"
                        >
                          {pt.point.date}
                        </text>
                      )}

                      {hasChartData && (
                        <rect
                          x={pt.x - innerWidth / (coordinates.length * 2)}
                          y={paddingTop}
                          width={innerWidth / coordinates.length}
                          height={innerHeight + 20}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setHoveredPointIndex(idx)}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                No activity recorded for this period
              </div>
            )}

            {/* Hover Tooltip */}
            {hoveredPointIndex !== null && coordinates[hoveredPointIndex] && (
              <div
                style={{
                  position: "absolute",
                  left: `${(coordinates[hoveredPointIndex].x / chartWidth) * 100}%`,
                  top: `${(coordinates[hoveredPointIndex].y / chartHeight) * 100}%`,
                  transform: "translate(-50%, -120%)",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "7px",
                  padding: "5px 10px",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  zIndex: 20,
                  fontSize: "11.5px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>
                  {coordinates[hoveredPointIndex].point.full_date}
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>
                  {metricTab === "revenue"
                    ? formatINR(coordinates[hoveredPointIndex].point.revenue)
                    : `${coordinates[hoveredPointIndex].point.orders} Orders`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TRAFFIC SOURCES CARD */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a", marginBottom: "14px" }}>
            Traffic Sources
          </div>

          {data && data.traffic_sources && data.traffic_sources.length > 0 && data.traffic_sources.some(s => s.percentage > 0) ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              {/* SVG Donut */}
              <div style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
                <svg width="120" height="120" viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="75" cy="75" r="58" fill="transparent" stroke="#f1f5f9" strokeWidth="20" />
                  {donutSegments.map((seg, i) => (
                    <circle
                      key={i}
                      cx="75"
                      cy="75"
                      r="58"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="20"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 0.3s ease" }}
                    />
                  ))}
                </svg>

                {/* Centered Donut Metric */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                    {data?.overview.visitors.toLocaleString("en-IN") || "0"}
                  </span>
                  <span style={{ fontSize: "10.5px", color: "#64748b" }}>Visitors</span>
                </div>
              </div>

              {/* Legend & Percentages */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexGrow: 1, minWidth: 0 }}>
                {data.traffic_sources.map((source) => (
                  <div
                    key={source.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: source.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {source.label}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: "#0f172a", marginLeft: "6px" }}>{source.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: "130px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>
              —
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: CUSTOMERS + TOP PRODUCTS + DEVICES (SQUEEZED WITHOUT DROPPING) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.55fr) minmax(0, 1.05fr)",
          gap: "12px",
          marginBottom: "16px",
          width: "100%",
        }}
        className="analytics-row-3"
      >
        {/* CARD 1: CUSTOMERS */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a" }}>Customers</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <IconUsers color="#2563eb" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "clamp(18px, 1.7vw, 24px)", fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                  {data?.customers.total.toLocaleString("en-IN") || "0"}
                </div>
                <div style={{ fontSize: "11.5px", color: "#64748b" }}>Total Customers</div>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: "12px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                <span style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  New Customers
                </span>
              </div>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>
                {data?.customers.new.toLocaleString("en-IN") || "0"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                <span style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Returning Customers
                </span>
              </div>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>
                {data?.customers.returning.toLocaleString("en-IN") || "0"}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: TOP PRODUCTS */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a" }}>Top Products</span>
            {data && data.top_products && data.top_products.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllProducts((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "2px 4px",
                }}
              >
                {showAllProducts ? "Show Less" : `View All (${data.top_products.length})`}
              </button>
            )}
          </div>

          <div style={{ width: "100%", overflowX: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th style={{ textAlign: "left", padding: "6px 2px", color: "#94a3b8", fontWeight: 600, width: "20px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "6px 6px", color: "#94a3b8", fontWeight: 600 }}>PRODUCT</th>
                  <th style={{ textAlign: "right", padding: "6px 4px", color: "#94a3b8", fontWeight: 600, width: "60px" }}>ORDERS</th>
                  <th style={{ textAlign: "right", padding: "6px 2px", color: "#94a3b8", fontWeight: 600, width: "80px" }}>REVENUE</th>
                </tr>
              </thead>
              <tbody>
                {data && data.top_products.length > 0 ? (
                  (showAllProducts ? data.top_products : data.top_products.slice(0, 5)).map((prod) => (
                    <tr
                      key={prod.rank}
                      style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.15s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "7px 2px", color: "#64748b", fontWeight: 600 }}>{prod.rank}</td>
                      <td style={{ padding: "7px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "5px",
                              background: "#f1f5f9",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <IconPackage />
                          </div>
                          <span style={{ fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {prod.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "7px 4px", textAlign: "right", color: "#64748b" }}>
                        {prod.orders.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "7px 2px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                        {formatINR(prod.revenue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: "32px 8px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARD 3: DEVICES */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a", marginBottom: "14px" }}>
            Devices
          </div>

          {data && data.devices && data.devices.length > 0 && data.devices.some(d => d.percentage > 0) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flexGrow: 1, justifyContent: "center" }}>
              {data.devices.map((dev) => (
                <div key={dev.device}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "12px",
                      marginBottom: "5px",
                    }}
                  >
                    <span style={{ color: "#475569", fontWeight: 500 }}>{dev.device}</span>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{dev.percentage}%</span>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div
                    style={{
                      width: "100%",
                      height: "7px",
                      borderRadius: "9999px",
                      background: "#f1f5f9",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${dev.percentage}%`,
                        background: "#2563eb",
                        borderRadius: "9999px",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: "130px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>
              —
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: RECENT ACTIVITY */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <IconClock />
            <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a" }}>Recent Activity</span>
          </div>
          {data && data.recent_activity && data.recent_activity.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllActivity((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                color: "#2563eb",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "2px 4px",
              }}
            >
              {showAllActivity ? "Show Less" : `View All (${data.recent_activity.length})`}
            </button>
          )}
        </div>

        <div style={{ overflowX: "auto", maxHeight: showAllActivity ? "400px" : "none", overflowY: showAllActivity ? "auto" : "visible" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <th style={{ textAlign: "left", padding: "7px 8px", color: "#94a3b8", fontWeight: 600, width: "160px" }}>DATE</th>
                <th style={{ textAlign: "left", padding: "7px 8px", color: "#94a3b8", fontWeight: 600 }}>EVENT</th>
                <th style={{ textAlign: "left", padding: "7px 8px", color: "#94a3b8", fontWeight: 600 }}>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {data && data.recent_activity.length > 0 ? (
                (showAllActivity ? data.recent_activity : data.recent_activity.slice(0, 5)).map((act) => (
                  <tr
                    key={act.id}
                    style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.15s ease" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "8px 8px", color: "#64748b" }}>{act.date}</td>
                    <td style={{ padding: "8px 8px", fontWeight: 600, color: "#0f172a" }}>{act.event}</td>
                    <td style={{ padding: "8px 8px", color: "#475569" }}>{act.details}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ padding: "32px 8px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .shimmer-placeholder {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive behavior: Only stack on actual small phone viewports (< 640px) */
        @media (max-width: 640px) {
          .analytics-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .analytics-row-2 {
            grid-template-columns: 1fr !important;
          }
          .analytics-row-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminAnalytics;
