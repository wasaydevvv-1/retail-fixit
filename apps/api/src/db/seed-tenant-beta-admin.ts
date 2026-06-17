/**
 * Optional one-time seed: invites a dispatcher/admin into tenant_beta before first Entra login.
 *
 * Usage:
 *   SEED_BETA_ADMIN_LOGIN=you@wasaydevvgmail.onmicrosoft.com npm run db:seed-beta --workspace apps/api
 */
import '../config/load-env.js';
import { UserRole } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { closeDatabase, connectDatabase } from './client.js';
import { ensureTenants } from './ensure-tenants.js';
import { upsertUser } from '../modules/auth/users.repository.js';
import { logger } from '../observability/logger.js';

async function main(): Promise<void> {
  const loginId = process.env.SEED_BETA_ADMIN_LOGIN?.trim().toLowerCase();
  if (!loginId) {
    logger.error('Set SEED_BETA_ADMIN_LOGIN to the Microsoft UPN for the Beta tenant admin');
    process.exit(1);
  }

  await connectDatabase();
  await ensureTenants();

  const displayName = process.env.SEED_BETA_ADMIN_NAME?.trim() || 'Beta Admin';

  await upsertUser({
    id: `pending_${uuid()}`,
    tenantId: 'tenant_beta',
    email: loginId,
    loginId,
    displayName,
    roles: [UserRole.Admin, UserRole.Dispatcher],
  });

  logger.info(
    { tenantId: 'tenant_beta', loginId, displayName },
    'Beta tenant admin invited — sign in with Microsoft using this account',
  );

  await closeDatabase();
}

main().catch((err) => {
  logger.error({ err }, 'Beta tenant seed failed');
  process.exit(1);
});
