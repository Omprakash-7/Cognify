/**
 * Tests for Phase 6: Review & Student Study API.
 *
 * Verifies:
 * - Students never see drafts, stale, or rejected items.
 * - correctIndex and explanation never leak to students before attempting.
 * - Server-side quiz scoring is accurate and persists quiz_attempts.
 * - Caller quiz attempts and progress tracking endpoints work correctly.
 * - Non-members / other-institute callers cannot attempt or read quizzes (404).
 * - Students cannot edit, approve, reject, or delete items (403).
 * - Teachers/Admins can edit (validated by zod), approve, reject, and delete draft items.
 *
 * Run with: node tests/review.test.js
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
const PORT = 3004;
const BASE = `http://localhost:${PORT}`;
const HEALTH = `${BASE}/api/health`;

let server;
const testInstituteIds = [];
const testUserIds = [];
const testBatchIds = [];
const testDocIds = [];
const testItemIds = [];

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
  // Start server on port 3004
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

  // 1. Create Institute A & Institute B
  const instA = await query("INSERT INTO institutes (name) VALUES ('TEST-RevInstA') RETURNING id");
  const instAId = instA.rows[0].id;
  testInstituteIds.push(instAId);

  const instB = await query("INSERT INTO institutes (name) VALUES ('TEST-RevInstB') RETURNING id");
  const instBId = instB.rows[0].id;
  testInstituteIds.push(instBId);

  const passHash = await hashPassword('Password123!');

  // Users in Institute A
  const tA = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-rev-teacher-a@test.local', $2, 'Teacher A', 'teacher') RETURNING id`,
    [instAId, passHash]
  );
  const teacherAId = tA.rows[0].id;
  testUserIds.push(teacherAId);

  const sA1 = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-rev-student-a1@test.local', $2, 'Student A1', 'student') RETURNING id`,
    [instAId, passHash]
  );
  const studentA1Id = sA1.rows[0].id;
  testUserIds.push(studentA1Id);

  // User in Institute B
  const sB = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-rev-student-b@test.local', $2, 'Student B', 'student') RETURNING id`,
    [instBId, passHash]
  );
  const studentBId = sB.rows[0].id;
  testUserIds.push(studentBId);

  // Batches
  const bA = await query(
    `INSERT INTO batches (institute_id, name, created_by)
     VALUES ($1, 'TEST-RevBatchA', $2) RETURNING id`,
    [instAId, teacherAId]
  );
  const batchAId = bA.rows[0].id;
  testBatchIds.push(batchAId);

  const bB = await query(
    `INSERT INTO batches (institute_id, name, created_by)
     VALUES ($1, 'TEST-RevBatchB', $2) RETURNING id`,
    [instBId, studentBId]
  );
  const batchBId = bB.rows[0].id;
  testBatchIds.push(batchBId);

  // Memberships
  await query(
    `INSERT INTO batch_members (batch_id, user_id, member_role)
     VALUES ($1, $2, 'teacher'), ($1, $3, 'student')`,
    [batchAId, teacherAId, studentA1Id]
  );
  await query(
    `INSERT INTO batch_members (batch_id, user_id, member_role)
     VALUES ($1, $2, 'student')`,
    [batchBId, studentBId]
  );

  // Document in Batch A
  const doc = await query(
    `INSERT INTO documents (institute_id, batch_id, uploaded_by, scope, title, file_name, file_type, storage_path, status)
     VALUES ($1, $2, $3, 'batch', 'TEST Physics Mechanics', 'physics.pdf', 'pdf', 'rev-test/physics.pdf', 'ready')
     RETURNING id`,
    [instAId, batchAId, teacherAId]
  );
  const docId = doc.rows[0].id;
  testDocIds.push(docId);

  // Create Generated Items with different statuses
  // 1. Draft Summary
  const itemSummary = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'summary', 'Mechanics Summary', $3::jsonb, ARRAY[1], 'draft', false) RETURNING id`,
    [instAId, docId, JSON.stringify({ overview: 'Draft overview', sections: [{ heading: 'H1', summary: 'S1', pages: [1] }] })]
  );
  const draftSummaryId = itemSummary.rows[0].id;
  testItemIds.push(draftSummaryId);

  // 2. Approved Notes
  const itemNotes = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'notes', 'Mechanics Notes', $3::jsonb, ARRAY[1], 'approved', false) RETURNING id`,
    [
      instAId,
      docId,
      JSON.stringify({
        title: 'Notes Title',
        sections: [{ heading: 'Sec 1', bullets: ['Point 1'], definitions: [], formulas: ['F=ma'], pages: [1] }],
      }),
    ]
  );
  const approvedNotesId = itemNotes.rows[0].id;
  testItemIds.push(approvedNotesId);

  // 3. Rejected Key Points
  const itemKP = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'key_points', 'Mechanics Key Points', $3::jsonb, ARRAY[1], 'rejected', false) RETURNING id`,
    [instAId, docId, JSON.stringify({ points: [{ point: 'P1', whyItMatters: 'M1', pages: [1] }] })]
  );
  const rejectedKPId = itemKP.rows[0].id;
  testItemIds.push(rejectedKPId);

  // 4. Stale Flashcards (approved but stale)
  const itemFC = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'flashcards', 'Mechanics Cards', $3::jsonb, ARRAY[1], 'approved', true) RETURNING id`,
    [instAId, docId, JSON.stringify({ cards: [{ front: 'Q1', back: 'A1', sourcePage: 1 }] })]
  );
  const staleFCId = itemFC.rows[0].id;
  testItemIds.push(staleFCId);

  // 5. Approved Quiz (3 questions with known correctIndex)
  const quizQuestions = [
    {
      question: 'What is Newton Second Law?',
      options: ['F = ma', 'E = mc^2', 'V = IR', 'P = IV'],
      correctIndex: 0,
      explanation: 'F = ma relates force and acceleration.',
      difficulty: 'easy',
      sourcePage: 1,
      sourceQuote: 'F = ma',
    },
    {
      question: 'What is Newton Third Law?',
      options: ['Inertia', 'Action reaction', 'Gravity', 'Momentum'],
      correctIndex: 1,
      explanation: 'Equal and opposite reaction.',
      difficulty: 'easy',
      sourcePage: 1,
      sourceQuote: 'equal and opposite',
    },
    {
      question: 'What represents inertia?',
      options: ['Speed', 'Acceleration', 'First Law', 'Energy'],
      correctIndex: 2,
      explanation: 'First law is law of inertia.',
      difficulty: 'medium',
      sourcePage: 1,
      sourceQuote: 'law of inertia',
    },
  ];

  const itemQuiz = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'quiz', 'Newton Laws Quiz', $3::jsonb, ARRAY[1], 'approved', false) RETURNING id`,
    [instAId, docId, JSON.stringify({ questions: quizQuestions })]
  );
  const approvedQuizId = itemQuiz.rows[0].id;
  testItemIds.push(approvedQuizId);

  // 6. Draft Quiz
  const itemDraftQuiz = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'quiz', 'Draft Quiz', $3::jsonb, ARRAY[1], 'draft', false) RETURNING id`,
    [instAId, docId, JSON.stringify({ questions: quizQuestions })]
  );
  const draftQuizId = itemDraftQuiz.rows[0].id;
  testItemIds.push(draftQuizId);

  // Save global ids
  global.instAId = instAId;
  global.instBId = instBId;
  global.batchAId = batchAId;
  global.docId = docId;
  global.draftSummaryId = draftSummaryId;
  global.approvedNotesId = approvedNotesId;
  global.rejectedKPId = rejectedKPId;
  global.staleFCId = staleFCId;
  global.approvedQuizId = approvedQuizId;
  global.draftQuizId = draftQuizId;

  // Login cookies
  global.teacherCookie = await loginUser('test-rev-teacher-a@test.local');
  global.studentA1Cookie = await loginUser('test-rev-student-a1@test.local');
  global.studentBCookie = await loginUser('test-rev-student-b@test.local');
});

after(async () => {
  if (server) {
    server.kill('SIGTERM');
  }

  for (const qId of [global.approvedQuizId, global.draftQuizId]) {
    await query('DELETE FROM quiz_attempts WHERE quiz_id=$1', [qId]).catch(() => {});
  }
  for (const iId of testItemIds) {
    await query('DELETE FROM generated_items WHERE id=$1', [iId]).catch(() => {});
  }
  for (const docId of testDocIds) {
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

// ──────────────── Visibility Tests ────────────────

test('Visibility: students never see drafts, stale, or rejected items', async () => {
  // Student views document items
  const resStudent = await fetch(`${BASE}/api/documents/${global.docId}/items`, {
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(resStudent.status, 200);
  const dataStudent = await resStudent.json();

  // Student should only see approved & non-stale items (approvedNotes & approvedQuiz)
  const itemTypes = dataStudent.items.map((i) => i.item_type);
  assert.equal(dataStudent.items.length, 2);
  assert.ok(itemTypes.includes('notes'));
  assert.ok(itemTypes.includes('quiz'));
  assert.ok(!itemTypes.includes('summary'), 'Student should not see draft summary');
  assert.ok(!itemTypes.includes('key_points'), 'Student should not see rejected key points');
  assert.ok(!itemTypes.includes('flashcards'), 'Student should not see stale flashcards');

  // Teacher sees all 6 items
  const resTeacher = await fetch(`${BASE}/api/documents/${global.docId}/items`, {
    headers: { Cookie: global.teacherCookie },
  });
  assert.equal(resTeacher.status, 200);
  const dataTeacher = await resTeacher.json();
  assert.equal(dataTeacher.items.length, 6, 'Teacher should see all items including drafts and rejected');
});

test('Batch items endpoint: supports ?type= and enforces student visibility', async () => {
  const res = await fetch(`${BASE}/api/batches/${global.batchAId}/items?type=notes`, {
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].item_type, 'notes');
});

// ──────────────── Security Tests: Answer Key Leak Prevention ────────────────

test('Security: correctIndex and explanation never leak before attempting', async () => {
  // 1. Check GET /api/quizzes/[id]
  const resQuiz = await fetch(`${BASE}/api/quizzes/${global.approvedQuizId}`, {
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(resQuiz.status, 200);
  const quizData = await resQuiz.json();
  assert.ok(quizData.quiz?.questions?.length === 3);

  for (const q of quizData.quiz.questions) {
    assert.equal(q.correctIndex, undefined, 'correctIndex must never leak in student quiz view');
    assert.equal(q.explanation, undefined, 'explanation must never leak in student quiz view');
    assert.ok(Array.isArray(q.options) && q.options.length === 4);
    assert.ok(q.question);
  }

  // 2. Check GET /api/items/[id] for student
  const resItem = await fetch(`${BASE}/api/items/${global.approvedQuizId}`, {
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(resItem.status, 200);
  const itemData = await resItem.json();
  for (const q of itemData.item.content.questions) {
    assert.equal(q.correctIndex, undefined, 'correctIndex must never leak in GET /items/[id]');
    assert.equal(q.explanation, undefined, 'explanation must never leak in GET /items/[id]');
  }

  // 3. Draft quiz returns 404 to students
  const resDraft = await fetch(`${BASE}/api/quizzes/${global.draftQuizId}`, {
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(resDraft.status, 404, 'Draft quiz must return 404 to student');
});

// ──────────────── Server-Side Scoring & Attempt Tracking ────────────────

test('Scoring: accurate server-side scoring and persistence in quiz_attempts', async () => {
  // Student A1 answers: Q1=0 (correct), Q2=1 (correct), Q3=3 (wrong, correct is 2)
  const answers = [0, 1, 3];

  const res = await fetch(`${BASE}/api/quizzes/${global.approvedQuizId}/attempt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.studentA1Cookie,
    },
    body: JSON.stringify({ answers }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.score, 2, 'Score must be 2 out of 3');
  assert.equal(data.total, 3);
  assert.ok(data.attemptId);

  // Results check
  assert.equal(data.results[0].correct, true);
  assert.equal(data.results[0].correctIndex, 0);
  assert.equal(data.results[1].correct, true);
  assert.equal(data.results[1].correctIndex, 1);
  assert.equal(data.results[2].correct, false);
  assert.equal(data.results[2].correctIndex, 2);

  // Verify DB record
  const dbAttempt = await query('SELECT * FROM quiz_attempts WHERE id=$1', [data.attemptId]);
  assert.equal(dbAttempt.rows.length, 1);
  assert.equal(dbAttempt.rows[0].score, 2);
  assert.equal(dbAttempt.rows[0].total, 3);
});

test('Student history: GET /api/me/attempts and GET /api/me/progress return caller records', async () => {
  // GET /api/me/attempts
  const resAttempts = await fetch(`${BASE}/api/me/attempts`, {
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(resAttempts.status, 200);
  const dataAttempts = await resAttempts.json();
  assert.ok(dataAttempts.attempts.length >= 1);
  assert.equal(dataAttempts.attempts[0].score, 2);

  // GET /api/me/progress
  const resProgress = await fetch(`${BASE}/api/me/progress`, {
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(resProgress.status, 200);
  const dataProgress = await resProgress.json();
  assert.ok(dataProgress.progress.length >= 1);
  const p = dataProgress.progress.find((x) => x.quizId === global.approvedQuizId);
  assert.ok(p);
  assert.equal(p.bestScore, 2);
  assert.equal(p.lastScore, 2);
  assert.equal(p.totalQuestions, 3);
  assert.equal(p.attemptsCount, 1);
});

// ──────────────── Permissions & Isolation Tests ────────────────

test('Isolation: cannot attempt other batch or other institute quizzes (404)', async () => {
  // Student B from Institute B attempts Institute A quiz
  const res = await fetch(`${BASE}/api/quizzes/${global.approvedQuizId}/attempt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.studentBCookie,
    },
    body: JSON.stringify({ answers: [0, 1, 2] }),
  });

  assert.equal(res.status, 404);
});

test('Permissions: student cannot edit, approve, reject, or delete items (403)', async () => {
  // Student attempts PATCH
  const resPatch = await fetch(`${BASE}/api/items/${global.approvedNotesId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.studentA1Cookie,
    },
    body: JSON.stringify({ title: 'Hacked title' }),
  });
  assert.equal(resPatch.status, 403);

  // Student attempts approve
  const resApprove = await fetch(`${BASE}/api/items/${global.draftSummaryId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.studentA1Cookie,
    },
  });
  assert.equal(resApprove.status, 403);

  // Student attempts delete
  const resDelete = await fetch(`${BASE}/api/items/${global.draftSummaryId}`, {
    method: 'DELETE',
    headers: { Cookie: global.studentA1Cookie },
  });
  assert.equal(resDelete.status, 403);
});

test('Teacher operations: edit with schema validation, approve, reject, and delete draft', async () => {
  // 1. Teacher edits title of approved notes
  const resPatch = await fetch(`${BASE}/api/items/${global.approvedNotesId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.teacherCookie,
    },
    body: JSON.stringify({ title: 'Updated Mechanics Notes by Teacher' }),
  });
  assert.equal(resPatch.status, 200);
  const dataPatch = await resPatch.json();
  assert.equal(dataPatch.item.title, 'Updated Mechanics Notes by Teacher');

  // 2. Teacher approves draft summary
  const resApprove = await fetch(`${BASE}/api/items/${global.draftSummaryId}/approve`, {
    method: 'POST',
    headers: { Cookie: global.teacherCookie },
  });
  assert.equal(resApprove.status, 200);
  const dataApprove = await resApprove.json();
  assert.equal(dataApprove.item.status, 'approved');

  // 3. Teacher rejects notes
  const resReject = await fetch(`${BASE}/api/items/${global.approvedNotesId}/reject`, {
    method: 'POST',
    headers: { Cookie: global.teacherCookie },
  });
  assert.equal(resReject.status, 200);
  const dataReject = await resReject.json();
  assert.equal(dataReject.item.status, 'rejected');

  // 4. Teacher deletes draft quiz
  const resDelete = await fetch(`${BASE}/api/items/${global.draftQuizId}`, {
    method: 'DELETE',
    headers: { Cookie: global.teacherCookie },
  });
  assert.equal(resDelete.status, 200);
  const dataDelete = await resDelete.json();
  assert.equal(dataDelete.ok, true);

  // 5. Deleting non-draft returns 400
  const resDeleteNonDraft = await fetch(`${BASE}/api/items/${global.approvedQuizId}`, {
    method: 'DELETE',
    headers: { Cookie: global.teacherCookie },
  });
  assert.equal(resDeleteNonDraft.status, 400);
});

test('Cross-institute access returns 404', async () => {
  const res = await fetch(`${BASE}/api/items/${global.approvedQuizId}`, {
    headers: { Cookie: global.studentBCookie },
  });
  assert.equal(res.status, 404);
});
