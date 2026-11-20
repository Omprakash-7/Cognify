/**
 * GET  /api/batches/[id]/documents — list documents in a batch
 * POST /api/batches/[id]/documents — initiate a document upload (creates row + signed upload URL)
 */

import { z } from 'zod';
import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, checkContentType, parsePagination } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { sanitizeFileName, createSignedUploadUrl } from '@/lib/storage.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '25', 10);
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(['pdf', 'pptx', 'docx', 'txt']),
  sizeBytes: z.number().int().positive(),
  title: z.string().optional(),
});

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id: batchId } = await params;
    const url = new URL(req.url);
    const { limit, offset } = parsePagination(url);

    // Verify batch belongs to user's institute
    const batchResult = await query(
      'SELECT id, institute_id FROM batches WHERE id=$1 AND institute_id=$2',
      [batchId, user.institute_id]
    );
    if (batchResult.rows.length === 0) {
      return apiError('NOT_FOUND', 'Batch not found', 404);
    }

    // Non-admin must be a member of this batch
    if (user.role !== 'admin') {
      const memberCheck = await query(
        'SELECT 1 FROM batch_members WHERE batch_id=$1 AND user_id=$2',
        [batchId, user.id]
      );
      if (memberCheck.rows.length === 0) {
        return apiError('NOT_FOUND', 'Batch not found', 404);
      }
    }

    const docsResult = await query(
      `SELECT id, institute_id, batch_id, title, file_name, file_type, status,
              error_message, page_count, created_at
       FROM documents
       WHERE batch_id=$1 AND institute_id=$2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [batchId, user.institute_id, limit, offset]
    );

    return Response.json({ documents: docsResult.rows });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id: batchId } = await params;

    const ctErr = checkContentType(req);
    if (ctErr) return ctErr;

    // Verify batch belongs to user's institute
    const batchResult = await query(
      'SELECT id, institute_id FROM batches WHERE id=$1 AND institute_id=$2',
      [batchId, user.institute_id]
    );
    if (batchResult.rows.length === 0) {
      return apiError('NOT_FOUND', 'Batch not found', 404);
    }

    // Teacher must be a member of this batch
    if (user.role === 'teacher') {
      const teacherCheck = await query(
        "SELECT 1 FROM batch_members WHERE batch_id=$1 AND user_id=$2 AND member_role='teacher'",
        [batchId, user.id]
      );
      if (teacherCheck.rows.length === 0) {
        return apiError('FORBIDDEN', 'Must be a teacher in this batch to upload documents', 403);
      }
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { fileName, fileType, sizeBytes, title } = parsed.data;

    // File size check (413 Payload Too Large)
    if (sizeBytes > MAX_BYTES) {
      return apiError(
        'PAYLOAD_TOO_LARGE',
        `File size exceeds maximum allowed limit of ${MAX_UPLOAD_MB}MB`,
        413
      );
    }

    const safeName = sanitizeFileName(fileName);
    const docTitle = (title || safeName).trim();
    const documentId = crypto.randomUUID();
    const storagePath = `${user.institute_id}/${batchId}/${documentId}/${safeName}`;

    await query(
      `INSERT INTO documents (
        id, institute_id, batch_id, uploaded_by, scope, title, file_name,
        file_type, storage_path, status
      ) VALUES ($1, $2, $3, $4, 'batch', $5, $6, $7, $8, 'processing')`,
      [documentId, user.institute_id, batchId, user.id, docTitle, safeName, fileType, storagePath]
    );

    const { signedUrl, token } = await createSignedUploadUrl(storagePath);

    return Response.json(
      {
        documentId,
        uploadUrl: signedUrl,
        token,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleAuthError(err);
  }
}
