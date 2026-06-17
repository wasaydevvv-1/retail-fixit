import type { Server as HttpServer } from 'node:http';

import { config } from '../config/index.js';
import type { RealtimeGateway } from './gateway.js';
import { LocalWebSocketGateway } from './local-ws-gateway.js';
import { SignalRGateway } from './signalr-gateway.js';

let gateway: RealtimeGateway | null = null;

export function getRealtimeGateway(): RealtimeGateway {
  if (!gateway) {
    throw new Error('Realtime gateway not initialized. Call initRealtimeGateway() at startup.');
  }
  return gateway;
}

export async function initRealtimeGateway(server: HttpServer): Promise<RealtimeGateway> {
  if (gateway) return gateway;

  if (config.realtime.driver === 'signalr') {
    if (!config.realtime.signalrConnectionString.trim()) {
      throw new Error(
        'REALTIME_DRIVER=signalr requires SIGNALR_CONNECTION_STRING to be set in the environment',
      );
    }
    gateway = new SignalRGateway(config.realtime.signalrConnectionString);
  } else {
    gateway = new LocalWebSocketGateway();
  }

  await gateway.start(server);
  return gateway;
}

export async function stopRealtimeGateway(): Promise<void> {
  if (gateway) {
    await gateway.stop();
    gateway = null;
  }
}
