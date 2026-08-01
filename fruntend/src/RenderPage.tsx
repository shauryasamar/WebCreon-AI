import React, { useEffect, useMemo, useState } from "react";
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

const RenderPage: React.FC<RenderPageProps> = ({
  page,
  siteId,
  selectedProduct = null,
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

  const blocksToRender = detailRelevantBlocks;

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

  const usedBlockIds = new Set(
    [deliveryBlock, paymentBlock, placeOrderBlock, summaryBlock]
      .filter(Boolean)
      .map((block) => block!.id || block!.type)
  );

  const extraBlocks = blocksToRender.filter((block) => {
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
              ? renderBlock(deliveryBlock, blocksToRender.indexOf(deliveryBlock), {
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
              ? renderBlock(paymentBlock, blocksToRender.indexOf(paymentBlock), {
                  compact: true,
                })
              : null}

            {summaryBlock
              ? renderBlock(summaryBlock, blocksToRender.indexOf(summaryBlock), {
                  mode: "checkout_summary",
                  compact: true,
                })
              : null}

            {placeOrderBlock
              ? renderBlock(placeOrderBlock, blocksToRender.indexOf(placeOrderBlock), {
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
                renderBlock(block, index + blocksToRender.length)
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RenderPage;