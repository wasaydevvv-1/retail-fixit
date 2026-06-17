import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateJobRequest, JobListResponse } from '@retailfixit/shared';
import { JobStatus } from '@retailfixit/shared';
import { useNavigate } from 'react-router-dom';

import { useToast } from '../../../components/ToastProvider.js';
import { useJobsBasePath } from '../../../lib/use-jobs-base-path.js';
import { queryKeys } from '../../../lib/query-keys.js';
import { createJob } from '../api.js';

export function useCreateJob() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const base = useJobsBasePath();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (body: CreateJobRequest) => createJob(body),
    onMutate: async (body) => {
      const listQueryKey = queryKeys.jobs.lists;
      await queryClient.cancelQueries({ queryKey: listQueryKey });

      const previousLists = queryClient.getQueriesData<JobListResponse>({
        queryKey: listQueryKey,
      });

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticJob = {
        id: optimisticId,
        tenantId: '',
        title: body.title,
        rawDescription: body.rawDescription,
        customerName: body.customerName,
        location: body.location,
        priority: body.priority,
        requiredSkills: body.requiredSkills,
        status: JobStatus.AwaitingRecommendation,
        createdBy: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      for (const [key, data] of previousLists) {
        if (!data?.items || !Array.isArray(data.items)) continue;
        const pageSize = data.pageSize ?? data.items.length;
        queryClient.setQueryData<JobListResponse>(key, {
          ...data,
          total: (data.total ?? 0) + 1,
          items: [optimisticJob, ...data.items].slice(0, pageSize),
        });
      }

      return { previousLists, optimisticId };
    },
    onError: (_err, _body, context) => {
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast('Failed to create job', 'error');
    },
    onSuccess: (job) => {
      toast('Job created — AI recommendation in progress', 'success');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      navigate(`${base}/jobs/${job.id}`);
    },
  });
}
