/**
 * GET /api/me/progress
 *
 * Retrieves caller's aggregated quiz progress:
 * best score, last score, total questions, and attempt counts per quiz.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();

    const result = await query(
      `SELECT 
         a.quiz_id,
         i.title AS quiz_title,
         MAX(a.score)::int AS best_score,
         (ARRAY_AGG(a.score ORDER BY a.created_at DESC))[1]::int AS last_score,
         MAX(a.total)::int AS total_questions,
         COUNT(*)::int AS attempts_count
       FROM quiz_attempts a
       JOIN generated_items i ON i.id = a.quiz_id
       WHERE a.user_id = $1 AND a.institute_id = $2
       GROUP BY a.quiz_id, i.title
       ORDER BY MAX(a.created_at) DESC`,
      [user.id, user.institute_id]
    );

    const progress = result.rows.map((row) => ({
      quizId: row.quiz_id,
      quizTitle: row.quiz_title,
      bestScore: row.best_score,
      lastScore: row.last_score,
      totalQuestions: row.total_questions,
      attemptsCount: row.attempts_count,
    }));

    return Response.json({ progress });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
