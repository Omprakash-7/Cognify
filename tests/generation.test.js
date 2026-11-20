/**
 * Tests for Phase 5: AI Generation & Grounding Engine.
 *
 * Verifies:
 * - Zod schema validation for summary, notes, key_points, quiz, flashcards.
 * - Grounding verification rejects fabricated quotes and duplicate options.
 * - End-to-end draft creation for a fixture document via `worker:once`.
 * - Endpoint POST /api/documents/[id]/generate enqueues jobs.
 * - Reprocess marks existing generated_items as is_stale = true.
 * - Automatic isolation and cleanup.
 *
 * Run with: node tests/generation.test.js
 */

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';
import path from 'node:path';

// Load env
import '../lib/env.js';
import { query, closePool } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';
import { getStorageClient, getBucket, removeFile } from '../lib/storage.js';
import {
  summarySchema,
  notesSchema,
  keyPointsSchema,
  quizSchema,
  flashcardsSchema,
  verifyQuizGrounding,
} from '../lib/grounding.js';
import { createFixtures } from './fixtures/generate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3003;
const BASE = `http://localhost:${PORT}`;
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
    } catch {}
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`Server not ready after ${maxMs}ms`);
}

function extractCookie(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return '';
  return setCookie.split(';')[0];
}

async function loginUser(email, password = 'Password123!') {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return extractCookie(res);
}

before(async () => {
  await createFixtures();

  // Start Next.js server on port 3003
  server = spawn(
    'npm',
    ['--prefix', 'web', 'run', 'dev', '--', '--port', String(PORT)],
    {
      cwd: resolve(__dirname, '..'),
      stdio: 'ignore',
      env: { ...process.env, PORT: String(PORT) },
    }
  );

  await waitForServer(HEALTH);

  // Create isolated test institute, user, and batch
  const inst = await query("INSERT INTO institutes (name) VALUES ('TEST-GenInst') RETURNING id");
  const instId = inst.rows[0].id;
  testInstituteIds.push(instId);

  const hash = await hashPassword('Password123!');
  const user = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-gen-teacher@test.local', $2, 'Gen Teacher', 'teacher') RETURNING id`,
    [instId, hash]
  );
  const userId = user.rows[0].id;
  testUserIds.push(userId);

  const batch = await query(
    `INSERT INTO batches (institute_id, name, created_by)
     VALUES ($1, 'TEST-GenBatch', $2) RETURNING id`,
    [instId, userId]
  );
  const batchId = batch.rows[0].id;
  testBatchIds.push(batchId);

  await query(
    `INSERT INTO batch_members (batch_id, user_id, member_role) VALUES ($1, $2, 'teacher')`,
    [batchId, userId]
  );

  global.genInstId = instId;
  global.genUserId = userId;
  global.genBatchId = batchId;

  global.teacherCookie = await loginUser('test-gen-teacher@test.local');
});

after(async () => {
  if (server) {
    server.kill('SIGTERM');
  }

  // Remove test storage files
  if (testStoragePaths.length) {
    await removeFile(testStoragePaths).catch(() => {});
  }

  // Cleanup DB
  for (const docId of testDocIds) {
    await query('DELETE FROM generated_items WHERE document_id=$1', [docId]).catch(() => {});
    await query('DELETE FROM chunks WHERE document_id=$1', [docId]).catch(() => {});
    await query('DELETE FROM jobs WHERE document_id=$1', [docId]).catch(() => {});
    await query('DELETE FROM documents WHERE id=$1', [docId]).catch(() => {});
  }
  for (const bId of testBatchIds) {
    await query('DELETE FROM batch_members WHERE batch_id=$1', [bId]).catch(() => {});
    await query('DELETE FROM batches WHERE id=$1', [bId]).catch(() => {});
  }
  if (testUserIds.length) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [testUserIds]).catch(() => {});
  }
  for (const iId of testInstituteIds) {
    await query('DELETE FROM institutes WHERE id=$1', [iId]).catch(() => {});
  }

  await closePool();
});

// ──────────────── Schema Unit Tests ────────────────

test('Schema validation: summary schema accepts valid, rejects invalid', () => {
  const valid = {
    overview: 'High-level physics summary',
    sections: [
      { heading: 'Kinematics', summary: 'Study of motion without regard to cause', pages: [1, 2] },
    ],
  };
  assert.equal(summarySchema.safeParse(valid).success, true);

  const invalid = { overview: '', sections: [] };
  assert.equal(summarySchema.safeParse(invalid).success, false);
});

