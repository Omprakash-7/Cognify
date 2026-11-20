/**
 * GET /api/tickets
 *
 * Lists doubt tickets.
 * - Students: see their own tickets only.
 * - Teachers: see tickets for batches they belong to.
 * - Admins: see all tickets in the institute.
 * Supports ?status= (open, answered, closed), ?batchId=, and pagination (?limit, ?offset).
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
    const status = url.searchParams.get('status');
    const batchId = url.searchParams.get('batchId');

    let sql = `
      SELECT t.id, t.institute_id, t.batch_id, t.student_id, t.question, t.status,
             t.answer, t.answered_by, t.created_at, t.answered_at,
             b.name AS batch_name,
             s.full_name AS student_name, s.email AS student_email,
             a.full_name AS answered_by_name
      FROM tickets t
      JOIN batches b ON b.id = t.batch_id
      JOIN users s ON s.id = t.student_id
      LEFT JOIN users a ON a.id = t.answered_by
      WHERE t.institute_id = $1
    `;
    const params = [user.institute_id];

    if (user.role === 'student') {
      params.push(user.id);
      sql += ` AND t.student_id = $${params.length}`;
    } else if (user.role === 'teacher') {
      params.push(user.id);
      sql += ` AND t.batch_id IN (
        SELECT batch_id FROM batch_members WHERE user_id = $${params.length} AND member_role = 'teacher'
      )`;
    }
    // Admins see all tickets in their institute

    if (status) {
      if (!['open', 'answered', 'closed'].includes(status)) {
        return apiError('VALIDATION_ERROR', 'Invalid status filter. Must be open, answered, or closed', 422);
      }
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    if (batchId) {
      params.push(batchId);
      sql += ` AND t.batch_id = $${params.length}`;
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return Response.json({ tickets: result.rows });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
