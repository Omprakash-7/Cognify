/**
 * GET /api/batches/[id]/analytics
 *
 * Returns detailed analytics for a batch:
 * - Member count (total, students, teachers)
 * - Documents by status (ready, processing, failed)
 * - Items by type and status
 * - Quiz attempts (average score, attempts per quiz, hardest questions)
 * - Per-student progress (attempts count, average score)
 * - Chat messages per day for the last 14 days
 * - Unanswered questions (assistant messages with empty citations + preceding user question)
 * - Open tickets count
 *
 * Accessible to teachers in that batch or institute admins.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getBatchWithAccess } from '@/lib/batches.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id: batchId } = await params;

    const { batch, error: batchErr } = await getBatchWithAccess(batchId, user);
    if (batchErr) return batchErr;

    // Teacher in batch or admin
    if (user.role !== 'admin' && batch.member_role !== 'teacher') {
      return apiError('FORBIDDEN', 'Teacher access required', 403);
    }

    const instituteId = user.institute_id;

    // 1. Member counts
    const membersRes = await query(
      `SELECT member_role, COUNT(*)::int AS count
       FROM batch_members
       WHERE batch_id = $1
       GROUP BY member_role`,
      [batchId]
    );
    let studentCount = 0;
    let teacherCount = 0;
    for (const row of membersRes.rows) {
      if (row.member_role === 'student') studentCount = row.count;
      if (row.member_role === 'teacher') teacherCount = row.count;
    }
    const memberStats = {
      total: studentCount + teacherCount,
      students: studentCount,
      teachers: teacherCount,
    };

    // 2. Documents by status
    const docsRes = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM documents
       WHERE batch_id = $1 AND institute_id = $2
       GROUP BY status`,
      [batchId, instituteId]
    );
    const docsByStatus = { ready: 0, processing: 0, failed: 0 };
    let totalDocs = 0;
    for (const row of docsRes.rows) {
      docsByStatus[row.status] = row.count;
      totalDocs += row.count;
    }
    const documentStats = {
      total: totalDocs,
      byStatus: docsByStatus,
    };

    // 3. Items by type and status
    const itemsRes = await query(
      `SELECT i.item_type, i.status, COUNT(*)::int AS count
       FROM generated_items i
       JOIN documents d ON d.id = i.document_id
       WHERE d.batch_id = $1 AND i.institute_id = $2
       GROUP BY i.item_type, i.status`,
      [batchId, instituteId]
    );
    const itemsByType = { summary: 0, notes: 0, key_points: 0, quiz: 0, flashcards: 0 };
    const itemsByStatus = { draft: 0, approved: 0, rejected: 0 };
    let totalItems = 0;
    for (const row of itemsRes.rows) {
      itemsByType[row.item_type] = (itemsByType[row.item_type] || 0) + row.count;
      itemsByStatus[row.status] = (itemsByStatus[row.status] || 0) + row.count;
      totalItems += row.count;
    }
    const itemStats = {
      total: totalItems,
      byType: itemsByType,
      byStatus: itemsByStatus,
    };

    // 4. Quiz attempts & hardest questions
    const overallQuizRes = await query(
      `SELECT COUNT(qa.id)::int AS total_attempts,
              ROUND(AVG(qa.score::numeric / NULLIF(qa.total, 0) * 100), 2)::float AS avg_score_pct
       FROM quiz_attempts qa
       JOIN generated_items gi ON gi.id = qa.quiz_id
       JOIN documents d ON d.id = gi.document_id
       WHERE d.batch_id = $1 AND qa.institute_id = $2`,
      [batchId, instituteId]
    );
    const totalQuizAttempts = overallQuizRes.rows[0]?.total_attempts || 0;
    const avgQuizScorePct = overallQuizRes.rows[0]?.avg_score_pct ?? null;

    const quizListRes = await query(
      `SELECT gi.id AS quiz_id, gi.title,
              COUNT(qa.id)::int AS attempts_count,
              ROUND(AVG(qa.score::numeric / NULLIF(qa.total, 0) * 100), 2)::float AS avg_score_pct
       FROM generated_items gi
       JOIN documents d ON d.id = gi.document_id
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = gi.id
       WHERE d.batch_id = $1 AND gi.item_type = 'quiz' AND gi.institute_id = $2
       GROUP BY gi.id, gi.title, gi.created_at
       ORDER BY gi.created_at ASC`,
      [batchId, instituteId]
    );

    // Compute hardest questions from quiz attempts
    const attemptsDetailRes = await query(
      `SELECT gi.id AS quiz_id, gi.title AS quiz_title, gi.content, qa.answers
       FROM generated_items gi
       JOIN documents d ON d.id = gi.document_id
       JOIN quiz_attempts qa ON qa.quiz_id = gi.id
       WHERE d.batch_id = $1 AND gi.item_type = 'quiz' AND gi.institute_id = $2`,
      [batchId, instituteId]
    );

    // Map: `${quiz_id}:${question_index}` -> stats
    const questionStatsMap = new Map();
    for (const row of attemptsDetailRes.rows) {
      const questions = row.content?.questions || [];
      const answers = Array.isArray(row.answers) ? row.answers : [];

      for (let i = 0; i < questions.length; i++) {
        const key = `${row.quiz_id}:${i}`;
        if (!questionStatsMap.has(key)) {
          questionStatsMap.set(key, {
            quizId: row.quiz_id,
            quizTitle: row.quiz_title,
            questionIndex: i,
            question: questions[i].question,
            correctIndex: questions[i].correctIndex,
            attemptsCount: 0,
            correctCount: 0,
          });
        }
        const stat = questionStatsMap.get(key);
        if (answers[i] !== undefined) {
          stat.attemptsCount++;
          if (answers[i] !== null && answers[i] === questions[i].correctIndex) {
            stat.correctCount++;
          }
        }
      }
    }

    const hardestQuestions = Array.from(questionStatsMap.values())
      .filter((q) => q.attemptsCount > 0)
      .map((q) => ({
        quizId: q.quizId,
        quizTitle: q.quizTitle,
        questionIndex: q.questionIndex,
        question: q.question,
        attemptsCount: q.attemptsCount,
        correctCount: q.correctCount,
        correctPercentage: Math.round((q.correctCount / q.attemptsCount) * 100),
      }))
      .sort((a, b) => a.correctPercentage - b.correctPercentage)
      .slice(0, 10);

    const quizStats = {
      totalAttempts: totalQuizAttempts,
      averageScorePct: avgQuizScorePct,
      attemptsPerQuiz: quizListRes.rows,
      hardestQuestions,
    };

    // 5. Per-student progress
    const studentProgressRes = await query(
      `SELECT u.id AS user_id, u.full_name AS name, u.email,
              COALESCE(stats.attempts_count, 0)::int AS attempts_count,
              COALESCE(stats.avg_score_pct, 0)::float AS avg_score_pct
       FROM batch_members bm
       JOIN users u ON u.id = bm.user_id
       LEFT JOIN (
         SELECT qa.user_id,
                COUNT(qa.id)::int AS attempts_count,
                ROUND(AVG(qa.score::numeric / NULLIF(qa.total, 0) * 100), 2) AS avg_score_pct
         FROM quiz_attempts qa
         JOIN generated_items gi ON gi.id = qa.quiz_id
         JOIN documents d ON d.id = gi.document_id
         WHERE d.batch_id = $1 AND qa.institute_id = $2
         GROUP BY qa.user_id
       ) stats ON stats.user_id = u.id
       WHERE bm.batch_id = $1 AND bm.member_role = 'student'
       ORDER BY u.full_name ASC`,
      [batchId, instituteId]
    );

    // 6. Chat messages per day for the last 14 days
    const chatActivityRes = await query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
       FROM chat_messages
       WHERE batch_id = $1 AND institute_id = $2 AND created_at >= NOW() - INTERVAL '14 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY date ASC`,
      [batchId, instituteId]
    );

    // 7. Unanswered questions (assistant messages with empty citations + preceding user question)
    const unansweredRes = await query(
      `WITH ranked AS (
         SELECT id, user_id, role, content, citations, created_at,
                LAG(content) OVER (PARTITION BY batch_id, user_id ORDER BY created_at ASC) AS preceding_question,
                LAG(role) OVER (PARTITION BY batch_id, user_id ORDER BY created_at ASC) AS prev_role
         FROM chat_messages
         WHERE batch_id = $1 AND institute_id = $2
       )
       SELECT id AS message_id, user_id, content AS assistant_response, preceding_question, created_at
       FROM ranked
       WHERE role = 'assistant'
         AND (citations IS NULL OR citations = '[]'::jsonb)
         AND prev_role = 'user'
       ORDER BY created_at DESC
       LIMIT 50`,
      [batchId, instituteId]
    );

    // 8. Open tickets count
    const openTicketsRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM tickets
       WHERE batch_id = $1 AND institute_id = $2 AND status = 'open'`,
      [batchId, instituteId]
    );
    const openTicketsCount = openTicketsRes.rows[0]?.count || 0;

    return Response.json({
      batchId,
      batchName: batch.name,
      members: memberStats,
      documents: documentStats,
      items: itemStats,
      quizzes: quizStats,
      studentProgress: studentProgressRes.rows,
      chatActivity: chatActivityRes.rows,
      unansweredQuestions: unansweredRes.rows,
      openTicketsCount,
    });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
