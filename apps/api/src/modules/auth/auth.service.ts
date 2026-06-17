import type { AuthUserResponse, UserAccount } from '@retailfixit/shared';
import { UserRole, permissionsForRoles, type Permission, isPlatformAdmin, PLATFORM_TENANT_ID } from '@retailfixit/shared';

import { config, isEntraAuthEnabled } from '../../config/index.js';
import { homePathForUser } from '../../lib/portal-paths.js';
import { AppError } from '../../middleware/error.js';
import { logger } from '../../observability/logger.js';
import { getTenantRoleMatrix } from '../rbac/rbac.service.js';
import { findVendorById, findVendorByManagedByUserId } from '../vendors/vendors.repository.js';
import { findTenantById } from '../tenants/tenants.repository.js';
import type { AuthContext, TokenClaims } from './auth.types.js';
import { findUserById, listUsersByTenant, upsertUser, deleteUser, findPendingUserByEntraIdAnyTenant, findPendingUserByLoginAnyTenant, findAdminByTenant } from './users.repository.js';
import { signDevToken, verifyAccessToken } from './token-verifier.js';

function toAuthContext(user: {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  roles: AuthContext['roles'];
  vendorId?: string;
  permissions: Permission[];
}): AuthContext {
  return {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    vendorId: user.vendorId,
    permissions: user.permissions,
  };
}

async function vendorProfileComplete(
  tenantId: string,
  user: UserAccount,
): Promise<boolean> {
  if (!user.roles.includes(UserRole.VendorManager)) return true;

  const vendor = user.vendorId
    ? await findVendorById(tenantId, user.vendorId)
    : await findVendorByManagedByUserId(tenantId, user.id);

  if (!vendor) return false;
  return vendor.skills.length > 0 && vendor.serviceAreas.length > 0 && vendor.name.length > 0;
}

/** Keeps profile fields in sync with Entra; roles are managed in-app via admin UI. */
async function syncExistingUser(dbUser: UserAccount, claims: TokenClaims): Promise<AuthContext> {
  const roles = dbUser.roles;
  const email = claims.email || dbUser.email;
  const displayName = claims.name || dbUser.displayName;

  if (email !== dbUser.email || displayName !== dbUser.displayName) {
    await upsertUser({
      id: dbUser.id,
      tenantId: dbUser.tenantId,
      email,
      displayName,
      roles,
      vendorId: dbUser.vendorId,
    });
  }

  return toAuthContext({
    ...dbUser,
    email,
    displayName,
    roles,
    vendorId: dbUser.vendorId,
    permissions: permissionsForRoles(roles, await getTenantRoleMatrix(dbUser.tenantId)),
  });
}

/** Activates an admin-invited user on first Microsoft sign-in (any tenant). */
async function activateInvitedUser(claims: TokenClaims): Promise<AuthContext | null> {
  const invited =
    (claims.sub ? await findPendingUserByEntraIdAnyTenant(claims.sub) : null) ??
    (claims.email ? await findPendingUserByLoginAnyTenant(claims.email.trim().toLowerCase()) : null);
  if (!invited) return null;

  const tenantId = invited.tenantId;

  // Remove pending doc before upsert — pending admin invites share the slot but use a different id.
  await deleteUser(invited.id, tenantId);

  const user = await upsertUser({
    id: claims.sub,
    tenantId,
    email: invited.email,
    loginId: invited.loginId ?? invited.email,
    displayName: claims.name || invited.displayName,
    roles: invited.roles,
    vendorId: invited.vendorId,
  });

  logger.info(
    { userId: user.id, tenantId, email: user.email, roles: user.roles },
    'Activated invited user on first Microsoft login',
  );

  return toAuthContext({
    ...user,
    permissions: permissionsForRoles(user.roles, await getTenantRoleMatrix(tenantId)),
  });
}

/** Creates a Cosmos user on first login when admin assigned an Entra app role. */
async function provisionEntraUser(claims: TokenClaims): Promise<AuthContext> {
  if (claims.roles.length === 0) {
    throw new AppError(
      403,
      'ACCESS_NOT_ASSIGNED',
      'No access assigned. Ask an administrator to invite you in RetailFixIt Users & access.',
    );
  }

  const tenantId = config.auth.defaultTenantId;
  const existing = await listUsersByTenant(tenantId);
  const roles =
    existing.length === 0 && !claims.roles.includes(UserRole.PlatformAdmin)
      ? [...new Set<UserRole>([UserRole.Admin, ...claims.roles])]
      : claims.roles;

  const resolvedTenantId = claims.roles.includes(UserRole.PlatformAdmin)
    ? PLATFORM_TENANT_ID
    : tenantId;

  const user = await upsertUser({
    id: claims.sub,
    tenantId: resolvedTenantId,
    email: claims.email,
    displayName: claims.name,
    roles,
  });

  logger.info(
    { userId: user.id, tenantId: user.tenantId, roles: user.roles },
    'Auto-provisioned user from Entra ID on first login',
  );

  return toAuthContext({
    ...user,
    vendorId: user.vendorId,
    permissions: permissionsForRoles(user.roles, await getTenantRoleMatrix(user.tenantId)),
  });
}

