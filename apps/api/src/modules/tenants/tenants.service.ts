import type { CreateTenantRequest, Tenant } from '@retailfixit/shared';
import { Permission, hasPermission, isBusinessTenant, isPlatformAdmin } from '@retailfixit/shared';

import { AppError } from '../../middleware/error.js';
import type { AuthContext } from '../auth/auth.types.js';
import { getTenantRoleMatrix } from '../rbac/rbac.service.js';
import { createTenantDocument, findTenantById, listTenants } from './tenants.repository.js';

export async function getAllTenants(): Promise<Tenant[]> {
  return listTenants();
}

/** Stable id prefix for business tenants, e.g. "Gamma Retail" → tenant_gamma_retail. */
export function slugifyTenantId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return `tenant_${slug || 'new'}`;
}

async function uniqueTenantId(baseName: string): Promise<string> {
  let candidate = slugifyTenantId(baseName);
  let suffix = 2;

  while (await findTenantById(candidate)) {
    candidate = `${slugifyTenantId(baseName)}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function adminCreateTenant(
  auth: AuthContext,
  body: CreateTenantRequest,
): Promise<Tenant> {
  const matrix = await getTenantRoleMatrix(auth.tenantId);
  if (!hasPermission(auth.roles, Permission.TenantsManage, matrix)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to create tenants');
  }

  if (!isPlatformAdmin(auth.roles)) {
    throw new AppError(403, 'FORBIDDEN', 'Only platform admins can create business tenants');
  }

  const name = body.name.trim();
  const id = await uniqueTenantId(name);

  if (!isBusinessTenant(id)) {
    throw new AppError(400, 'INVALID_TENANT_ID', 'Generated tenant id is not allowed');
  }

  return createTenantDocument(id, name);
}
