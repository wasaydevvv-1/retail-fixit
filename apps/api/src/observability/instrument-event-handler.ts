import type { DomainEvent } from '@retailfixit/shared';

import type { EventHandler } from '../events/event-bus.js';
import { logger } from './logger.js';
import { incrementCounter, recordMetric } from './metrics.js';

function eventPublishLagMs(event: DomainEvent): number {
  const publishedAt = Date.parse(event.occurredAt);
  if (!Number.isFinite(publishedAt)) return 0;
  return Math.max(0, Date.now() - publishedAt);
}

export function instrumentEventHandler(handler: EventHandler): EventHandler {
  return async (event: DomainEvent) => {
    const tags = { type: event.type, tenantId: event.tenantId };
    const publishLagMs = eventPublishLagMs(event);
    recordMetric('event_publish_lag_ms', publishLagMs, tags);

    const started = Date.now();
    try {
      await handler(event);
      recordMetric('event_handler_duration_ms', Date.now() - started, tags);
      incrementCounter('event_handler_success_total', tags);
    } catch (err) {
      incrementCounter('event_handler_error_total', tags);
      logger.error(
        { err, type: event.type, eventId: event.id, correlationId: event.correlationId },
        'Event handler failed',
      );
      throw err;
    }
  };
}
