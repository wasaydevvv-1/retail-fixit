import { useEffect, useRef } from 'react';
import type { RealtimeJobEvent } from '@retailfixit/shared';

import { connectRealtimeJobs } from '../../lib/realtime-client.js';

type JobEventHandler = (event: RealtimeJobEvent) => void;

/**
 * Subscribes to live job updates for the current tenant.
 * `onConnected` fires when the transport is established.
 */
export function useRealtimeJobs(
  onEvent: JobEventHandler,
  enabled = true,
  onConnected?: () => void,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const abort = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disconnect: (() => void | Promise<void>) | null = null;
    let attempts = 0;

    function scheduleReconnect(): void {
      if (abort.signal.aborted) return;
      attempts += 1;
      const delay = Math.min(1000 * 2 ** attempts, 15000);
      reconnectTimer = setTimeout(() => void connect(), delay);
    }

    async function connect(): Promise<void> {
      if (abort.signal.aborted) return;
      try {
        if (disconnect) {
          await disconnect();
          disconnect = null;
        }
        disconnect = await connectRealtimeJobs(
          (event) => handlerRef.current(event),
          abort.signal,
          scheduleReconnect,
        );
        attempts = 0;
        onConnected?.();
      } catch (err) {
        if (abort.signal.aborted) return;
        console.warn('Realtime connection failed, retrying…', err);
        scheduleReconnect();
      }
    }

    void connect();

    return () => {
      abort.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      void disconnect?.();
    };
  }, [enabled, onConnected]);
}
