/**

 * Express application wiring.

 *

 * Cross-cutting middleware is applied here; feature routers are mounted under

 * the configured API base path. Each feature lives in its own module under

 * `src/modules/*` (vertical slice: routes → service → repository).

 */

import cors from 'cors';

import express, { type Express } from 'express';

import helmet from 'helmet';



import { config } from './config/index.js';

import { isRedisEnabled, pingRedis } from './cache/redis.client.js';

import { pingDatabase } from './db/client.js';

import { getRealtimeGateway } from './realtime/gateway-registry.js';

import { errorHandler } from './middleware/error.js';

import { requestLogging } from './middleware/request-logging.js';

import { requestTracing } from './middleware/request-tracing.js';

import { authRouter } from './modules/auth/auth.routes.js';

import { jobsRouter } from './modules/jobs/jobs.routes.js';

import { vendorsRouter } from './modules/vendors/vendors.routes.js';

import { realtimeRouter } from './modules/realtime/realtime.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { rbacRouter } from './modules/rbac/rbac.routes.js';

import { observabilityRouter } from './modules/observability/observability.routes.js';
import { tenantsRouter } from './modules/tenants/tenants.routes.js';
import { isUsingLiveAi } from './modules/ai/ai.service.js';
import { isEntraAuthEnabled } from './config/index.js';



export function createApp(): Express {

  const app = express();



  app.use(helmet());

  app.use(cors({ origin: config.corsOrigin, credentials: true }));

  app.use(express.json({ limit: '1mb' }));

  app.use(requestTracing);

  app.use(requestLogging);



  // Liveness/readiness probe for Azure Container Apps.

  app.get('/health', async (_req, res) => {

    const [dbOk, redisOk] = await Promise.all([pingDatabase(), pingRedis()]);
    const ok = dbOk && redisOk;

    let realtimeConnections = 0;
    try {
      realtimeConnections = getRealtimeGateway().connectionCount();
    } catch {
      // Gateway not yet initialized — report zero.
    }

    res.status(ok ? 200 : 503).json({

      status: ok ? 'ok' : 'degraded',

      service: 'retailfixit-api',

      drivers: {
        auth: isEntraAuthEnabled() ? 'entra' : 'dev',
        events: config.events.driver,
        realtime: config.realtime.driver,
        ai: isUsingLiveAi() ? 'azure-openai' : config.ai.useMock ? 'mock' : 'fallback',
      },

      checks: {

        database: dbOk ? 'up' : 'down',

        redis: isRedisEnabled() ? (redisOk ? 'up' : 'down') : 'disabled',

        realtime: { driver: config.realtime.driver, connections: realtimeConnections },

      },

      ts: new Date().toISOString(),

    });

  });



  const api = express.Router();

  api.use('/auth', authRouter);

  api.use('/jobs', jobsRouter);

  api.use('/vendors', vendorsRouter);

  api.use('/users', usersRouter);

  api.use('/rbac', rbacRouter);

  api.use('/tenants', tenantsRouter);

  api.use('/observability', observabilityRouter);

  api.use('/realtime', realtimeRouter);

  app.use(config.basePath, api);



  app.use(errorHandler);



  return app;

}

