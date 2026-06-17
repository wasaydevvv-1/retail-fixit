/**
 * Redis clients: local Docker, legacy Azure Cache for Redis, or Azure Managed Redis.
 * When Redis is unavailable in development, the API continues without list caching.
 */
import { Cluster, Redis, type Cluster as RedisCluster } from 'ioredis';

import { config } from '../config/index.js';
import { logger } from '../observability/logger.js';

type RedisClient = Redis | RedisCluster;

let redis: RedisClient | null = null;

function isAzureManagedRedisHost(host: string): boolean {
  return host.endsWith('.redis.azure.net');
}

function createRedisClient(url: string): RedisClient {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const password = decodeURIComponent(parsed.password);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'rediss:' ? 6380 : 6379;

  // Azure Managed Redis uses TLS on port 10000 and a cluster-aware endpoint.
  if (isAzureManagedRedisHost(host)) {
    return new Cluster(
      [{ host, port }],
      {
        redisOptions: {
          password: password || undefined,
          tls: { servername: host },
          maxRetriesPerRequest: 3,
        },
        dnsLookup: (address, callback) => callback(null, address),
        slotsRefreshTimeout: 5000,
        lazyConnect: true,
        clusterRetryStrategy: () => null,
      },
    );
  }

  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: () => null,
  });
}

export function isRedisEnabled(): boolean {
  return redis !== null;
}

export async function connectRedis(): Promise<void> {
  if (redis) return;

  if (!config.redis.url) {
    logger.warn('REDIS_URL not set — list caching disabled');
    return;
  }

  const client = createRedisClient(config.redis.url);

  client.on('error', () => {
    // Swallow connection errors — connect() handles startup; enabled clients log below.
  });

  try {
    await client.connect();
    client.removeAllListeners('error');
    client.on('error', (err) => {
      logger.warn({ err }, 'Redis connection error');
    });
    redis = client;
    logger.info('Connected to Redis');
  } catch (err) {
    await client.quit().catch(() => {});
    if (config.env === 'development') {
      logger.warn({ err }, 'Redis unavailable — continuing without cache (local dev)');
      return;
    }
    throw err;
  }
}

export function getRedis(): RedisClient {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() during startup.');
  }
  return redis;
}

export async function pingRedis(): Promise<boolean> {
  if (!redis) return true;
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
}
