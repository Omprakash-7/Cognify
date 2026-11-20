/**
 * GET /api/documents/[id]/items
 *
 * Retrieves generated study items for a document.
 * - Teachers / Admins: see all items (draft, approved, rejected, stale).
 * - Students: see approved and non-stale items only.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getDocumentWithAccess } from '@/lib/documents.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id: documentId } = await params;

    const { doc, error } = await getDocumentWithAccess(documentId, user);
    if (error) return error;

    let itemsQuery = `
      SELECT id, institute_id, document_id, item_type, title, content, source_pages,
             status, is_stale, reviewed_by, reviewed_at, created_at
      FROM generated_items
      WHERE document_id = $1 AND institute_id = $2
    `;
    const queryParams = [documentId, user.institute_id];

    if (user.role === 'student') {
      itemsQuery += " AND status = 'approved' AND is_stale = false";
    }

    itemsQuery += ' ORDER BY created_at ASC';

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
