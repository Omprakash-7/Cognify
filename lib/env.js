/**
 * Environment loader for Node.js scripts and worker.
 * Must be imported before any env-dependent module.
 * Resolves ../.env relative to this file's location.
 */

import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });
