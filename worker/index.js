/**
 * Worker process: polls the `jobs` table and dispatches to handlers.
 *
 * Claims ONE job atomically using SELECT … FOR UPDATE SKIP LOCKED,
 * runs the matching handler, marks done/failed, and sleeps when idle.
 * Graceful shutdown on SIGINT / SIGTERM.
 *
 * Usage:
 *   node worker/index.js         (continuous polling)
 *   node worker/index.js --once  (drain currently queued jobs and exit)
 */

// Load environment before anything else
import '../lib/env.js';

import { query, closePool } from '../lib/db.js';
import { handlers } from './handlers.js';

const POLL_MS = parseInt(process.env.WORKER_POLL_MS || '2000', 10);
const ONCE_MODE = process.argv.includes('--once');
const TYPE_FILTER = process.argv.find((a) => a.startsWith('--type='))?.split('=')[1] || null;

let running = true;
let processingJob = false;

async function claimJob() {
  const params = [];
  let typeClause = '';
  if (TYPE_FILTER) {
    params.push(TYPE_FILTER);
    typeClause = `AND job_type = $${params.length}`;
  }

  const { rows } = await query(
    `UPDATE jobs
     SET status = 'running', started_at = now(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'queued' ${typeClause}
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    params
  );
  return rows[0] || null;
}

async function markDone(jobId) {
  await query(
    `UPDATE jobs SET status = 'done', finished_at = now() WHERE id = $1`,
    [jobId]
  );
}

async function markFailed(jobId, error, attempts) {
  if (attempts < 3) {
    // Requeue for retry
    await query(
      `UPDATE jobs SET status = 'queued', last_error = $2 WHERE id = $1`,
      [jobId, error]
    );
  } else {
    await query(
      `UPDATE jobs SET status = 'failed', last_error = $2, finished_at = now() WHERE id = $1`,
      [jobId, error]
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollLoop() {
  if (ONCE_MODE) {
    console.log('Worker running in --once mode: draining queue…');
  } else {
    console.log(`Worker started (poll every ${POLL_MS}ms)`);
  }

  while (running) {
    try {
      const job = await claimJob();

      if (!job) {
        if (ONCE_MODE) {
          console.log('No more queued jobs. Worker --once exiting.');
          await closePool();
          process.exit(0);
        }
        await sleep(POLL_MS);
        continue;
      }

      console.log(`Processing job ${job.id} [${job.job_type}] (attempt ${job.attempts})`);
      processingJob = true;

      const handler = handlers[job.job_type];
      if (!handler) {
        throw new Error(`Unknown job type: ${job.job_type}`);
      }

      try {
        await handler(job);
        await markDone(job.id);
        console.log(`Job ${job.id} done ✓`);
      } catch (err) {
        console.error(`Job ${job.id} error:`, err.message);
        await markFailed(job.id, err.message, job.attempts);
      }

      processingJob = false;
    } catch (err) {
      console.error('Poll loop error:', err.message);
      processingJob = false;
      if (ONCE_MODE) {
        await closePool();
        process.exit(1);
      }
      await sleep(POLL_MS);
    }
  }
}

// ── Graceful shutdown ──
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down…`);
  running = false;

  // Wait for current job to finish (up to 30s)
  if (processingJob) {
    console.log('Waiting for current job to finish…');
    const start = Date.now();
    while (processingJob && Date.now() - start < 30000) {
      await sleep(500);
    }
  }

  await closePool();
  console.log('Worker stopped.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

pollLoop();
