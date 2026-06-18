import { Link, useParams, useSearchParams } from 'react-router-dom';
import { JobStatus } from '@retailfixit/shared';

import { useJobsBasePath } from '../../../lib/use-jobs-base-path.js';
import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { AssignVendorForm } from '../components/AssignVendorForm.js';
import { JobDetailSkeleton } from '../components/JobDetailSkeleton.js';
import { JobPriorityBadge } from '../components/JobPriorityBadge.js';
import { JobStatusBadge } from '../components/JobStatusBadge.js';
import { RecommendationPanel } from '../components/RecommendationPanel.js';
import { useJob } from '../hooks/useJob.js';
import { useAuth } from '../../auth/AuthProvider.js';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const tenantId =
    user?.isPlatformAdmin && searchParams.get('tenantId')
      ? searchParams.get('tenantId')!
      : undefined;
  const base = useJobsBasePath();
  const isSupport = base === '/support';
  const { data, isLoading, isError, error } = useJob(id, tenantId);

  if (isLoading) {
    return <JobDetailSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rf-page">
        <Link to={`${base}/jobs`} className="back-link">
          ← Back to jobs
        </Link>
        <ErrorAlert error={error ?? new Error('Job not found')} title="Failed to load job" />
      </div>
    );
  }

  const { job, recommendation, assignableVendors } = data;
  const assignedVendor = assignableVendors.find((v) => v.id === job.assignedVendorId);

  return (
    <div className="rf-page rf-job-detail">
      <div className="rf-job-detail-grid">
        <div className="rf-job-detail-main">
          <section className="rf-panel">
            <div className="rf-job-summary-head">
              <h2>{job.title}</h2>
              <div className="badge-row">
                <JobStatusBadge status={job.status} />
                <JobPriorityBadge priority={job.priority} />
              </div>
            </div>

            <dl className="rf-meta-grid">
              <div>
                <dt>Customer</dt>
                <dd>{job.customerName}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{job.location}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(job.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Job ID</dt>
                <dd>
                  <code>#{job.id.slice(0, 8)}</code>
                </dd>
              </div>
              {assignedVendor && (
                <div>
                  <dt>Assigned vendor</dt>
                  <dd>
                    <strong>{assignedVendor.name}</strong>
                  </dd>
                </div>
              )}
            </dl>

            {job.aiSummary && (
              <div className="rf-ai-summary-block">
                <h3>AI summary</h3>
                <p>{job.aiSummary}</p>
              </div>
            )}
          </section>

          <section className="rf-panel">
            <h3 className="rf-section-title">Job description</h3>
            <blockquote className="rf-desc-quote">&ldquo;{job.rawDescription}&rdquo;</blockquote>

            <div className="rf-mini-cards">
              <div className="rf-mini-card">
                <span>Category</span>
                <strong>
                  {job.requiredSkills.length > 0 ? job.requiredSkills.join(', ') : 'General'}
                </strong>
              </div>
              <div className="rf-mini-card">
                <span>Submission date</span>
                <strong>{new Date(job.createdAt).toLocaleDateString()}</strong>
              </div>
              <div className="rf-mini-card">
                <span>Reported by</span>
                <strong>{job.customerName}</strong>
              </div>
            </div>
          </section>

          {!isSupport && (
            <AssignVendorForm
              jobId={job.id}
              jobStatus={job.status}
              assignableVendors={assignableVendors}
              recommendation={recommendation}
              assignedVendorName={assignedVendor?.name}
            />
          )}

          {isSupport && job.status === JobStatus.Assigned && assignedVendor && (
            <section className="rf-panel">
              <h3>Assignment</h3>
              <p>
                Assigned to <strong>{assignedVendor.name}</strong> (view-only)
              </p>
            </section>
          )}
        </div>

        <RecommendationPanel recommendation={recommendation} jobStatus={job.status} />
      </div>
    </div>
  );
}
