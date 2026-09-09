import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { MarkdownContent } from "../utils/markdownRenderer";
import { useAdminAuth } from "../context/AdminAuthContext";
import AccessDeniedView from "./AccessDeniedView";

export type StorePage = {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  content: string;
  page_type: string;
  is_published: boolean;
  is_default: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  contact_hours?: string | null;
  created_at: string;
  updated_at: string;
};

// Markdown Templates
const PREBUILT_TEMPLATES: Record<string, { title: string; subtitle: string; page_type: string; content: string }> = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "How we collect, protect, and respect your personal information.",
    page_type: "policy",
    content: `# Privacy Policy

*Last updated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*

We value your trust and are committed to safeguarding your personal data when you shop with us.

---

### 1. Information We Collect
When you interact with our storefront or place an order, we may collect:
- **Contact Details**: Name, email address, phone number, shipping address.
- **Order History**: Purchased items, billing records, and delivery preferences.
- **Device & Usage**: Browser type, IP address, and cookie tokens for cart persistence.

### 2. How We Use Information
- Fulfilling orders and providing real-time shipment tracking.
- Communicating order confirmations, invoice receipts, and delivery updates.
- Detecting, investigating, and preventing fraudulent transactions.

### 3. Payment Security
We never store complete credit or debit card numbers on our servers. All transactions are securely tokenized and processed via certified PCI-DSS compliant payment gateways.

### 4. Your Rights
You may request access to, correction of, or deletion of your personal data at any time by contacting our support team.
`,
  },
  terms: {
    title: "Terms of Service",
    subtitle: "Terms and conditions governing purchases and storefront usage.",
    page_type: "terms",
    content: `# Terms of Service

*Effective Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}*

Please read these Terms of Service carefully before purchasing products through our storefront.

---

### 1. Orders and Fulfillment
By completing an order, you agree that all provided details are true, current, and complete. We reserve the right to cancel or limit orders if unauthorized or fraudulent activity is suspected.

### 2. Pricing & Product Accuracy
We strive to present product descriptions, imagery, and pricing with the highest accuracy. Minor variations in monitor display color or packaging updates may occur.

### 3. Shipping & Delivery
Orders are dispatched in accordance with the delivery options selected during checkout. Estimated transit dates are provided by third-party logistics partners.

### 4. Returns & Customer Satisfaction
Eligible items may be returned within our stated return window provided they are unused, in original packaging, and with tags attached.
`,
  },
  faq: {
    title: "Frequently Asked Questions (FAQ)",
    subtitle: "Quick answers to common questions about orders, shipping, and returns.",
    page_type: "custom",
    content: `# Frequently Asked Questions

Find quick answers to the most common questions from our community below.

---

### Orders & Checkout
- **How do I place an order?**
  Simply browse our collections, select your desired items, and proceed to our secure one-step checkout.
- **Can I modify my order after placing it?**
  Orders are processed promptly. If you need to make urgent changes, please reach out via our **Contact Us** page within 1 hour of placing your order.

---

### Shipping & Tracking
- **How long does standard delivery take?**
  Most orders are processed within 24-48 business hours. Domestic shipping typically takes 2 to 5 business days.
- **How can I track my order?**
  As soon as your package is dispatched, we provide a live tracking link via email and on your **My Orders** portal.

---

### Returns & Exchanges
- **What is your return policy?**
  We offer a hassle-free return window on all eligible items. Items must be in their original, unwashed condition.
- **When will I receive my refund?**
  Once the returned parcel is received and inspected at our fulfillment hub, refunds are credited within 3 to 7 business days.
`,
  },
  shipping: {
    title: "Shipping & Delivery Policy",
    subtitle: "Everything you need to know about dispatch times, delivery zones, and tracking.",
    page_type: "custom",
    content: `# Shipping & Delivery Policy

We strive to ensure your favorite products arrive quickly, securely, and in pristine condition.

---

### Order Processing Times
- Orders placed before 2:00 PM are packaged and dispatched on the same or next business day.
- Weekend or holiday orders are dispatched on the subsequent business day.

### Shipping Options & Rates
| Method | Estimated Transit Time | Cost |
| Standard Delivery | 3 – 5 Business Days | Free on orders over $50 |
| Express Courier | 1 – 2 Business Days | Calculated at checkout |

---

### Shipment Tracking
Every dispatched shipment receives an authentic tracking number and live status updates. You can track your package anytime directly from your order confirmation link or account history.

### Damaged or Missing Parcels
If your package arrives damaged or appears lost in transit, please notify our support team within 48 hours with your order ID and photographic evidence so we can issue an immediate replacement.
`,
  },
  story: {
    title: "Our Story",
    subtitle: "The passion, inspiration, and people behind our brand.",
    page_type: "story",
    content: `# The Story Behind Our Brand

Every brand starts with a vision. For us, it was the belief that everyday essentials should be thoughtfully designed, ethically crafted, and built to last.

---

### How We Started
Frustrated by mass-produced compromises and inflated markups, our founders set out to create a collection that celebrates clean aesthetics, superior materials, and honest craftsmanship.

### What We Stand For
- **Intentional Design**: Products that look beautiful and work seamlessly in your daily routine.
- **Sustainable Choices**: Thoughtful sourcing, reduced packaging waste, and ethical manufacturing partners.
- **Customer Community**: We measure our success by the joy and confidence our products bring to your home.

---

> "Craftsmanship is the intersection of discipline and imagination."

Thank you for being part of our journey!
`,
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SearchIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XMarkIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const plainCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  color: "#0f172a",
  outline: "none",
  background: "#ffffff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "4px",
};

