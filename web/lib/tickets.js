import { query } from '@/lib/db.js';
import { apiError } from '@/lib/api.js';

/**
 * Fetch a ticket and verify tenant and batch access.
 * Returns { ticket } or { error: Response }.
 *
 * @param {string} ticketId
 * @param {object} user - Authenticated user from requireUser()
 * @returns {Promise<{ ticket?: object, error?: Response }>}
 */
export async function getTicketWithAccess(ticketId, user) {
  const result = await query(
    `SELECT t.*, bm.member_role, b.name AS batch_name,
            s.full_name AS student_name, s.email AS student_email,
            a.full_name AS answered_by_name
     FROM tickets t
     JOIN batches b ON b.id = t.batch_id
     JOIN users s ON s.id = t.student_id
     LEFT JOIN users a ON a.id = t.answered_by
     LEFT JOIN batch_members bm ON bm.batch_id = t.batch_id AND bm.user_id = $2
     WHERE t.id = $1 AND t.institute_id = $3`,
    [ticketId, user.id, user.institute_id]
  );

  if (result.rows.length === 0) {
    return { error: apiError('NOT_FOUND', 'Ticket not found', 404) };
  }

  const ticket = result.rows[0];

  // If user is not admin, they must either be a member of the batch or the student owner
  if (user.role !== 'admin' && !ticket.member_role && ticket.student_id !== user.id) {
    return { error: apiError('NOT_FOUND', 'Ticket not found', 404) };
  }

  return { ticket };
}
