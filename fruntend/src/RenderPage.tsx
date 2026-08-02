import React, { useEffect, useMemo, useState } from "react";
import { useCart, Product } from "./CartContext";
import { componentRegistry } from "./componentRegistry";
import { getCheckoutAddresses, SavedAddress } from "./addressService";
import { useCustomerAuth } from "./context/CustomerAuthContext";

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

type RenderPageProps = {
  page: Page | null | undefined;
  siteId: string;
  selectedProduct?: Product | null;
  theme?: Theme;
};

type CheckoutStep = "delivery" | "payment" | "review";

type DeliveryData = {
  id?: string;
  label?: string;
  isDefault?: boolean;
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

type OrderPlacedState = {
  orderId: string;
  status: string;
  total?: number;
} | null;

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

const PRODUCT_DETAIL_TYPES = new Set([
  "product_detail",
  "productdetail",
  "product_gallery",
  "productgallery",
  "product_info",
  "productinfo",
  "purchase_panel",
  "purchasepanel",
]);

const PRODUCT_LISTING_TYPES = new Set([
  "product_grid",
  "productgrid",
  "products_grid",
  "productsgrid",
  "product_list",
  "productlist",
  "products_section",
  "productssection",
  "shop_products",
  "shopproducts",
]);

const FILTER_TYPES = new Set([
  "filter_sidebar",
  "filtersidebar",
  "filters",
  "shop_filters",
  "shopfilters",
]);

const CART_PAGE_TYPES = new Set([
  "cart_sidebar",
  "cartsidebar",
  "cart_items",
  "cartitems",
  "order_summary",
  "ordersummary",
]);

const checkoutSteps: { key: CheckoutStep; label: string }[] = [
  { key: "delivery", label: "Delivery Address" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review & Pay" },
];

const initialDeliveryData: DeliveryData = {
  id: "",
  label: "Home",
  isDefault: false,
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

function mapSavedAddressToDeliveryData(address: SavedAddress): DeliveryData {
  return {
    id: address.id,
    label: address.addressType || "Home",
    isDefault: address.isDefault,
    fullName: address.fullName || "",
    phone: address.mobileNumber || "",
    email: address.email || "",
    address: address.addressLine1 || "",
    city: address.city || "",
    pincode: address.postalCode || "",
  };
}

const RenderPage: React.FC<RenderPageProps> = ({
  page,
  siteId,
  selectedProduct = null,
  theme,
}) => {
  const { products, cartItems } = useCart();
  const { isAuthenticated, loading: authLoading } = useCustomerAuth();

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [isCompactCheckout, setIsCompactCheckout] = useState(false);

  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("delivery");
  const [deliveryData, setDeliveryData] = useState<DeliveryData>(initialDeliveryData);
  const [savedAddresses, setSavedAddresses] = useState<DeliveryData[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData>(initialPaymentData);
  const [isAddressesLoading, setIsAddressesLoading] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OrderPlacedState>(null);

  useEffect(() => {
    const syncViewport = () => {
      setIsCompactCheckout(window.innerWidth < 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!siteId) return;
    if (authLoading) return;

    if (!isAuthenticated) {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      setDeliveryData(initialDeliveryData);
      setIsAddressesLoading(false);
      return;
    }

    let cancelled = false;

    const loadSavedAddresses = async () => {
      try {
        setIsAddressesLoading(true);
        const addresses = await getCheckoutAddresses(siteId);
        if (cancelled) return;

        const mapped = addresses.map(mapSavedAddressToDeliveryData);
        setSavedAddresses(mapped);

        const selected =
          mapped.find((address) => address.isDefault) || mapped[0] || null;

        if (selected) {
          setSelectedAddressId(selected.id || null);
          setDeliveryData(selected);
        } else {
          setSelectedAddressId(null);
          setDeliveryData(initialDeliveryData);
        }
      } catch (error) {
        console.error("Failed to load checkout addresses", error);
        if (!cancelled) {
          setSavedAddresses([]);
          setSelectedAddressId(null);
          setDeliveryData(initialDeliveryData);
        }
      } finally {
        if (!cancelled) {
          setIsAddressesLoading(false);
        }
      }
    };

    loadSavedAddresses();

    return () => {
      cancelled = true;
    };
  }, [siteId, isAuthenticated, authLoading]);

  if (!page) {
    return <div style={{ padding: "24px" }}>Page not found.</div>;
  }

  const resolvedBlocks = page.blocks ?? [];

  const isCheckoutPage =
    page.slug === "checkout" ||
    page.route === "/checkout" ||
    page.page_type === "checkout" ||
    page.flow === "checkout";

  const isCartPage =
    page.slug === "cart" ||
    page.route === "/cart" ||
    page.page_type === "cart" ||
    page.role === "cart";

  const isProductDetailPageContext =
    Boolean(selectedProduct) ||
    page.role === "product_detail" ||
    page.page_type === "product_detail" ||
    page.route === "/products/:productSlug" ||
    page.route === "/products/:slug" ||
    resolvedBlocks.some((block) =>
      PRODUCT_DETAIL_TYPES.has(String(block.type || "").toLowerCase())
    );

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

  const detailRelevantBlocks = useMemo(() => {
    if (!isProductDetailPageContext) return resolvedBlocks;

    const filtered = resolvedBlocks.filter((block) => {
      const type = String(block.type || "").toLowerCase();
      const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;

      if (FILTER_TYPES.has(type)) return false;
      if (resolvedDataSource === "products") return false;
      if (PRODUCT_LISTING_TYPES.has(type)) return false;

      return true;
    });

    const hasRenderableDetailBlock = filtered.some((block) => {
      const type = String(block.type || "").toLowerCase();
      const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;

      return (
        (PRODUCT_DETAIL_TYPES.has(type) || resolvedDataSource === "product") &&
        Boolean(componentRegistry[block.type])
      );
    });

    if (hasRenderableDetailBlock) return filtered;

    return [
      {
        id: "auto-product-detail-fallback",
        type: "product_detail",
        data_source: "product",
        props: {},
      },
    ];
  }, [isProductDetailPageContext, resolvedBlocks]);

  const blocksToRender = useMemo(() => {
    if (isCheckoutPage) return detailRelevantBlocks;
    if (!isCartPage) return detailRelevantBlocks;

    let hasRenderedPrimaryCartBlock = false;

    return detailRelevantBlocks.filter((block) => {
      const type = String(block.type || "").toLowerCase();
      const dataSource = block.data_source ?? block.datasource ?? undefined;
      const isCartLike =
        CART_PAGE_TYPES.has(type) || dataSource === "cart";

      if (!isCartLike) return true;
      if (hasRenderedPrimaryCartBlock) return false;

      hasRenderedPrimaryCartBlock = true;
      return true;
    });
  }, [detailRelevantBlocks, isCheckoutPage, isCartPage]);

  const renderBlock = (
    block: Block,
    index: number,
    overrides?: Record<string, any>
  ) => {
    const Component = componentRegistry[block.type];

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

    if (
      !isProductDetailPageContext &&
      (block.type === "filter_sidebar" || block.type === "filtersidebar")
    ) {
      return (
        <Component
          key={blockId}
          {...componentProps}
          filters={productCategories}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />
      );
    }

    if (resolvedDataSource === "product") {
      return (
        <Component
          key={blockId}
          {...componentProps}
          product={selectedProduct}
          selectedProduct={selectedProduct}
        />
      );
    }

    if (!isProductDetailPageContext && resolvedDataSource === "products") {
      return (
        <Component
          key={blockId}
          {...componentProps}
          products={filteredProducts}
        />
      );
    }

    if (resolvedDataSource === "cart") {
      return (
        <Component
          key={blockId}
          {...componentProps}
          cartItems={cartItems}
        />
      );
    }

    return <Component key={blockId} {...componentProps} />;
  };

  if (!isCheckoutPage) {
    return <>{blocksToRender.map((block, index) => renderBlock(block, index))}</>;
  }

  const deliveryBlock = blocksToRender.find((block) =>
    DELIVERY_TYPES.has(block.type.toLowerCase())
  );

  const paymentBlock = blocksToRender.find((block) =>
    PAYMENT_TYPES.has(block.type.toLowerCase())
  );

  const placeOrderBlock = blocksToRender.find((block) =>
    PLACE_ORDER_TYPES.has(block.type.toLowerCase())
  );

  const summaryBlock = blocksToRender.find((block) =>
    CHECKOUT_SUMMARY_TYPES.has(block.type.toLowerCase())
  );

  const pageBg =
    theme?.mode === "light" ? "#f6f7fb" : theme?.primary_bg || "#0f172a";
  const textColor =
    theme?.mode === "light" ? "#111827" : theme?.text_color || "#f9fafb";
  const subtleText =
    theme?.mode === "light" ? "#6b7280" : "rgba(255,255,255,0.68)";
  const accentColor = theme?.accent_color || "#2f6df6";
  const isLight = theme?.mode === "light";

  const shellBg = isLight ? "#ffffff" : "rgba(15,23,42,0.42)";
  const shellBorder = isLight
    ? "1px solid #e8ebf0"
    : "1px solid rgba(255,255,255,0.08)";
  const softPanel = isLight ? "#f8fafc" : "rgba(255,255,255,0.04)";
  const cardBg = isLight ? "#ffffff" : "rgba(255,255,255,0.04)";
  const cardBorder = isLight
    ? "1px solid #e5e7eb"
    : "1px solid rgba(255,255,255,0.08)";
  const cardDivider = isLight
    ? "1px solid #edf0f4"
    : "1px solid rgba(255,255,255,0.08)";
  const mutedPanel = isLight ? "#f8fafc" : "rgba(255,255,255,0.03)";

  const selectedAddress =
    savedAddresses.find((address) => address.id === selectedAddressId) || null;

  const canContinueDelivery = Boolean(
    selectedAddress && isDeliveryValid(selectedAddress)
  );
  const canContinuePayment = isPaymentValid(paymentData);

  const currentStepIndex = checkoutSteps.findIndex(
    (step) => step.key === checkoutStep
  );

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

  const paymentLayoutColumns = isCompactCheckout
    ? "minmax(0, 1fr)"
    : "minmax(0, 1.1fr) minmax(360px, 0.9fr)";

  const reviewLayoutColumns = isCompactCheckout
    ? "minmax(0, 1fr)"
    : "minmax(0, 1.2fr) minmax(340px, 0.8fr)";

  const infoCardStyle: React.CSSProperties = {
    borderRadius: "14px",
    border: cardBorder,
    background: cardBg,
    padding: isCompactCheckout ? "14px" : "16px",
    boxShadow: isLight
      ? "0 1px 2px rgba(16,24,40,0.04)"
      : "0 10px 24px rgba(0,0,0,0.14)",
  };

  const selectedItemsCard = (
    <div style={infoCardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
          marginBottom: "12px",
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
          Selected items
        </h4>
      </div>

      {cartItems.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: subtleText,
            lineHeight: 1.6,
          }}
        >
          No items in cart.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {cartItems.map((item, index) => (
            <div
              key={`${item.id}-${item.selectedVariantValue || "default"}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: isCompactCheckout
                  ? "56px minmax(0, 1fr)"
                  : "64px minmax(0, 1fr) auto",
                gap: "12px",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: index === cartItems.length - 1 ? "none" : cardDivider,
              }}
            >
              <div
                style={{
                  width: isCompactCheckout ? "56px" : "64px",
                  height: isCompactCheckout ? "56px" : "64px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: mutedPanel,
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: textColor,
                    lineHeight: 1.35,
                  }}
                >
                  {item.name}
                </p>

                {item.selectedVariantValue ? (
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "12px",
                      color: subtleText,
                      lineHeight: 1.45,
                    }}
                  >
                    {item.selectedVariantLabel || "Option"}: {item.selectedVariantValue}
                  </p>
                ) : null}

                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: subtleText,
                  }}
                >
                  Qty {item.quantity} × ₹{item.price}
                </p>
              </div>

              {!isCompactCheckout ? (
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: textColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  ₹{item.quantity * item.price}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (placedOrder) {
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
            maxWidth: "720px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            style={{
              borderRadius: "20px",
              border: shellBorder,
              background: shellBg,
              boxShadow: isLight
                ? "0 1px 2px rgba(16,24,40,0.04)"
                : "0 18px 44px rgba(0,0,0,0.22)",
              padding: isCompactCheckout ? "24px 18px" : "36px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "999px",
                margin: "0 auto 16px",
                display: "grid",
                placeItems: "center",
                background: accentColor,
                color: "#fff",
                fontSize: "34px",
                fontWeight: 800,
                boxShadow: "0 16px 32px rgba(47,109,246,0.24)",
              }}
            >
              ✓
            </div>

            <h2
              style={{
                margin: "0 0 10px",
                fontSize: isCompactCheckout ? "28px" : "34px",
                lineHeight: 1.1,
                fontWeight: 800,
                color: textColor,
              }}
            >
              Order placed successfully
            </h2>

            <p
              style={{
                margin: "0 0 10px",
                fontSize: "14px",
                color: subtleText,
                lineHeight: 1.7,
              }}
            >
              Your order has been confirmed and is now being processed.
            </p>

            <div
              style={{
                display: "grid",
                gap: "10px",
                marginTop: "20px",
                textAlign: "left",
                borderRadius: "14px",
                border: cardBorder,
                background: cardBg,
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ fontSize: "13px", color: subtleText }}>Order ID</span>
                <span style={{ fontSize: "13px", color: textColor, fontWeight: 700 }}>
                  {placedOrder.orderId}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ fontSize: "13px", color: subtleText }}>Status</span>
                <span style={{ fontSize: "13px", color: textColor, fontWeight: 700, textTransform: "capitalize" }}>
                  {placedOrder.status.replace(/_/g, " ")}
                </span>
              </div>

              {typeof placedOrder.total === "number" ? (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: subtleText }}>Total</span>
                  <span style={{ fontSize: "13px", color: textColor, fontWeight: 700 }}>
                    ₹{placedOrder.total}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: isCompactCheckout
                ? "clamp(28px, 4vw, 32px)"
                : "clamp(34px, 4vw, 38px)",
              lineHeight: 1.05,
              fontWeight: 800,
              color: textColor,
              letterSpacing: "-0.03em",
            }}
          >
            {page.title || page.name || "Checkout"}
          </h1>
        </div>

        <div
          style={{
            borderRadius: "18px",
            border: shellBorder,
            background: shellBg,
            boxShadow: isLight
              ? "0 1px 2px rgba(16,24,40,0.04)"
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
              gap: isCompactCheckout ? "10px" : "16px",
              alignItems: "center",
            }}
          >
            {checkoutSteps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = step.key === checkoutStep;
              const isAccessible =
                step.key === "delivery" ||
                (step.key === "payment" && canContinueDelivery) ||
                (step.key === "review" &&
                  canContinueDelivery &&
                  canContinuePayment);

              return (
                <div
                  key={step.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      !isCompactCheckout && index < checkoutSteps.length - 1
                        ? "auto 1fr"
                        : "auto",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => isAccessible && goToStep(step.key)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: isAccessible ? "pointer" : "default",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      opacity: isAccessible ? 1 : 0.55,
                    }}
                  >
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "999px",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                        border:
                          isCurrent || isCompleted
                            ? `1px solid ${accentColor}`
                            : isLight
                            ? "1px solid #d5dbe4"
                            : "1px solid rgba(255,255,255,0.16)",
                        background:
                          isCurrent || isCompleted ? accentColor : "transparent",
                        color:
                          isCurrent || isCompleted ? "#ffffff" : subtleText,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: isCurrent ? 700 : 600,
                        color: isCurrent ? textColor : subtleText,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.label}
                    </div>
                  </button>

                  {!isCompactCheckout && index < checkoutSteps.length - 1 ? (
                    <div
                      style={{
                        height: "1px",
                        background:
                          index < currentStepIndex ? accentColor : "#e5e7eb",
                        width: "100%",
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {checkoutStep === "delivery" ? (
          <div
            style={{
              minWidth: 0,
              display: "grid",
              gap: "14px",
              alignContent: "start",
            }}
          >
            {deliveryBlock
              ? renderBlock(deliveryBlock, blocksToRender.indexOf(deliveryBlock), {
                  compact: false,
                  currentStep: "delivery",
                  deliveryData,
                  savedAddresses,
                  selectedAddressId,
                  isAuthenticated,
                  isAddressesLoading,
                  onSavedAddressesChange: (addresses: DeliveryData[]) => {
                    setSavedAddresses(addresses);

                    const stillSelected = addresses.find(
                      (address) => address.id === selectedAddressId
                    );

                    if (!stillSelected) {
                      const nextSelected =
                        addresses.find((address) => address.isDefault) ||
                        addresses[0] ||
                        null;

                      if (nextSelected) {
                        setSelectedAddressId(nextSelected.id || null);
                        setDeliveryData(nextSelected);
                      } else {
                        setSelectedAddressId(null);
                        setDeliveryData(initialDeliveryData);
                      }
                    }
                  },
                  onSelectAddress: (address: DeliveryData) => {
                    setSelectedAddressId(address.id || null);
                    setDeliveryData(address);
                  },
                  onDeliveryDataChange: setDeliveryData,
                  onContinue: () => canContinueDelivery && goToStep("payment"),
                  continueDisabled: !canContinueDelivery,
                })
              : null}
          </div>
        ) : null}

        {checkoutStep === "payment" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: paymentLayoutColumns,
              gap: isCompactCheckout ? "14px" : "18px",
              alignItems: "start",
            }}
          >
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
                ? renderBlock(summaryBlock, blocksToRender.indexOf(summaryBlock), {
                    mode: "checkout_summary",
                    compact: false,
                    paymentMethod: paymentData.method,
                    show_promo: true,
                    show_summary: true,
                  })
                : null}
            </aside>

            <div
              style={{
                minWidth: 0,
                display: "grid",
                gap: "14px",
                alignContent: "start",
              }}
            >
              {paymentBlock
                ? renderBlock(paymentBlock, blocksToRender.indexOf(paymentBlock), {
                    compact: false,
                    currentStep: "payment",
                    paymentData,
                    onPaymentDataChange: setPaymentData,
                    onBack: () => goToStep("delivery"),
                    onContinue: () => canContinuePayment && goToStep("review"),
                    continueDisabled: !canContinuePayment,
                  })
                : null}
            </div>
          </div>
        ) : null}

        {checkoutStep === "review" ? (
          <div
            style={{
              borderRadius: "16px",
              border: shellBorder,
              background: isLight ? "#ffffff" : softPanel,
              boxShadow: isLight
                ? "0 1px 2px rgba(16,24,40,0.04)"
                : "0 10px 24px rgba(0,0,0,0.16)",
              padding: isCompactCheckout ? "16px" : "18px",
            }}
          >
            <div
              style={{
                marginBottom: "18px",
                paddingBottom: "12px",
                borderBottom: cardDivider,
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: subtleText,
                }}
              >
                Review
              </p>

              <h3
                style={{
                  margin: 0,
                  fontSize: "24px",
                  lineHeight: 1.1,
                  color: textColor,
                  fontWeight: 700,
                }}
              >
                Review & Pay
              </h3>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: reviewLayoutColumns,
                gap: "16px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "14px",
                }}
              >
                {selectedItemsCard}

                <div style={infoCardStyle}>
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
                        fontSize: "12px",
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
                      {selectedAddress?.fullName || deliveryData.fullName || "—"}
                    </div>
                    <div>{selectedAddress?.phone || deliveryData.phone || "—"}</div>
                    <div>{selectedAddress?.email || deliveryData.email || "—"}</div>
                    <div>{selectedAddress?.address || deliveryData.address || "—"}</div>
                    <div>
                      {selectedAddress?.city || deliveryData.city || "—"}
                      {(selectedAddress?.pincode || deliveryData.pincode)
                        ? ` - ${selectedAddress?.pincode || deliveryData.pincode}`
                        : ""}
                    </div>
                  </div>
                </div>

                <div style={infoCardStyle}>
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
                        fontSize: "12px",
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
              </div>

              <div
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
                  ? renderBlock(summaryBlock, blocksToRender.indexOf(summaryBlock), {
                      mode: "checkout_summary",
                      compact: false,
                      paymentMethod: paymentData.method,
                      show_summary: true,
                      show_items: false,
                      show_promo: false,
                      show_gift_card: false,
                      review_mode: true,
                    })
                  : null}

                {placeOrderBlock
                  ? renderBlock(placeOrderBlock, blocksToRender.indexOf(placeOrderBlock), {
                      compact: false,
                      buttonLabel:
                        paymentData.method.toUpperCase() === "COD"
                          ? "Place Order"
                          : "Pay Now",
                      reviewMode: true,
                      disabled: !(
                        canContinueDelivery &&
                        canContinuePayment &&
                        cartItems.length > 0 &&
                        selectedAddressId
                      ),
                      selectedAddressId,
                      paymentData,
                      onOrderPlaced: (order: {
                        orderId: string;
                        status: string;
                        total?: number;
                      }) => {
                        setPlacedOrder(order);
                      },
                    })
                  : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RenderPage;