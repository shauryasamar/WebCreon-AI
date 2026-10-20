import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAdminTheme } from "../context/ThemeContext";

/**
 * The dedicated admin sidebar is no longer used — Products / Orders /
 * Checkout Charges are now opened from the "Store Control" drawer in the
 * main builder shell. This layout is intentionally minimal: no header, no
 * sticky bar, no sidebar — just the plain panel for whichever admin
 * page is active.
 */
const AdminLayout = () => {
  const { tokens } = useAdminTheme();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    const scrollContainers = document.querySelectorAll<HTMLElement>(
      ".builder-preview-scroll, [class*='builder-preview'], main"
    );
    scrollContainers.forEach((el) => {
      el.scrollTop = 0;
    });
  }, [location.pathname, location.search]);

  return (
    <div
      style={{
        minHeight: "100%",
        background: tokens.surfaceBg,
        color: tokens.textPrimary,
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

        /* Modern non-boxy rounded dropdown styling for all admin views */
        .admin-page-root select {
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          border-radius: 9px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          padding-left: 12px !important;
          padding-right: 32px !important;
          cursor: pointer !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 10px center !important;
          background-size: 14px 14px !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease !important;
          outline: none !important;
        }
        .admin-page-root select:hover {
          border-color: rgba(59, 130, 246, 0.45) !important;
        }
        .admin-page-root select:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18) !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") !important;
        }
        .admin-page-root select option {
          padding: 8px 12px !important;
          font-size: 13px !important;
        }
      `}</style>
      <div className="admin-page-root" style={{ width: "100%", height: "100%" }}>
        <Outlet />
      </div>
    </div>
  );
};


export default AdminLayout;
