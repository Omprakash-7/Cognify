/**
 * GET /api/quizzes/[id]
 *
 * Student Quiz view.
 * Returns questions WITHOUT correctIndex or explanation (approved only for students).
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { getItemWithAccess } from '@/lib/items.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { item, error } = await getItemWithAccess(id, user);
    if (error) return error;

    if (item.item_type !== 'quiz') {
      return apiError('NOT_FOUND', 'Quiz not found', 404);
    }

    const rawQuestions = item.content?.questions || [];
    const sanitizedQuestions = rawQuestions.map((q) => ({
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
      sourcePage: q.sourcePage,
    }));

    return Response.json({
      quiz: {
        id: item.id,
        title: item.title,
        documentId: item.document_id,
        status: item.status,
        questions: sanitizedQuestions,
      },
    });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
