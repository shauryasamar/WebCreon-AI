import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ProductVariantValue = {
  value: string;
  inStock?: boolean;
  stockQty?: number | null;
  price?: number | null;
  comparePrice?: number | null;
};

export type ProductVariantOption = {
  optionType?:
    | "size"
    | "weight"
    | "shoe_size"
    | "volume"
    | "pack_size"
    | "custom"
    | string;
  optionName: string;
  optionValues: ProductVariantValue[];
};

export type Product = {
  id: string | number;
  name: string;
  brand?: string;
  category?: string;
  description: string;
  slug?: string;
  price: number;
  compare_price?: number | null;
  images?: string[];
  stock?: number;
  in_stock?: boolean;
  variant_option?: ProductVariantOption | null;
  originalPrice?: number;
  discountPercent?: number;
  image?: string;
  sizes?: string[];
  inStock?: boolean;
  selectedVariantValue?: string | null;
  selectedVariantLabel?: string | null;
};

export type CartItem = Product & {
  quantity: number;
};

type ProductId = string | number;

type CartContextType = {
  products: Product[];
  cartItems: CartItem[];
  cartCount: number;
  cartTotal: number;
  isCartLoading: boolean;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  removeFromCart: (
    productId: ProductId,
    variantValue?: string | null
  ) => Promise<void>;
  updateQuantity: (
    productId: ProductId,
    quantity: number,
    variantValue?: string | null
  ) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

type CartProviderProps = {
  children: React.ReactNode;
  products?: Product[];
  siteId?: string;
};

type BackendCartItem = {
  id: string;
  product_id: string;
  quantity: number;
  selected_variant_label?: string | null;
  selected_variant_value?: string | null;
  unit_price: number;
  compare_price?: number | null;
  product_name: string;
  product_image?: string | null;
  product_slug?: string | null;
  line_total: number;
};

type BackendCartResponse = {
  id: string;
  site_id: string;
  user_id: string;
  items: BackendCartItem[];
  subtotal: number;
  total_items: number;
};

const getSelectedVariantValue = (product: Product) =>
  product.selectedVariantValue ??
  product.variant_option?.optionValues?.[0]?.value ??
  null;

const getBaseUrl = () =>
  (import.meta as any)?.env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

const mapBackendCartItemToCartItem = (item: BackendCartItem): CartItem => ({
  id: item.product_id,
  name: item.product_name,
  slug: item.product_slug ?? undefined,
  description: "",
  price: item.unit_price,
  compare_price: item.compare_price ?? null,
  image: item.product_image ?? undefined,
  images: item.product_image ? [item.product_image] : [],
  selectedVariantValue: item.selected_variant_value ?? null,
  selectedVariantLabel: item.selected_variant_label ?? null,
  quantity: item.quantity,
});

const buildGuestStorageKey = (siteId?: string) =>
  `guest_cart:${siteId ?? "default"}`;

const buildCartItemKey = (
  productId: ProductId,
  variantValue?: string | null
) => `${String(productId)}::${variantValue ?? ""}`;

const readGuestCart = (siteId?: string): CartItem[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(buildGuestStorageKey(siteId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeGuestCart = (siteId: string | undefined, items: CartItem[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildGuestStorageKey(siteId), JSON.stringify(items));
};

const clearGuestCartStorage = (siteId?: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(buildGuestStorageKey(siteId));
};

export function CartProvider({
  children,
  products = [],
  siteId,
}: CartProviderProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartItemIds, setCartItemIds] = useState<Record<string, string>>({});
  const [isCartLoading, setIsCartLoading] = useState(false);

  const resolvedSiteId = siteId;

  const applyCartResponse = useCallback((data: BackendCartResponse) => {
    const mappedItems = data.items.map(mapBackendCartItemToCartItem);

    const nextItemIds: Record<string, string> = {};
    for (const item of data.items) {
      const key = `${String(item.product_id)}::${item.selected_variant_value ?? ""}`;
      nextItemIds[key] = item.id;
    }

    setCartItems(mappedItems);
    setCartItemIds(nextItemIds);
  }, []);

  const loadGuestCartIntoState = useCallback(() => {
    const guestItems = readGuestCart(resolvedSiteId);
    setCartItems(guestItems);
    setCartItemIds({});
  }, [resolvedSiteId]);

  const refreshCart = useCallback(async () => {
    if (!resolvedSiteId) {
      setCartItems([]);
      setCartItemIds({});
      return;
    }

    setIsCartLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/cart/${resolvedSiteId}`, {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) {
        loadGuestCartIntoState();
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch cart");
      }

      const data: BackendCartResponse = await res.json();
      applyCartResponse(data);
    } catch (error) {
      console.error("Failed to refresh cart", error);
      loadGuestCartIntoState();
    } finally {
      setIsCartLoading(false);
    }
  }, [applyCartResponse, loadGuestCartIntoState, resolvedSiteId]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(
    async (product: Product, quantity = 1) => {
      if (!resolvedSiteId) return;

      const selectedVariantValue = getSelectedVariantValue(product);
      const safeQuantity = Math.max(1, quantity);

      try {
        const res = await fetch(`${getBaseUrl()}/cart/${resolvedSiteId}/items`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: product.id,
            quantity: safeQuantity,
            selected_variant_value: selectedVariantValue,
          }),
        });

        if (res.status === 401 || res.status === 403) {
          const existingItems = readGuestCart(resolvedSiteId);
          const key = buildCartItemKey(product.id, selectedVariantValue);

          const nextItems = [...existingItems];
          const existingIndex = nextItems.findIndex(
            (item) =>
              buildCartItemKey(item.id, item.selectedVariantValue) === key
          );

          if (existingIndex >= 0) {
            nextItems[existingIndex] = {
              ...nextItems[existingIndex],
              quantity: nextItems[existingIndex].quantity + safeQuantity,
            };
          } else {
            nextItems.push({
              ...product,
              selectedVariantValue,
              quantity: safeQuantity,
            });
          }

          writeGuestCart(resolvedSiteId, nextItems);
          setCartItems(nextItems);
          setCartItemIds({});
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to add item to cart");
        }

        const data: BackendCartResponse = await res.json();
        clearGuestCartStorage(resolvedSiteId);
        applyCartResponse(data);
      } catch (error) {
        console.error("Failed to add item to cart", error);

        const existingItems = readGuestCart(resolvedSiteId);
        const key = buildCartItemKey(product.id, selectedVariantValue);

        const nextItems = [...existingItems];
        const existingIndex = nextItems.findIndex(
          (item) => buildCartItemKey(item.id, item.selectedVariantValue) === key
        );

        if (existingIndex >= 0) {
          nextItems[existingIndex] = {
            ...nextItems[existingIndex],
            quantity: nextItems[existingIndex].quantity + safeQuantity,
          };
        } else {
          nextItems.push({
            ...product,
            selectedVariantValue,
            quantity: safeQuantity,
          });
        }

        writeGuestCart(resolvedSiteId, nextItems);
        setCartItems(nextItems);
        setCartItemIds({});
      }
    },
    [applyCartResponse, resolvedSiteId]
  );

  const removeFromCart = useCallback(
    async (productId: ProductId, variantValue?: string | null) => {
      if (!resolvedSiteId) return;

      const key = `${String(productId)}::${variantValue ?? ""}`;
      const itemId = cartItemIds[key];

      if (!itemId) {
        const nextItems = readGuestCart(resolvedSiteId).filter(
          (item) =>
            !(
              String(item.id) === String(productId) &&
              (item.selectedVariantValue ?? null) === (variantValue ?? null)
            )
        );
        writeGuestCart(resolvedSiteId, nextItems);
        setCartItems(nextItems);
        setCartItemIds({});
        return;
      }

      try {
        const res = await fetch(
          `${getBaseUrl()}/cart/${resolvedSiteId}/items/${itemId}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        if (res.status === 401 || res.status === 403) {
          const nextItems = readGuestCart(resolvedSiteId).filter(
            (item) =>
              !(
                String(item.id) === String(productId) &&
                (item.selectedVariantValue ?? null) === (variantValue ?? null)
              )
          );
          writeGuestCart(resolvedSiteId, nextItems);
          setCartItems(nextItems);
          setCartItemIds({});
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to remove item from cart");
        }

        const data: BackendCartResponse = await res.json();
        applyCartResponse(data);
      } catch (error) {
        console.error("Failed to remove item from cart", error);
      }
    },
    [applyCartResponse, cartItemIds, resolvedSiteId]
  );

  const updateQuantity = useCallback(
    async (
      productId: ProductId,
      quantity: number,
      variantValue?: string | null
    ) => {
      if (quantity <= 0) {
        await removeFromCart(productId, variantValue);
        return;
      }

      if (!resolvedSiteId) return;

      const key = `${String(productId)}::${variantValue ?? ""}`;
      const itemId = cartItemIds[key];

      if (!itemId) {
        const nextItems = readGuestCart(resolvedSiteId).map((item) =>
          String(item.id) === String(productId) &&
          (item.selectedVariantValue ?? null) === (variantValue ?? null)
            ? { ...item, quantity }
            : item
        );
        writeGuestCart(resolvedSiteId, nextItems);
        setCartItems(nextItems);
        setCartItemIds({});
        return;
      }

      try {
        const res = await fetch(
          `${getBaseUrl()}/cart/${resolvedSiteId}/items/${itemId}`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ quantity }),
          }
        );

        if (res.status === 401 || res.status === 403) {
          const nextItems = readGuestCart(resolvedSiteId).map((item) =>
            String(item.id) === String(productId) &&
            (item.selectedVariantValue ?? null) === (variantValue ?? null)
              ? { ...item, quantity }
              : item
          );
          writeGuestCart(resolvedSiteId, nextItems);
          setCartItems(nextItems);
          setCartItemIds({});
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to update cart quantity");
        }

        const data: BackendCartResponse = await res.json();
        applyCartResponse(data);
      } catch (error) {
        console.error("Failed to update cart quantity", error);
      }
    },
    [applyCartResponse, cartItemIds, removeFromCart, resolvedSiteId]
  );

  const clearCart = useCallback(async () => {
    if (!resolvedSiteId) return;

    try {
      const res = await fetch(`${getBaseUrl()}/cart/${resolvedSiteId}/clear`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) {
        clearGuestCartStorage(resolvedSiteId);
        setCartItems([]);
        setCartItemIds({});
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to clear cart");
      }

      const data: BackendCartResponse = await res.json();
      applyCartResponse(data);
    } catch (error) {
      console.error("Failed to clear cart", error);
    }
  }, [applyCartResponse, resolvedSiteId]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const value = useMemo(
    () => ({
      products,
      cartItems,
      cartCount,
      cartTotal,
      isCartLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshCart,
    }),
    [
      products,
      cartItems,
      cartCount,
      cartTotal,
      isCartLoading,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}