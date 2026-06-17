/**
 * Seed the single platform super-admin (pending until first Microsoft sign-in).
 *
 *   SEED_PLATFORM_ADMIN_LOGIN=you@wasaydevvgmail.onmicrosoft.com npm run db:seed-platform --workspace apps/api
 */
import '../config/load-env.js';
import { UserRole } from '@retailfixit/shared';
import { PLATFORM_TENANT_ID } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { closeDatabase, connectDatabase } from './client.js';
import { ensureTenants } from './ensure-tenants.js';
import { upsertUser } from '../modules/auth/users.repository.js';
import { logger } from '../observability/logger.js';

async function main(): Promise<void> {
  const loginId = process.env.SEED_PLATFORM_ADMIN_LOGIN?.trim().toLowerCase();
  if (!loginId) {
    logger.error('Set SEED_PLATFORM_ADMIN_LOGIN to your Microsoft UPN');
    process.exit(1);
  }

  await connectDatabase();
  await ensureTenants();

  const displayName = process.env.SEED_PLATFORM_ADMIN_NAME?.trim() || 'Platform Admin';

  await upsertUser({
    id: `pending_${uuid()}`,
    tenantId: PLATFORM_TENANT_ID,
    email: loginId,
    loginId,
    displayName,
    roles: [UserRole.PlatformAdmin],
  });

  logger.info(
    { tenantId: PLATFORM_TENANT_ID, loginId, displayName },
    'Platform admin invited — sign in with Microsoft, then create tenant admins for Acme and Beta',
  );

  await closeDatabase();
}

main().catch((err) => {
  logger.error({ err }, 'Platform admin seed failed');
  process.exit(1);
});
