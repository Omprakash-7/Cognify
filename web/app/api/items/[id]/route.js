/**
 * /api/items/[id]
 *
 * GET: view single item (students see approved & non-stale only, quiz answer key stripped)
 * PATCH: edit title and/or content (teachers/admins only, validated by schema)
 * DELETE: delete draft items (teachers/admins only)
 */

import { requireUser } from '@/lib/session.js';
import { apiError, handleAuthError, checkContentType } from '@/lib/api.js';
import { query } from '@/lib/db.js';
import { getItemWithAccess } from '@/lib/items.js';
import {
  summarySchema,
  notesSchema,
  keyPointsSchema,
  quizSchema,
  flashcardsSchema,
} from '@/lib/grounding.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schemasByType = {
  summary: summarySchema,
  notes: notesSchema,
  key_points: keyPointsSchema,
  quiz: quizSchema,
  flashcards: flashcardsSchema,
};

export async function GET(req, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const { item, error } = await getItemWithAccess(id, user);
    if (error) return error;

    // Sanitize quiz content for students
    let sanitizedItem = item;
    if (user.role === 'student' && item.item_type === 'quiz' && item.content?.questions) {
      sanitizedItem = {
        ...item,
        content: {
          ...item.content,
          questions: item.content.questions.map((q) => ({
            question: q.question,
            options: q.options,
            difficulty: q.difficulty,
            sourcePage: q.sourcePage,
          })),
        },
      };
    }

    return Response.json({ item: sanitizedItem });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id } = await params;

    const { item, error } = await getItemWithAccess(id, user, { requireTeacher: true });
    if (error) return error;

    const typeErr = checkContentType(req);
    if (typeErr) return typeErr;

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    const { title, content } = body;
    if (title === undefined && content === undefined) {
      return apiError('BAD_REQUEST', 'Either title or content must be provided', 400);
    }

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return apiError('VALIDATION_ERROR', 'Title cannot be empty', 422);
    }

    // Validate content against item type schema if provided
    let validatedContent = item.content;
    if (content !== undefined) {
      const schema = schemasByType[item.item_type];
      if (!schema) {
        return apiError('INTERNAL_ERROR', `No schema for type ${item.item_type}`, 500);
      }
      const parsed = schema.safeParse(content);
      if (!parsed.success) {
        return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid content schema', 422);
      }
      validatedContent = parsed.data;
    }

    const newTitle = title !== undefined ? title.trim() : item.title;

    const updateRes = await query(
      `UPDATE generated_items
       SET title = $2, content = $3::jsonb
       WHERE id = $1
       RETURNING id, institute_id, document_id, item_type, title, content, source_pages,
                 status, is_stale, reviewed_by, reviewed_at, created_at`,
      [id, newTitle, JSON.stringify(validatedContent)]
    );

    return Response.json({ item: updateRes.rows[0] });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const { id } = await params;

    const { item, error } = await getItemWithAccess(id, user, { requireTeacher: true });
    if (error) return error;

    // Only draft items can be deleted
    if (item.status !== 'draft') {
      return apiError('BAD_REQUEST', 'Only draft items can be deleted', 400);
    }

    await query('DELETE FROM generated_items WHERE id = $1', [id]);

    return Response.json({ ok: true });
  } catch (err) {
    const authErr = handleAuthError(err);
    if (authErr) return authErr;
    return apiError('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
