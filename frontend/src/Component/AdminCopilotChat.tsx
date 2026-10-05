import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { saveThemeSnapshot, updateThemeValues, applyThemeToPages } from "../customizations/editorUtils";
import { AiAvatar } from "./AiAvatar";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminTheme } from "../context/ThemeContext";
import { AccessDeniedView } from "./AccessDeniedView";

type DataCard = {
  type:
    | "redirect_card"
    | "orders_card"
    | "returns_card"
    | "analytics_card"
    | "palette_suggestions_card"
    | "component_palette_suggestions_card"
    | "camouflage_warning_card"
    | "table_card"
    | "coupons_card"
    | "confirmation_guard_card"
    | "store_audit_card"
    | "inventory_alert_card"
    | "paywall_card"
    | "product_preview_card"
    | "order_summary_card"
    | "sql_query_result"
    | string;
  title?: string;
  description?: string;
  summary?: string;
  warning?: string;
  target_name?: string;
  details?: Array<{ label: string; value: any }>;
  confirm_command?: string;
  action_type?: string;
  target_order_id?: string;
  target_url?: string;
  button_label?: string;
  target_component?: string;
  bg_key?: string;
  new_bg?: string;
  suggested_text?: string;
  columns?: string[];
  rows?: Array<any>;
  row_count?: number;
  orders?: Array<{ id: string; total: number; status: string; items_count?: number; items_summary?: string; date?: string; order_id?: string; updated_at?: string }>;
  returns?: Array<{ id: string; order_id?: string; product?: string; reason?: string; status?: string; refund_status?: string; amount?: number }>;
  coupons?: Array<{ coupon_code?: string; code?: string; is_active?: boolean; discount_display?: string; description?: string; discount_type?: string; discount_value?: number; min_order_value?: number; max_discount_amount?: number; starts_at?: string; expires_at?: string }>;
  palettes?: Array<any>;
  product?: any;
  products?: Array<any>;
  order?: any;
  audit?: any;
  reset_date?: string | null;
  metrics?: {
    total_sales?: string;
    orders_count?: number;
    top_product?: string;
    average_rating?: string;
    cancellation_rate?: string;
  };
  [key: string]: any;
};

type CopilotMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  cards?: DataCard[];
};

type AdminCopilotChatProps = {
  siteId: string;
  siteDefinition?: any;
  onSiteDefinitionChange?: (nextDef: any) => void;
  onOpenBilling?: () => void;
};

const formatInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return null;
  // Regex to split on bold (**text**), inline code (`code`), or currency/tags
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} style={{ fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            padding: "1px 4px",
            borderRadius: "4px",
            background: "rgba(0,0,0,0.06)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

const CopilotThinkingBubble: React.FC<{ bg?: string }> = ({ bg = "#f1f5f9" }) => {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "12px 16px",
        borderRadius: "14px 14px 14px 2px",
        background: bg,
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
      }}
    >
      <span className="copilot-thinking-dot" style={{ animationDelay: "0s" }} />
      <span className="copilot-thinking-dot" style={{ animationDelay: "0.2s" }} />
      <span className="copilot-thinking-dot" style={{ animationDelay: "0.4s" }} />
    </div>
  );
};

