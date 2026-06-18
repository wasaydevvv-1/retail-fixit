import { Permission, isBusinessTenant } from '@retailfixit/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { adminCreateTenant, getAllTenants } from './tenants.service.js';
import { createTenantSchema } from './tenants.schema.js';

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

/** Create a business tenant (platform admin). */
tenantsRouter.post('/', requirePermission(Permission.TenantsManage), async (req, res, next) => {
  try {
    const body = createTenantSchema.parse(req.body);
    const tenant = await adminCreateTenant(req.auth!, body);
    res.status(201).json(tenant);
  } catch (err) {
    next(err);
  }
});
