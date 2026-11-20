/**
 * API utility helpers for Next.js Route Handlers.
 */

/**
 * Return a JSON error response.
 * @param {string} code
 * @param {string} message
 * @param {number} status
 * @returns {Response}
 */
export function apiError(code, message, status) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Check that the request Content-Type is application/json.
 * Returns an error Response on failure, null on success.
 * @param {Request} req
 * @returns {Response|null}
 */
export function checkContentType(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return apiError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', 415);
  }
  return null;
}

/**
 * Simple CSRF / origin check.
 * Accepts localhost:*, 127.0.0.1:*, or X-Forwarded-Host/Origin matching Host.
 * Returns an error Response on failure, null on success.
 * @param {Request} req
 * @returns {Response|null}
 */
export function checkOrigin(req) {
  const host = req.headers.get('host') || '';
  const origin = req.headers.get('origin') || '';
  const forwarded = req.headers.get('x-forwarded-host') || '';

  // Allow localhost or 127.0.0.1 connections
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    return null;
  }

  // For non-local, Origin or X-Forwarded-Host must match Host
  const effectiveOrigin = forwarded || (origin ? new URL(origin).host : '');
  if (effectiveOrigin && effectiveOrigin === host) {
    return null;
  }

  return apiError('FORBIDDEN', 'Origin not allowed', 403);
}

/**
 * Parse pagination query params.
 * @param {URL} url
 * @returns {{ limit: number, offset: number }}
 */
export function parsePagination(url) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  return { limit: isNaN(limit) ? 50 : limit, offset: isNaN(offset) ? 0 : offset };
}

/**
 * Handle errors from requireUser() and return appropriate Response.
 * @param {unknown} err
 * @returns {Response}
 */
export function handleAuthError(err) {
  if (err?.status === 401) return apiError('UNAUTHORIZED', 'Authentication required', 401);
  if (err?.status === 403) return apiError('FORBIDDEN', 'Insufficient permissions', 403);
  console.error(err);
  return apiError('INTERNAL_ERROR', 'Internal server error', 500);
}
