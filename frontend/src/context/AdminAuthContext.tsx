import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import { clearSavedSitesMemoryCache } from "../utils/savedSitesCache";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  gender?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: string;
  roleId?: string | null;
  permissions?: string[];
  websiteAccessType?: "all" | "specific";
  status?: string;
  isActive?: boolean;
  authProvider?: string;
  googleId?: string | null;
  timezone?: string;
  hasPassword?: boolean;
  createdAt?: string | null;
};

type AdminAuthContextType = {
  admin: AdminUser | null;
  loading: boolean;
  isOwner: boolean;
  hasPermission: (permissionKey: string) => boolean;
  setAdmin: (admin: AdminUser | null) => void;
  refreshAdmin: () => Promise<AdminUser | null>;
  logoutAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_STORAGE_KEY = "wc_admin_profile";

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

  const setAdmin = useCallback((next: AdminUser | null) => {
    setAdminState(next);
    try {
      if (typeof window !== "undefined") {
        if (next) {
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(next));
        } else {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
        }
      }
    } catch {}
  }, []);

  const refreshAdmin = useCallback(async (): Promise<AdminUser | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/me`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.admin) {
          setAdmin(data.admin);
          return data.admin;
        }
      }
      setAdmin(null);
      return null;
    } catch (err) {
      console.error("Failed to fetch admin profile", err);
      setAdmin(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setAdmin]);

  const logoutAdmin = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to logout admin", err);
    } finally {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
          Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith("webnirmaan_copilot_chat_")) {
              sessionStorage.removeItem(key);
            }
          });
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("webnirmaan_copilot_chat_")) {
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
