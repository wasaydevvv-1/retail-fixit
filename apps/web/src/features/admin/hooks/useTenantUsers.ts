import { useQuery } from '@tanstack/react-query';
import type { TenantUserSummary, UserRole } from '@retailfixit/shared';

import { apiFetch } from '../../../lib/api-client.js';

export function useTenantUsers(options?: { tenantId?: string; role?: UserRole }) {
  const params = new URLSearchParams();
  if (options?.tenantId) params.set('tenantId', options.tenantId);
  if (options?.role) params.set('role', options.role);
  const qs = params.toString();

  return useQuery({
    queryKey: ['users', 'tenant', options?.tenantId ?? 'all', options?.role ?? 'all'],
    queryFn: () =>
      apiFetch<TenantUserSummary[]>(`/users${qs ? `?${qs}` : ''}`),
  });
}
