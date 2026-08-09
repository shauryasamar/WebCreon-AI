import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL} from "../config/api";


type VariantValue = {
  value: string;
  inStock: boolean;
  stockQty?: number | null;
  price?: number | null;
  comparePrice?: number | null;
};


type ProductVariantOption = {
  optionType: "size" | "weight" | "shoe_size" | "volume" | "pack_size" | "custom";
  optionName: string;
  optionValues: VariantValue[];
};


type Category = {
  id: string;
  name: string;
  slug?: string;
};

type Collection = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
};

type Product = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  category_id?: string | null;
  category_name?: string | null;
  collections?: { id: string; name: string; slug?: string }[];
  price: number;
  compare_price?: number | null;
  images: string[];
  description: string;
  in_stock: boolean;
  stock: number;
  slug?: string | null;
  variant_option?: ProductVariantOption | null;
};


type VariantRow = {
  value: string;
  price: string;
  comparePrice: string;
  stockQty: string;
  inStock: boolean;
};


type ProductFormValues = {
  name: string;
  brand: string;
  category: string;
  categoryId: string;
  selectedCollectionIds: string[];
  description: string;
  slug: string;
  imagesText: string;
  optionType: ProductVariantOption["optionType"];
  optionName: string;
  optionValuesText: string;
};


type FormErrors = Partial<
  Record<keyof ProductFormValues | "imagesText" | "optionValuesText" | "variantRows", string>
>;



const presetMap: Record<
  ProductVariantOption["optionType"],
  { optionName: string; values: string[] }
> = {
  size: { optionName: "Size", values: ["S", "M", "L", "XL"] },
  weight: { optionName: "Weight", values: ["500g", "1kg", "2kg"] },
  shoe_size: { optionName: "Shoe Size", values: ["UK6", "UK7", "UK8", "UK9"] },
  volume: { optionName: "Volume", values: ["250ml", "500ml", "1L"] },
  pack_size: { optionName: "Pack Size", values: ["1 pack", "2 pack", "5 pack"] },
  custom: { optionName: "", values: [] },
};


const normalizeProduct = (p: any): Product => ({
  id: String(p.id),
  name: p.name ?? "",
  brand: p.brand ?? "",
  category: p.category ?? "",
  category_id: p.category_id ? String(p.category_id) : null,
  category_name: p.category_name ?? null,
  collections: Array.isArray(p.collections) ? p.collections : [],
  price: Number(p.price ?? 0),
  compare_price: p.compare_price != null ? Number(p.compare_price) : null,
  images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
  description: p.description ?? "",
  in_stock: Boolean(p.in_stock ?? Number(p.stock ?? 0) > 0),
  stock: Number(p.stock ?? 0),
  slug: p.slug ?? null,
  variant_option: p.variant_option ?? null,
});


const buildVariantRowsFromText = (
  text: string,
  existing: VariantRow[] = []
): VariantRow[] => {
  const values = text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);


  return values.map((value) => {
    const found = existing.find((item) => item.value.toLowerCase() === value.toLowerCase());
    return (
      found || {
        value,
        price: "",
        comparePrice: "",
        stockQty: "",
        inStock: true,
      }
    );
  });
};


const getVariantDiscountPercent = (price: string, comparePrice: string) => {
  const finalPrice = Number(price);
  const original = Number(comparePrice);


  if (
    !price.trim() ||
    !comparePrice.trim() ||
    !Number.isFinite(finalPrice) ||
    !Number.isFinite(original) ||
    original <= finalPrice ||
    finalPrice <= 0
  ) {
    return null;
  }


  return Math.round(((original - finalPrice) / original) * 100);
};


