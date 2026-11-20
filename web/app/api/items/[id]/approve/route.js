/**
 * POST /api/items/[id]/approve
 *
 * Approves a generated study item. Sets status='approved', reviewed_by, reviewed_at.
 * Roles: Admin or Teacher in the batch.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getItemWithAccess } from '@/lib/items.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id } = await params;

    const { item, error } = await getItemWithAccess(id, user, { requireTeacher: true });
    if (error) return error;

    const res = await query(
      `UPDATE generated_items
       SET status = 'approved', reviewed_by = $2, reviewed_at = now()
       WHERE id = $1
       RETURNING id, institute_id, document_id, item_type, title, content, source_pages,
                 status, is_stale, reviewed_by, reviewed_at, created_at`,
      [id, user.id]
    );

    return Response.json({ ok: true, item: res.rows[0] });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
