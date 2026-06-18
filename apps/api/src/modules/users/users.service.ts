import type {
  CreateTenantUserRequest,
  CreateTenantUserResponse,
  LinkUserVendorRequest,
  TenantUserSummary,
  UpdateUserRolesRequest,
  UserAccount,
} from '@retailfixit/shared';
import { Permission, UserRole, hasPermission, isPlatformAdmin, isBusinessTenant, validateAssignableRoles, canManagerEditUserRoles } from '@retailfixit/shared';
import { PLATFORM_TENANT_ID } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { isEntraAuthEnabled, isEntraGraphEnabled } from '../../config/index.js';
import { AppError } from '../../middleware/error.js';
import type { AuthContext } from '../auth/auth.types.js';
import {
  findAdminByTenant,
  findUserByLoginOrEmail,
  findUserById,
  isPendingUserId,
  linkUserToVendor,
  listUsersByTenant,
  listAllUsers,
  upsertUser,
} from '../auth/users.repository.js';
import { findVendorById } from '../vendors/vendors.repository.js';
import { findTenantById } from '../tenants/tenants.repository.js';
import { getTenantRoleMatrix } from '../rbac/rbac.service.js';
import { createEntraUser } from '../graph/graph.service.js';
import { findEntraUserByUpn } from '../graph/graph.client.js';
import { syncEntraAppRoleAssignment } from '../graph/graph.app-roles.js';

const USER_ROLE_VALUES = Object.values(UserRole) as [UserRole, ...UserRole[]];

export const assignUserRolesSchema = z.object({
  roles: z.array(z.enum(USER_ROLE_VALUES)).min(1),
});

export const createTenantUserSchema = z
  .object({
    email: z.string().min(1).optional(),
    displayName: z.string().min(1).max(120),
    roles: z.array(z.enum(USER_ROLE_VALUES)).min(1),
    loginId: z.string().min(1).optional(),
    createInEntra: z.boolean().optional(),
    userName: z.string().min(1).max(64).optional(),
    password: z.string().min(8).max(128).optional(),
    tenantId: z.string().min(1).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.createInEntra && !body.userName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'userName is required when createInEntra is true',
        path: ['userName'],
      });
    }
    if (!body.createInEntra && !body.loginId && !body.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'loginId or email is required when not creating in Entra',
        path: ['loginId'],
      });
    }
  });

async function toTenantUserSummary(
  tenantId: string,
  user: Awaited<ReturnType<typeof listUsersByTenant>>[number],
): Promise<TenantUserSummary> {
  let vendorName: string | undefined;
  if (user.vendorId) {
    const vendor = await findVendorById(tenantId, user.vendorId);
    vendorName = vendor?.name;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    vendorId: user.vendorId,
    vendorName,
    status: isPendingUserId(user.id) ? 'pending' : 'active',
    tenantId,
    tenantName: (await findTenantById(tenantId))?.name,
  };
}

export async function listTenantUsers(
  auth: AuthContext,
  options?: { tenantId?: string; role?: UserRole },
): Promise<TenantUserSummary[]> {
  if (isPlatformAdmin(auth.roles)) {
    let users: Awaited<ReturnType<typeof listUsersByTenant>>;

    if (options?.tenantId) {
      if (!isBusinessTenant(options.tenantId)) {
        throw new AppError(400, 'INVALID_TENANT', 'Select a business tenant');
      }
      users = await listUsersByTenant(options.tenantId);
    } else {
      users = (await listAllUsers()).filter((user) => isBusinessTenant(user.tenantId));
    }

    if (options?.role) {
      users = users.filter((user) => user.roles.includes(options.role!));
    }

    return Promise.all(users.map((user) => toTenantUserSummary(user.tenantId, user)));
  }

  if (options?.tenantId && options.tenantId !== auth.tenantId) {
    throw new AppError(403, 'FORBIDDEN', 'Only platform admins can list users in other tenants');
  }

  let users = await listUsersByTenant(auth.tenantId);
  if (options?.role) {
    users = users.filter((user) => user.roles.includes(options.role!));
  }

  return Promise.all(users.map((user) => toTenantUserSummary(auth.tenantId, user)));
}

