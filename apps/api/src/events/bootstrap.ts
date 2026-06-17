import { EventType } from '@retailfixit/shared';

import { getEventBus, initEventBus } from './event-bus-registry.js';
import type { EventHandler } from './event-bus.js';
import { instrumentEventHandler } from '../observability/instrument-event-handler.js';
import { onAIRecommendationRequested } from './handlers/on-ai-recommendation-requested.js';
import { onAIRecommendationGenerated } from './handlers/on-recommendation-generated.js';
import { onJobAssigned } from './handlers/on-job-assigned.js';
import { onJobCreated } from './handlers/on-job-created.js';

export async function bootstrapEventHandlers(): Promise<void> {
  await initEventBus();
  const bus = getEventBus();

  bus.subscribe(EventType.JobCreated, instrumentEventHandler(onJobCreated as EventHandler));
  bus.subscribe(
    EventType.AIRecommendationRequested,
    instrumentEventHandler(onAIRecommendationRequested as EventHandler),
  );
  bus.subscribe(
    EventType.AIRecommendationGenerated,
    instrumentEventHandler(onAIRecommendationGenerated as EventHandler),
  );
  bus.subscribe(EventType.JobAssigned, instrumentEventHandler(onJobAssigned as EventHandler));
}
