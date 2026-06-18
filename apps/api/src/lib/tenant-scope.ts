import { isBusinessTenant, isPlatformAdmin } from '@retailfixit/shared';

import { AppError } from '../middleware/error.js';
import type { AuthContext } from '../modules/auth/auth.types.js';

/** Resolve which tenant partition to query for tenant-scoped data. */
export function resolveDataTenantId(
  auth: AuthContext,
  requestedTenantId?: string,
): string {
  if (isPlatformAdmin(auth.roles)) {
    if (!requestedTenantId) {
      throw new AppError(
        400,
        'TENANT_REQUIRED',
        'Platform operators must select a business tenant',
      );
    }
    if (!isBusinessTenant(requestedTenantId)) {
      throw new AppError(400, 'INVALID_TENANT', 'Select a business tenant — not the platform tenant');
    }
    return requestedTenantId;
  }

  if (requestedTenantId && requestedTenantId !== auth.tenantId) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot access another tenant');
  }

  return auth.tenantId;
}
