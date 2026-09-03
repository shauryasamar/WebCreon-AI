import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import {
  cleanSiteName,
  getAccessibleAccentColor,
  getContrastTextColor,
  getLuminance,
  usePublicSiteTheme,
} from "../hooks/usePublicSiteTheme";

interface CustomerProfilePageProps {
  siteId?: string;
  siteSlug?: string;
  theme?: Record<string, any>;
  props?: Record<string, any>;
  max_width?: number | string;
  card_radius?: number | string;
  card_padding?: number | string;
  input_radius?: number | string;
  button_radius?: number | string;
  card_bg?: string;
  border_color?: string;
  title_color?: string;
  subtext_color?: string;
  input_bg?: string;
  input_border?: string;
  input_text_color?: string;
  button_bg_color?: string;
  button_text_color?: string;
  sign_out_color?: string;
  title?: string;
  subtitle?: string;
  save_button_label?: string;
  sign_out_label?: string;
  change_password_label?: string;
  show_phone?: boolean;
  show_gender?: boolean;
  show_dob?: boolean;
  show_password_section?: boolean;
  editMode?: boolean;
  [key: string]: any;
}

const SAMPLE_PREVIEW_USER = {
  name: "Jane Cooper",
  email: "jane.cooper@example.com",
  phone: "+91 98765 43210",
  gender: "Female",
  dateOfBirth: "1995-06-15",
  avatarUrl: "",
  hasPassword: true,
  authProvider: "email",
};

