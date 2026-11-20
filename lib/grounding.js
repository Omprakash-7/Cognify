/**
 * Grounding verification and Zod schemas for AI-generated study content.
 *
 * Validates:
 * - summary schema
 * - notes schema
 * - key_points schema
 * - quiz schema with strict verbatim quote grounding
 * - flashcards schema
 */

import { z } from 'zod';

export const summarySchema = z.object({
  overview: z.string().min(1, 'Overview cannot be empty'),
  sections: z.array(
    z.object({
      heading: z.string().min(1, 'Section heading cannot be empty'),
      summary: z.string().min(1, 'Section summary cannot be empty'),
      pages: z.array(z.number().int()).default([]),
    })
  ),
});

export const notesSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  sections: z.array(
    z.object({
      heading: z.string().min(1, 'Heading cannot be empty'),
      bullets: z.array(z.string()).default([]),
      definitions: z
        .array(
          z.object({
            term: z.string().min(1, 'Term cannot be empty'),
            meaning: z.string().min(1, 'Meaning cannot be empty'),
          })
        )
        .default([]),
      formulas: z.array(z.string()).default([]),
      pages: z.array(z.number().int()).default([]),
    })
  ),
});

export const keyPointsSchema = z.object({
  points: z.array(
    z.object({
      point: z.string().min(1, 'Point cannot be empty'),
      whyItMatters: z.string().min(1, 'whyItMatters cannot be empty'),
      pages: z.array(z.number().int()).default([]),
    })
  ),
});

export const quizQuestionSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  options: z.array(z.string().min(1)).length(4, 'Must have exactly 4 options'),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  sourcePage: z.number().int(),
  sourceQuote: z.string().min(1, 'Source quote cannot be empty'),
});

export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema).max(25, 'Maximum 25 questions per quiz'),
});

export const flashcardSchema = z.object({
  front: z.string().min(1, 'Front cannot be empty'),
  back: z.string().min(1, 'Back cannot be empty'),
  sourcePage: z.number().int(),
});

export const flashcardsSchema = z.object({
  cards: z.array(flashcardSchema),
});

/**
 * Normalizes text by lowercasing and collapsing whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Verify quiz question grounding against source document chunks.
 *
 * Rules:
 * 1. sourceQuote must appear (normalized whitespace/case) in chunk text of sourcePage.
 * 2. options must be 4 distinct strings.
 * 3. correctIndex must be valid integer 0-3.
 *
 * Drops questions failing verification.
 * Throws an error if fewer than 3 survive so the worker retries the job.
 *
 * @param {object} quizData
 * @param {Array<{ page_number: number, content: string }>} chunks
 * @returns {object} Validated quizData with surviving questions
 */
export function verifyQuizGrounding(quizData, chunks) {
  if (!quizData || !Array.isArray(quizData.questions)) {
    throw new Error('Invalid quiz data: questions array missing');
  }

  // Precompute normalized content per page
  const pageContentMap = new Map();
  for (const chunk of chunks) {
    const page = chunk.page_number;
    const existing = pageContentMap.get(page) || '';
    pageContentMap.set(page, existing + ' ' + normalizeText(chunk.content));
  }

  const allChunksNormalized = Array.from(pageContentMap.values()).join(' ');

  const surviving = [];

  for (const q of quizData.questions) {
    // 1. Verify 4 distinct options
    if (!Array.isArray(q.options) || q.options.length !== 4) continue;
    const distinctOptions = new Set(q.options.map((o) => normalizeText(o)));
    if (distinctOptions.size !== 4) continue;

    // 2. Verify correctIndex
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) continue;

    // 3. Verify sourceQuote grounding in chunk text
    const normQuote = normalizeText(q.sourceQuote);
    if (!normQuote || normQuote.length < 5) continue;

    const pageText = pageContentMap.get(q.sourcePage);
    const quoteFound = (pageText && pageText.includes(normQuote)) || allChunksNormalized.includes(normQuote);
    if (!quoteFound) continue;

    surviving.push(q);
  }

  if (surviving.length < 3) {
    throw new Error(
      `Quiz grounding verification failed: only ${surviving.length} questions survived grounding check (minimum 3 required)`
    );
  }

  return {
    ...quizData,
    questions: surviving,
  };
}
