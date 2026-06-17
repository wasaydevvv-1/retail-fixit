import type { UserRole } from '@retailfixit/shared';
import type { NextFunction, Request, Response } from 'express';

import { authenticateBearerToken } from '../modules/auth/auth.service.js';
import { AppError } from './error.js';

/** Verifies Bearer token and attaches `req.auth` with tenant-scoped identity. */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    req.auth = await authenticateBearerToken(req.header('authorization'));
    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth — attaches identity when a valid token is present. */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header('authorization');
    if (header) {
      req.auth = await authenticateBearerToken(header);
    }
    next();
  } catch {
    next();
  }
}
