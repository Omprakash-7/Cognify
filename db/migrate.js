/**
 * Migration script: reads schema.sql, substitutes {{EMBED_DIM}},
 * and executes the SQL inside a single transaction.
 *
 * Usage:
 *   node db/migrate.js          — create / update tables
 *   node db/migrate.js --reset  — DROP all Cognify tables first (interactive)
 */

import '../lib/env.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTransaction, closePool } from '../lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COGNIFY_TABLES = [
  'tickets',
  'quiz_attempts',
  'chat_messages',
  'jobs',
  'generated_items',
  'chunks',
  'documents',
  'batch_members',
  'batches',
  'users',
  'institutes',
];

async function main() {
  const reset = process.argv.includes('--reset');

  // Validate EMBED_DIM
  const raw = process.env.EMBED_DIM || '1536';
  const embedDim = parseInt(raw, 10);
  if (!Number.isInteger(embedDim) || embedDim < 1 || embedDim > 2000) {
    console.error(`Invalid EMBED_DIM="${raw}". Must be an integer between 1 and 2000.`);
    process.exit(1);
  }

  // Read and substitute schema
  let sql = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');
  sql = sql.replaceAll('{{EMBED_DIM}}', String(embedDim));

  try {
    await withTransaction(async (client) => {
      if (reset) {
        console.log('⚠️  --reset: dropping all Cognify tables (CASCADE)…');
        for (const table of COGNIFY_TABLES) {
          await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        }
        console.log('   Tables dropped.');
      }

      console.log(`Running schema with EMBED_DIM=${embedDim}…`);
      await client.query(sql);
      console.log('Migration complete ✓');
    });
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
