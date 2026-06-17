import type { AIRecommendation } from '@retailfixit/shared';
import { JobStatus } from '@retailfixit/shared';

interface RecommendationPanelProps {
  recommendation?: AIRecommendation;
  jobStatus?: string;
}

export function RecommendationPanel({ recommendation, jobStatus }: RecommendationPanelProps) {
  const processing = jobStatus === JobStatus.AwaitingRecommendation;

  if (!recommendation) {
    return (
      <aside className="rf-ai-panel">
        <header className="rf-ai-panel-head">
          <span className="rf-ai-spark" aria-hidden>
            ✦
          </span>
          <h2>AI recommendation</h2>
        </header>
        {processing ? (
          <div className="rf-ai-processing">
            <div className="rf-spinner" aria-hidden />
            <p>Analyzing vendors and generating ranked recommendations…</p>
          </div>
        ) : (
          <p className="hint">No recommendation yet. Check back in a moment.</p>
        )}
      </aside>
    );
  }

  const top = recommendation.candidates[0];
  const matchPct = top ? Math.round(top.score * 100) : 0;

  return (
    <aside className="rf-ai-panel">
      <header className="rf-ai-panel-head">
        <span className="rf-ai-spark" aria-hidden>
          ✦
        </span>
        <h2>AI recommendation</h2>
        {top && <span className="rf-match-badge">{matchPct}% match</span>}
      </header>

      {recommendation.usedFallback && (
        <span className="rf-fallback-badge">Standard matching rules</span>
      )}

      {top ? (
        <>
          <div className="rf-ai-candidate">
            <span className="rf-ai-candidate-label">Primary candidate</span>
            <strong>{top.vendorName}</strong>
            <div className="rf-tag-row">
              <span className="rf-tag">Licensed</span>
              <span className="rf-tag">Insured</span>
            </div>
          </div>

          <blockquote className="rf-ai-quote">{top.reason}</blockquote>

          <div className="rf-telemetry">
            <div>
              <span>Source</span>
              <strong>{recommendation.usedFallback ? 'Standard rules' : 'AI assistant'}</strong>
            </div>
            <div>
              <span>Response time</span>
              <strong className="rf-telemetry-good">{recommendation.latencyMs} ms</strong>
            </div>
          </div>

          <div className="rf-ai-reasons">
            <h3>AI reasoning</h3>
            <ul>
              {recommendation.candidates.slice(0, 3).map((c, i) => (
                <li key={c.vendorId}>
                  <strong>#{i + 1}</strong> {c.vendorName} — {Math.round(c.score * 100)}% — {c.reason}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="hint">No vendor candidates returned.</p>
      )}
    </aside>
  );
}
