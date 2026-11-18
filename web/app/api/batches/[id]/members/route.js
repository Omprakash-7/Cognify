/**
 * POST /api/batches/[id]/members — add a member to a batch
 */

import { z } from 'zod';
import { requireUser } from '../../../../lib/session.js';
import { apiError, handleAuthError, checkContentType } from '../../../../lib/api.js';
import { query } from '../../../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['teacher', 'student']),
});

export async function POST(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id } = await params;

    const ctErr = checkContentType(req);
    if (ctErr) return ctErr;

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { userId, role: memberRole } = parsed.data;

    // Verify batch belongs to user's institute
    const batchResult = await query(
      'SELECT id, institute_id FROM batches WHERE id=$1',
      [id]
    );
    if (batchResult.rows.length === 0 || batchResult.rows[0].institute_id !== user.institute_id) {
      return apiError('NOT_FOUND', 'Batch not found', 404);
    }

    // Verify target user belongs to same institute
    const targetResult = await query(
      'SELECT id, institute_id, role FROM users WHERE id=$1',
      [userId]
    );
    if (targetResult.rows.length === 0 || targetResult.rows[0].institute_id !== user.institute_id) {
      return apiError('NOT_FOUND', 'User not found in your institute', 404);
    }

    // Teachers can only add students
    if (user.role === 'teacher' && memberRole === 'teacher') {
      return apiError('FORBIDDEN', 'Teachers can only add students to a batch', 403);
    }

    try {
      await query(
        `INSERT INTO batch_members (batch_id, user_id, member_role) VALUES ($1, $2, $3)`,
        [id, userId, memberRole]
      );
      return Response.json({ ok: true }, { status: 201 });
    } catch (err) {
      if (err.code === '23505') {
        return apiError('CONFLICT', 'User is already a member of this batch', 409);
      }
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
