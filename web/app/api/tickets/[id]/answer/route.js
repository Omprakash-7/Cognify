/**
 * POST /api/tickets/[id]/answer
 *
 * Provides a teacher answer to a ticket.
 * Allowed for teachers in that ticket's batch or admins.
 */

import { z } from 'zod';
import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, checkContentType } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getTicketWithAccess } from '@/lib/tickets.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const answerSchema = z.object({
  answer: z
    .string()
    .trim()
    .min(1, 'Answer cannot be empty')
    .max(5000, 'Answer cannot exceed 5000 characters'),
});

export async function POST(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { ticket, error } = await getTicketWithAccess(id, user);
    if (error) return error;

    // Check teacher permission in this batch
    if (user.role !== 'admin' && ticket.member_role !== 'teacher') {
      return apiError('FORBIDDEN', 'Teacher access in this batch required to answer tickets', 403);
    }

    const typeErr = checkContentType(req);
    if (typeErr) return typeErr;

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid answer', 422);
    }
    const { answer } = parsed.data;

    const result = await query(
      `UPDATE tickets
       SET answer = $1, answered_by = $2, answered_at = NOW(), status = 'answered'
       WHERE id = $3 AND institute_id = $4
       RETURNING id, institute_id, batch_id, student_id, question, status, answer, answered_by, created_at, answered_at`,
      [answer, user.id, id, user.institute_id]
    );

    return Response.json({ ticket: result.rows[0] });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
