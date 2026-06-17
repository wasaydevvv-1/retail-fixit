import { Permission } from '@retailfixit/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { AppError } from '../../middleware/error.js';
import { adminCreateUser, adminLinkUserVendor, adminUpdateUserRoles, assignUserRolesSchema, createTenantUserSchema, linkUserVendorSchema, listTenantUsers } from './users.service.js';
import { searchDirectoryUsers, getEntraConfig } from '../graph/graph.service.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', requirePermission(Permission.UsersRead), async (req, res, next) => {
  try {
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    const users = await listTenantUsers(req.auth!, tenantId);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/', requirePermission(Permission.UsersManage), async (req, res, next) => {
  try {
    const body = createTenantUserSchema.parse(req.body);
    const user = await adminCreateUser(req.auth!, body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/entra-config', requirePermission(Permission.UsersManage), async (_req, res, next) => {
  try {
    res.json(await getEntraConfig());
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/entra-search', requirePermission(Permission.UsersManage), async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    res.json(await searchDirectoryUsers(q));
  } catch (err) {
    next(err);
  }
});

usersRouter.patch(
  '/:id/roles',
  requirePermission(Permission.UsersManage),
  async (req, res, next) => {
    try {
      const userId = req.params.id;
      if (!userId) {
        throw new AppError(400, 'INVALID_USER_ID', 'User id is required');
      }
      const body = assignUserRolesSchema.parse(req.body);
      const user = await adminUpdateUserRoles(req.auth!, userId, body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.patch(
  '/:id/link-vendor',
  requirePermission(Permission.UsersManage),
  async (req, res, next) => {
    try {
      const userId = req.params.id;
      if (!userId) {
        throw new AppError(400, 'INVALID_USER_ID', 'User id is required');
      }
      const body = linkUserVendorSchema.parse(req.body);
      const user = await adminLinkUserVendor(req.auth!, userId, body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);
