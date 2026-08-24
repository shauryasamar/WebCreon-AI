import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { API_BASE_URL } from "../config/api";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
};

type AdminAuthContextType = {
  admin: AdminUser | null;
  loading: boolean;
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
        }
      } catch {}
      setAdmin(null);
    }
  }, [setAdmin]);

  useEffect(() => {
    refreshAdmin();
  }, [refreshAdmin]);

  return (
    <AdminAuthContext.Provider value={{ admin, loading, setAdmin, refreshAdmin, logoutAdmin }}>
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
