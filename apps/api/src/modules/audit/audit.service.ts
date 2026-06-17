import type { AuditAction } from '@retailfixit/shared';

import { appendAuditLog } from './audit.repository.js';

export async function recordAudit(input: {
  tenantId: string;
  action: AuditAction;
  actorId: string;
  subject: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await appendAuditLog(input);
}
