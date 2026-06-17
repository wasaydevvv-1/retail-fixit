import type {
  AssignJobRequest,
  AssignJobResponse,
  CreateJobRequest,
  Job,
  JobDetailResponse,
  JobListQuery,
  JobListResponse,
} from '@retailfixit/shared';

import { apiFetch } from '../../lib/api-client.js';

function toQueryString(query: JobListQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  if (query.search) params.set('search', query.search);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listJobs(query: JobListQuery = {}): Promise<JobListResponse> {
  return apiFetch<JobListResponse>(`/jobs${toQueryString(query)}`);
}

export function getJob(id: string): Promise<JobDetailResponse> {
  return apiFetch<JobDetailResponse>(`/jobs/${id}`);
}

export function createJob(body: CreateJobRequest): Promise<Job> {
  return apiFetch<Job>('/jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function assignJob(id: string, body: AssignJobRequest): Promise<AssignJobResponse> {
  return apiFetch<AssignJobResponse>(`/jobs/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
