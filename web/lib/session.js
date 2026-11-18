/**
 * Session management for Next.js App Router.
 * Uses the cognify_token cookie to authenticate users.
 */

import { cookies } from 'next/headers';
import { verifyToken } from '../../lib/auth.js';
import { query } from '../../lib/db.js';

const COOKIE_NAME = 'cognify_token';

/**
 * Cookie options for cognify_token.
 * @param {boolean} [clear] – set to true to delete the cookie
 * @returns {object}
 */
export function cookieOptions(clear = false) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: clear ? 0 : 7 * 24 * 3600,
  };
}

export { COOKIE_NAME };

/**
 * Read the session cookie, verify the JWT, and re-fetch the user from DB.
 * Returns null if unauthenticated or token is invalid.
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(COOKIE_NAME);
    if (!tokenCookie?.value) return null;

    const payload = verifyToken(tokenCookie.value);
    if (!payload?.sub || !payload?.instituteId) return null;

    const result = await query(
      'SELECT id, institute_id, email, full_name, role FROM users WHERE id=$1 AND institute_id=$2',
      [payload.sub, payload.instituteId]
    );
    if (result.rows.length === 0) return null;

    return result.rows[0];
  } catch {
    return null;
  }
}

/**
 * Require an authenticated user, optionally with one of the given roles.
 * @param {string[]} [roles]
 * @returns {Promise<object>} user row
 * @throws {{ status: 401 | 403 }} on failure
 */
export async function requireUser(roles) {
  const user = await getSession();
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (roles && !roles.includes(user.role)) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return user;
}
