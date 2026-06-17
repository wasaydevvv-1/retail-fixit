import { config } from '../config/index.js';
import type { EventBus } from './event-bus.js';
import { InMemoryEventBus } from './in-memory-bus.js';
import { ServiceBusEventBus } from './service-bus.js';

let bus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!bus) {
    throw new Error('Event bus not initialized. Call initEventBus() during startup.');
  }
  return bus;
}

export async function initEventBus(): Promise<EventBus> {
  if (bus) return bus;

  if (config.events.driver === 'service-bus') {
    bus = new ServiceBusEventBus(config.events.serviceBusQueueName);
  } else {
    bus = new InMemoryEventBus();
  }

  await bus.start();
  return bus;
}

export async function stopEventBus(): Promise<void> {
  if (bus) {
    await bus.stop();
    bus = null;
  }
}
