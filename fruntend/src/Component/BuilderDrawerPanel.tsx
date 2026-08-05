import React from "react";


type ControlItemKey =
  | "saved-sites"
  | "chat"
  | "customize"
  | "admin-panel"
  | "assets"
  | "settings"
  | "qr-link";


type SavedSite = {
  id: string;
  slug: string;
  site_definition?: {
    site?: {
      brand_name?: string | null;
    };
  } | null;
  draft_definition?: {
    site?: {
      brand_name?: string | null;
    };
  } | null;
};


export type AdminNavKey = "products" | "orders" | "checkout-charges";


type AdminNavItem = {
  key: AdminNavKey;
  label: string;
};


const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: "products", label: "Products" },
  { key: "orders", label: "Orders" },
  { key: "checkout-charges", label: "Checkout Charges" },
];


type BuilderDrawerPanelProps = {
  activeDrawer: ControlItemKey | null;
  onClose: () => void;
  savedSites?: SavedSite[];
  selectedSiteId?: string | null;
  onSelectSite?: (siteId: string) => void;
  onDeleteSite?: (siteId: string) => void;
  activeAdminNavKey?: AdminNavKey | null;
  onSelectAdminNav?: (key: AdminNavKey) => void;
};


function titleForDrawer(key: ControlItemKey | null) {
  switch (key) {
    case "saved-sites":
      return "Saved Sites";
    case "chat":
      return "Chat Assistant";
    case "admin-panel":
      return "Store Control";
    case "assets":
      return "Assets";
    case "settings":
      return "Settings";
    default:
      return "";
  }
}


function getBrandName(site: SavedSite) {
  return (
    site.draft_definition?.site?.brand_name ||
    site.site_definition?.site?.brand_name ||
    site.slug ||
    "Website"
  );
}


function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 16, height: 16 }}
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}


/**
 * Shared card used for both Saved Sites and Store Control nav items, so the
 * two drawers look and behave the same way (plain white card, subtle
 * border, slightly darker background when selected).
 */
function PlainCard({
  label,
  isSelected,
  onClick,
  trailing,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        border: isSelected
          ? "1px solid rgba(37,99,235,0.35)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: "10px",
        padding: "12px 12px",
        background: isSelected ? "#eef2f7" : "#ffffff",
        cursor: "pointer",
        color: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: "#0f172a",
          minWidth: 0,
          flex: 1,
        }}
      >
        {label}
      </div>
      {trailing}
    </div>
  );
}


export default function BuilderDrawerPanel({
  activeDrawer,
  onClose,
  savedSites = [],
  selectedSiteId,
  onSelectSite,
  onDeleteSite,
  activeAdminNavKey,
  onSelectAdminNav,
}: BuilderDrawerPanelProps) {
  if (
    !activeDrawer ||
    activeDrawer === "customize" ||
    activeDrawer === "qr-link"
  ) {
    return null;
  }


  const title = titleForDrawer(activeDrawer);
  if (!title) return null;


  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
          color: "#111827",
          flexShrink: 0,
        }}
      >
        <span>{title}</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            color: "#6b7280",
          }}
        >
          ×
        </button>
      </div>


      <div
        style={{
          padding:
            activeDrawer === "saved-sites" || activeDrawer === "admin-panel"
              ? "12px"
              : "10px 12px",
          fontSize: 12,
          color: "#4b5563",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        }}
      >
        {activeDrawer === "saved-sites" ? (
          savedSites.length === 0 ? (
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid rgba(15,23,42,0.08)",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              No saved sites found.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {savedSites.map((site) => {
                const brandName = getBrandName(site);
                const isSelected = selectedSiteId === site.id;


                return (
                  <PlainCard
                    key={site.id}
                    label={brandName}
                    isSelected={isSelected}
                    onClick={() => onSelectSite?.(site.id)}
                    trailing={
                      isSelected ? (
                        <button
                          type="button"
                          aria-label="Delete site"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSite?.(site.id);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <DeleteIcon />
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )
        ) : activeDrawer === "admin-panel" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ADMIN_NAV_ITEMS.map((item) => (
              <PlainCard
                key={item.key}
                label={item.label}
                isSelected={activeAdminNavKey === item.key}
                onClick={() => onSelectAdminNav?.(item.key)}
              />
            ))}
          </div>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Drawer content for <strong>{title}</strong> will go here.
            </p>
            <p style={{ marginTop: 8 }}>
              Later you can add lists, controls, or forms specific to this section.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
