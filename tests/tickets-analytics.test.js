/**
 * Tests for Phase 7: Doubt Tickets & Analytics.
 *
 * Verifies:
 * - Doubt ticket creation, validation, and batch membership checks.
 * - Ticket visibility: students see only their own tickets, teachers see their batch tickets, admins see all.
 * - Teacher answers ticket, sets answered_by and answered_at.
 * - Non-member teacher cannot answer ticket (404), student cannot answer (403).
 * - Owner or teacher can close ticket, unauthorized student receives 403.
 * - Batch analytics returns accurate aggregates: members, documents, items, quizzes,
 *   hardest questions from quiz_attempts.answers, student progress, 14-day chat activity,
 *   unanswered questions with preceding questions, and open tickets count.
 * - Isolation: student calling batch analytics returns 403, non-member teacher returns 404,
 *   other-institute teacher returns 404.
 * - Institute analytics returns per-batch totals and institute aggregates for admins only (403 for students/teachers).
 *
 * Run with: node tests/tickets-analytics.test.js
 */

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import '../lib/env.js';
import { query, closePool } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3005;
const BASE = `http://localhost:${PORT}`;
const HEALTH = `${BASE}/api/health`;

let server;
const testInstituteIds = [];
const testUserIds = [];
const testBatchIds = [];
const testDocIds = [];
const testItemIds = [];
const testTicketIds = [];
const testAttemptIds = [];

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
  // Start dev server on port 3005
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

  const passHash = await hashPassword('Password123!');

  // 1. Create Institute A & Institute B
  const instA = await query("INSERT INTO institutes (name) VALUES ('TEST-TickInstA') RETURNING id");
  const instAId = instA.rows[0].id;
  testInstituteIds.push(instAId);

  const instB = await query("INSERT INTO institutes (name) VALUES ('TEST-TickInstB') RETURNING id");
  const instBId = instB.rows[0].id;
  testInstituteIds.push(instBId);

  // 2. Users in Institute A
  // Admin A
  const adminARes = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-tick-admin-a@test.local', $2, 'Admin A', 'admin') RETURNING id`,
    [instAId, passHash]
  );
  const adminAId = adminARes.rows[0].id;
  testUserIds.push(adminAId);

  // Teacher 1 in Batch 1
  const t1Res = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-tick-teacher1@test.local', $2, 'Teacher One', 'teacher') RETURNING id`,
    [instAId, passHash]
  );
  const teacher1Id = t1Res.rows[0].id;
  testUserIds.push(teacher1Id);

  // Teacher 2 NOT in Batch 1 (in Batch 2)
  const t2Res = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-tick-teacher2@test.local', $2, 'Teacher Two', 'teacher') RETURNING id`,
    [instAId, passHash]
  );
  const teacher2Id = t2Res.rows[0].id;
  testUserIds.push(teacher2Id);

  // Student 1 in Batch 1
  const s1Res = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-tick-student1@test.local', $2, 'Student One', 'student') RETURNING id`,
    [instAId, passHash]
  );
  const student1Id = s1Res.rows[0].id;
  testUserIds.push(student1Id);

  // Student 2 in Batch 1
  const s2Res = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-tick-student2@test.local', $2, 'Student Two', 'student') RETURNING id`,
    [instAId, passHash]
  );
  const student2Id = s2Res.rows[0].id;
  testUserIds.push(student2Id);

  // User in Institute B
  const sBRes = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-tick-student-b@test.local', $2, 'Student B', 'student') RETURNING id`,
    [instBId, passHash]
  );
  const studentBId = sBRes.rows[0].id;
  testUserIds.push(studentBId);

  const tBRes = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-tick-teacher-b@test.local', $2, 'Teacher B', 'teacher') RETURNING id`,
    [instBId, passHash]
  );
  const teacherBId = tBRes.rows[0].id;
  testUserIds.push(teacherBId);

  // 3. Batches
  // Batch A1 in Institute A
  const bA1Res = await query(
    `INSERT INTO batches (institute_id, name, created_by)
     VALUES ($1, 'TEST-TickBatchA1', $2) RETURNING id`,
    [instAId, teacher1Id]
  );
  const batchA1Id = bA1Res.rows[0].id;
  testBatchIds.push(batchA1Id);

  // Batch A2 in Institute A
  const bA2Res = await query(
    `INSERT INTO batches (institute_id, name, created_by)
     VALUES ($1, 'TEST-TickBatchA2', $2) RETURNING id`,
    [instAId, teacher2Id]
  );
  const batchA2Id = bA2Res.rows[0].id;
  testBatchIds.push(batchA2Id);

  // Batch B in Institute B
  const bBRes = await query(
    `INSERT INTO batches (institute_id, name, created_by)
     VALUES ($1, 'TEST-TickBatchB', $2) RETURNING id`,
    [instBId, teacherBId]
  );
  const batchBId = bBRes.rows[0].id;
  testBatchIds.push(batchBId);

  // 4. Batch Memberships
  // Batch A1: Teacher 1, Student 1, Student 2
  await query(
    `INSERT INTO batch_members (batch_id, user_id, member_role)
     VALUES ($1, $2, 'teacher'), ($1, $3, 'student'), ($1, $4, 'student')`,
    [batchA1Id, teacher1Id, student1Id, student2Id]
  );

  // Batch A2: Teacher 2
  await query(
    `INSERT INTO batch_members (batch_id, user_id, member_role)
     VALUES ($1, $2, 'teacher')`,
    [batchA2Id, teacher2Id]
  );

  // Batch B: Teacher B, Student B
  await query(
    `INSERT INTO batch_members (batch_id, user_id, member_role)
     VALUES ($1, $2, 'teacher'), ($1, $3, 'student')`,
    [batchBId, teacherBId, studentBId]
  );

  // 5. Seed Documents and Items in Batch A1 for Analytics
  const doc1 = await query(
    `INSERT INTO documents (institute_id, batch_id, uploaded_by, scope, title, file_name, file_type, storage_path, status)
     VALUES ($1, $2, $3, 'batch', 'TEST Physics Doc', 'physics.pdf', 'pdf', 'tick-test/physics.pdf', 'ready')
     RETURNING id`,
    [instAId, batchA1Id, teacher1Id]
  );
  const doc1Id = doc1.rows[0].id;
  testDocIds.push(doc1Id);

  const doc2 = await query(
    `INSERT INTO documents (institute_id, batch_id, uploaded_by, scope, title, file_name, file_type, storage_path, status)
     VALUES ($1, $2, $3, 'batch', 'TEST Chemistry Doc', 'chemistry.pdf', 'pdf', 'tick-test/chemistry.pdf', 'failed')
     RETURNING id`,
    [instAId, batchA1Id, teacher1Id]
  );
  testDocIds.push(doc2.rows[0].id);

  // Generated Items for Batch A1
  const itemNotes = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'notes', 'Physics Notes', '{"title":"Notes","sections":[]}'::jsonb, ARRAY[1], 'approved', false)
     RETURNING id`,
    [instAId, doc1Id]
  );
  testItemIds.push(itemNotes.rows[0].id);

  const quizQuestions = [
    {
      question: 'What is acceleration due to gravity on Earth?',
      options: ['9.8 m/s^2', '100 m/s^2', '1 m/s^2', 'Zero'],
      correctIndex: 0,
      explanation: 'Standard g is approximately 9.8 m/s^2',
      difficulty: 'easy',
      sourcePage: 1,
    },
    {
      question: 'Which of the following is a vector quantity?',
      options: ['Mass', 'Velocity', 'Speed', 'Temperature'],
      correctIndex: 1,
      explanation: 'Velocity has both magnitude and direction',
      difficulty: 'medium',
      sourcePage: 1,
    },
  ];

  const itemQuiz = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, 'quiz', 'Physics Quiz 1', $3::jsonb, ARRAY[1], 'approved', false)
     RETURNING id`,
    [instAId, doc1Id, JSON.stringify({ questions: quizQuestions })]
  );
  const quizId = itemQuiz.rows[0].id;
  testItemIds.push(quizId);

  // 6. Seed Quiz Attempts for Student 1 and Student 2
  // Student 1: answered Q0 correct (0), Q1 incorrect (0 instead of 1) -> score 1 / 2 (50%)
  const a1 = await query(
    `INSERT INTO quiz_attempts (institute_id, user_id, quiz_id, score, total, answers)
     VALUES ($1, $2, $3, 1, 2, '[0, 0]'::jsonb) RETURNING id`,
    [instAId, student1Id, quizId]
  );
  testAttemptIds.push(a1.rows[0].id);

  // Student 2: answered Q0 correct (0), Q1 incorrect (2 instead of 1) -> score 1 / 2 (50%)
  const a2 = await query(
    `INSERT INTO quiz_attempts (institute_id, user_id, quiz_id, score, total, answers)
     VALUES ($1, $2, $3, 1, 2, '[0, 2]'::jsonb) RETURNING id`,
    [instAId, student2Id, quizId]
  );
  testAttemptIds.push(a2.rows[0].id);

  // 7. Seed Chat Messages for Batch A1
  // Q1 & A1: Grounded answer (citations non-empty)
  await query(
    `INSERT INTO chat_messages (institute_id, batch_id, user_id, role, content, citations)
     VALUES ($1, $2, $3, 'user', 'What is g?', '[]'::jsonb),
            ($1, $2, $3, 'assistant', 'g is 9.8 m/s^2 [1]', '[{"n":1}]'::jsonb)`,
    [instAId, batchA1Id, student1Id]
  );

  // Q2 & A2: Unanswered / fallback question (empty citations '[]')
  await query(
    `INSERT INTO chat_messages (institute_id, batch_id, user_id, role, content, citations)
     VALUES ($1, $2, $3, 'user', 'Who wrote Hamlet?', '[]'::jsonb),
            ($1, $2, $3, 'assistant', 'I could not find this in your study material.', '[]'::jsonb)`,
    [instAId, batchA1Id, student1Id]
  );

  // Save global ids & cookies
  global.instAId = instAId;
  global.instBId = instBId;
  global.batchA1Id = batchA1Id;
  global.batchA2Id = batchA2Id;
  global.batchBId = batchBId;
  global.adminAId = adminAId;
  global.teacher1Id = teacher1Id;
  global.teacher2Id = teacher2Id;
  global.student1Id = student1Id;
  global.student2Id = student2Id;
  global.quizId = quizId;

  global.adminACookie = await loginUser('test-tick-admin-a@test.local');
  global.teacher1Cookie = await loginUser('test-tick-teacher1@test.local');
  global.teacher2Cookie = await loginUser('test-tick-teacher2@test.local');
  global.student1Cookie = await loginUser('test-tick-student1@test.local');
  global.student2Cookie = await loginUser('test-tick-student2@test.local');
  global.studentBCookie = await loginUser('test-tick-student-b@test.local');
  global.teacherBCookie = await loginUser('test-tick-teacher-b@test.local');
});

