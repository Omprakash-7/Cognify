/**
 * Integration tests for Phase 2: Documents and Upload.
 * Uses node:test + fetch against a Next.js dev server.
 *
 * Run with: node tests/documents.test.js
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
import { getStorageClient, getBucket, getFileInfo, removeFile } from '../lib/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3001';
const HEALTH = `${BASE}/api/health`;

let server;
const testInstituteIds = [];
const testUserIds = [];
const testBatchIds = [];
const testDocIds = [];
const testStoragePaths = [];

async function waitForServer(url, maxMs = 90_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // wait
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`Server not ready after ${maxMs}ms`);
}

function extractCookie(res) {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/cognify_token=([^;]+)/);
  return match ? `cognify_token=${match[1]}` : '';
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  return extractCookie(res);
}

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

async function get(path, cookie = '') {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return [res, data];
}

async function del(path, cookie = '') {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  return [res, data];
}

before(async () => {
  // Start server
  server = spawn('npm', ['--prefix', resolve(__dirname, '..', 'web'), 'run', 'dev', '--', '--port', '3001'], {
    stdio: 'pipe',
    env: { ...process.env },
  });

  server.stderr.on('data', (d) => {
    if (process.env.DEBUG) process.stderr.write(d);
  });

  await waitForServer(HEALTH);

  // Create test institutes
  const instA = await query("INSERT INTO institutes (name) VALUES ('TEST-DocInst-A') RETURNING id");
  const instB = await query("INSERT INTO institutes (name) VALUES ('TEST-DocInst-B') RETURNING id");
  const instAId = instA.rows[0].id;
  const instBId = instB.rows[0].id;
  testInstituteIds.push(instAId, instBId);

  async function createUser(instId, email, password, fullName, role) {
    const hash = await hashPassword(password);
    const res = await query(
      `INSERT INTO users (institute_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [instId, email, hash, fullName, role]
    );
    const id = res.rows[0].id;
    testUserIds.push(id);
    return id;
  }

  global.teacherAId = await createUser(instAId, 'test-doc-teacher-a@test.local', 'Pass123!', 'Teacher A', 'teacher');
  global.studentAId = await createUser(instAId, 'test-doc-student-a@test.local', 'Pass123!', 'Student A', 'student');
  global.teacherBId = await createUser(instBId, 'test-doc-teacher-b@test.local', 'Pass123!', 'Teacher B', 'teacher');
  global.studentBId = await createUser(instBId, 'test-doc-student-b@test.local', 'Pass123!', 'Student B', 'student');

  // Create batches
  const batchA = await query(
    "INSERT INTO batches (institute_id, name, created_by) VALUES ($1, 'TEST-Doc-Batch-A', $2) RETURNING id",
    [instAId, global.teacherAId]
  );
  const batchB = await query(
    "INSERT INTO batches (institute_id, name, created_by) VALUES ($1, 'TEST-Doc-Batch-B', $2) RETURNING id",
    [instBId, global.teacherBId]
  );
  global.batchAId = batchA.rows[0].id;
  global.batchBId = batchB.rows[0].id;
  testBatchIds.push(global.batchAId, global.batchBId);

  // Add members
  await query("INSERT INTO batch_members (batch_id, user_id, member_role) VALUES ($1, $2, 'teacher')", [
    global.batchAId,
    global.teacherAId,
  ]);
  await query("INSERT INTO batch_members (batch_id, user_id, member_role) VALUES ($1, $2, 'student')", [
    global.batchAId,
    global.studentAId,
  ]);
  await query("INSERT INTO batch_members (batch_id, user_id, member_role) VALUES ($1, $2, 'teacher')", [
    global.batchBId,
    global.teacherBId,
  ]);

  // Cookies
  global.teacherACookie = await login('test-doc-teacher-a@test.local', 'Pass123!');
  global.studentACookie = await login('test-doc-student-a@test.local', 'Pass123!');
  global.teacherBCookie = await login('test-doc-teacher-b@test.local', 'Pass123!');
});

after(async () => {
  // Clean storage objects
  if (testStoragePaths.length) {
    await removeFile(testStoragePaths).catch(() => {});
  }

  // Clean DB
  for (const docId of testDocIds) {
    await query('DELETE FROM jobs WHERE document_id=$1', [docId]).catch(() => {});
    await query('DELETE FROM documents WHERE id=$1', [docId]).catch(() => {});
  }
  for (const bid of testBatchIds) {
    await query('DELETE FROM batch_members WHERE batch_id=$1', [bid]).catch(() => {});
    await query('DELETE FROM documents WHERE batch_id=$1', [bid]).catch(() => {});
    await query('DELETE FROM batches WHERE id=$1', [bid]).catch(() => {});
  }
  if (testUserIds.length) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [testUserIds]).catch(() => {});
  }
  for (const iid of testInstituteIds) {
    await query('DELETE FROM institutes WHERE id=$1', [iid]).catch(() => {});
  }

  await closePool();
  if (server) server.kill('SIGTERM');
});

test('Type rejection: invalid file extension returns 400', async () => {
  const [res, body] = await post(
    `/api/batches/${global.batchAId}/documents`,
    { fileName: 'malicious.exe', fileType: 'exe', sizeBytes: 1024 },
    global.teacherACookie
  );
  assert.equal(res.status, 400);
  assert.equal(body.error?.code, 'VALIDATION_ERROR');
});

test('Size rejection: file > 25MB returns 413 Payload Too Large', async () => {
  const [res, body] = await post(
    `/api/batches/${global.batchAId}/documents`,
    { fileName: 'huge.pdf', fileType: 'pdf', sizeBytes: 26 * 1024 * 1024 },
    global.teacherACookie
  );
  assert.equal(res.status, 413);
  assert.equal(body.error?.code, 'PAYLOAD_TOO_LARGE');
});

test('Student cannot initiate upload (403)', async () => {
  const [res] = await post(
    `/api/batches/${global.batchAId}/documents`,
    { fileName: 'student.pdf', fileType: 'pdf', sizeBytes: 1024 },
    global.studentACookie
  );
  assert.equal(res.status, 403);
});

test('Cross-institute upload returns 404', async () => {
  const [res] = await post(
    `/api/batches/${global.batchBId}/documents`,
    { fileName: 'cross.pdf', fileType: 'pdf', sizeBytes: 1024 },
    global.teacherACookie
  );
  assert.equal(res.status, 404);
});

test('Path traversal in fileName is neutralized', async () => {
  const [res, body] = await post(
    `/api/batches/${global.batchAId}/documents`,
    { fileName: '../../../etc/passwd.txt', fileType: 'txt', sizeBytes: 100 },
    global.teacherACookie
  );
  assert.equal(res.status, 201);
  assert.ok(body.documentId);
  testDocIds.push(body.documentId);

  // Check storage_path in DB
  const docResult = await query('SELECT storage_path, file_name FROM documents WHERE id=$1', [body.documentId]);
  const row = docResult.rows[0];
  assert.ok(!row.storage_path.includes('..'), 'Storage path must not contain .. traversal');
  assert.ok(!row.file_name.includes('/'), 'File name must not contain slashes');
  testStoragePaths.push(row.storage_path);
});

test('Signed upload round trip with tiny TXT fixture', async () => {
  const fixtureContent = 'Cognify study notes: Newton laws of motion.';
  const contentBuffer = Buffer.from(fixtureContent, 'utf-8');

  // 1. Initiate upload
  const [initRes, initBody] = await post(
    `/api/batches/${global.batchAId}/documents`,
    { fileName: 'physics-notes.txt', fileType: 'txt', sizeBytes: contentBuffer.length, title: 'Physics Notes' },
    global.teacherACookie
  );
  assert.equal(initRes.status, 201);
  const docId = initBody.documentId;
  assert.ok(docId);
  assert.ok(initBody.uploadUrl);
  assert.ok(initBody.token);
  testDocIds.push(docId);

  const docRow = await query('SELECT storage_path FROM documents WHERE id=$1', [docId]);
  const storagePath = docRow.rows[0].storage_path;
  testStoragePaths.push(storagePath);

  // 2. Upload to Supabase Storage using signed upload token
  const supabase = getStorageClient();
  const bucket = getBucket();
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(storagePath, initBody.token, contentBuffer, { contentType: 'text/plain' });
  assert.equal(upErr, null, `Signed upload failed: ${upErr?.message}`);

  // 3. Call complete endpoint
  const [compRes, compBody] = await post(`/api/documents/${docId}/complete`, {}, global.teacherACookie);
  assert.equal(compRes.status, 200, `Complete failed: ${JSON.stringify(compBody)}`);
  assert.ok(compBody.jobId);

  // Verify process_document job exists in DB
  const jobResult = await query('SELECT job_type, status FROM jobs WHERE id=$1', [compBody.jobId]);
  assert.equal(jobResult.rows[0].job_type, 'process_document');
  assert.equal(jobResult.rows[0].status, 'queued');

  // 4. Student cannot download until status is 'ready' (403)
  const [filePreRes] = await get(`/api/documents/${docId}/file`, global.studentACookie);
  assert.equal(filePreRes.status, 403);

  // 5. Mark document as 'ready' (simulating worker completion)
  await query("UPDATE documents SET status='ready', page_count=1 WHERE id=$1", [docId]);

  // 6. Student can now download
  const [fileRes, fileBody] = await get(`/api/documents/${docId}/file`, global.studentACookie);
  assert.equal(fileRes.status, 200);
  assert.ok(fileBody.downloadUrl);

  // Fetch download URL and verify content
  const dlFetch = await fetch(fileBody.downloadUrl);
  assert.equal(dlFetch.status, 200);
  const text = await dlFetch.text();
  assert.equal(text, fixtureContent);

  // 7. Reprocess marks generated_items stale and resets status to 'processing'
  // Insert a test generated item
  const genItem = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content)
     VALUES ($1, $2, 'notes', 'Sample Notes', '{"text":"sample"}') RETURNING id`,
    [testInstituteIds[0], docId]
  );
  const [repRes] = await post(`/api/documents/${docId}/reprocess`, {}, global.teacherACookie);
  assert.equal(repRes.status, 200);

  const staleCheck = await query('SELECT is_stale FROM generated_items WHERE id=$1', [genItem.rows[0].id]);
  assert.equal(staleCheck.rows[0].is_stale, true);

  // 8. Delete cleans up storage and DB
  const [delRes] = await del(`/api/documents/${docId}`, global.teacherACookie);
  assert.equal(delRes.status, 200);

  const deletedDoc = await query('SELECT 1 FROM documents WHERE id=$1', [docId]);
  assert.equal(deletedDoc.rows.length, 0);

  const fileInfo = await getFileInfo(storagePath);
  assert.equal(fileInfo, null, 'Storage file should be deleted');
});
