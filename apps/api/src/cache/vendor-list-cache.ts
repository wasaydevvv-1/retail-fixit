import type { VendorListQuery, VendorListResponse } from '@retailfixit/shared';

import { getRedis, isRedisEnabled } from './redis.client.js';

const LIST_TTL_SECONDS = 60;

function listCacheKeyParts(query: VendorListQuery): string {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const status = query.status ?? '';
  const search = (query.search ?? '').trim().toLowerCase();
  const skills = (query.skills ?? []).slice().sort().join(',');
  return `p${page}:s${pageSize}:st${status}:q${search}:sk${skills}`;
}

export function vendorListCacheKey(tenantId: string, query: VendorListQuery): string {
  return `vendors:list:${tenantId}:${listCacheKeyParts(query)}`;
}

export async function getCachedVendorList(
  tenantId: string,
  query: VendorListQuery,
): Promise<VendorListResponse | null> {
  if (!isRedisEnabled()) return null;
  const raw = await getRedis().get(vendorListCacheKey(tenantId, query));
  if (!raw) return null;
  return JSON.parse(raw) as VendorListResponse;
}

export async function setCachedVendorList(
  tenantId: string,
  query: VendorListQuery,
  response: VendorListResponse,
): Promise<void> {
  if (!isRedisEnabled()) return;
  await getRedis().set(
    vendorListCacheKey(tenantId, query),
    JSON.stringify(response),
    'EX',
    LIST_TTL_SECONDS,
  );
}

export async function invalidateVendorListCache(tenantId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  const redis = getRedis();
  const pattern = `vendors:list:${tenantId}:*`;
  let cursor = '0';

  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
