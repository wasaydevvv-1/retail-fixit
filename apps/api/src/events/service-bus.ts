import {
  ServiceBusClient,
  type ServiceBusReceiver,
  type ServiceBusSender,
} from '@azure/service-bus';
import { EventType, type DomainEvent } from '@retailfixit/shared';

import { config } from '../config/index.js';
import { logger } from '../observability/logger.js';
import { assertValidEvent, parseInboundEvent } from './validate-event.js';
import type { EventBus, EventHandler } from './event-bus.js';
import { InMemoryEventBus } from './in-memory-bus.js';

/**
 * Azure Service Bus driver. Publishes to a queue; a receiver in the same
 * process dispatches to registered handlers (worker-in-API for now).
 */
export class ServiceBusEventBus implements EventBus {
  private client: ServiceBusClient;
  private sender: ServiceBusSender | null = null;
  private receiver: ServiceBusReceiver | null = null;
  private dispatcher = new InMemoryEventBus();

  constructor(private readonly queueName: string) {
    if (!config.events.serviceBusConnectionString) {
      throw new Error(
        'SERVICE_BUS_CONNECTION_STRING is required when EVENT_BUS_DRIVER=service-bus',
      );
    }
    this.client = new ServiceBusClient(config.events.serviceBusConnectionString);
  }

  subscribe(type: EventType, handler: EventHandler): void {
    this.dispatcher.subscribe(type, handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    if (!this.sender) {
      throw new Error('Service Bus sender not started');
    }

    assertValidEvent(event);

    await this.sender.sendMessages({
      body: event,
      contentType: 'application/json',
      messageId: event.id,
      correlationId: event.correlationId,
      applicationProperties: {
        eventType: event.type,
        tenantId: event.tenantId,
      },
    });

    logger.debug({ type: event.type, id: event.id, queue: this.queueName }, 'Event published to Service Bus');
  }

  async start(): Promise<void> {
    this.sender = this.client.createSender(this.queueName);
    this.receiver = this.client.createReceiver(this.queueName);

    this.receiver.subscribe(
      {
        processMessage: async (message) => {
          const event = parseInboundEvent(message.body);
          if (!event) {
            logger.warn({ messageId: message.messageId }, 'Invalid event message body — skipped');
            return;
          }
          logger.debug({ type: event.type, id: event.id }, 'Service Bus message received');
          await this.dispatcher.dispatch(event);
        },
        processError: async (args) => {
          logger.error({ err: args.error, entity: args.entityPath }, 'Service Bus receiver error');
        },
      },
      { autoCompleteMessages: true },
    );

    logger.info({ queue: this.queueName }, 'Azure Service Bus event bus started');
  }

  async stop(): Promise<void> {
    await this.receiver?.close();
    await this.sender?.close();
    await this.client.close();
    this.receiver = null;
    this.sender = null;
  }
}
