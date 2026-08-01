import React, { useEffect, useMemo, useState } from "react";
import { Product, useCart } from "../CartContext";
import { componentRegistry } from "../componentRegistry";

type Block = {
  id?: string;
  type: string;
  props?: Record<string, any>;
  data_source?: string | null;
  datasource?: string | null;
  actions?: Record<string, any>;
};

type Theme = {
  name?: string;
  mode?: string;
  primary_bg?: string;
  text_color?: string;
  accent_color?: string;
  festival_theme?: string;
};

type Page = {
  id?: string;
  name?: string;
  title?: string;
  route?: string;
  slug?: string;
  blocks?: Block[];
  role?: string;
  flow?: string;
  show_in_nav?: boolean;
  showinnav?: boolean;
  page_type?: string;
};

type EditorRenderPageProps = {
  page: Page | null | undefined;
  siteId: string;
  selectedProduct?: Product | null;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  theme?: Theme;
};

type EditorBlockWrapperProps = {
  blockId: string;
  blockType: string;
  selected: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
};

type CheckoutStep = "delivery" | "payment" | "review";

type DeliveryData = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
};

type PaymentData = {
  method: string;
  upiId: string;
};

const CHECKOUT_SUMMARY_TYPES = new Set([
  "cart_sidebar",
  "cartsidebar",
  "cart_items",
  "cartitems",
  "order_summary",
  "ordersummary",
]);

const PLACE_ORDER_TYPES = new Set(["place_order_cta", "placeordercta"]);
const PAYMENT_TYPES = new Set(["payment_methods", "paymentmethods"]);
const DELIVERY_TYPES = new Set(["delivery_form", "deliveryform"]);

const checkoutSteps: { key: CheckoutStep; label: string }[] = [
  { key: "delivery", label: "Delivery Address" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review & Pay" },
];

const initialDeliveryData: DeliveryData = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  pincode: "",
};

const initialPaymentData: PaymentData = {
  method: "COD",
  upiId: "",
};

function isDeliveryValid(data: DeliveryData) {
  return Boolean(
    data.fullName.trim() &&
      data.phone.trim() &&
      data.email.trim() &&
      data.address.trim() &&
      data.city.trim() &&
      data.pincode.trim()
  );
}

function isPaymentValid(data: PaymentData) {
  if (!data.method.trim()) return false;
  if (data.method.toUpperCase() === "UPI") {
    return Boolean(data.upiId.trim());
  }
  return true;
}

