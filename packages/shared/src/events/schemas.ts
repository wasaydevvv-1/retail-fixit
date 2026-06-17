/**
 * Runtime validation for event bus messages.
 * Complements TypeScript types in `index.ts` — used at publish and consume boundaries.
 */
import { z } from 'zod';

import type { DomainEvent } from './index.js';

const EVENT_JOB_CREATED = 'JobCreated' as const;
const EVENT_AI_REQUESTED = 'AIRecommendationRequested' as const;
const EVENT_AI_GENERATED = 'AIRecommendationGenerated' as const;
const EVENT_JOB_ASSIGNED = 'JobAssigned' as const;

const envelopeFields = {
  id: z.string().min(1),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
  occurredAt: z.string().min(1),
};

const recommendationCandidateSchema = z.object({
  vendorId: z.string().min(1),
  vendorName: z.string().min(1),
  score: z.number().min(0).max(1),
  reason: z.string().min(1),
});

const aiRecommendationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
  candidates: z.array(recommendationCandidateSchema),
  model: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  usedFallback: z.boolean(),
  createdAt: z.string().min(1),
});

export const jobCreatedEventSchema = z.object({
  ...envelopeFields,
  type: z.literal(EVENT_JOB_CREATED),
  payload: z.object({
    jobId: z.string().min(1),
    title: z.string().min(1),
    rawDescription: z.string(),
    requiredSkills: z.array(z.string()),
    location: z.string(),
  }),
});

export const aiRecommendationRequestedEventSchema = z.object({
  ...envelopeFields,
  type: z.literal(EVENT_AI_REQUESTED),
  payload: z.object({
    jobId: z.string().min(1),
  }),
});

export const aiRecommendationGeneratedEventSchema = z.object({
  ...envelopeFields,
  type: z.literal(EVENT_AI_GENERATED),
  payload: z.object({
    jobId: z.string().min(1),
    recommendation: aiRecommendationSchema,
  }),
});

export const jobAssignedEventSchema = z.object({
  ...envelopeFields,
  type: z.literal(EVENT_JOB_ASSIGNED),
  payload: z.object({
    jobId: z.string().min(1),
    vendorId: z.string().min(1),
    assignmentId: z.string().min(1),
    overrodeAi: z.boolean(),
  }),
});

export const domainEventSchema = z.discriminatedUnion('type', [
  jobCreatedEventSchema,
  aiRecommendationRequestedEventSchema,
  aiRecommendationGeneratedEventSchema,
  jobAssignedEventSchema,
]);

/** Validate an unknown payload as a domain event. Throws ZodError on failure. */
export function parseDomainEvent(input: unknown): DomainEvent {
  return domainEventSchema.parse(input) as DomainEvent;
}

/** Safe parse — returns null when the message is not a valid domain event. */
export function tryParseDomainEvent(input: unknown): DomainEvent | null {
  const result = domainEventSchema.safeParse(input);
  return result.success ? (result.data as DomainEvent) : null;
}
