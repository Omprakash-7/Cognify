/**
 * POST /api/documents/[id]/reprocess
 * Re-enqueues process_document and marks existing generated_items as is_stale=true.
 */

import { requireUser } from '@/lib/session.js';
import { handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getDocumentWithAccess } from '@/lib/documents.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id } = await params;

    const { doc, error } = await getDocumentWithAccess(id, user, { requireTeacher: true });
    if (error) return error;

    // Set document status back to processing
    await query("UPDATE documents SET status='processing', error_message=NULL WHERE id=$1", [id]);

    // Mark existing generated_items as stale
    await query('UPDATE generated_items SET is_stale=true WHERE document_id=$1', [id]);

    // Check if process_document is already queued or running
    const existingJob = await query(
      `SELECT id FROM jobs
       WHERE document_id=$1 AND job_type='process_document' AND status IN ('queued', 'running')`,
      [id]
    );

    let jobId;
    if (existingJob.rows.length > 0) {
      jobId = existingJob.rows[0].id;
    } else {
      const jobResult = await query(
        `INSERT INTO jobs (institute_id, document_id, job_type, payload)
         VALUES ($1, $2, 'process_document', $3)
         RETURNING id`,
        [doc.institute_id, id, JSON.stringify({ storage_path: doc.storage_path, file_type: doc.file_type })]
      );
      jobId = jobResult.rows[0].id;
    }

    return Response.json({ ok: true, jobId });
  } catch (err) {
    return handleAuthError(err);
  }
}
