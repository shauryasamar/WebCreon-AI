import { NavLink, useParams } from "react-router-dom";

const linkBaseStyle: React.CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: "12px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "14px",
  transition: "all 0.18s ease",
};

const AdminSidebar = () => {
  const { siteId } = useParams();

  const links = [
    {
      label: "Products",
      to: `/builder/${siteId}/admin/products`,
    },
    {
      label: "Orders",
      to: `/builder/${siteId}/admin/orders`,
    },
    {
      label: "Earnings & Ledger",
      to: `/builder/${siteId}/admin/earnings`,
    },
    {
      label: "Payout Settings",
      to: `/builder/${siteId}/admin/payment-settings`,
    },
    {
      label: "Checkout Charges",
      to: `/builder/${siteId}/admin/checkout-charges`,
    },
  ];

  return (
    <aside
      style={{
        width: "260px",
        minHeight: "100vh",
        padding: "24px 18px",
        background: "#0b1220",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        color: "white",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Admin
        </p>

        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            lineHeight: 1.2,
          }}
        >
          Store Control
        </h2>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              ...linkBaseStyle,
              background: isActive ? "#2563eb" : "rgba(255,255,255,0.04)",
              color: "white",
              border: isActive
                ? "1px solid rgba(37,99,235,0.55)"
                : "1px solid rgba(255,255,255,0.06)",
              boxShadow: isActive ? "0 10px 24px rgba(37,99,235,0.22)" : "none",
            })}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;