import { useEffect, useState, useRef } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import BuilderPage from "./BuilderPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminSignupPage from "./pages/AdminSignupPage";
import CustomerLoginPage from "./pages/CustomerLoginPage";
import CustomerSignupPage from "./pages/CustomerSignupPage";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import { CartProvider } from "./CartContext";
import { API_BASE_URL } from "./config/api";
import BuilderShell from "./Component/BuilderShell";
import BuilderTopControlBar from "./Component/BuilderTopControlBar";
import BuilderControlPanel from "./Component/BuilderControlPanel";
import BuilderDrawerPanel from "./Component/BuilderDrawerPanel";
import { AiWebpageGeneratingAnimation } from "./Component/AiWebpageGeneratingAnimation";

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
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  status?: "loading" | "done" | "error";
  type?: "text" | "palette_choice" | "choice_list" | "generating_animation";
  palette_options?: any[];
  choices?: { id: string; label: string; description?: string }[];
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
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAdminSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/admin/me`, {
          credentials: "include",
        });

        setIsAuthenticated(response.ok);
      } catch (error) {
        console.error("Error checking admin session:", error);
        setIsAuthenticated(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkAdminSession();
  }, []);

  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f172a",
          color: "#f8fafc",
          padding: "24px",
        }}
      >
        <p>Checking admin session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
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

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const loadSavedSites = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to load admin sites: ${response.status}`);
      }

      const data = await response.json();
      setSavedSites(Array.isArray(data) ? data : []);
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

    setMessages((prev) => {
      const hasAnim = prev.some((m) => m.type === "generating_animation");
      if (hasAnim) return prev;
      return [
        ...prev,
        {
          id: animId,
          sender: "assistant",
          text: "Building your website...",
          time: currentTime,
          type: "generating_animation",
        },
      ];
    });

    try {
      const response = await fetch(`${API_BASE_URL}/site-definition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: currentSessionId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate site definition: ${response.status}`);
      }

      const data: SiteDefinitionResponse = await response.json();
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
      { id: assistantMsgId, sender: "assistant", text: "Thinking...", time: currentTime, status: "loading" },
    ]);

    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    try {
      if (!sessionId) {
        // Start conversation session
        const response = await fetch(`${API_BASE_URL}/conversation/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt: trimmed }),
        });

        if (!response.ok) throw new Error("Failed to start session");

        const sessionData = await response.json();
        setSessionId(sessionData.session_id);

        const lastTurn = sessionData.turns[sessionData.turns.length - 1];
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: lastTurn.text || "Let's build your store!",
                  type: lastTurn.type || "text",
                  palette_options: lastTurn.palette_options || lastTurn.palettes,
                  choices: lastTurn.choices,
                  status: "done",
                }
              : msg
          )
        );

        if (sessionData.is_complete || sessionData.phase === "completed") {
          await triggerFinalSiteGeneration(sessionData.session_id);
        }
      } else {
        // Reply to existing session
        const response = await fetch(`${API_BASE_URL}/conversation/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ session_id: sessionId, reply: trimmed }),
        });

        if (response.status === 404) {
          // Session expired due to server restart, start fresh session seamlessly
          setSessionId(null);
          const startRes = await fetch(`${API_BASE_URL}/conversation/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ prompt: trimmed }),
          });
          if (!startRes.ok) throw new Error("Failed to restart session");
          const sessionData = await startRes.json();
          setSessionId(sessionData.session_id);
          const lastTurn = sessionData.turns[sessionData.turns.length - 1];
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    text: lastTurn.text || "Let's build your store!",
                    type: lastTurn.type || "text",
                    palette_options: lastTurn.palette_options,
                    choices: lastTurn.choices,
                    status: "done",
                  }
                : msg
            )
          );
          if (sessionData.is_complete) {
            await triggerFinalSiteGeneration(sessionData.session_id);
          }
          return;
        }

        if (!response.ok) throw new Error("Failed to send reply");

        const sessionData = await response.json();
        const lastTurn = sessionData.turns[sessionData.turns.length - 1];

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: lastTurn.text || "Got it!",
                  type: lastTurn.type || "text",
                  palette_options: lastTurn.palette_options || lastTurn.palettes,
                  choices: lastTurn.choices,
                  status: "done",
                }
              : msg
          )
        );

        if (sessionData.is_complete || sessionData.phase === "completed") {
          await triggerFinalSiteGeneration(sessionData.session_id);
        }
      }
    } catch (error) {
      console.error("Error in conversation flow:", error);
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
    handleSendReply(choice.label);
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
    />
  );

  const leftPanel = (
    <BuilderControlPanel
      activeKey={activeDrawer}
      disabledKeys={["chat", "customize", "admin-panel", "assets", "qr-link"]}
      onSelect={(key) => {
        if (key === "saved-sites" || key === "settings") {
          setActiveDrawer((prev) => (prev === key ? null : key));
        }
      }}
    />
  );

  const drawerNode = activeDrawer ? (
    <BuilderDrawerPanel
      activeDrawer={activeDrawer}
      onClose={() => setActiveDrawer(null)}
      savedSites={savedSites}
      onSelectSite={(targetSiteId) => {
        setActiveDrawer(null);
        openSite(targetSiteId);
      }}
      onDeleteSite={handleDeleteSite}
    />
  ) : null;

  return (
    <BuilderShell
      topBar={topBar}
      leftPanel={leftPanel}
      drawer={drawerNode}
      plainCenter={true}
    >
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
                Specify your brand name, products, payment preferences, or color vibe, and WebNirmaan AI will guide you through building your custom store.
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
                        brandName={
                          messages
                            .find((m) => m.text.includes("Building"))
                            ?.text.replace("Building ", "")
                            .replace("...", "") || "Your Store"
                        }
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
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "10px",
                          background: isUser
                            ? "#e2e8f0"
                            : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                          display: "grid",
                          placeItems: "center",
                          color: isUser ? "#334155" : "#ffffff",
                          fontSize: "11px",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {isUser ? "You" : "AI"}
                      </div>

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

                        {/* Choice Pills */}
                        {msg.choices && msg.choices.length > 0 && (
                          <div
                            style={{
                              marginTop: "14px",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            {msg.choices.map((choice) => (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => handleSelectChoice(choice)}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: "20px",
                                  border: "1px solid #2563eb",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#2563eb";
                                  e.currentTarget.style.color = "#ffffff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#eff6ff";
                                  e.currentTarget.style.color = "#1d4ed8";
                                }}
                              >
                                {choice.label}
                              </button>
                            ))}
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
            padding: "12px 20px 24px 20px",
            background: "transparent",
            flexShrink: 0,
          }}
        >
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
    </BuilderShell>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/signup" element={<AdminSignupPage />} />

      <Route path="/store/:slug/login" element={<CustomerLoginPage />} />
      <Route path="/store/:slug/signup" element={<CustomerSignupPage />} />
      <Route path="/store/:slug/*" element={<BuilderPage />} />

      <Route element={<RequireAdminAuth />}>
        <Route path="/admin/sites" element={<AdminSitesPage />} />
      </Route>

      <Route path="/builder/:siteId/*" element={<BuilderPage />} />
    </Routes>
  );
}

function App() {
  return (
    <AdminAuthProvider>
      <CustomerAuthProvider>
        <CartProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </CartProvider>
      </CustomerAuthProvider>
    </AdminAuthProvider>
  );
}

export default App;