import {
  UserRole,
  resolveRoleMatrix,
  type Permission,
  type RolePermissionMatrix,
} from '@retailfixit/shared';

import { getContainer } from '../../db/client.js';
import type { TenantDocument } from '../../db/documents.js';

export async function getTenantRolePermissions(
  tenantId: string,
): Promise<Partial<Record<UserRole, Permission[]>> | undefined> {
  const container = getContainer('tenants');
  try {
    const { resource } = await container.item(tenantId, tenantId).read<TenantDocument>();
    return resource?.rolePermissions;
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 404) {
      return undefined;
    }
    throw err;
  }
}

export async function saveTenantRolePermissions(
  tenantId: string,
  overrides: Partial<Record<UserRole, Permission[]>>,
): Promise<RolePermissionMatrix> {
  const container = getContainer('tenants');
  const { resource } = await container.item(tenantId, tenantId).read<TenantDocument>();

  if (!resource) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const rolePermissions: Partial<Record<UserRole, Permission[]>> = {};
  for (const role of Object.values(UserRole)) {
    if (role === UserRole.Admin) continue;
    const custom = overrides[role];
    if (custom) rolePermissions[role] = [...custom];
  }

  const doc: TenantDocument = { ...resource, rolePermissions };
  await container.items.upsert(doc);
  return resolveRoleMatrix(rolePermissions);
}
