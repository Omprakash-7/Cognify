/**
 * POST /api/tickets/[id]/close
 *
 * Closes a doubt ticket.
 * Allowed for the ticket owner (student who created it), teacher in that batch, or admin.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getTicketWithAccess } from '@/lib/tickets.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { ticket, error } = await getTicketWithAccess(id, user);
    if (error) return error;

    // Allowed: ticket owner, teacher in this batch, or admin
    const isOwner = ticket.student_id === user.id;
    const isTeacher = user.role === 'admin' || ticket.member_role === 'teacher';

    if (!isOwner && !isTeacher) {
      return apiError('FORBIDDEN', 'Only the ticket owner or a teacher can close this ticket', 403);
    }

    const result = await query(
      `UPDATE tickets
       SET status = 'closed'
       WHERE id = $1 AND institute_id = $2
       RETURNING id, institute_id, batch_id, student_id, question, status, answer, answered_by, created_at, answered_at`,
      [id, user.institute_id]
    );

    return Response.json({ ticket: result.rows[0] });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
