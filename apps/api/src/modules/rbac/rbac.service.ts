import {
  ALL_PERMISSIONS,
  Permission,
  UserRole,
  isBusinessTenant,
  isPlatformAdmin,
  resolveRoleMatrix,
  type RolePermissionMatrix,
  type UpdateRolePermissionMatrixRequest,
} from '@retailfixit/shared';
import { z } from 'zod';

import { AppError } from '../../middleware/error.js';
import type { AuthContext } from '../auth/auth.types.js';
import { getTenantRolePermissions, saveTenantRolePermissions } from './rbac.repository.js';

const matrixCache = new Map<string, RolePermissionMatrix>();

export async function getTenantRoleMatrix(tenantId: string): Promise<RolePermissionMatrix> {
  const cached = matrixCache.get(tenantId);
  if (cached) return cached;

  const overrides = await getTenantRolePermissions(tenantId);
  const matrix = resolveRoleMatrix(overrides);
  matrixCache.set(tenantId, matrix);
  return matrix;
}

export function invalidateTenantRoleMatrix(tenantId: string): void {
  matrixCache.delete(tenantId);
}

/** Tenant admins use their own tenant; platform admins target a business tenant. */
function resolveMatrixTenantId(auth: AuthContext, requestedTenantId?: string): string {
  if (!isPlatformAdmin(auth.roles)) {
    return auth.tenantId;
  }

  const tenantId = requestedTenantId ?? 'tenant_acme';
  if (!isBusinessTenant(tenantId)) {
    throw new AppError(400, 'INVALID_TENANT', 'Select Acme or Beta — not the platform tenant');
  }
  return tenantId;
}

export async function getRolePermissionMatrix(
  auth: AuthContext,
  requestedTenantId?: string,
): Promise<{ matrix: RolePermissionMatrix; tenantId: string }> {
  const tenantId = resolveMatrixTenantId(auth, requestedTenantId);
  const matrix = await getTenantRoleMatrix(tenantId);
  return { matrix, tenantId };
}

const permissionEnum = z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]]);
const roleEnum = z.enum(Object.values(UserRole) as [UserRole, ...UserRole[]]);

export const updateRoleMatrixSchema = z.object({
  matrix: z.record(roleEnum, z.array(permissionEnum)),
});

export async function updateRolePermissionMatrix(
  auth: AuthContext,
  body: UpdateRolePermissionMatrixRequest,
  requestedTenantId?: string,
): Promise<{ matrix: RolePermissionMatrix; tenantId: string }> {
  const tenantId = resolveMatrixTenantId(auth, requestedTenantId);
  const overrides: Partial<Record<UserRole, Permission[]>> = {};

  for (const role of Object.values(UserRole)) {
    if (role === UserRole.Admin || role === UserRole.PlatformAdmin) continue;
    const permissions = body.matrix[role];
    if (permissions) overrides[role] = permissions;
  }

  const matrix = await saveTenantRolePermissions(tenantId, overrides);
  invalidateTenantRoleMatrix(tenantId);
  return { matrix, tenantId };
}
