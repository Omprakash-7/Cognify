/**
 * GET /api/batches/[id]/chat/history
 *
 * Retrieves caller's own chat history in the specified batch.
 * Strictly scoped to the authenticated caller's user_id and institute_id.
 */

import { requireUser } from '@/lib/session.js';
import {
  apiError,
  handleAuthError,
  parsePagination,
} from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getBatchWithAccess } from '@/lib/batches.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id: batchId } = await params;
    const url = new URL(req.url);
    const { limit, offset } = parsePagination(url);

    // Verify batch exists and user has membership in tenant
    const { batch, error: batchErr } = await getBatchWithAccess(batchId, user);
    if (batchErr) return batchErr;

    // Fetch caller's messages only
    const result = await query(
      `SELECT id, role, content, citations, created_at
       FROM chat_messages
       WHERE institute_id = $1
         AND batch_id = $2
         AND user_id = $3
       ORDER BY created_at ASC
       LIMIT $4 OFFSET $5`,
      [user.institute_id, batchId, user.id, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM chat_messages
       WHERE institute_id = $1
         AND batch_id = $2
         AND user_id = $3`,
      [user.institute_id, batchId, user.id]
    );

    const total = countRes.rows[0]?.total || 0;

    const messages = result.rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      citations: row.citations || [],
      createdAt: row.created_at,
    }));

    return Response.json({
      messages,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
