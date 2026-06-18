import type { Job, JobListQuery, JobListResponse, Vendor, VendorListQuery, VendorListResponse, VendorProfileRequest, VendorRatingRequest } from '@retailfixit/shared';

import { apiFetch } from '../../lib/api-client.js';

function vendorQueryString(query: VendorListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.tenantId) params.set('tenantId', query.tenantId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function getMyVendorProfile(): Promise<Vendor | null> {
  return apiFetch<Vendor | null>('/vendors/me');
}

export function saveMyVendorProfile(body: VendorProfileRequest): Promise<Vendor> {
  return apiFetch<Vendor>('/vendors/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function listVendors(query: VendorListQuery = {}): Promise<VendorListResponse> {
  return apiFetch<VendorListResponse>(`/vendors${vendorQueryString({ pageSize: 20, ...query })}`);
}

export function updateVendorRating(vendorId: string, body: VendorRatingRequest): Promise<Vendor> {
  return apiFetch<Vendor>(`/vendors/${vendorId}/rating`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function getMyAssignedJobs(page = 1): Promise<JobListResponse> {
  return apiFetch<JobListResponse>(`/vendors/me/jobs?page=${page}&pageSize=20`);
}

export function getMyAssignedJob(id: string): Promise<Job> {
  return apiFetch<Job>(`/vendors/me/jobs/${id}`);
}
