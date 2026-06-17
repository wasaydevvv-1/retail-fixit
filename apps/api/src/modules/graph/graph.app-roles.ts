import { UserRole, type UserRole as UserRoleType } from '@retailfixit/shared';

import { config } from '../../config/index.js';
import { AppError } from '../../middleware/error.js';
import { graphFetch } from './graph.client.js';

interface AppRole {
  id: string;
  value?: string | null;
  displayName?: string | null;
}

interface ServicePrincipal {
  id: string;
  appRoles: AppRole[];
}

interface ServicePrincipalListResponse {
  value: ServicePrincipal[];
}

interface AppRoleAssignment {
  id: string;
  appRoleId: string;
  principalId: string;
  resourceId: string;
}

interface AppRoleAssignmentListResponse {
  value: AppRoleAssignment[];
}

const DEFAULT_APP_ROLE_ID = '00000000-0000-0000-0000-000000000000';

/** Entra's built-in default role cannot be assigned via Graph — only custom roles with a value. */
function isAssignableAppRole(appRole: AppRole): boolean {
  return Boolean(
    appRole.id &&
      appRole.id !== DEFAULT_APP_ROLE_ID &&
      appRole.value?.trim(),
  );
}

function assignableAppRoles(appRoles: AppRole[]): AppRole[] {
  return appRoles.filter(isAssignableAppRole);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAssignmentError(message: string, appRole: AppRole, spId: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('not a valid reference update')) {
    return (
      `${message} This is often Entra replication delay right after creating a user — the RetailFixIt invite still works. ` +
      `Wait 1–2 minutes, then assign the role manually in Enterprise applications → Users and groups, or use Save roles again. ` +
      `If it persists, verify App registration → App roles each have a unique Value ` +
      `(e.g. admin, dispatcher, support_agent, vendor_manager). ` +
      `(Attempted role id ${appRole.id}, value "${appRole.value}", service principal ${spId}.)`
    );
  }
  return message;
}
/** RetailFixIt role → possible Entra app role value strings (must match App registration → App roles → Value). */
const ENTRA_ROLE_ALIASES: Record<UserRoleType, string[]> = {
  [UserRole.PlatformAdmin]: ['platform_admin', 'PlatformAdmin', 'Platform Admin'],
  [UserRole.Admin]: ['admin', 'Admin', 'Administrator'],
  [UserRole.Dispatcher]: ['dispatcher', 'Dispatcher'],
  [UserRole.SupportAgent]: ['support_agent', 'SupportAgent', 'Support Agent'],
  [UserRole.VendorManager]: ['vendor_manager', 'VendorManager', 'Vendor Manager'],
};

let cachedServicePrincipal: { id: string; appRoles: AppRole[]; expiresAt: number } | null = null;

async function getApplicationAppRoles(): Promise<AppRole[]> {
  const appId = config.auth.azureAdClientId;
  const res = await graphFetch(
    `/applications?$filter=appId eq '${appId}'&$select=appRoles`,
  );

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as { value?: { appRoles?: AppRole[] }[] };
  return data.value?.[0]?.appRoles ?? [];
}

async function getRetailFixitServicePrincipal(): Promise<ServicePrincipal> {
  if (cachedServicePrincipal && cachedServicePrincipal.expiresAt > Date.now()) {
    return cachedServicePrincipal;
  }

  const appId = config.auth.azureAdClientId;
  const res = await graphFetch(
    `/servicePrincipals?$filter=appId eq '${appId}'&$select=id,appRoles,displayName`,
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new AppError(
      502,
      'GRAPH_SP_LOOKUP_FAILED',
      `Could not find RetailFixIt enterprise app in Entra. Grant Application.Read.All application permission with admin consent. ${detail}`,
    );
  }

  const data = (await res.json()) as ServicePrincipalListResponse;
  const sp = data.value?.[0];
  if (!sp?.id) {
    throw new AppError(
      502,
      'GRAPH_SP_NOT_FOUND',
      'RetailFixIt enterprise application was not found. Ensure users have opened the app once or create the service principal in Entra.',
    );
  }

  const registrationRoles = await getApplicationAppRoles();
  const appRoles =
    registrationRoles.length > 0 ? registrationRoles : (sp.appRoles ?? []);

  cachedServicePrincipal = {
    id: sp.id,
    appRoles,
    expiresAt: Date.now() + 3_600_000,
  };
  return { ...sp, appRoles };
}

function normalizeRoleToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function findAppRoleForRetailRole(retailRole: UserRoleType, appRoles: AppRole[]): AppRole | null {
  const aliases = ENTRA_ROLE_ALIASES[retailRole].map(normalizeRoleToken);
  const candidates = assignableAppRoles(appRoles);

  for (const appRole of candidates) {
    const value = normalizeRoleToken(appRole.value!);
    if (aliases.includes(value)) return appRole;
  }

  for (const appRole of candidates) {
    const display = appRole.displayName ? normalizeRoleToken(appRole.displayName) : '';
    if (display && aliases.includes(display)) return appRole;
  }

  return null;
}

/** Entra allows one app role per user per application — use the first matching RetailFixIt role. */
function pickAppRole(retailRoles: UserRoleType[], appRoles: AppRole[]): AppRole | null {
  const candidates = assignableAppRoles(appRoles);
  for (const retailRole of retailRoles) {
    const match = findAppRoleForRetailRole(retailRole, candidates);
    if (match) return match;
  }
  return null;
}

