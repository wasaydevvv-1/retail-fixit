import type { Job, JobListQuery, JobListResponse } from '@retailfixit/shared';
import { JobStatus } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';

import { getContainer } from '../../db/client.js';
import type { JobDocument } from '../../db/documents.js';
import { AppError } from '../../middleware/error.js';

function toJob(doc: JobDocument): Job {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    title: doc.title,
    rawDescription: doc.rawDescription,
    aiSummary: doc.aiSummary,
    status: doc.status,
    priority: doc.priority,
    customerName: doc.customerName,
    location: doc.location,
    requiredSkills: doc.requiredSkills ?? [],
    assignedVendorId: doc.assignedVendorId,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function createJobDocument(
  tenantId: string,
  createdBy: string,
  input: Omit<Job, 'id' | 'tenantId' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'>,
): Promise<Job> {
  const container = getContainer('jobs');
  const now = new Date().toISOString();
  const doc: JobDocument = {
    id: `job_${uuid()}`,
    type: 'job',
    tenantId,
    status: JobStatus.Created,
    createdBy,
    createdAt: now,
    updatedAt: now,
    ...input,
  };

  const { resource } = await container.items.create(doc);
  if (!resource) {
    throw new AppError(500, 'JOB_CREATE_FAILED', 'Failed to persist job');
  }
  return toJob(resource as JobDocument);
}

export async function findJobById(tenantId: string, jobId: string): Promise<Job | null> {
  const container = getContainer('jobs');
  try {
    const { resource } = await container.item(jobId, tenantId).read<JobDocument>();
    return resource ? toJob(resource) : null;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function updateJobStatus(
  tenantId: string,
  jobId: string,
  status: JobStatus,
): Promise<Job | null> {
  const job = await findJobById(tenantId, jobId);
  if (!job) return null;

  const container = getContainer('jobs');
  const updated: JobDocument = {
    ...job,
    type: 'job',
    status,
    updatedAt: new Date().toISOString(),
  };
  const { resource } = await container.items.upsert(updated);
  return resource ? toJob(resource as unknown as JobDocument) : null;
}

export async function updateJobAiSummary(
  tenantId: string,
  jobId: string,
  aiSummary: string,
): Promise<Job | null> {
  const job = await findJobById(tenantId, jobId);
  if (!job) return null;

  const container = getContainer('jobs');
  const updated: JobDocument = {
    ...job,
    type: 'job',
    aiSummary,
    updatedAt: new Date().toISOString(),
  };
  const { resource } = await container.items.upsert(updated);
  return resource ? toJob(resource as unknown as JobDocument) : null;
}

/** Links a vendor to a job and moves it to the given status (assignment). */
export async function updateJobAssignment(
  tenantId: string,
  jobId: string,
  assignedVendorId: string,
  status: JobStatus,
): Promise<Job | null> {
  const job = await findJobById(tenantId, jobId);
  if (!job) return null;

  const container = getContainer('jobs');
  const updated: JobDocument = {
    ...job,
    type: 'job',
    assignedVendorId,
    status,
    updatedAt: new Date().toISOString(),
  };
  const { resource } = await container.items.upsert(updated);
  return resource ? toJob(resource as unknown as JobDocument) : null;
}

interface ListFilters {
  status?: JobListQuery['status'];
  priority?: JobListQuery['priority'];
  search?: string;
}

function buildListQuery(tenantId: string, filters: ListFilters) {
  const conditions = ['c.tenantId = @tenantId', "c.type = 'job'"];
  const parameters: { name: string; value: string }[] = [{ name: '@tenantId', value: tenantId }];

  if (filters.status) {
    conditions.push('c.status = @status');
    parameters.push({ name: '@status', value: filters.status });
  }

  if (filters.priority) {
    conditions.push('c.priority = @priority');
    parameters.push({ name: '@priority', value: filters.priority });
  }

  if (filters.search) {
    conditions.push(
      '(CONTAINS(LOWER(c.title), @search) OR CONTAINS(LOWER(c.customerName), @search) OR CONTAINS(LOWER(c.location), @search))',
    );
    parameters.push({ name: '@search', value: filters.search.toLowerCase() });
  }

  const where = conditions.join(' AND ');
  return { where, parameters };
}

export async function listJobs(
  tenantId: string,
  query: Required<Pick<JobListQuery, 'page' | 'pageSize'>> & ListFilters,
): Promise<JobListResponse> {
  const container = getContainer('jobs');
  const { where, parameters } = buildListQuery(tenantId, query);
  const offset = (query.page - 1) * query.pageSize;

  const countQuery = {
    query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`,
    parameters,
  };

  const listQuery = {
    query: `SELECT * FROM c WHERE ${where} ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit`,
    parameters: [
      ...parameters,
      { name: '@offset', value: offset },
      { name: '@limit', value: query.pageSize },
    ],
  };

  const [{ resources: countRows }, { resources: rows }] = await Promise.all([
    container.items.query<number>(countQuery).fetchAll(),
    container.items.query<JobDocument>(listQuery).fetchAll(),
  ]);

  const total = countRows[0] ?? 0;
  return {
    items: rows.map(toJob),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

/** Jobs assigned to a specific vendor company (vendor manager portal). */
export async function listJobsByAssignedVendor(
  tenantId: string,
  vendorId: string,
  query: Required<Pick<JobListQuery, 'page' | 'pageSize'>>,
): Promise<JobListResponse> {
  const container = getContainer('jobs');
  const offset = (query.page - 1) * query.pageSize;
  const baseWhere = "c.tenantId = @tenantId AND c.type = 'job' AND c.assignedVendorId = @vendorId";
  const parameters = [
    { name: '@tenantId', value: tenantId },
    { name: '@vendorId', value: vendorId },
    { name: '@offset', value: offset },
    { name: '@limit', value: query.pageSize },
  ];

  const countQuery = {
    query: `SELECT VALUE COUNT(1) FROM c WHERE ${baseWhere}`,
    parameters: parameters.slice(0, 2),
  };

  const listQuery = {
    query: `SELECT * FROM c WHERE ${baseWhere} ORDER BY c.updatedAt DESC OFFSET @offset LIMIT @limit`,
    parameters,
  };

  const [{ resources: countRows }, { resources: rows }] = await Promise.all([
    container.items.query<number>(countQuery).fetchAll(),
    container.items.query<JobDocument>(listQuery).fetchAll(),
  ]);

  const total = countRows[0] ?? 0;
  return {
    items: rows.map(toJob),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 404
  );
}
