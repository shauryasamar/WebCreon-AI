import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import { clearSavedSitesMemoryCache } from "../utils/savedSitesCache";
import { setThemeCookie } from "./ThemeContext";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  gender?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: string;
  roleId?: string | null;
  isOwner?: boolean;
  permissions?: string[];
  websiteAccessType?: "all" | "specific";
  status?: string;
  isActive?: boolean;
  authProvider?: string;
  googleId?: string | null;
  timezone?: string;
  themePreference?: "light" | "dark" | "system" | string | null;
  hasPassword?: boolean;
  createdAt?: string | null;
};

type AdminAuthContextType = {
  admin: AdminUser | null;
  loading: boolean;
  isOwner: boolean;
  hasPermission: (permissionKey: string) => boolean;
  setAdmin: (admin: AdminUser | null, token?: string | null) => void;
  refreshAdmin: () => Promise<AdminUser | null>;
  logoutAdmin: () => Promise<void>;
  deleteAdminAccount: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const ADMIN_STORAGE_KEY = "wc_admin_profile";
export const ADMIN_TOKEN_KEY = "wc_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem(ADMIN_TOKEN_KEY) ||
      sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {}
}

export function getAdminAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAdminToken();
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Admin-Token"] = token;
  }
  return headers;
}

function getCachedAdmin(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id || parsed?.email) {
      return parsed as AdminUser;
    }
  } catch {}
  return null;
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdminState] = useState<AdminUser | null>(getCachedAdmin);
  const [loading, setLoading] = useState<boolean>(() => !getCachedAdmin());

  const setAdmin = useCallback((next: AdminUser | null, token?: string | null) => {
    setAdminState(next);
    try {
      if (typeof window !== "undefined") {
        if (next) {
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(next));
          if (token !== undefined) {
            setAdminToken(token);
          }
          if (next.themePreference && (next.themePreference === "light" || next.themePreference === "dark" || next.themePreference === "system")) {
            const currentSaved = localStorage.getItem("app_theme_mode");
            if (currentSaved !== next.themePreference) {
              localStorage.setItem("app_theme_mode", next.themePreference);
              setThemeCookie(next.themePreference, 365);
              window.dispatchEvent(new CustomEvent("wc-theme-change", { detail: next.themePreference }));
            }
          }
        } else {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          setAdminToken(null);
        }
      }
    } catch {}
  }, []);

  const refreshAdmin = useCallback(async (): Promise<AdminUser | null> => {
    try {
      const headers = getAdminAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/admin/me`, {
        headers,
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.admin) {
          if (data.token) {
            setAdminToken(data.token);
          }
          setAdmin(data.admin, data.token || undefined);
          return data.admin;
        }
      }
      if (response.status === 401 || response.status === 403) {
        setAdmin(null);
        return null;
      }
      // If server returned 5xx or unexpected status, keep cached session if available
      return getCachedAdmin();
    } catch (err) {
      console.error("Failed to fetch admin profile", err);
      // Network failure or temporary glitch: retain cached profile if available
      const cached = getCachedAdmin();
      if (cached) return cached;
      setAdmin(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setAdmin]);

  const logoutAdmin = useCallback(async () => {
    try {
      const headers = getAdminAuthHeaders();
      await fetch(`${API_BASE_URL}/auth/admin/logout`, {
        method: "POST",
        headers,
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to logout admin", err);
    } finally {
      try {
        if (typeof window !== "undefined") {
          setAdminToken(null);
          Object.keys(sessionStorage).forEach((key) => {
            if (
              key.startsWith("webnirmaan_copilot_chat_") ||
              key.startsWith("webnirmaan_onboarding_") ||
              key.startsWith("wc_onboarding_") ||
              key.startsWith("wc_undo_stack_") ||
              key.startsWith("wc_redo_stack_") ||
              key.startsWith("wc_client_draft_")
            ) {
              sessionStorage.removeItem(key);
            }
          });
          Object.keys(localStorage).forEach((key) => {
            if (
              key.startsWith("webnirmaan_copilot_chat_") ||
              key.startsWith("webnirmaan_onboarding_") ||
              key.startsWith("wc_onboarding_") ||
              key.startsWith("wc_site_snapshot_") ||
              key.startsWith("wc_theme_") ||
              key.startsWith("wc_admin_")
            ) {
              localStorage.removeItem(key);
            }
          });
          localStorage.removeItem("wc_admin_saved_sites");
          clearSavedSitesMemoryCache();
        }
      } catch {}
      setAdmin(null);
    }
  }, [setAdmin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    const hasAdminSession = Boolean(localStorage.getItem(ADMIN_STORAGE_KEY));
    const isAdminRoute =
      path.startsWith("/admin") ||
      path.startsWith("/builder") ||
      path.startsWith("/dashboard") ||
      path.startsWith("/seller");

    // Only query /auth/admin/me if visiting an admin route or an admin session is stored
    if (hasAdminSession || isAdminRoute) {
      refreshAdmin();
    } else {
      setLoading(false);
    }
  }, [refreshAdmin]);

  const isOwner = Boolean(
    admin &&
    (admin as any).isOwner !== false &&
    (
      (admin as any).isOwner === true ||
      admin.role === "Owner" ||
      (!admin.roleId && admin.role === "super_admin")
    )
  );

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      if (!admin) return false;
      if (isOwner) {
        return true;
      }
      if (!admin.permissions || !Array.isArray(admin.permissions)) return false;
      if (admin.permissions.includes("*") || admin.permissions.includes("all")) return true;
      if (admin.permissions.includes(permissionKey)) return true;
      // Backward/forward compatibility aliases
      if (permissionKey === "chat:access" && (admin.permissions.includes("chat:view") || admin.permissions.includes("chat:send"))) return true;
      if (permissionKey === "chat:view" && admin.permissions.includes("chat:access")) return true;
      if (permissionKey === "customize:edit" && admin.permissions.includes("customize:view")) return true;
      if (permissionKey === "customize:view" && admin.permissions.includes("customize:edit")) return true;
      const [cat] = permissionKey.split(":");
      if (cat && admin.permissions.includes(`${cat}:*`)) return true;
      return false;
    },
    [admin, isOwner]
  );

  const deleteAdminAccount = useCallback(async () => {
    const headers = getAdminAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/auth/admin/account`, {
      method: "DELETE",
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || data.message || "Failed to delete account");
    }

    // Only clear local session and auth state on successful deletion
    try {
      if (typeof window !== "undefined") {
        setAdminToken(null);
        Object.keys(sessionStorage).forEach((key) => {
          if (
            key.startsWith("webnirmaan_copilot_chat_") ||
            key.startsWith("webnirmaan_onboarding_") ||
            key.startsWith("wc_onboarding_")
          ) {
            sessionStorage.removeItem(key);
          }
        });
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith("webnirmaan_copilot_chat_") ||
            key.startsWith("webnirmaan_onboarding_") ||
            key.startsWith("wc_onboarding_") ||
            key.startsWith("wc_site_snapshot_") ||
            key.startsWith("wc_theme_") ||
            key.startsWith("wc_admin_")
          ) {
            localStorage.removeItem(key);
          }
        });
        localStorage.removeItem("wc_admin_saved_sites");
        clearSavedSitesMemoryCache();
      }
    } catch {}
    setAdmin(null);
  }, [setAdmin]);

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        isOwner,
        hasPermission,
        setAdmin,
        refreshAdmin,
        logoutAdmin,
        deleteAdminAccount,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};
