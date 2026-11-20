/**
 * Tests for Phase 3: Worker Pipeline & Document Parsers.
 *
 * Verifies:
 * - Parser unit tests for PDF, PPTX, DOCX, TXT.
 * - Scanned PDF detection and rejection.
 * - Corrupt file rejection and magic bytes validation.
 * - End-to-end processing of all 4 formats via `node worker/index.js --once`.
 * - 1536-dimension embeddings stored in chunks.
 * - Reprocess idempotency (no duplicate chunks).
 * - Automatic job cleanup and test isolation.
 *
 * Run with: node tests/pipeline.test.js
 */

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Load env
import '../lib/env.js';
import { query, closePool } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';
import { getStorageClient, getBucket, removeFile } from '../lib/storage.js';
import { parsePdf } from '../lib/parsers/pdf.js';
import { parsePptx } from '../lib/parsers/pptx.js';
import { parseDocx } from '../lib/parsers/docx.js';
import { parseTxt } from '../lib/parsers/txt.js';
import { createFixtures } from './fixtures/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

const testInstituteIds = [];
const testUserIds = [];
const testBatchIds = [];
const testDocIds = [];
const testStoragePaths = [];

before(async () => {
  // Ensure fixtures exist
  await createFixtures();

  // Create isolated test institute, user, and batch
  const inst = await query("INSERT INTO institutes (name) VALUES ('TEST-PipelineInst') RETURNING id");
  const instId = inst.rows[0].id;
  testInstituteIds.push(instId);

  const hash = await hashPassword('Pass123!');
  const user = await query(
    `INSERT INTO users (institute_id, email, password_hash, full_name, role)
     VALUES ($1, 'test-pipe-teacher@test.local', $2, 'Pipe Teacher', 'teacher') RETURNING id`,
    [instId, hash]
  );
  const userId = user.rows[0].id;
  testUserIds.push(userId);

  const batch = await query(
    "INSERT INTO batches (institute_id, name, created_by) VALUES ($1, 'TEST-PipeBatch', $2) RETURNING id",
    [instId, userId]
  );
  const batchId = batch.rows[0].id;
  testBatchIds.push(batchId);

  global.pipeInstId = instId;
  global.pipeUserId = userId;
  global.pipeBatchId = batchId;
});

after(async () => {
  // Remove test storage files
  if (testStoragePaths.length) {
    await removeFile(testStoragePaths).catch(() => {});
  }

  // Clean DB
  for (const docId of testDocIds) {
    await query('DELETE FROM chunks WHERE document_id=$1', [docId]).catch(() => {});
    await query('DELETE FROM jobs WHERE document_id=$1', [docId]).catch(() => {});
    await query('DELETE FROM documents WHERE id=$1', [docId]).catch(() => {});
  }
  for (const bid of testBatchIds) {
    await query('DELETE FROM batch_members WHERE batch_id=$1', [bid]).catch(() => {});
    await query('DELETE FROM batches WHERE id=$1', [bid]).catch(() => {});
  }
  if (testUserIds.length) {
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [testUserIds]).catch(() => {});
  }
  for (const iid of testInstituteIds) {
    await query('DELETE FROM institutes WHERE id=$1', [iid]).catch(() => {});
  }

  await closePool();
});

// ──────────────── Parser Unit Tests ────────────────

test('PDF parser: extracts text and page numbers from valid PDF', async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, 'sample.pdf'));
  const pages = await parsePdf(buf);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].page, 1);
  assert.ok(pages[0].text.includes('Classical Mechanics'));
});

test('PDF parser: rejects scanned PDF with no selectable text', async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, 'scanned.pdf'));
  await assert.rejects(
    async () => parsePdf(buf),
    (err) => err.message.includes('No selectable text found')
  );
});

test('PDF parser: rejects corrupt PDF with magic bytes mismatch', async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, 'corrupt.pdf'));
  await assert.rejects(
    async () => parsePdf(buf),
    (err) => err.message.includes('magic bytes mismatch')
  );
});

test('PPTX parser: extracts slide texts in natural numeric order', async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, 'sample.pptx'));
  const pages = await parsePptx(buf);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].page, 1);
  assert.ok(pages[0].text.includes('Kinetic'));
  assert.equal(pages[1].page, 2);
  assert.ok(pages[1].text.includes('Conservation'));
});

test('DOCX parser: extracts text and splits into pseudo-pages', async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, 'sample.docx'));
  const pages = await parseDocx(buf);
  assert.ok(pages.length >= 1);
  assert.ok(pages[0].text.includes('Thermodynamics'));
});

test('TXT parser: reads UTF-8 text and divides on paragraphs', async () => {
  const buf = fs.readFileSync(path.join(fixturesDir, 'sample.txt'));
  const pages = await parseTxt(buf);
  assert.ok(pages.length >= 1);
  assert.ok(pages[0].text.includes("Newton's First Law"));
});

// ──────────────── End-to-End Pipeline & Worker Once Tests ────────────────

