/**
 * POST /api/quizzes/[id]/attempt
 *
 * Scores student quiz answers SERVER-SIDE, persists quiz_attempts, and returns results.
 */

import { z } from 'zod';
import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, checkContentType } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getItemWithAccess } from '@/lib/items.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const attemptSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3).nullable()),
});

export async function POST(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { item, error } = await getItemWithAccess(id, user);
    if (error) return error;

    if (item.item_type !== 'quiz') {
      return apiError('NOT_FOUND', 'Quiz not found', 404);
    }

    if (item.status !== 'approved' || item.is_stale) {
      return apiError('BAD_REQUEST', 'Only approved active quizzes can be attempted', 400);
    }

    const typeErr = checkContentType(req);
    if (typeErr) return typeErr;

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    const parsed = attemptSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message || 'Invalid answers array',
        422
      );
    }
    const { answers } = parsed.data;

    const questions = item.content?.questions || [];
    const total = questions.length;
    let score = 0;
    const results = [];

    for (let i = 0; i < total; i++) {
      const q = questions[i];
      const studentAns = answers[i] ?? null;
      const isCorrect = studentAns !== null && studentAns === q.correctIndex;
      if (isCorrect) score++;

      results.push({
        correct: isCorrect,
        correctIndex: q.correctIndex,
        explanation: q.explanation || '',
        sourcePage: q.sourcePage,
      });
    }

    // Persist quiz attempt
    const attemptRes = await query(
      `INSERT INTO quiz_attempts (institute_id, user_id, quiz_id, score, total, answers)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, created_at`,
      [user.institute_id, user.id, id, score, total, JSON.stringify(answers)]
    );

    return Response.json({
      attemptId: attemptRes.rows[0].id,
      score,
      total,
      results,
    });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
