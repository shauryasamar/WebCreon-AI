type PaginationProps = {
  currentPage?: number;
  totalPages?: number;
};

export const Pagination = ({
  currentPage = 1,
  totalPages = 3,
}: PaginationProps) => {
  return (
    <section style={{ padding: "1rem" }}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Prev
        </button>

        {Array.from({ length: totalPages }).map((_, index) => {
          const page = index + 1;
          const active = page === currentPage;

          return (
            <button
              key={page}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: active
                  ? "1px solid #2563eb"
                  : "1px solid rgba(255,255,255,0.12)",
                background: active ? "#2563eb" : "rgba(255,255,255,0.04)",
                color: "white",
                cursor: "pointer",
                fontWeight: active ? 700 : 500,
              }}
            >
              {page}
            </button>
          );
        })}

        <button
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Next
        </button>
      </div>
    </section>
  );
};