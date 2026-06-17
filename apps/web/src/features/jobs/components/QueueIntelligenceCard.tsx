import type { JobListResponse } from '@retailfixit/shared';
import { JobStatus } from '@retailfixit/shared';

interface QueueIntelligenceCardProps {
  data?: JobListResponse;
  isLoading?: boolean;
}

const PENDING_STATUSES = new Set<string>([
  JobStatus.Created,
  JobStatus.AwaitingRecommendation,
  JobStatus.RecommendationReady,
  JobStatus.Escalated,
]);

export function QueueIntelligenceCard({ data, isLoading }: QueueIntelligenceCardProps) {
  const pending =
    data?.items.filter((j) => PENDING_STATUSES.has(j.status)).length ?? 0;
  const awaitingAi =
    data?.items.filter((j) => j.status === JobStatus.AwaitingRecommendation).length ?? 0;
  const ready =
    data?.items.filter((j) => j.status === JobStatus.RecommendationReady).length ?? 0;

  let insight = 'Create a job to start the AI dispatch pipeline.';
  if (awaitingAi > 0) {
    insight = `${awaitingAi} job${awaitingAi === 1 ? '' : 's'} awaiting AI vendor matching — recommendations appear in seconds.`;
  } else if (ready > 0) {
    insight = `${ready} job${ready === 1 ? ' is' : 's are'} ready to assign — review AI picks on the job detail page.`;
  } else if (pending > 0) {
    insight = `${pending} open task${pending === 1 ? '' : 's'} in the queue.`;
  }

  return (
    <article className="rf-intel-card">
      <div className="rf-intel-icon" aria-hidden>
        ✦
      </div>
      <div>
        <span className="rf-intel-label">Queue intelligence</span>
        <p className="rf-intel-metric">
          {isLoading ? '…' : pending} <span>pending tasks</span>
        </p>
        <p className="rf-intel-hint">{insight}</p>
      </div>
    </article>
  );
}
