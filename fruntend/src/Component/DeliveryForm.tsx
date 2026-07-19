import React, { useMemo } from "react";

type DeliveryFormProps = {
  title?: string;
  subtitle?: string;
  theme?: "dark" | "light";
  accentColor?: string;
};

export const DeliveryForm: React.FC<DeliveryFormProps> = ({
  title = "Delivery Details",
  subtitle = "Enter delivery details to complete your order.",
  theme = "dark",
  accentColor = "#2563eb",
}) => {
  const isDark = theme === "dark";

  const palette = useMemo(
    () => ({
      pageBg: isDark ? "#0b1020" : "#f8fafc",
      shellBg: isDark ? "#0f172a" : "#ffffff",
      cardBg: isDark ? "#111827" : "#ffffff",
      headerBg: isDark
        ? "linear-gradient(180deg, rgba(30,41,59,0.72) 0%, rgba(15,23,42,0.94) 100%)"
        : "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,1) 100%)",
      inputBg: isDark ? "#0b1220" : "#ffffff",
      border: isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.10)",
      softBorder: isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.06)",
      text: isDark ? "#e5e7eb" : "#0f172a",
      textMuted: isDark ? "#94a3b8" : "#64748b",
      textSoft: isDark ? "#cbd5e1" : "#475569",
      placeholder: isDark ? "#64748b" : "#94a3b8",
      shadow: isDark
        ? "0 24px 60px rgba(0,0,0,0.35)"
        : "0 20px 50px rgba(15,23,42,0.08)",
      cardShadow: isDark
        ? "0 12px 28px rgba(0,0,0,0.22)"
        : "0 10px 30px rgba(15,23,42,0.05)",
      accentRing: isDark
        ? "0 0 0 3px rgba(37,99,235,0.18)"
        : "0 0 0 3px rgba(37,99,235,0.12)",
    }),
    [isDark]
  );

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: `1px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.text,
    outline: "none",
    fontSize: "14px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "8px",
    color: palette.textSoft,
  };

  return (
    <section
      style={{
        padding: "20px 12px 36px",
        maxWidth: "1240px",
        margin: "0 auto",
        background: palette.pageBg,
      }}
    >
      <div
        style={{
          width: "100%",
          border: `1px solid ${palette.border}`,
          borderRadius: "28px",
          overflow: "hidden",
          background: palette.shellBg,
          boxSizing: "border-box",
          boxShadow: palette.shadow,
        }}
      >
        <div
          style={{
            padding: "24px 22px 20px",
            borderBottom: `1px solid ${palette.softBorder}`,
            background: palette.headerBg,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "12px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: palette.textMuted,
              fontWeight: 700,
            }}
          >
            Delivery info
          </p>

          <h3
            style={{
              margin: "0 0 6px",
              fontSize: "clamp(24px, 2vw, 32px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: palette.text,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: 0,
              color: palette.textMuted,
              fontSize: "14px",
            }}
          >
            {subtitle}
          </p>
        </div>

        <div style={{ padding: "18px" }}>
          <div
            style={{
              width: "100%",
              border: `1px solid ${palette.softBorder}`,
              borderRadius: "24px",
              padding: "20px",
              background: palette.cardBg,
              boxSizing: "border-box",
              boxShadow: palette.cardShadow,
            }}
          >
            <form
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              <div>
                <label htmlFor="delivery-full-name" style={labelStyle}>
                  Full name
                </label>
                <input
                  id="delivery-full-name"
                  name="fullName"
                  placeholder="Enter full name"
                  style={fieldStyle}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="delivery-phone" style={labelStyle}>
                    Phone
                  </label>
                  <input
                    id="delivery-phone"
                    name="phone"
                    placeholder="Enter phone number"
                    style={fieldStyle}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label htmlFor="delivery-email" style={labelStyle}>
                    Email
                  </label>
                  <input
                    id="delivery-email"
                    name="email"
                    placeholder="Enter email address"
                    style={fieldStyle}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="delivery-address" style={labelStyle}>
                  Address
                </label>
                <textarea
                  id="delivery-address"
                  name="address"
                  placeholder="House no, street, area"
                  rows={4}
                  style={{
                    ...fieldStyle,
                    resize: "vertical",
                    minHeight: "120px",
                    paddingTop: "14px",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "14px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="delivery-city" style={labelStyle}>
                    City
                  </label>
                  <input
                    id="delivery-city"
                    name="city"
                    placeholder="Enter city"
                    style={fieldStyle}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <label htmlFor="delivery-pincode" style={labelStyle}>
                    Pincode
                  </label>
                  <input
                    id="delivery-pincode"
                    name="pincode"
                    placeholder="Enter pincode"
                    style={fieldStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: "4px",
                  paddingTop: "12px",
                  borderTop: `1px solid ${palette.softBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: palette.textMuted,
                  }}
                >
                  We use these details for delivery and order updates.
                </p>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    borderRadius: "999px",
                    background: isDark
                      ? "rgba(37,99,235,0.12)"
                      : "rgba(37,99,235,0.08)",
                    color: accentColor,
                    fontSize: "13px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  Secure form
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>
        {`
          input::placeholder,
          textarea::placeholder {
            color: ${palette.placeholder};
            opacity: 1;
          }

          input:focus,
          textarea:focus {
            border-color: ${accentColor};
            box-shadow: ${palette.accentRing};
          }

          @media (max-width: 768px) {
            section[data-delivery-form-mobile] {
              padding: 16px;
            }
          }
        `}
      </style>
    </section>
  );
};

export default DeliveryForm;