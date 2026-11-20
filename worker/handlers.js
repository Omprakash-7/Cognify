/**
 * Worker job handlers.
 */

import { query, withTransaction } from '../lib/db.js';
import { downloadFile } from '../lib/storage.js';
import { parseDocument } from '../lib/parsers/index.js';
import { chunkPages } from '../lib/chunk.js';
import { embedTexts, generateJson, GEN_MODEL } from '../lib/llm.js';
import { toVectorLiteral } from '../lib/vector.js';
import {
  summarySchema,
  notesSchema,
  keyPointsSchema,
  quizSchema,
  flashcardsSchema,
  verifyQuizGrounding,
} from '../lib/grounding.js';

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

      // Mark any prior generated items as stale
      await client.query('UPDATE generated_items SET is_stale=true WHERE document_id=$1', [doc.id]);

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
 * Load all chunks for a document.
 * @param {string} documentId
 * @returns {Promise<Array<{ page_number: number, chunk_index: number, content: string, title: string, institute_id: string }>>}
 */
async function loadDocumentChunks(documentId) {
  const res = await query(
    `SELECT c.page_number, c.chunk_index, c.content, d.title, d.institute_id
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.document_id = $1
     ORDER BY c.page_number ASC, c.chunk_index ASC`,
    [documentId]
  );
  return res.rows;
}

/**
 * Save an AI-generated draft item idempotently.
 */
async function saveDraftItem({ instituteId, documentId, itemType, title, content, sourcePages }) {
  // Idempotency: replace any existing draft of this itemType for this document
  await query(
    `DELETE FROM generated_items WHERE document_id = $1 AND item_type = $2 AND status = 'draft'`,
    [documentId, itemType]
  );

  const res = await query(
    `INSERT INTO generated_items (institute_id, document_id, item_type, title, content, source_pages, status, is_stale)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', false)
     RETURNING id`,
    [instituteId, documentId, itemType, title, JSON.stringify(content), sourcePages]
  );
  return res.rows[0].id;
}

/**
 * Splits chunks into ~12k char slices for map-reduce on long documents.
 */
function groupChunksIntoSlices(chunks, maxCharsPerSlice = 12000) {
  const slices = [];
  let currentSlice = [];
  let currentLen = 0;

  for (const c of chunks) {
    const len = c.content.length;
    if (currentLen > 0 && currentLen + len > maxCharsPerSlice) {
      slices.push(currentSlice);
      currentSlice = [c];
      currentLen = len;
    } else {
      currentSlice.push(c);
      currentLen += len;
    }
  }
  if (currentSlice.length > 0) {
    slices.push(currentSlice);
  }
  return slices;
}

/**
 * Generate summary, notes, and key points for a document.
 */
export async function generateNotes(job) {
  const chunks = await loadDocumentChunks(job.document_id);
  if (chunks.length === 0) return true;

  const docTitle = chunks[0].title || 'Study Material';
  const instituteId = chunks[0].institute_id;
  const sourcePages = Array.from(new Set(chunks.map((c) => c.page_number))).sort((a, b) => a - b);

  const slices = groupChunksIntoSlices(chunks, 12000);

  // 1. Summary
  let summaryContent;
  if (slices.length === 1) {
    const text = slices[0].map((c) => `[Page ${c.page_number}] ${c.content}`).join('\n\n');
    summaryContent = await generateJson({
      model: GEN_MODEL,
      system:
        'You are an expert study material assistant. Generate an academic summary. Use ONLY the facts provided in the text. Do not invent any facts.',
      prompt: `DOCUMENT: "${docTitle}"\n\nTEXT:\n${text}\n\nGenerate an overview and section-by-section summaries. Return strictly valid JSON conforming to the schema.`,
      zodSchema: summarySchema,
    });
  } else {
    // Map-reduce: summarize each slice, then combine
    const sectionSummaries = [];
    for (const slice of slices) {
      const slicePages = Array.from(new Set(slice.map((c) => c.page_number))).sort((a, b) => a - b);
      const text = slice.map((c) => `[Page ${c.page_number}] ${c.content}`).join('\n\n');
      const partial = await generateJson({
        model: GEN_MODEL,
        system:
          'Summarize this section of the document. Use ONLY the facts provided. Return valid JSON: { overview: string, sections: [{ heading: string, summary: string, pages: [int] }] }',
        prompt: `SECTION PAGES: ${slicePages.join(', ')}\n\nTEXT:\n${text}`,
        zodSchema: summarySchema,
      });
      sectionSummaries.push(...partial.sections);
    }
    const overview = sectionSummaries.map((s) => s.summary).join(' ').slice(0, 500);
    summaryContent = {
      overview: overview || `Summary for ${docTitle}`,
      sections: sectionSummaries,
    };
  }
  await saveDraftItem({
    instituteId,
    documentId: job.document_id,
    itemType: 'summary',
    title: `${docTitle} — Summary`,
    content: summaryContent,
    sourcePages,
  });

  // 2. Structured Notes
  let notesContent;
  if (slices.length === 1) {
    const text = slices[0].map((c) => `[Page ${c.page_number}] ${c.content}`).join('\n\n');
    notesContent = await generateJson({
      model: GEN_MODEL,
      system:
        'Generate structured study notes with bullet points, definitions, and key formulas. Use ONLY facts from the provided text. Do not invent formulas or definitions outside the text.',
      prompt: `DOCUMENT: "${docTitle}"\n\nTEXT:\n${text}\n\nReturn strictly valid JSON: { title: string, sections: [{ heading: string, bullets: [string], definitions: [{ term: string, meaning: string }], formulas: [string], pages: [int] }] }`,
      zodSchema: notesSchema,
    });
  } else {
    const allSections = [];
    for (const slice of slices) {
      const text = slice.map((c) => `[Page ${c.page_number}] ${c.content}`).join('\n\n');
      const partial = await generateJson({
        model: GEN_MODEL,
        system:
          'Generate structured study notes for this section with bullets, definitions, and formulas. Use ONLY the provided text.',
        prompt: `TEXT:\n${text}`,
        zodSchema: notesSchema,
      });
      allSections.push(...partial.sections);
    }
    notesContent = {
      title: `${docTitle} Notes`,
      sections: allSections,
    };
  }
  await saveDraftItem({
    instituteId,
    documentId: job.document_id,
    itemType: 'notes',
    title: `${docTitle} — Notes`,
    content: notesContent,
    sourcePages,
  });

  // 3. Key Points
  const allText = chunks.map((c) => `[Page ${c.page_number}] ${c.content}`).join('\n\n');
  const keyPointsContent = await generateJson({
    model: GEN_MODEL,
    system:
      'Generate high-yield, exam-focused key points. Use ONLY facts from the provided text. For each point, explain why it matters for an exam.',
    prompt: `DOCUMENT: "${docTitle}"\n\nTEXT:\n${allText.slice(0, 15000)}\n\nReturn strictly valid JSON: { points: [{ point: string, whyItMatters: string, pages: [int] }] }`,
    zodSchema: keyPointsSchema,
  });
  await saveDraftItem({
    instituteId,
    documentId: job.document_id,
    itemType: 'key_points',
    title: `${docTitle} — Key Points`,
    content: keyPointsContent,
    sourcePages,
  });

  return true;
}

