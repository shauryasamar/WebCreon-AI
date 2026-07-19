import React, { useMemo, useState } from "react";

type PaymentMethodsProps = {
  title?: string;
  subtitle?: string;
  paymentMethods?: string[];
  theme?: "dark" | "light";
  accentColor?: string;
};

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  title = "Payment Methods",
  subtitle = "Choose how you’d like to pay for this order.",
  paymentMethods = ["COD", "UPI"],
  theme = "dark",
  accentColor = "#2563eb",
}) => {
  const [selectedMethod, setSelectedMethod] = useState(
    paymentMethods[0] || "COD"
  );
  const [upiId, setUpiId] = useState("");

  const isDark = theme === "dark";

  const palette = useMemo(
    () => ({
      pageBg: isDark ? "#0b1020" : "#f8fafc",
      shellBg: isDark ? "#0f172a" : "#ffffff",
      cardBg: isDark ? "#111827" : "#ffffff",
      panelBg: isDark ? "#162033" : "#f8fafc",
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
      selectedBg: isDark
        ? "rgba(37,99,235,0.12)"
        : "rgba(37,99,235,0.08)",
      selectedBorder: accentColor,
      selectedRing: isDark
        ? "0 0 0 1px rgba(37,99,235,0.28), 0 12px 28px rgba(0,0,0,0.22)"
        : "0 0 0 1px rgba(37,99,235,0.16), 0 10px 28px rgba(15,23,42,0.06)",
      shellShadow: isDark
        ? "0 24px 60px rgba(0,0,0,0.35)"
        : "0 20px 50px rgba(15,23,42,0.08)",
      cardShadow: isDark
        ? "0 10px 24px rgba(0,0,0,0.20)"
        : "0 8px 24px rgba(15,23,42,0.05)",
      infoBg: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
      successBg: isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.08)",
      successText: isDark ? "#86efac" : "#166534",
    }),
    [accentColor, isDark]
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "46px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: `1px solid ${palette.border}`,
    background: palette.inputBg,
    color: palette.text,
    outline: "none",
    boxSizing: "border-box",
    fontSize: "14px",
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
          border: `1px solid ${palette.border}`,
          borderRadius: "28px",
          overflow: "hidden",
          background: palette.shellBg,
          boxShadow: palette.shellShadow,
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
            Payment selection
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
          <fieldset
            style={{
              margin: 0,
              padding: "20px",
              border: `1px solid ${palette.softBorder}`,
              borderRadius: "24px",
              background: palette.cardBg,
              boxShadow: palette.cardShadow,
              minWidth: 0,
            }}
          >
            <legend
              style={{
                padding: "0 8px",
                fontSize: "13px",
                fontWeight: 700,
                color: palette.textMuted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Choose one option
            </legend>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "8px",
              }}
            >
              {paymentMethods.map((method) => {
                const isSelected = selectedMethod === method;
                const inputId = `payment-method-${method.toLowerCase()}`;

                return (
                  <label
                    key={method}
                    htmlFor={inputId}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      padding: "16px",
                      borderRadius: "18px",
                      border: isSelected
                        ? `1px solid ${palette.selectedBorder}`
                        : `1px solid ${palette.border}`,
                      background: isSelected
                        ? palette.selectedBg
                        : palette.panelBg,
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? palette.selectedRing
                        : "none",
                      transition: "all 180ms ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          minWidth: 0,
                        }}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name="payment-method"
                          checked={isSelected}
                          onChange={() => setSelectedMethod(method)}
                          style={{
                            accentColor,
                            width: "16px",
                            height: "16px",
                            margin: 0,
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "15px",
                              color: palette.text,
                              lineHeight: 1.2,
                            }}
                          >
                            {method}
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: palette.textMuted,
                              marginTop: "4px",
                              lineHeight: 1.5,
                            }}
                          >
                            {method === "COD"
                              ? "Pay with cash when your order is delivered."
                              : "Pay instantly using your UPI ID."}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "30px",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            background: isDark
                              ? "rgba(37,99,235,0.16)"
                              : "rgba(37,99,235,0.10)",
                            color: accentColor,
                            fontSize: "12px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Selected
                        </span>
                      )}
                    </div>

                    {isSelected && method === "UPI" && (
                      <div
                        style={{
                          marginTop: "2px",
                          paddingTop: "10px",
                          borderTop: `1px solid ${palette.softBorder}`,
                        }}
                      >
                        <label
                          htmlFor="upi-id"
                          style={{
                            display: "block",
                            marginBottom: "8px",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: palette.textSoft,
                          }}
                        >
                          UPI ID
                        </label>

                        <input
                          id="upi-id"
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="Enter UPI ID (e.g. name@upi)"
                          style={inputStyle}
                        />

                        <p
                          style={{
                            margin: "8px 0 0",
                            fontSize: "12px",
                            color: palette.textMuted,
                            lineHeight: 1.5,
                          }}
                        >
                          Make sure the UPI ID is valid before continuing.
                        </p>
                      </div>
                    )}

                    {isSelected && method === "COD" && (
                      <div
                        style={{
                          marginTop: "2px",
                          padding: "12px 14px",
                          borderRadius: "14px",
                          background: palette.infoBg,
                          border: `1px solid ${palette.softBorder}`,
                          fontSize: "13px",
                          color: palette.textSoft,
                          lineHeight: 1.55,
                        }}
                      >
                        Cash will be collected at the time of delivery.
                      </div>
                    )}
                  </label>
                );
              })}
            </div>

            <div
              style={{
                marginTop: "16px",
                paddingTop: "14px",
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
                Payment details stay aligned with your selected checkout flow.
              </p>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  borderRadius: "999px",
                  background: palette.successBg,
                  color: palette.successText,
                  fontSize: "13px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Secure selection
              </span>
            </div>
          </fieldset>
        </div>
      </div>

      <style>
        {`
          input::placeholder {
            color: ${palette.placeholder};
            opacity: 1;
          }

          input[type="text"]:focus {
            border-color: ${accentColor};
            box-shadow: ${
              isDark
                ? "0 0 0 3px rgba(37,99,235,0.18)"
                : "0 0 0 3px rgba(37,99,235,0.12)"
            };
          }
        `}
      </style>
    </section>
  );
};

export default PaymentMethods;