const AdminProducts = () => {
  const { siteId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showAddCollection, setShowAddCollection] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);


  const [formValues, setFormValues] = useState<ProductFormValues>({
    name: "",
    brand: "",
    category: "",
    categoryId: "",
    selectedCollectionIds: [],
    description: "",
    slug: "",
    imagesText: "",
    optionType: "custom",
    optionName: "",
    optionValuesText: "",
  });


  const parseImages = (text: string) =>
    text
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);


  const buildVariantOption = (): ProductVariantOption | null => {
    if (!formValues.optionName.trim() && variantRows.length === 0) return null;


    const optionValues = variantRows
      .map((row) => ({
        value: row.value.trim(),
        inStock: row.inStock,
        stockQty: row.stockQty.trim() === "" ? null : Number(row.stockQty),
        price: row.price.trim() === "" ? null : Number(row.price),
        comparePrice: row.comparePrice.trim() === "" ? null : Number(row.comparePrice),
      }))
      .filter((row) => row.value);


    if (optionValues.length === 0) return null;


    return {
      optionType: formValues.optionType,
      optionName: formValues.optionName.trim(),
      optionValues,
    };
  };


  const getFallbackProductPrice = () => {
    const firstWithPrice = variantRows.find(
      (row) => row.price.trim() !== "" && Number(row.price) > 0
    );
    return firstWithPrice ? Number(firstWithPrice.price) : 0;
  };


  const getFallbackComparePrice = () => {
    const firstWithComparePrice = variantRows.find(
      (row) =>
        row.comparePrice.trim() !== "" &&
        Number(row.comparePrice) > 0 &&
        Number(row.comparePrice) >= Number(row.price || 0)
    );
    return firstWithComparePrice ? Number(firstWithComparePrice.comparePrice) : null;
  };


  const getFallbackStock = () =>
    variantRows.reduce((sum, row) => {
      const qty = row.stockQty.trim() === "" ? 0 : Number(row.stockQty);
      return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
    }, 0);


  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const images = parseImages(formValues.imagesText);
    const optionValues = formValues.optionValuesText
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);


    if (!formValues.name.trim()) nextErrors.name = "Name is required.";
    if (!formValues.category.trim()) nextErrors.category = "Product Type is required.";
    if (!formValues.description.trim()) nextErrors.description = "Description is required.";
    if (images.length === 0) nextErrors.imagesText = "Add at least one image.";
    if (!formValues.optionName.trim()) nextErrors.optionName = "Option name is required.";
    if (optionValues.length === 0) nextErrors.optionValuesText = "Add at least one option value.";
    if (new Set(optionValues.map((v) => v.toLowerCase())).size !== optionValues.length) {
      nextErrors.optionValuesText = "Duplicate option values are not allowed.";
    }


    const hasAnyVariantPrice = variantRows.some(
      (row) => row.price.trim() !== "" && Number(row.price) > 0
    );


    if (!hasAnyVariantPrice) {
      nextErrors.variantRows = "Add at least one variant price.";
    }


    const invalidVariantRow = variantRows.some((row) => {
      const price = row.price.trim() === "" ? null : Number(row.price);
      const comparePrice =
        row.comparePrice.trim() === "" ? null : Number(row.comparePrice);
      const stockQty = row.stockQty.trim() === "" ? null : Number(row.stockQty);


      return (
        !row.value.trim() ||
        price == null ||
        !Number.isFinite(price) ||
        price <= 0 ||
        (comparePrice != null &&
          (!Number.isFinite(comparePrice) || comparePrice < price)) ||
        (stockQty != null &&
          (!Number.isFinite(stockQty) || stockQty < 0))
      );
    });


    if (invalidVariantRow) {
      nextErrors.variantRows =
        "Each variant must have value, valid price, optional MRP, and valid stock.";
    }


    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };


  const resetForm = () => {
    setEditingProduct(null);
    setErrors({});
    setVariantRows([]);
    setFormValues({
      name: "",
      brand: "",
      category: "",
      categoryId: "",
      selectedCollectionIds: [],
      description: "",
      slug: "",
      imagesText: "",
      optionType: "custom",
      optionName: "",
      optionValuesText: "",
    });
  };


  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };


  const openEditForm = (product: Product) => {
    const optionValues = product.variant_option?.optionValues ?? [];
    setEditingProduct(product);
    setErrors({});
    setVariantRows(
      optionValues.map((v) => ({
        value: v.value,
        price: v.price != null ? String(v.price) : "",
        comparePrice:
          (v as any).comparePrice != null ? String((v as any).comparePrice) : "",
        stockQty: v.stockQty != null ? String(v.stockQty) : "",
        inStock: v.inStock !== false,
      }))
    );
    setFormValues({
      name: product.name,
      brand: product.brand ?? "",
      category: product.category ?? "",
      categoryId: product.category_id ?? "",
      selectedCollectionIds: (product.collections ?? []).map((c) => c.id),
      description: product.description ?? "",
      slug: product.slug ?? "",
      imagesText: (product.images ?? []).join("\n"),
      optionType: product.variant_option?.optionType ?? "custom",
      optionName: product.variant_option?.optionName ?? "",
      optionValuesText: optionValues.map((v) => v.value).join(", "),
    });
    setShowForm(true);
  };


  const handleCreateCategoryInline = async () => {
    if (!siteId || !newCategoryName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setCategories((prev) => [...prev, created]);
        setFormValues((prev) => ({ ...prev, categoryId: created.id }));
        setNewCategoryName("");
        setShowAddCategory(false);
      }
    } catch (err) {
      console.error("Error creating category", err);
    }
  };


  const handleCreateCollectionInline = async () => {
    if (!siteId || !newCollectionName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setCollections((prev) => [...prev, created]);
        setFormValues((prev) => ({
          ...prev,
          selectedCollectionIds: [...prev.selectedCollectionIds, created.id],
        }));
        setNewCollectionName("");
        setShowAddCollection(false);
      }
    } catch (err) {
      console.error("Error creating collection", err);
    }
  };


  useEffect(() => {
    const loadData = async () => {
      if (!siteId) return;
      setIsLoading(true);
      try {
        const [prodRes, catRes, colRes] = await Promise.all([
          fetch(`${API_BASE_URL}/sites/${siteId}/products`, { credentials: "include" }),
          fetch(`${API_BASE_URL}/sites/${siteId}/categories/public`),
          fetch(`${API_BASE_URL}/sites/${siteId}/collections/public`),
        ]);

        if (prodRes.ok) {
          const data = await prodRes.json();
          setProducts(Array.isArray(data) ? data.map(normalizeProduct) : []);
        }
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategories(Array.isArray(catData) ? catData : []);
        }
        if (colRes.ok) {
          const colData = await colRes.json();
          setCollections(Array.isArray(colData) ? colData : []);
        }
      } catch (err) {
        console.error("Error loading products/categories/collections", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [siteId]);


  const imagePreviewList = useMemo(() => parseImages(formValues.imagesText), [formValues.imagesText]);


  const handleFormChange = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K]
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));


    if (field === "optionType") {
      const preset = presetMap[value as ProductVariantOption["optionType"]];
      if (preset) {
        setFormValues((prev) => ({
          ...prev,
          optionType: value as ProductVariantOption["optionType"],
          optionName: preset.optionName,
          optionValuesText: preset.values.join(", "),
        }));
        setVariantRows((prev) => buildVariantRowsFromText(preset.values.join(", "), prev));
      }
      return;
    }


    if (field === "optionValuesText" && typeof value === "string") {
      setVariantRows((prev) => buildVariantRowsFromText(value, prev));
    }
  };


  const handleVariantRowChange = (
    index: number,
    field: keyof VariantRow,
    value: string | boolean
  ) => {
    setVariantRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };


  const handleImageUpload = async (file: File) => {
    if (!siteId) return;


    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only PNG, JPG, JPEG, and WEBP files are allowed.");
      return;
    }


    const formData = new FormData();
    formData.append("file", file);


    setIsUploadingImage(true);
    try {
      const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products/upload-image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });


      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        alert(errorData?.detail || "Failed to upload image.");
        return;
      }


      const data = await res.json();
      const fullUrl = `${API_BASE_URL}${data.url}`;


      setFormValues((prev) => ({
        ...prev,
        imagesText: prev.imagesText.trim()
          ? `${prev.imagesText}\n${fullUrl}`
          : fullUrl,
      }));
    } catch (err) {
      console.error("Image upload failed", err);
      alert("Image upload failed.");
    } finally {
      setIsUploadingImage(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) return;
    if (!validateForm()) return;


    const fallbackPrice = getFallbackProductPrice();
    const fallbackComparePrice = getFallbackComparePrice();
    const fallbackStock = getFallbackStock();


    const payload = {
      name: formValues.name.trim(),
      brand: formValues.brand.trim() || null,
      category: formValues.category.trim(),
      category_id: formValues.categoryId ? formValues.categoryId : null,
      collection_ids: formValues.selectedCollectionIds,
      description: formValues.description.trim(),
      price: fallbackPrice,
      compare_price: fallbackComparePrice,
      stock: fallbackStock,
      in_stock: variantRows.some((row) => row.inStock && Number(row.stockQty || 0) > 0),
      slug: formValues.slug.trim() || null,
      images: parseImages(formValues.imagesText),
      variant_option: buildVariantOption(),
    };


    try {
      if (editingProduct) {
        const res = await fetch(
          `${API_BASE_URL}/sites/${siteId}/products/${editingProduct.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          const updatedRaw = await res.json();
          const updated = normalizeProduct(updatedRaw);
          setProducts((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
        } else {
          console.error("Failed to update product", res.status);
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/sites/${siteId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const createdRaw = await res.json();
          const created = normalizeProduct(createdRaw);
          setProducts((prev) => [...prev, created]);
        } else {
          console.error("Failed to create product", res.status);
        }
      }
    } catch (err) {
      console.error("Error saving product", err);
    } finally {
      setShowForm(false);
      resetForm();
    }
  };


  const handleDelete = async (productId: string) => {
    if (!siteId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/sites/${siteId}/products/${productId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      } else {
        console.error("Failed to delete product", res.status);
      }
    } catch (err) {
      console.error("Error deleting product", err);
    }
  };


  return (
    <div style={{ maxWidth: "1100px", color: "#0f172a" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "18px",
        }}
      >
        <button onClick={openCreateForm} style={primaryButtonStyle}>
          + Add product
        </button>
      </div>


      {showForm && (
        <div
          style={{
            marginBottom: "20px",
            padding: "16px 18px",
            borderRadius: "8px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: "16px",
              color: "#0f172a",
              fontWeight: 700,
            }}
          >
            {editingProduct ? "Edit product" : "Add product"}
          </h2>


          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "12px 18px",
            }}
          >
            <FormField
              label="Name"
              value={formValues.name}
              onChange={(v) => handleFormChange("name", v)}
              error={errors.name}
            />
            <FormField
              label="Brand"
              value={formValues.brand}
              onChange={(v) => handleFormChange("brand", v)}
            />
            
            {/* Broad Category Dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={labelStyle}>Category (e.g. Men, Women, Kids)</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={formValues.categoryId}
                  onChange={(e) => handleFormChange("categoryId", e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">Select Category (Optional)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  + New
                </button>
              </div>
              {showAddCategory && (
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  <input
                    type="text"
                    placeholder="Category name (e.g. Men)"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategoryInline}
                    style={{ ...primaryButtonStyle, padding: "6px 12px", fontSize: "12px" }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Product Type (renamed from Category) */}
            <FormField
              label="Product Type (e.g. Shirt, Skirt, Jeans)"
              value={formValues.category}
              onChange={(v) => handleFormChange("category", v)}
              error={errors.category}
            />

            {/* Collections Multi-Select */}
            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={labelStyle}>Collections (e.g. Bestsellers, Festive, New Arrivals)</label>
                <button
                  type="button"
                  onClick={() => setShowAddCollection(!showAddCollection)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add New Collection
                </button>
              </div>
              {showAddCollection && (
                <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                  <input
                    type="text"
                    placeholder="Collection name (e.g. Festive)"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCollectionInline}
                    style={{ ...primaryButtonStyle, padding: "6px 12px", fontSize: "12px" }}
                  >
                    Save Collection
                  </button>
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "2px" }}>
                {collections.map((col) => {
                  const selected = formValues.selectedCollectionIds.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? formValues.selectedCollectionIds.filter((id) => id !== col.id)
                          : [...formValues.selectedCollectionIds, col.id];
                        handleFormChange("selectedCollectionIds", next);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "999px",
                        border: selected ? "1px solid #2563eb" : "1px solid #e2e8f0",
                        background: selected ? "#eff6ff" : "#f8fafc",
                        color: selected ? "#2563eb" : "#475569",
                        fontSize: "13px",
                        fontWeight: selected ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {selected ? "✓ " : ""}{col.name}
                    </button>
                  );
                })}
                {collections.length === 0 && (
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>No collections yet. Click "+ Add New Collection" to create one.</span>
                )}
              </div>
            </div>


            <div style={{ gridColumn: "1 / -1" }}>
              <FormField
                label="Description"
                value={formValues.description}
                onChange={(v) => handleFormChange("description", v)}
                error={errors.description}
              />
            </div>


            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={labelStyle}>Upload product image</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                      e.target.value = "";
                    }
                  }}
                  style={inputStyle}
                />
                {isUploadingImage ? (
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Uploading image...
                  </span>
                ) : null}
              </label>
            </div>


            <div style={{ gridColumn: "1 / -1" }}>
              <FormField
                label="Image URLs / uploaded image paths (one per line)"
                value={formValues.imagesText}
                onChange={(v) => handleFormChange("imagesText", v)}
                multiline
                error={errors.imagesText}
              />
            </div>


            {imagePreviewList.length > 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                {imagePreviewList.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    style={{
                      width: "88px",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <img
                      src={image}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: "88px",
                        height: "88px",
                        objectFit: "cover",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextImages = imagePreviewList.filter((_, i) => i !== index);
                        handleFormChange("imagesText", nextImages.join("\n"));
                      }}
                      style={dangerButtonStyle}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}


            <div
              style={{
                gridColumn: "1 / -1",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "grid", gap: "12px" }}>
                <label style={{ display: "grid", gap: "6px" }}>
                  <span style={labelStyle}>Option preset</span>
                  <select
                    value={formValues.optionType}
                    onChange={(e) =>
                      handleFormChange("optionType", e.target.value as ProductVariantOption["optionType"])
                    }
                    style={inputStyle}
                  >
                    <option value="custom">Custom</option>
                    <option value="size">Size</option>
                    <option value="weight">Weight</option>
                    <option value="shoe_size">Shoe Size</option>
                    <option value="volume">Volume</option>
                    <option value="pack_size">Pack Size</option>
                  </select>
                </label>


                <FormField
                  label="Option name"
                  value={formValues.optionName}
                  onChange={(v) => handleFormChange("optionName", v)}
                  error={errors.optionName}
                />
                <FormField
                  label="Option values (comma-separated)"
                  value={formValues.optionValuesText}
                  onChange={(v) => handleFormChange("optionValuesText", v)}
                  error={errors.optionValuesText}
                />


                {variantRows.length > 0 && (
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#475569",
                      }}
                    >
                      Per-variant price, MRP, discount, and stock
                    </div>


                    <div style={{ display: "grid", gap: "10px" }}>
                      {variantRows.map((row, index) => {
                        const discountPercent = getVariantDiscountPercent(row.price, row.comparePrice);


                        return (
                          <div
                            key={`${row.value}-${index}`}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: "10px",
                              alignItems: "end",
                              padding: "12px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <FormField
                              label="Value"
                              value={row.value}
                              onChange={(v) => handleVariantRowChange(index, "value", v)}
                            />
                            <FormField
                              label="Variant price"
                              type="number"
                              value={row.price}
                              onChange={(v) => handleVariantRowChange(index, "price", v)}
                            />
                            <FormField
                              label="Variant MRP"
                              type="number"
                              value={row.comparePrice}
                              onChange={(v) => handleVariantRowChange(index, "comparePrice", v)}
                            />
                            <FormField
                              label="Variant stock"
                              type="number"
                              value={row.stockQty}
                              onChange={(v) => handleVariantRowChange(index, "stockQty", v)}
                            />
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                minHeight: "42px",
                                color: "#334155",
                                fontSize: "13px",
                                paddingBottom: "8px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={row.inStock}
                                onChange={(e) => handleVariantRowChange(index, "inStock", e.target.checked)}
                              />
                              In stock
                            </label>


                            <div
                              style={{
                                minHeight: "42px",
                                display: "flex",
                                alignItems: "center",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: discountPercent ? "#15803d" : "#94a3b8",
                              }}
                            >
                              {discountPercent ? `${discountPercent}% off` : "No discount"}
                            </div>
                          </div>
                        );
                      })}
                    </div>


                    {errors.variantRows ? <span style={errorStyle}>{errors.variantRows}</span> : null}
                  </div>
                )}
              </div>
            </div>


            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={ghostButtonStyle}
              >
                Cancel
              </button>
              <button type="submit" style={primaryButtonStyle} disabled={isUploadingImage}>
                {editingProduct ? "Save changes" : "Create product"}
              </button>
            </div>
          </form>
        </div>
      )}


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <StatCard label="Total products" value={String(products.length)} />
        <StatCard
          label="In stock"
          value={String(products.filter((p) => p.in_stock).length)}
        />
        <StatCard
          label="Out of stock"
          value={String(products.filter((p) => !p.in_stock).length)}
        />
      </div>


      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Stock</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>


            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} style={tdStyle}>
                    Loading products...
                  </td>
                </tr>
              )}


              {!isLoading && products.length === 0 && (
                <tr>
                  <td colSpan={5} style={tdStyle}>
                    No products yet. Use “Add product” to create one.
                  </td>
                </tr>
              )}


              {products.map((product) => {
                const firstVariant = product.variant_option?.optionValues?.[0];
                const displayPrice =
                  typeof firstVariant?.price === "number" && firstVariant.price > 0
                    ? firstVariant.price
                    : product.price;
                const displayComparePrice =
                  typeof (firstVariant as any)?.comparePrice === "number" &&
                  (firstVariant as any).comparePrice > displayPrice
                    ? (firstVariant as any).comparePrice
                    : product.compare_price;


                return (
                  <tr key={product.id}>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          minWidth: "260px",
                        }}
                      >
                        <img
                          src={product.images[0] || ""}
                          alt={product.name}
                          style={{
                            width: "56px",
                            height: "68px",
                            borderRadius: "6px",
                            objectFit: "cover",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#0f172a",
                              marginBottom: "4px",
                            }}
                          >
                            {product.name}
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#64748b",
                            }}
                          >
                            {product.brand}
                          </div>
                        </div>
                      </div>
                    </td>


                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: "4px" }}>
                        <span>₹{displayPrice}</span>
                        {displayComparePrice != null && displayComparePrice > displayPrice && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#94a3b8",
                              textDecoration: "line-through",
                            }}
                          >
                            ₹{displayComparePrice}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>{product.category}</td>


                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: "6px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "5px 8px",
                            borderRadius: "4px",
                            background: product.in_stock ? "#f0fdf4" : "#fef2f2",
                            color: product.in_stock ? "#15803d" : "#b91c1c",
                            fontWeight: 700,
                            fontSize: "12px",
                            width: "fit-content",
                          }}
                        >
                          {product.in_stock ? "In stock" : "Out of stock"}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        >
                          Qty: {product.stock}
                        </span>
                      </div>
                    </td>


                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button
                          style={ghostButtonStyle}
                          onClick={() => openEditForm(product)}
                        >
                          Edit
                        </button>
                        <button
                          style={dangerButtonStyle}
                          onClick={() => handleDelete(product.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const FormField = ({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  multiline?: boolean;
  error?: string;
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <span style={labelStyle}>{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        style={inputStyle}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    )}
    {error ? <span style={errorStyle}>{error}</span> : null}
  </label>
);


const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      padding: "14px 16px",
      borderRadius: "8px",
      background: "#ffffff",
      border: "1px solid #e2e8f0",
    }}
  >
    <p
      style={{
        margin: "0 0 6px",
        fontSize: "13px",
        color: "#64748b",
      }}
    >
      {label}
    </p>
    <h3
      style={{
        margin: 0,
        fontSize: "22px",
        color: "#0f172a",
      }}
    >
      {value}
    </h3>
  </div>
);


const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#475569",
};


const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
  width: "100%",
};


const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "13px 16px",
  fontSize: "12px",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
};


const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderTop: "1px solid #e2e8f0",
  fontSize: "14px",
  color: "#0f172a",
  verticalAlign: "middle",
};


const ghostButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
};


const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};


const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 600,
  cursor: "pointer",
};


const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: "12px",
};


export default AdminProducts;
