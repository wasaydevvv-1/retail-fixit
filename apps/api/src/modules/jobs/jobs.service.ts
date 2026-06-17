import type {
  CreateJobRequest,
  Job,
  JobDetailResponse,
  JobListQuery,
  JobListResponse,
} from '@retailfixit/shared';
import { AuditAction } from '@retailfixit/shared';

import {
  getCachedJobList,
  invalidateJobListCache,
  setCachedJobList,
} from '../../cache/job-list-cache.js';
import { publishJobCreated } from '../../events/publisher.js';
import type { AuthContext } from '../auth/auth.types.js';
import { recordAudit } from '../audit/audit.service.js';
import {
  createJobDocument,
  findJobById,
  listJobs,
} from './jobs.repository.js';
import { getAssignableVendorsForJob } from '../vendors/vendors.service.js';
import { findRecommendationByJobId } from '../ai/recommendations.repository.js';

export async function createJob(
  auth: AuthContext,
  body: CreateJobRequest,
  correlationId: string,
): Promise<Job> {
  const job = await createJobDocument(auth.tenantId, auth.userId, {
    title: body.title,
    rawDescription: body.rawDescription,
    customerName: body.customerName,
    location: body.location,
    priority: body.priority,
    requiredSkills: body.requiredSkills,
  });

  await recordAudit({
    tenantId: auth.tenantId,
    action: AuditAction.JobCreated,
    actorId: auth.userId,
    subject: `job:${job.id}`,
    metadata: { title: job.title, priority: job.priority, correlationId },
  });

  await publishJobCreated(auth.tenantId, correlationId, {
    jobId: job.id,
    title: job.title,
    rawDescription: job.rawDescription,
    requiredSkills: job.requiredSkills,
    location: job.location,
  });

  await invalidateJobListCache(auth.tenantId);
  return job;
}

export async function getJobList(
  auth: AuthContext,
  query: JobListQuery,
): Promise<JobListResponse> {
  const normalized = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
    status: query.status,
    priority: query.priority,
    search: query.search?.trim(),
  };

  const cached = await getCachedJobList(auth.tenantId, normalized);
  if (cached) return cached;

  const result = await listJobs(auth.tenantId, normalized);
  await setCachedJobList(auth.tenantId, normalized, result);
  return result;
}

export async function getJobDetail(
  auth: AuthContext,
  jobId: string,
): Promise<JobDetailResponse | null> {
  const job = await findJobById(auth.tenantId, jobId);
  if (!job) return null;

  const assignableVendors = await getAssignableVendorsForJob(
    auth.tenantId,
    job.requiredSkills ?? [],
  );

  const recommendation =
    (await findRecommendationByJobId(auth.tenantId, jobId)) ?? undefined;

  return {
    job,
    recommendation,
    assignableVendors,
  };
}
