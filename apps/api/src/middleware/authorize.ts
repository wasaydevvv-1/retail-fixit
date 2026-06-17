import type { Permission, UserRole } from '@retailfixit/shared';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from './error.js';

/** Requires the caller to hold at least one of the given roles. */
export function requireRoles(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    const hasRole = req.auth.roles.some((role) => allowed.includes(role));
    if (!hasRole) {
      next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions for this action'));
      return;
    }

    next();
  };
}

/**
 * Requires the caller's roles to grant the given permission. Preferred over
 * `requireRoles` — keeps route guards aligned with the shared RBAC matrix.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (!req.auth.permissions.includes(permission)) {
      next(
        new AppError(
          403,
          'FORBIDDEN',
          `Your role does not permit this action (requires ${permission})`,
        ),
      );
      return;
    }

    next();
  };
}

/** Ensures `req.auth.tenantId` matches the route/body tenant (defense in depth). */
export function requireTenant(tenantId: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (req.auth.tenantId !== tenantId) {
      next(new AppError(403, 'TENANT_MISMATCH', 'Cross-tenant access denied'));
      return;
    }

    next();
  };
}
