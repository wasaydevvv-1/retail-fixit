import * as appInsights from 'applicationinsights';

import { config } from '../config/index.js';
import { logger } from './logger.js';

let enabled = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

/** Boot Application Insights when APPLICATIONINSIGHTS_CONNECTION_STRING is set. */
export function initApplicationInsights(): void {
  const connectionString = config.observability.appInsightsConnectionString;
  if (!connectionString) {
    logger.info('Application Insights disabled (no APPLICATIONINSIGHTS_CONNECTION_STRING)');
    return;
  }

  try {
    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(false)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(false)
      .setAutoDependencyCorrelation(true)
      .setSendLiveMetrics(true)
      .start();

    const client = appInsights.defaultClient;
    if (client) {
      client.context.tags[client.context.keys.cloudRole] = 'retailfixit-api';
      client.commonProperties = {
        service: 'retailfixit-api',
        env: config.env,
      };
    }

    flushTimer = setInterval(() => {
      flushApplicationInsights();
    }, 15_000);

    enabled = true;
    logger.info('Application Insights enabled (explicit request + metric tracking)');
  } catch (err) {
    logger.warn({ err }, 'Application Insights init failed — using local metrics only');
  }
}

export function isApplicationInsightsEnabled(): boolean {
  return enabled;
}

export function trackHttpRequest(input: {
  name: string;
  url: string;
  durationMs: number;
  statusCode: number;
  traceId?: string;
}): void {
  if (!enabled) return;
  const client = appInsights.defaultClient;
  if (!client) return;

  client.trackRequest({
    name: input.name,
    url: input.url,
    duration: input.durationMs,
    resultCode: String(input.statusCode),
    success: input.statusCode < 400,
    properties: input.traceId ? { traceId: input.traceId } : undefined,
  });
}

export function trackExternalDependency(input: {
  name: string;
  data: string;
  durationMs: number;
  success: boolean;
  resultCode?: string | number;
  dependencyType?: string;
  traceId?: string;
}): void {
  if (!enabled) return;
  const client = appInsights.defaultClient;
  if (!client) return;

  client.trackDependency({
    name: input.name,
    data: input.data,
    duration: input.durationMs,
    success: input.success,
    resultCode: input.resultCode,
    dependencyTypeName: input.dependencyType ?? 'HTTP',
    properties: input.traceId ? { traceId: input.traceId } : undefined,
  });
}

export function trackAppInsightsMetric(
  name: string,
  value: number,
  properties: Record<string, string> = {},
): void {
  if (!enabled) return;
  const client = appInsights.defaultClient;
  if (!client) return;

  client.trackMetric({ name, value, properties });
  client.trackEvent({
    name: `metric.${name}`,
    properties: { metric: name, ...properties },
    measurements: { value },
  });
}

export function flushApplicationInsights(): void {
  if (!enabled) return;
  appInsights.defaultClient?.flush();
}

export function shutdownApplicationInsights(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushApplicationInsights();
}
