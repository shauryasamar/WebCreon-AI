import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import BuilderPage from "./BuilderPage";

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
  id: number;
  name: string;
  site_type: string;
  domain: string | null;
  region: string | null;
  created_at: string;
};

function DashboardPage() {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState(
    "Create an ecommerce website for my clothing brand selling T-shirts in India with Razorpay and COD, dark theme, and an admin panel"
  );
  const [loading, setLoading] = useState(false);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);

  const loadSavedSites = async () => {
    try {
      setSitesLoading(true);
      const response = await fetch("http://127.0.0.1:8000/sites");

      if (!response.ok) {
        throw new Error(`Failed to load sites: ${response.status}`);
      }

      const data = await response.json();
      setSavedSites(data);
    } catch (error) {
      console.error("Error loading saved sites:", error);
    } finally {
      setSitesLoading(false);
    }
  };

  useEffect(() => {
    loadSavedSites();
  }, []);

  const openSite = (siteId: number) => {
    navigate(`/builder/${siteId}`);
  };

  const generateSite = async () => {
    try {
      setLoading(true);

      const response = await fetch("http://127.0.0.1:8000/site-definition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data: SiteDefinitionResponse = await response.json();

      const siteName =
        data.site_definition.site.brand_name ||
        `${data.site_definition.site.site_type} website`;

      await fetch("http://127.0.0.1:8000/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: siteName,
          site_type: data.site_definition.site.site_type,
          domain: data.site_definition.site.domain,
          region: data.site_definition.site.region,
          prompt,
          site_definition: data.site_definition,
        }),
      });

      const refreshedResponse = await fetch("http://127.0.0.1:8000/sites");
      const refreshedSites: SavedSite[] = await refreshedResponse.json();

      setSavedSites(refreshedSites);

      if (refreshedSites.length > 0) {
        const latestSite = refreshedSites.reduce((maxSite, currentSite) =>
          currentSite.id > maxSite.id ? currentSite : maxSite
        );

        navigate(`/builder/${latestSite.id}`);
      }
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
            AI Website Builder
          </h1>

          <div
            style={{
              fontSize: "14px",
              opacity: 0.7,
            }}
          >
            {savedSites.length} saved
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
                {savedSites.map((site) => (
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
                          {site.name?.charAt(0)?.toUpperCase() || "W"}
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
                            {site.name}
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
                            {site.site_type}
                            {site.region ? ` • ${site.region}` : ""}
                            {site.domain ? ` • ${site.domain}` : ""}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/builder/:siteId/*" element={<BuilderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;