const CopilotInteractiveTableCard: React.FC<{
  card: DataCard;
  tokens: any;
  isDark: boolean;
}> = ({ card, tokens, isDark }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const pageSize = isExpanded ? 100 : 20;

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const allRows = Array.isArray(card.rows) ? card.rows : [];
  const cols = card.columns && card.columns.length > 0 ? card.columns : Object.keys(allRows[0] || {});

  const totalPages = Math.ceil(allRows.length / pageSize) || 1;
  const effectivePage = Math.min(currentPage, totalPages);
  const displayedRows = allRows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);

  const handleExportCSV = async () => {
    if (!allRows || allRows.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      // Clean headers
      const headers = cols.map((c) => `"${String(c).replace(/_/g, " ").replace(/"/g, '""')}"`).join(",");
      
      const csvLines = allRows.map((row: any) => {
        return cols.map((col: string, cIdx: number) => {
          let val: any;
          if (Array.isArray(row)) {
            val = row[cIdx];
          } else if (row && typeof row === "object") {
            val = row[col] !== undefined ? row[col] : "";
          } else {
            val = row;
          }
          if (val === null || val === undefined) return '""';
          
          if (typeof val === "number") {
            return String(val);
          }
          
          if (typeof val === "boolean") {
            return val ? "TRUE" : "FALSE";
          }
          
          if (typeof val === "object") {
            if (Array.isArray(val)) {
              val = val.map((v) => (typeof v === "object" ? v?.name || v?.title || JSON.stringify(v) : String(v))).join("; ");
            } else if (val.address_line1 || val.city || val.postal_code) {
              val = [val.address_line1, val.city, val.state, val.postal_code].filter(Boolean).join(", ");
            } else {
              val = Object.entries(val).map(([k, v]) => `${k}: ${v}`).join("; ");
            }
          }
          
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(",");
      });

      // Include UTF-8 Byte Order Mark (\uFEFF) for 100% native Microsoft Excel & Google Sheets rendering
      const csvContentWithBOM = "\uFEFF" + [headers, ...csvLines].join("\r\n");
      const csvBlob = new Blob([csvContentWithBOM], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      const titleSlug = (card.title || "copilot_query_export").toLowerCase().replace(/[^a-z0-9]+/g, "_");
      link.href = url;
      link.setAttribute("download", `${titleSlug}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (err) {
      console.error("CSV Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ padding: "10px", borderRadius: "10px", background: isDark ? tokens.elevatedSurfaceBg : "#ffffff", border: `1px solid ${tokens.border}`, overflowX: "auto" }}>
      {/* Header with Title, CSV Export, and Row Count */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: tokens.textPrimary }}>
          {card.title || "Query Results"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {allRows.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting}
              title="Export query rows to CSV"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 7px",
                borderRadius: "4px",
                border: `1px solid ${exportSuccess ? tokens.success : isDark ? "rgba(99, 102, 241, 0.4)" : "#cbd5e1"}`,
                background: exportSuccess ? (isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7") : isDark ? "rgba(99, 102, 241, 0.15)" : "#f1f5f9",
                color: exportSuccess ? (isDark ? "#4ade80" : "#166534") : isDark ? "#a5b4fc" : "#475569",
                cursor: isExporting ? "wait" : "pointer",
                fontSize: "10px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {exportSuccess ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved!
                </>
              ) : isExporting ? (
                <>
                  <span style={{ display: "inline-block", width: "8px", height: "8px", border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  Saving...
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  CSV
                </>
              )}
            </button>
          )}
          <span style={{ fontSize: "10px", color: tokens.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
            {allRows.length} {allRows.length === 1 ? "row" : "rows"}
          </span>
        </div>
      </div>

      {/* Table Body */}
      {allRows.length === 0 ? (
        <div style={{ fontSize: "11px", color: tokens.textMuted, textAlign: "center", padding: "10px" }}>
          No matching records found in store database.
        </div>
      ) : (
        <div style={{ overflowX: "auto", maxHeight: isExpanded ? "450px" : "none", overflowY: isExpanded ? "auto" : "visible" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: isDark ? tokens.surfaceBg : "#f8fafc", borderBottom: `1px solid ${tokens.border}` }}>
                {cols.map((col: string, colIdx: number) => (
                  <th key={colIdx} style={{ padding: "6px 8px", fontWeight: 700, color: tokens.textSecondary, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((r: any, rIdx: number) => (
                <tr key={rIdx} style={{ borderBottom: `1px solid ${tokens.divider}`, background: rIdx % 2 === 0 ? (isDark ? tokens.elevatedSurfaceBg : "#ffffff") : (isDark ? tokens.surfaceBg : "#f8fafc") }}>
                  {cols.map((col: string, cIdx2: number) => {
                    let rawVal: any;
                    if (Array.isArray(r)) {
                      rawVal = r[cIdx2];
                    } else if (r && typeof r === "object") {
                      if (r[col] !== undefined) {
                        rawVal = r[col];
                      } else {
                        const colClean = col.toLowerCase().replace(/[\s_]+/g, "");
                        const matchedKey = Object.keys(r).find((k) => k.toLowerCase().replace(/[\s_]+/g, "") === colClean);
                        if (matchedKey) {
                          rawVal = r[matchedKey];
                        } else {
                          const fallbackKey = Object.keys(r).find((k) => {
                            const kClean = k.toLowerCase();
                            return (colClean.includes("product") && kClean.includes("product")) ||
                                   (colClean.includes("variant") && kClean.includes("variant")) ||
                                   (colClean.includes("stock") && kClean.includes("stock")) ||
                                   (colClean.includes("price") && kClean.includes("price")) ||
                                   (colClean.includes("status") && kClean.includes("status")) ||
                                   (colClean.includes("order") && kClean.includes("order")) ||
                                   (colClean.includes("address") && kClean.includes("address")) ||
                                   (colClean.includes("customer") && kClean.includes("customer"));
                          });
                          rawVal = fallbackKey ? r[fallbackKey] : undefined;
                        }
                      }
                    } else {
                      rawVal = r;
                    }

                    const colLower = col.toLowerCase().trim();
                    const isQuantityOrCount =
                      colLower.includes("sold") ||
                      colLower.includes("quantity") ||
                      colLower.includes("qty") ||
                      colLower.includes("count") ||
                      colLower.includes("unit") ||
                      colLower.includes("stock") ||
                      colLower.includes("items") ||
                      colLower.includes("orders") ||
                      colLower.includes("reviews") ||
                      colLower.includes("rank") ||
                      colLower.includes("id");

                    const isRating = colLower.includes("rating") || colLower.includes("stars") || colLower.includes("score");
                    const isMonetary =
                      !isQuantityOrCount &&
                      !isRating &&
                      typeof rawVal === "number" &&
                      (colLower.includes("price") ||
                       colLower.includes("revenue") ||
                       colLower.includes("sales") ||
                       colLower.includes("spent") ||
                       colLower.includes("amount") ||
                       colLower.includes("cost") ||
                       colLower.includes("fee") ||
                       colLower.includes("charge") ||
                       colLower.includes("refund") ||
                       colLower.includes("subtotal") ||
                       colLower.includes("line_total") ||
                       colLower.includes("grand_total") ||
                       colLower.includes("order_total") ||
                       colLower === "total");

                    let displayVal: string;
                    if (isMonetary) {
                      displayVal = `₹${Number(rawVal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
                    } else if (isRating && typeof rawVal === "number") {
                      displayVal = `${Number(rawVal).toFixed(1)} / 5.0`;
                    } else if (isQuantityOrCount && typeof rawVal === "number") {
                      const isUnitLabel = colLower.includes("sold") || colLower.includes("unit") || colLower.includes("qty") || colLower.includes("quantity");
                      displayVal = `${Number(rawVal).toLocaleString("en-IN")}${isUnitLabel ? " units" : ""}`;
                    } else if (typeof rawVal === "number") {
                      displayVal = Number(rawVal).toLocaleString("en-IN");
                    } else if (typeof rawVal === "object" && rawVal !== null) {
                      if (Array.isArray(rawVal)) {
                        displayVal = rawVal.map((v) => (typeof v === "object" ? v?.name || v?.title || JSON.stringify(v) : String(v))).join(", ");
                      } else if (rawVal.address_line1 || rawVal.city || rawVal.postal_code) {
                        displayVal = [rawVal.address_line1, rawVal.city, rawVal.state, rawVal.postal_code].filter(Boolean).join(", ");
                      } else {
                        displayVal = Object.entries(rawVal)
                          .filter(([_, v]) => typeof v !== "object" && v !== undefined && v !== null)
                          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                          .join(", ") || "-";
                      }
                    } else {
                      displayVal = String(rawVal !== undefined && rawVal !== null ? rawVal : "-");
                    }

                    return (
                      <td key={cIdx2} style={{ padding: "6px 8px", color: tokens.textPrimary, whiteSpace: "nowrap" }}>
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination & Expand Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "6px", borderTop: `1px solid ${tokens.divider}`, fontSize: "10.5px", flexWrap: "wrap", gap: "6px" }}>
        <span style={{ color: tokens.textMuted }}>
          Page {effectivePage} of {totalPages} {isExpanded ? "(100/page)" : "(20/page)"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {totalPages > 1 && (
            <>
              <button
                type="button"
                disabled={effectivePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: `1px solid ${tokens.border}`,
                  background: effectivePage <= 1 ? "transparent" : (isDark ? tokens.surfaceBg : "#f1f5f9"),
                  color: effectivePage <= 1 ? tokens.textMuted : tokens.textPrimary,
                  cursor: effectivePage <= 1 ? "not-allowed" : "pointer",
                  fontSize: "10.5px",
                  fontWeight: 600,
                }}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={effectivePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: `1px solid ${tokens.border}`,
                  background: effectivePage >= totalPages ? "transparent" : (isDark ? tokens.surfaceBg : "#f1f5f9"),
                  color: effectivePage >= totalPages ? tokens.textMuted : tokens.textPrimary,
                  cursor: effectivePage >= totalPages ? "not-allowed" : "pointer",
                  fontSize: "10.5px",
                  fontWeight: 600,
                }}
              >
                Next
              </button>
            </>
          )}
          {allRows.length > 20 && (
            <button
              type="button"
              onClick={() => {
                setIsExpanded((prev) => !prev);
                setCurrentPage(1);
              }}
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                border: `1px solid ${tokens.border}`,
                background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
                color: tokens.textSecondary,
                cursor: "pointer",
                fontSize: "10.5px",
                fontWeight: 600,
                marginLeft: totalPages > 1 ? "4px" : "0",
              }}
            >
              {isExpanded ? "Collapse (20)" : "Expand (100)"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminCopilotChat: React.FC<AdminCopilotChatProps> = ({
  siteId,
  siteDefinition,
  onSiteDefinitionChange,
  onOpenBilling,
}) => {
  const navigate = useNavigate();

  const handleUpgradeClick = () => {
    if (onOpenBilling) {
      onOpenBilling();
      return;
    }
    if (siteId) {
      navigate(`/builder/${siteId}/settings/billing`);
    } else {
      navigate("/admin/sites");
    }
  };

  const { admin, hasPermission, isOwner } = useAdminAuth();
  const canAccessCopilot = !admin || isOwner || hasPermission("chat:access") || hasPermission("chat:view") || hasPermission("*");
  const canSendCopilot = canAccessCopilot;

  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    if (typeof window !== "undefined" && siteId) {
      try {
        const stored = sessionStorage.getItem(`webnirmaan_copilot_chat_${siteId}`) || localStorage.getItem(`webnirmaan_copilot_chat_${siteId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((m: any) => m?.id !== "welcome-init" && m?.id !== "welcome-1");
          }
        }
      } catch {}
    }
    return [];
  });
  const [snapshotHistory, setSnapshotHistory] = useState<any[]>(() => {
    if (typeof window !== "undefined" && siteId) {
      try {
        const stored = sessionStorage.getItem(`webnirmaan_copilot_snapshots_${siteId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPaywallLocked, setIsPaywallLocked] = useState(false);
  const [paywallResetDate, setPaywallResetDate] = useState<string | null>(null);

  // Site Isolation & Abort Controller Refs
  const currentSiteIdRef = useRef<string>(siteId);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Handle site switching: abort ongoing streams and switch session cleanly
  useEffect(() => {
    if (currentSiteIdRef.current !== siteId) {
      // Abort old active stream
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
      currentSiteIdRef.current = siteId;
      setLoading(false);

      // Load session for the newly selected site
      if (typeof window !== "undefined" && siteId) {
        try {
          const stored = sessionStorage.getItem(`webnirmaan_copilot_chat_${siteId}`) || localStorage.getItem(`webnirmaan_copilot_chat_${siteId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setMessages(parsed.filter((m: any) => m?.id !== "welcome-init" && m?.id !== "welcome-1"));
            } else {
              setMessages([]);
            }
          } else {
            setMessages([]);
          }

          const storedSnapshots = sessionStorage.getItem(`webnirmaan_copilot_snapshots_${siteId}`);
          if (storedSnapshots) {
            const parsedSnaps = JSON.parse(storedSnapshots);
            if (Array.isArray(parsedSnaps)) {
              setSnapshotHistory(parsedSnaps);
            } else {
              setSnapshotHistory([]);
            }
          } else {
            setSnapshotHistory([]);
          }
        } catch {
          setMessages([]);
          setSnapshotHistory([]);
        }
      } else {
        setMessages([]);
        setSnapshotHistory([]);
      }
    }
  }, [siteId]);

  const handleUndoLastChange = () => {
    if (snapshotHistory.length === 0) {
      setToastMsg("No previous changes to undo.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    const prevDef = snapshotHistory[snapshotHistory.length - 1];
    const newSnapshots = snapshotHistory.slice(0, -1);
    setSnapshotHistory(newSnapshots);
    if (typeof window !== "undefined" && siteId) {
      try {
        if (newSnapshots.length > 0) {
          sessionStorage.setItem(`webnirmaan_copilot_snapshots_${siteId}`, JSON.stringify(newSnapshots));
        } else {
          sessionStorage.removeItem(`webnirmaan_copilot_snapshots_${siteId}`);
        }
      } catch {}
    }
    if (onSiteDefinitionChange && prevDef) {
      onSiteDefinitionChange(prevDef);
      setToastMsg("Reverted to previous design snapshot.");
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setSnapshotHistory([]);
    if (typeof window !== "undefined" && siteId) {
      try {
        sessionStorage.removeItem(`webnirmaan_copilot_chat_${siteId}`);
        localStorage.removeItem(`webnirmaan_copilot_chat_${siteId}`);
        sessionStorage.removeItem(`webnirmaan_copilot_snapshots_${siteId}`);
      } catch {}
    }
    setToastMsg("Conversation and design history cleared.");
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Persist messages across drawer closing/opening
  useEffect(() => {
    if (typeof window !== "undefined" && siteId) {
      try {
        if (messages.length > 0) {
          sessionStorage.setItem(`webnirmaan_copilot_chat_${siteId}`, JSON.stringify(messages));
          localStorage.setItem(`webnirmaan_copilot_chat_${siteId}`, JSON.stringify(messages));
        } else {
          sessionStorage.removeItem(`webnirmaan_copilot_chat_${siteId}`);
          localStorage.removeItem(`webnirmaan_copilot_chat_${siteId}`);
        }
      } catch {}
    }
  }, [messages, siteId]);

  // Persist snapshotHistory across drawer closing/opening/navigation
  useEffect(() => {
    if (typeof window !== "undefined" && siteId) {
      try {
        if (snapshotHistory.length > 0) {
          sessionStorage.setItem(`webnirmaan_copilot_snapshots_${siteId}`, JSON.stringify(snapshotHistory));
        } else {
          sessionStorage.removeItem(`webnirmaan_copilot_snapshots_${siteId}`);
        }
      } catch {}
    }
  }, [snapshotHistory, siteId]);

  const { isDark, tokens } = useAdminTheme();

  // Dynamic admin dashboard theme for Copilot UI
  const chatBg = tokens.surfaceBg;
  const chatText = tokens.textPrimary;
  const chatMuted = tokens.textMuted;
  const userBubbleBg = tokens.accent;
  const assistantBubbleBg = isDark ? tokens.elevatedSurfaceBg : "#f1f5f9";
  const assistantBubbleText = isDark ? tokens.textPrimary : "#0f172a";
  const inputBorderColor = tokens.border;
  const inputBg = isDark ? tokens.elevatedSurfaceBg : "#ffffff";

  const handleSaveThemeToLibrary = (themeObj: any, themeName: string) => {
    if (siteDefinition && onSiteDefinitionChange) {
      const themePatch: Record<string, string> = { festival_theme: "none" };
      const paletteKeys = [
        "primary_bg", "secondary_bg", "text_color", "muted_text", "muted_text_color", "soft_text_color",
        "accent_color", "accent_hover", "accent_text",
        "border_color", "soft_border",
        "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color",
        "footer_bg", "footer_text_color", "footer_muted_color",
        "hero_bg", "hero_text_color", "hero_accent",
        "card_bg", "card_text_color", "card_shadow",
      ];
      const sourceObj = themeObj?.patch || themeObj?.theme || themeObj || {};
      for (const key of paletteKeys) {
        if (sourceObj[key]) themePatch[key] = sourceObj[key];
      }
      if (sourceObj.muted_text && !themePatch.muted_text_color) {
        themePatch.muted_text_color = sourceObj.muted_text;
      }
      if (themePatch.navbar_bg && !themePatch.navbar_outer_bg) {
        themePatch.navbar_outer_bg = themePatch.navbar_bg;
      }
      if (!themePatch.hero_bg) {
        themePatch.hero_bg = themePatch.primary_bg || themePatch.secondary_bg;
      }
      if (!themePatch.hero_text_color) {
        themePatch.hero_text_color = themePatch.text_color;
      }
      if (!themePatch.hero_accent) {
        themePatch.hero_accent = themePatch.accent_color;
      }
      const updatedDef = saveThemeSnapshot(siteDefinition as any, themeName, themePatch);
      onSiteDefinitionChange(updatedDef);
    }

    setToastMsg(`Saved "${themeName}" to SAVED SNAPSHOTS in sidepanel!`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleApplyPaletteDirectly = async (palette: any) => {
    if (!siteDefinition || !onSiteDefinitionChange) return;

    // Build a complete theme patch from the palette object
    const themePatch: Record<string, string> = {
      festival_theme: "none",
    };
    const paletteKeys = [
      "primary_bg", "secondary_bg", "text_color", "muted_text", "muted_text_color", "soft_text_color",
      "accent_color", "accent_hover", "accent_text",
      "border_color", "soft_border",
      "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color",
      "footer_bg", "footer_text_color", "footer_muted_color",
      "hero_bg", "hero_text_color", "hero_accent",
      "card_bg", "card_text_color", "card_shadow",
    ];
    for (const key of paletteKeys) {
      if (palette[key]) themePatch[key] = palette[key];
    }
    if (palette.muted_text && !themePatch.muted_text_color) {
      themePatch.muted_text_color = palette.muted_text;
    }
    if (themePatch.navbar_bg && !themePatch.navbar_outer_bg) {
      themePatch.navbar_outer_bg = themePatch.navbar_bg;
    }
    if (!themePatch.hero_bg) {
      themePatch.hero_bg = themePatch.primary_bg || themePatch.secondary_bg;
    }
    if (!themePatch.hero_text_color) {
      themePatch.hero_text_color = themePatch.text_color;
    }
    if (!themePatch.hero_accent) {
      themePatch.hero_accent = themePatch.accent_color;
    }

    // Save snapshot before applying palette
    if (siteDefinition) {
      const updatedSnapshots = [...snapshotHistory.slice(-10), JSON.parse(JSON.stringify(siteDefinition))];
      setSnapshotHistory(updatedSnapshots);
      if (typeof window !== "undefined" && siteId) {
        try {
          sessionStorage.setItem(`webnirmaan_copilot_snapshots_${siteId}`, JSON.stringify(updatedSnapshots));
        } catch {}
      }
    }

    // Apply theme patch via updateThemeValues so all pages and components purge old block-level color locks
    const updatedDef = updateThemeValues(siteDefinition as any, themePatch);

    // Apply immediately on the builder canvas
    onSiteDefinitionChange(updatedDef);

    // Add a confirmation message in chat
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: "user", text: `Apply the "${palette.name}" color theme`, time: timeNow },
    ]);

    // Send to backend so the copilot can acknowledge the change
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          site_id: siteId,
          message: `I applied the "${palette.name}" color theme with these colors: ${JSON.stringify(themePatch)}`,
          chat_history: messages.map((m) => ({ sender: m.sender, text: m.text })),
          draft_definition: updatedDef,
        }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { id: `asst-${Date.now()}`, sender: "assistant", text: data.assistant_reply || `Applied the **${palette.name}** theme to your store! ✨`, time: timeNow },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `asst-${Date.now()}`, sender: "assistant", text: `Applied the **${palette.name}** theme successfully! ✨`, time: timeNow },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setLoading(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.text === "Processing..."
          ? { ...msg, text: "Generation cancelled by user." }
          : msg
      )
    );
  };

  const handleSend = async (textToSend?: string) => {
    if (!canSendCopilot) return;
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Clean history of any stale or pending placeholders
    const cleanHistory = messages
      .filter((m) => m.text && m.text !== "Processing..." && m.text.trim().length > 0)
      .map((m) => ({ sender: m.sender, text: m.text }));

    setMessages((prev) => [
      ...prev.filter((m) => m.text !== "Processing..."),
      { id: userMsgId, sender: "user", text, time: timeNow },
      { id: assistantMsgId, sender: "assistant", text: "Processing...", time: timeNow },
    ]);

    if (!textToSend) setInput("");
    setLoading(true);

    const operationId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requestSiteId = siteId;

    try {
      let data: any = null;
      let streamedText = "";

      const controller = new AbortController();
      activeAbortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        const streamResponse = await fetch(`${API_BASE_URL}/copilot/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            site_id: requestSiteId,
            operation_id: operationId,
            message: text,
            chat_history: [...cleanHistory, { sender: "user", text }],
            draft_definition: siteDefinition,
            previous_draft_definition: snapshotHistory.length > 0 ? snapshotHistory[snapshotHistory.length - 1] : null,
            snapshot_history: snapshotHistory,
          }),
        });

        clearTimeout(timeoutId);

        if (streamResponse.status === 402) {
          setIsPaywallLocked(true);
          const errData = await streamResponse.json().catch(() => ({}));
          data = {
            type: "paywall_exhausted",
            assistant_reply: "Monthly AI credit limit reached. Please upgrade your plan for higher monthly credit limits.",
            data_cards: [{
              type: "paywall_card",
              title: "AI Credit Limit Reached",
              description: "You have used all credits in your current monthly pool. Upgrade your subscription to continue using AI Copilot and generating stores.",
              reset_date: errData?.detail?.reset_date,
            }],
          };
        } else if (streamResponse.ok && streamResponse.body) {
          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            // If user switched sites while streaming or aborted, abandon stream consumption
            if (currentSiteIdRef.current !== requestSiteId || controller.signal.aborted) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data:")) {
                try {
                  const event = JSON.parse(trimmed.slice(5).trim());
                  // Verify event belongs to this site
                  if (event.site_id && event.site_id !== currentSiteIdRef.current) {
                    continue;
                  }

                  if (event.type === "paywall_exhausted" || event.error_code === "AI_CREDIT_LIMIT_REACHED") {
                    setIsPaywallLocked(true);
                    if (event.reset_date) setPaywallResetDate(event.reset_date);
                    data = event;
                  } else if (event.type === "token" && event.content) {
                    streamedText += event.content;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMsgId
                          ? { ...msg, text: streamedText }
                          : msg
                      )
                    );
                  } else if (event.type === "done") {
                    data = event;
                    if (event.assistant_reply && !streamedText) {
                      streamedText = event.assistant_reply;
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === assistantMsgId
                            ? { ...msg, text: event.assistant_reply }
                            : msg
                        )
                      );
                    }
                  }
                } catch {
                  // Ignore partial json in stream
                }
              }
            }
          }
        }
      } catch (streamErr: any) {
        if (streamErr?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        console.warn("Copilot SSE stream failed, falling back to standard endpoint:", streamErr);
      }

      // If user switched away or cancelled, do not proceed with state updates or fallbacks
      if (currentSiteIdRef.current !== requestSiteId || controller.signal.aborted) {
        return;
      }

      // Fallback if stream did not return done payload
      if (!data && !streamedText && !controller.signal.aborted) {
        const response = await fetch(`${API_BASE_URL}/copilot/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            site_id: requestSiteId,
            operation_id: operationId,
            message: text,
            chat_history: [...cleanHistory, { sender: "user", text }],
            draft_definition: siteDefinition,
            previous_draft_definition: snapshotHistory.length > 0 ? snapshotHistory[snapshotHistory.length - 1] : null,
            snapshot_history: snapshotHistory,
          }),
        });


        if (response.status === 402) {
          setIsPaywallLocked(true);
          const errData = await response.json().catch(() => ({}));
          data = {
            type: "paywall_exhausted",
            assistant_reply: "Monthly AI credit limit reached. Please upgrade your plan for higher monthly credit limits.",
            data_cards: [{
              type: "paywall_card",
              title: "AI Credit Limit Reached",
              description: "You have used all credits in your current monthly pool. Upgrade your subscription to continue using AI Copilot and generating stores.",
              reset_date: errData?.detail?.reset_date,
            }],
          };
        } else if (!response.ok) {
          throw new Error("Co-Pilot request failed");
        } else {
          data = await response.json();
        }
      }

      // If aborted before rendering, exit cleanly
      if (controller.signal.aborted) {
        return;
      }

      // Trigger Live Design Update or Revert in Builder
      const updatedDraft = data?.updated_draft_definition || data?.next_draft_definition;
      let finalCards = data?.data_cards || [];
      let finalReply = data?.assistant_reply || streamedText || (data?.data_cards?.length ? "Here are the details from your store:" : "I've processed your store request.");

      if (data?.action === "revert_snapshot") {
        if (snapshotHistory.length > 0) {
          const prevDef = snapshotHistory[snapshotHistory.length - 1];
          const remainingCount = snapshotHistory.length - 1;
          const nextSnaps = snapshotHistory.slice(0, -1);
          setSnapshotHistory(nextSnaps);
          if (typeof window !== "undefined" && requestSiteId) {
            try {
              if (nextSnaps.length > 0) {
                sessionStorage.setItem(`webnirmaan_copilot_snapshots_${requestSiteId}`, JSON.stringify(nextSnaps));
              } else {
                sessionStorage.removeItem(`webnirmaan_copilot_snapshots_${requestSiteId}`);
              }
            } catch {}
          }
          if (onSiteDefinitionChange && prevDef) {
            onSiteDefinitionChange(prevDef);
          }
          finalReply = `Successfully reverted your storefront design to the previous snapshot (${remainingCount} earlier ${remainingCount === 1 ? 'version' : 'versions'} remaining).`;
          finalCards = [];
        } else {
          finalReply = "No previous design snapshots found to revert to. Your storefront is currently at its baseline state.";
          finalCards = [];
        }
      } else if (data?.design_modified && updatedDraft && onSiteDefinitionChange) {
        if (siteDefinition) {
          // If this was a compound operation that reverted the previous change first,
          // the discarded intermediate state (siteDefinition) must NOT be saved into history.
          // The previous valid snapshot (already in snapshotHistory) remains the base.
          let updatedSnapshots = snapshotHistory;
          if (!data?.has_reverted_base) {
            updatedSnapshots = [...snapshotHistory.slice(-10), JSON.parse(JSON.stringify(siteDefinition))];
            setSnapshotHistory(updatedSnapshots);
          }
          if (typeof window !== "undefined" && requestSiteId) {
            try {
              sessionStorage.setItem(`webnirmaan_copilot_snapshots_${requestSiteId}`, JSON.stringify(updatedSnapshots));
            } catch {}
          }
        }
        const nextTheme = updatedDraft.theme || {};
        const syncedPages = applyThemeToPages(
          updatedDraft.pages || [],
          nextTheme
        );
        onSiteDefinitionChange({
          ...updatedDraft,
          pages: syncedPages,
        });
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: finalReply,
                cards: finalCards,
              }
            : msg
        )
      );
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message === "canceled" || err?.message?.includes("aborted")) {
        return;
      }
      console.error("Copilot chat error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: "I ran into an issue connecting to store services. Please try again.",
              }
            : msg
        )
      );
    } finally {
      activeAbortControllerRef.current = null;
      setLoading(false);
    }
  };

  if (!canAccessCopilot) {
    return <AccessDeniedView moduleName="AI Copilot" requiredPermission="chat:access" />;
  }

  return (
    <div
      className="copilot-chat-root"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "calc(100vh - 110px)",
        background: chatBg,
        color: chatText,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        .copilot-chat-root,
        .copilot-chat-root input,
        .copilot-chat-root button,
        .copilot-chat-root textarea,
        .copilot-chat-root span,
        .copilot-chat-root div,
        .copilot-chat-root p,
        .copilot-chat-root h1,
        .copilot-chat-root h2,
        .copilot-chat-root h3 {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .copilot-thinking-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #64748b;
          display: inline-block;
          animation: copilotDotPulse 1.4s ease-in-out infinite both;
        }

        @keyframes copilotDotPulse {
          0%, 80%, 100% {
            transform: scale(0.65);
            opacity: 0.35;
          }
          40% {
            transform: scale(1);
            opacity: 0.95;
          }
        }
      `}</style>
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(240, 253, 244, 0.7)",
            backdropFilter: "blur(12px) saturate(180%)",
            WebkitBackdropFilter: "blur(12px) saturate(180%)",
            color: "#14532d",
            border: "1px solid rgba(22, 163, 74, 0.3)",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "8px",
            marginBottom: "8px",
            textAlign: "center",
            boxShadow: "0 8px 24px 0 rgba(22, 101, 52, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.4)",
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Messages Feed */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
        {messages.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: "260px", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <AiAvatar size={42} style={{ marginBottom: "12px" }} />
            <div style={{ fontSize: "14px", fontWeight: 700, color: chatText, marginBottom: "6px" }}>
              WebCreon Co-Pilot
            </div>
            <p style={{ fontSize: "12px", lineHeight: 1.5, margin: 0, color: chatMuted }}>
              Ask Co-Pilot to customize your live store design, manage orders & returns, or analyze store sales performance.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
          const isUser = msg.sender === "user";
          const hasPaywallCard = !isUser && msg.cards?.some((c) => c.type === "paywall_card");
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
              {/* If paywall card, render as a single clean card */}
              {hasPaywallCard ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", width: "100%", maxWidth: "92%" }}>
                  <AiAvatar size={24} style={{ marginTop: "2px" }} />
                  <div style={{ flex: 1 }}>
                    {msg.cards?.map((card, cIdx) => {
                      if (card.type === "paywall_card") {
                        return (
                          <div
                            key={cIdx}
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                              border: `1px solid ${tokens.border}`,
                              boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
                            }}
                          >
                            <div style={{ fontSize: "13px", fontWeight: 600, color: tokens.textPrimary, marginBottom: "4px" }}>
                              {card.title || "AI Credit Limit Reached"}
                            </div>
                            <div style={{ fontSize: "12px", color: tokens.textSecondary, lineHeight: 1.5, marginBottom: card.reset_date ? "6px" : "10px" }}>
                              {card.description || "You have used all credits in your monthly pool. Upgrade your plan to continue using AI Copilot."}
                            </div>
                            {card.reset_date && (
                              <div style={{ fontSize: "11px", color: tokens.textMuted, marginBottom: "10px" }}>
                                Resets on: {new Date(card.reset_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={handleUpgradeClick}
                              style={{
                                padding: "6px 14px",
                                background: tokens.accent,
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Upgrade Plan
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {msg.text && (
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row", maxWidth: "94%" }}>
                      {!isUser && <AiAvatar size={24} style={{ marginTop: "2px", flexShrink: 0 }} />}
                      {!isUser && msg.text === "Processing..." ? (
                        <CopilotThinkingBubble bg={assistantBubbleBg} />
                      ) : (
                        <div
                          style={{
                            padding: isUser ? "10px 14px" : "12px 16px",
                            borderRadius: isUser ? "16px 16px 3px 16px" : "16px 16px 16px 3px",
                            background: isUser ? userBubbleBg : assistantBubbleBg,
                            color: isUser ? "#ffffff" : assistantBubbleText,
                            fontSize: "13px",
                            lineHeight: 1.6,
                            boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.04)",
                            border: isUser ? "none" : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                            wordBreak: "break-word" as const,
                            overflowWrap: "anywhere" as const,
                          }}
                        >
                          {isUser ? (
                            <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {msg.text.split("\n\n").map((para, pIdx) => {
                                const trimmed = para.trim();
                                if (!trimmed) return null;

                                // Bullet point list block
                                if (trimmed.includes("\n- ") || trimmed.includes("\n* ") || trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
                                  const lines = trimmed.split("\n");
                                  return (
                                    <ul key={pIdx} style={{ margin: "2px 0 4px 0", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                      {lines.map((line, lIdx) => {
                                        const cleanLine = line.replace(/^[\*\-•]\s+/, "").trim();
                                        if (!cleanLine) return null;
                                        return (
                                          <li key={lIdx} style={{ fontSize: "12.5px", lineHeight: 1.5 }}>
                                            {formatInlineMarkdown(cleanLine)}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  );
                                }

                                // Header line (### or ##)
                                if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
                                  const hText = trimmed.replace(/^#+\s+/, "");
                                  return (
                                    <div key={pIdx} style={{ fontWeight: 700, fontSize: "13px", color: isDark ? "#f1f5f9" : "#0f172a", marginTop: pIdx > 0 ? "4px" : 0 }}>
                                      {formatInlineMarkdown(hText)}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={pIdx} style={{ fontSize: "12.5px", lineHeight: 1.55 }}>
                                    {formatInlineMarkdown(trimmed)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Render Structured Data Cards */}
                  {msg.cards && msg.cards.length > 0 && (
                    <div style={{ width: "100%", marginTop: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {msg.cards.map((card, cIdx) => {
                        if (card.type === "redirect_card") {
                          return (
                            <div
                              key={cIdx}
                              style={{
                                padding: "12px",
                                borderRadius: "10px",
                                background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                                border: "1px solid #bfdbfe",
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e40af", marginBottom: "4px" }}>{card.title}</div>
                              <div style={{ fontSize: "11px", color: "#3b82f6", marginBottom: "8px" }}>{card.description}</div>
                              <button
                                type="button"
                                onClick={() => navigate(card.target_url || "/admin/dashboard")}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: "none",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {card.button_label || "Go to AI Dashboard"}
                              </button>
                            </div>
                          );
                        }

                        if (card.type === "palette_suggestions_card" && Array.isArray(card.palettes)) {
                      return (
                        <div
                          key={cIdx}
                          style={{
                            padding: "12px",
                            borderRadius: "14px",
                            background: isDark ? "rgba(30, 41, 59, 0.75)" : "#ffffff",
                            backdropFilter: "blur(12px)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                            boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 12px rgba(0,0,0,0.04)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "nowrap", marginBottom: "10px" }}>
                            <span
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 700,
                                color: tokens.textPrimary,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                flex: 1,
                                minWidth: 0,
                              }}
                              title={card.title || "Suggested Themes"}
                            >
                              {card.title || "Suggested Themes"}
                            </span>
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: 600,
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.1)",
                                color: isDark ? "#a5b4fc" : "#4f46e5",
                                flexShrink: 0,
                                whiteSpace: "nowrap",
                              }}
                            >
                              WCAG AA
                            </span>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {card.palettes.map((pal: any, pIdx: number) => {
                              const pBg = pal.primary_bg || "#ffffff";
                              const sBg = pal.secondary_bg || pal.card_bg || "#f8fafc";
                              const aCol = pal.accent_color || "#3b82f6";
                              const nBg = pal.navbar_bg || pBg;
                              const fBg = pal.footer_bg || sBg;
                              const txtCol = pal.text_color || "#0f172a";

                              return (
                                <div
                                  key={pIdx}
                                  style={{
                                    padding: "10px 12px",
                                    background: isDark ? "rgba(15, 23, 42, 0.55)" : "#f8fafc",
                                    borderRadius: "10px",
                                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                  }}
                                >
                                  {/* Row 1: Header (Title & Style Badge) */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>
                                      {pal.name}
                                    </span>
                                    {pal.visual_style && (
                                      <span
                                        style={{
                                          fontSize: "9.5px",
                                          fontWeight: 600,
                                          color: isDark ? "#94a3b8" : "#64748b",
                                          background: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
                                          padding: "2px 7px",
                                          borderRadius: "6px",
                                          textTransform: "capitalize",
                                        }}
                                      >
                                        {pal.visual_style.replace(/_/g, " ")}
                                      </span>
                                    )}
                                  </div>

                                  {/* Row 2: Spectrum Preview Bar */}
                                  <div
                                    style={{
                                      display: "flex",
                                      height: "8px",
                                      borderRadius: "4px",
                                      overflow: "hidden",
                                      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                                    }}
                                  >
                                    <div style={{ flex: 3.5, background: pBg }} title={`Primary BG: ${pBg}`} />
                                    <div style={{ flex: 2.0, background: sBg }} title={`Surface: ${sBg}`} />
                                    <div style={{ flex: 2.0, background: aCol }} title={`Accent CTA: ${aCol}`} />
                                    <div style={{ flex: 1.5, background: nBg }} title={`Navbar: ${nBg}`} />
                                    <div style={{ flex: 1.0, background: fBg }} title={`Footer: ${fBg}`} />
                                  </div>

                                  {/* Row 3: Semantic Color Chips Grid (BG, Accent, Nav, Text) */}
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                                    {[
                                      { label: "BG", color: pBg },
                                      { label: "Accent", color: aCol },
                                      { label: "Nav", color: nBg },
                                      { label: "Text", color: txtCol },
                                    ].map((sw, sIdx) => (
                                      <div
                                        key={sIdx}
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          gap: "2px",
                                          padding: "4px 2px",
                                          background: isDark ? "rgba(0,0,0,0.2)" : "#ffffff",
                                          borderRadius: "6px",
                                          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                          <div
                                            style={{
                                              width: "8px",
                                              height: "8px",
                                              borderRadius: "50%",
                                              background: sw.color,
                                              border: "1px solid rgba(0,0,0,0.15)",
                                              flexShrink: 0,
                                            }}
                                          />
                                          <span style={{ fontSize: "9px", fontWeight: 600, color: tokens.textMuted }}>
                                            {sw.label}
                                          </span>
                                        </div>
                                        <span
                                          style={{
                                            fontFamily: "ui-monospace, monospace",
                                            fontSize: "9px",
                                            fontWeight: 500,
                                            color: tokens.textSecondary,
                                            letterSpacing: "-0.02em",
                                          }}
                                        >
                                          {sw.color}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Row 4: Ultra-Clean 1-Line Description */}
                                  {pal.description && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: tokens.textMuted,
                                        lineHeight: 1.35,
                                        display: "-webkit-box",
                                        WebkitLineClamp: 1,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                      title={pal.description}
                                    >
                                      {pal.description}
                                    </div>
                                  )}

                                  {/* Row 5: Action Buttons */}
                                  <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleApplyPaletteDirectly(pal)}
                                      style={{
                                        flex: 1,
                                        padding: "6px 12px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        background: isDark ? "#38bdf8" : "#0f172a",
                                        color: isDark ? "#0f172a" : "#ffffff",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "4px",
                                        transition: "opacity 0.15s ease",
                                      }}
                                    >
                                      Apply Theme
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveThemeToLibrary(pal, pal.name)}
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                                        color: tokens.textSecondary,
                                        border: `1px solid ${tokens.border}`,
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        transition: "background 0.15s ease",
                                      }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "component_palette_suggestions_card" && Array.isArray(card.palettes)) {
                      const targetComp = (card.target_component || "navbar").toLowerCase();
                      return (
                        <div
                          key={cIdx}
                          style={{
                            padding: "12px",
                            borderRadius: "14px",
                            background: isDark ? "rgba(30, 41, 59, 0.75)" : "#ffffff",
                            backdropFilter: "blur(12px)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                            boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.25)" : "0 2px 12px rgba(0,0,0,0.04)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "nowrap", marginBottom: "10px" }}>
                            <span
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 700,
                                color: tokens.textPrimary,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                flex: 1,
                                minWidth: 0,
                              }}
                              title={card.title || `${targetComp.toUpperCase()} Styles`}
                            >
                              {card.title || `${targetComp.toUpperCase()} Styles`}
                            </span>
                            <span
                              style={{
                                fontSize: "9.5px",
                                fontWeight: 600,
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: "rgba(37, 99, 235, 0.1)",
                                color: "#2563eb",
                                flexShrink: 0,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Component
                            </span>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {card.palettes.map((pal: any, pIdx: number) => {
                              const compPatch: Record<string, string> = { name: pal.name };
                              if (targetComp === "navbar") {
                                compPatch.navbar_bg = pal.navbar_bg || pal.accent_color;
                                compPatch.navbar_text_color = pal.navbar_text_color || "#ffffff";
                                compPatch.navbar_border_color = pal.navbar_border_color || pal.border_color || compPatch.navbar_bg;
                              } else if (targetComp === "footer") {
                                compPatch.footer_bg = pal.footer_bg || pal.secondary_bg;
                                compPatch.footer_text_color = pal.footer_text_color || pal.text_color;
                              } else if (targetComp === "hero") {
                                compPatch.hero_bg = pal.hero_bg || pal.primary_bg;
                                compPatch.hero_text_color = pal.hero_text_color || pal.text_color;
                              } else if (targetComp === "card" || targetComp === "product") {
                                compPatch.card_bg = pal.card_bg || pal.secondary_bg;
                                compPatch.card_text_color = pal.card_text_color || pal.text_color;
                              } else {
                                if (pal.navbar_bg) compPatch.navbar_bg = pal.navbar_bg;
                                if (pal.navbar_text_color) compPatch.navbar_text_color = pal.navbar_text_color;
                              }

                              const mainBg = compPatch.navbar_bg || compPatch.footer_bg || compPatch.hero_bg || compPatch.card_bg || pal.accent_color || "#2563eb";
                              const mainTxt = compPatch.navbar_text_color || compPatch.footer_text_color || compPatch.hero_text_color || compPatch.card_text_color || "#ffffff";

                              return (
                                <div
                                  key={pIdx}
                                  style={{
                                    padding: "10px 12px",
                                    background: isDark ? "rgba(15, 23, 42, 0.55)" : "#f8fafc",
                                    borderRadius: "10px",
                                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                  }}
                                >
                                  {/* Row 1: Header */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "13px", fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.01em" }}>
                                      {pal.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "9.5px",
                                        fontWeight: 600,
                                        color: isDark ? "#94a3b8" : "#64748b",
                                        background: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
                                        padding: "2px 7px",
                                        borderRadius: "6px",
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      {targetComp}
                                    </span>
                                  </div>

                                  {/* Row 2: Component Live Preview Bar */}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: "5px 10px",
                                      borderRadius: "6px",
                                      background: mainBg,
                                      color: mainTxt,
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      border: "1px solid rgba(0,0,0,0.1)",
                                    }}
                                  >
                                    <span>{targetComp.toUpperCase()} Sample</span>
                                    <span style={{ fontSize: "9.5px", opacity: 0.9, fontFamily: "ui-monospace, monospace" }}>{mainBg}</span>
                                  </div>

                                  {/* Row 3: Description */}
                                  {pal.description && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: tokens.textMuted,
                                        lineHeight: 1.35,
                                        display: "-webkit-box",
                                        WebkitLineClamp: 1,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                      title={pal.description}
                                    >
                                      {pal.description}
                                    </div>
                                  )}

                                  {/* Row 4: Action Buttons */}
                                  <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleApplyPaletteDirectly(compPatch)}
                                      style={{
                                        flex: 1,
                                        padding: "6px 12px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        background: isDark ? "#38bdf8" : "#0f172a",
                                        color: isDark ? "#0f172a" : "#ffffff",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        transition: "opacity 0.15s ease",
                                      }}
                                    >
                                      Apply Style
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveThemeToLibrary(compPatch, `${pal.name} (${targetComp})`)}
                                      style={{
                                        padding: "6px 12px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
                                        color: tokens.textSecondary,
                                        border: `1px solid ${tokens.border}`,
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        transition: "background 0.15s ease",
                                      }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "camouflage_warning_card") {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: "#fffbebe6", border: "1px solid #fde68a" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#b45309" }}>{card.title}</div>
                          <div style={{ fontSize: "11px", color: "#78350f", marginBottom: "8px" }}>{card.description}</div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => handleSend(`Update both: set ${card.bg_key} to ${card.new_bg} and set ${card.bg_key?.replace('_bg', '_text_color')} to ${card.suggested_text}`)}
                              style={{ padding: "4px 8px", fontSize: "10px", fontWeight: 700, background: "#d97706", color: "#ffffff", border: "none", borderRadius: "5px", cursor: "pointer" }}
                            >
                              Update Both (High Contrast)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveThemeToLibrary({ [card.bg_key || 'navbar_bg']: card.new_bg, [card.bg_key?.replace('_bg', '_text_color') || 'navbar_text_color']: card.suggested_text }, "High Contrast Palette")}
                              style={{ padding: "4px 8px", fontSize: "10px", fontWeight: 700, background: "#059669", color: "#ffffff", border: "none", borderRadius: "5px", cursor: "pointer" }}
                            >
                              Save to Library
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "analytics_card" && card.metrics) {
                      return (
                        <div key={cIdx} style={{ padding: "12px", borderRadius: "10px", background: "#0f172a", color: "#ffffff" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#94a3b8" }}>{card.title}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Total Sales</div>
                              <div style={{ fontSize: "14px", fontWeight: 800, color: "#10b981" }}>{card.metrics.total_sales}</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Orders</div>
                              <div style={{ fontSize: "14px", fontWeight: 800 }}>{card.metrics.orders_count}</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Avg Rating</div>
                              <div style={{ fontSize: "14px", fontWeight: 800, color: "#f59e0b" }}>{card.metrics.average_rating}</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Cancel Rate</div>
                              <div style={{ fontSize: "14px", fontWeight: 800, color: "#ef4444" }}>{card.metrics.cancellation_rate}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "returns_card" && card.returns) {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: isDark ? tokens.elevatedSurfaceBg : "#f8fafc", border: `1px solid ${tokens.border}` }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: tokens.textPrimary }}>{card.title}</div>
                          {card.returns.map((ret: any, rIdx: number) => {
                            const rst = String(ret.status || "Requested").toLowerCase();
                            const badgeBg = rst.includes("approved") || rst.includes("closed") ? tokens.success : rst.includes("reject") ? tokens.danger : rst.includes("inspect") || rst.includes("receive") ? tokens.warning : tokens.accent;

                            return (
                              <div key={rIdx} style={{ padding: "8px 10px", background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "8px", border: `1px solid ${tokens.border}`, marginBottom: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: tokens.textPrimary }}>Return #{ret.id} {ret.order_id ? `(Order #${ret.order_id})` : ""}</span>
                                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: badgeBg, color: "#ffffff" }}>{ret.status}</span>
                                </div>
                                <div style={{ fontSize: "11px", color: tokens.textSecondary, marginBottom: "2px" }}>Reason: {ret.reason || "Customer return request"}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 800, color: tokens.success }}>₹{ret.amount?.toFixed?.(2) || ret.amount || "0.00"}</span>
                                  <span style={{ fontSize: "10px", color: tokens.textMuted }}>Refund: {ret.refund_status || "Pending"}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (card.type === "confirmation_guard_card") {
                      const details = Array.isArray(card.details) ? card.details : [];
                      return (
                        <div
                          key={cIdx}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                            border: `1px solid ${tokens.border}`,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: tokens.textPrimary }}>
                              {card.title || "Confirm Action"}
                            </span>
                            {card.target_name && (
                              <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "monospace", color: isDark ? "#c084fc" : "#7c3aed" }}>
                                {card.target_name}
                              </span>
                            )}
                          </div>

                          {(card.summary || card.warning) && (
                            <div style={{ fontSize: "11.5px", color: tokens.textSecondary, marginBottom: "8px" }}>
                              {card.summary || card.warning}
                            </div>
                          )}

                          {details.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                                marginBottom: "8px",
                              }}
                            >
                              {details.map((d: any, dIdx: number) => (
                                <span
                                  key={dIdx}
                                  style={{
                                    fontSize: "10.5px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: isDark ? tokens.surfaceBg : "#f1f5f9",
                                    border: `1px solid ${tokens.border}`,
                                    color: tokens.textSecondary,
                                  }}
                                >
                                  <strong style={{ color: tokens.textPrimary, fontWeight: 600 }}>{d.label}:</strong> {d.value}
                                </span>
                              ))}
                            </div>
                          )}

                          <div style={{ marginTop: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (card.confirm_command) {
                                  handleSend(card.confirm_command);
                                } else if (card.action_type === "otp_bypass_delivery") {
                                  handleSend(`Confirm deliver #${card.target_order_id || ""}`);
                                } else if (card.action_type === "bulk_cancellation") {
                                  handleSend("Confirm cancel all orders");
                                } else {
                                  handleSend("Confirm action");
                                }
                              }}
                              style={{
                                padding: "5px 14px",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                background: isDark ? "#ffffff" : "#0f172a",
                                color: isDark ? "#0f172a" : "#ffffff",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                                transition: "opacity 0.15s ease",
                              }}
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "orders_card" && card.orders) {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: isDark ? tokens.elevatedSurfaceBg : "#f8fafc", border: `1px solid ${tokens.border}` }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: tokens.textPrimary }}>{card.title}</div>
                          {card.orders.map((ord: any, oIdx: number) => {
                            const isCancelled = String(ord.status).toLowerCase().includes("canc");
                            const isDelivered = String(ord.status).toLowerCase().includes("deliver");
                            const isConfirmed = String(ord.status).toLowerCase().includes("confirm") || String(ord.status).toLowerCase().includes("accept");
                            const badgeBg = isCancelled ? tokens.danger : isDelivered ? tokens.success : isConfirmed ? (isDark ? "#38bdf8" : "#0284c7") : tokens.accent;

                            return (
                              <div key={oIdx} style={{ padding: "8px 10px", background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "8px", border: `1px solid ${tokens.border}`, marginBottom: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: tokens.textPrimary }}>Order #{ord.id || ord.order_id}</span>
                                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: badgeBg, color: "#ffffff" }}>{ord.status}</span>
                                </div>
                                <div style={{ fontSize: "11px", color: tokens.textSecondary, marginBottom: "2px" }}>{ord.items_summary || "Order Items"}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 800, color: tokens.textPrimary, marginTop: "4px" }}>
                                  <span>₹{ord.total?.toFixed?.(2) || ord.total}</span>
                                  <span style={{ fontSize: "10px", color: tokens.textMuted, fontWeight: 500 }}>{ord.date || ord.updated_at || ""}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (card.type === "coupons_card" && card.coupons) {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: isDark ? tokens.elevatedSurfaceBg : "#f8fafc", border: `1px solid ${tokens.border}` }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: tokens.textPrimary }}>{card.title || "Promo Codes"}</div>
                          {card.coupons.map((coup: any, cpIdx: number) => {
                            const isActive = coup.is_active !== false;
                            return (
                              <div key={cpIdx} style={{ padding: "8px 10px", background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "8px", border: `1px solid ${tokens.border}`, marginBottom: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.05em", color: isDark ? "#c084fc" : "#7c3aed" }}>
                                    {coup.coupon_code || coup.code}
                                  </span>
                                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: isActive ? tokens.success : tokens.danger, color: "#ffffff" }}>
                                    {coup.discount_display || (isActive ? "Active" : "Inactive")}
                                  </span>
                                </div>
                                <div style={{ fontSize: "11px", color: tokens.textSecondary, marginBottom: "4px" }}>
                                  {coup.description || (coup.discount_type === "percentage" ? `${coup.discount_value}% OFF` : `₹${coup.discount_value} OFF`)}
                                </div>
                                {(coup.starts_at || coup.expires_at || coup.min_order_value > 0 || coup.max_discount_amount > 0) && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "10px", color: tokens.textMuted }}>
                                    {coup.min_order_value > 0 && <span>Min Order: ₹{coup.min_order_value}</span>}
                                    {coup.max_discount_amount > 0 && <span>Max Cap: ₹{coup.max_discount_amount}</span>}
                                    {coup.expires_at && <span>Expires: {coup.expires_at}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if ((card.type === "table_card" || card.type === "sql_query_result") && Array.isArray(card.rows)) {
                      return (
                        <CopilotInteractiveTableCard
                          key={cIdx}
                          card={card}
                          tokens={tokens}
                          isDark={isDark}
                        />
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </>
          )}

              <span
                style={{
                  fontSize: "9px",
                  color: "#94a3b8",
                  marginTop: "3px",
                  marginLeft: isUser ? "0" : "32px",
                  marginRight: isUser ? "4px" : "0",
                }}
              >
                {msg.time}
              </span>
            </div>
          );
        })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Utility Toolbar: Clear Chat & Undo Action Above Input */}
      {(snapshotHistory.length > 0 || messages.length > 0) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", marginBottom: "2px" }}>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear conversation and design history"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                color: tokens.textMuted,
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? "#f87171" : "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.textMuted)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Clear Chat</span>
            </button>
          ) : <div />}

          {snapshotHistory.length > 0 && (
            <button
              type="button"
              onClick={handleUndoLastChange}
              title="Revert storefront design to previous snapshot"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.14)" : "#cbd5e1"}`,
                background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                color: tokens.textSecondary,
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
              <span>Undo ({snapshotHistory.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Input Form */}
      <div style={{ display: "flex", gap: "6px", marginTop: "4px", paddingTop: "8px", borderTop: `1px solid ${inputBorderColor}` }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={
            !canSendCopilot
              ? "Permission required to chat with Co-Pilot"
              : isPaywallLocked
              ? `Monthly limit reached. ${paywallResetDate ? `Resets on ${new Date(paywallResetDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} or upgrade plan.` : "Upgrade plan to continue."}`
              : "Ask Co-Pilot (e.g. fix footer text, show sales...)"
          }
          disabled={loading || !canSendCopilot || isPaywallLocked}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "8px",
            border: `1px solid ${inputBorderColor}`,
            background: inputBg,
            color: chatText,
            fontSize: "12px",
            outline: "none",
            opacity: canSendCopilot && !isPaywallLocked ? 1 : 0.6,
            cursor: canSendCopilot && !isPaywallLocked ? "text" : "not-allowed",
          }}
        />
        {loading ? (
          <button
            type="button"
            onClick={handleCancel}
            title="Stop AI response"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.35)" : "rgba(239, 68, 68, 0.25)"}`,
              background: isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.06)",
              color: isDark ? "#fca5a5" : "#dc2626",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "none",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? "rgba(239, 68, 68, 0.22)" : "rgba(239, 68, 68, 0.12)";
              e.currentTarget.style.borderColor = isDark ? "rgba(239, 68, 68, 0.5)" : "rgba(239, 68, 68, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.06)";
              e.currentTarget.style.borderColor = isDark ? "rgba(239, 68, 68, 0.35)" : "rgba(239, 68, 68, 0.25)";
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="4" y="4" width="16" height="16" rx="3" />
            </svg>
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || !canSendCopilot || isPaywallLocked}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: `1px solid ${
                !input.trim() || !canSendCopilot || isPaywallLocked
                  ? isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"
                  : "transparent"
              }`,
              background:
                !input.trim() || !canSendCopilot || isPaywallLocked
                  ? isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)"
                  : userBubbleBg,
              color:
                !input.trim() || !canSendCopilot || isPaywallLocked
                  ? tokens.textMuted
                  : "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: !input.trim() || !canSendCopilot || isPaywallLocked ? "not-allowed" : "pointer",
              boxShadow:
                !input.trim() || !canSendCopilot || isPaywallLocked
                  ? "none"
                  : "0 2px 8px rgba(59, 130, 246, 0.35)",
              opacity: !input.trim() || !canSendCopilot || isPaywallLocked ? 0.6 : 1,
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <span>Send</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
