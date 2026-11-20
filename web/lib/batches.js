import { query } from '@/lib/db.js';
import { apiError } from '@/lib/api.js';

/**
 * Fetch a batch and verify tenant + membership access.
 * Returns { batch } or { error: Response }.
 * Cross-institute or non-member access returns 404.
 *
 * @param {string} batchId
 * @param {object} user - Authenticated user from requireUser()
 * @returns {Promise<{ batch?: object, error?: Response }>}
 */
export async function getBatchWithAccess(batchId, user) {
  const result = await query(
    `SELECT b.*, bm.member_role
     FROM batches b
     LEFT JOIN batch_members bm ON bm.batch_id = b.id AND bm.user_id = $2
     WHERE b.id = $1 AND b.institute_id = $3`,
    [batchId, user.id, user.institute_id]
  );

  if (result.rows.length === 0) {
    return { error: apiError('NOT_FOUND', 'Batch not found', 404) };
  }

  const batch = result.rows[0];

  // If user is not admin, they must be a member of the batch
  if (user.role !== 'admin' && !batch.member_role) {
    return { error: apiError('NOT_FOUND', 'Batch not found', 404) };
  }

  return { batch };
}
