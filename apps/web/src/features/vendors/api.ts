import type { Job, JobListResponse, Vendor, VendorListResponse, VendorProfileRequest, VendorRatingRequest } from '@retailfixit/shared';

import { apiFetch } from '../../lib/api-client.js';

export function getMyVendorProfile(): Promise<Vendor | null> {
  return apiFetch<Vendor | null>('/vendors/me');
}

export function saveMyVendorProfile(body: VendorProfileRequest): Promise<Vendor> {
  return apiFetch<Vendor>('/vendors/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function listVendors(page = 1): Promise<VendorListResponse> {
  return apiFetch<VendorListResponse>(`/vendors?page=${page}&pageSize=20`);
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
