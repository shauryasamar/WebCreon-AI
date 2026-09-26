import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { GlassToast } from "./GlassToast";
import { AdminFaqFullView } from "./AdminFaqFullView";
import { AdminLegalFullView, LegalDocType } from "./AdminLegalFullView";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type FAQItem = {
  id: string;
  category_id: string;
  category_name: string;
  question: string;
  answer_rich_text: string;
  sort_order: number;
  is_featured_inline: boolean;
};

// ---------------------------------------------------------------------------
// ICONS
// ---------------------------------------------------------------------------

function ChevronDownIcon({ open }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        width: 17,
        height: 17,
        transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        color: "#64748b",
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 13, height: 13, marginLeft: 4 }}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, color: "#2563eb" }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function InfoCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, color: "#2563eb" }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, color: "#2563eb" }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function ChevronRightSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, color: "#94a3b8" }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, color: "#16a34a" }}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CreditCardIcon({ size = 15, color = "#2563eb" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function GlobeIcon({ size = 15, color = "#2563eb" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ShoppingBagIcon({ size = 15, color = "#2563eb" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function PackageIcon({ size = 15, color = "#2563eb" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function SparklesIcon({ size = 15, color = "#2563eb" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function SettingsCogIcon({ size = 15, color = "#2563eb" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const SUPPORT_CATEGORIES = [
  { id: "billing", label: "Billing & Plans", Icon: CreditCardIcon, desc: "Invoices, renewals, plan upgrades & refunds" },
  { id: "domain", label: "Domains & SSL", Icon: GlobeIcon, desc: "Custom domain connection, DNS & certificates" },
  { id: "products", label: "Products & Catalog", Icon: ShoppingBagIcon, desc: "Inventory, variants, pricing & CSV import" },
  { id: "orders", label: "Orders & Delivery", Icon: PackageIcon, desc: "Shiprocket logistics, tracking & fulfillment" },
  { id: "ai_copilot", label: "AI Credits & Co-Pilot", Icon: SparklesIcon, desc: "Token allocations, page layouts & copywriting" },
  { id: "other", label: "Other Technical Inquiries", Icon: SettingsCogIcon, desc: "Platform settings, webhooks & permissions" },
];

// ---------------------------------------------------------------------------
// MAIN HELP & SUPPORT COMPONENT
// ---------------------------------------------------------------------------

export const AdminHelpSupport: React.FC<{ siteId?: string; initialView?: "overview" | "faq" }> = ({ siteId, initialView }) => {
  const navigate = useNavigate();
  const { siteId: paramSiteId } = useParams<{ siteId?: string }>();
  const storedActiveSiteId = typeof window !== "undefined" ? (localStorage.getItem("last_active_site_id") || sessionStorage.getItem("last_active_site_id")) : null;
  const effectiveSiteId = siteId || paramSiteId || storedActiveSiteId || "site";

  const { admin } = useAdminAuth();

  // In-place view switching between Main Support view, Full FAQ browser, and Legal Compliance Directive
  const [viewMode, setViewMode] = useState<"overview" | "faq" | "legal">(initialView || "overview");

  // State
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [faqsLoading, setFaqsLoading] = useState<boolean>(true);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Contact Support Form State
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [clientRequestId, setClientRequestId] = useState<string>(() => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "req_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  });

  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ category?: string; subject?: string; message?: string; general?: string }>({});
  const [submittedTicket, setSubmittedTicket] = useState<{ ticket_number: string; created_at: string; estimated_sla_hours: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Custom Category Dropdown State & Click Outside Listener
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Legal Full View State
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>("privacy");

  // Restore Draft if session expired previously
  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem("draft_support_ticket");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.subject) setSubject(parsed.subject);
        if (parsed.message) setMessage(parsed.message);
        if (parsed.clientRequestId) setClientRequestId(parsed.clientRequestId);
        sessionStorage.removeItem("draft_support_ticket");
        setToast({ message: "Your support ticket draft has been restored.", type: "info" });
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Featured FAQs
  const fetchFeaturedFaqs = useCallback(async () => {
    setFaqsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/help/faqs?featured_only=true`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setFaqs(items);
        // All FAQ items start collapsed by default
      }
    } catch {
      setToast({ message: "Could not load FAQs. Please check your network.", type: "error" });
    } finally {
      setFaqsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeaturedFaqs();
  }, [fetchFeaturedFaqs]);

  // Handle FAQ Accordion Toggle
  const toggleFaq = (id: string) => {
    setExpandedFaqId((prev) => (prev === id ? null : id));
  };

  // Handle Form Submit
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { category?: string; subject?: string; message?: string } = {};

    if (!category) {
      errors.category = "Please select a category.";
    }
    if (!subject.trim() || subject.trim().length < 5) {
      errors.subject = "Subject must be at least 5 characters.";
    } else if (subject.trim().length > 255) {
      errors.subject = "Subject cannot exceed 255 characters.";
    }
    if (!message.trim() || message.trim().length < 10) {
      errors.message = "Message must be at least 10 characters.";
    } else if (message.trim().length > 5000) {
      errors.message = "Message cannot exceed 5000 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setFormLoading(true);

    const payload = {
      client_request_id: clientRequestId,
      category: category,
      subject: subject.trim(),
      message: message.trim(),
      website_id: effectiveSiteId && effectiveSiteId !== "site" ? effectiveSiteId : null,
      page_context: {
        module_key: "help-support",
        page_key: "contact-form",
        current_url: window.location.href,
        route_name: `/builder/${effectiveSiteId}/settings/help-support`,
        user_agent: navigator.userAgent,
        app_version: "1.0.0",
      },
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        sessionStorage.setItem("draft_support_ticket", JSON.stringify({ category, subject, message, clientRequestId }));
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setSubmittedTicket({
          ticket_number: data.ticket?.ticket_number || "WC-SP-TICKET",
          created_at: data.ticket?.created_at || new Date().toISOString(),
          estimated_sla_hours: data.ticket?.estimated_sla_hours || 2,
        });
        setToast({ message: data.message || "Support ticket submitted successfully!", type: "success" });
      } else {
        const errorDetail = data.detail?.message || data.detail || "Failed to submit support ticket.";
        setFormErrors({ general: typeof errorDetail === "string" ? errorDetail : "Invalid form parameters." });
        setToast({ message: "Could not submit support ticket. Please verify form details.", type: "error" });
      }
    } catch {
      setFormErrors({ general: "Network error occurred while submitting your ticket. Please try again." });
      setToast({ message: "Network connection error.", type: "error" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetForm = () => {
    setCategory("");
    setSubject("");
    setMessage("");
    setSubmittedTicket(null);
    setFormErrors({});
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      setClientRequestId(window.crypto.randomUUID());
    } else {
      setClientRequestId("req_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now());
    }
  };

  if (viewMode === "faq") {
    return (
      <AdminFaqFullView
        siteId={effectiveSiteId}
        onBack={() => setViewMode("overview")}
      />
    );
  }

  if (viewMode === "legal") {
    return (
      <AdminLegalFullView
        initialDoc={selectedLegalDoc}
        onBack={() => setViewMode("overview")}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .wc-faq-card { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .wc-faq-card:hover { border-color: #cbd5e1 !important; }
        .wc-legal-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 960px) {
          .wc-legal-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 600px) {
          .wc-legal-grid {
            grid-template-columns: 1fr;
          }
        }
        .wc-legal-card-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
          background: #fafafa;
          text-decoration: none;
          color: #1e293b;
          font-size: 12.5px;
          font-weight: 500;
          transition: all 0.15s ease;
          min-width: 0;
          box-sizing: border-box;
        }
        .wc-legal-card-item:hover {
          border-color: #cbd5e1 !important;
          background: #f1f5f9 !important;
          color: #0f172a !important;
        }
      `}</style>

      {/* Toast Notification */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR / HEADER CARD (EXACT SHAPE, SIZE & POSITION AS BILLING/DOMAINS) */}
      {/* ========================================================================= */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "8px 12px",
          marginBottom: "8px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill: "Help & Support" */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                borderRadius: "6px",
                padding: "6px 16px",
                background: "#ffffff",
                color: "#0f172a",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                fontSize: "13px",
                fontWeight: 700,
                display: "inline-block",
                userSelect: "none",
              }}
            >
              Help & Support
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. POPULAR QUESTIONS (FAQ ACCORDION SECTION)                              */}
      {/* ========================================================================= */}
      <div
        className="wc-faq-card"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "18px 22px",
          marginBottom: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            paddingBottom: "14px",
            marginBottom: "14px",
            borderBottom: "1px solid #f1f5f9",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 3px 0",
                letterSpacing: "-0.01em",
              }}
            >
              Popular Questions
            </h2>
            <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
              Find quick answers to common questions about WebCreon.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewMode("faq")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "transparent",
              border: "none",
              color: "#2563eb",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: "6px",
            }}
          >
            View all FAQs <ArrowRightIcon />
          </button>
        </div>

        {faqsLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px 0" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  height: "38px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {faqs.map((faq, index) => {
              const isOpen = expandedFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  style={{
                    borderTop: index > 0 ? "1px solid #f1f5f9" : "none",
                    paddingTop: index > 0 ? "12px" : "4px",
                    paddingBottom: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-ans-${faq.id}`}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "transparent",
                      border: "none",
                      padding: "2px 0",
                      cursor: "pointer",
                      textAlign: "left",
                      color: isOpen ? "#0f172a" : "#1e293b",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      lineHeight: "1.4",
                    }}
                  >
                    <span>{faq.question}</span>
                    <ChevronDownIcon open={isOpen} />
                  </button>

                  {isOpen && (
                    <div
                      id={`faq-ans-${faq.id}`}
                      style={{
                        marginTop: "10px",
                        padding: "10px 14px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        borderLeft: "3px solid #3b82f6",
                        fontSize: "13px",
                        lineHeight: 1.55,
                        color: "#334155",
                      }}
                    >
                      <p style={{ margin: 0 }}>{faq.answer_rich_text}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 3. CONTACT SUPPORT SECTION                                                */}
      {/* ========================================================================= */}
      <div
        className="wc-faq-card"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "24px 28px",
          marginBottom: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 6px 16px rgba(0,0,0,0.02)",
        }}
      >
        {/* Header with Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            paddingBottom: "16px",
            marginBottom: "18px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "#eff6ff",
              border: "1px solid #dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb",
              flexShrink: 0,
            }}
          >
            <MailIcon />
          </div>
          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 2px 0",
                letterSpacing: "-0.01em",
              }}
            >
              Contact Support
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Have a specific question or need help? Send us a message and our team will get back to you.
            </p>
          </div>
        </div>

        {submittedTicket ? (
          /* Sleek, Minimal, Spacious Success State */
          <div
            style={{
              padding: "28px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              minHeight: "260px",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#f0fdf4",
                border: "1px solid #dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "12px",
                color: "#16a34a",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 6px 0",
                letterSpacing: "-0.01em",
              }}
            >
              Support Ticket Submitted
            </h3>

            <p
              style={{
                fontSize: "13px",
                color: "#64748b",
                maxWidth: "460px",
                margin: "0 0 18px 0",
                lineHeight: 1.55,
              }}
            >
              We have received your message. A confirmation has been sent to{" "}
              <strong style={{ color: "#0f172a" }}>{admin?.email || "your registered email"}</strong>.
            </p>

            {/* Ticket Details Box */}
            <div
              style={{
                width: "100%",
                maxWidth: "420px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "12px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                  Ticket Reference
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                  #{submittedTicket.ticket_number}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                  Status
                </div>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb" }} />
                  Queued
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              style={{
                background: "#ffffff",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.borderColor = "#94a3b8";
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#cbd5e1";
                e.currentTarget.style.color = "#334155";
              }}
            >
              + Submit Another Inquiry
            </button>
          </div>
        ) : (
          /* Attractive, Minimal Ticket Submission Form */
          <form onSubmit={handleSubmitTicket} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {formErrors.general && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{formErrors.general}</span>
              </div>
            )}

            {/* Field 1: Theme-Aligned Custom Category Dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} ref={categoryDropdownRef}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  Category <span style={{ color: "#dc2626" }}>*</span>
                </label>
                {formErrors.category && (
                  <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 500 }}>{formErrors.category}</span>
                )}
              </div>

              <div style={{ position: "relative" }}>
                {/* Trigger Button */}
                <button
                  type="button"
                  onClick={() => !formLoading && setIsCategoryDropdownOpen((prev) => !prev)}
                  disabled={formLoading}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: formErrors.category
                      ? "1px solid #dc2626"
                      : isCategoryDropdownOpen
                      ? "1px solid #2563eb"
                      : "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "13.5px",
                    color: category ? "#0f172a" : "#94a3b8",
                    cursor: formLoading ? "not-allowed" : "pointer",
                    boxSizing: "border-box",
                    boxShadow: isCategoryDropdownOpen ? "0 0 0 3px rgba(37, 99, 235, 0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                    {category ? (
                      (() => {
                        const selectedCat = SUPPORT_CATEGORIES.find((c) => c.id === category);
                        const SelectedIcon = selectedCat?.Icon || DocumentIcon;
                        return (
                          <>
                            <div
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "6px",
                                background: "#eff6ff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <SelectedIcon size={14} color="#2563eb" />
                            </div>
                            <span style={{ fontWeight: 600, color: "#0f172a" }}>
                              {selectedCat?.label || category}
                            </span>
                          </>
                        );
                      })()
                    ) : (
                      <span>Select inquiry category...</span>
                    )}
                  </div>
                  <ChevronDownIcon open={isCategoryDropdownOpen} />
                </button>

                {/* Floating Popover Menu */}
                {isCategoryDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "6px",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    {SUPPORT_CATEGORIES.map((item) => {
                      const isSelected = category === item.id;
                      const IconComponent = item.Icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setCategory(item.id);
                            setIsCategoryDropdownOpen(false);
                            if (formErrors.category) {
                              setFormErrors((prev) => ({ ...prev, category: undefined }));
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "9px 12px",
                            borderRadius: "7px",
                            background: isSelected ? "#eff6ff" : "transparent",
                            cursor: "pointer",
                            transition: "background 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "6px",
                                background: isSelected ? "#dbeafe" : "#f1f5f9",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <IconComponent size={14} color={isSelected ? "#1d4ed8" : "#475569"} />
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: isSelected ? 600 : 500,
                                  color: isSelected ? "#1d4ed8" : "#0f172a",
                                }}
                              >
                                {item.label}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                                {item.desc}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Field 2: Subject */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  Subject <span style={{ color: "#dc2626" }}>*</span>
                </label>
                {formErrors.subject && (
                  <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 500 }}>{formErrors.subject}</span>
                )}
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={formLoading}
                placeholder="e.g. Inquiring about plan upgrade or custom domain DNS propagation"
                maxLength={255}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: formErrors.subject ? "1px solid #dc2626" : "1px solid #cbd5e1",
                  fontSize: "13.5px",
                  color: "#0f172a",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = formErrors.subject ? "#dc2626" : "#cbd5e1";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Field 3: Message */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  Message Details <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {formErrors.message && (
                    <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 500 }}>{formErrors.message}</span>
                  )}
                  <span style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                    {message.length} / 5000
                  </span>
                </div>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={formLoading}
                placeholder="Please describe your issue or question in detail. Include any relevant error messages or store URLs..."
                rows={4}
                maxLength={5000}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: formErrors.message ? "1px solid #dc2626" : "1px solid #cbd5e1",
                  fontSize: "13.5px",
                  color: "#0f172a",
                  outline: "none",
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.55,
                  minHeight: "100px",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = formErrors.message ? "#dc2626" : "#cbd5e1";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Bottom Row: Identity note & Submit Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                paddingTop: "4px",
              }}
            >
              <div style={{ fontSize: "12.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Logged in as <strong style={{ color: "#334155" }}>{admin?.email || "Admin"}</strong></span>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                style={{
                  background: formLoading ? "#94a3b8" : "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 22px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: formLoading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!formLoading) e.currentTarget.style.background = "#1e293b";
                }}
                onMouseLeave={(e) => {
                  if (!formLoading) e.currentTarget.style.background = "#0f172a";
                }}
              >
                {formLoading ? (
                  <>
                    <svg
                      style={{ animation: "spin 1s linear infinite", width: "14px", height: "14px" }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
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
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. LEGAL & COMPANY SECTION                                                */}
      {/* ========================================================================= */}
      <div
        className="wc-faq-card"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ paddingBottom: "12px", marginBottom: "14px", borderBottom: "1px solid #f1f5f9" }}>
          <h2
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#0f172a",
              margin: "0 0 2px 0",
              letterSpacing: "-0.01em",
            }}
          >
            Legal & Company
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
            Important links and company information.
          </p>
        </div>

        <div className="wc-legal-grid">
          <div
            onClick={() => {
              setSelectedLegalDoc("privacy");
              setViewMode("legal");
            }}
            className="wc-legal-card-item"
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <DocumentIcon />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Privacy Policy</span>
            </div>
            <ChevronRightSmall />
          </div>

          <div
            onClick={() => {
              setSelectedLegalDoc("terms");
              setViewMode("legal");
            }}
            className="wc-legal-card-item"
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <DocumentIcon />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Terms of Service</span>
            </div>
            <ChevronRightSmall />
          </div>

          <div
            onClick={() => {
              setSelectedLegalDoc("refund");
              setViewMode("legal");
            }}
            className="wc-legal-card-item"
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <DocumentIcon />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Refund Policy</span>
            </div>
            <ChevronRightSmall />
          </div>

          <div
            onClick={() => {
              setSelectedLegalDoc("about");
              setViewMode("legal");
            }}
            className="wc-legal-card-item"
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <InfoCircleIcon />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>About WebCreon</span>
            </div>
            <ChevronRightSmall />
          </div>

          <div
            onClick={() => {
              setSelectedLegalDoc("contact");
              setViewMode("legal");
            }}
            className="wc-legal-card-item"
            style={{ cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <MailIcon />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Contact Us</span>
            </div>
            <ChevronRightSmall />
          </div>
        </div>
      </div>
    </div>
  );
};
