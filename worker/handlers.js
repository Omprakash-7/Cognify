/**
 * Job handlers — one stub per job_type.
 * Each handler receives the full job row and throws on error.
 */

/**
 * Process a document: parse, chunk, embed, save, enqueue generation jobs.
 * TODO:
 *   1. Download file from storage (storage_path)
 *   2. Parse PDF/PPTX/DOCX/TXT into pages [{page, text}]
 *   3. Chunk pages with lib/chunk.js
 *   4. Generate embeddings via LLM API
 *   5. Save chunks + embeddings to the chunks table
 *   6. Update document status to 'ready' and set page_count
 *   7. Enqueue generate_notes, generate_quiz, generate_flashcards jobs
 * @param {object} job - The full job row from the database.
 */
export async function processDocument(job) {
  throw new Error('not implemented yet');
}

/**
 * Generate notes for a document from its chunks.
 * TODO:
 *   1. Fetch all chunks for the document
 *   2. Call LLM to produce structured notes (summary, key points)
 *   3. Save as a generated_item with item_type='notes', status='draft'
 *   4. Include source_pages array
 * @param {object} job - The full job row from the database.
 */
export async function generateNotes(job) {
  throw new Error('not implemented yet');
}

/**
 * Generate a quiz for a document.
 * TODO:
 *   1. Fetch all chunks for the document
 *   2. Call LLM to produce quiz questions (MCQ, short answer) as JSON
 *   3. Validate output with Zod schema
 *   4. Save as a generated_item with item_type='quiz', status='draft'
 * @param {object} job - The full job row from the database.
 */
export async function generateQuiz(job) {
  throw new Error('not implemented yet');
}

/**
 * Generate flashcards for a document.
 * TODO:
 *   1. Fetch all chunks for the document
 *   2. Call LLM to produce flashcard pairs (front/back) as JSON
 *   3. Validate output with Zod schema
 *   4. Save as a generated_item with item_type='flashcards', status='draft'
 * @param {object} job - The full job row from the database.
 */
export async function generateFlashcards(job) {
  throw new Error('not implemented yet');
}

/** Map of job_type -> handler function. */
export const handlers = {
  process_document: processDocument,
  generate_notes: generateNotes,
  generate_quiz: generateQuiz,
  generate_flashcards: generateFlashcards,
};
