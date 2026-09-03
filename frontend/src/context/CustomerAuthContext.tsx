import {
  createContext,
  useCallback,
  useContext,
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

function getTenantToken(websiteName?: string): string | null {
  if (typeof window === "undefined" || !websiteName) return null;
  const clean = websiteName.trim().toLowerCase();
  const base = clean.split("-")[0];
  return (
    localStorage.getItem(`wc_customer_token_${clean}`) ||
    localStorage.getItem(`wc_customer_token_${base}`) ||
    null
  );
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
    if (k) localStorage.setItem(`wc_customer_token_${k}`, token);
  });
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
    if (k) localStorage.removeItem(`wc_customer_token_${k}`);
  });
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(false);

  const clearUser = useCallback((targetTenant?: string) => {
    if (!targetTenant) {
      setUser(null);
      return;
    }
    const cleanTarget = targetTenant.trim().toLowerCase();
    setUser((prev) => {
      if (prev) {
        const prevSlug = (prev.siteSlug || "").trim().toLowerCase();
        const prevId = (prev.siteId || "").trim().toLowerCase();
        if (
          prevSlug === cleanTarget ||
          prevId === cleanTarget ||
          prevSlug.split("-")[0] === cleanTarget
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
      return null;
    }

    // Clear in-memory user only if switching away to another tenant
    const cleanTarget = websiteName.trim().toLowerCase();
    setUser((prev) => {
      if (prev) {
        const prevSlug = (prev.siteSlug || "").trim().toLowerCase();
        const prevId = (prev.siteId || "").trim().toLowerCase();
        if (
          prevSlug !== cleanTarget &&
          prevId !== cleanTarget &&
          prevSlug.split("-")[0] !== cleanTarget
        ) {
          return null;
        }
      }
      return prev;
    });

    setLoading(true);

    try {
      const token = getTenantToken(websiteName);
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
          if (prev) {
            const prevSlug = (prev.siteSlug || "").trim().toLowerCase();
            const prevId = (prev.siteId || "").trim().toLowerCase();
            if (
              prevSlug === cleanTarget ||
              prevId === cleanTarget ||
              prevSlug.split("-")[0] === cleanTarget
            ) {
              return null;
            }
          }
          return prev;
        });
        return null;
      }

      const data = await parseJsonSafely(response);

      if (!response.ok || !data?.user) {
        setUser(null);
        return null;
      }

      if (data?.token) {
        setTenantToken(websiteName, data.token, data.user?.siteId, data.user?.siteSlug);
      }

      setUser(data.user);
      return data.user as CustomerUser;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
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
          setTenantToken(websiteName, data.token);
          if (data.user?.siteSlug) setTenantToken(data.user.siteSlug, data.token);
          if (data.user?.siteId) setTenantToken(data.user.siteId, data.token);
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
          setTenantToken(websiteName, data.token);
          if (data.user?.siteSlug) setTenantToken(data.user.siteSlug, data.token);
          if (data.user?.siteId) setTenantToken(data.user.siteId, data.token);
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
          setTenantToken(websiteName, data.token);
          if (data.user?.siteSlug) setTenantToken(data.user.siteSlug, data.token);
          if (data.user?.siteId) setTenantToken(data.user.siteId, data.token);
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
          setTenantToken(websiteName, data.token);
          if (data.user?.siteSlug) setTenantToken(data.user.siteSlug, data.token);
          if (data.user?.siteId) setTenantToken(data.user.siteId, data.token);
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

        setUser(data.user);
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
    try {
      await fetch(`${API_BASE_URL}/auth/customer/logout`, {
        method: "POST",
        headers: target ? { "X-Site-Id": target } : {},
        credentials: "include",
      });
      if (target) clearTenantToken(target);
      if (user?.siteSlug) clearTenantToken(user.siteSlug);
      if (user?.siteId) clearTenantToken(user.siteId);
      setUser(null);
    } catch (error) {
      console.error("Error logging out customer:", error);
      if (target) clearTenantToken(target);
      if (user?.siteSlug) clearTenantToken(user.siteSlug);
      if (user?.siteId) clearTenantToken(user.siteId);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

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