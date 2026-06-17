import {
  EventType,
  type DomainEvent,
  type EventEnvelope,
  type JobCreatedPayload,
  type AIRecommendationRequestedPayload,
  type AIRecommendationGeneratedPayload,
  type JobAssignedPayload,
} from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { getEventBus } from './event-bus-registry.js';

function envelope<TType extends DomainEvent['type'], TPayload>(
  type: TType,
  tenantId: string,
  correlationId: string,
  payload: TPayload,
): EventEnvelope<TType, TPayload> {
  return {
    id: uuid(),
    type,
    tenantId,
    correlationId,
    occurredAt: new Date().toISOString(),
    payload,
  };
}

export async function publishJobCreated(
  tenantId: string,
  correlationId: string,
  payload: JobCreatedPayload,
): Promise<void> {
  const event = envelope(EventType.JobCreated, tenantId, correlationId, payload);
  await getEventBus().publish(event);
}

export async function publishAIRecommendationRequested(
  tenantId: string,
  correlationId: string,
  payload: AIRecommendationRequestedPayload,
): Promise<void> {
  const event = envelope(
    EventType.AIRecommendationRequested,
    tenantId,
    correlationId,
    payload,
  );
  await getEventBus().publish(event);
}

export async function publishAIRecommendationGenerated(
  tenantId: string,
  correlationId: string,
  payload: AIRecommendationGeneratedPayload,
): Promise<void> {
  const event = envelope(
    EventType.AIRecommendationGenerated,
    tenantId,
    correlationId,
    payload,
  );
  await getEventBus().publish(event);
}

export async function publishJobAssigned(
  tenantId: string,
  correlationId: string,
  payload: JobAssignedPayload,
): Promise<void> {
  const event = envelope(EventType.JobAssigned, tenantId, correlationId, payload);
  await getEventBus().publish(event);
}
