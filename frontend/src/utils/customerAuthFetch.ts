export function getCustomerToken(siteIdOrSlug?: string): string | null {
  if (typeof window === "undefined") return null;
  const clean = (siteIdOrSlug || "").trim().toLowerCase();
  const base = clean ? clean.split("-")[0] : "";
  if (clean) {
    return (
      localStorage.getItem(`wc_customer_token_${clean}`) ||
      localStorage.getItem(`wc_customer_token_${base}`) ||
      null
    );
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("wc_customer_token_")) {
      const val = localStorage.getItem(key);
      if (val) return val;
    }
  }
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
