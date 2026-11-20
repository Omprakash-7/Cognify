import { query } from '@/lib/db.js';
import { apiError } from '@/lib/api.js';

/**
 * Fetch a generated_item and verify tenant + batch membership access and role visibility.
 * Returns { item } or { error: Response }.
 *
 * @param {string} itemId
 * @param {object} user - Authenticated user from requireUser()
 * @param {object} [options]
 * @param {boolean} [options.requireTeacher=false] - Whether teacher role in batch (or admin) is required
 * @returns {Promise<{ item?: object, error?: Response }>}
 */
export async function getItemWithAccess(itemId, user, { requireTeacher = false } = {}) {
  const result = await query(
    `SELECT i.*, d.batch_id, d.title AS document_title, bm.member_role
     FROM generated_items i
     JOIN documents d ON d.id = i.document_id
     LEFT JOIN batch_members bm ON bm.batch_id = d.batch_id AND bm.user_id = $2
     WHERE i.id = $1 AND i.institute_id = $3`,
    [itemId, user.id, user.institute_id]
  );

  if (result.rows.length === 0) {
    return { error: apiError('NOT_FOUND', 'Item not found', 404) };
  }

  const item = result.rows[0];

  // If user is not admin, they must be a member of the batch
  if (user.role !== 'admin' && !item.member_role) {
    return { error: apiError('NOT_FOUND', 'Item not found', 404) };
  }

  // Teacher check if required
  if (requireTeacher && user.role !== 'admin' && item.member_role !== 'teacher') {
    return { error: apiError('FORBIDDEN', 'Teacher access required', 403) };
  }

  // Student visibility rule: students only see approved and not stale
  if (user.role === 'student') {
    if (item.status !== 'approved' || item.is_stale) {
      return { error: apiError('NOT_FOUND', 'Item not found', 404) };
    }
  }

  return { item };
}
