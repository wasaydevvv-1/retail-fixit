import type { JobListQuery, JobListResponse } from '@retailfixit/shared';

import { getRedis, isRedisEnabled } from './redis.client.js';

const LIST_TTL_SECONDS = 60;

function listCacheKeyParts(query: JobListQuery): string {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const status = query.status ?? '';
  const priority = query.priority ?? '';
  const search = (query.search ?? '').trim().toLowerCase();
  return `p${page}:s${pageSize}:st${status}:pr${priority}:q${search}`;
}

export function jobListCacheKey(tenantId: string, query: JobListQuery): string {
  return `jobs:list:${tenantId}:${listCacheKeyParts(query)}`;
}

export async function getCachedJobList(
  tenantId: string,
  query: JobListQuery,
): Promise<JobListResponse | null> {
  if (!isRedisEnabled()) return null;
  const raw = await getRedis().get(jobListCacheKey(tenantId, query));
  if (!raw) return null;
  return JSON.parse(raw) as JobListResponse;
}

export async function setCachedJobList(
  tenantId: string,
  query: JobListQuery,
  response: JobListResponse,
): Promise<void> {
  if (!isRedisEnabled()) return;
  await getRedis().set(
    jobListCacheKey(tenantId, query),
    JSON.stringify(response),
    'EX',
    LIST_TTL_SECONDS,
  );
}

/** Drop all cached list pages for a tenant after writes. */
export async function invalidateJobListCache(tenantId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  const redis = getRedis();
  const pattern = `jobs:list:${tenantId}:*`;
  let cursor = '0';

  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
