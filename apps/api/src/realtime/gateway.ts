import type { Server as HttpServer } from 'node:http';
import type { RealtimeConnectionInfo, RealtimeJobEvent } from '@retailfixit/shared';

/**
 * Pluggable real-time gateway. Local development uses an in-process WebSocket
 * server; production uses Azure SignalR Service. Both deliver messages only to
 * clients in the same business tenant (tenant-scoped broadcast).
 */
export interface RealtimeGateway {
  /** Attach to the HTTP server (local-ws) or open the upstream (SignalR). */
  start(server: HttpServer): Promise<void>;
  /** Deliver an event to every connected client in the given tenant. */
  broadcast(tenantId: string, event: RealtimeJobEvent): Promise<void>;
  /**
   * Returns the connection details a client needs to subscribe. `origin` is the
   * request origin (used to build the local-ws URL).
   */
  negotiate(tenantId: string, userId: string, origin: string): Promise<RealtimeConnectionInfo>;
  /** Number of currently connected clients (0 for stateless SignalR driver). */
  connectionCount(): number;
  stop(): Promise<void>;
}
