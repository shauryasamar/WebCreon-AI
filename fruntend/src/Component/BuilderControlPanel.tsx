import React from "react";


type ControlItemKey =
  | "saved-sites"
  | "chat"
  | "customize"
  | "admin-panel"
  | "assets"
  | "settings"
  | "qr-link";


type BuilderControlPanelProps = {
  activeKey?: ControlItemKey | null;
  onSelect: (key: ControlItemKey) => void;
};


const ITEMS: {
  key: ControlItemKey;
  label: string;
  title: string;
  icon: React.ReactNode;
  bottom?: boolean;
}[] = [
  { key: "saved-sites", label: "Saved Sites", title: "Saved Sites", icon: <IconBookmark /> },
  { key: "chat", label: "Chat", title: "Chat", icon: <IconChat /> },
  { key: "customize", label: "Customize", title: "Customize", icon: <IconPencil /> },
  { key: "admin-panel", label: "Store Control", title: "Store Control", icon: <IconStore /> },
  { key: "assets", label: "Assets", title: "Assets", icon: <IconImage /> },
  { key: "settings", label: "Settings", title: "Settings", icon: <IconGear />, bottom: true },
  { key: "qr-link", label: "QR & Link", title: "QR & Link", icon: <IconQr />, bottom: true },
];


function IconShell({ children }: { children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}
function IconBookmark() {
  return (
    <IconShell>
      <path d="M6 4h12a2 2 0 0 1 2 2v14l-8-4-8 4V6a2 2 0 0 1 2-2Z" />
    </IconShell>
  );
}
function IconChat() {
  return (
    <IconShell>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
    </IconShell>
  );
}
function IconPencil() {
  return (
    <IconShell>
      <path d="M4 20h16" />
      <path d="m14.5 5.5 4 4-9 9H5.5v-4l9-9Z" />
      <path d="m13 7 4 4" />
    </IconShell>
  );
}
function IconStore() {
  return (
    <IconShell>
      <path d="M4 10h16" />
      <path d="M6 10v10h12V10" />
      <path d="m5 6 2-2h10l2 2" />
    </IconShell>
  );
}
function IconImage() {
  return (
    <IconShell>
      <path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
      <circle cx="9" cy="8" r="1.5" />
    </IconShell>
  );
}
function IconGear() {
  return (
    <IconShell>
      <path d="M19.14 12.94a7.99 7.99 0 0 0 .06-.94 7.99 7.99 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.98 7.98 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54a7.98 7.98 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58Z"/>
      <circle cx="12" cy="12" r="2.5" />
    </IconShell>
  );
}
function IconQr() {
  return (
    <IconShell>
      <path d="M4 4h6v6H4z" />
      <path d="M14 4h6v6h-6z" />
      <path d="M4 14h6v6H4z" />
      <path d="M14 14h3" />
      <path d="M17 14v6" />
      <path d="M20 14v6" />
    </IconShell>
  );
}


function ControlButton({
  active,
  item,
  onSelect,
}: {
  active: boolean;
  item: (typeof ITEMS)[number];
  onSelect: (key: ControlItemKey) => void;
}) {
  return (
    <button
      type="button"
      title={item.title}
      onClick={() => onSelect(item.key)}
      style={{
        width: "100%",
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          padding: "7px 0",
          color: active ? "#2563eb" : "#6b7280",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: active ? "rgba(37,99,235,0.09)" : "transparent",
            border: active
              ? "1px solid rgba(37,99,235,0.16)"
              : "1px solid transparent",
          }}
        >
          {item.icon}
        </div>
        <div
          style={{
            fontSize: 8,
            lineHeight: 1.05,
            fontWeight: 600,
            letterSpacing: "0.02em",
            textAlign: "center",
            width: 60,
            color: active ? "#1d4ed8" : "#6b7280",
            textTransform: "uppercase",
          }}
        >
          {item.label}
        </div>
      </div>
    </button>
  );
}


export default function BuilderControlPanel({
  activeKey,
  onSelect,
}: BuilderControlPanelProps) {
  const topItems = ITEMS.filter((item) => !item.bottom);
  const bottomItems = ITEMS.filter((item) => item.bottom);


  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "8px 0",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        {topItems.map((item) => (
          <ControlButton
            key={item.key}
            active={activeKey === item.key}
            item={item}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingBottom: 4,
        }}
      >
        <div
          style={{
            width: 32,
            height: 1,
            background: "rgba(15,23,42,0.12)",
            marginBottom: 4,
          }}
        />
        {bottomItems.map((item) => (
          <ControlButton
            key={item.key}
            active={activeKey === item.key}
            item={item}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
