import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { AccessDeniedView } from "./AccessDeniedView";
import { GlassToast } from "./GlassToast";
import { useRazorpay } from "../hooks/useRazorpay";
import { Pagination } from "./Pagination";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type WebsiteBillingSummary = {
  website_id: string;
  website_name: string;
  slug: string;
  thumbnail_url: string | null;
  current_plan: "FREE" | "STARTER" | "PRO";
  subscription_status: "ACTIVE" | "GRACE_PERIOD" | "EXPIRED" | "CANCELLED";
  billing_cycle_start_date: string;
  billing_cycle_end_date: string;
  billing_interval: string;
  is_grace_period: boolean;
  grace_period_ends_at: string | null;
  grace_days_left: number;
  active_products_count: number;
  product_limit: number | null;
  is_product_limit_pooled: boolean;
};

export type AICreditBatchItem = {
  batch_id: string;
  batch_type: string;
  source_website_id: string | null;
  allocated: number;
  remaining: number;
  cycle_start_at: string | null;
  expiry_date: string;
  status: string;
  is_free_base: boolean;
};

export type AICreditAccountSummary = {
  admin_id: string;
  total_remaining: number;
  total_monthly_allocation: number;
  batches_count: number;
  batches: AICreditBatchItem[];
  cycle_policy: string;
};

export type TimelineEvent = {
  id: string;
  event_type: string;
  previous_plan: string | null;
  new_plan: string | null;
  source: string;
  created_at: string;
  metadata: Record<string, any>;
};

export type WebsitePlanDetails = {
  website_id: string;
  website_name: string;
  admin_id: string;
  slug?: string;
  current_plan: "FREE" | "STARTER" | "PRO";
  subscription_status: string;
  billing_cycle_start_date: string;
  billing_cycle_end_date: string;
  billing_interval: string;
  monthly_fee_inr: number;
  commission_rate: number;
  commission_percentage: string;
  is_grace_period: boolean;
  grace_period_ends_at: string | null;
  grace_days_left: number;
  product_usage: {
    used: number;
    limit: number | null;
    is_pooled: boolean;
    pool_detail?: {
      total_limit: number;
      total_used: number;
      available: number;
      is_pooled: boolean;
      sibling_breakdown: Array<{
        website_id: string;
        website_name: string;
        active_products_count: number;
      }>;
    } | null;
  };
  team_usage: {
    used: number;
    limit: number;
    available: number;
  } | null;
  custom_domain: {
    enabled: boolean;
    connected_domain: string | null;
  };
  ai_credits_cycle_allocation: number;
  branding_removal_allowed: boolean;
  last_updated_at: string;
  timeline?: TimelineEvent[];
};

export type SubscriptionInvoiceItem = {
  id: string;
  invoice_number: string;
  plan: string;
  plan_name: string;
  billing_interval: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  subtotal: number;
  tax_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  payment_method: string;
  razorpay_payment_id: string;
  invoice_date: string;
  created_at: string;
  download_url: string;
};

export type WebsiteInvoicesResponse = {
  website_id: string;
  total?: number;
  total_count: number;
  total_pages?: number;
  page?: number;
  page_size?: number;
  total_invoiced: number;
  total_tax_paid: number;
  latest_invoice_date: string | null;
  invoices: SubscriptionInvoiceItem[];
};

// ---------------------------------------------------------------------------
// ICONS
// ---------------------------------------------------------------------------

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrossIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const SproutIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22v-9" />
    <path d="M12 13a5 5 0 0 1 5-5h2a5 5 0 0 1-5 5h-2z" />
    <path d="M12 17a5 5 0 0 0-5-5H5a5 5 0 0 0 5 5h2z" />
  </svg>
);

const LightningIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const CrownIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);

const InvoiceFileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const HeadsetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

const DownloadIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const MoreVerticalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ExternalLinkIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const RefreshIcon = ({ spin }: { spin?: boolean }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: spin ? "spin 1s linear infinite" : "none" }}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

// ---------------------------------------------------------------------------
// HELPER FORMATTERS
// ---------------------------------------------------------------------------

export const formatSiteName = (name: string): string => {
  if (!name) return "Store";
  const clean = name.replace(/-\d{10,}$/, "").replace(/[-_]/g, " ").trim();
  return clean ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : name;
};

const AVATAR_PALETTES = [
  { bg: "#eff6ff", color: "#2563eb" }, // Blue
  { bg: "#eef2ff", color: "#4f46e5" }, // Indigo
  { bg: "#fff1f2", color: "#e11d48" }, // Rose
  { bg: "#ecfdf5", color: "#059669" }, // Emerald
  { bg: "#faf5ff", color: "#9333ea" }, // Purple
  { bg: "#fffbeb", color: "#d97706" }, // Amber
  { bg: "#f0fdfa", color: "#0d9488" }, // Teal
  { bg: "#fdf4ff", color: "#c026d3" }, // Fuchsia
];

