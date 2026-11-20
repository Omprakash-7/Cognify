/**
 * Isolation / integration tests for the Cognify API.
 * Uses node:test + fetch against a real Next.js dev server.
 *
 * Run with: node tests/isolation.test.js
 *
 * Prerequisites:
 * - .env at project root with DATABASE_URL, JWT_SECRET, etc.
 * - `npm --prefix web run dev -- --port 3001` runnable
 */

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load env
import '../lib/env.js';
import { query, closePool } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';
const HEALTH = `${BASE}/api/health`;

// ---- state ----
let server;
const testInstituteIds = [];
const testUserIds = [];
const testBatchIds = [];

// ---- helpers ----
async function waitForServer(url, maxMs = 90_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`Server not ready after ${maxMs}ms`);
}

function json(res) {
  return res.json();
}

/** POST helper, returns [response, body] */
async function post(path, body, cookie = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return [res, data];
}

/** GET helper, returns [response, body] */
async function get(path, cookie = '') {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return [res, data];
}

/** DELETE helper, returns [response, body] */
async function del(path, cookie = '') {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  return [res, data];
}

/** Extract cognify_token cookie from response */
function extractCookie(res) {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/cognify_token=([^;]+)/);
  return match ? `cognify_token=${match[1]}` : '';
}

/** Login and return cookie string */
async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  return extractCookie(res);
}

