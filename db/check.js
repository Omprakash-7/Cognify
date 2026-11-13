/**
 * Post-setup health check.
 * Verifies: connection, pgvector, vector distance query, all 11 tables, seed counts.
 *
 * Usage: node db/check.js
 */

import '../lib/env.js';
import { query, closePool } from '../lib/db.js';

const TABLES = [
  'institutes',
  'users',
  'batches',
  'batch_members',
  'documents',
  'chunks',
  'generated_items',
  'jobs',
  'chat_messages',
  'quiz_attempts',
  'tickets',
];

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  [ok]   ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  [FAIL] ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

async function main() {
  console.log('Cognify setup check\n');

  // 1. Connection
  try {
    const { rows } = await query('SELECT now() AS t');
    ok(`Database connection (server time: ${rows[0].t})`);
  } catch (e) {
    fail('Database connection', e.message);
    await closePool();
    process.exit(1);
  }

  // 2. pgvector extension
  try {
    const { rows } = await query(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    );
    if (rows.length > 0) ok('pgvector extension installed');
    else fail('pgvector extension', 'not found');
  } catch (e) {
    fail('pgvector extension', e.message);
  }

  // 3. Vector distance query
  try {
    const { rows } = await query(
      `SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector AS dist`
    );
    const dist = parseFloat(rows[0].dist);
    if (dist > 0) ok(`Vector distance query (dist=${dist.toFixed(6)})`);
    else fail('Vector distance query', 'unexpected result');
  } catch (e) {
    fail('Vector distance query', e.message);
  }

  // 4. All 11 tables exist
  for (const table of TABLES) {
    try {
      const { rows } = await query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         ) AS e`,
        [table]
      );
      if (rows[0].e) ok(`Table "${table}" exists`);
      else fail(`Table "${table}"`, 'not found');
    } catch (e) {
      fail(`Table "${table}"`, e.message);
    }
  }

  // 5. Seed counts
  try {
    const { rows: [{ count: instCount }] } = await query('SELECT count(*)::int AS count FROM institutes');
    const { rows: [{ count: userCount }] } = await query('SELECT count(*)::int AS count FROM users');
    const { rows: [{ count: batchCount }] } = await query('SELECT count(*)::int AS count FROM batches');
    const { rows: [{ count: memberCount }] } = await query('SELECT count(*)::int AS count FROM batch_members');

    if (instCount >= 2) ok(`Institutes seeded (${instCount})`);
    else fail('Institutes seed', `expected ≥2, got ${instCount}`);

    if (userCount >= 7) ok(`Users seeded (${userCount})`);
    else fail('Users seed', `expected ≥7, got ${userCount}`);

    if (batchCount >= 3) ok(`Batches seeded (${batchCount})`);
    else fail('Batches seed', `expected ≥3, got ${batchCount}`);

    if (memberCount >= 8) ok(`Batch members seeded (${memberCount})`);
    else fail('Batch members seed', `expected ≥8, got ${memberCount}`);
  } catch (e) {
    fail('Seed counts', e.message);
  }

  await closePool();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Setup check FAILED.');
    process.exit(1);
  } else {
    console.log('Setup check passed.');
  }
}

main();
