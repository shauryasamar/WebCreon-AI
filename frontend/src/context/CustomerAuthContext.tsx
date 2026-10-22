import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { API_BASE_URL } from "../config/api";

export type CustomerUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  authProvider?: string;
  avatarUrl?: string | null;
  hasPassword?: boolean;
  isActive: boolean;
  siteId: string;
  siteSlug: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type CustomerSignupPayload = {
  name: string;
  email: string;
  password: string;
};

type CustomerLoginPayload = {
  email: string;
  password: string;
};

type CustomerProfileUpdatePayload = {
  name?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
};

type CustomerChangePasswordPayload = {
  current_password?: string;
  new_password: string;
};

type CustomerAuthContextValue = {
  user: CustomerUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshMe: (websiteName: string) => Promise<CustomerUser | null>;
  signup: (
    websiteName: string,
    payload: CustomerSignupPayload
  ) => Promise<CustomerUser>;
  login: (
    websiteName: string,
    payload: CustomerLoginPayload
  ) => Promise<CustomerUser>;
  loginWithGoogle: (
    websiteName: string,
    idToken: string
  ) => Promise<CustomerUser>;
  forgotPassword: (
    websiteName: string,
    email: string
  ) => Promise<{ message: string; dev_otp?: string }>;
  resetPassword: (
    websiteName: string,
    payload: { email: string; otp: string; new_password: string }
  ) => Promise<CustomerUser>;
  updateProfile: (
    websiteName: string,
    payload: CustomerProfileUpdatePayload
  ) => Promise<CustomerUser>;
  changePassword: (
    websiteName: string,
    payload: CustomerChangePasswordPayload
  ) => Promise<{ message: string; user?: CustomerUser }>;
  logout: (websiteName?: string) => Promise<void>;
  deleteAccount: (websiteName: string) => Promise<void>;
  clearUser: (targetTenant?: string) => void;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(
  undefined
);

async function parseJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getErrorMessage(data: any, fallback: string) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.message === "string") return data.message;
  return fallback;
}

function evictBulkyLocalStorageCaches() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Do NOT remove customer auth tokens or essential credentials
      if (
        key.startsWith("wc_customer_token_") ||
        key.startsWith("wc_admin_token") ||
        key === "admin_user_session"
      ) {
        continue;
      }
      // Target bulky snapshot / theme / chat / orders caches that fill the 5MB browser quota
      if (
        key.startsWith("wc_site_snapshot_") ||
        key.startsWith("webnirmaan_copilot_chat_") ||
        key.startsWith("webnirmaan_saved_themes_") ||
        key.startsWith("wc_published_site_def_") ||
        key.startsWith("wc_admin_products_") ||
        key.startsWith("wc_admin_orders_") ||
        key.startsWith("wc_customer_orders_")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch {}
}

function isSameTenant(tenantA?: string | null, tenantB?: string | null): boolean {
  if (!tenantA || !tenantB) return false;
  const a = tenantA.trim().toLowerCase();
  const b = tenantB.trim().toLowerCase();
  if (a === b) return true;
  const baseA = a.split("-")[0];
  const baseB = b.split("-")[0];
  if (baseA && baseB && baseA === baseB) return true;
  if (baseA && baseA === b) return true;
  if (baseB && baseB === a) return true;
  return false;
}

function getTenantToken(websiteName?: string): string | null {
  if (typeof window === "undefined") return null;
  const clean = websiteName ? websiteName.trim().toLowerCase() : "";
  const base = clean ? clean.split("-")[0] : "";
  try {
    if (clean) {
      const direct =
        localStorage.getItem(`wc_customer_token_${clean}`) ||
        localStorage.getItem(`wc_customer_token_${base}`) ||
        sessionStorage.getItem(`wc_customer_token_${clean}`) ||
        sessionStorage.getItem(`wc_customer_token_${base}`);
      if (direct) return direct;

      // Scan all stored keys for partial match or prefix match
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("wc_customer_token_")) {
          const storedTenant = k.replace("wc_customer_token_", "").toLowerCase();
          if (
            storedTenant === clean ||
            storedTenant === base ||
            (base && storedTenant.split("-")[0] === base) ||
            clean.startsWith(storedTenant) ||
            storedTenant.startsWith(clean)
          ) {
            const val = localStorage.getItem(k);
            if (val) return val;
          }
        }
      }
    }

    return (
      localStorage.getItem("wc_customer_token") ||
      sessionStorage.getItem("wc_customer_token") ||
      null
    );
  } catch {
    return null;
  }
}

