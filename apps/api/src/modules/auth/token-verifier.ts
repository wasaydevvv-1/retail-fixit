import { UserRole, type UserRole as UserRoleType } from '@retailfixit/shared';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

import { config, isEntraAuthEnabled } from '../../config/index.js';
import { AppError } from '../../middleware/error.js';
import type { TokenClaims } from './auth.types.js';

const VALID_ROLES = new Set<string>(Object.values(UserRole));

/** Entra app-role values often differ from our enum — normalize on read. */
const ENTRA_ROLE_ALIASES: Record<string, UserRoleType> = {
  vendor: UserRole.VendorManager,
  Vendor: UserRole.VendorManager,
  platform_admin: UserRole.PlatformAdmin,
  PlatformAdmin: UserRole.PlatformAdmin,
  'Platform Admin': UserRole.PlatformAdmin,
  Admin: UserRole.Admin,
  admin: UserRole.Admin,
  Administrator: UserRole.Admin,
  administrator: UserRole.Admin,
  Dispatcher: UserRole.Dispatcher,
  'Support Agent': UserRole.SupportAgent,
  'Vendor Manager': UserRole.VendorManager,
  SupportAgent: UserRole.SupportAgent,
  VendorManager: UserRole.VendorManager,
  Support: UserRole.SupportAgent,
  support: UserRole.SupportAgent,
  support_agent: UserRole.SupportAgent,
};

function parseRoles(raw: unknown): UserRoleType[] {
  if (!Array.isArray(raw)) return [];
  const mapped = raw.map((r) => (typeof r === 'string' ? ENTRA_ROLE_ALIASES[r] ?? r : r));
  return mapped.filter((r): r is UserRoleType => typeof r === 'string' && VALID_ROLES.has(r));
}

let jwksClient: jwksRsa.JwksClient | null = null;

function getJwksClient(): jwksRsa.JwksClient {
  if (!jwksClient) {
    jwksClient = jwksRsa({
      jwksUri: `https://login.microsoftonline.com/${config.auth.azureAdTenantId}/discovery/v2.0/keys`,
      cache: true,
      rateLimit: true,
    });
  }
  return jwksClient;
}

async function verifyEntraToken(token: string): Promise<TokenClaims> {
  const client = getJwksClient();
  const tenantId = config.auth.azureAdTenantId;

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new AppError(401, 'INVALID_TOKEN', 'Malformed access token');
  }

  const signingKey = await client.getSigningKey(decoded.header.kid);
  const publicKey = signingKey.getPublicKey();

  // Access tokens for custom APIs use the v1 issuer (sts.windows.net); id tokens use v2.
  const validIssuers = new Set([
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`,
  ]);

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, publicKey, {
      audience: config.auth.azureAdAudience,
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired access token');
  }

  if (!payload.iss || !validIssuers.has(payload.iss)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid token issuer');
  }

  const sub = payload.oid ?? payload.sub;
  if (!sub || typeof sub !== 'string') {
    throw new AppError(401, 'INVALID_TOKEN', 'Token is missing subject claim');
  }

  return {
    sub,
    email: (payload.preferred_username ?? payload.email ?? payload.upn ?? '') as string,
    name: (payload.name ?? payload.preferred_username ?? 'User') as string,
    roles: parseRoles(payload.roles),
    tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : undefined,
  };
}

function verifyDevToken(token: string): TokenClaims {
  let payload: jwt.JwtPayload;

  try {
    payload = jwt.verify(token, config.auth.devJwtSecret, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired access token');
  }

  const sub = payload.sub;
  if (!sub || typeof sub !== 'string') {
    throw new AppError(401, 'INVALID_TOKEN', 'Token is missing subject claim');
  }

  return {
    sub,
    email: (payload.email ?? '') as string,
    name: (payload.name ?? 'User') as string,
    roles: parseRoles(payload.roles),
    tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : undefined,
  };
}

export async function verifyAccessToken(token: string): Promise<TokenClaims> {
  if (isEntraAuthEnabled()) {
    return verifyEntraToken(token);
  }
  return verifyDevToken(token);
}

export function signDevToken(claims: TokenClaims): string {
  return jwt.sign(
    {
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      roles: claims.roles,
      tenantId: claims.tenantId,
    },
    config.auth.devJwtSecret,
    { algorithm: 'HS256', expiresIn: 60 * 60 * 8 },
  );
}
