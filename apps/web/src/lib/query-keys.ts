import type { JobListQuery } from '@retailfixit/shared';

export const queryKeys = {
  jobs: {
    all: ['jobs'] as const,
    lists: ['jobs', 'list'] as const,
    list: (filters: JobListQuery) => ['jobs', 'list', filters] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
  },
};
