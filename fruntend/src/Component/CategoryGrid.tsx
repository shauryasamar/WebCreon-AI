import { useCart } from "../CartContext";

type Category = {
  name: string;
};

type CategoryGridProps = {
  title?: string;
  categories?: Category[];
};

export const CategoryGrid = ({
  title = "Shop by Category",
  categories = [],
}: CategoryGridProps) => {
  const { products } = useCart();

  // If categories not provided via block props, derive them from products
  const derivedNames = Array.from(
    new Set(
      products
        .map((p) => p.category)
        .filter((c) => c && c.trim().length > 0)
    )
  ).sort();

  const categoriesToShow =
    categories.length > 0
      ? categories
      : derivedNames.map((name) => ({ name }));

  return (
    <section style={{ padding: "1rem" }}>
      <h3 style={{ marginBottom: "1rem" }}>{title}</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {categoriesToShow.map((category, index) => (
          <div
            key={`${category.name}-${index}`}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              padding: "1rem",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "16px" }}>{category.name}</h4>
          </div>
        ))}

        {categoriesToShow.length === 0 && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              opacity: 0.8,
            }}
          >
            No categories available.
          </div>
        )}
      </div>
    </section>
  );
};