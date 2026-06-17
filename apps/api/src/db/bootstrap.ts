/**
 * Provisions the Cosmos DB database and containers. Run once after creating
 * the Cosmos account: npm run db:bootstrap --workspace apps/api
 */
import '../config/load-env.js';
import { closeDatabase, provisionCosmosResources } from './client.js';
import { ensureTenants } from './ensure-tenants.js';
import { logger } from '../observability/logger.js';

async function main(): Promise<void> {
  await provisionCosmosResources();
  await ensureTenants();
  logger.info('Cosmos DB bootstrap complete');
  await closeDatabase();
}

main().catch((err) => {
  logger.error({ err }, 'Cosmos DB bootstrap failed');
  process.exit(1);
});
