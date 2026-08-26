import React, { useMemo, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { isColorDarkHex } from "../context/ThemeContext";
import { useRazorpay } from "../hooks/useRazorpay";

type ThemeInput =
  | "dark"
  | "light"
  | {
      mode?: string;
      accent_color?: string;
      festival_theme?: string;
      text_color?: string;
      place_order_btn_bg?: string;
      place_order_btn_text?: string;
      place_order_text?: string;
    };

type PaymentData = {
  method: string;
  upiId: string;
};

type OrderPlacedPayload = {
  orderId: string;
  status: string;
  total?: number;
};

type PlaceOrderApiResponse = {
  message?: string;
  order_id?: string;
  status?: string;
  total?: number;
  pricing_snapshot?: Record<string, any>;
};

type CreatePaymentOrderApiResponse = {
  order_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  pricing_snapshot: Record<string, any>;
};

type ErrorResponse = {
  detail?: string;
};

type PlaceOrderCtaProps = {
  siteId: string;
  buttonLabel?: string;
  accentColor?: string;
  onClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
  theme?: ThemeInput;
  text_color?: string;
  border_radius?: number;
  padding?: number;
  max_width?: number;
  reviewMode?: boolean;
  selectedAddressId?: string | null;
  paymentData?: PaymentData;
  onOrderPlaced?: (payload: OrderPlacedPayload) => void;
};

function isPlaceOrderApiResponse(data: unknown): data is PlaceOrderApiResponse {
  return typeof data === "object" && data !== null && "order_id" in data;
}

function isCreatePaymentOrderApiResponse(data: unknown): data is CreatePaymentOrderApiResponse {
  return typeof data === "object" && data !== null && "razorpay_order_id" in data;
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  return typeof data === "object" && data !== null && "detail" in data;
}

function extractApiErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    const obj = data as Record<string, any>;
    if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim();
    if (Array.isArray(obj.detail)) {
      return obj.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ");
    }
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
  }
  return fallback;
}

