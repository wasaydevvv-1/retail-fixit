import type { Tenant } from '@retailfixit/shared';

import { getContainer } from '../../db/client.js';
import type { TenantDocument } from '../../db/documents.js';

function toTenant(doc: TenantDocument): Tenant {
  return {
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt,
  };
}

export async function listTenants(): Promise<Tenant[]> {
  const container = getContainer('tenants');
  const { resources } = await container.items
    .query<TenantDocument>({
      query: 'SELECT * FROM c WHERE c.type = @type ORDER BY c.name',
      parameters: [{ name: '@type', value: 'tenant' }],
    })
    .fetchAll();

  return resources.map(toTenant);
}

export async function findTenantById(tenantId: string): Promise<Tenant | null> {
  const container = getContainer('tenants');
  try {
    const { resource } = await container.item(tenantId, tenantId).read<TenantDocument>();
    return resource ? toTenant(resource) : null;
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 404) {
      return null;
    }
    throw err;
  }
}
