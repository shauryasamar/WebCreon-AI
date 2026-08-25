import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { resolveAvatarUrl } from "./UserAvatar";
import { GlassToast } from "./GlassToast";

// Predefined avatar presets for quick selection (Yellow Circle 3D Avatars)
export const AVATAR_PRESETS = [
  {
    id: "female-young",
    label: "Young Female",
    gender: "Female",
    url: "/user_avatar_women_yellow.png",
  },
  {
    id: "male-young",
    label: "Young Male",
    gender: "Male",
    url: "/user_avatar_yellow.png",
  },
  {
    id: "female-30s",
    label: "Female 30s",
    gender: "Female",
    url: "/user_avatar_female_30s_yellow.png",
  },
  {
    id: "male-30s",
    label: "Male 30s",
    gender: "Male",
    url: "/user_avatar_male_30s_yellow.png",
  },
  {
    id: "female-senior",
    label: "Senior Female",
    gender: "Female",
    url: "/user_avatar_female_senior_yellow.png",
  },
  {
    id: "male-senior",
    label: "Senior Male",
    gender: "Male",
    url: "/user_avatar_male_senior_yellow.png",
  },
];

export function getDefaultAvatarForGender(gender?: string | null): string {
  const g = (gender || "").toLowerCase();
  if (g === "female") {
    return "/user_avatar_women_yellow.png";
  }
  return "/user_avatar_yellow.png";
}

