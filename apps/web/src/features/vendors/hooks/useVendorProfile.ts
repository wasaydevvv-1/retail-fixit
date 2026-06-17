import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VendorProfileRequest } from '@retailfixit/shared';

import { getMyAssignedJobs, getMyAssignedJob, getMyVendorProfile, listVendors, saveMyVendorProfile } from '../api.js';

export const vendorQueryKeys = {
  me: ['vendors', 'me'] as const,
  list: (page: number) => ['vendors', 'list', page] as const,
  myJobs: (page: number) => ['vendors', 'my-jobs', page] as const,
  myJob: (id: string) => ['vendors', 'my-jobs', 'detail', id] as const,
};

export function useMyVendorProfile() {
  return useQuery({
    queryKey: vendorQueryKeys.me,
    queryFn: getMyVendorProfile,
  });
}

export function useVendorDirectory(page = 1) {
  return useQuery({
    queryKey: vendorQueryKeys.list(page),
    queryFn: () => listVendors(page),
  });
}

export function useMyAssignedJobs(page = 1) {
  return useQuery({
    queryKey: vendorQueryKeys.myJobs(page),
    queryFn: () => getMyAssignedJobs(page),
  });
}

export function useMyAssignedJob(id: string | undefined) {
  return useQuery({
    queryKey: vendorQueryKeys.myJob(id ?? ''),
    queryFn: () => getMyAssignedJob(id!),
    enabled: Boolean(id),
  });
}

export function useSaveVendorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: VendorProfileRequest) => saveMyVendorProfile(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}
