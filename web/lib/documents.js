import { query } from '@/lib/db.js';
import { apiError } from '@/lib/api.js';

/**
 * Fetch a document and verify tenant + batch membership access.
 * Returns { doc } or { error: Response }.
 * Cross-institute or non-member access returns 404.
 *
 * @param {string} documentId
 * @param {object} user - Authenticated user from requireUser()
 * @param {object} [options]
 * @param {boolean} [options.requireTeacher=false] - Whether teacher role in batch (or admin) is required
 * @returns {Promise<{ doc?: object, error?: Response }>}
 */
export async function getDocumentWithAccess(documentId, user, { requireTeacher = false } = {}) {
  const result = await query(
    `SELECT d.*, bm.member_role
     FROM documents d
     LEFT JOIN batch_members bm ON bm.batch_id = d.batch_id AND bm.user_id = $2
     WHERE d.id = $1 AND d.institute_id = $3`,
    [documentId, user.id, user.institute_id]
  );

  if (result.rows.length === 0) {
    return { error: apiError('NOT_FOUND', 'Document not found', 404) };
  }

  const doc = result.rows[0];

  // If user is not admin, they must be a member of the batch
  if (user.role !== 'admin' && !doc.member_role) {
    return { error: apiError('NOT_FOUND', 'Document not found', 404) };
  }

  // If requireTeacher is requested, user must be admin or teacher in that batch
  if (requireTeacher && user.role !== 'admin' && doc.member_role !== 'teacher') {
    return { error: apiError('FORBIDDEN', 'Teacher access required', 403) };
  }

  return { doc };
}
