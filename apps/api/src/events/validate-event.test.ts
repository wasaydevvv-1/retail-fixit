import { EventType, parseDomainEvent, tryParseDomainEvent } from '@retailfixit/shared';
import { describe, expect, it } from 'vitest';

describe('domain event schema validation', () => {
  const jobCreated = {
    id: 'evt_1',
    type: EventType.JobCreated,
    tenantId: 'tenant_acme',
    correlationId: 'corr_1',
    occurredAt: new Date().toISOString(),
    payload: {
      jobId: 'job_1',
      title: 'Fix HVAC',
      rawDescription: 'Unit not cooling',
      requiredSkills: ['hvac'],
      location: 'Dallas, TX',
    },
  };

  it('parses a valid JobCreated event', () => {
    expect(parseDomainEvent(jobCreated)).toEqual(jobCreated);
  });

  it('rejects events with missing correlationId', () => {
    expect(tryParseDomainEvent({ ...jobCreated, correlationId: '' })).toBeNull();
  });

  it('rejects unknown event types', () => {
    expect(tryParseDomainEvent({ ...jobCreated, type: 'Unknown' })).toBeNull();
  });
});
