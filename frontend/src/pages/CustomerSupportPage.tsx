import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { getCustomerAuthHeaders } from "../utils/customerAuthFetch";
import { usePublicSiteTheme } from "../hooks/usePublicSiteTheme";
import {
  parseMessageWithMedia,
  AdaptiveSupportImage,
  SupportImageZoomModal,
  compressImageFile,
  MessageStatusTick,
} from "../Component/AdaptiveSupportMedia";

interface CustomerSupportPageProps {
  siteId?: string;
  siteSlug?: string;
  theme?: Record<string, any>;
  props?: Record<string, any>;
  [key: string]: any;
}

interface SupportCategory {
  id: string;
  label: string;
}

// In-memory LRU Cache implementation to optimize memory & prevent redundant network round-trips
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity = 30) {
    this.capacity = Math.max(1, capacity);
    this.cache = new Map<K, V>();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const formatOrderDate = (isoString?: string | null) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const CATEGORIES: SupportCategory[] = [
  { id: "damaged_item", label: "Damaged / Broken Product" },
  { id: "delivery_delay", label: "Delivery Delay / Tracking" },
  { id: "missing_item", label: "Missing Item in Order" },
  { id: "wrong_item", label: "Wrong Item Received" },
  { id: "return_exchange", label: "Return or Exchange Inquiry" },
  { id: "cancellation", label: "Order Cancellation" },
  { id: "payment_issue", label: "Payment & Refund" },
  { id: "other", label: "General Store Inquiry" },
];

const renderCategoryIcon = (categoryId: string, size = 16) => {
  switch (categoryId) {
    case "damaged_item":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "delivery_delay":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "missing_item":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      );
    case "wrong_item":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      );
    case "return_exchange":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case "cancellation":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "payment_issue":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
  }
};

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  open: {
    label: "Open",
    bg: "rgba(37, 99, 235, 0.08)",
    text: "#2563eb",
    border: "rgba(37, 99, 235, 0.2)",
  },
  in_progress: {
    label: "In Progress",
    bg: "rgba(124, 58, 237, 0.08)",
    text: "#7c3aed",
    border: "rgba(124, 58, 237, 0.2)",
  },
  waiting_customer: {
    label: "Specialist Replied",
    bg: "rgba(245, 158, 11, 0.08)",
    text: "#d97706",
    border: "rgba(245, 158, 11, 0.25)",
  },
  resolved: {
    label: "Resolved",
    bg: "rgba(22, 163, 74, 0.08)",
    text: "#16a34a",
    border: "rgba(22, 163, 74, 0.2)",
  },
  closed: {
    label: "Closed",
    bg: "rgba(100, 116, 139, 0.08)",
    text: "#64748b",
    border: "rgba(100, 116, 139, 0.16)",
  },
};

