import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { GlassToast } from "./GlassToast";
import { AccessDeniedView } from "./AccessDeniedView";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type PermissionItem = {
  id: string;
  name: string;
  description: string;
  sensitive?: boolean;
};

export type PermissionModule = {
  module: string;
  key: string;
  permissions: PermissionItem[];
};

export type PermissionCategory = {
  category: string;
  key: string;
  modules: PermissionModule[];
};

export type RoleItem = {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  type: "Default" | "Custom";
  permissions: string[];
  permissions_count: number;
  users_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id: string | null;
  is_owner: boolean;
  is_system_role: boolean;
  status: "active" | "inactive" | "pending";
  is_active: boolean;
  website_access_type: "all" | "specific";
  website_access_display: string;
  accessible_sites: { id: string; slug: string; brand_name: string }[];
  last_active: string;
  last_login_at: string | null;
  created_at: string | null;
  inherited_permissions: string[];
  additional_permissions: string[];
  effective_permissions: string[];
  invitation_pending: boolean;
  invitation_url: string | null;
};

export type SiteOption = {
  id: string;
  slug: string;
  brand_name: string;
};

// ---------------------------------------------------------------------------
// ICONS
// ---------------------------------------------------------------------------

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const XMarkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function AdminUsersAndRoles({ siteId: propSiteId }: { siteId?: string } = {}) {
  const { admin, hasPermission, isOwner } = useAdminAuth();
  const canViewUsers = isOwner || hasPermission("users_roles:view");
  const canManageUsers = isOwner || hasPermission("users_roles:edit");
  const { siteId: routeSiteId } = useParams<{ siteId?: string }>();
  const effectiveSiteId = propSiteId || routeSiteId;

  // Primary State
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "inactive">("all");
  const [roleTypeFilter, setRoleTypeFilter] = useState<"all" | "default" | "custom">("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  // Three-dot Action Menu Popup
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Confirmation Modals
  const [deactivateModalUser, setDeactivateModalUser] = useState<TeamUser | null>(null);
  const [removeModalUser, setRemoveModalUser] = useState<TeamUser | null>(null);
  const [deleteRoleModal, setDeleteRoleModal] = useState<RoleItem | null>(null);
  const [roleAssignedWarningModal, setRoleAssignedWarningModal] = useState<{ role: RoleItem; userCount: number } | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState<string | null>(null);

  // Right-side Drawer State
  const [drawerMode, setDrawerMode] = useState<"add-user" | "edit-user" | "create-role" | "edit-role" | null>(null);
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);

  // Form State - User Drawer
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRoleId, setUserRoleId] = useState("");
  const [userWebsiteAccessType, setUserWebsiteAccessType] = useState<"all" | "specific">("all");
  const [userSelectedSiteIds, setUserSelectedSiteIds] = useState<string[]>([]);
  const [userAdditionalPerms, setUserAdditionalPerms] = useState<string[]>([]);
  const [showAdditionalPermPicker, setShowAdditionalPermPicker] = useState(false);
  const [drawerSubmitting, setDrawerSubmitting] = useState(false);

  // Form State - Role Drawer
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string>("store_control");

  // Close menus and filter popovers on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuUserId(null);
      }
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------

  const fetchData = async () => {
    try {
      setLoading(true);
      const userUrl = `${API_BASE_URL}/users-roles/users`;

      const [usersRes, rolesRes, catalogRes, sitesRes] = await Promise.all([
        fetch(userUrl, { credentials: "include" }),
        fetch(`${API_BASE_URL}/users-roles/roles`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/users-roles/permissions-catalog`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/auth/admin/sites`, { credentials: "include" }).catch(() => null),
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
      }
      if (rolesRes.ok) {
        const rData = await rolesRes.json();
        setRoles(rData.roles || []);
      }
      if (catalogRes.ok) {
        const cData = await catalogRes.json();
        setPermissionCatalog(cData.catalog || []);
      }
      if (sitesRes && sitesRes.ok) {
        const sData = await sitesRes.json();
        const mapped = (sData || []).map((s: any) => ({
          id: strId(s.id),
          slug: s.slug,
          brand_name: s.site_definition?.site?.brand_name || s.slug || "Store",
        }));
        setSites(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load users & roles data", err);
      setToast({ message: "Could not load users & roles data", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [effectiveSiteId]);

  const strId = (id: any) => (id ? String(id) : "");

  // ---------------------------------------------------------------------------
  // COMPUTED PROPERTIES
  // ---------------------------------------------------------------------------

  // Map of permissions for quick label/module lookup
  const permissionsMap = useMemo(() => {
    const map = new Map<string, { name: string; description: string; module: string; category: string; sensitive?: boolean }>();
    for (const cat of permissionCatalog) {
      for (const mod of cat.modules) {
        for (const perm of mod.permissions) {
          map.set(perm.id, {
            name: perm.name,
            description: perm.description,
            module: mod.module,
            category: cat.category,
            sensitive: perm.sensitive,
          });
        }
      }
    }
    return map;
  }, [permissionCatalog]);

  // Filter counts
  const userCounts = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active && u.status === "active").length;
    const pending = users.filter((u) => u.invitation_pending || u.status === "pending").length;
    const inactive = users.filter((u) => !u.is_active || u.status === "inactive").length;
    return { all: total, active, pending, inactive };
  }, [users]);

  const roleCounts = useMemo(() => {
    const total = roles.length;
    const system = roles.filter((r) => r.is_system).length;
    const custom = roles.filter((r) => !r.is_system).length;
    return { all: total, default: system, custom };
  }, [roles]);

  const activeUserFilterCount = useMemo(() => {
    let count = 0;
    if (roleFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [roleFilter, statusFilter]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        (u.website_access_display || "").toLowerCase().includes(q);

      const matchesRole = roleFilter === "all" || (u.role || "").toLowerCase() === roleFilter.toLowerCase();

      let matchesStatus = true;
      if (statusFilter === "active") {
        matchesStatus = Boolean(u.is_active && u.status === "active");
      } else if (statusFilter === "pending") {
        matchesStatus = Boolean(u.invitation_pending || u.status === "pending");
      } else if (statusFilter === "inactive") {
        matchesStatus = Boolean(!u.is_active || u.status === "inactive");
      }

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Filtered roles
  const filteredRoles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return roles.filter((r) => {
      const matchesSearch =
        !q ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q);

      let matchesType = true;
      if (roleTypeFilter === "default") {
        matchesType = r.is_system;
      } else if (roleTypeFilter === "custom") {
        matchesType = !r.is_system;
      }

      return matchesSearch && matchesType;
    });
  }, [roles, searchQuery, roleTypeFilter]);

  // Selected role in user drawer (for inherited permissions)
  const currentSelectedRole = useMemo(() => {
    return roles.find((r) => r.id === userRoleId) || null;
  }, [roles, userRoleId]);

  const inheritedPerms = useMemo(() => {
    return currentSelectedRole ? currentSelectedRole.permissions : [];
  }, [currentSelectedRole]);

  // ---------------------------------------------------------------------------
  // HANDLERS - USER DRAWER
  // ---------------------------------------------------------------------------

  const openAddUserDrawer = () => {
    setSelectedUser(null);
    setUserName("");
    setUserEmail("");
    // Default to Store Manager or first non-owner role
    const defaultRole = roles.find((r) => r.name === "Store Manager") || roles.find((r) => r.name !== "Owner") || roles[0];
    setUserRoleId(defaultRole ? defaultRole.id : "");
    if (effectiveSiteId) {
      setUserWebsiteAccessType("specific");
      setUserSelectedSiteIds([effectiveSiteId]);
    } else {
      setUserWebsiteAccessType("all");
      setUserSelectedSiteIds(sites.map((s) => s.id));
    }
    setUserAdditionalPerms([]);
    setShowAdditionalPermPicker(false);
    setDrawerMode("add-user");
  };

  const openEditUserDrawer = (u: TeamUser) => {
    setSelectedUser(u);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserRoleId(u.role_id || "");
    setUserWebsiteAccessType(u.website_access_type);
    setUserSelectedSiteIds(u.accessible_sites.map((s) => s.id));
    setUserAdditionalPerms([...u.additional_permissions]);
    setShowAdditionalPermPicker(false);
    setOpenMenuUserId(null);
    setDrawerMode("edit-user");
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setToast({ message: "Full name is required", type: "error" });
      return;
    }
    if (drawerMode === "add-user" && !userEmail.trim()) {
      setToast({ message: "Email address is required", type: "error" });
      return;
    }
    if (!userRoleId) {
      setToast({ message: "Please select a role", type: "error" });
      return;
    }

    setDrawerSubmitting(true);
    try {
      if (drawerMode === "add-user") {
        const payload = {
          name: userName.trim(),
          email: userEmail.trim(),
          role_id: userRoleId,
          website_access_type: userWebsiteAccessType,
          site_ids: userWebsiteAccessType === "specific"
            ? (userSelectedSiteIds.length > 0 ? userSelectedSiteIds : (effectiveSiteId ? [effectiveSiteId] : []))
            : [],
          additional_permissions: userAdditionalPerms,
        };

        const res = await fetch(`${API_BASE_URL}/users-roles/users/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to invite user");

        setUsers((prev) => [data.user, ...prev]);
        setDrawerMode(null);
        setToast({ message: data.message || `Invitation dispatched to ${userName.trim()}!`, type: "success" });

        if (data.invite_url) {
          setCopiedInviteUrl(data.invite_url);
        }
      } else if (drawerMode === "edit-user" && selectedUser) {
        const payload = {
          name: userName.trim(),
          role_id: userRoleId,
          website_access_type: userWebsiteAccessType,
          site_ids: userWebsiteAccessType === "specific" ? userSelectedSiteIds : [],
          additional_permissions: userAdditionalPerms,
        };

        const res = await fetch(`${API_BASE_URL}/users-roles/users/${selectedUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to update user");

        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? data.user : u)));
        setDrawerMode(null);
        setToast({ message: `Changes saved for ${userName.trim()}!`, type: "success" });
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to save user", type: "error" });
    } finally {
      setDrawerSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS - USER STATUS & REMOVAL
  // ---------------------------------------------------------------------------

  const handleDeactivateConfirm = async () => {
    if (!deactivateModalUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users-roles/users/${deactivateModalUser.id}/deactivate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to deactivate user");

      setUsers((prev) => prev.map((u) => (u.id === deactivateModalUser.id ? data.user : u)));
      setToast({ message: `${deactivateModalUser.name} has been deactivated.`, type: "info" });
      setDeactivateModalUser(null);
      if (drawerMode === "edit-user") setDrawerMode(null);
    } catch (err: any) {
      setToast({ message: err.message || "Unable to deactivate user", type: "error" });
    }
  };

  const handleReactivate = async (u: TeamUser) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users-roles/users/${u.id}/reactivate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reactivate user");

      setUsers((prev) => prev.map((item) => (item.id === u.id ? data.user : item)));
      setToast({ message: `${u.name} is now Active!`, type: "success" });
      setOpenMenuUserId(null);
    } catch (err: any) {
      setToast({ message: err.message || "Unable to reactivate user", type: "error" });
    }
  };

  const handleResendInvite = async (u: TeamUser) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users-roles/users/${u.id}/resend-invite`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to resend invite");

      setUsers((prev) => prev.map((item) => (item.id === u.id ? data.user : item)));
      setOpenMenuUserId(null);
      setToast({ message: `Fresh invitation created for ${u.name}!`, type: "success" });
      if (data.invite_url) {
        setCopiedInviteUrl(data.invite_url);
      }
    } catch (err: any) {
      setToast({ message: err.message || "Unable to resend invitation", type: "error" });
    }
  };

  const handleRemoveConfirm = async () => {
    if (!removeModalUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users-roles/users/${removeModalUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to remove user");

      setUsers((prev) => prev.filter((u) => u.id !== removeModalUser.id));
      setToast({ message: `${removeModalUser.name} was removed from workspace.`, type: "info" });
      setRemoveModalUser(null);
    } catch (err: any) {
      setToast({ message: err.message || "Unable to remove user", type: "error" });
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS - ROLE DRAWER
  // ---------------------------------------------------------------------------

  const openCreateRoleDrawer = () => {
    setSelectedRole(null);
    setRoleName("");
    setRoleDescription("");
    setRolePermissions([]);
    setExpandedCategoryKey("workspace");
    setDrawerMode("create-role");
  };

  const openEditRoleDrawer = (r: RoleItem) => {
    setSelectedRole(r);
    setRoleName(r.name);
    setRoleDescription(r.description || "");
    setRolePermissions([...r.permissions]);
    setExpandedCategoryKey("store_control");
    setDrawerMode("edit-role");
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setToast({ message: "Role name is required", type: "error" });
      return;
    }

    setDrawerSubmitting(true);
    try {
      if (drawerMode === "create-role") {
        const res = await fetch(`${API_BASE_URL}/users-roles/roles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: roleName.trim(),
            description: roleDescription.trim(),
            permissions: rolePermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to create role");

        setRoles((prev) => [...prev, data.role]);
        setDrawerMode(null);
        setToast({ message: `Role '${roleName.trim()}' created!`, type: "success" });
      } else if (drawerMode === "edit-role" && selectedRole) {
        const res = await fetch(`${API_BASE_URL}/users-roles/roles/${selectedRole.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: roleName.trim(),
            description: roleDescription.trim(),
            permissions: rolePermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to update role");

        setRoles((prev) => prev.map((r) => (r.id === selectedRole.id ? data.role : r)));
        // Refresh users list since users assigned this role now inherit updated permissions!
        const usersRes = await fetch(`${API_BASE_URL}/users-roles/users`, { credentials: "include" });
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsers(uData.users || []);
        }

        setDrawerMode(null);
        setToast({ message: `Role '${roleName.trim()}' updated!`, type: "success" });
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to save role", type: "error" });
    } finally {
      setDrawerSubmitting(false);
    }
  };

  const handleDeleteRoleClick = (role: RoleItem) => {
    if (role.is_system) {
      setToast({ message: "System default roles cannot be deleted", type: "error" });
      return;
    }
    if (role.users_count > 0) {
      setRoleAssignedWarningModal({ role, userCount: role.users_count });
      return;
    }
    setDeleteRoleModal(role);
  };

  const handleDeleteRoleConfirm = async () => {
    if (!deleteRoleModal) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users-roles/roles/${deleteRoleModal.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete role");

      setRoles((prev) => prev.filter((r) => r.id !== deleteRoleModal.id));
      setToast({ message: `Role '${deleteRoleModal.name}' deleted.`, type: "info" });
      setDeleteRoleModal(null);
    } catch (err: any) {
      setToast({ message: err.message || "Unable to delete role", type: "error" });
    }
  };

  // Toggle single permission in role editor
  const toggleRolePermission = (permId: string) => {
    setRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  // Toggle all permissions for an entire category
  const toggleCategoryPermissions = (cat: PermissionCategory) => {
    const catPermIds = cat.modules.flatMap((m) => m.permissions.map((p) => p.id));
    const allSelected = catPermIds.every((id) => rolePermissions.includes(id));
    if (allSelected) {
      setRolePermissions((prev) => prev.filter((id) => !catPermIds.includes(id)));
    } else {
      setRolePermissions((prev) => Array.from(new Set([...prev, ...catPermIds])));
    }
  };

  // Toggle user specific extra permission
  const addAdditionalPerm = (permId: string) => {
    if (!userAdditionalPerms.includes(permId) && !inheritedPerms.includes(permId)) {
      setUserAdditionalPerms((prev) => [...prev, permId]);
    }
  };

  const removeAdditionalPerm = (permId: string) => {
    setUserAdditionalPerms((prev) => prev.filter((p) => p !== permId));
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (!canViewUsers) {
    return <AccessDeniedView moduleName="Users & Roles" requiredPermission="users_roles:view" />;
  }

  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Toast */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* TOP HEADER CARD (Segmented Mode Pill + Search + Filters + Action Button) */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative",
        }}
      >
        {/* Row 1: Mode Switcher + Global Search + Filter Button + Add Action */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Mode Pill (Users vs Roles) - Identical to Orders/Returns */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            {(["users", "roles"] as const).map((value) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setActiveTab(value);
                    setOpenMenuUserId(null);
                    setSearchQuery("");
                  }}
                  style={{
                    borderRadius: "6px",
                    padding: "6px 16px",
                    border: "none",
                    background: isActive ? "#ffffff" : "transparent",
                    color: isActive ? "#0f172a" : "#64748b",
                    boxShadow: isActive
                      ? "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
                      : "none",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s ease",
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>

          {/* Search Bar & Filter Button Container */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: "1 1 300px",
              maxWidth: "520px",
              position: "relative",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <SearchIcon />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "users"
                    ? "Search users, emails, roles..."
                    : "Search roles by name or description..."
                }
                style={{
                  width: "100%",
                  paddingLeft: "34px",
                  paddingRight: searchQuery ? "28px" : "12px",
                  fontSize: "13px",
                  height: "36px",
                  borderRadius: "7px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: "2px",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title="Clear search"
                >
                  <XMarkIcon />
                </button>
              )}
            </div>

            {/* Filter Toggle Button (For Users tab) */}
            {activeTab === "users" && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "36px",
                    padding: "0 12px",
                    borderRadius: "7px",
                    border: activeUserFilterCount > 0 ? "1px solid #93c5fd" : "1px solid #cbd5e1",
                    background: activeUserFilterCount > 0 ? "#eff6ff" : "#ffffff",
                    color: activeUserFilterCount > 0 ? "#1d4ed8" : "#334155",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                  title="Toggle Filters"
                >
                  <FilterIcon />
                  <span>Filters</span>
                  {activeUserFilterCount > 0 && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        background: "#2563eb",
                        color: "#ffffff",
                        borderRadius: "10px",
                        padding: "0 6px",
                        marginLeft: "2px",
                      }}
                    >
                      {activeUserFilterCount}
                    </span>
                  )}
                </button>

                {/* Floating Filter Popover Modal */}
                {isFilterOpen && (
                  <div
                    ref={filterPopoverRef}
                    style={{
                      position: "absolute",
                      top: "44px",
                      right: "0",
                      width: "280px",
                      background: "#ffffff",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                      padding: "16px",
                      zIndex: 100,
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                        Role
                      </label>
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        style={{
                          width: "100%",
                          height: "34px",
                          padding: "0 8px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          background: "#ffffff",
                          outline: "none",
                        }}
                      >
                        <option value="all">All Roles</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        style={{
                          width: "100%",
                          height: "34px",
                          padding: "0 8px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          background: "#ffffff",
                          outline: "none",
                        }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="pending">Invitation Pending</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRoleFilter("all");
                          setStatusFilter("all");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#64748b",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        style={{
                          background: "#2563eb",
                          border: "none",
                          color: "#ffffff",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          padding: "5px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Active Filter Chips Bar */}
        {(roleFilter !== "all" || statusFilter !== "all" || searchQuery) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              paddingTop: "6px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, marginRight: "2px" }}>
              Active:
            </span>

            {searchQuery && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Search: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {roleFilter !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Role: {roleFilter}</span>
                <button
                  type="button"
                  onClick={() => setRoleFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            {statusFilter !== "all" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                <span>Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", padding: 0 }}
                >
                  <XMarkIcon />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                fontSize: "11.5px",
                fontWeight: 600,
                cursor: "pointer",
                marginLeft: "4px",
              }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* SUBTABS ROW (Underline Filter Bar with Count Badges + Right Action Button) */}
      {activeTab === "users" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: "16px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {/* Subtabs Left */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
            }}
          >
            {[
              { key: "all", label: "All Users", count: userCounts.all },
              { key: "active", label: "Active", count: userCounts.active },
              { key: "pending", label: "Pending Invite", count: userCounts.pending },
              { key: "inactive", label: "Inactive", count: userCounts.inactive },
            ].map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                    background: "transparent",
                    color: isActive ? "#2563eb" : "#64748b",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    marginBottom: "-1px",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: isActive ? "#eff6ff" : "#f1f5f9",
                      color: isActive ? "#2563eb" : "#64748b",
                      border: `1px solid ${isActive ? "#bfdbfe" : "#e2e8f0"}`,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Action Button */}
          {canManageUsers && (
            <button
              type="button"
              onClick={openAddUserDrawer}
              style={{
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "5px 13px",
                height: "32px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                marginBottom: "4px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
            >
              <PlusIcon />
              <span>Add User</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: "16px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {/* Subtabs Left */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
            }}
          >
            {[
              { key: "all", label: "All Roles", count: roleCounts.all },
              { key: "default", label: "System Default", count: roleCounts.default },
              { key: "custom", label: "Custom Roles", count: roleCounts.custom },
            ].map((tab) => {
              const isActive = roleTypeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRoleTypeFilter(tab.key as any)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                    background: "transparent",
                    color: isActive ? "#2563eb" : "#64748b",
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                    marginBottom: "-1px",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: isActive ? "#eff6ff" : "#f1f5f9",
                      color: isActive ? "#2563eb" : "#64748b",
                      border: `1px solid ${isActive ? "#bfdbfe" : "#e2e8f0"}`,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Action Button */}
          {canManageUsers && (
            <button
              type="button"
              onClick={openCreateRoleDrawer}
              style={{
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "5px 13px",
                height: "32px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                marginBottom: "4px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
            >
              <PlusIcon />
              <span>Create Role</span>
            </button>
          )}
        </div>
      )}

      {/* TAB 1: USERS TABLE */}
      {activeTab === "users" && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <tr style={{ color: "#64748b" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Website Access</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Last Active</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "40px" }}>
                      <div style={{ color: "#64748b" }}>Loading workspace members...</div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "48px 16px" }}>
                      <div style={{ color: "#64748b", fontSize: "13.5px" }}>No team members found matching your filters.</div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isOwnerUser = u.is_owner;
                    const isActive = u.is_active && u.status === "active";
                    const isPending = u.invitation_pending || u.status === "pending";

                    return (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Name */}
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: isOwnerUser ? "#eff6ff" : "#f1f5f9",
                                color: isOwnerUser ? "#2563eb" : "#475569",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "12px",
                                border: isOwnerUser ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                              }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{u.name}</div>
                              {isOwnerUser && (
                                <span style={{ fontSize: "10.5px", color: "#2563eb", fontWeight: 700 }}>
                                  Workspace Owner
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={tdStyle}>
                          <span style={{ color: "#475569", fontFamily: "monospace", fontSize: "12.5px" }}>
                            {u.email}
                          </span>
                        </td>

                        {/* Role */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "3px 9px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: isOwnerUser
                                ? "#f1f5f9"
                                : u.role === "Store Manager"
                                ? "#eff6ff"
                                : u.role === "Content Manager"
                                ? "#faf5ff"
                                : u.role === "Order Manager"
                                ? "#f0fdf4"
                                : "#f8fafc",
                              color: isOwnerUser
                                ? "#0f172a"
                                : u.role === "Store Manager"
                                ? "#2563eb"
                                : u.role === "Content Manager"
                                ? "#7e22ce"
                                : u.role === "Order Manager"
                                ? "#15803d"
                                : "#334155",
                              border: `1px solid ${
                                isOwnerUser
                                  ? "#cbd5e1"
                                  : u.role === "Store Manager"
                                  ? "#bfdbfe"
                                  : u.role === "Content Manager"
                                  ? "#e9d5ff"
                                  : u.role === "Order Manager"
                                  ? "#bbf7d0"
                                  : "#e2e8f0"
                              }`,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>

                        {/* Website Access */}
                        <td style={tdStyle}>
                          <span style={{ color: "#334155", fontWeight: 500 }}>
                            {u.website_access_display}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              background: isActive ? "#dcfce7" : isPending ? "#fef3c7" : "#f1f5f9",
                              color: isActive ? "#15803d" : isPending ? "#b45309" : "#64748b",
                              border: `1px solid ${
                                isActive ? "#bbf7d0" : isPending ? "#fde68a" : "#e2e8f0"
                              }`,
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: isActive ? "#16a34a" : isPending ? "#d97706" : "#94a3b8",
                              }}
                            />
                            {isPending ? "Invitation Pending" : isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Last Active */}
                        <td style={tdStyle}>
                          <span style={{ color: "#64748b", fontSize: "12.5px" }}>{u.last_active}</span>
                        </td>

                        {/* Actions */}
                        <td style={{ ...tdStyle, textAlign: "right", position: "relative" }}>
                          {canManageUsers ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => openEditUserDrawer(u)}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#334155",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>

                              {/* Three-dot Trigger */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuUserId(openMenuUserId === u.id ? null : u.id);
                                }}
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  border: "1px solid transparent",
                                  background: openMenuUserId === u.id ? "#f1f5f9" : "transparent",
                                  color: "#64748b",
                                  cursor: "pointer",
                                  display: "grid",
                                  placeItems: "center",
                                }}
                                title="More actions"
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 15, height: 15 }}>
                                  <circle cx="12" cy="5" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="12" cy="19" r="2" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>View only</span>
                          )}

                          {/* Dropdown Menu */}
                          {openMenuUserId === u.id && (
                            <div
                              ref={menuRef}
                              style={{
                                position: "absolute",
                                right: "12px",
                                top: "42px",
                                width: "170px",
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                                padding: "4px",
                                zIndex: 50,
                                textAlign: "left",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => openEditUserDrawer(u)}
                                style={menuItemStyle}
                              >
                                Edit
                              </button>

                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleResendInvite(u)}
                                  style={menuItemStyle}
                                >
                                  Resend Invitation
                                </button>
                              )}

                              {!isOwnerUser && isActive && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    setDeactivateModalUser(u);
                                  }}
                                  style={{ ...menuItemStyle, color: "#d97706" }}
                                >
                                  Deactivate
                                </button>
                              )}

                              {!isOwnerUser && !isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleReactivate(u)}
                                  style={{ ...menuItemStyle, color: "#16a34a" }}
                                >
                                  Reactivate
                                </button>
                              )}

                              {!isOwnerUser && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuUserId(null);
                                    setRemoveModalUser(u);
                                  }}
                                  style={{ ...menuItemStyle, color: "#ef4444" }}
                                >
                                  Remove User
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES TABLE */}
      {activeTab === "roles" && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <tr style={{ color: "#64748b" }}>
                  <th style={thStyle}>Role Name</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Users</th>
                  <th style={thStyle}>Permissions</th>
                  <th style={thStyle}>Type</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: "48px 16px" }}>
                      <div style={{ color: "#64748b", fontSize: "13.5px" }}>No roles found matching your filters.</div>
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((r) => {
                    const isOwnerRole = r.name === "Owner";
                    return (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Role Name */}
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.name}</div>
                        </td>

                        {/* Description */}
                        <td style={{ ...tdStyle, color: "#64748b", maxWidth: "340px" }}>
                          {r.description || "—"}
                        </td>

                        {/* Users Count */}
                        <td style={tdStyle}>
                          <span style={{ color: "#334155", fontWeight: 600 }}>
                            {r.users_count} {r.users_count === 1 ? "user" : "users"}
                          </span>
                        </td>

                        {/* Permissions Count */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              background: "#f1f5f9",
                              fontSize: "12px",
                              color: "#475569",
                              fontWeight: 600,
                            }}
                          >
                            {isOwnerRole ? "Full Access" : `${r.permissions_count} permissions`}
                          </span>
                        </td>

                        {/* Type Badge */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "11.5px",
                              fontWeight: 600,
                              background: r.is_system ? "#f1f5f9" : "#eff6ff",
                              color: r.is_system ? "#475569" : "#2563eb",
                              border: `1px solid ${r.is_system ? "#e2e8f0" : "#bfdbfe"}`,
                            }}
                          >
                            {r.type}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            {!isOwnerRole && canManageUsers && (
                              <button
                                type="button"
                                onClick={() => openEditRoleDrawer(r)}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#334155",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                            )}

                            {!r.is_system && canManageUsers && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRoleClick(r)}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #fee2e2",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* MODAL: ADD USER / EDIT USER                                             */}
      {/* ----------------------------------------------------------------------- */}
      {(drawerMode === "add-user" || drawerMode === "edit-user") && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 1000,
            overflowY: "auto",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px 48px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !drawerSubmitting) {
              setDrawerMode(null);
            }
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "760px",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.25)",
              marginBottom: "32px",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>
                  {drawerMode === "add-user" ? "Add New User" : `Edit User: ${selectedUser?.name}`}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  {drawerMode === "add-user"
                    ? "Invite a team member to collaborate on your workspace"
                    : "Update role assignment, store access, and custom permissions"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerMode(null)}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: "6px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  color: "#64748b",
                }}
              >
                <XMarkIcon />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveUser} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Card 1: User Details */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "6px",
                  }}
                >
                  General Information
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="e.g. Rahul Mehta"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Email Address *</label>
                    <input
                      type="email"
                      required
                      disabled={drawerMode === "edit-user"}
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="e.g. rahul.mehta@example.com"
                      style={{
                        ...inputStyle,
                        background: drawerMode === "edit-user" ? "#f8fafc" : "#ffffff",
                        cursor: drawerMode === "edit-user" ? "not-allowed" : "text",
                      }}
                    />
                    {drawerMode === "edit-user" && (
                      <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>
                        Email cannot be changed after invitation.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Role & Website Access */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "6px",
                  }}
                >
                  Role & Store Access
                </div>

                {/* Role Selector */}
                <div>
                  <label style={labelStyle}>Assigned Role *</label>
                  <select
                    value={userRoleId}
                    onChange={(e) => setUserRoleId(e.target.value)}
                    disabled={selectedUser?.is_owner}
                    style={{
                      ...inputStyle,
                      background: selectedUser?.is_owner ? "#f8fafc" : "#ffffff",
                    }}
                  >
                    <option value="" disabled>Select Role</option>
                    {roles
                      .filter((r) => (selectedUser?.is_owner ? true : r.name !== "Owner"))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.is_system ? "(Default System Role)" : "(Custom Role)"}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Website Access */}
                <div>
                  <label style={labelStyle}>Storefront Access</label>
                  <div style={{ display: "flex", gap: "20px", marginBottom: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="website_access_type"
                        checked={userWebsiteAccessType === "all"}
                        onChange={() => setUserWebsiteAccessType("all")}
                        disabled={selectedUser?.is_owner}
                      />
                      <span>All Websites</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="website_access_type"
                        checked={userWebsiteAccessType === "specific"}
                        onChange={() => setUserWebsiteAccessType("specific")}
                        disabled={selectedUser?.is_owner}
                      />
                      <span>Specific Websites Only</span>
                    </label>
                  </div>

                  {userWebsiteAccessType === "specific" && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        maxHeight: "140px",
                        overflowY: "auto",
                      }}
                    >
                      {sites.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#64748b" }}>No websites registered yet.</div>
                      ) : (
                        sites.map((s) => {
                          const isChecked = userSelectedSiteIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "12.5px",
                                color: "#0f172a",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setUserSelectedSiteIds((prev) => [...prev, s.id]);
                                  } else {
                                    setUserSelectedSiteIds((prev) => prev.filter((id) => id !== s.id));
                                  }
                                }}
                              />
                              <span>{s.brand_name}</span>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>({s.slug})</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Permissions & Custom Overrides */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#0f172a",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Permissions Overview
                  </div>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    Role: <strong>{currentSelectedRole?.name || "None"}</strong>
                  </span>
                </div>

                {/* Inherited Permissions */}
                <div>
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                    Inherited Permissions ({inheritedPerms.length})
                  </div>
                  {inheritedPerms.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>No permissions inherited</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "90px", overflowY: "auto" }}>
                      {inheritedPerms.map((pId) => {
                        const meta = permissionsMap.get(pId);
                        return (
                          <span
                            key={pId}
                            title={meta ? `${meta.module} › ${meta.name}: ${meta.description}` : pId}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: "#f1f5f9",
                              color: "#475569",
                              fontSize: "11px",
                              fontWeight: 500,
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {meta ? `${meta.module}: ${meta.name}` : pId}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Additional Permissions */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Additional Custom Permissions ({userAdditionalPerms.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdditionalPermPicker(!showAdditionalPermPicker)}
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
                      {showAdditionalPermPicker ? "Hide Picker" : "+ Add Custom Permissions"}
                    </button>
                  </div>

                  {userAdditionalPerms.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", marginBottom: "6px" }}>
                      No user-specific override permissions
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }}>
                      {userAdditionalPerms.map((pId) => {
                        const meta = permissionsMap.get(pId);
                        return (
                          <span
                            key={pId}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontSize: "11px",
                              fontWeight: 600,
                              border: "1px solid #bfdbfe",
                            }}
                          >
                            <span>{meta ? `${meta.module}: ${meta.name}` : pId}</span>
                            <button
                              type="button"
                              onClick={() => removeAdditionalPerm(pId)}
                              style={{
                                border: "none",
                                background: "none",
                                color: "#1d4ed8",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: "12px",
                                lineHeight: 1,
                              }}
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Picker Accordion */}
                  {showAdditionalPermPicker && (
                    <div
                      style={{
                        marginTop: "8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        background: "#ffffff",
                        maxHeight: "180px",
                        overflowY: "auto",
                        padding: "8px 10px",
                      }}
                    >
                      {permissionCatalog.map((cat) => (
                        <div key={cat.key} style={{ marginBottom: "8px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>
                            {cat.category}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {cat.modules.flatMap((m) =>
                              m.permissions.map((p) => {
                                const isInherited = inheritedPerms.includes(p.id);
                                const isSelected = userAdditionalPerms.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    disabled={isInherited}
                                    onClick={() => (isSelected ? removeAdditionalPerm(p.id) : addAdditionalPerm(p.id))}
                                    style={{
                                      padding: "3px 7px",
                                      borderRadius: "4px",
                                      border: isSelected
                                        ? "1px solid #3b82f6"
                                        : isInherited
                                        ? "1px solid #f1f5f9"
                                        : "1px solid #e2e8f0",
                                      background: isSelected ? "#eff6ff" : isInherited ? "#f8fafc" : "#ffffff",
                                      color: isSelected ? "#1d4ed8" : isInherited ? "#94a3b8" : "#334155",
                                      fontSize: "11px",
                                      cursor: isInherited ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {isSelected ? "✓ " : isInherited ? "• " : "+ "}
                                    {m.module}: {p.name}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Sticky Footer */}
            <div
              style={{
                position: "sticky",
                bottom: 0,
                zIndex: 20,
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: drawerMode === "edit-user" && !selectedUser?.is_owner ? "space-between" : "flex-end",
                gap: "10px",
              }}
            >
              {drawerMode === "edit-user" && !selectedUser?.is_owner && (
                selectedUser?.is_active ? (
                  <button
                    type="button"
                    onClick={() => setDeactivateModalUser(selectedUser)}
                    style={{
                      padding: "7px 13px",
                      borderRadius: "6px",
                      border: "1px solid #fca5a5",
                      background: "#ffffff",
                      color: "#dc2626",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Deactivate User
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectedUser && handleReactivate(selectedUser)}
                    style={{
                      padding: "7px 13px",
                      borderRadius: "6px",
                      border: "1px solid #86efac",
                      background: "#ffffff",
                      color: "#16a34a",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reactivate User
                  </button>
                )
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setDrawerMode(null)}
                  disabled={drawerSubmitting}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveUser}
                  disabled={drawerSubmitting}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: drawerSubmitting ? 0.7 : 1,
                  }}
                >
                  {drawerSubmitting
                    ? "Submitting..."
                    : drawerMode === "add-user"
                    ? "Send Invitation"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* MODAL: CREATE ROLE / EDIT ROLE                                          */}
      {/* ----------------------------------------------------------------------- */}
      {(drawerMode === "create-role" || drawerMode === "edit-role") && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 1000,
            overflowY: "auto",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px 48px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !drawerSubmitting) {
              setDrawerMode(null);
            }
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "760px",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.25)",
              marginBottom: "32px",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>
                  {drawerMode === "create-role" ? "Create New Role" : `Edit Role: ${selectedRole?.name}`}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Define permissions and operational privileges for this team role
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerMode(null)}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: "6px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  color: "#64748b",
                }}
              >
                <XMarkIcon />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRole} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Card 1: Role Information */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "6px",
                  }}
                >
                  Role Overview
                </div>

                <div>
                  <label style={labelStyle}>Role Name *</label>
                  <input
                    type="text"
                    required
                    disabled={selectedRole?.is_system}
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g. Catalog Specialist"
                    style={{
                      ...inputStyle,
                      background: selectedRole?.is_system ? "#f8fafc" : "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Role Description</label>
                  <textarea
                    rows={2}
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    placeholder="Brief description of duties and responsibilities..."
                    style={{
                      ...inputStyle,
                      height: "auto",
                      padding: "8px 12px",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              {/* Card 2: Permissions Configuration */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#0f172a",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Permissions Configuration
                  </div>
                  <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 700 }}>
                    {rolePermissions.length} selected
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {permissionCatalog.map((cat) => {
                    const isExpanded = expandedCategoryKey === cat.key;
                    const catPermIds = cat.modules.flatMap((m) => m.permissions.map((p) => p.id));
                    const selectedInCatCount = catPermIds.filter((id) => rolePermissions.includes(id)).length;
                    const allCatSelected = catPermIds.length > 0 && selectedInCatCount === catPermIds.length;

                    return (
                      <div
                        key={cat.key}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "#ffffff",
                        }}
                      >
                        {/* Category Header */}
                        <div
                          style={{
                            padding: "10px 14px",
                            background: "#f8fafc",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => setExpandedCategoryKey(isExpanded ? "" : cat.key)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                              {cat.category}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: "10px",
                                background: selectedInCatCount > 0 ? "#eff6ff" : "#f1f5f9",
                                color: selectedInCatCount > 0 ? "#2563eb" : "#64748b",
                              }}
                            >
                              {selectedInCatCount} / {catPermIds.length}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCategoryPermissions(cat);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#2563eb",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: "2px 4px",
                              }}
                            >
                              {allCatSelected ? "Deselect All" : "Select All"}
                            </button>

                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>

                        {/* Category Modules */}
                        {isExpanded && (
                          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            {cat.modules.map((mod) => (
                              <div key={mod.key} style={{ paddingBottom: "10px", borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                                  {mod.module}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px" }}>
                                  {mod.permissions.map((p) => {
                                    const isChecked = rolePermissions.includes(p.id);
                                    return (
                                      <label
                                        key={p.id}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          fontSize: "12px",
                                          color: isChecked ? "#0f172a" : "#475569",
                                          cursor: "pointer",
                                          userSelect: "none",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleRolePermission(p.id)}
                                        />
                                        <span>{p.name}</span>
                                        {p.sensitive && (
                                          <span
                                            style={{
                                              fontSize: "9.5px",
                                              fontWeight: 700,
                                              padding: "1px 4px",
                                              borderRadius: "4px",
                                              background: "#fef2f2",
                                              color: "#dc2626",
                                            }}
                                            title="Sensitive permission"
                                          >
                                            Sensitive
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            {/* Sticky Footer */}
            <div
              style={{
                position: "sticky",
                bottom: 0,
                zIndex: 20,
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => setDrawerMode(null)}
                disabled={drawerSubmitting}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveRole}
                disabled={drawerSubmitting}
                style={{
                  padding: "7px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: drawerSubmitting ? 0.7 : 1,
                }}
              >
                {drawerSubmitting ? "Saving..." : drawerMode === "create-role" ? "Create Role" : "Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* CONFIRMATION MODAL: DEACTIVATE USER                                     */}
      {/* ----------------------------------------------------------------------- */}
      {deactivateModalUser && (
        <div style={modalBackdropStyle} onClick={() => setDeactivateModalUser(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Deactivate this user?
            </h4>
            <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#64748b", lineHeight: 1.45 }}>
              This user will no longer be able to access Webcreon until reactivated.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setDeactivateModalUser(null)}
                style={modalCancelButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivateConfirm}
                style={{
                  padding: "7px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* CONFIRMATION MODAL: REMOVE USER                                         */}
      {/* ----------------------------------------------------------------------- */}
      {removeModalUser && (
        <div style={modalBackdropStyle} onClick={() => setRemoveModalUser(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Remove team member?
            </h4>
            <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#64748b", lineHeight: 1.45 }}>
              Are you sure you want to remove <strong>{removeModalUser.name}</strong> from your workspace? Their permissions will be immediately revoked.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setRemoveModalUser(null)}
                style={modalCancelButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveConfirm}
                style={{
                  padding: "7px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* CONFIRMATION MODAL: DELETE ROLE                                         */}
      {/* ----------------------------------------------------------------------- */}
      {deleteRoleModal && (
        <div style={modalBackdropStyle} onClick={() => setDeleteRoleModal(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Delete role?
            </h4>
            <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#64748b", lineHeight: 1.45 }}>
              Are you sure you want to delete the role <strong>"{deleteRoleModal.name}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setDeleteRoleModal(null)}
                style={modalCancelButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRoleConfirm}
                style={{
                  padding: "7px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* MODAL: ROLE ASSIGNED WARNING                                            */}
      {/* ----------------------------------------------------------------------- */}
      {roleAssignedWarningModal && (
        <div style={modalBackdropStyle} onClick={() => setRoleAssignedWarningModal(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#d97706" }}>
              Cannot Delete Role
            </h4>
            <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#475569", lineHeight: 1.45 }}>
              This role is currently assigned to <strong>{roleAssignedWarningModal.userCount}</strong> users. Reassign these users before deleting the role.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setRoleAssignedWarningModal(null)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------- */}
      {/* POPUP: INVITATION LINK COPIED                                           */}
      {/* ----------------------------------------------------------------------- */}
      {copiedInviteUrl && (
        <div style={modalBackdropStyle} onClick={() => setCopiedInviteUrl(null)}>
          <div style={{ ...modalCardStyle, maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "grid", placeItems: "center" }}>
                ✓
              </div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Invitation Dispatched
              </h4>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#64748b", lineHeight: 1.45 }}>
              The invited team member can use this link to set their password and activate their account:
            </p>

            <div
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#0f172a",
                wordBreak: "break-all",
                marginBottom: "16px",
              }}
            >
              {copiedInviteUrl}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(copiedInviteUrl);
                  setToast({ message: "Invitation URL copied to clipboard!", type: "success" });
                  setCopiedInviteUrl(null);
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Copy Link & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#64748b",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#334155",
  marginBottom: "5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "36px",
  padding: "0 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: "13px",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
};

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 10px",
  border: "none",
  background: "transparent",
  fontSize: "12.5px",
  color: "#334155",
  cursor: "pointer",
  borderRadius: "5px",
};

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: "64px",
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 99999,
  padding: "16px",
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "380px",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "20px",
  boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.22)",
  border: "1px solid rgba(226, 232, 240, 0.9)",
  display: "flex",
  flexDirection: "column",
};

const modalCancelButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};
