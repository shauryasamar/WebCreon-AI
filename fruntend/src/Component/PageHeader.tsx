type PageHeaderProps = {
  title?: string;
  subtitle?: string;
};

export const PageHeader = ({ title, subtitle }: PageHeaderProps) => {
  // If neither title nor subtitle is provided, render nothing
  if (!title && !subtitle) {
    return null;
  }

  return (
    <section style={{ padding: "1rem" }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "12px",
          padding: "1rem",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {title && (
          <h2 style={{ margin: "0 0 8px", fontSize: "28px" }}>{title}</h2>
        )}
        {subtitle && (
          <p style={{ margin: 0, opacity: 0.8 }}>{subtitle}</p>
        )}
      </div>
    </section>
  );
};