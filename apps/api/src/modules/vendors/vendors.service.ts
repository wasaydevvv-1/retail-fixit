import type {
  CreateVendorRequest,
  Job,
  JobListQuery,
  JobListResponse,
  Vendor,
  VendorListQuery,
  VendorListResponse,
  VendorProfileRequest,
} from '@retailfixit/shared';
import { UserRole } from '@retailfixit/shared';

import {
  getCachedVendorList,
  invalidateVendorListCache,
  setCachedVendorList,
} from '../../cache/vendor-list-cache.js';
import { AppError } from '../../middleware/error.js';
import type { AuthContext } from '../auth/auth.types.js';
import { linkUserToVendor } from '../auth/users.repository.js';
import { findJobById, listJobsByAssignedVendor } from '../jobs/jobs.repository.js';
import {
  createVendorDocument,
  findAssignableVendors,
  findVendorById,
  findVendorByManagedByUserId,
  listVendors,
  updateVendorDocument,
} from './vendors.repository.js';

export async function createVendor(
  auth: AuthContext,
  body: CreateVendorRequest,
): Promise<Vendor> {
  const vendor = await createVendorDocument(auth.tenantId, {
    name: body.name,
    skills: body.skills,
    serviceAreas: body.serviceAreas,
    rating: body.rating ?? 0,
  });

  await invalidateVendorListCache(auth.tenantId);
  return vendor;
}

export async function getVendorList(
  auth: AuthContext,
  query: VendorListQuery,
): Promise<VendorListResponse> {
  const normalized = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    status: query.status,
    search: query.search?.trim(),
    skills: query.skills,
  };

  const cached = await getCachedVendorList(auth.tenantId, normalized);
  if (cached) return cached;

  const result = await listVendors(auth.tenantId, normalized);
  await setCachedVendorList(auth.tenantId, normalized, result);
  return result;
}

export async function getVendorById(
  auth: AuthContext,
  vendorId: string,
): Promise<Vendor | null> {
  return findVendorById(auth.tenantId, vendorId);
}

export async function getAssignableVendorsForJob(
  tenantId: string,
  requiredSkills: string[],
): Promise<Vendor[]> {
  return findAssignableVendors(tenantId, requiredSkills);
}

/** Vendor manager creates or updates their linked company profile. */
export async function upsertMyVendorProfile(
  auth: AuthContext,
  body: VendorProfileRequest,
): Promise<Vendor> {
  if (!auth.roles.includes(UserRole.VendorManager)) {
    throw new AppError(403, 'FORBIDDEN', 'Only vendor managers can update vendor profiles');
  }

  const existing =
    (auth.vendorId ? await findVendorById(auth.tenantId, auth.vendorId) : null) ??
    (await findVendorByManagedByUserId(auth.tenantId, auth.userId));

  let vendor: Vendor;
  if (existing) {
    const updated = await updateVendorDocument(auth.tenantId, existing.id, {
      name: body.name,
      skills: body.skills,
      serviceAreas: body.serviceAreas,
      managedByUserId: auth.userId,
    });
    if (!updated) {
      throw new AppError(500, 'VENDOR_UPDATE_FAILED', 'Failed to update vendor profile');
    }
    vendor = updated;
  } else {
    vendor = await createVendorDocument(auth.tenantId, {
      name: body.name,
      skills: body.skills,
      serviceAreas: body.serviceAreas,
      rating: 0,
      managedByUserId: auth.userId,
    });
  }

  await linkUserToVendor(auth.tenantId, auth.userId, vendor.id);
  await invalidateVendorListCache(auth.tenantId);
  return vendor;
}

export async function getMyVendorProfile(auth: AuthContext): Promise<Vendor | null> {
  if (auth.vendorId) {
    return findVendorById(auth.tenantId, auth.vendorId);
  }
  return findVendorByManagedByUserId(auth.tenantId, auth.userId);
}

async function resolveMyVendorId(auth: AuthContext): Promise<string> {
  const vendor = await getMyVendorProfile(auth);
  if (!vendor) {
    throw new AppError(
      404,
      'VENDOR_PROFILE_MISSING',
      'Complete your company profile before viewing assigned jobs',
    );
  }
  return vendor.id;
}

/** Jobs assigned to the vendor manager's linked company. */
export async function getMyAssignedJobs(
  auth: AuthContext,
  query: JobListQuery,
): Promise<JobListResponse> {
  if (!auth.roles.includes(UserRole.VendorManager)) {
    throw new AppError(403, 'FORBIDDEN', 'Only vendor managers can view assigned jobs');
  }

  const vendorId = await resolveMyVendorId(auth);
  return listJobsByAssignedVendor(auth.tenantId, vendorId, {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  });
}

/** Single assigned job — only if it belongs to this vendor company. */
export async function getMyAssignedJobDetail(
  auth: AuthContext,
  jobId: string,
): Promise<Job | null> {
  if (!auth.roles.includes(UserRole.VendorManager)) {
    throw new AppError(403, 'FORBIDDEN', 'Only vendor managers can view assigned jobs');
  }

  const vendorId = await resolveMyVendorId(auth);
  const job = await findJobById(auth.tenantId, jobId);
  if (!job || job.assignedVendorId !== vendorId) return null;
  return job;
}

/** Support / operations staff set vendor quality scores (not editable by vendors). */
export async function updateVendorRating(
  auth: AuthContext,
  vendorId: string,
  rating: number,
): Promise<Vendor> {
  const vendor = await findVendorById(auth.tenantId, vendorId);
  if (!vendor) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  }

  const updated = await updateVendorDocument(auth.tenantId, vendorId, { rating });
  if (!updated) {
    throw new AppError(500, 'VENDOR_UPDATE_FAILED', 'Failed to update vendor rating');
  }

  await invalidateVendorListCache(auth.tenantId);
  return updated;
}
