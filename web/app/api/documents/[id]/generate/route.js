/**
 * POST /api/documents/[id]/generate
 *
 * Enqueues background generation jobs (notes, quizzes, flashcards) for a document.
 * Roles: Admin or Teacher in the document's batch.
 */

import { z } from 'zod';
import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, checkContentType } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getDocumentWithAccess } from '@/lib/documents.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const generateSchema = z.object({
  types: z
    .array(z.enum(['summary', 'notes', 'key_points', 'quiz', 'flashcards']))
    .optional(),
});

export async function POST(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id } = await params;

    const { doc, error } = await getDocumentWithAccess(id, user, {
      requireTeacher: true,
    });
    if (error) return error;

    // Mutating check
    const typeErr = checkContentType(req);
    if (typeErr) return typeErr;

    let body = {};
    try {
      body = await req.json();
    } catch {}

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message || 'Invalid types array',
        422
      );
    }

    const requestedTypes =
      parsed.data.types && parsed.data.types.length > 0
        ? parsed.data.types
        : ['summary', 'notes', 'key_points', 'quiz', 'flashcards'];

    // Map requested item types to worker job types
    const jobTypesToQueue = new Set();
    for (const t of requestedTypes) {
      if (t === 'summary' || t === 'notes' || t === 'key_points') {
        jobTypesToQueue.add('generate_notes');
      } else if (t === 'quiz') {
        jobTypesToQueue.add('generate_quiz');
      } else if (t === 'flashcards') {
        jobTypesToQueue.add('generate_flashcards');
      }
    }

    const queued = [];

    for (const jobType of jobTypesToQueue) {
      // Check if job is already queued or running
      const existing = await query(
        `SELECT id FROM jobs
         WHERE document_id = $1 AND job_type = $2 AND status IN ('queued', 'running')`,
        [id, jobType]
      );

      if (existing.rows.length === 0) {
        const jobRes = await query(
          `INSERT INTO jobs (institute_id, document_id, job_type)
           VALUES ($1, $2, $3)
           RETURNING id, job_type`,
          [doc.institute_id, id, jobType]
        );
        queued.push({ id: jobRes.rows[0].id, jobType });
      } else {
        queued.push({ id: existing.rows[0].id, jobType, existing: true });
      }
    }

    return Response.json({ ok: true, queued });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
