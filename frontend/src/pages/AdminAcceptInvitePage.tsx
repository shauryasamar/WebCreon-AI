import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { GlassToast } from "../Component/GlassToast";

export default function AdminAcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { refreshAdmin } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invitation token is missing. Please check your invitation link.");
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users-roles/invitation/${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Invalid or expired invitation link");
        }
        setInvitationData(data);
      } catch (err: any) {
        setError(err.message || "Failed to verify invitation");
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setToast({ message: "Password is required", type: "error" });
      return;
    }
    if (password !== confirmPassword) {
      setToast({ message: "Passwords do not match", type: "error" });
      return;
    }
    if (password.length < 8) {
      setToast({ message: "Password must be at least 8 characters long", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users-roles/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to set up account");
      }

      const authedUser = await refreshAdmin();
      setToast({ message: "Account created! Redirecting to Webcreon...", type: "success" });
      setTimeout(() => {
        const sites = data?.sites || [];
        if (authedUser && !authedUser.isOwner && sites.length > 0) {
          navigate(`/builder/${sites[0].id}`, { replace: true });
        } else {
          navigate("/admin/sites", { replace: true });
        }
      }, 1000);
    } catch (err: any) {
      setToast({ message: err.message || "Failed to set password", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", color: "#64748b", fontSize: "14px", padding: "20px" }}>
            Verifying your workspace invitation...
          </div>
        </div>
      </div>
    );
  }

  if (error || !invitationData) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "20px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#ef4444",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
              }}
            >
              ✕
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              Invitation Invalid
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13.5px", color: "#64748b", lineHeight: 1.5 }}>
              {error || "This invitation link is invalid or has expired."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/admin/login")}
              style={primaryButtonStyle}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 12px",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
            Accept Invitation
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Welcome, <strong>{invitationData.name}</strong>! You have been invited to join Webcreon as{" "}
            <span style={{ color: "#2563eb", fontWeight: 600 }}>{invitationData.role}</span>.
          </p>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "12.5px",
            color: "#475569",
            marginBottom: "18px",
          }}
        >
          Email: <strong>{invitationData.email}</strong>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Create Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...primaryButtonStyle,
              width: "100%",
              marginTop: "8px",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Setting Password..." : "Activate Account & Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
  padding: "24px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "28px 24px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
  border: "1px solid #e2e8f0",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#334155",
  marginBottom: "5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "38px",
  padding: "0 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: "13px",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 18px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "13.5px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s ease",
};
