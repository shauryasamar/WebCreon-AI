export function getApiBaseUrl(): string {
  const envBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envBaseUrl && envBaseUrl.trim()) {
    return envBaseUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export const API_BASE_URL = getApiBaseUrl();