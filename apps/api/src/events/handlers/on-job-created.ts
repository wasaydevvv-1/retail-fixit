import { EventType, JobStatus, type JobCreatedEvent } from '@retailfixit/shared';

import { invalidateJobListCache } from '../../cache/job-list-cache.js';
import { updateJobStatus } from '../../modules/jobs/jobs.repository.js';
import { logger } from '../../observability/logger.js';
import { broadcastJobStatusChanged } from '../../realtime/publisher.js';
import { publishAIRecommendationRequested } from '../publisher.js';

/** After a job is created, move it into the AI workflow. */
export async function onJobCreated(event: JobCreatedEvent): Promise<void> {
  const { tenantId, correlationId, payload } = event;

  await updateJobStatus(tenantId, payload.jobId, JobStatus.AwaitingRecommendation);
  await invalidateJobListCache(tenantId);
  await broadcastJobStatusChanged(tenantId, payload.jobId, JobStatus.AwaitingRecommendation);

  logger.info(
    { jobId: payload.jobId, correlationId },
    'JobCreated handled — requesting AI recommendation',
  );

  await publishAIRecommendationRequested(tenantId, correlationId, {
    jobId: payload.jobId,
  });
}
