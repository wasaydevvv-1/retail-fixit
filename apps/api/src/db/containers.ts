/**
 * Cosmos DB container definitions. Every tenant-scoped container uses `/tenantId`
 * as the partition key so queries and RU consumption stay tenant-isolated.
 */
export const CONTAINERS = {
  tenants: { id: 'tenants', partitionKey: '/id' },
  users: { id: 'users', partitionKey: '/tenantId' },
  jobs: { id: 'jobs', partitionKey: '/tenantId' },
  vendors: { id: 'vendors', partitionKey: '/tenantId' },
  assignments: { id: 'assignments', partitionKey: '/tenantId' },
  aiRecommendations: { id: 'aiRecommendations', partitionKey: '/tenantId' },
  auditLogs: { id: 'auditLogs', partitionKey: '/tenantId' },
} as const;

export type ContainerName = keyof typeof CONTAINERS;
