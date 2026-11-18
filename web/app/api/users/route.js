/**
 * GET /api/users  — list users in the institute (admin, teacher)
 * POST /api/users — create a new user (admin only)
 */

import { z } from 'zod';
import { requireUser } from '../../lib/session.js';
import { apiError, handleAuthError, checkContentType, parsePagination } from '../../lib/api.js';
import { hashPassword } from '../../../lib/auth.js';
import { query } from '../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(['teacher', 'student']),
});

export async function GET(req) {
  try {
    const user = await requireUser(['admin', 'teacher']);
    const url = new URL(req.url);
    const { limit, offset } = parsePagination(url);
    const roleFilter = url.searchParams.get('role');

    let sql = `SELECT id, institute_id, email, full_name, role, created_at
               FROM users
               WHERE institute_id=$1`;
    const params = [user.institute_id];

    if (roleFilter) {
      params.push(roleFilter);
      sql += ` AND role=$${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return Response.json({ users: result.rows });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(req) {
  try {
    const user = await requireUser(['admin']);

    const ctErr = checkContentType(req);
    if (ctErr) return ctErr;

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 400);
    }

    const { email, password, full_name, role } = parsed.data;
    const passwordHash = await hashPassword(password);

    try {
      const result = await query(
        `INSERT INTO users (institute_id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, institute_id, email, full_name, role, created_at`,
        [user.institute_id, email.toLowerCase(), passwordHash, full_name, role]
      );
      return Response.json({ user: result.rows[0] }, { status: 201 });
    } catch (err) {
      if (err.code === '23505') {
        return apiError('CONFLICT', 'A user with this email already exists', 409);
      }
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
