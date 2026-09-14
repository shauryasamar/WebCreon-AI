import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { Pagination } from "../Component/Pagination";
import GlassToast from "../Component/GlassToast";
import {
  resolveMediaUrl,
  parseMessageWithMedia,
  AdaptiveSupportImage,
  SupportImageZoomModal,
  compressImageFile,
  MessageStatusTick,
} from "../Component/AdaptiveSupportMedia";

interface AgentSession {
  id: string;
  name: string;
  email: string;
  role: string;
  site_id: string;
  site_slug: string;
}

const CANNED_RESPONSES = [
  { label: "Request UPI/Bank for COD", text: "Since your order was placed via Cash on Delivery, please share your UPI ID (VPA) or Bank Account Details (Account No, IFSC, Name) so our Admin/Finance team can process your refund payout." },
  { label: "Refund Approved", text: "We have reviewed your request and initiated a full refund to your original payment method. It will reflect within 2-4 business days." },
  { label: "Replacement Dispatched", text: "We sincerely apologize for the inconvenience. A free replacement package has been dispatched and will arrive shortly." },
  { label: "Rider Contact Shared", text: "We contacted your delivery rider. They will reach out to you shortly to complete the delivery." },
  { label: "Need More Photos", text: "Could you please upload a clear picture of the outer parcel packaging and shipping label so we can process your claim?" },
  { label: "Delivered to Security Desk", text: "Our delivery partner confirmed this package was safely handed over to the security gate/reception of your address." },
];

// Clean Vector Icons
const HeadsetIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

const UserIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MessageSquareIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const PackageIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const LockIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CheckCircleIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XMarkIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TruckIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const SendIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const InboxIcon = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const KeyIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1-1-4.5 4.5a5 5 0 1 0 7 7L17 15l1.5-1.5L17 12l1.5-1.5L20 12l2-2-1-1z" />
  </svg>
);

const CreditCardIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const RefreshIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ChevronRightIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CopyIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const SupportAgentDashboard: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "waiting_customer" | "resolved">("my");
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState({ all: 0, unassigned: 0, my_tickets: 0, waiting_customer: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer detail state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"chat" | "order" | "crm" | "actions">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Composer state
  const [composerMessage, setComposerMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [composerSending, setComposerSending] = useState(false);
  const [composerImage, setComposerImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploadingComposerImage, setUploadingComposerImage] = useState(false);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);

  // Photo Zoom
  const [activeZoomPhoto, setActiveZoomPhoto] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Resolution modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [resolutionNoteInput, setResolutionNoteInput] = useState("");
  const [payoutModeInput, setPayoutModeInput] = useState("UPI Transfer");
  const [payoutRefInput, setPayoutRefInput] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);
  const [selectedRefundItems, setSelectedRefundItems] = useState<Record<string, number>>({});
  const [selectedRefundCharges, setSelectedRefundCharges] = useState<Record<string, boolean>>({});
  const [selectedReplacementItems, setSelectedReplacementItems] = useState<Record<string, number>>({});

  // Check Agent Auth
  useEffect(() => {
    const raw = localStorage.getItem("support_agent_session");
    if (!raw) {
      navigate(slug ? `/store/${slug}/support/login` : "/support/login", { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setAgent(parsed);
    } catch {
      navigate(slug ? `/store/${slug}/support/login` : "/support/login", { replace: true });
    }
  }, [slug]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("support_agent_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    };
  };

  // Load Agent Tickets (STRICTLY ASSIGNED TO THIS AGENT)
  const loadTickets = async (isSilent: boolean = false) => {
    if (!agent) return;
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === "my") {
        params.set("status", "my");
      } else if (activeTab === "waiting_customer") {
        params.set("status", "waiting_customer");
      } else if (activeTab === "resolved") {
        params.set("status", "resolved");
      }
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("page", String(currentPage));
      params.set("page_size", "15");

      const res = await fetch(`${API_BASE_URL}/support/agent/tickets?${params.toString()}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        localStorage.removeItem("support_agent_session");
        localStorage.removeItem("support_agent_token");
        navigate(slug ? `/store/${slug}/support/login` : "/support/login", { replace: true });
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        if (data.pagination) setTotalPages(data.pagination.total_pages || 1);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error("Failed to load tickets", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    if (agent) {
      loadTickets();
    }
  }, [agent, activeTab, searchQuery, currentPage]);

  // Load Ticket Detail
  const loadTicketDetail = async (ticketId: string, isSilent: boolean = false) => {
    if (!agent) return;
    if (!isSilent) setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/support/agent/tickets/${ticketId}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        localStorage.removeItem("support_agent_session");
        localStorage.removeItem("support_agent_token");
        navigate(slug ? `/store/${slug}/support/login` : "/support/login", { replace: true });
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setDetailData((prev: any) => {
          if (prev && prev.messages && data.messages) {
            const realPrev = prev.messages.filter((m: any) => !String(m.id || "").startsWith("temp_"));
            const prevLast = realPrev[realPrev.length - 1];
            const dataLast = data.messages[data.messages.length - 1];
            const hadTemps = prev.messages.some((m: any) => String(m.id || "").startsWith("temp_"));
            if (
              !hadTemps &&
              realPrev.length === data.messages.length &&
              prevLast?.id === dataLast?.id &&
              prev.ticket?.status === data.ticket?.status
            ) {
              return prev;
            }
          }
          return data;
        });
      } else if (res.status === 403) {
        setToastMessage("Access restricted: This case is not assigned to you.");
        setSelectedTicketId(null);
      }
    } catch (err) {
      console.error("Failed to load detail", err);
    } finally {
      if (!isSilent) setDetailLoading(false);
    }
  };

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailTab("chat");
    loadTicketDetail(ticketId);
  };

  // Real-time Instant Live Sync via Server-Sent Events (SSE) & read receipts
  useEffect(() => {
    if (!selectedTicketId || !agent) return;

    // Open real-time SSE stream for instant incoming customer replies & read receipts
    const sseUrl = `${API_BASE_URL}/support/tickets/${selectedTicketId}/stream`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(sseUrl, { withCredentials: true });
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" && data.message) {
            setDetailData((prev: any) => {
              if (!prev || !prev.messages) return prev;
              const msgId = String(data.message.id);
              const norm = (s: string) => (s || "").replace(/\r\n/g, "\n").trim();
              const withoutTemp = prev.messages.filter(
                (m: any) => !(String(m.id || "").startsWith("temp_") && norm(m.message) === norm(data.message.message))
              );
              if (withoutTemp.some((m: any) => String(m.id) === msgId)) {
                return { ...prev, messages: withoutTemp };
              }
              return {
                ...prev,
                messages: [...withoutTemp, data.message],
              };
            });
            requestAnimationFrame(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            });
          } else if (data.type === "messages_read") {
            // Customer viewed agent's message -> turn double ticks blue!
            setDetailData((prev: any) => {
              if (!prev || !prev.messages) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m: any) =>
                  (m.sender_type === "agent" || m.sender_type === "admin") && !m.read_at
                    ? { ...m, read_at: data.read_at || new Date().toISOString() }
                    : m
                ),
              };
            });
          }
        } catch {}
      };
    } catch {}

    // Fallback sync timer (5s) for ticket status
    const liveTimer = setInterval(() => {
      if (document.hidden) return;
      loadTicketDetail(selectedTicketId, true);
      loadTickets(true);
    }, 5000);

    return () => {
      if (es) es.close();
      clearInterval(liveTimer);
    };
  }, [selectedTicketId, agent]);

  useEffect(() => {
    if (detailTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [detailData?.messages?.length, detailTab]);

  const handleSendMessage = async () => {
    if (!agent || !selectedTicketId) return;
    const textToSend = composerMessage.trim();
    if (!textToSend && !composerImage) return;
    setComposerSending(true);

    const tempId = `temp_${Date.now()}`;
    const previousMessage = composerMessage;
    const currentComposerImage = composerImage;

    // Optimistically update messages list immediately with zero lag and zero reload
    const optimisticMsg = {
      id: tempId,
      sender_type: "agent",
      sender_name: agent.name,
      message: textToSend || (currentComposerImage ? "Attached photo" : ""),
      attachments: currentComposerImage ? [currentComposerImage.previewUrl] : [],
      is_internal_note: isInternalNote,
      created_at: new Date().toISOString(),
    };

    setDetailData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticMsg],
      };
    });

    setComposerMessage("");
    setComposerImage(null);

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    try {
      let attachments: string[] = [];
      if (currentComposerImage) {
        setUploadingComposerImage(true);
        const compressed = await compressImageFile(currentComposerImage.file, 1600, 1600, 0.82);
        const formData = new FormData();
        formData.append("file", compressed);
        const headers = getAuthHeaders();
        delete (headers as any)["Content-Type"];

        const upRes = await fetch(`${API_BASE_URL}/sites/${agent.site_id}/support/upload-image`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });

        if (upRes.ok) {
          const upData = await upRes.json();
          if (upData.url) attachments.push(upData.url);
        }
      }

      const res = await fetch(`${API_BASE_URL}/support/agent/tickets/${selectedTicketId}/messages`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          message: textToSend || (attachments.length > 0 ? "Attached photo" : ""),
          attachments,
          is_internal_note: isInternalNote,
        }),
      });
      if (res.status === 401) {
        localStorage.removeItem("support_agent_session");
        localStorage.removeItem("support_agent_token");
        navigate(slug ? `/store/${slug}/support/login` : "/support/login", { replace: true });
        return;
      }
      if (res.ok) {
        const resData = await res.json().catch(() => null);
        if (currentComposerImage) {
          URL.revokeObjectURL(currentComposerImage.previewUrl);
        }
        if (resData?.message) {
          setDetailData((prev: any) => {
            if (!prev || !prev.messages) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m: any) => (m.id === tempId ? { ...resData.message } : m)),
            };
          });
        }
        setToastMessage(isInternalNote ? "Internal note saved" : "Reply sent to customer");
        await loadTicketDetail(selectedTicketId, true);
        await loadTickets(true);
      } else {
        // Rollback optimistic update
        setDetailData((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: (prev.messages || []).filter((m: any) => m.id !== tempId),
          };
        });
        setComposerMessage(previousMessage);
        setComposerImage(currentComposerImage);
        const errData = await res.json().catch(() => ({}));
        setToastMessage(errData.detail || "Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send message", err);
      // Rollback optimistic update
      setDetailData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: (prev.messages || []).filter((m: any) => m.id !== tempId),
        };
      });
      setComposerMessage(previousMessage);
      setComposerImage(currentComposerImage);
      setToastMessage("Failed to send message");
    } finally {
      setUploadingComposerImage(false);
      setComposerSending(false);
    }
  };

  // Helper to extract applied charges/fees from order 360
  const getOrderAppliedCharges = (order360: any) => {
    if (!order360) return [];
    const snap = order360.pricing_snapshot;
    if (snap?.charges && Array.isArray(snap.charges) && snap.charges.length > 0) {
      return snap.charges;
    }
    const itemsSubtotal = (order360.items || []).reduce(
      (acc: number, it: any) => acc + (Number(it.unit_price || 0) * Number(it.quantity || 1)),
      0
    );
    const total = Number(order360.total || 0);
    const diff = Number((total - itemsSubtotal).toFixed(2));
    if (diff > 0) {
      return [
        {
          id: "shipping_delivery_charge",
          code: "shipping",
          label: "Shipping & Delivery Surcharge",
          amount: diff,
          finalAmount: diff,
          refundable: true,
        },
      ];
    }
    return [];
  };

  const recalculateRefundAmount = (
    itemsMap: Record<string, number>,
    chargesMap: Record<string, boolean>
  ) => {
    let itemsTotal = 0;
    if (detailData?.order_360?.items) {
      detailData.order_360.items.forEach((it: any) => {
        const qty = itemsMap[it.id] || 0;
        itemsTotal += qty * (it.unit_price || 0);
      });
    }

    let chargesTotal = 0;
    const appliedCharges = getOrderAppliedCharges(detailData?.order_360);
    appliedCharges.forEach((ch: any) => {
      const chId = String(ch.id || ch.code || "charge");
      if (chargesMap[chId]) {
        chargesTotal += Number(ch.finalAmount ?? ch.amount ?? 0);
      }
    });

    const maxRem = detailData?.order_360?.refund_summary?.remaining_refundable !== undefined
      ? detailData.order_360.refund_summary.remaining_refundable
      : detailData?.order_360?.total || 0;

    const calcTotal = Number((itemsTotal + chargesTotal).toFixed(2));
    setRefundAmountInput(String(Math.min(calcTotal, maxRem)));
  };

  const handleSelectMaxFullRefund = () => {
    const allItems: Record<string, number> = {};
    if (detailData?.order_360?.items) {
      detailData.order_360.items.forEach((it: any) => {
        allItems[it.id] = it.quantity || 1;
      });
    }
    setSelectedRefundItems(allItems);

    const allCharges: Record<string, boolean> = {};
    const appliedCharges = getOrderAppliedCharges(detailData?.order_360);
    appliedCharges.forEach((ch: any) => {
      const chId = String(ch.id || ch.code || "charge");
      allCharges[chId] = true;
    });
    setSelectedRefundCharges(allCharges);

    const maxRem = detailData?.order_360?.refund_summary?.remaining_refundable !== undefined
      ? detailData.order_360.refund_summary.remaining_refundable
      : detailData?.order_360?.total || 0;
    setRefundAmountInput(String(maxRem));
  };

  const openRefundModal = () => {
    const initialItemsMap: Record<string, number> = {};
    let itemsCalc = 0;
    if (detailData?.order_360?.items && detailData.order_360.items.length > 0) {
      detailData.order_360.items.forEach((it: any) => {
        initialItemsMap[it.id] = it.quantity || 1;
        itemsCalc += (it.unit_price || 0) * (it.quantity || 1);
      });
    }
    setSelectedRefundItems(initialItemsMap);

    const initialChargesMap: Record<string, boolean> = {};
    let chargesCalc = 0;
    const appliedCharges = getOrderAppliedCharges(detailData?.order_360);
    appliedCharges.forEach((ch: any) => {
      const chId = String(ch.id || ch.code || "charge");
      if (ch.refundable) {
        initialChargesMap[chId] = true;
        chargesCalc += Number(ch.finalAmount ?? ch.amount ?? 0);
      } else {
        initialChargesMap[chId] = false;
      }
    });
    setSelectedRefundCharges(initialChargesMap);

    const maxRem = detailData?.order_360?.refund_summary?.remaining_refundable !== undefined
      ? detailData.order_360.refund_summary.remaining_refundable
      : detailData?.order_360?.total || 0;

    setRefundAmountInput(String(Math.min(Number((itemsCalc + chargesCalc).toFixed(2)), maxRem)));
    setResolutionNoteInput("");
    setPayoutModeInput("UPI Transfer");
    setPayoutRefInput("");
    setShowRefundModal(true);
  };

  const openReplacementModal = () => {
    if (detailData?.order_360?.items && detailData.order_360.items.length > 0) {
      const initialMap: Record<string, number> = {};
      detailData.order_360.items.forEach((it: any) => {
        initialMap[it.id] = it.quantity || 1;
      });
      setSelectedReplacementItems(initialMap);
    } else {
      setSelectedReplacementItems({});
    }
    setResolutionNoteInput("");
    setShowReplacementModal(true);
  };

  const handleToggleRefundItem = (itemId: string, maxQty: number) => {
    setSelectedRefundItems(prev => {
      const next = { ...prev };
      if (next[itemId] !== undefined) {
        delete next[itemId];
      } else {
        next[itemId] = maxQty;
      }
      recalculateRefundAmount(next, selectedRefundCharges);
      return next;
    });
  };

  const handleRefundQtyChange = (itemId: string, newQty: number) => {
    setSelectedRefundItems(prev => {
      const next = { ...prev };
      if (newQty <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = newQty;
      }
      recalculateRefundAmount(next, selectedRefundCharges);
      return next;
    });
  };

  const handleToggleRefundCharge = (chargeId: string, isRefundable: boolean, chargeLabel: string) => {
    setSelectedRefundCharges(prev => {
      const willBeChecked = !prev[chargeId];
      const next = { ...prev, [chargeId]: willBeChecked };
      recalculateRefundAmount(selectedRefundItems, next);

      if (willBeChecked && !isRefundable) {
        setResolutionNoteInput(prevNote => {
          if (!prevNote.includes(chargeLabel)) {
            return prevNote ? `${prevNote} (Waived non-refundable charge: ${chargeLabel})` : `Exception: Refunded non-refundable charge (${chargeLabel}) upon support review.`;
          }
          return prevNote;
        });
      }
      return next;
    });
  };

  const handleToggleReplacementItem = (itemId: string, maxQty: number) => {
    setSelectedReplacementItems(prev => {
      const next = { ...prev };
      if (next[itemId] !== undefined) {
        delete next[itemId];
      } else {
        next[itemId] = maxQty;
      }
      return next;
    });
  };

  const handleReplacementQtyChange = (itemId: string, newQty: number) => {
    setSelectedReplacementItems(prev => {
      const next = { ...prev };
      if (newQty <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = newQty;
      }
      return next;
    });
  };

  const handleExecuteAction = async (actionType: string) => {
    if (!agent || !selectedTicketId) return;
    setActionProcessing(true);
    try {
      const payload: any = {
        action_type: actionType,
        note: resolutionNoteInput.trim() || undefined,
      };
      if (actionType === "refund") {
        if (refundAmountInput) {
          payload.refund_amount = parseFloat(refundAmountInput);
        }
        if (payoutModeInput) {
          payload.payout_mode = payoutModeInput;
        }
        if (payoutRefInput.trim()) {
          payload.reference_id = payoutRefInput.trim();
        }
        const items = Object.entries(selectedRefundItems)
          .filter(([_, qty]) => qty > 0)
          .map(([itemId, qty]) => ({ order_item_id: itemId, quantity: qty }));
        if (items.length > 0) {
          payload.items = items;
        }
        const includedCharges = Object.entries(selectedRefundCharges)
          .filter(([_, checked]) => checked)
          .map(([cId]) => cId);
        if (includedCharges.length > 0) {
          payload.included_charge_ids = includedCharges;
        }
      } else if (actionType === "replacement") {
        const items = Object.entries(selectedReplacementItems)
          .filter(([_, qty]) => qty > 0)
          .map(([itemId, qty]) => ({ order_item_id: itemId, quantity: qty }));
        if (items.length > 0) {
          payload.items = items;
        }
      }

      const res = await fetch(`${API_BASE_URL}/support/agent/tickets/${selectedTicketId}/action`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        localStorage.removeItem("support_agent_session");
        localStorage.removeItem("support_agent_token");
        navigate(slug ? `/store/${slug}/support/login` : "/support/login", { replace: true });
        return;
      }

      if (res.ok) {
        setShowRefundModal(false);
        setShowReplacementModal(false);
        const isClosedOrResolved = ["close", "closed", "resolve", "resolved", "refund", "replacement"].includes(actionType);
        setToastMessage(`Ticket updated (${actionType})`);
        loadTicketDetail(selectedTicketId, true);
        if (isClosedOrResolved) {
          setActiveTab("resolved");
        } else if (actionType === "reopen") {
          setActiveTab("my");
        } else {
          loadTickets(true);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setToastMessage(errData.detail || `Action failed (${actionType})`);
      }
    } catch (err) {
      console.error("Action failed", err);
    } finally {
      setActionProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/support/logout`, { method: "POST", credentials: "include" });
    } catch {}
    localStorage.removeItem("support_agent_session");
    localStorage.removeItem("support_agent_token");
    navigate(slug ? `/store/${slug}/support/login` : "/support/login", { replace: true });
  };

  if (!agent) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0f172a" }}>
      {toastMessage && <GlassToast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* Top Navigation Bar */}
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f1f5f9", color: "#2563eb", display: "grid", placeItems: "center", border: "1px solid #e2e8f0" }}>
            <HeadsetIcon size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Support Agent Desk</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>{agent.site_slug.toUpperCase()} Store Support</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{agent.name}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
              Active Agent
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 20px" }}>
        {/* Status Tabs & Search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", gap: "6px", background: "#e2e8f0", padding: "3px", borderRadius: "8px" }}>
            {[
              { key: "my", label: "My Active Cases", count: counts.my_tickets },
              { key: "waiting_customer", label: "Waiting on Customer", count: counts.waiting_customer },
              { key: "resolved", label: "Resolved / Closed", count: counts.resolved },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as any);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: isActive ? "#ffffff" : "transparent",
                    color: isActive ? "#0f172a" : "#64748b",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{ background: isActive ? "#f1f5f9" : "rgba(0,0,0,0.05)", color: isActive ? "#0f172a" : "#64748b", padding: "1px 6px", borderRadius: "10px", fontSize: "11px", fontWeight: 600 }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search tickets, order, or customer..."
              style={{
                width: "280px",
                height: "36px",
                padding: "0 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "13px",
                outline: "none",
                color: "#0f172a",
              }}
            />
          </div>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b", fontSize: "13.5px" }}>Loading your assigned queue...</div>
        ) : tickets.length === 0 ? (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "48px 24px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              <InboxIcon size={36} />
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>Queue Is Clear</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              {activeTab === "my" ? "You have no active cases assigned to you." : "No tickets found under this tab."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {tickets.map((t) => {
              const isResolvedOrClosed = t.status === "resolved" || t.status === "closed" || t.status === "done";
              return (
                <div
                  key={t.id}
                  onClick={() => handleOpenTicket(t.id)}
                  style={{
                    background: "#ffffff",
                    border: t.priority === "urgent" ? "1px solid #fecaca" : "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#94a3b8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = t.priority === "urgent" ? "#fecaca" : "#e2e8f0";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "13.5px", fontFamily: "monospace", color: "#0f172a" }}>#{t.ticket_number}</strong>
                      {t.order_id && (
                        <span style={{ fontSize: "11.5px", background: "#f1f5f9", color: "#334155", padding: "2px 7px", borderRadius: "4px", fontWeight: 600, border: "1px solid #e2e8f0" }}>
                          Order #{t.order_id.slice(0, 8)}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          textTransform: "uppercase",
                          background: t.priority === "urgent" ? "#fee2e2" : "#f1f5f9",
                          color: t.priority === "urgent" ? "#dc2626" : "#64748b",
                        }}
                      >
                        {t.priority}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          background:
                            t.status === "open"
                              ? "#eff6ff"
                              : t.status === "waiting_customer"
                              ? "#fef3c7"
                              : isResolvedOrClosed
                              ? "#f0fdf4"
                              : "#f1f5f9",
                          color:
                            t.status === "open"
                              ? "#2563eb"
                              : t.status === "waiting_customer"
                              ? "#d97706"
                              : isResolvedOrClosed
                              ? "#16a34a"
                              : "#64748b",
                        }}
                      >
                        {t.status === "closed" ? "Closed" : t.status === "resolved" ? "Resolved" : t.status.replace("_", " ")}
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {t.created_at ? new Date(t.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>{t.subject}</h4>
                    {t.last_message && <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>{t.last_message}</p>}
                    {t.order_items_summary && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "3px 7px", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "11.5px", color: "#475569", marginTop: "4px" }}>
                        {t.order_items_summary.image_url && (
                          <img
                            src={resolveMediaUrl(t.order_items_summary.image_url)}
                            alt=""
                            style={{ width: "18px", height: "18px", borderRadius: "3px", objectFit: "cover" }}
                          />
                        )}
                        <span>Item: <strong style={{ color: "#1e293b" }}>{t.order_items_summary.product_name}</strong></span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #f8fafc" }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Customer: <strong style={{ color: "#334155" }}>{t.customer.name}</strong> · Category: <span style={{ textTransform: "capitalize" }}>{t.category.replace("_", " ")}</span>
                    </span>
                    <button
                      onClick={() => handleOpenTicket(t.id)}
                      style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <span>Open Case</span>
                      <ChevronRightIcon size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ marginTop: "20px" }}>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(p) => setCurrentPage(p)} totalItems={counts.all} />
          </div>
        )}
      </main>

      {/* DETAIL DRAWER (No blur overlay, Starts below 64px Top Header) */}
      {selectedTicketId && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTicketId(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "780px",
              background: "#ffffff",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
              animation: "slideInRight 0.2s ease-out",
            }}
          >
            {detailLoading || !detailData ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
                Loading case details...
              </div>
            ) : (
              <>
                {/* Drawer Header */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                        <span style={{ fontSize: "14.5px", fontWeight: 700, fontFamily: "monospace", color: "#0f172a" }}>
                          #{detailData.ticket.ticket_number}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: detailData.ticket.priority === "urgent" ? "#fee2e2" : "#f1f5f9",
                            color: detailData.ticket.priority === "urgent" ? "#dc2626" : "#64748b",
                            textTransform: "uppercase",
                          }}
                        >
                          {detailData.ticket.priority}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: detailData.ticket.status === "resolved" || detailData.ticket.status === "closed" ? "#f0fdf4" : "#eff6ff",
                            color: detailData.ticket.status === "resolved" || detailData.ticket.status === "closed" ? "#16a34a" : "#2563eb",
                            textTransform: "capitalize",
                          }}
                        >
                          {detailData.ticket.status === "closed" ? "Closed" : detailData.ticket.status.replace("_", " ")}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
                        {detailData.ticket.subject}
                      </h3>
                      {detailData.ticket.order_items_summary && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#f1f5f9", padding: "3px 8px", borderRadius: "5px", border: "1px solid #e2e8f0", marginTop: "4px" }}>
                          {detailData.ticket.order_items_summary.image_url && (
                            <img
                              src={resolveMediaUrl(detailData.ticket.order_items_summary.image_url)}
                              alt=""
                              style={{ width: "20px", height: "20px", borderRadius: "3px", objectFit: "cover" }}
                            />
                          )}
                          <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500 }}>
                            {detailData.ticket.order_items_summary.product_name} {detailData.ticket.order_items_summary.quantity ? `(Qty: ${detailData.ticket.order_items_summary.quantity})` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedTicketId) {
                            loadTicketDetail(selectedTicketId, true);
                            loadTickets(true);
                            setToastMessage("Thread refreshed");
                          }
                        }}
                        title="Silently refresh messages and details"
                        style={{
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          display: "grid",
                          placeItems: "center",
                          color: "#64748b",
                          cursor: "pointer",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTicketId(null)}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          fontSize: "14px",
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                          color: "#64748b",
                        }}
                      >
                        <XMarkIcon />
                      </button>
                    </div>
                  </div>

                  {/* Customer Quick Context */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#64748b" }}>
                    <span>
                      Customer: <strong style={{ color: "#334155" }}>{detailData.customer_crm.name}</strong> ({detailData.customer_crm.phone || "No phone"})
                    </span>
                    <span>•</span>
                    <span>
                      Assigned: <strong style={{ color: "#334155" }}>{detailData.assigned_agent.name}</strong>
                    </span>
                  </div>

                  {/* Sub Navigation Tabs */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                    {[
                      { key: "chat", label: "Conversation", icon: <MessageSquareIcon /> },
                      { key: "order", label: "Order & Shipping", icon: <PackageIcon /> },
                      { key: "crm", label: "Customer Profile", icon: <UserIcon /> },
                      { key: "actions", label: "Resolution Tools", icon: <CheckCircleIcon /> },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setDetailTab(tab.key as any)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 12px",
                          borderRadius: "6px",
                          border: "1px solid",
                          borderColor: detailTab === tab.key ? "#2563eb" : "#cbd5e1",
                          background: detailTab === tab.key ? "#2563eb" : "#ffffff",
                          color: detailTab === tab.key ? "#ffffff" : "#475569",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drawer Body - Full Height for Chat */}
                {detailTab === "chat" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#f8fafc" }}>
                    {/* Message Thread History - Takes Maximum Vertical Height */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {detailData.messages.map((m: any) => {
                        const isStaff = m.sender_type === "admin" || m.sender_type === "agent";
                        if (m.is_internal_note) {
                          const parsed = parseMessageWithMedia(m.message, m.attachments);
                          const allImages = Array.from(new Set([...(m.attachments || []).map(resolveMediaUrl), ...parsed.inlineImages]));

                          return (
                            <div
                              key={m.id}
                              style={{
                                alignSelf: "center",
                                width: "92%",
                                background: "#fffbeb",
                                border: "1px dashed #f59e0b",
                                borderRadius: "8px",
                                padding: "10px 14px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                  <LockIcon />
                                  <span>Private Staff Note ({m.sender_name})</span>
                                </span>
                                <span style={{ color: "#94a3b8", fontWeight: 500 }}>
                                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                </span>
                              </div>
                              {parsed.cleanText && (
                                <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.5, whiteSpace: "pre-wrap", color: "#334155" }}>
                                  {parsed.cleanText}
                                </p>
                              )}
                              {allImages.length > 0 && (
                                <div style={{ display: "flex", gap: "8px", marginTop: parsed.cleanText ? "6px" : "0", flexWrap: "wrap" }}>
                                  {allImages.map((imgUrl: string, idx: number) => (
                                    <AdaptiveSupportImage
                                      key={idx}
                                      src={imgUrl}
                                      alt="Note Attachment"
                                      isStaff={false}
                                      onClickZoom={(url) => setActiveZoomPhoto(url)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (isStaff) {
                          const parsed = parseMessageWithMedia(m.message, m.attachments);
                          const allImages = Array.from(new Set([...(m.attachments || []).map(resolveMediaUrl), ...parsed.inlineImages]));

                          return (
                            <div
                              key={m.id}
                              style={{
                                alignSelf: "flex-end",
                                maxWidth: "80%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                              }}
                            >
                              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                                <span style={{ fontWeight: 600, color: "#2563eb" }}>{m.sender_name}</span>
                                <span>•</span>
                                <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                                <MessageStatusTick
                                  isSending={String(m.id || "").startsWith("temp_")}
                                  readAt={m.read_at}
                                  isStaffSender={true}
                                />
                              </div>
                              {parsed.cleanText && (
                                <div
                                  style={{
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    padding: "10px 14px",
                                    borderRadius: "10px 10px 2px 10px",
                                    fontSize: "13px",
                                    lineHeight: 1.5,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {parsed.cleanText}
                                </div>
                              )}
                              {allImages.length > 0 && (
                                <div style={{ display: "flex", gap: "8px", marginTop: parsed.cleanText ? "6px" : "0", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  {allImages.map((imgUrl: string, idx: number) => (
                                    <AdaptiveSupportImage
                                      key={idx}
                                      src={imgUrl}
                                      alt="Proof"
                                      isStaff={true}
                                      onClickZoom={(url) => setActiveZoomPhoto(url)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const parsed = parseMessageWithMedia(m.message, m.attachments);
                        const allImages = Array.from(new Set([...(m.attachments || []).map(resolveMediaUrl), ...parsed.inlineImages]));

                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: "flex-start",
                              maxWidth: "80%",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                              <UserIcon />
                              <span style={{ fontWeight: 600, color: "#0f172a" }}>{m.sender_name}</span>
                              <span>•</span>
                              <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                            </div>
                            {parsed.cleanText && (
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  color: "#0f172a",
                                  padding: "10px 14px",
                                  borderRadius: "10px 10px 10px 2px",
                                  fontSize: "13px",
                                  lineHeight: 1.5,
                                  whiteSpace: "pre-wrap",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                                }}
                              >
                                {parsed.cleanText}
                              </div>
                            )}
                            {allImages.length > 0 && (
                              <div style={{ display: "flex", gap: "8px", marginTop: parsed.cleanText ? "6px" : "0", flexWrap: "wrap" }}>
                                {allImages.map((imgUrl: string, idx: number) => (
                                  <AdaptiveSupportImage
                                    key={idx}
                                    src={imgUrl}
                                    alt="Complaint Photo"
                                    isStaff={false}
                                    onClickZoom={(url) => setActiveZoomPhoto(url)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Compact, Sleek Bottom Composer */}
                    <div
                      style={{
                        background: "#ffffff",
                        borderTop: "1px solid #e2e8f0",
                        padding: "10px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {/* Top bar of composer: Pill mode toggle & Quick Templates dropdown */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                        <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "2px", borderRadius: "6px" }}>
                          <button
                            type="button"
                            onClick={() => setIsInternalNote(false)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              border: "none",
                              background: !isInternalNote ? "#ffffff" : "transparent",
                              color: !isInternalNote ? "#0f172a" : "#64748b",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: !isInternalNote ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                            }}
                          >
                            Reply to Customer
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsInternalNote(true)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              border: "none",
                              background: isInternalNote ? "#ffffff" : "transparent",
                              color: isInternalNote ? "#0f172a" : "#64748b",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: isInternalNote ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                            }}
                          >
                            Private Staff Note
                          </button>
                        </div>

                        {/* Compact Quick Templates Dropdown */}
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setComposerMessage(e.target.value);
                              e.target.value = "";
                            }
                          }}
                          style={{
                            height: "28px",
                            padding: "0 8px",
                            borderRadius: "5px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            fontSize: "11.5px",
                            color: "#475569",
                            outline: "none",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">+ Quick Templates...</option>
                          {CANNED_RESPONSES.map((c, i) => (
                            <option key={i} value={c.text}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Composer Image Attachment Preview */}
                      {composerImage && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "fit-content" }}>
                          <img src={composerImage.previewUrl} alt="Preview" style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover" }} />
                          <span style={{ fontSize: "12px", color: "#334155", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {composerImage.file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(composerImage.previewUrl);
                              setComposerImage(null);
                            }}
                            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "13px", padding: "0 2px" }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Main Message Input Bar & Send Button */}
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                        <input
                          ref={composerFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const rawFile = e.target.files?.[0];
                            if (rawFile) {
                              const file = await compressImageFile(rawFile, 1600, 1600, 0.82);
                              const previewUrl = URL.createObjectURL(file);
                              setComposerImage({ file, previewUrl });
                            }
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => composerFileInputRef.current?.click()}
                          title="Attach screenshot or photo proof"
                          style={{
                            height: "38px",
                            width: "38px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                            color: "#64748b",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </button>

                        <textarea
                          rows={1}
                          value={composerMessage}
                          onChange={(e) => setComposerMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder={isInternalNote ? "Write private internal note (Enter to save)..." : "Write reply (Enter to send, Shift+Enter for new line)..."}
                          style={{
                            flex: 1,
                            minHeight: "38px",
                            maxHeight: "120px",
                            padding: "9px 12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: isInternalNote ? "#f8fafc" : "#ffffff",
                            fontSize: "13px",
                            outline: "none",
                            fontFamily: "inherit",
                            boxSizing: "border-box",
                            resize: "none",
                            color: "#0f172a",
                            lineHeight: 1.4,
                          }}
                        />

                        <button
                          type="button"
                          onClick={handleSendMessage}
                          disabled={composerSending || (!composerMessage.trim() && !composerImage)}
                          style={{
                            height: "38px",
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            padding: "0 16px",
                            borderRadius: "6px",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            cursor: composerSending || (!composerMessage.trim() && !composerImage) ? "not-allowed" : "pointer",
                            opacity: composerSending || (!composerMessage.trim() && !composerImage) ? 0.5 : 1,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            flexShrink: 0,
                          }}
                        >
                          <SendIcon />
                          <span>{composerSending ? (uploadingComposerImage ? "Uploading..." : "...") : isInternalNote ? "Save" : "Send"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Order & Shipping & Return/Refund History */}
                {detailTab === "order" && (
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: "14px" }}>
                    {!detailData.order_360 ? (
                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "32px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                        No store order is linked to this support ticket.
                      </div>
                    ) : (
                      <>
                        {/* Return & Refund Audit Banner */}
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Linked Order</span>
                              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>#{detailData.order_360.id.slice(0, 8)}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {detailData.order_360.refund_summary?.is_fully_refunded ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                                  FULLY REFUNDED
                                </span>
                              ) : (detailData.order_360.refund_summary?.already_refunded || 0) > 0 ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />
                                  PARTIALLY REFUNDED
                                </span>
                              ) : (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94a3b8" }} />
                                  ACTIVE / NOT REFUNDED
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 3 Metrics Row */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>Total Order Paid</span>
                              <strong style={{ fontSize: "15px", color: "#0f172a" }}>₹{detailData.order_360.total.toLocaleString("en-IN")}</strong>
                            </div>
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px" }}>
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>Already Refunded</span>
                              <strong style={{ fontSize: "15px", color: (detailData.order_360.refund_summary?.already_refunded || 0) > 0 ? "#dc2626" : "#475569" }}>
                                ₹{(detailData.order_360.refund_summary?.already_refunded || 0).toLocaleString("en-IN")}
                              </strong>
                            </div>
                            <div style={{ background: (detailData.order_360.refund_summary?.remaining_refundable || 0) > 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${(detailData.order_360.refund_summary?.remaining_refundable || 0) > 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: "6px", padding: "10px 12px" }}>
                              <span style={{ fontSize: "11px", color: (detailData.order_360.refund_summary?.remaining_refundable || 0) > 0 ? "#166534" : "#991b1b", fontWeight: 600, display: "block" }}>Max Remaining Refundable</span>
                              <strong style={{ fontSize: "15px", color: (detailData.order_360.refund_summary?.remaining_refundable || 0) > 0 ? "#15803d" : "#b91c1c" }}>
                                ₹{(detailData.order_360.refund_summary?.remaining_refundable !== undefined ? detailData.order_360.refund_summary.remaining_refundable : detailData.order_360.total).toLocaleString("en-IN")}
                              </strong>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                            <div>Order Status: <strong style={{ textTransform: "uppercase", color: "#0f172a" }}>{detailData.order_360.status}</strong></div>
                            <div>Payment: <strong style={{ textTransform: "uppercase", color: "#0f172a" }}>{detailData.order_360.payment_method || "N/A"} ({detailData.order_360.payment_status})</strong></div>
                          </div>
                        </div>

                        {/* Package Contents */}
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Package Contents</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {detailData.order_360.items.map((it: any) => (
                              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "6px" }}>
                                {it.product_image ? (
                                  <img src={resolveMediaUrl(it.product_image)} alt={it.product_name} style={{ width: "38px", height: "38px", objectFit: "cover", borderRadius: "4px", border: "1px solid #cbd5e1" }} />
                                ) : (
                                  <div style={{ width: "38px", height: "38px", borderRadius: "4px", background: "#e2e8f0", display: "grid", placeItems: "center", color: "#64748b" }}>
                                    <PackageIcon />
                                  </div>
                                )}
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{it.product_name}</div>
                                  <div style={{ fontSize: "11.5px", color: "#64748b" }}>Qty: {it.quantity} {it.variant ? `· ${it.variant}` : ""} · ₹{it.unit_price} each</div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>₹{it.line_total}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Prior Return Requests History */}
                        {detailData.order_360.returns_history && detailData.order_360.returns_history.length > 0 && (
                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                              <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                                Prior Return Requests ({detailData.order_360.returns_history.length})
                              </h4>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>Order Return History</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {detailData.order_360.returns_history.map((ret: any) => (
                                <div key={ret.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "4px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                      <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>#{ret.id.slice(0, 8)}</span>
                                      <span style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: "4px", background: ret.status === "refunded" ? "#dcfce7" : ret.status === "approved" ? "#dbeafe" : "#f1f5f9", color: ret.status === "refunded" ? "#16a34a" : ret.status === "approved" ? "#1d4ed8" : "#475569" }}>
                                        {ret.status}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: ret.final_refund_amount > 0 ? "#16a34a" : "#64748b" }}>
                                      {ret.final_refund_amount > 0 ? `Refunded: ₹${ret.final_refund_amount}` : `Suggested: ₹${ret.suggested_refund_amount}`}
                                    </span>
                                  </div>

                                  {ret.items && ret.items.length > 0 && (
                                    <div style={{ fontSize: "11.5px", color: "#475569", marginBottom: "4px" }}>
                                      {ret.items.map((ri: any, idx: number) => (
                                        <div key={idx}>
                                          • {ri.product_name} (Requested: {ri.quantity_requested}, Approved: {ri.quantity_approved || 0}) — {ri.reason_code ? `Reason: ${ri.reason_code}` : ""}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {ret.admin_note && (
                                    <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", marginTop: "4px" }}>
                                      Admin Note: {ret.admin_note}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Refund Transactions Audit Trail */}
                        {detailData.order_360.refund_transactions && detailData.order_360.refund_transactions.length > 0 && (
                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                            <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                              Processed Refund Records ({detailData.order_360.refund_transactions.length})
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {detailData.order_360.refund_transactions.map((rf: any, idx: number) => (
                                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#166534" }}>
                                      ₹{rf.amount} {rf.refund_id ? `· ${rf.refund_id}` : ""}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#15803d" }}>
                                      {rf.source ? `Source: ${rf.source}` : "Refund"} {rf.actor_name ? `by ${rf.actor_name}` : ""} {rf.arn ? `(ARN: ${rf.arn})` : ""}
                                    </div>
                                    {rf.note && <div style={{ fontSize: "11px", color: "#166534", marginTop: "2px" }}>Note: {rf.note}</div>}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#15803d", fontWeight: 600 }}>
                                    {rf.created_at ? new Date(rf.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Processed"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Shipment Logistics */}
                        {detailData.order_360.shipment && (
                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                            <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                              <TruckIcon />
                              <span>Logistics & Delivery Partner</span>
                            </h4>
                            <div style={{ fontSize: "12.5px", color: "#334155", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                              <div>Logistics Mode: <strong>{detailData.order_360.shipment.delivery_mode}</strong></div>
                              <div>Tracking Status: <strong>{detailData.order_360.shipment.status}</strong></div>
                              {detailData.order_360.shipment.courier_name && <div>Partner / Rider: <strong>{detailData.order_360.shipment.courier_name}</strong></div>}
                              {detailData.order_360.shipment.rider_phone && <div>Rider Phone: <strong>{detailData.order_360.shipment.rider_phone}</strong></div>}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Tab: Customer Profile */}
                {detailTab === "crm" && (
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Customer Orders</span>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                          {detailData.customer_crm.total_orders}
                        </div>
                        <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>Placed by customer</span>
                      </div>

                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Lifetime Spend</span>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#16a34a", marginTop: "2px" }}>
                          ₹{detailData.customer_crm.total_spend.toLocaleString("en-IN")}
                        </div>
                        <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>This Store</span>
                      </div>

                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Claims Filed</span>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: detailData.customer_crm.total_disputes > 3 ? "#dc2626" : "#2563eb", marginTop: "2px" }}>
                          {detailData.customer_crm.total_disputes}
                        </div>
                        <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>Disputes</span>
                      </div>
                    </div>

                    {/* Contact Info Card */}
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                      <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Customer Contact Details</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Full Name</span>
                          <strong style={{ color: "#0f172a" }}>{detailData.customer_crm.name}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Email</span>
                          <strong style={{ color: "#0f172a" }}>{detailData.customer_crm.email || "Not Provided"}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Phone</span>
                          <strong style={{ color: "#0f172a" }}>{detailData.customer_crm.phone || "Not Provided"}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Customer ID</span>
                          <code style={{ fontSize: "11px", color: "#64748b", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>
                            {String(detailData.customer_crm.id).slice(0, 12)}...
                          </code>
                        </div>
                      </div>

                      {detailData.ticket.customer_refund_account && (
                        <div style={{ marginTop: "12px", padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#166534", display: "flex", alignItems: "center", gap: "5px" }}>
                              <CreditCardIcon />
                              <span>Verified Refund UPI Address</span>
                            </span>
                            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "1px 6px", borderRadius: "4px" }}>Verified</span>
                          </div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#15803d", marginTop: "4px", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{detailData.ticket.customer_refund_account.upi_id}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(detailData.ticket.customer_refund_account.upi_id);
                                setToastMessage("UPI ID copied");
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d", display: "grid", placeItems: "center" }}
                              title="Copy UPI ID"
                            >
                              <CopyIcon />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: Resolution Tools */}
                {detailTab === "actions" && (() => {
                  const isTicketClosed = detailData.ticket.status === "closed" || detailData.ticket.status === "resolved";
                  const isFullyRefunded = !!detailData.order_360?.refund_summary?.is_fully_refunded;

                  return (
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {isTicketClosed && (
                        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 700, color: "#991b1b", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>🔒 Case Closed & Concluded</span>
                            </div>
                            <div style={{ fontSize: "12px", color: "#7f1d1d", marginTop: "3px" }}>
                              Resolution actions (Refund, Re-Dispatch, Cancel) are locked on closed cases. To perform new actions, please reopen this case.
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleExecuteAction("reopen")}
                            disabled={actionProcessing}
                            style={{
                              background: "#16a34a",
                              color: "#ffffff",
                              border: "none",
                              padding: "7px 16px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: actionProcessing ? "wait" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {actionProcessing ? "Reopening..." : "Re-Open Case"}
                          </button>
                        </div>
                      )}

                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                        <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Case Resolution Actions</h4>
                        <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "#64748b" }}>
                          {isTicketClosed
                            ? "This ticket is closed. Reopen the case to enable dispute resolution actions."
                            : "Select a resolution action to update the ticket status, trigger refund, or dispatch replacements."}
                        </p>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          {/* 1. Issue / Record Refund */}
                          {(() => {
                            const isCodOrder = ["cod", "cash on delivery", "cash_on_delivery"].includes(String(detailData.order_360?.payment_method || "").trim().toLowerCase());
                            return (
                              <div style={{ border: `1px solid ${isCodOrder ? "#fde68a" : "#e2e8f0"}`, borderRadius: "6px", padding: "12px", background: isTicketClosed ? "#f1f5f9" : isCodOrder ? "#fffbeb" : "#f8fafc", opacity: isTicketClosed ? 0.75 : 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <h5 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: isTicketClosed ? "#64748b" : isCodOrder ? "#b45309" : "#166534" }}>
                                    {isCodOrder ? "Record COD Refund" : "Issue Refund"}
                                  </h5>
                                  {isCodOrder && (
                                    <span style={{ fontSize: "10px", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px" }}>
                                      COD Order
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: "0 0 8px", fontSize: "12px", color: isCodOrder ? "#92400e" : "#64748b" }}>
                                  {isTicketClosed
                                    ? "Disabled while ticket is closed."
                                    : isFullyRefunded
                                    ? "Order is already fully refunded."
                                    : isCodOrder
                                    ? `Record offline/UPI/bank refund for COD order (Max: ₹${detailData.order_360?.refund_summary?.remaining_refundable ?? detailData.order_360?.total ?? 0}).`
                                    : `Refund items up to remaining ₹${detailData.order_360?.refund_summary?.remaining_refundable ?? detailData.order_360?.total ?? 0}.`}
                                </p>
                                <button
                                  disabled={isTicketClosed}
                                  onClick={openRefundModal}
                                  style={{
                                    background: isTicketClosed ? "#94a3b8" : isFullyRefunded ? "#64748b" : isCodOrder ? "#d97706" : "#16a34a",
                                    color: "#ffffff",
                                    border: "none",
                                    padding: "6px 14px",
                                    borderRadius: "5px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: isTicketClosed ? "not-allowed" : "pointer",
                                    width: "100%",
                                  }}
                                  title={isTicketClosed ? "Reopen ticket to issue refund" : ""}
                                >
                                  {isTicketClosed ? "Refund Locked (Closed)" : isFullyRefunded ? "View Refund Status" : isCodOrder ? "Record COD Refund" : "Open Refund Tool"}
                                </button>
                              </div>
                            );
                          })()}

                          {/* 2. Re-Dispatch Replacement */}
                          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", background: isTicketClosed ? "#f1f5f9" : "#f8fafc", opacity: isTicketClosed ? 0.75 : 1 }}>
                            <h5 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: isTicketClosed ? "#64748b" : "#0369a1" }}>Re-Dispatch Replacement</h5>
                            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#64748b" }}>
                              {isTicketClosed ? "Disabled while ticket is closed." : "Create a complimentary replacement shipping order."}
                            </p>
                            <button
                              onClick={openReplacementModal}
                              disabled={isTicketClosed || actionProcessing}
                              style={{
                                background: isTicketClosed ? "#94a3b8" : "#0284c7",
                                color: "#ffffff",
                                border: "none",
                                padding: "6px 14px",
                                borderRadius: "5px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: isTicketClosed || actionProcessing ? "not-allowed" : "pointer",
                                width: "100%",
                              }}
                              title={isTicketClosed ? "Reopen ticket to re-dispatch" : ""}
                            >
                              {isTicketClosed ? "Re-Dispatch Locked (Closed)" : actionProcessing ? "Dispatching..." : "Dispatch Free Replacement"}
                            </button>
                          </div>

                          {/* 3. Close Case */}
                          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", background: isTicketClosed ? "#f1f5f9" : "#f8fafc", gridColumn: "span 2", opacity: isTicketClosed ? 0.75 : 1 }}>
                            <h5 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Close Case / Conclude Ticket</h5>
                            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#64748b" }}>
                              {isTicketClosed ? "This case is already closed and concluded." : "Complete and archive this support case ticket."}
                            </p>
                            <button
                              onClick={() => handleExecuteAction("close")}
                              disabled={isTicketClosed || actionProcessing}
                              style={{
                                background: isTicketClosed ? "#94a3b8" : "#0f172a",
                                color: "#ffffff",
                                border: "none",
                                padding: "6px 16px",
                                borderRadius: "5px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: isTicketClosed || actionProcessing ? "not-allowed" : "pointer",
                                width: "100%",
                              }}
                            >
                              {isTicketClosed ? "Ticket Already Closed" : "Close Ticket"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* POLICY-DRIVEN ITEM-LEVEL REFUND MODAL */}
      {showRefundModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999999,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            boxSizing: "border-box",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRefundModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 40px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)",
              position: "relative",
              zIndex: 100000000,
              boxSizing: "border-box",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Process Order Refund</h3>
                  {detailData?.order_360 && (
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
                      Order #{detailData.order_360.id || detailData.order_360.order_id} • {String(detailData.order_360.payment_method || "ONLINE").toUpperCase()}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                  Select items and fee adjustments to refund. Unselected fees remain retained by the store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", color: "#64748b", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <XMarkIcon />
              </button>
            </div>

            {/* Financial Overview Card */}
            {detailData?.order_360 && (() => {
              const snap = detailData.order_360.pricing_snapshot || {};
              const itemsSubtotal = (detailData.order_360.items || []).reduce(
                (acc: number, it: any) => acc + (Number(it.unit_price || 0) * Number(it.quantity || 1)),
                0
              );
              const appliedCharges = getOrderAppliedCharges(detailData.order_360);
              const chargesTotal = appliedCharges.reduce((acc: number, c: any) => acc + Number(c.finalAmount ?? c.amount ?? 0), 0);
              const totalPaid = Number(detailData.order_360.total || 0);
              const alreadyRefunded = Number(detailData.order_360.refund_summary?.already_refunded || 0);
              const maxRemaining = Number(detailData.order_360.refund_summary?.remaining_refundable !== undefined ? detailData.order_360.refund_summary.remaining_refundable : totalPaid);

              return (
                <div style={{ margin: "0 0 16px", padding: "12px 14px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "left" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Total Order Paid</span>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>₹{totalPaid.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: alreadyRefunded > 0 ? "#b91c1c" : "#64748b", display: "block" }}>Already Refunded</span>
                      <strong style={{ fontSize: "14px", color: alreadyRefunded > 0 ? "#b91c1c" : "#64748b" }}>₹{alreadyRefunded.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "#0f172a", display: "block" }}>Max Refundable</span>
                      <strong style={{ fontSize: "14px", color: maxRemaining > 0 ? "#0f172a" : "#94a3b8" }}>₹{maxRemaining.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* COD Notice */}
            {["cod", "cash on delivery", "cash_on_delivery"].includes(String(detailData?.order_360?.payment_method || "").trim().toLowerCase()) && (
              <div style={{ padding: "10px 12px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#334155", fontSize: "11.5px", marginBottom: "14px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div>
                  <strong>Cash on Delivery Order:</strong> Reversal occurs outside the gateway. Record the disbursal mode (UPI/Bank Transfer) and reference ID below so it is tracked and visible on customer order history.
                </div>
              </div>
            )}

            {/* If order is fully refunded */}
            {detailData?.order_360?.refund_summary?.is_fully_refunded ? (
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontSize: "12px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span><strong>Order Fully Refunded:</strong> ₹{detailData.order_360.total} has already been refunded for this order.</span>
              </div>
            ) : (
              <>
                {/* Presets Toolbar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "14px", padding: "6px 10px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                    Quick Presets:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleSelectMaxFullRefund}
                      style={{
                        background: "#0f172a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "4px 9px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Max Full Refund (₹{detailData?.order_360?.refund_summary?.remaining_refundable !== undefined ? detailData.order_360.refund_summary.remaining_refundable : detailData?.order_360?.total || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allMap: Record<string, number> = {};
                        if (detailData?.order_360?.items) {
                          detailData.order_360.items.forEach((it: any) => {
                            allMap[it.id] = it.quantity || 1;
                          });
                        }
                        setSelectedRefundItems(allMap);
                        setSelectedRefundCharges({});
                        recalculateRefundAmount(allMap, {});
                      }}
                      style={{
                        background: "#ffffff",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Items Only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRefundItems({});
                        setSelectedRefundCharges({});
                        setRefundAmountInput("");
                      }}
                      style={{
                        background: "none",
                        color: "#64748b",
                        border: "none",
                        padding: "4px 6px",
                        fontSize: "11px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Section 1: Product Selection */}
                {detailData?.order_360?.items && detailData.order_360.items.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                        1. Select Products to Refund:
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {detailData.order_360.items.map((it: any) => {
                        const selectedQty = selectedRefundItems[it.id] || 0;
                        const isSelected = selectedQty > 0;
                        const maxQty = it.quantity || 1;
                        const itemSubtotal = (it.unit_price || 0) * (isSelected ? selectedQty : maxQty);

                        return (
                          <div
                            key={it.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              border: isSelected ? "1px solid #0f172a" : "1px solid #e2e8f0",
                              background: isSelected ? "#f8fafc" : "#ffffff",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRefundItem(it.id, maxQty)}
                                style={{ accentColor: "#0f172a", width: "15px", height: "15px", cursor: "pointer" }}
                              />
                              {it.product_image && (
                                <img src={resolveMediaUrl(it.product_image)} alt="" style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover", flexShrink: 0, border: "1px solid #e2e8f0" }} />
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.product_name}</div>
                                <div style={{ color: "#64748b", fontSize: "11px" }}>
                                  ₹{it.unit_price} each • Ordered: {maxQty}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                              {/* Quantity Stepper */}
                              {isSelected ? (
                                <div style={{ display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", overflow: "hidden" }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRefundQtyChange(it.id, Math.max(1, selectedQty - 1));
                                    }}
                                    disabled={selectedQty <= 1}
                                    style={{ border: "none", background: selectedQty <= 1 ? "#f8fafc" : "#ffffff", color: "#334155", padding: "2px 7px", fontSize: "12px", fontWeight: 700, cursor: selectedQty <= 1 ? "not-allowed" : "pointer" }}
                                  >
                                    -
                                  </button>
                                  <span style={{ padding: "2px 8px", fontSize: "11.5px", fontWeight: 600, color: "#0f172a", minWidth: "16px", textAlign: "center" }}>
                                    {selectedQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRefundQtyChange(it.id, Math.min(maxQty, selectedQty + 1));
                                    }}
                                    disabled={selectedQty >= maxQty}
                                    style={{ border: "none", background: selectedQty >= maxQty ? "#f8fafc" : "#ffffff", color: "#334155", padding: "2px 7px", fontSize: "12px", fontWeight: 700, cursor: selectedQty >= maxQty ? "not-allowed" : "pointer" }}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Not selected</span>
                              )}

                              <span style={{ fontWeight: 600, color: isSelected ? "#0f172a" : "#64748b", minWidth: "55px", textAlign: "right" }}>
                                ₹{itemSubtotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 2: Additional Fees & Surcharges Selection */}
                {(() => {
                  const appliedCharges = getOrderAppliedCharges(detailData?.order_360);
                  if (appliedCharges.length === 0) return null;

                  return (
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                          2. Additional Fees & Charges:
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          Select to refund or leave to retain by store
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {appliedCharges.map((ch: any) => {
                          const chId = String(ch.id || ch.code || "charge");
                          const isChecked = Boolean(selectedRefundCharges[chId]);
                          const isRef = Boolean(ch.refundable);
                          const chargeAmt = Number(ch.finalAmount ?? ch.amount ?? 0);

                          return (
                            <div
                              key={chId}
                              onClick={() => handleToggleRefundCharge(chId, isRef, ch.label || "Fee")}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                border: isChecked ? "1px solid #0f172a" : "1px solid #e2e8f0",
                                background: isChecked ? "#f8fafc" : "#ffffff",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleRefundCharge(chId, isRef, ch.label || "Fee")}
                                  style={{ accentColor: "#0f172a", width: "15px", height: "15px", cursor: "pointer" }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{ch.label || "Additional Charge"}</span>
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        fontWeight: 600,
                                        padding: "1px 5px",
                                        borderRadius: "3px",
                                        background: isRef ? "#f1f5f9" : "#fffbeb",
                                        color: isRef ? "#475569" : "#b45309",
                                        border: `1px solid ${isRef ? "#e2e8f0" : "#fef3c7"}`,
                                      }}
                                    >
                                      {isRef ? "Refundable" : "Non-Refundable"}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: "11px", color: isChecked ? "#0f172a" : "#64748b" }}>
                                    {isChecked ? `✓ Refund ₹${chargeAmt.toFixed(2)} to customer` : `Retain fee ₹${chargeAmt.toFixed(2)} by store`}
                                  </div>
                                </div>
                              </div>

                              <span style={{ fontWeight: 600, color: isChecked ? "#0f172a" : "#94a3b8", minWidth: "55px", textAlign: "right" }}>
                                +₹{chargeAmt.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Section 3: Summary & Resolution */}
                {(() => {
                  let itemsCalc = 0;
                  if (detailData?.order_360?.items) {
                    detailData.order_360.items.forEach((it: any) => {
                      const qty = selectedRefundItems[it.id] || 0;
                      itemsCalc += qty * (it.unit_price || 0);
                    });
                  }
                  let chargesCalc = 0;
                  let chargesTotal = 0;
                  const appliedCharges = getOrderAppliedCharges(detailData?.order_360);
                  appliedCharges.forEach((ch: any) => {
                    const cAmt = Number(ch.finalAmount ?? ch.amount ?? 0);
                    chargesTotal += cAmt;
                    const chId = String(ch.id || ch.code || "charge");
                    if (selectedRefundCharges[chId]) {
                      chargesCalc += cAmt;
                    }
                  });
                  const totalCalc = Number((itemsCalc + chargesCalc).toFixed(2));
                  const retainedFees = chargesTotal - chargesCalc;

                  return (
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                      <div>
                        <span style={{ color: "#334155", fontWeight: 600 }}>Refund Breakdown:</span>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          Products: ₹{itemsCalc.toFixed(2)} • Fees: ₹{chargesCalc.toFixed(2)} {retainedFees > 0 ? `(Retained fees: ₹${retainedFees.toFixed(2)})` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Calculated Amount</span>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>₹{totalCalc.toFixed(2)}</strong>
                      </div>
                    </div>
                  );
                })()}

                {/* Refund Policy / Reason Selection */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Return / Refund Policy Reason
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setResolutionNoteInput(e.target.value);
                      }
                    }}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "6px", boxSizing: "border-box", fontSize: "12px", outline: "none", background: "#ffffff" }}
                  >
                    <option value="">-- Select Policy Basis --</option>
                    <option value="Policy Approved: Damaged or Defective Item on Delivery">Damaged / Defective Item on Delivery</option>
                    <option value="Policy Approved: Missing Item from Shipment Package">Missing Item from Package</option>
                    <option value="Policy Approved: Wrong Product / Variant Dispatched">Wrong Product Delivered</option>
                    <option value="Policy Approved: Return Inspected and Restocked">Return Inspected & Received at Warehouse</option>
                    <option value="Policy Exception: Customer Goodwill Courtesy Refund">Goodwill / Policy Exception Courtesy</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#334155" }}>
                    Refund Amount (₹)
                  </label>
                  {detailData?.order_360?.refund_summary?.remaining_refundable !== undefined && (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Max balance: ₹{detailData.order_360.refund_summary.remaining_refundable}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={detailData?.order_360?.refund_summary?.remaining_refundable !== undefined ? detailData.order_360.refund_summary.remaining_refundable : detailData?.order_360?.total}
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  placeholder="Amount in INR..."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "10px", boxSizing: "border-box", fontSize: "12px", outline: "none" }}
                />

                {/* Amount validation warning */}
                {detailData?.order_360?.refund_summary?.remaining_refundable !== undefined && Number(refundAmountInput) > detailData.order_360.refund_summary.remaining_refundable && (
                  <div style={{ fontSize: "11.5px", color: "#b91c1c", marginBottom: "10px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span>Amount exceeds maximum remaining balance (₹{detailData.order_360.refund_summary.remaining_refundable}).</span>
                  </div>
                )}

                {/* Payout Details for COD Orders */}
                {["cod", "cash on delivery", "cash_on_delivery"].includes(String(detailData?.order_360?.payment_method || "").trim().toLowerCase()) && (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px", marginBottom: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "6px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          Disbursal Method
                        </label>
                        <select
                          value={payoutModeInput}
                          onChange={(e) => setPayoutModeInput(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: 0, boxSizing: "border-box", fontSize: "12px", outline: "none", background: "#ffffff" }}
                        >
                          <option value="UPI Transfer">UPI Transfer</option>
                          <option value="Bank Transfer (NEFT/IMPS)">Bank Account (IMPS/NEFT)</option>
                          <option value="Cash Handover by Delivery Partner">Cash Handover (Rider)</option>
                          <option value="Store Credit / Wallet">Store Credit / Wallet</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          Payout Reference / UTR
                        </label>
                        <input
                          type="text"
                          value={payoutRefInput}
                          onChange={(e) => setPayoutRefInput(e.target.value)}
                          placeholder="e.g. UPI Ref / Bank UTR / Receipt"
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: 0, boxSizing: "border-box", fontSize: "12px", outline: "none" }}
                        />
                      </div>
                    </div>
                    <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                      Recorded in order audit log and shown on customer's order receipt.
                    </span>
                  </div>
                )}

                <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Resolution Note (Logged in case history & customer communication)
                </label>
                <textarea
                  rows={2}
                  value={resolutionNoteInput}
                  onChange={(e) => setResolutionNoteInput(e.target.value)}
                  placeholder="e.g. Refund processed per return policy."
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "16px", boxSizing: "border-box", fontSize: "12px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
                />
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
              <button onClick={() => setShowRefundModal(false)} style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", color: "#475569", fontWeight: 600 }}>Cancel</button>
              <button
                onClick={() => handleExecuteAction("refund")}
                disabled={
                  actionProcessing ||
                  !refundAmountInput ||
                  Number(refundAmountInput) <= 0 ||
                  detailData?.ticket?.status === "closed" ||
                  detailData?.ticket?.status === "resolved" ||
                  detailData?.order_360?.refund_summary?.is_fully_refunded ||
                  (detailData?.order_360?.refund_summary?.remaining_refundable !== undefined && Number(refundAmountInput) > detailData.order_360.refund_summary.remaining_refundable)
                }
                style={{
                  background: (detailData?.ticket?.status === "closed" || detailData?.ticket?.status === "resolved" || detailData?.order_360?.refund_summary?.is_fully_refunded) ? "#94a3b8" : "#0f172a",
                  color: "#fff",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: (detailData?.ticket?.status === "closed" || detailData?.ticket?.status === "resolved" || detailData?.order_360?.refund_summary?.is_fully_refunded) ? "not-allowed" : "pointer",
                }}
              >
                {actionProcessing ? "Processing..." : (detailData?.ticket?.status === "closed" || detailData?.ticket?.status === "resolved") ? "Case Closed" : ["cod", "cash on delivery", "cash_on_delivery"].includes(String(detailData?.order_360?.payment_method || "").trim().toLowerCase()) ? `Mark COD Refunded (${refundAmountInput ? '₹' + refundAmountInput : ''})` : `Confirm Refund (${refundAmountInput ? '₹' + refundAmountInput : ''})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* REPLACEMENT MODAL */}
      {showReplacementModal && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999999,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            boxSizing: "border-box",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReplacementModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "540px",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              padding: "22px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              position: "relative",
              zIndex: 100000000,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Re-Dispatch Replacement Package</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>Select items and quantities to replace and send out.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReplacementModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
              >
                <XMarkIcon />
              </button>
            </div>

            {/* Item-level replacement selection */}
            {detailData?.order_360?.items && detailData.order_360.items.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Select Items to Replace:
                  </span>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allMap: Record<string, number> = {};
                        detailData.order_360.items.forEach((it: any) => {
                          allMap[it.id] = it.quantity || 1;
                        });
                        setSelectedReplacementItems(allMap);
                      }}
                      style={{ background: "none", border: "none", color: "#0284c7", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      Select All
                    </button>
                    <span style={{ color: "#cbd5e1" }}>|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedReplacementItems({})}
                      style={{ background: "none", border: "none", color: "#64748b", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {detailData.order_360.items.map((it: any) => {
                    const selectedQty = selectedReplacementItems[it.id] || 0;
                    const isSelected = selectedQty > 0;
                    const maxQty = it.quantity || 1;

                    return (
                      <div
                        key={it.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          border: isSelected ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                          background: isSelected ? "#f0f9ff" : "#ffffff",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleReplacementItem(it.id, maxQty)}
                            style={{ accentColor: "#0284c7", width: "16px", height: "16px", cursor: "pointer" }}
                          />
                          {it.product_image && (
                            <img src={resolveMediaUrl(it.product_image)} alt="" style={{ width: "34px", height: "34px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.product_name}</div>
                            <div style={{ color: "#64748b", fontSize: "11px" }}>
                              Total in Order: {maxQty} unit(s)
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                          {isSelected ? (
                            <div style={{ display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #7dd3fc", borderRadius: "6px", overflow: "hidden" }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplacementQtyChange(it.id, Math.max(1, selectedQty - 1));
                                }}
                                disabled={selectedQty <= 1}
                                style={{ border: "none", background: selectedQty <= 1 ? "#f1f5f9" : "#ffffff", color: "#334155", padding: "3px 7px", fontSize: "12px", fontWeight: 700, cursor: selectedQty <= 1 ? "not-allowed" : "pointer" }}
                              >
                                -
                              </button>
                              <span style={{ padding: "3px 8px", fontSize: "12px", fontWeight: 700, color: "#0284c7", minWidth: "18px", textAlign: "center" }}>
                                {selectedQty}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplacementQtyChange(it.id, Math.min(maxQty, selectedQty + 1));
                                }}
                                disabled={selectedQty >= maxQty}
                                style={{ border: "none", background: selectedQty >= maxQty ? "#f1f5f9" : "#ffffff", color: "#334155", padding: "3px 7px", fontSize: "12px", fontWeight: 700, cursor: selectedQty >= maxQty ? "not-allowed" : "pointer" }}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Excluded</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Replacement Reason Basis */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                Replacement Reason / Policy Basis
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setResolutionNoteInput(e.target.value);
                  }
                }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "6px", boxSizing: "border-box", fontSize: "12.5px", outline: "none", background: "#ffffff" }}
              >
                <option value="">-- Select Replacement Reason --</option>
                <option value="Replacement Approved: Item arrived damaged or broken in transit">Damaged or Broken in Transit</option>
                <option value="Replacement Approved: Item defective or malfunctioning on arrival">Defective / Malfunctioning on Arrival</option>
                <option value="Replacement Approved: Missing item from received package">Missing Item from Package</option>
                <option value="Replacement Approved: Incorrect size or variant delivered">Wrong Size / Variant Delivered</option>
                <option value="Replacement Exception: Customer courtesy goodwill replacement">Courtesy Goodwill Replacement</option>
              </select>
            </div>

            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
              Resolution Note & Dispatch Instructions
            </label>
            <textarea
              rows={2}
              value={resolutionNoteInput}
              onChange={(e) => setResolutionNoteInput(e.target.value)}
              placeholder="e.g. Complimentary replacement authorized for damaged unit. Packing priority."
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "16px", boxSizing: "border-box", fontSize: "13px", outline: "none", resize: "vertical", fontFamily: "inherit" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => setShowReplacementModal(false)}
                style={{ background: "none", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", color: "#475569", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteAction("replacement")}
                disabled={
                  actionProcessing ||
                  Object.values(selectedReplacementItems).filter(q => q > 0).length === 0 ||
                  detailData?.ticket?.status === "closed" ||
                  detailData?.ticket?.status === "resolved"
                }
                style={{
                  background: (detailData?.ticket?.status === "closed" || detailData?.ticket?.status === "resolved" || Object.values(selectedReplacementItems).filter(q => q > 0).length === 0) ? "#94a3b8" : "#0284c7",
                  color: "#fff",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: (detailData?.ticket?.status === "closed" || detailData?.ticket?.status === "resolved" || Object.values(selectedReplacementItems).filter(q => q > 0).length === 0) ? "not-allowed" : "pointer",
                }}
              >
                {actionProcessing ? "Processing..." : "Confirm Re-Dispatch"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PHOTO ZOOM LIGHTBOX */}
      <SupportImageZoomModal
        imageUrl={activeZoomPhoto}
        onClose={() => setActiveZoomPhoto(null)}
        title="Complaint Proof Attachment"
      />
    </div>
  );
};

export default SupportAgentDashboard;