// ---- setup ----
before(async () => {
  // Start Next.js dev server
  server = spawn('npm', ['--prefix', resolve(__dirname, '..', 'web'), 'run', 'dev', '--', '--port', '3001'], {
    stdio: 'pipe',
    env: { ...process.env },
  });

  server.stderr.on('data', (d) => {
    if (process.env.DEBUG) process.stderr.write(d);
  });

  await waitForServer(HEALTH);

  // Create test institutes
  const instA = await query(
    "INSERT INTO institutes (name) VALUES ('TEST-Inst-A') RETURNING id",
    []
  );
  const instB = await query(
    "INSERT INTO institutes (name) VALUES ('TEST-Inst-B') RETURNING id",
    []
  );

  const instAId = instA.rows[0].id;
  const instBId = instB.rows[0].id;
  testInstituteIds.push(instAId, instBId);

  // Helper to create user
  async function createUser(instituteId, email, password, fullName, role) {
    const hash = await hashPassword(password);
    const res = await query(
      `INSERT INTO users (institute_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [instituteId, email, hash, fullName, role]
    );
    const id = res.rows[0].id;
    testUserIds.push(id);
    return id;
  }

  // Inst-A users
  global.instAId = instAId;
  global.instBId = instBId;
  global.adminAEmail = 'test-admin-a@test.local';
  global.adminAPass = 'AdminPassA1!';
  global.teacherAEmail = 'test-teacher-a@test.local';
  global.teacherAPass = 'TeacherPassA1!';
  global.studentAEmail = 'test-student-a@test.local';
  global.studentAPass = 'StudentPassA1!';

  global.adminAId = await createUser(instAId, global.adminAEmail, global.adminAPass, 'Admin A', 'admin');
  global.teacherAId = await createUser(instAId, global.teacherAEmail, global.teacherAPass, 'Teacher A', 'teacher');
  global.studentAId = await createUser(instAId, global.studentAEmail, global.studentAPass, 'Student A', 'student');

  // Inst-B users
  global.adminBEmail = 'test-admin-b@test.local';
  global.adminBPass = 'AdminPassB1!';
  global.teacherBEmail = 'test-teacher-b@test.local';
  global.teacherBPass = 'TeacherPassB1!';
  global.studentBEmail = 'test-student-b@test.local';
  global.studentBPass = 'StudentPassB1!';

  global.adminBId = await createUser(instBId, global.adminBEmail, global.adminBPass, 'Admin B', 'admin');
  global.teacherBId = await createUser(instBId, global.teacherBEmail, global.teacherBPass, 'Teacher B', 'teacher');
  global.studentBId = await createUser(instBId, global.studentBEmail, global.studentBPass, 'Student B', 'student');
});

// ---- teardown ----
after(async () => {
  // Clean up test data in dependency order
  if (testBatchIds.length) {
    for (const bid of testBatchIds) {
      await query('DELETE FROM batch_members WHERE batch_id=$1', [bid]).catch(() => {});
      await query('DELETE FROM batches WHERE id=$1', [bid]).catch(() => {});
    }
  }

  // Also delete any batches linked to test institutes
  for (const iid of testInstituteIds) {
    await query('DELETE FROM batch_members WHERE batch_id IN (SELECT id FROM batches WHERE institute_id=$1)', [iid]).catch(() => {});
    await query('DELETE FROM batches WHERE institute_id=$1', [iid]).catch(() => {});
  }

  // Delete test users and institutes
  if (testUserIds.length) {
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [testUserIds]).catch(() => {});
  }
  for (const iid of testInstituteIds) {
    await query('DELETE FROM institutes WHERE id=$1', [iid]).catch(() => {});
  }

  await closePool();

  if (server) {
    server.kill('SIGTERM');
  }
});

// ---- tests ----

test('401 for unauthenticated GET /api/auth/me', async () => {
  const [res] = await get('/api/auth/me');
  assert.equal(res.status, 401);
});

test('401 for unauthenticated GET /api/batches', async () => {
  const [res] = await get('/api/batches');
  assert.equal(res.status, 401);
});

test('Login works with correct credentials', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: global.adminAEmail, password: global.adminAPass }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.user, 'Response should have user object');
  assert.equal(body.user.email, global.adminAEmail);
  assert.ok(!('password_hash' in body.user), 'password_hash must not be in response');
  const cookie = extractCookie(res);
  assert.ok(cookie, 'Should set cognify_token cookie');
});

test('Wrong password returns 401 with generic message', async () => {
  const [res, body] = await post('/api/auth/login', {
    email: global.adminAEmail,
    password: 'wrong-password',
  });
  assert.equal(res.status, 401);
  assert.ok(body.error?.message, 'Error message should be present');
  assert.ok(!body.error.message.toLowerCase().includes('not found'), 'Should not reveal user not found');
  assert.ok(!body.error.message.toLowerCase().includes('wrong password'), 'Should not say wrong password');
  assert.equal(body.error.message, 'Invalid email or password');
});

test('Student cannot POST /api/batches (403)', async () => {
  const cookie = await login(global.studentAEmail, global.studentAPass);
  const [res] = await post('/api/batches', { name: 'Student Batch Test' }, cookie);
  assert.equal(res.status, 403);
});

test('Teacher can POST /api/batches (201)', async () => {
  const cookie = await login(global.teacherAEmail, global.teacherAPass);
  const [res, body] = await post('/api/batches', { name: 'TEST-Teacher-Batch-1', subject: 'Math' }, cookie);
  assert.equal(res.status, 201);
  assert.ok(body.batch?.id, 'Should return batch with id');
  testBatchIds.push(body.batch.id);
  global.batchAId = body.batch.id;
});

test('Non-member GET /api/batches/[id] returns 404', async () => {
  // Ensure batchAId is set (depends on previous test)
  if (!global.batchAId) return;
  const cookie = await login(global.studentAEmail, global.studentAPass);
  const [res] = await get(`/api/batches/${global.batchAId}`, cookie);
  assert.equal(res.status, 404);
});

test('Inst-A teacher cannot see Inst-B batches', async () => {
  // Create a batch in inst-B
  const adminBCookie = await login(global.adminBEmail, global.adminBPass);
  const [createRes, createBody] = await post('/api/batches', { name: 'TEST-Inst-B-Batch' }, adminBCookie);
  assert.equal(createRes.status, 201);
  const batchBId = createBody.batch.id;
  testBatchIds.push(batchBId);

  // Inst-A teacher should not see it in list
  const teacherACookie = await login(global.teacherAEmail, global.teacherAPass);
  const [listRes, listBody] = await get('/api/batches', teacherACookie);
  assert.equal(listRes.status, 200);
  const batchIds = (listBody.batches || []).map((b) => b.id);
  assert.ok(!batchIds.includes(batchBId), 'Inst-A teacher should not see Inst-B batch');

  // Direct access should return 404
  const [directRes] = await get(`/api/batches/${batchBId}`, teacherACookie);
  assert.equal(directRes.status, 404);
});

test('Inst-A admin cannot add Inst-B user to Inst-A batch', async () => {
  // Need a batch in Inst-A first
  const adminACookie = await login(global.adminAEmail, global.adminAPass);
  let batchId = global.batchAId;
  if (!batchId) {
    const [r, b] = await post('/api/batches', { name: 'TEST-Admin-A-Batch' }, adminACookie);
    assert.equal(r.status, 201);
    batchId = b.batch.id;
    testBatchIds.push(batchId);
    global.batchAId = batchId;
  }

  const [res] = await post(
    `/api/batches/${batchId}/members`,
    { userId: global.studentBId, role: 'student' },
    adminACookie
  );
  assert.equal(res.status, 404, 'Cross-institute user add should return 404');
});

test('Cannot add other-institute user to batch (404)', async () => {
  const adminACookie = await login(global.adminAEmail, global.adminAPass);
  let batchId = global.batchAId;
  if (!batchId) {
    const [r, b] = await post('/api/batches', { name: 'TEST-Admin-A-Batch-2' }, adminACookie);
    batchId = b.batch.id;
    testBatchIds.push(batchId);
  }

  const [res] = await post(
    `/api/batches/${batchId}/members`,
    { userId: global.teacherBId, role: 'teacher' },
    adminACookie
  );
  assert.equal(res.status, 404);
});

test('password_hash never appears in any response body', async () => {
  const adminACookie = await login(global.adminAEmail, global.adminAPass);

  // Check /api/auth/me
  const [meRes, meBody] = await get('/api/auth/me', adminACookie);
  assert.equal(meRes.status, 200);
  const meStr = JSON.stringify(meBody);
  assert.ok(!meStr.includes('password_hash'), 'password_hash in /me response');

  // Check /api/users
  const [usersRes, usersBody] = await get('/api/users', adminACookie);
  assert.equal(usersRes.status, 200);
  const usersStr = JSON.stringify(usersBody);
  assert.ok(!usersStr.includes('password_hash'), 'password_hash in /users response');

  // Check login response
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: global.adminAEmail, password: global.adminAPass }),
  });
  const loginBody = await loginRes.json();
  const loginStr = JSON.stringify(loginBody);
  assert.ok(!loginStr.includes('password_hash'), 'password_hash in login response');
});

test('Rate limit: 6 failed logins → 429', async () => {
  const testEmail = 'test-ratelimit@test.local';
  let lastStatus;

  for (let i = 0; i < 7; i++) {
    const [res] = await post('/api/auth/login', {
      email: testEmail,
      password: 'wrong-password-' + i,
    });
    lastStatus = res.status;
    if (res.status === 429) break;
  }

  assert.equal(lastStatus, 429, 'Should get 429 after too many failed attempts');
});
