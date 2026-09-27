import { API_BASE_URL } from "../config/api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type DateRangeKey = "today" | "7d" | "30d" | "90d" | "year" | "custom";

export interface OverviewMetrics {
  visitors: number;
  visitors_change: number;
  orders: number;
  orders_change: number;
  revenue: number;
  revenue_change: number;
  conversion_rate: number;
  conversion_rate_change: number;
  comparison_text: string;
}

export interface ChartPoint {
  date: string;
  revenue: number;
  orders: number;
  full_date: string;
}

export interface TrafficSource {
  label: string;
  percentage: number;
  visitors: number;
  color: string;
}

export interface CustomerMetrics {
  total: number;
  new: number;
  returning: number;
}

export interface TopProduct {
  rank: number;
  name: string;
  orders: number;
  revenue: number;
  image?: string | null;
}

export interface DeviceMetric {
  device: string;
  percentage: number;
}

export interface RecentActivityItem {
  id: string;
  date: string;
  event: string;
  details: string;
}

export interface AnalyticsData {
  time_label: string;
  range_key: DateRangeKey;
  overview: OverviewMetrics;
  chart_points: ChartPoint[];
  traffic_sources: TrafficSource[];
  customers: CustomerMetrics;
  top_products: TopProduct[];
  devices: DeviceMetric[];
  recent_activity: RecentActivityItem[];
}

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom Range" },
];

/**
 * Return clean zero/blank analytics structure when no data exists yet
 */
export function getBlankAnalyticsData(rangeKey: DateRangeKey = "30d"): AnalyticsData {
  let label = "Last 30 Days";

  if (rangeKey === "today") {
    label = "Today";
  } else if (rangeKey === "7d") {
    label = "Last 7 Days";
  } else if (rangeKey === "90d") {
    label = "Last 90 Days";
  } else if (rangeKey === "year") {
    label = "This Year";
  }

  return {
    time_label: label,
    range_key: rangeKey,
    overview: {
      visitors: 0,
      visitors_change: 0.0,
      orders: 0,
      orders_change: 0.0,
      revenue: 0.0,
      revenue_change: 0.0,
      conversion_rate: 0.0,
      conversion_rate_change: 0.0,
      comparison_text: "",
    },
    chart_points: [],
    traffic_sources: [],
    customers: {
      total: 0,
      new: 0,
      returning: 0,
    },
    top_products: [],
    devices: [],
    recent_activity: [],
  };
}

/**
 * Service call to fetch live store analytics from backend
 */
export async function fetchStoreAnalytics(
  siteId: string,
  range: DateRangeKey = "30d",
  startDate?: string,
  endDate?: string
): Promise<AnalyticsData> {
  try {
    const params = new URLSearchParams({ range });
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const res = await fetch(`${API_BASE_URL}/admin/${siteId}/analytics/all?${params.toString()}`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json && typeof json === "object") {
        return json as AnalyticsData;
      }
    }
  } catch (err) {
    console.warn("Analytics API fetch error:", err);
  }

  return getBlankAnalyticsData(range);
}

/**
 * Export analytics overview, top products, and timeline to CSV format
 */
