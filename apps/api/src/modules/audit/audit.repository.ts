import type { AuditAction, AuditLog } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { getContainer } from '../../db/client.js';
import type { AuditLogDocument } from '../../db/documents.js';

export async function appendAuditLog(input: {
  tenantId: string;
  action: AuditAction;
  actorId: string;
  subject: string;
  metadata?: Record<string, unknown>;
}): Promise<AuditLog> {
  const container = getContainer('auditLogs');
  const now = new Date().toISOString();
  const doc: AuditLogDocument = {
    id: `audit_${uuid()}`,
    type: 'auditLog',
    tenantId: input.tenantId,
    action: input.action,
    actorId: input.actorId,
    subject: input.subject,
    metadata: input.metadata ?? {},
    createdAt: now,
  };

  await container.items.create(doc);
  return doc;
}
