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
import { CartProvider } from "./CartContext";
import { API_BASE_URL } from "./config/api";
import BuilderShell from "./Component/BuilderShell";
import BuilderTopControlBar from "./Component/BuilderTopControlBar";
import BuilderControlPanel from "./Component/BuilderControlPanel";
import BuilderDrawerPanel from "./Component/BuilderDrawerPanel";

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

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
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
        throw new Error(`Failed to delete site: ${response.status}`);
      }

      setSavedSites((prev) => prev.filter((site) => site.id !== targetSiteId));
    } catch (error) {
      console.error("Error deleting site:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  const generateSiteWithPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", text: trimmed, time: currentTime },
      {
        id: assistantMsgId,
        sender: "assistant",
        text: "Building your website...",
        time: currentTime,
        status: "loading",
      },
    ]);

    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/site-definition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ prompt: trimmed }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate site definition: ${response.status}`);
      }

      const data: SiteDefinitionResponse = await response.json();

      const brandName =
        data.site_definition.site.brand_name ||
        `${data.site_definition.site.site_type} website`;

      const baseSlug = slugify(brandName) || "website";
      const uniqueSlug = `${baseSlug}-${Date.now()}`;

      const createResponse = await fetch(`${API_BASE_URL}/sites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              text: `Created ${brandName}! Opening builder...`,
              status: "done",
            }
            : msg
        )
      );

      await loadSavedSites();
      setTimeout(() => {
        navigate(`/builder/${createdSite.id}`);
      }, 800);
    } catch (error) {
      console.error("Error generating site:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              text: "Unable to generate site right now. Please try again.",
              status: "error",
            }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      generateSiteWithPrompt(prompt);
    }
  };

  const topBar = (
    <BuilderTopControlBar
      siteName=""
      onGoDashboard={() => navigate("/admin/sites")}
      onLogout={handleLogout}
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
                Specify your brand name, products, payment preferences, or design style, and WebNirmaan AI will generate your website.
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
                        maxWidth: "80%",
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
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.text}
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
              placeholder="Describe the website you want to build..."
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
              onClick={() => generateSiteWithPrompt(prompt)}
              disabled={loading || !prompt.trim()}
              title="Send prompt"
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
    <CustomerAuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </CustomerAuthProvider>
  );
}

export default App;