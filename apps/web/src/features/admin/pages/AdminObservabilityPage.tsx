import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { METRIC_LABELS } from '../../../lib/user-messages.js';
import { useObservabilitySummary } from '../hooks/useObservabilitySummary.js';

const KEY_METRICS = [
  'http_request_duration_ms',
  'api_error_total',
  'ai_latency_ms',
  'ai_success_total',
  'ai_fallback_total',
  'ai_override_total',
  'ai_follow_total',
  'event_publish_lag_ms',
  'event_handler_duration_ms',
] as const;

function matchesKey(metricKey: string, baseName: string): boolean {
  return metricKey === baseName || metricKey.startsWith(`${baseName}{`);
}

function formatHistogram(h: { count: number; sum: number; last: number }): string {
  const avg = h.count > 0 ? Math.round(h.sum / h.count) : 0;
  return `${h.last} ms avg ${avg} ms (${h.count} samples)`;
}

export function AdminObservabilityPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useObservabilitySummary();

  return (
    <div className="rf-page">
      <p className="hint rf-page-lede">
        Live activity from this server session. Refresh after creating jobs or assigning vendors to
        see updated numbers. Historical reports in your cloud dashboard may take a few minutes to
        catch up.
      </p>

      <div className="rf-kpi-grid">
        <article className="rf-kpi-card">
          <span className="rf-kpi-label">Cloud monitoring</span>
          <strong className="rf-kpi-value">{data?.applicationInsights ? 'On' : 'Off'}</strong>
          <span className="rf-kpi-trend">
            {data?.applicationInsights
              ? 'Sending telemetry to your monitoring service'
              : 'Not configured for this environment'}
          </span>
        </article>
        <article className="rf-kpi-card">
          <span className="rf-kpi-label">Live snapshot</span>
          <strong className="rf-kpi-value">{data ? 'Ready' : '—'}</strong>
          <span className="rf-kpi-trend">
            {data?.metrics.generatedAt
              ? `Updated ${new Date(data.metrics.generatedAt).toLocaleTimeString()}`
              : 'Waiting for data'}
          </span>
        </article>
      </div>

      <section className="rf-panel">
        <div className="rf-panel-toolbar">
          <h2>Platform activity</h2>
          <button type="button" className="btn-secondary" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {isLoading ? (
          <p>Loading activity…</p>
        ) : isError ? (
          <ErrorAlert error={error} title="Could not load system activity" />
        ) : data ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>What it means</th>
                  </tr>
                </thead>
                <tbody>
                  {KEY_METRICS.map((name) => {
                    const counterEntries = Object.entries(data.metrics.counters).filter(([k]) =>
                      matchesKey(k, name),
                    );
                    const histogramEntries = Object.entries(data.metrics.histograms).filter(([k]) =>
                      matchesKey(k, name),
                    );
                    const counterTotal = counterEntries.reduce((sum, [, v]) => sum + v, 0);
                    const histogramSummary = histogramEntries
                      .map(([, h]) => formatHistogram(h))
                      .join('; ');

                    let value = '—';
                    if (counterTotal > 0) value = String(counterTotal);
                    else if (histogramSummary) value = histogramSummary;

                    return (
                      <tr key={name}>
                        <td>{METRIC_LABELS[name] ?? name}</td>
                        <td>{value}</td>
                        <td className="hint">{data.signals[name] ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <details className="rf-observability-raw">
              <summary>Technical details (for support)</summary>
              <pre>{JSON.stringify(data.metrics, null, 2)}</pre>
            </details>
          </>
        ) : null}
      </section>
    </div>
  );
}
