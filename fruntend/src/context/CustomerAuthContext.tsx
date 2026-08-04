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
  logout: () => Promise<void>;
  clearUser: () => void;
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
    return null;
  }
}

function getErrorMessage(data: any, fallback: string) {
  if (data?.detail && typeof data.detail === "string") {
    return data.detail;
  }

  return fallback;
}

function extractUser(data: any): CustomerUser {
  if (!data?.user) {
    throw new Error("Invalid customer response");
  }

  return data.user as CustomerUser;
}

export function CustomerAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(false);

  const clearUser = useCallback(() => {
    setUser(null);
  }, []);

  const refreshMe = useCallback(async (websiteName: string) => {
    if (!websiteName) {
      setUser(null);
      return null;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/customer/me/${websiteName}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        setUser(null);
        return null;
      }

      const data = await parseJsonSafely(response);
      const nextUser = extractUser(data);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      console.error("Error checking customer session:", error);
      setUser(null);
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

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, "Customer signup failed")
          );
        }

        const nextUser = extractUser(data);
        setUser(nextUser);
        return nextUser;
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

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, "Customer login failed")
          );
        }

        const nextUser = extractUser(data);
        setUser(nextUser);
        return nextUser;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setLoading(true);

    try {
      await fetch(`${API_BASE_URL}/auth/customer/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
    } catch (error) {
      console.error("Error logging out customer:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      refreshMe,
      signup,
      login,
      logout,
      clearUser,
    }),
    [user, loading, refreshMe, signup, login, logout, clearUser]
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