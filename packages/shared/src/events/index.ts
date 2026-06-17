/**
 * Event contracts for the event-driven dispatch workflow.
 *
 * These are the JSON message schemas that travel over the event backbone
 * (Azure Service Bus in production, in-memory bus locally). Both the API
 * publishers and the worker handlers import from here so the contract is shared.
 */

import type { AIRecommendation } from '../domain/index.js';

export const EventType = {
  JobCreated: 'JobCreated',
  AIRecommendationRequested: 'AIRecommendationRequested',
  AIRecommendationGenerated: 'AIRecommendationGenerated',
  JobAssigned: 'JobAssigned',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

/** Envelope wrapping every message for tracing and multi-tenant routing. */
export interface EventEnvelope<TType extends EventType, TPayload> {
  /** Unique message id (idempotency key for consumers). */
  id: string;
  type: TType;
  /** Tenant the event belongs to. */
  tenantId: string;
  /** Correlation id linking all events in one workflow run. */
  correlationId: string;
  /** ISO timestamp when the event was published. */
  occurredAt: string;
  payload: TPayload;
}

export interface JobCreatedPayload {
  jobId: string;
  title: string;
  rawDescription: string;
  requiredSkills: string[];
  location: string;
}

export interface AIRecommendationRequestedPayload {
  jobId: string;
}

export interface AIRecommendationGeneratedPayload {
  jobId: string;
  recommendation: AIRecommendation;
}

export interface JobAssignedPayload {
  jobId: string;
  vendorId: string;
  assignmentId: string;
  overrodeAi: boolean;
}

export type JobCreatedEvent = EventEnvelope<
  typeof EventType.JobCreated,
  JobCreatedPayload
>;
export type AIRecommendationRequestedEvent = EventEnvelope<
  typeof EventType.AIRecommendationRequested,
  AIRecommendationRequestedPayload
>;
export type AIRecommendationGeneratedEvent = EventEnvelope<
  typeof EventType.AIRecommendationGenerated,
  AIRecommendationGeneratedPayload
>;
export type JobAssignedEvent = EventEnvelope<
  typeof EventType.JobAssigned,
  JobAssignedPayload
>;

export type DomainEvent =
  | JobCreatedEvent
  | AIRecommendationRequestedEvent
  | AIRecommendationGeneratedEvent
  | JobAssignedEvent;

export {
  domainEventSchema,
  parseDomainEvent,
  tryParseDomainEvent,
  jobCreatedEventSchema,
  aiRecommendationRequestedEventSchema,
  aiRecommendationGeneratedEventSchema,
  jobAssignedEventSchema,
} from './schemas.js';
