import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../lib/query-keys.js';
import { getJob } from '../api.js';

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(id ?? ''),
    queryFn: () => getJob(id!),
    enabled: Boolean(id),
  });
}
