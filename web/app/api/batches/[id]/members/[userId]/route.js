/**
 * DELETE /api/batches/[id]/members/[userId] — remove a member from a batch
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id, userId } = await params;

    // Verify batch belongs to user's institute
    const batchResult = await query(
      'SELECT id, institute_id FROM batches WHERE id=$1',
      [id]
    );
    if (batchResult.rows.length === 0 || batchResult.rows[0].institute_id !== user.institute_id) {
      return apiError('NOT_FOUND', 'Batch not found', 404);
    }

    // Check the target member exists in this batch
    const memberResult = await query(
      'SELECT member_role FROM batch_members WHERE batch_id=$1 AND user_id=$2',
      [id, userId]
    );
    if (memberResult.rows.length === 0) {
      return apiError('NOT_FOUND', 'Member not found in this batch', 404);
    }

    const targetMemberRole = memberResult.rows[0].member_role;

    // Teachers cannot remove other teachers
    if (user.role === 'teacher' && targetMemberRole === 'teacher') {
      return apiError('FORBIDDEN', 'Teachers cannot remove other teachers', 403);
    }

    // Cannot remove the last teacher from a batch
    if (targetMemberRole === 'teacher') {
      const teacherCount = await query(
        "SELECT COUNT(*) FROM batch_members WHERE batch_id=$1 AND member_role='teacher'",
        [id]
      );
      if (parseInt(teacherCount.rows[0].count, 10) <= 1) {
        return apiError('CONFLICT', 'Cannot remove the last teacher from a batch', 409);
      }
    }

    await query(
      'DELETE FROM batch_members WHERE batch_id=$1 AND user_id=$2',
      [id, userId]
    );

    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
