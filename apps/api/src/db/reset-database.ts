/**
 * Wipe operational Cosmos data and all users except one platform super-admin.
 *
 *   RESET_CONFIRM=yes KEEP_PLATFORM_ADMIN_LOGIN=you@tenant.onmicrosoft.com npm run db:reset --workspace apps/api
 *
 * Optional:
 *   DRY_RUN=true          — log what would be deleted, change nothing
 *   KEEP_PLATFORM_ADMIN_ID — keep by Cosmos user id instead of login
 */
import '../config/load-env.js';
import { PLATFORM_TENANT_ID, UserRole } from '@retailfixit/shared';

import { closeDatabase, connectDatabase, getContainer } from './client.js';
import { CONTAINERS, type ContainerName } from './containers.js';
import type { UserDocument } from './documents.js';
import { ensureTenants } from './ensure-tenants.js';
import { logger } from '../observability/logger.js';

const OPERATIONAL_CONTAINERS: ContainerName[] = [
  'jobs',
  'vendors',
  'assignments',
  'aiRecommendations',
  'auditLogs',
];

function isTruthy(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true' || value === '1' || value?.toLowerCase() === 'yes';
}

async function listPartitionedIds(
  containerName: ContainerName,
): Promise<Array<{ id: string; partitionKey: string }>> {
  const container = getContainer(containerName);
  const pkPath = CONTAINERS[containerName].partitionKey.replace(/^\//, '');
  const { resources } = await container.items
    .query<{ id: string; [key: string]: string }>({
      query: `SELECT c.id, c.${pkPath} AS partitionKey FROM c`,
    })
    .fetchAll();

  return resources
    .filter((row): row is { id: string; partitionKey: string } => Boolean(row.partitionKey))
    .map((row) => ({ id: row.id, partitionKey: row.partitionKey }));
}

async function deleteAllInContainer(containerName: ContainerName, dryRun: boolean): Promise<number> {
  const rows = await listPartitionedIds(containerName);
  if (dryRun) {
    logger.info({ container: containerName, count: rows.length }, 'Would delete documents');
    return rows.length;
  }

  const container = getContainer(containerName);
  for (const row of rows) {
    await container.item(row.id, row.partitionKey).delete();
  }

  logger.info({ container: containerName, deleted: rows.length }, 'Container cleared');
  return rows.length;
}

async function findKeeperUser(): Promise<UserDocument> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>('SELECT * FROM c')
    .fetchAll();

  const keepId = process.env.KEEP_PLATFORM_ADMIN_ID?.trim();
  const keepLogin = process.env.KEEP_PLATFORM_ADMIN_LOGIN?.trim().toLowerCase();

  if (keepId) {
    const match = resources.find((doc) => doc.id === keepId);
    if (!match) {
      throw new Error(`No user found with id ${keepId}`);
    }
    return match;
  }

  const platformAdmins = resources.filter(
    (doc) =>
      doc.tenantId === PLATFORM_TENANT_ID &&
      doc.roles.includes(UserRole.PlatformAdmin) &&
      !doc.id.startsWith('pending_'),
  );

  if (keepLogin) {
    const match = resources.find(
      (doc) =>
        doc.roles.includes(UserRole.PlatformAdmin) &&
        (doc.email?.toLowerCase() === keepLogin || doc.loginId?.toLowerCase() === keepLogin),
    );
    if (!match) {
      throw new Error(
        `No platform admin found for login ${keepLogin}. Sign in once or run db:promote-platform.`,
      );
    }
    return match;
  }

  if (platformAdmins.length === 1) {
    return platformAdmins[0]!;
  }

  if (platformAdmins.length === 0) {
    throw new Error(
      'No active platform admin found. Set KEEP_PLATFORM_ADMIN_LOGIN or run db:seed-platform after reset.',
    );
  }

  throw new Error(
    `Multiple platform admins found (${platformAdmins.length}). Set KEEP_PLATFORM_ADMIN_LOGIN or KEEP_PLATFORM_ADMIN_ID.`,
  );
}

async function deleteUsersExcept(keeper: UserDocument, dryRun: boolean): Promise<number> {
  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>('SELECT * FROM c')
    .fetchAll();

  const toDelete = resources.filter((doc) => doc.id !== keeper.id);
  if (dryRun) {
    logger.info(
      {
        wouldDelete: toDelete.length,
        keeper: { id: keeper.id, login: keeper.loginId ?? keeper.email, tenantId: keeper.tenantId },
      },
      'Would delete users',
    );
    return toDelete.length;
  }

  for (const doc of toDelete) {
    await container.item(doc.id, doc.tenantId).delete();
  }

  logger.info(
    {
      deleted: toDelete.length,
      keeper: { id: keeper.id, login: keeper.loginId ?? keeper.email, tenantId: keeper.tenantId },
    },
    'Users cleared except platform super-admin',
  );
  return toDelete.length;
}

async function normalizeKeeper(keeper: UserDocument, dryRun: boolean): Promise<void> {
  const needsMove = keeper.tenantId !== PLATFORM_TENANT_ID;
  const needsRole = !keeper.roles.includes(UserRole.PlatformAdmin);

  if (!needsMove && !needsRole) return;

  const normalized: UserDocument = {
    ...keeper,
    tenantId: PLATFORM_TENANT_ID,
    roles: [UserRole.PlatformAdmin],
    type: 'user',
  };

  if (dryRun) {
    logger.info({ userId: keeper.id }, 'Would normalize keeper to tenant_platform platform_admin');
    return;
  }

  const container = getContainer('users');
  if (needsMove) {
    await container.item(keeper.id, keeper.tenantId).delete();
  }
  await container.items.upsert(normalized);
  logger.info({ userId: normalized.id }, 'Keeper normalized to platform super-admin');
}

async function main(): Promise<void> {
  if (!isTruthy(process.env.RESET_CONFIRM)) {
    logger.error(
      'Refusing to run without RESET_CONFIRM=yes. Example:\n' +
        '  RESET_CONFIRM=yes KEEP_PLATFORM_ADMIN_LOGIN=you@tenant.onmicrosoft.com npm run db:reset --workspace apps/api',
    );
    process.exit(1);
  }

  const dryRun = isTruthy(process.env.DRY_RUN);

  await connectDatabase();
  const keeper = await findKeeperUser();

  logger.warn(
    {
      dryRun,
      keeper: {
        id: keeper.id,
        email: keeper.email,
        loginId: keeper.loginId,
        tenantId: keeper.tenantId,
        roles: keeper.roles,
      },
    },
    dryRun ? 'DRY RUN — no changes will be made' : 'Resetting database (operational data + extra users)',
  );

  let deleted = 0;
  for (const name of OPERATIONAL_CONTAINERS) {
    deleted += await deleteAllInContainer(name, dryRun);
  }
  deleted += await deleteUsersExcept(keeper, dryRun);
  await normalizeKeeper(keeper, dryRun);

  if (!dryRun) {
    await ensureTenants();
    logger.info('Tenant documents refreshed (tenant_platform, tenant_acme, tenant_beta)');
  }

  logger.info(
    { dryRun, documentsRemoved: deleted },
    dryRun ? 'Dry run complete' : 'Database reset complete — only platform super-admin remains',
  );

  if (!dryRun) {
    logger.info(
      'Tip: flush Redis cache if job/vendor lists look stale — docker compose exec redis redis-cli FLUSHALL',
    );
  }

  await closeDatabase();
}

main().catch((err) => {
  logger.error({ err }, 'Database reset failed');
  process.exit(1);
});
