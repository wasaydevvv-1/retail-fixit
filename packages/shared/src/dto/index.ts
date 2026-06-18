/**
 * Request/response Data Transfer Objects shared between the API and the SPA.
 */

import type { Assignment, Job, Tenant, Vendor, AIRecommendation } from '../domain/index.js';
import type { JobPriority, JobStatus, UserRole, VendorStatus } from '../enums/index.js';
import type { Permission, RolePermissionMatrix } from '../rbac/index.js';

export interface CreateJobRequest {
  title: string;
  rawDescription: string;
  customerName: string;
  location: string;
  priority: JobPriority;
  requiredSkills: string[];
}

export interface AssignJobRequest {
  vendorId: string;
}

/** Result of assigning a vendor to a job. */
export interface AssignJobResponse {
  job: Job;
  assignment: Assignment;
}

export interface JobListQuery {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
  priority?: JobPriority;
  search?: string;
  /** Platform operators query a business tenant explicitly. */
  tenantId?: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type JobListResponse = Paginated<Job>;

export interface VendorProfileRequest {
  name: string;
  skills: string[];
  serviceAreas: string[];
}

export interface VendorRatingRequest {
  /** 0–5 quality score used by AI matching. */
  rating: number;
}

export interface CreateVendorRequest {
  name: string;
  skills: string[];
  serviceAreas: string[];
  /** 0–5 rating; defaults to 0 when omitted. */
  rating?: number;
}

export interface VendorListQuery {
  page?: number;
  pageSize?: number;
  status?: VendorStatus;
  search?: string;
  /** Return vendors that have at least one of these skills. */
  skills?: string[];
  /** Platform operators query a business tenant explicitly. */
  tenantId?: string;
}

export type VendorListResponse = Paginated<Vendor>;

export interface JobDetailResponse {
  job: Job;
  recommendation?: AIRecommendation;
  assignableVendors: Vendor[];
}

export interface ApiError {
  code: string;
  message: string;
  /** Trace id so users/support can correlate with server logs. */
  traceId?: string;
}

/** Authenticated user returned by GET /auth/me */
export interface AuthUserResponse {
  id: string;
  tenantId: string;
  /** Human-readable tenant label (e.g. "Acme Retail" instead of tenant_acme). */
  tenantName: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  /** Actions this user may perform — the SPA gates UI on these. */
  permissions: Permission[];
  /** Linked vendor company id for vendor managers. */
  vendorId?: string;
  /** True when a vendor manager must complete their company profile. */
  needsVendorProfile: boolean;
  /** Default portal path after login (role-specific). */
  homePath: string;
  /** True when this tenant has no admin — current user may claim the admin slot once. */
  canClaimAdmin: boolean;
  /** Cross-tenant operator (provisions tenant admins). */
  isPlatformAdmin: boolean;
}

export interface CreateTenantRequest {
  /** Display name, e.g. "Gamma Retail Co". */
  name: string;
}

export type CreateTenantResponse = Tenant;

/** Tenant user row for admin user management. */
export interface TenantUserSummary {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  vendorId?: string;
  vendorName?: string;
  /** Pending = invited by admin, not yet signed in with Microsoft. */
  status: 'active' | 'pending';
  tenantId: string;
  tenantName?: string;
}

export interface CreateTenantUserRequest {
  email?: string;
  displayName: string;
  roles: UserRole[];
  /** Entra user principal name used for Microsoft sign-in matching. */
  loginId?: string;
  /** When true, creates the account in Microsoft Entra via Graph API. */
  createInEntra?: boolean;
  /** Local part of UPN before @domain (e.g. "john" → john@tenant.onmicrosoft.com). */
  userName?: string;
  /** Initial password; auto-generated when omitted. */
  password?: string;
  /** Target business tenant (defaults to the admin's tenant). */
  tenantId?: string;
}

export interface EntraConfigResponse {
  graphEnabled: boolean;
  canCreateUsers: boolean;
  defaultDomain?: string;
  message?: string;
  /** False when client secret or permissions are wrong. */
  graphAuthOk?: boolean;
  /** False when User.ReadWrite.All is missing or not admin-consented. */
  graphWriteOk?: boolean;
}

/** Response when admin creates a user (may include one-time password). */
export interface CreateTenantUserResponse extends TenantUserSummary {
  temporaryPassword?: string;
  userPrincipalName?: string;
  /** Entra enterprise app role assigned during create (Entra allows one role per app). */
  entraAssignedRole?: string;
  entraAssignmentWarning?: string;
}

export interface EntraDirectoryUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
}

export interface EntraUserSearchResponse {
  enabled: boolean;
  items: EntraDirectoryUser[];
  message?: string;
}

/** Public vendor self-registration (creates Entra account + vendor_manager role). */
export interface VendorRegisterRequest {
  displayName: string;
  userName: string;
  password?: string;
}

export interface VendorRegistrationConfigResponse {
  enabled: boolean;
  mode: 'entra' | 'dev';
  entra?: EntraConfigResponse;
}

export interface VendorRegisterResponse extends CreateTenantUserResponse {
  /** Dev mode only — use this id in the dev login picker. */
  devUserId?: string;
}

export interface LinkUserVendorRequest {
  vendorId: string;
}

/** Admin assigns application roles in RetailFixIt (stored in Cosmos, not Entra). */
export interface UpdateUserRolesRequest {
  roles: UserRole[];
}

/** Role → permission matrix for admin configuration. */
export interface RolePermissionMatrixResponse {
  matrix: RolePermissionMatrix;
}

export interface UpdateRolePermissionMatrixRequest {
  matrix: Partial<Record<UserRole, Permission[]>>;
}
