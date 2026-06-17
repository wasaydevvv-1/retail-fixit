/**
 * Move an existing Cosmos user to tenant_platform with platform_admin role.
 * Use when Entra already has Platform Admin but the app still shows Tenant Administrator
 * (first login created an Acme admin record that overrides the token).
 *
 *   PROMOTE_PLATFORM_ADMIN_LOGIN=wasay.devv_gmail.com#EXT#@wasaydevvgmail.onmicrosoft.com npm run db:promote-platform --workspace apps/api
 */
import '../config/load-env.js';
import { PLATFORM_TENANT_ID, UserRole } from '@retailfixit/shared';

import { closeDatabase, connectDatabase } from './client.js';
import { ensureTenants } from './ensure-tenants.js';
import type { UserDocument } from './documents.js';
import { getContainer } from './client.js';
import { logger } from '../observability/logger.js';

async function main(): Promise<void> {
  const login = process.env.PROMOTE_PLATFORM_ADMIN_LOGIN?.trim().toLowerCase();
  if (!login) {
    logger.error('Set PROMOTE_PLATFORM_ADMIN_LOGIN to your Microsoft UPN');
    process.exit(1);
  }

  await connectDatabase();
  await ensureTenants();

  const container = getContainer('users');
  const { resources } = await container.items
    .query<UserDocument>({
      query:
        'SELECT * FROM c WHERE c.email = @login OR c.loginId = @login OR c.id = @login',
      parameters: [{ name: '@login', value: login }],
    })
    .fetchAll();

  const active = resources.find((doc) => !doc.id.startsWith('pending_'));
  if (!active) {
    logger.error(
      { login, pendingCount: resources.length },
      'No active Cosmos user found for this login — run db:seed-platform first, or sign in once',
    );
    process.exit(1);
  }

  if (active.tenantId === PLATFORM_TENANT_ID && active.roles.includes(UserRole.PlatformAdmin)) {
    logger.info({ userId: active.id, login }, 'User is already platform admin — no change needed');
    await closeDatabase();
    return;
  }

  const promoted: UserDocument = {
    ...active,
    tenantId: PLATFORM_TENANT_ID,
    roles: [UserRole.PlatformAdmin],
    loginId: active.loginId ?? login,
    email: active.email ?? login,
    type: 'user',
  };

  if (active.tenantId !== PLATFORM_TENANT_ID) {
    await container.item(active.id, active.tenantId).delete();
  }

  await container.items.upsert(promoted);

  for (const doc of resources) {
    if (doc.id.startsWith('pending_') && doc.id !== active.id) {
      await container.item(doc.id, doc.tenantId).delete();
      logger.info({ pendingId: doc.id }, 'Removed duplicate pending invite');
    }
  }

  logger.info(
    {
      userId: promoted.id,
      fromTenant: active.tenantId,
      toTenant: PLATFORM_TENANT_ID,
      login,
    },
    'Promoted user to platform admin — sign out and sign in again',
  );

  await closeDatabase();
}

main().catch((err) => {
  logger.error({ err }, 'Platform admin promotion failed');
  process.exit(1);
});
