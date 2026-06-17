import type { Assignment, AssignmentDecisionSource } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { getContainer } from '../../db/client.js';
import type { AssignmentDocument } from '../../db/documents.js';

function toAssignment(doc: AssignmentDocument): Assignment {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    jobId: doc.jobId,
    vendorId: doc.vendorId,
    decisionSource: doc.decisionSource,
    overrodeAi: doc.overrodeAi,
    assignedBy: doc.assignedBy,
    assignedAt: doc.assignedAt,
  };
}

export async function createAssignmentDocument(input: {
  tenantId: string;
  jobId: string;
  vendorId: string;
  decisionSource: AssignmentDecisionSource;
  overrodeAi: boolean;
  assignedBy: string;
}): Promise<Assignment> {
  const container = getContainer('assignments');
  const doc: AssignmentDocument = {
    id: `assignment_${uuid()}`,
    type: 'assignment',
    tenantId: input.tenantId,
    jobId: input.jobId,
    vendorId: input.vendorId,
    decisionSource: input.decisionSource,
    overrodeAi: input.overrodeAi,
    assignedBy: input.assignedBy,
    assignedAt: new Date().toISOString(),
  };

  const { resource } = await container.items.create(doc);
  if (!resource) {
    throw new Error('Failed to persist assignment');
  }
  return toAssignment(resource as unknown as AssignmentDocument);
}
