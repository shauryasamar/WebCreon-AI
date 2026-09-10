import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { resolveThemeTokens } from "../context/ThemeContext";
import { MarkdownContent, MarkdownThemeProps } from "../utils/markdownRenderer";

export type StorefrontCustomPageProps = {
  pageSlug?: string;
  siteDefinition?: any;
  siteId?: string;
  siteSlug?: string;
  appBase?: string;
  siteName?: string;
};

type PageData = {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  content: string;
  page_type: string;
  is_published: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  contact_hours?: string | null;
  updated_at?: string;
  created_at?: string;
};

const StorefrontCustomPage: React.FC<StorefrontCustomPageProps> = ({
  pageSlug: explicitSlug,
  siteDefinition,
  siteId: propSiteId,
  siteSlug: propSiteSlug,
  appBase: propAppBase,
  siteName: propSiteName,
}) => {
  const routeParams = useParams<{ pageSlug?: string; customSlug?: string; slug?: string }>();
  const location = useLocation();

  // Determine effective page slug
  const effectiveSlug = useMemo(() => {
    if (explicitSlug) return explicitSlug;
    if (routeParams.customSlug) return routeParams.customSlug;
    if (routeParams.pageSlug) return routeParams.pageSlug;

    // Check pathname e.g. /store/:slug/about -> about
    const parts = location.pathname.replace(/\/+$/, "").split("/");
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== "pages" && lastPart !== "store") {
      return lastPart;
    }
    return "about";
  }, [explicitSlug, routeParams, location.pathname]);

  // Determine effective site identifier (slug or UUID)
  const effectiveSiteIdentifier = useMemo(() => {
    if (propSiteSlug) return propSiteSlug;
    if (propSiteId) return propSiteId;
    if (routeParams.slug) return routeParams.slug;
    const match = location.pathname.match(/\/store\/([^/]+)/);
    if (match && match[1]) return match[1];
    return "";
  }, [propSiteSlug, propSiteId, routeParams.slug, location.pathname]);

  // Effective appBase
  const effectiveAppBase = useMemo(() => {
    if (propAppBase) return propAppBase;
    if (propSiteSlug) return `/store/${propSiteSlug}`;
    if (routeParams.slug) return `/store/${routeParams.slug}`;
    const match = location.pathname.match(/\/store\/([^/]+)/);
    if (match && match[1]) return `/store/${match[1]}`;
    return "";
  }, [propAppBase, propSiteSlug, routeParams.slug, location.pathname]);

  // Resolve theme tokens
  const theme = useMemo(() => {
    return resolveThemeTokens(siteDefinition?.theme);
  }, [siteDefinition?.theme]);

  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch page content
  useEffect(() => {
    if (!effectiveSlug || !effectiveSiteIdentifier) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/public/sites/${effectiveSiteIdentifier}/pages/${effectiveSlug}`
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("This page could not be found or is currently in draft.");
          }
          throw new Error("Failed to load page content.");
        }
        const data = await res.json();
        if (isMounted) {
          setPage(data.page || data);
          // Set page meta title if available
          if (data.page?.meta_title) {
            document.title = data.page.meta_title;
          } else if (data.page?.title) {
            document.title = `${data.page.title} | ${propSiteName || data.site?.brand_name || "Store"}`;
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load page");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPage();

    return () => {
      isMounted = false;
    };
  }, [effectiveSlug, effectiveSiteIdentifier, propSiteName]);

  const markdownThemeProps: MarkdownThemeProps = {
    textColor: theme.textColor,
    mutedColor: theme.mutedTextColor,
    accentColor: theme.accentColor,
    borderColor: theme.borderColor,
    cardBg: theme.cardBg,
    isDark: theme.isDark,
  };

  const pageTopRef = useRef<HTMLDivElement | null>(null);

  const handleBackToTop = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // 1. Scroll page anchor into view (works automatically across all scroll containers)
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // 2. Also scroll storefront navbar into view if present
    const navbarEl = document.getElementById("storefront-navbar");
    if (navbarEl) {
      navbarEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // 3. Explicitly scroll builder canvas preview container if user is in builder/editor preview
    const previewContainers = document.querySelectorAll(".builder-preview-scroll");
    previewContainers.forEach((container) => {
      container.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });

    // 4. Standard window and document scrolling fallback
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
    if (document.documentElement) {
      try {
        document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      } catch {
        document.documentElement.scrollTop = 0;
      }
    }
    if (document.body) {
      try {
        document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      } catch {
        document.body.scrollTop = 0;
      }
    }
  };

  return (
    <div
      style={{
        background: theme.primaryBg,
        color: theme.textColor,
        minHeight: "70vh",
        padding: "32px 20px 64px 20px",
        boxSizing: "border-box",
        transition: "background 0.2s ease, color 0.2s ease",
      }}
    >
      {/* Top Anchor for Back-to-Top scrolling */}
      <div ref={pageTopRef} tabIndex={-1} style={{ position: "relative", top: 0, left: 0, height: 0, width: 0, overflow: "hidden" }} />

      <div
        style={{
          maxWidth: "880px",
          margin: "0 auto",
        }}
      >
        {/* Breadcrumb Bar */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: theme.mutedTextColor,
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          <Link
            to={effectiveAppBase || "/"}
            style={{
              color: theme.mutedTextColor,
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = theme.textColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = theme.mutedTextColor)}
          >
            Home
          </Link>
          <span>/</span>
          <span style={{ color: theme.accentColor, fontWeight: 600 }}>
            {page?.title || effectiveSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </nav>

        {/* Loading State */}
        {loading && (
          <div
            style={{
              padding: "80px 20px",
              textAlign: "center",
              color: theme.mutedTextColor,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: `3px solid ${theme.borderColor}`,
                borderTopColor: theme.accentColor,
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: 500 }}>Loading page content...</span>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error / 404 State */}
        {!loading && error && (
          <div
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.borderColor}`,
              borderRadius: "16px",
              padding: "48px 32px",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: theme.isDark ? "rgba(239,68,68,0.2)" : "#fee2e2",
                color: "#ef4444",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px 0", color: theme.textColor }}>
              Page Not Found
            </h2>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: theme.mutedTextColor, lineHeight: 1.5 }}>
              {error}
            </p>
            <Link
              to={effectiveAppBase || "/"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                background: theme.accentColor,
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "13.5px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <span>← Return to Home</span>
            </Link>
          </div>
        )}

        {/* Loaded Page Content */}
        {!loading && page && (
          <article>
            {/* Page Header Banner */}
            <header
              style={{
                borderBottom: `1px solid ${theme.borderColor}`,
                paddingBottom: "24px",
                marginBottom: "32px",
              }}
            >
              <h1
                style={{
                  fontSize: "clamp(26px, 4vw, 36px)",
                  fontWeight: 800,
                  color: theme.textColor,
                  margin: "0 0 8px 0",
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                }}
              >
                {page.title}
              </h1>
              {page.subtitle && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "clamp(14px, 1.8vw, 16px)",
                    color: theme.mutedTextColor,
                    lineHeight: 1.5,
                  }}
                >
                  {page.subtitle}
                </p>
              )}

              {page.updated_at && (
                <div style={{ marginTop: "12px", fontSize: "12px", color: theme.mutedTextColor }}>
                  Last revised:{" "}
                  {new Date(page.updated_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
            </header>

            {/* Markdown Body Content */}
            <div style={{ fontSize: "15.5px", lineHeight: 1.7 }}>
              <MarkdownContent content={page.content} theme={markdownThemeProps} />
            </div>

            {/* Contact Page Special Components */}
            {(page.page_type === "contact" || page.slug === "contact") && (
              <div style={{ marginTop: "40px" }}>
                {/* Contact Cards Grid */}
                {(page.contact_email || page.contact_phone || page.contact_address || page.contact_hours) && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "16px",
                      marginBottom: "36px",
                    }}
                  >
                    {page.contact_email && (
                      <div
                        style={{
                          background: theme.cardBg,
                          border: `1px solid ${theme.borderColor}`,
                          borderRadius: "12px",
                          padding: "18px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: theme.accentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Email Us
                        </span>
                        <a
                          href={`mailto:${page.contact_email}`}
                          style={{
                            fontSize: "14.5px",
                            fontWeight: 600,
                            color: theme.textColor,
                            textDecoration: "none",
                            wordBreak: "break-all",
                          }}
                        >
                          {page.contact_email}
                        </a>
                      </div>
                    )}

                    {page.contact_phone && (
                      <div
                        style={{
                          background: theme.cardBg,
                          border: `1px solid ${theme.borderColor}`,
                          borderRadius: "12px",
                          padding: "18px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: theme.accentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Call Us
                        </span>
                        <a
                          href={`tel:${page.contact_phone}`}
                          style={{
                            fontSize: "14.5px",
                            fontWeight: 600,
                            color: theme.textColor,
                            textDecoration: "none",
                          }}
                        >
                          {page.contact_phone}
                        </a>
                      </div>
                    )}

                    {page.contact_address && (
                      <div
                        style={{
                          background: theme.cardBg,
                          border: `1px solid ${theme.borderColor}`,
                          borderRadius: "12px",
                          padding: "18px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: theme.accentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Store Headquarters
                        </span>
                        <span style={{ fontSize: "13.5px", color: theme.textColor, lineHeight: 1.4 }}>
                          {page.contact_address}
                        </span>
                      </div>
                    )}

                    {page.contact_hours && (
                      <div
                        style={{
                          background: theme.cardBg,
                          border: `1px solid ${theme.borderColor}`,
                          borderRadius: "12px",
                          padding: "18px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 700, color: theme.accentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Business Hours
                        </span>
                        <span style={{ fontSize: "13px", color: theme.textColor, lineHeight: 1.4 }}>
                          {page.contact_hours}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Page Footer */}
            <div
              style={{
                marginTop: "48px",
                paddingTop: "20px",
                borderTop: `1px solid ${theme.borderColor}`,
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={handleBackToTop}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.mutedTextColor,
                  fontSize: "12.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = theme.textColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = theme.mutedTextColor)}
              >
                ↑ Back to top
              </button>
            </div>
          </article>
        )}
      </div>
    </div>
  );
};

export default StorefrontCustomPage;
