import { useQuery } from '@tanstack/react-query';
import type { Tenant } from '@retailfixit/shared';

import { apiFetch } from '../../../lib/api-client.js';

export function useTenants(enabled = true) {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<Tenant[]>('/tenants'),
    enabled,
  });
}