function EditorBlockWrapper({
  blockId,
  blockType,
  selected,
  onSelect,
  children,
}: EditorBlockWrapperProps) {
  return (
    <div
      data-editor-block-id={blockId}
      data-editor-block-type={blockType}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      style={{
        position: "relative",
        marginBottom: "8px",
        borderRadius: "12px",
        cursor: "pointer",
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: selected ? "2px solid #2563eb" : "1px dashed transparent",
          borderRadius: "12px",
          pointerEvents: "none",
          zIndex: 3,
          transition: "all 0.15s ease",
          boxShadow: selected ? "0 0 0 2px rgba(37,99,235,0.12)" : "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "12px",
          zIndex: 4,
          padding: "2px 8px",
          borderRadius: "999px",
          background: "#2563eb",
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          pointerEvents: "none",
          opacity: selected ? 1 : 0,
          transform: selected ? "translateY(0)" : "translateY(4px)",
          transition: "all 0.15s ease",
        }}
      >
        {blockType}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const EditorRenderPage: React.FC<EditorRenderPageProps> = ({
  page,
  siteId,
  selectedProduct = null,
  selectedBlockId = null,
  onSelectBlock,
  theme,
}) => {
  const { products, cartItems } = useCart();
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [isCompactCheckout, setIsCompactCheckout] = useState(false);

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("delivery");
  const [deliveryData, setDeliveryData] = useState<DeliveryData>(initialDeliveryData);
  const [paymentData, setPaymentData] = useState<PaymentData>(initialPaymentData);

  useEffect(() => {
    const syncViewport = () => {
      setIsCompactCheckout(window.innerWidth < 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  if (!page) {
    return <div style={{ padding: "24px" }}>Page not found.</div>;
  }

  const resolvedBlocks = page.blocks ?? [];

  const isCheckoutPage =
    page.slug === "checkout" ||
    page.route === "/checkout" ||
    page.page_type === "checkout" ||
    page.flow === "checkout";

  const productCategories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.category)
          .filter((category): category is string => Boolean(category))
      )
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedFilter === "All") return products;
    return products.filter((product) => product.category === selectedFilter);
  }, [products, selectedFilter]);

  const renderBlock = (
    block: Block,
    index: number,
    overrides?: Record<string, any>
  ) => {
    const Component = componentRegistry[block.type] as
      | React.ComponentType<any>
      | undefined;

    if (!Component) {
      console.warn(`No component registered for block type: ${block.type}`);
      return null;
    }

    const blockId = block.id ?? `${page.id ?? "page"}-${block.type}-${index}`;
    const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;
    const blockProps = (block.props ?? {}) as Record<string, any>;
    const resolvedTheme: Theme | undefined = theme;

    const componentProps = {
      siteId,
      ...blockProps,
      theme: resolvedTheme,
      ...(overrides ?? {}),
    };

    let renderedNode: React.ReactNode;

    if (block.type === "filter_sidebar" || block.type === "filtersidebar") {
      renderedNode = (
        <Component
          {...componentProps}
          filters={productCategories}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />
      );
    } else if (resolvedDataSource === "product") {
      renderedNode = (
        <Component
          {...componentProps}
          product={selectedProduct}
          selectedProduct={selectedProduct}
        />
      );
    } else if (resolvedDataSource === "products") {
      renderedNode = (
        <Component
          {...componentProps}
          products={filteredProducts}
        />
      );
    } else if (resolvedDataSource === "cart") {
      renderedNode = (
        <Component
          {...componentProps}
          cartItems={cartItems}
        />
      );
    } else {
      renderedNode = <Component {...componentProps} />;
    }

    return (
      <EditorBlockWrapper
        key={blockId}
        blockId={blockId}
        blockType={block.type}
        selected={selectedBlockId === blockId}
        onSelect={() => onSelectBlock?.(blockId)}
      >
        {renderedNode}
      </EditorBlockWrapper>
    );
  };

  if (!isCheckoutPage) {
    return <>{resolvedBlocks.map((block, index) => renderBlock(block, index))}</>;
  }

  const deliveryBlock = resolvedBlocks.find((block) =>
    DELIVERY_TYPES.has(block.type.toLowerCase())
  );

  const paymentBlock = resolvedBlocks.find((block) =>
    PAYMENT_TYPES.has(block.type.toLowerCase())
  );

  const placeOrderBlock = resolvedBlocks.find((block) =>
    PLACE_ORDER_TYPES.has(block.type.toLowerCase())
  );

  const summaryBlock = resolvedBlocks.find((block) =>
    CHECKOUT_SUMMARY_TYPES.has(block.type.toLowerCase())
  );

  const usedBlockIds = new Set(
    [deliveryBlock, paymentBlock, placeOrderBlock, summaryBlock]
      .filter(Boolean)
      .map((block) => block!.id || block!.type)
  );

  const extraBlocks = resolvedBlocks.filter((block) => {
    const key = block.id || block.type;
    return !usedBlockIds.has(key);
  });

  const pageBg =
    theme?.mode === "light" ? "#f8fafc" : theme?.primary_bg || "#0f172a";
  const textColor =
    theme?.mode === "light" ? "#111827" : theme?.text_color || "#f9fafb";
  const subtleText =
    theme?.mode === "light" ? "rgba(17,24,39,0.68)" : "rgba(255,255,255,0.68)";
  const accentColor = theme?.accent_color || "#2563eb";
  const isLight = theme?.mode === "light";

  const shellBg = isLight ? "#ffffff" : "rgba(15,23,42,0.42)";
  const shellBorder = isLight
    ? "1px solid rgba(15,23,42,0.08)"
    : "1px solid rgba(255,255,255,0.08)";
  const softPanel = isLight ? "#f8fafc" : "rgba(255,255,255,0.04)";

  const currentStepIndex = checkoutSteps.findIndex((step) => step.key === checkoutStep);
  const canContinueDelivery = isDeliveryValid(deliveryData);
  const canContinuePayment = isPaymentValid(paymentData);

  const goToStep = (nextStep: CheckoutStep) => {
    if (nextStep === "delivery") {
      setCheckoutStep("delivery");
      return;
    }

    if (nextStep === "payment") {
      if (!canContinueDelivery) return;
      setCheckoutStep("payment");
      return;
    }

    if (nextStep === "review") {
      if (!canContinueDelivery || !canContinuePayment) return;
      setCheckoutStep("review");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: isCompactCheckout ? "16px 12px 28px" : "20px 16px 36px",
        background: pageBg,
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            marginBottom: isCompactCheckout ? "14px" : "18px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: subtleText,
              }}
            >
              Secure checkout
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: isCompactCheckout
                  ? "clamp(24px, 4vw, 30px)"
                  : "clamp(28px, 4vw, 34px)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                fontWeight: 800,
                color: textColor,
              }}
            >
              {page.title || page.name || "Checkout"}
            </h1>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.6,
              color: subtleText,
              maxWidth: "420px",
            }}
          >
            Delivery, payment, and review now stay aligned in both preview and
            live checkout flows. [web:15][web:56]
          </p>
        </div>

        <div
          style={{
            borderRadius: "22px",
            border: shellBorder,
            background: shellBg,
            boxShadow: isLight
              ? "0 18px 44px rgba(15,23,42,0.08)"
              : "0 18px 44px rgba(0,0,0,0.22)",
            padding: isCompactCheckout ? "14px" : "18px",
            marginBottom: isCompactCheckout ? "14px" : "18px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isCompactCheckout
                ? "minmax(0,1fr)"
                : "repeat(3, minmax(0, 1fr))",
              gap: isCompactCheckout ? "10px" : "14px",
              alignItems: "center",
            }}
          >
            {checkoutSteps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = step.key === checkoutStep;
              const isAccessible =
                step.key === "delivery" ||
                (step.key === "payment" && canContinueDelivery) ||
                (step.key === "review" && canContinueDelivery && canContinuePayment);

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => isAccessible && goToStep(step.key)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: isAccessible ? "pointer" : "default",
                    textAlign: "left",
                    opacity: isAccessible ? 1 : 0.65,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "999px",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "12px",
                        fontWeight: 800,
                        border: isCurrent
                          ? `1px solid ${accentColor}`
                          : isCompleted
                          ? `1px solid ${accentColor}`
                          : isLight
                          ? "1px solid rgba(15,23,42,0.14)"
                          : "1px solid rgba(255,255,255,0.16)",
                        background: isCurrent || isCompleted ? accentColor : "transparent",
                        color: isCurrent || isCompleted ? "#ffffff" : subtleText,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: isCurrent ? textColor : subtleText,
                          lineHeight: 1.2,
                        }}
                      >
                        {step.label}
                      </div>
                    </div>
                  </div>

                  {!isCompactCheckout && index < checkoutSteps.length - 1 ? (
                    <div
                      style={{
                        marginTop: "12px",
                        marginLeft: "12px",
                        height: "2px",
                        borderRadius: "999px",
                        background:
                          index < currentStepIndex
                            ? accentColor
                            : isLight
                            ? "rgba(15,23,42,0.08)"
                            : "rgba(255,255,255,0.08)",
                      }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isCompactCheckout
              ? "minmax(0, 1fr)"
              : "minmax(0, 1.05fr) minmax(340px, 0.95fr)",
            gap: isCompactCheckout ? "14px" : "18px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "grid",
              gap: "14px",
              alignContent: "start",
            }}
          >
            {checkoutStep === "delivery" && deliveryBlock
              ? renderBlock(deliveryBlock, resolvedBlocks.indexOf(deliveryBlock), {
                  compact: true,
                  currentStep: "delivery",
                  deliveryData,
                  onDeliveryDataChange: setDeliveryData,
                  onContinue: () => canContinueDelivery && goToStep("payment"),
                  continueDisabled: !canContinueDelivery,
                })
              : null}

            {checkoutStep === "payment" && paymentBlock
              ? renderBlock(paymentBlock, resolvedBlocks.indexOf(paymentBlock), {
                  compact: true,
                  currentStep: "payment",
                  paymentData,
                  onPaymentDataChange: setPaymentData,
                  onBack: () => goToStep("delivery"),
                  onContinue: () => canContinuePayment && goToStep("review"),
                  continueDisabled: !canContinuePayment,
                })
              : null}

            {checkoutStep === "review" ? (
              <div
                style={{
                  borderRadius: "20px",
                  border: shellBorder,
                  background: isLight ? "#ffffff" : softPanel,
                  boxShadow: isLight
                    ? "0 10px 24px rgba(15,23,42,0.06)"
                    : "0 10px 24px rgba(0,0,0,0.16)",
                  padding: isCompactCheckout ? "16px" : "20px",
                }}
              >
                <div
                  style={{
                    marginBottom: "18px",
                    paddingBottom: "12px",
                    borderBottom: isLight
                      ? "1px solid rgba(15,23,42,0.08)"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: subtleText,
                    }}
                  >
                    Final review
                  </p>

                  <h3
                    style={{
                      margin: 0,
                      fontSize: isCompactCheckout ? "22px" : "24px",
                      lineHeight: 1.1,
                      letterSpacing: "-0.03em",
                      color: textColor,
                    }}
                  >
                    Review & Pay
                  </h3>
                </div>

                <div style={{ display: "grid", gap: "14px" }}>
                  <div
                    style={{
                      borderRadius: "16px",
                      border: isLight
                        ? "1px solid rgba(15,23,42,0.08)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: isLight ? "#f8fafc" : "rgba(255,255,255,0.04)",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 700,
                          color: textColor,
                        }}
                      >
                        Delivery address
                      </h4>

                      <button
                        type="button"
                        onClick={() => goToStep("delivery")}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: accentColor,
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Change
                      </button>
                    </div>

                    <div
                      style={{
                        color: subtleText,
                        fontSize: "14px",
                        lineHeight: 1.65,
                      }}
                    >
                      <div style={{ color: textColor, fontWeight: 700 }}>
                        {deliveryData.fullName || "—"}
                      </div>
                      <div>{deliveryData.phone || "—"}</div>
                      <div>{deliveryData.email || "—"}</div>
                      <div>{deliveryData.address || "—"}</div>
                      <div>
                        {deliveryData.city || "—"} {deliveryData.pincode ? `- ${deliveryData.pincode}` : ""}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: "16px",
                      border: isLight
                        ? "1px solid rgba(15,23,42,0.08)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: isLight ? "#f8fafc" : "rgba(255,255,255,0.04)",
                      padding: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 700,
                          color: textColor,
                        }}
                      >
                        Payment method
                      </h4>

                      <button
                        type="button"
                        onClick={() => goToStep("payment")}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: accentColor,
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Change
                      </button>
                    </div>

                    <div
                      style={{
                        color: subtleText,
                        fontSize: "14px",
                        lineHeight: 1.65,
                      }}
                    >
                      <div style={{ color: textColor, fontWeight: 700 }}>
                        {paymentData.method || "—"}
                      </div>
                      {paymentData.method.toUpperCase() === "UPI" ? (
                        <div>{paymentData.upiId || "—"}</div>
                      ) : (
                        <div>Payment will be completed using the selected method.</div>
                      )}
                    </div>
                  </div>

                  {placeOrderBlock
                    ? renderBlock(placeOrderBlock, resolvedBlocks.indexOf(placeOrderBlock), {
                        compact: true,
                        buttonLabel: "Pay now",
                        reviewMode: true,
                        disabled: !(canContinueDelivery && canContinuePayment && cartItems.length > 0),
                      })
                    : null}
                </div>
              </div>
            ) : null}
          </div>

          <aside
            style={{
              minWidth: 0,
              display: "grid",
              gap: "12px",
              alignContent: "start",
              position: isCompactCheckout ? "static" : "sticky",
              top: isCompactCheckout ? undefined : "84px",
            }}
          >
            {summaryBlock
              ? renderBlock(summaryBlock, resolvedBlocks.indexOf(summaryBlock), {
                  mode: "checkout_summary",
                  compact: true,
                })
              : null}
          </aside>

          {extraBlocks.length > 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "grid",
                gap: "16px",
                minWidth: 0,
                marginTop: "2px",
              }}
            >
              {extraBlocks.map((block, index) =>
                renderBlock(block, index + resolvedBlocks.length)
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EditorRenderPage;