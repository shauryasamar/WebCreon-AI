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

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
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
          method: "GET",
          credentials: "include",
        }
      );

      if (response.status === 401 || response.status === 403) {
        setUser(null);
        return null;
      }

      const data = await parseJsonSafely(response);

      if (!response.ok || !data?.user) {
        setUser(null);
        return null;
      }

      setUser(data.user);
      return data.user as CustomerUser;
    } catch {
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

        if (!response.ok || !data?.user) {
          throw new Error(getErrorMessage(data, "Customer signup failed"));
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
        const response = await fetch(
          `${API_BASE_URL}/auth/customer/profile/${websiteName}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
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
        const response = await fetch(
          `${API_BASE_URL}/auth/customer/change-password/${websiteName}`,
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