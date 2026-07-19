import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";

const AdminLayout = () => {
  const { siteId } = useParams();
  const location = useLocation();

  const pageTitle = location.pathname.includes("/orders")
    ? "Orders"
    : "Products";

  return (
    <div
      style={{
        minHeight: "calc(100vh - 60px)",
        display: "grid",
        gridTemplateColumns: "280px minmax(0, 1fr)",
        background: "#07101d",
      }}
    >
      <AdminSidebar />

      <main
        style={{
          minWidth: 0,
          background:
            "linear-gradient(180deg, rgba(10,18,33,0.96) 0%, rgba(7,16,29,1) 100%)",
        }}
      >
        <div
          style={{
            padding: "22px 28px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            position: "sticky",
            top: 0,
            zIndex: 20,
            backdropFilter: "blur(10px)",
            background: "rgba(7,16,29,0.86)",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.48)",
              }}
            >
              Admin Panel
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                lineHeight: 1.1,
                color: "white",
                letterSpacing: "-0.02em",
              }}
            >
              {pageTitle}
            </h1>
          </div>

          <Link
            to={`/builder/${siteId}`}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            ← Back to website
          </Link>
        </div>

        <div style={{ padding: "28px" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;