export function exportAnalyticsCSV(data: AnalyticsData, siteName: string = "Store"): void {
  const lines: string[] = [];
  lines.push(`Analytics Report - ${siteName}`);
  lines.push(`Generated On: ${new Date().toLocaleString("en-IN")}`);
  lines.push(`Period: ${data.time_label}`);
  lines.push("");

  lines.push("--- KEY PERFORMANCE INDICATORS ---");
  lines.push("Metric,Value,Growth vs Previous Period");
  lines.push(`Visitors,${data.overview.visitors},${data.overview.visitors_change}%`);
  lines.push(`Orders,${data.overview.orders},${data.overview.orders_change}%`);
  lines.push(`Revenue (INR),Rs ${data.overview.revenue},${data.overview.revenue_change}%`);
  lines.push(`Conversion Rate,${data.overview.conversion_rate}%,${data.overview.conversion_rate_change}%`);
  lines.push("");

  lines.push("--- TOP PRODUCTS ---");
  lines.push("Rank,Product Name,Orders,Revenue (INR)");
  if (data.top_products.length > 0) {
    data.top_products.forEach((p) => {
      lines.push(`${p.rank},"${p.name.replace(/"/g, '""')}",${p.orders},Rs ${p.revenue}`);
    });
  } else {
    lines.push("No product sales recorded for this period");
  }
  lines.push("");

  lines.push("--- TRAFFIC SOURCES ---");
  lines.push("Source,Share (%),Visitors");
  if (data.traffic_sources.length > 0) {
    data.traffic_sources.forEach((ts) => {
      lines.push(`"${ts.label}",${ts.percentage}%,${ts.visitors}`);
    });
  } else {
    lines.push("No traffic recorded for this period");
  }
  lines.push("");

  lines.push("--- DEVICE BREAKDOWN ---");
  lines.push("Device,Share (%)");
  if (data.devices.length > 0) {
    data.devices.forEach((d) => {
      lines.push(`"${d.device}",${d.percentage}%`);
    });
  } else {
    lines.push("No device data recorded for this period");
  }

  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
  const link = document.createElement("a");
  link.setAttribute("href", csvContent);
  link.setAttribute("download", `analytics_${siteName.toLowerCase().replace(/\s+/g, "_")}_${data.range_key}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export clean PDF report using jsPDF & autoTable
 */
export function exportAnalyticsPDF(data: AnalyticsData, siteName: string = "Store"): void {
  const doc = new jsPDF();

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(`${siteName} - Analytics Report`, 14, 20);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${data.time_label}  |  Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 28);

  // KPI Table
  autoTable(doc, {
    startY: 34,
    head: [["Metric", "Value", "Growth", "Comparison Period"]],
    body: [
      ["Visitors", data.overview.visitors.toLocaleString("en-IN"), `${data.overview.visitors_change >= 0 ? "+" : ""}${data.overview.visitors_change}%`, data.overview.comparison_text],
      ["Orders", data.overview.orders.toLocaleString("en-IN"), `${data.overview.orders_change >= 0 ? "+" : ""}${data.overview.orders_change}%`, data.overview.comparison_text],
      ["Revenue", `Rs. ${data.overview.revenue.toLocaleString("en-IN")}`, `${data.overview.revenue_change >= 0 ? "+" : ""}${data.overview.revenue_change}%`, data.overview.comparison_text],
      ["Conversion Rate", `${data.overview.conversion_rate}%`, `${data.overview.conversion_rate_change >= 0 ? "+" : ""}${data.overview.conversion_rate_change}%`, data.overview.comparison_text],
    ],
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
  });

  // Top Products Table
  const lastY = (doc as any).lastAutoTable?.finalY || 80;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Top Performing Products", 14, lastY + 12);

  const productRows = data.top_products.length > 0
    ? data.top_products.map((p) => [
        p.rank,
        p.name,
        p.orders.toLocaleString("en-IN"),
        `Rs. ${p.revenue.toLocaleString("en-IN")}`,
      ])
    : [["-", "No product sales recorded yet", "-", "-"]];

  autoTable(doc, {
    startY: lastY + 16,
    head: [["#", "Product", "Orders", "Revenue (INR)"]],
    body: productRows,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3.5 },
  });

  // Traffic & Device Summary
  const lastY2 = (doc as any).lastAutoTable?.finalY || 160;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("Traffic & Channel Breakdown", 14, lastY2 + 12);

  const trafficRows = data.traffic_sources.length > 0
    ? data.traffic_sources.map((t) => [t.label, `${t.percentage}%`, t.visitors.toLocaleString("en-IN")])
    : [["-", "No traffic recorded yet", "-"]];

  autoTable(doc, {
    startY: lastY2 + 16,
    head: [["Channel / Source", "Share (%)", "Visitors"]],
    body: trafficRows,
    theme: "plain",
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`analytics_report_${siteName.toLowerCase().replace(/\s+/g, "_")}.pdf`);
}

/**
 * Format Indian Currency helper
 */
export function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val || 0);
}