function saveCustomerUserCache(userData: CustomerUser, websiteName?: string) {
  if (typeof window === "undefined" || !userData) return;
  try {
    const serialized = JSON.stringify(userData);
    const keys = new Set<string>();
    if (websiteName) {
      const clean = websiteName.trim().toLowerCase();
      keys.add(clean);
      keys.add(clean.split("-")[0]);
    }
    if (userData.siteId) keys.add(userData.siteId.trim().toLowerCase());
    if (userData.siteSlug) {
      const cleanSlug = userData.siteSlug.trim().toLowerCase();
      keys.add(cleanSlug);
      keys.add(cleanSlug.split("-")[0]);
    }
    keys.forEach((k) => {
      if (k) localStorage.setItem(`wc_customer_user_${k}`, serialized);
    });
    localStorage.setItem("wc_customer_user", serialized);
  } catch {}
}

function getCustomerUserCache(websiteName?: string): CustomerUser | null {
  if (typeof window === "undefined") return null;
  try {
    if (websiteName) {
      const clean = websiteName.trim().toLowerCase();
      const base = clean.split("-")[0];
      const raw =
        localStorage.getItem(`wc_customer_user_${clean}`) ||
        localStorage.getItem(`wc_customer_user_${base}`) ||
        localStorage.getItem("wc_customer_user");
      if (raw) return JSON.parse(raw);
    }
    const generic = localStorage.getItem("wc_customer_user");
    if (generic) return JSON.parse(generic);
  } catch {}
  return null;
}

function setTenantToken(websiteName: string, token: string, siteId?: string, siteSlug?: string) {
  if (typeof window === "undefined" || !token) return;
  const keys = new Set<string>();
  if (websiteName) {
    const clean = websiteName.trim().toLowerCase();
    keys.add(clean);
    keys.add(clean.split("-")[0]);
  }
  if (siteId) {
    keys.add(siteId.trim().toLowerCase());
  }
  if (siteSlug) {
    const cleanSlug = siteSlug.trim().toLowerCase();
    keys.add(cleanSlug);
    keys.add(cleanSlug.split("-")[0]);
  }
  keys.forEach((k) => {
    if (!k) return;
    try {
      localStorage.setItem(`wc_customer_token_${k}`, token);
    } catch {
      // Quota exceeded: evict non-essential bulky caches and retry
      try {
        evictBulkyLocalStorageCaches();
        localStorage.setItem(`wc_customer_token_${k}`, token);
      } catch {
        // Fallback to sessionStorage so login never crashes or fails
        try {
          sessionStorage.setItem(`wc_customer_token_${k}`, token);
        } catch {}
      }
    }
  });
  try {
    const prevToken = localStorage.getItem("wc_customer_token");
    if (prevToken !== token) {
      localStorage.setItem("wc_customer_token", token);
      window.dispatchEvent(
        new CustomEvent("wc_customer_auth_changed", {
          detail: { token, siteId, websiteName, siteSlug },
        })
      );
    }
  } catch {}
}

