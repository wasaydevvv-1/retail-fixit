import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '../../../lib/api-client.js';

export interface MetricHistogram {
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
}

export interface ObservabilitySummaryResponse {
  service: string;
  applicationInsights: boolean;
  metrics: {
    generatedAt: string;
    counters: Record<string, number>;
    histograms: Record<string, MetricHistogram>;
  };
  signals: Record<string, string>;
}

export function useObservabilitySummary() {
  return useQuery({
    queryKey: ['observability', 'summary'],
    queryFn: () => apiFetch<ObservabilitySummaryResponse>('/observability/summary'),
    refetchInterval: 15_000,
  });
}
