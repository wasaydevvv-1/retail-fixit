import { Link, useParams } from 'react-router-dom';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { JobPriorityBadge } from '../../jobs/components/JobPriorityBadge.js';
import { JobStatusBadge } from '../../jobs/components/JobStatusBadge.js';
import { useMyAssignedJob } from '../hooks/useVendorProfile.js';

export function VendorJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading, isError, error } = useMyAssignedJob(id);

  if (isLoading) {
    return <p>Loading job…</p>;
  }

  if (isError || !job) {
    return (
      <div className="portal-page">
        <Link to="/vendor/jobs" className="back-link">
          ← Back to my jobs
        </Link>
        <ErrorAlert error={error ?? new Error('Job not found')} title="Failed to load job" />
      </div>
    );
  }

  return (
    <div className="portal-page job-detail">
      <Link to="/vendor/jobs" className="back-link">
        ← Back to my jobs
      </Link>

      <section className="card">
        <div className="section-header">
          <h2>{job.title}</h2>
          <div className="badge-row">
            <JobStatusBadge status={job.status} />
            <JobPriorityBadge priority={job.priority} />
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Customer</dt>
            <dd>{job.customerName}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{job.location}</dd>
          </div>
          <div>
            <dt>Skills required</dt>
            <dd>{job.requiredSkills.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{new Date(job.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>

        <div className="detail-section">
          <h3>Work description</h3>
          <p>{job.rawDescription}</p>
        </div>

        {job.aiSummary && (
          <div className="detail-section">
            <h3>Summary</h3>
            <p>{job.aiSummary}</p>
          </div>
        )}
      </section>
    </div>
  );
}
