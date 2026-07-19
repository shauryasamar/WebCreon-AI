type FilterSidebarProps = {
  title?: string;
  filters?: string[];
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;
};

export const FilterSidebar = ({
  title = "Shop by Category",
  filters = [],
  selectedFilter = "All",
  onFilterChange,
}: FilterSidebarProps) => {
  const options = ["All", ...filters.filter(Boolean)];

  return (
    <section
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding: "18px 12px 10px",
        position: "sticky",
        top: "84px",
        zIndex: 20,
      }}
    >
      <div
        style={{
          border: "1px solid rgba(15,23,42,0.10)",
          borderRadius: "24px",
          padding: "14px",
          background: "rgba(248,250,252,0.78)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow:
            "0 10px 30px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #64748b, #94a3b8)",
                boxShadow: "0 0 16px rgba(100,116,139,0.28)",
                flexShrink: 0,
              }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#0f172a",
              }}
            >
              {title}
            </h3>
          </div>

          <span
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(15,23,42,0.62)",
              background: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            Smart Filter
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {options.map((filter) => {
            const active = selectedFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange?.(filter)}
                style={{
                  padding: active ? "11px 16px" : "10px 14px",
                  borderRadius: "999px",
                  border: active
                    ? "1px solid rgba(15,23,42,0.04)"
                    : "1px solid rgba(15,23,42,0.08)",
                  background: active
                    ? "linear-gradient(135deg, #0f172a, #334155)"
                    : "rgba(255,255,255,0.56)",
                  color: active ? "#ffffff" : "#334155",
                  fontSize: "13px",
                  fontWeight: active ? 800 : 700,
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  boxShadow: active
                    ? "0 10px 24px rgba(15,23,42,0.20)"
                    : "inset 0 1px 0 rgba(255,255,255,0.55)",
                  transition:
                    "transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border 180ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FilterSidebar;