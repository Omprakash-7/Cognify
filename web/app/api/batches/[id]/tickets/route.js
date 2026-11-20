/**
 * POST /api/batches/[id]/tickets
 *
 * Creates a doubt ticket for a batch.
 * Allowed for any member of the batch (student or teacher) or admin.
 */

import { z } from 'zod';
import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, checkContentType } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getBatchWithAccess } from '@/lib/batches.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ticketSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Question cannot be empty')
    .max(2000, 'Question cannot exceed 2000 characters'),
});

export async function POST(req, { params }) {
  try {
    const user = await requireUser();
    const { id: batchId } = await params;

    const { batch, error: batchErr } = await getBatchWithAccess(batchId, user);
    if (batchErr) return batchErr;

    const typeErr = checkContentType(req);
    if (typeErr) return typeErr;

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    const parsed = ticketSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid question', 422);
    }
    const { question } = parsed.data;

    const result = await query(
      `INSERT INTO tickets (institute_id, batch_id, student_id, question)
       VALUES ($1, $2, $3, $4)
       RETURNING id, institute_id, batch_id, student_id, question, status, created_at`,
      [user.institute_id, batchId, user.id, question]
    );

    return Response.json({ ticket: result.rows[0] }, { status: 201 });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
