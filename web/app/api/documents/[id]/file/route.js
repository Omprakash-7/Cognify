/**
 * GET /api/documents/[id]/file
 * Generates a signed download URL for the document.
 * Students can only access when status === 'ready'.
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError } from '@/lib/api.js';
import { createSignedDownloadUrl } from '@/lib/storage.js';
import { getDocumentWithAccess } from '@/lib/documents.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_SECONDS = parseInt(process.env.SIGNED_URL_SECONDS || '300', 10);

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { doc, error } = await getDocumentWithAccess(id, user);
    if (error) return error;

    // Students may only download ready documents
    if (user.role === 'student' && doc.status !== 'ready') {
      return apiError('FORBIDDEN', 'Document is not ready for download', 403);
    }

    if (!doc.storage_path) {
      return apiError('NOT_FOUND', 'File not found in storage', 404);
    }

    const downloadUrl = await createSignedDownloadUrl(doc.storage_path, SIGNED_URL_SECONDS);

    return Response.json({ downloadUrl });
  } catch (err) {
    return handleAuthError(err);
  }
}
