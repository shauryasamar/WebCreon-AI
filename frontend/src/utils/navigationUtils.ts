/**
 * navigationUtils.ts
 *
 * Centralized utility for handling client-side SPA storefront navigation.
 * Normalizes full URLs (including localhost and current origin), relative paths,
 * section filter query strings, and custom page routes so that clicking CTA
 * buttons does not trigger full webpage reloads.
 */

export function resolveInternalStoreNavigation(
  href: string | undefined | null,
  appBase?: string,
  siteSlug?: string
): string | null {
  if (!href || href === "#" || href.trim() === "") {
    return null;
  }

  const trimmed = href.trim();

  // Protocols that must be handled by browser natively
  if (
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:")
  ) {
    return null;
  }

  const resolvedBase = (appBase || (siteSlug ? `/store/${siteSlug}` : "")).replace(/\/+$/, "");

  let pathname = "";
  let search = "";
  let hash = "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const currentHost = typeof window !== "undefined" ? window.location.host : "";

      const isSameOriginOrHost =
        (currentOrigin && parsed.origin === currentOrigin) ||
        (currentHost && parsed.host === currentHost) ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1";

      const path = parsed.pathname;
      const isKnownStorePath =
        path.startsWith("/store/") ||
        path.startsWith("/builder/") ||
        path.startsWith("/pages/") ||
        path === "/products" ||
        path === "/product" ||
        path === "/categories" ||
        path === "/cart" ||
        path === "/checkout" ||
        path === "/orders" ||
        path === "/profile" ||
        path === "/support" ||
        path === "/about" ||
        path === "/contact" ||
        path === "/privacy" ||
        path === "/terms" ||
        path === "/story";

      if (!isSameOriginOrHost && !isKnownStorePath) {
        // Genuine external third-party URL (e.g. social media, external link)
        return null;
      }

      pathname = parsed.pathname;
      search = parsed.search;
      hash = parsed.hash;
    } catch (_) {
      return null;
    }
  } else {
    // Relative URL, query, or hash
    const hashIndex = trimmed.indexOf("#");
    let withoutHash = trimmed;
    if (hashIndex !== -1) {
      hash = trimmed.slice(hashIndex);
      withoutHash = trimmed.slice(0, hashIndex);
    }
    const queryIndex = withoutHash.indexOf("?");
    if (queryIndex !== -1) {
      search = withoutHash.slice(queryIndex);
      pathname = withoutHash.slice(0, queryIndex);
    } else {
      pathname = withoutHash;
    }
  }

  // Pure hash link
  if (!pathname && !search && hash) {
    return hash;
  }

  // Pure query string (e.g. ?section_title=... or ?category=...)
  if (!pathname && search) {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    if (resolvedBase && currentPath.startsWith(resolvedBase)) {
      return `${currentPath}${search}${hash}`;
    }
    return resolvedBase ? `${resolvedBase}/${search}${hash}` : `${search}${hash}`;
  }

  // Ensure leading slash
  let cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  // If in builder mode (/builder/:siteId) and path points to /store/:slug/...
  if (resolvedBase && resolvedBase.startsWith("/builder/")) {
    cleanPath = cleanPath.replace(/^\/store\/[^/]+/, resolvedBase);
  } else if (resolvedBase && siteSlug && cleanPath.startsWith("/store/")) {
    // Ensure store slug matches current active store
    cleanPath = cleanPath.replace(/^\/store\/[^/]+/, `/store/${siteSlug}`);
  }

  // If path does not yet contain resolvedBase and is a relative page/catalog route
  if (
    resolvedBase &&
    !cleanPath.startsWith(resolvedBase) &&
    !cleanPath.startsWith("/store/") &&
    !cleanPath.startsWith("/builder/")
  ) {
    cleanPath = `${resolvedBase}${cleanPath}`;
  }

  return `${cleanPath}${search}${hash}`;
}
