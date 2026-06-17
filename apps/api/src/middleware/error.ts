import type { ApiError } from '@retailfixit/shared';
import type { NextFunction, Request, Response } from 'express';

import { ZodError } from 'zod';

import { logger } from '../observability/logger.js';
import { incrementCounter } from '../observability/metrics.js';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const traceId = req.traceId;

  if (err instanceof AppError) {
    incrementCounter('api_error_total', {
      class: String(err.status),
      code: err.code,
      path: req.path,
    });
    const body: ApiError = { code: err.code, message: err.message, traceId };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    incrementCounter('api_error_total', {
      class: '400',
      code: 'VALIDATION_ERROR',
      path: req.path,
    });
    const body: ApiError = {
      code: 'VALIDATION_ERROR',
      message: err.errors.map((e) => e.message).join('; '),
      traceId,
    };
    res.status(400).json(body);
    return;
  }

  logger.error({ err, traceId, path: req.path }, 'Unhandled request error');
  incrementCounter('api_error_total', {
    class: '500',
    code: 'INTERNAL_ERROR',
    path: req.path,
  });

  const body: ApiError = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    traceId,
  };
  res.status(500).json(body);
}
