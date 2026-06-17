/**
 * Loads apps/api/.env before config is read. Import this as the first line in
 * entry points (index.ts, bootstrap.ts, etc.).
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadEnv({ path: path.join(apiRoot, '.env') });
