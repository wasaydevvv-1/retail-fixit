/**
 * Platform metrics facade.
 *
 * Every signal is:
 *  1. Logged as structured Pino output (local dev + Log Analytics ingestion)
 *  2. Aggregated in-memory for GET /observability/summary (demo / local ops)
 *  3. Exported to Application Insights custom metrics when configured
 */
import { trackAppInsightsMetric } from './app-insights.js';
import { logger } from './logger.js';

export interface MetricHistogram {
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
}

export interface MetricsSnapshot {
  generatedAt: string;
  counters: Record<string, number>;
  histograms: Record<string, MetricHistogram>;
}

const counters = new Map<string, number>();
const histograms = new Map<string, MetricHistogram>();

function metricKey(name: string, tags: Record<string, string>): string {
  const parts = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return parts.length > 0 ? `${name}{${parts.join(',')}}` : name;
}

function updateHistogram(key: string, value: number): void {
  const existing = histograms.get(key);
  if (!existing) {
    histograms.set(key, { count: 1, sum: value, min: value, max: value, last: value });
    return;
  }
  existing.count += 1;
  existing.sum += value;
  existing.min = Math.min(existing.min, value);
  existing.max = Math.max(existing.max, value);
  existing.last = value;
}

export function recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
  const key = metricKey(name, tags);
  updateHistogram(key, value);

  logger.info({ metric: name, value, ...tags }, 'metric');
  trackAppInsightsMetric(name, value, tags);
}

export function incrementCounter(name: string, tags: Record<string, string> = {}): void {
  const key = metricKey(name, tags);
  counters.set(key, (counters.get(key) ?? 0) + 1);

  logger.info({ metric: name, value: 1, ...tags }, 'counter');
  trackAppInsightsMetric(name, 1, tags);
}

export function getMetricsSnapshot(): MetricsSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    counters: Object.fromEntries(counters.entries()),
    histograms: Object.fromEntries(histograms.entries()),
  };
}

/** Reset in-memory aggregates (tests only). */
export function resetMetricsForTests(): void {
  counters.clear();
  histograms.clear();
}
