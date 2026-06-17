import type { DomainEvent, EventType } from '@retailfixit/shared';

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(type: EventType, handler: EventHandler): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
