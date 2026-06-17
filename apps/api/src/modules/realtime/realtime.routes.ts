import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { getRealtimeGateway } from '../../realtime/gateway-registry.js';

export const realtimeRouter = Router();

realtimeRouter.use(authenticate);

/**
 * Tells the SPA how to subscribe to live job updates. The returned details are
 * driver-specific (local WebSocket URL in dev, Azure SignalR client URL + token
 * in production) but always scoped to the caller's tenant.
 */
realtimeRouter.post('/negotiate', async (req, res, next) => {
  try {
    const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
    const info = await getRealtimeGateway().negotiate(
      req.auth!.tenantId,
      req.auth!.userId,
      origin,
    );
    res.json(info);
  } catch (err) {
    next(err);
  }
});
