import { describe, expect, it, beforeEach } from 'vitest';

import {
  getMetricsSnapshot,
  incrementCounter,
  recordMetric,
  resetMetricsForTests,
} from './metrics.js';

describe('metrics', () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it('aggregates counters and histograms', () => {
    incrementCounter('api_error_total', { code: 'NOT_FOUND' });
    incrementCounter('api_error_total', { code: 'NOT_FOUND' });
    recordMetric('ai_latency_ms', 120, { model: 'gpt-4o-mini' });
    recordMetric('ai_latency_ms', 80, { model: 'gpt-4o-mini' });

    const snap = getMetricsSnapshot();
    expect(snap.counters['api_error_total{code=NOT_FOUND}']).toBe(2);

    const hist = snap.histograms['ai_latency_ms{model=gpt-4o-mini}'];
    expect(hist?.count).toBe(2);
    expect(hist?.sum).toBe(200);
    expect(hist?.min).toBe(80);
    expect(hist?.max).toBe(120);
  });
});
