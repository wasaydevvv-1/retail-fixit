import { Permission, isBusinessTenant } from '@retailfixit/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { getAllTenants } from './tenants.service.js';

export const tenantsRouter = Router();

tenantsRouter.use(authenticate);

/** List business tenants (platform admin). Excludes tenant_platform. */
tenantsRouter.get('/', requirePermission(Permission.TenantsRead), async (_req, res, next) => {
  try {
    const tenants = (await getAllTenants()).filter((t) => isBusinessTenant(t.id));
    res.json(tenants);
  } catch (err) {
    next(err);
  }
});
