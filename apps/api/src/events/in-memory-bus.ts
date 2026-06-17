import type { DomainEvent, EventType } from '@retailfixit/shared';

import { logger } from '../observability/logger.js';
import { assertValidEvent } from './validate-event.js';
import type { EventBus, EventHandler } from './event-bus.js';

/**
 * In-process event bus for local development. Handlers run asynchronously
 * after publish returns so HTTP responses are not blocked.
 */
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<EventType, EventHandler[]>();

  subscribe(type: EventType, handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    assertValidEvent(event);
    const handlers = this.handlers.get(event.type) ?? [];
    if (handlers.length === 0) {
      logger.debug({ type: event.type, id: event.id }, 'No handlers for event');
      return;
    }

    for (const handler of handlers) {
      void handler(event).catch((err) => {
        logger.error({ err, type: event.type, id: event.id }, 'Event handler failed');
      });
    }
  }

  async start(): Promise<void> {
    logger.info('In-memory event bus started');
  }

  async stop(): Promise<void> {
    // no-op
  }

  /** Used by Service Bus driver to dispatch received messages. */
  async dispatch(event: DomainEvent): Promise<void> {
    const validated = assertValidEvent(event);
    const handlers = this.handlers.get(validated.type) ?? [];
    for (const handler of handlers) {
      await handler(validated);
    }
  }
}
