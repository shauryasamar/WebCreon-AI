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
            Fast one-page checkout with delivery, payment, summary, and final action.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isCompactCheckout
              ? "minmax(0, 1fr)"
              : "minmax(0, 1.05fr) minmax(360px, 0.95fr)",
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
            {deliveryBlock
              ? renderBlock(deliveryBlock, resolvedBlocks.indexOf(deliveryBlock), {
                  compact: true,
                })
              : null}
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
            {paymentBlock
              ? renderBlock(paymentBlock, resolvedBlocks.indexOf(paymentBlock), {
                  compact: true,
                })
              : null}

            {summaryBlock
              ? renderBlock(summaryBlock, resolvedBlocks.indexOf(summaryBlock), {
                  mode: "checkout_summary",
                  compact: true,
                })
              : null}

            {placeOrderBlock
              ? renderBlock(placeOrderBlock, resolvedBlocks.indexOf(placeOrderBlock), {
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