/**
 * Worker job handlers.
 */

import { query, withTransaction } from '../lib/db.js';
import { downloadFile } from '../lib/storage.js';
import { parseDocument } from '../lib/parsers/index.js';
import { chunkPages } from '../lib/chunk.js';
import { embedTexts } from '../lib/llm.js';
import { toVectorLiteral } from '../lib/vector.js';

/**
 * Process a document: download, parse, chunk, embed, and store in DB.
 * Idempotent: deletes old chunks before inserting new ones.
 *
 * @param {object} job - The job row from the database.
 */
export async function processDocument(job) {
  const docResult = await query('SELECT * FROM documents WHERE id=$1', [job.document_id]);
  if (docResult.rows.length === 0) {
    throw new Error(`Document ${job.document_id} not found`);
  }
  const doc = docResult.rows[0];

  try {
    // 1. Download file from storage
    const buffer = await downloadFile(doc.storage_path);

    // 2. Parse file into pages [{ page, text }]
    const pages = await parseDocument(buffer, doc.file_type);
    const pageCount = pages.length;

    // 3. Chunk pages
    const chunks = chunkPages(pages);

    // 4. Generate embeddings via LLM
    let embeddings = [];
    if (chunks.length > 0) {
      embeddings = await embedTexts(
        chunks.map((c) => c.content),
        'RETRIEVAL_DOCUMENT'
      );
    }

    // 5. Save in transaction (idempotent)
    await withTransaction(async (client) => {
      // Remove any existing chunks for this document
      await client.query('DELETE FROM chunks WHERE document_id=$1', [doc.id]);

      // Bulk-insert chunks with vectors
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const emb = embeddings[i] ? toVectorLiteral(embeddings[i]) : null;
        await client.query(
          `INSERT INTO chunks (
            institute_id, batch_id, document_id, page_number, chunk_index, content, embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [doc.institute_id, doc.batch_id, doc.id, chunk.pageNumber, chunk.chunkIndex, chunk.content, emb]
        );
      }

      // Mark document ready
      await client.query(
        "UPDATE documents SET status='ready', page_count=$2, error_message=NULL WHERE id=$1",
        [doc.id, pageCount]
      );

      // Enqueue generation jobs (skip if already queued/running)
      const genTypes = ['generate_notes', 'generate_quiz', 'generate_flashcards'];
      for (const genType of genTypes) {
        const existing = await client.query(
          `SELECT id FROM jobs WHERE document_id=$1 AND job_type=$2 AND status IN ('queued', 'running')`,
          [doc.id, genType]
        );
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO jobs (institute_id, document_id, job_type) VALUES ($1, $2, $3)`,
            [doc.institute_id, doc.id, genType]
          );
        }
      }
    });
  } catch (err) {
    const safeMsg = String(err?.message || err).slice(0, 500);
    await query("UPDATE documents SET status='failed', error_message=$2 WHERE id=$1", [doc.id, safeMsg]);
    throw err;
  }
}

/**
 * Generate notes stub (implemented in Phase 5).
 */
export async function generateNotes(job) {
  return true;
}

/**
 * Generate quiz stub (implemented in Phase 5).
 */
export async function generateQuiz(job) {
  return true;
}

/**
 * Generate flashcards stub (implemented in Phase 5).
 */
export async function generateFlashcards(job) {
  return true;
}

/** Map of job_type -> handler function. */
export const handlers = {
  process_document: processDocument,
  generate_notes: generateNotes,
  generate_quiz: generateQuiz,
  generate_flashcards: generateFlashcards,
};