export const PlaceOrderCta: React.FC<PlaceOrderCtaProps> = ({
  siteId,
  buttonLabel = "Place order",
  accentColor,
  onClick,
  disabled = false,
  compact = false,
  theme,
  text_color,
  border_radius,
  padding,
  max_width,
  reviewMode = false,
  selectedAddressId,
  paymentData,
  onOrderPlaced,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { openRazorpay } = useRazorpay();

  const resolvedMode =
    typeof theme === "string" ? theme : theme?.mode === "light" ? "light" : "dark";

  const resolvedAccent =
    accentColor ||
    (typeof theme === "object" && (theme as any)?.place_order_btn_bg) ||
    (typeof theme === "object" && theme?.accent_color) ||
    (resolvedMode === "dark" ? "#60a5fa" : "#2563eb");

  const resolvedButtonTextColor =
    text_color ||
    (typeof theme === "object" && (theme as any)?.place_order_btn_text) ||
    (isColorDarkHex(resolvedAccent) ? "#ffffff" : "#0f172a");

  const resolvedRadius = border_radius ?? 14;
  const resolvedPaddingY = padding ?? (compact ? 14 : 16);
  const resolvedPaddingX = compact ? 18 : 22;
  const helperTextColor =
    (typeof theme === "object" && (theme as any)?.place_order_text) ||
    (resolvedMode === "light" ? "rgba(17,24,39,0.68)" : "rgba(255,255,255,0.68)");
  const errorTextColor = resolvedMode === "light" ? "#b91c1c" : "#fca5a5";

  const finalDisabled = disabled || isSubmitting;

  const helperText = useMemo(() => {
    if (isSubmitting) {
      return paymentData?.method?.toUpperCase() === "COD"
        ? "Placing your order..."
        : "Opening secure checkout...";
    }

    if (errorMessage) return errorMessage;

    if (reviewMode) {
      return "Review the delivery and payment details, then complete the order.";
    }

    return "";
  }, [errorMessage, isSubmitting, paymentData?.method, reviewMode]);

  const handlePlaceOrder = async () => {
    if (finalDisabled) return;

    if (onClick) {
      onClick();
      return;
    }

    if (!siteId) {
      setErrorMessage("Site context missing.");
      return;
    }

    if (!selectedAddressId) {
      setErrorMessage("Please select a delivery address.");
      return;
    }

    const normalizedMethod = (paymentData?.method || "").trim().toLowerCase();
    if (!normalizedMethod) {
      setErrorMessage("Please select a payment method.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      // 1. CASH ON DELIVERY (COD) FLOW
      if (normalizedMethod === "cod" || normalizedMethod === "cash_on_delivery") {
        const response = await fetch(`${API_BASE_URL}/orders/${siteId}/place`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address_id: selectedAddressId,
            payment_method: "cod",
          }),
        });

        const rawText = await response.text();
        let data: unknown = null;
        if (rawText) {
          try { data = JSON.parse(rawText); } catch { data = rawText; }
        }

        if (!response.ok) {
          throw new Error(extractApiErrorMessage(data, `Failed to place COD order (${response.status})`));
        }

        if (!isPlaceOrderApiResponse(data)) {
          throw new Error("Invalid place order response");
        }

        onOrderPlaced?.({
          orderId: data.order_id || "",
          status: data.status || "placed",
          total: data.total,
        });
        return;
      }

      // 2. ONLINE PAYMENT / UPI FLOW (RAZORPAY)
      const initResponse = await fetch(`${API_BASE_URL}/orders/${siteId}/create-payment-order`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address_id: selectedAddressId,
          payment_method: normalizedMethod,
        }),
      });

      const rawInitText = await initResponse.text();
      let initData: unknown = null;
      if (rawInitText) {
        try { initData = JSON.parse(rawInitText); } catch { initData = rawInitText; }
      }

      if (!initResponse.ok) {
        throw new Error(extractApiErrorMessage(initData, `Failed to initialize payment (${initResponse.status})`));
      }

      if (!isCreatePaymentOrderApiResponse(initData)) {
        throw new Error("Invalid payment order response");
      }

      const { order_id, razorpay_order_id, amount, currency, key_id } = initData;

      // Persist pending order in storage to handle mobile bank page redirects
      const pendingOrderData = {
        siteId,
        order_id,
        razorpay_order_id,
        timestamp: Date.now(),
      };
      try {
        sessionStorage.setItem("pending_checkout_order", JSON.stringify(pendingOrderData));
        localStorage.setItem("pending_checkout_order", JSON.stringify(pendingOrderData));
      } catch {}

      // Validate VPA so email addresses don't break Razorpay's UPI modal
      const rawVpa = paymentData?.upiId?.trim() || "";
      const isEmail = rawVpa.endsWith("@gmail.com") || rawVpa.endsWith("@yahoo.com") || rawVpa.endsWith("@outlook.com") || rawVpa.endsWith("@hotmail.com");
      const validVpa = rawVpa && !isEmail && rawVpa.includes("@") ? rawVpa : undefined;

      // Determine user-selected payment instrument
      const isCard = normalizedMethod.includes("card");
      const isNetbanking = normalizedMethod.includes("netbank") || normalizedMethod.includes("bank");
      const isWallet = normalizedMethod.includes("wallet");

      const targetMethod = isCard ? "card" : isNetbanking ? "netbanking" : isWallet ? "wallet" : "upi";
      const targetName = isCard ? "Card" : isNetbanking ? "Netbanking" : isWallet ? "Wallet" : "UPI";

      // Launch standard in-app Razorpay modal (prevents mobile browser full-page redirects)
      await openRazorpay({
        key: key_id,
        amount: amount,
        currency: currency || "INR",
        name: "WebCreon Store",
        description: `Order #${order_id.slice(0, 8).toUpperCase()}`,
        order_id: razorpay_order_id.startsWith("order_mock_") ? undefined : razorpay_order_id,
        prefill: {
          method: targetMethod || undefined,
          vpa: validVpa || undefined,
        },
        theme: {
          color: resolvedAccent,
        },
        modal: {
          ondismiss: async () => {
            setIsSubmitting(false);
            // Check if payment was completed before closing modal (e.g. mobile netbanking return)
            if (order_id && siteId) {
              try {
                const checkRes = await fetch(`${API_BASE_URL}/orders/${siteId}/verify-payment`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    order_id: order_id,
                    razorpay_order_id: razorpay_order_id,
                  }),
                });
                if (checkRes.ok) {
                  const checkData = await checkRes.json();
                  if (checkData.status === "placed" && checkData.payment_status === "paid") {
                    onOrderPlaced?.({
                      orderId: checkData.order_id || order_id,
                      status: "placed",
                      total: checkData.total,
                    });
                    return;
                  } else if (checkData.is_refunded || checkData.status === "cancelled") {
                    const refundMsg = checkData.message || "Item went out of stock right as payment completed. A 100% automated refund has been initiated back to your source account.";
                    setErrorMessage(refundMsg);
                    alert(refundMsg);
                    return;
                  }
                }
              } catch {
                // Ignore background check errors
              }
            }
            setErrorMessage("Payment was cancelled or dismissed. You can try again.");
          },
        },
        handler: async (paymentResponse: {
          razorpay_payment_id: string;
          razorpay_order_id?: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch(`${API_BASE_URL}/orders/${siteId}/verify-payment`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: order_id,
                razorpay_order_id: paymentResponse.razorpay_order_id || razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature || "test_signature",
              }),
            });

            const verifyRaw = await verifyRes.text();
            let verifyData: any = null;
            try { verifyData = JSON.parse(verifyRaw); } catch { verifyData = verifyRaw; }

            if (!verifyRes.ok) {
              throw new Error(verifyData?.detail || "Payment signature verification failed");
            }

            if (verifyData?.is_refunded || verifyData?.status === "cancelled") {
              const refundMsg = verifyData.message || "Item went out of stock right as payment completed. A 100% automated refund has been initiated back to your source account.";
              setErrorMessage(refundMsg);
              alert(refundMsg);
              return;
            }

            try {
              sessionStorage.removeItem("pending_checkout_order");
              localStorage.removeItem("pending_checkout_order");
            } catch {}

            onOrderPlaced?.({
              orderId: verifyData.order_id || order_id,
              status: verifyData.status || "placed",
              total: verifyData.total,
            });
          } catch (vErr: any) {
            const msg = vErr.message || "Failed to confirm payment";
            setErrorMessage(msg);
            alert(msg);
          } finally {
            setIsSubmitting(false);
          }
        },
        onPaymentFailed: (error: any) => {
          setIsSubmitting(false);
          const failMsg = error?.description || "Payment failed. Please try with another payment method.";
          setErrorMessage(failMsg);
          alert(failMsg);
        },
      });
    } catch (error) {
      setIsSubmitting(false);
      const errTxt = error instanceof Error ? error.message : "Failed to initiate payment";
      setErrorMessage(errTxt);
      alert(errTxt);
    }
  };

  return (
    <section
      style={{
        width: "100%",
        maxWidth: max_width ? `${max_width}px` : undefined,
      }}
    >
      <div
        style={{
          width: "100%",
          display: "grid",
          gap: "10px",
        }}
      >
        {errorMessage ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: resolvedMode === "light" ? "#fef2f2" : "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: resolvedMode === "light" ? "#b91c1c" : "#fca5a5",
              fontSize: "13px",
              lineHeight: 1.5,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        ) : helperText ? (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.6,
              color: helperTextColor,
            }}
          >
            {helperText}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={finalDisabled}
          style={{
            width: "100%",
            minHeight: compact ? "52px" : "56px",
            padding: `${resolvedPaddingY}px ${resolvedPaddingX}px`,
            borderRadius: `${resolvedRadius}px`,
            border: "none",
            background: finalDisabled ? "#94a3b8" : resolvedAccent,
            color: resolvedButtonTextColor,
            fontWeight: 800,
            fontSize: compact ? "15px" : "16px",
            letterSpacing: "-0.02em",
            cursor: finalDisabled ? "not-allowed" : "pointer",
            boxShadow: finalDisabled
              ? "none"
              : "0 14px 34px rgba(0,0,0,0.14), 0 6px 16px rgba(0,0,0,0.10)",
            transition:
              "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
            opacity: finalDisabled ? 0.9 : 1,
          }}
          onMouseDown={(e) => {
            if (!finalDisabled) e.currentTarget.style.transform = "translateY(1px)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {isSubmitting
            ? paymentData?.method?.toUpperCase() === "COD"
              ? "Placing Order..."
              : "Connecting Gateway..."
            : buttonLabel}
        </button>
      </div>
    </section>
  );
};

export default PlaceOrderCta;