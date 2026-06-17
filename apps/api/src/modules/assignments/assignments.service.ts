import type { AssignJobResponse } from '@retailfixit/shared';
import {
  AssignmentDecisionSource,
  AuditAction,
  JobStatus,
  VendorStatus,
} from '@retailfixit/shared';

import { invalidateJobListCache } from '../../cache/job-list-cache.js';
import { invalidateVendorListCache } from '../../cache/vendor-list-cache.js';
import { publishJobAssigned } from '../../events/publisher.js';
import { AppError } from '../../middleware/error.js';
import type { AuthContext } from '../auth/auth.types.js';
import { recordAudit } from '../audit/audit.service.js';
import { findRecommendationByJobId } from '../ai/recommendations.repository.js';
import { incrementCounter } from '../../observability/metrics.js';
import { findJobById, updateJobAssignment } from '../jobs/jobs.repository.js';
import { adjustVendorActiveJobCount, findVendorById } from '../vendors/vendors.repository.js';
import { createAssignmentDocument } from './assignments.repository.js';

/** Statuses from which a job can still be (re)assigned. */
const ASSIGNABLE_STATUSES: JobStatus[] = [
  JobStatus.Created,
  JobStatus.AwaitingRecommendation,
  JobStatus.RecommendationReady,
  JobStatus.Escalated,
];

export async function assignVendorToJob(
  auth: AuthContext,
  jobId: string,
  vendorId: string,
  correlationId: string,
): Promise<AssignJobResponse> {
  const job = await findJobById(auth.tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
  }

  if (!ASSIGNABLE_STATUSES.includes(job.status)) {
    throw new AppError(
      409,
      'JOB_NOT_ASSIGNABLE',
      `Job cannot be assigned while in status "${job.status}"`,
    );
  }

  const vendor = await findVendorById(auth.tenantId, vendorId);
  if (!vendor) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  }
  if (vendor.status !== VendorStatus.Active) {
    throw new AppError(409, 'VENDOR_NOT_ACTIVE', 'Vendor is not active and cannot take jobs');
  }

  // Determine whether the dispatcher overrode the AI's top recommendation.
  const recommendation = await findRecommendationByJobId(auth.tenantId, jobId);
  const topCandidateId = recommendation?.candidates[0]?.vendorId;
  const overrodeAi = Boolean(topCandidateId && topCandidateId !== vendorId);

  const assignment = await createAssignmentDocument({
    tenantId: auth.tenantId,
    jobId,
    vendorId,
    decisionSource: AssignmentDecisionSource.Human,
    overrodeAi,
    assignedBy: auth.userId,
  });

  const updatedJob = await updateJobAssignment(
    auth.tenantId,
    jobId,
    vendorId,
    JobStatus.Assigned,
  );
  if (!updatedJob) {
    throw new AppError(500, 'ASSIGNMENT_FAILED', 'Failed to update job after assignment');
  }

  // If the job already had a different vendor, release that vendor's slot.
  if (job.assignedVendorId && job.assignedVendorId !== vendorId) {
    await adjustVendorActiveJobCount(auth.tenantId, job.assignedVendorId, -1);
  }
  await adjustVendorActiveJobCount(auth.tenantId, vendorId, 1);

  await recordAudit({
    tenantId: auth.tenantId,
    action: AuditAction.JobAssigned,
    actorId: auth.userId,
    subject: `job:${jobId}`,
    metadata: { vendorId, assignmentId: assignment.id, overrodeAi, correlationId },
  });

  if (overrodeAi) {
    incrementCounter('ai_override_total', { tenantId: auth.tenantId });
    await recordAudit({
      tenantId: auth.tenantId,
      action: AuditAction.AiRecommendationOverridden,
      actorId: auth.userId,
      subject: `job:${jobId}`,
      metadata: { chosenVendorId: vendorId, aiTopVendorId: topCandidateId, correlationId },
    });
  } else if (topCandidateId) {
    incrementCounter('ai_follow_total', { tenantId: auth.tenantId });
  }

  await publishJobAssigned(auth.tenantId, correlationId, {
    jobId,
    vendorId,
    assignmentId: assignment.id,
    overrodeAi,
  });

  await Promise.all([
    invalidateJobListCache(auth.tenantId),
    invalidateVendorListCache(auth.tenantId),
  ]);

  return { job: updatedJob, assignment };
}
