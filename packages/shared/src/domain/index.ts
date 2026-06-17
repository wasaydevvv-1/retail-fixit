/**
 * Core domain entities for RetailFixIt.
 *
 * Every tenant-scoped entity carries a `tenantId` so that multi-tenant
 * isolation can be enforced at the data-access layer (never trust the client).
 */

import type {
  AssignmentDecisionSource,
  AuditAction,
  JobPriority,
  JobStatus,
  UserRole,
  VendorStatus,
} from '../enums/index.js';
import type { Permission } from '../rbac/index.js';

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  /** Per-role API permissions; falls back to defaults when absent. */
  rolePermissions?: Partial<Record<UserRole, Permission[]>>;
}

export interface UserAccount {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  /** Linked vendor company when this user is a vendor manager. */
  vendorId?: string;
  /** Entra sign-in id (UPN), e.g. name@tenant.onmicrosoft.com — matched on first login. */
  loginId?: string;
  /** Microsoft Entra object id when provisioned via Graph. */
  entraObjectId?: string;
}

export interface Job {
  id: string;
  tenantId: string;
  title: string;
  /** Raw customer-provided description (input to AI summarization). */
  rawDescription: string;
  /** AI-generated concise summary, if available. */
  aiSummary?: string;
  status: JobStatus;
  priority: JobPriority;
  customerName: string;
  location: string;
  /** Free-form skill tags used for vendor matching. */
  requiredSkills: string[];
  assignedVendorId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  status: VendorStatus;
  skills: string[];
  serviceAreas: string[];
  rating: number;
  /** Currently open assignments — used by the recommendation engine. */
  activeJobCount: number;
  /** Vendor manager user who owns this company profile. */
  managedByUserId?: string;
}

export interface Assignment {
  id: string;
  tenantId: string;
  jobId: string;
  vendorId: string;
  /** Whether the final decision was made by AI or a human dispatcher. */
  decisionSource: AssignmentDecisionSource;
  /** True when a human chose a vendor different from the AI's top pick. */
  overrodeAi: boolean;
  assignedBy: string;
  assignedAt: string;
}

export interface AIRecommendationCandidate {
  vendorId: string;
  vendorName: string;
  /** 0..1 model confidence for this candidate. */
  score: number;
  reason: string;
}

export interface AIRecommendation {
  id: string;
  tenantId: string;
  jobId: string;
  candidates: AIRecommendationCandidate[];
  model: string;
  /** End-to-end inference latency in milliseconds. */
  latencyMs: number;
  /** True when the deterministic fallback produced this result. */
  usedFallback: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  action: AuditAction;
  actorId: string;
  /** Entity affected, e.g. "job:123". */
  subject: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
