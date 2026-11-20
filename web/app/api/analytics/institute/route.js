/**
 * GET /api/analytics/institute
 *
 * Returns institute-wide per-batch totals:
 * - Members (students, teachers, total)
 * - Documents count
 * - Items count
 * - Quiz attempts count
 * - Chat messages count
 * - Tickets count (total and open)
 *
 * Accessible to Institute Admins only.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const user = await requireUser();

    if (user.role !== 'admin') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    const instituteId = user.institute_id;

    // 1. All batches and their member counts
    const batchesRes = await query(
      `SELECT b.id AS batch_id, b.name AS batch_name,
              COUNT(DISTINCT bm.user_id)::int AS member_count,
              COUNT(DISTINCT CASE WHEN bm.member_role = 'student' THEN bm.user_id END)::int AS student_count,
              COUNT(DISTINCT CASE WHEN bm.member_role = 'teacher' THEN bm.user_id END)::int AS teacher_count
       FROM batches b
       LEFT JOIN batch_members bm ON bm.batch_id = b.id
       WHERE b.institute_id = $1
       GROUP BY b.id, b.name
       ORDER BY b.name ASC`,
      [instituteId]
    );

    // 2. Documents count per batch
    const docsRes = await query(
      `SELECT batch_id, COUNT(*)::int AS count
       FROM documents
       WHERE institute_id = $1
       GROUP BY batch_id`,
      [instituteId]
    );
    const docsMap = new Map(docsRes.rows.map((r) => [r.batch_id, r.count]));

    // 3. Generated items count per batch
    const itemsRes = await query(
      `SELECT d.batch_id, COUNT(i.id)::int AS count
       FROM generated_items i
       JOIN documents d ON d.id = i.document_id
       WHERE i.institute_id = $1
       GROUP BY d.batch_id`,
      [instituteId]
    );
    const itemsMap = new Map(itemsRes.rows.map((r) => [r.batch_id, r.count]));

    // 4. Quiz attempts count per batch
    const attemptsRes = await query(
      `SELECT d.batch_id, COUNT(qa.id)::int AS count
       FROM quiz_attempts qa
       JOIN generated_items gi ON gi.id = qa.quiz_id
       JOIN documents d ON d.id = gi.document_id
       WHERE qa.institute_id = $1
       GROUP BY d.batch_id`,
      [instituteId]
    );
    const attemptsMap = new Map(attemptsRes.rows.map((r) => [r.batch_id, r.count]));

    // 5. Chat messages count per batch
    const chatRes = await query(
      `SELECT batch_id, COUNT(*)::int AS count
       FROM chat_messages
       WHERE institute_id = $1
       GROUP BY batch_id`,
      [instituteId]
    );
    const chatMap = new Map(chatRes.rows.map((r) => [r.batch_id, r.count]));

    // 6. Tickets count per batch (total and open)
    const ticketsRes = await query(
      `SELECT batch_id,
              COUNT(*)::int AS total_count,
              COUNT(CASE WHEN status = 'open' THEN 1 END)::int AS open_count
       FROM tickets
       WHERE institute_id = $1
       GROUP BY batch_id`,
      [instituteId]
    );
    const ticketsMap = new Map(ticketsRes.rows.map((r) => [r.batch_id, r]));

    // Assemble batch summaries and institute totals
    let totalMembers = 0;
    let totalStudents = 0;
    let totalTeachers = 0;
    let totalDocuments = 0;
    let totalItems = 0;
    let totalQuizAttempts = 0;
    let totalChatMessages = 0;
    let totalTickets = 0;
    let totalOpenTickets = 0;

    const batches = batchesRes.rows.map((b) => {
      const documentCount = docsMap.get(b.batch_id) || 0;
      const itemCount = itemsMap.get(b.batch_id) || 0;
      const quizAttemptCount = attemptsMap.get(b.batch_id) || 0;
      const chatMessageCount = chatMap.get(b.batch_id) || 0;
      const ticketInfo = ticketsMap.get(b.batch_id) || { total_count: 0, open_count: 0 };
      const ticketCount = ticketInfo.total_count;
      const openTicketCount = ticketInfo.open_count;

      totalMembers += b.member_count;
      totalStudents += b.student_count;
      totalTeachers += b.teacher_count;
      totalDocuments += documentCount;
      totalItems += itemCount;
      totalQuizAttempts += quizAttemptCount;
      totalChatMessages += chatMessageCount;
      totalTickets += ticketCount;
      totalOpenTickets += openTicketCount;

      return {
        batchId: b.batch_id,
        batchName: b.batch_name,
        memberCount: b.member_count,
        studentCount: b.student_count,
        teacherCount: b.teacher_count,
        documentCount,
        itemCount,
        quizAttemptCount,
        chatMessageCount,
        ticketCount,
        openTicketCount,
      };
    });

    return Response.json({
      batches,
      instituteTotals: {
        batchCount: batches.length,
        memberCount: totalMembers,
        studentCount: totalStudents,
        teacherCount: totalTeachers,
        documentCount: totalDocuments,
        itemCount: totalItems,
        quizAttemptCount: totalQuizAttempts,
        chatMessageCount: totalChatMessages,
        ticketCount: totalTickets,
        openTicketCount: totalOpenTickets,
      },
    });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
