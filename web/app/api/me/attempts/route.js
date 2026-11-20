/**
 * GET /api/me/attempts
 *
 * Retrieves caller's own quiz attempts with scores and timestamps.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, parsePagination } from '@/lib/api.js';
import { query } from '@/lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const { limit, offset } = parsePagination(url);

    const result = await query(
      `SELECT a.id, a.quiz_id, a.score, a.total, a.answers, a.created_at,
              i.title AS quiz_title, d.title AS document_title
       FROM quiz_attempts a
       JOIN generated_items i ON i.id = a.quiz_id
       JOIN documents d ON d.id = i.document_id
       WHERE a.user_id = $1 AND a.institute_id = $2
       ORDER BY a.created_at DESC
       LIMIT $3 OFFSET $4`,
      [user.id, user.institute_id, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM quiz_attempts
       WHERE user_id = $1 AND institute_id = $2`,
      [user.id, user.institute_id]
    );

    const attempts = result.rows.map((row) => ({
      id: row.id,
      quizId: row.quiz_id,
      quizTitle: row.quiz_title,
      documentTitle: row.document_title,
      score: row.score,
      total: row.total,
      answers: row.answers,
      createdAt: row.created_at,
    }));

    return Response.json({
      attempts,
      pagination: {
        total: countRes.rows[0]?.total || 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
