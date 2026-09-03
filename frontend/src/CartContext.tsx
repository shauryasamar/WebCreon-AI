import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_BASE_URL } from "./config/api";
import { getThumbnailUrl } from "./utils/imageOptimizer";
import { getCustomerAuthHeaders } from "./utils/customerAuthFetch";

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

export type ProductReview = {
  id: string;
  site_id: string;
  product_id: string;
  customer_id: string;
  order_id: string;
  order_item_id: string;
  rating: number;
  review_text: string;
  review_images: string[];
  customer_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Product = {
  id: string | number;
  site_id?: string;
  name: string;
  brand?: string;
  category?: string;
  category_id?: string | null;
  category_name?: string | null;
  collections?: { id: string; name: string; slug?: string; is_badge?: boolean; badge_color?: string | null }[];
  description: string;
  highlights?: string[];
  slug?: string;
  price: number;
  compare_price?: number | null;
  images?: string[];
  stock?: number;
  in_stock?: boolean;
  is_active?: boolean;
  sku?: string | null;
  hsn_code?: string | null;
  video_url?: string | null;
  weight_grams?: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  variant_option?: ProductVariantOption | null;
  sibling_group?: string | null;
  sibling_label?: string | null;
  siblings?: Array<{
    id: string;
    name: string;
    sibling_label?: string | null;
    slug?: string | null;
    price: number;
    compare_price?: number | null;
    in_stock: boolean;
    cover_image?: string | null;
    is_current?: boolean;
  }>;
  originalPrice?: number;
  discountPercent?: number;
  discount_percent?: number;
  image?: string;
  image_url?: string;
  imageUrl?: string;
  sizes?: string[];
  inStock?: boolean;
  selectedVariantValue?: string | null;
  selectedVariantLabel?: string | null;
  average_rating?: number;
  review_count?: number;
  sales_count?: number | null;
  salesCount?: number | null;
  return_window_days?: number | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  reviews?: ProductReview[];
};

export type CartItem = Product & {
  quantity: number;
};

type ProductId = string | number;

export type ValidatedCoupon = {
  id?: string;
  code: string;
  discountType: "percentage" | "fixed_amount" | "free_shipping";
  discountValue: number;
  discountAmount: number;
  message?: string;
};

type CartContextType = {
  products: Product[];
  cartItems: CartItem[];
  cartCount: number;
  cartTotal: number;
  isCartLoading: boolean;
  isProductsLoading?: boolean;
  appliedCoupon: ValidatedCoupon | null;
  setAppliedCoupon: (coupon: ValidatedCoupon | null) => void;
  clearAppliedCoupon: () => void;
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
  defaultReturnWindowDays?: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

type CartProviderProps = {
  children: React.ReactNode;
  products?: Product[];
  siteId?: string;
  defaultReturnWindowDays?: number;
  isProductsLoading?: boolean;
  /** When true the cart provider is running inside the admin builder preview.
   *  Skip the authenticated /cart fetch (which would 403 with a cross-site
   *  customer cookie) and operate in guest-cart mode instead. */
  isAdminMode?: boolean;
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

const buildCouponStorageKey = (siteId?: string) =>
  `webcreon_coupon:${siteId ?? "default"}`;

const readPersistedCoupon = (siteId?: string): ValidatedCoupon | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(buildCouponStorageKey(siteId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writePersistedCoupon = (siteId: string | undefined, coupon: ValidatedCoupon | null) => {
  if (typeof window === "undefined") return;
  try {
    if (coupon) {
      window.sessionStorage.setItem(buildCouponStorageKey(siteId), JSON.stringify(coupon));
    } else {
      window.sessionStorage.removeItem(buildCouponStorageKey(siteId));
    }
  } catch {}
};

export function CartProvider({
  children,
  products = [],
  siteId,
  defaultReturnWindowDays = 7,
  isProductsLoading = false,
  isAdminMode = false,
}: CartProviderProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartItemIds, setCartItemIds] = useState<Record<string, string>>({});
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [appliedCoupon, setAppliedCouponState] = useState<ValidatedCoupon | null>(() =>
    readPersistedCoupon(siteId)
  );

  const resolvedSiteId = siteId;

  const setAppliedCoupon = useCallback((coupon: ValidatedCoupon | null) => {
    setAppliedCouponState(coupon);
    writePersistedCoupon(resolvedSiteId, coupon);
  }, [resolvedSiteId]);

  const clearAppliedCoupon = useCallback(() => {
    setAppliedCouponState(null);
    writePersistedCoupon(resolvedSiteId, null);
  }, [resolvedSiteId]);

  // Pre-load all cart item images into browser memory so cart drawer and checkout render them in 0ms
  useEffect(() => {
    if (Array.isArray(cartItems) && cartItems.length > 0 && typeof window !== "undefined") {
      cartItems.forEach((item) => {
        if (item.image) {
          const i1 = new Image();
          i1.src = getThumbnailUrl(item.image, 180, 180);
          const i2 = new Image();
          i2.src = getThumbnailUrl(item.image, 140, 140);
        }
      });
    }
  }, [cartItems]);

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

    // In admin/builder preview mode there is no customer session for this site.
    // Skip the authenticated fetch entirely (prevents a guaranteed cross-site 403)
    // and operate from the local guest-cart instead.
    if (isAdminMode) {
      loadGuestCartIntoState();
      return;
    }

    setIsCartLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/cart/${resolvedSiteId}`, {
        method: "GET",
        credentials: "include",
        headers: getCustomerAuthHeaders(resolvedSiteId),
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
  }, [applyCartResponse, isAdminMode, loadGuestCartIntoState, resolvedSiteId]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(
    async (product: Product, quantity = 1) => {
      if (!resolvedSiteId) return;

      const selectedVariantValue = getSelectedVariantValue(product);
      const safeQuantity = Math.max(1, quantity);

      try {
        const res = await fetch(`${API_BASE_URL}/cart/${resolvedSiteId}/items`, {
          method: "POST",
          credentials: "include",
          headers: getCustomerAuthHeaders(resolvedSiteId, {
            "Content-Type": "application/json",
          }),
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
          `${API_BASE_URL}/cart/${resolvedSiteId}/items/${itemId}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: getCustomerAuthHeaders(resolvedSiteId),
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
          `${API_BASE_URL}/cart/${resolvedSiteId}/items/${itemId}`,
          {
            method: "PUT",
            credentials: "include",
            headers: getCustomerAuthHeaders(resolvedSiteId, {
              "Content-Type": "application/json",
            }),
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
      const res = await fetch(`${API_BASE_URL}/cart/${resolvedSiteId}/clear`, {
        method: "DELETE",
        credentials: "include",
        headers: getCustomerAuthHeaders(resolvedSiteId),
      });

      if (res.status === 401 || res.status === 403) {
        clearGuestCartStorage(resolvedSiteId);
        clearAppliedCoupon();
        setCartItems([]);
        setCartItemIds({});
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to clear cart");
      }

      clearAppliedCoupon();
      const data: BackendCartResponse = await res.json();
      applyCartResponse(data);
    } catch (error) {
      console.error("Failed to clear cart", error);
    }
  }, [applyCartResponse, clearAppliedCoupon, resolvedSiteId]);

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
      isProductsLoading,
      appliedCoupon,
      setAppliedCoupon,
      clearAppliedCoupon,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshCart,
      defaultReturnWindowDays,
    }),
    [
      products,
      cartItems,
      cartCount,
      cartTotal,
      isCartLoading,
      isProductsLoading,
      appliedCoupon,
      setAppliedCoupon,
      clearAppliedCoupon,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshCart,
      defaultReturnWindowDays,
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