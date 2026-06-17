import type { Tenant } from '@retailfixit/shared';

import { listTenants } from './tenants.repository.js';

export async function getAllTenants(): Promise<Tenant[]> {
  return listTenants();
}
