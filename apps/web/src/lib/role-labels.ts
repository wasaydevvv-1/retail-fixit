import { UserRole, type UserRole as UserRoleType } from '@retailfixit/shared';

const ROLE_LABELS: Record<UserRoleType, string> = {
  [UserRole.PlatformAdmin]: 'Platform Admin',
  [UserRole.Admin]: 'Tenant Administrator',
  [UserRole.Dispatcher]: 'Chief Dispatcher',
  [UserRole.VendorManager]: 'Vendor Manager',
  [UserRole.SupportAgent]: 'Support Agent',
};

export function primaryRoleLabel(roles: UserRoleType[]): string {
  if (roles.includes(UserRole.PlatformAdmin)) return ROLE_LABELS[UserRole.PlatformAdmin];
  if (roles.includes(UserRole.Admin)) return ROLE_LABELS[UserRole.Admin];
  if (roles.includes(UserRole.Dispatcher)) return ROLE_LABELS[UserRole.Dispatcher];
  if (roles.includes(UserRole.VendorManager)) return ROLE_LABELS[UserRole.VendorManager];
  if (roles.includes(UserRole.SupportAgent)) return ROLE_LABELS[UserRole.SupportAgent];
  return roles[0] ?? 'User';
}

export function portalSubtitle(roles: UserRoleType[]): string {
  if (roles.includes(UserRole.SupportAgent) && !roles.includes(UserRole.Admin)) {
    return 'SUPPORT AGENT PORTAL';
  }
  if (roles.includes(UserRole.VendorManager) && !roles.includes(UserRole.Admin)) {
    return 'VENDOR PORTAL';
  }
  return 'OPERATIONS PLATFORM';
}
