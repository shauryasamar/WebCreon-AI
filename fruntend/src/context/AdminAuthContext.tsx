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

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to logout admin", err);
    } finally {
      setAdmin(null);
    }
  }, []);

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