test('Worker:once processes TXT, PDF, PPTX, DOCX and handles corrupt file', async () => {
  const supabase = getStorageClient();
  const bucket = getBucket();

  const formats = [
    { type: 'txt', file: 'sample.txt', title: 'Newton Laws TXT' },
    { type: 'pdf', file: 'sample.pdf', title: 'Mechanics PDF' },
    { type: 'pptx', file: 'sample.pptx', title: 'Energy PPTX' },
    { type: 'docx', file: 'sample.docx', title: 'Thermo DOCX' },
    { type: 'pdf', file: 'corrupt.pdf', title: 'Corrupt PDF' },
  ];

  const createdDocs = [];

  for (const fmt of formats) {
    const docId = crypto.randomUUID();
    testDocIds.push(docId);
    const storagePath = `${global.pipeInstId}/${global.pipeBatchId}/${docId}/${fmt.file}`;
    testStoragePaths.push(storagePath);

    // Upload to storage
    const content = fs.readFileSync(path.join(fixturesDir, fmt.file));
    const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, content, { upsert: true });
    assert.equal(upErr, null, `Upload failed for ${fmt.file}: ${upErr?.message}`);

    // Insert document row
    await query(
      `INSERT INTO documents (
        id, institute_id, batch_id, uploaded_by, scope, title, file_name, file_type, storage_path, status
      ) VALUES ($1, $2, $3, $4, 'batch', $5, $6, $7, $8, 'processing')`,
      [docId, global.pipeInstId, global.pipeBatchId, global.pipeUserId, fmt.title, fmt.file, fmt.type, storagePath]
    );

    // Enqueue process_document job
    const jobRes = await query(
      `INSERT INTO jobs (institute_id, document_id, job_type, payload)
       VALUES ($1, $2, 'process_document', $3) RETURNING id`,
      [global.pipeInstId, docId, JSON.stringify({ storage_path: storagePath, file_type: fmt.type })]
    );

    createdDocs.push({ docId, type: fmt.type, file: fmt.file, jobId: jobRes.rows[0].id });
  }

  // Run worker once to process all queued jobs
  const workerProc = spawnSync('node', ['worker/index.js', '--once', '--type=process_document'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf-8',
    env: { ...process.env },
    timeout: 120000,
  });

  if (process.env.DEBUG) {
    console.log('Worker stdout:', workerProc.stdout);
    console.log('Worker stderr:', workerProc.stderr);
  }

  assert.equal(workerProc.status, 0, `Worker --once failed: ${workerProc.stderr}`);

  // Assert valid documents are 'ready' and have chunks with 1536-dim vectors
  const validDocs = createdDocs.filter((d) => d.file !== 'corrupt.pdf');
  for (const { docId, file } of validDocs) {
    const docRes = await query('SELECT status, page_count, error_message FROM documents WHERE id=$1', [docId]);
    assert.equal(docRes.rows[0].status, 'ready', `Document ${file} should be ready: ${docRes.rows[0].error_message}`);
    assert.ok(docRes.rows[0].page_count >= 1, `Document ${file} page_count should be >= 1`);

    // Verify chunks exist and have 1536 dimensions
    const chunksRes = await query(
      `SELECT id, page_number, chunk_index, content,
              array_length(string_to_array(trim(both '[]' from embedding::text), ','), 1) as dim
       FROM chunks
       WHERE document_id=$1`,
      [docId]
    );
    assert.ok(chunksRes.rows.length > 0, `Document ${file} should have chunks`);
    for (const chunk of chunksRes.rows) {
      assert.equal(chunk.dim, 1536, `Chunk embedding should be 1536-dim, got ${chunk.dim}`);
      assert.ok(chunk.content.length > 0, 'Chunk content should not be empty');
      assert.ok(chunk.page_number >= 1, 'Chunk page_number should be >= 1');
    }

    // Verify generation jobs were queued
    const genJobs = await query('SELECT job_type FROM jobs WHERE document_id=$1', [docId]);
    const jobTypes = genJobs.rows.map((j) => j.job_type);
    assert.ok(jobTypes.includes('generate_notes'), 'generate_notes should be queued');
    assert.ok(jobTypes.includes('generate_quiz'), 'generate_quiz should be queued');
    assert.ok(jobTypes.includes('generate_flashcards'), 'generate_flashcards should be queued');
  }

  // Assert corrupt document ends 'failed' with a clear error message
  const corruptDoc = createdDocs.find((d) => d.file === 'corrupt.pdf');
  const corruptRes = await query('SELECT status, error_message FROM documents WHERE id=$1', [corruptDoc.docId]);
  assert.equal(corruptRes.rows[0].status, 'failed', 'Corrupt document should be failed');
  assert.ok(corruptRes.rows[0].error_message, 'Corrupt document should have error_message');
  assert.ok(
    corruptRes.rows[0].error_message.includes('magic bytes') || corruptRes.rows[0].error_message.includes('Invalid PDF'),
    'Corrupt document error should explain format/magic bytes issue'
  );

  // ──────────────── Reprocess Idempotency Test ────────────────
  const testDoc = validDocs[0];
  const chunkCountBefore = await query('SELECT COUNT(*) FROM chunks WHERE document_id=$1', [testDoc.docId]);
  const count1 = parseInt(chunkCountBefore.rows[0].count, 10);

  // Re-enqueue process_document job
  await query("UPDATE documents SET status='processing' WHERE id=$1", [testDoc.docId]);
  await query(
    `INSERT INTO jobs (institute_id, document_id, job_type, payload)
     VALUES ($1, $2, 'process_document', '{}')`,
    [global.pipeInstId, testDoc.docId]
  );

  // Run worker once again
  const workerProc2 = spawnSync('node', ['worker/index.js', '--once', '--type=process_document'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf-8',
    env: { ...process.env },
    timeout: 120000,
  });
  assert.equal(workerProc2.status, 0);

  const chunkCountAfter = await query('SELECT COUNT(*) FROM chunks WHERE document_id=$1', [testDoc.docId]);
  const count2 = parseInt(chunkCountAfter.rows[0].count, 10);
  assert.equal(count1, count2, 'Reprocessing must be idempotent (no duplicate chunks created)');
});
