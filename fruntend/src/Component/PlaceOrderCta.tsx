import React, { useMemo, useState } from "react";

type ThemeInput =
  | "dark"
  | "light"
  | {
      mode?: string;
      accent_color?: string;
      festival_theme?: string;
      text_color?: string;
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

function isErrorResponse(data: unknown): data is ErrorResponse {
  return typeof data === "object" && data !== null && "detail" in data;
}

function getApiBaseUrl(): string {
  const envBaseUrl =
    (import.meta as any)?.env?.VITE_API_BASE_URL ||
    (window as any)?.__API_BASE_URL__;

  if (typeof envBaseUrl === "string" && envBaseUrl.trim()) {
    return envBaseUrl.replace(/\/+$/, "");
  }

  return "http://localhost:8000";
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

  const resolvedMode =
    typeof theme === "string" ? theme : theme?.mode === "light" ? "light" : "dark";

  const resolvedAccent =
    accentColor ||
    (typeof theme === "object" && theme?.accent_color) ||
    (resolvedMode === "dark" ? "#60a5fa" : "#2563eb");

  const resolvedRadius = border_radius ?? 14;
  const resolvedPaddingY = padding ?? (compact ? 14 : 16);
  const resolvedPaddingX = compact ? 18 : 22;
  const helperTextColor =
    resolvedMode === "light" ? "rgba(17,24,39,0.68)" : "rgba(255,255,255,0.68)";
  const errorTextColor = resolvedMode === "light" ? "#b91c1c" : "#fca5a5";

  const finalDisabled = disabled || isSubmitting;

  const helperText = useMemo(() => {
    if (isSubmitting) {
      return paymentData?.method?.toUpperCase() === "COD"
        ? "Placing your order..."
        : "Processing your order...";
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

    if (!paymentData?.method?.trim()) {
      setErrorMessage("Please select a payment method.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const response = await fetch(`${getApiBaseUrl()}/orders/${siteId}/place`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address_id: selectedAddressId,
          payment_method: paymentData.method,
          payment_meta:
            paymentData.method.toUpperCase() === "UPI" && paymentData.upiId.trim()
              ? { upi_id: paymentData.upiId.trim() }
              : {},
        }),
      });

      const rawText = await response.text();
      let data: unknown = null;

      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = rawText;
        }
      }

      if (!response.ok) {
        if (isErrorResponse(data) && typeof data.detail === "string") {
          throw new Error(data.detail);
        }

        if (typeof data === "string" && data.trim()) {
          throw new Error(data);
        }

        throw new Error(`Failed to place order (${response.status})`);
      }

      if (!isPlaceOrderApiResponse(data)) {
        throw new Error("Invalid place order response");
      }

      onOrderPlaced?.({
        orderId: data.order_id || "",
        status: data.status || "placed",
        total: data.total,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to place order"
      );
    } finally {
      setIsSubmitting(false);
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
        {helperText ? (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.6,
              color: errorMessage ? errorTextColor : helperTextColor,
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
            color: text_color || "#ffffff",
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
              : "Processing..."
            : buttonLabel}
        </button>
      </div>
    </section>
  );
};

export default PlaceOrderCta;