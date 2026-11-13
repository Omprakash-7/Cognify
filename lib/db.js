/**
 * PostgreSQL connection pool using the `pg` package.
 * Reads DATABASE_URL from process.env (caller must load env first).
 * SSL is enabled for non-localhost connections.
 */

import pg from 'pg';

const { Pool } = pg;

/** @type {pg.Pool | null} */
let pool = null;

/**
 * Returns the shared Pool instance, creating it on first call.
 * @returns {pg.Pool}
 */
export function getPool() {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string.'
    );
  }

  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  pool = new Pool({
    connectionString: url,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  return pool;
}

/**
 * Execute a parameterised SQL query.
 * @param {string} text - SQL statement with $1, $2, … placeholders.
 * @param {any[]} [params] - Bind parameters.
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  return getPool().query(text, params);
}

/**
 * Run `fn(client)` inside a transaction. Automatically BEGINs, COMMITs on
 * success, and ROLLBACKs + rethrows on error.
 * @param {(client: pg.PoolClient) => Promise<any>} fn
 * @returns {Promise<any>}
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close the connection pool.
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
