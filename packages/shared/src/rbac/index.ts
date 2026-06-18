/**
 * Role-Based Access Control — single source of truth shared by the API and SPA.
 *
 * Permissions describe **actions**, not roles. Routes are guarded by permission
 * (`requirePermission`) and the SPA gates UI by the same permission list, so the
 * front and back end can never disagree about who can do what.
 */

import { UserRole } from '../enums/index.js';
import { isPlatformAdmin } from '../platform/index.js';

export const Permission = {
  /** View jobs (list + detail). */
  JobsRead: 'jobs:read',
  /** Create a new job. */
  JobsCreate: 'jobs:create',
  /** Assign a vendor to a job. */
  JobsAssign: 'jobs:assign',
  /** View vendors (list + detail). */
  VendorsRead: 'vendors:read',
  /** Create/manage vendor company records. */
  VendorsCreate: 'vendors:create',
  /** Set vendor quality ratings (support / operations). */
  VendorsRate: 'vendors:rate',
  /** View tenant users (admin). */
  UsersRead: 'users:read',
  /** Manage users & role permissions (tenant-scoped; platform admin may target any tenant). */
  UsersManage: 'users:manage',
  /** List business tenants (platform admin only). */
  TenantsRead: 'tenants:read',
  /** Create business tenants (platform admin only). */
  TenantsManage: 'tenants:manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

export const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.JobsRead]: 'View jobs',
  [Permission.JobsCreate]: 'Create jobs',
  [Permission.JobsAssign]: 'Assign vendors to jobs',
  [Permission.VendorsRead]: 'View vendors',
  [Permission.VendorsCreate]: 'Manage vendor profiles',
  [Permission.VendorsRate]: 'Rate vendor performance',
  [Permission.UsersRead]: 'View users (read-only)',
  [Permission.UsersManage]: 'Manage users & role permissions',
  [Permission.TenantsRead]: 'View all business tenants',
  [Permission.TenantsManage]: 'Create business tenants',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PlatformAdmin]: 'Platform admin',
  [UserRole.Admin]: 'Tenant admin',
  [UserRole.Dispatcher]: 'Dispatcher',
  [UserRole.VendorManager]: 'Vendor manager',
  [UserRole.SupportAgent]: 'Support agent',
};

export type RolePermissionMatrix = Record<UserRole, Permission[]>;

/**
 * Role → permissions matrix (code defaults).
 *
 * - **admin** — full access to every API.
 * - **dispatcher** — runs the dispatch workflow: create jobs, assign vendors, view vendors.
 * - **vendor_manager** — owns the vendor directory; can view jobs but not create/assign them.
 * - **support_agent** — read-only across jobs and vendors.
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  [UserRole.PlatformAdmin]: [
    Permission.TenantsRead,
    Permission.TenantsManage,
    Permission.UsersRead,
    Permission.UsersManage,
    Permission.JobsRead,
    Permission.VendorsRead,
  ],
  [UserRole.Admin]: [...ALL_PERMISSIONS],
  [UserRole.Dispatcher]: [
    Permission.JobsRead,
    Permission.JobsCreate,
    Permission.JobsAssign,
    Permission.VendorsRead,
  ],
  [UserRole.VendorManager]: [
    Permission.JobsRead,
    Permission.VendorsRead,
    Permission.VendorsCreate,
  ],
  [UserRole.SupportAgent]: [
    Permission.JobsRead,
    Permission.VendorsRead,
    Permission.VendorsRate,
  ],
};

/** Merge tenant overrides onto code defaults. Admin always retains full access. */
export function resolveRoleMatrix(
  overrides?: Partial<Record<UserRole, Permission[]>>,
): RolePermissionMatrix {
  const matrix: RolePermissionMatrix = {
    [UserRole.PlatformAdmin]: [...DEFAULT_ROLE_PERMISSIONS[UserRole.PlatformAdmin]],
    [UserRole.Admin]: [...ALL_PERMISSIONS],
    [UserRole.Dispatcher]: [...DEFAULT_ROLE_PERMISSIONS[UserRole.Dispatcher]],
    [UserRole.VendorManager]: [...DEFAULT_ROLE_PERMISSIONS[UserRole.VendorManager]],
    [UserRole.SupportAgent]: [...DEFAULT_ROLE_PERMISSIONS[UserRole.SupportAgent]],
  };

  if (!overrides) return matrix;

  for (const role of Object.values(UserRole)) {
    if (role === UserRole.Admin || role === UserRole.PlatformAdmin) continue;
    const custom = overrides[role];
    if (custom) matrix[role] = [...custom];
  }

  return matrix;
}

/** Union of permissions granted by all of a user's roles. */
export function permissionsForRoles(
  roles: UserRole[],
  matrix: RolePermissionMatrix = DEFAULT_ROLE_PERMISSIONS,
): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of matrix[role] ?? []) {
      granted.add(permission);
    }
  }
  return ALL_PERMISSIONS.filter((p) => granted.has(p));
}

/** True when the roles grant the given permission. */
export function hasPermission(
  roles: UserRole[],
  permission: Permission,
  matrix: RolePermissionMatrix = DEFAULT_ROLE_PERMISSIONS,
): boolean {
  return roles.some((role) => (matrix[role] ?? []).includes(permission));
}

/** Roles a platform admin may assign when provisioning users. */
export const ROLES_PLATFORM_ADMIN_MAY_ASSIGN: UserRole[] = [UserRole.Admin];

/** Roles a tenant admin may assign to staff in their organization. */
export const ROLES_TENANT_ADMIN_MAY_ASSIGN: UserRole[] = [
  UserRole.Dispatcher,
  UserRole.VendorManager,
  UserRole.SupportAgent,
];

export function assignableRolesForManager(managerRoles: UserRole[]): UserRole[] {
  return isPlatformAdmin(managerRoles)
    ? ROLES_PLATFORM_ADMIN_MAY_ASSIGN
    : ROLES_TENANT_ADMIN_MAY_ASSIGN;
}

export function validateAssignableRoles(
  managerRoles: UserRole[],
  requestedRoles: UserRole[],
): { ok: true } | { ok: false; message: string } {
  if (requestedRoles.includes(UserRole.PlatformAdmin)) {
    return { ok: false, message: 'Platform admin role cannot be assigned here' };
  }

  const allowed = new Set(assignableRolesForManager(managerRoles));
  const invalid = requestedRoles.filter((role) => !allowed.has(role));
  if (invalid.length > 0) {
    return {
      ok: false,
      message: isPlatformAdmin(managerRoles)
        ? 'Platform admins may only assign the tenant admin role'
        : 'Tenant admins may only assign dispatcher, vendor manager, and support agent roles',
    };
  }

  return { ok: true };
}

/** Whether the acting admin may change roles for the target user. */
export function canManagerEditUserRoles(
  managerRoles: UserRole[],
  targetUserRoles: UserRole[],
): boolean {
  if (targetUserRoles.includes(UserRole.PlatformAdmin)) return false;
  if (isPlatformAdmin(managerRoles)) {
    return targetUserRoles.includes(UserRole.Admin);
  }
  return !targetUserRoles.includes(UserRole.Admin);
}
