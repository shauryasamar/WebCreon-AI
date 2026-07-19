import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Product = {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  description: string;
  inStock: boolean;
  attributes?: Record<string, any>;
};

type ProductFormValues = {
  name: string;
  brand: string;
  category: string;
  price: string;
  image: string;
  description: string;
  inStock: boolean;
  sizes: string;    // clothing
  weights: string;  // grocery
  skinTypes: string; // skincare
};

const AdminProducts = () => {
  const { siteId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // TODO: get real domain from siteDefinition; for now, use a placeholder
  const domain: string = "generic";
  const isClothing = domain === "clothing";
  const isGrocery = domain === "grocery";
  const isSkincare = domain === "skincare";

  const [formValues, setFormValues] = useState<ProductFormValues>({
    name: "",
    brand: "",
    category: "",
    price: "",
    image: "",
    description: "",
    inStock: true,
    sizes: "",
    weights: "",
    skinTypes: "",
  });

  // Load products for this site from backend
  useEffect(() => {
    const loadProducts = async () => {
      if (!siteId) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/sites/${siteId}/products`
        );
        if (res.ok) {
          const data: Product[] = await res.json();
          setProducts(data);
        } else {
          console.error("Failed to load products", res.status);
        }
      } catch (err) {
        console.error("Error loading products", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [siteId]);

  const resetForm = () => {
    setEditingProduct(null);
    setFormValues({
      name: "",
      brand: "",
      category: "",
      price: "",
      image: "",
      description: "",
      inStock: true,
      sizes: "",
      weights: "",
      skinTypes: "",
    });
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormValues({
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: String(product.price),
      image: product.image,
      description: product.description,
      inStock: product.inStock,
      sizes: Array.isArray(product.attributes?.sizes)
        ? product.attributes?.sizes.join(", ")
        : "",
      weights: Array.isArray(product.attributes?.weights)
        ? product.attributes?.weights.join(", ")
        : "",
      skinTypes: Array.isArray(product.attributes?.skinTypes)
        ? product.attributes?.skinTypes.join(", ")
        : "",
    });
    setShowForm(true);
  };

  const handleFormChange = (
    field: keyof ProductFormValues,
    value: string | boolean
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildAttributesFromForm = () => {
    const attrs: Record<string, any> = {};

    if (isClothing && formValues.sizes.trim()) {
      attrs.sizes = formValues.sizes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (isGrocery && formValues.weights.trim()) {
      attrs.weights = formValues.weights
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
    }

    if (isSkincare && formValues.skinTypes.trim()) {
      attrs.skinTypes = formValues.skinTypes
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    return attrs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) return;

    const price = parseFloat(formValues.price || "0") || 0;
    const attributes = buildAttributesFromForm();

    const payload = {
      name: formValues.name,
      brand: formValues.brand,
      category: formValues.category,
      price,
      image: formValues.image,
      description: formValues.description,
      inStock: formValues.inStock,
      attributes,
    };

    try {
      if (editingProduct) {
        const res = await fetch(
          `http://127.0.0.1:8000/sites/${siteId}/products/${editingProduct.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          const updated: Product = await res.json();
          setProducts((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
        }
      } else {
        const res = await fetch(
          `http://127.0.0.1:8000/sites/${siteId}/products`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          const created: Product = await res.json();
          setProducts((prev) => [...prev, created]);
        }
      }
    } catch (err) {
      console.error("Error saving product", err);
    } finally {
      setShowForm(false);
      resetForm();
    }
  };

  const handleDelete = async (productId: number) => {
    if (!siteId) return;
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/sites/${siteId}/products/${productId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      }
    } catch (err) {
      console.error("Error deleting product", err);
    }
  };

  return (
    <div
      style={{
        maxWidth: "1100px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Admin / Products
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "40px",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "white",
            }}
          >
            Products
          </h1>
        </div>

        <button
          onClick={openCreateForm}
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid rgba(59,130,246,0.25)",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 10px 24px rgba(37,99,235,0.22)",
          }}
        >
          + Add product
        </button>
      </div>

      {showForm && (
        <div
          style={{
            marginBottom: "24px",
            padding: "16px 18px",
            borderRadius: "18px",
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: "18px",
              color: "white",
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
            {/* Common fields */}
            <FormField
              label="Name"
              value={formValues.name}
              onChange={(v) => handleFormChange("name", v)}
            />
            <FormField
              label="Brand"
              value={formValues.brand}
              onChange={(v) => handleFormChange("brand", v)}
            />
            <FormField
              label="Category"
              value={formValues.category}
              onChange={(v) => handleFormChange("category", v)}
            />
            <FormField
              label="Price"
              type="number"
              value={formValues.price}
              onChange={(v) => handleFormChange("price", v)}
            />
            <FormField
              label="Image URL"
              value={formValues.image}
              onChange={(v) => handleFormChange("image", v)}
            />
            <FormField
              label="Description"
              value={formValues.description}
              onChange={(v) => handleFormChange("description", v)}
            />

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={formValues.inStock}
                onChange={(e) =>
                  handleFormChange("inStock", e.target.checked)
                }
              />
              <span style={{ fontSize: "14px", color: "white" }}>
                In stock
              </span>
            </div>

            {/* Domain-specific extras */}
            {isClothing && (
              <FormField
                label="Sizes (comma-separated)"
                value={formValues.sizes}
                onChange={(v) => handleFormChange("sizes", v)}
              />
            )}

            {isGrocery && (
              <FormField
                label="Weights (comma-separated)"
                value={formValues.weights}
                onChange={(v) => handleFormChange("weights", v)}
              />
            )}

            {isSkincare && (
              <FormField
                label="Skin types (comma-separated)"
                value={formValues.skinTypes}
                onChange={(v) => handleFormChange("skinTypes", v)}
              />
            )}

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "8px",
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
              <button type="submit" style={primaryButtonStyle}>
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
          gap: "14px",
          marginBottom: "22px",
        }}
      >
        <StatCard label="Total products" value={String(products.length)} />
        <StatCard
          label="In stock"
          value={String(products.filter((p) => p.inStock).length)}
        />
        <StatCard
          label="Out of stock"
          value={String(products.filter((p) => !p.inStock).length)}
        />
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "16px",
              color: "white",
            }}
          >
            Product inventory
          </h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(255,255,255,0.04)" }}>
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

              {products.map((product) => (
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
                        src={product.image}
                        alt={product.name}
                        style={{
                          width: "60px",
                          height: "72px",
                          borderRadius: "14px",
                          objectFit: "cover",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      />

                      <div>
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "white",
                            marginBottom: "4px",
                          }}
                        >
                          {product.name}
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            color: "rgba(255,255,255,0.55)",
                          }}
                        >
                          {product.brand}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={tdStyle}>₹{product.price}</td>
                  <td style={tdStyle}>{product.category}</td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "7px 10px",
                        borderRadius: "999px",
                        background: product.inStock
                          ? "rgba(34,197,94,0.14)"
                          : "rgba(248,113,113,0.14)",
                        color: product.inStock ? "#4ade80" : "#f87171",
                        fontWeight: 700,
                        fontSize: "13px",
                      }}
                    >
                      {product.inStock ? "In stock" : "Out of stock"}
                    </span>
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
              ))}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) => (
  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
    <span
      style={{
        fontSize: "13px",
        color: "rgba(255,255,255,0.7)",
      }}
    >
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "8px 10px",
        borderRadius: "8px",
        border: "1px solid rgba(148,163,184,0.6)",
        background: "rgba(15,23,42,0.9)",
        color: "white",
        fontSize: "14px",
      }}
    />
  </label>
);

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      padding: "16px 18px",
      borderRadius: "18px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <p
      style={{
        margin: "0 0 8px",
        fontSize: "13px",
        color: "rgba(255,255,255,0.55)",
      }}
    >
      {label}
    </p>

    <h3
      style={{
        margin: 0,
        fontSize: "24px",
        color: "white",
      }}
    >
      {value}
    </h3>
  </div>
);

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "15px 18px",
  fontSize: "12px",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.52)",
};

const tdStyle: React.CSSProperties = {
  padding: "16px 18px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  fontSize: "14px",
  color: "rgba(255,255,255,0.88)",
  verticalAlign: "middle",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(59,130,246,0.3)",
  background: "#2563eb",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(239,68,68,0.2)",
  background: "rgba(239,68,68,0.12)",
  color: "#fca5a5",
  fontWeight: 600,
  cursor: "pointer",
};

export default AdminProducts;