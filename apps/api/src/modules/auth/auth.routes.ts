import { Router } from 'express';

import { config, isEntraAuthEnabled } from '../../config/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../middleware/error.js';
import { devLoginSchema } from './auth.schema.js';
import { createDevSession, claimAdminSlot, toAuthUserResponse } from './auth.service.js';
import { listAllUsers } from './users.repository.js';
import {
  getVendorRegistrationConfig,
  registerVendorManager,
  vendorRegisterSchema,
} from './vendor-registration.service.js';

export const authRouter = Router();

/** Public: reports which auth mode is active (Entra ID vs dev). */
authRouter.get('/config', (_req, res) => {
  res.json({
    mode: isEntraAuthEnabled() ? 'entra' : 'dev',
    entraTenantId: isEntraAuthEnabled() ? config.auth.azureAdTenantId : undefined,
    vendorRegistrationEnabled: config.auth.vendorSelfRegistrationEnabled,
  });
});

/** Public: vendor self-registration availability and Entra domain. */
authRouter.get('/register/vendor/config', async (_req, res, next) => {
  try {
    res.json(await getVendorRegistrationConfig());
  } catch (err) {
    next(err);
  }
});

/** Public: vendor company manager self-registration. */
authRouter.post('/register/vendor', async (req, res, next) => {
  try {
    const body = vendorRegisterSchema.parse(req.body);
    const result = await registerVendorManager(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json(await toAuthUserResponse(req.auth!));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/claim-admin', authenticate, async (req, res, next) => {
  try {
    res.json(await claimAdminSlot(req.auth!));
  } catch (err) {
    next(err);
  }
});

/** Dev-only: list seeded users for the login picker. */
authRouter.get('/dev/users', async (_req, res, next) => {
  try {
    if (isEntraAuthEnabled()) {
      throw new AppError(403, 'DEV_AUTH_DISABLED', 'Dev users endpoint is disabled in Entra mode');
    }
    const users = await listAllUsers();
    res.json(users.map((u) => ({ id: u.id, displayName: u.displayName, roles: u.roles })));
  } catch (err) {
    next(err);
  }
});

/** Dev-only: issue a signed JWT for a seeded user. */
authRouter.post('/dev/login', async (req, res, next) => {
  try {
    const body = devLoginSchema.parse(req.body);
    const session = await createDevSession(body.userId);
    res.json(session);
  } catch (err) {
    next(err);
  }
});
