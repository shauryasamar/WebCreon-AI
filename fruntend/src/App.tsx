import { useEffect, useState } from "react";
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

const API_BASE_URL = "http://localhost:8000";

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

  const [prompt, setPrompt] = useState(
    "Create an ecommerce website for my clothing brand selling T-shirts in India with Razorpay and COD, dark theme, and an admin panel"
  );
  const [loading, setLoading] = useState(false);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  const loadSavedSites = async () => {
    try {
      setSitesLoading(true);

      const response = await fetch(`${API_BASE_URL}/auth/admin/sites`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to load admin sites: ${response.status}`);
      }

      const data = await response.json();
      setSavedSites(data);
    } catch (error) {
      console.error("Error loading admin sites:", error);
      setSavedSites([]);
    } finally {
      setSitesLoading(false);
    }
  };

  useEffect(() => {
    loadSavedSites();
  }, []);

  const openSite = (siteId: string) => {
    navigate(`/builder/${siteId}`);
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

  const generateSite = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/site-definition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ prompt }),
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

      await loadSavedSites();
      navigate(`/builder/${createdSite.id}`);
    } catch (error) {
      console.error("Error generating site:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        background: "#0f172a",
        color: "#f8fafc",
        padding: "16px 20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          height: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            WebNirmaan
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                opacity: 0.7,
              }}
            >
              {savedSites.length} saved websites
            </div>

            <button
              onClick={handleLogout}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "#f8fafc",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(340px, 1fr)",
            gap: "20px",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
            }}
          >
            <p
              style={{
                marginTop: 0,
                marginBottom: "12px",
                opacity: 0.88,
                fontSize: "15px",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Describe your website
            </p>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              style={{
                width: "100%",
                flex: 1,
                minHeight: 0,
                boxSizing: "border-box",
                padding: "16px",
                marginBottom: "14px",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "linear-gradient(180deg, #0b1220 0%, #0f172a 100%)",
                color: "#f8fafc",
                resize: "none",
                fontSize: "15px",
                lineHeight: 1.6,
                outline: "none",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            />

            <button
              onClick={generateSite}
              disabled={loading}
              style={{
                padding: "12px 18px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 10px 24px rgba(37,99,235,0.28)",
                alignSelf: "flex-start",
                flexShrink: 0,
              }}
            >
              {loading ? "Generating..." : "Generate and open"}
            </button>
          </div>

          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "20px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "16px",
                fontSize: "22px",
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              Saved Websites
            </h3>

            {sitesLoading ? (
              <p style={{ margin: 0, opacity: 0.75 }}>Loading websites...</p>
            ) : savedSites.length === 0 ? (
              <p style={{ margin: 0, opacity: 0.8 }}>No saved websites yet.</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  overflowY: "auto",
                  minHeight: 0,
                  paddingRight: "2px",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {savedSites.map((site) => {
                  const brandName =
                    site.draft_definition?.site?.brand_name ||
                    site.site_definition?.site?.brand_name ||
                    site.slug;

                  const siteType =
                    site.draft_definition?.site?.site_type ||
                    site.site_definition?.site?.site_type ||
                    "website";

                  const region =
                    site.draft_definition?.site?.region ||
                    site.site_definition?.site?.region;

                  const domain =
                    site.draft_definition?.site?.domain ||
                    site.site_definition?.site?.domain;

                  return (
                    <button
                      key={site.id}
                      onClick={() => openSite(site.id)}
                      style={{
                        textAlign: "left",
                        padding: "0",
                        borderRadius: "18px",
                        border: "1px solid rgba(255,255,255,0.06)",
                        background: "linear-gradient(180deg, #1c2434 0%, #141c2b 100%)",
                        color: "#f8fafc",
                        cursor: "pointer",
                        overflow: "hidden",
                        flexShrink: 0,
                        boxShadow:
                          "0 10px 30px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          padding: "14px 14px 13px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "14px",
                              background:
                                "linear-gradient(180deg, rgba(59,130,246,0.22) 0%, rgba(37,99,235,0.12) 100%)",
                              border: "1px solid rgba(96,165,250,0.16)",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#bfdbfe",
                              fontSize: "14px",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {brandName?.charAt(0)?.toUpperCase() || "W"}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "14px",
                                marginBottom: "4px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {brandName}
                            </div>

                            <div
                              style={{
                                fontSize: "12px",
                                color: "rgba(248,250,252,0.6)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {siteType}
                              {region ? ` • ${region}` : ""}
                              {domain ? ` • ${domain}` : ""}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "12px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(248,250,252,0.72)",
                            fontSize: "14px",
                            flexShrink: 0,
                          }}
                        >
                          →
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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