import { UserRole } from '../enums/index.js';
import { Permission, type Permission as PermissionType } from '../rbac/index.js';

/** Default landing route from resolved permissions (not role names). */
export function homePathForPermissions(
  permissions: PermissionType[],
  roles: UserRole[],
  needsVendorProfile: boolean,
): string {
  if (roles.includes(UserRole.PlatformAdmin)) return '/admin/tenants';
  if (permissions.includes(Permission.UsersManage)) return '/admin';
  if (roles.includes(UserRole.VendorManager) && needsVendorProfile) return '/vendor/profile';
  if (
    permissions.includes(Permission.JobsCreate) ||
    permissions.includes(Permission.JobsAssign)
  ) {
    return '/dispatch/jobs';
  }
  if (permissions.includes(Permission.UsersRead)) return '/admin/users';
  if (roles.includes(UserRole.VendorManager) && permissions.includes(Permission.VendorsRead)) {
    return '/vendor/jobs';
  }
  if (permissions.includes(Permission.JobsRead)) return '/support/jobs';
  if (permissions.includes(Permission.VendorsRead)) return '/vendor/directory';
  return '/dispatch/jobs';
}