export interface AdminPagesProps {
  siteId?: string;
  siteSlug?: string;
}

const AdminPages: React.FC<AdminPagesProps> = ({ siteId: propSiteId, siteSlug: propSiteSlug }) => {
  const { hasPermission, isOwner } = useAdminAuth();
  const canViewPages = isOwner || hasPermission("pages:view");
  const canCreatePages = isOwner || hasPermission("pages:create");
  const canEditPages = isOwner || hasPermission("pages:edit");
  const canDeletePages = isOwner || hasPermission("pages:delete");
  const canPublishPages = isOwner || hasPermission("pages:publish");

  const params = useParams<{ siteId?: string; slug?: string }>();
  const [siteId, setSiteId] = useState<string>(() => {
    if (propSiteId) return propSiteId;
    if (params.siteId) return params.siteId;
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(/\/builder\/([^/]+)/);
      if (match && match[1]) return match[1];
    }
    return "";
  });

  const [siteSlug, setSiteSlug] = useState<string>(() => {
    if (propSiteSlug) return propSiteSlug;
    if (params.slug) return params.slug;
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(/\/store\/([^/]+)/);
      if (match && match[1]) return match[1];
    }
    return "";
  });

  useEffect(() => {
    if (propSiteId && propSiteId !== siteId) {
      setSiteId(propSiteId);
    }
  }, [propSiteId]);

  useEffect(() => {
    if (propSiteSlug && propSiteSlug !== siteSlug) {
      setSiteSlug(propSiteSlug);
    }
  }, [propSiteSlug]);

  const [pages, setPages] = useState<StorePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mode switcher (Pages vs Templates)
  const [mode, setMode] = useState<"pages" | "templates">("pages");

  // Filter states
  const [activeTab, setActiveTab] = useState<"all" | "core" | "custom" | "drafts">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modal / Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StorePage | null>(null);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    subtitle: "",
    content: "",
    page_type: "custom",
    is_published: true,
    meta_title: "",
    meta_description: "",
    contact_email: "",
    contact_phone: "",
    contact_address: "",
    contact_hours: "",
  });

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<StorePage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (text: string, type: "success" | "info" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Resolve siteId / siteSlug if needed
  useEffect(() => {
    if (siteId && siteSlug) return;
    const resolveMeta = async () => {
      try {
        if (!siteId && siteSlug) {
          const res = await fetch(`${API_BASE_URL}/public/sites/slug/${siteSlug}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.id) setSiteId(data.id);
          }
        } else if (siteId && !siteSlug) {
          const res = await fetch(`${API_BASE_URL}/admin/sites`, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const matched = data.find((s: any) => s.id === siteId || s.slug === siteId);
              if (matched?.slug) setSiteSlug(matched.slug);
            }
          }
        }
      } catch (_) {}
    };
    resolveMeta();
  }, [siteId, siteSlug]);

  // Load pages
  const loadPages = async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/pages`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to load store pages");
      }
      const data = await res.json();
      setPages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, [siteId]);

  // Tab counts
  const counts = useMemo(() => {
    const all = pages.length;
    const core = pages.filter((p) => p.is_default).length;
    const custom = pages.filter((p) => !p.is_default).length;
    const drafts = pages.filter((p) => !p.is_published).length;
    return { all, core, custom, drafts };
  }, [pages]);

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [typeFilter, statusFilter]);

  const hasActiveFilters = activeFilterCount > 0 || !!searchQuery.trim();

  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
  };

  // Filtered pages
  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      // Tab filter
      if (activeTab === "core" && !page.is_default) return false;
      if (activeTab === "custom" && page.is_default) return false;
      if (activeTab === "drafts" && page.is_published) return false;

      // Type filter
      if (typeFilter !== "all" && page.page_type !== typeFilter) return false;

      // Status filter
      if (statusFilter === "published" && !page.is_published) return false;
      if (statusFilter === "draft" && page.is_published) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = page.title.toLowerCase().includes(q);
        const matchSlug = page.slug.toLowerCase().includes(q);
        const matchSubtitle = (page.subtitle || "").toLowerCase().includes(q);
        if (!matchTitle && !matchSlug && !matchSubtitle) return false;
      }

      return true;
    });
  }, [pages, activeTab, typeFilter, statusFilter, searchQuery]);

  // Open Create Page Modal
  const handleOpenCreate = () => {
    if (!canCreatePages) {
      showToast("You do not have permission to create pages.", "error");
      return;
    }
    setEditingPage(null);
    setFormData({
      title: "",
      slug: "",
      subtitle: "",
      content: `# New Page Title\n\nWrite your page content here in **Markdown**.\n\n- Point 1\n- Point 2\n`,
      page_type: "custom",
      is_published: true,
      meta_title: "",
      meta_description: "",
      contact_email: "",
      contact_phone: "",
      contact_address: "",
      contact_hours: "",
    });
    setEditorTab("write");
    setEditorError(null);
    setIsEditorOpen(true);
  };

  // Open Create From Prebuilt Template
  const handleCreateFromTemplate = (templateKey: string) => {
    if (!canCreatePages) {
      showToast("You do not have permission to create pages.", "error");
      return;
    }
    const t = PREBUILT_TEMPLATES[templateKey];
    if (!t) return;
    setEditingPage(null);
    setFormData({
      title: t.title,
      slug: slugify(t.title),
      subtitle: t.subtitle,
      content: t.content,
      page_type: t.page_type,
      is_published: true,
      meta_title: `${t.title} | Brand Store`,
      meta_description: t.subtitle,
      contact_email: "",
      contact_phone: "",
      contact_address: "",
      contact_hours: "",
    });
    setEditorTab("write");
    setEditorError(null);
    setIsEditorOpen(true);
  };

  // Open Edit Page Modal
  const handleOpenEdit = (page: StorePage) => {
    if (!canEditPages) {
      showToast("You do not have permission to edit pages.", "error");
      return;
    }
    setEditingPage(page);
    setFormData({
      title: page.title,
      slug: page.slug,
      subtitle: page.subtitle || "",
      content: page.content || "",
      page_type: page.page_type || "custom",
      is_published: page.is_published,
      meta_title: page.meta_title || "",
      meta_description: page.meta_description || "",
      contact_email: page.contact_email || "",
      contact_phone: page.contact_phone || "",
      contact_address: page.contact_address || "",
      contact_hours: page.contact_hours || "",
    });
    setEditorTab("write");
    setEditorError(null);
    setIsEditorOpen(true);
  };

  // Insert Markdown formatting shortcut
  const handleInsertFormat = (prefix: string, suffix: string = "", placeholder: string = "") => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentVal = formData.content;

    let selected = currentVal.substring(start, end);
    if (!selected && placeholder) selected = placeholder;

    const replacement = `${prefix}${selected}${suffix}`;
    const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    setFormData((prev) => ({ ...prev, content: nextVal }));

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  // Apply prebuilt template
  const handleApplyTemplate = (templateKey: string) => {
    const t = PREBUILT_TEMPLATES[templateKey];
    if (!t) return;
    if (formData.content.trim() && formData.content.length > 50) {
      if (!window.confirm("Replace current content with this template?")) return;
    }
    setFormData((prev) => ({
      ...prev,
      title: prev.title || t.title,
      slug: prev.slug || slugify(t.title),
      subtitle: prev.subtitle || t.subtitle,
      page_type: t.page_type,
      content: t.content,
    }));
    showToast(`Inserted ${t.title} template!`, "info");
  };

  // Toggle active/inactive status inline
  const handleTogglePublish = async (page: StorePage) => {
    if (!canPublishPages) {
      showToast("You do not have permission to publish or unpublish pages.", "error");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/pages/${page.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_published: !page.is_published }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      setPages((prev) => prev.map((p) => (p.id === page.id ? updated : p)));
      showToast(updated.is_published ? `"${page.title}" is now Active!` : `"${page.title}" is now Inactive.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update page status", "error");
    }
  };

  // Save Page (Create or Update)
  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPage && !canEditPages) {
      setEditorError("You do not have permission to edit pages.");
      return;
    }
    if (!editingPage && !canCreatePages) {
      setEditorError("You do not have permission to create pages.");
      return;
    }
    if (formData.is_published && !canPublishPages) {
      setEditorError("You do not have permission to publish pages live. Please switch off Active status to save as a draft.");
      return;
    }
    if (!formData.title.trim()) {
      setEditorError("Page title is required");
      return;
    }
    if (!formData.content.trim()) {
      setEditorError("Page content cannot be empty");
      return;
    }

    setEditorLoading(true);
    setEditorError(null);

    const payload = {
      title: formData.title.trim(),
      slug: formData.slug.trim() ? slugify(formData.slug) : slugify(formData.title),
      subtitle: formData.subtitle.trim() || null,
      content: formData.content,
      page_type: formData.page_type,
      is_published: formData.is_published,
      meta_title: formData.meta_title.trim() || null,
      meta_description: formData.meta_description.trim() || null,
      contact_email: formData.contact_email.trim() || null,
      contact_phone: formData.contact_phone.trim() || null,
      contact_address: formData.contact_address.trim() || null,
      contact_hours: formData.contact_hours.trim() || null,
    };

    try {
      let res: Response;
      if (editingPage) {
        res = await fetch(`${API_BASE_URL}/sites/${siteId}/pages/${editingPage.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/sites/${siteId}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save page");
      }

      const savedPage: StorePage = await res.json();

      if (editingPage) {
        setPages((prev) => prev.map((p) => (p.id === savedPage.id ? savedPage : p)));
        showToast(`Updated "${savedPage.title}" successfully!`, "success");
      } else {
        setPages((prev) => [savedPage, ...prev]);
        showToast(`Created "${savedPage.title}" successfully!`, "success");
      }

      setIsEditorOpen(false);
      setEditingPage(null);
    } catch (err: any) {
      setEditorError(err.message || "Failed to save page");
    } finally {
      setEditorLoading(false);
    }
  };

  // Delete Custom Page
  const handleDeletePage = async () => {
    if (!canDeletePages) {
      showToast("You do not have permission to delete pages.", "error");
      return;
    }
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/pages/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete page");
      }
      setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast(`Deleted page "${deleteTarget.title}".`, "info");
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err.message || "Failed to delete page", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Construct Public Page URLs
  const getPagePublicUrls = (page: StorePage) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    const coreSlugs = ["about", "contact", "privacy", "terms", "story"];
    const isCore = coreSlugs.includes(page.slug);

    const relativePath = isCore
      ? `/store/${siteSlug || siteId}/${page.slug}`
      : `/store/${siteSlug || siteId}/pages/${page.slug}`;

    const fullUrl = `${origin}${relativePath}`;
    return { relativePath, fullUrl };
  };

  // Copy Public Link to Clipboard
  const handleCopyLink = (page: StorePage) => {
    const { fullUrl } = getPagePublicUrls(page);
    navigator.clipboard.writeText(fullUrl);
    showToast(`Copied public link: ${fullUrl}`, "success");
  };

  // View Live Storefront Page
  const handleViewLive = (page: StorePage) => {
    const { relativePath } = getPagePublicUrls(page);
    window.open(relativePath, "_blank");
  };

  if (!canViewPages) {
    return (
      <AccessDeniedView
        title="Pages Access Restricted"
        message="You do not have permission to view or manage store pages. Please contact your workspace administrator to request access."
      />
    );
  }

  return (
    <div style={{ color: "#0f172a" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background:
              toastMessage.type === "error"
                ? "#ef4444"
                : toastMessage.type === "info"
                ? "#0f172a"
                : "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
            fontSize: "13.5px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Card (Segmented Mode + Global Search & Filter Button) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative",
        }}
      >
        {/* Row 1: Mode Switcher + Global Search + Filter Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill (Pages & Policies vs Templates Library) */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            {(["pages", "templates"] as const).map((value) => {
              const isActive = mode === value;
              const label = value === "pages" ? "Pages & Policies" : "Templates Library";
              return (
                <button
                  key={value}
                  onClick={() => {
                    setMode(value);
                  }}
                  style={{
                    borderRadius: "6px",
                    padding: "6px 16px",
                    border: "none",
                    background: isActive ? "#ffffff" : "transparent",
                    color: isActive ? "#0f172a" : "#64748b",
                    boxShadow: isActive
                      ? "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                      : "none",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search Bar & Filter Button Container */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: "1 1 300px",
              maxWidth: "520px",
              position: "relative",
            }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <div
                style={{
                  position: "absolute",
                  left: "11px",
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  mode === "pages"
                    ? "Search pages by title, slug, or subtitle..."
                    : "Search prebuilt templates..."
                }
                style={{
                  ...inputStyle,
                  paddingLeft: "34px",
                  paddingRight: searchQuery ? "28px" : "12px",
                  fontSize: "13px",
                  height: "36px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
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
                  title="Clear search"
                >
                  <XMarkIcon />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            {mode === "pages" && (
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "7px",
                  border: activeFilterCount > 0 ? "1px solid #93c5fd" : "1px solid #cbd5e1",
                  background: activeFilterCount > 0 ? "#eff6ff" : "#ffffff",
                  color: activeFilterCount > 0 ? "#1d4ed8" : "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
                title="Toggle Filters"
              >
                <FilterIcon />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "#2563eb",
                      color: "#ffffff",
                      borderRadius: "10px",
                      padding: "0 6px",
                      marginLeft: "2px",
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* Floating Filter Popover Modal */}
            {isFilterOpen && mode === "pages" && (
              <div
                style={{
                  position: "absolute",
                  top: "44px",
                  right: "0",
                  width: "320px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  padding: "16px",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Filter Pages</div>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                  >
                    <XMarkIcon />
                  </button>
                </div>

                <div>
                  <label style={{ ...labelStyle, fontSize: "12px", marginBottom: "4px" }}>Page Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    style={{ ...inputStyle, fontSize: "13px", height: "34px", padding: "0 8px" }}
                  >
                    <option value="all">All Page Types</option>
                    <option value="policy">Privacy Policy</option>
                    <option value="terms">Terms of Service</option>
                    <option value="about">About Us</option>
                    <option value="contact">Contact Us</option>
                    <option value="story">Brand Story</option>
                    <option value="custom">Custom Content</option>
                  </select>
                </div>

                <div>
                  <label style={{ ...labelStyle, fontSize: "12px", marginBottom: "4px" }}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{ ...inputStyle, fontSize: "13px", height: "34px", padding: "0 8px" }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="published">Active Only</option>
                    <option value="draft">Inactive Only</option>
                  </select>
                </div>

                {/* Action footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "8px",
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <button
                    onClick={() => {
                      resetFilters();
                      setIsFilterOpen(false);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#dc2626",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 6px",
                    }}
                  >
                    Reset All
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    style={{
                      background: "#2563eb",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      padding: "6px 14px",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Active Filter Chips Bar */}
        {hasActiveFilters && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              paddingTop: "6px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, marginRight: "2px" }}>
              Active:
            </span>

            {typeFilter !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Type: {typeFilter.toUpperCase()}</span>
                <button
                  onClick={() => setTypeFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {statusFilter !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Status: {statusFilter === "published" ? "ACTIVE" : "INACTIVE"}</span>
                <button
                  onClick={() => setStatusFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {searchQuery && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Search: "{searchQuery}"</span>
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            <button
              onClick={resetFilters}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                fontSize: "11.5px",
                fontWeight: 600,
                cursor: "pointer",
                marginLeft: "4px",
              }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {mode === "pages" ? (
        <>
          {/* Underline Filter Tabs Bar with Right-aligned Action Button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: "16px",
            }}
          >
            {/* Left: Underline Filter Tabs Bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {[
                { key: "all", label: "All Pages", count: counts.all },
                { key: "core", label: "Core Policies", count: counts.core },
                { key: "custom", label: "Custom Pages", count: counts.custom },
                { key: "drafts", label: "Inactive", count: counts.drafts },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as any)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      border: "none",
                      borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                      background: "transparent",
                      color: isActive ? "#2563eb" : "#64748b",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                      marginBottom: "-1px",
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "10px",
                        background: isActive ? "#eff6ff" : "#f1f5f9",
                        color: isActive ? "#2563eb" : "#64748b",
                        border: `1px solid ${isActive ? "#bfdbfe" : "#e2e8f0"}`,
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right: Action Button matching height, shape, and placement of other pages */}
            {canCreatePages && (
              <button
                type="button"
                onClick={handleOpenCreate}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "34px",
                  padding: "0 14px",
                  borderRadius: "7px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                  transition: "all 0.15s ease",
                  marginBottom: "4px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
              >
                <PlusIcon />
                <span>Create New Page</span>
              </button>
            )}
          </div>

          {/* Pages Content List */}
          {loading ? (
            <div
              style={{
                padding: "48px",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Loading store pages...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "24px",
                background: "#fef2f2",
                borderRadius: "10px",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: "13.5px",
              }}
            >
              {error}
            </div>
          ) : filteredPages.length === 0 ? (
            <div
              style={{
                padding: "48px",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
              }}
            >
              <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 500 }}>
                No pages found matching your filters.
              </p>
              {canCreatePages && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  style={{
                    padding: "7px 14px",
                    background: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "6px",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Create a New Page
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Page Title & URL</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600 }}>Last Updated</th>
                    <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((page) => {
                    return (
                      <tr
                        key={page.id}
                        style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s ease" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Title & Slug */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "14px" }}>
                              {page.title}
                            </span>
                            {page.is_default && (
                              <span
                                title="Core system page"
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: 600,
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                Core
                              </span>
                            )}
                          </div>
                          {page.subtitle && (
                            <p style={{ margin: "2px 0 6px 0", fontSize: "12px", color: "#64748b" }}>
                              {page.subtitle}
                            </p>
                          )}
                          {/* Slug Text */}
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: "4px",
                              padding: "2px 7px",
                              fontSize: "11.5px",
                              color: "#64748b",
                              fontFamily: "monospace",
                            }}
                          >
                            <span>/{page.slug}</span>
                          </div>
                        </td>

                        {/* Page Type */}
                        <td style={{ padding: "14px 16px" }}>
                          <span
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: "999px",
                              textTransform: "capitalize",
                              background:
                                page.page_type === "about"
                                  ? "#f5f3ff"
                                  : page.page_type === "contact"
                                  ? "#eff6ff"
                                  : page.page_type === "policy"
                                  ? "#ecfdf5"
                                  : page.page_type === "terms"
                                  ? "#fef3c7"
                                  : page.page_type === "story"
                                  ? "#fff1f2"
                                  : "#f8fafc",
                              color:
                                page.page_type === "about"
                                  ? "#7c3aed"
                                  : page.page_type === "contact"
                                  ? "#2563eb"
                                  : page.page_type === "policy"
                                  ? "#059669"
                                  : page.page_type === "terms"
                                  ? "#d97706"
                                  : page.page_type === "story"
                                  ? "#e11d48"
                                  : "#475569",
                            }}
                          >
                            {page.page_type}
                          </span>
                        </td>

                        {/* Active / Inactive Status Toggle */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={page.is_published}
                              onClick={() => handleTogglePublish(page)}
                              title={page.is_published ? "Page is Active — Click to set Inactive" : "Page is Inactive — Click to set Active"}
                              style={{
                                position: "relative",
                                width: "32px",
                                height: "18px",
                                borderRadius: "999px",
                                background: page.is_published ? "#16a34a" : "#cbd5e1",
                                border: "none",
                                cursor: "pointer",
                                transition: "background 0.2s ease",
                                padding: 0,
                                outline: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  position: "absolute",
                                  top: "2px",
                                  left: page.is_published ? "16px" : "2px",
                                  width: "14px",
                                  height: "14px",
                                  borderRadius: "50%",
                                  background: "#ffffff",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                                  transition: "left 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                                }}
                              />
                            </button>
                            <span
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 600,
                                color: page.is_published ? "#15803d" : "#64748b",
                                userSelect: "none",
                              }}
                            >
                              {page.is_published ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>

                        {/* Last Updated */}
                        <td style={{ padding: "14px 16px", color: "#64748b", fontSize: "12.5px" }}>
                          {new Date(page.updated_at || page.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>

                        {/* Action Buttons */}
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            {/* Edit */}
                            {canEditPages && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(page)}
                                title="Edit page content"
                                style={{
                                  padding: "5px 12px",
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  borderRadius: "6px",
                                  color: "#2563eb",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#dbeafe")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "#eff6ff")}
                              >
                                Edit
                              </button>
                            )}

                            {/* Copy Link (Beside Delete) */}
                            <button
                              type="button"
                              onClick={() => handleCopyLink(page)}
                              title="Copy public page link"
                              style={{
                                padding: "6px",
                                background: "transparent",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                color: "#475569",
                                cursor: "pointer",
                                display: "grid",
                                placeItems: "center",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f1f5f9";
                                e.currentTarget.style.borderColor = "#cbd5e1";
                                e.currentTarget.style.color = "#1e293b";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.borderColor = "#e2e8f0";
                                e.currentTarget.style.color = "#475569";
                              }}
                            >
                              <CopyIcon />
                            </button>

                            {/* Delete (Custom pages only) */}
                            {!page.is_default ? (
                              canDeletePages ? (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(page)}
                                  title="Delete custom page"
                                  style={{
                                    padding: "6px",
                                    background: "transparent",
                                    border: "1px solid #fee2e2",
                                    borderRadius: "6px",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    display: "grid",
                                    placeItems: "center",
                                    transition: "all 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              ) : null
                            ) : (
                              <span
                                title="Core default pages are protected from deletion"
                                style={{
                                  padding: "6px",
                                  color: "#cbd5e1",
                                  display: "grid",
                                  placeItems: "center",
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Templates Library Grid */
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Pre-Built Store & Policy Templates
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#64748b" }}>
                Jumpstart your store content with compliant legal templates, FAQs, and brand story pages.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {Object.entries(PREBUILT_TEMPLATES)
              .filter(([key, template]) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (
                  template.title.toLowerCase().includes(q) ||
                  template.subtitle.toLowerCase().includes(q) ||
                  key.toLowerCase().includes(q)
                );
              })
              .map(([key, template]) => (
                <div
                  key={key}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#93c5fd";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                        {template.title}
                      </h4>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background: "#eff6ff",
                          color: "#2563eb",
                          textTransform: "capitalize",
                        }}
                      >
                        {template.page_type}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 16px 0", fontSize: "12.5px", color: "#64748b", lineHeight: 1.5 }}>
                      {template.subtitle}
                    </p>
                  </div>

                  {canCreatePages && (
                    <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => handleCreateFromTemplate(key)}
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          height: "32px",
                          padding: "0 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#2563eb",
                          color: "#ffffff",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
                      >
                        <PlusIcon />
                        <span>Use Template</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Markdown Editor Modal / Drawer */}
      {isEditorOpen && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 20px 40px 20px",
            boxSizing: "border-box",
            overflowY: "auto",
            animation: "fadeIn 0.15s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditorOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "980px",
              maxHeight: "calc(100vh - 110px)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
              margin: "auto 0",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                      {editingPage ? `Edit "${editingPage.title}"` : "Create New Store Page"}
                    </h2>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        background: editingPage ? "#eff6ff" : "#ecfdf5",
                        color: editingPage ? "#2563eb" : "#059669",
                        padding: "2px 7px",
                        borderRadius: "999px",
                        textTransform: "uppercase",
                      }}
                    >
                      {editingPage ? "Editing" : "New Page"}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "#64748b" }}>
                    Configure page details, write structured Markdown content, and adjust SEO settings.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  display: "grid",
                  placeItems: "center",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                title="Close editor"
              >
                <XMarkIcon />
              </button>
            </div>

            {/* Modal Body (Scrollable & Cleanly Organized) */}
            <form
              onSubmit={handleSavePage}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                gap: "18px",
              }}
            >
              {editorError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    color: "#b91c1c",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {editorError}
                </div>
              )}

              {/* Group 1: General Details */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "2px" }}>
                  1. Page General Information
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Page Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          title: newTitle,
                          slug: (!editingPage || !editingPage.is_default) ? slugify(newTitle) : prev.slug,
                        }));
                      }}
                      placeholder="e.g. Shipping & Delivery Policy"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      URL Slug * {editingPage?.is_default && <span style={{ color: "#94a3b8" }}>(Core Locked)</span>}
                    </label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          padding: "8px 10px",
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRight: "none",
                          borderRadius: "6px 0 0 6px",
                          fontSize: "12.5px",
                          color: "#64748b",
                          fontFamily: "monospace",
                        }}
                      >
                        /
                      </span>
                      <input
                        type="text"
                        required
                        disabled={Boolean(editingPage?.is_default)}
                        value={formData.slug}
                        onChange={(e) => setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                        placeholder="shipping-policy"
                        style={{
                          ...inputStyle,
                          borderRadius: "0 6px 6px 0",
                          fontFamily: "monospace",
                          background: editingPage?.is_default ? "#f1f5f9" : "#ffffff",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Page Type</label>
                    <select
                      value={formData.page_type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, page_type: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="custom">Custom Content</option>
                      <option value="about">About Us</option>
                      <option value="contact">Contact Us</option>
                      <option value="policy">Privacy Policy</option>
                      <option value="terms">Terms of Service</option>
                      <option value="story">Brand Story</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Subtitle / Headline Tagline (Optional)</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="e.g. Everything you need to know about our domestic and international order dispatch."
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Group 1.5: Contact Specific Fields */}
              {formData.page_type === "contact" && (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0369a1" }}>
                    Contact Details Widget
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ ...labelStyle, color: "#0369a1" }}>Support Email</label>
                      <input
                        type="email"
                        value={formData.contact_email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contact_email: e.target.value }))}
                        placeholder="support@store.com"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: "#0369a1" }}>Support Phone</label>
                      <input
                        type="text"
                        value={formData.contact_phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))}
                        placeholder="+1 (800) 555-0199"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: "#0369a1" }}>Store Address / HQ</label>
                      <input
                        type="text"
                        value={formData.contact_address}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contact_address: e.target.value }))}
                        placeholder="100 Commerce Blvd, Suite 400"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: "#0369a1" }}>Operating Hours</label>
                      <input
                        type="text"
                        value={formData.contact_hours}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contact_hours: e.target.value }))}
                        placeholder="Mon - Fri: 9am - 7pm EST"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Group 2: Markdown Content & Editor */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                    2. Page Content & Layout (Markdown) *
                  </div>

                  {/* Mode Tabs */}
                  <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: "6px", padding: "2px", border: "1px solid #e2e8f0" }}>
                    <button
                      type="button"
                      onClick={() => setEditorTab("write")}
                      style={{
                        padding: "4px 12px",
                        border: "none",
                        borderRadius: "5px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: editorTab === "write" ? "#ffffff" : "transparent",
                        color: editorTab === "write" ? "#0f172a" : "#64748b",
                        boxShadow: editorTab === "write" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                      }}
                    >
                      ✏️ Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab("preview")}
                      style={{
                        padding: "4px 12px",
                        border: "none",
                        borderRadius: "5px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: editorTab === "preview" ? "#ffffff" : "transparent",
                        color: editorTab === "preview" ? "#0f172a" : "#64748b",
                        boxShadow: editorTab === "preview" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                      }}
                    >
                      👁️ Live Preview
                    </button>
                  </div>
                </div>

                {/* Markdown Formatting Toolbar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 8px",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderBottom: "none",
                    borderRadius: "6px 6px 0 0",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("**", "**", "bold text")}
                    title="Bold (**text**)"
                    style={{ padding: "4px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("*", "*", "italic text")}
                    title="Italic (*text*)"
                    style={{ padding: "4px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontStyle: "italic", fontSize: "12px", cursor: "pointer" }}
                  >
                    I
                  </button>
                  <span style={{ width: "1px", height: "16px", background: "#cbd5e1", margin: "0 2px" }} />
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("# ", "", "Heading 1")}
                    title="H1 Heading"
                    style={{ padding: "4px 7px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("## ", "", "Heading 2")}
                    title="H2 Heading"
                    style={{ padding: "4px 7px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("### ", "", "Heading 3")}
                    title="H3 Heading"
                    style={{ padding: "4px 7px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                  >
                    H3
                  </button>
                  <span style={{ width: "1px", height: "16px", background: "#cbd5e1", margin: "0 2px" }} />
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("- ", "", "List item")}
                    title="Bullet List"
                    style={{ padding: "4px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}
                  >
                    • List
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("1. ", "", "First item")}
                    title="Numbered List"
                    style={{ padding: "4px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}
                  >
                    1. List
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("> ", "", "Quote text")}
                    title="Blockquote"
                    style={{ padding: "4px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}
                  >
                    ❝ Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("\n---\n", "", "")}
                    title="Divider line"
                    style={{ padding: "4px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}
                  >
                    — Divider
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertFormat("[", "](https://...)", "Link Text")}
                    title="Insert Link"
                    style={{ padding: "4px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}
                  >
                    🔗 Link
                  </button>

                  {/* Prebuilt Templates Menu */}
                  <div style={{ marginLeft: "auto" }}>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleApplyTemplate(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #94a3b8",
                        borderRadius: "4px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: "#1e293b",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="" disabled>
                        📑 Insert Template...
                      </option>
                      <option value="privacy">Privacy Policy</option>
                      <option value="terms">Terms of Service</option>
                      <option value="faq">FAQ Accordion</option>
                      <option value="shipping">Shipping & Delivery</option>
                      <option value="story">Brand Story</option>
                    </select>
                  </div>
                </div>

                {/* Editor Content Area */}
                {editorTab === "write" ? (
                  <textarea
                    ref={textareaRef}
                    required
                    rows={12}
                    value={formData.content}
                    onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="Type markdown content..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0 0 6px 6px",
                      fontSize: "13.5px",
                      fontFamily: "monospace",
                      lineHeight: 1.5,
                      resize: "vertical",
                      minHeight: "220px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      padding: "20px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0 0 6px 6px",
                      background: "#ffffff",
                      minHeight: "220px",
                      maxHeight: "360px",
                      overflowY: "auto",
                    }}
                  >
                    <MarkdownContent content={formData.content} />
                  </div>
                )}
              </div>

              {/* Group 3: SEO Metadata Section (Collapsible) */}
              <details
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  background: "#f8fafc",
                }}
              >
                <summary style={{ fontSize: "13px", fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                  3. Search Engine Optimization (SEO Meta Tags)
                </summary>
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#64748b", marginBottom: "3px" }}>
                      Meta Title (Recommended under 60 chars)
                    </label>
                    <input
                      type="text"
                      maxLength={70}
                      value={formData.meta_title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, meta_title: e.target.value }))}
                      placeholder={formData.title ? `${formData.title} | Brand Store` : "Page Title | Brand Store"}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#64748b", marginBottom: "3px" }}>
                      Meta Description (Recommended under 160 chars)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={160}
                      value={formData.meta_description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, meta_description: e.target.value }))}
                      placeholder="Brief summary shown on Google search results..."
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                </div>
              </details>

              {/* Modal Footer Controls */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "14px",
                  borderTop: "1px solid #e2e8f0",
                  marginTop: "4px",
                }}
              >
                {/* Publish Toggle */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "9px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={() => setFormData((prev) => ({ ...prev, is_published: !prev.is_published }))}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.is_published}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({ ...prev, is_published: !prev.is_published }));
                    }}
                    style={{
                      position: "relative",
                      width: "34px",
                      height: "19px",
                      borderRadius: "999px",
                      background: formData.is_published ? "#16a34a" : "#cbd5e1",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                      padding: 0,
                      outline: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: formData.is_published ? "17px" : "2px",
                        width: "15px",
                        height: "15px",
                        borderRadius: "50%",
                        background: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                        transition: "left 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </button>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: formData.is_published ? "#15803d" : "#64748b" }}>
                    {formData.is_published ? "Active (Visible on Storefront)" : "Inactive (Hidden from Storefront)"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    style={{
                      padding: "8px 16px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "7px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#475569",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editorLoading}
                    style={{
                      padding: "8px 20px",
                      background: "#2563eb",
                      border: "none",
                      borderRadius: "7px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#ffffff",
                      cursor: editorLoading ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
                  >
                    {editorLoading ? "Saving..." : editingPage ? "Update Page" : "Publish Page"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 30px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: 700, color: "#b91c1c" }}>
              Delete Page?
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13.5px", color: "#475569", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{deleteTarget.title}"</strong>? Any links pointing to <code>/{deleteTarget.slug}</code> will return a 404 page.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: "8px 14px",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeletePage}
                style={{
                  padding: "8px 16px",
                  background: "#dc2626",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                }}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete Page"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPages;
