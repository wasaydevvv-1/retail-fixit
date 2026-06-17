import { Router } from 'express';

import { isApplicationInsightsEnabled } from '../../observability/app-insights.js';
import { getMetricsSnapshot } from '../../observability/metrics.js';

export const observabilityRouter = Router();

/**
 * Operational snapshot for demos and local verification.
 * Returns in-memory aggregates since process start (no PII).
 */
observabilityRouter.get('/summary', (_req, res) => {
  res.json({
    service: 'retailfixit-api',
    applicationInsights: isApplicationInsightsEnabled(),
    metrics: getMetricsSnapshot(),
    signals: {
      http_request_duration_ms: 'How fast the server responds to requests',
      api_error_total: 'Failed or rejected requests',
      ai_latency_ms: 'Time to generate a vendor recommendation',
      ai_fallback_total: 'Recommendations made without AI (backup rules)',
      event_publish_lag_ms: 'Delay before background tasks start',
      event_handler_duration_ms: 'How long background tasks take',
      event_handler_success_total: 'Background tasks completed successfully',
      event_handler_error_total: 'Background tasks that failed',
      ai_override_total: 'Dispatchers chose a different vendor than suggested',
      ai_follow_total: 'Dispatchers accepted the top AI suggestion',
    },
  });
});
