import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

/** Attaches a correlation id to every request for tracing and error responses. */
export function requestTracing(req: Request, res: Response, next: NextFunction): void {
  const traceId = (req.header('x-correlation-id') ?? randomUUID()).slice(0, 64);
  req.traceId = traceId;
  res.setHeader('x-correlation-id', traceId);
  next();
}
