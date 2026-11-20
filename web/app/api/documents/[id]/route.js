/**
 * GET    /api/documents/[id] — get document metadata
 * DELETE /api/documents/[id] — delete document and its storage object
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { removeFile } from '@/lib/storage.js';
import { getDocumentWithAccess } from '@/lib/documents.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { doc, error } = await getDocumentWithAccess(id, user);
    if (error) return error;

    return Response.json({
      document: {
        id: doc.id,
        institute_id: doc.institute_id,
        batch_id: doc.batch_id,
        title: doc.title,
        file_name: doc.file_name,
        file_type: doc.file_type,
        status: doc.status,
        error_message: doc.error_message,
        page_count: doc.page_count,
        created_at: doc.created_at,
      },
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id } = await params;

    const { doc, error } = await getDocumentWithAccess(id, user, { requireTeacher: true });
    if (error) return error;

    // Remove from storage first
    if (doc.storage_path) {
      await removeFile(doc.storage_path);
    }

    // Delete row from DB (chunks and generated_items cascade via ON DELETE CASCADE)
    await query('DELETE FROM documents WHERE id=$1', [id]);

    return Response.json({ ok: true });
  } catch (err) {
    return handleAuthError(err);
  }
}
