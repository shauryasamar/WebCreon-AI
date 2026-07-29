import React, { useMemo, useState } from "react";
import { useCart, Product } from "./CartContext";
import { componentRegistry } from "./componentRegistry";

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

type RenderPageProps = {
  page: Page | null | undefined;
  siteId: string;
  selectedProduct?: Product | null;
  theme?: Theme;
};

const RenderPage: React.FC<RenderPageProps> = ({
  page,
  siteId,
  selectedProduct = null,
  theme,
}) => {
  const { products, cartItems } = useCart();
  const [selectedFilter, setSelectedFilter] = useState("All");

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

  const renderBlock = (block: Block, index: number) => {
    const Component = componentRegistry[block.type];

    if (!Component) {
      console.warn(`No component registered for block type: ${block.type}`);
      return null;
    }

    const blockId = block.id ?? `${page.id ?? "page"}-${block.type}-${index}`;
    const resolvedDataSource = block.data_source ?? block.datasource ?? undefined;

    const blockProps = (block.props ?? {}) as Record<string, any>;
    const componentProps = {
      siteId,
      ...blockProps,
    };

    if (block.type === "filter_sidebar" || block.type === "filtersidebar") {
      return (
        <Component
          key={blockId}
          {...componentProps}
          theme={(blockProps.theme as Theme | undefined) ?? theme}
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

    if (resolvedDataSource === "products") {
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
          theme={theme}
          cartItems={cartItems}
        />
      );
    }

    return <Component key={blockId} {...componentProps} />;
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
          <div style={{ minWidth: 0 }}>
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

export default RenderPage;