export default function AdminProfileSettings() {
  const { admin, refreshAdmin } = useAdminAuth();

  const [name, setName] = useState(admin?.name || "");
  const [phone, setPhone] = useState(admin?.phone || "");
  const [gender, setGender] = useState(admin?.gender || "Male");
  const [role, setRole] = useState(admin?.role || "super_admin");
  const [timezone, setTimezone] = useState(admin?.timezone || "Asia/Kolkata");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(
    (localStorage.getItem("app_theme_mode") as "light" | "dark" | "system") || "light"
  );
  const [avatarUrl, setAvatarUrl] = useState(
    admin?.avatarUrl || getDefaultAvatarForGender(admin?.gender || "Male")
  );

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if admin context loads/changes
  useEffect(() => {
    if (admin) {
      setName(admin.name || "");
      setPhone(admin.phone || "");
      setGender(admin.gender || "Male");
      setRole(admin.role || "super_admin");
      setTimezone(admin.timezone || "Asia/Kolkata");
      setAvatarUrl(admin.avatarUrl || getDefaultAvatarForGender(admin.gender));
    }
  }, [admin]);

  // Save theme mode to localStorage
  const handleThemeChange = (mode: "light" | "dark" | "system") => {
    setThemeMode(mode);
    localStorage.setItem("app_theme_mode", mode);
  };

  // When gender changes, update avatar if currently using preset
  const handleGenderChange = (newGender: string) => {
    setGender(newGender);
    const isPresetOrLegacy =
      AVATAR_PRESETS.some((p) => p.url === avatarUrl) ||
      !avatarUrl ||
      avatarUrl.startsWith("/user_avatar");

    const activePreset = AVATAR_PRESETS.find((p) => p.url === avatarUrl);
    if (isPresetOrLegacy && newGender !== "Other") {
      if (!activePreset || activePreset.gender !== newGender) {
        setAvatarUrl(getDefaultAvatarForGender(newGender));
      }
    }
  };

  const isDirty =
    name.trim() !== (admin?.name || "").trim() ||
    phone.trim() !== (admin?.phone || "").trim() ||
    gender !== (admin?.gender || "Male") ||
    role !== (admin?.role || "super_admin") ||
    timezone !== (admin?.timezone || "Asia/Kolkata") ||
    avatarUrl !== (admin?.avatarUrl || getDefaultAvatarForGender(admin?.gender));

  const visiblePresets = AVATAR_PRESETS.filter((preset) => {
    if (gender === "Male") return preset.gender === "Male";
    if (gender === "Female") return preset.gender === "Female";
    return true;
  });

  // Custom photo upload handler
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setToast(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/avatar`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to upload avatar image");
      }

      const data = await response.json();
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        setToast({ message: "Profile photo updated successfully!", type: "success" });
        setIsAvatarModalOpen(false);
        await refreshAdmin();
      }
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      setToast({ message: err.message || "Failed to upload avatar photo.", type: "error" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save full profile handler
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          gender,
          phone: phone.trim(),
          avatar_url: avatarUrl,
          role,
          timezone,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update profile settings");
      }

      await refreshAdmin();
      setToast({ message: "Profile settings saved successfully!", type: "success" });
    } catch (err: any) {
      console.error("Update profile error:", err);
      setToast({ message: err.message || "Unable to save profile changes.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: 0,
        color: "#0f172a",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* TOAST NOTIFICATIONS */}
      {toast && (
        <GlassToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* MAIN PROFILE CARD */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* HEADER ROW: AVATAR + NAME + THEME TOGGLE */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            {/* Clickable Profile Picture */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                onClick={() => setIsAvatarModalOpen(true)}
                title="Click to change avatar or upload photo"
                style={{
                  position: "relative",
                  cursor: "pointer",
                  borderRadius: "50%",
                  transition: "transform 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <img
                  src={resolveAvatarUrl(avatarUrl || getDefaultAvatarForGender(gender))}
                  alt="Admin Avatar"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = getDefaultAvatarForGender(gender);
                  }}
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #e2e8f0",
                    background: "#f8fafc",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  }}
                />
                {/* Camera Overlay Icon */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "0",
                    right: "0",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#2563eb",
                    border: "2px solid #ffffff",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </div>

              {/* Name & Email */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    {name || admin?.name || "Admin Account"}
                  </h3>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    {role === "super_admin" ? "Super Admin" : role === "store_owner" ? "Store Owner" : role}
                  </span>
                </div>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  {admin?.email || "admin@webcreon.ai"}
                </p>
              </div>
            </div>

            {/* TINY ICON THEME SEGMENTED SLIDER (Matching Image Style) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Theme
              </span>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "#f1f5f9",
                  padding: "3px",
                  borderRadius: "20px",
                  border: "1px solid #e2e8f0",
                  gap: "2px",
                }}
              >
                {/* Light Mode Sun Icon */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("light")}
                  title="Light Mode"
                  style={{
                    width: "28px",
                    height: "24px",
                    borderRadius: "14px",
                    border: "none",
                    background: themeMode === "light" ? "#ffffff" : "transparent",
                    color: themeMode === "light" ? "#2563eb" : "#64748b",
                    boxShadow: themeMode === "light" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </button>

                {/* Dark Mode Moon Icon */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("dark")}
                  title="Dark Mode"
                  style={{
                    width: "28px",
                    height: "24px",
                    borderRadius: "14px",
                    border: "none",
                    background: themeMode === "dark" ? "#ffffff" : "transparent",
                    color: themeMode === "dark" ? "#2563eb" : "#64748b",
                    boxShadow: themeMode === "dark" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                </button>

                {/* System Mode Monitor Icon */}
                <button
                  type="button"
                  onClick={() => handleThemeChange("system")}
                  title="System Theme"
                  style={{
                    width: "28px",
                    height: "24px",
                    borderRadius: "14px",
                    border: "none",
                    background: themeMode === "system" ? "#ffffff" : "transparent",
                    color: themeMode === "system" ? "#2563eb" : "#64748b",
                    boxShadow: themeMode === "system" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: 0 }} />

          {/* FORM FIELDS SECTION */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            {/* Full Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shaurya Samar"
                style={{
                  height: "38px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  background: "#ffffff",
                  color: "#0f172a",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
              />
            </div>

            {/* Phone Number */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                style={{
                  height: "38px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  background: "#ffffff",
                  color: "#0f172a",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
              />
            </div>

            {/* Gender Toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                Gender
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  background: "#f8fafc",
                  padding: "3px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                {["Male", "Female", "Other"].map((gOption) => {
                  const isSelected = gender === gOption;
                  return (
                    <button
                      key={gOption}
                      type="button"
                      onClick={() => handleGenderChange(gOption)}
                      style={{
                        flex: 1,
                        height: "32px",
                        borderRadius: "6px",
                        border: isSelected ? "1px solid #cbd5e1" : "1px solid transparent",
                        background: isSelected ? "#ffffff" : "transparent",
                        color: isSelected ? "#0f172a" : "#64748b",
                        fontSize: "12px",
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                        boxShadow: isSelected ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {gOption === "Female" ? "♀ Female" : gOption === "Male" ? "♂ Male" : "Other"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Admin Role */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                Admin Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  height: "38px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  background: "#ffffff",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                <option value="super_admin">Super Admin</option>
                <option value="store_owner">Store Owner</option>
                <option value="manager">E-Commerce Manager</option>
              </select>
            </div>
          </div>

          {/* Timezone */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{
                height: "38px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                outline: "none",
                background: "#ffffff",
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
              <option value="America/New_York">America/New_York (EST - UTC-5:00)</option>
              <option value="Europe/London">Europe/London (GMT - UTC+0:00)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST - UTC+9:00)</option>
              <option value="Australia/Sydney">Australia/Sydney (AEST - UTC+10:00)</option>
            </select>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: 0 }} />

          {/* FOOTER ROW: AUTH STATUS & SAVE */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>
                Auth Provider:
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "6px",
                  background: admin?.authProvider === "google" ? "#eff6ff" : "#f1f5f9",
                  color: admin?.authProvider === "google" ? "#2563eb" : "#475569",
                  border: admin?.authProvider === "google" ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                }}
              >
                {admin?.authProvider === "google" ? "Google Account" : "Local Password"}
              </span>
            </div>

            {/* Dynamic Save Button */}
            <button
              type="submit"
              disabled={saving}
              style={{
                height: "38px",
                padding: "0 24px",
                borderRadius: "8px",
                border: "none",
                background: isDirty ? "#2563eb" : "#0f172a",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: isDirty
                  ? "0 2px 8px rgba(37, 99, 235, 0.3)"
                  : "0 1px 3px rgba(15, 23, 42, 0.15)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = isDirty ? "#1d4ed8" : "#1e293b";
                }
              }}
              onMouseLeave={(e) => {
                if (!saving) {
                  e.currentTarget.style.background = isDirty ? "#2563eb" : "#0f172a";
                }
              }}
            >
              {saving ? "Saving Changes..." : "Save Profile"}
            </button>
          </div>
        </div>
      </form>

      {/* AVATAR PICKER MODAL (HIDDEN BY DEFAULT) */}
      {isAvatarModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(3px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setIsAvatarModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              padding: "20px 22px",
              boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  Choose Profile Picture
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  Select a 3D avatar character or upload a custom image
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Avatar Grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                  3D Avatars ({gender})
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  + Upload Custom Photo
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                }}
              >
                {visiblePresets.map((preset) => {
                  const isSelected = avatarUrl === preset.url;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setAvatarUrl(preset.url);
                        setIsAvatarModalOpen(false);
                      }}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "12px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: isSelected ? "#eff6ff" : "#f8fafc",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = "#cbd5e1";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = "#e2e8f0";
                      }}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        style={{
                          width: "56px",
                          height: "56px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          background: "#ffffff",
                          border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                          boxShadow: isSelected ? "0 2px 8px rgba(37, 99, 235, 0.25)" : "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hidden Input File Reference */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />

            {/* Modal Footer Close */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