function getAvatarPalette(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function formatRenewalDate(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function cleanPlanDescription(planName?: string, plan?: string, interval?: string): string {
  let p = planName || plan || "Plan";
  p = p.replace(/^WebCreon\s+/i, "").replace(/\s+Plan$/i, "").trim();
  const intLabel = interval === "yearly" ? "Yearly" : interval === "3months" ? "Quarterly" : "Monthly";
  return `${p} Plan • ${intLabel}`;
}

function generateIdempotencyKey(): string {
  return "idemp_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export const AdminBillingSettings: React.FC<{ siteId?: string }> = ({ siteId }) => {
  const { siteId: paramSiteId } = useParams<{ siteId?: string }>();
  const storedActiveSiteId = typeof window !== "undefined" ? (localStorage.getItem("last_active_site_id") || sessionStorage.getItem("last_active_site_id")) : null;
  const effectiveSiteId = siteId || paramSiteId || storedActiveSiteId || null;

  const { admin, hasPermission, isOwner } = useAdminAuth();
  const canView = isOwner || hasPermission("billing:view");
  const canEdit = isOwner || hasPermission("billing:edit");
  const { openRazorpay } = useRazorpay();

  // State
  const [websites, setWebsites] = useState<WebsiteBillingSummary[]>([]);
  const [aiCredits, setAiCredits] = useState<AICreditAccountSummary | null>(null);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(effectiveSiteId || null);
  const [selectedDetails, setSelectedDetails] = useState<WebsitePlanDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [mutationLoading, setMutationLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showBatchDrawer, setShowBatchDrawer] = useState<boolean>(false); // Billing Interval Toggle for Details View: monthly, 3months, yearly
  const [billingInterval, setBillingInterval] = useState<"monthly" | "3months" | "yearly">("monthly");
  const [upgradingPlan, setUpgradingPlan] = useState<"STARTER" | "PRO" | null>(null);

  // Invoices & Payment History state
  const [invoices, setInvoices] = useState<SubscriptionInvoiceItem[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState<boolean>(false);
  const [showAllInvoices, setShowAllInvoices] = useState<boolean>(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState<string>("");
  const [invoicePage, setInvoicePage] = useState<number>(1);
  const [invoicePageSize, setInvoicePageSize] = useState<number>(10);
  const [invoiceTotalCount, setInvoiceTotalCount] = useState<number>(0);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState<number>(1);

  // Downgrade confirmation modal state
  const [downgradeModalOpen, setDowngradeModalOpen] = useState<boolean>(false);
  const [downgradeTargetPlan, setDowngradeTargetPlan] = useState<"FREE" | "STARTER">("FREE");

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [webRes, aiRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/billing/websites`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/api/billing/account/ai-credits`, { credentials: "include" }),
      ]);

      if (webRes.ok) {
        const data = await webRes.json();
        setWebsites(data.websites || []);
      }
      if (aiRes.ok) {
        const data = await aiRes.json();
        setAiCredits(data);
      }
    } catch {
      setToast({ message: "Failed to load billing information. Please check your connection.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch details for selected website
  const fetchWebsiteDetails = useCallback(async (wid: string) => {
    setDetailsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/websites/${wid}/details`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedDetails(data);
      } else {
        setToast({ message: "Could not load website plan details.", type: "error" });
      }
    } catch {
      setToast({ message: "Network error loading website plan details.", type: "error" });
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  // Fetch statutory invoices for selected website
  const fetchInvoices = useCallback(
    async (wid: string, pageNum = 1, sizeNum = 10, searchStr = "") => {
      setInvoicesLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          page_size: String(sizeNum),
        });
        if (searchStr.trim()) {
          params.append("search", searchStr.trim());
        }
        const res = await fetch(`${API_BASE_URL}/api/billing/websites/${wid}/invoices?${params.toString()}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data: WebsiteInvoicesResponse = await res.json();
          setInvoices(data.invoices || []);
          const total = data.total_count ?? data.total ?? (data.invoices?.length || 0);
          setInvoiceTotalCount(total);
          setInvoiceTotalPages(data.total_pages ?? Math.max(1, Math.ceil(total / sizeNum)));
          setInvoicePage(data.page ?? pageNum);
          setInvoicePageSize(data.page_size ?? sizeNum);
        }
      } catch (err) {
        console.error("Failed to load invoices", err);
      } finally {
        setInvoicesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (selectedWebsiteId) {
      fetchWebsiteDetails(selectedWebsiteId);
    } else {
      setSelectedDetails(null);
      setInvoices([]);
      setShowAllInvoices(false);
      setInvoiceTotalCount(0);
      setInvoiceTotalPages(1);
    }
  }, [selectedWebsiteId, fetchWebsiteDetails]);

  // Synchronize invoices fetch with selected website, pagination, and debounced search
  useEffect(() => {
    if (!selectedWebsiteId) return;
    const timer = setTimeout(() => {
      fetchInvoices(selectedWebsiteId, invoicePage, invoicePageSize, invoiceSearchQuery);
    }, invoiceSearchQuery ? 300 : 0);

    return () => clearTimeout(timer);
  }, [selectedWebsiteId, invoicePage, invoicePageSize, invoiceSearchQuery, fetchInvoices]);

  // Handle plan upgrade with Razorpay
  const handleUpgrade = async (targetPlan: "STARTER" | "PRO") => {
    if (!canEdit || !selectedWebsiteId || mutationLoading || upgradingPlan) return;
    setUpgradingPlan(targetPlan);
    setMutationLoading(true);

    try {
      const orderRes = await fetch(`${API_BASE_URL}/api/billing/websites/${selectedWebsiteId}/create-subscription-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target_plan: targetPlan, billing_interval: billingInterval }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.detail?.message || orderData.detail || "Failed to initialize subscription order.");
      }

      const { key_id, amount, currency, razorpay_order_id } = orderData;
      const isMock = razorpay_order_id.startsWith("order_sub_mock_") || razorpay_order_id.startsWith("order_mock_");

      // Function to execute the backend upgrade with payment proof
      const executeUpgrade = async (paymentDetails: {
        payment_id: string;
        payment_method?: string;
        razorpay_order_id?: string;
        razorpay_signature?: string;
      }) => {
        const idempKey = generateIdempotencyKey();
        try {
          const res = await fetch(`${API_BASE_URL}/api/billing/websites/${selectedWebsiteId}/upgrade`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": idempKey,
            },
            credentials: "include",
            body: JSON.stringify({
              target_plan: targetPlan,
              payment_id: paymentDetails.payment_id,
              payment_method: paymentDetails.payment_method,
              razorpay_order_id: paymentDetails.razorpay_order_id,
              razorpay_signature: paymentDetails.razorpay_signature,
              billing_interval: billingInterval,
            }),
          });

          const data = await res.json();
          if (res.ok) {
            setToast({
              message: `Successfully upgraded to ${targetPlan}! New subscription cycle is active.`,
              type: "success",
            });
            await Promise.all([
              fetchOverview(),
              fetchWebsiteDetails(selectedWebsiteId),
              fetchInvoices(selectedWebsiteId),
            ]);
          } else {
            setToast({
              message: data.detail?.message || data.detail || "Plan upgrade could not be completed.",
              type: "error",
            });
          }
        } catch {
          setToast({ message: "Network error during plan upgrade.", type: "error" });
        } finally {
          setUpgradingPlan(null);
          setMutationLoading(false);
        }
      };

      // Mock order fallback if testing locally without live Razorpay key
      if (isMock && (!key_id || key_id === "rzp_test_placeholder")) {
        await executeUpgrade({
          payment_id: "pay_mock_" + Math.random().toString(36).substring(2, 10),
          payment_method: "Net Banking",
          razorpay_order_id: razorpay_order_id,
          razorpay_signature: "mock_sig_" + Math.random().toString(36).substring(2, 10),
        });
        return;
      }

      let paymentHandled = false;

      try {
        await openRazorpay({
          key: key_id,
          amount: amount,
          currency: currency || "INR",
          name: "WebCreon AI",
          description: `${targetPlan} Plan Subscription (${billingInterval === "yearly" ? "1 Year" : billingInterval === "3months" ? "3 Months" : "30 days"})`,
          image: `${window.location.origin}/logo.png`,
          order_id: isMock ? undefined : razorpay_order_id,
          prefill: { email: admin?.email || "" },
          theme: {
            color: "#0f62ab", // WebCreon Primary Blue
          },
          handler: async (response: any) => {
            paymentHandled = true;
            const chosenMethod =
              response.method
                ? (response.method === "netbanking" ? (response.bank ? `Net Banking (${response.bank})` : "Net Banking")
                  : response.method === "card" ? "Credit / Debit Card"
                  : response.method === "upi" ? "UPI"
                  : response.method)
                : undefined;

            await executeUpgrade({
              payment_id: response.razorpay_payment_id,
              payment_method: chosenMethod,
              razorpay_order_id: response.razorpay_order_id || razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => {
              if (!paymentHandled) {
                setUpgradingPlan(null);
                setMutationLoading(false);
              }
            },
          },
        });
      } catch (sdkErr: any) {
        console.warn("Razorpay checkout modal failed or was dismissed:", sdkErr);
        if (isMock) {
          await executeUpgrade({
            payment_id: "pay_mock_" + Math.random().toString(36).substring(2, 10),
            razorpay_order_id: razorpay_order_id,
          });
        } else {
          setUpgradingPlan(null);
          setMutationLoading(false);
          throw new Error(sdkErr?.message || "Payment modal could not be launched. Please try again.");
        }
      }
    } catch (err: any) {
      setUpgradingPlan(null);
      setMutationLoading(false);
      setToast({ message: err.message || "An unexpected error occurred during upgrade.", type: "error" });
    }
  };

  // Handle plan downgrade
  const handleConfirmDowngrade = async () => {
    if (!canEdit || !selectedWebsiteId || mutationLoading) return;
    setMutationLoading(true);
    const idempKey = generateIdempotencyKey();

    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/websites/${selectedWebsiteId}/downgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempKey,
        },
        credentials: "include",
        body: JSON.stringify({
          target_plan: downgradeTargetPlan,
          confirmed: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setToast({
          message: `Website moved to ${downgradeTargetPlan}. Excess active products moved to Draft.`,
          type: "info",
        });
        setDowngradeModalOpen(false);
        await Promise.all([
          fetchOverview(),
          fetchWebsiteDetails(selectedWebsiteId),
          fetchInvoices(selectedWebsiteId),
        ]);
      } else {
        setToast({
          message: data.detail?.message || "Downgrade failed.",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Network error processing downgrade.", type: "error" });
    } finally {
      setMutationLoading(false);
    }
  };

  // Download Statutory GST Tax Invoice (Rule 46 compliant PDF directly to system)
  const handleDownloadInvoice = (invoiceId: string, invoiceNumber?: string) => {
    const downloadUrl = `${API_BASE_URL}/api/billing/invoices/${invoiceId}/pdf`;
    const cleanNum = (invoiceNumber || invoiceId).replace(/[\/\s]/g, "_");
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", `WebCreon_Tax_Invoice_${cleanNum}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered & sorted websites
  const filteredWebsites = useMemo(() => {
    let list = [...websites];
    list.sort(
      (a, b) =>
        new Date(b.billing_cycle_end_date || 0).getTime() -
        new Date(a.billing_cycle_end_date || 0).getTime()
    );
    return list;
  }, [websites]);

  if (!canView) {
    return (
      <AccessDeniedView
        title="Billing Restricted"
        message="You do not have permission to view workspace subscription and plans."
        requiredPermission="billing:view"
      />
    );
  }

  // AI credits & progress bar calculation (Increasing format: Used / Total)
  const aiTotal = aiCredits?.total_monthly_allocation ?? 300;
  const aiRemaining = aiCredits?.total_remaining ?? aiTotal;
  const aiUsed = Math.max(0, aiTotal - aiRemaining);
  const aiUsagePct = aiTotal > 0 ? Math.min(100, Math.max(0, Math.round((aiUsed / aiTotal) * 100))) : 0;
  const aiBarColor = aiUsagePct >= 100 ? "#ef4444" : aiUsagePct >= 90 ? "#f59e0b" : "#2563eb";
  const aiCounterTextColor = aiUsagePct >= 100 ? "#ef4444" : aiUsagePct >= 90 ? "#d97706" : "#0f172a";

  // Current website clean name and initial
  const currentSiteCleanName = selectedDetails ? formatSiteName(selectedDetails.website_name) : "";
  const currentSiteInitial = currentSiteCleanName ? currentSiteCleanName[0].toUpperCase() : "W";
  const rawSlug = selectedDetails?.slug || websites.find((w) => w.website_id === selectedWebsiteId)?.slug || (currentSiteCleanName ? currentSiteCleanName.toLowerCase().replace(/\s+/g, "") : "store");
  const currentSiteSlug = rawSlug.replace(/-\d{8,}$/, "");

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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .wc-card-hover:hover { border-color: #cbd5e1 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important; transform: translateY(-1px); }
      `}</style>

      {/* Toast Notification */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR / HEADER CARD (EXACT SHAPE & SIZE AS DOMAINS & URLS)         */}
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
            {/* Mode Pill: "Billing & Plans" (identical style as "Domains & URLs") */}
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
                Billing & Plans
              </span>
            </div>

          </div>
        </div>

      {/* ========================================================================= */}
      {/* 2. ACCOUNT AI CREDITS CARD (ALWAYS AT THE TOP)                             */}
      {/* ========================================================================= */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2563eb",
                flexShrink: 0,
                border: "1px solid #dbeafe",
              }}
            >
              <SparklesIcon />
            </div>

            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                Account AI Credits
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Shared across all websites under your account
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: aiCounterTextColor }}>
                {aiUsed.toLocaleString()} / {aiTotal.toLocaleString()}
              </span>
              <span style={{ fontSize: "12.5px", color: "#64748b", marginLeft: "6px" }}>
                credits used ({aiRemaining.toLocaleString()} left)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowBatchDrawer(!showBatchDrawer)}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#2563eb",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "7px",
                padding: "6px 12px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#dbeafe";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#eff6ff";
              }}
            >
              {showBatchDrawer ? "Hide Batches ▲" : "View Batches ▼"}
            </button>
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: "7px",
            background: "#f1f5f9",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${aiUsagePct}%`,
              height: "100%",
              background: aiBarColor,
              borderRadius: "4px",
              transition: "width 0.4s ease, background-color 0.3s ease",
            }}
          />
        </div>

          {showBatchDrawer && (() => {
            const activeBatches = (aiCredits?.batches || []).filter((b) => {
              if (!b.expiry_date) return true;
              const isExpired = new Date(b.expiry_date).getTime() <= Date.now();
              return !isExpired && (b.remaining > 0 || b.is_free_base);
            });

            return (
              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>
                  Active Credit Batches (FIFO Order):
                </div>
                {activeBatches.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {activeBatches.map((b) => (
                      <div
                        key={b.batch_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "#f8fafc",
                          padding: "8px 12px",
                          borderRadius: "7px",
                          fontSize: "12px",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>
                            {b.is_free_base ? "Base Free Batch" : `${b.batch_type.replace("PAID_", "")} Website Batch`}
                          </span>
                          <span style={{ color: "#64748b", marginLeft: "8px" }}>
                            ({b.allocated.toLocaleString()} credits)
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700, color: b.remaining === 0 ? "#ef4444" : "#2563eb" }}>
                            {b.remaining.toLocaleString()} left
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "10px" }}>
                            Expires {formatRenewalDate(b.expiry_date)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: "#64748b" }}>No active credit batches found.</div>
                )}
              </div>
            );
          })()}
        </div>

      {/* ========================================================================= */}
      {/* 3. MAIN SECTION: SITES OVERVIEW LIST OR OPENED WEBPAGE BILLING VIEW        */}
      {/* ========================================================================= */}
      {!selectedWebsiteId ? (
        <div>
          {loading ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "48px 20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              <RefreshIcon spin />
              <div style={{ marginTop: "8px" }}>Loading websites and subscriptions...</div>
            </div>
          ) : filteredWebsites.length === 0 ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "48px 20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
              No websites found matching your filters.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                gap: "14px",
                marginBottom: "16px",
              }}
            >
              {filteredWebsites.map((w) => {
                const cleanName = formatSiteName(w.website_name);
                const palette = getAvatarPalette(cleanName);
                const initial = cleanName[0].toUpperCase();

                const used = w.active_products_count || 0;
                const limit = w.current_plan === "PRO" ? null : w.current_plan === "STARTER" ? 1000 : 200;
                const isOverLimit = limit !== null && used > limit;
                const pct = limit ? Math.round((used / limit) * 100) : 0;

                return (
                  <div
                    key={w.website_id}
                    className="wc-card-hover"
                    onClick={() => setSelectedWebsiteId(w.website_id)}
                    style={{
                      background: "#ffffff",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div>
                      {/* Card Top: Avatar, Clean Store Name & Plan Badge (NO URL) */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              background: palette.bg,
                              color: palette.color,
                              fontSize: "15px",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>

                          <div
                            style={{
                              fontSize: "14.5px",
                              fontWeight: 700,
                              color: "#0f172a",
                              lineHeight: 1.2,
                            }}
                          >
                            {cleanName}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "#f1f5f9",
                            color: "#475569",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          {w.current_plan}
                        </span>
                      </div>

                      {/* Product Usage Row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          fontSize: "12px",
                          color: "#334155",
                          marginBottom: "5px",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: isOverLimit ? "#dc2626" : "#0f172a" }}>
                            {used.toLocaleString()}
                          </span>{" "}
                          / {limit ? `${limit.toLocaleString()} products` : "Unlimited products"}
                        </div>
                        <div
                          style={{
                            fontSize: "11.5px",
                            fontWeight: isOverLimit ? 700 : 500,
                            color: isOverLimit ? "#ef4444" : "#64748b",
                          }}
                        >
                          {pct}%
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div
                        style={{
                          width: "100%",
                          height: "5px",
                          background: "#f1f5f9",
                          borderRadius: "9999px",
                          overflow: "hidden",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            height: "100%",
                            background: isOverLimit ? "#ef4444" : "#10b981",
                            borderRadius: "9999px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>

                    {/* Card Bottom: Renewal Date & Arrow */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "6px",
                        borderTop: "1px solid #f8fafc",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "11.5px",
                          color: "#64748b",
                        }}
                      >
                        <CalendarIcon />
                        <span>Renewal: {formatRenewalDate(w.billing_cycle_end_date)}</span>
                      </div>

                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: "#eff6ff",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ChevronRightIcon />
                      </div>
                    </div>

                    {w.is_grace_period && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          background: "#fffbeb",
                          border: "1px solid #fef3c7",
                          color: "#b45309",
                          fontSize: "11px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontWeight: 600,
                        }}
                      >
                        <AlertTriangleIcon />
                        <span>Payment Issue • {w.grace_days_left} days left</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 4. OPENED WEBPAGE BILLING UI / INVOICES VIEW                              */
        /* ========================================================================= */
        <div>
          {showAllInvoices ? (
            /* ========================================================================= */
            /* ALL INVOICES & STATUTORY TAX BILLS SUBVIEW                                 */
            /* ========================================================================= */
            <div>
              {/* Subtle back navigation directly below navbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAllInvoices(false)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "none",
                    border: "none",
                    color: "#1e293b",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "4px 0",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#1e293b";
                  }}
                >
                  <ChevronLeftIcon />
                  <span>Back to Billing & Plans</span>
                </button>

                <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                  Store: <strong style={{ color: "#0f172a" }}>{currentSiteCleanName}</strong>
                </div>
              </div>



              {/* All Invoices Card */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  padding: "20px 24px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        background: "#eff6ff",
                        color: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <InvoiceFileIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                        All Invoices & Statutory Tax Bills
                      </div>
                    </div>
                  </div>

                  {/* Search within invoices */}
                  <div style={{ position: "relative", width: "240px", maxWidth: "100%", flexShrink: 0 }}>
                    <div
                      style={{
                        position: "absolute",
                        left: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <SearchIcon />
                    </div>
                    <input
                      type="text"
                      value={invoiceSearchQuery}
                      onChange={(e) => {
                        setInvoiceSearchQuery(e.target.value);
                        setInvoicePage(1);
                      }}
                      placeholder="Search by invoice # or plan..."
                      style={{
                        width: "100%",
                        paddingLeft: "32px",
                        paddingRight: invoiceSearchQuery ? "28px" : "10px",
                        fontSize: "12.5px",
                        height: "34px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        color: "#0f172a",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    {invoiceSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceSearchQuery("");
                          setInvoicePage(1);
                        }}
                        style={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                          padding: "2px",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <XMarkIcon />
                      </button>
                    )}
                  </div>
                </div>

                {/* Full Invoices Table */}
                {invoicesLoading ? (
                  <div style={{ textAlign: "center", padding: "36px 0", color: "#64748b", fontSize: "13px" }}>
                    <RefreshIcon spin /> Loading invoices...
                  </div>
                ) : invoices.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 0", color: "#64748b", fontSize: "13px" }}>
                    {invoiceSearchQuery ? "No invoices found matching your search." : "No billing invoices recorded yet for this website."}
                  </div>
                ) : (
                  <>
                    <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", color: "#475569", fontSize: "12px", fontWeight: 700 }}>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Invoice #</th>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Date</th>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Description</th>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Subtotal</th>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>GST (18%)</th>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Total</th>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Status</th>
                            <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right", whiteSpace: "nowrap", width: "50px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((inv) => (
                            <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "11px 14px", color: "#0f172a", fontWeight: 700, fontFamily: "monospace", fontSize: "12px", whiteSpace: "nowrap" }}>
                                {inv.invoice_number}
                              </td>
                              <td style={{ padding: "11px 14px", color: "#334155", fontWeight: 500, whiteSpace: "nowrap" }}>
                                {formatRenewalDate(inv.invoice_date)}
                              </td>
                              <td style={{ padding: "11px 14px", color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap" }}>
                                {cleanPlanDescription(inv.plan_name, inv.plan, inv.billing_interval)}
                              </td>
                              <td style={{ padding: "11px 14px", color: "#334155", fontWeight: 500, whiteSpace: "nowrap" }}>
                                ₹{inv.subtotal.toFixed(2)}
                              </td>
                              <td style={{ padding: "11px 14px", color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" }}>
                                ₹{inv.total_tax.toFixed(2)}
                              </td>
                              <td style={{ padding: "11px 14px", color: "#0f172a", fontWeight: 800, whiteSpace: "nowrap" }}>
                                ₹{inv.total_amount.toFixed(2)}
                              </td>
                              <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                                <span
                                  style={{
                                    background: "#ecfdf5",
                                    color: "#059669",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    padding: "3px 10px",
                                    borderRadius: "12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    border: "1px solid #d1fae5",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span style={{ fontSize: "7px", color: "#10b981" }}>●</span> Paid
                                </span>
                              </td>
                              <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadInvoice(inv.id, inv.invoice_number)}
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "6px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    color: "#2563eb",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    padding: 0,
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#eff6ff";
                                    e.currentTarget.style.borderColor = "#bfdbfe";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "#f8fafc";
                                    e.currentTarget.style.borderColor = "#e2e8f0";
                                  }}
                                  title={`Download Invoice ${inv.invoice_number}`}
                                >
                                  <DownloadIcon size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    <div style={{ marginTop: "16px" }}>
                      <Pagination
                        currentPage={invoicePage}
                        totalPages={invoiceTotalPages}
                        totalItems={invoiceTotalCount}
                        pageSize={invoicePageSize}
                        pageSizeOptions={[10, 20, 50, 100]}
                        showRangeText={true}
                        onPageChange={(p) => setInvoicePage(p)}
                        onPageSizeChange={(newSize) => {
                          setInvoicePageSize(newSize);
                          setInvoicePage(1);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Back button (Only shown when not pinned to an open webpage) */}
              {!effectiveSiteId && (
                <button
                  type="button"
                  onClick={() => setSelectedWebsiteId(null)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "none",
                    border: "none",
                    color: "#1e293b",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "0 0 8px 0",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#1e293b";
                  }}
                >
                  <ChevronLeftIcon /> Back to All Stores
                </button>
              )}

              {detailsLoading || !selectedDetails ? (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    padding: "32px",
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: "13px",
                  }}
                >
                  <RefreshIcon spin /> Loading website details...
                </div>
              ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* TOP STORE CARD */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  padding: "10px 16px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                {/* Left: Clean Store Name & Renewal */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#0f172a",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {currentSiteCleanName}
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    30-Day Cycle • Next renewal on {formatRenewalDate(selectedDetails.billing_cycle_end_date)}
                  </span>
                </div>

                {/* Right: Plan Pill */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "#f1f5f9",
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {selectedDetails.current_plan} PLAN
                  </span>
                </div>
              </div>

              {/* GRACE PERIOD ALERT BANNER (IF ACTIVE) */}
              {selectedDetails.is_grace_period && (
                <div
                  style={{
                    background: "#fffbeb",
                    borderRadius: "10px",
                    border: "1px solid #fde68a",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangleIcon />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#92400e" }}>
                        Payment issue detected — {selectedDetails.grace_days_left} days left in grace period
                      </div>
                      <div style={{ fontSize: "12px", color: "#b45309" }}>
                        Resolve before {formatRenewalDate(selectedDetails.grace_period_ends_at)} or website will revert to Free.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpgrade(selectedDetails.current_plan === "PRO" ? "PRO" : "STARTER")}
                    disabled={mutationLoading || upgradingPlan !== null}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "#d97706",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: (mutationLoading || upgradingPlan !== null) ? "not-allowed" : "pointer",
                    }}
                  >
                    {upgradingPlan ? "Processing..." : "Retry Payment"}
                  </button>
                </div>
              )}

              {/* SELECT SUBSCRIPTION PLAN CARD */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  padding: "16px 20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                {/* Header with Title & Monthly/3 Months/Yearly Interval Switcher */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 2px 0", color: "#0f172a" }}>
                      Select Subscription Plan
                    </h3>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                      Choose the plan that fits your business needs. You can upgrade or downgrade anytime.
                    </p>
                  </div>

                  {/* Interval Switcher */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "3px",
                      gap: "2px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setBillingInterval("monthly")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: billingInterval === "monthly" ? 700 : 500,
                        background: billingInterval === "monthly" ? "#ffffff" : "transparent",
                        color: billingInterval === "monthly" ? "#0f172a" : "#64748b",
                        boxShadow: billingInterval === "monthly" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingInterval("3months")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: billingInterval === "3months" ? 700 : 500,
                        background: billingInterval === "3months" ? "#ffffff" : "transparent",
                        color: billingInterval === "3months" ? "#0f172a" : "#64748b",
                        boxShadow: billingInterval === "3months" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      3 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingInterval("yearly")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: billingInterval === "yearly" ? 700 : 500,
                        background: billingInterval === "yearly" ? "#ffffff" : "transparent",
                        color: billingInterval === "yearly" ? "#0f172a" : "#64748b",
                        boxShadow: billingInterval === "yearly" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Yearly
                    </button>
                  </div>
                </div>

                {/* 3 PLAN COMPARISON CARDS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {/* FREE PLAN */}
                  <div
                    style={{
                      border: selectedDetails.current_plan === "FREE" ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "20px",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: selectedDetails.current_plan === "FREE" ? "0 4px 14px rgba(59,130,246,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      {/* Top icon and Current badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background: "#ecfdf5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <SproutIcon />
                        </div>
                        {selectedDetails.current_plan === "FREE" && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#2563eb",
                              background: "#eff6ff",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              letterSpacing: "0.03em",
                            }}
                          >
                            CURRENT PLAN
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 2px 0", color: "#0f172a" }}>Free</h4>
                      <div style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "14px" }}>
                        Forever free base cycle
                      </div>

                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginBottom: "18px" }}>
                        ₹0
                      </div>

                      {/* Feature checklist */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#334155" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>200 products (shared pool)</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>300 AI credits / 30 days</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>5% Platform fee</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CrossIcon /> <span style={{ color: "#64748b" }}>Custom domain</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CrossIcon /> <span style={{ color: "#64748b" }}>Team & roles</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      {selectedDetails.current_plan === "FREE" ? (
                        <button
                          disabled
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "#e8edf5",
                            color: "#475569",
                            border: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "default",
                          }}
                        >
                          Current Plan
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDowngradeTargetPlan("FREE");
                            setDowngradeModalOpen(true);
                          }}
                          disabled={mutationLoading}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "#ffffff",
                            color: "#dc2626",
                            border: "1px solid #fca5a5",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Downgrade to Free
                        </button>
                      )}
                    </div>
                  </div>

                  {/* STARTER PLAN */}
                  <div
                    style={{
                      border: selectedDetails.current_plan === "STARTER" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "20px",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: selectedDetails.current_plan === "STARTER" ? "0 4px 14px rgba(37,99,235,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      {/* Top icon and Current badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background: "#eff6ff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <LightningIcon />
                        </div>
                        {selectedDetails.current_plan === "STARTER" && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#2563eb",
                              background: "#eff6ff",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              letterSpacing: "0.03em",
                            }}
                          >
                            CURRENT PLAN
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 2px 0", color: "#0f172a" }}>Starter</h4>
                      <div style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "14px" }}>
                        Best for small businesses
                      </div>

                      <div style={{ marginBottom: "18px" }}>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                          {billingInterval === "yearly" ? "₹1,999" : billingInterval === "3months" ? "₹549" : "₹199"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                          {billingInterval === "yearly"
                            ? "₹166 / mo • billed annually"
                            : billingInterval === "3months"
                            ? "₹183 / mo • billed quarterly"
                            : "per website / 30 days"}
                        </div>
                      </div>

                      {/* Feature checklist */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#334155" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>1,000 dedicated products</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>1,000 AI credits / 30 days</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>2.5% Platform fee</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>1 custom domain</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CrossIcon /> <span style={{ color: "#64748b" }}>Team & roles</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      {selectedDetails.current_plan === "STARTER" ? (
                        <button
                          disabled
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "#e8edf5",
                            color: "#475569",
                            border: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "default",
                          }}
                        >
                          Current Plan
                        </button>
                      ) : selectedDetails.current_plan === "PRO" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDowngradeTargetPlan("STARTER");
                            setDowngradeModalOpen(true);
                          }}
                          disabled={mutationLoading}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "#ffffff",
                            color: "#dc2626",
                            border: "1px solid #fca5a5",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Downgrade to Starter
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpgrade("STARTER")}
                          disabled={mutationLoading || upgradingPlan !== null}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "#0f62ab",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: (mutationLoading || upgradingPlan !== null) ? "not-allowed" : "pointer",
                            boxShadow: "0 2px 8px rgba(15,98,171,0.25)",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!mutationLoading && !upgradingPlan) e.currentTarget.style.background = "#0b4c85";
                          }}
                          onMouseLeave={(e) => {
                            if (!mutationLoading && !upgradingPlan) e.currentTarget.style.background = "#0f62ab";
                          }}
                        >
                          {upgradingPlan === "STARTER" ? "Processing..." : "Upgrade to Starter"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PRO PLAN */}
                  <div
                    style={{
                      border: selectedDetails.current_plan === "PRO" ? "2px solid #0f62ab" : "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "20px",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: selectedDetails.current_plan === "PRO" ? "0 4px 14px rgba(15,98,171,0.08)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      {/* Top icon and Current badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background: "#fffbeb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#d97706",
                          }}
                        >
                          <CrownIcon />
                        </div>
                        {selectedDetails.current_plan === "PRO" && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#b45309",
                              background: "#fef3c7",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              letterSpacing: "0.03em",
                            }}
                          >
                            CURRENT PLAN
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 2px 0", color: "#0f172a" }}>Pro</h4>
                      <div style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "14px" }}>
                        For growing businesses
                      </div>

                      <div style={{ marginBottom: "18px" }}>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                          {billingInterval === "yearly" ? "₹4,999" : billingInterval === "3months" ? "₹1,299" : "₹499"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                          {billingInterval === "yearly"
                            ? "₹416 / mo • billed annually"
                            : billingInterval === "3months"
                            ? "₹433 / mo • billed quarterly"
                            : "per website / 30 days"}
                        </div>
                      </div>

                      {/* Feature checklist */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#334155" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>Unlimited products</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>2,000 AI credits / 30 days</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>1% Platform fee</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>1 custom domain</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <CheckIcon /> <span>Up to 10 team members</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      {selectedDetails.current_plan === "PRO" ? (
                        <button
                          disabled
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "#e8edf5",
                            color: "#475569",
                            border: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "default",
                          }}
                        >
                          Current Plan
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpgrade("PRO")}
                          disabled={mutationLoading || upgradingPlan !== null}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            background: "#091a38",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: (mutationLoading || upgradingPlan !== null) ? "not-allowed" : "pointer",
                            boxShadow: "0 2px 8px rgba(9,26,56,0.25)",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!mutationLoading && !upgradingPlan) e.currentTarget.style.background = "#0f2b5c";
                          }}
                          onMouseLeave={(e) => {
                            if (!mutationLoading && !upgradingPlan) e.currentTarget.style.background = "#091a38";
                          }}
                        >
                          {upgradingPlan === "PRO" ? "Processing..." : "Upgrade to Pro"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BILLING & PAYMENT HISTORY CARD (LAST 3 BILLS) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  padding: "24px 28px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                {/* Table Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "18px",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "#eff6ff",
                        color: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <InvoiceFileIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                        Billing & Payment History
                      </div>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>
                        View your past payments and download invoices.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAllInvoices(true)}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                    }}
                  >
                    <span>View All</span>
                    <ChevronRightIcon size={12} />
                  </button>
                </div>

                {/* History Table */}
                {invoicesLoading ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b", fontSize: "13px" }}>
                    <RefreshIcon spin /> Loading invoices...
                  </div>
                ) : invoices.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b", fontSize: "13px" }}>
                    No past bills found for this website yet.
                  </div>
                ) : (
                  <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#475569", fontSize: "12px", fontWeight: 700 }}>
                          <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Invoice #</th>
                          <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Date</th>
                          <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Description</th>
                          <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Amount</th>
                          <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Status</th>
                          <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "right", whiteSpace: "nowrap", width: "50px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 3).map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "11px 14px", color: "#0f172a", fontWeight: 700, fontFamily: "monospace", fontSize: "12px", whiteSpace: "nowrap" }}>
                              {inv.invoice_number}
                            </td>
                            <td style={{ padding: "11px 14px", color: "#334155", fontWeight: 500, whiteSpace: "nowrap" }}>
                              {formatRenewalDate(inv.invoice_date)}
                            </td>
                            <td style={{ padding: "11px 14px", color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {cleanPlanDescription(inv.plan_name, inv.plan, inv.billing_interval)}
                            </td>
                            <td style={{ padding: "11px 14px", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap" }}>
                              ₹{inv.total_amount.toFixed(2)}
                            </td>
                            <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                              <span
                                style={{
                                  background: "#ecfdf5",
                                  color: "#059669",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  padding: "3px 10px",
                                  borderRadius: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  border: "1px solid #d1fae5",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span style={{ fontSize: "7px", color: "#10b981" }}>●</span> Paid
                              </span>
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                              <button
                                type="button"
                                onClick={() => handleDownloadInvoice(inv.id, inv.invoice_number)}
                                style={{
                                  width: "30px",
                                  height: "30px",
                                  borderRadius: "6px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                  color: "#2563eb",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  padding: 0,
                                  flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#eff6ff";
                                  e.currentTarget.style.borderColor = "#bfdbfe";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#f8fafc";
                                  e.currentTarget.style.borderColor = "#e2e8f0";
                                }}
                                title={`Download Invoice ${inv.invoice_number}`}
                              >
                                <DownloadIcon size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SHARED PRODUCT POOL TABLE (FREE PLAN ONLY) */}
              {selectedDetails.current_plan === "FREE" && selectedDetails.product_usage?.pool_detail && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    padding: "20px 24px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a" }}>Shared Free Product Pool</div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>200 active products shared across all Free websites under your account</div>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#2563eb" }}>
                      {selectedDetails.product_usage.pool_detail.total_used} / 200 Products
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedDetails.product_usage.pool_detail.sibling_breakdown?.map((sibling) => (
                      <div
                        key={sibling.website_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "9px 12px",
                          background: sibling.website_id === selectedWebsiteId ? "#eff6ff" : "#f8fafc",
                          borderRadius: "8px",
                          fontSize: "12.5px",
                          border: sibling.website_id === selectedWebsiteId ? "1px solid #bfdbfe" : "none",
                        }}
                      >
                        <span style={{ fontWeight: sibling.website_id === selectedWebsiteId ? 700 : 500, color: "#0f172a" }}>
                          {formatSiteName(sibling.website_name)} {sibling.website_id === selectedWebsiteId && "(This Website)"}
                        </span>
                        <span style={{ fontWeight: 600, color: "#475569" }}>
                          {sibling.active_products_count} active products
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BOTTOM NEED HELP WITH BILLING BANNER */}
              <div
                style={{
                  background: "#f0f7ff",
                  borderRadius: "16px",
                  border: "1px solid #dbeafe",
                  padding: "18px 26px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "#dbeafe",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <HeadsetIcon />
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>
                      Need help with billing?
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      Contact our support team for any billing related queries.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "mailto:support@webcreon.com?subject=WebCreon%20Billing%20Support";
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "9px 18px",
                    color: "#1e293b",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#94a3b8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                >
                  <span>Contact Support</span>
                  <ChevronRightIcon size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )}

      {/* ========================================================================= */}
      {/* 5. DOWNGRADE CONFIRMATION MODAL                                            */}
      {/* ========================================================================= */}
      {downgradeModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "22px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#dc2626", marginBottom: "10px" }}>
              <AlertTriangleIcon />
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Confirm Plan Downgrade</h3>
            </div>
            <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.5, margin: "0 0 14px 0" }}>
              Downgrading to <strong>{downgradeTargetPlan}</strong> will immediately move excess products to <strong>Draft</strong> status with reason <code>SYSTEM_LIMIT_EXCEEDED</code>.
            </p>
            <div style={{ background: "#fef2f2", borderRadius: "6px", padding: "10px", border: "1px solid #fee2e2", fontSize: "11.5px", color: "#991b1b", marginBottom: "16px" }}>
              • Custom domain will be unlinked.<br />
              {selectedDetails?.current_plan === "PRO" && "• Team members will lose access immediately.\n"}
              • This change takes effect immediately.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setDowngradeModalOpen(false)}
                disabled={mutationLoading}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDowngrade}
                disabled={mutationLoading}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: mutationLoading ? "not-allowed" : "pointer",
                }}
              >
                {mutationLoading ? "Downgrading..." : "Confirm Downgrade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