function clearTenantToken(websiteName?: string, siteId?: string, siteSlug?: string) {
  if (typeof window === "undefined") return;
  const keys = new Set<string>();
  if (websiteName) {
    const clean = websiteName.trim().toLowerCase();
    keys.add(clean);
    keys.add(clean.split("-")[0]);
  }
  if (siteId) {
    keys.add(siteId.trim().toLowerCase());
  }
  if (siteSlug) {
    const cleanSlug = siteSlug.trim().toLowerCase();
    keys.add(cleanSlug);
    keys.add(cleanSlug.split("-")[0]);
  }
  keys.forEach((k) => {
    if (k) {
      try {
        localStorage.removeItem(`wc_customer_token_${k}`);
        localStorage.removeItem(`wc_customer_user_${k}`);
      } catch {}
      try {
        sessionStorage.removeItem(`wc_customer_token_${k}`);
      } catch {}
      try {
        localStorage.removeItem(`wc_customer_orders_${k}`);
        localStorage.removeItem(`guest_cart:${k}`);
      } catch {}
    }
  });

  // Always remove generic fallback keys to prevent stale authentication leaks
  try {
    localStorage.removeItem("wc_customer_token");
    localStorage.removeItem("wc_customer_user");
    sessionStorage.removeItem("wc_customer_token");
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent("wc_customer_auth_changed", {
        detail: { token: null, siteId, websiteName, siteSlug },
      })
    );
  } catch {}
}

