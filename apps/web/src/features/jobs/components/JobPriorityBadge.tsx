import type { JobPriority } from '@retailfixit/shared';

const PRIORITY_LABELS: Record<JobPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

interface JobPriorityBadgeProps {
  priority: JobPriority;
}

export function JobPriorityBadge({ priority }: JobPriorityBadgeProps) {
  return (
    <span className={`rf-priority rf-priority--${priority}`}>
      <PriorityIcon priority={priority} />
      {PRIORITY_LABELS[priority].toUpperCase()}
    </span>
  );
}

function PriorityIcon({ priority }: { priority: JobPriority }) {
  if (priority === 'critical') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.5l6.5 11H1.5L8 1.5z" fill="currentColor" />
        <path d="M8 6v3.5M8 11.5v.5" stroke="#0b0e11" strokeWidth="1.2" />
      </svg>
    );
  }
  if (priority === 'high') {
    return <span aria-hidden>▲</span>;
  }
  if (priority === 'low') {
    return <span aria-hidden>▼</span>;
  }
  return <span aria-hidden>—</span>;
}
