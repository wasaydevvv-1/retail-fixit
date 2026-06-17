import { useQuery } from '@tanstack/react-query';
import type { JobListQuery } from '@retailfixit/shared';

import { queryKeys } from '../../../lib/query-keys.js';
import { listJobs } from '../api.js';

export function useJobs(filters: JobListQuery) {
  return useQuery({
    queryKey: queryKeys.jobs.list(filters),
    queryFn: () => listJobs(filters),
  });
}
