/**
 * Azure Cosmos DB client. Required in all environments — no in-memory fallback.
 */
import { CosmosClient, type Container, type Database } from '@azure/cosmos';

import { config } from '../config/index.js';
import { logger } from '../observability/logger.js';
import { CONTAINERS, type ContainerName } from './containers.js';

let client: CosmosClient | null = null;
let database: Database | null = null;

function buildCosmosClient(): CosmosClient {
  if (config.cosmos.connectionString) {
    return new CosmosClient(config.cosmos.connectionString);
  }

  if (!config.cosmos.endpoint || !config.cosmos.key) {
    throw new Error(
      'Cosmos DB is required. Set COSMOS_CONNECTION_STRING or COSMOS_ENDPOINT + COSMOS_KEY in apps/api/.env',
    );
  }

  return new CosmosClient({ endpoint: config.cosmos.endpoint, key: config.cosmos.key });
}

function initClient(): CosmosClient {
  if (!client) {
    client = buildCosmosClient();
  }
  return client;
}

export async function connectDatabase(): Promise<Database> {
  if (database) return database;

  const cosmos = initClient();
  const { database: db } = await cosmos.database(config.cosmos.database).read();
  database = db;
  logger.info({ database: config.cosmos.database }, 'Connected to Azure Cosmos DB');
  return database;
}

/** Creates the database and containers if they do not exist (run via db:bootstrap). */
export async function provisionCosmosResources(): Promise<void> {
  const cosmos = initClient();
  const { database: db } = await cosmos.databases.createIfNotExists({ id: config.cosmos.database });
  database = db;
  logger.info({ database: config.cosmos.database }, 'Database ready');

  for (const def of Object.values(CONTAINERS)) {
    const { container } = await db.containers.createIfNotExists({
      id: def.id,
      partitionKey: { paths: [def.partitionKey] },
    });
    logger.info({ container: container.id, partitionKey: def.partitionKey }, 'Container ready');
  }
}

export function getClient(): CosmosClient {
  if (!client) {
    throw new Error('Cosmos client not initialized. Call connectDatabase() during startup.');
  }
  return client;
}

export function getDatabase(): Database {
  if (!database) {
    throw new Error('Database not connected. Call connectDatabase() during startup.');
  }
  return database;
}

export function getContainer(name: ContainerName): Container {
  const def = CONTAINERS[name];
  return getDatabase().container(def.id);
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await getDatabase().read();
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  client = null;
  database = null;
  logger.info('Cosmos DB client released');
}
