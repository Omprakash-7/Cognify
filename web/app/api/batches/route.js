/**
 * GET /api/batches  — list batches
 * POST /api/batches — create a batch
 */

import { z } from 'zod';
import { requireUser } from '../../lib/session.js';
import { apiError, handleAuthError, checkContentType, parsePagination } from '../../lib/api.js';
import { query } from '../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBatchSchema = z.object({
  name: z.string().min(1),
  subject: z.string().optional(),
});

export async function GET(req) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const { limit, offset } = parsePagination(url);

    let sql, params;

    if (user.role === 'admin') {
      // Admins see all batches in their institute
      sql = `SELECT b.id, b.institute_id, b.name, b.subject, b.created_by, b.created_at
             FROM batches b
             WHERE b.institute_id=$1
             ORDER BY b.created_at DESC
             LIMIT $2 OFFSET $3`;
      params = [user.institute_id, limit, offset];
    } else {
      // Teachers/students see only batches they're a member of
      sql = `SELECT b.id, b.institute_id, b.name, b.subject, b.created_by, b.created_at
             FROM batches b
             JOIN batch_members bm ON bm.batch_id = b.id
             WHERE b.institute_id=$1 AND bm.user_id=$2
             ORDER BY b.created_at DESC
             LIMIT $3 OFFSET $4`;
      params = [user.institute_id, user.id, limit, offset];
    }

    const result = await query(sql, params);
    return Response.json({ batches: result.rows });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req) {
  try {
    const user = await requireUser(['admin', 'teacher']);

    const ctErr = checkContentType(req);
    if (ctErr) return ctErr;

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    const parsed = createBatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { name, subject } = parsed.data;

    try {
      const result = await query(
        `INSERT INTO batches (institute_id, name, subject, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, institute_id, name, subject, created_by, created_at`,
        [user.institute_id, name, subject || null, user.id]
      );
      return Response.json({ batch: result.rows[0] }, { status: 201 });
    } catch (err) {
      if (err.code === '23505') {
        return apiError('CONFLICT', 'A batch with this name already exists in your institute', 409);
      }
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
