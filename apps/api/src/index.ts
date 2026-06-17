/**
 * API entry point. Bootstraps configuration, the HTTP server, the event bus,
 * and the real-time gateway, then wires graceful shutdown.
 */
import './config/load-env.js';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectRedis, closeRedis } from './cache/redis.client.js';
import { closeDatabase, connectDatabase } from './db/client.js';
import { bootstrapEventHandlers } from './events/bootstrap.js';
import { stopEventBus } from './events/event-bus-registry.js';
import { initRealtimeGateway, stopRealtimeGateway } from './realtime/gateway-registry.js';
import { initApplicationInsights, shutdownApplicationInsights } from './observability/app-insights.js';
import { logger } from './observability/logger.js';

let shuttingDown = false;

async function main(): Promise<void> {
  initApplicationInsights();
  await connectDatabase();
  await connectRedis();
  await bootstrapEventHandlers();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, basePath: config.basePath, env: config.env },
      'RetailFixIt API started',
    );
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        { port: config.port },
        'Port already in use — stop the other API process (or wait for restart) and try again',
      );
      process.exit(1);
      return;
    }
    logger.error({ err }, 'HTTP server error');
    process.exit(1);
  });

  await initRealtimeGateway(server);

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    server.closeAllConnections?.();

    // node --watch spawns a new process before the old one exits; release the port immediately in dev.
    if (config.env === 'development') {
      shutdownApplicationInsights();
      server.close();
      process.exit(0);
      return;
    }

    shutdownApplicationInsights();

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    await stopRealtimeGateway();
    await stopEventBus();
    await closeRedis();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
