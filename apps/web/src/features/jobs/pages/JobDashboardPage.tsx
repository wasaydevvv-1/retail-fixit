import { useEffect, useMemo, useState } from 'react';
import type { JobListQuery } from '@retailfixit/shared';
import { Permission } from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { JobFilters } from '../components/JobFilters.js';
import { JobListSkeleton } from '../components/JobListSkeleton.js';
import { JobTable } from '../components/JobTable.js';
import { Pagination } from '../components/Pagination.js';
import { QueueIntelligenceCard } from '../components/QueueIntelligenceCard.js';
import { useJobsBasePath } from '../../../lib/use-jobs-base-path.js';
import { useJobs } from '../hooks/useJobs.js';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function JobDashboardPage() {
  const { can } = useAuth();
  const base = useJobsBasePath();
  const isSupport = base === '/support';
  const [filters, setFilters] = useState<JobListQuery>({ page: 1, pageSize: 20 });
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const { data, isLoading, isError, error, isFetching } = useJobs(queryFilters);

  return (
    <div className="rf-page">
      {!isSupport && can(Permission.JobsCreate) && (
        <QueueIntelligenceCard data={data} isLoading={isLoading} />
      )}

      {isSupport && (
        <article className="rf-ops-iq">
          <span className="rf-ai-spark" aria-hidden>
            ✦
          </span>
          <div>
            <strong>Ops IQ</strong>
            <p className="hint">
              View-only access for support agents. Search jobs by title, customer, or location —
              dispatch and assignment actions are restricted.
            </p>
          </div>
        </article>
      )}

      <section className="rf-panel rf-panel--table">
        <div className="rf-panel-toolbar rf-panel-toolbar--stacked">
          <div className="rf-panel-toolbar__row">
            <h2>{isSupport ? 'Active job inventory' : 'Job queue'}</h2>
            <div className="rf-panel-toolbar__meta">
              {isFetching && !isLoading && <span className="rf-live-pill">Refreshing…</span>}
              {data && <span className="hint">{data.total} job{data.total === 1 ? '' : 's'}</span>}
            </div>
          </div>
          <JobFilters filters={filters} onChange={setFilters} />
        </div>

        {isLoading ? (
          <JobListSkeleton />
        ) : isError ? (
          <ErrorAlert error={error} title="Failed to load jobs" />
        ) : (
          <>
            <JobTable jobs={data?.items ?? []} />
            <Pagination
              page={data?.page ?? 1}
              pageSize={data?.pageSize ?? 20}
              total={data?.total ?? 0}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </section>
    </div>
  );
}
