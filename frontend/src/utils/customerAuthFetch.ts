export function getCustomerToken(siteIdOrSlug?: string): string | null {
  if (typeof window === "undefined") return null;
  const clean = (siteIdOrSlug || "").trim().toLowerCase();
  const base = clean ? clean.split("-")[0] : "";
  if (clean) {
    try {
      const val =
        localStorage.getItem(`wc_customer_token_${clean}`) ||
        localStorage.getItem(`wc_customer_token_${base}`) ||
        sessionStorage.getItem(`wc_customer_token_${clean}`) ||
        sessionStorage.getItem(`wc_customer_token_${base}`);
      if (val) return val;

      // Verify if generic customer user belongs to this specific tenant
      const userRaw =
        localStorage.getItem(`wc_customer_user_${clean}`) ||
        localStorage.getItem(`wc_customer_user_${base}`) ||
        localStorage.getItem("wc_customer_user");
      if (userRaw) {
        try {
          const userObj = JSON.parse(userRaw);
          const uSlug = String(userObj?.siteSlug || "").toLowerCase();
          const uId = String(userObj?.siteId || "").toLowerCase();
          const uBase = uSlug ? uSlug.split("-")[0] : "";
          if (
            uSlug === clean ||
            uId === clean ||
            (base && (uSlug.startsWith(base) || uBase === base))
          ) {
            const generic =
              localStorage.getItem("wc_customer_token") ||
              sessionStorage.getItem("wc_customer_token");
            if (generic) return generic;
          }
        } catch {}
      }
    } catch {}
    // Target site has no valid token for this session: strictly return null (guest mode for this store)
    return null;
  }

  // Fallback when no siteIdOrSlug is specified
  try {
    const generic =
      localStorage.getItem("wc_customer_token") ||
      sessionStorage.getItem("wc_customer_token");
    if (generic) return generic;
  } catch {}
  return null;
}

export function getCustomerAuthHeaders(
  siteIdOrSlug?: string,
  extraHeaders?: HeadersInit
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (extraHeaders) {
    if (extraHeaders instanceof Headers) {
      extraHeaders.forEach((val, key) => {
        headers[key] = val;
      });
    } else if (Array.isArray(extraHeaders)) {
      extraHeaders.forEach(([key, val]) => {
        headers[key] = val;
      });
    } else {
      Object.assign(headers, extraHeaders);
    }
  }

  const token = getCustomerToken(siteIdOrSlug);
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Customer-Token"] = token;
  }
  if (siteIdOrSlug) {
    headers["X-Site-Id"] = siteIdOrSlug;
  }
  return headers;
}

export function clearCustomerToken(siteIdOrSlug?: string): void {
  if (typeof window === "undefined") return;
  const clean = (siteIdOrSlug || "").trim().toLowerCase();
  const base = clean ? clean.split("-")[0] : "";
  try {
    if (clean) {
      localStorage.removeItem(`wc_customer_token_${clean}`);
      localStorage.removeItem(`wc_customer_token_${base}`);
      localStorage.removeItem(`wc_customer_user_${clean}`);
      localStorage.removeItem(`wc_customer_user_${base}`);
      localStorage.removeItem(`wc_customer_orders_${clean}`);
      localStorage.removeItem(`wc_customer_orders_${base}`);
      sessionStorage.removeItem(`wc_customer_token_${clean}`);
      sessionStorage.removeItem(`wc_customer_token_${base}`);
    }
    // Also clear generic token and generic user
    localStorage.removeItem("wc_customer_token");
    localStorage.removeItem("wc_customer_user");
    sessionStorage.removeItem("wc_customer_token");

    if (!clean) {
      clearAllCustomerAuth();
    }
  } catch {}
}

export function clearAllCustomerAuth(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("wc_customer_token");
    localStorage.removeItem("wc_customer_user");
    sessionStorage.removeItem("wc_customer_token");

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("wc_customer_token") ||
          key.startsWith("wc_customer_user") ||
          key.startsWith("wc_customer_orders_"))
      ) {
        localStorage.removeItem(key);
      }
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("wc_customer_token")) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

