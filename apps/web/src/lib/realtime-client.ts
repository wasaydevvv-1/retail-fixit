import * as signalR from '@microsoft/signalr';
import type {
  RealtimeConnectionInfo,
  RealtimeJobEvent,
  RealtimeMessage,
} from '@retailfixit/shared';

import { apiFetch, getStoredToken } from './api-client.js';

export type RealtimeDisconnect = () => void | Promise<void>;

async function negotiate(): Promise<RealtimeConnectionInfo> {
  return apiFetch<RealtimeConnectionInfo>('/realtime/negotiate', { method: 'POST' });
}

/**
 * Azure SignalR Service (serverless). The API returns a pre-negotiated client URL
 * and access token; connect with skipNegotiation + WebSockets per Azure guidance.
 */
async function connectSignalR(
  onEvent: (event: RealtimeJobEvent) => void,
  signal: AbortSignal,
  onDisconnect: () => void,
): Promise<RealtimeDisconnect> {
  const initial = await negotiate();
  if (!initial.accessToken) {
    throw new Error('SignalR negotiate response missing accessToken');
  }

  let latestToken = initial.accessToken;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(initial.url, {
      accessTokenFactory: async () => {
        // Fresh Azure SignalR token + tenant group membership on reconnect.
        const fresh = await negotiate();
        latestToken = fresh.accessToken ?? latestToken;
        return latestToken;
      },
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 15000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on('jobEvent', (message: RealtimeMessage) => {
    onEvent(message.event);
  });

  connection.onclose(() => {
    if (!signal.aborted) onDisconnect();
  });

  const onAbort = () => void connection.stop();
  signal.addEventListener('abort', onAbort);

  await connection.start();

  return async () => {
    signal.removeEventListener('abort', onAbort);
    await connection.stop();
  };
}

/** Local in-process WebSocket gateway used when REALTIME_DRIVER=local-ws. */
async function connectLocalWs(
  info: RealtimeConnectionInfo,
  onEvent: (event: RealtimeJobEvent) => void,
  signal: AbortSignal,
  onDisconnect: () => void,
): Promise<RealtimeDisconnect> {
  const token = getStoredToken();
  const socket = new WebSocket(`${info.url}?access_token=${encodeURIComponent(token ?? '')}`);

  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('Local WebSocket connection failed'));
  });

  socket.onmessage = (ev) => {
    try {
      const message = JSON.parse(ev.data as string) as RealtimeMessage;
      onEvent(message.event);
    } catch {
      // Ignore malformed frames.
    }
  };
  socket.onclose = () => {
    if (!signal.aborted) onDisconnect();
  };

  const onAbort = () => socket.close();
  signal.addEventListener('abort', onAbort);

  return () => {
    signal.removeEventListener('abort', onAbort);
    socket.close();
  };
}

/**
 * Connects to the realtime gateway selected by the API (SignalR or local-ws).
 * `onDisconnect` is called when the transport drops so the caller can reconnect.
 */
export async function connectRealtimeJobs(
  onEvent: (event: RealtimeJobEvent) => void,
  signal: AbortSignal,
  onDisconnect: () => void,
): Promise<RealtimeDisconnect> {
  const info = await negotiate();

  if (info.driver === 'signalr') {
    return connectSignalR(onEvent, signal, onDisconnect);
  }

  return connectLocalWs(info, onEvent, signal, onDisconnect);
}
