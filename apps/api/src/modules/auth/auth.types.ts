import type { Permission, UserRole } from '@retailfixit/shared';

/** Authenticated identity attached to every protected request. */
export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  vendorId?: string;
  /** Resolved from tenant role matrix — used by permission guards. */
  permissions: Permission[];
}

/** Claims extracted from a validated JWT before user lookup. */
export interface TokenClaims {
  sub: string;
  email: string;
  name: string;
  roles: UserRole[];
  tenantId?: string;
}
