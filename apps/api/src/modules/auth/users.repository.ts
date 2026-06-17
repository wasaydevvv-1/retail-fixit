import { UserRole, type UserAccount, type UserRole as UserRoleType } from '@retailfixit/shared';

import { getContainer } from '../../db/client.js';
import type { UserDocument } from '../../db/documents.js';
import { AppError } from '../../middleware/error.js';

function toUserAccount(doc: UserDocument): UserAccount {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    email: doc.email,
    displayName: doc.displayName,
    roles: doc.roles,
    vendorId: doc.vendorId,
    loginId: doc.loginId,
    entraObjectId: doc.entraObjectId,
  };
}

export async function findUserByLoginOrEmail(
  tenantId: string,
  value: string,
): Promise<UserAccount | null> {
  const container = getContainer('users');
  const normalized = value.trim().toLowerCase();
  const { resources } = await container.items
    .query<UserDocument>({
      query:
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND (c.email = @value OR c.loginId = @value)',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@value', value: normalized },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

export async function findPendingUserByEntraId(
  tenantId: string,
  entraObjectId: string,
): Promise<UserAccount | null> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>({
      query:
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND STARTSWITH(c.id, @pendingPrefix) AND c.entraObjectId = @entraObjectId',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@pendingPrefix', value: 'pending_' },
        { name: '@entraObjectId', value: entraObjectId },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

export async function findPendingUserByLogin(
  tenantId: string,
  login: string,
): Promise<UserAccount | null> {
  const container = getContainer('users');
  const normalized = login.trim().toLowerCase();
  const { resources } = await container.items
    .query<UserDocument>({
      query:
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND STARTSWITH(c.id, @pendingPrefix) AND (c.email = @login OR c.loginId = @login)',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@pendingPrefix', value: 'pending_' },
        { name: '@login', value: normalized },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

/** Find a pending invite in any tenant (first Microsoft sign-in). */
export async function findPendingUserByEntraIdAnyTenant(
  entraObjectId: string,
): Promise<UserAccount | null> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>({
      query:
        'SELECT * FROM c WHERE STARTSWITH(c.id, @pendingPrefix) AND c.entraObjectId = @entraObjectId',
      parameters: [
        { name: '@pendingPrefix', value: 'pending_' },
        { name: '@entraObjectId', value: entraObjectId },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

/** Find a pending invite by UPN/email in any tenant. */
export async function findPendingUserByLoginAnyTenant(login: string): Promise<UserAccount | null> {
  const container = getContainer('users');
  const normalized = login.trim().toLowerCase();
  const { resources } = await container.items
    .query<UserDocument>({
      query:
        'SELECT * FROM c WHERE STARTSWITH(c.id, @pendingPrefix) AND (c.email = @login OR c.loginId = @login)',
      parameters: [
        { name: '@pendingPrefix', value: 'pending_' },
        { name: '@login', value: normalized },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

export async function findUserByEmail(
  tenantId: string,
  email: string,
): Promise<UserAccount | null> {
  const container = getContainer('users');
  const normalized = email.trim().toLowerCase();
  const { resources } = await container.items
    .query<UserDocument>({
      query: 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.email = @email',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@email', value: normalized },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

export function isPendingUserId(userId: string): boolean {
  return userId.startsWith('pending_');
}

export async function deleteUser(userId: string, tenantId: string): Promise<void> {
  const container = getContainer('users');
  await container.item(userId, tenantId).delete();
}

export async function findUserById(userId: string): Promise<UserAccount | null> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: userId }],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

export async function listUsersByTenant(tenantId: string): Promise<UserAccount[]> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>({
      query: 'SELECT * FROM c WHERE c.tenantId = @tenantId',
      parameters: [{ name: '@tenantId', value: tenantId }],
    })
    .fetchAll();

  return resources.map(toUserAccount);
}

export async function findAdminByTenant(tenantId: string): Promise<UserAccount | null> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>({
      query:
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND NOT STARTSWITH(c.id, @pendingPrefix) AND ARRAY_CONTAINS(c.roles, @adminRole)',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@adminRole', value: UserRole.Admin },
        { name: '@pendingPrefix', value: 'pending_' },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toUserAccount(doc) : null;
}

/** At most one admin per tenant — enforced before every user write. */
export async function assertSingleAdminPerTenant(
  userId: string,
  tenantId: string,
  roles: UserRoleType[],
): Promise<void> {
  if (!roles.includes(UserRole.Admin) || roles.includes(UserRole.PlatformAdmin)) return;

  const existingAdmin = await findAdminByTenant(tenantId);
  if (existingAdmin && existingAdmin.id !== userId) {
    throw new AppError(
      403,
      'ADMIN_SLOT_TAKEN',
      `Only one administrator is allowed per tenant. Current admin: ${existingAdmin.displayName}.`,
    );
  }
}

export async function upsertUser(
  user: UserAccount & { type?: 'user' },
): Promise<UserAccount> {
  await assertSingleAdminPerTenant(user.id, user.tenantId, user.roles);

  const container = getContainer('users');
  const doc: UserDocument = { ...user, type: 'user' };
  await container.items.upsert(doc);
  return user;
}

export async function listAllUsers(): Promise<UserAccount[]> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>('SELECT * FROM c')
    .fetchAll();
  return resources.map(toUserAccount);
}

export async function linkUserToVendor(
  tenantId: string,
  userId: string,
  vendorId: string,
): Promise<UserAccount | null> {
  const user = await findUserById(userId);
  if (!user || user.tenantId !== tenantId) return null;

  return upsertUser({ ...user, vendorId });
}

/** Cosmos roles win once a user exists — admin UI is the source of truth after first login. */
export function resolveRoles(
  dbRoles: UserRole[],
  tokenRoles: UserRole[],
): UserRole[] {
  if (dbRoles.length > 0) return dbRoles;
  return tokenRoles;
}
