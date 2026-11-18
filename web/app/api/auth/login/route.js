/**
 * POST /api/auth/login
 * Authenticates a user and sets the cognify_token cookie.
 */

import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifyPassword, hashPassword, signToken } from '../../../../lib/auth.js';
import { query } from '../../../../lib/db.js';
import { apiError, checkContentType } from '../../../lib/api.js';
import { COOKIE_NAME, cookieOptions } from '../../../lib/session.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory rate limiter: "email:ip" => { count, resetAt }
const rateLimitMap = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS = parseInt(process.env.LOGIN_MAX_FAILS || '5', 10);

// Dummy hash for timing-safe comparison when user not found
let dummyHash = null;
async function getDummyHash() {
  if (!dummyHash) {
    dummyHash = await hashPassword('dummy-password-for-timing-safety');
  }
  return dummyHash;
}

function getRateLimitKey(email, ip) {
  return `${email}:${ip}`;
}

function isRateLimited(key) {
  const entry = rateLimitMap.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    rateLimitMap.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function recordFailure(key) {
  const entry = rateLimitMap.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearRateLimit(key) {
  rateLimitMap.delete(key);
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req) {
  const ctErr = checkContentType(req);
  if (ctErr) return ctErr;

  // Extract IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  let body;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input', 400);
  }

  const { email, password } = parsed.data;
  const rateLimitKey = getRateLimitKey(email, ip);

  if (isRateLimited(rateLimitKey)) {
    return apiError('RATE_LIMITED', 'Too many failed attempts. Try again later.', 429);
  }

  // Look up user
  const result = await query(
    'SELECT id, institute_id, email, password_hash, full_name, role FROM users WHERE email=$1',
    [email.toLowerCase()]
  );

  const user = result.rows[0] || null;
  const hashToCompare = user ? user.password_hash : await getDummyHash();

  const valid = await verifyPassword(password, hashToCompare);

  if (!user || !valid) {
    recordFailure(rateLimitKey);
    return apiError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Success — clear rate limit, sign token, set cookie
  clearRateLimit(rateLimitKey);

  const token = signToken({
    sub: user.id,
    instituteId: user.institute_id,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, cookieOptions());

  return Response.json(
    {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        institute_id: user.institute_id,
      },
    },
    { status: 200 }
  );
}
