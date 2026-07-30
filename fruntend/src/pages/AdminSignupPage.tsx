import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";

type AdminSignupResponse = {
  admin: {
    id: string;
    email: string;
  };
};

export default function AdminSignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.detail || "Signup failed");
        return;
      }

      const _data: AdminSignupResponse = await response.json();
      navigate("/admin/sites", { replace: true });
    } catch (err) {
      console.error("Admin signup failed", err);
      setError("Unable to create account right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(180deg, #eff6ff 0%, #f8fafc 35%, #ffffff 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          border: "1px solid rgba(17,24,39,0.08)",
          borderRadius: "16px",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
          padding: "32px",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "inline-flex",
              padding: "6px 10px",
              borderRadius: "999px",
              background: "rgba(37,99,235,0.10)",
              border: "1px solid rgba(37,99,235,0.16)",
              color: "#2563eb",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.02em",
              marginBottom: "14px",
            }}
          >
            Admin Signup
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              lineHeight: 1.2,
              color: "#111827",
            }}
          >
            Create your admin account
          </h1>

          <p
            style={{
              marginTop: "10px",
              marginBottom: 0,
              fontSize: "14px",
              lineHeight: 1.6,
              color: "rgba(17,24,39,0.72)",
            }}
          >
            Create an admin account to manage websites, open the builder, and
            control products and orders across your stores.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <label style={{ display: "grid", gap: "8px" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
              style={{
                height: "44px",
                borderRadius: "10px",
                border: "1px solid rgba(17,24,39,0.12)",
                padding: "0 14px",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "8px" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              required
              style={{
                height: "44px",
                borderRadius: "10px",
                border: "1px solid rgba(17,24,39,0.12)",
                padding: "0 14px",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "8px" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Confirm password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              style={{
                height: "44px",
                borderRadius: "10px",
                border: "1px solid rgba(17,24,39,0.12)",
                padding: "0 14px",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
                outline: "none",
              }}
            />
          </label>

          {error ? (
            <div
              style={{
                borderRadius: "10px",
                padding: "12px 14px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "#b91c1c",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              height: "46px",
              borderRadius: "10px",
              border: "none",
              background: submitting ? "#93c5fd" : "#2563eb",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div
          style={{
            marginTop: "18px",
            fontSize: "14px",
            color: "rgba(17,24,39,0.72)",
          }}
        >
          Already have an account?{" "}
          <Link
            to="/admin/login"
            style={{
              color: "#2563eb",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}