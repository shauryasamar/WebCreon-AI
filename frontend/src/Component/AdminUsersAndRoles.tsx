import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useAdminTheme } from "../context/ThemeContext";
import { GlassToast } from "./GlassToast";
import { AccessDeniedView } from "./AccessDeniedView";
import { AdminCheckbox } from "./AdminProducts";

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
  plan?: string;
  is_pro?: boolean;
};

// ---------------------------------------------------------------------------
// ERROR MESSAGE EXTRACTOR (Parses string, object, and FastAPI 422 array errors)
// ---------------------------------------------------------------------------

const extractErrorMessage = (data: any, defaultMsg = "An error occurred"): string => {
  if (!data) return defaultMsg;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail
      .map((err: any) => {
        if (typeof err === "string") return err;
        if (err && typeof err.msg === "string") {
          const locArr = Array.isArray(err.loc) ? err.loc : [];
          const field = locArr.length > 0 && locArr[locArr.length - 1] !== "body" ? `${locArr[locArr.length - 1]}: ` : "";
          const cleanMsg = err.msg
            .replace(/^value is not a valid email address:\s*/i, "")
            .replace(/^value is not a valid\s*/i, "Invalid ")
            .replace(/^Value error,\s*/i, "");
          return `${field}${cleanMsg}`;
        }
        return typeof err === "object" ? JSON.stringify(err) : String(err);
      })
      .join("; ");
  }
  if (data.detail && typeof data.detail === "object") {
    if (typeof data.detail.message === "string") return data.detail.message;
    return JSON.stringify(data.detail);
  }
  if (data.message && typeof data.message === "string") return data.message;
  return defaultMsg;
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
  const { isDark, tokens } = useAdminTheme();
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

  // Close filter popover on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
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

  const [activeSitePlan, setActiveSitePlan] = useState<string>("FREE");
  const [planLoaded, setPlanLoaded] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userUrl = `${API_BASE_URL}/users-roles/users`;

      const [usersRes, rolesRes, catalogRes, sitesRes, billingRes] = await Promise.all([
        fetch(userUrl, { credentials: "include" }),
        fetch(`${API_BASE_URL}/users-roles/roles`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/users-roles/permissions-catalog`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/auth/admin/sites`, { credentials: "include" }).catch(() => null),
        fetch(`${API_BASE_URL}/api/billing/websites`, { credentials: "include" }).catch(() => null),
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
      const billingMap = new Map<string, { plan: string; is_pro: boolean }>();
      if (billingRes && billingRes.ok) {
        const bData = await billingRes.json();
        const targetSite = bData.websites?.find(
          (w: any) => String(w.website_id).toLowerCase() === String(effectiveSiteId).toLowerCase()
        );
        if (targetSite) {
          setActiveSitePlan(String(targetSite.current_plan || "FREE").toUpperCase());
        } else if (bData.websites?.length > 0) {
          const hasPro = bData.websites.some((w: any) => {
            const p = String(w.current_plan || "").toUpperCase();
            const s = String(w.subscription_status || w.status || "ACTIVE").toUpperCase();
            return p === "PRO" && (s === "ACTIVE" || s === "GRACE_PERIOD");
          });
          setActiveSitePlan(hasPro ? "PRO" : String(bData.websites[0].current_plan || "FREE").toUpperCase());
        }
        (bData.websites || []).forEach((w: any) => {
          const p = String(w.current_plan || "FREE").toUpperCase();
          const s = String(w.subscription_status || w.status || "ACTIVE").toUpperCase();
          const isPro = p === "PRO" && (s === "ACTIVE" || s === "GRACE_PERIOD");
          if (w.website_id) {
            billingMap.set(String(w.website_id).toLowerCase(), {
              plan: p,
              is_pro: isPro,
            });
          }
          if (w.slug) {
            billingMap.set(String(w.slug).toLowerCase(), {
              plan: p,
              is_pro: isPro,
            });
          }
        });
      }

      if (sitesRes && sitesRes.ok) {
        const sData = await sitesRes.json();
        const mapped = (sData || []).map((s: any) => {
          const sId = strId(s.id);
          const bInfo =
            billingMap.get(sId.toLowerCase()) ||
            billingMap.get(String(s.slug || "").toLowerCase());
          return {
            id: sId,
            slug: s.slug,
            brand_name: s.site_definition?.site?.brand_name || s.slug || "Store",
            plan: bInfo?.plan || "FREE",
            is_pro: Boolean(bInfo?.is_pro),
          };
        });
        setSites(mapped);
      }
      setPlanLoaded(true);
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
    return count;
  }, [roleFilter]);

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

  // Pro-enabled websites
  const proSites = useMemo(() => sites.filter((s) => s.is_pro), [sites]);

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
    const currentProSites = sites.filter((s) => s.is_pro);
    if (effectiveSiteId) {
      const currentSiteObj = sites.find((s) => String(s.id).toLowerCase() === String(effectiveSiteId).toLowerCase());
      if (currentSiteObj?.is_pro) {
        setUserSelectedSiteIds([currentSiteObj.id]);
      } else {
        setUserSelectedSiteIds(currentProSites.length > 0 ? [currentProSites[0].id] : []);
      }
    } else {
      setUserSelectedSiteIds(currentProSites.map((s) => s.id));
    }
    setUserWebsiteAccessType("specific");
    setUserAdditionalPerms([]);
    setShowAdditionalPermPicker(false);
    setDrawerMode("add-user");
  };

  const openEditUserDrawer = (u: TeamUser) => {
    setSelectedUser(u);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserRoleId(u.role_id || "");
    const proSiteIds = new Set(sites.filter((s) => s.is_pro).map((s) => s.id));
    if (u.website_access_type === "all" || u.is_owner) {
      setUserSelectedSiteIds(Array.from(proSiteIds));
    } else {
      setUserSelectedSiteIds(u.accessible_sites.map((s) => s.id).filter((id) => proSiteIds.has(id)));
    }
    setUserWebsiteAccessType(u.website_access_type);
    setUserAdditionalPerms([...u.additional_permissions]);
    setShowAdditionalPermPicker(false);
    setDrawerMode("edit-user");
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setToast({ message: "Full name is required", type: "error" });
      return;
    }
    if (drawerMode === "add-user") {
      if (!userEmail.trim()) {
        setToast({ message: "Email address is required", type: "error" });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEmail.trim())) {
        setToast({ message: "Please enter a valid email address (e.g. name@example.com)", type: "error" });
        return;
      }
    }
    if (!userRoleId) {
      setToast({ message: "Please select a role", type: "error" });
      return;
    }

    const currentProSites = sites.filter((s) => s.is_pro);
    if (currentProSites.length > 0 && userSelectedSiteIds.length === 0) {
      setToast({ message: "Please select at least one Pro website for this team member", type: "error" });
      return;
    }

    const accessType = "specific";

    setDrawerSubmitting(true);
    try {
      if (drawerMode === "add-user") {
        const payload = {
          name: userName.trim(),
          email: userEmail.trim(),
          role_id: userRoleId,
          website_access_type: accessType,
          site_ids: userSelectedSiteIds,
          additional_permissions: userAdditionalPerms,
        };

        const res = await fetch(`${API_BASE_URL}/users-roles/users/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to invite user"));

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
          website_access_type: accessType,
          site_ids: userSelectedSiteIds,
          additional_permissions: userAdditionalPerms,
        };

        const res = await fetch(`${API_BASE_URL}/users-roles/users/${selectedUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to update user"));

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to deactivate user"));

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to reactivate user"));

      setUsers((prev) => prev.map((item) => (item.id === u.id ? data.user : item)));
      setToast({ message: `${u.name} is now Active!`, type: "success" });
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to resend invite"));

      setUsers((prev) => prev.map((item) => (item.id === u.id ? data.user : item)));
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to remove user"));

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
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to create role"));

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
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to update role"));

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, "Failed to delete role"));

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

  if (planLoaded && activeSitePlan !== "PRO") {
    return (
      <AccessDeniedView
        title="Pro Plan Exclusive Feature"
        message="Inviting team members, assigning staff access, and configuring custom roles is available exclusively on the Pro plan."
        requiredPermission="Pro Subscription Plan"
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        color: tokens.textPrimary,
        position: "relative",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Toast */}
      {toast && <GlassToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* TOP HEADER CARD (Segmented Mode Pill + Search + Filters + Action Button) */}
      <div
        style={{
          background: tokens.surfaceBg,
          border: `1px solid ${tokens.border}`,
          borderRadius: "10px",
          padding: "8px 12px",
          marginBottom: "12px",
          boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
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
          {/* Mode Pill (Users vs Roles) */}
          <div
            style={{
              display: "inline-flex",
              background: tokens.elevatedSurfaceBg,
              padding: "3px",
              borderRadius: "8px",
              border: `1px solid ${tokens.border}`,
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
                    setSearchQuery("");
                  }}
                  style={{
                    borderRadius: "6px",
                    padding: "6px 16px",
                    border: "none",
                    background: isActive ? (isDark ? tokens.surfaceBg : "#ffffff") : "transparent",
                    color: isActive ? tokens.textPrimary : tokens.textSecondary,
                    boxShadow: isActive
                      ? (isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.06)")
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
                  color: tokens.textMuted,
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
                  fontSize: "12.5px",
                  height: "34px",
                  borderRadius: "7px",
                  border: `1px solid ${tokens.border}`,
                  background: tokens.elevatedSurfaceBg,
                  color: tokens.textPrimary,
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
                    color: tokens.textMuted,
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
                    border: activeUserFilterCount > 0 ? `1px solid ${isDark ? "rgba(59, 130, 246, 0.4)" : "#93c5fd"}` : `1px solid ${tokens.border}`,
                    background: activeUserFilterCount > 0 ? (isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff") : tokens.surfaceBg,
                    color: activeUserFilterCount > 0 ? (isDark ? "#93c5fd" : "#1d4ed8") : tokens.textPrimary,
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
                        background: tokens.accent,
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
                      top: "40px",
                      right: "0",
                      width: "280px",
                      background: tokens.surfaceBg,
                      borderRadius: "10px",
                      border: `1px solid ${tokens.border}`,
                      boxShadow: isDark ? "0 10px 25px -5px rgba(0, 0, 0, 0.5)" : "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                      padding: "16px",
                      zIndex: 100,
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: tokens.textSecondary, marginBottom: "6px" }}>
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
                          border: `1px solid ${tokens.border}`,
                          fontSize: "13px",
                          background: tokens.elevatedSurfaceBg,
                          color: tokens.textPrimary,
                          outline: "none",
                        }}
                      >
                        <option value="all" style={{ background: tokens.surfaceBg, color: tokens.textPrimary }}>All Roles</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.name} style={{ background: tokens.surfaceBg, color: tokens.textPrimary }}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: `1px solid ${tokens.border}` }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRoleFilter("all");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: tokens.textSecondary,
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
                          background: tokens.accent,
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
        {(roleFilter !== "all" || searchQuery) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              paddingTop: "6px",
              borderTop: `1px solid ${tokens.border}`,
            }}
          >
            <span style={{ fontSize: "11.5px", color: tokens.textSecondary, fontWeight: 600, marginRight: "2px" }}>
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
                  background: isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff",
                  color: isDark ? "#60a5fa" : "#1d4ed8",
                  border: `1px solid ${tokens.border}`,
                }}
              >
                <span>Search: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
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
                  background: isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff",
                  color: isDark ? "#60a5fa" : "#1d4ed8",
                  border: `1px solid ${tokens.border}`,
                }}
              >
                <span>Role: {roleFilter}</span>
                <button
                  type="button"
                  onClick={() => setRoleFilter("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}
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
              }}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
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
            borderBottom: `1px solid ${tokens.border}`,
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
                    borderBottom: isActive ? `2px solid ${tokens.accent}` : "2px solid transparent",
                    background: "transparent",
                    color: isActive ? tokens.accent : tokens.textSecondary,
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
                      background: isActive
                        ? (isDark ? "rgba(59, 130, 246, 0.25)" : "#eff6ff")
                        : (isDark ? tokens.elevatedSurfaceBg : "#f1f5f9"),
                      color: isActive ? (isDark ? "#60a5fa" : "#2563eb") : tokens.textSecondary,
                      border: `1px solid ${isActive ? (isDark ? "rgba(59, 130, 246, 0.4)" : "#bfdbfe") : tokens.border}`,
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
                background: tokens.accent,
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
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
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
            borderBottom: `1px solid ${tokens.border}`,
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
                    borderBottom: isActive ? `2px solid ${tokens.accent}` : "2px solid transparent",
                    background: "transparent",
                    color: isActive ? tokens.accent : tokens.textSecondary,
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
                      background: isActive
                        ? (isDark ? "rgba(59, 130, 246, 0.25)" : "#eff6ff")
                        : (isDark ? tokens.elevatedSurfaceBg : "#f1f5f9"),
                      color: isActive ? (isDark ? "#60a5fa" : "#2563eb") : tokens.textSecondary,
                      border: `1px solid ${isActive ? (isDark ? "rgba(59, 130, 246, 0.4)" : "#bfdbfe") : tokens.border}`,
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
                background: tokens.accent,
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
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
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
            background: tokens.surfaceBg,
            border: `1px solid ${tokens.border}`,
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 2px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead style={{ background: tokens.elevatedSurfaceBg, borderBottom: `1px solid ${tokens.border}` }}>
                <tr style={{ color: tokens.textSecondary }}>
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
                      <div style={{ color: tokens.textSecondary }}>Loading workspace members...</div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "48px 16px" }}>
                      <div style={{ color: tokens.textSecondary, fontSize: "13.5px" }}>No team members found matching your filters.</div>
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
                          borderBottom: `1px solid ${tokens.border}`,
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.03)" : "#fafafa")}
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
                                background: isOwnerUser
                                  ? (isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff")
                                  : (isDark ? tokens.elevatedSurfaceBg : "#f1f5f9"),
                                color: isOwnerUser ? (isDark ? "#60a5fa" : "#2563eb") : tokens.textSecondary,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "12px",
                                border: `1px solid ${isOwnerUser ? (isDark ? "rgba(59, 130, 246, 0.4)" : "#bfdbfe") : tokens.border}`,
                              }}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: tokens.textPrimary }}>{u.name}</div>
                              {isOwnerUser && (
                                <span style={{ fontSize: "10.5px", color: isDark ? "#60a5fa" : "#2563eb", fontWeight: 700 }}>
                                  Workspace Owner
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={tdStyle}>
                          <span style={{ color: tokens.textSecondary, fontFamily: "monospace", fontSize: "12.5px" }}>
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
                                ? (isDark ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9")
                                : u.role === "Store Manager"
                                ? (isDark ? "rgba(59, 130, 246, 0.18)" : "#eff6ff")
                                : u.role === "Content Manager"
                                ? (isDark ? "rgba(168, 85, 247, 0.18)" : "#faf5ff")
                                : u.role === "Order Manager"
                                ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4")
                                : (isDark ? tokens.elevatedSurfaceBg : "#f8fafc"),
                              color: isOwnerUser
                                ? tokens.textPrimary
                                : u.role === "Store Manager"
                                ? (isDark ? "#60a5fa" : "#2563eb")
                                : u.role === "Content Manager"
                                ? (isDark ? "#c084fc" : "#7e22ce")
                                : u.role === "Order Manager"
                                ? (isDark ? "#4ade80" : "#15803d")
                                : tokens.textSecondary,
                              border: `1px solid ${
                                isOwnerUser
                                  ? tokens.border
                                  : u.role === "Store Manager"
                                  ? (isDark ? "rgba(59, 130, 246, 0.35)" : "#bfdbfe")
                                  : u.role === "Content Manager"
                                  ? (isDark ? "rgba(168, 85, 247, 0.35)" : "#e9d5ff")
                                  : u.role === "Order Manager"
                                  ? (isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0")
                                  : tokens.border
                              }`,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>

                        {/* Website Access */}
                        <td style={tdStyle}>
                          <span style={{ color: tokens.textSecondary, fontWeight: 500 }}>
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
                              background: isActive
                                ? (isDark ? "rgba(34, 197, 94, 0.15)" : "#dcfce7")
                                : isPending
                                ? (isDark ? "rgba(245, 158, 11, 0.15)" : "#fef3c7")
                                : (isDark ? tokens.elevatedSurfaceBg : "#f1f5f9"),
                              color: isActive
                                ? (isDark ? "#4ade80" : "#15803d")
                                : isPending
                                ? (isDark ? "#fbbf24" : "#b45309")
                                : tokens.textSecondary,
                              border: `1px solid ${
                                isActive
                                  ? (isDark ? "rgba(34, 197, 94, 0.3)" : "#bbf7d0")
                                  : isPending
                                  ? (isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a")
                                  : tokens.border
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
                          <span style={{ color: tokens.textMuted, fontSize: "12.5px" }}>{u.last_active}</span>
                        </td>

                        {/* Actions */}
                        <td style={{ ...tdStyle, textAlign: "right", position: "relative" }}>
                          {isOwnerUser ? (
                            <span
                              style={{
                                fontSize: "11.5px",
                                color: tokens.textMuted,
                                fontWeight: 500,
                                paddingRight: "6px",
                              }}
                            >
                              Owner Account
                            </span>
                          ) : canManageUsers ? (
                            <button
                              type="button"
                              onClick={() => openEditUserDrawer(u)}
                              style={{
                                padding: "5px 12px",
                                borderRadius: "6px",
                                border: `1px solid ${tokens.border}`,
                                background: tokens.elevatedSurfaceBg,
                                color: tokens.textPrimary,
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.12s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = tokens.accent;
                                e.currentTarget.style.background = isDark ? tokens.surfaceBg : "#f8fafc";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = tokens.border;
                                e.currentTarget.style.background = isDark ? tokens.elevatedSurfaceBg : "#ffffff";
                              }}
                            >
                              Edit
                            </button>
                          ) : (
                            <span style={{ fontSize: "12px", color: tokens.textMuted }}>View only</span>
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
            background: tokens.surfaceBg,
            border: `1px solid ${tokens.border}`,
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 2px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead style={{ background: tokens.elevatedSurfaceBg, borderBottom: `1px solid ${tokens.border}` }}>
                <tr style={{ color: tokens.textSecondary }}>
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
                      <div style={{ color: tokens.textSecondary, fontSize: "13.5px" }}>No roles found matching your filters.</div>
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((r) => {
                    const isOwnerRole = r.name === "Owner";
                    return (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: `1px solid ${tokens.border}`,
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.03)" : "#fafafa")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Role Name */}
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: tokens.textPrimary }}>{r.name}</div>
                        </td>

                        {/* Description */}
                        <td style={{ ...tdStyle, color: tokens.textSecondary, maxWidth: "340px" }}>
                          {r.description || "—"}
                        </td>

                        {/* Users Count */}
                        <td style={tdStyle}>
                          <span style={{ color: tokens.textPrimary, fontWeight: 600 }}>
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
                              background: tokens.elevatedSurfaceBg,
                              fontSize: "12px",
                              color: tokens.textSecondary,
                              fontWeight: 600,
                              border: `1px solid ${tokens.border}`,
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
                              background: r.is_system
                                ? (isDark ? tokens.elevatedSurfaceBg : "#f1f5f9")
                                : (isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff"),
                              color: r.is_system ? tokens.textSecondary : (isDark ? "#60a5fa" : "#2563eb"),
                              border: `1px solid ${r.is_system ? tokens.border : (isDark ? "rgba(59, 130, 246, 0.35)" : "#bfdbfe")}`,
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
                                  border: `1px solid ${tokens.border}`,
                                  background: tokens.elevatedSurfaceBg,
                                  color: tokens.textPrimary,
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
                                  border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.3)" : "#fee2e2"}`,
                                  background: isDark ? "rgba(239, 68, 68, 0.12)" : "#ffffff",
                                  color: "#ef4444",
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
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
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
              background: tokens.surfaceBg,
              borderRadius: "12px",
              width: "100%",
              maxWidth: "760px",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
              marginBottom: "32px",
              overflow: "hidden",
              border: `1px solid ${tokens.border}`,
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
                borderBottom: `1px solid ${tokens.border}`,
                background: tokens.surfaceBg,
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", color: tokens.textPrimary, fontWeight: 700 }}>
                  {drawerMode === "add-user" ? "Add New User" : `Edit User: ${selectedUser?.name}`}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: tokens.textSecondary }}>
                  {drawerMode === "add-user"
                    ? "Invite a team member to collaborate on your workspace"
                    : "Update role assignment, store access, and custom permissions"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerMode(null)}
                style={{
                  border: `1px solid ${tokens.border}`,
                  background: tokens.elevatedSurfaceBg,
                  borderRadius: "6px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  color: tokens.textSecondary,
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
                  background: tokens.elevatedSurfaceBg,
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
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
                    color: tokens.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: `1px solid ${tokens.border}`,
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
                        background: drawerMode === "edit-user" ? (isDark ? "rgba(255,255,255,0.04)" : "#f8fafc") : (isDark ? tokens.surfaceBg : "#ffffff"),
                        cursor: drawerMode === "edit-user" ? "not-allowed" : "text",
                      }}
                    />
                    {drawerMode === "edit-user" && (
                      <span style={{ fontSize: "11px", color: tokens.textMuted, marginTop: "2px", display: "block" }}>
                        Email cannot be changed after invitation.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Role & Website Access */}
              <div
                style={{
                  background: tokens.elevatedSurfaceBg,
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
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
                    color: tokens.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: `1px solid ${tokens.border}`,
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
                      background: selectedUser?.is_owner ? (isDark ? "rgba(255,255,255,0.04)" : "#f8fafc") : (isDark ? tokens.surfaceBg : "#ffffff"),
                    }}
                  >
                    <option value="" disabled style={{ background: tokens.surfaceBg, color: tokens.textPrimary }}>Select Role</option>
                    {roles
                      .filter((r) => (selectedUser?.is_owner ? true : r.name !== "Owner"))
                      .map((r) => (
                        <option key={r.id} value={r.id} style={{ background: tokens.surfaceBg, color: tokens.textPrimary }}>
                          {r.name} {r.is_system ? "(Default System Role)" : "(Custom Role)"}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Website Access (Only Pro websites are available) */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Website Access</label>
                    {proSites.length > 1 && !selectedUser?.is_owner && (
                      <button
                        type="button"
                        onClick={() => {
                          if (userSelectedSiteIds.length === proSites.length) {
                            setUserSelectedSiteIds([]);
                          } else {
                            setUserSelectedSiteIds(proSites.map((s) => s.id));
                          }
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: tokens.accent,
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {userSelectedSiteIds.length === proSites.length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

                  {proSites.length === 0 ? (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: `1px solid ${tokens.border}`,
                        background: tokens.surfaceBg,
                        fontSize: "12.5px",
                        color: tokens.textSecondary,
                        lineHeight: "1.5",
                      }}
                    >
                      No Pro-tier websites available in this workspace. Upgrade a website to the Pro plan to assign team members.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        maxHeight: "180px",
                        overflowY: "auto",
                        padding: "2px 0",
                      }}
                    >
                      {proSites.map((s) => {
                        const isChecked = userSelectedSiteIds.includes(s.id);

                        return (
                          <label
                            key={s.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              borderRadius: "7px",
                              background: isChecked
                                ? (isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff")
                                : (isDark ? tokens.surfaceBg : "#ffffff"),
                              border: isChecked
                                ? (isDark ? `1px solid ${tokens.accent}` : "1px solid #93c5fd")
                                : `1px solid ${tokens.border}`,
                              cursor: selectedUser?.is_owner ? "default" : "pointer",
                              transition: "all 0.12s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                              <AdminCheckbox
                                checked={isChecked}
                                disabled={selectedUser?.is_owner}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setUserSelectedSiteIds((prev) => [...prev, s.id]);
                                  } else {
                                    setUserSelectedSiteIds((prev) => prev.filter((id) => id !== s.id));
                                  }
                                }}
                              />
                              <span style={{ fontSize: "13px", fontWeight: 600, color: tokens.textPrimary }}>
                                {s.brand_name}
                              </span>
                              <span style={{ fontSize: "11.5px", color: tokens.textSecondary }}>
                                ({s.slug})
                              </span>
                            </div>

                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "4px",
                                background: isDark ? "rgba(59, 130, 246, 0.25)" : "#dbeafe",
                                color: isDark ? "#60a5fa" : "#1e40af",
                                border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.4)" : "#bfdbfe"}`,
                                letterSpacing: "0.03em",
                              }}
                            >
                              PRO
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Permissions & Custom Overrides */}
              <div
                style={{
                  background: tokens.elevatedSurfaceBg,
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${tokens.border}`, paddingBottom: "6px" }}>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: tokens.textPrimary,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Permissions Overview
                  </div>
                  <span style={{ fontSize: "11.5px", color: tokens.textSecondary }}>
                    Role: <strong style={{ color: tokens.textPrimary }}>{currentSelectedRole?.name || "None"}</strong>
                  </span>
                </div>

                {/* Inherited Permissions */}
                <div>
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: tokens.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                    Inherited Permissions ({inheritedPerms.length})
                  </div>
                  {inheritedPerms.length === 0 ? (
                    <div style={{ fontSize: "12px", color: tokens.textMuted, fontStyle: "italic" }}>No permissions inherited</div>
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
                              background: isDark ? tokens.surfaceBg : "#f1f5f9",
                              color: tokens.textSecondary,
                              fontSize: "11px",
                              fontWeight: 500,
                              border: `1px solid ${tokens.border}`,
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
                <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "11.5px", fontWeight: 700, color: isDark ? "#60a5fa" : "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Additional Custom Permissions ({userAdditionalPerms.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdditionalPermPicker(!showAdditionalPermPicker)}
                      style={{
                        background: "none",
                        border: "none",
                        color: tokens.accent,
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
                    <div style={{ fontSize: "12px", color: tokens.textMuted, fontStyle: "italic", marginBottom: "6px" }}>
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
                              background: isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff",
                              color: isDark ? "#60a5fa" : "#1d4ed8",
                              fontSize: "11px",
                              fontWeight: 600,
                              border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.35)" : "#bfdbfe"}`,
                            }}
                          >
                            <span>{meta ? `${meta.module}: ${meta.name}` : pId}</span>
                            <button
                              type="button"
                              onClick={() => removeAdditionalPerm(pId)}
                              style={{
                                border: "none",
                                background: "none",
                                color: isDark ? "#60a5fa" : "#1d4ed8",
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
                        border: `1px solid ${tokens.border}`,
                        borderRadius: "8px",
                        background: tokens.surfaceBg,
                        maxHeight: "180px",
                        overflowY: "auto",
                        padding: "8px 10px",
                      }}
                    >
                      {permissionCatalog.map((cat) => (
                        <div key={cat.key} style={{ marginBottom: "8px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: tokens.textSecondary, textTransform: "uppercase", marginBottom: "4px" }}>
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
                                        ? `1px solid ${tokens.accent}`
                                        : isInherited
                                        ? `1px solid ${tokens.border}`
                                        : `1px solid ${tokens.border}`,
                                      background: isSelected
                                        ? (isDark ? "rgba(59, 130, 246, 0.25)" : "#eff6ff")
                                        : isInherited
                                        ? (isDark ? "rgba(255,255,255,0.03)" : "#f8fafc")
                                        : (isDark ? tokens.elevatedSurfaceBg : "#ffffff"),
                                      color: isSelected
                                        ? (isDark ? "#60a5fa" : "#1d4ed8")
                                        : isInherited
                                        ? tokens.textMuted
                                        : tokens.textPrimary,
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
                borderTop: `1px solid ${tokens.border}`,
                background: tokens.surfaceBg,
                display: "flex",
                alignItems: "center",
                justifyContent: drawerMode === "edit-user" && !selectedUser?.is_owner ? "space-between" : "flex-end",
                gap: "10px",
              }}
            >
              {drawerMode === "edit-user" && !selectedUser?.is_owner && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {selectedUser?.invitation_pending || selectedUser?.status === "pending" ? (
                    <button
                      type="button"
                      onClick={() => selectedUser && handleResendInvite(selectedUser)}
                      style={{
                        padding: "7px 13px",
                        borderRadius: "6px",
                        border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.4)" : "#93c5fd"}`,
                        background: tokens.elevatedSurfaceBg,
                        color: isDark ? "#60a5fa" : "#2563eb",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Resend Invite
                    </button>
                  ) : selectedUser?.is_active ? (
                    <button
                      type="button"
                      onClick={() => setDeactivateModalUser(selectedUser)}
                      style={{
                        padding: "7px 13px",
                        borderRadius: "6px",
                        border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.35)" : "#fca5a5"}`,
                        background: isDark ? "rgba(239, 68, 68, 0.1)" : "#ffffff",
                        color: "#ef4444",
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
                        border: `1px solid ${isDark ? "rgba(34, 197, 94, 0.35)" : "#86efac"}`,
                        background: isDark ? "rgba(34, 197, 94, 0.1)" : "#ffffff",
                        color: isDark ? "#4ade80" : "#16a34a",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Reactivate User
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedUser) {
                        setDrawerMode(null);
                        setRemoveModalUser(selectedUser);
                      }
                    }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${tokens.border}`,
                      background: tokens.elevatedSurfaceBg,
                      color: tokens.textSecondary,
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setDrawerMode(null)}
                  disabled={drawerSubmitting}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "6px",
                    border: `1px solid ${tokens.border}`,
                    background: tokens.elevatedSurfaceBg,
                    color: tokens.textPrimary,
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
                    background: tokens.accent,
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
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
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
              background: tokens.surfaceBg,
              borderRadius: "12px",
              width: "100%",
              maxWidth: "760px",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
              marginBottom: "32px",
              overflow: "hidden",
              border: `1px solid ${tokens.border}`,
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
                borderBottom: `1px solid ${tokens.border}`,
                background: tokens.surfaceBg,
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", color: tokens.textPrimary, fontWeight: 700 }}>
                  {drawerMode === "create-role" ? "Create New Role" : `Edit Role: ${selectedRole?.name}`}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: tokens.textSecondary }}>
                  Define permissions and operational privileges for this team role
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerMode(null)}
                style={{
                  border: `1px solid ${tokens.border}`,
                  background: tokens.elevatedSurfaceBg,
                  borderRadius: "6px",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  color: tokens.textSecondary,
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
                  background: tokens.elevatedSurfaceBg,
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
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
                    color: tokens.textPrimary,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: `1px solid ${tokens.border}`,
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
                      background: selectedRole?.is_system ? (isDark ? "rgba(255,255,255,0.04)" : "#f8fafc") : (isDark ? tokens.surfaceBg : "#ffffff"),
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
                  background: tokens.elevatedSurfaceBg,
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${tokens.border}`, paddingBottom: "6px" }}>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: tokens.textPrimary,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Permissions Configuration
                  </div>
                  <span style={{ fontSize: "12px", color: isDark ? "#60a5fa" : "#2563eb", fontWeight: 700 }}>
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
                          border: `1px solid ${tokens.border}`,
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: tokens.surfaceBg,
                        }}
                      >
                        {/* Category Header */}
                        <div
                          style={{
                            padding: "10px 14px",
                            background: tokens.elevatedSurfaceBg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={() => setExpandedCategoryKey(isExpanded ? "" : cat.key)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: tokens.textPrimary }}>
                              {cat.category}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: "10px",
                                background: selectedInCatCount > 0
                                  ? (isDark ? "rgba(59, 130, 246, 0.25)" : "#eff6ff")
                                  : (isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"),
                                color: selectedInCatCount > 0 ? (isDark ? "#60a5fa" : "#2563eb") : tokens.textSecondary,
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
                                color: tokens.accent,
                                fontSize: "11.5px",
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: "2px 4px",
                              }}
                            >
                              {allCatSelected ? "Deselect All" : "Select All"}
                            </button>

                            <span style={{ fontSize: "11px", color: tokens.textSecondary }}>
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>

                        {/* Category Modules */}
                        {isExpanded && (
                          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            {cat.modules.map((mod) => (
                              <div key={mod.key} style={{ paddingBottom: "10px", borderBottom: `1px solid ${tokens.border}` }}>
                                <div style={{ fontSize: "12.5px", fontWeight: 600, color: tokens.textPrimary, marginBottom: "6px" }}>
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
                                          color: isChecked ? tokens.textPrimary : tokens.textSecondary,
                                          cursor: "pointer",
                                          userSelect: "none",
                                        }}
                                      >
                                        <AdminCheckbox
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
                                              background: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2",
                                              color: "#ef4444",
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
                borderTop: `1px solid ${tokens.border}`,
                background: tokens.surfaceBg,
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
                  border: `1px solid ${tokens.border}`,
                  background: tokens.elevatedSurfaceBg,
                  color: tokens.textPrimary,
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
                  background: tokens.accent,
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
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: tokens.textPrimary }}>
              Deactivate this user?
            </h4>
            <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.45 }}>
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
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: tokens.textPrimary }}>
              Remove team member?
            </h4>
            <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.45 }}>
              Are you sure you want to remove <strong style={{ color: tokens.textPrimary }}>{removeModalUser.name}</strong> from your workspace? Their store access will be immediately revoked.
            </p>
            <p style={{ margin: "0 0 18px 0", fontSize: "12px", color: isDark ? "#4ade80" : "#059669", lineHeight: 1.4, background: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5", padding: "8px 10px", borderRadius: "6px", border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "#a7f3d0"}` }}>
              🔒 <strong>Audit Logs Preserved:</strong> All past actions, orders, and activity history performed by this user remain safely stored in your Activity log.
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
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: tokens.textPrimary }}>
              Delete role?
            </h4>
            <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.45 }}>
              Are you sure you want to delete the role <strong style={{ color: tokens.textPrimary }}>"{deleteRoleModal.name}"</strong>? This action cannot be undone.
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
            <h4 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700, color: "#f59e0b" }}>
              Cannot Delete Role
            </h4>
            <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.45 }}>
              This role is currently assigned to <strong style={{ color: tokens.textPrimary }}>{roleAssignedWarningModal.userCount}</strong> users. Reassign these users before deleting the role.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setRoleAssignedWarningModal(null)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "8px",
                  border: `1px solid ${tokens.border}`,
                  background: tokens.accent,
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
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7", color: isDark ? "#4ade80" : "#16a34a", display: "grid", placeItems: "center" }}>
                ✓
              </div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: tokens.textPrimary }}>
                Invitation Dispatched
              </h4>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: tokens.textSecondary, lineHeight: 1.45 }}>
              The invited team member can use this link to set their password and activate their account:
            </p>

            <div
              style={{
                background: tokens.elevatedSurfaceBg,
                border: `1px solid ${tokens.border}`,
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: tokens.textPrimary,
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
                  background: tokens.accent,
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
  color: "#a1a1aa",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12.5px",
  fontWeight: 600,
  color: "var(--admin-text-secondary, #64748b)",
  marginBottom: "5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "36px",
  padding: "0 12px",
  borderRadius: "8px",
  border: "1px solid var(--admin-border, rgba(15, 23, 42, 0.08))",
  background: "var(--admin-elevated-surface, #f8fafc)",
  fontSize: "13px",
  color: "var(--admin-text-primary, #0f172a)",
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
  color: "var(--admin-text-secondary, #64748b)",
  cursor: "pointer",
  borderRadius: "5px",
};

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: "64px",
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.65)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 99999,
  padding: "16px",
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "380px",
  background: "var(--admin-surface, #ffffff)",
  borderRadius: "14px",
  padding: "20px",
  boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)",
  border: "1px solid var(--admin-border, rgba(15, 23, 42, 0.08))",
  display: "flex",
  flexDirection: "column",
};

const modalCancelButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: "8px",
  border: "1px solid var(--admin-border, rgba(15, 23, 42, 0.08))",
  background: "var(--admin-elevated-surface, #f8fafc)",
  color: "var(--admin-text-primary, #0f172a)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};
