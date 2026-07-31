import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";

type LocationState = {
  from?: string;
};

export default function CustomerSignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { signup, loading } = useCustomerAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const websiteName = slug || "";
  const from = (location.state as LocationState | null)?.from;
  const redirectTo = useMemo(() => {
    if (from && from.trim()) {
      return from;
    }

    if (websiteName) {
      return `/store/${websiteName}/account`;
    }

    return "/";
  }, [from, websiteName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!websiteName) {
      setError("Missing site slug");
      return;
    }

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email and password are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await signup(websiteName, {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Customer signup failed";
      setError(message);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#111827",
          color: "#f9fafb",
          borderRadius: "20px",
          padding: "24px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Customer Sign Up
          </h1>
          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              fontSize: "14px",
              color: "rgba(249,250,251,0.72)",
            }}
          >
            Create your account to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <label
              htmlFor="customer-name"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Full name
            </label>
            <input
              id="customer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Enter your name"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#0b1220",
                color: "#f9fafb",
                outline: "none",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="customer-email"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Email
            </label>
            <input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="Enter your email"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#0b1220",
                color: "#f9fafb",
                outline: "none",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="customer-password"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Password
            </label>
            <input
              id="customer-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Create a password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#0b1220",
                color: "#f9fafb",
                outline: "none",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="customer-confirm-password"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Confirm password
            </label>
            <input
              id="customer-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Confirm your password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#0b1220",
                color: "#f9fafb",
                outline: "none",
                fontSize: "14px",
              }}
            />
          </div>

          {error ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "12px",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.24)",
                color: "#fecaca",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "4px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p
          style={{
            marginTop: "18px",
            marginBottom: 0,
            fontSize: "14px",
            color: "rgba(249,250,251,0.72)",
          }}
        >
          Already have an account?{" "}
          <Link
            to={websiteName ? `/store/${websiteName}/login` : "/"}
            style={{
              color: "#60a5fa",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}