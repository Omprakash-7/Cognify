/**
 * GET /api/batches/[id] — get a specific batch with members list
 */

import { requireUser } from '../../../lib/session.js';
import { apiError, handleAuthError } from '../../../lib/api.js';
import { query } from '../../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Fetch batch
    const batchResult = await query(
      'SELECT id, institute_id, name, subject, created_by, created_at FROM batches WHERE id=$1',
      [id]
    );

    if (batchResult.rows.length === 0) {
      return apiError('NOT_FOUND', 'Batch not found', 404);
    }

    const batch = batchResult.rows[0];

    // Ensure batch belongs to user's institute
    if (batch.institute_id !== user.institute_id) {
      return apiError('NOT_FOUND', 'Batch not found', 404);
    }

    // Check membership for non-admins
    if (user.role !== 'admin') {
      const memberCheck = await query(
        'SELECT 1 FROM batch_members WHERE batch_id=$1 AND user_id=$2',
        [id, user.id]
      );
      if (memberCheck.rows.length === 0) {
        return apiError('NOT_FOUND', 'Batch not found', 404);
      }
    }

    // Fetch members
    const membersResult = await query(
      `SELECT u.id, u.email, u.full_name, u.role, bm.member_role, bm.joined_at
       FROM batch_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.batch_id=$1
       ORDER BY bm.joined_at`,
      [id]
    );

    return Response.json({ batch, members: membersResult.rows });
  } catch (err) {
    return handleAuthError(err);
  }
}
