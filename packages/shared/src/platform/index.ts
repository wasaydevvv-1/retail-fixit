import { UserRole, type UserRole as UserRoleType } from '../enums/index.js';

export const PLATFORM_TENANT_ID = 'tenant_platform';

export function isPlatformAdmin(roles: UserRoleType[]): boolean {
  return roles.includes(UserRole.PlatformAdmin);
}

export function isBusinessTenant(tenantId: string): boolean {
  return tenantId !== PLATFORM_TENANT_ID;
}
