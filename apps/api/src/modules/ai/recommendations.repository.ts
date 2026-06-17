import type { AIRecommendation } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { getContainer } from '../../db/client.js';
import type { AIRecommendationDocument } from '../../db/documents.js';

function toRecommendation(doc: AIRecommendationDocument): AIRecommendation {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    jobId: doc.jobId,
    candidates: doc.candidates,
    model: doc.model,
    latencyMs: doc.latencyMs,
    usedFallback: doc.usedFallback,
    createdAt: doc.createdAt,
  };
}

export async function saveRecommendation(recommendation: AIRecommendation): Promise<AIRecommendation> {
  const container = getContainer('aiRecommendations');
  const doc: AIRecommendationDocument = {
    ...recommendation,
    id: recommendation.id || `rec_${uuid()}`,
    type: 'aiRecommendation',
  };
  const { resource } = await container.items.upsert(doc);
  return toRecommendation(resource as unknown as AIRecommendationDocument);
}

export async function findRecommendationByJobId(
  tenantId: string,
  jobId: string,
): Promise<AIRecommendation | null> {
  const container = getContainer('aiRecommendations');
  const { resources } = await container.items
    .query<AIRecommendationDocument>({
      query:
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.jobId = @jobId AND c.type = @type',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@jobId', value: jobId },
        { name: '@type', value: 'aiRecommendation' },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toRecommendation(doc) : null;
}