/**
 * Generate multiple-choice quiz questions and verify grounding.
 */
export async function generateQuiz(job) {
  const chunks = await loadDocumentChunks(job.document_id);
  if (chunks.length === 0) return true;

  const docTitle = chunks[0].title || 'Study Material';
  const instituteId = chunks[0].institute_id;
  const sourcePages = Array.from(new Set(chunks.map((c) => c.page_number))).sort((a, b) => a - b);

  const text = chunks.map((c) => `[Page ${c.page_number}] ${c.content}`).join('\n\n');

  const rawQuiz = await generateJson({
    model: GEN_MODEL,
    system: `You are an expert exam creator. Generate multiple-choice questions from the study material.
STRICT GROUNDING INSTRUCTIONS:
1. Every question MUST be strictly factual and answered using ONLY the provided text.
2. options MUST contain exactly 4 distinct, plausible choices (strings).
3. correctIndex MUST be an integer 0, 1, 2, or 3 corresponding to the correct answer.
4. difficulty MUST be one of: 'easy', 'medium', 'hard'.
5. sourcePage MUST be the integer page number where the answer appears.
6. sourceQuote MUST be an EXACT VERBATIM quote from that page that proves the correct answer. The quote must match the text character-for-character.
Return strictly valid JSON: { questions: [...] } (target 5 to 10 questions, maximum 25).`,
    prompt: `DOCUMENT: "${docTitle}"\n\nTEXT:\n${text.slice(0, 15000)}`,
    zodSchema: quizSchema,
  });

  // Verify grounding against chunks. Drops ungrounded questions; throws if < 3 survive.
  const groundedQuiz = verifyQuizGrounding(rawQuiz, chunks);

  await saveDraftItem({
    instituteId,
    documentId: job.document_id,
    itemType: 'quiz',
    title: `${docTitle} — Quiz`,
    content: groundedQuiz,
    sourcePages,
  });

  return true;
}

/**
 * Generate flashcards for a document.
 */
export async function generateFlashcards(job) {
  const chunks = await loadDocumentChunks(job.document_id);
  if (chunks.length === 0) return true;

  const docTitle = chunks[0].title || 'Study Material';
  const instituteId = chunks[0].institute_id;
  const sourcePages = Array.from(new Set(chunks.map((c) => c.page_number))).sort((a, b) => a - b);

  const text = chunks.map((c) => `[Page ${c.page_number}] ${c.content}`).join('\n\n');

  const flashcardsContent = await generateJson({
    model: GEN_MODEL,
    system:
      'Generate revision flashcards covering key definitions, concepts, and formulas from the study material. front should be a question or prompt, back should be the answer. sourcePage is the integer page number. Use ONLY the provided text.',
    prompt: `DOCUMENT: "${docTitle}"\n\nTEXT:\n${text.slice(0, 15000)}\n\nReturn strictly valid JSON: { cards: [{ front: string, back: string, sourcePage: int }] }`,
    zodSchema: flashcardsSchema,
  });

  await saveDraftItem({
    instituteId,
    documentId: job.document_id,
    itemType: 'flashcards',
    title: `${docTitle} — Flashcards`,
    content: flashcardsContent,
    sourcePages,
  });

  return true;
}

/** Map of job_type -> handler function. */
export const handlers = {
  process_document: processDocument,
  generate_notes: generateNotes,
  generate_quiz: generateQuiz,
  generate_flashcards: generateFlashcards,
};
