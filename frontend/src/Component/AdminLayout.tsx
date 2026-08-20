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
      }}
    >
      <Outlet />
    </div>
  );
};


export default AdminLayout;
