import { Permission } from '@retailfixit/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import {
  getRolePermissionMatrix,
  updateRolePermissionMatrix,
  updateRoleMatrixSchema,
} from './rbac.service.js';

export const rbacRouter = Router();

rbacRouter.use(authenticate);

rbacRouter.get('/matrix', requirePermission(Permission.UsersManage), async (req, res, next) => {
  try {
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    res.json(await getRolePermissionMatrix(req.auth!, tenantId));
  } catch (err) {
    next(err);
  }
});

rbacRouter.put('/matrix', requirePermission(Permission.UsersManage), async (req, res, next) => {
  try {
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    const body = updateRoleMatrixSchema.parse(req.body);
    res.json(await updateRolePermissionMatrix(req.auth!, body, tenantId));
  } catch (err) {
    next(err);
  }
});
