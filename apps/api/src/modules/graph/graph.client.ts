import { randomBytes } from 'node:crypto';

import { config } from '../../config/index.js';
import { AppError } from '../../middleware/error.js';

interface GraphTokenResponse {
  access_token: string;
}

export interface GraphUser {
  id: string;
  displayName: string;
  mail?: string | null;
  userPrincipalName: string;
}

interface GraphListResponse {
  value: GraphUser[];
}

interface GraphDomain {
  id: string;
  isDefault?: boolean;
}

interface GraphDomainResponse {
  value: GraphDomain[];
}

interface GraphErrorBody {
  error?: { message?: string };
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedDefaultDomain: string | null = null;

async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const tenantId = config.auth.azureAdTenantId;
  const body = new URLSearchParams({
    client_id: config.auth.azureAdClientId,
    client_secret: config.auth.azureAdClientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    let detail = errText;
    try {
      const parsed = JSON.parse(errText) as { error_description?: string };
      if (parsed.error_description) {
        detail = parsed.error_description;
        if (detail.includes('client secret ID')) {
          detail +=
            ' In Azure Portal use the secret Value (shown once at creation), not the Secret ID column.';
        }
      }
    } catch {
      // keep raw text
    }
    throw new AppError(502, 'GRAPH_AUTH_FAILED', detail);
  }

  const data = (await res.json()) as GraphTokenResponse;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + 3_500_000 };
  return data.access_token;
}

export async function graphFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getGraphToken();
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export function generateEntraPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const pick = (chars: string) => chars[randomBytes(1)[0]! % chars.length];
  const parts = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = 0; i < 8; i++) parts.push(pick(all));
  for (let i = parts.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    [parts[i], parts[j]] = [parts[j]!, parts[i]!];
  }
  return parts.join('');
}

export function sanitizeMailNickname(userName: string): string {
  const cleaned = userName.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!cleaned) {
    throw new AppError(400, 'INVALID_USER_NAME', 'Username may only contain letters, numbers, dots, dashes');
  }
  return cleaned.slice(0, 64);
}

export async function getEntraDefaultDomain(): Promise<string> {
  if (config.auth.entraDefaultDomain) return config.auth.entraDefaultDomain;
  if (cachedDefaultDomain) return cachedDefaultDomain;

  const res = await graphFetch('/domains?$filter=isDefault eq true&$select=id');
  if (!res.ok) {
    throw new AppError(502, 'GRAPH_DOMAIN_FAILED', 'Could not read default Entra domain from Microsoft Graph');
  }

  const data = (await res.json()) as GraphDomainResponse;
  const domain = data.value?.[0]?.id;
  if (!domain) {
    throw new AppError(502, 'GRAPH_DOMAIN_MISSING', 'No default domain found in Entra tenant');
  }

  cachedDefaultDomain = domain;
  return domain;
}

export async function findEntraUserByUpn(upn: string): Promise<GraphUser | null> {
  const encoded = encodeURIComponent(upn);
  const res = await graphFetch(`/users/${encoded}?$select=id,displayName,mail,userPrincipalName`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as GraphUser;
}

export async function testGraphAuth(): Promise<void> {
  await getGraphToken();
}

/** Probes User.ReadWrite.All without creating a user (invalid body → 400 if allowed, 403 if not). */
export async function testGraphWritePermission(): Promise<void> {
  const res = await graphFetch('/users', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (res.status === 403) {
    const err = (await res.json().catch(() => ({}))) as GraphErrorBody;
    throw new AppError(
      502,
      'GRAPH_WRITE_FORBIDDEN',
      err.error?.message ??
        'Microsoft Graph denied user creation. Grant User.ReadWrite.All application permission with admin consent.',
    );
  }

  // 400/422 = token may create users; any other non-success is unexpected but not a permission denial.
  if (!res.ok && res.status !== 400 && res.status !== 422) {
    const detail = await res.text();
    throw new AppError(502, 'GRAPH_WRITE_PROBE_FAILED', detail || 'Could not verify Graph write permissions');
  }
}

export async function searchEntraUsers(query: string): Promise<GraphUser[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const escaped = trimmed.replace(/"/g, '\\"');
  const url = new URL('https://graph.microsoft.com/v1.0/users');
  url.searchParams.set('$select', 'id,displayName,mail,userPrincipalName');
  url.searchParams.set('$top', '15');
  url.searchParams.set(
    '$search',
    `"displayName:${escaped}" OR "mail:${escaped}" OR "userPrincipalName:${escaped}"`,
  );

  const token = await getGraphToken();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ConsistencyLevel: 'eventual',
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new AppError(
      502,
      'GRAPH_SEARCH_FAILED',
      `Microsoft Graph user search failed. Ensure User.Read.All application permission with admin consent. ${detail}`,
    );
  }

  const data = (await res.json()) as GraphListResponse;
  return data.value ?? [];
}

export interface CreateEntraUserInput {
  displayName: string;
  userName: string;
  password?: string;
}

export interface CreateEntraUserResult {
  user: GraphUser;
  userPrincipalName: string;
  temporaryPassword: string;
}

export async function createEntraUser(input: CreateEntraUserInput): Promise<CreateEntraUserResult> {
  const domain = await getEntraDefaultDomain();
  const mailNickname = sanitizeMailNickname(input.userName);
  const userPrincipalName = `${mailNickname}@${domain}`;
  const existing = await findEntraUserByUpn(userPrincipalName);
  if (existing) {
    throw new AppError(
      409,
      'ENTRA_USER_EXISTS',
      `Microsoft Entra already has a user with sign-in ${userPrincipalName}`,
    );
  }

  const temporaryPassword = input.password?.trim() || generateEntraPassword();
  const body = {
    accountEnabled: true,
    displayName: input.displayName.trim(),
    mailNickname,
    userPrincipalName,
    passwordProfile: {
      forceChangePasswordNextSignIn: false,
      password: temporaryPassword,
    },
  };

  const res = await graphFetch('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as GraphErrorBody;
    let message =
      err.error?.message ??
      'Failed to create user in Microsoft Entra. Grant User.ReadWrite.All application permission with admin consent.';
    if (message.toLowerCase().includes('insufficient privileges')) {
      message +=
        ' Add Microsoft Graph → Application permission → User.ReadWrite.All on the same app as AZURE_AD_CLIENT_ID, then click Grant admin consent for Default Directory.';
    }
    throw new AppError(502, 'GRAPH_CREATE_USER_FAILED', message);
  }

  const user = (await res.json()) as GraphUser;
  return { user, userPrincipalName, temporaryPassword };
}
