import React from "react";
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
};

type EditorBlockWrapperProps = {
  blockId: string;
  blockType: string;
  selected: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
};

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
        outline: selected ? "2px solid #2563eb" : "1px dashed transparent",
        outlineOffset: "4px",
        borderRadius: "8px",
        transition: "outline-color 0.15s ease",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-10px",
          left: "8px",
          zIndex: 2,
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

      {children}
    </div>
  );
}

const EditorRenderPage: React.FC<EditorRenderPageProps> = ({
  page,
  siteId,
  selectedProduct = null,
  selectedBlockId = null,
  onSelectBlock,
}) => {
  const { products, cartItems } = useCart();

  if (!page) {
    return <div style={{ padding: "24px" }}>Page not found.</div>;
  }

  const resolvedBlocks = page.blocks ?? [];

  const isCheckoutPage =
    page.slug === "checkout" ||
    page.route === "/checkout" ||
    page.page_type === "checkout" ||
    page.flow === "checkout";

  const renderBlock = (block: Block, index: number) => {
    const Component = componentRegistry[block.type] as
      | React.ComponentType<any>
      | undefined;

    if (!Component) {
      console.warn(`No component registered for block type: ${block.type}`);
      return null;
    }

    const blockId = block.id ?? `${page.id ?? "page"}-${block.type}-${index}`;
    const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;

    const componentProps = {
      siteId,
      ...(block.props ?? {}),
    };

    let renderedNode: React.ReactNode;

    if (resolvedDataSource === "product") {
      renderedNode = (
        <Component
          {...componentProps}
          product={selectedProduct}
          selectedProduct={selectedProduct}
        />
      );
    } else if (resolvedDataSource === "products") {
      renderedNode = <Component {...componentProps} products={products} />;
    } else if (resolvedDataSource === "cart") {
      renderedNode = <Component {...componentProps} cartItems={cartItems} />;
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
    return <>{resolvedBlocks.map(renderBlock)}</>;
  }

  const addressBlock = resolvedBlocks[0];
  const paymentBlock = resolvedBlocks[1];
  const placeOrderBlock = resolvedBlocks[2];
  const remainingBlocks = resolvedBlocks.slice(3);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px 56px",
      }}
    >
      <div
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              fontWeight: 800,
            }}
          >
            {page.title || page.name || "Checkout"}
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "15px",
              lineHeight: 1.6,
              opacity: 0.75,
            }}
          >
            Complete your order with secure checkout.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              minWidth: 0,
            }}
          >
            {addressBlock ? renderBlock(addressBlock, 0) : null}
          </div>

          <div
            style={{
              minWidth: 0,
              display: "grid",
              gap: "16px",
              alignContent: "start",
            }}
          >
            {paymentBlock ? renderBlock(paymentBlock, 1) : null}
            {placeOrderBlock ? renderBlock(placeOrderBlock, 2) : null}
          </div>

          {remainingBlocks.length > 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "grid",
                gap: "20px",
                minWidth: 0,
              }}
            >
              {remainingBlocks.map((block, index) =>
                renderBlock(block, index + 3)
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EditorRenderPage;