// Global deduplication and rate-limiting maps to prevent duplicate concurrent /me requests
const inFlightMe = new Map<string, Promise<CustomerUser | null>>();
const lastMeChecked = new Map<string, number>();

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const path = window.location.pathname;
      const parts = path.split("/");
      const tenant = (parts[1] === "store" || parts[1] === "builder") ? parts[2] : null;
      if (tenant) {
        const clean = tenant.trim().toLowerCase();
        const base = clean.split("-")[0];
        const cached =
          localStorage.getItem(`wc_customer_user_${clean}`) ||
          localStorage.getItem(`wc_customer_user_${base}`) ||
          localStorage.getItem("wc_customer_user");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (isSameTenant(parsed.siteSlug, tenant) || isSameTenant(parsed.siteId, tenant))) {
            return parsed;
          }
        }
      }
      const generic = localStorage.getItem("wc_customer_user");
      if (generic) return JSON.parse(generic);
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(false);

  const clearUser = useCallback((targetTenant?: string) => {
    if (!targetTenant) {
      setUser(null);
      return;
    }
    const cleanTarget = targetTenant.trim().toLowerCase();
    setUser((prev) => {
      if (prev) {
        if (
          isSameTenant(prev.siteSlug, cleanTarget) ||
          isSameTenant(prev.siteId, cleanTarget)
        ) {
          return null;
        }
      }
      return prev;
    });
  }, []);

  const refreshMe = useCallback(async (websiteName: string) => {
    if (!websiteName) {
      setUser(null);
      setLoading(false);
      return null;
    }

    const cleanTarget = websiteName.trim().toLowerCase();

    // Deduplicate in-flight requests for the exact same store
    if (inFlightMe.has(cleanTarget)) {
      return inFlightMe.get(cleanTarget)!;
    }

    // 30-second rate-limit guard: if already fetched recently, return cached customer profile
    const now = Date.now();
    const lastTime = lastMeChecked.get(cleanTarget) || 0;
    if (now - lastTime < 30000) {
      const cached = getCustomerUserCache(websiteName);
      if (cached && (isSameTenant(cached.siteSlug, cleanTarget) || isSameTenant(cached.siteId, cleanTarget))) {
        setUser(cached);
        return cached;
      }
    }

    // Clear in-memory user only if switching away to an entirely DIFFERENT store
    setUser((prev) => {
      if (prev) {
        if (
          !isSameTenant(prev.siteSlug, cleanTarget) &&
          !isSameTenant(prev.siteId, cleanTarget)
        ) {
          return null;
        }
      }
      return prev;
    });

    const token = getTenantToken(websiteName);
    if (!token) {
      // If no token found for this store, preserve in-memory user if already authenticated for it
      setUser((prev) => {
        if (prev && (isSameTenant(prev.siteSlug, cleanTarget) || isSameTenant(prev.siteId, cleanTarget))) {
          return prev;
        }
        return null;
      });
      setLoading(false);
      return null;
    }

    const fetchPromise = (async (): Promise<CustomerUser | null> => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
          headers["X-Customer-Token"] = token;
        }
        headers["X-Site-Id"] = websiteName;

        const response = await fetch(
          `${API_BASE_URL}/auth/customer/me/${websiteName}`,
          {
            method: "GET",
            headers,
            credentials: "include",
          }
        );

        if (response.status === 401 || response.status === 403) {
          clearTenantToken(websiteName);
          setUser((prev) => {
            if (prev && (isSameTenant(prev.siteSlug, cleanTarget) || isSameTenant(prev.siteId, cleanTarget))) {
              return null;
            }
            return prev;
          });
          return null;
        }

        const data = await parseJsonSafely(response);

        if (!response.ok || !data?.user) {
          return null;
        }

        lastMeChecked.set(cleanTarget, Date.now());
        saveCustomerUserCache(data.user, websiteName);

        setUser(data.user);
        return data.user as CustomerUser;
      } catch {
        return null;
      } finally {
        setLoading(false);
        inFlightMe.delete(cleanTarget);
      }
    })();

    inFlightMe.set(cleanTarget, fetchPromise);
    return fetchPromise;
  }, []);

  const signup = useCallback(
    async (websiteName: string, payload: CustomerSignupPayload) => {
      setLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/customer/signup/${websiteName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );

        const data = await parseJsonSafely(response);

        if (!response.ok || !data?.user) {
          throw new Error(getErrorMessage(data, "Customer signup failed"));
        }

        if (data?.token) {
          setTenantToken(websiteName, data.token, data.user?.siteId, data.user?.siteSlug);
        }
        if (data?.user) {
          saveCustomerUserCache(data.user, websiteName);
        }

        setUser(data.user);
        return data.user as CustomerUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const login = useCallback(
    async (websiteName: string, payload: CustomerLoginPayload) => {
      setLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/customer/login/${websiteName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );

        const data = await parseJsonSafely(response);

        if (!response.ok || !data?.user) {
          throw new Error(getErrorMessage(data, "Customer login failed"));
        }

        if (data?.token) {
          setTenantToken(websiteName, data.token, data.user?.siteId, data.user?.siteSlug);
        }
        if (data?.user) {
          saveCustomerUserCache(data.user, websiteName);
        }

        setUser(data.user);
        return data.user as CustomerUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loginWithGoogle = useCallback(
    async (websiteName: string, idToken: string) => {
      setLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/customer/google/${websiteName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ id_token: idToken }),
          }
        );

        const data = await parseJsonSafely(response);

        if (!response.ok || !data?.user) {
          throw new Error(getErrorMessage(data, "Google sign-in failed"));
        }

        if (data?.token) {
          setTenantToken(websiteName, data.token, data.user?.siteId, data.user?.siteSlug);
        }
        if (data?.user) {
          saveCustomerUserCache(data.user, websiteName);
        }

        setUser(data.user);
        return data.user as CustomerUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const forgotPassword = useCallback(
    async (websiteName: string, email: string) => {
      setLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/customer/forgot-password/${websiteName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ email }),
          }
        );

        const data = await parseJsonSafely(response);

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, "Failed to dispatch password reset code")
          );
        }

        return data || { message: "Verification code sent." };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const resetPassword = useCallback(
    async (
      websiteName: string,
      payload: { email: string; otp: string; new_password: string }
    ) => {
      setLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/customer/reset-password/${websiteName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email: payload.email,
              token_or_otp: payload.otp,
              new_password: payload.new_password,
            }),
          }
        );

        const data = await parseJsonSafely(response);

        if (!response.ok || !data?.user) {
          throw new Error(
            getErrorMessage(data, "Failed to reset customer password")
          );
        }

        if (data?.token) {
          setTenantToken(websiteName, data.token, data.user?.siteId, data.user?.siteSlug);
        }
        if (data?.user) {
          saveCustomerUserCache(data.user, websiteName);
        }

        setUser(data.user);
        return data.user as CustomerUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateProfile = useCallback(
    async (websiteName: string, payload: CustomerProfileUpdatePayload) => {
      setLoading(true);

      try {
        const token = getTenantToken(websiteName);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
          headers["X-Customer-Token"] = token;
        }

        const response = await fetch(
          `${API_BASE_URL}/auth/customer/profile/${websiteName}`,
          {
            method: "PUT",
            headers,
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );

        const data = await parseJsonSafely(response);

        if (!response.ok || !data?.user) {
          throw new Error(
            getErrorMessage(data, "Failed to update profile")
          );
        }

        if (data?.user) {
          saveCustomerUserCache(data.user, websiteName);
          setUser(data.user);
        }
        return data.user as CustomerUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const changePassword = useCallback(
    async (websiteName: string, payload: CustomerChangePasswordPayload) => {
      setLoading(true);

      try {
        const token = getTenantToken(websiteName);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
          headers["X-Customer-Token"] = token;
        }

        const response = await fetch(
          `${API_BASE_URL}/auth/customer/change-password/${websiteName}`,
          {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );

        const data = await parseJsonSafely(response);

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, "Failed to update password")
          );
        }

        if (data?.user) {
          saveCustomerUserCache(data.user, websiteName);
          setUser(data.user);
        }

        return data || { message: "Password updated successfully" };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async (websiteName?: string) => {
    setLoading(true);

    const target = websiteName || user?.siteSlug || user?.siteId;
    const token = getTenantToken(target);
    const headers: Record<string, string> = {};
    if (target) headers["X-Site-Id"] = target;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["X-Customer-Token"] = token;
    }
    try {
      await fetch(`${API_BASE_URL}/auth/customer/logout`, {
        method: "POST",
        headers,
        credentials: "include",
      });
    } catch (error) {
      console.error("Error logging out customer:", error);
    } finally {
      clearTenantToken(target, user?.siteId, user?.siteSlug);
      try {
        localStorage.removeItem("wc_customer_token");
        localStorage.removeItem("wc_customer_user");
        sessionStorage.removeItem("wc_customer_token");
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith("wc_customer_orders_") ||
              k.startsWith("wc_customer_user_") ||
              k.startsWith("wc_customer_token_"))
          ) {
            localStorage.removeItem(k);
          }
        }
      } catch {}
      setUser(null);
      setLoading(false);
      try {
        window.dispatchEvent(
          new CustomEvent("wc_customer_auth_changed", {
            detail: { token: null, siteId: user?.siteId, websiteName: target, siteSlug: user?.siteSlug },
          })
        );
      } catch {}
    }
  }, [user]);

  const deleteAccount = useCallback(async (websiteName: string) => {
    setLoading(true);
    const target = websiteName || user?.siteSlug || user?.siteId;
    try {
      const token = getTenantToken(target);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["X-Customer-Token"] = token;
      }
      const response = await fetch(`${API_BASE_URL}/auth/customer/account/${encodeURIComponent(target)}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to delete account."));
      }
      clearTenantToken(target, user?.siteId, user?.siteSlug);
      setUser(null);
    } catch (error) {
      console.error("Error deleting customer account:", error);
      clearTenantToken(target, user?.siteId, user?.siteSlug);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Sync customer authentication across tabs automatically
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith("wc_customer_token_")) {
        const tenantKey = event.key.replace("wc_customer_token_", "");
        if (event.newValue) {
          refreshMe(tenantKey);
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      refreshMe,
      signup,
      login,
      loginWithGoogle,
      forgotPassword,
      resetPassword,
      updateProfile,
      changePassword,
      logout,
      deleteAccount,
      clearUser,
    }),
    [
      user,
      loading,
      refreshMe,
      signup,
      login,
      loginWithGoogle,
      forgotPassword,
      resetPassword,
      updateProfile,
      changePassword,
      logout,
      deleteAccount,
      clearUser,
    ]
  );

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);

  if (!context) {
    throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  }

  return context;
}