import type { Server as HttpServer } from 'node:http';
import type { RealtimeConnectionInfo, RealtimeJobEvent } from '@retailfixit/shared';
import { REALTIME_HUB } from '@retailfixit/shared';
import jwt from 'jsonwebtoken';

import { logger } from '../observability/logger.js';
import type { RealtimeGateway } from './gateway.js';

const API_VERSION = '2022-11-01';

interface ParsedConnection {
  endpoint: string;
  accessKey: string;
}

/** Tenant broadcast group name. */
function tenantGroup(tenantId: string): string {
  return `tenant_${tenantId}`;
}

/**
 * Azure SignalR Service gateway (serverless mode). Broadcasts via the data-plane
 * REST API and issues client access tokens scoped to a tenant group, so messages
 * stay tenant-isolated. No persistent connections are held on the API process.
 */
export class SignalRGateway implements RealtimeGateway {
  private readonly conn: ParsedConnection;

  constructor(connectionString: string) {
    this.conn = SignalRGateway.parseConnectionString(connectionString);
  }

  static parseConnectionString(value: string): ParsedConnection {
    const trimmed = value.trim();
    // Regex handles pasted strings with accidental prefixes (e.g. "Endpoint=Key=Endpoint=...").
    const endpointRaw = trimmed.match(/Endpoint=(https:\/\/[^;]+)/i)?.[1]?.trim() ?? '';
    const accessKey = trimmed.match(/AccessKey=([^;]+)/i)?.[1]?.trim() ?? '';
    const endpoint = endpointRaw.replace(/\/$/, '');

    if (!endpoint || !accessKey) {
      throw new Error('Invalid SIGNALR_CONNECTION_STRING (need Endpoint and AccessKey)');
    }
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== 'https:') {
        throw new Error('Endpoint must use https');
      }
    } catch {
      throw new Error(`Invalid SIGNALR_CONNECTION_STRING endpoint: "${endpoint}"`);
    }
    return { endpoint, accessKey };
  }

  async start(_server: HttpServer): Promise<void> {
    logger.info({ endpoint: this.conn.endpoint }, 'Azure SignalR realtime gateway ready');
  }

  /** Signs a short-lived JWT bound to a specific SignalR REST/client audience. */
  private signToken(audience: string, userId?: string): string {
    const payload: Record<string, unknown> = {};
    if (userId) payload.nameid = userId;
    return jwt.sign(payload, this.conn.accessKey, {
      algorithm: 'HS256',
      audience,
      expiresIn: '1h',
    });
  }

  private async restCall(url: string, method: string, body?: unknown): Promise<Response> {
    const token = this.signToken(url);
    return fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async broadcast(tenantId: string, event: RealtimeJobEvent): Promise<void> {
    const group = tenantGroup(tenantId);
    const url = `${this.conn.endpoint}/api/hubs/${REALTIME_HUB}/groups/${group}/:send?api-version=${API_VERSION}`;
    const res = await this.restCall(url, 'POST', {
      target: 'jobEvent',
      arguments: [{ tenantId, event }],
    });
    if (!res.ok) {
      logger.error({ status: res.status, group }, 'SignalR broadcast failed');
    }
  }

  async negotiate(
    tenantId: string,
    userId: string,
    _origin: string,
  ): Promise<RealtimeConnectionInfo> {
    const group = tenantGroup(tenantId);

    // Add the user to its tenant group so it only receives same-tenant events.
    const addUrl = `${this.conn.endpoint}/api/hubs/${REALTIME_HUB}/groups/${group}/users/${encodeURIComponent(userId)}?api-version=${API_VERSION}`;
    try {
      const res = await this.restCall(addUrl, 'PUT');
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.warn({ status: res.status, userId, group, body }, 'SignalR add-to-group failed');
      }
    } catch (err) {
      // Group membership is best-effort — still return a client token so negotiate succeeds.
      logger.warn({ err, userId, group }, 'SignalR add-to-group request failed');
    }

    const clientUrl = `${this.conn.endpoint}/client/?hub=${REALTIME_HUB}`;
    const accessToken = this.signToken(clientUrl, userId);
    return { driver: 'signalr', url: clientUrl, accessToken, hub: REALTIME_HUB };
  }

  connectionCount(): number {
    return 0;
  }

  async stop(): Promise<void> {
    // Stateless — nothing to tear down.
  }
}
