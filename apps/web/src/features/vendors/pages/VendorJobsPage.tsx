import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { JobPriorityBadge } from '../../jobs/components/JobPriorityBadge.js';
import { JobStatusBadge } from '../../jobs/components/JobStatusBadge.js';
import { Pagination } from '../../jobs/components/Pagination.js';
import { useMyAssignedJobs } from '../hooks/useVendorProfile.js';

export function VendorJobsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useMyAssignedJobs(page);

  return (
    <div className="portal-page">
      <header className="portal-page-header">
        <div>
          <p className="eyebrow">Vendor manager</p>
          <h1>My assigned jobs</h1>
          <p className="lede">
            Jobs dispatched to your company. Updates live when a dispatcher assigns new work.
          </p>
        </div>
      </header>

      <section className="card">
        {isLoading ? (
          <p>Loading assigned jobs…</p>
        ) : isError ? (
          <ErrorAlert error={error} title="Failed to load assigned jobs" />
        ) : (data?.items.length ?? 0) === 0 ? (
          <p className="hint">No jobs assigned to your company yet.</p>
        ) : (
          <>
            {isFetching && !isLoading && <p className="live-indicator">Refreshing…</p>}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Customer</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <Link to={`/vendor/jobs/${job.id}`} className="table-link">
                          {job.title}
                        </Link>
                      </td>
                      <td>{job.customerName}</td>
                      <td>{job.location}</td>
                      <td>
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td>
                        <JobPriorityBadge priority={job.priority} />
                      </td>
                      <td>{new Date(job.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data?.page ?? 1}
              pageSize={data?.pageSize ?? 20}
              total={data?.total ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}