export default function CustomerSupportPage({
  siteId: propSiteId,
  siteSlug: propSiteSlug,
  theme: propTheme,
  ...restProps
}: CustomerSupportPageProps) {
  const { siteId: routeSiteId, slug: routeSlug } = useParams<{ siteId?: string; slug?: string }>();
  const activeSlug = propSiteSlug || routeSlug || "";
  const effectiveSiteId = propSiteId || routeSiteId || activeSlug || "";
  const navigate = useNavigate();

  // Responsive Viewport Tracking
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = viewportWidth <= 768;
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Read configurable block props from site editor / admin
  const blockProps = restProps?.props || (restProps as any) || {};
  const inquiriesTabLabel = blockProps?.inquiriesTabLabel || "Inquiries";
  const newRequestTabLabel = blockProps?.newRequestTabLabel || "+ New Request";
  const submitButtonText = blockProps?.submitButtonText || "Submit Request";
  const supportEmail = blockProps?.supportEmail || "";
  const supportPhone = blockProps?.supportPhone || "";
  const supportHours = blockProps?.supportHours || "";

  // Scroll to top on initial mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { siteData } = usePublicSiteTheme(activeSlug);
  const activeTheme = propTheme || siteData?.theme || {};
  const isLight = activeTheme.mode !== "dark";

  const parseDimension = (val: any, fallback: string) => {
    if (val === undefined || val === null || val === "") return fallback;
    if (typeof val === "number") return `${val}px`;
    const s = String(val).trim();
    return s.endsWith("px") || s.endsWith("%") || s.endsWith("rem") || s.endsWith("vh") || s.endsWith("vw") ? s : `${s}px`;
  };

  const resolvedMaxWidth = useMemo(() => {
    const raw = blockProps?.max_width;
    if (!raw || raw === "100%" || raw === "full" || raw === "100") return "100%";
    if (typeof raw === "number") return `${raw}px`;
    const s = String(raw).trim();
    return s.endsWith("px") || s.endsWith("%") || s.endsWith("rem") || s.endsWith("vw") ? s : `${s}px`;
  }, [blockProps?.max_width]);

  const cardRadius = parseDimension(blockProps?.card_radius ?? blockProps?.border_radius, "12px");
  const cardPadding = parseDimension(blockProps?.card_padding ?? blockProps?.padding, isMobile ? "16px" : "24px");
  const chatRadius = parseDimension(blockProps?.chat_radius ?? blockProps?.chat_window_radius, "10px");
  const bubbleRadius = parseDimension(blockProps?.bubble_radius ?? blockProps?.chat_bubble_radius, "14px");
  const innerRadius = parseDimension(blockProps?.inner_radius, "8px");
  const inputRadius = parseDimension(blockProps?.input_radius, "8px");
  const buttonRadius = parseDimension(blockProps?.button_radius, "8px");
  const badgeRadius = parseDimension(blockProps?.badge_radius, "4px");

  // Consistent, solid theme colors without dark transparency clashes
  const accentColor = blockProps?.accent_color || activeTheme.accent_color || "#2563eb";
  const primaryBg = isLight ? (blockProps?.primary_bg || activeTheme.primary_bg || "#f8fafc") : "#0b1120";
  const cardBg = isLight ? (blockProps?.card_bg || activeTheme.card_bg || "#ffffff") : "#131c31";
  const surfaceBg = isLight ? "#f1f5f9" : "#1a243d";
  const chatBg = isLight ? (blockProps?.chat_bg || "#ffffff") : "#0f172a";
  const textColor = isLight ? (blockProps?.text_color || activeTheme.text_color || "#0f172a") : "#f8fafc";
  const textMuted = isLight ? (blockProps?.subtext_color || "#64748b") : "#94a3b8";
  const borderColor = isLight ? (blockProps?.border_color || activeTheme.border_color || "#e2e8f0") : "rgba(255, 255, 255, 0.12)";
  const buttonTextColor = blockProps?.button_text_color || "#ffffff";
  const inputBg = isLight ? "#ffffff" : "#1a243d";
  const inputBorder = borderColor;
  const inputTextColor = textColor;
  const customerBubbleBg = blockProps?.customer_bubble_bg || accentColor;
  const customerBubbleText = blockProps?.customer_bubble_text || "#ffffff";
  const agentBubbleBg = blockProps?.agent_bubble_bg || surfaceBg;
  const agentBubbleText = blockProps?.agent_bubble_text || textColor;
  const allowOrderSelection = blockProps?.allowOrderSelection !== false;
  const allowAttachments = blockProps?.allowAttachments !== false;
  const showContactInfo = blockProps?.showContactInfo !== false;

  // View State
  const [activeTab, setActiveTab] = useState<"inquiries" | "new">("inquiries");
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsLoadingMore, setTicketsLoadingMore] = useState(false);
  const [ticketsPage, setTicketsPage] = useState(1);
  const [ticketsTotalPages, setTicketsTotalPages] = useState(1);
  const [ticketsTotalCount, setTicketsTotalCount] = useState(0);
  // LRU cache for tickets: 5 page-slots × 8 items each = 40 max in cache memory
  const ticketsLRUCache = useRef<LRUCache<string, any>>(new LRUCache<string, any>(5));
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Active Chat State with pagination and memory cap
  const [ticketDetail, setTicketDetail] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messagesLoadingOlder, setMessagesLoadingOlder] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [messagesTotalPages, setMessagesTotalPages] = useState(1);
  const [messagesTotalCount, setMessagesTotalCount] = useState(0);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  // LRU cache for recent ticket message threads
  const ticketMessagesLRUCache = useRef<LRUCache<string, any>>(new LRUCache<string, any>(10));
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Picture Upload & Zoom State
  const [chatImage, setChatImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploadingChatImage, setUploadingChatImage] = useState(false);
  const [newRequestImage, setNewRequestImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploadingNewRequestImage, setUploadingNewRequestImage] = useState(false);
  const [activeZoomPhoto, setActiveZoomPhoto] = useState<string | null>(null);

  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const newRequestFileInputRef = useRef<HTMLInputElement | null>(null);

  const resolveMediaUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
      return url;
    }
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const uploadFileToSupport = async (file: File): Promise<string> => {
    // Compress customer photo by ~90-95% to lightweight WebP before uploading
    const fileToUpload = await compressImageFile(file, 1600, 1600, 0.82);
    const formData = new FormData();
    formData.append("file", fileToUpload);
    const headers = getCustomerAuthHeaders(effectiveSiteId);
    delete headers["Content-Type"];

    const res = await fetch(`${API_BASE_URL}/sites/${effectiveSiteId}/support/upload-image`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || "Failed to upload picture");
    }
    const data = await res.json();
    return data.url;
  };

  const handlePasteImage = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const rawFile = items[i].getAsFile();
        if (rawFile) {
          const file = await compressImageFile(rawFile, 1600, 1600, 0.82);
          const previewUrl = URL.createObjectURL(file);
          setChatImage({ file, previewUrl });
          break;
        }
      }
    }
  };

  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const urlOrderId = searchParams.get("orderId");
  const urlItemId = searchParams.get("itemId");

  // New Request State & Product Selection
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);
  // LRU cache: 5 page-slots × 6 orders each = 30 orders max in cache memory
  const ordersLRUCache = useRef<LRUCache<string, any>>(new LRUCache<string, any>(5));
  const [selectedOrderId, setSelectedOrderId] = useState<string>(urlOrderId || "");
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string>(urlItemId || "");
  const [selectedCategory, setSelectedCategory] = useState<string>("damaged_item");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Modern Custom Dropdown UI States & Refs
  const [orderDropdownOpen, setOrderDropdownOpen] = useState(false);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const orderDropdownRef = useRef<HTMLDivElement | null>(null);
  const itemDropdownRef = useRef<HTMLDivElement | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(e.target as Node)) {
        setOrderDropdownOpen(false);
      }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target as Node)) {
        setItemDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Deep-linking from URL (?tab=new&orderId=...&itemId=...)
  useEffect(() => {
    if (urlTab === "new" || urlOrderId) {
      setActiveTab("new");
    }
    if (urlOrderId) {
      setSelectedOrderId(urlOrderId);
    }
    if (urlItemId) {
      setSelectedOrderItemId(urlItemId);
    }
  }, [urlTab, urlOrderId, urlItemId]);

  // Active Order & Items computed
  const activeOrder = useMemo(() => {
    return orders.find((o) => String(o.id) === String(selectedOrderId)) || null;
  }, [orders, selectedOrderId]);

  const activeOrderItems = useMemo(() => {
    if (!activeOrder || !Array.isArray(activeOrder.items)) return [];
    return activeOrder.items;
  }, [activeOrder]);

  const selectedOrderItem = useMemo(() => {
    if (!selectedOrderItemId || !activeOrderItems.length) return null;
    return (
      activeOrderItems.find(
        (it: any) =>
          String(it.id) === String(selectedOrderItemId) ||
          String(it.order_item_id) === String(selectedOrderItemId) ||
          String(it.product_id) === String(selectedOrderItemId)
      ) || null
    );
  }, [activeOrderItems, selectedOrderItemId]);

  // Auto-sync item & subject when orders data finishes loading from API
  useEffect(() => {
    if (!orders.length || !urlOrderId) return;
    const matchedOrder = orders.find((o) => String(o.id) === String(urlOrderId));
    if (matchedOrder) {
      setSelectedOrderId(matchedOrder.id);
      if (urlItemId && Array.isArray(matchedOrder.items)) {
        const matchedItem = matchedOrder.items.find(
          (it: any) =>
            String(it.id) === String(urlItemId) ||
            String(it.order_item_id) === String(urlItemId) ||
            String(it.product_id) === String(urlItemId)
        );
        if (matchedItem) {
          setSelectedOrderItemId(String(matchedItem.id || matchedItem.order_item_id || matchedItem.product_id));
          const variantText = matchedItem.variant_title || matchedItem.selected_variant_value ? ` (${matchedItem.variant_title || matchedItem.selected_variant_value})` : "";
          setSubject(`Issue with ${matchedItem.product_name}${variantText} - Order #${matchedOrder.id.slice(0, 8)}`);
        } else {
          setSubject(`Order #${matchedOrder.id.slice(0, 8)} Inquiry`);
        }
      } else {
        setSubject(`Order #${matchedOrder.id.slice(0, 8)} Inquiry`);
      }
    }
  }, [orders, urlOrderId, urlItemId]);

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedOrderItemId("");
    if (!orderId) {
      setSubject("General Customer Support Inquiry");
      return;
    }
    const ord = orders.find((o) => String(o.id) === String(orderId));
    if (ord) {
      const prefix = `Order #${ord.id.slice(0, 8)}`;
      if (!subject || subject.startsWith("Order #") || subject.startsWith("Support Request") || subject.startsWith("Issue with")) {
        setSubject(`${prefix} Inquiry`);
      }
    }
  };

  const handleOrderItemSelect = (itemId: string) => {
    setSelectedOrderItemId(itemId);
    if (itemId && activeOrderItems.length) {
      const item = activeOrderItems.find(
        (it: any) =>
          String(it.id) === String(itemId) ||
          String(it.order_item_id) === String(itemId) ||
          String(it.product_id) === String(itemId)
      );
      if (item) {
        const variantText = item.variant_title || item.selected_variant_value ? ` (${item.variant_title || item.selected_variant_value})` : "";
        const orderPart = selectedOrderId ? ` - Order #${selectedOrderId.slice(0, 8)}` : "";
        setSubject(`Issue with ${item.product_name}${variantText}${orderPart}`);
      }
    } else if (selectedOrderId) {
      setSubject(`Order #${selectedOrderId.slice(0, 8)} Inquiry`);
    }
  };

  // Load tickets and initial page of orders on mount / site change
  useEffect(() => {
    const targetId = siteData?.site_id || siteData?.id || effectiveSiteId;
    if (targetId) {
      // Clear stale data from any previous site immediately before fetching
      setOrders([]);
      setOrdersPage(1);
      setOrdersTotalPages(1);
      setOrdersTotalCount(0);
      ordersLRUCache.current.clear();

      setTickets([]);
      setTicketsPage(1);
      setTicketsTotalPages(1);
      setTicketsTotalCount(0);
      ticketsLRUCache.current.clear();
      ticketMessagesLRUCache.current.clear();

      loadTickets(1, false);
      loadOrders(1, false);
    }
  }, [effectiveSiteId, siteData?.site_id, siteData?.id]);

  // Server-side paginated load of tickets (8 items per batch) with LRU caching
  const loadTickets = async (targetPage = 1, isAppend = false, isSilent = false) => {
    const targetSiteId = siteData?.site_id || siteData?.id || effectiveSiteId;
    if (!targetSiteId) return;

    if (isAppend) {
      setTicketsLoadingMore(true);
    } else if (!isSilent) {
      setTicketsLoading(true);
    }

    const cacheKey = `${targetSiteId}_tickets_page_${targetPage}_ps8`;
    const cachedData = ticketsLRUCache.current.get(cacheKey);

    if (cachedData) {
      if (isAppend) {
        setTickets((prev) => {
          const existingIds = new Set(prev.map((t) => String(t.id)));
          const filtered = (cachedData.tickets || []).filter((t: any) => !existingIds.has(String(t.id)));
          return [...prev, ...filtered].slice(0, 40);
        });
      } else {
        const list = (cachedData.tickets || []).slice(0, 40);
        setTickets(list);
        if (!selectedTicketId && list.length > 0 && !isMobile) {
          setSelectedTicketId(list[0].id);
        }
      }
      setTicketsPage(targetPage);
      setTicketsTotalPages(cachedData.total_pages || 1);
      setTicketsTotalCount(cachedData.total || (cachedData.tickets || []).length);
      if (!isSilent) setTicketsLoading(false);
      setTicketsLoadingMore(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/sites/${targetSiteId}/support/tickets/my?page=${targetPage}&page_size=8`, {
        credentials: "include",
        headers: getCustomerAuthHeaders(targetSiteId),
      });
      if (res.ok) {
        const data = await res.json();
        const incomingTickets: any[] = Array.isArray(data.tickets)
          ? data.tickets
          : Array.isArray(data)
          ? data
          : [];
        const total = typeof data.total === "number" ? data.total : incomingTickets.length;
        const totalPages = typeof data.total_pages === "number" ? data.total_pages : 1;

        ticketsLRUCache.current.set(cacheKey, {
          tickets: incomingTickets,
          total,
          total_pages: totalPages,
        });

        if (isAppend) {
          setTickets((prev) => {
            const existingIds = new Set(prev.map((t) => String(t.id)));
            const filtered = incomingTickets.filter((t: any) => !existingIds.has(String(t.id)));
            return [...prev, ...filtered].slice(0, 40);
          });
        } else {
          const list = incomingTickets.slice(0, 40);
          setTickets(list);
          if (!selectedTicketId && list.length > 0 && !isMobile) {
            setSelectedTicketId(list[0].id);
          }
        }
        setTicketsPage(targetPage);
        setTicketsTotalPages(totalPages);
        setTicketsTotalCount(total);
      } else if (effectiveSiteId && effectiveSiteId !== targetSiteId) {
        const res2 = await fetch(`${API_BASE_URL}/sites/${effectiveSiteId}/support/tickets/my?page=${targetPage}&page_size=8`, {
          credentials: "include",
          headers: getCustomerAuthHeaders(effectiveSiteId),
        });
        if (res2.ok) {
          const data2 = await res2.json();
          const incoming2 = Array.isArray(data2.tickets) ? data2.tickets : [];
          const total2 = typeof data2.total === "number" ? data2.total : incoming2.length;
          const totalPages2 = typeof data2.total_pages === "number" ? data2.total_pages : 1;

          ticketsLRUCache.current.set(cacheKey, {
            tickets: incoming2,
            total: total2,
            total_pages: totalPages2,
          });

          if (isAppend) {
            setTickets((prev) => {
              const existingIds = new Set(prev.map((t) => String(t.id)));
              const filtered = incoming2.filter((t: any) => !existingIds.has(String(t.id)));
              return [...prev, ...filtered].slice(0, 40);
            });
          } else {
            const list2 = incoming2.slice(0, 40);
            setTickets(list2);
            if (!selectedTicketId && list2.length > 0 && !isMobile) {
              setSelectedTicketId(list2[0].id);
            }
          }
          setTicketsPage(targetPage);
          setTicketsTotalPages(totalPages2);
          setTicketsTotalCount(total2);
        }
      }
    } catch {
      // silent
    } finally {
      if (!isSilent) setTicketsLoading(false);
      setTicketsLoadingMore(false);
    }
  };

  const handleTicketsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (
      scrollTop + clientHeight >= scrollHeight - 30 &&
      !ticketsLoading &&
      !ticketsLoadingMore &&
      ticketsPage < ticketsTotalPages
    ) {
      loadTickets(ticketsPage + 1, true);
    }
  };

  // Server-side paginated load of orders (6 items per batch) with LRU caching
  const loadOrders = async (targetPage = 1, isAppend = false) => {
    const targetSiteId = siteData?.site_id || siteData?.id || effectiveSiteId;
    if (!targetSiteId) return;

    if (isAppend) {
      setOrdersLoadingMore(true);
    } else {
      setOrdersLoading(true);
    }

    const cacheKey = `${targetSiteId}_page_${targetPage}_ps6`;
    const cachedData = ordersLRUCache.current.get(cacheKey);

    if (cachedData) {
      if (isAppend) {
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => String(o.id)));
          const filtered = (cachedData.orders || []).filter((o: any) => !existingIds.has(String(o.id)));
          // Hard cap: keep at most 30 orders in state at any time
          return [...prev, ...filtered].slice(0, 30);
        });
      } else {
        setOrders((cachedData.orders || []).slice(0, 30));
      }
      setOrdersPage(targetPage);
      setOrdersTotalPages(cachedData.total_pages || 1);
      setOrdersTotalCount(cachedData.total || (cachedData.orders || []).length);
      setOrdersLoading(false);
      setOrdersLoadingMore(false);
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/orders/${targetSiteId}/my-orders?page=${targetPage}&page_size=6`,
        {
          credentials: "include",
          headers: getCustomerAuthHeaders(targetSiteId),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const incomingOrders: any[] = Array.isArray(data)
          ? data
          : data && Array.isArray(data.orders)
          ? data.orders
          : [];
        const total = typeof data.total === "number" ? data.total : incomingOrders.length;
        const totalPages = typeof data.total_pages === "number" ? data.total_pages : 1;

        ordersLRUCache.current.set(cacheKey, {
          orders: incomingOrders,
          total,
          total_pages: totalPages,
        });

        if (isAppend) {
          setOrders((prev) => {
            const existingIds = new Set(prev.map((o) => String(o.id)));
            const filtered = incomingOrders.filter((o: any) => !existingIds.has(String(o.id)));
            // Hard cap: keep at most 30 orders in state at any time
            return [...prev, ...filtered].slice(0, 30);
          });
        } else {
          setOrders(incomingOrders.slice(0, 30));
        }

        setOrdersPage(targetPage);
        setOrdersTotalPages(totalPages);
        setOrdersTotalCount(total);
      }
    } catch {
      // silent
    } finally {
      setOrdersLoading(false);
      setOrdersLoadingMore(false);
    }
  };

  const handleOrderDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (
      scrollTop + clientHeight >= scrollHeight - 35 &&
      !ordersLoading &&
      !ordersLoadingMore &&
      ordersPage < ordersTotalPages
    ) {
      loadOrders(ordersPage + 1, true);
    }
  };

  // Paginated chat messages (20 messages per batch) with scroll-to-top older message loading
  const loadTicketDetail = async (ticketId: string, page = 1, isOlder = false, isSilent = false) => {
    if (!effectiveSiteId || !ticketId) return;
    if (isOlder) {
      setMessagesLoadingOlder(true);
    } else if (!isSilent) {
      setChatLoading(true);
    }

    const prevScrollHeight = chatContainerRef.current?.scrollHeight || 0;

    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${effectiveSiteId}/support/tickets/${ticketId}?page=${page}&page_size=20`,
        {
          credentials: "include",
          headers: getCustomerAuthHeaders(effectiveSiteId),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setTicketDetail((prev: any) => {
          if (
            prev &&
            prev.id === data.ticket?.id &&
            prev.status === data.ticket?.status &&
            prev.resolution_note === data.ticket?.resolution_note &&
            prev.resolved_at === data.ticket?.resolved_at
          ) {
            return prev;
          }
          return data.ticket;
        });

        const incoming: any[] = Array.isArray(data.messages) ? data.messages : [];
        const pagination = data.pagination || {};
        const totalPages = typeof pagination.total_pages === "number" ? pagination.total_pages : 1;
        const total = typeof pagination.total === "number" ? pagination.total : incoming.length;
        const hasOlder = pagination.has_more_older ?? (page < totalPages);

        if (isOlder) {
          // Prepend older messages while maintaining scroll position
          setMessages((prev: any[]) => {
            const existingIds = new Set(prev.map((m) => String(m.id || m.created_at)));
            const filteredIncoming = incoming.filter((m: any) => !existingIds.has(String(m.id || m.created_at)));
            const combined = [...filteredIncoming, ...prev];
            // Memory guard: keep at most 60 messages in active RAM
            return combined.slice(-60);
          });
          setMessagesPage(page);
          setHasMoreOlderMessages(hasOlder);

          // Preserve exact scroll position so chat does not jump
          requestAnimationFrame(() => {
            if (chatContainerRef.current) {
              const newScrollHeight = chatContainerRef.current.scrollHeight;
              chatContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
            }
          });
        } else {
          // Initial load or background poll
          if (isSilent) {
            setMessages((prev: any[]) => {
              if (prev.length === 0) return incoming.slice(-60);

              // If sending a reply right now, preserve ONLY the active in-flight temp message
              const norm = (s: string) => (s || "").replace(/\r\n/g, "\n").trim();
              const activeTemps = sendingReply
                ? prev.filter((m) => {
                    if (!String(m.id || "").startsWith("temp_")) return false;
                    const alreadyInIncoming = incoming.some(
                      (inc) => inc.sender_type === m.sender_type && norm(inc.message) === norm(m.message)
                    );
                    return !alreadyInIncoming;
                  })
                : [];

              const combined = [...incoming, ...activeTemps];
              // Strict ID and content deduplication
              const seen = new Set<string>();
              const deduplicated: any[] = [];
              for (const m of combined) {
                const key = String(m.id || "");
                if (key && !seen.has(key)) {
                  seen.add(key);
                  deduplicated.push(m);
                }
              }

              // Auto-scroll if user is close to bottom or new incoming message
              if (chatContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
                if (scrollHeight - scrollTop - clientHeight < 150) {
                  requestAnimationFrame(() => {
                    if (chatContainerRef.current) {
                      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                    }
                  });
                }
              }
              return deduplicated.slice(-60);
            });
          } else {
            // First open of ticket thread: load page 1 and scroll to bottom
            setMessages(incoming.slice(-60));
            setMessagesPage(1);
            setMessagesTotalPages(totalPages);
            setMessagesTotalCount(total);
            setHasMoreOlderMessages(hasOlder);

            requestAnimationFrame(() => {
              if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
              }
            });
          }
        }
      }
    } catch {
      // silent
    } finally {
      if (isOlder) {
        setMessagesLoadingOlder(false);
      } else if (!isSilent) {
        setChatLoading(false);
      }
    }
  };

  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (
      scrollTop <= 30 &&
      !chatLoading &&
      !messagesLoadingOlder &&
      hasMoreOlderMessages &&
      selectedTicketId
    ) {
      loadTicketDetail(selectedTicketId, messagesPage + 1, true, false);
    }
  };

  // Real-time Instant Live Sync via Server-Sent Events (SSE) & read receipt updates
  useEffect(() => {
    if (activeTab !== "inquiries" || !selectedTicketId || !effectiveSiteId) return;
    loadTicketDetail(selectedTicketId, 1, false, false);

    // Open real-time sub-millisecond SSE stream for instant delivery and WhatsApp seen receipt updates
    const sseUrl = `${API_BASE_URL}/sites/${effectiveSiteId}/support/tickets/${selectedTicketId}/stream`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(sseUrl, { withCredentials: true });
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" && data.message) {
            setMessages((prev) => {
              const msgId = String(data.message.id);
              const norm = (s: string) => (s || "").replace(/\r\n/g, "\n").trim();
              const withoutTemp = prev.filter(
                (m) => !(String(m.id || "").startsWith("temp_") && norm(m.message) === norm(data.message.message))
              );
              if (withoutTemp.some((m) => String(m.id) === msgId)) {
                return withoutTemp;
              }
              return [...withoutTemp, data.message].slice(-60);
            });
            requestAnimationFrame(() => {
              if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
              }
            });
          } else if (data.type === "messages_read") {
            // Support specialist/admin read customer message -> turn double ticks blue!
            setMessages((prev) =>
              prev.map((m) =>
                m.sender_type === "customer" && !m.read_at
                  ? { ...m, read_at: data.read_at || new Date().toISOString() }
                  : m
              )
            );
          }
        } catch {}
      };
    } catch {}

    // Fallback timer (5s) for background ticket status sync
    const liveTimer = setInterval(() => {
      if (document.hidden) return;
      loadTicketDetail(selectedTicketId, 1, false, true);
    }, 5000);

    return () => {
      if (es) es.close();
      clearInterval(liveTimer);
    };
  }, [selectedTicketId, activeTab, effectiveSiteId]);

  // Scroll chat messages container down when changing tickets
  const lastTicketIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    if (selectedTicketId !== lastTicketIdRef.current) {
      lastTicketIdRef.current = selectedTicketId;
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [selectedTicketId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if ((!trimmed && !chatImage) || !selectedTicketId || !effectiveSiteId) return;

    setSendingReply(true);
    const tempId = `temp_${Date.now()}`;
    const previousReply = replyText;
    const currentChatImage = chatImage;

    // Optimistically show message immediately so the UI is responsive with zero lag and zero refresh
    const optimisticAttachments = currentChatImage ? [currentChatImage.previewUrl] : [];
    const optimisticMsg = {
      id: tempId,
      sender_type: "customer",
      sender_name: "You",
      message: trimmed || (optimisticAttachments.length > 0 ? "Attached photo" : ""),
      attachments: optimisticAttachments,
      created_at: new Date().toISOString(),
    };

    setMessages((prev: any[]) => [...prev, optimisticMsg].slice(-60));
    setReplyText("");
    setChatImage(null);

    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });

    try {
      let attachmentUrls: string[] = [];
      if (currentChatImage) {
        setUploadingChatImage(true);
        const uploadedUrl = await uploadFileToSupport(currentChatImage.file);
        attachmentUrls.push(uploadedUrl);
      }

      const res = await fetch(
        `${API_BASE_URL}/sites/${effectiveSiteId}/support/tickets/${selectedTicketId}/messages`,
        {
          method: "POST",
          headers: getCustomerAuthHeaders(effectiveSiteId, { "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({
            message: trimmed || (attachmentUrls.length > 0 ? "Attached photo" : ""),
            attachments: attachmentUrls,
          }),
        }
      );
      if (res.ok) {
        const resData = await res.json().catch(() => null);
        if (currentChatImage) {
          URL.revokeObjectURL(currentChatImage.previewUrl);
        }
        // Instantly swap optimistic temp message with confirmed server message in-place
        if (resData?.message) {
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempId);
            if (withoutTemp.some((m) => m.id === resData.message.id)) {
              return withoutTemp;
            }
            return [...withoutTemp, resData.message].slice(-60);
          });
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }

        ticketsLRUCache.current.clear();
        await loadTicketDetail(selectedTicketId, 1, false, true);
        await loadTickets(1, false, true);
      } else {
        // Rollback optimistic update
        setMessages((prev: any[]) => prev.filter((m: any) => m.id !== tempId));
        setReplyText(previousReply);
        setChatImage(currentChatImage);
        const err = await res.json().catch(() => null);
        alert(err?.detail || "Failed to send message.");
      }
    } catch (err: any) {
      // Rollback optimistic update
      setMessages((prev: any[]) => prev.filter((m: any) => m.id !== tempId));
      setReplyText(previousReply);
      setChatImage(currentChatImage);
      alert(err.message || "Failed to send message.");
    } finally {
      setSendingReply(false);
      setUploadingChatImage(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicketId || !effectiveSiteId) return;
    if (!window.confirm("Mark this issue as resolved and close the ticket?")) return;

    setClosingTicket(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${effectiveSiteId}/support/tickets/${selectedTicketId}/close`,
        {
          method: "POST",
          headers: getCustomerAuthHeaders(effectiveSiteId, { "Content-Type": "application/json" }),
          credentials: "include",
        }
      );
      if (res.ok) {
        setToastMessage("Ticket marked as resolved.");
        setTimeout(() => setToastMessage(null), 3000);
        ticketsLRUCache.current.clear();
        await loadTicketDetail(selectedTicketId, 1, false, true);
        await loadTickets(1, false, true);
      }
    } catch {
      // silent
    } finally {
      setClosingTicket(false);
    }
  };

  const handleSubmitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!message.trim()) {
      setSubmitError("Please describe your issue.");
      return;
    }

    const categoryObj = CATEGORIES.find((c) => c.id === selectedCategory);
    const finalSubject =
      subject.trim() ||
      `${categoryObj?.label || "Support Request"}${
        selectedOrderItem
          ? ` - ${selectedOrderItem.product_name}`
          : selectedOrderId
          ? ` (Order #${selectedOrderId.slice(0, 8)})`
          : ""
      }`;

    const orderItemsSummary = selectedOrderItem
      ? {
          product_id: selectedOrderItem.product_id,
          product_name: selectedOrderItem.product_name,
          variant_title: selectedOrderItem.variant_title || null,
          quantity: selectedOrderItem.quantity || 1,
          price: selectedOrderItem.unit_price || selectedOrderItem.line_total || 0,
          image_url: selectedOrderItem.product_image || selectedOrderItem.image_url || null,
        }
      : null;

    setSubmitting(true);
    try {
      let attachments: string[] = [];
      if (newRequestImage) {
        setUploadingNewRequestImage(true);
        const uploadedUrl = await uploadFileToSupport(newRequestImage.file);
        attachments.push(uploadedUrl);
      }

      const payload: any = {
        order_id: selectedOrderId || null,
        category: selectedCategory,
        priority: "normal",
        subject: finalSubject,
        message: message.trim(),
        attachments,
        order_items_summary: orderItemsSummary,
      };

      const res = await fetch(`${API_BASE_URL}/sites/${effectiveSiteId}/support/tickets`, {
        method: "POST",
        headers: getCustomerAuthHeaders(effectiveSiteId, { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to submit support request");
      }

      setSubject("");
      setMessage("");
      if (newRequestImage) {
        URL.revokeObjectURL(newRequestImage.previewUrl);
        setNewRequestImage(null);
      }
      setSelectedOrderId("");
      setSelectedOrderItemId("");
      setToastMessage(`Request #${data.ticket.ticket_number} created successfully.`);
      setTimeout(() => setToastMessage(null), 3500);

      ticketsLRUCache.current.clear();
      await loadTickets(1, false);
      setSelectedTicketId(data.ticket.id);
      if (isMobile) {
        setMobileChatOpen(true);
      }
      setActiveTab("inquiries");
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
      setUploadingNewRequestImage(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 120px)",
        background: primaryBg,
        color: textColor,
        padding: isMobile ? "16px 12px 36px" : "24px 20px 48px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <style>{`
        @keyframes dropdownFadeIn {
          0% {
            opacity: 0;
            transform: translateY(-6px) scale(0.99);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      <div
        style={{
          width: "100%",
          maxWidth: resolvedMaxWidth,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: "fixed",
              top: "24px",
              right: "24px",
              zIndex: 9999,
              padding: "10px 16px",
              borderRadius: buttonRadius,
              background: "#16a34a",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
              maxWidth: "380px",
            }}
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Clean Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            width: "100%",
          }}
        >
          {/* Breadcrumb */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: textMuted,
              fontWeight: 500,
            }}
          >
            <span
              onClick={() => {
                const path = window.location.pathname;
                if (path.startsWith("/builder/")) {
                  const segments = path.split("/").filter(Boolean);
                  const currentSiteId = segments[1] || effectiveSiteId;
                  navigate(`/builder/${currentSiteId}`);
                } else if (activeSlug) {
                  navigate(`/store/${activeSlug}`);
                } else if (effectiveSiteId) {
                  navigate(`/builder/${effectiveSiteId}`);
                } else {
                  navigate("/");
                }
              }}
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                color: textMuted,
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textMuted)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Store</span>
            </span>
            <span>/</span>
            <span style={{ color: textColor, fontWeight: 700 }}>Customer Support</span>
          </div>

          {/* Navigation Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab("inquiries");
                setMobileChatOpen(false);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 14px",
                borderRadius: buttonRadius,
                border: activeTab === "inquiries" ? `1.5px solid ${accentColor}` : `1px solid ${borderColor}`,
                background: activeTab === "inquiries" ? `${accentColor}14` : cardBg,
                color: activeTab === "inquiries" ? accentColor : textMuted,
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {inquiriesTabLabel} {tickets.length > 0 && `(${tickets.length})`}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("new");
                setMobileChatOpen(false);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 14px",
                borderRadius: buttonRadius,
                border: activeTab === "new" ? `1.5px solid ${accentColor}` : `1px solid ${borderColor}`,
                background: activeTab === "new" ? `${accentColor}14` : cardBg,
                color: activeTab === "new" ? accentColor : textMuted,
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {newRequestTabLabel}
            </button>
          </div>
        </div>

        {/* TAB 1: INQUIRIES & CHAT */}
        {activeTab === "inquiries" && (
          <div
            style={{
              background: cardBg,
              borderRadius: cardRadius,
              border: `1px solid ${borderColor}`,
              padding: cardPadding,
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div
              style={{
                display: isMobile ? "flex" : "grid",
                flexDirection: isMobile ? "column" : undefined,
                gridTemplateColumns: isMobile ? undefined : "320px 1fr",
                gap: "14px",
                minHeight: isMobile ? "auto" : "560px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {/* Left Sidebar: Tickets List */}
              {(!isMobile || !mobileChatOpen) && (
                <div
                  style={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: chatRadius,
                    background: chatBg,
                    display: "flex",
                    flexDirection: "column",
                    width: isMobile ? "100%" : undefined,
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 14px",
                      borderBottom: `1px solid ${borderColor}`,
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: textMuted,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Your Support Requests</span>
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>{ticketsTotalCount || tickets.length} total</span>
                  </div>

                  <div
                    onScroll={handleTicketsScroll}
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "8px",
                      maxHeight: isMobile ? "65vh" : "500px",
                    }}
                  >
                    {ticketsLoading && tickets.length === 0 ? (
                      <div style={{ padding: "30px", textAlign: "center", fontSize: "12.5px", color: textMuted }}>
                        Loading tickets...
                      </div>
                    ) : tickets.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: textColor, marginBottom: "4px" }}>
                          No support tickets
                        </div>
                        <p style={{ fontSize: "12px", color: textMuted, margin: "0 0 14px" }}>
                          You have not opened any inquiries for this store yet.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("new")}
                          style={{
                            padding: "7px 14px",
                            borderRadius: buttonRadius,
                            border: "none",
                            background: accentColor,
                            color: buttonTextColor,
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Open New Request
                        </button>
                      </div>
                    ) : (
                      <>
                        {tickets.map((t) => {
                          const isSelected = t.id === selectedTicketId;
                          const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedTicketId(t.id);
                                if (isMobile) {
                                  setMobileChatOpen(true);
                                }
                              }}
                              style={{
                                padding: "10px 12px",
                                borderRadius: innerRadius,
                                marginBottom: "6px",
                                cursor: "pointer",
                                background: isSelected && !isMobile ? surfaceBg : "transparent",
                                border: isSelected && !isMobile ? `1.5px solid ${accentColor}50` : `1px solid ${borderColor}`,
                                transition: "all 0.12s ease",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                                <span style={{ fontSize: "11.5px", fontWeight: 800, color: accentColor, fontFamily: "monospace" }}>
                                  #{t.ticket_number}
                                </span>
                                <span
                                  style={{
                                    fontSize: "9.5px",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: badgeRadius,
                                    background: st.bg,
                                    color: st.text,
                                    border: `1px solid ${st.border}`,
                                  }}
                                >
                                  {st.label}
                                </span>
                              </div>

                              <div
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  color: textColor,
                                  marginBottom: "3px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {t.subject}
                              </div>

                              {t.order_items_summary && (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: accentColor,
                                    background: `${accentColor}10`,
                                    border: `1px solid ${accentColor}25`,
                                    padding: "1px 5px",
                                    borderRadius: badgeRadius,
                                    marginBottom: "3px",
                                    maxWidth: "100%",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {t.order_items_summary.product_name}
                                  </span>
                                </div>
                              )}

                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: textMuted }}>
                                <span>{t.order_id ? `Order #${t.order_id.slice(0, 8)}` : "General"}</span>
                                <span>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}</span>
                              </div>
                            </div>
                          );
                        })}

                        {ticketsLoadingMore && (
                          <div style={{ padding: "8px", textAlign: "center", fontSize: "11px", color: textMuted }}>
                            Loading more requests...
                          </div>
                        )}

                        {ticketsPage < ticketsTotalPages && tickets.length > 0 && !ticketsLoadingMore && (
                          <div style={{ padding: "6px", textAlign: "center", fontSize: "10px", color: textMuted }}>
                            Showing {tickets.length} of {ticketsTotalCount || tickets.length} — scroll for more
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Right Pane: Conversation */}
              {(!isMobile || mobileChatOpen) && (
                <div
                  style={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: chatRadius,
                    background: chatBg,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                >
                  {selectedTicketId && ticketDetail ? (
                    <>
                      {/* Active Ticket Header */}
                      <div
                        style={{
                          padding: "12px 16px",
                          borderBottom: `1px solid ${borderColor}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          {isMobile && (
                            <button
                              type="button"
                              onClick={() => setMobileChatOpen(false)}
                              style={{
                                background: "none",
                                border: "none",
                                color: textMuted,
                                cursor: "pointer",
                                padding: "4px",
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12" />
                                <polyline points="12 19 5 12 12 5" />
                              </svg>
                            </button>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "12px", fontWeight: 800, color: accentColor, fontFamily: "monospace" }}>
                                #{ticketDetail.ticket_number}
                              </span>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: textColor }}>
                                {ticketDetail.subject}
                              </span>
                            </div>
                            <div style={{ fontSize: "11px", color: textMuted, marginTop: "2px" }}>
                              Category: {ticketDetail.category ? ticketDetail.category.replace(/_/g, " ") : "General"}
                              {ticketDetail.order_id && ` • Order #${ticketDetail.order_id.slice(0, 8)}`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={async () => {
                              if (selectedTicketId) {
                                await loadTicketDetail(selectedTicketId, 1, false, true);
                                await loadTickets(1, false, true);
                                setToastMessage("Thread refreshed");
                                setTimeout(() => setToastMessage(null), 2000);
                              }
                            }}
                            title="Refresh messages"
                            style={{
                              padding: "4px 8px",
                              borderRadius: buttonRadius,
                              border: `1px solid ${borderColor}`,
                              background: surfaceBg,
                              color: textMuted,
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                            <span>Refresh</span>
                          </button>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: badgeRadius,
                              background: (STATUS_CONFIG[ticketDetail.status] || STATUS_CONFIG.open).bg,
                              color: (STATUS_CONFIG[ticketDetail.status] || STATUS_CONFIG.open).text,
                              border: `1px solid ${(STATUS_CONFIG[ticketDetail.status] || STATUS_CONFIG.open).border}`,
                            }}
                          >
                            {(STATUS_CONFIG[ticketDetail.status] || STATUS_CONFIG.open).label}
                          </span>
                          {ticketDetail.status !== "resolved" && ticketDetail.status !== "closed" && (
                            <button
                              type="button"
                              onClick={handleCloseTicket}
                              disabled={closingTicket}
                              style={{
                                padding: "4px 10px",
                                borderRadius: buttonRadius,
                                border: `1px solid ${borderColor}`,
                                background: surfaceBg,
                                color: textMuted,
                                fontSize: "11.5px",
                                fontWeight: 600,
                                cursor: closingTicket ? "not-allowed" : "pointer",
                              }}
                            >
                              {closingTicket ? "Closing..." : "Close Ticket"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Messages Scroll Area */}
                      <div
                        ref={chatContainerRef}
                        onScroll={handleChatScroll}
                        style={{
                          flex: 1,
                          overflowY: "auto",
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          maxHeight: isMobile ? "50vh" : "380px",
                          minHeight: "220px",
                        }}
                      >
                        {/* Older messages indicator / button */}
                        {hasMoreOlderMessages && (
                          <div
                            onClick={() => {
                              if (!chatLoading && !messagesLoadingOlder && selectedTicketId) {
                                loadTicketDetail(selectedTicketId, messagesPage + 1, true, false);
                              }
                            }}
                            style={{
                              padding: "6px 14px",
                              textAlign: "center",
                              fontSize: "11px",
                              color: accentColor,
                              background: `${accentColor}12`,
                              borderRadius: innerRadius,
                              cursor: messagesLoadingOlder ? "default" : "pointer",
                              alignSelf: "center",
                              margin: "0 auto 4px",
                              border: `1px solid ${accentColor}25`,
                              fontWeight: 600,
                              userSelect: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {messagesLoadingOlder ? (
                              <span>Loading older messages...</span>
                            ) : (
                              <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="18 15 12 9 6 15" />
                                </svg>
                                <span>Load older messages (scroll up)</span>
                              </>
                            )}
                          </div>
                        )}

                        {chatLoading && messages.length === 0 ? (
                          <div style={{ padding: "30px", textAlign: "center", color: textMuted, fontSize: "12.5px" }}>
                            Loading messages...
                          </div>
                        ) : messages.length === 0 ? (
                          <div style={{ padding: "30px", textAlign: "center", color: textMuted, fontSize: "12.5px" }}>
                            No messages in this inquiry yet.
                          </div>
                        ) : (
                          messages.map((m) => {
                            const isCustomer = m.sender_type === "customer";
                            return (
                              <div
                                key={m.id || m.created_at}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: isCustomer ? "flex-end" : "flex-start",
                                  maxWidth: "85%",
                                  alignSelf: isCustomer ? "flex-end" : "flex-start",
                                }}
                              >
                                <div style={{ fontSize: "10.5px", color: textMuted, marginBottom: "3px", padding: "0 4px", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <span>{isCustomer ? "You" : m.sender_name || "Support Specialist"}</span>
                                  <span>•</span>
                                  <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                  {isCustomer && (
                                    <MessageStatusTick
                                      isSending={String(m.id || "").startsWith("temp_")}
                                      readAt={m.read_at}
                                      isCustomerBubble={true}
                                    />
                                  )}
                                </div>
                                <div
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: bubbleRadius,
                                    background: isCustomer ? customerBubbleBg : agentBubbleBg,
                                    color: isCustomer ? customerBubbleText : agentBubbleText,
                                    fontSize: "13px",
                                    lineHeight: "1.45",
                                    border: isCustomer ? "none" : `1px solid ${borderColor}`,
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {(() => {
                                    const parsed = parseMessageWithMedia(m.message, m.attachments);
                                    const allImages = Array.from(
                                      new Set([
                                        ...(m.attachments || []).map(resolveMediaUrl),
                                        ...parsed.inlineImages,
                                      ])
                                    );

                                    return (
                                      <>
                                        {parsed.cleanText && <div>{parsed.cleanText}</div>}
                                        {allImages.length > 0 && (
                                          <div
                                            style={{
                                              marginTop: parsed.cleanText ? "8px" : "0",
                                              display: "flex",
                                              gap: "8px",
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            {allImages.map((url: string, i: number) => (
                                              <AdaptiveSupportImage
                                                key={i}
                                                src={url}
                                                alt="Attachment"
                                                isStaff={!isCustomer}
                                                onClickZoom={(zoomUrl) => setActiveZoomPhoto(zoomUrl)}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Photo Attachment Strip */}
                      {chatImage && (
                        <div
                          style={{
                            padding: "8px 14px",
                            background: surfaceBg,
                            borderTop: `1px solid ${borderColor}`,
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <img
                            src={chatImage.previewUrl}
                            alt=""
                            style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover" }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "11.5px", fontWeight: 600, color: textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {chatImage.file.name}
                            </div>
                            <div style={{ fontSize: "10px", color: textMuted }}>
                              {(chatImage.file.size / 1024).toFixed(0)} KB • Ready to send
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(chatImage.previewUrl);
                              setChatImage(null);
                            }}
                            style={{ background: "none", border: "none", color: textMuted, cursor: "pointer", padding: "4px" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Message Input */}
                      <form
                        onSubmit={handleSendReply}
                        style={{
                          padding: "10px 14px",
                          borderTop: `1px solid ${borderColor}`,
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="file"
                          ref={chatFileInputRef}
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const rawFile = e.target.files?.[0];
                            if (rawFile) {
                              const file = await compressImageFile(rawFile, 1600, 1600, 0.82);
                              const previewUrl = URL.createObjectURL(file);
                              setChatImage({ file, previewUrl });
                            }
                            e.target.value = "";
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => chatFileInputRef.current?.click()}
                          disabled={sendingReply || ticketDetail.status === "closed"}
                          title="Attach image"
                          style={{
                            padding: "8px",
                            borderRadius: buttonRadius,
                            border: `1px solid ${borderColor}`,
                            background: chatImage ? `${accentColor}18` : surfaceBg,
                            color: chatImage ? accentColor : textMuted,
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </button>

                        <input
                          type="text"
                          placeholder={chatImage ? "Add an optional caption..." : "Type your message..."}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onPaste={handlePasteImage}
                          disabled={sendingReply || ticketDetail.status === "closed"}
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: inputRadius,
                            border: `1px solid ${inputBorder}`,
                            background: inputBg,
                            color: inputTextColor,
                            fontSize: "13px",
                            outline: "none",
                          }}
                        />

                        <button
                          type="submit"
                          disabled={sendingReply || (!replyText.trim() && !chatImage)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: buttonRadius,
                            border: "none",
                            background: accentColor,
                            color: buttonTextColor,
                            fontSize: "12.5px",
                            fontWeight: 700,
                            cursor: sendingReply || (!replyText.trim() && !chatImage) ? "not-allowed" : "pointer",
                            opacity: !replyText.trim() && !chatImage ? 0.6 : 1,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            flexShrink: 0,
                          }}
                        >
                          <span>{sendingReply ? "Sending..." : "Send"}</span>
                        </button>
                      </form>
                    </>
                  ) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "30px", textAlign: "center" }}>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: textColor, marginBottom: "3px" }}>
                          Select an Inquiry
                        </div>
                        <div style={{ fontSize: "12px", color: textMuted }}>
                          Choose any ticket on the left to view details and chat.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: NEW REQUEST FORM (Clean & Organized) */}
        {activeTab === "new" && (
          <div
            style={{
              background: cardBg,
              borderRadius: cardRadius,
              border: `1px solid ${borderColor}`,
              padding: cardPadding,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ marginBottom: "18px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 800, color: textColor }}>
                Open a Support Request
              </h2>
              <p style={{ margin: 0, fontSize: "12.5px", color: textMuted }}>
                Fill in the details below and our team will get back to you promptly.
              </p>
            </div>

            {submitError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: buttonRadius,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#dc2626",
                  fontSize: "12.5px",
                  marginBottom: "16px",
                }}
              >
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmitNewRequest} style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
              {/* Order & Product Selection Row */}
              {allowOrderSelection && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : selectedOrderId ? "1fr 1fr" : "1fr",
                    gap: "14px",
                    width: "100%",
                  }}
                >
                  {/* Order Selector */}
                  <div ref={orderDropdownRef} style={{ position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label style={{ fontSize: "12.5px", fontWeight: 700, color: textColor }}>
                        Relates to Order (Optional)
                      </label>
                      {selectedOrderId && (
                        <button
                          type="button"
                          onClick={() => {
                            handleOrderSelect("");
                            setOrderDropdownOpen(false);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: accentColor,
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "2px 4px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          <span>Clear order</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOrderDropdownOpen((prev) => !prev);
                        setItemDropdownOpen(false);
                        setCategoryDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        minHeight: "44px",
                        padding: "8px 12px",
                        borderRadius: inputRadius,
                        border: orderDropdownOpen
                          ? `1.5px solid ${accentColor}`
                          : selectedOrderId
                          ? `1.5px solid ${accentColor}80`
                          : `1px solid ${inputBorder}`,
                        background: inputBg,
                        color: inputTextColor,
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        cursor: "pointer",
                        textAlign: "left",
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "6px",
                            background: selectedOrderId ? `${accentColor}18` : surfaceBg,
                            border: `1px solid ${selectedOrderId ? `${accentColor}35` : borderColor}`,
                            display: "grid",
                            placeItems: "center",
                            color: selectedOrderId ? accentColor : textMuted,
                            flexShrink: 0,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                          </svg>
                        </div>
                        {activeOrder ? (
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: textColor, fontFamily: "monospace", fontSize: "12.5px" }}>
                                #{activeOrder.id.slice(0, 8)}
                              </span>
                              <span
                                style={{
                                  fontSize: "9px",
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: "100px",
                                  background: `${accentColor}15`,
                                  color: accentColor,
                                  textTransform: "capitalize",
                                }}
                              >
                                {activeOrder.status ? activeOrder.status.replace(/_/g, " ") : "Placed"}
                              </span>
                              <span style={{ fontSize: "11px", color: textMuted }}>• ₹{activeOrder.total || 0}</span>
                            </div>
                            {activeOrder.created_at && (
                              <div style={{ fontSize: "11px", color: textMuted, marginTop: "1px" }}>
                                Placed on {formatOrderDate(activeOrder.created_at)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: "12.5px", color: textMuted }}>
                            General Inquiry (No specific order)
                          </div>
                        )}
                      </div>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={textMuted}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          transform: orderDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {/* Order Dropdown Popover with Infinite Scroll */}
                    {orderDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          right: 0,
                          background: cardBg,
                          border: `1px solid ${borderColor}`,
                          borderRadius: cardRadius,
                          boxShadow: "0 12px 28px rgba(0, 0, 0, 0.2)",
                          zIndex: 100,
                          display: "flex",
                          flexDirection: "column",
                          animation: "dropdownFadeIn 0.15s ease",
                          overflow: "hidden",
                        }}
                      >
                        {/* Scrollable Orders Area */}
                        <div
                          onScroll={handleOrderDropdownScroll}
                          style={{
                            maxHeight: "260px",
                            overflowY: "auto",
                            padding: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          {/* Option 0: General inquiry */}
                          <div
                            onClick={() => {
                              handleOrderSelect("");
                              setOrderDropdownOpen(false);
                            }}
                            style={{
                              padding: "8px 10px",
                              borderRadius: innerRadius,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background: !selectedOrderId ? `${accentColor}14` : "transparent",
                              color: textColor,
                              fontSize: "12.5px",
                            }}
                          >
                            <span>General Inquiry (No specific order)</span>
                            {!selectedOrderId && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>

                          {ordersLoading && orders.length === 0 ? (
                            <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: textMuted }}>
                              Loading recent orders...
                            </div>
                          ) : orders.length === 0 ? (
                            <div style={{ padding: "14px 10px", textAlign: "center", fontSize: "12px", color: textMuted }}>
                              No past orders found for this customer account.
                            </div>
                          ) : (
                            orders.map((ord) => {
                              const isSelected = String(ord.id) === String(selectedOrderId);
                              const itemsCount = Array.isArray(ord.items) ? ord.items.length : 1;
                              const orderDate = formatOrderDate(ord.created_at);
                              return (
                                <div
                                  key={ord.id}
                                  onClick={() => {
                                    handleOrderSelect(ord.id);
                                    setOrderDropdownOpen(false);
                                  }}
                                  style={{
                                    padding: "8px 10px",
                                    borderRadius: innerRadius,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "8px",
                                    background: isSelected ? `${accentColor}14` : "transparent",
                                    color: textColor,
                                    fontSize: "12.5px",
                                    border: isSelected ? `1px solid ${accentColor}35` : "1px solid transparent",
                                    transition: "all 0.12s ease",
                                  }}
                                >
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>#{ord.id.slice(0, 8)}</span>
                                      <span
                                        style={{
                                          fontSize: "8.5px",
                                          fontWeight: 700,
                                          padding: "0.5px 4px",
                                          borderRadius: "4px",
                                          background: `${accentColor}15`,
                                          color: accentColor,
                                          textTransform: "capitalize",
                                        }}
                                      >
                                        {ord.status ? ord.status.replace(/_/g, " ") : "Placed"}
                                      </span>
                                      <span style={{ fontSize: "11px", fontWeight: 600 }}>₹{ord.total || 0}</span>
                                    </div>
                                    <div style={{ fontSize: "10.5px", color: textMuted, marginTop: "2px", display: "flex", gap: "6px" }}>
                                      {orderDate && <span>Placed {orderDate}</span>}
                                      <span>•</span>
                                      <span>{itemsCount} {itemsCount === 1 ? "item" : "items"}</span>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </div>
                              );
                            })
                          )}

                          {ordersLoadingMore && (
                            <div style={{ padding: "8px", textAlign: "center", fontSize: "11px", color: textMuted }}>
                              Loading more orders...
                            </div>
                          )}
                        </div>

                        {/* Subtle scroll hint footer */}
                        {ordersPage < ordersTotalPages && orders.length > 0 && (
                          <div
                            style={{
                              padding: "5px 8px",
                              borderTop: `1px solid ${borderColor}`,
                              background: surfaceBg,
                              textAlign: "center",
                              fontSize: "10px",
                              color: textMuted,
                              fontWeight: 500,
                            }}
                          >
                            Showing {orders.length} of {ordersTotalCount || orders.length} — scroll for more
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Product Selector (Visible when order chosen) */}
                  {selectedOrderId && (
                    <div ref={itemDropdownRef} style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <label style={{ fontSize: "12.5px", fontWeight: 700, color: textColor }}>
                          Select Product
                        </label>
                        {selectedOrderItemId && (
                          <button
                            type="button"
                            onClick={() => {
                              handleOrderItemSelect("");
                              setItemDropdownOpen(false);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: accentColor,
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: "2px 4px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            <span>Entire order</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setItemDropdownOpen((prev) => !prev);
                          setOrderDropdownOpen(false);
                          setCategoryDropdownOpen(false);
                        }}
                        style={{
                          width: "100%",
                          minHeight: "42px",
                          padding: "8px 12px",
                          borderRadius: inputRadius,
                          border: itemDropdownOpen
                            ? `1.5px solid ${accentColor}`
                            : selectedOrderItem
                            ? `1.5px solid ${accentColor}80`
                            : `1px solid ${inputBorder}`,
                          background: inputBg,
                          color: inputTextColor,
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          cursor: "pointer",
                          textAlign: "left",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                          {selectedOrderItem ? (
                            <>
                              {selectedOrderItem.product_image || selectedOrderItem.image_url ? (
                                <img
                                  src={selectedOrderItem.product_image || selectedOrderItem.image_url}
                                  alt=""
                                  style={{ width: "26px", height: "26px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
                                />
                              ) : (
                                <div style={{ width: "26px", height: "26px", borderRadius: "4px", background: surfaceBg, display: "grid", placeItems: "center", color: textMuted }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                  </svg>
                                </div>
                              )}
                              <div style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12.5px", fontWeight: 700 }}>
                                {selectedOrderItem.product_name}
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: "12.5px", color: textMuted }}>Entire Order (All items)</span>
                          )}
                        </div>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={textMuted}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform: itemDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            flexShrink: 0,
                          }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {/* Product Popover */}
                      {itemDropdownOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            right: 0,
                            background: cardBg,
                            border: `1px solid ${borderColor}`,
                            borderRadius: cardRadius,
                            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.18)",
                            zIndex: 100,
                            maxHeight: "260px",
                            overflowY: "auto",
                            padding: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            animation: "dropdownFadeIn 0.15s ease",
                          }}
                        >
                          <div
                            onClick={() => {
                              handleOrderItemSelect("");
                              setItemDropdownOpen(false);
                            }}
                            style={{
                              padding: "8px 10px",
                              borderRadius: innerRadius,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background: !selectedOrderItemId ? `${accentColor}14` : "transparent",
                              color: textColor,
                              fontSize: "12.5px",
                            }}
                          >
                            <span>Entire Order (All items)</span>
                            {!selectedOrderItemId && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>

                          {activeOrderItems.map((it: any) => {
                            const itemId = String(it.id || it.order_item_id || it.product_id);
                            const isSelected = String(selectedOrderItemId) === itemId;
                            return (
                              <div
                                key={itemId}
                                onClick={() => {
                                  handleOrderItemSelect(itemId);
                                  setItemDropdownOpen(false);
                                }}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: innerRadius,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                  background: isSelected ? `${accentColor}14` : "transparent",
                                  color: textColor,
                                  fontSize: "12.5px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                                  {it.product_image || it.image_url ? (
                                    <img
                                      src={it.product_image || it.image_url}
                                      alt=""
                                      style={{ width: "24px", height: "24px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
                                    />
                                  ) : null}
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {it.product_name} {it.variant_title ? `(${it.variant_title})` : ""}
                                  </span>
                                </div>
                                {isSelected && (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Category & Subject Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: "14px",
                  width: "100%",
                }}
              >
                {/* Category Dropdown */}
                <div ref={categoryDropdownRef} style={{ position: "relative" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: textColor, marginBottom: "6px" }}>
                    Category *
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setCategoryDropdownOpen((prev) => !prev);
                      setOrderDropdownOpen(false);
                      setItemDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "8px 12px",
                      borderRadius: inputRadius,
                      border: categoryDropdownOpen ? `1.5px solid ${accentColor}` : `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      cursor: "pointer",
                      textAlign: "left",
                      boxSizing: "border-box",
                    }}
                  >
                    {(() => {
                      const cat = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                          <span style={{ color: accentColor, display: "grid", placeItems: "center" }}>
                            {renderCategoryIcon(selectedCategory, 15)}
                          </span>
                          <span style={{ fontWeight: 600, color: textColor, fontSize: "12.5px" }}>
                            {cat.label}
                          </span>
                        </div>
                      );
                    })()}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={textMuted}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: categoryDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        flexShrink: 0,
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Category Popover */}
                  {categoryDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        background: cardBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: cardRadius,
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.18)",
                        zIndex: 90,
                        maxHeight: "260px",
                        overflowY: "auto",
                        padding: "6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        animation: "dropdownFadeIn 0.15s ease",
                      }}
                    >
                      {CATEGORIES.map((cat) => {
                        const isSelected = cat.id === selectedCategory;
                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat.id);
                              setCategoryDropdownOpen(false);
                            }}
                            style={{
                              padding: "8px 10px",
                              borderRadius: innerRadius,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              background: isSelected ? `${accentColor}14` : "transparent",
                              color: textColor,
                              fontSize: "12.5px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ color: isSelected ? accentColor : textMuted }}>
                                {renderCategoryIcon(cat.id, 14)}
                              </span>
                              <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? accentColor : textColor }}>
                                {cat.label}
                              </span>
                            </div>
                            {isSelected && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Subject Input */}
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: textColor, marginBottom: "6px" }}>
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Brief summary of request"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: "42px",
                      padding: "8px 12px",
                      borderRadius: inputRadius,
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "13px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Details Textarea */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: textColor, marginBottom: "6px" }}>
                  Details *
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe your issue or query..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: inputRadius,
                    border: `1px solid ${inputBorder}`,
                    background: inputBg,
                    color: inputTextColor,
                    fontSize: "13px",
                    fontFamily: "inherit",
                    resize: "vertical",
                    boxSizing: "border-box",
                    outline: "none",
                    minHeight: "100px",
                  }}
                />
              </div>

              {/* Photo Upload Box (Upload Only - No text link) */}
              {allowAttachments && (
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: textColor, marginBottom: "6px" }}>
                    Attach Photo / Screenshot (Optional)
                  </label>

                  <input
                    type="file"
                    ref={newRequestFileInputRef}
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const rawFile = e.target.files?.[0];
                      if (rawFile) {
                        const file = await compressImageFile(rawFile, 1600, 1600, 0.82);
                        const previewUrl = URL.createObjectURL(file);
                        setNewRequestImage({ file, previewUrl });
                      }
                      e.target.value = "";
                    }}
                  />

                  {newRequestImage ? (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: surfaceBg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: inputRadius,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <img
                        src={newRequestImage.previewUrl}
                        alt=""
                        style={{ width: "42px", height: "42px", borderRadius: "6px", objectFit: "cover", cursor: "zoom-in" }}
                        onClick={() => setActiveZoomPhoto(newRequestImage.previewUrl)}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: textColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {newRequestImage.file.name}
                        </div>
                        <div style={{ fontSize: "11px", color: textMuted }}>
                          {(newRequestImage.file.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(newRequestImage.previewUrl);
                          setNewRequestImage(null);
                        }}
                        style={{
                          background: "transparent",
                          border: `1px solid ${borderColor}`,
                          borderRadius: "6px",
                          color: textMuted,
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => newRequestFileInputRef.current?.click()}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: inputRadius,
                        border: `1.5px dashed ${borderColor}`,
                        background: surfaceBg,
                        color: textMuted,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = borderColor)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>Click to upload image (JPG, PNG, WebP)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Submit & Contact Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "stretch" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  gap: "12px",
                  paddingTop: "4px",
                }}
              >
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "10px 24px",
                    borderRadius: buttonRadius,
                    border: "none",
                    background: accentColor,
                    color: buttonTextColor,
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                    textAlign: "center",
                  }}
                >
                  {submitting ? (uploadingNewRequestImage ? "Uploading Photo..." : "Submitting...") : submitButtonText}
                </button>

                {showContactInfo && (supportEmail || supportPhone || supportHours) && (
                  <div style={{ fontSize: "11.5px", color: textMuted, display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {supportEmail && <span>Email: <strong>{supportEmail}</strong></span>}
                    {supportPhone && <span>Phone: <strong>{supportPhone}</strong></span>}
                    {supportHours && <span>Hours: <strong>{supportHours}</strong></span>}
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Fullscreen Lightbox Zoom Modal */}
        <SupportImageZoomModal
          imageUrl={activeZoomPhoto}
          onClose={() => setActiveZoomPhoto(null)}
          title="Support Attachment Proof"
        />
      </div>
    </div>
  );
}
