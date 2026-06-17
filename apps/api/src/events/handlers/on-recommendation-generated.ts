import { JobStatus, type AIRecommendationGeneratedEvent } from '@retailfixit/shared';

import { invalidateJobListCache } from '../../cache/job-list-cache.js';
import { updateJobStatus } from '../../modules/jobs/jobs.repository.js';
import { logger } from '../../observability/logger.js';
import { broadcastRecommendationReady } from '../../realtime/publisher.js';

/** After recommendation is stored, advance the job for dispatcher review. */
export async function onAIRecommendationGenerated(
  event: AIRecommendationGeneratedEvent,
): Promise<void> {
  const { tenantId, payload, correlationId } = event;

  await updateJobStatus(tenantId, payload.jobId, JobStatus.RecommendationReady);
  await invalidateJobListCache(tenantId);
  await broadcastRecommendationReady(tenantId, payload.jobId, JobStatus.RecommendationReady);

  logger.info(
    { jobId: payload.jobId, correlationId, status: JobStatus.RecommendationReady },
    'Job ready for dispatcher review',
  );
}
