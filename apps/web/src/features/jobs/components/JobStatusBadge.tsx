import { type JobStatus as JobStatusType } from '@retailfixit/shared';

import { JOB_STATUS_LABELS } from '../lib/job-status-labels.js';

interface JobStatusBadgeProps {
  status: JobStatusType;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  return (
    <span className={`rf-status rf-status--${status}`}>{JOB_STATUS_LABELS[status].toUpperCase()}</span>
  );
}
