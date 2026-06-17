import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { URL } from 'node:url';
import type {
  RealtimeConnectionInfo,
  RealtimeJobEvent,
  RealtimeMessage,
} from '@retailfixit/shared';
import { REALTIME_HUB } from '@retailfixit/shared';
import { WebSocket, WebSocketServer } from 'ws';

import { config } from '../config/index.js';
import { logger } from '../observability/logger.js';
import { verifyAccessToken } from '../modules/auth/token-verifier.js';
import type { RealtimeGateway } from './gateway.js';

const REALTIME_PATH = '/realtime';

/** WebSocket annotated with the tenant it belongs to (for scoped broadcasts). */
interface TenantSocket extends WebSocket {
  tenantId?: string;
}

/**
 * In-process WebSocket gateway for local development. Clients connect to
 * `ws://host/realtime?access_token=<jwt>`; the token is verified and the socket
 * is tagged with its tenant so broadcasts stay tenant-scoped.
 */
export class LocalWebSocketGateway implements RealtimeGateway {
  private wss: WebSocketServer | null = null;
  private readonly tenants = new Map<string, Set<TenantSocket>>();

  async start(server: HttpServer): Promise<void> {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      void this.handleUpgrade(req, socket as Duplex, head);
    });

    logger.info({ path: REALTIME_PATH }, 'Local WebSocket realtime gateway started');
  }

  private async handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const { pathname, token } = this.parseRequest(req);
    if (pathname !== REALTIME_PATH) {
      socket.destroy();
      return;
    }

    let tenantId: string;
    try {
      const claims = await verifyAccessToken(token);
      tenantId = claims.tenantId ?? config.auth.defaultTenantId;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss!.handleUpgrade(req, socket, head, (ws) => {
      this.register(ws as TenantSocket, tenantId);
    });
  }

  private parseRequest(req: IncomingMessage): { pathname: string; token: string } {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    return {
      pathname: url.pathname,
      token: url.searchParams.get('access_token') ?? '',
    };
  }

  private register(ws: TenantSocket, tenantId: string): void {
    ws.tenantId = tenantId;
    const group = this.tenants.get(tenantId) ?? new Set<TenantSocket>();
    group.add(ws);
    this.tenants.set(tenantId, group);

    ws.on('close', () => {
      group.delete(ws);
      if (group.size === 0) this.tenants.delete(tenantId);
    });
    ws.on('error', () => ws.close());

    logger.debug({ tenantId, connections: group.size }, 'Realtime client connected');
  }

  async broadcast(tenantId: string, event: RealtimeJobEvent): Promise<void> {
    const group = this.tenants.get(tenantId);
    if (!group || group.size === 0) return;

    const message: RealtimeMessage = { tenantId, event };
    const data = JSON.stringify(message);

    for (const ws of group) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }

  async negotiate(
    _tenantId: string,
    _userId: string,
    origin: string,
  ): Promise<RealtimeConnectionInfo> {
    // The client appends its own ?access_token=<jwt>; tenant scoping is derived
    // from that token server-side during the upgrade handshake.
    const wsUrl = origin.replace(/^http/, 'ws') + REALTIME_PATH;
    return { driver: 'local-ws', url: wsUrl, hub: REALTIME_HUB };
  }

  connectionCount(): number {
    let total = 0;
    for (const group of this.tenants.values()) total += group.size;
    return total;
  }

  async stop(): Promise<void> {
    if (!this.wss) return;
    for (const group of this.tenants.values()) {
      for (const ws of group) ws.close();
    }
    this.tenants.clear();
    await new Promise<void>((resolve) => this.wss!.close(() => resolve()));
    this.wss = null;
  }
}