async function resolveEntraUserId(user: UserAccount): Promise<string | undefined> {
  if (user.entraObjectId) return user.entraObjectId;
  if (!isPendingUserId(user.id)) return user.id;
  if (user.loginId) {
    const entraUser = await findEntraUserByUpn(user.loginId);
    return entraUser?.id;
  }
  return undefined;
}

export async function adminCreateUser(
  auth: AuthContext,
  body: CreateTenantUserRequest,
): Promise<CreateTenantUserResponse> {
  const matrix = await getTenantRoleMatrix(auth.tenantId);
  if (!hasPermission(auth.roles, Permission.UsersManage, matrix)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to add users');
  }

  if (body.roles.includes(UserRole.PlatformAdmin)) {
    throw new AppError(403, 'FORBIDDEN', 'Platform admin accounts cannot be created from this form');
  }

  const roleCheck = validateAssignableRoles(auth.roles, body.roles);
  if (!roleCheck.ok) {
    throw new AppError(403, 'FORBIDDEN', roleCheck.message);
  }

  const platformOperator = isPlatformAdmin(auth.roles);
  let targetTenantId = auth.tenantId;

  if (platformOperator) {
    if (!body.tenantId) {
      throw new AppError(400, 'TENANT_REQUIRED', 'Platform admin must select a business tenant');
    }
    if (!isBusinessTenant(body.tenantId)) {
      throw new AppError(400, 'INVALID_TENANT', 'Select Acme or Beta — not the platform tenant');
    }
    targetTenantId = body.tenantId;
  } else if (body.tenantId && body.tenantId !== auth.tenantId) {
    throw new AppError(403, 'FORBIDDEN', 'Tenant admins can only create users in their own tenant');
  }

  const targetTenant = await findTenantById(targetTenantId);
  if (!targetTenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', `Tenant ${targetTenantId} does not exist`);
  }

  const displayName = body.displayName.trim();
  let loginId = '';
  let email = '';
  let entraObjectId: string | undefined;
  let temporaryPassword: string | undefined;
  let userPrincipalName: string | undefined;

  if (body.createInEntra) {
    if (!isEntraGraphEnabled()) {
      throw new AppError(
        503,
        'GRAPH_NOT_CONFIGURED',
        'Cannot create Entra users. Add AZURE_AD_CLIENT_SECRET and grant User.ReadWrite.All with admin consent.',
      );
    }

    const created = await createEntraUser({
      displayName,
      userName: body.userName!,
      password: body.password,
    });
    userPrincipalName = created.userPrincipalName;
    loginId = created.userPrincipalName.toLowerCase();
    email = (created.user.mail ?? created.userPrincipalName).toLowerCase();
    entraObjectId = created.user.id;
    temporaryPassword = created.temporaryPassword;
  } else {
    loginId = (body.loginId ?? body.email ?? '').trim().toLowerCase();
    email = (body.email ?? loginId).trim().toLowerCase();
    if (!loginId) {
      throw new AppError(400, 'INVALID_LOGIN', 'Microsoft sign-in id (UPN) is required');
    }
  }

  const existingLogin = await findUserByLoginOrEmail(targetTenantId, loginId);
  if (existingLogin) {
    throw new AppError(
      409,
      'USER_EMAIL_TAKEN',
      `A user with Microsoft sign-in ${loginId} already exists in this tenant`,
    );
  }

  const id = isEntraAuthEnabled() ? `pending_${uuid()}` : `user_${uuid()}`;

  let entraAssignmentWarning: string | undefined;
  let entraAssignedRole: string | undefined;
  const entraIdForAssignment = entraObjectId ?? (await findEntraUserByUpn(loginId))?.id;

  if (entraIdForAssignment && isEntraGraphEnabled()) {
    try {
      const assignment = await syncEntraAppRoleAssignment(entraIdForAssignment, body.roles, {
        freshPrincipal: Boolean(body.createInEntra),
      });
      entraAssignedRole = assignment.assignedRole;
      entraAssignmentWarning = assignment.warning;
    } catch (err) {
      entraAssignmentWarning =
        err instanceof AppError
          ? err.message
          : 'User was saved in RetailFixIt but Entra app role assignment failed.';
    }
  }

  const user = await upsertUser({
    id,
    tenantId: targetTenantId,
    email,
    loginId,
    displayName,
    roles: body.roles,
    entraObjectId,
  });

  const summary = await toTenantUserSummary(targetTenantId, user);
  return {
    ...summary,
    temporaryPassword,
    userPrincipalName,
    entraAssignedRole,
    entraAssignmentWarning,
  };
}

