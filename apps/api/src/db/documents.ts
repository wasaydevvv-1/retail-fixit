/**
 * Cosmos DB document shapes. These mirror the shared domain model and are stored
 * as JSON documents — no ORM mapping layer required.
 */
import type {
  AIRecommendation,
  Assignment,
  AuditLog,
  Job,
  Tenant,
  UserAccount,
  Vendor,
} from '@retailfixit/shared';

/** Discriminator stored on every document for debugging and cross-container tooling. */
export type DocumentType =
  | 'tenant'
  | 'user'
  | 'job'
  | 'vendor'
  | 'assignment'
  | 'aiRecommendation'
  | 'auditLog';

interface CosmosDocumentBase {
  id: string;
  type: DocumentType;
}

export type TenantDocument = Tenant & CosmosDocumentBase & { type: 'tenant' };
export type UserDocument = UserAccount & CosmosDocumentBase & { type: 'user' };
export type JobDocument = Job & CosmosDocumentBase & { type: 'job' };
export type VendorDocument = Vendor & CosmosDocumentBase & { type: 'vendor' };
export type AssignmentDocument = Assignment & CosmosDocumentBase & { type: 'assignment' };
export type AIRecommendationDocument = AIRecommendation &
  CosmosDocumentBase & { type: 'aiRecommendation' };
export type AuditLogDocument = AuditLog & CosmosDocumentBase & { type: 'auditLog' };
