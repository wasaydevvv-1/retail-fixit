import { homePathForPermissions } from '@retailfixit/shared';
import type { Permission, UserRole } from '@retailfixit/shared';

/** SPA default landing route from permissions granted to the user. */
export function homePathForUser(
  permissions: Permission[],
  roles: UserRole[],
  needsVendorProfile: boolean,
): string {
  return homePathForPermissions(permissions, roles, needsVendorProfile);
}
