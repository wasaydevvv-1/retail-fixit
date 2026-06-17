import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssignJobRequest, JobDetailResponse } from '@retailfixit/shared';
import { JobStatus } from '@retailfixit/shared';

import { queryKeys } from '../../../lib/query-keys.js';
import { assignJob } from '../api.js';

export function useAssignJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AssignJobRequest) => assignJob(jobId, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.jobs.detail(jobId) });

      const previous = queryClient.getQueryData<JobDetailResponse>(queryKeys.jobs.detail(jobId));

      if (previous) {
        queryClient.setQueryData<JobDetailResponse>(queryKeys.jobs.detail(jobId), {
          ...previous,
          job: {
            ...previous.job,
            status: JobStatus.Assigned,
            assignedVendorId: body.vendorId,
          },
        });
      }

      return { previous };
    },
    onError: (_err, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.jobs.detail(jobId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}
