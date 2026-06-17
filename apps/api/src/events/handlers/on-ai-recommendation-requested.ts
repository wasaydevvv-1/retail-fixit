import type { AIRecommendationRequestedEvent } from '@retailfixit/shared';

import { generateRecommendation } from '../../modules/ai/ai.service.js';
import { logger } from '../../observability/logger.js';
import { publishAIRecommendationGenerated } from '../publisher.js';

/** Worker: generate AI recommendation and publish result event. */
export async function onAIRecommendationRequested(
  event: AIRecommendationRequestedEvent,
): Promise<void> {
  const { tenantId, correlationId, payload } = event;

  logger.info(
    { jobId: payload.jobId, correlationId, eventId: event.id },
    'AIRecommendationRequested — generating recommendation',
  );

  const recommendation = await generateRecommendation(tenantId, payload.jobId, correlationId);

  await publishAIRecommendationGenerated(tenantId, correlationId, {
    jobId: payload.jobId,
    recommendation,
  });

  logger.info(
    {
      jobId: payload.jobId,
      correlationId,
      candidateCount: recommendation.candidates.length,
      usedFallback: recommendation.usedFallback,
    },
    'AIRecommendationGenerated published',
  );
}
