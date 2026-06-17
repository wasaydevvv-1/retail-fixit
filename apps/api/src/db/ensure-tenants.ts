import { getContainer } from './client.js';
import type { TenantDocument } from './documents.js';
import { logger } from '../observability/logger.js';

/** Demo / assessment tenants — partition isolation is enforced by tenantId on every entity. */
export const DEMO_TENANTS = [
  { id: 'tenant_platform', name: 'RetailFixIt Platform' },
  { id: 'tenant_acme', name: 'Acme Retail' },
  { id: 'tenant_beta', name: 'Beta Retail Co' },
] as const;

/** Ensures business tenant documents exist in Cosmos (no users seeded here). */
export async function ensureTenants(): Promise<void> {
  const tenants = getContainer('tenants');

  for (const tenant of DEMO_TENANTS) {
    const doc: TenantDocument = {
      id: tenant.id,
      type: 'tenant',
      name: tenant.name,
      createdAt: new Date().toISOString(),
    };
    await tenants.items.upsert(doc);
    logger.info({ tenantId: tenant.id, name: tenant.name }, 'Tenant ready');
  }
}
