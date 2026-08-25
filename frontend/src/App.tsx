import React, { useEffect, useState, useRef, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
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
import { AiWebpageGeneratingAnimation } from "./Component/AiWebpageGeneratingAnimation";
import { AiAvatar } from "./Component/AiAvatar";
import { UserAvatar } from "./Component/UserAvatar";
import BuilderPage, { siteSlugMemoryCache } from "./BuilderPage";

import AdminLoginPage from "./pages/AdminLoginPage";
import AdminSignupPage from "./pages/AdminSignupPage";
import AdminResetPasswordPage from "./pages/AdminResetPasswordPage";
import CustomerLoginPage from "./pages/CustomerLoginPage";
import CustomerSignupPage from "./pages/CustomerSignupPage";

// Lazy-loaded routes for secondary standalone pages
const TrackOrderPage = React.lazy(() => import("./pages/TrackOrderPage"));
const AgentDeliveryPage = React.lazy(() => import("./pages/AgentDeliveryPage"));
const RiderLoginPage = React.lazy(() => import("./pages/RiderLoginPage"));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "2.5px solid rgba(0,0,0,0.08)",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
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
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  status?: "loading" | "done" | "error";
  type?: "text" | "palette_choice" | "choice_list" | "choice" | "generating_animation";
  palette_options?: any[];
  choices?: { id: string; label: string; description?: string }[];
  progress?: number;
  currentStepMessage?: string;
  brandName?: string;
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
  const { admin, logoutAdmin } = useAdminAuth();

  const ONBOARDING_CHAT_KEY = "webnirmaan_onboarding_chat";
  const ONBOARDING_SESSION_KEY = "webnirmaan_onboarding_session_id";
  const ONBOARDING_COLLECTED_KEY = "webnirmaan_onboarding_collected";

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(ONBOARDING_SESSION_KEY) || localStorage.getItem(ONBOARDING_SESSION_KEY);
    }
    return null;
  });
  const [savedSites, setSavedSites] = useState<SavedSite[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("wc_admin_saved_sites");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
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

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(ONBOARDING_CHAT_KEY) || localStorage.getItem(ONBOARDING_CHAT_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [collectedState, setCollectedState] = useState<Record<string, any>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(ONBOARDING_COLLECTED_KEY) || localStorage.getItem(ONBOARDING_COLLECTED_KEY);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {};
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window !== "undefined") {
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
  }, [messages, sessionId, collectedState]);

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
      try {
        localStorage.setItem("wc_admin_saved_sites", JSON.stringify(sitesList));
      } catch (_) {}

      // Pre-populate memory and localStorage snapshot cache for all sites
      sitesList.forEach((site: any) => {
        if (site.id) {
          siteSlugMemoryCache.set(site.id, site);
          try {
            localStorage.setItem(
              `wc_site_snapshot_${site.id}`,
              JSON.stringify(site)
            );
            const parsedTheme =
              site.draft_definition?.theme || site.site_definition?.theme;
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
            const parsedTheme =
              site.draft_definition?.theme || site.site_definition?.theme;
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
      const cleanPrev = prev.filter((m) => m.type !== "generating_animation");
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
        const streamResponse = await fetch(`${API_BASE_URL}/site-definition/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ session_id: currentSessionId }),
        });

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
          text: `🎉 Created ${brandName}! Opening builder... \n\nRemember: You can customize theme, colors, and component assets anytime in the builder. Click 'Publish' at the bottom to save live updates!`,
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

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

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
                  if (event.type === "token") {
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
    />
  );

  const leftPanel = (
    <BuilderControlPanel
      activeKey={activeDrawer || (activeSettingsNavKey ? "settings" : "chat")}
      disabledKeys={["customize", "admin-panel", "assets", "qr-link"]}
      onSelect={(key) => {
        if (key === "chat") {
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
      ) : (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          color: "#0f172a",
          position: "relative",
          overflow: "hidden",
        }}
      >
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
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>

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

                        {msg.status === "loading" && (
                          <div
                            style={{
                              marginTop: "8px",
                              display: "flex",
                              gap: "5px",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#2563eb",
                                animation: "pulse 1.2s infinite ease-in-out",
                              }}
                            />
                            <div
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#2563eb",
                                animation: "pulse 1.2s infinite ease-in-out 0.2s",
                              }}
                            />
                            <div
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#2563eb",
                                animation: "pulse 1.2s infinite ease-in-out 0.4s",
                              }}
                            />
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
              placeholder="Describe the website or reply to questions..."
              rows={1}
              disabled={loading}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#0f172a",
                fontSize: "14px",
                lineHeight: 1.4,
                resize: "none",
                fontFamily: "inherit",
                minHeight: "26px",
                maxHeight: "160px",
                padding: "6px 4px",
              }}
            />

            <button
              type="button"
              onClick={() => handleSendReply(prompt)}
              disabled={loading || !prompt.trim()}
              title="Send message"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                border: "none",
                background:
                  loading || !prompt.trim()
                    ? "#e2e8f0"
                    : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: loading || !prompt.trim() ? "#94a3b8" : "#ffffff",
                cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow:
                  loading || !prompt.trim()
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

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/signup" element={<AdminSignupPage />} />
        <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />

        <Route path="/store/:slug/login" element={<CustomerLoginPage />} />
        <Route path="/store/:slug/signup" element={<CustomerSignupPage />} />
        <Route path="/store/:slug/track/:orderId" element={<TrackOrderPage />} />
        <Route path="/store/:slug/rider/login" element={<RiderLoginPage />} />
        <Route path="/store/:slug/rider/dashboard" element={<AgentDeliveryPage />} />
        <Route path="/store/:slug/*" element={<BuilderPage />} />

        {/* Global Rider & Tracking Routes */}
        <Route path="/rider/login" element={<RiderLoginPage />} />
        <Route path="/rider/dashboard" element={<AgentDeliveryPage />} />
        <Route path="/track/:siteId/:orderId" element={<TrackOrderPage />} />
        <Route path="/agent/delivery/:shipmentId" element={<AgentDeliveryPage />} />

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