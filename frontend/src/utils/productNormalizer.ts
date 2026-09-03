import { Product } from "../CartContext";
import { optimizeImageUrl } from "./imageOptimizer";

export function slugify(value?: string | null): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeStorefrontProduct(raw: any): Product {
  const attributes = raw?.attributes ?? {};
  const price = Number(raw?.price ?? 0);
  const comparePrice =
    raw?.compare_price != null
      ? Number(raw.compare_price)
      : raw?.comparePrice != null
      ? Number(raw.comparePrice)
      : raw?.original_price != null
      ? Number(raw.original_price)
      : raw?.originalPrice != null
      ? Number(raw.originalPrice)
      : null;
  const rawImages = Array.isArray(raw?.images)
    ? raw.images.filter(
        (img: unknown): img is string => typeof img === "string" && img.trim() !== ""
      )
    : raw?.image
    ? [raw.image]
    : [];
  const images = rawImages.map((img: string) => optimizeImageUrl(img));
  const variantOption =
    raw?.variant_option ??
    raw?.variantOption ??
    (Array.isArray(attributes?.sizes) || Array.isArray(raw?.sizes)
      ? {
          optionType: "size",
          optionName: "Size",
          optionValues: (
            Array.isArray(attributes?.sizes) ? attributes.sizes : raw?.sizes || []
          ).map((size: string) => ({
            value: String(size),
            inStock: true,
            stockQty: null,
          })),
        }
      : null);
  const stock =
    raw?.stock != null && !Number.isNaN(Number(raw.stock))
      ? Number(raw.stock)
      : 0;
  const inStock =
    typeof raw?.in_stock === "boolean"
      ? raw.in_stock
      : typeof raw?.inStock === "boolean"
      ? raw.inStock
      : stock > 0;
  const originalPrice =
    comparePrice != null && comparePrice > 0 ? comparePrice : price;
  const discountPercent =
    raw?.discountPercent != null
      ? Number(raw.discountPercent)
      : raw?.discount_percent != null
      ? Number(raw.discount_percent)
      : comparePrice != null && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : 0;

  return {
    id: raw?.id != null ? String(raw.id) : slugify(raw?.name || ""),
    site_id: raw?.site_id != null ? String(raw.site_id) : undefined,
    name: raw?.name ?? "",
    brand: raw?.brand ?? "",
    category: raw?.category ?? "",
    category_id: raw?.category_id != null ? String(raw.category_id) : null,
    category_name: raw?.category_name ?? null,
    collections: Array.isArray(raw?.collections) ? raw.collections : [],
    description: raw?.description ?? "",
    highlights: Array.isArray(raw?.highlights) ? raw.highlights : [],
    slug: raw?.slug || slugify(raw?.name) || String(raw?.id ?? ""),
    price,
    compare_price: comparePrice,
    images,
    stock,
    in_stock: inStock,
    is_active: raw?.is_active !== false,
    sku: raw?.sku || null,
    hsn_code: raw?.hsn_code || null,
    video_url: raw?.video_url || null,
    sibling_group: raw?.sibling_group || null,
    sibling_label: raw?.sibling_label || null,
    siblings: Array.isArray(raw?.siblings) ? raw.siblings : [],
    weight_grams: raw?.weight_grams != null ? Number(raw.weight_grams) : 500,
    length_cm: raw?.length_cm != null ? Number(raw.length_cm) : null,
    width_cm: raw?.width_cm != null ? Number(raw.width_cm) : null,
    height_cm: raw?.height_cm != null ? Number(raw.height_cm) : null,
    variant_option: variantOption,
    originalPrice,
    discountPercent,
    image: images[0] || "",
    imageUrl: images[0] || "",
    image_url: images[0] || "",
    average_rating:
      raw?.average_rating != null ? Number(raw.average_rating) : undefined,
    review_count:
      raw?.review_count != null ? Number(raw.review_count) : undefined,
    return_window_days:
      raw?.return_window_days != null ? Number(raw.return_window_days) : null,
    created_at: raw?.created_at ?? null,
    updated_at: raw?.updated_at ?? null,
  };
}
