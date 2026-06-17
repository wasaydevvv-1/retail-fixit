import type { NextFunction, Request, Response } from 'express';

import { logger } from '../observability/logger.js';
import { trackHttpRequest } from '../observability/app-insights.js';
import { incrementCounter, recordMetric } from '../observability/metrics.js';

/** Logs every HTTP request with duration and records API latency / error metrics. */
export function requestLogging(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - started;
    const status = res.statusCode;
    const path = req.originalUrl.split('?')[0] ?? req.path;
    const tags = {
      method: req.method,
      status: String(status),
      path: normalizePathForMetrics(path),
    };

    logger.info(
      {
        traceId: req.traceId,
        method: req.method,
        path,
        status,
        durationMs,
      },
      'HTTP request',
    );

    recordMetric('http_request_duration_ms', durationMs, tags);

    trackHttpRequest({
      name: `${req.method} ${tags.path}`,
      url: `${req.protocol}://${req.get('host') ?? 'localhost'}${path}`,
      durationMs,
      statusCode: status,
      traceId: req.traceId,
    });

    if (status >= 500) {
      incrementCounter('api_error_total', { ...tags, class: '5xx' });
    } else if (status >= 400) {
      incrementCounter('api_error_total', { ...tags, class: '4xx' });
    }
  });

  next();
}

/** Collapse UUID segments so metrics cardinality stays bounded. */
function normalizePathForMetrics(path: string): string {
  return path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id',
  ).replace(/\/[a-f0-9]{24,}/gi, '/:id');
}
