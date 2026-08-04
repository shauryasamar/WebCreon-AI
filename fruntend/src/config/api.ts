export function getApiBaseUrl(): string {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  console.log(envBaseUrl)
  if (envBaseUrl && envBaseUrl.trim()) {
    return envBaseUrl.replace(/\/+$/, "");
  }
  return "http://localhost:8000";
}

export const API_BASE_URL = getApiBaseUrl();