import { Outlet } from "react-router-dom";


/**
 * The dedicated admin sidebar is no longer used — Products / Orders /
 * Checkout Charges are now opened from the "Store Control" drawer in the
 * main builder shell. This layout is intentionally minimal: no header, no
 * sticky bar, no sidebar — just the plain white panel for whichever admin
 * page is active.
 */
const AdminLayout = () => {
  return (
    <div
      style={{
        minHeight: "100%",
        background: "#ffffff",
        padding: "24px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <style>{`
        /* Enforce Inter font uniformly across all admin views, controls, cards, tabs, and modals */
        .admin-page-root,
        .admin-page-root input,
        .admin-page-root button,
        .admin-page-root select,
        .admin-page-root textarea,
        .admin-page-root table,
        .admin-page-root th,
        .admin-page-root td,
        .admin-page-root h1,
        .admin-page-root h2,
        .admin-page-root h3,
        .admin-page-root div,
        .admin-page-root span {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        }
      `}</style>
      <div className="admin-page-root" style={{ width: "100%", height: "100%" }}>
        <Outlet />
      </div>
    </div>
  );
};


export default AdminLayout;
