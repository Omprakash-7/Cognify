/**
 * Seed script: creates demo data for development.
 * Idempotent — uses ON CONFLICT to skip existing rows.
 *
 * Demo password for all users: Password@123
 *
 * Usage: node db/seed.js
 */

import '../lib/env.js';
import bcrypt from 'bcryptjs';
import { query, closePool } from '../lib/db.js';

const PASSWORD = 'Password@123';
const ROUNDS = 10;

async function main() {
  const hash = await bcrypt.hash(PASSWORD, ROUNDS);

  // ── Institutes ──
  const { rows: [demoInst] } = await query(
    `INSERT INTO institutes (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['Demo Coaching Institute']
  );

  const { rows: [rivalInst] } = await query(
    `INSERT INTO institutes (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['Rival Institute']
  );

  // ── Helper: upsert user ──
  async function upsertUser(instId, email, fullName, role) {
    const { rows: [u] } = await query(
      `INSERT INTO users (institute_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [instId, email, hash, fullName, role]
    );
    return u.id;
  }

  // ── Demo Institute users ──
  const adminId   = await upsertUser(demoInst.id, 'admin@demo.test',    'Admin User',   'admin');
  const teacherId = await upsertUser(demoInst.id, 'teacher@demo.test',  'Demo Teacher', 'teacher');
  const s1Id      = await upsertUser(demoInst.id, 'student1@demo.test', 'Student One',  'student');
  const s2Id      = await upsertUser(demoInst.id, 'student2@demo.test', 'Student Two',  'student');
  const s3Id      = await upsertUser(demoInst.id, 'student3@demo.test', 'Student Three','student');

  // ── Rival Institute users ──
  const rivalTeacherId  = await upsertUser(rivalInst.id, 'teacher@rival.test', 'Rival Teacher', 'teacher');
  const rivalStudentId  = await upsertUser(rivalInst.id, 'student@rival.test', 'Rival Student', 'student');

  // ── Helper: upsert batch ──
  async function upsertBatch(instId, name, subject, createdBy) {
    const { rows: [b] } = await query(
      `INSERT INTO batches (institute_id, name, subject, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (institute_id, name) DO UPDATE SET subject = EXCLUDED.subject
       RETURNING id`,
      [instId, name, subject, createdBy]
    );
    return b.id;
  }

  // ── Demo Institute batches ──
  const physBatchId = await upsertBatch(demoInst.id, 'Physics Batch A', 'Physics', teacherId);
  const chemBatchId = await upsertBatch(demoInst.id, 'Chemistry Batch B', 'Chemistry', teacherId);

  // ── Rival Institute batch ──
  const mathBatchId = await upsertBatch(rivalInst.id, 'Maths Batch', 'Mathematics', rivalTeacherId);

  // ── Helper: add batch member ──
  async function addMember(batchId, userId, memberRole) {
    await query(
      `INSERT INTO batch_members (batch_id, user_id, member_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (batch_id, user_id) DO NOTHING`,
      [batchId, userId, memberRole]
    );
  }

  // ── Physics Batch A: teacher + student1, student2 ──
  await addMember(physBatchId, teacherId, 'teacher');
  await addMember(physBatchId, s1Id, 'student');
  await addMember(physBatchId, s2Id, 'student');

  // ── Chemistry Batch B: teacher + student2, student3 ──
  await addMember(chemBatchId, teacherId, 'teacher');
  await addMember(chemBatchId, s2Id, 'student');
  await addMember(chemBatchId, s3Id, 'student');

  // ── Maths Batch: rival teacher + rival student ──
  await addMember(mathBatchId, rivalTeacherId, 'teacher');
  await addMember(mathBatchId, rivalStudentId, 'student');

  await closePool();

  console.log('\nSeed complete ✓\n');
  console.log('Demo Logins (password: Password@123)');
  console.log('─'.repeat(50));
  console.log('Institute              | Email                | Role');
  console.log('─'.repeat(50));
  console.log('Demo Coaching Institute| admin@demo.test      | admin');
  console.log('Demo Coaching Institute| teacher@demo.test    | teacher');
  console.log('Demo Coaching Institute| student1@demo.test   | student');
  console.log('Demo Coaching Institute| student2@demo.test   | student');
  console.log('Demo Coaching Institute| student3@demo.test   | student');
  console.log('Rival Institute        | teacher@rival.test   | teacher');
  console.log('Rival Institute        | student@rival.test   | student');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
