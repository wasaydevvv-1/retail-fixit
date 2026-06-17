import type { Vendor, VendorListQuery, VendorListResponse } from '@retailfixit/shared';
import { VendorStatus, vendorMatchesRequiredSkills } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { getContainer } from '../../db/client.js';
import type { VendorDocument } from '../../db/documents.js';
import { AppError } from '../../middleware/error.js';

function toVendor(doc: VendorDocument): Vendor {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    name: doc.name,
    status: doc.status,
    skills: doc.skills,
    serviceAreas: doc.serviceAreas,
    rating: doc.rating,
    activeJobCount: doc.activeJobCount,
    managedByUserId: doc.managedByUserId,
  };
}

export async function createVendorDocument(
  tenantId: string,
  input: Pick<Vendor, 'name' | 'skills' | 'serviceAreas' | 'rating'> & {
    managedByUserId?: string;
  },
): Promise<Vendor> {
  const container = getContainer('vendors');
  const doc: VendorDocument = {
    id: `vendor_${uuid()}`,
    type: 'vendor',
    tenantId,
    name: input.name,
    status: VendorStatus.Active,
    skills: input.skills,
    serviceAreas: input.serviceAreas,
    rating: input.rating,
    activeJobCount: 0,
    managedByUserId: input.managedByUserId,
  };

  const { resource } = await container.items.create(doc);
  if (!resource) {
    throw new AppError(500, 'VENDOR_CREATE_FAILED', 'Failed to persist vendor');
  }
  return toVendor(resource as VendorDocument);
}

export async function findVendorByManagedByUserId(
  tenantId: string,
  userId: string,
): Promise<Vendor | null> {
  const container = getContainer('vendors');
  const { resources } = await container.items
    .query<VendorDocument>({
      query:
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.managedByUserId = @userId',
      parameters: [
        { name: '@tenantId', value: tenantId },
        { name: '@userId', value: userId },
      ],
    })
    .fetchAll();

  const doc = resources[0];
  return doc ? toVendor(doc) : null;
}

export async function updateVendorDocument(
  tenantId: string,
  vendorId: string,
  patch: Partial<Pick<Vendor, 'name' | 'skills' | 'serviceAreas' | 'rating' | 'managedByUserId'>>,
): Promise<Vendor | null> {
  const existing = await findVendorById(tenantId, vendorId);
  if (!existing) return null;

  const container = getContainer('vendors');
  const updated: VendorDocument = {
    ...existing,
    ...patch,
    type: 'vendor',
  };
  const { resource } = await container.items.upsert(updated);
  return resource ? toVendor(resource as unknown as VendorDocument) : null;
}

export async function findVendorById(tenantId: string, vendorId: string): Promise<Vendor | null> {
  const container = getContainer('vendors');
  try {
    const { resource } = await container.item(vendorId, tenantId).read<VendorDocument>();
    return resource ? toVendor(resource) : null;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Adjusts a vendor's open-assignment count (used by the assignment workflow). */
export async function adjustVendorActiveJobCount(
  tenantId: string,
  vendorId: string,
  delta: number,
): Promise<Vendor | null> {
  const vendor = await findVendorById(tenantId, vendorId);
  if (!vendor) return null;

  const container = getContainer('vendors');
  const updated: VendorDocument = {
    ...vendor,
    type: 'vendor',
    activeJobCount: Math.max(0, vendor.activeJobCount + delta),
  };
  const { resource } = await container.items.upsert(updated);
  return resource ? toVendor(resource as unknown as VendorDocument) : null;
}

interface ListFilters {
  status?: VendorListQuery['status'];
  search?: string;
  skills?: string[];
}

function buildListQuery(tenantId: string, filters: ListFilters) {
  const conditions = ['c.tenantId = @tenantId', "c.type = 'vendor'"];
  const parameters: { name: string; value: string | number }[] = [
    { name: '@tenantId', value: tenantId },
  ];

  if (filters.status) {
    conditions.push('c.status = @status');
    parameters.push({ name: '@status', value: filters.status });
  }

  if (filters.search) {
    conditions.push('CONTAINS(LOWER(c.name), @search)');
    parameters.push({ name: '@search', value: filters.search.toLowerCase() });
  }

  if (filters.skills && filters.skills.length > 0) {
    const skillConditions = filters.skills.map((_, i) => `ARRAY_CONTAINS(c.skills, @skill${i})`);
    conditions.push(`(${skillConditions.join(' OR ')})`);
    filters.skills.forEach((skill, i) => {
      parameters.push({ name: `@skill${i}`, value: skill });
    });
  }

  const where = conditions.join(' AND ');
  return { where, parameters };
}

export async function listVendors(
  tenantId: string,
  query: Required<Pick<VendorListQuery, 'page' | 'pageSize'>> & ListFilters,
): Promise<VendorListResponse> {
  const container = getContainer('vendors');
  const { where, parameters } = buildListQuery(tenantId, query);
  const offset = (query.page - 1) * query.pageSize;

  const countQuery = {
    query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`,
    parameters,
  };

  const listQuery = {
    query: `SELECT * FROM c WHERE ${where} ORDER BY c.name ASC OFFSET @offset LIMIT @limit`,
    parameters: [
      ...parameters,
      { name: '@offset', value: offset },
      { name: '@limit', value: query.pageSize },
    ],
  };

  const [{ resources: countRows }, { resources: rows }] = await Promise.all([
    container.items.query<number>(countQuery).fetchAll(),
    container.items.query<VendorDocument>(listQuery).fetchAll(),
  ]);

  const total = countRows[0] ?? 0;
  return {
    items: rows.map(toVendor),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

/** Active vendors with at least one skill matching the job's required skills. */
export async function findAssignableVendors(
  tenantId: string,
  requiredSkills: string[] | undefined,
): Promise<Vendor[]> {
  const skills = requiredSkills ?? [];
  const result = await listVendors(tenantId, {
    page: 1,
    pageSize: 100,
    status: VendorStatus.Active,
  });

  if (skills.length === 0) return result.items;

  return result.items.filter((vendor) =>
    vendorMatchesRequiredSkills(skills, vendor.skills),
  );
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 404
  );
}