async function resolveUserFromClaims(claims: TokenClaims): Promise<AuthContext> {
  const dbUser = await findUserById(claims.sub);

  if (dbUser) {
    return syncExistingUser(dbUser, claims);
  }

  if (isEntraAuthEnabled()) {
    const activated = await activateInvitedUser(claims);
    if (activated) return activated;
    return provisionEntraUser(claims);
  }

  // Dev tokens can carry tenantId + roles directly when user doc is absent.
  if (claims.tenantId && claims.roles.length > 0) {
    const permissions = permissionsForRoles(
      claims.roles,
      await getTenantRoleMatrix(claims.tenantId),
    );
    return toAuthContext({
      id: claims.sub,
      tenantId: claims.tenantId,
      email: claims.email,
      displayName: claims.name,
      roles: claims.roles,
      permissions,
    });
  }

  throw new AppError(403, 'USER_NOT_PROVISIONED', 'User is not provisioned in RetailFixIt');
}

export async function authenticateBearerToken(
  authorizationHeader: string | undefined,
): Promise<AuthContext> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing access token');
  }

  const claims = await verifyAccessToken(token);
  const auth = await resolveUserFromClaims(claims);
  const dbUser = await findUserById(auth.userId);
  const matrix = await getTenantRoleMatrix(auth.tenantId);
  const permissions = permissionsForRoles(auth.roles, matrix);
  return { ...auth, vendorId: dbUser?.vendorId, permissions };
}

export async function toAuthUserResponse(auth: AuthContext): Promise<AuthUserResponse> {
  const tenant = await findTenantById(auth.tenantId);
  const dbUser = await findUserById(auth.userId);
  const vendorId = dbUser?.vendorId;
  const needsVendorProfile = dbUser
    ? !(await vendorProfileComplete(auth.tenantId, dbUser))
    : auth.roles.includes(UserRole.VendorManager);
  const existingAdmin = await findAdminByTenant(auth.tenantId);
  const canClaimAdmin =
    auth.tenantId !== PLATFORM_TENANT_ID &&
    !existingAdmin &&
    !auth.roles.includes(UserRole.Admin);

  const matrix = await getTenantRoleMatrix(auth.tenantId);

  return {
    id: auth.userId,
    tenantId: auth.tenantId,
    tenantName: tenant?.name ?? auth.tenantId,
    email: auth.email,
    displayName: auth.displayName,
    roles: auth.roles,
    permissions: permissionsForRoles(auth.roles, matrix),
    vendorId,
    needsVendorProfile,
    homePath: homePathForUser(
      permissionsForRoles(auth.roles, matrix),
      auth.roles,
      needsVendorProfile,
    ),
    canClaimAdmin,
    isPlatformAdmin: isPlatformAdmin(auth.roles),
  };
}

/** One-time bootstrap when a tenant has no administrator yet. */
export async function claimAdminSlot(auth: AuthContext): Promise<AuthUserResponse> {
  const existingAdmin = await findAdminByTenant(auth.tenantId);
  if (existingAdmin) {
    throw new AppError(
      403,
      'ADMIN_SLOT_TAKEN',
      `Only one administrator is allowed per tenant. Current admin: ${existingAdmin.displayName}.`,
    );
  }

  const dbUser = await findUserById(auth.userId);
  if (!dbUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const roles = [...new Set<UserRole>([UserRole.Admin, ...dbUser.roles])];
  await upsertUser({ ...dbUser, roles });

  return toAuthUserResponse({
    ...auth,
    roles,
    permissions: permissionsForRoles(roles, await getTenantRoleMatrix(auth.tenantId)),
  });
}

export async function createDevSession(userId: string): Promise<{ token: string; user: AuthUserResponse }> {
  if (isEntraAuthEnabled()) {
    throw new AppError(403, 'DEV_AUTH_DISABLED', 'Dev login is disabled when Entra ID is configured');
  }

  const dbUser = await findUserById(userId);
  if (!dbUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Unknown dev user id');
  }

  const token = signDevToken({
    sub: dbUser.id,
    email: dbUser.email,
    name: dbUser.displayName,
    roles: dbUser.roles,
    tenantId: dbUser.tenantId,
  });

  return { token, user: await toAuthUserResponse(toAuthContext({
    ...dbUser,
    permissions: permissionsForRoles(dbUser.roles, await getTenantRoleMatrix(dbUser.tenantId)),
  })) };
}
