import React, { useState } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminTheme } from "../context/ThemeContext";
import { AccessDeniedView } from "./AccessDeniedView";
import { GlassToast } from "./GlassToast";
import { AdminCheckbox } from "./AdminProducts";

// ==========================================
// 1. GENERAL STORE SETTINGS
// ==========================================
export const AdminGeneralSettings: React.FC<{ siteId?: string }> = ({ siteId }) => {
  const { isDark, tokens } = useAdminTheme();
  const { hasPermission, isOwner } = useAdminAuth();
  const canView = isOwner || hasPermission("general_settings:view");
  const canEdit = isOwner || hasPermission("general_settings:edit");

  const [storeName, setStoreName] = useState("WebCreon Flagship Store");
  const [tagline, setTagline] = useState("Premium online shopping experience powered by WebCreon AI");
  const [supportEmail, setSupportEmail] = useState("support@brandstore.com");
  const [supportPhone, setSupportPhone] = useState("+91 98765 43210");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [orderPrefix, setOrderPrefix] = useState("ORD-");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [autoCancelUnpaidHours, setAutoCancelUnpaidHours] = useState("24");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  if (!canView) {
    return (
      <AccessDeniedView
        title="General Settings Restricted"
        message="You do not have permission to view general store configuration."
        requiredPermission="general_settings:view"
      />
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setToast({ message: "General store settings updated successfully!", type: "success" });
    }, 600);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: `1px solid ${tokens.border}`,
    fontSize: "13px",
    boxSizing: "border-box",
    background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
    color: tokens.textPrimary,
    colorScheme: isDark ? "dark" : "light",
    outline: "none",
  };

  const optionStyle: React.CSSProperties = {
    background: isDark ? tokens.surfaceBg : "#ffffff",
    color: isDark ? tokens.textPrimary : "#0f172a",
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: "900px", margin: "0 auto", color: tokens.textPrimary }}>
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px 0", letterSpacing: "-0.01em", color: tokens.textPrimary }}>
          General Settings
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary }}>
          Configure primary storefront branding, currency, contact points, and operational modes.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Brand & Identity Card */}
        <div style={{ background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "14px", border: `1px solid ${tokens.border}`, padding: "20px 24px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 600, color: tokens.textPrimary }}>Store Identity</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "6px" }}>Store Name</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "6px" }}>Order Number Prefix</label>
              <input
                type="text"
                value={orderPrefix}
                onChange={(e) => setOrderPrefix(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "6px" }}>Store Description / Tagline</label>
              <textarea
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                disabled={!canEdit}
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        {/* Contact & Support */}
        <div style={{ background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "14px", border: `1px solid ${tokens.border}`, padding: "20px 24px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 600, color: tokens.textPrimary }}>Contact & Support</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "6px" }}>Customer Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "6px" }}>Support Phone / Helpline</label>
              <input
                type="tel"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Standards & Formats */}
        <div style={{ background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "14px", border: `1px solid ${tokens.border}`, padding: "20px 24px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 600, color: tokens.textPrimary }}>Regional & Currency</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "6px" }}>Storefront Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              >
                <option value="INR" style={optionStyle}>INR (₹) — Indian Rupee</option>
                <option value="USD" style={optionStyle}>USD ($) — US Dollar</option>
                <option value="EUR" style={optionStyle}>EUR (€) — Euro</option>
                <option value="GBP" style={optionStyle}>GBP (£) — British Pound</option>
                <option value="AED" style={optionStyle}>AED (د.إ) — UAE Dirham</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "6px" }}>Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              >
                <option value="Asia/Kolkata" style={optionStyle}>Asia/Kolkata (IST +5:30)</option>
                <option value="UTC" style={optionStyle}>UTC (GMT +0:00)</option>
                <option value="America/New_York" style={optionStyle}>America/New_York (EST -5:00)</option>
                <option value="Europe/London" style={optionStyle}>Europe/London (BST +1:00)</option>
                <option value="Asia/Dubai" style={optionStyle}>Asia/Dubai (GST +4:00)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Operational Status */}
        <div style={{ background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "14px", border: `1px solid ${tokens.border}`, padding: "20px 24px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: 600, color: tokens.textPrimary }}>Store Operations</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${tokens.border}` }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: tokens.textPrimary }}>Maintenance Mode</div>
              <div style={{ fontSize: "12px", color: tokens.textSecondary }}>Temporarily show a "We'll be back soon" banner to buyers while you make changes.</div>
            </div>
            <AdminCheckbox
              checked={maintenanceMode}
              onChange={(e) => canEdit && setMaintenanceMode(e.target.checked)}
              disabled={!canEdit}
              ariaLabel="Toggle maintenance mode"
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: tokens.textPrimary }}>Auto-Cancel Pending Orders</div>
              <div style={{ fontSize: "12px", color: tokens.textSecondary }}>Automatically cancel unpaid checkout orders after a set time period.</div>
            </div>
            <select
              value={autoCancelUnpaidHours}
              onChange={(e) => setAutoCancelUnpaidHours(e.target.value)}
              disabled={!canEdit}
              style={{ padding: "6px 10px", borderRadius: "6px", border: `1px solid ${tokens.border}`, fontSize: "12px", background: isDark ? tokens.elevatedSurfaceBg : "#ffffff", color: tokens.textPrimary, colorScheme: isDark ? "dark" : "light", outline: "none" }}
            >
              <option value="12" style={optionStyle}>After 12 Hours</option>
              <option value="24" style={optionStyle}>After 24 Hours</option>
              <option value="48" style={optionStyle}>After 48 Hours</option>
              <option value="never" style={optionStyle}>Never Cancel</option>
            </select>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={!canEdit || saving}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              background: !canEdit ? tokens.textMuted : (tokens.accent || "#2563eb"),
              color: "#ffffff",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: !canEdit || saving ? "not-allowed" : "pointer",
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            }}
          >
            {saving ? "Saving..." : !canEdit ? "View-Only" : "Save General Settings"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ==========================================
// 2. DOMAIN & URLS SETTINGS
// ==========================================
export { AdminDomainSettings } from "./AdminDomainSettings";

// ==========================================
// 3. BILLING & PLANS SETTINGS
// ==========================================
export { AdminBillingSettings } from "./AdminBillingSettings";

// ==========================================
// 4. INTEGRATIONS SETTINGS
// ==========================================
export const AdminIntegrationsSettings: React.FC<{ siteId?: string }> = ({ siteId }) => {
  const { isDark, tokens } = useAdminTheme();
  const { hasPermission, isOwner } = useAdminAuth();
  const canView = isOwner || hasPermission("integrations:view");
  const canEdit = isOwner || hasPermission("integrations:edit");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const [integrations, setIntegrations] = useState([
    { id: "whatsapp", name: "WhatsApp Business Notifications", icon: "💬", desc: "Automate order confirmations and delivery updates via official WhatsApp Cloud API.", enabled: true },
    { id: "razorpay", name: "Razorpay Payments", icon: "💳", desc: "Accept UPI, Cards, Netbanking, and PayLater with automated reconciliation.", enabled: true },
    { id: "stripe", name: "Stripe Global Gateway", icon: "🌍", desc: "Process international credit and debit cards across 135+ currencies.", enabled: false },
    { id: "mailchimp", name: "Mailchimp Marketing", icon: "✉️", desc: "Sync customers and newsletter subscribers for abandoned cart recovery campaigns.", enabled: false },
    { id: "analytics", name: "Google Analytics 4 & Tag Manager", icon: "📊", desc: "Track conversions, e-commerce funnel drop-offs, and store user behavior.", enabled: true },
  ]);

  if (!canView) {
    return (
      <AccessDeniedView
        title="Integrations Restricted"
        message="You do not have permission to view or configure third-party store integrations."
        requiredPermission="integrations:view"
      />
    );
  }

  const toggleIntegration = (id: string) => {
    if (!canEdit) {
      setToast({ message: "You need 'integrations:edit' permission to modify integrations.", type: "error" });
      return;
    }
    setIntegrations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
    setToast({ message: "Integration status updated.", type: "success" });
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: "900px", margin: "0 auto", color: tokens.textPrimary }}>
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px 0", letterSpacing: "-0.01em", color: tokens.textPrimary }}>
          Integrations & Apps
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary }}>
          Connect WhatsApp, payment gateways, marketing tools, and analytics directly to your storefront.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {integrations.map((item) => (
          <div
            key={item.id}
            style={{
              background: isDark ? tokens.surfaceBg : "#ffffff",
              borderRadius: "14px",
              border: `1px solid ${tokens.border}`,
              padding: "18px 22px",
              boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: isDark ? tokens.elevatedSurfaceBg : "#f8fafc", border: `1px solid ${tokens.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: tokens.textPrimary }}>{item.name}</div>
                <div style={{ fontSize: "12px", color: tokens.textSecondary, marginTop: "2px", maxWidth: "560px" }}>{item.desc}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: item.enabled ? (isDark ? "#4ade80" : "#059669") : tokens.textSecondary }}>
                {item.enabled ? "Connected" : "Disabled"}
              </span>
              <button
                type="button"
                onClick={() => toggleIntegration(item.id)}
                disabled={!canEdit}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
                  background: item.enabled ? (isDark ? tokens.elevatedSurfaceBg : "#f1f5f9") : (tokens.accent || "#2563eb"),
                  color: item.enabled ? tokens.textPrimary : "#ffffff",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: !canEdit ? "not-allowed" : "pointer",
                }}
              >
                {item.enabled ? "Configure" : "Connect"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 5. HELP & SUPPORT VIEW
// ==========================================
export const AdminHelpAndSupport: React.FC<{ siteId?: string }> = ({ siteId }) => {
  const { isDark, tokens } = useAdminTheme();
  const { admin, isOwner } = useAdminAuth();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Search & Filter State for Knowledge Base
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Ticket Modal State
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("technical");
  const [ticketPriority, setTicketPriority] = useState("normal");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  // Active tickets history
  const [recentTickets, setRecentTickets] = useState<Array<{
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    date: string;
  }>>([
    {
      id: "TKT-9204",
      subject: "Custom SSL Certificate Auto-Renewal Verification",
      category: "Domain Setup",
      priority: "Normal",
      status: "Resolved",
      date: "2 days ago",
    },
  ]);

  const copySupportEmail = () => {
    navigator.clipboard.writeText("support@webcreon.ai");
    setToast({ message: "Support email copied to clipboard: support@webcreon.ai", type: "success" });
  };

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim()) {
      setToast({ message: "Please provide a subject for your ticket", type: "error" });
      return;
    }
    if (!ticketMessage.trim()) {
      setToast({ message: "Please enter a detailed description", type: "error" });
      return;
    }

    setTicketSubmitting(true);
    setTimeout(() => {
      const newTicketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      const catLabel =
        ticketCategory === "technical"
          ? "Technical Issue"
          : ticketCategory === "domain"
          ? "Custom Domain"
          : ticketCategory === "billing"
          ? "Billing & Payouts"
          : "General Inquiry";

      setRecentTickets((prev) => [
        {
          id: newTicketId,
          subject: ticketSubject.trim(),
          category: catLabel,
          priority: ticketPriority.charAt(0).toUpperCase() + ticketPriority.slice(1),
          status: "Under Review",
          date: "Just now",
        },
        ...prev,
      ]);

      setTicketSubmitting(false);
      setShowTicketModal(false);
      setTicketSubject("");
      setTicketMessage("");
      setToast({
        message: `Ticket ${newTicketId} created! Our engineering team will review it shortly.`,
        type: "success",
      });
    }, 650);
  };

  const guides = [
    {
      id: "store-setup",
      category: "storefront",
      icon: "🎨",
      title: "Storefront Design & Publishing",
      desc: "Customize colors, typography, layout blocks, and push updates live with instant previewing.",
      readTime: "3 min read",
    },
    {
      id: "domains-dns",
      category: "domains",
      icon: "🌐",
      title: "Custom Domain & DNS Setup",
      desc: "Step-by-step guide to pointing CNAME / A records to WebCreon edge servers with auto SSL.",
      readTime: "4 min read",
    },
    {
      id: "payments-payouts",
      category: "payments",
      icon: "💳",
      title: "Payment Gateways & Settlements",
      desc: "Connect Razorpay UPI & Cards, set up escrow holds, and configure automated bank payouts.",
      readTime: "5 min read",
    },
    {
      id: "users-roles",
      category: "roles",
      icon: "👥",
      title: "Team Members & Access Control",
      desc: "Invite store managers, support agents, and restrict storefront or module-specific access.",
      readTime: "4 min read",
    },
    {
      id: "order-delivery",
      category: "storefront",
      icon: "📦",
      title: "Order Fulfillment & Agent PWA",
      desc: "Dispatch orders, enable live customer map tracking, and manage delivery agent handoffs.",
      readTime: "5 min read",
    },
    {
      id: "copilot-usage",
      category: "storefront",
      icon: "🤖",
      title: "Using WebCreon AI Co-Pilot",
      desc: "Prompt the builder assistant to regenerate sections, create sales banners, or audit SEO.",
      readTime: "2 min read",
    },
  ];

  const faqs = [
    {
      q: "How do I link my custom domain to my storefront?",
      a: "Navigate to Settings → Domain & URLs in the builder drawer. Enter your apex or subdomain (e.g. store.yourbrand.com) and copy the provided DNS records into your registrar (GoDaddy, Cloudflare, Namecheap). SSL is provisioned automatically within 10-15 minutes.",
    },
    {
      q: "Why do team members only see specific websites?",
      a: "When inviting a team member under Users & Roles, the Workspace Owner can grant either 'All Websites' access or assign specific storefronts. Members assigned to specific stores will only see and manage those storefronts upon login.",
    },
    {
      q: "How are customer payments and merchant payouts processed?",
      a: "WebCreon routes online transactions through your connected payment gateway (e.g. Razorpay). Payouts are reconciled via the Earnings & Ledger module, holding balances during the return window before automatic settlement into your registered tenant bank account.",
    },
    {
      q: "Can I manage multiple storefronts from a single account?",
      a: "Yes! Workspace Owners can create and switch between unlimited storefronts using the 'Saved Sites' drawer. Your team members, custom roles, and billing subscription remain unified across your entire workspace.",
    },
    {
      q: "What is the average response time for support inquiries?",
      a: "Our merchant engineering team monitors tickets 24/7. High and Urgent priority tickets for live storefronts are typically addressed within 15 minutes, while standard inquiries are answered within 2 hours.",
    },
  ];

  const filteredGuides = guides.filter((g) => {
    const matchesCat = selectedCategory === "all" || g.category === selectedCategory;
    const matchesQuery =
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div style={{ padding: "24px 28px", maxWidth: "1000px", margin: "0 auto", color: tokens.textPrimary, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "16px", background: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe"}`, color: isDark ? "#93c5fd" : "#2563eb", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: tokens.accent || "#2563eb" }} />
            WebCreon Merchant Help Center
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px 0", letterSpacing: "-0.015em", color: tokens.textPrimary }}>
            Help & Support
          </h1>
          <p style={{ margin: 0, fontSize: "13.5px", color: tokens.textSecondary }}>
            Get instant assistance, explore guides & documentation, or contact our dedicated support engineers.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={copySupportEmail}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "36px",
              padding: "0 14px",
              borderRadius: "8px",
              border: `1px solid ${tokens.border}`,
              background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
              color: tokens.textPrimary,
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>support@webcreon.ai</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTicketModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "36px",
              padding: "0 16px",
              borderRadius: "8px",
              border: "none",
              background: tokens.accent || "#2563eb",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* TOP THREE HIGHLIGHT CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {/* Card 1: 24/7 Dedicated Support */}
        <div style={{ background: isDark ? tokens.surfaceBg : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", borderRadius: "14px", border: `1px solid ${tokens.border}`, padding: "20px 22px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "10px", background: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe"}`, display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#93c5fd" : "#2563eb", fontSize: "18px" }}>
              🎧
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(34, 197, 94, 0.15)" : "#dcfce7", color: isDark ? "#4ade80" : "#166534" }}>
              24/7 Active
            </span>
          </div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700, color: tokens.textPrimary }}>
            Dedicated Engineering Desk
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12.5px", color: tokens.textSecondary, lineHeight: 1.45 }}>
            Direct access to WebCreon systems engineers for custom domain issues, API errors, and order inquiries.
          </p>
          <div style={{ fontSize: "12px", color: tokens.textPrimary, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <span>⚡ Avg response time:</span>
            <span style={{ color: isDark ? "#4ade80" : "#16a34a" }}>&lt; 15 minutes</span>
          </div>
        </div>

        {/* Card 2: AI Co-Pilot Assistant */}
        <div style={{ background: isDark ? "rgba(168, 85, 247, 0.08)" : "linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)", borderRadius: "14px", border: isDark ? "1px solid rgba(168, 85, 247, 0.2)" : "1px solid #f3e8ff", padding: "20px 22px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "10px", background: isDark ? "rgba(168, 85, 247, 0.2)" : "#f5f3ff", border: `1px solid ${isDark ? "rgba(168, 85, 247, 0.35)" : "#ddd6fe"}`, display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#c084fc" : "#7c3aed", fontSize: "18px" }}>
              ✨
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(168, 85, 247, 0.2)" : "#f3e8ff", color: isDark ? "#c084fc" : "#6b21a8" }}>
              In-Builder AI
            </span>
          </div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700, color: tokens.textPrimary }}>
            WebCreon AI Co-Pilot
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12.5px", color: tokens.textSecondary, lineHeight: 1.45 }}>
            Ask questions, debug storefront styles, or auto-generate marketing sections using the drawer co-pilot chat.
          </p>
          <div style={{ fontSize: "12px", color: isDark ? "#c084fc" : "#7c3aed", fontWeight: 600 }}>
            Open from the left sidebar anytime
          </div>
        </div>

        {/* Card 3: Platform Health */}
        <div style={{ background: isDark ? "rgba(34, 197, 94, 0.08)" : "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)", borderRadius: "14px", border: isDark ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid #dcfce7", padding: "20px 22px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "10px", background: isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7", border: `1px solid ${isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0"}`, display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#4ade80" : "#15803d", fontSize: "18px" }}>
              🟢
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: isDark ? "rgba(34, 197, 94, 0.15)" : "#dcfce7", color: isDark ? "#4ade80" : "#166534" }}>
              99.98% Uptime
            </span>
          </div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700, color: tokens.textPrimary }}>
            All Systems Operational
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12.5px", color: tokens.textSecondary, lineHeight: 1.45 }}>
            Global edge CDN, automated checkout payments, and real-time database sync are functioning smoothly.
          </p>
          <div style={{ fontSize: "12px", color: isDark ? "#4ade80" : "#15803d", fontWeight: 600 }}>
            No active incidents reported
          </div>
        </div>
      </div>

      {/* RECENT TICKETS SECTION */}
      {recentTickets.length > 0 && (
        <div style={{ background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "14px", border: `1px solid ${tokens.border}`, padding: "20px 24px", marginBottom: "32px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: tokens.textPrimary }}>
              Your Support Requests
            </h3>
            <button
              type="button"
              onClick={() => setShowTicketModal(true)}
              style={{ background: "none", border: "none", color: tokens.accent || "#2563eb", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
            >
              + Submit New Request
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.border}`, textAlign: "left", color: tokens.textSecondary }}>
                  <th style={{ padding: "10px 12px" }}>Ticket ID</th>
                  <th style={{ padding: "10px 12px" }}>Subject</th>
                  <th style={{ padding: "10px 12px" }}>Category</th>
                  <th style={{ padding: "10px 12px" }}>Priority</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.map((t) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${tokens.border}` }}>
                    <td style={{ padding: "12px", fontWeight: 700, color: isDark ? "#60a5fa" : "#2563eb" }}>{t.id}</td>
                    <td style={{ padding: "12px", fontWeight: 600, color: tokens.textPrimary }}>{t.subject}</td>
                    <td style={{ padding: "12px", color: tokens.textSecondary }}>{t.category}</td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "6px",
                          background: t.priority === "Urgent" ? (isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2") : t.priority === "High" ? (isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb") : (isDark ? tokens.elevatedSurfaceBg : "#f1f5f9"),
                          color: t.priority === "Urgent" ? (isDark ? "#fca5a5" : "#dc2626") : t.priority === "High" ? (isDark ? "#fcd34d" : "#d97706") : tokens.textSecondary,
                          border: `1px solid ${t.priority === "Urgent" ? (isDark ? "rgba(239, 68, 68, 0.35)" : "#fecaca") : t.priority === "High" ? (isDark ? "rgba(245, 158, 11, 0.35)" : "#fde68a") : tokens.border}`,
                        }}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: t.status === "Resolved" ? (isDark ? "rgba(34, 197, 94, 0.15)" : "#dcfce7") : (isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff"),
                          color: t.status === "Resolved" ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#93c5fd" : "#2563eb"),
                          border: `1px solid ${t.status === "Resolved" ? (isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0") : (isDark ? "rgba(59, 130, 246, 0.35)" : "#bfdbfe")}`,
                        }}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: tokens.textSecondary, fontSize: "12px" }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KNOWLEDGE BASE & DOCUMENTATION GUIDES */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700, color: tokens.textPrimary }}>
              Merchant Guides & Documentation
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: tokens.textSecondary }}>
              Learn best practices for configuring your storefront, payments, and team access.
            </p>
          </div>

          {/* Search Input */}
          <div style={{ width: "240px", position: "relative" }}>
            <input
              type="text"
              placeholder="Search guides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                height: "34px",
                padding: "0 10px 0 30px",
                borderRadius: "8px",
                border: `1px solid ${tokens.border}`,
                fontSize: "12.5px",
                outline: "none",
                boxSizing: "border-box",
                background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                color: tokens.textPrimary,
                colorScheme: isDark ? "dark" : "light",
              }}
            />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.textMuted}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 14, height: 14, position: "absolute", left: 10, top: 10 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>

        {/* Category Filters */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          {[
            { id: "all", label: "All Topics" },
            { id: "storefront", label: "Storefront Design" },
            { id: "domains", label: "Domains & SSL" },
            { id: "payments", label: "Payments & Payouts" },
            { id: "roles", label: "Users & Roles" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: "5px 12px",
                borderRadius: "16px",
                border: `1px solid ${selectedCategory === cat.id ? (isDark ? "rgba(59, 130, 246, 0.4)" : "#2563eb") : tokens.border}`,
                background: selectedCategory === cat.id ? (isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff") : (isDark ? tokens.elevatedSurfaceBg : "#ffffff"),
                color: selectedCategory === cat.id ? (isDark ? "#93c5fd" : "#1d4ed8") : tokens.textSecondary,
                fontSize: "12px",
                fontWeight: selectedCategory === cat.id ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Guides Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "14px" }}>
          {filteredGuides.map((guide) => (
            <div
              key={guide.id}
              style={{
                background: isDark ? tokens.surfaceBg : "#ffffff",
                borderRadius: "12px",
                border: `1px solid ${tokens.border}`,
                padding: "16px 18px",
                boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.02)",
                cursor: "pointer",
              }}
              onClick={() => setToast({ message: `Opening guide: ${guide.title}`, type: "info" })}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "20px" }}>{guide.icon}</span>
                <span style={{ fontSize: "11px", color: tokens.textMuted, fontWeight: 500 }}>{guide.readTime}</span>
              </div>
              <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 600, color: tokens.textPrimary }}>
                {guide.title}
              </h4>
              <p style={{ margin: 0, fontSize: "12.5px", color: tokens.textSecondary, lineHeight: 1.45 }}>
                {guide.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* INTERACTIVE FAQ ACCORDION */}
      <div style={{ background: isDark ? tokens.surfaceBg : "#ffffff", borderRadius: "14px", border: `1px solid ${tokens.border}`, padding: "24px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "32px" }}>
        <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700, color: tokens.textPrimary }}>
          Frequently Asked Questions
        </h3>
        <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: tokens.textSecondary }}>
          Instant answers to common merchant questions regarding domains, payouts, and team roles.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                style={{
                  borderRadius: "10px",
                  border: `1px solid ${isOpen ? (isDark ? "rgba(59, 130, 246, 0.4)" : "#bfdbfe") : tokens.border}`,
                  background: isOpen ? (isDark ? "rgba(59, 130, 246, 0.08)" : "#f8faff") : (isDark ? tokens.elevatedSurfaceBg : "#f8fafc"),
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    color: isOpen ? (isDark ? "#93c5fd" : "#1d4ed8") : tokens.textPrimary,
                  }}
                >
                  <span>{faq.q}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      width: 15,
                      height: 15,
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      color: isOpen ? (tokens.accent || "#2563eb") : tokens.textSecondary,
                      flexShrink: 0,
                      marginLeft: 12,
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isOpen && (
                  <div style={{ padding: "0 16px 14px 16px", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.55 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE TICKET MODAL */}
      {showTicketModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: isDark ? "rgba(0, 0, 0, 0.75)" : "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "16px",
          }}
          onClick={() => setShowTicketModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "520px",
              background: isDark ? tokens.surfaceBg : "#ffffff",
              borderRadius: "16px",
              border: `1px solid ${tokens.border}`,
              padding: "24px 28px",
              boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.6)" : "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: tokens.textPrimary }}>
                Submit Support Ticket
              </h3>
              <button
                type="button"
                onClick={() => setShowTicketModal(false)}
                style={{ background: "none", border: "none", color: tokens.textMuted, cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTicketSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "5px" }}>
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g., CNAME record verification issue"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${tokens.border}`,
                    fontSize: "13px",
                    boxSizing: "border-box",
                    background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                    color: tokens.textPrimary,
                    colorScheme: isDark ? "dark" : "light",
                    outline: "none",
                  }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "5px" }}>
                    Category
                  </label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: `1px solid ${tokens.border}`,
                      fontSize: "13px",
                      background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                      color: tokens.textPrimary,
                      colorScheme: isDark ? "dark" : "light",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="technical" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>Technical Issue</option>
                    <option value="domain" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>Custom Domain & DNS</option>
                    <option value="billing" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>Billing & Payouts</option>
                    <option value="general" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>General Question</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "5px" }}>
                    Priority
                  </label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: `1px solid ${tokens.border}`,
                      fontSize: "13px",
                      background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                      color: tokens.textPrimary,
                      colorScheme: isDark ? "dark" : "light",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="normal" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>Normal</option>
                    <option value="high" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>High</option>
                    <option value="urgent" style={{ background: isDark ? tokens.surfaceBg : "#ffffff", color: isDark ? tokens.textPrimary : "#0f172a" }}>Urgent (Live Store)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: tokens.textSecondary, marginBottom: "5px" }}>
                  Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe your issue or request in detail..."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${tokens.border}`,
                    fontSize: "13px",
                    boxSizing: "border-box",
                    resize: "vertical",
                    background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                    color: tokens.textPrimary,
                    colorScheme: isDark ? "dark" : "light",
                    outline: "none",
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: `1px solid ${tokens.border}`,
                    background: isDark ? tokens.elevatedSurfaceBg : "#ffffff",
                    color: tokens.textPrimary,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ticketSubmitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: tokens.accent || "#2563eb",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: ticketSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {ticketSubmitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 6. STATUTORY TAX & WITHHOLDING SETTINGS
// ==========================================
import { AdminTaxComplianceDesk } from "./AdminTaxComplianceDesk";

export const AdminTaxSettings: React.FC<{ siteId?: string }> = ({ siteId }) => {
  return <AdminTaxComplianceDesk siteId={siteId} />;
};
