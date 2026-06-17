import { JobStatus, type JobStatus as JobStatusType } from '@retailfixit/shared';

export const JOB_STATUS_LABELS: Record<JobStatusType, string> = {
  [JobStatus.Created]: 'Unscheduled',
  [JobStatus.AwaitingRecommendation]: 'Processing',
  [JobStatus.RecommendationReady]: 'Ready to assign',
  [JobStatus.Assigned]: 'Assigned',
  [JobStatus.InProgress]: 'In progress',
  [JobStatus.Completed]: 'Completed',
  [JobStatus.Cancelled]: 'Cancelled',
  [JobStatus.Escalated]: 'Escalated',
};

/** Curated status filters for the dispatch board — avoids internal pipeline states in the dropdown. */
export const JOB_STATUS_FILTER_OPTIONS: { value: JobStatusType | ''; label: string }[] = [
  { value: '', label: 'All jobs' },
  { value: JobStatus.RecommendationReady, label: JOB_STATUS_LABELS[JobStatus.RecommendationReady] },
  { value: JobStatus.Assigned, label: JOB_STATUS_LABELS[JobStatus.Assigned] },
  { value: JobStatus.InProgress, label: JOB_STATUS_LABELS[JobStatus.InProgress] },
  { value: JobStatus.Completed, label: JOB_STATUS_LABELS[JobStatus.Completed] },
  { value: JobStatus.Escalated, label: JOB_STATUS_LABELS[JobStatus.Escalated] },
];