export async function adminLinkUserVendor(
  auth: AuthContext,
  userId: string,
  body: LinkUserVendorRequest,
): Promise<TenantUserSummary> {
  const user = await findUserById(userId);
  if (!user || user.tenantId !== auth.tenantId) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found in this tenant');
  }

  const vendor = await findVendorById(auth.tenantId, body.vendorId);
  if (!vendor) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  }

  const updated = await linkUserToVendor(auth.tenantId, userId, body.vendorId);
  if (!updated) {
    throw new AppError(500, 'LINK_FAILED', 'Failed to link user to vendor');
  }

  return toTenantUserSummary(auth.tenantId, updated);
}

export async function adminUpdateUserRoles(
  auth: AuthContext,
  userId: string,
  body: UpdateUserRolesRequest,
): Promise<TenantUserSummary> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.roles.includes(UserRole.PlatformAdmin)) {
    throw new AppError(403, 'FORBIDDEN', 'Platform admin roles cannot be modified');
  }

  if (body.roles.includes(UserRole.PlatformAdmin)) {
    throw new AppError(403, 'FORBIDDEN', 'Platform admin role cannot be assigned here');
  }

  if (!canManagerEditUserRoles(auth.roles, user.roles)) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot change roles for this user');
  }

  const roleCheck = validateAssignableRoles(auth.roles, body.roles);
  if (!roleCheck.ok) {
    throw new AppError(403, 'FORBIDDEN', roleCheck.message);
  }

  if (!isPlatformAdmin(auth.roles)) {
    if (user.tenantId !== auth.tenantId) {
      throw new AppError(403, 'FORBIDDEN', 'Tenant admins can only manage users in their own tenant');
    }
    if (!isBusinessTenant(user.tenantId)) {
      throw new AppError(403, 'FORBIDDEN', 'Tenant admins cannot manage platform operator accounts');
    }
  } else if (!isBusinessTenant(user.tenantId)) {
    throw new AppError(403, 'FORBIDDEN', 'Platform operator accounts are managed outside this screen');
  }

  const tenantId = user.tenantId;
  const matrix = await getTenantRoleMatrix(tenantId);
  const canManage = hasPermission(auth.roles, Permission.UsersManage, matrix);
  if (!canManage) {
    const existingAdmin = await findAdminByTenant(tenantId);
    const isSelfBootstrap = userId === auth.userId && !existingAdmin;
    if (!isSelfBootstrap || !body.roles.includes(UserRole.Admin)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to assign roles');
    }
  }

  const updated = await upsertUser({ ...user, roles: body.roles });

  const entraId = await resolveEntraUserId(user);
  if (entraId && isEntraGraphEnabled()) {
    try {
      await syncEntraAppRoleAssignment(entraId, body.roles);
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : 'Roles saved in RetailFixIt but Entra app role assignment failed.';
      throw new AppError(502, 'ENTRA_ROLE_SYNC_FAILED', message);
    }
  }

  return toTenantUserSummary(tenantId, updated);
}

export const linkUserVendorSchema = z.object({
  vendorId: z.string().min(1),
});
