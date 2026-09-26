import React, { useEffect, useState, useRef, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import { CartProvider } from "./CartContext";
import { API_BASE_URL } from "./config/api";
import BuilderShell from "./Component/BuilderShell";
import BuilderTopControlBar from "./Component/BuilderTopControlBar";
import BuilderControlPanel from "./Component/BuilderControlPanel";
import BuilderDrawerPanel, { SettingsNavKey } from "./Component/BuilderDrawerPanel";
import AdminProfileSettings from "./Component/AdminProfileSettings";
import AdminUsersAndRoles from "./Component/AdminUsersAndRoles";
import AdminAuditLogs from "./Component/AdminAuditLogs";
import {
  AdminGeneralSettings,
  AdminDomainSettings,
  AdminBillingSettings,
  AdminIntegrationsSettings,
} from "./Component/AdminSettingsViews";
import { AdminHelpSupport } from "./Component/AdminHelpSupport";
import { AiWebpageGeneratingAnimation } from "./Component/AiWebpageGeneratingAnimation";
import { AiAvatar } from "./Component/AiAvatar";
import { UserAvatar } from "./Component/UserAvatar";
import BuilderPage, { siteSlugMemoryCache } from "./BuilderPage";
import { setSavedSitesMemoryCache } from "./utils/savedSitesCache";

import AdminLoginPage from "./pages/AdminLoginPage";
import AdminSignupPage from "./pages/AdminSignupPage";
import AdminResetPasswordPage from "./pages/AdminResetPasswordPage";
import AdminAcceptInvitePage from "./pages/AdminAcceptInvitePage";
import CustomerLoginPage from "./pages/CustomerLoginPage";
import CustomerSignupPage from "./pages/CustomerSignupPage";

// Lazy-loaded routes for secondary standalone pages
const TrackOrderPage = React.lazy(() => import("./pages/TrackOrderPage"));
const AgentDeliveryPage = React.lazy(() => import("./pages/AgentDeliveryPage"));
const RiderLoginPage = React.lazy(() => import("./pages/RiderLoginPage"));
const SupportAgentLoginPage = React.lazy(() => import("./pages/SupportAgentLoginPage"));
const SupportAgentDashboard = React.lazy(() => import("./pages/SupportAgentDashboard"));


function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "transparent",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "30px",
            height: "30px",
            border: "2.5px solid rgba(125,125,125,0.18)",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

type Block = {
  id: string;
  type: string;
  props?: Record<string, any>;
  data_source?: string | null;
  actions?: Record<string, any>;
};

type Page = {
  id: string;
  name: string;
  route: string;
  blocks: Block[];
  role?: string;
  flow?: string;
  show_in_nav?: boolean;
};

type SiteDefinition = {
  site: {
    site_type: string;
    domain: string | null;
    region: string | null;
    brand_name: string | null;
  };
  theme: {
    name: string;
    primary_bg: string;
    text_color: string;
    accent_color: string;
  };
  pages: Page[];
  resources: {
    name: string;
    model: string;
    table_name: string;
  }[];
};

type SiteDefinitionResponse = {
  requirements: Record<string, any>;
  site_definition: SiteDefinition;
};

type SavedSite = {
  id: string;
  slug: string;
  site_definition: SiteDefinition;
  draft_definition: SiteDefinition | null;
  version: number;
  default_return_window_days?: number;
  is_online?: boolean;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  status?: "loading" | "done" | "error";
  type?: "text" | "palette_choice" | "choice_list" | "choice" | "generating_animation" | "paywall";
  palette_options?: any[];
  choices?: { id: string; label: string; description?: string }[];
  progress?: number;
  currentStepMessage?: string;
  brandName?: string;
  paywall_reset_date?: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function RequireAdminAuth() {
  const location = useLocation();
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return <RouteLoadingFallback />;
  }

  if (!admin) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}

function AdminSitesPage() {
  const navigate = useNavigate();
  const { admin, logoutAdmin, isOwner, hasPermission } = useAdminAuth();

  const adminId = admin?.id || "";
  const ONBOARDING_CHAT_KEY = adminId ? `wc_onboarding_chat_${adminId}` : "wc_onboarding_chat_guest";
  const ONBOARDING_SESSION_KEY = adminId ? `wc_onboarding_session_${adminId}` : "wc_onboarding_session_guest";
  const ONBOARDING_COLLECTED_KEY = adminId ? `wc_onboarding_collected_${adminId}` : "wc_onboarding_collected_guest";

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Never seed saved-sites from localStorage: a stale entry from a previously-logged-in
  // admin account would momentarily expose their sites to the current admin (security gap).
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<
    | "saved-sites"
    | "chat"
    | "customize"
    | "admin-panel"
    | "assets"
    | "settings"
    | "qr-link"
    | null
  >(null);
  const [activeSettingsNavKey, setActiveSettingsNavKey] = useState<SettingsNavKey | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [collectedState, setCollectedState] = useState<Record<string, any>>({});
  const [isOnboardingPaywallLocked, setIsOnboardingPaywallLocked] = useState(false);
  const [onboardingPaywallResetDate, setOnboardingPaywallResetDate] = useState<string | null>(null);

  // Sync state with current admin ID
  useEffect(() => {
    if (typeof window === "undefined" || !adminId) return;
    try {
      const stored = sessionStorage.getItem(ONBOARDING_CHAT_KEY) || localStorage.getItem(ONBOARDING_CHAT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        } else {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }

      const storedSession = sessionStorage.getItem(ONBOARDING_SESSION_KEY) || localStorage.getItem(ONBOARDING_SESSION_KEY);
      setSessionId(storedSession || null);

      const storedCollected = sessionStorage.getItem(ONBOARDING_COLLECTED_KEY) || localStorage.getItem(ONBOARDING_COLLECTED_KEY);
      if (storedCollected) {
        setCollectedState(JSON.parse(storedCollected));
      } else {
        setCollectedState({});
      }
    } catch {
      setMessages([]);
      setSessionId(null);
      setCollectedState({});
    }
  }, [adminId, ONBOARDING_CHAT_KEY, ONBOARDING_SESSION_KEY, ONBOARDING_COLLECTED_KEY]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window !== "undefined" && adminId) {
      try {
        if (messages.length > 0) {
          sessionStorage.setItem(ONBOARDING_CHAT_KEY, JSON.stringify(messages));
          localStorage.setItem(ONBOARDING_CHAT_KEY, JSON.stringify(messages));
        }
        if (sessionId) {
          sessionStorage.setItem(ONBOARDING_SESSION_KEY, sessionId);
          localStorage.setItem(ONBOARDING_SESSION_KEY, sessionId);
        }
        if (Object.keys(collectedState).length > 0) {
          sessionStorage.setItem(ONBOARDING_COLLECTED_KEY, JSON.stringify(collectedState));
          localStorage.setItem(ONBOARDING_COLLECTED_KEY, JSON.stringify(collectedState));
        }
      } catch {}
    }
  }, [adminId, messages, sessionId, collectedState, ONBOARDING_CHAT_KEY, ONBOARDING_SESSION_KEY, ONBOARDING_COLLECTED_KEY]);

  const handleResetOnboarding = () => {
    setMessages([]);
    setSessionId(null);
    setCollectedState({});
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ONBOARDING_CHAT_KEY);
      sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
      sessionStorage.removeItem(ONBOARDING_COLLECTED_KEY);
      localStorage.removeItem(ONBOARDING_CHAT_KEY);
      localStorage.removeItem(ONBOARDING_SESSION_KEY);
      localStorage.removeItem(ONBOARDING_COLLECTED_KEY);
    }
  };

  const loadSavedSites = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to load admin sites: ${response.status}`);
      }

      const data = await response.json();
      const sitesList: SavedSite[] = Array.isArray(data) ? data : [];
      setSavedSites(sitesList);
      setSavedSitesMemoryCache(sitesList);

      // If the user is a team member (non-owner), directly open their first assigned store
      if (!isOwner && sitesList.length > 0) {
        navigate(`/builder/${sitesList[0].id}`, { replace: true });
        return;
      }

      // Pre-populate memory and localStorage snapshot cache for all sites
      sitesList.forEach((site: any) => {
        if (site.id) {
          siteSlugMemoryCache.set(site.id, site);
          try {
            localStorage.setItem(
              `wc_site_snapshot_${site.id}`,
              JSON.stringify(site)
            );
            const parsedTheme = site.site_definition?.theme;
            if (parsedTheme) {
              localStorage.setItem(
                `wc_theme_mode_${site.id}`,
                parsedTheme.mode || "light"
              );
              if (parsedTheme.primary_bg) {
                localStorage.setItem(
                  `wc_theme_bg_${site.id}`,
                  parsedTheme.primary_bg
                );
              }
            }
          } catch (_) {}
        }
        if (site.slug) {
          siteSlugMemoryCache.set(site.slug, site);
          try {
            localStorage.setItem(
              `wc_site_snapshot_${site.slug}`,
              JSON.stringify(site)
            );
            const parsedTheme = site.site_definition?.theme;
            if (parsedTheme) {
              localStorage.setItem(
                `wc_theme_mode_${site.slug}`,
                parsedTheme.mode || "light"
              );
              if (parsedTheme.primary_bg) {
                localStorage.setItem(
                  `wc_theme_bg_${site.slug}`,
                  parsedTheme.primary_bg
                );
              }
            }
          } catch (_) {}
        }
      });
    } catch (error) {
      console.error("Error loading admin sites:", error);
      setSavedSites([]);
    }
  };

  useEffect(() => {
    loadSavedSites();
  }, []);

  const openSite = (siteId: string) => {
    navigate(`/builder/${siteId}`);
  };

  const handleDeleteSite = async (targetSiteId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sites/${targetSiteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to delete site (${response.status})`);
      }

      setSavedSites((prev) => prev.filter((site) => site.id !== targetSiteId));
    } catch (error: any) {
      console.error("Error deleting site:", error);
      alert(error?.message || "Failed to delete site.");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  const triggerFinalSiteGeneration = async (currentSessionId: string) => {
    setLoading(true);
    const animId = `anim-${Date.now()}`;
    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Extract best brand name candidate from previous conversation turns
    let detectedBrand = "Your Website";
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messages[i].text || "";
      if (text.includes("Creating") || text.includes("Building") || text.includes("for ")) {
        const match = text.match(/(?:for|building|brand|store)\s+([A-Za-z0-9\s]+?)(?:[.,!\n]|$)/i);
        if (match && match[1]?.trim()) {
          detectedBrand = match[1].trim();
          break;
        }
      }
    }

    setMessages((prev) => {
      const cleanPrev = prev.filter(
        (m) =>
          m.type !== "generating_animation" &&
          (m.sender === "user" || (m.text && m.text.trim().length > 0 && m.text !== "Processing...") || m.type === "paywall" || (m.palette_options && m.palette_options.length > 0) || (m.choices && m.choices.length > 0))
      );
      return [
        ...cleanPrev,
        {
          id: animId,
          sender: "assistant",
          text: "Building your website...",
          time: currentTime,
          type: "generating_animation",
          progress: 15,
          currentStepMessage: "Initializing AI generation pipeline...",
          brandName: detectedBrand,
        },
      ];
    });

    try {
      let data: SiteDefinitionResponse | null = null;

      // Try streaming progress first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const streamResponse = await fetch(`${API_BASE_URL}/site-definition/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({ session_id: currentSessionId }),
        });

        clearTimeout(timeoutId);

        if (streamResponse.ok && streamResponse.body) {
          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data:")) {
                try {
                  const payload = JSON.parse(trimmed.slice(5).trim());
                  if (payload.message || typeof payload.progress === "number") {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === animId
                          ? {
                              ...msg,
                              text: payload.message || msg.text,
                              currentStepMessage: payload.message || msg.currentStepMessage,
                              progress: typeof payload.progress === "number" ? payload.progress : msg.progress,
                              brandName: payload.requirements?.brand_name || msg.brandName || detectedBrand,
                            }
                          : msg
                      )
                    );
                  }
                  if (payload.step === "complete" && payload.site_definition) {
                    data = {
                      requirements: payload.requirements,
                      site_definition: payload.site_definition,
                    };
                  }
                } catch (err) {
                  // Ignore partial json in stream
                }
              }
            }
          }
        }
      } catch (streamErr) {
        console.warn("SSE stream failed, falling back to standard generation:", streamErr);
      }

      // Fallback if stream did not return site definition
      if (!data) {
        const response = await fetch(`${API_BASE_URL}/site-definition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ session_id: currentSessionId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate site definition: ${response.status}`);
        }

        data = (await response.json()) as SiteDefinitionResponse;
      }

      const brandName = data.site_definition.site.brand_name || `${data.site_definition.site.site_type} website`;
      const baseSlug = slugify(brandName) || "website";
      const uniqueSlug = `${baseSlug}-${Date.now()}`;

      const createResponse = await fetch(`${API_BASE_URL}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug: uniqueSlug,
          site_definition: data.site_definition,
          draft_definition: data.site_definition,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to save site: ${createResponse.status}`);
      }

      const createdSite: SavedSite = await createResponse.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `done-${Date.now()}`,
          sender: "assistant",
          text: `Created ${brandName}! Opening builder... \n\nRemember: You can customize theme, colors, and component assets anytime in the builder. Click 'Publish' at the bottom to save live updates!`,
          time: currentTime,
          status: "done",
        },
      ]);

      await loadSavedSites();
      handleResetOnboarding();
      setTimeout(() => {
        navigate(`/builder/${createdSite.id}`);
      }, 1200);
    } catch (error) {
      console.error("Error generating final site:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: "Unable to generate site right now. Please try again.",
          time: currentTime,
          status: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (replyText: string) => {
    const trimmed = replyText.trim();
    if (!trimmed || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", text: trimmed, time: currentTime },
      { id: assistantMsgId, sender: "assistant", text: "", time: currentTime, status: "loading" },
    ]);

    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    try {
      const endpoint = !sessionId
        ? `${API_BASE_URL}/conversation/start/stream`
        : `${API_BASE_URL}/conversation/reply/stream`;

      const requestBody = !sessionId
        ? { prompt: trimmed }
        : { session_id: sessionId, reply: trimmed };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      clearTimeout(timeoutId);

      const updateAssistantMsg = (payload: {
        text?: string;
        palette_options?: any[];
        choices?: any[];
        status?: "loading" | "done" | "error";
      }) => {
        const palOpts = payload.palette_options;
        const choices = payload.choices;
        const msgType = palOpts && palOpts.length > 0
          ? "palette_choice"
          : choices && choices.length > 0
          ? "choice"
          : "text";

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: payload.text !== undefined ? payload.text : msg.text,
                  type: msgType,
                  palette_options: palOpts,
                  choices: choices,
                  status: payload.status || "done",
                }
              : msg
          )
        );
      };

      if (response.status === 402) {
        try {
          const errData = await response.json();
          const rDate = errData?.detail?.reset_date || null;
          setIsOnboardingPaywallLocked(true);
          setOnboardingPaywallResetDate(rDate);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    text: errData?.detail?.message || "Monthly AI credit limit reached. Please upgrade your plan to continue using AI.",
                    type: "paywall",
                    paywall_reset_date: rDate,
                    status: "done",
                  }
                : msg
            )
          );
        } catch {
          setIsOnboardingPaywallLocked(true);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    text: "Monthly AI credit limit reached. Please upgrade your plan to continue using AI.",
                    type: "paywall",
                    status: "done",
                  }
                : msg
            )
          );
        }
        return;
      }

      if (response.status === 404 && sessionId) {
        // Rehydrate session seamlessly if server restarted
        const rehydrateRes = await fetch(`${API_BASE_URL}/conversation/rehydrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            session_id: sessionId,
            collected: collectedState,
            turns: messages.map((m) => ({ sender: m.sender, text: m.text })),
            reply: trimmed,
          }),
        });
        if (!rehydrateRes.ok) throw new Error("Failed to rehydrate session");
        const sessionData = await rehydrateRes.json();
        setSessionId(sessionData.session_id);
        if (sessionData.collected) setCollectedState(sessionData.collected);
        const lastTurn = sessionData.turns[sessionData.turns.length - 1];

        updateAssistantMsg({
          text: lastTurn.text || "Let's build your store!",
          palette_options: lastTurn.palette_options || lastTurn.palettes,
          choices: lastTurn.choices,
          status: "done",
        });

        if (sessionData.is_complete || sessionData.phase === "completed") {
          await triggerFinalSiteGeneration(sessionData.session_id);
        }
        return;
      }

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let doneReading = false;
        let buffer = "";
        let streamedText = "";
        let finalDoneEvent: any = null;

        while (!doneReading) {
          const { value, done } = await reader.read();
          doneReading = done;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const block of lines) {
              const trimmedBlock = block.trim();
              if (trimmedBlock.startsWith("data: ")) {
                try {
                  const event = JSON.parse(trimmedBlock.slice(6));
                  if (event.type === "paywall_exhausted" || event.error_code === "AI_CREDIT_LIMIT_REACHED") {
                    setIsOnboardingPaywallLocked(true);
                    setOnboardingPaywallResetDate(event.reset_date || null);
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMsgId
                          ? {
                              ...msg,
                              text: event.message || "Monthly AI credit limit reached. Please upgrade your plan for higher monthly credit limits.",
                              type: "paywall",
                              paywall_reset_date: event.reset_date || null,
                              status: "done",
                            }
                          : msg
                      )
                    );
                    return;
                  } else if (event.type === "token") {
                    streamedText += event.content || "";
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMsgId
                          ? { ...msg, text: streamedText, status: "loading" }
                          : msg
                      )
                    );
                  } else if (event.type === "done") {
                    finalDoneEvent = event;
                  }
                } catch {}
              }
            }
          }
        }

        if (finalDoneEvent) {
          if (finalDoneEvent.session_id) setSessionId(finalDoneEvent.session_id);
          if (finalDoneEvent.collected) setCollectedState(finalDoneEvent.collected);

          updateAssistantMsg({
            text: finalDoneEvent.text || streamedText || "Let's build your store!",
            palette_options: finalDoneEvent.palette_options || finalDoneEvent.palettes,
            choices: finalDoneEvent.choices,
            status: "done",
          });

          if (finalDoneEvent.is_complete || finalDoneEvent.phase === "completed") {
            await triggerFinalSiteGeneration(finalDoneEvent.session_id);
          }
        }
      }
    } catch (error) {
      console.error("Error in conversation stream flow:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: "Something went wrong. Please try again.",
                status: "error",
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPaletteOption = (pal: any) => {
    handleSendReply(pal.id);
  };

  const handleSelectChoice = (choice: { id: string; label: string }) => {
    handleSendReply(choice.id);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply(prompt);
    }
  };

  const topBar = (
    <BuilderTopControlBar
      siteName=""
      onGoDashboard={() => navigate("/admin/sites")}
      onLogout={handleLogout}
      userName={admin?.name}
      userEmail={admin?.email}
      avatarUrl={admin?.avatarUrl}
      gender={admin?.gender}
      isOwner={isOwner}
    />
  );

  const leftPanel = (
    <BuilderControlPanel
      activeKey={activeDrawer || (activeSettingsNavKey ? "settings" : !isOwner ? "saved-sites" : "chat")}
      disabledKeys={!isOwner ? ["chat", "customize", "admin-panel", "assets", "qr-link"] : ["customize", "admin-panel", "assets", "qr-link"]}
      onSelect={(key) => {
        if (key === "chat") {
          if (!isOwner) return;
          setActiveSettingsNavKey(null);
          setActiveDrawer(null);
          return;
        }
        if (key === "saved-sites" || key === "settings") {
          setActiveDrawer((prev) => (prev === key ? null : key));
        }
      }}
    />
  );

  const drawerNode = activeDrawer ? (
    <BuilderDrawerPanel
      activeDrawer={activeDrawer}
      onClose={() => {
        setActiveDrawer(null);
        try {
          sessionStorage.removeItem("wc_active_builder_drawer");
        } catch (_) {}
      }}
      savedSites={savedSites}
      onSelectSite={(targetSiteId) => {
        try {
          sessionStorage.setItem("wc_active_builder_drawer", "saved-sites");
        } catch (_) {}
        openSite(targetSiteId);
      }}
      onDeleteSite={handleDeleteSite}
      activeSettingsNavKey={activeSettingsNavKey}
      onSelectSettingsNav={(key) => {
        setActiveSettingsNavKey(key);
      }}
    />
  ) : null;

  return (
    <BuilderShell
      topBar={topBar}
      leftPanel={leftPanel}
      drawer={drawerNode}
      plainCenter={true}
    >
      {activeSettingsNavKey === "profile" ? (
        <div style={{ height: "100%", overflowY: "auto", background: "#ffffff", padding: "24px", boxSizing: "border-box" }}>
          <AdminProfileSettings />
        </div>
      ) : activeSettingsNavKey === "users-roles" ? (
        <div style={{ height: "100%", overflowY: "auto", background: "#ffffff", padding: "24px", boxSizing: "border-box" }}>
          <AdminUsersAndRoles />
        </div>
      ) : activeSettingsNavKey === "domain" ? (
        <div style={{ height: "100%", overflowY: "auto", background: "#ffffff", padding: "24px", boxSizing: "border-box" }}>
          <AdminDomainSettings />
        </div>
      ) : activeSettingsNavKey === "billing" ? (
        <div style={{ height: "100%", overflowY: "auto", background: "#ffffff", padding: "24px", boxSizing: "border-box" }}>
          <AdminBillingSettings />
        </div>
      ) : activeSettingsNavKey === "audit-logs" ? (
        <div style={{ height: "100%", overflowY: "auto", background: "#ffffff", padding: "24px", boxSizing: "border-box" }}>
          <AdminAuditLogs />
        </div>
      ) : activeSettingsNavKey === "help-support" ? (
        <div style={{ height: "100%", overflowY: "auto", background: "#ffffff", padding: "24px", boxSizing: "border-box" }}>
          <AdminHelpSupport />
        </div>
      ) : !isOwner ? (
        <div
          style={{
            height: "100%",
            overflowY: "auto",
            background: "#f8fafc",
            padding: "36px 32px",
            boxSizing: "border-box",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
                    Your Assigned Stores
                  </h1>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "12px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                    {admin?.role || "Staff"}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
                  Select an assigned store below to manage products, orders, and storefront configuration.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "14px 18px",
                borderRadius: "12px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "28px",
              }}
            >
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                🛡️
              </div>
              <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                <strong style={{ color: "#0f172a" }}>Store Creation Restricted:</strong> The AI Store Onboarding Agent is accessible strictly by workspace owners. As a team member, you have direct access to your assigned storefronts below.
              </div>
            </div>

            {savedSites.length === 0 ? (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  padding: "48px 24px",
                  textAlign: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🏪</div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
                  No Stores Currently Assigned
                </h3>
                <p style={{ fontSize: "13.5px", color: "#64748b", maxWidth: "420px", margin: "0 auto", lineHeight: 1.5 }}>
                  Your account is active, but you have not been granted access to any store websites yet. Please contact your workspace owner.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
                  gap: "18px",
                }}
              >
                {savedSites.map((site) => {
                  const brand = site.site_definition?.site?.brand_name || site.slug;
                  const domain = site.site_definition?.site?.domain || "E-Commerce";
                  return (
                    <div
                      key={site.id}
                      style={{
                        background: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        padding: "20px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "16px",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 24px rgba(15,23,42,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {brand}
                          </h3>
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", textTransform: "uppercase" }}>
                            {domain}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {site.slug}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                        <button
                          type="button"
                          onClick={() => openSite(site.id)}
                          style={{
                            flex: 1,
                            padding: "8px 14px",
                            borderRadius: "8px",
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                          }}
                        >
                          <span>Open Store</span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div
        className="onboarding-agent-root"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          color: "#0f172a",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <style>{`
          .onboarding-agent-root,
          .onboarding-agent-root input,
          .onboarding-agent-root button,
          .onboarding-agent-root textarea,
          .onboarding-agent-root span,
          .onboarding-agent-root div,
          .onboarding-agent-root p,
          .onboarding-agent-root h1,
          .onboarding-agent-root h2,
          .onboarding-agent-root h3 {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          }

          .onboarding-thinking-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #64748b;
            display: inline-block;
            animation: onboardingDotPulse 1.4s ease-in-out infinite both;
          }

          @keyframes onboardingDotPulse {
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
        {/* Chat Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 20px 16px 20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#64748b",
                fontSize: "14px",
                textAlign: "center",
                padding: "32px 20px",
                gap: "8px",
                margin: "auto 0",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, color: "#475569", fontSize: "15px" }}>
                Describe the website or storefront you want to build.
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", maxWidth: "520px", lineHeight: 1.5 }}>
                Specify your brand name, products, payment preferences, or color vibe, and WebCreon AI will guide you through building your custom store.
              </p>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                const isGeneratingActive = messages.some((m) => m.type === "generating_animation");

                if (msg.type === "generating_animation") {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: "flex-start",
                        width: "100%",
                      }}
                    >
                      <AiWebpageGeneratingAnimation
                        themeMode="light"
                        brandName={msg.brandName || "Your Website"}
                        progress={msg.progress}
                        currentMessage={msg.currentStepMessage || msg.text}
                      />
                    </div>
                  );
                }

                // If assistant message is empty and we are not in an active loading turn or generating animation is active, don't render an empty bubble
                const isEmptyAssistant = !isUser && (!msg.text || msg.text === "Processing..." || !msg.text.trim());
                if (isEmptyAssistant && (!loading || isGeneratingActive)) {
                  return null;
                }

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                        flexDirection: isUser ? "row-reverse" : "row",
                        maxWidth: "85%",
                      }}
                    >
                      {isUser ? (
                        <UserAvatar size={32} avatarUrl={admin?.avatarUrl} gender={admin?.gender} />
                      ) : (
                        <AiAvatar size={32} />
                      )}

                      <div
                        style={{
                          borderRadius: isUser
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                          padding: "14px 18px",
                          background: isUser
                            ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                            : "#f8fafc",
                          border: isUser
                            ? "none"
                            : "1px solid rgba(15,23,42,0.08)",
                          color: isUser ? "#ffffff" : "#0f172a",
                          fontSize: "14px",
                          lineHeight: 1.5,
                          boxShadow: isUser
                            ? "0 4px 14px rgba(37,99,235,0.22)"
                            : "0 2px 10px rgba(15,23,42,0.04)",
                        }}
                      >
                        {msg.type !== "paywall" && (
                          !isUser && (!msg.text || msg.text === "Processing..." || (msg.status === "loading" && !msg.text.trim())) ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 2px",
                              }}
                            >
                              <span className="onboarding-thinking-dot" style={{ animationDelay: "0s" }} />
                              <span className="onboarding-thinking-dot" style={{ animationDelay: "0.2s" }} />
                              <span className="onboarding-thinking-dot" style={{ animationDelay: "0.4s" }} />
                            </div>
                          ) : (
                            <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                          )
                        )}

                        {/* Paywall Banner Card */}
                        {msg.type === "paywall" && (
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                              AI Credit Limit Reached
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                              You have used all credits in your monthly pool. Upgrade your plan to continue building and generating stores.
                            </div>
                            {msg.paywall_reset_date && (
                              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                Resets on: {new Date(msg.paywall_reset_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            )}
                            <div style={{ marginTop: "4px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDrawer("settings");
                                  setActiveSettingsNavKey("billing");
                                }}
                                style={{
                                  padding: "6px 14px",
                                  background: "#2563eb",
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
                          </div>
                        )}

                        {/* Palette Options Card Selection */}
                        {msg.palette_options && msg.palette_options.length > 0 && (
                          <div
                            style={{
                              marginTop: "16px",
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            {msg.palette_options.map((pal: any, idx: number) => (
                              <div
                                key={pal.id || idx}
                                onClick={() => handleSelectPaletteOption(pal)}
                                style={{
                                  padding: "12px",
                                  borderRadius: "12px",
                                  background: "#ffffff",
                                  border: "1.5px solid rgba(15,23,42,0.12)",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = "#2563eb";
                                  e.currentTarget.style.transform = "translateY(-2px)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = "rgba(15,23,42,0.12)";
                                  e.currentTarget.style.transform = "translateY(0)";
                                }}
                              >
                                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                                  {idx + 1}. {pal.name}
                                </div>
                                <div style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 10px 0" }}>
                                  {pal.description}
                                </div>

                                {/* Swatches */}
                                <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                                  <div
                                    title={`Primary BG: ${pal.primary_bg}`}
                                    style={{
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "6px",
                                      background: pal.primary_bg,
                                      border: "1px solid rgba(0,0,0,0.15)",
                                    }}
                                  />
                                  <div
                                    title={`Accent: ${pal.accent_color}`}
                                    style={{
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "6px",
                                      background: pal.accent_color,
                                    }}
                                  />
                                  <div
                                    title={`Navbar: ${pal.navbar_bg}`}
                                    style={{
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "6px",
                                      background: pal.navbar_bg,
                                      border: "1px solid rgba(0,0,0,0.15)",
                                    }}
                                  />
                                  <div
                                    title={`Footer: ${pal.footer_bg}`}
                                    style={{
                                      width: "24px",
                                      height: "24px",
                                      borderRadius: "6px",
                                      background: pal.footer_bg,
                                      border: "1px solid rgba(0,0,0,0.15)",
                                    }}
                                  />
                                </div>

                                <button
                                  type="button"
                                  style={{
                                    width: "100%",
                                    padding: "6px 0",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Select {pal.name}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Choice Cards (Layout Archetypes, Surface Materiality, Build Now) */}
                        {msg.choices && msg.choices.length > 0 && (
                          <div
                            style={{
                              marginTop: "14px",
                              display: "grid",
                              gridTemplateColumns: msg.choices.length <= 3 ? "repeat(auto-fit, minmax(200px, 1fr))" : "repeat(auto-fit, minmax(180px, 1fr))",
                              gap: "10px",
                            }}
                          >
                            {msg.choices.map((choice) => {
                              const isBuildNow = choice.id === "build_now";
                              return (
                                <button
                                  key={choice.id}
                                  type="button"
                                  onClick={() => handleSelectChoice(choice)}
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: "12px",
                                    border: isBuildNow ? "1px solid #10b981" : "1px solid rgba(37,99,235,0.25)",
                                    background: isBuildNow ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" : "#ffffff",
                                    color: isBuildNow ? "#065f46" : "#0f172a",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "4px",
                                    boxShadow: "0 2px 6px rgba(15,23,42,0.04)",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                    e.currentTarget.style.boxShadow = isBuildNow
                                      ? "0 6px 16px rgba(16,185,129,0.25)"
                                      : "0 6px 16px rgba(37,99,235,0.18)";
                                    e.currentTarget.style.borderColor = isBuildNow ? "#059669" : "#2563eb";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(15,23,42,0.04)";
                                    e.currentTarget.style.borderColor = isBuildNow ? "#10b981" : "rgba(37,99,235,0.25)";
                                  }}
                                >
                                  <div style={{ fontSize: "13px", fontWeight: 700, color: isBuildNow ? "#047857" : "#1d4ed8" }}>
                                    {choice.label}
                                  </div>
                                  {choice.description && (
                                    <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.4 }}>
                                      {choice.description}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}


                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating Chat Input Bar */}
        <div
          style={{
            padding: "8px 20px 24px 20px",
            background: "transparent",
            flexShrink: 0,
          }}
        >
          {messages.length > 0 && (
            <div
              style={{
                maxWidth: "760px",
                margin: "0 auto 8px auto",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 6px",
              }}
            >
              {collectedState.brand_name ? (
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                  Store: <strong style={{ color: "#0f172a" }}>{collectedState.brand_name}</strong>
                </span>
              ) : <span />}
              <button
                type="button"
                onClick={handleResetOnboarding}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "11px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <span>↺ Start Fresh</span>
              </button>
            </div>
          )}
          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              background: "#ffffff",
              border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: "24px",
              padding: "10px 16px",
              boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              display: "flex",
              alignItems: "flex-end",
              gap: "12px",
            }}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isOnboardingPaywallLocked
                  ? `Monthly limit reached. ${onboardingPaywallResetDate ? `Resets on ${new Date(onboardingPaywallResetDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} or upgrade plan.` : "Upgrade plan to continue."}`
                  : "Describe the website or reply to questions..."
              }
              rows={1}
              disabled={loading || isOnboardingPaywallLocked}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: isOnboardingPaywallLocked ? "#94a3b8" : "#0f172a",
                fontSize: "14px",
                lineHeight: 1.4,
                resize: "none",
                fontFamily: "inherit",
                minHeight: "26px",
                maxHeight: "160px",
                padding: "6px 4px",
                cursor: isOnboardingPaywallLocked ? "not-allowed" : "text",
              }}
            />

            <button
              type="button"
              onClick={() => handleSendReply(prompt)}
              disabled={loading || !prompt.trim() || isOnboardingPaywallLocked}
              title={isOnboardingPaywallLocked ? "Limit reached" : "Send message"}
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                border: "none",
                background:
                  loading || !prompt.trim() || isOnboardingPaywallLocked
                    ? "#e2e8f0"
                    : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: loading || !prompt.trim() || isOnboardingPaywallLocked ? "#94a3b8" : "#ffffff",
                cursor: loading || !prompt.trim() || isOnboardingPaywallLocked ? "not-allowed" : "pointer",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow:
                  loading || !prompt.trim() || isOnboardingPaywallLocked
                    ? "none"
                    : "0 3px 10px rgba(37,99,235,0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <svg
                width="16"
                height="16"
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
          </div>
        </div>
      </div>
      )}
    </BuilderShell>
  );
}

function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = hash.replace("#", "");
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant" as ScrollBehavior,
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search, hash]);

  return null;
}

function StoreLoginWrapper() {
  const { slug } = useParams<{ slug: string }>();
  return <CustomerLoginPage key={slug || "default_login"} />;
}

function StoreSignupWrapper() {
  const { slug } = useParams<{ slug: string }>();
  return <CustomerSignupPage key={slug || "default_signup"} />;
}

function StandaloneStorePageRedirect({ slug: propSlug }: { slug?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ customSlug?: string }>();

  useEffect(() => {
    let activeSlug = "";
    try {
      activeSlug = localStorage.getItem("wc_last_visited_store") || "";
    } catch (_) {}

    if (!activeSlug && siteSlugMemoryCache.size > 0) {
      for (const [, site] of siteSlugMemoryCache.entries()) {
        if (site?.slug) {
          activeSlug = site.slug;
          break;
        }
      }
    }

    const targetSlug =
      propSlug ||
      params.customSlug ||
      location.pathname.replace(/^\/pages\//, "").replace(/^\//, "");

    if (activeSlug) {
      navigate(`/store/${activeSlug}/${targetSlug}`, { replace: true });
      return;
    }

    const resolveStore = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/sites`, { credentials: "include" });
        if (res.ok) {
          const sites = await res.json();
          if (Array.isArray(sites) && sites.length > 0) {
            const chosen = sites[0]?.slug || sites[0]?.id;
            if (chosen) {
              navigate(`/store/${chosen}/${targetSlug}`, { replace: true });
              return;
            }
          }
        }
      } catch (_) {}
      navigate("/admin/login", { replace: true });
    };

    resolveStore();
  }, [propSlug, params.customSlug, location.pathname, navigate]);

  return <RouteLoadingFallback />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/signup" element={<AdminSignupPage />} />
        <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
        <Route path="/admin/accept-invite" element={<AdminAcceptInvitePage />} />

        <Route path="/store/:slug/login" element={<StoreLoginWrapper />} />
        <Route path="/store/:slug/signup" element={<StoreSignupWrapper />} />
        <Route path="/store/:slug/track/:orderId" element={<TrackOrderPage />} />
        <Route path="/store/:slug/rider/login" element={<RiderLoginPage />} />
        <Route path="/store/:slug/rider/dashboard" element={<AgentDeliveryPage />} />
        <Route path="/store/:slug/support/login" element={<SupportAgentLoginPage />} />
        <Route path="/store/:slug/support/dashboard" element={<SupportAgentDashboard />} />
        <Route path="/store/:slug/*" element={<BuilderPage />} />

        {/* Global Rider, Support & Tracking Routes */}
        <Route path="/rider/login" element={<RiderLoginPage />} />
        <Route path="/rider/dashboard" element={<AgentDeliveryPage />} />
        <Route path="/support/login" element={<SupportAgentLoginPage />} />
        <Route path="/support/dashboard" element={<SupportAgentDashboard />} />
        <Route path="/track/:siteId/:orderId" element={<TrackOrderPage />} />
        <Route path="/agent/delivery/:shipmentId" element={<AgentDeliveryPage />} />

        {/* Direct / Standalone Page Resolution for root-level URLs */}
        <Route path="/about" element={<StandaloneStorePageRedirect slug="about" />} />
        <Route path="/contact" element={<StandaloneStorePageRedirect slug="contact" />} />
        <Route path="/privacy" element={<StandaloneStorePageRedirect slug="privacy" />} />
        <Route path="/terms" element={<StandaloneStorePageRedirect slug="terms" />} />
        <Route path="/story" element={<StandaloneStorePageRedirect slug="story" />} />
        <Route path="/pages/:customSlug" element={<StandaloneStorePageRedirect />} />

        <Route element={<RequireAdminAuth />}>
          <Route path="/admin/sites" element={<AdminSitesPage />} />
          <Route path="/builder/:siteId/*" element={<BuilderPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AdminAuthProvider>
      <CustomerAuthProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppRoutes />
          </BrowserRouter>
        </CartProvider>
      </CustomerAuthProvider>
    </AdminAuthProvider>
  );
}

export default App;