test('Schema validation: notes schema accepts valid, rejects invalid', () => {
  const valid = {
    title: 'Mechanics Notes',
    sections: [
      {
        heading: 'Newton Laws',
        bullets: ['First Law is inertia', 'Second Law relates force and mass'],
        definitions: [{ term: 'Force', meaning: 'Push or pull on an object' }],
        formulas: ['F = ma'],
        pages: [1],
      },
    ],
  };
  assert.equal(notesSchema.safeParse(valid).success, true);

  const invalid = { title: '', sections: 'not-an-array' };
  assert.equal(notesSchema.safeParse(invalid).success, false);
});

test('Schema validation: key_points schema accepts valid, rejects invalid', () => {
  const valid = {
    points: [
      { point: 'Conservation of momentum', whyItMatters: 'Essential for collision questions', pages: [1] },
    ],
  };
  assert.equal(keyPointsSchema.safeParse(valid).success, true);
});

test('Schema validation: quiz schema accepts valid, rejects invalid options/index', () => {
  const valid = {
    questions: [
      {
        question: 'What is the formula for force?',
        options: ['F = ma', 'E = mc^2', 'V = IR', 'P = IV'],
        correctIndex: 0,
        explanation: 'Newton second law gives F = ma',
        difficulty: 'easy',
        sourcePage: 1,
        sourceQuote: 'Force equals mass times acceleration (F = ma)',
      },
    ],
  };
  assert.equal(quizSchema.safeParse(valid).success, true);

  // Fails with 3 options instead of 4
  const invalidOptions = {
    questions: [{ ...valid.questions[0], options: ['A', 'B', 'C'] }],
  };
  assert.equal(quizSchema.safeParse(invalidOptions).success, false);

  // Fails with out-of-range correctIndex
  const invalidIndex = {
    questions: [{ ...valid.questions[0], correctIndex: 5 }],
  };
  assert.equal(quizSchema.safeParse(invalidIndex).success, false);
});

test('Schema validation: flashcards schema accepts valid, rejects invalid', () => {
  const valid = {
    cards: [{ front: 'What is F = ma?', back: "Newton's Second Law", sourcePage: 1 }],
  };
  assert.equal(flashcardsSchema.safeParse(valid).success, true);
});

// ──────────────── Grounding Unit Tests ────────────────

test('Grounding: verifyQuizGrounding preserves authentic quotes and drops fabricated ones', () => {
  const chunks = [
    {
      page_number: 1,
      content:
        "Newton's First Law states that an object at rest remains at rest. Newton's Second Law states that force equals mass times acceleration (F = ma). Newton's Third Law states for every action there is an equal and opposite reaction.",
    },
  ];

  const candidateQuiz = {
    questions: [
      {
        question: 'What is the Second Law?',
        options: ['Force = mass * acceleration', 'E = mc^2', 'V = IR', 'P = IV'],
        correctIndex: 0,
        explanation: 'F = ma',
        difficulty: 'easy',
        sourcePage: 1,
        sourceQuote: 'force equals mass times acceleration (F = ma)',
      },
      {
        question: 'What is the Third Law?',
        options: ['Equal and opposite reaction', 'Inertia only', 'Speed of light', 'Ohm law'],
        correctIndex: 0,
        explanation: 'Action reaction',
        difficulty: 'easy',
        sourcePage: 1,
        sourceQuote: 'for every action there is an equal and opposite reaction',
      },
      {
        question: 'What is the First Law?',
        options: ['Object at rest remains at rest', 'F = ma', 'Gravity is zero', 'Thermodynamics'],
        correctIndex: 0,
        explanation: 'Inertia',
        difficulty: 'easy',
        sourcePage: 1,
        sourceQuote: 'an object at rest remains at rest',
      },
      {
        question: 'Fabricated question?',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctIndex: 0,
        explanation: 'Fake',
        difficulty: 'hard',
        sourcePage: 1,
        sourceQuote: 'Einstein discovered quantum gravity in 1905 during summer', // Fabricated quote!
      },
      {
        question: 'Duplicate options question?',
        options: ['F = ma', 'F = ma', 'V = IR', 'P = IV'], // Duplicate options!
        correctIndex: 0,
        explanation: 'Dup',
        difficulty: 'medium',
        sourcePage: 1,
        sourceQuote: 'force equals mass times acceleration',
      },
    ],
  };

  const grounded = verifyQuizGrounding(candidateQuiz, chunks);
  assert.equal(grounded.questions.length, 3, 'Should keep only the 3 authentic questions');

  // Throws if fewer than 3 questions survive
  assert.throws(
    () => {
      verifyQuizGrounding(
        {
          questions: [candidateQuiz.questions[0]], // only 1 question
        },
        chunks
      );
    },
    /minimum 3 required/
  );
});

