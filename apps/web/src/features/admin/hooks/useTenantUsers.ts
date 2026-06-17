import { useQuery } from '@tanstack/react-query';
import type { TenantUserSummary } from '@retailfixit/shared';

import { apiFetch } from '../../../lib/api-client.js';

export function useTenantUsers(tenantId?: string) {
  return useQuery({
    queryKey: ['users', 'tenant', tenantId ?? 'self'],
    queryFn: () =>
      apiFetch<TenantUserSummary[]>(
        tenantId ? `/users?tenantId=${encodeURIComponent(tenantId)}` : '/users',
      ),
  });
}
