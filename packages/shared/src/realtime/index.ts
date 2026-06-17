/**
 * Real-time message contract shared by the API (broadcaster) and SPA (subscriber).
 *
 * Messages are tenant-scoped: the gateway only delivers a message to clients in
 * the same business tenant. The SPA uses `type` to decide how to react (refresh a
 * list, patch a row, show a toast).
 */

import type { JobStatus } from '../enums/index.js';

export const RealtimeEventType = {
  /** A job's status changed (created → awaiting → recommendation_ready, etc.). */
  JobStatusChanged: 'job.status_changed',
  /** AI recommendation is ready for dispatcher review. */
  JobRecommendationReady: 'job.recommendation_ready',
  /** A vendor was assigned to a job. */
  JobAssigned: 'job.assigned',
} as const;
export type RealtimeEventType =
  (typeof RealtimeEventType)[keyof typeof RealtimeEventType];

/** Payload broadcast to dashboards when a job changes. */
export interface RealtimeJobEvent {
  type: RealtimeEventType;
  jobId: string;
  status: JobStatus;
  /** Present on assignment events. */
  assignedVendorId?: string;
  /** ISO timestamp when the change occurred. */
  occurredAt: string;
}

/** Envelope sent over the wire. `tenantId` lets the client double-check scoping. */
export interface RealtimeMessage {
  tenantId: string;
  event: RealtimeJobEvent;
}

/** Logical hub/channel name (Azure SignalR hub + local-ws path segment). */
export const REALTIME_HUB = 'jobs';

/** Returned by the negotiate endpoint so the SPA knows how to connect. */
export interface RealtimeConnectionInfo {
  driver: 'local-ws' | 'signalr';
  /** WebSocket URL (local-ws) or SignalR client URL (signalr). */
  url: string;
  /** Access token for the SignalR client connection (signalr driver only). */
  accessToken?: string;
  hub: string;
}