export default function CustomerProfilePage({
  siteId: propSiteId,
  siteSlug: propSiteSlug,
  theme: propTheme,
  ...restProps
}: CustomerProfilePageProps) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const activeSlug = propSiteSlug || routeSlug || "";
  const navigate = useNavigate();

  const customProps = useMemo(() => ({
    ...(propTheme || {}),
    ...(restProps.props || {}),
    ...restProps,
  }), [propTheme, restProps]);

  const isInsideEditor =
    Boolean(restProps.editMode) ||
    (typeof window !== "undefined" && window.location.pathname.startsWith("/builder/"));

  const { user: realUser, isAuthenticated, loading: authLoading, refreshMe, updateProfile, changePassword, logout } =
    useCustomerAuth();
  const { siteData } = usePublicSiteTheme(activeSlug);

  const user = (!realUser && isInsideEditor) ? SAMPLE_PREVIEW_USER : realUser;

  // Form State
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [dob, setDob] = useState(user?.dateOfBirth || "");

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Change Password Modal/Accordion State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState("");
  const [passError, setPassError] = useState("");

  // Load user data into form
  useEffect(() => {
    if (activeSlug && !isInsideEditor) {
      refreshMe(activeSlug);
    }
  }, [activeSlug, refreshMe, isInsideEditor]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setGender(user.gender || "");
      setDob(user.dateOfBirth || "");
    }
  }, [user]);

  // Theme setup
  const isHexId = (str?: string) => Boolean(str && /^[0-9a-fA-F]{24}$/.test(str.trim()));
  const siteName =
    (customProps as any)?.siteName ||
    (customProps as any)?.site_name ||
    siteData?.siteName ||
    siteData?.navbar?.brandName ||
    (activeSlug && !isHexId(activeSlug) ? cleanSiteName("", activeSlug) : "") ||
    "Store";
  const activeTheme = propTheme || siteData?.theme || {};
  const isLight = activeTheme.mode !== "dark";

  const primaryBg = activeTheme.primary_bg || (isLight ? "#f8fafc" : "#0f172a");
  const baseCardBg = activeTheme.card_bg || activeTheme.secondary_bg || (isLight ? "#ffffff" : "#1e293b");
  const fallbackCardBg =
    baseCardBg.toLowerCase().trim() === primaryBg.toLowerCase().trim()
      ? isLight
        ? "#ffffff"
        : "#1e293b"
      : baseCardBg;

  const cardBg = customProps.card_bg || customProps.background_color || fallbackCardBg;

  const computedContrastText = getContrastTextColor(cardBg);
  const rawThemeTextColor = activeTheme.text_color;
  const isDarkCard = computedContrastText === "#ffffff";

  const fallbackTextColor =
    rawThemeTextColor && Math.abs(getLuminance(rawThemeTextColor) - getLuminance(cardBg)) > 45
      ? rawThemeTextColor
      : computedContrastText;

  const textColor = customProps.title_color || customProps.text_color || fallbackTextColor;
  const subtextColor =
    customProps.subtext_color ||
    customProps.muted_text_color ||
    (isDarkCard ? "rgba(226, 232, 240, 0.75)" : "rgba(51, 65, 85, 0.75)");

  const accentColor = customProps.button_bg_color || activeTheme.accent_color || "#2563eb";
  const accessibleAccentColor = getAccessibleAccentColor(accentColor, cardBg);
  const buttonTextColor = customProps.button_text_color || getContrastTextColor(accentColor);
  const borderColor = customProps.border_color
    ? customProps.border_color
    : isDarkCard
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(15, 23, 42, 0.12)";

  const parseDimension = (val: any, fallback: string) => {
    if (val === undefined || val === null || val === "") return fallback;
    if (typeof val === "number") return `${val}px`;
    const s = String(val).trim();
    return s.endsWith("px") || s.endsWith("%") || s.endsWith("rem") ? s : `${s}px`;
  };

  const cardBorder = `1px solid ${borderColor}`;
  const cardRadius = parseDimension(customProps.card_radius, "16px");
  const cardPadding = parseDimension(customProps.card_padding, "32px");
  const inputRadius = parseDimension(customProps.input_radius, "10px");
  const buttonRadius = parseDimension(customProps.button_radius, "10px");

  const inputBg = customProps.input_bg || (isDarkCard ? "#0a0f1d" : "#ffffff");
  const inputTextColor = customProps.input_text_color || (isDarkCard ? "#f8fafc" : "#0f172a");
  const inputBorder = customProps.input_border
    ? `1px solid ${customProps.input_border}`
    : isDarkCard
    ? "rgba(255, 255, 255, 0.16)"
    : "rgba(15, 23, 42, 0.16)";

  const resolvedMaxWidth = useMemo(() => {
    const raw = customProps.max_width;
    if (!raw) return "1180px";
    if (raw === "100%" || raw === "full") return "100%";
    if (typeof raw === "number") return `${raw}px`;
    return String(raw);
  }, [customProps.max_width]);

  const showPhone = customProps.show_phone !== false;
  const showGender = customProps.show_gender !== false;
  const showDob = customProps.show_dob !== false;
  const showPasswordSectionToggle = customProps.show_password_section !== false;
  const signOutColor = customProps.sign_out_color || "#ef4444";

  const initials = useMemo(() => {
    if (!name.trim()) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }, [name]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!name.trim()) {
      setProfileError("Name cannot be empty.");
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(activeSlug, {
        name: name.trim(),
        phone: phone.trim(),
        gender: gender.trim(),
        date_of_birth: dob.trim(),
      });
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err: any) {
      setProfileError(err?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (user?.hasPassword && !currentPassword.trim()) {
      setPassError("Please enter your current password.");
      return;
    }
    if (!newPassword.trim() || newPassword.length < 6) {
      setPassError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("New passwords do not match.");
      return;
    }

    setChangingPass(true);
    try {
      await changePassword(activeSlug, {
        current_password: currentPassword.trim() || undefined,
        new_password: newPassword.trim(),
      });
      setPassSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPassSuccess("");
        setShowPasswordSection(false);
      }, 2000);
    } catch (err: any) {
      setPassError(err?.message || "Failed to update password.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate(`/store/${activeSlug}/login`, { replace: true });
  };

  // If not logged in and not loading, display a clean sign-in invitation card
  if (!authLoading && !isAuthenticated && !user) {
    return (
      <div
        style={{
          minHeight: "75vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
          background: isLight ? primaryBg : "transparent",
          color: textColor,
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            background: cardBg,
            borderRadius: "20px",
            padding: "36px 28px",
            textAlign: "center",
            border: `1px solid ${borderColor}`,
            boxShadow: isLight
              ? "0 16px 40px rgba(15, 23, 42, 0.08)"
              : "0 20px 48px rgba(0, 0, 0, 0.40)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: `${accentColor}18`,
              color: accentColor,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: 800 }}>Account Profile</h2>
          <p style={{ margin: "0 0 24px 0", color: subtextColor, fontSize: "14px", lineHeight: 1.5 }}>
            Please sign in to view and manage your account details, shipping addresses, and order history.
          </p>
          <Link
            to={`/store/${activeSlug}/login`}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              borderRadius: "10px",
              background: accentColor,
              color: buttonTextColor,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            Sign In to Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 140px)",
        background: isLight ? primaryBg : "transparent",
        color: textColor,
        padding: "24px 16px 48px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: resolvedMaxWidth,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* EXACT SAME BREADCRUMB & HEADER STRUCTURE AS ORDERS PAGE */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "4px",
          }}
        >
          {/* Breadcrumb back-link */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: subtextColor,
              fontWeight: 500,
            }}
          >
            <span
              onClick={() => {
                const path = window.location.pathname;
                if (path.startsWith("/builder/")) {
                  const segments = path.split("/").filter(Boolean);
                  const currentSiteId = segments[1] || propSiteId;
                  navigate(`/builder/${currentSiteId}`);
                } else if (activeSlug) {
                  navigate(`/store/${activeSlug}`);
                } else if (propSiteId) {
                  navigate(`/builder/${propSiteId}`);
                } else {
                  navigate("/");
                }
              }}
              style={{
                cursor: "pointer",
                transition: "color 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                color: subtextColor,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
              onMouseLeave={(e) => (e.currentTarget.style.color = subtextColor)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Store</span>
            </span>
            <span>/</span>
            <span style={{ color: textColor, fontWeight: 700 }}>Profile</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: buttonRadius,
              background: "transparent",
              color: signOutColor,
              border: `1px solid ${signOutColor}40`,
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>{customProps.sign_out_label || "Sign Out"}</span>
          </button>
        </div>

        {/* WIDE MAIN PROFILE CARD */}
        <div
          style={{
            background: cardBg,
            borderRadius: cardRadius,
            padding: cardPadding,
            border: cardBorder,
            boxShadow: isLight
              ? "0 2px 10px rgba(15,23,42,0.03)"
              : "0 8px 24px rgba(2,6,23,0.20)",
          }}
        >
          {/* USER AVATAR & HEADER */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              paddingBottom: "24px",
              borderBottom: `1px solid ${borderColor}`,
              marginBottom: "24px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "18px",
                overflow: "hidden",
                background: user?.avatarUrl
                  ? "transparent"
                  : `linear-gradient(135deg, ${accentColor}, #7c3aed)`,
                display: "grid",
                placeItems: "center",
                fontSize: "22px",
                fontWeight: 800,
                color: "#ffffff",
                flexShrink: 0,
                boxShadow: `0 4px 16px ${accentColor}30`,
              }}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || "Customer Avatar"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials
              )}
            </div>

            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: textColor }}>
                  {customProps.title || user?.name || "Customer Profile"}
                </h1>
                {(user as any)?.authProvider === "google" && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: "rgba(66, 133, 244, 0.12)",
                      color: "#4285f4",
                      border: "1px solid rgba(66, 133, 244, 0.25)",
                    }}
                  >
                    Google Account
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0 0", color: subtextColor, fontSize: "14px" }}>
                {customProps.subtitle || user?.email || "Manage your account details and password."}
              </p>
            </div>
          </div>

          {/* STATUS NOTICES */}
          {profileSuccess && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(34, 197, 94, 0.12)",
                color: "#16a34a",
                fontSize: "13.5px",
                fontWeight: 600,
                marginBottom: "20px",
              }}
            >
              ✓ {profileSuccess}
            </div>
          )}

          {profileError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                fontSize: "13.5px",
                fontWeight: 600,
                marginBottom: "20px",
              }}
            >
              ✕ {profileError}
            </div>
          )}

          {/* PROFILE EDIT FORM - WIDE 2/3 COLUMN GRID */}
          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
              {/* FULL NAME */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: textColor,
                  }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  style={{
                    width: "100%",
                    height: "44px",
                    boxSizing: "border-box",
                    padding: "0 14px",
                    borderRadius: inputRadius,
                    border: inputBorder,
                    background: inputBg,
                    color: inputTextColor,
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              {/* EMAIL (READ-ONLY) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: textColor }}>
                    Email Address
                  </label>
                  <span style={{ fontSize: "11.5px", color: subtextColor, fontWeight: 500 }}>
                    Verified
                  </span>
                </div>
                <input
                  type="email"
                  disabled
                  value={email}
                  style={{
                    width: "100%",
                    height: "44px",
                    boxSizing: "border-box",
                    padding: "0 14px",
                    borderRadius: inputRadius,
                    border: `1px solid ${borderColor}`,
                    background: isDarkCard ? "rgba(255,255,255,0.03)" : "#f1f5f9",
                    color: subtextColor,
                    fontSize: "14px",
                    cursor: "not-allowed",
                  }}
                />
              </div>

              {/* PHONE NUMBER */}
              {showPhone && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                    }}
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      width: "100%",
                      height: "44px",
                      boxSizing: "border-box",
                      padding: "0 14px",
                      borderRadius: inputRadius,
                      border: inputBorder,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              {/* GENDER */}
              {showGender && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                    }}
                  >
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{
                      width: "100%",
                      height: "44px",
                      boxSizing: "border-box",
                      padding: "0 14px",
                      borderRadius: inputRadius,
                      border: inputBorder,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "14px",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              )}

              {/* DATE OF BIRTH */}
              {showDob && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                    }}
                  >
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    style={{
                      width: "100%",
                      height: "44px",
                      boxSizing: "border-box",
                      padding: "0 14px",
                      borderRadius: inputRadius,
                      border: inputBorder,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
                paddingTop: "16px",
                borderTop: `1px solid ${borderColor}`,
                marginTop: "12px",
              }}
            >
              {/* CLICKABLE CHANGE PASSWORD BUTTON (DOES NOT CLUTTER PAGE) */}
              {showPasswordSectionToggle && (
                <button
                  type="button"
                  onClick={() => {
                    setPassError("");
                    setPassSuccess("");
                    setShowPasswordSection(!showPasswordSection);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: "13.5px",
                    fontWeight: 700,
                    color: accessibleAccentColor,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>{showPasswordSection ? "Hide Password Settings" : (customProps.change_password_label || "Change Password")}</span>
                </button>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                style={{
                  height: "44px",
                  padding: "0 28px",
                  borderRadius: buttonRadius,
                  border: "none",
                  background: accentColor,
                  color: buttonTextColor,
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: savingProfile ? "not-allowed" : "pointer",
                  opacity: savingProfile ? 0.75 : 1,
                  boxShadow: `0 4px 14px ${accentColor}35`,
                  transition: "all 0.15s ease",
                  marginLeft: showPasswordSectionToggle ? undefined : "auto",
                }}
              >
                {savingProfile ? "Saving Changes..." : (customProps.save_button_label || "Save Profile Details")}
              </button>
            </div>
          </form>
        </div>

        {/* EXPANDABLE CHANGE PASSWORD SECTION (APPEARS ONLY ON CLICK) */}
        {showPasswordSectionToggle && showPasswordSection && (
          <div
            style={{
              background: cardBg,
              borderRadius: cardRadius,
              padding: cardPadding,
              border: cardBorder,
              boxShadow: isLight
                ? "0 2px 10px rgba(15,23,42,0.03)"
                : "0 8px 24px rgba(2,6,23,0.20)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: textColor }}>
                  Change Account Password
                </h3>
                <p style={{ margin: "4px 0 0 0", color: subtextColor, fontSize: "13px" }}>
                  {user?.hasPassword
                    ? "Enter your current password to set a new one."
                    : "Set a password to enable email & password sign-in for your account."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordSection(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  color: subtextColor,
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            {passSuccess && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(34, 197, 94, 0.12)",
                  color: "#16a34a",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "16px",
                }}
              >
                ✓ {passSuccess}
              </div>
            )}

            {passError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#ef4444",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "16px",
                }}
              >
                ✕ {passError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* CURRENT PASSWORD (ONLY IF ACCOUNT HAS A PASSWORD) */}
              {user?.hasPassword && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                    }}
                  >
                    Current Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      style={{
                        width: "100%",
                        height: "42px",
                        boxSizing: "border-box",
                        padding: "0 46px 0 14px",
                        borderRadius: inputRadius,
                        border: inputBorder,
                        background: inputBg,
                        color: inputTextColor,
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: subtextColor,
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {showCurrentPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {/* NEW PASSWORD */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                    }}
                  >
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showNewPass ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      style={{
                        width: "100%",
                        height: "42px",
                        boxSizing: "border-box",
                        padding: "0 46px 0 14px",
                        borderRadius: inputRadius,
                        border: inputBorder,
                        background: inputBg,
                        color: inputTextColor,
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: subtextColor,
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {showNewPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* CONFIRM NEW PASSWORD */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: textColor,
                    }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    style={{
                      width: "100%",
                      height: "42px",
                      boxSizing: "border-box",
                      padding: "0 14px",
                      borderRadius: inputRadius,
                      border: inputBorder,
                      background: inputBg,
                      color: inputTextColor,
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(false)}
                  style={{
                    height: "40px",
                    padding: "0 18px",
                    borderRadius: buttonRadius,
                    border: `1px solid ${borderColor}`,
                    background: "transparent",
                    color: textColor,
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPass}
                  style={{
                    height: "40px",
                    padding: "0 22px",
                    borderRadius: buttonRadius,
                    border: "none",
                    background: accentColor,
                    color: buttonTextColor,
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: changingPass ? "not-allowed" : "pointer",
                    opacity: changingPass ? 0.75 : 1,
                  }}
                >
                  {changingPass ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