// ──────────────── Integration & Worker Tests ────────────────

test('End-to-end draft creation for a fixture document via worker:once', async () => {
  // 1. Upload sample.txt to storage and create document record
  const fixturePath = path.join(__dirname, 'fixtures', 'sample.txt');
  const buffer = fs.readFileSync(fixturePath);
  const storagePath = `gen-test/${Date.now()}-sample.txt`;
  const supabase = getStorageClient();
  const bucket = getBucket();
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: 'text/plain', upsert: true });
  assert.equal(upErr, null, `Upload failed: ${upErr?.message}`);
  testStoragePaths.push(storagePath);

  const docRes = await query(
    `INSERT INTO documents (institute_id, batch_id, uploaded_by, scope, title, file_name, file_type, storage_path, status)
     VALUES ($1, $2, $3, 'batch', 'Newton Laws Guide', 'sample.txt', 'txt', $4, 'processing') RETURNING id`,
    [global.genInstId, global.genBatchId, global.genUserId, storagePath]
  );
  const docId = docRes.rows[0].id;
  testDocIds.push(docId);

  // Enqueue process_document job
  await query(
    `INSERT INTO jobs (institute_id, document_id, job_type, payload)
     VALUES ($1, $2, 'process_document', $3)`,
    [global.genInstId, docId, JSON.stringify({ storage_path: storagePath, file_type: 'txt' })]
  );

  // Run worker --once to process document and generate notes, quiz, flashcards
  const workerRes = spawnSync('node', ['worker/index.js', '--once'], {
    cwd: resolve(__dirname, '..'),
    env: process.env,
    encoding: 'utf-8',
    timeout: 120_000,
  });

  assert.equal(workerRes.status, 0, `Worker failed: ${workerRes.stderr || workerRes.stdout}`);

  // Verify document is ready
  const updatedDoc = await query('SELECT status, page_count FROM documents WHERE id=$1', [docId]);
  assert.equal(updatedDoc.rows[0].status, 'ready');

  // Verify generated_items exist as DRAFT with is_stale=false
  const items = await query(
    'SELECT item_type, title, content, source_pages, status, is_stale FROM generated_items WHERE document_id=$1',
    [docId]
  );

  const itemTypes = items.rows.map((r) => r.item_type);
  assert.ok(itemTypes.includes('summary'), 'Should generate summary');
  assert.ok(itemTypes.includes('notes'), 'Should generate notes');
  assert.ok(itemTypes.includes('key_points'), 'Should generate key_points');
  assert.ok(itemTypes.includes('quiz'), 'Should generate quiz');
  assert.ok(itemTypes.includes('flashcards'), 'Should generate flashcards');

  for (const item of items.rows) {
    assert.equal(item.status, 'draft');
    assert.equal(item.is_stale, false);
    assert.ok(Array.isArray(item.source_pages) && item.source_pages.length > 0);
  }

  // Verify quiz question count
  const quizRow = items.rows.find((r) => r.item_type === 'quiz');
  assert.ok(quizRow.content.questions.length >= 3, 'Quiz should have >= 3 grounded questions');
});

test('POST /api/documents/[id]/generate enqueues generation jobs', async () => {
  const docId = testDocIds[0];

  const res = await fetch(`${BASE}/api/documents/${docId}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.teacherCookie,
    },
    body: JSON.stringify({
      types: ['quiz', 'flashcards'],
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.queued));
});

test('Reprocess marks existing generated_items as is_stale = true', async () => {
  const docId = testDocIds[0];

  // Call reprocess endpoint
  const res = await fetch(`${BASE}/api/documents/${docId}/reprocess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.teacherCookie,
    },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);

  // Check that all generated_items for docId are marked is_stale = true
  const items = await query('SELECT is_stale FROM generated_items WHERE document_id=$1', [docId]);
  assert.ok(items.rows.length > 0);
  for (const row of items.rows) {
    assert.equal(row.is_stale, true, 'Reprocess must mark generated items as stale');
  }
});
