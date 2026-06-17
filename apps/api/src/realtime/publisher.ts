import type { JobStatus } from '@retailfixit/shared';
import { RealtimeEventType } from '@retailfixit/shared';

import { logger } from '../observability/logger.js';
import { getRealtimeGateway } from './gateway-registry.js';

/**
 * Typed broadcast helpers. These are best-effort: a realtime failure must never
 * break the core workflow, so errors are logged and swallowed.
 */
async function safeBroadcast(
  tenantId: string,
  event: Parameters<ReturnType<typeof getRealtimeGateway>['broadcast']>[1],
): Promise<void> {
  try {
    await getRealtimeGateway().broadcast(tenantId, event);
  } catch (err) {
    logger.error({ err, tenantId, type: event.type }, 'Realtime broadcast failed');
  }
}

export async function broadcastJobStatusChanged(
  tenantId: string,
  jobId: string,
  status: JobStatus,
): Promise<void> {
  await safeBroadcast(tenantId, {
    type: RealtimeEventType.JobStatusChanged,
    jobId,
    status,
    occurredAt: new Date().toISOString(),
  });
}

export async function broadcastRecommendationReady(
  tenantId: string,
  jobId: string,
  status: JobStatus,
): Promise<void> {
  await safeBroadcast(tenantId, {
    type: RealtimeEventType.JobRecommendationReady,
    jobId,
    status,
    occurredAt: new Date().toISOString(),
  });
}

export async function broadcastJobAssigned(
  tenantId: string,
  jobId: string,
  status: JobStatus,
  assignedVendorId: string,
): Promise<void> {
  await safeBroadcast(tenantId, {
    type: RealtimeEventType.JobAssigned,
    jobId,
    status,
    assignedVendorId,
    occurredAt: new Date().toISOString(),
  });
}