after(async () => {
  if (server) {
    server.kill();
  }

  // Cleanup DB
  await query('DELETE FROM tickets WHERE institute_id = ANY($1::uuid[])', [testInstituteIds]).catch(() => {});
  await query('DELETE FROM quiz_attempts WHERE institute_id = ANY($1::uuid[])', [testInstituteIds]).catch(() => {});
  await query('DELETE FROM chat_messages WHERE institute_id = ANY($1::uuid[])', [testInstituteIds]).catch(() => {});
  await query('DELETE FROM generated_items WHERE institute_id = ANY($1::uuid[])', [testInstituteIds]).catch(() => {});
  await query('DELETE FROM documents WHERE institute_id = ANY($1::uuid[])', [testInstituteIds]).catch(() => {});
  await query('DELETE FROM batch_members WHERE batch_id = ANY($1::uuid[])', [testBatchIds]).catch(() => {});
  await query('DELETE FROM batches WHERE id = ANY($1::uuid[])', [testBatchIds]).catch(() => {});
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [testUserIds]).catch(() => {});
  await query('DELETE FROM institutes WHERE id = ANY($1::uuid[])', [testInstituteIds]).catch(() => {});

  await closePool();
});

// ──────────────── Doubt Tickets Tests ────────────────

test('Ticket creation: Student creates ticket in batch', async () => {
  const res = await fetch(`${BASE}/api/batches/${global.batchA1Id}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.student1Cookie,
    },
    body: JSON.stringify({ question: 'How do I derive F = ma?' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.ticket);
  assert.equal(data.ticket.question, 'How do I derive F = ma?');
  assert.equal(data.ticket.status, 'open');
  assert.equal(data.ticket.student_id, global.student1Id);

  global.ticket1Id = data.ticket.id;
  testTicketIds.push(data.ticket.id);
});

test('Ticket creation: Student 2 creates ticket in batch', async () => {
  const res = await fetch(`${BASE}/api/batches/${global.batchA1Id}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.student2Cookie,
    },
    body: JSON.stringify({ question: 'Why does gravity bend light?' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  global.ticket2Id = data.ticket.id;
  testTicketIds.push(data.ticket.id);
});

test('Ticket creation validation and isolation: empty question 422, non-member 404', async () => {
  // Empty question
  const resEmpty = await fetch(`${BASE}/api/batches/${global.batchA1Id}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.student1Cookie,
    },
    body: JSON.stringify({ question: '   ' }),
  });
  assert.equal(resEmpty.status, 422);

  // Student B from another institute -> 404
  const resOtherInst = await fetch(`${BASE}/api/batches/${global.batchA1Id}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.studentBCookie,
    },
    body: JSON.stringify({ question: 'Can I ask something here?' }),
  });
  assert.equal(resOtherInst.status, 404);

  // Teacher 2 not in Batch A1 -> 404
  const resNonMember = await fetch(`${BASE}/api/batches/${global.batchA1Id}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.teacher2Cookie,
    },
    body: JSON.stringify({ question: 'Question from non-member teacher' }),
  });
  assert.equal(resNonMember.status, 404);
});

test('Ticket listing (GET /api/tickets): Role visibility & filter isolation', async () => {
  // 1. Student 1 sees only their own tickets
  const resS1 = await fetch(`${BASE}/api/tickets`, {
    headers: { Cookie: global.student1Cookie },
  });
  assert.equal(resS1.status, 200);
  const dataS1 = await resS1.json();
  assert.ok(Array.isArray(dataS1.tickets));
  assert.equal(dataS1.tickets.length, 1);
  assert.equal(dataS1.tickets[0].id, global.ticket1Id);
  assert.equal(dataS1.tickets[0].student_id, global.student1Id);

  // 2. Teacher 1 sees tickets for Batch A1 (both Ticket 1 and Ticket 2)
  const resT1 = await fetch(`${BASE}/api/tickets`, {
    headers: { Cookie: global.teacher1Cookie },
  });
  assert.equal(resT1.status, 200);
  const dataT1 = await resT1.json();
  assert.equal(dataT1.tickets.length, 2);

  // 3. Teacher 2 (not in Batch A1) sees 0 tickets
  const resT2 = await fetch(`${BASE}/api/tickets`, {
    headers: { Cookie: global.teacher2Cookie },
  });
  assert.equal(resT2.status, 200);
  const dataT2 = await resT2.json();
  assert.equal(dataT2.tickets.length, 0);

  // 4. Admin sees all tickets in Institute A
  const resAdmin = await fetch(`${BASE}/api/tickets`, {
    headers: { Cookie: global.adminACookie },
  });
  assert.equal(resAdmin.status, 200);
  const dataAdmin = await resAdmin.json();
  assert.equal(dataAdmin.tickets.length, 2);

  // 5. Filter by ?status=open works
  const resOpen = await fetch(`${BASE}/api/tickets?status=open`, {
    headers: { Cookie: global.teacher1Cookie },
  });
  assert.equal(resOpen.status, 200);
  const dataOpen = await resOpen.json();
  assert.equal(dataOpen.tickets.length, 2);

  // Filter by ?status=answered returns 0
  const resAnswered = await fetch(`${BASE}/api/tickets?status=answered`, {
    headers: { Cookie: global.teacher1Cookie },
  });
  assert.equal(resAnswered.status, 200);
  const dataAnswered = await resAnswered.json();
  assert.equal(dataAnswered.tickets.length, 0);

  // 6. Cross-institute student sees 0 tickets
  const resSB = await fetch(`${BASE}/api/tickets`, {
    headers: { Cookie: global.studentBCookie },
  });
  assert.equal(resSB.status, 200);
  const dataSB = await resSB.json();
  assert.equal(dataSB.tickets.length, 0);
});

test('Ticket answering (POST /api/tickets/[id]/answer): Teacher answers, unauthorized blocked', async () => {
  // 1. Student attempts to answer -> 403
  const resStudentAns = await fetch(`${BASE}/api/tickets/${global.ticket1Id}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.student1Cookie,
    },
    body: JSON.stringify({ answer: 'I will answer my own question.' }),
  });
  assert.equal(resStudentAns.status, 403);

  // 2. Teacher 2 (not in Batch A1) attempts to answer -> 403 (or 404 for non-member)
  const resT2Ans = await fetch(`${BASE}/api/tickets/${global.ticket1Id}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.teacher2Cookie,
    },
    body: JSON.stringify({ answer: 'Teacher 2 unauthorized answer.' }),
  });
  assert.ok(resT2Ans.status === 403 || resT2Ans.status === 404);

  // 3. Other-institute teacher attempts to answer -> 404
  const resTBAns = await fetch(`${BASE}/api/tickets/${global.ticket1Id}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.teacherBCookie,
    },
    body: JSON.stringify({ answer: 'Teacher B unauthorized answer.' }),
  });
  assert.equal(resTBAns.status, 404);

  // 4. Teacher 1 (teacher in Batch A1) answers ticket
  const resAns = await fetch(`${BASE}/api/tickets/${global.ticket1Id}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: global.teacher1Cookie,
    },
    body: JSON.stringify({ answer: 'Start from F = dp/dt where p = mv. If mass is constant, F = m(dv/dt) = ma.' }),
  });
  assert.equal(resAns.status, 200);
  const dataAns = await resAns.json();
  assert.equal(dataAns.ticket.status, 'answered');
  assert.equal(dataAns.ticket.answered_by, global.teacher1Id);
  assert.ok(dataAns.ticket.answered_at);
  assert.ok(dataAns.ticket.answer.includes('F = dp/dt'));
});

test('Ticket closing (POST /api/tickets/[id]/close): Owner closes, teacher closes, unauthorized blocked', async () => {
  // 1. Student 2 tries to close Student 1's ticket -> 403
  const resS2Close = await fetch(`${BASE}/api/tickets/${global.ticket1Id}/close`, {
    method: 'POST',
    headers: { Cookie: global.student2Cookie },
  });
  assert.equal(resS2Close.status, 403);

  // 2. Ticket 1 owner (Student 1) closes their own ticket
  const resOwnerClose = await fetch(`${BASE}/api/tickets/${global.ticket1Id}/close`, {
    method: 'POST',
    headers: { Cookie: global.student1Cookie },
  });
  assert.equal(resOwnerClose.status, 200);
  const dataOwnerClose = await resOwnerClose.json();
  assert.equal(dataOwnerClose.ticket.status, 'closed');

  // 3. Teacher 1 closes Ticket 2 (owned by Student 2)
  const resTeacherClose = await fetch(`${BASE}/api/tickets/${global.ticket2Id}/close`, {
    method: 'POST',
    headers: { Cookie: global.teacher1Cookie },
  });
  assert.equal(resTeacherClose.status, 200);
  const dataTeacherClose = await resTeacherClose.json();
  assert.equal(dataTeacherClose.ticket.status, 'closed');
});

// ──────────────── Analytics Tests ────────────────

test('Batch analytics (GET /api/batches/[id]/analytics): Teacher in batch receives comprehensive metrics', async () => {
  // First, create a new open ticket so openTicketsCount > 0
  const tRes = await query(
    `INSERT INTO tickets (institute_id, batch_id, student_id, question, status)
     VALUES ($1, $2, $3, 'Open ticket for analytics test', 'open') RETURNING id`,
    [global.instAId, global.batchA1Id, global.student1Id]
  );
  testTicketIds.push(tRes.rows[0].id);

  const res = await fetch(`${BASE}/api/batches/${global.batchA1Id}/analytics`, {
    headers: { Cookie: global.teacher1Cookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  // 1. Member counts (1 teacher + 2 students = 3)
  assert.equal(data.members.total, 3);
  assert.equal(data.members.teachers, 1);
  assert.equal(data.members.students, 2);

  // 2. Document counts (1 ready + 1 failed = 2)
  assert.equal(data.documents.total, 2);
  assert.equal(data.documents.byStatus.ready, 1);
  assert.equal(data.documents.byStatus.failed, 1);

  // 3. Item counts (1 notes + 1 quiz = 2)
  assert.equal(data.items.total, 2);
  assert.equal(data.items.byType.notes, 1);
  assert.equal(data.items.byType.quiz, 1);
  assert.equal(data.items.byStatus.approved, 2);

  // 4. Quiz stats: 2 attempts, avg score 50%
  assert.equal(data.quizzes.totalAttempts, 2);
  assert.equal(data.quizzes.averageScorePct, 50);
  assert.ok(data.quizzes.attemptsPerQuiz.length >= 1);
  assert.equal(data.quizzes.attemptsPerQuiz[0].attempts_count, 2);

  // Hardest questions:
  // Q0 (gravity): both answered correctly (correctCount 2, attempts 2 -> 100%)
  // Q1 (vector): both answered incorrectly (correctCount 0, attempts 2 -> 0%)
  // So hardest question is Q1 with 0% correct!
  assert.ok(data.quizzes.hardestQuestions.length >= 1);
  const hardest = data.quizzes.hardestQuestions[0];
  assert.equal(hardest.questionIndex, 1);
  assert.equal(hardest.correctPercentage, 0);
  assert.equal(hardest.attemptsCount, 2);
  assert.equal(hardest.correctCount, 0);

  // 5. Per-student progress (2 students, each with 1 attempt and 50% avg score)
  assert.equal(data.studentProgress.length, 2);
  const sProgress1 = data.studentProgress.find((p) => p.user_id === global.student1Id);
  assert.ok(sProgress1);
  assert.equal(sProgress1.attempts_count, 1);
  assert.equal(sProgress1.avg_score_pct, 50);

  // 6. Chat messages per day (last 14 days)
  assert.ok(Array.isArray(data.chatActivity));
  assert.ok(data.chatActivity.length >= 1);
  const totalChat = data.chatActivity.reduce((acc, c) => acc + c.count, 0);
  assert.equal(totalChat, 4);

  // 7. Unanswered questions (should contain Hamlet question)
  assert.ok(Array.isArray(data.unansweredQuestions));
  assert.equal(data.unansweredQuestions.length, 1);
  assert.equal(data.unansweredQuestions[0].preceding_question, 'Who wrote Hamlet?');

  // 8. Open tickets count
  assert.equal(data.openTicketsCount, 1);
});

test('Batch analytics isolation: student 403, non-member teacher 404, other-institute 404', async () => {
  // Student calling analytics -> 403
  const resStudent = await fetch(`${BASE}/api/batches/${global.batchA1Id}/analytics`, {
    headers: { Cookie: global.student1Cookie },
  });
  assert.equal(resStudent.status, 403);

  // Teacher 2 not in Batch A1 -> 404
  const resT2 = await fetch(`${BASE}/api/batches/${global.batchA1Id}/analytics`, {
    headers: { Cookie: global.teacher2Cookie },
  });
  assert.equal(resT2.status, 404);

  // Other institute teacher -> 404
  const resTB = await fetch(`${BASE}/api/batches/${global.batchA1Id}/analytics`, {
    headers: { Cookie: global.teacherBCookie },
  });
  assert.equal(resTB.status, 404);

  // Admin in Institute A has access -> 200
  const resAdmin = await fetch(`${BASE}/api/batches/${global.batchA1Id}/analytics`, {
    headers: { Cookie: global.adminACookie },
  });
  assert.equal(resAdmin.status, 200);
});

test('Institute analytics (GET /api/analytics/institute): Admin only, per-batch breakdown', async () => {
  // 1. Teacher access -> 403
  const resTeacher = await fetch(`${BASE}/api/analytics/institute`, {
    headers: { Cookie: global.teacher1Cookie },
  });
  assert.equal(resTeacher.status, 403);

  // 2. Student access -> 403
  const resStudent = await fetch(`${BASE}/api/analytics/institute`, {
    headers: { Cookie: global.student1Cookie },
  });
  assert.equal(resStudent.status, 403);

  // 3. Admin access -> 200
  const resAdmin = await fetch(`${BASE}/api/analytics/institute`, {
    headers: { Cookie: global.adminACookie },
  });
  assert.equal(resAdmin.status, 200);
  const data = await resAdmin.json();

  // Institute A has 2 batches: Batch A1 and Batch A2
  assert.ok(Array.isArray(data.batches));
  assert.equal(data.batches.length, 2);

  const batch1Summary = data.batches.find((b) => b.batchId === global.batchA1Id);
  assert.ok(batch1Summary);
  assert.equal(batch1Summary.memberCount, 3);
  assert.equal(batch1Summary.studentCount, 2);
  assert.equal(batch1Summary.teacherCount, 1);
  assert.equal(batch1Summary.documentCount, 2);
  assert.equal(batch1Summary.itemCount, 2);
  assert.equal(batch1Summary.quizAttemptCount, 2);
  assert.equal(batch1Summary.chatMessageCount, 4);
  assert.equal(batch1Summary.openTicketCount, 1);

  // Institute totals
  assert.equal(data.instituteTotals.batchCount, 2);
  assert.equal(data.instituteTotals.memberCount, 4); // 3 in Batch A1 + 1 in Batch A2
  assert.equal(data.instituteTotals.documentCount, 2);
  assert.equal(data.instituteTotals.itemCount, 2);
  assert.equal(data.instituteTotals.quizAttemptCount, 2);
  assert.equal(data.instituteTotals.chatMessageCount, 4);
  assert.equal(data.instituteTotals.openTicketCount, 1);
});
