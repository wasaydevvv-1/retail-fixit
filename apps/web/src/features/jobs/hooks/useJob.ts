import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../lib/query-keys.js';
import { getJob } from '../api.js';

export function useJob(id: string | undefined, tenantId?: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(id ?? '', tenantId),
    queryFn: () => getJob(id!, tenantId),
    enabled: Boolean(id),
  });
}
