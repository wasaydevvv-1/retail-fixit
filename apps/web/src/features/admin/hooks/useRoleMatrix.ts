import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RolePermissionMatrixResponse } from '@retailfixit/shared';

import { apiFetch } from '../../../lib/api-client.js';

export const roleMatrixQueryKey = ['rbac', 'matrix'] as const;

function matrixPath(tenantId?: string): string {
  return tenantId ? `/rbac/matrix?tenantId=${encodeURIComponent(tenantId)}` : '/rbac/matrix';
}

export function useRoleMatrix(tenantId?: string) {
  return useQuery({
    queryKey: [...roleMatrixQueryKey, tenantId ?? 'own'],
    queryFn: () => apiFetch<RolePermissionMatrixResponse>(matrixPath(tenantId)),
  });
}

export function useUpdateRoleMatrix(tenantId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (matrix: RolePermissionMatrixResponse['matrix']) =>
      apiFetch<RolePermissionMatrixResponse>(matrixPath(tenantId), {
        method: 'PUT',
        body: JSON.stringify({ matrix }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roleMatrixQueryKey });
    },
  });
}
