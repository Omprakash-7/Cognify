/**
 * GET /api/batches/[id]/items?type=
 *
 * Retrieves generated study items for all documents in a batch.
 * - Supports ?type= filter (summary, notes, key_points, quiz, flashcards).
 * - Teachers / Admins: see all items (draft, approved, rejected, stale).
 * - Students: see approved and non-stale items only.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getBatchWithAccess } from '@/lib/batches.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id: batchId } = await params;
    const url = new URL(req.url);
    const itemType = url.searchParams.get('type');

    const { batch, error } = await getBatchWithAccess(batchId, user);
    if (error) return error;

    let itemsQuery = `
      SELECT i.id, i.institute_id, i.document_id, i.item_type, i.title, i.content,
             i.source_pages, i.status, i.is_stale, i.reviewed_by, i.reviewed_at, i.created_at,
             d.title AS document_title
      FROM generated_items i
      JOIN documents d ON d.id = i.document_id
      WHERE d.batch_id = $1 AND i.institute_id = $2
    `;
    const queryParams = [batchId, user.institute_id];

    if (itemType) {
      queryParams.push(itemType);
      itemsQuery += ` AND i.item_type = $${queryParams.length}`;
    }

    if (user.role === 'student') {
      itemsQuery += " AND i.status = 'approved' AND i.is_stale = false";
    }

    itemsQuery += ' ORDER BY i.created_at ASC';

    const result = await query(itemsQuery, queryParams);

    // Sanitize quiz content for students so correctIndex never leaks
    const items = result.rows.map((row) => {
      if (user.role === 'student' && row.item_type === 'quiz' && row.content?.questions) {
        return {
          ...row,
          content: {
            ...row.content,
            questions: row.content.questions.map((q) => ({
              question: q.question,
              options: q.options,
              difficulty: q.difficulty,
              sourcePage: q.sourcePage,
            })),
          },
        };
      }
      return row;
    });

    return Response.json({ items });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