async function postAppRoleAssignment(
  servicePrincipalId: string,
  entraUserId: string,
  appRole: AppRole,
): Promise<Response> {
  return graphFetch(`/servicePrincipals/${servicePrincipalId}/appRoleAssignedTo`, {
    method: 'POST',
    body: JSON.stringify({
      '@odata.type': '#microsoft.graph.appRoleAssignment',
      principalId: entraUserId,
      resourceId: servicePrincipalId,
      appRoleId: appRole.id,
    }),
  });
}

async function waitForEntraPrincipal(entraUserId: string): Promise<void> {
  const delaysMs = [1_000, 2_000, 3_000, 5_000, 8_000, 10_000];
  for (const delay of delaysMs) {
    const res = await graphFetch(`/users/${entraUserId}?$select=id`);
    if (res.ok) return;
    await sleep(delay);
  }
}

async function assignAppRoleWithRetry(
  servicePrincipalId: string,
  entraUserId: string,
  appRole: AppRole,
  freshPrincipal = false,
): Promise<void> {
  const retryDelaysMs = freshPrincipal
    ? [2_000, 5_000, 10_000, 15_000, 20_000]
    : [0, 2_000, 4_000];
  let lastMessage =
    'Failed to assign Entra app role. Grant AppRoleAssignment.ReadWrite.All and Application.Read.All with admin consent.';

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
    const delay = retryDelaysMs[attempt]!;
    if (delay > 0) await sleep(delay);

    const res = await postAppRoleAssignment(servicePrincipalId, entraUserId, appRole);
    if (res.ok) return;

    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    lastMessage =
      err.error?.message ??
      'Failed to assign Entra app role. Grant AppRoleAssignment.ReadWrite.All and Application.Read.All with admin consent.';

    const retryable =
      lastMessage.toLowerCase().includes('not a valid reference update') ||
      lastMessage.toLowerCase().includes('resourcenotfound') ||
      lastMessage.toLowerCase().includes('does not exist');

    if (!retryable || attempt === retryDelaysMs.length - 1) {
      if (lastMessage.toLowerCase().includes('insufficient privileges')) {
        lastMessage +=
          ' Add Microsoft Graph → Application permissions → AppRoleAssignment.ReadWrite.All and Application.Read.All, then Grant admin consent.';
      }
      throw new AppError(
        502,
        'GRAPH_ASSIGN_ROLE_FAILED',
        formatAssignmentError(lastMessage, appRole, servicePrincipalId),
      );
    }

    cachedServicePrincipal = null;
  }
}

async function removeExistingAppRoleAssignments(entraUserId: string, servicePrincipalId: string): Promise<void> {
  const res = await graphFetch(`/users/${entraUserId}/appRoleAssignments`);
  if (!res.ok) {
    const detail = await res.text();
    throw new AppError(
      502,
      'GRAPH_ASSIGNMENT_LIST_FAILED',
      `Could not read existing Entra app role assignments. ${detail}`,
    );
  }

  const data = (await res.json()) as AppRoleAssignmentListResponse;
  const ours = (data.value ?? []).filter((a) => a.resourceId === servicePrincipalId);

  for (const assignment of ours) {
    const del = await graphFetch(`/users/${entraUserId}/appRoleAssignments/${assignment.id}`, {
      method: 'DELETE',
    });
    if (!del.ok && del.status !== 404) {
      const detail = await del.text();
      throw new AppError(
        502,
        'GRAPH_ASSIGNMENT_DELETE_FAILED',
        `Could not remove existing Entra app role assignment. ${detail}`,
      );
    }
  }
}

export interface SyncEntraAppRoleOptions {
  /** Poll Entra replication and retry longer — use right after creating a new user. */
  freshPrincipal?: boolean;
}

export interface SyncEntraAppRoleResult {
  assignedRole?: string;
  warning?: string;
}

/**
 * Assigns the user to the RetailFixIt enterprise app with a matching Entra app role.
 * RetailFixIt may store multiple roles in Cosmos; Entra receives one role for sign-in.
 */
export async function syncEntraAppRoleAssignment(
  entraUserId: string,
  retailRoles: UserRoleType[],
  options: SyncEntraAppRoleOptions = {},
): Promise<SyncEntraAppRoleResult> {
  if (options.freshPrincipal) {
    await waitForEntraPrincipal(entraUserId);
  }

  const sp = await getRetailFixitServicePrincipal();
  const appRole = pickAppRole(retailRoles, sp.appRoles);

  if (!appRole) {
    const defined = assignableAppRoles(sp.appRoles)
      .map((r) => r.value)
      .filter(Boolean)
      .join(', ');
    return {
      warning:
        `No matching Entra app role for: ${retailRoles.join(', ')}. ` +
        `On App registration ${config.auth.azureAdClientId} → App roles, set Value fields ` +
        `(e.g. admin, dispatcher, support_agent, vendor_manager).` +
        (defined ? ` Configured values: ${defined}.` : ' No assignable app roles found yet.'),
    };
  }

  await removeExistingAppRoleAssignments(entraUserId, sp.id);
  await assignAppRoleWithRetry(sp.id, entraUserId, appRole, options.freshPrincipal);

  return {
    assignedRole: appRole.displayName ?? appRole.value ?? retailRoles[0],
  };
}
