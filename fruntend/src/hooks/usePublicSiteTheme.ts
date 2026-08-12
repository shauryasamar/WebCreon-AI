import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

export type PublicSiteData = {
  siteName: string;
  logo?: string;
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

export function getContrastTextColor(bgColor?: string, fallback: string = "#0f172a"): string {
  if (!bgColor || typeof bgColor !== "string") return fallback;
  let hex = bgColor.trim().replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return fallback;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 135 ? "#0f172a" : "#ffffff";
}

export function usePublicSiteTheme(slug?: string) {
  const [siteData, setSiteData] = useState<PublicSiteData | null>(null);
  const [loadingSite, setLoadingSite] = useState<boolean>(!!slug);

  useEffect(() => {
    if (!slug) {
      setLoadingSite(false);
      return;
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

        if (isMounted) {
          setSiteData({
            siteName: formattedName,
            logo: extractedLogo,
            theme: themeObj,
          });
        }
      } catch (err) {
        console.error("Failed to load public site theme:", err);
        if (isMounted) {
          setSiteData({
            siteName: cleanSiteName("", slug),
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
