import { Link, useOutletContext } from 'react-router-dom';
import type { Job } from '@retailfixit/shared';

import { useJobsBasePath } from '../../../lib/use-jobs-base-path.js';
import { JobPriorityBadge } from './JobPriorityBadge.js';
import { JobStatusBadge } from './JobStatusBadge.js';

interface JobTableProps {
  jobs: Job[];
}

interface OutletContext {
  flashJobId?: string | null;
}

export function JobTable({ jobs }: JobTableProps) {
  const base = useJobsBasePath();
  const { flashJobId } = useOutletContext<OutletContext>();

  if (jobs.length === 0) {
    return (
      <div className="rf-empty">
        <p>No jobs match your filters.</p>
        {base === '/dispatch' && (
          <Link to={`${base}/jobs/new`} className="btn-rf btn-rf--primary">
            Create your first job
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="table-wrap rf-table-wrap">
      <table className="rf-table">
        <thead>
          <tr>
            <th>Job title</th>
            <th>Customer</th>
            <th>Location</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Created</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className={flashJobId === job.id ? 'rf-row-flash' : undefined}
            >
              <td>
                <Link to={`${base}/jobs/${job.id}`} className="rf-job-link">
                  <span className="rf-job-link-title">{job.title}</span>
                  <span className="rf-job-link-id">#{job.id.slice(0, 8)}</span>
                </Link>
              </td>
              <td>{job.customerName}</td>
              <td className="rf-muted">{job.location}</td>
              <td>
                <JobStatusBadge status={job.status} />
              </td>
              <td>
                <JobPriorityBadge priority={job.priority} />
              </td>
              <td className="rf-muted">{new Date(job.createdAt).toLocaleString()}</td>
              <td>
                <Link to={`${base}/jobs/${job.id}`} className="rf-row-action" aria-label="Open job">
                  ⋮
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
