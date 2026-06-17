/**
 * Structured logger (Pino). In Azure, logs flow to Application Insights /
 * Log Analytics. Always log with structured fields, never string concatenation.
 */
import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.observability.logLevel,
  base: { service: 'retailfixit-api', env: config.env },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
