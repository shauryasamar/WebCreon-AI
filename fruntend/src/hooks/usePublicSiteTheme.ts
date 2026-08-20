import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

export type PublicSiteData = {
  siteName: string;
  logo?: string;
  navbar?: {
    brandName?: string;
    logoUrl?: string;
  };
  theme: {
    mode?: "light" | "dark";
    primary_bg?: string;
    secondary_bg?: string;
    card_bg?: string;
    text_color?: string;
    accent_color?: string;
    border_color?: string;
  };
};

export function cleanSiteName(rawName?: string, rawSlug?: string): string {
  let name = (rawName || rawSlug || "Store").trim();
  // Remove trailing site IDs or timestamps like "-17234" or "-8932"
  name = name.replace(/[-_]\d+$/g, "").replace(/\d{4,}$/g, "").trim();
  if (!name) name = "Store";
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getLuminance(colorHex?: string): number {
  if (!colorHex || typeof colorHex !== "string") return 0;
  let hex = colorHex.trim().replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return 0;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function getAccessibleAccentColor(accentColor?: string, cardBg?: string): string {
  const accent = accentColor || "#2563eb";
  const bgLuminance = getLuminance(cardBg || "#ffffff");
  const isLightBg = bgLuminance >= 135;
  const accentLuminance = getLuminance(accent);

  // If background is light and accent color is very light (like yellow, neon lime, pastel gold),
  // using it directly for text causes camouflaging. Darken it to a readable tone.
  if (isLightBg && accentLuminance > 160) {
    return "#b45309";
  }
  // If background is dark and accent color is too dark, lighten it
  if (!isLightBg && accentLuminance < 85) {
    return "#60a5fa";
  }
  return accent;
}

export function getContrastTextColor(bgColor?: string, fallback: string = "#0f172a"): string {
  if (!bgColor || typeof bgColor !== "string") return fallback;
  const yiq = getLuminance(bgColor);
  return yiq >= 135 ? "#0f172a" : "#ffffff";
}

const siteThemeMemoryCache = new Map<string, PublicSiteData>();

function getInitialCachedTheme(slug?: string): PublicSiteData | null {
  if (!slug) return null;
  if (siteThemeMemoryCache.has(slug)) {
    return siteThemeMemoryCache.get(slug)!;
  }
  try {
    const raw = sessionStorage.getItem(`wc_site_theme_${slug}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.siteName) {
        siteThemeMemoryCache.set(slug, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function usePublicSiteTheme(slug?: string) {
  const [siteData, setSiteData] = useState<PublicSiteData | null>(() => getInitialCachedTheme(slug));
  const [loadingSite, setLoadingSite] = useState<boolean>(() => !getInitialCachedTheme(slug) && !!slug);

  useEffect(() => {
    if (!slug) {
      setLoadingSite(false);
      return;
    }

    const cached = getInitialCachedTheme(slug);
    if (cached) {
      setSiteData(cached);
    }

    let isMounted = true;
    const fetchSite = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/public/sites/slug/${slug}`);
        if (!res.ok) throw new Error("Site not found");
        const data = await res.json();
        const def = data?.site_definition || {};

        const rawName =
          def.site_name ||
          def.site_title ||
          def.title ||
          def.name ||
          "";

        const formattedName = cleanSiteName(rawName, slug);

        const extractedLogo =
          def.logo ||
          def.header?.logo ||
          def.theme?.logo ||
          undefined;

        const themeObj = def.theme || {};

        const navbarObj = def.navbar || def.header || {};
        const extractedBrandName = navbarObj.brandName || navbarObj.brand_name || rawName || "";

        const finalSiteData: PublicSiteData = {
          siteName: formattedName,
          logo: extractedLogo,
          navbar: {
            brandName: extractedBrandName,
            logoUrl: extractedLogo,
          },
          theme: themeObj,
        };

        siteThemeMemoryCache.set(slug, finalSiteData);
        try {
          sessionStorage.setItem(`wc_site_theme_${slug}`, JSON.stringify(finalSiteData));
        } catch {
          // ignore
        }

        if (isMounted) {
          setSiteData(finalSiteData);
        }
      } catch (err) {
        console.error("Failed to load public site theme:", err);
        if (isMounted && !siteData) {
          setSiteData({
            siteName: cleanSiteName("", slug),
            navbar: {
              brandName: cleanSiteName("", slug),
            },
            theme: {},
          });
        }
      } finally {
        if (isMounted) setLoadingSite(false);
      }
    };

    fetchSite();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  return { siteData, loadingSite };
}
