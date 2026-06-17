import { tryParseDomainEvent, type DomainEvent } from '@retailfixit/shared';

import { logger } from '../observability/logger.js';

/** Validate inbound bus messages before dispatching to handlers. */
export function parseInboundEvent(body: unknown): DomainEvent | null {
  const event = tryParseDomainEvent(body);
  if (!event) {
    logger.warn({ bodyType: typeof body }, 'Rejected invalid domain event message');
    return null;
  }
  return event;
}

/** Validate outbound events before publish (fail fast in development). */
export function assertValidEvent(event: DomainEvent): DomainEvent {
  const parsed = tryParseDomainEvent(event);
  if (!parsed) {
    throw new Error(`Invalid outbound event: ${event.type}`);
  }
  return parsed;
}
