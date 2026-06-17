/**
 * Shared enums used across the API, events, and the web SPA.
 * Keeping these in one place prevents the frontend and backend from drifting.
 */

export const UserRole = {
  /** Cross-tenant operator — provisions tenant admins only. */
  PlatformAdmin: 'platform_admin',
  Dispatcher: 'dispatcher',
  VendorManager: 'vendor_manager',
  Admin: 'admin',
  SupportAgent: 'support_agent',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const JobStatus = {
  Created: 'created',
  AwaitingRecommendation: 'awaiting_recommendation',
  RecommendationReady: 'recommendation_ready',
  Assigned: 'assigned',
  InProgress: 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Escalated: 'escalated',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JobPriority = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
} as const;
export type JobPriority = (typeof JobPriority)[keyof typeof JobPriority];

export const VendorStatus = {
  Active: 'active',
  Inactive: 'inactive',
  Suspended: 'suspended',
} as const;
export type VendorStatus = (typeof VendorStatus)[keyof typeof VendorStatus];

export const AssignmentDecisionSource = {
  Ai: 'ai',
  Human: 'human',
} as const;
export type AssignmentDecisionSource =
  (typeof AssignmentDecisionSource)[keyof typeof AssignmentDecisionSource];

export const AuditAction = {
  JobCreated: 'job.created',
  JobAssigned: 'job.assigned',
  JobStatusChanged: 'job.status_changed',
  AiRecommendationGenerated: 'ai.recommendation_generated',
  AiRecommendationOverridden: 'ai.recommendation_overridden',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
