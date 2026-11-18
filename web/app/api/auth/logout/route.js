/**
 * POST /api/auth/logout
 * Clears the cognify_token cookie.
 */

import { cookies } from 'next/headers';
import { COOKIE_NAME, cookieOptions } from '../../../lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', cookieOptions(true));
  return Response.json({ ok: true });
}
