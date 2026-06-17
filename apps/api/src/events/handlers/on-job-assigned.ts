import { JobStatus, type JobAssignedEvent } from '@retailfixit/shared';

import { logger } from '../../observability/logger.js';
import { broadcastJobAssigned } from '../../realtime/publisher.js';

/**
 * Reacts to a vendor being assigned to a job. The assignment itself is already
 * persisted by the service; this handler broadcasts the change so every
 * same-tenant dashboard updates live.
 */
export async function onJobAssigned(event: JobAssignedEvent): Promise<void> {
  const { tenantId, payload, correlationId } = event;

  await broadcastJobAssigned(tenantId, payload.jobId, JobStatus.Assigned, payload.vendorId);

  logger.info(
    {
      tenantId,
      jobId: payload.jobId,
      vendorId: payload.vendorId,
      assignmentId: payload.assignmentId,
      overrodeAi: payload.overrodeAi,
      correlationId,
    },
    'Job assigned to vendor',
  );
}
