import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { isColorDarkHex } from "../context/ThemeContext";
import { API_BASE_URL } from "../config/api";
import { getCustomerToken } from "../utils/customerAuthFetch";
import { resolveMobileDrawerTheme } from "../utils/mobileDrawerTheme";
import { useDrawerDragToClose } from "../utils/useDrawerDragToClose";

export interface CustomerNotificationItem {
  id: string;
  site_id?: string;
  siteId?: string;
  customer_id?: string;
  customerId?: string;
  event_type?: string;
  eventType?: string;
  category: "order" | "delivery" | "return" | "refund" | "support" | "account" | "general" | string;
  title: string;
  message: string;
  related_entity_type?: string;
  relatedEntityType?: string;
  related_entity_id?: string;
  relatedEntityId?: string;
  action_url?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  is_read?: boolean;
  isRead?: boolean;
  read_at?: string;
  readAt?: string;
  created_at?: string;
  createdAt?: string;
}

interface NotificationCenterProps {
  siteSlug?: string;
  siteId?: string;
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  isDark?: boolean;
  accentColor?: string;
  dialogBg?: string;
  borderColor?: string;
  onUnreadCountChange?: (count: number) => void;
  isMobile?: boolean;
  theme?: any;
}

function timeAgo(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  siteSlug,
  siteId,
  isOpen,
  onClose,
  anchorRef,
  isDark = false,
  accentColor = "#2563eb",
  dialogBg,
  borderColor,
  onUnreadCountChange,
  isMobile,
  theme,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useCustomerAuth();

  const [notifications, setNotifications] = useState<CustomerNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "order" | "return" | "support">("all");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const onUnreadRef = useRef(onUnreadCountChange);
  const lastCountRef = useRef<number>(-1);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const unreadAbortRef = useRef<AbortController | null>(null);

  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobileEffective = isMobile !== undefined ? isMobile : windowWidth < 768;

  const { dragHandleProps, drawerStyle, isDragging } = useDrawerDragToClose({
    onClose,
    isOpen: isOpen && isMobileEffective,
  });

  useEffect(() => {
    if (isOpen && isMobileEffective && typeof document !== "undefined") {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen, isMobileEffective]);

  useEffect(() => {
    onUnreadRef.current = onUnreadCountChange;
  }, [onUnreadCountChange]);

  const websiteIdentifier = siteSlug || siteId || "";

  const getAuthToken = useCallback((): string | null => {
    return (
      getCustomerToken(websiteIdentifier) ||
      localStorage.getItem("customerToken") ||
      localStorage.getItem("customer_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      null
    );
  }, [websiteIdentifier]);

  const fetchNotifications = useCallback(
    async (
      pageNum: number = 1,
      tab: "all" | "unread" | "order" | "return" | "support" = activeTab,
      isAppend: boolean = false
    ) => {
      if (!websiteIdentifier || !isAuthenticated) return;
      const token = getAuthToken();
      if (!token) return;

      if (!isAppend) {
        if (fetchAbortRef.current) fetchAbortRef.current.abort();
        const controller = new AbortController();
        fetchAbortRef.current = controller;
      }

      const filterParam = tab === "unread" ? "unread" : "all";
      const categoryParam =
        tab !== "all" && tab !== "unread" ? `&category=${tab}` : "";

      try {
        const resp = await fetch(
          `${API_BASE_URL}/notifications/customer/${websiteIdentifier}?page=${pageNum}&limit=10&filter=${filterParam}${categoryParam}`,
          {
            signal: isAppend ? undefined : fetchAbortRef.current?.signal,
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Customer-Token": token,
              "X-Site-Id": websiteIdentifier,
              "Content-Type": "application/json",
            },
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const items: CustomerNotificationItem[] = data.notifications || [];
          setNotifications((prev) => (isAppend ? [...prev, ...items] : items));
          setHasMore(Boolean(data.hasMore ?? data.has_more ?? items.length === 10));
          setPage(pageNum);

          const count =
            data.unread_count ??
            data.unreadCount ??
            data.total_unread ??
            data.totalUnread ??
            0;
          if (lastCountRef.current !== count) {
            lastCountRef.current = count;
            setUnreadCount(count);
            if (onUnreadRef.current) onUnreadRef.current(count);
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("Failed to fetch customer notifications:", err);
        }
      } finally {
        if (!isAppend && fetchAbortRef.current) {
          fetchAbortRef.current = null;
        }
      }
    },
    [websiteIdentifier, isAuthenticated, getAuthToken, activeTab]
  );

  const fetchUnreadCountOnly = useCallback(async () => {
    if (!websiteIdentifier || !isAuthenticated) return;
    const token = getAuthToken();
    if (!token) return;

    if (unreadAbortRef.current) unreadAbortRef.current.abort();
    const controller = new AbortController();
    unreadAbortRef.current = controller;

    try {
      const resp = await fetch(`${API_BASE_URL}/notifications/customer/${websiteIdentifier}/unread-count`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Customer-Token": token,
          "X-Site-Id": websiteIdentifier,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        const count = data.unread_count ?? data.unreadCount ?? 0;
        if (lastCountRef.current !== count) {
          lastCountRef.current = count;
          setUnreadCount(count);
          if (onUnreadRef.current) onUnreadRef.current(count);
        }
      }
    } catch {
      // Ignore background network jitter / aborted requests
    } finally {
      if (unreadAbortRef.current === controller) {
        unreadAbortRef.current = null;
      }
    }
  }, [websiteIdentifier, isAuthenticated, getAuthToken]);

  // Initial load and periodic 30s background polling
  useEffect(() => {
    if (!isAuthenticated || !websiteIdentifier) {
      setNotifications([]);
      setUnreadCount(0);
      lastCountRef.current = 0;
      return;
    }

    fetchUnreadCountOnly();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchUnreadCountOnly();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, websiteIdentifier, fetchUnreadCountOnly]);

  // Stable refs so event handlers always call the latest version without being deps
  const fetchUnreadCountOnlyRef = useRef(fetchUnreadCountOnly);
  const fetchNotificationsRef = useRef(fetchNotifications);
  const isOpenRef = useRef(isOpen);
  useEffect(() => { fetchUnreadCountOnlyRef.current = fetchUnreadCountOnly; }, [fetchUnreadCountOnly]);
  useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Cleanup pending timers and inflight requests on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
      if (unreadAbortRef.current) unreadAbortRef.current.abort();
    };
  }, []);

  // Listen for order-placed events so the badge and list refresh immediately.
  useEffect(() => {
    if (!isAuthenticated || !websiteIdentifier) return;

    const handleOrderPlaced = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      // Small delay so the backend notification is persisted before we query
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        fetchUnreadCountOnlyRef.current();
        if (isOpenRef.current) {
          setLoading(true);
          fetchNotificationsRef.current().finally(() => setLoading(false));
        }
      }, 1500);
    };

    window.addEventListener("wc_customer_notification_refresh", handleOrderPlaced);
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      window.removeEventListener("wc_customer_notification_refresh", handleOrderPlaced);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, websiteIdentifier]);

  // When panel opens or tab changes, fetch first page
  useEffect(() => {
    if (isOpen && isAuthenticated && websiteIdentifier) {
      setLoading(true);
      fetchNotifications(1, activeTab, false).finally(() => setLoading(false));
    }
  }, [isOpen, isAuthenticated, websiteIdentifier, activeTab, fetchNotifications]);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      if (hasMore && !loadingMore && !loading) {
        setLoadingMore(true);
        fetchNotifications(page + 1, activeTab, true).finally(() => setLoadingMore(false));
      }
    }
  };

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  const handleMarkAsRead = async (notifId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const token = getAuthToken();
    if (!token || !websiteIdentifier) return;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true, isRead: true, read_at: new Date().toISOString() } : n))
    );
    const newCount = Math.max(0, unreadCount - 1);
    lastCountRef.current = newCount;
    setUnreadCount(newCount);
    if (onUnreadRef.current) onUnreadRef.current(newCount);

    try {
      await fetch(`${API_BASE_URL}/notifications/customer/${websiteIdentifier}/${notifId}/read`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Customer-Token": token,
          "Content-Type": "application/json",
        },
      });
      window.dispatchEvent(
        new CustomEvent("wc_customer_notification_refresh", {
          detail: { action: "read", notifId },
        })
      );
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const token = getAuthToken();
    if (!token || !websiteIdentifier || unreadCount === 0) return;

    setMarkingAll(true);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, isRead: true, read_at: new Date().toISOString() }))
    );
    lastCountRef.current = 0;
    setUnreadCount(0);
    if (onUnreadRef.current) onUnreadRef.current(0);

    try {
      await fetch(`${API_BASE_URL}/notifications/customer/${websiteIdentifier}/mark-all-read`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Customer-Token": token,
          "Content-Type": "application/json",
        },
      });
      window.dispatchEvent(
        new CustomEvent("wc_customer_notification_refresh", {
          detail: { action: "mark_all_read" },
        })
      );
    } catch (err) {
      console.warn("Failed to mark all notifications as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = (item: CustomerNotificationItem) => {
    const isRead = Boolean(item.is_read ?? item.isRead);
    if (!isRead) {
      handleMarkAsRead(item.id);
    }
    onClose();

    const actionUrl = item.action_url || item.actionUrl;
    const relId = item.related_entity_id || item.relatedEntityId;
    const meta = item.metadata || {};
    const orderId = meta.orderId || meta.order_id || (item.category === "order" ? relId : null);
    const returnId = meta.returnRequestId || meta.return_id || (item.category === "return" || item.related_entity_type === "return_request" ? relId : null);
    const ticketId = meta.ticketId || meta.ticket_id || meta.ticketNumber || (item.category === "support" || item.related_entity_type === "support_ticket" ? relId : null);

    if (actionUrl) {
      if (actionUrl.startsWith("http://") || actionUrl.startsWith("https://")) {
        window.location.href = actionUrl;
      } else {
        let finalUrl = actionUrl;
        if (item.category === "return" || item.related_entity_type === "return_request") {
          if (!finalUrl.includes("tab=returns")) {
            finalUrl += (finalUrl.includes("?") ? "&" : "?") + "tab=returns";
          }
          if (returnId && !finalUrl.includes("returnId=")) {
            finalUrl += `&returnId=${returnId}`;
          }
        } else if (item.category === "support" || item.related_entity_type === "support_ticket" || finalUrl.includes("/support")) {
          if (!finalUrl.includes("tab=inquiries") && !finalUrl.includes("tab=new")) {
            finalUrl += (finalUrl.includes("?") ? "&" : "?") + "tab=inquiries";
          }
          if (ticketId && !finalUrl.includes("ticketId=") && !finalUrl.includes("ticket_id=")) {
            finalUrl += (finalUrl.includes("?") ? "&" : "?") + `ticketId=${ticketId}`;
          }
        }
        navigate(finalUrl);
      }
    } else if (item.category === "order" && (orderId || relId)) {
      navigate(`/store/${websiteIdentifier}/orders?orderId=${orderId || relId}`);
    } else if (item.category === "return" || item.related_entity_type === "return_request") {
      const targetOrderId = orderId || meta.orderId || meta.order_id;
      const targetReturnId = returnId || relId;
      let url = `/store/${websiteIdentifier}/orders?tab=returns`;
      if (targetOrderId) url += `&orderId=${targetOrderId}`;
      if (targetReturnId) url += `&returnId=${targetReturnId}`;
      navigate(url);
    } else if (item.category === "support" || item.related_entity_type === "support_ticket" || ticketId) {
      const targetTicketId = ticketId || relId;
      let url = `/store/${websiteIdentifier}/support?tab=inquiries`;
      if (targetTicketId) url += `&ticketId=${targetTicketId}`;
      navigate(url);
    } else {
      navigate(`/store/${websiteIdentifier}/orders`);
    }
  };

  if (!isOpen) return null;

  // Filter items
  const filteredNotifications = notifications.filter((item) => {
    const isRead = Boolean(item.is_read ?? item.isRead);
    if (activeTab === "unread") return !isRead;
    if (activeTab === "order") return item.category === "order" || item.category === "delivery";
    if (activeTab === "return") return item.category === "return" || item.category === "refund";
    if (activeTab === "support") return item.category === "support";
    return true;
  });

  const mobileDrawerTheme = resolveMobileDrawerTheme(
    theme || { isDark, accentColor, dialogBg, borderColor }
  );

  const resolvedBg = isMobileEffective
    ? mobileDrawerTheme.drawerBg
    : (dialogBg || (isDark ? "#0f172a" : "#ffffff"));
  const isPanelDark = isMobileEffective
    ? mobileDrawerTheme.isDark
    : (isDark !== undefined ? isDark : isColorDarkHex(resolvedBg));
  const resolvedBorder = isMobileEffective
    ? mobileDrawerTheme.drawerBorder
    : (borderColor || (isPanelDark ? "#1e293b" : "#e2e8f0"));
  const textColor = isMobileEffective
    ? mobileDrawerTheme.textPrimary
    : (isPanelDark ? "#f8fafc" : "#0f172a");
  const mutedTextColor = isMobileEffective
    ? mobileDrawerTheme.textSecondary
    : (isPanelDark ? "#94a3b8" : "#64748b");
  const cardBorder = isMobileEffective
    ? mobileDrawerTheme.cardBorder
    : (isPanelDark ? "rgba(255,255,255,0.06)" : "#f1f5f9");
  const effectiveAccent = isMobileEffective
    ? mobileDrawerTheme.accentColor
    : (accentColor || "#2563eb");

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "order":
        return (
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: isPanelDark ? `${effectiveAccent}25` : `${effectiveAccent}14`,
              color: effectiveAccent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
        );
      case "delivery":
        return (
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isPanelDark ? "rgba(8, 145, 178, 0.2)" : "#ecfeff", color: "#0891b2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
        );
      case "return":
        return (
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isPanelDark ? "rgba(217, 119, 6, 0.2)" : "#fffbeb", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </div>
        );
      case "refund":
        return (
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isPanelDark ? "rgba(22, 163, 74, 0.2)" : "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
        );
      case "support":
        return (
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isPanelDark ? "rgba(147, 51, 234, 0.2)" : "#faf5ff", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        );
      case "account":
        return (
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isPanelDark ? "rgba(79, 70, 229, 0.2)" : "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        );
      default:
        return (
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isPanelDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)", color: mutedTextColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
        );
    }
  };

  const panelInnerContent = (
    <>
      <style>{`
        @keyframes wcFadeInSlide {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wcBottomSheetSlide {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes wcBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes wcSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .wc-notif-card:hover {
          background: ${isPanelDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)"} !important;
        }
        .wc-notif-card:active {
          transform: scale(0.99);
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobileEffective ? "14px 18px 12px" : "12px 16px",
          borderBottom: `1px solid ${cardBorder}`,
          background: isPanelDark ? "rgba(255,255,255,0.02)" : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: isMobileEffective ? "16px" : "14px", fontWeight: 700, color: textColor, letterSpacing: "-0.01em" }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                background: effectiveAccent,
                color: "#ffffff",
                padding: "2px 7px",
                borderRadius: "999px",
                lineHeight: 1,
              }}
            >
              {unreadCount} new
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              style={{
                background: isPanelDark ? "rgba(255,255,255,0.06)" : `${effectiveAccent}14`,
                border: "none",
                color: effectiveAccent,
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "5px 9px",
                borderRadius: "8px",
                opacity: markingAll ? 0.5 : 1,
                transition: "all 0.15s ease",
              }}
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            style={{
              background: mobileDrawerTheme.closeBtnBg,
              border: "none",
              color: textColor,
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Subtabs Filter Bar - Balanced segmented control with touch horizontal scroll */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "8px 12px",
          borderBottom: `1px solid ${cardBorder}`,
          background: isPanelDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {(
          [
            { key: "all", label: "All" },
            { key: "unread", label: "Unread", count: unreadCount },
            { key: "order", label: "Orders" },
            { key: "return", label: "Returns" },
            { key: "support", label: "Support" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: isMobileEffective ? "1 0 auto" : 1,
                minWidth: isMobileEffective ? "56px" : 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: isActive ? 700 : 500,
                borderRadius: "8px",
                border: isActive ? `1px solid ${effectiveAccent}40` : "1px solid transparent",
                background: isActive
                  ? isPanelDark
                    ? `${effectiveAccent}25`
                    : `${effectiveAccent}14`
                  : "transparent",
                color: isActive
                  ? effectiveAccent
                  : mutedTextColor,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              {"count" in tab && Boolean(tab.count) && tab.count! > 0 && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: "2px 5px",
                    borderRadius: "999px",
                    background: isActive ? effectiveAccent : (isPanelDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"),
                    color: isActive ? "#ffffff" : textColor,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification List with Infinite Scroll */}
      <div
        onScroll={handleListScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: isMobileEffective ? "12px 14px" : "8px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          minHeight: 0,
          maxHeight: isMobileEffective ? undefined : "260px",
        }}
      >
        {!isAuthenticated ? (
          <div
            style={{
              textAlign: "center",
              padding: "36px 16px",
              color: mutedTextColor,
            }}
          >
            <p style={{ fontSize: "13px", margin: "0 0 12px 0" }}>
              Please log in to view your store notifications
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(siteSlug ? `/store/${siteSlug}/login` : "/login");
              }}
              style={{
                background: effectiveAccent,
                color: "#ffffff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
          </div>
        ) : loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "180px",
              color: mutedTextColor,
              fontSize: "13px",
            }}
          >
            Loading updates...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "220px",
              padding: "24px 16px",
              color: mutedTextColor,
              textAlign: "center",
              gap: "8px",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              style={{ opacity: 0.5 }}
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: 600, color: textColor }}>
              {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
            </span>
            <span style={{ fontSize: "11px", color: mutedTextColor }}>
              Order receipts, tracking, and support updates will appear here.
            </span>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isRead = Boolean(item.is_read ?? item.isRead);
            const createdDate = item.created_at || item.createdAt;

            return (
              <div
                key={item.id}
                className="wc-notif-card"
                onClick={() => handleNotificationClick(item)}
                style={{
                  display: "flex",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: !isRead
                    ? isPanelDark
                      ? `${effectiveAccent}14`
                      : `${effectiveAccent}0c`
                    : isPanelDark
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
                  border: !isRead
                    ? `1.5px solid ${isPanelDark ? `${effectiveAccent}44` : `${effectiveAccent}34`}`
                    : `1px solid ${cardBorder}`,
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Category Icon */}
                {getCategoryIcon(item.category)}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      marginBottom: "3px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13.5px",
                        fontWeight: isRead ? 600 : 700,
                        color: textColor,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: mutedTextColor,
                        flexShrink: 0,
                      }}
                    >
                      {timeAgo(createdDate)}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: "12px",
                      color: isRead ? mutedTextColor : textColor,
                      margin: 0,
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.message}
                  </p>
                </div>

                {/* Unread indicator dot */}
                {!isRead && (
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: effectiveAccent,
                      boxShadow: `0 0 8px ${effectiveAccent}88`,
                      flexShrink: 0,
                      alignSelf: "center",
                    }}
                  />
                )}
              </div>
            );
          })
        )}

        {loadingMore && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "10px 0",
              gap: "6px",
              color: mutedTextColor,
              fontSize: "12px",
            }}
          >
            <div
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                border: `2px solid ${effectiveAccent}`,
                borderTopColor: "transparent",
                animation: "wcSpin 0.7s linear infinite",
              }}
            />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </>
  );

  if (isMobileEffective && typeof document !== "undefined") {
    return createPortal(
      <>
        {/* Mobile Backdrop */}
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: mobileDrawerTheme.overlayBg,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 999998,
            animation: "wcBackdropFade 0.2s ease-out",
          }}
        />
        {/* Mobile Bottom Sheet Modal */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Customer Notifications"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            width: "100%",
            maxWidth: "540px",
            margin: "0 auto",
            height: "75vh",
            maxHeight: "85vh",
            background: resolvedBg,
            border: `1px solid ${resolvedBorder}`,
            borderBottom: "none",
            borderTopLeftRadius: "22px",
            borderTopRightRadius: "22px",
            boxShadow: mobileDrawerTheme.boxShadow,
            display: "flex",
            flexDirection: "column",
            zIndex: 999999,
            overflow: "hidden",
            paddingBottom: "max(env(safe-area-inset-bottom, 12px), 12px)",
            animation: isDragging ? "none" : "wcBottomSheetSlide 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
            ...drawerStyle,
          }}
        >
          {/* Top Pill Handle (Draggable to close) */}
          <div
            {...dragHandleProps}
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "10px",
              paddingBottom: "8px",
              ...dragHandleProps.style,
            }}
          >
            <div
              style={{
                width: "38px",
                height: "4px",
                borderRadius: "999px",
                background: mobileDrawerTheme.pillColor,
              }}
            />
          </div>
          {panelInnerContent}
        </div>
      </>,
      document.body
    );
  }

  // Desktop Floating Dropdown
  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Customer Notifications"
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        right: 0,
        width: "415px",
        maxWidth: "min(420px, calc(100vw - 20px))",
        maxHeight: "440px",
        background: resolvedBg,
        border: `1px solid ${resolvedBorder}`,
        borderRadius: "14px",
        boxShadow: isPanelDark
          ? "0 20px 45px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)"
          : "0 20px 40px -10px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.05)",
        display: "flex",
        flexDirection: "column",
        zIndex: 99999,
        overflow: "hidden",
        animation: "wcFadeInSlide 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {panelInnerContent}
    </div>
  );
};

export default NotificationCenter;
