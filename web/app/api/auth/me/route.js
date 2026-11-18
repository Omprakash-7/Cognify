/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */

import { requireUser } from '../../../lib/session.js';
import { apiError, handleAuthError } from '../../../lib/api.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ user });
  } catch (err) {
    return handleAuthError(err);
  }
}
